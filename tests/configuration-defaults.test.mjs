import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createConfigurationStore } from '../server/editor/configuration.mjs';
import { allCurriculumProfiles, curriculumProfileKeys } from '../public/shared/curriculum.js';
import { gradeSixContent } from '../server/editor/grade6-content.mjs';
import { validateConfig } from '../server/editor/validation.mjs';

const context = vm.createContext({ structuredClone });
vm.runInContext(
  fs.readFileSync('public/vocabulary.js', 'utf8') +
    fs.readFileSync('public/vocabulary-grade5.js', 'utf8') +
    fs.readFileSync('public/vocabulary-unit7.js', 'utf8'),
  context,
);
const banks = vm.runInContext(
  'JSON.stringify({words:vocabulary,gradeFiveVocabulary,unitSevenVocabulary})',
  context,
);
const sources = JSON.parse(banks);
let row = null;
const store = createConfigurationStore({ ...sources, stmt: () => ({ first: async () => row }) });
const initial = await store.loadConfig({});
validateConfig(initial.config);
const original = structuredClone(initial.config);
for (const profile of allCurriculumProfiles(initial.config)) {
  profile.words[0].meaning = 'temporary edit';
  profile.words[0].distractors.push('temporary distractor');
  profile.course.wordIds.pop();
  profile.race.items.pop();
  assert.equal(
    profile.race.wordIds.length,
    profile.words.length,
    'course and race arrays are independent',
  );
}
assert.deepEqual(
  (await store.loadConfig({})).config,
  original,
  'defaults never share mutable state across requests',
);
assert.equal(JSON.stringify(sources), banks, 'source banks are not edited');
assert.equal(original.course.format, undefined, 'legacy combined format stays compatible');
assert.equal(original.grade5.course.format, undefined);
assert.equal(original.unit7.course.format, undefined);
for (const key of curriculumProfileKeys.filter((key) => !['grade5', 'unit7'].includes(key)))
  assert.equal(original[key].race.format, 'adaptive-four');

const custom = structuredClone(original);
custom.words[0].image = null;
custom.unit7.words[0].image = null;
custom.unit3.words[0].example = 'A teacher-authored example.';
custom.unit3.course.wordIds.reverse();
custom.unit3.race.correctPoints = 230;
row = { data: JSON.stringify(custom), revision: 7 };
const loaded = await store.loadConfig({});
assert.equal(loaded.revision, 7);
assert.deepEqual(
  loaded.config,
  custom,
  'existing profiles, teacher edits and explicit image omissions survive',
);
delete custom.unit1;
delete custom.unit2;
row = { data: JSON.stringify(custom), revision: 8 };
const upgraded = await store.loadConfig({});
assert.deepEqual(
  upgraded.config.unit1.words.map((word) => word.word),
  gradeSixContent[1].map((word) => word.word),
);
assert.deepEqual(
  upgraded.config.unit2.words.map((word) => word.word),
  gradeSixContent[2].map((word) => word.word),
);
assert.deepEqual(
  upgraded.config.unit3,
  custom.unit3,
  'filling a missing profile does not rebuild its neighbors',
);
assert.equal(row.revision, 8, 'loading defaults does not write database state');
console.log(
  'Configuration defaults: all curricula, independent mutable state, legacy formats, source isolation, teacher edits and missing-profile upgrades passed.',
);
