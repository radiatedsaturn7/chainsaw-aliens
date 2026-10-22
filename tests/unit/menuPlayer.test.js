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
  player.flow.goTo('settings');
  await player.activate(player.flow.screen.elements.find(e=>e.id==='difficulty'));
  player.flow.back();
  player.update(controls,0.1);await Promise.resolve();assert.equal(player.flow.screenId,'cars');assert.equal(player.flow.parameters.carRef,'WRX4');
  await player.activate(player.flow.screen.elements.find(e=>e.id==='car'));assert.equal(player.flow.parameters.carRef,'BRZ');
  assert.equal(player.flow.parameters.difficulty,'hard');
 }
});
test('real race adapter forwards selected car, difficulty and arbitrary customization',async()=>{
 const {player,game,calls}=fixture();await player.open(createMenuDocument());player.flow.setParameter('carRef','WRX4');player.flow.setParameter('weapons',['chainsaw']);player.flow.setParameter('character.color','#00ff00');
 await player.flow.run({type:'race',target:'Hill'});const params=calls.find(c=>c[0]==='race')[1];assert.equal(params.raceName,'Hill');assert.equal(params.carRef,'WRX4');assert.equal(params.carSelection,'specific');assert.deepEqual(params.menuConfiguration.weapons,['chainsaw']);assert.equal(game.menuParameters['character.color'],'#00ff00');
});
test('preview launches a real race and restores authoring state on exit',async()=>{
 const {player,game,calls}=fixture();game.playtestActive=false;game.storyData={name:'Original'};await player.open(createMenuDocument(),{preview:true});await player.flow.run({type:'race',target:'Hill'});assert.equal(calls.some(c=>c[0]==='race'),true);assert.equal(game.playtestActive,true);game.storyData={name:'Preview'};player.flow.stop();assert.deepEqual(calls.at(-1),['state','menu-editor']);assert.equal(game.playtestActive,false);assert.equal(game.storyData.name,'Original');
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
 player.flow.back();
 player.surface.controls.pulseAction('down');player.update(input(),0.01);assert.equal(player.focus,1);
 player.surface.controls.pulseAction('nextWeapon');player.update(input(),0.01);assert.deepEqual(calls.at(-1),['state','menu-editor']);
 game.input.isGamepadConnected=()=>true;assert.equal(player.surface.layout(844,390),null);assert.equal(player.surface.controls.enabled,false);
});

test('physical B returns from a nested menu screen',async()=>{const {player}=fixture();await player.open(createMenuDocument(),{preview:true});player.flow.goTo('cars');player.update(input([],['gamepadB']),0.01);assert.equal(player.flow.screenId,'splash');});

test('preview pause freezes navigation and animation until resumed',async()=>{const {player}=fixture();await player.open(createMenuDocument(),{preview:true});player.update(input(),0.2);const time=player.flow.time;player.togglePause();player.update(input(['Enter']),1);assert.equal(player.flow.time,time);assert.equal(player.flow.screenId,'splash');player.togglePause();player.update(input(['Enter']),0.1);await Promise.resolve();assert.equal(player.flow.screenId,'cars');});

test('pausing preview suspends audio and videos, and exit releases its audio suspension',async()=>{
 const {player,game}=fixture();const events=[];game.audio.ctx={state:'running',suspend:async()=>events.push('suspend'),resume:async()=>events.push('resume')};
 await player.open(createMenuDocument(),{preview:true});const video={paused:false,pause(){events.push('video-pause')},play:async()=>events.push('video-play'),removeAttribute(){},load(){}};player.videos.set('video',video);player.slider={element:{binding:'difficulty'}};player.capturing='input.left';
 player.togglePause();assert.equal(player.slider,null);assert.equal(player.capturing,null);assert.deepEqual(events,['suspend','video-pause']);player.togglePause();assert.deepEqual(events,['suspend','video-pause','resume','video-play']);player.togglePause();player.flow.stop();assert.equal(events.filter(e=>e==='resume').length,2);
});

