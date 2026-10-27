import { createRaceShowtime } from './race/showtime.js';
import { installStudentViewport } from './shared/student-viewport.js';
import { installContextHelp } from './shared/context-help.js';
import { createExerciseController } from './race/exercises.js';
import { makeElement as make, setTextIfChanged, setAttributeIfChanged } from './shared/dom.js';
import { createRewardFeedback } from './race/rewards.js';
import { createTeacherRaceView } from './race/teacher.js';
import { createItemRoulette } from './race/items.js';
import { createRaceApi } from './race/api.js';
import { createRaceViews } from './race/views.js';
import { studentPhase } from './race/lifecycle.js';
import { createWaitingReview } from './race/review.js';
import { renderRaceBriefing } from './race/briefing.js';
import { createTeacherRaceController } from './race/teacher-controller.js';
import { createPollScheduler } from './shared/poll-scheduler.js';
import { createResourcePreloader, taskResourceHints } from './shared/resource-preloader.js';
(() => {
  const q = (s) => document.querySelector(s),
    isTeacher = document.body.classList.contains('race-teacher');
  const targetRace = !isTeacher && new URLSearchParams(location.search).get('race');
  if (!isTeacher) installStudentViewport();
  else installContextHelp();
  const preloader = !isTeacher ? createResourcePreloader() : null;
  const currentRacePath =
    '/api/race/current' + (targetRace ? '?race=' + encodeURIComponent(targetRace) : '');
  const lifecycle = { busy: false, epoch: 0 };
  let teacherController = null;
  let data = null,
    received = Date.now(),
    session = null,
    currentTask = null,
    selected = [],
    feedback = null,
    busy = false,
    polling = false,
    audio = new Audio(),
    pending = null,
    autoNext = null,
    lastStage = null,
    lastItem = null,
    lastCelebration = null;
  const store = (key, value) => {
      try {
        const serialized = JSON.stringify(value);
        if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized);
      } catch {}
    },
    read = (key) => {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    };
  const clock = (value) => {
    const n = Math.max(0, Math.ceil(value / 1000));
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  };
  const teacherViewState = { races: [], trash: [] };
  const avatars = Object.fromEntries(raceAvatarCatalog.map((a) => [a.id, a]));
  let avatarPage = null;
  const avatarsPerPage = 10;
  const { avatarArt, lanes, timingTower, drawStationResults, podium, drawWall } = createRaceViews({
    q,
    make,
    isTeacher,
    avatars,
    getData: () => data,
    appSettings,
  });
  const showtime = createRaceShowtime({
    q,
    make,
    avatarArt,
    isTeacher,
    settings: appSettings,
    effects: interactionEffects,
  });
  const statusName = {
    lobby: '参加受付中',
    countdown: 'まもなくスタート',
    running: 'レース中',
    paused: '一時停止中',
    intermission: 'コース結果発表',
    finished: 'レース終了',
  };
  const api = createRaceApi({ getSession: () => session });
  const waitingReview = !isTeacher
    ? createWaitingReview({
        q,
        make,
        getData: () => data,
        audio,
        volume: () => appSettings.values.voiceVolume / 100,
      })
    : null;
  const rewards = !isTeacher ? createRewardFeedback({ q, make, settings: appSettings }) : null;
  const exercises = !isTeacher
    ? createExerciseController({
        host: q('#race-exercise'),
        changed: (cue) => {
          syncAnswer();
          if (cue) {
            showtime.selection();
            interactionEffects.sound(cue);
          }
        },
        play: (v) =>
          playWordAudio(
            audio,
            { word: v.spoken, audio: v.audio },
            appSettings.values.voiceVolume / 100,
          ).catch(() => {
            q('#race-save-error').textContent =
              '音声を再生できません。設定で音声を確認してください。';
            q('#race-save-error').hidden = false;
          }),
        submit: () => {
          if (!q('#race-submit').disabled) q('#race-submit').click();
        },
      })
    : null;
  function syncJoinEntry() {
    const saved = raceSessionCache.find(data?.race?.id, q('#race-number').value);
    q('#join-race').disabled = busy || (!data?.race?.accepting && !saved);
    q('#join-race').textContent = saved ? 'レースに戻る' : '参加する';
    if (saved)
      q('#entry-message').textContent = 'このiPadの参加記録が残っています。続きから戻れます。';
  }
  function seconds() {
    const value =
      !isTeacher && data?.race?.rules >= 4 && data.self
        ? data.self.remaining
        : data?.race?.remaining;
    return value === undefined
      ? 360000
      : Math.max(
          0,
          value -
            (data.race.status === 'running' && data.self?.ready !== false
              ? Date.now() - received
              : 0),
        );
  }
  function logged(value) {
    if (value) teacherController?.loadRules();
    if (!value && isTeacher) location.replace('/?next=race');
    q('#race-teacher-access').hidden = value;
    q('#race-teacher-board').hidden = !value;
    q('#teacher-account-settings').hidden = !value;
    q('#teacher-logout').hidden = !value;
  }
  const drawTeacher = isTeacher
    ? createTeacherRaceView({
        q,
        make,
        getData: () => data,
        onData: (result, { silent = false } = {}) => {
          data = result;
          received = Date.now();
          showtime.update(silent ? null : result);
        },
        logged,
        isTeacher,
        statusName,
        teacherViewState,
        isBusy: () => lifecycle.busy,
        isPreparing: () => teacherController?.preparing || false,
        onRestore: (r) => teacherController.confirmLifecycle(r, true),
        onPurge: (r) => teacherController.purge(r),
        timingTower,
        drawStationResults,
        podium,
        drawTeam,
        drawWall,
      })
    : null;
  function startIn() {
    return Math.max(0, (data?.race?.startsIn || 0) - (Date.now() - received));
  }
  let momentSerial = 0;
  function moment(text, sound) {
    const serial = ++momentSerial;
    q('#race-moment').textContent = text;
    if (sound) interactionEffects.sound(sound);
    setTimeout(() => {
      if (serial === momentSerial) q('#race-moment').textContent = '';
    }, 2200);
  }
  const roulette = createItemRoulette({
    q,
    read,
    store,
    getData: () => data,
    appSettings,
    interactionEffects,
    syncAnswer,
  });
  const { itemArt, spinItem } = roulette;
  function drawTeam(team, prefix) {
    if (!team) return;
    const target = Math.max(1, team.target),
      done = team.target > 0 && team.correct >= team.target;
    setTextIfChanged(q('#' + prefix + '-team-count'), team.correct + ' / ' + team.target);
    q('#' + prefix + '-team-progress').max = target;
    q('#' + prefix + '-team-progress').value = Math.min(target, team.correct);
    setTextIfChanged(
      q('#' + prefix + '-team-caption'),
      done ? '目標達成！みんなで力を合わせたね！' : 'ひとりで正解すると、みんなの力になるよ！',
    );
    q('#' + prefix + '-team-progress')
      .closest('.team-goal')
      .classList.toggle('goal-complete', done);
    if (!isTeacher && done && lastCelebration !== data.race.id) {
      lastCelebration = data.race.id;
      moment('✨ みんなの目標、達成！', 'complete');
      interactionEffects.pulse(q('#' + prefix + '-team-progress'), 'success');
    }
  }
  function drawResult(s) {
    const panel = q('#race-personal-result');
    panel.hidden =
      data.race.rules >= 5
        ? data.race.status !== 'finished'
        : data.race.status !== 'finished' && !s.done;
    if (panel.hidden) return;
    const learning = s.learning;
    if (!learning) return;
    const signature = JSON.stringify([
      data.race.id,
      data.race.rules,
      s.score,
      s.index,
      s.answered,
      s.correct,
      s.bestStreak,
      learning.independent,
      learning.words.length,
      learning.badges,
    ]);
    if (panel.dataset.result === signature) return;
    panel.dataset.result = signature;
    const stats = q('#race-result-stats');
    stats.replaceChildren();
    for (const [label, value] of data.race.rules >= 4
      ? [
          [
            '自力正解率',
            s.index ? Math.round((s.correct / (s.answered || s.index)) * 1000) / 10 + '%' : '—',
          ],
          ['今回の得点', s.score + ' pt'],
          ['最大連続正解', (s.bestStreak || 0) + '問'],
        ]
      : [
          ['今回の得点', s.score + ' pt'],
          ['ひとりで正解', learning.independent + '問'],
          ['正解できた単語', learning.words.length + '語'],
        ]) {
      const card = make('div');
      card.append(make('strong', value), make('span', label));
      stats.append(card);
    }
    const badges = q('#race-earned-badges');
    badges.replaceChildren();
    for (const b of learning.badges) {
      const card = make('div', undefined, 'earned-badge');
      card.append(make('span', b.icon), make('strong', b.name));
      badges.append(card);
    }
    q('#race-result-words').textContent = learning.words.length
      ? 'ひとりで正解：' + learning.words.join(' · ')
      : '次のレースも、自分のペースで挑戦しよう。';
    q('#race-improvement').textContent = learning.improvement
      ? learning.improvement.delta > 0
        ? '前の完走レースより、ひとりで正解した問題が' + learning.improvement.delta + '問増えたよ！'
        : learning.improvement.delta === 0
          ? '前の完走レースと同じ正解数。続けて挑戦できたね！'
          : '前の完走レースは' +
            learning.improvement.previousCorrect +
            '問正解。復習して、また挑戦しよう。'
      : '';
    q('#race-review-words').textContent = learning.reviewWords.length
      ? '次に練習：' + learning.reviewWords.join(' · ')
      : learning.answered
        ? '復習する単語はありません。よくできました！'
        : '';
    const collection = read('aomi.race.stickers.' + s.label) || [];
    for (const b of learning.badges) if (!collection.some((x) => x.id === b.id)) collection.push(b);
    store('aomi.race.stickers.' + s.label, collection);
  }
  function nextQuestion() {
    clearTimeout(autoNext);
    autoNext = null;
    if (busy || data?.race?.status === 'paused') return;
    feedback = null;
    currentTask = null;
    drawStudent(data);
    poll();
  }
  function raceRemainingDisplay() {
    return data?.race ? seconds() : 360000;
  }
  function saveDraft() {
    if (currentTask) store('aomi.race.draft.' + currentTask.id, { selected });
  }
  function choiceValue() {
    if (currentTask?.exercise) return exercises.answer();
    return currentTask?.mode === 'spelling'
      ? formatSpellingAnswer(
          currentTask.spellingPattern || '_'.repeat(currentTask.length),
          selected.map((i) => currentTask.letters[i]).join(''),
        )
      : selected.length
        ? currentTask.options[selected[0]]?.value
        : '';
  }
  function drawAnswer() {
    const t = currentTask;
    if (!t) return;
    if (t.exercise) {
      syncAnswer();
      return;
    }
    const focusKey = document.activeElement?.dataset?.answerKey;
    const slots = q('#spelling-slots'),
      letters = q('#race-letters');
    slots.replaceChildren();
    letters.replaceChildren();
    const options = q('#race-options');
    options.replaceChildren();
    if (t.mode === 'spelling') {
      appendSpellingSlots(slots, t.spellingPattern || '_'.repeat(t.length), (i) => {
        const b = make(
          'button',
          selected[i] !== undefined ? t.letters[selected[i]] : '',
          'letter-slot',
        );
        b.type = 'button';
        b.dataset.answerKey = 'slot:' + i;
        b.setAttribute(
          'aria-label',
          selected[i] !== undefined ? '文字 ' + (i + 1) + ' を戻す' : '文字 ' + (i + 1),
        );
        b.disabled = busy || selected[i] === undefined || !!feedback;
        b.onclick = () => {
          selected.splice(i, 1);
          interactionEffects.sound('remove');
          saveDraft();
          drawAnswer();
        };
        return b;
      });
      t.letters.forEach((letter, i) => {
        const b = make('button', letter, 'letter-tile');
        b.type = 'button';
        b.dataset.answerKey = 'letter:' + i;
        b.disabled = busy || selected.includes(i) || selected.length >= t.length || !!feedback;
        b.onclick = () => {
          selected.push(i);
          saveDraft();
          drawAnswer();
          showtime.selection();
          interactionEffects.sound('letter');
        };
        letters.append(b);
      });
    } else
      t.options.forEach((option, i) => {
        if (option.removed) return;
        const b = make(
          'button',
          option.value,
          'race-choice' + (selected[0] === i ? ' chosen' : ''),
        );
        b.type = 'button';
        b.dataset.answerKey = 'choice:' + i;
        b.disabled = busy || !!feedback;
        b.setAttribute('aria-pressed', String(selected[0] === i));
        b.onclick = () => {
          selected = [i];
          saveDraft();
          drawAnswer();
          showtime.selection();
          interactionEffects.sound('select');
        };
        options.append(b);
      });
    syncAnswer();
    if (focusKey) {
      const replacement = q('[data-answer-key="' + focusKey + '"]');
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
      else if (t.mode === 'spelling')
        q('#race-letters button:not(:disabled)')?.focus({ preventScroll: true });
      else if (!q('#race-submit').disabled) q('#race-submit').focus({ preventScroll: true });
    }
  }
  function syncAnswer() {
    const t = currentTask;
    if (!t) return;
    if (t.exercise)
      exercises.render(
        t,
        busy ||
          !!feedback ||
          data?.race?.status !== 'running' ||
          data?.self?.done ||
          data?.self?.ready === false,
      );
    for (const b of q('#race-options').children)
      b.disabled =
        busy ||
        !!feedback ||
        data?.race?.status !== 'running' ||
        data?.self?.done ||
        data?.self?.ready === false;
    for (const b of q('#spelling-slots').querySelectorAll('button')) {
      const i = Number(b.dataset.position);
      b.disabled =
        busy ||
        !!feedback ||
        selected[i] === undefined ||
        data?.race?.status !== 'running' ||
        data?.self?.done ||
        data?.self?.ready === false;
    }
    for (const [i, b] of [...q('#race-letters').children].entries())
      b.disabled =
        busy ||
        !!feedback ||
        selected.includes(i) ||
        selected.length >= t.length ||
        data?.race?.status !== 'running' ||
        data?.self?.done ||
        data?.self?.ready === false;
    q('#race-submit').disabled =
      busy ||
      !!feedback ||
      data?.race?.status !== 'running' ||
      data?.self?.done ||
      data?.self?.ready === false ||
      (t.exercise
        ? !exercises.ready()
        : t.mode === 'spelling'
          ? selected.length !== t.length
          : !selected.length);
    q('#use-race-item').disabled =
      busy ||
      !!feedback ||
      !data?.self.item ||
      t.review ||
      roulette.rolling ||
      data?.race?.status !== 'running' ||
      data?.self?.done ||
      data?.self?.ready === false;
    q('#race-undo').disabled = q('#race-clear').disabled =
      busy || !!feedback || !selected.length || data?.race?.status !== 'running';
    q('#race-submit').textContent = busy ? '保存中…' : pending ? '回答を再送' : '答えを確認';
  }
  function drawTask(t) {
    showtime.question();
    if (!t) return;
    const changed = currentTask?.id !== t.id;
    if (changed) {
      audio.pause();
      currentTask = t;
      const draft = read('aomi.race.draft.' + t.id);
      if (t.exercise) exercises.set(t, draft?.exercise);
      selected =
        !t.exercise && Array.isArray(draft?.selected)
          ? draft.selected.filter(
              (i, n, a) =>
                Number.isInteger(i) &&
                i >= 0 &&
                (t.mode === 'spelling'
                  ? i < t.letters.length && a.indexOf(i) === n
                  : i < t.options.length),
            )
          : [];
      if (t.mode !== 'spelling') selected = selected.slice(0, 1);
      rewards.clear();
      q('#race-feedback').textContent = '';
      q('#race-feedback').className = '';
      q('#race-save-error').hidden = true;
    } else currentTask = t;
    if (t.options?.some((o) => o.removed) && selected.some((i) => t.options[i]?.removed))
      selected = [];
    q('#question-type').textContent = t.review
      ? '復習スター'
      : t.exercise?.name || { text: '単語', voice: 'リスニング', spelling: 'スペリング' }[t.mode];
    q('#question-count').textContent = data.race.endless
      ? '第' + (data.self.stationIndex + 1) + '問'
      : (data.race.rules >= 5
          ? Math.min(data.race.stationQuestions, data.self.stationIndex + 1)
          : Math.min(data.race.total, data.self.index + 1)) +
        ' / ' +
        (data.race.rules >= 5 ? data.race.stationQuestions : data.race.total);
    q('#race-prompt').textContent = t.prompt;
    q('#race-prompt').translate = t.exercise
      ? !['sentence', 'cloze'].includes(t.mode)
      : t.mode === 'voice';
    q('#spelling-tools').hidden = t.mode !== 'spelling';
    q('#course-progress').max = data.race.endless
      ? data.race.settings.minutes * 60000
      : data.race.stationQuestions || data.race.total;
    q('#course-progress').value = data.race.endless
      ? seconds()
      : (data.self.stationIndex ?? data.self.index);
    q('#course-progress').setAttribute(
      'aria-label',
      data.race.endless ? 'このコースの残り時間' : 'このコースの進み具合',
    );
    q('#letter-hint').textContent = t.firstLetter
      ? '最初の文字：' + t.firstLetter
      : t.mode === 'spelling'
        ? '文字を順番に選ぼう。選んだ文字を押すと戻せます。' +
          (t.spellingPattern?.includes(' ') ? ' 空白は自動で入ります。' : '')
        : '';
    q('#spelling-slots').hidden = t.mode !== 'spelling';
    q('#race-letters').hidden = t.mode !== 'spelling';
    q('#race-options').hidden = t.mode === 'spelling' || !!t.exercise;
    q('#race-exercise').hidden = !t.exercise;
    q('#race-audio').hidden = q('#race-slow').hidden =
      t.exercise?.kind === 'picture' || ['match', 'audioMatch'].includes(t.mode);
    q('#race-submit').hidden = false;
    q('#race-next').hidden = true;
    drawAnswer();
    if (changed) {
      q('#race-prompt').tabIndex = -1;
      interactionEffects.enter(q('#race-prompt'));
      interactionEffects.enter(
        q(
          t.exercise ? '#race-exercise' : t.mode === 'spelling' ? '#race-letters' : '#race-options',
        ),
      );
      q('#race-prompt').focus({ preventScroll: true });
      q(window.innerHeight >= 650 ? '#race-play' : '#race-question').scrollIntoView({
        block: 'start',
        behavior: 'auto',
      });
    }
  }
  function drawAvatars() {
    const shelf = q('#race-sticker-shelf'),
      collection = read('aomi.race.stickers.' + data?.self?.label) || [];
    shelf.hidden = !collection.length;
    shelf.replaceChildren();
    if (collection.length) {
      shelf.append(make('small', 'もらったステッカー'));
      for (const b of collection) {
        const badge = make('span', b.icon);
        badge.title = b.name;
        badge.setAttribute('aria-label', b.name);
        shelf.append(badge);
      }
    }
    const picker = q('#race-avatar-picker');
    const canChoose =
      data?.race?.status === 'lobby' ||
      (data?.self?.ready === false && data.race.status !== 'finished');
    picker.hidden = !canChoose;
    const panel = q('#race-avatar-options'),
      chosenId = data?.self.avatar || 'cat';
    if (avatarPage === null)
      avatarPage = Math.max(
        0,
        Math.floor(raceAvatarCatalog.findIndex((a) => a.id === chosenId) / avatarsPerPage),
      );
    const totalPages = Math.ceil(raceAvatarCatalog.length / avatarsPerPage);
    if (panel.dataset.page !== String(avatarPage)) {
      panel.replaceChildren();
      panel.dataset.page = String(avatarPage);
      for (const a of raceAvatarCatalog.slice(
        avatarPage * avatarsPerPage,
        (avatarPage + 1) * avatarsPerPage,
      )) {
        const b = make('button', undefined, 'race-avatar-choice');
        b.type = 'button';
        b.dataset.avatar = a.id;
        b.setAttribute('aria-label', a.name);
        b.append(avatarArt(a.id), make('small', a.name));
        b.onclick = async () => {
          if (
            busy ||
            !(
              data?.race?.status === 'lobby' ||
              (data?.self?.ready === false && data.race.status !== 'finished')
            )
          )
            return;
          busy = true;
          drawAvatars();
          q('#race-avatar-status').textContent = '保存中…';
          try {
            const result = await api('/api/race/avatar', { avatar: a.id }, true);
            drawStudent({ ...result, board: result.board || data?.board || [] });
            q('#race-avatar-status').textContent = a.name + 'を選びました';
            showtime.selection();
            interactionEffects.sound('select');
          } catch (e) {
            q('#race-avatar-status').textContent = e.message;
          } finally {
            busy = false;
            drawAvatars();
            poll();
          }
        };
        panel.append(b);
      }
    }
    for (const b of panel.children) {
      const chosen = b.dataset.avatar === chosenId;
      b.classList.toggle('selected', chosen);
      b.setAttribute('aria-pressed', String(chosen));
      b.disabled =
        busy ||
        !(
          data?.race?.status === 'lobby' ||
          (data?.self?.ready === false && data.race.status !== 'finished')
        );
    }
    const preview = q('#chosen-avatar');
    if (preview.dataset.avatar !== chosenId) {
      preview.replaceChildren(avatarArt(chosenId));
      preview.dataset.avatar = chosenId;
    }
    q('#chosen-avatar-name').textContent = (avatars[chosenId] || avatars.cat).name;
    q('#avatar-page-count').textContent = avatarPage + 1 + ' / ' + totalPages;
    q('#avatar-previous').disabled = busy || avatarPage === 0;
    q('#avatar-next').disabled = busy || avatarPage >= totalPages - 1;
  }

  function drawStudent(result) {
    if (data?.race?.id !== result.race.id || data?.race?.station !== result.race.station)
      preloader.reset();
    if (result.race.status === 'running' && result.self.ready !== false && !result.self.done)
      preloader.warm(feedback ? taskResourceHints(result.self.task) : result.self.lookahead);
    else preloader.reset();
    if (data?.race?.id === result.race.id && data.race.station !== result.race.station) {
      currentTask = null;
      feedback = null;
      selected = [];
      clearTimeout(autoNext);
      roulette.cancel();
    }
    if (data?.race?.id === result.race.id && data.race.station !== result.race.station) {
      pending = null;
      store('aomi.race.pending', null);
    }
    data = result;
    const phase = studentPhase(result, !!feedback);
    if (
      ['paused', 'finished', 'results', 'courseDone'].includes(phase) &&
      document.body.dataset.racePhase !== phase
    ) {
      audio.pause();
      window.speechSynthesis?.cancel();
      clearTimeout(autoNext);
      roulette.cancel();
    }
    document.body.dataset.racePhase = phase;
    showtime.update(result);
    const rules = result.race.settings;
    const hasItems =
      rules.items.length && (result.race.endless || rules.itemEvery < result.race.total);
    q('#race-rules-text').textContent =
      (result.race.endless
        ? '1コース' +
          rules.minutes +
          '分 × 3コース。時間いっぱい答える無限モード。各コースで上位3人を発表。'
        : result.race.rules >= 5
          ? '3コース × ' +
            result.race.stationQuestions +
            '問（全' +
            result.race.total +
            '問）・1コース' +
            rules.minutes +
            '分。各コースで上位3人を発表。'
          : '全' + result.race.total + '問・1人' + rules.minutes + '分。') +
      (result.race.rules >= 4
        ? '順位は得点、同点なら自力正解率。速さの加点なし。連続正解は2問目から＋' +
          (rules.streakStep ?? 20) +
          '点ずつ、上限＋' +
          (rules.streakCap ?? 100) +
          '点。間違い・ヒントでリセット。'
        : '') +
      '正解' +
      rules.correctPoints +
      '点。' +
      (hasItems
        ? rules.itemEvery +
          '問ごとに道具。' +
          (rules.items.includes('hint') ? 'ヒント使用時は' + rules.hintPoints + '点。' : '') +
          (rules.items.includes('boost')
            ? 'ダッシュは次の' +
              rules.boostCount +
              '問の独立正解に各' +
              rules.boostPoints +
              '点追加。'
            : '') +
          (rules.items.includes('review')
            ? '復習スターで正解すると' + rules.reviewPoints + '点。'
            : '') +
          (rules.items.includes('compass')
            ? 'ダブルヒントは選択肢を2つ減らす／最初の2文字。'
            : '') +
          (rules.items.includes('double') ? 'ダブルスターは次の独立正解の基本得点を2倍に。' : '') +
          (rules.items.includes('lucky') ? 'クローバーは次の独立正解に20〜80点追加。' : '')
        : '道具なし。') +
      (result.race.endless
        ? '各自の回答時間が終わると結果発表。先生が次のコースを開始します。教科書を見てもOK。'
        : result.race.rules >= 5
          ? '各コースは時間切れか全員の回答完了で結果発表。先生が次のコースを開始します。'
          : '時間切れか全員の回答完了で終了します。');
    q('#race-accuracy-note').hidden = result.race.rules < 4;
    q('#race-accuracy-note').textContent =
      '正解と連続正解で得点アップ。同点なら自力正解率を比較します。速さのボーナスはありません。';
    q('#race-streak').hidden =
      result.self.done || result.race.rules < 4 || !(result.self.streak > 1);
    q('#race-streak').textContent =
      '🔥 ' +
      result.self.streak +
      '問連続正解！ 次の自力正解で＋' +
      Math.min(rules.streakCap ?? 100, (result.self.streak || 0) * (rules.streakStep ?? 20)) +
      ' pt';
    received = Date.now();
    session = { ...session, raceId: result.race.id, label: result.self.label };
    store('aomi.race.session', session);
    raceSessionCache.save({ ...session, pending });
    q('#race-entry').hidden = true;
    q('#race-play').hidden = false;
    q('#change-race').hidden = false;
    const { race: r, self: s } = result;
    const players = result.board || [],
      own = players.find((p) => p.id === s.id);
    q('#self-name').textContent =
      s.alias + ' · ' + curriculumLabel(r.settings.grade, r.settings.unit);
    q('#self-score').textContent = s.score + ' pt';
    q('#self-rank').textContent = own
      ? own.rank
        ? (r.rules >= 4 && r.status !== 'finished' ? '暫定 ' : '') +
          own.rank +
          '位 / ' +
          players.length +
          '人'
        : (own.answered ?? own.index)
          ? '参考記録'
          : '参加済み'
      : '参加済み';
    q('#race-stage').textContent =
      'コース ' +
      (r.rules >= 5 ? r.station + 1 : Math.min(3, Math.floor((s.index * 3) / r.total) + 1)) +
      ' / 3';
    lanes(q('#mini-track'), players, s.id);
    q('#race-clock').textContent = clock(seconds());
    q('#race-status').textContent =
      s.done && r.status !== 'finished'
        ? r.rules >= 5
          ? 'このコースを終えました。結果発表を待とう！'
          : '回答を終えました。みんなを応援しよう！'
        : statusName[r.status];
    q('#use-race-item').textContent = s.item
      ? itemArt[s.item].icon + ' ' + s.itemName + 'を使う'
      : r.rules >= 2
        ? r.settings.items.length
          ? 'あと' + (r.settings.itemEvery - (s.index % r.settings.itemEvery)) + '問で道具！'
          : '道具なしでチャレンジ！'
        : '道具は8問・16問の後に届くよ';
    if (
      !r.endless &&
      !s.item &&
      (r.rules >= 5
        ? s.stationIndex >= r.settings.questions - r.settings.itemEvery
        : s.index >= r.total - r.settings.itemEvery)
    )
      q('#use-race-item').textContent = '最後まで走りきろう！';
    q('#boost-status').textContent = [
      s.boost
        ? '🚀 ダッシュ：あと' + s.boost + '回の自力正解に＋' + r.settings.boostPoints + ' pt'
        : '',
      s.double ? '🌟 ダブルスター：残り1回・基本得点2倍' : '',
      s.lucky ? '🍀 クローバー：残り1回・自力正解に＋' + s.lucky + ' pt' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    q('#boost-status').hidden = !(s.boost || s.double || s.lucky);
    q('#item-description').textContent = s.item ? itemArt[s.item].description : '';
    const stage = r.rules >= 5 ? r.station : Math.min(2, Math.floor((s.index * 3) / r.total)),
      scenes = [
        ['🌿', '草原コース', '聞いて、選んで、文字をつなごう'],
        ['🌊', '海辺コース', '道具を使って、もうひとがんばり'],
        ['✨', '星空コース', '文字をつないで、ゴールへ'],
      ];
    document.body.dataset.course = String(stage);
    document.body.classList.toggle('race-finished', r.status === 'finished');
    q('#course-icon').textContent = scenes[stage][0];
    q('#course-name').textContent = scenes[stage][1];
    q('#course-description').textContent = scenes[stage][2];
    if (r.rules >= 6)
      q('#course-description').textContent = [
        'ことば・ペア・文字・リスニングの4種類',
        '文づくり・穴うめ・音のペア・聞いて文づくり',
        '文づくり・穴うめ・聞いて穴うめ・聞いて書く',
      ][stage];
    if (r.status === 'running') {
      if (lastStage !== null && lastStage !== stage)
        moment('新しいコース！ ' + scenes[stage][1], 'welcome');
      const itemKey = s.item
        ? s.itemBox || s.item + ':' + Math.floor(s.index / r.settings.itemEvery)
        : null;
      if (itemKey && itemKey !== lastItem) spinItem(s, itemKey);
      lastStage = stage;
      lastItem = itemKey;
    }
    drawTeam(result.team, 'student');
    drawStationResults(q('#student-station-results'), result);
    drawResult(s);
    drawAvatars();
    q('#race-briefing').hidden = phase !== 'ready';
    q('#briefing-avatar-change').hidden = phase !== 'ready';
    if (phase === 'ready') {
      q('#race-avatar-picker').hidden = true;
      renderRaceBriefing(
        q('#race-briefing'),
        r,
        curriculumLabel(r.settings.grade, r.settings.unit),
        make,
      );
    }
    document.body.classList.toggle('race-lobby', r.status === 'lobby' || s.ready === false);
    q('#race-ready').hidden =
      !(r.status === 'lobby' || s.ready === false) || r.status === 'finished';
    q('#race-ready').disabled = busy || (r.status === 'lobby' && s.prepared);
    q('#race-ready').textContent =
      r.status === 'lobby' ? (s.prepared ? '✓ 準備完了！' : '準備完了') : '準備完了・レースに参加';
    const waiting = phase !== 'question';
    q('#race-question').hidden = waiting;
    q('#race-wait').hidden = !waiting;
    waitingReview.update();
    q('#start-countdown').hidden = r.status !== 'countdown';
    if (r.status === 'countdown')
      q('#start-countdown').textContent = Math.ceil(startIn() / 1000) || 'GO!';
    if (waiting) {
      q('#wait-title').textContent =
        s.ready === false && r.status !== 'finished'
          ? '好きなアバターで参加しよう'
          : s.done && r.status !== 'finished'
            ? !r.endless &&
              s.index >= (r.rules >= 5 ? (r.station + 1) * r.stationQuestions : r.total)
              ? r.rules >= 5
                ? 'コース ' + (r.station + 1) + ' クリア！'
                : '全問クリア！'
              : '回答時間が終わりました'
            : r.status === 'lobby'
              ? s.prepared
                ? '準備完了！先生のスタートを待とう'
                : 'アバターを選んで、準備しよう'
              : r.status === 'countdown'
                ? '準備はいい？'
                : r.status === 'intermission'
                  ? 'コース ' + (r.station + 1) + ' の結果発表！'
                  : r.status === 'paused'
                    ? 'ちょっと休憩。'
                    : r.status === 'finished'
                      ? 'レース終了！'
                      : r.total + '問クリア！';
      q('#wait-caption').textContent =
        s.ready === false && r.status !== 'finished'
          ? '途中からでも大丈夫。準備完了ボタンを押してから、' +
            rules.minutes +
            '分間チャレンジできます。'
          : s.done && r.status !== 'finished'
            ? r.rules >= 5
              ? '先生が次のコースを開始するまで、この画面で待ってね。'
              : '自分の結果を確認して、みんなのゴールを応援しよう。'
            : r.status === 'lobby'
              ? s.prepared
                ? 'スタートまでに、下の説明を読んでおこう！'
                : '好きな動物を選んだら「準備完了」を押してね。'
              : r.status === 'countdown'
                ? '合図が出たら、みんなでスタート！'
                : r.status === 'intermission'
                  ? '先生が次のコースを開始するまで待ってね。'
                  : r.status === 'paused'
                    ? '先生が再開すると、続きから走れます。'
                    : r.status === 'finished'
                      ? s.score + '点 · 独立正解 ' + s.correct + '問'
                      : 'みんなのゴールを待とう。';
      q('#race-podium').hidden = r.status !== 'finished';
      if (r.status === 'finished') podium(q('#race-podium'), players);
    }
    if (roulette.rolling) {
      q('#use-race-item').textContent = '道具を抽選中…';
      q('#item-description').textContent = '何が出るかな？';
    }
    if (
      !waiting &&
      !feedback &&
      s.task &&
      (currentTask?.id !== s.task.id || currentTask?.hintStrength !== s.task.hintStrength)
    )
      drawTask(s.task);
    else syncAnswer();
  }
  async function poll() {
    if (polling || busy || lifecycle.busy || document.hidden) return;
    polling = true;
    const epoch = lifecycle.epoch;
    try {
      if (isTeacher) {
        await teacherController.refresh(() => epoch === lifecycle.epoch);
      } else if (session?.token) {
        const result = await api('/api/race/me', undefined, true);
        if (epoch !== lifecycle.epoch) return;
        drawStudent(result);
        if (result.race.status === 'finished') {
          const latest = await api(currentRacePath);
          if (epoch !== lifecycle.epoch) return;
          const ready = latest.race?.id !== result.race.id && latest.race?.accepting;
          q('#join-next-race').textContent = ready ? 'もう一度参加する' : '次のレースを待つ';
          if (ready) q('#next-race-message').textContent = '次のレースの参加受付が始まりました！';
        }
        if (pending && result.race.status === 'running' && !feedback)
          setTimeout(() => submitPending(), 0);
      } else {
        const result = await api(currentRacePath);
        if (epoch !== lifecycle.epoch) return;
        data = result;
        received = Date.now();
        q('#race-entry-rules').textContent = result.race
          ? curriculumLabel(result.race.settings.grade, result.race.settings.unit) +
            ' · ' +
            (result.race.endless
              ? '1コース' + result.race.settings.minutes + '分 × 3コース・問題数は無制限。'
              : result.race.rules >= 5
                ? '3コース × ' +
                  result.race.stationQuestions +
                  '問（全' +
                  result.race.total +
                  '問）・1コース' +
                  result.race.settings.minutes +
                  '分。'
                : result.race.total + '問・制限時間' + result.race.settings.minutes + '分。') +
            '自分のペースで挑戦しよう。'
          : '先生のレースに参加しよう。';
        q('#entry-message').textContent = result.race?.accepting
          ? '「' +
            result.race.title +
            '」' +
            (result.race.status === 'lobby'
              ? '参加受付中'
              : '途中参加できます。自分のペースで挑戦しよう！')
          : '先生が参加受付を始めるまで、お待ちください。';
        syncJoinEntry();
      }
    } catch (e) {
      if (epoch !== lifecycle.epoch) return;
      if (isTeacher) {
        if (e.status === 401) logged(false);
        else q('#board-race-status').textContent = '接続を確認してください。記録は保持しています。';
      } else {
        if (e.status === 401 || e.status === 404) {
          clearTimeout(autoNext);
          audio.pause();
          if (session) raceSessionCache.remove(session);
          session = null;
          currentTask = null;
          pending = null;
          feedback = null;
          store('aomi.race.session', null);
          store('aomi.race.pending', null);
          q('#race-play').hidden = true;
          q('#race-entry').hidden = false;
          q('#change-race').hidden = true;
        }
        q(session ? '#race-status' : '#entry-message').textContent =
          e.message || '接続を確認してください。';
      }
      return false;
    } finally {
      polling = false;
    }
  }
  async function submitPending() {
    if (busy || !pending) return;
    busy = true;
    const epoch = lifecycle.epoch;
    const request = pending;
    drawAnswer();
    q('#race-save-error').hidden = true;
    try {
      const result = await api('/api/race/answer', request, true);
      if (epoch !== lifecycle.epoch) return;
      pending = null;
      store('aomi.race.pending', null);
      feedback = result.receipt;
      rewards.show(feedback, result.race.settings);
      showtime.receipt(feedback);
      drawStudent({ ...result, board: result.board || data?.board || [] });
      q('#race-feedback').textContent = feedback
        ? feedback.correct
          ? '正解！'
          : 'もう一度覚えよう。正解：' + feedback.expected
        : '保存しました。';
      q('#race-feedback').className = feedback?.correct ? 'correct-feedback' : 'wrong-feedback';
      q('#race-submit').hidden = true;
      q('#race-next').hidden = false;
      q('#race-next').textContent = result.self.done ? 'コースの記録を見る' : '次へ';
      interactionEffects.answer({
        correct: !!feedback?.correct,
        streak: feedback?.hinted || feedback?.review ? 0 : feedback?.streak || 0,
        key: feedback?.id,
        target: q('#race-feedback'),
        burst: false,
      });
      if (feedback?.correct) {
        interactionEffects.pulse(q('#self-score'), 'success');
        clearTimeout(autoNext);
        autoNext = setTimeout(() => {
          if (
            feedback?.id === result.receipt?.id &&
            data?.race?.status === 'running' &&
            !document.hidden
          )
            nextQuestion();
        }, 1100);
      } else if (currentTask) {
        const word = { word: currentTask.spoken, audio: currentTask.audio };
        clearTimeout(autoNext);
        autoNext = setTimeout(() => {
          if (
            epoch !== lifecycle.epoch ||
            feedback?.id !== result.receipt?.id ||
            data?.race?.status !== 'running' ||
            document.hidden ||
            q('#settings-dialog').open
          )
            return;
          playWordAudio(audio, word, appSettings.values.voiceVolume / 100).catch(() => {});
        }, 340);
      }
    } catch (e) {
      if (epoch !== lifecycle.epoch) return;
      q('#race-save-error').textContent =
        e.message + ' 回答は保存待ちです。「答えを確認」で再送できます。';
      q('#race-save-error').hidden = false;
      if ([400, 409, 423].includes(e.status)) {
        try {
          const latest = await api('/api/race/me', undefined, true);
          if (epoch !== lifecycle.epoch) return;
          if (latest.self.task?.id === request.questionId && latest.race.status === 'paused')
            pending = request;
          else {
            pending = null;
            currentTask = null;
          }
          store('aomi.race.pending', pending);
          drawStudent(latest);
        } catch {
          pending = request;
          store('aomi.race.pending', pending);
        }
      }
    } finally {
      busy = false;
      drawAnswer();
    }
  }
  if (isTeacher) {
    teacherController = createTeacherRaceController({
      q,
      api,
      getData: () => data,
      drawTeacher,
      getTrash: () => ({
        races: teacherViewState.trash || [],
        version: teacherViewState.trashVersion,
      }),
      poll,
      logged,
      lifecycle,
      settings: appSettings,
      effects: interactionEffects,
    });
  } else {
    q('#avatar-previous').onclick = () => {
      if (avatarPage > 0) {
        avatarPage--;
        drawAvatars();
        interactionEffects.sound('navigate');
      }
    };
    q('#avatar-next').onclick = () => {
      if (avatarPage < Math.ceil(raceAvatarCatalog.length / avatarsPerPage) - 1) {
        avatarPage++;
        drawAvatars();
        interactionEffects.sound('navigate');
      }
    };
    session = read('aomi.race.session');
    if (targetRace && session?.raceId !== targetRace) session = null;
    pending = session ? read('aomi.race.pending') : null;
    for (const link of document.querySelectorAll('.app-header a[href="/"]')) {
      link.href = location.pathname + location.search;
      link.setAttribute('aria-label', 'Aomiyalingo 参加画面');
    }
    raceSessionCache.save({ ...session, pending });
    q('#race-number').addEventListener('input', syncJoinEntry);
    if (targetRace) {
      q('#join-next-race').hidden = true;
      q('#next-race-message').textContent = '次のレースは先生の新しいQRを読み取ってね。';
    }
    q('#race-ready').onclick = async () => {
      if (busy) return;
      busy = true;
      q('#race-ready').disabled = true;
      try {
        const result = await api('/api/race/ready', { avatar: data.self.avatar }, true);
        currentTask = null;
        feedback = null;
        drawStudent(result);
        interactionEffects.sound('welcome');
      } catch (e) {
        q('#race-avatar-status').textContent = e.message;
      } finally {
        busy = false;
        drawStudent(data);
        poll();
      }
    };
    q('#briefing-avatar-change').onclick = async () => {
      if (busy) return;
      busy = true;
      try {
        drawStudent(await api('/api/race/avatar', { avatar: data.self.avatar }, true));
      } catch (e) {
        q('#wait-caption').textContent = e.message;
      } finally {
        busy = false;
        drawStudent(data);
      }
    };
    q('#race-join').onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      lifecycle.epoch++;
      busy = true;
      q('#join-race').disabled = true;
      try {
        const current = await api(currentRacePath);
        if (!current.race) throw Error('先生の参加受付を待ってください。');
        const joined = await raceSessionCache.join(api, current.race.id, q('#race-number').value);
        const result = joined.result;
        session = joined.session;
        feedback = null;
        currentTask = null;
        pending = joined.session.pending || null;
        store('aomi.race.pending', pending);
        drawStudent(result);
        interactionEffects.sound('welcome');
      } catch (err) {
        q('#entry-message').textContent = err.message;
      } finally {
        busy = false;
        q('#join-race').disabled = false;
        drawAnswer();
        drawAvatars();
        poll();
      }
    };
    q('#join-next-race').onclick = async () => {
      if (targetRace) {
        q('#next-race-message').textContent = '次のレースは先生の新しいQRを読み取ってね。';
        return;
      }
      if (busy) return;
      lifecycle.epoch++;
      busy = true;
      const b = q('#join-next-race');
      b.disabled = true;
      try {
        const latest = await api(currentRacePath);
        if (!latest.race || latest.race.id === data.race.id || !latest.race.accepting) {
          q('#next-race-message').textContent = '先生が次の参加受付を始めるまで待ってね。';
          return;
        }
        const joined = await raceSessionCache.join(
          api,
          latest.race.id,
          data.self.label,
          data.self.avatar,
        );
        const result = joined.result;
        clearTimeout(autoNext);
        session = joined.session;
        feedback = null;
        currentTask = null;
        pending = joined.session.pending || null;
        lastStage = null;
        lastItem = null;
        store('aomi.race.pending', pending);
        drawStudent(result);
        interactionEffects.sound('welcome');
      } catch (e) {
        q('#next-race-message').textContent = e.message;
      } finally {
        busy = false;
        b.disabled = false;
        drawAvatars();
        poll();
      }
    };
    q('#change-race').onclick = () => {
      if (busy) return;
      preloader.reset();
      roulette.cancel();
      lifecycle.epoch++;
      raceSessionCache.save({ ...session, pending });
      q('#race-number').value = data?.self?.label || '';
      clearTimeout(autoNext);
      audio.pause();
      session = null;
      currentTask = null;
      feedback = null;
      pending = null;
      store('aomi.race.session', null);
      store('aomi.race.pending', null);
      q('#race-play').hidden = true;
      q('#race-entry').hidden = false;
      q('#change-race').hidden = true;
      poll();
    };
    q('#race-audio').onclick = () => {
      if (!currentTask) return;
      playWordAudio(
        audio,
        { word: currentTask.spoken, audio: currentTask.audio },
        appSettings.values.voiceVolume / 100,
        1,
      ).catch(() => {
        q('#race-save-error').textContent = '音声を再生できませんでした。もう一度押してください。';
        q('#race-save-error').hidden = false;
      });
    };
    q('#race-slow').onclick = () => {
      if (!currentTask) return;
      playWordAudio(
        audio,
        { word: currentTask.spoken, audio: currentTask.audio },
        appSettings.values.voiceVolume / 100,
        0.75,
      ).catch(() => {
        q('#race-save-error').textContent = '音声を再生できませんでした。もう一度押してください。';
        q('#race-save-error').hidden = false;
      });
    };
    q('#race-undo').onclick = () => {
      if (q('#race-undo').disabled) return;
      interactionEffects.sound('remove');
      selected.pop();
      saveDraft();
      drawAnswer();
    };
    q('#race-clear').onclick = () => {
      if (q('#race-clear').disabled) return;
      interactionEffects.sound('remove');
      selected = [];
      saveDraft();
      drawAnswer();
    };
    q('#race-submit').onclick = () => {
      if (!currentTask || busy || q('#race-submit').disabled) return;
      if (!pending) {
        pending = { questionId: currentTask.id, answer: choiceValue() };
        store('aomi.race.pending', pending);
        raceSessionCache.save({ ...session, pending });
      }
      submitPending();
    };
    q('#race-next').onclick = () => {
      nextQuestion();
      interactionEffects.sound('navigate');
    };
    q('#use-race-item').onclick = async () => {
      if (busy || roulette.rolling || !currentTask || q('#use-race-item').disabled) return;
      busy = true;
      drawAnswer();
      try {
        const usedItem = data.self.item;
        const result = await api('/api/race/item', { questionId: currentTask.id }, true);
        drawStudent({ ...result, board: result.board || data?.board || [] });
        interactionEffects.pulse(q('#boost-status'), 'success');
        showtime.item(usedItem);
      } catch (e) {
        q('#race-save-error').textContent = e.message;
        q('#race-save-error').hidden = false;
      } finally {
        busy = false;
        drawAnswer();
      }
    };
  }
  if (isTeacher) {
    const track = q('#teacher-race-lanes');
    track.setAttribute('aria-label', '得点順のライブ順位。順位が変わると行が入れ替わります。');
  } else {
    const track = q('#mini-track');
    track.tabIndex = 0;
    track.setAttribute('aria-label', '全員の順位。スワイプでスクロールできます。');
  }
  const pollScheduler = createPollScheduler({ run: poll, state: () => data?.race });
  window.addEventListener('pagehide', () => audio.pause());
  setInterval(() => {
    if (document.hidden) return;
    if (!isTeacher) showtime.clock?.(seconds());
    if (data?.race?.status === 'countdown') {
      showtime.countdown(Math.ceil(startIn() / 1000));
      if (!isTeacher) q('#start-countdown').textContent = Math.ceil(startIn() / 1000) || 'GO!';
      if (startIn() === 0) poll();
    }
    if (isTeacher && data?.players) {
      const timers = new Map(
        [...q('#teacher-race-lanes').querySelectorAll('.timing-row')].map((row) => [
          row.dataset.id,
          row.querySelector('.timing-time'),
        ]),
      );
      for (const player of data.players) {
        const timer = timers.get(player.id);
        if (!timer) continue;
        const remaining = Math.max(
          0,
          player.remaining -
            (data.race.status === 'running' && player.ready !== false && !player.done
              ? Date.now() - received
              : 0),
        );
        setTextIfChanged(
          timer,
          data.race.status === 'finished' || player.done ? '0:00' : clock(remaining),
        );
        timer.classList.toggle(
          'time-low',
          remaining <= 60000 && data.race.status === 'running' && player.ready !== false,
        );
        setAttributeIfChanged(timer, 'aria-label', '残り ' + clock(remaining));
      }
    }
    if (!isTeacher && data?.race?.endless && q('#course-progress'))
      q('#course-progress').value = seconds();
    const target = isTeacher ? null : q('#race-clock');
    if (target)
      setTextIfChanged(
        target,
        isTeacher && data?.race?.status === 'intermission'
          ? '結果発表'
          : data?.race?.status === 'finished' || (!isTeacher && data?.self?.done)
            ? 'FINISH'
            : data?.race?.status === 'countdown'
              ? Math.ceil(startIn() / 1000) || 'GO!'
              : clock(raceRemainingDisplay()),
      );
  }, 250);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.pause();
      window.speechSynthesis?.cancel();
    }
  });
  window.addEventListener('aomi-reconnect', () => poll());
  if (!isTeacher)
    document.addEventListener('keydown', (event) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        q('#settings-dialog').open ||
        q('#race-question').hidden ||
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
      )
        return;
      const t = currentTask;
      if (!t || busy || data?.race?.status !== 'running') return;
      if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        if (feedback) q('#race-next').click();
        else if (!q('#race-submit').disabled) q('#race-submit').click();
      } else if (!feedback && t.mode === 'spelling' && event.key === 'Backspace') {
        event.preventDefault();
        q('#race-undo').click();
      } else if (!feedback && t.mode === 'spelling' && /^[a-z]$/i.test(event.key)) {
        const i = t.letters.findIndex(
          (letter, index) =>
            letter.toLowerCase() === event.key.toLowerCase() && !selected.includes(index),
        );
        if (i >= 0) q('[data-answer-key="letter:' + i + '"]').click();
      } else if (!feedback && t.mode !== 'spelling' && /^[1-4]$/.test(event.key)) {
        q('[data-answer-key="choice:' + (Number(event.key) - 1) + '"]')?.click();
      }
    });
  pollScheduler.refresh();
})();
