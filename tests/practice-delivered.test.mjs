// Execute the actual classic classroom bundle against the real local Worker API.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
async function request(path, data, headers = {}) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  const body = await response.clone().json();
  if (!response.ok) throw Object.assign(Error(body.error), body, { status: response.status });
  return { body, response };
}
const login = await request('/api/teacher/login', { password: 'test-password' });
const cookie = login.response.headers.get('set-cookie').split(';')[0];
const room = (
  await request(
    '/api/teacher/classes',
    { grade: 6, unit: '2', format: 'classic', roundSize: 4 },
    { cookie },
  )
).body;
const nodes = new Map(),
  disk = new Map();
const q = (selector) => {
  if (!nodes.has(selector))
    nodes.set(selector, {
      value: '',
      open: false,
      hidden: false,
      disabled: false,
      classList: { toggle() {} },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      addEventListener() {},
      focus() {},
    });
  return nodes.get(selector);
};
const storage = {
  getItem: (k) => disk.get(k) ?? null,
  setItem: (k, v) => disk.set(k, v),
  removeItem: (k) => disk.delete(k),
};
let entered = 0,
  onSaved;
const saved = new Promise((resolve) => {
  onSaved = resolve;
});
const context = vm.createContext({
  document: { hidden: false, querySelector: q },
  window: {
    addEventListener() {},
    enterApp() {
      entered++;
    },
    dispatchEvent(event) {
      if (event.type === 'aomi-practice-saved') onSaved();
    },
  },
  location: { search: '?class=' + room.id },
  localStorage: storage,
  sessionStorage: storage,
  vocabulary: [],
  builtinVocabulary: [],
  URLSearchParams,
  setInterval() {},
  CustomEvent: class {
    constructor(type) {
      this.type = type;
    }
  },
  aomiNetwork: {
    async request(path, data, options) {
      return (
        await request(path, data, options.token ? { authorization: 'Bearer ' + options.token } : {})
      ).body;
    },
  },
});
const source = await worker.fetch(new Request('https://classroom.test/classroom.js'), {});
vm.runInContext(await source.text(), context, { timeout: 1000 });
const classroom = vm.runInContext('classroom', context);
await classroom.openJoin();
assert.equal(q('#join-submit').disabled, false);
q('#attendance-number').value = '58';
const event = { preventDefault() {} };
await q('#join-form').onsubmit(event);
await q('#join-form').onsubmit(event);
assert.equal(entered, 1);
assert.equal(classroom.current.label, '58');
assert.equal(context.vocabulary.length, 21);
const lesson = await classroom.start(null);
assert.ok(lesson.queue.length);
const task = lesson.queue[0],
  word = context.vocabulary.find((w) => w.word === task.word);
const answer =
  task.mode === 'text' ? [word.meaning] : task.mode === 'voice' ? [word.word] : word.word;
classroom.saveDraft({ questionId: task.id, choices: [], answers: [] });
assert.equal(classroom.draft(task.id).questionId, task.id);
assert.equal(classroom.record(task.id, answer), true);
let timeout;
try {
  await Promise.race([
    saved,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(Error('answer did not save')), 5000);
    }),
  ]);
} finally {
  clearTimeout(timeout);
}
const next = classroom.takeLesson();
assert.equal(next.attempts, 1);
assert.equal(next.lastCorrect, true);
assert.equal(classroom.takeLesson(), null);
assert.equal(classroom.busy, false);
assert.equal(classroom.draft(task.id), null);
assert.equal(
  [...disk.keys()].some((k) => k.startsWith('aomi.pending.')),
  false,
);
console.log(
  'Delivered practice classroom: classic-script boot, real QR class join, curriculum, start, draft, durable answer, saved event and one-time next-lesson handoff passed.',
);
