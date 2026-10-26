# v59 · Whole-project maintenance pass

This pass targets shared statistics, student polling and delivery/check tooling.
It preserves teaching content, UI, race points, timing, stored histories and schema.

## Statistics

Ordinary-practice diagnostics now keep one first/latest/count/hint aggregate per
word/type, rather than sorting all history and retaining arrays of all grouped rows.
The chronological comparison and tie behavior are unchanged. Review attempts retain
their existing ordinary-practice diagnostic semantics; race scoring is untouched.

Classroom word difficulties and type counts are accumulated together. Difficulties
still count distinct learners, duplicate skill rows still select the first match,
and mode discovery and tie ordering retain the v58 behavior.

`tests/references/diagnostics-v58.mjs` is the frozen previous implementation, used
only by tests and the benchmark. Thirty-six seeded mixed histories compare complete
results, including unordered attempts, same-time ties, missing sequences, hints,
review rows, sparse learners, duplicate skills and input immutability.

## Polling and delivery

Student status/heartbeat/label endpoints no longer deserialize the full saved lesson.
Authentication remains mandatory. Lesson retrieval, starts and answers continue to
use the authoritative stored lesson; paused starts stop before deserialization.
No database query or authorization contract is loosened.

Every delivered HTML screen now receives SHA-256 query versions for its local JS/CSS
entry points. The build fingerprints final bundled bytes, so changing an imported
module invalidates its entry point. External URLs, navigation, images and inline
scripts are excluded. Other query parameters, fragments and script order survive.
HTML remains `no-store`; static resources retain existing ETags and bounded caching.
The old source-page query labels are development hints, replaced by the build.

The check runner deduplicates syntax targets and uses four continuously filled
workers rather than four-file batch barriers. Suites retain separate processes and
databases. False results and rejections are reported; subsequent suites still run.

## Measurement

Run `npm run benchmark:diagnostics`, optionally with
`-- --output output/benchmark-diagnostics59.json`. It first asserts full old/new
output equality. The workload is 35 learners, 80 words, seven types and 2,400
attempts per learner, with deliberately unordered timestamps. Each measurement uses
10 warmups and 60 samples on the same machine.

| CPU workload | v58 median | v59 median | v58 p95 | v59 p95 |
| --- | ---: | ---: | ---: | ---: |
| All learner diagnostics | 73.820 ms | 46.557 ms | 81.673 ms | 47.960 ms |
| Classroom teaching summary | 4.293 ms | 1.913 ms | 5.120 ms | 2.943 ms |

Median CPU time fell approximately 37% and 55% respectively in this synthetic run.
These are model-only measurements, not database, network, iPad, whole-page or
production-classroom latency claims. Real histories vary in size and distribution.

## Validation

Run `npm run check` for syntax checks, a fresh build and all 58 regression suites.
Four suites were added: old/new diagnostics equivalence, student fast paths, bounded
queue scheduling/failure handling, and final delivered asset fingerprints. The last
checks all 54 script/stylesheet references across six HTML screens against the
actual served bytes' validators, including bundled entry points.

Existing tests continue covering authentication, concurrent answers, retry receipts,
class/race controls, custom curricula, legacy saves, all exercise families, teacher
records, music isolation and rendered component behavior. No production student
records are used by tests or benchmarks. No physical-device or classroom load test
is claimed for this internal maintenance release.
