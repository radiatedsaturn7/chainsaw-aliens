import {sampleRaceAiWheelContacts} from './RaceAiRoadContacts.js';
import {getRaceAiRouteMotion} from './RaceAiRouteMotion.js';
import { createRaceAiTrafficProbe } from './RaceAiTrafficBounds.js';
import { VehicleDynamicsRunner } from './simulation/VehicleDynamicsRunner.js';
import { syncVehicleDynamicsCompatibilityOutputs } from './simulation/VehicleState.js';
import { quaternionFromEuler } from './simulation/RigidBodyMath.js';
import { stepMechanicalState } from './simulation/MechanicalModel.js';
import { RACE_WHEEL_IDS, clamp } from './simulation/SimulationMath.js';

const distantContactPoses = new WeakMap();

// Geometry is immutable during a race bake. Reuse only an exact unchanged
// pose from the immediately preceding distant step; material state is sampled
// again by the caller so weather/ruts are not frozen in the cache.
export function getReusableRaceAiDistantContacts(editor, ai) {
  const cached=distantContactPoses.get(ai), state=ai.vehicleDynamicsRunner?.state;
  const session=editor.playtestSession;
  if(ai.simulationDetail!=='distant' || !cached || !state || !session?.worldBake || !session.trackState
    || cached.bake!==session.worldBake || cached.trackState!==session.trackState
    || cached.x!==state.position.x || cached.y!==state.position.y || cached.z!==state.position.z
    || cached.yaw!==state.yawRad || !ai.distantContactState?.surfaceSamples) return null;
  return ai.distantContactState;
}

// Distant opponents retain the existing longitudinal tire/powertrain model,
// but use a terrain-following bicycle for chassis motion. A hysteresis band
// avoids repeatedly rebuilding full suspension state at the distance boundary.
export function canUseRaceAiDistantPhysics(editor, ai, contactState, dt) {
  const runner = ai.vehicleDynamicsRunner, state = runner?.state;
  const session = editor.playtestSession;
  const reject = reason => { ai.distantPhysicsReason = reason; return false; };
  if (!state) return reject('uninitialized');
  if (runner.config.powertrainTuning?.powertrainType === 'electric') return reject('electric-authoritative');
  if (runner.config.powertrainTuning?.cvt) return reject('cvt-authoritative');
  if (editor.vehicleDynamicsAuthority?.workerBridge) return reject('worker');
  if (!(dt > 0 && dt <= 0.05)) return reject('time-step');
  if (ai.physicsBudgetDetail === 'full') return reject('nearest-four');
  if (ai.physicsBudgetDetail === 'cheap') {
    if (Math.abs(state.rollRad || 0) > .5 || state.grounded === false) return reject('unsupported-pose');
    return true;
  }
  if (state.grounded !== true) return reject('airborne');
  const speed = Number(ai.speedMps || 0);
  const holdingQueue = Number(ai.drivingPlan?.targetSpeedMps ?? Infinity) <= .05
    && speed >= -.75 && speed < .5;
  // Tiny rollback while holding a stopped queue is not a reverse maneuver.
  // Repeatedly rebuilding full physics for centimetres/second of hill jitter
  // caused distant traffic jams to consume most of the late-race frame budget.
  if (speed < 0 && !holdingQueue) return reject('reverse');
  if (Math.abs(state.rollRad || 0) > 0.2 || Math.abs(state.pitchRad || 0) > 0.4) return reject('body-angle');
  if (Math.abs(state.bodyLateralSpeedMps || 0) > 1) return reject('sliding');
  if (runner.pendingCollisionImpulses?.length || runner.stationaryResetHold) return reject('collision-or-reset');
  const dx=ai.worldX-session.worldX, dz=ai.worldZ-session.worldZ;
  const distance = Math.hypot(dx,dz);
  if (!Number.isFinite(distance) || distance < 1) return reject('near-player');
  const playerVx=Number(session.velocityX ?? Math.sin(session.carYaw || 0)*(session.speedMps || 0));
  const playerVz=Number(session.velocityZ ?? Math.cos(session.carYaw || 0)*(session.speedMps || 0));
  const closingSpeed=Math.max(0,-((Number(state.velocity?.x || 0)-playerVx)*dx
    +(Number(state.velocity?.z || 0)-playerVz)*dz)/distance);
  // Restore detailed handling at least two seconds before fast traffic arrives.
  const legacy = session.debugAiLegacyPhysicsEnvelope === true;
  const yawDelta=Math.atan2(Math.sin(ai.carYaw-session.carYaw),Math.cos(ai.carYaw-session.carYaw));
  const steadyConvoy=!legacy && !session.debugAiFullConvoyPhysics && session.grounded === true
    && speed>2 && Number(session.speedMps)>2 && closingSpeed<1
    && Math.abs(yawDelta)<.2 && Math.abs(Number(state.angularVelocityWorld?.y || 0))<.2
    && Math.abs(Number(session.yawVelocityRadps || 0))<.2
    && Math.abs(Number(session.bodyLateralSpeedMps || 0))<.4
    && Math.abs(Number(state.bodyLateralSpeedMps || 0))<.4
    && Math.abs(Number(session.rollRad || 0))<.15;
  // Stable same-direction traffic need not rebuild suspension solely because
  // it is within 12 m. Keep a physical gap, hysteresis and closing-speed guard;
  // advance still rejects swept traffic, scenery and unsupported terrain.
  const nearRadius=(ai.simulationDetail === 'distant'
    ? (legacy ? 30 : steadyConvoy ? 7 : 12)
    : (legacy ? 45 : steadyConvoy ? 10 : 18))+closingSpeed*2;
  if (distance < nearRadius) return reject('near-player');
  if (Object.values(ai.damage || {}).some(value => value && typeof value === 'object'
    ? Object.values(value).some(damage => Number(damage) > 25) : Number(value) > 25)) return reject('damage');
  if (state.mechanical && (state.mechanical.engineRunning === false
    || Object.values(state.mechanical.components || {}).some(c => c.failed || c.damage > 25
      || c.malfunctionUntil > state.mechanical.tick))) return reject('mechanical');
  const supported=RACE_WHEEL_IDS.every(id => contactState.contacts?.contacts?.[id]?.valid === true
    && contactState.contacts.contacts[id].region === 'road');
  return supported || reject('off-road');
}

