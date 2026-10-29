import assert from 'node:assert/strict';
import { curriculumUnits, mountCurriculumPicker } from '../public/shared/curriculum-picker.js';
import { curriculumSelection } from '../public/shared/curriculum.js';
import { translateUI } from '../public/shared/i18n.js';

assert.deepEqual(
  curriculumUnits(5).map((v) => v.value),
  ['5-1', '5-2', '5-3', '5-4', '5', '5-6', '5-7', '5-8'],
);
assert.deepEqual(
  curriculumUnits(6).map((v) => v.value),
  ['6-1', '6-2', '6-3', '6-4', '6-5', '6-6', '6-7', '6-8'],
);
assert.equal(curriculumUnits(6)[0].label, 'Pre Unit–Unit 1');
for (const grade of [5, 6]) {
  const choices = curriculumUnits(grade);
  assert.equal(choices.length, 8);
  for (const choice of choices) assert.equal(curriculumSelection(choice.value).grade, grade);
  assert.ok(choices.every((v) => !v.label.includes('年生')));
}
const legacy = curriculumUnits(6, '6').find((v) => v.value === '6');
assert.equal(legacy.label, 'Unit 4–5（以前の設定）');
assert.equal(curriculumUnits(6, '6').length, 9);
assert.equal(curriculumSelection('5').key, 'grade5');
assert.equal(curriculumSelection('6').key, null);
assert.equal(translateUI('小学校'), 'Elementary school');
assert.equal(translateUI('教材'), 'Textbook');
assert.equal(translateUI('学年'), 'Grade');
assert.equal(translateUI('単元'), 'Unit');
assert.equal(mountCurriculumPicker(null), null);
console.log(
  'Curriculum picker: eight ordered units per grade, stable Grade 5 Unit 5 and legacy profile IDs, concise labels, Pre Unit and English captions passed.',
);
