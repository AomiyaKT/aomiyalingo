function playWordAudio(player, word, volume = 1, rate = 1) {
  player.pause();
  window.speechSynthesis?.cancel();
  if (word.audio !== null) {
    player.src = word.audio || '/assets/words/' + word.word + '.wav';
    player.volume = volume;
    player.playbackRate = rate;
    return player.play();
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
