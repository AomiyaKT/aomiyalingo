import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { createRaceRules } from '../server/race/rules.mjs';
import { magnetPoints } from '../server/race/item-effects.mjs';
import { gradeExercise } from '../server/race/exercises.mjs';
import { raceItemCatalog, raceItemIds } from '../public/shared/race-items.js';
import { translateUI } from '../public/shared/i18n.js';
import { courseSummary } from '../public/race/lifecycle.js';
import { createRewardFeedback } from '../public/race/rewards.js';

const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
async function req(path, data, headers = {}) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json(), response };
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const initial = (await req('/api/teacher/config', undefined, teacher)).body;
assert.deepEqual(initial.config.race.items, raceItemIds);
Object.assign(initial.config.race, { modes: ['text'], questions: 24, countdown: 0 });
assert.equal(
  (
    await req(
      '/api/teacher/config',
      { config: initial.config, revision: initial.revision },
      teacher,
    )
  ).status,
  200,
);
let raceId = (await req('/api/teacher/race/create', { title: 'New item integration' }, teacher))
  .body.raceId;
let joined = (await req('/api/race/join', { raceId, label: '7' })).body;
let playerId = joined.self.id;
let auth = { authorization: 'Bearer ' + joined.token };
const other = (await req('/api/race/join', { raceId, label: '8' })).body;
await req('/api/teacher/race/state', { raceId, action: 'start' }, teacher);
const room = () => env.DB.prepare('SELECT * FROM races WHERE id=?').bind(raceId).first();
const read = async () =>
  JSON.parse(
    (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(playerId).first()).state,
  );
async function mutate(change) {
  const state = await read();
  change(state);
  await env.DB.prepare('UPDATE racers SET state=? WHERE id=?')
    .bind(JSON.stringify(state), playerId)
    .run();
}
async function reset() {
  await mutate((s) =>
    Object.assign(s, {
      index: 0,
      score: 0,
      correct: 0,
      history: [],
      wrong: [],
      streak: 0,
      bestStreak: 0,
      item: null,
      usedSegment: -1,
      hintFor: null,
      hintStrength: 0,
      boost: 0,
      double: false,
      lucky: 0,
      shield: false,
      treasure: null,
      swapTask: null,
      itemScores: {},
    }),
  );
}
const me = async () => (await req('/api/race/me', undefined, auth)).body;
async function grant(item) {
  await mutate((s) => {
    s.item = item;
    s.usedSegment = -1;
  });
  const before = await me();
  const response = await req('/api/race/item', { questionId: before.self.task.id }, auth);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}
async function fullTask() {
  const r = await room();
  const tasks = JSON.parse(r.tasks);
  const rules = createRaceRules({ words: tasks[0].pool, raceAvatarCatalog: [], now: Date.now });
  return rules.raceCurrentTask(r, await read());
}
function answerFor(task) {
  const e = task.exercise;
  if (!e) return task.mode === 'text' ? task.content.meaning : task.word;
  if (e.kind === 'match') return JSON.stringify(task.solution);
  if (e.kind === 'order') {
    const tokens = [...e.tokens],
      ids = [];
    let rest = task.solution;
    while (rest) {
      const index = tokens.findIndex(
        (t) =>
          rest.startsWith(t.value) &&
          (e.separator === '' || rest.length === t.value.length || rest[t.value.length] === ' '),
      );
      assert.ok(index >= 0);
      const [token] = tokens.splice(index, 1);
      ids.push(token.id);
      rest = rest.slice(token.value.length);
      if (e.separator !== '') rest = rest.trimStart();
    }
    return JSON.stringify(ids);
  }
  return task.solution;
}
async function answer(correct = true) {
  const task = await fullTask();
  const payload = {
    questionId: task.id,
    answer: correct ? answerFor(task) : task.options.find((v) => v !== task.content.meaning),
  };
  const result = await req('/api/race/answer', payload, auth);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return { ...result.body, payload };
}

