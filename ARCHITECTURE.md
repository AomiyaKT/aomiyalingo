# Aomiyalingo architecture

## Release 78 - readiness and transition consistency

Modern browser joins request explicit preparation while legacy API clients keep
existing behavior. Ready/avatar acknowledgements carry the actual saved revision.
Next-course batches compare the complete participant revision/count snapshot in
the room update; dependent player updates run only under that successful token.
Shared request handling preserves HTTP failures even when their body is not JSON.
Review summaries and playback callbacks own their separate invalidation scopes.
See `docs/bugfix-78.md` for reproductions, compatibility and verification limits.

## Release 77 - bounded presentation and speech work

`public/race/teacher-clock.js` reuses tower-owned timer references and writes only
changed visible seconds, warnings and language labels. Tower rendering batches
all final FLIP position reads before animation writes. `public/shared/i18n.js`
bounds repeated translation work and coalesces nested mutation scans.

`server/assets.mjs` coalesces at most eight small packed-asset expansions and
retains expanded bytes in the existing 4 MiB LRU (256 KiB per entry). Large
recordings keep streaming, and API/authentication paths remain uncached.
Browser JS/CSS is minified during the existing hash-versioned build. Failed
speculative resources are retryable after a bounded backoff.
See `docs/optimization-77.md` for reproducible checks and measurement limits.

## Release 76 - teacher update checks

`server/updates.mjs` reads public release metadata only from the fixed AomiyaKT
GitHub repository, with bounded responses, a timeout and a coalesced five-minute
cache. Live teacher authentication and active lesson/race checks remain uncached.
`public/shared/settings-updates.js` keeps release checking separate from a user
initiated reload of a newer, already deployed server version. It rechecks the
server version and live classroom state before reloading and blocks unsaved work.
GitHub-only releases are reported as awaiting deployment; browser code never
executes downloaded source or deploys a Worker. See `docs/updates-local-76.md`.

## Release 76 - bounded race snapshots and stable practice text

Immutable race task JSON uses an exact-content, recursively frozen LRU shared
across request-local room rows (four entries, 524,288 source characters total).
Live lifecycle fields and mutable learner states remain request-local. Successful
race saves serialize once. Ordinary practice reuses unchanged material decoding
and avoids redundant teacher text writes in both interface languages while keeping
Japanese source text available to the existing reversible translator.

This work is included in the Release 76 source snapshot. Hosted deployment remains separate. See
`docs/optimization-local-2026-10-27.md` for reproducible work counters and limits.

## v63 · Coherent race snapshots and owned practice playback

The race service assembles an internal snapshot containing both the authoritative
room and its public board. Student polling consumes that snapshot once; teacher
board callers retain the existing response shape. An all-done revision check
still reloads the room before self/task fields are derived, including when a
concurrent teacher pause wins. Public snapshots omit the private player lookup.

Race CSV export computes per-player answer counts and accuracy once, rather than
rescanning history for every exported answer. Practice playback captures the
state/question/task and serial that own each asynchronous operation. Stopping
speech releases legacy utterance handlers before cancellation; obsolete callbacks
and play rejections cannot report errors or reset a later question's controls.

See `docs/optimization-v63.md` for query counts and compatibility checks.

## v62 · Presentation work and lifecycle ownership

Race showtime and spectacle reuse the existing motion manager and own their
animation, particle and timer cleanup. Race/station transitions, pauses, hidden
documents and reduced-motion settings clear transient work; explicit disposal
also removes owned listeners and elements. Unchanged snapshots and clock samples
avoid repeated text, attribute, style and dataset writes.

The tablet viewport controller caches footer geometry until its resize observer
or a window resize invalidates it. Browsers without ResizeObserver retain the
measurement fallback, and queued callbacks cannot revive a disposed controller.
Immutable item names/icons are shared across rules, roulette and briefing while
teacher-configured point/count descriptions remain dynamic.

See `docs/optimization-v62.md` for instrumented checks and their scope.

## v61 · Tablet geometry and race presentation events

`public/shared/student-viewport.js` reserves the measured action/feedback bar height
and follows the visual viewport. Resize/observer events are coalesced, unchanged
values are not rewritten, and only occluded typing fields are scrolled into view.
`public/ui/student-layout.css` supplies shared practice/race touch geometry, wrapping
phrase slots, a persistent race action bar and landscape picture-choice columns.

