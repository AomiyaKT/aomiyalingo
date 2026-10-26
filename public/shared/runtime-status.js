// Keep connection checks separate from confirmed writes. A successful poll must
// never hide an answer that could not be saved. No student data is retained here.
export function createRuntimeStatus({ now = Date.now, online = true } = {}) {
  const listeners = new Set();
  const pending = new Set();
  const failures = new Map();
  let sequence = 0;
  let reachable = null;
  let checkedAt = null;
  let savedAt = null;
  let editor = { dirty: false, saving: false };
  const snapshot = () => ({
    online,
    reachable,
    checkedAt,
    savedAt,
    pending: pending.size,
    failed: failures.size,
    ...editor,
  });
  const notify = () => listeners.forEach((listener) => listener(snapshot()));
  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    connection(ok) {
      reachable = ok;
      if (ok) checkedAt = now();
      notify();
    },
    online(value) {
      online = value;
      notify();
    },
    editor(value) {
      editor = { dirty: !!value.dirty, saving: !!value.saving };
      notify();
    },
    request(event) {
      if (event.phase === 'start') {
        const id = ++sequence;
        const path = event.path.split('?')[0];
        const writes = event.method === 'POST' && !/\/(login|logout)$/.test(path);
        if (writes) pending.add(id);
        notify();
        return { id, path, writes };
      }
      const { id, path, writes } = event.ticket;
      if (writes) {
        pending.delete(id);
        if (event.ok) {
          failures.delete(path);
          savedAt = now();
        } else failures.set(path, true);
      }
      notify();
    },
  };
}

export function describeRuntimeStatus(state) {
  const connection = !state.online
    ? 'オフライン'
    : state.reachable === false
      ? 'サーバーに接続できません'
      : state.reachable === true
        ? 'サーバーに接続済み'
        : '接続は未確認';
  const save =
    state.pending || state.saving
      ? '保存中…'
      : state.failed
        ? '保存を確認できない操作があります'
        : state.dirty
          ? '未保存の変更があります'
          : state.savedAt
            ? 'この画面での操作は保存済み'
            : 'この画面での保存操作はまだありません';
  return { connection, save, warning: !!(state.failed || state.dirty) };
}
