// Only immutable, public build assets belong here. API responses never enter this cache.
export function decodeAsset(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createAssetResponder(
  assets,
  { maxBytes = 4 * 1024 * 1024, maxEntryBytes = 256 * 1024, decode = decodeAsset } = {},
) {
  const cache = new Map();
  let usedBytes = 0;

  function read(key, asset) {
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const bytes = decode(asset.data);
    // Music/fonts larger than one entry bypass the cache rather than displacing pictures.
    if (bytes.byteLength <= maxEntryBytes && bytes.byteLength <= maxBytes) {
      while (cache.size && usedBytes + bytes.byteLength > maxBytes) {
        const oldest = cache.keys().next().value;
        usedBytes -= cache.get(oldest).byteLength;
        cache.delete(oldest);
      }
      cache.set(key, bytes);
      usedBytes += bytes.byteLength;
    }
    return bytes;
  }

  return function assetResponse(req, key) {
    const asset = Object.hasOwn(assets, key) ? assets[key] : null;
    if (!asset) return new Response('Not found', { status: 404 });
    const html = key.endsWith('.html');
    const headers = {
      'content-type': asset.type,
      'cache-control': html ? 'no-store' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
    };
    if (!html) {
      headers.etag = asset.etag;
      const match = req.headers.get('if-none-match');
      // GET/HEAD use weak comparison; a validator list or wildcard may match.
      if (
        match
          ?.split(',')
          .some((tag) => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === asset.etag)
      )
        return new Response(null, { status: 304, headers });
    }
    headers['content-length'] = String(asset.size);
    // HEAD and unchanged browser requests never decode or allocate a response body.
    let body = null;
    if (req.method !== 'HEAD') {
      const bytes = read(key, asset);
      // Compression is a source-bundle detail. Browsers receive the original WAV,
      // including the same size/ETag, without an audio codec or playback change.
      body =
        asset.encoding === 'gzip'
          ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
          : bytes;
    }
    return new Response(body, { headers });
  };
}
