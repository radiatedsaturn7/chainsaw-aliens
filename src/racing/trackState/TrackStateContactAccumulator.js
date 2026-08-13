import {
  getTrackStateCellCoordinates,
  quantizeTrackStateNumber,
  traceTrackStateCells
} from './TrackStateMath.js';

const EPSILON = 1e-9;
const PHYSICAL_TOTAL_FIELDS = Object.freeze([
  'rollingDistanceM',
  'groundedContactDurationSeconds',
  'normalImpulseNs',
  'longitudinalSlipWorkJ',
  'lateralScrubWorkJ',
  'lockedWheelWorkJ',
  'wheelspinWorkJ',
  'surfaceHeatingWorkJ',
  'rubberDepositionWorkJ',
  'waterDisplacementImpulseNs',
  'looseMaterialSweepWorkJ',
  'materialPickupCapacity',
  'carriedMaterialDepositCapacity'
]);
const EMPTY_ACCEPTED_KEYS = Object.freeze([]);

function readPhysicalTotal(supplied, field, fallback, scale) {
  if (!Object.hasOwn(supplied, field)) return Math.max(0, fallback);
  const scaled = Math.max(0, Number(supplied[field]) || 0) * scale;
  return Math.max(0, Number.isFinite(Number(scaled)) ? Number(scaled) : fallback);
}

function getPhysicalTotals(
  contact,
  distanceM,
  durationSeconds,
  contactScale,
  normalLoadN,
  suppliedScale,
  target
) {
  const supplied = contact.physicalMutationTotals || contact.mutationTotals || {};
  const groundedDuration = durationSeconds * contactScale;
  const normalImpulse = normalLoadN * groundedDuration;
  const speedMps = Math.abs(Number(contact.speedMps || 0));
  const slip = Math.max(0, Math.abs(Number(contact.slipEnergy ?? contact.slip ?? 0)));
  const brakeLock = Math.max(0, Number(contact.brakeLock || 0));
  const wheelSpin = Math.max(0, Number(contact.wheelSpin || 0));
  const longitudinalSlip = Math.max(
    0,
    Number(contact.longitudinalSlip ?? 0)
  );
  const lateralSlip = Math.max(
    0,
    Number(contact.lateralSlip
      ?? Math.max(0, slip - Math.max(longitudinalSlip, brakeLock, wheelSpin)))
  );
  const rollingSpeedMps = groundedDuration > EPSILON ? distanceM / groundedDuration : 0;
  const rollingWork = normalLoadN * distanceM * contactScale;
  const longitudinalSlipSpeedMps = longitudinalSlip * Math.max(speedMps, rollingSpeedMps, 1);
  const lateralSlipSpeedMps = lateralSlip * Math.max(speedMps, rollingSpeedMps);
  const lockedSlipSpeedMps = brakeLock * Math.max(speedMps, rollingSpeedMps, 2);
  const wheelspinSlipSpeedMps = wheelSpin * Math.max(speedMps, rollingSpeedMps, 5);
  const longitudinalSlipWork = normalImpulse * longitudinalSlipSpeedMps;
  const lateralScrubWork = normalImpulse * lateralSlipSpeedMps;
  const lockedWheelWork = normalImpulse * lockedSlipSpeedMps;
  const wheelspinWork = normalImpulse * wheelspinSlipSpeedMps;
  const surfaceHeatingWork = longitudinalSlipWork + lateralScrubWork
    + lockedWheelWork + wheelspinWork;
  const temperatureF = Number(contact.tireTemperatureF || 70);
  const temperatureScale = Math.max(0.45, Math.min(1.35, 0.55 + (temperatureF - 30) / 110));
  const compoundId = String(contact.compoundId || 'tarmac').toLowerCase();
  const compoundScale = /drift|soft|slick/.test(compoundId)
    ? 1.22
    : /snow|ice|studded/.test(compoundId)
      ? 0.34
      : /dirt|offroad|gravel/.test(compoundId)
        ? 0.68
        : /wet|rain/.test(compoundId)
          ? 0.82
          : 1;
  const output = target || {};
  const scale = Number(suppliedScale);
  output.rollingDistanceM = readPhysicalTotal(supplied, 'rollingDistanceM', distanceM, scale);
  output.groundedContactDurationSeconds = readPhysicalTotal(
    supplied, 'groundedContactDurationSeconds', groundedDuration, scale
  );
  output.normalImpulseNs = readPhysicalTotal(supplied, 'normalImpulseNs', normalImpulse, scale);
  output.longitudinalSlipWorkJ = readPhysicalTotal(
    supplied, 'longitudinalSlipWorkJ', longitudinalSlipWork, scale
  );
  output.lateralScrubWorkJ = readPhysicalTotal(
    supplied, 'lateralScrubWorkJ', lateralScrubWork, scale
  );
  output.lockedWheelWorkJ = readPhysicalTotal(
    supplied, 'lockedWheelWorkJ', lockedWheelWork, scale
  );
  output.wheelspinWorkJ = readPhysicalTotal(
    supplied, 'wheelspinWorkJ', wheelspinWork, scale
  );
  output.surfaceHeatingWorkJ = readPhysicalTotal(
    supplied, 'surfaceHeatingWorkJ', surfaceHeatingWork, scale
  );
  output.rubberDepositionWorkJ = readPhysicalTotal(
    supplied,
    'rubberDepositionWorkJ',
    (rollingWork * 0.08 + surfaceHeatingWork) * compoundScale * temperatureScale,
    scale
  );
  output.waterDisplacementImpulseNs = readPhysicalTotal(
    supplied, 'waterDisplacementImpulseNs', rollingWork, scale
  );
  output.looseMaterialSweepWorkJ = readPhysicalTotal(
    supplied, 'looseMaterialSweepWorkJ', rollingWork * (1 + lateralSlip), scale
  );
  output.materialPickupCapacity = readPhysicalTotal(
    supplied, 'materialPickupCapacity', rollingWork, scale
  );
  output.carriedMaterialDepositCapacity = readPhysicalTotal(
    supplied, 'carriedMaterialDepositCapacity', rollingWork, scale
  );
  return output;
}

