import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
async function req(path,data,headers={}){const r=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);return {status:r.status,body:await r.json(),r}}
const login=await req('/api/teacher/login',{password:'test-password'}),teacher={cookie:login.r.headers.get('set-cookie').split(';')[0]};
const original=(await req('/api/teacher/config',undefined,teacher)).body;
assert.equal(original.config.race.items.length,6);assert.equal(original.config.race.order,'mixed');
const raceId=(await req('/api/teacher/race/create',{title:'Mixed'},teacher)).body.raceId;
const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks);
assert.equal(tasks[0].rules,5);for(const mode of ['text','voice','spelling'])assert.equal(tasks.filter(t=>t.mode===mode).length,24);
assert.equal(new Set(tasks.slice(0,19).map(t=>t.word)).size,19);
const players=await Promise.all([1,2].map(label=>req('/api/race/join',{raceId,label:String(label)}))),auth=players.map(p=>({authorization:'Bearer '+p.body.token}));
const stateOrders=await Promise.all(players.map(p=>env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.body.self.id).first()));assert.notDeepEqual(JSON.parse(stateOrders[0].state).taskOrder,JSON.parse(stateOrders[1].state).taskOrder);const personalTasks=JSON.parse(stateOrders[0].state).taskOrder.map(i=>tasks[i]);
await req('/api/teacher/race/state',{raceId,action:'start'},teacher);await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?').bind(Date.now(),raceId).run();
const me=async()=> (await req('/api/race/me',undefined,auth[0])).body;
const mutate=async change=>{const p=await env.DB.prepare('SELECT * FROM racers WHERE id=?').bind(players[0].body.self.id).first(),s=JSON.parse(p.state);change(s);await env.DB.prepare('UPDATE racers SET state=? WHERE id=?').bind(JSON.stringify(s),p.id).run()};
const use=async item=>{await mutate(s=>{s.item=item;s.usedSegment=-1});const s=await me();const r=await req('/api/race/item',{questionId:s.self.task.id},auth[0]);assert.equal(r.status,200);return r.body};
const answer=async(correct=true)=>{const s=await me(),t=s.self.task,w=personalTasks[s.self.index].content,expected=t.mode==='text'?w.meaning:w.word,value=correct?expected:t.mode==='spelling'?t.spoken.replace(/[a-z]/gi,'x'):t.options.find(o=>o.value!==expected&&!o.removed).value;const r=await req('/api/race/answer',{questionId:t.id,answer:value},auth[0]);assert.equal(r.status,200);return {...r.body,sent:{questionId:t.id,answer:value}}};
// Double hints remove two distractors; spelling never reveals the whole word.
for(const mode of ['text','voice','spelling']){const index=personalTasks.findIndex(t=>t.mode===mode);await mutate(s=>{s.index=index;s.hintFor=null});const s=await use('compass');assert.equal(s.self.task.hinted,true);if(mode==='spelling')assert.equal(s.self.task.firstLetter,personalTasks[index].word.slice(0,Math.min(2,personalTasks[index].word.length-1)));else assert.equal(s.self.task.options.filter(o=>o.removed).length,2);const before=s.self.correct,r=await answer();assert.equal(r.receipt.points,70);assert.equal(r.self.correct,before)}
await mutate(s=>{s.index=0;s.history=[];s.wrong=[];s.score=0;s.correct=0;s.hintFor=null;s.hintStrength=0;s.boost=0});
await use('double');let r=await answer(false);assert.equal(r.receipt.points,0);assert.equal(r.self.double,true);r=await answer();assert.equal(r.receipt.points,200);assert.equal(r.self.double,false);assert.equal(r.self.correct,1);
const repeated=await req('/api/race/answer',r.sent,auth[0]);assert.equal(repeated.body.self.score,r.self.score);assert.equal(repeated.body.self.correct,1);
const lucky=await use('lucky');assert.ok([20,40,60,80].includes(lucky.self.lucky));await use('hint');r=await answer();assert.equal(r.receipt.points,70);assert.equal(r.self.lucky,lucky.self.lucky);r=await answer();assert.equal(r.receipt.points,100+lucky.self.lucky);assert.equal(r.self.lucky,0);
while((await me()).self.index<6)await answer();const awarded=await me();assert.ok(original.config.race.items.includes(awarded.self.item));assert.ok(awarded.self.itemBox);assert.equal((await me()).self.itemBox,awarded.self.itemBox);
const box=awarded.self.itemBox;while((await me()).self.index<12)await answer();assert.notEqual((await me()).self.itemBox,box);
await req('/api/teacher/race/state',{raceId,action:'pause'},teacher);assert.equal((await req('/api/race/item',{questionId:(await me()).self.task.id},auth[0])).status,423);
// Teacher exclusions survive migration; grouped mode remains available.
const c=structuredClone(original.config);c.race.items=['compass'];c.race.order='grouped';c.race.questions=6;c.race.countdown=0;c.race.itemEvery=3;
assert.equal((await req('/api/teacher/config',{config:c,revision:0},teacher)).status,200);const next=(await req('/api/teacher/race/create',{title:'Grouped'},teacher)).body.raceId;
const grouped=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(next).first()).tasks);assert.deepEqual(grouped.map(t=>t.mode),Array.from({length:3},()=>['text','text','voice','voice','spelling','spelling']).flat());assert.deepEqual(grouped[0].settings.items,['compass']);
const join=(await req('/api/race/join',{raceId:next,label:'3'})).body,third={authorization:'Bearer '+join.token};await req('/api/teacher/race/state',{raceId:next,action:'start'},teacher);
const thirdOrder=JSON.parse((await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(join.self.id).first()).state).taskOrder.map(i=>grouped[i]);for(const t of thirdOrder.slice(0,3)){const result=await req('/api/race/answer',{questionId:t.id,answer:t.mode==='text'?t.content.meaning:t.word},third);assert.equal(result.status,200);if(t===thirdOrder[2])assert.equal(result.body.self.item,'compass')}
assert.deepEqual(JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks),tasks);
console.log('PASS: balanced mixed/shared question deck, six items, double hints, conditional bonuses, independent accuracy, idempotence, unique item boxes, pause guard, teacher allowlist/order, immutable historical games.');
