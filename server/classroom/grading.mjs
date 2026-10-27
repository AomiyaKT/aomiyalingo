// The attempt insert and lesson update must remain in the same database batch.
export function createClassroomGrading({ body, json, stmt, closed, roomWords, course, db, now }) {
  return async function grade(req, env, s, room, lesson) {
    {
      const data = await body(req);
      if (typeof data.questionId !== 'string')
        return json({ error: '回答を確認できません。' }, 400);
      const attemptId = s.id + ':' + data.questionId;
      if (await stmt(env, 'SELECT id FROM attempts WHERE id=?', attemptId).first())
        return json({ lesson, duplicate: true });
      if (!room?.active || room.paused || room.ended) return closed(room);
      const task = lesson.queue[0];
      if (!task || task.id !== data.questionId)
        return json({ error: '問題が更新されました。ページを再読み込みしてください。' }, 409);
      const w = roomWords(room).find((w) => w.word === task.word);
      if (!w) throw Error('INVALID_WORD');
      const exercise = course.currentExercise(lesson, roomWords(room));
      const rich = !!exercise?.exercise;
      const graded = rich ? course.gradeExercise(exercise, data.answer) : null;
      const answer = rich
        ? data.answer
        : Array.isArray(data.answer)
          ? data.answer.map((x) => String(x).slice(0, 100))
          : String(data.answer || '').slice(0, 100);
      if (
        !rich &&
        task.mode === 'spelling' &&
        (typeof answer !== 'string' || answer.length !== w.word.length)
      )
        return json({ error: 'すべての文字を選んでください。' }, 400);
      if (
        rich
          ? !graded.valid
          : task.mode !== 'spelling' && (!Array.isArray(answer) || answer.length !== 1)
      )
        return json({ error: '答えを1つ選んでください。' }, 400);
      const expected = task.mode === 'text' ? w.meaning : w.word;
      const correct = rich
        ? graded.correct
        : task.mode === 'spelling'
          ? answer.toLowerCase() === expected.toLowerCase()
          : answer[0] === expected;
      course.advance(lesson, correct, data.hintUsed === true);
      await db(env).batch([
        stmt(
          env,
          'INSERT OR IGNORE INTO attempts (id,student_id,class_id,word,mode,answer,correct,created,hint_used,is_review) SELECT ?,?,?,?,?,?,?,?,?,? FROM students WHERE id=? AND revision=? AND deleted_at=0 AND EXISTS (SELECT 1 FROM classrooms WHERE id=? AND active=1 AND paused=0 AND ended=0)',
          attemptId,
          s.id,
          s.class_id,
          w.word,
          task.mode,
          JSON.stringify(
            rich
              ? { value: graded.answer, expected: exercise.expected, level: exercise.level }
              : answer,
          ),
          correct ? 1 : 0,
          now(),
          data.hintUsed === true ? 1 : 0,
          task.review || lesson.practiceMode === 'review' ? 1 : 0,
          s.id,
          s.revision,
          s.class_id,
        ),
        stmt(
          env,
          'UPDATE students SET lesson=?,revision=revision+1,last_seen=? WHERE id=? AND revision=? AND deleted_at=0 AND EXISTS (SELECT 1 FROM classrooms WHERE id=? AND active=1 AND paused=0 AND ended=0)',
          JSON.stringify(lesson),
          now(),
          s.id,
          s.revision,
          s.class_id,
        ),
      ]);
      if (!(await stmt(env, 'SELECT id FROM attempts WHERE id=?', attemptId).first()))
        return json(
          {
            error: 'クラスが閉じられたか、問題が更新されました。再開後にもう一度お試しください。',
            code: 'CLASS_CLOSED',
          },
          423,
        );
      const saved = await stmt(env, 'SELECT lesson FROM students WHERE id=?', s.id).first();
      return json({ lesson: JSON.parse(saved.lesson), correct });
    }
  };
}
