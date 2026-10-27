# Release 73: classroom refresh performance

Changes target repeated classroom work; scoring, task order, class records and existing teaching content remain authoritative on the server.

- Teacher race reads advertise at most 60 locally cached record revisions, scoped to a race ID. The server sends full history only for changed/new participants. Initial loads, legacy clients and malformed manifests receive full records. A missing local snapshot triggers one full reload. Authentication is unchanged.
- Race polling waits for completion, adds up to 15% jitter and stops while hidden. Lobby/running: 2 seconds; countdown: 0.5 seconds; paused: 4 seconds; finished: 5 seconds. Failures back off, healthy responses reset the delay. Foregrounding refreshes immediately. These are refresh intervals, not answer submission delays.
- Teacher controls and the participant-count block render only when their visible inputs change. Music state events only fire on changes. Timer values and rankings continue updating.
- Student lane scores and participant captions retain their nodes and unchanged text. A hidden podium does no work, and visible podium keys contain display fields rather than complete answer histories.
- An unchanged race session no longer rewrites synchronous localStorage. Pending answers, acknowledgements and token changes still persist immediately.

## Reproducible checks

`tests/race-record-sync.test.mjs`: synthetic 35 learners × 180 answers. JSON response sizes (uncompressed; not a claim about measured classroom network throughput):

| Response | Bytes |
| --- | ---: |
| Full record snapshot | 872,652 |
| No records changed | 2,832 |
| One learner changed | 27,716 |

The unchanged response is 99.68% smaller. `tests/race-record-sync-http.test.mjs` additionally checks the delivered Worker against a real in-memory database, two teacher endpoints, one learner update, full-reload equivalence and unauthenticated rejection.

`tests/race-refresh-view.test.mjs`: 100 unchanged refreshes with 35 participants, using the same instrumented DOM adapter for the old and new view. Before: 7,000 created nodes / 10,500 text writes. After: zero / zero in lane scores, labels and participant captions. This counts DOM work; it is not an FPS measurement. The hidden podium is skipped, and meaningful winner changes still update the cards.

`tests/poll-scheduler.test.mjs` covers pending-request exclusion, jitter, hidden suspension, foreground refresh, countdown cadence, backoff, recovery and disposal. `tests/race-session-storage.test.mjs` covers 1,000 unchanged saves plus durable pending-answer acknowledgement and token replacement.

To rehearse visually, build and start `dev.mjs` with a local `TEACHER_PASSWORD`, then run `tests/performance-preview-seed.mjs` with the same environment variable. It targets only `127.0.0.1:8767` and creates disposable preview records. Do not load-test production.

Limits: the server still reads current participant states to calculate authoritative standings. Latency also depends on classroom Wi-Fi, iPad/browser and hosting. This release reduces avoidable work rather than guaranteeing a frame rate on untested hardware.
