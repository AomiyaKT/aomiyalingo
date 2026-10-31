# Release 80 — smoother live refreshes and consistent course transitions

31 October 2026. No database migration, scoring change or classroom workflow
change. Existing records and the Release 76 teacher guides remain compatible.

## Changes

The shared localization module now owns translation-aware UI text and attribute
writes. Race standings, lanes, participant captions and practice rosters retain
already correct English labels rather than replacing them with Japanese and
triggering another observer translation. Japanese sources remain available for
switching languages. The earlier practice helper re-exports this implementation.
There is no additional timer, translation engine or cache.

Race responses use participant self state from the same roster as the board,
rather than the earlier authentication lookup. When automatic course closure
loses its revision guard, or a teacher advances the course before the room is
re-read, dependent participant rows are refreshed too. This prevents a new-course
header from arriving with the previous course's readiness or task. Ordinary
polls keep one roster query; conflict recovery intentionally uses a second.
Internal roster rows and credentials are not added to public responses.

## Verification and measurement scope

All 92 regression suites and all 17 curriculum profiles pass; the content checker
reports zero errors or warnings. A disposable local browser rehearsal covered
35 racers, student join/avatar/readiness/briefing, a saved answer, pause/resume,
a 1366×768 English teacher board and a 768×1024 student view, with no page errors.

The accelerated 35-learner, 30-minute local classroom rehearsal completed with
30,440 requests, 3,209 race answers, 188 replayed answers and zero unexpected
errors. It uses the built Worker and in-memory SQLite, not production traffic.

The 35-learner tower regression previously recorded 3,500 text writes and 14,000
translated attribute writes across 100 unchanged English polls. Both counters
are now zero. Existing tests still cover real rank/score changes, row identity,
selective animations, reduced motion and responsive columns.

A separate local headless Chrome microbenchmark used the real language observer,
race tower, lanes, participant wall and practice roster, each with 35 synthetic
learners. Across 100 unchanged English refreshes, observed text/label mutation
records fell from 98,000 to zero. Cumulative synchronous draw time in that run
fell from 348.4 ms to 233.0 ms (about 33%). Score changes and switching back to
Japanese were checked in both runs.

These measurements concern repeated DOM presentation work with fixed fixtures,
not an end-to-end classroom frame rate or a production latency guarantee. Browser
and machine load affect timings. They exclude layout styling, actual Wi-Fi,
physical iPads and television hardware. API regressions explicitly inject
concurrent readiness changes, lost close guards, and next-course transitions
both before and after a successful close. Authorization, legacy response shapes,
CSV bytes and normal one-query roster reads remain covered.

Reproduce the automated source checks with `npm run check` and
`npm run content:check`. The browser microbenchmark's detailed output is retained
in the maintainer's local verification artifacts; it is not shipped in the app.

## 日本語

2026年10月31日。データベース、採点、授業の操作手順は変更しません。保存済み記録と
Release 76の先生用ガイドは引き続き利用できます。

- 英語の順位表や参加者一覧、通常練習の進捗表で、表示済みの英語を毎回日本語に戻し、
  再翻訳する処理を抑えました。日英の切替に必要な日本語原文は保持します。両モードで
  同じ表示更新を使い、別のタイマー、翻訳エンジン、キャッシュは追加しません。
- レースの本人情報を、順位表と同じ参加者情報から返します。自動終了が競合した場合や、
  終了直後に先生が次コースを開始した場合は、参加者情報も取り直します。新しいコースと
  前の準備状態・問題が混ざるのを防ぎます。通常の取得は参加者一覧を1回読み、競合の
  復旧時だけ2回読みます。内部の参加者行や認証情報は公開応答に追加しません。
- 35人・英語表示100回の順位表テストでは、従来の文字書き換え3,500回・翻訳属性の
  書き換え14,000回が、いずれも0回になりました。
- 実際の翻訳監視処理と練習・レースの各一覧を使ったローカルChrome測定では、対象の
  文字・ラベル変更通知が98,000件から0件になりました。同じ実行での同期描画処理の
  合計は348.4 msから233.0 msへ約33%減少しました。得点変更と日本語への復帰も確認。

回帰テスト92組が通過し、教材17設定の検査はエラー・警告ともに0件でした。ローカルの
破棄可能なデータで、35人参加、児童の参加・準備・説明・回答保存、一時停止と再開、
英語教師画面1366×768と児童画面768×1024を確認し、ページの実行エラーはありませんでした。

35人・授業時間30分の加速長時間検証は、30,440リクエスト、競速回答3,209件、
再送188件を処理し、予期しないエラーは0件でした。ビルド済みWorkerとメモリー上の
SQLiteを使用し、本番のデータや通信は使用していません。

測定は固定した仮想参加者によるDOM更新の比較です。授業全体の描画速度や本番の応答時間を
保証するものではなく、実機iPad、テレビ、学校のWi-Fi、画面スタイル込みの描画は対象外です。
並行した準備変更、終了処理の競合、終了直後のコース切替を回帰テストで再現しています。
`npm run check`と`npm run content:check`でソースの自動検証を実行できます。
