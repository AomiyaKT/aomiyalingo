export { setUIText as setTeacherText } from '../shared/i18n.js';

export function createClassVocabularyReader({ fallback, parse = JSON.parse }) {
  let lastRaw,
    current = fallback;
  return (raw) => {
    if (raw !== lastRaw) {
      current = raw ? parse(raw) : fallback;
      lastRaw = raw;
    }
    return current;
  };
}
