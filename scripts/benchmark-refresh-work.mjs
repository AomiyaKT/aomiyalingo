import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createRaceTaskReader } from '../server/race/task-reader.mjs';
import {
  createClassVocabularyReader,
  setTeacherText,
} from '../public/practice/teacher-render-state.js';
import { translateUI } from '../public/shared/i18n.js';

const words = Array.from({ length: 32 }, (_, i) => ({
  word: 'word' + i,
  meaning: 'Meaning ' + i,
  example: 'This is word' + i + '.',
  image: '/assets/vocabulary/g5-unit7/' + String(i + 1).padStart(2, '0') + '_word.png',
}));
const tasks = Array.from({ length: 72 }, (_, i) => ({
  id: 'task-' + i,
  rules: 6,
  station: Math.floor(i / 24),
  mode: ['text', 'voice', 'spelling', 'match'][i % 4],
  content: words[i % words.length],
  options: ['Meaning ' + (i % words.length), 'Other 1', 'Other 2', 'Other 3'],
  ...(i ? {} : { settings: { minutes: 6, endless: true }, pool: words }),
}));
const raw = JSON.stringify(tasks);
const vocabulary = JSON.stringify(words);

// Frozen previous algorithm: one parse per distinct DB row object per request.
function previousReader(parse = JSON.parse) {
  const rows = new WeakMap();
  return (room) => {
    const prior = rows.get(room);
    if (prior?.raw === room.tasks) return prior.tasks;
    const tasks = parse(room.tasks);
    rows.set(room, { raw: room.tasks, tasks });
    return tasks;
  };
}
function classroomBatch(read) {
  for (let i = 0; i < 35; i++) {
    const room = { id: 'room', tasks: Buffer.from(raw).toString('utf8') };
    assert.equal(read(room).length, 72);
    assert.equal(read(room)[0].rules, 6);
  }
}
const previous = previousReader(),
  current = createRaceTaskReader();
assert.deepEqual(current({ tasks: raw }), previous({ tasks: raw }));
let oldTaskParses = 0,
  newTaskParses = 0;
classroomBatch(
  previousReader((value) => {
    oldTaskParses++;
    return JSON.parse(value);
  }),
);
const countTasks = createRaceTaskReader({
  parse: (value) => {
    newTaskParses++;
    return JSON.parse(value);
  },
});
classroomBatch(countTasks);
const coldTaskParses = newTaskParses;
classroomBatch(countTasks);
const warmTaskParses = newTaskParses - coldTaskParses;
function measure(run) {
  for (let i = 0; i < 15; i++) run();
  const samples = [];
  for (let i = 0; i < 120; i++) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { medianMs: +samples[60].toFixed(4), p95Ms: +samples[114].toFixed(4) };
}
let previousParses = 0,
  currentParses = 0;
const readVocabulary = createClassVocabularyReader({
  fallback: [],
  parse: (raw) => {
    currentParses++;
    return JSON.parse(raw);
  },
});
for (let i = 0; i < 100; i++) {
  JSON.parse(vocabulary);
  previousParses++;
  readVocabulary(vocabulary);
}
let previousWrites = 0,
  currentWrites = 0;
const source = '練習を一時停止';
const translated = translateUI(source, 'en');
let text = translated;
let previousText = translated;
const oldNode = {
  get textContent() {
    return previousText;
  },
  set textContent(value) {
    previousWrites++;
    previousText = value;
  },
};
const node = {
  get textContent() {
    return text;
  },
  set textContent(value) {
    currentWrites++;
    text = value;
  },
};
for (let i = 0; i < 100; i++) {
  oldNode.textContent = source;
  oldNode.textContent = translateUI(oldNode.textContent, 'en');
  setTeacherText(node, source, 'en');
}
const report = {
  scope:
    'Synthetic local Node CPU/work counters only; no network, DB, browser FPS or physical iPad measurements',
  workload: {
    learners: 35,
    tasks: 72,
    taskSnapshotChars: raw.length,
    samples: 120,
    sourceStrings: 'fresh UTF-8 decoded string for each DB-like row',
  },
  raceTasks: {
    previous: measure(() => classroomBatch(previous)),
    warm: measure(() => classroomBatch(current)),
    cold: measure(() => classroomBatch(createRaceTaskReader())),
    previousParsesPer35FreshRows: oldTaskParses,
    coldParsesPer35FreshRows: coldTaskParses,
    warmParsesPer35FreshRows: warmTaskParses,
  },
  practice100UnchangedRefreshes: {
    previousVocabularyParses: previousParses,
    currentVocabularyParses: currentParses,
    previousEnglishLabelWrites: previousWrites,
    currentEnglishLabelWrites: currentWrites,
  },
};
console.log(JSON.stringify(report, null, 2));
const output = process.argv.indexOf('--output');
if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
