import assert from 'node:assert/strict';
import { createReleaseReader } from '../server/updates.mjs';
import { APP_VERSION } from '../public/shared/release.js';
import { UPDATE_REPOSITORY } from '../public/shared/update-policy.js';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';

const stable = {
  tag_name: 'v77',
  draft: false,
  prerelease: false,
  name: 'Release 77',
  body: 'English / 日本語',
  html_url: 'https://untrusted.invalid',
  published_at: '2026-10-29T00:00:00Z',
};
const json = (value) => new Response(JSON.stringify(value));
let clock = 1000,
  calls = 0;
const reader = createReleaseReader({
  now: () => clock,
  fetch: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/AomiyaKT/aomiyalingo/releases/latest');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.cookie, undefined);
    assert.equal(options.headers.authorization, undefined);
    return json(stable);
  },
});
const results = await Promise.all(Array.from({ length: 15 }, () => reader()));
assert.equal(calls, 1);
assert.equal(results[0].latest.url, UPDATE_REPOSITORY + '/releases/tag/v77');
assert.equal(results[0].latest.version, '77');
assert.equal(results[0].checkedAt, 1000);
clock += 299999;
await reader();
assert.equal(calls, 1);
clock += 2;
await reader();
assert.equal(calls, 2);

const paths = [];
const legacy = createReleaseReader({
  fetch: async (url) => {
    paths.push(url);
    return paths.length === 1
      ? new Response('', { status: 404 })
      : new Response("export const APP_VERSION = '75';\n");
  },
});
assert.equal((await legacy()).latest.version, '75');
assert.equal(
  paths[1],
  'https://raw.githubusercontent.com/AomiyaKT/aomiyalingo/main/public/shared/release.js',
);
assert.equal((await legacy()).latest.source, 'repository');
for (const bad of [
  { ...stable, draft: true },
  { ...stable, prerelease: true },
  { ...stable, tag_name: 'v77<script>' },
]) {
  assert.equal((await createReleaseReader({ fetch: async () => json(bad) })()).available, false);
}
assert.equal(
  (await createReleaseReader({ fetch: async () => new Response('not-json') })()).available,
  false,
);
assert.equal(
  (await createReleaseReader({ fetch: async () => new Response('x'.repeat(140000)) })()).available,
  false,
);
const largeHeader = createReleaseReader({
  fetch: async () => new Response('{}', { headers: { 'content-length': '999999' } }),
});
assert.equal((await largeHeader()).available, false);
let fail = true,
  failures = 0;
const recovering = createReleaseReader({
  now: () => clock,
  fetch: async () => {
    failures++;
    if (fail) throw Error('offline');
    return json(stable);
  },
});
assert.equal((await recovering()).available, false);
fail = false;
assert.equal((await recovering()).latest, null);
assert.equal(failures, 1);
clock += 15001;
assert.equal((await recovering()).available, true);
assert.equal(failures, 2);
const timed = createReleaseReader({
  timeout: 10,
  fetch: async (url, { signal }) =>
    new Promise((resolve, reject) =>
      signal.addEventListener('abort', () => reject(Error('timeout')), { once: true }),
    ),
});
assert.equal((await timed()).available, false);

// Exercise the delivered Worker: live authentication, class guards, and read-only update requests.
const originalFetch = globalThis.fetch;
let outbound = 0;
globalThis.fetch = async (url, options) => {
  outbound++;
  assert.ok(url.startsWith('https://api.github.com/repos/AomiyaKT/aomiyalingo/'));
  assert.equal(options.headers.cookie, undefined);
  return json(stable);
};
try {
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
    return { response, status: response.status, body: await response.json() };
  }
  assert.equal((await req('/api/teacher/updates')).status, 401);
  assert.equal((await req('/api/teacher/updates/ready?version=' + APP_VERSION)).status, 401);
  assert.equal(outbound, 0);
  const login = await req('/api/teacher/login', { password: 'test-password' });
  const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
  const checked = await req('/api/teacher/updates', undefined, teacher);
  assert.equal(checked.status, 200);
  assert.equal(checked.body.serverVersion, APP_VERSION);
  assert.equal(checked.body.latest.version, '77');
  assert.equal(checked.body.active, false);
  assert.match(checked.response.headers.get('cache-control'), /no-store/);
  assert.equal((await req('/api/teacher/updates', {}, teacher)).status, 405);
  assert.equal(
    (await req('/api/teacher/updates/ready?version=old', undefined, teacher)).status,
    409,
  );
  const lesson = (await req('/api/teacher/classes', { title: 'Update guard' }, teacher)).body;
  const activeBefore = JSON.stringify(await env.DB.prepare('SELECT * FROM classrooms').all());
  assert.equal((await req('/api/teacher/updates', undefined, teacher)).body.active, true);
  assert.equal(
    (await req('/api/teacher/updates/ready?version=' + APP_VERSION, undefined, teacher)).status,
    409,
  );
  assert.equal(
    JSON.stringify(await env.DB.prepare('SELECT * FROM classrooms').all()),
    activeBefore,
  );
  await req('/api/teacher/class-state', { classId: lesson.id, action: 'pause' }, teacher);
  assert.equal(
    (await req('/api/teacher/updates/ready?version=' + APP_VERSION, undefined, teacher)).status,
    409,
  );
  await req('/api/teacher/class-state', { classId: lesson.id, action: 'end' }, teacher);
  const race = (await req('/api/teacher/race/create', { title: 'Update lobby guard' }, teacher))
    .body;
  assert.equal((await req('/api/teacher/updates', undefined, teacher)).body.active, true);
  assert.equal(
    (await req('/api/teacher/updates/ready?version=' + APP_VERSION, undefined, teacher)).status,
    409,
  );
  await req(
    '/api/teacher/race/state',
    { raceId: race.raceId, action: 'end', confirm: true },
    teacher,
  );
  assert.equal(
    (await req('/api/teacher/updates/ready?version=' + APP_VERSION, undefined, teacher)).status,
    200,
  );
  assert.equal(outbound, 1, 'Repeated authenticated checks share only public release metadata');
  await req('/api/teacher/logout', {}, teacher);
  assert.equal((await req('/api/teacher/updates', undefined, teacher)).status, 401);
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  'Server updates: fixed public GitHub destinations, no forwarded credentials, bounded/timeout/coalesced release reads, stable-only tags, legacy fallback, honest failures, live teacher auth and read-only class/race/version guards passed.',
);
