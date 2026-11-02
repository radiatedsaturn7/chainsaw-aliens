import test from 'node:test';
import assert from 'node:assert/strict';
import {recordRaceRecoveryPosition,getRaceRecoveryHistoryCandidates} from '../../src/racing/RaceRecoveryHistory.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {quaternionFromEuler} from '../../src/racing/simulation/RigidBodyMath.js';

function roadContacts(state){
 state.orientation=quaternionFromEuler({});
 state.contactPatches=Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{validTreadContact:true,normalLoadN:1000,
   get contactPointWorld(){return {x:state.position.x,y:state.position.y-.55,z:state.position.z};}}]));
}
const roadModel={samplePhysicsGeometry:p=>({valid:true,region:'road',heightM:p.y})};
test('recovery history selects most recent upright road positions, preserves branch/altitude and skips traffic',()=>{
 const session={aiRuntime:[]};
 const editor={getRaceRouteProjectionForWorldPoint:p=>({...p,distance:p.z,yaw:0,lateral:0,edgeId:'upper',heightM:p.y-.55,segment:{roadWidthM:10}})};
 const state={position:{x:0,y:100.55,z:0},grounded:true,supportedWheelCount:4};
 roadContacts(state);editor.getRaceSurfaceModel=()=>roadModel;
 for(let i=0;i<32;i++){state.position.z=i*3;recordRaceRecoveryPosition(editor,session,state,1,.25);}
 const choices=getRaceRecoveryHistoryCandidates(session);
 assert.equal(choices[0].z,93);
 assert.equal(choices[0].edgeId,'upper');assert.equal(choices[0].heightM,100);
 session.lap=2;assert.deepEqual(getRaceRecoveryHistoryCandidates(session),[]);session.lap=1;
 session.aiRuntime=[{worldX:0,worldZ:93}];assert.ok(getRaceRecoveryHistoryCandidates(session)[0].z<=84);
 for(let i=0;i<60;i++)recordRaceRecoveryPosition(editor,session,state,-1,.25);
 assert.ok(getRaceRecoveryHistoryCandidates(session).length>0,'last safe road position survives a long inversion');
 assert.deepEqual(getRaceRecoveryHistoryCandidates({}),[]);
});

test('airborne and off-road poses never become recovery destinations',()=>{
 const session={};const state={position:{x:0,y:1,z:10},grounded:false,supportedWheelCount:0};
 const editor={getRaceRouteProjectionForWorldPoint:p=>({...p,distance:10,yaw:0,lateral:10,edgeId:'road',segment:{roadWidthM:8}})};
 for(let i=0;i<20;i++)recordRaceRecoveryPosition(editor,session,state,1,.25);
 state.grounded=true;state.supportedWheelCount=4;
 for(let i=0;i<20;i++)recordRaceRecoveryPosition(editor,session,state,1,.25);
 assert.deepEqual(getRaceRecoveryHistoryCandidates(session),[]);
});

