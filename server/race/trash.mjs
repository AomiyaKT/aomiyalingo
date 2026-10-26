// Called only after the teacher session has been checked by the parent route.
export function createRaceTrash({ stmt, db, json, body, hash }) {
  const snapshot = (rows) =>
    rows
      .map((r) => [r.id, r.title, r.revision, r.deleted_at])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const version = (rows) => hash(JSON.stringify(snapshot(rows)));
  async function purge(req, env) {
    const data = await body(req);
    if (data.confirm !== true || !['one', 'all'].includes(data.scope))
      return json({ error: '完全に削除する対象を確認してください。' }, 400);
    let rows;
    if (data.scope === 'one') {
      if (
        typeof data.raceId !== 'string' ||
        !Number.isSafeInteger(data.revision) ||
        !Number.isSafeInteger(data.deletedAt) ||
        data.deletedAt <= 0
      )
        return json({ error: '削除するレースを確認してください。' }, 400);
      const row = await stmt(
        env,
        'SELECT id,title,status,revision,deleted_at FROM races WHERE id=?',
        data.raceId,
      ).first();
      if (!row) return json({ error: 'レースが見つかりません。' }, 404);
      if (data.raceTitle !== row.title)
        return json({ error: '対象のレースをもう一度確認してください。' }, 400);
      if (
        !row.deleted_at ||
        row.status !== 'finished' ||
        row.revision !== data.revision ||
        row.deleted_at !== data.deletedAt
      )
        return json({ error: 'レースの状態が変わりました。表示を更新してください。' }, 409);
      rows = [row];
    } else {
      if (typeof data.trashVersion !== 'string')
        return json({ error: '回収箱の内容をもう一度確認してください。' }, 400);
      rows = (
        await stmt(
          env,
          'SELECT id,title,status,revision,deleted_at FROM races WHERE deleted_at>0',
        ).all()
      ).results;
      if (data.trashVersion !== (await version(rows)))
        return json(
          { error: '回収箱の内容が変わりました。表示を更新して、もう一度確認してください。' },
          409,
        );
    }
    if (!rows.length) return json({ ok: true, removed: 0 });
    // Both deletes use the same all-or-nothing revision guard inside one batch.
    // Restored/re-deleted records fail the guard; newly trashed races are excluded.
    const targets = JSON.stringify(snapshot(rows));
    const selection = `WITH matched AS (
      SELECT r.id FROM races r JOIN json_each(?) t ON r.id=json_extract(t.value,'$[0]')
      WHERE r.status='finished' AND r.deleted_at>0
        AND r.title=json_extract(t.value,'$[1]')
        AND r.revision=json_extract(t.value,'$[2]')
        AND r.deleted_at=json_extract(t.value,'$[3]')
    ), confirmed AS (SELECT id FROM matched WHERE (SELECT COUNT(*) FROM matched)=?) `;
    const results = await db(env).batch([
      stmt(
        env,
        selection + 'DELETE FROM racers WHERE race_id IN (SELECT id FROM confirmed)',
        targets,
        rows.length,
      ),
      stmt(
        env,
        selection + 'DELETE FROM races WHERE id IN (SELECT id FROM confirmed)',
        targets,
        rows.length,
      ),
    ]);
    if (Number(results[1].meta?.changes) !== rows.length)
      return json({ error: '回収箱の内容が変わりました。表示を更新してください。' }, 409);
    return json({ ok: true, removed: rows.length });
  }
  return { version, purge };
}
