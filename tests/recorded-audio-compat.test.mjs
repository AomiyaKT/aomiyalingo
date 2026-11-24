import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const owners = [],
  failed = new Set();
const original = '/assets/words/cat.wav';
const context = {
  WeakMap,
  window: {
    speechSynthesis: { cancel() {} },
    aomiPreparedAudioURL: (url) => (failed.has(url) ? url : 'blob:prepared'),
    aomiAudioPreparation: {
      rejectPlayback(url, attempted) {
        if (attempted !== 'blob:prepared' || failed.has(url)) return false;
        failed.add(url);
        return true;
      },
    },
  },
};
vm.createContext(context);
vm.runInContext(readFileSync('public/word-audio.js', 'utf8'), context);
const unsupported = () => Object.assign(Error('unsupported blob'), { name: 'NotSupportedError' });
function player(play) {
  return {
    _src: '',
    get src() {
      return this._src;
    },
    set src(value) {
      this._src = value;
      this.playbackRate = 1;
    },
    paused: true,
    pause() {
      this.paused = true;
    },
    play() {
      this.paused = false;
      owners.push(this.src);
      return play(this);
    },
  };
}
const native = player((p) =>
  p.src.startsWith('blob:') ? Promise.reject(unsupported()) : Promise.resolve(),
);
await context.playWordAudio(native, { word: 'cat', audio: original }, 0.3, 0.75);
assert.deepEqual(owners, ['blob:prepared', original]);
assert.equal(native.volume, 0.3);
assert.equal(native.playbackRate, 0.75);
owners.length = 0;
await context.playWordAudio(native, { word: 'cat', audio: original });
assert.deepEqual(owners, [original]);
failed.clear();
owners.length = 0;
const denied = player(() =>
  Promise.reject(Object.assign(Error('tap needed'), { name: 'NotAllowedError' })),
);
await assert.rejects(
  context.playWordAudio(denied, { word: 'cat', audio: original }),
  (e) => e.name === 'NotAllowedError',
);
assert.deepEqual(owners, ['blob:prepared']);
assert.equal(failed.size, 0, 'Gesture restrictions are not codec failures');
let rejectOld;
failed.clear();
owners.length = 0;
const replaced = player(
  () =>
    new Promise((resolve, reject) => {
      rejectOld = reject;
    }),
);
const old = context.playWordAudio(replaced, { word: 'cat', audio: original });
replaced.play = () => Promise.resolve();
await context.playWordAudio(replaced, { word: 'dog', audio: '/assets/words/dog.wav' });
rejectOld(unsupported());
await assert.rejects(old);
assert.equal(failed.size, 0, 'An old failure cannot switch the new question source');
failed.clear();
let rejectPause;
const stopped = player(
  () =>
    new Promise((resolve, reject) => {
      rejectPause = reject;
    }),
);
const stoppedPlay = context.playWordAudio(stopped, { word: 'cat', audio: original });
stopped.pause();
rejectPause(unsupported());
await assert.rejects(stoppedPlay);
assert.equal(stopped.paused, true);
console.log(
  'Recorded media: one original-URL retry for unsupported blobs, preserved volume/rate, permission distinction, stale-owner and explicit-pause guards passed.',
);
