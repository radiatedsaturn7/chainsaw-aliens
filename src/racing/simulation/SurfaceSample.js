const EPSILON = 1e-9;

const finite = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const finitePoint = (point = {}) => {
  const x = finite(point.x);
  const y = finite(point.y);
  const z = finite(point.z ?? point.y);
  if (x === null || z === null) return null;
  return { x, y, z };
};

const finiteNormal = (normal = {}) => {
  const x = finite(normal.x);
  const y = finite(normal.y);
  const z = finite(normal.z);
  if (x === null || y === null || z === null) return null;
  const length = Math.hypot(x, y, z);
  if (!(length > EPSILON)) return null;
  if (Math.abs(length - 1) < 1e-9) return { x, y, z };
  return { x: x / length, y: y / length, z: z / length };
};

const triangleIdentity = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && String(value).trim() !== '' ? numeric : String(value);
};

export function createInvalidSurfaceSample({
  queryPosition = null,
  region = null,
  source = null,
  triangleId = null,
  reason = 'invalid-surface-sample'
} = {}) {
  return Object.freeze({
    valid: false,
    heightM: null,
    normal: null,
    region: region === null || region === undefined ? null : String(region),
    source: source === null || source === undefined ? null : String(source),
    triangleId: triangleIdentity(triangleId),
    queryPosition: finitePoint(queryPosition || {}),
    reason: String(reason || 'invalid-surface-sample')
  });
}

/**
 * Normalizes every terrain query at the simulation boundary. A missing or
 * non-finite height is deliberately retained as an invalid sample; it is
 * never converted to world height zero.
 */
export function createSurfaceSample(sample = {}, {
  queryPosition = null,
  heightScale = 1,
  defaultNormal = null,
  source = null,
  region = null
} = {}) {
  if (!sample || sample.valid === false) {
    return createInvalidSurfaceSample({
      queryPosition: sample?.queryPosition || queryPosition,
      region: sample?.region ?? region,
      source: sample?.source ?? source,
      triangleId: sample?.triangleId ?? sample?.bakedTriangleId,
      reason: sample?.reason || 'invalid-surface-sample'
    });
  }
  const scale = finite(heightScale);
  const explicitHeightM = finite(sample.heightM);
  const elevation = finite(sample.elevation ?? sample.elevationM);
  const heightM = explicitHeightM ?? (
    elevation !== null && scale !== null ? elevation * scale : null
  );
  const normal = finiteNormal(sample.normal || sample.normalWorld || defaultNormal || {});
  const position = finitePoint(sample.queryPosition || queryPosition || {});
  if (heightM === null) {
    return createInvalidSurfaceSample({
      queryPosition: position,
      region: sample.region ?? region,
      source: sample.source ?? sample.bakedSurfaceSource ?? source,
      triangleId: sample.triangleId ?? sample.bakedTriangleId,
      reason: sample.reason || 'non-finite-height'
    });
  }
  if (!normal) {
    return createInvalidSurfaceSample({
      queryPosition: position,
      region: sample.region ?? region,
      source: sample.source ?? sample.bakedSurfaceSource ?? source,
      triangleId: sample.triangleId ?? sample.bakedTriangleId,
      reason: sample.reason || 'invalid-normal'
    });
  }
  return Object.freeze({
    valid: true,
    heightM,
    normal,
    region: sample.region === null || sample.region === undefined
      ? (region === null || region === undefined ? null : String(region))
      : String(sample.region),
    source: sample.source === null || sample.source === undefined
      ? (sample.bakedSurfaceSource === null || sample.bakedSurfaceSource === undefined
          ? (source === null || source === undefined ? null : String(source))
          : String(sample.bakedSurfaceSource))
      : String(sample.source),
    triangleId: triangleIdentity(sample.triangleId ?? sample.bakedTriangleId),
    queryPosition: position,
    reason: null
  });
}

export function isValidSurfaceSample(sample) {
  return sample?.valid === true
    && Number.isFinite(Number(sample.heightM))
    && finiteNormal(sample.normal || {}) !== null;
}

export default createSurfaceSample;