function fixture(){
 const editor=new RaceEditor({});editor.selectedRace.road.network.nodes[1].z=500;
 editor.selectedRace.road.network.finishNodeId=editor.selectedRace.road.network.nodes[1].id;
 editor.startPlaytest('starter-rwd');editor.updatePlaytestSafely(0);
 const session=editor.playtestSession;session.countdownRemainingMs=0;
 return {editor,session,state:session.vehicleDynamicsRunner.state};
}
test('manual recovery uses safe history without rewinding fuel or mechanical damage',()=>{
 const {editor,session,state}=fixture();
 for(let i=0;i<24;i++){
  const pose=editor.getRaceWorldPoseAtDistance(20+i*2);
  state.position={x:pose.x,y:.55,z:pose.z};state.orientation=quaternionFromEuler({yaw:pose.yaw});
  state.grounded=true;state.supportedWheelCount=4;
  roadContacts(state);
  editor.updateRaceAutomaticVehicleRecovery(.25);
 }
 const candidate=getRaceRecoveryHistoryCandidates(session)[0];assert.ok(candidate);assert.ok(candidate.distance>20);
 const mechanical=structuredClone(state.mechanical);
 session.distance=130;state.orientation=quaternionFromEuler({roll:Math.PI});
 editor.resetRaceCarToRouteCenter({projection:{distance:130},reason:'select-hold-reset'});
 assert.equal(session.pendingEdgeCenterReset.distance,candidate.distance);
 session.edgeResetFadeMs=0;editor.updateRaceEdgeCenterResetFade();
 assert.ok(Math.abs(session.distance-candidate.distance)<.01);
 assert.deepEqual(session.vehicleDynamicsRunner.state.mechanical,mechanical);
 assert.ok(getRaceRecoveryHistoryCandidates(session).length>0,
  'successful reset retains a verified fallback for another tumble');
});
test('small inverted sliding and rocking does not postpone automatic recovery forever',()=>{
 const {editor,session,state}=fixture();
 state.orientation=quaternionFromEuler({roll:Math.PI});state.velocity={x:1.2,y:0,z:0};
 state.angularVelocityWorld={x:0,y:0,z:.8};state.bodyGrounded=true;
 for(let i=0;i<120;i++)editor.updateRaceAutomaticVehicleRecovery(1/60);
 assert.equal(session.pendingEdgeCenterReset?.reason,'automatic-upside-down');
});
test('a permanently rejected placement cannot hold the screen black forever',()=>{
 const {editor,session}=fixture();
 editor.resetRaceCarToRouteCenter({reason:'select-hold-reset'});
 editor.applyRaceCarRouteCenterReset=()=>false;session.edgeResetFadeMs=0;
 for(let i=0;i<8;i++)editor.updateRaceEdgeCenterResetFade();
 assert.equal(session.pendingEdgeCenterReset,null);assert.equal(session.edgeResetFadeMs,0);
 assert.match(editor.status,/Unable to find a safe reset/);
});

test('repeat support rejection tries an older safe position before giving up',()=>{
 const {editor,session}=fixture();
 editor.resetRaceCarToRouteCenter({reason:'select-hold-reset'});
 session.pendingEdgeCenterReset.recoveryCandidates=[{distance:80},{distance:60}];
 const attempted=[];
 editor.applyRaceCarRouteCenterReset=({projection})=>{attempted.push(projection.distance);return attempted.length===3;};
 session.edgeResetFadeMs=0;
 for(let i=0;i<3;i++)editor.updateRaceEdgeCenterResetFade();
 assert.equal(attempted[2],60);
 assert.equal(session.pendingEdgeCenterReset.moved,true);
});

test('a roof stuck without reported support still recovers, but a brief airborne inversion does not',()=>{
 const {editor,session,state}=fixture();
 state.orientation=quaternionFromEuler({roll:Math.PI});state.velocity={x:0,y:0,z:0};
 state.angularVelocityWorld={x:0,y:0,z:0};state.bodyGrounded=false;state.grounded=false;state.supportedWheelCount=0;
 for(let i=0;i<180;i++)editor.updateRaceAutomaticVehicleRecovery(1/60);
 assert.equal(Boolean(session.pendingEdgeCenterReset),false);
 for(let i=0;i<61;i++)editor.updateRaceAutomaticVehicleRecovery(1/60);
 assert.equal(session.pendingEdgeCenterReset?.reason,'automatic-upside-down');
});


test('spinning wheels and chassis rocking cannot postpone an inverted car trapped in place',()=>{
 const {editor,session,state}=fixture();
 state.orientation=quaternionFromEuler({roll:Math.PI});
 state.wheelAngularVelocityRadps={fl:200,fr:200,rl:200,rr:200};
 state.velocity={x:3,y:0,z:0};state.angularVelocityWorld={x:0,y:0,z:4};
 state.bodyGrounded=true;
 for(let i=0;i<241;i++)editor.updateRaceAutomaticVehicleRecovery(1/60);
 assert.equal(session.pendingEdgeCenterReset?.reason,'automatic-upside-down');
});

test('worker reset stays hidden until its generation is acknowledged upright',()=>{
 const {editor,session}=fixture();
 let now=0;editor.getNowMs=()=>now;
 editor.resetRaceCarToRouteCenter({reason:'select-hold-reset'});
 session.pendingEdgeCenterReset.moved=true;session.pendingEdgeCenterReset.attempts=1;
 session.workerRoadReset={generation:10,startedAt:0};
 session.vehicleRenderState={resetGeneration:9,orientation:quaternionFromEuler({roll:Math.PI})};
 session.edgeResetFadeMs=0;editor.updateRaceEdgeCenterResetFade();
 assert.ok(session.edgeResetFadeMs>0);assert.ok(session.pendingEdgeCenterReset);
 session.vehicleRenderState={resetGeneration:10,orientation:quaternionFromEuler({})};
 editor.updateRaceEdgeCenterResetFade();assert.equal(session.workerRoadReset,null);
 session.edgeResetFadeMs=0;editor.updateRaceEdgeCenterResetFade();
 assert.equal(session.pendingEdgeCenterReset,null);
});

