import { createPracticeAudio } from './practice/audio.js';
import { createResourcePreloader, practiceResourceHints } from './shared/resource-preloader.js';
import { installStudentViewport } from './shared/student-viewport.js';
import { createPracticeSpelling } from './practice/spelling.js';
import { createPracticeChoices } from './practice/choices.js';
import { createPracticeQuestionView } from './practice/question-view.js';
import { createPracticeQuestion } from './practice/question.js';
import { createPracticeFeedback } from './practice/feedback.js';
import { createPracticeScreens } from './practice/screens.js';
import { createPracticeExercises } from './practice/exercises.js';
import { createPracticeNavigation } from './practice/navigation.js';
import { svgMarkup as svg } from './shared/dom.js';
const $ = (s) => document.querySelector(s);
installStudentViewport();
const practicePreloader = createResourcePreloader();
const originalQuestion = 'ate';
const textOptions = ['食べた', '飲んだ', '寝た', '行った'];
let accessRole = null,
  lesson = null,
  studyIndex = 0;
const studyAudio = new Audio();
let state,
  imageTarget,
  toastTimer,
  nextId = 1;

const getState = () => state,
  getLesson = () => lesson,
  getRole = () => accessRole,
  getVocabulary = () => vocabulary;
const { setAudio, playAudio, stopAudio } = createPracticeAudio({
  $,
  getState,
  getVocabulary,
  studyAudio,
  appSettings,
  classroom,
  saveCurrentDraft,
  notify,
  originalQuestion,
});
const { renderSpelling, chooseLetter, removeLetter, undoLetter } = createPracticeSpelling({
  $,
  getState,
  getRole,
  updateSelection,
  saveCurrentDraft,
  classroom,
  interactionEffects,
  spellingAnswer,
  spellingCharacters,
  appendSpellingSlots,
});
const { renderAnswers, selectAnswer } = createPracticeChoices({
  $,
  getState,
  getRole,
  svg,
  notify,
  clearAttempt,
  render: (...args) => render(...args),
  pickImage,
  updateSelection,
  interactionEffects,
});
const { render } = createPracticeQuestionView({
  $,
  getState,
  getLesson,
  getRole,
  getVocabulary,
  nextOptionId: () => nextId++,
  createSpellingLetters,
  renderSpelling,
  renderAnswers,
  updateSelection,
  updateProgress,
  renderRich: () => practiceExercises.render(),
});
const { submit } = createPracticeFeedback({
  $,
  getState,
  getLesson,
  getRole,
  getVocabulary,
  classroom,
  originalQuestion,
  textOptions,
  spellingAnswer,
  spellingCharacters,
  render,
  stopAudio,
  interactionEffects,
  exercises: () => practiceExercises,
});
const practiceExercises = createPracticeExercises({
  $,
  getState,
  getLesson,
  vocabulary,
  classroom,
  updateSelection,
  saveCurrentDraft,
  effects: interactionEffects,
  submit,
  audio: studyAudio,
  volume: () => appSettings.values.voiceVolume / 100,
  notify,
});
const {
  renderStudyCard,
  finishVocabularyQuiz,
  showCourseHome: renderCourseHome,
} = createPracticeScreens({
  $,
  getLesson,
  setLesson: (value) => {
    lesson = value;
  },
  getStudyIndex: () => studyIndex,
  getVocabulary,
  assignedWords,
  assignedUnit,
  spellingAllowed,
  dueReviews,
  startVocabularyQuiz,
  stopAudio,
  clearAttempt,
  svg,
  studyAudio,
  playWordAudio,
  appSettings,
  notify,
  classroom,
  interactionEffects,
});
// Minimal bridge used by the existing classroom session script.
const practiceNavigation = createPracticeNavigation({
  start: (...args) => classroom.start(...args),
  showLesson(saved) {
    stopAudio();
    lesson = saved;
    $('#course-home').hidden = $('#vocab-screen').hidden = $('#lesson-complete').hidden = true;
    $('#quiz-main').hidden = false;
    document.body.classList.remove('studying', 'course-finished', 'on-path');
    if (!lesson.queue.length) finishVocabularyQuiz();
    else showVocabularyQuestion();
  },
  updateBusy: () => updateSelection(),
  onSuperseded() {
    if (!$('#course-home').hidden) renderCourseHome();
  },
});
function showCourseHome() {
  practicePreloader.reset();
  practiceNavigation.cancel();
  renderCourseHome();
}
window.addEventListener('aomi-practice-saved', () => {
  if (!$('#course-home').hidden) renderCourseHome();
});
Object.assign(window, { stopAudio, enterApp, goHome });
const objectURLs = new Set();
function initial(mode = 'text') {
  return {
    mode,
    editing: false,
    voice: true,
    vertical: false,
    multiple: false,
    question: mode === 'picture' ? 'Which picture shows an apple?' : originalQuestion,
    questionImage: null,
    options:
      mode === 'spelling'
        ? [{ id: nextId++, text: originalQuestion, image: null, correct: true }]
        : mode === 'picture'
          ? ['Apple', 'Banana', 'Orange', 'Carrot'].map((n, i) => ({
              id: nextId++,
              text: n,
              image: `assets/${n.toLowerCase()}.png`,
              correct: i === 0,
            }))
          : (mode === 'voice' ? ['ate', 'drank', 'slept', 'went'] : textOptions).map((t, i) => ({
              id: nextId++,
              text: t,
              image: null,
              correct: i === 0,
            })),
    selected: [],
    submitted: false,
    speed: 1,
  };
}
function notify(text, kind = 'wrong') {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  interactionEffects.enter($('#toast'), 'toast');
  interactionEffects.sound(kind);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 3200);
}
function releaseUploads() {
  for (const url of objectURLs) URL.revokeObjectURL(url);
  objectURLs.clear();
}
const savedQuizKey = 'aomiyalingo.quizzes.v1';
function readSavedQuizzes() {
  try {
    return JSON.parse(localStorage.getItem(savedQuizKey) || '{}') || {};
  } catch {
    return {};
  }
}
function validSavedQuiz(quiz) {
  return (
    quiz &&
    typeof quiz.question === 'string' &&
    Array.isArray(quiz.options) &&
    quiz.options.length >= 2 &&
    quiz.options.length <= 6 &&
    quiz.options.every(
      (o) =>
        typeof o.text === 'string' &&
        typeof o.correct === 'boolean' &&
        (!o.image || typeof o.image === 'string'),
    ) &&
    quiz.options.some((o) => o.correct)
  );
}
function loadPreset(mode = 'text', restore = true) {
  stopAudio();
  releaseUploads();
  state = initial(mode);
  const saved = restore ? readSavedQuizzes()[mode] : null;
  if (validSavedQuiz(saved)) {
    state.question = saved.question;
    state.questionImage = saved.questionImage || null;
    state.multiple = !!saved.multiple;
    state.vertical = !!saved.vertical;
    state.voice = mode === 'picture' ? !!saved.voice : true;
    state.options = saved.options.map((o) => ({
      id: nextId++,
      text: o.text,
      correct: o.correct,
      image: o.image || null,
    }));
  }
  state.editing = accessRole === 'teacher';
  setAudio();
  render();
  interactionEffects.enter($('.quiz-shell'));
}
async function durableImage(source) {
  if (!source || !source.startsWith('blob:')) return source;
  const blob = await (await fetch(source)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
async function saveQuiz() {
  if (accessRole !== 'teacher') return;
  if (!state.options.some((o) => o.correct)) {
    notify('正解を少なくとも1つ設定してください');
    return;
  }
  const button = $('#save-quiz');
  button.disabled = true;
  button.textContent = '保存中…';
  const mode = state.mode;
  const snapshot = {
    question: state.question,
    questionImage: state.questionImage,
    multiple: state.multiple,
    vertical: state.vertical,
    voice: state.voice,
    options: state.options.map((o) => ({ text: o.text, correct: o.correct, image: o.image })),
  };
  try {
    snapshot.questionImage = await durableImage(snapshot.questionImage);
    snapshot.options = await Promise.all(
      snapshot.options.map(async (o) => ({ ...o, image: await durableImage(o.image) })),
    );
    const saved = readSavedQuizzes();
    saved[mode] = snapshot;
    localStorage.setItem(savedQuizKey, JSON.stringify(saved));
    notify('保存しました。このブラウザーで続きから編集できます。', 'save');
    interactionEffects.pulse(button, 'success');
  } catch {
    notify('保存できませんでした。画像を小さくして、もう一度お試しください。');
  } finally {
    button.disabled = false;
    button.textContent = '保存';
  }
}
function clearAttempt() {
  state.selected = [];
  state.submitted = false;
  $('#feedback').hidden = true;
  $('.quiz-shell').classList.remove('answered');
}
function setView(editing) {
  if (!accessRole) return;
  if (editing && accessRole !== 'teacher') {
    showTeacherLogin();
    return;
  }
  if (!editing && state.mode === 'spelling' && !/^[a-z]+$/i.test(state.question)) {
    notify('英字だけの単語を入力してください');
    return;
  }
  if (!editing && !state.options.some((o) => o.correct)) {
    notify('正解を少なくとも1つ設定してください');
    return;
  }
  state.editing = editing;
  clearAttempt();
  render();
  interactionEffects.enter($('.quiz-shell'));
}

function updateProgress() {
  if (lesson) {
    const n = lesson.version === 2 ? lesson.roundAnswers : lesson.completed;
    const total =
      lesson.version === 2
        ? n +
          lesson.queue.filter((t) => t.stage === lesson.queue[0]?.stage).length +
          dueReviews(lesson)
        : lesson.total;
    $('#progress-fill').style.width = `${(n / Math.max(1, total)) * 100}%`;
    $('#lesson-progress').setAttribute('aria-valuemax', String(total));
    $('#lesson-progress').setAttribute('aria-valuenow', String(n));
    $('#lesson-counter').textContent = `${n} / ${total}`;
    $('#exercise-tag').textContent =
      lesson.format === 'adaptive-four'
        ? assignedUnit() + ' · ' + (course.exerciseNames[lesson.queue[0]?.mode] || '復習')
        : lesson.queue[0]?.mode === 'spelling'
          ? assignedUnit() + ' · スペリング'
          : lesson.queue[0]?.mode === 'voice'
            ? assignedUnit() + ' · リスニング'
            : assignedUnit() + ' · 単語';
    return;
  }
  $('#lesson-progress').setAttribute('aria-valuemax', '1');
  const done =
    state.submitted &&
    (state.mode === 'spelling'
      ? spellingAnswer(state.letters, state.selected, state.question) ===
        state.question.toLowerCase()
      : state.options.filter((o) => o.correct).length === state.selected.length &&
        state.options.filter((o) => o.correct).every((o) => state.selected.includes(o.id)));
  $('#progress-fill').style.width = done ? '100%' : '8%';
  $('#lesson-progress').setAttribute('aria-valuenow', done ? '1' : '0');
  $('#lesson-counter').textContent = done ? '1 / 1' : '0 / 1';
}

function updateSelection() {
  saveCurrentDraft();
  if (state.exerciseTask?.exercise) {
    practiceExercises.render();
    $('#submit').disabled =
      !practiceExercises.ready() || state.submitted || classroom.paused || classroom.busy;
    $('#submit').textContent = state.submitted ? '確認済み' : '答えを確認';
    $('#selection-note').textContent = practiceExercises.ready()
      ? '答えを確認しよう'
      : '答えを完成させよう';
    return;
  }
  if (state.mode === 'spelling') {
    const count = state.selected.length;
    $('#selection-note').textContent =
      `${count} / ${spellingCharacters(state.question).length}文字`;
    $('#submit').disabled =
      count !== spellingCharacters(state.question).length ||
      state.submitted ||
      state.editing ||
      classroom.paused ||
      classroom.busy;
    $('#submit').textContent = state.submitted ? '確認済み' : '答えを確認';
    return;
  }
  const count = state.selected.length;
  $('#selection-note').textContent = count ? `${count}個の答えを選択中` : '答えを1つ選んでください';
  $('#submit').disabled = !count || state.submitted || classroom.paused || classroom.busy;
  $('#submit').textContent = state.submitted ? '確認済み' : '答えを確認';
}

function pickImage(target) {
  imageTarget = target;
  $('#image-input').value = '';
  $('#image-input').click();
}
$('#image-input').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    notify('画像ファイルを選んでください');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    notify('15 MB未満の画像を選んでください');
    return;
  }
  const url = URL.createObjectURL(file);
  objectURLs.add(url);
  if (imageTarget === 'question') state.questionImage = url;
  else {
    const option = state.options.find((o) => o.id === imageTarget);
    if (option) option.image = url;
  }
  render();
  notify('画像を追加しました', 'save');
};
$('#question-image').onclick = () => pickImage('question');
$('#clear-question-image').onclick = () => {
  state.questionImage = null;
  render();
};
$('#voice-toggle').onclick = () => {
  if (state.mode !== 'picture') return;
  state.voice = !state.voice;
  if (!state.voice) stopAudio();
  render();
};
$('#question-text').oninput = (e) => {
  state.question = e.target.innerText.trim();
  stopAudio();
};
$('#question-text').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
};
$('#back-to-editor').onclick = () => setView(true);
$('#try-button').onclick = () => setView(false);
$('#multiple').onchange = (e) => {
  state.multiple = e.target.checked;
  if (!state.multiple) {
    let found = false;
    state.options.forEach((o) => {
      if (o.correct && !found) found = true;
      else o.correct = false;
    });
  }
  clearAttempt();
  render();
};
$('#layout').onclick = () => {
  state.vertical = !state.vertical;
  render();
  interactionEffects.enter($('#answers'));
};
$('#add-answer').onclick = () => {
  if (state.options.length >= 6) return;
  state.options.push({ id: nextId++, text: '新しい選択肢を入力', image: null, correct: false });
  clearAttempt();
  render();
  interactionEffects.enter($('#answers').lastElementChild);
};
$('#reset').onclick = () => {
  loadPreset(state.mode, false);
  notify('サンプルをリセットしました', 'navigate');
};
$('#restart-lesson').onclick = () => {
  if (lesson) {
    startVocabularyQuiz(lesson.practiceMode, true);
    return;
  }
  loadPreset(state.mode);
};
document
  .querySelectorAll('[data-mode]')
  .forEach((b) => (b.onclick = () => loadPreset(b.dataset.mode)));
