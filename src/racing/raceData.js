export const RACE_SURFACES = [
  { id: 'asphalt', label: 'Asphalt', grip: 1, colorA: '#315734', colorB: '#244629' },
  { id: 'dirt', label: 'Dirt', grip: 0.9, colorA: '#7a5633', colorB: '#5f4128' },
  { id: 'gravel', label: 'Gravel', grip: 0.88, colorA: '#70706b', colorB: '#52534f' },
  { id: 'mud', label: 'Mud', grip: 0.58, colorA: '#4f3320', colorB: '#352317' },
  { id: 'wet-gravel', label: 'Wet Gravel', grip: 0.68, colorA: '#555a58', colorB: '#383f3d' },
  { id: 'snow', label: 'Snow', grip: 0.38, colorA: '#d7e5ec', colorB: '#b8cbd5' },
  { id: 'slush', label: 'Slush', grip: 0.44, colorA: '#9fb3bd', colorB: '#748b96' },
  { id: 'wet-asphalt', label: 'Wet Asphalt', grip: 0.72, colorA: '#263946', colorB: '#1b2b36' }
];

export const DRIVETRAINS = ['rwd', 'fwd', 'awd'];

export const RACE_COMPETITION_MODES = ['solo', 'ai-race', 'combat-run', 'mixed'];

export const RACE_TIME_OF_DAY = ['day', 'night'];

export const RACE_SNOW_CONDITIONS = [
  { id: 'ice', label: 'Ice', grip: 0.52, bumpiness: 0.03 },
  { id: 'dusting', label: 'Dusting', grip: 0.68, bumpiness: 0.08 },
  { id: 'three-inch', label: '3 in Snow', grip: 0.56, bumpiness: 0.18 },
  { id: 'slush', label: 'Slush', grip: 0.48, bumpiness: 0.14 }
];

export const RACE_TIRE_COMPOUNDS = [
  {
    id: 'tarmac',
    label: 'Tarmac',
    surfaceGrip: { asphalt: 1.08, 'wet-asphalt': 0.9, dirt: 0.86, gravel: 0.82, mud: 0.52, 'wet-gravel': 0.64, snow: 0.32, slush: 0.4 },
    weatherGrip: { clear: 1, rain: 0.82, storm: 0.72, snow: 0.36 },
    wearRate: 1
  },
  {
    id: 'rain',
    label: 'Rain',
    surfaceGrip: { asphalt: 0.94, 'wet-asphalt': 1.03, dirt: 0.82, gravel: 0.8, mud: 0.68, 'wet-gravel': 0.86, snow: 0.42, slush: 0.58 },
    weatherGrip: { clear: 0.92, rain: 1.03, storm: 0.95, snow: 0.48 },
    wearRate: 1.1
  },
  {
    id: 'dirt',
    label: 'Dirt',
    surfaceGrip: { asphalt: 0.78, 'wet-asphalt': 0.75, dirt: 1.08, gravel: 1.02, mud: 0.92, 'wet-gravel': 0.96, snow: 0.58, slush: 0.66 },
    weatherGrip: { clear: 1, rain: 0.92, storm: 0.84, snow: 0.56 },
    wearRate: 1.18
  },
  {
    id: 'snow',
    label: 'Snow',
    surfaceGrip: { asphalt: 0.58, 'wet-asphalt': 0.62, dirt: 0.74, gravel: 0.76, mud: 0.62, 'wet-gravel': 0.72, snow: 1.08, slush: 0.95 },
    weatherGrip: { clear: 0.86, rain: 0.78, storm: 0.7, snow: 1.04 },
    wearRate: 1.3
  }
];

export const RACE_CAR_DIMENSIONS = {
  'wrx-2022': {
    lengthM: 4.67,
    widthM: 1.83,
    wheelbaseM: 2.67,
    trackFrontM: 1.56,
    trackRearM: 1.56
  },
  'brz-2022': {
    lengthM: 4.27,
    widthM: 1.78,
    wheelbaseM: 2.58,
    trackFrontM: 1.52,
    trackRearM: 1.55
  },
  'civic-type-r-2023': {
    lengthM: 4.60,
    widthM: 1.89,
    wheelbaseM: 2.74,
    trackFrontM: 1.63,
    trackRearM: 1.62
  }
};

export const RACE_LANE_WIDTH_M = 3.6;
export const DEFAULT_RACE_LANE_COUNT = 1;

export const STUDIO_SPRINT_GRAPHIC_SETTINGS = Object.freeze({
  groundRenderer: 'webgl-track',
  groundTextureBaseWorldM: 1.002,
  groundTextureFilterMode: 'balanced',
  skyboxArtRef: 'providence',
  surfaceArt: Object.freeze({
    boundary: 'apron'
  }),
  margin: Object.freeze({
    enabled: true,
    shoulderEnabled: true,
    widthM: 0.22,
    shoulderWidthM: 12,
    collisionMode: 'shoulder',
    artRef: 'apron',
    marginMode: 'on',
    shoulderMode: 'hidden',
    collisionEdge: 'shoulder',
    collisionEffect: 'reset'
  }),
  renderDebug: Object.freeze({
    lightingEnabled: true,
    terrainEnabled: true,
    texturesEnabled: true,
    detailEnabled: false,
    terrainCullingEnabled: true,
    terrainLodEnabled: true,
    terrainBudgetEnabled: true,
    farRoadDecimationEnabled: true,
    rawTerrainPolygonsEnabled: false
  })
});

export function applyStudioSprintGraphicSettings(race = {}) {
  if (!race || typeof race !== 'object') return race;
  race.groundRenderer = race.groundRenderer || STUDIO_SPRINT_GRAPHIC_SETTINGS.groundRenderer;
  race.groundTextureBaseWorldM = Number.isFinite(Number(race.groundTextureBaseWorldM))
    ? Number(race.groundTextureBaseWorldM)
    : STUDIO_SPRINT_GRAPHIC_SETTINGS.groundTextureBaseWorldM;
  race.groundTextureFilterMode = race.groundTextureFilterMode || STUDIO_SPRINT_GRAPHIC_SETTINGS.groundTextureFilterMode;
  race.skyboxArtRef = race.skyboxArtRef || STUDIO_SPRINT_GRAPHIC_SETTINGS.skyboxArtRef;
  race.surfaceArt = {
    ...STUDIO_SPRINT_GRAPHIC_SETTINGS.surfaceArt,
    ...(race.surfaceArt && typeof race.surfaceArt === 'object' ? race.surfaceArt : {})
  };
  race.margin = {
    ...STUDIO_SPRINT_GRAPHIC_SETTINGS.margin,
    ...(race.margin && typeof race.margin === 'object' ? race.margin : {})
  };
  race.renderDebug = {
    ...STUDIO_SPRINT_GRAPHIC_SETTINGS.renderDebug,
    ...(race.renderDebug && typeof race.renderDebug === 'object' ? race.renderDebug : {})
  };
  return race;
}

