const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;

export const RACE_SNOW_ENVIRONMENT_LIMITS = Object.freeze({
  cellSizeM: 32,
  snapDistanceM: 16,
  headingBucketRad: Math.PI / 18,
  nearFadeStartM: 18,
  nearFadeEndM: 34,
  columnHeightM: 24,
  maxParticles: 384,
  maxCachedParticles: 2048,
  defaultGroundSamplesPerUpdate: 48,
  minimumCoverageM: 120,
  maximumCoverageM: 720,
  farFadeRatio: 0.15,
  slotsPerCell: 24
});

const hashString = (value = '') => {
  let hash = 2166136261;
  const source = String(value || '');
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const hashNumbers = (seed = 0, ...values) => {
  let hash = Number(seed) >>> 0;
  values.forEach((value, index) => {
    hash ^= Math.imul((Number(value) + index * 0x9e3779b9) >>> 0, 0x85ebca6b);
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);
    hash ^= hash >>> 16;
  });
  return hash >>> 0;
};

const randomFrom = (seed = 0, ...values) => hashNumbers(seed, ...values) / 4294967296;

const getWeatherIntensity = (weatherState = {}) => clamp(
  Number(
    weatherState.visualIntensity
    ?? weatherState.precipitationIntensity
    ?? weatherState.effectiveIntensity
  ) || 0,
  0,
  1
);

const getCoverageDistance = (weatherState = {}) => {
  const visibility = Math.max(
    1,
    Number(weatherState.visibilityDistanceM) || RACE_SNOW_ENVIRONMENT_LIMITS.minimumCoverageM
  );
  return clamp(
    Math.round(visibility * 1.2),
    RACE_SNOW_ENVIRONMENT_LIMITS.minimumCoverageM,
    RACE_SNOW_ENVIRONMENT_LIMITS.maximumCoverageM
  );
};

const getTargetCount = (weatherState = {}) => {
  const intensity = getWeatherIntensity(weatherState);
  return intensity > 0.02
    ? Math.min(
      RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles,
      Math.max(1, Math.round(
        RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles * Math.pow(intensity, 0.8)
      ))
    )
    : 0;
};

const getCameraBasis = (yaw = 0) => {
  const normalizedYaw = Number(yaw) || 0;
  return {
    forwardX: Math.sin(normalizedYaw),
    forwardZ: Math.cos(normalizedYaw),
    rightX: -Math.cos(normalizedYaw),
    rightZ: Math.sin(normalizedYaw)
  };
};

const getHorizontalHalfFovTangent = (bounds = {}, verticalFovRad = Math.PI / 3) => {
  const aspect = Math.max(0.2, Number(bounds.w || 1) / Math.max(1, Number(bounds.h || 1)));
  return Math.tan(clamp(Number(verticalFovRad) || Math.PI / 3, 0.35, 2.4) * 0.5) * aspect;
};

const createParticleRecord = (state, candidate) => {
  const {
    cellX,
    cellZ,
    slot,
    id
  } = candidate;
  const seed = state.seed;
  const cellSize = RACE_SNOW_ENVIRONMENT_LIMITS.cellSizeM;
  return {
    id,
    cellX,
    cellZ,
    slot,
    baseX: cellX * cellSize + randomFrom(seed, cellX, cellZ, slot, 1) * cellSize,
    baseZ: cellZ * cellSize + randomFrom(seed, cellX, cellZ, slot, 2) * cellSize,
    groundHeightM: null,
    hydrated: false,
    hydration: 0,
    fallPhaseM: randomFrom(seed, cellX, cellZ, slot, 3) * RACE_SNOW_ENVIRONMENT_LIMITS.columnHeightM,
    fallSpeedMps: 1.05 + randomFrom(seed, cellX, cellZ, slot, 4) * 1.85,
    swayPhase: randomFrom(seed, cellX, cellZ, slot, 5) * Math.PI * 2,
    swayFrequency: 0.34 + randomFrom(seed, cellX, cellZ, slot, 6) * 0.52,
    sizePx: 1.2 + randomFrom(seed, cellX, cellZ, slot, 7) * 2.1,
    baseOpacity: 0.3 + randomFrom(seed, cellX, cellZ, slot, 8) * 0.7,
    worldX: 0,
    worldZ: 0,
    heightM: 0,
    cameraDepthM: 0,
    opacity: 0,
    lastUsedTick: state.tick
  };
};

