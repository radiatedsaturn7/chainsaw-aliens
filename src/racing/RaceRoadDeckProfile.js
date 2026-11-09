const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function buildRaceRoadbedProfile({
  samples = null,
  routeLength = null,
  runtimeType = 'destination',
  allowVisualExtension = false,
  autoExtend = true,
  continuationRange = null,
  step = 2.5,
  elevationScaleM = 12,
  absoluteRouteElevation = false,
  elevationSmoothingRadiusM = 0,
  maxUphillGrade = 0.216,
  maxDownhillGrade = 0.216,
  maxGradeChangePerMeter = 0.018,
  cutAllowance = 0.18,
  fillAllowance = 0.18,
  adapter = {}
} = {}) {
  const effectiveStep = clamp(Number(step) || 2.5, 1.25, 16);
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
    // Surveyed road and terrain heights share a datum; authored legacy roads
    // instead use node heights as offsets above terrain.
    const target = absoluteRouteElevation ? routeElevation : terrainElevation + routeElevation;
    const targetElevation = adapter.clampElevation?.(target) ?? target;
    const supportElevation = targetElevation;
    return {
      ...pose,
      distance,
      routeElevation,
      terrainElevation,
      leftTerrainElevation,
      rightTerrainElevation,
      targetElevation,
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
  // Smooth in metres, not node count: imported OSM points are irregularly spaced.
  // Linear extension preserves uphill grades at start/finish; circuits wrap.
  const radius = clamp(Number(elevationSmoothingRadiusM) || 0, 0, 60);
  if (radius > 0) {
    const original = profileSamples;
    const at = (distance) => {
      if (runtimeType === 'circuit') distance = (distance % effectiveRouteLength + effectiveRouteLength) % effectiveRouteLength;
      const i = clamp(Math.floor(distance / effectiveStep), 0, original.length - 2);
      const a=original[i], b=original[i+1];
      const t=(distance-a.distance)/Math.max(.001,b.distance-a.distance);
      return a.elevation+(b.elevation-a.elevation)*t;
    };
    const count=Math.max(2,Math.ceil(radius/effectiveStep));
    const filtered=original.map(sample=>{
      let sum=0,weight=0;
      for(let i=-count;i<=count;i++){
        const w=1-Math.abs(i)/(count+1);
        sum+=at(sample.distance+i*radius/count)*w;weight+=w;
      }
      return sum/weight;
    });
    // Keep authored start and finish heights exactly, without a discontinuity.
    const startCorrection=original[0].elevation-filtered[0];
    const endCorrection=original.at(-1).elevation-filtered.at(-1);
    profileSamples=original.map((sample,i)=>{
      const t=sample.distance/effectiveRouteLength;
      const elevation=filtered[i]+startCorrection*(1-t)+endCorrection*t;
      return {...sample,elevation,targetElevation:elevation,supportElevation:elevation};
    });
  }
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
        let source = profileSamples[index + offset];
        if (!source && radius > 0) {
          const atStart=index+offset<0;
          const a=atStart?profileSamples[0]:profileSamples.at(-2);
          const b=atStart?profileSamples[1]:profileSamples.at(-1);
          const distance=sample.distance+offset*effectiveStep;
          source={elevation:a.elevation+(b.elevation-a.elevation)*(distance-a.distance)/Math.max(.001,b.distance-a.distance)};
        }
        if (!source) return;
        weighted += Number(source.elevation || 0) * weight;
        total += weight;
      });
      return {
        ...sample,
        elevation: adapter.clampElevation?.(total > 0 ? weighted / total : Number(sample.elevation || 0)) ?? Number(sample.elevation || 0)
      };
    });
  }
  const maxUp = Math.max(0.001, Number(maxUphillGrade) || 0.216);
  const maxDown = Math.max(0.001, Number(maxDownhillGrade) || 0.216);
  const maxCurve = Math.max(0.0001, Number(maxGradeChangePerMeter) || 0.018);
  const maxRisePerM = maxUp / Math.max(0.001, elevationScaleM);
  const maxDropPerM = maxDown / Math.max(0.001, elevationScaleM);
  const enforceGradeLimits = () => {
    for (let index = 1; index < profileSamples.length; index += 1) {
      const previous = profileSamples[index - 1];
      const sample = profileSamples[index];
      const dx = Math.max(0.001, Number(sample.distance || 0) - Number(previous.distance || 0));
      sample.elevation = adapter.clampElevation?.(clamp(
        Number(sample.elevation || 0),
        Number(previous.elevation || 0) - maxDropPerM * dx,
        Number(previous.elevation || 0) + maxRisePerM * dx
      )) ?? sample.elevation;
    }
    for (let index = profileSamples.length - 2; index >= 0; index -= 1) {
      const next = profileSamples[index + 1];
      const sample = profileSamples[index];
      const dx = Math.max(0.001, Number(next.distance || 0) - Number(sample.distance || 0));
      sample.elevation = adapter.clampElevation?.(clamp(
        Number(sample.elevation || 0),
        Number(next.elevation || 0) - maxRisePerM * dx,
        Number(next.elevation || 0) + maxDropPerM * dx
      )) ?? sample.elevation;
    }
  };
  enforceGradeLimits();
  const maxCut = Math.max(0, Number(cutAllowance) || 0);
  const maxFill = Math.max(0, Number(fillAllowance) || 0);
  profileSamples = profileSamples.map((sample) => {
    const target = Number(sample.targetElevation ?? sample.supportElevation ?? sample.elevation ?? 0);
    const minElevation = target - maxCut;
    const maxElevation = target + maxFill;
    return {
      ...sample,
      elevation: adapter.clampElevation?.(clamp(Number(sample.elevation || 0), minElevation, maxElevation)) ?? Number(sample.elevation || 0)
    };
  });
  const getElevationEnvelope = (sample) => {
    const target = Number(sample.targetElevation ?? sample.supportElevation ?? sample.elevation ?? 0);
    return {
      min: target - maxCut,
      max: target + maxFill
    };
  };
  for (let pass = 0; pass < 4; pass += 1) {
    const snapshot = profileSamples.map((sample) => ({ ...sample }));
    profileSamples = profileSamples.map((sample, index) => {
      if (index === 0 || index === snapshot.length - 1) return sample;
      const previous = snapshot[index - 1];
      const current = snapshot[index];
      const next = snapshot[index + 1];
      const dxA = Math.max(0.001, Number(current.distance || 0) - Number(previous.distance || 0));
      const dxB = Math.max(0.001, Number(next.distance || 0) - Number(current.distance || 0));
      const averageDx = (dxA + dxB) * 0.5;
      const gradeA = (Number(current.elevation || 0) - Number(previous.elevation || 0)) * elevationScaleM / dxA;
      const gradeB = (Number(next.elevation || 0) - Number(current.elevation || 0)) * elevationScaleM / dxB;
      const allowedGradeDelta = maxCurve * averageDx;
      const gradeDelta = gradeB - gradeA;
      if (Math.abs(gradeDelta) <= allowedGradeDelta) return sample;
      const boundedGradeDelta = Math.sign(gradeDelta) * allowedGradeDelta;
      const denominator = (1 / dxA) + (1 / dxB);
      const desiredElevation = (
        Number(next.elevation || 0) / dxB
        + Number(previous.elevation || 0) / dxA
        - boundedGradeDelta / Math.max(0.001, elevationScaleM)
      ) / denominator;
      const envelope = getElevationEnvelope(current);
      const localMin = Math.min(
        Number(previous.elevation || 0),
        Number(current.elevation || 0),
        Number(next.elevation || 0)
      );
      const localMax = Math.max(
        Number(previous.elevation || 0),
        Number(current.elevation || 0),
        Number(next.elevation || 0)
      );
      const elevation = clamp(desiredElevation, Math.max(envelope.min, localMin), Math.min(envelope.max, localMax));
      return {
        ...sample,
        elevation: adapter.clampElevation?.(elevation) ?? elevation
      };
    });
    enforceGradeLimits();
  }
  if (runtimeType === 'circuit' && profileSamples.length > 2) {
    const first = profileSamples[0];
    const last = profileSamples[profileSamples.length - 1];
    const seamElevation = adapter.clampElevation?.(
      (Number(first.elevation || 0) + Number(last.elevation || 0)) * 0.5
    ) ?? 0;
    first.elevation = seamElevation;
    last.elevation = seamElevation;
    enforceGradeLimits();
  }
  profileSamples = profileSamples.map((sample, index) => {
    const previous = profileSamples[Math.max(0, index - 2)];
    const next = profileSamples[Math.min(profileSamples.length - 1, index + 2)];
    const span = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
    const grade = clamp(
      ((Number(next.elevation || 0) - Number(previous.elevation || 0)) * elevationScaleM) / span,
      -maxDown,
      maxUp
    );
    return { ...sample, grade };
  });
  if (runtimeType !== 'circuit' && allowVisualExtension && !autoExtend) {
    // Keep the timed course solution intact. Blend each authored approach into
    // its endpoint height and grade, fading the correction within 80 metres.
    const extend = (start) => {
      const edge = start ? profileSamples[0] : profileSamples.at(-1);
      const bound = start ? continuationRange?.minVisualDistance : continuationRange?.maxVisualDistance;
      const length = Math.max(0, start ? -Number(bound || 0) : Number(bound || effectiveRouteLength)-effectiveRouteLength);
      const sign = start ? -1 : 1, result = [];
      const anchor = sampleSupportAt(start ? 0 : effectiveRouteLength);
      const near = sampleSupportAt((start ? 0 : effectiveRouteLength)+sign*Math.min(2.5,length));
      const authoredGrade = (near.targetElevation-anchor.targetElevation)*elevationScaleM/(sign*Math.max(.001,Math.min(2.5,length)));
      for(let offset=effectiveStep; offset<length+effectiveStep; offset+=effectiveStep) {
        const d=Math.min(offset,length), sample=sampleSupportAt((start?0:effectiveRouteLength)+sign*d);
        const t=Math.min(1,d/80), h00=2*t*t*t-3*t*t+1, h10=t*t*t-2*t*t+t;
        const elevation=sample.targetElevation+(edge.elevation-anchor.targetElevation)*h00
          + sign*(edge.grade-authoredGrade)/elevationScaleM*80*h10;
        result.push({...sample,elevation,supportElevation:elevation});
        if(d===length)break;
      }
      return start?result.reverse():result;
    };
    const before=extend(true), after=extend(false);
    profileSamples=[...before,...profileSamples,...after];
    profileSamples=profileSamples.map((sample,i)=>{
      if(sample.distance>=0 && sample.distance<=effectiveRouteLength)return sample;
      const a=profileSamples[Math.max(0,i-1)], b=profileSamples[Math.min(profileSamples.length-1,i+1)];
      return {...sample,grade:(b.elevation-a.elevation)*elevationScaleM/Math.max(.001,b.distance-a.distance)};
    });
  }
  return {
    samples: profileSamples,
    routeLength: effectiveRouteLength,
    step: effectiveStep,
    runtimeType,
    allowVisualExtension,
    autoExtend
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
  if (profile.runtimeType !== 'circuit' && profile.allowVisualExtension && profile.autoExtend !== false && requestedDistance < 0 && profileSamples.length >= 2) {
    const first = profileSamples[0];
    const next = profileSamples.find((sample) => Number(sample.distance || 0) > 0.001) || profileSamples[1];
    const span = Math.max(0.001, Number(next.distance || 0) - Number(first.distance || 0));
    const t = requestedDistance / span;
    const lerp = (a, b) => Number(a || 0) + (Number(b || 0) - Number(a || 0)) * t;
    return {
      ...first,
      distance: requestedDistance,
      x: lerp(first.x, next.x),
      z: lerp(first.z, next.z),
      yaw: Number(first.yaw || 0),
      elevation: clampElevation(lerp(first.elevation, next.elevation)),
      routeElevation: clampElevation(lerp(first.routeElevation, next.routeElevation)),
      terrainElevation: clampElevation(lerp(first.terrainElevation, next.terrainElevation)),
      leftTerrainElevation: clampElevation(lerp(first.leftTerrainElevation, next.leftTerrainElevation)),
      rightTerrainElevation: clampElevation(lerp(first.rightTerrainElevation, next.rightTerrainElevation)),
      supportElevation: clampElevation(lerp(first.supportElevation, next.supportElevation)),
      roadHalfWidth: Number(first.roadHalfWidth || 0),
      marginWidth: Number(first.marginWidth || 0),
      shoulderWidth: Number(first.shoulderWidth || 0),
      stampedHalfWidth: Number(first.stampedHalfWidth || 0),
      blendWidth: Number(first.blendWidth || 0),
      grade: Number(first.grade || 0),
      segment: first.segment || next.segment || null,
      index: first.index ?? 0,
      progress: 0
    };
  }
  if (profile.runtimeType !== 'circuit' && profile.allowVisualExtension && profile.autoExtend !== false && requestedDistance > routeLength && profileSamples.length >= 2) {
    const last = profileSamples[profileSamples.length - 1];
    const previous = [...profileSamples].reverse().find((sample) => Number(sample.distance || 0) < routeLength - 0.001) || profileSamples[profileSamples.length - 2];
    const span = Math.max(0.001, Number(last.distance || 0) - Number(previous.distance || 0));
    const t = (requestedDistance - Number(previous.distance || 0)) / span;
    const lerp = (a, b) => Number(a || 0) + (Number(b || 0) - Number(a || 0)) * t;
    return {
      ...last,
      distance: requestedDistance,
      x: lerp(previous.x, last.x),
      z: lerp(previous.z, last.z),
      yaw: Number(last.yaw || 0),
      elevation: clampElevation(lerp(previous.elevation, last.elevation)),
      routeElevation: clampElevation(lerp(previous.routeElevation, last.routeElevation)),
      terrainElevation: clampElevation(lerp(previous.terrainElevation, last.terrainElevation)),
      leftTerrainElevation: clampElevation(lerp(previous.leftTerrainElevation, last.leftTerrainElevation)),
      rightTerrainElevation: clampElevation(lerp(previous.rightTerrainElevation, last.rightTerrainElevation)),
      supportElevation: clampElevation(lerp(previous.supportElevation, last.supportElevation)),
      roadHalfWidth: Number(last.roadHalfWidth || 0),
      marginWidth: Number(last.marginWidth || 0),
      shoulderWidth: Number(last.shoulderWidth || 0),
      stampedHalfWidth: Number(last.stampedHalfWidth || 0),
      blendWidth: Number(last.blendWidth || 0),
      grade: Number(last.grade || 0),
      segment: last.segment || previous.segment || null,
      index: last.index ?? previous.index ?? 0,
      progress: 1
    };
  }
  const target = profile.runtimeType === 'circuit'
    ? (requestedDistance % routeLength + routeLength) % routeLength
    : clamp(requestedDistance, profile.allowVisualExtension ? profileSamples[0].distance : 0, profile.allowVisualExtension ? profileSamples.at(-1).distance : routeLength);
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
