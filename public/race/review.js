import { progressMessages } from './rewards.js';
import { courseSummary } from './lifecycle.js';

export function createWaitingReview({ q, make, getData, audio, volume }) {
  let key = null,
    cards = [],
    index = 0,
    revealed = false;
  const panel = q('#waiting-review');
  const card = q('#waiting-review-card');
  function drawCard() {
    card.replaceChildren();
    if (!cards.length) return;
    const word = cards[index];
    card.append(make('small', index + 1 + ' / ' + cards.length), make('h3', word.meaning));
    if (revealed) card.append(make('strong', word.word));
    q('#review-reveal').textContent = revealed ? 'もう一度思い出す' : '英語を確認';
    q('#review-next').textContent = index === cards.length - 1 ? '最初に戻る' : '次の単語';
  }
  function update() {
    const data = getData();
    const allowed =
      data?.self?.done && ['running', 'intermission', 'finished'].includes(data.race.status);
    const nextKey = JSON.stringify([
      data?.race?.id,
      data?.race?.station,
      allowed,
      data?.self?.reviewCards,
    ]);
    if (key === nextKey) return;
    key = nextKey;
    cards = data?.self?.reviewCards || [];
    index = 0;
    revealed = false;
    panel.hidden = !allowed || !cards.length;
    drawCard();
    const summary = q('#student-course-summary');
    summary.hidden = !allowed;
    summary.replaceChildren();
    if (allowed) {
      const stats = courseSummary(data);
      summary.append(make('h2', '今回のコースの記録'));
      const row = make('div', undefined, 'course-summary-stats');
      for (const [value, label] of [
        [stats.independent + ' / ' + stats.answered, '自力で正解'],
        [stats.accuracy === null ? '—' : stats.accuracy + '%', '自力正解率'],
        [stats.points + ' pt', 'このコースの得点'],
      ]) {
        const item = make('div');
        item.append(make('strong', value), make('small', label));
        row.append(item);
      }
      summary.append(row);
      if (stats.answered) {
        const progress = make('div', undefined, 'course-growth');
        for (const text of progressMessages(data.self.history, data.race.station || 0))
          progress.append(make('p', text));
        progress.append(make('small', 'コースごとに問題が違うので、今回の記録の目安です。'));
        summary.append(progress);
      }
      if (!cards.length && stats.answered)
        summary.append(make('p', 'よくできました！みんなのゴールを応援しよう。'));
    }
  }
  q('#review-reveal').onclick = () => {
    revealed = !revealed;
    drawCard();
  };
  q('#review-next').onclick = () => {
    index = (index + 1) % cards.length;
    revealed = false;
    drawCard();
  };
  q('#review-listen').onclick = () => {
    if (!cards.length) return;
    playWordAudio(audio, cards[index], volume()).catch(() => {
      q('#review-status').textContent = '再生できませんでした。もう一度押してください。';
    });
  };
  return { update };
}
