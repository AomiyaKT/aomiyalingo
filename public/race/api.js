import { createRequest } from '../shared/request.js';
import { createStudentRaceSync } from '../shared/student-race-sync.js';
export function createRaceApi({ getSession, fetch = globalThis.fetch }) {
  const request = createRequest({
    fetch,
    onConnection: (ok) => globalThis.aomiNetwork?.connection(ok),
  });
  const sync = createStudentRaceSync();
  async function api(path, body, auth = false, credential = getSession()) {
    const token = auth ? credential?.token : null;
    const suffix = path === '/api/race/me' && token ? sync.query(token) : '';
    try {
      const result = await request(path + suffix, body, { token });
      const owner = token || result.token;
      try {
        return sync.merge(result, owner);
      } catch {
        sync.forget(owner);
        if (!suffix) throw Error('SESSION_SNAPSHOT_MISSING');
        return sync.merge(await request(path, body, { token }), token);
      }
    } catch (error) {
      if (error.status === 401 || error.status === 404) sync.forget(token);
      throw error;
    }
  }

  return api;
}
