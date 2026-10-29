import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
const base = database();
let conflict = null;
const env = {
  DB: {
    prepare: (sql) => base.prepare(sql),
    async batch(items) {
      if (conflict) {
        const p = conflict;
        conflict = null;
        const row = await base.prepare('SELECT state FROM racers WHERE id=?').bind(p).first();
        const state = JSON.parse(row.state);
        state.avatar = 'fox';
        await base
          .prepare('UPDATE racers SET state=?,revision=revision+1 WHERE id=?')
          .bind(JSON.stringify(state), p)
          .run();
      }
      return base.batch(items);
    },
  },
  TEACHER_PASSWORD: 'test-password',
};
async function request(path, data, headers = {}) {
  const r = await worker.fetch(
    new Request('https://test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { status: r.status, body: await r.json(), r };
}
const login = await request('/api/teacher/login', { password: 'test-password' }),
  teacher = { cookie: login.r.headers.get('set-cookie').split(';')[0] };
const race = (await request('/api/teacher/race/create', { title: 'Station transaction' }, teacher))
  .body.raceId;
const one = (await request('/api/race/join', { raceId: race, label: '1' })).body;
const two = (await request('/api/race/join', { raceId: race, label: '2' })).body;
await base.prepare("UPDATE races SET status='intermission' WHERE id=?").bind(race).run();
conflict = one.self.id;
const result = await request(
  '/api/teacher/race/state',
  { raceId: race, action: 'nextStation' },
  teacher,
);
assert.equal(result.status, 409);
let room = await base.prepare('SELECT * FROM races WHERE id=?').bind(race).first();
assert.equal(room.station, 0, 'A conflicting racer must not partially advance the room');
assert.equal(room.status, 'intermission');
const state = async (id) =>
  JSON.parse((await base.prepare('SELECT state FROM racers WHERE id=?').bind(id).first()).state);
assert.equal((await state(one.self.id)).avatar, 'fox', 'The concurrent accepted edit survives');
assert.equal((await state(two.self.id)).index, 0, 'Other racers are not partially advanced');
assert.equal(
  (await request('/api/teacher/race/state', { raceId: race, action: 'nextStation' }, teacher))
    .status,
  200,
);
room = await base.prepare('SELECT * FROM races WHERE id=?').bind(race).first();
assert.equal(room.station, 1);
assert.equal((await state(one.self.id)).index, (await state(two.self.id)).index);
console.log(
  'Station transition: concurrent racer revision leaves every course snapshot untouched, then safe retry advances everyone together.',
);
