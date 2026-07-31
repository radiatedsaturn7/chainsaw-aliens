import {
  getTrackStateCellCoordinates,
  quantizeTrackStateNumber,
  traceTrackStateCells
} from './TrackStateMath.js';

const EPSILON = 1e-9;

function clipSegmentToCell(from, to, coords, cellSizeM) {
  const minX = coords.x * cellSizeM;
  const maxX = minX + cellSizeM;
  const minZ = coords.z * cellSizeM;
  const maxZ = minZ + cellSizeM;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let start = 0;
  let end = 1;
  for (const [origin, delta, low, high] of [
    [from.x, dx, minX, maxX],
    [from.z, dz, minZ, maxZ]
  ]) {
    if (Math.abs(delta) <= EPSILON) {
      if (origin < low || origin > high) return null;
      continue;
    }
    const first = (low - origin) / delta;
    const second = (high - origin) / delta;
    const entry = Math.min(first, second);
    const exit = Math.max(first, second);
    start = Math.max(start, entry);
    end = Math.min(end, exit);
    if (end < start) return null;
  }
  return { start: Math.max(0, start), end: Math.min(1, end) };
}

function compareAggregates(left, right) {
  return left.stepIndex - right.stepIndex
    || left.vehicleId.localeCompare(right.vehicleId)
    || left.wheelId.localeCompare(right.wheelId)
    || left.firstContactTimeSeconds - right.firstContactTimeSeconds
    || left.cellKey.localeCompare(right.cellKey);
}

export class TrackStateContactAccumulator {
  constructor(trackState) {
    this.trackState = trackState;
    this.aggregates = new Map();
  }

  get size() {
    return this.aggregates.size;
  }

  clear() {
    this.aggregates.clear();
  }

  accumulate(contact = {}) {
    if (contact.grounded === false || Number(contact.contactScale ?? 1) <= 0.001) return [];
    const state = this.trackState;
    const durationMs = Math.max(
      EPSILON,
      Number(contact.contactDurationSeconds ?? contact.durationSeconds ?? state.fixedStepMs / 1000) * 1000
    );
    const startAccumulatorMs = Math.max(0, Number(contact.startAccumulatorMs ?? state.accumulatorMs) || 0);
    const from = contact.previousPosition || contact.position || {
      x: Number(contact.x || 0),
      z: Number(contact.z || 0)
    };
    const to = contact.position || { x: Number(contact.x || 0), z: Number(contact.z || 0) };
    const normalizedFrom = { x: Number(from.x || 0), z: Number(from.z || 0) };
    const normalizedTo = { x: Number(to.x || 0), z: Number(to.z || 0) };
    const acceptedKeys = [];
    let consumedMs = 0;
    while (consumedMs < durationMs - EPSILON) {
      const absoluteMs = startAccumulatorMs + consumedMs;
      const stepOffset = Math.floor((absoluteMs + EPSILON) / state.fixedStepMs);
      const withinStepMs = absoluteMs - stepOffset * state.fixedStepMs;
      const sliceMs = Math.min(durationMs - consumedMs, state.fixedStepMs - withinStepMs);
      const startRatio = consumedMs / durationMs;
      const endRatio = (consumedMs + sliceMs) / durationMs;
      const sliceFrom = {
        x: normalizedFrom.x + (normalizedTo.x - normalizedFrom.x) * startRatio,
        z: normalizedFrom.z + (normalizedTo.z - normalizedFrom.z) * startRatio
      };
      const sliceTo = {
        x: normalizedFrom.x + (normalizedTo.x - normalizedFrom.x) * endRatio,
        z: normalizedFrom.z + (normalizedTo.z - normalizedFrom.z) * endRatio
      };
      const stepIndex = state.stepIndex + stepOffset + 1;
      acceptedKeys.push(...this.accumulateSlice({
        ...contact,
        stepTimeStartSeconds: withinStepMs / 1000,
        distanceM: Number.isFinite(Number(contact.distanceM))
          ? Number(contact.distanceM) * sliceMs / durationMs
          : undefined
      }, stepIndex, sliceFrom, sliceTo, sliceMs / 1000));
      consumedMs += sliceMs;
    }
    return acceptedKeys;
  }

