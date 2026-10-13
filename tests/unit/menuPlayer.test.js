import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {MenuSettings} from '../../src/menus/MenuSettings.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
import {createMenuDocument} from '../../src/menus/MenuDocument.js';
import Input from '../../src/game/Input.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

function fixture(){const calls=[];const game={input:{},canvas:{style:{}},audio:{setEffectsVolume:v=>calls.push(['fx',v])},transitionTo:s=>calls.push(['state',s]),setActiveMusicTrack:()=>{},startRaceTravel:async p=>{calls.push(['race',p]);return true}};const player=new MenuPlayer(game);player.settings.load=async()=>{};return {player,game,calls};}
const input=(codes=[],buttons=[])=>({wasPressedCode:code=>codes.includes(code),wasGamepadPressed:button=>buttons.includes(button)});
test('keyboard and controller Start navigate the splash, choices retain typed parameters',async()=>{
 for(const controls of [input(['Space']),input([],['gamepadStart'])]){
  const {player}=fixture();await player.open(createMenuDocument());player.resources.choices=source=>source==='cars'?[{label:'WRX',value:'WRX4'},{label:'BRZ',value:'BRZ'}]:[];
  player.update(controls,0.1);await Promise.resolve();assert.equal(player.flow.screenId,'cars');assert.equal(player.flow.parameters.carRef,'WRX4');
  await player.activate(player.flow.screen.elements.find(e=>e.id==='car'));assert.equal(player.flow.parameters.carRef,'BRZ');
  await player.activate(player.flow.screen.elements.find(e=>e.id==='difficulty'));assert.equal(player.flow.parameters.difficulty,'hard');
 }
});
test('real race adapter forwards selected car, difficulty and arbitrary customization',async()=>{
 const {player,game,calls}=fixture();await player.open(createMenuDocument());player.flow.setParameter('carRef','WRX4');player.flow.setParameter('weapons',['chainsaw']);player.flow.setParameter('character.color','#00ff00');
 await player.flow.run({type:'race',target:'Hill'});const params=calls.find(c=>c[0]==='race')[1];assert.equal(params.raceName,'Hill');assert.equal(params.carRef,'WRX4');assert.equal(params.carSelection,'specific');assert.deepEqual(params.menuConfiguration.weapons,['chainsaw']);assert.equal(game.menuParameters['character.color'],'#00ff00');
});
test('preview reports destinations and returns to the editor without starting a race',async()=>{
 const {player,calls}=fixture();await player.open(createMenuDocument(),{preview:true});await player.flow.run({type:'race',target:'Hill'});assert.match(player.message,/Preview: launch race/);assert.equal(calls.some(c=>c[0]==='race'),false);player.flow.stop();assert.deepEqual(calls.at(-1),['state','menu-editor']);
});
test('HTML movie ending launches the following race; cancellation never launches it',async()=>{
 const previous=globalThis.document;const videos=[];globalThis.document={createElement:()=>{const video={play:async()=>{},pause(){},load(){},removeAttribute(){}};videos.push(video);return video}};
 try{
  for(const cancel of [false,true]){const {player,calls}=fixture();await player.open(createMenuDocument());const pending=player.flow.run({type:'movie',target:'/intro.mp4',then:{type:'race',target:'Hill'}});assert.equal(calls.some(c=>c[0]==='race'),false);if(cancel)player.flow.stop();else videos.at(-1).onended();await pending;assert.equal(calls.some(c=>c[0]==='race'),!cancel);}
 }finally{globalThis.document=previous}
});
test('settings independently control effects, music, brightness, sensitivity and actual action mapping',()=>{
 const {game}=fixture();game.audio.ctx={};let music;game.audio.setMidiVolume=v=>music=v;const settings=new MenuSettings(game);settings.apply('settings.musicVolume',0.25);settings.apply('settings.fxVolume',0);assert.equal(music,0.25);settings.apply('settings.brightness',1.3);assert.equal(game.canvas.style.filter,'brightness(1.3)');settings.apply('settings.sensitivity',2);assert.equal(game.input.controlSensitivity,2);settings.apply('input.left','KeyQ');
 const state=Object.assign(Object.create(Input.prototype),game.input,{keys:new Map([['KeyQ',true]]),pressed:new Set(['KeyQ']),released:new Set(),virtualDown:new Map(),virtualPressed:new Set(),virtualReleased:new Set()});assert.equal(state.isDown('left'),true);assert.equal(state.wasPressed('left'),true);state.keys=new Map([['KeyA',true]]);state.pressed=new Set(['KeyA']);assert.ok(!state.isDown('left'));assert.ok(!state.wasPressed('left'));
});
test('race controls honor remapping instead of the hard-coded steering fallback',()=>{
 const e=new RaceEditor({},{mode:'race'});e.playtestSession={running:true};const state=Object.assign(Object.create(Input.prototype),{actionKeymap:{left:['KeyQ']},keys:new Map([['KeyA',true]]),pressed:new Set(),released:new Set(),virtualDown:new Map(),virtualPressed:new Set(),virtualReleased:new Set(),gamepadActions:{},gamepadPressed:new Set(),virtualGamepadActions:{},virtualGamepadPressed:new Set()});e.updateRaceKeyboardInput(state);assert.equal(e.raceInput.keyboardSteer,0);state.keys=new Map([['KeyQ',true]]);e.updateRaceKeyboardInput(state);assert.equal(e.raceInput.keyboardSteer,-1);
});
