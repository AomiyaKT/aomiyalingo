# Changelog

**English** | [日本語](CHANGELOG.ja.md)

## Release 81 - 2026-10-31

- Retain visible race-record rows, summary cards and pagination controls during live refreshes. Score-only changes no longer detach detail buttons or create unchanged table elements; row retention is bounded to the current 12-person page.
- Preserve open detail snapshots and shared Japanese/English presentation while updating actual answer values, course scopes, sort order and search results.
- Apply the existing preload failure cooldown to deadline and streamed-size aborts. Explicit screen cancellation remains immediately retryable, including requeue before the cancelled request settles.

Measurements and verification scope: [Release 81](docs/release-81.md).

## Release 80 - 2026-10-31

- Stop rewriting translated standings, participant labels, practice rosters and accessibility copy on unchanged English polls. Both modes reuse one shared translation-aware writer; the practice helper remains a compatibility export.
- Keep the race room, board and student self state aligned when another request advances a course or updates readiness between database reads. Revalidate participant rows after conflicting automatic course closure.
- Preserve scoring, stored records, authorization and pending-answer behavior. Regression coverage includes both successful and superseded course-close races, current readiness, and 100 unchanged English tower refreshes.

Measurements and verification scope: [Release 80](docs/release-80.md).

## Release 79 - 2026-10-30

- Unified start, pause/resume, course transition and end policies. Student lifecycle cleanup stops audio, feedback timers, roulette and transient presentation while preserving an answer during a pause.
- Gave pending answers one request owner and captured credential. Obsolete polls, replies and recovery attempts cannot replace a newer course or release a newer submission's busy state.
- Shared owned playback between questions and review. Leaving a review screen or changing its card invalidates obsolete audio callbacks.
- Preserved remaining/elapsed time when replacing an unfinished race, preventing an early final-course cancellation from appearing as a normal course clear.
- Refined compact 35-student TV columns and QR heading alignment; QR images now fit their panel width.
- Fixed classic race spelling for punctuated words such as `P.E.`, retaining existing answer compatibility and using the shared spelling formatter.
- 92 regression suites passed. Local browser QA covered 35-student TV boards, Japanese/English layouts, iPad portrait/landscape and a short-height viewport. No scoring or schema changes; both 15-page Release 76 teacher guides remain applicable.

Details: [Release 79](docs/release-79.md).

## Release 78 - 2026-10-29

- Fixed modern lobby readiness: students who have not pressed Ready retain their personal time when the teacher starts early. Avatar changes require preparation again; saves disable Ready until acknowledged. Old API join behavior stays compatible.
- Made course transitions validate the full racer revision/count snapshot before advancing the room, preventing partial transitions on concurrent player edits.
- Corrected avatar/readiness revision acknowledgements, non-JSON HTTP error handling, corrupt saved-session recovery, review-summary invalidation, obsolete review audio callbacks and clock redraw invalidation.
- Corrected English provisional ordinals, pre-start grammar and opaque teacher titles in lobby/late-entry messages.
- 88 regression suites passed, including reproductions that failed against the original source. Local browser QA confirmed early teacher start, preserved preparation time, Ready and question entry. No schema or scoring changes; existing teacher guides remain applicable.

Details: [Release 78 fixes](docs/bugfix-78.md).

## Release 77 - 2026-10-29

- Reused personal-clock nodes and second-level display state instead of querying the entire timing tower every quarter second. Batched rank layout reads before animation writes and removed unchanged avatar position writes.
- Added bounded browser-local translation reuse and deduplicated nested mutation scans. Preserved language switching, draft values and opaque learning content.
- Coalesced small packed-speech expansion across simultaneous students, using the existing 4 MiB LRU with expanded-byte accounting, 256 KiB per entry and eight pending shared expansions. Kept exact bytes, validators, HEAD/304, large-file streaming and retry after failures.
- Minified delivered browser JS/CSS using esbuild and retained content-hash cache invalidation. Temporary failed speculative resources may retry after 30 seconds.
- 84 regression suites passed; local 35-student and late-joiner browser QA covered clocks, English UI, pause/resume, readiness and answering. No schema, scoring or teacher workflow changes. The 15-page Release 76 guides remain applicable.

Details and reproducible measurements: [Optimization 77](docs/optimization-77.md).

## Release 76 - 2026-10-29

