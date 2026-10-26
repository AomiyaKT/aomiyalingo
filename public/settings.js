import { mountSettingsPanels } from './shared/settings-panels.js';
import { installLanguageUI } from './shared/i18n.js';
const appSettings = (() => {
  const defaults = {
    voiceVolume: 100,
    musicVolume: 20,
    effectsVolume: 70,
    effectsEnabled: true,
    fontScale: 1,
    reduceMotion: false,
    clearDisplay: false,
  };
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('aomiyalingo.settings.v1')) || {};
  } catch {}
  const values = { ...defaults };
  for (const key of ['voiceVolume', 'effectsVolume', 'musicVolume'])
    if (Number.isFinite(saved[key])) values[key] = Math.max(0, Math.min(100, saved[key]));
  if ([1, 1.15, 1.3].includes(saved.fontScale)) values.fontScale = saved.fontScale;
  for (const key of ['effectsEnabled', 'reduceMotion', 'clearDisplay'])
    if (typeof saved[key] === 'boolean') values[key] = saved[key];
  try {
    if (saved.effectsEnabled === undefined && localStorage.getItem('aomiyalingo.effects') === 'off')
      values.effectsEnabled = false;
  } catch {}
  const dialog = document.querySelector('#settings-dialog');
  const teacherMusic =
    document.body.classList.contains('teacher-page') ||
    document.body.classList.contains('race-teacher');
  if (teacherMusic) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML =
      '<label for="music-volume">音楽の音量</label><output id="music-volume-value" for="music-volume"></output><input id="music-volume" type="range" min="0" max="100" step="5"><button id="music-play-toggle" class="home-button" type="button">音楽を再生</button><small id="music-status" role="status">先生のページだけで再生します。</small>';
    document.querySelector('#effects-volume').closest('.setting-row').after(row);
  }
  const panels = mountSettingsPanels({ dialog, teacher: teacherMusic });
  const volumeFields = [
    ['voice-volume', 'voiceVolume'],
    ['effects-volume', 'effectsVolume'],
    ...(teacherMusic ? [['music-volume', 'musicVolume']] : []),
  ];
  function apply() {
    document.documentElement.style.setProperty('--font-scale', values.fontScale);
    document.documentElement.classList.toggle('reduce-motion', values.reduceMotion);
    document.documentElement.classList.toggle('clear-display', values.clearDisplay);
    for (const [id, key] of volumeFields) {
      document.getElementById(id).value = values[key];
      document.getElementById(id + '-value').textContent = values[key] + '%';
    }
    document.querySelector('#sound-toggle').checked = values.effectsEnabled;
    document.querySelector('#reduce-motion').checked = values.reduceMotion;
    document.querySelector('#clear-display').checked = values.clearDisplay;
    document.querySelector('#font-size').value = values.fontScale;
    try {
      localStorage.setItem('aomiyalingo.settings.v1', JSON.stringify(values));
      panels.localSaved(true);
    } catch {
      panels.localSaved(false);
    }
    window.dispatchEvent(new Event('aomiyalingo-settings'));
  }
  for (const [id, key] of volumeFields)
    document.getElementById(id).addEventListener('input', (event) => {
      values[key] = Number(event.target.value);
      apply();
    });
  for (const [id, key] of [
    ['sound-toggle', 'effectsEnabled'],
    ['reduce-motion', 'reduceMotion'],
    ['clear-display', 'clearDisplay'],
  ])
    document.getElementById(id).addEventListener('change', (event) => {
      values[key] = event.target.checked;
      apply();
    });
  document.querySelector('#font-size').addEventListener('change', (event) => {
    values.fontScale = Number(event.target.value);
    apply();
  });
  document.querySelector('#settings-open').onclick = () => {
    dialog.showModal();
    interactionEffects.enter(dialog);
  };
  function close() {
    dialog.close();
    document.querySelector('#settings-open').focus();
  }
  document.querySelector('#settings-close').onclick = close;
  document.querySelector('#settings-done').onclick = close;
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        close();
    }
  });
  document.querySelector('#settings-reset').onclick = () => {
    Object.assign(values, defaults);
    apply();
    interactionEffects.sound('save');
  };
  apply();
  return { values };
})();
window.appSettings = appSettings;
installLanguageUI();
