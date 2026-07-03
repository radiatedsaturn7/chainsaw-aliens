export const RACE_SURFACES = [
  { id: 'asphalt', label: 'Asphalt', grip: 1, colorA: '#315734', colorB: '#244629' },
  { id: 'dirt', label: 'Dirt', grip: 0.72, colorA: '#7a5633', colorB: '#5f4128' },
  { id: 'gravel', label: 'Gravel', grip: 0.62, colorA: '#70706b', colorB: '#52534f' },
  { id: 'snow', label: 'Snow', grip: 0.38, colorA: '#d7e5ec', colorB: '#b8cbd5' },
  { id: 'wet-asphalt', label: 'Wet Asphalt', grip: 0.58, colorA: '#263946', colorB: '#1b2b36' }
];

export const DRIVETRAINS = ['rwd', 'fwd', 'awd'];

export const RACE_COMPETITION_MODES = ['solo', 'ai-race', 'combat-run', 'mixed'];

export const RACE_TIME_OF_DAY = ['day', 'night'];

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
  tireGrip: 1,
  brakeBalance: 0.56,
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
  drivetrainEfficiency: 0.84,
  differentialAccel: 0.45,
  differentialDecel: 0.2,
  gearFinalDrive: 4.11,
  aeroFront: 0.25,
  aeroRear: 0.35,
  springFront: 0.5,
  springRear: 0.5,
  dampingFront: 0.5,
  dampingRear: 0.5,
  antiRollFront: 0.5,
  antiRollRear: 0.5
};

export const DEFAULT_CAR_TUNING = {
  ...WRX_2022_SHARED_TUNING,
  transmissionType: 'manual',
  shiftMode: 'manual',
  shiftTimeMs: 420,
  clutchDelayMs: 90,
  launchRpm: 3200,
  autoUpshiftRpm: 5900,
  autoDownshiftRpm: 1750,
  gearRatios: [3.45, 1.95, 1.37, 0.97, 0.74, 0.67],
  reverseRatio: 3.33
};

export function createDefaultCar(id = 'starter-rwd') {
  const automatic = id === 'wrx-2022-automatic';
  const tuning = automatic
    ? {
        ...WRX_2022_SHARED_TUNING,
        weightKg: 1603,
        transmissionType: 'automatic',
        shiftMode: 'automatic',
        shiftTimeMs: 220,
        clutchDelayMs: 0,
        drivetrainEfficiency: 0.9,
        launchRpm: 2600,
        autoUpshiftRpm: 5700,
        autoDownshiftRpm: 1550,
        torqueConverterSlip: 0.12,
        gearRatios: [3.49, 2.19, 1.55, 1.18, 0.92, 0.74, 0.58, 0.47],
        reverseRatio: 3.32,
        gearFinalDrive: 4.44,
        zeroToSixtySec: 5.9
      }
    : { ...DEFAULT_CAR_TUNING };
  return {
    id,
    name: automatic ? '2022 Subaru WRX SPT' : '2022 Subaru WRX 6MT',
    class: 'road',
    art: {
      shell: null,
      tires: [],
      spoilers: [],
      turnFrames: {
        left: null,
        center: null,
        right: null
      }
    },
    tuning
  };
}

export function createDefaultRace(id = 'test-loop') {
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
      width: 9,
      selectedGroundTileId: 'grass',
      groundTiles: [],
      segments: [
        { length: 180, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: [] },
        { length: 120, curve: 0.55, elevation: 0.08, surface: 'asphalt', codriver: 'medium-right' },
        { length: 150, curve: -0.35, elevation: -0.04, surface: 'dirt', hazardIds: ['zombie-pack-1'] },
        { length: 110, curve: 0.9, elevation: 0.02, surface: 'gravel', turn: 'square', codriver: 'square-right' },
        { length: 180, curve: 0, elevation: 0, surface: 'asphalt', hazardIds: ['test-jump'] }
      ]
    },
    competition: {
      mode: 'solo',
      aiDrivers: [{ ...DEFAULT_AI_DRIVER, enabled: false }],
      playerStartGrid: 1,
      trafficEnabled: false
    },
    hazards: [
      {
        id: 'zombie-pack-1',
        type: 'zombie-pack',
        label: 'Zombie Pack',
        at: 380,
        lane: 0,
        density: 5,
        damage: 8,
        attackPlayer: true
      },
      {
        id: 'test-jump',
        type: 'jump',
        label: 'Crest Jump',
        at: 650,
        lane: 0,
        height: 0.65,
        landingForgiveness: 0.45
      },
      {
        id: 'wall-1',
        type: 'damage-wall',
        label: 'Damage Wall',
        at: 720,
        side: 'right',
        damage: 18,
        destructible: false
      }
    ],
    codriver: {
      enabled: true,
      voice: 'default',
      calls: [
        { id: 'medium-right', at: 190, text: 'Medium right over crest', severity: 2 },
        { id: 'square-right', at: 430, text: 'Square right, gravel, do not cut', severity: 4 },
        { id: 'jump-ahead', at: 620, text: 'Jump ahead, stay center', severity: 3 }
      ]
    },
    scenery: [
      { type: 'tree', at: 70, side: 'left' },
      { type: 'sign', at: 130, side: 'right' },
      { type: 'tower', at: 260, side: 'left' }
    ]
  };
}

export function createDefaultRaceProject() {
  return {
    schemaVersion: 1,
    races: [createDefaultRace()],
    cars: [createDefaultCar(), createDefaultCar('wrx-2022-automatic')],
    selectedRaceId: 'test-loop',
    selectedCarId: 'starter-rwd'
  };
}

export function getSurfaceById(id) {
  return RACE_SURFACES.find((surface) => surface.id === id) || RACE_SURFACES[0];
}
