import assert from 'node:assert/strict';
import { practiceFlow, createClassLauncher } from '../public/practice/teacher-flow.js';

const room = { id: 'live', title: 'Today', active: true, accepting: true };
assert.equal(practiceFlow(null, true).phase, 'setup');
assert.equal(practiceFlow(null, true).back, 'ホームに戻る');
assert.equal(practiceFlow(null, false).phase, 'setup', 'Deleting the last class returns to setup');
assert.equal(practiceFlow(room, true).back, '今の授業に戻る');
assert.equal(practiceFlow(room, false).canJoin, true);
assert.equal(practiceFlow(room, false).phase, 'running');
assert.equal(practiceFlow({ ...room, paused: true }, false).phase, 'paused');
assert.match(practiceFlow({ ...room, accepting: false }, false).next, /締め切/);
const ended = practiceFlow({ ...room, active: false }, false);
assert.equal(ended.canJoin, false);
assert.equal(ended.phase, 'results');
assert.match(ended.next, /新しい授業を準備/);

let active = room,
  busy = false,
  confirmation,
  calls = [],
  release;
const launch = createClassLauncher({
  getActive: () => active,
  isBusy: () => busy,
  confirm: (target, run) => {
    confirmation = { target, run };
  },
  create: (payload) => {
    calls.push(payload);
    return new Promise((resolve) => {
      release = resolve;
    });
  },
});
const draft = { title: 'New class', modes: ['text'] };
await launch(draft);
assert.equal(calls.length, 0, 'Preparing and displaying a confirmation never ends a room');
assert.equal(confirmation.target.id, 'live');
draft.title = 'Edited later';
draft.modes.push('spelling');
const running = confirmation.run();
const duplicate = confirmation.run();
assert.equal(calls.length, 1, 'Double confirmation cannot start two classes');
assert.deepEqual(calls[0], { title: 'New class', modes: ['text'] });
release();
await Promise.all([running, duplicate]);
active = null;
const direct = launch({ title: 'After completion' });
assert.equal(calls.length, 2);
release();
await direct;
busy = true;
await launch({ title: 'Blocked' });
assert.equal(calls.length, 2);
busy = false;
let attempts = 0;
const retry = createClassLauncher({
  getActive: () => null,
  isBusy: () => false,
  confirm: () => assert.fail(),
  create: async () => {
    if (++attempts === 1) throw Error('offline');
  },
});
await assert.rejects(retry({}), /offline/);
await retry({});
assert.equal(attempts, 2, 'A failed request releases the creation lock');
console.log(
  'Teacher flow: explicit setup/live/pause/results, ended QR suppression, active-class confirmation, pinned drafts, double-submit guards and retry recovery passed.',
);
