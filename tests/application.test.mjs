import assert from 'node:assert/strict';
import { createApplication } from '../server/application.mjs';
import { APP_VERSION } from '../public/shared/release.js';
import { database } from './database.mjs';

const bank = ['cat', 'dog', 'bird', 'fish'].map((word, i) => ({
  word,
  meaning: '意味' + i,
  group: 'other',
}));
function application(title, words = bank) {
  const text = Buffer.from('<h1>' + title + '</h1>');
  return createApplication({
    words,
    gradeFiveVocabulary: bank,
    unitSevenVocabulary: bank,
    raceAvatarCatalog: [],
    assets: {
      '/teacher-home.html': {
        type: 'text/html; charset=utf-8',
        data: text.toString('base64'),
        size: text.length,
      },
    },
  });
}
const first = application('First'),
  second = application('Second', bank.slice().reverse());
const firstEnv = { DB: database(), TEACHER_PASSWORD: 'first-password' };
const secondEnv = { DB: database(), TEACHER_PASSWORD: 'second-password' };
const request = (app, env, path, data, headers = {}) =>
  app.fetch(
    new Request('https://classroom.test' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
for (const [app, title] of [
  [first, 'First'],
  [second, 'Second'],
]) {
  assert.equal(await (await request(app, {}, '/')).text(), '<h1>' + title + '</h1>');
  assert.deepEqual(await (await request(app, {}, '/api/health')).json(), {
    ok: true,
    version: APP_VERSION,
  });
}
const login = await request(first, firstEnv, '/api/teacher/login', { password: 'first-password' });
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie').split(';')[0];
const config = await request(first, firstEnv, '/api/teacher/config', undefined, { cookie });
assert.equal(config.status, 200);
assert.deepEqual(
  (await config.json()).config.words.map((w) => w.word),
  bank.map((w) => w.word),
);
assert.equal(
  (await request(second, secondEnv, '/api/teacher/config', undefined, { cookie })).status,
  401,
  'sessions belong to their database, not application globals',
);
assert.equal(
  (
    await request(
      first,
      firstEnv,
      '/api/teacher/classes',
      {},
      { cookie, origin: 'https://other.test' },
    )
  ).status,
  403,
);
const loginSecond = await request(second, secondEnv, '/api/teacher/login', {
  password: 'second-password',
});
const secondCookie = loginSecond.headers.get('set-cookie').split(';')[0];
const secondConfig = await request(second, secondEnv, '/api/teacher/config', undefined, {
  cookie: secondCookie,
});
assert.deepEqual(
  (await secondConfig.json()).config.words.map((w) => w.word),
  bank.map((w) => w.word).reverse(),
);
assert.equal((await request(first, firstEnv, '/not-a-route')).status, 404);
console.log(
  'Application composition: direct ESM boot, independent catalogs/assets, isolated sessions, authenticated configuration, health and origin guards passed.',
);
