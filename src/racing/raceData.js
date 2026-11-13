import {createMappedTestRace} from './MappedTestTracks.js';
import {normalizeMenuVariables} from '../menus/MenuProgress.js';
export const RACE_SURFACES = [
  { id: 'asphalt', label: 'Asphalt', grip: 1, colorA: '#315734', colorB: '#244629' },
  { id: 'dirt', label: 'Dirt', grip: 0.72, colorA: '#7a5633', colorB: '#5f4128' },
  { id: 'gravel', label: 'Gravel', grip: 0.68, colorA: '#70706b', colorB: '#52534f' },
  { id: 'mud', label: 'Mud', grip: 0.58, colorA: '#4f3320', colorB: '#352317' },
  { id: 'wet-gravel', label: 'Wet Gravel', grip: 0.55, colorA: '#555a58', colorB: '#383f3d' },
  { id: 'snow', label: 'Snow', grip: 0.34, colorA: '#d7e5ec', colorB: '#b8cbd5' },
  { id: 'slush', label: 'Slush', grip: 0.44, colorA: '#9fb3bd', colorB: '#748b96' },
  { id: 'wet-asphalt', label: 'Wet Asphalt', grip: 0.72, colorA: '#263946', colorB: '#1b2b36' }
];

export const DRIVETRAINS = ['rwd', 'fwd', 'awd'];

export const RACE_COMPETITION_MODES = ['solo', 'ai-race', 'combat-run', 'mixed'];

export const RACE_TIME_OF_DAY = ['day', 'night'];

export const RACE_FINISH_BEHAVIOR_TYPES = ['return-to-origin', 'race', 'level', 'menu'];

export function normalizeRaceFinishBehavior(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const type = RACE_FINISH_BEHAVIOR_TYPES.includes(source.type)
    ? source.type
    : 'return-to-origin';
  return {
    type,
    ...(typeof source.cutsceneRef==='string' && source.cutsceneRef.trim()?{cutsceneRef:source.cutsceneRef.trim()}:{}),
    ...(source.skipResults===true?{skipResults:true,fadeOutMs:Math.max(100,Math.min(5000,Number(source.fadeOutMs)||800))}:{}),
    ...(Number(source.timeLimitSeconds)>0?{timeLimitSeconds:Math.min(86400,Number(source.timeLimitSeconds))}:{}),
    ...(type==='menu'?{menuRef:typeof source.menuRef==='string'?source.menuRef.trim():'',menuScreen:typeof source.menuScreen==='string'?source.menuScreen.trim():'world-map'}:{}),
    ...(Object.keys(normalizeMenuVariables(source.variables)).length?{variables:normalizeMenuVariables(source.variables)}:{}),
    targetLevel: type === 'level' && typeof source.targetLevel === 'string' && source.targetLevel.trim()
      ? source.targetLevel.trim()
      : null,
    targetRace: type === 'race' && typeof source.targetRace === 'string' && source.targetRace.trim()
      ? source.targetRace.trim()
      : null,
    spawnX: type === 'level' && Number.isFinite(Number(source.spawnX))
      ? Math.floor(Number(source.spawnX))
      : null,
    spawnY: type === 'level' && Number.isFinite(Number(source.spawnY))
      ? Math.floor(Number(source.spawnY))
      : null
  };
}

export const RACE_SNOW_CONDITIONS = [
  { id: 'ice', label: 'Ice', grip: 0.52, bumpiness: 0.03 },
  { id: 'dusting', label: 'Dusting', grip: 0.68, bumpiness: 0.08 },
  { id: 'three-inch', label: '3 in Snow', grip: 0.56, bumpiness: 0.18 },
  { id: 'six-inch', label: '6 in Snow', grip: 0.42, bumpiness: 0.34 },
  { id: 'slush', label: 'Slush', grip: 0.48, bumpiness: 0.14 },
  { id: 'fresh', label: 'Fresh Snow', grip: 1, bumpiness: 0.03 }
];

