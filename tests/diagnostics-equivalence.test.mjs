import assert from 'node:assert/strict';
import { learningDiagnostics as current } from '../public/learning/diagnostics.js';
import { learningDiagnostics as reference } from './references/diagnostics-v58.mjs';

let seed = 59;
const random = (n) => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
const words = Array.from({ length: 18 }, (_, i) => ({ word: 'word-' + i, meaning: '意味' + i }));
const modes = ['text', 'voice', 'spelling', 'match', 'sentence', 'listen-fill', 'fill'];
const students = Array.from({ length: 9 }, (_, i) => ({ id: 'student-' + i }));
for (let round = 0; round < 36; round++) {
  const attempts = Array.from({ length: random(1800) }, (_, i) => ({
    student_id: students[random(students.length)].id,
    word: words[random(words.length)].word,
    mode: modes[random(modes.length)],
    created: random(30),
    sequence: i % 5 ? random(9) : undefined,
    correct: random(2),
    hint_used: random(4) === 0 ? 1 : 0,
    is_review: random(3) === 0 ? 1 : 0,
  }));
  const before = structuredClone(attempts);
  const observed = students.map((student) => {
    const stats = current.stats(student, attempts, words, modes);
    assert.deepEqual(
      stats,
      reference.stats(student, attempts, words, modes),
      'mixed chronological history',
    );
    return { ...student, ...stats };
  });
  assert.deepEqual(attempts, before, 'aggregation never reorders or mutates history');
  // Preserve first-match behavior for duplicate skill rows, and mode discovery
  // from rows which are not the selected word or have no answers yet.
  observed[0].skills.push({ word: words[0].word, modes: { future: { state: 'wrong' } } });
  observed.push({ id: 'absent' }, { skills: [] });
  assert.deepEqual(
    current.teachingSummary(observed, words),
    reference.teachingSummary(observed, words),
  );
}
const sameTime = [
  { student_id: 'a', word: 'tie', mode: 'text', correct: 0, created: 10 },
  {
    student_id: 'a',
    word: 'tie',
    mode: 'text',
    correct: 1,
    created: 10,
    sequence: 0,
    hint_used: 1,
  },
];
assert.deepEqual(
  current.stats({ id: 'a' }, sameTime, [{ word: 'tie' }]),
  reference.stats({ id: 'a' }, sameTime, [{ word: 'tie' }]),
);
assert.equal(
  current.stats({ id: 'a' }, sameTime, [{ word: 'tie' }]).skills[0].modes.text.state,
  'corrected',
);
assert.deepEqual(
  current.stats({ id: 'nobody' }, [], words, []),
  reference.stats({ id: 'nobody' }, [], words, []),
);
assert.deepEqual(current.teachingSummary([], words), reference.teachingSummary([], words));
console.log(
  'Diagnostics: 36 seeded mixed histories match frozen v58; stable ties, hints, reviews, duplicate skills, absent learners and input immutability passed.',
);
