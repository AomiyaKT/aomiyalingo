// Only advertise records actually held by this page. A reload receives a full snapshot.
export function recordSyncQuery(data) {
  if (!data?.race?.id || !data.players?.length) return '';
  const records = data.players
    .filter((p) => Array.isArray(p.history) && Number.isSafeInteger(p.recordRevision))
    .slice(0, 60)
    .map((p) => [p.id, p.recordRevision]);
  return records.length
    ? '&records=' + encodeURIComponent(JSON.stringify([data.race.id, records]))
    : '';
}

export function restoreRaceRecords(result, previous) {
  if (!result?.players) return result;
  const prior = new Map(
    result.race?.id === previous?.race?.id ? (previous.players || []).map((p) => [p.id, p]) : [],
  );
  return {
    ...result,
    players: result.players.map((p) => {
      if (Array.isArray(p.history)) return p;
      const cached = prior.get(p.id);
      if (!cached || cached.recordRevision !== p.recordRevision || !Array.isArray(cached.history))
        throw Error('回答履歴を再読み込みしてください。');
      return { ...p, history: cached.history };
    }),
  };
}
