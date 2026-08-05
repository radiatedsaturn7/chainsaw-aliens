const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

export const VEHICLE_BODY_SHAPE_PRESETS = Object.freeze(['car', 'suv', 'pickup', 'custom']);

const PRESETS = Object.freeze({
  car: Object.freeze({
    overallLengthM: 4.55, overallWidthM: 1.8, overallHeightM: 1.46,
    groundClearanceM: 0.14, frontOverhangM: 0.92, rearOverhangM: 0.93,
    lowerBodyHeightM: 0.48,
    hood: { lengthM: 1.2, widthM: 1.68, heightM: 0.42 },
    cabin: { centerZM: -0.12, lengthM: 2.15, widthM: 1.62, heightM: 0.83 },
    bed: { centerZM: -1.35, lengthM: 0, widthM: 0, heightM: 0 },
    cgPositionM: { x: 0, y: 0.55, z: 0 }, collisionFriction: 0.62, collisionRestitution: 0.08
  }),
  suv: Object.freeze({
    overallLengthM: 4.75, overallWidthM: 1.94, overallHeightM: 1.72,
    groundClearanceM: 0.2, frontOverhangM: 0.94, rearOverhangM: 0.98,
    lowerBodyHeightM: 0.56,
    hood: { lengthM: 1.02, widthM: 1.82, heightM: 0.5 },
    cabin: { centerZM: -0.18, lengthM: 3.25, widthM: 1.78, heightM: 1.05 },
    bed: { centerZM: -1.4, lengthM: 0, widthM: 0, heightM: 0 },
    cgPositionM: { x: 0, y: 0.68, z: -0.05 }, collisionFriction: 0.66, collisionRestitution: 0.07
  }),
  pickup: Object.freeze({
    overallLengthM: 5.45, overallWidthM: 2.02, overallHeightM: 1.82,
    groundClearanceM: 0.23, frontOverhangM: 0.94, rearOverhangM: 1.18,
    lowerBodyHeightM: 0.58,
    hood: { lengthM: 1.24, widthM: 1.9, heightM: 0.54 },
    cabin: { centerZM: 0.45, lengthM: 1.8, widthM: 1.84, heightM: 1.05 },
    bed: { centerZM: -1.45, lengthM: 1.85, widthM: 1.88, heightM: 0.58 },
    cgPositionM: { x: 0, y: 0.72, z: -0.12 }, collisionFriction: 0.68, collisionRestitution: 0.06
  })
});

export function getVehicleBodyPreset(preset = 'car') {
  const id = VEHICLE_BODY_SHAPE_PRESETS.includes(String(preset)) ? String(preset) : 'car';
  return clone(PRESETS[id === 'custom' ? 'car' : id]);
}

function normalizePiece(piece = {}, index = 0) {
  const size = piece.sizeM || piece.size || {};
  const center = piece.centerM || piece.center || {};
  return Object.freeze({
    id: String(piece.id || `custom-${index + 1}`),
    type: piece.type === 'convex' ? 'convex' : 'box',
    centerM: Object.freeze({ x: finite(center.x, 0), y: finite(center.y, 0), z: finite(center.z, 0) }),
    sizeM: Object.freeze({
      x: clamp(finite(size.x, 0.5), 0.05, 8),
      y: clamp(finite(size.y, 0.5), 0.05, 4),
      z: clamp(finite(size.z, 0.5), 0.05, 12)
    }),
    vertices: Object.freeze((Array.isArray(piece.vertices) ? piece.vertices : []).map((vertex) => Object.freeze({
      x: finite(vertex.x, 0), y: finite(vertex.y, 0), z: finite(vertex.z, 0)
    })))
  });
}

export function createVehicleBodyCompoundPieces(profile = {}) {
  if (profile.preset === 'custom' && profile.customColliders?.length) {
    return Object.freeze(profile.customColliders.map(normalizePiece));
  }
  const length = profile.overallLengthM;
  const width = profile.overallWidthM;
  const clearance = profile.groundClearanceM;
  const lowerHeight = profile.lowerBodyHeightM;
  const bottom = clearance - profile.cgPositionM.y;
  const box = (id, center, size) => Object.freeze({
    id, type: 'box', centerM: Object.freeze(center), sizeM: Object.freeze(size), vertices: Object.freeze([])
  });
  const lower = box(profile.preset === 'pickup' ? 'lower-frame-body' : 'lower-chassis',
    { x: 0, y: bottom + lowerHeight * 0.5, z: 0 },
    { x: width, y: lowerHeight, z: length });
  const hoodZ = length * 0.5 - profile.frontOverhangM - profile.hood.lengthM * 0.5;
  const hood = box('front-body-hood',
    { x: 0, y: bottom + lowerHeight + profile.hood.heightM * 0.5, z: hoodZ },
    { x: profile.hood.widthM, y: profile.hood.heightM, z: profile.hood.lengthM });
  const cabin = box(profile.preset === 'pickup' ? 'front-cab' : 'cabin',
    { x: 0, y: bottom + lowerHeight + profile.cabin.heightM * 0.5, z: profile.cabin.centerZM },
    { x: profile.cabin.widthM, y: profile.cabin.heightM, z: profile.cabin.lengthM });
  if (profile.preset === 'suv') return Object.freeze([lower, cabin]);
  if (profile.preset === 'pickup') {
    return Object.freeze([lower, hood, cabin, box('bed',
      { x: 0, y: bottom + lowerHeight + profile.bed.heightM * 0.5, z: profile.bed.centerZM },
      { x: profile.bed.widthM, y: profile.bed.heightM, z: profile.bed.lengthM })]);
  }
  const rearLength = Math.max(0.35, length - profile.frontOverhangM - profile.rearOverhangM
    - profile.hood.lengthM - profile.cabin.lengthM * 0.62);
  return Object.freeze([lower, hood, cabin, box('rear-body-trunk',
    { x: 0, y: bottom + lowerHeight + profile.hood.heightM * 0.42, z: -length * 0.5 + profile.rearOverhangM + rearLength * 0.5 },
    { x: width * 0.94, y: profile.hood.heightM * 0.84, z: rearLength })]);
}

