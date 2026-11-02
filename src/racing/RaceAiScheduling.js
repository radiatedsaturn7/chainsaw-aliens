// Racing-line decisions can run slower than steering and tire physics. Use
// simulation time (not render frames or wall time) and stagger distant cars.
const surfacePlanTracks = new WeakMap();

export function shouldRefreshRaceAiSurfacePlan(ai, session, seconds, index = 0) {
  if (!session?.trackState) return false;
  const dt = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const dx = Number(ai.worldX) - Number(session.worldX);
  const dz = Number(ai.worldZ) - Number(session.worldZ);
  const distance = Math.hypot(dx, dz);
  const interval = ai.physicsBudgetDetail === 'cheap'
    ? (!Number.isFinite(distance) || distance < 180 ? .25 : .5)
    : !Number.isFinite(distance) || distance < 60 ? .1 : distance < 180 ? .25 : .5;
  if (surfacePlanTracks.get(ai) !== session.trackState || !ai.trackStateLineDecision) {
    surfacePlanTracks.set(ai, session.trackState);
    ai.surfacePlanElapsed = -(index % 7) / 7 * interval;
    ai.surfacePlanInterval = interval;
    return true;
  }
  ai.surfacePlanElapsed = Number(ai.surfacePlanElapsed || 0) + dt;
  // An approaching car immediately gets the more responsive schedule.
  if (interval < ai.surfacePlanInterval) ai.surfacePlanElapsed = interval;
  ai.surfacePlanInterval = interval;
  if (ai.surfacePlanElapsed + 1e-9 < interval) return false;
  ai.surfacePlanElapsed = Math.max(0, ai.surfacePlanElapsed
    - Math.floor((ai.surfacePlanElapsed + 1e-9) / interval) * interval);
  return true;
}

// Run the expensive contact/planning pipeline at 20 Hz outside the player's
// interaction envelope. The detailed runner still advances its fixed physics
// substeps over the full accumulated duration; no race time is discarded.
const simulationSchedules = new WeakMap();
export function consumeRaceAiSimulationStep(ai, session, seconds, index = 0, { worker = false } = {}) {
  const dt = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (!dt) return 0;
  let schedule = simulationSchedules.get(ai);
  if (!schedule || schedule.session !== session) {
    schedule = { session, elapsed: 0, first: true };
    simulationSchedules.set(ai, schedule);
  }
  const dx = Number(ai.worldX) - Number(session?.worldX);
  const dz = Number(ai.worldZ) - Number(session?.worldZ);
  const distance = Math.hypot(dx, dz);
  // Same-direction traffic should not all receive near-player cost merely
  // because both cars are fast. Promote on actual radial closing speed instead.
  const aiState = ai.vehicleDynamicsRunner?.state;
  const vx = Number(aiState?.velocity?.x ?? Math.sin(Number(ai.carYaw) || 0) * (Number(ai.speedMps) || 0));
  const vz = Number(aiState?.velocity?.z ?? Math.cos(Number(ai.carYaw) || 0) * (Number(ai.speedMps) || 0));
  const playerVx = Number(session?.velocityX ?? Math.sin(Number(session?.carYaw) || 0) * (Number(session?.speedMps) || 0));
  const playerVz = Number(session?.velocityZ ?? Math.cos(Number(session?.carYaw) || 0) * (Number(session?.speedMps) || 0));
  const closing = Math.max(0, -((vx - playerVx) * dx + (vz - playerVz) * dz) / Math.max(1, distance));
  const reach = 30 + closing * 2;
  schedule.elapsed += dt;
  const immediate = ai.physicsBudgetDetail === 'full' || session?.debugAiFullRate === true || worker
    || (ai.physicsBudgetDetail !== 'cheap' && (!Number.isFinite(distance) || distance < reach
    || ai.vehicleDynamicsRunner?.pendingCollisionImpulses?.length));
  ai.simulationPipelineHz = immediate ? 60 : 20;
  const interval = schedule.first ? ((index % 3) + 1) / 60 : 1 / 20;
  if (!immediate && schedule.elapsed + 1e-9 < interval) return 0;
  const result = immediate ? schedule.elapsed : Math.min(schedule.elapsed, interval);
  schedule.elapsed = Math.max(0, schedule.elapsed - result);
  schedule.first = false;
  return result;
}

// Advisory lane observations can be shared for one weather tick (normally
// 100 ms). Actual tire forces still sample current authoritative Track State.
const surfaceObservations = new WeakMap();
export function getRaceAiSurfaceObservationCache(session) {
 const track=session?.trackState;
 if(!track)return null;
 let cache=surfaceObservations.get(track);
 if(!cache||cache.step!==track.stepIndex){cache={step:track.stepIndex,samples:new Map()};surfaceObservations.set(track,cache);}
 return cache.samples;
}
