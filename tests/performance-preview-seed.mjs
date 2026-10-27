// Disposable localhost-only classroom traffic for browser QA, never a production load test.
const origin = 'http://127.0.0.1:8767';
const password = process.env.TEACHER_PASSWORD;
if (!password) throw Error('Set the local preview TEACHER_PASSWORD first.');
let cookie;
async function api(path, body, token) {
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (path.endsWith('/login')) cookie = response.headers.get('set-cookie')?.split(';')[0];
  const result = await response.json();
  if (!response.ok) throw Error(path + ' ' + response.status + ' ' + result.error);
  return result;
}
await api('/api/teacher/login', { password });
const { raceId } = await api('/api/teacher/race/create', {
  title: '性能検証用 · 35人',
  grade: 5,
  unit: '1',
  endless: true,
  format: 'classic',
});
const peers = await Promise.all(
  Array.from({ length: 35 }, (_, i) => api('/api/race/join', { raceId, label: String(i + 1) })),
);
await Promise.all(peers.map((p) => api('/api/race/ready', { avatar: 'cat' }, p.token)));
await api('/api/teacher/race/state', { raceId, action: 'start' });
const config = await api('/api/teacher/config');
const words = config.config.grade5unit1.words;
// Countdown is real; only answer after the server publishes a running task.
for (const peer of peers) {
  let result = await api('/api/race/me', undefined, peer.token);
  if (result.race.status === 'countdown') continue;
  for (let n = 0; n < 3; n++) {
    const task = result.self.task,
      word = words.find((w) => w.word === task.spoken);
    result = await api(
      '/api/race/answer',
      { questionId: task.id, answer: task.mode === 'text' ? word.meaning : word.word },
      peer.token,
    );
  }
}
console.log('Local preview: 35 prepared participants in one live Grade 5 Unit 1 race.');
