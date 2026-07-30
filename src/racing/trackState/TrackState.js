import {
  clamp,
  compareTrackStateCellKeys,
  getTrackStateCellCenter,
  getTrackStateCellCoordinates,
  getTrackStateCellKey,
  quantizeTrackStateNumber,
  traceTrackStateCells
} from './TrackStateMath.js';
import {
  clampTrackStateCell,
  createTrackStateCell,
  getTrackStateCellSample
} from './TrackStateCell.js';
import {
  compareTrackStateEvents,
  normalizeTrackStateEvent
} from './TrackStateEvents.js';
import {
  createTrackStateSnapshot,
  getTrackStateChecksum,
  restoreTrackStateSnapshot
} from './TrackStateSerialization.js';

const WATER_FIELDS = ['moistureDepthMm', 'standingWaterDepthMm', 'snowDepthMm', 'iceDepthMm'];
export const TRACK_STATE_EVENT_HISTORY_LIMIT = 8192;
const NEIGHBORS = Object.freeze([
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 }
]);

function normalizeForcing(forcing = {}) {
  const type = String(forcing.type || forcing.id || 'clear');
  return {
    type,
    precipitationRateMmPerS: quantizeTrackStateNumber(Math.max(0, Number(forcing.precipitationRateMmPerS) || 0)),
    ambientTemperatureC: quantizeTrackStateNumber(Number.isFinite(Number(forcing.ambientTemperatureC))
      ? Number(forcing.ambientTemperatureC)
      : type === 'snow' ? -4 : type === 'storm' ? 13 : type === 'rain' ? 16 : 22),
    sunIntensity: quantizeTrackStateNumber(clamp(Number(forcing.sunIntensity) || 0, 0, 1)),
    windIntensity: quantizeTrackStateNumber(clamp(Number(forcing.windIntensity) || 0, 0, 1)),
    windDirectionRad: quantizeTrackStateNumber(Number(forcing.windDirectionRad) || 0),
    humidity: quantizeTrackStateNumber(clamp(Number.isFinite(Number(forcing.humidity)) ? Number(forcing.humidity) : 0.5, 0, 1))
  };
}

export class TrackState {
  constructor({
    seed = 1,
    cellSizeM = 1,
    fixedStepMs = 100,
    maxCatchUpSteps = 5,
    sampleBaseSurface = null,
    profileOverrides = null,
    snapshot = null,
    eventHistoryLimit = TRACK_STATE_EVENT_HISTORY_LIMIT,
    maxCellsPerStep = 512
  } = {}) {
    this.seed = Number(seed) >>> 0;
    this.cellSizeM = Math.max(0.1, Number(cellSizeM) || 1);
    this.fixedStepMs = Math.max(10, Number(fixedStepMs) || 100);
    this.maxCatchUpSteps = Math.max(1, Math.trunc(Number(maxCatchUpSteps) || 5));
    this.sampleBaseSurface = typeof sampleBaseSurface === 'function' ? sampleBaseSurface : () => ({});
    this.profileOverrides = profileOverrides;
    this.eventHistoryLimit = Number.isFinite(Number(eventHistoryLimit))
      ? Math.max(100, Math.trunc(Number(eventHistoryLimit)))
      : Infinity;
    this.maxCellsPerStep = Math.max(64, Math.trunc(Number(maxCellsPerStep) || 512));
    this.stepIndex = 0;
    this.nextSequence = 1;
    this.accumulatorMs = 0;
    this.cells = new Map();
    this.baseSurfaceCache = new Map();
    this.orderedCellKeys = [];
    this.cellCursor = 0;
    this.pendingEvents = [];
    this.pendingEventsDirty = false;
    this.eventHistory = [];
    this.eventIds = new Set();
    this.carryByTire = new Map();
    this.weatherTimeline = new Map();
    this.totals = {
      precipitationMm: 0,
      drainageMm: 0,
      evaporationMm: 0
    };
    this.initialSnapshot = null;
    this.initialChecksum = '';
    if (snapshot) restoreTrackStateSnapshot(this, snapshot);
    this.initialSnapshot = createTrackStateSnapshot(this);
    this.initialChecksum = this.initialSnapshot.checksum;
  }

  static fromSnapshot(snapshot, options = {}) {
    return new TrackState({ ...options, snapshot });
  }

