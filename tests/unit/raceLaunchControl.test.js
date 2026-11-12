import test from 'node:test';
import assert from 'node:assert/strict';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {advanceRaceLaunchControl} from '../../src/racing/simulation/RaceLaunchControl.js';
import {createVehicleControlInputBuffer,readVehicleControlInput} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';
const ids=['fl','fr','rl','rr'];
const each=value=>Object.fromEntries(ids.map(id=>[id,structuredClone(value)]));
const model=new PowertrainModel();
function step(previous={}, {staging=false,enabled=true,tc=false,autoShift=true,throttle=1,brake=0,handbrake=0,gear=1,speed=0,omega=0,slip=0}={}) {
 return model.stepAuthoritativeWheelTorques({previous:{gear:1,targetGear:1,engineRpm:1100,...previous},
 tuning:{drivetrain:'awd',gearRatios:[2.8,2.1],finalDrive:4,launchRpm:4500,torqueLbFt:664,torqueConverterSlip:0,idleRpm:1100,revLimitRpm:8500,torquePeakStartRpm:4500,torquePeakEndRpm:6000,torqueFalloffRpm:8500},
 config:{idleRpm:1100,maxRpm:8500,wheelRadiusM:.33755,massKg:1190,brakeForceN:14000},
 controls:{requestedGear:gear,throttle,brake,handbrake,clutch:staging?1:0,assists:{autoShift,tractionControlEnabled:tc,launchControlEnabled:enabled,launchControlStaging:staging}},
 kinematicsByWheel:each({wheelAngularVelocityRadps:omega,longitudinalVelocityMps:speed,effectiveRollingRadiusM:.33755,slipRatio:slip,peakLongitudinalSlipRatio:.1}),
 capacityByWheel:each(3000),driveShareByWheel:each(.25),state:{groundSpeedMps:speed},dt:1/120});
}
test('countdown hold arms launch, holds authored RPM, and sends no wheel torque',()=>{
 for(const autoShift of [true,false])for(const tc of [true,false]){
  let result;
  for(let i=0;i<240;i++)result=step(result?.state,{staging:true,tc,autoShift});
  assert.equal(result.state.launchControl.phase,'armed');
  assert.ok(Math.abs(result.state.engineRpm-4500)<2);
  assert.ok(Object.values(result.wheelDriveTorqueNm).every(t=>t===0));
  const go=step(result.state,{tc,autoShift});
  assert.equal(go.state.launchControl.phase,'launching');
  assert.ok(go.state.clutchCoupling>0 && go.state.clutchCoupling<.1);
  assert.ok(go.wheelDriveTorqueNm.fl>0);
 }
});
test('launch regulates wheelspin independently of TC and relinquishes control afterward',()=>{
 let result=step({}, {staging:true});
 for(let i=0;i<60;i++)result=step(result.state,{speed:2,omega:30,slip:1});
 assert.equal(result.telemetry.tractionControlActive,false);
 assert.equal(result.telemetry.launchControlActive,true);
 assert.ok(result.state.tractionTorqueScale<.3);
 const complete=step(result.state,{speed:13,omega:60,slip:1});
 assert.equal(complete.telemetry.launchControlActive,false);
 assert.equal(complete.state.tractionTorqueScale,1);
 const stoppedAgain=step(complete.state,{speed:0});
 assert.equal(stoppedAgain.telemetry.launchControlActive,false);
});
test('launch cancellation, timeout, rolling starts and no-countdown acceleration cannot auto-arm',()=>{
 const input={enabled:true,staging:false,throttle:1,gear:1,dt:.1};
 assert.equal(advanceRaceLaunchControl({},input).phase,'done');
 assert.equal(advanceRaceLaunchControl({}, {...input,staging:true,speedMps:5}).phase,'idle');
 for(const cancel of [{enabled:false},{throttle:0},{brake:1},{handbrake:1},{gear:-1},{gear:2},{speedMps:12}]) {
  assert.equal(advanceRaceLaunchControl({phase:'armed'}, {...input,...cancel}).phase,'done');
 }
 assert.equal(advanceRaceLaunchControl({phase:'launching',elapsed:2.95},input).phase,'done');
 assert.equal(advanceRaceLaunchControl({phase:'armed'},{...input,staging:true,throttle:0}).phase,'idle');
});
test('sequential automatic take-up avoids idle lugging without changing manual clutch',()=>{
 let result;
 for(let i=0;i<120;i++)result=step(result?.state,{enabled:false});
 assert.ok(result.state.engineRpm>4400);
 assert.equal(result.state.clutchCoupling,.35);
 assert.equal(result.state.tractionTorqueScale,1);
 assert.equal(step({}, {enabled:false,autoShift:false}).state.clutchCoupling,1);
});
test('launch flags survive worker input serialization',()=>{
 const input=readVehicleControlInput(createVehicleControlInputBuffer({throttle:1,clutch:1,gear:1,assists:{launchControlEnabled:true,launchControlStaging:true,tractionControlEnabled:false}}));
 assert.equal(input.assists.launchControlStaging,true);
 assert.equal(input.assists.launchControlEnabled,true);
 assert.equal(input.assists.tractionControlEnabled,false);
});
test('launch setting toggles session and saved preference; controls submenus remain capped at eight',()=>{
 const editor=new RaceEditor({});editor.playtestSession={};const saved=[];
 editor.saveDrivingPreference=value=>saved.push(value);
 editor.raceInput.pauseMenuMode='car-controls';
 const toggle=editor.getRacePauseMenuRows().find(row=>row.id==='race-launch-control');
 assert.equal(toggle.value,'Off');toggle.onClick();
 assert.equal(editor.playtestSession.launchControlEnabled,true);
 assert.deepEqual(saved.at(-1),{raceLaunchControl:true});
 toggle.onAdjust();assert.equal(editor.playtestSession.launchControlEnabled,false);
 for(const mode of ['settings','car-controls','car-lights','car-signals']) {
  editor.raceInput.pauseMenuMode=mode;assert.ok(editor.getRacePauseMenuRows().length<=8);
 }
});
test('Airslayer leaves the line on a dry 12% grade with ABS/TC on or off',()=>{
 for(const tc of [true,false]){
  const result=runClimb({carName:'STI Airslayer',tireName:'Tarmac',surface:'asphalt',snowMm:0,slope:.12,temperatureC:20,throttle:1,tc,seconds:1,sampleEverySeconds:.5});
  assert.ok(result.mph>6,JSON.stringify(result));
  assert.ok(result.samples.at(-1).rpm>3000);
  assert.ok(Math.abs(result.lateralM)<.1);
 }
});

test('real Airslayer powertrain stages at launch RPM and drives away with TC on and off',()=>{
 for(const tc of [true,false]) {
  const result=runClimb({carName:'STI Airslayer',tireName:'Tarmac',surface:'asphalt',snowMm:0,slope:0,temperatureC:20,seconds:3,sampleEverySeconds:1,
   controlAt:t=>({throttle:1,clutch:t<2?1:0,assists:{autoShift:true,absEnabled:tc,tractionControlEnabled:tc,launchControlEnabled:true,launchControlStaging:t<2}})});
  const staged=result.samples[1];
  assert.ok(Math.abs(staged.mph)<.1,JSON.stringify(staged));
  assert.ok(Math.abs(staged.rpm-4500)<5,JSON.stringify(staged));
  assert.ok(result.mph>5,JSON.stringify(result));
 }
});
