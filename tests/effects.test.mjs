import assert from 'node:assert/strict';
import { cues, renderCue } from '../public/effects/sound-bank.js';
import { createEffectsAudio } from '../public/effects/audio.js';
import { createMotion } from '../public/effects/motion.js';
import { createInteractionEffects } from '../public/effects/controller.js';

for (const name of Object.keys(cues)) {
  const samples = renderCue(name, 24000);
  let peak = 0,
    power = 0;
  for (const sample of samples) {
    assert.ok(Number.isFinite(sample));
    peak = Math.max(peak, Math.abs(sample));
    power += sample * sample;
  }
  assert.ok(peak <= 0.821 && peak > 0.1, name + ' has a clean unclipped signal');
  assert.ok(Math.sqrt(power / samples.length) > 0.025, name + ' is audible');
  assert.equal(samples[0], 0);
  assert.equal(Math.abs(samples.at(-1)), 0);
}

const played = [],
  contexts = [],
  listeners = new Map(),
  microtasks = [];
let now = 0;
class Context {
  constructor() {
    this.state = 'running';
    this.sampleRate = 24000;
    this.currentTime = 0;
    this.destination = {};
    contexts.push(this);
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setTargetAtTime(value) {
          this.value = value;
        },
      },
      connect() {},
    };
  }
  createDynamicsCompressor() {
    return { threshold: {}, ratio: {}, attack: {}, release: {}, connect() {} };
  }
  createBuffer(channels, length) {
    return { copyToChannel() {}, length };
  }
  createBufferSource() {
    const source = {
      connect() {},
      disconnect() {},
      start() {
        played.push(source);
      },
      stop() {
        this.stopped = true;
      },
    };
    return source;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}
const preferences = { effectsEnabled: true, effectsVolume: 70, reduceMotion: false };
const document = {
  hidden: false,
  body: {},
  addEventListener(type, fn) {
    listeners.set(type, fn);
  },
  querySelectorAll: () => [],
};
const host = {
  document,
  AudioContext: Context,
  performance: { now: () => now },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener() {},
  queueMicrotask: (fn) => microtasks.push(fn),
  MutationObserver: class {
    observe() {}
  },
  setTimeout,
  clearTimeout,
};
const audio = createEffectsAudio({ settings: () => preferences, host, clock: () => now });
assert.equal(audio.play('correct'), false, 'No automatic sound before the first interaction');
audio.unlock();
assert.equal(audio.play('letter'), true);
assert.equal(audio.play('letter'), false, 'Coalesce a double tap without duplicate sound');
now += 40;
assert.equal(audio.play('correct'), true);
assert.equal(played[0].stopped, true, 'Result cue takes priority over click/selection');
preferences.effectsVolume = 0;
audio.sync();
assert.equal(played.at(-1).stopped, true);
assert.equal(audio.play('complete'), false);
preferences.effectsVolume = 70;
document.hidden = true;
assert.equal(audio.play('wrong'), false);
document.hidden = false;
contexts[0].state = 'interrupted';
audio.unlock();
now += 40;
assert.equal(audio.play('wrong'), true, 'Recover a Safari interrupted context on interaction');
now += 50;
assert.equal(audio.play('complete'), true);
assert.equal(
  audio.play('correct'),
  false,
  'Final answer does not stack over the completion fanfare',
);

let reduced = false,
  cancelled = 0,
  calls = 0;
const element = {
  hidden: false,
  matches: () => false,
  animate() {
    calls++;
    return {
      cancel() {
        cancelled++;
        this.oncancel?.();
      },
    };
  },
};
const motion = createMotion({ reduced: () => reduced, host });
motion.pulse(element, 'letter');
motion.pulse(element, 'success');
assert.equal(cancelled, 1, 'A new response replaces an old animation on the same control');
motion.stop();
assert.equal(cancelled, 2);
reduced = true;
motion.pulse(element, 'character');
motion.enter(element);
assert.equal(calls, 2, 'Reduced motion keeps state changes without bouncing');

// A semantic handler and the generic document listener share one click.
const effects = createInteractionEffects({ settings: () => preferences, host });
const button = {
  disabled: false,
  isConnected: true,
  classList: { add() {}, remove() {} },
  getAttribute: () => null,
  matches: () => false,
};
button.closest = (selector) => (selector === '.stage-word' ? null : button);
listeners.get('pointerdown')({ target: button, type: 'pointerdown' });
const before = played.length;
listeners.get('click')({ target: button });
effects.sound('select');
microtasks.splice(0).forEach((fn) => fn());
assert.equal(played.length - before, 1, 'Selection does not also play the generic click');
preferences.effectsEnabled = false;
assert.equal(effects.sound('correct'), false);
console.log(
  'PASS: clean bounded cues, gesture unlock, mute/hidden guards, source priority, Safari resume, replaceable/reduced motion and one cue per selection gesture.',
);
