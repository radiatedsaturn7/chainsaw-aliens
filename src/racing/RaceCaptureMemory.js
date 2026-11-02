// Read-only, opt-in recording telemetry. No forced GC or expensive heap snapshots.
export function readBrowserHeap() {
  try {
    const memory = globalThis.performance?.memory;
    if (!memory) return null;
    const {usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit} = memory;
    if (![usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit].every(
      value => Number.isFinite(value) && value >= 0
    )) return null;
    return {usedBytes: usedJSHeapSize, committedBytes: totalJSHeapSize, limitBytes: jsHeapSizeLimit};
  } catch { return null; }
}

export class RaceCaptureMemory {
  constructor({readHeap = readBrowserHeap, intervalMs = 500, maxSamples = 512} = {}) {
    this.readHeap = readHeap;
    this.intervalMs = intervalMs;
    this.maxSamples = maxSamples;
    this.nextSampleAtMs = 0;
    this.samples = [];
    this.heapStatus = 'unavailable';
  }
  due(atMs) {
    return this.samples.length < this.maxSamples && atMs >= this.nextSampleAtMs;
  }
  sample(atMs, resources) {
    if (!this.due(atMs)) return;
    this.nextSampleAtMs = atMs + this.intervalMs;
    let heap = null;
    try { heap = this.readHeap(); } catch { /* Optional browser API. */ }
    if (heap) this.heapStatus = 'available';
    this.samples.push({atMs, heap: heap ? {...heap} : null, ...resources});
  }
  report() {
    return {
      source: 'performance.memory', heapStatus: this.heapStatus,
      intervalMs: this.intervalMs, maxSamples: this.maxSamples, samples: this.samples,
      limitations: [
        'Heap readings are optional, browser-specific, possibly rounded/stale and exclude some native/GPU memory.',
        'Heap decreases are observations, not confirmed garbage-collection events or pause durations.',
        'Recorder counts and renderer resource counts are not byte measurements. Car-art RGBA bytes are an estimate only.'
      ]
    };
  }
}
