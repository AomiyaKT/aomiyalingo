'use strict';
// Normal re-entry uses this browser's bearer; explicit takeover rotates it on the server.
window.raceSessionCache = (() => {
  const key = 'aomi.race.sessions';
  const valid = (s) =>
    s &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    typeof s.token === 'string' &&
    s.token.length > 0 &&
    typeof s.raceId === 'string' &&
    s.raceId.length > 0 &&
    /^\d{1,3}$/.test(String(s.label)) &&
    Number(s.label) >= 1 &&
    Number(s.label) <= 999;
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  const write = (value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const label = (value) => String(Number(String(value).trim()));
  const id = (raceId, number) => raceId + ':' + label(number);
  function save(session, { replace = false } = {}) {
    if (!valid(session)) return;
    const all = read();
    const previous = all[id(session.raceId, session.label)];
    if (previous && previous.token !== session.token && !replace) return;
    const { saved: ignored, ...content } = session;
    if (previous) {
      const { saved, ...priorContent } = previous;
      if (JSON.stringify(priorContent) === JSON.stringify(content)) return;
    }
    all[id(session.raceId, session.label)] = { ...content, saved: Date.now() };
    const entries = Object.entries(all)
      .filter(([, session]) => valid(session))
      .sort((a, b) => (Number(b[1].saved) || 0) - (Number(a[1].saved) || 0))
      .slice(0, 60);
    write(Object.fromEntries(entries));
  }
  function find(raceId, number) {
    const saved = read()[id(raceId, number)];
    return valid(saved) && saved.raceId === raceId && label(saved.label) === label(number)
      ? saved
      : null;
  }
  function remove(session) {
    if (!valid(session)) return;
    const all = read();
    if (all[id(session.raceId, session.label)]?.token !== session.token) return;
    delete all[id(session.raceId, session.label)];
    write(all);
  }
  async function join(api, raceId, number, avatar, { takeover = false } = {}) {
    const saved = find(raceId, number);
    if (saved && !takeover) {
      try {
        const result = await api('/api/race/me', undefined, true, saved);
        if (result.race.id !== raceId || label(result.self.label) !== label(number))
          throw Object.assign(Error('参加情報を確認してください。'), { status: 401 });
        return { session: saved, result };
      } catch (e) {
        if (e.status !== 401 && e.status !== 404) throw e;
        remove(saved);
      }
    }
    const result = await api('/api/race/join', {
      raceId,
      label: number,
      waitForReady: true,
      ...(takeover ? { takeover: true } : {}),
      ...(avatar ? { avatar } : {}),
    });
    const session = { token: result.token, raceId: result.race.id, label: result.self.label };
    save(session, { replace: true });
    return { session, result };
  }
  return { save, find, remove, join };
})();
