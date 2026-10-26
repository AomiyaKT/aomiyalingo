import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { course } from '../public/learning/course.js';
const words=JSON.parse(readFileSync('public/vocabulary.js','utf8').split('=')[1].split(';')[0]);
const l=course.create(words);const missed=l.queue[0].word;
course.advance(l,false);while(l.queue[0].stage===1)course.advance(l,true);
assert.equal(l.lastRound.answers,6);assert.equal(l.queue[0].stage,2);assert.equal(l.pendingReview.length,1);
while(l.queue[0].stage===2)course.advance(l,true);
assert.equal(l.lastRound.answers,6);while(l.queue[0].stage===3&&!l.queue[0].review)course.advance(l,true);
assert.equal(l.queue[0].word,missed);assert.equal(l.queue[0].stage,3);assert.equal(l.queue[0].review,true);
course.advance(l,false);assert.equal(l.lastRound.answers,7);assert.equal(l.queue[0].stage,4);
// Existing v2 lessons preserve immediate review; new lessons alone use spaced review.
const old=course.create(words);delete old.reviewPolicy;course.advance(old,false);while(old.queue[0].stage===1&&!old.queue[0].review)course.advance(old,true);assert.equal(old.queue[0].review,true);assert.equal(old.queue[0].stage,1);
const hintedCourse=course.create(words);const hintedWord=hintedCourse.queue[0].word;course.advance(hintedCourse,true,true);assert.equal(hintedCourse.pendingReview.length,1);assert.equal(hintedCourse.pendingReview[0].dueStage,3);assert.ok(hintedCourse.needsReview.includes(hintedWord+':text'));
// Prompted correctness is distinct from independent correctness, without rewriting first answers.
const s={id:'student'};const attempts=[{student_id:s.id,word:'ate',mode:'spelling',correct:1,hint_used:1,created:1,sequence:1}];
let stats=course.stats(s,attempts,words);assert.equal(stats.supported,1);assert.equal(stats.independent,0);assert.equal(stats.firstAccuracy,100);
attempts.push({student_id:s.id,word:'ate',mode:'spelling',correct:1,hint_used:0,created:1,sequence:2});stats=course.stats(s,attempts,words);assert.equal(stats.supported,0);assert.equal(stats.independent,1);assert.equal(stats.skills.find(w=>w.word==='ate').modes.spelling.hinted,true);
// Repeated wrong answers from one learner count as one person in classroom priorities.
const errors=Array.from({length:8},(_,i)=>({student_id:s.id,word:'ate',mode:'text',correct:0,created:i,sequence:i}));const learner={...s,...course.stats(s,errors,words)};const summary=course.teachingSummary([learner],words);assert.equal(summary[0].word,'ate');assert.equal(summary[0].firstWrong,1);assert.equal(summary[0].remaining,1);
for(const size of [6,8]){const lesson=course.create(words,null,size);let count=0;while(lesson.queue.length){course.advance(lesson,false);assert.ok(++count<=words.length*3+lesson.rounds*2)}assert.ok(lesson.finishedRounds.every(r=>r.answers<=size+2));assert.equal(lesson.completed,words.length*3)}
const focus=course.review({needsReview:['ate:spelling','funny:voice']},words);assert.equal(focus.total,2);assert.equal(focus.queue.filter(t=>t.word==='ate'&&t.mode==='spelling').length,1);assert.equal(focus.queue.filter(t=>t.word==='funny'&&t.mode==='voice').length,1);assert.equal(focus.practiceMode,'review');
console.log('PASS: delayed recall, bounded rounds at both sizes, v2 compatibility, hint/independent distinction, same-time ordering, unique-person teaching priorities.');