for(const device of ['keyboard','gamepad','touch'])test(`${device} horizontal navigation moves splash buttons to Settings without activating`,async()=>{
 const {player,game}=fixture();game.deviceIsMobile=device==='touch';
 await player.open(createMenuDocument(),{preview:true,screenId:'splash'});
 if(device==='touch')player.surface.layout(390,844);
 const press=direction=>{
  player.update(input(),0.01);
  if(device==='touch')player.surface.controls.pulseAction(direction.toLowerCase());
  player.update(input(device==='keyboard'?['Arrow'+direction]:[],device==='gamepad'?['dpad'+direction]:[]),0.01);
 };
 Object.assign(player.flow.screen.elements.find(e=>e.id==='start'),{id:'next',type:'button',x:0.1,y:0.82,w:0.4,action:{type:'screen',target:'events'}});
 Object.assign(player.flow.screen.elements.find(e=>e.id==='settings'),{x:0.6,y:0.82,w:0.3});
 for(let i=0;i<player.interactive().findIndex(e=>e.id==='next');i++)press('Down');
 assert.equal(player.interactive()[player.focus].id,'next');
 press('Right');assert.equal(player.flow.screenId,'splash');assert.equal(player.interactive()[player.focus].id,'settings');
 press('Right');assert.equal(player.flow.screenId,'splash');assert.equal(player.interactive()[player.focus].id,'settings');
 press('Left');assert.equal(player.interactive()[player.focus].id,'next');assert.equal(player.flow.screenId,'splash');
 press('Right');
 if(device==='touch')player.surface.controls.pulseAction('jump');
 player.update(input(device==='keyboard'?['Enter']:[],device==='gamepad'?['jump']:[]),0.01);
 await Promise.resolve();assert.equal(player.flow.screenId,'settings');
});

test('horizontal input still adjusts choices, sliders and toggles',async()=>{
 const {player}=fixture();await player.open(createMenuDocument(),{preview:true,screenId:'settings'});
 player.focus=player.interactive().findIndex(e=>e.id==='difficulty');
 player.update(input(['ArrowRight']),0.01);assert.equal(player.flow.parameters.difficulty,'hard');
 player.update(input(['ArrowLeft']),0.01);assert.equal(player.flow.parameters.difficulty,'medium');
 await player.flow.run({type:'screen',target:'settings'});
 player.focus=player.interactive().findIndex(e=>e.type==='slider');
 const slider=player.interactive()[player.focus];player.flow.setParameter(slider.binding,slider.min);
 player.update(input([],['dpadRight']),0.01);assert.equal(player.flow.parameters[slider.binding],slider.min+slider.step);
 player.update(input([],['dpadLeft']),0.01);assert.equal(player.flow.parameters[slider.binding],slider.min);
 slider.type='toggle';player.flow.setParameter(slider.binding,false);
 player.update(input(['ArrowRight']),0.01);assert.equal(player.flow.parameters[slider.binding],true);
});

test('horizontal navigation skips hidden controls and never starts key capture',async()=>{
 const {player}=fixture();await player.open(createMenuDocument(),{preview:true,screenId:'splash'});
 Object.assign(player.flow.screen.elements.find(e=>e.id==='start'),{id:'next',type:'button',x:0.1,y:0.82,w:0.4,action:{type:'screen',target:'events'}});
 Object.assign(player.flow.screen.elements.find(e=>e.id==='settings'),{x:0.6,y:0.82,w:0.3});
 player.focus=player.interactive().findIndex(e=>e.id==='next');
 const settings=player.flow.screen.elements.find(e=>e.id==='settings');settings.visible=false;
 player.update(input(['ArrowRight']),0.01);assert.equal(player.interactive()[player.focus].id,'next');assert.equal(player.flow.screenId,'splash');
 settings.visible=true;settings.type='keybind';settings.binding='input.left';
 player.update(input(['ArrowRight']),0.01);assert.equal(player.interactive()[player.focus].id,'settings');
 player.update(input(['ArrowLeft']),0.01);assert.equal(player.interactive()[player.focus].id,'next');assert.ok(!player.capturing);
});