`public/race/spectacle.js` derives short notifications from authoritative snapshots
and receipts: live overtakes, teacher leader changes, independent streak milestones,
item use, final personal seconds and station ceremonies. Owners are scoped to a
race/station; unchanged polls, initial snapshots and repeated receipts do not replay
events. Pause/visibility transitions clear transient presentation. It never writes
scores or timing. Reduced motion and the existing sound settings remain authoritative.
`public/ui/race-events.css` owns finite podium/arrival animations and the item slot
presentation. Four additional original synthesized cues use the existing audio bank.

See `docs/tablet-race-v61.md` for browser rehearsal and physical-device limits.

## v60 · Grade 6 Pre Unit–Unit 1

The curriculum registry includes the stable `6-1` selection and independent `unit1`
configuration profile. All three teacher selectors expose the same combined textbook
page label. The importer includes its 27 verified words/phrases and native screenshot
illustrations, natural authored examples and local English WAV files. Abstract
`like/have/want` illustrations remain available on study cards while their default
assessment uses meaning choices; teachers can enable picture tasks explicitly.

The shared practice and race exercise engines consume this profile without a second
question implementation. Missing profiles are initialized on read; existing teacher
edits and older editor submissions retain the current profile through the existing
merge path. Active class/race snapshots are not changed. Image validation now permits
Unit 1 local assets with the same restricted path format as Units 2–8.
See `docs/content/grade6-unit1.md` for content provenance and validation.

## v59 · Linear diagnostics and reproducible asset delivery

`public/learning/diagnostics.js` retains first/latest attempts, hint presence and
counts in a single pass instead of sorting and retaining every grouped row. Equal
timestamps and sequences preserve stable input order. Classroom summaries aggregate
per-mode counts and per-person difficulties together, without repeated temporary
arrays. A frozen v58 reference under `tests/references` verifies output equivalence;
it is not part of the delivered application.

Classroom status, heartbeat and attendance-label routes no longer parse the full
saved lesson. Authentication and classroom guards remain in their original order;
lesson retrieval, start and answer grading still materialize the authoritative queue.

`scripts/asset-versions.mjs` stamps local script/stylesheet entry URLs with the final
bundled content hash. `build.mjs` performs this after JS/CSS bundling and regenerates
HTML metadata. This removes manual synchronization of page cache versions while
retaining non-cacheable HTML, script ordering, stable resource paths and validators.

`scripts/run-commands.mjs` runs isolated checks with four bounded workers and fills
free slots immediately. Syntax targets are deduplicated. Build remains between syntax
and regression phases; failures are aggregated without skipping later suites.
See `docs/optimization-v59.md` for measurements, reproduction and scope.

## v58 · Ordinary practice session, saving and reading flow

`public/classroom.js` is now a bundled classic-script facade. The session owner in
`public/practice/classroom-session.js` receives its DOM, storage, network and entry
callbacks explicitly. Existing QR URLs, browser storage keys, transfer authorization
and server session formats are retained. Entry requests and status responses check
their session owner before changing the current learner's screen.

`public/practice/transactions.js` owns the durable one-answer slot, captured bearer
credential, request generation, retry and one-time next-lesson handoff. A pending
answer cannot be overwritten. Older responses/finally handlers cannot update a new
session or release its active write. Obsolete acknowledgements leave the original
slot available for the server's existing idempotent receipt replay.

`public/practice/navigation.js` owns start-request screen epochs. Double taps do not
replace an active start, and returning to the path/book prevents a late response from
reopening a question. Successful background saves refresh a visible learning path
without canceling an intentional start. Start/answer transitions share busy guards.

`public/practice/teacher-panels.js` preserves weak-word, recent-answer and projection
panel nodes while their contents are unchanged; activity text remains live. Changes
to answers, lesson groups or class identity invalidate the appropriate panel.
Study cards now display built-in textbook illustrations alongside meaning, example
and pronunciation, with a plain-card fallback for words without images.

The five new suites cover transaction/session isolation, durable retries, stale entry
and status responses, double taps, navigation epochs, panel identity, illustrated
cards, and the actual classic classroom bundle against the real Worker API.
No schema or scoring changes are introduced. See `docs/practice-v58.md`.

