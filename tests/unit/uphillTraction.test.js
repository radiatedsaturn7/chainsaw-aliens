import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
const ids=['fl','fr','rl','rr'];
function stalledAutomatic({gear=5,omega=0,autoShift=true}={}) {
 const editor=new RaceEditor({}),tuning=editor.getRaceCarTuning(editor.selectedCar,{transmissionType:'automatic'}),model=new PowertrainModel();
 let state={gear,targetGear:gear,engineRpm:4500},result;
 for(let i=0;i<1080;i++){
  result=model.stepAuthoritativeWheelTorques({tuning,config:{...tuning,maxRpm:tuning.revLimitRpm,wheelRadiusM:.33},previous:state,
   controls:{requestedGear:state.gear,throttle:1,assists:{autoShift,tractionControlEnabled:false}},
   kinematicsByWheel:Object.fromEntries(ids.map(id=>[id,{wheelAngularVelocityRadps:omega,longitudinalVelocityMps:0,slipRatio:omega?2:0}])),
   capacityByWheel:Object.fromEntries(ids.map(id=>[id,4000])),driveShareByWheel:Object.fromEntries(ids.map(id=>[id,.25])),
   state:{groundSpeedMps:0,bodyLongitudinalSpeedMps:0},dt:1/360});state=result.state;
 }
 return result;
}
test('automatic returns to first when stopped even while converter holds high engine RPM',()=>{
 for(const gear of [3,5]){
  const result=stalledAutomatic({gear});assert.equal(result.state.gear,1,`stuck in ${result.state.gear} at ${result.state.engineRpm} RPM`);
  assert.ok(result.telemetry.combustionTorqueNm>0);assert.ok(Object.values(result.wheelDriveTorqueNm).every(t=>t>0));
 }
});
test('manual gear selection is preserved and rapidly spinning wheels cannot force an overrev downshift',()=>{
 assert.equal(stalledAutomatic({gear:5,autoShift:false}).state.gear,5);
 assert.ok(stalledAutomatic({gear:3,omega:180}).state.gear>=3);
});

import {getWheelSlipPresentation} from '../../src/racing/simulation/WheelSlipPresentation.js';
import {createVehicleRenderStateFromRunner} from '../../src/racing/simulation/VehicleRenderState.js';
function tractionState({omega=0,speed=0,contact=true}={}){
 return {engineRpm:4725,yawRad:0,position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:speed},wheelAngularVelocityRadps:Object.fromEntries(ids.map(id=>[id,omega])),
  contactPatches:Object.fromEntries(ids.map(id=>[id,{normalLoadN:contact?3500:0,validTreadContact:contact,wheelAngularVelocityRadps:omega,longitudinalVelocityMps:speed,lateralVelocityMps:0,effectiveRollingRadiusM:.33,surfaceNormalWorld:{x:0,y:1,z:0},contactPointWorld:{x:0,y:0,z:0}}]))};
}
test('stationary wheelspin has physical tire feedback, but converter revving and airborne spin do not',()=>{
 const still=getWheelSlipPresentation(tractionState());assert.equal(still.audibleSlip,0);assert.equal(still.wheelSpinByWheel.fl,0);
 for(const omega of [35,-35]){
  const spin=getWheelSlipPresentation(tractionState({omega}));assert.ok(spin.audibleSlip>.9);assert.ok(spin.slipSpeedMps>10);assert.ok(spin.wheelSpinByWheel.fl>1);
 }
 assert.equal(getWheelSlipPresentation(tractionState({omega:35,contact:false})).audibleSlip,0);
 const rolling=getWheelSlipPresentation(tractionState({omega:10/.33,speed:10}));assert.equal(rolling.audibleSlip,0);
});
test('stationary wheelspin reaches tire audio and smoke emission without using engine revs',()=>{
 const calls=[];const editor=new RaceEditor({audio:{setTireScreech:(...args)=>calls.push(args)}});
 editor.playtestSession={speedMps:0,tireFxParticles:[],elapsedMs:0};
 editor.getRaceWheelFxEmissionPosition=()=>({x:0,z:0,elevation:0});
 editor.getRaceTireFxVisualMaterialAtWorldPoint=()=>({materialId:'asphalt',surfaceId:'asphalt',region:'road'});
 const spin=getWheelSlipPresentation(tractionState({omega:35}));
 editor.updateRaceTireAudio({slip:spin.audibleSlip,slipSpeedMps:spin.slipSpeedMps,speedMps:0});assert.equal(calls.at(-1)[0],true);
 for(let i=0;i<120;i++)editor.emitRaceTireFxParticles(1/60,{...spin,speedMps:0});
 assert.ok(editor.playtestSession.tireFxParticles.some(p=>p.slotId==='skidSmoke'));
 editor.updateRaceTireAudio({slip:0,speedMps:0});assert.equal(calls.at(-1)[0],false);
});
test('wheel artwork follows physical spin at zero vehicle travel',()=>{
 const editor=new RaceEditor({});
 const session={distance:0,vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:Math.PI}}}};
 assert.equal(editor.getRaceTireTextureScroll(editor.selectedCar,'fl',session),.5);
 session.vehicleRenderState.wheelPoses.fl.spinAngleRad=Math.PI*1.5;
 assert.equal(editor.getRaceTireTextureScroll(editor.selectedCar,'fl',session),.75);
});

