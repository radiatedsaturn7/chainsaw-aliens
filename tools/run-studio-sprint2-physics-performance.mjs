import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import RaceEditor from '../src/ui/RaceEditor.js';
import {
  PHYSICS_COST_COUNTER_NAMES,
  PHYSICS_COST_TIMER_NAMES
} from '../src/racing/simulation/PhysicsCostAccounting.js';
import {
  hashTrackStateValue,
  stableTrackStateStringify
} from '../src/racing/trackState/TrackStateMath.js';
import { createVehicleDynamicsWorkerQualificationFromReport } from '../src/racing/simulation/VehicleDynamicsWorkerClient.js';

const DEFAULT_RACE_PATH = 'tests/fixtures/studioSprint2PerformanceRaceDocument.json';
const DEFAULT_CAR_PATH = 'data/server-storage/files/cars/2022 Subaru WRX2/document.json';
const DEFAULT_OUTPUT_PATH = 'tests/fixtures/studioSprint2PhysicsPerformanceBaseline.json';
const FPS_VALUES = Object.freeze([30, 60, 90, 120, 144]);
const DEFAULT_SECTION_SECONDS = 2;
const WHEEL_IDS = Object.freeze(['fl', 'fr', 'rl', 'rr']);
const SECTIONS = Object.freeze([
  { id: 'flat-road', distanceM: 70, speedMps: 16, throttle: 0.18 },
  { id: 'smooth-hill', distanceM: 215, speedMps: 17, throttle: 0.22 },
  { id: 'crest', distanceM: 292, speedMps: 21, throttle: 0.12 },
  { id: 'loose-terrain', distanceM: 370, speedMps: 17, throttle: 0.22 },
  { id: 'underbody-scrape', distanceM: 472, speedMps: 25, throttle: 0.2 },
  { id: 'jump', distanceM: 500, speedMps: 20, throttle: 0.12 }
]);

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function decodeDocument(path) {
  const bytes = readFileSync(path);
  const envelope = JSON.parse(bytes.toString('utf8'));
  return {
    bytes,
    document: envelope?.__chainsawStorage === 'compact-v1'
      ? JSON.parse(gunzipSync(Buffer.from(envelope.data, 'base64')).toString('utf8'))
      : envelope,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function mergeRecord(aggregate, record) {
  if (!record) return;
  aggregate.frameCount += 1;
  aggregate.physicsUpdateMs.push(Number(
    record.timings?.raceSimulationVehicleAuthorityUpdate?.inclusiveMs
      ?? record.elapsedMs
      ?? 0
  ));
  Object.entries(record.timings || {}).forEach(([name, timing]) => {
    const target = aggregate.timings[name] || {
      inclusiveMs: 0,
      exclusiveMs: 0,
      calls: 0
    };
    target.inclusiveMs += Number(timing.inclusiveMs || 0);
    target.exclusiveMs += Number(timing.exclusiveMs || 0);
    target.calls += Number(timing.calls || 0);
    aggregate.timings[name] = target;
  });
  Object.entries(record.counters || {}).forEach(([name, value]) => {
    aggregate.counters[name] = Number(aggregate.counters[name] || 0) + Number(value || 0);
  });
  aggregate.peakBacklogSteps = Math.max(
    aggregate.peakBacklogSteps,
    Number(record.counters?.backlogSteps || 0)
  );
}

function beginAggregate() {
  return {
    frameCount: 0,
    physicsUpdateMs: [],
    physicsStepMs: [],
    physicsStepRecords: [],
    timings: {},
    counters: {},
    peakBacklogSteps: 0
  };
}

function summarizeAggregate(aggregate) {
  const frameDivisor = Math.max(1, aggregate.frameCount);
  const timers = Object.fromEntries(PHYSICS_COST_TIMER_NAMES.map((name) => {
    const timer = aggregate.timings[name] || {};
    return [name, {
      inclusiveTotalMs: round(timer.inclusiveMs),
      exclusiveTotalMs: round(timer.exclusiveMs),
      inclusiveMeanMsPerFrame: round(Number(timer.inclusiveMs || 0) / frameDivisor),
      exclusiveMeanMsPerFrame: round(Number(timer.exclusiveMs || 0) / frameDivisor),
      calls: Math.round(Number(timer.calls || 0))
    }];
  }));
  const topSubsystems = Object.entries(timers)
    .filter(([name]) => name !== 'raceSimulationVehicleAuthorityUpdate')
    .sort((left, right) => (
      right[1].inclusiveTotalMs - left[1].inclusiveTotalMs
        || left[0].localeCompare(right[0])
    ))
    .slice(0, 5)
    .map(([name, timing]) => ({ name, ...timing }));
  const slowestPhysicsSteps = [...aggregate.physicsStepRecords]
    .sort((left, right) => right.elapsedMs - left.elapsedMs)
    .slice(0, 10)
    .map((record) => ({
      stepIndex: Math.max(0, Math.trunc(Number(record.metadata?.stepIndex || 0))),
      elapsedMs: round(record.elapsedMs),
      backlogSteps: Math.max(0, Math.trunc(Number(record.metadata?.backlogSteps || 0))),
      topSubsystems: Object.entries(record.timings || {})
        .sort((left, right) => (
          Number(right[1]?.inclusiveMs || 0) - Number(left[1]?.inclusiveMs || 0)
        ))
        .slice(0, 5)
        .map(([name, timing]) => ({
          name,
          inclusiveMs: round(timing.inclusiveMs),
          exclusiveMs: round(timing.exclusiveMs),
          calls: Math.round(Number(timing.calls || 0))
        }))
    }));
  return {
    renderFrames: aggregate.frameCount,
    physicsUpdateMs: {
      p50: round(percentile(aggregate.physicsUpdateMs, 0.5)),
      p95: round(percentile(aggregate.physicsUpdateMs, 0.95)),
      p99: round(percentile(aggregate.physicsUpdateMs, 0.99)),
      maximum: round(Math.max(0, ...aggregate.physicsUpdateMs))
    },
    physicsStepMs: {
      p50: round(percentile(aggregate.physicsStepMs, 0.5)),
      p95: round(percentile(aggregate.physicsStepMs, 0.95)),
      p99: round(percentile(aggregate.physicsStepMs, 0.99)),
      maximum: round(Math.max(0, ...aggregate.physicsStepMs))
    },
    slowestPhysicsSteps,
    peakBacklogSteps: aggregate.peakBacklogSteps,
    topSubsystems,
    timers,
    counters: Object.fromEntries(PHYSICS_COST_COUNTER_NAMES.map((name) => [
      name,
      Math.round(Number(aggregate.counters[name] || 0))
    ]))
  };
}

function setSectionInitialState(editor, section) {
  editor.applyRaceCarRouteCenterReset({
    projection: { distance: section.distanceM },
    preserveMotion: false
  });
  const session = editor.playtestSession;
  const runner = session.vehicleDynamicsRunner;
  const state = runner.createStateSnapshot();
  const yaw = Number(state.yawRad || session.carYaw || 0);
  const speedMps = Number(section.speedMps || 0);
  const velocity = {
    x: Math.sin(yaw) * speedMps,
    y: 0,
    z: Math.cos(yaw) * speedMps
  };
  runner.replaceAuthoritativeState({
    ...state,
    velocity,
    speedMps,
    groundSpeedMps: speedMps,
    bodyLongitudinalSpeedMps: speedMps,
    bodyLateralSpeedMps: 0,
    signedTravelSpeedMps: speedMps,
    wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId,
      speedMps / runner.config.wheelRadiusM
    ])),
    gear: 3,
    engineRpm: 2800,
    powertrainState: {
      ...state.powertrainState,
      gear: 3,
      engineRpm: 2800
    }
  });
  Object.assign(session, {
    speedMps,
    groundSpeedMps: speedMps,
    bodyLongitudinalSpeedMps: speedMps,
    bodyLateralSpeedMps: 0,
    signedTravelSpeedMps: speedMps,
    velocityYaw: yaw,
    gear: 3,
    engineRpm: 2800
  });
  Object.assign(editor.raceInput, {
    keyboardThrottle: false,
    keyboardBrake: false,
    rawThrottleAxis: section.throttle,
    rawBrakeAxis: 0,
    analogThrottleActive: true,
    analogBrakeActive: false,
    analogSteeringActive: false,
    analogSteeringIntent: 0,
    syntheticAnalogSteering: false,
    keyboardSteer: 0,
    steeringTarget: 0,
    steeringWheel: 0,
    gear: 3,
    autoShift: false,
    paused: false
  });
}

