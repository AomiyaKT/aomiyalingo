// Derive personal progress from saved receipts, never from animation or client clocks.
export function stationProgress(history = [], station = 0) {
  const rows = history.filter((h) => (h.station ?? 0) === station && !h.review);
  const independent = rows.filter((h) => h.correct && !h.hinted).length;
  return {
    answered: rows.length,
    accuracy: rows.length ? Math.round((independent / rows.length) * 100) : null,
    bestStreak: rows.reduce((best, h) => Math.max(best, h.streak || 0), 0),
  };
}

export function progressMessages(history, station) {
  const current = stationProgress(history, station);
  const messages = ['最長 ' + current.bestStreak + '問連続で自力正解！'];
  if (station > 0) {
    const previous = stationProgress(history, station - 1);
    if (current.accuracy !== null && previous.accuracy !== null) {
      const delta = current.accuracy - previous.accuracy;
      messages.push(
        delta > 0
          ? '前のコースより自力正解率が ' + delta + 'ポイントアップ！'
          : delta === 0
            ? '前のコースと同じ自力正解率をキープ！'
            : '今回は難しかったね。復習で、次の一歩へ。',
      );
    }
    if (current.bestStreak > previous.bestStreak) messages.push('連続正解の記録を更新！');
  }
  return messages;
}

export function createRewardFeedback({ q, make, settings }) {
  const panel = q('#answer-reward');
  let lastReceipt = null;
  function show(receipt, rules = {}) {
    if (!receipt || receipt.id === lastReceipt) return;
    lastReceipt = receipt.id;
    panel.replaceChildren();
    panel.hidden = !receipt.correct && !receipt.shielded;
    if (receipt.shielded) panel.append(make('span', '🛡️ 連続正解を守った！', 'reward-combo'));
    if (!receipt.correct) return;
    panel.append(make('strong', '+' + receipt.points + ' pt', 'reward-points'));
    if (receipt.streak > 1 && !receipt.hinted && !receipt.review) {
      panel.append(make('span', '🔥 ' + receipt.streak + '問連続！', 'reward-combo'));
    }
    if (receipt.streakBonus)
      panel.append(make('small', '連続正解ボーナス +' + receipt.streakBonus + ' pt（合計に含む）'));
    if (receipt.treasureBonus)
      panel.append(make('span', '💎 宝箱オープン！ ＋150 pt', 'reward-combo'));
    const base = receipt.review
      ? rules.reviewPoints
      : receipt.hinted
        ? rules.hintPoints
        : rules.correctPoints;
    const itemBonus =
      receipt.points -
      (base ?? receipt.points) -
      (receipt.streakBonus || 0) -
      (receipt.treasureBonus || 0);
    if (itemBonus > 0)
      panel.append(make('small', '道具ボーナス +' + itemBonus + ' pt（合計に含む）'));
    if (receipt.review) panel.append(make('small', '復習できたね！'));
    if (!settings.values.reduceMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panel.animate?.(
        [
          { opacity: 0, transform: 'translateY(10px) scale(.92)' },
          { opacity: 1, transform: 'translateY(0) scale(1.04)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 440, easing: 'ease-out' },
      );
    }
  }
  return {
    show,
    clear() {
      panel.hidden = true;
    },
  };
}
