const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getRaceWheelSurfaceState({
  wheelIds = ['fl', 'fr', 'rl', 'rr'],
  positions = {},
  car = null,
  damage = null,
  selectedSegment = null,
  weatherState = null,
  trackState = null,
  groundedByWheel = null,
  surfaceModel = null,
  adapter = {}
} = {}) {
  const gripByWheel = {};
  const surfaceByWheel = {};
  const baseSurfaceByWheel = {};
  const snowDepthByWheel = {};
  const terrainByWheel = {};
  const regionByWheel = {};
  const terrainGripScaleByWheel = {};
  const surfaceGripByWheel = {};
  const frictionByWheel = {};
  const normalByWheel = {};
  const trackStateByWheel = {};
  const rollingResistanceByWheel = {};
  wheelIds.forEach((wheelId) => {
    const position = positions[wheelId];
    const trackSample = surfaceModel?.sampleWorld?.(position, 0, {
      fallbackSurfaceId: selectedSegment?.surface || 'asphalt',
      applyWeatherSurface: !trackState
    }) || {};
    const segment = trackSample.segment || trackSample.projection?.segment || selectedSegment;
    const region = trackSample.region || 'terrain';
    const terrain = region === 'terrain' ? 'off-road' : region;
    const grounded = groundedByWheel?.[wheelId] !== false;
    const localTrackState = grounded ? trackState?.sample?.(position) || null : null;
    const baseSurfaceId = localTrackState?.cell?.baseSurfaceId
      || (region === 'terrain'
        ? trackSample.baseSurfaceId || trackSample.surfaceId
        : segment?.surface || trackSample.baseSurfaceId || trackSample.surfaceId)
      || 'asphalt';
    let surfaceId = localTrackState?.effectiveSurfaceId || baseSurfaceId;
    let terrainGripScale = Number(trackSample.terrainGripScale || (terrain === 'road' ? 1 : terrain === 'shoulder' ? 0.68 : 0.48));
    surfaceId = localTrackState
      ? surfaceId
      : adapter.getEffectiveSurfaceId?.(surfaceId) || surfaceId;
    const snowDepthInches = localTrackState
      ? Number(localTrackState.cell?.snowDepthMm || 0) / 25.4
      : Number(adapter.getSnowDepthInches?.({
        weatherState,
        segment,
        surfaceId: baseSurfaceId
      }) || 0);
    const surface = adapter.getSurfaceById?.(surfaceId) || { id: surfaceId, grip: 1 };
    const detailGrip = terrain === 'road' ? adapter.getSegmentSurfaceDetailGrip?.(segment) ?? 1 : 1;
    surfaceByWheel[wheelId] = surface.id;
    baseSurfaceByWheel[wheelId] = baseSurfaceId;
    snowDepthByWheel[wheelId] = snowDepthInches;
    terrainByWheel[wheelId] = terrain;
    regionByWheel[wheelId] = region;
    terrainGripScaleByWheel[wheelId] = terrainGripScale;
    frictionByWheel[wheelId] = localTrackState
      ? Number(localTrackState.effectiveGrip || localTrackState.cell?.baseGrip || 1) * terrainGripScale
      : Number(trackSample.friction || (Number(surface.grip || 1) * terrainGripScale));
    normalByWheel[wheelId] = trackSample.normal || { x: 0, y: 1, z: 0 };
    surfaceGripByWheel[wheelId] = clamp(frictionByWheel[wheelId] * detailGrip, 0.18, 1.12);
    const compoundGrip = adapter.getWheelGripForSurface?.({
      car,
      wheelId,
      surfaceId: surface.id,
      baseSurfaceId,
      snowDepthInches,
      weather: localTrackState ? 'clear' : weatherState?.id,
      damage,
      terrainGripScale
    }) ?? 1;
    gripByWheel[wheelId] = compoundGrip;
    trackStateByWheel[wheelId] = localTrackState;
    rollingResistanceByWheel[wheelId] = localTrackState
      ? Number(localTrackState.rollingResistanceMultiplier || 1)
        / Math.max(0.2, Number(localTrackState.cell?.baseRollingResistance || 1))
      : 1;
  });
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  if (trackState) {
    const groundedLocalMultipliers = wheelIds
      .filter((wheelId) => trackStateByWheel[wheelId])
      .map((wheelId) => Number(trackStateByWheel[wheelId]?.effectiveGripMultiplier || 1));
    const averageLocalMultiplier = average(groundedLocalMultipliers.length ? groundedLocalMultipliers : [1]);
    wheelIds.forEach((wheelId) => {
      if (!trackStateByWheel[wheelId]) return;
      gripByWheel[wheelId] *= Number(trackStateByWheel[wheelId].effectiveGripMultiplier || 1)
        / Math.max(0.08, averageLocalMultiplier);
    });
  }
  return {
    positions,
    gripByWheel,
    surfaceByWheel,
    baseSurfaceByWheel,
    snowDepthByWheel,
    terrainByWheel,
    regionByWheel,
    terrainGripScaleByWheel,
    frictionByWheel,
    normalByWheel,
    trackStateByWheel,
    rollingResistanceByWheel,
    surfaceGripByWheel,
    averageSurfaceGrip: average(Object.values(surfaceGripByWheel)),
    averageGrip: average(Object.values(gripByWheel)),
    averageRollingResistance: average(Object.values(rollingResistanceByWheel)),
    leftGrip: (gripByWheel.fl + gripByWheel.rl) * 0.5,
    rightGrip: (gripByWheel.fr + gripByWheel.rr) * 0.5,
    frontGrip: (gripByWheel.fl + gripByWheel.fr) * 0.5,
    rearGrip: (gripByWheel.rl + gripByWheel.rr) * 0.5
  };
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
  elevationScaleM = 12
} = {}) {
  const contacts = {};
  const heights = {};
  wheelIds.forEach((wheelId) => {
    const position = positions[wheelId];
    const surfaceSample = surfaceSamples[wheelId] || {};
    const projection = surfaceSample.projection;
    const segment = surfaceSample.segment || projection?.segment || selectedSegment;
    const surfaceElevation = Number(surfaceSample.elevation || 0);
    const localTrackState = groundedByWheel?.[wheelId] === false
      ? null
      : trackState?.sample?.(position) || null;
    const terrain = surfaceSample.region === 'terrain' ? 'off-road' : surfaceSample.region;
    const heightM = surfaceElevation * elevationScaleM;
    contacts[wheelId] = {
      ...position,
      projection,
      segment,
      terrain,
      region: surfaceSample.region,
      baseSurfaceId: localTrackState?.cell?.baseSurfaceId || surfaceSample.surfaceId,
      surfaceId: localTrackState?.effectiveSurfaceId || surfaceSample.surfaceId,
      friction: localTrackState
        ? Number(localTrackState.effectiveGrip || localTrackState.cell?.baseGrip || surfaceSample.friction || 1)
        : Number(surfaceSample.friction || 1),
      trackState: localTrackState,
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

export function getRaceWheelContactState({
  wheelIds = ['fl', 'fr', 'rl', 'rr'],
  positions = {},
  carDimensions = {},
  tuning = {},
  selectedSegment = null,
  trackState = null,
  groundedByWheel = null,
  surfaceModel = null,
  elevationScaleM = 12,
  runtimeType = 'destination'
} = {}) {
  const surfaceSamples = Object.fromEntries(wheelIds.map((wheelId) => [wheelId,
    surfaceModel?.sampleWorld?.(positions[wheelId], 0, {
      runtimeType,
      fallbackSurfaceId: selectedSegment?.surface || 'asphalt',
      physicsContact: true,
      applyWeatherSurface: !trackState
    }) || {}
  ]));
  return createRaceWheelContactStateFromSamples({
    wheelIds,
    positions,
    surfaceSamples,
    carDimensions,
    tuning,
    selectedSegment,
    trackState,
    groundedByWheel,
    elevationScaleM
  });
}
