# Release 79 — race lifecycle and classroom layout / 状態管理と授業画面

30 October 2026. No scoring-rule changes or database migration. Existing records
remain compatible; both 15-page Release 76 teacher guides still apply.

## Behavior and ownership

- One transition policy handles start, pause/resume, next course and end. Automatic
  course completion uses the same course-end decision at both server call sites.
- Student phase boundaries own audio, feedback timers, roulette, resource preloads
  and transient presentation. Pause preserves the draft and durable pending answer;
  switching course/racer clears the old screen's transient state.
- One answer controller captures the sending credential and navigation epoch,
  excludes duplicate submissions and recovers from authoritative server state.
  Stale success/failure/finally handlers cannot mutate a later flight. Page mutation
  responses invalidate older polls before updating the screen.
- Questions and review reuse scoped playback. Leaving review, switching cards or
  suspending the student screen stops playback and invalidates obsolete errors.
- Replacing an unfinished race preserves its stopped remaining/elapsed clocks.
  Cancelling the final course early no longer produces a normal course-clear event.
- Classic spelling accepts the authored punctuation in `P.E.` using the existing
  spelling formatter, while retaining the legacy accepted-answer format. Incorrect
  but valid letter answers still receive normal incorrect-answer feedback.

## Layout

The live teacher board uses compact columns for a 35-student classroom, retaining
attendance numbers, personal clocks, current question types and scores. QR images
fit their available panel width. Shared QR heading rows align the title and help
control without negative positioning offsets. Larger text and larger classes remain
scrollable rather than being clipped to a fixed screen height.

## Verification

92 regression suites passed, including lifecycle
transitions, answer/poll ownership, pause/retry/course isolation, stale audio and
early replacement. Run `node scripts/check.mjs` from the project root.

Local browser measurements (standard text size):

| Viewport | Observed result |
| --- | --- |
| Teacher 1366×768, English | All 35 rows in four columns; 52px rows; last row bottom 741.4px; no horizontal overflow. |
| Teacher 1920×1080, Japanese | All 35 rows; 64px rows; last row bottom 849.4px; responsive 220px QR; no horizontal overflow. |
| Student 768×1024 / 1024×768 | Practice picture choices, race long-word spelling, pronunciation and successful answer feedback checked; no horizontal overflow. |
| Student 1024×480 | Scrollable question with an 84px fixed action bar from y=396 to 480; no horizontal overflow. |

The existing viewport regression covers visual-viewport keyboard insets and input
reveal. The short-height browser check does not reproduce a physical iPad keyboard.
These checks do not establish physical iPad, television, classroom Wi-Fi or
frame-rate performance. Only disposable local preview records were used.

## 日本語

2026年10月30日。採点方式と保存形式は変更しません。既存の記録と、各15ページの
Release 76日英先生用ガイドを引き続き使用できます。

- 開始・一時停止・再開・次コース・終了の判定を共通化し、自動終了時のコース判定も
  サーバー内で共有します。
- 学生画面の段階切替で、音声、回答後のタイマー、道具抽選、先読み、演出をまとめて
  後処理します。一時停止では入力中・未送信の回答を保持し、コースや参加者が変わると
  前の画面の一時状態を解除します。
- 回答送信は1つの管理処理が担当し、送信時の認証情報と画面の世代を保持します。
  古い応答や復帰処理は、新しい送信や画面を書き換えません。操作後の応答を反映する前に、
  それより古い定期更新も無効にします。
- 問題と復習の音声管理を共通化しました。カード切替や画面を離れた際は再生を停止し、
  遅れて届いた音声エラーを無効にします。
- 途中で新しいレースに切り替えた場合は、前の時計を止めた時点の値で保存します。
  最終コースの中断を通常のコースクリアと誤認しません。
- `P.E.` の句読点を共通のつづり整形処理で正しく扱います。従来の回答形式との互換性を
  保ち、有効な文字で作った不正解には通常の不正解フィードバックを返します。
- 35人向けテレビ順位表の列を整理し、出席番号、個別時計、問題の種類、得点を保ちます。
  QR画像は幅に応じて縮小し、見出しとヘルプの位置を共通の行でそろえます。
  大きな文字設定や人数の多いクラスでは、内容を切らずスクロールできます。

回帰テスト92組が通過しました。標準文字サイズで、35人の教師順位表は1366×768では
行高52px・最下部741.4px、1920×1080では行高64px・最下部849.4pxに収まりました。
学生画面は768×1024・1024×768の練習問題と長い単語のつづり、発音、回答保存を確認。
1024×480でも84pxの操作バーを保持し、横にはみ出しません。
キーボードの表示領域と入力欄の追従は既存の回帰テストで検証しています。高さの小さい
ブラウザー画面は実機のソフトウェアキーボードを再現しません。ローカルでの確認は、
実機iPad、テレビ、学校のWi-Fi、描画速度の実測を置き換えるものではありません。
