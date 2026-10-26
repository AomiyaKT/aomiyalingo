import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { versionAssetLinks } from './scripts/asset-versions.mjs';
const assets = {};
function assetRecord(type, bytes) {
  return {
    type,
    size: bytes.byteLength,
    etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"',
    data: bytes.toString('base64'),
  };
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else {
      const key = '/' + path.relative('public', file).replaceAll('\\', '/');
      assets[key] = assetRecord(
        mime[path.extname(file)] || 'application/octet-stream',
        fs.readFileSync(file),
      );
    }
  }
}
walk('public');
// Resolve CSS layers at build time: one cacheable stylesheet per screen surface.
for (const surface of ['home', 'teacher', 'race', 'student', 'editor']) {
  const css = await build({
    entryPoints: ['public/ui/' + surface + '.css'],
    bundle: true,
    external: ['/assets/*'],
    write: false,
    legalComments: 'none',
    target: ['chrome110', 'safari16'],
  });
  assets['/ui/' + surface + '.css'] = assetRecord(
    mime['.css'],
    Buffer.from(css.outputFiles[0].contents),
  );
}
// Development sources use ESM modules; HTML entry points receive bundled IIFEs.
for (const entryPoint of [
  'race',
  'network-entry',
  'settings',
  'feedback-effects',
  'course',
  'curriculum',
  'classroom',
  'teacher-editor',
  'teacher',
  'app',
]) {
  const client = await build({
    entryPoints: ['public/' + entryPoint + '.js'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    legalComments: 'none',
  });
  assets[entryPoint === 'network-entry' ? '/network.js' : '/' + entryPoint + '.js'] = assetRecord(
    mime['.js'],
    Buffer.from(client.outputFiles[0].contents),
  );
}
// Fingerprint final bytes, including bundled dependencies, instead of relying on
// a manually synchronized release query in every HTML page.
for (const [key, asset] of Object.entries(assets)) {
  if (!key.endsWith('.html')) continue;
  assets[key] = assetRecord(
    mime['.html'],
    Buffer.from(versionAssetLinks(Buffer.from(asset.data, 'base64').toString('utf8'), assets)),
  );
}
const vocabulary = fs
  .readFileSync('public/vocabulary.js', 'utf8')
  .split('const builtinVocabulary')[0]
  .replace('const vocabulary', 'const words');
fs.mkdirSync('dist/server', { recursive: true });
// Adapt the four legacy browser catalogs once. Runtime services are ordinary ESM;
// no application source or dependency wiring is concatenated into their scope.
const source =
  vocabulary +
  '\n' +
  fs.readFileSync('public/vocabulary-grade5.js', 'utf8') +
  '\n' +
  fs.readFileSync('public/vocabulary-unit7.js', 'utf8') +
  '\n' +
  fs.readFileSync('public/race-avatars.js', 'utf8') +
  '\n' +
  '\nconst assets=' +
  JSON.stringify(assets) +
  ';\n';
const entry =
  "import { createApplication } from './server/application.mjs';\n" +
  source +
  '\nexport default createApplication({words,gradeFiveVocabulary,unitSevenVocabulary,raceAvatarCatalog,assets});\n';
await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: 'classroom-entry.mjs',
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/server/index.js',
  legalComments: 'none',
});

fs.mkdirSync('dist/.openai', { recursive: true });
fs.copyFileSync('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Built classroom Worker with ' + Object.keys(assets).length + ' local assets.');
