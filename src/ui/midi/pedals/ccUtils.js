export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const pushCcCurve = ({ cc, controller, startTick, endTick, steps = 16, fn, channel = 0 }) => {
  const safeSteps = Math.max(1, steps);
  const span = Math.max(1, endTick - startTick);
  for (let i = 0; i <= safeSteps; i += 1) {
    const t = i / safeSteps;
    const tick = Math.round(startTick + span * t);
    const value = Math.round(clamp(fn(t), 0, 1) * 127);
    cc.push({ tick, controller, value, channel });
  }
};
