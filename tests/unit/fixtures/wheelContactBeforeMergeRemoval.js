import {createSurfaceSample} from '../../../src/racing/simulation/SurfaceSample.js';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function averageFinitePairHeight(heights, firstWheelId, secondWheelId) {
  const firstHeightM = heights[firstWheelId];
  const secondHeightM = heights[secondWheelId];
  let sumM = 0;
  let count = 0;
  if (Number.isFinite(firstHeightM)) {
    sumM += firstHeightM;
    count += 1;
  }
  if (Number.isFinite(secondHeightM)) {
    sumM += secondHeightM;
    count += 1;
  }
  return count > 0 ? sumM / count : null;
}

export function createRaceWheelContactStateFromSamples({
  wheelIds = ['fl', 'fr', 'rl', 'rr'],
  positions = {},
  surfaceSamples = {},
  carDimensions = {},
  tuning = {},
  selectedSegment = null,
  trackState = null,
  groundedByWheel = null,
  elevationScaleM = 12,
  preparedSamples = false,
  trackStateSampleByWheel = null,
  trackStateConditionScratchByWheel = null,
  target = null
} = {}) {
  const output = target && typeof target === 'object' ? target : {};
  const contacts = output.contacts || {};
  const heights = output.heights || {};
  for (let wheelIndex = 0; wheelIndex < wheelIds.length; wheelIndex += 1) {
    const wheelId = wheelIds[wheelIndex];
    const position = positions[wheelId];
    const rawSurfaceSample = surfaceSamples[wheelId] || {};
    const authoritativeSample = preparedSamples === true
      && rawSurfaceSample.physicsTerrainQueryFrameSample === true
      ? rawSurfaceSample
      : createSurfaceSample(rawSurfaceSample, {
          queryPosition: position,
          heightScale: elevationScaleM,
          source: rawSurfaceSample.bakedSurfaceSource || 'race-wheel-contact'
        });
    const surfaceSample = preparedSamples === true
      && rawSurfaceSample.physicsTerrainQueryFrameSample === true
      ? rawSurfaceSample
      : { ...rawSurfaceSample, ...authoritativeSample };
    const projection = surfaceSample.projection;
    const segment = surfaceSample.segment || projection?.segment || selectedSegment;
    const surfaceElevation = authoritativeSample.valid
      ? authoritativeSample.heightM / elevationScaleM : null;
    const localTrackState = groundedByWheel?.[wheelId] === false
      ? null
      : trackState?.sample?.(
          position,
          trackStateSampleByWheel?.[wheelId] || null,
          trackStateConditionScratchByWheel?.[wheelId] || null
        ) || null;
    const terrain = surfaceSample.region === 'terrain' ? 'off-road' : surfaceSample.region;
    const heightM = authoritativeSample.valid ? authoritativeSample.heightM : null;
    const contact = contacts[wheelId] || {};
    contact.x = Number(position?.x || 0);
    contact.y = Number(position?.y || 0);
    contact.z = Number(position?.z || 0);
    contact.projection = projection;
    contact.segment = segment;
    contact.terrain = terrain;
    contact.region = surfaceSample.region;
    contact.baseSurfaceId = localTrackState?.cell?.baseSurfaceId || surfaceSample.surfaceId;
    contact.surfaceId = localTrackState?.effectiveSurfaceId || surfaceSample.surfaceId;
    contact.friction = localTrackState
      ? Number(localTrackState.effectiveGrip
        || localTrackState.cell?.baseGrip || surfaceSample.friction || 1)
      : Number(surfaceSample.friction || 1);
    contact.trackState = localTrackState;
    contact.normal = surfaceSample.normal;
    contact.elevation = surfaceElevation;
    contact.heightM = heightM;
    contact.surfaceSample = authoritativeSample;
    contact.valid = authoritativeSample.valid;
    contact.triangleId = authoritativeSample.triangleId;
    contact.source = authoritativeSample.source;
    contact.invalidReason = authoritativeSample.reason;
    contacts[wheelId] = contact;
    if (authoritativeSample.valid) heights[wheelId] = heightM;
    else delete heights[wheelId];
  }
  let heightSumM = 0;
  let heightCount = 0;
  for (let wheelIndex = 0; wheelIndex < wheelIds.length; wheelIndex += 1) {
    const heightM = heights[wheelIds[wheelIndex]];
    if (!Number.isFinite(heightM)) continue;
    heightSumM += heightM;
    heightCount += 1;
  }
  const averageHeightM = heightCount > 0 ? heightSumM / heightCount : null;
  const leftHeightM = averageFinitePairHeight(heights, 'fl', 'rl');
  const rightHeightM = averageFinitePairHeight(heights, 'fr', 'rr');
  const frontHeightM = averageFinitePairHeight(heights, 'fl', 'fr');
  const rearHeightM = averageFinitePairHeight(heights, 'rl', 'rr');
  const wheelbaseM = Math.max(2.1, Number(tuning.wheelbaseM) || carDimensions.wheelbaseM || 2.7);
  const trackWidthM = Math.max(1.2, Number(tuning.trackWidthM) || carDimensions.trackWidthM || 1.55);
  output.positions = positions;
  output.contacts = contacts;
  output.heights = heights;
  output.averageHeightM = averageHeightM;
  output.leftHeightM = leftHeightM;
  output.rightHeightM = rightHeightM;
  output.frontHeightM = frontHeightM;
  output.rearHeightM = rearHeightM;
  output.terrainPitchRad = Number.isFinite(frontHeightM) && Number.isFinite(rearHeightM)
    ? clamp(Math.atan2(frontHeightM - rearHeightM, wheelbaseM), -0.42, 0.42) : 0;
  output.terrainRollRad = Number.isFinite(rightHeightM) && Number.isFinite(leftHeightM)
    ? clamp(Math.atan2(rightHeightM - leftHeightM, trackWidthM), -0.42, 0.42) : 0;
  return output;
}
