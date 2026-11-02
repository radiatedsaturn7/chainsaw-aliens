import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {RACE_TIRE_COMPOUNDS} from '../../src/racing/raceData.js';
import {createTireDefinition} from '../../src/racing/raceTires.js';
import {calculateAquaplaningState} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {VehicleDynamicsWorkerAuthority} from '../../src/racing/simulation/VehicleDynamicsWorkerAuthority.js';
const ids=['fl','fr','rl','rr'];
const each=value=>Object.fromEntries(ids.map(id=>[id,structuredClone(value)]));
for(const compound of RACE_TIRE_COMPOUNDS){
 test(`${compound.label}: wheelspin at walking pace cannot cause aquaplaning`,()=>{
  for(const speed of [0,1.34]){
   const result=calculateAquaplaningState({normalLoadN:3500,tire:{compound,pressurePsi:32},material:{standingWaterDepthMm:12},kinematics:{longitudinalVelocityMps:speed,wheelAngularVelocityRadps:250,effectiveRollingRadiusM:.33,slipRatio:2}});
   assert.ok(result.liftFraction<.005);assert.ok(result.supportedNormalLoadN>3480);
  }
 });
 for(const weather of ['rain','storm','snow'])for(const tc of (compound.id==='tarmac'?[true,false]:[true]))test(`${compound.label}: full solver launches in ${weather}, TC ${tc}`,()=>{
  const editor=new RaceEditor({});
  const tuning=editor.getRaceCarTuning(editor.selectedCar,{transmissionType:'automatic'});
  const config={...createVehicleDynamicsConfigFromTuning(tuning)};
  config.tireByWheel=each({compound,pressurePsi:32,coldPressurePsi:32,targetPressurePsi:32,widthMm:245});
  const material={baseSurfaceId:'asphalt',surfaceId:weather==='snow'?'snow':'wet-asphalt',trackStateConditionApplied:true,grip:weather==='snow'?.58:.82,moistureDepthMm:weather==='snow'?0:1,standingWaterDepthMm:weather==='storm'?8:weather==='rain'?2:0,snowDepthMm:weather==='snow'?35:0};
  const runner=new VehicleDynamicsRunner({config:{...config,telemetryRetention:'none'},initialState:{heightM:config.cgHeightM,gear:1},inputTimeline:[{timeSeconds:0,input:{throttle:1,requestedGear:1,assists:{autoShift:true,tractionControlEnabled:tc}}}],environmentProvider:()=>({surfaceHeightByWheel:each(0),surfaceNormalByWheel:each({x:0,y:1,z:0}),sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0},friction:material.grip}),materialByWheel:each(material)})});
  for(let i=0;i<480;i++)runner.advance(1/120);
  const speed=runner.state.speedMps;
  console.log(`${compound.id} ${weather}: ${(speed*2.237).toFixed(1)} MPH, gear ${runner.state.gear}`);
  assert.ok(speed>1.8,`stuck at ${speed} m/s in gear ${runner.state.gear}`);
  assert.ok(speed>5||runner.state.gear<=2,'wheelspin must not climb through gears at walking pace');
 });
}
test('debug tire change updates live physics and worker without modifying authored car or repairing damage',async()=>{
 const editor=new RaceEditor({});const original=structuredClone(editor.selectedCar);
 const runner={config:Object.freeze({}),state:{speedMps:12,gear:3,tireState:{fl:{wear:.4,treadTemperatureC:90}}}};
 const sent=[];editor.playtestSession={runtimeCar:editor.selectedCar,vehicleDynamicsRunner:runner};
 editor.vehicleDynamicsAuthority={runner,workerBridge:{client:{submitDebugTireSwap:update=>sent.push(update)}}};
 await editor.selectRaceDebugTires(async()=>({tire:createTireDefinition('snow'),ref:'Snow'}));
 assert.deepEqual(editor.selectedCar,original);assert.equal(runner.config.tireByWheel.fl.compound.id,'snow');
 assert.equal(runner.state.speedMps,12);assert.equal(runner.state.gear,3);assert.equal(runner.state.tireState.fl.wear,.4);assert.equal(runner.state.tireState.fl.treadTemperatureC,90);
 const updates=[];const workerRunner={config:{},state:{},advance(){}};
 const authority=new VehicleDynamicsWorkerAuthority({runners:[{id:'player',runner:workerRunner,player:true,environmentController:{updateEnvironmentState:value=>updates.push(value)}}]});
 assert.equal(authority.updateTires(sent[0]),true);assert.equal(workerRunner.config.tireByWheel.fl.compound.id,'snow');assert.equal(updates[0].tireByWheel.fl.compound.id,'snow');
 const before=editor.playtestSession.runtimeCar;await editor.selectRaceDebugTires(async()=>null);assert.equal(editor.playtestSession.runtimeCar,before);
});

test('a tire picker opened in an old race cannot change a new race',async()=>{
 const editor=new RaceEditor({});editor.playtestSession={runtimeCar:editor.selectedCar};
 let finish;const pending=editor.selectRaceDebugTires(()=>new Promise(resolve=>{finish=resolve;}));
 const next={runtimeCar:editor.selectedCar};editor.playtestSession=next;
 finish({tire:createTireDefinition('rain'),ref:'Rain'});await pending;
 assert.equal(next.runtimeCar,editor.selectedCar);
});
