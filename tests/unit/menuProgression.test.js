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
 assert.equal(player.flow.parameters.raceRef,'Final');
 await player.activate(map,1,{choose:true});assert.deepEqual(launches,[]);assert.match(player.flow.error,/locked/);
 await setMenuProgress(game,{[raceCompletionKey('First')]:true});
 const nodes=worldMapNodes(map,player.resources,player.flow.document,player.flow.parameters);
 assert.equal(nodes[0].completed,true);assert.equal(nodes[1].locked,false);
 await player.activate(map,1,{choose:true});assert.deepEqual(launches,['Final']);
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
test('race completion opens Garage, preserves car, and sets the completion variable before returning',async()=>{
 const {game,player}=await fixture();game.raceTravelSession={carRef:'car',menuFlow:player.flow};
 game.ensureRaceTravelSession=()=>game.raceTravelSession;
 let task;game.openMenuDestination=params=>task=Game.prototype.openMenuDestination.call(game,params);
 assert.equal(Game.prototype.completeRaceTravel.call(game,{type:'menu',menuScreen:'garage',variables:{bonus:true}},{raceDocumentName:'First'}),true);
 await task;assert.equal(player.flow.screenId,'garage');assert.equal(game.state,'menu-player');
 assert.equal(player.flow.parameters[raceCompletionKey('First')],true);assert.equal(player.flow.parameters.bonus,true);
 assert.equal(game.raceTravelSession,null);
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
