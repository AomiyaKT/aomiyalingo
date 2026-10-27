import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
async function req(path,data,headers={}){const response=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);let body;try{body=await response.clone().json()}catch{}return {status:response.status,body,response}}
const login=await req('/api/teacher/login',{password:'test-password'}),auth={cookie:login.response.headers.get('set-cookie').split(';')[0]};
const initial=(await req('/api/teacher/config',undefined,auth)).body;
const jobs=initial.config.unit7.words;
assert.deepEqual(jobs.map(w=>w.word),['actor','teacher','police officer','illustrator','comedian','soccer player','pastry chef','pilot','farmer','voice actor','game creator','fire fighter','scientist','doctor','astronaut','baker','flight attendant','dentist','hairdresser','nursery school teacher','nurse','musician','vet','fashion designer']);
assert.ok(jobs.every(w=>w.group==='occupation'));
for(const w of jobs){const audio=await req(w.audio);assert.equal(audio.status,200);assert.equal(audio.response.headers.get('content-type'),'audio/wav');const bytes=new Uint8Array(await audio.response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.ok(bytes.length>10000)}
for(const input of [{grade:5,unit:'9'},{grade:6,unit:'9'},{grade:7,unit:'7'}]){assert.equal((await req('/api/teacher/classes',input,auth)).status,400);assert.equal((await req('/api/teacher/race/create',input,auth)).status,400)}
const old=(await req('/api/teacher/classes',{title:'Old unit'},auth)).body;
assert.equal(old.unit,'4-5');
const room=(await req('/api/teacher/classes',{grade:6,unit:'7',wordGroup:'occupation'},auth)).body;
assert.equal(room.unit,'7');assert.equal(room.grade,6);assert.equal(JSON.parse(room.vocabulary).length,24);
let joined=(await req('/api/join',{classId:room.id,label:'7'})).body,lesson=joined.lesson;
assert.equal(lesson.total,72);assert.equal(lesson.unit,'7');
const student={authorization:'Bearer '+joined.token},seen=new Set();
while(lesson.queue.length){const task=lesson.queue[0],w=jobs.find(w=>w.word===task.word);seen.add(task.mode+':'+w.word);const result=await req('/api/student/answer',{questionId:task.id,answer:task.mode==='text'?[w.meaning]:task.mode==='voice'?[w.word]:w.word},student);assert.equal(result.status,200);assert.equal(result.body.lesson.lastCorrect,true);lesson=result.body.lesson;assert.equal(lesson.unit,'7')}
assert.equal(seen.size,72);
const edited=structuredClone(initial.config);edited.unit7.words[0].example='My brother is an actor.';edited.unit7.race.modes=['spelling'];edited.unit7.race.countdown=0;
assert.equal((await req('/api/teacher/config',{config:edited,revision:0},auth)).status,200);
const saved=(await req('/api/teacher/config',undefined,auth)).body;assert.deepEqual(saved.config.words,initial.config.words);assert.deepEqual(saved.config.grade5,initial.config.grade5);
assert.equal(JSON.parse((await env.DB.prepare('SELECT vocabulary FROM classrooms WHERE id=?').bind(room.id).first()).vocabulary)[0].example,jobs[0].example);
const ctx=vm.createContext({console,Math,structuredClone});vm.runInContext(await (await req('/curriculum.js')).response.text()+'\n'+fs.readFileSync('public/vocabulary.js','utf8'),ctx);
for(const w of jobs){const value=JSON.stringify(w.word);assert.equal(vm.runInContext(`createSpellingLetters(${value}).includes(' ')`,ctx),false);assert.equal(vm.runInContext(`formatSpellingAnswer(${value},spellingCharacters(${value}))`,ctx),w.word)}
const raceId=(await req('/api/teacher/race/create',{grade:6,unit:'7',title:'Jobs race'},auth)).body.raceId;
let racer=(await req('/api/race/join',{raceId,label:'7'})).body;assert.equal(racer.race.settings.unit,'7');
await req('/api/teacher/race/state',{raceId,action:'start'},auth);
const racerAuth={authorization:'Bearer '+racer.token};racer=(await req('/api/race/me',undefined,racerAuth)).body;let phraseCount=0;
for(let i=0;i<24;i++){const task=racer.self.task;assert.equal(task.mode,'spelling');assert.equal(task.length,task.spoken.replaceAll(' ','').length);assert.equal(task.letters.includes(' '),false);const completed=vm.runInContext(`formatSpellingAnswer(${JSON.stringify(task.spellingPattern)},${JSON.stringify(task.spoken.replaceAll(' ',''))})`,ctx);assert.equal(completed,task.spoken);if(task.spoken.includes(' ')){phraseCount++;assert.equal((await req('/api/race/answer',{questionId:task.id,answer:task.spoken.replaceAll(' ','')},racerAuth)).status,400)}const result=await req('/api/race/answer',{questionId:task.id,answer:completed},racerAuth);assert.equal(result.status,200);assert.equal(result.body.receipt.correct,true);racer=result.body}
assert.equal(phraseCount,9);
// Pre-Unit-7 editors retain the separately saved new profile.
const older=structuredClone(saved.config);delete older.unit7;
assert.equal((await req('/api/teacher/config',{config:older,revision:1},auth)).status,200);
assert.equal((await req('/api/teacher/config',undefined,auth)).body.config.unit7.words[0].example,'My brother is an actor.');
console.log('PASS: 24 Unit 7 words/audio, 72 correct exercises, unit routing and validation, independent settings/snapshots, all 24 race spellings including 9 phrases with automatic spaces, old-client preservation.');