  accumulateSlice(contact, stepIndex, from, to, durationSeconds) {
    const state = this.trackState;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const geometricDistance = Math.hypot(dx, dz);
    const segmentDistance = Number.isFinite(Number(contact.distanceM))
      ? Math.max(0, Number(contact.distanceM))
      : geometricDistance;
    const traced = geometricDistance > EPSILON
      ? traceTrackStateCells(from, to, state.cellSizeM)
      : [{ ...getTrackStateCellCoordinates(to, state.cellSizeM), key: `${Math.floor(to.x / state.cellSizeM)},${Math.floor(to.z / state.cellSizeM)}` }];
    const pieces = traced.map((coords) => {
      const clipped = clipSegmentToCell(from, to, coords, state.cellSizeM);
      const ratio = geometricDistance > EPSILON && clipped
        ? Math.max(0, clipped.end - clipped.start)
        : 1;
      return {
        coords,
        ratio,
        entryRatio: clipped?.start || 0,
        distanceM: segmentDistance * ratio
      };
    }).filter((piece) => piece.distanceM > EPSILON || segmentDistance <= EPSILON);
    const totalPieceRatio = pieces.reduce((sum, piece) => sum + piece.ratio, 0);
    const vehicleId = String(contact.vehicleId || 'vehicle');
    const wheelId = String(contact.wheelId || '');
    const contactScale = Math.max(0, Math.min(1, Number(contact.contactScale ?? 1)));
    const normalLoadN = Math.max(0, Number(contact.normalLoadN || 0));
    const tireTemperatureF = Number(contact.tireTemperatureF || 70);
    const slip = Math.max(0, Math.abs(Number(contact.slipEnergy ?? contact.slip ?? 0)));
    const directionLength = Math.hypot(
      Number(contact.directionX ?? dx),
      Number(contact.directionZ ?? dz)
    ) || 1;
    const directionX = Number(contact.directionX ?? dx) / directionLength;
    const directionZ = Number(contact.directionZ ?? dz) / directionLength;
    return pieces.map((piece) => {
      const duration = segmentDistance > EPSILON && totalPieceRatio > EPSILON
        ? durationSeconds * piece.ratio / totalPieceRatio
        : durationSeconds / Math.max(1, pieces.length);
      const cellKey = piece.coords.key;
      const key = `${stepIndex}\u0000${vehicleId}\u0000${wheelId}\u0000${cellKey}`;
      const aggregate = this.aggregates.get(key) || {
        stepIndex,
        vehicleId,
        wheelId,
        cellKey,
        x: (piece.coords.x + 0.5) * state.cellSizeM,
        z: (piece.coords.z + 0.5) * state.cellSizeM,
        distanceM: 0,
        slipWork: 0,
        loadDuration: 0,
        temperatureWeight: 0,
        temperatureWeighted: 0,
        speedWeight: 0,
        speedWeighted: 0,
        directionXWeighted: 0,
        directionZWeighted: 0,
        directionWeight: 0,
        maxBrakeLock: 0,
        maxWheelSpin: 0,
        contactDurationSeconds: 0,
        groundedDurationSeconds: 0,
        slipDurationWeighted: 0,
        compoundId: String(contact.compoundId || 'tarmac'),
        firstContactTimeSeconds: Number.POSITIVE_INFINITY
      };
      const distanceWeight = piece.distanceM > EPSILON ? piece.distanceM : duration;
      aggregate.distanceM += piece.distanceM;
      aggregate.slipWork += slip * normalLoadN * piece.distanceM * contactScale;
      aggregate.loadDuration += normalLoadN * duration * contactScale;
      aggregate.temperatureWeight += distanceWeight;
      aggregate.temperatureWeighted += tireTemperatureF * distanceWeight;
      aggregate.speedWeight += distanceWeight;
      aggregate.speedWeighted += Math.abs(Number(contact.speedMps || 0)) * distanceWeight;
      aggregate.directionWeight += distanceWeight;
      aggregate.directionXWeighted += directionX * distanceWeight;
      aggregate.directionZWeighted += directionZ * distanceWeight;
      aggregate.maxBrakeLock = Math.max(aggregate.maxBrakeLock, Number(contact.brakeLock || 0));
      aggregate.maxWheelSpin = Math.max(aggregate.maxWheelSpin, Number(contact.wheelSpin || 0));
      aggregate.contactDurationSeconds += duration;
      aggregate.groundedDurationSeconds += duration * contactScale;
      aggregate.slipDurationWeighted += slip * duration * contactScale;
      aggregate.compoundId = [aggregate.compoundId, String(contact.compoundId || 'tarmac')].sort()[0];
      aggregate.firstContactTimeSeconds = quantizeTrackStateNumber(Math.min(
        aggregate.firstContactTimeSeconds,
        Number(contact.stepTimeStartSeconds || 0) + durationSeconds * piece.entryRatio
      ));
      this.aggregates.set(key, aggregate);
      return { stepIndex, vehicleId, wheelId, cellKey };
    });
  }

