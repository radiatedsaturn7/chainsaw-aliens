import test from 'node:test';
import assert from 'node:assert/strict';
import {stepCvt,normalizeCvtTuning} from '../../src/racing/simulation/CvtTransmissionModel.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
// Generic test controller, not a claimed production calibration.
const cvt={minRatio:.357,maxRatio:2.805,cruiseRpm:1800,powerRpm:6000,ratioRatePerSecond:1};
const step=(args={})=>stepCvt({config:cvt,wheelOmegaRadps:100,finalDrive:5.034,throttle:1,dt:.1,...args});
test('CVT is bounded, continuously variable and rate limited',()=>{
  assert.equal(step({wheelOmegaRadps:0}).ratio,cvt.maxRatio);
  assert.equal(step().ratio,cvt.maxRatio-.1);
  assert.equal(step({dt:0}).ratio,cvt.maxRatio);
  assert.equal(step({dt:10,wheelOmegaRadps:1e6}).ratio,cvt.minRatio);
  assert.ok(step({dt:10,throttle:1}).ratio>step({dt:10,throttle:0}).ratio);
  assert.throws(()=>step({config:{...cvt,minRatio:4}}),RangeError);
  assert.throws(()=>step({dt:NaN}),RangeError);
  const legacy={gearRatios:[3,2,1]};assert.equal(normalizeCvtTuning(legacy),legacy);
});
const tuning=normalizeCvtTuning({cvt,gearFinalDrive:5.034,reverseRatio:1.797,drivetrain:'fwd',powerHp:149,torqueLbFt:146,idleRpm:800,redlineRpm:6400,revLimitRpm:6600,launchRpm:2000,torquePeakStartRpm:2500,torquePeakEndRpm:4500});
function motor(overrides={}) {return new PowertrainModel().stepAuthoritativeWheelTorques({tuning,
  controls:{requestedGear:8,throttle:.7,assists:{autoShift:true}},
  previous:{gear:1,targetGear:1},config:{drivenWheelIds:['fl','fr'],maxRpm:6600,wheelRadiusM:.33,brakeForceN:10000},
  kinematicsByWheel:{fl:{wheelAngularVelocityRadps:20},fr:{wheelAngularVelocityRadps:20}},
  driveShareByWheel:{fl:.5,fr:.5},capacityByWheel:{fl:4000,fr:4000},dt:.1,...overrides});}
test('D never performs virtual shifts; dynamic ratio supplies wheel torque and rpm',()=>{
  const r=motor();assert.equal(r.state.gear,1);assert.equal(r.state.shiftTimeRemainingSeconds,0);
  assert.equal(r.telemetry.overallRatio,r.state.cvt.ratio*5.034);
  assert.ok(r.wheelDriveTorqueNm.fl>0);
  const p=JSON.parse(JSON.stringify(r.state));assert.deepEqual(motor({previous:p}),motor({previous:r.state}));
});
test('neutral and reverse retain distinct authored ratios',()=>{
  for(const gear of [0,-1]) {
    const r=motor({previous:{gear,targetGear:gear},controls:{requestedGear:gear,throttle:.5}});
    assert.equal(r.telemetry.overallRatio,gear===0?0:1.797*5.034);
    if(gear===0) assert.equal(r.wheelDriveTorqueNm.fl,0);
    else assert.ok(r.wheelDriveTorqueNm.fl<0);
  }
});
test('editor JSON, runtime and tuning controls preserve CVT without virtual gears',()=>{
  const e=new RaceEditor({}); const car=e.selectedCar;
  car.tuning={...car.tuning,...tuning};car.transmissions={automatic:{...tuning}};car.defaultTransmissionType='automatic';
  const restored=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(car)));
  const t=e.getRaceCarTuning(restored);assert.deepEqual(t.cvt,cvt);assert.deepEqual(t.gearRatios,[cvt.maxRatio]);
  assert.equal(e.setCarTuneNumericValue('gearCount',8),false);
  assert.equal(e.setCarTuneNumericValue('cvt-minRatio',4),false);
  assert.equal(e.setCarTuneNumericValue('cvt-powerRpm',5800),true);
  assert.equal(e.getRaceCarTuning(car).cvt.powerRpm,5800);
  assert.equal(e.getRaceTuningRowsForTab('gearing',car).length,6);
  const c=createVehicleDynamicsConfigFromTuning(t);assert.deepEqual(c.powertrainTuning.cvt,cvt);
});
const environment=()=>({surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},
  sampleTerrainAtWorldPoint:()=>({valid:true,heightM:0,normal:{x:0,y:1,z:0},surfaceId:'asphalt',friction:1,region:'road'}),
  sampleTerrainMaximumHeightInBounds:()=>0});
