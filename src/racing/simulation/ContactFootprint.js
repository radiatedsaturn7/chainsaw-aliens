import { clamp } from './SimulationMath.js';

export function resolveContactFootprint(samples = [], { maxGapM = 0.045, minimumSamples = 4 } = {}) {
  const valid = samples.filter((s) => Number.isFinite(Number(s.heightM)) && s.supported !== false)
    .slice(0, 8);
  if (!valid.length) return { supportedFraction: 0, heightM: null, normal: { x: 0, y: 1, z: 0 }, samples: [] };
  const sorted = [...valid].sort((left, right) => Number(right.heightM) - Number(left.heightM));
  const clusters = [];
  sorted.forEach((sample) => {
    const previous = clusters.at(-1)?.at(-1);
    if (!previous || Math.abs(Number(previous.heightM) - Number(sample.heightM)) > maxGapM) {
      clusters.push([sample]);
    } else {
      clusters.at(-1).push(sample);
    }
  });
  // The tire meets the highest coherent support patch first. Do not average a
  // curb top and road surface into a plane that exists nowhere in the world.
  const accepted = clusters[0];
  const weights = accepted.map((s) => Math.max(0.01, Number(s.pressureWeight ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  const average = (field, fallback = 0) => accepted.reduce((sum, s, i) => sum + Number(s[field] ?? fallback) * weights[i], 0) / total;
  const rawNormal = { x: average('normalX'), y: average('normalY', 1), z: average('normalZ') };
  const normalLength = Math.hypot(rawNormal.x, rawNormal.y, rawNormal.z) || 1;
  return {
    supportedFraction: clamp(accepted.length / Math.max(minimumSamples, samples.length), 0, 1),
    heightM: average('heightM'),
    normal: { x: rawNormal.x / normalLength, y: rawNormal.y / normalLength, z: rawNormal.z / normalLength },
    pressureBySample: accepted.map((_s, i) => weights[i] / total),
    samples: accepted
  };
}
