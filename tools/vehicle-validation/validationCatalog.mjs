import { RACE_STOCK_PERFORMANCE_TARGETS } from '../../src/racing/raceData.js';

export const VEHICLE_VALIDATION_VERSION = 'vehicle-validation-coherent-baseline-v2';

export const VEHICLE_VALIDATION_VEHICLES = Object.freeze({
  'wrx-manual': Object.freeze({ carId: 'starter-rwd', label: 'WRX2 manual', transmission: 'manual' }),
  'wrx-automatic': Object.freeze({ carId: 'starter-rwd', label: 'WRX2 automatic', transmission: 'automatic' }),
  'brz-manual': Object.freeze({ carId: 'subaru-brz-2022', label: 'BRZ manual', transmission: 'manual' }),
  'civic-type-r-manual': Object.freeze({ carId: 'honda-civic-type-r-2023', label: 'Civic Type R manual', transmission: 'manual' })
});

export const VEHICLE_VALIDATION_CASES = Object.freeze([
  'zero-to-30', 'zero-to-60', 'quarter-mile', 'top-speed', 'coast-down-100-60',
  'braking-70-0', 'constant-radius-skidpad', 'step-steer', 'understeer-gradient',
  'slalom', 'emergency-lane-change', 'lift-throttle', 'split-friction-braking',
  'standing-wet-launch', 'curb-traversal', 'high-speed-bank-transition'
]);

export const VEHICLE_TRACE_FIELDS = Object.freeze([
  'phase', 'speedMps', 'engineRpm', 'gear', 'requestedGear', 'shiftState',
  'longitudinalAccelerationMps2',
  'lateralAccelerationMps2', 'yawRateRadps', 'bodySlipRad', 'steeringAngleRad',
  'physicalRackAngleRad', 'wheelSteeringAnglesRad', 'assistState',
  'wheelLoadsN', 'slipRatioByWheel', 'slipAngleByWheel', 'suspensionCompressionM',
  'brakePressure', 'tireTemperatureC', 'tirePressurePsi'
]);

const target = (range, category, source, uncertainty, unit) => Object.freeze({
  range: Object.freeze(range), category, source, uncertainty, unit
});

export const VEHICLE_ACCEPTANCE_TARGETS = Object.freeze({
  'starter-rwd': Object.freeze({
    zeroTo60Sec: target(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].zeroToSixtySec, 'simulator-calibration', 'RACE_STOCK_PERFORMANCE_TARGETS.zeroToSixtySec', '±0.4 s published-test spread', 's'),
    quarterMileSec: target(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].quarterMileSec, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.quarterMileSec', '±0.4 s', 's'),
    quarterMileTrapMph: target(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].quarterMileTrapMph, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.quarterMileTrapMph', '±3 mph', 'mph'),
    topSpeedMph: target(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].topSpeedMph, 'manufacturer-specification', 'RACE_STOCK_PERFORMANCE_TARGETS.topSpeedMph', 'governor/market variation', 'mph'),
    lateralG: target(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].lateralG, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.lateralG', '±0.04 g', 'g'),
    braking70To0Ft: target(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].braking70To0Ft, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.braking70To0Ft', '±7 ft', 'ft')
  }),
  'subaru-brz-2022': Object.freeze({
    zeroTo60Sec: target(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].zeroToSixtySec, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.zeroToSixtySec', 'transmission/launch spread', 's'),
    quarterMileSec: target(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].quarterMileSec, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.quarterMileSec', 'transmission spread', 's'),
    quarterMileTrapMph: target(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].quarterMileTrapMph, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.quarterMileTrapMph', '±3 mph', 'mph'),
    topSpeedMph: target(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].topSpeedMph, 'manufacturer-specification', 'RACE_STOCK_PERFORMANCE_TARGETS.topSpeedMph', 'market/gearing variation', 'mph'),
    lateralG: target(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].lateralG, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.lateralG', '±0.06 g', 'g'),
    braking70To0Ft: target(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].braking70To0Ft, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.braking70To0Ft', '±10 ft', 'ft')
  }),
  'honda-civic-type-r-2023': Object.freeze({
    zeroTo60Sec: target(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].zeroToSixtySec, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.zeroToSixtySec', 'launch/surface spread', 's'),
    quarterMileSec: target(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].quarterMileSec, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.quarterMileSec', '±0.35 s', 's'),
    quarterMileTrapMph: target(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].quarterMileTrapMph, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.quarterMileTrapMph', '±3 mph', 'mph'),
    topSpeedMph: target(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].topSpeedMph, 'manufacturer-specification', 'RACE_STOCK_PERFORMANCE_TARGETS.topSpeedMph', 'market/gearing variation', 'mph'),
    lateralG: target(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].lateralG, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.lateralG', '±0.05 g', 'g'),
    braking70To0Ft: target(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].braking70To0Ft, 'independent-instrumented-test', 'RACE_STOCK_PERFORMANCE_TARGETS.braking70To0Ft', '±7 ft', 'ft')
  })
});

