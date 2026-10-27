# Aomiyalingo

**English** | [日本語](README.ja.md)

English practice and multiplayer word races for Japanese elementary classrooms. Teachers manage lessons on a Windows computer; students scan a QR code with their iPads.

**Current version: Release 75 · 27 October 2026**  
[Open the app](https://aomiyalingo.minamiyakk.chatgpt.site/) · [Changelog](CHANGELOG.md) · [Release 75 details](docs/release-75.md)

## Features

- Grade 5 Units 1-8 and Grade 6 Pre Unit-Unit 8, with pictures, pronunciation recordings and example sentences. Grade 5 includes 159 vocabulary entries.
- Japanese interface by default, with English available in the gear menu. Teachers sign in, then choose Vocabulary Practice or Word Race.
- Ten question types: meaning choice, listening choice, letter spelling, word matching, sentence ordering, sentence gaps, audio matching, audio sentence ordering, listening gaps and dictation.
- Short practice lessons, adaptive support, focused review, saved progress and detailed answer records.
- Three race courses, defaulting to six minutes of unlimited questions per course. Each student receives a separate randomized order. Includes avatars, readiness, late joining, items, streaks, live standings and a podium after each course.
- Teacher controls for pausing, ending, resetting, joining, reviewing errors, CSV export, and record deletion/restoration.
- Content checks, JSON backup/restore for teaching materials, rules and custom audio, plus a complete-project ZIP script.

## Teacher guides

- [English PDF](public/help/teacher-guide-en.pdf)
- [Japanese PDF](public/help/teacher-guide.pdf)

Each guide has 11 pages and covers the current classroom workflow. The gear menu opens the guide matching the selected interface language.

## Recent updates

Release 75 updates both teacher guides and their language-aware download link. Release 74 adds student incremental synchronization, next-task media prefetch, stage-based teacher controls, content checks and teaching backups. Release 73 reduces repeated teacher refresh/rendering work. Release 72 completes all Grade 5 units and media. See the [changelog](CHANGELOG.md).

## Verification

- 75 regression suites passed.
- 17 curriculum profiles / 387 configured entries passed content checks with zero errors or warnings. These include legacy compatibility profiles; the count does not represent 387 unique vocabulary words.
- Accelerated 30-minute classroom simulation with 35 learners: 30,452 requests, 3,209 race answer submissions, 200 replayed requests and zero unexpected errors.
- The simulation used local Worker APIs and SQLite. It does not replace physical iPad, classroom Wi-Fi or frame-rate testing.

## Development

Use Node.js 24 LTS and npm. The local preview uses Node's built-in SQLite support.

```sh
npm ci
npm run check
npm run content:check
```

Set a local teacher password and start the temporary preview in PowerShell:

```powershell
$env:TEACHER_PASSWORD = 'choose-a-local-preview-password'
node dev.mjs
```

Open http://127.0.0.1:8767/. Preview records disappear when the process stops.

```sh
npm run build
npm run backup:project
node --expose-gc scripts/soak-classroom.mjs --output .sites-runtime/soak.json
```

The hosted app uses a Cloudflare Worker and a persistent D1 database bound as `DB`. Set `TEACHER_PASSWORD` through the hosting provider's secret settings. Apply migrations in `drizzle/` in order. Build output is `dist/server/index.js`.

The existing deployment identity is retained in `.openai/hosting.json`. Uploading to GitHub does not redeploy the app, transfer the production database, or create an offline server. A separate hosted instance needs its own hosting identity, database and secrets. Teachers using the hosted app need only a browser and internet access.

## Project layout

| Path | Purpose |
| --- | --- |
| `public/` | Browser UI, localization, fonts, pictures and audio |
| `server/` | Classroom, race, editor and storage logic |
| `db/`, `drizzle/` | Database schema and migrations |
| `tests/`, `scripts/` | Regression checks, benchmarks, classroom rehearsal and backup tools |
| `public/help/teacher-guide.pdf`, `public/help/teacher-guide-en.pdf` | Current Japanese and English teacher guides |
| `ARCHITECTURE.md`, `docs/` | Architecture, release notes and earlier development notes |

## Source and privacy

Application snapshot: `5a04ce1f40d4bad9e2e2178d5690d8fbe0965a8c` (interface Release 75). Hosting version numbers are separate from interface release numbers. Earlier development notes are preserved in `docs/project-history.md`.

Production student records, attendance exports, passwords, dependency folders, build output, runtime caches and temporary packages are excluded. Teaching JSON backups exclude student results and passwords; use CSV for results. Built-in media remain in this repository.

This is a private project backup. Bundled third-party media retain their original rights; this repository does not grant a separate redistribution license for those assets.
