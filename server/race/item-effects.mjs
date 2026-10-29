// Item state is server-owned and is committed with the same optimistic write as the answer.
export function answerItemEffects(state, { correct, hinted, review, config }) {
  let bonus = 0;
  let treasureBonus = 0;
  const independent = correct && !hinted && !review;
  const shielded = !!(state.shield && state.streak > 0 && (!correct || hinted));
  if (shielded) state.shield = false;
  if (state.boost > 0 && !review) {
    if (independent) {
      bonus += config.boostPoints;
      state.boost--;
    }
  }
  if (independent) {
    if (state.double) {
      bonus += config.correctPoints;
      state.double = false;
    }
    if (state.lucky) {
      bonus += state.lucky;
      state.lucky = 0;
    }
  }
  if (state.treasure && !review) {
    state.treasure.progress = independent ? state.treasure.progress + 1 : 0;
    if (state.treasure.progress >= 3) {
      treasureBonus = 150;
      bonus += treasureBonus;
      state.treasure = null;
    }
  }
  return { bonus, treasureBonus, shielded };
}

export function magnetPoints(score, peers) {
  const ahead = peers.filter((p) => p.score > score).map((p) => p.score - score);
  return Math.min(150, Math.max(20, Math.ceil((ahead.length ? Math.min(...ahead) : 0) / 4)));
}
