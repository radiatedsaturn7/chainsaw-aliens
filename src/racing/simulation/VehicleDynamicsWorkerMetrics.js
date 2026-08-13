function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

export class VehicleDynamicsWorkerMetrics {
  constructor({ sampleLimit = 1024 } = {}) {
    this.sampleLimit = Math.max(8, Number(sampleLimit) || 1024);
    this.workerMs = [];
    this.renderMs = [];
    this.backlogSteps = 0;
    this.peakBacklogSteps = 0;
    this.workerSummary = null;
    this.renderSummary = null;
    this.workerRevision = 0;
    this.renderRevision = 0;
    this.workerSummaryRevision = -1;
    this.renderSummaryRevision = -1;
  }

  recordWorker(milliseconds, backlogSteps = 0) {
    this.#append(this.workerMs, milliseconds);
    this.workerRevision += 1;
    this.backlogSteps = Math.max(0, Number(backlogSteps) || 0);
    this.peakBacklogSteps = Math.max(this.peakBacklogSteps, this.backlogSteps);
  }

  recordRender(milliseconds) {
    this.#append(this.renderMs, milliseconds);
    this.renderRevision += 1;
  }

  #append(samples, value) {
    if (!Number.isFinite(Number(value))) return;
    samples.push(Math.max(0, Number(value)));
    if (samples.length > this.sampleLimit) samples.splice(0, samples.length - this.sampleLimit);
  }

  #summary(samples) {
    const sorted = [...samples].sort((left, right) => left - right);
    return {
      samples: sorted.length,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99)
    };
  }

  #getCachedSummary(samples, cacheField, revisionField, summaryRevisionField, force) {
    const cached = this[cacheField];
    if (force || !cached
      || this[revisionField] - this[summaryRevisionField] >= 32) {
      this[cacheField] = this.#summary(samples);
      this[summaryRevisionField] = this[revisionField];
    }
    return this[cacheField];
  }

  getSummary({ force = true } = {}) {
    return {
      worker: this.#getCachedSummary(
        this.workerMs, 'workerSummary', 'workerRevision', 'workerSummaryRevision', force
      ),
      render: this.#getCachedSummary(
        this.renderMs, 'renderSummary', 'renderRevision', 'renderSummaryRevision', force
      ),
      backlog: { current: this.backlogSteps, peak: this.peakBacklogSteps }
    };
  }
}
