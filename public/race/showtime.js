import { createRaceSpectacle } from './spectacle.js';
import { createMotion } from '../effects/motion.js';
import { setTextIfChanged, setAttributeIfChanged } from '../shared/dom.js';
import { isCourseClear } from './lifecycle.js';
// Presentation only: game receipts, timing and rank remain authoritative on the server.
export function sceneProgress(result) {
  const r = result?.race,
    s = result?.self;
  if (!r || !s) return null;
  if (r.endless)
    return {
      station: r.station || 0,
      total: null,
      answered: s.stationIndex ?? s.index ?? 0,
      percent: Math.min(100, Math.max(0, (1 - s.remaining / (r.settings.minutes * 60000)) * 100)),
    };
  const total = r.rules >= 5 ? r.stationQuestions : r.total;
  const answered = Math.min(total, Math.max(0, s.stationIndex ?? s.index ?? 0));
  return {
    station: r.station || 0,
    total,
    answered,
    percent: total ? (answered / total) * 100 : 0,
  };
}

export function createRaceShowtime({
  q,
  make,
  avatarArt,
  isTeacher,
  settings,
  effects,
  host = globalThis,
}) {
  const { document } = host;
  const overlay = make('div', undefined, 'race-start-show');
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  const lights = make('div', undefined, 'start-show-lights');
  for (let i = 0; i < 3; i++) lights.append(make('i'));
  const numeral = make('strong');
  overlay.append(make('span', 'READY / SET / GO', 'start-show-label'), lights, numeral);
  document.body.append(overlay);
  const spectacle = createRaceSpectacle({ make, isTeacher, settings, effects, host });
  const scene = q('#race-scene');
  let actor, marker, progress, stageLabel, face, sceneKey;
  if (scene) {
    const heading = make('div', undefined, 'scene-heading');
    stageLabel = make('strong');
    progress = make('span');
    heading.append(stageLabel, progress);
    const track = make('div', undefined, 'scene-road');
    track.append(make('span', 'START', 'scene-start'), make('span', '🏁', 'scene-finish'));
    for (let i = 1; i < 4; i++) {
      const checkpoint = make('i', undefined, 'scene-checkpoint');
      checkpoint.style.left = i * 25 + '%';
      track.append(checkpoint);
    }
    marker = make('span', undefined, 'scene-fill');
    track.append(marker);
    actor = make('span', undefined, 'scene-racer');
    face = make('span');
    actor.append(face);
    track.append(actor);
    scene.append(heading, track);
  }
  const receipts = new Set();
  const layers = new Map();
  let ownerKey, lastStatus, lastStation, lastCount, hideTimer;
  const media = host.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => settings.values.reduceMotion || media.matches;
  const motion = () => !reduced() && !document.hidden;
  const animation = createMotion({ reduced, host });
  function animate(node, frames, options) {
    return animation.animate(node, frames, options);
  }
  function hide(reset = false) {
    host.clearTimeout(hideTimer);
    if (!overlay.hidden) overlay.hidden = true;
    if (reset) lastCount = null;
  }
  function clearVisuals() {
    animation.stop();
    for (const [layer, timer] of layers) {
      host.clearTimeout(timer);
      layer.remove();
    }
    layers.clear();
  }
  function countdown(n) {
    n = Math.max(0, Math.min(10, n));
    if (!n && lastCount === null && lastStatus !== 'countdown') return;
    if (n === lastCount) return;
    lastCount = n;
    overlay.hidden = false;
    overlay.dataset.step = String(n);
    numeral.textContent = n || 'GO!';
    if (!document.hidden) effects.sound(n ? 'countdown' : 'welcome');
    [...lights.children].forEach((light, i) =>
      light.classList.toggle('lit', i >= Math.min(3, n) - 1),
    );
    animate(
      numeral,
      [
        { transform: 'scale(.7)', opacity: 0.4 },
        { transform: 'scale(1.08)', opacity: 1 },
        { transform: 'scale(1)' },
      ],
      { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    if (!n) hideTimer = host.setTimeout(() => hide(), 650);
  }
  function burst(anchor, tone = 'gold') {
    if (!motion() || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const layer = make('div', undefined, 'race-spark-layer');
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    for (let i = 0; i < 12; i++) {
      const spark = make('i', undefined, 'race-spark ' + tone);
      spark.style.left = rect.left + rect.width / 2 + 'px';
      spark.style.top = rect.top + Math.min(35, rect.height / 2) + 'px';
      layer.append(spark);
      const angle = (i * Math.PI) / 6,
        radius = 48 + (i % 3) * 19;
      animate(
        spark,
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * radius}px,${Math.sin(angle) * radius - 30}px) rotate(${i * 80}deg) scale(.4)`,
            opacity: 0,
          },
        ],
        { duration: 620, easing: 'ease-out' },
      );
    }
    layers.set(
      layer,
      host.setTimeout(() => {
        layer.remove();
        layers.delete(layer);
      }, 700),
    );
  }
  function update(result) {
    spectacle.update(result);
    const r = result?.race;
    if (!r) {
      hide(true);
      clearVisuals();
      ownerKey = null;
      if (scene && !scene.hidden) scene.hidden = true;
      return;
    }
    const key = r.id + ':' + (r.station || 0);
    if (ownerKey !== key) {
      hide(true);
      clearVisuals();
      receipts.clear();
      ownerKey = key;
      sceneKey = null;
      lastStatus = null;
      lastStation = null;
    }
    if (document.body.dataset.raceCourse !== String(r.station || 0))
      document.body.dataset.raceCourse = String(r.station || 0);
    if (lastStatus !== r.status && r.status !== 'running') clearVisuals();
    if (r.status === 'countdown') countdown(Math.ceil(r.startsIn / 1000));
    else if (r.status === 'running' && lastStatus === 'countdown' && lastStation === r.station) {
      countdown(0);
    } else if (r.status !== 'running') hide(true);
    const p = sceneProgress(result);
    if (scene && p) {
      const hidden = !!(
        !['running', 'paused'].includes(r.status) ||
        result.self.ready === false ||
        result.self.done
      );
      if (scene.hidden !== hidden) scene.hidden = hidden;
      const names = ['草原サーキット', 'オーシャンロード', 'スターライトコース'];
      setTextIfChanged(stageLabel, 'STAGE ' + (p.station + 1) + ' · ' + names[p.station]);
      setTextIfChanged(
        progress,
        r.endless ? p.answered + '問回答 · 時間いっぱいチャレンジ' : p.answered + ' / ' + p.total,
      );
      setAttributeIfChanged(
        scene,
        'aria-label',
        names[p.station] + '、' + p.answered + '問回答済み',
      );
      const width = p.percent + '%',
        left = 6 + p.percent * 0.86 + '%';
      if (marker.style.width !== width) marker.style.width = width;
      if (actor.style.left !== left) actor.style.left = left;
      if (face.dataset.avatar !== result.self.avatar) {
        face.replaceChildren(avatarArt(result.self.avatar));
        face.dataset.avatar = result.self.avatar;
      }
      const key = r.id + ':' + p.station;
      if (sceneKey !== key) {
        sceneKey = key;
        animate(
          scene,
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 400 },
        );
      }
    }
    if (lastStatus !== r.status && isCourseClear(result)) {
      if (lastStatus && !document.hidden) effects.celebrate?.();
      const panel = isTeacher ? q('#teacher-station-results') : q('#student-station-results');
      animate(
        panel,
        [
          { opacity: 0, transform: 'translateY(18px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 650, easing: 'ease-out' },
      );
    }
    lastStatus = r.status;
    lastStation = r.station;
  }
  function receipt(receipt) {
    if (!receipt || receipts.has(receipt.id)) return;
    receipts.add(receipt.id);
    if (receipts.size > 120) receipts.delete(receipts.values().next().value);
    spectacle.receipt(receipt);
    q('#race-question').dataset.answerState = receipt.correct ? 'correct' : 'retry';
    if (receipt.correct) {
      burst(q('#answer-reward'));
      animate(
        actor,
        [
          { transform: 'translate(-50%,0) rotate(-8deg)' },
          { transform: 'translate(-50%,-12px) rotate(6deg)' },
          { transform: 'translate(-50%,0)' },
        ],
        { duration: 400 },
      );
    } else
      animate(
        q('#race-prompt'),
        [
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 240 },
      );
  }
  function question() {
    if (q('#race-question')) delete q('#race-question').dataset.answerState;
  }
  function selection() {
    const selected =
      q('.race-choice.chosen') ||
      q('.exercise-tile.chosen') ||
      q('.exercise-sentence-answer .exercise-tile:last-child') ||
      [...(q('#spelling-slots')?.children || [])].filter((n) => n.textContent).at(-1);
    animate(
      selected,
      [
        { translate: '0 5px', scale: '.84' },
        { translate: '0 -2px', scale: '1.06', offset: 0.65 },
        { translate: '0 0', scale: '1' },
      ],
      { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' },
    );
  }
  function item(kind, effect) {
    spectacle.item(kind, effect);
    burst(q('#use-race-item'), 'sky');
    animate(
      actor,
      [
        { transform: 'translate(-50%,0) scale(.9)' },
        { transform: 'translate(-50%,0) scale(1.15)' },
        { transform: 'translate(-50%,0)' },
      ],
      { duration: 400 },
    );
  }
  function visibilityChanged() {
    if (document.hidden) {
      hide(true);
      clearVisuals();
      lastStatus = null;
    }
  }
  function settingsChanged() {
    if (!motion()) clearVisuals();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  host.addEventListener?.('aomiyalingo-settings', settingsChanged);
  function dispose() {
    hide(true);
    clearVisuals();
    receipts.clear();
    spectacle.dispose();
    document.removeEventListener?.('visibilitychange', visibilityChanged);
    host.removeEventListener?.('aomiyalingo-settings', settingsChanged);
    overlay.remove();
    scene?.replaceChildren();
  }
  return { update, countdown, receipt, question, selection, item, clock: spectacle.clock, dispose };
}
