import { prepareRaceAheadSlice } from './RaceAheadPreparation.js';
// Cooperative scheduling only: never interrupt a physics solve or expose partial state.
export class RaceFrameBudget {
  constructor({ now = () => performance.now(), frameMs = 1000 / 60, reserveMs = 8,
    maxJobs = 16 } = {}) {
    this.now = now;
    this.frameMs = frameMs;
    this.reserveMs = reserveMs;
    this.maxJobs = maxJobs;
    this.jobs = new Map();
    this.sequence = 0;
    this.stats = { failed: 0, frames: 0, completed: 0, deferred: 0, expired: 0,
      overruns: 0, maxJobMs: 0, optionalMs: 0, essentialMs: 0, pending: 0 };
  }
  begin() {
    this.started = this.now();
    this.deadline = this.started + this.frameMs - this.reserveMs;
    this.stats.frames++;
    this.stats.optionalMs = 0;
  }
  enqueue(key, run, { priority = 0, estimateMs = .25, maxAgeFrames = 120 } = {}) {
    // The owner maintains a resumable cursor; don't restart a queued job each frame.
    if (this.jobs.has(key)) return true;
    if (this.jobs.size >= this.maxJobs) return false;
    this.jobs.set(key, { key, run, priority, estimateMs, maxAgeFrames,
      frame: this.stats.frames, sequence: this.sequence++ });
    return true;
  }
  finish() {
    if (this.finishedFrame === this.stats.frames) return this.stats;
    this.finishedFrame = this.stats.frames;
    this.stats.essentialMs = Math.max(0, this.now() - this.started);
    // Small bounded queue. Aging breaks priority ties, without forcing an overrun.
    const jobs = [...this.jobs.values()].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    for (const job of jobs) {
      if (this.stats.frames - job.frame > job.maxAgeFrames) {
        this.jobs.delete(job.key); this.stats.expired++; continue;
      }
      if (this.now() + job.estimateMs > this.deadline) { this.stats.deferred++; continue; }
      const at = this.now();
      let done;
      try { done = job.run(); }
      catch (error) {
        // Optional preparation cannot abort an otherwise valid race.
        this.jobs.delete(job.key); this.stats.failed++;
        this.stats.lastError = String(error?.message || error).slice(0, 160);
        done = true;
      }
      const elapsed = Math.max(0, this.now() - at);
      this.stats.optionalMs += elapsed;
      this.stats.maxJobMs = Math.max(this.stats.maxJobMs, elapsed);
      if (this.now() > this.deadline) this.stats.overruns++;
      job.estimateMs = Math.max(.05, elapsed, job.estimateMs * .9);
      if (done !== false) { this.jobs.delete(job.key); this.stats.completed++; }
      else job.sequence = this.sequence++;
    }
    this.stats.pending = this.jobs.size;
    return this.stats;
  }
}

// One admitted time delta for the whole race, not independent dropped steps per car.
// Fixed-step solvers are unchanged. Excess wall time is explicit and bounded.
export class RaceSimulationClock {
  constructor({ maxAdvanceSeconds = 1 / 30, maxDebtSeconds = 1 / 15 } = {}) {
    this.maxAdvanceSeconds = maxAdvanceSeconds;
    this.maxDebtSeconds = maxDebtSeconds;
    this.debtSeconds = 0;
    this.discardedSeconds = 0;
    this.admittedSeconds = 0;
    this.rawSeconds = 0;
    this.excludedSeconds = 0;
  }
  advance(delta) {
    const incoming = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.rawSeconds += incoming;
    const due = this.debtSeconds + incoming;
    const admitted = Math.min(due, this.maxAdvanceSeconds);
    const remainder = due - admitted;
    this.debtSeconds = Math.min(remainder, this.maxDebtSeconds);
    this.discardedSeconds += remainder - this.debtSeconds;
    this.admittedSeconds += admitted;
    return admitted;
  }
  // Countdown/debug presentation retains its existing capped delta. Worker
  // authority uses wall time because its solver advances on a separate clock.
  // Both policies account for time explicitly instead of bypassing the ledger.
  admitExplicit(delta, requested = delta) {
    this.resetDebt();
    const incoming = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    const admitted = Math.min(incoming, Number.isFinite(requested) ? Math.max(0, requested) : 0);
    this.rawSeconds += incoming;
    this.admittedSeconds += admitted;
    this.discardedSeconds += incoming - admitted;
    return admitted;
  }
  resetDebt() { this.discardedSeconds += this.debtSeconds; this.debtSeconds = 0; }
}

