import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raceEditorUrl = new URL('../../src/ui/RaceEditor.js', import.meta.url);
const simulationUrl = new URL('../../src/racing/RaceSimulation.js', import.meta.url);
const surfaceModelUrl = new URL('../../src/racing/simulation/SurfaceModel.js', import.meta.url);
const trackStateUrl = new URL('../../src/racing/trackState/TrackState.js', import.meta.url);
const damageModelUrl = new URL('../../src/racing/simulation/DamageModel.js', import.meta.url);

test('RaceEditor playtest update is an orchestration boundary, not a dynamics loop', async () => {
  const source = await readFile(raceEditorUrl, 'utf8');
  const start = source.indexOf('  updatePlaytest(dt = 0) {');
  const end = source.indexOf('\n  updateRaceWeatherApproachDistance(', start);
  assert.ok(start >= 0);
  assert.ok(end > start);
  const method = source.slice(start, end);
  assert.match(method, /updateRaceSimulation\(\{/);
  assert.match(method, /systems: this\.raceSimulationSystems/);
  assert.ok(method.split('\n').length < 15);
  assert.doesNotMatch(source, /from ['"]\.\.\/racing\/RaceVehiclePhysics\.js['"]/);
  assert.doesNotMatch(source, /\bstepRaceVehiclePhysics\(/);
  assert.doesNotMatch(source, /\bsyncRaceVehiclePhysicsToSession\(/);
});

test('racing layer owns the extracted numerical player step', async () => {
  const source = await readFile(simulationUrl, 'utf8');
  assert.match(source, /export function updateRaceSimulation\(\{/);
  assert.match(source, /getAuthoritativeVehicleState/);
  assert.match(source, /getRaceDrivenTractionLimit/);
  assert.match(source, /getRaceBrakeForceForInput/);
  assert.match(source, /syncVehicleDynamicsCompatibilityOutputs/);
  assert.match(source, /vehicleDynamicsRunner/);
});

test('normal runtime has no legacy planar follower or direct collision pose integrator', async () => {
  const [editorSource, simulationSource, damageSource] = await Promise.all([
    readFile(raceEditorUrl, 'utf8'),
    readFile(simulationUrl, 'utf8'),
    readFile(damageModelUrl, 'utf8')
  ]);
  assert.doesNotMatch(simulationSource, /playtestSession\.(?:speedMps|worldX|worldZ|carYaw|velocityYaw|yawVelocityRadps)\s*=/);
  assert.doesNotMatch(damageSource, /session\.(?:speedMps|worldX|worldZ|carYaw|yawVelocityRadps)\s*[+*\/-]?=/);
  assert.doesNotMatch(editorSource, /syncRaceSessionPlanarBodyToWorld/);
  assert.doesNotMatch(editorSource, /preservePlanarPosition/);
  const previewStart = editorSource.indexOf('  updateCarEditorPreviewPlaytest(');
  const previewEnd = editorSource.indexOf('\n  drawCarEditorStudioSprintPreviewRoad(', previewStart);
  const previewMethod = editorSource.slice(previewStart, previewEnd);
  assert.doesNotMatch(previewMethod, /playtestSession\.(?:worldX|worldZ|carYaw)\s*[+\-]?=/);
});

test('Track State dynamics stay in the racing subsystem and RaceEditor only orchestrates them', async () => {
  const [editorSource, simulationSource, surfaceSource, trackStateSource] = await Promise.all([
    readFile(raceEditorUrl, 'utf8'),
    readFile(simulationUrl, 'utf8'),
    readFile(surfaceModelUrl, 'utf8'),
    readFile(trackStateUrl, 'utf8')
  ]);
  assert.match(surfaceSource, /createTrackState\(/);
  assert.match(surfaceSource, /queueTrackStateTireEvents\(/);
  assert.match(simulationSource, /trackState\.advance\(/);
  assert.match(simulationSource, /queueTrackStateTireEvents/);
  assert.match(trackStateSource, /applyWeatherToCell\(/);
  assert.match(trackStateSource, /applyTireContactEvent\(/);
  assert.doesNotMatch(editorSource, /\bapplyWeatherToCell\(/);
  assert.doesNotMatch(editorSource, /\bapplyTireContactEvent\(/);
});
