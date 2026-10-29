// Exercise the delivered student composition with delayed transport and inert views.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const noops = 'new Proxy({}, {get:()=>()=>{}})';
const mocks = {
  './shared/resource-preloader.js': `export const createResourcePreloader=()=>${noops};export const taskResourceHints=()=>[];`,
  './shared/poll-scheduler.js':
    'export const createPollScheduler=({run})=>{__refresh=run;return {refresh:run};};',
  './shared/student-viewport.js': 'export const installStudentViewport=()=>{};',
  './shared/context-help.js': 'export const installContextHelp=()=>{};',
  './race/showtime.js': `export const createRaceShowtime=()=>${noops};`,
  './race/exercises.js': `export const createExerciseController=()=>${noops};`,
  './shared/dom.js':
    'export const makeElement=(tag,text)=>__node(tag,text);export const setTextIfChanged=(node,text)=>{node.textContent=text};export const setAttributeIfChanged=()=>{};',
  './race/rewards.js': `export const createRewardFeedback=()=>${noops};`,
  './race/teacher.js': 'export const createTeacherRaceView=()=>{};',
  './race/items.js': 'export const createItemRoulette=()=>({itemArt:{},cancel(){},rolling:false});',
  './race/api.js': 'export const createRaceApi=()=>__api;',
  './race/views.js': `export const createRaceViews=()=>${noops};`,
  './race/lifecycle.js': readFileSync('public/race/lifecycle.js', 'utf8'),
  './race/student-controller.js': readFileSync('public/race/student-controller.js', 'utf8'),
  './race/review.js': `export const createWaitingReview=()=>${noops};`,
  './race/briefing.js': 'export const renderRaceBriefing=()=>{};',
  './race/teacher-controller.js': 'export const createTeacherRaceController=()=>{};',
};
const compiled = await build({
  stdin: { contents: readFileSync('public/race.js', 'utf8'), resolveDir: process.cwd() },
  bundle: true,
  write: false,
  format: 'iife',
  plugins: [
    {
      name: 'inert-views',
      setup(b) {
        b.onResolve({ filter: /^\.\// }, ({ path }) => {
          assert.ok(path in mocks, path);
          return { path, namespace: 'mock' };
        });
        b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({
          contents: mocks[path],
          loader: 'js',
        }));
      },
    },
  ],
});
class Node {
  constructor(tag = '', text = '') {
    this.tag = tag;
    this.textContent = text || '';
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList = { contains: () => false, toggle() {}, add() {}, remove() {} };
    this.value = '';
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  querySelectorAll() {
    return [];
  }
  setAttribute() {}
  addEventListener() {}
  scrollIntoView() {}
  focus() {}
}
const task = (id) => ({
  id,
  mode: 'text',
  prompt: id,
  spoken: 'cat',
  options: [{ value: '猫' }, { value: '犬' }],
});
const initial = {
  race: {
    id: 'race-one',
    station: 0,
    status: 'running',
    rules: 6,
    endless: true,
    total: 72,
    stationQuestions: 24,
    settings: { items: [], itemEvery: 6, minutes: 6, grade: 5, unit: '1', correctPoints: 100 },
  },
  self: {
    id: 'racer',
    alias: 'R1',
    label: '1',
    avatar: 'cat',
    index: 0,
    stationIndex: 0,
    score: 0,
    remaining: 360000,
    ready: true,
    done: false,
    task: task('first'),
  },
  board: [],
};
const afterAnswer = {
  ...initial,
  self: { ...initial.self, task: task('second'), index: 1, stationIndex: 1, score: 100 },
  receipt: { id: 'receipt', correct: true, points: 100 },
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const nodes = new Map();
const node = (tag, text) => new Node(tag, text);
const q = (selector) => {
  if (!nodes.has(selector)) nodes.set(selector, node());
  return nodes.get(selector);
};
const saved = new Map([
  ['aomi.race.session', JSON.stringify({ token: 'token', raceId: 'race-one', label: '1' })],
]);
let nextMe = () => Promise.resolve(initial),
  answers = 0;
const context = {
  document: {
    hidden: false,
    body: node(),
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector: q,
  },
  window: { addEventListener() {}, innerHeight: 768 },
  location: { search: '', pathname: '/race' },
  localStorage: { getItem: (k) => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) },
  Audio: class {
    pause() {}
  },
  URLSearchParams,
  Date,
  console,
  raceAvatarCatalog: [{ id: 'cat', name: 'cat' }],
  curriculumLabel: () => 'Grade 5 · Unit 1',
  appSettings: { values: {} },
  interactionEffects: new Proxy({}, { get: () => () => {} }),
  raceSessionCache: { save() {} },
  setInterval() {},
  setTimeout() {},
  clearTimeout() {},
  __node: node,
  __api: (path) => {
    if (path === '/api/race/me') return nextMe();
    if (path === '/api/race/answer') {
      answers++;
      return Promise.resolve(afterAnswer);
    }
    throw Error(path);
  },
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
vm.runInNewContext(compiled.outputFiles[0].text, context, { timeout: 1000 });
await flush();
assert.equal(q('#race-prompt').textContent, 'first');
const stale = deferred();
nextMe = () => stale.promise;
const polling = context.__refresh();
q('#race-options').children[0].onclick();
q('#race-submit').onclick();
await flush();
assert.equal(answers, 1);
assert.equal(q('#self-score').textContent, '100 pt');
stale.resolve(initial);
await polling;
assert.equal(
  q('#self-score').textContent,
  '100 pt',
  'A pre-answer poll cannot roll back the accepted score',
);
nextMe = () => Promise.resolve(afterAnswer);
q('#race-next').onclick();
await flush();
assert.equal(
  q('#race-prompt').textContent,
  'second',
  'Next keeps the accepted response task, not the stale poll task',
);
console.log(
  'Race poll ownership: a delayed pre-answer poll cannot roll back score or restore an answered question.',
);