test('worker rejection cannot masquerade as a successful upside-down respawn',()=>{
 const {editor,session}=fixture();editor.getNowMs=()=>100;
 editor.resetRaceCarToRouteCenter({reason:'select-hold-reset'});
 session.pendingEdgeCenterReset.moved=true;session.pendingEdgeCenterReset.attempts=1;
 session.workerRoadReset={generation:10,startedAt:0};
 session.vehicleRenderState={resetGeneration:9,orientation:quaternionFromEuler({roll:Math.PI})};
 editor.vehicleDynamicsAuthority.workerBridge={client:{lastError:{requestType:'resetVehicle',vehicleId:'player',message:'No valid support'}}};
 editor.applyRaceCarRouteCenterReset=()=>false;
 session.edgeResetFadeMs=0;editor.updateRaceEdgeCenterResetFade();
 assert.equal(session.pendingEdgeCenterReset.moved,false);
 assert.ok(session.edgeResetFadeMs>0);
});


test('history requires four loaded tire widths on actual road at contact height',()=>{
 for(const failure of ['terrain','shoulder','one-tire-off','tire-edge-off','wrong-deck','unloaded','missing','inverted','nan-up']){
  const session={};const state={position:{x:0,y:1,z:10},grounded:true,supportedWheelCount:4};roadContacts(state);
  let calls=0;
  const editor={getRaceSurfaceModel:()=>({samplePhysicsGeometry:p=>{
    calls++;
    return {valid:true,region:failure==='terrain'?'terrain':failure==='shoulder'?'shoulder':
      (failure==='one-tire-off'&&calls>9)||(failure==='tire-edge-off'&&calls===2)?'terrain':'road',heightM:p.y+(failure==='wrong-deck'?4:0)};
  }}),getRaceRouteProjectionForWorldPoint:p=>({...p,distance:10,yaw:0,lateral:0,edgeId:'road',heightM:.45,roadWidthM:10})};
  if(failure==='unloaded')state.contactPatches.rr.normalLoadN=0;
  if(failure==='missing')delete state.contactPatches.fr;
  recordRaceRecoveryPosition(editor,session,state,failure==='inverted'?-1:failure==='nan-up'?NaN:1,.25);
  assert.deepEqual(getRaceRecoveryHistoryCandidates(session),[],failure);
 }
});

test('worker wheel snapshots qualify only with four explicit loaded road contacts',()=>{
 const session={};const state={position:{x:0,y:1,z:10},grounded:true};roadContacts(state);
 state.wheelPoses=Object.fromEntries(Object.entries(state.contactPatches).map(([id,p])=>[id,{validTreadContact:true,normalLoadN:p.normalLoadN,contactPoint:p.contactPointWorld}]));delete state.contactPatches;
 const editor={getRaceSurfaceModel:()=>roadModel,getRaceRouteProjectionForWorldPoint:p=>({...p,distance:10,yaw:0,lateral:0,edgeId:'road',heightM:.45})};
 recordRaceRecoveryPosition(editor,session,state,1,.25);
 assert.equal(getRaceRecoveryHistoryCandidates(session).length,1);
 state.position.z=20;delete state.wheelPoses.rr;
 recordRaceRecoveryPosition(editor,session,state,1,.25);
 assert.equal(getRaceRecoveryHistoryCandidates(session)[0].z,10);
});

test('history retains exact verified lateral position and orientation instead of projecting to road center',()=>{
 const session={},state={position:{x:2,y:.55,z:40},grounded:true,supportedWheelCount:4,suspensionState:{fl:{compressionM:.04}}};
 roadContacts(state);state.orientation=quaternionFromEuler({yaw:.2,pitch:.05});
 const editor={getRaceSurfaceModel:()=>roadModel,getRaceRouteProjectionForWorldPoint:()=>({x:0,z:40,yaw:0,distance:40,edgeId:'road',heightM:0})};
 recordRaceRecoveryPosition(editor,session,state,1,.25);
 const target=getRaceRecoveryHistoryCandidates(session)[0];
 assert.equal(target.x,2);assert.deepEqual(target.verifiedRoadPose.position,state.position);
 assert.deepEqual(target.verifiedRoadPose.orientation,state.orientation);
 state.position.x=99;state.suspensionState.fl.compressionM=1;
 assert.equal(target.verifiedRoadPose.position.x,2);assert.equal(target.verifiedRoadPose.suspensionState.fl.compressionM,.04);
});

