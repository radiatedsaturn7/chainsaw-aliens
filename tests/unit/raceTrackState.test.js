import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';

import {
  TRACK_STATE_EVENT_HISTORY_LIMIT,
  TrackState
} from '../../src/racing/trackState/TrackState.js';
import {
  TRACK_STATE_SURFACE_PROFILES,
  getTrackStateSurfaceProfile
} from '../../src/racing/trackState/TrackStateProfiles.js';

const baseSampler = ({ x = 0, z = 0 } = {}) => ({
  baseSurfaceId: 'asphalt',
  materialId: 'asphalt',
  region: 'road',
  elevationM: x < 1 ? 2 : x < 2 ? 1 : 0,
  normal: { x: 0, y: 1, z: 0 },
  friction: 1,
  drainageRateMmPerS: x < 1 ? 0.05 : 0.01,
  sunExposure: z < 1 ? 1 : 0.2,
  windExposure: z < 1 ? 0.8 : 0.1
});

const createState = (options = {}) => new TrackState({
  seed: 42,
  sampleBaseSurface: baseSampler,
  ...options
});

test('Track State cells persist every required independent field at one-meter resolution', () => {
  const state = createState();
  const first = state.sample({ x: 0.2, z: 0.8 });
  const same = state.sample({ x: 0.9, z: 0.1 });
  const next = state.sample({ x: 1.01, z: 0.1 });
  assert.equal(first.cellKey, '0,0');
  assert.equal(same.cellKey, first.cellKey);
  assert.equal(next.cellKey, '1,0');
  [
    'surfaceTemperatureC',
    'moistureDepthMm',
    'standingWaterDepthMm',
    'rubber',
    'looseMarbles',
    'dust',
    'dirt',
    'mud',
    'oil',
    'snowDepthMm',
    'iceDepthMm',
    'roughness',
    'drainageRateMmPerS',
    'sunExposure',
    'windExposure'
  ].forEach((field) => assert.equal(Number.isFinite(first.cell[field]), true, field));
});

test('all supported base materials resolve through the same data-driven profile contract', () => {
  [
    'asphalt',
    'wet-asphalt',
    'dirt',
    'gravel',
    'wet-gravel',
    'mud',
    'snow',
    'slush',
    'grass',
    'generic'
  ].forEach((surfaceId) => {
    const profile = getTrackStateSurfaceProfile(surfaceId, surfaceId);
    assert.equal(profile.id, surfaceId);
    assert.equal(Number.isFinite(profile.grip), true);
    assert.equal(Number.isFinite(profile.rollingResistance), true);
    assert.equal(Number.isFinite(profile.drainageRateMmPerS), true);
    Object.keys({ ...TRACK_STATE_SURFACE_PROFILES.generic, id: 'generic' }).forEach((field) => {
      assert.ok(Object.hasOwn(profile, field), `${surfaceId}.${field}`);
    });
  });

  const configured = createState({
    profileOverrides: {
      asphalt: { roughness: 0.42, drainageRateMmPerS: 0.123 }
    }
  });
  const restored = TrackState.fromSnapshot(configured.createSnapshot(), {
    sampleBaseSurface: ({ x = 0, z = 0 } = {}) => ({
      ...baseSampler({ x, z }),
      roughness: undefined,
      drainageRateMmPerS: undefined
    })
  });
  const configuredCell = restored.sample({ x: 10.2, z: 10.2 }).cell;
  assert.equal(configuredCell.roughness, 0.42);
  assert.equal(configuredCell.drainageRateMmPerS, 0.123);
});

test('dry rubber gains grip while wet rubber becomes comparatively slippery', () => {
  const dry = createState();
  dry.mutateCell({ x: 0, z: 0 }, { rubber: 0.9 });
  const dryRubbered = dry.sample({ x: 0.2, z: 0.2 });
  const dryPlain = dry.sample({ x: 1.2, z: 0.2 });
  assert.ok(dryRubbered.effectiveGrip > dryPlain.effectiveGrip);

  const wet = createState();
  wet.mutateCell({ x: 0, z: 0 }, { rubber: 0.9, standingWaterDepthMm: 2.5, moistureDepthMm: 1 });
  wet.mutateCell({ x: 1, z: 0 }, { standingWaterDepthMm: 2.5, moistureDepthMm: 1 });
  assert.ok(wet.sample({ x: 0.2, z: 0.2 }).effectiveGrip < wet.sample({ x: 1.2, z: 0.2 }).effectiveGrip);
});