export function advanceRaceSimulationClock(editor, dt, { preStart = false, workerOwnsClock = false, bypass = false } = {}) {
  const session = editor.playtestSession;
  const clock = session.frameSimulationClock ||= new RaceSimulationClock();
  const timing = editor.game?.frameTiming;
  const directSeconds = Number.isFinite(Number(dt)) ? Math.max(0, Number(dt)) : 0;
  let rawSeconds = directSeconds, excludedSeconds = 0, observedSeconds = directSeconds, alreadyConsumed = false;
  if (timing?.inUpdate && timing.raceSession === session) {
    // Do not consume one animation callback twice if a caller re-enters update.
    const fresh = session.frameTimingSequence !== timing.sequence;
    alreadyConsumed = !fresh;
    rawSeconds = fresh ? timing.raceSeconds : 0;
    observedSeconds = fresh ? timing.rawSeconds : 0;
    excludedSeconds = fresh ? timing.excludedRaceSeconds : 0;
    session.frameTimingSequence = timing.sequence;
    session.frameTimeExclusionReason = fresh ? timing.raceExclusionReason : 'already-consumed';
    if(fresh && timing.raceExclusionReason)clock.resetDebt();
  } else session.frameTimeExclusionReason = null;
  clock.excludedSeconds += excludedSeconds;
  session.frameRawSeconds = rawSeconds;
  session.frameObservedRawSeconds = observedSeconds;
  session.frameExcludedSeconds = excludedSeconds;
  session.frameClockMode = workerOwnsClock ? 'worker-wall' : preStart ? 'countdown' : bypass ? 'debug-direct' : 'bounded';
  const seconds = alreadyConsumed ? 0 : workerOwnsClock ? clock.admitExplicit(rawSeconds)
    : preStart || bypass ? clock.admitExplicit(rawSeconds, directSeconds)
      : clock.advance(rawSeconds);
  session.frameAdmittedSeconds = seconds;
  return seconds;
}

export function runBudgetedRaceFrame(editor, simulate) {
  const session = editor.playtestSession;
  editor.vehicleDynamicsAuthority?.workerBridge?.setPaused?.(
    !session?.running || editor.raceInput.paused || Boolean(session.raceResults) || Boolean(session.raceIntro?.active));
  if (session) session.frameAdmittedSeconds = 0;
  if (!session?.running || editor.raceInput.paused || session.raceResults || session.raceIntro?.active) {
    session?.frameSimulationClock?.resetDebt();
    return;
  }
  if (session.debugFrameBudgetDisabled) return simulate();
  const budget = session.frameBudget ||= new RaceFrameBudget();
  const renderMs = Number(editor.racePlaytestRenderMs || editor.lastRaceRenderStats?.renderMs || 0);
  if (Number.isFinite(renderMs) && renderMs > 0) {
    budget.renderEstimateMs = Math.max(renderMs, (budget.renderEstimateMs || renderMs) * .95);
    budget.reserveMs = Math.min(budget.frameMs, Math.max(8, budget.renderEstimateMs + 2));
  }
  budget.begin();
  session.frameAdmittedSeconds = 0;
  const result = simulate();
  if (session.frameAdmittedSeconds > 0) {
    const cursor = session.aheadPreparationCursor ||= {};
    budget.enqueue('ahead-surface', () => prepareRaceAheadSlice(editor, cursor),
      { estimateMs: 1, priority: 1, maxAgeFrames: 60 });
  }
  if (!editor.deferRaceFrameBudgetFinish) budget.finish();
  return result;
}
