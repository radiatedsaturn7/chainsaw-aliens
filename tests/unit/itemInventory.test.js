import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemSystem,ITEM_PROGRESS_KEY} from '../../src/items/ItemSystem.js';
import {RadioPlayer} from '../../src/radio/RadioPlayer.js';
import {itemRecipients} from '../../src/items/ItemRuntime.js';
import {itemEffectFields} from '../../src/items/ItemEffectFields.js';
import {createVehicleControlInputBuffer,readVehicleControlInput} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
import {VehicleControlInputTimeline,VehicleDynamicsRunner,normalizeVehicleControlInput} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';
import {InventoryMenu} from '../../src/items/InventoryMenu.js';

function setup(initial={}){
 const storage=structuredClone(initial),writes=[];let reject=false;
 const load=async key=>structuredClone(storage[key]||{});
 const save=async(key,value)=>{if(reject)return {ok:false};storage[key]=structuredClone(value);writes.push(key);return {ok:true};};
 const game={world:{},player:{x:0,y:0,health:3,maxHealth:5,facing:1},abilities:{},enemies:[]};
 game.items=new ItemSystem(game,{load,save});game.radio=new RadioPlayer({load,save,getInventory:()=>game.items});
 return {game,storage,writes,fail:value=>{reject=value;}};
}
const nitro={id:'nitro',name:'Nitro',effects:[{type:'speed',when:'use',recipient:'player',amount:1.5,duration:2}]};
const shot={id:'slow-shot',name:'Slow shot',effects:[{type:'speed',when:'hit',recipient:'opponents',amount:0.5,duration:2}]};

