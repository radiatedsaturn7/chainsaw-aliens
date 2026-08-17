const DEFAULT_FRAME_HISTORY_LIMIT = 600;
const DEFAULT_STEP_HISTORY_LIMIT = 1200;

export const PHYSICS_COST_TIMER_NAMES = Object.freeze([
  'raceSimulationVehicleAuthorityUpdate',
  'environmentProvider',
  'wheelCenterAndFootprintQueries',
  'iterativeTireContactSolving',
  'raceSurfaceModelProjection',
  'bakedSurfaceSampling',
  'bodyBroadphase',
  'bodySupportGeneration',
  'bodyContinuousSweep',
  'bodyManifoldSolve',
  'staticColliderBroadphase',
  'staticColliderContinuousSweep',
  'staticColliderManifoldSolve',
  'wheelCylinderActivation',
  'wheelCylinderTriangleSweep',
  'wheelCylinderHeightSweep',
  'penetrationValidation',
  'recoveryRebuilding',
  'trackState',
  'telemetryConstruction'
]);

export const PHYSICS_COST_COUNTER_NAMES = Object.freeze([
  'physicsGeometryPointsQueried',
  'routeProjections',
  'bakedTriangleBucketLookups',
  'preparedTrianglesVisited',
  'bodySupportFeatures',
  'adaptiveBodySupportFeatures',
  'bodyLowerHullProbes',
  'bodyLowerHullSupportFeatures',
  'bodyAabbRejections',
  'bodyLowerHullRejections',
  'bodyLocalContinuityRejections',
  'bodyFullEnvelopeActivations',
  'bodyOrdinaryUnderbodyManifolds',
  'bodySweepSlices',
  'binarySearchIterations',
  'wheelCylinderActivationPoints',
  'activeWheelCylinders',
  'wheelCylinderFeatures',
  'triangleIntersectionTests',
  'heightfieldSweepSamples',
  'environmentProviderCalls',
  'chassisGeometryFrames',
  'tireSubstepGeometryReuses',
  'tireSubstepGeometryRefreshes',
  'analyticContactPlaneQueries',
  'contactTriangleExitRefreshes',
  'smoothWheelCcdRejections',
  'catchUpBudgetWarnings',
  'recoveryRecalculations',
  'completedSteps',
  'completedTireSubsteps',
  'backlogSteps',
  'temporaryObjects',
  'bodySupportEntryAllocations',
  'bodyLowerHullEntryAllocations',
  'terrainBatchTargetAllocations',
  'terrainBatchPointAllocations',
  'terrainBatchBufferAllocations',
  'terrainBatchBufferGrowths',
  'bodyCcdActivations',
  'bodySweepWheelCrossingActivations',
  'bodySweepTranslationActivations',
  'bodySweepClosingSpeedActivations',
  'bodySweepPersistentContactRejections',
  'bodySweepAttitudeActivations',
  'bodySweepPenetrationActivations',
  'bodyCollisionDeferredTireSubsteps',
  'staticColliderBroadphaseQueries',
  'staticColliderCandidates',
  'staticColliderNarrowphaseTests',
  'staticColliderCcdActivations',
  'staticColliderManifoldContacts',
  'wheelCcdActivations',
  'terrainQueryFrames',
  'terrainQueryFrameCacheHits',
  'terrainQueryFrameBatchQueries',
  'terrainQueryFramePointQueries',
  'terrainQueryFrameMaximumHeightQueries',
  'terrainQueryFrameFullSurfaceClassifications',
  'terrainQueryFrameOutOfBoundsQueries',
  'terrainVariationQueries',
  'terrainVariationHeightTriggers',
  'terrainVariationNormalTriggers',
  'terrainQueryFramePointCacheHits',
  'penetrationValidationCacheHits'
]);

const finite = (value, fallback = 0) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
);

const cloneNumbers = (source = {}) => Object.fromEntries(Object.entries(source).map(
  ([key, value]) => [key, finite(value)]
));

function createRecord(metadata = {}) {
  return {
    metadata: { ...metadata },
    timings: {},
    counters: {},
    startedAtMs: 0,
    elapsedMs: 0
  };
}

