const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function normalizeRaceWaterRegions(regions = []) {
  return (Array.isArray(regions) ? regions : []).map((region, index) => {
    const levelM = finite(region.levelM);
    return {
      id: String(region.id || `water-${index + 1}`), name: String(region.name || 'Water'),
      x: finite(region.x), z: finite(region.z),
      widthM: clamp(finite(region.widthM, 30), 1, 10000), lengthM: clamp(finite(region.lengthM, 30), 1, 10000),
      levelM, bottomM: Math.min(levelM - 0.01, finite(region.bottomM, levelM - 2)),
      color: /^#[\da-f]{6}$/i.test(region.color || '') ? region.color : '#287fa3'
    };
  });
}

export function sampleRaceWater(regions, position) {
  let selected = null;
  for (const region of regions || []) {
    if (Math.abs(position.x - region.x) > region.widthM / 2
      || Math.abs(position.z - region.z) > region.lengthM / 2
      || position.y < region.bottomM) continue;
    if (!selected || region.levelM > selected.levelM) selected = region;
  }
  return selected;
}

// Water is a volume, not a replacement road surface: tires keep sampling the
// riverbed. Quadratic drag is bounded by available momentum per fixed substep.
export function calculateRaceWaterForces({ state, config, regions, dt, previousEngineDamage = 0 }) {
  const position = state.position || {}, velocity = state.velocity || {};
  const bodyBottom = finite(position.y) - finite(config.cgHeightM, 0.55);
  const water = sampleRaceWater(regions, { ...position, y: Math.max(bodyBottom, finite(position.y) - 0.1) });
  const depthM = water ? clamp(water.levelM - Math.max(bodyBottom, water.bottomM), 0, 3) : 0;
  const forceWorldN = { x: 0, y: 0, z: 0 };
  if (depthM > 0) {
    const area = finite(config.trackWidthM, 1.6) * Math.min(1.5, depthM);
    const speed = Math.hypot(finite(velocity.x), finite(velocity.y), finite(velocity.z));
    const coefficient = Math.min(500 * area * speed, finite(config.massKg, 1400) / Math.max(1e-6, dt) * 0.8);
    for (const axis of ['x', 'y', 'z']) forceWorldN[axis] = finite(velocity[axis]) === 0 ? 0 : -finite(velocity[axis]) * coefficient;
  }
  const flooded = depthM > 0 && water.levelM >= finite(position.y) + 0.25;
  return { depthM, forceWorldN, engineDamage: flooded ? 100 : previousEngineDamage };
}

export function raceWaterMeshes(regions, elevationScaleM = 12) {
  return (regions || []).map(water => ({
    source: `water:${water.id}`, color: water.color, textured: false, opacity: 0.65, threeLiftM: 0,
    points: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
      x: water.x + x * water.widthM / 2, z: water.z + z * water.lengthM / 2, elevation: water.levelM / elevationScaleM
    }))
  }));
}
