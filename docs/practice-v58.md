# v58 · Ordinary word practice

The ordinary-practice path receives its own maintenance pass, covering student entry,
answer saving, navigation and teacher reading panels. This does not change question
counts, spaced review policy, accuracy calculations or stored classroom snapshots.

## Student flow

- A thin classic browser facade supplies the environment to the classroom session.
- A separate transaction owner persists one pending answer before sending it. Retries
  preserve the question ID, structured answer, hint flag and original credential.
- A second answer cannot overwrite an unsent one. A response from a previous session
  cannot update the current lesson, clear its pending answer or unlock its request.
- When an old acknowledgement becomes obsolete, its original durable slot remains
  available for a later idempotent receipt replay. Server scoring remains authoritative.
- Start requests and duplicate taps are guarded. Returning to the path/book prevents a
  delayed start response from taking over the screen. Saving while on the path updates
  the saved progress without canceling an intentional start.
- Existing draft and session keys remain compatible, including the old sessionStorage
  fallback. Storage access stays inside guarded reads/writes.

## Reading and presentation

Built-in vocabulary illustrations are displayed in study cards with their word,
Japanese meaning, example and pronunciation button. Desktop/tablet cards use a
two-column layout; narrow screens stack the content. Words without an illustration
retain the existing plain card. Failed images fall back to the plain layout.

Teacher weak-word chips, recent mistakes, projection lesson groups and projection
review words retain their DOM identity across unchanged polls. New answers and class
switches invalidate the relevant sections. Activity labels continue updating.

## Regression coverage

Five suites were added:

- `practice-transactions`: durable slot, duplicate exclusion, offline/pause retry,
  captured credentials, stale-session completion/failure, receipt replay and start recovery.
- `practice-navigation`: duplicate starts, superseded requests, path/book return and cleanup.
- `practice-session`: saved-session recovery, vocabulary scoping, old-token/status isolation,
  duplicate join suppression and stale entry responses.
- `practice-panels`: unchanged reading nodes, live activity, answer/class invalidation,
  and illustrated/plain study cards.
- `practice-delivered`: executes the delivered classic classroom bundle against the
  actual Worker API, including QR join, curriculum, start, draft, answer saving,
  notification and one-time next-lesson handoff.

Use `npm run check` for the complete regression set. All test databases and preview
classes are local; production learners and records are not used for rehearsal.

The final 54-suite regression run passed. Browser rehearsal also covered a four-word
adaptive class, an injected answer-save failure with disabled next-question navigation,
successful retry, exactly one progress advance, matching, letter-by-letter spelling,
English listening choices, a 4/4 round result, return to the saved path and illustrated
study cards. This is local browser validation, not a physical iPad classroom load test.