test('every loose or contaminated field independently affects grip and rolling resistance', () => {
  const fields = [
    'standingWaterDepthMm',
    'looseMarbles',
    'dust',
    'dirt',
    'mud',
    'oil',
    'snowDepthMm',
    'iceDepthMm',
    'roughness',
    'debris'
  ];
  fields.forEach((field) => {
    const state = createState();
    const baseline = state.sample({ x: 0.2, z: 0.2 });
    state.mutateCell({ x: 0, z: 0 }, { [field]: field.endsWith('DepthMm') ? 4 : 0.8 });
    const changed = state.sample({ x: 0.2, z: 0.2 });
    assert.notEqual(
      changed.rollingResistanceMultiplier,
      baseline.rollingResistanceMultiplier,
      field
    );
    assert.notEqual(changed.effectiveGrip, baseline.effectiveGrip, field);
  });
});

test('rubber deposition responds to tire compound, speed, load, slip, and distance', () => {
  const run = (overrides = {}) => {
    const state = createState();
    state.queueTireContact({
      vehicleId: 'car',
      wheelId: 'rl',
      position: { x: 0.2, z: 0.2 },
      grounded: true,
      contactScale: 1,
      normalLoadN: 4000,
      speedMps: 24,
      distanceM: 1,
      slipEnergy: 0.8,
      compoundId: 'tarmac',
      tireTemperatureF: 100,
      ...overrides
    });
    state.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
    return state.sample({ x: 0.2, z: 0.2 }).cell.rubber;
  };
  const baseline = run();
  assert.ok(run({ compoundId: 'drift' }) > baseline);
  assert.ok(run({ compoundId: 'snow' }) < baseline);
  assert.ok(run({ speedMps: 4 }) < baseline);
  assert.ok(run({ normalLoadN: 1800 }) < baseline);
  assert.ok(run({ slipEnergy: 0.05 }) < baseline);
  assert.ok(run({ distanceM: 0.2 }) < baseline);
});

test('weather evolves cells independently and downhill flow conserves water', () => {
  const state = createState();
  state.sample({ x: 0.2, z: 0.2 });
  state.sample({ x: 1.2, z: 0.2 });
  state.sample({ x: 2.2, z: 0.2 });
  const before = state.getConservationTotals().storedWaterMm;
  for (let index = 0; index < 30; index += 1) {
    state.advance(0.1, {
      type: 'rain',
      precipitationRateMmPerS: 0.8,
      ambientTemperatureC: 14,
      sunIntensity: 0,
      windIntensity: 0.25,
      humidity: 0.92
    });
  }
  const after = state.getConservationTotals();
  const expected = before + after.precipitationMm - after.drainageMm - after.evaporationMm;
  assert.ok(Math.abs(after.storedWaterMm - expected) <= Math.max(0.001, expected * 0.001));
  assert.ok(state.getCell({ x: 2, z: 0 }).standingWaterDepthMm > 0);
  assert.notEqual(
    state.getCell({ x: 0, z: 0 }).surfaceTemperatureC,
    state.getCell({ x: 0, z: 1 }, { create: true }).surfaceTemperatureC
  );
});

test('snow, ice, and melt transitions remain non-negative and mass-accounted', () => {
  const state = createState();
  state.sample({ x: 0.2, z: 0.2 });
  for (let index = 0; index < 50; index += 1) {
    state.advance(0.1, {
      type: 'snow',
      precipitationRateMmPerS: 0.5,
      ambientTemperatureC: -7,
      sunIntensity: 0,
      windIntensity: 0.15,
      humidity: 0.8
    });
  }
  const frozen = state.getCell({ x: 0, z: 0 });
  const frozenSnowDepthMm = frozen.snowDepthMm;
  assert.ok(frozen.snowDepthMm + frozen.iceDepthMm > 0);
  for (let index = 0; index < 100; index += 1) {
    state.advance(0.1, {
      type: 'clear',
      precipitationRateMmPerS: 0,
      ambientTemperatureC: 22,
      sunIntensity: 1,
      windIntensity: 0.6,
      humidity: 0.25
    });
  }
  const melted = state.getCell({ x: 0, z: 0 });
  ['moistureDepthMm', 'standingWaterDepthMm', 'snowDepthMm', 'iceDepthMm'].forEach((field) => {
    assert.ok(melted[field] >= 0, field);
  });
  assert.ok(melted.snowDepthMm < frozenSnowDepthMm);
});

