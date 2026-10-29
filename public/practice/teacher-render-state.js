import { translateUI } from '../shared/i18n.js';
import { setTextIfChanged } from '../shared/dom.js';

// Keep Japanese source text available to the existing reversible translator.
// Comparing the current translation avoids rewriting Japanese on every poll
// while an English-speaking teacher is reading the screen.
export function setTeacherText(node, value, language = 'ja') {
  const source = value == null ? '' : String(value);
  if (node.textContent === translateUI(source, language)) return false;
  return setTextIfChanged(node, source);
}

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
