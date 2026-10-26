# Aomiyalingo classroom

## Current practice · v47

New classrooms created in the teacher UI default to step-up practice: word recall,
sentence building, then listening. Each word still has three main encounters, so
the built-in courses contain 60 questions (grade 5 Unit 5), 84 (grade 6 Units 4–5),
or 72 (grade 6 Unit 7), before bounded recall. Short rounds remain six or eight
main questions plus at most two recall questions. Ten exercise types are spread
across the course, rather than assigning ten questions to every word.

Matching, sentence ordering, sentence gaps, audio matching, audio sentence ordering,
audio gaps and dictation join the existing meaning, listening and spelling types.
Recent independent answers adjust support. Hints remain explicit and are recorded.
Pair selections, sentence tiles and typed drafts survive reload. Teacher histories
and CSV show the richer answers and expected corrections; unassigned word/type
combinations are not presented as missing student work.

Choose the classic format in the mode's settings to keep the three basic types.
Existing classrooms retain their saved queues; new types apply to newly created
step-up classrooms. No database migration or reset of existing records is needed.

The shared exercise model and controller serve both ordinary practice and races.
The regression run has 33 suites; `practice-adaptive.test.mjs` covers all three
curricula, support levels, bounded rounds, malformed answers, idempotence, focused
review, teacher records, CSV and legacy classes. Browser QA covers matching,
sentence drafts, audio-gap typing/hints and reload. Real iPad speech voices and
keyboard behaviour still require a device rehearsal.

Keep the project folder on F:. Source is in `Quiz_Online`, delivery packages in
`Quiz_Share`, and extracted game art in `Extracted_Assets`, all inside the same
`Aomiyalingo` folder. Packaging uses these relative locations, so moving the whole
folder does not break it. Shared development runtimes remain installed separately.

The current teacher PDF includes the step-up practice and four-type race guides.
The website's settings link and teacher delivery package contain the same guide.

Student entrance: /?student=1. The existing share QR is unchanged. Students first confirm the classroom and attendance number. Teacher entrance: /teacher, using the existing runtime TEACHER_PASSWORD secret. The live board polls every three seconds while visible and supports projection mode.

## Short lessons
The full course covers 19 words in meaning, English listening and letter spelling (57 base questions). New classrooms default to six base questions per lesson; teachers can select eight. New courses schedule mistakes and prompted answers two stages later, adding at most two recall questions to each round; the last round can include up to two remaining checks. Every round still reaches a break even if every answer is wrong. Existing v2 courses retain their original immediate review policy. The course path previews the next words with pronunciation. The wordbook is secondary; extra spelling practice becomes available after completion. Completed courses also offer a focused review containing only the remaining word/mode pairs; first-attempt history is preserved. Previously saved version-1 courses keep their original IDs and completion rules until completed or explicitly restarted.

## Saving and identity
D1 stores classroom records and authoritative student progress. A random student token persists in localStorage, allowing a new tab on the same device/browser to resume. Selected options, their order, spelling letters and unsent submissions persist locally. Failed uploads are retried after connectivity returns or through the retry button; question IDs prevent duplicate scoring. A teacher must approve a different-device transfer for an existing attendance number; approval revokes the previous device token. Students can correct their attendance number without resetting their history, unless another student already uses that number.

## Teacher controls and diagnostics
Stop accepting joins, pause practice and end the classroom are independent actions. Ending/reopening has a cancelable confirmation. Resuming preserves progress. Creating a new classroom ends the prior active classroom and preserves its records. Teachers see first-attempt accuracy, corrected items, remaining difficulties, word-by-mode status, hint use and exact answers. The authenticated CSV export includes those summaries. A corrected answer never overwrites the first-attempt result. A first-letter hint is optional and survives reload. Spelling feedback marks the differing positions. Correct answers with hints are distinct from the latest independent correctness in the board and CSV. There is no public endpoint for other students' records.

## Development
Run npm ci, npm run build, then node tests/classroom.test.mjs. Generate Drizzle migrations only when changing db/schema.ts; never modify applied migrations. Set TEACHER_PASSWORD in the process environment and run node dev.mjs for an isolated in-memory preview on 127.0.0.1:8767. POST /__dev/fail-next-answer injects one temporary answer-save failure for testing; dev.mjs is not deployed. Production uses durable platform D1.

public/ contains the source assets; build.mjs embeds them into dist/server/index.js for a dependency-free Worker. Publish with the Sites workflow helper, which packages Drizzle migrations. The offline editor in ../Quiz_Demo is separate.