export function advanceRaceAiDistantPhysics(editor, ai, {car, tuning, contactState, physics, seconds}) {
  ai.distantContactState = null;
  ai.cheapPhysicsHeld=false;
  if (!canUseRaceAiDistantPhysics(editor, ai, contactState, seconds)) return false;
  const runner = ai.vehicleDynamicsRunner, state = runner.state, dt = seconds;
  const reject = reason => { ai.distantPhysicsReason = reason; return false; };
  let speed = Math.max(0, Number(physics.speedMps));
  if (!Number.isFinite(speed)) return reject('invalid-speed');
  let averageSpeed = (Math.max(0, ai.speedMps) + speed) / 2;
  let yawRate = clamp(averageSpeed * Math.tan(ai.drivingPlan.steeringAngleRad)
    / Math.max(1, tuning.wheelbaseM || 2.65),
    -9.81 * Math.max(0.12, ai.averageSurfaceGrip || contactState.averageSurfaceGrip) / Math.max(1, averageSpeed),
    9.81 * Math.max(0.12, ai.averageSurfaceGrip || contactState.averageSurfaceGrip) / Math.max(1, averageSpeed));
  let yaw = ai.carYaw + yawRate * dt;
  const midYaw = ai.carYaw + yawRate * dt / 2;
  let x = ai.worldX + Math.sin(midYaw) * averageSpeed * dt;
  let z = ai.worldZ + Math.cos(midYaw) * averageSpeed * dt;
  const routeMotion=getRaceAiRouteMotion(editor,ai,{tuning,averageSpeed,seconds:dt});
  if(routeMotion) {
    ({x,z,yaw}=routeMotion);
    const maxYawRate=9.81*Math.max(.12,contactState.averageSurfaceGrip||1)/Math.max(1,averageSpeed);
    yawRate=clamp(Math.atan2(Math.sin(yaw-ai.carYaw),Math.cos(yaw-ai.carYaw))/dt,-maxYawRate,maxYawRate);
    yaw=ai.carYaw+yawRate*dt;
  }
  const reach = Math.hypot(runner.config.bodyWidthM || 1.8, runner.config.bodyLengthM || 4.5) / 2 + 0.5;
  const bounds = {minX:Math.min(x,ai.worldX)-reach,maxX:Math.max(x,ai.worldX)+reach,
    minZ:Math.min(z,ai.worldZ)-reach,maxZ:Math.max(z,ai.worldZ)+reach,
    minY:state.position.y-1,maxY:state.position.y+2};
  const colliders = editor.vehicleDynamicsAuthority?.raceEnvironmentProviderContext?.staticColliderWorld;
  // Missing collision data is not permission to drive through scenery.
  if (!colliders && !editor.vehicleDynamicsAuthority?.staticColliderWorldCache) return reject('missing-colliders');
  let holdingQueue = speed <= 1e-8 && averageSpeed <= 1e-8
    && Number(ai.drivingPlan?.targetSpeedMps ?? Infinity) <= .05
    && Number(ai.engineDrive?.brake || 0) >= .5;
  // A supported stationary car introduces no new swept collision. Moving
  // opponents still test against it, and proximity/pending impulses restore
  // its detailed solver. Keep mechanics and race time advancing while held.
  if (!holdingQueue && colliders?.querySweptAabb(bounds).length) return reject('obstacle');
  ai.distantTrafficBlocker=null;
  if (!holdingQueue) {
    const broadProbe=createRaceAiTrafficProbe(ai,x,z,yaw,dt);
    if (broadProbe(editor.playtestSession)) return reject('player-sweep');
    let tightProbe,overlapProbe,blocked=false;
    for(const other of editor.playtestSession.aiRuntime || []) {
      if(!broadProbe(other))continue;
      if(!routeMotion)return reject('traffic');
      // Broadphase padding is useful for selecting detailed physics but must
      // not deadlock an already-clear queue. Keep rotation sweep padding;
      // remove only the speculative 15 cm clearance for route traffic.
      tightProbe ||= createRaceAiTrafficProbe(ai,x,z,yaw,dt,{clearance:.01});
      if(!tightProbe(other))continue;
      ai.distantTrafficBlocker=other.id||other.carId||'unknown';
      overlapProbe ||= createRaceAiTrafficProbe(ai,ai.worldX,ai.worldZ,ai.carYaw,0,{clearance:0});
      // Holding both interpenetrating cars forever cannot resolve contact.
      // Let the existing collision solver separate an actual current overlap.
      if(overlapProbe(other))return reject('traffic-overlap');
      blocked=true;
    }
    if (blocked && routeMotion && averageSpeed > 0 && averageSpeed < 2) {
      // Defer a blocked lane change: a leader may pull straight ahead when its
      // merging sweep is blocked by a follower. Revalidate the entire movement;
      // neither traffic nor scenery collisions are ignored.
      const forwardX=ai.worldX+Math.sin(ai.carYaw)*averageSpeed*dt;
      const forwardZ=ai.worldZ+Math.cos(ai.carYaw)*averageSpeed*dt;
      // Current physical overlap was already rejected above. Speculative
      // padding must not prevent separation from a clear stopped follower.
      const forwardProbe=createRaceAiTrafficProbe(ai,forwardX,forwardZ,ai.carYaw,dt,{clearance:0});
      const forwardBounds={...bounds,minX:Math.min(ai.worldX,forwardX)-reach,
        maxX:Math.max(ai.worldX,forwardX)+reach,minZ:Math.min(ai.worldZ,forwardZ)-reach,
        maxZ:Math.max(ai.worldZ,forwardZ)+reach};
      if (!(editor.playtestSession.aiRuntime || []).some(forwardProbe)
          && !colliders?.querySweptAabb(forwardBounds).length) {
        x=forwardX;z=forwardZ;yaw=ai.carYaw;yawRate=0;blocked=false;
        ai.distantTrafficBlocker=null;
      }
    }
    if(blocked) {
      x=ai.worldX;z=ai.worldZ;yaw=ai.carYaw;yawRate=0;speed=0;averageSpeed=0;
      holdingQueue=true;
      ai.engineDrive.throttle=0;ai.engineDrive.brake=1;
    }
  }
  const contacts = holdingQueue ? contactState.contacts : sampleRaceAiWheelContacts(editor,ai,{car,tuning,session:{
    worldX:x,worldZ:z,carYaw:yaw,speedMps:speed,heightM:state.position.y-runner.config.cgHeightM,
    routeRuntimeType:editor.playtestSession.routeRuntimeType,
    trackState:editor.playtestSession.trackState
  }});
  if (!RACE_WHEEL_IDS.every(id=>contacts.contacts?.[id]?.valid === true
    && contacts.contacts[id].region === 'road') || !Number.isFinite(contacts.averageHeightM)) return reject('terrain-step');
  const normals=RACE_WHEEL_IDS.map(id=>contactState.contacts.contacts[id].normal || {x:0,y:1,z:0});
  if(normals.some(n=>![n.x,n.y,n.z].every(Number.isFinite))) return reject('invalid-normal');
  const normal={x:0,y:0,z:0};
  for(const n of normals){normal.x+=n.x;normal.y+=n.y;normal.z+=n.z;}
  if(normal.y <= 0) return reject('invalid-normal');
  const expectedRise=-(normal.x*(x-ai.worldX)+normal.z*(z-ai.worldZ))/normal.y;
  if(ai.physicsBudgetDetail !== 'cheap' && Math.abs(contacts.averageHeightM-contactState.contacts.averageHeightM-expectedRise)>0.03) return reject('terrain-step');
  if(ai.physicsBudgetDetail === 'cheap' && Math.abs(contacts.averageHeightM-contactState.contacts.averageHeightM)>Math.hypot(x-ai.worldX,z-ai.worldZ)*1.5+.15) return reject('terrain-step');
  const y = contacts.averageHeightM + runner.config.cgHeightM;
  const pitch = -contacts.terrainPitchRad, roll = contacts.terrainRollRad;
  state.grounded=true;state.airborne=false;
  state.position = {x,y,z};
  state.velocity = {x:Math.sin(yaw)*speed,y:(y-ai.bodyY)/dt,z:Math.cos(yaw)*speed};
  if (!Number.isFinite(state.velocity.y)) state.velocity.y=0;
  state.orientation = quaternionFromEuler({yaw,pitch,roll});
  state.yawRad=yaw;state.pitchRad=pitch;state.rollRad=roll;
  state.angularVelocityWorld={x:0,y:yawRate,z:0};state.yawRateRadps=yawRate;
  for(const key of ['speedMps','groundSpeedMps','bodyLongitudinalSpeedMps','signedTravelSpeedMps']) state[key]=speed;
  state.bodyLateralSpeedMps=0;state.lateralAccelerationMps2=yawRate*speed;
  state.engineRpm=ai.rpm;state.gear=ai.gear;
  if(state.powertrainState){state.powertrainState.engineRpm=ai.rpm;state.powertrainState.gear=ai.gear;}
  for(const id of RACE_WHEEL_IDS){
    state.wheelAngularVelocityRadps[id]=speed/runner.config.wheelRadiusM;
    runner.renderWheelSpinAngles[id]=(runner.renderWheelSpinAngles[id]+averageSpeed*dt/runner.config.wheelRadiusM)%(Math.PI*2);
  }
  const weather = editor.getRaceWeatherState(editor.selectedRace,editor.playtestSession).id;
  stepMechanicalState(state.mechanical,dt,{rpm:ai.rpm,maxRpm:runner.config.maxRpm,
    throttle:ai.engineDrive.throttle,brake:ai.engineDrive.brake,gear:ai.gear,speedMps:speed,
    tires:state.tireState,wheelAngularVelocityRadps:state.wheelAngularVelocityRadps,
    lateralAccelerationMps2:state.lateralAccelerationMps2,
    ambientTemperatureC:weather==='snow'?-4:weather==='storm'?13:weather==='rain'?16:22
  },ai.damage||{});
  runner.observedTimeSeconds+=dt;
  runner.stepIndex=Math.floor((runner.observedTimeSeconds+1e-9)*runner.config.chassisHz);
  ai.simulationDetail='distant';
  ai.cheapHeldSeconds=0;ai.cheapHoldRetrySeconds=0;
  ai.distantPhysicsReason=routeMotion ? (holdingQueue?'route-yield':'route') : 'distant';
  ai.distantContactState=contacts;
  distantContactPoses.set(ai,{x,y,z,yaw,bake:editor.playtestSession.worldBake,trackState:editor.playtestSession.trackState});
  syncVehicleDynamicsCompatibilityOutputs(runner,ai);
  ai.rpm=ai.engineRpm;
  ai.heightM=y-runner.config.cgHeightM;
  return true;
}

