/**
 * Opt-in single-speed EV model used by the authoritative race runner.
 * All quantities describe the combined motor system, not each motor. Battery
 * capacity is usable energy, not a manufacturer's gross pack capacity.
 */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
function nonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
  return value;
}
function positive(value, name) {
  if (nonnegative(value, name) === 0) throw new RangeError(`${name} must be positive`);
  return value;
}

export function validateElectricPowertrain(config) {
  for (const key of ['peakTorqueNm', 'peakPowerKw', 'maxMotorRpm', 'reductionRatio', 'usableBatteryKwh']) {
    positive(config[key], key);
  }
  for (const key of ['driveEfficiency', 'regenEfficiency']) {
    if (!(config[key] > 0 && config[key] <= 1)) throw new RangeError(`${key} must be in (0, 1]`);
  }
  for (const key of ['maxRegenTorqueNm', 'maxRegenPowerKw', 'standstillLossKw']) nonnegative(config[key], key);
  positive(config.regenFullSpeedRadps, 'regenFullSpeedRadps');
  return config;
}

/**
 * Returns combined axle torque and next battery state for one solver substep.
 * wheelOmegaRadps is the signed driven-shaft equivalent wheel speed, after
 * differential aggregation. torqueScale must include traction/ABS/contact
 * intervention BEFORE this call so energy follows delivered torque.
 * Regeneration is explicit [0,1], opposes motion, and does not blend friction
 * brakes here. The caller owns brake blending and disables regen when unsafe.
 */
