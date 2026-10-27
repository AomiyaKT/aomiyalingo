export function createEditorViews({ q, make, getConfig, getSelected, select, changed }) {
  const names = {
    text: '単語の意味',
    voice: 'リスニング',
    spelling: 'スペリング',
    hint: 'ヒントライト',
    boost: 'ダッシュ',
    review: '復習スター',
    compass: 'ダブルヒント',
    double: 'ダブルスター',
    lucky: 'ラッキークローバー',
  };
  function list() {
    const config = getConfig(),
      selected = getSelected();
    const panel = q('#word-list');
    panel.replaceChildren();
    const search = q('#word-search').value.trim().toLowerCase();
    config.words.forEach((w, i) => {
      if (search && !(w.word + ' ' + w.meaning).toLowerCase().includes(search)) return;
      const b = make('button', w.word);
      b.type = 'button';
      b.setAttribute('aria-pressed', i === selected);
      const meaning = make('small');
      const value = make('span', w.meaning);
      value.translate = false;
      meaning.append(value);
      if (!w.enabled) meaning.append(make('span', ' · 使用しない'));
      b.append(meaning);
      b.onclick = () => {
        select(i);
        list();
        word();
      };
      panel.append(b);
    });
    if (!panel.children.length)
      panel.append(make('p', '見つかりませんでした。検索することばを変えてください。'));
    q('#word-count').textContent =
      config.words.length + '語 · 使用中 ' + config.words.filter((w) => w.enabled).length + '語';
  }
  function pools() {
    const config = getConfig();
    for (const key of ['course', 'race']) {
      const panel = q('#' + key + '-pool');
      panel.replaceChildren();
      for (const w of config.words.filter((w) => w.enabled)) {
        const label = make('label'),
          input = make('input');
        input.type = 'checkbox';
        input.checked = config[key].wordIds.includes(w.word);
        input.onchange = () => {
          config[key].wordIds = input.checked
            ? [...new Set([...config[key].wordIds, w.word])]
            : config[key].wordIds.filter((x) => x !== w.word);
          changed();
        };
        label.append(input, make('span', w.word));
        panel.append(label);
      }
    }
  }
  function word() {
    const config = getConfig(),
      selected = getSelected();
    const w = config.words[selected];
    for (const field of ['word', 'meaning', 'base', 'example', 'group']) {
      const input = q('#word-' + field);
      input.value = w[field] || '';
      input.oninput = () => {
        const old = w.word;
        w[field] = input.value.trim();
        if (field === 'word')
          for (const key of ['course', 'race'])
            config[key].wordIds = config[key].wordIds.map((x) => (x === old ? w.word : x));
        changed();
        list();
        if (field === 'word') pools();
      };
    }
    q('#word-enabled').checked = w.enabled;
    q('#word-enabled').onchange = (e) => {
      w.enabled = e.target.checked;
      if (!w.enabled)
        for (const key of ['course', 'race'])
          config[key].wordIds = config[key].wordIds.filter((x) => x !== w.word);
      changed();
      list();
      pools();
    };
    for (let i = 0; i < 3; i++) {
      const input = q('#distractor-' + i);
      input.value = w.distractors?.[i] || '';
      input.oninput = () => {
        w.distractors = [0, 1, 2].map((j) => q('#distractor-' + j).value.trim()).filter(Boolean);
        changed();
      };
    }
    q('#word-audio-status').textContent =
      w.audio === null
        ? '端末の英語読み上げ'
        : w.audio?.startsWith('/api/audio/')
          ? 'アップロードした音声'
          : '収録済みの音声';
    q('#audio-file').value = '';
    const picturePanel = q('#word-image-panel');
    if (picturePanel) {
      picturePanel.hidden = !w.image;
      const preview = q('#word-image-preview'),
        checkbox = q('#word-picture-enabled');
      if (w.image) preview.src = w.image;
      else preview.removeAttribute('src');
      checkbox.checked = w.pictureEnabled !== false;
      checkbox.onchange = () => {
        w.pictureEnabled = checkbox.checked;
        changed();
      };
    }
  }
  function checks(key, field, values) {
    const config = getConfig();
    const panel = q('#' + key + '-' + field);
    panel.replaceChildren();
    for (const value of values) {
      const label = make('label'),
        input = make('input');
      input.type = 'checkbox';
      input.checked = config[key][field].includes(value);
      input.onchange = () => {
        config[key][field] = input.checked
          ? [...config[key][field], value]
          : config[key][field].filter((x) => x !== value);
        if (field === 'modes')
          config[key][field] = ['text', 'voice', 'spelling'].filter((x) =>
            config[key][field].includes(x),
          );
        changed();
      };
      label.append(input, make('span', names[value]));
      panel.append(label);
    }
  }
  function draw() {
    const config = getConfig();
    list();
    word();
    pools();
    checks('course', 'modes', ['text', 'voice', 'spelling']);
    const courseFormat = q('#course-format');
    courseFormat.value = config.course.format || 'adaptive-four';
    const showCourseFormat = () => {
      q('#course-format-guide').hidden = courseFormat.value === 'classic';
      q('#course-modes').hidden = courseFormat.value !== 'classic';
      q('#course-modes-title').hidden = courseFormat.value !== 'classic';
    };
    courseFormat.onchange = () => {
      config.course.format = courseFormat.value;
      showCourseFormat();
      changed();
    };
    showCourseFormat();
    checks('race', 'modes', ['text', 'voice', 'spelling']);
    checks('race', 'items', ['hint', 'boost', 'review', 'compass', 'double', 'lucky']);
    const format = q('#race-format');
    format.value = config.race.format || 'adaptive-four';
    const showFormat = () => {
      q('#race-format-guide').hidden = format.value === 'classic';
      q('#race-modes').hidden = format.value !== 'classic';
    };
    format.onchange = () => {
      config.race.format = format.value;
      showFormat();
      changed();
    };
    showFormat();
    q('#race-order').value = 'mixed';
    q('#course-roundSize').value = config.course.roundSize;
    for (const input of document.querySelectorAll('[data-rule]'))
      input.value = config.race[input.dataset.rule];
  }

  return { list, pools, word, draw };
}