export const RACE_TIRE_COMPOUNDS = [
  {
    id: 'tarmac',
    label: 'Tarmac Race',
    surfaceGrip: { asphalt: 1.18, 'wet-asphalt': 0.72, dirt: 0.55, gravel: 0.46, mud: 0.30, 'wet-gravel': 0.35, snow: 0.16, slush: 0.22 },
    wetEvacuationFactor: 0.65,
    treadDepthMm: 4,
    wearRate: 1.3
  },
  {
    id: 'rain',
    label: 'Rain',
    surfaceGrip: { asphalt: 0.94, 'wet-asphalt': 1.03, dirt: 0.72, gravel: 0.7, mud: 0.56, 'wet-gravel': 0.76, snow: 0.34, slush: 0.5 },
    wetEvacuationFactor: 1.35,
    treadDepthMm: 8.5,
    wearRate: 1.1
  },
  {
    id: 'dirt',
    label: 'Rally',
    surfaceGrip: { asphalt: 0.78, 'wet-asphalt': 0.75, dirt: 1.16, gravel: 1.2, mud: 1.0, 'wet-gravel': 1.08, snow: 0.58, slush: 0.66 },
    wetEvacuationFactor: 1.08,
    treadDepthMm: 10,
    wearRate: 1.18
  },
  {
    id: 'offroad',
    label: 'Offroad',
    surfaceGrip: { asphalt: 0.7, 'wet-asphalt': 0.68, dirt: 1.0, gravel: 1.08, mud: 1.02, 'wet-gravel': 1.04, snow: 0.95, slush: 0.86 },
    wetEvacuationFactor: 1.16,
    treadDepthMm: 11,
    wearRate: 1.08
  },
  {
    id: 'drift',
    label: 'Drift',
    surfaceGrip: { asphalt: 0.88, 'wet-asphalt': 0.78, dirt: 0.62, gravel: 0.58, mud: 0.38, 'wet-gravel': 0.48, snow: 0.24, slush: 0.3 },
    wetEvacuationFactor: 0.68,
    treadDepthMm: 5,
    wearRate: 1.42
  },
  {
    id: 'snow',
    label: 'Snow',
    surfaceGrip: { asphalt: 0.82, 'wet-asphalt': 0.85, dirt: 0.74, gravel: 0.76, mud: 0.62, 'wet-gravel': 0.72, snow: 1.08, slush: 0.95 },
    wetEvacuationFactor: 1.12,
    treadDepthMm: 10.5,
    wearRate: 1.3
  },
  {
    id: 'stock', label: 'Stock',
    surfaceGrip: { asphalt: 0.90, 'wet-asphalt': 0.82, dirt: 0.70, gravel: 0.62, mud: 0.42, 'wet-gravel': 0.48, snow: 0.70, slush: 0.60 },
    wetEvacuationFactor: 0.95, treadDepthMm: 7.5, wearRate: 0.8
  },
  {
    id: 'street', label: 'Street',
    surfaceGrip: { asphalt: 1.02, 'wet-asphalt': 0.92, dirt: 0.68, gravel: 0.60, mud: 0.40, 'wet-gravel': 0.46, snow: 0.25, slush: 0.32 },
    wetEvacuationFactor: 1, treadDepthMm: 7, wearRate: 1
  },
  {
    id: 'sport', label: 'Sport',
    surfaceGrip: { asphalt: 1.10, 'wet-asphalt': 0.85, dirt: 0.62, gravel: 0.53, mud: 0.35, 'wet-gravel': 0.40, snow: 0.20, slush: 0.27 },
    wetEvacuationFactor: 0.85, treadDepthMm: 5.5, wearRate: 1.15
  }
];

