import assert from 'node:assert/strict';
import { createRequest } from '../public/shared/request.js';
let response,
  connections = [];
const request = createRequest({
  fetch: async () => response,
  onConnection: (ok) => connections.push(ok),
  onRequest: () => null,
});
for (const status of [401, 404, 409, 500]) {
  response = new Response('<h1>Server error</h1>', { status });
  await assert.rejects(
    request('/api/test'),
    (e) => e.status === status,
    'HTTP status survives a non-JSON error body',
  );
}
response = new Response('null', { status: 401 });
await assert.rejects(request('/api/test'), (e) => e.status === 401);
for (const body of ['null', '[]', '42', 'not JSON']) {
  response = new Response(body, { status: 200 });
  await assert.rejects(request('/api/test'), 'Successful API responses must contain an object');
}
response = new Response(JSON.stringify({ error: 'expired', code: 'SESSION_EXPIRED' }), {
  status: 401,
});
await assert.rejects(
  request('/api/test'),
  (e) => e.status === 401 && e.code === 'SESSION_EXPIRED' && e.message === 'expired',
);
response = new Response('{"ok":true}');
assert.deepEqual(await request('/api/test'), { ok: true });
assert.equal(connections.at(-1), true);
console.log(
  'Request errors: HTML/null HTTP failures preserve status, malformed successful payloads fail, valid errors and recovery passed.',
);
