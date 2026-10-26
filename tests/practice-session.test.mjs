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
  joinCalls = [];
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
  entries = 0;
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
      return Promise.resolve({
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
console.log(
  'Practice classroom session: saved-session recovery, scoped vocabulary, old-token/status isolation, duplicate joins and stale entry responses passed.',
);
