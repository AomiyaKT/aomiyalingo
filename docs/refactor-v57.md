# v57 · Application composition and teacher-side maintenance

This is an internal refactor of application assembly, teacher control ownership and
repeated analysis work. Authentication, stored classroom/race snapshots, grading,
scoring, station barriers and answer retry receipts retain their existing contracts.

## Module boundaries

- `server/application.mjs` imports and composes the runtime services directly.
- `worker.mjs` creates the HTTP router from explicit dependencies, independently of
  the build and legacy browser-global names.
- `build.mjs` retains a small catalog compatibility adapter; it no longer injects
  Worker source or service composition as strings.
- `public/race/teacher-controller.js` owns teacher setup, rule summaries, confirmation,
  history selection, reset and race lifecycle writes. The student entry does not
  initialize it.
- `public/practice/teacher-analysis-model.js` produces indexed word/mode counts;
  `teacher-analysis.js` renders the model and learner details. Unchanged polls preserve
  the existing reading DOM.

The race entry lost approximately 300 lines of teacher-only concerns, and the ordinary
teacher entry lost over 100 lines of detail/mastery rendering. The extracted code
remains in dedicated modules; line movement alone is not a performance claim.

## Correctness improvements found during extraction

Teacher rule-summary reads now coalesce. If settings are saved while an old request
is pending, the old result cannot overwrite the new summary. Confirmation actions
retain the race they originally referred to, including the start action when another
race becomes selected. The end action now uses the same busy/epoch gate as the other
lifecycle writes. Failed commands keep their existing retry/error behavior.

The initial race title follows the selected curriculum instead of a hardcoded legacy
Unit 4–5 label. Existing completed results remain recoverable when resetting to setup.

## CPU measurements

Run `npm run benchmark:models` to compare the old algorithms with the new pure models
on identical local synthetic input. The script checks equivalent output before timing.
It uses 15 warm-ups and 120 samples with Node 24.22.1 on this Windows host.

| Workload | Previous median / p95, ms | Current median / p95, ms |
| --- | ---: | ---: |
| 35 learners × 80 words × 10 modes: mastery aggregation | 15.162 / 22.442 | 3.841 / 6.173 |
| 35 support-level calculations over 10,000 history entries | 8.671 / 13.231 | 0.002 / 0.029 |

The second workload deliberately tests long histories. The new function still scans
past review entries when needed; a history consisting entirely of reviews can require
a full scan. There is no persistent history cache, and no stored answers are dropped.
For an ordinary history with enough recent main answers, only eight main entries are
needed. The first station requires no history scan.

These are local CPU timings, excluding DOM rendering, network, database and production
Worker behavior. They are not whole-application speedups. The existing 35-learner race
benchmark remains a control workload: this pass does not change its ranking algorithm.
Raw local reports are written under ignored `output/` when `--output` is specified.

## Verification

The three new suites verify direct ESM application startup with isolated catalogs,
assets and sessions; rule request coalescing/staleness; pinned confirmation targets;
write exclusion; failed-command recovery; stale current/history polls; reset; exact
mastery/level equivalence; sparse skills; bounded recent-history reads; detail/mastery
DOM identity; and invalidation for changed answers/classes/selections.

Local browser rehearsal covered teacher login and race creation, student attendance,
avatar readiness and briefing, teacher start, a correctly graded pair answer, pause,
reset to setup, and reopening the preserved 100-point result. Ordinary practice was
also rehearsed with three saved synthetic answers and the opened learner detail.
No production classes or student records were created for these checks. This was a
desktop browser rehearsal, not a physical classroom/iPad load test.