const selectActiveParticles = (state, {
  camera,
  cameraYaw,
  bounds,
  verticalFovRad,
  coverageDistanceM,
  targetCount
}) => {
  const limits = RACE_SNOW_ENVIRONMENT_LIMITS;
  const snapX = Math.floor(Number(camera.x || 0) / limits.snapDistanceM);
  const snapZ = Math.floor(Number(camera.z || 0) / limits.snapDistanceM);
  const normalizedYaw = Math.atan2(Math.sin(Number(cameraYaw) || 0), Math.cos(Number(cameraYaw) || 0));
  const headingBucket = Math.round(normalizedYaw / limits.headingBucketRad);
  const fovBucket = Math.round((Number(verticalFovRad) || Math.PI / 3) * 100);
  const aspectBucket = Math.round(Number(bounds.w || 1) / Math.max(1, Number(bounds.h || 1)) * 20);
  const activeKey = [
    snapX,
    snapZ,
    headingBucket,
    Math.round(coverageDistanceM),
    targetCount,
    fovBucket,
    aspectBucket
  ].join(':');
  if (state.activeKey === activeKey && state.activeParticles.length === targetCount) return;

  state.activeKey = activeKey;
  state.tick += 1;
  const anchorX = snapX * limits.snapDistanceM;
  const anchorZ = snapZ * limits.snapDistanceM;
  const snappedYaw = headingBucket * limits.headingBucketRad;
  const basis = getCameraBasis(snappedYaw);
  const halfFovTangent = getHorizontalHalfFovTangent(bounds, verticalFovRad);
  const maximumLateral = coverageDistanceM * halfFovTangent + limits.cellSizeM * 2;
  const slotsPerCell = clamp(
    Math.ceil(limits.slotsPerCell * limits.minimumCoverageM / coverageDistanceM),
    4,
    limits.slotsPerCell
  );
  const radiusCells = Math.ceil(
    Math.max(coverageDistanceM, maximumLateral) / limits.cellSizeM
  ) + 2;
  const centerCellX = Math.floor(anchorX / limits.cellSizeM);
  const centerCellZ = Math.floor(anchorZ / limits.cellSizeM);
  const bands = [[], [], []];
  for (let cellZ = centerCellZ - radiusCells; cellZ <= centerCellZ + radiusCells; cellZ += 1) {
    for (let cellX = centerCellX - radiusCells; cellX <= centerCellX + radiusCells; cellX += 1) {
      const centerX = (cellX + 0.5) * limits.cellSizeM;
      const centerZ = (cellZ + 0.5) * limits.cellSizeM;
      const dx = centerX - anchorX;
      const dz = centerZ - anchorZ;
      const centerDepth = dx * basis.forwardX + dz * basis.forwardZ;
      if (
        centerDepth < limits.nearFadeStartM - limits.cellSizeM
        || centerDepth > coverageDistanceM + limits.cellSizeM
      ) continue;
      const centerLateral = dx * basis.rightX + dz * basis.rightZ;
      const lateralLimit = Math.max(
        limits.cellSizeM * 1.5,
        Math.max(0, centerDepth) * halfFovTangent + limits.cellSizeM * 1.5
      );
      if (Math.abs(centerLateral) > lateralLimit) continue;
      for (let slot = 0; slot < slotsPerCell; slot += 1) {
        const baseX = cellX * limits.cellSizeM
          + randomFrom(state.seed, cellX, cellZ, slot, 1) * limits.cellSizeM;
        const baseZ = cellZ * limits.cellSizeM
          + randomFrom(state.seed, cellX, cellZ, slot, 2) * limits.cellSizeM;
        const particleDx = baseX - anchorX;
        const particleDz = baseZ - anchorZ;
        const depth = particleDx * basis.forwardX + particleDz * basis.forwardZ;
        if (depth < limits.nearFadeStartM || depth > coverageDistanceM) continue;
        const lateral = particleDx * basis.rightX + particleDz * basis.rightZ;
        const particleLateralLimit = Math.max(
          limits.cellSizeM,
          depth * halfFovTangent + limits.cellSizeM
        );
        if (Math.abs(lateral) > particleLateralLimit) continue;
        const ratio = depth / coverageDistanceM;
        const bandIndex = ratio < 0.2 ? 0 : ratio < 0.55 ? 1 : 2;
        bands[bandIndex].push({
          id: `${cellX}:${cellZ}:${slot}`,
          cellX,
          cellZ,
          slot,
          score: randomFrom(state.seed, cellX, cellZ, slot, 19)
        });
      }
    }
  }
  bands.forEach((band) => band.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id)));
  const quotas = [
    Math.round(targetCount * 0.4),
    Math.round(targetCount * 0.35)
  ];
  quotas.push(Math.max(0, targetCount - quotas[0] - quotas[1]));
  const selected = [];
  const selectedIds = new Set();
  bands.forEach((band, index) => {
    band.slice(0, quotas[index]).forEach((candidate) => {
      selected.push(candidate);
      selectedIds.add(candidate.id);
    });
  });
  if (selected.length < targetCount) {
    bands
      .flat()
      .filter((candidate) => !selectedIds.has(candidate.id))
      .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
      .slice(0, targetCount - selected.length)
      .forEach((candidate) => {
        selected.push(candidate);
        selectedIds.add(candidate.id);
      });
  }
  state.activeParticles = selected.map((candidate) => {
    let particle = state.particleCache.get(candidate.id);
    if (!particle) {
      particle = createParticleRecord(state, candidate);
      state.particleCache.set(candidate.id, particle);
    }
    particle.lastUsedTick = state.tick;
    return particle;
  });
  state.hydrationCursor = 0;

  if (state.particleCache.size > limits.maxCachedParticles) {
    const activeIds = new Set(state.activeParticles.map((particle) => particle.id));
    [...state.particleCache.values()]
      .filter((particle) => !activeIds.has(particle.id))
      .sort((a, b) => Number(a.lastUsedTick || 0) - Number(b.lastUsedTick || 0))
      .slice(0, state.particleCache.size - limits.maxCachedParticles)
      .forEach((particle) => state.particleCache.delete(particle.id));
  }
};

