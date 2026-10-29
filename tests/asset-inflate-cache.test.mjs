import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createAssetResponder } from '../server/assets.mjs';
const bytes = Buffer.alloc(32000, 7);
const asset = {
  type: 'audio/wav',
  data: gzipSync(bytes).toString('base64'),
  size: bytes.length,
  etag: '"speech"',
  encoding: 'gzip',
};
let inflates = 0,
  release;
const gate = new Promise((resolve) => {
  release = resolve;
});
const respond = createAssetResponder(
  { '/speech.wav': asset },
  {
    inflate: async (packed) => {
      inflates++;
      await gate;
      return new Uint8Array(gunzipSync(packed));
    },
  },
);
const get = (method = 'GET', headers = {}) =>
  respond(new Request('https://test/speech.wav', { method, headers }), '/speech.wav');
assert.equal(get('HEAD').headers.get('content-length'), '32000');
assert.equal(get('GET', { 'if-none-match': '"speech"' }).status, 304);
assert.equal(inflates, 0);
const requests = Array.from({ length: 35 }, () => get().arrayBuffer());
await Promise.resolve();
await Promise.resolve();
assert.equal(inflates, 1, '35 simultaneous learners share one decompression');
release();
const responses = await Promise.all(requests);
for (const result of responses) assert.deepEqual(Buffer.from(result), bytes);
new Uint8Array(responses[0]).fill(0);
assert.deepEqual(Buffer.from(await get().arrayBuffer()), bytes);
assert.equal(inflates, 1, 'Warm requests reuse byte-exact expanded audio');
const reader = get().body.getReader();
const chunk = await reader.read();
chunk.value.fill(0);
await reader.cancel();
assert.deepEqual(
  Buffer.from(await get().arrayBuffer()),
  bytes,
  'Stream consumers cannot mutate retained bytes',
);

let evictions = 0;
const bounded = createAssetResponder(
  { '/a': asset, '/b': asset },
  {
    maxBytes: 32000,
    maxEntryBytes: 32000,
    inflate: async (p) => {
      evictions++;
      return new Uint8Array(gunzipSync(p));
    },
  },
);
for (const path of ['/a', '/a', '/b', '/a'])
  await bounded(new Request('https://test' + path), path).arrayBuffer();
assert.equal(evictions, 3, 'LRU is charged by 32 KB expanded audio, not tiny compressed bytes');
let tries = 0;
const retry = createAssetResponder(
  { '/a': asset },
  {
    inflate: async (p) => {
      if (++tries === 1) throw Error('injected');
      return new Uint8Array(gunzipSync(p));
    },
  },
);
await assert.rejects(retry(new Request('https://test/a'), '/a').arrayBuffer(), /injected/);
assert.deepEqual(
  Buffer.from(await retry(new Request('https://test/a'), '/a').arrayBuffer()),
  bytes,
);
assert.equal(tries, 2, 'Failed work is removed so later requests recover');
let unblocks;
const held = new Promise((resolve) => {
  unblocks = resolve;
});
const many = Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['/' + i, asset]));
let concurrent = 0;
const burst = createAssetResponder(many, {
  inflate: async (p) => {
    concurrent++;
    await held;
    return new Uint8Array(gunzipSync(p));
  },
});
const batch = Object.keys(many).map((path) =>
  burst(new Request('https://test' + path), path).arrayBuffer(),
);
await Promise.resolve();
await Promise.resolve();
assert.equal(concurrent, 8, 'At most eight retained inflations are in flight');
unblocks();
for (const b of await Promise.all(batch)) assert.deepEqual(Buffer.from(b), bytes);
console.log(
  'Packed speech: 35-to-1 coalescing, exact bytes, consumer isolation, expanded-byte LRU, failure recovery and bounded burst work passed.',
);
