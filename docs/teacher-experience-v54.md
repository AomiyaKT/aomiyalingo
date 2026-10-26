# Teacher experience contract · v54

Audience: a teacher using a Windows computer connected to a television; students use iPads.
The teacher should not have to understand room IDs, persisted snapshots or internal race states.
This contract is the design baseline for subsequent changes, not a request for the user to audit
individual buttons.

## Interaction rules

1. Preparation is reversible and does not change a live classroom by itself.
2. Starting admission is an explicit action after content and rules can be reviewed.
3. Replacing a live lesson states which lesson will stop and what students must do next.
4. Pause preserves the same activity; finish saves its results; reset opens a new setup. Deletion
   remains a separate recoverable history-management action.
5. Finished activities present saved results and one clear path to the next setup, rather than
   displaying a stale student admission QR or silently starting another event.
6. Every setup has a return path; every consequential confirmation has a cancel path. Backing out
   of a setup does not undo the teacher's saved configuration or delete records.
7. Automatic polling may update activity data but must not close setup, rewrite an entered name,
   replace a focused control or apply an obsolete response to the current selection.
8. The interface remains Japanese/English. Existing rounded fonts, Duolingo-style color system,
   touch dimensions, reduced-motion and volume controls remain the shared design foundation.

## Teacher state/action matrix

| State | Primary task | Visible next action | Recovery |
| --- | --- | --- | --- |
| Login | Enter teacher password | Choose practice or race | Login errors remain beside input |
| First preparation | Choose curriculum, scope and rules | Start admission/class | Return to teacher home |
| Prepare next practice | Review new lesson without mixing old results | Start new class | Return to current class or its records |
| Existing class replacement | Understand which live class ends | Confirm new class | Cancel keeps the existing class active |
| Practice active | Show QR and monitor progress | Pause/end | Resume same class; next setup stays reversible |
| Practice paused | Explain while answers stop | Resume | End still saves records |
| Practice ended | Read saved learning results | Prepare new class | Explicit reopen remains distinct from new setup |
| Race lobby | Check attendance and readiness | Start | Reset requires confirmation |
| Race running/countdown/paused | Monitor/control event | Pause/resume/end | Reset confirms stop and opens setup |
| Race course break | Review podium | Start next course | Reset is separate from course progression |
| Race finished | Review results | Prepare next race | Old results stay in history |
| History management | Inspect/export/restore records | Select record or export | Delete remains in its own confirmed flow |

## Problems corrected in this pass

- Ordinary-practice preparation previously mixed the old class board and QR with the new form.
  It now uses the same focused preparation principle as race setup and has an explicit return.
- Ordinary-practice creation previously ended an active class immediately. It now captures the
  form values and asks before replacing the active class; double confirmation is guarded.
- Preparation previously hid the only practice rules entry. Its settings action is now inside
  the setup itself.
- Ended lessons/races previously continued to show their old student QR. Results now explain
  that records are saved and a new activity will provide a new QR. Race results include CSV.
- Race replay previously created a new event immediately. The finished-state primary action is
  now `新しいレースを準備`, leading to content/rule review. Reset remains available while live.
- Race preparation now closes when returning to results, preserves the selected curriculum/name
  when revisited, and keeps a custom name while refreshing saved rule summaries. First setup
  also has an explicit home return; results do not duplicate the preparation form.
- Practice headers now identify the selected class and explain the next step for setup, active,
  paused, admission-closed and ended states. Stale selected-class results are hidden while the
  latest class snapshot loads. The projection-only records toggle is hidden in ordinary view.
- The shared connection notice now expires after recovery even when healthy polling continues;
  a subsequent connection loss cancels that expiry and restores the warning.
- Removing the last saved practice class returns to usable preparation rather than leaving a
  closed form with no selected classroom.

## Acceptance coverage

Unit and delivered-bundle checks cover state transitions, active-class confirmation, immutable
form snapshots, duplicate submits, request failure/retry, stale poll responses, reset cancellation,
new room identity, preserved scores, classroom-bound QR and teacher/student access boundaries.
Browser QA follows first login, first setup, active practice, preparation/return, replacement
cancel/confirm, ended results, new setup, race setup and saved race results. The full regression
run also covers student attendance, avatars/readiness, question drafts, answer replay, three-course
transitions, personal clocks, pause/end, review and recovery.

Verified on 2026-10-23: all 43 regression suites and formatting passed. Local browser checks
covered setup/settings/return in both modes, replacement cancel/confirm, draft retention,
ended-result QR suppression, first-race home return and deleting the last practice class into
the recoverable class bin. No browser console errors were observed. Screenshots are retained
locally in `output/teacher54-practice-setup.png` and `output/teacher54-race-setup.png`.

This is a coherence pass, not a claim that every future usability problem has been eliminated.
Physical iPad interaction and the actual classroom television still require device checks.
