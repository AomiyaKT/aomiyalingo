import { readdirSync } from 'node:fs';
import { runNode, runQueue } from './run-commands.mjs';

const sourceFiles = [
  'build.mjs',
  'worker.mjs',
  'server/assets.mjs',
  'server/application.mjs',
  'server/updates.mjs',
  'race-server.mjs',
  'editor-server.mjs',
  'public/course.js',
  'public/race.js',
  'public/race-session.js',
  'public/network-entry.js',
  'public/settings.js',
  'public/feedback-effects.js',
  'public/app.js',
  'public/classroom.js',
  'public/teacher.js',
  'public/teacher-home.js',
  'public/mode-settings.js',
  'public/teacher-editor.js',
  'public/teacher-tools.js',
  'public/word-audio.js',
  'public/shared/request.js',
  ...[
    'server/editor',
    'server/classroom',
    'public/editor',
    'public/learning',
    'public/practice',
    'public/shared',
    'public/effects',
    'scripts',
  ].flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.m?js$/.test(f))
      .map((f) => dir + '/' + f),
  ),
  ...readdirSync('server/race')
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => 'server/race/' + f),
  ...readdirSync('public/race')
    .filter((f) => f.endsWith('.js'))
    .map((f) => 'public/race/' + f),
];
if (!(await runQueue([...new Set(sourceFiles)].map((file) => ['--check', file])))) process.exit(1);
if (!(await runNode(['build.mjs']))) process.exit(1);
const suites = readdirSync('tests')
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();
const passed = await runQueue(suites.map((file) => ['tests/' + file]));
console.log(`${suites.length} regression suites ${passed ? 'passed' : 'completed with failures'}.`);
if (!passed) process.exitCode = 1;
