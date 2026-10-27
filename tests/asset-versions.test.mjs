import assert from 'node:assert/strict';
import { versionAssetLinks } from '../scripts/asset-versions.mjs';
import worker from '../dist/server/index.js';
import { database } from './database.mjs';

const assets = { '/app.js': { etag: '"new-js"' }, '/ui/home.css': { etag: '"new-css"' } };
const html = `<script defer src='/app.js?lang=ja&amp;v=old#part'></script>
<link href="/ui/home.css"\n rel="stylesheet">
<a href="/app.js?v=old">Download</a><script src="//external.test/app.js"></script>
<script src="https://external.test/app.js"></script><link rel="icon" href="/app.js">
<script src="/missing.js"></script><script>const value = 'unchanged';</script>`;
const versioned = versionAssetLinks(html, assets);
assert.ok(versioned.includes("src='/app.js?lang=ja&amp;v=new-js#part'"));
assert.ok(versioned.includes('href="/ui/home.css?v=new-css"'));
for (const untouched of [
  '<a href="/app.js?v=old">',
  'src="//external.test/app.js"',
  'src="https://external.test/app.js"',
  '<link rel="icon" href="/app.js">',
  'src="/missing.js"',
  "const value = 'unchanged';",
])
  assert.ok(versioned.includes(untouched));
assert.equal(
  versionAssetLinks(versioned, assets),
  versioned,
  'unchanged bytes produce stable links',
);
assert.notEqual(
  versionAssetLinks(html, { ...assets, '/app.js': { etag: '"changed"' } }),
  versioned,
);

// Every delivered page must reference the final bundled bytes' etag. This also
// catches dependency changes hidden behind a stable entry point source file.
const env = { DB: database(), TEACHER_PASSWORD: 'test-password' };
let count = 0;
const hashes = new Map();
for (const path of [
  '/index.html',
  '/teacher.html',
  '/teacher-home.html',
  '/race.html',
  '/race-teacher.html',
  '/teacher-editor.html',
]) {
  const response = await worker.fetch(new Request('https://class.test' + path), env);
  assert.equal(response.status, 200);
  const page = await response.text();
  for (const match of page.matchAll(
    /<(?:script|link)\b[^>]*\s(?:src|href)="(\/[^"\s]+\.(?:js|css)\?[^"\s]+)"/g,
  )) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://class.test');
    if (!hashes.has(url.pathname)) {
      const asset = await worker.fetch(new Request(url), env);
      assert.equal(asset.status, 200);
      hashes.set(url.pathname, asset.headers.get('etag')?.replaceAll('"', ''));
    }
    assert.match(url.searchParams.get('v'), /^[a-f0-9]{64}$/);
    assert.equal(url.searchParams.get('v'), hashes.get(url.pathname), url.pathname);
    count++;
  }
}
assert.ok(count >= 40, 'all six screens are covered');
console.log(
  `Asset versions: ${count} delivered entry links match final content hashes; repeatability, preserved parameters and external/non-resource exclusions passed.`,
);
