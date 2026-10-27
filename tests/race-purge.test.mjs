import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';

const env = { DB: database(), TEACHER_PASSWORD: 'purge-test' };
await env.DB.prepare('PRAGMA foreign_keys=ON').run();
async function req(path, data, headers = {}) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { status: response.status, response, body: await response.clone().json() };
}
const login = await req('/api/teacher/login', { password: 'purge-test' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const room = (await req('/api/teacher/classes', { title: 'Ordinary retained' }, teacher)).body;
const ordinary = (await req('/api/join', { classId: room.id, label: '1' })).body;
async function fixture(title, deleted = false, end = true) {
  const id = (await req('/api/teacher/race/create', { title }, teacher)).body.raceId;
  const joined = (await req('/api/race/join', { raceId: id, label: '13' })).body;
  if (end)
    await req('/api/teacher/race/state', { raceId: id, action: 'end', confirm: true }, teacher);
  if (deleted)
    await req('/api/teacher/race/delete', { raceId: id, raceTitle: title, confirm: true }, teacher);
  return { id, title, joined };
}
const a = await fixture('Single target', true);
const b = await fixture('Restorable target', true);
const late = await fixture('Later trash');
const retained = await fixture('Retained results');
const live = await fixture('Live race', false, false);
const current = async () => (await req('/api/teacher/race/current', undefined, teacher)).body;
const row = async (id) => env.DB.prepare('SELECT * FROM races WHERE id=?').bind(id).first();
const racers = async (id) =>
  (await env.DB.prepare('SELECT * FROM racers WHERE race_id=?').bind(id).all()).results;
const action = (r) => ({
  scope: 'one',
  raceId: r.id,
  raceTitle: r.title,
  revision: r.revision,
  deletedAt: r.deleted_at,
  confirm: true,
});
let list = await current();
const one = action(list.trash.find((r) => r.id === a.id));
assert.equal((await req('/api/teacher/race/purge', one)).status, 401);
assert.equal(
  (await req('/api/teacher/race/purge', one, { authorization: 'Bearer ' + a.joined.token })).status,
  401,
);
assert.equal(
  (await req('/api/teacher/race/purge', one, { ...teacher, origin: 'https://other.test' })).status,
  403,
);
for (const data of [
  { ...one, confirm: false },
  { ...one, scope: 'invalid' },
  { ...one, raceTitle: 'Another race' },
  { ...one, deletedAt: 0 },
])
  assert.equal((await req('/api/teacher/race/purge', data, teacher)).status, 400);
assert.equal(
  (await req('/api/teacher/race/purge', { ...one, revision: one.revision + 1 }, teacher)).status,
  409,
);
for (const target of [live, retained]) {
  const r = await row(target.id);
  assert.equal(
    (await req('/api/teacher/race/purge', { ...action(r), deletedAt: 1 }, teacher)).status,
    409,
  );
}
const ordinaryBefore = (
  await req('/api/student/me', undefined, { authorization: 'Bearer ' + ordinary.token })
).body;
const liveBefore = await row(live.id);
const retainedBefore = await row(retained.id);
const staleVersion = list.trashVersion;
const purged = await req('/api/teacher/race/purge', one, teacher);
assert.deepEqual(purged.body, { ok: true, removed: 1 });
assert.equal(await row(a.id), null);
assert.deepEqual(await racers(a.id), []);
assert.equal(
  (await req('/api/race/me', undefined, { authorization: 'Bearer ' + a.joined.token })).status,
  401,
);
assert.equal(
  (
    await req(
      '/api/teacher/race/restore',
      { raceId: a.id, raceTitle: a.title, confirm: true },
      teacher,
    )
  ).status,
  404,
);
assert.equal(
  (
    await req(
      '/api/teacher/race/purge',
      { scope: 'all', confirm: true, trashVersion: staleVersion },
      teacher,
    )
  ).status,
  409,
);

list = await current();
const staleSingle = action(list.trash.find((r) => r.id === b.id));
await req(
  '/api/teacher/race/restore',
  { raceId: b.id, raceTitle: b.title, confirm: true },
  teacher,
);
await req('/api/teacher/race/delete', { raceId: b.id, raceTitle: b.title, confirm: true }, teacher);
assert.equal(
  (await req('/api/teacher/race/purge', staleSingle, teacher)).status,
  409,
  'restore followed by delete invalidates an old single-race confirmation',
);
list = await current();
await req(
  '/api/teacher/race/delete',
  { raceId: late.id, raceTitle: late.title, confirm: true },
  teacher,
);
assert.equal(
  (
    await req(
      '/api/teacher/race/purge',
      { scope: 'all', confirm: true, trashVersion: list.trashVersion },
      teacher,
    )
  ).status,
  409,
  'items added after confirmation require a new confirmation',
);

const prepare = env.DB.prepare;
const beforeB = await racers(b.id),
  beforeLate = await racers(late.id);
list = await current();
env.DB.prepare = (sql) => {
  const statement = prepare(sql);
  if (sql.includes('DELETE FROM races WHERE'))
    statement.run = async () => {
      throw Error('injected purge failure');
    };
  return statement;
};
assert.equal(
  (
    await req(
      '/api/teacher/race/purge',
      { scope: 'all', confirm: true, trashVersion: list.trashVersion },
      teacher,
    )
  ).status,
  503,
);
env.DB.prepare = prepare;
assert.deepEqual(await racers(b.id), beforeB, 'parent failure rolls back all child deletions');
assert.deepEqual(await racers(late.id), beforeLate);
assert.ok((await row(b.id)).deleted_at > 0);

const batch = env.DB.batch;
env.DB.batch = async (statements) => {
  await prepare('UPDATE races SET deleted_at=0,revision=revision+1 WHERE id=?').bind(b.id).run();
  return batch(statements);
};
assert.equal(
  (
    await req(
      '/api/teacher/race/purge',
      { scope: 'all', confirm: true, trashVersion: list.trashVersion },
      teacher,
    )
  ).status,
  409,
);
env.DB.batch = batch;
assert.equal((await row(b.id)).deleted_at, 0);
assert.ok(await row(late.id), 'one restored target prevents partial deletion of the other targets');
assert.deepEqual(await racers(b.id), beforeB);
assert.deepEqual(await racers(late.id), beforeLate);

list = await current();
env.DB.batch = async (statements) => {
  await prepare('UPDATE races SET deleted_at=1,revision=revision+1 WHERE id=?')
    .bind(retained.id)
    .run();
  return batch(statements);
};
const cleared = await req(
  '/api/teacher/race/purge',
  { scope: 'all', confirm: true, trashVersion: list.trashVersion },
  teacher,
);
env.DB.batch = batch;
assert.deepEqual(cleared.body, { ok: true, removed: 1 });
assert.equal(await row(late.id), null);
assert.deepEqual(await racers(late.id), []);
assert.ok(await row(retained.id), 'a newly trashed record outside the confirmed snapshot survives');
await req(
  '/api/teacher/race/restore',
  { raceId: retained.id, raceTitle: retained.title, confirm: true },
  teacher,
);
const retainedAfter = await row(retained.id);
assert.equal(retainedAfter.status, retainedBefore.status);
assert.equal(retainedAfter.tasks, retainedBefore.tasks);
assert.deepEqual(await row(live.id), liveBefore);
assert.deepEqual(
  (await req('/api/student/me', undefined, { authorization: 'Bearer ' + ordinary.token })).body,
  ordinaryBefore,
);

// Bulk requests stay small even when the trash exceeds the HTTP body's 12KB limit.
for (let i = 0; i < 150; i++)
  await prepare(
    "INSERT INTO races (id,title,status,tasks,remaining_ms,created,deleted_at) VALUES (?,?,'finished','[]',0,1,1)",
  )
    .bind('large-' + i, 'Archived ' + i)
    .run();
list = await current();
assert.equal(list.trash.length, 150);
const payload = { scope: 'all', confirm: true, trashVersion: list.trashVersion };
assert.ok(JSON.stringify(payload).length < 200);
assert.deepEqual((await req('/api/teacher/race/purge', payload, teacher)).body, {
  ok: true,
  removed: 150,
});
list = await current();
assert.equal(list.trash.length, 0);
assert.deepEqual(
  (await req('/api/teacher/race/purge', { ...payload, trashVersion: list.trashVersion }, teacher))
    .body,
  { ok: true, removed: 0 },
);
assert.deepEqual(await row(live.id), liveBefore);
console.log(
  'PASS: authenticated single/bulk race purge, explicit confirmation, active/result protection, permanent child removal, stale snapshots, concurrent restore/new trash isolation, atomic rollback, foreign keys and constant-size bulk requests.',
);
