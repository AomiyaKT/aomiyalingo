export function createClassroomAuth({ stmt, hash, now, token, body, json }) {
  async function teacher(req, env) {
    const cookie = req.headers.get('cookie') || '';
    const value = cookie.match(/(?:^|;\s*)aomi_teacher=([^;]+)/)?.[1];
    if (!value) return false;
    return !!(await stmt(
      env,
      'SELECT token_hash FROM teacher_sessions WHERE token_hash=? AND expires>?',
      await hash(value),
      now(),
    ).first());
  }
  async function student(req, env) {
    const value = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!value) return null;
    return stmt(
      env,
      'SELECT s.* FROM students s JOIN classrooms c ON c.id=s.class_id WHERE s.token_hash=? AND s.deleted_at=0 AND c.deleted_at=0',
      await hash(value),
    ).first();
  }

  async function authRoute(req, env, url) {
    const p = url.pathname;
    if (p === '/api/teacher/session' && req.method === 'GET') {
      return (await teacher(req, env))
        ? json({ ok: true })
        : json({ error: 'ログインしてください。' }, 401);
    }
    if (p === '/api/teacher/login' && req.method === 'POST') {
      const data = await body(req),
        bucket = Math.floor(now() / 900000),
        key = await hash((req.headers.get('cf-connecting-ip') || 'local') + ':' + bucket);
      await stmt(
        env,
        'INSERT INTO login_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
        key,
        now() + 900000,
      ).run();
      const limit = await stmt(env, 'SELECT count FROM login_limits WHERE key=?', key).first();
      if (limit.count > 10) return json({ error: 'しばらく待ってからお試しください。' }, 429);
      if (
        !env.TEACHER_PASSWORD ||
        typeof data.password !== 'string' ||
        (await hash(data.password)) !== (await hash(env.TEACHER_PASSWORD))
      )
        return json({ error: 'パスワードが違います。' }, 401);
      const value = token();
      await stmt(
        env,
        'INSERT INTO teacher_sessions (token_hash,expires) VALUES (?,?)',
        await hash(value),
        now() + 8 * 3600000,
      ).run();
      return json({ ok: true }, 200, {
        'set-cookie': `aomi_teacher=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
      });
    }
    if (p === '/api/teacher/logout' && !(await teacher(req, env)))
      return json({ error: 'ログインしてください。' }, 401);
    if (p === '/api/teacher/logout' && req.method === 'POST') {
      const value = (req.headers.get('cookie') || '').match(/(?:^|;\s*)aomi_teacher=([^;]+)/)?.[1];
      await stmt(env, 'DELETE FROM teacher_sessions WHERE token_hash=?', await hash(value)).run();
      return json({ ok: true }, 200, {
        'set-cookie': 'aomi_teacher=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      });
    }
    return null;
  }
  return { teacher, student, authRoute };
}
