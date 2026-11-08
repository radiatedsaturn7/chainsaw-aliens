import test from 'node:test';
import assert from 'node:assert/strict';
import {GarageEnginePreview} from '../../src/menus/GarageEnginePreview.js';
function fixture(car={tuning:{idleRpm:800,revLimitRpm:7000,engineInertiaKgM2:.3}}){
 const calls=[],stops=[],game={audio:{setEngineRev:(...args)=>calls.push(args),setVehicleSound(){}},playSfxById:(...args)=>calls.push(args),stopSfxById:(...args)=>stops.push(args)};
 return {preview:new GarageEnginePreview(game),calls,stops,car};
}
test('holding revs to the installed limit, inertia changes response and release settles without editing the car',()=>{
 const f=fixture(),before=structuredClone(f.car);
 for(let i=0;i<100;i++)f.preview.update(f.car,1,.02);
 assert.equal(f.preview.rpm,7000);assert.equal(f.calls.at(-1)[1].throttle,1);
 for(let i=0;i<200;i++)f.preview.update(f.car,0,.02);
 assert.equal(f.preview.active,false);assert.deepEqual(f.calls.at(-1),[false]);assert.deepEqual(f.car,before);
 const slow=fixture({tuning:{idleRpm:800,revLimitRpm:7000,engineInertiaKgM2:.6}}),fast=fixture();
 slow.preview.update(slow.car,1,.1);fast.preview.update(fast.car,1,.1);assert.ok(slow.preview.rpm<fast.preview.rpm);
});
test('custom engine loops use their own key, follow pitch and stop when leaving',()=>{
 const f=fixture({tuning:{idleRpm:900,revLimitRpm:6500},audio:{engineSoundId:'my-engine',engineSfxVolume:.5}});
 f.preview.update(f.car,1,.1);const first=f.calls.at(-1);assert.equal(first[0],'my-engine');assert.equal(first[1].key,'garage-engine');assert.equal(first[1].loop,true);
 f.preview.update(f.car,1,.1);assert.ok(f.calls.at(-1)[1].pitchCents>first[1].pitchCents);
 f.preview.stop();assert.deepEqual(f.stops,[['my-engine',{key:'garage-engine'}]]);assert.equal(f.preview.active,false);
});
