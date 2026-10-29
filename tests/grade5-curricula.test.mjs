import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { course } from '../public/learning/course.js';
import {
  materializeExercise,
  gradeExercise,
  stationModes,
  sentenceFor,
} from '../public/learning/exercises.js';
import {
  curriculumCatalog,
  curriculumValue,
  spellingCharacters,
  formatSpellingAnswer,
} from '../public/shared/curriculum.js';
import { validateConfig } from '../server/editor/validation.mjs';
import { createConfigurationStore } from '../server/editor/configuration.mjs';
import { gradeFiveContent } from '../server/editor/grade5-content.mjs';

const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
async function req(path, data, headers = {}, runtime = env) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    runtime,
  );
  return {
    response,
    body: await response
      .clone()
      .json()
      .catch(() => null),
  };
}
function answerFor(t) {
  if (!t.exercise)
    return t.mode === 'text'
      ? [t.content.meaning]
      : t.mode === 'voice'
        ? [t.content.word]
        : t.content.word;
  const e = t.exercise;
  if (e.kind === 'match') return JSON.stringify(t.solution);
  if (e.kind !== 'order') return t.solution;
  const available = e.tokens.slice(),
    order = [];
  let rest = t.solution;
  while (rest.length) {
    const index = available.findIndex(
      (v) =>
        rest.startsWith(v.value) &&
        (e.separator === '' || rest.length === v.value.length || rest[v.value.length] === ' '),
    );
    assert.ok(index >= 0, 'authored tokens cover the answer');
    const [token] = available.splice(index, 1);
    order.push(token.id);
    rest = rest.slice(token.value.length);
    if (e.separator !== '') rest = rest.trimStart();
  }
  return JSON.stringify(order);
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const initial = (await req('/api/teacher/config', undefined, teacher)).body;
const counts = { 1: 14, 2: 12, 3: 11, 4: 12, 5: 20, 6: 32, 7: 36, 8: 22 };
const sources = JSON.parse(fs.readFileSync('docs/content/grade5-image-sources.json'));
assert.equal(sources.count, 159);
assert.equal(
  JSON.stringify(initial.config).length < 512000,
  true,
  'all profiles fit the editor request limit',
);
let attempts = 0;
for (const [unit, count] of Object.entries(counts)) {
  const value = curriculumValue(5, unit),
    key = curriculumCatalog[value].key;
  assert.equal(value, unit === '5' ? '5' : '5-' + unit);
  const profile = initial.config[key];
  assert.equal(profile.words.length, count);
  assert.deepEqual(
    profile.words.map((w) => w.word),
    gradeFiveContent[unit].map((w) => w.word),
  );
  for (const word of profile.words) {
    assert.equal(sentenceFor(word).sentence, word.example, 'use the authored sentence');
    assert.equal(sentenceFor(word).answer.toLowerCase(), word.word.toLowerCase());
    assert.equal(formatSpellingAnswer(word.word, spellingCharacters(word.word)), word.word);
    const image = fs.readFileSync('public' + word.image);
    const provenance = sources.items.find((s) => String(s.unit) === unit && s.word === word.word);
    assert.equal(createHash('sha256').update(image).digest('hex'), provenance.sourceImageSha256);
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
    assert.ok(
      image.readUInt32BE(16) >= 120 && image.readUInt32BE(16) <= 231,
      'native crop dimensions',
    );
    const audio = fs.readFileSync('public' + word.audio);
    assert.equal(audio.subarray(0, 4).toString(), 'RIFF');
    assert.ok(audio.length > 10000);
    for (let station = 0; station < 3; station++) {
      for (const mode of stationModes[station])
        for (const high of [false, true]) {
          const task = materializeExercise(
            {
              id: 'g5-' + unit + word.word + mode,
              rules: 6,
              content: word,
              word: word.word,
              mode,
              station,
            },
            { history: Array.from({ length: 8 }, () => ({ correct: high })) },
            profile.words,
          );
          if (task.exercise)
            assert.equal(
              gradeExercise(task, answerFor(task)).correct,
              true,
              `${unit}: ${word.word} / ${mode}`,
            );
        }
    }
  }
  const room = (
    await req('/api/teacher/classes', { grade: 5, unit, format: 'adaptive-four' }, teacher)
  ).body;
  assert.equal(room.unit, unit);
  assert.equal(JSON.parse(room.vocabulary).length, count);
  const joined = (await req('/api/join', { classId: room.id, label: unit })).body;
  const student = { authorization: 'Bearer ' + joined.token };
  let lesson = joined.lesson;
  assert.equal(lesson.unit, unit, 'student label follows the selected unit');
  assert.equal((await req('/api/student/me', undefined, student)).body.lesson.unit, unit);
  while (lesson.queue.length) {
    const task = course.currentExercise(lesson);
    const result = await req(
      '/api/student/answer',
      { questionId: task.id, answer: answerFor(task) },
      student,
    );
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.correct, true);
    lesson = result.body.lesson;
    assert.equal(lesson.unit, unit, 'answer responses retain curriculum identity');
    attempts++;
  }
  const race = (
    await req('/api/teacher/race/create', { grade: 5, unit, format: 'adaptive-four' }, teacher)
  ).body;
  const stored = await env.DB.prepare('SELECT * FROM races WHERE id=?').bind(race.raceId).first();
  const seeds = JSON.parse(stored.tasks);
  assert.equal(seeds[0].pool.length, count);
  assert.equal(seeds.length, 72);
  for (let station = 0; station < 3; station++)
    assert.equal(new Set(seeds.filter((t) => t.station === station).map((t) => t.mode)).size, 4);
}
assert.equal(attempts, 477);
assert.deepEqual(
  initial.config.grade5unit6.words.slice(-2).map((w) => w.word),
  ['healthy', 'delicious'],
);
assert.equal(
  initial.config.grade5unit7.words.some((w) => w.word === 'healthy'),
  false,
);
assert.equal(initial.config.grade5unit7.words.at(-1).word, 'turn left');
const pe = initial.config.grade5unit1.words.find((w) => w.word === 'P.E.');
assert.equal(sentenceFor(pe).answer, 'P.E.');
// The classic letter UI inserts punctuation itself. Grade its canonical shape,
// including P.E., through the actual Worker, not only the adaptive exercise model.
{
  const runtime = { DB: database(), TEACHER_PASSWORD: 'test-password' };
  const call = (path, data, headers) => req(path, data, headers, runtime);
  const login = await call('/api/teacher/login', { password: 'test-password' });
  const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
  const settings = (await call('/api/teacher/config', undefined, teacher)).body;
  Object.assign(settings.config.grade5unit1.race, { modes: ['spelling'], countdown: 0 });
  assert.equal((await call('/api/teacher/config', settings, teacher)).response.status, 200);
  const race = (
    await call('/api/teacher/race/create', { grade: 5, unit: '1', format: 'classic' }, teacher)
  ).body;
  const students = await Promise.all(
    [1, 2].map((label) => call('/api/race/join', { raceId: race.raceId, label: String(label) })),
  );
  await call('/api/teacher/race/state', { raceId: race.raceId, action: 'start' }, teacher);
  for (const [index, joined] of students.entries()) {
    const student = { authorization: 'Bearer ' + joined.body.token };
    let snapshot = (await call('/api/race/me', undefined, student)).body;
    let checked = false;
    // Each course contains all fourteen words before personal question shuffling.
    for (let n = 0; n < settings.config.grade5unit1.race.questions; n++) {
      const task = snapshot.self.task;
      assert.equal(task.mode, 'spelling');
      if (task.spoken === 'P.E.') {
        assert.equal(task.spellingPattern, '_._.');
        assert.equal(task.length, 2);
        for (const answer of ['PE', 'P.E', 'P.E. ', 'P..E.', '_.E.', 'P-E.', 'P.E.<script>']) {
          const invalid = await call('/api/race/answer', { questionId: task.id, answer }, student);
          assert.equal(invalid.response.status, 400, answer);
        }
        checked = true;
      }
      const answer = formatSpellingAnswer(
        task.spellingPattern,
        spellingCharacters(task.spoken).toLowerCase(),
      );
      const result = await call(
        '/api/race/answer',
        {
          questionId: task.id,
          answer: task.spoken === 'P.E.' && index === 1 ? 'x.x.' : answer,
        },
        student,
      );
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.receipt.correct, !(task.spoken === 'P.E.' && index === 1));
      snapshot = result.body;
      if (checked) break;
    }
    assert.equal(
      checked,
      true,
      'Classic race includes and accepts the canonical P.E. letter answer',
    );
  }
}
assert.equal(sentenceFor({ ...pe, example: 'I like P.E. today.' }).after, ' today.');
assert.equal(
  sentenceFor({ word: 'in', example: 'This is interesting.' }).sentence,
  'The word is "in".',
);
validateConfig(structuredClone(initial.config));
for (const invalidWord of ['P..E.', 'P.E.<script>', 'P.E./etc', 'P.E. invalid']) {
  const bad = structuredClone(initial.config);
  bad.grade5unit1.words[6].word = invalidWord;
  assert.throws(() => validateConfig(bad));
}
// Missing profiles are added without replacing old settings or explicit omissions.
const saved = structuredClone(initial.config);
saved.grade5.words[0].image = null;
saved.grade5.words[1].meaning = 'おばあさん';
delete saved.grade5.words[1].image;
saved.grade5unit3.race.correctPoints = 230;
delete saved.grade5unit1;
const store = createConfigurationStore({
  words: [],
  gradeFiveVocabulary: [],
  unitSevenVocabulary: [],
  stmt: () => ({ first: async () => ({ data: JSON.stringify(saved), revision: 9 }) }),
});
const upgraded = await store.loadConfig({});
assert.equal(upgraded.revision, 9);
assert.equal(upgraded.config.grade5.words[0].image, null);
assert.equal(upgraded.config.grade5.words[1].meaning, 'おばあさん');
assert.equal(upgraded.config.grade5.words[1].image, gradeFiveContent[5][1].image);
assert.equal(upgraded.config.grade5unit3.race.correctPoints, 230);
assert.equal(upgraded.config.grade5unit1.words.length, 14);
const custom = structuredClone(initial.config);
custom.grade5unit1.words[0].example = 'I study music.';
assert.equal(
  (await req('/api/teacher/config', { revision: 0, config: custom }, teacher)).response.status,
  200,
);
const old = structuredClone(custom);
for (const unit of [1, 2, 3, 4, 6, 7, 8]) delete old['grade5unit' + unit];
assert.equal(
  (await req('/api/teacher/config', { revision: 1, config: old }, teacher)).response.status,
  200,
);
assert.equal(
  (await req('/api/teacher/config', undefined, teacher)).body.config.grade5unit1.words[0].example,
  'I study music.',
);
for (const file of ['teacher.html', 'race-teacher.html', 'teacher-editor.html']) {
  const html = fs.readFileSync('public/' + file, 'utf8');
  for (const unit of Object.keys(counts))
    assert.ok(html.includes('value="' + curriculumValue(5, unit) + '"'));
}
console.log(
  'PASS: all eight Grade 5 units, 159 picture/audio mappings, 477 authoritative student answers, adaptive families, classic P.E. punctuation/invalid-shape grading and legacy teacher settings.',
);
