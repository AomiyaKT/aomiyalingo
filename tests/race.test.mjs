import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
async function req(path,data,headers={}){const response=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);let body;try{body=await response.clone().json()}catch{}return {status:response.status,body,response}}
const login=await req('/api/teacher/login',{password:'test-password'}),teacher={cookie:login.response.headers.get('set-cookie').split(';')[0]};
const fixture=(await req('/api/teacher/config',undefined,teacher)).body;fixture.config.race.order='grouped';fixture.config.race.items=['hint','boost','review'];await req('/api/teacher/config',{config:fixture.config,revision:fixture.revision},teacher);
const classroom=(await req('/api/teacher/classes',{title:'Ordinary practice'},teacher)).body;
// Keep the original rules-2 suite as an immutable historical race fixture.
const create=async()=>{const response=await req('/api/teacher/race/create',{title:'Local race'},teacher),id=response.body.raceId;const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(id).first()).tasks).slice(0,24);for(const [i,t]of tasks.entries())t.rules=2;tasks[0].settings.items=['hint','boost','review'];tasks[0].settings.individualOrder=false;await env.DB.prepare('UPDATE races SET tasks=? WHERE id=?').bind(JSON.stringify(tasks),id).run();return response};
assert.equal((await req('/api/teacher/race/create',{title:'No auth'})).status,401);
const raceId=(await create()).body.raceId,command=action=>req('/api/teacher/race/state',{raceId,action,confirm:true},teacher);
assert.equal((await command('start')).status,409);
const peers=await Promise.all(Array.from({length:12},(_,i)=>req('/api/race/join',{raceId,label:String(i+1)})));
assert.ok(peers.every(p=>p.status===200));assert.equal(new Set(peers.map(p=>p.body.self.alias)).size,12);
assert.equal((await req('/api/race/join',{raceId,label:'1'})).status,409);
const headers=peers.map(p=>({authorization:'Bearer '+p.body.token})),me=i=>req('/api/race/me',undefined,headers[i]);
assert.equal((await req('/api/race/me')).status,401);
assert.equal((await req('/api/race/avatar',{avatar:'fox'})).status,401);
assert.equal((await req('/api/race/avatar',{avatar:'invalid'},headers[0])).status,400);
assert.equal((await req('/api/race/avatar',{avatar:'fox'},headers[0])).body.self.avatar,'fox');
assert.equal((await me(0)).body.board.find(p=>p.id===peers[0].body.self.id).avatar,'fox');
assert.equal((await me(1)).body.self.avatar,'cat');
const catalog=JSON.parse((await import('node:fs')).readFileSync('public/race-avatars.js','utf8').split('=')[1].split(';')[0]);
assert.ok(catalog.length>=35);assert.equal(new Set(catalog.map(a=>a.id)).size,catalog.length);
const images=new Set();for(const avatar of catalog){
 const saved=await req('/api/race/avatar',{avatar:avatar.id},headers[0]);assert.equal(saved.status,200);assert.equal(saved.body.self.avatar,avatar.id);
 const asset=await req(avatar.src);assert.equal(asset.status,200);assert.equal(asset.response.headers.get('content-type'),'image/png');
 const bytes=Buffer.from(await asset.response.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');images.add(bytes.toString('base64'));
}assert.equal(images.size,catalog.length);
assert.equal((await req('/api/race/avatar',{avatar:'https://example.test/avatar.png'},headers[0])).status,400);
await req('/api/race/avatar',{avatar:'fox'},headers[0]);

let first=(await me(0)).body;assert.equal(first.self.task.id,peers[1].body.self.task.id);assert.notDeepEqual(first.self.task.options,peers[1].body.self.task.options);assert.equal(first.self.task.expected,undefined);
assert.equal(first.board[0].label,undefined);assert.equal(first.board[0].history,undefined);
const task=first.self.task,answer=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks)[0];
const words=(await import('node:fs')).readFileSync('public/vocabulary.js','utf8');const vocab=JSON.parse(words.split('=')[1].split(';')[0]);
const expected=t=>{const w=vocab.find(w=>w.word===t.word);return t.mode==='text'?w.meaning:w.word};
assert.equal((await req('/api/race/answer',{questionId:task.id,answer:expected(answer)},headers[0])).status,423);
const startResult=await command('start');assert.equal(startResult.body.race.status,'countdown');assert.equal((await req('/api/race/answer',{questionId:task.id,answer:expected(answer)},headers[0])).status,423);assert.equal((await me(0)).body.race.remaining,360000);await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?').bind(Date.now(),raceId).run();assert.equal((await req('/api/race/avatar',{avatar:'panda'},headers[0])).status,409);assert.equal((await req('/api/race/join',{raceId,label:'99'})).status,409);
assert.equal((await req('/api/teacher/race/state',{raceId,action:'pause'},headers[0])).status,401);
assert.equal((await req('/api/teacher/race/state',{raceId,action:'pause'},{...teacher,origin:'https://other.test'})).status,403);
const submitted=await req('/api/race/answer',{questionId:task.id,answer:expected(answer),score:999999},headers[0]);assert.equal(submitted.body.self.score,100);
assert.equal((await req('/api/race/answer',{questionId:task.id,answer:expected(answer)},headers[0])).body.self.score,100);
await command('pause');let paused=(await me(0)).body;const pausedTime=paused.race.remaining;
assert.equal((await req('/api/race/answer',{questionId:paused.self.task.id,answer:paused.self.task.options[0].value},headers[0])).status,423);
assert.equal((await me(0)).body.race.remaining,pausedTime);await command('resume');
const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks);
async function respond(i,correct=true){const s=(await me(i)).body,task=s.self.task;const internal=tasks.find(t=>t.id===task.id)||{word:task.spoken,mode:task.mode};const good=expected(internal);const bad=task.mode==='spelling'?task.spoken.replace(/[a-z]/gi,'x'):task.options.find(o=>o.value!==good&&!o.removed).value;const r=await req('/api/race/answer',{questionId:task.id,answer:correct?good:bad},headers[i]);assert.equal(r.status,200);return r.body}
while((await me(0)).body.self.index<6)await respond(0);
const leader=(await me(0)).body;assert.equal(leader.self.item,'hint');
// Use a real missed answer to receive dash without claiming independent accuracy.
for(let n=0;n<6;n++)await respond(8,n!==0);
const boosted=(await me(8)).body;assert.equal(boosted.self.item,'boost');await req('/api/race/item',{questionId:boosted.self.task.id},headers[8]);
assert.equal((await respond(8,false)).receipt.points,0);assert.equal((await me(8)).body.self.boost,2);assert.equal((await respond(8)).receipt.points,140);assert.equal((await respond(8)).receipt.points,140);assert.equal((await respond(8)).receipt.points,100);
// Establish a group ahead of the final learner, so the catch-up allocation is exercised.
for(let i=1;i<8;i++)for(let n=0;n<6;n++)await respond(i);
for(let n=0;n<6;n++)await respond(11,false);
let behind=(await me(11)).body;assert.equal(behind.self.item,'review');
const beforeReview=behind.self.score;
let review=(await req('/api/race/item',{questionId:behind.self.task.id},headers[11])).body;assert.equal(review.self.task.review,true);
assert.equal((await req('/api/race/item',{questionId:review.self.task.id},headers[11])).status,409);
review=await respond(11);assert.equal(review.self.score,beforeReview+60);assert.equal(review.self.index,6);assert.equal(review.receipt.review,true);
const hinted=(await req('/api/race/item',{questionId:leader.self.task.id},headers[0])).body;assert.equal(hinted.self.task.hinted,true);assert.equal(hinted.self.task.options.filter(o=>o.removed).length,1);
const withHint=await respond(0);assert.equal(withHint.receipt.points,70);assert.equal(withHint.self.correct,6);
// Optimistic revisions reject concurrent, different answers; retries don't double-score.
const st=(await me(9)).body,good=expected(tasks[0]);const parallel=await Promise.all([req('/api/race/answer',{questionId:st.self.task.id,answer:good},headers[9]),req('/api/race/answer',{questionId:st.self.task.id,answer:tasks[0].options.find(v=>v!==good)},headers[9])]);assert.ok(parallel.every(r=>[200,409].includes(r.status)));assert.equal((await me(9)).body.self.index,1);assert.equal((await me(9)).body.self.history.length,1);
const privateBoard=(await req('/api/teacher/race/board?race='+raceId,undefined,teacher)).body;assert.ok(privateBoard.players.some(p=>p.history.some(h=>h.hinted)));assert.equal((await req('/api/teacher/race/export?race='+raceId)).status,401);
const csv=await req('/api/teacher/race/export?race='+raceId,undefined,teacher);assert.ok((await csv.response.text()).includes('ヒント'));
// Each new-game checkpoint delivers a fresh item, including replacement of unused inventory.
for(const checkpoint of [12,18]){while((await me(1)).body.self.index<checkpoint)await respond(1);assert.ok((await me(1)).body.self.item)}
// Finish all 24 tasks; spelling is judged on the server as well.
await Promise.all(peers.map(async(_,i)=>{while((await me(i)).body.self.index<24)await respond(i)}));
assert.equal((await me(0)).body.race.status,'finished');assert.equal((await me(0)).body.self.index,24);const final=(await me(0)).body;assert.equal(final.team.target,144);assert.ok(final.team.correct>=144);assert.ok(final.self.learning.badges.some(b=>b.id==='finish'));assert.ok(final.self.learning.badges.some(b=>b.id==='spelling'));assert.ok((await me(11)).body.self.learning.badges.some(b=>b.id==='recovery'));
assert.equal((await req('/api/class/current')).body.classroom.id,classroom.id);
const second=(await create()).body.raceId;const newcomer=(await req('/api/race/join',{raceId:second,label:'1'})).body;assert.ok(newcomer.token);
const history=(await req('/api/teacher/race/current',undefined,teacher)).body;assert.equal(history.races.length,2);assert.equal(history.race.id,second);
await req('/api/teacher/race/state',{raceId:second,action:'start'},teacher);
await env.DB.prepare('UPDATE races SET started_at=?,remaining_ms=1 WHERE id=?').bind(Date.now()-1000,second).run();
assert.equal((await req('/api/race/me',undefined,{authorization:'Bearer '+newcomer.token})).body.race.status,'finished');
assert.equal((await req('/api/race/answer',{questionId:newcomer.self.task.id,answer:expected(tasks[0])},{authorization:'Bearer '+newcomer.token})).status,423);
const legacyId=(await create()).body.raceId;const legacyTasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(legacyId).first()).tasks).map(({rules,...t})=>t);await env.DB.prepare('UPDATE races SET tasks=? WHERE id=?').bind(JSON.stringify(legacyTasks),legacyId).run();const legacy=(await req('/api/race/join',{raceId:legacyId,label:'88',avatar:'sea-lion'})).body;const legacyAuth={authorization:'Bearer '+legacy.token};assert.equal(legacy.self.avatar,'sea-lion');await req('/api/teacher/race/state',{raceId:legacyId,action:'start'},teacher);await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?').bind(Date.now(),legacyId).run();for(let n=0;n<8;n++){const t=(await req('/api/race/me',undefined,legacyAuth)).body.self.task;const a=expected(legacyTasks[n]);const result=await req('/api/race/answer',{questionId:t.id,answer:a},legacyAuth);if(n===5)assert.equal(result.body.self.item,null);if(n===7)assert.equal(result.body.self.item,'hint')}
const repeatId=(await create()).body.raceId,repeatJoin=(await req('/api/race/join',{raceId:repeatId,label:'1'})).body,repeatAuth={authorization:'Bearer '+repeatJoin.token},repeatTasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(repeatId).first()).tasks);await req('/api/teacher/race/state',{raceId:repeatId,action:'start'},teacher);await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?').bind(Date.now(),repeatId).run();let repeatResult;for(const t of repeatTasks)repeatResult=(await req('/api/race/answer',{questionId:t.id,answer:expected(t)},repeatAuth)).body;assert.equal(repeatResult.self.learning.improvement.delta,1);assert.ok(repeatResult.self.learning.badges.some(b=>b.id==='improved'));
console.log('PASS: independent live race, 12 concurrent joins, authentication/privacy, server scoring, idempotent answers, pause/resume, catch-up review, hints/dash, concurrent revision guard, all-finish, countdown expiration, history/CSV and ordinary-lesson isolation.');