function runner(){ const config=createVehicleDynamicsConfigFromTuning(tuning);
  return new VehicleDynamicsRunner({config,initialState:{gear:1,position:{x:0,y:config.cgHeightM+.08,z:0},velocity:{x:0,y:0,z:15},wheelAngularVelocityRadps:{fl:45,fr:45,rl:45,rr:45}},
    inputTimeline:[{timeSeconds:0,input:{throttle:.7,requestedGear:1,assists:{autoShift:true}}}],environmentProvider:environment});}
test('actual runner advances and JSON replay preserve ratio state deterministically',()=>{
  const r=runner();for(let i=0;i<30;i++)r.advance(1/120);
  assert.equal(r.state.gear,1);assert.ok(Number.isFinite(r.state.engineRpm));
  assert.ok(r.state.powertrainState.cvt.ratio>=cvt.minRatio);
  assert.ok(r.state.powertrainState.cvt.ratio<cvt.maxRatio);
  assert.equal(r.state.powertrainState.telemetry.overallRatio,r.state.powertrainState.cvt.ratio*5.034);
  const replay=VehicleDynamicsRunner.replay(JSON.parse(JSON.stringify(r.createReplayRecord())),{environmentProvider:environment});
  assert.deepEqual(replay.state,r.state);
});

test('snapshot continuation and forward ratio transitions remain deterministic',()=>{
  const a=runner();for(let i=0;i<20;i++)a.advance(1/120);
  const b=runner();b.restoreSnapshot(JSON.parse(JSON.stringify(a.createSnapshot())));
  for(let i=0;i<20;i++){a.advance(1/120);b.advance(1/120);}
  assert.deepEqual(a.state,b.state);
  const sample=motor({previous:{gear:1,targetGear:1,cvt:{ratio:1.1}},
    kinematicsByWheel:{fl:{wheelAngularVelocityRadps:80},fr:{wheelAngularVelocityRadps:80}}});
  assert.ok(sample.state.cvt.ratio!==1.1);
  assert.equal(sample.state.shiftTorqueScale,1);
});


test('near/far AI does not switch CVT to fixed-ratio aggregate physics',async()=>{
 const {useRaceAiRemotePowertrain}=await import('../../src/racing/RaceAiRemotePowertrain.js');
 const {planRaceAiControls}=await import('../../src/racing/RaceAiControls.js');
 const e=new RaceEditor({}), car=e.selectedCar;
 car.tuning={...car.tuning,...tuning};car.transmissions={automatic:{...tuning}};car.defaultTransmissionType='automatic';
 const t=e.getRaceCarTuning(car);
 for(const distance of [20,150,20]) {
  const ai={speedMps:30,gear:1,worldX:distance,worldZ:0,physicsBudgetDetail:'cheap'};
  assert.equal(useRaceAiRemotePowertrain(ai,{worldX:0,worldZ:0},t),false);
  const controls=planRaceAiControls(e,ai,t,40);
  assert.equal(controls.gear,1);
  assert.ok(Math.abs(controls.rpm-(cvt.cruiseRpm+(cvt.powerRpm-cvt.cruiseRpm)*controls.throttle))<1e-8);
  ai.vehicleDynamicsRunner={state:{powertrainState:{cvt:{ratio:1}}}};
  const persisted=planRaceAiControls(e,ai,t,40);
  assert.ok(Math.abs(persisted.rpm-30/t.wheelRadiusM*t.finalDrive*60/(2*Math.PI))<1e-8);
 }
 assert.equal(useRaceAiRemotePowertrain({physicsBudgetDetail:'cheap'},{worldX:0,worldZ:0},{}),true);
});
