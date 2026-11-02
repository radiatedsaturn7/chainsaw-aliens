import { createRaceAiTrafficProbe } from './RaceAiTrafficBounds.js';

// Detail is an interaction budget, not a quota for three arbitrarily distant
// cars. The thresholds use simulation metres/seconds, never frame or wall time.
export const RACE_AI_DETAIL_POLICY = Object.freeze({
  maximumDetailedCars: 3,
  enterDistanceM: 60,
  exitDistanceM: 75,
  closingLookaheadSeconds: 2,
  minimumResidenceSeconds: 0.5,
  rankHysteresisM: 3,
  collisionLookaheadSeconds: 0.1
});

const selections = new WeakMap();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function compareIds(left, right) {
  if (typeof left.id === 'number' && typeof right.id === 'number') return left.id - right.id || left.ordinal - right.ordinal;
  const a = String(left.id ?? ''), b = String(right.id ?? '');
  return (a < b ? -1 : a > b ? 1 : 0) || left.ordinal - right.ordinal;
}

function compareCandidates(left, right) {
  return Number(right.emergency) - Number(left.emergency)
    || Number(right.resident) - Number(left.resident)
    || left.score - right.score
    || Number(right.previous) - Number(left.previous)
    || compareIds(left, right);
}

function bodyRadius(car) {
  const config = car.vehicleDynamicsRunner?.config;
  return Math.hypot(finite(config?.bodyWidthM, 1.8), finite(config?.bodyLengthM, 4.5),
    finite(config?.bodyHeightM, 1.5)) / 2;
}

function imminentPlayerContact(ai, session, record, playerY, playerVy, playerRadius) {
  const state = ai.vehicleDynamicsRunner?.state;
  const dt = RACE_AI_DETAIL_POLICY.collisionLookaheadSeconds;
  // Reject grade-separated roads before the planar swept-rectangle test. The
  // circumsphere bound stays conservative for roll/pitch and unknown body pose.
  const aiY = Number(state?.position?.y ?? ai.bodyY);
  if (Number.isFinite(aiY) && Number.isFinite(playerY)) {
    const separation = aiY - playerY;
    const nextSeparation = separation + (finite(state?.velocity?.y) - playerVy) * dt;
    const reach = record.radius + playerRadius + 0.3;
    if (Math.min(separation, nextSeparation) > reach || Math.max(separation, nextSeparation) < -reach) return false;
  }
  // A cheap scalar rejection avoids constructing swept boxes for far cars.
  const reach = record.radius + playerRadius + 0.5
    + Math.abs(record.vx) * dt + Math.abs(record.vz) * dt
    + Math.abs(record.playerVx) * dt + Math.abs(record.playerVz) * dt;
  if (Math.abs(record.dx) > reach || Math.abs(record.dz) > reach) return false;
  const yaw = finite(ai.carYaw);
  return createRaceAiTrafficProbe(ai, finite(ai.worldX) + record.vx * dt,
    finite(ai.worldZ) + record.vz * dt,
    yaw + finite(state?.angularVelocityWorld?.y) * dt, dt)(session);
}

