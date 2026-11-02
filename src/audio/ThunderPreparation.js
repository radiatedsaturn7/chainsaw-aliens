import { createThunderSamples, fillThunderSamples } from './ThunderSamples.js';

// Preparation starts at the lightning flash, during the physical sound delay.
// No mandatory worker support: fallback yields between small sample batches.
export class ThunderPreparation {
  constructor({ workerFactory = () => new Worker(new URL('./ThunderSamples.worker.js', import.meta.url), { type: 'module' }),
    schedule = fn => setTimeout(fn, 0) } = {}) {
    this.schedule = schedule;
    this.jobs = new Map(); this.sequence = 0;
    try {
      this.worker = workerFactory();
      this.worker.onmessage = ({ data }) => {
        const job = this.jobs.get(data.id);
        if (!job) return;
        this.jobs.delete(data.id); job.resolve(data.samples);
      };
      this.worker.onerror = () => {
        this.worker?.terminate(); this.worker = null;
        for (const [id, job] of this.jobs) this.fallback(id, job);
      };
    } catch { this.worker = null; }
  }
  prepare(options) {
    if (this.jobs.size >= 16) return Promise.resolve(null);
    const id = ++this.sequence;
    return new Promise(resolve => {
      const job = { options, resolve }; this.jobs.set(id, job);
      if (this.worker) {
        try { this.worker.postMessage({ id, options }); }
        catch { this.fallback(id, job); }
      } else this.fallback(id, job);
    });
  }
  fallback(id, job) {
    if (job.fallback) return;
    job.fallback = true;
    const state = createThunderSamples(job.options);
    const slice = () => {
      if (!this.jobs.has(id)) return;
      if (!fillThunderSamples(state, 2048)) { this.schedule(slice); return; }
      this.jobs.delete(id); job.resolve(state.samples);
    };
    this.schedule(slice);
  }
  dispose() {
    this.worker?.terminate(); this.worker = null;
    for (const job of this.jobs.values()) job.resolve(null);
    this.jobs.clear();
  }
}
