import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
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
const auth = (token) => ({ authorization: 'Bearer ' + token });
const room = (await req('/api/teacher/classes', { title: 'Reconnect practice' }, teacher)).body;
const first = (await req('/api/join', { classId: room.id, label: '007' })).body;
const task = first.lesson.queue[0];
await req('/api/student/answer', { questionId: task.id, answer: ['wrong'] }, auth(first.token));
const lesson = (await req('/api/student/me', undefined, auth(first.token))).body.lesson;
await req('/api/teacher/class-state', { classId: room.id, action: 'join-stop' }, teacher);
let duplicate = await req('/api/join', { classId: room.id, label: '7' });
assert.equal(duplicate.status, 409);
assert.equal(duplicate.body.code, 'DUPLICATE');
assert.equal(
  (await req('/api/student/me', undefined, auth(first.token))).status,
  200,
  'A duplicate check must not disconnect anyone',
);
const restored = await req('/api/join', { classId: room.id, label: '7', takeover: true });
assert.equal(restored.status, 200);
assert.equal(restored.body.id, first.id);
assert.notEqual(restored.body.token, first.token);
assert.deepEqual(restored.body.lesson, lesson);
for (const path of ['/api/student/me', '/api/student/status'])
  assert.equal((await req(path, undefined, auth(first.token))).status, 401);
assert.equal(
  (
    await req(
      '/api/student/answer',
      { questionId: lesson.queue[0].id, answer: ['wrong'] },
      auth(first.token),
    )
  ).status,
  401,
);
assert.equal(
  (await req('/api/join', { classId: room.id, label: '8', takeover: true })).status,
  409,
);
assert.equal((await req('/api/join', { classId: room.id, label: '8' })).status, 409);
for (const action of ['pause', 'end']) {
  await req('/api/teacher/class-state', { classId: room.id, action }, teacher);
  const again = await req('/api/join', { classId: room.id, label: '7', takeover: true });
  assert.equal(again.status, 200);
  assert.deepEqual(again.body.lesson, lesson);
}
assert.equal(
  (await env.DB.prepare('SELECT COUNT(*) n FROM students WHERE class_id=?').bind(room.id).first())
    .n,
  1,
);

const raceId = (await req('/api/teacher/race/create', { title: 'Reconnect race' }, teacher)).body
  .raceId;
const racer = (await req('/api/race/join', { raceId, label: '007', waitForReady: true })).body;
await req('/api/race/ready', { avatar: 'fox' }, auth(racer.token));
await req('/api/teacher/race/state', { raceId, action: 'start' }, teacher);
await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?')
  .bind(Date.now() - 5000, raceId)
  .run();
const raceTask = (await req('/api/race/me', undefined, auth(racer.token))).body.self.task;
await req(
  '/api/race/answer',
  {
    questionId: raceTask.id,
    answer: raceTask.mode === 'spelling' ? 'z'.repeat(raceTask.spoken.length) : 'wrong',
  },
  auth(racer.token),
);
await req('/api/teacher/race/state', { raceId, action: 'closeJoin' }, teacher);
const before = await env.DB.prepare('SELECT * FROM racers WHERE id=?').bind(racer.self.id).first();
const clockBefore = await env.DB.prepare(
  'SELECT started_at,remaining_ms,elapsed_ms FROM races WHERE id=?',
)
  .bind(raceId)
  .first();
duplicate = await req('/api/race/join', { raceId, label: '7' });
assert.equal(duplicate.status, 409);
assert.equal(duplicate.body.code, 'DUPLICATE');
const reconnect = await req('/api/race/join', { raceId, label: '7', takeover: true });
assert.equal(reconnect.status, 200);
assert.equal(reconnect.body.self.id, racer.self.id);
assert.notEqual(reconnect.body.token, racer.token);
const after = await env.DB.prepare('SELECT * FROM racers WHERE id=?').bind(racer.self.id).first();
assert.equal(
  after.state,
  before.state,
  'Score, avatar, readiness, question order, items, streak and personal time origin survive',
);
assert.equal(after.revision, before.revision + 1);
assert.deepEqual(
  await env.DB.prepare('SELECT started_at,remaining_ms,elapsed_ms FROM races WHERE id=?')
    .bind(raceId)
    .first(),
  clockBefore,
  'Reconnection must not reset or extend a course clock',
);
for (const path of ['/api/race/me', '/api/race/answer', '/api/race/item', '/api/race/ready'])
  assert.equal(
    (await req(path, path.endsWith('/me') ? undefined : {}, auth(racer.token))).status,
    401,
  );