function checksumRun(editor) {
  const runner = editor.playtestSession.vehicleDynamicsRunner;
  return hashTrackStateValue(stableTrackStateStringify({
    stepIndex: runner.stepIndex,
    state: runner.createStateSnapshot(),
    trackStateChecksum: editor.playtestSession.trackState?.getChecksum?.() || null,
    recoveryHistory: runner.penetrationRecoveryState?.history || []
  }));
}

function runAtFps({ editor, worldBake, fps, sectionSeconds, physicsSurfaceDebug = false }) {
  const aggregate = beginAggregate();
  const sections = [];
  let recoveryCount = 0;
  let lastRecoveryReason = null;
  let completedStepCount = 0;
  SECTIONS.forEach((section) => {
    editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
      hydrateCars: false,
      preparedWorldBake: worldBake
    });
    const session = editor.playtestSession;
    session.countdownRemainingMs = 0;
    session.startupFramePending = false;
    editor.raceInput.physicsSurfaceVisible = physicsSurfaceDebug;
    editor.raceInput.physicsPerformanceVisible = true;
    editor.raceInput.telemetryVisible = false;
    session.physicsSurfaceVisible = physicsSurfaceDebug;
    session.physicsPerformanceVisible = true;
    session.telemetryVisible = false;
    if (!editor.updatePlaytestSafely(0)) {
      throw new Error(`Studio Sprint2 authority initialization failed at ${fps} FPS`);
    }
    const runner = session.vehicleDynamicsRunner;
    if (!runner) throw new Error('VehicleDynamicsRunner was not created for the acceptance fixture');
    if (runner.config.physicsIncidentRecordingEnabled) {
      throw new Error('Performance acceptance must run with incident recording disabled');
    }
    if (runner.config.telemetryRetention !== 'transient') {
      throw new Error(`Expected normal transient telemetry, received ${runner.config.telemetryRetention}`);
    }
    runner.physicsCostAccounting.detailedStepRecords = false;
    runner.physicsCostAccounting.stepHistoryMode = 'elapsed-ring';
    setSectionInitialState(editor, section);
    runner.physicsCostAccounting.reset();
    const frames = Math.round(sectionSeconds * fps);
    const sectionAggregate = beginAggregate();
    const beforeCounters = { ...aggregate.counters };
    let lastSequence = null;
    let observedBodyContactFrames = 0;
    let observedAirborneFrames = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      if (!editor.updatePlaytestSafely(1 / fps)) {
        throw new Error(`${section.id} failed at ${fps} FPS frame ${frame}`);
      }
      const frameRecord = runner.physicsCostAccounting.getLatestFrame();
      const sequence = frameRecord?.metadata?.sequence;
      if (sequence !== null && sequence !== undefined && sequence !== lastSequence) {
        mergeRecord(aggregate, frameRecord);
        mergeRecord(sectionAggregate, frameRecord);
        lastSequence = sequence;
      }
      if (runner.state.bodyGrounded) observedBodyContactFrames += 1;
      if (!runner.state.wheelGrounded && !runner.state.bodyGrounded) observedAirborneFrames += 1;
    }
    const stepSamples = runner.physicsCostAccounting.appendStepElapsedHistory([]);
    aggregate.physicsStepMs.push(...stepSamples);
    sectionAggregate.physicsStepMs.push(...stepSamples);
    const sectionCounters = Object.fromEntries(PHYSICS_COST_COUNTER_NAMES.map((name) => [
      name,
      Math.round(Number(aggregate.counters[name] || 0) - Number(beforeCounters[name] || 0))
    ]));
    const sectionChecksum = checksumRun(editor);
    const sectionSummary = summarizeAggregate(sectionAggregate);
    sections.push({
      id: section.id,
      startDistanceM: section.distanceM,
      startSpeedMps: section.speedMps,
      simulatedSeconds: frames / fps,
      renderFrames: frames,
      physicsUpdateMs: sectionSummary.physicsUpdateMs,
      physicsStepMs: sectionSummary.physicsStepMs,
      topSubsystems: sectionSummary.topSubsystems,
      timers: sectionSummary.timers,
      observedBodyContactFrames,
      observedAirborneFrames,
      counters: sectionCounters,
      finalChecksum: sectionChecksum,
      finalTrackStateChecksum: session.trackState?.getChecksum?.() || null
    });
    recoveryCount += runner.physicsCostAccounting.recoveryCount;
    lastRecoveryReason = runner.physicsCostAccounting.lastRecoveryReason || lastRecoveryReason;
    completedStepCount += runner.stepIndex;
    editor.endPlaytest();
    process.stderr.write(
      `Studio Sprint2 physics performance: ${fps} FPS ${section.id} complete `
        + `(${aggregate.frameCount} frames)\n`
    );
  });
  const summary = summarizeAggregate(aggregate);
  const report = {
    fps,
    simulatedSeconds: SECTIONS.length * Math.round(sectionSeconds * fps) / fps,
    ...summary,
    sections,
    recovery: {
      count: recoveryCount,
      lastReason: lastRecoveryReason
    },
    finalChecksum: hashTrackStateValue(stableTrackStateStringify(
      sections.map((section) => section.finalChecksum)
    )),
    finalStepIndex: completedStepCount,
    finalTrackStateChecksum: hashTrackStateValue(stableTrackStateStringify(
      sections.map((section) => section.finalTrackStateChecksum)
    ))
  };
  return report;
}

