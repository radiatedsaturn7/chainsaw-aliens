import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {createMenuDocument,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {worldMapNodes,worldMapNodePoint,raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
import {setMenuProgress,loadMenuProgress,normalizeMenuVariables} from '../../src/menus/MenuProgress.js';
import {normalizeRaceFinishBehavior} from '../../src/racing/raceData.js';
import LevelEditor from '../../src/ui/LevelEditorCore.js';
globalThis.window||={location:{search:''},addEventListener(){},removeEventListener(){}};
const {default:Game}=await import('../../src/game/GameCore.js');
async function fixture(){
 const game={input:{},world:{tileSize:32},transitionTo(state){this.state=state},setActiveMusicTrack(){},menuProgress:{}};
 const player=new MenuPlayer(game);game.menuPlayer=player;player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};
 player.resources.choices=source=>source==='races'?[{label:'First',value:'First'},{label:'Final',value:'Final'}]:[{label:'Car',value:'car'}];
 await player.open(createMenuDocument(),{preview:true,screenId:'world-map'});return {game,player};
}
test('map node locks block keyboard confirmation and completion unlocks the same map',async()=>{
 const {game,player}=await fixture(),map=player.interactive()[0],launches=[];
 player.flow.adapter.launchRace=async ref=>launches.push(ref);
 player.update({wasPressedCode:k=>k==='ArrowRight'},.016);
 assert.equal(player.flow.parameters.raceRef,'First');
 player.flow.parameters.raceRef='Final';
 await player.activate(map,1,{choose:true});assert.deepEqual(launches,[]);assert.equal(player.flow.parameters.raceRef,'First');
 await setMenuProgress(game,{[raceCompletionKey('First')]:true});
 const nodes=worldMapNodes(map,player.resources,player.flow.document,player.flow.parameters);
 assert.equal(nodes[0].completed,true);assert.equal(nodes[1].locked,false);
 player.update({wasPressedCode:k=>k==='ArrowRight'},.016);assert.equal(player.flow.parameters.raceRef,'Final');
 await player.activate(map,1,{choose:true});assert.equal(player.flow.screenId,'garage');assert.deepEqual(launches,[]);
 await player.activate(player.interactive().find(e=>e.id==='garage-play'));assert.deepEqual(launches,['Final']);
 assert.deepEqual(game.menuProgress,{},'preview progress must not write real progress');
});
test('custom nodes, locks and coordinates survive save normalization',()=>{
 const doc=createMenuDocument(),map=doc.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
 map.nodes=[{id:'final',label:'Final',raceRef:'Final',x:.8,y:.3,unlockParameter:'won.first',unlockValue:3,completedParameter:'won.final'}];
 const normalized=normalizeMenuDocument(JSON.parse(JSON.stringify(doc))).screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
 assert.equal(worldMapNodes(normalized,null,doc,{'won.first':2})[0].locked,true);
 assert.equal(worldMapNodes(normalized,null,doc,{'won.first':3})[0].locked,false);
 assert.equal(normalized.nodes[0].x,.8);
});
test('race completion opens a fresh world map, preserves car, and sets completion variables',async()=>{
 const {game,player}=await fixture();player.flow.lockCar('car');player.flow.goTo('garage');player.flow.goTo('tuning');player.flow.goTo('garage');
 assert.ok(player.flow.history.length>0);game.raceTravelSession={carRef:'car',menuFlow:player.flow};
 game.ensureRaceTravelSession=()=>game.raceTravelSession;
 let task;game.openMenuDestination=params=>task=Game.prototype.openMenuDestination.call(game,params);
 assert.equal(Game.prototype.completeRaceTravel.call(game,{type:'menu',menuScreen:'world-map',variables:{bonus:true,chapter:'Providence'}},{raceDocumentName:'First'}),task);
 await task;assert.equal(player.flow.screenId,'world-map');assert.equal(game.state,'menu-player');
 assert.equal(player.flow.parameters[raceCompletionKey('First')],true);assert.equal(player.flow.parameters.bonus,true);
 assert.equal(player.flow.parameters.lastCompletedRace,'First');assert.equal(player.flow.parameters.chapter,'Providence');
 assert.deepEqual(game.menuProgress,{}); // Preview progress stays isolated.
 assert.equal(game.raceTravelSession,null);
 assert.deepEqual(player.flow.history,[]);assert.equal(player.flow.lockedCarRef,'car');
 // New navigation works, but B cannot resurrect the pre-race garage/tuning stack.
 player.flow.goTo('garage');player.flow.back();assert.equal(player.flow.screenId,'world-map');
 assert.deepEqual(player.flow.history,[]);
 let stopped=false;player.flow.adapter.stop=()=>{stopped=true;};
 player.update({wasGamepadPressed:key=>key==='gamepadB'},.016);
 assert.equal(player.flow.screenId,'world-map');assert.equal(stopped,true);
});
test('menu variable trigger continues its queue and open-menu trigger ends its queue',async()=>{
 const {game,player}=await fixture();let done=false;
 Game.prototype.executeTriggerAction.call(game,{type:'set-menu-variables',params:{variables:{checkpoint:true}}},{},()=>done=true);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(done,true);assert.equal(player.flow.parameters.checkpoint,true);
 const state={active:true,queue:[1]};game.triggerState={byId:new Map([['trigger',state]])};
 let task;game.openMenuDestination=params=>task=Game.prototype.openMenuDestination.call(game,params);
 Game.prototype.executeTriggerAction.call(game,{type:'open-menu',params:{menuScreen:'world-map'}},{},()=>{},'trigger');
 await task;await new Promise(resolve=>setImmediate(resolve));assert.equal(player.flow.screenId,'world-map');assert.equal(state.active,false);assert.deepEqual(state.queue,[]);
});
test('progress persists across game instances and rejects unsafe variable keys',async()=>{
 const before=globalThis.fetch;let saved;
 globalThis.fetch=async(_url,options)=>({ok:true,json:async()=>options?.method==='POST'?(saved=JSON.parse(options.body).data.value,{ok:true}):({ok:true,file:{data:{value:saved||{}}}})});
 try{const game={menuProgress:{}};await setMenuProgress(game,{raceCompleted:true,score:3});assert.deepEqual(saved,{raceCompleted:true,score:3});assert.deepEqual(await loadMenuProgress({}),saved);}
 finally{globalThis.fetch=before;}
 assert.deepEqual(normalizeMenuVariables(JSON.parse('{"__proto__":true,"ok":true}')),{ok:true});
});
test('race menu destinations and level trigger defaults are authorable',()=>{
 const finish=normalizeRaceFinishBehavior({type:'menu',menuScreen:'world-map',variables:{finished:true}});
 assert.equal(finish.menuScreen,'world-map');assert.equal(finish.variables.finished,true);
 const editor=Object.create(LevelEditor.prototype);
 assert.equal(editor.createTriggerAction('open-menu').params.menuScreen,'world-map');
 assert.deepEqual(editor.createTriggerAction('set-menu-variables').params.variables,{});
});

test('compact map hit positions reserve space for the selected race label',()=>{
 const bounds={x:20,y:100,w:300,h:110};
 const point=worldMapNodePoint({x:.5,y:1},bounds);
 assert.deepEqual(point,{x:170,y:174});assert.ok(point.y<bounds.y+bounds.h-30);
});

test('car select goes through world map and garage before launching the chosen race',async()=>{
 const {player}=await fixture(),launches=[];
 player.flow.adapter.launchRace=async(ref,configuration)=>launches.push({ref,configuration});
 player.flow.goTo('cars');await player.activate(player.interactive()[0],1,{choose:true});
 assert.equal(player.flow.screenId,'world-map');assert.equal(player.flow.parameters.carRef,'car');
 await player.activate(player.interactive()[0],1,{choose:true});assert.equal(player.flow.screenId,'garage');assert.equal(launches.length,0);
 for(const id of ['garage-tune','garage-upgrade']){
  await player.activate(player.interactive().find(e=>e.id===id));player.flow.back();assert.equal(player.flow.screenId,'garage');
 }
 await player.activate(player.interactive().find(e=>e.id==='garage-play'));
 assert.equal(launches[0].ref,'First');assert.equal(launches[0].configuration.carRef,'car');
 player.flow.back();assert.equal(player.flow.screenId,'world-map');assert.equal(player.flow.parameters.raceRef,'First');
 player.flow.back();assert.equal(player.flow.screenId,'world-map');assert.equal(player.flow.parameters.carRef,'car');
});

test('car confirmation persists once, serializes concurrent selections and does not lock on failed save',async()=>{
 const {commitMenuCar}=await import('../../src/menus/MenuProgress.js');
 const game={menuProgress:{}};let saved,count=0;
 await assert.rejects(commitMenuCar(game,'wrong',{save:async()=>({ok:false})}),/save your car/);
 assert.equal(game.menuProgress.selectedGameCar,undefined);
 const save=async(_key,value)=>{saved=structuredClone(value);count++;return {ok:true};};
 assert.deepEqual(await Promise.all([commitMenuCar(game,'first',{save}),commitMenuCar(game,'second',{save})]),['first','first']);
 assert.equal(saved.selectedGameCar,'first');assert.equal(count,1);
 assert.equal(await commitMenuCar({menuProgress:saved},'third',{save}),'first');assert.equal(count,1);
});

test('saved car bypasses selection on reopening while previews remain independent',async()=>{
 const {game,player}=await fixture();game.menuProgress={selectedGameCar:'saved-car'};
 await player.open(createMenuDocument());
 assert.equal(player.flow.parameters.carRef,'saved-car');
 player.flow.goTo('cars');assert.equal(player.flow.screenId,'world-map');
 player.flow.setParameter('carRef','different');assert.equal(player.flow.parameters.carRef,'saved-car');
 player.flow.goTo('garage');player.flow.back();assert.equal(player.flow.screenId,'world-map');
 await player.open(createMenuDocument(),{preview:true,screenId:'cars'});
 assert.equal(player.flow.screenId,'cars');assert.equal(player.flow.lockedCarRef,'');
 await player.activate(player.interactive()[0],1,{choose:true});
 assert.equal(player.flow.lockedCarRef,'car');assert.equal(game.menuProgress.selectedGameCar,'saved-car');
 player.flow.goTo('cars');assert.equal(player.flow.screenId,'world-map');
});

test('Game Start allows a new choice but committed games cannot back into the splash or showroom',async()=>{
 const {game,player}=await fixture();game.menuProgress={selectedGameCar:'old-car'};
 const originalFetch=globalThis.fetch;let saved;
 globalThis.fetch=async(_url,options)=>({ok:true,json:async()=>{saved=JSON.parse(options.body).data.value;return {ok:true};}});
 try{
  await player.open(createMenuDocument());
  assert.equal(player.flow.lockedCarRef,'old-car');
  await player.activate(player.interactive().find(e=>e.id==='start'));
  assert.equal(player.flow.screenId,'cars');assert.equal(player.flow.lockedCarRef,'');
  assert.equal(game.menuProgress.selectedGameCar,'old-car','opening selection alone does not overwrite the saved car');
  await player.activate(player.interactive()[0],1,{choose:true});
  assert.equal(player.flow.screenId,'world-map');assert.equal(player.flow.lockedCarRef,'car');assert.equal(saved.selectedGameCar,'car');
  player.flow.goTo('garage');player.flow.back();assert.equal(player.flow.screenId,'world-map');
  player.flow.goTo('cars');assert.equal(player.flow.screenId,'world-map');
  player.flow.back();assert.equal(player.flow.active,false);assert.equal(player.flow.screenId,'world-map');
  await player.open(createMenuDocument());assert.equal(player.flow.lockedCarRef,'car');
  await player.activate(player.interactive().find(e=>e.id==='start'));assert.equal(player.flow.screenId,'cars');assert.equal(player.flow.lockedCarRef,'');
 }finally{globalThis.fetch=originalFetch;}
});

test('a failed new-game car save preserves the previous game car',async()=>{
 const {commitMenuCar}=await import('../../src/menus/MenuProgress.js');
 const game={menuProgress:{selectedGameCar:'previous'}};
 await assert.rejects(commitMenuCar(game,'new',{newGame:true,save:async()=>({ok:false})}),/save your car/);
 assert.equal(game.menuProgress.selectedGameCar,'previous');
 assert.equal(await commitMenuCar(game,'new',{newGame:true,save:async()=>({ok:true})}),'new');
 assert.equal(await commitMenuCar(game,'other'),'new');
});

test('race descriptions survive editor save/load and cancelled edits preserve the description',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');const editor=new RaceEditor({});
 await editor.openRaceDescription(async()=>({description:'A fast coastal sprint.\nWatch the final hairpin.'}));
 const saved=editor.serializeSelectedRaceDocument(),race=editor.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(saved)));
 assert.equal(race.description,'A fast coastal sprint.\nWatch the final hairpin.');
 await editor.openRaceDescription(async()=>null);assert.equal(editor.selectedRace.description,race.description);
 await editor.openRaceDescription(async()=>({description:''}));assert.equal(editor.selectedRace.description,'');
});

