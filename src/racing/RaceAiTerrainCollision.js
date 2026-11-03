// The same conservative swept terrain classification used by the player.
// Only proven smooth, supported geometry may bypass dense collision probes.
export function classifyRaceAiTerrainCollision(frame, state, config, positions, dt = 1 / 120) {
  if (!frame) return {};
  const profile = config.bodyProfile || {};
  const halfWidth = Number(profile.overallWidthM || config.bodyWidthM || 1.8) / 2;
  const halfLength = Number(profile.overallLengthM || config.bodyLengthM || 4.5) / 2;
  const height = Number(profile.overallHeightM || config.bodyHeightM || 1.45);
  const reach = Math.hypot(halfWidth, halfLength) + 0.15;
  const p = state.position, v = state.velocity || {}, angular = state.angularVelocityWorld || {};
  const predictedX = p.x + Number(v.x || 0) * dt;
  const predictedZ = p.z + Number(v.z || 0) * dt;
  const probe = Number(config.bodyCollisionLowerHullProbeRangeM ?? 0.08);
  const underbody = p.y - Number(config.cgHeightM || 0.55)
    + Number(config.bodyGroundClearanceM || 0.13)
    + Math.min(0, Number(v.y || 0) * dt)
    - Math.hypot(Number(angular.x || 0), Number(angular.z || 0)) * dt * Math.max(halfWidth, halfLength);
  const bounds = {
    minX: Math.min(p.x, predictedX) - reach, maxX: Math.max(p.x, predictedX) + reach,
    minZ: Math.min(p.z, predictedZ) - reach, maxZ: Math.max(p.z, predictedZ) + reach,
    minY: underbody - probe,
    maxY: Math.max(p.y, p.y + Number(v.y || 0) * dt) + height
  };
  const body = frame.classifyCollisionFeaturesInBounds(bounds, {});
  const center = frame.samplePoint(p);
  const result = {
    chassisMaximumTerrainHeightM: frame.maximumHeightInBounds(bounds),
    bodyTerrainCollisionClassification: body.classification,
    terrainHasDiscontinuities: body.discontinuity,
    adaptiveBodySupport: body.discontinuity,
    bodyCollisionPredicted: body.discontinuity || center?.valid !== true
      || !Number.isFinite(center.heightM) || underbody - center.heightM <= probe
      || Math.abs(Number(state.pitchRad || 0)) > 0.35
      || Math.abs(Number(state.rollRad || 0)) > 0.35
  };
  const radius = Math.max(0.1, Number(config.wheelRadiusM || 0.34));
  let minHeight = Infinity, maxHeight = -Infinity;
  for (const id in positions) {
    if (!Object.hasOwn(positions, id)) continue;
    minHeight = Math.min(minHeight, positions[id].y);
    maxHeight = Math.max(maxHeight, positions[id].y);
  }
  bounds.minY = minHeight - radius - probe;
  bounds.maxY = maxHeight + radius + probe;
  result.terrainCollisionClassification = frame.classifyCollisionFeaturesInBounds(bounds, {}).classification;
  return result;
}