export const DEFAULT_AI_DRIVER = {
  id: 'rookie-ai',
  name: 'Rookie AI',
  carId: 'starter-rwd',
  aggression: 0.35,
  skill: 0.45,
  rubberBanding: 0.2,
  enabled: true
};

export const WRX_2022_SHARED_TUNING = {
  drivetrain: 'awd',
  powerHp: 271,
  torqueLbFt: 258,
  weightKg: 1495,
  frontWeightDistribution: 0.58,
  engineDisplacementL: 2.4,
  aspiration: 'Turbocharged',
  tireGrip: 1,
  brakeBalance: 0.56,
  brakePressure: 1,
  redlineRpm: 6100,
  revLimitRpm: 6300,
  revLimiterDropRpm: 360,
  idleRpm: 850,
  torquePeakStartRpm: 2000,
  torquePeakEndRpm: 5200,
  torqueFalloffRpm: 6500,
  wheelRadiusM: 0.337,
  topSpeedMph: 135,
  zeroToSixtySec: 5.8,
  dragCoefficient: 0.42,
  drivetrainEfficiency: 0.84,
  differentialAccel: 0.45,
  differentialDecel: 0.2,
  frontDifferentialAccel: 0.35,
  frontDifferentialDecel: 0.18,
  rearDifferentialAccel: 0.45,
  rearDifferentialDecel: 0.2,
  centerDifferentialBalance: 0.55,
  gearFinalDrive: 4.11,
  camberFront: -0.8,
  camberRear: -0.7,
  toeFront: 0,
  toeRear: 0.1,
  casterFront: 5.8,
  aeroFront: 0.25,
  aeroRear: 0.35,
  springFront: 0.5,
  springRear: 0.5,
  rideHeightFront: 0.5,
  rideHeightRear: 0.5,
  suspensionTravelFront: 0.5,
  suspensionTravelRear: 0.5,
  dampingFront: 0.5,
  dampingRear: 0.5,
  bumpFront: 0.48,
  bumpRear: 0.48,
  reboundFront: 0.52,
  reboundRear: 0.52,
  antiRollFront: 0.5,
  antiRollRear: 0.5
};

export const DEFAULT_RACE_CAR_SETUP = {
  defaultTireCompound: 'tarmac',
  tireCompoundByWheel: {
    fl: 'tarmac',
    fr: 'tarmac',
    rl: 'tarmac',
    rr: 'tarmac'
  },
  tirePressurePsi: {
    fl: 32,
    fr: 32,
    rl: 31,
    rr: 31
  },
  tireSize: {
    widthMm: 245,
    aspectRatio: 40,
    wheelDiameterIn: 18
  }
};

export const RACE_CAR_SHELL_FRAME_SLOTS = [
  'front',
  'frontRight',
  'right',
  'rearRight',
  'rear',
  'rearLeft',
  'left',
  'frontLeft'
];

export const DEFAULT_CAR_TUNING = {
  ...WRX_2022_SHARED_TUNING,
  shiftTimeMs: 420,
  clutchDelayMs: 90,
  launchRpm: 3200,
  autoUpshiftRpm: 5900,
  autoDownshiftRpm: 1750,
  gearRatios: [3.45, 1.95, 1.37, 0.97, 0.74, 0.67],
  reverseRatio: 3.33
};

export const WRX_2022_TRANSMISSIONS = {
  manual: {
    type: 'manual',
    label: '6MT',
    shiftMode: 'manual',
    shiftTimeMs: 420,
    clutchDelayMs: 90,
    launchRpm: 3200,
    autoUpshiftRpm: 5900,
    autoDownshiftRpm: 1750,
    gearRatios: [3.45, 1.95, 1.37, 0.97, 0.74, 0.67],
    reverseRatio: 3.33,
    gearFinalDrive: 4.11,
    drivetrainEfficiency: 0.84,
    engineProfile: 'wrx-flat-four-manual'
  },
  automatic: {
    type: 'automatic',
    label: 'SPT',
    shiftMode: 'automatic',
    shiftTimeMs: 220,
    clutchDelayMs: 0,
    launchRpm: 2600,
    autoUpshiftRpm: 5700,
    autoDownshiftRpm: 1550,
    torqueConverterSlip: 0.12,
    gearRatios: [3.49, 2.19, 1.55, 1.18, 0.92, 0.74, 0.58, 0.47],
    reverseRatio: 3.32,
    gearFinalDrive: 4.44,
    drivetrainEfficiency: 0.9,
    weightKg: 1603,
    zeroToSixtySec: 5.9,
    engineProfile: 'wrx-flat-four-cvt'
  }
};

export const BRZ_2022_TUNING = {
  drivetrain: 'rwd',
  powerHp: 228,
  torqueLbFt: 184,
  weightKg: 1277,
  frontWeightDistribution: 0.53,
  engineDisplacementL: 2.4,
  aspiration: 'Naturally Aspirated',
  tireGrip: 0.96,
  brakeBalance: 0.57,
  brakePressure: 1,
  redlineRpm: 7000,
  revLimitRpm: 7400,
  revLimiterDropRpm: 420,
  idleRpm: 760,
  torquePeakStartRpm: 3700,
  torquePeakEndRpm: 6900,
  torqueFalloffRpm: 7600,
  wheelRadiusM: 0.326,
  topSpeedMph: 140,
  zeroToSixtySec: 6.1,
  dragCoefficient: 0.35,
  accelerationCalibration: 1.24,
  drivetrainEfficiency: 0.86,
  differentialAccel: 0.5,
  differentialDecel: 0.25,
  rearDifferentialAccel: 0.5,
  rearDifferentialDecel: 0.25,
  gearFinalDrive: 4.10,
  camberFront: -0.9,
  camberRear: -1,
  toeFront: 0,
  toeRear: 0.12,
  casterFront: 6.1,
  aeroFront: 0.22,
  aeroRear: 0.28,
  springFront: 0.54,
  springRear: 0.56,
  rideHeightFront: 0.48,
  rideHeightRear: 0.5,
  suspensionTravelFront: 0.45,
  suspensionTravelRear: 0.45,
  dampingFront: 0.54,
  dampingRear: 0.55,
  bumpFront: 0.5,
  bumpRear: 0.52,
  reboundFront: 0.56,
  reboundRear: 0.57,
  antiRollFront: 0.52,
  antiRollRear: 0.58
};

