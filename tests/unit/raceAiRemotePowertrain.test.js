import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {stepRaceAiRemotePowertrain,useRaceAiRemotePowertrain} from '../../src/racing/RaceAiRemotePowertrain.js';

function fixture(){
 const editor=new RaceEditor({});
 editor.selectedRace.road.network=null;editor.selectedRace.road.nodes=[];
 editor.selectedRace.road.segments=[{length:500,curve:0,elevation:0,surface:'asphalt',roadWidthM:12,hazardIds:[]}];
 editor.selectedRace.hazards=[];editor.selectedRace.scenery=[];
 const car=editor.selectedCar,tuning=editor.getRaceCarTuning(car);
 editor.playtestSession={worldX:0,worldZ:0,routeRuntimeType:'destination',trackState:null};
 const ai={worldX:0,worldZ:200,distance:200,speedMps:15,gear:2,rpm:3000,
  drivingPlan:{steeringAngleRad:0},difficulty:'hard'};
 const contactState=editor.getRaceAiContactState(ai,car,tuning);
 return {editor,ai,options:{car,tuning,contactState,targetMps:35,profile:{pace:.9,brake:.8,shift:.8},seconds:1/20}};
}
test('remote aggregate requires distance and can be disabled for comparison',()=>{
 const ai={worldX:200,worldZ:0},s={worldX:0,worldZ:0};
 assert.equal(useRaceAiRemotePowertrain(ai,s),true);
 assert.equal(useRaceAiRemotePowertrain(ai,{...s,worldX:100}),false);
 assert.equal(useRaceAiRemotePowertrain(ai,{...s,debugAiDetailedLongitudinal:true}),false);
 assert.equal(useRaceAiRemotePowertrain(ai,{}),false);
});
test('remote forces accelerate, brake to a stop, and retain per-wheel surface event data',()=>{
 const {editor,ai,options}=fixture();
 const accelerate=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(accelerate.speedMps>15);assert.ok(Number.isFinite(accelerate.acceleration));
 assert.equal(ai.engineDrive.approximation,'remote-aggregate');
 for(const id of ['fl','fr','rl','rr']){
  assert.ok(ai.engineDrive.dynamicNormalLoads[id]>0);
  assert.equal(ai.engineDrive.wheelContactScaleByWheel[id],1);
  assert.ok(Number.isFinite(ai.tireTemperature[id]));
 }
 options.targetMps=0;
 for(let i=0;i<200;i++)ai.speedMps=stepRaceAiRemotePowertrain(editor,ai,options).speedMps;
 assert.equal(ai.speedMps,0);
});
test('road grade, tire grip and corner demand constrain aggregate force',()=>{
 const {editor,ai,options}=fixture();
 const baseline=stepRaceAiRemotePowertrain(editor,ai,options);
 const grade=editor.getRaceRoadSurfaceProfileAtDistance;
 editor.getRaceRoadSurfaceProfileAtDistance=()=>({grade:.15});
 const uphill=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(uphill.acceleration<baseline.acceleration-1);
 editor.getRaceRoadSurfaceProfileAtDistance=grade;
 options.contactState.averageSurfaceGrip=.25;
 for(const contact of Object.values(options.contactState.contacts.contacts))contact.friction=.25;
 const lowGrip=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(lowGrip.acceleration<baseline.acceleration);
 ai.drivingPlan.steeringAngleRad=.5;
 const turning=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(turning.acceleration<lowGrip.acceleration);
 assert.ok(turning.speedMps>=0);
});
test('remote powertrain uses authored torque and power rather than a fixed acceleration',()=>{
 const {editor,ai,options}=fixture();
 const baseline=stepRaceAiRemotePowertrain(editor,ai,options);
 options.tuning.engineCurve={torquePoints:[{rpm:500,torqueLbFt:1},{rpm:10000,torqueLbFt:1}]};
 options.tuning.peakTorqueNm=1;
 const weak=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(weak.acceleration<baseline.acceleration);
});

test('slow uphill traffic can restart without dropping the stop-hold brake behavior',()=>{
 const {editor,ai,options}=fixture();ai.speedMps=0;ai.gear=1;options.targetMps=.5;
 editor.getRaceRoadSurfaceProfileAtDistance=()=>({grade:.15});
 const launch=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(launch.acceleration>0,`hill launch acceleration ${launch.acceleration}`);
 assert.ok(ai.engineDrive.throttle>.1);
 options.targetMps=0;
 const held=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.equal(held.speedMps,0);assert.equal(ai.engineDrive.throttle,0);assert.equal(ai.engineDrive.brake,1);
});

