import test from 'node:test';
import assert from 'node:assert/strict';
import {raceStartingGrid,raceGridDistance,raceGridLateral,raceGridColumns} from '../../src/racing/RaceStartingGrid.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const drivers=difficulty=>Array.from({length:5},(_,i)=>({id:`ai-${i}`,difficulty}));
test('difficulty draws only from the requested tail of the grid',()=>{
 for(const [difficulty,first] of [['easy',3],['medium',4],['hard',5],['expert',5]]){
  const slots=new Set();
  for(let i=0;i<=100;i++){
   const grid=raceStartingGrid(drivers(difficulty),{random:()=>i/100});
   slots.add(grid.indexOf('player'));assert.equal(new Set(grid).size,6);
  }
  assert.deepEqual([...slots],Array.from({length:6-first},(_,i)=>first+i));
 }
 assert.deepEqual(raceStartingGrid([]),['player']);
});
test('explicit classification wins over difficulty and safely filters stale/duplicate IDs',()=>{
 const order=['ai-3','ai-3','missing','ai-4','player','ai-2','ai-1','ai-0'];
 assert.deepEqual(raceStartingGrid(drivers('hard'),{order}),['ai-3','ai-4','player','ai-2','ai-1','ai-0']);
});
test('runtime AI grid leaves exactly the player slot vacant, all before the line',()=>{
 const list=drivers('hard'), grid=raceStartingGrid(list);
 const editor={normalizeRaceAiDriver:d=>d,findRaceProjectCarById:()=>({}),selectedCar:{},
  getRaceCarTuning:()=>({idleRpm:900}),getRaceTransmissionType:()=> 'automatic',
  getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0}),getSelectedRaceRuntimeType:()=> 'circuit',
  getRaceRoadHalfWidthWorld:()=>5,getRaceRightVector:()=>({x:-1,z:0}),materializeRaceRuntimeCar:c=>c};
 const ai=RaceEditor.prototype.createRaceAiRuntime.call(editor,list,{routeLength:1000,startingGrid:grid,gridFrontDistance:9});
 assert.deepEqual(ai.map(c=>c.distance),[-9,-9,-16,-16,-23]);
 assert.equal(raceGridDistance(grid,'player',9),-23);
 assert.ok(ai.every(c=>c.worldZ===c.distance && c.awaitingStartLine && c.lap===1));
});

test('race launch places the player and rivals on their assigned road poses',()=>{
 const e=new RaceEditor({},{mode:'race'});
 e.getRaceRoadHalfWidthWorld=()=>6;
 const list=drivers('hard');
 e.selectedRace.competition={mode:'ai-race',aiDrivers:list.map(d=>({...d,enabled:true,carId:e.selectedCar.id}))};
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false,preparedAiCarIds:list.map(()=>e.selectedCar.id)});
 const s=e.playtestSession;
 assert.equal(s.startingGrid.indexOf('player'),5);
 assert.equal(s.projectedDistance,-s.startBackDistance);
 const pose=e.getRaceWorldPoseAtDistance(s.projectedDistance,{runtimeType:s.routeRuntimeType,allowVisualExtension:true});
 const lateral=raceGridLateral(s.startingGrid,'player',e.getRaceRoadHalfWidthWorld(pose.segment),s.runtimeCarWidthM);
 const right=e.getRaceRightVector(pose.yaw);
 assert.ok(Math.hypot(s.worldX-pose.x-right.x*lateral,s.worldZ-pose.z-right.z*lateral)<1e-8);
 assert.ok(s.aiRuntime.every(ai=>ai.projectedDistance>=s.projectedDistance));
 for(const ai of s.aiRuntime){
  assert.ok(ai.bodyY>ai.heightM,'body CG must be above the road before any countdown update');
  assert.ok(!ai.vehicleDynamicsRunner,'test observes the intro before physics initializes');
  const rendered=e.getRacePlayerRenderPose(ai,ai.runtimeCar);
  assert.ok(rendered.elevation>0);
 }
 assert.equal(new Set([s.projectedDistance,...s.aiRuntime.map(ai=>ai.projectedDistance)]).size,3);
});

test('each paired row has distinct left and right slots, including reversed grids',()=>{
 const grid=['a','player','b','c'];
 assert.equal(raceGridDistance(grid,'a'),raceGridDistance(grid,'player'));
 assert.equal(raceGridDistance(grid,'b'),raceGridDistance(grid,'c'));
 assert.equal(raceGridLateral(grid,'a',5),-raceGridLateral(grid,'player',5));
 assert.ok(Math.abs(raceGridLateral(grid,'a',5))*2>1.8);
});

test('a road too narrow for two bodies falls back to a nonoverlapping single file',()=>{
 const grid=['a','b'];
 const columns=raceGridColumns(1.8,1.8);
 assert.equal(columns,1);
 assert.notEqual(raceGridDistance(grid,'a',7.5,7,columns),raceGridDistance(grid,'b',7.5,7,columns));
 assert.equal(raceGridLateral(grid,'a',1.8,1.8,columns),0);
});

test('AI presentation fills fractional 60 Hz frames without changing physical position',()=>{
 const e=new RaceEditor({},{mode:'race'}),runner={config:{chassisHz:60},stepIndex:6,observedTimeSeconds:.105,
  state:{velocity:{x:10,y:0,z:20}},pendingCollisionImpulses:[]};
 const ai={physicsBudgetDetail:'full',vehicleDynamicsRunner:runner,bodyY:1,vehicleRenderState:{position:{x:5,y:1,z:10},yawRad:0}};
 const p=e.getRacePlayerRenderPose(ai,e.selectedCar);
 assert.ok(Math.abs(p.x-5.05)<1e-9);assert.ok(Math.abs(p.z-10.1)<1e-9);
 assert.deepEqual(ai.vehicleRenderState.position,{x:5,y:1,z:10});
 runner.pendingCollisionImpulses=[{}];assert.equal(e.getRacePlayerRenderPose(ai,e.selectedCar).x,5);
});