- Replaced the long combined material dropdown with Elementary school / Blue Sky, grade buttons and eight grade-specific units. Practice, race and material editing use one picker; saved profile IDs and legacy sessions remain compatible.
- Added Combo Shield, Swap Card, Treasure Challenge and Catch-up Magnet (ten items total). Item settings, roulette, active effects, scoring, course podiums and Japanese/English explanations are connected. Default six-item selections expand; restricted teacher selections remain restricted.
- Added teacher update checks under gear > Status. The server reads public GitHub release/version metadata without forwarding credentials or student data. Reloading requires a newer already deployed server version and passes live class/race, version and unsaved-work guards. GitHub-only releases are shown as awaiting deployment.
- Cached immutable race task JSON in a bounded exact-content LRU, serialized player saves once, and avoided parsing/writing unchanged practice content and translated labels. Live authorization, player state and timers remain uncached.
- Expanded both teacher PDFs to 15 pages, with all ten items, the new material picker and an accurate explanation of update/deployment boundaries.
- 81 regression suites passed. Rendered and visually reviewed all 30 guide pages. GitHub publication does not redeploy the hosted app or change its database.

Details: [Release 76](docs/release-76.md).

## Release 75 - 2026-10-27

- Rewrote the Japanese teacher guide and added an English edition, 11 pages each, with large text, numbered steps and clickable app links.
- Updated coverage for all Grade 5/6 units, ten question types, three endless race courses, scoring/items, late joining, pause/end/reset, CSV, recycle/permanent deletion, content checks and backups.
- The gear Help button opens the guide matching the interface language: Japanese by default, English when selected.
- Rendered and visually reviewed all 22 pages. All 75 regression suites passed, including exact Worker delivery of both PDFs and language fallback checks.
- Added a repeatable Python PDF generator. Classroom scoring, rules, learning progress and stored records are unchanged.

Technical notes: [Release 75](docs/release-75.md).

### Repository documentation correction - 2026-10-27

- Replaced the Chinese repository overview and release history with English documentation and complete Japanese editions.
- Added reciprocal language links and direct links to both teacher PDFs. This documentation-only update keeps the application at Release 75.

## Release 74 - 2026-10-27

### Teaching tools and backups

- Added Content check and Backup & restore under gear > Status, in Japanese and English.
- Content checks flag duplicate choices/meanings, missing pictures/audio, shared pictures, target-word and basic sentence-format issues. They do not rewrite materials.
- JSON exports include all configured materials, examples, practice/race rules and referenced custom recordings. Imports preview counts before confirmation.
- Restores use revision guards and atomic writes, roll back on failure, automatically retain the previous settings, and preserve classroom/race snapshots.
- Added a complete-project ZIP script with SHA-256 verification for source and media. Hosted use still requires internet access.

### Interface and performance

- Race controls emphasize Start, Pause/Resume, End or Next Course by stage. End stays beside Pause; joining/reset controls sit with the QR.
- Practice setup appears during preparation, while a live class emphasizes student progress. Preparing another class remains available.
- Student polls reuse unchanged answer histories, tasks and learning summaries. Scores, personal timers and standings stay current; first loads or cache misses receive full data.
- Prefetch warms at most two same-origin next-task resources, one low-priority transfer at a time. It stops on hidden, offline, save-data or weak-network pages and has size/time limits.
- In a synthetic 180-answer fixture, an unchanged student response dropped from 20,306 to 2,313 bytes, about 88.6%. Actual sizes depend on classroom data.

### Verification

- 75 regression suites passed; 17 profiles / 387 configured entries passed media/content checks without errors or warnings.
- Accelerated 30-minute, 35-learner simulation covered practice, three endless race courses, ten question types, late joining, pause, items, offline polls and lost-acknowledgement retries.
- 30,452 requests, 3,209 race answer submissions, 200 replays and zero unexpected errors.
- These are local API/SQLite results using a simulated clock, not physical iPad, school network, browser frame-rate or 30-minute wall-clock measurements.

Technical notes: [Release 74](docs/release-74.md). Application source: `b6fd2f22d5c7d96d20e3bdec46022a5447a51a2b`.

## Release 73 - 2026-10-27

- Added teacher incremental record synchronization so unchanged answer histories are not repeatedly transferred.
- Polling waits for an in-flight request, adapts to race stages, pauses while hidden, backs off on failure and refreshes on foregrounding.
- Reused DOM nodes for standings, scores, participant counts and podiums; reduced redundant rendering and localStorage writes.
- In a synthetic 35-learner x 180-answer fixture, an unchanged teacher response dropped from 872,652 to 2,832 bytes. This is fixture data, not classroom network throughput.

Technical notes: [Performance 73](docs/performance-73.md).

## Release 72 - 2026-10-27

- Completed Grade 5 Units 1-8: 159 vocabulary entries with 159 pictures, 159 recordings and example sentences.
- Integrated the material into practice, races and editing while retaining Grade 6 and legacy class compatibility.
- Added lossless WAV packing to reduce the Worker size without changing decoded audio.

## Release 71 - 2026-10-26

- First complete GitHub application snapshot: Grade 5 Unit 5, Grade 6 Pre Unit-Unit 8, ten question types, practice/races, Japanese/English UI and teacher guide.
- Initial application commit: `517fa18be8cf8955250c9f481ae32891cad8dd38`.
