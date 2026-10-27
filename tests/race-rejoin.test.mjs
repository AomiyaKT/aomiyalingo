import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'},storage=new Map();
const context={window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
vm.runInNewContext(fs.readFileSync('public/race-session.js','utf8'),context);
const cache=context.window.raceSessionCache;
async function req(path,body,auth=false,session){const response=await worker.fetch(new Request('https://classroom.test'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+session.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error),{status:response.status});return result}
const login=await worker.fetch(new Request('https://classroom.test/api/teacher/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'test-password'})}),env);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function teacher(path,body){const r=await worker.fetch(new Request('https://classroom.test'+path,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)}),env);assert.equal(r.status,200);return r.json()}
const raceId=(await teacher('/api/teacher/race/create',{title:'Recovery'})).raceId;
const first=await cache.join(req,raceId,'035','fox');
await req('/api/race/ready',{avatar:'fox'},true,first.session);
await teacher('/api/teacher/race/state',{raceId,action:'start'});
await env.DB.prepare('UPDATE races SET started_at=? WHERE id=?').bind(Date.now()-5000,raceId).run();
const me=await req('/api/race/me',undefined,true,first.session),t=me.self.task;
const pool=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(raceId).first()).tasks)[0].pool;
const word=pool.find(w=>w.word===t.spoken),answer=t.mode==='text'?word.meaning:word.word;
const pending={questionId:t.id,answer};cache.save({...first.session,pending});
const receipt=await req('/api/race/answer',pending,true,first.session);
const restored=await cache.join(req,raceId,'35');
assert.equal(restored.session.token,first.session.token);assert.equal(restored.result.self.id,first.result.self.id);assert.equal(restored.result.self.avatar,'fox');assert.equal(restored.result.self.score,receipt.self.score);assert.equal(restored.result.self.index,1);
const retry=await req('/api/race/answer',restored.session.pending,true,restored.session);assert.equal(retry.self.index,1);assert.equal(retry.self.score,receipt.self.score);
for(const action of ['closeJoin','pause','end']){await teacher('/api/teacher/race/state',{raceId,action,confirm:true});const again=await cache.join(req,raceId,'35');assert.equal(again.result.self.id,first.result.self.id)}
await assert.rejects(()=>req('/api/race/join',{raceId,label:'35'}),e=>e.status===409);
const secondId=(await teacher('/api/teacher/race/create',{title:'Another race'})).raceId;
const second=await cache.join(req,secondId,'35');assert.notEqual(second.session.token,first.session.token);assert.equal(cache.find(raceId,'35').token,first.session.token);
await assert.rejects(()=>cache.join(async()=>{throw Error('offline')},raceId,'35'),/offline/);assert.equal(cache.find(raceId,'35').token,first.session.token);
cache.save({raceId:'stale',label:'35',token:'expired'});let calls=0;
await cache.join(async path=>{calls++;if(path.endsWith('/me'))throw Object.assign(Error('expired'),{status:401});return {token:'new',race:{id:'stale'},self:{label:'35'}}},'stale','35');assert.equal(calls,2);assert.equal(cache.find('stale','35').token,'new');
console.log('Same-browser recovery, closed admission, pause/end, pending retry, separate races and credential isolation passed.');
