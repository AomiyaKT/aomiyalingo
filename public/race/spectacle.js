import { createMotion } from '../effects/motion.js';
import { raceItemCatalog } from '../shared/race-items.js';
import { isCourseClear } from './lifecycle.js';
// Event-driven presentation only. No score, clock or saved state is changed here.
export function createRaceSpectacle({ make, isTeacher, settings, effects, host = globalThis }) {
  const { document } = host;
  const notice = make('aside', undefined, 'race-highlight');
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const icon = make('span', '', 'race-highlight-icon');
  icon.setAttribute('aria-hidden', 'true');
  const copy = make('div'),
    label = make('small'),
    title = make('strong'),
    detail = make('span');
  copy.append(label, title, detail);
  notice.append(icon, copy);
  document.body.append(notice);
  let owner,
    status,
    rank,
    leader,
    dismiss,
    effectTimer,
    sync = false,
    lastSecond = null,
    finalLap = false;
  const receipts = new Set();
  const countdownSeconds = new Set();
  const media = host.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => settings.values.reduceMotion || media.matches;
  const visible = () => !document.hidden;
  const motion = () => visible() && !reduced();
  const animation = createMotion({ reduced, host });
  function clear() {
    host.clearTimeout(dismiss);
    host.clearTimeout(effectTimer);
    if (!notice.hidden) notice.hidden = true;
    animation.stop();
    delete document.body.dataset.raceEffect;
  }
  function announce(kind, symbol, heading, text, sound) {
    if (!visible()) return;
    host.clearTimeout(dismiss);
    notice.dataset.kind = kind;
    icon.textContent = symbol;
    label.textContent = {
      pass: 'POSITION UP',
      combo: 'NICE STREAK',
      item: 'POWER UP',
      final: 'FINAL SECONDS',
      podium: 'COURSE CLEAR',
    }[kind];
    title.textContent = heading;
    detail.textContent = text;
    notice.hidden = false;
    animation.animate(
      notice,
      [
        { opacity: 0, translate: '0 -14px', scale: '.9' },
        { opacity: 1, translate: '0 3px', scale: '1.03', offset: 0.7 },
        { opacity: 1, translate: '0 0', scale: '1' },
      ],
      { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' },
    );
    if (sound) effects.sound(sound);
    dismiss = host.setTimeout(
      () => {
        notice.hidden = true;
      },
      kind === 'podium' ? 3600 : 2200,
    );
  }
  function update(result) {
    const race = result?.race;
    if (!race) {
      clear();
      owner = null;
      return;
    }
    const key = race.id + ':' + (race.station || 0);
    const fresh = key !== owner;
    if (fresh) {
      clear();
      receipts.clear();
      countdownSeconds.clear();
      owner = key;
      rank = null;
      leader = null;
      finalLap = false;
      lastSecond = null;
    }
    const players = result.players || result.board || [];
    const own = !isTeacher && players.find((player) => player.id === result.self?.id);
    const nextRank = own?.rank || null;
    const first = isTeacher && players.find((player) => player.rank === 1);
    const running = race.status === 'running';
    if (!fresh && !sync && visible() && running && status === 'running') {
      if (!isTeacher && rank && nextRank && nextRank < rank)
        announce(
          'pass',
          '↗',
          nextRank + '位にアップ！',
          rank - nextRank + 'つ順位を上げたよ！',
          'overtake',
        );
      else if (isTeacher && leader && first && first.id !== leader)
        announce(
          'pass',
          '🏁',
          (first.alias || '出席番号 ' + first.label) + ' がトップ！',
          '新しいリーダーが登場！',
          'overtake',
        );
    }
    if (
      !fresh &&
      !sync &&
      visible() &&
      ['running', 'paused'].includes(status) &&
      status !== race.status &&
      isCourseClear(result)
    )
      announce(
        'podium',
        '🏆',
        'コース ' + ((race.station || 0) + 1) + ' クリア！',
        'みんなのがんばりを見てみよう。',
      );
    if (
      ['paused', 'lobby'].includes(race.status) ||
      (race.status === 'finished' && !isCourseClear(result))
    )
      clear();
    if (!running) {
      host.clearTimeout(effectTimer);
      delete document.body.dataset.raceEffect;
    }
    rank = nextRank;
    leader = first?.id || null;
    status = race.status;
    if (result.self?.remaining !== undefined) clock(result.self.remaining);
    sync = false;
  }
  function clock(remaining) {
    if (isTeacher || status !== 'running' || !Number.isFinite(remaining)) return;
    const second = Math.max(0, Math.ceil(remaining / 1000));
    const tone = second > 0 && second <= 30 ? 'final' : 'normal';
    if (document.body.dataset.raceTime !== tone) document.body.dataset.raceTime = tone;
    const previous = lastSecond;
    lastSecond = second;
    if (!visible() || sync || previous === null) {
      if (second <= 30) finalLap = true;
      return;
    }
    if (!finalLap && second > 0 && second <= 30) {
      finalLap = true;
      announce('final', '⏱', 'ラスト30秒！', 'あせらず、最後の1問まで。', 'finalLap');
    }
    if (second > 0 && second <= 5 && second < previous && !countdownSeconds.has(second)) {
      countdownSeconds.add(second);
      effects.sound('countdown');
    }
  }
  function receipt(value) {
    if (!value || receipts.has(value.id)) return;
    receipts.add(value.id);
    if (receipts.size > 120) receipts.delete(receipts.values().next().value);
    if (value.shielded) {
      announce('item', '🛡️', '連続正解を守った！', '得点と正誤はそのまま。次の問題へ。', 'powerup');
      return;
    }
    if (value.treasureBonus) {
      announce('item', '💎', '宝箱オープン！', '3問連続で自力正解！ ＋150 pt', 'itemReveal');
      return;
    }
    if (
      value.correct &&
      !value.hinted &&
      !value.review &&
      (value.streak === 3 || (value.streak > 0 && value.streak % 5 === 0))
    )
      announce('combo', '🔥', value.streak + '問連続で正解！', 'この調子！ 自分の記録を伸ばそう。');
  }
  function item(kind, effect) {
    const art = Object.hasOwn(raceItemCatalog, kind) && raceItemCatalog[kind];
    if (!art) return;
    announce(
      'item',
      art.icon,
      art.name + ' 発動！',
      kind === 'magnet' && effect?.points
        ? '追い上げボーナス ＋' + effect.points + ' pt'
        : art.description,
      'powerup',
    );
    if (motion()) {
      host.clearTimeout(effectTimer);
      document.body.dataset.raceEffect = kind;
      effectTimer = host.setTimeout(() => {
        delete document.body.dataset.raceEffect;
      }, 1000);
    }
  }
  function visibilityChanged() {
    clear();
    sync = true;
  }
  function settingsChanged() {
    if (!motion()) clear();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  host.addEventListener?.('aomiyalingo-settings', settingsChanged);
  function dispose() {
    clear();
    receipts.clear();
    countdownSeconds.clear();
    notice.remove();
    document.removeEventListener?.('visibilitychange', visibilityChanged);
    host.removeEventListener?.('aomiyalingo-settings', settingsChanged);
  }
  return { update, clock, receipt, item, clear, dispose };
}
