import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { RACE_AI_PHYSICS_HZ } from '../../src/racing/simulation/RaceSimulationConfig.js';

for(const grade of [0,.1]) test(`AI ${RACE_AI_PHYSICS_HZ} Hz physics brakes on a ${grade*100}% storm road without losing support`,()=>{
 const e=new RaceEditor({},{mode:'race'});
 e.selectedRace.road.elevationRange={min:-1,max:20};
 e.selectedRace.road.network.nodes[1].z=1500;
 e.selectedRace.road.network.nodes[1].heightM=1500*grade;
 e.selectedRace.road.network.edges[0].widthM=12;
 e.selectedRace.road.network.finishNodeId='end';
 e.selectedRace.weather='storm';e.selectedRace.weatherIntensity=1;
 e.selectedRace.hazards=[];e.selectedRace.scenery=[];
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car),pose=e.getRaceWorldPoseAtDistance(200);
 const ai={id:'rate-braking',runtimeCar:car,worldX:pose.x,worldZ:pose.z??pose.y,carYaw:pose.yaw,
  speedMps:20,projectedDistance:200,distance:200,rpm:3000,gear:2,engineDrive:{throttle:0,brake:1},
  drivingPlan:{steeringAngleRad:0,targetSpeedMps:0},difficulty:'hard'};
 let worstRoll=0,unsupported=0;
 for(let i=0;i<480;i++){
  e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
  worstRoll=Math.max(worstRoll,Math.abs(ai.rollRad));
  if(ai.grounded===false)unsupported++;
  assert.ok([ai.worldX,ai.worldZ,ai.speedMps,ai.bodyY].every(Number.isFinite));
 }
 assert.equal(ai.vehicleDynamicsRunner.config.chassisHz,RACE_AI_PHYSICS_HZ);
 assert.equal(ai.vehicleDynamicsRunner.config.tireHz,RACE_AI_PHYSICS_HZ);
 assert.equal(ai.vehicleDynamicsRunner.stepIndex,480*RACE_AI_PHYSICS_HZ/60);
 assert.ok(Math.abs(ai.speedMps)<1,`stopping speed ${ai.speedMps}`);
 assert.ok(worstRoll<.3,`roll ${worstRoll}`);
 assert.ok(unsupported<10,`unsupported frames ${unsupported}`);
});

test('AI wheel queries retain altitude on elevated network roads',()=>{
 const e=new RaceEditor({});
 e.selectedRace.road.elevationRange={min:-1,max:100};
 e.selectedRace.road.network.nodes[0].heightM=500;
 e.selectedRace.road.network.nodes[1].heightM=510;
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car);
 const pose=e.getRaceWorldPoseAtDistance(50);
 const ai={runtimeCar:car,distance:50,projectedDistance:50,worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,speedMps:0};
 const contact=e.getRaceAiContactState(ai,car,tuning);
 for(const point of Object.values(contact.contacts.positions))assert.ok(point.supportHeightM>500,'never project elevated AI from sea level');
 assert.ok(contact.contacts.averageHeightM>500);
 ai.vehicleDynamicsRunner={state:{position:{x:pose.x,y:506,z:pose.z},yawRad:pose.yaw},config:{cgHeightM:.6}};
 const updated=e.getRaceAiContactState(ai,car,tuning);
 assert.equal(updated.session.heightM,505.4);
});

test('AI hitch catch-up is bounded per update without discarding owed simulation time',()=>{
 const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car),pose=e.getRaceWorldPoseAtDistance(60);
 const ai={id:'catch-up',runtimeCar:car,worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,
  distance:60,projectedDistance:60,speedMps:0,gear:1,engineDrive:{throttle:0,brake:1}};
 e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:.5});
 const runner=ai.vehicleDynamicsRunner;
 assert.equal(runner.stepIndex,4);
 assert.equal(runner.diagnostics.backlogSteps,26);
 for(let i=0;i<10;i++){
  const before=runner.stepIndex;
  e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
  assert.ok(runner.stepIndex-before<=4);
 }
 assert.equal(runner.diagnostics.backlogSteps,0);
 assert.equal(runner.stepIndex,40);
 assert.ok(Math.abs(runner.observedTimeSeconds-2/3)<1e-8);
});

test('AI terrain queries keep each wheel sample in its requested buffer',()=>{
 const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const car=e.selectedCar,tuning=e.getRaceCarTuning(car),pose=e.getRaceWorldPoseAtDistance(60);
 const ai={id:'owned-samples',runtimeCar:car,worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,
  distance:60,projectedDistance:60,speedMps:0,gear:1,engineDrive:{throttle:0,brake:1}};
 e.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
 const runner=ai.vehicleDynamicsRunner;
 const env=runner.environmentProvider({state:runner.state,controls:{},timeSeconds:runner.simulationTimeSeconds});
 assert.ok(env.physicsTerrainQueryFrame);
 const point={...runner.state.position};
 const target={normal:{x:0,y:1,z:0}};
 const sample=env.sampleTerrainAtWorldPoint(point,{wheelId:'fl',target});
 assert.equal(sample,target,'provider must honor the tire solver output buffer');
 const before=structuredClone(sample);
 env.sampleTerrainAtWorldPoint({...point,x:point.x+2,z:point.z+4},{wheelId:'rr',target:{normal:{x:0,y:1,z:0}}});
 env.sampleTerrainAtWorldPoint({...point,x:point.x-2});
 assert.deepEqual(sample,before,'later wheel and scalar queries cannot rewrite retained contact data');
});
