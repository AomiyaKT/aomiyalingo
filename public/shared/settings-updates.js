import { APP_VERSION } from './release.js';
import {
  UPDATE_REPOSITORY,
  hasUnsavedWork,
  releaseVersion,
  updateDecision,
} from './update-policy.js';

export function createUpdateController({
  clientVersion = APP_VERSION,
  request,
  getSaveState = () => ({}),
  isOpen = () => true,
  refresh,
  onChange = () => {},
}) {
  let result = null,
    busy = false,
    navigating = false,
    checked = false,
    error = '';
  const snapshot = () => ({
    result,
    busy: busy || navigating,
    checked,
    error,
    decision: result ? updateDecision(clientVersion, result) : 'unchecked',
    unsaved: hasUnsavedWork(getSaveState()),
  });
  const notify = () => onChange(snapshot());
  async function check() {
    if (busy || navigating) return false;
    busy = true;
    error = '';
    notify();
    try {
      const next = await request('/api/teacher/updates');
      if (!releaseVersion(next?.serverVersion)) throw Error('更新情報を取得できませんでした。');
      result = next;
      checked = true;
      return true;
    } catch (e) {
      result = null;
      error =
        e.status === 401
          ? '先生としてログインしてから更新を確認してください。'
          : '更新を確認できませんでした。接続を確認して、もう一度お試しください。';
      return false;
    } finally {
      busy = false;
      notify();
    }
  }
  async function apply() {
    if (busy || navigating || !result || updateDecision(clientVersion, result) !== 'reload')
      return false;
    if (result.active || hasUnsavedWork(getSaveState())) {
      notify();
      return false;
    }
    const version = result.serverVersion;
    busy = true;
    error = '';
    notify();
    try {
      const ready = await request(
        '/api/teacher/updates/ready?version=' + encodeURIComponent(version),
      );
      if (!isOpen()) return false;
      if (ready?.ok !== true || ready.version !== version) throw Error('UPDATE_CHANGED');
      if (hasUnsavedWork(getSaveState())) {
        notify();
        return false;
      }
      navigating = true;
      refresh();
      return true;
    } catch (e) {
      navigating = false;
      error =
        e.status === 409
          ? e.message
          : '更新を開始できませんでした。もう一度更新を確認してください。';
      // A failed preflight must be checked again; never keep an old enabled update action.
      result = null;
      return false;
    } finally {
      busy = false;
      notify();
    }
  }
  return { check, apply, snapshot };
}

const messages = {
  unchecked: 'GitHubの公開版と、このサーバーのバージョンを確認します。',
  current: '最新の公開版を使用しています。',
  reload: 'このサーバーで新しいバージョンを利用できます。',
  'awaiting-deployment': 'GitHubに新しい版があります。サーバーへの公開を待っています。',
  preview: '公開版より新しい開発版を使用しています。',
  'server-older': 'サーバーが以前の版に戻っています。管理者に確認してください。',
  unavailable: 'GitHubの更新情報を取得できません。最新版かどうかは未確認です。',
};

export function mountSettingsUpdates({
  host,
  dialog,
  window: win = window,
  document: doc = document,
}) {
  const section = doc.createElement('section');
  section.className = 'settings-updates';
  section.setAttribute('aria-labelledby', 'settings-update-title');
  section.innerHTML = `
    <h3 id="settings-update-title">アプリの更新</h3>
    <dl class="settings-update-versions"><div><dt>この画面</dt><dd>Release ${APP_VERSION}</dd></div><div><dt>GitHubの公開版</dt><dd id="settings-update-latest">—</dd></div></dl>
    <p id="settings-update-message" class="settings-note" role="status" aria-live="polite"></p>
    <p id="settings-update-blocked" class="settings-note settings-warning" hidden></p>
    <div class="settings-update-actions"><button id="settings-check-updates" class="home-button" type="button">更新を確認</button><button id="settings-apply-update" class="submit" type="button" hidden>最新版に更新</button></div>
    <p id="settings-update-time" class="settings-note" hidden></p>
    <details id="settings-update-details" class="settings-help" hidden><summary>更新内容とGitHub</summary><p id="settings-update-release-name" translate="no"></p><pre id="settings-update-notes" translate="no"></pre><a id="settings-update-link" target="_blank" rel="noopener noreferrer">GitHubで確認 ↗</a></details>`;
  host.prepend(section);
  const q = (s) => section.querySelector(s);
  const check = q('#settings-check-updates'),
    apply = q('#settings-apply-update');
  const controller = createUpdateController({
    request: (...args) => win.aomiNetwork.request(...args),
    getSaveState: () => win.aomiRuntimeStatus?.snapshot() || {},
    isOpen: () => dialog.open,
    refresh: () => win.location.reload(),
    onChange: render,
  });
  function render(state) {
    const { result, busy, error, decision, unsaved } = state;
    check.disabled = busy;
    check.textContent = busy ? '確認中…' : '更新を確認';
    q('#settings-update-message').textContent = error || messages[decision];
    q('#settings-update-latest').textContent = result?.latest?.version
      ? 'Release ' + result.latest.version
      : '—';
    const block = q('#settings-update-blocked');
    block.hidden = !(result?.active || unsaved);
    block.textContent = unsaved
      ? '保存中・未保存の操作があります。保存を確認してから更新してください。'
      : '授業・レースを終了してから更新してください。';
    apply.hidden = decision !== 'reload';
    apply.disabled = busy || !!result?.active || unsaved;
    q('#settings-update-time').hidden = !result?.checkedAt;
    q('#settings-update-time').textContent = result?.checkedAt
      ? '最終確認：' + new Date(result.checkedAt).toLocaleString()
      : '';
    const details = q('#settings-update-details');
    details.hidden = !result?.latest;
    if (result?.latest) {
      q('#settings-update-release-name').textContent = result.latest.title || '';
      q('#settings-update-notes').textContent = result.latest.notes || '';
      q('#settings-update-notes').hidden = !result.latest.notes;
      const link = q('#settings-update-link');
      // This response is same-origin, but keep external navigation constrained even on malformed data.
      const url = result.latest.url;
      link.href =
        typeof url === 'string' &&
        (url === UPDATE_REPOSITORY || url.startsWith(UPDATE_REPOSITORY + '/releases/tag/'))
          ? url
          : UPDATE_REPOSITORY;
    }
  }
  check.onclick = () => controller.check();
  apply.onclick = () => controller.apply();
  win.aomiRuntimeStatus?.subscribe(() => render(controller.snapshot()));
  render(controller.snapshot());
  return controller;
}
