export const recordModeNames = {
  text: '単語の意味',
  voice: '音を聞いて選ぶ',
  spelling: 'スペリング',
  match: 'ことばのペア',
  sentence: '文の組み立て',
  cloze: '文の穴うめ',
  audioMatch: '音のペア',
  audioSentence: '聞いて文を作る',
  audioCloze: '聞いて穴うめ',
  dictation: '聞いて書く',
};
export function recordSummary(player, station = 'all') {
  const history = [],
    main = [],
    wrong = [],
    hinted = [],
    needs = new Set();
  let independent = 0;
  const scope = station === 'all' ? null : Number(station);
  for (const h of player.history || []) {
    if (scope !== null && (h.station ?? 0) !== scope) continue;
    history.push(h);
    if (h.review) continue;
    main.push(h);
    if (h.correct && !h.hinted) independent++;
    if (!h.correct) wrong.push(h);
    if (h.hinted) hinted.push(h);
    if (!h.correct || h.hinted) needs.add(h.word + '\0' + h.mode);
  }
  return {
    player,
    history,
    main,
    independent,
    wrong,
    hinted,
    accuracy: main.length ? Math.round((independent / main.length) * 1000) / 10 : null,
    needs: needs.size,
  };
}
export function commonDifficulties(summaries) {
  const words = new Map();
  for (const s of summaries) {
    for (const word of new Set(s.wrong.map((h) => h.word)))
      words.set(word, (words.get(word) || 0) + 1);
  }
  return [...words].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
}
export function groupRecordAnswers(entries) {
  const groups = new Map();
  for (const h of entries) {
    const key = JSON.stringify([h.word, h.mode, h.answer, h.expected, h.correct, !!h.hinted]);
    if (!groups.has(key)) groups.set(key, { ...h, count: 0, stations: [] });
    const group = groups.get(key);
    group.count++;
    if (!group.stations.includes(h.station ?? 0)) group.stations.push(h.station ?? 0);
  }
  return [...groups.values()];
}
const attendanceOrder = new Intl.Collator('ja', { numeric: true });
export function sortRecordSummaries(summaries, order = 'number') {
  return [...summaries].sort(
    (a, b) =>
      (order === 'attention'
        ? Number(b.needs > 0) - Number(a.needs > 0) || (a.accuracy ?? 101) - (b.accuracy ?? 101)
        : 0) ||
      attendanceOrder.compare(
        String(a.player.label ?? a.player.alias),
        String(b.player.label ?? b.player.alias),
      ),
  );
}

// Bounded by the current roster and four scopes. DB revisions avoid serializing all answers per poll.
export function createRecordStore(summarize = recordSummary) {
  let raceId = null;
  const entries = new Map();
  function summary(id, station = 'all') {
    const entry = entries.get(id);
    if (!entry) return null;
    const scope = String(station);
    if (!entry.scopes.has(scope)) entry.scopes.set(scope, summarize(entry.player, scope));
    return { ...entry.scopes.get(scope), player: entry.player };
  }
  return {
    update(result) {
      const nextRace = result.race?.id ?? null;
      const raceChanged = raceId !== nextRace;
      if (raceChanged) {
        entries.clear();
        raceId = nextRace;
      }
      const changedIds = new Set(),
        ids = new Set();
      for (const player of result.players || []) {
        ids.add(player.id);
        const version =
          typeof player.recordRevision === 'number'
            ? player.recordRevision
            : JSON.stringify(player.history || []);
        const meta = JSON.stringify([
          version,
          player.label,
          player.alias,
          player.score,
          player.done,
        ]);
        const prior = entries.get(player.id);
        if (!prior || prior.meta !== meta) changedIds.add(player.id);
        entries.set(player.id, {
          player,
          version,
          meta,
          scopes: prior?.version === version ? prior.scopes : new Map(),
        });
      }
      for (const id of entries.keys())
        if (!ids.has(id)) {
          entries.delete(id);
          changedIds.add(id);
        }
      return { raceChanged, changedIds, changed: raceChanged || changedIds.size > 0 };
    },
    summary,
    summaries(station = 'all') {
      return [...entries.keys()].map((id) => summary(id, station));
    },
  };
}
// Align insertions and omissions so a missing letter does not mark the whole word wrong.
export function spellingSegments(answer, expected) {
  const a = Array.from(String(answer)),
    b = Array.from(String(expected));
  if (a.length > 240 || b.length > 240) return a.map((char) => ({ char, wrong: true }));
  const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      rows[i][j] =
        a[i].toLowerCase() === b[j].toLowerCase()
          ? 1 + rows[i + 1][j + 1]
          : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const out = [];
  let i = 0,
    j = 0;
  while (i < a.length) {
    if (j < b.length && a[i].toLowerCase() === b[j].toLowerCase()) {
      out.push({ char: a[i++], wrong: false });
      j++;
    } else if (j < b.length && rows[i][j + 1] > rows[i + 1][j]) j++;
    else out.push({ char: a[i++], wrong: true });
  }
  return out;
}