export const BRZ_2022_TRANSMISSIONS = {
  manual: {
    type: 'manual',
    label: '6MT',
    shiftMode: 'manual',
    shiftTimeMs: 390,
    clutchDelayMs: 85,
    launchRpm: 3600,
    autoUpshiftRpm: 6800,
    autoDownshiftRpm: 2100,
    gearRatios: [3.63, 2.19, 1.54, 1.21, 1.0, 0.77],
    reverseRatio: 3.44,
    gearFinalDrive: 4.10,
    drivetrainEfficiency: 0.86,
    engineProfile: 'brz-flat-four-manual'
  },
  automatic: {
    type: 'automatic',
    label: '6AT',
    shiftMode: 'automatic',
    shiftTimeMs: 260,
    clutchDelayMs: 0,
    launchRpm: 2500,
    autoUpshiftRpm: 6100,
    autoDownshiftRpm: 1800,
    torqueConverterSlip: 0.1,
    gearRatios: [3.54, 2.06, 1.4, 1.0, 0.71, 0.58],
    reverseRatio: 3.17,
    gearFinalDrive: 3.91,
    drivetrainEfficiency: 0.84,
    weightKg: 1298,
    zeroToSixtySec: 6.6,
    engineProfile: 'brz-flat-four-auto'
  }
};

export const CIVIC_TYPE_R_2023_TUNING = {
  drivetrain: 'fwd',
  powerHp: 315,
  torqueLbFt: 310,
  weightKg: 1446,
  frontWeightDistribution: 0.62,
  engineDisplacementL: 2.0,
  aspiration: 'Turbocharged',
  tireGrip: 1.06,
  brakeBalance: 0.62,
  brakePressure: 1.05,
  redlineRpm: 7000,
  revLimitRpm: 7200,
  revLimiterDropRpm: 420,
  idleRpm: 800,
  torquePeakStartRpm: 2600,
  torquePeakEndRpm: 6500,
  torqueFalloffRpm: 7400,
  wheelRadiusM: 0.333,
  topSpeedMph: 169,
  zeroToSixtySec: 5.0,
  dragCoefficient: 0.36,
  accelerationCalibration: 0.94,
  drivetrainEfficiency: 0.87,
  differentialAccel: 0.58,
  differentialDecel: 0.28,
  frontDifferentialAccel: 0.58,
  frontDifferentialDecel: 0.28,
  gearFinalDrive: 3.84,
  camberFront: -1.1,
  camberRear: -1.0,
  toeFront: 0,
  toeRear: 0.1,
  casterFront: 6.2,
  aeroFront: 0.34,
  aeroRear: 0.5,
  springFront: 0.63,
  springRear: 0.58,
  rideHeightFront: 0.42,
  rideHeightRear: 0.44,
  suspensionTravelFront: 0.38,
  suspensionTravelRear: 0.38,
  dampingFront: 0.62,
  dampingRear: 0.58,
  bumpFront: 0.56,
  bumpRear: 0.54,
  reboundFront: 0.66,
  reboundRear: 0.62,
  antiRollFront: 0.64,
  antiRollRear: 0.56
};

export const CIVIC_TYPE_R_2023_TRANSMISSIONS = {
  manual: {
    type: 'manual',
    label: '6MT',
    shiftMode: 'manual',
    shiftTimeMs: 360,
    clutchDelayMs: 75,
    launchRpm: 3600,
    autoUpshiftRpm: 6750,
    autoDownshiftRpm: 2300,
    gearRatios: [3.63, 2.12, 1.53, 1.13, 0.91, 0.73],
    reverseRatio: 3.76,
    gearFinalDrive: 3.84,
    drivetrainEfficiency: 0.87,
    engineProfile: 'civic-type-r-manual'
  },
  automatic: {
    type: 'automatic',
    label: 'Auto Assist',
    shiftMode: 'automatic',
    shiftTimeMs: 210,
    clutchDelayMs: 0,
    launchRpm: 3200,
    autoUpshiftRpm: 6600,
    autoDownshiftRpm: 2200,
    torqueConverterSlip: 0.04,
    gearRatios: [3.63, 2.12, 1.53, 1.13, 0.91, 0.73],
    reverseRatio: 3.76,
    gearFinalDrive: 3.84,
    drivetrainEfficiency: 0.87,
    zeroToSixtySec: 4.6,
    engineProfile: 'civic-type-r-manual'
  }
};

export const RACE_STOCK_PERFORMANCE_TARGETS = {
  'starter-rwd': {
    carName: '2022 Subaru WRX',
    source: 'real-world',
    zeroToSixtySec: [4.8, 5.6],
    quarterMileSec: [13.5, 14.3],
    quarterMileTrapMph: [97, 103],
    topSpeedMph: [132, 138],
    lateralG: [0.90, 0.98],
    braking70To0Ft: [154, 168]
  },
  'subaru-brz-2022': {
    carName: '2022 Subaru BRZ',
    source: 'real-world',
    zeroToSixtySec: [5.3, 6.8],
    quarterMileSec: [13.8, 15.2],
    quarterMileTrapMph: [96, 102],
    topSpeedMph: [136, 145],
    lateralG: [0.88, 1.00],
    braking70To0Ft: [148, 168]
  },
  'honda-civic-type-r-2023': {
    carName: '2023 Honda Civic Type R',
    source: 'real-world',
    zeroToSixtySec: [4.8, 5.4],
    quarterMileSec: [13.2, 13.9],
    quarterMileTrapMph: [103, 109],
    topSpeedMph: [165, 171],
    lateralG: [0.98, 1.08],
    braking70To0Ft: [142, 156]
  }
};

export function createDefaultCar(id = 'starter-rwd') {
  const templates = {
    'starter-rwd': {
      id: 'starter-rwd',
      name: '2022 Subaru WRX',
      dimensions: { ...RACE_CAR_DIMENSIONS['wrx-2022'] },
      tuning: { ...DEFAULT_CAR_TUNING },
      transmissions: WRX_2022_TRANSMISSIONS,
      defaultTransmissionType: 'automatic',
      engineProfile: 'wrx-flat-four-cvt'
    },
    'wrx-2022-automatic': {
      id: 'starter-rwd',
      name: '2022 Subaru WRX',
      dimensions: { ...RACE_CAR_DIMENSIONS['wrx-2022'] },
      tuning: { ...DEFAULT_CAR_TUNING },
      transmissions: WRX_2022_TRANSMISSIONS,
      defaultTransmissionType: 'automatic',
      engineProfile: 'wrx-flat-four-cvt'
    },
    'subaru-brz-2022': {
      id: 'subaru-brz-2022',
      name: '2022 Subaru BRZ',
      dimensions: { ...RACE_CAR_DIMENSIONS['brz-2022'] },
      tuning: { ...BRZ_2022_TUNING },
      transmissions: BRZ_2022_TRANSMISSIONS,
      defaultTransmissionType: 'automatic',
      engineProfile: 'brz-flat-four-auto'
    },
    'honda-civic-type-r-2023': {
      id: 'honda-civic-type-r-2023',
      name: '2023 Honda Civic Type R',
      dimensions: { ...RACE_CAR_DIMENSIONS['civic-type-r-2023'] },
      tuning: { ...CIVIC_TYPE_R_2023_TUNING },
      transmissions: CIVIC_TYPE_R_2023_TRANSMISSIONS,
      defaultTransmissionType: 'automatic',
      engineProfile: 'civic-type-r-manual'
    }
  };
  const template = templates[id] || templates['starter-rwd'];
  return {
    id: template.id,
    name: template.name,
    class: 'road',
    art: {
      shell: null,
      tires: [],
      spoilers: [],
      turnFrames: {
        left: null,
        center: null,
        right: null
      },
      shellFrames: {
        mode: '8-way',
        artRef: null,
        slots: Object.fromEntries(RACE_CAR_SHELL_FRAME_SLOTS.map((slot) => [slot, null])),
        reverseFrameIndex: null
      },
      tireTreads: Object.fromEntries(RACE_TIRE_COMPOUNDS.map((compound) => [
        compound.id,
        { artRef: null, frameIndex: 0 }
      ])),
      addOns: []
    },
    dimensions: { ...(template.dimensions || RACE_CAR_DIMENSIONS['wrx-2022']) },
    audio: {
      engineSoundId: null,
      engineProfile: template.engineProfile
    },
    setup: {
      defaultTireCompound: DEFAULT_RACE_CAR_SETUP.defaultTireCompound,
      tireCompoundByWheel: { ...DEFAULT_RACE_CAR_SETUP.tireCompoundByWheel },
      tirePressurePsi: { ...DEFAULT_RACE_CAR_SETUP.tirePressurePsi },
      tireSize: { ...DEFAULT_RACE_CAR_SETUP.tireSize }
    },
    defaultTransmissionType: template.defaultTransmissionType,
    transmissions: {
      manual: { ...template.transmissions.manual },
      automatic: { ...template.transmissions.automatic }
    },
    tuning: template.tuning
  };
}

