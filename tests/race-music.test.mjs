import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
class Target{constructor(){this.listeners={};this.textContent='';this.attrs={}}addEventListener(k,f){(this.listeners[k]??=[]).push(f)}dispatch(k,detail){for(const f of this.listeners[k]||[])f({detail})}setAttribute(k,v){this.attrs[k]=v}}
const win=new Target(),doc=new Target(),button=new Target(),status=new Target(),timers=new Map(),saved=new Map();let audio,plays=0,timerId=0;
const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
doc.body={matches:()=>true,classList:{contains:()=>true},append:a=>audio=a};doc.hidden=false;doc.querySelector=s=>s==='#teacher-background-music'?null:s==='#music-play-toggle'?button:status;
doc.createElement=()=>{const a=new Target();a.currentTime=42;a.volume=1;a.duration=930;a.paused=true;a.play=()=>{plays++;a.paused=false;a.dispatch('play');return Promise.resolve()};a.pause=()=>{a.paused=true;a.dispatch('pause')};return a};
const context={URLSearchParams,document:doc,window:win,location:{pathname:'/race-teacher'},sessionStorage:storage,appSettings:{values:{musicVolume:20}},setTimeout:f=>{timers.set(++timerId,f);return timerId},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(readFileSync('public/teacher-music.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));
assert.equal(audio.volume,.2);assert.equal(audio.paused,false);
win.dispatch('aomiyalingo-race-music',{id:'race1',status:'countdown',startsIn:3000});assert.equal(audio.paused,true);assert.equal(timers.size,1);const f=[...timers.values()][0];timers.clear();f();await new Promise(resolve=>setImmediate(resolve));assert.equal(audio.currentTime,0);assert.equal(audio.paused,false);
audio.currentTime=15;win.dispatch('aomiyalingo-race-music',{id:'race1',status:'running'});assert.equal(audio.currentTime,15);await new Promise(resolve=>setImmediate(resolve));
win.dispatch('aomiyalingo-race-music',{id:'race1',status:'paused'});assert.equal(audio.paused,true);win.dispatch('aomiyalingo-race-music',{id:'race1',status:'running'});await new Promise(resolve=>setImmediate(resolve));assert.equal(audio.currentTime,15);assert.equal(audio.paused,false);
win.dispatch('aomiyalingo-race-music',{id:'race2',status:'countdown',startsIn:3000});assert.equal(timers.size,1);win.dispatch('aomiyalingo-race-music',{id:'race2',status:'finished'});assert.equal(timers.size,0);
context.appSettings.values.musicVolume=0;win.dispatch('aomiyalingo-settings');assert.equal(audio.paused,true);win.dispatch('aomiyalingo-race-music',{id:'race3',status:'running'});assert.equal(audio.paused,true);
vm.runInNewContext(readFileSync('public/teacher-music.js','utf8'),{...context, location:{pathname:'/teacher-editor',search:'?embedded=1'}, document:{...doc,createElement:()=>{throw Error('Embedded settings must not create a second music player')}}});
console.log('PASS: countdown pauses music, GO restarts track exactly once, periodic polls do not restart, pause/resume retains playback position, cancelled countdown cancels music cue, volume-zero respected.');
