// Countdown-only arming. This state belongs to the authoritative powertrain so
// fixed-step replay and worker physics use the same launch and cancellation.
export function advanceRaceLaunchControl(previous = {}, {enabled, staging, throttle=0,
  brake=0, handbrake=0, gear=1, speedMps=0, dt=0} = {}) {
  const cancelled = !enabled || brake > .1 || handbrake > .01 || gear !== 1;
  if (staging) return {phase:!cancelled && throttle >= .7 && Math.abs(speedMps)<1 ? 'armed':'idle',elapsed:0};
  if (cancelled || throttle < .1) return {phase:'done',elapsed:0};
  if (!['armed','launching'].includes(previous.phase)) return {phase:'done',elapsed:0};
  const elapsed = (previous.phase === 'armed' ? 0 : Number(previous.elapsed)||0) + Math.max(0,dt);
  return {phase:Math.abs(speedMps)>=12 || elapsed>=3 ? 'done':'launching',elapsed};
}
