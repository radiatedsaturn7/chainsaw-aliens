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

test('sensitivity applies equally to physical and virtual sticks without scaling pedals',()=>{
 const state=Object.assign(Object.create(Input.prototype),{controlSensitivity:2,gamepadAxes:{leftX:0.4,leftY:-0.7,rightX:0.2,rightY:0,leftTrigger:0.2,rightTrigger:0.8},virtualGamepadAxes:{leftX:0.3,leftY:0,rightX:0,rightY:0,leftTrigger:0,rightTrigger:0.6}});
 assert.equal(state.getGamepadAxes().leftX,0.8);assert.equal(state.getGamepadAxes().leftY,-1);assert.equal(state.getGamepadAxes().rightTrigger,0.8);state.virtualGamepadActive=true;assert.equal(state.getGamepadAxes().leftX,0.6);assert.equal(state.getGamepadAxes().rightTrigger,0.6);assert.equal(state.virtualGamepadAxes.leftX,0.3);
});

test('preview starts on the requested screen without changing the saved launch screen',async()=>{
 const {player}=fixture(),doc=createMenuDocument();doc.screens.find(s=>s.id==='events').elements[0].label='Unsaved race heading';
 await player.open(doc,{preview:true,screenId:'events'});assert.equal(player.flow.screenId,'events');assert.equal(player.flow.screen.elements[0].label,'Unsaved race heading');assert.equal(player.flow.document.startScreen,'splash');assert.equal(doc.startScreen,'splash');
 player.flow.parameters.difficulty='hard';assert.equal(doc.parameters.difficulty,'medium');
 await player.open(doc,{preview:false,screenId:'events'});assert.equal(player.flow.screenId,'splash');
});

test('explicit navigation order survives normalization and ignores drawing order, with reverse Tab',async()=>{
 const {player}=fixture();const doc=createMenuDocument();const s=doc.screens[0];s.startAction=null;s.elements=[{id:'last',type:'button',tabOrder:30},{id:'first',type:'button',tabOrder:10},{id:'middle',type:'button',tabOrder:20},{id:'hidden',type:'button',tabOrder:1,visible:false}];
 await player.open(JSON.parse(JSON.stringify(doc)),{preview:true});assert.deepEqual(player.interactive().map(e=>e.id),['first','middle','last']);
 player.update(input(['Tab']),0.01);assert.equal(player.interactive()[player.focus].id,'middle');
 player.update({...input(['Tab']),isShiftDown:()=>true},0.01);assert.equal(player.interactive()[player.focus].id,'first');
 player.update(input([],['dpadUp']),0.01);assert.equal(player.interactive()[player.focus].id,'last');
});

test('shared touch controller navigates, confirms and exits preview; physical pad suppresses touch',async()=>{
 const {player,game,calls}=fixture();game.deviceIsMobile=true;await player.open(createMenuDocument(),{preview:true});
 const layout=player.surface.layout(390,844);assert.ok(layout.screen.y+layout.screen.h<layout.controlsDeck.y);
 player.surface.controls.pulseAction('jump');player.update(input(),0.01);await Promise.resolve();assert.equal(player.flow.screenId,'cars');
 player.surface.controls.pulseAction('down');player.update(input(),0.01);assert.equal(player.focus,1);
 player.surface.controls.pulseAction('nextWeapon');player.update(input(),0.01);assert.deepEqual(calls.at(-1),['state','menu-editor']);
 game.input.isGamepadConnected=()=>true;assert.equal(player.surface.layout(844,390),null);assert.equal(player.surface.controls.enabled,false);
});