## v57 · Explicit application and teacher controllers

`server/application.mjs` is the ESM application composition root. It imports the
classroom, editor, race and infrastructure services directly. `worker.mjs` now
exports an injectable HTTP Worker factory with no hidden application globals.
`build.mjs` only adapts the four retained browser catalogs and supplies public asset
data; it no longer reads/concatenates Worker source or embeds service wiring in a string.

`public/race/teacher-controller.js` owns teacher-only setup, rule-summary loading,
confirmation dialogs, reset, history selection and lifecycle commands. The race entry
retains student answer transactions, presentation and poll scheduling. A shared
`{busy, epoch}` gate invalidates stale responses across navigation and lifecycle writes.
Rule-summary requests coalesce and discard results superseded by a settings save.
Start/end confirmations pin their race IDs; ending uses the same protected write path
as pause/start. Student startup does not initialize the teacher controller.

`public/practice/teacher-analysis.js` owns attempt rows, learner details and the mastery
table. Its pure model indexes skills by word instead of repeatedly searching them.
Unchanged detail/mastery models preserve their DOM nodes across polls; changed answers,
selected learners, class scopes, formats and vocabulary invalidate the appropriate view.
Activity timestamps remain live in the separate roster renderer.

`learnerLevel` scans backward for the last eight non-review answers and stops there.
Station 1 immediately uses its fixed support level. Support thresholds, hinted-answer
handling, review exclusion and saved histories are unchanged.

New regression suites cover direct application composition/isolation, the extracted
teacher controller's asynchronous boundaries, model equivalence, bounded history
reads and unchanged-poll DOM identity. `docs/refactor-v57.md` records the measurement
scope and browser rehearsal. No database/schema or saved-record migration is needed.

## v56 · Public asset delivery and configuration defaults

`server/assets.mjs` owns public build-asset responses. The build records byte lengths and
SHA-256 validators after browser/CSS bundling. HEAD and matching If-None-Match requests
return without base64 decoding. Successful GETs use a per-isolate LRU of at most 4 MiB;
individual assets over 256 KiB bypass it so large music/font files cannot evict the
illustration/audio working set. The cache contains only immutable public build assets.
HTML remains no-store, and API authorization/response paths stay outside this module.

`server/editor/configuration.mjs` constructs each editable curriculum directly from its
own source bank through one default-profile factory. The curriculum registry drives
missing-profile initialization; constructing one profile no longer builds and discards
the legacy bank first. Picture lookup maps are built once. Mutable word settings,
distractors, course IDs, race IDs and rules are fresh per load. Persisted teacher edits,
legacy formats, revision handling and classroom/race snapshots retain their contracts.

`tests/assets.test.mjs` verifies binary integrity, bundled validators, cache eviction,
oversized bypass, response isolation and decode-free HEAD/304 responses.
`tests/configuration-defaults.test.mjs` verifies all defaults, source/request isolation,
teacher edits and missing-profile upgrades. See `docs/optimization-2026-10-24.md` for the
local asset benchmark and its limits; run `npm run benchmark:assets` to reproduce it.

## v55 · Grade 6 Unit 2–8

`public/shared/curriculum.js` is the single curriculum registry and shared spelling-format
contract. `public/curriculum.js` is bundled into a classic browser facade; the Worker imports
the same registry instead of concatenating browser globals. Existing `4-5`, `grade5` and
`unit7` keys remain compatible. New profiles are filled only when missing; old editor saves
retain profiles they do not know, and existing classroom/race snapshots are unchanged.

Grade 6 word counts are Unit 2: 21, Unit 3: 19, Unit 4: 37, Unit 5: 28, Unit 6: 22,
Unit 7: 24 and Unit 8: 22. Unit 4 includes the seven shared past-tense words. Unit 5 retains
the nine previously added hero expressions. The former combined Unit 4–5 profile remains
selectable for saved settings.

`scripts/import-grade6.mjs` reproduces `server/editor/grade6-content.mjs` and copies the
157 individually verified reference illustrations. Reference screenshots and the textbook
viewer are kept outside `public/`. Image provenance is recorded in
`docs/content/grade6-image-sources.json`. New English examples are original teaching prompts.
109 missing word/phrase WAV clips were generated with Windows Microsoft Zira Desktop;
existing recordings are preserved. Sentence audio continues to use device English speech.

