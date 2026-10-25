import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import AudioMusicPlayer from '../../src/audio/AudioMusicPlayer.js';
import {MenuScreenMusic} from '../../src/menus/MenuScreenMusic.js';
const previous=globalThis.window;globalThis.window={};
const {default:Game}=await import('../../src/game/GameCore.js');
if(previous===undefined)delete globalThis.window;else globalThis.window=previous;

test('entering race loading fades menu MP3 to silence and disposes it during preparation',()=>{
 const media={volume:0,paused:false,pause(){this.paused=true;},removeAttribute(){},load(){}};
 const player=new AudioMusicPlayer({volume:1,midiBusVolume:1},{createAudio:()=>media});
 player.trackId='map';player.setFade(1,0);
 const game=Object.create(Game.prototype);
 Object.assign(game,{state:'race-editor',musicPlayers:[player],activeMusicTrackId:'map',musicPreloadToken:0,cutsceneMidiLayers:new Map(),
 input:{updateGamepad(){},isGamepadConnected(){return false;},clearVirtual(){},wasPressed(){return false;},flush(){}},
 updateControlScheme(){},syncMobileControlsViewport(){},isEditorState(){return true;},updateSystemPrompts(){}});
 game.menuPlayer={screenMusic:new MenuScreenMusic(game,async()=>({data:{}}))};
 game.menuPlayer.screenMusic.ref='map';game.menuPlayer.screenMusic.fadeOut=.8;
 const editor=new RaceEditor(game);game.raceEditor=editor;editor.update=()=>{};
 editor.beginRaceTravelLoading('p1');
 assert.equal(game.activeMusicTrackId,null);assert.equal(player.targetVolume,0);assert.equal(editor.playtestSession.running,false);
 game._updateByState(.4);assert.equal(media.volume,.5);assert.equal(media.paused,false);
 game._updateByState(.4);assert.equal(media.volume,0);assert.equal(media.paused,true);assert.equal(game.musicPlayers.length,0);
});

test('race loading cancels a pending menu track before it can start',async()=>{
 let resolve;const calls=[],game={setActiveMusicTrack:(...args)=>calls.push(args)};
 game.menuPlayer={screenMusic:new MenuScreenMusic(game,()=>new Promise(r=>{resolve=r;}))};
 const pending=game.menuPlayer.screenMusic.enter({musicMode:'track',musicRef:'map'});
 const editor=new RaceEditor(game);editor.beginRaceTravelLoading('p1');
 resolve({data:{}});await pending;
 assert.deepEqual(calls.map(c=>c[0]),[null]);
});

test('quitting a menu immediately stops MP3 playback, even during an existing fade',async()=>{
 const {default:MenuPlayer}=await import('../../src/menus/MenuPlayer.js');
 for(const alreadyFading of [false,true]){
  const media={volume:0,paused:false,pause(){this.paused=true;},removeAttribute(){},load(){}};
  const audioPlayer=new AudioMusicPlayer({volume:1,midiBusVolume:1},{createAudio:()=>media});
  audioPlayer.trackId='garage';audioPlayer.setFade(1,0);
  const game={musicPlayers:[audioPlayer],activeMusicTrackId:'garage',musicPreloadToken:0,setActiveMusicTrack:Game.prototype.setActiveMusicTrack};
  const menu=new MenuPlayer(game);
  if(alreadyFading)menu.screenMusic.stop();
  menu.cleanup();
  assert.equal(media.paused,true);assert.equal(media.volume,0);assert.equal(audioPlayer.finished,true);assert.equal(game.activeMusicTrackId,null);
 }
});
