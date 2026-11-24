# Release 86 — clearer loading and automatic connection recovery

## For teachers / 先生へ

The preparation panel keeps the loaded/total recording count visible. Temporary
download failures retry automatically, retaining recordings already loaded. If
the device is offline or loading takes longer, the panel explains what is
happening. **Retry remaining audio** is also available. Ready/start stays locked
until all required recordings have finished downloading.

音声の読み込み済み件数と全件数を表示します。一時的な失敗は、取得済みの音声を
残したまま自動で再試行します。通信が切れた場合や時間がかかる場合も状況を
表示します。手動の再読み込みも使えます。全録音の取得後に準備完了・開始を押せます。

Keep the student page open after a temporary connection loss. Practice retries a
pending answer when a status check succeeds, even if the browser never reports
an offline/online change. Race keeps the pending question visible until its
answer is acknowledged. Existing receipt replay prevents duplicate scoring.

一時的な通信切断では児童の画面を閉じず、そのままお待ちください。通信状態の
確認に成功すると、保存待ちの回答を自動で再送します。レースでは回答の保存を
確認するまで現在の問題を表示します。同じ回答の再送で二重に加点しません。

If a student number is active on another page, the message explains this and
provides an explicit way back to entry/reconnection. It never silently takes the
number back from the other page. The previously entered number is retained.

別の画面で参加中の場合は、その旨と再接続の入口を表示します。元の出席番号を
残しますが、確認なしに別の画面の参加を解除することはありません。

## Implementation and operating limits

- Extend the existing activity-owned preparation service, not a second cache.
  Reuse its two-download concurrency, 8 MiB per recording, 48 MiB per activity,
  full-body validation and request-generation guards.
- Retry network/time-out/incomplete-body failures and HTTP 408/429/5xx with one jittered
  exponential timer, capped at 20 seconds between batches. Successful recordings
  are not downloaded again. Failed resources bypass stale HTTP cache on retry.
  Invalid paths, media responses and budget failures
  require manual retry/correction; do not hammer a permanently missing resource.
- Offline/hidden activities do not start new batches. Online, foreground and
  `pageshow` resume missing recordings. Changing/leaving activities cancels the
  retry timer and stale downloads. A timer never recreates a disposed activity.
- Practice reuses its existing status loop and durable single-answer transaction
  slot. Online, foreground and page restoration request the same status check;
  writes remain subject to pause, credential and request-owner guards. A failed
  entry lookup also retries while its dialog remains open, retaining the number.
- Race reuses its poll scheduler, pending-answer controller and server receipts.
  Pending acknowledgements do not replace the visible task with a polled next
  task. Credential rejection still requires explicit reconnection; temporary
  network failures do not revoke the student.
- No schema, scoring, admission, time-refund, TTS-provider or GitHub changes.
  Preparation confirms complete downloads, not audible playback permission.
  Device speech synthesis remains separate from recorded-word preparation.
- A pending answer is kept in the current browser's local storage. This cannot
  guarantee recovery after storage eviction, private-mode restrictions, clearing
  browser data or switching to another browser/device. Only server-saved work is
  available on another device. Race time continues during a disconnection.

## Verification

95 regression suites passed. Chrome 157.0.8103.39 and WebKit 26.5 passed the
isolated browser flow and fault-injection checks. Reproduce with
`node scripts/check.mjs` and the optional Chrome/WebKit checker documented in
[browser compatibility](browser-compatibility.md). Fault cases cover failed-only
automatic audio retry, initial offline entry, background return, silent network
recovery, lost answer acknowledgements and invalidated credentials. Tests use
isolated local data. Physical iPad Safari verification remains a separate check.
