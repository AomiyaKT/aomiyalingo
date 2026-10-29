// One transition policy for server commands and browser lifecycle tests. The
// running database status also represents the visible countdown.
const transitions = Object.freeze({
  start: { from: ['lobby'], to: 'running' },
  pause: { from: ['running'], to: 'paused' },
  resume: { from: ['paused'], to: 'running' },
  nextStation: { from: ['intermission'], to: 'running' },
  end: { from: ['lobby', 'running', 'paused', 'intermission', 'finished'], to: 'finished' },
});
export function raceTransition(status, action) {
  const rule = Object.hasOwn(transitions, action) && transitions[action];
  return rule && rule.from.includes(status) ? rule.to : null;
}
export function courseEndStatus(station, stations) {
  return station < stations - 1 ? 'intermission' : 'finished';
}

// Own transient resources separately from authoritative learning data. Pause
// preserves an answer/draft; changing racer/course invalidates that ownership.
export function createStudentRaceLifecycle({ onBoundary, onSuspend }) {
  let previous = null;
  return {
    update(result, hasFeedback = false) {
      const owner = [result.race.id, result.self.id, result.race.station || 0].join(':');
      const boundary = previous !== null && previous.owner !== owner;
      if (boundary) onBoundary();
      const phase = studentPhase(result, boundary ? false : hasFeedback);
      if (
        boundary ||
        (['paused', 'finished', 'results', 'courseDone'].includes(phase) &&
          previous?.phase !== phase)
      )
        onSuspend();
      previous = { owner, phase };
      return phase;
    },
    leave() {
      onSuspend();
      previous = null;
    },
  };
}

export function createRacePlayback({
  audio,
  volume,
  owner,
  enabled,
  onError,
  play = (...args) => playWordAudio(...args),
  speech = globalThis.speechSynthesis,
}) {
  let serial = 0;
  return {
    stop() {
      serial++;
      audio.pause();
      speech?.cancel();
    },
    async play(word, rate = 1, report = true) {
      if (!enabled()) return;
      const ticket = ++serial,
        scope = owner();
      try {
        await play(audio, word, volume(), rate);
      } catch {
        if (report && ticket === serial && scope === owner() && enabled()) onError();
      }
    },
  };
}

// A single priority order for student screens, including late joins and course breaks.
export function studentPhase(result, hasFeedback = false) {
  const { race, self } = result || {};
  if (!race || !self) return 'entry';
  if (race.status === 'finished') return 'finished';
  if (self.ready === false) return 'prepare';
  if (race.status === 'lobby') return self.prepared ? 'ready' : 'prepare';
  if (race.status === 'countdown') return 'countdown';
  if (race.status === 'paused') return 'paused';
  if (race.status === 'intermission') return 'results';
  if (self.done) return 'courseDone';
  if (self.task || hasFeedback) return 'question';
  return 'waiting';
}

// "Finished" also represents a teacher stopping/resetting a race. Celebrate
// only a course break or a completed final course, never an early cancellation.
export function isCourseClear(result) {
  const race = result?.race;
  if (race?.status === 'intermission') return true;
  if (race?.status !== 'finished') return false;
  const stations = race.stations || (race.rules >= 5 ? 3 : 1);
  if ((race.station || 0) !== stations - 1) return false;
  const players = result.players || result.board || [];
  return race.remaining === 0 || (players.length > 0 && players.every((p) => p.done));
}

export function courseSummary(result) {
  const station = result.race.station || 0;
  const courseHistory = (result.self.history || []).filter((h) => (h.station ?? 0) === station);
  const history = courseHistory.filter((h) => !h.review);
  const independent = history.filter((h) => h.correct && !h.hinted).length;
  return {
    answered: history.length,
    independent,
    accuracy: history.length ? Math.round((independent / history.length) * 100) : null,
    points:
      courseHistory.reduce((sum, h) => sum + (h.points || 0), 0) +
      (result.self.stationItemBonus || 0),
    review: [
      ...new Map(history.filter((h) => !h.correct || h.hinted).map((h) => [h.word, h])).values(),
    ],
  };
}
