import assert from 'node:assert/strict';
import { createPollScheduler } from '../public/shared/poll-scheduler.js';

const timers = new Map(),
  listeners = new Map();
let serial = 0,
  calls = 0,
  status = 'lobby',
  resolve;
let fail = false;
const host = {
  document: {
    hidden: false,
    addEventListener: (k, v) => listeners.set(k, v),
    removeEventListener: (k) => listeners.delete(k),
  },
  setTimeout(fn, delay) {
    timers.set(++serial, { fn, delay });
    return serial;
  },
  clearTimeout(id) {
    timers.delete(id);
  },
};
const poller = createPollScheduler({
  host,
  random: () => 0.5,
  state: () => ({ status }),
  run: async () => {
    calls++;
    if (fail) return false;
    await new Promise((r) => {
      resolve = r;
    });
  },
});
const delay = () => [...timers.values()][0]?.delay;
assert.equal(delay(), 2150, 'Lobby traffic is staggered around two seconds, not half a second');
const first = poller.refresh();
await poller.refresh();
assert.equal(calls, 1, 'Slow requests never overlap');
assert.equal(timers.size, 0);
status = 'countdown';
resolve();
await first;
assert.equal(delay(), 537.5, 'The three-second countdown keeps fast refresh');
host.document.hidden = true;
listeners.get('visibilitychange')();
assert.equal(timers.size, 0);
await poller.refresh();
assert.equal(calls, 1);
host.document.hidden = false;
listeners.get('visibilitychange')();
assert.equal(calls, 2, 'Foreground restores immediately');
status = 'running';
resolve();
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
fail = true;
await poller.refresh();
assert.equal(delay(), 4300);
await poller.refresh();
assert.equal(delay(), 8600);
await poller.refresh();
assert.equal(delay(), 16125);
fail = false;
const recovery = poller.refresh();
resolve();
await recovery;
assert.equal(delay(), 2150, 'A healthy request resets backoff');
status = 'finished';
const finished = poller.refresh();
resolve();
await finished;
assert.equal(delay(), 5375);
poller.dispose();
assert.equal(timers.size, 0);
assert.equal(listeners.size, 0);
await poller.refresh();
assert.equal(timers.size, 0);
console.log(
  'Polling: staggered lobby, responsive countdown, no overlap, hidden suspension, immediate foreground, error backoff, recovery and cleanup passed.',
);
