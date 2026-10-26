const voiceModes = new Set(['voice', 'audioMatch', 'audioSentence', 'audioCloze', 'dictation']);
function addAnswer(scope, h) {
  scope.score += h.points;
  if (h.review) {
    if (h.correct) scope.recovered++;
    return;
  }
  scope.answered++;
  if (h.correct && h.hinted) scope.hintedCorrect++;
  if (h.correct && !h.hinted) {
    scope.independent++;
    if (voiceModes.has(h.mode)) scope.voice++;
    if (h.mode === 'spelling' || h.mode === 'dictation') scope.spelling++;
  }
}
// All race readers share this one traversal. Word lists are materialized only for a learner.
export function summarizeRaceHistory(history) {
  const bucket = () => ({
    answered: 0,
    independent: 0,
    score: 0,
    hintedCorrect: 0,
    recovered: 0,
    voice: 0,
    spelling: 0,
  });
  const all = bucket(),
    stations = new Map();
  for (const h of history) {
    let scope = stations.get(h.station);
    if (!scope) {
      scope = bucket();
      stations.set(h.station, scope);
    }
    addAnswer(all, h);
    addAnswer(scope, h);
  }
  const wordScopes = new Map();
  function words(station = 'all') {
    if (wordScopes.has(station)) return wordScopes.get(station);
    const independent = new Set(),
      review = new Set();
    for (const h of history) {
      if (h.review || (station !== 'all' && h.station !== station)) continue;
      if (h.correct && !h.hinted) independent.add(h.word);
      else review.add(h.word);
    }
    const result = { independent, review };
    wordScopes.set(station, result);
    return result;
  }
  return { all, stations, words };
}

export function createRaceHistoryReader() {
  const cache = new WeakMap();
  return (state) => {
    const history = state.history;
    const prior = cache.get(state);
    // Answer history is append-only; raw DB row replacements create a new state.
    if (
      prior?.history === history &&
      prior.length === history.length &&
      prior.last === history.at(-1)
    )
      return prior.summary;
    const summary = summarizeRaceHistory(history);
    cache.set(state, { history, length: history.length, last: history.at(-1), summary });
    return summary;
  };
}
