import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const stored=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/2024 Sentinel Sedan/document.json',import.meta.url)));
const doc=stored.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;
const e=new RaceEditor({});const car=e.normalizeLoadedCarDocument(doc),t=e.getRaceCarTuning(car),config=createVehicleDynamicsConfigFromTuning(t,{chassisHz:120,tireHz:360});
const env=()=>({surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},sampleTerrainAtWorldPoint:()=>({valid:true,heightM:0,normal:{x:0,y:1,z:0},surfaceId:'asphalt',friction:1,region:'road'}),sampleTerrainMaximumHeightInBounds:()=>0});
function run({speed=0,gear=1,throttle=1,seconds=5}={}){
 const omega=speed/config.wheelRadiusM;
 const r=new VehicleDynamicsRunner({config,initialState:{position:{x:0,y:config.cgHeightM+.08,z:0},velocity:{x:0,y:0,z:speed},speedMps:speed,gear,powertrainState:{gear,targetGear:gear,engineRpm:750},wheelAngularVelocityRadps:{fl:omega,fr:omega,rl:omega,rr:omega}},inputTimeline:[{timeSeconds:0,input:{throttle,requestedGear:gear,assists:{tractionControlEnabled:true,autoShift:true}}}],environmentProvider:env});
 for(let i=0;i<seconds*120;i++)r.advance(1/120);return r;
}
test('Sentinel serialized editor document preserves genuine CVT contract',()=>{
 assert.equal(t.cvt.minRatio,.357);assert.equal(t.cvt.maxRatio,2.805);assert.equal(t.finalDrive,5.034);assert.equal(t.reverseRatio,1.797);assert.deepEqual(t.gearRatios,[2.805]);assert.equal(t.weightKg,3036*.45359237);
 assert.equal(car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(car.art.shellFrames.mode,'8-way');
});
test('Sentinel launches and varies continuous ratio in actual production runner',()=>{
 const r=run({seconds:8});assert.ok(r.state.speedMps>5);assert.equal(r.state.gear,1);assert.ok(r.state.position.z>1);
 const ratio=r.state.powertrainState.cvt.ratio;assert.ok(ratio>=.357&&ratio<2.805);assert.ok(Number.isFinite(r.state.engineRpm));
 console.log('Sentinel launch8s',JSON.stringify({speedMps:r.state.speedMps,rpm:r.state.engineRpm,ratio}));
});
test('Sentinel powered rolling and reverse remain finite with correct direction',()=>{
 const rolling=run({speed:20,throttle:.25,seconds:4});assert.ok(rolling.state.speedMps>5);assert.ok(Number.isFinite(rolling.state.engineRpm));assert.equal(rolling.state.gear,1);assert.ok(rolling.state.powertrainState.cvt.ratio<2.805);
 const reverse=run({gear:-1,throttle:.5,seconds:3});assert.equal(reverse.state.gear,-1);assert.ok(reverse.state.position.z<-.1);assert.equal(reverse.state.powertrainState.telemetry.overallRatio,1.797*5.034);
 console.log('Sentinel rolling/reverse',JSON.stringify({rollingSpeed:rolling.state.speedMps,rollingRatio:rolling.state.powertrainState.cvt.ratio,reverseZ:reverse.state.position.z,reverseSpeed:reverse.state.speedMps}));
});
