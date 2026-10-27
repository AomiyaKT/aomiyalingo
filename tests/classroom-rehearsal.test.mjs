import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { createRequest } from '../public/shared/request.js';

// SQLite stands in for D1. Queue atomic batches, while independent HTTP calls
// remain concurrent; never manufacture nested SQLite transactions.
const DB = database(),
  batch = DB.batch.bind(DB);
let writes = Promise.resolve();
DB.batch = (items) => {
  const job = writes.then(() => batch(items));
  writes = job.catch(() => {});
  return job;
};
const env = { DB, TEACHER_PASSWORD: 'rehearsal-only' };
const originalNow = Date.now;
let time = originalNow();
Date.now = () => time;
async function req(path, data, auth = {}) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { status: response.status, body: await response.clone().json(), response };
}
const ok = async (...args) => {
  const result = await req(...args);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
};
try {
  const login = await req('/api/teacher/login', { password: 'rehearsal-only' });
  const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
  const configuration = await ok('/api/teacher/config', undefined, teacher);
  Object.assign(configuration.config.race, { countdown: 0, questions: 24, minutes: 6, items: [] });
  await ok(
    '/api/teacher/config',
    { config: configuration.config, revision: configuration.revision },
    teacher,
  );

  const classroom = await ok('/api/teacher/classes', { title: '35人の練習' }, teacher);
  const ordinary = await Promise.all(
    Array.from({ length: 35 }, (_, i) => ok('/api/join', { label: String(i + 1) })),
  );
  await Promise.all(
    ordinary.map(async (s, index) => {
      const auth = { authorization: 'Bearer ' + s.token },
        task = s.lesson.queue[0];
      const word = s.lesson.vocabulary.find((w) => w.word === task.word);
      const payload = { questionId: task.id, answer: [index % 5 === 0 ? 'wrong' : word.meaning] };
      const answered = await ok('/api/student/answer', payload, auth);
      const replay = await ok('/api/student/answer', payload, auth);
      assert.equal(replay.duplicate, true);
      assert.equal(replay.lesson.attempts, 1);
      assert.deepEqual((await ok('/api/student/me', undefined, auth)).lesson, answered.lesson);
    }),
  );
  let progress = await ok('/api/teacher/progress?class=' + classroom.id, undefined, teacher);
  assert.equal(progress.students.length, 35);
  assert.equal(progress.attempts.length, 35);
  assert.equal(progress.students.filter((s) => s.needsHelp === 1).length, 7);

  const raceId = (await ok('/api/teacher/race/create', { title: '35人の三駅レース' }, teacher))
    .raceId;
  const tasks = JSON.parse(
    (await DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks,
  );
  const peers = [];
  const join = async (label) => {
    const joined = await ok('/api/race/join', { raceId, label: String(label) });
    const peer = {
      id: joined.self.id,
      label: String(label),
      auth: { authorization: 'Bearer ' + joined.token },
    };
    peers.push(peer);
    return peer;
  };
  const me = (peer) => ok('/api/race/me', undefined, peer.auth);
  const control = (action) =>
    ok('/api/teacher/race/state', { raceId, action, confirm: true }, teacher);
  for (let i = 1; i <= 34; i++) {
    const peer = await join(i);
    if (i !== 34) await ok('/api/race/ready', { avatar: 'fox' }, peer.auth);
  }
  await control('start');
  assert.equal((await me(peers[33])).self.prepared, false);
  time += 20000;
  const late = await join(35);
  assert.equal((await me(late)).self.ready, false);
  for (const peer of [peers[33], late]) {
    const ready = await ok('/api/race/ready', { avatar: 'fox' }, peer.auth);
    assert.equal(ready.self.remaining, peer === late ? 360000 : 340000);
  }
  const orders = await Promise.all(
    peers.map(async (peer) => {
      const state = JSON.parse(
        (await DB.prepare('SELECT state FROM racers WHERE id=?').bind(peer.id).first()).state,
      );
      return state.taskOrder.join(',');
    }),
  );
  assert.equal(new Set(orders).size, 35);
  await control('pause');
  const frozen = await Promise.all(peers.map(me));
  time += 45000;
  const still = await Promise.all(peers.map(me));
  for (let i = 0; i < 35; i++) assert.equal(still[i].self.remaining, frozen[i].self.remaining);
  assert.equal(
    (
      await req(
        '/api/race/answer',
        { questionId: frozen[0].self.task.id, answer: 'x' },
        peers[0].auth,
      )
    ).status,
    423,
  );
  await control('resume');

  for (let station = 0; station < 3; station++) {
    for (let question = 0; question < 24; question++) {
      await Promise.all(
        peers.map(async (peer, index) => {
          const before = await me(peer),
            task = before.self.task;
          assert.ok(task);
          const content = tasks.find((t) => t.id === task.id).content;
          const correct = task.mode === 'text' ? content.meaning : content.word;
          const wrong = index < 3 && question % 4 === 0;
          const payload = {
            questionId: task.id,
            answer: wrong
              ? task.mode === 'spelling'
                ? 'z'.repeat(correct.length)
                : task.options.find((o) => o.value !== correct).value
              : correct,
          };
          // Lose the HTTP response after the server commits, then reconnect and replay.
          if (station === 0 && question === 0 && index === 0) {
            const transport = createRequest({
              fetch: async () => {
                const saved = await req('/api/race/answer', payload, peer.auth);
                assert.equal(saved.status, 200);
                throw Error('simulated response loss');
              },
            });
            await assert.rejects(transport('/api/race/answer', payload), /接続/);
            const resumed = await me(peer);
            assert.equal(resumed.self.stationIndex, 1);
            const retry = await ok('/api/race/answer', payload, peer.auth);
            assert.equal(retry.self.score, resumed.self.score);
            assert.equal(retry.self.answered, resumed.self.answered);
          } else await ok('/api/race/answer', payload, peer.auth);
        }),
      );
    }
    const board = await me(peers[0]);
    assert.equal(board.board.length, 35);
    assert.equal(board.race.status, station < 2 ? 'intermission' : 'finished');
    assert.equal(board.stationResults[station].closed, true);
    assert.ok(board.stationResults[station].players.filter((p) => p.rank <= 3).length >= 3);
    for (const peer of peers) {
      const state = await me(peer);
      assert.equal(state.self.answered, (station + 1) * 24);
      assert.equal(state.self.task, null);
    }
    // Same credential re-entry preserves history while admission is closed.
    const remembered = await me(late);
    if (station < 2) await control('closeJoin');
    assert.deepEqual((await me(late)).self.history, remembered.self.history);
    if (station < 2) {
      await control('nextStation');
      assert.equal(
        (await req('/api/teacher/race/state', { raceId, action: 'nextStation' }, teacher)).status,
        409,
      );
      await control('openJoin');
    }
  }
  const finished = await me(late);
  assert.equal(finished.self.answered, 72);
  assert.equal(finished.self.history.length, 72);
  assert.ok(
    finished.board.findIndex((p) => p.id === late.id) <
      finished.board.findIndex((p) => p.id === peers[0].id),
  );
  await ok(
    '/api/teacher/race/delete',
    { raceId, raceTitle: '35人の三駅レース', confirm: true },
    teacher,
  );
  assert.equal((await req('/api/race/me', undefined, late.auth)).status, 404);
  await ok(
    '/api/teacher/race/restore',
    { raceId, raceTitle: '35人の三駅レース', confirm: true },
    teacher,
  );
  assert.equal((await me(late)).self.answered, 72);
  progress = await ok('/api/teacher/progress?class=' + classroom.id, undefined, teacher);
  assert.equal(progress.attempts.length, 35, 'race never alters ordinary practice records');
  console.log(
    'PASS: 35-person ordinary classroom and 3 × 24 mixed race rehearsal, late entry/readiness, frozen clocks, response-loss replay, unique orders, podiums, closed-admission resume, course barriers, accuracy-first ranks and recycle/restore.',
  );
} finally {
  Date.now = originalNow;
}
