import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RACE_SNOW_ENVIRONMENT_LIMITS,
  createRaceSnowEnvironmentState,
  updateRaceSnowEnvironmentField
} from '../../src/racing/RaceSnowEnvironment.js';

const BOUNDS = { x: 0, y: 0, w: 640, h: 360 };
const WEATHER = {
  id: 'snow',
  visualIntensity: 1,
  visibilityDistanceM: 260
};

const hydrateField = (state, options = {}) => updateRaceSnowEnvironmentField(state, {
  camera: { x: 0, z: 0, heightM: 3 },
  cameraYaw: 0,
  bounds: BOUNDS,
  weatherState: WEATHER,
  elapsedMs: 12000,
  maxGroundSamples: RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles,
  sampleGroundHeightM: ({ x, z }) => x * 0.01 + z * 0.002,
  ...options
});

test('environment snowfall covers the visible landscape instead of ending at the old local box', () => {
  const state = createRaceSnowEnvironmentState({ raceSeed: 'studio-sprint-wrx2' });
  const particles = hydrateField(state);

  assert.equal(particles.length, RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles);
  assert.equal(state.coverageDistanceM, 312);
  assert.equal(Math.max(...particles.map((particle) => particle.cameraDepthM)) > 260, true);
  const depthBands = [0, 0, 0];
  particles.forEach((particle) => {
    const ratio = particle.cameraDepthM / state.coverageDistanceM;
    if (ratio < 0.2) depthBands[0] += 1;
    else if (ratio < 0.55) depthBands[1] += 1;
    else depthBands[2] += 1;
  });
  assert.equal(depthBands.every((count) => count > 0), true);
  assert.equal(particles.every((particle) => (
    particle.cameraDepthM >= RACE_SNOW_ENVIRONMENT_LIMITS.nearFadeStartM
    && particle.cameraDepthM <= state.coverageDistanceM
  )), true);
});

test('environment snowfall keeps overlapping world identities stable across streamed camera cells', () => {
  const state = createRaceSnowEnvironmentState({ raceSeed: 'stable-world-snow' });
  const initial = hydrateField(state);
  const initialById = new Map(initial.map((particle) => [particle.id, {
    baseX: particle.baseX,
    baseZ: particle.baseZ,
    groundHeightM: particle.groundHeightM
  }]));
  const initialKey = state.activeKey;

  const withinSnapCell = hydrateField(state, {
    camera: { x: 8, z: 7, heightM: 3 },
    elapsedMs: 12500
  });
  assert.equal(state.activeKey, initialKey);
  assert.deepEqual(
    withinSnapCell.map((particle) => particle.id),
    initial.map((particle) => particle.id)
  );

  const streamed = hydrateField(state, {
    camera: { x: 24, z: 20, heightM: 3 },
    elapsedMs: 13000
  });
  const overlap = streamed.filter((particle) => initialById.has(particle.id));
  assert.equal(overlap.length > RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles * 0.45, true);
  overlap.forEach((particle) => {
    assert.deepEqual(
      {
        baseX: particle.baseX,
        baseZ: particle.baseZ,
        groundHeightM: particle.groundHeightM
      },
      initialById.get(particle.id)
    );
  });
});

test('environment snowfall hydrates terrain incrementally and falls in bounded terrain-relative columns', () => {
  const sampled = [];
  const state = createRaceSnowEnvironmentState({ raceSeed: 'terrain-snow' });
  const options = {
    camera: { x: 0, z: 0, heightM: 3 },
    cameraYaw: Math.PI / 7,
    bounds: BOUNDS,
    weatherState: WEATHER,
    elapsedMs: 2000,
    maxGroundSamples: 17,
    sampleGroundHeightM: ({ x, z }) => {
      sampled.push([x, z]);
      return 4 + x * 0.005 - z * 0.003;
    }
  };
  let particles = updateRaceSnowEnvironmentField(state, options);
  assert.equal(sampled.length, 17);
  assert.equal(particles.filter((particle) => particle.hydrated).length, 17);

  for (let pass = 1; pass < 30 && particles.some((particle) => !particle.hydrated); pass += 1) {
    particles = updateRaceSnowEnvironmentField(state, {
      ...options,
      elapsedMs: 2000 + pass * 16
    });
  }
  assert.equal(particles.every((particle) => particle.hydrated), true);
  particles.forEach((particle) => {
    assert.equal(particle.heightM >= particle.groundHeightM + 0.35, true);
    assert.equal(
      particle.heightM <= particle.groundHeightM + RACE_SNOW_ENVIRONMENT_LIMITS.columnHeightM + 0.35,
      true
    );
  });
  assert.equal(state.particleCache.size <= RACE_SNOW_ENVIRONMENT_LIMITS.maxCachedParticles, true);
});

test('environment snowfall is deterministic and clears without snow weather', () => {
  const first = createRaceSnowEnvironmentState({ raceSeed: 'mirror-field' });
  const second = createRaceSnowEnvironmentState({ raceSeed: 'mirror-field' });
  const firstParticles = hydrateField(first);
  const secondParticles = hydrateField(second);

  assert.deepEqual(
    firstParticles.slice(0, 32).map((particle) => [
      particle.id,
      particle.worldX,
      particle.worldZ,
      particle.heightM,
      particle.opacity
    ]),
    secondParticles.slice(0, 32).map((particle) => [
      particle.id,
      particle.worldX,
      particle.worldZ,
      particle.heightM,
      particle.opacity
    ])
  );

  const cleared = updateRaceSnowEnvironmentField(first, {
    camera: { x: 0, z: 0, heightM: 3 },
    cameraYaw: 0,
    bounds: BOUNDS,
    weatherState: { id: 'clear', visualIntensity: 0 },
    elapsedMs: 13000
  });
  assert.deepEqual(cleared, []);
  assert.equal(first.activeParticles.length, 0);
  assert.equal(first.particleCache.size, 0);
});

test('environment snowfall bounds streamed cache growth and per-frame terrain sampling', () => {
  const state = createRaceSnowEnvironmentState({ raceSeed: 'long-stage-snow' });
  for (let step = 0; step < 24; step += 1) {
    let samples = 0;
    const particles = updateRaceSnowEnvironmentField(state, {
      camera: {
        x: step * 48,
        z: step * 31,
        heightM: 3
      },
      cameraYaw: step * 0.08,
      bounds: BOUNDS,
      weatherState: WEATHER,
      elapsedMs: step * 100,
      maxGroundSamples: RACE_SNOW_ENVIRONMENT_LIMITS.defaultGroundSamplesPerUpdate,
      sampleGroundHeightM: () => {
        samples += 1;
        return 0;
      }
    });
    assert.equal(particles.length, RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles);
    assert.equal(samples <= RACE_SNOW_ENVIRONMENT_LIMITS.defaultGroundSamplesPerUpdate, true);
    assert.equal(state.particleCache.size <= RACE_SNOW_ENVIRONMENT_LIMITS.maxCachedParticles, true);
  }
});