// A shield preserves only the combo, never the correctness or points of the mistake.
await reset();
await mutate((s) => {
  s.streak = 4;
});
await grant('shield');
let result = await answer(false);
assert.equal(result.receipt.shielded, true);
assert.equal(result.receipt.correct, false);
assert.equal(result.receipt.points, 0);
assert.equal(result.self.streak, 4);
assert.equal(result.self.correct, 0);
assert.equal(result.self.shield, false);
assert.equal((await req('/api/race/answer', result.payload, auth)).body.self.score, 0);
result = await answer(false);
assert.equal(result.self.streak, 0);
await reset();
await mutate((s) => {
  s.streak = 4;
});
await grant('shield');
await grant('hint');
result = await answer();
assert.equal(result.receipt.points, 70);
assert.equal(result.receipt.hinted, true);
assert.equal(result.receipt.shielded, true);
assert.equal(result.self.correct, 0);
assert.equal(result.self.streak, 4);

// The treasure requires three consecutive independent answers, with one payout per activation.
await reset();
await grant('treasure');
await answer();
result = await answer();
assert.equal(result.self.treasure.progress, 2);
result = await answer(false);
assert.equal(result.self.treasure.progress, 0);
await answer();
await answer();
result = await answer();
assert.equal(result.receipt.treasureBonus, 150);
assert.equal(result.receipt.points, 100 + result.receipt.streakBonus + 150);
assert.equal(result.self.treasure, null);
const awarded = result.self.score;
assert.equal((await req('/api/race/answer', result.payload, auth)).body.self.score, awarded);
result = await answer();
assert.equal(result.receipt.treasureBonus, undefined);
await grant('treasure');
await answer();
await grant('hint');
result = await answer();
assert.equal(result.self.treasure.progress, 0);

// Swapping invalidates the old question without advancing counters or mutating the shared deck.
await reset();
const frozenDeck = (await room()).tasks;
let old = await fullTask();
const before = await read();
result = await grant('swap');
let swapped = await fullTask();
assert.notEqual(swapped.id, old.id);
assert.notEqual(swapped.word, old.word);
assert.equal(swapped.mode, old.mode);
assert.equal(result.self.index, before.index);
assert.equal(result.self.score, before.score);
assert.equal(result.self.correct, before.correct);
assert.deepEqual(result.self.history, before.history);
assert.equal((await me()).self.task.id, swapped.id);
assert.equal((await req('/api/race/item', { questionId: old.id }, auth)).status, 409);
assert.equal(
  (await req('/api/race/answer', { questionId: old.id, answer: answerFor(old) }, auth)).status,
  409,
);
await answer();
assert.equal((await read()).swapTask, null);
assert.equal((await read()).index, 1);
assert.equal((await room()).tasks, frozenDeck);

// Magnet points affect the total and course podium equally, without fake answers or losses for peers.
await reset();
const otherState = JSON.parse(
  (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(other.self.id).first()).state,
);
otherState.score = 1000;
await env.DB.prepare('UPDATE racers SET state=? WHERE id=?')
  .bind(JSON.stringify(otherState), other.self.id)
  .run();
result = await grant('magnet');
assert.equal(result.itemEffect.points, 150);
assert.equal(result.self.score, 150);
assert.equal(result.self.history.length, 0);
assert.equal(result.self.index, 0);
assert.equal(result.self.correct, 0);
assert.equal(
  JSON.parse(
    (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(other.self.id).first()).state,
  ).score,
  1000,
);
assert.equal((await req('/api/race/item', { questionId: result.self.task.id }, auth)).status, 409);
await answer();
// Use the public session board as the authoritative live view.
result = await me();
assert.equal(result.board.find((p) => p.id === playerId).stationScore, 250);
assert.equal(courseSummary(result).points, 250);
assert.equal(result.stationResults[0].players.find((p) => p.id === playerId).score, 250);
assert.equal(magnetPoints(1000, [{ score: 1200 }, { score: 2000 }]), 50);
assert.equal(magnetPoints(0, []), 20);
assert.equal(magnetPoints(0, [{ score: 1 }]), 20);

