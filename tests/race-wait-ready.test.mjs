import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
const base = database(),
  env = { DB: base, TEACHER_PASSWORD: 'test-password' };
async function request(path, data, headers = {}) {
  const response = await worker.fetch(
    new Request('https://test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json(), response };
}
const login = await request('/api/teacher/login', { password: 'test-password' }),
  teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const config = (await request('/api/teacher/config', undefined, teacher)).body;
config.config.race.countdown = 0;
await request('/api/teacher/config', { config: config.config, revision: config.revision }, teacher);
const race = (
  await request(
    '/api/teacher/race/create',
    { title: 'Explicit preparation', endless: true },
    teacher,
  )
).body.raceId;
const joined = (await request('/api/race/join', { raceId: race, label: '1', waitForReady: true }))
  .body;
const auth = { authorization: 'Bearer ' + joined.token };
assert.equal(
  joined.self.ready,
  false,
  'Entering the modern lobby does not start the personal clock',
);
await request('/api/teacher/race/state', { raceId: race, action: 'start' }, teacher);
await base
  .prepare('UPDATE races SET started_at=? WHERE id=?')
  .bind(Date.now() - 60000, race)
  .run();
let current = (await request('/api/race/me', undefined, auth)).body;
assert.equal(current.self.ready, false);
assert.equal(current.self.remaining, 360000);
assert.equal(current.self.task, null);
const avatar = await request('/api/race/avatar', { avatar: 'fox' }, auth);
assert.equal(avatar.status, 200);
let row = await base.prepare('SELECT revision FROM racers WHERE id=?').bind(joined.self.id).first();
assert.ok(
  avatar.body.self.syncKey.includes(':' + row.revision + ':'),
  'Avatar acknowledgement advertises the saved revision',
);
const ready = await request('/api/race/ready', { avatar: 'fox' }, auth);
assert.equal(ready.status, 200);
assert.equal(ready.body.self.ready, true);
assert.ok(ready.body.self.remaining > 359900);
assert.ok(ready.body.self.task);
row = await base.prepare('SELECT revision FROM racers WHERE id=?').bind(joined.self.id).first();
assert.ok(
  ready.body.self.syncKey.includes(':' + row.revision + ':'),
  'Ready acknowledgement advertises the saved revision',
);
const next = (await request('/api/teacher/race/create', { title: 'Change mind' }, teacher)).body
  .raceId;
const again = (await request('/api/race/join', { raceId: next, label: '1', waitForReady: true }))
    .body,
  second = { authorization: 'Bearer ' + again.token };
await request('/api/race/ready', { avatar: 'cat' }, second);
const changed = (await request('/api/race/avatar', { avatar: 'fox' }, second)).body;
assert.equal(changed.self.prepared, false);
assert.equal(changed.self.ready, false, 'Changing avatar requires preparation again');
console.log(
  'Modern readiness: unprepared lobby students retain all personal time, avatar/ready revisions and re-preparation passed.',
);
