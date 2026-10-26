# Resource delivery and curriculum defaults · v56

This pass targets repeated CPU work and duplicated configuration construction. It
does not change exercises, scoring, animations, authentication or saved records.

## Public assets

Previously every asset request decoded its entire base64 payload with
`Uint8Array.from(atob(data), callback)`, including HEAD requests. A 35-device class
can request the same word audio or illustration repeatedly.

The dedicated responder now uses:

- A direct byte-copy loop on a cold decode.
- A byte-bounded LRU for decoded public assets: 4 MiB total, 256 KiB per entry.
- An oversized-file bypass for music and fonts.
- Build-time SHA-256 validators and exact final byte lengths, including bundled CSS/JS.
- No decoding on HEAD or matching If-None-Match; matching GETs return 304.

HTML remains `no-store`. Private/configuration/student API responses never use the
asset responder or its cache. Cache memory belongs to one Worker isolate and is
disposable; correctness does not depend on a warm cache.

## Reproducible local measurement

Run `npm run benchmark:assets`, or pass `--output <path>` to
`node scripts/benchmark-assets.mjs` to retain JSON output. The script uses one real
70,138-byte word recording, 35 requests per sample, eight warm-ups and 40 samples.

Observed on this Windows host with Node 24.22.1:

| Operation | Median, ms | p95, ms |
| --- | ---: | ---: |
| Previous GET response construction | 423.559 | 458.619 |
| Optimized cached GET response construction | 5.837 | 12.447 |
| Previous HEAD response construction | 426.099 | 480.264 |
| Optimized HEAD response construction | 0.258 | 0.601 |
| Optimized matching-validator response | 0.268 | 0.475 |
| Optimized cold decoding only | 12.764 | 18.451 |

These are synthetic local CPU measurements, not network latency, production Worker
timings or a 35-device classroom load test. The cold-decoding row excludes response
construction and should not be compared as an end-to-end request. JIT, GC, runtime
and cache state affect timings. Correctness tests enforce bounds and byte integrity;
timings are deliberately not test thresholds.

## Curriculum construction

One factory now builds each profile directly from its own vocabulary. The previous
Grade 5, Unit 7 and six new-unit initializers all constructed the legacy 28-word
profile and discarded those words before constructing the requested bank. Removing
that work avoids 224 discarded word objects and their distractor arrays on a fresh
all-profile load.

The registry drives profile initialization, and built-in picture lookups are shared
read-only maps. Editable word objects and all configuration arrays remain separate
between profiles, modes and requests. No configuration cache or database migration
was introduced. Existing profiles, explicit image omissions, teacher examples and
rule edits are preserved.

## Verification

The asset suite exercises eviction order, cache bypass, repeated byte-exact reads,
response-buffer mutation isolation, validator lists/weak validators, HEAD/304,
bundled metadata and uncached HTML/API paths. Configuration checks cover fresh
defaults, missing-profile upgrades, teacher edits and mutable-state isolation.
The complete regression command remains `npm run check`.
