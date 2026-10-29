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
      [
        'shield',
        '🛡️',
        'コンボシールド',
        '間違い・ヒントによる連続正解のリセットを1回防ぐ。得点と正誤は変わりません。',
      ],
      [
        'swap',
        '🔄',
        'チェンジカード',
        '今の問題を、同じ種類の別の問題に交換。得点・正解率・連続正解は変わりません。',
      ],
      [
        'treasure',
        '💎',
        '宝箱チャレンジ',
        '自力で3問連続正解すると＋150点。間違い・ヒントで宝箱のカウントは0に戻ります。',
      ],
      [
        'magnet',
        '🧲',
        '追い上げマグネット',
        'すぐに＋20〜150点。前の人との得点差が大きいほど増えます。相手の得点は減りません。',
      ],
    ].map(([id, icon, name, description]) => [id, Object.freeze({ icon, name, description })]),
  ),
);
export const raceItemIds = Object.freeze(Object.keys(raceItemCatalog));
export const raceItemNames = Object.freeze(
  Object.fromEntries(Object.entries(raceItemCatalog).map(([id, item]) => [id, item.name])),
);
