// Local, accelerated model of a 30-minute lesson. No production requests or data.
// SQLite models D1; timings are local CPU/API timings, not classroom Wi-Fi or FPS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import worker from '../dist/server/index.js';
import { database } from '../tests/database.mjs';
import { course } from '../public/learning/course.js';
import { createRaceRules } from '../server/race/rules.mjs';
import { spellingCharacters } from '../public/shared/curriculum.js';
import { createRaceApi } from '../public/race/api.js';
import { recordSyncQuery, restoreRaceRecords } from '../public/shared/race-record-sync.js';

const DB = database(),
  batch = DB.batch.bind(DB);
let writes = Promise.resolve();
DB.batch = (items) => {
  const job = writes.then(() => batch(items));
  writes = job.catch(() => {});
  return job;
};
const env = { DB, TEACHER_PASSWORD: 'local-soak-fixture' };
const realNow = Date.now,
  startWall = performance.now(),
  start = realNow();
let time = start;
Date.now = () => time;
const metrics = {
  requests: 0,
  bytes: 0,
  ordinaryAnswers: 0,
  raceAnswers: 0,
  replayedAnswers: 0,
  offlineRecoveries: 0,
  itemUses: 0,
  closedCourses: 0,
  unexpectedErrors: 0,
};
const timing = new Map(),
  memory = [];
