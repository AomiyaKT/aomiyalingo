import assert from 'node:assert/strict';
import { createTeacherRaceController } from '../public/race/teacher-controller.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const elements = new Map();
function q(key) {
  if (!elements.has(key))
    elements.set(key, {
      value: '',
      disabled: false,
      textContent: '',
      events: {},
      focus() {},
      scrollIntoView() {},
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      addEventListener(name, fn) {
        this.events[name] = fn;
      },
      querySelectorAll() {
        return [];
      },
    });
  return elements.get(key);
}
q('#race-grade').value = '6-2';
const lifecycle = { busy: false, epoch: 0 },
  events = new Map(),
  requests = [],
  draws = [],
  presentationOptions = [];
let data = {
    race: { id: 'old', title: 'Old', status: 'lobby', settings: { grade: 6, unit: '2' } },
    players: [{ label: '13', prepared: false }],
  },
  polls = 0;
const controller = createTeacherRaceController({
  q,
  lifecycle,
  getData: () => data,
  api(path, payload) {
    const task = deferred();
    requests.push({ path, payload, ...task });
    return task.promise;
  },
  drawTeacher(result, options) {
    data = result;
    draws.push(result);
    presentationOptions.push(options);
  },
  poll() {
    polls++;
  },
  logged() {},
  settings: { values: { reduceMotion: true } },
  effects: { sound() {} },
  events: {
    addEventListener(name, fn) {
      events.set(name, fn);
    },
  },
});
const configuration = (minutes) => ({
  config: {
    unit2: {
      race: { wordIds: ['cat', 'dog', 'bird', 'fish'], minutes, items: [], modes: ['text'] },
    },
  },
});
const initial = controller.loadRules();
assert.match(
  q('#race-title').value,
  /6年生 · Unit 2/,
  'default title matches the selected curriculum',
);
assert.equal(controller.loadRules(), initial, 'coalesce duplicate configuration reads');
assert.equal(requests.length, 1);
events.get('aomi-mode-settings-saved')();
const current = controller.loadRules();
assert.equal(requests.length, 2);
requests[1].resolve(configuration(9));
await current;
assert.match(q('#race-config-summary').textContent, /1コース9分/);
requests[0].resolve(configuration(3));
await initial;
assert.match(
  q('#race-config-summary').textContent,
  /1コース9分/,
  'old reads cannot overwrite saved rules',
);
await controller.loadRules();
assert.equal(requests.length, 2);

q('#race-start').onclick();
assert.equal(requests.length, 2, 'unprepared participants require the existing confirmation');
assert.equal(q('#race-confirm').open, true);
data = { race: { id: 'other', title: 'Other', status: 'intermission' }, players: [] };
const started = q('#race-confirm-ok').onclick();
const start = requests.at(-1);
assert.equal(start.payload.raceId, 'old', 'confirmation keeps its original race');
assert.equal(start.payload.action, 'start');
assert.equal(lifecycle.busy, true);
const requestCount = requests.length;
await q('#race-pause').onclick();
assert.equal(requests.length, requestCount, 'a second lifecycle write cannot overlap');
let prevented = false;
q('#race-confirm').events.cancel({
  preventDefault() {
    prevented = true;
  },
});
assert.equal(prevented, true);
start.resolve({
  race: { id: 'old', title: 'Old', status: 'running', settings: { grade: 6, unit: '2' } },
  players: [],
});
await started;
assert.equal(lifecycle.busy, false);
assert.equal(q('#race-confirm').open, false);

q('#race-end').onclick();
const ending = q('#race-confirm-ok').onclick();
assert.equal(lifecycle.busy, true, 'end uses the same protected lifecycle write');
requests.at(-1).reject(Error('offline'));
await ending;
assert.equal(q('#race-confirm').open, true);
assert.match(q('#race-confirm-error').textContent, /offline/);
assert.equal(lifecycle.busy, false);
assert.equal(q('#race-confirm-ok').disabled, false);
q('#race-confirm-cancel').onclick();

