export function createClassroomIdentity({
  stmt,
  json,
  body,
  validLabel,
  now,
  hash,
  token,
  newLesson,
  roomState,
}) {
  return async function identity(req, env, url) {
    const p = url.pathname;
    if (p === '/api/class/current' && req.method === 'GET') {
      const target = url.searchParams.get('class');
      const room = target
        ? await stmt(env, 'SELECT * FROM classrooms WHERE id=? AND deleted_at=0', target).first()
        : await stmt(
            env,
            'SELECT * FROM classrooms WHERE active=1 AND deleted_at=0 ORDER BY created DESC LIMIT 1',
          ).first();
      return json({ classroom: room ? { id: room.id, ...roomState(room) } : null });
    }
    if (p === '/api/recovery/request' && req.method === 'POST') {
      const data = await body(req),
        label = validLabel(data.label);
      if (!label) return json({ error: '出席番号を確認してください。' }, 400);
      const room = await stmt(
        env,
        'SELECT * FROM classrooms WHERE id=? AND active=1',
        String(data.classId || ''),
      ).first();
      if (!room) return json({ error: '授業は終了しています。' }, 409);
      if (
        !(await stmt(
          env,
          'SELECT id FROM students WHERE class_id=? AND label=? AND deleted_at=0',
          room.id,
          label,
        ).first())
      )
        return json({ error: 'この番号はまだ参加していません。' }, 404);
      const existing = await stmt(
        env,
        "SELECT created FROM recovery_requests WHERE class_id=? AND label=? AND status='pending' AND created>?",
        room.id,
        label,
        now() - 60000,
      ).first();
      if (existing) return json({ error: '申請済みです。先生に声をかけてください。' }, 429);
      const id = crypto.randomUUID(),
        value = token();
      await stmt(
        env,
        'INSERT INTO recovery_requests (id,class_id,label,token_hash,status,created) VALUES (?,?,?,?,?,?)',
        id,
        room.id,
        label,
        await hash(value),
        'pending',
        now(),
      ).run();
      return json({ id, token: value, label, classId: room.id });
    }
    if (p === '/api/recovery/status' && req.method === 'GET') {
      const value = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
      const r = value
        ? await stmt(
            env,
            'SELECT * FROM recovery_requests WHERE token_hash=?',
            await hash(value),
          ).first()
        : null;
      if (!r) return json({ error: '申請が見つかりません。' }, 401);
      if (
        !(await stmt(
          env,
          'SELECT id FROM classrooms WHERE id=? AND deleted_at=0',
          r.class_id,
        ).first()) ||
        !(await stmt(
          env,
          'SELECT id FROM students WHERE class_id=? AND label=? AND deleted_at=0',
          r.class_id,
          r.label,
        ).first())
      )
        return json({ error: '参加は解除されています。もう一度参加してください。' }, 401);
      if (r.status !== 'approved') return json({ status: r.status });
      const st = await stmt(
        env,
        'SELECT * FROM students WHERE id=? AND token_hash=? AND deleted_at=0',
        r.student_id,
        r.token_hash,
      ).first();
      if (!st) return json({ error: '別の端末へ引き継がれました。' }, 401);
      const room = await stmt(
        env,
        'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
        st.class_id,
      ).first();
      return json({
        status: 'approved',
        session: {
          id: st.id,
          label: st.label,
          classId: st.class_id,
          title: room.title,
          lesson: JSON.parse(st.lesson),
          ...roomState(room),
        },
      });
    }
    if (p === '/api/join' && req.method === 'POST') {
      const data = await body(req),
        label = String(data.label || '').trim();
      if (!/^\d{1,3}$/.test(label) || Number(label) < 1)
        return json({ error: '出席番号を1〜999で入力してください。' }, 400);
      const normalized = String(Number(label));
      const room = data.classId
        ? await stmt(
            env,
            'SELECT * FROM classrooms WHERE id=? AND active=1 AND accepting=1 AND ended=0',
            data.classId,
          ).first()
        : await stmt(
            env,
            'SELECT * FROM classrooms WHERE active=1 AND accepting=1 AND ended=0 ORDER BY created DESC LIMIT 1',
          ).first();
      if (!room) return json({ error: '先生がクラスを開始するまで、お待ちください。' }, 409);
      if (
        await stmt(
          env,
          'SELECT id FROM students WHERE class_id=? AND label=? AND deleted_at=0',
          room.id,
          normalized,
        ).first()
      )
        return json(
          {
            error: 'この出席番号は参加済みです。引き継ぐには先生の許可が必要です。',
            code: 'DUPLICATE',
          },
          409,
        );
      const id = crypto.randomUUID(),
        value = token(),
        lesson = newLesson(null, room);
      try {
        const inserted = await stmt(
          env,
          'INSERT INTO students (id,class_id,label,token_hash,lesson,revision,last_seen,created) SELECT ?,?,?,?,?,0,?,? WHERE EXISTS (SELECT 1 FROM classrooms WHERE id=? AND active=1 AND accepting=1 AND ended=0)',
          id,
          room.id,
          normalized,
          await hash(value),
          JSON.stringify(lesson),
          now(),
          now(),
          room.id,
        ).run();
        if (Number(inserted.meta?.changes) === 0)
          return json({ error: '先生がクラスを閉じました。再開までお待ちください。' }, 409);
      } catch (error) {
        if (String(error).includes('UNIQUE'))
          return json({ error: 'この出席番号は参加済みです。' }, 409);
        throw error;
      }
      return json({
        id,
        token: value,
        label: normalized,
        classId: room.id,
        title: room.title,
        lesson,
        ...roomState(room),
      });
    }
    return null;
  };
}