assert.equal((await req('/api/race/join', { raceId, label: '8', takeover: true })).status, 409);
for (const action of ['pause', 'end']) {
  await req('/api/teacher/race/state', { raceId, action, confirm: true }, teacher);
  const again = await req('/api/race/join', { raceId, label: '7', takeover: true });
  assert.equal(again.status, 200);
  assert.equal(again.body.self.id, racer.self.id);
}
assert.equal(
  (await env.DB.prepare('SELECT COUNT(*) n FROM racers WHERE race_id=?').bind(raceId).first()).n,
  1,
);
const simultaneous = await Promise.all(
  [1, 2].map(() => req('/api/race/join', { raceId, label: '7', takeover: true })),
);
assert.equal(
  simultaneous.filter((r) => r.status === 200).length,
  1,
  'One compare-and-swap winner for concurrent claims',
);
assert.equal(
  (
    await req(
      '/api/race/me',
      undefined,
      auth(simultaneous.find((r) => r.status === 200).body.token),
    )
  ).status,
  200,
);
// Hold a request after authentication but before its mutation. Token checks at
// the write boundary must still reject it after another device takes over.
async function holdAuthenticated(pattern, path, payload, token, replace) {
  const original = env.DB.prepare;
  let reached,
    release,
    held = false;
  const entered = new Promise((r) => {
    reached = r;
  });
  const gate = new Promise((r) => {
    release = r;
  });
  env.DB.prepare = function (sql) {
    const statement = original.call(this, sql);
    if (!pattern.test(sql)) return statement;
    const first = statement.first;
    statement.first = async function () {
      const row = await first.call(this);
      if (row && !held) {
        held = true;
        reached();
        await gate;
      }
      return row;
    };
    return statement;
  };
  const pending = req(path, payload, auth(token));
  try {
    await entered;
    await replace();
    release();
    const response = await pending;
    assert.notEqual(
      response.status,
      200,
      'An old, already-authenticated writer must not survive takeover',
    );
  } finally {
    release();
    env.DB.prepare = original;
  }
}
const guardedRoom = (await req('/api/teacher/classes', { title: 'In-flight practice' }, teacher))
  .body;
const guarded = (await req('/api/join', { classId: guardedRoom.id, label: '9' })).body;
const guardedLesson = JSON.stringify(guarded.lesson);
await holdAuthenticated(
  /SELECT s\.\* FROM students s JOIN classrooms/,
  '/api/student/start',
  { reset: true },
  guarded.token,
  async () =>
    assert.equal(
      (await req('/api/join', { classId: guardedRoom.id, label: '9', takeover: true })).status,
      200,
    ),
);
assert.equal(
  (await env.DB.prepare('SELECT lesson FROM students WHERE id=?').bind(guarded.id).first()).lesson,
  guardedLesson,
);
const guardedRace = (await req('/api/teacher/race/create', { title: 'In-flight race' }, teacher))
  .body.raceId;
const guardedRacer = (
  await req('/api/race/join', { raceId: guardedRace, label: '9', waitForReady: true })
).body;
await holdAuthenticated(
  /SELECT \* FROM racers WHERE token_hash=/,
  '/api/race/ready',
  { avatar: 'fox' },
  guardedRacer.token,
  async () =>
    assert.equal(
      (await req('/api/race/join', { raceId: guardedRace, label: '9', takeover: true })).status,
      200,
    ),
);
assert.equal(
  JSON.parse(
    (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(guardedRacer.self.id).first())
      .state,
  ).prepared,
  false,
);
console.log(
  'Explicit takeover in both modes preserves records/clocks, invalidates old tokens, works after admissions close, and does not duplicate students; concurrent claims have one winner.',
);