export function createBuiltInRaceCars() {
  return [
    createDefaultCar(),
    createDefaultCar('subaru-brz-2022'),
    createDefaultCar('honda-civic-type-r-2023')
  ];
}

export function createDefaultRace(id = 'test-loop') {
  const laneCount = DEFAULT_RACE_LANE_COUNT;
  const laneWidthM = RACE_LANE_WIDTH_M;
  return {
    id,
    name: 'Studio Sprint',
    type: 'circuit',
    laps: 3,
    weather: 'clear',
    timeOfDay: 'day',
    entryBehavior: 'return-to-origin',
    finishBehavior: {
      type: 'return-to-origin',
      targetLevel: null,
      targetRace: null
    },
    road: {
      laneCount,
      laneWidthM,
      width: laneCount * laneWidthM,
      selectedGroundTileId: 'grass',
      groundTiles: [],
      tileMap: {
        cellSizeM: 5,
        defaultTileId: 'grass',
        minElevation: -0.42,
        maxElevation: 0.42,
        cells: {}
      },
      nodes: [
        { x: 0, y: 0, elevation: 0, role: 'start', locked: true }
      ],
      segments: [
        { length: 180, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] },
        { length: 120, curve: 0.55, elevation: 0.08, surface: 'asphalt', codriver: 'medium-right' },
        { length: 150, curve: -0.35, elevation: -0.04, surface: 'dirt', hazardIds: [] },
        { length: 110, curve: 0.9, elevation: 0.02, surface: 'gravel', turn: 'square', codriver: 'square-right' },
        { length: 180, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] }
      ]
    },
    competition: {
      mode: 'solo',
      aiDrivers: [{ ...DEFAULT_AI_DRIVER, enabled: false }],
      playerStartGrid: 1,
      trafficEnabled: false
    },
    hazards: [],
    codriver: {
      enabled: true,
      voice: 'default',
      calls: [
        { id: 'medium-right', at: 190, text: 'Medium right over crest', severity: 2 },
        { id: 'square-right', at: 430, text: 'Square right, gravel, do not cut', severity: 4 },
        { id: 'jump-ahead', at: 620, text: 'Jump ahead, stay center', severity: 3 }
      ]
    },
    scenery: []
  };
}

function getTemplatePerimeter(points = []) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    length += Math.hypot(Number(next.x || 0) - Number(previous.x || 0), Number(next.y || 0) - Number(previous.y || 0));
  }
  return Math.max(1, length);
}

function buildScaledRaceNodes(points = [], targetLength = 1000) {
  const scale = Math.max(1, Number(targetLength) || 1000) / getTemplatePerimeter(points);
  return points.map((point, index) => ({
    x: Math.round(Number(point.x || 0) * scale),
    y: Math.round(Number(point.y || 0) * scale),
    elevation: Number(point.elevation || 0),
    ...(index === 0 ? { role: 'start', locked: true } : {})
  }));
}

function buildSegmentsFromNodes(nodes = [], segmentHints = [], defaultRoadWidthM = 11) {
  const segments = [];
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1];
    const next = nodes[index];
    const hint = segmentHints[index - 1] || {};
    const length = Math.max(35, Math.round(Math.hypot(Number(next.x || 0) - Number(previous.x || 0), Number(next.y || 0) - Number(previous.y || 0))));
    segments.push({
      length,
      curve: Number(hint.curve || 0),
      elevation: Number(next.elevation || 0),
      surface: hint.surface || 'asphalt',
      roadWidthM: Number(hint.roadWidthM || hint.roadWidth || defaultRoadWidthM) || defaultRoadWidthM,
      bumpiness: Number.isFinite(Number(hint.bumpiness)) ? Number(hint.bumpiness) : 0,
      ...(hint.snowCondition ? { snowCondition: hint.snowCondition } : {}),
      ...(hint.turn ? { turn: hint.turn } : {}),
      ...(hint.codriver ? { codriver: hint.codriver } : {}),
      ...(hint.hazardIds ? { hazardIds: hint.hazardIds.slice() } : { hazardIds: [] }),
      ...(hint.banking ? { banking: hint.banking } : {})
    });
  }
  return segments;
}

function createRaceTemplate({
  id,
  name,
  targetLength,
  type = 'circuit',
  laps = 1,
  weather = 'clear',
  timeOfDay = 'day',
  roadWidth = 11,
  selectedGroundTileId = 'grass',
  points = [],
  segmentHints = [],
  hazards = [],
  calls = [],
  scenery = [],
  referenceNotes = [],
  referenceFacts = {}
}) {
  const nodes = buildScaledRaceNodes(points, targetLength);
  const segments = buildSegmentsFromNodes(nodes, segmentHints, roadWidth);
  return {
    id,
    name,
    type,
    laps,
    weather,
    timeOfDay,
    entryBehavior: 'return-to-origin',
    finishBehavior: {
      type: 'return-to-origin',
      targetLevel: null,
      targetRace: null
    },
    referenceNotes,
    referenceFacts,
    road: {
      width: roadWidth,
      selectedGroundTileId,
      groundTiles: [],
      tileMap: {
        cellSizeM: 5,
        defaultTileId: selectedGroundTileId || 'grass',
        minElevation: -0.42,
        maxElevation: 0.42,
        cells: {}
      },
      nodes,
      segments
    },
    competition: {
      mode: type === 'circuit' ? 'ai-race' : 'solo',
      aiDrivers: [{ ...DEFAULT_AI_DRIVER, enabled: type === 'circuit' }],
      playerStartGrid: 1,
      trafficEnabled: false
    },
    hazards,
    codriver: {
      enabled: true,
      voice: 'default',
      calls
    },
    scenery
  };
}

