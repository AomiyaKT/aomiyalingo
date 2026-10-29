export function createRaceService({
  racePlayerState,
  raceHistory,
  raceTaskList,
  words,
  stmt,
  raceItems,
  raceSettings,
  raceCurrentTask,
  raceEndless,
  racePool,
  raceStations,
  stationSize,
  stationIndex,
  raceElapsed,
  racePersonalRemaining,
  racePlayerDone,
  raceRemaining,
  racePublic,
  raceLearning,
  raceAlias,
  raceRanking,
  stationResults,
  raceVisibleTask,
  raceRoom,
  raceRacers,
}) {
  async function raceSnapshot(env, r, privateView = false) {
    const players = await raceRacers(env, r.id);
    const byId = privateView ? new Map(players.map((p) => [p.id, p])) : null;
    let ranked = raceRanking(players, r);
    if (r.status === 'running' && players.length && ranked.every((p) => p.done)) {
      await stmt(
        env,
        "UPDATE races SET status=?,remaining_ms=?,elapsed_ms=?,started_at=NULL,revision=revision+1 WHERE id=? AND deleted_at=0 AND status='running' AND revision=?",
        courseEndStatus(r.station || 0, raceStations(r) ? 3 : 1),
        raceRemaining(r),
        raceElapsed(r),
        r.id,
        r.revision,
      ).run();
      r = await raceRoom(env, r.id);
      ranked = raceRanking(players, r);
    }
    return {
      room: r,
      board: {
        race: racePublic(r),
        stationResults: stationResults(players, r),
        team: {
          correct: raceStations(r)
            ? players.reduce(
                (n, p) =>
                  n +
                  (raceHistory(racePlayerState(p)).stations.get(r.station || 0)?.independent || 0),
                0,
              )
            : ranked.reduce((n, p) => n + p.correct, 0),
          target:
            players.length *
            Math.ceil(
              ((raceStations(r) ? stationSize(r) : raceTaskList(r).length) *
                raceSettings(r).goalPercent) /
                100,
            ),
          finished: ranked.filter((p) => p.done).length,
          participants: players.length,
        },
        players: ranked.map((p) => ({
          ...p,
          ...(privateView
            ? {
                label: byId.get(p.id).label,
                history: racePlayerState(byId.get(p.id)).history,
                recordRevision: byId.get(p.id).revision,
              }
            : {}),
        })),
      },
    };
  }
  async function raceBoard(env, r, privateView = false) {
    return (await raceSnapshot(env, r, privateView)).board;
  }
  async function raceSession(env, p, r, receipt = null, known = null) {
    const snapshot = await raceSnapshot(env, r);
    r = snapshot.room;
    const state = racePlayerState(p),
      total = raceTaskList(r).length,
      board = snapshot.board,
      done = board.race.status === 'finished' || racePlayerDone(r, state),
      syncKey = [r.id, p.id, p.revision || 0, r.station || 0, board.race.status, done ? 1 : 0].join(
        ':',
      ),
      unchanged = known === syncKey,
      learning = unchanged ? null : raceLearning(state, raceEndless(r) ? Infinity : total);
    if (!unchanged && !raceEndless(r) && state.index >= total && board.race.status === 'finished') {
      const prior = (
        await stmt(
          env,
          "SELECT racers.state,races.tasks FROM racers JOIN races ON races.id=racers.race_id WHERE racers.label=? AND races.deleted_at=0 AND races.status='finished' AND races.created<? ORDER BY races.created DESC LIMIT 10",
          p.label,
          r.created,
        ).all()
      ).results
        .filter((v) => {
          const old = JSON.parse(v.tasks),
            current = raceSettings(r),
            prior = old[0]?.settings;
          return (
            (prior?.grade || 6) === (current.grade || 6) &&
            (prior?.unit || (prior?.grade === 5 ? '5' : '4-5')) ===
              (current.unit || (current.grade === 5 ? '5' : '4-5')) &&
            old.length === total &&
            (prior?.format || 'classic') === (current.format || 'classic') &&
            JSON.stringify(prior?.modes || ['text', 'voice', 'spelling']) ===
              JSON.stringify(current.modes) &&
            JSON.stringify((old[0]?.pool || words).map((w) => w.word).sort()) ===
              JSON.stringify(
                racePool(r)
                  .map((w) => w.word)
                  .sort(),
              )
          );
        })
        .map((v) => JSON.parse(v.state))
        .find((v) => v.index >= total);
      if (prior) {
        learning.improvement = {
          previousCorrect: prior.correct,
          delta: state.correct - prior.correct,
        };
        if (state.correct > prior.correct)
          learning.badges.push({ id: 'improved', name: '前よりできた！', icon: '🌱' });
      }
    }
    return {
      race: board.race,
      stationResults: board.stationResults,
      board: board.players,
      team: board.team,
      self: {
        syncKey,
        id: p.id,
        label: p.label,
        alias: raceAlias(p),
        avatar: state.avatar || 'cat',
        index: state.index,
        stationIndex: stationIndex(r, state),
        answered: raceHistory(state).all.answered,
        score: state.score,
        correct: state.correct,
        streak: state.streak || 0,
        bestStreak: state.bestStreak || 0,
        prepared: state.prepared ?? state.ready !== false,
        ready: state.ready !== false,
        remaining: racePersonalRemaining(r, state),
        done,
        item: state.item,
        itemName: raceItems[state.item] || null,
        boost: state.boost,
        double: !!state.double,
        lucky: state.lucky || 0,
        shield: !!state.shield,
        treasure: state.treasure || null,
        stationItemBonus: state.itemScores?.[r.station || 0] || 0,
        itemBox: state.itemBox || null,
        ...(!unchanged
          ? {
              task:
                state.ready === false || (raceStations(r) && racePlayerDone(r, state))
                  ? null
                  : raceVisibleTask(raceCurrentTask(r, state), state, p.number),
              history: state.history,
              reviewCards:
                racePlayerDone(r, state) || board.race.status === 'finished'
                  ? racePool(r)
                      .filter((w) =>
                        raceHistory(state)
                          .words(raceStations(r) ? r.station || 0 : 'all')
                          .review.has(w.word),
                      )
                      .map((w) => ({
                        word: w.word,
                        meaning: w.meaning,
                        audio:
                          w.audio === null ? null : w.audio || '/assets/words/' + w.word + '.wav',
                      }))
                  : [],
              learning,
              lookahead: (() => {
                if (done || state.ready === false || r.status !== 'running') return [];
                const next = {
                  ...state,
                  index: state.index + (state.reviewTask ? 0 : 1),
                  reviewTask: null,
                  swapTask: state.reviewTask ? state.swapTask : null,
                  hintFor: null,
                };
                if (
                  !raceEndless(r) &&
                  next.index >= (raceStations(r) ? ((r.station || 0) + 1) * stationSize(r) : total)
                )
                  return [];
                const task = raceCurrentTask(r, next);
                if (!task) return [];
                const visible = raceVisibleTask(task, next, p.number);
                return [
                  ...new Set(
                    [visible.exercise?.image, visible.exerciseAudio?.audio ?? visible.audio].filter(
                      (url) => typeof url === 'string' && url.startsWith('/'),
                    ),
                  ),
                ].slice(0, 2);
              })(),
            }
          : {}),
      },
      receipt,
    };
  }

  return { raceBoard, raceSession };
}
import { courseEndStatus } from '../../public/race/lifecycle.js';
