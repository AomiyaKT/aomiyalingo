import assert from 'node:assert/strict';
import { createRaceSpectacle } from '../public/race/spectacle.js';
class Node {
  constructor(text) {
    this.textContent = text;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.animations = 0;
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  setAttribute() {}
  getAnimations() {
    return [];
  }
  animate() {
    this.animations++;
    return {
      cancel() {
        this.oncancel?.();
      },
    };
  }
}
function setup(isTeacher = false) {
  const timers = new Map(),
    listeners = new Map(),
    sounds = [];
  let id = 0;
  const document = {
    body: new Node(),
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  const host = {
    document,
    matchMedia: () => ({ matches: false }),
    setTimeout(fn) {
      timers.set(++id, fn);
      return id;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
    addEventListener() {},
  };
  const settings = { values: { reduceMotion: false } };
  const view = createRaceSpectacle({
    make: (_tag, text) => new Node(text),
    isTeacher,
    settings,
    effects: { sound: (kind) => sounds.push(kind) },
    host,
  });
  return {
    view,
    host,
    settings,
    sounds,
    timers,
    document,
    listeners,
    notice: document.body.children[0],
  };
}
const player = { id: 'p', rank: 4, alias: '出席番号 23' };
const data = {
  race: { id: 'r', station: 0, status: 'running' },
  board: [player],
  self: { id: 'p', remaining: 360000 },
};
const original = structuredClone(data);
const a = setup();
a.view.update(data);
assert.ok(a.notice.hidden, 'initial state and refresh do not replay a pass');
const passed = { ...data, board: [{ ...player, rank: 2 }] };
a.view.update(passed);
assert.equal(a.notice.children[1].children[1].textContent, '2位にアップ！');
a.view.update(passed);
assert.deepEqual(a.sounds, ['overtake']);
a.view.receipt({ id: 'answer', correct: true, streak: 3 });
assert.equal(a.notice.dataset.kind, 'combo');
const animations = a.notice.animations;
a.view.receipt({ id: 'answer', correct: true, streak: 3 });
assert.equal(a.notice.animations, animations, 'receipt replay cannot restart combo');
a.view.receipt({ id: 'hint', correct: true, hinted: true, streak: 5 });
a.view.receipt({ id: 'review', correct: true, review: true, streak: 5 });
assert.equal(a.notice.animations, animations);
a.view.clock(35000);
a.view.clock(30000);
a.view.clock(30000);
assert.equal(a.sounds.filter((s) => s === 'finalLap').length, 1);
a.view.clock(5000);
a.view.clock(5200);
a.view.clock(5000);
a.view.clock(4000);
assert.equal(a.sounds.filter((s) => s === 'countdown').length, 2);
a.view.item('boost');
assert.equal(a.document.body.dataset.raceEffect, 'boost');
a.view.update({ ...passed, race: { ...data.race, status: 'paused' } });
assert.ok(a.notice.hidden);
assert.equal(a.document.body.dataset.raceEffect, undefined);
a.document.hidden = true;
a.listeners.get('visibilitychange')();
a.view.update({ ...passed, self: { ...data.self, remaining: 25000 } });
const before = a.sounds.length;
a.document.hidden = false;
a.listeners.get('visibilitychange')();
a.view.update({
  ...passed,
  board: [{ ...player, rank: 1 }],
  self: { ...data.self, remaining: 24000 },
});
assert.equal(a.sounds.length, before, 'hidden changes do not replay on resume');
a.view.update({ ...passed, race: { ...data.race, status: 'intermission' } });
assert.equal(a.notice.dataset.kind, 'podium');
const podiumAnimations = a.notice.animations;
a.view.update({ ...passed, race: { ...data.race, status: 'intermission' } });
assert.equal(a.notice.animations, podiumAnimations, 'result polling preserves ceremony');
a.settings.values.reduceMotion = true;
a.view.item('double');
assert.equal(a.notice.animations, podiumAnimations);
assert.equal(a.document.body.dataset.raceEffect, undefined);
a.view.update({ ...passed, race: { ...data.race, station: 1 } });
assert.ok(a.notice.hidden, 'next station resets transient presentation');
assert.deepEqual(data, original, 'presentation cannot modify game data');
const teacher = setup(true);
teacher.view.update({ race: data.race, players: [{ id: 'a', rank: 1, alias: '出席番号 1' }] });
teacher.view.update({ race: data.race, players: [{ id: 'b', rank: 1, alias: '出席番号 2' }] });
assert.equal(teacher.notice.children[1].children[1].textContent, '出席番号 2 がトップ！');
teacher.view.clock(30000);
assert.deepEqual(
  teacher.sounds,
  ['overtake'],
  'teacher never hears one personal timer on behalf of the class',
);
for (const isTeacher of [false, true]) {
  for (let station = 0; station < 3; station++) {
    const stopped = setup(isTeacher);
    const frame = {
      ...data,
      race: { ...data.race, station, stations: 3, remaining: 30000 },
      players: [{ ...player, done: false }],
    };
    stopped.view.update(frame);
    stopped.view.receipt({ id: 'old-streak', correct: true, streak: 3 });
    const ended = { ...frame, race: { ...frame.race, status: 'finished' } };
    stopped.view.update(ended);
    stopped.view.update(ended);
    assert.ok(stopped.notice.hidden, 'manually stopped courses never announce COURSE CLEAR');
    assert.equal(stopped.timers.size, 0);
    assert.deepEqual(stopped.sounds, []);

    const completed = setup(isTeacher);
    completed.view.update(frame);
    const terminal = {
      ...frame,
      race: { ...frame.race, status: station < 2 ? 'intermission' : 'finished', remaining: 0 },
    };
    completed.view.update(terminal);
    assert.equal(completed.notice.dataset.kind, 'podium', 'natural course endings still celebrate');
    const played = completed.notice.animations;
    completed.view.update(terminal);
    assert.equal(completed.notice.animations, played, 'polls do not replay the course ceremony');
    completed.view.update(null);
    assert.ok(completed.notice.hidden, 'entering setup clears an existing ceremony immediately');
    assert.equal(completed.timers.size, 0);
    completed.view.update(terminal);
    assert.ok(completed.notice.hidden, 'returning to a saved result cannot replay its ceremony');
  }
  for (const status of ['lobby', 'countdown']) {
    const canceled = setup(isTeacher);
    canceled.view.update({ ...data, race: { ...data.race, status } });
    canceled.view.update({ ...data, race: { ...data.race, status: 'finished', remaining: 0 } });
    assert.ok(canceled.notice.hidden, 'canceling before start cannot celebrate');
  }
  const earlyClear = setup(isTeacher);
  const finalCourse = { ...data.race, station: 2, stations: 3, remaining: 10000 };
  earlyClear.view.update({ ...data, race: finalCourse });
  earlyClear.view.update({
    ...data,
    race: { ...finalCourse, status: 'finished' },
    board: [{ ...player, done: true }],
  });
  assert.equal(
    earlyClear.notice.dataset.kind,
    'podium',
    'everyone finishing early still celebrates',
  );
}
console.log(
  'Race spectacle: live passes/leader changes, independent streak milestones, one-shot clock cues, pause/hidden/retry/station isolation, reduced motion and immutable scoring data passed.',
);
