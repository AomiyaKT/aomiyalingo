import assert from 'node:assert/strict';
import {
  createClassVocabularyReader,
  setTeacherText,
} from '../public/practice/teacher-render-state.js';
import { translateUI } from '../public/shared/i18n.js';

let parses = 0;
const fallback = [{ word: 'old' }];
const read = createClassVocabularyReader({
  fallback,
  parse: (raw) => {
    parses++;
    return JSON.parse(raw);
  },
});
assert.equal(read(undefined), fallback);
const raw = '[{"word":"cat","meaning":"猫"}]';
const words = read(raw);
for (let i = 0; i < 100; i++) assert.equal(read(raw), words);
assert.equal(parses, 1);
const changed = read('[{"word":"cat","meaning":"ねこ"}]');
assert.notEqual(changed, words);
assert.equal(changed[0].meaning, 'ねこ');
assert.throws(() => read('invalid JSON'), SyntaxError);
assert.equal(read(undefined), fallback);
assert.equal(read(null), fallback);

let text = '',
  writes = 0;
const node = {
  get textContent() {
    return text;
  },
  set textContent(value) {
    writes++;
    text = value;
  },
};
const source = '練習を一時停止';
assert.equal(setTeacherText(node, source, 'en'), true);
assert.equal(text, source, 'The reversible translator still receives Japanese source text');
text = translateUI(text, 'en'); // Existing language observer presents this source.
for (let i = 0; i < 100; i++) assert.equal(setTeacherText(node, source, 'en'), false);
assert.equal(writes, 1, 'English labels do not alternate Japanese/English on unchanged polls');
text = source; // Switching back through the existing language observer.
for (let i = 0; i < 100; i++) assert.equal(setTeacherText(node, source, 'ja'), false);
assert.equal(writes, 1);
assert.equal(setTeacherText(node, '練習を再開', 'ja'), true);
assert.equal(text, '練習を再開');
assert.equal(setTeacherText(node, 0), true);
assert.equal(text, '0');
assert.equal(setTeacherText(node, 0), false);
assert.equal(setTeacherText(node, null), true);
assert.equal(text, '');
console.log(
  'Practice rendering: unchanged material parsing, new snapshots/fallbacks, preserved translation source, 100 unchanged English/Japanese polls and real label changes passed.',
);
