import assert from 'node:assert/strict';
import { summarizeRaceHistory, createRaceHistoryReader } from '../server/race/history.mjs';
import { indexAttemptsByStudent } from '../server/classroom/progress.mjs';
import { learningDiagnostics } from '../public/learning/diagnostics.js';

const modes=['text','voice','spelling','match','audioMatch','audioSentence','audioCloze','dictation'];
for(const length of [0,1,24,180,720]){
  const history=Array.from({length},(_,i)=>({word:'word'+i%19,mode:modes[i%modes.length],station:i%5===0?undefined:i%3,points:i%4===0?0:100,correct:i%4!==0,hinted:i%7===0,review:i%11===0}));
  const before=JSON.stringify(history),index=summarizeRaceHistory(history);
  for(const station of ['all',0,1,2,undefined]){
    const rows=history.filter(h=>station==='all'||h.station===station),main=rows.filter(h=>!h.review),independent=main.filter(h=>h.correct&&!h.hinted);
    const expected={answered:main.length,independent:independent.length,score:rows.reduce((n,h)=>n+h.points,0),hintedCorrect:main.filter(h=>h.correct&&h.hinted).length,recovered:rows.filter(h=>h.review&&h.correct).length,voice:independent.filter(h=>['voice','audioMatch','audioSentence','audioCloze','dictation'].includes(h.mode)).length,spelling:independent.filter(h=>['spelling','dictation'].includes(h.mode)).length};
    const actual=station==='all'?index.all:index.stations.get(station);
    if(rows.length||station==='all')assert.deepEqual(actual,expected);
    if(station!==undefined){
      const words=index.words(station);
      assert.deepEqual([...words.independent],[...new Set(independent.map(h=>h.word))]);
      assert.deepEqual([...words.review],[...new Set(main.filter(h=>!h.correct||h.hinted).map(h=>h.word))]);
      assert.equal(index.words(station),words,'Lazy word sets are reused');
    }
  }
  assert.equal(JSON.stringify(history),before,'Indexing does not alter saved history');
}
const read=createRaceHistoryReader(),state={history:[]};
const first=read(state);assert.equal(read(state),first);
state.history.push({word:'ate',mode:'text',correct:true,points:100,station:0});
assert.notEqual(read(state),first);assert.equal(read(state).all.independent,1);
const appended=read(state);state.history=[{...state.history[0],correct:false,points:0}];
assert.notEqual(read(state),appended);assert.equal(read(state).all.independent,0);
assert.notEqual(read({...state}),read(state),'State caches do not cross row boundaries');

const words=[{word:'ate',meaning:'食べた'},{word:'kind',meaning:'親切な'}];
const attempts=Array.from({length:1200},(_,i)=>({student_id:'s'+i%35,word:i%2?'ate':'kind',mode:modes[i%3],created:Math.floor(i/2),sequence:i,correct:i%5!==0,hint_used:i%9===0})).reverse();
const snapshot=JSON.stringify(attempts),byStudent=indexAttemptsByStudent(attempts);
for(let i=0;i<36;i++){
  const student={id:'s'+i};
  assert.deepEqual(learningDiagnostics.stats(student,byStudent.get(student.id)||[],words),learningDiagnostics.stats(student,attempts,words),'Preindexing preserves timestamp/sequence order and empty learners');
}
assert.equal(JSON.stringify(attempts),snapshot);
console.log('Race history: differential legacy/station summaries, lazy words, cache invalidation, isolation and preindexed classroom diagnostics passed.');
