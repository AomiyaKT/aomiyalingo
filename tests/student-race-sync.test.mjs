import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { createRaceApi } from '../public/race/api.js';
import { createStudentRaceSync } from '../public/shared/student-race-sync.js';
const env = { DB: database(), TEACHER_PASSWORD: 'student-sync-test' };
async function req(path, body, headers = {}) {
  return worker.fetch(
    new Request('https://sync.test' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
}
const login = await req('/api/teacher/login', { password: env.TEACHER_PASSWORD }),
  teacher = { cookie: login.headers.get('set-cookie').split(';')[0] };
const { raceId } = await (
  await req(
    '/api/teacher/race/create',
    { title: 'Student sync', grade: 5, unit: '1', endless: true, format: 'adaptive-four' },
    teacher,
  )
).json();
let session = null;
const frames = [];
const api = createRaceApi({
  getSession: () => session,
  fetch: async (path, options) => {
    const r = await worker.fetch(new Request('https://sync.test' + path, options), env);
    frames.push({ path, status: r.status, data: await r.clone().json() });
    return r;
  },
});
const joined = await api('/api/race/join', { raceId, label: '23' });
session = { token: joined.token };
const initial = await api('/api/race/me', undefined, true);
assert.equal(
  Object.hasOwn(frames.at(-1).data.self, 'history'),
  false,
  'Join result seeds the private cache',
);
assert.equal(initial.self.history, joined.self.history);
await api('/api/race/ready', { avatar: 'fox' }, true);
await req('/api/teacher/race/state', { raceId, action: 'start' }, teacher);
await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?')
  .bind(Date.now() - 1000, raceId)
  .run();
const play = await api('/api/race/me', undefined, true);
assert.ok(play.self.task);
assert.ok(play.self.lookahead.length <= 2);
assert.ok(
  play.self.lookahead.every((x) => x.startsWith('/assets/') || x.startsWith('/api/audio/')),
);
const thin = await api('/api/race/me', undefined, true);
assert.equal(thin.self.task, play.self.task);
assert.equal(Object.hasOwn(frames.at(-1).data.self, 'task'), false);
assert.equal(thin.self.history, play.self.history);
const peer = await (await req('/api/race/join', { raceId, label: '24' })).json();
const wrongOwner = await (
  await req('/api/race/me?known=' + encodeURIComponent(play.self.syncKey), undefined, {
    authorization: 'Bearer ' + peer.token,
  })
).json();
assert.equal(wrongOwner.self.id, peer.self.id);
assert.ok(Array.isArray(wrongOwner.self.history));
await req('/api/teacher/race/state', { raceId, action: 'pause' }, teacher);
const paused = await api('/api/race/me', undefined, true);
assert.equal(paused.race.status, 'paused');
assert.ok(
  Object.hasOwn(frames.at(-1).data.self, 'task'),
  'Status transitions replace cached task metadata',
);
await req('/api/teacher/race/state', { raceId, action: 'resume' }, teacher);
const row = await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(play.self.id).first(),
  state = JSON.parse(row.state);
state.history = Array.from({ length: 180 }, (_, i) => ({
  id: 'h' + i,
  word: 'music',
  mode: 'text',
  answer: '音楽',
  correct: true,
  points: 100,
  station: 0,
}));
state.index = 180;
state.correct = 180;
state.score = 18000;
await env.DB.prepare('UPDATE racers SET state=?,revision=revision+1 WHERE id=?')
  .bind(JSON.stringify(state), play.self.id)
  .run();
const full = await api('/api/race/me', undefined, true);
assert.equal(full.self.history.length, 180);
const freshBytes = JSON.stringify(frames.at(-1).data).length;
const next = await api('/api/race/me', undefined, true),
  thinBytes = JSON.stringify(frames.at(-1).data).length;
assert.equal(next.self.history, full.self.history);
assert.ok(thinBytes < freshBytes / 3, 'Repeated history and learning data are omitted');
await req('/api/teacher/race/state', { raceId, action: 'end', confirm: true }, teacher);
const ended = await api('/api/race/me', undefined, true);
assert.equal(ended.self.done, true);
assert.ok(ended.self.learning);
const sync = createStudentRaceSync(),
  a = {
    self: { syncKey: 'a', history: [], learning: {}, task: null, reviewCards: [], lookahead: [] },
  };
sync.merge(a, 'a');
sync.merge({ ...a, self: { ...a.self, syncKey: 'b' } }, 'b');
sync.merge({ ...a, self: { ...a.self, syncKey: 'c' } }, 'c');
assert.equal(sync.query('a'), '', 'Only two credential snapshots are retained');
assert.throws(() => sync.merge({ self: { syncKey: 'other' } }, 'c'), /SESSION_SNAPSHOT_MISSING/);
console.log(
  'Student sync: full bootstrap, credential/race ownership, immutable history/task reuse, live timers, stage changes, bounded private cache and 180-answer payload reduction passed.',
);
console.log(
  JSON.stringify({
    fullBytes: freshBytes,
    unchangedBytes: thinBytes,
    reductionPercent: +((1 - thinBytes / freshBytes) * 100).toFixed(2),
  }),
);
