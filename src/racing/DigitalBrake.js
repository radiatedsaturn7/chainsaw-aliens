const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));

// Digital pedal shaping, not per-wheel ABS. Release is immediate; a brief
// re-press restores decayed demand before adding more pressure.
export function advanceDigitalBrake(previous = {}, {
  enabled = false, raw = 0, legacy = 0, analog = false, dt = 0,
  lock = 0, brakeLock = lock, frontBrakeLock = 0, rearBrakeLock = 0, rearPairLock = 0, brakeControlLock = brakeLock, rearPairControlLock = rearPairLock, feedbackValid = false, absEnabled = false
} = {}) {
  if (!enabled || analog) return {output: clamp(legacy), bypassed: true};
  const target = clamp(raw);
  const seconds = Math.max(0, Math.min(.1, Number(dt) || 0));
  const current = clamp(previous.output);
  let pedalPosition = clamp(previous.pedalPosition ?? current);
  const releaseSeconds = target === 0 ? (previous.releaseSeconds || 0) + seconds : 0;
  const holdSeconds = target > 0 ? (previous.holdSeconds || 0) + seconds : 0;
  const correction = target > 0 && (previous.wasPressed === false
    ? pedalPosition > 0 : previous.correction === true);
  // ABS already regulates each wheel: don't withdraw the driver's whole
  // pedal in response to the same slip. Invalid/low-speed contacts also bypass.
  // Keep isolated wheel slip load-weighted. A confirmed rear pair needs
  // a faster response: both wheels provide directional stability even when
  // braking weight transfer gives their axle little total load.
  // Tire-normalized feedback anticipates the lower peak-slip range of loose
  // surfaces. Physical slip diagnostics and wheel ABS remain unchanged.
  const axleLock = clamp(brakeControlLock);
  const filteredLock = feedbackValid && !absEnabled
    ? (previous.filteredLock || 0) + (axleLock - (previous.filteredLock || 0))
      * (1 - Math.exp(-seconds / .04)) : 0;
  const filteredRearLock = feedbackValid && !absEnabled
    ? (previous.filteredRearLock || 0) + (clamp(rearPairControlLock) - (previous.filteredRearLock || 0))
      * (1 - Math.exp(-seconds / .025)) : 0;
  const rearRelief = 10 * clamp((filteredRearLock - .14) / .3);
  const nearLock = filteredLock > .12;
  const feathering = (filteredLock > .2 || rearRelief > 0) && target > 0;
  let output;
  let reapplying = previous.reapplying === true;
  if (target === 0) {
    if (previous.wasPressed !== false) pedalPosition = current;
    pedalPosition *= Math.exp(-seconds / .35);
    if (releaseSeconds >= 1.2 || pedalPosition < .015) pedalPosition = 0;
    output = 0; reapplying = false;
  } else {
    if (previous.wasPressed === false) reapplying = pedalPosition > 0;
    if (feathering) {
      // Proportional relief preserves usable pressure; one bad sample cannot
      // subtract a fixed amount and repeatedly drive the whole pedal to zero.
      if (!reapplying) pedalPosition = Math.min(pedalPosition, current);
      pedalPosition *= Math.exp(-seconds * Math.max(4 * clamp((filteredLock - .2) / .6), rearRelief));
    } else if (!nearLock && !reapplying) {
      // ABS can accept demand promptly and meter each wheel itself. Keep
      // the gentler unassisted ramp and remembered-pressure corrections.
      const rate = absEnabled ? 5 : correction ? 1 : 1 / .35;
      // Recover promptly as slip clears, without a fixed recovery timeout.
      pedalPosition += seconds * rate * (1 - clamp(filteredLock / .12));
    }
    pedalPosition = Math.min(target, pedalPosition);
    output = Math.min(pedalPosition, current + seconds * (absEnabled ? 5 : 3));
    if (output >= pedalPosition - 1e-9) reapplying = false;
  }
  return {output,pedalPosition,releaseSeconds,holdSeconds,reapplying,
    correction,
    wasPressed:target>0,bypassed:false,feathering,nearLock,filteredLock,filteredRearLock,lock,brakeLock,frontBrakeLock,rearBrakeLock,rearPairLock,axleLock,
    responseProfile:'brake-abs-reapply-v7'};
}
