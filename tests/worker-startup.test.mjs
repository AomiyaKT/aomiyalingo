import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// A fresh process exposes allocations hidden by warmed classroom fixtures.
// This is a local eager-allocation guard, not Cloudflare's deploy validator.
const result = spawnSync(
  process.execPath,
  [
    '--expose-gc',
    '--max-old-space-size=96',
    '--input-type=module',
    '-e',
    `
    globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    const { default: worker } = await import(${JSON.stringify(pathToFileURL(resolve('dist/server/index.js')).href)});
    globalThis.gc();
    const allocated = process.memoryUsage().heapUsed - before;
    const response = await worker.fetch(new Request('https://startup.test/api/health'), {});
    console.log(JSON.stringify({ allocated, status: response.status, health: await response.json() }));
  `,
  ],
  { encoding: 'utf8', timeout: 30000, maxBuffer: 65536 },
);
assert.equal(result.status, 0, result.stderr);
const probe = JSON.parse(result.stdout.trim());
assert.equal(probe.status, 200);
assert.equal(probe.health.ok, true);
assert.ok(
  probe.allocated < 16 * 1024 * 1024,
  `Cold initialization allocated ${(probe.allocated / 1048576).toFixed(1)} MiB; payloads must stay lazy.`,
);
console.log(
  'Cold initialization: fresh constrained process, health without database or eager media payloads, and <16 MiB retained import allocation passed.',
);
