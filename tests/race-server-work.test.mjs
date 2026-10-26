import assert from 'node:assert/strict';
import { database } from './database.mjs';
import * as infrastructure from '../server/classroom/infrastructure.mjs';
import { createRaceRules } from '../server/race/rules.mjs';
import { createRaceRepository } from '../server/race/repository.mjs';
import { createRaceService } from '../server/race/service.mjs';
import { createStudentRaceHandler } from '../server/race/student.mjs';
import { createTeacherRaceHandler } from '../server/race/teacher.mjs';

const stamp = 1800000000000;
const words = Array.from({ length: 4 }, (_, i) => ({ word: 'word' + i, meaning: '意味' + i }));

async function fixture(options = {}) {
  const env = { DB: database() },
    queries = [];
  let interrupted = false;
  const prepare = env.DB.prepare;
  env.DB.prepare = (sql) => {
    const statement = prepare(sql);
    for (const method of ['first', 'all', 'run']) {
      const execute = statement[method];
      statement[method] = async (...args) => {
        queries.push({ sql, method });
        if (
          options.pauseOnTransition &&
          !interrupted &&
          method === 'run' &&
          sql.startsWith('UPDATE races SET status=?')
        ) {
          interrupted = true;
          await prepare(
            "UPDATE races SET status='paused',started_at=NULL,revision=revision+1 WHERE id=?",
          )
            .bind('room')
            .run();
        }
        return execute(...args);
      };
    }
    return statement;
  };
  const runtime = {
    ...infrastructure,
    words,
    raceAvatarCatalog: [{ id: 'cat' }],
    spellingCharacters: (value) => [...value],
    now: () => stamp,
    teacher: async (request) => request.headers.get('authorization') === 'Bearer teacher',
  };
  const rules = createRaceRules(runtime);
  const repository = createRaceRepository({ ...runtime, ...rules });
  const service = createRaceService({ ...runtime, ...rules, ...repository });
  const dependencies = { ...runtime, ...rules, ...repository, ...service };
  const handler = createStudentRaceHandler(dependencies);
  const teacher = createTeacherRaceHandler(dependencies);
  const settings = {
    questions: 24,
    questionsPerStation: 24,
    minutes: 6,
    countdown: 3,
    modes: ['text'],
    goalPercent: 50,
    endless: options.endless || false,
  };
  const tasks = Array.from({ length: 72 }, (_, i) => ({
    ...rules.raceTask(words[i % words.length], 'text', words, (values) => values, 'task-' + i),
    rules: options.rules ?? 5,
    station: Math.floor(i / 24),
    ...(i ? {} : { settings, pool: words }),
  }));
  await infrastructure
    .stmt(
      env,
      'INSERT INTO races (id,title,status,tasks,remaining_ms,started_at,created,station) VALUES (?,?,?,?,?,?,?,?)',
      'room',
      'Query rehearsal',
      options.status || 'running',
      JSON.stringify(tasks),
      options.remaining ?? 360000,
      stamp + (options.countdown ? 3000 : -1000),
      stamp - 100000,
      options.station || 0,
    )
    .run();
  for (let i = 0; i < (options.players ?? 35); i++) {
    const state = {
      history: options.history || [],
      wrong: [],
      index: options.index ?? 0,
      correct: 0,
      score: 0,
      avatar: 'cat',
      ready: options.ready ?? true,
      prepared: true,
      deckSeed: 'seed-' + i,
      item: null,
      boost: 0,
      joinedElapsed: 0,
    };
    await infrastructure
      .stmt(
        env,
        'INSERT INTO racers (id,race_id,label,number,token_hash,state,last_seen) VALUES (?,?,?,?,?,?,?)',
        'player-' + i,
        'room',
        String(i + 1),
        i + 1,
        await infrastructure.hash('token-' + i),
        JSON.stringify(state),
        stamp,
      )
      .run();
  }
  async function request(path, authorization = 'token-0') {
    const req = new Request('https://classroom.test' + path, {
      headers: authorization ? { authorization: 'Bearer ' + authorization } : {},
    });
    return path.startsWith('/api/teacher/')
      ? teacher(req, env, new URL(req.url))
      : handler(req, env, new URL(req.url));
  }
  // Frozen v62 /me orchestration. The same rules and fixture data isolate the
  // work removed by the single-snapshot path from unrelated game behavior.
  async function legacyMe() {
    const p = await infrastructure
      .stmt(env, 'SELECT * FROM racers WHERE token_hash=?', await infrastructure.hash('token-0'))
      .first();
    let r = await repository.raceRoom(env, p.race_id);
    const board = await service.raceBoard(env, r);
    r = await repository.raceRoom(env, r.id);
    return { ...(await service.raceSession(env, p, r)), board: board.players };
  }
  queries.length = 0;
  return { env, queries, rules, request, legacyMe };
}

