import {
  compareTrackStateCellKeys,
  hashTrackStateValue,
  quantizeTrackStateNumber,
  stableTrackStateStringify
} from './TrackStateMath.js';
import { compareTrackStateEvents, normalizeTrackStateEvent } from './TrackStateEvents.js';
import { clampTrackStateCell } from './TrackStateCell.js';

export const TRACK_STATE_SNAPSHOT_VERSION = 1;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isJsonOmitted(value) {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

function* streamCanonicalJson(value, { arrayValue = false } = {}) {
  if (isJsonOmitted(value)) {
    if (arrayValue) yield 'null';
    return;
  }
  if (typeof value === 'number') {
    yield JSON.stringify(quantizeTrackStateNumber(value));
    return;
  }
  if (value === null || typeof value !== 'object') {
    yield JSON.stringify(value);
    return;
  }
  if (Array.isArray(value)) {
    yield '[';
    for (let index = 0; index < value.length; index += 1) {
      if (index) yield ',';
      yield* streamCanonicalJson(value[index], { arrayValue: true });
    }
    yield ']';
    return;
  }
  yield '{';
  const keys = Object.keys(value).filter((key) => !isJsonOmitted(value[key])).sort();
  for (let index = 0; index < keys.length; index += 1) {
    if (index) yield ',';
    const key = keys[index];
    yield JSON.stringify(key);
    yield ':';
    yield* streamCanonicalJson(value[key]);
  }
  yield '}';
}

export function createIncrementalTrackStateHash(value) {
  const iterator = streamCanonicalJson(value);
  let hash = 0x811c9dc5;
  let token = '';
  let tokenOffset = 0;
  let finished = false;
  let processedCharacters = 0;
  const task = {
    done: false,
    checksum: '',
    processedCharacters: 0,
    process(maxCharacters = 32768) {
      let remaining = Math.max(1, Math.trunc(Number(maxCharacters) || 32768));
      let processed = 0;
      while (remaining > 0 && !finished) {
        if (tokenOffset >= token.length) {
          const next = iterator.next();
          if (next.done) {
            finished = true;
            task.done = true;
            task.checksum = hash.toString(16).padStart(8, '0');
            break;
          }
          token = String(next.value || '');
          tokenOffset = 0;
          if (!token.length) continue;
        }
        const count = Math.min(remaining, token.length - tokenOffset);
        const end = tokenOffset + count;
        for (; tokenOffset < end; tokenOffset += 1) {
          const code = token.charCodeAt(tokenOffset);
          hash ^= code & 0xff;
          hash = Math.imul(hash, 0x01000193) >>> 0;
          if (code > 0xff) {
            hash ^= code >>> 8;
            hash = Math.imul(hash, 0x01000193) >>> 0;
          }
        }
        remaining -= count;
        processed += count;
      }
      processedCharacters += processed;
      task.processedCharacters = processedCharacters;
      return processed;
    }
  };
  return task;
}

export function getTrackStateCanonicalPayload(state, {
  includeEventHistory = true,
  includeWeatherTimeline = true,
  cellSnapshots = null
} = {}) {
  return {
    version: TRACK_STATE_SNAPSHOT_VERSION,
    seed: Number(state.seed) >>> 0,
    cellSizeM: Number(state.cellSizeM || 1),
    fixedStepMs: Number(state.fixedStepMs || 100),
    maxCatchUpSteps: Math.max(1, Math.trunc(Number(state.maxCatchUpSteps) || 5)),
    maxCellsPerStep: Math.max(64, Math.trunc(Number(state.maxCellsPerStep) || 512)),
    eventHistoryLimit: Number.isFinite(Number(state.eventHistoryLimit))
      ? Math.max(100, Math.trunc(Number(state.eventHistoryLimit)))
      : null,
    profileOverrides: cloneJson(state.profileOverrides || null),
    cellCursor: Math.max(0, Math.trunc(Number(state.cellCursor) || 0)),
    stepIndex: Math.max(0, Math.trunc(Number(state.stepIndex) || 0)),
    nextSequence: Math.max(1, Math.trunc(Number(state.nextSequence) || 1)),
    accumulatorMs: Math.max(0, Number(Number(state.accumulatorMs || 0).toFixed(6))),
    historyBaseStepIndex: Math.max(0, Math.trunc(Number(state.historyBaseStepIndex) || 0)),
    historyBaseSequence: Math.max(0, Math.trunc(Number(state.historyBaseSequence) || 0)),
    cells: Array.isArray(cellSnapshots)
      ? cellSnapshots
      : [...state.cells.entries()]
        .sort(([left], [right]) => compareTrackStateCellKeys(left, right))
        .map(([, cell]) => cloneJson(cell)),
    events: [...state.pendingEvents].sort(compareTrackStateEvents).map(cloneJson),
    eventHistory: includeEventHistory
      ? [...state.eventHistory].sort(compareTrackStateEvents).map(cloneJson)
      : [],
    contactAggregates: state.contactAccumulator?.createSnapshot?.().map(cloneJson) || [],
    carryByTire: [...state.carryByTire.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, carry]) => [key, cloneJson(carry)]),
    weatherTimeline: includeWeatherTimeline
      ? [...state.weatherTimeline.entries()]
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([step, forcing]) => [Number(step), cloneJson(forcing)])
      : [],
    totals: cloneJson(state.totals)
  };
}

export function getTrackStateChecksum(state) {
  return hashTrackStateValue(stableTrackStateStringify(getTrackStateCanonicalPayload(state)));
}

export function createTrackStateSnapshot(state, options = {}) {
  const payload = getTrackStateCanonicalPayload(state, options);
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
  state.eventHistoryLimit = snapshot.eventHistoryLimit === null
    ? Infinity
    : Math.max(100, Math.trunc(Number(snapshot.eventHistoryLimit) || state.eventHistoryLimit || 8192));
  state.profileOverrides = cloneJson(snapshot.profileOverrides || null);
  state.stepIndex = Math.max(0, Math.trunc(Number(snapshot.stepIndex) || 0));
  state.nextSequence = Math.max(1, Math.trunc(Number(snapshot.nextSequence) || 1));
  state.accumulatorMs = Math.max(0, Number(snapshot.accumulatorMs || 0));
  state.historyBaseStepIndex = Math.max(0, Math.trunc(Number(snapshot.historyBaseStepIndex) || 0));
  state.historyBaseSequence = Math.max(0, Math.trunc(Number(snapshot.historyBaseSequence) || 0));
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
  state.staleEventIds = new Set();
  state.contactAccumulator.restoreSnapshot(snapshot.contactAggregates || []);
  state.carryByTire = new Map((snapshot.carryByTire || []).map(([key, value]) => [String(key), cloneJson(value)]));
  state.weatherTimeline = new Map((snapshot.weatherTimeline || []).map(([step, forcing]) => [Number(step), cloneJson(forcing)]));
  state.lastWeatherForcing = null;
  for (const forcing of state.weatherTimeline.values()) state.lastWeatherForcing = forcing;
  state.totals = {
    precipitationMm: 0,
    drainageMm: 0,
    evaporationMm: 0,
    ...(cloneJson(snapshot.totals) || {})
  };
  return state;
}
