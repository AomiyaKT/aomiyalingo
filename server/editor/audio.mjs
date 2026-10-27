export function createEditorAudio({ stmt, json }) {
  async function read(req, env, url) {
    const id = url.pathname.split('/').at(-1),
      a = await stmt(env, 'SELECT mime,data FROM config_audio WHERE id=?', id).first();
    return a
      ? new Response(
          Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0)),
          {
            headers: {
              'content-type': a.mime,
              'cache-control': 'public,max-age=31536000,immutable',
              'x-content-type-options': 'nosniff',
            },
          },
        )
      : new Response('Not found', { status: 404 });
  }
  async function upload(req, env) {
    const text = await req.text();
    if (text.length > 1500000) return json({ error: '音声は1 MB以下にしてください。' }, 400);
    let a;
    try {
      a = JSON.parse(text);
    } catch {
      return json({ error: '音声を確認してください。' }, 400);
    }
    if (
      !['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(a.mime) ||
      typeof a.data !== 'string' ||
      a.data.length > 1400000
    )
      return json({ error: 'WAV・MP3・M4A・OGG（1 MB以下）を選んでください。' }, 400);
    let bytes;
    try {
      bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
    } catch {
      return json({ error: '音声を確認してください。' }, 400);
    }
    if (bytes.length < 16 || bytes.length > 1048576)
      return json({ error: '音声を確認してください。' }, 400);
    const wav =
        String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE',
      mp3 =
        String.fromCharCode(...bytes.slice(0, 3)) === 'ID3' ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224),
      mp4 = String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp',
      ogg = String.fromCharCode(...bytes.slice(0, 4)) === 'OggS';
    if (!{ 'audio/wav': wav, 'audio/mpeg': mp3, 'audio/mp4': mp4, 'audio/ogg': ogg }[a.mime])
      return json({ error: '音声ファイルの形式を確認してください。' }, 400);
    const id = crypto.randomUUID();
    await stmt(
      env,
      'INSERT INTO config_audio (id,mime,data) VALUES (?,?,?)',
      id,
      a.mime,
      a.data,
    ).run();
    return json({ audio: '/api/audio/' + id });
  }
  return { read, upload };
}
