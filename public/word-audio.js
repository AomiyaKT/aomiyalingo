const recordedPlaybackOwners = new WeakMap();
function playWordAudio(player, word, volume = 1, rate = 1) {
  const owner = {};
  recordedPlaybackOwners.set(player, owner);
  player.pause();
  window.speechSynthesis?.cancel();
  if (word.audio !== null) {
    const src = word.audio || '/assets/words/' + word.word + '.wav';
    player.src = window.aomiPreparedAudioURL?.(src) || src;
    player.volume = volume;
    player.playbackRate = rate;
    const attemptedURL = player.src;
    return player.play().catch((error) => {
      if (
        error?.name !== 'NotSupportedError' ||
        recordedPlaybackOwners.get(player) !== owner ||
        player.src !== attemptedURL ||
        !window.aomiAudioPreparation?.rejectPlayback?.(src, attemptedURL)
      )
        throw error;
      // Preserve a later explicit pause. The next tap still uses the fallback.
      if (player.paused) throw error;
      player.src = src;
      player.volume = volume;
      player.playbackRate = rate;
      return player.play();
    });
  }
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) return reject(Error('音声に対応していません。'));
    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = 'en-US';
    utterance.volume = volume;
    utterance.rate = rate;
    const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-US');
    if (voice) utterance.voice = voice;
    utterance.onend = resolve;
    utterance.onerror = reject;
    speechSynthesis.speak(utterance);
  });
}
