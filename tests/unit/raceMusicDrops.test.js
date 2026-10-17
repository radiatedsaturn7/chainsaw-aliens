import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceRadioDirector} from '../../src/radio/RaceRadioDirector.js';
import {RadioPlayer} from '../../src/radio/RadioPlayer.js';
import {normalizeRadioLibrary} from '../../src/radio/RadioLibrary.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(cues={start:12,end:45}){
 const radio=new RadioPlayer({load:async()=>({}),createAudio:()=>({currentTime:0,duration:90,volume:1,async play(){},pause(){},removeAttribute(){},load(){}})});
 await radio.load();radio.library=normalizeRadioLibrary({tracks:[{id:'song',title:'Song',src:'song.mp3',initiallyUnlocked:true,raceCues:cues}],stations:[{id:'s',name:'Station',trackIds:['song']}]});
 radio.setContext(true);radio.setVolume(.8);
 const director=new RaceRadioDirector(radio),session={running:true,countdownRemainingMs:4000};
 return {radio,director,session};
}
test('cue serialization defaults, zero, disabled finish and invalid times',()=>{
 const norm=cue=>normalizeRadioLibrary({tracks:[{id:'s',raceCues:cue}]}).tracks[0].raceCues;
 assert.deepEqual(norm(),{start:3,end:null});assert.deepEqual(norm({start:0,end:0}),{start:0,end:0});
 assert.deepEqual(norm({start:-5,end:'bad'}),{start:3,end:null});
 assert.deepEqual(norm({start:12.34,end:65.5}),{start:12.34,end:65.5});
});
test('auto-start seeks three seconds before the drop, fades, and reaches the cue at GO (1000ms)',async()=>{
 const {radio,director,session}=await fixture();
 director.update(session);await tick();assert.equal(radio.playing,true);assert.equal(radio.audio.currentTime,9);assert.equal(radio.audio.volume,0);
 radio.audio.currentTime=10.5;session.countdownRemainingMs=2500;director.update(session);assert.equal(radio.audio.currentTime,10.5);assert.equal(radio.audio.volume,.4);
 radio.setVolume(.6);assert.equal(radio.audio.volume,.3);
 session.countdownRemainingMs=1000;director.update(session);assert.equal(radio.audio.currentTime,12);assert.equal(radio.audio.volume,.6);
 session.countdownRemainingMs=0;radio.audio.currentTime=12.8;director.update(session);assert.equal(radio.audio.currentTime,12.8);
});
test('pause holds the countdown music, resume resyncs, and finish fades then hits the chorus once',async()=>{
 const {radio,director,session}=await fixture();director.update(session);await tick();
 director.update(session,{paused:true});assert.equal(radio.playing,false);
 radio.audio.currentTime=10.5;session.countdownRemainingMs=2500;director.update(session);await tick();director.update(session);assert.equal(radio.audio.currentTime,10.5);
 session.countdownRemainingMs=1000;director.update(session);
 session.raceResults=true;director.update(session,{paused:true,dt:.3});assert.equal(radio.audio.volume,.4);
 director.update(session,{paused:true,dt:.3});assert.equal(radio.audio.currentTime,45);assert.equal(radio.audio.volume,.8);
 radio.audio.currentTime=46;director.update(session,{paused:true,dt:1});assert.equal(radio.audio.currentTime,46);
 director.update(null);assert.equal(radio.audio,null);
});
test('early drops wait silently, no-countdown races start at the drop, disabled radio and car previews stay silent',async()=>{
 const {radio,director,session}=await fixture({start:1,end:null});director.update(session);await tick();
 session.countdownRemainingMs=3000;director.update(session);assert.equal(radio.audio.volume,0);
 session.countdownRemainingMs=1000;director.update(session);await tick();assert.equal(radio.audio.currentTime,1);
 director.reset();session.countdownRemainingMs=0;director.update(session);await tick();assert.equal(radio.audio.currentTime,1);
 director.reset();session.carEditorPreview=true;director.update(session);await tick();assert.equal(radio.audio,null);
 director.reset();session.carEditorPreview=false;radio.setContext(false);director.update(session);await tick();assert.equal(radio.audio,null);
});
test('late loading aligns to the remaining countdown, cancellation cannot start music after exit',async()=>{
 const {radio,director,session}=await fixture();let release;radio.load=()=>new Promise(resolve=>{release=resolve;});
 director.update(session);session.countdownRemainingMs=2000;release();await tick();
 // play itself waits for load as well.
 release();await tick();director.update(session);assert.equal(radio.audio.currentTime,11);
 director.reset();director.update(session);director.update(null);release();await tick();assert.equal(radio.audio,null);
});
test('race station fallback respects restrictions and unlocks without persisting player station',async()=>{
 const {radio,director,session}=await fixture();radio.library.stations.unshift({id:'empty',name:'Empty',trackIds:[]});radio.progress.stationId='empty';
 director.update(session);await tick();assert.equal(radio.playing,true);assert.equal(radio.stationId,'s');assert.equal(radio.progress.stationId,'empty');
 director.update(null);assert.equal(radio.stationId,'empty');
 radio.setContext(true,['empty']);director.update(session);await tick();assert.equal(radio.playing,false);
});
test('results hold the completed race until Continue, preserving the configured finish action',()=>{
 let completed=0;
 const e=new RaceEditor({audio:{},completeRaceTravel(){completed++;return true;}});
 e.preloadSelectedRaceArtRefs=()=>{};e.prewarmRacePlaytestRenderResources=()=>{};
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 e.playtestSession.elapsedMs=12340;
 e.showRaceResults();assert.equal(completed,0);assert.equal(e.raceInput.paused,true);
 assert.equal(e.getRacePauseMenuRows()[0].value,'12.34 s');
 e.getRacePauseMenuRows().find(r=>r.id==='race-results-continue').onClick();
 assert.equal(completed,1);assert.equal(e.playtestSession,null);
});

test('music preparation holds only the staged countdown, times out, and clears on cancellation',async()=>{
 const {radio,director,session}=await fixture();let release;radio.load=()=>new Promise(resolve=>{release=resolve;});
 director.update(session);assert.equal(session.raceMusicPending,true);
 director.update(session,{dt:4});assert.equal(session.raceMusicPending,true);
 director.update(session,{dt:1});assert.equal(session.raceMusicPending,false);
 director.reset();assert.equal(session.raceMusicPending,false);release();await tick();assert.equal(radio.audio,null);
});

test('countdown lets compressed audio run without repeated seeks, then restores normal playback rate',async()=>{
 const {radio,director,session}=await fixture();director.update(session);await tick();
 let time=9,seeks=0;Object.defineProperty(radio.audio,'currentTime',{get:()=>time,set:v=>{time=v;seeks++;}});
 for(let frame=1;frame<=180;frame++){
   time=9+frame/60-.04;session.countdownRemainingMs=4000-frame/60*1000;director.update(session,{dt:1/60});
 }
 assert.equal(seeks,0);assert.equal(radio.audio.playbackRate,1);assert.equal(director.go,true);
});
test('early cue holds warmed audio paused rather than seeking zero repeatedly',async()=>{
 const {radio,director,session}=await fixture({start:1});director.update(session);await tick();assert.equal(radio.playing,false);
 let seeks=0;const seek=radio.seek.bind(radio);radio.seek=v=>{seeks++;seek(v);};
 for(let i=0;i<60;i++){session.countdownRemainingMs=4000-i*16;director.update(session);}
 assert.equal(seeks,0);session.countdownRemainingMs=2000;director.update(session);await tick();assert.equal(radio.playing,true);assert.equal(seeks,1);
});
