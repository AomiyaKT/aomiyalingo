# v62 · Presentation maintenance

This pass preserves teaching content, visible layout, scoring, timing, item
probabilities, saved records and database schema.

## Changes

- Race presentation compares values before writing stage/progress text, ARIA
  labels, marker positions and clock tone. Each controller caches its reduced
  motion media query instead of recreating it on each event.
- Showtime and spectacle reuse `effects/motion.js`. Owned animations, particle
  layers and timers are cleared on pause, station changes, hidden documents and
  reduced-motion settings. Explicit disposal removes owned event listeners and
  elements. Existing stale-tab and duplicate-event protections remain in place.
- Student viewport updates reuse cached action-bar geometry during visual
  viewport events. ResizeObserver and window resize invalidate that cache;
  browsers without ResizeObserver retain measurement on updates. Disposal blocks
  stale queued observer callbacks.
- `shared/race-items.js` supplies immutable item names, icons and existing static
  descriptions to the rules and presentation modules. The briefing still derives
  descriptions from the actual teacher-configured points and counts.

## Verification

`tests/race-presentation-work.test.mjs` runs the real showtime/spectacle controllers
against an instrumented DOM and fake clock. After initial rendering, 1,000
unchanged race updates and normal-zone clock samples perform no repeated text,
attribute, hidden-state, dataset or style writes and create no new media queries.
It also checks cleanup on pause, hidden documents, settings and disposal, shared
item metadata, immutability and customized briefing counts.

`tests/student-viewport.test.mjs` verifies that 100 visual viewport scroll events
cause no additional footer geometry reads after initial measurement. Footer
changes still invalidate the measurement; callbacks after disposal schedule no
new frame. Existing keyboard inset and input-reveal assertions remain.

`node scripts/check.mjs` passed syntax checks, a fresh build and all 61 regression
suites, including the existing race/classroom rehearsals. These are instrumented
controller checks, not a whole-app speed percentage or physical-iPad benchmark.
