// One in-flight refresh, staggered classroom traffic, and no background polling.
export function createPollScheduler({ run, state, host = globalThis, random = Math.random }) {
  let timer = null,
    active = false,
    disposed = false,
    failures = 0;
  function interval() {
    const status = state()?.status;
    const base =
      status === 'countdown'
        ? 500
        : status === 'finished'
          ? 5000
          : status === 'paused'
            ? 4000
            : 2000;
    return Math.min(15000, base * 2 ** Math.min(failures, 3)) * (1 + random() * 0.15);
  }
  function cancel() {
    if (timer !== null) host.clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    cancel();
    if (!disposed && !host.document.hidden) timer = host.setTimeout(refresh, interval());
  }
  async function refresh() {
    cancel();
    if (disposed || active || host.document.hidden) return;
    active = true;
    try {
      const ok = await run();
      failures = ok === false ? failures + 1 : 0;
    } catch {
      failures++;
    } finally {
      active = false;
      schedule();
    }
  }
  function visibility() {
    if (host.document.hidden) cancel();
    else refresh();
  }
  host.document.addEventListener('visibilitychange', visibility);
  schedule();
  return {
    refresh,
    dispose() {
      disposed = true;
      cancel();
      host.document.removeEventListener('visibilitychange', visibility);
    },
  };
}
