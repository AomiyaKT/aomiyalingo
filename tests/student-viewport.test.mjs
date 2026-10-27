import assert from 'node:assert/strict';
import { installStudentViewport } from '../public/shared/student-viewport.js';

const events = () => ({
  listeners: new Map(),
  addEventListener(name, fn) {
    this.listeners.set(name, fn);
  },
  removeEventListener(name) {
    this.listeners.delete(name);
  },
});
const properties = new Map(),
  frames = new Map();
let height = 96,
  writes = 0,
  scrolls = 0,
  measurements = 0,
  disconnected = false,
  observer,
  next = 0;
const bar = {
  getBoundingClientRect: () => {
    measurements++;
    return { height };
  },
};
const doc = {
  ...events(),
  body: {
    style: {
      getPropertyValue: (key) => properties.get(key),
      setProperty(key, value) {
        writes++;
        properties.set(key, value);
      },
    },
  },
  querySelectorAll: () => [bar],
  activeElement: {
    matches: () => true,
    getBoundingClientRect: () => ({ top: 400, bottom: 468 }),
    scrollIntoView() {
      scrolls++;
    },
  },
};
const viewport = { ...events(), height: 744, offsetTop: 0 };
const host = {
  ...events(),
  document: doc,
  visualViewport: viewport,
  innerHeight: 744,
  requestAnimationFrame(fn) {
    frames.set(++next, fn);
    return next;
  },
  cancelAnimationFrame(id) {
    frames.delete(id);
  },
  ResizeObserver: class {
    constructor(fn) {
      observer = fn;
    }
    observe(node) {
      assert.equal(node, bar);
    }
    disconnect() {
      disconnected = true;
    }
  },
};
function flush() {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((fn) => fn());
}
const stop = installStudentViewport(host);
observer();
host.listeners.get('resize')();
assert.equal(frames.size, 1, 'resize and observer work coalesces into one frame');
flush();
assert.equal(properties.get('--action-height'), '96px');
assert.equal(properties.get('--student-keyboard-inset'), '0px');
assert.equal(properties.get('--student-viewport-top'), '0px');
const beforeScrolling = measurements;
for (let i = 0; i < 100; i++) {
  viewport.listeners.get('scroll')({ target: viewport });
  flush();
}
assert.equal(
  measurements,
  beforeScrolling,
  'visual viewport scrolling reuses observed bar geometry',
);
writes = 0;
observer();
flush();
assert.equal(writes, 0, 'unchanged geometry produces no style writes');
height = 176;
observer();
flush();
assert.equal(
  properties.get('--action-height'),
  '176px',
  'large/wrapped action text gets actual reserved space',
);
viewport.height = 420;
viewport.listeners.get('resize')({ target: viewport });
flush();
assert.equal(properties.get('--student-keyboard-inset'), '324px');
assert.equal(properties.get('--student-visible-height'), '420px');
assert.equal(scrolls, 1, 'occluded typing field is revealed above keyboard/actions');
viewport.height = 744;
viewport.offsetTop = 0;
viewport.listeners.get('resize')({ target: viewport });
flush();
assert.equal(scrolls, 1, 'visible field is not moved');
assert.equal(properties.get('--student-keyboard-inset'), '0px');
// A modal owns its action buttons: the hidden lesson footer must not move its input.
doc.activeElement.closest = () => ({});
viewport.height = 420;
viewport.offsetTop = 80;
doc.activeElement.getBoundingClientRect = () => ({ top: 370, bottom: 430 });
viewport.listeners.get('resize')({ target: viewport });
flush();
assert.equal(properties.get('--student-viewport-top'), '80px');
assert.equal(scrolls, 1, 'visible dialog input does not reserve the lesson footer');
doc.activeElement.getBoundingClientRect = () => ({ top: 30, bottom: 86 });
viewport.listeners.get('scroll')({ target: viewport });
flush();
assert.equal(scrolls, 2, 'dialog input above the panned visual viewport is revealed');
delete doc.activeElement.closest;
height = 0;
observer();
flush();
assert.equal(properties.get('--action-height'), '96px');
observer();
stop();
assert.equal(frames.size, 0);
assert.ok(disconnected);
assert.equal(host.listeners.size + viewport.listeners.size + doc.listeners.size, 0);
observer();
assert.equal(frames.size, 0, 'a queued observer callback cannot revive a disposed viewport');
assert.doesNotThrow(() => installStudentViewport({})());
console.log(
  'Student viewport: coalesced resize, actual/wrapped footer reservation, keyboard inset, guarded input reveal, unchanged writes and cleanup passed.',
);