// The same replacement mechanism works for all ten adaptive task types in endless races.
raceId = (
  await req(
    '/api/teacher/race/create',
    { title: 'Adaptive swaps', format: 'adaptive-four', endless: true },
    teacher,
  )
).body.raceId;
joined = (await req('/api/race/join', { raceId, label: '7' })).body;
playerId = joined.self.id;
auth = { authorization: 'Bearer ' + joined.token };
await req('/api/teacher/race/state', { raceId, action: 'start' }, teacher);
const r = await room(),
  seeds = JSON.parse(r.tasks),
  pool = seeds[0].pool;
const rules = createRaceRules({
  words: pool,
  raceAvatarCatalog: [],
  shuffle: (a) => a,
  spellingCharacters: (w) => [...w.replaceAll(' ', '')],
  now: Date.now,
});
for (const mode of [
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
]) {
  await reset();
  await mutate((s) => {
    s.swapTask = { ...rules.raceTask(pool[0], mode, pool), rules: 6, station: 0 };
  });
  old = await fullTask();
  await grant('swap');
  swapped = await fullTask();
  assert.equal(swapped.mode, mode);
  assert.notEqual(swapped.word, old.word);
  if (swapped.exercise) assert.equal(gradeExercise(swapped, answerFor(swapped)).correct, true);
  result = await answer();
  assert.equal(result.receipt.correct, true);
  assert.equal(result.self.index, 1);
}
await grant('shield');
await grant('treasure');
await env.DB.prepare("UPDATE races SET status='intermission' WHERE id=?").bind(raceId).run();
assert.equal(
  (await req('/api/teacher/race/state', { raceId, action: 'nextStation' }, teacher)).status,
  200,
);
assert.equal((await read()).shield, false);
assert.equal((await read()).treasure, null);
assert.equal((await read()).swapTask, null);

// Full defaults expand once, but explicitly restricted teacher selections stay restricted.
const saved = (await req('/api/teacher/config', undefined, teacher)).body;
saved.config.race.items = ['shield', 'swap'];
saved.config.race.itemVersion = 2;
await env.DB.prepare('UPDATE app_config SET data=? WHERE id=1')
  .bind(JSON.stringify(saved.config))
  .run();
assert.deepEqual((await req('/api/teacher/config', undefined, teacher)).body.config.race.items, [
  'shield',
  'swap',
]);
saved.config.race.items = raceItemIds.slice(0, 6);
await env.DB.prepare('UPDATE app_config SET data=? WHERE id=1')
  .bind(JSON.stringify(saved.config))
  .run();
assert.deepEqual(
  (await req('/api/teacher/config', undefined, teacher)).body.config.race.items,
  raceItemIds,
);
for (const id of raceItemIds.slice(6)) {
  assert.notEqual(translateUI(raceItemCatalog[id].name), raceItemCatalog[id].name);
  assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(translateUI(raceItemCatalog[id].description)));
}
const rewardPanel = {
  children: [],
  replaceChildren() {
    this.children = [];
  },
  append(node) {
    this.children.push(node);
  },
};
const rewards = createRewardFeedback({
  q: () => rewardPanel,
  make: (tag, text) => ({ tag, text }),
  settings: { values: { reduceMotion: true } },
});
rewards.show(
  {
    id: 'treasure-ui',
    correct: true,
    points: 350,
    streak: 6,
    streakBonus: 100,
    treasureBonus: 150,
  },
  { correctPoints: 100 },
);
assert.equal(rewardPanel.children.filter((n) => n.text.includes('宝箱オープン')).length, 1);
assert.equal(
  rewardPanel.children.filter((n) => n.text.includes('道具ボーナス')).length,
  0,
  'Do not repeat the same 150-point treasure bonus',
);
rewards.show({ id: 'shield-ui', correct: false, shielded: true, points: 0 });
assert.equal(rewardPanel.hidden, false);
assert.equal(rewardPanel.children.length, 1);
assert.ok(rewardPanel.children[0].text.includes('連続正解を守った'));
console.log(
  'New race items: shield scoring/accuracy, treasure reset/single payout, finite/endless swaps across ten modes, stale submissions, capped catch-up points/course totals, station cleanup, custom selections and English descriptions passed.',
);
