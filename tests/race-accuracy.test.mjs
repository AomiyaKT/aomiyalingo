import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
const realNow=Date.now;let time=realNow();Date.now=()=>time;
async function req(path,data,headers={}){const r=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);return {status:r.status,body:await r.clone().json(),r}}
try{
 const login=await req('/api/teacher/login',{password:'test-password'}),teacher={cookie:login.r.headers.get('set-cookie').split(';')[0]};
 const original=(await req('/api/teacher/config',undefined,teacher)).body;
 assert.equal(original.config.race.streakStep,20);assert.equal(original.config.grade5.race.streakCap,100);assert.equal(original.config.unit7.race.streakStep,20);
 const room=(await req('/api/teacher/classes',{title:'Ordinary classroom'},teacher)).body;
 const create=async title=>{const id=(await req('/api/teacher/race/create',{title},teacher)).body.raceId;const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(id).first()).tasks).slice(0,24);for(const t of tasks)t.rules=4;await env.DB.prepare('UPDATE races SET tasks=? WHERE id=?').bind(JSON.stringify(tasks),id).run();return id};
 const id=await create('Late entry and equal time');
 const command=action=>req('/api/teacher/race/state',{raceId:id,action,confirm:true},teacher);
 const join=async label=>{const r=await req('/api/race/join',{raceId:id,label});assert.equal(r.status,200);return {id:r.body.self.id,auth:{authorization:'Bearer '+r.body.token},initial:r.body}};
 const me=async p=>(await req('/api/race/me',undefined,p.auth)).body;
 const row=async p=>env.DB.prepare('SELECT * FROM racers WHERE id=?').bind(p.id).first();
 const mutate=async(p,change)=>{const record=await row(p),s=JSON.parse(record.state);change(s);await env.DB.prepare('UPDATE racers SET state=? WHERE id=?').bind(JSON.stringify(s),p.id).run()};
 const deck=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(id).first()).tasks);
 assert.equal(deck[0].rules,4);
 async function answer(p,correct=true){const s=await me(p),t=s.self.task;assert.ok(t);const w=deck.find(x=>x.id===t.id)?.content||deck[0].pool.find(w=>w.word===t.spoken),good=t.mode==='text'?w.meaning:w.word,bad=t.mode==='spelling'?w.word.replace(/[a-z]/gi,'x'):t.options.find(o=>o.value!==good&&!o.removed).value;const payload={questionId:t.id,answer:correct?good:bad,score:999999,streak:999};const r=await req('/api/race/answer',payload,p.auth);assert.equal(r.status,200);return {...r.body,payload}}
 const a=await join('1'),b=await join('2');
 assert.equal((await command('start')).body.race.status,'countdown');
 const c=await join('3');assert.equal(c.initial.self.ready,false);assert.equal(c.initial.self.task,null);
 assert.equal((await req('/api/race/ready',{avatar:'fox'},c.auth)).body.race.status,'countdown');
 assert.equal((await req('/api/race/answer',{questionId:deck[0].id,answer:deck[0].word},c.auth)).status,423);
 time+=3000;
 assert.equal((await req('/api/teacher/race/state',{raceId:id,action:'closeJoin'})).status,401);
 assert.equal((await req('/api/teacher/race/state',{raceId:id,action:'closeJoin'},{...teacher,origin:'https://other.test'})).status,403);
 assert.equal((await command('closeJoin')).body.race.accepting,false);
 assert.equal((await req('/api/race/join',{raceId:id,label:'4'})).status,409);
 assert.equal((await command('openJoin')).body.race.accepting,true);
 for(const points of [100,120,140,160,180,200,200]){const r=await answer(a);assert.equal(r.receipt.points,points);assert.equal(r.receipt.streakBonus,points-100);const repeat=await req('/api/race/answer',r.payload,a.auth);assert.equal(repeat.body.self.score,r.self.score);assert.equal(repeat.body.self.streak,r.self.streak)}
 assert.equal((await me(a)).self.bestStreak,7);
 await mutate(a,s=>{s.item='hint';s.usedSegment=-1});const hint=await me(a);assert.equal((await req('/api/race/item',{questionId:hint.self.task.id},a.auth)).status,200);
 const hinted=await answer(a);assert.equal(hinted.receipt.points,70);assert.equal(hinted.self.streak,0);assert.equal(hinted.self.correct,7);
 assert.equal((await answer(a)).receipt.points,100);
 assert.equal((await answer(a,false)).self.streak,0);
 await mutate(a,s=>{s.item='review';s.usedSegment=-1});const review=await me(a);await req('/api/race/item',{questionId:review.self.task.id},a.auth);const recovery=await answer(a);assert.equal(recovery.receipt.review,true);assert.equal(recovery.receipt.points,60);assert.equal(recovery.self.index,10);assert.equal(recovery.self.streak,0);
 time+=120000;
 const late=await join('4');assert.equal(late.initial.self.ready,false);assert.equal(late.initial.self.remaining,360000);assert.equal(late.initial.self.task,null);
 assert.equal((await req('/api/race/answer',{questionId:deck[0].id,answer:deck[0].word},late.auth)).status,423);
 assert.equal((await req('/api/race/avatar',{avatar:'panda'},late.auth)).body.self.avatar,'panda');
 time+=15000;assert.equal((await me(late)).self.remaining,360000);
 const ready=await req('/api/race/ready',{avatar:'panda'},late.auth);assert.equal(ready.status,200);assert.equal(ready.body.self.remaining,360000);assert.equal(ready.body.self.ready,true);assert.ok(ready.body.self.task);
 const personalId=ready.body.self.task.id;time+=5000;
 const resumed=await me(late);assert.equal(resumed.self.remaining,355000);assert.equal(resumed.self.task.id,personalId);
 assert.equal((await req('/api/race/ready',{avatar:'cat'},late.auth)).body.self.remaining,355000);
 assert.equal((await req('/api/race/avatar',{avatar:'cat'},late.auth)).status,409);
 assert.equal((await req('/api/race/join',{raceId:id,label:'4'})).status,409);
 const orders=await env.DB.prepare('SELECT state FROM racers WHERE race_id=?').bind(id).all();assert.equal(new Set(orders.results.map(r=>JSON.parse(r.state).taskOrder.join(','))).size,4);
 time+=220000;
 assert.equal((await me(a)).self.done,true);assert.equal((await me(late)).self.done,false);assert.equal((await me(late)).self.remaining,135000);
 const expired=await me(a);assert.equal((await req('/api/race/answer',{questionId:expired.self.task.id,answer:expired.self.task.spoken},a.auth)).status,423);
 assert.equal((await req('/api/race/item',{questionId:expired.self.task.id},a.auth)).status,423);
 await command('pause');const frozen=(await me(late)).self.remaining;time+=100000;assert.equal((await me(late)).self.remaining,frozen);
 const pausedJoin=await join('5');assert.equal((await req('/api/race/ready',{avatar:'fox'},pausedJoin.auth)).body.self.remaining,360000);
 assert.equal((await req('/api/race/answer',{questionId:deck[0].id,answer:'x'},pausedJoin.auth)).status,423);
 await command('resume');time+=1000;assert.equal((await me(late)).self.remaining,frozen-1000);assert.equal((await me(pausedJoin)).self.remaining,359000);
 await answer(late);assert.equal((await me(late)).self.index,1);
 await command('end');assert.equal((await req('/api/race/join',{raceId:id,label:'6'})).status,409);
 assert.equal((await req('/api/race/ready',{avatar:'cat'},pausedJoin.auth)).status,409);
 // Score determines position; equal score and accuracy share rank regardless of join time.
 const rankedId=await create('Accuracy before speed');
 const competitors=[];for(const label of ['11','12','13','14']){const r=await req('/api/race/join',{raceId:rankedId,label});competitors.push({id:r.body.self.id,auth:{authorization:'Bearer '+r.body.token}})}
 await req('/api/teacher/race/state',{raceId:rankedId,action:'start'},teacher);time+=3000;
 for(const [i,p]of competitors.entries())await mutate(p,s=>{s.index=i===3?1:24;s.correct=i===1?23:i===3?1:24;s.score=i===1?99000:i===3?100:4000});
 const final=await req('/api/teacher/race/state',{raceId:rankedId,action:'end',confirm:true},teacher);
 assert.deepEqual(final.body.players.map(p=>p.alias),['出席番号 12','出席番号 11','出席番号 13','出席番号 14']);
 assert.deepEqual(final.body.players.map(p=>p.rank),[1,2,2,4]);
 assert.equal(final.body.players[1].accuracy,100);assert.equal(final.body.players[0].accuracy,95.8);
 const exported=await worker.fetch(new Request('https://classroom.test/api/teacher/race/export?race='+id,{headers:teacher}),env);assert.ok((await exported.text()).includes('最大連続正解'));
 assert.equal((await req('/api/class/current')).body.classroom.id,room.id);
 // Restored and pre-update games keep their original score rules and closed-running admission.
 const legacyId=await create('Historical scoring');const old=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(legacyId).first()).tasks);old.forEach(t=>t.rules=3);await env.DB.prepare('UPDATE races SET tasks=? WHERE id=?').bind(JSON.stringify(old),legacyId).run();
 const joined=(await req('/api/race/join',{raceId:legacyId,label:'21'})).body,legacyAuth={authorization:'Bearer '+joined.token};await req('/api/teacher/race/state',{raceId:legacyId,action:'start'},teacher);time+=3000;
 assert.equal((await req('/api/race/join',{raceId:legacyId,label:'22'})).status,409);
 for(let n=0;n<2;n++){const t=(await req('/api/race/me',undefined,legacyAuth)).body.self.task,w=old.find(x=>x.id===t.id).content;const r=await req('/api/race/answer',{questionId:t.id,answer:t.mode==='text'?w.meaning:w.word},legacyAuth);assert.equal(r.body.receipt.points,100)}
 console.log('PASS: running/countdown/paused admission, teacher close/reopen, equal personal time, avatar preparation, stable resume, no timer reset, expired answer/item guards, pause freezes all clocks, escalating/capped streaks, hint/wrong/review handling, retry idempotence, score-first/tied final ranks, complete and incomplete records, exports and legacy/ordinary-class isolation.');
}finally{Date.now=realNow}
