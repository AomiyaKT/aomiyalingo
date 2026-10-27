export const privateRaceFields = ['history', 'learning', 'task', 'reviewCards', 'lookahead'];

// Credentials own their snapshots. Never share a cached answer/task between students.
export function createStudentRaceSync() {
  const cache = new Map();
  return {
    query(token) {
      const entry = cache.get(token);
      return entry ? '?known=' + encodeURIComponent(entry.key) : '';
    },
    merge(result, token) {
      if (!result.self?.syncKey || !token) return result;
      const previous = cache.get(token);
      const missing = privateRaceFields.some((key) => !Object.hasOwn(result.self, key));
      if (missing && (!previous || previous.key !== result.self.syncKey))
        throw Error('SESSION_SNAPSHOT_MISSING');
      const self = missing ? { ...previous.self, ...result.self } : result.self;
      cache.delete(token);
      cache.set(token, { key: self.syncKey, self });
      while (cache.size > 2) cache.delete(cache.keys().next().value);
      return missing ? { ...result, self } : result;
    },
    forget(token) {
      cache.delete(token);
    },
  };
}