In adaptive lessons, an illustrated `text` seed materializes as a picture-choice exercise.
This retains four question families per race station and the stored question/score contract.
Picture tasks share the exercise controller and authoritative grading; the visible payload
has shuffled choices and a generic image alt, without a spoken answer cue. Teachers can
disable a word's picture in the editor. Spaces, hyphens and possessive apostrophes are
provided automatically in spelling slots, and the reconstructed expression is validated.

The new curriculum suite covers all profiles, 519 complete student submissions, each
adaptive family at two difficulty levels, natural example coverage, local image/audio
delivery, punctuation formatting, per-unit saves and old-client preservation.

## Race server

`race-server.mjs` is the composition root. It receives explicit infrastructure dependencies from
the existing Worker and builds the race handlers once. Race modules use ESM imports and no longer
depend on being concatenated into the Worker's lexical scope.

| Module | Responsibility |
| --- | --- |
| `server/race/rules.mjs` | Immutable question snapshots, legacy rule interpretation, timers, rank calculation, visible tasks and learning summaries. No database calls. |
| `server/race/repository.mjs` | Room lookup, automatic expiry, participant lookup and optimistic-concurrency answer writes. |
| `server/race/service.mjs` | Boards, team totals and authenticated student response serialization. |
| `server/race/teacher.mjs` | Teacher-authorized creation, lifecycle, three-course transitions, recycle bin and CSV. |
| `server/race/student.mjs` | Join, bearer authorization, avatar selection and readiness. |
| `server/race/grading.mjs` | Authoritative answer validation, receipts, item awards and item use. Called after student authorization. |

Lifecycle and readiness transactions remain in their handlers: their multi-row compare-and-swap
guards must be kept together. Do not replace them with unconditional row writes or split them
across separate requests. The teacher's next-course transition token prevents a failed concurrent
transition from moving participant records.

Question snapshots and participant states are parsed once per row object, using WeakMaps. Cache
entries check the serialized source value and expire when their request-local rows are released.
Mutable grading state is parsed separately; never mutate a cached read model. Rankings sort once
and assign competition ranks in one pass, retaining tied positions and accuracy tie-breaks.

## Race browser

`public/race.js` coordinates page state, polling, student interactions and teacher actions.
Presentation modules get current data through callbacks rather than capturing an old response.

| Module | Responsibility |
| --- | --- |
| `public/race/api.js` | Requests, response/error handling and explicit resume credentials. |
| `public/race/views.js` | Avatar art, keyed lane/timing rows, podiums and course results. |
| `public/race/teacher.js` | Teacher board rendering, history selector and recycle-bin rows. |
| `public/race/items.js` | Item roulette, animation timers and cancellation. |
| `public/race-session.js` | Same-browser participation credentials, pending answers and resume. Keeps the existing browser-storage format. |

Teacher answer histories and podiums only rebuild when their displayed data changes. Keyed rank
rows retain their DOM identity so score changes can animate without recreating the whole board.
Changing page or course cancels a pending roulette. Poll response epochs prevent old responses
from reopening a view after navigation.

The entry script is bundled into the existing `/race.js` URL, so HTML, QR links and older tablets
do not need a module loader or additional requests. Browser-only modules never reach server
authorization or scoring logic.

## Build and checks

The ordinary teacher entry `public/teacher.js` is also bundled at its existing script URL.
`public/practice/teacher-roster.js` owns keyed practice-table rows and updates their leaf values
without replacing focused controls. Class-selection epochs invalidate both stale responses and
stale errors; the latest class gets an immediate follow-up after the old request settles. The
delivered-bundle refresh suite verifies this behavior with explicitly delayed responses.

- `npm run build`: bundle the race browser entry and Worker using the pinned esbuild version.
- `npm run check` / `npm test`: syntax-check changed modules, build, and run every regression
  suite. Each suite has a separate process and in-memory database; at most four run together.
- `npm run format`: format the refactored source using the checked-in Prettier configuration.
- `npm run format:check`: verify formatting without changing source.
- `TEACHER_PASSWORD=... node dev.mjs`: isolated local preview on port 8767, using built output.
  Rebuild and restart it after changing sources.

