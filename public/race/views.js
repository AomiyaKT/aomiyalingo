import { createTimingTower } from './timing-tower.js';
import { setTextIfChanged, setAttributeIfChanged } from '../shared/dom.js';
export function createRaceViews({ q, make, isTeacher, avatars, getData, appSettings }) {
  function avatarArt(id) {
    const a = avatars[id] || avatars.cat,
      frame = make('span', undefined, 'avatar-art'),
      img = make('img');
    img.src = a.src;
    img.alt = '';
    img.draggable = false;
    img.style.width = a.scale + '%';
    img.style.height = a.scale + '%';
    img.style.transform = 'translate(-50%,-50%) translate(' + a.x + '%,' + a.y + '%)';
    frame.append(img);
    return frame;
  }
  function lanes(panel, players, selfId = null) {
    const data = getData();
    const shown = players;
    const shownIds = new Set(shown.map((p) => p.id));
    const leadingScore = Math.max(1, ...players.map((p) => p.score));
    if (!shown.length) {
      if (!panel.querySelector('.race-empty')) {
        panel.replaceChildren(make('p', '参加したレーサーがここに並びます。', 'race-empty'));
      }
      return;
    }
    panel.querySelector('.race-empty')?.remove();
    const existing = new Map([...panel.children].map((n) => [n.dataset.id, n]));
    for (const [position, p] of shown.entries()) {
      let lane = existing.get(p.id);
      if (!lane) {
        lane = make('div', undefined, 'race-lane' + (p.id === selfId ? ' own-lane' : ''));
        lane.dataset.id = p.id;
        const name = make('span', undefined, 'lane-name');
        name.append(make('small', '', 'lane-rank'), make('strong', p.alias));
        lane.append(name);
        const road = make('div', undefined, 'lane-road'),
          cat = make('span', undefined, 'lane-cat lane-avatar');
        cat.setAttribute('role', 'img');
        cat.style.left = '4%';
        road.append(cat);
        lane.append(road, make('strong', '', 'lane-score'));
        panel.append(lane);
      }
      setTextIfChanged(
        lane.querySelector('.lane-rank'),
        p.rank
          ? p.rank +
              '位' +
              (data?.race?.rules >= 4 && data.race.status !== 'finished' ? '（暫定）' : '')
          : (p.answered ?? p.index)
            ? '参考記録'
            : '参加済み',
      );
      setTextIfChanged(lane.querySelector('.lane-name strong'), p.alias);
      if (panel.children[position] !== lane)
        panel.insertBefore(lane, panel.children[position] || null);
      const face = lane.querySelector('.lane-cat');
      if (face.dataset.avatar !== (p.avatar || 'cat')) {
        face.replaceChildren(avatarArt(p.avatar));
        face.dataset.avatar = p.avatar || 'cat';
      }
      setAttributeIfChanged(
        face,
        'aria-label',
        p.alias + ' ' + (avatars[p.avatar] || avatars.cat).name,
      );
      lane.querySelector('.lane-cat').style.left =
        Math.min(
          89,
          4 +
            (data?.race?.rules >= 4
              ? data.race.endless
                ? p.score / leadingScore
                : p.correct / Math.max(1, data.race.total)
              : p.score /
                Math.max(
                  1,
                  (data?.race?.total || 24) *
                    ((data?.race?.settings?.correctPoints || 100) +
                      (data?.race?.settings?.boostPoints || 40)),
                )) *
              85,
        ) + '%';
      if (lane.dataset.score && p.score > Number(lane.dataset.score)) {
        lane.classList.add('lane-moving');
        setTimeout(() => lane.classList.remove('lane-moving'), 650);
      }
      lane.dataset.score = String(p.score);
      const score = lane.querySelector('.lane-score');
      if (data?.race?.rules >= 4) {
        if (!score.children.length) score.append(make('span'), make('small'));
        setTextIfChanged(score.children[0], p.accuracy === null ? '—' : p.accuracy + '%');
        setTextIfChanged(
          score.children[1],
          (data.race.endless
            ? p.stationIndex
            : data.race.rules >= 5
              ? p.stationIndex + '/' + data.race.stationQuestions
              : p.index + '/' + data.race.total) +
            '問 · ' +
            p.score +
            ' pt',
        );
      } else setTextIfChanged(score, p.score + ' pt');
    }
    for (const lane of [...panel.children]) if (!shownIds.has(lane.dataset.id)) lane.remove();
  }
  const timingTower = createTimingTower({ make, avatarArt, getData, appSettings });
  function podiumCard(player, stats) {
    const card = make('div', undefined, 'podium-card'),
      identity = make('div', undefined, 'podium-identity'),
      number = make('strong', player.label || player.alias.replace(/^出席番号\s*/, ''));
    // Attendance numbers are identifiers, not translatable interface copy.
    number.translate = false;
    identity.append(make('small', '出席番号'), number);
    card.dataset.rank = String(player.rank);
    card.append(
      avatarArt(player.avatar),
      make('span', (player.rank === 1 ? '🏆 ' : '') + player.rank + '位', 'podium-place'),
      identity,
      make('span', stats, 'podium-stats'),
    );
    return card;
  }
  function drawStationResults(panel, result) {
    if (!panel) return;
    const courses = (result.stationResults || []).filter((c) => c.closed);
    panel.hidden =
      !courses.length ||
      (!isTeacher &&
        !['intermission', 'finished'].includes(result.race.status) &&
        !result.self?.done);
    if (!courses.length) return;
    const key = JSON.stringify([courses, result.race.status]);
    if (panel.dataset.results === key) return;
    panel.dataset.results = key;
    panel.replaceChildren();
    const names = ['草原', '海辺', '星空'];
    for (const course of courses) {
      const section = make('details', undefined, 'station-result'),
        heading = make(
          'summary',
          '🏁 コース ' + (course.station + 1) + ' · ' + names[course.station] + ' のトップ3',
        ),
        cards = make('div', undefined, 'race-podium');
      section.open =
        course === courses[courses.length - 1] &&
        ['intermission', 'finished'].includes(result.race.status);
      section.append(heading, cards);
      const winners = course.players.filter((p) => p.rank <= 3);
      if (!winners.length) cards.append(make('p', 'このコースの回答記録はありません。'));
      for (const p of winners) {
        cards.append(podiumCard(p, p.score.toLocaleString() + ' pt · ' + p.accuracy + '%'));
      }
      panel.append(section);
    }
  }
  function podium(panel, players) {
    const data = getData();
    if (panel.hidden) return;
    const winners = players.filter((p) => p.rank && p.rank <= 3);
    const key = JSON.stringify([
      data?.race?.id,
      data?.race?.rules,
      winners.map((p) => [p.id, p.rank, p.label, p.alias, p.avatar, p.score, p.accuracy]),
    ]);
    if (panel.dataset.podium === key) return;
    panel.dataset.podium = key;
    panel.replaceChildren();
    for (const p of winners) {
      panel.append(
        podiumCard(
          p,
          data?.race?.rules >= 4
            ? p.accuracy + '% · ' + p.score.toLocaleString() + ' pt'
            : p.score.toLocaleString() + ' pt',
        ),
      );
    }
  }
  function drawWall(players) {
    const data = getData();
    const wall = q('#race-participant-wall');
    if (players.length <= 8) {
      wall.hidden = true;
      return;
    }
    wall.hidden = false;
    const existing = new Map([...wall.children].map((n) => [n.dataset.id, n]));
    for (const p of players) {
      let card = existing.get(p.id);
      if (!card) {
        card = make('div', undefined, 'participant-chip');
        card.dataset.id = p.id;
        card.append(make('span', undefined, 'wall-face'), make('strong', p.alias), make('small'));
        wall.append(card);
      }
      if (card.dataset.avatar !== p.avatar) {
        card.querySelector('.wall-face').replaceChildren(avatarArt(p.avatar));
        card.dataset.avatar = p.avatar;
      }
      setTextIfChanged(card.querySelector('strong'), p.alias);
      setTextIfChanged(
        card.querySelector('small'),
        data?.race?.endless ? p.stationIndex + '問回答' : p.index + '/' + (data?.race?.total || 24),
      );
      card.classList.toggle(
        'wall-finished',
        data?.race?.endless ? p.done : p.index >= (data?.race?.total || 24),
      );
    }
    for (const card of [...wall.children])
      if (!players.some((p) => p.id === card.dataset.id)) card.remove();
  }

  return { avatarArt, lanes, timingTower, drawStationResults, podium, drawWall };
}
