import { createExerciseController } from '../shared/exercise-controller.js';
export function createPracticeExercises({
  $,
  getState,
  getLesson,
  vocabulary,
  classroom,
  updateSelection,
  saveCurrentDraft,
  effects,
  submit,
  audio,
  volume,
  notify,
}) {
  const host = $('#practice-exercise'),
    hint = $('#practice-exercise-hint');
  let playSerial = 0;
  const controller = createExerciseController({
    host,
    changed: (cue) => {
      updateSelection();
      if (cue) {
        effects.sound(cue);
        effects.pulse(
          host.querySelector('.exercise-sentence-answer .exercise-tile:last-child') ||
            host.querySelector('.exercise-tile.chosen'),
          'letter',
        );
      }
    },
    save: () => saveCurrentDraft(),
    play: (v) => {
      const serial = ++playSerial,
        id = getState().exerciseTask?.id;
      return playWordAudio(audio, { word: v.spoken, audio: v.audio }, volume()).catch(() => {
        if (serial === playSerial && getState().exerciseTask?.id === id && !getState().submitted)
          notify('音声を再生できませんでした。');
      });
    },
    submit,
  });
  let questionId = null;
  hint.onclick = () => {
    const state = getState();
    if (state.submitted || classroom.paused) return;
    state.hintUsed = true;
    state.exerciseTask = course.currentExercise(getLesson(), vocabulary, 1);
    render();
    updateSelection();
    effects.sound('select');
  };
  function set(task, saved) {
    controller.set(task, saved);
    questionId = task.id;
  }
  function render() {
    const state = getState(),
      task = state?.exerciseTask;
    const rich = !!task?.exercise;
    host.hidden = hint.hidden = !rich;
    document.body.classList.toggle('practice-rich', rich);
    document.body.classList.toggle('practice-picture', rich && task.exercise.kind === 'picture');
    if (!rich) return false;
    if (questionId !== task.id) set(task, classroom.draft(task.id)?.exercise);
    const e = task.exercise;
    $('#spelling-panel').hidden = $('.answers-row').hidden = $('.quiz-footer').hidden = true;
    $('#type-label').textContent = e.name;
    $('#try-again').textContent = '次へ';
    $('#lesson-heading').textContent = e.name;
    $('#lesson-instruction').textContent = '自分のペースで挑戦しよう。困ったらヒントも使えます。';
    $('#listening-prompt').hidden = true;
    $('#question-image').hidden = true;
    $('#question-picture').hidden = true;
    $('#question-text').hidden = false;
    $('#question-text').textContent =
      e.kind === 'picture'
        ? '絵に合う英語はどれ？'
        : ['sentence', 'cloze'].includes(task.mode)
          ? task.content.meaning
          : task.mode === 'match'
            ? '英語と日本語をつなごう'
            : '音声を聞いて答えよう';
    $('#question-text').contentEditable = 'false';
    $('#question-text').translate = !['sentence', 'cloze'].includes(task.mode);
    $('#question-text').classList.remove('vocabulary-prompt');
    const voice = e.kind !== 'picture' && !['match', 'audioMatch'].includes(task.mode);
    $('#voice-panel').hidden = $('#audio-timeline').hidden = !voice;
    $('#question-row').classList.toggle('no-voice', !voice);
    hint.disabled = state.submitted || state.hintUsed || classroom.paused;
    hint.textContent = state.hintUsed ? 'ヒントを使用中' : 'ヒントを見る';
    $('.keyboard-note').textContent =
      e.kind === 'match'
        ? '左と右を選んでペアにしよう'
        : e.kind === 'order'
          ? '選んだことばを押すと戻せます'
          : 'Enterで確認';
    controller.render(task, state.submitted || classroom.paused);
    return true;
  }
  return {
    set,
    render,
    ready: controller.ready,
    answer: controller.answer,
    draft: controller.draft,
  };
}