No database schema, API contract, stored question ID, attendance identity or published URL was
changed by this refactor. Existing rule versions remain covered by regression suites. Tests never
write production classroom or race data.

## Remaining compatibility boundary

The ordinary-practice request handlers and shared vocabulary scripts still enter the build through
the retained compatibility entry in `build.mjs`. Editor services and the learning model now use
explicit ESM imports. Existing browser facades and stored lesson versions are preserved. The student race coordinator also still owns several interaction states; this
refactor does not claim to have converted the entire application into a new framework. Future
changes should follow the explicit race-module boundaries rather than extend the old shared scope.


## Experience polish (v34)

- `public/race/lifecycle.js` is the shared, pure priority order for student screens. A
  finished room wins over late preparation, a course break wins over a personal finish,
  and a pause never presents an answerable question. `courseSummary` counts the current
  course's non-review attempts, including hinted attempts in the accuracy denominator; points include scored review-item receipts.
- `public/race/review.js` owns voluntary waiting review. Its cards come from authenticated
  session responses only after a personal course finish; revealing/listening has no write
  endpoint and cannot affect points or rank. Cards reset at the next course.
- `public/shared/request.js` owns JSON, authentication headers, abort timeouts and error
  metadata. The classic classroom, teacher and editor scripts consume the bundled
  `public/network-entry.js` facade. The race ESM client imports the same request factory.
- `public/network-entry.js` owns the connection banner and measures real fixed footer /
  feedback heights. `public/experience.css` is the common final layer for touch sizes,
  font scaling, safe areas, editor tabs and race layouts.
- Race controls invalidate earlier polling responses and render the authoritative mutation
  response immediately. Same-question answers rejected by a pause remain pending; stale
  course answers are discarded only after an authoritative snapshot is fetched.
- Every HTML page includes a versioned network bundle before its API clients. Update asset
  version markers with releases, since public assets use long browser cache lifetimes.

Checks cover 22 isolated regression suites. Browser QA additionally covers teacher setup,
35 participants, avatar readiness, course results / next course, voluntary review, long
phrase spelling, drafts through pause/resume and re-entry, ordinary practice, editor
search / save, and enlarged text with measured footer clearance. These are desktop browser
checks; real iPad touch/rotation and Windows TV casting still require device validation.


## Ordinary learning and editor boundaries (v36)

| Module | Responsibility |
| --- | --- |
| `public/learning/lesson.js` | Create lessons, advance answers, schedule spaced review, keep legacy lesson rules. |
| `public/learning/diagnostics.js` | First answers, independent/hinted accuracy and teacher word summaries. Word records are indexed once per learner when summarising a class. |
| `public/learning/course.js` | Compose the shared learning model for both browser and Worker. |
| `public/course.js` | Browser compatibility facade; the build bundles imports and exposes the existing `course` API. |
| `server/editor/configuration.mjs` | Default curricula, stored revisions and compatibility migrations, with explicit vocabulary/database dependencies. |
| `server/editor/validation.mjs` | Configuration validation without database or request access. |
| `server/editor/curriculum.mjs` | Grade/unit selection and profile lookup. |
| `server/editor/audio.mjs` | Recorded audio delivery and authenticated-route upload validation/storage. |
| `editor-server.mjs` | Authorize and coordinate editor requests. Revision compare-and-swap writes stay here. |
| `public/editor/views.js` | Search, word form, lesson pools and rule controls. Access current profile/selection through callbacks. |
| `public/editor/audio.js` | File conversion only; no access to dirty state or server revision. |
| `public/teacher-editor.js` | Login, current curriculum, unsaved state, save locks, revisions and navigation. |

No configuration migrations, lesson identifiers, history formats, scores or public endpoint names
changed. Audio GET remains publicly readable for student playback; teacher authorization precedes
all configuration/audio mutations. Browser clients still request the same script URLs, and the
build replaces development ESM entries with classic-script bundles.

Checks now include 24 suites. The module-boundary suite executes the actual delivered course
bundle as a classic browser script and compares its lesson transitions with the server model.
Browser verification covers word search/rename/save, grade and editor-tab switching, ordinary
class creation, student join/answer/next question, and teacher progress synchronisation.