export function resolveVehicleAcceptanceTargets(carId, transmission = 'manual') {
  const criteria = VEHICLE_ACCEPTANCE_TARGETS[carId] || {};
  const stock = RACE_STOCK_PERFORMANCE_TARGETS[carId] || {};
  const transmissionRange = (field, fallback) => stock[`${field}ByTransmission`]?.[transmission]
    || fallback;
  return Object.freeze({
    ...criteria,
    ...(criteria.zeroTo60Sec ? { zeroTo60Sec: target(
      transmissionRange('zeroToSixtySec', criteria.zeroTo60Sec.range),
      criteria.zeroTo60Sec.category, criteria.zeroTo60Sec.source,
      criteria.zeroTo60Sec.uncertainty, criteria.zeroTo60Sec.unit
    ) } : {}),
    ...(criteria.quarterMileSec ? { quarterMileSec: target(
      transmissionRange('quarterMileSec', criteria.quarterMileSec.range),
      criteria.quarterMileSec.category, criteria.quarterMileSec.source,
      criteria.quarterMileSec.uncertainty, criteria.quarterMileSec.unit
    ) } : {}),
    ...(criteria.quarterMileTrapMph ? { quarterMileTrapMph: target(
      transmissionRange('quarterMileTrapMph', criteria.quarterMileTrapMph.range),
      criteria.quarterMileTrapMph.category, criteria.quarterMileTrapMph.source,
      criteria.quarterMileTrapMph.uncertainty, criteria.quarterMileTrapMph.unit
    ) } : {}),
    ...(criteria.topSpeedMph ? { topSpeedMph: target(
      transmissionRange('topSpeedMph', criteria.topSpeedMph.range),
      criteria.topSpeedMph.category, criteria.topSpeedMph.source,
      criteria.topSpeedMph.uncertainty, criteria.topSpeedMph.unit
    ) } : {})
  });
}

export const SUBJECTIVE_DRIVER_FEEL_TARGETS = Object.freeze({
  stepSteer: Object.freeze({ category: 'subjective-driver-feel', source: 'calibration review', uncertainty: 'non-blocking until instrumented envelope is approved' }),
  slalom: Object.freeze({ category: 'subjective-driver-feel', source: 'calibration review', uncertainty: 'non-blocking until instrumented envelope is approved' }),
  liftThrottle: Object.freeze({ category: 'subjective-driver-feel', source: 'calibration review', uncertainty: 'non-blocking until instrumented envelope is approved' })
});

