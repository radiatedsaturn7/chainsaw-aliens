import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeElectricTuning } from '../../src/racing/simulation/ElectricPowertrainModel.js';
import { PowertrainModel } from '../../src/racing/simulation/PowertrainModel.js';
import { VehicleDynamicsRunner, createVehicleDynamicsConfigFromTuning } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const electricPowertrain = { peakTorqueNm: 700, peakPowerKw: 400, maxMotorRpm: 18000,
  reductionRatio: 10.65, usableBatteryKwh: 70, driveEfficiency: .9, regenEfficiency: .8,
  maxRegenTorqueNm: 100, maxRegenPowerKw: 50, standstillLossKw: 2,
  regenFullSpeedRadps: 5, liftOffRegen: .5 };
const tuning = normalizeElectricTuning({ powertrainType: 'electric', electricPowertrain, drivetrain: 'awd' });
const ids = ['fl','fr','rl','rr'];
function motor(args={}) {
  return new PowertrainModel().stepAuthoritativeWheelTorques({ tuning,
    config:{ maxRpm:18000, idleRpm:0, drivenWheelIds:ids, brakeForceN:10000, wheelRadiusM:.33 },
    controls:{throttle:1,clutch:1,requestedGear:6,assists:{autoShift:true}},
    state:{mechanical:{config:{enabled:true},engineRunning:false,effects:{torque:0,drive:0}}},
    kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{wheelAngularVelocityRadps:10,slipRatio:0}])),
    driveShareByWheel:Object.fromEntries(ids.map(id=>[id,.25])),
    capacityByWheel:Object.fromEntries(ids.map(id=>[id,3000])),dt:1/60,...args });
}
test('authoritative electric torque bypasses ICE idle, clutch, shifts and fuel failures',()=>{
  const r=motor(); assert.equal(r.state.gear,1);assert.equal(r.state.clutchCoupling,1);
  assert.equal(r.state.shiftTimeRemainingSeconds,0);assert.equal(r.telemetry.combustionTorqueNm,0);
  assert.equal(r.telemetry.engineBrakeTorqueNm,0);assert.ok(r.wheelDriveTorqueNm.fl>0);
  assert.ok(r.state.electric.batteryEnergyJ<70*3.6e6);
  const empty=motor({previous:{electric:{batteryEnergyJ:0}}});assert.equal(empty.wheelDriveTorqueNm.fl,0);
});
test('regen disables under service brake, handbrake, lost contact and slip',()=>{
  const base={previous:{electric:{batteryEnergyJ:1e8}},controls:{requestedGear:1,throttle:0}};
  assert.ok(motor(base).wheelDriveTorqueNm.fl<0);
  for(const args of [{controls:{...base.controls,brake:1}},{controls:{...base.controls,handbrake:1}},
    {capacityByWheel:{}},{kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{wheelAngularVelocityRadps:10,slipRatio:.3}]))}]) {
    assert.equal(motor({...base,...args}).telemetry.electric.regenMotorTorqueNm,0);
  }
  assert.ok(motor({...base,controls:{...base.controls,brake:1}}).wheelBrakeTorqueNm.fl>0);
});
test('editor preserves EV tuning and single reduction through JSON and runtime config',()=>{
  const editor=new RaceEditor({});
  const car=editor.selectedCar; car.tuning={...car.tuning,...tuning};
  const restored=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(car)));
  const resolved=editor.getRaceCarTuning(restored);
  assert.equal(resolved.powertrainType,'electric'); assert.equal(resolved.idleRpm,0);
  assert.equal(resolved.finalDrive,10.65);assert.deepEqual(resolved.gearRatios,[1]);
  assert.deepEqual(resolved.electricPowertrain,electricPowertrain);
  assert.equal(editor.setCarTuneNumericValue('gearFinalDrive',11),true);
  assert.equal(editor.getRaceCarTuning(car).finalDrive,11);
  assert.equal(editor.setCarTuneNumericValue('gearCount',6),false);
  const config=createVehicleDynamicsConfigFromTuning(resolved);
  const runner=new VehicleDynamicsRunner({config});
  assert.equal(runner.config.idleRpm,0);assert.equal(runner.state.engineRpm,0);
  runner.state.powertrainState.electric={batteryEnergyJ:1234};
  const snapshot=JSON.parse(JSON.stringify(runner.createStateSnapshot()));
  runner.replaceAuthoritativeState(snapshot);
  assert.equal(runner.state.powertrainState.electric.batteryEnergyJ,1234);
});
test('electric model editor uses shared scroll layout and every field is reachable',()=>{
  for(const bounds of [{x:0,y:0,w:360,h:150},{x:0,y:0,w:900,h:600}]){
    const e=new RaceEditor({});e.selectedCar.tuning={...e.selectedCar.tuning,...tuning};
    e.carTuneTab='power-curve';
    const ctx=new Proxy({measureText:()=>({width:40})},{get:(o,k)=>k in o?o[k]:()=>{}});
    e.drawCarTunePanel(ctx,bounds);
    const seen=new Set(e.carDriveSliderRegions.map(r=>r.key));
    const scroll=e.carTuneScrollRegion;
    assert.ok(e.carDriveSliderRegions.length<=8);
    for(let i=1;i<=(scroll?.maxScroll||0);i++){
      e.menuScrollState[scroll.scrollKey]=i;e.drawCarTunePanel(ctx,bounds);
      for(const r of e.carDriveSliderRegions)seen.add(r.key);
      assert.ok(e.carDriveSliderRegions.length<=8);
    }
    assert.equal(seen.size,12);
    assert.equal(e.setCarTuneNumericValue('electric-usableBatteryKwh',55),true);
    assert.equal(e.getRaceCarTuning().electricPowertrain.usableBatteryKwh,55);
  }
});
