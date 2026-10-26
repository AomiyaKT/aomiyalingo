// Reproducible synthetic CPU workload. No network, database writes or production data.
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createRaceRules } from '../server/race/rules.mjs';
import { recordSummary } from '../public/race/records.js';
import { createRecordStore } from '../public/race/record-model.js';
import { learningDiagnostics } from '../public/learning/diagnostics.js';

const stamp = 1800000000000;
const words = Array.from({ length: 28 }, (_, i) => ({ word: 'word' + i, meaning: 'meaning' + i }));
const settings = {
  endless: true,
  format: 'adaptive-four',
  modes: ['text', 'voice', 'spelling'],
  questions: 24,
  questionsPerStation: 24,
  minutes: 6,
  goalPercent: 50,
};
const room = {
  id: 'benchmark',
  tasks: JSON.stringify([{ rules: 6, settings, pool: words }]),
  status: 'running',
  station: 2,
  started_at: stamp - 10000,
  remaining_ms: 360000,
  elapsed_ms: 0,
};
const players = Array.from({ length: 35 }, (_, n) => {
  const history = Array.from({ length: 180 }, (_, i) => ({
    id: `${n}-${i}`,
    word: words[i % 28].word,
    mode: ['text', 'voice', 'spelling', 'match'][i % 4],
    station: Math.floor(i / 60),
    correct: (i + n) % 5 !== 0,
    hinted: i % 13 === 0,
    review: i % 17 === 0,
    points: (i + n) % 5 ? 100 : 0,
  }));
  const state = {
    history,
    correct: history.filter((h) => h.correct && !h.hinted && !h.review).length,
    score: history.reduce((n, h) => n + h.points, 0),
    index: 60,
    deckSeed: 'seed-' + n,
    ready: true,
    wrong: [],
  };
  return {
    id: 'student-' + n,
    label: String(n + 1),
    number: n + 1,
    state: JSON.stringify(state),
    history,
    score: state.score,
  };
});
const rules = createRaceRules({
  words,
  raceAvatarCatalog: [],
  shuffle: (a) => a,
  spellingCharacters: (s) => [...s],
  now: () => stamp,
});
const recordStore = createRecordStore();
const recordFrame = {
  race: { id: 'benchmark' },
  players: players.map((p) => ({ ...p, recordRevision: 1 })),
};
recordStore.update(recordFrame);
recordStore.summaries();
const students = players.map((p) => ({
  skills: words.map((w) => ({
    word: w.word,
    modes: Object.fromEntries(
      ['text', 'voice', 'spelling'].map((mode) => [
        mode,
        { state: 'correct', firstCorrect: true, latestHinted: false },
      ]),
    ),
  })),
}));
function measure(run, samples = 120) {
  for (let i = 0; i < 15; i++) run();
  const times = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    median_ms: +times[Math.floor(samples / 2)].toFixed(3),
    p95_ms: +times[Math.floor(samples * 0.95)].toFixed(3),
  };
}
const report = {
  workload: { learners: 35, answers_each: 180, samples: 120 },
  race_board: measure(() => {
    const r = { ...room },
      rows = players.map((p) => ({ ...p }));
    rules.raceRanking(rows, r);
    rules.stationResults(rows, r);
  }),
  record_summaries: measure(() => {
    for (const station of ['all', '0', '1', '2']) players.map((p) => recordSummary(p, station));
  }),
  teaching_summary: measure(() => learningDiagnostics.teachingSummary(students, words)),
  unchanged_record_poll: measure(() => {
    recordStore.update({ ...recordFrame, players: recordFrame.players.map((p) => ({ ...p })) });
    recordStore.summaries();
  }),
};
console.log(JSON.stringify(report, null, 2));
const output = process.argv.indexOf('--output');
if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
