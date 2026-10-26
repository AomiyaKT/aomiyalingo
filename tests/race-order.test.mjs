import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
async function req(path,data,headers={}){const r=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);return {status:r.status,body:await r.json(),r}}
const login=await req('/api/teacher/login',{password:'test-password'}),teacher={cookie:login.r.headers.get('set-cookie').split(';')[0]};
const id=(await req('/api/teacher/race/create',{title:'Independent orders'},teacher)).body.raceId;
const peers=await Promise.all(Array.from({length:35},(_,i)=>req('/api/race/join',{raceId:id,label:String(i+101)})));
assert.ok(peers.every(r=>r.status===200));
const base=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(id).first()).tasks);
const rows=(await env.DB.prepare('SELECT * FROM racers WHERE race_id=?').bind(id).all()).results;
const orders=rows.map(r=>JSON.parse(r.state).taskOrder);assert.equal(new Set(orders.map(o=>o.join(','))).size,35);
for(const order of orders)assert.deepEqual([...order].sort((a,b)=>a-b),base.map((_,i)=>i));
const board=(await req('/api/teacher/race/board?race='+id,undefined,teacher)).body.players;assert.equal(board.length,35);assert.deepEqual(board.map(p=>p.alias),rows.map(p=>'出席番号 '+p.label));
assert.ok(peers[0].body.board.every(p=>p.alias.startsWith('出席番号 ')));
const auth={authorization:'Bearer '+peers[0].body.token};const first=peers[0].body.self.task;
assert.equal((await req('/api/race/me',undefined,auth)).body.self.task.id,first.id);
await req('/api/teacher/race/state',{raceId:id,action:'start'},teacher);await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?').bind(Date.now(),id).run();
const other=base.find(t=>t.id!==first.id);assert.equal((await req('/api/race/answer',{questionId:other.id,answer:other.word},auth)).status,409);
const order=JSON.parse(rows.find(r=>r.id===peers[0].body.self.id).state).taskOrder;
for(const index of order.slice(0,24)){const t=(await req('/api/race/me',undefined,auth)).body.self.task;assert.equal(t.id,base[index].id);const answer=t.mode==='text'?base[index].content.meaning:t.spoken;const sent={questionId:t.id,answer};const r=await req('/api/race/answer',sent,auth);assert.equal(r.status,200);assert.equal(r.body.receipt.correct,true);const repeated=await req('/api/race/answer',sent,auth);assert.equal(repeated.body.self.score,r.body.self.score);}
assert.equal((await req('/api/race/me',undefined,auth)).body.self.index,24);
// A pre-update race retains its already assigned shared order.
const old=(await req('/api/teacher/race/create',{title:'Historical'},teacher)).body.raceId;
const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(old).first()).tasks);delete tasks[0].settings.individualOrder;await env.DB.prepare('UPDATE races SET tasks=? WHERE id=?').bind(JSON.stringify(tasks),old).run();
const a=(await req('/api/race/join',{raceId:old,label:'1'})).body,b=(await req('/api/race/join',{raceId:old,label:'2'})).body;assert.equal(a.self.task.id,b.self.task.id);assert.equal(a.self.task.id,tasks[0].id);
console.log('PASS: 35 distinct persisted permutations, same complete question set and mode counts, attendance labels on full teacher/student boards, resume stability, authoritative personal-order scoring, stale/foreign question rejection, idempotence, historical compatibility.');
