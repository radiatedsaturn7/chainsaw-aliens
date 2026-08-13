import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PHYSICS_COST_COUNTER_NAMES,
  PHYSICS_COST_TIMER_NAMES
} from '../../src/racing/simulation/PhysicsCostAccounting.js';

const BASELINE = JSON.parse(readFileSync(
  new URL('../fixtures/studioSprint2PhysicsPerformanceBaseline.json', import.meta.url),
  'utf8'
));
const OPTIMIZED = JSON.parse(readFileSync(
  new URL('../fixtures/studioSprint2PhysicsPerformanceOptimized.json', import.meta.url),
  'utf8'
));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

test('Studio Sprint2 performance baseline uses exact saved terrain and WRX2 sources', () => {
  assert.match(BASELINE.environment.node, /^v\d+/);
  assert.equal(typeof BASELINE.environment.platform, 'string');
  assert.equal(typeof BASELINE.environment.architecture, 'string');
  assert.equal(BASELINE.source.mockedTerrain, false);
  assert.equal(BASELINE.source.raceName, 'Studio Sprint2');
  assert.equal(BASELINE.source.carName, '2022 Subaru WRX2');
  assert.equal(BASELINE.source.raceDocumentSha256, sha256(BASELINE.source.racePath));
  assert.equal(BASELINE.source.carDocumentSha256, sha256(BASELINE.source.carPath));
  assert.ok(BASELINE.source.preparedTriangleCount > 50000);
  assert.deepEqual(BASELINE.settings.renderFpsValues, [30, 60, 90, 120, 144]);
  assert.equal(BASELINE.settings.physicsIncidentRecording, false);
  assert.equal(BASELINE.settings.physicsSurfaceDebug, false);
  assert.equal(BASELINE.settings.telemetryRetention, 'transient');
  assert.ok(BASELINE.settings.totalSecondsPerFps >= 10);
});

test('Studio Sprint2 baseline covers required terrain sections, timers, and query counters', () => {
  assert.deepEqual(BASELINE.sections.map(({ id }) => id), [
    'flat-road',
    'smooth-hill',
    'crest',
    'loose-terrain',
    'underbody-scrape',
    'jump'
  ]);
  BASELINE.requiredTimers.forEach((name) => assert.ok(
    PHYSICS_COST_TIMER_NAMES.includes(name), `baseline timer was removed: ${name}`
  ));
  BASELINE.requiredCounters.forEach((name) => assert.ok(
    PHYSICS_COST_COUNTER_NAMES.includes(name), `baseline counter was removed: ${name}`
  ));
  assert.equal(BASELINE.runs.length, 5);
  BASELINE.runs.forEach((run) => {
    assert.ok(run.simulatedSeconds >= 10, `${run.fps} FPS duration`);
    assert.equal(run.sections.length, 6);
    BASELINE.requiredTimers.forEach((name) => assert.ok(
      Object.hasOwn(run.timers, name), `${run.fps} FPS missing timer ${name}`
    ));
    BASELINE.requiredCounters.forEach((name) => assert.ok(
      Object.hasOwn(run.counters, name), `${run.fps} FPS missing counter ${name}`
    ));
    [
      'physicsGeometryPointsQueried',
      'routeProjections',
      'bakedTriangleBucketLookups',
      'preparedTrianglesVisited',
      'wheelCylinderActivationPoints',
      'wheelCylinderFeatures',
      'triangleIntersectionTests',
      'environmentProviderCalls',
      'completedSteps',
      'completedTireSubsteps',
      'temporaryObjects'
    ].forEach((name) => assert.ok(run.counters[name] > 0, (
      `${run.fps} FPS counter ${name} did not exercise the real query path`
    )));
    assert.equal(typeof run.finalChecksum, 'string');
    assert.ok(run.topSubsystems.length >= 5);
    assert.ok(run.sections.find(({ id }) => id === 'underbody-scrape')
      ?.observedBodyContactFrames > 0, `${run.fps} FPS did not exercise body contact`);
    assert.ok(run.sections.find(({ id }) => id === 'jump')
      ?.observedAirborneFrames > 0, `${run.fps} FPS did not exercise airborne jump work`);
  });
});

test('realtime and high-fidelity reports retain their independent deterministic contracts', () => {
  assert.equal(OPTIMIZED.source.raceDocumentSha256, BASELINE.source.raceDocumentSha256);
  assert.equal(OPTIMIZED.source.carDocumentSha256, BASELINE.source.carDocumentSha256);
  assert.equal(OPTIMIZED.source.preparedTriangleCount, BASELINE.source.preparedTriangleCount);
  assert.deepEqual(OPTIMIZED.settings.renderFpsValues, BASELINE.settings.renderFpsValues);
  assert.equal(BASELINE.settings.physicsQualityProfile, 'realtime');
  assert.equal(BASELINE.settings.chassisHz, 120);
  assert.equal(BASELINE.settings.tireHz, 120);
  assert.equal(OPTIMIZED.settings.chassisHz, 120);
  assert.equal(OPTIMIZED.settings.tireHz, 360);
  assert.equal(OPTIMIZED.settings.physicsIncidentRecording, false);
  assert.equal(OPTIMIZED.settings.physicsSurfaceDebug, false);

  const expectedHighFidelityChecksums = new Map([
    [30, '7c88be69'],
    [60, '27f163c0'],
    [90, '1e05ba89'],
    [120, 'ad803f7a'],
    [144, 'a4111a0a']
  ]);
  const expectedRealtimeChecksums = new Map([
    [30, 'fadc6ba2'],
    [60, 'f5bf5472'],
    [90, 'd962f35b'],
    [120, 'e273106e'],
    [144, 'eca2716e']
  ]);

  OPTIMIZED.runs.forEach((run) => {
    assert.equal(run.counters.terrainQueryFrameOutOfBoundsQueries, 0);
    assert.equal(run.counters.recoveryRecalculations, 0);
    assert.equal(run.recovery.count, 0);
    assert.equal(run.peakBacklogSteps, 0);
    assert.equal(run.finalStepIndex, 1440);
    assert.equal(run.finalChecksum, expectedHighFidelityChecksums.get(run.fps));
  });
  BASELINE.runs.forEach((run) => {
    assert.equal(run.counters.terrainQueryFrameOutOfBoundsQueries, 0);
    assert.equal(run.counters.recoveryRecalculations, 0);
    assert.equal(run.recovery.count, 0);
    assert.equal(run.peakBacklogSteps, 0);
    assert.equal(run.finalStepIndex, 1440);
    assert.equal(run.counters.completedTireSubsteps, run.counters.completedSteps);
    assert.ok(run.counters.terrainQueryFrames >= run.counters.completedSteps);
    assert.ok(run.counters.terrainQueryFrames <= run.counters.completedSteps * 1.12);
    assert.equal(run.finalChecksum, expectedRealtimeChecksums.get(run.fps));
  });
});

test('designated reference captures enforce the 60 FPS p95 target', () => {
  const run = BASELINE.runs.find(({ fps }) => fps === 60);
  assert.ok(run);
  assert.equal(run.peakBacklogSteps, 0);
  if (BASELINE.environment.designatedReferenceMachine === true) {
    assert.equal(BASELINE.workerMigrationQualification?.qualified, true);
    assert.ok(BASELINE.workerMigrationQualification.p95StepMs
      <= BASELINE.workerMigrationQualification.stepBudgetMs);
  } else {
    // The committed capture is an Android/Termux operation-count acceptance
    // report. Absolute wall time remains a separately marked reference-host
    // measurement rather than pretending this handset is that machine.
    assert.equal(BASELINE.environment.platform, 'android');
  }
});