export function restoreRaceAiDetailedPhysics(editor, ai) {
  if(ai.simulationDetail!=='distant') return;
  ai.simulationDetail='full';
  ai.distantContactState=null;
  distantContactPoses.delete(ai);
  ai.cheapPhysicsHeld=false;ai.cheapHeldSeconds=0;ai.cheapHoldRetrySeconds=0;
  if(editor.playtestSession)editor.playtestSession.aiPhysicsPromotions=(editor.playtestSession.aiPhysicsPromotions||0)+1;
  if(editor.vehicleDynamicsAuthority?.workerBridge) return;
  const old=ai.vehicleDynamicsRunner;
  // Construct contact/solver caches afresh, retaining motion, fuel, damage,
  // thermal state and simulation time. A recovery reset would stop the car.
  const runner=new VehicleDynamicsRunner({config:old.config,initialState:old.createStateSnapshot()});
  runner.observedTimeSeconds=old.observedTimeSeconds;runner.stepIndex=old.stepIndex;
  runner.renderWheelSpinAngles={...old.renderWheelSpinAngles};
  // Promotion often happens because a collision was just queued. Rebuilding
  // contact caches must not discard the impulse/contact that caused promotion.
  runner.pendingCollisionImpulses=structuredClone(old.pendingCollisionImpulses || []);
  runner.collisionTimeline=structuredClone(old.collisionTimeline || []);
  runner.authoritativeResetSequence=old.authoritativeResetSequence;
  runner.authoritativeResetAttemptSequence=old.authoritativeResetAttemptSequence;
  ai.vehicleDynamicsRunner=runner;
  ai.terrainQueryFrameCache=null;
  ai.trackStatePreviousWheelPositions=null;
  syncVehicleDynamicsCompatibilityOutputs(runner,ai);
}

