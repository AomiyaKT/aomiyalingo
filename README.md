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

English practice and multiplayer word races for Japanese elementary classrooms. Teachers manage lessons on a Windows computer; students scan a QR code with their iPads.

**Current version: Release 79 · 30 October 2026**
[Open the app](https://aomiyalingo.minamiyakk.chatgpt.site/) · [Changelog](CHANGELOG.md) · [Release 79 details](docs/release-79.md)

**Source release:** this repository contains Release 79. The hosted website is deployed separately; a GitHub upload does not update the running classroom server.

## Features

- Grade 5 Units 1-8 and Grade 6 Pre Unit-Unit 8, with pictures, pronunciation recordings and example sentences. Grade 5 includes 159 vocabulary entries.
- Japanese interface by default, with English available in the gear menu. Teachers sign in, then choose Vocabulary Practice or Word Race.
- Ten question types: meaning choice, listening choice, letter spelling, word matching, sentence ordering, sentence gaps, audio matching, audio sentence ordering, listening gaps and dictation.
- Short practice lessons, adaptive support, focused review, saved progress and detailed answer records.
- Three race courses, defaulting to six minutes of unlimited questions per course. Each student receives a separate randomized order. Includes avatars, readiness, late joining, items, streaks, live standings and a podium after each course.
- Teacher controls for pausing, ending, resetting, joining, reviewing errors, CSV export, and record deletion/restoration.
- Content checks, JSON backup/restore for teaching materials, rules and custom audio, plus a complete-project ZIP script.

- Shorter material selection: Elementary school / Blue Sky, Grade 5 or 6 buttons, then eight units for that grade; each mode remembers its selection.
- Ten race items, including Combo Shield, Swap Card, Treasure Challenge and Catch-up Magnet, with teacher switches and Japanese/English explanations.
- Teacher-only update checks under gear > Status: compare with GitHub, reload an already deployed newer version, and report releases awaiting server deployment. Active classes and unsaved work block reloads.

## Teacher guides

- [English PDF](public/help/teacher-guide-en.pdf)
- [Japanese PDF](public/help/teacher-guide.pdf)

Each guide has 15 pages and covers the current classroom workflow. The gear menu opens the guide matching the selected interface language.

## Recent updates

Release 79 unifies race transitions and student cleanup, isolates pending answer submissions from obsolete polls and responses, and stops old review audio when its screen changes. Replacing an unfinished race preserves its stopped clocks and no longer triggers a false course-clear celebration. Compact 35-student TV standings, responsive QR images and aligned QR headings improve classroom presentation. Scoring and stored records remain compatible; both 15-page Release 76 guides still apply. See the [release notes](docs/release-79.md) and [changelog](CHANGELOG.md).

## Verification

- Release 79: 92 regression suites passed. Local browser checks covered 35-student TV boards at 1366×768 and 1920×1080, iPad portrait/landscape and a short-height layout. See the release notes for measurements and limits.
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

Application source: interface Release 79; see the repository commit history for the exact snapshot. Hosting version numbers are separate from interface release numbers. Earlier development notes are preserved in `docs/project-history.md`.

Production student records, attendance exports, passwords, dependency folders, build output, runtime caches and temporary packages are excluded. Teaching JSON backups exclude student results and passwords; use CSV for results. Built-in media remain in this repository.

This repository contains the application source and bundled media. Bundled third-party media retain their original rights; this repository does not grant a separate redistribution license for those assets.
