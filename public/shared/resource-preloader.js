export function taskResourceHints(task) {
  if (!task) return [];
  return [task.exercise?.image, task.exerciseAudio?.audio ?? task.audio]
    .filter((value) => typeof value === 'string')
    .slice(0, 2);
}

export function practiceResourceHints(lesson, words) {
  const task = lesson?.queue?.[1];
  const word = words.find((entry) => entry.word === task?.word);
  if (!word) return [];
  return [word.image, word.audio].filter((value) => typeof value === 'string').slice(0, 2);
}

// Opportunistic HTTP-cache warming only. Never plays audio or advances a task.
export function createResourcePreloader({
  host = globalThis,
  fetch = host.fetch?.bind(host),
  now = Date.now,
} = {}) {
  const seen = new Map();
  let queue = [],
    timer = null,
    active = null,
    disposed = false;
  const allowed = (url) =>
    typeof url === 'string' &&
    (/^\/assets\/(?:words\/[a-z-]+\.wav|vocabulary\/g[56]-unit[1-8]\/[a-z0-9_]+\.png)$/.test(url) ||
      /^\/api\/audio\/[a-f0-9-]{36}$/.test(url));
  const enabled = () =>
    !disposed &&
    fetch &&
    !host.document?.hidden &&
    host.navigator?.onLine !== false &&
    !host.navigator?.connection?.saveData &&
    !/^(slow-)?2g$/.test(host.navigator?.connection?.effectiveType || '');
  function remember(url, successful = true) {
    seen.delete(url);
    seen.set(url, successful ? Infinity : now() + 30000);
    while (seen.size > 64) seen.delete(seen.keys().next().value);
  }
  function reset() {
    queue = [];
    if (timer !== null) host.clearTimeout(timer);
    timer = null;
    active?.controller.abort();
  }
  async function consume(response, controller) {
    if (!response.ok || Number(response.headers?.get('content-length') || 0) > 524288) {
      await response.body?.cancel?.();
      return false;
    }
    if (!response.body?.getReader) return (await response.arrayBuffer()).byteLength <= 524288;
    const reader = response.body.getReader();
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return true;
        size += value.byteLength;
        if (size > 524288) {
          controller.abort();
          await reader.cancel();
          return false;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  async function run() {
    timer = null;
    if (!enabled() || active) return;
    const url = queue.shift();
    if (!url) return;
    const request = { url, controller: new AbortController() };
    active = request;
    const deadline = host.setTimeout(() => request.controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        cache: 'force-cache',
        credentials: 'same-origin',
        priority: 'low',
        signal: request.controller.signal,
      });
      if (await consume(response, request.controller)) remember(url);
      else if (!request.controller.signal.aborted) remember(url, false);
    } catch {
      if (!request.controller.signal.aborted) remember(url, false);
    } finally {
      host.clearTimeout(deadline);
      if (active === request) active = null;
      schedule();
    }
  }
  function schedule() {
    if (timer === null && queue.length && enabled() && !active) timer = host.setTimeout(run, 250);
  }
  function warm(urls = []) {
    if (!enabled()) {
      reset();
      return;
    }
    queue = [...new Set(urls.filter(allowed))]
      .filter((url) => !(seen.get(url) > now()) && active?.url !== url)
      .slice(0, 2);
    schedule();
  }
  function visibility() {
    if (!enabled()) reset();
  }
  host.document?.addEventListener('visibilitychange', visibility);
  host.addEventListener?.('offline', visibility);
  return {
    warm,
    reset,
    dispose() {
      disposed = true;
      reset();
      seen.clear();
      host.document?.removeEventListener('visibilitychange', visibility);
      host.removeEventListener?.('offline', visibility);
    },
  };
}
