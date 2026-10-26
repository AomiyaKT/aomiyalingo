import { createEditorAudio } from './server/editor/audio.mjs';
import { validateConfig } from './server/editor/validation.mjs';
import { curriculumProfileKeys, allCurriculumProfiles } from './public/shared/curriculum.js';
export function createEditorRoute({ stmt, teacher, json, loadConfig, supplementUnitFive }) {
  const audio = createEditorAudio({ stmt, json });
  async function editorRoute(req, env, url) {
    if (url.pathname.startsWith('/api/audio/') && req.method === 'GET')
      return audio.read(req, env, url);
    if (!(await teacher(req, env))) return json({ error: 'ログインしてください。' }, 401);
    if (url.pathname === '/api/teacher/config' && req.method === 'GET')
      return json(await loadConfig(env));
    if (url.pathname === '/api/teacher/config' && req.method === 'POST') {
      const text = await req.text();
      if (text.length > 512000) return json({ error: '設定が大きすぎます。' }, 400);
      let data;
      try {
        data = JSON.parse(text);
        if (data.config) {
          const previous = (await loadConfig(env)).config;
          for (const key of curriculumProfileKeys) data.config[key] ??= previous[key];
          supplementUnitFive(data.config);
        }
        validateConfig(data.config);
      } catch (e) {
        return json({ error: e.configuration ? e.message : '入力内容を確認してください。' }, 400);
      }
      if (!Number.isInteger(data.revision) || data.revision < 0)
        return json({ error: '設定を読み直してください。' }, 400);
      for (const w of allCurriculumProfiles(data.config).flatMap((profile) => profile.words))
        if (
          w.audio?.startsWith('/api/audio/') &&
          !(await stmt(
            env,
            'SELECT id FROM config_audio WHERE id=?',
            w.audio.split('/').at(-1),
          ).first())
        )
          return json({ error: '音声が見つかりません。再アップロードしてください。' }, 400);
      const result = await stmt(
        env,
        'INSERT INTO app_config (id,data,revision) SELECT 1,?,1 WHERE ?=0 ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=app_config.revision+1 WHERE app_config.revision=?',
        JSON.stringify(data.config),
        data.revision,
        data.revision,
      ).run();
      // Existing rows require a normal UPDATE, because the conditional INSERT SELECT may have no rows.
      let changed = Number(result.meta?.changes);
      if (!changed && data.revision > 0) {
        const update = await stmt(
          env,
          'UPDATE app_config SET data=?,revision=revision+1 WHERE id=1 AND revision=?',
          JSON.stringify(data.config),
          data.revision,
        ).run();
        changed = Number(update.meta?.changes);
      }
      return changed
        ? json(await loadConfig(env))
        : json(
            {
              error:
                '別の画面で設定が更新されました。未保存の内容を確認してから再読み込みしてください。',
            },
            409,
          );
    }
    if (url.pathname === '/api/teacher/config/audio' && req.method === 'POST')
      return audio.upload(req, env);
    return json({ error: '見つかりません。' }, 404);
  }

  return editorRoute;
}
