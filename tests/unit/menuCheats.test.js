import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {redeemGarageCheat,bestCheatParts} from '../../src/garage/GarageCheats.js';
import {cycleCodeLetter,menuCodeValue} from '../../src/menus/MenuCodeEntry.js';
import {createMenuDocument,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import Player from '../../src/entities/Player.js';
const part=(id,slot,tier,extra={})=>normalizeItemDocument({id,name:id,carPart:{slot,tier,price:100,...extra}});
const catalog=[part('street','turbo','street'),part('race','turbo','race',{requires:['ecu']}),part('ecu','ecu','race'),part('wrong','brakes','race',{compatibleCars:['other']})];
function fixture({fail=false,progress={}}={}){
 const game={player:new Player(0,0),abilities:{}};game.player.credits=12;let saved;
 const items=new ItemSystem(game,{load:async key=>key==='rtg-item-progress'?progress:{},save:async(_key,value)=>{if(fail)return {ok:false,reason:'offline'};saved=structuredClone(value);return {ok:true};},library:{list:async()=>catalog,load:async name=>catalog.find(i=>i.name===name)}});game.items=items;
 return {game,items,garage:items.garage,saved:()=>saved};
}
test('NOLOVE adds exactly a million dollars and survives reloading',async()=>{
 const f=fixture();await redeemGarageCheat(f.garage,'nolove');assert.equal(f.game.player.credits,1000012);
 const reloaded=fixture({progress:f.saved()});await reloaded.items.load();reloaded.items.restorePlayer();assert.equal(reloaded.game.player.credits,1000012);
});
test('invalid codes and failed saves grant nothing',async()=>{
 const f=fixture({fail:true});await assert.rejects(redeemGarageCheat(f.garage,'NOLOVE'),/offline/);assert.equal(f.game.player.credits,12);
 await assert.rejects(redeemGarageCheat(f.garage,'WRONG!'),/Invalid/);assert.equal(f.saved(),undefined);
 await assert.rejects(redeemGarageCheat(f.garage,'IGNORE'),/offline/);assert.equal(f.items.progress.unlocks['cheat.ignore'],undefined);
});
test('LONELY grants all parts and equips best compatible tiers with dependencies',async()=>{
 const f=fixture();await redeemGarageCheat(f.garage,'LONELY',{carRef:'car',stock:{garagePartSlots:['turbo','ecu']}});
 assert.deepEqual(f.garage.configuration('car').installed,{turbo:'race',ecu:'ecu'});
 for(const item of catalog)assert.ok(f.items.progress.bags.items[item.id]>=1);
 assert.equal(f.game.player.credits,12);
 assert.deepEqual(bestCheatParts(catalog,'car',{garagePartSlots:['turbo']}).map(p=>p.id),['street']);
});
test('LONELY entered before choosing a car equips on build and permits later customization',async()=>{
 const f=fixture();await redeemGarageCheat(f.garage,'LONELY');
 const car={setup:{},tuning:{},garagePartSlots:['turbo','ecu']};
 await f.garage.build('car',car);assert.equal(f.garage.configuration('car').installed.turbo,'race');
 await f.garage.remove('car','turbo');await f.garage.build('car',car);assert.equal(f.garage.configuration('car').installed.turbo,undefined);
});
test('IGNORE protects the player and all race damage channels and survives reload',async()=>{
 const f=fixture();await redeemGarageCheat(f.garage,'IGNORE');
 assert.equal(f.game.player.takeDamage(100),false);assert.equal(f.game.player.health,5);
 const editor=new RaceEditor(f.game);let called=false;editor.getRaceSessionDamage=()=>{called=true;return {};};
 for(const part of ['engine','transmission','panels','suspension'])editor.applyRaceDamage(part,100);
 assert.equal(called,false);
 const reload=fixture({progress:f.saved()});await reload.items.load();reload.items.restorePlayer();assert.equal(reload.game.player.takeDamage(100),false);
 const normal=new Player(0,0);assert.equal(normal.takeDamage(1),true);assert.equal(normal.health,4);
});
test('code picker uses A–Z wrapping and configurable length',()=>{
 assert.equal(menuCodeValue('nolove'), 'NOLOVE');assert.equal(menuCodeValue('',6),'AAAAAA');
 assert.equal(cycleCodeLetter('AAAAAA',0,-1),'ZAAAAA');assert.equal(cycleCodeLetter('ZAAAAA',0,1),'AAAAAA');
 assert.equal(cycleCodeLetter('AAAA',3,1,4),'AAAB');
 const doc=normalizeMenuDocument(JSON.parse(JSON.stringify(createMenuDocument())));
 assert.equal(doc.screens.find(s=>s.id==='settings').elements.find(e=>e.id==='cheats').action.target,'cheats');
 assert.equal(doc.screens.find(s=>s.id==='cheats').elements.find(e=>e.id==='code').action.type,'cheat-code');
});
test('keyboard and controller cycle letters without moving menu focus; confirm submits and B returns',async()=>{
 for(const mode of ['keyboard','gamepad']){
  const p=new MenuPlayer({input:{},menuProgress:{},transitionTo(){},setActiveMusicTrack(){}});p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
  await p.open(createMenuDocument(),{preview:true,screenId:'settings'});p.flow.goTo('cheats');
  const press=(key,pad)=>{p.update(mode==='keyboard'?{wasPressedCode:k=>k===key}:{wasGamepadPressed:k=>k===pad},.016);p.update({},.016);};
  press('ArrowUp','dpadUp');assert.equal(p.flow.parameters.cheatCode,'BAAAAA');assert.equal(p.focus,0);
  press('ArrowRight','dpadRight');press('ArrowDown','dpadDown');assert.equal(p.flow.parameters.cheatCode,'BZAAAA');
  let submitted;p.flow.adapter.cheatCode=async code=>submitted=code;
  press('Enter','jump');await new Promise(r=>setImmediate(r));assert.equal(submitted,'BZAAAA');
  press('Escape','gamepadB');assert.equal(p.flow.screenId,'settings');
 }
});

test('preview code redemption changes only the preview inventory',async()=>{
 const f=fixture();await f.items.load();
 Object.assign(f.game,{input:{},menuProgress:{},transitionTo(){},setActiveMusicTrack(){}});
 const p=new MenuPlayer(f.game);p.settings.load=async()=>{};p.resources.prepareGarage=async()=>{};
 await p.open(createMenuDocument(),{preview:true,screenId:'cheats'});
 p.flow.setParameter('cheatCode','NOLOVE');await p.activate(p.interactive()[0],1,{choose:true});
 assert.equal(p.resources.garage.items.game.player.credits,1000012);assert.equal(f.game.player.credits,12);assert.equal(f.saved(),undefined);
 assert.match(p.message,/preview only/);
});
