import {
  compareTrackStateCellKeys,
  hashTrackStateValue,
  stableTrackStateStringify
} from './TrackStateMath.js';
import { compareTrackStateEvents, normalizeTrackStateEvent } from './TrackStateEvents.js';
import { clampTrackStateCell } from './TrackStateCell.js';

export const TRACK_STATE_SNAPSHOT_VERSION = 1;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function getTrackStateCanonicalPayload(state) {
  return {
    version: TRACK_STATE_SNAPSHOT_VERSION,
    seed: Number(state.seed) >>> 0,
    cellSizeM: Number(state.cellSizeM || 1),
    fixedStepMs: Number(state.fixedStepMs || 100),
    maxCatchUpSteps: Math.max(1, Math.trunc(Number(state.maxCatchUpSteps) || 5)),
    maxCellsPerStep: Math.max(64, Math.trunc(Number(state.maxCellsPerStep) || 512)),
    profileOverrides: cloneJson(state.profileOverrides || null),
    cellCursor: Math.max(0, Math.trunc(Number(state.cellCursor) || 0)),
    stepIndex: Math.max(0, Math.trunc(Number(state.stepIndex) || 0)),
    nextSequence: Math.max(1, Math.trunc(Number(state.nextSequence) || 1)),
    cells: [...state.cells.entries()]
      .sort(([left], [right]) => compareTrackStateCellKeys(left, right))
      .map(([, cell]) => cloneJson(cell)),
    events: [...state.pendingEvents].sort(compareTrackStateEvents).map(cloneJson),
    eventHistory: [...state.eventHistory].sort(compareTrackStateEvents).map(cloneJson),
    carryByTire: [...state.carryByTire.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, carry]) => [key, cloneJson(carry)]),
    weatherTimeline: [...state.weatherTimeline.entries()]
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([step, forcing]) => [Number(step), cloneJson(forcing)]),
    totals: cloneJson(state.totals)
  };
}

export function getTrackStateChecksum(state) {
  return hashTrackStateValue(stableTrackStateStringify(getTrackStateCanonicalPayload(state)));
}

export function createTrackStateSnapshot(state) {
  const payload = getTrackStateCanonicalPayload(state);
  return {
    ...payload,
    checksum: hashTrackStateValue(stableTrackStateStringify(payload))
  };
}

export function restoreTrackStateSnapshot(state, snapshot = {}) {
  if (!snapshot || Number(snapshot.version) !== TRACK_STATE_SNAPSHOT_VERSION) {
    throw new Error(`Unsupported Track State snapshot version: ${snapshot?.version}`);
  }
  const expected = String(snapshot.checksum || '');
  const payload = { ...cloneJson(snapshot) };
  delete payload.checksum;
  const actual = hashTrackStateValue(stableTrackStateStringify(payload));
  if (expected && expected !== actual) throw new Error('Track State snapshot checksum mismatch');
  const cells = new Map();
  (snapshot.cells || []).forEach((raw) => {
    if (!Number.isFinite(Number(raw?.x)) || !Number.isFinite(Number(raw?.z))) {
      throw new Error('Invalid Track State cell coordinates');
    }
    const cell = clampTrackStateCell(cloneJson(raw));
    cells.set(String(cell.key || `${Math.trunc(cell.x)},${Math.trunc(cell.z)}`), cell);
  });
  state.seed = Number(snapshot.seed) >>> 0;
  state.cellSizeM = Number(snapshot.cellSizeM || 1);
  state.fixedStepMs = Number(snapshot.fixedStepMs || 100);
  state.maxCatchUpSteps = Math.max(1, Math.trunc(Number(snapshot.maxCatchUpSteps) || state.maxCatchUpSteps || 5));
  state.maxCellsPerStep = Math.max(64, Math.trunc(Number(snapshot.maxCellsPerStep) || state.maxCellsPerStep || 512));
  state.profileOverrides = cloneJson(snapshot.profileOverrides || null);
  state.stepIndex = Math.max(0, Math.trunc(Number(snapshot.stepIndex) || 0));
  state.nextSequence = Math.max(1, Math.trunc(Number(snapshot.nextSequence) || 1));
  state.accumulatorMs = 0;
  state.cells = cells;
  state.baseSurfaceCache = new Map();
  state.orderedCellKeys = [...cells.keys()].sort(compareTrackStateCellKeys);
  state.cellCursor = state.orderedCellKeys.length
    ? Math.max(0, Math.trunc(Number(snapshot.cellCursor) || 0)) % state.orderedCellKeys.length
    : 0;
  state.pendingEvents = (snapshot.events || []).map((event) => normalizeTrackStateEvent(event)).sort(compareTrackStateEvents);
  state.pendingEventsDirty = false;
  state.eventHistory = (snapshot.eventHistory || []).map((event) => normalizeTrackStateEvent(event)).sort(compareTrackStateEvents);
  state.eventIds = new Set([...state.pendingEvents, ...state.eventHistory].map((event) => event.id));
  state.carryByTire = new Map((snapshot.carryByTire || []).map(([key, value]) => [String(key), cloneJson(value)]));
  state.weatherTimeline = new Map((snapshot.weatherTimeline || []).map(([step, forcing]) => [Number(step), cloneJson(forcing)]));
  state.totals = {
    precipitationMm: 0,
    drainageMm: 0,
    evaporationMm: 0,
    ...(cloneJson(snapshot.totals) || {})
  };
  return state;
}
