import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { recordSyncQuery, restoreRaceRecords } from '../public/shared/race-record-sync.js';

const env = { DB: database(), TEACHER_PASSWORD: 'local-protocol-test' };
async function request(path, data, headers = {}) {
  return worker.fetch(
    new Request('https://local.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
}
const login = await request('/api/teacher/login', { password: env.TEACHER_PASSWORD });
const auth = { cookie: login.headers.get('set-cookie').split(';')[0] };
const created = await request(
  '/api/teacher/race/create',
  { title: 'Local protocol fixture', grade: 5, unit: '1', endless: true, format: 'classic' },
  auth,
);
const { raceId } = await created.json();
const history = Array.from({ length: 180 }, (_, i) => ({
  word: 'math',
  mode: 'text',
  answer: '算数',
  expected: '算数',
  correct: true,
  points: 100,
  station: 0,
}));
const state = {
  history,
  index: 180,
  score: 18000,
  correct: 180,
  streak: 10,
  bestStreak: 10,
  avatar: 'cat',
  ready: true,
  prepared: true,
  wrong: [],
  joinedElapsed: 0,
};
for (let i = 0; i < 35; i++)
  await env.DB.prepare(
    'INSERT INTO racers (id,race_id,label,number,token_hash,state,last_seen,revision) VALUES (?,?,?,?,?,?,?,?)',
  )
    .bind(
      'p' + i,
      raceId,
      String(i + 1),
      i + 1,
      'test-hash-' + i,
      JSON.stringify(state),
      Date.now(),
      180,
    )
    .run();
const full = await (await request('/api/teacher/race/current', undefined, auth)).json();
assert.equal(full.players.length, 35);
assert.equal(full.players[0].history.length, 180);
const query = recordSyncQuery(full);
const compact = await (
  await request('/api/teacher/race/current?' + query.slice(1), undefined, auth)
).json();
assert.equal(
  compact.players.some((p) => 'history' in p),
  false,
);
assert.deepEqual(restoreRaceRecords(compact, full), full);
await env.DB.prepare('UPDATE racers SET revision=revision+1,state=? WHERE id=?')
  .bind(
    JSON.stringify({
      ...state,
      history: [...history, { word: 'science', correct: false, points: 0, station: 0 }],
      index: 181,
    }),
    'p0',
  )
  .run();
const boardPath = '/api/teacher/race/board?race=' + raceId;
const delta = await (await request(boardPath + query, undefined, auth)).json();
assert.equal(delta.players.filter((p) => 'history' in p).length, 1);
assert.equal(
  restoreRaceRecords(delta, full).players.find((p) => p.id === 'p0').history.length,
  181,
);
const fresh = await (await request(boardPath, undefined, auth)).json();
assert.deepEqual(
  restoreRaceRecords(delta, full),
  fresh,
  'Delta merging matches a full authoritative reload',
);
for (const path of ['/api/teacher/race/current?' + query.slice(1), boardPath + query]) {
  assert.equal(
    (await request(path)).status,
    401,
    'History deltas remain behind teacher authentication',
  );
  assert.equal(
    (await request(path, undefined, { authorization: 'Bearer test-hash-0' })).status,
    401,
  );
}
const foreignQuery = recordSyncQuery({ ...full, race: { ...full.race, id: 'another-race' } });
const foreign = await (await request(boardPath + foreignQuery, undefined, auth)).json();
assert.equal(
  foreign.players.filter((p) => Array.isArray(p.history)).length,
  35,
  'Race identity guards cached revisions',
);
console.log(
  'Delivered record protocol: 35 real DB participants, full bootstrap, exact current/board delta recovery, one changed learner, fresh reload equivalence and teacher-only access passed.',
);
