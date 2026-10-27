import { APP_VERSION } from './public/shared/release.js';
import { createAssetResponder } from './server/assets.mjs';
export function createWorker({ assets, authRoute, editorRoute, raceRoute, classroomRoute, json }) {
  const assetResponse = createAssetResponder(assets);
  async function route(req, env) {
    const url = new URL(req.url),
      p = url.pathname;
    if (p === '/api/health' && req.method === 'GET')
      return json({ ok: true, version: APP_VERSION });
    if (
      req.method !== 'GET' &&
      req.headers.get('origin') &&
      req.headers.get('origin') !== url.origin
    )
      return json({ error: 'アクセスできません。' }, 403);
    const authResponse = await authRoute(req, env, url);
    if (authResponse) return authResponse;
    if (p.startsWith('/api/teacher/config') || p.startsWith('/api/audio/'))
      return editorRoute(req, env, url);
    if (p.startsWith('/api/race/') || p.startsWith('/api/teacher/race/'))
      return raceRoute(req, env, url);
    const classroomResponse = await classroomRoute(req, env, url);
    if (classroomResponse) return classroomResponse;
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return json({ error: '見つかりません。' }, 404);
    const key =
      p === '/race' || p === '/race/'
        ? '/race.html'
        : p === '/race-teacher' || p === '/race-teacher/'
          ? '/race-teacher.html'
          : p === '/teacher-editor' || p === '/teacher-editor/'
            ? '/teacher-editor.html'
            : p === '/teacher' || p === '/teacher/'
              ? '/teacher.html'
              : p === '/student' ||
                  p === '/student/' ||
                  (p === '/' && url.searchParams.get('student') === '1')
                ? '/index.html'
                : p === '/'
                  ? '/teacher-home.html'
                  : p;
    return assetResponse(req, key);
  }
  return {
    async fetch(req, env) {
      try {
        return await route(req, env);
      } catch (error) {
        console.error('Classroom request failed:', String(error.message || error));
        return json(
          {
            error:
              error.message === 'BAD_REQUEST'
                ? '入力内容を確認してください。'
                : '接続できませんでした。しばらく待って再度お試しください。',
          },
          error.message === 'BAD_REQUEST' ? 400 : 503,
        );
      }
    },
  };
}
