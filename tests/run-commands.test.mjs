import assert from 'node:assert/strict';
import { runQueue } from '../scripts/run-commands.mjs';

const releases = [],
  started = [],
  reports = [];
let active = 0,
  maximum = 0;
const result = runQueue([0, 1, 2, 3, 4, 5], {
  concurrency: 2,
  report: (error) => reports.push(error.message),
  run: async (i) => {
    active++;
    maximum = Math.max(maximum, active);
    started.push(i);
    await new Promise((resolve) => {
      releases[i] = resolve;
    });
    active--;
    if (i === 3) throw new Error('simulated suite failure');
    return i !== 4;
  },
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(started, [0, 1]);
releases[1]();
await flush();
assert.deepEqual(started, [0, 1, 2], 'free worker continues while suite zero is still running');
for (const i of [2, 3, 4, 5]) {
  releases[i]();
  await flush();
}
releases[0]();
assert.equal(await result, false);
assert.equal(maximum, 2);
assert.equal(active, 0);
assert.deepEqual(reports, ['simulated suite failure']);
assert.deepEqual(
  [...started].sort(),
  [0, 1, 2, 3, 4, 5],
  'every suite runs exactly once despite rejection and false results',
);
assert.equal(await runQueue([]), true);
assert.equal(await runQueue([1, 2], { run: async () => true }), true);
await assert.rejects(runQueue([], { concurrency: 0 }), RangeError);
console.log(
  'Check queue: bounded workers, immediate refill, complete failure aggregation and empty queues passed.',
);
