import { makeElement as make } from './shared/dom.js';
import { readAudioFile } from './editor/audio.js';
import { createEditorViews } from './editor/views.js';
(() => {
  const q = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embedded') === '1' && window.parent !== window;
  const mode = params.get('mode') === 'race' ? 'race' : 'practice';
  const allowedSections = mode === 'race' ? ['words', 'race'] : ['words', 'course'];
  if (embedded) {
    document.body.classList.add('embedded-editor');
    q('.editor-heading h1').textContent =
      mode === 'race' ? '単語とゲームのルール' : '単語と練習の設定';
    q('#editor-grade').value = Object.hasOwn(curriculumCatalog, params.get('grade'))
      ? params.get('grade')
      : '6';
    for (const link of document.querySelectorAll('.editor-tabs a'))
      link.hidden = !allowedSections.includes(link.hash.slice(1));
  }
  function reportState(saved = false) {
    window.aomiRuntimeStatus?.editor({ dirty, saving });
    if (embedded)
      window.parent.postMessage(
        { type: 'aomi-editor-state', dirty, saving, saved },
        location.origin,
      );
  }

  let config = null,
    rootConfig = null,
    revision = 0,
    selected = 0,
    dirty = false,
    saving = false;
  const player = new Audio();
  if (embedded)
    window.addEventListener('message', (event) => {
      if (
        event.origin === location.origin &&
        event.source === window.parent &&
        event.data?.type === 'aomi-editor-close'
      ) {
        dirty = false;
        player.pause();
        window.speechSynthesis?.cancel();
      }
    });
  function showSection(focus = false) {
    const id = (embedded ? allowedSections : ['words', 'course', 'race']).includes(
      location.hash.slice(1),
    )
      ? location.hash.slice(1)
      : 'words';
    for (const section of document.querySelectorAll('.editor-section'))
      section.hidden = section.id !== id;
    for (const link of document.querySelectorAll('.editor-tabs a')) {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (focus) {
      const title = q('#' + id + ' h2');
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
  document.querySelectorAll('.editor-tabs a').forEach(
    (link) =>
      (link.onclick = (event) => {
        event.preventDefault();
        if (saving) return;
        history.replaceState(null, '', link.hash);
        showSection(true);
      }),
  );
  window.addEventListener('hashchange', () => showSection());
  showSection();
  q('#word-search').oninput = () => list();
  async function api(path, data) {
    return aomiNetwork.request('/api/teacher/' + path, data);
  }
  function note(text, bad = false) {
    q('#editor-status').textContent = text;
    q('#editor-status').className = bad ? 'editor-error' : 'editor-status';
  }
  function lock(value) {
    for (const panel of document.querySelectorAll('.editor-section')) panel.inert = value;
    q('#editor-reload').disabled = value;
    q('#editor-grade').disabled = value;
  }
  function changed() {
    dirty = true;
    reportState();
    note('未保存の変更があります。');
    q('#editor-save').disabled = false;
  }
  const { list, pools, word, draw } = createEditorViews({
    q,
    make,
    getConfig: () => config,
    getSelected: () => selected,
    select: (i) => {
      selected = i;
    },
    changed,
  });
  async function load() {
    const r = await api('config');
    rootConfig = r.config;
    config = curriculumProfile(rootConfig, q('#editor-grade').value);
    revision = r.revision;
    selected = 0;
    q('#word-search').value = '';
    dirty = false;
    q('#editor-login').hidden = true;
    q('#editor-content').hidden = false;
    q('#teacher-account-settings').hidden = false;
    q('#teacher-logout').hidden = false;
    draw();
    note('保存済みの設定を表示しています。');
    q('#editor-save').disabled = true;
    reportState();
  }
  q('#editor-login-form').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter;
    b.disabled = true;
    try {
      await api('login', { password: q('#editor-password').value });
      q('#editor-password').value = '';
      await load();
    } catch (e) {
      q('#editor-login-error').textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
  q('#editor-grade').onchange = () => {
    config = curriculumProfile(rootConfig, q('#editor-grade').value);
    selected = 0;
    draw();
    note(
      dirty
        ? '未保存の変更があります。すべての教材の変更をまとめて保存します。'
        : '選択した学年の設定を表示しています。',
    );
  };
  q('#editor-save').onclick = async () => {
    if (saving) return;
    saving = true;
    reportState();
    lock(true);
    q('#editor-save').disabled = true;
    try {
      const r = await api('config', { config: rootConfig, revision });
      rootConfig = r.config;
      config = curriculumProfile(rootConfig, q('#editor-grade').value);
      revision = r.revision;
      dirty = false;
      reportState(true);
      draw();
      note('保存しました。次に開始するクラス・レースから適用されます。');
      interactionEffects.sound('save');
    } catch (e) {
      note(e.message, true);
      q('#editor-save').disabled = false;
    } finally {
      saving = false;
      reportState();
      lock(false);
    }
  };
  q('#editor-reload').onclick = () => {
    if (!dirty || window.confirm('未保存の変更を破棄して、保存済みの設定に戻しますか？'))
      load().catch((e) => note(e.message, true));
  };
  q('#word-add').onclick = () => {
    if (config.words.length >= 80) return note('単語は80語までです。', true);
    let name = 'newword',
      n = 0;
    while (config.words.some((w) => w.word === name))
      name = 'newword' + String.fromCharCode(97 + n++);
    config.words.push({
      word: name,
      meaning: '新しい意味 ' + (config.words.length + 1),
      group: 'other',
      base: '',
      example: '',
      enabled: true,
      audio: null,
      distractors: [],
    });
    for (const key of ['course', 'race']) config[key].wordIds.push(name);
    selected = config.words.length - 1;
    changed();
    draw();
    q('#word-word').focus();
  };
  q('#word-delete').onclick = () => {
    if (config.words.length <= 4) return note('単語を4語以上残してください。', true);
    const w = config.words[selected];
    if (
      !window.confirm('「' + w.word + '」を単語帳から削除しますか？ 過去の授業の記録は残ります。')
    )
      return;
    config.words.splice(selected, 1);
    for (const key of ['course', 'race'])
      config[key].wordIds = config[key].wordIds.filter((x) => x !== w.word);
    selected = Math.max(0, selected - 1);
    changed();
    draw();
  };
  q('#word-preview').onclick = () =>
    playWordAudio(player, config.words[selected], appSettings.values.voiceVolume / 100).catch(() =>
      note('音声を再生できませんでした。ファイルを確認してください。', true),
    );
  q('#word-speech').onclick = () => {
    config.words[selected].audio = null;
    changed();
    word();
  };
  q('#audio-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1048576) return note('音声は1 MB以下にしてください。', true);
    const w = config.words[selected],
      b = q('#editor-save');
    b.disabled = true;
    saving = true;
    reportState();
    lock(true);
    try {
      const { mime, data } = await readAudioFile(file);
      const r = await api('config/audio', { mime, data });
      w.audio = r.audio;
      changed();
      word();
      note('音声をアップロードしました。「変更を保存」で確定します。');
    } catch (e) {
      note(e.message, true);
    } finally {
      saving = false;
      reportState();
      lock(false);
      b.disabled = !dirty;
    }
  };
  q('#race-order').onchange = (e) => {
    config.race.order = e.target.value;
    changed();
  };
  q('#course-roundSize').onchange = (e) => {
    config.course.roundSize = Number(e.target.value);
    changed();
  };
  for (const input of document.querySelectorAll('[data-rule]'))
    input.oninput = () => {
      config.race[input.dataset.rule] = Number(input.value);
      changed();
    };
  q('#teacher-logout').onclick = async () => {
    if (dirty && !window.confirm('未保存の変更を破棄してログアウトしますか？')) return;
    try {
      await api('logout', {});
      dirty = false;
      location.href = '/';
    } catch (e) {
      note(e.message, true);
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      player.pause();
      window.speechSynthesis?.cancel();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  load().catch((e) => {
    if (e.status === 401 && embedded) {
      note(
        'ログインの有効期限が切れました。設定を閉じて、先生のホームからログインしてください。',
        true,
      );
      return;
    }
    if (e.status === 401 && !embedded)
      location.replace('/?next=' + (mode === 'race' ? 'race' : 'practice'));
    if (e.status !== 401) q('#editor-login-error').textContent = e.message;
  });
})();
