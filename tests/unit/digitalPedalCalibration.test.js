import test from 'node:test';
import assert from 'node:assert/strict';
import {CARS,pedalGesture,QUARTER_MILE_M,loadPedalVehicle,pedalMaterial,runPedalCase} from '../../tools/vehicle-validation/calibrate-digital-pedals.mjs';
import {RACE_SURFACES} from '../../src/racing/raceData.js';
import {advanceDigitalThrottle} from '../../src/racing/DigitalThrottle.js';
import {advanceDigitalBrake} from '../../src/racing/DigitalBrake.js';

test('pedal calibration covers saved original cars and explicit drivetrain fixtures without mutating cars',()=>{
 assert.deepEqual(CARS,['RTG-001','CT-86','BUSE-019','PZ-24']);
 for(const name of CARS){
  const v=loadPedalVehicle(name);assert.ok(v.config.tireByWheel.fl.compound.surfaceGrip);
  assert.ok(v.config.powertrainTuning.gearRatios.length>1);
 }
 for(const drivetrain of ['fwd','rwd','awd'])assert.equal(loadPedalVehicle(CARS[0],drivetrain).config.powertrainTuning.drivetrain,drivetrain);
 assert.equal(loadPedalVehicle(CARS[0]).tuning.drivetrain,'awd');
 assert.equal(QUARTER_MILE_M,402.336);
});

test('calibration materials use every production surface with real wet/snow/loose state',()=>{
 for(const s of RACE_SURFACES){const m=pedalMaterial(s.id);assert.equal(m.baseSurfaceId,s.id);assert.equal(m.trackStateConditionApplied,true);assert.ok(m.surfaceGripScale>0);}
 assert.equal(pedalMaterial('snow').snowDepthMm,25.4);
 assert.ok(pedalMaterial('wet-asphalt').standingWaterDepthMm>0);
 assert.ok(pedalMaterial('gravel').looseMarbles>pedalMaterial('asphalt').looseMarbles);
 assert.throws(()=>pedalMaterial('invented'));
});

test('candidate calibration path matches production editor pedal wiring exactly',()=>{
 const vehicle=loadPedalVehicle(CARS[0]);
 for(const kind of ['straight','braking']){
  const options={vehicle,kind,surface:'gravel',maxSeconds:1};
  const a=runPedalCase(options);
  const b=runPedalCase({...options,throttleFn:(...a)=>advanceDigitalThrottle(...a),brakeFn:(...a)=>advanceDigitalBrake(...a)});
  assert.deepEqual(a,b);
 }
});

test('bounded test input history and disabled telemetry preserve physics exactly',()=>{
 const vehicle=loadPedalVehicle(CARS[0]);
 const options={vehicle,surface:'gravel',kind:'slalom',maxSeconds:2};
 const bounded=runPedalCase(options);
 const retained=runPedalCase({...options,vehicle:{...vehicle,config:{...vehicle.config,inputTimelineLimit:0,telemetryRetention:'transient'}}});
 assert.deepEqual(bounded,retained);
});


test('calibration gestures select the requested production throttle mode across repeated holds',()=>{
 for(const hz of [30,60,120])for(const style of ['traction','aggressive']){
  let gesture={},pedal={};const dt=1/hz;
  for(let step=0;step<hz*5;step++){
   const demand=step%(hz*.5)<hz*.4;
   gesture=pedalGesture(gesture,{demand,style,dt});
   pedal=advanceDigitalThrottle(pedal,{mode:'on',raw:gesture.raw,dt});
   if(!gesture.raw)assert.equal(pedal.output,0);
   if(style==='traction')assert.equal(pedal.aggressiveHold,false);
   else if(gesture.age>.15&&gesture.raw)assert.equal(pedal.aggressiveHold,true);
  }
 }
});

test('both gesture styles match production wiring on a slalom',()=>{
 const vehicle=loadPedalVehicle('BUSE-019');
 for(const throttleStyle of ['traction','aggressive'])for(const aids of [false,true]){
  const options={vehicle,kind:'slalom',surface:'gravel',maxSeconds:2,throttleStyle,aids};
  assert.deepEqual(runPedalCase(options),runPedalCase({...options,throttleFn:(...a)=>advanceDigitalThrottle(...a),brakeFn:(...a)=>advanceDigitalBrake(...a)}));
 }
});
