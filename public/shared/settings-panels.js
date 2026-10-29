import { APP_VERSION } from './release.js';
import { describeRuntimeStatus } from './runtime-status.js';
import { teacherGuidePath } from './teacher-guide.js';
import { mountSettingsUpdates } from './settings-updates.js';

const teacherHelp = `
  <h3>授業を始めるには</h3>
  <ol class="settings-steps">
    <li><strong>ホームでモードを選ぶ</strong><span>「単語練習」か「単語レース」を選びます。</span></li>
    <li><strong>教材とルールを決める</strong><span>学年・単語の範囲を選び、必要なら「ルールを変更」で調整します。</span></li>
    <li><strong>参加受付を開く</strong><span>画面のQRを生徒のiPadで読み取り、出席番号を入力してもらいます。</span></li>
  </ol>
  <details class="settings-help"><summary>単語練習とレースの違い</summary><p>単語練習は、生徒が自分のペースで進めます。レースは、動物を選んで「準備完了」を押した生徒を確認し、先生がスタートします。各コースの結果を見たら、次のコースを始めます。</p></details>
  <details class="settings-help"><summary>一時停止・終了・テレビへの表示</summary><p>止めたいときは「一時停止」、授業を終えるときは隣の「終了」を押します。テレビへの接続はWindowsのキャスト機能を使います。</p></details>
  <details class="settings-help"><summary>接続が切れた・音が出ないとき</summary><p>Wi-Fiと端末の音量を確認してください。音楽は先生の端末だけで流れます。最初に画面を一度押すと音が有効になります。生徒の回答が未送信のときは、画面を閉じずに再送信してください。</p></details>
  <a class="home-button settings-guide" href="/help/teacher-guide.pdf" target="_blank" rel="noopener">先生用ガイドを開く（PDF） ↗</a>`;

function studentHelp(race) {
  return `<h3>${race ? 'みんなでレースに参加しよう' : '自分のペースで学ぼう'}</h3>
    <ol class="settings-steps">
      <li><strong>出席番号を入力</strong><span>先生が見せたQRから参加します。自分の番号を確認しよう。</span></li>
      <li><strong>${race ? '動物を選んで、準備完了！' : '単語の意味と発音を確認'}</strong><span>${race ? '好きな動物を選び、「準備完了」を押して先生のスタートを待とう。' : 'スピーカーを押すと発音を聞けます。準備ができたらレッスンへ。'}</span></li>
      <li><strong>聞いて・選んで・つづろう</strong><span>選択肢や文字を押して、「答えを確認」を押そう。選んだ文字は、もう一度押すと戻せます。</span></li>
    </ol>
    <details class="settings-help"><summary>終わったらどうする？</summary><p>${race ? '結果を見たら、画面の案内にそって次のコースを待とう。待っている間の復習は自由です。順位は変わりません。' : '結果を確認して次のレッスンへ進もう。間違えた単語は、もう一度復習できます。'}</p></details>
    <details class="settings-help"><summary>音が出ない・接続が切れたとき</summary><p>iPadの音量とWi-Fiを確認しよう。最初はスピーカーを一度押してみてね。回答を保存できないときは画面を閉じず、先生に声をかけよう。</p></details>`;
}

