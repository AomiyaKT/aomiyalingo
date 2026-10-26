# Code optimization audit · v52 · 2026-10-23

This release makes ordinary-practice teacher refreshes incremental. It preserves the current
layout, classroom/race rules, student records, authorization and public URLs.

## Teacher roster

`public/practice/teacher-roster.js` owns roster DOM nodes by classroom and student ID. Polling
updates only changed text, attributes, classes and progress widths. Unchanged rows stay attached,
so the teacher's focused answer-history button survives automatic refreshes. Learner removal
releases its row; switching classes resets ownership, even if a student identifier is reused.
The roster follows server order without recreating its controls. Empty progress is rendered as
0% rather than an invalid width.

The ordinary teacher coordinator now uses the same bundled ESM development pattern as the race
and student coordinators. The delivered `/teacher.js` URL remains a classic browser script.
Its HTML cache marker advances to `classroom52a`; other unchanged assets keep their markers.

The class teaching summary and wrong-answer list are calculated once per board response and
shared by the normal and projection views.

## Refresh isolation

Changing the selected class invalidates an in-flight board request. Both stale success and stale
error responses are ignored, including old 401 responses that previously could hide the current
teacher board. The latest selected class refreshes as soon as the previous request settles,
without waiting for the next three-second interval. At most one progress refresh runs at once.
Authorization failures from the current request still close teacher access.

## Deterministic verification

- A synthetic 35-student roster's unchanged poll allocates **zero** nodes, performs **zero**
  text/attribute/class/style writes and performs **zero** row attachments. This is a DOM-operation
  count, not a browser frame-time, CPU benchmark or production load guarantee.
- Tests cover changed progress, current exercise, accuracy, support counts, attendance labels,
  accessible button labels, activity aging, reordered/deleted learners, empty classes and class
  ownership changes.
- The actual delivered teacher bundle is executed as a classic script with held-open requests.
  Tests cover switches overtaking successes/errors, immediate follow-up, in-flight deduplication
  and current versus stale authorization failures.
- All **40 regression suites** passed; production build and formatting checks passed.

Browser QA uses disposable local classes with 35 and 3 learners. It verifies teacher login,
class switching, the populated table, answer-history opening and focus retention across polling.
Production classroom data is not used by this rehearsal. Physical iPad and TV checks are outside
the scope of this internal refactor.

Source, logs, screenshots and delivery files remain under `F:\gpt ojosama\Aomiyalingo`.
