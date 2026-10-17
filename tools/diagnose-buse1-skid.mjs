import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as THREE from '../src/vendorBridge/three.js';
import { dirname } from 'node:path';
import RaceEditor from '../src/ui/RaceEditor.js';
import { sampleRaceBakedSurface } from '../src/racing/RaceBakedSurfaceSampler.js';

// Six seconds of acceleration, a sustained turn, then countersteer.
// Measures physics and Three.js geometry preparation separately, without a GPU.
// Does not change saved documents or authoritative vehicle poses.
globalThis.__RTG_PHYSICS_COST_ACCOUNTING__ = true;
const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true, exitRaceEditor() {} }, { mode: 'race' });
const racePath = process.env.BUSE_RACE || 'data/server-storage/files/races/buse1/document.json';
const carPath = process.argv[2] || 'tests/fixtures/wrx2CarDocument.json';
const reportPath = process.env.BUSE_REPORT || 'artifacts/buse1/skid-diagnostic.json';
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
const renderer = { scene: new THREE.Scene() };
for (let frame = 0; frame < 360; frame += 1) {
  Object.assign(editor.raceInput, { analogSteeringActive: true, syntheticAnalogSteering: true,
    analogSteeringIntent: frame < 90 ? 0 : frame < 230 ? 0.8 : -0.8 });
  const started = performance.now();
  const ok = editor.updatePlaytestSafely(1 / 60);
  const physicsMs = performance.now() - started;
  const renderStarted = performance.now();
  const stats = {};
  editor.withRaceGeometryReadCache(() => {
    editor.syncRaceThreeTireTracks(renderer, { stats });
    editor.syncRaceThreeTrackState(renderer, { stats });
  });
  const renderMs = performance.now() - renderStarted;
  report.frames.push({ physicsMs, renderMs, stats,
    frame, ms: performance.now() - started, ok, speed: session.speedMps, distance: session.distance,
    x: session.worldX, z: session.worldZ, y: session.bodyY, reset: session.lastVehicleResetReason,
    contact: session.vehicle3d?.lastChassisCollision, lap: session.lap, checkpoint: session.checkpointIndex,
    cost: runner.physicsCostAccounting.getLatestFrame()
  });
  if (frame % 30 === 0) {
    console.log('frame', frame, 'ms', report.frames.at(-1).ms, 'speed', session.speedMps,
      'progress', session.distance, 'render ms', renderMs);
  }
  if (!ok) break;
  if (!editor.playtestSession) { report.finishRegistered = true; report.lapCompleted = true; break; }
}
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report));
console.log('Report:', reportPath);
