import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import {
  materializeExercise,
  gradeExercise,
  learnerLevel,
  stationModes,
  sentenceFor,
} from '../server/race/exercises.mjs';
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
  return { status: response.status, body: await response.json(), response };
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const configuration = (await req('/api/teacher/config', undefined, teacher)).body;
const c = configuration.config;
Object.assign(c.race, {
  questions: 8,
  minutes: 20,
  countdown: 0,
  items: ['hint', 'compass', 'review'],
  itemEvery: 3,
});
assert.equal(
  (await req('/api/teacher/config', { config: c, revision: configuration.revision }, teacher))
    .status,
  200,
);
assert.equal(
  (await req('/api/teacher/race/create', { title: 'bad', format: 'garbage' }, teacher)).status,
  400,
);
const raceId = (
  await req(
    '/api/teacher/race/create',
    { title: 'Four types × three stations', format: 'adaptive-four' },
    teacher,
  )
).body.raceId;
const row = await env.DB.prepare('SELECT * FROM races WHERE id=?').bind(raceId).first();
const seeds = JSON.parse(row.tasks),
  pool = seeds[0].pool;
assert.equal(seeds.length, 24);
assert.equal(seeds[0].rules, 6);
for (let station = 0; station < 3; station++) {
  assert.deepEqual(
    [...new Set(seeds.slice(station * 8, station * 8 + 8).map((t) => t.mode))].sort(),
    [...stationModes[station]].sort(),
  );
}
const high = Array.from({ length: 8 }, () => ({ correct: true }));
const low = Array.from({ length: 8 }, () => ({ correct: false }));
assert.equal(learnerLevel(high, 2), 3);
assert.equal(learnerLevel(low, 2), 1);
assert.equal(
  learnerLevel(
    high.map((h) => ({ ...h, hinted: true })),
    2,
  ),
  1,
);
const profiles = [c, c.grade5, c.unit7];
for (const profile of profiles)
  for (const content of profile.words) {
    assert.ok(sentenceFor(content).answer.toLowerCase() === content.word.toLowerCase());
    for (const mode of [
      'match',
      'sentence',
      'cloze',
      'audioMatch',
      'audioSentence',
      'audioCloze',
      'dictation',
    ])
      for (const history of [high, low]) {
        const t = materializeExercise(
          { id: 'seed-' + content.word, content, mode, station: 2, rules: 6 },
          { history },
          profile.words,
        );
        const e = t.exercise;
        const answer = correctAnswer(t);
        assert.equal(gradeExercise(t, answer).correct, true, mode + ': ' + content.word);
        assert.equal(gradeExercise(t, '').valid, false);
        assert.equal(gradeExercise(t, 'x'.repeat(2001)).valid, false);
        assert.deepEqual(
          materializeExercise(
            { id: t.id, content, mode, station: 2, rules: 6 },
            { history },
            profile.words,
          ),
          t,
          'polls are deterministic',
        );
        if (e.kind === 'match') {
          assert.equal(
            gradeExercise(t, JSON.stringify(t.solution.map((p) => t.solution[0]))).valid,
            false,
          );
          const wrong = t.solution.map((p, i, a) => [p[0], a[(i + 1) % a.length][1]]);
          assert.equal(gradeExercise(t, JSON.stringify(wrong)).correct, false);
        }
      }
  }
