import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';
import { auditTeachingContent } from '../public/shared/content-audit.js';
const env = { DB: database(), TEACHER_PASSWORD: 'audit-test' };
const login = await worker.fetch(
  new Request('https://audit.test/api/teacher/login', {
    method: 'POST',
    body: JSON.stringify({ password: env.TEACHER_PASSWORD }),
  }),
  env,
);
const headers = { cookie: login.headers.get('set-cookie').split(';')[0] };
const config = await (
  await worker.fetch(new Request('https://audit.test/api/teacher/config', { headers }), env)
).json();
const original = JSON.stringify(config);
const report = await (
  await worker.fetch(new Request('https://audit.test/api/teacher/config/audit', { headers }), env)
).json();
assert.equal(report.profiles.length, 17);
assert.equal(report.words, 387);
assert.equal(report.errors, 0);
assert.equal(report.warnings, 0);
const custom = structuredClone(config.config),
  words = custom.unit1.words;
words[0].distractors = [' ' + words[0].meaning + ' '];
words[1].meaning = words[0].meaning;
words[2].example = '';
words[3].example = 'I like apples.';
words[4].image = '/assets/missing.png';
words[5].audio = '/api/audio/missing';
words[6].word = words[0].word;
words[7].image = words[8].image;
const changed = JSON.stringify(custom),
  bad = auditTeachingContent(custom, (p) => !p.includes('missing'));
const grammar = structuredClone(config.config);
grammar.unit1.words[0].example = 'I is happy.';
grammar.unit1.words[1].example = 'I have the the book.';
grammar.unit1.words[2].example = 'I like ' + 'English '.repeat(20);
const flags = auditTeachingContent(grammar).issues;
for (const code of ['basic-agreement', 'repeated-word', 'long-example'])
  assert.ok(flags.some((i) => i.code === code));
for (const code of [
  'duplicate-choice',
  'ambiguous-meaning',
  'missing-example',
  'example-fallback',
  'missing-image',
  'missing-audio',
  'duplicate-word',
  'shared-picture',
])
  assert.ok(
    bad.issues.some((i) => i.code === code),
    code,
  );
assert.equal(JSON.stringify(custom), changed, 'Checking never rewrites teacher content');
assert.equal(JSON.stringify(config), original);
assert.equal(
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM app_config').first()).n,
  0,
  'Read-only check never creates configuration rows',
);
console.log(
  'Content quality: all 17 default profiles / 387 entries pass; missing resources, duplicate choices/meanings/pictures/words and unusable examples are flagged without changing content.',
);
