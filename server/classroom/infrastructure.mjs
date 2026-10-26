const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
const now = () => Date.now();
const token = () => crypto.randomUUID() + crypto.randomUUID();
async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function db(env) {
  if (!env.DB) throw Error('DATABASE_UNAVAILABLE');
  return env.DB;
}
const stmt = (env, sql, ...values) =>
  db(env)
    .prepare(sql)
    .bind(...values);
async function body(req) {
  if (Number(req.headers.get('content-length') || 0) > 12000) throw Error('BAD_REQUEST');
  const text = await req.text();
  if (text.length > 12000) throw Error('BAD_REQUEST');
  try {
    return JSON.parse(text);
  } catch {
    throw Error('BAD_REQUEST');
  }
}
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const validLabel = (value) =>
  /^\d{1,3}$/.test(String(value || '').trim()) && Number(value) > 0 ? String(Number(value)) : null;
function csvCell(value) {
  const text = String(value ?? '');
  return '"' + (/^[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
}

export { json, now, token, hash, db, stmt, body, shuffle, validLabel, csvCell };
