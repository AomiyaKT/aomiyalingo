import assert from 'node:assert/strict';
import { createPracticeQuestion } from '../public/practice/question.js';
import { svgMarkup } from '../public/shared/dom.js';
import { createClassroomRoute } from '../server/classroom/routes.mjs';

const vocabulary = [
  { word: 'ate', meaning: '食べた', distractors: ['飲んだ', '寝た'] },
  { word: 'read', meaning: '読んだ' },
  { word: 'wrote', meaning: '書いた' },
  { word: 'bought', meaning: '買った' },
];
let id = 0;
const question = (mode, draft) =>
  createPracticeQuestion({
    task: { id: 'q1', word: 'ate', mode },
    vocabulary,
    initial: () => ({ selected: [], submitted: false }),
    shuffleWords: (list) => [...list].reverse(),
    nextOptionId: () => ++id,
    getDraft: (taskId) => {
      assert.equal(taskId, 'q1');
      return draft;
    },
  });
const text = question('text');
assert.equal(text.options.filter((o) => o.correct).length, 1);
assert.equal(text.options.find((o) => o.correct).text, '食べた');
assert.ok(text.options.some((o) => o.text === '飲んだ'));
const voice = question('voice');
assert.equal(voice.options.find((o) => o.correct).text, 'ate');
assert.ok(voice.options.every((o) => /^[a-z]+$/.test(o.text)));
const draft = {
  choices: ['読んだ', '食べた', '書いた', '買った'],
  answers: ['書いた'],
  hintUsed: true,
};
const restored = question('text', draft);
assert.deepEqual(
  restored.options.map((o) => o.text),
  draft.choices,
);
assert.deepEqual(restored.selected, [restored.options[2].id]);
assert.equal(restored.hintUsed, true);
assert.ok(restored.options.every((o) => !text.options.some((previous) => previous.id === o.id)));
const spelling = question('spelling', {
  letters: ['t', 'a', 'e', 't'],
  selected: [1, 0],
  hintUsed: true,
  hintShown: true,
});
assert.deepEqual(spelling.letters, ['t', 'a', 'e', 't']);
assert.deepEqual(spelling.selected, [1, 0]);
assert.equal(spelling.spellingWord, 'ate');
assert.equal(spelling.hintShown, true);
assert.match(svgMarkup('speaker'), /aria-hidden="true"/);
assert.throws(() => svgMarkup('<script>'), /Invalid icon/);

// All teacher handlers must deny before touching the database or configuration.
const forbidden = () => {
  throw Error('Unauthorized access reached persistence');
};
const route = createClassroomRoute({
  teacher: async () => false,
  stmt: forbidden,
  db: forbidden,
  loadConfig: forbidden,
  json: (data, status) => new Response(JSON.stringify(data), { status }),
});
for (const path of ['classes', 'progress', 'export', 'records-delete', 'class-state']) {
  const url = new URL('https://classroom.test/api/teacher/' + path);
  const response = await route(new Request(url), {}, url);
  assert.equal(response.status, 401);
}
console.log(
  'PASS: text/English listening options, recovered option order/selection, duplicate-letter spelling draft, safe icon markup and teacher authorization before persistence.',
);