export function assignRaceAiPhysicsBudget(session, { worker = false, seconds = 0 } = {}) {
  const cars = session.aiRuntime || [];
  if (worker) {
    selections.delete(session);
    for (const ai of cars) { ai.physicsBudgetDetail = null; ai.physicsBudgetReason = 'worker'; }
    session.aiDetailedPhysicsCount = cars.length;
    session.aiCheapPhysicsCount = 0;
    session.aiDetailedPhysicsSafetyCount = 0;
    session.aiDetailedPhysicsOverflowCount = 0;
    return;
  }
  let selection = selections.get(session);
  if (!selection) {
    selection = { clock: 0, generation: 0, nextOrdinal: 0, records: new Map(), candidates: [] };
    selections.set(session, selection);
  }
  selection.clock += Math.max(0, finite(seconds));
  selection.generation += 1;
  const candidates = selection.candidates;
  candidates.length = 0;
  const playerState = session.vehicleDynamicsRunner?.state;
  const playerY = Number(playerState?.position?.y ?? session.bodyY);
  const playerYaw = finite(session.carYaw);
  const playerVx = finite(session.velocityX ?? playerState?.velocity?.x,
    Math.sin(playerYaw) * finite(session.speedMps));
  const playerVz = finite(session.velocityZ ?? playerState?.velocity?.z,
    Math.cos(playerYaw) * finite(session.speedMps));
  const playerVy = finite(playerState?.velocity?.y);
  const playerRadius = bodyRadius(session);
  for (const ai of cars) {
    let record = selection.records.get(ai);
    if (!record) {
      record = { ai, id: ai.id ?? ai.carId, ordinal: selection.nextOrdinal++, selected: false, selectedAt: -Infinity };
      selection.records.set(ai, record);
    }
    record.generation = selection.generation;
    record.previous = record.selected;
    record.selected = false;
    const state = ai.vehicleDynamicsRunner?.state;
    record.radius = bodyRadius(ai);
    record.dx = Number(ai.worldX) - Number(session.worldX);
    record.dz = Number(ai.worldZ) - Number(session.worldZ);
    const aiY = Number(state?.position?.y ?? ai.bodyY);
    const dy = Number.isFinite(playerY) && Number.isFinite(aiY) ? aiY - playerY : 0;
    record.distance = Math.hypot(record.dx, dy, record.dz);
    const yaw = finite(ai.carYaw);
    record.vx = finite(state?.velocity?.x, Math.sin(yaw) * finite(ai.speedMps));
    record.vz = finite(state?.velocity?.z, Math.cos(yaw) * finite(ai.speedMps));
    record.playerVx = playerVx;
    record.playerVz = playerVz;
    const closing = Math.max(0, -((record.vx - playerVx) * record.dx
      + (record.vz - playerVz) * record.dz
      + (finite(state?.velocity?.y) - playerVy) * dy) / Math.max(1, record.distance));
    const radius = (record.previous ? RACE_AI_DETAIL_POLICY.exitDistanceM : RACE_AI_DETAIL_POLICY.enterDistanceM)
      + closing * RACE_AI_DETAIL_POLICY.closingLookaheadSeconds;
    const pendingImpact = Boolean(ai.vehicleDynamicsRunner?.pendingCollisionImpulses?.length);
    const validPose = Number.isFinite(record.distance);
    const imminent = validPose && imminentPlayerContact(ai, session, record, playerY, playerVy, playerRadius);
    // Safety overrides may exceed the ordinary three-car ceiling. Never hold a
    // fourth imminent player collision or discard a queued impulse for a budget.
    record.emergency = pendingImpact || imminent || !validPose;
    record.reason = pendingImpact ? 'pending-impact' : imminent ? 'imminent-player-contact'
      : !validPose ? 'invalid-pose' : 'interaction';
    record.eligible = record.emergency || record.distance <= radius;
    record.resident = record.previous && selection.clock - record.selectedAt < RACE_AI_DETAIL_POLICY.minimumResidenceSeconds;
    record.score = (validPose ? record.distance : Infinity)
      - (record.previous ? RACE_AI_DETAIL_POLICY.rankHysteresisM : 0);
    if (record.eligible) candidates.push(record);
  }
  candidates.sort(compareCandidates);
  let selectedCount = 0, safetyCount = 0;
  for (const record of candidates) {
    if (!record.emergency && selectedCount >= RACE_AI_DETAIL_POLICY.maximumDetailedCars) continue;
    record.selected = true;
    if (!record.previous) record.selectedAt = selection.clock;
    selectedCount += 1;
    if (record.emergency) safetyCount += 1;
  }
  for (const record of selection.records.values()) {
    const ai = record.ai;
    if (record.generation !== selection.generation) { selection.records.delete(ai); continue; }
    if (record.selected !== record.previous) session.aiPhysicsBudgetTransitions = (session.aiPhysicsBudgetTransitions || 0) + 1;
    ai.physicsBudgetDetail = record.selected ? 'full' : 'cheap';
    ai.physicsBudgetReason = record.selected ? record.reason : record.eligible ? 'interaction-budget' : 'outside-interaction';
  }
  session.aiDetailedPhysicsCount = selectedCount;
  session.aiCheapPhysicsCount = Math.max(0, cars.length - selectedCount);
  session.aiDetailedPhysicsSafetyCount = safetyCount;
  session.aiDetailedPhysicsOverflowCount = Math.max(0, selectedCount - RACE_AI_DETAIL_POLICY.maximumDetailedCars);
}
