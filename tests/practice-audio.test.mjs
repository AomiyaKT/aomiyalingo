import assert from 'node:assert/strict';
import { createPracticeAudio } from '../public/practice/audio.js';

const players = [],
  utterances = [],
  nativeUtterances = [];
const defer = () => {
  let reject;
  const promise = new Promise((_, fail) => (reject = fail));
  return { promise, reject };
};
class Player {
  paused = true;
  ended = false;
  constructor() {
    players.push(this);
  }
  pause() {
    this.paused = true;
    this.onpause?.();
  }
  play() {
    this.paused = false;
    this.ended = false;
    this.onplay?.();
    return this.playPromise || Promise.resolve();
  }
  end() {
    this.paused = true;
    this.ended = true;
    this.onended?.();
  }
}
globalThis.Audio = Player;
globalThis.window = {
  addEventListener() {},
  speechSynthesis: {
    getVoices() {
      return [{ lang: 'ja-JP' }, { lang: 'en-GB' }, { lang: 'en-US' }];
    },
    speak(utterance) {
      nativeUtterances.push(utterance);
    },
    cancel() {
      for (const utterance of utterances) {
        if (utterance.active) {
          utterance.active = false;
          utterance.reject(Error('canceled'));
        }
      }
    },
  },
};
globalThis.speechSynthesis = window.speechSynthesis;
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
// Recorded playback resolves when it starts; speech resolves when it finishes.
globalThis.playWordAudio = (player, word) => {
  player.pause();
  window.speechSynthesis.cancel();
  if (word.audio !== null) return player.play();
  return new Promise((resolve, reject) => {
    utterances.push({ resolve, reject, active: true });
  });
};
function harness(audio = '/assets/words/ate.wav') {
  const elements = new Map(),
    notices = [];
  const $ = (selector) => {
    if (!elements.has(selector))
      elements.set(selector, {
        classList: {
          toggle(name, value) {
            this[name] = value;
          },
        },
        setAttribute(name, value) {
          this[name] = value;
        },
      });
    return elements.get(selector);
  };
  let state = {
    mode: 'sentence',
    speed: 1,
    exerciseTask: {
      id: 'first',
      exercise: {},
      exerciseAudio: { spoken: 'ate', audio },
    },
  };
  const controls = createPracticeAudio({
    $,
    getState: () => state,
    getVocabulary: () => [{ word: 'ate', audio: '/assets/words/ate.wav' }],
    studyAudio: new Player(),
    appSettings: { values: { voiceVolume: 100 } },
    classroom: { paused: false },
    saveCurrentDraft() {},
    notify: (message) => notices.push(message),
    originalQuestion: 'ate',
  });
  return {
    ...controls,
    $,
    notices,
    player: players.at(-1),
    nextTask() {
      state = {
        ...state,
        exerciseTask: { ...state.exerciseTask, id: 'second' },
      };
    },
    classic(question = 'ate') {
      state = { mode: 'text', question, speed: 1 };
    },
    playing: () => $('#audio-play').classList['is-playing'],
  };
}

const recorded = harness();
await recorded.playAudio();
assert.equal(recorded.player.paused, false);
assert.equal(recorded.playing(), true, 'recorded audio stays visibly playing after play resolves');
assert.equal(recorded.$('#audio-play')['aria-label'], '音声を一時停止');
recorded.player.end();
assert.equal(recorded.playing(), false);
assert.equal(recorded.$('#audio-play')['aria-label'], '音声を再生');

const speech = harness(null),
  firstPlayback = speech.playAudio(),
  firstUtterance = utterances.at(-1);
assert.equal(speech.playing(), true);
speech.stopAudio();
speech.nextTask();
const secondPlayback = speech.playAudio(),
  secondUtterance = utterances.at(-1);
