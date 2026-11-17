import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const source=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/moschatel-2018/import.json',import.meta.url)));
const editor=new RaceEditor({});
const car=editor.normalizeLoadedCarDocument(structuredClone(source.car));
const tuning=editor.getRaceCarTuning(car),config=createVehicleDynamicsConfigFromTuning(tuning,{chassisHz:120,tireHz:360});
function run({speed=0,throttle=1,energy=40*3.6e6,seconds=1}={}){
 const runner=new VehicleDynamicsRunner({config,initialState:{position:{x:0,y:config.cgHeightM+.08,z:0},speedMps:speed,velocity:{x:0,y:0,z:speed},gear:1,powertrainState:{gear:1,engineRpm:0,electric:{batteryEnergyJ:energy}}},inputTimeline:[{timeSeconds:0,input:{throttle,requestedGear:1,assists:{tractionControlEnabled:true,autoShift:true}}}],environmentProvider:()=>({surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},sampleTerrainAtWorldPoint:()=>({valid:true,heightM:0,normal:{x:0,y:1,z:0},surfaceId:'asphalt',friction:1,region:'road'}),sampleTerrainMaximumHeightInBounds:()=>0})});
 for(let i=0;i<seconds*120;i++)runner.advance(1/120);return runner;
}
test('Moschatel normalizes to true single-speed EV without combustion substitutes',()=>{assert.equal(tuning.powertrainType,'electric');assert.equal(tuning.electricPowertrain.peakPowerKw,500);assert.equal(tuning.electricPowertrain.peakTorqueNm,650);assert.equal(tuning.idleRpm,0);assert.deepEqual(tuning.gearRatios,[1]);assert.equal(tuning.engineDisplacementL,0);assert.equal(tuning.electricPowertrain.usableBatteryKwh,40);});
test('Moschatel actual launch and powered rolling run spend energy',()=>{
 const launch=run({seconds:5});// This generic TC-enabled fixture measures about 23.93 m/s after 5 s; it does not reproduce the OEM 0–100 figure.
 assert.ok(launch.state.speedMps>20 && launch.state.speedMps<30);assert.equal(launch.state.powertrainState.telemetry.combustionTorqueNm,0);const motor=launch.state.powertrainState.telemetry.electric;assert.ok(motor.driveMotorTorqueNm*motor.motorRpm*2*Math.PI/60<=500000+1e-6);assert.equal(launch.state.gear,1);
 assert.ok(launch.state.powertrainState.electric.batteryEnergyJ<40*3.6e6);
 const rolling=run({speed:20,throttle:.25,seconds:2});assert.ok(rolling.state.speedMps>20);
 assert.ok(rolling.state.powertrainState.electric.batteryEnergyJ<40*3.6e6);
});
test('Moschatel lift-off recovers bounded energy and depletion stops motor torque',()=>{
 const energy=20*3.6e6,rolling=run({speed:20,throttle:0,energy,seconds:2});
 const recovered=rolling.state.powertrainState.electric.batteryEnergyJ-energy;
 assert.ok(recovered>0);assert.ok(recovered<.5*config.massKg*20**2);assert.ok(rolling.state.speedMps<20);
 const empty=run({energy:100,seconds:2});assert.equal(empty.state.powertrainState.electric.batteryEnergyJ,0);
 assert.equal(empty.state.powertrainState.telemetry.electric.driveMotorTorqueNm,0);
});
