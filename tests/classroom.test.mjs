import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
const words=JSON.parse(readFileSync('public/vocabulary.js','utf8').split('=')[1].split(';')[0]);
async function req(path,data,headers={}){const response=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{...headers,'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);let body;try{body=await response.clone().json()}catch{}return {response,body}}
assert.equal((await req('/api/teacher/classes')).response.status,401);
assert.equal((await req('/api/join',{label:'3'})).response.status,409);
assert.equal((await req('/api/teacher/login',{password:'bad'})).response.status,401);
const login=await req('/api/teacher/login',{password:'test-password'});assert.equal(login.response.status,200);const teacher={cookie:login.response.headers.get('set-cookie').split(';')[0]};
assert.equal((await req('/api/teacher/classes',{title:'Bad'},{...teacher,origin:'https://other.test'})).response.status,403);
const room=(await req('/api/teacher/classes',{title:'Test class',roundSize:6},teacher)).body;
assert.equal((await req('/api/class/current')).body.classroom.id,room.id);
assert.equal((await req('/api/join',{label:'0'})).response.status,400);
const s1=(await req('/api/join',{label:'01'})).body,s2=(await req('/api/join',{label:'2'})).body;
assert.equal(s1.label,'1');assert.equal(s1.lesson.total,words.length*3);assert.equal(s1.lesson.version,2);assert.equal(s1.lesson.rounds,Math.ceil(words.length*3/6));
assert.equal((await req('/api/join',{label:'1'})).body.code,'DUPLICATE');
let student={authorization:'Bearer '+s1.token};
assert.equal((await req('/api/teacher/classes',undefined,student)).response.status,401);
assert.equal((await req('/api/student/answer',{questionId:s2.lesson.queue[0].id,answer:['wrong']},student)).response.status,409);
let l=(await req('/api/student/start',{},student)).body.lesson;assert.equal(l.queue[0].id,s1.lesson.queue[0].id);let task=l.queue[0],firstWord=task.word;
// A failed transaction leaves the question intact; retrying saves exactly once.
const realBatch=env.DB.batch;env.DB.batch=async()=>{throw Error('simulated database outage')};
assert.equal((await req('/api/student/answer',{questionId:task.id,answer:['wrong']},student)).response.status,503);
assert.equal((await req('/api/student/me',undefined,student)).body.lesson.attempts,0);
env.DB.batch=realBatch;
let result=await req('/api/student/answer',{questionId:task.id,answer:['wrong']},student);assert.equal(result.body.correct,false);l=result.body.lesson;assert.equal(l.attempts,1);assert.equal(l.completed,1);
const duplicate=await req('/api/student/answer',{questionId:task.id,answer:['wrong']},student);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.lesson.attempts,1);
assert.equal((await req('/api/student/me',undefined,student)).body.lesson.attempts,1);
let board=(await req('/api/teacher/progress?class='+room.id,undefined,teacher)).body;assert.equal(board.students.length,2);assert.equal(board.students[0].needsHelp,1);assert.equal(board.students[0].firstAccuracy,0);
while(l.queue.length){task=l.queue[0];const w=words.find(w=>w.word===task.word);const answer=task.mode==='spelling'?w.word:[task.mode==='text'?w.meaning:w.word];result=await req('/api/student/answer',{questionId:task.id,answer,hintUsed:task.mode==='spelling'},student);assert.equal(result.response.status,200);assert.equal(result.body.correct,true);l=result.body.lesson}
assert.equal(l.completed,words.length*3);assert.ok(l.attempts>=words.length*3+1&&l.attempts<=words.length*3+Math.ceil(words.length*3/6)*2);assert.equal(l.finishedRounds.length,Math.ceil(words.length*3/6));assert.ok(l.finishedRounds.every(r=>r.answers<=8));
board=(await req('/api/teacher/progress?class='+room.id,undefined,teacher)).body;assert.equal(board.students[0].done,true);assert.equal(board.students[0].firstCount,words.length*3);assert.equal(board.students[0].corrected,1);assert.equal(board.students[0].firstAccuracy,Math.round((words.length*3-1)/(words.length*3)*100));assert.equal(board.students[0].needsHelp,0);assert.equal(board.students[0].supported,words.length);assert.ok(board.attempts.some(a=>a.hint_used));
assert.equal((await req('/api/student/start',{review:true},student)).response.status,200);const focus=(await req('/api/student/me',undefined,student)).body.lesson;assert.equal(focus.practiceMode,'review');assert.equal(focus.total,words.length);assert.ok(focus.queue.every(t=>t.mode==='spelling'));assert.equal((await req('/api/student/start',{review:true},student)).response.status,409);
// Three independent controls: joins can stop while existing students continue.
await req('/api/teacher/class-state',{classId:room.id,action:'join-stop'},teacher);assert.equal((await req('/api/join',{label:'3'})).response.status,409);assert.equal((await req('/api/student/start',{mode:'spelling',reset:true},student)).response.status,200);
await req('/api/teacher/class-state',{classId:room.id,action:'join-open'},teacher);
await req('/api/teacher/class-state',{classId:room.id,action:'pause'},teacher);assert.equal((await req('/api/student/status',undefined,student)).body.paused,true);assert.equal((await req('/api/join',{label:'3'})).response.status,200);
const frozen=(await req('/api/student/me',undefined,student)).body.lesson;assert.equal((await req('/api/student/start',{reset:true},student)).response.status,423);assert.equal((await req('/api/student/answer',{questionId:frozen.queue[0].id,answer:frozen.queue[0].word},student)).body.code,'CLASS_PAUSED');assert.deepEqual((await req('/api/student/me',undefined,student)).body.lesson,frozen);
await req('/api/teacher/class-state',{classId:room.id,action:'resume'},teacher);
assert.equal((await req('/api/student/label',{label:'2'},student)).response.status,409);assert.equal((await req('/api/student/label',{label:'11'},student)).body.label,'11');assert.equal((await req('/api/student/me',undefined,student)).body.label,'11');
// A device transfer requires teacher approval and revokes the old device token.
const recover=(await req('/api/recovery/request',{classId:room.id,label:'11'})).body;const recoveryAuth={authorization:'Bearer '+recover.token};assert.equal((await req('/api/recovery/status',undefined,recoveryAuth)).body.status,'pending');assert.equal((await req('/api/teacher/recovery',{requestId:recover.id,approve:true},student)).response.status,401);assert.equal((await req('/api/teacher/progress?class='+room.id,undefined,teacher)).body.recovery.length,1);
await req('/api/teacher/recovery',{requestId:recover.id,approve:true},teacher);const restored=(await req('/api/recovery/status',undefined,recoveryAuth)).body;assert.equal(restored.session.id,s1.id);assert.deepEqual(restored.session.lesson,frozen);assert.equal((await req('/api/student/me',undefined,student)).response.status,401);student=recoveryAuth;
await req('/api/teacher/class-state',{classId:room.id,action:'end'},teacher);assert.equal((await req('/api/student/status',undefined,student)).body.ended,true);assert.equal((await req('/api/student/start',{},student)).response.status,423);assert.equal((await req('/api/join',{label:'4'})).response.status,409);
const csv=await req('/api/teacher/export?class='+room.id,undefined,teacher);assert.equal(csv.response.status,200);assert.ok((await csv.response.text()).includes('修正済み'));assert.equal((await req('/api/teacher/export?class='+room.id)).response.status,401);
await req('/api/teacher/class-state',{classId:room.id,action:'reopen'},teacher);assert.deepEqual((await req('/api/student/me',undefined,student)).body.lesson,frozen);
// All-wrong learners still reach short breaks and a finite endpoint.
l=(await req('/api/student/start',{reset:true},student)).body.lesson;let loops=0;while(l.queue.length){task=l.queue[0];result=await req('/api/student/answer',{questionId:task.id,answer:task.mode==='spelling'?'z'.repeat(task.word.length):['wrong']},student);assert.equal(result.response.status,200);l=result.body.lesson;assert.ok(++loops<=words.length*3+Math.ceil(words.length*3/6)*2)}assert.equal(l.completed,words.length*3);assert.ok(l.finishedRounds.every(r=>r.answers<=8));assert.ok(l.needsReview.length>0);
const next=(await req('/api/teacher/classes',{title:'Next class',roundSize:8},teacher)).body;assert.notEqual(next.id,room.id);assert.equal((await req('/api/student/me',undefined,student)).body.active,false);const newStudent=(await req('/api/join',{label:'11'})).body;assert.equal(newStudent.classId,next.id);assert.equal(newStudent.lesson.roundSize,8);
// Thirty independent learners submit concurrently, with no mixed identities or double-counting.
const peers=await Promise.all(Array.from({length:30},(_,i)=>req('/api/join',{label:String(100+i)})));assert.ok(peers.every(p=>p.response.status===200));
const submissions=await Promise.all(peers.map(p=>{const t=p.body.lesson.queue[0],w=words.find(w=>w.word===t.word);return req('/api/student/answer',{questionId:t.id,answer:[w.meaning]},{authorization:'Bearer '+p.body.token})}));assert.ok(submissions.every(r=>r.response.status===200));const peerBoard=(await req('/api/teacher/progress?class='+next.id,undefined,teacher)).body;assert.equal(peerBoard.students.filter(s=>Number(s.label)>=100&&s.completed===1&&s.attempts===1).length,30);
// Previously saved v1 lessons keep their question IDs and can finish unchanged.
const old={queue:[{id:'legacy-task',word:'ate',mode:'text'}],total:1,completed:0,attempts:1,missed:[],practiceMode:null};await env.DB.prepare('UPDATE students SET lesson=? WHERE id=?').bind(JSON.stringify(old),newStudent.id).run();const legacyAuth={authorization:'Bearer '+newStudent.token};assert.equal((await req('/api/student/start',{},legacyAuth)).body.lesson.queue[0].id,'legacy-task');assert.equal((await req('/api/student/answer',{questionId:'legacy-task',answer:['食べた']},legacyAuth)).body.lesson.completed,1);
await req('/api/teacher/logout',{},teacher);assert.equal((await req('/api/teacher/classes',undefined,teacher)).response.status,401);
console.log('PASS: full vocabulary question set, bounded short rounds (including all-wrong), legacy progress, independent class controls, persistent server resume, number correction, teacher-approved transfer, first-attempt diagnostics, hints, CSV and access isolation.');
