import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
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
  let body;
  try {
    body = await response.clone().json();
  } catch {}
  return { status: response.status, body, response };
}
const login = await req('/api/teacher/login', { password: 'test-password' }),
  auth = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const cfg = (await req('/api/teacher/config', undefined, auth)).body;
assert.equal(cfg.config.words.length, 28);
const five = cfg.config.grade5.words;
assert.equal(five.length, 20);
assert.equal(five.filter((w) => w.group === 'family').length, 11);
assert.equal(five.filter((w) => w.group === 'adjective').length, 9);
assert.deepEqual(
  five.map((w) => w.word),
  [
    'grandparents',
    'grandmother',
    'grandfather',
    'parents',
    'mother',
    'father',
    'sister',
    'brother',
    'aunt',
    'uncle',
    'cousin',
    'cheerful',
    'funny',
    'kind',
    'brave',
    'smart',
    'strong',
    'friendly',
    'cool',
    'cute',
  ],
);
for (const word of five) {
  const r = await req(word.audio);
  assert.equal(r.status, 200);
  assert.equal(r.response.headers.get('content-type'), 'audio/wav');
  const bytes = new Uint8Array(await r.response.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.ok(bytes.length > 10000);
}
assert.equal((await req('/api/teacher/classes', { grade: 4 }, auth)).status, 400);
assert.equal((await req('/api/teacher/race/create', { grade: 7 }, auth)).status, 400);
const six = (await req('/api/teacher/classes', { title: 'Existing sixth' }, auth)).body;
assert.equal(six.grade, 6);
assert.equal(JSON.parse(six.vocabulary).length, 28);
const family = (await req('/api/teacher/classes', { grade: 5, wordGroup: 'family' }, auth)).body;
assert.equal(family.grade, 5);
let joined = (await req('/api/join', { classId: family.id, label: '1' })).body;
assert.equal(joined.lesson.total, 33);
assert.equal(joined.lesson.grade, 5);
assert.ok(joined.lesson.vocabulary.every((w) => w.group === 'family'));
const room = (await req('/api/teacher/classes', { grade: 5 }, auth)).body;
joined = (await req('/api/join', { classId: room.id, label: '2' })).body;
const student = { authorization: 'Bearer ' + joined.token };
assert.equal(joined.lesson.total, 60);
assert.equal(joined.lesson.grade, 5);
// Exercise all modes through authoritative grading, including long family spellings.
let lesson = joined.lesson;
const seen = new Set();
while (lesson.queue.length) {
  const t = lesson.queue[0],
    w = five.find((w) => w.word === t.word);
  seen.add(t.mode);
  const r = await req(
    '/api/student/answer',
    {
      questionId: t.id,
      answer: t.mode === 'text' ? [w.meaning] : t.mode === 'voice' ? [w.word] : w.word,
    },
    student,
  );
  assert.equal(r.status, 200);
  lesson = r.body.lesson;
  assert.equal(lesson.grade, 5);
}
assert.equal(seen.size, 3);
const oldSnapshot = room.vocabulary;
const c = structuredClone(cfg.config);
c.grade5.words.find((w) => w.word === 'cute').meaning = 'かわいらしい';
c.grade5.course.roundSize = 4;
c.grade5.race.questions = 6;
c.grade5.race.countdown = 0;
c.grade5.race.itemEvery = 3;
const invalid = structuredClone(c);
invalid.grade5.words[0].word = 'INVALID!';
assert.equal(
  (await req('/api/teacher/config', { config: invalid, revision: 0 }, auth)).status,
  400,
);
assert.equal((await req('/api/teacher/config', { config: c, revision: 0 }, auth)).status, 200);
assert.deepEqual(
  (await req('/api/teacher/config', undefined, auth)).body.config.words,
  cfg.config.words,
);
assert.equal(
  (await env.DB.prepare('SELECT vocabulary FROM classrooms WHERE id=?').bind(room.id).first())
    .vocabulary,
  oldSnapshot,
);
const next = (await req('/api/teacher/classes', { grade: 5 }, auth)).body;
assert.equal(next.round_size, 4);
assert.equal(JSON.parse(next.vocabulary).find((w) => w.word === 'cute').meaning, 'かわいらしい');
const raceId = (
    await req('/api/teacher/race/create', { grade: 5, title: 'Fifth grade race' }, auth)
  ).body.raceId,
  tasks = JSON.parse(
    (await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks,
  );
assert.equal(tasks.length, 18);
assert.equal(tasks[0].settings.questionsPerStation, 6);
assert.equal(tasks[0].settings.grade, 5);
assert.equal(tasks[0].pool.length, 20);
assert.ok(tasks.every((t) => five.some((w) => w.word === t.word)));
const racer = (await req('/api/race/join', { raceId, label: '3' })).body;
assert.equal(racer.race.settings.grade, 5);
await req('/api/teacher/race/state', { raceId, action: 'start' }, auth);
const ordered = JSON.parse(
  (await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(racer.self.id).first()).state,
).taskOrder.map((i) => tasks[i]);
for (const [index, t] of ordered.entries()) {
  if (index > 0 && index % 6 === 0) {
    const transition = await req(
      '/api/teacher/race/state',
      { raceId, action: 'nextStation' },
      auth,
    );
    assert.equal(transition.status, 200);
    assert.equal(transition.body.race.station, index / 6);
  }
  const r = await req(
    '/api/race/answer',
    { questionId: t.id, answer: t.mode === 'text' ? t.content.meaning : t.word },
    { authorization: 'Bearer ' + racer.token },
  );
  assert.equal(r.status, 200);
}
const sixRace = (await req('/api/teacher/race/create', { title: 'Sixth remains' }, auth)).body
  .raceId;
const sixTasks = JSON.parse(
  (await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(sixRace).first()).tasks,
);
assert.equal(sixTasks.length, 72);
assert.equal(sixTasks[0].settings.grade, 6);
assert.equal(sixTasks[0].pool.length, 28);
// Older editors cannot inadvertently erase the fifth-grade bank.
const oldClient = structuredClone(c);
delete oldClient.grade5;
assert.equal(
  (await req('/api/teacher/config', { config: oldClient, revision: 1 }, auth)).status,
  200,
);
assert.equal(
  (await req('/api/teacher/config', undefined, auth)).body.config.grade5.words.find(
    (w) => w.word === 'cute',
  ).meaning,
  'かわいらしい',
);
console.log(
  'PASS: 20 textbook words and recordings, 11/9 groups, grade routing/validation, 60 exercises across three modes, independent editing/defaults, fifth/sixth races, snapshots, old-client preservation.',
);