test('exhausted reset attempts do not start another automatic search at the same stuck pose',()=>{
 const {editor,session,state}=fixture();
 state.orientation=quaternionFromEuler({roll:Math.PI});state.velocity={x:0,y:0,z:0};state.bodyGrounded=true;
 editor.resetRaceCarToRouteCenter({reason:'automatic-upside-down'});
 editor.applyRaceCarRouteCenterReset=()=>false;session.edgeResetFadeMs=0;
 for(let i=0;i<8;i++)editor.updateRaceEdgeCenterResetFade();
 for(let i=0;i<600;i++)editor.updateRaceAutomaticVehicleRecovery(1/60);
 assert.equal(session.pendingEdgeCenterReset,null);
 editor.resetRaceCarToRouteCenter({reason:'select-hold-reset'});
 assert.equal(session.pendingEdgeCenterReset.reason,'select-hold-reset','manual recovery still available');
});

test('failed recorded reset advances immediately and clears its error after success', () => {
 const candidates = [30, 20, 10].map(distance => ({distance, verifiedRoadPose: {}}));
 const session = {edgeResetFadeMs: 0, pendingEdgeCenterReset: {
  networkProjection: candidates[0], distance: 30, recoveryCandidates: candidates, moved: false
 }};
 const attempted = [];
 const editor = {playtestSession: session, status: '', applyRaceCarRouteCenterReset({projection}) {
  attempted.push(projection.distance);
  if (attempted.length < 3) { this.status = 'Reset unavailable: support rejected'; return false; }
  return true;
 }};
 for (let i = 0; i < 3; i++) RaceEditor.prototype.updateRaceEdgeCenterResetFade.call(editor);
 assert.deepEqual(attempted, [30, 20, 10]);
 assert.equal(session.pendingEdgeCenterReset.moved, true);
 assert.equal(editor.status, 'Reset to track center');
});

test('staged reset yields after two steps, holds black, and resumes the same job',()=>{
 const {editor,session}=fixture();
 let slices=0,created=0;
 editor.applyRaceCarRouteCenterReset=()=>{created++;return(function*(){for(let i=0;i<7;i++){slices++;yield;}return true;})();};
 editor.resetRaceCarToRouteCenter({reason:'select-hold-reset'});
 session.edgeResetFadeMs=0;
 editor.updateRaceEdgeCenterResetFade();
 assert.ok(slices<=2);assert.ok(session.incrementalRoadReset);assert.ok(session.edgeResetFadeMs>0);
 for(let i=0;i<10&&!session.pendingEdgeCenterReset.moved;i++)editor.updateRaceEdgeCenterResetFade();
 assert.equal(created,1);assert.equal(slices,7);assert.equal(session.incrementalRoadReset,null);
 assert.equal(session.pendingEdgeCenterReset.moved,true);
});

test('incremental reset holds simulation clock and cancels when leaving the race',async()=>{
 const {updateRaceSimulation}=await import('../../src/racing/RaceSimulation.js');
 const {editor,session,state}=fixture();
 if(session.raceIntro)session.raceIntro.active=false;
 const before=structuredClone(state),elapsed=session.elapsedMs;
 let resumed=0,cancelled=0;
 session.incrementalRoadReset=(function*(){try{while(true){resumed++;yield;}}finally{cancelled++;}})();
 session.incrementalRoadReset.next();
 session.pendingEdgeCenterReset={moved:false,distance:0};session.edgeResetFadeMs=0;
 updateRaceSimulation({editor,systems:{},dt:1/60});
 assert.equal(session.elapsedMs,elapsed);assert.deepEqual(session.vehicleDynamicsRunner.state,before);
 assert.ok(resumed>1);editor.endPlaytest();assert.equal(cancelled,1);assert.equal(editor.playtestSession,null);
});