test('radio ownership migrates into inventory and new tracks commit with pickups atomically',async()=>{
 const {game,storage,writes,fail}=setup({'rtg-radio-progress':{unlocked:['old']},'rtg-radio-library':{tracks:[{id:'old',src:'old.mp3'},{id:'new',src:'new.mp3'}],stations:[{id:'s',trackIds:['old','new']}]}});
 await game.radio.load();game.items.restorePlayer();assert.equal(game.player.bags.radio.old,1);assert.deepEqual(game.radio.tracks.map(t=>t.id),['old']);
 const item={id:'tape',effects:[{type:'inventory',bag:'radio',target:'new'}]};
 fail(true);assert.equal(await game.items.collect(item,'tape'),false);assert.equal(game.items.progress.bags.radio.new,undefined);
 fail(false);game.items.retryAt.clear();assert.equal(await game.items.collect(item,'tape'),true);
 assert.equal(storage[ITEM_PROGRESS_KEY].bags.radio.new,1);assert.ok(storage[ITEM_PROGRESS_KEY].collected.includes('tape'));
 assert.ok(writes.every(key=>key===ITEM_PROGRESS_KEY));assert.deepEqual(game.radio.tracks.map(t=>t.id),['old','new']);
 const next=setup(storage);await next.game.radio.load();assert.deepEqual(next.game.radio.tracks.map(t=>t.id),['old','new']);
});
test('usable pickups persist, do not activate on contact, and consume only after a successful save',async()=>{
 const {game,storage,fail}=setup();await game.items.collect(nitro,'one');
 assert.equal(game.items.progress.bags.items.nitro,1);assert.equal(game.player.itemSpeedMultiplier,undefined);
 fail(true);assert.equal(await game.items.use('nitro'),false);assert.equal(game.items.progress.bags.items.nitro,1);
 assert.equal(game.player.itemSpeedMultiplier,undefined);fail(false);
 assert.deepEqual(await Promise.all([game.items.use('nitro'),game.items.use('nitro')]),[true,false]);
 assert.equal(storage[ITEM_PROGRESS_KEY].bags.items.nitro,0);assert.equal(game.player.itemSpeedMultiplier,1.5);
 game.items.runtime.update(1);assert.equal(game.player.itemSpeedMultiplier,1.5);game.items.runtime.update(1);assert.equal(game.player.itemSpeedMultiplier,1);
});
test('allies and opponents use actor relationships, and a projectile slows only its first eligible hit',async()=>{
 const {game}=setup();const ally={x:30,y:0,taxonomies:['Player and Allies']},enemy={x:100,y:0},behind={x:160,y:0};game.enemies=[ally,enemy,behind];
 assert.deepEqual(itemRecipients(game,'allies'),[ally]);assert.deepEqual(itemRecipients(game,'opponents'),[enemy,behind]);
 await game.items.collect(shot,'shot');await game.items.use('slow-shot');assert.equal(enemy.itemSpeedMultiplier,undefined);
 game.items.runtime.update(0.25);assert.equal(enemy.itemSpeedMultiplier,0.5);assert.equal(ally.itemSpeedMultiplier,undefined);assert.equal(behind.itemSpeedMultiplier,undefined);assert.equal(game.items.runtime.projectiles.length,0);
 game.items.runtime.update(2);assert.equal(enemy.itemSpeedMultiplier,1);
});
test('race recipients respect teams; fired item hits a car and timed effects clear on leaving the race',async()=>{
 const {game}=setup();const ally={worldX:0,worldZ:3,teamId:'blue'},opponent={worldX:0,worldZ:10,teamId:'red'};
 const session={running:true,worldX:0,worldZ:0,carYaw:0,teamId:'blue',aiRuntime:[ally,opponent]};game.raceEditor={playtestSession:session};
 await game.items.collect(nitro,'nitro');await game.items.use('nitro');assert.equal(session.itemSpeedMultiplier,1.5);
 await game.items.collect(shot,'shot');await game.items.use('slow-shot');game.items.runtime.update(0.2);
 assert.equal(opponent.itemSpeedMultiplier,0.5);assert.equal(ally.itemSpeedMultiplier,undefined);
 session.running=false;game.items.runtime.update(0.1);assert.equal(session.itemSpeedMultiplier,1);assert.equal(opponent.itemSpeedMultiplier,1);
});
test('ally health grants do not change player stats and spent items survive race return and reload',async()=>{
 const {game,storage}=setup();const ally={x:10,y:0,health:2,maxHealth:6};game.friendlyCompanion=ally;
 const kit={id:'medkit',name:'Medkit',effects:[{type:'health',amount:3,when:'use',recipient:'allies'}]};
 await game.items.collect(kit,'kit');await game.items.use('medkit');assert.equal(ally.health,5);assert.equal(game.player.health,3);
 const next=setup(storage);await next.game.items.load();assert.equal(next.game.items.progress.bags.items.medkit,0);assert.equal(next.game.items.usableItems().length,0);
});
test('effect forms use named selections and only relevant inputs; hit recipient defaults to opponents',()=>{
 const fields=itemEffectFields({type:'health'},{id:'key-a',name:'Blue key'},{tracks:[{id:'track-a',title:'Night Drive'}]});
 const visible=state=>fields.filter(field=>!field.visibleWhen||field.visibleWhen(state)).map(field=>field.id);
 assert.deepEqual(visible({type:'health'}),['type','when','recipient','amount']);
 assert.deepEqual(visible({type:'inventory',bag:'radio'}),['type','when','recipient','bag','target']);
 const target=fields.find(field=>field.id==='target');assert.equal(target.options({type:'inventory',bag:'radio'})[1].label,'Night Drive');
 assert.equal(fields.find(field=>field.id==='recipient').options({type:'speed',when:'hit'})[0].value,'opponents');
 assert.equal(target.options({type:'key'})[0].label,'Blue key');
});
test('Inventory menu exposes usable items and Radio bag without raw content IDs',async()=>{
 const {game}=setup();await game.items.collect(nitro,'n');let used=false;
 const menu=new InventoryMenu(game.items,{onUse:()=>{used=true;}});assert.equal(menu.rows()[0].label,'Use Nitro ×1');
 await menu.rows()[0].onClick();assert.equal(used,true);assert.ok(menu.rows().some(row=>row.id==='inventory-radio'));
});
const inert={step:()=>({worldForceN:{},worldMomentNm:{},suspensionForceWorldN:{},wheelLoadsN:{},wheelSlip:{},suspensionTravel:{},tireForcesN:{},wheelAngularVelocityRadps:{},contactPatches:{},suspensionState:{},grounded:false})};
test('item strength survives worker transport and changes authoritative velocity in the car heading',()=>{
 const simulate=(strength,yaw=0)=>{
  const input=readVehicleControlInput(createVehicleControlInputBuffer({itemSpeedMultiplier:strength}));
  assert.equal(normalizeVehicleControlInput(input).itemSpeedMultiplier,strength);
  const runner=new VehicleDynamicsRunner({config:{massKg:1000,handlingPreset:'simulation'},initialState:{position:{x:0,y:10,z:0},velocity:{x:0,y:0,z:10},orientation:quaternionFromEuler({yaw})},tireContactSubsystem:inert});
  runner.advance(1/60,{input});return runner.state.velocity;
 };
 const base=simulate(1),boost=simulate(1.5),slow=simulate(0.5),turned=simulate(1.5,Math.PI/2);
 assert.ok(boost.z>base.z);assert.ok(slow.z<base.z);assert.ok(turned.x>base.x);assert.ok(Math.abs(turned.z-base.z)<0.001);
});

