'use strict';
(()=>{
 // Only teacher documents include this player. Guard again before constructing audio.
 if(!document.body.matches('.teacher-page,.race-teacher')||!['','/teacher','/teacher-editor','/race-teacher'].includes(location.pathname.replace(/\/$/,'')))return;
 if(new URLSearchParams(location.search).get('embedded')==='1')return;
 if(document.querySelector('#teacher-background-music'))return;
 const audio=document.createElement('audio');audio.id='teacher-background-music';audio.src='/assets/teacher-lobby.m4a';audio.loop=true;audio.preload='none';audio.hidden=true;document.body.append(audio);
 const button=document.querySelector('#music-play-toggle'),status=document.querySelector('#music-status');
 let userPaused=false,attempting=false,blocked=false,failed=false,raceHold=false,startTimer=null,startedRace=null;
 try{userPaused=sessionStorage.getItem('aomi.teacher.music.paused')==='true';startedRace=sessionStorage.getItem('aomi.teacher.music.started-race')}catch{}
 function savePosition(){try{sessionStorage.setItem('aomi.teacher.music.position',String(audio.currentTime))}catch{}}
 audio.addEventListener('loadedmetadata',()=>{try{const position=Number(sessionStorage.getItem('aomi.teacher.music.position'));if(position>0&&Number.isFinite(audio.duration))audio.currentTime=position%audio.duration}catch{}});
 function draw(){button.textContent=audio.paused?'音楽を再生':'音楽を一時停止';button.setAttribute('aria-pressed',String(!audio.paused));status.textContent=failed?'音楽を読み込めませんでした。「音楽を再生」で再試行できます。':appSettings.values.musicVolume===0?'音量0% · 消音中':raceHold?'レースのスタート・再開を待っています。':userPaused?'一時停止中':blocked?'画面をクリックすると音楽が始まります。':!audio.paused?'再生中 · 先生のページだけで流れます。':'先生のページだけで再生します。'}
 async function play(){audio.volume=appSettings.values.musicVolume/100;if(raceHold||userPaused||audio.volume===0||document.hidden||attempting)return draw();attempting=true;failed=false;try{await audio.play();blocked=false}catch(e){blocked=e.name==='NotAllowedError';failed=!blocked&&e.name!=='AbortError'}finally{attempting=false;draw()}}
 function sync(){audio.volume=appSettings.values.musicVolume/100;if(audio.volume===0){audio.pause();savePosition();draw()}else play()}
 button.addEventListener('click',()=>{if(!audio.paused){userPaused=true;audio.pause();savePosition()}else{userPaused=false;play()}try{sessionStorage.setItem('aomi.teacher.music.paused',String(userPaused))}catch{}draw()});
 for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{if(e.isTrusted&&blocked&&!userPaused&&appSettings.values.musicVolume>0)play()},{capture:true});
 for(const event of ['play','pause','error'])audio.addEventListener(event,()=>{if(event==='error')failed=true;draw()});
 window.addEventListener('aomiyalingo-settings',sync);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();savePosition();draw()}else play()});
 window.addEventListener('pagehide',()=>{savePosition();audio.pause()});
 function startRaceMusic(id){raceHold=false;if(startedRace!==id){startedRace=id;audio.currentTime=0;try{sessionStorage.setItem('aomi.teacher.music.started-race',id);sessionStorage.setItem('aomi.teacher.music.position','0')}catch{}}play()}
 function raceCue(r){clearTimeout(startTimer);startTimer=null;if(!r){raceHold=false;sync();return}if(r.status==='countdown'){raceHold=true;audio.pause();draw();startTimer=setTimeout(()=>{startTimer=null;startRaceMusic(r.stations===3?r.id+':'+r.station:r.id)},Math.max(0,Number(r.startsIn)||0));return}if(r.status==='paused'){raceHold=true;audio.pause();draw();return}if(r.status==='running'){startRaceMusic(r.stations===3?r.id+':'+r.station:r.id);return}raceHold=false;sync()}
 window.addEventListener('aomiyalingo-race-music',e=>raceCue(e.detail));
 window.addEventListener('pagehide',()=>clearTimeout(startTimer));
 if(document.body.classList.contains('race-teacher')&&window.teacherRaceMusicState)raceCue(window.teacherRaceMusicState);else sync();
})();
