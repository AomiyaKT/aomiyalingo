import { cues, renderCue } from './sound-bank.js';

export function createEffectsAudio({
  settings,
  host = globalThis,
  clock = () => performance.now(),
}) {
  let context,
    master,
    compressor,
    unlocked = false;
  const buffers = new Map(),
    active = new Set(),
    last = new Map();
  const enabled = () =>
    settings().effectsEnabled && settings().effectsVolume > 0 && !host.document.hidden;
  function unlock() {
    if (!enabled()) return;
    try {
      const AudioContext = host.AudioContext || host.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) {
        context = new AudioContext({ latencyHint: 'interactive' });
        master = context.createGain();
        master.gain.value = (settings().effectsVolume / 100) * 0.55;
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -8;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.1;
        master.connect(compressor);
        compressor.connect(context.destination);
      }
      unlocked = true;
      sync();
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      /* A device without Web Audio still has full visual feedback. */
    }
  }
  function stop() {
    for (const source of active) {
      try {
        source.stop();
      } catch {}
    }
    active.clear();
  }
  function sync() {
    if (master)
      master.gain.setTargetAtTime(
        (settings().effectsVolume / 100) * 0.55,
        context.currentTime,
        0.008,
      );
    if (!enabled()) stop();
  }
  function play(kind) {
    if (!enabled() || !unlocked || !context || context.state !== 'running') return false;
    const cue = cues[kind] || cues.click,
      time = clock();
    if ([...active].some((source) => source.priority >= 2 && source.priority > cue.priority))
      return false;
    if (time - (last.get(kind) ?? -Infinity) < (kind === 'roulette' ? 28 : 36)) return false;
    last.set(kind, time);
    if (!buffers.has(kind)) {
      const samples = renderCue(kind, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      buffers.set(kind, buffer);
    }
    for (const source of active)
      if (source.priority < cue.priority || active.size >= 6) {
        try {
          source.stop();
        } catch {}
        active.delete(source);
      }
    const source = context.createBufferSource();
    source.buffer = buffers.get(kind);
    source.priority = cue.priority;
    source.connect(master);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
    };
    active.add(source);
    source.start(context.currentTime + 0.003);
    return true;
  }
  return { unlock, play, stop, sync };
}