  get simulationTimeMs() {
    return this.stepIndex * this.fixedStepMs;
  }

  getCell(pointOrCoords = {}, { create = false } = {}) {
    const coords = Number.isInteger(pointOrCoords.x) && Number.isInteger(pointOrCoords.z)
      ? { x: pointOrCoords.x, z: pointOrCoords.z }
      : getTrackStateCellCoordinates(pointOrCoords, this.cellSizeM);
    const key = getTrackStateCellKey(coords);
    return this.cells.get(key) || (create ? this.getOrCreateCell(coords, { coordinates: true }) : null);
  }

  getBaseSurfaceForCoordinates(coords = {}) {
    const key = getTrackStateCellKey(coords);
    if (this.baseSurfaceCache.has(key)) return this.baseSurfaceCache.get(key);
    const center = getTrackStateCellCenter(coords, this.cellSizeM);
    const base = this.sampleBaseSurface(center) || {};
    this.baseSurfaceCache.set(key, base);
    return base;
  }

  getOrCreateCell(pointOrCoords = {}, {
    coordinates = false,
    throughStep = this.stepIndex
  } = {}) {
    const coords = coordinates
      ? { x: Math.trunc(Number(pointOrCoords.x) || 0), z: Math.trunc(Number(pointOrCoords.z) || 0) }
      : getTrackStateCellCoordinates(pointOrCoords, this.cellSizeM);
    const key = getTrackStateCellKey(coords);
    if (this.cells.has(key)) return this.cells.get(key);
    const base = this.getBaseSurfaceForCoordinates(coords);
    const cell = createTrackStateCell({
      ...coords,
      cellSizeM: this.cellSizeM,
      base,
      stepIndex: 0,
      profileOverrides: this.profileOverrides
    });
    this.cells.set(key, cell);
    let low = 0;
    let high = this.orderedCellKeys.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compareTrackStateCellKeys(this.orderedCellKeys[middle], key) < 0) low = middle + 1;
      else high = middle;
    }
    this.orderedCellKeys.splice(low, 0, key);
    if (low <= this.cellCursor && this.orderedCellKeys.length > 1) this.cellCursor += 1;
    if (Number(throughStep) > 0 && this.weatherTimeline.size) {
      [...this.weatherTimeline.entries()]
        .filter(([step]) => Number(step) <= Number(throughStep))
        .sort(([a], [b]) => a - b)
        .forEach(([step, forcing]) => this.applyWeatherToCell(
          cell,
          forcing,
          this.fixedStepMs / 1000,
          Number(step)
        ));
    }
    return cell;
  }

  sample(point = {}) {
    const cell = this.getOrCreateCell(point);
    this.catchUpCellWeather(cell, this.stepIndex);
    return getTrackStateCellSample(cell, this.stepIndex);
  }

  catchUpCellWeather(cell, throughStep = this.stepIndex) {
    if (!cell) return 0;
    let appliedSteps = 0;
    const startStep = Math.max(
      Number(cell.initializedStep || 0) + 1,
      Number(cell.lastUpdatedStep || 0) + 1
    );
    for (let stepIndex = startStep; stepIndex <= Number(throughStep || 0); stepIndex += 1) {
      const forcing = this.weatherTimeline.get(stepIndex);
      if (!forcing) continue;
      this.applyWeatherToCell(cell, forcing, this.fixedStepMs / 1000, stepIndex);
      appliedSteps += 1;
    }
    return appliedSteps;
  }

  mutateCell(pointOrCoords = {}, changes = {}) {
    const coordinates = Number.isInteger(pointOrCoords.x) && Number.isInteger(pointOrCoords.z);
    const cell = this.getOrCreateCell(pointOrCoords, { coordinates });
    this.catchUpCellWeather(cell, this.stepIndex);
    Object.entries(changes || {}).forEach(([field, value]) => {
      if (field in cell && Number.isFinite(Number(value))) cell[field] = Number(value);
    });
    return clampTrackStateCell(cell);
  }

  queueEvent(rawEvent = {}) {
    const event = normalizeTrackStateEvent({
      ...rawEvent,
      stepIndex: rawEvent.stepIndex || this.stepIndex + 1,
      sequence: rawEvent.sequence || this.nextSequence
    }, this.nextSequence);
    this.nextSequence = Math.max(this.nextSequence, event.sequence + 1);
    if (this.eventIds.has(event.id)) return null;
    this.eventIds.add(event.id);
    this.pendingEvents.push(event);
    this.pendingEventsDirty = true;
    return event;
  }

  queueTireContact(contact = {}) {
    if (contact.grounded === false || Number(contact.contactScale ?? 1) <= 0.001) return [];
    const from = contact.previousPosition || contact.position || { x: contact.x, z: contact.z };
    const to = contact.position || { x: contact.x, z: contact.z };
    const cells = traceTrackStateCells(from, to, this.cellSizeM);
    const totalDistance = Math.max(0.001, Number(contact.distanceM) || Math.hypot(
      Number(to.x || 0) - Number(from.x || 0),
      Number(to.z || 0) - Number(from.z || 0)
    ));
    return cells.map((coords, index) => this.queueEvent({
      type: 'tire-contact',
      stepIndex: contact.stepIndex || this.stepIndex + 1,
      sequence: contact.sequence ? Number(contact.sequence) + index : undefined,
      vehicleId: contact.vehicleId,
      wheelId: contact.wheelId,
      x: (coords.x + 0.5) * this.cellSizeM,
      z: (coords.z + 0.5) * this.cellSizeM,
      cellKey: coords.key,
      payload: {
        grounded: true,
        contactScale: contact.contactScale ?? 1,
        normalLoadN: contact.normalLoadN,
        speedMps: contact.speedMps,
        distanceM: totalDistance / cells.length,
        directionX: contact.directionX,
        directionZ: contact.directionZ,
        slipEnergy: contact.slipEnergy,
        slip: contact.slip,
        brakeLock: contact.brakeLock,
        wheelSpin: contact.wheelSpin,
        compoundId: contact.compoundId,
        tireTemperatureF: contact.tireTemperatureF
      }
    })).filter(Boolean);
  }

  queueCrashContamination(crash = {}) {
    return this.queueEvent({
      type: 'crash-debris',
      stepIndex: crash.stepIndex || this.stepIndex + 1,
      sequence: crash.sequence,
      vehicleId: crash.vehicleId || 'vehicle',
      x: crash.x,
      z: crash.z,
      payload: {
        debris: Math.max(0, Number(crash.debris) || 0),
        oil: Math.max(0, Number(crash.oil) || 0),
        dirt: Math.max(0, Number(crash.dirt) || 0)
      }
    });
  }

  applyWeatherToCell(cell, forcing, dt, stepIndex, { countTotals = true } = {}) {
    const solarTarget = forcing.ambientTemperatureC + forcing.sunIntensity * cell.sunExposure * 18;
    const windCooling = forcing.windIntensity * cell.windExposure * 3.5;
    const wetCooling = clamp((cell.moistureDepthMm + cell.standingWaterDepthMm) / 8, 0, 1) * 2.5;
    cell.surfaceTemperatureC += (solarTarget - windCooling - wetCooling - cell.surfaceTemperatureC)
      * clamp(dt * cell.heatResponse, 0, 1);
    const precipitation = forcing.precipitationRateMmPerS * dt;
    if (precipitation > 0) {
      if (forcing.type === 'snow' || forcing.ambientTemperatureC <= -1) {
        cell.snowDepthMm += precipitation;
      } else {
        const moistureCapacity = Math.max(0, cell.saturationDepthMm - cell.moistureDepthMm);
        const absorbed = Math.min(precipitation * cell.permeability, moistureCapacity);
        cell.moistureDepthMm += absorbed;
        cell.standingWaterDepthMm += precipitation - absorbed;
      }
      if (countTotals) this.totals.precipitationMm += precipitation;
    }
    if (cell.surfaceTemperatureC < -0.5) {
      const freeze = Math.min(
        cell.standingWaterDepthMm,
        Math.max(0, -cell.surfaceTemperatureC) * dt * 0.08
      );
      cell.standingWaterDepthMm -= freeze;
      cell.iceDepthMm += freeze;
      const compactFreeze = Math.min(cell.snowDepthMm, cell.compaction * dt * 0.08);
      cell.snowDepthMm -= compactFreeze;
      cell.iceDepthMm += compactFreeze;
    } else if (cell.surfaceTemperatureC > 0.5) {
      const meltCapacity = cell.surfaceTemperatureC * dt * (0.045 + forcing.sunIntensity * cell.sunExposure * 0.08);
      const iceMelt = Math.min(cell.iceDepthMm, meltCapacity * 0.35);
      cell.iceDepthMm -= iceMelt;
      cell.standingWaterDepthMm += iceMelt;
      const snowMelt = Math.min(cell.snowDepthMm, Math.max(0, meltCapacity - iceMelt));
      cell.snowDepthMm -= snowMelt;
      cell.moistureDepthMm += snowMelt * 0.45;
      cell.standingWaterDepthMm += snowMelt * 0.55;
    }
    const evaporationPotential = Math.max(0, cell.surfaceTemperatureC + 4) * 0.00045
      * (0.25 + forcing.sunIntensity * cell.sunExposure)
      * (0.25 + forcing.windIntensity * cell.windExposure)
      * (1 - forcing.humidity * 0.8)
      * dt;
    let evaporation = Math.min(cell.standingWaterDepthMm, evaporationPotential);
    cell.standingWaterDepthMm -= evaporation;
    const moistureEvaporation = Math.min(cell.moistureDepthMm, Math.max(0, evaporationPotential - evaporation));
    cell.moistureDepthMm -= moistureEvaporation;
    evaporation += moistureEvaporation;
    const drainage = Math.min(
      cell.standingWaterDepthMm,
      cell.drainageRateMmPerS * dt * (0.25 + cell.permeability * 0.75)
    );
    cell.standingWaterDepthMm -= drainage;
    if (countTotals) {
      this.totals.evaporationMm += evaporation;
      this.totals.drainageMm += drainage;
    }
    cell.lastUpdatedStep = stepIndex;
    clampTrackStateCell(cell);
  }

  applyConservativeFlow(sourceCells = [...this.cells.values()]) {
    const deltas = new Map();
    const addDelta = (key, field, amount) => {
      const entry = deltas.get(key) || {};
      entry[field] = quantizeTrackStateNumber(Number(entry[field] || 0) + amount);
      deltas.set(key, entry);
    };
    const sortedCells = [...sourceCells].sort((a, b) => compareTrackStateCellKeys(a.key, b.key));
    sortedCells.forEach((cell) => {
      if (cell.standingWaterDepthMm <= 0.02) return;
      let best = null;
      NEIGHBORS.forEach((offset) => {
        const coords = { x: cell.x + offset.x, z: cell.z + offset.z };
        const key = getTrackStateCellKey(coords);
        const existing = this.cells.get(key);
        const elevationM = existing
          ? Number(existing.elevationM || 0)
          : Number(this.getBaseSurfaceForCoordinates(coords)?.elevationM || 0);
        const drop = Number(cell.elevationM || 0) - elevationM;
        if (drop > 0.0001 && (!best || drop > best.drop)) best = { coords, key, existing, drop };
      });
      if (!best) return;
      const neighbor = best.existing || this.getOrCreateCell(best.coords, { coordinates: true });
      const amount = Math.min(
        cell.standingWaterDepthMm * 0.22,
        Math.max(0, best.drop * 1000) * 0.04
      );
      if (amount <= 0) return;
      addDelta(cell.key, 'standingWaterDepthMm', -amount);
      addDelta(neighbor.key, 'standingWaterDepthMm', amount);
    });
    [...deltas.entries()]
      .sort(([left], [right]) => compareTrackStateCellKeys(left, right))
      .forEach(([key, changes]) => {
        const cell = this.cells.get(key);
        Object.entries(changes).forEach(([field, amount]) => {
          cell[field] = Number(cell[field] || 0) + Number(amount || 0);
        });
        clampTrackStateCell(cell);
      });
  }

  applyTireContactEvent(event) {
    const payload = event.payload || {};
    if (payload.grounded === false || Number(payload.contactScale ?? 1) <= 0.001) return;
    const cell = this.getOrCreateCell(
      { x: Math.floor(event.x / this.cellSizeM), z: Math.floor(event.z / this.cellSizeM) },
      { coordinates: true, throughStep: this.stepIndex - 1 }
    );
    this.catchUpCellWeather(cell, this.stepIndex - 1);
    const contactScale = clamp(Number(payload.contactScale ?? 1), 0, 1);
    const loadScale = clamp(Number(payload.normalLoadN || 0) / 4000, 0, 2);
    const distance = Math.max(0, Number(payload.distanceM) || 0);
    const slipEnergy = clamp(Number(payload.slipEnergy ?? payload.slip ?? 0), 0, 4);
    const speedScale = clamp(0.35 + Math.abs(Number(payload.speedMps || 0)) / 35, 0.35, 1.6);
    const compoundId = String(payload.compoundId || 'tarmac').toLowerCase();
    const compoundRubberScale = /drift|soft|slick/.test(compoundId)
      ? 1.22
      : /snow|ice|studded/.test(compoundId)
        ? 0.34
        : /dirt|offroad|gravel/.test(compoundId)
          ? 0.68
          : /wet|rain/.test(compoundId)
            ? 0.82
            : 1;
    const temperatureScale = clamp(
      0.55 + (Number(payload.tireTemperatureF || 70) - 30) / 110,
      0.45,
      1.35
    );
    const tireKey = `${event.vehicleId}:${event.wheelId}`;
    const carry = this.carryByTire.get(tireKey) || { dirt: 0, mud: 0, debris: 0 };
    const depositScale = clamp(distance * 0.32, 0.04, 0.42);
    ['dirt', 'mud', 'debris'].forEach((field) => {
      const deposit = Math.min(Number(carry[field] || 0), Number(carry[field] || 0) * depositScale);
      cell[field] += deposit;
      carry[field] -= deposit;
    });
    const pickupScale = clamp(contactScale * loadScale * distance * 0.11, 0, 0.32);
    ['dirt', 'mud'].forEach((field) => {
      const pickup = Math.min(Number(cell[field] || 0), Number(cell[field] || 0) * pickupScale);
      cell[field] -= pickup;
      carry[field] = clamp(Number(carry[field] || 0) + pickup, 0, 1);
    });
    const rubberDeposit = distance * contactScale * loadScale
      * (0.0008 + slipEnergy * 0.003)
      * speedScale
      * compoundRubberScale
      * temperatureScale
      * clamp(Number(cell.rubberAcceptance ?? 0.25), 0, 1);
    cell.rubber += rubberDeposit;
    cell.surfaceTemperatureC += distance * loadScale * slipEnergy * 0.012;
    cell.compaction += distance * loadScale * 0.0025;

    const directionLength = Math.hypot(Number(payload.directionX || 0), Number(payload.directionZ || 0)) || 1;
    const dx = Number(payload.directionX || 0) / directionLength;
    const dz = Number(payload.directionZ || 0) / directionLength;
    const forward = Math.abs(dx) >= Math.abs(dz)
      ? { x: Math.sign(dx) || 1, z: 0 }
      : { x: 0, z: Math.sign(dz) || 1 };
    const side = { x: -forward.z, z: forward.x };
    const receivers = [
      this.getOrCreateCell(
        { x: cell.x + forward.x, z: cell.z + forward.z },
        { coordinates: true, throughStep: this.stepIndex - 1 }
      ),
      this.getOrCreateCell(
        { x: cell.x + side.x, z: cell.z + side.z },
        { coordinates: true, throughStep: this.stepIndex - 1 }
      ),
      this.getOrCreateCell(
        { x: cell.x - side.x, z: cell.z - side.z },
        { coordinates: true, throughStep: this.stepIndex - 1 }
      )
    ];
    receivers.forEach((receiver) => this.catchUpCellWeather(receiver, this.stepIndex - 1));
    const displacementScale = clamp(
      0.035 + Math.abs(Number(payload.speedMps || 0)) * 0.006 + loadScale * 0.035,
      0,
      0.38
    ) * contactScale;
    const displacedWater = cell.standingWaterDepthMm * displacementScale;
    cell.standingWaterDepthMm -= displacedWater;
    receivers.forEach((receiver, index) => {
      receiver.standingWaterDepthMm += displacedWater * (index === 0 ? 0.5 : 0.25);
    });
    const sweptMarbles = cell.looseMarbles * clamp(displacementScale * 1.4, 0, 0.55);
    cell.looseMarbles -= sweptMarbles;
    receivers[1].looseMarbles += sweptMarbles * 0.5;
    receivers[2].looseMarbles += sweptMarbles * 0.5;
    const kickedLoose = (cell.dirt + cell.dust) * clamp(displacementScale * 0.16, 0, 0.12);
    const dirtShare = cell.dirt / Math.max(0.000001, cell.dirt + cell.dust);
    cell.dirt -= kickedLoose * dirtShare;
    cell.dust -= kickedLoose * (1 - dirtShare);
    receivers[1].dirt += kickedLoose * dirtShare * 0.5;
    receivers[2].dirt += kickedLoose * dirtShare * 0.5;
    receivers[1].dust += kickedLoose * (1 - dirtShare) * 0.5;
    receivers[2].dust += kickedLoose * (1 - dirtShare) * 0.5;
    this.carryByTire.set(tireKey, {
      dirt: quantizeTrackStateNumber(carry.dirt),
      mud: quantizeTrackStateNumber(carry.mud),
      debris: quantizeTrackStateNumber(carry.debris)
    });
    [cell, ...receivers].forEach(clampTrackStateCell);
  }

  applyEvent(event) {
    if (event.type === 'tire-contact') {
      this.applyTireContactEvent(event);
      return;
    }
    const cell = this.getOrCreateCell(
      { x: Math.floor(event.x / this.cellSizeM), z: Math.floor(event.z / this.cellSizeM) },
      { coordinates: true, throughStep: this.stepIndex - 1 }
    );
    this.catchUpCellWeather(cell, this.stepIndex - 1);
    if (event.type === 'crash-debris' || event.type === 'oil-spill') {
      cell.debris += Math.max(0, Number(event.payload?.debris || 0));
      cell.oil += Math.max(0, Number(event.payload?.oil || 0));
      cell.dirt += Math.max(0, Number(event.payload?.dirt || 0));
      clampTrackStateCell(cell);
    }
  }

  step(forcing = {}) {
    this.stepIndex += 1;
    const normalizedForcing = normalizeForcing(forcing);
    this.weatherTimeline.set(this.stepIndex, normalizedForcing);
    if (this.pendingEventsDirty) {
      this.pendingEvents.sort(compareTrackStateEvents);
      this.pendingEventsDirty = false;
    }
    let dueCount = 0;
    while (dueCount < this.pendingEvents.length
      && this.pendingEvents[dueCount].stepIndex <= this.stepIndex) {
      dueCount += 1;
    }
    const due = dueCount ? this.pendingEvents.splice(0, dueCount) : [];
    due.sort(compareTrackStateEvents).forEach((event) => {
      this.applyEvent(event);
      this.eventHistory.push(event);
    });
    if (Number.isFinite(this.eventHistoryLimit) && this.eventHistory.length > this.eventHistoryLimit) {
      const removed = this.eventHistory.splice(0, this.eventHistory.length - this.eventHistoryLimit);
      removed.forEach((event) => this.eventIds.delete(event.id));
    }
    const active = [];
    const cellCount = this.orderedCellKeys.length;
    const budget = Math.min(cellCount, this.maxCellsPerStep);
    for (let offset = 0; offset < budget; offset += 1) {
      const index = (this.cellCursor + offset) % Math.max(1, cellCount);
      const cell = this.cells.get(this.orderedCellKeys[index]);
      if (cell) active.push(cell);
    }
    if (cellCount) this.cellCursor = (this.cellCursor + budget) % cellCount;
    active.forEach((cell) => this.catchUpCellWeather(cell, this.stepIndex));
    this.applyConservativeFlow(active);
    return { processedCellCount: active.length, processedEventCount: due.length };
  }

  advance(deltaSeconds = 0, forcing = {}) {
    this.accumulatorMs += Math.max(0, Number(deltaSeconds) || 0) * 1000;
    let completedSteps = 0;
    let processedCellCount = 0;
    let processedEventCount = 0;
    while (this.accumulatorMs + 1e-9 >= this.fixedStepMs && completedSteps < this.maxCatchUpSteps) {
      this.accumulatorMs -= this.fixedStepMs;
      const result = this.step(forcing);
      processedCellCount += result.processedCellCount;
      processedEventCount += result.processedEventCount;
      completedSteps += 1;
    }
    return {
      completedSteps,
      stepIndex: this.stepIndex,
      activeCellCount: this.cells.size,
      pendingEventCount: this.pendingEvents.length,
      processedCellCount,
      processedEventCount,
      catchUpRemaining: this.accumulatorMs + 1e-9 >= this.fixedStepMs
    };
  }

  getStoredWaterMm() {
    return quantizeTrackStateNumber([...this.cells.values()].reduce((sum, cell) => (
      sum + WATER_FIELDS.reduce((cellSum, field) => cellSum + Math.max(0, Number(cell[field] || 0)), 0)
    ), 0));
  }

  getConservationTotals() {
    return {
      precipitationMm: quantizeTrackStateNumber(this.totals.precipitationMm),
      drainageMm: quantizeTrackStateNumber(this.totals.drainageMm),
      evaporationMm: quantizeTrackStateNumber(this.totals.evaporationMm),
      storedWaterMm: this.getStoredWaterMm()
    };
  }

  createSnapshot() {
    return createTrackStateSnapshot(this);
  }

  restoreSnapshot(snapshot) {
    return restoreTrackStateSnapshot(this, snapshot);
  }

  getChecksum() {
    return getTrackStateChecksum(this);
  }

  createReplayRecord() {
    const finalSnapshot = this.createSnapshot();
    return {
      version: 1,
      initialSnapshot: this.initialSnapshot,
      initialChecksum: this.initialChecksum,
      events: this.eventHistory.map((event) => ({ ...event, payload: { ...event.payload } })),
      weatherTimeline: [...this.weatherTimeline.entries()]
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([stepIndex, forcing]) => [Number(stepIndex), { ...forcing }]),
      finalStepIndex: this.stepIndex,
      finalChecksum: finalSnapshot.checksum,
      finalSnapshot
    };
  }

  createSyncPacket(kind = 'checksum', { sinceSequence = 0 } = {}) {
    if (kind === 'snapshot') return { type: 'snapshot', snapshot: this.createSnapshot() };
    if (kind === 'events') {
      return {
        type: 'events',
        fromStepIndex: 0,
        toStepIndex: this.stepIndex,
        events: this.eventHistory.filter((event) => event.sequence > Number(sinceSequence || 0)),
        weatherTimeline: [...this.weatherTimeline.entries()]
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([stepIndex, forcing]) => [Number(stepIndex), { ...forcing }])
      };
    }
    return { type: 'checksum', stepIndex: this.stepIndex, checksum: this.getChecksum() };
  }

  applySyncPacket(packet = {}) {
    if (packet.type === 'snapshot') {
      this.restoreSnapshot(packet.snapshot);
      this.initialSnapshot = this.createSnapshot();
      this.initialChecksum = this.initialSnapshot.checksum;
      return { applied: true, type: 'snapshot' };
    }
    if (packet.type === 'events') {
      let appliedCount = 0;
      let duplicateCount = 0;
      (packet.events || []).forEach((event) => {
        if (this.eventIds.has(event.id)) duplicateCount += 1;
        else if (this.queueEvent(event)) appliedCount += 1;
      });
      (packet.weatherTimeline || []).forEach(([stepIndex, forcing]) => {
        this.weatherTimeline.set(Number(stepIndex), normalizeForcing(forcing));
      });
      return { applied: true, type: 'events', appliedCount, duplicateCount };
    }
    if (packet.type === 'checksum') {
      return {
        applied: false,
        type: 'checksum',
        matches: Number(packet.stepIndex) === this.stepIndex && String(packet.checksum) === this.getChecksum()
      };
    }
    return { applied: false, type: String(packet.type || 'unknown') };
  }

  getVisualCells(bounds = null) {
    return [...this.cells.values()]
      .filter((cell) => !bounds
        || (cell.worldX >= bounds.minX && cell.worldX <= bounds.maxX
          && cell.worldZ >= bounds.minZ && cell.worldZ <= bounds.maxZ))
      .sort((a, b) => compareTrackStateCellKeys(a.key, b.key))
      .map((cell) => {
        const sample = getTrackStateCellSample(cell, this.stepIndex);
        return {
          key: cell.key,
          x: cell.worldX,
          z: cell.worldZ,
          elevationM: cell.elevationM,
          effectiveGrip: sample.effectiveGrip,
          ...sample.visual
        };
      });
  }

  getDebugState(bounds = null) {
    return {
      stepIndex: this.stepIndex,
      activeCellCount: this.cells.size,
      pendingEventCount: this.pendingEvents.length,
      appliedEventCount: this.eventHistory.length,
      checksum: this.getChecksum(),
      totals: this.getConservationTotals(),
      cells: bounds ? this.getVisualCells(bounds) : undefined
    };
  }
}
