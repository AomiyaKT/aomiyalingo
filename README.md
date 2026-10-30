[![ここからすぐに使う / OPEN AOMIYALINGO](docs/teacher-start.svg)](https://aomiyalingo.minamiyakk.chatgpt.site/)

**ダウンロード・ZIPの解凍・インストールは不要です。 / No download, ZIP extraction or installation needed.**

ボタンを押して、先生用パスワードでログインしてください。<br>
Click the button and sign in with your teacher password. Internet access is required.

[📖 日本語の説明書 / Japanese PDF](public/help/teacher-guide.pdf) · [📖 English guide / 英語の説明書](public/help/teacher-guide-en.pdf)

<details>
<summary>予備のダウンロード / Optional download</summary>

[先生用スターターZIP / Teacher starter ZIP](https://github.com/AomiyaKT/aomiyalingo/raw/refs/heads/main/downloads/Aomiyalingo-Teacher-Kit.zip)

入口と日英PDFをパソコンやUSBに保存したい場合だけ使います。ZIPを展開して `START-HERE.html` を開いてください。<br>
Only needed to keep the launcher and both PDF guides on a computer or USB drive. Extract the ZIP and open `START-HERE.html`. The app still requires internet access.

</details>

---

# Aomiyalingo

**English** | [日本語](README.ja.md)

Aomiyalingo is a Duolingo-style English learning web app tailored to **Blue Sky**, the elementary school English textbook used in Aomori Prefecture, Japan. It helps teachers bring more variety and interaction into their lessons through vocabulary practice and multiplayer word races.

Teachers and students can use any internet-connected device with a compatible web browser—including computers, tablets and smartphones. Students simply scan a QR code or open a link to join.

**Current version: Release 79 · 30 October 2026**
[Open the app](https://aomiyalingo.minamiyakk.chatgpt.site/) · [Changelog](CHANGELOG.md) · [Release 79 details](docs/release-79.md)

**Source release:** this repository contains Release 79. The hosted website is deployed separately; a GitHub upload does not update the running classroom server.

[For teachers and ALTs](#for-teachers) · [For developers and future maintainers](#for-developers)

<a id="for-teachers"></a>

## Part 1 · For teachers and ALTs

### A little more variety for your English lessons

Aomiyalingo gives children another way to practise the English they meet in **Blue Sky**. You can use it for a quick warm-up, a review activity or a lively change of pace during class. It is a classroom companion: you choose the lesson and how to use it alongside the textbook.

The included materials cover **Grade 5 Units 1–8** and **Grade 6 Pre Unit–Unit 8**, with vocabulary, pictures, word recordings and example sentences. Japanese is the default interface language; you can switch to English in the gear menu whenever you like.

### Two ways to play and learn

| Vocabulary Practice | Word Race |
| --- | --- |
| Children work through short lessons at their own pace. | The class takes part in a shared game led by the teacher. |
| Hints and review help them revisit words they find difficult. | Avatars, streaks, surprise items and a live board add some excitement. |
| You can check answers and see which words need another look. | You can watch progress, pause the game and move the class to the next course. |

Practice includes choosing meanings, listening, spelling with letter tiles, matching words, putting sentences in order and filling gaps. Some activities use pictures; others ask children to listen and build or type an answer. Later race courses introduce more demanding activities, with support adapting to each learner's recent answers.

A standard race has **three courses, each with six minutes of unlimited questions**. Every child gets their own question order. Children choose an animal avatar, press Ready and read the game introduction while waiting for you to start. Late arrivals can still join while joining is open. The game introduces the selected unit, question types and items, and lets children know they may consult their textbook.

**Race points are for classroom fun.** Correct answers, streaks and items can all affect points. For a closer look at learning, use the answer records and independent-correctness information rather than treating the game ranking as a test result.

### Getting a class started

1. Open the green button at the top of this page and sign in with your teacher password.
2. Choose **Vocabulary Practice** or **Word Race**, then select the grade and unit. Adjust the material or rules inside that mode if needed.
3. Show the QR code or share the student link. Children open it and enter their attendance number.
4. Start the activity when you are ready. You can pause or end it from the teacher screen.

Computers, tablets and smartphones can join through a compatible web browser and an internet connection. You do not need to install the project or unpack a ZIP. If you would like the whole class to see your screen, use your usual projector, television connection or screen-sharing setup.

If audio does not start immediately, tap a play button or interact with the page first. Browser audio permissions and available English voices vary by device. Background music is for the teacher view; the student QR view does not play it.

### Make it work for your class

You can change vocabulary, example sentences, question settings and game rules from the selected mode. You can also manage participation, reset a race for a fresh setup, review answers and export results as CSV. Deleted records have recovery controls; permanent deletion is a separate action.

The gear menu includes language, sound, display and help settings. Its update check can tell you when a newer version is available. A source update on GitHub may still need to be published by the person maintaining the server.

### Help when you need it

- [Japanese teacher guide (PDF)](public/help/teacher-guide.pdf)
- [English teacher guide (PDF)](public/help/teacher-guide-en.pdf)

Both guides explain the classroom workflow step by step. The guide button inside the app opens the PDF for your selected interface language.

---

<a id="for-developers"></a>

## Part 2 · For developers and future maintainers

This section is the technical entry point for a successor maintaining Aomiyalingo after its original maintainer leaves. It describes the Release 79 implementation and its operating boundaries. Read [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and the [Release 79 notes](docs/release-79.md) before changing behavior. Architecture entries describe individual releases; older measurements and suite counts are historical, not current guarantees.

### Product intent and engineering principles

- **Teacher-led entry:** the root page authenticates the teacher, then offers practice and race. Student links target an exact classroom or race. Keep the classroom start flow short and the teacher in control.
- **Complementary modes:** practice supports learning, review and diagnostics; race adds spectacle and participation. Do not silently turn entertainment points into an assessment metric.
- **One learning implementation:** both modes reuse shared exercise materialization and validation. Add a question type at the shared boundary and integrate its mode-specific submission flow, rather than copying an engine.
- **Content-driven extension:** curricula, authored examples and editable rules provide the extension points. Middle-school support is a possible future direction, not an implemented curriculum.
- **Preserve records and ownership:** retain authentication, revision checks, idempotent receipts, saved formats and request ownership. Separate structural refactors from changes to scoring, schemas or teaching behavior.

### Architecture and source map

The project uses JavaScript ES modules, a browser UI, a Cloudflare Worker HTTP application and a persistent D1 database. It is currently an instance-level application with a shared teacher-password model, not a platform with separate school accounts or tenant isolation.

| Entry or directory | Responsibility |
| --- | --- |
| [server/application.mjs](server/application.mjs), [worker.mjs](worker.mjs) | Compose services; dispatch authentication, API and asset requests. |
| [server/classroom/](server/classroom/) | Teacher/student authentication, classroom identity and recovery, lesson lifecycle, grading and progress. |
| [race-server.mjs](race-server.mjs), [server/race/](server/race/) | Race composition, rules, repository operations, teacher/student commands and grading. |
| [editor-server.mjs](editor-server.mjs), [server/editor/](server/editor/) | Authorized configuration writes, validation, curriculum defaults and custom audio. |
| [public/learning/](public/learning/), [public/learning/exercises.js](public/learning/exercises.js) | Shared lesson, diagnostic and exercise materialization/validation logic. |
| [public/practice/](public/practice/), [public/race/](public/race/) | Browser controllers, durable submissions, lifecycle cleanup and mode-specific views. |
| [public/shared/](public/shared/), [public/ui/](public/ui/) | Shared requests, localization, controls, viewport behavior and screen styling. |
| [db/schema.ts](db/schema.ts), [drizzle/](drizzle/) | Schema definitions and ordered SQL migrations. |
| [build.mjs](build.mjs), [scripts/](scripts/), [tests/](tests/) | Bundling, checks, benchmarks, rehearsal and backup tools. |

`build.mjs` bundles browser entries and styles, hashes final asset URLs, embeds public assets and produces `dist/server/index.js`. Some vocabulary catalogs still enter through retained classic-script adapters. Preserve those compatibility boundaries until their consumers and stored formats have been migrated explicitly. Edit sources, not the generated Worker bundle.

### Authoritative state and concurrency contracts

1. **The server authorizes and grades.** Teacher sessions use a server-validated HttpOnly cookie; student operations use bearer credentials scoped to participation. Attendance numbers identify learners in the UI and are not authentication secrets. QR links contain room identifiers, not participant credentials.
2. **A lesson/race captures its content.** Creation snapshots the selected curriculum and rules. Later editor saves must not rewrite an active classroom or race. Preserve legacy curriculum keys and stored rule/lesson versions.
3. **Writes are revision guarded.** Multi-row lifecycle/readiness transitions use compare-and-swap conditions and transition tokens. Keep the guard and dependent updates together; unconditional writes or separate requests can corrupt concurrent transitions.
4. **A submission has one owner.** Practice transactions and the race student controller capture their credential and navigation generation. Preserve durable pending answers, duplicate exclusion and idempotent retry. Superseded polls, responses and `finally` handlers must not alter a later screen or release another submission.
5. **Presentation is not gameplay state.** Roulette, sounds, celebrations and interpolated clocks consume authoritative state. They do not award points or advance a learner. Pause preserves drafts/pending submissions; changing room, learner or course invalidates transient playback and animation work.

The race command policy is centralized in [public/race/lifecycle.js](public/race/lifecycle.js): lobby → running; running ↔ paused; completed nonfinal courses → intermission; next-course commands → running; ending → finished. The database's running state also covers the visible countdown. Reset/replacement and early cancellation must not be interpreted as normal course completion.

Endless questions are derived from an immutable content snapshot, a per-player seed, course and cursor in [server/race/endless.mjs](server/race/endless.mjs). There is no growing client-authored deck. Timer values and answer acceptance remain server-owned.

Scoring and ranking are implemented in [server/race/grading.mjs](server/race/grading.mjs) and [server/race/rules.mjs](server/race/rules.mjs). Current score rules can include correct-answer points, streaks and enabled item effects. Current accuracy-aware ranking uses points first, accuracy as a tie-break and shared ranks for equal results; speed/arrival order does not decide the rank. Retain independent correctness, hinted answers and review attempts as distinct diagnostic concepts.

### Content, localization and UI changes

Start with [public/shared/curriculum.js](public/shared/curriculum.js), the editable profile factory in [server/editor/configuration.mjs](server/editor/configuration.mjs) and the provenance notes in [docs/content/](docs/content/). Confirm words, meanings, illustrations, recordings and sentence examples against the intended unit. Existing teacher edits take precedence over newly supplied defaults; fill missing profiles without replacing saved edits.

Use the existing shared exercise controller and server validation. Matching requires valid complete pairs; sentence ordering requires valid token identities. Keep solutions out of race-visible task payloads. Preserve punctuation handling for multiword expressions and forms such as `P.E.`.

Japanese remains the default; update English labels alongside Japanese and test both layouts with long labels. Reuse the existing UI, motion and audio systems. Keep music teacher-only, honor reduced motion, preserve active input during polls and release screen-owned timers/audio on navigation.

### Reproducible local development

Use **Node.js 24 LTS** and npm. The preview uses Node's built-in SQLite and applies the repository's SQL migrations to an in-memory database.

```sh
npm ci
npm run check
npm run content:check
```

`npm run check` performs syntax checks, builds the application and runs the regression suites. After a successful check, start the built application in PowerShell:

```powershell
$env:TEACHER_PASSWORD = 'choose-a-local-preview-password'
node dev.mjs
```

Open `http://127.0.0.1:8767/`. This preview binds to loopback and loses its records when the process stops. It is not a production or classroom LAN server. Rebuild with `npm run build` and restart after source changes. `dev.mjs` includes local fault injection for testing pending-answer recovery; do not deploy it.

Useful additional commands:

```sh
npm run format:check
npm run benchmark
npm run benchmark:assets
npm run benchmark:models
npm run benchmark:diagnostics
node --expose-gc scripts/soak-classroom.mjs --output .sites-runtime/soak.json
```

### Verification and release discipline

Release 79 has a recorded **92-suite regression pass**. Curriculum validation recorded **17 profiles / 387 configured entries**, including legacy overlaps; that is not a unique-word count. A previously recorded accelerated 35-learner, 30-minute simulation exercised 30,452 requests, 3,209 race submissions and 200 replays with no unexpected errors.

These are results for the documented snapshots and local harnesses. They do not certify arbitrary future commits, production load, physical devices, school Wi-Fi or rendering frame rates. Release 79 browser checks covered teacher boards at 1366×768 and 1920×1080 plus student portrait, landscape and short-height layouts; see the [measurements and limits](docs/release-79.md).

For behavior changes, reproduce the failure, add a regression at the owning boundary, run the relevant checks, then complete the release checks. Rehearse join → avatar/ready → start → answer/retry → pause/resume → course transition → results/reset. Also verify ordinary practice, both interface languages, long text and touch/keyboard layouts. Document the evidence and remaining limitations; do not change release numbers for documentation-only work.

### Deployment, data and succession

The production environment needs a Worker, a persistent D1 binding named `DB` and a `TEACHER_PASSWORD` hosting secret. Apply missing migrations from `drizzle/` in order, tracking what has already been applied. Do not replay the whole directory blindly on a populated database. The current hosting identity is recorded in `.openai/hosting.json`; it is not a deployment credential or an automatic transfer of ownership.

**GitHub source, hosted application, production data and account access are separate handover items.** A Git push does not redeploy the Worker, migrate its database or update an already open browser. The in-app update check compares GitHub metadata with the deployed release; it does not execute downloaded code or deploy a server.

Before an ownership transfer:

1. Identify the hosting, database, domain and repository administrators, and arrange access through the providers. Transfer secrets privately, never in commits or issue text.
2. Record the deployed commit/interface release, hosting identity and database migration state. Back up production data through the database provider and verify restoration in an isolated environment.
3. Export teacher-edited materials/rules/custom audio with the teaching JSON backup. Export required results as CSV. Neither the source ZIP nor the teaching JSON is a full production-database backup.
4. Build and validate the successor environment with its own database, secrets and hosting identity. A new URL also requires new classroom links/QR codes.
5. Rehearse a class, confirm operational responsibility and update the public entry link and guides only after the successor service is ready.

`npm run backup:project` is a **Windows PowerShell** source-package helper. It excludes dependency/build/runtime folders and several credential-file patterns, but does not export D1 and is not a general secret scanner. Review a package before distributing it. The teacher starter ZIP contains only a launcher and guides and still requires the hosted service.

### Privacy, asset rights and next work

Student results, attendance exports, passwords and live databases must stay outside public Git history. Treat saved participation credentials and browser recovery data as sensitive. Teaching JSON excludes student results and passwords; document any changes to that boundary.

Bundled textbook illustrations, recordings, music and other third-party media retain their owners' rights. Public source availability is not a separate redistribution license. Review asset permissions and provenance before reusing the project for another school, textbook or distribution channel.

The existing architecture notes and changelogs are the record of previous decisions, not a requirement to keep adding layers. Prefer consolidating ownership and removing duplication. Future work should explicitly distinguish confirmed defects, measured performance issues and new product scope; changes such as school-specific accounts, new curricula or a different deployment model need their own design and migration plan.