export function normalizeVehicleBodyProfile(source = {}, fallback = {}) {
  const requested = String(source.preset || source.bodyShapePreset || fallback.preset || 'car').toLowerCase();
  const preset = VEHICLE_BODY_SHAPE_PRESETS.includes(requested) ? requested : 'car';
  const defaults = getVehicleBodyPreset(preset);
  const overallLengthM = clamp(finite(source.overallLengthM ?? source.lengthM, finite(fallback.lengthM, defaults.overallLengthM)), 1.6, 12);
  const overallWidthM = clamp(finite(source.overallWidthM ?? source.widthM, finite(fallback.widthM, defaults.overallWidthM)), 0.9, 4);
  const overallHeightM = clamp(finite(source.overallHeightM ?? source.heightM, finite(fallback.heightM, defaults.overallHeightM)), 0.7, 4);
  const groundClearanceM = clamp(finite(source.groundClearanceM, finite(fallback.groundClearanceM, defaults.groundClearanceM)), 0.04, 1);
  const cgSource = { ...defaults.cgPositionM, ...(fallback.cgPositionM || {}), ...(source.cgPositionM || source.cgLocationBodyM || {}) };
  const hoodSource = { ...defaults.hood, ...(source.hood || {}) };
  const cabinSource = { ...defaults.cabin, ...(source.cabin || {}) };
  const bedSource = { ...defaults.bed, ...(source.bed || {}) };
  const profile = {
    preset, overallLengthM, overallWidthM, overallHeightM, groundClearanceM,
    frontOverhangM: clamp(finite(source.frontOverhangM, defaults.frontOverhangM), 0.15, overallLengthM * 0.45),
    rearOverhangM: clamp(finite(source.rearOverhangM, defaults.rearOverhangM), 0.15, overallLengthM * 0.45),
    lowerBodyHeightM: clamp(finite(source.lowerBodyHeightM, defaults.lowerBodyHeightM), 0.12, overallHeightM),
    hood: {
      lengthM: clamp(finite(hoodSource.lengthM, defaults.hood.lengthM), 0.1, overallLengthM),
      widthM: clamp(finite(hoodSource.widthM, defaults.hood.widthM), 0.1, overallWidthM),
      heightM: clamp(finite(hoodSource.heightM, defaults.hood.heightM), 0.05, overallHeightM)
    },
    cabin: {
      centerZM: clamp(finite(cabinSource.centerZM, defaults.cabin.centerZM), -overallLengthM * 0.5, overallLengthM * 0.5),
      lengthM: clamp(finite(cabinSource.lengthM, defaults.cabin.lengthM), 0.1, overallLengthM),
      widthM: clamp(finite(cabinSource.widthM, defaults.cabin.widthM), 0.1, overallWidthM),
      heightM: clamp(finite(cabinSource.heightM, defaults.cabin.heightM), 0.05, overallHeightM)
    },
    bed: {
      centerZM: clamp(finite(bedSource.centerZM, defaults.bed.centerZM), -overallLengthM * 0.5, overallLengthM * 0.5),
      lengthM: clamp(finite(bedSource.lengthM, defaults.bed.lengthM), 0, overallLengthM),
      widthM: clamp(finite(bedSource.widthM, defaults.bed.widthM), 0, overallWidthM),
      heightM: clamp(finite(bedSource.heightM, defaults.bed.heightM), 0, overallHeightM)
    },
    cgPositionM: {
      x: finite(cgSource.x, defaults.cgPositionM.x),
      y: finite(cgSource.y, defaults.cgPositionM.y),
      z: finite(cgSource.z, defaults.cgPositionM.z)
    },
    collisionFriction: clamp(finite(source.collisionFriction, finite(fallback.collisionFriction, defaults.collisionFriction)), 0, 1.5),
    collisionRestitution: clamp(finite(source.collisionRestitution, finite(fallback.collisionRestitution, defaults.collisionRestitution)), 0, 0.6),
    customColliders: (Array.isArray(source.customColliders) ? source.customColliders : []).map(normalizePiece)
  };
  profile.pieces = createVehicleBodyCompoundPieces(profile);
  return Object.freeze(profile);
}

export function resolveVehicleBodyProfile(tuning = {}) {
  const classPreset = {
    suv: 'suv', crossover: 'suv', offroad: 'suv',
    pickup: 'pickup', truck: 'pickup', ute: 'pickup'
  }[String(tuning.vehicleClass || tuning.class || '').toLowerCase()] || 'car';
  return normalizeVehicleBodyProfile(tuning.physics?.bodyProfile || tuning.bodyProfile || {
    bodyShapePreset: tuning.physics?.bodyShapePreset || tuning.bodyShapePreset || classPreset
  }, {
    lengthM: tuning.lengthM, widthM: tuning.widthM, heightM: tuning.heightM,
    groundClearanceM: tuning.groundClearanceM,
    cgPositionM: tuning.physicalVehicleProfile?.cgLocationBodyM || { y: tuning.cgHeightM },
    collisionFriction: tuning.bodyCollisionFriction,
    collisionRestitution: tuning.bodyCollisionRestitution
  });
}
