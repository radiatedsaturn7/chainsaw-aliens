import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import RaceEditor from '../src/ui/RaceEditor.js';
import { sampleRaceBakedSurface } from '../src/racing/RaceBakedSurfaceSampler.js';

// BUSE_LAP=1 runs a steering/pedal-only lap; otherwise measures acceleration.
// Neither mode changes the saved race, car, or authoritative vehicle poses.
globalThis.__RTG_PHYSICS_COST_ACCOUNTING__ = true;
const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }, { mode: 'race' });
const racePath = process.env.BUSE_RACE || 'data/server-storage/files/races/buse1/document.json';
const carPath = process.argv[2] || 'data/server-storage/files/cars/2022 Subaru WRX2/document.json';
const reportPath = process.env.BUSE_REPORT || 'artifacts/buse1/diagnostic.json';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
editor.applyLoadedRaceDocument(readJson(racePath), { name: 'buse1' });
editor.applyLoadedCarDocument(readJson(carPath), { name: '2022 Subaru WRX2' });
const started = performance.now();
const bake = editor.buildRaceWorldBake({ retainTerrainCells: false });
const report = {
  carFile: carPath,
  raceFile: racePath,
  car: editor.selectedCar.name,
  routeLength: editor.getRaceRouteLength(),
  nodes: editor.selectedRace.road.nodes.length,
  bakeMs: performance.now() - started,
  triangleCount: bake.surfaceSampler?.triangleCount,
  samples: [],
  frames: []
};
console.log(JSON.stringify({ ...report, samples: undefined, frames: undefined }));
editor.withRaceGeometryReadCache(() => {
  for (let distance = 0; distance < report.routeLength; distance += 2) {
    const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType: 'circuit' });
    const sample = sampleRaceBakedSurface(bake.surfaceSampler, { x: pose.x, z: pose.z });
    report.samples.push({ distance, x: pose.x, z: pose.z, sample });
  }
});
editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), { hydrateCars: false, preparedWorldBake: bake });
const session = editor.playtestSession;
session.countdownRemainingMs = 0;
session.startupFramePending = false;
editor.raceInput.physicsPerformanceVisible = true;
session.physicsPerformanceVisible = true;
editor.updatePlaytestSafely(0);
const runner = session.vehicleDynamicsRunner;
report.authoredLaps = editor.selectedRace.laps;
report.staticColliders = editor.vehicleDynamicsAuthority?.staticColliderDefinitions;
Object.assign(editor.raceInput, {
  keyboardThrottle: true, rawThrottleAxis: 1, analogThrottleActive: true,
  keyboardBrake: false, rawBrakeAxis: 0, autoShift: true, paused: false
});
const lapMode = process.env.BUSE_LAP === '1';
const normalizeAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
let totalTravel = 0;
let previousRoute = 0;
let maxLateral = 0;
function steerAlongRoute() {
  const projection = editor.getRaceRouteProjectionForWorldPoint({ x: session.worldX, z: session.worldZ });
  const current = projection.distance;
  let delta = current - previousRoute;
  if (delta < -report.routeLength / 2) delta += report.routeLength;
  if (delta > report.routeLength / 2) delta -= report.routeLength;
  totalTravel += delta;
  previousRoute = current;
  maxLateral = Math.max(maxLateral, projection.distanceToRoute);
  const speed = Math.abs(session.speedMps || 0);
  const lookahead = Math.max(4, Math.min(9, speed * 0.8));
  const poseAt = distance => editor.getRaceWorldPoseAtDistance(distance, { runtimeType: 'circuit' });
  const target = poseAt(current + lookahead);
  const near = poseAt(current + 4);
  const far = poseAt(current + 15);
  const turn = Math.abs(normalizeAngle(far.yaw - near.yaw));
  const targetSpeed = Math.max(4, Math.min(12, 12 - turn * 12));
  const yawError = normalizeAngle(Math.atan2(target.x - session.worldX, target.z - session.worldZ) - session.carYaw);
  const steer = Math.max(-1, Math.min(1, -Math.atan(2 * 2.67 * Math.sin(yawError) / lookahead) / 0.52));
  Object.assign(editor.raceInput, {
    analogSteeringActive: true, syntheticAnalogSteering: true, analogSteeringIntent: steer,
    keyboardThrottle: speed < targetSpeed,
    rawThrottleAxis: speed < targetSpeed ? Math.min(0.75, (targetSpeed - speed) * 0.3 + 0.12) : 0,
    keyboardBrake: speed > targetSpeed + 0.3,
    rawBrakeAxis: speed > targetSpeed + 0.3 ? Math.min(0.6, (speed - targetSpeed) * 0.18) : 0
  });
}
for (let frame = 0; frame < (lapMode ? 30000 : 180); frame += 1) {
  if (lapMode) editor.withRaceGeometryReadCache(steerAlongRoute);
  const started = performance.now();
  const ok = editor.updatePlaytestSafely(1 / 60);
  report.frames.push({
    frame, ms: performance.now() - started, ok, speed: session.speedMps, distance: session.distance,
    x: session.worldX, z: session.worldZ, y: session.bodyY, reset: session.lastVehicleResetReason,
    contact: session.vehicle3d?.lastChassisCollision, lap: session.lap, checkpoint: session.checkpointIndex,
    cost: lapMode ? undefined : runner.physicsCostAccounting.getLatestFrame()
  });
  if (frame % (lapMode ? 600 : 30) === 0) {
    console.log('frame', frame, 'ms', report.frames.at(-1).ms, 'speed', session.speedMps,
      'progress', session.distance, 'travel', totalTravel, 'max lateral', maxLateral);
  }
  if (!ok) break;
  if (!editor.playtestSession) { report.finishRegistered = true; report.lapCompleted = true; break; }
  if (lapMode && totalTravel >= report.routeLength) { report.lapCompleted = true; break; }
  if (lapMode && (maxLateral > 15 || (frame > 1800 && totalTravel < 10))) {
    report.controllerFailed = true;
    break;
  }
}
Object.assign(report, {
  finalLap: session.lap, checkpointIndex: session.checkpointIndex,
  checkpointCount: session.checkpointCount, totalTravel, maxLateral
});
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report));
console.log('Report:', reportPath, 'Lap completed:', !!report.lapCompleted, 'Finish registered:', !!report.finishRegistered);
