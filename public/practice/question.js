export function createPracticeQuestion({
  task,
  vocabulary,
  initial,
  shuffleWords,
  nextOptionId,
  getDraft,
}) {
  const word = vocabulary.find((v) => v.word === task.word);
  const state = initial(task.mode);
  state.question = word.word;
  state.hintUsed = false;
  const distractors = shuffleWords(vocabulary.filter((v) => v.word !== word.word)).slice(0, 3);
  const meanings = [...new Set([...(word.distractors || []), ...distractors.map((w) => w.meaning)])]
    .filter((x) => x !== word.meaning)
    .slice(0, 3);
  state.options =
    task.mode === 'text'
      ? shuffleWords([word.meaning, ...meanings]).map((text) => ({
          id: nextOptionId(),
          text,
          image: null,
          correct: text === word.meaning,
        }))
      : shuffleWords([word, ...distractors]).map((v) => ({
          id: nextOptionId(),
          text: v.word,
          image: null,
          correct: v.word === word.word,
        }));
  const draft = getDraft(task.id);
  if (draft) {
    if (task.mode !== 'spelling' && Array.isArray(draft.choices)) {
      const correctText = task.mode === 'voice' ? word.word : word.meaning;
      state.options = draft.choices.map((text) => ({
        id: nextOptionId(),
        text,
        image: null,
        correct: text === correctText,
      }));
    }
    state.hintUsed = !!draft.hintUsed;
    state.hintShown = !!draft.hintShown;
    if (task.mode === 'spelling') {
      state.spellingWord = word.word;
      state.letters = draft.letters;
      state.selected = draft.selected;
    } else
      state.selected = state.options
        .filter((o) => draft.answers?.includes(o.text))
        .map((o) => o.id);
  }

  return state;
}
