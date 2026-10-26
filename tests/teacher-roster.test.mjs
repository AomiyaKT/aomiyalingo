import assert from 'node:assert/strict';
import { createTeacherRoster } from '../public/practice/teacher-roster.js';

let allocations = 0,
  writes = 0,
  moves = 0,
  focused = null;
class Node {
  constructor(tag, text = '', className = '') {
    allocations++;
    this.tag = tag;
    this._text = text;
    this._className = className;
    this.children = [];
    this.parent = null;
    this.attributes = new Map();
    this.style = new Proxy(
      {},
      {
        set: (target, key, value) => {
          writes++;
          target[key] = value;
          return true;
        },
      },
    );
  }
  get textContent() {
    return this._text;
  }
  set textContent(value) {
    writes++;
    this._text = value;
  }
  get className() {
    return this._className;
  }
  set className(value) {
    writes++;
    this._className = value;
  }
  get childElementCount() {
    return this.children.length;
  }
  get firstChild() {
    return this.children[0];
  }
  setAttribute(key, value) {
    writes++;
    this.attributes.set(key, String(value));
  }
  getAttribute(key) {
    return this.attributes.get(key) ?? null;
  }
  focus() {
    focused = this;
  }
  append(...nodes) {
    for (const node of nodes) this.insertBefore(node, null);
  }
  insertBefore(node, before) {
    moves++;
    node.remove();
    const index = before ? this.children.indexOf(before) : this.children.length;
    assert.ok(index >= 0);
    this.children.splice(index, 0, node);
    node.parent = this;
  }
  remove() {
    if (!this.parent) return;
    if (focused === this) focused = null;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  replaceChildren(...nodes) {
    for (const child of [...this.children]) child.remove();
    this.append(...nodes);
  }
}
const host = new Node('tbody');
const clicked = [];
let time = 1_800_000_000_000;
const render = createTeacherRoster({
  host,
  make: (tag, text, className) => new Node(tag, text, className),
  modeNames: { text: '単語', voice: 'リスニング' },
  onDetail: (id) => clicked.push(id),
  now: () => time,
});
const students = Array.from({ length: 35 }, (_, i) => ({
  id: 's' + i,
  label: String(i + 1),
  completed: 4,
  total: 12,
  current: { mode: 'text', word: 'ate' },
  stage: 1,
  rounds: 3,
  attempts: 4,
  firstAccuracy: 75,
  needsHelp: 1,
  corrected: 0,
  supported: 0,
  lastSeen: time,
}));
render('class-a', students);
assert.equal(host.children.length, 35);
const originalRows = [...host.children];
const button = originalRows[7].children[7].firstChild;
button.focus();
allocations = writes = moves = 0;
render('class-a', structuredClone(students));
assert.equal(allocations, 0, 'Unchanged polls allocate no roster nodes');
assert.equal(writes, 0, 'Unchanged polls write no text, attributes, classes or styles');
assert.equal(moves, 0, 'Unchanged polls do not reattach rows');
assert.equal(focused, button, 'A teacher can keep keyboard focus across polling');
assert.deepEqual(host.children, originalRows);
button.onclick();
assert.deepEqual(clicked, ['s7']);

const changed = structuredClone(students);
Object.assign(changed[7], {
  label: '88',
  completed: 6,
  attempts: 6,
  firstAccuracy: 50,
  needsHelp: 2,
  corrected: 1,
  supported: 1,
  current: { mode: 'voice', word: 'read' },
  stage: 2,
});
allocations = moves = writes = 0;
render('class-a', changed);
assert.equal(allocations, 0);
assert.equal(moves, 0);
const row = host.children[7];
assert.equal(row.children[0].textContent, '88');
assert.equal(row.children[1].children[0].textContent, '6 / 12');
assert.equal(row.children[1].children[1].firstChild.style.width, '50%');
assert.equal(row.children[2].textContent, 'レッスン 2 / 3 · リスニング · read');
assert.equal(row.children[4].className, 'bad');
assert.equal(row.children[5].textContent, '2 / 1 / 1');
assert.equal(button.getAttribute('aria-label'), '出席番号 88 の回答を見る');
assert.equal(focused, button);

time += 120000;
render('class-a', changed);
assert.equal(row.children[6].textContent, '2分前');
assert.equal(row.children[6].className, '');
render('class-a', [...changed].reverse());
assert.equal(host.children[27], row, 'Reordering retains row ownership and click handlers');
const reduced = changed.filter((student) => student.id !== 's7');
render('class-a', reduced);
assert.equal(row.parent, null, 'Removed learners no longer appear');
assert.equal(host.children.length, 34);
render('class-b', [students[0]]);
assert.notEqual(host.firstChild, originalRows[0], 'Changing classes resets ownership');
render('class-b', [{ ...students[0], total: 0, firstAccuracy: null, done: true }]);
assert.equal(host.firstChild.children[1].children[1].firstChild.style.width, '0%');
assert.equal(host.firstChild.children[2].textContent, '完了');
assert.equal(host.firstChild.children[4].textContent, '—');
render('class-b', []);
assert.equal(host.children.length, 0);
render('class-b', [{ ...students[0], current: null }]);
assert.equal(host.firstChild.children[2].textContent, '単語を確認中');
assert.notEqual(host.firstChild, originalRows[0]);
console.log(
  'Teacher roster: 35 stable rows, zero unchanged DOM work, focus retention, selective updates, activity aging, reorder/removal and class isolation passed.',
);
