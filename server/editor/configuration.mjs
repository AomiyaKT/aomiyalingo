import { gradeSixContent } from './grade6-content.mjs';
import { allCurriculumProfiles, curriculumCatalog } from '../../public/shared/curriculum.js';

function editableWord(word, recorded = true) {
  return {
    ...word,
    base: word.base || '',
    example: word.example || '',
    ...(recorded
      ? { audio: '/assets/words/' + word.word.toLowerCase().replaceAll(' ', '-') + '.wav' }
      : {}),
    enabled: true,
    distractors: [],
  };
}

function defaultProfile(source, { format, recorded = true } = {}) {
  const ids = source.map((word) => word.word);
  return {
    unit5Supplement: 1,
    words: source.map((word) => editableWord(word, recorded)),
    course: {
      wordIds: ids.slice(),
      modes: ['text', 'voice', 'spelling'],
      roundSize: 6,
      ...(format ? { format } : {}),
    },
    race: {
      wordIds: ids.slice(),
      modes: ['text', 'voice', 'spelling'],
      ...(format ? { format } : {}),
      questions: 24,
      minutes: 6,
      countdown: 3,
      itemEvery: 6,
      itemVersion: 2,
      order: 'mixed',
      items: ['hint', 'boost', 'review', 'compass', 'double', 'lucky'],
      streakStep: 20,
      streakCap: 100,
      correctPoints: 100,
      hintPoints: 70,
      reviewPoints: 60,
      boostPoints: 40,
      boostCount: 2,
      goalPercent: 50,
    },
  };
}

const builtInPictures = Object.fromEntries(
  [5, 7].map((unit) => [unit, new Map(gradeSixContent[unit].map((w) => [w.word, w.image]))]),
);
function addBuiltInPictures(profile, images) {
  for (const word of profile.words) {
    // Explicit null is a teacher's decision to omit a picture.
    if (word.image === undefined && images.has(word.word)) word.image = images.get(word.word);
  }
}

export function createConfigurationStore({
  words,
  gradeFiveVocabulary,
  unitSevenVocabulary,
  stmt,
}) {
  // Source banks are read-only; each load gets independent editable objects and arrays.
  const profiles = Object.values(curriculumCatalog)
    .filter((entry) => entry.key)
    .map((entry) => ({
      key: entry.key,
      source:
        entry.grade === 5
          ? gradeFiveVocabulary
          : entry.unit === '7'
            ? unitSevenVocabulary
            : gradeSixContent[entry.unit],
      options:
        entry.grade === 6 && entry.unit !== '7' ? { format: 'adaptive-four', recorded: false } : {},
    }));
  function supplementUnitFive(config) {
    if (config.unit5Supplement) return config;
    const added = words.filter((w) => w.group === 'phrase'),
      oldDefaults = words.filter((w) => w.group !== 'phrase').map((w) => w.word);
    for (const key of ['course', 'race'])
      if (
        config[key].wordIds.length === oldDefaults.length &&
        oldDefaults.every((w) => config[key].wordIds.includes(w))
      )
        config[key].wordIds.push(
          ...added.map((w) => w.word).filter((w) => !config[key].wordIds.includes(w)),
        );
    for (const w of added)
      if (!config.words.some((x) => x.word === w.word)) config.words.push(editableWord(w));
    config.unit5Supplement = 1;
    return config;
  }
  async function loadConfig(env) {
    const row = await stmt(env, 'SELECT data,revision FROM app_config WHERE id=1').first();
    const config = row ? JSON.parse(row.data) : defaultProfile(words);
    supplementUnitFive(config);
    for (const { key, source, options } of profiles)
      config[key] ??= defaultProfile(source, options);
    addBuiltInPictures(config, builtInPictures[5]);
    addBuiltInPictures(config.unit7, builtInPictures[7]);
    config.race.order ??= 'mixed';
    if (!config.race.itemVersion) {
      if (
        config.race.items.length === 3 &&
        ['hint', 'boost', 'review'].every((i) => config.race.items.includes(i))
      )
        config.race.items.push('compass', 'double', 'lucky');
      config.race.itemVersion = 2;
    }
    for (const profile of allCurriculumProfiles(config)) {
      profile.race.streakStep ??= 20;
      profile.race.streakCap ??= 100;
    }
    return { config, revision: row?.revision || 0 };
  }

  return { loadConfig, supplementUnitFive };
}
