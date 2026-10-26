import assert from 'node:assert/strict';
import { createTeacherPracticePanels } from '../public/practice/teacher-panels.js';
import { createPracticeScreens } from '../public/practice/screens.js';
const nodes = new Map();
function node(tag, text, className) {
  return {
    tag,
    text,
    className,
    classList: { toggle() {}, remove() {} },
    children: [],
    style: {},
    replacements: 0,
    append(...v) {
      this.children.push(...v);
    },
    replaceChildren() {
      this.children = [];
      this.replacements++;
    },
    removeAttribute(name) {
      delete this[name];
    },
  };
}
const q = (key) => {
  if (!nodes.has(key)) nodes.set(key, node('section'));
  return nodes.get(key);
};
const draw = createTeacherPracticePanels({ q, make: node, attemptRow: (a) => node('p', a.answer) });
const data = {
  classroom: { id: 'a', active: true, accepting: true },
  students: [{ stage: 1, completed: 1, total: 10, lastSeen: Date.now() }],
  attempts: [{ word: 'cat', correct: false, answer: 'dog' }],
};
const summary = [{ word: 'cat', meaning: '猫', firstWrong: 1, remaining: 1, hinted: 0 }];
draw(data, summary);
const panels = ['#weak-words', '#recent-mistakes', '#tv-stages', '#tv-weak-words'];
const firstCard = q('#tv-stages').children[0];
draw(structuredClone(data), structuredClone(summary));
for (const id of panels) assert.equal(q(id).replacements, 1);
assert.equal(q('#tv-stages').children[0], firstCard);
data.students[0].lastSeen = 0;
draw(data, summary);
assert.match(q('#tv-activity').textContent, /^0人/);
for (const id of panels)
  assert.equal(q(id).replacements, 1, 'activity updates do not rebuild reading panels');
data.students[0].stage = 2;
draw(data, summary);
assert.equal(q('#tv-stages').replacements, 2);
summary[0].remaining = 0;
draw(data, summary);
assert.equal(q('#weak-words').replacements, 2);
data.classroom.id = 'b';
draw(data, summary);
for (const id of panels)
  assert.ok(q(id).replacements >= 2, 'class changes invalidate panel identities');
let index = 0;
const words = [
  {
    word: 'cat',
    meaning: '猫',
    image: '/assets/vocabulary/g6-unit2/01_shrine.png',
    example: 'A cat.',
  },
  { word: 'custom', meaning: '追加語', example: '' },
];
const screens = createPracticeScreens({
  $: q,
  getStudyIndex: () => index,
  assignedWords: () => words,
  stopAudio() {},
  interactionEffects: { enter() {} },
});
screens.renderStudyCard();
assert.equal(q('#study-picture').hidden, false);
assert.equal(q('#study-word').textContent, 'cat');
q('#study-picture').onerror();
assert.equal(q('#study-picture').hidden, true);
index = 1;
screens.renderStudyCard();
assert.equal(q('#study-picture').hidden, true);
assert.equal(q('#study-picture').src, undefined);
console.log(
  'Practice panels: stable unchanged DOM, live activity, targeted invalidation, class isolation and illustrated/plain study cards passed.',
);
