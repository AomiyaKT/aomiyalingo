import { createRequest } from '../shared/request.js';
export function createRaceApi({ getSession, fetch = globalThis.fetch }) {
  const request = createRequest({
    fetch,
    onConnection: (ok) => globalThis.aomiNetwork?.connection(ok),
  });
  async function api(path, body, auth = false, credential = getSession()) {
    return request(path, body, { token: auth ? credential?.token : null });
  }

  return api;
}
