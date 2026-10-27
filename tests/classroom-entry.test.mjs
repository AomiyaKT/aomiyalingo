import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { lessonLink, renderClassroomLink } from '../public/shared/classroom-links.js';

const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
async function req(path, data, headers = {}) {
  const response = await worker.fetch(new Request('https://school.test' + path, {
    method: data ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
  }), env);
  return { response, body: await response.json() };
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
assert.equal((await req('/api/teacher/session')).response.status, 401);
assert.deepEqual((await req('/api/teacher/session', undefined, teacher)).body, { ok: true });
const oldClass = (await req('/api/teacher/classes', { title: 'Earlier class' }, teacher)).body;
const newClass = (await req('/api/teacher/classes', { title: 'New class' }, teacher)).body;
assert.equal((await req('/api/class/current')).body.classroom.id, newClass.id);
assert.equal((await req('/api/class/current?class=' + oldClass.id)).body.classroom.id, oldClass.id);
assert.equal((await req('/api/class/current?class=missing')).body.classroom, null);
await env.DB.prepare('UPDATE classrooms SET deleted_at=1 WHERE id=?').bind(oldClass.id).run();
assert.equal((await req('/api/class/current?class=' + oldClass.id)).body.classroom, null);

const oldRace = (await req('/api/teacher/race/create', { title: 'Earlier race' }, teacher)).body;
await req('/api/teacher/race/state', { raceId: oldRace.raceId, action: 'end', confirm: true }, teacher);
const newRace = (await req('/api/teacher/race/create', { title: 'New race' }, teacher)).body;
assert.equal((await req('/api/race/current')).body.race.id, newRace.raceId);
assert.equal((await req('/api/race/current?race=' + oldRace.raceId)).body.race.id, oldRace.raceId);
assert.equal((await req('/api/race/current?race=missing')).body.race, null);
await env.DB.prepare('UPDATE races SET deleted_at=1 WHERE id=?').bind(oldRace.raceId).run();
assert.equal((await req('/api/race/current?race=' + oldRace.raceId)).body.race, null);

for (const path of ['/', '/teacher']) {
  const response = await worker.fetch(new Request('https://school.test' + path), env);
  const html = await response.text();
  assert.ok(html.includes('id="teacher-access"'));
  assert.ok(!html.includes('id="student-entry"'));
}
const home = await (await worker.fetch(new Request('https://school.test/'), env)).text();
assert.ok(home.includes('id="mode-chooser" class="mode-chooser" hidden'));
assert.ok(!home.includes('href="/teacher-editor"'));
assert.ok(!home.includes('id="create-class"'));
for (const path of ['/teacher', '/race-teacher']) {
  const html = await (await worker.fetch(new Request('https://school.test' + path), env)).text();
  assert.ok(html.includes('data-mode-settings'));
  assert.ok(!html.includes('class="teacher-modes"'));
}
for (const path of ['/student?class=' + newClass.id, '/?student=1']) {
  const html = await (await worker.fetch(new Request('https://school.test' + path), env)).text();
  assert.ok(html.includes('id="join-dialog"'));
  assert.ok(!html.includes('teacher-music.js'));
}
assert.equal(lessonLink('https://school.test', 'practice', 'a b'), 'https://school.test/student?class=a+b');
const image = { dataset: {}, removeAttribute(key) { delete this[key]; } };
const link = { removeAttribute(key) { delete this[key]; } };
renderClassroomLink(image, link, 'https://school.test', 'race', newRace.raceId);
assert.equal(new URL(link.href).searchParams.get('race'), newRace.raceId);
assert.ok(decodeURIComponent(image.src).includes('<svg'));
renderClassroomLink(image, link, 'https://school.test', 'race', null);
assert.ok(image.hidden && link.hidden);
assert.equal(image.src, undefined);
await req('/api/teacher/logout', {}, teacher);
assert.equal((await req('/api/teacher/session', undefined, teacher)).response.status, 401);
console.log('Authenticated two-mode home, in-mode settings, revoked sessions and classroom-specific QR entry passed.');
