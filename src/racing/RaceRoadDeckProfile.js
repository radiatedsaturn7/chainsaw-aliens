const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function buildRaceRoadbedProfile({
  samples = null,
  routeLength = null,
  runtimeType = 'destination',
  allowVisualExtension = false,
  step = 2.5,
  elevationScaleM = 12,
  adapter = {}
} = {}) {
  const effectiveStep = clamp(Number(step) || 2.5, 1.25, 5);
  const sourceSamples = Array.isArray(samples) ? samples : null;
  const effectiveRouteLength = Math.max(
    1,
    Number(routeLength || sourceSamples?.at?.(-1)?.distance || adapter.getRouteLength?.() || 1) || 1
  );
  const robustCenterTerrainElevation = (pose, roadHalfWidth, routeElevation) => {
    const right = adapter.getRightVector?.(Number(pose.yaw || 0)) || { x: 1, z: 0 };
    const supportRadius = clamp(Math.max(0.75, roadHalfWidth * 0.32), 0.75, 2.5);
    const offsets = [-1, -0.55, -0.22, 0, 0.22, 0.55, 1].map((scale) => scale * supportRadius);
    const samplesAtOffsets = offsets.map((offset) => ({
      offset,
      elevation: adapter.sampleTerrain?.({
        x: Number(pose.x || 0) + right.x * offset,
        z: Number(pose.z || 0) + right.z * offset
      }, routeElevation)
    })).filter((sample) => Number.isFinite(Number(sample.elevation)));
    if (!samplesAtOffsets.length) {
      return {
        terrainElevation: adapter.clampElevation?.(routeElevation) ?? routeElevation,
        leftTerrainElevation: adapter.clampElevation?.(routeElevation) ?? routeElevation,
        rightTerrainElevation: adapter.clampElevation?.(routeElevation) ?? routeElevation
      };
    }
    const sorted = samplesAtOffsets.map((sample) => Number(sample.elevation || 0)).sort((a, b) => a - b);
    const trimmed = sorted.length > 4 ? sorted.slice(1, -1) : sorted;
    const median = sorted[Math.floor(sorted.length / 2)];
    const centerSample = samplesAtOffsets.reduce((best, sample) => (
      Math.abs(sample.offset) < Math.abs(best.offset) ? sample : best
    ), samplesAtOffsets[0]);
    const trimmedMean = trimmed.reduce((sum, value) => sum + value, 0) / Math.max(1, trimmed.length);
    return {
      terrainElevation: adapter.clampElevation?.((Number(centerSample.elevation || 0) * 0.5) + (median * 0.3) + (trimmedMean * 0.2)) ?? 0,
      leftTerrainElevation: adapter.clampElevation?.(samplesAtOffsets[0]?.elevation ?? centerSample.elevation) ?? 0,
      rightTerrainElevation: adapter.clampElevation?.(samplesAtOffsets.at(-1)?.elevation ?? centerSample.elevation) ?? 0
    };
  };
  const sampleSupportAt = (distance) => {
    const pose = adapter.getWorldPoseAtDistance?.(distance, {
      samples: sourceSamples,
      routeLength: effectiveRouteLength,
      runtimeType,
      allowVisualExtension
    }) || {};
    const routeElevation = adapter.clampElevation?.(pose.elevation) ?? Number(pose.elevation || 0);
    const roadHalfWidth = adapter.getRoadHalfWidth?.(pose.segment) ?? 0;
    const marginWidth = adapter.getMarginWidth?.(pose.segment) ?? 0;
    const shoulderWidth = adapter.getShoulderWidth?.(pose.segment) ?? 0;
    const {
      terrainElevation,
      leftTerrainElevation,
      rightTerrainElevation
    } = robustCenterTerrainElevation(pose, roadHalfWidth, routeElevation);
    const supportElevation = adapter.clampElevation?.(Math.max(routeElevation, terrainElevation)) ?? Math.max(routeElevation, terrainElevation);
    return {
      ...pose,
      distance,
      routeElevation,
      terrainElevation,
      leftTerrainElevation,
      rightTerrainElevation,
      supportElevation,
      roadHalfWidth,
      marginWidth,
      shoulderWidth,
      stampedHalfWidth: roadHalfWidth + marginWidth + shoulderWidth,
      blendWidth: shoulderWidth > 0
        ? Math.max(4, adapter.getBlendWidth?.(pose.segment) ?? 0, shoulderWidth * 0.75, roadHalfWidth * 0.65)
        : adapter.getBlendWidth?.(pose.segment) ?? 0,
      elevation: supportElevation
    };
  };
  const sampleCount = Math.max(2, Math.ceil(effectiveRouteLength / effectiveStep) + 1);
  let profileSamples = Array.from({ length: sampleCount }, (_, index) => {
    const distance = index === sampleCount - 1
      ? effectiveRouteLength
      : Math.min(effectiveRouteLength, index * effectiveStep);
    return sampleSupportAt(distance);
  });
  const weights = [
    { offset: -2, weight: 0.1 },
    { offset: -1, weight: 0.22 },
    { offset: 0, weight: 0.36 },
    { offset: 1, weight: 0.22 },
    { offset: 2, weight: 0.1 }
  ];
  for (let pass = 0; pass < 2; pass += 1) {
    profileSamples = profileSamples.map((sample, index) => {
      if (index === 0 || index === profileSamples.length - 1) return sample;
      let weighted = 0;
      let total = 0;
      weights.forEach(({ offset, weight }) => {
        const source = profileSamples[index + offset];
        if (!source) return;
        weighted += Number(source.elevation || 0) * weight;
        total += weight;
      });
      return {
        ...sample,
        elevation: adapter.clampElevation?.(Math.max(
          Number(sample.supportElevation || 0),
          total > 0 ? weighted / total : Number(sample.elevation || 0)
        )) ?? Number(sample.elevation || 0)
      };
    });
  }
  const maxGradePerSample = 0.045;
  for (let index = 1; index < profileSamples.length; index += 1) {
    const previous = profileSamples[index - 1];
    const sample = profileSamples[index];
    const maxDrop = maxGradePerSample * Math.max(1, (Number(sample.distance || 0) - Number(previous.distance || 0)) / effectiveStep);
    sample.elevation = adapter.clampElevation?.(Math.max(Number(sample.elevation || 0), Number(previous.elevation || 0) - maxDrop)) ?? sample.elevation;
  }
  for (let index = profileSamples.length - 2; index >= 0; index -= 1) {
    const next = profileSamples[index + 1];
    const sample = profileSamples[index];
    const maxDrop = maxGradePerSample * Math.max(1, (Number(next.distance || 0) - Number(sample.distance || 0)) / effectiveStep);
    sample.elevation = adapter.clampElevation?.(Math.max(
      Number(sample.supportElevation || 0),
      Number(sample.elevation || 0),
      Number(next.elevation || 0) - maxDrop
    )) ?? sample.elevation;
  }
  profileSamples = profileSamples.map((sample, index) => {
    const previous = profileSamples[Math.max(0, index - 2)];
    const next = profileSamples[Math.min(profileSamples.length - 1, index + 2)];
    const span = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
    const grade = clamp(
      ((Number(next.elevation || 0) - Number(previous.elevation || 0)) * elevationScaleM) / span,
      -0.42,
      0.42
    );
    return { ...sample, grade };
  });
  return {
    samples: profileSamples,
    routeLength: effectiveRouteLength,
    step: effectiveStep,
    runtimeType,
    allowVisualExtension
  };
}

