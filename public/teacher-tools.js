import { makeElement as make } from './shared/dom.js';
import { APP_VERSION } from './shared/release.js';
const q = (s) => document.querySelector(s);
const api = (path, body) => aomiNetwork.request('/api/teacher/config/' + path, body);
let preview = null,
  report = null,
  selection = 0,
  busy = false,
  page = 0;
function note(text, bad = false) {
  q('#tools-status').textContent = text;
  q('#tools-status').classList.toggle('tools-error', bad);
}
function download(name, data) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    ),
    link = make('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function error(e) {
  if (e.status === 401) {
    location.replace('/');
    return;
  }
  note(e.message, true);
}
function select() {
  const quality = location.hash === '#quality';
  q('#tools-quality').hidden = !quality;
  q('#tools-backup').hidden = quality;
  q('#tab-quality').setAttribute('aria-current', quality ? 'page' : 'false');
  q('#tab-backup').setAttribute('aria-current', quality ? 'false' : 'page');
  if (quality && !report) runAudit();
}
window.addEventListener('hashchange', select);
q('#backup-export').onclick = async () => {
  const button = q('#backup-export');
  button.disabled = true;
  try {
    download(
      'aomiyalingo-teaching-' + new Date().toISOString().slice(0, 10) + '.json',
      await api('backup'),
    );
    note('バックアップを保存しました。');
  } catch (e) {
    error(e);
  } finally {
    button.disabled = false;
  }
};
function clear() {
  selection++;
  preview = null;
  q('#backup-preview').hidden = true;
  q('#backup-file').value = '';
}
q('#backup-cancel').onclick = clear;
q('#backup-file').onchange = async () => {
  const ticket = ++selection,
    file = q('#backup-file').files[0];
  preview = null;
  q('#backup-preview').hidden = true;
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    note('バックアップは8 MBまでです。', true);
    return;
  }
  note('ファイルを確認中…');
  try {
    const backup = JSON.parse(await file.text()),
      checked = await api('backup/inspect', { backup });
    if (ticket !== selection) return;
    preview = { backup, ...checked };
    q('#backup-summary').textContent =
      checked.profiles + '教材 · ' + checked.words + '語 · 自作音声 ' + checked.audio + '件';
    q('#backup-preview').hidden = false;
    note('内容を確認してから復元できます。');
  } catch (e) {
    if (ticket === selection)
      error(e instanceof SyntaxError ? Error('JSONファイルを読み取れませんでした。') : e);
  }
};
q('#backup-restore').onclick = () => {
  if (!preview || busy) return;
  q('#restore-error').textContent = '';
  q('#restore-confirm').showModal();
  q('#restore-cancel').focus();
};
q('#restore-cancel').onclick = () => q('#restore-confirm').close();
q('#restore-confirm').addEventListener('cancel', (event) => {
  if (busy) event.preventDefault();
});
q('#restore-confirm-ok').onclick = async () => {
  if (!preview || busy) return;
  busy = true;
  const captured = preview;
  q('#restore-confirm-ok').disabled = q('#restore-cancel').disabled = true;
  q('#backup-file').disabled = true;
  try {
    const result = await api('backup/restore', {
      backup: captured.backup,
      digest: captured.digest,
      revision: captured.revision,
      confirm: true,
    });
    clear();
    report = null;
    q('#restore-confirm').close();
    note('復元しました。次の授業・レースから適用されます。');
    q('#backup-previous').hidden = false;
    try {
      localStorage.setItem('aomiyalingo.configRevision', String(result.revision));
    } catch {}
    window.dispatchEvent(new CustomEvent('aomi-mode-settings-saved'));
  } catch (e) {
    q('#restore-error').textContent = e.message;
    error(e);
  } finally {
    busy = false;
    q('#restore-confirm-ok').disabled = q('#restore-cancel').disabled = false;
    q('#backup-file').disabled = false;
  }
};
async function runAudit() {
  if (q('#audit-run').disabled) return;
  q('#audit-run').disabled = true;
  note('教材を確認中…');
  try {
    report = await api('audit');
    q('#backup-previous').hidden = !report.hasPreviousBackup;
    page = 0;
    renderAudit();
    q('#audit-download').disabled = false;
    note('教材チェックが完了しました。');
  } catch (e) {
    error(e);
  } finally {
    q('#audit-run').disabled = false;
  }
}
function renderAudit() {
  if (!report) return;
  const summary = q('#audit-summary');
  summary.replaceChildren();
  for (const [value, label] of [
    [report.words, '語'],
    [report.errors, '修正が必要'],
    [report.warnings, '確認したい項目'],
  ]) {
    const card = make('div');
    card.append(make('strong', String(value)), make('span', label));
    summary.append(card);
  }
  const issues = report.issues.filter(
      (i) => q('#audit-filter').value === 'all' || i.severity === q('#audit-filter').value,
    ),
    host = q('#audit-issues');
  host.replaceChildren();
  if (!issues.length) host.append(make('p', 'この条件で確認する項目はありません。'));
  for (const issue of issues.slice(page * 20, page * 20 + 20)) {
    const card = make('article', undefined, 'audit-issue ' + issue.severity),
      word = make('strong', issue.word);
    word.translate = false;
    card.append(make('small', issue.label), word, make('p', issue.detail));
    host.append(card);
  }
  const pages = Math.ceil(issues.length / 20);
  if (pages > 1) {
    const nav = make('div', undefined, 'tools-actions');
    for (const [label, delta] of [
      ['前へ', -1],
      ['次へ', 1],
    ]) {
      const b = make('button', label, 'home-button');
      b.disabled = page + delta < 0 || page + delta >= pages;
      b.onclick = () => {
        page += delta;
        renderAudit();
      };
      nav.append(b);
    }
    nav.append(make('span', page + 1 + ' / ' + pages));
    host.append(nav);
  }
}
q('#audit-run').onclick = runAudit;
q('#audit-filter').onchange = () => {
  page = 0;
  renderAudit();
};
q('#audit-download').onclick = () =>
  report && download('aomiyalingo-content-check-v' + APP_VERSION + '.json', report);
runAudit();
select();
