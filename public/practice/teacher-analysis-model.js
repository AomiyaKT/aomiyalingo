// Aggregate each learner's word/mode states once instead of searching all skills per cell.
export function masterySummary(students, words, modes, adaptive = false) {
  const indexes = students.map((student) => {
    const index = new Map();
    for (const skill of student.skills || [])
      if (!index.has(skill.word)) index.set(skill.word, skill);
    return index;
  });
  return words.flatMap((word) => {
    const skills = indexes.map((index) => index.get(word.word));
    if (
      adaptive &&
      !skills.some((skill) =>
        Object.values(skill?.modes || {}).some((mode) => mode.state !== 'unanswered'),
      )
    )
      return [];
    const counts = {};
    for (const mode of modes) {
      const total = { correct: 0, wrong: 0, corrected: 0, unanswered: 0 };
      for (const skill of skills) {
        const state = skill?.modes[mode]?.state || 'unanswered';
        if (Object.hasOwn(total, state)) total[state]++;
      }
      if (!adaptive || total.unanswered !== students.length) counts[mode] = total;
    }
    return [{ word: word.word, modes: counts }];
  });
}
