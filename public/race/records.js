import { makeElement as make } from '../shared/dom.js';
import {
  recordModeNames,
  recordSummary,
  commonDifficulties,
  groupRecordAnswers,
  sortRecordSummaries,
  spellingSegments,
  createRecordStore,
} from './record-model.js';
export {
  recordModeNames,
  recordSummary,
  commonDifficulties,
  groupRecordAnswers,
  sortRecordSummaries,
  spellingSegments,
} from './record-model.js';
const percent = (n) => (n === null ? '—' : n + '%');
const button = (text, run, cls = 'home-button') => {
  const b = make('button', text, cls);
  b.type = 'button';
  b.onclick = run;
  return b;
};
function select(label, values, run) {
  const wrap = make('div', undefined, 'record-field'),
    el = make('select'),
    caption = make('label', label);
  el.id = label === 'コース' ? 'record-station-filter' : 'record-sort-filter';
  caption.htmlFor = el.id;
  wrap.append(caption, el);
  for (const [value, text] of values) {
    const o = make('option', text);
    o.value = value;
    el.append(o);
  }
  el.onchange = () => run(el.value);
  return { wrap, el };
}
function metric(value, label, cls = '') {
  const el = make('div', undefined, 'record-metric ' + cls);
  el.append(make('strong', value), make('span', label));
  return el;
}
// Polls update the overview; an open detail remains a stable reading snapshot.
export function createRaceRecords(root) {
  const store = createRecordStore();
  const section = root.closest('details');
  let station = 'all',
    order = 'number',
    query = '',
    page = 0;
  let selected = null,
    snapshot = null,
    filter = 'wrong',
    detailPage = 0;
  const tools = make('div', undefined, 'record-tools');
  const stage = select(
    'コース',
    [
      ['all', '全コース'],
      ['0', 'コース 1'],
      ['1', 'コース 2'],
      ['2', 'コース 3'],
    ],
    (value) => {
      station = value;
      page = 0;
      render();
    },
  );
  const sort = select(
    '並び順',
    [
      ['number', '出席番号順'],
      ['attention', 'サポートが必要な順'],
    ],
    (value) => {
      order = value;
      page = 0;
      render();
    },
  );
  const search = make('input');
  search.type = 'search';
  search.placeholder = '出席番号で探す';
  search.inputMode = 'numeric';
  search.setAttribute('aria-label', '出席番号で探す');
  search.oninput = () => {
    query = search.value.trim();
    page = 0;
    render();
  };
  tools.append(stage.wrap, sort.wrap, search);
  const overview = make('div', undefined, 'record-overview'),
    weak = make('div', undefined, 'record-class-focus');
  const tableWrap = make('div', undefined, 'record-table-wrap'),
    table = make('table', undefined, 'record-table');
  table.append(make('caption', '生徒ごとの学習状況'));
  const head = make('thead'),
    hr = make('tr');
  for (const title of ['出席番号', '自力正解率', '自力正解 / 回答', '要復習', '詳細']) {
    const th = make('th', title);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = make('tbody');
  table.append(head, body);
  tableWrap.append(table);
  const pages = make('div', undefined, 'record-pagination');
  root.replaceChildren(tools, overview, weak, tableWrap, pages);
  const dialog = make('dialog', undefined, 'record-dialog');
  dialog.setAttribute('aria-labelledby', 'record-detail-title');
  const heading = make('div', undefined, 'record-dialog-heading');
  const title = make('h2');
  title.id = 'record-detail-title';
  const close = button('閉じる', () => dialog.close());
  heading.append(title, close);
  const content = make('div', undefined, 'record-dialog-content');
  const footer = make('div', undefined, 'record-dialog-footer');
  const note = make('span', '表示中の記録を保っています。');
  const refresh = button('最新の回答を表示', () => {
    takeSnapshot();
    renderDetail();
  });
  refresh.hidden = true;
  footer.append(note, refresh);
  dialog.append(heading, content, footer);
  root.append(dialog);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    const id = selected;
    selected = null;
    snapshot = null;
    [...body.querySelectorAll('button')].find((b) => b.dataset.student === id)?.focus();
  });
  function takeSnapshot() {
    snapshot = store.summary(selected, station);
    refresh.hidden = true;
    note.textContent = '表示中の記録を保っています。';
  }
  function open(id) {
    selected = id;
    filter = 'wrong';
    detailPage = 0;
    takeSnapshot();
    renderDetail();
    dialog.showModal();
  }
  function paginate(target, current, total, change) {
    const count = Math.max(1, Math.ceil(total));
    const prev = button('前へ', () => change(current - 1)),
      next = button('次へ', () => change(current + 1));
    prev.disabled = current === 0;
    next.disabled = current >= count - 1;
    target.replaceChildren(prev, make('span', current + 1 + ' / ' + count + ' ページ'), next);
    target.hidden = count === 1;
  }
  function render() {
    const all = sortRecordSummaries(store.summaries(station), order);
    const attempted = all.filter((s) => s.main.length);
    overview.replaceChildren(
      metric(String(all.length) + '人', '参加した生徒'),
      metric(
        String(attempted.filter((s) => s.needs > 0).length) + '人',
        '復習ポイントあり',
        'needs',
      ),
      metric(
        attempted.length
          ? percent(Math.round(attempted.reduce((n, s) => n + s.accuracy, 0) / attempted.length))
          : '—',
        '平均の自力正解率',
      ),
    );
    const issues = commonDifficulties(all);
    weak.replaceChildren(
      make('strong', 'みんなで復習するなら'),
      make(
        'span',
        issues.length
          ? issues.map(([word, n]) => word + '（' + n + '人が不正解）').join('　・　')
          : 'まだ不正解の記録はありません。',
      ),
    );
    const filtered = all.filter(
      (s) => !query || String(s.player.label ?? s.player.alias).includes(query),
    );
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 12) - 1));
    const focused = body.contains(document.activeElement)
      ? document.activeElement.dataset.student
      : null;
    body.replaceChildren();
    for (const s of filtered.slice(page * 12, page * 12 + 12)) {
      const tr = make('tr'),
        name = make('th');
      name.scope = 'row';
      name.append(
        make('strong', String(s.player.label ?? s.player.alias)),
        make('small', s.main.length ? (s.player.done ? '回答終了' : '回答中') : 'まだ回答なし'),
      );
      const accuracy = make('td');
      accuracy.append(make('strong', percent(s.accuracy), 'record-accuracy'));
      const answered = make('td', s.independent + ' / ' + s.main.length + '問');
      const needs = make('td');
      needs.append(
        make(
          'span',
          s.main.length ? (s.needs ? s.needs + '項目' : '今のところ順調') : '—',
          s.needs ? 'record-pill needs' : 'record-pill',
        ),
      );
      const action = make('td'),
        show = button('詳しく見る', () => open(s.player.id));
      show.dataset.student = s.player.id;
      show.setAttribute(
        'aria-label',
        '出席番号 ' + (s.player.label ?? s.player.alias) + ' の成績を見る',
      );
      action.append(show);
      tr.append(name, accuracy, answered, needs, action);
      body.append(tr);
    }
    if (!filtered.length) {
      const tr = make('tr'),
        td = make(
          'td',
          query ? '該当する生徒はいません。' : '生徒が参加すると成績を確認できます。',
        );
      td.colSpan = 5;
      tr.append(td);
      body.append(tr);
    }
    if (focused)
      [...body.querySelectorAll('button')]
        .find((b) => b.dataset.student === focused)
        ?.focus({ preventScroll: true });
    paginate(pages, page, filtered.length / 12, (n) => {
      page = n;
      render();
    });
  }
  function renderDetail() {
    content.replaceChildren();
    if (!snapshot) {
      title.textContent = '生徒の記録';
      content.append(make('p', 'この生徒の記録は現在表示できません。'));
      return;
    }
    const s = snapshot;
    title.textContent = '出席番号 ' + (s.player.label ?? s.player.alias);
    content.append(
      make(
        'p',
        stage.el.options[stage.el.selectedIndex].text +
          'の学習記録。道具による加点は正解率に含めません。',
        'record-detail-intro',
      ),
    );
    const stats = make('div', undefined, 'record-overview');
    stats.append(
      metric(percent(s.accuracy), '自力正解率'),
      metric(s.independent + ' / ' + s.main.length + '問', '自力正解 / 回答'),
      metric(s.player.score.toLocaleString() + ' pt', 'ゲームの総合得点'),
    );
    content.append(stats);
    const weaknesses = [...new Set(s.wrong.map((h) => recordModeNames[h.mode] || h.mode))];
    content.append(
      make(
        'p',
        weaknesses.length
          ? '復習のポイント：' + weaknesses.join('・')
          : s.hinted.length
            ? 'ヒントを使った問題を、もう一度自力で確かめましょう。'
            : s.main.length
              ? '今のところ、自力で正解できています。'
              : '回答すると、復習のポイントが表示されます。',
        'record-personal-focus',
      ),
    );
    const tabs = make('div', undefined, 'record-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', '表示する回答');
    for (const [id, label, count] of [
      ['wrong', 'まちがい', s.wrong.length],
      ['hinted', 'ヒント使用', s.hinted.length],
      ['all', 'すべて', s.history.length],
    ]) {
      const b = button(label + ' ' + count, () => {
        filter = id;
        detailPage = 0;
        renderDetail();
        content.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      });
      b.setAttribute('aria-pressed', String(filter === id));
      tabs.append(b);
    }
    content.append(tabs);
    const entries =
      filter === 'all' ? s.history : groupRecordAnswers(filter === 'hinted' ? s.hinted : s.wrong);
    detailPage = Math.min(detailPage, Math.max(0, Math.ceil(entries.length / 8) - 1));
    if (!entries.length)
      content.append(
        make(
          'p',
          filter === 'wrong'
            ? 'このコース範囲には、まちがいの記録はありません。'
            : filter === 'hinted'
              ? 'ヒントを使った回答はありません。'
              : 'まだ回答の記録はありません。',
          'record-empty',
        ),
      );
    for (const h of entries.slice(detailPage * 8, detailPage * 8 + 8))
      content.append(answerCard(h));
    const pagination = make('div', undefined, 'record-pagination');
    content.append(pagination);
    paginate(pagination, detailPage, entries.length / 8, (n) => {
      detailPage = n;
      renderDetail();
      content.scrollTop = 0;
    });
    content.append(
      make(
        'p',
        '自力正解率は、通常の問題でヒントを使わず正解した割合です。復習スターの回答は集計から除きます。要復習は、まちがい・ヒント使用のあった単語と題型の組み合わせ数です。',
        'record-footnote',
      ),
    );
  }
  section?.addEventListener('toggle', () => {
    if (section.open) render();
  });
  return (result) => {
    const update = store.update(result);
    if (update.raceChanged) {
      if (dialog.open) dialog.close();
      page = 0;
      station = 'all';
      stage.el.value = 'all';
      query = '';
      search.value = '';
    }
    if (!update.changed) return;
    if (!section || section.open) render();
    if (dialog.open && update.changedIds.has(selected)) {
      refresh.hidden = false;
      note.textContent = '新しい記録があります。読む位置はそのままです。';
    }
  };
}

