import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { isCourseClear } from '../public/race/lifecycle.js';
const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
async function api(path, data, headers = {}) {
  const r = await worker.fetch(
    new Request('https://test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  assert.equal(r.status, 200);
  return { body: await r.json(), r };
}
const login = await api('/api/teacher/login', { password: 'test-password' }),
  teacher = { cookie: login.r.headers.get('set-cookie').split(';')[0] };
for (const status of ['running', 'paused']) {
  const id = (
    await api('/api/teacher/race/create', { title: 'Old ' + status, endless: true }, teacher)
  ).body.raceId;
  await api('/api/race/join', { raceId: id, label: '1' });
  await env.DB.prepare(
    'UPDATE races SET station=2,status=?,remaining_ms=300000,elapsed_ms=40000,started_at=? WHERE id=?',
  )
    .bind(status, Date.now() - 10000, id)
    .run();
  await api('/api/teacher/race/create', { title: 'Replacement' }, teacher);
  const old = (await api('/api/teacher/race/board?race=' + id, undefined, teacher)).body;
  assert.equal(old.race.status, 'finished');
  assert.ok(old.race.remaining > 280000);
  assert.equal(
    isCourseClear(old),
    false,
    'Replacing an unfinished final course cannot trigger a victory ceremony',
  );
  const row = await env.DB.prepare('SELECT elapsed_ms FROM races WHERE id=?').bind(id).first();
  assert.ok(status === 'paused' ? row.elapsed_ms === 40000 : row.elapsed_ms >= 50000);
  assert.equal(old.players.length, 1, 'The old race and all student records stay available');
}
console.log(
  'Early replacement: preserved remaining/elapsed clocks, no false final-course clear, paused/running compatibility and retained records passed.',
);
