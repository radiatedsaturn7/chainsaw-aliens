import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceFinishBehavior} from '../../src/racing/raceData.js';
import AudioMusicPlayer from '../../src/audio/AudioMusicPlayer.js';
globalThis.window ||= {location:{search:''}};
const {default:Game}=await import('../../src/game/GameCore.js');

test('cutscene MP3 layers use media playback, offsets, looping and authored volume',()=>{
 const prior=globalThis.Audio;
 globalThis.Audio=class {play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){}};
 try {
  const game=Object.create(Game.prototype);
  const song={kind:'audio-music',src:'data:audio/mpeg;base64,AAAA'};
  Object.assign(game,{audio:{},preparedCutsceneAudio:{music:new Map([['intro.mp3',{song}]])},cutsceneMidiLayers:new Map(),cutsceneMidiLayerToken:0,musicPlayers:[]});
  game.playCutsceneMidiLayer('intro','intro.mp3',{fadeMs:0,volume:.6,offsetMs:1200,loop:false});
  const player=game.cutsceneMidiLayers.get('intro').player;
  assert.ok(player instanceof AudioMusicPlayer);assert.equal(player.media.src,song.src);
  player.media.onloadedmetadata();assert.equal(player.media.currentTime,1.2);assert.equal(player.media.loop,false);assert.equal(player.targetVolume,.6);
  game.stopCutsceneMidiLayer('intro',{fadeMs:0});assert.equal(player.finished,true);
 }finally{globalThis.Audio=prior;}
});
test('race finish covers menu loading and playback until the cutscene completes',async()=>{
 const events=[];let finish;
 const player={playMovie:ref=>{events.push(ref);return new Promise(resolve=>{finish=resolve;});}};
 const game=Object.create(Game.prototype);
 Object.assign(game,{menuPlayer:player,openMenuDestination:async d=>{assert.equal(player.raceFinishCutscene,true);events.push(d.menuScreen);}});
 const destination=normalizeRaceFinishBehavior({type:'menu',menuScreen:'world-map',cutsceneRef:'lastongridintro'});
 const pending=game.playRaceFinishCutscene(destination);
 await Promise.resolve();assert.deepEqual(events,['world-map','lastongridintro']);assert.equal(player.raceFinishCutscene,true);
 finish();await pending;assert.equal(player.raceFinishCutscene,false);
});
test('failed cutscene load releases the black cover for error recovery',async()=>{
 const game=Object.create(Game.prototype);game.menuPlayer={playMovie:async()=>{throw Error('Missing scene');}};game.openMenuDestination=async()=>{};
 await assert.rejects(game.playRaceFinishCutscene({cutsceneRef:'missing'}),/Missing scene/);
 assert.equal(game.menuPlayer.raceFinishCutscene,false);
});

test('menu race intro finishes before car preparation and cancellation prevents launch',async()=>{
 const {saveProjectFile}=await import('../../src/ui/projectFiles.js');
 saveProjectFile('races','Intro order fixture',{race:{raceStart:{cutsceneRef:'introtowerhill'}}});
 for(const cancel of [false,true]){
  let finish;const events=[];
  const flow={active:true,generation:0};
  const game=Object.create(Game.prototype);
  Object.assign(game,{showSystemToast(){},menuPlayer:{flow,playMovie:(ref,options)=>{events.push(ref);assert.equal(options.restoreScreen,false);return new Promise(resolve=>{finish=resolve;});}},resolveRaceTravelCarAsync:async()=>{events.push('car');return null;},chooseRaceTravelCar:async()=>null});
  const pending=game.startRaceTravel({raceName:'Intro order fixture',menuFlow:flow,carSelection:'specific',carRef:'RTG-001'});
  for(let i=0;i<20&&!finish;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events,['introtowerhill']);
  if(cancel){flow.active=false;flow.generation++;}
  finish();await pending;
  assert.deepEqual(events,cancel?['introtowerhill']:['introtowerhill','car']);
 }
});
