import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
  return {
    response,
    body: await response
      .clone()
      .json()
      .catch(() => null),
  };
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const initial = (await req('/api/teacher/config', undefined, teacher)).body;
const counts = { 1: 27, 2: 21, 3: 19, 4: 37, 5: 28, 6: 22, 7: 24, 8: 22 };
assert.deepEqual(
  initial.config.unit1.words.map((w) => w.word),
  [
    'like',
    'have',
    'want',
    'math',
    'English',
    'music',
    'a cat',
    'cats',
    'a dog',
    'dogs',
    'swimming',
    'surfing',
    'dancing',
    'cooking',
    'skiing',
    'skating',
    'running',
    'singing',
    'drawing',
    'speaking English',
    'playing soccer',
    'playing the piano',
    'food',
    'sport',
    'color',
    'subject',
    'animal',
  ],
);
const sources = JSON.parse(fs.readFileSync('docs/content/grade6-image-sources.json')).items;
for (const word of initial.config.unit1.words) {
  const image = fs.readFileSync('public' + word.image);
  const source = sources.find((item) => item.unit === 1 && item.word === word.word);
  assert.ok(source, 'every picture has its own reference mapping');
  assert.equal(createHash('sha256').update(image).digest('hex'), source.sourceImageSha256);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 108, 'retain native reference pixels, not artificial HD');
}
assert.deepEqual(
  initial.config.unit1.words.filter((w) => w.pictureEnabled === false).map((w) => w.word),
  ['like', 'have', 'want'],
);
function answerFor(t) {
  if (!t.exercise)
    return t.mode === 'text'
      ? [t.content.meaning]
      : t.mode === 'voice'
        ? [t.content.word]
        : t.content.word;
  const e = t.exercise;
  if (e.kind === 'match') return JSON.stringify(t.solution);
  if (e.kind === 'order') {
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
  return t.solution;
}
let attempts = 0,
  pictures = 0;
for (const [unit, count] of Object.entries(counts)) {
  const profile = initial.config['unit' + unit];
  assert.equal(profile.words.length, count);
  assert.equal(curriculumValue(6, unit), '6-' + unit);
  assert.equal(curriculumCatalog['6-' + unit].key, 'unit' + unit);
  for (const word of profile.words) {
    assert.equal(
      sentenceFor(word).sentence,
      word.example,
      'use a natural authored example, not fallback',
    );
    assert.equal(sentenceFor(word).answer.toLowerCase(), word.word.toLowerCase());
    assert.equal(formatSpellingAnswer(word.word, spellingCharacters(word.word)), word.word);
    assert.match(word.audio, /^\/assets\/words\/[^/]+\.wav$/);
    const bytes = fs.readFileSync('public' + word.audio);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.ok(bytes.length > 10000);
    if (word.image) {
      const response = await req(word.image);
      assert.equal(response.response.status, 200);
      assert.equal(response.response.headers.get('content-type'), 'image/png');
    }
    for (let station = 0; station < 3; station++)
      for (const mode of stationModes[station])
        for (const high of [false, true]) {
          const task = materializeExercise(
            {
              id: 'unit' + unit + word.word + mode,
              content: word,
              word: word.word,
              mode,
              station,
              rules: 6,
            },
            { history: Array.from({ length: 8 }, () => ({ correct: high })) },
            profile.words,
          );
          if (task.exercise)
            assert.equal(
              gradeExercise(task, answerFor(task)).correct,
              true,
              unit + ': ' + word.word + ' / ' + mode,
            );
          if (task.exercise?.kind === 'picture') {
            pictures++;
            assert.equal(task.exercise.choices.length, 4);
            assert.equal(new Set(task.exercise.choices).size, 4);
            assert.equal(task.exerciseAudio.spoken, null, 'do not reveal picture answers in audio');
            const wrong = task.exercise.choices.find((v) => v !== word.word);
            assert.equal(gradeExercise(task, wrong).correct, false);
            assert.equal(
              materializeExercise(
                {
                  id: task.id,
                  mode,
                  rules: 6,
                  station,
                  content: { ...word, pictureEnabled: false },
                },
                { history: [] },
                profile.words,
              ).exercise,
              undefined,
            );
          }
        }
  }
  const room = (
    await req('/api/teacher/classes', { grade: 6, unit, format: 'adaptive-four' }, teacher)
  ).body;
  assert.equal(room.unit, unit);
  assert.equal(JSON.parse(room.vocabulary).length, count);
  const joined = (await req('/api/join', { classId: room.id, label: unit })).body;
  const student = { authorization: 'Bearer ' + joined.token };
  let lesson = joined.lesson;
  while (lesson.queue.length) {
    const task = course.currentExercise(lesson),
      answer = answerFor(task);
    const result = await req('/api/student/answer', { questionId: task.id, answer }, student);
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.correct, true);
    lesson = result.body.lesson;
    attempts++;
  }
  const race = (
    await req(
      '/api/teacher/race/create',
      { grade: 6, unit, title: 'Unit ' + unit, format: 'adaptive-four' },
      teacher,
    )
  ).body;
  const stored = await env.DB.prepare('SELECT * FROM races WHERE id=?').bind(race.raceId).first();
  assert.ok(stored);
  const seeds = JSON.parse(stored.tasks);
  assert.equal(seeds[0].pool.length, count);
  assert.equal(seeds.length, 72);
  for (let station = 0; station < 3; station++)
    assert.equal(new Set(seeds.filter((t) => t.station === station).map((t) => t.mode)).size, 4);
}
assert.equal(attempts, 600);
assert.ok(pictures >= 362);
// A legacy editor save must not erase the new profiles or their custom settings.
const edited = structuredClone(initial.config);
edited.unit3.words[0].example = 'This park is beautiful.';
edited.unit1.words[0].example = 'I like English.';
assert.equal(
  (await req('/api/teacher/config', { revision: 0, config: edited }, teacher)).response.status,
  200,
);
const old = structuredClone(edited);
for (const u of [1, 2, 3, 4, 5, 6, 8]) delete old['unit' + u];
assert.equal(
  (await req('/api/teacher/config', { revision: 1, config: old }, teacher)).response.status,
  200,
);
assert.equal(
  (await req('/api/teacher/config', undefined, teacher)).body.config.unit3.words[0].example,
  'This park is beautiful.',
);
assert.equal(
  (await req('/api/teacher/config', undefined, teacher)).body.config.unit1.words[0].example,
  'I like English.',
);
const broken = structuredClone(edited);
broken.unit8.words[0].image = 'https://other.test/tracker.png';
assert.equal(
  (await req('/api/teacher/config', { revision: 2, config: broken }, teacher)).response.status,
  400,
);
const ctx = vm.createContext({ console });
vm.runInContext(await (await req('/curriculum.js')).response.text(), ctx);
assert.equal(vm.runInContext("curriculumValue(6,'8')", ctx), '6-8');
for (const file of ['teacher.html', 'race-teacher.html', 'teacher-editor.html']) {
  const html = fs.readFileSync('public/' + file, 'utf8');
  for (const u of Object.keys(counts)) assert.ok(html.includes('value="6-' + u + '"'));
}
console.log(
  'PASS: all eight Grade 6 curricula, 600 student answers, all adaptive question families at two levels, 184 illustrations/audio assets, exact Unit 1 words/images, punctuation spelling, independent configuration and legacy-save preservation.',
);