test('10,000 ordered events, snapshots, restore, and sync packets are deterministic', () => {
  const left = createState();
  const right = createState();
  for (let index = 0; index < 10000; index += 1) {
    const event = {
      type: 'tire-contact',
      stepIndex: Math.floor(index / 20) + 1,
      sequence: index + 1,
      vehicleId: `car-${index % 3}`,
      wheelId: ['fl', 'fr', 'rl', 'rr'][index % 4],
      x: (index % 25) + 0.25,
      z: (Math.floor(index / 25) % 10) + 0.25,
      payload: {
        grounded: true,
        distanceM: 0.25,
        normalLoadN: 3500,
        slipEnergy: (index % 7) * 0.1,
        speedMps: 18,
        directionX: 1,
        directionZ: 0,
        compoundId: 'tarmac'
      }
    };
    left.queueEvent(event);
    right.queueEvent({ ...event, payload: { ...event.payload } });
  }
  for (let index = 0; index < 501; index += 1) {
    const forcing = {
      type: index % 4 ? 'clear' : 'rain',
      precipitationRateMmPerS: index % 4 ? 0 : 0.12,
      ambientTemperatureC: 18,
      sunIntensity: 0.4,
      windIntensity: 0.2,
      humidity: 0.5
    };
    left.advance(0.1, forcing);
    right.advance(0.1, forcing);
  }
  assert.equal(left.getChecksum(), right.getChecksum());
  assert.deepEqual(left.createSnapshot(), right.createSnapshot());

  const restored = TrackState.fromSnapshot(left.createSnapshot(), { sampleBaseSurface: baseSampler });
  assert.equal(restored.getChecksum(), left.getChecksum());
  for (let index = 0; index < 5000; index += 1) {
    const event = {
      type: 'crash-debris',
      stepIndex: left.stepIndex + 1 + Math.floor(index / 50),
      sequence: 20001 + index,
      vehicleId: 'crash-car',
      x: index % 12,
      z: Math.floor(index / 12) % 8,
      payload: { debris: 0.0005, oil: index % 9 === 0 ? 0.0001 : 0 }
    };
    left.queueEvent(event);
    restored.queueEvent(event);
  }
  for (let index = 0; index < 101; index += 1) {
    left.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
    restored.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
  }
  assert.equal(restored.getChecksum(), left.getChecksum());

  const packet = left.createSyncPacket('events', {
    sinceSequence: left.historyBaseSequence
  });
  const replica = createState();
  const firstApply = replica.applySyncPacket(left.createSyncPacket('snapshot'));
  const duplicateApply = replica.applySyncPacket(packet);
  assert.equal(firstApply.applied, true);
  assert.equal(duplicateApply.duplicateCount >= 0, true);
  assert.equal(replica.applySyncPacket(left.createSyncPacket('checksum')).matches, true);

  const replay = left.createReplayRecord();
  const replayFinal = TrackState.fromSnapshot(replay.finalSnapshot, { sampleBaseSurface: baseSampler });
  assert.equal(replayFinal.getChecksum(), replay.finalChecksum);
  assert.deepEqual(replay.weatherTimeline, [...left.weatherTimeline.entries()]);
});

test('fixed-step work is bounded and inactive world regions stay sparse', () => {
  const state = createState({ maxCatchUpSteps: 5 });
  state.sample({ x: 0, z: 0 });
  const result = state.advance(2, { type: 'storm', precipitationRateMmPerS: 1 });
  assert.equal(result.completedSteps, 5);
  assert.equal(result.catchUpRemaining, true);
  assert.ok(state.cells.size < 64);
  assert.ok(result.processedCellCount < 320);
});

