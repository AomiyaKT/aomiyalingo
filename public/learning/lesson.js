export const lessonEngine = {
  create(words, mode = null, roundSize = 6) {
    const modes = Array.isArray(mode)
      ? mode
      : mode === 'spelling'
        ? ['spelling']
        : ['text', 'voice', 'spelling'];
    const ordered = [...words];
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
    const tasks = [];
    for (let i = 0; i < ordered.length; i += 2) {
      const group = ordered.slice(i, i + 2);
      for (const m of modes)
        for (const w of group) tasks.push({ id: crypto.randomUUID(), word: w.word, mode: m });
    }
    return {
      version: 2,
      reviewPolicy: 'spaced',
      streak: 0,
      roundHints: 0,
      roundWords: [],
      queue: tasks.map((t, i) => ({ ...t, stage: Math.floor(i / roundSize) + 1, review: false })),
      total: tasks.length,
      completed: 0,
      correct: 0,
      attempts: 0,
      missed: [],
      needsReview: [],
      wrongCounts: {},
      pendingReview: [],
      roundSize,
      rounds: Math.ceil(tasks.length / roundSize),
      roundAnswers: 0,
      roundCorrect: 0,
      finishedRounds: [],
      lastRound: null,
      practiceMode: modes.length === 1 && modes[0] === 'spelling' ? 'spelling' : null,
      learnWords: words.map((w) => w.word),
      enabledModes: modes,
    };
  },
  review(previous, words, roundSize = 6) {
    const keys = new Set(previous.needsReview || []),
      l = this.create(words, null, roundSize);
    l.queue = l.queue
      .filter((t) => keys.has(t.word + ':' + t.mode))
      .map((t, i) => ({ ...t, stage: Math.floor(i / roundSize) + 1 }));
    l.total = l.queue.length;
    l.rounds = Math.ceil(l.total / roundSize);
    l.practiceMode = 'review';
    return l;
  },
  advance(l, correct, hinted = false) {
    const task = l.queue.shift();
    if (l.format === 'adaptive-four')
      l.recentAnswers = [
        ...(l.recentAnswers || []),
        { correct, hinted, review: !!task.review },
      ].slice(-12);
    l.attempts++;
    l.lastCorrect = correct;
    // Already-running lessons retain their original question IDs and completion rules.
    if (l.version !== 2) {
      if (correct) l.completed++;
      else {
        if (!l.missed.includes(task.word)) l.missed.push(task.word);
        l.queue.splice(Math.min(3, l.queue.length), 0, { ...task, id: crypto.randomUUID() });
      }
      return;
    }
    l.roundAnswers++;
    if (correct) l.roundCorrect++;
    l.streak = correct && !hinted ? (l.streak || 0) + 1 : 0;
    if (hinted) l.roundHints = (l.roundHints || 0) + 1;
    l.roundWords = l.roundWords || [];
    if (!l.roundWords.includes(task.word)) l.roundWords.push(task.word);
    if (!task.review) {
      l.completed++;
      if (correct) l.correct++;
    }
    const key = task.word + ':' + task.mode;
    if (!correct) {
      if (!l.missed.includes(task.word)) l.missed.push(task.word);
      if (!l.needsReview.includes(key)) l.needsReview.push(key);
      l.wrongCounts[key] = (l.wrongCounts[key] || 0) + 1;
      if (!task.review) l.pendingReview.push({ ...task, dueStage: task.stage + 2 });
    } else if (hinted) {
      if (!l.needsReview.includes(key)) l.needsReview.push(key);
      if (l.reviewPolicy === 'spaced' && !task.review)
        l.pendingReview.push({ ...task, dueStage: task.stage + 2 });
    } else l.needsReview = l.needsReview.filter((k) => k !== key);
    if (!task.review && l.queue[0]?.stage !== task.stage && l.pendingReview.length) {
      const due = l.pendingReview
        .filter(
          (t) =>
            l.reviewPolicy !== 'spaced' || (t.dueStage || t.stage) <= task.stage || !l.queue.length,
        )
        .slice(0, 2);
      const review = due.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        stage: task.stage,
        review: true,
      }));
      l.pendingReview =
        l.reviewPolicy === 'spaced' ? l.pendingReview.filter((t) => !due.includes(t)) : [];
      l.queue.unshift(...review);
    }
    if (l.queue[0]?.stage !== task.stage) {
      l.lastRound = {
        stage: task.stage,
        answers: l.roundAnswers,
        correct: l.roundCorrect,
        hints: l.roundHints || 0,
        words: l.roundWords || [],
        xp: 10 + l.roundCorrect * 2,
      };
      l.finishedRounds.push(l.lastRound);
      l.roundAnswers = 0;
      l.roundCorrect = 0;
      l.roundHints = 0;
      l.roundWords = [];
    }
  },
};