test('budgeted cheap powertrain respects engine shutdown and failed brakes',()=>{
 const {editor,ai,options}=fixture();ai.physicsBudgetDetail='cheap';
 ai.worldZ=10;assert.equal(useRaceAiRemotePowertrain(ai,editor.playtestSession),true);
 ai.vehicleDynamicsRunner={state:{mechanical:{config:{enabled:true},engineRunning:false,effects:{drive:0,torque:0}}}};
 const stoppedEngine=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.equal(ai.engineDrive.driveForceN,0);assert.ok(stoppedEngine.speedMps<15);
 options.targetMps=0;
 const working=stepRaceAiRemotePowertrain(editor,ai,options);
 ai.vehicleDynamicsRunner.state.mechanical.effects.brakes={fl:0,fr:0,rl:0,rr:0};
 const failed=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.equal(ai.engineDrive.brakeState.force,0);
 assert.ok(failed.acceleration>working.acceleration);
});

test('road-following AI does not spend straight-road traction on an unapplied steering correction',()=>{
 const {editor,ai,options}=fixture();
 Object.assign(ai,{carYaw:0,physicsBudgetDetail:'cheap',lineOffset:0,speedMps:27,gear:4});
 editor.getRaceWorldPoseAtDistance=d=>({x:0,z:d,yaw:0,segment:{}});
 editor.getRaceRoadHalfWidthWorld=()=>6;
 options.targetMps=47;
 ai.drivingPlan.steeringAngleRad=.12;
 const corrected=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(corrected.acceleration>0,`full throttle on a straight must accelerate: ${corrected.acceleration}`);
 assert.ok(ai.engineDrive.driveForceN>0);
 editor.playtestSession.debugAiBicycleOnly=true;
 const bicycle=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(bicycle.acceleration<corrected.acceleration,'a chassis actually applying that turn must reserve lateral grip');
});

test('AI supplies road-load throttle at cruising speed instead of slowing on an uphill straight',()=>{
 const {editor,ai,options}=fixture();ai.speedMps=12;ai.gear=2;options.targetMps=12;
 editor.getRaceRoadSurfaceProfileAtDistance=()=>({grade:.08});
 // Allow the shared engine RPM/shift state to settle, rather than assuming
 // instantaneous torque on the first frame of an injected moving car.
 for(let i=0;i<200;i++)ai.speedMps=stepRaceAiRemotePowertrain(editor,ai,options).speedMps;
 assert.ok(ai.engineDrive.throttle>0);
 assert.ok(ai.speedMps>11.5,`uphill target hold ${ai.speedMps}`);
});

test('road-following still reserves real corner grip even with zero corrective steering',()=>{
 const {editor,ai,options}=fixture();
 Object.assign(ai,{worldX:200,worldZ:0,carYaw:0,distance:0,physicsBudgetDetail:'cheap',lineOffset:0,speedMps:27,gear:4});
 editor.getRaceWorldPoseAtDistance=d=>({x:200,z:d,yaw:0,segment:{}});
 editor.getRaceRoadHalfWidthWorld=()=>6;options.targetMps=47;
 const straight=stepRaceAiRemotePowertrain(editor,ai,options);
 editor.getRaceWorldPoseAtDistance=d=>({x:200+40*(1-Math.cos(d/40)),z:40*Math.sin(d/40),yaw:d/40,segment:{}});
 const corner=stepRaceAiRemotePowertrain(editor,ai,options);
 assert.ok(corner.acceleration<straight.acceleration);
 assert.equal(ai.engineDrive.driveForceN,0,'a turn beyond available grip has no spare longitudinal capacity');
});

test('remote launch preserves physical clutch and RPM state instead of instantaneous wheel RPM',()=>{
 const {editor,ai,options}=fixture();
 options.tuning.torqueConverterSlip=0;
 ai.speedMps=0;ai.rpm=options.tuning.idleRpm;ai.gear=1;options.targetMps=40;
 const first=stepRaceAiRemotePowertrain(editor,ai,options);
 const state=ai.remotePowertrainState.powertrainState;
 assert.ok(state.clutchCoupling<1);
 assert.ok(state.engineRpm>=options.tuning.idleRpm);
 for(let i=0;i<60;i++)ai.speedMps=stepRaceAiRemotePowertrain(editor,ai,options).speedMps;
 assert.ok(ai.speedMps>first.speedMps);
 assert.ok(ai.remotePowertrainState.powertrainState.clutchCoupling>state.clutchCoupling);
 assert.ok(ai.rpm>options.tuning.idleRpm);
});
