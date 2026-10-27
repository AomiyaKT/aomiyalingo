# Release 74 — classroom readiness

## Teachers

Open settings (gear) → Status → **Content check** or **Backup & restore**. Japanese is the default; the same screens support English.

Content check inspects all curriculum profiles for missing referenced images/recordings, duplicate choices and normalized meanings, shared pictures, unusable example sentences, basic be-verb agreement, repeated words and overly long examples. These checks supplement a teacher's review of meaning, picture clarity and natural phrasing. They never rewrite teaching material. The shipped 17 profiles / 387 entries pass with no findings.

Backup & restore saves every configured curriculum, example sentence, practice/race rule and referenced custom recording in one JSON file (up to 8 MB). Built-in images and audio stay included in the complete application project. Student results, attendance numbers, sessions and passwords are excluded from teaching backups; use the existing CSV export for results.

Restoring first previews the curriculum/word/audio counts. Confirmation replaces future teaching settings, with optimistic revision protection. Ongoing classes/races retain their snapshots and results. Custom recordings get new IDs to avoid overwriting historical audio. The previous settings are saved automatically and can be downloaded from the same page. Settings/audio import is atomic: a failure rolls back both.

The race header now emphasizes Start, Pause/Resume, End, or Next Course according to its stage. Admission and Reset controls sit with the QR/participants. Practice setup stays out of the live progress screen; Prepare a New Lesson remains available beside the current class. End stays beside Pause.

## Performance

Student race polling now advertises a credential-scoped snapshot key. The server reuses unchanged personal history, learning summary, task and review cards; scores, personal clocks and standings stay current. Initial loads and older clients receive full data. Missing local snapshots recover with a full read. The cache is bounded to two credentials. In the included 180-answer fixture the response shrinks from 20,306 to 2,313 bytes on an unchanged poll; workload-specific sizes vary.

Practice and race clients opportunistically warm the HTTP cache for up to two next-task resources, one low-priority transfer at a time. Only same-origin vocabulary image/recording paths are allowed. Warming does not play audio, expose an answer payload, submit a response or advance learning state. Hidden/offline/save-data/2G pages stop warming; speculative downloads have size/time limits and bounded de-duplication. Adaptive race hints contain resource paths, not future task solutions.

## Verification commands

- `npm run check`: delivered Worker/client, regression and feature tests.
- `npm run content:check`: local media signatures and curriculum diagnostics.
- `npm run backup:project`: creates a complete ZIP in the parent Backups directory and verifies every source/media file against a SHA-256 manifest. Runtime secrets, build caches, dependencies and Git internals are excluded. Teachers can open the included Japanese HTML launcher to use the hosted application; rebuilding/deploying the source requires developer tooling.
- `node --expose-gc scripts/soak-classroom.mjs --output .sites-runtime/soak-74.json`: accelerated 30-minute / 35-learner local model. It uses the real Worker APIs and SQLite, ordinary practice, three endless courses, all exercise modes, late readiness, pause/resume, item use, offline polls, lost-acknowledgement retries, saved results and fresh setup. Reports local API timing, payloads and retained Node heap. It is not a physical iPad/Wi-Fi/FPS or 30-minute wall-clock measurement.

## 日本語：バックアップの使い方

1. 歯車 → 「状態」→「バックアップと復元」を開きます。
2. 「バックアップを保存」で教材・ルール・自作音声のJSONファイルを保存します。
3. 別の環境へ移すときは、同じ画面でJSONを選び、件数を確認して「この内容を復元」を押します。
4. 直前の設定へ戻したいときは「復元前の設定を保存」で自動バックアップを保存し、そのJSONを選んで復元します。
5. 内蔵画像・音声を含むアプリ本体は、完全プロジェクトZIPにまとめてあります。ZIP内の「先生用を開く.html」はインターネット接続が必要です。
