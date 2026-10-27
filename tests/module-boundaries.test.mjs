import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import { course } from '../public/learning/course.js';
import { createEditorRoute } from '../editor-server.mjs';

// Exercise the actual classic-script facade delivered to existing practice pages.
const response = await worker.fetch(new Request('https://classroom.test/course.js'), {});
assert.equal(response.status, 200);
const browser = vm.createContext({ window: {}, crypto: globalThis.crypto });
vm.runInContext(await response.text(), browser);
const client = browser.window.course;
assert.equal(typeof client.create, 'function');
assert.equal(typeof client.stats, 'function');
const words = ['ate', 'read', 'wrote', 'bought'].map((word) => ({ word, meaning: word }));
const lesson = course.create(words, ['text', 'voice', 'spelling'], 4);
const browserLesson = structuredClone(lesson);
const snapshot = (value) =>
  JSON.parse(JSON.stringify(value, (key, field) => (key === 'id' ? undefined : field)));
let steps = 0;
while (lesson.queue.length) {
  const correct = steps % 3 !== 0;
  const hinted = correct && steps % 5 === 0;
  course.advance(lesson, correct, hinted);
  client.advance(browserLesson, correct, hinted);
  assert.deepEqual(
    snapshot(browserLesson),
    snapshot(lesson),
    'browser and server must use identical lesson transitions apart from new review UUIDs',
  );
  assert.ok(++steps < 30);
}

// Authorization stays before configuration/audio writes after extraction.
let touched = false;
const editor = createEditorRoute({
  teacher: async () => false,
  stmt() {
    touched = true;
    throw Error('unexpected write');
  },
  loadConfig() {
    touched = true;
    throw Error('unexpected config load');
  },
  supplementUnitFive() {
    touched = true;
  },
  json: (data, status) => new Response(JSON.stringify(data), { status }),
});
for (const path of ['/api/teacher/config', '/api/teacher/config/audio']) {
  const request = new Request('https://classroom.test' + path, { method: 'POST', body: '{}' });
  assert.equal((await editor(request, {}, new URL(request.url))).status, 401);
}
assert.equal(touched, false);
console.log(
  'PASS: delivered classic-script learning facade and server lesson transitions, editor authorization before writes.',
);
