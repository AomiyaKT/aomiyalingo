import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const disk = new Map();
let writes = 0;
const host = {
  window: {},
  localStorage: {
    getItem: (k) => disk.get(k),
    setItem(k, v) {
      writes++;
      disk.set(k, v);
    },
  },
};
vm.runInNewContext(readFileSync('public/race-session.js', 'utf8'), host);
const cache = host.window.raceSessionCache;
const session = { token: 'local-test', raceId: 'r1', label: '1' };
cache.save(session);
assert.equal(writes, 1);
for (let i = 0; i < 1000; i++) cache.save({ ...session });
assert.equal(writes, 1, 'Unchanged polling must not rewrite synchronous session storage');
const saved = cache.find('r1', '01');
cache.save(saved);
assert.equal(writes, 1, 'Restore timestamps are not session data');
cache.save({ ...session, pending: { questionId: 'q1', answer: 'math' } });
assert.equal(writes, 2);
cache.save({ ...session, pending: null });
assert.equal(writes, 3, 'An acknowledged answer is durably removed');
cache.save({ ...session, token: 'rotated', pending: null });
assert.equal(writes, 4);
cache.remove(session);
assert.equal(cache.find('r1', '1'), null);
for (const corrupt of ['[]', '123', '"text"', 'null', '{bad']) {
  disk.set('aomi.race.sessions', corrupt);
  cache.save(session);
  assert.equal(
    cache.find('r1', '1').token,
    session.token,
    'Malformed storage roots recover safely',
  );
}
disk.set(
  'aomi.race.sessions',
  JSON.stringify({ broken: null, bad: { token: 'missing identity' } }),
);
cache.save(session);
assert.equal(cache.find('r1', '1').token, session.token);
disk.set('aomi.race.sessions', JSON.stringify({ 'r1:1': { ...session, raceId: 'other' } }));
assert.equal(cache.find('r1', '1'), null, 'A corrupt index cannot restore another race credential');
cache.remove(null);
console.log(
  'Session storage: 1,000 unchanged polls write zero times; pending answers, acknowledgement, token changes and removal remain durable.',
);
