import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
const source = { DB: database(), TEACHER_PASSWORD: 'source-test' },
  target = { DB: database(), TEACHER_PASSWORD: 'target-test' };
async function request(env, path, data, headers = {}) {
  const response = await worker.fetch(
    new Request('https://backup.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { response, status: response.status, body: await response.json() };
}
async function login(env) {
  const r = await request(env, '/api/teacher/login', { password: env.TEACHER_PASSWORD });
  return { cookie: r.response.headers.get('set-cookie').split(';')[0] };
}
const from = await login(source),
  to = await login(target);
for (const path of ['/api/teacher/config/backup', '/api/teacher/config/audit'])
  assert.equal((await request(source, path)).status, 401);
const original = (await request(source, '/api/teacher/config', undefined, from)).body;
const bytes = Buffer.alloc(44);
bytes.write('RIFF');
bytes.write('WAVE', 8);
const audio = (
  await request(
    source,
    '/api/teacher/config/audio',
    { mime: 'audio/wav', data: bytes.toString('base64') },
    from,
  )
).body.audio;
original.config.words[0].audio = audio;
original.config.words[0].meaning = '食べました';
assert.equal((await request(source, '/api/teacher/config', original, from)).status, 200);
const backup = (await request(source, '/api/teacher/config/backup', undefined, from)).body;
assert.equal(
  (await request(target, '/api/teacher/config/audit', undefined, to)).body.hasPreviousBackup,
  false,
);
const oversized = structuredClone(backup);
oversized.config.extra = 'x'.repeat(512001);
assert.equal(
  (await request(target, '/api/teacher/config/backup/inspect', { backup: oversized }, to)).status,
  400,
  'Import uses the same configuration-size budget as the editor',
);
assert.equal(backup.audio.length, 1);
assert.equal(JSON.stringify(backup).includes('source-test'), false);
assert.equal(Object.hasOwn(backup, 'students'), false);
const room = (await request(target, '/api/teacher/classes', { title: 'Keep current lesson' }, to))
  .body;
const joined = (await request(target, '/api/join', { classId: room.id, label: '23' })).body;
const oldLesson = (
  await target.DB.prepare('SELECT lesson FROM students WHERE id=?').bind(joined.id).first()
).lesson;
const inspect = (await request(target, '/api/teacher/config/backup/inspect', { backup }, to)).body;
assert.equal(inspect.profiles, 17);
assert.equal(inspect.audio, 1);
const restore = { backup, revision: inspect.revision, digest: inspect.digest, confirm: true };
assert.equal(
  (await request(target, '/api/teacher/config/backup/restore', { ...restore, confirm: false }, to))
    .status,
  409,
);
assert.equal(
  (
    await request(target, '/api/teacher/config/backup/restore', restore, {
      ...to,
      origin: 'https://evil.test',
    })
  ).status,
  403,
);
assert.equal(
  (await request(target, '/api/teacher/config/backup/restore', restore, to)).status,
  200,
);
const current = (await request(target, '/api/teacher/config', undefined, to)).body;
assert.equal(
  (await request(target, '/api/teacher/config/audit', undefined, to)).body.hasPreviousBackup,
  true,
);
assert.equal(current.config.words[0].meaning, '食べました');
assert.notEqual(current.config.words[0].audio, audio, 'Imported recordings get collision-free IDs');
const clip = await worker.fetch(
  new Request('https://backup.test' + current.config.words[0].audio),
  target,
);
assert.deepEqual(Buffer.from(await clip.arrayBuffer()), bytes);
assert.equal(
  (await target.DB.prepare('SELECT lesson FROM students WHERE id=?').bind(joined.id).first())
    .lesson,
  oldLesson,
);
const previous = (await request(target, '/api/teacher/config/backup?previous=1', undefined, to))
  .body;
assert.equal(
  previous.config.words[0].meaning,
  '食べた',
  'Pre-import settings are automatically recoverable',
);
assert.equal(
  (await request(target, '/api/teacher/config/backup/restore', restore, to)).status,
  409,
  'Stale preview cannot overwrite a newer configuration',
);
const corrupt = structuredClone(backup);
corrupt.audio[0].data = 'bad';
assert.equal(
  (await request(target, '/api/teacher/config/backup/inspect', { backup: corrupt }, to)).status,
  400,
);
const missing = structuredClone(backup);
missing.audio = [];
assert.equal(
  (await request(target, '/api/teacher/config/backup/inspect', { backup: missing }, to)).status,
  400,
);
const foreign = structuredClone(backup);
foreign.config.words[1].audio = '/assets/words/not-existing.wav';
assert.equal(
  (await request(target, '/api/teacher/config/backup/inspect', { backup: foreign }, to)).status,
  400,
);
const prepare = target.DB.prepare;
target.DB.prepare = (sql) => {
  const statement = prepare(sql);
  if (sql.startsWith('INSERT INTO teaching_backup'))
    statement.run = async () => {
      throw Error('injected backup failure');
    };
  return statement;
};
const retryInspect = (await request(target, '/api/teacher/config/backup/inspect', { backup }, to))
  .body;
const beforeClips = (await target.DB.prepare('SELECT COUNT(*) AS n FROM config_audio').first()).n;
assert.equal(
  (
    await request(
      target,
      '/api/teacher/config/backup/restore',
      { backup, ...retryInspect, confirm: true },
      to,
    )
  ).status,
  503,
);
assert.deepEqual(
  (await request(target, '/api/teacher/config', undefined, to)).body,
  current,
  'A failed import rolls back settings and audio together',
);
assert.equal(
  (await target.DB.prepare('SELECT COUNT(*) AS n FROM config_audio').first()).n,
  beforeClips,
);
target.DB.prepare = prepare;
console.log(
  'Teaching backup: teacher auth, full curriculum/custom-audio round trip, checksum and asset validation, confirmation/revision/CSRF guards, preserved classroom snapshots, automatic previous backup and atomic rollback passed.',
);
