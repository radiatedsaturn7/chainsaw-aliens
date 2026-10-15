import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import ItemEditor from '../../src/ui/ItemEditor.js';
const item={name:'Core',effects:[{type:'max-health',amount:2},{type:'key',target:'red'}]};
function fixture(save=async()=>({ok:true})) {
 const game={player:{health:3,maxHealth:5,armor:0,credits:0},abilities:{}};
 return {game,system:new ItemSystem(game,{load:async()=>({}),save})};
}
test('concurrent contacts collect once and distinct pickups serialize without lost grants',async()=>{
 let saves=0;const {game,system}=fixture(async()=>{saves++;return {ok:true};});
 assert.deepEqual(await Promise.all([system.collect(item,'one'),system.collect(item,'one'),system.collect(item,'two')]),[true,true,true]);
 assert.equal(saves,2);assert.equal(game.player.maxHealth,9);assert.equal(system.progress.keys.red,2);
});
test('failed durable save leaves player and collection untouched; retry succeeds',async()=>{
 let attempts=0;const {game,system}=fixture(async()=>({ok:++attempts>1,reason:'offline'}));
 assert.equal(await system.collect(item,'one'),false);assert.equal(game.player.maxHealth,5);assert.equal(system.isCollected('one'),false);
 system.retryAt.clear();assert.equal(await system.collect(item,'one'),true);assert.equal(game.player.maxHealth,7);
});
test('saved grants restore on a new player and never apply twice to that player',async()=>{
 let stored;const first=fixture(async(_key,value)=>{stored=structuredClone(value);return {ok:true};});await first.system.collect(item,'one');
 const game={player:{health:5,maxHealth:5},abilities:{}};
 const system=new ItemSystem(game,{load:async()=>stored,save:async()=>({ok:true})});await system.load();system.restorePlayer();system.restorePlayer();
 assert.equal(game.player.maxHealth,7);assert.equal(game.itemProgress.keys.red,1);assert.equal(await system.collect(item,'one'),false);
});
test('Item Editor history restores effect edits and menu handlers are available',async()=>{
 const editor=new ItemEditor({input:{isGamepadConnected:()=>false}});
 await editor.change(()=>{editor.doodad.effects=[{type:'health',amount:2}];});
 assert.equal(editor.doodad.effects.length,1);editor.undo();assert.equal(editor.doodad.effects.length,0);editor.redo();assert.equal(editor.doodad.effects[0].amount,2);
 for(const root of ['file','edit','artwork','effects'])for(const action of editor.getMenuItems(root))assert.equal(typeof action.onClick,'function',action.id);
});
function canvasContext() {
 const noop=()=>{};
 return new Proxy({measureText:text=>({width:String(text).length*6}),createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>key in target?target[key]:noop,set:(target,key,value)=>{target[key]=value;return true;}});
}
for(const [mode,width,height,mobile] of [['portrait',390,844,true],['desktop',1280,800,false],['landscape',844,390,true]])test(`Item Editor ${mode} renders functional shared controls`,()=>{
 const editor=new ItemEditor({deviceIsMobile:mobile,input:{isGamepadConnected:()=>false}});
 editor.draw(canvasContext(),width,height);
 assert.ok(editor.buttons.some(button=>button.id==='item-effect-add'));
 if(mode==='portrait'){
  for(const id of ['menu','undo','redo','context','item-properties','item-art','item-image'])assert.ok(editor.buttons.some(button=>button.id===id),id);
  assert.ok(editor.panJoystick.radius>0);assert.ok(editor.sliderRegions.some(slider=>slider.key==='item-zoom'));
  editor.mobileMenuOpen=true;editor.mobileRootId='effects';editor.draw(canvasContext(),width,height);
  assert.ok(editor.buttons.some(button=>button.id==='item-effect-edit'));
 }
});
import {updateLevelItems} from '../../src/items/ItemPickups.js';
import {updateRaceSceneryCollisions} from '../../src/racing/simulation/DamageModel.js';
import {itemAsDoodad} from '../../src/items/ItemDocument.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import Player from '../../src/entities/Player.js';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('level sprite collection applies effects after contact without changing authored placement',async()=>{
 const {game,system}=fixture();game.items=system;game.player={...game.player,x:200,y:200,width:20,height:30};
 const placement={id:'sprite',itemType:'item',item,x:0,y:0,w:32,h:32};game.world={decals:[placement]};
 updateLevelItems(game);await settle();updateLevelItems(game);await settle();assert.equal(game.player.maxHealth,5);
 game.player.x=16;game.player.y=16;updateLevelItems(game);await settle();assert.equal(game.player.maxHealth,7);assert.equal(system.isCollected('item:sprite'),true);assert.equal(game.world.decals[0],placement);
});
test('race items collect on car contact without damage or speed loss',async()=>{
 const {game,system}=fixture();game.items=system;
 const placement={id:'race-core',itemType:'item',item,x:10,z:10,presetId:'doodad'},session={speedMps:20};
 const editor={game,playtestSession:session,ensureRaceScenery:()=>[placement],getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({}),getRaceVehicleCollisionContactPoints:()=>[{x:10,z:10,y:0.5}],getRaceDoodadForScenery:()=>itemAsDoodad(item),sampleRaceDoodadGroundPoint:()=>({elevation:0}),getRaceThreeElevationM:()=>0};
 updateRaceSceneryCollisions(editor,0.016);await settle();assert.equal(game.player.maxHealth,7);assert.deepEqual(session.removedSceneryIds,['race-core']);assert.equal(session.speedMps,20);assert.deepEqual(session.triggeredSceneryIds,[]);
});
test('race paint preserves embedded item definition through JSON round-trip',()=>{
 const editor=new RaceEditor({});editor.raceSpritePaintKind='doodad';editor.selectedItemDefinition=item;editor.selectedItemRef='Core';
 const sprite=editor.createRaceScenerySprite({x:5,y:8});const loaded=JSON.parse(JSON.stringify(sprite));
 assert.equal(loaded.itemRef,'Core');assert.equal(loaded.z,8);assert.equal(editor.getRaceDoodadForScenery(loaded).item.effects[0].type,'max-health');
});
test('armor absorbs damage before health',()=>{
 const player=new Player(0,0);player.armor=2;player.takeDamage(3);assert.equal(player.armor,0);assert.equal(player.health,4);
});
test('repeatable pickups persist grants but can be collected again in a fresh session',async()=>{
 let stored;const first=fixture(async(_key,value)=>{stored=structuredClone(value);return {ok:true};});
 await first.system.collect({...item,persistent:false},'repeat');assert.deepEqual(stored.collected,[]);assert.equal(stored.keys.red,1);
 const second=fixture();second.system.loadPreference=async()=>stored;await second.system.collect({...item,persistent:false},'repeat');assert.equal(second.system.progress.keys.red,2);
});
test('slow save does not overwrite unrelated stats changed during pickup',async()=>{
 let release;const {game,system}=fixture(()=>new Promise(resolve=>{release=()=>resolve({ok:true});}));
 const pending=system.collect({effects:[{type:'key',target:'red'}]},'key');await settle();game.player.health=1;game.player.speed=450;release();await pending;
 assert.equal(game.player.health,1);assert.equal(game.player.speed,450);
});
test('race item command is available from the Sprites menu',()=>{
 const editor=new RaceEditor({});const action=editor.getMenuItems('sprites').find(action=>action.id==='race-item');
 assert.ok(action);assert.equal(action.disabled,false);assert.equal(typeof action.onSelect,'function');
});
test('persistent movement modifiers survive recalculating equipped upgrades',async()=>{
 const {game,system}=fixture();game.player=new Player(0,0);const speed=game.player.speed;
 await system.collect({effects:[{type:'modifier',target:'speed',amount:50}]},'speed');assert.equal(game.player.speed,speed+50);
 game.player.applyUpgrades([]);assert.equal(game.player.speed,speed+50);game.player.applyUpgrades([]);assert.equal(game.player.speed,speed+50);
});
