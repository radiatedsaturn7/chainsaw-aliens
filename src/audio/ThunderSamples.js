// Identical seeded thunder synthesis in workers and incremental fallback jobs.
export function createThunderSamples({ sampleRate, durationSeconds, near, seed, pulseDelays }) {
  return { samples: new Float32Array(Math.max(1, Math.floor(sampleRate * durationSeconds))),
    sampleRate, near, seed, noiseSeed: (Number(seed) >>> 0) || 0x6d2b79f5,
    lowNoise: 0, index: 0, crackTimes: pulseDelays.filter(v => Number.isFinite(v) && v >= 0 && v < 1).slice(0, 5) };
}
export function fillThunderSamples(job, count = Infinity) {
  const end = Math.min(job.samples.length, job.index + count);
  for (; job.index < end; job.index++) {
    job.noiseSeed = Math.imul(job.noiseSeed ^ (job.noiseSeed >>> 15), 1 | job.noiseSeed);
    job.noiseSeed ^= job.noiseSeed + Math.imul(job.noiseSeed ^ (job.noiseSeed >>> 7), 61 | job.noiseSeed);
    const random = (((job.noiseSeed ^ (job.noiseSeed >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    const progress = job.index / job.samples.length, t = job.index / job.sampleRate;
    job.lowNoise += .08 * (random - job.lowNoise);
    const crack = job.crackTimes.reduce((sum, delay) => sum + (t >= delay ? Math.exp(-(t-delay)*38) : 0), 0) * job.near;
    const roll = (.4 + .6 * Math.pow(Math.sin(t*4.3+(job.seed%13)), 2)) * Math.exp(-progress*2.5);
    job.samples[job.index] = random*crack*.65 + job.lowNoise*roll*(.7-job.near*.25);
  }
  return job.index === job.samples.length;
}
