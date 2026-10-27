import assert from 'node:assert/strict';
import { englishUI } from '../public/shared/i18n-en.js';
import { exerciseNames } from '../public/learning/exercises.js';
import { installLanguageUI, translateUI, LANGUAGE_KEY } from '../public/shared/i18n.js';

assert.equal(translateUI('設定', 'ja'), '設定');
assert.equal(translateUI('設定'), 'Settings');
assert.equal(translateUI('  答えを確認  '), '  Check answer  ');
assert.equal(translateUI('出席番号 999 で参加します。'), 'Join as student 999.');
assert.equal(translateUI('正解：保存'), 'Correct answer: 保存', 'captured answer is opaque');
assert.equal(translateUI('回答：家族'), 'Answer: 家族');
assert.equal(
  translateUI('もう一度覚えよう。正解：音楽'),
  "Let's learn it again. Correct answer: 音楽",
);
assert.equal(translateUI('コース 2'), 'Course 2');
assert.equal(translateUI('コース 2 を開始'), 'Start course 2');
assert.equal(translateUI('コース 3 を開始'), 'Start course 3');
assert.equal(translateUI('2位'), '2nd place');
assert.equal(translateUI('3位'), '3rd place');
assert.equal(translateUI('12位 出席番号 99'), '12th place Student number 99');
assert.equal(translateUI('22位'), '22nd place');
for (const name of Object.values(exerciseNames)) {
  assert.equal(
    translateUI('0/24 · ' + name),
    '0/24 · ' + translateUI(name),
    'Compact tower labels preserve the complete question-type translation',
  );
}
assert.equal(translateUI('12 / 24文字'), '12 / 24 letters');
assert.equal(translateUI('文字 7 a'), 'Letter 7: a');
assert.equal(translateUI('第1問'), 'Question 1');
assert.equal(translateUI('保存 を選ぶ'), 'Select 保存');
assert.equal(translateUI('家族・ペア 2 を戻す'), 'Undo pair 2: 家族');
assert.equal(translateUI('1人'), '1 student');
assert.equal(translateUI('「ALT」参加受付中'), '"ALT" Open for joining');
assert.equal(
  translateUI('残り4問。途中で戻っても続きから再開できます。'),
  '4 questions left. You can come back and continue later.',
);
assert.equal(
  translateUI('27語 · 全81問を6問ずつ。10種類の題型を3段階で練習します。'),
  '27 words · 81 questions · 6 per lesson · 10 types across 3 stages.',
);
assert.equal(translateUI('6年生 · Unit 8'), 'Grade 6 · Unit 8');
assert.equal(translateUI('5年生 · Unit 5'), 'Grade 5 · Unit 5');
assert.equal(translateUI('https://example.com/a?x=1'), 'https://example.com/a?x=1');
assert.ok(Object.keys(englishUI).length > 1250);
for (const [ja, en] of Object.entries(englishUI)) {
  assert.deepEqual(
    [...en.matchAll(/\{\{\d+\}\}/g)].map((x) => x[0]).sort(),
    [...ja.matchAll(/\{\{\d+\}\}/g)].map((x) => x[0]).sort(),
    ja + ': placeholders preserved',
  );
}

let writes = 0;
class Element {
  constructor(tag = 'div', text = '') {
    this.nodeType = tag === '#text' ? 3 : 1;
    this.tag = tag;
    this.childNodes = [];
    this.parentElement = null;
    this.attrs = new Map();
    this.data = text;
    this.value = '';
    this.isConnected = true;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.childNodes.push(node);
    }
  }
  prepend(node) {
    node.parentElement = this;
    this.childNodes.unshift(node);
  }
  setAttribute(key, value) {
    writes++;
    this.attrs.set(key, String(value));
  }
  getAttribute(key) {
    return this.attrs.get(key) ?? null;
  }
  closest() {
    for (let n = this; n; n = n.parentElement)
      if (
        n.attrs?.get('translate') === 'no' ||
        n.protected ||
        ['textarea', 'script'].includes(n.tag)
      )
        return n;
    return null;
  }
  set innerHTML(_) {
    const label = new Element('label'),
      text = new Element('#text', '表示言語');
    label.append(text);
    const select = new Element('select');
    select.attrs.set('translate', 'no');
    this.append(label, select);
  }
  querySelector(tag) {
    return this.childNodes.find((n) => n.tag === tag);
  }
  remove() {
    this.parentElement.childNodes = this.parentElement.childNodes.filter((n) => n !== this);
  }
}
const html = new Element('html'),
  body = new Element('body'),
  panel = new Element('section');
