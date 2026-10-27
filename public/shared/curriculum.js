// Stable profile keys keep saved classes and older teacher editors compatible.
export const curriculumCatalog = {
  6: { grade: 6, unit: '4-5', label: '6年生 · Unit 4–5（以前の設定）', key: null },
  5: { grade: 5, unit: '5', label: '5年生 · Unit 5', key: 'grade5' },
  ...Object.fromEntries(
    [1, 2, 3, 4, 6, 7, 8].map((unit) => [
      '5-' + unit,
      { grade: 5, unit: String(unit), label: '5年生 · Unit ' + unit, key: 'grade5unit' + unit },
    ]),
  ),
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8].map((unit) => [
      '6-' + unit,
      {
        grade: 6,
        unit: String(unit),
        label: '6年生 · ' + (unit === 1 ? 'Pre Unit–Unit 1' : 'Unit ' + unit),
        key: 'unit' + unit,
      },
    ]),
  ),
};
export const curriculumProfileKeys = Object.values(curriculumCatalog)
  .map((v) => v.key)
  .filter(Boolean);
export function curriculumSelection(value) {
  return curriculumCatalog[value] || curriculumCatalog['6'];
}
export function curriculumValue(grade, unit) {
  return (
    Object.entries(curriculumCatalog).find(([, v]) => v.grade === grade && v.unit === unit)?.[0] ||
    '6'
  );
}
export function curriculumLabel(grade, unit) {
  return curriculumSelection(curriculumValue(grade, unit)).label;
}
export function curriculumProfile(config, value) {
  const entry = curriculumSelection(value);
  return entry.key ? config[entry.key] : config;
}
export function allCurriculumProfiles(config) {
  return [config, ...curriculumProfileKeys.map((k) => config[k]).filter(Boolean)];
}
export function spellingCharacters(word) {
  return word.replace(/[^a-z_]/gi, '');
}
export function formatSpellingAnswer(pattern, letters) {
  let i = 0;
  return [...pattern]
    .map((c) => (/[a-z_]/i.test(c) ? letters[i++] || '' : c))
    .join('')
    .trimEnd();
}
export function appendSpellingSlots(container, pattern, createTile) {
  let position = 0;
  for (const part of pattern.split(' ')) {
    const group = pattern.includes(' ') ? document.createElement('span') : container;
    if (group !== container) {
      group.className = 'spelling-word';
      container.append(group);
    }
    for (const c of part) {
      if (/[a-z_]/i.test(c)) {
        const tile = createTile(position++);
        tile.dataset.position = String(position - 1);
        group.append(tile);
      } else {
        const mark = document.createElement('span');
        mark.className = 'spelling-punctuation';
        mark.textContent = c;
        group.append(mark);
      }
    }
  }
}
