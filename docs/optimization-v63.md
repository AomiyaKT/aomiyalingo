# v63 · Race polling, export and practice audio

This pass preserves question content, layout, scores, timing rules, persisted
records, database schema and public response fields.

## One race snapshot per student poll

Previously `/api/race/me` built a board, reloaded its room, then built another
board inside `raceSession`, finally replacing the second board's player list with
the first. The service now owns a private room/board snapshot. Sessions derive
their board and self/task fields from the same authoritative room, including any
reload after an all-done revision check. Teacher `raceBoard` responses retain
their existing structure; raw room fields are never added to the public payload.

The `race-server-work` test instruments SQL execution with 35 synthetic learners.
The old orchestration reads the full roster twice per poll; the new one reads it
once. An unchanged room also needs one room lookup instead of two. Transition
reloads remain, and polling never writes racer state. Public polls also avoid
building the private ID lookup needed only by teacher record responses.

Checks cover lobby, countdown, running, paused, intermission, finished, finite
and endless races, late entrants, expired clocks, all-done course transitions,
deleted rooms and authentication guards. A teacher pause that wins the revision
check remains paused in the resulting session. Expiry still closes the course
when late entrants have not pressed ready.

## Linear CSV history work

Per-player answer counts and formatted accuracy are computed once before that
player's answer rows are emitted. In a fixture with one 180-answer learner and
one empty learner, station-race export reduces history filters from 360 to 2.
The scan work is linear in history length rather than quadratic. CSV bytes match
the reference exactly, including review/hint rows, the historical index guard,
endless course resets, Japanese headings, quoting, line breaks, BOM and formula
escaping. Legacy races require no history filter in either implementation.

## Practice playback ownership

Classic speech completion/error handlers and recorded `play()` rejections now
use the same operation ownership guard as rich exercises. It captures the serial,
state object, question and task ID. Stop detaches legacy speech callbacks before
canceling speech. Already queued old callbacks are also rejected by the guard.
Current playback errors remain visible, and voice selection, rate, volume,
hint tracking and pause controls retain their existing behavior.

The practice audio test exercises delayed old callbacks after new playback,
replaced questions, canceled exercise speech, late recorded-play rejection,
current failures and successful completion. These are deterministic regression
checks; SQL/filter counts are not whole-app speed percentages or classroom
network latency measurements.

## Full validation

`node scripts/check.mjs` passed syntax checks, a fresh 550-asset Worker build and
all 62 regression suites, including the 35-person classroom/race rehearsal.
Changed source and test files pass formatting checks; `git diff --check` is clean.
