import { APP_VERSION } from '../public/shared/release.js';
import { UPDATE_REPOSITORY, releaseVersion } from '../public/shared/update-policy.js';

const LATEST_RELEASE = 'https://api.github.com/repos/AomiyaKT/aomiyalingo/releases/latest';
const LEGACY_VERSION =
  'https://raw.githubusercontent.com/AomiyaKT/aomiyalingo/main/public/shared/release.js';

async function boundedText(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) throw Error('UPDATE_TOO_LARGE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '',
    size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error('UPDATE_TOO_LARGE');
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export function createReleaseReader({
  fetch = (...args) => globalThis.fetch(...args),
  now = Date.now,
  timeout = 6500,
} = {}) {
  let cached = null,
    expires = 0,
    inflight = null;
  async function read() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const options = {
        signal: controller.signal,
        redirect: 'error',
        headers: {
          'user-agent': 'Aomiyalingo-update-checker',
          accept: 'application/vnd.github+json',
        },
      };
      const response = await fetch(LATEST_RELEASE, options);
      let latest;
      if (response.status === 404) {
        await response.body?.cancel();
        // Older releases predate GitHub Releases. Read the version literal, never execute source.
        const legacy = await fetch(LEGACY_VERSION, {
          ...options,
          headers: { 'user-agent': 'Aomiyalingo-update-checker', accept: 'text/plain' },
        });
        if (!legacy.ok) throw Error('UPDATE_UNAVAILABLE');
        const source = await boundedText(legacy, 8192);
        const version = releaseVersion(
          source.match(/^export const APP_VERSION = ['"]([^'"\r\n]+)['"];?\s*$/m)?.[1],
        );
        if (!version) throw Error('UPDATE_INVALID');
        latest = {
          version,
          title: 'Release ' + version,
          notes: '',
          url: UPDATE_REPOSITORY,
          source: 'repository',
          publishedAt: null,
        };
      } else {
        if (!response.ok) {
          await response.body?.cancel();
          throw Error('UPDATE_UNAVAILABLE');
        }
        const release = JSON.parse(await boundedText(response, 131072));
        const version = releaseVersion(release.tag_name);
        if (!version || release.draft !== false || release.prerelease !== false)
          throw Error('UPDATE_INVALID');
        latest = {
          version,
          title: String(release.name || 'Release ' + version).slice(0, 160),
          notes: typeof release.body === 'string' ? release.body.slice(0, 6000) : '',
          // Ignore external links in the response; only this repository may supply release links.
          url: UPDATE_REPOSITORY + '/releases/tag/' + encodeURIComponent(release.tag_name),
          source: 'release',
          publishedAt:
            typeof release.published_at === 'string' &&
            Number.isFinite(Date.parse(release.published_at))
              ? release.published_at
              : null,
        };
      }
      return { latest, checkedAt: now(), available: true };
    } catch {
      return { latest: null, checkedAt: now(), available: false };
    } finally {
      clearTimeout(timer);
    }
  }
  return async function latestRelease() {
    if (cached && now() < expires) return cached;
    if (inflight) return inflight;
    inflight = read()
      .then((result) => {
        cached = result;
        expires = now() + (result.available ? 300000 : 15000);
        return result;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}

export function createTeacherUpdateRoute({ teacher, stmt, json, now, fetch }) {
  const latestRelease = createReleaseReader({ now, fetch });
  async function activeClassroom(env) {
    const [lesson, race] = await Promise.all([
      stmt(env, 'SELECT id FROM classrooms WHERE active=1 AND deleted_at=0 LIMIT 1').first(),
      stmt(env, "SELECT id FROM races WHERE deleted_at=0 AND status<>'finished' LIMIT 1").first(),
    ]);
    return !!(lesson || race);
  }
  return async function updatesRoute(req, env, url) {
    if (!['/api/teacher/updates', '/api/teacher/updates/ready'].includes(url.pathname)) return null;
    if (!(await teacher(req, env))) return json({ error: 'ログインしてください。' }, 401);
    if (req.method !== 'GET') return json({ error: 'アクセスできません。' }, 405);
    if (url.pathname.endsWith('/ready')) {
      if (url.searchParams.get('version') !== APP_VERSION)
        return json({ error: 'バージョンが変わりました。もう一度更新を確認してください。' }, 409);
      if (await activeClassroom(env))
        return json({ error: '授業・レースを終了してから更新してください。' }, 409);
      return json({ ok: true, version: APP_VERSION });
    }
    const [release, active] = await Promise.all([latestRelease(), activeClassroom(env)]);
    return json({ serverVersion: APP_VERSION, ...release, active, repository: UPDATE_REPOSITORY });
  };
}
