import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {readFileSync,statSync} from 'node:fs';
for(const route of ['/','/teacher','/teacher-editor','/race-teacher']){const r=await worker.fetch(new Request('https://classroom.test'+route),{});assert.equal(r.status,200);assert.match(await r.text(),/teacher-music\.js/)}
for(const route of ['/?student=1','/student','/race']){const r=await worker.fetch(new Request('https://classroom.test'+route),{});assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/teacher-music\.js|teacher-lobby/)}
const r=await worker.fetch(new Request('https://classroom.test/assets/teacher-lobby.m4a'),{});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/^audio\/mp4/);assert.equal((await r.arrayBuffer()).byteLength,statSync('public/assets/teacher-lobby.m4a').size);
assert.match(readFileSync('public/settings.js','utf8'),/musicVolume:\s*20/);
console.log('PASS: music loaded only in teacher home and teacher routes, excluded from student practice/student race, AAC audio served intact with correct MIME, default music volume 20%.');
