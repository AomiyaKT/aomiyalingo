import assert from 'node:assert/strict';
import { createPracticeNavigation } from '../public/practice/navigation.js';
const requests = [],
  shown = [];
let superseded = 0,
  busyUpdates = 0;
const nav = createPracticeNavigation({
  start() {
    return new Promise((resolve, reject) => requests.push({ resolve, reject }));
  },
  showLesson: (lesson) => shown.push(lesson),
  updateBusy: () => busyUpdates++,
  onSuperseded: () => superseded++,
});
const first = nav.start();
assert.equal(await nav.start(), false, 'double taps do not supersede the first start');
assert.equal(requests.length, 1);
requests[0].resolve({ id: 'first' });
assert.equal(await first, true);
const second = nav.start();
nav.cancel();
requests[1].resolve({ id: 'late' });
assert.equal(await second, false);
assert.equal(shown.length, 1);
assert.equal(superseded, 1, 'returning to the path/book prevents a late question-screen jump');
const old = nav.start();
nav.cancel();
const current = nav.start();
requests[2].resolve({ id: 'old' });
await old;
requests[3].resolve({ id: 'current' });
await current;
assert.deepEqual(
  shown.map((l) => l.id),
  ['first', 'current'],
);
const failure = nav.start();
requests[4].reject(Error('network'));
await assert.rejects(failure, /network/);
const retry = nav.start();
requests[5].resolve(null);
assert.equal(await retry, false);
assert.equal(busyUpdates, 12, 'every started request settles its busy view, including errors');
console.log(
  'Practice navigation: double taps, superseded starts, path/book return, latest-screen ownership and error cleanup passed.',
);
