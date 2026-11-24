import assert from 'node:assert/strict';
import { createClassroomSession } from '../public/practice/classroom-session.js';
const defer = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const nodes = new Map(),
  timers = [],
  events = new Map(),
  disk = new Map(),
  statusCalls = [],
  joinCalls = [],
  answerCalls = [];
const q = (key) => {
  if (!nodes.has(key))
    nodes.set(key, {
      hidden: false,
      value: '',
      textContent: '',
      open: false,
      events: {},
      classList: { toggle() {} },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      focus() {
        focused = key;
      },
      addEventListener(name, fn) {
        this.events[name] = fn;
      },
    });
  return nodes.get(key);
};
const storage = {
  getItem: (k) => disk.get(k) ?? null,
  setItem: (k, v) => disk.set(k, v),
  removeItem: (k) => disk.delete(k),
};
let activeClass = 'a',
  focused = null,
  entries = 0,
  entryOffline = false;
const key = 'aomiyalingo.classroom.session';
const saved = (id) => ({ id, token: 'token-' + id, classId: id, label: id === 'a' ? '1' : '2' });
const vocabulary = [];
const session = createClassroomSession({
  page: { hidden: false, querySelector: q },
  events: {
    addEventListener(name, fn) {
      events.set(name, fn);
    },
  },
  search: '',
  storage,
  legacyStorage: storage,
  vocabulary,
  builtinVocabulary: [],
  enterStudent() {
    entries++;
  },
  goHome() {},
  stopAudio() {},
  schedule(fn, ms) {
    timers.push({ fn, ms });
  },
  request(path, payload, options) {
    if (path.startsWith('/api/class/current'))
      return entryOffline
        ? Promise.reject(Error('network unavailable'))
        : Promise.resolve({
            classroom: { id: activeClass, accepting: true, title: 'Class ' + activeClass },
          });
    if (path === '/api/student/me') {
      const id = options.token.slice(6);
      return Promise.resolve({
        active: true,
        paused: false,
        lesson: { vocabulary: [{ word: id }] },
        ...saved(id),
      });
    }
    if (path === '/api/student/status') {
      const task = defer();
      statusCalls.push(task);
      return task.promise;
    }
    if (path === '/api/join') {
      const task = defer();
      joinCalls.push({ payload, ...task });
      return task.promise;
    }
    if (path === '/api/student/answer') {
      const task = defer();
      answerCalls.push({ payload, ...task });
      return task.promise;
    }
    throw Error(path);
  },
});
storage.setItem(key, JSON.stringify(saved('a')));
await session.openJoin();
assert.equal(session.current.id, 'a');
assert.equal(entries, 1);
const oldStatus = timers.find((t) => t.ms === 3000).fn();
storage.setItem(key, JSON.stringify(saved('b')));
activeClass = 'b';
await session.openJoin();
assert.equal(session.current.id, 'b');
statusCalls[0].reject(Object.assign(Error('old token expired'), { status: 401 }));
await oldStatus;
assert.equal(session.paused, false, 'old status failures cannot revoke a new session');
assert.equal(q('#class-paused').open, false);
assert.equal(vocabulary[0].word, 'b');

storage.removeItem(key);
await session.openJoin();
q('#attendance-number').value = '3';
const event = { preventDefault() {} };
await q('#join-form').onsubmit(event);
assert.equal(focused, '#join-submit', 'confirmation moves focus off the numeric keyboard');
assert.equal(q('#join-confirmation').textContent, '出席番号 3 で参加します。');
q('#join-back').onclick();
assert.equal(focused, '#attendance-number', 'number correction returns to the input');
assert.equal(q('#attendance-number').readOnly, false);
await q('#join-form').onsubmit(event);
const joining = q('#join-form').onsubmit(event);
await q('#join-form').onsubmit(event);
assert.equal(joinCalls.length, 1, 'double submit sends one join');
const before = entries;
await session.openJoin();
joinCalls[0].resolve({ ...saved('c'), active: true, lesson: { vocabulary: [] } });
await joining;
assert.equal(entries, before, 'an obsolete join does not replace the current screen/session');
assert.equal(session.current.id, 'b');
assert.equal(session.busy, false);
storage.setItem(key, JSON.stringify(saved('b')));
await session.openJoin();
session.record('retry-question', 'cat');
answerCalls[0].reject(Error('Wi-Fi still reports online'));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(session.busy, true);
assert.match(q('#sync-status').textContent, /自動で再送/);
const healthyPoll = timers.find((t) => t.ms === 3000).fn();
statusCalls.at(-1).resolve({ active: true, paused: false });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(answerCalls.length, 2, 'A healthy poll retries without an online event');
assert.deepEqual(answerCalls[1].payload, answerCalls[0].payload);
answerCalls[1].resolve({ lesson: { queue: [], vocabulary: [] } });
await healthyPoll;
assert.equal(session.busy, false);
assert.equal(storage.getItem('aomi.pending.b'), null);
assert.equal(q('#join-dialog').open, false, 'Temporary loss never opens the join screen');
const revokedPoll = timers.find((t) => t.ms === 3000).fn();
statusCalls.at(-1).reject(Object.assign(Error('revoked'), { status: 401 }));
await revokedPoll;
assert.equal(q('#class-paused').open, true);
assert.equal(q('#paused-reconnect').hidden, false);
assert.equal(session.paused, true);
await q('#paused-reconnect').onclick();
assert.equal(q('#attendance-number').value, '2');
assert.equal(q('#join-dialog').open, true);
assert.equal(q('#class-paused').open, false);
assert.equal(session.current, null, 'Invalid credentials are not silently reused');
entryOffline = true;
q('#attendance-number').value = '19';
await session.openJoin();
assert.equal(q('#join-retry').hidden, false);
assert.equal(q('#join-submit').disabled, true);
entryOffline = false;
focused = null;
await timers.find((t) => t.ms === 3000).fn();
assert.equal(focused, null, 'Automatic entry recovery does not reopen the iPad keyboard');
assert.equal(q('#join-retry').hidden, true);
assert.equal(q('#join-submit').disabled, false);
assert.equal(q('#attendance-number').value, '19', 'Entry recovery preserves the typed number');
console.log(
  'Practice classroom session: saved-session recovery, scoped vocabulary, old-token/status isolation, duplicate joins and stale entry responses passed.',
);