Remaining work: ordinary classroom request handlers in `worker.mjs` and the main practice screen
in `public/app.js` still have large orchestration scopes; vocabulary scripts still have legacy
globals. Keep further extraction incremental and preserve transaction and resume boundaries.

## v37 · Classroom and practice boundaries

Ordinary classroom authentication, identity/recovery, teacher controls, student lifecycle,
transactional grading and progress queries now live in `server/classroom/`. `worker.mjs`
coordinates origin checks, route factories and static responses. Authorization remains before
protected data access; grading preserves deduplicated attempts and revision-guarded batches.

The practice coordinator uses `public/practice/` factories for audio, spelling, choices,
question construction/view, feedback and study/course screens. Current state is passed through
callbacks. Shared DOM/icon helpers and `public/components.css` keep controls consistent across
all pages. Vocabulary's legacy globals and the small classic classroom navigation facade remain
explicit compatibility boundaries; extraction must preserve saved drafts and transactions.

Validation: all 26 regression suites and formatting checks pass. The new rehearsal simulates
35 learners across three 24-question race courses (2,520 submissions), distinct shuffled orders,
late entry, readiness, pause, lost responses/retries, course barriers, re-entry and recoverable
race deletion. It also exercises 35 ordinary learner joins/answers and progress persistence.
This is a server/browser rehearsal, not a physical iPad/TV or production load certification.

## v38 · Teacher-led classroom entry

The root URL is the teacher workspace. `/student?class=<id>` and `/race?race=<id>`
are classroom-bound student views; the legacy `/?student=1` remains compatible.
Teacher QR images are generated locally by the shared classroom link component, refreshed
when the selected room changes and hidden until a room exists. They contain no credentials.
Explicit classroom IDs never fall back to another active/latest room when missing/deleted.
Student resume checks the target room before using a saved session. Navigation stays within
that classroom; a new race requires the teacher's new QR. Music remains teacher-only,
including the root teacher home. Public authorization and snapshots remain unchanged.

The classroom-entry regression suite covers root/legacy routes, exact old-room selection,
missing/deleted room isolation, QR destinations and hidden empty QR state.

## v39 · Login, choose, configure inside the mode

The opening teacher document contains only the password form before authentication. An
existing valid eight-hour teacher session can return directly to the two-mode chooser.
`/api/teacher/session` checks the same HttpOnly server session as teacher mutations and
returns no classroom data. Ordinary/race mode documents redirect expired sessions to the
central login, preserving a bounded mode intent. No password is kept in browser storage.

Practice and race settings now open within the active mode in a same-origin dialog. The
existing revision-aware editor is scoped to vocabulary plus the relevant mode's rules;
its parent only accepts state messages from that exact frame and origin. Unsaved changes
show an in-page keep/discard prompt, and closing while saving is blocked. Saved settings
refresh the parent setup defaults without changing existing classroom/race snapshots.
Embedded editors suppress their own music player; the parent retains teacher-only music.

## v41 · Race spectacle and focused presentation

`public/race/showtime.js` owns visual countdown lights, a personal course track, receipt-deduplicated
particles and input/item responses. It only reads authoritative snapshots/receipts and does not
change scoring, question generation, rank or timing. Pauses/hidden tabs cancel countdown displays;
stale countdown polls cannot replay GO. Motion honours browser and application reduction settings.
`public/race-showtime.css` keeps the student HUD compact, the teacher control bar aligned, themed
three-course scenery and rank-labelled podiums. Existing score, streak and catch-up item mechanics
remain in the server. There are 28 regression suites, including presentation lifecycle checks.


UI polish (v42): shared control/dialog geometry remains in components.css; teacher login, mode cards, compact workspace and embedded editor layout remain in teacher-flow.css; race lobby and live TV layout remain in race-showtime.css. No additional CSS layer, scoring or lifecycle changes. Cache marker classroom42c.


## UI rebuild (v43)

Each HTML surface loads one `/ui/<surface>.css` entry. `build.mjs` bundles imports with native CSS layers: retained view-specific compatibility, the new `ui/system.css` component contract, `ui/screens.css` screen layouts, and `ui/states.css` visibility/disabled state priority. New UI changes belong to these three modules; do not append overrides to the retained stylesheets. The teacher rail is a semantic nav, shown only after authentication; it gives way to the full timing tower during a live race. First-class/first-race preparation is a focused form, while an existing classroom retains its dashboard and QR rail.

