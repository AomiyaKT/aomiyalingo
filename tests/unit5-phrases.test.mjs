import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
async function req(path,data,headers={}){const response=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);let body;try{body=await response.clone().json()}catch{}return {status:response.status,body,response}}
const login=await req('/api/teacher/login',{password:'test-password'}),auth={cookie:login.response.headers.get('set-cookie').split(';')[0]};
let cfg=(await req('/api/teacher/config',undefined,auth)).body;
const additions=cfg.config.words.filter(w=>w.group==='phrase');
assert.equal(cfg.config.words.length,28);
assert.deepEqual(additions.map(w=>w.word),['saved many people','wrote many books','made beautiful dresses','created popular movies','won the Nobel Prize','created many songs','got a gold medal','made many records','performed in TV dramas']);
for(const w of additions){const r=await req(w.audio);assert.equal(r.status,200);const bytes=new Uint8Array(await r.response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.ok(bytes.length>10000)}
const room=(await req('/api/teacher/classes',{grade:6,unit:'4-5',wordGroup:'phrase'},auth)).body;
assert.equal(JSON.parse(room.vocabulary).filter(w=>w.group==='phrase').length,9);
let joined=(await req('/api/join',{classId:room.id,label:'5'})).body;assert.equal(joined.lesson.total,27);
let lesson=joined.lesson;const student={authorization:'Bearer '+joined.token};
while(lesson.queue.length){const t=lesson.queue[0],w=additions.find(w=>w.word===t.word);const r=await req('/api/student/answer',{questionId:t.id,answer:t.mode==='text'?[w.meaning]:t.mode==='voice'?[w.word]:w.word.toLowerCase()},student);assert.equal(r.status,200);assert.equal(r.body.correct,true);lesson=r.body.lesson}
// Simulate saved pre-update configuration, with immutable historical class content.
const legacy=structuredClone(cfg.config);delete legacy.unit5Supplement;legacy.words=legacy.words.filter(w=>w.group!=='phrase');legacy.words[0].meaning='食べました';legacy.course.wordIds=legacy.words.map(w=>w.word);legacy.race.wordIds=legacy.course.wordIds.slice();
await env.DB.prepare('INSERT INTO app_config (id,data,revision) VALUES (1,?,4)').bind(JSON.stringify(legacy)).run();
cfg=(await req('/api/teacher/config',undefined,auth)).body;
assert.equal(cfg.config.words.length,28);assert.equal(cfg.config.course.wordIds.length,28);assert.equal(cfg.config.race.wordIds.length,28);assert.equal(cfg.config.words[0].meaning,'食べました');assert.equal(cfg.revision,4);
const custom=structuredClone(legacy);custom.course.wordIds=legacy.words.slice(0,4).map(w=>w.word);custom.race.wordIds=custom.course.wordIds.slice();await env.DB.prepare('UPDATE app_config SET data=? WHERE id=1').bind(JSON.stringify(custom)).run();
cfg=(await req('/api/teacher/config',undefined,auth)).body;assert.equal(cfg.config.words.length,28);assert.equal(cfg.config.course.wordIds.length,4);assert.equal(cfg.config.race.wordIds.length,4);
// New editors retain intentional deletion; the upgrade must not re-add deleted phrases.
cfg.config.words=cfg.config.words.filter(w=>w.word!=='saved many people');assert.equal((await req('/api/teacher/config',cfg,auth)).status,200);assert.equal((await req('/api/teacher/config',undefined,auth)).body.config.words.some(w=>w.word==='saved many people'),false);
assert.equal(JSON.parse((await env.DB.prepare('SELECT vocabulary FROM classrooms WHERE id=?').bind(room.id).first()).vocabulary).filter(w=>w.group==='phrase').length,9);
// Race accepts lowercase selected letters while preserving textbook capitals in feedback.
cfg=(await req('/api/teacher/config',undefined,auth)).body;cfg.config.race.wordIds=additions.filter(w=>w.word!=='saved many people').map(w=>w.word);cfg.config.race.modes=['spelling'];cfg.config.race.questions=8;cfg.config.race.countdown=0;
assert.equal((await req('/api/teacher/config',cfg,auth)).status,200);
const raceId=(await req('/api/teacher/race/create',{grade:6},auth)).body.raceId;
const racer=(await req('/api/race/join',{raceId,label:'5'})).body,racerAuth={authorization:'Bearer '+racer.token};await req('/api/teacher/race/state',{raceId,action:'start'},auth);
let state=(await req('/api/race/me',undefined,racerAuth)).body;const caps=new Set();
for(let i=0;i<8;i++){const task=state.self.task;assert.ok(task.letters.every(x=>/^[a-z]$/.test(x)));assert.ok(/^_+( _+)*$/.test(task.spellingPattern));const answer=task.spoken.toLowerCase();const result=await req('/api/race/answer',{questionId:task.id,answer},racerAuth);assert.equal(result.status,200);assert.equal(result.body.receipt.correct,true);if(/[A-Z]/.test(task.spoken)){caps.add(task.spoken);assert.equal(result.body.receipt.expected,task.spoken)}state=result.body}
assert.deepEqual([...caps].sort(),['performed in TV dramas','won the Nobel Prize']);
console.log('PASS: only nine illustrated phrases, recordings, 27 exercises, old-bank expansion, custom-pool and edited-meaning preservation, intentional deletion, snapshots, capitalized phrase race spelling.');
