import assert from 'node:assert/strict';
import { createUpdateController } from '../public/shared/settings-updates.js';
import {
  compareVersions,
  releaseVersion,
  updateDecision,
  hasUnsavedWork,
} from '../public/shared/update-policy.js';
import { translateUI } from '../public/shared/i18n.js';

assert.equal(releaseVersion('v76.2.0'), '76.2.0');
for (const value of ['77-beta', '77<script>', '1.2.3.4', '', null, 76])
  assert.equal(releaseVersion(value), null);
assert.equal(compareVersions('76.10', '76.2'), 1);
assert.equal(compareVersions('76', '76.0.0'), 0);
assert.equal(compareVersions('76', '77'), -1);
assert.equal(compareVersions('bad', '77'), null);
const result = (serverVersion, latest, active = false) => ({
  serverVersion,
  latest: latest ? { version: latest } : null,
  active,
});
assert.equal(updateDecision('75', result('76', '77')), 'reload');
assert.equal(updateDecision('76', result('76', '77')), 'awaiting-deployment');
assert.equal(updateDecision('76', result('76', '76')), 'current');
assert.equal(updateDecision('76', result('76', '75')), 'preview');
assert.equal(updateDecision('76', result('75', '75')), 'server-older');
assert.equal(updateDecision('76', result('76', null)), 'unavailable');
assert.equal(updateDecision('bad', result('76', '76')), 'unavailable');
for (const key of ['pending', 'failed', 'dirty', 'saving'])
  assert.equal(hasUnsavedWork({ [key]: 1 }), true);

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
let next = result('76', '76'),
  state = {},
  open = true,
  refreshes = 0,
  calls = [],
  wait;
const controller = createUpdateController({
  clientVersion: '75',
  getSaveState: () => state,
  isOpen: () => open,
  request: async (path) => {
    calls.push(path);
    if (wait) return wait.promise;
    return path.includes('/ready?') ? { ok: true, version: '76' } : next;
  },
  refresh: () => {
    refreshes++;
  },
});
assert.equal(await controller.apply(), false);
wait = deferred();
const check = controller.check();
assert.equal(await controller.check(), false);
assert.equal(calls.length, 1);
wait.resolve(next);
wait = null;
await check;
assert.equal(controller.snapshot().decision, 'reload');
for (const key of ['pending', 'failed', 'dirty', 'saving']) {
  state = { [key]: true };
  assert.equal(await controller.apply(), false);
}
state = {};
next = result('76', '76', true);
await controller.check();
assert.equal(await controller.apply(), false);
next = result('76', '76');
await controller.check();
wait = deferred();
const applying = controller.apply();
assert.equal(await controller.apply(), false);
state = { dirty: true };
wait.resolve({ ok: true, version: '76' });
wait = null;
assert.equal(
  await applying,
  false,
  'New unsaved work appearing during preflight must block reload',
);
assert.equal(refreshes, 0);
state = {};
wait = deferred();
const closing = controller.apply();
open = false;
wait.resolve({ ok: true, version: '76' });
wait = null;
assert.equal(await closing, false, 'Closing settings cancels an unfinished update action');
open = true;
wait = deferred();
const rejected = controller.apply();
wait.reject(Object.assign(Error('授業・レースを終了してから更新してください。'), { status: 409 }));
wait = null;
assert.equal(await rejected, false);
assert.equal(controller.snapshot().result, null);
assert.match(controller.snapshot().error, /終了/);
assert.equal(await controller.apply(), false);
await controller.check();
assert.equal(await controller.apply(), true);
assert.equal(refreshes, 1);
assert.equal(await controller.apply(), false, 'Only one navigation per update action');
assert.equal(await controller.check(), false);

const stale = createUpdateController({
  clientVersion: '75',
  request: async (path) =>
    path.includes('/ready?') ? { ok: true, version: '77' } : result('76', '76'),
  refresh: () => assert.fail('Mismatched version reloaded'),
});
await stale.check();
assert.equal(await stale.apply(), false);
assert.equal(stale.snapshot().result, null);
const offline = createUpdateController({
  request: async () => {
    throw Error('offline');
  },
  refresh: () => assert.fail('Offline update'),
});
assert.equal(await offline.check(), false);
assert.equal(offline.snapshot().decision, 'unchecked');
assert.ok(offline.snapshot().error);
for (const text of [
  '更新を確認',
  '最新版に更新',
  'GitHubに新しい版があります。サーバーへの公開を待っています。',
  'GitHubの更新情報を取得できません。最新版かどうかは未確認です。',
  '授業・レースを終了してから更新してください。',
])
  assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(translateUI(text)));
console.log(
  'Settings updates: numeric versions, deployed/public/preview distinctions, error honesty, check/apply double-click guards, in-flight saves, active lessons, closed dialogs, changed server versions, single reload and English labels passed.',
);
