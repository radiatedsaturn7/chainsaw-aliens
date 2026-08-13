import { clamp } from './SimulationMath.js';

export function createContactFootprintScratch() {
  const acceptedSamples = [];
  const pressureBySample = [];
  const normal = { x: 0, y: 1, z: 0 };
  return {
    sortedSamples: new Array(8),
    weights: new Float64Array(8),
    acceptedSamples,
    pressureBySample,
    normal,
    result: {
      supportedFraction: 0,
      heightM: null,
      normal,
      pressureBySample,
      samples: acceptedSamples
    }
  };
}

export function resolveContactFootprint(
  samples = [],
  { maxGapM = 0.045, minimumSamples = 4 } = {},
  scratch = createContactFootprintScratch()
) {
  const sorted = scratch.sortedSamples;
  const weights = scratch.weights;
  const accepted = scratch.acceptedSamples;
  const pressureBySample = scratch.pressureBySample;
  const normal = scratch.normal;
  const result = scratch.result;
  accepted.length = 0;
  pressureBySample.length = 0;
  let validCount = 0;
  for (let sampleIndex = 0; sampleIndex < samples.length && validCount < 8; sampleIndex += 1) {
    const sample = samples[sampleIndex];
    if (sample?.valid === false
      || sample?.supported === false
      || !Number.isFinite(Number(sample?.heightM))) continue;
    // Stable insertion sort preserves the old stable Array.sort ordering for
    // equal heights without constructing filter, slice, and sorted arrays.
    let insertionIndex = validCount;
    while (insertionIndex > 0
      && Number(sorted[insertionIndex - 1].heightM) < Number(sample.heightM)) {
      sorted[insertionIndex] = sorted[insertionIndex - 1];
      insertionIndex -= 1;
    }
    sorted[insertionIndex] = sample;
    validCount += 1;
  }
  if (validCount === 0) {
    normal.x = 0;
    normal.y = 1;
    normal.z = 0;
    result.supportedFraction = 0;
    result.heightM = null;
    return result;
  }

  // The tire meets the highest coherent support patch first. Do not average a
  // curb top and road surface into a plane that exists nowhere in the world.
  let acceptedCount = 1;
  while (acceptedCount < validCount
    && Math.abs(
      Number(sorted[acceptedCount - 1].heightM) - Number(sorted[acceptedCount].heightM)
    ) <= maxGapM) {
    acceptedCount += 1;
  }
  let totalWeight = 0;
  for (let index = 0; index < acceptedCount; index += 1) {
    const weight = Math.max(0.01, Number(sorted[index].pressureWeight ?? 1));
    weights[index] = weight;
    totalWeight += weight;
  }
  let heightM = 0;
  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;
  for (let index = 0; index < acceptedCount; index += 1) {
    const sample = sorted[index];
    const weight = weights[index];
    heightM += Number(sample.heightM ?? 0) * weight;
    normalX += Number(sample.normalX ?? sample.normal?.x ?? 0) * weight;
    normalY += Number(sample.normalY ?? sample.normal?.y ?? 1) * weight;
    normalZ += Number(sample.normalZ ?? sample.normal?.z ?? 0) * weight;
  }
  heightM /= totalWeight;
  normalX /= totalWeight;
  normalY /= totalWeight;
  normalZ /= totalWeight;
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  for (let index = 0; index < acceptedCount; index += 1) {
    accepted.push(sorted[index]);
    pressureBySample.push(weights[index] / totalWeight);
  }
  normal.x = normalX / normalLength;
  normal.y = normalY / normalLength;
  normal.z = normalZ / normalLength;
  result.supportedFraction = clamp(
    acceptedCount / Math.max(minimumSamples, samples.length), 0, 1
  );
  result.heightM = heightM;
  return result;
}
