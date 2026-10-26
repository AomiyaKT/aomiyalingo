export function createPracticeQuestionView({
  $,
  getState,
  getLesson,
  getRole,
  getVocabulary,
  nextOptionId,
  createSpellingLetters,
  renderSpelling,
  renderAnswers,
  updateSelection,
  updateProgress,
  renderRich = () => false,
}) {
  function render() {
    const state = getState(),
      lesson = getLesson(),
      accessRole = getRole(),
      vocabulary = getVocabulary();
    $('#header-actions').hidden = !accessRole;
    $('#save-quiz').hidden = accessRole !== 'teacher';
    $('#back-to-editor').hidden = accessRole !== 'teacher' || state.editing;
    document.body.classList.toggle('student', !state.editing);
    $('.quiz-shell').classList.toggle('answered', state.submitted);
    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
      b.disabled = !!lesson;
      b.hidden =
        !!lesson &&
        (lesson.format === 'adaptive-four' ||
          b.dataset.mode === 'picture' ||
          !(lesson.enabledModes || ['text', 'voice', 'spelling']).includes(b.dataset.mode));
    });
    if (renderRich()) {
      updateSelection();
      updateProgress();
      return;
    }
    const listening = state.mode === 'voice',
      spelling = state.mode === 'spelling';
    if (spelling && state.spellingWord !== state.question) {
      state.spellingWord = state.question;
      state.letters = createSpellingLetters(state.question.toLowerCase());
      state.selected = [];
      state.options = [{ id: nextOptionId(), text: state.question, correct: true, image: null }];
    }
    $('#spelling-panel').hidden = !spelling;
    $('.answers-row').hidden = spelling;
    $('.quiz-footer').hidden = spelling;
    const concealWord = listening && !state.editing && !state.submitted;
    $('#type-label').textContent = spelling
      ? 'スペリング問題'
      : state.mode === 'picture'
        ? '画像クイズ'
        : listening
          ? 'リスニング問題'
          : '単語問題';
    $('#lesson-heading').textContent = spelling
      ? '英単語をつづろう'
      : state.mode === 'picture'
        ? '正しい画像を選ぼう'
        : listening
          ? '音声を聞いて、正しい英単語を選ぼう'
          : '正しい日本語の意味を選ぼう';
    $('#lesson-instruction').textContent = spelling
      ? state.editing
        ? '正解の英単語を編集してください。文字は自動で並び替えられます。'
        : '文字を順番に選ぼう。選んだ文字を押すと戻せます。' +
          (state.question.includes(' ') ? ' 空白は自動で入ります。' : '')
      : listening
        ? state.editing
          ? '読み上げる単語と英語の選択肢を編集してください。学習中は単語が隠れます。'
          : '再生ボタンを押して、聞こえた英単語を選びましょう。'
        : state.mode === 'text'
          ? '単語の意味を選びましょう。再生ボタンで発音も聞けます。'
          : state.voice
            ? '音声を聞いて、意味を選びましょう。'
            : '単語を読んで、意味を選びましょう。';
    $('#exercise-tag').textContent = state.editing
      ? '問題の編集'
      : state.mode === 'picture'
        ? '画像レッスン'
        : listening
          ? 'リスニング'
          : '単語レッスン';
    $('#voice-panel').hidden = !state.voice;
    $('#question-row').classList.toggle('no-voice', !state.voice);
    $('#audio-timeline').hidden = !state.voice;
    $('#voice-toggle').setAttribute('aria-pressed', String(state.voice));
    $('#voice-toggle').hidden = state.mode !== 'picture';
    $('#question-text').textContent =
      spelling && !state.editing && !state.submitted
        ? vocabulary.find((v) => v.word === state.question)?.meaning || '音声を聞いてつづろう'
        : concealWord
          ? ''
          : state.question;
    $('#question-text').hidden = concealWord;
    $('#question-text').translate = false;
    $('#question-text').contentEditable = String(state.editing);
    $('#listening-prompt').hidden = !concealWord;
    $('#question-image').hidden = state.mode === 'voice';
    $('#question-text').classList.toggle(
      'vocabulary-prompt',
      !spelling && vocabulary.some((v) => v.word === state.question),
    );
    $('#question-text').setAttribute('role', state.editing ? 'textbox' : 'heading');
    const qi = $('#question-picture');
    qi.hidden = !state.questionImage || concealWord;
    qi.src = state.questionImage || '';
    $('#clear-question-image').hidden = !state.questionImage || !state.editing;
    $('#multiple').checked = state.multiple;
    $('#answers').classList.toggle('vertical', state.vertical);
    $('#layout-label').textContent = state.vertical ? '横並びにする' : '縦並びにする';
    $('#student-hint').textContent = state.multiple
      ? '正しい答えをすべて選んでください'
      : '答えを1つ選んでください';
    $('#add-answer').hidden = state.options.length >= 6;
    $('#answers').style.gridTemplateColumns = state.vertical
      ? ''
      : state.options.length > 4
        ? 'repeat(3,minmax(0,1fr))'
        : '';
    $('#try-again').textContent = lesson ? '次へ' : 'もう一度';
    if (spelling) renderSpelling();
    else renderAnswers();
    $('.keyboard-note').textContent = spelling
      ? '文字キーで選択 · Backspaceで戻す · Enterで確認'
      : '数字キーで選択 · Enterで確認';
    updateSelection();
    updateProgress();
  }
  return { render };
}