function resetRecord(record, metadata = {}) {
  const metadataTarget = record.metadata;
  for (const key in metadataTarget) delete metadataTarget[key];
  Object.assign(metadataTarget, metadata);
  for (const key in record.timings) delete record.timings[key];
  for (const key in record.counters) delete record.counters[key];
  record.startedAtMs = 0;
  record.elapsedMs = 0;
  return record;
}

function addTiming(record, name, inclusiveMs, exclusiveMs) {
  if (!record) return;
  const entry = record.timings[name] || {
    inclusiveMs: 0,
    exclusiveMs: 0,
    calls: 0
  };
  entry.inclusiveMs += Math.max(0, finite(inclusiveMs));
  entry.exclusiveMs += Math.max(0, finite(exclusiveMs));
  entry.calls += 1;
  record.timings[name] = entry;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

function publicRecord(record) {
  if (!record) return null;
  // A completed frame/step is never mutated again: currentFrame/currentStep
  // are cleared immediately after this handoff and each record owns its
  // timing/counter maps. Transfer those maps into history instead of cloning
  // the complete accounting graph at every 120 Hz boundary.
  record.elapsedMs = finite(record.elapsedMs);
  return record;
}

/**
 * Wall-clock-only physics profiling. No value from this class is consumed by
 * simulation state, replay checksums, force calculation, or collision policy.
 */
export class PhysicsCostAccounting {
  constructor({
    now = null,
    enabled = true,
    detailedStepRecords = true,
    frameHistoryLimit = DEFAULT_FRAME_HISTORY_LIMIT,
    stepHistoryLimit = DEFAULT_STEP_HISTORY_LIMIT
  } = {}) {
    this.enabled = enabled !== false;
    this.detailedStepRecords = detailedStepRecords !== false;
    this.now = typeof now === 'function' ? now : () => (
      typeof globalThis.performance?.now === 'function'
        ? globalThis.performance.now()
        : Date.now()
    );
    this.frameHistoryLimit = Math.max(30, Math.trunc(finite(
      frameHistoryLimit, DEFAULT_FRAME_HISTORY_LIMIT
    )));
    this.stepHistoryLimit = Math.max(120, Math.trunc(finite(
      stepHistoryLimit, DEFAULT_STEP_HISTORY_LIMIT
    )));
    this.frameHistory = [];
    this.stepHistory = [];
    this.frameRecordPool = [];
    this.stepRecordPool = [];
    this.stepHistoryMode = 'records';
    this.stepElapsedHistory = new Float64Array(this.stepHistoryLimit);
    this.stepElapsedHistoryLength = 0;
    this.stepElapsedHistoryCursor = 0;
    this.lightweightStepRecord = createRecord();
    this.currentFrame = null;
    this.currentStep = null;
    this.timerStack = [];
    this.timerTokenPool = [];
    this.sequence = 0;
    this.peakBacklogSteps = 0;
    this.recoveryCount = 0;
    this.lastRecoveryReason = null;
    this.summaryCache = null;
    this.summaryCacheSequence = -Infinity;
    this.summaryCacheWindowFrames = null;
  }

  beginFrame(metadata = {}) {
    if (!this.enabled || this.currentFrame) return false;
    const frame = this.frameRecordPool.pop() || createRecord();
    const sequence = ++this.sequence;
    resetRecord(frame, metadata);
    if (!Object.hasOwn(frame.metadata, 'sequence')) frame.metadata.sequence = sequence;
    this.currentFrame = frame;
    this.currentFrame.startedAtMs = this.now();
    return true;
  }

  finishFrame(metadata = {}) {
    if (!this.currentFrame) return null;
    const frame = this.currentFrame;
    Object.assign(frame.metadata, metadata);
    frame.elapsedMs = Math.max(0, this.now() - frame.startedAtMs);
    const backlogSteps = finite(
      metadata.backlogSteps ?? frame.counters.backlogSteps,
      0
    );
    frame.counters.backlogSteps = backlogSteps;
    this.peakBacklogSteps = Math.max(this.peakBacklogSteps, backlogSteps);
    this.frameHistory.push(publicRecord(frame));
    while (this.frameHistory.length > this.frameHistoryLimit) {
      this.frameRecordPool.push(this.frameHistory.shift());
    }
    this.currentFrame = null;
    this.timerStack.length = 0;
    return this.frameHistory.at(-1);
  }

  beginStep(metadata = {}) {
    if (!this.enabled || this.currentStep) return false;
    if (this.stepHistoryMode === 'elapsed-ring') {
      const step = this.lightweightStepRecord;
      step.metadata = metadata;
      step.startedAtMs = this.now();
      step.elapsedMs = 0;
      step.counters.backlogSteps = 0;
      this.currentStep = step;
      return true;
    }
    const step = this.stepRecordPool.pop() || createRecord();
    resetRecord(step, metadata);
    this.currentStep = step;
    this.currentStep.startedAtMs = this.now();
    return true;
  }

  finishStep(metadata = {}) {
    if (!this.currentStep) return null;
    const step = this.currentStep;
    Object.assign(step.metadata, metadata);
    step.elapsedMs = Math.max(0, this.now() - step.startedAtMs);
    if (this.stepHistoryMode === 'elapsed-ring') {
      this.stepElapsedHistory[this.stepElapsedHistoryCursor] = step.elapsedMs;
      this.stepElapsedHistoryCursor = (
        this.stepElapsedHistoryCursor + 1
      ) % this.stepHistoryLimit;
      this.stepElapsedHistoryLength = Math.min(
        this.stepHistoryLimit,
        this.stepElapsedHistoryLength + 1
      );
      this.currentStep = null;
      return step;
    }
    this.stepHistory.push(publicRecord(step));
    while (this.stepHistory.length > this.stepHistoryLimit) {
      this.stepRecordPool.push(this.stepHistory.shift());
    }
    this.currentStep = null;
    return this.stepHistory.at(-1);
  }

  start(name) {
    if (!this.enabled || (!this.currentFrame && !this.currentStep)) return null;
    const depth = this.timerStack.length;
    let token = this.timerTokenPool[depth];
    if (!token) {
      token = {};
      this.timerTokenPool[depth] = token;
    }
    token.name = String(name);
    token.startedAtMs = this.now();
    token.childTimeMs = 0;
    token.parent = this.timerStack[depth - 1] || null;
    token.closed = false;
    this.timerStack.push(token);
    return token;
  }

  end(token) {
    if (!token || token.closed) return 0;
    const elapsedMs = Math.max(0, this.now() - token.startedAtMs);
    const exclusiveMs = Math.max(0, elapsedMs - token.childTimeMs);
    token.closed = true;
    if (this.timerStack.at(-1) === token) this.timerStack.pop();
    else {
      const index = this.timerStack.lastIndexOf(token);
      if (index >= 0) this.timerStack.splice(index, 1);
    }
    if (token.parent && !token.parent.closed) token.parent.childTimeMs += elapsedMs;
    addTiming(this.currentFrame, token.name, elapsedMs, exclusiveMs);
    if (this.detailedStepRecords) {
      addTiming(this.currentStep, token.name, elapsedMs, exclusiveMs);
    }
    return elapsedMs;
  }

  measure(name, callback) {
    const token = this.start(name);
    try {
      return callback();
    } finally {
      this.end(token);
    }
  }

  count(name, amount = 1) {
    if (!this.enabled) return;
    const increment = finite(amount);
    if (this.currentFrame) {
      this.currentFrame.counters[name] = finite(this.currentFrame.counters[name]) + increment;
    }
    if (this.currentStep && (this.detailedStepRecords || name === 'backlogSteps')) {
      this.currentStep.counters[name] = finite(this.currentStep.counters[name]) + increment;
    }
  }

  setFrameCounter(name, value) {
    if (this.currentFrame) this.currentFrame.counters[name] = finite(value);
  }

  noteRecovery(reason = 'unknown') {
    this.recoveryCount += 1;
    this.lastRecoveryReason = String(reason || 'unknown');
  }

  getLatestFrame() {
    return this.frameHistory.at(-1) || null;
  }

  getLatestStep() {
    if (this.stepHistoryMode === 'elapsed-ring' && this.stepElapsedHistoryLength) {
      return this.lightweightStepRecord;
    }
    return this.stepHistory.at(-1) || null;
  }

  appendStepElapsedHistory(target = []) {
    if (this.stepHistoryMode !== 'elapsed-ring') {
      for (let index = 0; index < this.stepHistory.length; index += 1) {
        target.push(finite(this.stepHistory[index]?.elapsedMs));
      }
      return target;
    }
    const start = (
      this.stepElapsedHistoryCursor - this.stepElapsedHistoryLength
      + this.stepHistoryLimit
    ) % this.stepHistoryLimit;
    for (let index = 0; index < this.stepElapsedHistoryLength; index += 1) {
      target.push(this.stepElapsedHistory[(start + index) % this.stepHistoryLimit]);
    }
    return target;
  }

  getSummary({ windowFrames = 240, force = false } = {}) {
    const resolvedWindowFrames = Math.max(1, Math.trunc(windowFrames));
    if (!force && this.summaryCache
      && this.summaryCacheWindowFrames === resolvedWindowFrames
      && this.sequence - this.summaryCacheSequence < 15) {
      return this.summaryCache;
    }
    const frames = this.frameHistory.slice(-resolvedWindowFrames);
    const updateTimes = frames.map((frame) => finite(
      frame.timings.raceSimulationVehicleAuthorityUpdate?.inclusiveMs
        ?? frame.metadata.advanceWallTimeMs
        ?? frame.elapsedMs
    ));
    const subsystemTotals = {};
    frames.forEach((frame) => Object.entries(frame.timings).forEach(([name, timing]) => {
      if (name === 'raceSimulationVehicleAuthorityUpdate') return;
      const entry = subsystemTotals[name] || {
        inclusiveMs: 0,
        exclusiveMs: 0,
        calls: 0
      };
      entry.inclusiveMs += finite(timing.inclusiveMs);
      entry.exclusiveMs += finite(timing.exclusiveMs);
      entry.calls += finite(timing.calls);
      subsystemTotals[name] = entry;
    }));
    const divisor = Math.max(1, frames.length);
    const expensiveSubsystems = Object.entries(subsystemTotals).map(([name, timing]) => ({
      name,
      inclusiveMs: timing.inclusiveMs / divisor,
      exclusiveMs: timing.exclusiveMs / divisor,
      callsPerFrame: timing.calls / divisor
    })).sort((left, right) => (
      right.inclusiveMs - left.inclusiveMs || left.name.localeCompare(right.name)
    )).slice(0, 5);
    const latest = frames.at(-1) || null;
    const totals = frames.reduce((result, frame) => {
      Object.entries(frame.counters).forEach(([name, value]) => {
        result[name] = finite(result[name]) + finite(value);
      });
      return result;
    }, {});
    const tireSubsteps = Math.max(1, finite(totals.completedTireSubsteps));
    const summary = {
      sampleCount: frames.length,
      physicsUpdateMs: {
        p50: percentile(updateTimes, 0.5),
        p95: percentile(updateTimes, 0.95),
        p99: percentile(updateTimes, 0.99),
        current: updateTimes.at(-1) || 0
      },
      backlog: {
        current: finite(latest?.counters?.backlogSteps),
        peak: this.peakBacklogSteps
      },
      expensiveSubsystems,
      latestCounters: cloneNumbers(latest?.counters || {}),
      ccdActivationRates: {
        body: finite(totals.bodyCcdActivations) / tireSubsteps,
        static: finite(totals.staticColliderCcdActivations) / tireSubsteps,
        wheel: finite(totals.wheelCcdActivations) / tireSubsteps
      },
      recovery: {
        count: this.recoveryCount,
        lastReason: this.lastRecoveryReason
      },
      latestFrame: latest
    };
    this.summaryCache = summary;
    this.summaryCacheSequence = this.sequence;
    this.summaryCacheWindowFrames = resolvedWindowFrames;
    return summary;
  }

  reset() {
    for (let index = 0; index < this.frameHistory.length; index += 1) {
      this.frameRecordPool.push(this.frameHistory[index]);
    }
    for (let index = 0; index < this.stepHistory.length; index += 1) {
      this.stepRecordPool.push(this.stepHistory[index]);
    }
    this.frameHistory.length = 0;
    this.stepHistory.length = 0;
    this.stepElapsedHistoryLength = 0;
    this.stepElapsedHistoryCursor = 0;
    this.currentFrame = null;
    this.currentStep = null;
    this.timerStack.length = 0;
    this.peakBacklogSteps = 0;
    this.recoveryCount = 0;
    this.lastRecoveryReason = null;
    this.summaryCache = null;
    this.summaryCacheSequence = -Infinity;
    this.summaryCacheWindowFrames = null;
  }
}

export default PhysicsCostAccounting;
