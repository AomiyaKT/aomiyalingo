import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createConfigurationStore } from '../server/editor/configuration.mjs';
import { auditTeachingContent } from '../public/shared/content-audit.js';
const catalogs = {};
for (const [file, name] of [
  ['vocabulary', 'vocabulary'],
  ['vocabulary-grade5', 'gradeFiveVocabulary'],
  ['vocabulary-unit7', 'unitSevenVocabulary'],
]) {
  const sandbox = { structuredClone };
  vm.runInNewContext(
    fs.readFileSync('public/' + file + '.js', 'utf8') + ';globalThis.bank=' + name + ';',
    sandbox,
  );
  catalogs[name] = sandbox.bank;
}
const { config } = await createConfigurationStore({
  words: catalogs.vocabulary,
  gradeFiveVocabulary: catalogs.gradeFiveVocabulary,
  unitSevenVocabulary: catalogs.unitSevenVocabulary,
  stmt: () => ({ first: async () => null }),
}).loadConfig({});
const invalid = [];
const exists = (url) => {
  const file = path.join('public', url.slice(1));
  if (!fs.existsSync(file)) return false;
  if (url.endsWith('.wav')) {
    const b = fs.readFileSync(file);
    if (
      b.length < 44 ||
      b.toString('ascii', 0, 4) !== 'RIFF' ||
      b.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      invalid.push(url);
      return false;
    }
  }
  if (url.endsWith('.png')) {
    const b = fs.readFileSync(file);
    if (b.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      invalid.push(url);
      return false;
    }
  }
  return true;
};
const report = {
  checkedOn: new Date().toISOString(),
  ...auditTeachingContent(config, exists),
  invalidResources: [...new Set(invalid)],
};
const output = process.argv.indexOf('--output');
if (output >= 0) fs.writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    curricula: report.profiles.length,
    words: report.words,
    errors: report.errors,
    warnings: report.warnings,
    invalidResources: report.invalidResources.length,
  }),
);
if (report.errors) process.exitCode = 1;
