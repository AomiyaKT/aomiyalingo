// Disposable local preview data only. No production URL or credentials.
import {readFileSync} from 'node:fs';
const origin='http://127.0.0.1:8767',words=JSON.parse(readFileSync('public/vocabulary.js','utf8').split('=')[1].split(';')[0]);
async function request(path,data,headers={}){const r=await fetch(origin+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});if(!r.ok)throw Error(path+' '+r.status);return {data:await r.json(),response:r}}
const login=await request('/api/teacher/login',{password:'test-password'}),teacher={cookie:login.response.headers.get('set-cookie').split(';')[0]};await request('/api/teacher/classes',{title:'動作確認 · Unit 4–5',roundSize:6},teacher);
const peers=await Promise.all(Array.from({length:12},(_,i)=>request('/api/join',{label:String(i+1)})));
const first=peers[0].data,auth={authorization:'Bearer '+first.token};let lesson=first.lesson;const difficult=lesson.queue[0].word;
while(lesson.queue.length){const t=lesson.queue[0],w=words.find(w=>w.word===t.word);const wrong=t.word===difficult&&t.mode==='text',answer=t.mode==='spelling'?w.word:[wrong?'wrong':t.mode==='text'?w.meaning:w.word];lesson=(await request('/api/student/answer',{questionId:t.id,answer,hintUsed:!t.review&&t.mode==='spelling'&&t.word===difficult},auth)).data.lesson}
await Promise.all(peers.slice(1).map(async(p,i)=>{const auth={authorization:'Bearer '+p.data.token};let l=p.data.lesson;for(let n=0;n<Math.min(6,i+1);n++){const t=l.queue[0],w=words.find(w=>w.word===t.word);l=(await request('/api/student/answer',{questionId:t.id,answer:t.mode==='spelling'?w.word:[n===0?'wrong':t.mode==='text'?w.meaning:w.word]},auth)).data.lesson}}));
console.log('Seeded 12 disposable students, including one completed course with a single unresolved meaning item.');
