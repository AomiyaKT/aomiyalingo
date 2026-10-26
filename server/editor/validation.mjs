import { curriculumProfileKeys } from '../../public/shared/curriculum.js';

function configError(message) {
  throw Object.assign(Error(message), { configuration: true });
}
export function validateConfig(c) {
  if (!c || !Array.isArray(c.words) || c.words.length < 4 || c.words.length > 80)
    configError('単語は4〜80語にしてください。');
  const seen = new Set(),
    meaning = new Set();
  for (const w of c.words) {
    if (
      !w ||
      !/^[a-z]+(?:['’][a-z]*)?(?:[ -][a-z]+(?:['’][a-z]*)?)*$/i.test(w.word) ||
      w.word.length > 40 ||
      seen.has(w.word.toLowerCase())
    )
      configError(
        '英語は重複しない半角英字・空白・ハイフン・アポストロフィ（1〜40文字）にしてください。',
      );
    seen.add(w.word.toLowerCase());
    if (
      w.image != null &&
      !(
        typeof w.image === 'string' &&
        /^\/assets\/vocabulary\/g6-unit[1-8]\/[0-9]{2}_[a-z0-9_]+\.png$/.test(w.image)
      )
    )
      configError('単語の画像を確認してください。');
    if (w.pictureEnabled !== undefined && typeof w.pictureEnabled !== 'boolean')
      configError('画像問題の使用設定を確認してください。');
    if (
      typeof w.meaning !== 'string' ||
      !w.meaning.trim() ||
      w.meaning.length > 100 ||
      meaning.has(w.meaning)
    )
      configError('日本語の意味は重複しない1〜100文字にしてください。');
    meaning.add(w.meaning);
    if (
      !['verb', 'adjective', 'family', 'occupation', 'phrase', 'other'].includes(w.group) ||
      typeof w.enabled !== 'boolean'
    )
      configError('単語の種類と使用設定を確認してください。');
    for (const field of ['base', 'example'])
      if (typeof w[field] !== 'string' || w[field].length > 200)
        configError('原形・例文は200文字以内にしてください。');
    if (
      !Array.isArray(w.distractors) ||
      w.distractors.length > 3 ||
      w.distractors.some(
        (x) => typeof x !== 'string' || !x.trim() || x.length > 100 || x === w.meaning,
      ) ||
      new Set(w.distractors).size !== w.distractors.length
    )
      configError('不正解の選択肢は、異なる日本語で最大3つまでです。');
    if (
      w.audio !== null &&
      !(
        typeof w.audio === 'string' &&
        (/^\/assets\/words\/[a-z]+(?:-[a-z]+)*\.wav$/.test(w.audio) ||
          /^\/api\/audio\/[0-9a-f-]{36}$/.test(w.audio))
      )
    )
      configError('音声をアップロードするか、端末の読み上げを選んでください。');
  }
  const enabled = c.words.filter((w) => w.enabled).map((w) => w.word);
  if (enabled.length < 4) configError('使用する単語を4語以上選んでください。');
  for (const key of ['course', 'race']) {
    const x = c[key];
    if (
      !x ||
      !Array.isArray(x.wordIds) ||
      x.wordIds.length < 4 ||
      new Set(x.wordIds).size !== x.wordIds.length ||
      x.wordIds.some((w) => !enabled.includes(w))
    )
      configError('練習とレースに、それぞれ使用する単語を4語以上選んでください。');
    if (
      !Array.isArray(x.modes) ||
      !x.modes.length ||
      new Set(x.modes).size !== x.modes.length ||
      x.modes.some((m) => !['text', 'voice', 'spelling'].includes(m))
    )
      configError('問題の種類を1つ以上選んでください。');
  }
  if (![4, 6, 8, 10].includes(c.course.roundSize))
    configError('1レッスンは4・6・8・10問から選んでください。');
  c.race.streakStep ??= 20;
  if (c.course.format !== undefined && !['adaptive-four', 'classic'].includes(c.course.format))
    configError('練習の構成を確認してください。');
  if (c.race.format !== undefined && !['adaptive-four', 'classic'].includes(c.race.format))
    configError('問題の構成を確認してください。');
  c.race.streakCap ??= 100;
  const bounds = {
    streakStep: [0, 100],
    streakCap: [0, 500],
    questions: [6, 60],
    minutes: [1, 20],
    countdown: [0, 10],
    itemEvery: [3, 20],
    correctPoints: [10, 500],
    hintPoints: [0, 500],
    reviewPoints: [0, 500],
    boostPoints: [0, 200],
    boostCount: [1, 5],
    goalPercent: [10, 100],
  };
  for (const [k, [min, max]] of Object.entries(bounds))
    if (!Number.isInteger(c.race[k]) || c.race[k] < min || c.race[k] > max)
      configError('レースの数値が設定範囲外です。');
  if (c.race.hintPoints > c.race.correctPoints || c.race.reviewPoints > c.race.correctPoints)
    configError('ヒント・復習の得点は通常の正解以下にしてください。');
  if (
    !Array.isArray(c.race.items) ||
    new Set(c.race.items).size !== c.race.items.length ||
    c.race.items.some((i) => !['hint', 'boost', 'review', 'compass', 'double', 'lucky'].includes(i))
  )
    configError('道具の種類を確認してください。');
  if (c.race.order !== undefined && !['mixed', 'grouped'].includes(c.race.order))
    configError('問題の順番を確認してください。');
  for (const key of curriculumProfileKeys)
    if (c[key]) {
      if (curriculumProfileKeys.some((nested) => c[key][nested]))
        configError('教材の設定を確認してください。');
      validateConfig(c[key]);
    }
  c.race.itemVersion = 2;
  return c;
}