function clipAxis(interval, origin, delta, low, high) {
  if (Math.abs(delta) <= EPSILON) return origin >= low && origin <= high;
  const first = (low - origin) / delta;
  const second = (high - origin) / delta;
  const entry = Math.min(first, second);
  const exit = Math.max(first, second);
  interval.start = Math.max(interval.start, entry);
  interval.end = Math.min(interval.end, exit);
  return interval.end >= interval.start;
}

function clipSegmentToCell(from, to, coords, cellSizeM, target) {
  const minX = coords.x * cellSizeM;
  const maxX = minX + cellSizeM;
  const minZ = coords.z * cellSizeM;
  const maxZ = minZ + cellSizeM;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  target.start = 0;
  target.end = 1;
  if (!clipAxis(target, from.x, dx, minX, maxX)
    || !clipAxis(target, from.z, dz, minZ, maxZ)) return null;
  target.start = Math.max(0, target.start);
  target.end = Math.min(1, target.end);
  return target;
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
    this.normalizedFromScratch = { x: 0, z: 0 };
    this.normalizedToScratch = { x: 0, z: 0 };
    this.sliceFromScratch = { x: 0, z: 0 };
    this.sliceToScratch = { x: 0, z: 0 };
    this.clipScratch = { start: 0, end: 1 };
    this.singleTraceCoordinates = { x: 0, z: 0, key: '' };
    this.singleTrace = [this.singleTraceCoordinates];
    this.pieceScratch = [];
    this.physicalTotalsScratch = {};
    this.dueScratch = [];
  }

  get size() {
    return this.aggregates.size;
  }

  clear() {
    this.aggregates.clear();
  }

  accumulate(contact = {}, { collectAcceptedKeys = true } = {}) {
    if (contact.grounded === false || Number(contact.contactScale ?? 1) <= 0.001) {
      return collectAcceptedKeys ? [] : EMPTY_ACCEPTED_KEYS;
    }
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
    const normalizedFrom = this.normalizedFromScratch;
    normalizedFrom.x = Number(from.x || 0);
    normalizedFrom.z = Number(from.z || 0);
    const normalizedTo = this.normalizedToScratch;
    normalizedTo.x = Number(to.x || 0);
    normalizedTo.z = Number(to.z || 0);
    const acceptedKeys = collectAcceptedKeys ? [] : null;
    let consumedMs = 0;
    while (consumedMs < durationMs - EPSILON) {
      const absoluteMs = startAccumulatorMs + consumedMs;
      const stepOffset = Math.floor((absoluteMs + EPSILON) / state.fixedStepMs);
      const withinStepMs = absoluteMs - stepOffset * state.fixedStepMs;
      const sliceMs = Math.min(durationMs - consumedMs, state.fixedStepMs - withinStepMs);
      const startRatio = consumedMs / durationMs;
      const endRatio = (consumedMs + sliceMs) / durationMs;
      const sliceFrom = this.sliceFromScratch;
      sliceFrom.x = normalizedFrom.x + (normalizedTo.x - normalizedFrom.x) * startRatio;
      sliceFrom.z = normalizedFrom.z + (normalizedTo.z - normalizedFrom.z) * startRatio;
      const sliceTo = this.sliceToScratch;
      sliceTo.x = normalizedFrom.x + (normalizedTo.x - normalizedFrom.x) * endRatio;
      sliceTo.z = normalizedFrom.z + (normalizedTo.z - normalizedFrom.z) * endRatio;
      const stepIndex = state.stepIndex + stepOffset + 1;
      const sliceScale = sliceMs / durationMs;
      const sliceDistanceM = Number.isFinite(Number(contact.distanceM))
        ? Number(contact.distanceM) * sliceScale
        : undefined;
      const sliceAcceptedKeys = this.accumulateSlice(
        contact,
        stepIndex,
        sliceFrom,
        sliceTo,
        sliceMs / 1000,
        collectAcceptedKeys,
        sliceDistanceM,
        withinStepMs / 1000,
        sliceScale
      );
      if (collectAcceptedKeys) {
        for (let keyIndex = 0; keyIndex < sliceAcceptedKeys.length; keyIndex += 1) {
          acceptedKeys.push(sliceAcceptedKeys[keyIndex]);
        }
      }
      consumedMs += sliceMs;
    }
    return acceptedKeys || EMPTY_ACCEPTED_KEYS;
  }

  accumulateSlice(
    contact,
    stepIndex,
    from,
    to,
    durationSeconds,
    collectAcceptedKeys = true,
    distanceMOverride = undefined,
    stepTimeStartSeconds = undefined,
    suppliedTotalsScale = 1
  ) {
    const state = this.trackState;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const geometricDistance = Math.hypot(dx, dz);
    const segmentDistance = Number.isFinite(Number(distanceMOverride))
      ? Math.max(0, Number(distanceMOverride))
      : Number.isFinite(Number(contact.distanceM))
        ? Math.max(0, Number(contact.distanceM))
      : geometricDistance;
    const fromCellX = Math.floor(from.x / state.cellSizeM);
    const fromCellZ = Math.floor(from.z / state.cellSizeM);
    const toCellX = Math.floor(to.x / state.cellSizeM);
    const toCellZ = Math.floor(to.z / state.cellSizeM);
    let traced;
    if (fromCellX === toCellX && fromCellZ === toCellZ) {
      this.singleTraceCoordinates.x = toCellX;
      this.singleTraceCoordinates.z = toCellZ;
      this.singleTraceCoordinates.key = `${toCellX},${toCellZ}`;
      traced = this.singleTrace;
    } else if (geometricDistance > EPSILON) {
      traced = traceTrackStateCells(from, to, state.cellSizeM);
    } else {
      const coordinates = getTrackStateCellCoordinates(to, state.cellSizeM);
      this.singleTraceCoordinates.x = coordinates.x;
      this.singleTraceCoordinates.z = coordinates.z;
      this.singleTraceCoordinates.key = `${toCellX},${toCellZ}`;
      traced = this.singleTrace;
    }
    const pieces = this.pieceScratch;
    let pieceCount = 0;
    let totalPieceRatio = 0;
    for (let traceIndex = 0; traceIndex < traced.length; traceIndex += 1) {
      const coords = traced[traceIndex];
      const clipped = clipSegmentToCell(
        from, to, coords, state.cellSizeM, this.clipScratch
      );
      const ratio = geometricDistance > EPSILON && clipped
        ? Math.max(0, clipped.end - clipped.start)
        : 1;
      const pieceDistanceM = segmentDistance * ratio;
      if (!(pieceDistanceM > EPSILON || segmentDistance <= EPSILON)) continue;
      let piece = pieces[pieceCount];
      if (!piece) {
        piece = {};
        pieces[pieceCount] = piece;
      }
      piece.coords = coords;
      piece.ratio = ratio;
      piece.entryRatio = clipped?.start || 0;
      piece.distanceM = pieceDistanceM;
      totalPieceRatio += ratio;
      pieceCount += 1;
    }
    pieces.length = pieceCount;
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
    const acceptedKeys = collectAcceptedKeys ? [] : null;
    for (let pieceIndex = 0; pieceIndex < pieceCount; pieceIndex += 1) {
      const piece = pieces[pieceIndex];
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
        rollingDistanceM: 0,
        groundedContactDurationSeconds: 0,
        normalImpulseNs: 0,
        longitudinalSlipWorkJ: 0,
        lateralScrubWorkJ: 0,
        lockedWheelWorkJ: 0,
        wheelspinWorkJ: 0,
        surfaceHeatingWorkJ: 0,
        rubberDepositionWorkJ: 0,
        waterDisplacementImpulseNs: 0,
        looseMaterialSweepWorkJ: 0,
        materialPickupCapacity: 0,
        carriedMaterialDepositCapacity: 0,
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
      const physicalTotals = getPhysicalTotals(
        contact,
        segmentDistance,
        durationSeconds,
        contactScale,
        normalLoadN,
        suppliedTotalsScale,
        this.physicalTotalsScratch
      );
      aggregate.distanceM += piece.distanceM;
      aggregate.slipWork += slip * normalLoadN * piece.distanceM * contactScale;
      for (let fieldIndex = 0; fieldIndex < PHYSICAL_TOTAL_FIELDS.length; fieldIndex += 1) {
        const field = PHYSICAL_TOTAL_FIELDS[fieldIndex];
        aggregate[field] += physicalTotals[field] * piece.ratio / Math.max(EPSILON, totalPieceRatio);
      }
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
      const compoundId = String(contact.compoundId || 'tarmac');
      if (compoundId < aggregate.compoundId) aggregate.compoundId = compoundId;
      aggregate.firstContactTimeSeconds = quantizeTrackStateNumber(Math.min(
        aggregate.firstContactTimeSeconds,
        Number(stepTimeStartSeconds ?? contact.stepTimeStartSeconds ?? 0)
          + durationSeconds * piece.entryRatio
      ));
      this.aggregates.set(key, aggregate);
      if (collectAcceptedKeys) acceptedKeys.push({ stepIndex, vehicleId, wheelId, cellKey });
    }
    return acceptedKeys || EMPTY_ACCEPTED_KEYS;
  }

  flushStep(stepIndex, { collectEvents = true } = {}) {
    const due = this.dueScratch;
    let dueCount = 0;
    for (const [key, aggregate] of this.aggregates) {
      if (aggregate.stepIndex > stepIndex) continue;
      let entry = due[dueCount];
      if (!entry) {
        entry = { key: null, aggregate: null };
        due[dueCount] = entry;
      }
      entry.key = key;
      entry.aggregate = aggregate;
      dueCount += 1;
    }
    due.length = dueCount;
    due.sort((left, right) => compareAggregates(left.aggregate, right.aggregate));
    const events = collectEvents ? [] : null;
    for (let dueIndex = 0; dueIndex < dueCount; dueIndex += 1) {
      const { key, aggregate } = due[dueIndex];
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
          rollingDistanceM: quantizeTrackStateNumber(aggregate.rollingDistanceM),
          groundedContactDurationSeconds: quantizeTrackStateNumber(
            aggregate.groundedContactDurationSeconds
          ),
          normalImpulseNs: quantizeTrackStateNumber(aggregate.normalImpulseNs),
          longitudinalSlipWorkJ: quantizeTrackStateNumber(aggregate.longitudinalSlipWorkJ),
          lateralScrubWorkJ: quantizeTrackStateNumber(aggregate.lateralScrubWorkJ),
          lockedWheelWorkJ: quantizeTrackStateNumber(aggregate.lockedWheelWorkJ),
          wheelspinWorkJ: quantizeTrackStateNumber(aggregate.wheelspinWorkJ),
          surfaceHeatingWorkJ: quantizeTrackStateNumber(aggregate.surfaceHeatingWorkJ),
          rubberDepositionWorkJ: quantizeTrackStateNumber(aggregate.rubberDepositionWorkJ),
          waterDisplacementImpulseNs: quantizeTrackStateNumber(
            aggregate.waterDisplacementImpulseNs
          ),
          looseMaterialSweepWorkJ: quantizeTrackStateNumber(aggregate.looseMaterialSweepWorkJ),
          materialPickupCapacity: quantizeTrackStateNumber(aggregate.materialPickupCapacity),
          carriedMaterialDepositCapacity: quantizeTrackStateNumber(
            aggregate.carriedMaterialDepositCapacity
          ),
          brakeLock: quantizeTrackStateNumber(aggregate.maxBrakeLock),
          wheelSpin: quantizeTrackStateNumber(aggregate.maxWheelSpin),
          contactDurationSeconds: quantizeTrackStateNumber(aggregate.contactDurationSeconds),
          compoundId: aggregate.compoundId,
          tireTemperatureF: quantizeTrackStateNumber(aggregate.temperatureWeight > EPSILON
            ? aggregate.temperatureWeighted / aggregate.temperatureWeight
            : 70)
        }
      });
      if (event && collectEvents) events.push(event);
    }
    return events || EMPTY_ACCEPTED_KEYS;
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
