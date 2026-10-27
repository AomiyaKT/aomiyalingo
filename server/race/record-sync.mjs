// Authenticated teacher endpoints only. Rankings/timers always remain live;
// omit answer histories only when the requesting page has that exact revision.
export function compactRaceRecords(board, url) {
  const raw = url.searchParams.get('records');
  if (!raw || raw.length > 10000 || !board?.race) return board;
  let known;
  try {
    const [raceId, entries] = JSON.parse(raw);
    if (raceId !== board.race.id || !Array.isArray(entries) || entries.length > 60) return board;
    known = new Map(
      entries.filter(
        (v) => Array.isArray(v) && typeof v[0] === 'string' && Number.isSafeInteger(v[1]),
      ),
    );
  } catch {
    return board;
  }
  return {
    ...board,
    players: board.players.map((p) => {
      if (!Number.isSafeInteger(p.recordRevision) || known.get(p.id) !== p.recordRevision) return p;
      const { history, ...live } = p;
      return live;
    }),
  };
}
