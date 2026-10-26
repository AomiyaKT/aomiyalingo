import { lessonEngine } from './lesson.js';
import { exerciseNames, stationModes, materializeExercise, gradeExercise } from './exercises.js';
const basicModes = ['text', 'voice', 'spelling'];
const allModes = Object.keys(exerciseNames);
export function practiceSettings(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (value?.format === 'adaptive-four') return { format: 'adaptive-four', modes: allModes };
    return { format: 'classic', modes: Array.isArray(value) && value.length ? value : basicModes };
  } catch {
    return { format: 'classic', modes: basicModes };
  }
}
export function createStepUp(words, roundSize = 6) {
  const lesson = lessonEngine.create(words, ['text'], roundSize);
  const terms = lesson.queue.map((t) => t.word);
  const tasks = stationModes.flatMap((modes, band) =>
    terms.map((word, i) => ({
      id: crypto.randomUUID(),
      word,
      band,
      mode: modes[(i + band) % modes.length],
      review: false,
    })),
  );
  return {
    ...lesson,
    format: 'adaptive-four',
    recentAnswers: [],
    queue: tasks.map((t, i) => ({ ...t, stage: Math.floor(i / roundSize) + 1 })),
    total: tasks.length,
    rounds: Math.ceil(tasks.length / roundSize),
    enabledModes: allModes,
  };
}
export function currentExercise(lesson, words = lesson.vocabulary, hint = 0) {
  const task = lesson.queue[0];
  if (!task || lesson.format !== 'adaptive-four') return null;
  return materializeExercise(
    {
      ...task,
      rules: 6,
      station: task.band || 0,
      content: words.find((w) => w.word === task.word),
    },
    {
      history: lesson.recentAnswers || [],
      hintFor: hint ? task.id : null,
      hintStrength: hint,
    },
    words,
  );
}
export function stepUpReview(previous, words, roundSize = 6) {
  const l = createStepUp(words, roundSize);
  l.queue = (previous.needsReview || [])
    .map((key, i) => {
      const [word, mode] = key.split(':');
      return {
        id: crypto.randomUUID(),
        word,
        mode,
        band: 2,
        stage: Math.floor(i / roundSize) + 1,
        review: false,
      };
    })
    .filter((t) => allModes.includes(t.mode) && words.some((w) => w.word === t.word));
  l.total = l.queue.length;
  l.rounds = Math.ceil(l.total / roundSize);
  l.practiceMode = 'review';
  l.needsReview = [...(previous.needsReview || [])];
  return l;
}
export const practiceEngine = {
  practiceSettings,
  createStepUp,
  currentExercise,
  stepUpReview,
  exerciseNames,
  gradeExercise,
};
