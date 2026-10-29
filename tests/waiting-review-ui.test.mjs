import assert from 'node:assert/strict';
import { createWaitingReview } from '../public/race/review.js';
class Node {
  constructor(tag = '', text = '') {
    this.tag = tag;
    this.text = text ?? '';
    this.children = [];
    this.hidden = false;
  }
  set textContent(v) {
    this.text = v;
    this.children = [];
  }
  get textContent() {
    return this.text + this.children.map((c) => c.textContent).join(' ');
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
}
const nodes = new Map();
const q = (s) => {
  if (!nodes.has(s)) nodes.set(s, new Node());
  return nodes.get(s);
};
let paused = 0,
  reject,
  plays = 0;
const original = globalThis.playWordAudio;
globalThis.playWordAudio = () => {
  plays++;
  return new Promise((_, r) => {
    reject = r;
  });
};
try {
  let data = {
    race: { id: 'r1', station: 0, status: 'intermission' },
    self: {
      done: true,
      history: [{ word: 'cat', correct: false, points: 0, station: 0 }],
      reviewCards: [
        { word: 'cat', meaning: '猫' },
        { word: 'dog', meaning: '犬' },
      ],
      stationItemBonus: 0,
    },
  };
  const review = createWaitingReview({
    q,
    make: (tag, text) => new Node(tag, text),
    getData: () => data,
    audio: {
      pause() {
        paused++;
      },
    },
    volume: () => 1,
  });
  review.update();
  assert.ok(q('#student-course-summary').textContent.includes('0 pt'));
  q('#review-next').onclick();
  assert.ok(q('#waiting-review-card').textContent.includes('犬'));
  data = { ...data, self: { ...data.self, stationItemBonus: 100 } };
  review.update();
  assert.ok(
    q('#student-course-summary').textContent.includes('100 pt'),
    'Same review words must not freeze changed item points',
  );
  assert.ok(
    q('#waiting-review-card').textContent.includes('犬'),
    'Summary refresh preserves the selected review card',
  );
  const first = q('#review-listen').onclick();
  const obsolete = reject;
  q('#review-next').onclick();
  obsolete(Error('old playback'));
  await first;
  assert.equal(
    q('#review-status').textContent,
    '',
    'Old card audio rejection cannot report on the next card',
  );
  const current = q('#review-listen').onclick();
  reject(Error('current playback'));
  await current;
  assert.match(q('#review-status').textContent, /再生できません/);
  const pending = q('#review-listen').onclick();
  const abandoned = reject;
  data = { ...data, race: { ...data.race, status: 'paused' } };
  review.update();
  abandoned(Error('paused'));
  await pending;
  assert.equal(q('#waiting-review').hidden, true);
  assert.equal(q('#review-status').textContent, '');
  assert.ok(paused >= 3);
  data = {
    ...data,
    race: { id: 'r2', station: 1, status: 'running' },
    self: { done: false, history: [], reviewCards: [] },
  };
  review.update();
  q('#review-next').onclick();
  assert.equal(q('#student-course-summary').hidden, true);
  assert.equal(plays, 3);
  console.log(
    'Review UI: live summary points, retained card position, stale audio rejection, pause cleanup and empty navigation passed.',
  );
} finally {
  globalThis.playWordAudio = original;
}
