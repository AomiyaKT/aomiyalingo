import assert from 'node:assert/strict';
import { createRaceRecords } from '../public/race/records.js';
const { createRaceViews } = await import(process.env.AOMI_VIEW_MODULE || '../public/race/views.js');

let created = 0,
  textWrites = 0,
  styleWrites = 0;
class Node {
  constructor(tag, text = '', cls = '') {
    created++;
    this.tag = tag;
    this._text = text;
    this.className = cls;
    this.children = [];
    this.dataset = {};
    this.style = new Proxy(
      {},
      {
        set(target, key, value) {
          styleWrites++;
          target[key] = value;
          return true;
        },
      },
    );
    this.attrs = new Map();
    this.classList = { toggle() {}, add() {}, remove() {} };
    this.listeners = new Map();
  }
  get textContent() {
    return this._text;
  }
  get options() {
    return this.children.filter((n) => n.tag === 'option');
  }
  get selectedIndex() {
    return Math.max(
      0,
      this.options.findIndex((n) => n.value === this.value),
    );
  }
  get text() {
    return this.textContent;
  }
  contains(node) {
    return this === node || this.children.some((n) => n.contains(node));
  }
  closest(tag) {
    return this.tag === tag ? this : this.parent?.closest(tag) || null;
  }
  addEventListener(name, fn) {
    this.listeners.set(name, fn);
  }
  focus() {
    globalThis.document.activeElement = this;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.listeners.get('close')?.();
  }
  set textContent(value) {
    textWrites++;
    this._text = value;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.remove();
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const node of this.children) node.parent = null;
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    }
  }
  insertBefore(node, before) {
    node.remove();
    const at = before ? this.children.indexOf(before) : this.children.length;
    this.children.splice(at, 0, node);
    node.parent = this;
  }
  querySelectorAll(selector) {
    const result = [];
    for (const node of this.children) {
      if (
        selector.startsWith('.')
          ? node.className.split(' ').includes(selector.slice(1))
          : node.tag === selector
      )
        result.push(node);
      result.push(...node.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) {
    const split = selector.indexOf(' ');
    if (split >= 0)
      return this.querySelector(selector.slice(0, split))?.querySelector(selector.slice(split + 1));
    const identity = selector.match(/^\[data-id="(.+)"\]$/);
    if (identity) return this.children.find((node) => node.dataset.id === identity[1]) || null;
    return this.querySelectorAll(selector)[0] || null;
  }
  setAttribute(k, v) {
    this.attrs.set(k, v);
  }
  getAttribute(k) {
    return this.attrs.get(k) ?? null;
  }
}
const wall = new Node('div');
let data = { race: { id: 'r1', rules: 6, status: 'running', endless: true } };
const view = createRaceViews({
  q: () => wall,
  make: (...args) => new Node(...args),
  isTeacher: false,
  avatars: { cat: { name: 'Cat', src: '/cat.png', scale: 100, x: 0, y: 0 } },
  getData: () => data,
  appSettings: { values: { reduceMotion: true } },
});
const players = Array.from({ length: 35 }, (_, i) => ({
  id: 'p' + i,
  alias: '出席番号 ' + (i + 1),
  label: String(i + 1),
  avatar: 'cat',
  rank: i + 1,
  score: 3500 - i * 100,
  accuracy: 90,
  index: 50,
  stationIndex: 50,
}));
const lanes = new Node('div');
view.lanes(lanes, players, 'p0');
view.drawWall(players);
const original = lanes.children[0].querySelector('.lane-score').children[0];
created = textWrites = styleWrites = 0;
for (let i = 0; i < 100; i++) {
  view.lanes(lanes, players, 'p0');
  view.drawWall(players);
}
console.log(
  JSON.stringify({
    frames: 100,
    learners: 35,
    unchangedNodesCreated: created,
    unchangedTextWrites: textWrites,
  }),
);
assert.equal(created, 0, '100 unchanged 35-person polls create zero lane/participant nodes');
assert.equal(textWrites, 0, 'Unchanged lane labels/scores/participant captions are retained');
assert.equal(styleWrites, 0, 'Unchanged polls do not rewrite avatar positions');
assert.equal(lanes.children[0].querySelector('.lane-score').children[0], original);
const podium = new Node('div');
podium.hidden = true;
const guarded = players.map((p) => ({
  ...p,
  get history() {
    throw Error('Podium inspected history');
  },
}));
view.podium(podium, guarded);
assert.equal(podium.children.length, 0, 'Hidden podium is not rendered');
podium.hidden = false;
data = { race: { ...data.race, status: 'finished' } };
view.podium(podium, guarded);
const card = podium.children[0];
created = textWrites = 0;
view.podium(
  podium,
  players.map((p) => ({
    ...p,
    remaining: 0,
    get history() {
      throw Error('Podium inspected history');
    },
  })),
);
assert.equal(created, 0, 'Timers and record histories do not invalidate podium cards');
assert.equal(podium.children[0], card);
view.podium(podium, [
  { ...players[1], rank: 1 },
  ...players
    .filter((p) => p.id !== players[1].id)
    .map((p) => ({ ...p, rank: p.rank === 1 ? 2 : p.rank })),
]);
assert.notEqual(podium.children[0], card, 'A real podium winner change still redraws');
console.log(
  'Race refresh view: 100 × 35 learners create zero unchanged nodes/text; hidden podium skipped; records never inspected; real winner changes still update.',
);

const previousDocument = globalThis.document;
globalThis.document = {
  createElement: (tag) => new Node(tag),
  activeElement: null,
};
try {
  const section = new Node('details'),
    root = new Node('div');
  section.open = true;
  section.append(root);
  const records = createRaceRecords(root);
  const participants = players.map((p) => ({ ...p, recordRevision: 1, history: [] }));
  const frame = () => ({ race: { id: 'records-r1' }, players: participants });
  records(frame());
  const body = root.querySelector('tbody');
  const firstRow = body.children[0];
  const detail = firstRow.querySelector('button');
  detail.focus();
  created = textWrites = 0;
  for (let i = 0; i < 100; i++) {
    participants[34] = { ...participants[34], score: 5000 + i };
    records(frame());
  }
  console.log(JSON.stringify({ recordRefreshes: 100, created, textWrites }));
  assert.equal(body.children[0], firstRow, 'Updating another score preserves visible rows');
  assert.equal(
    body.children[0].querySelector('button'),
    detail,
    'A press target must survive polls',
  );
  assert.equal(globalThis.document.activeElement, detail);
  assert.equal(created, 0, 'Score-only changes create no new record overview nodes');
  assert.equal(textWrites, 0, 'Unchanged displayed record values need no writes');
  const pagination = root.querySelector('.record-pagination');
  const next = pagination.children[2];
  next.onclick();
  assert.equal(body.children[0].children[0].children[0].textContent, '13');
  next.onclick();
  assert.equal(body.children.length, 11, 'The last page only retains its visible records');
  assert.equal(next.disabled, true);
  pagination.children[0].onclick();
  pagination.children[0].onclick();
  assert.equal(body.children[0].children[0].children[0].textContent, '1');
  const currentRow = body.children[0],
    currentDetail = currentRow.querySelector('button');
  participants[0] = {
    ...participants[0],
    recordRevision: 2,
    history: [{ word: 'music', mode: 'text', correct: false, points: 0, station: 0 }],
  };
  records(frame());
  assert.equal(body.children[0], currentRow);
  assert.equal(currentRow.children[1].children[0].textContent, '0%');
  assert.equal(currentRow.children[2].textContent, '0 / 1問');
  currentDetail.onclick();
  const dialog = root.querySelector('dialog');
  assert.equal(dialog.open, true, 'The retained button still opens the latest answer snapshot');
  const snapshotContent = dialog.querySelector('.record-dialog-content').children[0];
  participants[0] = {
    ...participants[0],
    recordRevision: 3,
    history: [
      ...participants[0].history,
      { word: 'math', mode: 'text', correct: true, points: 100, station: 0 },
    ],
  };
  records(frame());
  assert.equal(
    dialog.querySelector('.record-dialog-content').children[0],
    snapshotContent,
    'An open detail keeps its reading snapshot',
  );
  dialog.close();
  assert.equal(globalThis.document.activeElement, currentDetail);
  const [stage, sort] = root.querySelectorAll('select');
  stage.value = '1';
  stage.onchange();
  assert.equal(body.children[0], currentRow, 'Changing scope retains each visible student row');
  assert.equal(currentRow.children[1].children[0].textContent, '—');
  assert.equal(currentRow.children[2].textContent, '0 / 0問');
  stage.value = 'all';
  stage.onchange();
  assert.equal(currentRow.children[1].children[0].textContent, '50%');
  participants[20] = {
    ...participants[20],
    recordRevision: 2,
    history: [{ word: 'food', mode: 'text', correct: false, station: 0 }],
  };
  records(frame());
  sort.value = 'attention';
  sort.onchange();
  assert.equal(body.children[0].children[0].children[0].textContent, '21');
  assert.equal(body.children[1], currentRow, 'Sorting moves an existing student row intact');
  const search = root.querySelector('input');
  search.value = '999';
  search.oninput();
  assert.equal(body.children.length, 1, 'Empty search retains its explanatory row');
  search.value = '';
  search.oninput();
  assert.equal(body.children.length, 12);
  records({ race: { id: 'records-r2' }, players: participants.slice(0, 1) });
  assert.notEqual(body.children[0], firstRow, 'Different races never share row ownership');
} finally {
  globalThis.document = previousDocument;
}