// An unsafe cheap step yields in place rather than invoking the full solver.
// Keep clocks/mechanics alive and preserve pending impacts for promotion.
export function holdRaceAiCheapPhysics(editor,ai,seconds) {
 const runner=ai.vehicleDynamicsRunner;if(!runner)return;
 const state=runner.state,dt=Math.max(0,seconds);
 ai.cheapPhysicsHeld=true;ai.cheapHeldSeconds=(ai.cheapHeldSeconds||0)+dt;
 state.velocity={x:0,y:0,z:0};state.angularVelocityWorld={x:0,y:0,z:0};state.yawRateRadps=0;
 for(const key of ['speedMps','groundSpeedMps','bodyLongitudinalSpeedMps','signedTravelSpeedMps','bodyLateralSpeedMps'])state[key]=0;
 for(const id of RACE_WHEEL_IDS)state.wheelAngularVelocityRadps[id]=0;
 ai.engineDrive={...ai.engineDrive,throttle:0,brake:1};
 stepMechanicalState(state.mechanical,dt,{rpm:state.engineRpm,maxRpm:runner.config.maxRpm,
   throttle:0,brake:1,gear:state.gear,speedMps:0,tires:state.tireState,
   wheelAngularVelocityRadps:state.wheelAngularVelocityRadps},ai.damage||{});
 runner.observedTimeSeconds+=dt;
 runner.stepIndex=Math.floor((runner.observedTimeSeconds+1e-9)*runner.config.chassisHz);
 ai.simulationDetail='distant';
 syncVehicleDynamicsCompatibilityOutputs(runner,ai);
}
