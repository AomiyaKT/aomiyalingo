import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {database} from './database.mjs';
const env={DB:database(),TEACHER_PASSWORD:'test-password'};
const realNow=Date.now;let time=realNow();Date.now=()=>time;
async function req(path,data,headers={}){const r=await worker.fetch(new Request('https://classroom.test'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);return {status:r.status,body:await r.clone().json(),r}}
try{
const login=await req('/api/teacher/login',{password:'test-password'}),teacher={cookie:login.r.headers.get('set-cookie').split(';')[0]};
const config=(await req('/api/teacher/config',undefined,teacher)).body;Object.assign(config.config.race,{modes:['text'],questions:24,countdown:0,items:[],minutes:1});assert.equal((await req('/api/teacher/config',{config:config.config,revision:config.revision},teacher)).status,200);
const id=(await req('/api/teacher/race/create',{title:'Three course championship'},teacher)).body.raceId;
const tasks=JSON.parse((await env.DB.prepare('SELECT tasks FROM races WHERE id=?').bind(id).first()).tasks);assert.equal(tasks.length,72);assert.equal(tasks[0].rules,5);for(let c=0;c<3;c++)assert.equal(tasks.slice(c*24,(c+1)*24).length,24);
const peers=[];for(let i=0;i<4;i++){const p=(await req('/api/race/join',{raceId:id,label:String(i+1)})).body;const auth={authorization:'Bearer '+p.token};peers.push({id:p.self.id,auth});await req('/api/race/ready',{avatar:'fox'},auth)}
for(const p of peers){const order=JSON.parse((await env.DB.prepare('SELECT state FROM racers WHERE id=?').bind(p.id).first()).state).taskOrder;for(let c=0;c<3;c++)assert.deepEqual(order.slice(c*24,(c+1)*24).sort((a,b)=>a-b),Array.from({length:24},(_,i)=>c*24+i));}
const control=action=>req('/api/teacher/race/state',{raceId:id,action,confirm:true},teacher),me=async p=>(await req('/api/race/me',undefined,p.auth)).body;
const answer=async(p,good=true)=>{const s=await me(p),t=s.self.task;assert.ok(t);const expected=tasks.find(x=>x.id===t.id).content.meaning;const r=await req('/api/race/answer',{questionId:t.id,answer:good?expected:t.options.find(o=>o.value!==expected).value},p.auth);assert.equal(r.status,200);return r.body};
assert.equal((await control('nextStation')).status,409);await control('start');
for(let c=0;c<3;c++){
 for(let i=0;i<4;i++)for(let n=0;n<24;n++)await answer(peers[i],i===(c+3)%4?false:true);
 const result=await me(peers[0]);assert.equal(result.race.station,c);assert.equal(result.self.index,(c+1)*24);assert.equal(result.self.task,null);assert.equal(result.stationResults.filter(x=>x.closed).length,c+1);
 const podium=result.stationResults[c].players.filter(p=>p.rank<=3);assert.equal(podium.length,3);assert.equal(podium.some(p=>p.id===peers[(c+3)%4].id),false);
 const denied=await req('/api/race/answer',{questionId:tasks[(c+1)*24]?.id,answer:'x'},peers[0].auth);assert.equal(denied.status,423);
 if(c<2){assert.equal(result.race.status,'intermission');assert.equal((await req('/api/teacher/race/state',{raceId:id,action:'nextStation'})).status,401);const next=await control('nextStation');assert.equal(next.status,200);assert.equal(next.body.race.station,c+1);assert.equal(next.body.team.correct,0);assert.equal(next.body.team.target,48);assert.equal((await control('nextStation')).status,409);const resumed=await me(peers[0]);assert.equal(resumed.self.stationIndex,0);assert.equal(resumed.self.remaining,60000);assert.equal(resumed.self.streak,0);assert.ok(resumed.self.task);}
 else assert.equal(result.race.status,'finished');
}
assert.equal((await me(peers[0])).self.answered,72);
const prior=(await me(peers[0])).stationResults[0];assert.equal(prior.closed,true);assert.ok(prior.players[0].score>0);
const timeoutId=(await req('/api/teacher/race/create',{title:'Timeout station'},teacher)).body.raceId;
const joined=(await req('/api/race/join',{raceId:timeoutId,label:'8'})).body,auth={authorization:'Bearer '+joined.token};
await req('/api/teacher/race/state',{raceId:timeoutId,action:'start'},teacher);
let current=(await req('/api/race/me',undefined,auth)).body;await req('/api/race/answer',{questionId:current.self.task.id,answer:current.self.task.options[0].value},auth);
time+=61000;current=(await req('/api/race/me',undefined,auth)).body;assert.equal(current.race.status,'intermission');const saved=current.stationResults[0];
await req('/api/teacher/race/state',{raceId:timeoutId,action:'nextStation'},teacher);current=(await req('/api/race/me',undefined,auth)).body;assert.equal(current.self.index,24);assert.equal(current.self.answered,1);assert.equal(current.self.remaining,60000);assert.deepEqual(current.stationResults[0],saved);
console.log('PASS: 72 questions, 24 per station, isolated shuffles, three independent podiums, station barriers, teacher-controlled transitions, fresh station clocks/streaks, total scores, authorization, persistence and timeout skip accuracy.');
}finally{Date.now=realNow}
