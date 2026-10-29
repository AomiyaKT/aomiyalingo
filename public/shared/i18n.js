import { englishUI } from './i18n-en.js';

export const LANGUAGE_KEY = 'aomiyalingo.uiLanguage';
const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let compiled;
function catalog() {
  if (compiled) return compiled;
  const entries = Object.entries(englishUI);
  const templates = entries
    .filter(([s]) => s.includes('{{'))
    .sort(
      (a, b) => b[0].replace(/\{\{\d+\}\}/g, '').length - a[0].replace(/\{\{\d+\}\}/g, '').length,
    )
    .map(([source, value]) => ({
      pattern: new RegExp(
        '^' +
          source
            .split(/\{\{\d+\}\}/)
            .map(escape)
            .join('(.*?)') +
          '$',
      ),
      ids: [...source.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]),
      value,
    }));
  const fragments = entries
    .filter(
      ([s]) =>
        !s.includes('{{') &&
        s.length > 1 &&
        !(s.length < 12 && /^\d+(?:問|語|人|点|秒|分)/.test(s)),
    )
    .sort((a, b) => b[0].length - a[0].length);
  compiled = { templates, fragments: new RegExp(fragments.map(([s]) => escape(s)).join('|'), 'g') };
  return compiled;
}

// Pure presentation translation. Captured values are opaque: a student's answer
// or a teacher's title must never be translated as if it were an interface label.
function resolveUI(value, language = 'en') {
  const raw = String(value ?? '');
  if (language !== 'en' || !/[\u3040-\u30ff\u3400-\u9fff]/.test(raw)) return raw;
  const source = normalize(raw),
    leading = raw.match(/^\s*/)[0],
    trailing = raw.match(/\s*$/)[0];
  if (Object.hasOwn(englishUI, source)) return leading + englishUI[source] + trailing;
  const c = catalog();
  if (source.length < 1500)
    for (const template of c.templates) {
      const match = template.pattern.exec(source);
      if (match) {
        const vars = Object.fromEntries(template.ids.map((id, index) => [id, match[index + 1]]));
        return (
          leading + template.value.replace(/\{\{(\d+)\}\}/g, (_, id) => vars[id] ?? '') + trailing
        );
      }
    }
  const result = source
    .replace(c.fragments, (part) => englishUI[part])
    .replace(/(\d+)年生/g, 'Grade $1')
    .replace(/(\d+)問/g, '$1 questions')
    .replace(/(\d+)人/g, '$1 students')
    .replace(/(\d+)語/g, '$1 words')
    .replace(/(\d+)件/g, '$1 records')
    .replace(/(\d+)位/g, (_, rank) => {
      const n = Number(rank),
        suffix =
          n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
      return rank + suffix + ' place';
    })
    .replace(/(\d+)点/g, '$1 points')
    .replace(/(\d+)分/g, '$1 min')
    .replace(/(\d+)秒/g, '$1 sec')
    .replace(/(\d)(words|students|questions|points|records|letters|place)\b/g, '$1 $2')
    .replace(/第(\d+)Course/g, 'Course $1')
    .replace(/(Course|Lesson)(\d)/g, '$1 $2')
    .replace(
      /\b1 (students|questions|words|points|records|letters)\b/g,
      (_, unit) => '1 ' + unit.slice(0, -1),
    )
    .replace(/([.!?])(?=[A-Za-z])/g, '$1 ')
    .replace(/・/g, ' · ')
    .replace(/「/g, '"')
    .replace(/」/g, '" ')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
  return leading + result + trailing;
}

// Dynamic standings repeat the same labels hundreds of times. Bound both entry
// count and retained characters; arbitrary teacher titles cannot grow this cache.
export function createUITranslator({
  maxEntries = 512,
  maxChars = 131072,
  resolve = resolveUI,
} = {}) {
  const cache = new Map();
  let chars = 0;
  return function translate(value, language = 'en') {
    const raw = String(value ?? '');
    if (language !== 'en' || !/[\u3040-\u30ff\u3400-\u9fff]/.test(raw)) return raw;
    if (cache.has(raw)) {
      const hit = cache.get(raw);
      cache.delete(raw);
      cache.set(raw, hit);
      return hit;
    }
    const result = resolve(raw, language),
      size = raw.length + result.length;
    if (maxEntries > 0 && size <= maxChars) {
      while (cache.size && (cache.size >= maxEntries || chars + size > maxChars)) {
        const key = cache.keys().next().value;
        chars -= key.length + cache.get(key).length;
        cache.delete(key);
      }
      cache.set(raw, result);
      chars += size;
    }
    return result;
  };
}
export const translateUI = createUITranslator();

// Content boundaries are deliberately explicit. This layer never reads/writes
// form values, answer models, datasets used by scoring, storage records or APIs.
export const CONTENT_SELECTOR = [
  '[translate="no"]',
  '[data-learning-content]',
  '[contenteditable="true"]',
  'script',
  'style',
  'textarea',
  'code',
  'pre',
  'svg',
  '.answer-text',
  'img.answer-image',
  '#question-picture',
  '#study-picture',
  '.race-choice',
  '.exercise-tile:not([data-ui-label])',
  '.exercise-gap-sentence',
  '#study-word',
  '#study-meaning',
  '#study-example',
  '.stage-word > strong',
  '.stage-word > span',
  '.record-compare dd',
  '.record-answer > h3',
  '.tv-word > div:first-child',
  '#waiting-review-card h3',
  '#waiting-review-card strong',
  '.skill-row > strong',
  '.mastery-row > strong',
  '.attempt-row > strong',
  '#course-pool label span',
  '#race-pool label span',
  '#join-class',
  '#records-class-name',
  '#class-lifecycle-target',
].join(',');

