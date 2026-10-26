import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequest } from '../public/shared/request.js';
import { studentPhase, courseSummary } from '../public/race/lifecycle.js';

const snapshot = (status, self = {}) => ({
  race: { status, station: 0 },
  self: { ready: true, prepared: true, task: { id: 'a' }, ...self },
});
assert.equal(studentPhase(null), 'entry');
assert.equal(studentPhase(snapshot('lobby', { prepared: false })), 'prepare');
assert.equal(studentPhase(snapshot('lobby')), 'ready');
assert.equal(studentPhase(snapshot('countdown')), 'countdown');
assert.equal(studentPhase(snapshot('running', { ready: false })), 'prepare');
assert.equal(studentPhase(snapshot('running')), 'question');
assert.equal(studentPhase(snapshot('paused')), 'paused');
assert.equal(studentPhase(snapshot('intermission', { done: true })), 'results');
assert.equal(studentPhase(snapshot('running', { done: true })), 'courseDone');
assert.equal(studentPhase(snapshot('finished', { ready: false })), 'finished');
assert.equal(studentPhase(snapshot('running', { task: null }), true), 'question');
const summary = courseSummary(
  snapshot('intermission', {
    history: [
      { word: 'ate', station: 0, correct: true, points: 100 },
      { word: 'ate', station: 0, correct: true, hinted: true, points: 60 },
      { word: 'won', station: 0, correct: false, points: 0 },
      { word: 'won', station: 0, review: true, correct: true, points: 40 },
      { word: 'smart', station: 1, correct: true, points: 200 },
    ],
  }),
);
assert.equal(summary.answered, 3);
assert.equal(summary.independent, 1);
assert.equal(summary.accuracy, 33);
assert.equal(summary.points, 200);
assert.deepEqual(
  summary.review.map((h) => h.word),
  ['ate', 'won'],
);

let options;
const connection = [];
const request = createRequest({
  fetch: async (path, init) => {
    options = init;
    return new Response(JSON.stringify({ saved: true }), { status: 200 });
  },
  onConnection: (ok) => connection.push(ok),
});
assert.deepEqual(await request('/x', { answer: 'ate' }, { token: 'test-token' }), { saved: true });
assert.equal(options.headers.authorization, 'Bearer test-token');
assert.equal(options.method, 'POST');
assert.deepEqual(JSON.parse(options.body), { answer: 'ate' });
const denied = createRequest({
  fetch: async () =>
    new Response(JSON.stringify({ error: '一時停止中', code: 'CLASS_PAUSED' }), { status: 423 }),
});
await assert.rejects(denied('/x'), (e) => e.status === 423 && e.code === 'CLASS_PAUSED');
const broken = createRequest({
  fetch: async () => {
    throw Error('network');
  },
  onConnection: (ok) => connection.push(ok),
});
await assert.rejects(broken('/x'), /接続を確認/);
assert.equal(connection.at(-1), false);
const timeout = createRequest({
  timeout: 5,
  fetch: async (path, init) =>
    new Promise((resolve, reject) =>
      init.signal.addEventListener('abort', () => reject(Error('timeout'))),
    ),
});
await assert.rejects(timeout('/x'), /接続を確認/);
for (const file of ['index', 'teacher', 'teacher-editor', 'race', 'race-teacher']) {
  const html = readFileSync('public/' + file + '.html', 'utf8');
  assert.match(html, /\/network\.js\?v=[\w.-]+/, file + ' versioned shared network must load');
  const lastScript = html.indexOf(
    '/' +
      {
        index: 'classroom',
        teacher: 'teacher',
        'teacher-editor': 'teacher-editor',
        race: 'race',
        'race-teacher': 'race',
      }[file] +
      '.js?',
  );
  assert.ok(html.indexOf('/network.js?') < lastScript, file + ' network before app');
  assert.equal(
    (html.match(/<link rel="stylesheet"/g) || []).length,
    1,
    file + ' uses one page stylesheet',
  );
  assert.ok(html.includes('/ui/'), file + ' uses the unified UI');
}
console.log(
  'PASS: student lifecycle priority, non-scoring course summary, shared HTTP errors/auth/timeout and cache-safe script ordering for all pages.',
);
