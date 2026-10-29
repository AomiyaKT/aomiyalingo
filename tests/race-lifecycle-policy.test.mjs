import assert from 'node:assert/strict';
import {
  raceTransition,
  courseEndStatus,
  createStudentRaceLifecycle,
  createRacePlayback,
} from '../public/race/lifecycle.js';
assert.equal(raceTransition('lobby', 'start'), 'running');
assert.equal(raceTransition('running', 'pause'), 'paused');
assert.equal(raceTransition('paused', 'resume'), 'running');
assert.equal(raceTransition('intermission', 'nextStation'), 'running');
for (const status of ['lobby', 'running', 'paused', 'intermission', 'finished'])
  assert.equal(raceTransition(status, 'end'), 'finished');
for (const [status, action] of [
  ['running', 'start'],
  ['finished', 'resume'],
  ['paused', 'nextStation'],
  ['running', '__proto__'],
])
  assert.equal(raceTransition(status, action), null);
assert.deepEqual(
  [0, 1, 2].map((n) => courseEndStatus(n, 3)),
  ['intermission', 'intermission', 'finished'],
);
assert.equal(courseEndStatus(0, 1), 'finished');
let boundary = 0,
  suspended = 0;
const life = createStudentRaceLifecycle({
  onBoundary: () => boundary++,
  onSuspend: () => suspended++,
});
const snapshot = (status = 'running', station = 0, id = 's1') => ({
  race: { id: 'r1', station, status },
  self: { id, ready: true, prepared: true, task: { id: 'q1' } },
});
assert.equal(life.update(snapshot()), 'question');
assert.equal(life.update(snapshot('paused'), true), 'paused');
assert.equal(boundary, 0);
assert.equal(suspended, 1);
life.update(snapshot('paused'), true);
assert.equal(suspended, 1, 'Unchanged paused polls do not restart cleanup');
life.update(snapshot(), true);
assert.equal(boundary, 0, 'Resume preserves pending answer and draft ownership');
assert.equal(life.update(snapshot('running', 1), true), 'question');
assert.equal(boundary, 1);
assert.equal(suspended, 2);
life.update(snapshot('running', 1, 's2'));
assert.equal(boundary, 2, 'A different student never inherits the previous question');
life.leave();
const boundaries = boundary;
life.update(snapshot());
assert.equal(boundary, boundaries, 'Explicit re-entry may restore its own durable pending answer');

let owner = 'r1:s1:0:q1',
  enabled = true,
  errors = 0,
  paused = 0,
  cancelled = 0,
  reject;
const audio = createRacePlayback({
  audio: {
    pause() {
      paused++;
    },
  },
  volume: () => 0.2,
  owner: () => owner,
  enabled: () => enabled,
  onError: () => errors++,
  speech: {
    cancel() {
      cancelled++;
    },
  },
  play: () =>
    new Promise((_, r) => {
      reject = r;
    }),
});
const first = audio.play({ word: 'cat' });
const obsolete = reject;
owner = 'r1:s1:1:q2';
obsolete(Error('late'));
await first;
assert.equal(errors, 0);
const second = audio.play({ word: 'dog' });
audio.stop();
reject(Error('cancelled'));
await second;
assert.equal(errors, 0);
assert.equal(paused, 1);
assert.equal(cancelled, 1);
const current = audio.play({ word: 'dog' }, 0.75);
reject(Error('failed'));
await current;
assert.equal(errors, 1);
const quiet = audio.play({ word: 'dog' }, 1, false);
reject(Error('automatic cue'));
await quiet;
assert.equal(errors, 1);
enabled = false;
await audio.play({ word: 'dog' });
assert.equal(errors, 1);
console.log(
  'Lifecycle: shared legal transitions, one cleanup per phase, preserved pause/re-entry, course/student isolation and owned audio passed.',
);
