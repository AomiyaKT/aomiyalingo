# Race reset · v53 · 2026-10-23

The teacher's race controls now include `レースをリセット` beside the existing controls.

- Finished races open a focused new-race setup without a server write.
- Lobby, countdown, running, paused and intermission races require confirmation. Confirming
  ends the selected race through the existing authorized endpoint, then opens setup.
- Canceling confirmation keeps the race active. A failed end request leaves the teacher in
  the current view and displays its error. The confirmed race ID is captured independently of
  later polling/history selection.
- Setup supports curriculum, name and the existing rule editor. Polls retain the setup view
  and edited form fields. `前の結果に戻る` restores the saved result view.
- Starting admission creates a new race ID, empty roster and its own student QR. Previous
  scores and answers remain in history; reset never calls a delete endpoint or overwrites an
  old learner state. Students join the new race with its new QR.

`public/race/reset.js` owns this small interaction state; authoritative race lifecycle and
scoring remain on the server. The browser cache marker advances to `classroom53a`.

Verification: all 41 regression suites passed, formatting and production build passed. The
reset suite covers all lifecycle states, confirmation/cancel, request failure, busy guards,
captured IDs and preservation of historical participants when a new room is created.
Final focus/scroll adjustments were rebuilt and the reset/student-bootstrap suites rerun.
Browser QA in an isolated local race covered canceling confirmation, resetting a live scored
race, persistent setup/name through polls, returning to the saved 100-point result, resetting
a finished race without a confirmation, changing to grade 5 and creating an empty new lobby
with a different QR. No console errors were reported. No production race was reset during QA.
