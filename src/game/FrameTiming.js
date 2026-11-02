// Reused once per animation callback. Keep the legacy update delta for other
// game modes, and preserve the uncapped elapsed time for the race's own clock.
export function getActiveRaceEditor(game) {
  if (game?.state === 'race-editor') return game.raceEditor || null;
  if (game?.state === 'car-editor') return game.carEditor || null;
  return null;
}

export class FrameTiming {
  constructor(now, maxUpdateSeconds = 0.033) {
    this.last = now;
    this.maxUpdateSeconds = maxUpdateSeconds;
    this.sequence = 0;
    this.inUpdate = false;
    this.raceSession = null;
    this.raceActive = false;
    this.invalidated = false;
    this.rawSeconds = this.updateSeconds = this.upstreamDiscardedSeconds = 0;
    this.raceSeconds = this.excludedRaceSeconds = 0;
    this.raceExclusionReason = 'race-inactive';
  }

  invalidateRaceElapsed() { this.invalidated = true; }

  sample(now, raceSession = null, raceActive = false, hidden = false, blocked = false) {
    const raw = Number.isFinite(now) && Number.isFinite(this.last)
      ? Math.max(0, (now - this.last) / 1000) : 0;
    if (Number.isFinite(now)) this.last = now;
    const active = Boolean(raceSession && raceActive && !hidden && !blocked);
    const continuing = active && this.raceActive && this.raceSession === raceSession && !this.invalidated;
    this.rawSeconds = raw;
    this.updateSeconds = Math.min(raw, this.maxUpdateSeconds);
    this.upstreamDiscardedSeconds = raw - this.updateSeconds;
    // A tab suspension, blocked input, or a transition into a race is not debt
    // for that race. In particular, never catch up a hidden tab on its return.
    this.raceSeconds = continuing ? raw : 0;
    this.excludedRaceSeconds = raw - this.raceSeconds;
    this.raceExclusionReason = continuing ? null : hidden ? 'hidden'
      : blocked ? 'input-blocked' : !active ? 'race-inactive'
        : this.invalidated ? 'visibility-resume' : 'race-transition';
    this.raceSession = raceSession;
    this.raceActive = active;
    this.invalidated = false;
    this.sequence++;
    return this;
  }
}