const racePath = readOption('--race', DEFAULT_RACE_PATH);
const carPath = readOption('--car', DEFAULT_CAR_PATH);
const outputPath = readOption('--output', DEFAULT_OUTPUT_PATH);
const physicsQualityProfile = readOption('--profile', 'realtime');
const requestedReferenceMachine = process.argv.includes('--reference-machine');
const referenceMachineId = String(readOption('--reference-machine-id', '')).trim();
const requireWorkerQualification = process.argv.includes('--require-worker-qualification');
const physicsSurfaceDebug = process.argv.includes('--physics-surface-debug');
const enforceBudgets = process.argv.includes('--enforce-budgets');
if (requestedReferenceMachine && !referenceMachineId) {
  throw new Error('--reference-machine requires a stable --reference-machine-id');
}
const designatedReferenceMachine = requestedReferenceMachine && Boolean(referenceMachineId);
const sectionSeconds = Math.max(1 / 30, Number(
  readOption('--section-seconds', DEFAULT_SECTION_SECONDS)
) || DEFAULT_SECTION_SECONDS);
const requestedFps = String(readOption('--fps', '')).split(',')
  .map((value) => Math.trunc(Number(value)))
  .filter((value) => FPS_VALUES.includes(value));
const activeFpsValues = requestedFps.length ? [...new Set(requestedFps)] : FPS_VALUES;
const raceSource = decodeDocument(racePath);
const carSource = decodeDocument(carPath);
globalThis.__RTG_PHYSICS_COST_ACCOUNTING__ = true;
globalThis.__RTG_VEHICLE_PHYSICS_QUALITY_PROFILE__ = physicsQualityProfile;
delete globalThis.__RTG_CAPTURE_PHYSICS_INCIDENTS__;

