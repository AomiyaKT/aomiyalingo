// Version only local JS/CSS entry points. Call after bundling so a dependency
// change also changes its entry point URL. HTML itself remains non-cacheable.
export function versionAssetLinks(html, assets) {
  return html.replace(/<(script|link)\b[^>]*>/gi, (tag, kind) => {
    if (kind.toLowerCase() === 'link' && !/\brel\s*=\s*(['"])stylesheet\1/i.test(tag)) return tag;
    const attribute = kind.toLowerCase() === 'script' ? 'src' : 'href';
    return tag.replace(
      new RegExp(`(\\s${attribute}\\s*=\\s*)(['"])(.*?)\\2`, 'i'),
      (match, prefix, quote, value) => {
        if (!value.startsWith('/') || value.startsWith('//')) return match;
        const url = new URL(value.replaceAll('&amp;', '&'), 'https://assets.invalid');
        const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
        if (!/\.(?:js|css)$/.test(url.pathname) || !asset?.etag) return match;
        url.searchParams.set('v', asset.etag.replaceAll('"', ''));
        return (
          prefix + quote + (url.pathname + url.search + url.hash).replaceAll('&', '&amp;') + quote
        );
      },
    );
  });
}
