import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { createRaceRules } from '../server/race/rules.mjs';
import { stationModes } from '../server/race/exercises.mjs';
import { raceBriefing } from '../public/race/briefing.js';
import { sceneProgress } from '../public/race/showtime.js';

const realNow = Date.now;
let stamp = 1800000000000;
Date.now = () => stamp;
const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
async function req(path, data, headers = {}) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), response };
}
function correctAnswer(task) {
  const e = task.exercise;
  if (!e) return task.mode === 'text' ? task.content.meaning : task.word;
  if (e.kind === 'match') return JSON.stringify(task.solution);
  if (e.kind === 'order') {
    const available = [...e.tokens],
      ids = [];
    let rest = task.solution;
    while (rest) {
      const index = available.findIndex(
        (token) =>
          rest.startsWith(token.value) &&
          (e.separator === '' ||
            rest.length === token.value.length ||
            rest[token.value.length] === ' '),
      );
      assert.ok(index >= 0);
      const [token] = available.splice(index, 1);
      ids.push(token.id);
      rest = rest.slice(token.value.length);
      if (e.separator !== '') rest = rest.trimStart();
    }
    return JSON.stringify(ids);
  }
  return task.solution;
}
try {
  const login = await req('/api/teacher/login', { password: 'test-password' });
  const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
  const configuration = (await req('/api/teacher/config', undefined, teacher)).body;
  configuration.config.race.countdown = 0;
  configuration.config.race.itemEvery = 8;
  await req(
    '/api/teacher/config',
    { config: configuration.config, revision: configuration.revision },
    teacher,
  );
  assert.equal(
    (await req('/api/teacher/race/create', { title: 'Invalid', endless: 'yes' }, teacher)).status,
    400,
  );
  const raceId = (
    await req(
      '/api/teacher/race/create',
      { title: 'Six minute endless', endless: true, format: 'adaptive-four' },
      teacher,
    )
  ).body.raceId;
  const control = (action) => req('/api/teacher/race/state', { raceId, action }, teacher);
  async function join(label) {
    const r = await req('/api/race/join', { raceId, label });
    assert.equal(r.status, 200);
    return { id: r.body.self.id, auth: { authorization: 'Bearer ' + r.body.token } };
  }
  const me = async (p) => (await req('/api/race/me', undefined, p.auth)).body;
  const a = await join('23'),
    b = await join('13');
  for (const p of [a, b]) await req('/api/race/ready', { avatar: 'cat' }, p.auth);
  const start = await control('start');
  assert.equal(start.body.race.endless, true);
  assert.equal(start.body.race.total, null);
  assert.equal(start.body.race.stationQuestions, null);
  assert.equal(start.body.race.settings.minutes, 6);
  const row = await env.DB.prepare('SELECT * FROM races WHERE id=?').bind(raceId).first();
  const pool = JSON.parse(row.tasks)[0].pool;
  const rules = createRaceRules({
    words: pool,
    raceAvatarCatalog: [],
    shuffle: (a) => a,
    spellingCharacters: (w) => [...w.replaceAll(' ', '')],
    now: () => stamp,
  });
  async function task(p) {
    const r = await env.DB.prepare('SELECT * FROM races WHERE id=?').bind(raceId).first();
    const s = JSON.parse(
      (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state,
    );
    return rules.raceCurrentTask(r, s);
  }
  async function answer(p) {
    const t = await task(p),
      payload = { questionId: t.id, answer: correctAnswer(t) };
    const r = await req('/api/race/answer', payload, p.auth);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.receipt.correct, true);
    return { ...r.body, payload };
  }
  assert.notEqual((await task(a)).id, (await task(b)).id);
  assert.equal(
    (await req('/api/race/answer', { questionId: (await task(b)).id, answer: 'x' }, a.auth)).status,
    409,
  );
  const ids = new Set(),
    words = new Set(),
    modes = new Set(),
    boxes = new Set();
  for (let n = 0; n < 36; n++) {
    const before = await me(a),
      current = await task(a);
    assert.equal(before.self.task.id, current.id);
    assert.deepEqual((await me(a)).self.task, before.self.task);
    assert.equal('solution' in before.self.task, false);
    assert.equal('expected' in before.self.task, false);
    ids.add(current.id);
    modes.add(current.mode);
    if (n < pool.length) words.add(current.word);
    const after = await answer(a);
    if (after.self.itemBox) boxes.add(after.self.itemBox);
    assert.equal(after.self.done, false, 'question count never ends a timed station');
    if (n === 24) {
      const retry = await req('/api/race/answer', after.payload, a.auth);
      assert.equal(retry.body.self.score, after.self.score);
      assert.equal(retry.body.self.index, 25);
    }
    stamp += 1000;
  }
  assert.equal(ids.size, 36);
  assert.equal(
    words.size,
    pool.length,
    'all assigned words appear before a vocabulary cycle repeats',
  );
  assert.deepEqual([...modes].sort(), [...stationModes[0]].sort());
  assert.equal(boxes.size, 4, 'items continue at 24 and 32');
  const board = (await req('/api/teacher/race/board?race=' + raceId, undefined, teacher)).body;
  const shown = board.players.find((p) => p.id === a.id);
  assert.equal(typeof shown.recordRevision,'number','Teacher records expose an authoritative cache revision');
  assert.equal((await me(a)).board.some(p=>'recordRevision' in p || 'history' in p || 'label' in p),false,'Private record versions and answers remain teacher-only');
  assert.equal(shown.stationIndex, 36);
  assert.equal(shown.remaining, 324000);
  assert.equal(shown.mode, (await me(a)).self.task.mode);
  assert.equal(sceneProgress(await me(a)).answered, 36);
  assert.ok(Number.isFinite(sceneProgress(await me(a)).percent));
  stamp += 120000;
  const late = await join('28');
  assert.equal((await me(late)).self.task, null);
  const admitted = (await req('/api/race/ready', { avatar: 'fox' }, late.auth)).body;
  assert.equal(admitted.self.remaining, 360000);
  assert.equal(admitted.self.index, 0);
  await control('pause');
  const frozen = (await me(a)).self.remaining;
  stamp += 60000;
  assert.equal((await me(a)).self.remaining, frozen);
  assert.equal((await me(late)).self.remaining, 360000);
  assert.equal(
    (
      await req(
        '/api/race/answer',
        { questionId: (await task(a)).id, answer: correctAnswer(await task(a)) },
        a.auth,
      )
    ).status,
    423,
  );
  await control('resume');
  await answer(b);
  await answer(late);
  stamp += frozen + 1;
  assert.equal((await me(a)).self.done, true);
  assert.equal((await me(late)).self.done, false);
  const expiredTask = await task(a);
  assert.equal(
    (
      await req(
        '/api/race/answer',
        { questionId: expiredTask.id, answer: correctAnswer(expiredTask) },
        a.auth,
      )
    ).status,
    423,
  );
  assert.equal(
    (await me(late)).race.status,
    'running',
    'late learners retain their personal six minutes',
  );
  stamp += 360000;
  assert.equal((await me(a)).race.status, 'intermission');
  const firstResults = (await me(a)).stationResults[0];
  assert.equal(firstResults.closed, true);
  assert.equal(firstResults.players.length, 3);
  for (let station = 1; station < 3; station++) {
    const next = await control('nextStation');
    assert.equal(next.status, 200);
    assert.equal((await me(a)).self.index, 0);
    assert.equal((await me(a)).self.remaining, 360000);
    const types = new Set();
    for (let n = 0; n < 28; n++) {
      types.add((await task(a)).mode);
      await answer(a);
    }
    assert.deepEqual([...types].sort(), [...stationModes[station]].sort());
    assert.equal((await me(a)).self.done, false);
    await answer(b);
    await answer(late);
    stamp += 360001;
    const after = await me(a);
    assert.equal(after.race.status, station === 2 ? 'finished' : 'intermission');
    assert.equal(after.stationResults[station].closed, true);
    assert.equal(after.stationResults[station].players.length, 3);
  }
  const final = await me(a);
  assert.equal(final.self.answered, 92);
  assert.equal(final.self.learning.answered, 92);
  assert.equal(final.self.done, true);
  const briefing = raceBriefing(final.race, '6年生 · Unit 4–5');
  assert.equal(briefing.duration, 6);
  assert.equal(briefing.items.length, final.race.settings.items.length);
  assert.equal(briefing.courses.length, 3);
  assert.ok(briefing.courses.every((c) => c.types.length === 4));
  assert.ok(briefing.ranking.includes('合計得点'));
  assert.ok(briefing.ranking.includes('速さのボーナスはありません'));
  const exported = await worker.fetch(
    new Request('https://classroom.test/api/teacher/race/export?race=' + raceId, {
      headers: teacher,
    }),
    env,
  );
  assert.equal(exported.status, 200);
  assert.ok((await exported.text()).includes('出席番号'));
  console.log(
    'PASS: endless 24+ questions, stable personal random tasks, complete vocabulary cycles, four types per station, recurring items, no answer-count finish, exact personal clocks, late join, pause, receipts, scope isolation, three timed podiums, teacher mode/time and dynamic briefing.',
  );
} finally {
  Date.now = realNow;
}
