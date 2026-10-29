import assert from 'node:assert/strict';
import { createRaceTaskReader } from '../server/race/task-reader.mjs';
import { createRaceRules } from '../server/race/rules.mjs';
import { createRaceRepository } from '../server/race/repository.mjs';

let parses = 0;
const read = createRaceTaskReader({
  maxEntries: 2,
  maxChars: 1000,
  parse(raw) {
    parses++;
    return JSON.parse(raw);
  },
});
const raw = JSON.stringify([{ rules: 6, settings: { minutes: 6 }, pool: [{ word: 'cat' }] }]);
const row = { id: 'one', tasks: raw, status: 'running' };
const first = read(row);
for (let i = 0; i < 35 * 100; i++) {
  assert.equal(read({ id: 'one', tasks: raw, status: i % 2 ? 'running' : 'paused' }), first);
}
assert.equal(parses, 1, 'Fresh DB rows can reuse the exact immutable teaching snapshot');
assert.equal(read(row), first);
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first[0].pool[0]), true);
assert.throws(() => {
  first[0].settings.minutes = 99;
}, TypeError);
assert.throws(() => {
  first[0].pool.push({ word: 'dog' });
}, TypeError);
const other = raw.replace('cat', 'dog');
row.tasks = other;
assert.notEqual(read(row), first, 'Same row ID with new JSON invalidates immediately');
assert.equal(read(row)[0].pool[0].word, 'dog');
assert.equal(read({ id: 'unrelated', tasks: raw }), first, 'Identity is exact JSON, never room ID');
read({ tasks: '[1]' }); // Evicts the least recently used "dog" snapshot.
const beforeEviction = parses;
read({ tasks: other });
assert.equal(parses, beforeEviction + 1);
assert.equal(read(row)[0].pool[0].word, 'dog', 'A live request still owns its parsed row');

let budgetParses = 0;
const small = createRaceTaskReader({
  maxEntries: 10,
  maxChars: 8,
  parse: (value) => {
    budgetParses++;
    return JSON.parse(value);
  },
});
small({ tasks: '[123]' });
small({ tasks: '[456]' });
small({ tasks: '[123]' });
assert.equal(budgetParses, 3, 'The total retained source-character budget evicts old entries');
const largeRow = { tasks: '["too large to share"]' };
small(largeRow);
small(largeRow);
assert.equal(budgetParses, 4, 'Oversized data is reused only for the same request-local row');
small({ ...largeRow });
assert.equal(budgetParses, 5);
small({ tasks: '[123]' });
assert.equal(budgetParses, 5, 'Oversized input does not evict the small working set');
assert.throws(() => read({ tasks: 'invalid JSON' }), SyntaxError);
assert.throws(() => read({ tasks: 'invalid JSON' }), SyntaxError);
assert.equal(read(null).length, 0);

// Keep teacher lifecycle fields live even when tasks are shared across requests.
const rules = createRaceRules({
  words: [],
  raceAvatarCatalog: [],
  shuffle: (values) => [...values],
  spellingCharacters: (value) => [...value],
  now: () => 1000,
});
const running = { tasks: raw, status: 'running', started_at: 500, remaining_ms: 1000 };
const paused = { ...running, status: 'paused' };
assert.equal(rules.raceTaskList(running), rules.raceTaskList(paused));
assert.equal(rules.racePublic(running).status, 'running');
assert.equal(rules.racePublic(paused).status, 'paused');
const playerOne = { state: '{"score":10}' },
  playerTwo = { state: '{"score":10}' };
assert.notEqual(rules.racePlayerState(playerOne), rules.racePlayerState(playerTwo));
rules.racePlayerState(playerOne).score = 999;
assert.equal(rules.racePlayerState(playerTwo).score, 10, 'Mutable learners are never shared');

// The exact serialized state bound to the write is also returned after success.
let serialized = 0,
  bound;
const state = {
  score: 1,
  toJSON() {
    serialized++;
    return { score: this.score };
  },
};
const repository = createRaceRepository({
  now: () => 1000,
  raceAccuracy: () => false,
  stmt(env, sql, ...values) {
    bound = values[0];
    return { run: async () => ({ meta: { changes: 1 } }) };
  },
});
const saved = await repository.raceSave({}, { id: 'p', revision: 4 }, state, { id: 'r' }, false);
assert.equal(serialized, 1);
assert.equal(saved.state, bound);
assert.equal(saved.revision, 5);
console.log(
  'Race snapshots: cross-request reuse, recursive immutability, exact-JSON invalidation, LRU/size limits, live lifecycle, isolated learner states and single serialization passed.',
);
