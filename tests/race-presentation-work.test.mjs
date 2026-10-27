import assert from 'node:assert/strict';
import { createRaceShowtime } from '../public/race/showtime.js';
import { raceItemCatalog, raceItemNames } from '../public/shared/race-items.js';
import { raceBriefing } from '../public/race/briefing.js';
import { createItemRoulette } from '../public/race/items.js';
import { createRaceRules } from '../server/race/rules.mjs';

const counts = { text: 0, attributes: 0, style: 0, dataset: 0, hidden: 0, media: 0 };
const active = new Set();
const tracked = (name) =>
  new Proxy(
    {},
    {
      set(target, key, value) {
        counts[name]++;
        target[key] = value;
        return true;
      },
    },
  );
class Node {
  constructor(text = '', className = '') {
    this.text = text;
    this.className = className;
    this.children = [];
    this.attrs = new Map();
    this.style = tracked('style');
    this.dataset = tracked('dataset');
    this.isHidden = false;
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  get textContent() {
    return this.text;
  }
  set textContent(value) {
    counts.text++;
    this.text = value;
  }
  get hidden() {
    return this.isHidden;
  }
  set hidden(value) {
    counts.hidden++;
    this.isHidden = !!value;
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  setAttribute(key, value) {
    counts.attributes++;
    this.attrs.set(key, value);
  }
  getAttribute(key) {
    return this.attrs.get(key) ?? null;
  }
  getBoundingClientRect() {
    return { left: 10, top: 10, width: 100, height: 40 };
  }
  animate() {
    const animation = {
      cancel() {
        active.delete(this);
        this.oncancel?.();
      },
    };
    active.add(animation);
    return animation;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this);
  }
}
function events() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) {
      listeners.get(name)?.delete(fn);
    },
    emit(name) {
      for (const fn of listeners.get(name) || []) fn();
    },
  };
}
const document = { ...events(), body: new Node(), hidden: false };
const timers = new Map();
let serial = 0;
const host = {
  ...events(),
  document,
  matchMedia() {
    counts.media++;
    return { matches: false };
  },
  setTimeout(fn) {
    timers.set(++serial, fn);
    return serial;
  },
  clearTimeout(key) {
    timers.delete(key);
  },
};
const nodes = new Map(),
  settings = { values: { reduceMotion: false } };
let celebrations = 0;
const q = (key) => {
  if (!nodes.has(key)) nodes.set(key, new Node());
  return nodes.get(key);
};
const view = createRaceShowtime({
  q,
  make: (_tag, text, cls) => new Node(text, cls),
  avatarArt: () => new Node(),
  isTeacher: false,
  settings,
  host,
  effects: {
    sound() {},
    celebrate() {
      celebrations++;
    },
  },
});
const result = {
  race: { id: 'r', station: 0, status: 'running', endless: true, settings: { minutes: 6 } },
  board: [{ id: 'p', rank: 1 }],
  self: { id: 'p', ready: true, done: false, remaining: 300000, stationIndex: 4, avatar: 'cat' },
};
view.update(result);
assert.equal(counts.media, 2, 'one media query per controller, not per animation');
for (const key of Object.keys(counts)) counts[key] = 0;
for (let i = 0; i < 1000; i++) {
  view.update(structuredClone(result));
  view.clock(300000 - i * 200);
}
// Countdowns may update their internal number, but the normal/final visual state
// should not be rewritten 1,000 times. This workload stays above 30 seconds.
assert.deepEqual(counts, { text: 0, attributes: 0, style: 0, dataset: 0, hidden: 0, media: 0 });
view.receipt({ id: 'answer1', correct: true, streak: 3 });
assert.ok(timers.size > 0);
assert.ok(active.size > 0);
assert.equal(
  document.body.children.filter((node) => node.className === 'race-spark-layer').length,
  1,
);
view.update({ ...result, race: { ...result.race, status: 'paused' } });
assert.equal(timers.size, 0);
assert.equal(active.size, 0);
assert.equal(
  document.body.children.filter((node) => node.className === 'race-spark-layer').length,
  0,
);
view.update(result);
view.receipt({ id: 'answer2', correct: true });
document.hidden = true;
document.emit('visibilitychange');
assert.equal(timers.size, 0);
assert.equal(active.size, 0);
document.hidden = false;
view.update({ ...result, race: { ...result.race, station: 1 } });
view.receipt({ id: 'answer3', correct: true });
settings.values.reduceMotion = true;
host.emit('aomiyalingo-settings');
assert.equal(active.size, 0);
assert.equal(timers.size, 0);
for (let station = 0; station < 3; station++) {
  const running = { ...result, race: { ...result.race, station, stations: 3, remaining: 30000 } };
  view.update(running);
  view.update({ ...running, race: { ...running.race, status: 'finished' } });
  assert.equal(celebrations, 0, 'manual stops never trigger global confetti');
}
view.update(result);
view.update({ ...result, race: { ...result.race, status: 'intermission' } });
assert.equal(celebrations, 1, 'a naturally completed course still celebrates');
view.update(null);
assert.equal(timers.size, 0, 'setup clears the course notice and all owned timers');
assert.equal(active.size, 0);
const savedResult = { ...result, race: { ...result.race, status: 'intermission' } };
view.update(savedResult);
assert.equal(celebrations, 1, 'saved results do not replay confetti after setup');
view.dispose();
assert.equal(
  [...document.listeners.values(), ...host.listeners.values()].reduce(
    (sum, set) => sum + set.size,
    0,
  ),
  0,
);
assert.equal(document.body.children.length, 0);

const ids = ['hint', 'boost', 'review', 'compass', 'double', 'lucky'];
assert.deepEqual(Object.keys(raceItemCatalog), ids);
const rules = createRaceRules({ words: [], raceAvatarCatalog: [] });
assert.equal(rules.raceItems, raceItemNames);
const roulette = createItemRoulette({});
assert.equal(roulette.itemArt, raceItemCatalog);
const briefing = raceBriefing(
  {
    settings: {
      items: ids,
      modes: ['text'],
      minutes: 6,
      boostCount: 3,
      hintPoints: 60,
      reviewPoints: 50,
      correctPoints: 120,
    },
  },
  'Test',
);
for (const item of briefing.items) {
  assert.equal(item.name, raceItemNames[item.id]);
  assert.equal(item.icon, raceItemCatalog[item.id].icon);
}
assert.ok(briefing.items.find((item) => item.id === 'boost').text.includes('3回'));
assert.throws(() => {
  roulette.itemArt.hint.name = 'changed';
}, TypeError);
console.log(
  'Presentation work: 1,000 unchanged frames produce zero text/attribute/style/dataset/visibility/media work; pause/hidden/settings/dispose clean owned animations/timers/layers; item metadata agrees across rules and views.',
);
