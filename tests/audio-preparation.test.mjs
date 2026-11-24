import assert from 'node:assert/strict';
import { createAudioPreparation, vocabularyAudio } from '../public/shared/audio-preparation.js';
const turn = () => new Promise((resolve) => setImmediate(resolve));
const jobs = [],
  revoked = [],
  blobs = new Map();
let id = 0;
const host = {
  URL: {
    createObjectURL(blob) {
      const url = 'blob:' + ++id;
      blobs.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
      blobs.delete(url);
    },
  },
  setTimeout,
  clearTimeout,
};
const service = createAudioPreparation({
  host,
  fetch: (url, options) =>
    new Promise((resolve, reject) => {
      jobs.push({ url, resolve, reject, options });
      options.signal.addEventListener('abort', () => reject(Error('aborted')));
    }),
});
const response = () =>
  new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } });
const urls = [
  '/assets/words/cat.wav',
  '/assets/words/blue-sky/06-dog-66403c69.mp3',
  '/assets/words/music.wav',
];
assert.deepEqual(
  vocabularyAudio([
    { word: 'cat' },
    { word: 'silent', audio: null },
    { word: 'cat' },
    { word: 'dog', audio: urls[1] },
  ]),
  urls.slice(0, 2),
);
service.prepare('r1', urls);
assert.equal(service.state.ready, false);
assert.equal(jobs.length, 2, 'At most two downloads run concurrently');
jobs.find((job) => job.url === urls[0]).resolve(response());
await turn();
assert.equal(jobs.length, 3);
assert.equal(service.state.loaded, 1);
assert.equal(service.state.ready, false, 'A partial download cannot enable readiness');
jobs.find((job) => job.url === urls[1]).reject(Error('lost Wi-Fi'));
jobs[2].resolve(response());
await turn();
assert.equal(service.state.failed, 1);
assert.equal(service.state.ready, false);
const retry = service.retry();
assert.equal(jobs.length, 4, 'Retry only fetches the failed resource');
assert.equal(
  jobs[3].options.cache,
  'reload',
  'A failed response cannot stay trapped in HTTP cache',
);
assert.equal(jobs[3].url, urls[1]);
jobs[3].resolve(
  new Response(new Uint8Array([255, 251, 0, 0]), { headers: { 'content-type': 'audio/mpeg' } }),
);
await retry;
assert.equal(service.state.ready, true);
assert.equal(service.state.loaded, 3);
const blobUrl = service.resolve(urls[1]);
assert.ok(blobUrl.startsWith('blob:'));
assert.equal(blobs.get(blobUrl).type, 'audio/mpeg');
assert.equal((await blobs.get(blobUrl).arrayBuffer()).byteLength, 4);
assert.equal(service.rejectPlayback(urls[1], 'blob:stale'), false);
assert.equal(service.rejectPlayback(urls[1], blobUrl), true);
assert.equal(service.resolve(urls[1]), urls[1], 'An unsupported blob uses the same recording URL');
assert.equal(service.rejectPlayback(urls[1], blobUrl), false, 'Only one fallback per recording');
assert.equal(service.state.ready, true, 'A transport fallback does not discard downloaded audio');
service.prepare('r1', [...urls].reverse());
assert.equal(jobs.length, 4, 'Polls and avatar changes do not restart preparation');
service.prepare('r2', ['/assets/words/new.wav']);
assert.equal(revoked.length, 3, 'Changing activity releases old media');
service.prepare('r3', ['/assets/words/latest.wav']);
assert.equal(jobs[4].options.signal.aborted, true);
jobs[4].resolve(response());
jobs[5].resolve(response());
await turn();
assert.equal(service.state.ready, true);
assert.equal(service.state.total, 1);
assert.equal(
  service.resolve('/assets/words/new.wav'),
  '/assets/words/new.wav',
  'A stale download cannot enter the new activity cache',
);
service.prepare('bad', ['https://example.com/private.wav']);
await turn();
assert.equal(jobs.length, 6, 'No external or unauthorized path is fetched');
assert.equal(service.state.ready, false);
service.prepare('html', [urls[0]]);
jobs[6].resolve(new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }));
await turn();
assert.equal(service.state.ready, false, 'An HTTP success containing HTML is not audio readiness');
service.prepare('empty', []);
await turn();
assert.equal(service.state.ready, true, 'TTS-only lessons have no recorded downloads to wait for');
service.dispose();
assert.equal(service.state.ready, false);
assert.equal(blobs.size, 0);
const deadline = createAudioPreparation({
  host,
  timeout: 5,
  fetch: (_, options) =>
    new Promise((resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(Error('deadline'))),
    ),
});
deadline.prepare('timeout', [urls[0]]);
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(deadline.state.failed, 1);
assert.equal(deadline.state.loading, false);
assert.equal(deadline.state.ready, false);
deadline.dispose();
// A school network can fail without changing navigator.onLine. Retry the
// missing recording automatically, without downloading successes again.
const timers = new Map(),
  calls = [];
