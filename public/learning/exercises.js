// Version 6 tasks are immutable seeds. Materialization depends only on completed
// answers, never on polling frequency, elapsed time, ranking, or item hints.
export const stationModes = [
  ['text', 'match', 'spelling', 'voice'],
  ['sentence', 'cloze', 'audioMatch', 'audioSentence'],
  ['sentence', 'cloze', 'audioCloze', 'dictation'],
];
export const exerciseNames = {
  text: '単語の意味',
  match: 'ことばのペア',
  spelling: 'スペリング',
  voice: '音を聞いて選ぶ',
  sentence: '文を組み立てる',
  cloze: '文の穴うめ',
  audioMatch: '音のペア',
  audioSentence: '聞いて文を作る',
  audioCloze: '聞いて穴うめ',
  dictation: '聞いて書く',
};
export const normalizeAnswer = (value) =>
  String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[.,!?"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
function seedOrder(values, seed) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    const j = (n >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function pairId(seed) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return 'p' + n.toString(36);
}
export function learnerLevel(history, station) {
  if (station === 0) return 1;
  let count = 0,
    correct = 0;
  for (let i = history.length - 1; i >= 0 && count < 8; i--) {
    const answer = history[i];
    if (answer.review) continue;
    count++;
    if (answer.correct && !answer.hinted) correct++;
  }
  if (count < 4) return 1;
  const independent = correct / count;
  return independent >= 0.8 ? Math.min(3, station + 1) : independent >= 0.6 ? 2 : 1;
}
export function sentenceFor(word) {
  const example = String(word.example || '').trim();
  // Custom examples that do not contain the vocabulary cannot form a valid gap.
  // A quoted-word sentence is an explicit, grammatical fallback for such entries.
  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('\\b' + escaped + '\\b', 'i');
  const sentence =
    example && /^[a-z\s.,!?"'’\-]+$/i.test(example) && pattern.test(example)
      ? example
      : 'The word is "' + word.word + '".';
  const match = pattern.exec(sentence);
  return {
    sentence,
    before: sentence.slice(0, match.index),
    after: sentence.slice(match.index + match[0].length),
    answer: match[0],
  };
}
export function materializeExercise(task, state, pool) {
  if (task.rules !== 6) return task;
  const w = task.content,
    mode = task.mode,
    level = learnerLevel(state.history, task.station);
  const base = { ...task, level };
  const picture = mode === 'text' && w.image && w.pictureEnabled !== false;
  if (['text', 'voice', 'spelling'].includes(mode) && !picture) return base;
  const peers = seedOrder(
    pool.filter((v) => v.word !== w.word),
    task.id,
  );
  const sentence = sentenceFor(w);
  const hint = state.hintFor === task.id ? state.hintStrength || 1 : 0;
  const e = {
    name: exerciseNames[mode],
    level,
    cue: mode === 'audioCloze' && level === 1 ? w.meaning : '',
    instruction: '',
    hint: '',
  };
  let solution;
  if (picture) {
    e.kind = 'picture';
    e.name = '絵を見て選ぶ';
    e.instruction = '絵に合う英語を選ぼう。';
    e.image = w.image;
    e.choices = seedOrder([w.word, ...peers.slice(0, 3).map((v) => v.word)], task.id + ':picture');
    e.hint = hint ? '意味のヒント：' + w.meaning : '';
    solution = base.expected = w.word;
  } else if (mode === 'match' || mode === 'audioMatch') {
    e.kind = 'match';
    e.instruction =
      mode === 'audioMatch' ? '音を聞いて、英語のペアを選ぼう。' : '英語と日本語のペアを選ぼう。';
    const pairs = [w, ...peers.slice(0, level === 1 ? 1 : 2)];
    const leftId = (i) => pairId(task.id + ':left:' + i),
      rightId = (i) => pairId(task.id + ':right:' + i);
    const right = seedOrder(
      pairs.map((v, i) => ({ id: rightId(i), value: mode === 'audioMatch' ? v.word : v.meaning })),
      task.id + ':right',
    );
    e.left = seedOrder(
      pairs.map((v, i) => ({
        id: leftId(i),
        value: mode === 'audioMatch' ? '音声 ' + (i + 1) : v.word,
        ...(mode === 'audioMatch' ? { spoken: v.word, audio: v.audio ?? null } : {}),
      })),
      task.id + ':left',
    );
    e.right = right;
    solution = pairs.map((v, i) => [leftId(i), rightId(i)]);
    e.hint = hint
      ? 'ペアのヒント：' +
        solution
          .slice(0, hint)
          .map(
            ([l, r]) =>
              e.left.find((v) => v.id === l).value + ' → ' + right.find((v) => v.id === r).value,
          )
          .join(' / ')
      : '';
    base.expected = pairs
      .map((v) => v.word + ' → ' + (mode === 'audioMatch' ? v.word : v.meaning))
      .join(' / ');
  } else if (mode === 'sentence' || mode === 'audioSentence') {
    e.kind = 'order';
    e.instruction =
      mode === 'audioSentence'
        ? '音声と同じ文になるように並べよう。'
        : 'ことばを並べて、文を作ろう。';
    const words = sentence.sentence.split(/\s+/);
    const chunks =
      level === 1 && words.length > 3 ? [words.slice(0, 2).join(' '), ...words.slice(2)] : words;
    e.tokens = seedOrder(
      chunks.map((value, i) => ({ id: pairId(task.id + ':token:' + i), value })),
      task.id + ':tokens',
    );
    e.slots = chunks.length;
    if (level === 3) {
      const extras = ['not', 'very', 'always', 'can']
        .filter((v) => !words.some((x) => normalizeAnswer(x) === v))
        .slice(0, 2);
      e.tokens = seedOrder(
        [
          ...e.tokens,
          ...extras.map((value, i) => ({ id: pairId(task.id + ':distractor:' + i), value })),
        ],
        task.id + ':extra',
      );
      e.instruction += '使わないことばもあるよ。';
    }
    solution = sentence.sentence;
    e.hint = hint ? '文の始まり：' + chunks.slice(0, hint).join(' ') : '';
    base.expected = sentence.sentence;
  } else {
    const dictation = mode === 'dictation';
    e.kind = dictation ? 'dictation' : 'cloze';
    e.instruction = dictation
      ? '聞こえた英語を書こう。'
      : mode === 'audioCloze'
        ? '文を聞いて、空いていることばを入れよう。'
        : '意味に合うことばを入れよう。';
    e.before = dictation ? '' : sentence.before;
    e.after = dictation ? '' : sentence.after;
    solution = dictation ? w.word : sentence.answer;
    base.expected = solution;
    if (dictation && level < 3) {
      e.kind = 'order';
      e.separator = '';
      e.slots = solution.length;
      e.tokens = seedOrder(
        [...solution].map((value, i) => ({ id: pairId(task.id + ':char:' + i), value })),
        task.id + ':letters',
      );
      e.instruction = '音を聞いて、文字を順番に選ぼう。';
      if (level === 1) e.hint = '意味のヒント：' + w.meaning;
    } else if (level < 3) {
      // Choices are full vocabulary expressions, including multiword phrases.
      e.choices = seedOrder(
        [solution, ...peers.slice(0, level === 1 ? 1 : 3).map((v) => v.word)],
        task.id + ':choices',
      );
      if (dictation && level === 1) e.hint = '意味のヒント：' + w.meaning;
    }
    e.placeholder = dictation ? '聞こえた英語を入力' : '英語を入力';
    if (hint) e.hint = '最初の文字：' + solution.slice(0, hint);
  }
  base.exercise = e;
  base.solution = solution;
  const sentenceAudio = ['audioSentence', 'audioCloze'].includes(mode);
  base.exerciseAudio = picture
    ? { spoken: null, audio: null }
    : sentenceAudio
      ? { spoken: sentence.sentence, audio: null }
      : { spoken: w.word, audio: w.audio ?? null };
  return base;
}
export function gradeExercise(task, raw) {
  const e = task.exercise;
  if (typeof raw !== 'string' || raw.length > 2000) return { valid: false };
  if (e.kind === 'match') {
    let pairs;
    try {
      pairs = JSON.parse(raw);
    } catch {
      return { valid: false };
    }
    if (
      !Array.isArray(pairs) ||
      pairs.length !== e.left.length ||
      pairs.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          !e.left.some((x) => x.id === p[0]) ||
          !e.right.some((x) => x.id === p[1]),
      ) ||
      new Set(pairs.map((p) => p[0])).size !== pairs.length ||
      new Set(pairs.map((p) => p[1])).size !== pairs.length
    )
      return { valid: false };
    return {
      valid: true,
      correct: pairs.every(([l, r]) => task.solution.some(([a, b]) => a === l && b === r)),
      answer: pairs
        .map(
          ([l, r]) =>
            e.left.find((x) => x.id === l).value + ' → ' + e.right.find((x) => x.id === r).value,
        )
        .join(' / '),
    };
  }
  if (e.kind === 'order') {
    let ids;
    try {
      ids = JSON.parse(raw);
    } catch {
      return { valid: false };
    }
    if (
      !Array.isArray(ids) ||
      ids.length !== e.slots ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !e.tokens.some((t) => t.id === id))
    )
      return { valid: false };
    const answer = ids
      .map((id) => e.tokens.find((t) => t.id === id).value)
      .join(e.separator ?? ' ');
    return {
      valid: true,
      correct: normalizeAnswer(answer) === normalizeAnswer(task.solution),
      answer,
    };
  }
  if (!raw.trim() || raw.length > 200 || (e.choices && !e.choices.includes(raw)))
    return { valid: false };
  return {
    valid: true,
    correct: normalizeAnswer(raw) === normalizeAnswer(task.solution),
    answer: raw.trim(),
  };
}
