import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { course } from '../public/learning/course.js';
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
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}
const login = await req('/api/teacher/login', { password: 'test-password' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
assert.equal(
  (await req('/api/teacher/classes', { format: 'unknown' }, teacher)).response.status,
  400,
);
const config = (await req('/api/teacher/config', undefined, teacher)).body;
config.config.course.format = 'adaptive-four';
assert.equal((await req('/api/teacher/config', config, teacher)).response.status, 200);
assert.equal(
  (await req('/api/teacher/config', undefined, teacher)).body.config.course.format,
  'adaptive-four',
);
const old = (await req('/api/teacher/classes', { title: 'Old client' }, teacher)).body;
assert.equal(course.practiceSettings(old.modes).format, 'classic');
function answerFor(t) {
  if (!t.exercise)
    return t.mode === 'text'
      ? [t.content.meaning]
      : t.mode === 'spelling'
        ? t.content.word.toLowerCase()
        : [t.content.word];
  const e = t.exercise;
  if (e.kind === 'match') return JSON.stringify(t.solution);
  if (e.kind === 'order') {
    const available = e.tokens.slice(),
      result = [];
    let rest = t.solution;
    while (rest.length) {
      const i = available.findIndex(
        (v) =>
          rest.startsWith(v.value) &&
          (e.separator === '' || rest.length === v.value.length || rest[v.value.length] === ' '),
      );
      assert.ok(i >= 0);
      const [token] = available.splice(i, 1);
      result.push(token.id);
      rest = rest.slice(token.value.length);
      if (e.separator !== '') rest = rest.trimStart();
    }
    return JSON.stringify(result);
  }
  return t.solution;
}
for (const [grade, unit] of [
  [6, '4-5'],
  [5, '5'],
  [6, '7'],
]) {
  const room = (
    await req(
      '/api/teacher/classes',
      { title: 'Practice step-up', grade, unit, format: 'adaptive-four', roundSize: 6 },
      teacher,
    )
  ).body;
  assert.equal(course.practiceSettings(room.modes).modes.length, 10);
  const learners = [];
  for (let i = 0; i < 2; i++) {
    const joined = (await req('/api/join', { label: String(grade * 10 + i), classId: room.id }))
      .body;
    learners.push({
      good: !i,
      auth: { authorization: 'Bearer ' + joined.token },
      lesson: joined.lesson,
    });
    const l = joined.lesson;
    assert.equal(l.format, 'adaptive-four');
    assert.equal(l.roundSize, 6);
    assert.equal(l.total, l.vocabulary.length * 3);
    assert.equal(l.rounds, Math.ceil(l.total / 6));
    assert.equal(new Set(l.queue.map((t) => t.id)).size, l.total);
    assert.equal(new Set(l.queue.map((t) => t.mode)).size, 10);
    for (const w of l.vocabulary) assert.equal(l.queue.filter((t) => t.word === w.word).length, 3);
  }
  assert.notDeepEqual(
    learners[0].lesson.queue.map((t) => t.word),
    learners[1].lesson.queue.map((t) => t.word),
  );
  for (const learner of learners) {
    let l = learner.lesson,
      count = 0,
      levels = [],
      hadHint = false,
      invalid = false;
    while (l.queue.length) {
      const t = course.currentExercise(l);
      levels.push({ band: l.queue[0].band, level: t.level });
      const copy = (await req('/api/student/me', undefined, learner.auth)).body.lesson;
      assert.deepEqual(
        course.currentExercise(copy),
        t,
        'reload preserves exercise and adaptive level',
      );
      if (t.exercise && !invalid) {
        const bad = await req(
          '/api/student/answer',
          { questionId: t.id, answer: null },
          learner.auth,
        );
        assert.equal(bad.response.status, 400);
        invalid = true;
      }
      let answer = answerFor(t);
      if (!learner.good) {
        if (!t.exercise)
          answer = t.mode === 'spelling' ? 'z'.repeat(t.content.word.length) : ['wrong'];
        else if (t.exercise.kind === 'match')
          answer = JSON.stringify(t.solution.map((p, i, a) => [p[0], a[(i + 1) % a.length][1]]));
        else if (t.exercise.kind === 'order') answer = JSON.stringify(JSON.parse(answer).reverse());
        else
          answer =
            t.exercise.choices?.find((x) => x.toLowerCase() !== t.solution.toLowerCase()) ||
            'wrong';
      }
      const hint = learner.good && t.exercise && l.queue[0].band === 1 && !hadHint;
      if (hint) {
        hadHint = true;
        assert.ok(course.currentExercise(l, l.vocabulary, 1).exercise.hint);
      }
      const post = { questionId: t.id, answer, hintUsed: hint };
      const result = await req('/api/student/answer', post, learner.auth);
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.correct, learner.good);
      const retry = await req('/api/student/answer', post, learner.auth);
      assert.equal(retry.body.duplicate, true);
      assert.deepEqual(retry.body.lesson, result.body.lesson);
      l = result.body.lesson;
      count++;
      assert.ok(count < l.total + 2 * l.rounds + 3, 'wrong answers never create an endless lesson');
      if (l.lastRound) {
        assert.ok(l.lastRound.answers <= 8, 'six main questions plus bounded review');
        const next = await req('/api/student/start', {}, learner.auth);
        l = next.body.lesson;
      }
    }
    assert.equal(l.completed, l.total);
    assert.ok(
      learner.good
        ? levels.some((x) => x.band === 2 && x.level === 3)
        : levels.every((x) => x.level === 1),
    );
    if (!learner.good) {
      assert.ok(l.needsReview.some((k) => k.endsWith(':sentence')));
      const review = await req('/api/student/start', { review: true }, learner.auth);
      assert.equal(review.body.lesson.format, 'adaptive-four');
      assert.equal(review.body.lesson.practiceMode, 'review');
      assert.ok(review.body.lesson.queue.some((q) => q.mode === 'sentence'));
      assert.ok(
        review.body.lesson.queue.every((q) => l.needsReview.includes(q.word + ':' + q.mode)),
      );
    }
  }
  const progress = (await req('/api/teacher/progress?class=' + room.id, undefined, teacher)).body;
  assert.ok(progress.attempts.some((a) => a.mode === 'sentence' && JSON.parse(a.answer).expected));
  assert.ok(progress.students[0].skills.some((w) => w.modes.audioCloze?.attempts));
  assert.ok(progress.students[1].needsHelp > 0);
  const csv = await req('/api/teacher/export?class=' + room.id, undefined, teacher);
  assert.ok(csv.body.includes('audioMatch') && csv.body.includes('sentence'));
}
console.log(
  'PASS: three curricula, 10 exercise types without question-count inflation, bounded short rounds/review, adaptive supports, reload, malformed submissions, idempotence, focused review, detailed teacher records and CSV, with legacy class compatibility.',
);