const LAGUNA_SECA_POINTS = [
  { x: 0, y: 0, elevation: 0.02 },
  { x: 0.3, y: -0.95, elevation: 0.06 },
  { x: 0.9, y: -1.1, elevation: 0.08 },
  { x: 1.24, y: -0.74, elevation: 0.12 },
  { x: 1.02, y: -0.2, elevation: 0.16 },
  { x: 0.42, y: 0.12, elevation: 0.22 },
  { x: -0.05, y: 0.42, elevation: 0.34 },
  { x: -0.28, y: 0.72, elevation: 0.42 },
  { x: -0.1, y: 0.94, elevation: 0.18 },
  { x: 0.42, y: 0.78, elevation: 0.1 },
  { x: 0.65, y: 0.32, elevation: 0.04 },
  { x: 0, y: 0, elevation: 0.02 }
];

const LAGUNA_SECA_SEGMENTS = [
  { curve: 0.15, surface: 'asphalt' },
  { curve: 0.42, surface: 'asphalt', codriver: 'laguna-andretti' },
  { curve: 0.35, surface: 'asphalt' },
  { curve: -0.38, surface: 'asphalt' },
  { curve: -0.22, surface: 'asphalt' },
  { curve: 0.28, surface: 'asphalt' },
  { curve: -0.92, surface: 'asphalt', turn: 'square', codriver: 'laguna-corkscrew', hazardIds: ['laguna-corkscrew-drop'] },
  { curve: 0.72, surface: 'asphalt', codriver: 'laguna-rainey' },
  { curve: 0.2, surface: 'asphalt' },
  { curve: -0.58, surface: 'asphalt', codriver: 'laguna-final-left' },
  { curve: -0.18, surface: 'asphalt' }
];

const DAYTONA_POINTS = [
  { x: 0, y: 0, elevation: 0 },
  { x: 0.18, y: -1.75, elevation: 0 },
  { x: 1.0, y: -2.0, elevation: 0.01 },
  { x: 1.75, y: -1.42, elevation: 0.01 },
  { x: 1.78, y: 0.42, elevation: 0 },
  { x: 1.1, y: 1.08, elevation: 0 },
  { x: 0.28, y: 1.05, elevation: 0 },
  { x: -0.08, y: 0.42, elevation: 0 },
  { x: 0, y: 0, elevation: 0 }
];

const DAYTONA_SEGMENTS = [
  { curve: 0.08, surface: 'asphalt', banking: 18 },
  { curve: 0.7, surface: 'asphalt', banking: 31, codriver: 'daytona-turn-one' },
  { curve: 0.82, surface: 'asphalt', banking: 31 },
  { curve: 0.08, surface: 'asphalt', banking: 3, codriver: 'daytona-backstretch' },
  { curve: 0.72, surface: 'asphalt', banking: 31 },
  { curve: 0.66, surface: 'asphalt', banking: 31 },
  { curve: 0.28, surface: 'asphalt', banking: 18, codriver: 'daytona-trioval' },
  { curve: 0.14, surface: 'asphalt', banking: 18 }
];

const NORDSCHLEIFE_POINTS = [
  { x: 0, y: 0, elevation: 0.02 },
  { x: 0.15, y: -0.55, elevation: 0.04 },
  { x: -0.05, y: -1.15, elevation: 0.12 },
  { x: 0.42, y: -1.52, elevation: 0.2 },
  { x: 1.05, y: -1.45, elevation: 0.3 },
  { x: 1.62, y: -1.78, elevation: 0.18 },
  { x: 2.2, y: -1.42, elevation: 0.08 },
  { x: 2.05, y: -0.92, elevation: -0.08 },
  { x: 2.48, y: -0.42, elevation: -0.18 },
  { x: 2.18, y: 0.08, elevation: -0.24 },
  { x: 2.52, y: 0.68, elevation: -0.18 },
  { x: 1.94, y: 1.06, elevation: -0.1 },
  { x: 1.48, y: 1.64, elevation: 0.02 },
  { x: 0.88, y: 1.48, elevation: 0.16 },
  { x: 0.42, y: 1.9, elevation: 0.32 },
  { x: -0.18, y: 1.58, elevation: 0.22 },
  { x: -0.72, y: 1.12, elevation: 0.1 },
  { x: -0.45, y: 0.55, elevation: -0.02 },
  { x: -0.82, y: 0.12, elevation: -0.12 },
  { x: 0, y: 0, elevation: 0.02 }
];

const NORDSCHLEIFE_SEGMENTS = [
  { curve: 0.15, surface: 'asphalt', codriver: 'nurb-hatzenbach' },
  { curve: -0.42, surface: 'asphalt' },
  { curve: 0.38, surface: 'asphalt', codriver: 'nurb-flugplatz', hazardIds: ['nurb-flugplatz-crest'] },
  { curve: 0.28, surface: 'asphalt' },
  { curve: -0.48, surface: 'asphalt', codriver: 'nurb-foxhole' },
  { curve: 0.68, surface: 'asphalt' },
  { curve: 0.36, surface: 'asphalt', hazardIds: ['nurb-adenauer-curb'] },
  { curve: -0.62, surface: 'asphalt' },
  { curve: 0.78, surface: 'asphalt', codriver: 'nurb-karussell', turn: 'square' },
  { curve: -0.5, surface: 'asphalt' },
  { curve: 0.58, surface: 'asphalt' },
  { curve: -0.3, surface: 'asphalt' },
  { curve: -0.72, surface: 'asphalt', codriver: 'nurb-brunnchen' },
  { curve: 0.44, surface: 'asphalt' },
  { curve: -0.62, surface: 'asphalt' },
  { curve: -0.2, surface: 'asphalt' },
  { curve: 0.66, surface: 'asphalt', codriver: 'nurb-dottinger' },
  { curve: -0.22, surface: 'asphalt' },
  { curve: 0.16, surface: 'asphalt' }
];

