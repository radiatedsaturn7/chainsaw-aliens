import test from 'node:test';
import assert from 'node:assert/strict';
import {MapCarAudio} from '../../src/menus/MapCarAudio.js';
const car={tuning:{idleRpm:850,redlineRpm:6500},audio:{engineSoundId:'selected-engine'}};
test('map travel revs the selected engine and stops its loop at arrival',()=>{
 const played=[],stopped=[],vehicle=[];
 const audio=new MapCarAudio({playSfxById:(id,opts)=>played.push({id,...opts}),stopSfxById:(id,opts)=>stopped.push({id,...opts}),audio:{setEngineRev(){},setVehicleSound:(...args)=>vehicle.push(args)}});
 audio.update(car,false,.016);assert.equal(played.length,0);
 audio.update(car,true,.1);audio.update(car,true,.1);
 assert.equal(played.length,2);assert.equal(played[0].id,'selected-engine');assert.equal(played[0].loop,true);assert.ok(played[1].pitchCents>played[0].pitchCents);
 audio.update(car,false,.1);assert.equal(stopped.length,1);assert.equal(vehicle.at(-1)[0],false);
 audio.stop();assert.equal(stopped.length,1);
});
test('map travel has a synthesized fallback and cleans it up when car data disappears',()=>{
 const calls=[];const audio=new MapCarAudio({audio:{setEngineRev:(...args)=>calls.push(args),setVehicleSound(){}}});
 audio.update({tuning:car.tuning,audio:{engineProfile:'inline-four'}},true,.1);
 assert.equal(calls[0][0],true);assert.equal(calls[0][1].profile,'inline-four');
 audio.update(null,true,.1);assert.equal(calls.at(-1)[0],false);
});
