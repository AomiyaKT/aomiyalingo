'use strict';
// Only this browser's bearer credentials can restore an existing racer.
window.raceSessionCache = (() => {
  const key = 'aomi.race.sessions';
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
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
  function save(session) {
    if (!session?.token || !session.raceId || !session.label) return;
    const all = read();
    all[id(session.raceId, session.label)] = { ...session, saved: Date.now() };
    const entries = Object.entries(all)
      .sort((a, b) => b[1].saved - a[1].saved)
      .slice(0, 60);
    write(Object.fromEntries(entries));
  }
  function find(raceId, number) {
    return read()[id(raceId, number)] || null;
  }
  function remove(session) {
    const all = read();
    delete all[id(session.raceId, session.label)];
    write(all);
  }
  async function join(api, raceId, number, avatar) {
    const saved = find(raceId, number);
    if (saved) {
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
      ...(avatar ? { avatar } : {}),
    });
    const session = { token: result.token, raceId: result.race.id, label: result.self.label };
    save(session);
    return { session, result };
  }
  return { save, find, remove, join };
})();
