export function createRequest({
  fetch = globalThis.fetch,
  onConnection = () => {},
  timeout = 12000,
  onRequest = (event) => globalThis.aomiRuntimeStatus?.request(event),
} = {}) {
  return async function request(path, body, { token } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const ticket = onRequest({ phase: 'start', path, method: body === undefined ? 'GET' : 'POST' });
    let ok = false;
    try {
      const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: 'Bearer ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      let result;
      try {
        result = await response.json();
      } catch {
        if (response.ok) throw Error('接続を確認して、もう一度お試しください。');
        result = {};
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        if (response.ok) throw Error('接続を確認して、もう一度お試しください。');
        result = {};
      }
      onConnection(true);
      if (!response.ok) {
        throw Object.assign(Error(result.error || '操作を完了できませんでした。'), {
          status: response.status,
          code: result.code,
        });
      }
      ok = true;
      return result;
    } catch (error) {
      if (!error.status) {
        onConnection(false);
        throw Error('接続を確認してください。送信できたか確認してから、もう一度お試しください。');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (ticket) onRequest({ phase: 'end', ticket, ok });
    }
  };
}
