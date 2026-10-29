export function createStudentRaceHandler({
  raceTaskList,
  grade,
  stmt,
  db,
  now,
  json,
  body,
  hash,
  token,
  validLabel,
  shuffle,
  raceAvatars,
  raceSettings,
  raceStations,
  raceEndless,
  stationSize,
  raceAccuracy,
  raceElapsed,
  raceAccepting,
  raceRemaining,
  racePublic,
  raceRoom,
  raceRacers,
  raceSession,
}) {
  return async function (req, env, url) {
    const path = url.pathname;
    if (path.endsWith('/current') && req.method === 'GET') {
      const target = url.searchParams.get('race');
      const r = target
        ? await stmt(env, 'SELECT * FROM races WHERE id=? AND deleted_at=0', target).first()
        : await stmt(
            env,
            'SELECT * FROM races WHERE deleted_at=0 ORDER BY created DESC LIMIT 1',
          ).first();
      return json({ race: r ? racePublic(await raceRoom(env, r.id)) : null });
    }
    if (path.endsWith('/join') && req.method === 'POST') {
      const data = await body(req),
        label = validLabel(data.label);
      if (!label) return json({ error: '出席番号を1〜999で入力してください。' }, 400);
      const r = await raceRoom(env, String(data.raceId || ''));
      if (!r || !raceAccepting(r))
        return json({ error: '参加受付は終了しました。次のレースを待ってください。' }, 409);
      const id = crypto.randomUUID(),
        value = token(),
        state = {
          prepared: false,
          ready: r.status === 'lobby' && data.waitForReady !== true,
          requiresReady: data.waitForReady === true,
          joinedElapsed: 0,
          streak: 0,
          bestStreak: 0,
          index: raceEndless(r) ? 0 : raceStations(r) ? (r.station || 0) * stationSize(r) : 0,
          deckSeed: id,
          score: 0,
          correct: 0,
          history: [],
          wrong: [],
          item: null,
          boost: 0,
          hintFor: null,
          reviewTask: null,
          usedSegment: -1,
          avatar: raceAvatars.includes(data.avatar) ? data.avatar : 'cat',
        };
      if (raceSettings(r).individualOrder) {
        const size = raceTaskList(r).length,
          prior = (await raceRacers(env, r.id)).map((p) =>
            JSON.parse(p.state).taskOrder?.join(','),
          );
        let order;
        do {
          order = raceStations(r)
            ? Array.from({ length: 3 }, (_, station) =>
                shuffle(
                  Array.from({ length: stationSize(r) }, (_, i) => station * stationSize(r) + i),
                ),
              ).flat()
            : shuffle(Array.from({ length: size }, (_, i) => i));
        } while (prior.includes(order.join(',')) || order.every((v, i) => v === i));
        state.taskOrder = order;
      }
      try {
        const inserted = await stmt(
          env,
          "INSERT INTO racers (id,race_id,label,number,token_hash,state,last_seen) SELECT ?,?,?,(SELECT COALESCE(MAX(number),0)+1 FROM racers WHERE race_id=?),?,?,? WHERE EXISTS (SELECT 1 FROM races WHERE id=? AND deleted_at=0 AND join_closed=0 AND (status='lobby' OR (?=1 AND status IN ('running','paused')))) AND (SELECT COUNT(*) FROM racers WHERE race_id=?)<60",
          id,
          r.id,
          label,
          r.id,
          await hash(value),
          JSON.stringify(state),
          now(),
          r.id,
          raceAccuracy(r) ? 1 : 0,
          r.id,
        ).run();
        if (!Number(inserted.meta?.changes))
          return json({ error: '参加受付が終了したか、定員60人に達しました。' }, 409);
      } catch (e) {
        if (String(e).includes('UNIQUE'))
          return json(
            { error: 'この出席番号は参加済みです。同じiPad・同じブラウザーで開き直してください。' },
            409,
          );
        throw e;
      }
      const p = await stmt(env, 'SELECT * FROM racers WHERE id=?', id).first();
      return json({ token: value, ...(await raceSession(env, p, r)) });
    }
    const value = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1],
      p = value
        ? await stmt(env, 'SELECT * FROM racers WHERE token_hash=?', await hash(value)).first()
        : null;
    if (!p) return json({ error: 'もう一度レースに参加してください。' }, 401);
    const r = await raceRoom(env, p.race_id);
    if (!r) return json({ error: 'レースが見つかりません。' }, 404);
    if (path.endsWith('/me') && req.method === 'GET') {
      return json(await raceSession(env, p, r, null, url.searchParams.get('known')));
    }
    if (path.endsWith('/avatar') && req.method === 'POST') {
      const data = await body(req);
      if (!raceAvatars.includes(data.avatar))
        return json({ error: 'アバターを選んでください。' }, 400);
      if (
        r.status !== 'lobby' &&
        !(raceAccuracy(r) && JSON.parse(p.state).ready === false && r.status !== 'finished')
      )
        return json({ error: 'レースが始まりました。アバターは次のレースで変更できます。' }, 409);
      const state = JSON.parse(p.state);
      state.avatar = data.avatar;
      if (r.status === 'lobby') {
        state.prepared = false;
        if (state.requiresReady) state.ready = false;
      }
      const saved = await stmt(
        env,
        "UPDATE racers SET state=?,revision=revision+1,last_seen=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM races WHERE id=? AND deleted_at=0 AND (status='lobby' OR (?=1 AND status IN ('running','paused'))))",
        JSON.stringify(state),
        now(),
        p.id,
        p.revision,
        r.id,
        raceAccuracy(r) && state.ready === false ? 1 : 0,
      ).run();
      if (!Number(saved.meta?.changes))
        return json({ error: '状態が変わりました。もう一度確認してください。' }, 409);
      return json(
        await raceSession(
          env,
          { ...p, revision: p.revision + 1, state: JSON.stringify(state) },
          await raceRoom(env, r.id),
        ),
      );
    }
    if (path.endsWith('/ready') && req.method === 'POST') {
      const s = JSON.parse(p.state);
      if (r.status === 'finished') return json({ error: '次のレースを待ってください。' }, 409);
      if (r.status === 'lobby') {
        const data = await body(req);
        if (!raceAvatars.includes(data.avatar))
          return json({ error: 'アバターを選んでください。' }, 400);
        if (s.prepared === true && s.avatar === data.avatar)
          return json(await raceSession(env, p, r));
        s.prepared = true;
        s.ready = true;
        s.avatar = data.avatar;
        const saved = await stmt(
          env,
          "UPDATE racers SET state=?,revision=revision+1,last_seen=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM races WHERE id=? AND deleted_at=0 AND status='lobby' AND revision=?)",
          JSON.stringify(s),
          now(),
          p.id,
          p.revision,
          r.id,
          r.revision,
        ).run();
        if (!Number(saved.meta?.changes))
          return json({ error: '状態が変わりました。もう一度準備ボタンを押してください。' }, 409);
        return json(
          await raceSession(
            env,
            { ...p, revision: p.revision + 1, state: JSON.stringify(s) },
            await raceRoom(env, r.id),
          ),
        );
      }
      if (!raceAccuracy(r)) return json({ error: '次のレースを待ってください。' }, 409);
      if (s.ready !== false) return json(await raceSession(env, p, r));
      const data = await body(req);
      if (!raceAvatars.includes(data.avatar))
        return json({ error: 'アバターを選んでください。' }, 400);
      const elapsed = raceElapsed(r),
        stamp = now();
      s.ready = true;
      s.prepared = true;
      s.avatar = data.avatar;
      s.joinedElapsed = elapsed;
      const state = JSON.stringify(s),
        results = await db(env).batch([
          stmt(
            env,
            "UPDATE racers SET state=?,revision=revision+1,last_seen=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM races WHERE id=? AND deleted_at=0 AND status IN ('lobby','running','paused') AND revision=?)",
            state,
            stamp,
            p.id,
            p.revision,
            r.id,
            r.revision,
          ),
          stmt(
            env,
            'UPDATE races SET remaining_ms=?,elapsed_ms=?,started_at=?,revision=revision+1 WHERE id=? AND deleted_at=0 AND revision=? AND EXISTS (SELECT 1 FROM racers WHERE id=? AND revision=? AND state=?)',
            Math.max(raceRemaining(r), raceSettings(r).minutes * 60000),
            elapsed,
            r.status === 'running' ? Math.max(stamp, r.started_at) : null,
            r.id,
            r.revision,
            p.id,
            p.revision + 1,
            state,
          ),
        ]);
      if (results.some((x) => !Number(x.meta?.changes)))
        return json({ error: '状態が変わりました。もう一度参加ボタンを押してください。' }, 409);
      return json(
        await raceSession(
          env,
          { ...p, revision: p.revision + 1, state },
          await raceRoom(env, r.id),
        ),
      );
    }
    return grade(req, env, url, p, r);
  };
}