const hydrateActiveParticles = (state, {
  sampleGroundHeightM,
  camera,
  maxGroundSamples
}) => {
  if (!state.activeParticles.length) return 0;
  const sample = typeof sampleGroundHeightM === 'function'
    ? sampleGroundHeightM
    : () => Number(camera.heightM || 0) - 3;
  const budget = clamp(
    Math.floor(Number(maxGroundSamples) || 0),
    0,
    RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles
  );
  let hydrated = 0;
  let inspected = 0;
  while (hydrated < budget && inspected < state.activeParticles.length) {
    const index = state.hydrationCursor % state.activeParticles.length;
    state.hydrationCursor = (index + 1) % state.activeParticles.length;
    inspected += 1;
    const particle = state.activeParticles[index];
    if (particle.hydrated) continue;
    const sampledHeight = Number(sample({
      x: particle.baseX,
      z: particle.baseZ,
      particle
    }));
    particle.groundHeightM = Number.isFinite(sampledHeight)
      ? sampledHeight
      : Number(camera.heightM || 0) - 3;
    particle.hydrated = true;
    hydrated += 1;
  }
  return hydrated;
};

export const createRaceSnowEnvironmentState = ({ raceSeed = 'race-snow' } = {}) => ({
  version: 1,
  raceSeed: String(raceSeed || 'race-snow'),
  seed: hashString(raceSeed || 'race-snow'),
  activeKey: '',
  activeParticles: [],
  particleCache: new Map(),
  hydrationCursor: 0,
  coverageDistanceM: 0,
  targetCount: 0,
  tick: 0,
  lastElapsedMs: null
});

export const resetRaceSnowEnvironmentState = (state) => {
  if (!state) return createRaceSnowEnvironmentState();
  state.activeKey = '';
  state.activeParticles = [];
  state.particleCache?.clear?.();
  state.particleCache = state.particleCache instanceof Map ? state.particleCache : new Map();
  state.hydrationCursor = 0;
  state.coverageDistanceM = 0;
  state.targetCount = 0;
  state.tick = 0;
  state.lastElapsedMs = null;
  return state;
};