q('#race-end').onclick();
const endDraw = presentationOptions.length;
const ended = q('#race-confirm-ok').onclick();
requests.at(-1).resolve({ ...data, race: { ...data.race, status: 'finished' } });
await ended;
assert.equal(
  presentationOptions[endDraw].silent,
  true,
  'manual end suppresses a completion ceremony',
);

const epoch = lifecycle.epoch;
const before = draws.length;
const polling = controller.refresh(() => epoch === lifecycle.epoch);
lifecycle.epoch++;
requests.at(-1).resolve({ race: { id: 'stale' }, races: [], trash: [] });
await polling;
assert.equal(draws.length, before, 'outdated current-race polls cannot redraw');
q('#race-history').value = 'history';
q('#race-history').onchange();
assert.ok(polls > 0);
const historyEpoch = lifecycle.epoch;
const historyPoll = controller.refresh(() => historyEpoch === lifecycle.epoch);
requests.at(-1).resolve({ race: { id: 'live' }, races: [{ id: 'history' }], trash: [] });
await Promise.resolve();
assert.match(requests.at(-1).path, /board\?race=history$/);
lifecycle.epoch++;
requests.at(-1).resolve({ race: { id: 'history' }, players: [] });
await historyPoll;
assert.equal(draws.length, before, 'outdated history fetches cannot redraw');

data = {
  race: {
    id: 'finished',
    title: 'Finished',
    status: 'finished',
    settings: { grade: 6, unit: '2' },
  },
  players: [],
};
const writes = requests.length;
q('#race-reset').onclick();
assert.equal(controller.preparing, true);
assert.equal(
  presentationOptions.at(-1).silent,
  true,
  'reset renders setup without old race effects',
);
assert.equal(requests.length, writes, 'finished-race reset prepares without a server write');
q('#race-setup-back').onclick();
assert.equal(controller.preparing, false);
data.trash = [{ id: 'trash-one', title: 'Archived', revision: 5, deleted_at: 123 }];
data.trashVersion = 'confirmed-version';
let beforePurge = requests.length;
controller.purge(data.trash[0]);
assert.equal(requests.length, beforePurge, 'opening single purge confirmation never writes');
assert.match(q('#race-confirm-description').textContent, /元に戻せません/);
assert.equal(q('#race-confirm-ok').className, 'submit race-danger');
q('#race-confirm-cancel').onclick();
assert.equal(requests.length, beforePurge, 'cancel leaves all data untouched');
q('#race-trash-empty').onclick();
data.trashVersion = 'changed-after-dialog';
const purging = q('#race-confirm-ok').onclick();
assert.equal(requests.at(-1).payload.scope, 'all');
assert.equal(
  requests.at(-1).payload.trashVersion,
  'confirmed-version',
  'bulk confirmation captures its original target',
);
beforePurge = requests.length;
await q('#race-confirm-ok').onclick();
controller.purge(data.trash[0]);
assert.equal(requests.length, beforePurge, 'double confirmation and a second purge cannot overlap');
requests.at(-1).reject(Error('purge offline'));
await purging;
assert.equal(q('#race-confirm').open, true);
assert.match(q('#race-confirm-error').textContent, /purge offline/);
assert.equal(lifecycle.busy, false);
assert.equal(q('#race-confirm-ok').disabled, false);
q('#race-confirm-cancel').onclick();
controller.purge(data.trash[0]);
const single = q('#race-confirm-ok').onclick();
assert.deepEqual(requests.at(-1).payload, {
  scope: 'one',
  raceId: 'trash-one',
  raceTitle: 'Archived',
  revision: 5,
  deletedAt: 123,
  confirm: true,
});
requests.at(-1).resolve({ ok: true, removed: 1 });
await single;
assert.equal(q('#race-confirm').open, false);
assert.match(q('#race-lifecycle-result').textContent, /1件/);
console.log(
  'Race teacher controller: configuration coalescing/stale reads, pinned confirmation targets, write exclusion, error recovery, stale current/history polls and reset passed.',
);
