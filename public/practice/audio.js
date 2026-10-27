export function createPracticeAudio({
  $,
  getState,
  getVocabulary,
  studyAudio,
  appSettings,
  classroom,
  saveCurrentDraft,
  notify,
  originalQuestion,
}) {
  const audio = new Audio();
  let speechActive = false,
    playbackSerial = 0,
    activeUtterance = null;
  function releaseUtterance() {
    if (!activeUtterance) return;
    activeUtterance.onend = activeUtterance.onerror = null;
    activeUtterance = null;
  }
  function applyVoiceVolume() {
    audio.volume = studyAudio.volume = appSettings.values.voiceVolume / 100;
  }
  applyVoiceVolume();
  window.addEventListener('aomiyalingo-settings', applyVoiceVolume);
  function stopAudio() {
    playbackSerial++;
    releaseUtterance();
    studyAudio.pause();
    audio.pause();
    window.speechSynthesis?.cancel();
    speechActive = false;
    updatePlayer(false);
  }
  function setAudio() {
    const state = getState(),
      vocabulary = getVocabulary();
    if (state.exerciseTask?.exercise) {
      const src = state.exerciseTask.exerciseAudio;
      if (src.audio === null) audio.removeAttribute('src');
      else audio.src = src.audio;
      audio.playbackRate = state.speed;
      $('#audio-progress').value = 0;
      $('#audio-time').textContent = '0:00';
      $('#audio-duration').textContent = src.audio === null ? '音声' : '0:00';
      return;
    }
    const word = vocabulary.find((v) => v.word === state.question);
    if (word?.audio === null) audio.removeAttribute('src');
    else
      audio.src = word
        ? word.audio || `assets/words/${state.question}.wav`
        : state.mode === 'picture'
          ? 'assets/apple.wav'
          : 'assets/ate.wav';
    audio.playbackRate = state.speed;
    $('#audio-progress').value = 0;
    $('#audio-time').textContent = '0:00';
    audio.load();
  }
  function updatePlayer(playing) {
    $('#audio-play').classList.toggle('is-playing', playing);
    $('#audio-play').setAttribute('aria-label', playing ? '音声を一時停止' : '音声を再生');
    $('#voice-caption').textContent = playing
      ? '再生中 · よく聞いてね'
      : '音声を聞いてから答えましょう';
  }
  async function playAudio() {
    const state = getState(),
      vocabulary = getVocabulary();
    if (classroom.paused) return;
    if (
      (state.mode === 'spelling' || (state.exerciseTask?.exercise && state.mode === 'cloze')) &&
      !state.submitted
    ) {
      state.hintUsed = true;
      saveCurrentDraft();
    }
    if (!audio.paused || speechActive) {
      stopAudio();
      return;
    }
    const serial = ++playbackSerial,
      question = state.question,
      taskId = state.exerciseTask?.id;
    const current = () => {
      const next = getState();
      return (
        serial === playbackSerial &&
        next === state &&
        next.question === question &&
        next.exerciseTask?.id === taskId
      );
    };
    if (state.exerciseTask?.exercise) {
      const src = state.exerciseTask.exerciseAudio;
      speechActive = src.audio === null;
      updatePlayer(true);
      try {
        await playWordAudio(
          audio,
          { word: src.spoken, audio: src.audio },
          appSettings.values.voiceVolume / 100,
          state.speed,
        );
      } catch {
        if (current()) {
          notify('音声を再生できませんでした。もう一度お試しください。');
          updatePlayer(false);
        }
      } finally {
        if (src.audio === null && current()) {
          speechActive = false;
          updatePlayer(false);
        }
      }
      return;
    }
    const recorded = vocabulary.some((v) => v.word === state.question)
      ? state.question
      : state.mode === 'picture'
        ? 'Which picture shows an apple?'
        : originalQuestion;
    if (
      state.question.trim() !== recorded ||
      vocabulary.find((v) => v.word === state.question)?.audio === null
    ) {
      if (!window.speechSynthesis) {
        notify('このブラウザーでは編集した文章の読み上げに対応していません');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(state.question);
      utterance.volume = appSettings.values.voiceVolume / 100;
      utterance.lang = 'en-US';
      utterance.rate = state.speed * 0.9;
      const voices = speechSynthesis.getVoices();
      const english =
        voices.find((v) => v.lang === 'en-US') || voices.find((v) => v.lang.startsWith('en'));
      if (english) utterance.voice = english;
      utterance.onend = () => {
        if (!current()) return;
        releaseUtterance();
        speechActive = false;
        updatePlayer(false);
      };
      utterance.onerror = () => {
        if (!current()) return;
        releaseUtterance();
        speechActive = false;
        updatePlayer(false);
        notify('読み上げを再生できませんでした。もう一度お試しください');
      };
      activeUtterance = utterance;
      speechActive = true;
      updatePlayer(true);
      speechSynthesis.speak(utterance);
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      if (current()) notify('音声を再生できませんでした。再生ボタンをもう一度押してください');
    }
  }
  const clock = (t) =>
    `${Math.floor((t || 0) / 60)}:${String(Math.floor((t || 0) % 60)).padStart(2, '0')}`;
  audio.onplay = () => updatePlayer(true);
  audio.onpause = () => {
    if (!speechActive) updatePlayer(false);
  };
  audio.onended = () => updatePlayer(false);
  audio.onloadedmetadata = () => ($('#audio-duration').textContent = clock(audio.duration));
  audio.ontimeupdate = () => {
    $('#audio-time').textContent = clock(audio.currentTime);
    $('#audio-progress').value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  };
  $('#audio-play').onclick = playAudio;
  $('#audio-progress').oninput = (e) => {
    if (Number.isFinite(audio.duration))
      audio.currentTime = (Number(e.target.value) * audio.duration) / 100;
  };
  $('#speed').onclick = () => {
    const state = getState();
    state.speed = state.speed === 1 ? 0.75 : state.speed === 0.75 ? 1.25 : 1;
    audio.playbackRate = state.speed;
    $('#speed').textContent = state.speed + '×';
  };

  return { setAudio, playAudio, stopAudio };
}
