export function createPracticeSpelling({
  $,
  getState,
  getRole,
  updateSelection,
  saveCurrentDraft,
  classroom,
  interactionEffects,
  spellingAnswer,
  spellingCharacters,
  appendSpellingSlots,
}) {
  function renderSpelling() {
    const state = getState();
    const focusKey = document.activeElement?.dataset?.letterKey;
    const slots = $('#spelling-slots'),
      bank = $('#letter-bank');
    $('#spelling-panel').classList.toggle(
      'long-word',
      spellingCharacters(state.question).length >= 10,
    );
    slots.replaceChildren();
    bank.replaceChildren();
    const answer = spellingAnswer(state.letters, state.selected, state.question),
      locked = state.editing || state.submitted;
    slots.classList.toggle('correct', state.submitted && answer === state.question.toLowerCase());
    slots.classList.toggle('wrong', state.submitted && answer !== state.question.toLowerCase());
    appendSpellingSlots(slots, state.question, (position) => {
      const index = state.selected[position],
        tile = document.createElement('button');
      tile.className = 'letter-slot';
      tile.dataset.letterKey = 'slot:' + position;
      tile.textContent = index === undefined ? '' : state.letters[index];
      tile.classList.toggle('next-slot', position === state.selected.length && !locked);
      tile.lang = 'en';
      tile.disabled = index === undefined || locked;
      tile.setAttribute(
        'aria-label',
        index === undefined
          ? `${position + 1}文字目、空欄`
          : `${position + 1}文字目 ${state.letters[index]} を戻す`,
      );
      tile.onclick = () => removeLetter(position);
      return tile;
    });
    state.letters.forEach((letter, index) => {
      const button = document.createElement('button');
      button.className = 'letter-tile';
      button.dataset.letterKey = 'bank:' + index;
      button.lang = 'en';
      button.textContent = letter;
      button.disabled =
        locked ||
        state.selected.includes(index) ||
        state.selected.length >= spellingCharacters(state.question).length;
      button.classList.toggle('used', state.selected.includes(index));
      button.setAttribute('aria-label', `文字 ${letter} ${index + 1}`);
      button.onclick = () => chooseLetter(index);
      bank.append(button);
    });
    $('#spelling-count').textContent =
      `${state.selected.length} / ${spellingCharacters(state.question).length}文字`;
    $('#spelling-undo').disabled = locked || !state.selected.length;
    $('#spelling-clear').disabled = locked || !state.selected.length;
    $('#spelling-hint').disabled = locked || !!state.hintShown;
    $('#spelling-hint-note').hidden = !state.hintShown;
    $('#spelling-hint-note').textContent = state.hintShown
      ? '最初の文字は ' + state.question[0].toLowerCase() + '。ヒントを使っています。'
      : '';
    if (focusKey) {
      const target = document.querySelector('[data-letter-key="' + focusKey + '"]');
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else bank.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }
  }
  function chooseLetter(index) {
    const state = getState(),
      accessRole = getRole();
    if (
      $('#settings-dialog').open ||
      !accessRole ||
      state.mode !== 'spelling' ||
      state.editing ||
      state.submitted ||
      state.selected.includes(index) ||
      state.selected.length >= spellingCharacters(state.question).length
    )
      return;
    state.selected.push(index);
    interactionEffects.sound('letter');
    renderSpelling();
    updateSelection();
    interactionEffects.pulse(
      $('#spelling-slots').querySelector('[data-position="' + (state.selected.length - 1) + '"]'),
      'letter',
    );
  }
  function removeLetter(position) {
    const state = getState();
    if (state.editing || state.submitted || $('#settings-dialog').open) return;
    state.selected.splice(position, 1);
    interactionEffects.sound('remove');
    renderSpelling();
    updateSelection();
  }
  function undoLetter() {
    const state = getState();
    if (state.selected.length) removeLetter(state.selected.length - 1);
  }
  $('#spelling-hint').onclick = () => {
    const state = getState();
    if (classroom.paused || state.submitted || state.editing) return;
    state.hintUsed = true;
    state.hintShown = true;
    renderSpelling();
    saveCurrentDraft();
    interactionEffects.sound('select');
  };
  $('#spelling-undo').onclick = undoLetter;
  $('#spelling-clear').onclick = () => {
    const state = getState();
    if (state.editing || state.submitted) return;
    state.selected = [];
    interactionEffects.sound('remove');
    renderSpelling();
    updateSelection();
  };

  return { renderSpelling, chooseLetter, removeLetter, undoLetter };
}
