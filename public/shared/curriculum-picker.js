import { curriculumCatalog, curriculumSelection } from './curriculum.js';

export function curriculumUnits(grade, selected = null) {
  return Object.entries(curriculumCatalog)
    .filter(([value, entry]) => entry.grade === grade && (entry.key !== null || value === selected))
    .sort((a, b) => Number(a[1].unit) - Number(b[1].unit))
    .map(([value, entry]) => ({
      value,
      label:
        entry.grade === 6 && entry.unit === '1'
          ? 'Pre Unit–Unit 1'
          : entry.key === null
            ? 'Unit 4–5（以前の設定）'
            : 'Unit ' + entry.unit,
    }));
}

// The original select remains the form/controller contract, including legacy
// profile values. Only the visible unit list is scoped to one school grade.
export function mountCurriculumPicker(select, { restore = true } = {}) {
  const doc = select?.ownerDocument;
  if (!doc?.createElement || !select.parentElement) return null;
  const host = doc.defaultView;
  const key = 'aomiyalingo.material.' + select.id;
  const make = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let saved = {};
  try {
    saved = JSON.parse(host.localStorage.getItem(key)) || {};
  } catch {}
  const remembered = {};
  for (const grade of [5, 6]) {
    const value = saved.byGrade?.[grade];
    if (Object.hasOwn(curriculumCatalog, value) && curriculumSelection(value).grade === grade)
      remembered[grade] = value;
  }
  if (restore && Object.hasOwn(curriculumCatalog, saved.value)) select.value = saved.value;
  if (!Object.hasOwn(curriculumCatalog, select.value)) select.value = '6-1';
  select.hidden = true;
  select.dataset.curriculumSource = '';
  const oldLabel = select.parentElement.querySelector('label[for="' + select.id + '"]');
  if (oldLabel) oldLabel.hidden = true;
  select.parentElement.classList.add('has-curriculum-picker');
  const root = make('div', 'curriculum-picker');
  const book = make('div', 'curriculum-book');
  const icon = make('span', 'curriculum-book-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14M6 8h3M6 11h3M15 8h3M15 11h3"/></svg>';
  const bookText = make('div', 'curriculum-book-text');
  const caption = make('span', 'curriculum-caption', '教材');
  const title = make('strong', 'curriculum-book-title', 'Blue Sky');
  title.translate = false;
  bookText.append(caption, title);
  book.append(icon, bookText, make('span', 'curriculum-school', '小学校'));
  const fields = make('div', 'curriculum-fields');
  const grades = make('fieldset', 'curriculum-grades');
  grades.append(make('legend', 'curriculum-caption', '学年'));
  const gradeButtons = make('div', 'curriculum-grade-buttons');
  grades.append(gradeButtons);
  const unitField = make('div', 'curriculum-unit-field');
  const label = make('label', 'curriculum-caption', '単元');
  label.htmlFor = select.id + '-unit';
  const units = make('select', 'curriculum-unit');
  units.id = label.htmlFor;
  unitField.append(label, units);
  fields.append(grades, unitField);
  root.append(book, fields);
  select.after(root);
  const buttons = [5, 6].map((grade) => {
    const button = make('button', 'curriculum-grade-button', grade + '年生');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => choose(remembered[grade] || (grade === 5 ? '5-1' : '6-1'));
    gradeButtons.append(button);
    return button;
  });
  let listKey = null;
  function sync() {
    const selected = select.value;
    const entry = curriculumSelection(selected);
    const choices = curriculumUnits(entry.grade, selected);
    const signature = choices.map((v) => v.value).join(',');
    if (signature !== listKey) {
      units.replaceChildren(
        ...choices.map((v) => {
          const option = make('option', null, v.label);
          option.value = v.value;
          return option;
        }),
      );
      listKey = signature;
    }
    units.value = selected;
    for (const [i, button] of buttons.entries()) {
      const active = entry.grade === i + 5;
      button.setAttribute('aria-pressed', String(active));
      button.disabled = select.disabled;
    }
    units.disabled = select.disabled;
    remembered[entry.grade] = selected;
    try {
      const value = JSON.stringify({ value: selected, byGrade: remembered });
      if (host.localStorage.getItem(key) !== value) host.localStorage.setItem(key, value);
    } catch {}
  }
  function choose(value) {
    if (select.disabled || select.value === value) return;
    select.value = value;
    sync();
    select.dispatchEvent(new host.Event('change', { bubbles: true }));
  }
  units.onchange = () => choose(units.value);
  select.addEventListener('change', sync);
  sync();
  return { sync, focus: () => units.focus({ preventScroll: true }) };
}
