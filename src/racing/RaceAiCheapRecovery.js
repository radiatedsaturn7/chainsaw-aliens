import {sampleRaceAiWheelContacts} from './RaceAiRoadContacts.js';
import {createRaceAiTrafficProbe} from './RaceAiTrafficBounds.js';
import {quaternionFromEuler} from './simulation/RigidBodyMath.js';
import {syncVehicleDynamicsCompatibilityOutputs} from './simulation/VehicleState.js';
const recoverable=new Set(['unsupported-pose','terrain-step','off-road','traffic-overlap']);

// No iterative support solver: at most three checked road placements, once
// per four simulated seconds, and only one car may try during an AI update.
export function tryRecoverRaceAiCheap(editor,ai,{car,tuning}) {
 const s=editor.playtestSession,r=ai.vehicleDynamicsRunner,state=r?.state;
 if(!state || !recoverable.has(ai.distantPhysicsReason) || (ai.cheapHeldSeconds||0)<4
   || (ai.cheapRecoveryCooldown||0)>0 || s.cheapRecoveryAttempted
   || Math.hypot(ai.worldX-s.worldX,ai.worldZ-s.worldZ)<120)return false;
 s.cheapRecoveryAttempted=true;ai.cheapRecoveryCooldown=4;
 const world=editor.vehicleDynamicsAuthority?.staticColliderWorldCache;
 if(!world || !editor.getRaceWorldPoseAtDistance)return false;
 const distance=Number(ai.projectedDistance??ai.distance);
 if(!Number.isFinite(distance))return false;
 for(const back of [0,6,12]) {
  const d=Math.max(0,distance-back);
  const pose=editor.getRaceWorldPoseAtDistance(d,{runtimeType:s.routeRuntimeType});
  if(![pose?.x,pose?.z,pose?.yaw].every(Number.isFinite))continue;
  const contacts=sampleRaceAiWheelContacts(editor,ai,{car,tuning,session:{worldX:pose.x,worldZ:pose.z,
    carYaw:pose.yaw,speedMps:0,routeRuntimeType:s.routeRuntimeType,trackState:s.trackState}});
  if(!['fl','fr','rl','rr'].every(id=>contacts.contacts?.[id]?.valid===true&&contacts.contacts[id].region==='road')
    || !Number.isFinite(contacts.averageHeightM))continue;
  const pitch=-Number(contacts.terrainPitchRad||0),roll=Number(contacts.terrainRollRad||0);
  if(!Number.isFinite(pitch)||!Number.isFinite(roll)||Math.abs(pitch)>.65||Math.abs(roll)>.4)continue;
  const y=contacts.averageHeightM+r.config.cgHeightM;
  const reach=Math.hypot(r.config.bodyWidthM||1.8,r.config.bodyLengthM||4.5)/2+.3;
  if(world.world?.querySweptAabb({minX:pose.x-reach,maxX:pose.x+reach,minZ:pose.z-reach,maxZ:pose.z+reach,minY:y-1,maxY:y+2}).length)continue;
  const candidate={...ai,worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw};
  const probe=createRaceAiTrafficProbe(candidate,pose.x,pose.z,pose.yaw,0);
  if(probe(s)||(s.aiRuntime||[]).some(other=>other!==ai&&probe(other)))continue;
  state.position={x:pose.x,y,z:pose.z};state.orientation=quaternionFromEuler({yaw:pose.yaw,pitch,roll});
  state.yawRad=pose.yaw;state.pitchRad=pitch;state.rollRad=roll;state.grounded=true;state.airborne=false;
  // holdRaceAiCheapPhysics already stopped motion. Keep fuel, damage, clocks
  // and lap unchanged; old-location collision impulses no longer apply.
  r.pendingCollisionImpulses=[];
  ai.distance=d;ai.projectedDistance=d;ai.lineOffset=0;ai.trackStatePreviousWheelPositions=null;
  ai.distantContactState=contacts;ai.terrainQueryFrameCache=null;
  ai.cheapPhysicsHeld=false;ai.cheapHeldSeconds=0;ai.cheapHoldRetrySeconds=0;
  ai.cheapRecoveryCount=(ai.cheapRecoveryCount||0)+1;ai.distantPhysicsReason='recovered-road';
  syncVehicleDynamicsCompatibilityOutputs(r,ai);ai.heightM=contacts.averageHeightM;
  return true;
 }
 return false;
}

export function shouldRetryRaceAiCheap(ai,seconds) {
 ai.cheapRecoveryCooldown=Math.max(0,(ai.cheapRecoveryCooldown||0)-seconds);
 if(ai.physicsBudgetDetail!=='cheap'||!ai.cheapPhysicsHeld)return true;
 ai.cheapHoldRetrySeconds=(ai.cheapHoldRetrySeconds||0)+seconds;
 const interval=recoverable.has(ai.distantPhysicsReason)?1:.25;
 if(ai.cheapHoldRetrySeconds+1e-9<interval)return false;
 ai.cheapHoldRetrySeconds=0;return true;
}