test('held control samples retain item activation and expiry without blending or dropping either edge',()=>{
 const timeline=new VehicleControlInputTimeline();
 for(const [timeSeconds,multiplier] of [[0,1],[1,1],[2,1.5],[3,1.5],[4,1],[5,1]])timeline.addSample(timeSeconds,{itemSpeedMultiplier:multiplier});
 assert.equal(timeline.sampleAt(1.5).itemSpeedMultiplier,1);assert.equal(timeline.sampleAt(2.5).itemSpeedMultiplier,1.5);assert.equal(timeline.sampleAt(4.5).itemSpeedMultiplier,1);
});

test('Radio inventory is browsable when playback is disabled and long bags stay within six menu rows',async()=>{
 const {game}=setup({'rtg-radio-library':{tracks:Array.from({length:9},(_,i)=>({id:`song${i}`,title:`Song ${i}`,initiallyUnlocked:true}))}});
 await game.radio.load();await game.radio.setEnabled(false);
 const menu=new InventoryMenu(game.items);menu.rows().find(row=>row.id==='inventory-radio').onClick();
 const seen=new Set();for(;;){const rows=menu.rows();assert.ok(rows.length<=6);assert.ok(!rows.some(row=>row.id==='inventory-play-radio'));for(const row of rows)if(row.id.startsWith('inventory-track:'))seen.add(row.label);const next=rows.find(row=>row.id==='inventory-next');if(!next)break;next.onClick();}
 assert.equal(seen.size,9);assert.ok(seen.has('Song 8'));
});

test('Inventory effects that grant a named usable item retain its use behavior',async()=>{
 const {game}=setup();game.items.library={load:async name=>{assert.equal(name,'Nitro');return nitro;}};
 await game.items.collect({id:'crate',name:'Crate',effects:[{type:'inventory',target:'nitro',itemRef:'Nitro',contentName:'Nitro',amount:2}]},'crate');
 assert.equal(game.items.progress.bags.items.nitro,2);assert.equal(await game.items.use('nitro'),true);assert.equal(game.items.progress.bags.items.nitro,1);assert.equal(game.player.itemSpeedMultiplier,1.5);
});

test('using a stored map persists its reveal and consumes the inventory item',async()=>{
 const {game,storage}=setup();game.world={itemScope:'map-level',tileSize:32,roomAtTile:()=>4};const revealed=[];game.minimap={revealNearbyRooms:(room,radius)=>revealed.push({room,radius})};
 await game.items.collect({id:'map-use',effects:[{type:'map',when:'use',amount:2}]},'map-use');
 assert.deepEqual(revealed,[]);await game.items.use('map-use');assert.deepEqual(revealed,[{room:4,radius:2}]);
 assert.deepEqual(storage[ITEM_PROGRESS_KEY].mapReveals,[{scope:'map-level',room:4,radius:2}]);assert.equal(storage[ITEM_PROGRESS_KEY].bags.items['map-use'],0);
});
test('recipient and activation choices only offer behavior supported by the selected effect',()=>{
 const fields=itemEffectFields({type:'health'},{id:'new',name:'New'}),recipient=fields.find(f=>f.id==='recipient'),when=fields.find(f=>f.id==='when');
 assert.deepEqual(recipient.options({type:'inventory'}).map(o=>o.value),['player']);
 assert.deepEqual(when.options({type:'inventory'}).map(o=>o.value),['collect','use']);
 assert.deepEqual(recipient.options({type:'speed',when:'use'}).map(o=>o.value),['player','allies','opponents','everyone']);
});