await firstPlayback;
assert.deepEqual(speech.notices, [], 'canceling old speech does not display a playback error');
assert.equal(speech.playing(), true, 'old cancellation does not reset the newer player');
firstUtterance.resolve();
await Promise.resolve();
assert.equal(speech.playing(), true);
secondUtterance.active = false;
secondUtterance.resolve();
await secondPlayback;
assert.equal(speech.playing(), false, 'speech resets the player when the utterance finishes');

const replaced = harness(null),
  replacedPlayback = replaced.playAudio(),
  replacedUtterance = utterances.at(-1);
replaced.nextTask();
replacedUtterance.active = false;
replacedUtterance.reject(Error('late speech error'));
await replacedPlayback;
assert.deepEqual(replaced.notices, [], 'completion belonging to a different task is ignored');

const failure = harness(null),
  failedPlayback = failure.playAudio(),
  failedUtterance = utterances.at(-1);
failedUtterance.active = false;
failedUtterance.reject(Error('speech unavailable'));
await failedPlayback;
assert.equal(failure.notices.length, 1, 'a current playback failure is still reported');
assert.equal(failure.playing(), false);

const classic = harness();
classic.classic();
await classic.playAudio();
assert.equal(classic.playing(), true);
classic.stopAudio();
assert.equal(classic.playing(), false);

const legacy = harness();
legacy.classic('First edited sentence.');
await legacy.playAudio();
const oldSpeech = nativeUtterances.at(-1),
  oldEnd = oldSpeech.onend,
  oldError = oldSpeech.onerror;
assert.equal(oldSpeech.lang, 'en-US');
assert.equal(oldSpeech.voice.lang, 'en-US');
assert.equal(oldSpeech.rate, 0.9);
assert.equal(oldSpeech.volume, 1);
legacy.stopAudio();
assert.equal(oldSpeech.onend, null, 'stopping releases legacy speech callbacks');
assert.equal(oldSpeech.onerror, null);
legacy.classic('Second edited sentence.');
await legacy.playAudio();
const newSpeech = nativeUtterances.at(-1);
oldError();
oldEnd();
assert.deepEqual(legacy.notices, [], 'queued canceled legacy callbacks do not report errors');
assert.equal(legacy.playing(), true, 'old legacy completion cannot reset newer playback');
await legacy.playAudio();
assert.equal(
  nativeUtterances.at(-1),
  newSpeech,
  'the new speech still toggles off rather than replaying',
);
assert.equal(legacy.playing(), false);

const legacyReplaced = harness();
legacyReplaced.classic('An old question.');
await legacyReplaced.playAudio();
const replacedError = nativeUtterances.at(-1).onerror;
legacyReplaced.classic('A different question.');
replacedError();
assert.deepEqual(legacyReplaced.notices, [], 'legacy errors from replaced questions are ignored');
legacyReplaced.stopAudio();

const legacyFailure = harness();
legacyFailure.classic('A current question.');
await legacyFailure.playAudio();
nativeUtterances.at(-1).onerror();
assert.equal(legacyFailure.notices.length, 1, 'current legacy speech failures remain visible');
assert.equal(legacyFailure.playing(), false);
await legacyFailure.playAudio();
nativeUtterances.at(-1).onend();
assert.equal(legacyFailure.playing(), false, 'current legacy completion resets the player');

const media = harness(),
  delayed = defer();
media.classic();
media.player.playPromise = delayed.promise;
const pendingMedia = media.playAudio();
media.stopAudio();
media.classic();
media.player.playPromise = null;
await media.playAudio();
delayed.reject(Error('late play rejection'));
await pendingMedia;
assert.deepEqual(media.notices, [], 'an old media rejection cannot report a false current error');
assert.equal(media.playing(), true);
media.stopAudio();
const currentMedia = defer();
media.player.playPromise = currentMedia.promise;
const failedMedia = media.playAudio();
currentMedia.reject(Error('current play rejection'));
await failedMedia;
assert.equal(media.notices.length, 1, 'current recorded playback failures remain visible');
console.log(
  'PASS: recorded and legacy/exercise speech playback, canceled/replaced completion, delayed media rejection, current failures, voice selection and playback controls.',
);
