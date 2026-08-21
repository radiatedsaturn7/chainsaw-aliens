import { advanceTireThermalState, createTireThermalState }
  from '../../src/racing/simulation/TireThermalModel.js';

import { TIRE_COMPOUND_VALIDATION_PROFILES } from './validationCatalog.mjs';

const round = (value) => Number(Number(value || 0).toFixed(4));

function runPhase(state, { seconds, loaded, speedMps, slipRatio, slipAngleRad,
  longitudinalForceN, lateralForceN, ambientTemperatureC }, trace, phase) {
  const dt = 0.1;
  const steps = Math.round(seconds / dt);
  for (let index = 0; index < steps; index += 1) {
    state = advanceTireThermalState({
      previous: state,
      tire: { coldPressurePsi: 32, treadThermalMassKg: 3.4, carcassThermalMassKg: 6.8 },
      patch: {
        longitudinalVelocityMps: speedMps,
        lateralVelocityMps: speedMps * Math.tan(slipAngleRad),
        wheelAngularVelocityRadps: speedMps * (1 + slipRatio) / 0.33,
        effectiveRollingRadiusM: 0.33,
        longitudinalForceN,
        lateralForceN,
        suspensionNormalLoadN: loaded ? 3900 : 0,
        slipRatio,
        slipAngleRad
      },
      material: { surfaceTemperatureC: ambientTemperatureC },
      ambientTemperatureC,
      dt
    });
    if (index % 50 === 0 || index === steps - 1) {
      trace.push({
        phase,
        timeInPhaseSeconds: round((index + 1) * dt),
        treadTemperatureC: state.treadTemperatureC,
        carcassTemperatureC: state.carcassTemperatureC,
        pressurePsi: state.effectivePressurePsi
      });
    }
  }
  return state;
}

export function validateTireCompoundCycle(name, profile, { ambientTemperatureC = 21 } = {}) {
  let state = createTireThermalState({
    treadTemperatureC: ambientTemperatureC,
    carcassTemperatureC: ambientTemperatureC,
    internalAirTemperatureC: ambientTemperatureC,
    coldPressurePsi: 32
  }, {}, ambientTemperatureC);
  const initial = { ...state };
  const trace = [];
  state = runPhase(state, {
    seconds: 90, loaded: true, speedMps: 25, slipRatio: profile.peakSlipRatio * 0.65,
    slipAngleRad: profile.peakSlipAngleDeg * Math.PI / 180 * 0.65,
    longitudinalForceN: 2400, lateralForceN: 2900, ambientTemperatureC
  }, trace, 'heating');
  const heated = { ...state };
  state = runPhase(state, {
    seconds: 45, loaded: true, speedMps: 31, slipRatio: profile.peakSlipRatio,
    slipAngleRad: profile.peakSlipAngleDeg * Math.PI / 180,
    longitudinalForceN: 3300, lateralForceN: 3900, ambientTemperatureC
  }, trace, 'peak-performance');
  const peak = { ...state };
  const projectedWear = round(profile.wearRate * 45 / 3600);
  state = runPhase(state, {
    seconds: 90, loaded: true, speedMps: 34, slipRatio: profile.peakSlipRatio * 1.45,
    slipAngleRad: profile.peakSlipAngleDeg * Math.PI / 180 * 1.35,
    longitudinalForceN: 3600, lateralForceN: 4100, ambientTemperatureC
  }, trace, 'degradation');
  const degraded = { ...state };
  state = runPhase(state, {
    seconds: 1800, loaded: false, speedMps: 20, slipRatio: 0,
    slipAngleRad: 0, longitudinalForceN: 0, lateralForceN: 0, ambientTemperatureC
  }, trace, 'cooling');
  const cooled = { ...state };
  const idealMinimumC = profile.temperatureC[1];
  const hotLimitC = profile.temperatureC[2];
  return {
    name,
    profile,
    states: { initial, heated, peak, degraded, cooled },
    projectedWear,
    phases: ['heating', 'peak-performance', 'degradation', 'cooling'],
    checks: {
      heating: heated.treadTemperatureC > initial.treadTemperatureC,
      peakPerformance: peak.treadTemperatureC >= heated.treadTemperatureC
        && Number.isFinite(idealMinimumC),
      degradation: degraded.treadTemperatureC >= peak.treadTemperatureC
        && projectedWear > 0 && Number.isFinite(hotLimitC),
      cooling: cooled.treadTemperatureC < degraded.treadTemperatureC,
      pressureCycle: degraded.effectivePressurePsi > initial.coldPressurePsi
        && cooled.effectivePressurePsi < degraded.effectivePressurePsi
    },
    trace
  };
}

export function validateAllTireCompoundCycles() {
  return Object.entries(TIRE_COMPOUND_VALIDATION_PROFILES)
    .map(([name, profile]) => validateTireCompoundCycle(name, profile));
}

export default validateAllTireCompoundCycles;
