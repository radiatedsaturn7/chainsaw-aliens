import { clamp } from './SimulationMath.js';

export function resolveContactFootprint(samples = [], { maxGapM = 0.22, minimumSamples = 4 } = {}) {
  const valid = samples.filter((s) => Number.isFinite(Number(s.heightM)) && s.supported !== false)
    .slice(0, 8);
  if (!valid.length) return { supportedFraction: 0, heightM: null, normal: { x: 0, y: 1, z: 0 }, samples: [] };
  const heights = valid.map((s) => Number(s.heightM)).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  const accepted = valid.filter((s) => Math.abs(Number(s.heightM) - median) <= maxGapM);
  const weights = accepted.map((s) => Math.max(0.01, Number(s.pressureWeight ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  const average = (field, fallback = 0) => accepted.reduce((sum, s, i) => sum + Number(s[field] ?? fallback) * weights[i], 0) / total;
  return {
    supportedFraction: clamp(accepted.length / Math.max(minimumSamples, samples.length), 0, 1),
    heightM: average('heightM'),
    normal: { x: average('normalX'), y: average('normalY', 1), z: average('normalZ') },
    pressureBySample: accepted.map((_s, i) => weights[i] / total),
    samples: accepted
  };
}
