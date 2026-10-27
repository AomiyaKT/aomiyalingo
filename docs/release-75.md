# Release 75 - Japanese and English teacher guides

Both teacher PDFs are current as of 27 October 2026. Each has 11 short, large-text pages covering teacher login, language switching, Vocabulary Practice, ten exercise types, joining/starting races, three default six-minute endless courses, scoring/items, student instructions, results/reset/deletion, device settings, content checks, backups and troubleshooting.

The material scope now reflects Grade 5 Units 1-8 and Grade 6 Pre Unit-Unit 8. The guides distinguish score from accuracy, reset from deletion, reversible bin actions from permanent deletion, and teaching JSON backups from result CSVs and complete project files.

The gear menu's Help tab opens the Japanese PDF by default. Selecting English switches both its label and target to the English PDF, including after a same-page language change or loading a saved language preference. Student pages do not gain teacher-guide links.

Files: `public/help/teacher-guide.pdf` (Japanese) and `public/help/teacher-guide-en.pdf` (English). Rebuild them with `python scripts/build-teacher-guides.py`; this needs reportlab, pypdf and the four specified fonts (see `--font-dir`). Generated copies also appear in ignored `output/pdf/`. All pages link to the canonical app address.

The guide-only release does not alter scoring, progress, race rules or stored classroom data. Both PDF files are delivered through the built Worker, with language fallback and exact returned bytes checked in `tests/settings-status.test.mjs`. PDF page counts, extracted text and links are validated by the generator, and all rendered pages are visually reviewed.