export const RACE_CAR_DIMENSIONS = {
  'wrx-2022': {
    lengthM: 4.67,
    widthM: 1.83,
    wheelbaseM: 2.67,
    trackFrontM: 1.56,
    trackRearM: 1.57
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
  skyboxSettings: Object.freeze({
    artRef: 'providence',
    offsetXTurns: 0,
    offsetYRatio: 0
  }),
  surfaceArt: Object.freeze({
    boundary: 'apron'
  }),
  margin: Object.freeze({
    enabled: true,
    shoulderEnabled: true,
    widthM: 0.22,
    shoulderWidthM: 12,
    collisionMode: 'none',
    artRef: 'apron',
    marginMode: 'on',
    shoulderMode: 'hidden',
    collisionEdge: 'none',
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
  const skyboxArtRef = race.skyboxArtRef || race.skyboxSettings?.artRef || STUDIO_SPRINT_GRAPHIC_SETTINGS.skyboxArtRef;
  race.skyboxArtRef = skyboxArtRef;
  race.skyboxSettings = {
    ...STUDIO_SPRINT_GRAPHIC_SETTINGS.skyboxSettings,
    ...(race.skyboxSettings && typeof race.skyboxSettings === 'object' ? race.skyboxSettings : {}),
    artRef: skyboxArtRef
  };
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

// SI-unit calibration for the authoritative solver. These values are kept
// separate from the legacy 0..1 setup sliders so their meanings cannot be
// accidentally mixed by the compatibility tuning path.
export const WRX2_PHYSICAL_PROFILE = Object.freeze({
  id: 'wrx2-2022-physical-v1',
  massKg: 1495,
  cgLocationBodyM: Object.freeze({ x: 0, y: 0.54, z: -0.06 }),
  frontWeightDistribution: 0.58,
  inertiaTensorBodyKgM2: Object.freeze({
    xx: 2280,
    xy: 0,
    xz: -18,
    yy: 2640,
    yz: 0,
    zz: 690
  }),
  maxSteerAngleRad: 0.56,
  steeringWheelRatio: 14.4,
  steeringRackRatio: 1,
  suspensionSpringRateFrontNpm: 33500,
  suspensionSpringRateRearNpm: 30500,
  suspensionBumpDamperFrontNsM: 2850,
  suspensionReboundDamperFrontNsM: 4050,
  suspensionBumpDamperRearNsM: 2600,
  suspensionReboundDamperRearNsM: 3700,
  damperHighSpeedThresholdMps: 0.25,
  damperHighSpeedScale: 0.62,
  staticSagRatioFront: 0.42,
  staticSagRatioRear: 0.44,
  suspensionTravelFrontM: 0.15,
  suspensionTravelRearM: 0.15,
  antiRollStiffnessFrontNpm: 22000,
  antiRollStiffnessRearNpm: 17000,
  tireVerticalStiffnessNpm: 215000,
  tireVerticalDampingNsM: 1750,
  unsprungMassByWheelKg: Object.freeze({ fl: 44, fr: 44, rl: 42, rr: 42 }),
  dragCoefficient: 0.34,
  frontalAreaM2: 2.24,
  frontDownforceCoefficient: 0,
  rearDownforceCoefficient: 0,
  frontRideHeightM: 0.145,
  rearRideHeightM: 0.152,
  groundEffectGain: 0.035,
  groundEffectReferenceHeightM: 0.14,
  floorStallHeightM: 0.065,
  diffuserRakeSensitivity: 0.8
});

export const WRX_2022_SHARED_TUNING = {
  physicalVehicleProfile: WRX2_PHYSICAL_PROFILE,
  physics: {
    bodyShapePreset: 'car',
    bodyProfile: {
      preset: 'car',
      overallLengthM: 4.67,
      overallWidthM: 1.83,
      overallHeightM: 1.465,
      groundClearanceM: 0.135,
      frontOverhangM: 0.91,
      rearOverhangM: 1.09,
      lowerBodyHeightM: 0.47,
      hood: { lengthM: 1.22, widthM: 1.72, heightM: 0.4 },
      cabin: { centerZM: -0.12, lengthM: 2.25, widthM: 1.67, heightM: 0.82 },
      bed: { centerZM: -1.3, lengthM: 0, widthM: 0, heightM: 0 },
      cgPositionM: WRX2_PHYSICAL_PROFILE.cgLocationBodyM,
      collisionFriction: 0.62,
      collisionRestitution: 0.08,
      wheelWellAware: true,
      wheelWellClearanceMarginM: 0.06,
      maximumTireDeflectionM: 0.04,
      wheelRadiusM: 0.337,
      trackWidthM: 1.57,
      frontAxleDistanceFromCgM: 1.1214,
      rearAxleDistanceFromCgM: 1.5486,
      customColliders: []
    }
  },
  drivetrain: 'awd',
  powerHp: 271,
  torqueLbFt: 258,
  weightKg: 1495,
  frontWeightDistribution: 0.58,
  engineDisplacementL: 2.4,
  aspiration: 'Turbocharged',
  tireGrip: 1,
  // Front-heavy road-car baseline; the former 56% overloaded the rear
  // tires during braking in a turn. This is a game calibration, not a
  // claim about the real WRX hydraulic brake ratio.
  brakeBalance: 0.70,
  brakePressure: 1,
  redlineRpm: 6100,
  revLimitRpm: 6300,
  revLimiterDropRpm: 360,
  idleRpm: 850,
  torquePeakStartRpm: 2000,
  torquePeakEndRpm: 5200,
  torqueFalloffRpm: 6500,
  wheelRadiusM: 0.337,
  topSpeedMph: 145,
  zeroToSixtySec: 5.8,
  dragCoefficient: 0.34,
  accelerationCalibration: 1.06,
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
  staticSagRatioFront: 0.42,
  staticSagRatioRear: 0.44,
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
  gearRatios: [3.454, 1.947, 1.366, 0.972, 0.738, 0.666],
  reverseRatio: 3.636
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
    gearRatios: [3.454, 1.947, 1.366, 0.972, 0.738, 0.666],
    reverseRatio: 3.636,
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
    autoUpshiftRpm: 6250,
    autoDownshiftRpm: 1550,
    torqueConverterSlip: 0.12,
    gearRatios: [3.49, 2.19, 1.55, 1.18, 0.92, 0.74, 0.58, 0.47],
    reverseRatio: 3.32,
    gearFinalDrive: 4.44,
    topSpeedMph: 134,
    drivetrainEfficiency: 0.9,
    accelerationCalibration: 1.08,
    stockAccelerationCalibration: 0.86,
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
  accelerationCalibration: 1.22,
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
    gearRatios: [3.626, 2.188, 1.541, 1.213, 1.0, 0.767],
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
    gearRatios: [3.538, 2.06, 1.404, 1.0, 0.713, 0.582],
    reverseRatio: 3.17,
    gearFinalDrive: 3.909,
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
  tireGrip: 1.2,
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
  accelerationCalibration: 1.0,
  cgHeightM: 0.4,
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
    gearRatios: [3.625, 2.115, 1.529, 1.125, 0.911, 0.734],
    reverseRatio: 3.757,
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
    gearRatios: [3.625, 2.115, 1.529, 1.125, 0.911, 0.734],
    reverseRatio: 3.757,
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
    powerHp: 271,
    torqueLbFt: 258,
    dragCoefficient: 0.34,
    zeroToSixtySec: [4.8, 5.6],
    zeroToSixtySecByTransmission: {
      manual: [4.8, 5.6],
      automatic: [5.6, 6.35]
    },
    quarterMileSec: [13.5, 14.3],
    quarterMileSecByTransmission: {
      manual: [13.5, 14.3],
      automatic: [14.4, 15.2]
    },
    quarterMileTrapMph: [97, 103],
    quarterMileTrapMphByTransmission: {
      manual: [97, 103],
      automatic: [90, 96]
    },
    topSpeedMph: [143, 146],
    topSpeedMphByTransmission: {
      manual: [143, 146],
      automatic: [134, 134]
    },
    lateralG: [0.90, 0.98],
    braking70To0Ft: [154, 168]
  },
  'subaru-brz-2022': {
    carName: '2022 Subaru BRZ',
    source: 'real-world',
    powerHp: 228,
    torqueLbFt: 184,
    dragCoefficient: 0.35,
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
    powerHp: 315,
    torqueLbFt: 310,
    dragCoefficient: 0.36,
    zeroToSixtySec: [4.5, 5.4],
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
      body: null,
      artRef: null,
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
      interior: {
        dashboard: {
          artRef: null,
          frameIndex: 0,
          scaleX: 1,
          scaleY: 1,
          offsetX: 0,
          offsetY: 0
        },
        steeringWheel: {
          artRef: null,
          frameIndex: 0,
          scaleX: 1,
          scaleY: 1,
          offsetX: 0,
          offsetY: 0
        }
      },
      addOns: []
    },
    camera: {
      trackingMode: 'dynamic'
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

// Runtime fallback lookup must not construct entire editable car documents.
// Read the same profile references used by createBuiltInRaceCars, including
// null for unknown identities; authored profiles still take precedence.
export function getBuiltInRacePhysicalProfile(id) {
  switch (id) {
    case 'starter-rwd': return DEFAULT_CAR_TUNING.physicalVehicleProfile || null;
    case 'subaru-brz-2022': return BRZ_2022_TUNING.physicalVehicleProfile || null;
    case 'honda-civic-type-r-2023': return CIVIC_TYPE_R_2023_TUNING.physicalVehicleProfile || null;
    default: return null;
  }
}

export function createBuiltInRaceCars() {
  return [
    createDefaultCar(),
    createDefaultCar('subaru-brz-2022'),
    createDefaultCar('honda-civic-type-r-2023')
  ];
}

// Extend only the built-in, start-only preview. Authored node/network tracks keep
// their geometry, and repeated preview loading cannot multiply the length again.
export function extendCarEditorDefaultTrack(race) {
  if (!race || race.id !== 'test-loop' || race.road?.nodes?.length > 1 || race.road?.network?.edges?.length) return race;
  const segments = race.road?.segments || [];
  const length = segments.reduce((sum, segment) => sum + Number(segment.length || 0), 0);
  if (length <= 0 || length >= 7400) return race;
  for (const segment of segments) segment.length *= 7400 / length;
  return race;
}

export function createDefaultRace(id = 'test-loop') {
  const laneCount = DEFAULT_RACE_LANE_COUNT;
  const laneWidthM = RACE_LANE_WIDTH_M;
  return applyStudioSprintGraphicSettings({
    id,
    name: 'Studio Sprint',
    type: 'circuit',
    laps: 3,
    weather: 'clear',
    timeOfDay: 'day',
    entryBehavior: 'return-to-origin',
    finishBehavior: {
      type: 'menu',
      menuScreen: 'world-map',
      targetLevel: null,
      targetRace: null,
      spawnX: null,
      spawnY: null
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
    raceStart: {
      musicTrackId: '',
      countdown: true,
      rollingStart: false,
      rollingStartSpeedMps: 13.4
    },
    triggers: [],
    scenery: []
  });
}

export function createTestTrackRace(id) {
  const aliases={daytona:'daytona-tri-oval',nordschleife:'nurburgring-nordschleife',nurburgring:'nurburgring-nordschleife','nürburgring':'nurburgring-nordschleife'};
  const mapped=createMappedTestRace(aliases[id]||id);
  return mapped?applyStudioSprintGraphicSettings(mapped):createDefaultRace(id || 'test-loop');
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
    cars: createBuiltInRaceCars().map((car, index) => ({
      ...car, __systemPreset: true,
      name: ['AWD', 'RWD', 'FWD'][index]
    })),
    selectedRaceId: 'test-loop',
    selectedCarId: 'starter-rwd'
  };
}

export function getSurfaceById(id) {
  return RACE_SURFACES.find((surface) => surface.id === id) || RACE_SURFACES[0];
}