function answerCard(h) {
  const wrong = !h.correct;
  const card = make(
    'article',
    undefined,
    'record-answer ' + (wrong ? 'is-wrong' : h.hinted ? 'is-hinted' : 'is-correct'),
  );
  const meta = make('div', undefined, 'record-answer-meta');
  meta.append(
    make(
      'span',
      wrong ? '不正解' : h.hinted ? 'ヒントで正解' : h.review ? '復習で正解' : '自力で正解',
      'record-result',
    ),
    make(
      'span',
      'コース ' +
        (h.stations?.map((n) => n + 1).join('・') ?? (h.station ?? 0) + 1) +
        ' · ' +
        (recordModeNames[h.mode] || h.mode) +
        (h.review ? ' · 復習スター' : '') +
        (wrong && h.hinted ? ' · ヒント使用' : ''),
    ),
  );
  card.append(meta, make('h3', h.word));
  if (h.count > 1)
    card.append(make('p', '同じ回答 ' + h.count + '回をまとめて表示', 'record-repeat'));
  const compare = make('dl', undefined, 'record-compare');
  for (const [label, value] of [
    ['生徒の回答', h.answer],
    ...(wrong ? [['正しい答え', h.expected]] : []),
  ]) {
    const group = make('div');
    const dd = make('dd');
    if (
      wrong &&
      label === '生徒の回答' &&
      ['spelling', 'dictation'].includes(h.mode) &&
      h.expected
    ) {
      dd.setAttribute('aria-label', String(value ?? ''));
      for (const part of spellingSegments(value ?? '', h.expected))
        dd.append(make('span', part.char, part.wrong ? 'record-wrong-letter' : ''));
    } else
      dd.textContent = String(value ?? '記録なし').replace(
        / \/ /g,
        ['match', 'audioMatch'].includes(h.mode) ? '\n' : ' / ',
      );
    group.append(make('dt', label), dd);
    compare.append(group);
  }
  card.append(compare);
  return card;
}