test('stationary tire effects match the surface and require loaded slipping wheels',()=>{
 for(const [surface,slot] of [['asphalt','skidSmoke'],['dirt','dirtDust'],['gravel','gravelDust'],['snow','snowDust']]){
  for(const [omega,contact,expected] of [[35,true,true],[0,true,false],[35,false,false]]){
   const editor=new RaceEditor({});
   editor.playtestSession={speedMps:0,tireFxParticles:[],elapsedMs:0};
   editor.getRaceWheelFxEmissionPosition=()=>({x:0,z:0,elevation:0});
   editor.getRaceTireFxVisualMaterialAtWorldPoint=()=>({materialId:surface,surfaceId:surface,region:'road'});
   const feedback=getWheelSlipPresentation(tractionState({omega,contact}));
   for(let i=0;i<120;i++)editor.emitRaceTireFxParticles(1/60,{...feedback,speedMps:0});
   const particles=editor.playtestSession.tireFxParticles;
   assert.equal(particles.length>0,expected,`${surface}: omega=${omega}, contact=${contact}`);
   assert.ok(particles.every(p=>p.slotId===slot),`${surface} must emit ${slot}`);
  }
 }
});

import {createVehicleRenderSnapshotBuffer,writeVehicleRenderSnapshot,readVehicleRenderSnapshot,interpolateVehicleRenderSnapshots} from '../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js';
test('worker snapshot keeps physical tire slip, including loaded tire radius, through interpolation',()=>{
 for(const [omega,speed] of [[35,0],[-35,0],[10/.29,10]]){
  const state=tractionState({omega,speed});
  for(const wheel of Object.values(state.contactPatches))wheel.effectiveRollingRadiusM=.29;
  const runner={state,config:{wheelRadiusM:.337},renderWheelSpinAngles:{fl:1,fr:1,rl:1,rr:1},simulationTimeSeconds:1,stepIndex:120};
  const original=createVehicleRenderStateFromRunner(runner),buffer=createVehicleRenderSnapshotBuffer();
  writeVehicleRenderSnapshot(buffer,original);const decoded=readVehicleRenderSnapshot(buffer);
  const interpolated=interpolateVehicleRenderSnapshots({...decoded,simulationTimeSeconds:.98},decoded,.99);
  const expected=getWheelSlipPresentation(state,.337),actual=getWheelSlipPresentation(interpolated,.337);
  assert.ok(Math.abs(expected.audibleSlip-actual.audibleSlip)<1e-5);
  assert.ok(Math.abs(expected.slipSpeedMps-actual.slipSpeedMps)<1e-5);
 }
});

