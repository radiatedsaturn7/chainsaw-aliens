import { clamp } from './SimulationMath.js';

const WET_SURFACE_BY_BASE = Object.freeze({
  asphalt: 'wet-asphalt',
  gravel: 'wet-gravel',
  dirt: 'mud',
  snow: 'slush'
});

const smoothstep = (value) => {
  const t = clamp(Number(value) || 0, 0, 1);
  return t * t * (3 - 2 * t);
};

export function getSurfaceConditionCoverage(material = {}) {
  const saturationDepthMm = Math.max(0.1, Number(material.saturationDepthMm || 1));
  return {
    wet: smoothstep(Math.max(0, Number(material.moistureDepthMm || 0)) / saturationDepthMm),
    // Snow coverage is intentionally continuous across the old 2 mm display
    // threshold. Thirty-five millimetres is the existing Track State full-risk
    // depth and therefore needs no new tire tuning coefficient.
    snow: smoothstep(Math.max(0, Number(material.snowDepthMm || 0)) / 35),
    ice: smoothstep(Math.max(0, Number(material.iceDepthMm || 0)) / 2)
  };
}

export function resolveCompoundSurfaceGrip(compound = {}, material = {}) {
  const surfaceGrip = compound.surfaceGrip || {};
  const displaySurfaceId = String(material.surfaceId || 'asphalt');
  const baseSurfaceId = String(material.baseSurfaceId || displaySurfaceId || 'asphalt');
  const baseGrip = Number(surfaceGrip[baseSurfaceId] ?? surfaceGrip[displaySurfaceId] ?? compound.grip ?? 1);
  const wetSurfaceId = WET_SURFACE_BY_BASE[baseSurfaceId] || baseSurfaceId;
  const wetGrip = Number(surfaceGrip[wetSurfaceId] ?? baseGrip);
  const snowGrip = Number(surfaceGrip.snow ?? surfaceGrip.slush ?? baseGrip);
  const coverage = getSurfaceConditionCoverage(material);
  let grip = baseGrip + (wetGrip - baseGrip) * coverage.wet;
  grip += (snowGrip - grip) * coverage.snow;
  grip += (snowGrip - grip) * coverage.ice;
  return clamp(grip, 0.05, 2);
}
