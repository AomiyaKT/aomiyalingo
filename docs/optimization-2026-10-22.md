# Code optimization audit · v51 · 2026-10-22

This release preserves the UI, question generation, scoring, streaks, items, station rules, teacher authorization and stored records. It also fixes a student startup regression: the shared race entry point previously instantiated the teacher records view on student pages.

## CPU measurements

Synthetic local Node workload: 35 learners, 180 answer records each, 120 samples after warm-up. These are CPU-step timings, not browser load times, network latency, database benchmarks or production load certification. Millisecond timings vary with host activity.

| Operation | Before median | After median | After p95 |
| --- | ---: | ---: | ---: |
| race_board | 3.542 ms | 3.214 ms | 5.119 ms |
| record_summaries | 1.119 ms | 0.492 ms | 0.66 ms |
| teaching_summary | 3.495 ms | 0.372 ms | 0.533 ms |
| unchanged_record_poll (new cache path) | — | 0.018 ms | 0.026 ms |

Run `npm run benchmark` to repeat the workload. `node scripts/benchmark-race.mjs --output output/benchmark.json` saves machine-readable results.

## Deterministic checks

- Unchanged record revisions trigger no repeated history analysis. One changed learner invalidates only that learner. Closing a panel defers its table rendering.
- An unchanged 35-player ranking performs zero row-rectangle reads and zero leaf-text writes. Two swapping players require four rectangle reads and two animations. Reduced motion performs neither.
- Cache ownership resets on race changes, roster removal and history replacement. Historical clients without revisions still detect edits. Reading snapshots do not mutate.
- Race summary results match the previous filtering semantics for empty, legacy, three-station and long histories. Hint and review exclusions are preserved.
- Preindexed classroom statistics equal the previous whole-class input for each learner, including timestamp/sequence tie handling.
- The actual student composition root is executed for direct and room-QR entry, with teacher adapters forbidden.

## Verification

38 regression suites passed, plus formatting and a production build. Browser rehearsal at 1024×768 verified attendance entry, avatar choice, readiness instructions, countdown, a meaning answer, a repeated-letter spelling answer, streak scoring, reload recovery, teacher synchronization, lazy records and no console errors. This was a disposable local classroom; no production student data was changed.

All source, benchmark output and delivery files remain under `F:\gpt ojosama\Aomiyalingo`.
