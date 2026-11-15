const unit = value => Math.max(0, Math.min(1, Number(value) || 0));

// A phone offers timing, not amplitude or separate motors. Keep driving cues
// separate until this stage instead of flattening them into two rumble channels.
export function phoneDrivingPattern(cues, minimumPulse = 24) {
  const minimum = Math.max(8, Math.min(30, Number(minimumPulse) || 24));
  const pulse = (intensity, extra) => Math.round(minimum + unit(intensity) * extra);
  const impact = unit(cues.impact), bump = unit(cues.bump);
  const slip = unit(cues.slip), braking = unit(cues.braking), road = unit(cues.road);
  if (impact >= .06) {
    const duration = pulse(impact, 180);
    return {kind: 'impact', priority: 4, intensity: impact, pattern: duration, interval: duration + 65};
  }
  if (braking >= .05) {
    const duration = pulse(braking, 12);
    return {kind: 'braking', priority: 3, pattern: [duration, 30, duration], interval: duration * 2 + 90};
  }
  // Axle slip is a cue, not a claim that every slide is unwanted.
  if (unit(cues.rearSlip) >= .08 && unit(cues.rearSlip) > unit(cues.frontSlip) * 1.2) {
    const intensity = unit(cues.rearSlip);
    const duration = pulse(intensity, 100), gap = Math.round(110 - intensity * 75);
    return {kind:'rear-slip',priority:2,intensity,pattern:[duration,gap,duration,gap,duration],interval:duration*3+gap*2+Math.round(100-intensity*70)};
  }
  if (unit(cues.frontSlip) >= .08) {
    const intensity = Math.max(unit(cues.frontSlip), unit(cues.rearSlip));
    const duration = pulse(intensity, 220);
    return {kind:'front-slip',priority:2,intensity,pattern:duration,interval:duration+Math.round(190-intensity*155)};
  }
  if (slip >= .05) {
    const duration = pulse(slip, 100), gap = Math.round(85-slip*60);
    return {kind: 'slip', priority: 1, intensity: slip, pattern: [duration, gap, duration], interval: duration * 2 + gap + Math.round(100-slip*70)};
  }
  if (bump >= .12) {
    const duration = pulse(bump, 45);
    return {kind: 'bump', priority: 0, pattern: duration, interval: duration + 65};
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
    this.intensity = 0;
    this.startedAt = -Infinity;
    this.active = false;
  }
  play(cues, minimumPulse) {
    const next = phoneDrivingPattern(cues, minimumPulse), now = this.now();
    // Calling vibrate again cancels the previous pattern. Let a cue and its
    // recovery gap finish, unless a more urgent or substantially stronger cue
    // arrives. Rate-limit escalation so per-frame slip noise cannot restart it.
    const escalating = next && next.priority === this.priority
      && next.intensity >= this.intensity + .18 && now - this.startedAt >= 90;
    if (!next || (now < this.until && next.priority <= this.priority && !escalating)) return;
    try {
      if (this.navigator?.vibrate?.(next.pattern) !== true) return;
      this.active = true;
      this.until = now + next.interval;
      this.priority = next.priority;
      this.intensity = next.intensity || 0;
      this.startedAt = now;
    } catch {}
  }
  stop() {
    if (this.active) {
      try { this.navigator?.vibrate?.(0); } catch {}
    }
    this.active = false;
    this.until = 0;
    this.priority = -1;
    this.intensity = 0;
    this.startedAt = -Infinity;
  }
}
