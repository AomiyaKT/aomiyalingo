import assert from 'node:assert/strict';
import { sceneProgress, createRaceShowtime } from '../public/race/showtime.js';

assert.equal(sceneProgress(null), null);
assert.deepEqual(sceneProgress({ race: { rules: 5, station: 1, stationQuestions: 24 }, self: { stationIndex: 6, index: 30 } }), { station: 1, total: 24, answered: 6, percent: 25 });
assert.equal(sceneProgress({ race: { rules: 5, stationQuestions: 24 }, self: { stationIndex: 90 } }).percent, 100);
class Node {
  constructor(text = '') { this.textContent = text; this.children = []; this.style = {}; this.dataset = {}; this.hidden = false; this.animations = 0; this.classList = { toggle() {}, add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute() {}
  animate() { this.animations++; }
  getBoundingClientRect() { return { left: 10, top: 10, width: 100, height: 40 }; }
  remove() {}
}
const original = { document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const body = new Node(), timers = new Map(), nodes = new Map(), events = new Map();
let timer = 0;
globalThis.document = { body, hidden: false, addEventListener: (name, fn) => events.set(name, fn), querySelectorAll: () => [] };
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false });
globalThis.setTimeout = (fn) => { timers.set(++timer, fn); return timer; };
globalThis.clearTimeout = (id) => timers.delete(id);
const settings = { values: { reduceMotion: true } };
const q = (id) => { if (id === '#race-scene') return null; if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
try {
  const view = createRaceShowtime({ q, make: (tag, text) => new Node(text), avatarArt: () => new Node(), isTeacher: false, settings, effects: { sound() {} } });
  const input = { race: { id: 'r', station: 0, status: 'countdown', startsIn: 3000 } };
  const before = JSON.stringify(input);
  view.update(input);
  const overlay = body.children[0];
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.children[2].textContent, 3);
  assert.equal(overlay.children[2].animations, 0);
  view.update({ race: { ...input.race, status: 'paused' } });
  assert.equal(overlay.hidden, true);
  assert.equal(timers.size, 0);
  view.update(input);
  assert.equal(overlay.hidden, false);
  view.update({ race: { ...input.race, status: 'running' } });
  assert.equal(overlay.children[2].textContent, 'GO!');
  const hide = [...timers.values()][0]; timers.clear(); hide();
  view.countdown(0);
  assert.equal(overlay.hidden, true, 'stale countdown polling cannot replay GO');
  view.receipt({ id: 'receipt', correct: true });
  assert.equal(q('#race-question').dataset.answerState, 'correct');
  view.question();
  view.receipt({ id: 'receipt', correct: true });
  assert.equal(q('#race-question').dataset.answerState, undefined, 'replayed receipt cannot reanimate');
  globalThis.document.hidden = true; events.get('visibilitychange')();
  assert.equal(overlay.hidden, true);
  globalThis.document.hidden = false;
  view.update(input);
  globalThis.document.hidden = true; events.get('visibilitychange')();
  globalThis.document.hidden = false;
  view.countdown(0);
  assert.equal(overlay.hidden, true, 'an expired cached countdown cannot replay GO after tab resume');
  view.update({ race: { ...input.race, status: 'running' } });
  assert.equal(overlay.hidden, true, 'running snapshot resumes without a stale start overlay');
  assert.equal(JSON.stringify(input), before, 'presentation never changes race data');
  console.log('PASS: station progress, pause/resume countdown, no stale GO replay, reduced motion, receipt deduplication and immutable game state.');
} finally { Object.assign(globalThis, original); }
