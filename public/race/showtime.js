import { createRaceSpectacle } from './spectacle.js';
import { createMotion } from '../effects/motion.js';
import { setUIText, setUIAttribute } from '../shared/i18n.js';
import { isCourseClear } from './lifecycle.js';

const courseNames = ['草原サーキット', 'オーシャンロード', 'スターライトコース'];

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
  const spectacle = createRaceSpectacle({
    make,
    isTeacher,
    settings,
    effects,
    host,
    rankDisplay: isTeacher ? null : q('#self-rank'),
  });
  const scene = q('#race-scene');
  let actor, marker, progress, stageLabel, face, wind, flag, streakValue, streakBadge;
  if (scene) {
    const heading = make('div', undefined, 'scene-heading');
    stageLabel = make('strong');
    progress = make('span', undefined, 'scene-count');
    heading.append(stageLabel, progress);
    const track = make('div', undefined, 'scene-road');
    track.setAttribute('aria-hidden', 'true');
    wind = make('span', undefined, 'scene-wind');
    flag = make('span', undefined, 'scene-finish');
    track.append(wind, make('span', undefined, 'scene-start'), flag);
    for (let i = 1; i < 4; i++) {
      const checkpoint = make('i', undefined, 'scene-checkpoint');
      checkpoint.style.left = i * 25 + '%';
      track.append(checkpoint);
    }
    marker = make('span', undefined, 'scene-fill');
    track.append(marker);
    actor = make('span', undefined, 'scene-racer');
    face = make('span', undefined, 'scene-face');
    actor.append(face);
    track.append(actor);
    streakBadge = make('div', undefined, 'scene-streak');
    streakValue = make('strong');
    streakBadge.append(make('span', '連続正解'), streakValue);
    scene.append(heading, track, streakBadge);
  }
  const receipts = new Set();
  const layers = new Map();
  let ownerKey, lastStatus, lastStation, lastCount, hideTimer;
  let previousFinish = null;
  const media = host.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => settings.values.reduceMotion || media.matches;
  const motion = () => !reduced() && !document.hidden;
  const animation = createMotion({ reduced, host });
  function animate(node, frames, options) {
    return animation.animate(node, frames, options);
  }
  function accelerate(boost = false) {
    if (!scene || scene.hidden || !motion()) return;
    animate(
      wind,
      [
        { opacity: 0, transform: 'translateX(24%)' },
        { opacity: boost ? 0.86 : 0.46, offset: 0.23 },
        { opacity: 0, transform: 'translateX(-24%)' },
      ],
      { duration: boost ? 620 : 420 },
    );
    animate(
      face,
      [
        { transform: 'translateX(-6px) scale(1.1, .91)' },
        { transform: 'translate(9px, -7px) rotate(9deg) scale(1.08)', offset: 0.43 },
        { transform: 'none' },
      ],
      { duration: boost ? 590 : 360 },
    );
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
    if (!n && lastCount == null && lastStatus !== 'countdown') return;
    if (n === lastCount) return;
    lastCount = n;
    overlay.hidden = false;
    overlay.dataset.step = String(n);
    numeral.textContent = n || 'GO!';
    if (!document.hidden) effects.sound(n ? 'countdown' : 'welcome');
    [...lights.children].forEach((light, i) => light.classList.toggle('lit', i < 4 - n));
    animate(
      numeral,
      [
        { transform: 'scale(.7)', opacity: 0.4 },
        { transform: 'scale(1.08)', opacity: 1 },
        { transform: 'scale(1)' },
      ],
      { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    if (!n) {
      animate(overlay, [{ opacity: 1, offset: 0.42 }, { opacity: 0 }], { duration: 580 });
      hideTimer = host.setTimeout(() => hide(), 580);
    }
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
      lastStatus = null;
      lastStation = null;
      previousFinish = null;
    }
    if (document.body.dataset.raceCourse !== String(r.station || 0))
      document.body.dataset.raceCourse = String(r.station || 0);
    if (lastStatus !== r.status && r.status !== 'running') clearVisuals();
    const launched =
      r.status === 'running' && lastStatus === 'countdown' && lastStation === r.station;
    if (r.status === 'countdown') countdown(Math.ceil(r.startsIn / 1000));
    else if (launched) {
      countdown(0);
    } else if (r.status !== 'running') hide(true);
    const courseClear = isCourseClear(result);
    const p = sceneProgress(result);
    if (scene && p) {
      const finished = (r.status === 'running' && result.self.done === true) || courseClear;
      const hidden =
        result.self.ready === false ||
        document.body.dataset.racePhase === 'prepare' ||
        (!['running', 'paused'].includes(r.status) && !finished);
      if (scene.hidden !== hidden) scene.hidden = hidden;
      const name = courseNames[p.station];
      setUIText(stageLabel, name);
      setUIText(progress, r.endless ? p.answered + '問回答済み' : p.answered + ' / ' + p.total);
      setUIAttribute(scene, 'aria-label', name + '、' + p.answered + '問回答済み');
      const streak = result.self.streak || 0;
      setUIText(streakValue, String(streak));
      const heat = streak >= 3 ? 'high' : streak > 1 ? 'warm' : 'low';
      if (streakBadge.dataset.heat !== heat) streakBadge.dataset.heat = heat;
      const trackState = finished ? 'finish' : r.status;
      if (scene.dataset.trackState !== trackState) scene.dataset.trackState = trackState;
      const percent = finished ? 100 : p.percent;
      const width = percent + '%',
        left = percent + '%';
      if (marker.style.width !== width) marker.style.width = width;
      if (actor.style.left !== left) actor.style.left = left;
      if (face.dataset.avatar !== result.self.avatar) {
        face.replaceChildren(avatarArt(result.self.avatar));
        face.dataset.avatar = result.self.avatar;
      }
      if (launched) accelerate(true);
      if (!hidden && finished && previousFinish === false) {
        animate(
          flag,
          [
            { transform: 'scale(.75) rotate(-12deg)' },
            { transform: 'scale(1.2) rotate(8deg)', offset: 0.44 },
            { transform: 'none' },
          ],
          { duration: 660 },
        );
      }
      previousFinish = finished;
    }
    if (lastStatus !== r.status && courseClear) {
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
      if (!receipt.hinted && !receipt.review) {
        const milestone = receipt.streak === 3 || (receipt.streak > 0 && receipt.streak % 5 === 0);
        accelerate(milestone);
        if (milestone) {
          burst(q('#answer-reward'));
          animation.pulse(streakBadge, 'success');
        }
      }
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
      face,
      [{ transform: 'scale(.9)' }, { transform: 'scale(1.15)' }, { transform: 'none' }],
      { duration: 400 },
    );
  }
  function visibilityChanged() {
    if (document.hidden) {
      hide(true);
      clearVisuals();
      lastStatus = null;
      previousFinish = null;
    }
  }
  function settingsChanged() {
    if (!motion()) clearVisuals();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  host.addEventListener?.('aomiyalingo-settings', settingsChanged);
  media.addEventListener?.('change', settingsChanged);
  function dispose() {
    hide(true);
    clearVisuals();
    receipts.clear();
    spectacle.dispose();
    document.removeEventListener?.('visibilitychange', visibilityChanged);
    host.removeEventListener?.('aomiyalingo-settings', settingsChanged);
    media.removeEventListener?.('change', settingsChanged);
    overlay.remove();
    scene?.replaceChildren();
  }
  return { update, countdown, receipt, question, selection, item, clock: spectacle.clock, dispose };
}