const count = (queries, pattern) => queries.filter((q) => pattern.test(q.sql)).length;
const playerReads = (queries) => count(queries, /^SELECT \* FROM racers WHERE race_id=/);
const roomReads = (queries) => count(queries, /^SELECT \* FROM races WHERE id=/);

const scenarios = [
  { status: 'lobby' },
  { status: 'running' },
  { status: 'running', countdown: true },
  { status: 'paused' },
  { status: 'intermission', index: 24 },
  { status: 'finished', index: 72 },
  { status: 'running', ready: false },
  { status: 'running', index: 24 },
  { status: 'running', station: 2, index: 72 },
  { status: 'running', remaining: 500 },
  { status: 'running', endless: true, index: 180 },
  { status: 'running', rules: 3, index: 72 },
];
for (const scenario of scenarios) {
  const old = await fixture(scenario),
    current = await fixture(scenario);
  const expected = await old.legacyMe();
  const response = await current.request('/api/race/me');
  assert.equal(response.status, 200);
  const actual = await response.json();
  assert.deepEqual(actual, JSON.parse(JSON.stringify(expected)), JSON.stringify(scenario));
  assert.equal(playerReads(old.queries), 2, 'v62 reads the entire racer list twice per poll');
  assert.equal(playerReads(current.queries), 1, 'each poll reads the racer list once');
  assert.equal(count(current.queries, /^UPDATE racers/), 0, 'polling never rewrites racer state');
  if (scenario.status === 'running' && scenario.index === 24) {
    assert.equal(actual.race.status, 'intermission');
    assert.equal(actual.self.task, null);
    assert.equal(actual.stationResults[0].closed, true);
  }
  if (scenario.station === 2) {
    assert.equal(actual.race.status, 'finished');
    assert.equal(actual.self.done, true);
    assert.equal(actual.self.task, null);
  }
  if (scenario.status === 'running' && !scenario.index && !scenario.remaining) {
    assert.equal(roomReads(old.queries), 2);
    assert.equal(roomReads(current.queries), 1, 'unchanged room does not need a second lookup');
  }
}

const guarded = await fixture({ players: 2 });
assert.equal((await guarded.request('/api/race/me', null)).status, 401);
assert.equal(playerReads(guarded.queries), 0);
await infrastructure
  .stmt(guarded.env, 'UPDATE races SET deleted_at=? WHERE id=?', stamp, 'room')
  .run();
assert.equal((await guarded.request('/api/race/me')).status, 404);
assert.equal(playerReads(guarded.queries), 0);

// A late entrant who has not pressed ready must not make a completed group close.
const late = await fixture({ players: 2, index: 24 });
const lateRow = await infrastructure
  .stmt(late.env, 'SELECT state FROM racers WHERE id=?', 'player-1')
  .first();
const lateState = JSON.parse(lateRow.state);
Object.assign(lateState, { index: 0, ready: false });
await infrastructure
  .stmt(late.env, 'UPDATE racers SET state=? WHERE id=?', JSON.stringify(lateState), 'player-1')
  .run();
late.queries.length = 0;
assert.equal((await (await late.request('/api/race/me')).json()).race.status, 'running');
assert.equal(playerReads(late.queries), 1);
assert.equal(count(late.queries, /^UPDATE races/), 0);

// The room clock still expires even when a late entrant has not pressed ready.
const expiredLate = await fixture({ players: 2, remaining: 500, ready: false });
const expiredSession = await (await expiredLate.request('/api/race/me')).json();
assert.equal(expiredSession.race.status, 'intermission');
assert.equal(expiredSession.self.ready, false);
assert.equal(expiredSession.self.task, null);
assert.equal(playerReads(expiredLate.queries), 1);
assert.equal(count(expiredLate.queries, /^UPDATE racers/), 0);

// A teacher pause winning the revision check must be returned consistently.
const interrupted = await fixture({ players: 2, index: 24, pauseOnTransition: true });
const interruptedSession = await (await interrupted.request('/api/race/me')).json();
assert.equal(interruptedSession.race.status, 'paused');
assert.equal(interruptedSession.self.task, null);
assert.equal(interruptedSession.stationResults[0].closed, false);
assert.equal(playerReads(interrupted.queries), 1);
assert.equal(count(interrupted.queries, /^UPDATE racers/), 0);

