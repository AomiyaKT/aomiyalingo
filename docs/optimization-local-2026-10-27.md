# Local optimization - 27 October 2026

Originally prepared locally on top of Release 75, this work is included in the Release 76 source snapshot. Publishing the source does not redeploy the hosted application.

## Race task decoding

`server/race/task-reader.mjs` reuses exact-JSON teaching snapshots across fresh database rows. Shared objects are recursively frozen. A four-entry LRU retains at most 524,288 source characters in total; this is a source-text budget, not a claim about measured JavaScript heap usage. Oversized snapshots remain reusable within one request-local row but do not enter or evict the shared cache. Invalid JSON is not cached.

Live room status, time, revision, admission and learner states still come from the authenticated database path. Mutable learner objects are never shared across database row objects. Updated material JSON invalidates immediately, regardless of room ID. The cache does not skip an authorization or database read and cannot resume a deleted room.

`raceSave` serializes a successful answer state once and returns the exact string bound to the database write. Existing revision/timer guards remain in place.

## Ordinary practice rendering

The teacher screen decodes its material JSON and updates the legacy shared vocabulary array only when the snapshot changes. Fallback material, class switching and material edits still update the view.

Unchanged teacher labels no longer rewrite text nodes. English labels are compared with the current translation, while actual changes still write Japanese source text for the existing reversible language observer. Switching back to Japanese therefore preserves the original interface strings. Learning content and teacher-authored titles continue through their existing translation protections.

## Verification

- 77 regression suites passed, including the delivered Worker/client, full curriculum, race/classroom lifecycle, grading, retries, privacy, snapshots and language tests.
- New targeted tests check recursive immutability, exact-JSON invalidation, LRU and size eviction, oversized bypass, live status fields, mutable learner isolation, single serialization, vocabulary parsing and unchanged Japanese/English labels.
- `node scripts/benchmark-refresh-work.mjs --output .sites-runtime/refresh-benchmark.json` compares the previous decoding algorithm with the new reader using 35 fresh DB-like strings and 72 tasks. It also counts repeated material parsing and source/translation writes in a synthetic label adapter.

Local synthetic results for a 20,878-character snapshot (120 samples):

| Work | Previous | Current |
| --- | ---: | ---: |
| Parses across 35 fresh rows, cold | 35 | 1 |
| Parses across 35 fresh rows, warm | 35 | 0 |
| Median CPU time per 35-row batch | 9.3433 ms | 1.4923 ms warm / 1.7139 ms cold |
| Vocabulary parses across 100 unchanged practice refreshes | 100 | 1 |
| Source/translated writes for one unchanged English label, 100 refreshes | 200 | 0 |

These measurements cover local helper work with synthetic inputs. They are not end-to-end request latency, physical iPad performance, classroom Wi-Fi throughput or browser FPS. The existing database reads and authoritative player-state parsing remain necessary.
