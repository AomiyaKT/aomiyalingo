import assert from 'node:assert/strict';
import { createTimingTower } from '../public/race/timing-tower.js';
import { setTextIfChanged, setAttributeIfChanged } from '../public/shared/dom.js';

let textWrites = 0,
  rectReads = 0,
  animations = 0,
  events = [];
class Node {
  constructor(tag, text = '', className = '') {
    this.tag = tag;
    this._text = text;
    this.className = className;
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.attributes = new Map();
    this.style = { setProperty() {} };
    this.clientWidth = 1280;
    this.classList = {
      toggle: (name, on) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        on ? names.add(name) : names.delete(name);
        this.className = [...names].join(' ');
      },
    };
  }
  get textContent() {
    return this._text;
  }
  set textContent(value) {
    textWrites++;
    this._text = value;
  }
  get lastChild() {
    return this.children.at(-1);
  }
  append(...nodes) {
    for (const n of nodes) {
      n.remove();
      n.parent = this;
      this.children.push(n);
    }
  }
  replaceChildren(...nodes) {
    for (const n of this.children) n.parent = null;
    this.children = [];
    this.append(...nodes);
  }
  insertBefore(node, before) {
    if (node === before) return;
    node.remove();
    const index = before ? this.children.indexOf(before) : this.children.length;
    assert.ok(index >= 0);
    this.children.splice(index, 0, node);
    node.parent = this;
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    }
  }
  querySelectorAll(selector) {
    const result = [];
    for (const n of this.children) {
      if (
        selector.startsWith('.')
          ? n.className.split(' ').includes(selector.slice(1))
          : n.tag === selector
      )
        result.push(n);
      result.push(...n.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) {
    const split = selector.indexOf(' ');
    return split < 0
      ? this.querySelectorAll(selector)[0] || null
      : this.querySelector(selector.slice(0, split))?.querySelector(selector.slice(split + 1)) ||
          null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  getBoundingClientRect() {
    rectReads++;
    events.push('read');
    return {
      left: (this.parent?.parent?.children.indexOf(this.parent) || 0) * 320,
      top: (this.parent?.children.indexOf(this) || 0) * 64,
    };
  }
  getAnimations() {
    return [];
  }
  animate() {
    animations++;
    events.push('animate');
  }
}
const original = globalThis.matchMedia;
globalThis.matchMedia = () => ({ matches: false });
try {
  const panel = new Node('div'),
    settings = { values: { reduceMotion: false } };
  let data = { race: { id: 'r1', status: 'running', endless: true } };
  const draw = createTimingTower({
    make: (tag, text = '', cls = '') => new Node(tag, text, cls),
    avatarArt: () => new Node('img'),
    getData: () => data,
    appSettings: settings,
  });
  const players = Array.from({ length: 35 }, (_, i) => ({
    id: 'p' + i,
    label: String(i + 1),
    alias: '出席番号 ' + (i + 1),
    rank: i + 1,
    score: 3500 - i * 100,
    accuracy: 80,
    remaining: 300000,
    stationIndex: 20,
    mode: 'text',
    ready: true,
    prepared: true,
    avatar: 'cat',
  }));
  draw(panel, players);
  assert.equal(panel.children.length, 4);
  assert.equal(panel.querySelectorAll('.timing-row').length, 35);
  const first = panel.querySelectorAll('.timing-row')[0];
  assert.equal(first.querySelector('.timing-score small').textContent, '80%');
  assert.equal(
    first.querySelector('.timing-score small').getAttribute('aria-label'),
    '80% 自力正解',
    'Compact percentages retain their full accessible meaning',
  );
  textWrites = rectReads = animations = 0;
  draw(panel, structuredClone(players));
  assert.equal(rectReads, 0, 'An unchanged ranking reads no row geometry');
  assert.equal(textWrites, 0, 'An unchanged ranking rewrites no leaf text');
  assert.equal(panel.querySelectorAll('.timing-row')[0], first, 'Rows survive polling');
  const moved = [{ ...players[1], rank: 1 }, { ...players[0], rank: 2 }, ...players.slice(2)];
  events = [];
  draw(panel, moved);
  assert.equal(rectReads, 4, 'Only two moving rows are measured before and after layout');
  assert.equal(animations, 2);
  assert.deepEqual(
    events,
    ['read', 'read', 'read', 'read', 'animate', 'animate'],
    'Every rank layout read precedes animation writes',
  );
  assert.equal(panel.children[0].children[1].dataset.id, 'p1');
  settings.values.reduceMotion = true;
  rectReads = animations = 0;
  draw(panel, players);
  assert.equal(rectReads, 0);
  assert.equal(animations, 0);
  panel.clientWidth = 600;
  draw(panel, players);
  assert.equal(panel.children.length, 2);
  assert.equal(
    panel.querySelectorAll('.timing-row').length,
    35,
    'Responsive column changes retain all learners',
  );
  draw(panel, players.slice(0, 34));
  assert.equal(panel.querySelectorAll('.timing-row').length, 34);
  data = { race: { ...data.race, id: 'r2' } };
  draw(panel, players.slice(0, 2));
  assert.notEqual(panel.querySelectorAll('.timing-row')[0], first, 'New races reset row ownership');
  draw(panel, []);
  const empty = panel.children[0];
  draw(panel, []);
  assert.equal(panel.children[0], empty);
  const node = new Node('span', '100');
  textWrites = 0;
  assert.equal(setTextIfChanged(node, 100), false);
  assert.equal(textWrites, 0);
  assert.equal(setTextIfChanged(node, 101), true);
  assert.equal(textWrites, 1);
  assert.equal(setAttributeIfChanged(node, 'aria-label', 'remaining'), true);
  assert.equal(setAttributeIfChanged(node, 'aria-label', 'remaining'), false);
  console.log(
    'Timing tower: stable rows, zero unchanged geometry/text writes, selective rank animation, reduced motion, responsive columns and race isolation passed.',
  );
} finally {
  globalThis.matchMedia = original;
}
