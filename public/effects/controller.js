import { createEffectsAudio } from './audio.js';
import { createMotion } from './motion.js';

export function createInteractionEffects({ settings, host = globalThis }) {
  const { document } = host;
  const media = host.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => settings().reduceMotion || media.matches;
  const audio = createEffectsAudio({ settings, host });
  const motion = createMotion({ reduced, host });
  let semantic = 0;
  const receipts = new Set(),
    layers = new Set(),
    timers = new Set();
  const later = (callback, delay) => {
    const timer = host.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  function sound(kind = 'click') {
    semantic++;
    return audio.play(kind);
  }
  function removeLayers() {
    for (const layer of layers) layer.remove();
    layers.clear();
    for (const timer of timers) host.clearTimeout(timer);
    timers.clear();
  }
  function particles(anchor, large = false) {
    if (reduced() || document.hidden || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'fx-particles';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    layers.add(layer);
    for (let i = 0; i < (large ? 26 : 7); i++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--spark-color', ['#58cc02', '#1cb0f6', '#ffc800', '#ce82ff'][i % 4]);
      piece.style.left = rect.left + rect.width / 2 + 'px';
      piece.style.top = rect.top + Math.min(rect.height / 2, 80) + 'px';
      layer.append(piece);
      const angle = i * 2.4,
        radius = large ? 100 + (i % 5) * 24 : 22 + (i % 3) * 13;
      motion.animate(
        piece,
        [
          { opacity: 0, translate: '0 0', scale: '.5', offset: 0 },
          {
            opacity: 1,
            translate: `${Math.cos(angle) * radius * 0.5}px ${-radius * 0.8}px`,
            scale: '1',
            offset: 0.25,
          },
          {
            opacity: 0,
            translate: `${Math.cos(angle) * radius}px ${large ? 160 + (i % 4) * 35 : Math.sin(angle) * radius}px`,
            rotate: `${i * 63}deg`,
            scale: '.4',
            offset: 1,
          },
        ],
        {
          duration: large ? 1000 : 520,
          delay: large ? (i % 5) * 30 : 0,
          easing: 'cubic-bezier(.15,.6,.4,1)',
        },
      );
    }
    later(
      () => {
        layer.remove();
        layers.delete(layer);
      },
      large ? 1400 : 650,
    );
  }
  function answer({ correct, streak = 0, key, target, mascot, icon, selected, burst = true }) {
    if (key && receipts.has(key)) return;
    if (key) {
      receipts.add(key);
      if (receipts.size > 120) receipts.delete(receipts.values().next().value);
    }
    const milestone = correct && (streak === 3 || streak % 5 === 0) && streak > 0;
    sound(correct ? (milestone ? 'streak' : 'correct') : 'wrong');
    if (icon) {
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = correct
        ? '<svg viewBox="0 0 40 40"><path pathLength="1" d="m11 21 6 6 13-15"/></svg>'
        : '<svg viewBox="0 0 40 40"><path pathLength="1" d="m13 13 14 14m0-14L13 27"/></svg>';
      motion.pulse(icon, 'success');
    }
    if (mascot) motion.pulse(mascot, correct ? 'character' : 'wrong');
    if (selected) motion.pulse(selected, correct ? 'success' : 'wrong');
    if (target) motion.enter(target, 'toast');
    if (correct && burst) particles(icon || mascot || target);
    if (milestone && target) {
      target.querySelector('.fx-streak-chip')?.remove();
      const badge = document.createElement('span');
      badge.className = 'fx-streak-chip';
      badge.textContent = '★ ' + streak + '問連続！';
      target.append(badge);
      layers.add(badge);
      motion.pulse(badge, 'success');
      later(() => {
        badge.remove();
        layers.delete(badge);
      }, 1700);
    }
  }
  function celebrate() {
    sound('complete');
    // Race state arrives before its result panel is rendered. Wait until that
    // synchronous render finishes so confetti starts at the visible reward.
    host.queueMicrotask(() => {
      const anchor = [
        ...document.querySelectorAll('.complete-medal, #race-podium, #teacher-station-results'),
      ].find((node) => node.getBoundingClientRect().width > 0);
      particles(anchor || document.body, true);
      document
        .querySelectorAll('.complete-medal, #lesson-complete img')
        .forEach((node) => motion.pulse(node, 'character'));
    });
  }
  function control(target) {
    const element = target?.closest?.(
      'button, a[href], summary, [role="radio"], [role="checkbox"]',
    );
    return element && !element.disabled && element.getAttribute('aria-disabled') !== 'true'
      ? element
      : null;
  }
  const spoken = (element) =>
    element.matches('#audio-play, #study-audio, #race-audio, #race-slow, #review-listen') ||
    element.closest('.stage-word') ||
    /発音|音声/.test(element.getAttribute('aria-label') || '');
  let held;
  function press(event) {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) {
      audio.unlock();
      return;
    }
    audio.unlock();
    if (reduced()) return;
    held?.classList.remove('fx-pressed');
    held = control(event.target);
    held?.classList.add('fx-pressed');
  }
  function release() {
    held?.classList.remove('fx-pressed');
    held = null;
  }
  document.addEventListener('pointerdown', press, true);
  document.addEventListener('keydown', press, true);
  for (const type of ['pointerup', 'pointercancel', 'keyup'])
    document.addEventListener(type, release, true);
  host.addEventListener('blur', release);
  document.addEventListener(
    'click',
    (event) => {
      const element = control(event.target);
      if (!element || spoken(element)) return;
      const before = semantic;
      // Run after dispatch so a selection/toggle handler owns its cue: one gesture,
      // one sound, including controls whose handler replaces the original node.
      host.queueMicrotask(() => {
        if (semantic !== before || element.disabled || !element.isConnected) return;
        const kind = element.matches('#study-next, #study-prev')
          ? 'flip'
          : element.matches('a[href], #continue, #race-next, #course-start')
            ? 'navigate'
            : 'click';
        if (!element.matches('#submit, #race-submit')) sound(kind);
        motion.pulse(element);
      });
    },
    true,
  );
  document.addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"], input[type="range"], select')) {
      audio.unlock();
      sound('toggle');
    }
  });
  const entrances =
    '.settings-panel, .quiz-shell, #mode-chooser, #course-home, #vocab-screen, #lesson-complete, #race-entry, #race-play, #race-wait, #student-station-results, #teacher-station-results, dialog';
  const observer = new host.MutationObserver((changes) => {
    for (const change of changes) {
      const element = change.target;
      if (
        !element.matches(entrances) ||
        element.hidden ||
        (element.tagName === 'DIALOG' && !element.open)
      )
        continue;
      if (change.attributeName === 'hidden' && change.oldValue === null) continue;
      if (change.attributeName === 'open' && change.oldValue !== null) continue;
      motion.enter(element);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['hidden', 'open'],
  });
  function preferences() {
    audio.sync();
    if (reduced()) {
      release();
      motion.stop();
      removeLayers();
      document.getAnimations?.().forEach((animation) => animation.cancel());
    }
  }
  host.addEventListener('aomiyalingo-settings', preferences);
  media.addEventListener?.('change', preferences);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.stop();
      motion.stop();
      removeLayers();
      release();
    }
  });
  host.addEventListener('pagehide', () => {
    audio.stop();
    motion.stop();
    removeLayers();
    release();
  });
  return { sound, ...motion, celebrate, answer };
}
