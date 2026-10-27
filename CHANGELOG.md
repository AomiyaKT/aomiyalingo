# Changelog

**English** | [日本語](CHANGELOG.ja.md)

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
