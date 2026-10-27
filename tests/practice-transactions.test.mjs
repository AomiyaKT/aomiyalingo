import assert from 'node:assert/strict';
import { createPracticeTransactions } from '../public/practice/transactions.js';
const defer = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function fixture() {
  let session = { id: 'a', token: 'token-a', lesson: { id: 'before-a' } },
    paused = false;
  const disk = new Map(),
    calls = [],
    saved = [],
    errors = [];
  const tx = createPracticeTransactions({
    getSession: () => session,
    isPaused: () => paused,
    api(path, data, token) {
      const request = defer();
      calls.push({ path, data, token, ...request });
      return request.promise;
    },
    read: (key) => disk.get(key),
    write(key, value) {
      value === null ? disk.delete(key) : disk.set(key, structuredClone(value));
    },
    onSaving() {},
    onSaved: (...value) => saved.push(value),
    onError: (...value) => errors.push(value),
  });
  tx.restore();
  return {
    tx,
    disk,
    calls,
    saved,
    errors,
    get session() {
      return session;
    },
    set session(value) {
      session = value;
    },
    set paused(value) {
      paused = value;
    },
  };
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const f = fixture();
f.disk.set('aomi.draft.a', { questionId: 'q1' });
assert.equal(f.tx.record('q1', ['cat'], true), true);
assert.deepEqual(f.disk.get('aomi.pending.a'), {
  questionId: 'q1',
  answer: ['cat'],
  hintUsed: true,
});
assert.equal(
  f.tx.record('q2', ['dog']),
  false,
  'a second answer cannot overwrite the pending slot',
);
assert.equal(f.calls.length, 1);
f.calls[0].reject(Error('offline'));
await settle();
assert.equal(f.tx.busy, true);
assert.equal(f.tx.pending, false);
assert.equal(f.errors.length, 1);
f.paused = true;
assert.equal(await f.tx.flush(), false);
assert.equal(f.calls.length, 1);
f.paused = false;
const retry = f.tx.flush();
assert.deepEqual(f.calls[1].data, f.calls[0].data);
assert.equal(f.calls[1].token, 'token-a');
f.calls[1].resolve({ lesson: { id: 'after-a' } });
await retry;
assert.equal(f.tx.busy, false);
assert.equal(f.disk.has('aomi.pending.a'), false);
assert.equal(f.disk.has('aomi.draft.a'), false);
assert.equal(f.tx.takeLesson().id, 'after-a');
assert.equal(f.tx.takeLesson(), null);

const g = fixture(),
  a = g.session;
g.tx.record('a-question', 'cat');
g.session = { id: 'b', token: 'token-b', lesson: { id: 'before-b' } };
g.tx.restore();
g.tx.record('b-question', 'dog');
g.calls[0].resolve({ lesson: { id: 'stale-a' } });
await settle();
assert.equal(g.saved.length, 0);
assert.equal(g.session.lesson.id, 'before-b');
assert.equal(g.tx.pending, true, 'an old finally cannot release the new flight');
assert.equal(
  g.disk.has('aomi.pending.a'),
  true,
  'a stale acknowledgement leaves the original slot for safe receipt replay',
);
assert.equal(g.disk.get('aomi.pending.b').questionId, 'b-question');
g.calls[1].resolve({ lesson: { id: 'after-b' } });
await settle();
assert.equal(g.session.lesson.id, 'after-b');
assert.equal(g.saved.length, 1);
g.session = a;
g.tx.restore();
assert.equal(g.tx.unsent, true);
const replay = g.tx.flush();
assert.equal(g.calls[2].data.questionId, 'a-question');
g.calls[2].resolve({ lesson: { id: 'replayed-a' } });
await replay;
assert.equal(a.lesson.id, 'replayed-a');

const h = fixture();
const oldStart = h.tx.start('spelling', true);
assert.equal(await h.tx.start(null), null, 'starts cannot overlap');
h.session = { id: 'b', token: 'token-b', lesson: {} };
h.tx.restore();
const newStart = h.tx.start(null);
h.calls[0].resolve({ lesson: { id: 'old' } });
assert.equal(await oldStart, null);
assert.equal(h.tx.pending, true);
h.calls[1].reject(Error('try again'));
assert.equal(await newStart, null);
assert.equal(h.tx.pending, false);
assert.equal(h.saved.length, 0);
assert.equal(h.errors.length, 1);
console.log(
  'Practice transactions: durable answer slot, duplicate exclusion, offline/pause retry, captured credentials, stale-session responses/finally, receipt replay and start recovery passed.',
);
