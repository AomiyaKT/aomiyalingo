# Browser compatibility / ブラウザーの互換性

## Teachers and students / 先生・児童へ

Chrome and Safari are both supported targets. Students do not need to install
Chrome just because an iPad opens the QR link in Safari. Use an up-to-date browser
and keep the activity page open. Tap the speaker button when the browser requires
an interaction before playing audio.

ChromeとSafariの両方を対応対象にしています。iPadでQRコードを読み取り、
Safariが開いた場合も、そのまま使えます。Chromeを別に入れる必要はありません。
音声が自動で始まらない場合は、スピーカーボタンを押してください。

## Maintainer checks

Build with `node build.mjs`, then run `node scripts/check-browsers.mjs`.
The optional checker requires Playwright and its WebKit binary, plus Google
Chrome. It starts its own loopback server with a fresh in-memory SQLite database
and random fixture password. It does not contact or modify production.

Install optional QA tooling in a development checkout, for example:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install webkit
node build.mjs
node scripts/check-browsers.mjs
```

On Windows, set `PLAYWRIGHT_BROWSERS_PATH` to a chosen directory on F: before
installing/running to keep browser binaries off C:. The checker also accepts:

- `--playwright-package=<absolute path to an existing playwright/package.json>`
- `--chrome-executable=<absolute path to an installed Chrome executable>`
- `--output-dir=<absolute output directory>`

Without overrides, screenshots and `report.json` go into the ignored
`output/browser-compatibility` directory. Both engines are run explicitly; a
Chrome window with an iPad-sized viewport is not counted as a WebKit check.

The repeatable checks cover attendance entry, audio preparation, three classic
question UIs, answer submission, a disconnected answer and retry without double
counting, language switching, portrait/landscape overflow, history restoration,
and replacing a racer connection after admission closes. Release 86 also injects
a failed required recording, a lost practice/race acknowledgement with the network
still marked online, and an actual offline spelling submission. Checks verify
automatic recovery, one saved answer, readiness gating, retained question UI and
the old page's explicit reconnection control. The report records
engine versions and actual media playback promises. The normal regression suite
separately covers rich exercise models and scoring; the browser check does not
claim complete coverage of every question family.

## Verification recorded on 12 November 2026

| Check | Google Chrome on Windows | WebKit 26.5 on Windows, tablet/touch context |
| --- | --- | --- |
| Practice entry, vocabulary/listening/spelling submission | Passed | Passed |
| Japanese/English settings and portrait/landscape layout | Passed | Passed |
| Offline answer retention/retry; browser Back restoration | Passed | Passed |
| Race re-entry with closed admission; old token revoked | Passed | Passed |
| Download gating, failed-only audio retry and activity cancellation | Passed | Passed |
| Actual recorded playback | Cached blob passed, including offline | Original recording URL fallback passed online |
| Web Audio effects | Buffer-source playback observed | Not available in this Windows engine build; not device-verified |

The Windows WebKit port rejected native audio blob playback while accepting the
same PCM WAV through its HTTP URL. The application now retries the same original
recording once after `NotSupportedError`; it does not regenerate speech, change
the answer, or switch to TTS. Working blob playback remains the first path.
The activity-owned cache remembers a rejected transport only for that recording.
Permission failures, paused playback and obsolete requests do not trigger an
uncontrolled retry. An HTTP fallback needs a working connection or a usable
browser HTTP cache; it is not an offline-playback guarantee.

## Verification limits

Playwright WebKit is not branded Safari. Platform media capabilities differ;
the [Playwright browser documentation](https://playwright.dev/docs/browsers#webkit)
specifically distinguishes OS-dependent media support. The WebKit project also
records that its [Windows port builds with Web Audio disabled](https://results.webkit.org/commit?id=323373%40main&repository_id=webkit).

These checks are not a physical-iPad certification. Actual Safari/iPadOS audio
permissions, audible speaker output, the software keyboard, low-power mode,
screen lock and OS memory eviction still require a device check. A recent engine
run does not establish support for every older school iPadOS version.

実機のiPad・Safariでの音声出力、キーボード、画面ロックなどは、別途確認が必要です。
Windows上のWebKit検証を、iPad実機での検証済みという意味では使いません。