## Validation
The backend suite covers all 57 questions, all-wrong bounded completion, legacy progress, class controls, transaction failure/retry, access isolation, attendance correction, approved device transfer, first-attempt diagnostics, hints and CSV. Browser QA covers a seven-answer round including a corrected error, selection/spelling draft recovery, save failure followed by reload, teacher diagnostics, device transfer/revocation and an 820 × 1180 viewport. Physical iPad/multiple-device classroom testing remains separate.

## TV projection polish
Projection hides attendance numbers, recovery requests and individual answer histories by default. Teachers must confirm that individual records will also appear on a mirrored TV before revealing them, and can hide them again. Projection shows QR, class status, average progress, stage populations and three priority words. Teaching priority counts unique learners per word, prioritizing unresolved errors, first errors and prompted correctness. Recent activity is explicitly labeled as activity, not guaranteed connectivity. A compact layout handles lower effective Windows resolutions.

Run node tests/learning.test.mjs for spaced recall, bounded rounds, v2 compatibility, hints, exact-mode focus review and unique-person teaching priorities. The classroom suite also submits thirty independent simulated learner sessions concurrently. node tests/preview-seed.mjs creates disposable data against localhost only for visual QA. Actual Windows-to-TV and physical iPad classroom testing cannot be replaced by these simulations.

## Visual polish

Shared `public/polish.css` unifies Japanese typography, button depth, neutral borders and touch sizes. Student prompts, choices and letter banks retain their existing behavior. Spelling shows the next empty slot and keeps long answers in one horizontally scrollable row. Audio playback buttons avoid overlapping click effects; interaction transitions are shorter and respect reduced-motion preferences. Classroom data and authentication are unchanged.

Visual audit: entry cards now explicitly own their foreground/background colors and grid alignment. Book, teacher and arrow icons share SVG sizes; settings, restart and pronunciation controls use centered flex frames. Result states override selection colors. Range tracks and settings switches have consistent browser-independent styling. Student pages were walked through on an 820×1180 viewport (including all three question types and a round-complete screen); teacher login and projection were checked at 1536×864. These are browser viewport checks, not physical device tests.

## Assigned classroom practice and recycle bin

When creating a classroom, choose all 19 words, the 11 past-tense verbs, or the 8 adjectives; select at least one of meaning, listening, and spelling. Defaults preserve the original lesson. The assignment is stored on the classroom and enforced by the server when joining, resetting, or reviewing. Existing queued questions are preserved. Student wordbooks and teacher diagnostics/CSV follow the assignment.

In normal teacher view, expand 「記録の管理」 below the progress table. Deleting one student or clearing the current class moves participation and its attempts into 「回収箱」. Hidden records do not count toward progress, summaries or CSV, and their device sessions cannot write. Restore an individual item or a whole-class item through its confirmation dialog. Restoration retains the saved lesson and answers; the previous device can reload and continue. It never overwrites a newly joined student with the same attendance number: resolve that conflict first. Classroom controls and other classrooms are unaffected. Device-transfer requests are cancelled when records are recycled, so previous requests cannot capture a new student with the same number. Record management is hidden in projection mode.

Deletion/restoration are teacher-authenticated same-origin operations, scoped to exact classroom and record IDs and committed atomically. Partial unique attendance indexes apply to visible records. Drizzle migration 0002 adds backward-compatible classroom defaults and recycle-bin state without deleting existing scores. Earlier hard-deleted records have no backup and cannot be restored. No automatic purge or permanent deletion UI is implemented.

Tests: `records.test.mjs`, `options-trash.test.mjs`, `classroom.test.mjs`, `learning.test.mjs`. Only disposable local data is used for deletion and restoration QA.

## Teacher workspace organization

The teacher board starts with the current classroom and QR. New-class settings collapse after creation; with no active classroom they open automatically. TV projection and pause/resume remain prominent, while join control, CSV, manual refresh and ending/reopening live in 「その他の操作」. End confirmation remains cancelable. Transfer requests appear only when needed. Word mastery and recent errors are expandable below the student table. The Duolingo palette, centered icons and larger control targets follow the shared visual system.

Browser QA used disposable local records: empty setup, active classroom, pause/resume, end cancellation, action menu and a 1536×864 TV viewport. No production classroom data was changed during QA.

## Course recycle bin

Select an ended classroom, then 「その他の操作」 → 「このクラスを削除」. A target confirmation moves the course into 「クラスの回収箱」 and removes it from the selector. Restore returns the course as ended and preserves assignments, scores, lessons and its individual-record recycle bin. It does not resume the course or end the current live course. Active courses cannot be deleted. Empty courses and deletion of the last course are supported. Recycled courses cannot be accessed through ordinary progress/CSV/control endpoints or student tokens. Teacher authentication and same-origin protections apply. Migration 0003 adds a default-zero deletion timestamp without removing existing records. No permanent purge is offered.

