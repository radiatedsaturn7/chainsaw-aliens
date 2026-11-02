import { getTrackStateCellKey, quantizeTrackStateNumber } from './TrackStateMath.js';

const EVENT_TYPE_ORDER = Object.freeze({
  'tire-contact': 1,
  'crash-debris': 2,
  'oil-spill': 3
});

function canonicalPayload(value) {
  if (typeof value === 'number') return quantizeTrackStateNumber(value);
  if (Array.isArray(value)) return value.map(canonicalPayload);
  if (value && typeof value === 'object') {
    const result = {};
    const keys = Object.keys(value).sort();
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const normalized = canonicalPayload(value[key]);
      // Match Object.fromEntries for an own __proto__ key without invoking
      // Object.prototype's legacy setter. Other keys can be assigned directly.
      if (key === '__proto__') Object.defineProperty(result, key, {
        value: normalized, enumerable: true, writable: true, configurable: true
      });
      else result[key] = normalized;
    }
    return result;
  }
  return value;
}

export function normalizeTrackStateEvent(event = {}, fallbackSequence = 0) {
  const stepIndex = Math.max(1, Math.trunc(Number(event.stepIndex) || 1));
  const sequence = Math.max(1, Math.trunc(Number(event.sequence) || Number(fallbackSequence) || 1));
  const x = quantizeTrackStateNumber(Number(event.x || 0));
  const z = quantizeTrackStateNumber(Number(event.z ?? event.y ?? 0));
  const type = String(event.type || 'tire-contact');
  const vehicleId = String(event.vehicleId || 'vehicle');
  const wheelId = String(event.wheelId || '');
  const cellKey = String(event.cellKey || getTrackStateCellKey(Math.floor(x), Math.floor(z)));
  const deterministicId = type === 'tire-contact'
    ? `${stepIndex}:${EVENT_TYPE_ORDER[type]}:${vehicleId}:${wheelId}:${cellKey}`
    : `${stepIndex}:${EVENT_TYPE_ORDER[type] || 99}:${vehicleId}:${wheelId}:${sequence}:${cellKey}`;
  return {
    type,
    stepIndex,
    sequence,
    vehicleId,
    wheelId,
    x,
    z,
    cellKey,
    payload: canonicalPayload(event.payload || {}),
    id: String(event.id || deterministicId)
  };
}

export function compareTrackStateEvents(left = {}, right = {}) {
  return Number(left.stepIndex || 0) - Number(right.stepIndex || 0)
    || Number(EVENT_TYPE_ORDER[left.type] || 99) - Number(EVENT_TYPE_ORDER[right.type] || 99)
    || String(left.vehicleId || '').localeCompare(String(right.vehicleId || ''))
    || String(left.wheelId || '').localeCompare(String(right.wheelId || ''))
    || Number(left.sequence || 0) - Number(right.sequence || 0)
    || String(left.cellKey || '').localeCompare(String(right.cellKey || ''));
}

// Internal accumulator path: construct the canonical flat payload directly,
// avoiding a second payload object, key sorting and recursive traversal.
// Keep BOTH numeric quantizations for exact legacy replay semantics, including
// extreme values where floating-point quantization need not be idempotent.
const q = value => quantizeTrackStateNumber(quantizeTrackStateNumber(value));

export function normalizeAccumulatedTireContactEvent(aggregate, sequence, stepIndex) {
  const EPSILON = 1e-9;
  const groundedFraction = aggregate.contactDurationSeconds > EPSILON
    ? aggregate.groundedDurationSeconds / aggregate.contactDurationSeconds
    : 0;
  const normalLoadN = aggregate.groundedDurationSeconds > EPSILON
    ? aggregate.loadDuration / aggregate.groundedDurationSeconds
    : 0;
  const slipEnergy = aggregate.distanceM > EPSILON && normalLoadN > EPSILON
    ? aggregate.slipWork / (normalLoadN * aggregate.distanceM)
    : aggregate.groundedDurationSeconds > EPSILON
      ? aggregate.slipDurationWeighted / aggregate.groundedDurationSeconds
      : 0;
  const directionLength = Math.hypot(
    aggregate.directionXWeighted,
    aggregate.directionZWeighted
  ) || 1;
  // This internal path always produces a tire contact. Construct its header
  // directly, avoiding a temporary event and discarded empty payload objects.
  stepIndex = Math.max(1, Math.trunc(Number(stepIndex) || 1));
  sequence = Math.max(1, Math.trunc(Number(sequence) || 1));
  const x = quantizeTrackStateNumber(Number(aggregate.x || 0));
  const z = quantizeTrackStateNumber(Number(aggregate.z || 0));
  const vehicleId = String(aggregate.vehicleId || 'vehicle');
  const wheelId = String(aggregate.wheelId || '');
  const cellKey = String(aggregate.cellKey || getTrackStateCellKey(Math.floor(x), Math.floor(z)));
  const event = {type:'tire-contact',stepIndex,sequence,vehicleId,wheelId,x,z,cellKey,
    payload:null,id:`${stepIndex}:1:${vehicleId}:${wheelId}:${cellKey}`};
  event.payload = {
    brakeLock: q(aggregate.maxBrakeLock),
    carriedMaterialDepositCapacity: q(
      aggregate.carriedMaterialDepositCapacity
    ),
    compoundId: canonicalPayload(aggregate.compoundId),
    contactDurationSeconds: q(aggregate.contactDurationSeconds),
    contactScale: q(groundedFraction),
    directionX: q(aggregate.directionXWeighted / directionLength),
    directionZ: q(aggregate.directionZWeighted / directionLength),
    distanceM: q(aggregate.distanceM),
    grounded: groundedFraction > 0,
    groundedContactDurationSeconds: q(
      aggregate.groundedContactDurationSeconds
    ),
    groundedFraction: q(groundedFraction),
    lateralScrubWorkJ: q(aggregate.lateralScrubWorkJ),
    lockedWheelWorkJ: q(aggregate.lockedWheelWorkJ),
    longitudinalSlipWorkJ: q(aggregate.longitudinalSlipWorkJ),
    looseMaterialSweepWorkJ: q(aggregate.looseMaterialSweepWorkJ),
    materialPickupCapacity: q(aggregate.materialPickupCapacity),
    normalImpulseNs: q(aggregate.normalImpulseNs),
    normalLoadN: q(normalLoadN),
    rollingDistanceM: q(aggregate.rollingDistanceM),
    rubberDepositionWorkJ: q(aggregate.rubberDepositionWorkJ),
    slipEnergy: q(slipEnergy),
    slipWork: q(aggregate.slipWork),
    speedMps: q(aggregate.speedWeight > EPSILON
      ? aggregate.speedWeighted / aggregate.speedWeight
      : 0),
    surfaceHeatingWorkJ: q(aggregate.surfaceHeatingWorkJ),
    tireTemperatureF: q(aggregate.temperatureWeight > EPSILON
      ? aggregate.temperatureWeighted / aggregate.temperatureWeight
      : 70),
    waterDisplacementImpulseNs: q(
      aggregate.waterDisplacementImpulseNs
    ),
    wheelSpin: q(aggregate.maxWheelSpin),
    wheelspinWorkJ: q(aggregate.wheelspinWorkJ),
  };
  return event;
}