export function sampleRaceRoadbedProfileAtDistance(distance = 0, profile = null, {
  clampElevation = (value) => Number(value) || 0,
  getSampleSpanAtDistance = null
} = {}) {
  const profileSamples = Array.isArray(profile?.samples) ? profile.samples : [];
  if (!profileSamples.length) return null;
  const routeLength = Math.max(1, Number(profile.routeLength || profileSamples.at(-1)?.distance || 1) || 1);
  const requestedDistance = Number(distance) || 0;
  const target = profile.runtimeType === 'circuit'
    ? (requestedDistance % routeLength + routeLength) % routeLength
    : clamp(requestedDistance, 0, routeLength);
  const span = getSampleSpanAtDistance
    ? getSampleSpanAtDistance(profileSamples, target)
    : (() => {
      let previous = profileSamples[0];
      let next = profileSamples[profileSamples.length - 1];
      for (let index = 1; index < profileSamples.length; index += 1) {
        if (Number(profileSamples[index].distance || 0) >= target) {
          previous = profileSamples[index - 1];
          next = profileSamples[index];
          break;
        }
      }
      const denom = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
      return { previous, next, t: clamp((target - Number(previous.distance || 0)) / denom, 0, 1) };
    })();
  const { previous, next, t } = span;
  if (!previous && !next) return profileSamples[0] || null;
  if (!previous || !next || previous === next) return previous || next;
  const lerp = (a, b) => Number(a || 0) + (Number(b || 0) - Number(a || 0)) * t;
  return {
    ...next,
    distance: target,
    x: lerp(previous.x, next.x),
    z: lerp(previous.z, next.z),
    yaw: Number(previous.yaw || 0) + normalizeAngle(Number(next.yaw || 0) - Number(previous.yaw || 0)) * t,
    elevation: clampElevation(lerp(previous.elevation, next.elevation)),
    routeElevation: clampElevation(lerp(previous.routeElevation, next.routeElevation)),
    terrainElevation: clampElevation(lerp(previous.terrainElevation, next.terrainElevation)),
    leftTerrainElevation: clampElevation(lerp(previous.leftTerrainElevation, next.leftTerrainElevation)),
    rightTerrainElevation: clampElevation(lerp(previous.rightTerrainElevation, next.rightTerrainElevation)),
    supportElevation: clampElevation(lerp(previous.supportElevation, next.supportElevation)),
    roadHalfWidth: lerp(previous.roadHalfWidth, next.roadHalfWidth),
    marginWidth: lerp(previous.marginWidth, next.marginWidth),
    shoulderWidth: lerp(previous.shoulderWidth, next.shoulderWidth),
    stampedHalfWidth: lerp(previous.stampedHalfWidth, next.stampedHalfWidth),
    blendWidth: lerp(previous.blendWidth, next.blendWidth),
    grade: lerp(previous.grade, next.grade),
    segment: next.segment || previous.segment || null,
    index: next.index ?? previous.index ?? 0,
    progress: t
  };
}
