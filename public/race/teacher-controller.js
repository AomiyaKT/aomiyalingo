import { createRaceReset } from './reset.js';
import { recordSyncQuery, restoreRaceRecords } from '../shared/race-record-sync.js';
import { curriculumSelection, curriculumProfile, curriculumValue } from '../shared/curriculum.js';

// Teacher setup, confirmation and lifecycle controls never initialize on a student page.
export function createTeacherRaceController({
  q,
  api,
  getData,
  getTrash = () => ({ races: getData()?.trash || [], version: getData()?.trashVersion }),
  drawTeacher,
  poll,
  logged,
  lifecycle,
  settings,
  effects,
  events = window,
}) {
  let selectedRace = null,
    teacherReset = null,
    confirmRaceLifecycle;
  let ruleSummaryLoaded = false,
    raceGradeRoot = null,
    rulesVersion = 0,
    ruleRequest = null;
  events.addEventListener('aomi-mode-settings-saved', () => {
    ruleSummaryLoaded = false;
    rulesVersion++;
    loadRuleSummary();
  });
  function loadRuleSummary() {
    if (ruleSummaryLoaded) return Promise.resolve();
    if (ruleRequest?.version === rulesVersion) return ruleRequest.promise;
    const version = rulesVersion;
    const promise = api('/api/teacher/config')
      .then((x) => {
        if (version !== rulesVersion) return;
        ruleSummaryLoaded = true;
        raceGradeRoot = x.config;
        showRaceGrade(false);
      })
      .catch(() => {})
      .finally(() => {
        if (ruleRequest?.version === version) ruleRequest = null;
      });
    ruleRequest = { version, promise };
    return promise;
  }
  function showRaceGrade(resetTitle = true) {
    if (!raceGradeRoot) return;
    const choice = curriculumSelection(q('#race-grade').value),
      profile = curriculumProfile(raceGradeRoot, q('#race-grade').value),
      c = profile.race;
    if (resetTitle || !q('#race-title').value)
      q('#race-title').value = choice.label + ' · 単語レース';
    q('#race-config-summary').textContent =
      choice.label +
      ' · ' +
      c.wordIds.length +
      '語 · ' +
      '3コース · 問題数は無制限 · 1コース' +
      c.minutes +
      '分 · 得点順 · ' +
      (c.format !== 'classic'
        ? ['各コース4種類・答えに合わせたヒント']
        : c.modes.map((m) => ({ text: '単語', voice: 'リスニング', spelling: 'スペリング' })[m])
      ).join('／') +
      ' · ' +
      '生徒ごとにランダムな順番' +
      ' · ' +
      (c.items.length ? c.itemEvery + '問ごとに道具' : '道具なし');
  }
  let confirmation = null;
  let setupSource = null;
  function confirm(title, description, action, label = '確認', permanent = false) {
    confirmation = action;
    q('#race-confirm-ok').textContent = label;
    q('#race-confirm-ok').className = permanent ? 'submit race-danger' : 'submit';
    q('#race-confirm-title').textContent = title;
    q('#race-confirm-description').textContent = description;
    q('#race-confirm-error').textContent = '';
    q('#race-confirm').showModal();
    q('#race-confirm-cancel').focus();
  }
  q('#race-confirm').addEventListener('cancel', (e) => {
    if (lifecycle.busy || q('#race-confirm-ok').disabled) e.preventDefault();
  });
  q('#race-confirm-cancel').onclick = () => q('#race-confirm').close();
  q('#race-confirm-ok').onclick = async () => {
    if (!confirmation || q('#race-confirm-ok').disabled) return;
    q('#race-confirm-ok').disabled = true;
    q('#race-confirm-cancel').disabled = true;
    try {
      await confirmation();
      q('#race-confirm').close();
      if (teacherReset?.preparing) q('#race-grade').focus({ preventScroll: true });
    } catch (e) {
      q('#race-confirm-error').textContent = e.message;
    } finally {
      q('#race-confirm-ok').disabled = false;
      q('#race-confirm-cancel').disabled = false;
    }
  };
  teacherReset = createRaceReset({
    getData,
    isBusy: () => lifecycle.busy,
    confirm,
    async endRace(id) {
      lifecycle.busy = true;
      lifecycle.epoch++;
      try {
        return await api('/api/teacher/race/state', {
          raceId: id,
          action: 'end',
          confirm: true,
        });
      } finally {
        lifecycle.busy = false;
      }
    },
    onPrepare(result) {
      lifecycle.epoch++;
      if (result?.race && setupSource !== result.race.id) {
        setupSource = result.race.id;
        q('#race-grade').value = curriculumValue(
          result.race.settings.grade,
          result.race.settings.unit,
        );
        showRaceGrade();
      }
      drawTeacher(result, { silent: true });
      q('#new-race-panel').scrollIntoView({
        behavior: settings.values.reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      q('#race-grade').focus({ preventScroll: true });
    },
    onReturn() {
      lifecycle.epoch++;
      if (getData()) drawTeacher(getData());
      q('#new-race-panel').open = false;
      q('.race-board-heading').scrollIntoView({
        behavior: settings.values.reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
  });
  q('#race-reset').onclick = () => teacherReset.request();
  q('#race-setup-back').onclick = () => {
    if (getData()?.race) teacherReset.back();
    else location.assign('/');
  };
  confirmRaceLifecycle = (r, restore = false) => {
    if (lifecycle.busy || !r || (!restore && r.status !== 'finished')) return;
    const action = { raceId: r.id, raceTitle: r.title, confirm: true };
    confirm(
      restore ? 'このレースを戻しますか？' : 'このレースを削除しますか？',
      '「' +
        r.title +
        '」' +
        (restore
          ? 'と保存された成績を戻します。レースは終了した状態で戻り、進行中のレースには影響しません。'
          : 'と成績・回答履歴を回収箱へ移します。後から戻せます。他のレースは残ります。'),
      async () => {
        lifecycle.busy = true;
        lifecycle.epoch++;
        try {
          await api('/api/teacher/race/' + (restore ? 'restore' : 'delete'), action);
          selectedRace = restore ? r.id : null;
          q('#race-lifecycle-result').textContent =
            '「' + r.title + '」' + (restore ? 'を戻しました。' : 'を回収箱に移しました。');
          effects.sound('save');
        } finally {
          lifecycle.busy = false;
        }
        await poll();
      },
      restore ? 'レースを戻す' : 'このレースを削除',
    );
  };
  q('#delete-race').onclick = () => confirmRaceLifecycle(getData()?.race);
  function purge(race = null) {
    if (lifecycle.busy) return;
    const trash = getTrash();
    if (!race && (!trash.races.length || !trash.version)) return;
    const payload = race
      ? {
          scope: 'one',
          raceId: race.id,
          raceTitle: race.title,
          revision: race.revision,
          deletedAt: race.deleted_at,
          confirm: true,
        }
      : { scope: 'all', trashVersion: trash.version, confirm: true };
    const name = race ? '「' + race.title + '」' : '回収箱の全' + trash.races.length + '件のレース';
    confirm(
      race ? 'このレースを完全に削除しますか？' : '回収箱を空にしますか？',
      name +
        'と、参加した生徒の成績・回答履歴を完全に削除します。元に戻せません。進行中のレースは削除しません。',
      async () => {
        lifecycle.busy = true;
        lifecycle.epoch++;
        try {
          const result = await api('/api/teacher/race/purge', payload);
          q('#race-lifecycle-result').textContent =
            result.removed + '件のレースを完全に削除しました。';
          effects.sound('save');
        } finally {
          lifecycle.busy = false;
        }
        await poll();
      },
      race ? '完全に削除' : 'すべて完全に削除',
      true,
    );
  }
  q('#race-trash-empty').onclick = () => purge();
  q('#race-history').onchange = () => {
    lifecycle.epoch++;
    selectedRace = q('#race-history').value;
    poll();
  };
  q('#race-title').value = curriculumSelection(q('#race-grade').value).label + ' · 単語レース';
  q('#race-grade').onchange = () => showRaceGrade();
  q('#race-login').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter;
    b.disabled = true;
    try {
      await api('/api/teacher/login', { password: q('#race-password').value });
      q('#race-password').value = '';
      await poll();
    } catch (err) {
      q('#teacher-race-error').textContent = err.message;
    } finally {
      b.disabled = false;
    }
  };
  q('#teacher-logout').onclick = async () => {
    lifecycle.epoch++;
    try {
      await api('/api/teacher/logout', {});
      q('#settings-dialog').close();
      logged(false);
    } catch (e) {
      q('#teacher-logout-error').hidden = false;
      q('#teacher-logout-error').textContent = e.message;
    }
  };
  q('#race-again').onclick = () => teacherReset.request();
  async function create() {
    if (lifecycle.busy) return;
    lifecycle.busy = true;
    lifecycle.epoch++;
    q('#create-race').inert = true;
    try {
      const created = await api('/api/teacher/race/create', {
        grade: curriculumSelection(q('#race-grade').value).grade,
        unit: curriculumSelection(q('#race-grade').value).unit,
        title: q('#race-title').value,
        endless: true,
        format: raceGradeRoot
          ? curriculumProfile(raceGradeRoot, q('#race-grade').value).race.format || 'adaptive-four'
          : 'adaptive-four',
      });
      selectedRace = null;
      const next = await api('/api/teacher/race/board?race=' + encodeURIComponent(created.raceId));
      teacherReset.complete();
      drawTeacher(next, { silent: true });
      q('#new-race-panel').open = false;
      effects.sound('save');
    } finally {
      lifecycle.busy = false;
      q('#create-race').inert = false;
      if (getData()) drawTeacher(getData());
    }
  }
  q('#create-race').onsubmit = async (e) => {
    e.preventDefault();
    if (getData()?.race && getData().race.status !== 'finished') {
      confirm(
        '新しいレースを準備しますか？',
        '「' + getData().race.title + '」を終了し、新しい参加受付を始めます。成績は保存されます。',
        create,
      );
      return;
    }
    e.submitter.disabled = true;
    try {
      await create();
    } catch (err) {
      q('#board-race-status').textContent = err.message;
    } finally {
      e.submitter.disabled = false;
    }
  };
  async function control(action, raceId = getData()?.race?.id) {
    if (lifecycle.busy || !raceId) return;
    lifecycle.busy = true;
    lifecycle.epoch++;
    for (const b of q('.race-controls').querySelectorAll('button')) b.disabled = true;
    for (const id of ['#race-join-toggle','#race-reset','#delete-race']) q(id).disabled=true;
    q('#board-race-status').textContent = '変更を保存しています…';
    try {
      const result = await api('/api/teacher/race/state', {
        raceId,
        action,
        confirm: action === 'end',
      });
      drawTeacher(result, { silent: action === 'end' });
      effects.sound('save');
    } finally {
      lifecycle.busy = false;
      if (getData()) drawTeacher(getData());
    }
  }
  q('#race-join-toggle').onclick = () =>
    control(getData().race.accepting ? 'closeJoin' : 'openJoin').catch(
      (e) => (q('#board-race-status').textContent = e.message),
    );
  q('#race-start').onclick = () => {
    const race = getData().race;
    const start = () => control(race.status === 'intermission' ? 'nextStation' : 'start', race.id);
    const unprepared = (getData().players || []).filter((p) => !p.prepared);
    if (getData().race.status === 'lobby' && unprepared.length) {
      confirm(
        'まだ準備中の生徒がいます',
        '出席番号 ' +
          unprepared.map((p) => p.label || p.alias).join('・') +
          ' は準備中です。このまま開始しますか？',
        start,
        'このまま開始',
      );
    } else start().catch((e) => (q('#board-race-status').textContent = e.message));
  };
  q('#race-pause').onclick = () =>
    control(getData().race.status === 'paused' ? 'resume' : 'pause').catch(
      (e) => (q('#board-race-status').textContent = e.message),
    );
  q('#race-end').onclick = () => {
    const id = getData().race.id;
    confirm(
      'レースを終了しますか？',
      '「' + getData().race.title + '」の受付と回答を停止します。ここまでの成績を保存します。',
      async () => {
        await control('end', id);
        await poll();
      },
    );
  };

  return {
    get preparing() {
      return teacherReset.preparing;
    },
    loadRules: loadRuleSummary,
    confirmLifecycle: confirmRaceLifecycle,
    purge,
    async refresh(isCurrent) {
      const previous = getData();
      const query = recordSyncQuery(previous);
      async function read(path) {
        const result = await api(
          path + (query ? (path.includes('?') ? query : '?' + query.slice(1)) : ''),
        );
        if (!isCurrent()) return result;
        try {
          return restoreRaceRecords(result, previous);
        } catch {
          // A missing local snapshot heals with one full read, rather than
          // leaving the teacher stuck on a partial record response.
          return api(path);
        }
      }
      const latest = await read('/api/teacher/race/current');
      if (!isCurrent()) return;
      if (selectedRace && !latest.races.some((r) => r.id === selectedRace)) selectedRace = null;
      if (selectedRace && selectedRace !== latest.race?.id) {
        const old = await read('/api/teacher/race/board?race=' + encodeURIComponent(selectedRace));
        if (!isCurrent()) return;
        drawTeacher({
          ...old,
          races: latest.races,
          trash: latest.trash,
          trashVersion: latest.trashVersion,
        });
      } else drawTeacher(latest);
    },
  };
}
