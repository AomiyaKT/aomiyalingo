import { setUIText } from './i18n.js';

export function vocabularyAudio(words = []) {
  return [
    ...new Set(
      words
        .filter((w) => w.audio !== null)
        .map((w) => w.audio || '/assets/words/' + w.word + '.wav'),
    ),
  ];
}

// Required classroom media, distinct from optional next-question speculation.
// Keep complete recordings for native playback rather than trusting Safari's
// separate fetch/media caches. One activity owns at most 48 MiB of blob URLs.
export function createAudioPreparation({
  host = globalThis,
  fetch = host.fetch.bind(host),
  timeout = 20000,
} = {}) {
  let owner = null,
    generation = 0,
    running = false,
    bytes = 0,
    retryTimer = null,
    attempts = 0;
  let urls = [],
    state = { total: 0, loaded: 0, failed: 0, ready: false, loading: false };
  const cache = new Map(),
    failures = new Set(),
    retryable = new Set(),
    active = new Set(),
    listeners = new Set();
  const allowed = (url) =>
    typeof url === 'string' &&
    !url.split('/').includes('..') &&
    (/^\/assets\/[a-zA-Z0-9_./-]+\.(wav|m4a)$/.test(url) ||
      /^\/assets\/words\/blue-sky\/[a-z0-9-]+\.mp3$/.test(url) ||
      /^\/api\/audio\/[a-f0-9-]{36}$/.test(url));
  const publish = () => {
    state = {
      ...state,
      loaded: cache.size,
      failed: failures.size,
      offline: host.navigator?.onLine === false,
      retrying: retryTimer !== null,
      ready: owner !== null && !running && cache.size === urls.length && failures.size === 0,
      loading: running,
    };
    for (const fn of listeners) fn(state);
  };
  function clear() {
    generation++;
    host.clearTimeout(retryTimer);
    retryTimer = null;
    attempts = 0;
    for (const controller of active) controller.abort();
    active.clear();
    for (const entry of cache.values()) host.URL.revokeObjectURL(entry.url);
    cache.clear();
    failures.clear();
    retryable.clear();
    bytes = 0;
    running = false;
  }
  async function run(automatic = false) {
    if (owner === null || running) return;
    host.clearTimeout(retryTimer);
    retryTimer = null;
    if (host.navigator?.onLine === false || host.document?.hidden) {
      publish();
      return;
    }
    const ticket = generation,
      pending = urls.filter(
        (url) => !cache.has(url) && (!automatic || !failures.has(url) || retryable.has(url)),
      );
    let next = 0;
    running = true;
    state.slow = false;
    const slowTimer = host.setTimeout(() => {
      if (ticket === generation && running) {
        state.slow = true;
        publish();
      }
    }, 8000);
    publish();
    await Promise.all(
      Array.from({ length: Math.min(2, pending.length) }, async () => {
        while (ticket === generation && next < pending.length) {
          const url = pending[next++],
            controller = new AbortController();
          active.add(controller);
          const timer = host.setTimeout(() => controller.abort(), timeout);
          let canRetry = true;
          try {
            if (!allowed(url)) {
              canRetry = false;
              throw Error('INVALID_AUDIO_URL');
            }
            const response = await fetch(url, {
              credentials: 'same-origin',
              cache: failures.has(url) ? 'reload' : 'force-cache',
              signal: controller.signal,
            });
            if (
              response.status !== 200 ||
              !/^audio\//i.test(response.headers.get('content-type') || '') ||
              Number(response.headers.get('content-length') || 0) > 8 * 1024 * 1024
            ) {
              canRetry =
                response.status === 408 || response.status === 429 || response.status >= 500;
              await response.body?.cancel();
              throw Error('INVALID_AUDIO_RESPONSE');
            }
            const chunks = [],
              reader = response.body.getReader();
            let size = 0;
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > 8 * 1024 * 1024) {
                  canRetry = false;
                  controller.abort();
                  await reader.cancel();
                  throw Error('AUDIO_TOO_LARGE');
                }
                chunks.push(chunk.value);
              }
            } finally {
              reader.releaseLock();
            }
            if (ticket !== generation) return;
            const expected = Number(response.headers.get('content-length') || 0);
            if (!size || (expected && expected !== size)) throw Error('INCOMPLETE_AUDIO');
            canRetry = false;
            if (bytes + size > 48 * 1024 * 1024) throw Error('AUDIO_BUDGET');
            const blob = new Blob(chunks, { type: response.headers.get('content-type') });
            cache.set(url, { url: host.URL.createObjectURL(blob), size });
            failures.delete(url);
            retryable.delete(url);
            bytes += size;
          } catch {
            if (ticket === generation) {
              failures.add(url);
              if (canRetry) retryable.add(url);
              else retryable.delete(url);
            }
          } finally {
            host.clearTimeout(timer);
            active.delete(controller);
            if (ticket === generation) publish();
          }
        }
      }),
    );
    host.clearTimeout(slowTimer);
    if (ticket === generation) {
      running = false;
      state.slow = false;
      if (retryable.size && host.navigator?.onLine !== false && !host.document?.hidden) {
        // One bounded, staggered retry loop; successful recordings stay cached.
        retryTimer = host.setTimeout(
          () => {
            retryTimer = null;
            void run(true);
          },
          Math.min(20000, 3000 * 2 ** Math.min(attempts++, 3) * (1 + Math.random() * 0.15)),
        );
      }
      publish();
    }
  }
  return {
    prepare(key, resources) {
      const next = [...new Set(resources)].sort();
      const identity = key + ':' + JSON.stringify(next);
      if (owner !== identity) {
        clear();
        owner = identity;
        urls = next;
        state = { total: urls.length, loaded: 0, failed: 0, ready: false, loading: false };
        void run();
      }
      return state;
    },
    retry() {
      attempts = 0;
      return run();
    },
    resume() {
      if (owner === null) return;
      if (!running && cache.size !== urls.length) return run(true);
      publish();
    },
    resolve(url) {
      const entry = cache.get(url);
      return entry?.nativeFallback ? url : entry?.url || url;
    },
    rejectPlayback(url, attemptedURL) {
      const entry = cache.get(url);
      if (!entry || entry.url !== attemptedURL || entry.nativeFallback) return false;
      // Some media backends reject blob playback although the same recording
      // plays through HTTP. Keep the downloaded bytes, but use its original URL.
      entry.nativeFallback = true;
      return true;
    },
    get state() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
    dispose() {
      clear();
      owner = null;
      urls = [];
      state = { total: 0, loaded: 0, failed: 0, ready: false, loading: false };
      publish();
    },
  };
}

