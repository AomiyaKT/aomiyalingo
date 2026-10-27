import assert from 'node:assert/strict';
import { compactRaceRecords } from '../server/race/record-sync.mjs';
import { recordSyncQuery, restoreRaceRecords } from '../public/shared/race-record-sync.js';

const frame = {
  race: { id: 'r1', status: 'running' },
  players: Array.from({ length: 35 }, (_, i) => ({
    id: 'p' + i,
    label: String(i + 1),
    score: 10000,
    remaining: 300000,
    recordRevision: 180,
    history: Array.from({ length: 180 }, (_, n) => ({
      word: 'home economics',
      mode: 'spelling',
      answer: 'home economics',
      expected: 'home economics',
      station: Math.floor(n / 60),
      correct: true,
      points: 100,
    })),
  })),
};
const url = (query) => new URL('https://local.test/api/teacher/race/board?race=r1' + query);
const query = recordSyncQuery(frame);
const compact = compactRaceRecords(frame, url(query));
assert.equal(
  compact.players.some((p) => 'history' in p),
  false,
);
assert.deepEqual(restoreRaceRecords(compact, frame), frame);
assert.equal(
  restoreRaceRecords(compact, frame).players[0].history,
  frame.players[0].history,
  'Reuse immutable history arrays, no clone or serialization',
);
const changed = {
  ...frame,
  players: frame.players.map((p, i) =>
    i
      ? p
      : { ...p, recordRevision: 181, history: [...p.history, { word: 'math', correct: false }] },
  ),
};
const delta = compactRaceRecords(changed, url(query));
assert.equal(delta.players.filter((p) => 'history' in p).length, 1);
assert.deepEqual(restoreRaceRecords(delta, frame), changed);
assert.equal(frame.players[0].history.length, 180, 'No old snapshot mutation');
assert.equal(compactRaceRecords(frame, url('')), frame, 'Old clients receive the full response');
for (const raw of [
  'null',
  '["r2",[]]',
  '{}',
  '["r1",null]',
  'not json',
  JSON.stringify(['r1', Array(61).fill(['p0', 180])]),
])
  assert.equal(compactRaceRecords(frame, url('&records=' + encodeURIComponent(raw))), frame);
assert.equal(
  recordSyncQuery({ race: frame.race, players: frame.players.map(({ history, ...p }) => p) }),
  '',
  'No cached histories means a full bootstrap',
);
assert.throws(() => restoreRaceRecords(compact, { ...frame, race: { id: 'r2' } }), /再読み込み/);
assert.throws(() => restoreRaceRecords(compact, changed), /再読み込み/);
const ratio = Buffer.byteLength(JSON.stringify(compact)) / Buffer.byteLength(JSON.stringify(frame));
assert.ok(ratio < 0.02, '35 learners × 180 answers: unchanged record payload shrinks by over 98%');
console.log(
  'Record sync: full bootstrap, revision deltas, same-race ownership, immutable history reuse, malformed input, legacy clients passed.',
);
console.log(
  JSON.stringify({
    learners: 35,
    answersEach: 180,
    fullBytes: Buffer.byteLength(JSON.stringify(frame)),
    unchangedBytes: Buffer.byteLength(JSON.stringify(compact)),
    oneChangedBytes: Buffer.byteLength(JSON.stringify(delta)),
    reductionPercent: +((1 - ratio) * 100).toFixed(2),
  }),
);
