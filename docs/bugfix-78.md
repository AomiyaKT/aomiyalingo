# Release 78 - classroom bug fixes / 授業中の不具合修正

29 October 2026. No schema migration or scoring-rule changes.

## Fixed behavior

1. **Unprepared students losing answer time:** current browser joins explicitly request preparation. Entering the lobby no longer makes the student ready automatically. If the teacher starts early, that student keeps choosing an avatar and receives their full personal time after pressing Ready. Older API clients retain their existing join behavior.
2. **Avatar changes leaving a student marked ready:** changing an avatar in the modern lobby now clears both preparation and readiness. The Ready button is disabled while an avatar save is in progress, preventing an apparently clickable but ignored action.
3. **Partial course transitions:** a racer revision could change between the teacher reading the room and the next-course batch. The prior batch could advance the room and some students, then return 409. The room transition now validates the complete participant count and revision snapshot before any dependent player updates. Conflicts leave the course unchanged and are retryable.
4. **Outdated synchronization keys:** successful avatar and readiness responses now advertise the revision actually saved, including late-entry readiness. Subsequent compact polling uses that exact revision.
5. **HTTP error pages treated as offline:** HTML, invalid JSON or null bodies on failed HTTP responses no longer erase the status code. Expired/deleted sessions can follow their normal recovery path. Malformed successful payloads are rejected; valid error messages and codes remain intact.
6. **Corrupt saved-session data blocking re-entry:** non-object roots, invalid entries and mismatched race/number indices are ignored safely. Invalid entries no longer break sorting or writes. Unchanged valid sessions still avoid repeated localStorage writes, and saved pending answers remain durable.
7. **Stale course summaries:** unchanged review cards no longer freeze changes in points or answer summaries. Summary refreshes preserve the student's selected review card.
8. **Obsolete review audio errors:** switching cards or leaving review invalidates pending playback callbacks, pauses audio and clears old playback messages. A failed old playback cannot display an error on a later card; current errors still appear.
9. **Personal timer text left stale after a board redraw:** timer references revalidate their last output once per server snapshot. Repeated quarter-second ticks still perform no unchanged DOM work.
10. **Incorrect English ordinals:** provisional ranks now show 1st/2nd/3rd/11th/12th rather than forms such as “1 place”. The pre-start confirmation also avoids singular/plural grammar errors.
11. **Teacher titles partly translated:** lobby and late-entry messages now treat the entire custom race title as an opaque value, including titles containing Japanese number/unit words. Lobby preparation uses the normal avatar instructions rather than the late-entry explanation.

## Verification

88 regression suites pass. Four new suites cover HTTP error-body recovery, explicit preparation, atomic course transitions and the review UI. Existing suites were expanded for timer redraws, corrupt localStorage and English text.

The original source was exercised before repair: the error-body, unprepared-lobby and concurrent-course tests all failed at their expected assertions. The repaired source passes those reproductions and the full ordinary-practice/race regression run. The transition test injects a participant revision change immediately before the database batch, verifies that neither the room nor other players advance, then verifies a successful retry.

Local browser QA verified that a student still choosing an avatar stays on that screen with 6:00 personal time after the teacher starts early. Pressing Ready then starts that student's answer clock and opens the question. English custom titles remained intact; teacher and student browser logs contained no errors. Tests use disposable local data and do not establish physical iPad or school Wi-Fi performance.

Run `node scripts/check.mjs`. No production records are reset by this update. The existing Japanese/English teacher guides remain applicable.

## 日本語

- 待合室に入っただけで回答時間が減る問題を修正しました。現在の学生ページでは、先生が先に開始しても、本人が「準備完了」を押すまでアバター選択を続けられ、押してから個別の回答時間が始まります。
- 待合室でアバターを変更した場合は準備状態も解除し、保存中は準備ボタンを押せないようにしました。アバター・準備操作の応答は保存後の版番号を返します。
- 次のコースへの切替時、同時に学生情報が更新されると一部だけ進む問題を修正しました。全員の版番号を先に確認し、競合した場合は元のコースを保ったまま再試行できます。
- サーバーのエラー画面を単なる切断と誤認する問題、壊れた端末内キャッシュで復帰できない問題を修正しました。
- 復習画面の得点表示が古いままになる問題、前のカードの音声エラーが後のカードに出る問題、順位表の再描画で個別時計が古い表示になる問題を修正しました。
- 英語順位の序数、開始前の英文、途中参加案内に含まれる先生の独自タイトルを修正しました。

88組の回帰テストに合格。修正前に3つの主要な不具合をテストで再現し、修正後に同じ再現テストと全体テストを通しています。ローカルのブラウザーでも未準備のままの開始、本人の準備完了、個別時計と問題画面を確認しました。採点方式、保存形式、本番の成績は変更しません。
