# Release 84 — reconnect with the same student number

## For teachers / 先生へ

After a lost browser session, students enter their original attendance number.
If it has already joined, select **Reconnect with this number / この番号で再接続**.
The message explains that the previous device will be disconnected. Saved
practice progress and race records continue under the same participant.
Existing participants can reconnect after new admission closes, while paused,
and to view an ended activity. This does not reopen admission or restart a timer.

通信切断などで参加情報を失った児童は、元の出席番号を入力し、
**「この番号で再接続」**を押すと、保存済みの続きに戻れます。
前の端末は接続が解除されます。新規参加を締め切った後や一時停止中にも、
参加済みの児童は戻れます。番号の確認だけでは前の端末を解除しません。

Only server-saved work can be recovered on a different device. An answer that
never reached the server may need to be entered again. Reconnection does not
refund disconnected race time or remove a teacher's pause/end state.

## Implementation and limits

- Both join endpoints return `409 DUPLICATE` without rotating a token. A second,
  explicitly selected request with `takeover: true` rotates the existing
  participant's bearer hash using its ID, prior hash and revision as a
  compare-and-swap guard. The revision increments; no participant row is created.
- Selection uses the activity ID and normalized number. The parent must still
  exist outside the recycle bin. New participants must satisfy normal admission
  rules; takeover cannot create a student or resurrect a deleted record.
- Race state is unchanged: score/history, avatar/readiness, order/seed, streak,
  items and joined-time origin survive. Course clock fields are not written.
- Practice keeps the existing lesson. Revision-guarded answers and bearer-guarded
  start/label writes prevent an already-authenticated old request from changing
  progress after replacement. The legacy teacher-approved recovery route remains.
- Browser recovery is explicit, not triggered by polling failures. Duplicate UI
  confirmation is scoped to the number/activity and cleared when either changes.
  The old page's cache writes/removal cannot replace or delete a newer token for
  the same race/number. Stale practice pending answers are discarded only when
  they no longer match the restored server question.
- Attendance numbers are classroom identifiers, not private passwords. This
  feature intentionally permits a student who knows the activity link and number
  to replace that participant's connection. It is not strong personal identity.
- Existing audio preparation remains required. Handwriting and TTS samples are
  not included in this release. No schema migration is required.

## Verification

HTTP regressions cover both modes, closed admission, pause/end, preserved state,
unchanged race clock, revoked credentials, no duplicate participants and competing
takeovers. Storage regressions cover stale-tab token overwrite/removal. Browser
checks use separate local browser contexts; physical iPad/school-network testing
remains a separate check.
