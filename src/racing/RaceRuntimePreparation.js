export default class RaceRuntimePreparation {
  constructor({ maxEntries = 3 } = {}) {
    this.maxEntries = Math.max(1, Math.round(Number(maxEntries) || 3));
    this.packages = new Map();
    this.inFlight = new Map();
    this.lastDiagnostics = null;
  }

  get(key = '') {
    const clean = String(key || '');
    if (!clean || !this.packages.has(clean)) return null;
    const value = this.packages.get(clean);
    this.packages.delete(clean);
    this.packages.set(clean, value);
    return value;
  }

  set(key = '', value = null) {
    const clean = String(key || '');
    if (!clean || !value) return value;
    this.packages.delete(clean);
    this.packages.set(clean, value);
    while (this.packages.size > this.maxEntries) {
      const oldestKey = this.packages.keys().next().value;
      this.packages.delete(oldestKey);
    }
    return value;
  }

  delete(key = '') {
    const clean = String(key || '');
    this.inFlight.delete(clean);
    return this.packages.delete(clean);
  }

  clear() {
    this.packages.clear();
    this.inFlight.clear();
    this.lastDiagnostics = null;
  }

  getInFlight(key = '') {
    return this.inFlight.get(String(key || '')) || null;
  }

  setInFlight(key = '', promise = null) {
    const clean = String(key || '');
    if (!clean || !promise) return promise;
    this.inFlight.set(clean, promise);
    Promise.resolve(promise).then(
      () => {
        if (this.inFlight.get(clean) === promise) this.inFlight.delete(clean);
      },
      () => {
        if (this.inFlight.get(clean) === promise) this.inFlight.delete(clean);
      }
    );
    return promise;
  }

  recordDiagnostics(diagnostics = null) {
    this.lastDiagnostics = diagnostics ? { ...diagnostics } : null;
    return this.lastDiagnostics;
  }
}
