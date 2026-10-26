// Execute the real composition root with view adapters stubbed, without a browser or network.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mocks={
 './shared/student-viewport.js':'export const installStudentViewport=()=>{};',
 './shared/context-help.js':'export const installContextHelp=()=>{};',
 './race/showtime.js':'export const createRaceShowtime=()=>({});',
 './race/exercises.js':'export const createExerciseController=()=>({});',
 './shared/dom.js':'export const makeElement=()=>__node();export const setTextIfChanged=()=>{};export const setAttributeIfChanged=()=>{};',
 './race/rewards.js':'export const createRewardFeedback=()=>({});',
 './race/teacher.js':'export function createTeacherRaceView(){throw Error("Student boot initialized teacher UI");}',
 './race/items.js':'export const createItemRoulette=()=>({});',
 './race/api.js':'export const createRaceApi=()=>()=>{__poll();return new Promise(()=>{});};',
 './race/views.js':'export const createRaceViews=()=>({});',
 './race/lifecycle.js':'export const studentPhase=()=>"entry";',
 './race/review.js':'export const createWaitingReview=()=>({});',
 './race/briefing.js':'export const renderRaceBriefing=()=>{};',
 './race/teacher-controller.js':'export function createTeacherRaceController(){throw Error("Student boot initialized teacher controls");}',
};
const compiled=await build({stdin:{contents:readFileSync('public/race.js','utf8'),resolveDir:process.cwd()},bundle:true,write:false,format:'iife',plugins:[{name:'view-adapters',setup(b){b.onResolve({filter:/^\.\//},args=>{assert.ok(args.path in mocks,args.path);return {path:args.path,namespace:'mock'};});b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
for(const search of ['', '?race=classroom-specific']){
  const nodes=new Map(),intervals=[];let polls=0,queries=0;
  const node=()=>({classList:{contains:()=>false},setAttribute(){},addEventListener(){},value:'',style:{},dataset:{}});
  const document={hidden:false,body:node(),addEventListener(){},querySelectorAll:()=>[],querySelector(selector){queries++;assert.ok(!/teacher|race-private-records|create-race/.test(selector),'Student must not require teacher elements: '+selector);if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}};
  const context={document,window:{addEventListener(){}},location:{search,pathname:'/race'},localStorage:{getItem:()=>null,setItem(){}},Audio:class{},URLSearchParams,Date,console,
    raceAvatarCatalog:[],appSettings:{values:{}},interactionEffects:{},raceSessionCache:{save(){}},
    setInterval(fn,ms){intervals.push({fn,ms});},setTimeout(){},clearTimeout(){},__node:node,__poll:()=>polls++};
  vm.runInNewContext(compiled.outputFiles[0].text,context,{timeout:1000});
  assert.equal(polls,1,'Student startup reaches its own session poll');
  assert.equal(typeof nodes.get('#race-join').onsubmit,'function','Attendance form is wired');
  assert.equal(typeof nodes.get('#race-ready').onclick,'function','Ready action is wired');
  document.hidden=true;const before=queries;
  intervals.find(i=>i.ms===250).fn();assert.equal(queries,before,'Hidden tabs do not touch the countdown DOM');
}
console.log('Student bootstrap: direct/QR entry, attendance/ready actions, role isolation and hidden-clock suspension passed.');