Nunito and the locally bundled Zen Maru Gothic (regular/bold WOFF2) provide rounded Latin/Japanese text. SIL OFL licenses ship beside the fonts. `assets/aomi-cat.svg` is the original flat interface mascot; the 40 existing selectable animal avatars are preserved. No external font or image service is required at runtime. Login, room-scoped student sessions, ranking, scoring, question content and teacher operations remain unchanged.


## v44 · Settings support modules

`public/settings.js` is now a bundled compatibility entry exporting `window.appSettings`.
`shared/settings-panels.js` builds one role-aware tabbed settings surface for all pages.
`shared/runtime-status.js` keeps in-memory connection/save state without request bodies
or learner identifiers. The shared request client reports start/end receipts; reachability
and writes are independent so polling cannot turn a failed save into a success. Editor
dirty/saving state is reported directly by its controller. Practice-specific pending-answer
copy remains available through the existing sync status. No retry or scoring logic moves.

`shared/release.js` is the single app-version constant. Read-only `/api/health` returns it
without reading or mutating classrooms. The bundled teacher PDF is served locally with
application/pdf. Clearer display and settings layout remain in ui/system and ui/states.


## v45 · Presentation feedback boundary

`public/feedback-effects.js` is a bundled facade exposing the existing
`window.interactionEffects` API plus semantic `answer`. `public/effects/sound-bank.js`
renders bounded PCM cues; `audio.js` owns gesture activation, one reusable context,
cached buffers, gain/limiting, cue priority and visibility/mute behaviour. `motion.js`
owns replaceable WAAPI animations using individual transforms. `controller.js` coalesces
generic and semantic gestures and owns short-lived decorative layers and receipts.
`ui/motion.css` is imported in the screen layer before authoritative states.

Practice and race controllers emit presentation events after their existing decision
or saved receipt. Server scoring, task order, clocks and persistence are untouched.
The final answer cannot play over the higher-priority completion fanfare; race correction
pronunciation waits for its short error cue and is cancelled on stale/hidden/paused state.

## v46 · Adaptive exercise boundary

`public/learning/exercises.js` owns the station matrix, deterministic materialization,
English example gaps/token banks, and structured answer validation. Rules-6 tasks
store their station and original curriculum snapshot. `raceCurrentTask` is the single
materialization entry for both presentation and grading. History is the only learner
input: replay/poll timing, ranking and item rolls cannot change the exercise target.
Manual hints change support text only. Solutions stay server-side; pair/token IDs are
opaque and stable. Structured matching enforces a complete bijection; ordering enforces
valid unique token IDs. Free answers normalize case, spacing and sentence punctuation.

The teacher UI explicitly requests `adaptive-four`; absent/legacy create flags keep
rules 5. `race.format` is optional, validated and persisted by the existing editor.
Historical rows and classic tests require no migration. Review items deliberately use
basic word recall and retain the original wrong-mode key for successful cleanup.

`public/shared/exercise-controller.js` owns richer drafts and focused DOM nodes; it does not own
submission, receipts, clocks, points, rank or network recovery. The main race controller
delegates answer value/readiness/rendering and retains the existing pending transaction.
Polling does not replace active typing fields. `ui/exercises.css` is a screen-layer
module, below authoritative states, with large touch targets and the shared press/feedback
system. No new animation or timer controls gameplay.

## v47 · Shared exercises in ordinary practice

The former race model and controller entry points are compatibility re-exports.
Race task serialization still excludes solutions; ordinary practice uses the same
pure materializer for its existing local draft/feedback model and authoritative
server grading. The controller accepts an optional save callback so ordinary
practice uses its classroom-scoped recovery store without duplicating race storage.

`public/learning/practice.js` owns the optional step-up lesson format, three
encounters per word, deterministic exercise creation and focused review queues.
The existing version-2 lesson engine continues owning short rounds, completion and
bounded spaced recall. Main-answer history alone drives the support level.