html.append(body);
body.append(panel);
const text = (value, parent = body) => {
  const n = new Element('#text', value);
  parent.append(n);
  return n;
};
const heading = text('設定'),
  status = text('保存中…');
const content = new Element('span');
content.attrs.set('translate', 'no');
body.append(content);
const meaning = text('保存', content);
const input = new Element('input');
input.value = '先生の自作単語';
input.attrs.set('placeholder', 'パスワードを入力');
body.append(input);
const answer = new Element('div');
answer.matches = () => true;
answer.attrs.set('aria-label', '1. 保存');
body.append(answer);
const qr = new Element('img');
qr.attrs.set('id', 'race-qr-image');
qr.attrs.set('alt', 'レースに参加するQRコード');
body.append(qr);
const pair = new Element('button');
pair.protected = true;
pair.matches = (selector) => selector === '.exercise-tile';
pair.attrs.set('aria-label', '保存 を選ぶ');
body.append(pair);
const pairValue = text('保存', pair);
const help = new Element('button');
help.attrs.set('data-help', '全員の回答と時計を一時停止します。');
body.append(help);
const disk = new Map(),
  listeners = new Map();
let callback,
  disconnected = false,
  saved = 0;
const doc = {
  documentElement: html,
  createElement: (tag) => new Element(tag),
  querySelector: (selector) => (selector === '#settings-panel-0' ? panel : null),
  createTreeWalker(root, _, filter) {
    const nodes = [];
    function walk(n) {
      for (const child of n.childNodes) {
        if (filter.acceptNode(child) === 2) continue;
        nodes.push(child);
        walk(child);
      }
    }
    walk(root);
    return { nextNode: () => nodes.shift() || null };
  },
};
const host = {
  document: doc,
  localStorage: {
    getItem: (k) => disk.get(k),
    setItem(k, v) {
      saved++;
      disk.set(k, v);
    },
  },
  MutationObserver: class {
    constructor(fn) {
      callback = fn;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  },
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: (name) => listeners.delete(name),
  CustomEvent: class {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  dispatchEvent() {},
};
const locale = installLanguageUI(host);
assert.equal(locale.language, 'ja', 'Japanese is the default regardless of browser locale');
assert.equal(heading.data, '設定');
locale.setLanguage('en');
assert.equal(heading.data, 'Settings');
assert.equal(status.data, 'Saving…');
assert.equal(meaning.data, '保存', 'learning content is never translated');
assert.equal(input.value, '先生の自作単語', 'form drafts are never changed');
assert.equal(input.getAttribute('placeholder'), 'Enter password');
assert.equal(
  answer.getAttribute('aria-label'),
  '1. 保存',
  'screen-reader answer labels also preserve the answer',
);
assert.equal(qr.getAttribute('alt'), 'QR code to join the race');
assert.equal(pair.getAttribute('aria-label'), 'Select 保存');
assert.equal(pairValue.data, '保存');
assert.equal(
  qr.getAttribute('id'),
  'race-qr-image',
  'DOM identity never depends on translated labels',
);
assert.equal(help.getAttribute('data-help'), 'Pause all student answers and timers.');
assert.equal(html.lang, 'en');
assert.equal(disk.get(LANGUAGE_KEY), 'en');
const before = writes;
for (let i = 0; i < 100; i++)
  callback([{ type: 'attributes', target: help, attributeName: 'data-help' }]);
assert.equal(writes, before, 'translated attribute mutations cannot loop');
status.data = '接続済み';
callback([{ type: 'characterData', target: status }]);
assert.equal(status.data, 'Connected', 'live poll messages use current language');
const added = new Element('div');
const joined = text('参加する', added);
body.append(added);
callback([{ type: 'childList', addedNodes: [added] }]);
assert.equal(joined.data, 'Join');
locale.setLanguage('ja');
assert.equal(heading.data, '設定');
assert.equal(status.data, '接続済み');
assert.equal(joined.data, '参加する');
assert.equal(pair.getAttribute('aria-label'), '保存 を選ぶ');
assert.equal(help.getAttribute('data-help'), '全員の回答と時計を一時停止します。');
const priorSaved = saved;
listeners.get('storage')({ key: LANGUAGE_KEY, newValue: 'en' });
assert.equal(heading.data, 'Settings');
assert.equal(saved, priorSaved, 'iframe/tab sync does not echo storage writes');
locale.dispose();
assert.ok(disconnected);
assert.equal(listeners.size, 0);
assert.equal(installLanguageUI({}), null);
console.log(
  'UI language: Japanese default, 1300+ strings, opaque learning values, drafts, dynamic messages, reversible text/help attributes, persistence, cross-document sync, mutation-loop guard and cleanup passed.',
);