test('repeated tire observations aggregate without consuming event sequences', () => {
  const state = createState();
  const contact = {
    vehicleId: 'car-1',
    wheelId: 'fl',
    position: { x: 0.2, z: 0.2 },
    previousPosition: { x: 0.1, z: 0.2 },
    normalLoadN: 3500,
    speedMps: 20,
    slipEnergy: 0.4
  };
  assert.equal(state.queueTireContact(contact).length, 1);
  const checksumBeforeDuplicate = state.getChecksum();
  const sequenceBeforeDuplicate = state.nextSequence;
  assert.equal(state.queueTireContact(contact).length, 1);
  assert.equal(state.nextSequence, sequenceBeforeDuplicate);
  assert.notEqual(state.getChecksum(), checksumBeforeDuplicate);
  state.advance(0.1, { type: 'clear' });
  assert.equal(state.eventHistory.length, 1);
  assert.equal(state.nextSequence, 2);
  assert.equal(state.eventHistory[0].payload.distanceM, 0.2);
  assert.equal(state.queueTireContact(contact).length, 1);
});

test('one-hour 20-car moving race keeps history, weather, queues, snapshots, and steps bounded', () => {
  const state = createState({
    cellSizeM: 5,
    maxCatchUpSteps: 10,
    eventHistoryLimit: TRACK_STATE_EVENT_HISTORY_LIMIT,
    maxCellsPerStep: 64
  });
  let maximumAdvanceMs = 0;
  const trackX = (second) => {
    const phase = second % 50;
    return phase <= 25 ? phase * 4 : (50 - phase) * 4;
  };
  for (let second = 0; second < 3600; second += 1) {
    for (let vehicle = 0; vehicle < 20; vehicle += 1) {
      for (let wheel = 0; wheel < 4; wheel += 1) {
        state.queueTireContact({
          vehicleId: `vehicle-${vehicle}`,
          wheelId: `wheel-${wheel}`,
          previousPosition: { x: trackX(second) + vehicle * 0.02, z: wheel + 0.2 },
          position: { x: trackX(second + 1) + vehicle * 0.02, z: wheel + 0.2 },
          contactDurationSeconds: 0.1,
          normalLoadN: 3300 + wheel * 120,
          speedMps: 40,
          slipEnergy: 0.2 + vehicle % 4 * 0.1,
          wheelSpin: vehicle % 7 === 0 ? 0.6 : 0,
          brakeLock: vehicle % 11 === 0 ? 0.4 : 0
        });
      }
    }
    if (second % 60 === 0) {
      state.queueCrashContamination({
        vehicleId: `vehicle-${second % 20}`,
        x: trackX(second),
        z: second % 4,
        debris: 0.04,
        oil: second % 120 === 0 ? 0.02 : 0
      });
    }
    const start = performance.now();
    const result = state.advance(1, second % 1200 < 600
      ? { type: 'rain', precipitationRateMmPerS: 0.15, ambientTemperatureC: 16 }
      : { type: 'clear', ambientTemperatureC: 24, sunIntensity: 0.85 });
    maximumAdvanceMs = Math.max(
      maximumAdvanceMs,
      (performance.now() - start) / Math.max(1, result.completedSteps)
    );
    assert.equal(state.pendingEvents.length, 0);
    assert.equal(state.contactAccumulator.size, 0);
  }
  assert.equal(state.stepIndex, 36000);
  assert.ok(state.eventHistory.length < TRACK_STATE_EVENT_HISTORY_LIMIT);
  assert.ok(state.eventIds.size <= TRACK_STATE_EVENT_HISTORY_LIMIT);
  assert.ok(state.historyBaseStepIndex > 0);
  assert.ok(state.historyBaseSequence > 0);
  assert.ok(state.weatherTimeline.size <= 2);
  assert.ok(JSON.stringify(state.createSnapshot()).length < 8_000_000);
  assert.ok(maximumAdvanceMs < 50, `Track State fixed step exceeded 50 ms: ${maximumAdvanceMs} ms`);
});