`tests/class-trash.test.mjs` checks scope/authentication, validation, transactional rollback, hidden-course access, restored answers, independent live courses, reopen/deletion races and the last-class case. Local browser QA covers cancel, delete, restore and active/ended visibility.

## Current word race

`/race-teacher` and `/race` are independent of ordinary practice classrooms and scores.
New races created in the teacher UI use three teacher-controlled timed courses, each
defaulting to six minutes with no question-count finish. Each learner has a personal
clock, including late arrivals. Questions continue beyond 24 with a stable personal
random sequence. Teachers can customize timing, vocabulary, question modes,
points and items. Every course announces its own top three, with a cumulative championship
ranking. Historical races retain the rule snapshot with which they were created.

The teacher tower shows each learner's remaining time, current type and answer count;
the large aggregate clock is hidden. After readiness, students read the actual course
scope, four-type station matrix, scoring/streak rules and enabled item explanations.
The briefing explicitly allows textbooks. Changing the avatar reopens preparation
and clears readiness until confirmed again.

Endless play is an explicit create flag. Older API clients and historical races retain
their finite decks. `race-endless.test.mjs` covers 24+ answers, full vocabulary cycles,
personal ordering, recurring items, duplicate receipts, individual expiry, late admission,
pause and all three timed podiums. The complete regression run has 34 suites.

Students enter an attendance number, select one of 40 Noun Town animal avatars and press
「準備完了」. The teacher's fixed F1-style timing tower displays attendance numbers and preparation
status. Ranks follow total points, then independent accuracy for ties; there is no speed bonus.
Each student receives a persisted independent question order within each course. Meaning,
English listening choices and letter spelling support all enabled curriculum profiles:
Grade 6 Unit 4–5, Grade 5 Unit 5, and Grade 6 Unit 7.

Late joins are accepted while running or paused unless the teacher closes admission. Preparing
starts that student's full course timer; pausing freezes elapsed time. When everyone finishes
or the course expires, students wait for the teacher to start the next course. Teacher end stops
all answers immediately. Lobby/race background music is teacher-only, with gear volume settings.

Independent correct answers earn the configured base points; consecutive independent correct
answers add an increasing capped bonus. Incorrect or hinted answers reset the streak. Six
configured item types provide hints, review and conditional point bonuses. The roulette has
independent cancellable animation timers and honors reduced motion. Score receipts and
optimistic-concurrency writes prevent repeated submissions from receiving duplicate points.

Same-browser participation credentials survive 「参加画面へ」 and QR re-entry. Resuming does not
reset progress, score, avatar or timer. Pending answers can be safely retried. Race participation
still has no ordinary-class teacher-approved device-transfer workflow: attendance number alone
cannot take over another browser's bearer credentials.

Ended races can be moved to the teacher's recycle bin and restored without changing active races.
Private answer records and CSV remain authenticated. Automated checks cover grading, three-course
barriers, per-course rankings, concurrent writes, late joins, readiness, recovery, deletion/restoration,
historical rules and all curriculum profiles. Browser regression checks login, lobby, avatar readiness,
start, spelling, listening, feedback and same-browser resume. Physical iPad/TV testing is separate.

## Refactoring and maintenance

