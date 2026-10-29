import { stationModes, exerciseNames } from '../learning/exercises.js';
import { raceItemCatalog } from '../shared/race-items.js';

export function raceBriefing(race, curriculum) {
  const c = race.settings;
  const itemNotes = {
    hint: `問題に合わせたヒント。使って正解すると${c.hintPoints}点。連続正解はリセット。`,
    compass: `選択肢や最初の文字など、問題に合わせて支援。正解は${c.hintPoints}点。`,
    boost: `次の${c.boostCount}回の自力正解に、それぞれ＋${c.boostPoints}点。間違えても残り回数は減りません。`,
    review: `間違えたことばにもう一度挑戦。正解すると${c.reviewPoints}点。復習することばがあるときに出ます。`,
    double: `次の自力正解の基本得点が2倍（＋${c.correctPoints}点）。`,
    lucky: '次の自力正解に＋20〜80点。何点かはお楽しみ！',
    shield: raceItemCatalog.shield.description,
    swap: raceItemCatalog.swap.description,
    treasure: raceItemCatalog.treasure.description,
    magnet: raceItemCatalog.magnet.description,
  };
  return {
    curriculum,
    duration: c.minutes,
    scoring: `正解は${c.correctPoints}点。間違いは0点。あわてず、正確に答えよう。時間内に正しく答えたぶん得点が増えます。`,
    streak: `連続正解は2問目から＋${c.streakStep ?? 20}点ずつ、上限＋${c.streakCap ?? 100}点。間違い・ヒントでリセット。`,
    ranking: '順位は合計得点。同点なら自力正解率で決まります。速さのボーナスはありません。',
    courses: (c.format === 'adaptive-four' ? stationModes : [c.modes, c.modes, c.modes]).map(
      (modes, i) => ({ title: `コース ${i + 1}`, types: modes.map((mode) => exerciseNames[mode]) }),
    ),
    items: c.items.map((id) => ({
      id,
      icon: raceItemCatalog[id].icon,
      name: raceItemCatalog[id].name,
      text: itemNotes[id],
    })),
    itemEvery: c.itemEvery,
  };
}

export function renderRaceBriefing(host, race, curriculum, make) {
  const key = JSON.stringify([race.id, race.settings, curriculum]);
  if (host.dataset.content === key) return;
  host.dataset.content = key;
  const b = raceBriefing(race, curriculum);
  host.replaceChildren();
  host.append(
    make('span', 'スタート前に読もう', 'race-tag'),
    make('h2', 'あわてず、正しく答えよう！'),
  );
  const scope = make('div', undefined, 'briefing-scope');
  scope.append(make('strong', b.curriculum), make('span', '📖 教科書を見てもOK！'));
  host.append(
    scope,
    make(
      'p',
      race.endless
        ? `1コース${b.duration}分 × 3コース。問題は時間いっぱい続きます。各コースで上位3人を発表します。`
        : `1コース${race.stationQuestions || race.total}問・${b.duration}分。`,
    ),
  );
  const score = make('section', undefined, 'briefing-score');
  score.append(
    make('h3', '正確さを大切に'),
    make('p', b.scoring),
    make('p', b.streak),
    make('p', b.ranking),
  );
  host.append(score, make('h3', 'どんな問題が出る？'));
  const courses = make('div', undefined, 'briefing-courses');
  for (const c of b.courses) {
    const card = make('section');
    card.append(make('h4', c.title), make('p', c.types.join('・')));
    courses.append(card);
  }
  host.append(
    courses,
    make(
      'p',
      race.settings.format === 'adaptive-four'
        ? '後半は文や聞き取りにも挑戦。最近の答えに合わせて、選択肢などの支援を調整します。'
        : '先生が選んだ問題で、自分のペースで挑戦しよう。',
      'briefing-support',
    ),
  );
  host.append(make('h3', '道具を使ってみよう'));
  if (!b.items.length) host.append(make('p', 'このレースでは道具を使いません。'));
  else {
    host.append(
      make(
        'p',
        `${b.itemEvery}問ごとに道具が届きます。くるくる回って止まった道具を、答える前にタップして使おう。`,
      ),
    );
    const items = make('div', undefined, 'briefing-items');
    for (const item of b.items) {
      const card = make('section');
      card.append(make('span', item.icon), make('h4', item.name), make('p', item.text));
      items.append(card);
    }
    host.append(items);
  }
  host.append(make('p', '先生の合図でスタート。この画面のまま待ってね。', 'briefing-footer'));
}
