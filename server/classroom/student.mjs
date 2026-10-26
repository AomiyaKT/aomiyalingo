import { createClassroomGrading } from './grading.mjs';
export function createClassroomStudent(runtime) {
  const {
    student,
    json,
    stmt,
    roomState,
    now,
    body,
    validLabel,
    closed,
    roomModes,
    roomWords,
    newLesson,
    course,
  } = runtime;
  const grade = createClassroomGrading(runtime);
  return async function studentRoute(req, env, url) {
    const p = url.pathname;
    const s = await student(req, env);
    if (!s) return json({ error: 'もう一度参加してください。' }, 401);
    const room = await stmt(
      env,
      'SELECT * FROM classrooms WHERE id=? AND deleted_at=0',
      s.class_id,
    ).first();
    if (p === '/api/student/status' && req.method === 'GET') return json(roomState(room));
    if (p === '/api/student/me' && req.method === 'GET') {
      const available = await stmt(env, 'SELECT id FROM classrooms WHERE active=1 LIMIT 1').first();
      return json({
        id: s.id,
        label: s.label,
        classId: s.class_id,
        title: room?.title,
        lesson: JSON.parse(s.lesson),
        ...roomState(room),
        availableClassId: available?.id || null,
      });
    }
    if (p === '/api/student/ping' && req.method === 'POST') {
      await stmt(
        env,
        'UPDATE students SET last_seen=? WHERE id=? AND deleted_at=0',
        now(),
        s.id,
      ).run();
      return json({ ok: true });
    }
    if (p === '/api/student/label' && req.method === 'POST') {
      const data = await body(req),
        label = validLabel(data.label);
      if (!label) return json({ error: '出席番号を1〜999で入力してください。' }, 400);
      if (!room?.active) return closed(room);
      if (
        await stmt(
          env,
          'SELECT id FROM students WHERE class_id=? AND label=? AND id<>? AND deleted_at=0',
          s.class_id,
          label,
          s.id,
        ).first()
      )
        return json({ error: 'この番号は別の生徒が使用しています。先生に相談してください。' }, 409);
      try {
        await stmt(
          env,
          'UPDATE students SET label=? WHERE id=? AND deleted_at=0',
          label,
          s.id,
        ).run();
      } catch {
        return json({ error: 'この番号は使用中です。' }, 409);
      }
      return json({ label });
    }
    if (p === '/api/student/start' && req.method === 'POST') {
      if (!room?.active || room.paused || room.ended) return closed(room);
      const data = await body(req),
        lesson = JSON.parse(s.lesson);
      if (data.review === true && lesson.queue.length)
        return json({ error: '今回の練習が終わってから、復習できます。' }, 409);
      if (data.review === true && !lesson.needsReview?.length)
        return json({ error: '復習する項目はありません。' }, 400);
      let l = lesson;
      if (
        data.review === true ||
        data.reset === true ||
        (lesson.attempts === 0 &&
          data.mode === 'spelling' &&
          roomModes(room).includes('spelling') &&
          lesson.practiceMode !== 'spelling')
      ) {
        l =
          data.review === true
            ? lesson.format === 'adaptive-four'
              ? course.stepUpReview(lesson, roomWords(room), room.round_size)
              : course.review(lesson, roomWords(room), room.round_size)
            : newLesson(data.mode, room);
        if (data.review === true) {
          l.enabledModes = roomModes(room);
          l.vocabulary = roomWords(room);
          l.grade = room.grade || 6;
          l.unit = room.grade === 5 ? '5' : room.unit || '4-5';
        }
        const changed = await stmt(
          env,
          'UPDATE students SET lesson=?,revision=revision+1,last_seen=? WHERE id=? AND deleted_at=0 AND EXISTS (SELECT 1 FROM classrooms WHERE id=? AND active=1 AND paused=0 AND ended=0)',
          JSON.stringify(l),
          now(),
          s.id,
          s.class_id,
        ).run();
        if (Number(changed.meta?.changes) === 0)
          return json(
            { error: '先生がクラスを閉じました。再開までお待ちください。', code: 'CLASS_CLOSED' },
            423,
          );
      }
      if (l.lastRound) {
        l.lastRound = null;
        await stmt(
          env,
          'UPDATE students SET lesson=?,revision=revision+1 WHERE id=? AND deleted_at=0',
          JSON.stringify(l),
          s.id,
        ).run();
      }
      return json({ lesson: l });
    }
    if (p === '/api/student/answer' && req.method === 'POST')
      return grade(req, env, s, room, JSON.parse(s.lesson));
    return json({ error: '見つかりません。' }, 404);
  };
}
