// File conversion stays independent from editor state and save/revision handling.
export async function readAudioFile(file) {
  if (file.size > 1048576) throw Error('音声は1 MB以下にしてください。');
  const ext = file.name.split('.').at(-1).toLowerCase();
  const mime = { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg' }[ext];
  if (!mime) throw Error('WAV・MP3・M4A・OGGを選んでください。');
  const reader = new FileReader();
  const data = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { mime, data };
}
