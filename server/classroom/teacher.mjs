import { createClassroomProgress } from './progress.mjs';
export function createClassroomTeacher(runtime) {
  const {
    teacher,
    stmt,
    json,
    body,
    db,
    now,
    selectedCurriculum,
    gradeConfig,
    loadConfig,
    curriculumLabel,
  } = runtime;
  const progress = createClassroomProgress(runtime);
  return async function teacherRoute(req, env, url) {
    const p = url.pathname;
    if (!(await teacher(req, env))) return json({ error: 'ログインしてください。' }, 401);
    if (p === '/api/teacher/classes' && req.method === 'GET')
      return json({
        classes: (
          await stmt(env, 'SELECT * FROM classrooms WHERE deleted_at=0 ORDER BY created DESC').all()
        ).results,
        trash: (
          await stmt(
            env,
            'SELECT c.id,c.title,c.deleted_at,COUNT(s.id) AS students FROM classrooms c LEFT JOIN students s ON s.class_id=c.id AND s.deleted_at=0 WHERE c.deleted_at>0 GROUP BY c.id ORDER BY c.deleted_at DESC',
          ).all()
        ).results,
      });
    if (
      (p === '/api/teacher/class-delete' || p === '/api/teacher/class-restore') &&
      req.method === 'POST'
    ) {
      const data = await body(req),
        restore = p.endsWith('class-restore'),
        room = await stmt(
          env,
          'SELECT * FROM classrooms WHERE id=?',
          String(data.classId || ''),
        ).first();
      if (!room || Boolean(room.deleted_at) !== restore)
        return json({ error: 'クラスが見つかりません。表示を更新してください。' }, 404);
      if (data.confirm !== true || data.classTitle !== room.title)
        return json({ error: '対象のクラスをもう一度確認してください。' }, 400);
      if (!restore && room.active)
        return json({ error: '進行中のクラスは削除できません。先に授業を終了してください。' }, 409);
      const time = now();
      const results = await db(env).batch([
        restore
          ? stmt(
              env,
              'UPDATE classrooms SET deleted_at=0,active=0,ended=1,accepting=0,paused=0 WHERE id=? AND deleted_at>0',
              room.id,
            )
          : stmt(
              env,
              'UPDATE classrooms SET deleted_at=?,ended=1,accepting=0,paused=0 WHERE id=? AND active=0 AND deleted_at=0',
              time,
              room.id,
            ),
        stmt(
          env,
          "UPDATE recovery_requests SET status='denied' WHERE class_id=? AND EXISTS (SELECT 1 FROM classrooms WHERE id=? AND deleted_at=?)",
          room.id,
          room.id,
          restore ? -1 : time,
        ),
      ]);
      if (!Number(results[0].meta?.changes))
        return json(
          { error: 'クラスの状態が変更されました。表示を更新して確認してください。' },
          409,
        );
      return json({ ok: true });
    }
    if (p === '/api/teacher/classes' && req.method === 'POST') {
      const data = await body(req),
        selection = selectedCurriculum(data);
      if (!selection) return json({ error: '学年・教材を選んでください。' }, 400);
      const { grade, unit } = selection;
      if (data.format !== undefined && !['classic', 'adaptive-four'].includes(data.format))
        return json({ error: '練習の構成を確認してください。' }, 400);
      const stepUp = data.format === 'adaptive-four';
      const saved = gradeConfig((await loadConfig(env)).config, grade, unit),
        id = crypto.randomUUID(),
        title = String(data.title || curriculumLabel(grade, unit))
          .trim()
          .slice(0, 60),
        roundSize = [4, 6, 8, 10].includes(Number(data.roundSize))
          ? Number(data.roundSize)
          : saved.course.roundSize;
      const wordGroup = data.wordGroup ?? 'all',
        modes = stepUp
          ? runtime.course.practiceSettings({ format: 'adaptive-four' }).modes
          : (data.modes ?? saved.course.modes);
      const selected = saved.words.filter(
        (w) => w.enabled && saved.course.wordIds.includes(w.word),
      );
      if (selected.filter((w) => wordGroup === 'all' || w.group === wordGroup).length < 4)
        return json({ error: '使用する単語を4語以上選んでください。' }, 400);
      if (
        !['all', 'verb', 'adjective', 'family', 'occupation', 'phrase', 'other'].includes(
          wordGroup,
        ) ||
        !Array.isArray(modes) ||
        !modes.length ||
        modes.length > (stepUp ? 10 : 3) ||
        new Set(modes).size !== modes.length ||
        modes.some(
          (m) =>
            !(
              stepUp ? Object.keys(runtime.course.exerciseNames) : ['text', 'voice', 'spelling']
            ).includes(m),
        )
      )
        return json({ error: '単語の範囲と、1つ以上の問題の種類を選んでください。' }, 400);
      await db(env).batch([
        stmt(env, 'UPDATE classrooms SET active=0,ended=1,accepting=0 WHERE active=1'),
        stmt(
          env,
          'INSERT INTO classrooms (id,title,active,created,round_size,word_group,modes,vocabulary,grade,unit) VALUES (?,?,1,?,?,?,?,?,?,?)',
          id,
          title,
          now(),
          roundSize,
          wordGroup,
          JSON.stringify(stepUp ? { format: 'adaptive-four', modes } : modes),
          JSON.stringify(selected),
          grade,
          unit,
        ),
      ]);
      return json(await stmt(env, 'SELECT * FROM classrooms WHERE id=?', id).first());
    }
    if (p === '/api/teacher/class-state' && req.method === 'POST') {
      const data = await body(req),
        room = await stmt(
          env,
          'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
          String(data.classId || ''),
        ).first();
      if (!room) return json({ error: 'クラスが見つかりません。' }, 404);
      const action =
        data.action || (data.active === true ? 'reopen' : data.active === false ? 'end' : null);
      if (!['join-stop', 'join-open', 'pause', 'resume', 'end', 'reopen'].includes(action))
        return json({ error: '操作を選んでください。' }, 400);
      if (!room.active && action !== 'reopen')
        return json({ error: '終了した授業を再開してください。' }, 409);
      if (action === 'reopen')
        await db(env).batch([
          stmt(
            env,
            'UPDATE classrooms SET active=0,ended=1,accepting=0 WHERE active=1 AND id<>? AND EXISTS (SELECT 1 FROM classrooms WHERE id=? AND deleted_at=0)',
            room.id,
            room.id,
          ),
          stmt(
            env,
            'UPDATE classrooms SET active=1,ended=0,accepting=1,paused=0 WHERE id=? AND deleted_at=0',
            room.id,
          ),
        ]);
      else if (action === 'end')
        await stmt(
          env,
          'UPDATE classrooms SET active=0,ended=1,accepting=0,paused=0 WHERE id=? AND deleted_at=0',
          room.id,
        ).run();
      else if (action === 'pause' || action === 'resume')
        await stmt(
          env,
          'UPDATE classrooms SET paused=? WHERE id=? AND deleted_at=0',
          action === 'pause' ? 1 : 0,
          room.id,
        ).run();
      else
        await stmt(
          env,
          'UPDATE classrooms SET accepting=? WHERE id=? AND deleted_at=0',
          action === 'join-open' ? 1 : 0,
          room.id,
        ).run();
      const updated = await stmt(
        env,
        'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
        room.id,
      ).first();
      if (!updated) return json({ error: 'クラスが削除されました。表示を更新してください。' }, 409);
      return json({ classroom: updated });
    }
    if (p === '/api/teacher/trash' && req.method === 'GET') {
      const classId = url.searchParams.get('class');
      if (!classId) return json({ error: 'クラスを選んでください。' }, 400);
      if (
        !(await stmt(env, 'SELECT id FROM classrooms WHERE id=? AND deleted_at=0', classId).first())
      )
        return json({ error: 'クラスが見つかりません。' }, 404);
      return json({
        items: (
          await stmt(
            env,
            'SELECT t.id,t.scope,t.label,t.created,COUNT(s.id) AS count FROM record_trash t JOIN students s ON s.trash_id=t.id AND s.deleted_at>0 WHERE t.class_id=? GROUP BY t.id ORDER BY t.created DESC',
            classId,
          ).all()
        ).results,
      });
    }
    if (p === '/api/teacher/records-delete' && req.method === 'POST') {
      const data = await body(req),
        classId = String(data.classId || ''),
        room = await stmt(
          env,
          'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
          classId,
        ).first();
      if (!room) return json({ error: 'クラスが見つかりません。' }, 404);
      if (
        data.confirm !== true ||
        data.classTitle !== room.title ||
        !['student', 'class'].includes(data.scope)
      )
        return json({ error: '削除する記録をもう一度確認してください。' }, 400);
      let st = null;
      if (data.scope === 'student') {
        st = await stmt(
          env,
          'SELECT id,label FROM students WHERE id=? AND class_id=? AND deleted_at=0',
          String(data.studentId || ''),
          classId,
        ).first();
        if (!st)
          return json({ error: 'この生徒の記録は見つかりません。表示を更新してください。' }, 404);
        if (data.label !== st.label)
          return json({ error: '出席番号が変更されました。表示を更新して確認してください。' }, 409);
      }
      const id = crypto.randomUUID(),
        time = now();
      await db(env).batch([
        st
          ? stmt(
              env,
              "UPDATE recovery_requests SET status='denied' WHERE class_id=? AND (label=? OR student_id=?)",
              classId,
              st.label,
              st.id,
            )
          : stmt(env, "UPDATE recovery_requests SET status='denied' WHERE class_id=?", classId),
        stmt(
          env,
          'INSERT INTO record_trash (id,class_id,scope,label,created) VALUES (?,?,?,?,?)',
          id,
          classId,
          data.scope,
          st?.label || null,
          time,
        ),
        st
          ? stmt(
              env,
              'UPDATE students SET deleted_at=?,trash_id=?,revision=revision+1 WHERE id=? AND class_id=? AND deleted_at=0',
              time,
              id,
              st.id,
              classId,
            )
          : stmt(
              env,
              'UPDATE students SET deleted_at=?,trash_id=?,revision=revision+1 WHERE class_id=? AND deleted_at=0',
              time,
              id,
              classId,
            ),
      ]);
      return json({ ok: true, trashId: id });
    }
    if (p === '/api/teacher/records-restore' && req.method === 'POST') {
      const data = await body(req),
        classId = String(data.classId || ''),
        room = await stmt(
          env,
          'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
          classId,
        ).first();
      if (!room || data.confirm !== true || data.classTitle !== room.title)
        return json({ error: '戻すクラスをもう一度確認してください。' }, 400);
      const trash = await stmt(
        env,
        'SELECT * FROM record_trash WHERE id=? AND class_id=?',
        String(data.trashId || ''),
        classId,
      ).first();
      if (!trash) return json({ error: 'この記録はすでに戻されています。' }, 404);
      const conflict = await stmt(
        env,
        'SELECT live.label FROM students live JOIN students removed ON live.class_id=removed.class_id AND live.label=removed.label WHERE live.deleted_at=0 AND removed.deleted_at>0 AND removed.trash_id=? LIMIT 1',
        trash.id,
      ).first();
      if (conflict)
        return json(
          {
            error:
              '出席番号 ' +
              conflict.label +
              ' はすでに参加しています。新しい記録を先に回収するか、番号を変更してから戻してください。',
          },
          409,
        );
      try {
        await db(env).batch([
          stmt(
            env,
            'UPDATE students SET deleted_at=0,trash_id=NULL,revision=revision+1 WHERE trash_id=? AND class_id=?',
            trash.id,
            classId,
          ),
          stmt(env, 'DELETE FROM record_trash WHERE id=? AND class_id=?', trash.id, classId),
        ]);
      } catch (error) {
        if (String(error).includes('UNIQUE'))
          return json(
            { error: '同じ出席番号が参加しました。表示を更新してから戻してください。' },
            409,
          );
        throw error;
      }
      return json({ ok: true });
    }
    if (p === '/api/teacher/recovery' && req.method === 'POST') {
      const data = await body(req),
        r = await stmt(
          env,
          'SELECT * FROM recovery_requests WHERE id=?',
          String(data.requestId || ''),
        ).first();
      if (
        !r ||
        r.status !== 'pending' ||
        !(await stmt(
          env,
          'SELECT id FROM classrooms WHERE id=? AND deleted_at=0',
          r.class_id,
        ).first())
      )
        return json({ error: '申請は処理済みです。' }, 409);
      if (data.approve !== true) {
        await stmt(env, "UPDATE recovery_requests SET status='denied' WHERE id=?", r.id).run();
        return json({ ok: true });
      }
      const st = await stmt(
        env,
        'SELECT * FROM students WHERE class_id=? AND label=? AND deleted_at=0',
        r.class_id,
        r.label,
      ).first();
      if (!st) return json({ error: '生徒が見つかりません。' }, 404);
      await db(env).batch([
        stmt(
          env,
          'UPDATE students SET token_hash=? WHERE id=? AND deleted_at=0',
          r.token_hash,
          st.id,
        ),
        stmt(
          env,
          "UPDATE recovery_requests SET status='approved',student_id=? WHERE id=?",
          st.id,
          r.id,
        ),
      ]);
      return json({ ok: true });
    }
    return (await progress(req, env, url)) || json({ error: '見つかりません。' }, 404);
  };
}
