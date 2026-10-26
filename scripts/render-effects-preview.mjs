import { mkdirSync, writeFileSync } from 'node:fs';
import { renderCue } from '../public/effects/sound-bank.js';
const rate = 44100;
const names = ['click', 'select', 'letter', 'remove', 'correct', 'wrong', 'streak', 'complete'];
const parts = [],
  times = [];
let cursor = 0;
for (const name of names) {
  const pcm = renderCue(name, rate);
  times.push({ name, seconds: cursor / rate, duration: pcm.length / rate });
  parts.push(pcm, new Float32Array(rate * 0.35));
  cursor += pcm.length + rate * 0.35;
}
const bytes = Buffer.alloc(44 + cursor * 2);
bytes.write('RIFF', 0);
bytes.writeUInt32LE(bytes.length - 8, 4);
bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(1, 22);
bytes.writeUInt32LE(rate, 24);
bytes.writeUInt32LE(rate * 2, 28);
bytes.writeUInt16LE(2, 32);
bytes.writeUInt16LE(16, 34);
bytes.write('data', 36);
bytes.writeUInt32LE(cursor * 2, 40);
let offset = 44;
for (const part of parts)
  for (const value of part) {
    bytes.writeInt16LE(Math.round(value * 0.55 * 0.7 * 32767), offset);
    offset += 2;
  }
mkdirSync('output', { recursive: true });
writeFileSync('output/ui45-sounds.wav', bytes);
writeFileSync('output/ui45-sounds.json', JSON.stringify(times, null, 2));
console.log('Original sound preview:', times);
