# Grade 5 · Blue Sky elementary 5

Release 72 adds all eight vocabulary appendix units to teacher setup, the editor,
ordinary practice and the three-stage race. Japanese is the default UI; the same
selectors work in English.

| Unit | Focus | Entries |
| --- | --- | ---: |
| 1 | School subjects and feelings | 14 |
| 2 | Months | 12 |
| 3 | Daily routines and household tasks | 11 |
| 4 | Actions and abilities | 12 |
| 5 | Family and personal qualities | 20 |
| 6 | Food, drinks, desserts and tastes | 32 |
| 7 | Positions, town facilities and directions | 36 |
| 8 | Countries and travel verbs | 22 |
| **Total** | | **159** |

English vocabulary was checked against the user's licensed digital reader on
2026-10-26. Unit 6 continues with **healthy / delicious** on appendix page 13;
Unit 7 continues with eight directions on page 15. Alphabet tracing rows are not
vocabulary questions. Japanese glosses and example sentences are authored classroom
content, rather than a copy of the textbook's lesson pages.

All entries have a native-pixel illustration crop and a local English WAV recording.
No upscaling is used. Full reader references, CSV, per-unit contact sheets and crop
metadata remain in `../Textbook_Reference/Blue_Sky_Elementary_5/`; only individual
illustrations are served by the app. Tracked hashes and source-page mappings are in
`grade5-image-sources.json`. Classroom image usage requires the relevant textbook
permission; source availability does not grant a redistribution license.

New units use the existing adaptive exercise engine (picture vocabulary, pairs,
listening, spelling, sentence ordering, cloze and dictation). Abstract healthy /
delicious judgements and family portraits retain pictures on study cards but do not
default to picture-only assessment. A portrait cannot uniquely identify kinship.

Unit 5 keeps the stable `grade5` profile and value `5`, old format, saved settings
and class/race snapshots. Missing pictures are backfilled; explicit `image: null`
and teacher-authored meanings/examples are preserved. Other Grade 5 profiles have
keys `grade5unitN` and selector values `5-N`.

`P.E.` is stored as printed, with fixed punctuation in spelling tiles and a `p-e.wav`
recording. Configuration validation accepts dotted letter abbreviations, and the
sentence-gap matcher handles the trailing period without matching word fragments.

To rebuild verified assets:

```powershell
python ../Textbook_Reference/Blue_Sky_Elementary_5/prepare_reference.py
node scripts/import-grade5.mjs
./scripts/record-grade5-audio.ps1
node scripts/import-grade5.mjs
node scripts/check.mjs
```

Regression coverage includes all 159 image/audio mappings, all adaptive exercise
families at two difficulty levels, 477 authoritative practice submissions, all
eight class/race curricula and legacy editor saves.