test('duplicate finalized events do not alter sequence or checksum state', () => {
  const state = createState();
  const event = state.queueEvent({
    type: 'crash-debris',
    stepIndex: 1,
    vehicleId: 'car',
    x: 1.2,
    z: 2.2,
    payload: { debris: 0.1 }
  });
  const sequence = state.nextSequence;
  const checksum = state.getChecksum();
  assert.equal(state.queueEvent(event), null);
  assert.equal(state.nextSequence, sequence);
  assert.equal(state.getChecksum(), checksum);
});

test('checkpoint replay reconstructs exactly and stale sync requests require snapshots', () => {
  const state = createState({ eventHistoryLimit: 100 });
  for (let step = 0; step < 250; step += 1) {
    state.queueTireContact({
      vehicleId: 'car',
      wheelId: 'fl',
      position: { x: (step % 12) + 0.2, z: 0.2 },
      previousPosition: { x: (step % 12) + 0.1, z: 0.2 },
      distanceM: 0.1,
      contactDurationSeconds: 0.1,
      normalLoadN: 3400,
      speedMps: 18,
      slipEnergy: 0.4
    });
    state.advance(0.1, step < 150
      ? { type: 'rain', precipitationRateMmPerS: 0.3, ambientTemperatureC: 16 }
      : { type: 'clear', ambientTemperatureC: 22, sunIntensity: 0.8 });
  }
  const replay = state.createReplayRecord();
  assert.ok(replay.historyBaseStepIndex > 0);
  assert.ok(replay.events.length < 100);
  assert.ok(replay.weatherTimeline.length <= 2);

  const restored = TrackState.fromSnapshot(replay.historyBaseSnapshot, {
    sampleBaseSurface: baseSampler
  });
  replay.events.forEach((event) => restored.queueEvent(event));
  const transitions = new Map(replay.weatherTimeline);
  let forcing = {};
  for (let step = restored.stepIndex + 1; step <= replay.finalStepIndex; step += 1) {
    if (transitions.has(step)) forcing = transitions.get(step);
    restored.advance(0.1, forcing);
  }
  assert.equal(restored.getChecksum(), replay.finalChecksum);

  const stalePacket = state.createSyncPacket('events', {
    sinceSequence: replay.historyBaseSequence - 1
  });
  assert.equal(stalePacket.snapshotRequired, true);
  assert.equal(state.applySyncPacket(stalePacket).snapshotRequired, true);

  const currentPacket = state.createSyncPacket('events', {
    sinceSequence: replay.historyBaseSequence
  });
  assert.equal(currentPacket.snapshotRequired, false);
  const staleEvent = {
    ...replay.historyBaseSnapshot.eventHistory?.[0],
    id: 'forgotten-event',
    stepIndex: replay.historyBaseStepIndex,
    sequence: replay.historyBaseSequence
  };
  const staleApply = state.applySyncPacket({
    ...currentPacket,
    checkpointChecksum: replay.historyBaseSnapshot.checksum,
    checksum: null,
    events: [staleEvent]
  });
  assert.equal(staleApply.staleCount, 1);
  assert.equal(staleApply.appliedCount, 0);
});

test('large persistent surfaces use a rotating deterministic cell budget instead of whole-track scans', () => {
  const state = createState({ maxCellsPerStep: 256 });
  for (let index = 0; index < 5000; index += 1) {
    state.sample({ x: index + 0.2, z: 0.2 });
  }
  const initialCellCount = state.cells.size;
  const durations = [];
  const start = performance.now();
  const first = state.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
  durations.push(performance.now() - start);
  const firstCursor = state.cellCursor;
  let second = null;
  for (let index = 0; index < 20; index += 1) {
    const stepStart = performance.now();
    second = state.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
    durations.push(performance.now() - stepStart);
  }
  assert.equal(first.processedCellCount, 256);
  assert.equal(second.processedCellCount, 256);
  assert.notEqual(state.cellCursor, firstCursor);
  assert.equal(state.cells.size, initialCellCount);
  assert.ok(Math.max(...durations) < 100, `Track State step exceeded 100 ms: ${Math.max(...durations)} ms`);

  const restored = TrackState.fromSnapshot(state.createSnapshot(), { sampleBaseSurface: baseSampler });
  assert.equal(restored.cellCursor, state.cellCursor);
  assert.equal(restored.maxCellsPerStep, 256);
  assert.equal(restored.getChecksum(), state.getChecksum());
});
