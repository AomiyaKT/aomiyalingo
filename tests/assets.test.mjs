import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createAssetResponder, decodeAsset } from '../server/assets.mjs';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';

function asset(value, type = 'image/png') {
  const bytes = Buffer.from(value);
  return {
    data: bytes.toString('base64'),
    size: bytes.length,
    etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"',
    type,
  };
}
const binary = Uint8Array.from({ length: 1024 }, (_, i) => i % 256);
assert.deepEqual(decodeAsset(Buffer.from(binary).toString('base64')), binary);
let decodes = 0;
const assets = {
  '/a.png': asset([0, 1, 2, 255]),
  '/b.png': asset([3, 4, 5, 254]),
  '/c.png': asset([6, 7, 8, 253]),
  '/large.wav': asset(new Uint8Array(12), 'audio/wav'),
  '/index.html': asset('<h1>Home</h1>', 'text/html; charset=utf-8'),
};
const respond = createAssetResponder(assets, {
  maxBytes: 8,
  maxEntryBytes: 4,
  decode(data) {
    decodes++;
    return decodeAsset(data);
  },
});
const request = (key, method = 'GET', headers = {}) =>
  respond(new Request('https://classroom.test' + key, { method, headers }), key);

for (const validator of [
  assets['/a.png'].etag,
  'W/' + assets['/a.png'].etag,
  '*',
  '"other", ' + assets['/a.png'].etag,
]) {
  const response = request('/a.png', 'GET', { 'if-none-match': validator });
  assert.equal(response.status, 304);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('etag'), assets['/a.png'].etag);
  assert.equal(response.headers.get('content-length'), null);
}
const head = request('/a.png', 'HEAD');
assert.equal(head.headers.get('content-length'), '4');
assert.equal(await head.text(), '');
assert.equal(decodes, 0, 'HEAD and matching validators allocate no decoded payload');
const first = new Uint8Array(await request('/a.png').arrayBuffer());
assert.deepEqual(first, new Uint8Array([0, 1, 2, 255]));
first.fill(42);
assert.deepEqual(
  new Uint8Array(await request('/a.png').arrayBuffer()),
  new Uint8Array([0, 1, 2, 255]),
  'response consumers cannot mutate cached bytes',
);
assert.equal(decodes, 1);
await request('/b.png').arrayBuffer();
await request('/a.png').arrayBuffer();
await request('/c.png').arrayBuffer();
await request('/a.png').arrayBuffer();
assert.equal(decodes, 3, 'recently used entries survive eviction');
await request('/b.png').arrayBuffer();
assert.equal(decodes, 4, 'oldest entry is evicted within the byte limit');
await request('/large.wav').arrayBuffer();
await request('/large.wav').arrayBuffer();
assert.equal(decodes, 6, 'oversized audio is not retained');
await request('/a.png').arrayBuffer();
assert.equal(decodes, 6, 'large audio does not displace cached pictures');
assert.equal(request('/toString').status, 404);
assert.equal(request('/missing.png').status, 404);
assert.equal(request('/missing.png', 'HEAD').status, 404);
const html = request('/index.html', 'GET', { 'if-none-match': '*' });
assert.equal(html.status, 200);
assert.equal(html.headers.get('cache-control'), 'no-store');
assert.equal(html.headers.get('etag'), null);
assert.equal(await html.text(), '<h1>Home</h1>');
assert.equal(request('/a.png', 'GET', { 'if-none-match': '"stale"' }).status, 200);
let uncachedDecodes = 0;
const uncached = createAssetResponder(assets, {
  maxBytes: 0,
  decode(data) {
    uncachedDecodes++;
    return decodeAsset(data);
  },
});
for (let i = 0; i < 2; i++)
  await uncached(new Request('https://classroom.test/a.png'), '/a.png').arrayBuffer();
assert.equal(uncachedDecodes, 2);

// Verify metadata describes the final bundled CSS/JS, not their unbundled source.
const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
for (const path of [
  '/curriculum.js',
  '/ui/student.css',
  '/assets/vocabulary/g6-unit2/01_shrine.png',
  '/assets/words/shrine.wav',
]) {
  const fetch = (method = 'GET', headers = {}) =>
    worker.fetch(new Request('https://classroom.test' + path, { method, headers }), env);
  const response = await fetch();
  const bytes = Buffer.from(await response.arrayBuffer());
  const etag = '"' + createHash('sha256').update(bytes).digest('hex') + '"';
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('etag'), etag);
  assert.equal(Number(response.headers.get('content-length')), bytes.length);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch('GET', { 'if-none-match': etag })).status, 304);
  const head = await fetch('HEAD');
  assert.equal(Number(head.headers.get('content-length')), bytes.length);
  assert.equal(await head.text(), '');
  assert.equal((await fetch('POST')).status, 404);
  if (path.startsWith('/assets/')) assert.deepEqual(bytes, fs.readFileSync('public' + path));
}
const home = await worker.fetch(new Request('https://classroom.test/'), env);
assert.equal(home.headers.get('cache-control'), 'no-store');
assert.equal(home.headers.get('etag'), null);
const health = await worker.fetch(
  new Request('https://classroom.test/api/health', { headers: { 'if-none-match': '*' } }),
  env,
);
assert.equal(health.status, 200);
assert.equal(health.headers.get('cache-control'), 'no-store');
assert.equal(health.headers.get('etag'), null);
console.log(
  'Assets: exact binary/bundled metadata, decode-free HEAD/304, validator lists, bounded LRU eviction, oversized bypass, response isolation and uncached APIs passed.',
);