  flushStep(stepIndex) {
    const due = [...this.aggregates.entries()]
      .filter(([, aggregate]) => aggregate.stepIndex <= stepIndex)
      .map(([key, aggregate]) => ({ key, aggregate }))
      .sort((left, right) => compareAggregates(left.aggregate, right.aggregate));
    const events = [];
    due.forEach(({ key, aggregate }) => {
      this.aggregates.delete(key);
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
      const event = this.trackState.queueEvent({
        type: 'tire-contact',
        stepIndex: aggregate.stepIndex,
        vehicleId: aggregate.vehicleId,
        wheelId: aggregate.wheelId,
        x: aggregate.x,
        z: aggregate.z,
        cellKey: aggregate.cellKey,
        payload: {
          grounded: groundedFraction > 0,
          contactScale: quantizeTrackStateNumber(groundedFraction),
          groundedFraction: quantizeTrackStateNumber(groundedFraction),
          normalLoadN: quantizeTrackStateNumber(normalLoadN),
          speedMps: quantizeTrackStateNumber(aggregate.speedWeight > EPSILON
            ? aggregate.speedWeighted / aggregate.speedWeight
            : 0),
          distanceM: quantizeTrackStateNumber(aggregate.distanceM),
          directionX: quantizeTrackStateNumber(aggregate.directionXWeighted / directionLength),
          directionZ: quantizeTrackStateNumber(aggregate.directionZWeighted / directionLength),
          slipEnergy: quantizeTrackStateNumber(slipEnergy),
          slipWork: quantizeTrackStateNumber(aggregate.slipWork),
          brakeLock: quantizeTrackStateNumber(aggregate.maxBrakeLock),
          wheelSpin: quantizeTrackStateNumber(aggregate.maxWheelSpin),
          contactDurationSeconds: quantizeTrackStateNumber(aggregate.contactDurationSeconds),
          compoundId: aggregate.compoundId,
          tireTemperatureF: quantizeTrackStateNumber(aggregate.temperatureWeight > EPSILON
            ? aggregate.temperatureWeighted / aggregate.temperatureWeight
            : 70)
        }
      });
      if (event) events.push(event);
    });
    return events;
  }

  createSnapshot() {
    return [...this.aggregates.values()]
      .sort(compareAggregates)
      .map((aggregate) => ({ ...aggregate }));
  }

  restoreSnapshot(aggregates = []) {
    this.clear();
    aggregates.forEach((aggregate) => {
      const normalized = {
        firstContactTimeSeconds: 0,
        ...aggregate
      };
      const key = `${normalized.stepIndex}\u0000${normalized.vehicleId}\u0000${normalized.wheelId}\u0000${normalized.cellKey}`;
      this.aggregates.set(key, normalized);
    });
  }
}
