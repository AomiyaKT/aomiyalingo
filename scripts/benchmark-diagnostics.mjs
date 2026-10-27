// Synthetic CPU comparison only; neither database nor network latency is measured.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { learningDiagnostics as current } from '../public/learning/diagnostics.js';
import { learningDiagnostics as reference } from '../tests/references/diagnostics-v58.mjs';

const modes = ['text', 'voice', 'spelling', 'match', 'sentence', 'fill', 'listen-fill'];
const words = Array.from({ length: 80 }, (_, i) => ({ word: 'word-' + i, meaning: '意味' + i }));
const learners = Array.from({ length: 35 }, (_, i) => {
  const student = { id: 'student-' + i };
  return {
    student,
    attempts: Array.from({ length: 2400 }, (_, n) => ({
      student_id: student.id,
      word: words[n % words.length].word,
      mode: modes[n % modes.length],
      created: (n * 137) % 991,
      sequence: n,
      correct: (n + i) % 5 ? 1 : 0,
      hint_used: n % 17 === 0 ? 1 : 0,
      is_review: n % 11 === 0 ? 1 : 0,
    })),
  };
});
const calculate = (model) =>
  learners.map(({ student, attempts }) => ({
    ...student,
    ...model.stats(student, attempts, words, modes),
  }));
const summaries = calculate(current);
assert.deepEqual(summaries, calculate(reference));
assert.deepEqual(
  current.teachingSummary(summaries, words),
  reference.teachingSummary(summaries, words),
);
function measure(run) {
  for (let i = 0; i < 10; i++) run();
  const samples = Array.from({ length: 60 }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return { median_ms: +samples[30].toFixed(3), p95_ms: +samples[57].toFixed(3) };
}
const result = {
  workload: {
    learners: learners.length,
    words: words.length,
    types: modes.length,
    attempts_each: 2400,
    samples: 60,
  },
  stats_v58: measure(() => calculate(reference)),
  stats_v59: measure(() => calculate(current)),
  teaching_summary_v58: measure(() => reference.teachingSummary(summaries, words)),
  teaching_summary_v59: measure(() => current.teachingSummary(summaries, words)),
};
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0)
  writeFileSync(process.argv[outputIndex + 1], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