$('#submit').onclick = submit;
$('#try-again').onclick = () => {
  if (lesson) {
    const saved = classroom.takeLesson();
    if (!saved) return;
    lesson = saved;
    if (lesson.lastRound || !lesson.queue.length) finishVocabularyQuiz();
    else showVocabularyQuestion();
    return;
  }
  clearAttempt();
  render();
};
document.addEventListener('keydown', (e) => {
  if (
    classroom.paused ||
    $('#settings-dialog').open ||
    !accessRole ||
    $('#quiz-main').hidden ||
    state.editing ||
    e.target.isContentEditable ||
    e.target.tagName === 'INPUT' ||
    (e.target.tagName === 'BUTTON' && state.mode !== 'spelling')
  )
    return;
  if (state.mode === 'spelling') {
    if (state.submitted) return;
    if (/^[a-z]$/i.test(e.key)) {
      const index = state.letters.findIndex(
        (letter, i) => letter === e.key.toLowerCase() && !state.selected.includes(i),
      );
      if (index >= 0) {
        e.preventDefault();
        chooseLetter(index);
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undoLetter();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= state.options.length) {
    e.preventDefault();
    selectAnswer(state.options[n - 1].id);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    submit();
  }
});
window.addEventListener('pagehide', () => {
  stopAudio();
  releaseUploads();
});
loadPreset();
function showTeacherLogin() {
  $('#teacher-login').hidden = false;
  $('#teacher-entry').setAttribute('aria-expanded', 'true');
  $('#login-error').hidden = true;
  interactionEffects.enter($('#teacher-login'));
  $('#teacher-password').focus();
}
function enterApp(role) {
  if (role !== 'student') return;
  practiceNavigation.cancel();
  lesson = null;
  stopAudio();
  accessRole = role;
  clearAttempt();
  state.editing = role === 'teacher';
  $('#student-welcome').hidden = true;
  $('#start-screen').hidden = true;
  $('#quiz-main').hidden = false;
  document.body.classList.remove('at-home');
  $('#teacher-password').value = '';
  $('#teacher-login').hidden = true;
  $('#teacher-entry').setAttribute('aria-expanded', 'false');
  render();
  if (role === 'student') {
    showCourseHome();
    return;
  }
  interactionEffects.enter($('#quiz-main'));
  $('#lesson-heading').tabIndex = -1;
  $('#lesson-heading').focus();
}
function goHome() {
  stopAudio();
  if (classroom.current) {
    showCourseHome();
  } else {
    classroom.openJoin();
  }
  return;
}
$('#student-entry').onclick = () => classroom.openJoin();
$('.brand').href = location.pathname + location.search;
$('.brand').setAttribute('aria-label', 'レッスン一覧');
$('.brand').onclick = (e) => {
  e.preventDefault();
  goHome();
};
$('#home-button').onclick = goHome;
$('#save-quiz').onclick = saveQuiz;
function assignedUnit() {
  return curriculumLabel(classroom.current?.lesson?.grade, classroom.current?.lesson?.unit).replace(
    'Unit',
    'UNIT',
  );
}
function assignedWords() {
  const list = classroom.current?.lesson?.learnWords;
  return list?.length ? vocabulary.filter((w) => list.includes(w.word)) : vocabulary;
}
function spellingAllowed() {
  return (classroom.current?.lesson?.enabledModes || ['text', 'voice', 'spelling']).includes(
    'spelling',
  );
}
function showStudyCards() {
  practiceNavigation.cancel();
  stopAudio();
  $('#course-home').hidden = true;
  studyIndex = 0;
  $('#quiz-main').hidden = true;
  $('#lesson-complete').hidden = true;
  $('#vocab-screen').hidden = false;
  document.body.classList.add('studying');
  document.body.classList.remove('course-finished', 'practice-picture', 'practice-rich');
  $('#study-spelling').hidden = !spellingAllowed();
  $('#study-flow').textContent =
    classroom.current?.lesson?.format === 'adaptive-four'
      ? 'ことば → 文づくり → リスニング。1回に少しずつ、苦手なところはあとでもう一度。'
      : (classroom.current?.lesson?.enabledModes || ['text', 'voice', 'spelling'])
          .map((m) => ({ text: '単語', voice: 'リスニング', spelling: 'スペリング' })[m])
          .join(' → ') + '。間違えた単語は、あとでもう一度。';
  $('#vocab-screen .exercise-tag').textContent =
    assignedUnit() + ' · ' + assignedWords().length + ' WORDS';
  renderStudyCard();
  interactionEffects.enter($('#vocab-screen'));
}

async function startVocabularyQuiz(practiceMode = null, reset = false, review = false) {
  return practiceNavigation.start(practiceMode, reset, review);
}
function showVocabularyQuestion() {
  practicePreloader.warm(practiceResourceHints(lesson, vocabulary));
  stopAudio();
  clearAttempt();
  state = createPracticeQuestion({
    task: lesson.queue[0],
    vocabulary,
    initial,
    shuffleWords,
    nextOptionId: () => nextId++,
    getDraft: (id) => classroom.draft(id),
  });
  const task = course.currentExercise(lesson, vocabulary, state.hintUsed ? 1 : 0);
  if (task?.exercise) {
    state.exerciseTask = task;
    state.options = [];
    practiceExercises.set(task, classroom.draft(task.id)?.exercise);
  }
  setAudio();
  render();
  interactionEffects.enter($('.quiz-shell'));
  interactionEffects.enter($('#progress-fill'), 'progress');
  $('#lesson-heading').tabIndex = -1;
  $('#lesson-heading').focus();
}

$('#study-prev').onclick = () => {
  if (studyIndex > 0) {
    studyIndex--;
    renderStudyCard(-1);
  }
};
$('#study-next').onclick = () => {
  if (studyIndex < assignedWords().length - 1) {
    studyIndex++;
    renderStudyCard();
  } else startVocabularyQuiz();
};
$('#study-start').onclick = () => startVocabularyQuiz();
$('#study-spelling').onclick = () => startVocabularyQuiz('spelling');
$('#study-audio').onclick = async () => {
  stopAudio();
  const word = assignedWords()[studyIndex];
  try {
    await playWordAudio(studyAudio, word, appSettings.values.voiceVolume / 100);
  } catch {
    notify('音声を再生できませんでした。もう一度お試しください。');
  }
};
$('#course-again').onclick = () => {
  if (lesson?.queue.length) showCourseHome();
  else startVocabularyQuiz(lesson?.practiceMode === 'review' ? null : lesson?.practiceMode, true);
};
$('#complete-home').onclick = showCourseHome;
const quizContext = document.modelContext || navigator.modelContext;
if (quizContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name: 'read_quiz',
      description: 'Read the visible question, options, and current editor or student state.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () =>
        !accessRole
          ? { screen: 'home' }
          : !$('#vocab-screen').hidden
            ? {
                screen: 'study',
                word: $('#study-word').textContent,
                meaning: $('#study-meaning').textContent,
              }
            : !$('#lesson-complete').hidden
              ? { screen: 'complete', result: $('#complete-stats').textContent }
              : {
                  mode: state.mode,
                  editing: state.editing,
                  question:
                    state.mode === 'voice' && !state.editing && !state.submitted
                      ? null
                      : state.question,
                  multiple: state.multiple,
                  options:
                    state.mode === 'spelling'
                      ? state.letters.map((text, i) => ({
                          number: i + 1,
                          text,
                          selected: state.selected.includes(i),
                        }))
                      : state.options.map((o, i) => ({
                          number: i + 1,
                          text: o.text,
                          selected: state.selected.includes(o.id),
                        })),
                  submitted: state.submitted,
                },
    },
    {
      name: 'start_quiz_attempt',
      description: 'Switch the visible quiz from editing to student answer mode.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: () => {
        if ($('#settings-dialog').open || !accessRole || $('#quiz-main').hidden)
          throw Error('Start the quiz through the visible interface first');
        if (!state.options.some((o) => o.correct)) throw Error('No correct answer configured');
        setView(false);
        return {
          editing: state.editing,
          question:
            state.mode === 'voice' && !state.editing && !state.submitted ? null : state.question,
        };
      },
    },
    {
      name: 'select_quiz_answers',
      description:
        'Select numbered options in the current unsubmitted student attempt; does not submit.',
      inputSchema: {
        type: 'object',
        properties: {
          numbers: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1 },
        },
        required: ['numbers'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        if (
          $('#settings-dialog').open ||
          !accessRole ||
          $('#quiz-main').hidden ||
          state.editing ||
          state.submitted
        )
          throw Error('Start a new student attempt first');
        if (state.mode === 'spelling') throw Error('Use the visible letter buttons for spelling');
        if (
          !Array.isArray(input.numbers) ||
          !input.numbers.length ||
          input.numbers.some((n) => !Number.isInteger(n) || n < 1 || n > state.options.length) ||
          (!state.multiple && input.numbers.length !== 1)
        )
          throw Error('Invalid option numbers');
        state.selected = [...new Set(input.numbers)].map((n) => state.options[n - 1].id);
        render();
        return { selected: input.numbers };
      },
    },
    {
      name: 'submit_quiz_answers',
      description: 'Submit the selected student answers and display correctness feedback.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: () => {
        if (
          classroom.paused ||
          $('#settings-dialog').open ||
          !accessRole ||
          $('#quiz-main').hidden ||
          state.editing ||
          state.submitted ||
          !state.selected.length
        )
          throw Error('Select answers in a new student attempt first');
        submit();
        return { submitted: true, feedback: $('#feedback-title').textContent };
      },
    },
  ];
  for (const tool of tools)
    try {
      Promise.resolve(quizContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}

// Classroom QR opens the student lesson immediately.
classroom.openJoin();

function saveCurrentDraft() {
  if (!lesson || !state || state.submitted || !lesson.queue[0]) return;
  classroom.saveDraft({
    questionId: lesson.queue[0].id,
    choices: state.options.map((o) => o.text),
    answers: state.options.filter((o) => state.selected.includes(o.id)).map((o) => o.text),
    letters: state.letters || [],
    selected: state.selected,
    hintUsed: !!state.hintUsed,
    hintShown: !!state.hintShown,
    ...(state.exerciseTask?.exercise ? { exercise: practiceExercises.draft() } : {}),
  });
}

$('#open-wordbook').onclick = () => {
  document.body.classList.remove('on-path');
  showStudyCards();
};
$('#extra-spelling').onclick = () => {
  document.body.classList.remove('on-path');
  startVocabularyQuiz('spelling', true);
};

function dueReviews(l) {
  if (!l?.queue?.length) return 0;
  const stage = l.queue[0].stage;
  if (!l.queue.some((t) => t.stage === stage && !t.review)) return 0;
  return Math.min(
    2,
    (l.pendingReview || []).filter(
      (t) => l.reviewPolicy !== 'spaced' || (t.dueStage || t.stage) <= stage || stage === l.rounds,
    ).length,
  );
}

$('#review-selected').onclick = () => startVocabularyQuiz(null, false, true);
$('#path-review').onclick = () => startVocabularyQuiz(null, false, true);
