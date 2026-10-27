// Local CPU comparison against the pre-v57 algorithms, with identical synthetic input.
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { masterySummary } from '../public/practice/teacher-analysis-model.js';
import { learnerLevel } from '../public/learning/exercises.js';

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
const states = ['unanswered', 'correct', 'wrong', 'corrected'];
const words = Array.from({ length: 80 }, (_, n) => ({ word: 'word' + n }));
const students = Array.from({ length: 35 }, (_, n) => ({
  skills: words.map((w, i) => ({
    word: w.word,
    modes: Object.fromEntries(
      modes.map((mode, j) => [mode, { state: states[(n + i + j) % states.length] }]),
    ),
  })),
}));
const history = Array.from({ length: 10000 }, (_, i) => ({
  correct: i % 7 !== 0,
  hinted: i % 13 === 0,
  review: i % 11 === 0,
}));
function previousMastery() {
  return words.flatMap((word) => {
    if (
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
      if (values.every((state) => state === 'unanswered')) continue;
      counts[mode] = Object.fromEntries(
        states.map((state) => [state, values.filter((s) => s === state).length]),
      );
    }
    return [{ word: word.word, modes: counts }];
  });
}
function previousLevel() {
  const recent = history.filter((h) => !h.review).slice(-8);
  const independent = recent.filter((h) => h.correct && !h.hinted).length / recent.length;
  return independent >= 0.8 ? 3 : independent >= 0.6 ? 2 : 1;
}
const currentMastery = () => masterySummary(students, words, modes, true);
assert.deepEqual(currentMastery(), previousMastery());
assert.equal(learnerLevel(history, 2), previousLevel());
function measure(run) {
  for (let i = 0; i < 15; i++) run();
  const times = [];
  for (let i = 0; i < 120; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { median_ms: +times[60].toFixed(3), p95_ms: +times[114].toFixed(3) };
}
const batch = (run) => () => {
  for (let i = 0; i < 35; i++) run();
};
const report = {
  workload: {
    learners: 35,
    words: 80,
    modes: modes.length,
    history_entries: history.length,
    samples: 120,
    scope: 'local Node CPU; no DOM, network, database or production data',
  },
  previous_mastery: measure(previousMastery),
  indexed_mastery: measure(currentMastery),
  previous_level_35_calls: measure(batch(previousLevel)),
  bounded_level_35_calls: measure(batch(() => learnerLevel(history, 2))),
};
console.log(JSON.stringify(report, null, 2));
const output = process.argv.indexOf('--output');
if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