const TURINI_POINTS = [
  { x: 0, y: 0, elevation: -0.34 },
  { x: 0.12, y: -0.18, elevation: -0.3 },
  { x: -0.18, y: -0.34, elevation: -0.26 },
  { x: 0.24, y: -0.5, elevation: -0.22 },
  { x: -0.12, y: -0.66, elevation: -0.18 },
  { x: 0.3, y: -0.82, elevation: -0.14 },
  { x: -0.22, y: -0.98, elevation: -0.1 },
  { x: 0.18, y: -1.14, elevation: -0.04 },
  { x: -0.3, y: -1.28, elevation: 0.02 },
  { x: 0.24, y: -1.44, elevation: 0.08 },
  { x: -0.14, y: -1.6, elevation: 0.14 },
  { x: 0.36, y: -1.78, elevation: 0.2 },
  { x: -0.06, y: -1.94, elevation: 0.26 },
  { x: 0.42, y: -2.1, elevation: 0.33 },
  { x: 0.02, y: -2.26, elevation: 0.39 },
  { x: 0.52, y: -2.42, elevation: 0.42 },
  { x: 0.16, y: -2.58, elevation: 0.4 },
  { x: 0.62, y: -2.74, elevation: 0.36 },
  { x: 0.22, y: -2.9, elevation: 0.31 },
  { x: 0.7, y: -3.06, elevation: 0.26 },
  { x: 0.3, y: -3.22, elevation: 0.2 },
  { x: 0.78, y: -3.38, elevation: 0.14 },
  { x: 0.42, y: -3.54, elevation: 0.08 },
  { x: 0.88, y: -3.7, elevation: 0.02 },
  { x: 0.48, y: -3.86, elevation: -0.04 },
  { x: 0.94, y: -4.02, elevation: -0.08 },
  { x: 0.58, y: -4.18, elevation: -0.12 },
  { x: 1.02, y: -4.34, elevation: -0.16 },
  { x: 0.68, y: -4.5, elevation: -0.18 },
  { x: 1.1, y: -4.66, elevation: -0.2 },
  { x: 0.78, y: -4.82, elevation: -0.22 },
  { x: 1.18, y: -4.98, elevation: -0.2 },
  { x: 0.92, y: -5.14, elevation: -0.18 },
  { x: 1.28, y: -5.3, elevation: -0.16 },
  { x: 1.06, y: -5.46, elevation: -0.14 },
  { x: 1.38, y: -5.62, elevation: -0.12 }
];

const TURINI_SEGMENTS = [
  { curve: 0.62, surface: 'asphalt', turn: 'square', codriver: 'turini-hairpin-1' },
  { curve: -0.92, surface: 'asphalt', turn: 'square' },
  { curve: 0.88, surface: 'asphalt', turn: 'square' },
  { curve: -0.74, surface: 'asphalt', turn: 'square' },
  { curve: 0.86, surface: 'asphalt', turn: 'square' },
  { curve: -0.94, surface: 'asphalt', turn: 'square', codriver: 'turini-climb' },
  { curve: 0.72, surface: 'wet-asphalt', turn: 'square' },
  { curve: -0.9, surface: 'wet-asphalt', turn: 'square' },
  { curve: 0.82, surface: 'wet-asphalt', turn: 'square' },
  { curve: -0.78, surface: 'wet-asphalt', turn: 'square' },
  { curve: 0.92, surface: 'wet-asphalt', turn: 'square' },
  { curve: -0.86, surface: 'wet-asphalt', turn: 'square' },
  { curve: 0.76, surface: 'snow', turn: 'square', codriver: 'turini-snowline', hazardIds: ['turini-ice-patch'], snowCondition: 'slush' },
  { curve: -0.9, surface: 'snow', turn: 'square', snowCondition: 'dusting' },
  { curve: 0.86, surface: 'snow', turn: 'square', snowCondition: 'ice' },
  { curve: -0.72, surface: 'snow', turn: 'square', snowCondition: 'three-inch' },
  { curve: 0.82, surface: 'snow', turn: 'square', snowCondition: 'dusting' },
  { curve: -0.88, surface: 'snow', turn: 'square', snowCondition: 'ice' },
  { curve: 0.7, surface: 'wet-asphalt', turn: 'square', codriver: 'turini-descent' },
  { curve: -0.84, surface: 'wet-asphalt', turn: 'square' },
  { curve: 0.8, surface: 'wet-asphalt', turn: 'square' },
  { curve: -0.66, surface: 'wet-asphalt', turn: 'square' },
  { curve: 0.76, surface: 'wet-asphalt', turn: 'square' },
  { curve: -0.82, surface: 'wet-asphalt', turn: 'square' },
  { curve: 0.62, surface: 'asphalt', turn: 'square' },
  { curve: -0.72, surface: 'asphalt', turn: 'square' },
  { curve: 0.68, surface: 'asphalt', turn: 'square' },
  { curve: -0.58, surface: 'asphalt' },
  { curve: 0.54, surface: 'asphalt' },
  { curve: -0.48, surface: 'asphalt' },
  { curve: 0.46, surface: 'asphalt' },
  { curve: -0.42, surface: 'asphalt' },
  { curve: 0.38, surface: 'asphalt' },
  { curve: -0.34, surface: 'asphalt' },
  { curve: 0.28, surface: 'asphalt' }
];

const OUNINPOHJA_POINTS = [
  { x: 0, y: 0, elevation: -0.18 },
  { x: 0.28, y: -0.28, elevation: -0.14 },
  { x: 0.52, y: -0.68, elevation: -0.08 },
  { x: 0.34, y: -1.05, elevation: -0.02 },
  { x: 0.72, y: -1.38, elevation: 0.04 },
  { x: 1.05, y: -1.76, elevation: 0.12 },
  { x: 0.84, y: -2.16, elevation: 0.2 },
  { x: 1.18, y: -2.48, elevation: 0.28 },
  { x: 1.54, y: -2.86, elevation: 0.2 },
  { x: 1.3, y: -3.24, elevation: 0.12 },
  { x: 1.72, y: -3.58, elevation: 0.18 },
  { x: 2.08, y: -3.98, elevation: 0.28 },
  { x: 1.82, y: -4.36, elevation: 0.18 },
  { x: 2.22, y: -4.72, elevation: 0.1 },
  { x: 2.62, y: -5.04, elevation: 0.2 },
  { x: 2.36, y: -5.42, elevation: 0.32 },
  { x: 2.76, y: -5.76, elevation: 0.22 },
  { x: 3.18, y: -6.1, elevation: 0.1 },
  { x: 2.92, y: -6.48, elevation: 0.02 },
  { x: 3.34, y: -6.82, elevation: 0.12 },
  { x: 3.72, y: -7.16, elevation: 0.22 },
  { x: 3.48, y: -7.54, elevation: 0.16 },
  { x: 3.88, y: -7.88, elevation: 0.08 },
  { x: 4.24, y: -8.28, elevation: 0.18 },
  { x: 4.0, y: -8.66, elevation: 0.26 },
  { x: 4.38, y: -9.02, elevation: 0.18 },
  { x: 4.74, y: -9.34, elevation: 0.06 },
  { x: 4.48, y: -9.72, elevation: -0.02 },
  { x: 4.88, y: -10.06, elevation: 0.04 },
  { x: 5.22, y: -10.42, elevation: 0.14 },
  { x: 5.0, y: -10.8, elevation: 0.08 },
  { x: 5.36, y: -11.16, elevation: 0.0 },
  { x: 5.72, y: -11.52, elevation: -0.04 },
  { x: 5.5, y: -11.9, elevation: -0.08 },
  { x: 5.88, y: -12.28, elevation: -0.04 }
];

