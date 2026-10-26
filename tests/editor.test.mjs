import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
async function req(path,data,headers={}){const response=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);let body;try{body=await response.clone().json()}catch{}return {status:response.status,body,response}}
assert.equal((await req('/api/teacher/config')).status,401);
const login=await req('/api/teacher/login',{password:'test-password'}),auth={cookie:login.response.headers.get('set-cookie').split(';')[0]};
const original=(await req('/api/teacher/config',undefined,auth)).body;assert.equal(original.revision,0);assert.equal(original.config.words.length,28);
const oldRoom=(await req('/api/teacher/classes',{title:'Before edit'},auth)).body;
const oldRace=(await req('/api/teacher/race/create',{title:'Before edit'},auth)).body.raceId;
const oldTasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(oldRace).first()).tasks);
const c=structuredClone(original.config);c.words[0].meaning='食べました';c.words[0].distractors=['眠った','走った','泳いだ'];c.words.push({word:'jumped',meaning:'跳んだ',group:'verb',base:'jump',example:'I jumped.',enabled:true,distractors:[],audio:null});c.course.wordIds=['ate','enjoyed','watched','jumped'];c.course.modes=['text'];c.course.roundSize=4;c.race.wordIds=c.course.wordIds;c.race.modes=['text'];Object.assign(c.race,{questions:6,minutes:2,countdown:0,itemEvery:3,items:['boost'],correctPoints:120,hintPoints:50,reviewPoints:30,boostPoints:20,boostCount:1,goalPercent:100});
const saved=await req('/api/teacher/config',{config:c,revision:0},auth);assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
assert.equal((await req('/api/teacher/config',{config:c,revision:0},auth)).status,409);
assert.equal((await req('/api/teacher/config',{config:c,revision:1},{...auth,origin:'https://evil.test'})).status,403);
for(const modify of [x=>x.words[0].word='BAD!',x=>x.words[0].audio='https://evil.test/',x=>x.race.questions=999,x=>x.race.hintPoints=999,x=>x.course.wordIds=[],x=>x.race.items=['attack'],x=>x.words[1].meaning=x.words[0].meaning]){const bad=structuredClone(c);modify(bad);assert.equal((await req('/api/teacher/config',{config:bad,revision:1},auth)).status,400)}
const room=(await req('/api/teacher/classes',{title:'After edit'},auth)).body;assert.equal(room.round_size,4);assert.deepEqual(JSON.parse(room.modes),['text']);assert.equal(JSON.parse(room.vocabulary).length,4);
// Reopen original immutable class: its original meaning still grades correctly.
await req('/api/teacher/class-state',{classId:oldRoom.id,action:'reopen'},auth);
const oldJoin=(await req('/api/join',{label:'1',classId:oldRoom.id})).body;assert.equal(oldJoin.lesson.vocabulary.find(w=>w.word==='ate').meaning,'食べた');
const oldTask=oldJoin.lesson.queue[0],oldWord=oldJoin.lesson.vocabulary.find(w=>w.word===oldTask.word),oldAnswer=oldTask.mode==='text'?[oldWord.meaning]:[oldWord.word];assert.equal((await req('/api/student/answer',{questionId:oldTask.id,answer:oldAnswer},{authorization:'Bearer '+oldJoin.token})).body.correct,true);
await req('/api/teacher/class-state',{classId:room.id,action:'reopen'},auth);
const joined=(await req('/api/join',{label:'2',classId:room.id})).body;assert.equal(joined.lesson.total,4);assert.equal(joined.lesson.vocabulary.find(w=>w.word==='ate').meaning,'食べました');
assert.deepEqual(JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(oldRace).first()).tasks),oldTasks);
const raceId=(await req('/api/teacher/race/create',{title:'Custom race'},auth)).body.raceId;
const entrant=(await req('/api/race/join',{raceId,label:'3'})).body,headers={authorization:'Bearer '+entrant.token};
assert.equal(entrant.race.total,18);assert.equal(entrant.race.remaining,120000);assert.equal(entrant.team.target,6);
await req('/api/teacher/race/state',{raceId,action:'start'},auth);
const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks);assert.ok(tasks.every(t=>t.mode==='text'));assert.equal(tasks.find(t=>t.word==='ate').content.meaning,'食べました');assert.ok(tasks.find(t=>t.word==='ate').options.includes('眠った'));
let result;for(let i=0;i<6;i++){const me=(await req('/api/race/me',undefined,headers)).body;if(i===3){assert.equal(me.self.item,'boost');await req('/api/race/item',{questionId:me.self.task.id},headers)}result=(await req('/api/race/answer',{questionId:me.self.task.id,answer:tasks.find(t=>t.id===me.self.task.id).content.meaning},headers)).body;assert.equal(result.receipt.points,(i===3?140:120)+Math.min(100,i*20))}
assert.equal(result.race.status,'intermission');assert.equal(result.self.score,1040);assert.equal(result.self.learning.badges.some(b=>b.id==='finish'),false);assert.equal(result.stationResults[0].closed,true);
// Subsequent edits compare-and-swap; concurrent saves yield one winner.
const writes=await Promise.all([req('/api/teacher/config',{config:c,revision:1},auth),req('/api/teacher/config',{config:c,revision:1},auth)]);assert.deepEqual(writes.map(x=>x.status).sort(),[200,409]);
assert.equal((await req('/api/teacher/config/audio',{mime:'audio/wav',data:btoa('<html>Not audio</html>')},auth)).status,400);
const bytes=new Uint8Array(48);bytes.set(new TextEncoder().encode('RIFF'));bytes.set(new TextEncoder().encode('WAVE'),8);const audio=(await req('/api/teacher/config/audio',{mime:'audio/wav',data:btoa(String.fromCharCode(...bytes))},auth)).body.audio;const asset=await req(audio);assert.equal(asset.status,200);assert.equal(asset.response.headers.get('content-type'),'audio/wav');assert.equal((await asset.response.arrayBuffer()).byteLength,48);
assert.equal((await req('/teacher-editor')).status,200);
console.log('PASS: editor authorization/CSRF/validation, conflicting saves, vocabulary and course snapshots, custom race length/time/score/items/team goal/finish, historical preservation, audio upload and delivery.');