The classroom `modes` column stores either its legacy JSON array or a versioned
`{format:'adaptive-four',modes:[...]}` object. An absent create flag keeps legacy
API behaviour. Explicit new-UI creation opts in; existing room snapshots and saved
queues are untouched. No schema migration is required.

`public/practice/exercises.js` adapts the shared DOM controller to ordinary practice
prompts, hints and drafts. The existing feedback, pending-answer, retry and revision
pipeline remains responsible for submission. The server independently rebuilds the
task and validates structured pairs/tokens/text before the existing atomic write.
Rich attempt answers retain value, expected correction and support level in the
existing JSON answer column. Diagnostic readers retain old string/array support.

Adaptive teacher mastery displays observed word/type combinations. The detailed
history and CSV retain prompted correctness separately from independent correctness.
`practice-adaptive.test.mjs` adds all-curriculum, short-round, adaptive, retry, review
and diagnostic coverage to the 33-suite regression run. `practice-audio.test.mjs`
checks recorded playback state and cancellation of stale speech promises.

## v51 · Bounded caches and lower polling work

- `server/race/history.mjs` provides a read-only numeric history index shared by ranking, station podiums, team totals and learning summaries. Word sets are lazy. Weak caches belong to parsed request-local state objects, not attendance numbers; append/replacement invalidates them. Persisted answer history remains append-only.
- Teacher-only race rows include `recordRevision` from the database revision. `public/race/record-model.js` uses this revision for per-learner/per-course analysis caches. Roster removal and race changes evict caches. Legacy responses without revisions retain full history change detection. Open dialogs remain stable reading snapshots.
- `public/race/records.js` owns the DOM and lazily renders a collapsed panel. Pure statistics, numeric attendance collation, answer grouping and spelling alignment live in `record-model.js`.
- `public/race/timing-tower.js` owns keyed ranking rows. It measures only moving ranks, skips unchanged text/ARIA writes and preserves reduced-motion behavior. Hidden pages suspend the quarter-second clock DOM work.
- Student composition never initializes teacher components. An executable bootstrap test checks both direct and room-QR entry; actual browser rehearsal also covers join, avatar, readiness, scoring and refresh recovery.
- Classroom progress and CSV index attempts by learner and parse vocabulary/modes once per request. The shared teaching-summary model discovers modes once per snapshot.

Run `npm run check` for the 38 regression suites and `npm run benchmark` for a reproducible synthetic 35-learner CPU workload. Measurements and scope are documented in `docs/optimization-2026-10-22.md`. No database migration, scoring change or authentication change is required.

## v50 · Teacher learning records

`public/race/records.js` owns the race diagnostics overview and native detail dialog. It derives independent accuracy from main history only, excludes review-item attempts, and separates hinted answers. Scope filters apply to both summary and detail; attendance sorting is numeric. Shared class difficulties count unique learners per word, not repeated mistakes. Identical wrong answers are grouped for reading while the complete history stays available and CSV remains unchanged.

Overview pages hold 12 learners and history pages hold 8 answers/groups. Live polls update the overview, but an open detail is a stable snapshot with an explicit refresh action to preserve reading position. No persistence, grading, or race ranking rules change. `tests/race-records.test.mjs` covers aggregation, course scope, grouping, sorting, and spelling alignment.

## v49 · Timed endless races

`server/race/endless.mjs` derives one task from an immutable curriculum, a random
per-player seed, station and station-local cursor. Deterministic word permutations
cover the whole vocabulary before repeating; balanced type permutations continue
indefinitely. Stable task IDs scope every attempt to player/station/cursor. No growing
deck or client-generated questions are trusted. Existing receipt/revision writes still
own score and cursor changes. Historical finite task orders retain their original path.

The explicit `endless` room snapshot changes completion to personal time expiry only.
The existing late-arrival extension, pause and teacher station transition transactions
retain authority. Endless station transitions reset the local cursor while preserving
history and cumulative scoring. Public totals are null in this format; UI progress
uses time rather than an invented question limit. The teacher tower receives current
type and personal remaining milliseconds; its display interpolates until the next poll.

`public/race/briefing.js` renders the selected curriculum, actual score/item values,
station types and textbook permission after readiness. It preserves the rendered
content while polling so reading position is stable. Reopening avatar selection clears
readiness through the existing authorized avatar endpoint.
