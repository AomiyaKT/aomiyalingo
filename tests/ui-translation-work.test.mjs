import assert from 'node:assert/strict';
import { createUITranslator, translateUI } from '../public/shared/i18n.js';

let calls = 0;
const resolve = (s) => {
  calls++;
  return translateUI(s);
};
const cached = createUITranslator({ maxEntries: 3, maxChars: 500, resolve });
for (let i = 0; i < 1000; i++) assert.equal(cached('残り 5:00'), translateUI('残り 5:00'));
assert.equal(calls, 1, 'Repeated quarter-second labels resolve once');
cached('残り 4:59');
cached('残り 4:58');
cached('残り 5:00');
cached('残り 4:57');
const count = calls;
cached('残り 5:00');
assert.equal(calls, count, 'Recently used labels survive eviction');
cached('残り 4:59');
assert.equal(calls, count + 1);
assert.equal(cached('残り 5:00', 'ja'), '残り 5:00');
assert.equal(cached('Math'), 'Math');
assert.equal(cached(null), '');
assert.equal(cached('  正解：家族  '), '  Correct answer: 家族  ');
assert.equal(cached('正解：音楽'), 'Correct answer: 音楽', 'Opaque answers are keyed separately');
let largeCalls = 0;
const small = createUITranslator({
  maxChars: 8,
  resolve: (s) => {
    largeCalls++;
    return s;
  },
});
small('日'.repeat(100));
small('日'.repeat(100));
assert.equal(largeCalls, 2, 'Oversized titles are not retained');
small('日本');
small('英語');
small('日本');
small('国語');
const before = largeCalls;
small('日本');
assert.equal(largeCalls, before);
small('英語');
assert.equal(largeCalls, before + 1, 'Eviction charges source and translated characters');
const uncached = createUITranslator({ maxEntries: 0 });
for (const source of [
  '準備完了 35 / 35人',
  '残り 5:00',
  '1位 出席番号 23',
  '回答：日本語',
  '   設定\n',
])
  assert.equal(uncached(source), translateUI(source));
console.log(
  'Translation work: 1000 repeated labels resolve once, bounded count/characters, LRU, oversize bypass, languages and opaque answers passed.',
);
