export function createPracticeChoices({
  $,
  getState,
  getRole,
  svg,
  notify,
  clearAttempt,
  render,
  pickImage,
  updateSelection,
  interactionEffects,
}) {
  function renderAnswers() {
    const state = getState(),
      accessRole = getRole();
    const focused = document.activeElement?.closest('.answer')?.dataset?.id;
    const list = $('#answers');
    list.replaceChildren();
    state.options.forEach((option, index) => {
      const card = document.createElement('div');
      card.className = 'answer';
      card.dataset.id = option.id;
      card.classList.toggle('selected', state.selected.includes(option.id));
      if (!state.editing) {
        card.setAttribute('role', state.multiple ? 'checkbox' : 'radio');
        card.setAttribute('aria-checked', String(state.selected.includes(option.id)));
        card.setAttribute('aria-label', `${index + 1}. ${option.text}`);
        card.tabIndex = state.submitted ? -1 : 0;
        card.onclick = () => selectAnswer(option.id);
        card.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            selectAnswer(option.id);
          }
        };
      }
      const tools = document.createElement('div');
      tools.className = 'answer-tools editor-only';
      const remove = document.createElement('button');
      remove.className = 'icon-button';
      remove.innerHTML = svg('trash');
      remove.title = '選択肢を削除';
      remove.setAttribute('aria-label', `選択肢を削除 ${index + 1}`);
      remove.onclick = () => {
        if (state.options.length <= 2) {
          notify('選択肢は2つ以上必要です');
          return;
        }
        state.options = state.options.filter((o) => o.id !== option.id);
        clearAttempt();
        render();
      };
      const image = document.createElement('button');
      image.className = 'icon-button';
      image.innerHTML = svg('image');
      image.title = '選択肢の画像を変更';
      image.setAttribute('aria-label', `選択肢 ${index + 1} に画像を追加`);
      image.onclick = () => pickImage(option.id);
      tools.append(remove, image);
      card.append(tools);
      const correct = document.createElement('button');
      correct.className = 'correct-button editor-only' + (option.correct ? ' active' : '');
      correct.innerHTML = svg('check');
      correct.title = option.correct ? '正解に設定済み' : '正解に設定';
      correct.setAttribute('aria-label', `選択肢 ${index + 1} を正解に設定`);
      correct.setAttribute('aria-pressed', String(option.correct));
      correct.onclick = () => {
        if (state.multiple) option.correct = !option.correct;
        else {
          state.options.forEach((o) => (o.correct = o.id === option.id));
        }
        renderAnswers();
      };
      card.append(correct);
      const key = document.createElement('span');
      key.className = 'choice-key';
      key.textContent = String(index + 1);
      card.append(key);
      if (option.image) {
        const img = document.createElement('img');
        img.className = 'answer-image';
        img.src = option.image;
        img.alt = option.text;
        card.append(img);
      }
      const text = document.createElement('div');
      text.className = 'answer-text';
      text.textContent = option.text;
      text.lang = state.mode === 'text' ? 'ja' : 'en';
      text.contentEditable = String(state.editing);
      if (state.editing) {
        text.setAttribute('role', 'textbox');
        text.setAttribute('aria-label', `選択肢 ${index + 1} のテキスト`);
      }
      text.spellcheck = false;
      text.oninput = () => {
        option.text = text.innerText.trim();
      };
      text.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          text.blur();
        }
      };
      card.append(text);
      if (state.submitted) {
        if (option.correct) card.classList.add('result-correct');
        else if (state.selected.includes(option.id)) card.classList.add('result-wrong');
        const result = document.createElement('span');
        result.className = 'answer-result';
        result.textContent = option.correct ? '✓' : '×';
        card.append(result);
      }
      list.append(card);
    });
    if (focused) list.querySelector('[data-id="' + focused + '"]')?.focus({ preventScroll: true });
  }
  function selectAnswer(id) {
    const state = getState(),
      accessRole = getRole();
    if (state.mode === 'spelling') return;
    if (
      $('#settings-dialog').open ||
      !accessRole ||
      $('#quiz-main').hidden ||
      state.editing ||
      state.submitted
    )
      return;
    if (state.multiple) {
      state.selected = state.selected.includes(id)
        ? state.selected.filter((x) => x !== id)
        : [...state.selected, id];
    } else state.selected = [id];
    renderAnswers();
    updateSelection();
    interactionEffects.sound('select');
    interactionEffects.pulse(document.querySelector(`.answer[data-id="${id}"]`));
  }
  return { renderAnswers, selectAnswer };
}
