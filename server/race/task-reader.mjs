const emptyTasks = Object.freeze([]);

function freezeSnapshot(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}

// Only immutable teaching snapshots are shared. Live room fields and mutable
// player states still come from the current authenticated database request.
export function createRaceTaskReader({
  maxEntries = 4,
  maxChars = 512 * 1024,
  parse = JSON.parse,
} = {}) {
  const rows = new WeakMap();
  const recent = new Map();
  let retainedChars = 0;
  return function raceTaskList(room) {
    if (!room) return emptyTasks;
    const raw = room.tasks;
    const row = rows.get(room);
    if (row?.raw === raw) return row.tasks;
    let tasks = recent.get(raw);
    if (tasks !== undefined) {
      recent.delete(raw);
      recent.set(raw, tasks);
    } else {
      tasks = freezeSnapshot(parse(raw));
      if (maxEntries > 0 && raw.length <= maxChars) {
        while (
          recent.size &&
          (recent.size >= maxEntries || retainedChars + raw.length > maxChars)
        ) {
          const oldest = recent.keys().next().value;
          retainedChars -= oldest.length;
          recent.delete(oldest);
        }
        recent.set(raw, tasks);
        retainedChars += raw.length;
      }
    }
    // Oversized snapshots still parse once for a request-local row, without
    // evicting the small shared working set or being retained across requests.
    rows.set(room, { raw, tasks });
    return tasks;
  };
}
