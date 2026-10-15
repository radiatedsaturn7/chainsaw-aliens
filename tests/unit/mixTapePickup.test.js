import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMixTape,updateLevelMixTapes,mixTapeRotation} from '../../src/radio/MixTapePickup.js';
import {RadioPlayer} from '../../src/radio/RadioPlayer.js';
import {updateRaceSceneryCollisions} from '../../src/racing/simulation/DamageModel.js';
const item={id:'tape',itemType:'mix-tape',unlockTrackId:'song',x:10,y:10,z:10,w:32,h:32,widthM:1,heightM:1};
function radioFixture(){let saves=0;const radio=new RadioPlayer({load:async key=>key.includes('library')?{tracks:[{id:'song',title:'Song',src:'/song.mp3'}]}:{},save:async()=>{saves++;return {ok:true};}});return {radio,get saves(){return saves;}};}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('pickup waits for durable unlock, deduplicates simultaneous contacts and preserves authored item',async()=>{
 const fixture=radioFixture(),state={},messages=[];await fixture.radio.load();let release;fixture.radio.savePreference=()=>new Promise(resolve=>{release=resolve;});
 const first=collectMixTape({radio:fixture.radio,item,id:item.id,state,notify:message=>messages.push(message)});
 assert.equal(collectMixTape({radio:fixture.radio,item,id:item.id,state}),first);await settle();assert.equal(state.mixTapeCollected.has(item.id),false);
 release({ok:true});assert.equal(await first,true);assert.equal(state.mixTapeCollected.has(item.id),true);assert.equal(messages[0],'Unlocked: Song');assert.equal(item.itemType,'mix-tape');
});
test('storage failure leaves tape collectible; retry persists an in-memory unlock',async()=>{
 const {radio}=radioFixture(),state={};await radio.load();let attempts=0;radio.savePreference=async()=>++attempts===1?{ok:false,reason:'offline'}:{ok:true};
 assert.equal(await collectMixTape({radio,item,id:item.id,state,now:0}),false);assert.equal(state.mixTapeCollected.has(item.id),false);
 assert.equal(await collectMixTape({radio,item,id:item.id,state,now:100}),false);assert.equal(attempts,1);
 assert.equal(await collectMixTape({radio,item,id:item.id,state,now:5001}),true);assert.equal(attempts,2);
});
test('level pickup requires contact and unlocks even when radio is disabled',async()=>{
 const {radio}=radioFixture();await radio.load();await radio.setEnabled(false);const game={radio,world:{decals:[item]},player:{x:100,y:100,width:10,height:10}};
 updateLevelMixTapes(game);await settle();assert.equal(radio.progress.unlocked.length,0);
 game.player.x=20;game.player.y=20;updateLevelMixTapes(game);await settle();assert.deepEqual(radio.progress.unlocked,['song']);assert.ok(game.mixTapePickupState.mixTapeCollected.has('tape'));assert.equal(game.world.decals.length,1);
});
test('race mix tapes collect without damage or velocity impulses and disappear only after save',async()=>{
 const {radio}=radioFixture(),session={speedMps:20},editor={game:{radio},playtestSession:session,ensureRaceScenery:()=>[item],getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({}),getRaceVehicleCollisionContactPoints:()=>[{x:10,z:10,y:0.5}],getRaceDoodadForScenery:()=>({...item,defaultRule:{behavior:'collide'}}),sampleRaceDoodadGroundPoint:()=>({elevation:0}),getRaceThreeElevationM:()=>0};
 updateRaceSceneryCollisions(editor,0.016);assert.deepEqual(session.removedSceneryIds,[]);await settle();assert.deepEqual(session.removedSceneryIds,['tape']);assert.equal(session.speedMps,20);assert.deepEqual(session.triggeredSceneryIds,[]);
});
test('race pickups respect height above the tape',async()=>{
 const {radio}=radioFixture(),session={},editor={game:{radio},playtestSession:session,ensureRaceScenery:()=>[item],getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({}),getRaceVehicleCollisionContactPoints:()=>[{x:10,z:10,y:8}],getRaceDoodadForScenery:()=>item,sampleRaceDoodadGroundPoint:()=>({elevation:0}),getRaceThreeElevationM:()=>0};
 updateRaceSceneryCollisions(editor,0.016);await settle();assert.deepEqual(session.removedSceneryIds,[]);assert.equal(radio.progress.unlocked.length,0);
});
test('collectible rotation changes continuously with game time',()=>{assert.equal(mixTapeRotation(0),0);assert.equal(mixTapeRotation(4/3),Math.PI);assert.equal(mixTapeRotation(8/3),2*Math.PI);});
