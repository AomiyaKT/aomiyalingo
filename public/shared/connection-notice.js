export function createConnectionNotice({ banner, schedule = setTimeout, cancel = clearTimeout }) {
  let failed = false;
  let timer;
  return function update(ok) {
    if (!ok) {
      cancel(timer);
      timer = undefined;
      failed = true;
      banner.hidden = false;
      banner.textContent = '接続を確認しています。画面を閉じずにお待ちください。';
      banner.classList.add('connection-lost');
    } else if (failed) {
      failed = false;
      banner.hidden = false;
      banner.textContent = '接続が戻りました。';
      banner.classList.remove('connection-lost');
      timer = schedule(() => {
        banner.hidden = true;
        timer = undefined;
      }, 3000);
    }
    // Further successful polls must not cancel the recovery notice's expiry.
  };
}
