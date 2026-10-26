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
    points: courseHistory.reduce((sum, h) => sum + (h.points || 0), 0),
    review: [
      ...new Map(history.filter((h) => !h.correct || h.hinted).map((h) => [h.word, h])).values(),
    ],
  };
}
