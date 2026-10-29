import assert from 'node:assert/strict';
import { createTeacherClock } from '../public/race/teacher-clock.js';
let writes = 0,
  attributes = 0,
  toggles = 0,
  lang = 'ja';
const node = () => ({
  set textContent(value) {
    writes++;
    this.text = value;
  },
  setAttribute(name, value) {
    attributes++;
    this[name] = value;
  },
  classList: {
    toggle() {
      toggles++;
    },
  },
});
const players = Array.from({ length: 35 }, (_, i) => ({
  id: String(i),
  remaining: 300000,
  ready: true,
  done: false,
}));
const rows = new Map(players.map((p) => [p.id, node()]));
const view = createTeacherClock({ language: () => lang });
const running = { status: 'running' };
view.bind(rows);
view.update(players, running, 0);
writes = attributes = toggles = 0;
for (let i = 1; i < 4; i++) view.update(players, running, i * 250);
assert.equal(
  writes + attributes + toggles,
  0,
  '35 clocks do no DOM work within the same displayed second',
);
view.update(players, running, 1000);
assert.equal(writes, 35);
assert.equal(attributes, 35);
assert.equal(toggles, 0);
assert.equal(rows.get('0').text, '4:59');
lang = 'en';
view.update(players, running, 1250);
assert.equal(writes, 35);
assert.equal(attributes, 70);
assert.equal(rows.get('0')['aria-label'], 'Remaining 4:59');
view.update(players, running, 240000);
assert.equal(rows.get('0').text, '1:00');
assert.equal(toggles, 35);
view.update(players, { status: 'paused' }, 999999);
assert.equal(rows.get('0').text, '5:00', 'Paused clocks never subtract local elapsed time');
const finished = { ...players[0], done: true };
view.update([finished], running, 0);
assert.equal(rows.get('0').text, '0:00');
view.update([{ ...players[0], ready: false }], running, 200000);
assert.equal(rows.get('0').text, '5:00', 'Unready late joiner keeps the server personal time');
view.update(players, { status: 'finished' }, 0);
assert.equal(rows.get('1').text, '0:00');
const replaced = node();
view.bind(new Map([['0', replaced]]));
view.update(players, running, -100);
assert.equal(
  replaced.text,
  '5:00',
  'New race nodes initialize independently; negative clock skew is clamped',
);
view.bind(new Map());
writes = attributes = toggles = 0;
view.update(players, running, 0);
assert.equal(writes + attributes + toggles, 0, 'Removed race nodes are released');
console.log(
  'Teacher clock: 35 cached references, second-level writes, English labels, pause/finish/late-join/reset and zero unchanged work passed.',
);
