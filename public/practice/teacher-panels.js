// Keep teacher reading panels stable while only activity timestamps change.
export function createTeacherPracticePanels({ q: tq, make: el, attemptRow }) {
  const signatures = new WeakMap();
  function draw(host, value, render) {
    const key = JSON.stringify(value);
    if (signatures.get(host) === key) return;
    signatures.set(host, key);
    host.replaceChildren();
    render();
  }
  function renderProjection(data, summary) {
    tq('#tv-room-state').textContent = !data.classroom?.active
      ? '授業は終了しました'
      : (data.classroom.paused ? '練習を一時停止中' : '練習中') +
        ' · ' +
        (data.classroom.accepting ? '参加受付中' : '参加締切');
    tq('#tv-class-title').textContent = data.classroom?.title || 'みんなの進み具合';
    const percent = data.students.length
      ? Math.round(
          (data.students.reduce((n, s) => n + s.completed / Math.max(1, s.total), 0) /
            data.students.length) *
            100,
        )
      : 0;
    tq('#tv-progress-value').textContent = percent + '%';
    tq('#tv-progress-fill').style.width = percent + '%';
    tq('#tv-activity').textContent =
      data.students.filter((s) => Date.now() - s.lastSeen < 45000).length +
      '人が最近活動 · 全員の平均進捗';
    const stages = tq('#tv-stages');
    const groups = new Map();
    for (const s of data.students) {
      const key = s.done ? '練習完了' : s.stage ? 'レッスン ' + s.stage : '単語を確認中';
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    draw(stages, [data.classroom?.id, [...groups]], () => {
      if (!groups.size) stages.append(el('p', 'QRを読み取って、出席番号を入力しよう。'));
      for (const [name, count] of groups) {
        const card = el('div', undefined, 'tv-stage');
        card.append(el('span', name), el('strong', count + '人'));
        stages.append(card);
      }
    });
    const panel = tq('#tv-weak-words');
    const weak = summary.filter((w) => w.remaining || w.firstWrong || w.hinted).slice(0, 3);
    draw(panel, [data.classroom?.id, !!data.attempts.length, weak], () => {
      if (!weak.length)
        panel.append(
          el(
            'p',
            data.attempts.length
              ? '今のところ、順調に進んでいます！'
              : '回答が集まると、確認したい単語が表示されます。',
          ),
        );
      for (const w of weak) {
        const card = el('div', undefined, 'tv-word');
        const title = el('div');
        title.append(el('strong', w.word), el('span', w.meaning));
        const count = el('div');
        count.append(
          el('strong', '要復習 ' + w.remaining + '人'),
          el('span', '初回誤答 ' + w.firstWrong + '人 · ヒント ' + w.hinted + '人'),
        );
        card.append(title, count);
        panel.append(card);
      }
    });
    tq('#projection-notice').textContent = data.recovery?.length
      ? '引き継ぎ申請 ' + data.recovery.length + '件。通常表示で確認してください。'
      : '個別の番号や回答は表示していません。';
  }

  return function renderPracticePanels(data, summary) {
    const weak = summary.filter((w) => w.firstWrong || w.remaining);
    const host = tq('#weak-words');
    draw(host, [data.classroom?.id, weak], () => {
      if (!weak.length) host.append(el('p', 'まだ間違いはありません。'));
      for (const w of weak)
        host.append(
          el(
            'span',
            w.word + ' · 要復習 ' + w.remaining + '人 / 初回誤答 ' + w.firstWrong + '人',
            'weak-chip',
          ),
        );
    });
    const recent = tq('#recent-mistakes');
    const errors = data.attempts.filter((a) => !a.correct).slice(0, 20);
    draw(recent, [data.classroom?.id, errors], () => {
      if (!errors.length) recent.append(el('p', '間違えた回答がここに表示されます。'));
      for (const answer of errors) recent.append(attemptRow(answer));
    });
    renderProjection(data, summary);
  };
}
