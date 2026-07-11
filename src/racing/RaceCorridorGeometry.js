const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getRaceSurfaceBakeKey({
  raceId = 'race',
  surfaceGeometryRevision = '',
  routeLength = 1,
  runtimeType = 'destination',
  allowVisualExtension = false,
  step = 2.5
} = {}) {
  const routeEnd = Math.max(1, Number(routeLength) || 1);
  return [
    raceId,
    surfaceGeometryRevision,
    runtimeType,
    allowVisualExtension ? 1 : 0,
    Math.round(routeEnd * 10),
    Math.round(Number(step || 2.5) * 100)
  ].join('::');
}

export function buildRaceSurfaceBake({
  routeLength = 1,
  runtimeType = 'destination',
  allowVisualExtension = false,
  step = 2.5,
  adapter = {}
} = {}) {
  const routeEnd = Math.max(1, Number(routeLength) || 1);
  const effectiveStep = clamp(Number(step) || 2.5, 1.25, 5);
  const profile = adapter.getRoadbedProfile?.({
    routeLength: routeEnd,
    runtimeType,
    allowVisualExtension,
    step: effectiveStep
  });
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  const sections = samples.map((sample) => adapter.createSurfaceSectionFromSample?.(sample, {
    distance: Number(sample.distance || 0)
  })).filter(Boolean);
  return {
    profile,
    routeLength: routeEnd,
    runtimeType,
    allowVisualExtension,
    step: effectiveStep,
    sections
  };
}
