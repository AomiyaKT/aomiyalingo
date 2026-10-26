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
        const modes = Object.fromEntries(
          [...modeNames].map((mode) => [mode, { answered: 0, wrong: 0 }]),
        );
        for (const index of skillIndexes) {
          let wrongFirst = false,
            wrongNow = false,
            usedHint = false;
          for (const [mode, value] of Object.entries(index.get(w.word)?.modes || {})) {
            if (value.state !== 'unanswered') modes[mode].answered++;
            if (value.state === 'wrong') {
              modes[mode].wrong++;
              wrongNow = true;
            }
            if (value.firstCorrect === false) wrongFirst = true;
            if (value.latestHinted && value.state !== 'wrong') usedHint = true;
          }
          firstWrong += Number(wrongFirst);
          remaining += Number(wrongNow);
          hinted += Number(usedHint);
        }
        return { word: w.word, meaning: w.meaning, firstWrong, remaining, hinted, modes };
      })
      .sort(
        (a, b) => b.remaining - a.remaining || b.firstWrong - a.firstWrong || b.hinted - a.hinted,
      );
  },
  stats(student, attempts, words, modes = ['text', 'voice', 'spelling']) {
    // Find the same first/latest rows as a stable chronological sort, without
    // sorting or retaining a separate array of every attempt for every word/type.
    const groups = new Map();
    const compare = (a, b) => a.created - b.created || (a.sequence || 0) - (b.sequence || 0);
    for (const a of attempts) {
      if (a.student_id !== student.id) continue;
      const key = a.word + ':' + a.mode;
      const group = groups.get(key);
      if (!group) groups.set(key, { first: a, latest: a, hinted: !!a.hint_used, count: 1 });
      else {
        if (compare(a, group.first) < 0) group.first = a;
        if (compare(a, group.latest) >= 0) group.latest = a;
        group.hinted ||= !!a.hint_used;
        group.count++;
      }
    }
    const skills = words.map((w) => ({
      word: w.word,
      meaning: w.meaning,
      modes: Object.fromEntries(
        modes.map((mode) => {
          const group = groups.get(w.word + ':' + mode);
          const first = group?.first,
            latest = group?.latest;
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
              hinted: group?.hinted || false,
              latestHinted: !!latest?.hint_used,
              independent: !!latest?.correct && !latest?.hint_used,
              attempts: group?.count || 0,
            },
          ];
        }),
      ),
    }));
    let firstCount = 0,
      firstCorrect = 0,
      supported = 0,
      independent = 0,
      corrected = 0,
      needsHelp = 0;
    for (const skill of skills)
      for (const mode of Object.values(skill.modes)) {
        if (mode.firstCorrect !== null) {
          firstCount++;
          if (mode.firstCorrect) firstCorrect++;
          if (mode.latestHinted && mode.state !== 'wrong') supported++;
          if (mode.independent) independent++;
        }
        if (mode.state === 'corrected') corrected++;
        if (mode.state === 'wrong') needsHelp++;
      }
    return {
      firstAccuracy: firstCount ? Math.round((firstCorrect / firstCount) * 100) : null,
      firstCount,
      supported,
      independent,
      corrected,
      needsHelp,
      skills,
    };
  },
};