export const updateRaceSnowEnvironmentField = (state, {
  camera = {},
  cameraYaw = 0,
  bounds = {},
  verticalFovRad = Math.PI / 3,
  weatherState = {},
  elapsedMs = 0,
  gustXMps = 0,
  gustZMps = 0,
  sampleGroundHeightM = null,
  maxGroundSamples = RACE_SNOW_ENVIRONMENT_LIMITS.defaultGroundSamplesPerUpdate
} = {}) => {
  if (!state || !(state.particleCache instanceof Map)) {
    throw new TypeError('Race snow environment state must be created before it is updated.');
  }
  const intensity = getWeatherIntensity(weatherState);
  if (weatherState.id !== 'snow' || intensity <= 0.02) {
    resetRaceSnowEnvironmentState(state);
    return state.activeParticles;
  }
  const coverageDistanceM = getCoverageDistance(weatherState);
  const targetCount = getTargetCount(weatherState);
  state.coverageDistanceM = coverageDistanceM;
  state.targetCount = targetCount;
  selectActiveParticles(state, {
    camera,
    cameraYaw,
    bounds,
    verticalFovRad,
    coverageDistanceM,
    targetCount
  });
  hydrateActiveParticles(state, {
    sampleGroundHeightM,
    camera,
    maxGroundSamples
  });

  const currentElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  const previousElapsedMs = Number(state.lastElapsedMs);
  const dt = Number.isFinite(previousElapsedMs)
    ? clamp((currentElapsedMs - previousElapsedMs) / 1000, 0, 0.1)
    : 1 / 60;
  state.lastElapsedMs = currentElapsedMs;
  const elapsedSeconds = currentElapsedMs / 1000;
  const basis = getCameraBasis(cameraYaw);
  const limits = RACE_SNOW_ENVIRONMENT_LIMITS;
  const gustMagnitude = Math.hypot(Number(gustXMps) || 0, Number(gustZMps) || 0);
  const gustDirectionX = gustMagnitude > 0.001 ? Number(gustXMps || 0) / gustMagnitude : 0;
  const gustDirectionZ = gustMagnitude > 0.001 ? Number(gustZMps || 0) / gustMagnitude : 0;
  state.activeParticles.forEach((particle) => {
    if (particle.hydrated) particle.hydration = clamp(Number(particle.hydration || 0) + dt * 3.2, 0, 1);
    else particle.hydration = 0;
    const fallTravelM = positiveModulo(
      particle.fallPhaseM + elapsedSeconds * particle.fallSpeedMps,
      limits.columnHeightM
    );
    const fallAgeSeconds = fallTravelM / Math.max(0.1, particle.fallSpeedMps);
    const driftDistanceM = Math.min(8, gustMagnitude * fallAgeSeconds * 0.12);
    const swayM = Math.sin(particle.swayPhase + elapsedSeconds * particle.swayFrequency) * 0.65;
    particle.worldX = particle.baseX + gustDirectionX * driftDistanceM + basis.rightX * swayM;
    particle.worldZ = particle.baseZ + gustDirectionZ * driftDistanceM + basis.rightZ * swayM;
    particle.heightM = Number(
      particle.hydrated ? particle.groundHeightM : Number(camera.heightM || 0) - 3
    ) + 0.35 + limits.columnHeightM - fallTravelM;
    const dx = particle.worldX - Number(camera.x || 0);
    const dz = particle.worldZ - Number(camera.z || 0);
    particle.cameraDepthM = dx * basis.forwardX + dz * basis.forwardZ;
    const nearFade = clamp(
      (particle.cameraDepthM - limits.nearFadeStartM)
        / Math.max(0.001, limits.nearFadeEndM - limits.nearFadeStartM),
      0,
      1
    );
    const farFade = clamp(
      (coverageDistanceM - particle.cameraDepthM)
        / Math.max(1, coverageDistanceM * limits.farFadeRatio),
      0,
      1
    );
    particle.opacity = particle.baseOpacity
      * particle.hydration
      * nearFade
      * farFade
      * (0.45 + intensity * 0.55);
  });
  return state.activeParticles;
};
