# v61 · Tablet layout and race presentation

Scope: tablet answer layout and race entertainment. The vocabulary, scoring,
randomization, personal clocks and persisted classroom/race state retain their
existing contracts. No migration or dependency installation is required.

## Tablet layout

- Ordinary practice reserves the measured action/feedback bar height rather than
  assuming that text and buttons always fit a fixed amount of space.
- The student race action row is fixed while answering; questions and item controls
  can scroll fully above it. Safe-area bottom padding remains included.
- Visual viewport changes update keyboard insets. An occluded input is revealed;
  visible inputs are left alone. This behavior has an injected viewport regression
  test and requires real Safari/device confirmation for hardware-specific behavior.
- Phrase slots wrap within the available width while retaining word groups. Letter
  controls retain at least 44×48 CSS-pixel targets. Pair/tile text can wrap.
- Landscape picture tasks use picture/choices columns. Portrait keeps the stacked
  layout. Touch/tablet layouts omit hardware-keyboard tips; keyboard input remains
  available. The legacy role visibility class was removed from that tip so it no
  longer overrides the responsive rule with an important display declaration.
- A new question clears the previous answer's feedback class, avoiding a leftover
  success/error symbol on an empty feedback line.

## Race events

Presentation uses saved server snapshots/receipts, not speculative client scores.
Short, non-interactive notices mark a student gaining positions, a teacher's leader
changing, three or multiples of five independent correct answers, item activation,
the last 30 personal seconds and course completion. Only the student's own clock
gets final-seconds cues; the teacher does not hear each participant's countdown.

Initial loads and unchanged polls do not replay overtakes. Receipt IDs deduplicate
streaks. Race/station changes reset ownership; pause hides transient effects and
visibility changes suppress catch-up announcements. The last-five-second cue only
plays on a decreasing second. Notices use text nodes and do not capture gestures.

The item reveal has a moving, blurred slot symbol, shaded window and a short landing
animation. It retains the existing authoritative item selection and skip/recovery
logic. Podium cards arrive with staggered bronze/silver/gold timing and distinct
heights. Reduced-motion preferences disable CSS/WAAPI movement. Existing mute,
effect-volume, audio priority, gesture-unlock and hidden-page rules still govern all
sounds. Added cues are original synthesized notes, not downloaded game recordings.

## Validation

Two new regression suites cover measured footer reservation, event coalescing,
keyboard inset/input reveal, cleanup, no-op writes, live pass/leader transitions,
one-shot milestones/time cues, hidden/pause/retry/station isolation and immutable
game data. Existing animation, audio, receipt, classroom and race suites also run.

Local browser rehearsal used real delivered bundles and Worker APIs against a
disposable in-memory database. Viewports: 1024×768 landscape and 768×1024 portrait.
Observed spelling targets measured 52×50 CSS pixels; pairing buttons were 76 pixels
high. Both orientations had no horizontal document overflow. Picture/choice column
bounds, fixed footer bounds, actual hint visibility, spelling selection/submission,
QR entry/readiness, countdown/GO, a one-minute race, item roulette/activation,
last-30-second notice and course results were inspected.

Screenshots are retained under ignored `output/v61-*.png`. Tests do not touch
production records. These are browser viewport simulations and injected keyboard
geometry checks, not a physical iPad, Safari, touch-hardware, TV or classroom load
certification. Run `npm run check` for the complete regression set.
