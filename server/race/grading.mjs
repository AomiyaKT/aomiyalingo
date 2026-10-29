import { gradeExercise } from './exercises.mjs';
import { answerItemEffects, magnetPoints } from './item-effects.mjs';
import { spellingCharacters, formatSpellingAnswer } from '../../public/shared/curriculum.js';

export function createRaceGradingHandler({
  raceTaskList,
  now,
  json,
  body,
  raceTask,
  raceDrawItem,
  raceSettings,
  raceWord,
  raceMainTask,
  raceCurrentTask,
  racePool,
  stationEnd,
  raceAccuracy,
  racePlayerDone,
  raceRanking,
  raceRoom,
  raceRacers,
  raceSave,
  raceSession,
}) {
  return async function (req, env, url, p, r) {
    const path = url.pathname;
    if (path.endsWith('/answer') && req.method === 'POST') {
      const data = await body(req),
        state = JSON.parse(p.state),
        previous = state.history.find((h) => h.id === data.questionId);
      if (previous) return json(await raceSession(env, p, r, previous));
      if (r.status !== 'running' || r.started_at > now())
        return json(
          {
            error:
              r.started_at > now()
                ? 'スタートの合図を待ってください。'
                : r.status === 'paused'
                  ? '先生がレースを一時停止しました。'
                  : 'レースは開始前か、終了しています。',
          },
          423,
        );
      if (state.ready === false || racePlayerDone(r, state))
        return json(
          {
            error:
              state.ready === false
                ? 'アバターを選んで参加してください。'
                : 'あなたの回答時間は終了しました。',
          },
          423,
        );
      const task = raceCurrentTask(r, state);
      if (!task || data.questionId !== task.id)
        return json({ error: '問題が更新されました。もう一度確認してください。' }, 409);
      const w = raceWord(task),
        expected = task.exercise ? task.expected : task.mode === 'text' ? w.meaning : w.word,
        answer = typeof data.answer === 'string' ? data.answer : '',
        graded = task.exercise ? gradeExercise(task, answer) : null;
      if (
        graded
          ? !graded.valid
          : task.mode === 'spelling'
            ? answer.length !== w.word.length ||
              !(
                /^[a-z]+(?:['’][a-z]*)?(?:[ -][a-z]+(?:['’][a-z]*)?)*$/i.test(answer) ||
                (/^[a-z]+$/i.test(spellingCharacters(answer)) &&
                  formatSpellingAnswer(w.word, spellingCharacters(answer)) === answer)
              )
            : !task.options.includes(answer)
      )
        return json({ error: '答えを選んでください。' }, 400);
      const correct = graded ? graded.correct : answer.toLowerCase() === expected.toLowerCase(),
        hinted = state.hintFor === task.id,
        isReview = !!state.reviewTask;
      const cfg = raceSettings(r);
      let points = correct
        ? isReview
          ? cfg.reviewPoints
          : hinted
            ? cfg.hintPoints
            : cfg.correctPoints
        : 0;
      const itemEffect = answerItemEffects(state, {
        correct,
        hinted,
        review: isReview,
        config: cfg,
      });
      points += itemEffect.bonus;
      if (
        state.boost > 0 &&
        !isReview &&
        (!correct || hinted) &&
        (raceTaskList(r)[0]?.rules || 1) < 2
      )
        state.boost--;
      let streakBonus = 0;
      if (raceAccuracy(r)) {
        if (!correct || hinted) {
          if (!itemEffect.shielded) state.streak = 0;
        } else if (!isReview) {
          state.streak = (state.streak || 0) + 1;
          state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
          streakBonus = Math.min(
            cfg.streakCap ?? 100,
            Math.max(0, state.streak - 1) * (cfg.streakStep ?? 20),
          );
          points += streakBonus;
        }
      }
      state.score += points;
      if (correct && !hinted && !isReview) state.correct++;
      const receipt = {
        id: task.id,
        word: w.word,
        mode: task.mode,
        answer: graded?.answer ?? answer,
        expected,
        correct,
        hinted,
        review: isReview,
        station: r.station || 0,
        points,
        streak: state.streak || 0,
        streakBonus,
        ...(itemEffect.shielded ? { shielded: true } : {}),
        ...(itemEffect.treasureBonus ? { treasureBonus: itemEffect.treasureBonus } : {}),
        ...(task.rules === 6
          ? {
              level: task.level,
              support: task.exercise?.choices
                ? 'choices'
                : task.exercise?.kind === 'order'
                  ? 'tiles'
                  : 'standard',
            }
          : {}),
      };
      state.history.push(receipt);
      state.hintFor = null;
      state.hintStrength = 0;
      if (isReview) {
        state.reviewTask = null;
        if (correct)
          state.wrong = state.wrong.filter(
            (q) => q.word !== w.word || q.mode !== (task.reviewMode || task.mode),
          );
      } else {
        state.swapTask = null;
        state.index++;
        if (!correct && !state.wrong.some((q) => q.word === w.word && q.mode === task.mode))
          state.wrong.push({ word: w.word, mode: task.mode });
        if (
          (raceTaskList(r)[0]?.rules >= 2
            ? state.index % cfg.itemEvery === 0 && state.index < stationEnd(r)
            : [8, 16].includes(state.index)) &&
          cfg.items.length &&
          (raceTaskList(r)[0]?.rules >= 2 || !state.item)
        ) {
          const peers = raceRanking(await raceRacers(env, r.id), r),
            behind = raceAccuracy(r)
              ? peers.filter((q) =>
                  cfg.endless
                    ? q.answered &&
                      q.correct * state.history.filter((h) => !h.review).length >
                        state.correct * q.answered
                    : q.index && q.correct * state.index > state.correct * q.index,
                ).length >= Math.ceil(peers.length / 2)
              : peers.filter((q) => q.score > state.score).length >= Math.ceil(peers.length / 2);
          const preferred = behind
            ? state.wrong.length
              ? 'review'
              : 'boost'
            : state.wrong.length
              ? 'boost'
              : 'hint';
          const available = cfg.items.filter(
            (x) =>
              (x !== 'review' || state.wrong.length) &&
              (x !== 'shield' || !state.shield) &&
              (x !== 'treasure' || !state.treasure) &&
              (x !== 'magnet' || peers.some((p) => p.score > state.score)),
          );
          state.item =
            raceTaskList(r)[0]?.rules >= 3
              ? raceDrawItem(available, behind)
              : available.includes(preferred)
                ? preferred
                : available[0] || null;
          if (state.item) state.itemBox = crypto.randomUUID();
        }
      }
      const saved = await raceSave(env, p, state, r);
      if (!saved)
        return json({ error: '保存状態が変わりました。同じ回答でもう一度お試しください。' }, 409);
      return json(await raceSession(env, saved, await raceRoom(env, r.id), receipt));
    }
    if (path.endsWith('/item') && req.method === 'POST') {
      const data = await body(req),
        s = JSON.parse(p.state),
        task = raceMainTask(r, s),
        cfg = raceSettings(r),
        segment = Math.floor(s.index / cfg.itemEvery);
      if (r.status !== 'running' || r.started_at > now())
        return json({ error: 'レースの再開を待ってください。' }, 423);
      if (s.ready === false || racePlayerDone(r, s))
        return json({ error: '今は道具を使えません。' }, 423);
      if (
        !task ||
        data.questionId !== task.id ||
        !s.item ||
        s.usedSegment === segment ||
        s.reviewTask
      )
        return json({ error: '今は道具を使えません。' }, 409);
      const effect = { kind: s.item };
      if (s.item === 'hint' || s.item === 'compass') {
        s.hintFor = task.id;
        s.hintStrength = s.item === 'compass' ? 2 : 1;
      } else if (s.item === 'boost') s.boost = cfg.boostCount;
      else if (s.item === 'double') s.double = true;
      else if (s.item === 'lucky') s.lucky = 20 + 20 * Math.floor(Math.random() * 4);
      else if (s.item === 'shield') s.shield = true;
      else if (s.item === 'treasure') s.treasure = { progress: 0 };
      else if (s.item === 'magnet') {
        effect.points = magnetPoints(s.score, raceRanking(await raceRacers(env, r.id), r));
        s.score += effect.points;
        // A zero-answer bonus belongs to the course score, never to learning accuracy/history.
        s.itemScores ??= {};
        s.itemScores[r.station || 0] = (s.itemScores[r.station || 0] || 0) + effect.points;
      } else if (s.item === 'swap') {
        const pool = racePool(r);
        const candidates = pool.filter((w) => w.word !== task.word);
        if (!candidates.length) return json({ error: '交換できる問題がありません。' }, 409);
        s.swapTask = {
          ...raceTask(candidates[Math.floor(Math.random() * candidates.length)], task.mode, pool),
          rules: task.rules,
          station: r.station || 0,
        };
        s.hintFor = null;
        s.hintStrength = 0;
      } else {
        const old = s.wrong[0];
        if (!old) return json({ error: '復習する問題がありません。' }, 409);
        s.reviewTask = raceTask(
          racePool(r).find((w) => w.word === old.word),
          ['text', 'voice', 'spelling'].includes(old.mode) ? old.mode : 'text',
          racePool(r),
        );
        s.reviewTask.reviewMode = old.mode;
      }
      s.item = null;
      s.usedSegment = segment;
      const saved = await raceSave(env, p, s, r);
      return saved
        ? json({ ...(await raceSession(env, saved, r)), itemEffect: effect })
        : json({ error: '保存状態が変わりました。表示を更新してください。' }, 409);
    }
    return json({ error: '見つかりません。' }, 404);
  };
}