import {readFileSync} from 'node:fs';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const savedCar=JSON.parse(readFileSync(new URL('../fixtures/uphill-wrx2-tuning.json',import.meta.url),'utf8')).car;
function runHill({autoShift=true,slope=.15,grip=1,gear=5,clutch=0,brake=0,tractionControlEnabled=true}={}){
 const editor=new RaceEditor({}),car=editor.normalizeLoadedCarDocument(savedCar);
 const tuning=editor.getRaceCarTuning(car,{transmissionType:'automatic'}),config=createVehicleDynamicsConfigFromTuning(tuning),n=1/Math.hypot(1,slope);
 const normal={x:0,y:n,z:-slope*n},material=grip<.5?'gravel':'asphalt';
 const runner=new VehicleDynamicsRunner({config:{...config,telemetryRetention:'none'},
  initialState:{heightM:config.cgHeightM,pitchRad:-Math.atan(slope),gear,engineRpm:4500,powertrainState:{gear,targetGear:gear,engineRpm:4500}},
  inputTimeline:[{timeSeconds:0,input:{throttle:1,clutch,brake,requestedGear:gear,assists:{autoShift,tractionControlEnabled}}}],
  environmentProvider:({state})=>({
   surfaceHeightByWheel:Object.fromEntries(ids.map(id=>[id,slope*(state.position.z+(id[0]==='f'?config.frontAxleDistanceFromCgM:-config.rearAxleDistanceFromCgM))])),
   surfaceNormalByWheel:Object.fromEntries(ids.map(id=>[id,normal])),
   sampleTerrainAtWorldPoint:p=>({heightM:slope*p.z,normal,friction:grip}),
   materialByWheel:Object.fromEntries(ids.map(id=>[id,{baseSurfaceId:material,surfaceId:material,grip}]))
  })});
 let maxSlip=0,maxSlipSpeed=0,maxFeedback=0,physicalSpin=0;
 for(let i=0;i<360;i++){
  runner.advance(1/120);
  const feedback=getWheelSlipPresentation(runner.state,config.wheelRadiusM);
  maxFeedback=Math.max(maxFeedback,feedback.audibleSlip);maxSlipSpeed=Math.max(maxSlipSpeed,feedback.slipSpeedMps);
  for(const id of ids){maxSlip=Math.max(maxSlip,Math.abs(runner.state.contactPatches[id]?.rawSlipRatio||0));physicalSpin=Math.max(physicalSpin,Math.abs(runner.renderWheelSpinAngles[id]));}
 }
 return {runner,maxSlip,maxSlipSpeed,maxFeedback,physicalSpin};
}
test('saved WRX2 automatic downshifts and climbs a 15 percent grade through the full tire/chassis solver',()=>{
 const automatic=runHill(),heldFifth=runHill({autoShift:false});
 assert.ok(automatic.runner.state.position.z>8,`uphill travel ${automatic.runner.state.position.z}`);
 assert.ok(automatic.runner.state.speedMps>5,`uphill speed ${automatic.runner.state.speedMps}`);
 assert.ok(automatic.runner.state.position.z>heldFifth.runner.state.position.z*2);
 assert.ok(automatic.runner.state.gear<5);
 assert.ok(Object.values(automatic.runner.state.wheelLoadsN).every(load=>load>100));
 assert.ok(automatic.physicalSpin>1);
});
test('saved WRX2 low-grip uphill wheelspin produces feedback while a braked disengaged clutch does not',()=>{
 const loose=runHill({gear:1,slope:.25,grip:.25,tractionControlEnabled:false});
 assert.ok(loose.maxSlip>.5);assert.ok(loose.maxSlipSpeed>1);assert.ok(loose.maxFeedback>.5);
 const disengaged=runHill({gear:1,slope:0,clutch:1,brake:1});
 assert.ok(disengaged.runner.state.engineRpm>4000);
 assert.ok(Math.abs(disengaged.runner.state.position.z)<.05);
 assert.ok(disengaged.maxFeedback<.02,`false tire noise ${disengaged.maxFeedback}`);
});
