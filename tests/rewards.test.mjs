import assert from 'node:assert/strict';
import { stationProgress, progressMessages, createRewardFeedback } from '../public/race/rewards.js';
const history = [
  { station: 0, correct: true, streak: 1 },
  { station: 0, correct: false, streak: 0 },
  { station: 1, correct: true, streak: 1 },
  { station: 1, correct: true, streak: 2 },
  { station: 1, correct: true, hinted: true, streak: 0 },
  { station: 1, correct: true, review: true, streak: 99 },
];
assert.deepEqual(stationProgress(history, 1), { answered: 3, accuracy: 67, bestStreak: 2 });
assert.ok(progressMessages(history, 1).some((s) => s.includes('17ポイントアップ')));
assert.ok(progressMessages(history, 1).some((s) => s.includes('記録を更新')));
assert.ok(!progressMessages([], 1).some((s) => s.includes('キープ')));
assert.equal(stationProgress([{ correct: true, streak: 2 }], 0).accuracy, 100);
assert.ok(progressMessages(history, 0).every((s) => !s.includes('前のコース')));
const panel = {
  children: [],
  hidden: true,
  replaceChildren() {
    this.children = [];
  },
  append(child) {
    this.children.push(child);
  },
  animate() {
    throw Error('reduced motion must not animate');
  },
};
const rewards = createRewardFeedback({
  q: () => panel,
  make: (tag, text) => ({ tag, text }),
  settings: { values: { reduceMotion: true } },
});
const receipt = { id: 'a', correct: true, points: 180, streak: 3, streakBonus: 40 };
rewards.show(receipt, { correctPoints: 100 });
assert.equal(panel.hidden, false);
assert.ok(panel.children.some((x) => x.text.includes('道具ボーナス +40')));
const previousChildren = panel.children;
rewards.show(receipt, { correctPoints: 100 });
assert.equal(panel.children, previousChildren, 'polls/retries must not replay receipt feedback');
rewards.clear();
assert.equal(panel.hidden, true);
rewards.show({ id: 'b', correct: false });
assert.equal(panel.hidden, true);
rewards.show({ id: 'c', correct: true, hinted: true, points: 70, streak: 3 }, { hintPoints: 70 });
assert.equal(panel.children.length, 1, 'a hint must not claim an independent combo');
console.log(
  'PASS: per-course growth excludes hints/reviews and handles missing previous attempts.',
);