// Baseline metadata only. Initial-gate code deliberately does not feed these
// values into ContactPatchTireModel, so publishing the validation gate cannot
// retune existing vehicles or introduce a new tire feature by accident.
export const TIRE_COMPOUND_VALIDATION_PROFILES = Object.freeze({
  roadStreet: { peakSlipRatio: 0.11, peakSlipAngleDeg: 7, slidingFrictionRatio: 0.82, temperatureC: [15, 75, 105], temperatureFalloffPerC: 0.004, wearRate: 1, carcassStiffnessNPerM: 190000, verticalStiffnessNPerM: 235000, relaxationLengthM: 0.42, treadDepthMm: 7, waterEvacuation: 0.82 },
  roadPerformance: { peakSlipRatio: 0.10, peakSlipAngleDeg: 6.5, slidingFrictionRatio: 0.84, temperatureC: [20, 85, 115], temperatureFalloffPerC: 0.0045, wearRate: 1.15, carcassStiffnessNPerM: 215000, verticalStiffnessNPerM: 250000, relaxationLengthM: 0.38, treadDepthMm: 6, waterEvacuation: 0.68 },
  raceSoft: { peakSlipRatio: 0.09, peakSlipAngleDeg: 5.5, slidingFrictionRatio: 0.86, temperatureC: [45, 95, 120], temperatureFalloffPerC: 0.007, wearRate: 2.1, carcassStiffnessNPerM: 245000, verticalStiffnessNPerM: 275000, relaxationLengthM: 0.31, treadDepthMm: 3.5, waterEvacuation: 0.25 },
  raceMedium: { peakSlipRatio: 0.095, peakSlipAngleDeg: 5.8, slidingFrictionRatio: 0.85, temperatureC: [40, 90, 125], temperatureFalloffPerC: 0.0055, wearRate: 1.65, carcassStiffnessNPerM: 238000, verticalStiffnessNPerM: 270000, relaxationLengthM: 0.33, treadDepthMm: 4, waterEvacuation: 0.3 },
  raceHard: { peakSlipRatio: 0.10, peakSlipAngleDeg: 6, slidingFrictionRatio: 0.84, temperatureC: [35, 85, 130], temperatureFalloffPerC: 0.0045, wearRate: 1.3, carcassStiffnessNPerM: 230000, verticalStiffnessNPerM: 265000, relaxationLengthM: 0.35, treadDepthMm: 4.5, waterEvacuation: 0.35 },
  rain: { peakSlipRatio: 0.12, peakSlipAngleDeg: 7.5, slidingFrictionRatio: 0.80, temperatureC: [5, 55, 85], temperatureFalloffPerC: 0.004, wearRate: 1.4, carcassStiffnessNPerM: 175000, verticalStiffnessNPerM: 220000, relaxationLengthM: 0.48, treadDepthMm: 9, waterEvacuation: 1.35 },
  gravel: { peakSlipRatio: 0.18, peakSlipAngleDeg: 11, slidingFrictionRatio: 0.74, temperatureC: [0, 65, 105], temperatureFalloffPerC: 0.0035, wearRate: 1.25, carcassStiffnessNPerM: 165000, verticalStiffnessNPerM: 205000, relaxationLengthM: 0.58, treadDepthMm: 10, waterEvacuation: 1.08 },
  snow: { peakSlipRatio: 0.22, peakSlipAngleDeg: 13, slidingFrictionRatio: 0.68, temperatureC: [-25, 15, 45], temperatureFalloffPerC: 0.003, wearRate: 1.1, carcassStiffnessNPerM: 150000, verticalStiffnessNPerM: 195000, relaxationLengthM: 0.65, treadDepthMm: 11, waterEvacuation: 1.12 }
});

export const TRACE_ENVELOPE_TOLERANCES = Object.freeze({
  speedMps: { absolute: 0.5, relative: 0.03 }, engineRpm: { absolute: 120, relative: 0.03 },
  gear: { absolute: 0, relative: 0 }, longitudinalAccelerationMps2: { absolute: 0.4, relative: 0.08 },
  lateralAccelerationMps2: { absolute: 0.4, relative: 0.08 }, yawRateRadps: { absolute: 0.04, relative: 0.08 },
  bodySlipRad: { absolute: 0.025, relative: 0.1 }, steeringAngleRad: { absolute: 0.01, relative: 0.04 },
  wheelLoadsN: { absolute: 180, relative: 0.06 }, slipRatioByWheel: { absolute: 0.025, relative: 0.12 },
  slipAngleByWheel: { absolute: 0.02, relative: 0.12 }, suspensionCompressionM: { absolute: 0.003, relative: 0.08 },
  brakePressure: { absolute: 0.02, relative: 0.03 }, tireTemperatureC: { absolute: 2, relative: 0.03 },
  tirePressurePsi: { absolute: 0.35, relative: 0.02 }
});
