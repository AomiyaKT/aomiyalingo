import assert from 'node:assert/strict';
import { createRuntimeStatus, describeRuntimeStatus } from '../public/shared/runtime-status.js';
import { createRequest } from '../public/shared/request.js';
import { APP_VERSION } from '../public/shared/release.js';
import worker from '../dist/server/index.js';
import { readFileSync } from 'node:fs';

let clock = 1000;
const state = createRuntimeStatus({ now: () => clock++ });
const previewState = createRuntimeStatus();
const preview = previewState.request({
  phase: 'start',
  path: '/api/teacher/config/backup/inspect',
  method: 'POST',
});
assert.equal(previewState.snapshot().pending, 0);
previewState.request({ phase: 'end', ticket: preview, ok: true });
assert.equal(
  previewState.snapshot().savedAt,
  null,
  'Previewing a backup must never report a successful save',
);
let outcome = 'ok';
const request = createRequest({
  onRequest: (event) => state.request(event),
  onConnection: (ok) => state.connection(ok),
  fetch: async () => {
    assert.equal(state.snapshot().pending, 1);
    if (outcome === 'offline') throw Error('offline');
    return new Response(JSON.stringify({ error: '保存できません', ok: true }), {
      status: outcome === 'denied' ? 409 : 200,
    });
  },
});
assert.match(describeRuntimeStatus(state.snapshot()).save, /まだありません/);
outcome = 'offline';
await assert.rejects(request('/api/race/answer', { answer: 'ate' }));
assert.equal(state.snapshot().pending, 0);
assert.equal(state.snapshot().failed, 1);
assert.equal(state.snapshot().savedAt, null);
state.connection(true); // A successful poll or manual health check is not a save.
assert.equal(state.snapshot().failed, 1);
assert.match(describeRuntimeStatus(state.snapshot()).save, /確認できない/);
outcome = 'ok';
await request('/api/race/ready', {}); // Another successful action cannot hide the failed answer.
assert.equal(state.snapshot().failed, 1);
await request('/api/race/answer', { answer: 'ate' });
assert.equal(state.snapshot().failed, 0);
assert.match(describeRuntimeStatus(state.snapshot()).save, /保存済み/);
outcome = 'denied';
await assert.rejects(request('/api/teacher/config', {}));
assert.equal(state.snapshot().failed, 1);
state.editor({ dirty: true, saving: false });
assert.equal(describeRuntimeStatus(state.snapshot()).warning, true);
const fresh = createRuntimeStatus();
fresh.editor({ dirty: true });
assert.match(describeRuntimeStatus(fresh.snapshot()).save, /未保存/);
fresh.editor({ dirty: true, saving: true });
assert.match(describeRuntimeStatus(fresh.snapshot()).save, /保存中/);
fresh.online(false);
assert.equal(describeRuntimeStatus(fresh.snapshot()).connection, 'オフライン');

const health = await worker.fetch(new Request('https://classroom.test/api/health'), {});
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true, version: APP_VERSION });
assert.match(health.headers.get('cache-control'), /no-store/);
const pdf = await worker.fetch(new Request('https://classroom.test/help/teacher-guide.pdf'), {});
assert.equal(pdf.headers.get('content-type'), 'application/pdf');
assert.equal(
  (await pdf.arrayBuffer()).byteLength,
  readFileSync('public/help/teacher-guide.pdf').length,
);
console.log(
  'PASS: pending writes, failed answer retention across polls/other saves, retry recovery, editor dirty state, offline status, read-only version health and local PDF delivery.',
);
