const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getRaceWheelSurfaceState({
  wheelIds = ['fl', 'fr', 'rl', 'rr'],
  positions = {},
  car = null,
  damage = null,
  selectedSegment = null,
  weatherState = null,
  surfaceModel = null,
  adapter = {}
} = {}) {
  const gripByWheel = {};
  const surfaceByWheel = {};
  const terrainByWheel = {};
  const regionByWheel = {};
  const terrainGripScaleByWheel = {};
  const surfaceGripByWheel = {};
  const frictionByWheel = {};
  const normalByWheel = {};
  wheelIds.forEach((wheelId) => {
    const position = positions[wheelId];
    const trackSample = surfaceModel?.sampleWorld?.(position, 0, {
      fallbackSurfaceId: selectedSegment?.surface || 'asphalt'
    }) || {};
    const segment = trackSample.segment || trackSample.projection?.segment || selectedSegment;
    const region = trackSample.region || 'terrain';
    const terrain = region === 'terrain' ? 'off-road' : region;
    let surfaceId = trackSample.surfaceId || adapter.getEffectiveSurfaceId?.(segment?.surface || 'asphalt') || 'asphalt';
    let terrainGripScale = Number(trackSample.terrainGripScale || (terrain === 'road' ? 1 : terrain === 'shoulder' ? 0.68 : 0.48));
    surfaceId = adapter.getEffectiveSurfaceId?.(surfaceId) || surfaceId;
    const surface = adapter.getSurfaceById?.(surfaceId) || { id: surfaceId, grip: 1 };
    const detailGrip = terrain === 'road' ? adapter.getSegmentSurfaceDetailGrip?.(segment) ?? 1 : 1;
    surfaceByWheel[wheelId] = surface.id;
    terrainByWheel[wheelId] = terrain;
    regionByWheel[wheelId] = region;
    terrainGripScaleByWheel[wheelId] = terrainGripScale;
    frictionByWheel[wheelId] = Number(trackSample.friction || surface.grip);
    normalByWheel[wheelId] = trackSample.normal || { x: 0, y: 1, z: 0 };
    surfaceGripByWheel[wheelId] = clamp(frictionByWheel[wheelId] * detailGrip, 0.18, 1.12);
    gripByWheel[wheelId] = adapter.getWheelGripForSurface?.({
      car,
      wheelId,
      surfaceId: surface.id,
      weather: weatherState?.id,
      damage,
      terrainGripScale
    }) ?? 1;
  });
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  return {
    positions,
    gripByWheel,
    surfaceByWheel,
    terrainByWheel,
    regionByWheel,
    terrainGripScaleByWheel,
    frictionByWheel,
    normalByWheel,
    surfaceGripByWheel,
    averageSurfaceGrip: average(Object.values(surfaceGripByWheel)),
    averageGrip: average(Object.values(gripByWheel)),
    leftGrip: (gripByWheel.fl + gripByWheel.rl) * 0.5,
    rightGrip: (gripByWheel.fr + gripByWheel.rr) * 0.5,
    frontGrip: (gripByWheel.fl + gripByWheel.fr) * 0.5,
    rearGrip: (gripByWheel.rl + gripByWheel.rr) * 0.5
  };
}

export function getRaceWheelContactState({
  wheelIds = ['fl', 'fr', 'rl', 'rr'],
  positions = {},
  carDimensions = {},
  tuning = {},
  selectedSegment = null,
  surfaceModel = null,
  elevationScaleM = 12,
  runtimeType = 'destination'
} = {}) {
  const contacts = {};
  const heights = {};
  wheelIds.forEach((wheelId) => {
    const position = positions[wheelId];
    const surfaceSample = surfaceModel?.sampleWorld?.(position, 0, {
      runtimeType,
      fallbackSurfaceId: selectedSegment?.surface || 'asphalt'
    }) || {};
    const projection = surfaceSample.projection;
    const segment = surfaceSample.segment || projection?.segment || selectedSegment;
    const surfaceElevation = Number(surfaceSample.elevation || 0);
    const terrain = surfaceSample.region === 'terrain' ? 'off-road' : surfaceSample.region;
    const heightM = surfaceElevation * elevationScaleM;
    contacts[wheelId] = {
      ...position,
      projection,
      segment,
      terrain,
      region: surfaceSample.region,
      surfaceId: surfaceSample.surfaceId,
      friction: surfaceSample.friction,
      normal: surfaceSample.normal,
      elevation: surfaceElevation,
      heightM
    };
    heights[wheelId] = heightM;
  });
  const averageHeightM = wheelIds.reduce((sum, wheelId) => sum + Number(heights[wheelId] || 0), 0) / wheelIds.length;
  const leftHeightM = ((heights.fl || 0) + (heights.rl || 0)) * 0.5;
  const rightHeightM = ((heights.fr || 0) + (heights.rr || 0)) * 0.5;
  const frontHeightM = ((heights.fl || 0) + (heights.fr || 0)) * 0.5;
  const rearHeightM = ((heights.rl || 0) + (heights.rr || 0)) * 0.5;
  const wheelbaseM = Math.max(2.1, Number(tuning.wheelbaseM) || carDimensions.wheelbaseM || 2.7);
  const trackWidthM = Math.max(1.2, Number(tuning.trackWidthM) || carDimensions.trackWidthM || 1.55);
  return {
    positions,
    contacts,
    heights,
    averageHeightM,
    leftHeightM,
    rightHeightM,
    frontHeightM,
    rearHeightM,
    terrainPitchRad: clamp(Math.atan2(frontHeightM - rearHeightM, wheelbaseM), -0.42, 0.42),
    terrainRollRad: clamp(Math.atan2(rightHeightM - leftHeightM, trackWidthM), -0.42, 0.42)
  };
}