export function installLanguageUI(host = globalThis) {
  const doc = host.document;
  if (!doc?.createTreeWalker || !host.MutationObserver) return null;
  let language = 'ja';
  try {
    if (host.localStorage.getItem(LANGUAGE_KEY) === 'en') language = 'en';
  } catch {}
  const originals = new WeakMap(),
    attrs = new WeakMap();
  const protectedNode = (node) => !!node?.closest?.(CONTENT_SELECTOR);
  function present(node, attribute = null) {
    const element = attribute ? node : node.parentElement;
    if (!element) return;
    const labelSource =
      attribute === 'aria-label'
        ? (attrs.get(node)?.get(attribute)?.source ?? node.getAttribute(attribute) ?? '')
        : '';
    const exerciseLabel =
      attribute === 'aria-label' &&
      element.matches?.('.exercise-tile') &&
      /(?: を選ぶ| と組み合わせる| を戻す)$/.test(labelSource);
    if (
      protectedNode(element) &&
      !(attribute === 'aria-label' && element.matches?.('#question-text, #race-prompt')) &&
      !exerciseLabel
    )
      return;
    if (attribute === 'aria-label' && element.matches?.('.answer, .race-choice')) return;
    const value = attribute ? node.getAttribute(attribute) : node.data;
    if (value == null) return;
    let previous;
    if (attribute) {
      let map = attrs.get(node);
      if (!map) attrs.set(node, (map = new Map()));
      previous = map.get(attribute);
      if (!previous || value !== previous.rendered)
        map.set(attribute, (previous = { source: value }));
    } else {
      previous = originals.get(node);
      if (!previous || value !== previous.rendered)
        originals.set(node, (previous = { source: value }));
    }
    if (value === previous.rendered && previous.language === language) return;
    const next = translateUI(previous.source, language);
    previous.rendered = next;
    previous.language = language;
    if (value !== next) {
      if (attribute) node.setAttribute(attribute, next);
      else node.data = next;
    }
  }
  const attributeNames = [
    'aria-label',
    'aria-description',
    'placeholder',
    'title',
    'data-help',
    'alt',
  ];
  function scan(root) {
    if (!root || root.isConnected === false) return;
    if (root.nodeType === 3) {
      present(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && protectedNode(root)) {
      present(root, 'aria-label');
      return;
    }
    if (root.nodeType === 1) for (const name of attributeNames) present(root, name);
    const walker = doc.createTreeWalker(root, 1 | 4, {
      acceptNode(node) {
        if (node.nodeType === 1 && protectedNode(node)) {
          present(node, 'aria-label');
          return 2;
        }
        return 1;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) present(node);
      else for (const name of attributeNames) present(node, name);
    }
  }
  const observer = new host.MutationObserver((records) => {
    if (language === 'ja') return;
    const roots = new Set();
    for (const record of records)
      if (record.type === 'childList') for (const node of record.addedNodes) roots.add(node);
    const covered = (node) => {
      for (let parent = node?.parentElement; parent; parent = parent.parentElement)
        if (roots.has(parent)) return true;
      return false;
    };
    // A fragment may report both an added parent and all its descendants. Scan
    // only the outer roots, and handle their text/attributes in that same walk.
    for (const record of records) {
      if (roots.has(record.target) || covered(record.target)) continue;
      if (record.type === 'attributes') present(record.target, record.attributeName);
      else if (record.type === 'characterData') present(record.target);
    }
    for (const root of roots) if (!covered(root)) scan(root);
  });
  const row = doc.createElement('div');
  row.className = 'setting-line language-setting';
  row.innerHTML =
    '<label for="interface-language">表示言語</label><select id="interface-language" translate="no"><option value="ja" lang="ja">日本語</option><option value="en" lang="en">English</option></select>';
  const panel = doc.querySelector('#settings-panel-0');
  panel?.prepend(row);
  const picker = row.querySelector('select');
  function apply() {
    doc.documentElement.lang = language;
    picker.value = language;
    scan(doc.documentElement);
  }
  function setLanguage(value, persist = true) {
    language = value === 'en' ? 'en' : 'ja';
    if (persist)
      try {
        host.localStorage.setItem(LANGUAGE_KEY, language);
      } catch {}
    apply();
    host.dispatchEvent(new host.CustomEvent('aomiyalingo-language', { detail: language }));
  }
  picker.onchange = () => setLanguage(picker.value);
  function storage(event) {
    if (event.key === LANGUAGE_KEY || event.key === null) setLanguage(event.newValue, false);
  }
  host.addEventListener('storage', storage);
  apply();
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: attributeNames,
  });
  return {
    get language() {
      return language;
    },
    setLanguage,
    dispose() {
      observer.disconnect();
      host.removeEventListener('storage', storage);
      row.remove();
    },
  };
}