export function stepElectricPowertrain({ config, previous = {}, wheelOmegaRadps = 0,
  direction = 0, throttle = 0, regen = 0, torqueScale = 1, dt = 0,
  equivalentWheelInertiaKgM2 = 1, externalWheelAccelerationRadps2 = 0 }) {
  validateElectricPowertrain(config);
  nonnegative(dt, 'dt');
  positive(equivalentWheelInertiaKgM2, 'equivalentWheelInertiaKgM2');
  nonnegative(externalWheelAccelerationRadps2, 'externalWheelAccelerationRadps2');
  if (!Number.isFinite(wheelOmegaRadps)) throw new RangeError('wheelOmegaRadps must be finite');
  if (![-1, 0, 1].includes(direction)) throw new RangeError('direction must be -1, 0 or 1');
  for (const [key, value] of Object.entries({ throttle, regen, torqueScale })) {
    if (!Number.isFinite(value)) throw new RangeError(`${key} must be finite`);
  }
  const capacityJ = config.usableBatteryKwh * 3.6e6;
  const energyJ = previous.batteryEnergyJ === undefined ? capacityJ
    : clamp(nonnegative(previous.batteryEnergyJ, 'batteryEnergyJ'), 0, capacityJ);
  const motorOmega = Math.abs(wheelOmegaRadps) * config.reductionRatio;
  const motorRpm = motorOmega * 60 / (2 * Math.PI);
  const scale = clamp(torqueScale, 0, 1);
  // Constant-torque then constant-power is an explicit simulation envelope,
  // not a claim to reproduce an OEM's unpublished dyno curve.
  const envelopeNm = motorRpm >= config.maxMotorRpm ? 0 : Math.min(config.peakTorqueNm,
    motorOmega > 0 ? config.peakPowerKw * 1000 / motorOmega : config.peakTorqueNm);
  // Never turn opposite-direction propulsion into an accidental generator.
  // Reversing while rolling requires braking first; friction brakes stay caller-owned.
  const motionMatchesDirection = wheelOmegaRadps * direction >= 0;
  let driveMotorTorqueNm = direction !== 0 && motionMatchesDirection && energyJ > 0
    ? envelopeNm * clamp(throttle, 0, 1) * scale : 0;
  // Reserve upper-bound substep work, including shaft acceleration. Using
  // only pre-step RPM gives free rotational energy when launching from rest.
  const axleDrive = driveMotorTorqueNm * config.reductionRatio;
  const upperOmega = Math.abs(wheelOmegaRadps) + externalWheelAccelerationRadps2 * dt;
  const linearJ = axleDrive * upperOmega * dt / config.driveEfficiency;
  const quadraticJ = .5 * axleDrive ** 2 / equivalentWheelInertiaKgM2 * dt ** 2 / config.driveEfficiency
    + (driveMotorTorqueNm > 0 ? config.standstillLossKw * 1000
      * (driveMotorTorqueNm / config.peakTorqueNm) ** 2 * dt : 0);
  // Solve a*s² + b*s <= available energy without cancellation at small SOC.
  const drainScale = quadraticJ + linearJ > energyJ
    ? (quadraticJ > 0 ? 2 * energyJ / (linearJ + Math.sqrt(linearJ ** 2 + 4 * quadraticJ * energyJ))
      : energyJ / linearJ) : 1;
  driveMotorTorqueNm *= drainScale;
  const drainJ = linearJ * drainScale + quadraticJ * drainScale ** 2;
  const drainW = dt > 0 ? drainJ / dt : 0;
  let regenMotorTorqueNm = direction !== 0 && driveMotorTorqueNm === 0 && energyJ < capacityJ
    ? Math.min(config.maxRegenTorqueNm,
      motorOmega > 0 ? config.maxRegenPowerKw * 1000 / motorOmega : 0)
      * clamp(regen, 0, 1) * scale
      * clamp(Math.abs(wheelOmegaRadps) / config.regenFullSpeedRadps, 0, 1) : 0;
  // Conservatively account for tire reaction and do not brake through zero.
  const lowerOmega = Math.max(0, Math.abs(wheelOmegaRadps) - externalWheelAccelerationRadps2 * dt);
  if (dt > 0) regenMotorTorqueNm = Math.min(regenMotorTorqueNm,
    equivalentWheelInertiaKgM2 * lowerOmega / (dt * config.reductionRatio));
  const axleRegen = regenMotorTorqueNm * config.reductionRatio;
  const regenWorkJ = Math.max(0, axleRegen * lowerOmega * dt
    - .5 * axleRegen ** 2 / equivalentWheelInertiaKgM2 * dt ** 2);
  // Full-pack taper scales torque; scale² term makes exact work nonlinear.
  // Bisection keeps recovery within headroom even on a nearly full pack.
  const workAt = s => Math.max(0, axleRegen * s * lowerOmega * dt
    - .5 * (axleRegen * s) ** 2 / equivalentWheelInertiaKgM2 * dt ** 2) * config.regenEfficiency;
  let recoveryScale = 1;
  if (regenWorkJ * config.regenEfficiency > capacityJ - energyJ) {
    let low = 0, high = 1;
    for (let i = 0; i < 48; i++) { const mid = (low + high) / 2;
      if (workAt(mid) > capacityJ - energyJ) high = mid; else low = mid; }
    recoveryScale = low;
  }
  regenMotorTorqueNm *= recoveryScale;
  const recoveredJ = workAt(recoveryScale);
  const recoveredW = dt > 0 ? recoveredJ / dt : 0;
  const batteryEnergyJ = clamp(energyJ + (recoveredW - drainW) * dt, 0, capacityJ);
  return {
    axleTorqueNm: (direction * driveMotorTorqueNm - Math.sign(wheelOmegaRadps) * regenMotorTorqueNm)
      * config.reductionRatio,
    state: { batteryEnergyJ },
    telemetry: { motorRpm, driveMotorTorqueNm, regenMotorTorqueNm,
      batteryPowerW: drainW - recoveredW, stateOfCharge: batteryEnergyJ / capacityJ }
  };
}

/** Normalize the public car-editor tuning contract without changing ICE cars. */
export function normalizeElectricTuning(tuning = {}) {
  if (tuning.powertrainType !== 'electric') return tuning;
  const electricPowertrain = { ...validateElectricPowertrain(tuning.electricPowertrain) };
  return { ...tuning, electricPowertrain, idleRpm: 0,
    redlineRpm: electricPowertrain.maxMotorRpm, revLimitRpm: electricPowertrain.maxMotorRpm,
    gearRatios: [1], reverseRatio: 1,
    gearFinalDrive: electricPowertrain.reductionRatio, finalDrive: electricPowertrain.reductionRatio,
    torqueConverterSlip: 0, engineBrakeTorqueNm: 0, engineDisplacementL: 0,
    transmissionType: 'automatic', shiftMode: 'automatic',
    torqueLbFt: electricPowertrain.peakTorqueNm / 1.3558179483314,
    powerHp: electricPowertrain.peakPowerKw / .7456998715822702 };
}
