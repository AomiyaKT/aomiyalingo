import { createRaceRecords } from './records.js';
import { setTextIfChanged } from '../shared/dom.js';
import { translateUI } from '../shared/i18n.js';
export function createTeacherRaceView({
  q,
  make,
  getData,
  onData,
  logged,
  isTeacher,
  statusName,
  teacherViewState,
  isBusy,
  isPreparing = () => false,
  onRestore,
  onPurge,
  timingTower,
  drawStationResults,
  podium,
  drawTeam,
  drawWall,
}) {
  const drawRecords = createRaceRecords(q('#race-private-records'));
  let trashSignature = null,
    shellSignature = null,
    musicSignature = null;
  function drawTeacher(result, { silent = false } = {}) {
    const previousRace = getData()?.race?.id;
    const preparing = isPreparing();
    onData(result, { silent: silent || preparing });
    logged(true);
    const r = preparing ? null : result.race,
      players = preparing ? [] : result.players;
    if (result.races) teacherViewState.races = result.races;
    const shell = JSON.stringify([
      r?.id,
      r?.title,
      r?.status,
      r?.station,
      r?.rules,
      r?.accepting,
      preparing,
      isBusy(),
      !!result.race,
      players.length,
      players.filter((p) => p.prepared).length,
      teacherViewState.races.map((race) => [race.id, race.title, race.status]),
    ]);
    const state = r?.status || 'setup';
    if (document.body.dataset.teacherRaceState !== state)
      document.body.dataset.teacherRaceState = state;
    const music = r ? { id: r.id, status: r.status, startsIn: r.startsIn } : null;
    const musicKey = JSON.stringify(music);
    if (musicKey !== musicSignature) {
      musicSignature = musicKey;
      window.teacherRaceMusicState = music;
      window.dispatchEvent(new CustomEvent('aomiyalingo-race-music', { detail: music }));
    }
    renderRaceTrash(result);
    setTextIfChanged(
      q('#board-race-status'),
      translateUI(
        r
          ? r.status === 'lobby' && !r.accepting
            ? '参加受付は締切中'
            : statusName[r.status]
          : '教材とルールを選ぶ',
        document.documentElement?.lang,
      ),
    );
    if (shell !== shellSignature) {
      shellSignature = shell;
      document.body.classList.toggle('no-race', !r);
      const history = q('#race-history');
      if (result.races) teacherViewState.races = result.races;
      if (
        history.options.length !== teacherViewState.races.length ||
        [...history.options].some((o, i) => o.value !== teacherViewState.races[i]?.id)
      ) {
        history.replaceChildren();
        for (const old of teacherViewState.races) {
          const option = make('option', old.title + ' · ' + statusName[old.status]);
          option.value = old.id;
          history.append(option);
        }
      }
      history.disabled = !teacherViewState.races.length;
      q('#race-archives').hidden = teacherViewState.races.length < 2;
      if (r) {
        history.value = r.id;
        const option = [...history.options].find((o) => o.value === r.id);
        if (option) option.textContent = r.title + ' · ' + statusName[r.status];
      }
      aomiClassroomLink(
        q('#race-qr-image'),
        q('#race-student-link'),
        location.origin,
        'race',
        r && r.status !== 'finished' ? r.id : null,
      );
      q('#board-race-title').textContent = r?.title || 'レースを準備しよう';
      q('#board-race-title').translate = !r;
      q('#new-race-panel').hidden = !!r;
      if (!r) q('#new-race-panel').open = true;
      else if (previousRace !== r.id) q('#new-race-panel').open = false;
      q('#delete-race').hidden = r?.status !== 'finished';
      q('#delete-race').disabled = isBusy() || r?.status !== 'finished';
      q('#race-again').hidden = r?.status !== 'finished';
      q('#race-reset').hidden = !r || r.status === 'finished';
      q('#race-setup-back').hidden = !!r || !result.race;
      q('#race-setup-back').textContent = '前の結果に戻る';
      q('#race-start').hidden = !['lobby', 'intermission'].includes(r?.status);
      q('#race-start').textContent =
        r?.status === 'intermission'
          ? 'コース ' + ((r.station || 0) + 2) + ' を開始'
          : 'レースを開始';
      q('#race-start').disabled = !players.length;
      q('#race-start').dataset.help =
        r?.status === 'intermission'
          ? '結果を確認したら、次のコースを開始します。'
          : 'QR欄で準備完了の人数を確認してからスタートします。';
      q('#race-pause').hidden = !['running', 'paused', 'countdown'].includes(r?.status);
      q('#race-pause').textContent = r?.status === 'paused' ? 'レースを再開' : '一時停止';
      q('#race-pause').dataset.help =
        r?.status === 'paused'
          ? '回答と時計を止めた位置から再開します。'
          : '全員の回答と時計を一時停止します。';
      q('#race-end').dataset.help = '受付と回答を停止します。ここまでの成績は保存されます。';
      q('#race-reset').dataset.help =
        '現在のレースを中止して、新しいレースの設定に戻ります。成績は履歴に残ります。';
      q('#race-join-toggle').dataset.help = r?.accepting
        ? '新しい参加だけを止めます。参加済みの生徒は続けられます。'
        : '新しい生徒がQRから参加できるようにします。';
      q('#race-end').hidden = !r || r.status === 'finished';
      q('#race-join-status').textContent = r?.accepting
        ? r.status === 'lobby'
          ? '参加受付中'
          : '途中参加できます'
        : '参加受付は終了';
      q('#race-qr-title').textContent = r?.status === 'finished' ? '記録保存済み' : '生徒用QR';
      q('#race-qr-help').dataset.help =
        r?.status === 'finished'
          ? 'このレースは終了しました。次は「新しいレースを準備」から内容を選び、新しいQRを生徒に見せてください。'
          : '出席番号とアバターを選び、準備完了を押してね。';
      q('#race-export-summary').hidden = r?.status !== 'finished';
      if (r)
        q('#race-export-summary').href =
          '/api/teacher/race/export?race=' + encodeURIComponent(r.id);
      q('#race-join-toggle').hidden = !r || ['finished', 'intermission'].includes(r.status);
      q('#race-join-toggle').textContent = r?.accepting ? '参加受付を締め切る' : '参加受付を再開';
      for (const button of q('.race-controls').querySelectorAll('button')) {
        button.disabled = isBusy() || (button.id === 'race-start' && !players.length);
      }
      for (const id of ['#race-join-toggle','#race-reset','#delete-race']) q(id).disabled=isBusy();
      history.disabled = isBusy() || !teacherViewState.races.length;
      q('#race-player-count').replaceChildren(
        ...(r?.status === 'lobby'
          ? [
              make('small', '準備完了'),
              make(
                'span',
                players.filter((p) => p.prepared).length + ' / ' + players.length + '人',
              ),
            ]
          : [make('span', players.length + '人')]),
      );
      q('#race-track-title').textContent =
        r?.status === 'finished'
          ? 'レース結果'
          : r?.status === 'lobby'
            ? 'スタートを待っています'
            : r?.rules >= 5
              ? '総合ライブ順位 · コース ' + (r.station + 1) + ' / 3'
              : 'ライブ順位';
    }
    timingTower(q('#teacher-race-lanes'), players);
    drawStationResults(q('#teacher-station-results'), result);
    q('#teacher-race-podium').hidden = r?.status !== 'finished';
    podium(q('#teacher-race-podium'), players);
    drawTeam(result.team, 'teacher');
    drawWall(players);
    q('#race-export').hidden = !r;
    if (r) q('#race-export').href = '/api/teacher/race/export?race=' + encodeURIComponent(r.id);
    drawRecords(result);
  }

  function renderRaceTrash(result) {
    if (result.trash) {
      teacherViewState.trash = result.trash;
      teacherViewState.trashVersion = result.trashVersion;
    }
    const signature = JSON.stringify([
      teacherViewState.trash,
      teacherViewState.trashVersion,
      isBusy(),
    ]);
    if (signature === trashSignature) return;
    trashSignature = signature;
    q('#race-trash-panel').hidden = !teacherViewState.trash.length;
    q('#race-trash-count').textContent = teacherViewState.trash.length;
    q('#race-trash-empty').disabled = isBusy() || !teacherViewState.trashVersion;
    q('#race-trash-empty').textContent = '全' + teacherViewState.trash.length + '件を完全に削除';
    const list = q('#race-trash-list');
    list.replaceChildren();
    for (const r of teacherViewState.trash) {
      const row = make('div', undefined, 'race-trash-row'),
        info = make('div');
      info.append(
        make('strong', r.title),
        make('small', r.players + '人 · ' + new Date(r.deleted_at).toLocaleString('ja-JP')),
      );
      const button = make('button', 'レースを戻す', 'home-button');
      button.type = 'button';
      button.disabled = isBusy();
      button.onclick = () => onRestore(r);
      const remove = make('button', '完全に削除', 'race-danger');
      remove.type = 'button';
      remove.disabled = isBusy();
      remove.onclick = () => onPurge(r);
      const actions = make('div', undefined, 'race-trash-actions');
      actions.append(button, remove);
      row.append(info, actions);
      list.append(row);
    }
  }

  return drawTeacher;
}
