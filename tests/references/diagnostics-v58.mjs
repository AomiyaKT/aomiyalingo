export const learningDiagnostics = {
  teachingSummary(students, words) {
    const skillIndexes = students.map((student) => {
      const index = new Map();
      for (const skill of student.skills || [])
        if (!index.has(skill.word)) index.set(skill.word, skill);
      return index;
    });
    const modeNames = new Set(['text', 'voice', 'spelling']);
    for (const student of students)
      for (const skill of student.skills || [])
        for (const mode of Object.keys(skill.modes)) modeNames.add(mode);
    return words
      .map((w) => {
        let firstWrong = 0,
          remaining = 0,
          hinted = 0;
        const modes = {};
        for (const mode of modeNames) {
          const observed = skillIndexes
            .map((index) => index.get(w.word)?.modes[mode])
            .filter(Boolean);
          modes[mode] = {
            answered: observed.filter((m) => m.state !== 'unanswered').length,
            wrong: observed.filter((m) => m.state === 'wrong').length,
          };
        }
        for (const index of skillIndexes) {
          const values = Object.values(index.get(w.word)?.modes || {});
          if (values.some((m) => m.firstCorrect === false)) firstWrong++;
          if (values.some((m) => m.state === 'wrong')) remaining++;
          if (values.some((m) => m.latestHinted && m.state !== 'wrong')) hinted++;
        }
        return { word: w.word, meaning: w.meaning, firstWrong, remaining, hinted, modes };
      })
      .sort(
        (a, b) => b.remaining - a.remaining || b.firstWrong - a.firstWrong || b.hinted - a.hinted,
      );
  },
  stats(student, attempts, words, modes = ['text', 'voice', 'spelling']) {
    const history = attempts
        .filter((a) => a.student_id === student.id)
        .sort((a, b) => a.created - b.created || (a.sequence || 0) - (b.sequence || 0)),
      groups = new Map();
    for (const a of history) {
      const key = a.word + ':' + a.mode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }
    const skills = words.map((w) => ({
      word: w.word,
      meaning: w.meaning,
      modes: Object.fromEntries(
        modes.map((mode) => {
          const rows = groups.get(w.word + ':' + mode) || [];
          const first = rows[0],
            latest = rows.at(-1);
          return [
            mode,
            {
              state: !first
                ? 'unanswered'
                : latest.correct
                  ? first.correct
                    ? 'correct'
                    : 'corrected'
                  : 'wrong',
              firstCorrect: first ? !!first.correct : null,
              hinted: rows.some((a) => a.hint_used),
              latestHinted: !!latest?.hint_used,
              independent: !!latest?.correct && !latest?.hint_used,
              attempts: rows.length,
            },
          ];
        }),
      ),
    }));
    const first = skills
      .flatMap((w) => Object.values(w.modes))
      .filter((m) => m.firstCorrect !== null);
    return {
      firstAccuracy: first.length
        ? Math.round((first.filter((m) => m.firstCorrect).length / first.length) * 100)
        : null,
      firstCount: first.length,
      supported: first.filter((m) => m.latestHinted && m.state !== 'wrong').length,
      independent: first.filter((m) => m.independent).length,
      corrected: skills
        .flatMap((w) => Object.values(w.modes))
        .filter((m) => m.state === 'corrected').length,
      needsHelp: skills.flatMap((w) => Object.values(w.modes)).filter((m) => m.state === 'wrong')
        .length,
      skills,
    };
  },
};
