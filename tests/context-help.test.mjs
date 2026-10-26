import assert from 'node:assert/strict';
import { installContextHelp } from '../public/shared/context-help.js';

class Node {
  constructor(help = '', trigger = false) {
    this.dataset = { help };
    this.attributes = new Map();
    this.children = [];
    this.style = {};
    this.hidden = false;
    this.isConnected = true;
    this.classList = { contains: (name) => trigger && name === 'help-trigger' };
  }
  append(node) {
    this.children.push(node);
    node.parent = this;
  }
  remove() {
    this.parent.children = this.parent.children.filter((node) => node !== this);
  }
  closest() {
    return this.dataset.help ? this : this.parent?.closest();
  }
  contains(node) {
    return !!node && (node === this || this.children.some((child) => child.contains(node)));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  getBoundingClientRect() {
    return this.id ? { width: 280, height: 80 } : { left: 330, top: 130, bottom: 170, width: 50 };
  }
}
const events = new Map(),
  hostEvents = new Map(),
  timers = new Map();
let serial = 0;
const doc = {
  body: new Node(),
  activeElement: null,
  createElement: () => new Node(),
  addEventListener: (name, fn) => events.set(name, fn),
  removeEventListener: (name) => events.delete(name),
};
const host = {
  document: doc,
  innerWidth: 400,
  innerHeight: 220,
  setTimeout(fn) {
    timers.set(++serial, fn);
    return serial;
  },
  clearTimeout: (id) => timers.delete(id),
  addEventListener: (name, fn) => hostEvents.set(name, fn),
  removeEventListener: (name) => hostEvents.delete(name),
};
const dispose = installContextHelp(host),
  tip = doc.body.children[0];
const button = new Node('回答と時計を止めます。');
button.setAttribute('aria-describedby', 'existing-description');
const child = new Node();
button.append(child);
const icon = new Node('順位の見方', true);
const emit = (name, target, extra = {}) => events.get(name)({ target, ...extra });
const flush = () => {
  const pending = [...timers.values()];
  timers.clear();
  pending.forEach((fn) => fn());
};

emit('pointerover', button, { pointerType: 'mouse' });
assert.ok(tip.hidden, 'brief pointer passes do not flash a tooltip');
assert.equal(timers.size, 1);
flush();
assert.equal(tip.hidden, false);
assert.equal(tip.textContent, button.dataset.help);
assert.equal(tip.getAttribute('role'), 'tooltip');
assert.equal(button.getAttribute('aria-describedby'), 'existing-description aomi-context-help');
assert.ok(parseFloat(tip.style.left) >= 12 && parseFloat(tip.style.left) + 280 <= 388);
assert.ok(parseFloat(tip.style.top) >= 12 && parseFloat(tip.style.top) + 80 <= 208);
emit('pointerout', button, { relatedTarget: child });
assert.equal(tip.hidden, false, 'moving within an action preserves its tooltip');
emit('pointerout', button, { relatedTarget: tip });
assert.equal(tip.hidden, false, 'the tooltip itself can be hovered');
emit('pointerout', tip, { relatedTarget: null });
assert.ok(tip.hidden);
assert.equal(button.getAttribute('aria-describedby'), 'existing-description');

doc.activeElement = button;
emit('focusin', button);
assert.equal(tip.hidden, false, 'keyboard focus reveals help without waiting');
let escaped = false;
emit('keydown', button, {
  key: 'Escape',
  preventDefault() {
    escaped = true;
  },
});
assert.ok(tip.hidden && escaped);
doc.activeElement = null;
emit('pointerover', icon, { pointerType: 'touch' });
assert.equal(timers.size, 0, 'touch does not start a hover timer');
emit('click', icon, { preventDefault() {} });
assert.equal(tip.textContent, '順位の見方');
emit('pointerout', icon, { relatedTarget: null });
assert.equal(tip.hidden, false, 'tapped help stays open for touch readers');
emit('click', icon, { preventDefault() {} });
assert.ok(tip.hidden, 'the second tap closes help');
emit('click', icon, { preventDefault() {} });
emit('click', button);
assert.ok(tip.hidden, 'ordinary action clicks dismiss help without intercepting the action');
emit('focusin', button);
emit('scroll', doc.body);
assert.ok(tip.hidden);
emit('focusin', button);
hostEvents.get('resize')();
assert.ok(tip.hidden);
emit('pointerover', button, { pointerType: 'mouse' });
button.isConnected = false;
flush();
assert.ok(tip.hidden, 'removed controls cannot revive a pending tooltip');
button.isConnected = true;
emit('pointerover', button, { pointerType: 'mouse' });
dispose();
flush();
assert.equal(timers.size, 0);
assert.equal(events.size + hostEvents.size, 0);
assert.equal(doc.body.children.length, 0);
console.log(
  'PASS: delayed hover, keyboard/ARIA/Escape, hoverable tooltip, touch toggle, action/outside dismissal, viewport bounds, removed controls and listener/timer disposal.',
);
