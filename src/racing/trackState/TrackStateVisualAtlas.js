const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

const CHANNELS = Object.freeze([
  ['dampness', [42, 105, 142]],
  ['standingWater', [28, 103, 181]],
  ['puddles', [79, 164, 224]],
  ['rubber', [24, 22, 27]],
  ['marbles', [122, 105, 78]],
  ['dirt', [139, 101, 59]],
  ['mud', [91, 66, 43]],
  ['oil', [62, 35, 80]],
  ['debris', [191, 72, 44]],
  ['snow', [232, 242, 249]],
  ['ice', [118, 224, 246]]
]);

export function createTrackStateVisualAtlas(trackState, {
  centerX = 0,
  centerZ = 0,
  resolution = 192,
  worldSizeM = 192
} = {}) {
  const size = Math.max(16, Math.min(512, Math.trunc(Number(resolution) || 192)));
  const span = Math.max(16, Number(worldSizeM) || 192);
  const minX = Math.floor((Number(centerX) - span * 0.5));
  const minZ = Math.floor((Number(centerZ) - span * 0.5));
  const pixels = new Uint8ClampedArray(size * size * 4);
  const cells = trackState?.getVisualCells?.({
    minX,
    maxX: minX + span,
    minZ,
    maxZ: minZ + span
  }) || [];
  cells.forEach((cell) => {
    const px = Math.floor((Number(cell.x) - minX) / span * size);
    const pz = Math.floor((Number(cell.z) - minZ) / span * size);
    if (px < 0 || pz < 0 || px >= size || pz >= size) return;
    const active = CHANNELS.map(([field, color]) => ({ value: clamp(cell[field]), color }))
      .filter(({ value }) => value > 0.002);
    if (!active.length) return;
    const total = active.reduce((sum, entry) => sum + entry.value, 0);
    const strength = Math.max(...active.map((entry) => entry.value));
    const offset = (pz * size + px) * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[offset + channel] = Math.round(active.reduce((sum, entry) => (
        sum + entry.color[channel] * entry.value
      ), 0) / total);
    }
    pixels[offset + 3] = Math.round(clamp(0.08 + strength * 0.72) * 255);
  });
  return Object.freeze({
    stepIndex: Number(trackState?.stepIndex || 0),
    resolution: size,
    worldSizeM: span,
    originX: minX,
    originZ: minZ,
    pixels,
    cellCount: cells.length
  });
}
