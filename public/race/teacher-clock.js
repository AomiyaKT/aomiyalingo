import { translateUI } from '../shared/i18n.js';

// The tower owns these nodes. Quarter-second ticks reuse the references and do
// no DOM work until a displayed second, phase, warning or interface language changes.
export function createTeacherClock({
  language = () => globalThis.document?.documentElement?.lang || 'ja',
} = {}) {
  let rows = new Map();
  const drawn = new WeakMap();
  return {
    bind(next) {
      rows = next;
    },
    update(players, race, elapsed = 0) {
      const lang = language();
      for (const player of players) {
        const node = rows.get(player.id);
        if (!node) continue;
        const remaining = Math.max(
          0,
          player.remaining -
            (race.status === 'running' && player.ready !== false && !player.done
              ? Math.max(0, elapsed)
              : 0),
        );
        const seconds = race.status === 'finished' || player.done ? 0 : Math.ceil(remaining / 1000);
        const text = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
        const low = remaining <= 60000 && race.status === 'running' && player.ready !== false;
        const previous = drawn.get(node);
        if (previous?.text !== text) node.textContent = text;
        if (previous?.low !== low) node.classList.toggle('time-low', low);
        if (previous?.text !== text || previous?.lang !== lang)
          node.setAttribute('aria-label', translateUI('残り ' + text, lang));
        drawn.set(node, { text, low, lang });
      }
    },
  };
}
