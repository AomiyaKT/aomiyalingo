export function createRaceRepository({
  stmt,
  now,
  raceStations,
  raceRemaining,
  raceElapsed,
  raceAccuracy,
  raceSettings,
}) {
  async function raceRoom(env, id) {
    let r = await stmt(env, 'SELECT * FROM races WHERE id=? AND deleted_at=0', id).first();
    if (r?.status === 'running' && raceRemaining(r) <= 0) {
      await stmt(
        env,
        "UPDATE races SET status=?,remaining_ms=0,elapsed_ms=?,started_at=NULL,revision=revision+1 WHERE id=? AND deleted_at=0 AND status='running' AND revision=?",
        raceStations(r) && (r.station || 0) < 2 ? 'intermission' : 'finished',
        raceElapsed(r),
        id,
        r.revision,
      ).run();
      r = await stmt(env, 'SELECT * FROM races WHERE id=? AND deleted_at=0', id).first();
    }
    return r;
  }
  async function raceRacers(env, id) {
    return (await stmt(env, 'SELECT * FROM racers WHERE race_id=? ORDER BY number', id).all())
      .results;
  }
  async function raceSave(env, p, state, r, running = true) {
    const personal = running && raceAccuracy(r),
      stamp = now();
    const result = await stmt(
      env,
      `UPDATE racers SET state=?,revision=revision+1,last_seen=? WHERE id=? AND revision=?${running ? " AND EXISTS (SELECT 1 FROM races WHERE id=? AND deleted_at=0 AND status='running' AND started_at<=? AND remaining_ms-(?-started_at)>0" + (personal ? ' AND elapsed_ms+MAX(0,?-started_at)-?<?' : '') + ')' : ''}`,
      JSON.stringify(state),
      stamp,
      p.id,
      p.revision,
      ...(running
        ? [
            r.id,
            stamp,
            stamp,
            ...(personal ? [stamp, state.joinedElapsed || 0, raceSettings(r).minutes * 60000] : []),
          ]
        : []),
    ).run();
    if (!Number(result.meta?.changes)) return null;
    return { ...p, state: JSON.stringify(state), revision: p.revision + 1 };
  }

  return { raceRoom, raceRacers, raceSave };
}
