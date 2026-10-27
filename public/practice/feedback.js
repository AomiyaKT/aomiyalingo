export function createPracticeFeedback({
  $,
  getState,
  getLesson,
  getRole,
  getVocabulary,
  classroom,
  originalQuestion,
  textOptions,
  spellingAnswer,
  spellingCharacters,
  render,
  stopAudio,
  interactionEffects,
  exercises,
}) {
  function detail(prefix, answer, suffix = '') {
    const content = document.createElement('span');
    content.translate = false;
    content.textContent = answer;
    $('#feedback-detail').replaceChildren(prefix, content, suffix);
  }
  function submit() {
    const state = getState(),
      lesson = getLesson(),
      accessRole = getRole(),
      vocabulary = getVocabulary();
    if (
      classroom.paused ||
      classroom.busy ||
      $('#settings-dialog').open ||
      !accessRole ||
      $('#quiz-main').hidden ||
      state.editing ||
      state.submitted ||
      (state.exerciseTask?.exercise ? !exercises().ready() : !state.selected.length)
    )
      return;
    const expected = state.options.filter((o) => o.correct);
    const correct = state.exerciseTask?.exercise
      ? course.gradeExercise(state.exerciseTask, exercises().answer()).correct
      : state.mode === 'spelling'
        ? spellingAnswer(state.letters, state.selected, state.question) ===
          state.question.toLowerCase()
        : expected.length === state.selected.length &&
          expected.every((o) => state.selected.includes(o.id));
    if (
      state.mode === 'spelling' &&
      state.selected.length !== spellingCharacters(state.question).length
    )
      return;
    state.submitted = true;
    render();
    const box = $('#feedback');
    box.hidden = false;
    interactionEffects.enter(box, 'toast');
    box.classList.toggle('wrong', !correct);
    $('.feedback-icon').textContent = correct ? '✓' : '×';
    $('#feedback-title').textContent = correct
      ? state.hintUsed
        ? 'ヒントを使ってできました！'
        : '正解！よくできました！'
      : '答えを確認してみよう';
    if (
      state.question === 'Which picture shows an apple?' &&
      expected.length === 1 &&
      expected[0].text === 'Apple'
    )
      $('#feedback-detail').textContent =
        'Apple は「りんご」です。形を見ながら単語を覚えましょう。';
    else if (
      state.question === originalQuestion &&
      expected.length === 1 &&
      expected[0].text === textOptions[0]
    )
      $('#feedback-detail').textContent =
        'ate は eat の過去形で、日本語では「食べた」という意味です。';
    else detail('正解：', expected.map((o) => o.text).join('；'));
    if (state.mode === 'spelling' && !lesson)
      $('#feedback-detail').textContent = `正解：${state.question}`;
    if (lesson) {
      lesson.lastCorrect = correct;
      const word = vocabulary.find((v) => v.word === state.question);
      detail(
        '',
        `${word.word} → ${word.meaning}。${word.base ? `${word.base} の過去形。` : ''} ${word.example}`,
        !correct
          ? lesson.reviewPolicy === 'spaced'
            ? ' 少しあとで、もう一度思い出してみよう。'
            : 'あとで復習できます。'
          : state.hintUsed
            ? ' 次はヒントなしでも挑戦してみよう。'
            : '',
      );
    }
    if (lesson)
      classroom.record(
        lesson.queue[0].id,
        state.exerciseTask?.exercise
          ? exercises().answer()
          : state.mode === 'spelling'
            ? spellingAnswer(state.letters, state.selected, state.question)
            : state.options.filter((o) => state.selected.includes(o.id)).map((o) => o.text),
        !!state.hintUsed,
      );
    if (state.exerciseTask?.exercise)
      detail(
        '正解：',
        state.exerciseTask.expected,
        !correct
          ? ' 少しあとで、もう一度思い出してみよう。'
          : state.hintUsed
            ? ' 次はヒントなしでも挑戦してみよう。'
            : '',
      );
    if (state.mode === 'spelling' && !correct) {
      const typed = spellingAnswer(state.letters, state.selected, state.question);
      const comparison = document.createElement('span');
      comparison.className = 'spell-diff';
      const label = document.createElement('span');
      label.textContent = 'あなたの回答：';
      comparison.append(label);
      for (let i = 0; i < typed.length; i++) {
        const letter = document.createElement('span');
        letter.textContent = typed[i];
        letter.className =
          typed[i] === state.question[i].toLowerCase() ? 'letter-match' : 'letter-mismatch';
        comparison.append(letter);
      }
      const expectedLabel = document.createElement('span');
      expectedLabel.textContent = ' 正解：';
      comparison.append(expectedLabel);
      for (let i = 0; i < state.question.length; i++) {
        const letter = document.createElement('span');
        letter.textContent = state.question[i];
        letter.className =
          typed[i] === state.question[i].toLowerCase() ? 'letter-match' : 'letter-correction';
        comparison.append(letter);
      }
      comparison.setAttribute('aria-label', `あなたの回答 ${typed}、正解 ${state.question}`);
      $('#feedback-detail').append(document.createElement('br'), comparison);
    }
    stopAudio();
    interactionEffects.answer({
      correct,
      streak: correct && !state.hintUsed ? (lesson?.streak || 0) + 1 : 0,
      target: $('#feedback-title'),
      icon: $('.feedback-icon'),
      mascot: $('.lesson-mascot img'),
      selected: !correct
        ? state.exerciseTask?.exercise
          ? $('#practice-exercise')
          : state.mode === 'spelling'
            ? $('#spelling-slots')
            : $('#answers')
        : null,
    });
  }
  return { submit };
}
