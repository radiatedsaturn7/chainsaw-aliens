import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const source=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/milkweed-60-2013/import.json',import.meta.url)));
const editor=new RaceEditor({});
const car=editor.normalizeLoadedCarDocument(structuredClone(source.car));
const tuning=editor.getRaceCarTuning(car),config=createVehicleDynamicsConfigFromTuning(tuning,{chassisHz:120,tireHz:360});
function run({speed=0,throttle=1,energy=18.8*3.6e6,seconds=1}={}){
 const runner=new VehicleDynamicsRunner({config,initialState:{position:{x:0,y:config.cgHeightM+.08,z:0},speedMps:speed,velocity:{x:0,y:0,z:speed},gear:1,powertrainState:{gear:1,engineRpm:0,electric:{batteryEnergyJ:energy}}},inputTimeline:[{timeSeconds:0,input:{throttle,requestedGear:1,assists:{tractionControlEnabled:true,autoShift:true}}}],environmentProvider:()=>({surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},sampleTerrainAtWorldPoint:()=>({valid:true,heightM:0,normal:{x:0,y:1,z:0},surfaceId:'asphalt',friction:1,region:'road'}),sampleTerrainMaximumHeightInBounds:()=>0})});
 for(let i=0;i<seconds*120;i++)runner.advance(1/120);return runner;
}
test('Milkweed retains sourced combined EV figures and clearly separated assumptions',()=>{
 assert.equal(config.wheelWidthByWheelM.rl,.155);assert.equal(config.wheelWidthByWheelM.fl,.155);assert.equal(tuning.powertrainType,'electric');assert.equal(tuning.electricPowertrain.peakPowerKw,125);
 assert.ok(Math.abs(tuning.electricPowertrain.peakTorqueNm-250)<.001);
 assert.equal(tuning.electricPowertrain.reductionRatio,9.7);assert.equal(tuning.idleRpm,0);
 assert.equal(tuning.electricPowertrain.usableBatteryKwh,18.8);assert.notEqual(tuning.electricPowertrain.usableBatteryKwh,22);
 assert.ok(source.provenance.estimates.some(x=>x.includes('92percent')));assert.deepEqual(tuning.gearRatios,[1]);
});
test('Milkweed actual launch and powered rolling run spend energy',()=>{
 const launch=run({seconds:5});assert.ok(launch.state.speedMps>5);assert.equal(launch.state.gear,1);
 assert.ok(launch.state.powertrainState.electric.batteryEnergyJ<18.8*3.6e6);
 const rolling=run({speed:20,throttle:.25,seconds:2});assert.ok(rolling.state.speedMps>20);
 assert.ok(rolling.state.powertrainState.electric.batteryEnergyJ<18.8*3.6e6);
});
test('Milkweed lift-off recovers bounded energy and depletion stops motor torque',()=>{
 const energy=9.4*3.6e6,rolling=run({speed:20,throttle:0,energy,seconds:2});
 const recovered=rolling.state.powertrainState.electric.batteryEnergyJ-energy;
 assert.ok(recovered>0);assert.ok(recovered<.5*config.massKg*20**2);assert.ok(rolling.state.speedMps<20);
 const empty=run({energy:100,seconds:2});assert.equal(empty.state.powertrainState.electric.batteryEnergyJ,0);
 assert.equal(empty.state.powertrainState.telemetry.electric.driveMotorTorqueNm,0);
});