let cookie;
function record(path, elapsed, bytes) {
  metrics.requests++;
  metrics.bytes += bytes;
  const key = path.split('?')[0];
  if (!timing.has(key)) timing.set(key, []);
  timing.get(key).push(elapsed);
}
async function raw(path, body, headers = {}) {
  const at = performance.now(),
    r = await worker.fetch(
      new Request('https://soak.local' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    );
  const text = await r.clone().text();
  record(path, performance.now() - at, Buffer.byteLength(text));
  return r;
}
async function api(path, body, headers = {}) {
  const r = await raw(path, body, headers),
    data = await r.json();
  if (!r.ok)
    throw Object.assign(Error(path + ' ' + r.status + ' ' + data.error), { status: r.status });
  return data;
}
const teacher = (path, body) => api('/api/teacher/' + path, body, { cookie });
function answer(task, correct = true, practice = false) {
  if (!task.exercise) {
    const expected = task.mode === 'text' ? task.content.meaning : task.content.word;
    const value = correct
      ? expected
      : task.mode === 'spelling'
        ? expected.replace(/[a-z]/gi, 'x')
        : task.options?.find((x) => x !== expected) || 'wrong';
    return practice && task.mode !== 'spelling' ? [value] : value;
  }
  const e = task.exercise;
  if (e.kind === 'match') {
    const pairs = task.solution.map((pair, i, all) => [
      pair[0],
      correct ? pair[1] : all[(i + 1) % all.length][1],
    ]);
    return JSON.stringify(pairs);
  }
  if (e.kind !== 'order')
    return correct ? task.solution : e.choices?.find((x) => x !== task.solution) || 'wrong';
  const available = e.tokens.slice(),
    order = [];
  let rest = task.solution;
  while (rest.length) {
    const index = available.findIndex(
      (v) =>
        rest.startsWith(v.value) &&
        (e.separator === '' || rest.length === v.value.length || rest[v.value.length] === ' '),
    );
    assert.ok(index >= 0, 'authored tokens cover solution');
    const [token] = available.splice(index, 1);
    order.push(token.id);
    rest = rest.slice(token.value.length);
    if (e.separator !== '') rest = rest.trimStart();
  }
  return JSON.stringify(correct ? order : order.reverse());
}
function sample(minute) {
  globalThis.gc?.();
  memory.push({
    minute,
    heapMiB: +(process.memoryUsage().heapUsed / 1048576).toFixed(2),
    rssMiB: +(process.memoryUsage().rss / 1048576).toFixed(2),
  });
}
try {
  const login = await raw('/api/teacher/login', { password: env.TEACHER_PASSWORD });
  cookie = login.headers.get('set-cookie').split(';')[0];
  const room = await teacher('classes', {
    title: 'Local ordinary practice',
    grade: 6,
    unit: '2',
    format: 'adaptive-four',
  });
  const ordinary = await Promise.all(
    Array.from({ length: 35 }, (_, i) =>
      api('/api/join', { classId: room.id, label: String(i + 1) }),
    ),
  );
  sample(0);
  for (let tick = 0; tick < 60; tick++) {
    time = start + tick * 2000;
    await Promise.all(
      ordinary.map(async (p, i) => {
        const auth = { authorization: 'Bearer ' + p.token };
        await api('/api/student/status', undefined, auth);
        if (tick % 15 === 0) await api('/api/student/ping', {}, auth);
        if (tick % 6 !== i % 6) return;
        if (!p.lesson.queue.length) {
          p.lesson = (await api('/api/student/start', { reset: true }, auth)).lesson;
        }
        if (p.lesson.lastRound) p.lesson = (await api('/api/student/start', {}, auth)).lesson;
        const t = course.currentExercise(p.lesson, p.lesson.vocabulary) || {
          ...p.lesson.queue[0],
          content: p.lesson.vocabulary.find((w) => w.word === p.lesson.queue[0].word),
        };
        const payload = { questionId: t.id, answer: answer(t, (tick + i) % 7 !== 0, true) };
        const saved = await api('/api/student/answer', payload, auth);
        p.lesson = saved.lesson;
        metrics.ordinaryAnswers++;
        if (tick % 30 === i % 6) {
          const replay = await api('/api/student/answer', payload, auth);
          assert.equal(replay.duplicate, true);
          metrics.replayedAnswers++;
        }
      }),
    );
    if (tick % 2 === 0) await teacher('progress?class=' + room.id);
  }
  const frozenLessons = (await DB.prepare('SELECT id,lesson FROM students ORDER BY id').all())
    .results;
  const raceId = (
    await teacher('race/create', {
      title: 'Local 35-person race',
      grade: 6,
      unit: '2',
      endless: true,
      format: 'adaptive-four',
    })
  ).raceId;
  const peers = [];
  async function join(i) {
    const peer = { i, session: null, data: null, pending: null, lost: false, offline: false };
    peer.api = createRaceApi({
      getSession: () => peer.session,
      fetch: async (path, options) => {
        if (peer.offline) {
          peer.offline = false;
          metrics.offlineRecoveries++;
          throw TypeError('injected offline poll');
        }
        const r = await raw(
          path,
          options?.body === undefined ? undefined : JSON.parse(options.body),
          options?.headers,
        );
        if (peer.lost && path === '/api/race/answer' && r.ok) {
          peer.lost = false;
          metrics.offlineRecoveries++;
          throw TypeError('injected lost acknowledgement');
        }
        return r;
      },
    });
    const joined = await peer.api('/api/race/join', { raceId, label: String(i + 1) });
    peer.session = { token: joined.token };
    peer.id = joined.self.id;
    peer.data = joined;
    peer.data = await peer.api('/api/race/ready', { avatar: i % 2 ? 'fox' : 'cat' }, true);
    peers.push(peer);
    return peer;
  }
  time = start + 120000;
  for (let i = 0; i < 34; i++) await join(i);
  const raceStart = time;
  await teacher('race/state', { raceId, action: 'start' });
  const rules = createRaceRules({
    words: [],
    raceAvatarCatalog: [],
    shuffle: (a) => a,
    spellingCharacters,
    now: () => time,
  });
  let lastTeacher = null,
    pauseAt = null,
    paused = false,
    continued = false,
    holdUntil = 0,
    oldRaceScore = null,
    extraRace = null;
  const modes = new Set(),
    courses = new Set();
  for (let second = 122; second <= 1800; second += 2) {
    time = start + second * 1000;
    if (second === 142) await join(34);
    if (second === 270) {
      await teacher('race/state', { raceId, action: 'pause' });
      pauseAt = time;
      paused = true;
    }
    if (paused && !continued && time - pauseAt >= 20000) {
      await teacher('race/state', { raceId, action: 'resume' });
      continued = true;
    }
    const query = recordSyncQuery(lastTeacher);
    const response = await teacher('race/board?race=' + raceId + query);
    lastTeacher = restoreRaceRecords(response, lastTeacher);
    if (lastTeacher.race.status === 'intermission') {
      const station = lastTeacher.race.station;
      if (!courses.has(station)) {
        courses.add(station);
        metrics.closedCourses++;
        holdUntil = time + 10000;
      }
      if (time >= holdUntil) await teacher('race/state', { raceId, action: 'nextStation' });
    } else if (lastTeacher.race.status === 'finished') {
      if (!courses.has(2)) {
        courses.add(2);
        metrics.closedCourses++;
        assert.equal(metrics.closedCourses, 3);
        oldRaceScore = lastTeacher.players.reduce((n, p) => n + p.score, 0);
      }
      if (second > 1500 && !extraRace)
        extraRace = (
          await teacher('race/create', {
            title: 'Fresh setup after finished race',
            grade: 5,
            unit: '1',
            endless: true,
            format: 'adaptive-four',
          })
        ).raceId;
    }
    await Promise.all(
      peers.map(async (peer) => {
        if (peer.data?.race.status === 'finished' && second % 6 !== (peer.i % 3) * 2) return;
        if (second % 120 === peer.i * 2 && peer.i % 9 === 0) peer.offline = true;
        try {
          if (peer.pending) {
            peer.data = await peer.api('/api/race/answer', peer.pending, true);
            assert.equal(
              peer.data.self.history.filter((h) => h.id === peer.pending.questionId).length,
              1,
              'Lost acknowledgement is credited once',
            );
            peer.pending = null;
            metrics.replayedAnswers++;
          }
          peer.data = await peer.api('/api/race/me', undefined, true);
        } catch (error) {
          if (!error.status) return;
          throw error;
        }
        const { race, self } = peer.data;
        if (
          race.status !== 'running' ||
          !self.ready ||
          self.done ||
          !self.task ||
          second % (10 + (peer.i % 3) * 2) !== (peer.i % 2) * 2
        )
          return;
        if (self.item && self.index % 9 === 0) {
          peer.data = await peer.api('/api/race/item', { questionId: self.task.id }, true);
          metrics.itemUses++;
        }
        const row = await DB.prepare('SELECT state FROM racers WHERE id=?').bind(peer.id).first();
        const current = await DB.prepare('SELECT * FROM races WHERE id=?').bind(raceId).first(),
          state = JSON.parse(row.state),
          task = rules.raceCurrentTask(current, state);
        assert.equal(task.id, peer.data.self.task.id);
        modes.add(task.mode);
        peer.pending = {
          questionId: task.id,
          answer: answer(task, (self.index + peer.i) % 7 !== 0),
        };
        peer.lost = self.index % 19 === 18;
        try {
          peer.data = await peer.api('/api/race/answer', peer.pending, true);
          peer.pending = null;
        } catch (error) {
          if (error.status) throw error;
        }
        metrics.raceAnswers++;
      }),
    );
    if (second % 120 === 0) {
      sample(second / 60);
      console.log(
        JSON.stringify({
          simulatedMinutes: second / 60,
          requests: metrics.requests,
          raceAnswers: metrics.raceAnswers,
          heapMiB: memory.at(-1).heapMiB,
          wallSeconds: +((performance.now() - startWall) / 1000).toFixed(1),
        }),
      );
    }
  }
  assert.equal(metrics.closedCourses, 3);
  assert.ok(extraRace && extraRace !== raceId);
  const final = await teacher('race/board?race=' + raceId);
  assert.equal(final.players.length, 35);
  assert.equal(final.race.status, 'finished');
  assert.equal(
    final.players.reduce((n, p) => n + p.score, 0),
    oldRaceScore,
    'New setup never changes saved scores',
  );
  assert.deepEqual(
    (await DB.prepare('SELECT id,lesson FROM students ORDER BY id').all()).results,
    frozenLessons,
    'Race stages do not rewrite ordinary lessons',
  );
  assert.ok(modes.size >= 10, 'Full three-course exercise set was exercised');
  for (const peer of peers) {
    const state = JSON.parse(
      (await DB.prepare('SELECT state FROM racers WHERE id=?').bind(peer.id).first()).state,
    );
    assert.equal(new Set(state.history.map((h) => h.id)).size, state.history.length);
  }
  sample(30);
  const quantile = (a, q) => {
    const b = a.slice().sort((a, b) => a - b);
    return +(b[Math.min(b.length - 1, Math.floor(b.length * q))] || 0).toFixed(3);
  };
  const report = {
    checkedOn: new Date().toISOString(),
    model:
      'accelerated clock; real Worker APIs and SQLite, 35 simulated learners; no network/iPad/FPS measurement',
    simulatedMinutes: 30,
    wallSeconds: +((performance.now() - startWall) / 1000).toFixed(2),
    ...metrics,
    modes: [...modes].sort(),
    memory,
    latencies: Object.fromEntries(
      [...timing].map(([path, a]) => [
        path,
        { count: a.length, medianMs: quantile(a, 0.5), p95Ms: quantile(a, 0.95) },
      ]),
    ),
  };
  const index = process.argv.indexOf('--output');
  const file = index < 0 ? '.sites-runtime/soak-74.json' : process.argv[index + 1];
  fs.mkdirSync(dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      complete: true,
      simulatedMinutes: 30,
      wallSeconds: report.wallSeconds,
      requests: metrics.requests,
      raceAnswers: metrics.raceAnswers,
      unexpectedErrors: 0,
      report: file,
    }),
  );
} catch (error) {
  metrics.unexpectedErrors++;
  throw error;
} finally {
  Date.now = realNow;
}
