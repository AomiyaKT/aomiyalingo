import assert from 'node:assert/strict';
import { createRaceReset } from '../public/race/reset.js';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';

let data = { race: { id: 'old', title: 'Previous race', status: 'finished' } };
let busy = false;
let confirmation;
let ended = [];
let prepared = [];
let returned = 0;
let failure = null;
const reset = createRaceReset({
  getData: () => data,
  isBusy: () => busy,
  confirm: (...args) => {
    confirmation = args;
  },
  endRace: async (id) => {
    ended.push(id);
    if (failure) throw failure;
    return { race: { id, status: 'finished' } };
  },
  onPrepare: (result) => prepared.push(result),
  onReturn: () => returned++,
});
reset.request();
assert.equal(reset.preparing, true);
assert.equal(prepared[0], data);
assert.equal(ended.length, 0, 'Finished results enter setup without a server write');
reset.back();
assert.equal(reset.preparing, false);
assert.equal(returned, 1);

for (const status of ['lobby', 'countdown', 'running', 'paused', 'intermission']) {
  data = { race: { id: status, title: 'Active race', status } };
  confirmation = null;
  const before = prepared.length;
  reset.request();
  assert.equal(reset.preparing, false);
  assert.match(confirmation[0], /リセット/);
  assert.equal(ended.length, 0, 'Showing/canceling confirmation does not stop a race');
  assert.equal(prepared.length, before);
}
data = { race: { id: 'captured-race', title: 'Active race', status: 'running' } };
reset.request();
data = { race: { id: 'different-history-selection', status: 'finished' } };
failure = Error('network unavailable');
await assert.rejects(confirmation[2](), /network unavailable/);
assert.equal(reset.preparing, false, 'A failed stop cannot present an editable new race');
assert.equal(ended.at(-1), 'captured-race', 'The confirmed race ID is pinned');
failure = null;
await confirmation[2]();
assert.equal(reset.preparing, true);
assert.equal(prepared.at(-1).race.id, 'captured-race');
reset.complete();
assert.equal(reset.preparing, false);
const previous = prepared.length;
busy = true;
reset.request();
assert.equal(prepared.length, previous);
reset.back();
assert.equal(returned, 1);
busy = false;
data = { race: null };
reset.request();
assert.equal(prepared.length, previous);

// The reset uses the existing authorized end transition; creating a new room
// keeps the old room and its learner records under their original IDs.
const env = { DB: database(), TEACHER_PASSWORD: 'reset-test' };
async function request(path, body, headers = {}) {
  const response = await worker.fetch(
    new Request('https://classroom.test' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
  assert.equal(response.status, 200, path + ': ' + response.status);
  return { value: await response.clone().json(), response };
}
const login = await request('/api/teacher/login', { password: 'reset-test' });
const teacher = { cookie: login.response.headers.get('set-cookie').split(';')[0] };
const old = (await request('/api/teacher/race/create', { title: 'Before reset' }, teacher)).value;
const student = (await request('/api/race/join', { raceId: old.raceId, label: '1' })).value;
const before = await env.DB.prepare('SELECT * FROM racers WHERE id=?')
  .bind(student.self.id)
  .first();
const stopped = (
  await request(
    '/api/teacher/race/state',
    {
      raceId: old.raceId,
      action: 'end',
      confirm: true,
    },
    teacher,
  )
).value;
assert.equal(stopped.race.status, 'finished');
const newRace = (await request('/api/teacher/race/create', { title: 'After reset' }, teacher))
  .value;
assert.notEqual(newRace.raceId, old.raceId);
const current = (await request('/api/teacher/race/current', undefined, teacher)).value;
assert.equal(current.race.id, newRace.raceId);
assert.equal(current.race.status, 'lobby');
assert.equal(current.players.length, 0);
const oldBoard = (await request('/api/teacher/race/board?race=' + old.raceId, undefined, teacher))
  .value;
assert.equal(oldBoard.race.status, 'finished');
assert.equal(oldBoard.players.length, 1);
const after = await env.DB.prepare('SELECT * FROM racers WHERE id=?').bind(student.self.id).first();
assert.equal(after.state, before.state);
assert.equal(after.race_id, old.raceId);
console.log(
  'Race reset: ended setup without writes, confirmation/cancel, pinned target, failure recovery, busy guards, fresh room identity and preserved historical participants passed.',
);
