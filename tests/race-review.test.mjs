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
  return { status: response.status, body: await response.clone().json(), response };
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const config = (await req('/api/teacher/config', undefined, teacher)).body;
Object.assign(config.config.race, { questions: 6, modes: ['text'], items: [], countdown: 0 });
await req('/api/teacher/config', { config: config.config, revision: config.revision }, teacher);
const raceId = (await req('/api/teacher/race/create', { title: 'Voluntary review' }, teacher)).body
  .raceId;
const joined = (await req('/api/race/join', { raceId, label: '35' })).body;
const auth = { authorization: 'Bearer ' + joined.token };
await req('/api/race/ready', { avatar: 'fox' }, auth);
await req('/api/teacher/race/state', { raceId, action: 'start' }, teacher);
let current = (await req('/api/race/me', undefined, auth)).body;
assert.deepEqual(current.self.reviewCards, []);
const tasks = JSON.parse(
  (await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks,
);
for (let i = 0; i < 6; i++) {
  const task = current.self.task;
  const answer = task.options.find(
    (o) => o.value !== tasks.find((t) => t.id === task.id).content.meaning,
  ).value;
  current = (await req('/api/race/answer', { questionId: task.id, answer }, auth)).body;
}
assert.equal(current.race.status, 'intermission');
assert.ok(current.self.reviewCards.length > 0);
assert.ok(current.self.reviewCards.every((w) => w.word && w.meaning));
const before = (
  await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(current.self.id).first()
).state;
await req('/api/race/me', undefined, auth);
assert.equal(
  (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(current.self.id).first()).state,
  before,
);
assert.equal((await req('/api/race/me')).status, 401);
await req('/api/teacher/race/state', { raceId, action: 'nextStation' }, teacher);
current = (await req('/api/race/me', undefined, auth)).body;
assert.deepEqual(current.self.reviewCards, []);
assert.equal(current.self.score, 0);
console.log(
  'PASS: personal wrong-word review only after course completion, no score/state writes, no unauthenticated exposure and clean next-course transition.',
);
