import assert from 'node:assert/strict';
import { createConnectionNotice } from '../public/shared/connection-notice.js';

const timers = new Map();
let sequence = 0;
const classes = new Set();
const banner = {
  hidden: true,
  textContent: '',
  classList: {
    add: (name) => classes.add(name),
    remove: (name) => classes.delete(name),
  },
};
const notice = createConnectionNotice({
  banner,
  schedule: (run, delay) => {
    assert.equal(delay, 3000);
    timers.set(++sequence, run);
    return sequence;
  },
  cancel: (id) => timers.delete(id),
});
notice(true);
assert.equal(banner.hidden, true);
notice(false);
assert.equal(banner.hidden, false);
assert.ok(classes.has('connection-lost'));
notice(true);
assert.match(banner.textContent, /戻りました/);
assert.equal(classes.size, 0);
assert.equal(timers.size, 1);
notice(true);
notice(true);
assert.equal(timers.size, 1, 'Successful polls cannot cancel the recovery expiry');
timers.get(sequence)();
assert.equal(banner.hidden, true);
timers.clear();
notice(false);
notice(true);
const obsolete = sequence;
notice(false);
assert.equal(timers.has(obsolete), false);
assert.equal(banner.hidden, false);
notice(true);
assert.equal(timers.size, 1);
timers.get(sequence)();
assert.equal(banner.hidden, true);
console.log(
  'Connection notice: initial health, loss/recovery, expiry through polling and repeated-loss cancellation passed.',
);
