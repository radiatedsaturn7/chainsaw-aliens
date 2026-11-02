const unit = value => Math.max(0, Math.min(1, Number(value) || 0));

// A phone offers timing, not amplitude or separate motors. Keep driving cues
// separate until this stage instead of flattening them into two rumble channels.
export function phoneDrivingPattern(cues, minimumPulse = 16) {
  const minimum = Math.max(8, Math.min(30, Number(minimumPulse) || 16));
  const pulse = (intensity, extra) => Math.round(minimum + unit(intensity) * extra);
  const impact = unit(cues.impact), bump = unit(cues.bump);
  const slip = unit(cues.slip), braking = unit(cues.braking), road = unit(cues.road);
  if (impact >= .06) {
    const duration = pulse(impact, 95);
    return {kind: 'impact', priority: 4, pattern: duration, interval: duration + 65};
  }
  if (bump >= .12) {
    const duration = pulse(bump, 45);
    return {kind: 'bump', priority: 3, pattern: duration, interval: duration + 65};
  }
  if (braking >= .05) {
    const duration = pulse(braking, 12);
    return {kind: 'braking', priority: 2, pattern: [duration, 30, duration], interval: duration * 2 + 90};
  }
  if (slip >= .05) {
    const duration = pulse(slip, 32);
    return {kind: 'slip', priority: 1, pattern: [duration, 48, duration], interval: duration * 2 + 110};
  }
  if (road >= .025) {
    const duration = pulse(road, 30);
    return {kind: 'road', priority: 0, pattern: duration, interval: Math.round(300 - road * 160)};
  }
  return null;
}

export class PhoneHaptics {
  constructor(navigator, now = () => globalThis.performance.now()) {
    this.navigator = navigator;
    this.now = now;
    this.until = 0;
    this.priority = -1;
    this.active = false;
  }
  play(cues, minimumPulse) {
    const next = phoneDrivingPattern(cues, minimumPulse), now = this.now();
    // Calling vibrate again cancels the previous pattern. Let a cue and its
    // recovery gap finish, unless a more urgent cue needs to interrupt it.
    if (!next || (now < this.until && next.priority <= this.priority)) return;
    try {
      if (this.navigator?.vibrate?.(next.pattern) !== true) return;
      this.active = true;
      this.until = now + next.interval;
      this.priority = next.priority;
    } catch {}
  }
  stop() {
    if (this.active) {
      try { this.navigator?.vibrate?.(0); } catch {}
    }
    this.active = false;
    this.until = 0;
    this.priority = -1;
  }
}