let timerId = 0,
  available = false;
const recoveringHost = {
  ...host,
  navigator: { onLine: true },
  document: { hidden: false },
  setTimeout(fn, delay) {
    timers.set(++timerId, { fn, delay });
    return timerId;
  },
  clearTimeout: (id) => timers.delete(id),
};
const recovering = createAudioPreparation({
  host: recoveringHost,
  fetch: async (url) => {
    calls.push(url);
    return url === urls[0] || available ? response() : new Response('', { status: 503 });
  },
});
recovering.prepare('recover', urls.slice(0, 2));
await turn();
assert.equal(recovering.state.loaded, 1);
assert.equal(recovering.state.failed, 1);
assert.equal(recovering.state.retrying, true);
assert.equal(recovering.state.ready, false);
const retryTimer = [...timers.entries()][0];
assert.ok(retryTimer[1].delay >= 3000 && retryTimer[1].delay < 3500);
timers.delete(retryTimer[0]);
retryTimer[1].fn();
await turn();
assert.deepEqual(calls, [urls[1], urls[0], urls[1]]);
assert.ok([...timers.values()][0].delay >= 6000, 'Repeated failures back off');
recoveringHost.navigator.onLine = false;
await recovering.resume();
assert.equal(timers.size, 0, 'Offline waits do not spin a retry loop');
assert.equal(recovering.state.offline, true);
assert.equal(recovering.state.loaded, 1);
available = true;
recoveringHost.navigator.onLine = true;
await recovering.resume();
assert.equal(recovering.state.ready, true);
assert.equal(recovering.state.failed, 0);
assert.deepEqual(calls, [urls[1], urls[0], urls[1], urls[1]]);
recovering.dispose();
recoveringHost.navigator.onLine = false;
recovering.prepare('initially-offline', [urls[0]]);
assert.equal(recovering.state.loaded, 0);
assert.equal(recovering.state.ready, false);
recoveringHost.navigator.onLine = true;
await recovering.resume();
assert.equal(recovering.state.ready, true, 'Initially offline loads start on reconnect');
recovering.dispose();
recoveringHost.document.hidden = true;
recovering.prepare('hidden', [urls[0]]);
const count = calls.length;
await recovering.resume();
assert.equal(calls.length, count);
recoveringHost.document.hidden = false;
await recovering.resume();
assert.equal(recovering.state.ready, true, 'Returning from the background resumes preparation');
recovering.dispose();
assert.equal(timers.size, 0);
await recovering.resume();
assert.equal(calls.length, count + 1, 'Leaving an activity prevents its retry from resurrecting');
const invalid = createAudioPreparation({
  host: recoveringHost,
  fetch: async () =>
    new Response('<html>not audio</html>', { headers: { 'content-type': 'text/html' } }),
});
invalid.prepare('permanent', [urls[0]]);
await turn();
assert.equal(invalid.state.failed, 1);
assert.equal(
  invalid.state.retrying,
  false,
  'Invalid media does not create an automatic retry storm',
);
assert.equal(timers.size, 0);
invalid.dispose();
let truncatedCalls = 0;
const truncated = createAudioPreparation({
  host: recoveringHost,
  fetch: async () =>
    ++truncatedCalls === 1
      ? new Response(new Uint8Array([1, 2]), {
          headers: { 'content-type': 'audio/wav', 'content-length': '4' },
        })
      : response(),
});
truncated.prepare('truncated', [urls[0]]);
await turn();
assert.equal(truncated.state.ready, false, 'Incomplete audio cannot unlock readiness');
assert.equal(truncated.state.retrying, true);
await truncated.resume();
assert.equal(truncated.state.ready, true, 'A truncated download can recover automatically');
truncated.dispose();
const slow = createAudioPreparation({
  host: recoveringHost,
  fetch: (_, options) =>
    new Promise((resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(Error('abort'))),
    ),
});
slow.prepare('slow', [urls[0]]);
const slowNotice = [...timers.entries()].find(([, t]) => t.delay === 8000);
timers.delete(slowNotice[0]);
slowNotice[1].fn();
assert.equal(slow.state.slow, true);
assert.equal(slow.state.ready, false, 'A slow-loading notice never bypasses readiness');
slow.dispose();
await turn();
assert.equal(timers.size, 0);
console.log(
  'Required audio: bounded concurrency, full-body gating, failed-only retry, stable owner, stale cancellation, blob reuse, invalid responses, deadlines and TTS-only lessons passed.',
);
