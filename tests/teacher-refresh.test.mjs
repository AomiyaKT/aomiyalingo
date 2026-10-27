import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import { course } from '../public/learning/course.js';

// Execute the delivered classic-script bundle, including its real roster adapter.
// Requests are deliberately held open so class switches can overtake responses.
function node(tag = 'div') {
  const names = new Set();
  const result = {
    tag,
    hidden: false,
    open: false,
    value: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    children: [],
    attributes: new Map(),
    classList: {
      contains: (name) => names.has(name),
      add: (name) => names.add(name),
      remove: (name) => names.delete(name),
      toggle(name, force) {
        const enabled = force ?? !names.has(name);
        enabled ? names.add(name) : names.delete(name);
        return enabled;
      },
    },
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren(...items) {
      this.children = items;
    },
    get firstChild() {
      return this.children[0];
    },
    get childElementCount() {
      return this.children.length;
    },
    querySelector(selector) {
      const value = selector.match(/^option\[value="(.*)"\]$/)?.[1];
      return this.children.find((child) => child.value === value) || null;
    },
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
    },
    getAttribute(key) {
      return this.attributes.get(key) ?? null;
    },
    addEventListener() {},
  };
  return result;
}
const elements = new Map();
const q = (selector) => {
  if (!elements.has(selector)) elements.set(selector, node());
  return elements.get(selector);
};
const requests = [];
const rooms = ['a', 'b'].map((id) => ({ id, title: 'Class ' + id, active: true, modes: '[]' }));
const redirects = [];
const context = {
  document: {
    hidden: false,
    body: node('body'),
    querySelector: q,
    querySelectorAll: () => [],
    createElement: node,
    addEventListener() {},
  },
  window: { addEventListener() {} },
  location: {
    pathname: '/teacher',
    origin: 'https://classroom.test',
    replace: (url) => redirects.push(url),
  },
  course,
  Date,
  console,
  vocabulary: [],
  builtinVocabulary: [],
  appSettings: { values: { reduceMotion: false } },
  interactionEffects: { sound() {} },
  aomiClassroomLink() {},
  curriculumSelection: () => ({ grade: 6, unit: '4-5', label: 'Unit 4–5' }),
  curriculumLabel: () => 'Unit 4–5',
  curriculumProfile: () => ({ words: [], course: { wordIds: [], modes: [], roundSize: 6 } }),
  setInterval() {},
  addEventListener() {},
  aomiNetwork: {
    async request(path) {
      if (path === '/api/teacher/config') return { config: {} };
      if (path === '/api/teacher/classes') return { classes: rooms, trash: [] };
      assert.match(path, /^\/api\/teacher\/progress\?class=[ab]$/);
      return new Promise((resolve, reject) => requests.push({ path, resolve, reject }));
    },
  },
};
const script = await worker.fetch(new Request('https://classroom.test/teacher.js'), {});
assert.equal(script.status, 200);
vm.runInNewContext(await script.text(), context, { timeout: 1000 });
const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const progress = (room) => ({ classroom: room, students: [], attempts: [], updated: Date.now() });
await settle();
assert.equal(requests.length, 1);
assert.match(requests[0].path, /class=a$/);

q('#class-select').value = 'b';
q('#class-select').onchange();
q('#refresh-board').onclick();
assert.equal(requests.length, 1, 'No overlapping progress requests');
requests[0].reject(Object.assign(Error('old authorization failure'), { status: 401 }));
await settle();
assert.equal(q('#teacher-board').hidden, false, 'Stale failures cannot log out the new class');
assert.equal(requests.length, 2, 'The latest class refreshes immediately after the old request');
assert.match(requests[1].path, /class=b$/);
requests[1].resolve(progress(rooms[1]));
await settle();
assert.equal(q('#tv-class-title').textContent, 'Class b');
assert.equal(
  q('#connection-status').textContent,
  '接続済み',
  'Polling does not announce a changing timestamp',
);
assert.match(q('#connection-status').dataset.help, /最終更新.*3秒/);
assert.match(q('#practice-next-step').dataset.help, /参加受付は締め切/);
assert.equal(
  q('#practice-next-step').textContent,
  '',
  'Help updates do not replace the compact help button',
);
assert.match(q('#pause-button').dataset.help, /一時停止/);

q('#class-select').value = 'a';
q('#class-select').onchange();
assert.equal(requests.length, 3);
q('#class-select').value = 'b';
q('#class-select').onchange();
requests[2].resolve(progress({ ...rooms[0], title: 'STALE CLASS' }));
await settle();
assert.equal(
  q('#tv-class-title').textContent,
  'Class b',
  'Stale successes cannot replace the board',
);
assert.equal(requests.length, 4);
assert.match(requests[3].path, /class=b$/);
requests[3].resolve(progress({ ...rooms[1], title: 'Current class' }));
await settle();
assert.equal(q('#tv-class-title').textContent, 'Current class');
q('#refresh-board').onclick();
requests[4].reject(Object.assign(Error('expired'), { status: 401 }));
await settle();
assert.equal(
  q('#teacher-board').hidden,
  true,
  'Current authorization failures still close teacher access',
);
assert.deepEqual(redirects, []);
console.log(
  'Delivered teacher bundle: classic-script startup, stale success/error isolation, immediate class-switch follow-up, one in-flight refresh and current authorization enforcement passed.',
);