function correctAnswer(t) {
  const e = t.exercise;
  if (!e) return t.mode === 'text' ? t.content.meaning : t.content.word;
  if (e.kind === 'match') return JSON.stringify(t.solution);
  if (e.kind === 'order') {
    const available = e.tokens.slice(),
      result = [];
    // Recover the authored chunks without assuming IDs encode the answer.
    let rest = t.solution;
    while (rest.length) {
      const index = available.findIndex(
        (v) =>
          rest.startsWith(v.value) &&
          (e.separator === '' || rest.length === v.value.length || rest[v.value.length] === ' '),
      );
      assert.ok(index >= 0, 'all target chunks are available');
      const [token] = available.splice(index, 1);
      result.push(token.id);
      rest = rest.slice(token.value.length);
      if (e.separator !== '') rest = rest.trimStart();
    }
    return JSON.stringify(result);
  }
  return t.solution;
}
const players = [];
for (let i = 1; i <= 3; i++) {
  const joined = (await req('/api/race/join', { raceId, label: String(i) })).body;
  players.push({
    id: joined.self.id,
    auth: { authorization: 'Bearer ' + joined.token },
    good: i !== 2,
  });
  assert.equal((await req('/api/race/ready', { avatar: 'fox' }, players.at(-1).auth)).status, 200);
}
const orders = await Promise.all(
  players.map(
    async (p) =>
      JSON.parse(
        (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state,
      ).taskOrder,
  ),
);
assert.notDeepEqual(orders[0], orders[1]);
const control = (action) => req('/api/teacher/race/state', { raceId, action }, teacher);
await control('start');
let hinted = false,
  reviewed = false;
for (let station = 0; station < 3; station++) {
  for (const p of players)
    for (let n = 0; n < 8; n++) {
      const view = (await req('/api/race/me', undefined, p.auth)).body;
      let state = JSON.parse(
        (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state,
      );
      const original = seeds[state.taskOrder[state.index]];
      let task = materializeExercise(original, state, pool);
      assert.equal(view.self.task.id, task.id);
      if (task.exercise) {
        assert.equal('solution' in view.self.task, false);
        assert.equal('expected' in view.self.task, false);
        assert.deepEqual(
          (await req('/api/race/me', undefined, p.auth)).body.self.task,
          view.self.task,
          're-entry does not change task',
        );
        assert.equal(
          (await req('/api/race/answer', { questionId: task.id, answer: null }, p.auth)).status,
          400,
        );
      }
      if (station === 2 && task.exercise && p.good && !hinted) {
        state.item = 'compass';
        state.usedSegment = -1;
        await env.DB.prepare('UPDATE racers SET state=? WHERE id=?')
          .bind(JSON.stringify(state), p.id)
          .run();
        const item = await req('/api/race/item', { questionId: task.id }, p.auth);
        assert.equal(item.status, 200);
        assert.ok(item.body.self.task.exercise.hint);
        state = JSON.parse(
          (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state,
        );
        task = materializeExercise(original, state, pool);
        hinted = true;
      }
      let answer = correctAnswer(task);
      if (!p.good) {
        if (!task.exercise)
          answer =
            task.mode === 'spelling'
              ? 'z'.repeat(task.content.word.length).replace(/ /g, '')
              : task.options.find((x) => x !== answer);
        else if (task.exercise.kind === 'match')
          answer = JSON.stringify(
            task.solution.map((pair, i, a) => [pair[0], a[(i + 1) % a.length][1]]),
          );
        else if (task.exercise.kind === 'order')
          answer = JSON.stringify(JSON.parse(answer).reverse());
        else
          answer =
            task.exercise.choices?.find((v) => v.toLowerCase() !== task.solution.toLowerCase()) ||
            'wrong';
      }
      const post = { questionId: task.id, answer };
      const result = await req('/api/race/answer', post, p.auth);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.receipt.correct, p.good);
      const retry = await req('/api/race/answer', post, p.auth);
      assert.deepEqual(retry.body.receipt, result.body.receipt, 'idempotent submission');
      assert.equal(retry.body.self.score, result.body.self.score);
      if (station === 2 && p.id === players[1].id && !reviewed) {
        let updated = JSON.parse(
          (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state,
        );
        updated.item = 'review';
        updated.wrong = [{ word: task.content.word, mode: task.mode }];
        updated.usedSegment = -1;
        await env.DB.prepare('UPDATE racers SET state=? WHERE id=?')
          .bind(JSON.stringify(updated), p.id)
          .run();
        const current = (await req('/api/race/me', undefined, p.auth)).body.self.task;
        if (current) {
          const review = await req('/api/race/item', { questionId: current.id }, p.auth);
          assert.equal(review.status, 200);
          assert.equal(review.body.self.task.review, true);
          const target = pool.find((w) => w.word === review.body.self.task.spoken);
          const done = await req(
            '/api/race/answer',
            {
              questionId: review.body.self.task.id,
              answer: review.body.self.task.mode === 'text' ? target.meaning : target.word,
            },
            p.auth,
          );
          assert.equal(done.status, 200);
          assert.equal(done.body.receipt.review, true);
          const cleared = JSON.parse(
            (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state,
          );
          assert.equal(
            cleared.wrong.some((q) => q.word === task.content.word && q.mode === task.mode),
            false,
          );
          reviewed = true;
        }
      }
    }
  assert.equal(
    (await req('/api/race/me', undefined, players[0].auth)).body.race.status,
    station === 2 ? 'finished' : 'intermission',
  );
  if (station < 2) await control('nextStation');
}
assert.ok(hinted && reviewed);
const goodState = JSON.parse(
  (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(players[2].id).first()).state,
);
const lowState = JSON.parse(
  (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(players[1].id).first()).state,
);
assert.ok(goodState.history.some((h) => h.station === 2 && h.level === 3));
assert.ok(lowState.history.filter((h) => !h.review && h.station === 2).every((h) => h.level === 1));
console.log(
  'PASS: 3×4 types, all curriculum examples, adaptive supports, deterministic polling, malformed answers, opaque pair IDs, retry receipts, item hints, review compatibility, and complete three-station flow.',
);
