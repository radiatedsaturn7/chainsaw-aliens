/** Opt-in belt/chain CVT approximation, not an OEM controller or virtual gears.
 * Ratios exclude final drive. Control RPM and slew rate are authored estimates.
 */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function validateCvt(config) {
  for (const key of ['minRatio','maxRatio','cruiseRpm','powerRpm','ratioRatePerSecond']) {
    if (!Number.isFinite(config?.[key]) || config[key] <= 0) throw new RangeError(`CVT ${key} must be finite and positive`);
  }
  if (config.minRatio > config.maxRatio || config.cruiseRpm > config.powerRpm) throw new RangeError('CVT limits are reversed');
  return config;
}
export function normalizeCvtTuning(tuning = {}) {
  if (!tuning.cvt || tuning.powertrainType === 'electric') return tuning;
  const cvt = validateCvt(tuning.cvt);
  return {...tuning, cvt:{...cvt}, gearRatios:[cvt.maxRatio], shiftMode:'automatic'};
}
export function stepCvt({config, previousRatio, wheelOmegaRadps, finalDrive, throttle, dt}) {
  validateCvt(config);
  for (const [key,value] of Object.entries({wheelOmegaRadps,finalDrive,throttle,dt})) {
    if (!Number.isFinite(value)) throw new RangeError(`CVT ${key} must be finite`);
  }
  if (finalDrive <= 0 || dt < 0) throw new RangeError('CVT final drive must be positive and dt nonnegative');
  if (previousRatio !== undefined && !Number.isFinite(previousRatio)) throw new RangeError('CVT previous ratio must be finite');
  const targetRpm = config.cruiseRpm + (config.powerRpm-config.cruiseRpm)*clamp(throttle,0,1);
  const shaftRpm = Math.max(0,wheelOmegaRadps)*finalDrive*60/(2*Math.PI);
  const targetRatio = shaftRpm > 1 ? clamp(targetRpm/shaftRpm,config.minRatio,config.maxRatio) : config.maxRatio;
  const old = clamp(previousRatio ?? config.maxRatio,config.minRatio,config.maxRatio);
  const limit = config.ratioRatePerSecond*dt;
  return {ratio: clamp(old+clamp(targetRatio-old,-limit,limit),config.minRatio,config.maxRatio),targetRatio,targetRpm};
}
