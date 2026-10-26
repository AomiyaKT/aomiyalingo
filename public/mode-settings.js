'use strict';
(() => {
  const mode = document.body.classList.contains('race-teacher') ? 'race' : 'practice';
  const dialog = document.createElement('dialog');
  dialog.className = 'mode-settings-dialog';
  dialog.setAttribute('aria-labelledby', 'mode-settings-title');
  const heading = document.createElement('div');
  heading.className = 'mode-settings-heading';
  const title = document.createElement('h2');
  title.id = 'mode-settings-title';
  title.textContent = mode === 'race' ? '単語レースの設定' : '単語練習の設定';
  const close = document.createElement('button');
  close.className = 'home-button';
  close.textContent = '閉じる';
  const frame = document.createElement('iframe');
  frame.title = title.textContent;
  heading.append(title, close);
  dialog.append(heading, frame);
  const warning = document.createElement('div');
  warning.className = 'mode-unsaved-warning';
  warning.hidden = true;
  warning.setAttribute('role', 'alert');
  const text = document.createElement('p');
  text.textContent = '未保存の変更があります。保存せずに閉じますか？';
  const keep = document.createElement('button');
  keep.textContent = '編集を続ける';
  keep.className = 'home-button';
  const discard = document.createElement('button');
  discard.textContent = '変更を破棄して閉じる';
  discard.className = 'home-button';
  warning.append(text, keep, discard);
  dialog.append(warning);
  keep.onclick = () => {
    warning.hidden = true;
    close.focus();
  };
  discard.onclick = () => {
    dirty = false;
    finish();
  };
  document.body.append(dialog);
  let dirty = false,
    saving = false,
    saved = false;
  function finish() {
    if (saving) return;
    if (dirty) {
      warning.hidden = false;
      keep.focus();
      return;
    }
    dialog.close();
    warning.hidden = true;
    frame.contentWindow.postMessage({ type: 'aomi-editor-close' }, location.origin);
    if (saved) window.dispatchEvent(new Event('aomi-mode-settings-saved'));
  }
  close.onclick = finish;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish();
  });
  window.addEventListener('message', (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== frame.contentWindow ||
      !dialog.open ||
      event.data?.type !== 'aomi-editor-state'
    )
      return;
    dirty = !!event.data.dirty;
    saving = !!event.data.saving;
    saved ||= !!event.data.saved;
    close.disabled = saving;
  });
  for (const button of document.querySelectorAll('[data-mode-settings]')) {
    button.onclick = () => {
      dirty = saving = saved = false;
      close.disabled = false;
      warning.hidden = true;
      const grade = document.querySelector(mode === 'race' ? '#race-grade' : '#class-grade').value;
      frame.src =
        '/teacher-editor?embedded=1&mode=' +
        mode +
        '&grade=' +
        encodeURIComponent(grade) +
        (mode === 'race' ? '#race' : '#words');
      dialog.showModal();
    };
  }
})();
