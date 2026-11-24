# Release 85 — Chrome and Safari compatibility checks

- Keep Chrome and Safari as supported browser targets. Add a repeatable optional
  Chrome/WebKit browser checker with isolated local data and versioned reports.
- If a media backend rejects a preloaded blob with `NotSupportedError`, retry its
  original recording URL once. Keep the actual recording, volume and playback
  rate. Do not retry permission errors or revive paused/replaced requests.
- Route classic practice recording playback through the same helper used by rich
  exercises, study cards and races. Device TTS, questions, scoring, session
  replacement and the required recording-download gate are unchanged.

ChromeとSafariの両方を対応対象にし、2つのブラウザーエンジンで主要な流れを
確認する手順を追加しました。先読みした音声の再生形式が拒否された場合は、
同じ録音ファイルの元URLへ一度だけ切り替えます。TTSへの変更ではありません。

## Verification

95 regression suites pass. Browser checks cover practice entry and three classic
exercise UIs, saved answers, offline retry, portrait/landscape layout, language
switching, history restoration, closed-admission race takeover and actual recorded
playback. Additional fault-injected preparation checks cover failed-only retries
and canceled activities in both engines.

The Windows WebKit build cannot validate hardware-iPad audio or Web Audio effects;
its original-URL recording fallback passed online. Chrome's cached blob playback
also passed offline. See [browser compatibility](browser-compatibility.md) for the
matrix, reproduction commands and exact verification limits. No physical iPad
check or production student-data mutation was performed for this release.
