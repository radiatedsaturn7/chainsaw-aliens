import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';

import { TrackState } from '../../src/racing/trackState/TrackState.js';
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

  const packet = left.createSyncPacket('events', { sinceSequence: 0 });
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