const OUNINPOHJA_SEGMENTS = [
  { curve: 0.18, surface: 'gravel', codriver: 'ounin-fast', bumpiness: 0.18 },
  { curve: 0.24, surface: 'gravel', bumpiness: 0.22 },
  { curve: -0.34, surface: 'gravel', hazardIds: ['ounin-yellow-house-jump'], bumpiness: 0.3 },
  { curve: 0.28, surface: 'gravel', bumpiness: 0.18 },
  { curve: 0.36, surface: 'gravel', hazardIds: ['ounin-crest-jump-1'], bumpiness: 0.34 },
  { curve: -0.32, surface: 'gravel', bumpiness: 0.26 },
  { curve: 0.24, surface: 'gravel', bumpiness: 0.22 },
  { curve: 0.3, surface: 'gravel', bumpiness: 0.32 },
  { curve: -0.28, surface: 'gravel', bumpiness: 0.2 },
  { curve: 0.34, surface: 'gravel', codriver: 'ounin-max-attack', bumpiness: 0.26 },
  { curve: 0.26, surface: 'gravel', hazardIds: ['ounin-crest-jump-2'], bumpiness: 0.36 },
  { curve: -0.36, surface: 'gravel', bumpiness: 0.28 },
  { curve: 0.3, surface: 'gravel', bumpiness: 0.2 },
  { curve: 0.38, surface: 'gravel', bumpiness: 0.24 },
  { curve: -0.34, surface: 'gravel', hazardIds: ['ounin-long-jump'], bumpiness: 0.38 },
  { curve: 0.28, surface: 'gravel', bumpiness: 0.22 },
  { curve: 0.32, surface: 'gravel', bumpiness: 0.2 },
  { curve: -0.3, surface: 'gravel', bumpiness: 0.24 },
  { curve: 0.36, surface: 'gravel', bumpiness: 0.3 },
  { curve: 0.24, surface: 'gravel', bumpiness: 0.2 },
  { curve: -0.32, surface: 'gravel', bumpiness: 0.26 },
  { curve: 0.28, surface: 'gravel', bumpiness: 0.24 },
  { curve: 0.34, surface: 'gravel', bumpiness: 0.28 },
  { curve: -0.28, surface: 'gravel', bumpiness: 0.22 },
  { curve: 0.3, surface: 'gravel', bumpiness: 0.2 },
  { curve: 0.26, surface: 'gravel', bumpiness: 0.18 },
  { curve: -0.34, surface: 'gravel', bumpiness: 0.24 },
  { curve: 0.32, surface: 'gravel', bumpiness: 0.28 },
  { curve: 0.22, surface: 'gravel', bumpiness: 0.2 },
  { curve: -0.3, surface: 'gravel', bumpiness: 0.22 },
  { curve: 0.28, surface: 'gravel', bumpiness: 0.24 },
  { curve: 0.24, surface: 'gravel', bumpiness: 0.18 },
  { curve: -0.26, surface: 'gravel', bumpiness: 0.2 },
  { curve: 0.22, surface: 'gravel', codriver: 'ounin-finish', bumpiness: 0.18 }
];

