import assert from 'node:assert/strict';
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
  }
  get textContent() {
    return this._text;
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
