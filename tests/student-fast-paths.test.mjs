import assert from 'node:assert/strict';
import { createClassroomStudent } from '../server/classroom/student.mjs';

let reads = 0,
  authenticated = true,
  paused = false,
  statements = 0;
const lesson = { queue: [], attempts: 0, needsReview: [] };
const learner = {
  id: 'student',
  class_id: 'room',
  label: '1',
  get lesson() {
    reads++;
    return JSON.stringify(lesson);
  },
};
const route = createClassroomStudent({
  student: async () => (authenticated ? learner : null),
  json: (data, status = 200) => Response.json(data, { status }),
  stmt: (_env, sql) => {
    statements++;
    return {
      first: async () =>
        sql.includes('FROM classrooms WHERE id=')
          ? { id: 'room', active: 1, paused, title: 'Class' }
          : null,
      run: async () => ({ meta: { changes: 1 } }),
    };
  },
  roomState: (room) => ({ active: room.active, paused: room.paused }),
  now: () => 10,
  body: (req) => req.json(),
  validLabel: (value) => value,
  closed: () => Response.json({ closed: true }, { status: 423 }),
});
async function call(path, method = 'GET', data = {}) {
  const url = new URL('https://class.test/api/student/' + path);
  return route(
    new Request(url, { method, ...(method === 'POST' ? { body: JSON.stringify(data) } : {}) }),
    {},
    url,
  );
}
assert.equal((await call('status')).status, 200);
assert.equal((await call('ping', 'POST')).status, 200);
assert.equal((await call('label', 'POST', { label: '2' })).status, 200);
assert.equal((await call('unknown')).status, 404);
assert.equal(reads, 0, 'polls and attendance updates never materialize the saved lesson');
assert.deepEqual((await (await call('me')).json()).lesson, lesson);
assert.equal(reads, 1);
assert.deepEqual((await (await call('start', 'POST')).json()).lesson, lesson);
assert.equal(reads, 2);
paused = true;
assert.equal((await call('start', 'POST')).status, 423);
assert.equal(reads, 2, 'paused requests stop before lesson parsing');
authenticated = false;
const previousStatements = statements;
assert.equal((await call('status')).status, 401);
assert.equal(statements, previousStatements, 'unauthenticated requests never query classroom data');
assert.equal(reads, 2);
console.log(
  'Student fast paths: authenticated status/ping/label omit lesson parsing; me/start preserve payloads and paused/auth guards passed.',
);
