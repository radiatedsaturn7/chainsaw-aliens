const PROFILES = Object.freeze({
  asphalt: Object.freeze({
    grip: 1,
    rollingResistance: 1,
    permeability: 0.03,
    saturationDepthMm: 0.65,
    drainageRateMmPerS: 0.028,
    roughness: 0.08,
    looseMarbles: 0.015,
    dust: 0.015,
    dirt: 0,
    mud: 0,
    snowDepthMm: 0,
    iceDepthMm: 0,
    heatResponse: 0.11,
    sunExposure: 0.85,
    windExposure: 0.62,
    rubberAcceptance: 1
  }),
  'wet-asphalt': Object.freeze({
    grip: 1,
    rollingResistance: 1.02,
    permeability: 0.03,
    saturationDepthMm: 0.75,
    drainageRateMmPerS: 0.024,
    roughness: 0.08,
    moistureDepthMm: 0.65,
    standingWaterDepthMm: 0.25,
    looseMarbles: 0.01,
    heatResponse: 0.11,
    sunExposure: 0.82,
    windExposure: 0.6,
    rubberAcceptance: 1
  }),
  dirt: Object.freeze({
    grip: 0.72,
    rollingResistance: 1.22,
    permeability: 0.72,
    saturationDepthMm: 4,
    drainageRateMmPerS: 0.075,
    roughness: 0.34,
    looseMarbles: 0.06,
    dust: 0.28,
    dirt: 0.72,
    mud: 0,
    heatResponse: 0.16,
    sunExposure: 0.78,
    windExposure: 0.72,
    rubberAcceptance: 0.32
  }),
  gravel: Object.freeze({
    grip: 0.68,
    rollingResistance: 1.3,
    permeability: 0.82,
    saturationDepthMm: 2.8,
    drainageRateMmPerS: 0.12,
    roughness: 0.46,
    looseMarbles: 0.62,
    dust: 0.2,
    dirt: 0.12,
    mud: 0,
    heatResponse: 0.13,
    sunExposure: 0.82,
    windExposure: 0.78,
    rubberAcceptance: 0.18
  }),
  'wet-gravel': Object.freeze({
    grip: 0.68,
    rollingResistance: 1.36,
    permeability: 0.76,
    saturationDepthMm: 3.3,
    drainageRateMmPerS: 0.095,
    roughness: 0.48,
    moistureDepthMm: 1.6,
    looseMarbles: 0.5,
    dust: 0.04,
    dirt: 0.16,
    mud: 0.12,
    heatResponse: 0.13,
    sunExposure: 0.78,
    windExposure: 0.72,
    rubberAcceptance: 0.16
  }),
  mud: Object.freeze({
    grip: 0.58,
    rollingResistance: 1.72,
    permeability: 0.42,
    saturationDepthMm: 6,
    drainageRateMmPerS: 0.035,
    roughness: 0.42,
    moistureDepthMm: 3,
    dirt: 0.32,
    mud: 0.85,
    heatResponse: 0.18,
    sunExposure: 0.72,
    windExposure: 0.62,
    rubberAcceptance: 0.08
  }),
  snow: Object.freeze({
    grip: 0.34,
    rollingResistance: 1.75,
    permeability: 0.2,
    saturationDepthMm: 2,
    drainageRateMmPerS: 0.015,
    roughness: 0.32,
    snowDepthMm: 25,
    heatResponse: 0.09,
    sunExposure: 0.82,
    windExposure: 0.88,
    rubberAcceptance: 0.02
  }),
  slush: Object.freeze({
    grip: 0.44,
    rollingResistance: 1.58,
    permeability: 0.24,
    saturationDepthMm: 2.5,
    drainageRateMmPerS: 0.018,
    roughness: 0.28,
    moistureDepthMm: 1.5,
    standingWaterDepthMm: 0.8,
    snowDepthMm: 10,
    iceDepthMm: 0.5,
    heatResponse: 0.1,
    sunExposure: 0.8,
    windExposure: 0.82,
    rubberAcceptance: 0.03
  }),
  grass: Object.freeze({
    grip: 0.55,
    rollingResistance: 1.5,
    permeability: 0.86,
    saturationDepthMm: 5,
    drainageRateMmPerS: 0.085,
    roughness: 0.45,
    dust: 0.08,
    dirt: 0.34,
    heatResponse: 0.17,
    sunExposure: 0.76,
    windExposure: 0.67,
    rubberAcceptance: 0.06
  }),
  generic: Object.freeze({
    grip: 0.7,
    rollingResistance: 1.25,
    permeability: 0.45,
    saturationDepthMm: 2.5,
    drainageRateMmPerS: 0.05,
    roughness: 0.3,
    looseMarbles: 0.05,
    dust: 0.08,
    dirt: 0.08,
    mud: 0,
    heatResponse: 0.14,
    sunExposure: 0.7,
    windExposure: 0.65,
    rubberAcceptance: 0.25
  })
});

export const TRACK_STATE_SURFACE_PROFILES = PROFILES;

export function normalizeTrackStateSurfaceId(surfaceId = 'generic', materialId = '') {
  const source = `${surfaceId} ${materialId}`.toLowerCase();
  if (/wet.*asphalt|asphalt.*wet/.test(source)) return 'wet-asphalt';
  if (/wet.*gravel|gravel.*wet/.test(source)) return 'wet-gravel';
  if (/slush/.test(source)) return 'slush';
  if (/snow/.test(source)) return 'snow';
  if (/mud/.test(source)) return 'mud';
  if (/gravel|rock/.test(source)) return 'gravel';
  if (/grass/.test(source)) return 'grass';
  if (/dirt|sand/.test(source)) return 'dirt';
  if (/terrain/.test(source)) return 'grass';
  if (/asphalt|road|tarmac|pavement|concrete|metal/.test(source)) return 'asphalt';
  return PROFILES[surfaceId] ? surfaceId : 'generic';
}

export function getTrackStateSurfaceProfile(surfaceId = 'generic', materialId = '', overrides = null) {
  const id = normalizeTrackStateSurfaceId(surfaceId, materialId);
  return {
    ...PROFILES.generic,
    ...(PROFILES[id] || {}),
    ...(overrides?.generic || {}),
    ...(overrides?.[id] || {}),
    id
  };
}