export function createAudioPreparationPanel({
  service,
  before,
  onChange = () => {},
  loadingNote = '読み込み中も、下の単語を確認できます。',
}) {
  const panel = document.createElement('section');
  panel.className = 'audio-preparation';
  panel.setAttribute('aria-label', '音声の準備');
  const label = document.createElement('p'),
    progress = document.createElement('progress'),
    retry = document.createElement('button'),
    note = document.createElement('small');
  label.setAttribute('role', 'status');
  label.setAttribute('aria-live', 'polite');
  retry.type = 'button';
  retry.className = 'home-button';
  retry.textContent = '残りの音声を再読み込み';
  progress.setAttribute('aria-label', '音声の準備');
  retry.onclick = () => service.retry();
  panel.append(label, progress, retry, note);
  before.before(panel);
  service.subscribe((state) => {
    progress.max = Math.max(1, state.total);
    progress.value = state.loaded;
    setUIText(
      label,
      state.ready ? '✓ 音声の準備ができました' : `音声を準備中：${state.loaded} / ${state.total}`,
    );
    setUIText(
      note,
      state.ready
        ? '文章の音声は端末の読み上げを使います。'
        : state.offline
          ? 'オフラインです。読み込み済みの音声は保持しています。接続が戻ると続けます。'
          : state.failed
            ? state.loading || state.retrying
              ? `残り ${state.total - state.loaded} 件を自動で再試行します。`
              : `読み込めなかった音声：${state.failed} 件。下のボタンでもう一度お試しください。`
            : state.slow
              ? '少し時間がかかっています。この画面のままお待ちください。'
              : loadingNote,
    );
    retry.hidden = !state.failed || state.loading;
    onChange(state);
  });
  return panel;
}
