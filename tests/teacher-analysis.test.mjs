import assert from 'node:assert/strict';
import { masterySummary } from '../public/practice/teacher-analysis-model.js';
import { createTeacherAnalysis } from '../public/practice/teacher-analysis.js';
import { learnerLevel } from '../public/learning/exercises.js';

const states = ['unanswered', 'correct', 'wrong', 'corrected'];
const words = Array.from({ length: 37 }, (_, i) => ({ word: 'word' + i, meaning: '意味' + i }));
const modes = [
  'text',
  'voice',
  'spelling',
  'match',
  'sentence',
  'cloze',
  'audioMatch',
  'audioSentence',
  'audioCloze',
  'dictation',
];
const students = Array.from({ length: 35 }, (_, n) => ({
  id: 's' + n,
  skills: words.map((w, i) => ({
    word: w.word,
    modes: Object.fromEntries(modes.map((mode, m) => [mode, { state: states[(n + i + m) % 4] }])),
  })),
}));
for (const adaptive of [false, true]) {
  const prior = words.flatMap((word) => {
    if (
      adaptive &&
      !students.some((s) =>
        Object.values(s.skills.find((w) => w.word === word.word).modes).some(
          (m) => m.state !== 'unanswered',
        ),
      )
    )
      return [];
    const counts = {};
    for (const mode of modes) {
      const values = students.map(
        (s) => s.skills.find((w) => w.word === word.word).modes[mode].state,
      );
      if (adaptive && values.every((s) => s === 'unanswered')) continue;
      counts[mode] = Object.fromEntries(
        states.map((state) => [state, values.filter((s) => s === state).length]),
      );
    }
    return [{ word: word.word, modes: counts }];
  });
  assert.deepEqual(masterySummary(students, words, modes, adaptive), prior);
}
assert.equal(masterySummary([{ skills: [] }], words, ['text'])[0].modes.text.unanswered, 1);
assert.deepEqual(masterySummary([{ skills: [] }], words, modes, true), []);
for (const length of [0, 1, 4, 8, 19, 180, 10000]) {
  const history = Array.from({ length }, (_, i) => ({
    review: i % 5 === 0,
    correct: i % 7 !== 0,
    hinted: i % 13 === 0,
  }));
  const before = JSON.stringify(history);
  for (const station of [0, 1, 2]) {
    const recent = history.filter((h) => !h.review).slice(-8);
    const ratio = recent.filter((h) => h.correct && !h.hinted).length / recent.length;
    const expected =
      station === 0 || recent.length < 4
        ? 1
        : ratio >= 0.8
          ? Math.min(3, station + 1)
          : ratio >= 0.6
            ? 2
            : 1;
    assert.equal(learnerLevel(history, station), expected);
  }
  assert.equal(JSON.stringify(history), before);
}
let reads = 0;
const history = new Proxy(
  Array.from({ length: 10000 }, () => ({ correct: true })),
  {
    get(target, key) {
      if (/^\d+$/.test(String(key))) reads++;
      return target[key];
    },
  },
);
assert.equal(learnerLevel(history, 0), 1);
assert.equal(reads, 0);
assert.equal(learnerLevel(history, 2), 3);
assert.equal(reads, 8, 'recent-level calculation does not rescan completed non-review history');

const nodes = new Map();
function node(tag, text, className) {
  return {
    tag,
    text,
    className,
    children: [],
    replacements: 0,
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren(...items) {
      this.replacements++;
      this.children = items;
    },
    get childElementCount() {
      return this.children.length;
    },
  };
}
const q = (id) => {
  if (!nodes.has(id)) nodes.set(id, node('section'));
  return nodes.get(id);
};
const originalDocument = globalThis.document;
globalThis.document = { body: { dataset: { practiceFormat: 'classic' } } };
try {
  const vocabulary = [{ word: 'cat', meaning: '猫' }];
  const student = {
    id: 'one',
    label: '1',
    firstAccuracy: 0,
    needsHelp: 1,
    corrected: 0,
    supported: 0,
    skills: [{ word: 'cat', modes: { text: { state: 'wrong' } } }],
  };
  let data = {
      classroom: { id: 'class-one' },
      students: [student],
      attempts: [
        {
          student_id: 'one',
          label: '1',
          word: 'cat',
          mode: 'text',
          correct: false,
          answer: '["犬"]',
        },
      ],
    },
    selected = 'one';
  const view = createTeacherAnalysis({
    q,
    make: node,
    modeNames: { text: '意味' },
    getVocabulary: () => vocabulary,
    getData: () => data,
    getSelectedStudent: () => selected,
    getClassVocabulary: () => vocabulary,
    getConfiguredModes: () => ['text'],
  });
  view.renderDetail();
  view.renderMastery(data.students);
  const detail = q('#student-detail'),
    mastery = q('#word-mastery'),
    heading = detail.children[0];
  data = structuredClone(data);
  data.students[0].lastSeen = Date.now();
  data.updated = Date.now();
  view.renderDetail();
  view.renderMastery(data.students);
  assert.equal(detail.replacements, 1);
  assert.equal(mastery.replacements, 1);
  assert.equal(detail.children[0], heading, 'unchanged polls preserve the reading DOM');
  data.attempts.push({ ...data.attempts[0], answer: '["猫"]', correct: true });
  data.students[0].skills[0].modes.text.state = 'corrected';
  view.renderDetail();
  view.renderMastery(data.students);
  assert.equal(detail.replacements, 2);
  assert.equal(mastery.replacements, 2);
  data.classroom.id = 'class-two';
  view.renderDetail();
  view.renderMastery(data.students);
  assert.equal(detail.replacements, 3);
  assert.equal(mastery.replacements, 3, 'new classrooms invalidate the view');
  selected = null;
  view.renderDetail();
  assert.equal(detail.children.length, 0);
} finally {
  globalThis.document = originalDocument;
}
console.log(
  'Teacher analysis: legacy-equivalent mastery, sparse skills, bounded recent-history reads, unchanged-poll DOM preservation, answer/class invalidation and selection clearing passed.',
);
