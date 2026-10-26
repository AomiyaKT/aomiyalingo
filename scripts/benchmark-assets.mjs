// Synthetic, local CPU benchmark. No production requests or application data.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createAssetResponder, decodeAsset } from '../server/assets.mjs';

const bytes = fs.readFileSync('public/assets/words/shrine.wav');
const asset = {
  type: 'audio/wav',
  size: bytes.length,
  etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"',
  data: bytes.toString('base64'),
};
const key = '/assets/words/shrine.wav';
const get = new Request('https://benchmark.test' + key);
const head = new Request(get, { method: 'HEAD' });
const conditional = new Request(get, { headers: { 'if-none-match': asset.etag } });
const respond = createAssetResponder({ [key]: asset });
const oldResponse = (request) => {
  const payload = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0));
  return new Response(request.method === 'HEAD' ? null : payload);
};
function measure(run, samples = 40) {
  for (let i = 0; i < 8; i++) run();
  const times = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    median_ms: +times[Math.floor(samples / 2)].toFixed(3),
    p95_ms: +times[Math.floor(samples * 0.95)].toFixed(3),
  };
}
const batch = (run) => () => {
  for (let i = 0; i < 35; i++) run();
};
const report = {
  workload: {
    requests_per_sample: 35,
    asset_bytes: bytes.length,
    samples: 40,
    scope: 'local Node CPU; response construction, not network latency or classroom load',
  },
  previous_get: measure(batch(() => oldResponse(get))),
  optimized_cold_decode: measure(batch(() => decodeAsset(asset.data))),
  optimized_cached_get: measure(batch(() => respond(get, key))),
  previous_head: measure(batch(() => oldResponse(head))),
  optimized_head: measure(batch(() => respond(head, key))),
  optimized_not_modified: measure(batch(() => respond(conditional, key))),
};
console.log(JSON.stringify(report, null, 2));
const output = process.argv.indexOf('--output');
if (output >= 0) fs.writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
