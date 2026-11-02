import {createRaceAiTrafficProbe} from './RaceAiTrafficBounds.js';
import { raceAiRoadPlanIndex, getRaceAiPlannedSpeed } from './RaceAiRoadPlan.js';
import { RACE_THREE_ELEVATION_M } from './simulation/RaceSimulationConfig.js';
import { clamp } from './simulation/SimulationMath.js';
import { getRaceAiSharedCurvature, getRaceAiNearbyTraffic, getRaceAiRoadPlan } from './RaceAiDirector.js';
import { isUserRaceCar } from './CarPresets.js';

// Shuffle bags keep small grids varied and large grids balanced. A new bag is
// drawn only after every available car has had a place on the grid.
export function selectRaceAiCars(cars = [], count = 0, random = Math.random) {
  const ids = [...new Set(cars.filter(isUserRaceCar).map((car) => car?.__playtestId || car?.id).filter(Boolean))];
  const result = [];
  while (ids.length && result.length < count) {
    const bag = [...ids];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.min(i, Math.floor(clamp(Number(random()) || 0, 0, 1) * (i + 1)));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    result.push(...bag.slice(0, count - result.length));
  }
  return result;
}

const advisoryPlans = new WeakMap();

const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Grade and usable width are road geometry, not a track-name special case.
export function getRaceAiRoadSafety(editor, ai, tuning) {
  const runtimeType = editor.playtestSession?.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const distance = Number(ai.projectedDistance ?? ai.distance ?? 0);
  const plan=getRaceAiRoadPlan(editor);
  if(plan) {
    const i=raceAiRoadPlanIndex(plan,distance),risk=plan.risk[i],halfWidth=plan.halfWidth[i];
    return {risk,maxLineOffset:Math.min(.78-risk*.58,
      Math.max(0,(halfWidth-Number(tuning.widthM||1.8)/2-.65)/Math.max(1,halfWidth)))};
  }
  const a = editor.getRaceWorldPoseAtDistance(distance, {runtimeType});
  const b = editor.getRaceWorldPoseAtDistance(distance + 20, {runtimeType});
  const halfWidth = Math.min(editor.getRaceRoadHalfWidthWorld(a.segment), editor.getRaceRoadHalfWidthWorld(b.segment));
  const grade = Math.abs(Number(b.elevation || 0) - Number(a.elevation || 0)) * RACE_THREE_ELEVATION_M / 20;
  const risk = Math.max(clamp((grade - .025) / .10, 0, 1), clamp((3 - halfWidth) / 1.5, 0, 1));
  return {risk, maxLineOffset: Math.min(.78 - risk * .58,
    Math.max(0, (halfWidth - Number(tuning.widthM || 1.8) / 2 - .65) / Math.max(1, halfWidth)))};
}

