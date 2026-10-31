# Release 81 — stable record controls and bounded preload retries

31 October 2026. No database migration, scoring change or teaching workflow
change. Existing records and the Release 76 teacher guides remain compatible.

## Changes

The race record overview retains its three summary cards, review summary,
pagination controls and the current page's student rows. A score-only update no
longer recreates the visible table. Rows are keyed by participant ID and retained
only while visible, with at most 12 cached rows. Changing races clears their
ownership. Sorting, course filters, search and pagination still use the existing
record model and revision cache. Text and accessible labels use the shared
translation-aware writers from Release 80.

An open detail dialog remains a reading snapshot. New answers update the overview
and expose the existing explicit refresh action without moving the teacher's
reading position. A retained detail button opens the latest records and remains
the focus return target when the dialog closes.

The existing speculative resource preloader now applies its 30-second failure
cooldown after an eight-second deadline or a streamed response exceeding 512 KiB.
Previously, those aborts skipped cooldown and could immediately repeat. Explicit
screen changes, hidden tabs and disposal remain cancellations rather than network
failures; a replacement screen can enqueue the same resource before the cancelled
request settles. The existing single-request, two-resource queue and 64-entry
history limits are unchanged. This does not delay a student's requested playback.

## Verification and limits

All 92 regression suites pass. Curriculum validation covers 17 profiles / 387
configured entries, including legacy overlaps, with zero errors and warnings.
New cases cover retained row/button identity, real answer updates, a stable detail
snapshot, course filtering, sorting, pagination, empty search and race replacement.
Preloader regressions cover timeout recovery after cooldown, streamed byte limits
and immediate requeue after explicit cancellation, alongside existing network and
disposal checks.

A local headless Chrome comparison used the actual record view, localization
observer and CSS with 35 synthetic students. With the English record overview
open, 100 score changes to an off-page student previously created 14,600 elements
and produced 7,400 observed DOM mutations. Both counts are now zero; the visible
row and focused detail button survive. Cumulative synchronous draw time in that
run was 430.7 ms before and 20.0 ms after. Latest-answer dialogs, reading snapshot
retention, per-course totals, three pages, empty search, Japanese restoration and
English overflow checks passed with no page execution errors.

These figures describe that fixed local fixture, not a whole-application speedup,
frame-rate guarantee or school-network measurement. Timings vary with machine and
browser load. Preload network failures use deterministic injected responses and a
fake clock. No production student data was used. The earlier Release 80 classroom
soak remains historical evidence and was not rerun for this presentation/preload
change. Run `npm run check` and `npm run content:check` for the automated checks.

## 日本語

2026年10月31日。データベース、採点、授業の操作手順は変更しません。保存済み記録と
Release 76の先生用ガイドは引き続き利用できます。

- 成績一覧の集計カード、復習ポイント、ページ切替ボタン、表示中の生徒行を保持します。
  得点だけの更新で表を作り直さず、参加者IDで行を管理します。保持する行は現在のページの
  最大12人分だけです。レースを変えると保持した行を破棄します。既存の集計、並べ替え、
  コース絞り込み、検索、ページ分割、日英切替を維持します。
- 詳細画面は読んでいる記録を保持し、新しい回答が届いても読み位置を動かしません。
  必要なときに既存の更新ボタンで最新の記録を表示できます。閉じると、元の生徒の詳細
  ボタンにフォーカスが戻ります。
- 先読みが8秒でタイムアウトした場合や、受信量が512 KiBを超えた場合にも、既存の30秒間の
  再試行待ちを適用します。画面切替や非表示による中止は通信失敗と区別し、次画面は同じ素材を
  すぐに先読み予約できます。同時通信1件、待機2素材、履歴64件の上限は変えません。
  児童が押した再生ボタンを待たせる変更ではありません。

回帰テスト92組が通過し、教材17設定・387項目の検査はエラー・警告ともに0件でした。
実際の成績画面と翻訳監視を使うローカルChromeで、35人の仮想データを確認しました。
表示範囲外の1人の得点を100回変更すると、従来は要素生成14,600件・DOM変更通知7,400件が
発生しましたが、いずれも0件になり、表示行と操作中のボタンが保持されました。同じ測定で
同期描画処理の合計は430.7 msから20.0 msになりました。

最新回答の表示、詳細の読み位置保持、コース別集計、3ページの移動、検索結果なし、
日本語への復帰、英語表示のはみ出しを確認し、ページ実行エラーは0件でした。
測定は固定したローカル条件によるもので、アプリ全体の速度や本番通信・実機での性能を
保証しません。先読みの異常系は模擬応答と仮想時計で検証しています。本番の児童データは
使っていません。Release 80の長時間検証は過去の結果であり、この変更では再実行していません。
