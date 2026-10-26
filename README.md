# Aomiyalingo

A classroom English practice and multiplayer word-racing app for Japanese elementary school students. Teachers run lessons from a Windows computer; students join by scanning a QR code on their iPads.

Live app: https://aomiyalingo.minamiyakk.chatgpt.site/

## Features

- Japanese interface by default, with an English interface available in Settings.
- Teacher login, configurable vocabulary, lesson settings and game rules.
- Grade 6 Pre Unit–Unit 8 and Grade 5 Unit 5 curriculum profiles.
- Ten exercise types, including matching, spelling, sentence building, gap fills and listening.
- Short practice lessons, saved progress, hints and focused review.
- Multiplayer races with three timed courses, personal question orders, late joining, avatars, readiness and items.
- Live standings, per-course podiums, teacher diagnostics, CSV export and recoverable record deletion.
- Local fonts, pronunciation audio, illustrations and a Japanese teacher PDF guide.

## Development

Use Node.js 24 LTS and npm. The local preview uses Node's built-in SQLite support.

```sh
npm ci
npm run check
```

`npm run check` performs syntax validation, builds the app and runs the regression suites. The latest completed full run contained 65 suites.

Set a local teacher password, then start the in-memory preview. In PowerShell:

```powershell
$env:TEACHER_PASSWORD = 'choose-a-local-preview-password'
node dev.mjs
```

Open http://127.0.0.1:8767/. Preview data is temporary and disappears when the process stops.

```sh
npm run build
```

Build output is written to `dist/server/index.js`. The hosted application uses a Cloudflare Worker and a durable D1 database bound as `DB`. Configure the production `TEACHER_PASSWORD` through the hosting provider's secret settings; do not commit it. Apply the SQL migrations in `drizzle/` in order when setting up a new database.

The existing deployment identity is retained in `.openai/hosting.json`. Uploading this repository does not deploy the app or move the production database. To run a separate hosted instance, configure its own hosting identity, database and secrets.

## Project layout

| Path | Purpose |
| --- | --- |
| `public/` | Browser UI, exercise controllers, localization and bundled media |
| `server/` | Classroom, race, configuration and storage logic |
| `drizzle/`, `db/` | Database migrations and schema |
| `tests/` | Regression and classroom-rehearsal suites |
| `scripts/` | Checks, benchmarks and maintenance tools |
| `public/help/teacher-guide.pdf` | Japanese teacher guide |
| `ARCHITECTURE.md` | Module boundaries and maintenance notes |
| `docs/` | Design, refactoring and historical development notes |

## Repository snapshot

This repository begins with the current application source snapshot from 26 October 2026 (source commit `d9d2172f100edd5e9be4ffd65cc351331f836a6d`, interface release 71). The earlier development README is preserved in `docs/project-history.md`.

Production student records, exported grades, passwords, dependency folders, build output, old delivery packages, temporary files and the original development Git history are not included.

This is a private project backup. Bundled third-party media retain their original rights; this repository does not grant a separate redistribution license for those assets.
