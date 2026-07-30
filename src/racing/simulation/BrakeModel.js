import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';

export class BrakeModel {
  calculate({
    tuning = {},
    brake = 0,
    handbrake = 0,
    limitByWheel = {},
    normalLoads = {},
    looseSurfaceFactor = 0,
    speedMps = 0
  } = {}) {
    const brakePressure = Math.pow(clamp(Number(brake) || 0, 0, 1), 0.82);
    const brakeCapacity = Math.max(0, Number(tuning.brakeForceN) || 16500)
      * clamp(Number(tuning.brakePressure) || 1, 0.7, 1.35);
    const requested = brakeCapacity * brakePressure;
    const handbrakeRequested = brakeCapacity * 0.92 * clamp(handbrake, 0, 1);
    const speedLockFactor = clamp(Math.abs(Number(speedMps) || 0) / 11, 0, 1);
    const frontBias = clamp(Number(tuning.frontBrakeBias) || 0.62, 0.45, 0.78);
    const requestedByWheel = {
      fl: requested * frontBias * 0.5,
      fr: requested * frontBias * 0.5,
      rl: requested * (1 - frontBias) * 0.5 + handbrakeRequested * 0.5,
      rr: requested * (1 - frontBias) * 0.5 + handbrakeRequested * 0.5
    };
    const appliedByWheel = {};
    const lockByWheel = {};
    const absInterventionByWheel = {};
    const slidingEfficiencyByWheel = {};
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const limit = Math.max(0, Number(limitByWheel?.[wheelId]) || 0);
      const requestedWheel = Number(requestedByWheel[wheelId] || 0);
      if (limit <= 0.001) {
        appliedByWheel[wheelId] = 0;
        absInterventionByWheel[wheelId] = tuning.absEnabled && !handbrake ? Math.max(0, requestedWheel) : 0;
        lockByWheel[wheelId] = 0;
        slidingEfficiencyByWheel[wheelId] = 1;
        return;
      }
      const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
      const absActive = tuning.absEnabled && !handbrake;
      const absCap = absActive ? limit * (0.96 - loose * 0.12) : limit;
      const peakApplied = Math.min(requestedWheel, absCap);
      const lockReference = absActive ? peakApplied : requestedWheel;
      const absPulseLeak = absActive && requestedWheel > limit
        ? (0.08 + loose * 0.1) * clamp((requestedWheel - limit) / Math.max(1, limit), 0, 1)
        : 0;
      const lockSlip = clamp(
        ((lockReference - limit) / Math.max(1, limit)) * speedLockFactor + absPulseLeak,
        0,
        1
      );
      const slidingEfficiency = absActive
        ? 1
        : clamp(1 - lockSlip * (0.18 + loose * 0.34), 0.48, 1);
      appliedByWheel[wheelId] = peakApplied * slidingEfficiency;
      absInterventionByWheel[wheelId] = absActive
        ? Math.max(0, requestedWheel - appliedByWheel[wheelId])
        : 0;
      lockByWheel[wheelId] = lockSlip;
      slidingEfficiencyByWheel[wheelId] = slidingEfficiency;
    });
    return {
      force: RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + appliedByWheel[wheelId], 0),
      requested,
      requestedByWheel,
      appliedByWheel,
      lockByWheel,
      limitByWheel: { ...limitByWheel },
      absInterventionByWheel,
      slidingEfficiencyByWheel,
      normalLoads
    };
  }
}
