import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {normalizeItemDocument,serializeItemDocument,itemAsDoodad} from '../../src/items/ItemDocument.js';
import {planItemEffects,applyItemPlan} from '../../src/items/ItemEffects.js';

test('item documents retain artwork, dimensions, pickup policy and multiple effects',()=>{
 const item=normalizeItemDocument({id:'medic',name:'Medic',artRef:'medic art',widthM:2,heightPx:48,persistent:false,effects:[{type:'max-health',amount:3},{type:'health',amount:2}]});
 assert.deepEqual(normalizeItemDocument(serializeItemDocument(item)),item);
 assert.equal(itemAsDoodad(item).item.effects.length,2);
 assert.equal(itemAsDoodad(item).artRef,'medic art');
});
test('legacy mix tapes migrate to a radio unlock effect',()=>{
 const item=normalizeItemDocument({kind:'race-doodad',doodad:{id:'tape',itemType:'mix-tape',unlockTrackId:'song',artRef:'tape art'}});
 assert.deepEqual(item.effects,[{type:'radio-track',target:'song',amount:1,operation:'add'}]);
 assert.equal(item.rotate,true);
});
test('effects are allowlisted data, including safe target keys',()=>{
 for(const effect of [{type:'script'},{type:'ability',target:'__proto__'},{type:'modifier',target:'x'},{type:'health',amount:'no'}])assert.throws(()=>normalizeItemDocument({effects:[effect]}));
});
test('planning a combined pickup is pure and applies real player stats and grants',()=>{
 const player={health:2,maxHealth:5,armor:0,speed:200,credits:10},abilities={},progress={};
 const effects=[{type:'health',amount:20},{type:'max-health',amount:2},{type:'armor',amount:3},{type:'currency',amount:5},
 {type:'key',target:'red'},{type:'inventory',target:'battery',amount:2},{type:'weapon',target:'ignitir'},{type:'device',target:'scanner'},
 {type:'unlock',target:'garage'},{type:'ability',target:'anchor'},{type:'modifier',target:'speed',operation:'multiply',amount:1.5}];
 const plan=planItemEffects({effects},player,abilities,progress);
 assert.deepEqual(player,{health:2,maxHealth:5,armor:0,speed:200,credits:10});assert.deepEqual(progress,{});
 const game={player,abilities};applyItemPlan(plan,game);
 assert.equal(player.health,7);assert.equal(player.maxHealth,7);assert.equal(player.speed,300);assert.equal(player.credits,15);assert.equal(player.armor,3);
 assert.equal(game.itemProgress.keys.red,1);assert.equal(game.itemProgress.inventory.battery,2);assert.equal(game.itemProgress.devices.scanner,true);
 assert.equal(game.itemProgress.unlocks.garage,true);assert.equal(game.abilities.ignitir,true);assert.equal(game.abilities.anchor,true);
});
test('bundled pickup definitions are editable JSON and all validate',async()=>{
 const data=JSON.parse(await readFile(new URL('../../src/content/items.json',import.meta.url)));
 const items=data.items.map(normalizeItemDocument);
 assert.equal(new Set(items.map(item=>item.id)).size,items.length);
 assert.equal(data.items.find(item=>item.legacyTile==='H').effects[0].type,'max-health');
});
