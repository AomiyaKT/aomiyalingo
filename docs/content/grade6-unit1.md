# Grade 6 · Pre Unit–Unit 1

The supplied vocabulary page is titled **Pre Unit–Unit 1**. This combined page is
one selectable curriculum, `6-1`, with independent `unit1` practice/race settings.
It contains all 27 entries in textbook order, including the four distinct singular/
plural animal expressions and the original capitalization of `English`.

| Section | Entries |
| --- | --- |
| Green bands | like, have, want, math, English, music, a cat, cats, a dog, dogs |
| Pink bands | swimming, surfing, dancing, cooking, skiing, skating, running, singing, drawing, speaking English, playing soccer, playing the piano, food, sport, color, subject, animal |

Japanese meanings are assistant translations retained in the reference metadata;
the supplied English vocabulary page does not print Japanese glosses. English
examples are original classroom prompts, such as “I like swimming.” and “My favorite
subject is math.” They are used by sentence ordering, sentence gaps and listening
exercises, alongside the existing meaning, matching, spelling and picture families.
Each course continues using the shared adaptive engine and stored progress format.

## Assets and reproduction

`scripts/import-grade6.mjs` reads `../Textbook_Reference/Blue_Sky_Elementary_6/Unit_01/metadata/vocabulary.json`
and copies its 27 native PNG crops into `public/assets/vocabulary/g6-unit1/`.
The full source page is not included in public assets. The illustrations exclude
printed English answer labels. Each mapping/hash is recorded in
`docs/content/grade6-image-sources.json`.

These are native screenshot crops (108 pixels wide), not publisher HD originals or
AI upscales. Their source quality remains explicitly recorded. The `like`, `have`
and `want` pictures do not uniquely communicate an abstract meaning, so their
default `pictureEnabled` is false while their study-card images remain available.
The teacher editor can change that setting.

All 27 word/phrase pronunciations have local WAV paths. New clips were synthesized
using the existing `scripts/record-grade6-audio.ps1` workflow and Microsoft Zira
Desktop, reusing an existing compatible clip when present. These are synthesized
English pronunciations, not publisher recordings. Sentence listening retains the
existing device speech path.

To reproduce: run `node scripts/import-grade6.mjs`, then
`./scripts/record-grade6-audio.ps1`, then rerun the importer to resolve audio paths.

## Compatibility and validation

- Teacher practice, race and editor screens all include `6-1`.
- Existing stored configuration receives a missing Unit 1 profile without changing
  neighboring units. Legacy editor saves cannot erase a teacher's Unit 1 edits.
- Classes/races take immutable vocabulary/settings snapshots as before.
- `grade6-curricula.test.mjs` now covers all eight Grade 6 units and 600 successful
  ordinary-practice submissions. Every word is materialized at both support levels
  through all three race-station type sets; each unit also creates its own race.
- Unit 1 assertions verify all 27 exact entries, image bytes against source hashes,
  native dimensions, WAV headers, example gaps, phrase spelling, independent profiles
  and preservation across older editor submissions.
- Local browser rehearsal covered teacher selection, the in-mode editor with 27
  words and images, QR attendance entry, the adaptive learning path, a displayed
  picture question, successful submission/feedback and the endless race setup.

Run `npm run check` for the complete regression suite. Browser rehearsal uses a
local in-memory classroom and synthetic attendance number, not production records.
