import assert from 'node:assert/strict';
import { createItemRoulette } from '../public/race/items.js';

const original = {
  document: globalThis.document,
  matchMedia: globalThis.matchMedia,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};
const timers = new Map(),
  elements = new Map(),
  storage = new Map(),
  sounds = [];
let serial = 0,
  synced = 0;
const q = (selector) => {
  if (!elements.has(selector))
    elements.set(selector, {
      hidden: true,
      textContent: '',
      style: {},
      classList: { add() {}, remove() {} },
    });
  return elements.get(selector);
};
globalThis.document = { hidden: false };
globalThis.matchMedia = () => ({ matches: false });
globalThis.setTimeout = (callback) => {
  timers.set(++serial, callback);
  return serial;
};
globalThis.clearTimeout = (id) => timers.delete(id);
let data = {
  race: { id: 'race', status: 'running', settings: { items: ['hint', 'boost'] } },
  self: {
    id: '35',
    item: 'boost',
    itemName: 'ダッシュ',
    itemBox: 'box-1',
    ready: true,
    done: false,
  },
};
const settings = { values: { reduceMotion: false } };
try {
  const roulette = createItemRoulette({
    q,
    read: (k) => storage.get(k),
    store: (k, v) => storage.set(k, v),
    getData: () => data,
    appSettings: settings,
    interactionEffects: { sound: (name) => sounds.push(name), pulse() {} },
    syncAnswer: () => synced++,
  });
  roulette.spinItem(data.self, 'box-1');
  assert.equal(roulette.rolling, true);
  assert.equal(timers.size, 1);
  // A later poll pauses the race. The scheduled tick must read that new response.
  data = { ...data, race: { ...data.race, status: 'paused' } };
  const tick = [...timers.values()][0];
  timers.clear();
  tick();
  assert.equal(roulette.rolling, false);
  assert.equal(synced, 1);
  assert.equal(sounds.filter((n) => n === 'roulette').length, 1);
  roulette.cancel();
  assert.equal(timers.size, 0);
  assert.equal(q('#item-roulette').hidden, true);
  // Leaving the page during a spin invalidates callbacks already queued by the browser.
  data = {
    ...data,
    race: { ...data.race, status: 'running' },
    self: { ...data.self, itemBox: 'box-2' },
  };
  roulette.spinItem(data.self, 'box-2');
  const stale = [...timers.values()][0];
  const count = sounds.length;
  roulette.cancel();
  stale();
  assert.equal(sounds.length, count);
  assert.equal(roulette.rolling, false);
  assert.equal(timers.size, 0);
  settings.values.reduceMotion = true;
  data = { ...data, self: { ...data.self, itemBox: 'box-3' } };
  roulette.spinItem(data.self, 'box-3');
  assert.equal(roulette.rolling, false);
  assert.equal(q('#roulette-name').textContent, 'ダッシュ！');
  roulette.cancel();
  console.log(
    'PASS: roulette reads live pause state, cancels stale callbacks on navigation, and respects reduced motion.',
  );
} finally {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
}