test('top preview button ends playback and restores authoring even while loading or paused',async()=>{
 for(const state of ['playing','loading','paused']){
  const {player,game,calls}=fixture();game.storyData={name:'Authoring'};
  await player.open(createMenuDocument(),{preview:true});game.storyData={name:'Preview'};
  player.bounds={x:0,y:0,w:960,h:540};player.playPauseBounds={x:746,y:0,w:72,h:36};
  if(state==='loading')player.flow.busy=true;
  if(state==='paused')player.togglePause();
  player.handlePointerDown({x:782,y:18});
  assert.equal(player.flow.active,false);assert.equal(player.previewSnapshot,null);
  assert.equal(game.storyData.name,'Authoring');assert.deepEqual(calls.at(-1),['state','menu-editor']);
 }
});

test('garage authoring preview cannot spend or install parts in real player progress',async()=>{
 const {ItemSystem}=await import('../../src/items/ItemSystem.js');
 const {normalizeItemDocument}=await import('../../src/items/ItemDocument.js');
 const {player,game}=fixture();game.player={credits:1000};game.abilities={};let writes=0;
 const part=normalizeItemDocument({id:'test-ecu',name:'Test ECU',carPart:{slot:'ecu',price:200}});
 game.items=new ItemSystem(game,{load:async()=>({}),save:async()=>{writes++;return {ok:true};},library:{load:async()=>part}});
 await player.open(createMenuDocument(),{preview:true});
 await player.resources.garage.purchase('Test ECU');await player.resources.garage.equip('WRX','test-ecu');
 assert.equal(player.resources.garage.items.game.player.credits,800);
 assert.equal(game.player.credits,1000);assert.equal(writes,0);assert.deepEqual(game.items.progress.garage.cars,{});
 player.flow.stop();assert.equal(game.items.progress.bags.items['test-ecu'],undefined);
});

test('controller menu navigation responds immediately, repeats held D-pad and accepts left stick', async()=>{
 const {player}=fixture();await player.open(createMenuDocument());
 const held=new Set(['dpadDown']), axes={leftX:0,leftY:0};
 const controls={isGamepadDown:action=>held.has(action),getGamepadAxes:()=>axes};
 player.update(controls,0.01);assert.equal(player.focus,1);
 player.update(controls,0.20);assert.equal(player.focus,1);
 player.update(controls,0.09);assert.equal(player.focus,0);
 player.update(controls,0.12);assert.equal(player.focus,1);
 held.clear();player.update(controls,0.01);
 axes.leftY=-0.8;player.update(controls,0.01);assert.equal(player.focus,0);
 axes.leftY=0.1;player.update(controls,0.5);assert.equal(player.focus,0);
 axes.leftY=-0.8;player.update(controls,0.01);assert.equal(player.focus,1);
});

test('controller choice popups use held navigation without repeating confirmation', async()=>{
 const {player}=fixture();await player.open(createMenuDocument());
 player.flow.goTo('settings');
 const choice=player.flow.screen.elements.find(e=>e.id==='difficulty');
 await player.activate(choice,1,{choose:true});
 const controls={isGamepadDown:action=>action==='dpadDown'||action==='jump'};
 player.update(controls,0.01);assert.equal(player.choicePopup.index,2);
 player.update(controls,0.29);assert.equal(player.choicePopup.index,0);
 assert.ok(player.choicePopup);
});

test('splash defaults to Game Start and Option Mode contains difficulty',async()=>{
 const {player}=fixture();await player.open(createMenuDocument());
 assert.deepEqual(player.interactive().map(e=>e.label),['Game Start','Option Mode']);
 assert.equal(player.interactive()[player.focus].id,'start');
 player.focus=1;player.update(input(['Enter']),0.01);await Promise.resolve();
 assert.equal(player.flow.screenId,'settings','confirm activates Settings instead of splash startAction');
 assert.equal(player.interactive()[player.focus].id,'difficulty');
 player.update(input(['ArrowRight']),0.01);assert.equal(player.flow.parameters.difficulty,'hard');
 player.flow.back();assert.equal(player.flow.screenId,'splash');
 player.focus=0;player.update(input([],['gamepadStart']),0.01);await Promise.resolve();
 assert.equal(player.flow.screenId,'cars');assert.equal(player.flow.parameters.difficulty,'hard');
 assert.deepEqual(player.interactive().map(e=>e.id),['car']);
});
