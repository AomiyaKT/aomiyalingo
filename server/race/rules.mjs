import { stationModes, materializeExercise } from './exercises.mjs';
import { endlessTask, endlessMode } from './endless.mjs';
import { createRaceHistoryReader } from './history.mjs';
import { raceItemNames as raceItems } from '../../public/shared/race-items.js';
import { createRaceTaskReader } from './task-reader.mjs';

export function createRaceRules({ words, raceAvatarCatalog, shuffle, spellingCharacters, now }) {
  const raceTaskList = createRaceTaskReader();
  // Mutable learner data is intentionally isolated to the request-local row.
  const states = new WeakMap();
  const raceHistory = createRaceHistoryReader();
  function racePlayerState(player) {
    const cached = states.get(player);
    if (cached?.raw === player.state) return cached.state;
    const state = JSON.parse(player.state);
    states.set(player, { raw: player.state, state });
    return state;
  }

  const raceAvatars = raceAvatarCatalog.map((a) => a.id);
  function raceTask(w, mode, pool = words, order = shuffle, id = crypto.randomUUID()) {
    return {
      content: w,
      id,
      word: w.word,
      mode,
      options:
        mode === 'spelling'
          ? null
          : mode === 'text'
            ? order([
                w.meaning,
                ...[
                  ...new Set([
                    ...(w.distractors || []),
                    ...order(pool.filter((v) => v.word !== w.word)).map((v) => v.meaning),
                  ]),
                ]
                  .filter((x) => x !== w.meaning)
                  .slice(0, 3),
              ])
            : order([w, ...order(pool.filter((v) => v.word !== w.word)).slice(0, 3)]).map(
                (v) => v.word,
              ),
      letters:
        mode === 'spelling'
          ? order([
              ...spellingCharacters(w.word.toLowerCase()),
              ...order('abcdefghijklmnopqrstuvwxyz'.split('')).slice(0, 2),
            ])
          : null,
    };
  }
  function raceTasks(config) {
    const pool = config.words.filter((w) => w.enabled && config.race.wordIds.includes(w.word)),
      c = { ...config.race, stations: 3, questionsPerStation: config.race.questions };
    const courses = Array.from({ length: 3 }, (_, station) => {
      const available = c.format === 'adaptive-four' ? stationModes[station] : c.modes;
      const modes = Array.from({ length: c.questions }, (_, i) => available[i % available.length]),
        order =
          c.order === 'grouped'
            ? modes.sort((a, b) => c.modes.indexOf(a) - c.modes.indexOf(b))
            : shuffle(modes);
      let deck = [];
      return order.map((mode, i) => {
        if (!deck.length) deck = shuffle(pool);
        return {
          ...raceTask(deck.pop(), mode, pool),
          rules: c.format === 'adaptive-four' ? 6 : 5,
          station,
          ...(station === 0 && i === 0 ? { settings: c, pool } : {}),
        };
      });
    });
    return courses.flat();
  }
  function raceDrawItem(available, behind) {
    const weights = behind
      ? {
          hint: 1,
          boost: 3,
          review: 4,
          compass: 3,
          double: 4,
          lucky: 2,
          shield: 2,
          swap: 3,
          treasure: 2,
          magnet: 4,
        }
      : {
          hint: 3,
          boost: 2,
          review: 2,
          compass: 2,
          double: 1,
          lucky: 2,
          shield: 3,
          swap: 2,
          treasure: 3,
          magnet: 1,
        };
    const bag = available.flatMap((i) => Array(weights[i] || 1).fill(i));
    return bag.length ? bag[Math.floor(Math.random() * bag.length)] : null;
  }
  const raceSettings = (r) =>
    raceTaskList(r)[0]?.settings || {
      questions: 24,
      minutes: 6,
      countdown: 3,
      itemEvery: raceTaskList(r)[0]?.rules === 2 ? 6 : 8,
      items: ['hint', 'boost', 'review'],
      correctPoints: 100,
      hintPoints: 70,
      reviewPoints: 60,
      boostPoints: 40,
      boostCount: 2,
      goalPercent: 50,
      modes: ['text', 'voice', 'spelling'],
    };
  const raceWord = (t) => t.content || words.find((w) => w.word === t.word);
  const racePlayerTasks = (r, state) => {
    const tasks = raceTaskList(r);
    return Array.isArray(state.taskOrder) ? state.taskOrder.map((i) => tasks[i]) : tasks;
  };
  const racePool = (r) => raceTaskList(r)[0]?.pool || words;
  const raceEndless = (r) => raceSettings(r).endless === true;
  const currentModes = (r) =>
    raceSettings(r).format === 'adaptive-four'
      ? stationModes[r.station || 0]
      : raceSettings(r).modes;
  const finiteTask = (r, state) => raceTaskList(r)[state.taskOrder?.[state.index] ?? state.index];
  const raceMainTask = (r, state) =>
    state.swapTask ||
    (raceEndless(r)
      ? endlessTask({
          state,
          station: r.station || 0,
          pool: racePool(r),
          modes: currentModes(r),
          taskFactory: raceTask,
          rules: raceTaskList(r)[0].rules,
        })
      : finiteTask(r, state));
  const raceCurrentTask = (r, state) => {
    const task = state.reviewTask || raceMainTask(r, state);
    return task ? materializeExercise(task, state, racePool(r)) : null;
  };
  const raceStations = (r) => (raceTaskList(r)[0]?.rules || 1) >= 5;
  const stationSize = (r) => raceSettings(r).questionsPerStation || raceSettings(r).questions;
  const stationEnd = (r) =>
    raceEndless(r)
      ? Infinity
      : raceStations(r)
        ? ((r.station || 0) + 1) * stationSize(r)
        : raceTaskList(r).length;
  const stationIndex = (r, s) =>
    raceEndless(r)
      ? s.index
      : raceStations(r)
        ? Math.max(0, s.index - (r.station || 0) * stationSize(r))
        : s.index;
  const raceAccuracy = (r) => (raceTaskList(r)[0]?.rules || 1) >= 4;
  const raceElapsed = (r) =>
    (r.elapsed_ms || 0) + (r.status === 'running' ? Math.max(0, now() - r.started_at) : 0);
  const raceAccepting = (r) =>
    r.status !== 'finished' &&
    !r.join_closed &&
    (r.status === 'lobby' || (raceAccuracy(r) && ['running', 'paused'].includes(r.status)));
  const racePersonalRemaining = (r, s) =>
    !raceAccuracy(r)
      ? raceRemaining(r)
      : s.ready === false
        ? raceSettings(r).minutes * 60000
        : Math.max(
            0,
            raceSettings(r).minutes * 60000 - Math.max(0, raceElapsed(r) - (s.joinedElapsed || 0)),
          );
  const racePlayerDone = (r, s) =>
    s.index >= stationEnd(r) || (s.ready !== false && racePersonalRemaining(r, s) <= 0);
  const raceRemaining = (r) =>
    r.status === 'running'
      ? Math.min(r.remaining_ms, Math.max(0, r.remaining_ms - (now() - r.started_at)))
      : r.remaining_ms;
  const racePublic = (r) => ({
    id: r.id,
    title: r.title,
    status: r.status === 'running' && r.started_at > now() ? 'countdown' : r.status,
    remaining: raceRemaining(r),
    startsIn: r.status === 'running' ? Math.max(0, r.started_at - now()) : 0,
    total: raceEndless(r) ? null : raceTaskList(r).length,
    station: r.station || 0,
    stations: raceStations(r) ? 3 : 1,
    stationQuestions: raceEndless(r) ? null : stationSize(r),
    settings: raceSettings(r),
    endless: raceEndless(r),
    rules: raceTaskList(r)[0]?.rules || 1,
    accepting: raceAccepting(r),
  });
  function raceLearning(s, total = 24) {
    const summary = raceHistory(s).all;
    return {
      answered: summary.answered,
      independent: s.correct,
      hinted: summary.hintedCorrect,
      words: [...raceHistory(s).words().independent],
      reviewWords: [...new Set(s.wrong.map((h) => h.word))],
      badges: [
        ...(summary.voice >= 6 ? [{ id: 'listening', name: 'リスニング名人', icon: '🎧' }] : []),
        ...(summary.spelling >= 6 ? [{ id: 'spelling', name: 'スペリング名人', icon: '✏️' }] : []),
        ...(summary.recovered ? [{ id: 'recovery', name: 'ナイスリカバリー', icon: '⭐' }] : []),
        ...(s.index >= total ? [{ id: 'finish', name: '最後までチャレンジ', icon: '🏁' }] : []),
      ],
    };
  }
  const raceAlias = (p) => '出席番号 ' + p.label;
  function raceRanking(players, r) {
    const accuracy = r && raceAccuracy(r),
      total = r ? raceTaskList(r).length : 24;
    const list = players.map((p) => {
      const play = racePlayerState(p);
      return {
        ...p,
        play,
        answered: raceStations(r) ? raceHistory(play).all.answered : play.index,
      };
    });
    const eligible = (p) => (accuracy ? p.answered > 0 : true);
    // Points determine position, accuracy breaks point ties. Speed and arrival order never decide rank.
    const compare = (a, b) =>
      accuracy
        ? Number(eligible(b)) - Number(eligible(a)) ||
          (eligible(a) && eligible(b)
            ? b.play.score - a.play.score ||
              b.play.correct * a.answered - a.play.correct * b.answered
            : 0)
        : b.play.score - a.play.score;
    list.sort((a, b) => compare(a, b) || a.number - b.number);
    let rank = 0;
    return list.map((p, index) => {
      if (index === 0 || compare(list[index - 1], p) !== 0) rank = index + 1;
      return {
        id: p.id,
        alias: raceAlias(p),
        score: p.play.score,
        index: p.play.index,
        answered: p.answered,
        stationIndex: r ? stationIndex(r, p.play) : p.play.index,
        stationScore:
          r && raceStations(r)
            ? (raceHistory(p.play).stations.get(r.station || 0)?.score || 0) +
              (p.play.itemScores?.[r.station || 0] || 0)
            : p.play.score,
        correct: p.play.correct,
        accuracy: p.answered ? Math.round((p.play.correct / p.answered) * 1000) / 10 : null,
        rank: eligible(p) ? rank : null,
        done: r ? racePlayerDone(r, p.play) : false,
        completed: !raceEndless(r) && p.play.index >= total,
        remaining: racePersonalRemaining(r, p.play),
        mode:
          !racePlayerDone(r, p.play) && p.play.ready !== false
            ? p.play.reviewTask?.mode ||
              (raceEndless(r)
                ? endlessMode(p.play, r.station || 0, currentModes(r))
                : finiteTask(r, p.play)?.mode) ||
              null
            : null,
        reviewing: !!p.play.reviewTask,
        prepared: p.play.prepared ?? p.play.ready !== false,
        ready: p.play.ready !== false,
        number: p.number,
        avatar: p.play.avatar || 'cat',
      };
    });
  }
  function stationResults(players, r) {
    if (!raceStations(r)) return [];
    return Array.from({ length: 3 }, (_, station) => {
      const closed =
        station < (r.station || 0) ||
        (station === (r.station || 0) && ['intermission', 'finished'].includes(r.status));
      const entries = players
        .map((p) => {
          const state = racePlayerState(p),
            summary = raceHistory(state).stations.get(station),
            answered = summary?.answered || 0,
            correct = summary?.independent || 0;
          return {
            id: p.id,
            alias: raceAlias(p),
            avatar: state.avatar || 'cat',
            score: (summary?.score || 0) + (state.itemScores?.[station] || 0),
            answered,
            correct,
            accuracy: answered ? Math.round((correct / answered) * 1000) / 10 : null,
          };
        })
        .filter((p) => p.answered);
      const cmp = (a, b) => b.score - a.score || b.correct * a.answered - a.correct * b.answered;
      entries.sort(cmp);
      let rank = 0;
      return {
        station,
        closed,
        players: entries.map((p, index) => {
          if (index === 0 || cmp(entries[index - 1], p) !== 0) rank = index + 1;
          return { ...p, rank };
        }),
      };
    });
  }
  function raceVisibleTask(task, state, number = 1) {
    if (!task) return null;
    if (task.exercise)
      return {
        id: task.id,
        mode: task.mode,
        prompt:
          task.exercise.kind === 'picture'
            ? '絵に合う英語はどれ？'
            : task.mode === 'sentence' || task.mode === 'cloze'
              ? task.content.meaning
              : task.mode === 'match'
                ? '英語と日本語をつなごう'
                : '音声を聞いて答えよう',
        ...task.exerciseAudio,
        exercise: task.exercise,
        level: task.level,
        hinted: state.hintFor === task.id,
        review: !!state.reviewTask,
      };
    const w = raceWord(task),
      hinted = state.hintFor === task.id;
    const help = hinted ? state.hintStrength || 1 : 0,
      removed =
        hinted && task.mode !== 'spelling'
          ? task.options
              .map((v, i) => (v !== (task.mode === 'text' ? w.meaning : w.word) ? i : -1))
              .filter((i) => i >= 0)
              .slice(0, help)
          : [];
    return {
      id: task.id,
      level: task.level,
      mode: task.mode,
      prompt:
        task.mode === 'text' ? w.word : task.mode === 'spelling' ? w.meaning : '音声を聞いて選ぼう',
      audio: w.audio === null ? null : w.audio || '/assets/words/' + w.word + '.wav',
      spoken: w.word,
      options: task.options
        ? task.options
            .map((v, i) => ({ value: v, removed: removed.includes(i) }))
            .map((_, i, a) => a[(i + number) % a.length])
        : null,
      letters: task.letters ? task.letters.map((_, i, a) => a[(i + number) % a.length]) : null,
      length: task.mode === 'spelling' ? spellingCharacters(w.word).length : null,
      spellingPattern: task.mode === 'spelling' ? w.word.replace(/[a-z]/gi, '_') : null,
      firstLetter:
        hinted && task.mode === 'spelling'
          ? w.word.slice(0, Math.min(help, Math.max(1, w.word.length - 1)))
          : null,
      hintStrength: help,
      hinted,
      review: !!state.reviewTask,
    };
  }

  return {
    raceTaskList,
    racePlayerState,
    raceHistory,
    raceAvatars,
    raceItems,
    raceTask,
    raceTasks,
    raceDrawItem,
    raceSettings,
    raceWord,
    racePlayerTasks,
    racePool,
    raceCurrentTask,
    raceMainTask,
    raceEndless,
    raceStations,
    stationSize,
    stationEnd,
    stationIndex,
    raceAccuracy,
    raceElapsed,
    raceAccepting,
    racePersonalRemaining,
    racePlayerDone,
    raceRemaining,
    racePublic,
    raceLearning,
    raceAlias,
    raceRanking,
    stationResults,
    raceVisibleTask,
  };
}
