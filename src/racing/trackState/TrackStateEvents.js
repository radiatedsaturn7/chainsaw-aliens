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
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalPayload(value[key])]));
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
    id: String(event.id || `${stepIndex}:${EVENT_TYPE_ORDER[type] || 99}:${vehicleId}:${wheelId}:${sequence}:${cellKey}`)
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
