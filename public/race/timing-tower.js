import { exerciseNames } from '../learning/exercises.js';
import { setTextIfChanged, setAttributeIfChanged } from '../shared/dom.js';
import { createTeacherClock } from './teacher-clock.js';

export function createTimingTower({ make, avatarArt, getData, appSettings }) {
  const clock = createTeacherClock();
  const layoutColumns = new WeakMap();
  function timingTower(panel, players) {
    const data = getData();
    if (!players.length) {
      if (panel.children.length) panel.replaceChildren();
      clock.bind(new Map());
      return;
    }
    const reduced =
      appSettings.values.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const incomingRanks = new Map(players.map((p, i) => [p.id, p.rank || i + 1]));
    const previous =
      data?.race?.id === panel.dataset.race
        ? new Map(
            [...panel.querySelectorAll('.timing-row')].map((row) => [
              row.dataset.id,
              {
                rect:
                  !reduced &&
                  incomingRanks.has(row.dataset.id) &&
                  Number(row.dataset.rank) !== incomingRanks.get(row.dataset.id)
                    ? row.getBoundingClientRect()
                    : null,
                rank: Number(row.dataset.rank),
              },
            ]),
          )
        : new Map();
    if (panel.dataset.race !== data?.race?.id) panel.replaceChildren();
    panel.dataset.race = data?.race?.id || '';
    const columns = Math.min(
        4,
        Math.ceil(players.length / 9),
        Math.max(1, Math.floor(panel.clientWidth / 290)),
      ),
      rows = Math.ceil(players.length / columns);
    if (layoutColumns.get(panel) !== columns) {
      panel.style.setProperty('--tower-columns', columns);
      layoutColumns.set(panel, columns);
    }
    for (let i = panel.children.length; i < columns; i++) {
      const col = make('section', undefined, 'tower-column'),
        head = make('div', undefined, 'tower-heading');
      head.append(make('span', '順位'), make('span', '生徒'), make('span', '得点'));
      col.append(head);
      panel.append(col);
    }
    const existing = new Map(
      [...panel.querySelectorAll('.timing-row')].map((row) => [row.dataset.id, row]),
    );
    const timers = new Map();
    players.forEach((p, i) => {
      let row = existing.get(p.id);
      if (!row) {
        row = make('div', undefined, 'timing-row');
        row.dataset.id = p.id;
        const position = make('div', undefined, 'timing-position'),
          face = make('span', undefined, 'timing-avatar'),
          driver = make('div', undefined, 'timing-driver'),
          score = make('div', undefined, 'timing-score');
        position.append(make('strong'), make('small', '', 'timing-change'));
        driver.append(make('strong'), make('time', '', 'timing-time'), make('small'));
        score.append(make('strong'), make('small'));
        row.append(position, face, driver, score);
      }
      const rank = p.rank || i + 1,
        old = previous.get(p.id),
        position = row.querySelector('.timing-position');
      setTextIfChanged(position.querySelector('strong'), String(rank).padStart(2, '0'));
      row.dataset.rank = rank;
      row.classList.toggle('timing-leader', p.rank === 1);
      row.classList.toggle('timing-done', p.done);
      setAttributeIfChanged(
        row,
        'aria-label',
        rank +
          '位 ' +
          p.alias +
          ' ' +
          p.score +
          '点' +
          (data.race?.status === 'lobby' ? (p.prepared ? ' 準備完了' : ' 選択中') : ''),
      );
      const change = position.querySelector('small');
      if (old && old.rank !== rank) {
        const delta = old.rank - rank;
        change.textContent = (delta > 0 ? '▲' : '▼') + Math.abs(delta);
        change.className = 'timing-change ' + (delta > 0 ? 'up' : 'down');
        row.dataset.changed = Date.now();
        row.dataset.change = delta > 0 ? 'up' : 'down';
      } else if (Date.now() - Number(row.dataset.changed || 0) > 5000) {
        delete row.dataset.change;
        setTextIfChanged(change, '');
        if (change.className !== 'timing-change') change.className = 'timing-change';
      }
      const face = row.querySelector('.timing-avatar');
      if (face.dataset.avatar !== p.avatar) {
        face.replaceChildren(avatarArt(p.avatar));
        face.dataset.avatar = p.avatar;
      }
      setTextIfChanged(
        row.querySelector('.timing-driver strong'),
        p.label || p.alias.replace('出席番号 ', ''),
      );
      row.classList.toggle('timing-ready', data.race?.status === 'lobby' && p.prepared);
      row.classList.toggle('timing-not-ready', data.race?.status === 'lobby' && !p.prepared);
      setTextIfChanged(
        row.querySelector('.timing-driver small'),
        data.race?.status === 'lobby'
          ? p.prepared
            ? '✓ 準備完了'
            : '選択中'
          : p.ready === false
            ? '準備中'
            : data.race?.endless
              ? (p.done || data.race.status === 'finished'
                  ? '時間終了'
                  : p.reviewing
                    ? '復習スター'
                    : exerciseNames[p.mode] || '回答中') +
                ' · ' +
                p.stationIndex +
                '問回答'
              : (data.race?.rules >= 5
                  ? p.stationIndex + '/' + data.race.stationQuestions
                  : p.index + '/' + (data.race?.total || 24)) +
                ' · ' +
                (p.completed ||
                (data.race?.rules >= 5 && p.stationIndex >= data.race.stationQuestions)
                  ? '完了'
                  : p.done
                    ? '時間終了'
                    : exerciseNames[p.mode] || '回答中'),
      );
      const time = row.querySelector('.timing-time');
      timers.set(p.id, time);
      setTextIfChanged(
        time,
        data.race.status === 'finished' || p.done
          ? '0:00'
          : Math.floor(Math.ceil(Math.max(0, p.remaining) / 1000) / 60) +
              ':' +
              String(Math.ceil(Math.max(0, p.remaining) / 1000) % 60).padStart(2, '0'),
      );
      if (!time.hasAttribute('aria-label')) time.setAttribute('aria-label', '残り時間');
      setTextIfChanged(row.querySelector('.timing-score strong'), p.score.toLocaleString());
      const accuracy = row.querySelector('.timing-score small');
      setTextIfChanged(accuracy, p.accuracy === null ? '未回答' : p.accuracy + '%');
      setAttributeIfChanged(accuracy, 'title', '自力正解率');
      setAttributeIfChanged(
        accuracy,
        'aria-label',
        p.accuracy === null ? '未回答' : p.accuracy + '% 自力正解',
      );
      const column = panel.children[Math.floor(i / rows)],
        slot = 1 + (i % rows);
      if (column.children[slot] !== row) column.insertBefore(row, column.children[slot] || null);
    });
    for (const row of panel.querySelectorAll('.timing-row'))
      if (!incomingRanks.has(row.dataset.id)) row.remove();
    while (panel.children.length > columns) panel.lastChild.remove();
    clock.bind(timers);
    // Finish every layout read before starting any animation. Interleaving them
    // can force a separate layout pass for each overtaking student.
    const moves = [];
    if (!reduced)
      for (const row of panel.querySelectorAll('.timing-row')) {
        const old = previous.get(row.dataset.id);
        if (!old?.rect || old.rank === Number(row.dataset.rank)) continue;
        const rect = row.getBoundingClientRect(),
          x = old.rect.left - rect.left,
          y = old.rect.top - rect.top;
        if (x || y) {
          moves.push({ row, x, y });
        }
      }
    for (const { row, x, y } of moves) {
      row.getAnimations().forEach((a) => a.cancel());
      row.animate(
        [
          { transform: 'translate(' + x + 'px,' + y + 'px)', background: '#ddf4ff' },
          { transform: 'translate(0,0)', background: 'transparent' },
        ],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' },
      );
    }
  }
  timingTower.clock = (players, race, elapsed) => clock.update(players, race, elapsed);
  return timingTower;
}