// Byte-for-byte CSV reference copied from the v62 exporter, including its
// historical index guard and spreadsheet-formula escaping.
function legacyCsv(players, stationRace) {
  const rows = [
    [
      '出席番号',
      'レーサー',
      '得点',
      '回答数',
      '独立正解',
      '問題',
      '題型',
      '回答',
      '正解',
      'ヒント',
      '加点',
      '自力正解率',
      '最大連続正解',
      '連続正解ボーナス',
      'コース',
      '正解の例',
      '問題のステップ',
      'サポート形式',
    ],
  ];
  for (const p of players) {
    const s = JSON.parse(p.state);
    if (!s.history.length) rows.push([p.label, '出席番号 ' + p.label, s.score, 0, 0]);
    for (const h of s.history)
      rows.push([
        p.label,
        '出席番号 ' + p.label,
        s.score,
        stationRace ? s.history.filter((x) => !x.review).length : s.index,
        s.correct,
        h.word,
        h.mode,
        h.answer,
        h.correct ? '○' : '×',
        h.hinted ? 'あり' : 'なし',
        h.points,
        s.index
          ? Math.round(
              (s.correct / (stationRace ? s.history.filter((x) => !x.review).length : s.index)) *
                1000,
            ) /
              10 +
            '%'
          : '',
        s.bestStreak || 0,
        h.streakBonus || 0,
        (h.station ?? 0) + 1,
        h.expected || '',
        h.level || '',
        h.support || '',
      ]);
  }
  return '\ufeff' + rows.map((row) => row.map(infrastructure.csvCell).join(',')).join('\r\n');
}

for (const scenario of [
  { rules: 3, index: 12 },
  { rules: 5, index: 24 },
  { rules: 6, endless: true, index: 0 },
  { rules: 6, endless: true, index: 51 },
]) {
  const history = Array.from({ length: 180 }, (_, i) => ({
    word: i % 5 ? 'word-' + i : '=SUM(A1)',
    mode: ['text', 'spelling', 'voice'][i % 3],
    answer: 'a,"b"\n' + i,
    correct: i % 4 !== 0,
    hinted: i % 7 === 0,
    review: i % 11 === 0,
    station: Math.floor(i / 60),
    points: i % 4 ? 100 : 0,
    expected: i % 3 ? undefined : 'expected',
    level: i % 3,
    support: i % 2 ? '' : 'hint',
  }));
  const f = await fixture({ ...scenario, status: 'finished', players: 2, history });
  const rows = (
    await infrastructure
      .stmt(f.env, 'SELECT * FROM racers WHERE race_id=? ORDER BY number', 'room')
      .all()
  ).results;
  const main = JSON.parse(rows[0].state);
  main.correct = 117;
  main.score = 12000;
  main.bestStreak = 8;
  rows[0].state = JSON.stringify(main);
  rows[1].state = JSON.stringify({ ...main, history: [], index: 0 });
  for (const row of rows)
    await infrastructure
      .stmt(f.env, 'UPDATE racers SET state=? WHERE id=?', row.state, row.id)
      .run();

  const parse = JSON.parse;
  let scans = 0;
  const instrumented = new Set(rows.map((row) => row.state));
  JSON.parse = (text, ...args) => {
    const result = parse(text, ...args);
    if (instrumented.has(text)) {
      const filter = result.history.filter;
      Object.defineProperty(result.history, 'filter', {
        value: (...values) => {
          scans++;
          return filter.apply(result.history, values);
        },
      });
    }
    return result;
  };
  try {
    const expected = legacyCsv(rows, scenario.rules >= 5),
      before = scans;
    scans = 0;
    const response = await f.request('/api/teacher/race/export?race=room', 'teacher');
    assert.equal(response.status, 200);
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      new TextEncoder().encode(expected),
    );
    assert.equal(scans, scenario.rules >= 5 ? 2 : 0, 'at most one history filter per player');
    assert.equal(before, scenario.rules >= 5 ? history.length * (scenario.index ? 2 : 1) : 0);
    assert.match(response.headers.get('content-type'), /text\/csv/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await f.request('/api/teacher/race/export?race=room')).status, 401);
  } finally {
    JSON.parse = parse;
  }
}

console.log(
  'PASS: one racer SELECT per poll (v62: two), coherent transitions and legacy-equivalent sessions, authorization/deletion and late-ready guards; exact legacy CSV bytes with 360 to 2 history filters for a 180-answer fixture.',
);
