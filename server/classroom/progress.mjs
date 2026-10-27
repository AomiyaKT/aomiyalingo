// Called only after the teacher session has been checked.
export function indexAttemptsByStudent(attempts) {
  const index = new Map();
  for (const attempt of attempts) {
    if (!index.has(attempt.student_id)) index.set(attempt.student_id, []);
    index.get(attempt.student_id).push(attempt);
  }
  return index;
}
export function createClassroomProgress({
  stmt,
  json,
  course,
  roomWords,
  roomModes,
  csvCell,
  now,
}) {
  return async function progress(req, env, url) {
    const p = url.pathname;
    if (p === '/api/teacher/export' && req.method === 'GET') {
      const id = url.searchParams.get('class');
      if (!(await stmt(env, 'SELECT id FROM classrooms WHERE id=? AND deleted_at=0', id).first()))
        return json({ error: 'クラスが見つかりません。' }, 404);
      const students = (
          await stmt(env, 'SELECT * FROM students WHERE class_id=? AND deleted_at=0', id).all()
        ).results,
        attempts = (
          await stmt(
            env,
            'SELECT a.*,a.rowid AS sequence FROM attempts a JOIN students s ON s.id=a.student_id WHERE a.class_id=? AND s.deleted_at=0 ORDER BY a.created,a.rowid',
            id,
          ).all()
        ).results;
      const room = await stmt(
        env,
        'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
        id,
      ).first();
      const rows = [
        ['出席番号', '単語', '題型', '状態', '初回正解', 'ヒント使用', '直近は独立正解', '回答数'],
      ];
      const byStudent = indexAttemptsByStudent(attempts),
        words = roomWords(room),
        modes = roomModes(room);
      const states = {
        unanswered: '未回答',
        wrong: '要復習',
        correct: '初回正解',
        corrected: '修正済み',
      };
      for (const st of students) {
        const stats = course.stats(st, byStudent.get(st.id) || [], words, modes);
        for (const w of stats.skills)
          for (const [mode, m] of Object.entries(w.modes))
            rows.push([
              st.label,
              w.word,
              mode,
              m.latestHinted && m.state !== 'wrong' ? 'ヒントで正解' : states[m.state],
              m.firstCorrect === null ? '' : m.firstCorrect ? '○' : '×',
              m.hinted ? 'あり' : 'なし',
              m.independent ? 'はい' : 'いいえ',
              m.attempts,
            ]);
      }
      return new Response('\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="aomiyalingo-results.csv"',
          'cache-control': 'no-store',
        },
      });
    }
    if (p === '/api/teacher/progress' && req.method === 'GET') {
      const classId = url.searchParams.get('class');
      if (!classId) return json({ error: 'クラスを選んでください。' }, 400);
      if (
        !(await stmt(env, 'SELECT id FROM classrooms WHERE id=? AND deleted_at=0', classId).first())
      )
        return json({ error: 'クラスが見つかりません。' }, 404);
      const rows = (
        await stmt(
          env,
          'SELECT id,label,lesson,last_seen,created FROM students WHERE class_id=? AND deleted_at=0 ORDER BY CAST(label AS INTEGER),label',
          classId,
        ).all()
      ).results;
      const attempts = (
        await stmt(
          env,
          'SELECT a.rowid AS sequence,a.id,a.student_id,s.label,a.word,a.mode,a.answer,a.correct,a.hint_used,a.is_review,a.created FROM attempts a JOIN students s ON s.id=a.student_id WHERE a.class_id=? AND s.deleted_at=0 ORDER BY a.created DESC,a.rowid DESC',
          classId,
        ).all()
      ).results;
      const classroom = await stmt(
        env,
        'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
        classId,
      ).first();
      const byStudent = indexAttemptsByStudent(attempts),
        words = roomWords(classroom),
        modes = roomModes(classroom);
      const students = rows.map((s) => {
        const l = JSON.parse(s.lesson);
        const history = byStudent.get(s.id) || [];
        return {
          id: s.id,
          label: s.label,
          completed: l.completed,
          total: l.total,
          attempts: l.attempts,
          current: l.queue[0] || null,
          done: l.queue.length === 0,
          lastSeen: s.last_seen,
          created: s.created,
          errors: history.filter((a) => !a.correct).length,
          stage: l.queue[0]?.stage || l.rounds || null,
          rounds: l.rounds || null,
          ...course.stats(s, history, words, modes),
        };
      });
      const recovery = (
        await stmt(
          env,
          "SELECT r.id,r.label,r.created FROM recovery_requests r JOIN students s ON s.class_id=r.class_id AND s.label=r.label AND s.deleted_at=0 WHERE r.class_id=? AND r.status='pending' ORDER BY r.created",
          classId,
        ).all()
      ).results;
      const trash = (
        await stmt(
          env,
          'SELECT t.id,t.scope,t.label,t.created,COUNT(s.id) AS count FROM record_trash t JOIN students s ON s.trash_id=t.id AND s.deleted_at>0 WHERE t.class_id=? GROUP BY t.id ORDER BY t.created DESC',
          classId,
        ).all()
      ).results;
      return json({ students, attempts, classroom, recovery, trash, updated: now() });
    }
    return null;
  };
}
