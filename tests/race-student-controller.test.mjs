import assert from 'node:assert/strict';
import { createStudentRaceController } from '../public/race/student-controller.js';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
let session = { token: 'one' },
  epoch = 0,
  pending = { questionId: 'q1', answer: 'cat' },
  busy = false,
  accepted = [],
  synced = [],
  errors = [],
  calls = [];
let handler;
const controller = createStudentRaceController({
  api: (...args) => {
    calls.push(args);
    return handler(...args);
  },
  getSession: () => session,
  getEpoch: () => epoch,
  getPending: () => pending,
  setPending: (value) => (pending = value),
  isBusy: () => busy,
  onBusy: (value) => (busy = value),
  onAccepted: (value) => {
    accepted.push(value);
    session = { ...session };
  },
  onError: (e) => errors.push(e),
  onSynchronized: (...args) => synced.push(args),
});
const first = deferred();
handler = () => first.promise;
const flight = controller.submit();
await controller.submit();
assert.equal(calls.length, 1);
assert.equal(busy, true);
first.resolve({ receipt: { id: 'a' } });
assert.equal(await flight, true);
assert.equal(pending, null);
assert.equal(busy, false);
assert.equal(accepted.length, 1);
assert.equal(calls[0][3].token, 'one', 'Answer requests capture their bearer credential');

pending = { questionId: 'q2', answer: 'dog' };
const old = deferred();
handler = () => old.promise;
const oldFlight = controller.submit();
epoch++;
session = { token: 'two' };
controller.invalidate();
pending = { questionId: 'new', answer: 'fish' };
const newer = deferred();
handler = () => newer.promise;
const newFlight = controller.submit();
old.resolve({ receipt: { id: 'obsolete' } });
await oldFlight;
assert.equal(busy, true, 'An old finally cannot unlock the next flight');
assert.equal(pending.questionId, 'new');
assert.equal(accepted.length, 1);
newer.resolve({ receipt: { id: 'new' } });
await newFlight;
assert.equal(busy, false);
assert.equal(accepted.length, 2);

pending = { questionId: 'paused', answer: 'fox' };
handler = async (path) => {
  if (path.endsWith('/answer')) throw Object.assign(Error('pause'), { status: 423 });
  return { race: { status: 'paused' }, self: { task: { id: 'paused' } } };
};
await controller.submit();
assert.equal(pending.questionId, 'paused');
assert.equal(synced.at(-1)[1], false, 'The same paused task remains retryable');
handler = async (path) => {
  if (path.endsWith('/answer')) throw Object.assign(Error('course'), { status: 409 });
  return { race: { status: 'running' }, self: { task: { id: 'next-course' } } };
};
await controller.submit();
assert.equal(pending, null);
assert.equal(synced.at(-1)[1], true, 'A superseded task is discarded after authoritative recovery');

pending = { questionId: 'old-pending' };
const recovery = deferred();
handler = async (path) => {
  if (path.endsWith('/answer')) throw Object.assign(Error('revision'), { status: 409 });
  return recovery.promise;
};
const restoring = controller.submit();
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
epoch++;
session = { token: 'three' };
controller.invalidate();
pending = null;
recovery.reject(Error('offline'));
await restoring;
assert.equal(
  pending,
  null,
  'An obsolete recovery failure cannot resurrect a previous student answer',
);
pending = { questionId: 'offline', answer: 'cat' };
handler = async () => {
  throw Error('offline');
};
await controller.submit();
assert.equal(pending.questionId, 'offline');
assert.equal(busy, false);
assert.ok(errors.length);
console.log(
  'Student controller: durable retries, captured credentials, duplicate exclusion, stale success/finally/recovery and pause/course ownership passed.',
);
