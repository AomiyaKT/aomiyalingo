import assert from 'node:assert/strict';
import {
  createResourcePreloader,
  practiceResourceHints,
  taskResourceHints,
} from '../public/shared/resource-preloader.js';
const timers = new Map(),
  events = new Map(),
  requests = [];
let serial = 0,
  now = 0,
  pending;
const host = {
  document: {
    hidden: false,
    addEventListener: (k, v) => events.set(k, v),
    removeEventListener: (k) => events.delete(k),
  },
  navigator: { onLine: true, connection: {} },
  setTimeout(fn, ms) {
    timers.set(++serial, { fn, ms });
    return serial;
  },
  clearTimeout: (id) => timers.delete(id),
  addEventListener: (k, v) => events.set(k, v),
  removeEventListener: (k) => events.delete(k),
};
const warm = createResourcePreloader({
  host,
  now: () => now,
  fetch: (url, options) => {
    requests.push({ url, options });
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      options.signal.addEventListener('abort', () => reject(Error('aborted')));
    });
  },
});
const tick = () => {
  const [id, job] = [...timers].find(([, job]) => job.ms === 250) || [];
  if (!job) return;
  timers.delete(id);
  return job.fn();
};
warm.warm([
  'https://evil.test/leak',
  '/api/student/me',
  '/assets/words/math.wav',
  '/assets/vocabulary/g5-unit1/01_music.png',
  '/assets/words/english.wav',
]);
const first = tick();
assert.equal(requests.length, 1);
assert.equal(requests[0].url, '/assets/words/math.wav');
assert.equal(requests[0].options.cache, 'force-cache');
assert.equal(requests[0].options.priority, 'low');
warm.warm(['/assets/words/math.wav', '/assets/words/music.wav']);
assert.equal(requests.length, 1, 'One background request at a time');
pending.resolve(new Response(new Uint8Array(44)));
await first;
const second = tick();
assert.equal(requests[1].url, '/assets/words/music.wav');
pending.resolve(new Response(new Uint8Array(44)));
await second;
warm.warm(['/assets/words/math.wav', '/assets/words/music.wav']);
assert.equal(
  [...timers.values()].filter((j) => j.ms === 250).length,
  0,
  'Completed resources do not refetch',
);
warm.warm(['/assets/words/science.wav']);
const hidden = tick();
host.document.hidden = true;
events.get('visibilitychange')();
assert.equal(requests.at(-1).options.signal.aborted, true);
await hidden;
host.document.hidden = false;
host.navigator.connection.saveData = true;
warm.warm(['/assets/words/art.wav']);
assert.equal(timers.size, 0);
host.navigator.connection.saveData = false;
host.navigator.connection.effectiveType = '2g';
warm.warm(['/assets/words/art.wav']);
assert.equal(timers.size, 0);
host.navigator.connection.effectiveType = '4g';
warm.warm(['/assets/words/oversize.wav']);
const big = tick();
pending.resolve(new Response(new Uint8Array(1), { headers: { 'content-length': '600000' } }));
await big;
assert.equal(timers.size, 0, 'Oversized audio is not downloaded speculatively');
warm.warm(['/assets/words/retry.wav']);
const failed = tick();
pending.reject(Error('temporary Wi-Fi loss'));
await failed;
warm.warm(['/assets/words/retry.wav']);
assert.equal(timers.size, 0, 'Transient failures back off instead of hammering Wi-Fi');
now = 30001;
warm.warm(['/assets/words/retry.wav']);
const recovered = tick();
pending.resolve(new Response(new Uint8Array(44)));
await recovered;
warm.warm(['/assets/words/retry.wav']);
assert.equal(timers.size, 0, 'A recovered resource is cached after retry');
warm.warm(['/assets/words/timeout.wav']);
const timedOut = tick();
const deadline = [...timers].find(([, job]) => job.ms === 8000);
timers.delete(deadline[0]);
deadline[1].fn();
await timedOut;
warm.warm(['/assets/words/timeout.wav']);
assert.equal(timers.size, 0, 'A timed-out preload must back off too');
now += 30001;
warm.warm(['/assets/words/timeout.wav']);
const timeoutRetry = tick();
assert.equal(requests.at(-1).url, '/assets/words/timeout.wav');
pending.resolve(new Response(new Uint8Array(44)));
await timeoutRetry;
warm.warm(['/assets/words/streamsize.wav']);
const largeStream = tick();
pending.resolve(new Response(new Uint8Array(524289)));
await largeStream;
warm.warm(['/assets/words/streamsize.wav']);
assert.equal(timers.size, 0, 'A streamed body over the byte budget also enters backoff');
// An explicit screen transition abort is not a network failure.
warm.warm(['/assets/words/screen.wav']);
const screen = tick();
warm.reset();
warm.warm(['/assets/words/screen.wav']);
await screen;
const screenRetry = tick();
assert.equal(requests.at(-1).url, '/assets/words/screen.wav');
pending.resolve(new Response(new Uint8Array(44)));
await screenRetry;
warm.warm(['/assets/words/new.wav']);
const disposed = tick();
warm.dispose();
await disposed;
assert.equal(timers.size, 0);
assert.equal(events.size, 0);
assert.deepEqual(
  practiceResourceHints({ queue: [{ word: 'math' }, { word: 'music' }] }, [
    { word: 'music', image: '/image.png', audio: '/voice.wav' },
  ]),
  ['/image.png', '/voice.wav'],
);
assert.deepEqual(taskResourceHints({ exercise: { image: '/image.png' }, audio: null }), [
  '/image.png',
]);
console.log(
  'Preloading: bounded same-origin resources, low priority, serialized/cache-deduplicated fetches, hidden/weak-network cancellation, size/time budgets, next-task hints and disposal passed.',
);
