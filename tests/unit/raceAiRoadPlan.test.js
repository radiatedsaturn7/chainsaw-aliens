import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRaceAiRoadPlan,getRaceAiPlannedSpeed,getRaceAiSpeedEnvelope} from '../../src/racing/RaceAiRoadPlan.js';
import {prepareRaceAiRoadPlan,getRaceAiDirector} from '../../src/racing/RaceAiDirector.js';
import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';
function fixture(type='destination') {
 let queries=0;
 const editor={selectedRace:{},playtestSession:{routeLength:1600,routeRuntimeType:type,aiRuntime:[]},
  getRaceWorldPoseAtDistance(d){queries++;return {x:0,z:d,yaw:d<400?0:Math.min(Math.PI,(d-400)/25),elevation:d*.005,segment:{}};},
  getRaceRoadHalfWidthWorld:()=>4,getRaceRightVector:y=>({x:-Math.cos(y),z:Math.sin(y)})};
 return {editor,queries:()=>queries};
}
test('one load-time road plan serves different cars and live tires without road resampling',()=>{
 const {editor,queries}=fixture();const plan=prepareRaceAiRoadPlan(editor),n=queries();
 const ai={worldX:0,worldZ:340,projectedDistance:340,carYaw:0,speedMps:25};
 const fast={widthM:1.8,wheelbaseM:2.6,tireGrip:1.2,weightKg:1300,brakeForceN:15000};
 const dry=planRaceAiDriving(editor,ai,fast,{topSpeedMps:60,grip:1});
 const wet=planRaceAiDriving(editor,ai,fast,{topSpeedMps:60,grip:.35});
 const stock=planRaceAiDriving(editor,ai,{...fast,tireGrip:.5},{topSpeedMps:60,grip:1});
 const slow=planRaceAiDriving(editor,ai,fast,{topSpeedMps:5,grip:1});
 assert.ok(wet.targetSpeedMps<dry.targetSpeedMps);assert.ok(stock.targetSpeedMps<dry.targetSpeedMps);
 assert.ok(slow.targetSpeedMps<=5);assert.equal(queries()-n,4,'only exact steering target is sampled');
 assert.equal(prepareRaceAiRoadPlan(editor),plan);
 fast.brakeForceN=1000;
 assert.ok(planRaceAiDriving(editor,ai,fast).targetSpeedMps<dry.targetSpeedMps,'changed tuning is applied immediately');
 ai.vehicleDynamicsRunner={state:{mechanical:{effects:{brakes:{fl:0,fr:0,rl:0,rr:0}}}}};
 assert.equal(planRaceAiDriving(editor,ai,fast).targetSpeedMps,0,'brake failure cannot reuse a healthy hint');
});
test('normalized envelopes scale for changing grip without rebuilding and anticipate distant corners',()=>{
 const {editor}=fixture();const p=prepareRaceAiRoadPlan(editor);
 const dry=getRaceAiPlannedSpeed(p,300,30,8,5),builds=p.profileBuilds;
 const wet=getRaceAiPlannedSpeed(p,300,30,4,2.5);
 assert.ok(Math.abs(wet/dry-Math.sqrt(.5))<1e-9);
 assert.equal(p.profileBuilds,builds);
 assert.ok(getRaceAiPlannedSpeed(p,380,30,8,5)<dry);
 assert.ok(getRaceAiPlannedSpeed(p,300,30,8,2)<dry);
 for(let ratio=.1;ratio<5;ratio+=.04)getRaceAiSpeedEnvelope(p,ratio);
 assert.ok(p.profiles.size<=16);
});
test('circuit profiles propagate braking through the start seam',()=>{
 const {editor}=fixture('circuit');
 editor.getRaceWorldPoseAtDistance=d=>({x:0,z:d,yaw:d<64?d*.02:0,elevation:0,segment:{}});
 const p=prepareRaceAiRoadPlan(editor);
 assert.equal(getRaceAiPlannedSpeed(p,-16,20,7,5),getRaceAiPlannedSpeed(p,1584,20,7,5));
 assert.ok(getRaceAiPlannedSpeed(p,1584,20,7,5)<getRaceAiPlannedSpeed(p,800,20,7,5));
});
test('new race sessions rebuild geometry even when the edited race object and length are unchanged',()=>{
 const {editor}=fixture();const a=prepareRaceAiRoadPlan(editor);
 editor.playtestSession={...editor.playtestSession};
 const b=prepareRaceAiRoadPlan(editor);assert.notEqual(a,b);
 editor.selectedRace={};assert.notEqual(prepareRaceAiRoadPlan(editor),b);
});
test('huge routes and explicit diagnostic opt-out retain bounded online planning',()=>{
 const {editor}=fixture();
 assert.equal(buildRaceAiRoadPlan(editor,{routeLength:2e6,runtimeType:'destination'}),null);
 editor.playtestSession.debugAiNoRoadPlan=true;
 const ai={worldX:0,worldZ:340,projectedDistance:340,carYaw:0,speedMps:25};
 assert.ok(Number.isFinite(planRaceAiDriving(editor,ai,{widthM:1.8}).targetSpeedMps));
 assert.equal(getRaceAiDirector(editor).plan,undefined);
});
