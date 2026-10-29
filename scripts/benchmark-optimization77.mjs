import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { createUITranslator } from '../public/shared/i18n.js';
import { createAssetResponder, decodeAsset } from '../server/assets.mjs';

const samples = [];
const translationLabels = Array.from(
  { length: 35 },
  (_, i) => `${i + 1}位 出席番号 ${i + 1} · ${i * 100}点`,
);
function translateBatch(translate) {
  return Array.from({ length: 20 }, () => translationLabels.map((s) => translate(s)));
}
const uncached = createUITranslator({ maxEntries: 0 }),
  cached = createUITranslator();
assert.deepEqual(translateBatch(cached), translateBatch(uncached));
function measure(fn) {
  const times = [];
  for (let i = 0; i < 5; i++) fn();
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { medianMs: +times[15].toFixed(3), p95Ms: +times[28].toFixed(3) };
}
const speech = readFileSync('public/assets/words/shrine.wav');
const packed = gzipSync(speech);
// Release 76 kept the decoded gzip bytes but decompressed on every GET.
const previousPacked = decodeAsset(packed.toString('base64'));
const previousSpeech = () =>
  new Response(new Blob([previousPacked]).stream().pipeThrough(new DecompressionStream('gzip')));
const record = {
  type: 'audio/wav',
  size: speech.length,
  etag: '"speech"',
  data: packed.toString('base64'),
  encoding: 'gzip',
};
const respond = createAssetResponder({ '/speech.wav': record });
const request = new Request('https://benchmark.test/speech.wav');
async function speechBatch(get) {
  const start = performance.now();
  const bodies = await Promise.all(
    Array.from({ length: 35 }, async () => Buffer.from(await get().arrayBuffer())),
  );
  for (const bytes of bodies) assert.deepEqual(bytes, speech);
  return performance.now() - start;
}
// Warm both, then alternate order to reduce position bias. Full bodies consumed.
await speechBatch(previousSpeech);
await speechBatch(() => respond(request, '/speech.wav'));
for (let i = 0; i < 8; i++) {
  const result = {};
  for (const key of i % 2 ? ['cached', 'previous'] : ['previous', 'cached'])
    result[key] = await speechBatch(
      key === 'cached' ? () => respond(request, '/speech.wav') : previousSpeech,
    );
  samples.push(result);
}
const audioMedian = (key) =>
  +samples
    .map((s) => s[key])
    .sort((a, b) => a - b)[4]
    .toFixed(3);
const bundles = [];
for (const name of ['race', 'teacher', 'classroom', 'settings', 'teacher-editor']) {
  const sizes = [];
  for (const minify of [false, true]) {
    const result = await build({
      entryPoints: [`public/${name}.js`],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      write: false,
      legalComments: 'none',
      minify,
    });
    sizes.push(result.outputFiles[0].contents.length);
  }
  bundles.push({
    name,
    beforeBytes: sizes[0],
    afterBytes: sizes[1],
    reductionPercent: +(100 * (1 - sizes[1] / sizes[0])).toFixed(1),
  });
}
const report = {
  scope:
    'Local synthetic CPU/work/byte comparison; not physical iPad FPS, classroom Wi-Fi or hosted latency.',
  translation: {
    labels: 35,
    refreshes: 20,
    uncached: measure(() => translateBatch(uncached)),
    cached: measure(() => translateBatch(cached)),
  },
  speech: {
    learners: 35,
    bytes: speech.length,
    medianPreviousMs: audioMedian('previous'),
    medianCachedMs: audioMedian('cached'),
  },
  bundles,
};
console.log(JSON.stringify(report, null, 2));
const at = process.argv.indexOf('--output');
if (at >= 0) writeFileSync(process.argv[at + 1], JSON.stringify(report, null, 2) + '\n');
