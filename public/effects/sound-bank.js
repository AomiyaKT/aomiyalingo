// Original, locally synthesised mallet/wood/bubble cues. No downloaded recordings.
const note = (frequency, at, length, gain = 1, voice = 'mallet', bend = 1) => ({
  frequency,
  at,
  length,
  gain,
  voice,
  bend,
});
export const cues = {
  overtake: {
    duration: 0.34,
    priority: 1,
    notes: [
      note(659.25, 0, 0.16, 0.45, 'bubble', 1.35),
      note(1046.5, 0.08, 0.22, 0.55, 'bubble', 1.12),
    ],
  },
  finalLap: {
    duration: 0.55,
    priority: 2,
    notes: [
      note(783.99, 0, 0.14, 0.4),
      note(783.99, 0.17, 0.14, 0.4),
      note(1046.5, 0.34, 0.18, 0.5),
    ],
  },
  countdown: { duration: 0.09, priority: 1, notes: [note(880, 0, 0.075, 0.32, 'wood')] },
  powerup: {
    duration: 0.48,
    priority: 2,
    notes: [
      note(523.25, 0, 0.18, 0.45, 'bubble', 1.5),
      note(783.99, 0.09, 0.2, 0.5),
      note(1567.98, 0.19, 0.26, 0.55),
    ],
  },
  click: { duration: 0.07, priority: 0, notes: [note(680, 0, 0.055, 0.55, 'wood', 0.55)] },
  select: { duration: 0.12, priority: 1, notes: [note(980, 0, 0.095, 0.65, 'bubble', 1.14)] },
  letter: { duration: 0.09, priority: 1, notes: [note(760, 0, 0.07, 0.6, 'wood', 1.25)] },
  remove: { duration: 0.1, priority: 1, notes: [note(650, 0, 0.08, 0.5, 'bubble', 0.72)] },
  toggle: { duration: 0.09, priority: 1, notes: [note(1040, 0, 0.07, 0.5, 'wood', 1.08)] },
  navigate: {
    duration: 0.16,
    priority: 1,
    notes: [note(660, 0, 0.1, 0.5), note(880, 0.035, 0.1, 0.35)],
  },
  flip: { duration: 0.1, priority: 1, notes: [note(490, 0, 0.08, 0.45, 'wood', 1.7)] },
  correct: {
    duration: 0.48,
    priority: 2,
    notes: [
      note(587.33, 0, 0.22, 0.65),
      note(1174.66, 0, 0.13, 0.12),
      note(880, 0.105, 0.34, 0.78),
      note(1174.66, 0.108, 0.31, 0.21),
      note(1479.98, 0.11, 0.25, 0.11),
    ],
  },
  wrong: {
    duration: 0.32,
    priority: 2,
    notes: [note(330, 0, 0.14, 0.6, 'bubble', 0.82), note(247, 0.115, 0.17, 0.55, 'bubble', 0.76)],
  },
  save: {
    duration: 0.34,
    priority: 2,
    notes: [note(659.25, 0, 0.15, 0.5), note(987.77, 0.085, 0.23, 0.62)],
  },
  welcome: {
    duration: 0.48,
    priority: 2,
    notes: [
      note(523.25, 0, 0.18, 0.5),
      note(659.25, 0.07, 0.2, 0.5),
      note(1046.5, 0.15, 0.29, 0.62),
    ],
  },
  streak: {
    duration: 0.56,
    priority: 2,
    notes: [
      note(783.99, 0, 0.16, 0.55),
      note(987.77, 0.07, 0.17, 0.55),
      note(1174.66, 0.14, 0.19, 0.55),
      note(1567.98, 0.23, 0.28, 0.64),
    ],
  },
  complete: {
    duration: 1.05,
    priority: 3,
    notes: [
      note(523.25, 0, 0.2, 0.55),
      note(659.25, 0.09, 0.2, 0.55),
      note(783.99, 0.18, 0.24, 0.55),
      note(1046.5, 0.3, 0.65, 0.65),
      note(659.25, 0.31, 0.55, 0.24),
      note(783.99, 0.31, 0.58, 0.24),
      note(1567.98, 0.32, 0.45, 0.1),
    ],
  },
  roulette: { duration: 0.045, priority: 0, notes: [note(1100, 0, 0.03, 0.35, 'wood', 0.72)] },
  itemReveal: {
    duration: 0.58,
    priority: 2,
    notes: [
      note(659.25, 0, 0.17, 0.5),
      note(880, 0.07, 0.2, 0.5),
      note(1318.5, 0.17, 0.35, 0.65),
      note(1760, 0.17, 0.27, 0.16),
    ],
  },
};

export function renderCue(kind, sampleRate = 44100) {
  const cue = cues[kind] || cues.click;
  const samples = new Float32Array(Math.ceil(cue.duration * sampleRate));
  for (const n of cue.notes) {
    const start = Math.round(n.at * sampleRate),
      count = Math.round(n.length * sampleRate);
    for (let i = 0; i < count && start + i < samples.length; i++) {
      const t = i / sampleRate,
        u = i / count;
      const attack = Math.min(1, t / 0.0035),
        release = Math.min(1, (1 - u) / 0.08);
      const envelope = attack * release * Math.exp(-u * (n.voice === 'mallet' ? 4.4 : 5.6));
      const phase = 2 * Math.PI * n.frequency * (t + ((n.bend - 1) * t * t) / (2 * n.length));
      const body =
        Math.sin(phase) +
        (n.voice === 'mallet'
          ? 0.24 * Math.sin(phase * 2.003) * Math.exp(-t * 16) +
            0.065 * Math.sin(phase * 3.97) * Math.exp(-t * 30)
          : n.voice === 'wood'
            ? 0.28 * Math.sin(phase * 2.71) * Math.exp(-t * 85)
            : 0.12 * Math.sin(phase * 2));
      samples[start + i] += body * envelope * n.gain;
    }
  }
  // A quiet short reflection gives the mallets body without a long/repeating tail.
  if (cue.priority >= 2) {
    const delay = Math.round(0.047 * sampleRate);
    for (let i = samples.length - 1; i >= delay; i--) samples[i] += samples[i - delay] * 0.08;
  }
  // Fade any reflection that meets the clip boundary; no discontinuous end click.
  for (let i = Math.max(0, samples.length - Math.ceil(sampleRate * 0.004)); i < samples.length; i++)
    samples[i] *= Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.004));
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0.82) for (let i = 0; i < samples.length; i++) samples[i] *= 0.82 / peak;
  return samples;
}
