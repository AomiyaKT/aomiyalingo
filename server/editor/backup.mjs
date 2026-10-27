import { allCurriculumProfiles } from '../../public/shared/curriculum.js';
import { validateConfig } from './validation.mjs';
import { APP_VERSION } from '../../public/shared/release.js';
const LIMIT = 8 * 1024 * 1024;
const format = 'aomiyalingo-teaching-backup';
const audioIds = (config) => [
  ...new Set(
    allCurriculumProfiles(config)
      .flatMap((p) => p.words)
      .map((w) => w.audio?.match(/^\/api\/audio\/([a-f0-9-]{36})$/)?.[1])
      .filter(Boolean),
  ),
];
const fail = (message) => {
  throw Object.assign(Error(message), { configuration: true });
};
export function createTeachingBackup({
  stmt,
  db,
  loadConfig,
  json,
  hash,
  assetExists = () => true,
}) {
  async function exportData(env, config) {
    const audio = [];
    for (const id of audioIds(config)) {
      const clip = await stmt(env, 'SELECT id,mime,data FROM config_audio WHERE id=?', id).first();
      if (!clip) fail('音声が見つかりません。教材チェックを確認してください。');
      audio.push({ ...clip, sha256: await hash(clip.data) });
      if (audio.reduce((n, a) => n + a.data.length, 0) > LIMIT - 700000)
        fail('音声付きバックアップは8 MBまでです。');
    }
    return {
      format,
      schema: 1,
      appVersion: APP_VERSION,
      createdAt: new Date().toISOString(),
      config,
      audio,
    };
  }
  async function validate(backup) {
    if (
      backup?.format !== format ||
      backup.schema !== 1 ||
      !Array.isArray(backup.audio) ||
      backup.audio.length > 160
    )
      fail('Aomiyalingoのバックアップファイルを選んでください。');
    const config = structuredClone(backup.config);
    if (JSON.stringify(config ?? null).length > 512000) fail('設定が大きすぎます。');
    validateConfig(config);
    const clips = new Map();
    for (const a of backup.audio) {
      if (
        !/^[a-f0-9-]{36}$/.test(a?.id) ||
        clips.has(a.id) ||
        !['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(a.mime) ||
        typeof a.data !== 'string' ||
        a.data.length > 1400000 ||
        (await hash(a.data)) !== a.sha256
      )
        fail('バックアップの音声データが壊れています。');
      let bytes;
      try {
        bytes = atob(a.data);
      } catch {
        fail('音声データを確認してください。');
      }
      if (bytes.length < 16 || bytes.length > 1048576) fail('音声データを確認してください。');
      const signatures = {
        'audio/wav': bytes.slice(0, 4) === 'RIFF' && bytes.slice(8, 12) === 'WAVE',
        'audio/mpeg':
          bytes.slice(0, 3) === 'ID3' ||
          (bytes.charCodeAt(0) === 255 && (bytes.charCodeAt(1) & 224) === 224),
        'audio/mp4': bytes.slice(4, 8) === 'ftyp',
        'audio/ogg': bytes.slice(0, 4) === 'OggS',
      };
      if (!signatures[a.mime]) fail('音声ファイルの形式を確認してください。');
      clips.set(a.id, a);
    }
    const refs = audioIds(config);
    if (refs.some((id) => !clips.has(id)) || clips.size !== refs.length)
      fail('音声ファイルが不足しているか、余分なデータがあります。');
    for (const w of allCurriculumProfiles(config).flatMap((p) => p.words))
      for (const path of [w.image, w.audio])
        if (path?.startsWith('/assets/') && !assetExists(path))
          fail('このバージョンにない教材ファイルが含まれています。');
    return { config, clips };
  }
  return async function backupRoute(req, env, url) {
    try {
      if (req.method === 'GET') {
        const previous = url.searchParams.get('previous') === '1';
        const row = previous
          ? await stmt(env, 'SELECT data FROM teaching_backup WHERE id=1').first()
          : null;
        if (previous && !row)
          return json({ error: '復元前の自動バックアップはまだありません。' }, 404);
        const config = row ? JSON.parse(row.data) : (await loadConfig(env)).config;
        const backup = await exportData(env, config),
          text = JSON.stringify(backup);
        if (text.length > LIMIT) fail('バックアップは8 MBまでです。');
        return new Response(text, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'content-disposition':
              'attachment; filename="aomiyalingo-teaching-' +
              new Date().toISOString().slice(0, 10) +
              '.json"',
          },
        });
      }
      if (Number(req.headers.get('content-length') || 0) > LIMIT)
        fail('バックアップは8 MBまでです。');
      const raw = await req.text();
      if (raw.length > LIMIT) fail('バックアップは8 MBまでです。');
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        fail('ファイルを読み取れませんでした。');
      }
      const checked = await validate(payload.backup),
        current = await loadConfig(env),
        digest = await hash(JSON.stringify(payload.backup));
      if (url.pathname.endsWith('/inspect'))
        return json({
          revision: current.revision,
          digest,
          profiles: allCurriculumProfiles(checked.config).length,
          words: allCurriculumProfiles(checked.config).reduce((n, p) => n + p.words.length, 0),
          audio: checked.clips.size,
          createdAt: payload.backup.createdAt,
        });
      if (req.method !== 'POST' || !url.pathname.endsWith('/restore'))
        return json({ error: '見つかりません。' }, 404);
      if (
        payload.confirm !== true ||
        payload.digest !== digest ||
        payload.revision !== current.revision
      )
        return json({ error: '設定が変わりました。ファイルをもう一度確認してください。' }, 409);
      const idMap = new Map([...checked.clips.keys()].map((id) => [id, crypto.randomUUID()]));
      for (const w of allCurriculumProfiles(checked.config).flatMap((p) => p.words)) {
        const id = w.audio?.match(/^\/api\/audio\/(.+)$/)?.[1];
        if (idMap.has(id)) w.audio = '/api/audio/' + idMap.get(id);
      }
      const data = JSON.stringify(checked.config),
        rev = current.revision;
      const guard = ' WHERE EXISTS (SELECT 1 FROM app_config WHERE id=1 AND revision=? AND data=?)';
      const changes = [
        rev === 0
          ? stmt(
              env,
              'INSERT INTO app_config (id,data,revision) SELECT 1,?,1 WHERE NOT EXISTS (SELECT 1 FROM app_config WHERE id=1)',
              data,
            )
          : stmt(
              env,
              'UPDATE app_config SET data=?,revision=revision+1 WHERE id=1 AND revision=?',
              data,
              rev,
            ),
      ];
      for (const [oldId, clip] of checked.clips)
        changes.push(
          stmt(
            env,
            'INSERT INTO config_audio (id,mime,data) SELECT ?,?,?' + guard,
            idMap.get(oldId),
            clip.mime,
            clip.data,
            rev + 1,
            data,
          ),
        );
      changes.push(
        stmt(
          env,
          'INSERT INTO teaching_backup (id,data,created) SELECT 1,?,?' +
            guard +
            ' ON CONFLICT(id) DO UPDATE SET data=excluded.data,created=excluded.created',
          JSON.stringify(current.config),
          Date.now(),
          rev + 1,
          data,
        ),
      );
      const result = await db(env).batch(changes);
      if (!Number(result[0].meta?.changes))
        return json({ error: '別の画面で設定が変わりました。もう一度確認してください。' }, 409);
      return json({ ok: true, revision: rev + 1 });
    } catch (error) {
      if (error.configuration) return json({ error: error.message }, 400);
      throw error;
    }
  };
}
