// A bounded immutable curriculum plus a personal cursor, rather than an ever-growing deck.
export function seededShuffle(values, seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    state += 0x6d2b79f5;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    const j = Math.floor((((x ^ (x >>> 14)) >>> 0) / 4294967296) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function endlessMode(state, station, modes) {
  const cycle = Math.floor(state.index / (modes.length * 6));
  const order = seededShuffle(
    Array.from({ length: modes.length * 6 }, (_, i) => modes[i % modes.length]),
    `${state.deckSeed}:${station}:modes:${cycle}`,
  );
  return order[state.index % order.length];
}

export function endlessTask({ state, station, pool, modes, taskFactory, rules }) {
  const index = state.index,
    seed = state.deckSeed,
    id = `endless-${seed}-${station}-${index}`,
    wordCycle = Math.floor(index / pool.length),
    word = seededShuffle(pool, `${seed}:${station}:words:${wordCycle}`)[index % pool.length],
    mode = endlessMode(state, station, modes);
  let draw = 0;
  return {
    ...taskFactory(
      word,
      mode,
      pool,
      (values) => seededShuffle(values, `${id}:choice:${draw++}`),
      id,
    ),
    rules,
    station,
  };
}
