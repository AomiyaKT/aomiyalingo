// Immutable display metadata shared by the rules, briefing and race effects.
// Item probabilities, eligibility and scoring remain in the authoritative rules.
export const raceItemCatalog = Object.freeze(
  Object.fromEntries(
    [
      ['hint', '💡', 'ヒントライト', '選択肢を1つ減らす。スペリングは最初の1文字。'],
      ['boost', '🚀', 'ダッシュ', '次の独立正解にボーナス。間違えても残り回数は減りません。'],
      ['review', '⭐', '復習スター', '間違えた単語にもう一度挑戦して、得点しよう。'],
      ['compass', '🧭', 'ダブルヒント', '選択肢を2つ減らす。スペリングは最初の2文字。'],
      ['double', '🌟', 'ダブルスター', '次の独立正解の基本得点が2倍！'],
      ['lucky', '🍀', 'ラッキークローバー', '次の独立正解に20〜80点のボーナス！'],
    ].map(([id, icon, name, description]) => [id, Object.freeze({ icon, name, description })]),
  ),
);
export const raceItemNames = Object.freeze(
  Object.fromEntries(Object.entries(raceItemCatalog).map(([id, item]) => [id, item.name])),
);
