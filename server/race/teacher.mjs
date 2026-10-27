import { createRaceTrash } from './trash.mjs';
import { compactRaceRecords } from './record-sync.mjs';

export function createTeacherRaceHandler({
  words,
  stmt,
  db,
  now,
  json,
  body,
  hash,
  teacher,
  csvCell,
  selectedCurriculum,
  gradeConfig,
  loadConfig,
  raceTasks,
  raceSettings,
  raceStations,
  raceEndless,
  stationSize,
  raceElapsed,
  raceRemaining,
  raceAlias,
  raceRoom,
  raceRacers,
  raceBoard,
}) {
  const trash = createRaceTrash({ stmt, db, json, body, hash });
  return async function (req, env, url) {
    const path = url.pathname;
    if (!(await teacher(req, env))) return json({ error: 'ログインしてください。' }, 401);
    if (path.endsWith('/purge') && req.method === 'POST') return trash.purge(req, env);
    if (path.endsWith('/create') && req.method === 'POST') {
      const data = await body(req),
        id = crypto.randomUUID(),
        title = String(data.title || '単語レース')
          .trim()
          .slice(0, 60);
      if (!title) return json({ error: 'レース名を入力してください。' }, 400);
      const selection = selectedCurriculum(data);
      if (!selection) return json({ error: '学年・教材を選んでください。' }, 400);
      const { grade, unit } = selection;
      if (data.format !== undefined && !['adaptive-four', 'classic'].includes(data.format))
        return json({ error: '問題の構成を確認してください。' }, 400);
      if (data.endless !== undefined && typeof data.endless !== 'boolean')
        return json({ error: 'レースの形式を確認してください。' }, 400);
      const profile = gradeConfig((await loadConfig(env)).config, grade, unit),
        config = {
          ...profile,
          race: {
            ...profile.race,
            format: data.format || 'classic',
            endless: data.endless === true,
            ...(data.endless === true ? { questions: 24 } : {}),
            grade,
            unit,
            individualOrder: true,
          },
        };
      if (
        profile.words.filter((w) => w.enabled && profile.race.wordIds.includes(w.word)).length < 4
      )
        return json({ error: '使用する単語を4語以上選んでください。' }, 400);
      await db(env).batch([
        stmt(
          env,
          "UPDATE races SET status='finished',remaining_ms=0,started_at=NULL,revision=revision+1 WHERE deleted_at=0 AND status<>'finished'",
        ),
        stmt(
          env,
          "INSERT INTO races (id,title,status,tasks,remaining_ms,created) VALUES (?,?,'lobby',?,?,?)",
          id,
          title,
          JSON.stringify(raceTasks(config)),
          config.race.minutes * 60000,
          now(),
        ),
      ]);
      return json({ raceId: id });
    }
    if ((path.endsWith('/delete') || path.endsWith('/restore')) && req.method === 'POST') {
      const data = await body(req),
        restore = path.endsWith('/restore'),
        r = await stmt(env, 'SELECT * FROM races WHERE id=?', String(data.raceId || '')).first();
      if (!r || Boolean(r.deleted_at) !== restore)
        return json({ error: 'レースが見つかりません。表示を更新してください。' }, 404);
      if (data.confirm !== true || data.raceTitle !== r.title)
        return json({ error: '対象のレースをもう一度確認してください。' }, 400);
      if (!restore && r.status !== 'finished')
        return json({ error: '先にレースを終了してから削除してください。' }, 409);
      const result = await stmt(
        env,
        restore
          ? "UPDATE races SET deleted_at=0,revision=revision+1 WHERE id=? AND deleted_at>0 AND status='finished' AND revision=?"
          : "UPDATE races SET deleted_at=?,revision=revision+1 WHERE id=? AND deleted_at=0 AND status='finished' AND revision=?",
        ...(restore ? [r.id, r.revision] : [now(), r.id, r.revision]),
      ).run();
      if (!Number(result.meta?.changes))
        return json({ error: 'レースの状態が変更されました。表示を更新してください。' }, 409);
      return json({ ok: true });
    }
    const id = url.searchParams.get('race');
    if (path.endsWith('/current') && req.method === 'GET') {
      const latest = await stmt(
        env,
        'SELECT id FROM races WHERE deleted_at=0 ORDER BY created DESC LIMIT 1',
      ).first();
      const deleted = (
        await stmt(
          env,
          'SELECT r.id,r.title,r.revision,r.deleted_at,COUNT(p.id) AS players FROM races r LEFT JOIN racers p ON p.race_id=r.id WHERE r.deleted_at>0 GROUP BY r.id ORDER BY r.deleted_at DESC',
        ).all()
      ).results;
      return json({
        ...(latest
          ? compactRaceRecords(await raceBoard(env, await raceRoom(env, latest.id), true), url)
          : { race: null, players: [] }),
        races: (
          await stmt(
            env,
            'SELECT id,title,status,created FROM races WHERE deleted_at=0 ORDER BY created DESC',
          ).all()
        ).results,
        trash: deleted,
        trashVersion: await trash.version(deleted),
      });
    }
    if (path.endsWith('/state') && req.method === 'POST') {
      const data = await body(req),
        r = await raceRoom(env, String(data.raceId || ''));
      if (!r) return json({ error: 'レースが見つかりません。' }, 404);
      if (['closeJoin', 'openJoin'].includes(data.action)) {
        if (r.status === 'finished') return json({ error: 'レースは終了しています。' }, 409);
        const updated = await stmt(
          env,
          'UPDATE races SET join_closed=?,revision=revision+1 WHERE id=? AND deleted_at=0 AND revision=?',
          data.action === 'closeJoin' ? 1 : 0,
          r.id,
          r.revision,
        ).run();
        return Number(updated.meta?.changes)
          ? json(await raceBoard(env, await raceRoom(env, r.id), true))
          : json({ error: '状態が変わりました。もう一度お試しください。' }, 409);
      }
      if (data.action === 'nextStation') {
        if (!raceStations(r) || r.status !== 'intermission' || (r.station || 0) >= 2)
          return json({ error: '次のコースはまだ開始できません。' }, 409);
        const station = (r.station || 0) + 1,
          players = await raceRacers(env, r.id),
          stamp = now(),
          transition = crypto.randomUUID(),
          changes = [
            stmt(
              env,
              "UPDATE races SET station=?,station_token=?,status='running',remaining_ms=?,elapsed_ms=0,started_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='intermission'",
              station,
              transition,
              raceSettings(r).minutes * 60000,
              stamp + raceSettings(r).countdown * 1000,
              r.id,
              r.revision,
            ),
          ];
        for (const player of players) {
          const state = JSON.parse(player.state);
          Object.assign(state, {
            index: raceEndless(r) ? 0 : station * stationSize(r),
            joinedElapsed: 0,
            streak: 0,
            item: null,
            boost: 0,
            double: false,
            lucky: 0,
            itemBox: null,
            hintFor: null,
            hintStrength: 0,
            reviewTask: null,
            usedSegment: -1,
          });
          changes.push(
            stmt(
              env,
              'UPDATE racers SET state=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM races WHERE id=? AND revision=? AND station=? AND station_token=?)',
              JSON.stringify(state),
              player.id,
              player.revision,
              r.id,
              r.revision + 1,
              station,
              transition,
            ),
          );
        }
        const changed = await db(env).batch(changes);
        if (changed.some((x) => !Number(x.meta?.changes)))
          return json({ error: '状態が変わりました。表示を更新してください。' }, 409);
        return json(await raceBoard(env, await raceRoom(env, r.id), true));
      }
      const valid = { start: 'lobby', pause: 'running', resume: 'paused' };
      if (data.action !== 'end' && r.status !== valid[data.action])
        return json({ error: 'レースの状態が変わりました。表示を更新してください。' }, 409);
      if (data.action === 'end' && data.confirm !== true)
        return json({ error: '終了するレースを確認してください。' }, 400);
      if (data.action === 'start' && !(await raceRacers(env, r.id)).length)
        return json({ error: '生徒の参加を待ってから開始してください。' }, 409);
      const status = { start: 'running', pause: 'paused', resume: 'running', end: 'finished' }[
        data.action
      ];
      if (!status) return json({ error: '操作を確認してください。' }, 400);
      const result = await stmt(
        env,
        'UPDATE races SET status=?,remaining_ms=?,elapsed_ms=?,started_at=?,revision=revision+1 WHERE id=? AND deleted_at=0 AND revision=?',
        status,
        raceRemaining(r),
        raceElapsed(r),
        status === 'running'
          ? now() + (data.action === 'start' ? raceSettings(r).countdown * 1000 : 0)
          : null,
        r.id,
        r.revision,
      ).run();
      if (!Number(result.meta?.changes))
        return json({ error: '表示を更新して、もう一度お試しください。' }, 409);
      return json(await raceBoard(env, await raceRoom(env, r.id), true));
    }
    if (path.endsWith('/board') && req.method === 'GET') {
      const r = await raceRoom(env, id);
      return r
        ? json(compactRaceRecords(await raceBoard(env, r, true), url))
        : json({ error: 'レースが見つかりません。' }, 404);
    }
    if (path.endsWith('/export') && req.method === 'GET') {
      const r = await raceRoom(env, id);
      if (!r) return json({ error: 'レースが見つかりません。' }, 404);
      const players = await raceRacers(env, id),
        rows = [
          [
            '出席番号',
            'レーサー',
            '得点',
            '回答数',
            '独立正解',
            '問題',
            '題型',
            '回答',
            '正解',
            'ヒント',
            '加点',
            '自力正解率',
            '最大連続正解',
            '連続正解ボーナス',
            'コース',
            '正解の例',
            '問題のステップ',
            'サポート形式',
          ],
        ];
      for (const p of players) {
        const s = JSON.parse(p.state),
          answered = raceStations(r) ? s.history.filter((x) => !x.review).length : s.index,
          accuracy = s.index ? Math.round((s.correct / answered) * 1000) / 10 + '%' : '';
        if (!s.history.length) rows.push([p.label, raceAlias(p), s.score, 0, 0]);
        for (const h of s.history)
          rows.push([
            p.label,
            raceAlias(p),
            s.score,
            answered,
            s.correct,
            h.word,
            h.mode,
            h.answer,
            h.correct ? '○' : '×',
            h.hinted ? 'あり' : 'なし',
            h.points,
            accuracy,
            s.bestStreak || 0,
            h.streakBonus || 0,
            (h.station ?? 0) + 1,
            h.expected || '',
            h.level || '',
            h.support || '',
          ]);
      }
      return new Response('\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="aomiyalingo-race.csv"',
          'cache-control': 'no-store',
        },
      });
    }
    return json({ error: '見つかりません。' }, 404);
  };
}