export function createTestTrackRace(id) {
  switch (id) {
    case 'weathertech-raceway':
    case 'laguna-seca':
      return createRaceTemplate({
        id: 'weathertech-raceway',
        name: 'WeatherTech Raceway Laguna Seca',
        targetLength: 3602,
        type: 'circuit',
        laps: 3,
        roadWidth: 10,
        points: LAGUNA_SECA_POINTS,
        segmentHints: LAGUNA_SECA_SEGMENTS,
        hazards: [
          { id: 'laguna-corkscrew-drop', type: 'jump', label: 'Corkscrew Drop', at: 2450, lane: 0, height: 0.32, landingForgiveness: 0.62 }
        ],
        calls: [
          { id: 'laguna-andretti', at: 620, text: 'Andretti hairpin, double apex', severity: 3 },
          { id: 'laguna-corkscrew', at: 2320, text: 'Corkscrew, blind drop left right', severity: 4 },
          { id: 'laguna-rainey', at: 2700, text: 'Rainey curve downhill', severity: 3 },
          { id: 'laguna-final-left', at: 3250, text: 'Final left onto straight', severity: 2 }
        ],
        scenery: [
          { type: 'sign', at: 2100, side: 'right' },
          { type: 'tower', at: 2460, side: 'left' }
        ],
        referenceNotes: [
          '3.602 km paved circuit with 11 turns and about 180 ft of total elevation change.',
          'The Corkscrew is modeled as the signature blind drop through Turns 8/8A.',
          'All race segments use asphalt because the real circuit is paved.'
        ],
        referenceFacts: {
          referenceBasis: 'WeatherTech Raceway Laguna Seca Grand Prix Circuit',
          sourceLengthKm: 3.602,
          surface: 'paved',
          turns: 11,
          elevationChangeFt: 180,
          roadWidthM: 10,
          signatureSections: ['Andretti Hairpin', 'Corkscrew', 'Rainey Curve']
        }
      });
    case 'nurburgring-nordschleife':
    case 'nordschleife':
    case 'nurburgring':
    case 'nürburgring':
      return createRaceTemplate({
        id: 'nurburgring-nordschleife',
        name: 'Nurburgring Nordschleife',
        targetLength: 20832,
        type: 'circuit',
        laps: 1,
        roadWidth: 9,
        points: NORDSCHLEIFE_POINTS,
        segmentHints: NORDSCHLEIFE_SEGMENTS,
        hazards: [
          { id: 'nurb-flugplatz-crest', type: 'jump', label: 'Flugplatz Crest', at: 2750, lane: 0, height: 0.38, landingForgiveness: 0.5 },
          { id: 'nurb-adenauer-curb', type: 'damage-wall', label: 'Adenauer Curb', at: 7200, side: 'right', damage: 12, destructible: false }
        ],
        calls: [
          { id: 'nurb-hatzenbach', at: 900, text: 'Hatzenbach, technical bends', severity: 2 },
          { id: 'nurb-flugplatz', at: 2500, text: 'Flugplatz crest, keep car settled', severity: 3 },
          { id: 'nurb-foxhole', at: 6200, text: 'Foxhole compression', severity: 3 },
          { id: 'nurb-karussell', at: 10300, text: 'Karussell, very tight banked left', severity: 4 },
          { id: 'nurb-brunnchen', at: 14700, text: 'Brunnchen, spectators right', severity: 3 },
          { id: 'nurb-dottinger', at: 18400, text: 'Dottinger Hohe, long flat out', severity: 1 }
        ],
        scenery: [
          { type: 'tree', at: 1000, side: 'left' },
          { type: 'tree', at: 9200, side: 'right' },
          { type: 'sign', at: 14700, side: 'right' }
        ],
        referenceNotes: [
          '20.832 km Nordschleife layout with asphalt/concrete surface and more than 300 m of elevation change.',
          'The template emphasizes crests, compressions, the Karussell, and the Dottinger Hohe straight.',
          'A single lap is used because the real circuit length is already a long endurance-style test.'
        ],
        referenceFacts: {
          referenceBasis: 'Nurburgring Nordschleife modern north loop',
          sourceLengthKm: 20.832,
          surface: 'asphalt/concrete',
          elevationChangeM: 300,
          roadWidthM: 9,
          signatureSections: ['Hatzenbach', 'Flugplatz', 'Fuchsröhre', 'Karussell', 'Brunnchen', 'Dottinger Hohe']
        }
      });
    case 'col-de-turini':
      return createRaceTemplate({
        id: 'col-de-turini',
        name: 'Col de Turini',
        targetLength: 31500,
        type: 'destination',
        laps: 1,
        weather: 'snow',
        roadWidth: 6,
        selectedGroundTileId: 'snow',
        points: TURINI_POINTS,
        segmentHints: TURINI_SEGMENTS,
        hazards: [
          { id: 'turini-ice-patch', type: 'damage-wall', label: 'Ice Patch Edge', at: 17200, side: 'left', damage: 10, destructible: false }
        ],
        calls: [
          { id: 'turini-hairpin-1', at: 900, text: 'Hairpin right, narrow mountain road', severity: 4 },
          { id: 'turini-climb', at: 10300, text: 'Climbing, wet asphalt, repeated hairpins', severity: 4 },
          { id: 'turini-snowline', at: 16900, text: 'Snow line, grip drops sharply', severity: 4 },
          { id: 'turini-descent', at: 24600, text: 'Descent begins, wet patches', severity: 3 }
        ],
        scenery: [
          { type: 'tree', at: 1200, side: 'left' },
          { type: 'sign', at: 16000, side: 'right' }
        ],
        referenceNotes: [
          'Monte Carlo Rally mountain-pass route modeled as a 31.5 km destination stage.',
          'The road climbs toward the 1607 m Col de Turini pass before descending.',
          'Surface transitions from asphalt to wet asphalt to snow near the pass to model winter rally conditions.'
        ],
        referenceFacts: {
          referenceBasis: 'Monte Carlo Rally Col de Turini mountain-pass stage',
          sourceLengthKm: 31.5,
          passElevationM: 1607,
          roadWidthM: 6,
          surfaceSequence: ['asphalt', 'wet-asphalt', 'snow', 'wet-asphalt', 'asphalt'],
          signatureSections: ['narrow hairpins', 'snowline', 'mountain descent']
        }
      });
    case 'ouninpohja':
      return createRaceTemplate({
        id: 'ouninpohja',
        name: 'Ouninpohja',
        targetLength: 33000,
        type: 'destination',
        laps: 1,
        roadWidth: 6,
        selectedGroundTileId: 'gravel',
        points: OUNINPOHJA_POINTS,
        segmentHints: OUNINPOHJA_SEGMENTS,
        hazards: [
          { id: 'ounin-yellow-house-jump', type: 'jump', label: 'Yellow House Jump', at: 5200, lane: 0, height: 0.72, landingForgiveness: 0.38 },
          { id: 'ounin-crest-jump-1', type: 'jump', label: 'Blind Crest Jump', at: 11800, lane: 0, height: 0.52, landingForgiveness: 0.45 },
          { id: 'ounin-crest-jump-2', type: 'jump', label: 'Fast Crest', at: 18200, lane: 0, height: 0.44, landingForgiveness: 0.48 },
          { id: 'ounin-long-jump', type: 'jump', label: 'Long Jump', at: 24500, lane: 0, height: 0.62, landingForgiveness: 0.42 }
        ],
        calls: [
          { id: 'ounin-fast', at: 1200, text: 'Fast gravel, small crests', severity: 2 },
          { id: 'ounin-max-attack', at: 17400, text: 'Very fast over jumps, keep straight', severity: 4 },
          { id: 'ounin-finish', at: 30600, text: 'Final fast gravel sequence', severity: 3 }
        ],
        scenery: [
          { type: 'tree', at: 900, side: 'left' },
          { type: 'tree', at: 9600, side: 'right' },
          { type: 'sign', at: 5200, side: 'left' }
        ],
        referenceNotes: [
          'Rally Finland gravel destination stage modeled at about 33 km.',
          'The route focuses on high-speed gravel, blind crests, and repeated jumps.',
          'Elevation range is represented as rolling terrain rather than a mountain pass.'
        ],
        referenceFacts: {
          referenceBasis: 'Rally Finland Ouninpohja gravel special stage',
          sourceLengthKm: 33,
          surface: 'gravel',
          elevationRangeM: [97, 180],
          roadWidthM: 6,
          signatureSections: ['Yellow House Jump', 'blind crests', 'fast gravel sweepers']
        }
      });
    case 'daytona-tri-oval':
    case 'daytona':
      return createRaceTemplate({
        id: 'daytona-tri-oval',
        name: 'Daytona Tri-Oval',
        targetLength: 4023,
        type: 'circuit',
        laps: 5,
        roadWidth: 24,
        points: DAYTONA_POINTS,
        segmentHints: DAYTONA_SEGMENTS,
        calls: [
          { id: 'daytona-turn-one', at: 900, text: 'High bank turn one, hold throttle', severity: 2 },
          { id: 'daytona-backstretch', at: 2050, text: 'Backstretch, draft zone', severity: 1 },
          { id: 'daytona-trioval', at: 3450, text: 'Tri-oval, banking eases at line', severity: 2 }
        ],
        scenery: [
          { type: 'tower', at: 200, side: 'right' },
          { type: 'sign', at: 2050, side: 'left' }
        ],
        referenceNotes: [
          '2.5 mile asphalt tri-oval modeled as a 4.023 km circuit.',
          'High banked turns use 31 degrees while the tri-oval/front-stretch banking uses 18 degrees.',
          'The wider road width reflects Daytona superspeedway lane count and drafting room.'
        ],
        referenceFacts: {
          referenceBasis: 'Daytona International Speedway tri-oval',
          sourceLengthMi: 2.5,
          sourceLengthKm: 4.023,
          surface: 'asphalt',
          roadWidthM: 24,
          bankingDegrees: {
            turns: 31,
            triOval: 18,
            backstretch: 3
          },
          signatureSections: ['turn one banking', 'superstretch', 'tri-oval']
        }
      });
    default:
      return createDefaultRace(id || 'test-loop');
  }
}

export function createBuiltInTestRaces() {
  return [
    createTestTrackRace('weathertech-raceway'),
    createTestTrackRace('nurburgring-nordschleife'),
    createTestTrackRace('col-de-turini'),
    createTestTrackRace('ouninpohja'),
    createTestTrackRace('daytona-tri-oval')
  ];
}

export function createDefaultRaceProject() {
  return {
    schemaVersion: 1,
    races: [createDefaultRace(), ...createBuiltInTestRaces()],
    cars: createBuiltInRaceCars(),
    selectedRaceId: 'test-loop',
    selectedCarId: 'starter-rwd'
  };
}

export function getSurfaceById(id) {
  return RACE_SURFACES.find((surface) => surface.id === id) || RACE_SURFACES[0];
}