See [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries and the retained compatibility layer.
Race rules, data access, response assembly, teacher routes, student routes and grading are separate
ESM modules. Browser request handling, teacher rendering, shared race views and item animation
also have separate modules. No database schema or stored identifiers changed during this refactor.

Run `npm run check` for syntax checks, a build and all regression suites. Run `npm run format:check`
for the checked-in formatting policy. Builds bundle race modules into the existing Worker and script
URLs, keeping the QR and share links unchanged.


## v34 · Classroom experience polish

Teacher race controls now emphasise start, pause/resume and the next course. Secondary
admission/end actions are grouped, with a reminder when students are still preparing.
Mutation responses appear immediately. No casting button or additional installation is
needed; use Windows casting as before.

Students get a focused question view, course progress, normal/slow pronunciation,
spelling undo/clear and stable keyboard focus. Finishing a course shows personal course
accuracy/points and optional wrong-word recall while waiting. That recall adds no score.
The overall podium includes everyone tied in the top three ranks.

The teacher editor displays one section at a time and supports vocabulary search. All
pages share network/timeout errors, touch targets, footer clearance and cache-safe script
versioning. No database migration or production record deletion is part of this release.

Run `npm run check` for all 22 regression suites and `npm run format:check` for the
maintained source files. Physical iPad/TV validation remains separate from browser QA.


## v36 · Learning and editor code organisation

Ordinary lesson transitions and diagnostics are separate ESM modules shared by browser and
server. Editor defaults/migrations, validation, audio storage and authorized saving have explicit
module boundaries. Browser form rendering and audio-file conversion are separate from editor
save/revision state. Existing lessons, historical scores, public URLs and database schema remain
compatible. Run `npm run check` for all 24 suites; see ARCHITECTURE.md for remaining legacy scopes.

## v37 · Classroom rehearsal and consistent components

Practice rendering/audio/spelling/feedback and ordinary classroom endpoints have explicit module
boundaries. Common controls share geometry, icon alignment and Duolingo colours. All 26 suites
and format checks pass, including a 35-learner, three-course race rehearsal with retries, pause,
late joining, unique question orders and restoration. Existing public routes, stored records and
rules are preserved. See ARCHITECTURE.md for details and remaining compatibility boundaries.

## v38 · Teacher-led workflow

Open the site to the teacher workspace, select materials and start ordinary practice or a
race. Show the room-specific QR. Students enter their attendance number and land in that
assigned room; they do not choose materials or modes. Race participants choose an avatar,
mark readiness and wait for the teacher. Student return links stay within the classroom.
Old rooms and saved progress stay compatible; use the new classroom QR for each lesson.

## v39 · Simplified teacher flow

Log in first, then choose Vocabulary Practice or Word Race. There is no third editor entry
on the home screen. Each mode's settings open an embedded editor with vocabulary and only
that mode's rule controls, save/revision protection and an unsaved-close warning. Existing
classrooms, race scores, saved student sessions and classroom-specific QR links remain intact.


## v44 · Device settings, help and truthful status

The gear has Sound & Display, Help and Status tabs on every page. Optional clearer
display darkens text, outlines and action colours without changing layout. It is saved
with the existing device preferences and restored by Reset. Help is role-specific;
teachers can open the local PDF guide and students see their assigned workflow.

Status separates server reachability, successful writes, pending/failed operations and
unsaved editor changes. A successful poll or health check never clears a failed save.
The manual connection check is read-only and shows the last checked time and app version.
Current-screen timestamps are not a historical audit log. Existing answer retry/resume
flows remain responsible for recovery. Browser storage failures are shown explicitly.

29 regression suites passed. Browser QA covers teacher/student help, teacher-only music,
settings persistence, iPad-sized large type, keyboard tabs and fixed completion controls.


## v45 · Tactile interaction and original sound design

All screens share one response system: a held press and quick release, softly sliding
questions/dialogs, letter pops, character reactions, drawn feedback icons, streak chips
and a short completion celebration. No transition delays input or changes game state.
The original synthesised mallet/wood/bubble sound bank has distinct cues for selection,
letters, undo, right/wrong answers, streaks and completion. No third-party sound clips
are downloaded. Pronunciation and existing teacher-only music retain separate controls.

One gesture gets one semantic cue, result sounds have priority, hidden pages are quiet,
and mute stops active effects. Context creation waits for an interaction. Reduced motion
cancels active effects immediately. Original race items, roulette and score animations
remain, with common sounds and completion treatment. Run `npm run check` (30 suites).
`node scripts/render-effects-preview.mjs` produces the local sound audition WAV.

## v46 · Four exercise types per race station

New races created in the teacher UI use the step-up format by default. Each station
contains a balanced mix of four types: meaning choice / meaning pairs / spelling /
audio choice; sentence ordering / cloze / audio pairs / audio sentence ordering;
sentence ordering / cloze / audio cloze / dictation. The default stays 3 × 24 questions.
Teachers can choose the classic format in in-mode settings. Existing races retain
their snapshots and rules; older API clients continue creating classic races.

Recent independent answers select support level, without using speed, rank or other
students' results. Stations 2–3 introduce word chunks, smaller banks, full tiles,
distractors and eventually free typing. All students encounter all four station types.
Examples come from the selected, editable curriculum. Sentence listening uses device
English speech synthesis; recorded word audio and teacher-only music stay separate.
Custom examples without the vocabulary use the explicit `The word is ...` fallback.

Pairs, token ordering and typed drafts survive polling and reload. Server validation,
idempotent receipts, manual item hints, basic-word review, score/streak entertainment,
late admission and station podiums remain in the same authoritative lifecycle.
Teacher histories show question type, expected correction and step; CSV adds these
diagnostic fields. The full regression run has 31 suites, including each built-in
curriculum and full three-station adaptive play. Browser QA uses iPad-sized viewports;
physical iPad audio/keyboard behaviour still needs a device rehearsal.