const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
if (!editor.applyLoadedRaceDocument(raceSource.document, { name: 'Studio Sprint2' })) {
  throw new Error('Studio Sprint2 race document could not be loaded');
}
if (!editor.applyLoadedCarDocument(carSource.document, { name: '2022 Subaru WRX2' })) {
  throw new Error('WRX2 car document could not be loaded');
}
const worldBake = editor.buildRaceWorldBake({ retainTerrainCells: false });
if (!worldBake?.surfaceSampler?.triangleCount) {
  throw new Error('Studio Sprint2 performance fixture requires the real prepared-world surface bake');
}

const runs = activeFpsValues.map((fps) => runAtFps({
  editor,
  worldBake,
  fps,
  sectionSeconds,
  physicsSurfaceDebug
}));
const resolvedPhysicsConfig = editor.vehicleDynamicsAuthority?.runner?.config || null;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  fixture: 'Studio Sprint2 / 2022 Subaru WRX2 physics performance acceptance',
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    designatedReferenceMachine,
    referenceMachineId: designatedReferenceMachine ? referenceMachineId : null
  },
  acceptanceTargets: {
    fullGeometryQueryReductionRatio: 0.8,
    temporaryObjectReductionRatio: 0.8,
    physicsP50MsAt60Fps: 4,
    physicsP95MsAt60Fps: 8,
    physicsP99MsAt60Fps: 16,
    zeroSteadyStateBacklogAt60Fps: true,
    zeroOrdinaryHillRecoveryRecalculations: true,
    maximumSmoothRoadWheelCcdActivationRatio: 0.01
  },
  source: {
    racePath,
    raceName: 'Studio Sprint2',
    raceDocumentSha256: raceSource.sha256,
    carPath,
    carName: '2022 Subaru WRX2',
    carDocumentSha256: carSource.sha256,
    preparedTriangleCount: worldBake.surfaceSampler.triangleCount,
    mockedTerrain: false
  },
  settings: {
    physicsQualityProfile,
    chassisHz: Number(resolvedPhysicsConfig?.chassisHz || 120),
    tireHz: Number(resolvedPhysicsConfig?.tireHz
      || (physicsQualityProfile === 'realtime' ? 120 : 360)),
    geometryHz: Number(resolvedPhysicsConfig?.geometryHz || 120),
    sectionSeconds,
    totalSecondsPerFps: SECTIONS.length * sectionSeconds,
    renderFpsValues: activeFpsValues,
    physicsIncidentRecording: false,
    physicsSurfaceDebug,
    telemetryRetention: 'transient',
    physicsCostAccounting: true,
    physicsStepAccounting: 'elapsed-and-backlog'
  },
  requiredTimers: PHYSICS_COST_TIMER_NAMES,
  requiredCounters: PHYSICS_COST_COUNTER_NAMES,
  sections: SECTIONS,
  runs
};
report.workerMigrationQualification = createVehicleDynamicsWorkerQualificationFromReport(report);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  outputPath,
  raceDocumentSha256: report.source.raceDocumentSha256,
  carDocumentSha256: report.source.carDocumentSha256,
  preparedTriangleCount: report.source.preparedTriangleCount,
  runs: runs.map((run) => ({
    fps: run.fps,
    p95Ms: run.physicsUpdateMs.p95,
    peakBacklogSteps: run.peakBacklogSteps,
    recoveryCount: run.recovery.count,
    topSubsystem: run.topSubsystems[0]?.name || null,
    checksum: run.finalChecksum
  }))
}, null, 2)}\n`);
if (requireWorkerQualification && report.workerMigrationQualification.qualified !== true) {
  process.stderr.write(
    `Vehicle dynamics worker qualification failed: ${
      report.workerMigrationQualification.reasons.join('; ')
    }\n`
  );
  process.exitCode = 1;
}
if (enforceBudgets) {
  const sixty = runs.find((run) => run.fps === 60);
  const failures = [];
  if (!sixty) failures.push('missing 60 FPS authority run');
  else {
    if (sixty.physicsUpdateMs.p50 >= report.acceptanceTargets.physicsP50MsAt60Fps) failures.push(`p50 ${sixty.physicsUpdateMs.p50} ms`);
    if (sixty.physicsUpdateMs.p95 >= report.acceptanceTargets.physicsP95MsAt60Fps) failures.push(`p95 ${sixty.physicsUpdateMs.p95} ms`);
    if (sixty.physicsUpdateMs.p99 >= report.acceptanceTargets.physicsP99MsAt60Fps) failures.push(`p99 ${sixty.physicsUpdateMs.p99} ms`);
    if (sixty.peakBacklogSteps > 0) failures.push(`backlog ${sixty.peakBacklogSteps} steps`);
    if (sixty.recovery.count > 0) failures.push(`recoveries ${sixty.recovery.count}`);
  }
  if (failures.length) {
    process.stderr.write(`Studio Sprint2 performance budget failed: ${failures.join('; ')}\n`);
    process.exitCode = 1;
  }
}