test('world map keeps nodes and connections without title, back button, frame or bottom name; description follows highlight',async()=>{
 const {drawMenuScreen}=await import('../../src/menus/MenuRenderer.js');
 const doc=createMenuDocument(),screen=doc.screens.find(s=>s.id==='world-map'),map=screen.elements.find(e=>e.type==='world-map');
 assert.equal(map.selectionIndicator,'disabled');assert.equal(map.showSelectedLabel,false);
 assert.deepEqual(screen.elements.map(e=>e.type),['world-map','race-description']);
 const labels=[],lines=[],strokes=[],ctx=new Proxy({measureText:t=>({width:t.length*6}),fillText:t=>labels.push(t),lineTo:(...p)=>lines.push(p),strokeRect:(...p)=>strokes.push(p)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const resources={art:()=>null,choices:()=>[{label:'Race One',value:'one'},{label:'Race Two',value:'two'}],race:ref=>({description:`Description ${ref}`})};
 for(const ref of ['one','two']){
  labels.length=0;drawMenuScreen(ctx,{x:0,y:0,w:390,h:220},doc,screen,{raceRef:ref},{resources,focus:map.id});
  assert.ok(labels.includes(`Description ${ref}`));assert.ok(!labels.some(s=>s.includes(' · ')));
 }
 assert.ok(lines.length>0);assert.equal(strokes.length,0);
});

test('world map arrows follow screen positions and skip disabled nodes for keys, gamepad and touch',async()=>{
 const {player}=await fixture(),map=player.interactive()[0];player.bounds={x:0,y:0,w:960,h:540};player.preview=false;
 map.nodes=[{id:'right',raceRef:'R',x:.8,y:.5},{id:'left',raceRef:'L',x:.2,y:.5},{id:'up',raceRef:'U',x:.5,y:.1},{id:'down',raceRef:'D',x:.5,y:.9},{id:'center',raceRef:'C',x:.5,y:.5},{id:'disabled',raceRef:'X',disabled:true,x:.6,y:.5},{id:'locked',raceRef:'Y',unlockParameter:'unlock',x:.7,y:.5}];
 for(const [direction,expected] of [['Right','R'],['Left','L'],['Up','U'],['Down','D']]){
  player.flow.parameters.raceRef='C';player.update({wasPressedCode:k=>k==='Arrow'+direction},.016);assert.equal(player.flow.parameters.raceRef,expected);
 }
 player.flow.parameters.raceRef='R';player.update({wasPressedCode:k=>k==='ArrowRight'},.016);assert.equal(player.flow.parameters.raceRef,'R','no wrapping to the opposite side');
 player.flow.parameters.raceRef='C';player.update({wasGamepadPressed:k=>k==='dpadLeft'},.016);assert.equal(player.flow.parameters.raceRef,'L');
 const {menuElementBounds}=await import('../../src/menus/MenuRenderer.js');
 for(const id of ['disabled','locked']){const node=map.nodes.find(n=>n.id===id),p=worldMapNodePoint(node,menuElementBounds(map,player.bounds),map);player.handlePointerDown({...p,id:1});assert.equal(player.flow.parameters.raceRef,'L');}
 map.nodes.forEach(n=>n.disabled=true);await player.activate(map,1,{choose:true});assert.equal(player.flow.parameters.raceRef,'');assert.equal(player.flow.screenId,'world-map');
});