export function mountSettingsPanels({ dialog, teacher }) {
  const intro = dialog.querySelector('.settings-intro');
  intro.textContent = 'この端末の音と表示を調整できます。';
  const tabs = document.createElement('div');
  tabs.className = 'settings-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '設定の種類');
  const panels = Array.from({ length: 3 }, () => document.createElement('section'));
  const [display, help, status] = panels;
  // Reuse the current controls and IDs. Student pages never create a music player.
  let node = intro.nextElementSibling;
  while (node && node.id !== 'settings-done') {
    const next = node.nextElementSibling;
    display.append(node);
    node = next;
  }
  const contrast = document.createElement('div');
  contrast.className = 'setting-line';
  contrast.innerHTML =
    '<label for="clear-display">文字と枠をくっきり表示</label><input id="clear-display" type="checkbox" role="switch">';
  display.querySelector('#font-size').closest('.setting-line').after(contrast);
  const caption = document.createElement('p');
  caption.className = 'settings-note';
  caption.textContent = '文字とボタンの輪郭を濃くして、読みやすくします。';
  contrast.after(caption);
  const localNote = display.querySelector('.settings-note:last-of-type');
  help.innerHTML = teacher
    ? teacherHelp
    : studentHelp(document.body.classList.contains('race-student'));
  if (teacher) {
    const guide = help.querySelector('.settings-guide');
    const updateGuide = (language) => {
      guide.href = teacherGuidePath(language);
    };
    let language = 'ja';
    try {
      language = window.localStorage.getItem('aomiyalingo.uiLanguage');
    } catch {}
    updateGuide(language);
    window.addEventListener('aomiyalingo-language', (event) => updateGuide(event.detail));
  }
  status.innerHTML = `
    <h3>接続と保存</h3>
    <dl class="settings-status-list">
      <div><dt>サーバー接続</dt><dd id="settings-connection"></dd></div>
      <div><dt>接続確認時刻</dt><dd id="settings-checked-at"></dd></div>
      <div><dt>回答・操作の保存</dt><dd id="settings-save-state"></dd></div>
      <div><dt>最終保存時刻</dt><dd id="settings-saved-at"></dd></div>
    </dl>
    <p id="settings-sync-detail" class="settings-note" hidden></p>
    <p class="settings-note">接続確認では、回答や成績を変更しません。保存できなかった回答や操作は、元の画面で確認してください。</p>
    <button id="settings-check-connection" class="home-button" type="button">接続を確認する</button>
    <p id="settings-check-result" class="settings-note" role="status"></p>
    <p class="settings-version">Aomiyalingo <span>バージョン ${APP_VERSION}</span></p>`;
  if (teacher) {
    status.querySelector('.settings-version').remove();
    mountSettingsUpdates({ host: status, dialog });
    const tools = document.createElement('div');
    tools.className = 'teacher-tools-links';
    tools.innerHTML =
      '<a class="home-button" href="/teacher-tools.html#quality" target="_blank" rel="noopener">教材チェック</a><a class="home-button" href="/teacher-tools.html#backup" target="_blank" rel="noopener">バックアップと復元</a>';
    status.append(tools);
  }
  const buttons = ['音・表示', '使い方', '状態'].map((label, index) => {
    const button = document.createElement('button');
    button.id = 'settings-tab-' + index;
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'settings-panel-' + index);
    button.onclick = () => select(index);
    panels[index].id = 'settings-panel-' + index;
    panels[index].className = 'settings-panel';
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', button.id);
    tabs.append(button);
    return button;
  });
  function select(index) {
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
      buttons[i].setAttribute('aria-selected', String(i === index));
      buttons[i].tabIndex = i === index ? 0 : -1;
    });
  }
  tabs.onkeydown = (event) => {
    const current = buttons.indexOf(document.activeElement);
    const next =
      event.key === 'ArrowRight'
        ? (current + 1) % 3
        : event.key === 'ArrowLeft'
          ? (current + 2) % 3
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 2
              : -1;
    if (next < 0) return;
    event.preventDefault();
    select(next);
    buttons[next].focus();
  };
  intro.after(tabs, ...panels);
  select(0);
  const time = (value) =>
    value ? new Date(value).toLocaleTimeString('ja-JP', { hour12: false }) : '—';
  window.aomiRuntimeStatus.subscribe((value) => {
    const labels = describeRuntimeStatus(value);
    status.querySelector('#settings-connection').textContent = labels.connection;
    status.querySelector('#settings-checked-at').textContent = time(value.checkedAt);
    status.querySelector('#settings-saved-at').textContent = time(value.savedAt);
    const saved = status.querySelector('#settings-save-state');
    saved.textContent = labels.save;
    saved.classList.toggle('settings-warning', labels.warning);
  });
  // Keep the practice client's more specific pending-answer/retry message visible.
  const sync = document.querySelector('#sync-status');
  if (sync) {
    const update = () => {
      const detail = status.querySelector('#settings-sync-detail');
      detail.hidden = sync.hidden || !sync.textContent;
      detail.textContent = sync.textContent;
      detail.classList.toggle('settings-warning', sync.classList.contains('sync-error'));
    };
    new MutationObserver(update).observe(sync, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    update();
  }
  const check = status.querySelector('#settings-check-connection');
  check.onclick = async () => {
    const result = status.querySelector('#settings-check-result');
    check.disabled = true;
    result.textContent = '確認中…';
    try {
      const response = await window.aomiNetwork.request('/api/health');
      result.textContent =
        response.version === APP_VERSION
          ? 'サーバーに接続できました。'
          : '新しいバージョンがあります。授業が終わってからページを開き直してください。';
    } catch {
      result.textContent = '接続できません。Wi-Fiを確認して、もう一度お試しください。';
    } finally {
      check.disabled = false;
    }
  };
  return {
    localSaved(ok) {
      localNote.textContent = ok
        ? '設定はこのブラウザーに自動保存されます。'
        : '設定を保存できません。この画面では使えますが、閉じると元に戻ることがあります。';
      localNote.classList.toggle('settings-warning', !ok);
    },
  };
}