export function planRaceAiDriving(editor, ai, tuning, {
  grip = 1, profile = {}, topSpeedMps = 60, roadSafety = null, seconds = null, scheduleIndex = 0, surfacePlanRefreshed = false
} = {}) {
  const session = editor.playtestSession || {};
  const runtimeType = session.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const routeLength = Math.max(1, Number(session.routeLength || editor.getRaceRouteLength()));
  const distance = Number(ai.projectedDistance ?? ai.distance ?? 0);
  const speed = Math.abs(Number(ai.speedMps || 0));
  const samplePose = (ahead) => editor.getRaceWorldPoseAtDistance(distance + ahead, { runtimeType, allowVisualExtension: true });
  const safety = roadSafety || getRaceAiRoadSafety(editor, ai, tuning);
  const lookahead = clamp(5 + speed * (0.65 - safety.risk * .25), 6, 30 - safety.risk * 14);
  const targetPose = samplePose(lookahead);
  const halfWidth = Math.max(1, editor.getRaceRoadHalfWidthWorld(targetPose.segment));
  const laneLimit = Math.max(0, halfWidth - Number(tuning.widthM || 1.8) / 2 - 0.45);
  const offset = clamp(clamp(Number(ai.lineOffset || 0), -safety.maxLineOffset, safety.maxLineOffset) * halfWidth, -laneLimit, laneLimit);
  const right = editor.getRaceRightVector(targetPose.yaw);
  const dx = Number(targetPose.x || 0) + right.x * offset - Number(ai.worldX || 0);
  const dz = Number(targetPose.z ?? targetPose.y ?? 0) + right.z * offset - Number(ai.worldZ || 0);
  const yaw = Number(ai.carYaw || 0);
  const lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const headingError = angleDifference(Math.atan2(dx, dz), yaw);
  const maxSteer = Number(ai.vehicleDynamicsRunner?.config?.maxSteerAngleRad || 0.52);
  const steeringAngleRad = clamp(Math.atan2(
    2 * Number(tuning.wheelbaseM || 2.65) * lateral,
    Math.max(4, dx * dx + dz * dz)
  ), -maxSteer, maxSteer);

  const roadPlan=getRaceAiRoadPlan(editor);
  const liveGrip=clamp(grip,0.12,1.2)*clamp(Number(tuning.tireGrip)||1,.35,1.4);
  const lateralAcceleration = 9.81 * liveGrip
    * (0.48 + Number(profile.corner ?? 0.72) * 0.34);
  const brakeEffects=ai.vehicleDynamicsRunner?.state?.mechanical?.effects?.brakes || {};
  const brakeCondition=Math.min(1,...Object.values(brakeEffects).map(v=>clamp(Number(v)||0,0,1)));
  const brakeCapability=Number.isFinite(tuning.brakeForceN)&&Number.isFinite(tuning.weightKg)
    ? tuning.brakeForceN/Math.max(450,tuning.weightKg)/9.81 : 1;
  const deceleration = 9.81 * liveGrip
    * Math.min(0.35 + Number(profile.brake ?? 0.74) * 0.35,brakeCapability)*brakeCondition;
  // Only advisory speed/traffic decisions are cached. Pure-pursuit steering
  // above, current speed caps below and swept collision checks remain live.
  const scheduled = Number.isFinite(seconds) && seconds >= 0;
  let memo = scheduled ? advisoryPlans.get(ai) : null;
  if (!memo || memo.session !== session || memo.detail !== ai.physicsBudgetDetail) {
    memo = {session, detail: ai.physicsBudgetDetail, clock: 0};
    if (scheduled) advisoryPlans.set(ai, memo);
  }
  if (scheduled) memo.clock += seconds;
  const phase = ((scheduleIndex * 0.61803398875) % 1 + 1) % 1;
  const cheap = ai.physicsBudgetDetail === 'cheap';
  const speedInterval = cheap ? .25 : .1;
  const speedBucket = Math.floor(memo.clock / speedInterval + phase);
  // Different phases prevent recurring alignment of the two advisory jobs.
  const trafficBucket = Math.floor(memo.clock / .15 + (phase + .5) % 1);
  // New race, promotion, reset/teleport and abrupt grip/brake loss must not
  // continue using advice from the previous pose or mechanical condition.
  const displaced = memo.x !== undefined && Math.hypot(ai.worldX-memo.x,ai.worldZ-memo.z)>12;
  const turned = memo.yaw !== undefined && Math.abs(angleDifference(yaw,memo.yaw))>.35;
  const degraded = liveGrip < memo.grip*.9 || deceleration < memo.deceleration*.9;
  const invalid = !scheduled || displaced || turned || degraded;
  const trafficDue = memo.trafficBucket !== trafficBucket;
  const speedDue = memo.speedBucket !== speedBucket;
  // Healthy cars may defer one advisory job, but never accumulate catch-up
  // work. Age limits prevent starvation at low frame rates or in busy packs.
  const refreshSpeed = invalid || memo.speedLimit === undefined || (speedDue && (
    (!surfacePlanRefreshed && !(cheap && trafficDue)) || memo.clock - memo.speedAt >= speedInterval + .05));
  if (refreshSpeed) {
    ai.speedPlanUpdates = (ai.speedPlanUpdates || 0) + 1;
    // Anticipate braking distance, including controller reaction time, using
    // actual route headings so imported node-based tracks work too.
    const horizon = clamp(speed * speed / (2 * deceleration) + speed + 35, 45, 320);
    let targetSpeedMps = Infinity;
    if(roadPlan)targetSpeedMps=Math.min(targetSpeedMps,
      getRaceAiPlannedSpeed(roadPlan,distance,speed,lateralAcceleration,deceleration));
    let a = null;
    for (let ahead = 0; !roadPlan && ahead <= horizon; ahead += 8) {
      let curvature = getRaceAiSharedCurvature(editor,distance+ahead);
      if(curvature===null) {
        a ||= samplePose(0);
        const b=samplePose(ahead+8);
        curvature=Math.abs(angleDifference(b.yaw||0,a.yaw||0))/8;
        a=b;
      }
      const cornerSpeed = Math.sqrt(lateralAcceleration * (1-safety.risk*.35) / Math.max(0.00001, curvature));
      const brakingRoom = Math.max(0, ahead - speed * 0.45 - 3);
      targetSpeedMps = Math.min(targetSpeedMps,
        Math.sqrt(cornerSpeed * cornerSpeed + 2 * deceleration * brakingRoom));
    }
    memo.speedLimit = targetSpeedMps;
    memo.speedBucket = speedBucket; memo.speedAt = memo.clock;
    memo.grip = liveGrip; memo.deceleration = deceleration;
    memo.x = ai.worldX; memo.z = ai.worldZ; memo.yaw = yaw;
  }
  let targetSpeedMps = Math.min(memo.speedLimit, Math.max(0, topSpeedMps)*(1-safety.risk*.35));
  // Slow down while recovering a missed line instead of accelerating off-road.
  targetSpeedMps *= clamp(1 - Math.abs(headingError) / 1.8, 0.12, 1);
  if (runtimeType !== 'circuit' && distance >= routeLength) targetSpeedMps = 0;
  // Leave braking room behind slower cars, including the player. Lateral
  // clearance means cars already alongside can continue their pass.
  const refreshTraffic = !cheap || invalid || memo.trafficLimit === undefined || (trafficDue && (
    (!refreshSpeed && !surfacePlanRefreshed) || memo.clock - memo.trafficAt >= .2));
  if (refreshTraffic) {
    ai.trafficPlanUpdates = (ai.trafficPlanUpdates || 0) + 1;
    let trafficLimit = Infinity;
    const traffic = getRaceAiNearbyTraffic(editor,ai,Math.max(15,speed*2.5)+Number(tuning.widthM||1.8)+.5);
    for (const other of traffic) {
      if (other.car === ai || !Number.isFinite(other.worldX) || !Number.isFinite(other.worldZ)) continue;
      const tx = other.worldX - Number(ai.worldX || 0);
      const tz = other.worldZ - Number(ai.worldZ || 0);
      const ahead = tx * Math.sin(yaw) + tz * Math.cos(yaw);
      const across = Math.abs(tx * Math.cos(yaw) - tz * Math.sin(yaw));
      if (ahead <= 0 || ahead > Math.max(15, speed * 2.5) || across > Number(tuning.widthM || 1.8) + 0.5) continue;
      // On a bend, two physically clear cars alongside can each see the other
      // a few centimetres 'ahead' in their own heading. Following both produces
      // a permanent mutual stop. Only apply following distance to a car alongside
      // when its swept hull actually threatens ours; normal leaders still brake.
      const ownLength=Number(ai.vehicleDynamicsRunner?.config?.bodyLengthM || 4.5);
      const otherLength=Number(other.car?.vehicleDynamicsRunner?.config?.bodyLengthM || 4.5);
      if (ahead < (ownLength+otherLength)*.25 && across > Number(tuning.widthM || 1.8)*.5) {
        const probe=createRaceAiTrafficProbe(ai,ai.worldX,ai.worldZ,yaw,.1,{clearance:0});
        if (!probe({...other.car,...other})) continue;
      }
      const otherSpeed = Math.max(0, Number(other.speedMps || 0))
        * Math.max(0, Math.cos(angleDifference(Number(other.carYaw || 0), yaw)));
      const room = Math.max(0, ahead - 5 - speed * 0.5);
      trafficLimit = Math.min(trafficLimit, Math.sqrt(otherSpeed * otherSpeed + 2 * deceleration * room));
    }
    memo.trafficLimit = trafficLimit;
    memo.trafficBucket = trafficBucket; memo.trafficAt = memo.clock;
  }
  targetSpeedMps = Math.min(targetSpeedMps, memo.trafficLimit);
  return { steeringAngleRad, targetSpeedMps, headingError, lookahead };
}
