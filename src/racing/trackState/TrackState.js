import { cloneTrackStateCheckpointCell } from './TrackStateCheckpointCell.js';
import { indexTrackStateCell, queryTrackStateCells } from './TrackStateSpatialIndex.js';
import {
  clamp,
  compareTrackStateCellKeys,
  getTrackStateCellCenter,
  getTrackStateCellCoordinates,
  getTrackStateCellKey,
  quantizeTrackStateNumber
} from './TrackStateMath.js';
import {
  clampTrackStateCell,
  clampTrackStateWeatherFields,
  isCanonicalWeatherCell,
  createTrackStateCell,
  getTrackStateCellSample
} from './TrackStateCell.js';
import {
  compareTrackStateEvents,
  normalizeTrackStateEvent,
  normalizeAccumulatedTireContactEvent
} from './TrackStateEvents.js';
import {
  createIncrementalTrackStateHash,
  createDeferredChecksumSnapshot,
  createTrackStateSnapshot,
  getTrackStateCanonicalPayload,
  getTrackStateChecksum,
  restoreTrackStateSnapshot
} from './TrackStateSerialization.js';
import { TrackStateContactAccumulator } from './TrackStateContactAccumulator.js';

const WATER_FIELDS = ['moistureDepthMm', 'standingWaterDepthMm', 'snowDepthMm', 'iceDepthMm'];
const WEATHER_STATE_FIELDS = ['surfaceTemperatureC', ...WATER_FIELDS];
const WEATHER_PROFILE_FIELDS = [...WEATHER_STATE_FIELDS, 'sunExposure', 'windExposure',
  'heatResponse', 'permeability', 'saturationDepthMm', 'drainageRateMmPerS', 'compaction',
  'initializedStep', 'lastUpdatedStep'];
export const TRACK_STATE_EVENT_HISTORY_LIMIT = 8192;
// Runtime weather budgeting is shared by render-thread and worker authorities.
// Budgeted snapshots include optional scheduling state; older snapshots remain valid.
export const RUNTIME_TRACK_STATE_CHECKPOINT_OPTIONS = Object.freeze({
  maxWeatherStepsPerStep: 2048,
  checkpointHashMode: 'deferred',
  checkpointTargetCaptureSlices: 120,
  checkpointMaximumCaptureCells: 64,
  checkpointAssemblyCellsPerStep: 1024
});
const NEIGHBORS = Object.freeze([
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 }
]);

function normalizeForcing(forcing = {}, target = null) {
  const type = String(forcing.type || forcing.id || 'clear');
  const output = target && typeof target === 'object' ? target : {};
  output.type = type;
  output.precipitationRateMmPerS = quantizeTrackStateNumber(Math.max(
    0, Number(forcing.precipitationRateMmPerS) || 0
  ));
  output.ambientTemperatureC = quantizeTrackStateNumber(
    Number.isFinite(Number(forcing.ambientTemperatureC))
      ? Number(forcing.ambientTemperatureC)
      : type === 'snow' ? -4 : type === 'storm' ? 13 : type === 'rain' ? 16 : 22
  );
  output.sunIntensity = quantizeTrackStateNumber(clamp(
    Number(forcing.sunIntensity) || 0, 0, 1
  ));
  output.windIntensity = quantizeTrackStateNumber(clamp(
    Number(forcing.windIntensity) || 0, 0, 1
  ));
  output.windDirectionRad = quantizeTrackStateNumber(Number(forcing.windDirectionRad) || 0);
  output.humidity = quantizeTrackStateNumber(clamp(
    Number.isFinite(Number(forcing.humidity)) ? Number(forcing.humidity) : 0.5, 0, 1
  ));
  return output;
}

function weatherForcingEqual(left, right) {
  return Boolean(left && right
    && left.type === right.type
    && left.precipitationRateMmPerS === right.precipitationRateMmPerS
    && left.ambientTemperatureC === right.ambientTemperatureC
    && left.sunIntensity === right.sunIntensity
    && left.windIntensity === right.windIntensity
    && left.windDirectionRad === right.windDirectionRad
    && left.humidity === right.humidity);
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
    maxCellsPerStep = 512,
    maxWeatherStepsPerStep = Infinity,
    checkpointCellsPerStep = 16,
    checkpointAssemblyCellsPerStep = checkpointCellsPerStep,
    checkpointTargetCaptureSlices = 0,
    checkpointMaximumCaptureCells = 512,
    checkpointHashMode = 'incremental',
    checkpointHashCharactersPerStep = 32768
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
    this.maxWeatherStepsPerStep = Number.isFinite(maxWeatherStepsPerStep)
      ? Math.max(1, Math.trunc(maxWeatherStepsPerStep)) : Infinity;
    this.checkpointCellsPerStep = Math.max(1, Math.trunc(Number(checkpointCellsPerStep) || 16));
    this.checkpointAssemblyCellsPerStep = Math.max(1, Math.trunc(Number(checkpointAssemblyCellsPerStep) || this.checkpointCellsPerStep));
    this.checkpointMaximumCaptureCells = Math.max(1, Math.trunc(Number(checkpointMaximumCaptureCells) || 512));
    this.checkpointTargetCaptureSlices = Math.max(0, Math.trunc(Number(checkpointTargetCaptureSlices) || 0));
    this.checkpointHashMode = checkpointHashMode === 'deferred' ? 'deferred' : 'incremental';
    this.checkpointHashCharactersPerStep = Math.max(
      256,
      Math.trunc(Number(checkpointHashCharactersPerStep) || 32768)
    );
    this.stepIndex = 0;
    this.nextSequence = 1;
    this.accumulatorMs = 0;
    this.cells = new Map();
    this.cellSampleRevisions = new WeakMap();
    this.visualDirtyKeys = new Set();
    this.visualCellRevisions = new Map();
    this.visualRevision = 0;
    this.cellLookupRevision = 0;
    this.baseSurfaceCache = new Map();
    this.preparedBaseSurfaces = new Map();
    this.orderedCellKeys = [];
    this.cellCursor = 0;
    this.pendingEvents = [];
    this.pendingEventsDirty = false;
    this.eventHistory = [];
    this.eventIds = new Set();
    this.staleEventIds = new Set();
    this.contactAccumulator = new TrackStateContactAccumulator(this);
    this.carryByTire = new Map();
    this.weatherTimeline = new Map();
    this.normalizedForcingScratch = {};
    this.activeCellsScratch = [];
    this.activeCellKeyScratch = new Set();
    this.flowCellsScratch = [];
    this.flowDeltaByKey = new Map();
    this.flowDeltaKeysScratch = [];
    this.environmentActiveKeys = [];
    this.environmentActiveKeySet = new Set();
    this.environmentCellCursor = 0;
    this.maintenanceKeys = [];
    this.maintenanceKeySet = new Set();
    this.maintenanceCursor = 0;
    this.weatherWakeIterator = null;
    this.weatherWakeRemaining = 0;
    this.weatherWakeTotal = 0;
    this.weatherWakeKeys = null;
    this.checkpointBuilder = null;
    this.receiverCoordsScratch = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }];
    this.receiverCellsScratch = [];
    this.performanceCounters = {
      backgroundWeatherSteps: 0,
      aheadWeatherPreparationSteps: 0,
      aheadWeatherPreparationSlices: 0,
      weatherReplayCacheHits: 0,
      weatherReplayCacheMisses: 0,
      weatherReplayReusedSteps: 0,
      weatherCatchUpRequestedSteps: 0,
      weatherCatchUpMaxSteps: 0,
      receiverCellsCreated: 0,
      flowBufferHighWater: 0,
      maintenancePreparedCellCount: 0,
      checkpointCompletedCount: 0,
      checkpointMaximumEventOverage: 0,
      checkpointMaximumSliceMs: 0
    };
    this.stepResultScratch = {
      processedCellCount: 0,
      processedEventCount: 0,
      environmentActiveCellCount: 0
    };
    this.lastWeatherForcing = null;
    this.historyBaseStepIndex = 0;
    this.historyBaseSequence = 0;
    this.historyBaseSnapshot = null;
    this.totals = {
      precipitationMm: 0,
      drainageMm: 0,
      evaporationMm: 0
    };
    this.initialSnapshot = null;
    this.initialChecksum = '';
    if (snapshot) restoreTrackStateSnapshot(this, snapshot);
    this.rebuildDerivedRuntimeState();
    this.restoreWeatherSchedule(snapshot);
    this.initialSnapshot = createTrackStateSnapshot(this);
    this.initialChecksum = this.initialSnapshot.checksum;
    this.historyBaseSnapshot = this.initialSnapshot;
  }

  static fromSnapshot(snapshot, options = {}) {
    return new TrackState({ ...options, snapshot });
  }

  get simulationTimeMs() {
    return this.stepIndex * this.fixedStepMs;
  }

  insertEnvironmentActiveKey(key) {
    if (this.environmentActiveKeySet.has(key)) return;
    const cell = this.cells.get(key);
    let low = 0;
    let high = this.environmentActiveKeys.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      const otherKey = this.environmentActiveKeys[middle];
      const other = this.cells.get(otherKey);
      // Coordinates already exist on the cells. Avoid splitting/parsing both
      // string keys (and allocating arrays) on every binary-search comparison.
      const order = cell && other ? other.x - cell.x || other.z - cell.z
        : compareTrackStateCellKeys(otherKey, key);
      if (order < 0) low = middle + 1;
      else high = middle;
    }
    this.environmentActiveKeys.splice(low, 0, key);
    this.environmentActiveKeySet.add(key);
  }

  removeEnvironmentActiveKey(key) {
    if (!this.environmentActiveKeySet.delete(key)) return;
    const index = this.environmentActiveKeys.indexOf(key);
    if (index < 0) return;
    this.environmentActiveKeys.splice(index, 1);
    if (index < this.environmentCellCursor) this.environmentCellCursor -= 1;
    if (this.environmentCellCursor >= this.environmentActiveKeys.length) this.environmentCellCursor = 0;
  }

  cellNeedsEnvironmentWork(cell, forcing = this.lastWeatherForcing) {
    if (!cell || !forcing) return false;
    if (forcing.precipitationRateMmPerS > 0) return true;
    if (cell.moistureDepthMm > 0 || cell.standingWaterDepthMm > 0
      || cell.snowDepthMm > 0 || cell.iceDepthMm > 0) return true;
    const equilibrium = forcing.ambientTemperatureC
      + forcing.sunIntensity * cell.sunExposure * 18
      - forcing.windIntensity * cell.windExposure * 3.5;
    return Math.abs(cell.surfaceTemperatureC - equilibrium) > 0.000001;
  }

  refreshEnvironmentActivity(cell, forcing = this.lastWeatherForcing) {
    if (this.cellNeedsEnvironmentWork(cell, forcing)) this.insertEnvironmentActiveKey(cell.key);
    else this.removeEnvironmentActiveKey(cell.key);
  }

  rebuildDerivedRuntimeState() {
    this.newDryCellWeatherCache = null;
    this.environmentActiveKeys.length = 0;
    this.environmentActiveKeySet.clear();
    this.environmentCellCursor = 0;
    this.maintenanceKeys.length = 0;
    this.maintenanceKeySet.clear();
    this.maintenanceCursor = 0;
    this.weatherWakeIterator = null;
    this.weatherWakeRemaining = 0;
    this.weatherWakeTotal = 0;
    this.weatherWakeKeys = null;
    this.checkpointBuilder = null;
    this.orderedCellKeys.forEach((key) => {
      const cell = this.cells.get(key);
      if (this.cellNeedsEnvironmentWork(cell)) this.insertEnvironmentActiveKey(key);
    });
  }

  getWeatherScheduleSnapshot() {
    const remaining = this.weatherWakeRemaining;
    return {
      maxWeatherStepsPerStep: this.maxWeatherStepsPerStep,
      cellInsertionKeys: [...this.cells.keys()],
      environmentCellCursor: this.environmentCellCursor,
      environmentActiveKeys: [...this.environmentActiveKeys],
      maintenanceKeys: [...this.maintenanceKeys],
      maintenanceCursor: this.maintenanceCursor,
      wakeKeys: remaining > 0
        ? (this.weatherWakeKeys || [...this.cells.keys()]).slice(
          this.weatherWakeTotal - remaining, this.weatherWakeTotal) : []
    };
  }

  restoreWeatherSchedule(snapshot) {
    const schedule = snapshot?.weatherSchedule;
    if (!schedule) return;
    this.maxWeatherStepsPerStep = Math.max(1, Math.trunc(Number(schedule.maxWeatherStepsPerStep) || 2048));
    const ordered = new Map();
    for (const key of schedule.cellInsertionKeys || []) if (this.cells.has(key)) ordered.set(key, this.cells.get(key));
    for (const [key, cell] of this.cells) if (!ordered.has(key)) ordered.set(key, cell);
    this.cells = ordered;
    this.environmentActiveKeys = (schedule.environmentActiveKeys || []).filter(key => this.cells.has(key));
    this.environmentActiveKeySet = new Set(this.environmentActiveKeys);
    this.maintenanceKeys = (schedule.maintenanceKeys || []).filter(key => this.cells.has(key));
    this.maintenanceCursor = Math.max(0, Math.trunc(Number(schedule.maintenanceCursor) || 0));
    this.maintenanceKeySet = new Set(this.maintenanceKeys.slice(this.maintenanceCursor));
    this.environmentCellCursor = this.environmentActiveKeys.length
      ? Math.max(0, Math.trunc(Number(schedule.environmentCellCursor) || 0)) % this.environmentActiveKeys.length : 0;
    this.weatherWakeKeys = (schedule.wakeKeys || []).filter(key => this.cells.has(key));
    this.weatherWakeTotal = this.weatherWakeRemaining = this.weatherWakeKeys.length;
    this.weatherWakeIterator = this.weatherWakeKeys.map(key => this.cells.get(key)).values();
  }

  queueMaintenancePreparation(cell) {
    if (!cell || this.maintenanceKeySet.has(cell.key)) return;
    this.maintenanceKeySet.add(cell.key);
    this.maintenanceKeys.push(cell.key);
  }

  runMaintenancePreparationSlice(limit = 16) {
    let prepared = 0;
    while (prepared < limit && this.maintenanceCursor < this.maintenanceKeys.length) {
      const key = this.maintenanceKeys[this.maintenanceCursor];
      this.maintenanceCursor += 1;
      this.maintenanceKeySet.delete(key);
      this.refreshEnvironmentActivity(this.cells.get(key));
      prepared += 1;
    }
    if (this.maintenanceCursor >= this.maintenanceKeys.length) {
      this.maintenanceKeys.length = 0;
      this.maintenanceCursor = 0;
    }
    this.performanceCounters.maintenancePreparedCellCount += prepared;
    return prepared;
  }

  beginCheckpointPreparation() {
    if (this.checkpointBuilder || !Number.isFinite(this.eventHistoryLimit)) return;
    this.checkpointBuilder = {
      phase: 'capture',
      frozen: false,
      pendingKeys: [...this.orderedCellKeys],
      pendingKeySet: new Set(this.orderedCellKeys),
      pendingCursor: 0,
      cellCopies: new Map(),
      targetKeys: null,
      targetKeySet: null,
      targetPayload: null,
      targetSequence: 0,
      assemblyCursor: 0,
      minimumCellUpdatedStep: Infinity,
      hashTask: null
    };
  }

  queueCheckpointCell(key) {
    const builder = this.checkpointBuilder;
    if (!builder || builder.frozen || builder.pendingKeySet.has(key)) return;
    builder.pendingKeySet.add(key);
    builder.pendingKeys.push(key);
  }

  prepareCellMutation(cell, revisionCount = 1) {
    if (cell) {
      this.cellSampleRevisions.set(
        cell, Number(this.cellSampleRevisions.get(cell) || 0) + revisionCount
      );
      this.visualRevision += revisionCount;
      this.visualCellRevisions.set(cell.key, this.visualRevision);
      this.visualDirtyKeys.add(cell.key);
    }
    const builder = this.checkpointBuilder;
    if (!cell || !builder) return;
    if (!builder.frozen) {
      if (builder.cellCopies.delete(cell.key)) this.queueCheckpointCell(cell.key);
      return;
    }
    if (builder.targetKeySet?.has(cell.key) && !builder.cellCopies.has(cell.key)) {
      builder.cellCopies.set(cell.key, cloneTrackStateCheckpointCell(cell));
      builder.pendingKeySet.delete(cell.key);
    }
  }

  freezeCheckpointTarget() {
    const builder = this.checkpointBuilder;
    if (!builder || builder.frozen) return;
    builder.frozen = true;
    builder.targetKeys = [...this.orderedCellKeys];
    builder.targetKeySet = new Set(builder.targetKeys);
    builder.targetSequence = this.eventHistory.reduce(
      (highest, event) => Math.max(highest, Number(event.sequence || 0)),
      this.historyBaseSequence
    );
    builder.targetPayload = getTrackStateCanonicalPayload(this, {
      includeEventHistory: false,
      includeWeatherTimeline: true,
      cellSnapshots: []
    });
    builder.targetPayload.historyBaseStepIndex = builder.targetPayload.stepIndex;
    builder.targetPayload.historyBaseSequence = builder.targetSequence;
    for (let index = 0; index < builder.targetKeys.length; index += 1) {
      const key = builder.targetKeys[index];
      if (!builder.cellCopies.has(key) && !builder.pendingKeySet.has(key)) {
        builder.pendingKeySet.add(key);
        builder.pendingKeys.push(key);
      }
    }
  }

  commitCheckpointBuilder() {
    const builder = this.checkpointBuilder;
    const deferred = this.checkpointHashMode === 'deferred' && builder?.phase === 'ready';
    if (!deferred && !builder?.hashTask?.done) return false;
    this.historyBaseStepIndex = builder.targetPayload.stepIndex;
    this.historyBaseSequence = builder.targetSequence;
    this.historyBaseSnapshot = deferred
      ? createDeferredChecksumSnapshot(builder.targetPayload)
      : {...builder.targetPayload, checksum: builder.hashTask.checksum};
    let retainedCount = 0;
    for (let index = 0; index < this.eventHistory.length; index += 1) {
      const event = this.eventHistory[index];
      if (Number(event.sequence || 0) > builder.targetSequence) {
        this.eventHistory[retainedCount] = event;
        retainedCount += 1;
      }
    }
    this.eventHistory.length = retainedCount;
    this.eventIds = new Set([
      ...this.pendingEvents.map((event) => event.id),
      ...this.eventHistory.map((event) => event.id)
    ]);
    this.staleEventIds.clear();
    this.performanceCounters.checkpointCompletedCount += 1;
    this.checkpointBuilder = null;
    return true;
  }

  serviceCheckpointSlice({ allowFreeze = true } = {}) {
    const sliceStart = globalThis.performance?.now?.() || 0;
    const prepareAt = Math.max(1, Math.floor(this.eventHistoryLimit * 0.75));
    if (!this.checkpointBuilder && Number.isFinite(this.eventHistoryLimit)
      && this.eventHistory.length >= prepareAt) this.beginCheckpointPreparation();
    const builder = this.checkpointBuilder;
    if (!builder) return false;
    if (allowFreeze && !builder.frozen && this.eventHistory.length >= this.eventHistoryLimit) {
      this.freezeCheckpointTarget();
    }
    if (builder.phase === 'capture') {
      let visited = 0;
      const adaptiveBudget = this.checkpointTargetCaptureSlices > 0
        ? Math.min(this.checkpointMaximumCaptureCells, Math.ceil((builder.targetKeys?.length || builder.pendingKeys.length)
          / this.checkpointTargetCaptureSlices)) : 0;
      const copyBudget = Math.max(this.checkpointCellsPerStep, adaptiveBudget);
      while (visited < copyBudget
        && builder.pendingCursor < builder.pendingKeys.length) {
        const key = builder.pendingKeys[builder.pendingCursor];
        builder.pendingCursor += 1;
        visited += 1;
        if (!builder.pendingKeySet.delete(key) || builder.cellCopies.has(key)) continue;
        if (builder.frozen && !builder.targetKeySet.has(key)) continue;
        const cell = this.cells.get(key);
        if (cell) builder.cellCopies.set(key, cloneTrackStateCheckpointCell(cell));
      }
      if (builder.frozen && builder.cellCopies.size >= builder.targetKeys.length) {
        builder.targetPayload.cells = new Array(builder.targetKeys.length);
        builder.phase = 'assemble';
      }
    }
    else if (builder.phase === 'assemble') {
      const end = Math.min(
        builder.targetKeys.length,
        builder.assemblyCursor + this.checkpointAssemblyCellsPerStep
      );
      for (; builder.assemblyCursor < end; builder.assemblyCursor += 1) {
        const key = builder.targetKeys[builder.assemblyCursor];
        const cell = builder.cellCopies.get(key);
        builder.targetPayload.cells[builder.assemblyCursor] = cell;
        builder.minimumCellUpdatedStep = Math.min(
          builder.minimumCellUpdatedStep,
          Number(cell?.lastUpdatedStep || 0)
        );
      }
      if (builder.assemblyCursor >= builder.targetKeys.length) {
        if (Number.isFinite(builder.minimumCellUpdatedStep)) {
          let baseline = null;
          const targetRetained = [];
          for (const entry of builder.targetPayload.weatherTimeline) {
            if (Number(entry[0]) <= builder.minimumCellUpdatedStep) baseline = entry;
            else targetRetained.push(entry);
          }
          builder.targetPayload.weatherTimeline = baseline
            ? [baseline, ...targetRetained]
            : targetRetained;
          let liveBaseline = null;
          const liveRetained = [];
          for (const entry of this.weatherTimeline.entries()) {
            if (Number(entry[0]) <= builder.minimumCellUpdatedStep) liveBaseline = entry;
            else liveRetained.push(entry);
          }
          this.weatherTimeline = new Map(
            liveBaseline ? [liveBaseline, ...liveRetained] : liveRetained
          );
        }
        if (this.checkpointHashMode === 'deferred') builder.phase = 'ready';
        else {
          builder.hashTask = createIncrementalTrackStateHash(builder.targetPayload);
          builder.phase = 'hash';
        }
      }
    }
    else if (builder.phase === 'hash') {
      builder.hashTask.process(this.checkpointHashCharactersPerStep);
      if (builder.hashTask.done) builder.phase = 'ready';
    }
    else if (builder.phase === 'ready') this.commitCheckpointBuilder();
    this.performanceCounters.checkpointMaximumEventOverage = Math.max(
      this.performanceCounters.checkpointMaximumEventOverage,
      Math.max(0, this.eventHistory.length - this.eventHistoryLimit)
    );
    if (sliceStart) {
      this.performanceCounters.checkpointMaximumSliceMs = Math.max(
        this.performanceCounters.checkpointMaximumSliceMs,
        (globalThis.performance?.now?.() || sliceStart) - sliceStart
      );
    }
    return true;
  }

  getCell(pointOrCoords = {}, { create = false } = {}) {
    const coords = Number.isInteger(pointOrCoords.x) && Number.isInteger(pointOrCoords.z)
      ? { x: pointOrCoords.x, z: pointOrCoords.z }
      : getTrackStateCellCoordinates(pointOrCoords, this.cellSizeM);
    const key = getTrackStateCellKey(coords);
    return this.cells.get(key) || (create ? this.getOrCreateCell(coords, { coordinates: true }) : null);
  }

  prepareBaseSurface(point = {}) {
    const coords = getTrackStateCellCoordinates(point, this.cellSizeM);
    const key = getTrackStateCellKey(coords);
    if (this.baseSurfaceCache.has(key) || this.preparedBaseSurfaces.has(key)) return;
    const base = this.sampleBaseSurface(getTrackStateCellCenter(coords, this.cellSizeM)) || {};
    if (this.preparedBaseSurfaces.size >= 256) {
      this.preparedBaseSurfaces.delete(this.preparedBaseSurfaces.keys().next().value);
    }
    this.preparedBaseSurfaces.set(key, base);
  }

  getBaseSurfaceForCoordinates(coords = {}) {
    const key = getTrackStateCellKey(coords);
    if (this.baseSurfaceCache.has(key)) return this.baseSurfaceCache.get(key);
    const center = getTrackStateCellCenter(coords, this.cellSizeM);
    const base = this.preparedBaseSurfaces.get(key) || this.sampleBaseSurface(center) || {};
    this.preparedBaseSurfaces.delete(key);
    this.baseSurfaceCache.set(key, base);
    return base;
  }

  getOrCreateCell(pointOrCoords = {}, {
    coordinates = false,
    throughStep = this.stepIndex
  } = {}) {
    // Existing cells are the hot path. Do not allocate a coordinate record
    // or perform a second hash lookup until a cell actually needs creation.
    const size = Math.max(.001, Number(this.cellSizeM) || 1);
    const x = coordinates ? Math.trunc(Number(pointOrCoords.x) || 0) : Math.floor(Number(pointOrCoords.x || 0) / size);
    const z = coordinates ? Math.trunc(Number(pointOrCoords.z) || 0) : Math.floor(Number(pointOrCoords.z ?? pointOrCoords.y ?? 0) / size);
    const key = getTrackStateCellKey(x, z);
    const existing = this.cells.get(key);
    if (existing) return existing;
    return this.createCellAtCoordinates(x, z, key, throughStep);
  }

  createCellAtCoordinates(x, z, key, throughStep) {
    const coords = {x, z};
    const base = this.getBaseSurfaceForCoordinates(coords);
    const cell = createTrackStateCell({
      ...coords,
      cellSizeM: this.cellSizeM,
      base,
      stepIndex: this.historyBaseStepIndex,
      profileOverrides: this.profileOverrides
    });
    this.cells.set(key, cell);
    indexTrackStateCell(this.cells, key, cell);
    this.queueMaintenancePreparation(cell);
    this.queueCheckpointCell(key);
    let low = 0;
    let high = this.orderedCellKeys.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      const other = this.cells.get(this.orderedCellKeys[middle]);
      if (other.x < x || (other.x === x && other.z < z)) low = middle + 1;
      else high = middle;
    }
    this.orderedCellKeys.splice(low, 0, key);
    if (low <= this.cellCursor && this.orderedCellKeys.length > 1) this.cellCursor += 1;
    if (Number(throughStep) > this.historyBaseStepIndex && this.weatherTimeline.size) {
      if (!this.catchUpNewDryCellWeather(cell, throughStep)
        && !this.catchUpNewWetCellWeather(cell, throughStep)) this.catchUpCellWeather(cell, throughStep);
    }
    return cell;
  }

  // Newly encountered dry cells share the same temperature evolution for a
  // given exposure/profile. Replay that history once per profile, not once per
  // metre travelled by every car. Wet histories retain the full original path.
  catchUpNewDryCellWeather(cell, throughStep) {
    if ([cell.moistureDepthMm, cell.standingWaterDepthMm, cell.snowDepthMm, cell.iceDepthMm].some(value => value !== 0)) return false;
    if (this.newDryCellWeatherCache?.timeline !== this.weatherTimeline
      || this.newDryCellWeatherCache?.baseStep !== this.historyBaseStepIndex) {
      this.newDryCellWeatherCache = { timeline: this.weatherTimeline, baseStep: this.historyBaseStepIndex, profiles: new Map() };
    }
    const profiles = this.newDryCellWeatherCache.profiles;
    const key = [cell.surfaceTemperatureC, cell.sunExposure, cell.windExposure, cell.heatResponse, cell.initializedStep].join(':');
    let cached = profiles.get(key);
    if (!cached) {
      if (profiles.size >= 128) profiles.delete(profiles.keys().next().value);
      cached = { temperature: cell.surfaceTemperatureC, throughStep: cell.lastUpdatedStep, updatedStep: cell.lastUpdatedStep, wet: false };
      profiles.set(key, cached);
    }
    if (cached.wet || throughStep < cached.throughStep) return false;
    for (let step = cached.throughStep + 1; step <= throughStep; step++) {
      const forcing = this.getWeatherForStep(step);
      if (!forcing) continue;
      if (forcing.precipitationRateMmPerS > 0) { cached.wet = true; return false; }
      const solarTarget = forcing.ambientTemperatureC + forcing.sunIntensity * cell.sunExposure * 18;
      const windCooling = forcing.windIntensity * cell.windExposure * 3.5;
      const temperature = cached.temperature + (solarTarget - windCooling - cached.temperature)
        * clamp(this.fixedStepMs / 1000 * cell.heatResponse, 0, 1);
      cached.temperature = quantizeTrackStateNumber(clamp(Number(temperature) || 0, -80, 120));
      cached.updatedStep = step;
    }
    cached.throughStep = throughStep;
    if (cached.updatedStep > cell.lastUpdatedStep) {
      this.prepareCellMutation(cell);
      cell.surfaceTemperatureC = cached.temperature;
      cell.lastUpdatedStep = cached.updatedStep;
    }
    return true;
  }

  // Only newly created, untouched cells use this cache. Identical weather
  // profiles replay the exact quantized recurrence once. Tire deposits, runoff,
  // and already-existing cells retain their normal independent simulation.
  getNewWetCellWeatherProfile(cell, { preparation = false, throughStep = Infinity } = {}) {
    const cacheName = preparation ? 'preparedWetCellWeatherCache' : 'newWetCellWeatherCache';
    let cache = this[cacheName];
    if (cache?.timeline !== this.weatherTimeline || cache?.baseStep !== this.historyBaseStepIndex) {
      cache = this[cacheName] = { timeline: this.weatherTimeline,
        baseStep: this.historyBaseStepIndex, profiles: new Map() };
    }
    const profiles = cache.profiles;
    const key = WEATHER_PROFILE_FIELDS.map(field => cell[field]).join(':');
    let cached = profiles.get(key);
    if (preparation) {
      const demand = this.newWetCellWeatherCache;
      const existing = demand?.timeline === this.weatherTimeline
        && demand.baseStep === this.historyBaseStepIndex ? demand.profiles.get(key) : null;
      // This path is read-only: the caller returns before advancing an already
      // current profile. Do not duplicate work or evict a demand entry.
      if (existing && existing.throughStep >= throughStep) return existing;
    }
    if (!preparation) {
      const prepared = this.preparedWetCellWeatherCache;
      const candidate = prepared?.timeline === this.weatherTimeline
        && prepared.baseStep === this.historyBaseStepIndex ? prepared.profiles.get(key) : null;
      if (candidate && candidate.throughStep <= throughStep
        && (!cached || candidate.throughStep > cached.throughStep)) {
        if (!cached && profiles.size >= 16) profiles.delete(profiles.keys().next().value);
        profiles.set(key, candidate);
        prepared.profiles.delete(key);
        cached = candidate;
      }
    }
    if (!cached) {
      if (profiles.size >= (preparation ? 4 : 16)) profiles.delete(profiles.keys().next().value);
      cached = { cell: { ...cell }, throughStep: cell.lastUpdatedStep, totals: [],
        stepTotals: { precipitationMm: 0, evaporationMm: 0, drainageMm: 0 } };
      profiles.set(key, cached);
    }
    return cached;
  }

  advanceNewWetCellWeatherProfile(cached, throughStep, maxSteps = Infinity) {
    const endStep = Math.min(throughStep, cached.throughStep + maxSteps);
    const visited = Math.max(0, endStep - cached.throughStep);
    for (let step = cached.throughStep + 1; step <= endStep; step++) {
      const forcing = this.getWeatherForStep(step);
      if (!forcing) continue;
      const totals = cached.stepTotals;
      totals.precipitationMm = totals.evaporationMm = totals.drainageMm = 0;
      this.applyWeatherToCell(cached.cell, forcing, this.fixedStepMs / 1000, step,
        { prepareMutation: false, totals });
      cached.totals.push(totals.precipitationMm, totals.evaporationMm, totals.drainageMm);
    }
    cached.throughStep = endStep;
    return visited;
  }

  // Optional, exact recurrence preparation only. Do not register a cell,
  // publish revisions/totals, or run flow before authoritative cell creation.
  prepareNewCellWeather(point = {}, maxSteps = 32) {
    if (!this.weatherTimeline.size || this.stepIndex <= this.historyBaseStepIndex) {
      return { complete: true, steps: 0 };
    }
    const coords = getTrackStateCellCoordinates(point, this.cellSizeM);
    const key = getTrackStateCellKey(coords);
    if (this.cells.has(key)) return { complete: true, steps: 0 };
    this.prepareBaseSurface(point);
    const base = this.baseSurfaceCache.get(key) || this.preparedBaseSurfaces.get(key) || {};
    const cell = createTrackStateCell({ ...coords, cellSizeM: this.cellSizeM, base,
      stepIndex: this.historyBaseStepIndex, profileOverrides: this.profileOverrides });
    // Tire events may first need the preceding tick. Avoid preparing beyond it.
    const endStep = Math.max(this.historyBaseStepIndex, this.stepIndex - 1);
    const cached = this.getNewWetCellWeatherProfile(cell, { preparation: true, throughStep: endStep });
    if (cached.throughStep >= endStep) return { complete: true, steps: 0 };
    const budget = Math.max(0, Math.min(256, Math.floor(Number(maxSteps) || 0)));
    const steps = this.advanceNewWetCellWeatherProfile(cached, endStep, budget);
    this.performanceCounters.aheadWeatherPreparationSteps += steps;
    this.performanceCounters.aheadWeatherPreparationSlices += 1;
    return { complete: cached.throughStep >= endStep, steps };
  }

  catchUpNewWetCellWeather(cell, throughStep) {
    const endStep = Math.floor(Number(throughStep || 0));
    const cached = this.getNewWetCellWeatherProfile(cell, { throughStep: endStep });
    if (endStep < cached.throughStep) return false;
    this.advanceNewWetCellWeatherProfile(cached, endStep);
    const appliedSteps = cached.totals.length / 3;
    if (!appliedSteps) return true;
    // Retain the original addition order (not a multiplied/rounded aggregate)
    // so checksums and replay totals agree bit-for-bit with per-cell replay.
    for (let index = 0; index < cached.totals.length; index += 3) {
      this.totals.precipitationMm += cached.totals[index];
      this.totals.evaporationMm += cached.totals[index + 1];
      this.totals.drainageMm += cached.totals[index + 2];
    }
    const previousRevision = Number(this.cellSampleRevisions.get(cell) || 0);
    this.prepareCellMutation(cell);
    this.cellSampleRevisions.set(cell, previousRevision + appliedSteps);
    this.visualRevision += appliedSteps - 1;
    this.visualCellRevisions.set(cell.key, this.visualRevision);
    for (const field of WEATHER_STATE_FIELDS) cell[field] = cached.cell[field];
    cell.lastUpdatedStep = cached.cell.lastUpdatedStep;
    return true;
  }

  sample(point = {}, target = null, conditionScratch = null) {
    const cellX = Math.floor(Number(point.x || 0) / this.cellSizeM);
    const cellZ = Math.floor(Number(point.z ?? point.y ?? 0) / this.cellSizeM);
    let cell = null;
    if (conditionScratch
      && conditionScratch.lookupRevision === this.cellLookupRevision
      && conditionScratch.lookupCellX === cellX
      && conditionScratch.lookupCellZ === cellZ) {
      cell = conditionScratch.lookupCell;
    }
    if (!cell) {
      cell = this.getOrCreateCell({ x: cellX, z: cellZ }, { coordinates: true });
      if (conditionScratch) {
        conditionScratch.lookupRevision = this.cellLookupRevision;
        conditionScratch.lookupCellX = cellX;
        conditionScratch.lookupCellZ = cellZ;
        conditionScratch.lookupCell = cell;
      }
    }
    this.catchUpCellWeather(cell, this.stepIndex);
    const sampleRevision = Number(this.cellSampleRevisions.get(cell)) || 0;
    if (target && conditionScratch
      && conditionScratch.sampleCell === cell
      && conditionScratch.sampleRevision === sampleRevision
      && conditionScratch.sampleStepIndex === this.stepIndex) {
      return target;
    }
    // Only intermediate scalar calculations are shared. Keep lookup/result
    // memoization caller-owned, and keep ordinary returned samples independent.
    const calculationScratch = conditionScratch || (this.sampleConditionScratch ||= {
      current: {}, baseline: {}
    });
    const sample = getTrackStateCellSample(cell, this.stepIndex, target, calculationScratch);
    if (conditionScratch) {
      conditionScratch.sampleCell = cell;
      conditionScratch.sampleRevision = sampleRevision;
      conditionScratch.sampleStepIndex = this.stepIndex;
    }
    return sample;
  }

  // With one constant forcing and no water, only temperature can change.
  // Preserve the per-step quantization, but stop once it reaches its fixed
  // point. This avoids replaying every field of old cells on a long dry race.
  catchUpConstantDryCellWeather(cell, startStep, endStep) {
    if (this.weatherTimeline.size !== 1
      || WATER_FIELDS.some(field => cell[field] !== 0)) return false;
    const [forcingStep, forcing] = this.weatherTimeline.entries().next().value;
    if (forcingStep > startStep || forcing.precipitationRateMmPerS > 0) return false;
    const target = forcing.ambientTemperatureC + forcing.sunIntensity * cell.sunExposure * 18
      - forcing.windIntensity * cell.windExposure * 3.5;
    const response = clamp(this.fixedStepMs / 1000 * cell.heatResponse, 0, 1);
    let temperature = cell.surfaceTemperatureC;
    for (let step = startStep; step <= endStep; step++) {
      const next = quantizeTrackStateNumber(clamp(Number(
        temperature + (target - temperature) * response
      ) || 0, -80, 120));
      if (next === temperature) break;
      temperature = next;
    }
    this.prepareCellMutation(cell);
    cell.surfaceTemperatureC = temperature;
    cell.lastUpdatedStep = endStep;
    clampTrackStateCell(cell);
    return true;
  }

  catchUpCellWeather(cell, throughStep = this.stepIndex, maxSteps = Infinity) {
    if (!cell) return 0;
    let appliedSteps = 0;
    const startStep = Math.max(
      Number(cell.initializedStep || 0) + 1,
      Number(cell.lastUpdatedStep || 0) + 1
    );
    const endStep = Math.min(Math.floor(Number(throughStep || 0)), startStep + maxSteps - 1);
    if (startStep > endStep) return 0;
    this.performanceCounters.weatherCatchUpRequestedSteps += endStep - startStep + 1;
    this.performanceCounters.weatherCatchUpMaxSteps = Math.max(this.performanceCounters.weatherCatchUpMaxSteps, endStep - startStep + 1);
    if (this.catchUpConstantDryCellWeather(cell, startStep, endStep)) return endStep - startStep + 1;
    const count = endStep - startStep + 1;
    if (count >= 32) {
      const sharedSteps = this.replaySharedCellWeather(cell, startStep, endStep);
      if (sharedSteps !== null) return sharedSteps;
    }
    let prepared = false;
    // Short replays are the common path for nearby cells. Seek once, then
    // advance through transitions instead of binary-searching every tick.
    const segments = this.getWeatherTimelineIndex();
    let low = 0, high = segments.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (Number(segments[middle][0]) <= startStep) low = middle + 1;
      else high = middle;
    }
    let segment = low - 1;
    for (let stepIndex = startStep; stepIndex <= endStep; stepIndex += 1) {
      while (segment + 1 < segments.length && segments[segment + 1][0] <= stepIndex) segment++;
      const forcing = segment >= 0 ? segments[segment][1] : null;
      if (!forcing) continue;
      // Capture a frozen checkpoint before the first write, once per catch-up.
      // Publish the same total revision count after the contiguous replay.
      if (!prepared) { this.prepareCellMutation(cell); prepared = true; }
      this.applyWeatherToCell(cell, forcing, this.fixedStepMs / 1000, stepIndex, { prepareMutation: false });
      appliedSteps += 1;
    }
    if (appliedSteps > 1) {
      this.cellSampleRevisions.set(cell, this.cellSampleRevisions.get(cell) + appliedSteps - 1);
      this.visualRevision += appliedSteps - 1;
      this.visualCellRevisions.set(cell.key, this.visualRevision);
    }
    return appliedSteps;
  }

  replaySharedCellWeather(cell, startStep, endStep) {
    if (this.debugDisableWeatherReplayCache || this.debugFullWeatherClamp
      || !isCanonicalWeatherCell(cell)) return null;
    const segments = this.getWeatherTimelineIndex();
    // Appended forcing does not change past segments. Keep their exact replay
    // results; replacing history rebuilds this index and invalidates the cache.
    if (this.weatherReplayCache?.timeline !== this.weatherTimeline
      || this.weatherReplayCache?.segments !== segments) {
      this.weatherReplayCache = { timeline: this.weatherTimeline,
        segments,
        entries: new Map(), steps: 0, hits: 0, misses: 0, reusedSteps: 0 };
    }
    const cache = this.weatherReplayCache;
    // Queries near the end of a long race must not walk every old transition.
    // Keep exact segment boundaries and recurrence order after this seek.
    let low = 0, high = segments.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (Number(segments[middle][0]) <= startStep) low = middle + 1;
      else high = middle;
    }
    let segment = Math.max(0, low - 1), appliedSteps = 0, prepared = false;
    const stepTotals = { precipitationMm: 0, evaporationMm: 0, drainageMm: 0 };
    for (let step = startStep; step <= endStep;) {
      while (segment + 1 < segments.length && segments[segment + 1][0] <= step) segment++;
      const entry = segments[segment];
      if (!entry || entry[0] > step) { step = entry ? entry[0] : endStep + 1; continue; }
      const forcing = entry[1];
      // Fixed time boundaries let staggered queries rejoin shared blocks. Never
      // cross a forcing change. Absolute age is not an input to the recurrence.
      const last = Math.min(endStep, Math.ceil(step / 32) * 32,
        segments[segment + 1]?.[0] - 1 || Infinity);
      const count = last - step + 1;
      if (!prepared) { this.prepareCellMutation(cell); prepared = true; }
      // During buildup forcing can change every tick. Hashing/caching those
      // tiny runs costs more than the recurrence itself; resolve the segment
      // once and integrate directly, without a history lookup per tick.
      if (count < 16) {
        for (let tick = step; tick <= last; tick++) {
          this.applyWeatherToCell(cell, forcing, this.fixedStepMs / 1000, tick, { prepareMutation: false });
        }
        appliedSteps += count; step = last + 1; continue;
      }
      const key = `${segment}:${count}:${this.fixedStepMs}:`
        + WEATHER_PROFILE_FIELDS.slice(0, -2).map(field => cell[field]).join(':');
      const cached = cache.entries.get(key);
      if (cached) {
        for (let i = 0; i < cached.totals.length; i += 3) {
          this.totals.precipitationMm += cached.totals[i];
          this.totals.evaporationMm += cached.totals[i + 1];
          this.totals.drainageMm += cached.totals[i + 2];
        }
        for (let i = 0; i < WEATHER_STATE_FIELDS.length; i++) cell[WEATHER_STATE_FIELDS[i]] = cached.values[i];
        cell.lastUpdatedStep = last;
        cache.hits++;
        cache.reusedSteps += count;
        this.performanceCounters.weatherReplayCacheHits++;
        this.performanceCounters.weatherReplayReusedSteps += count;
      } else {
        cache.misses++;
        this.performanceCounters.weatherReplayCacheMisses++;
        const totals = [];
        for (let tick = step; tick <= last; tick++) {
          stepTotals.precipitationMm = stepTotals.evaporationMm = stepTotals.drainageMm = 0;
          this.applyWeatherToCell(cell, forcing, this.fixedStepMs / 1000, tick,
            { prepareMutation: false, totals: stepTotals });
          totals.push(stepTotals.precipitationMm, stepTotals.evaporationMm, stepTotals.drainageMm);
          this.totals.precipitationMm += stepTotals.precipitationMm;
          this.totals.evaporationMm += stepTotals.evaporationMm;
          this.totals.drainageMm += stepTotals.drainageMm;
        }
        while (cache.entries.size >= 1024 || cache.steps + count > 32768) {
          const oldest = cache.entries.keys().next().value;
          cache.steps -= cache.entries.get(oldest).count;
          cache.entries.delete(oldest);
        }
        cache.entries.set(key, { values: WEATHER_STATE_FIELDS.map(field => cell[field]), totals, count });
        cache.steps += count;
      }
      appliedSteps += count;
      step = last + 1;
    }
    if (appliedSteps > 1) {
      this.cellSampleRevisions.set(cell, this.cellSampleRevisions.get(cell) + appliedSteps - 1);
      this.visualRevision += appliedSteps - 1;
      this.visualCellRevisions.set(cell.key, this.visualRevision);
    }
    return appliedSteps;
  }

  mutateCell(pointOrCoords = {}, changes = {}) {
    const coordinates = Number.isInteger(pointOrCoords.x) && Number.isInteger(pointOrCoords.z);
    const cell = this.getOrCreateCell(pointOrCoords, { coordinates });
    this.catchUpCellWeather(cell, this.stepIndex);
    this.prepareCellMutation(cell);
    Object.entries(changes || {}).forEach(([field, value]) => {
      if (field in cell && Number.isFinite(Number(value))) cell[field] = Number(value);
    });
    clampTrackStateCell(cell, true);
    this.refreshEnvironmentActivity(cell);
    return cell;
  }

  queueEvent(rawEvent = {}) {
    const proposedSequence = rawEvent.sequence || this.nextSequence;
    const event = normalizeTrackStateEvent({
      ...rawEvent,
      stepIndex: rawEvent.stepIndex || this.stepIndex + 1,
      sequence: proposedSequence
    }, proposedSequence);
    return this.enqueueNormalizedEvent(event);
  }

  queueAccumulatedTireContact(aggregate) {
    const probe = this.eventQueueProbe;
    const started = probe ? probe.now() : 0;
    const event = normalizeAccumulatedTireContactEvent(
      aggregate, this.nextSequence, aggregate.stepIndex || this.stepIndex + 1
    );
    if (probe) probe.end('normalize', started, this);
    return this.enqueueNormalizedEvent(event);
  }

  enqueueNormalizedEvent(event) {
    const probe = this.eventQueueProbe;
    let started = probe ? probe.now() : 0;
    if (event.stepIndex <= this.historyBaseStepIndex
      || event.sequence <= this.historyBaseSequence
      || this.eventIds.has(event.id)
      || this.staleEventIds.has(event.id)) {
      if (probe) probe.end('lookup', started, this);
      return null;
    }
    this.nextSequence = Math.max(this.nextSequence, event.sequence + 1);
    if (probe) { probe.end('lookup', started, this); started = probe.now(); }
    this.eventIds.add(event.id);
    if (probe) { probe.end('idInsert', started, this); started = probe.now(); }
    this.pendingEvents.push(event);
    this.pendingEventsDirty = true;
    if (probe) probe.end('queueInsert', started, this);
    return event;
  }

  queueTireContact(contact = {}, options = {}) {
    return this.contactAccumulator.accumulate(contact, options);
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

  applyWeatherToCell(cell, forcing, dt, stepIndex, { countTotals = true, prepareMutation = true, totals = this.totals } = {}) {
    if (prepareMutation) this.prepareCellMutation(cell);
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
      if (countTotals) totals.precipitationMm += precipitation;
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
      cell.iceDepthMm += compactFreeze * 0.1; // Approximate 10:1 snow-to-water depth.
    } else if (cell.surfaceTemperatureC > 0.5) {
      const meltCapacity = cell.surfaceTemperatureC * dt * (0.045 + forcing.sunIntensity * cell.sunExposure * 0.08);
      const iceMelt = Math.min(cell.iceDepthMm, meltCapacity * 0.35);
      cell.iceDepthMm -= iceMelt;
      cell.standingWaterDepthMm += iceMelt;
      const snowMelt = Math.min(cell.snowDepthMm, Math.max(0, meltCapacity - iceMelt));
      cell.snowDepthMm -= snowMelt;
      // Snow depth is fluffy snowfall, not an equal depth of liquid water.
      const snowWater = snowMelt * 0.1;
      cell.moistureDepthMm += snowWater * 0.45;
      cell.standingWaterDepthMm += snowWater * 0.55;
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
      totals.evaporationMm += evaporation;
      totals.drainageMm += drainage;
    }
    cell.lastUpdatedStep = stepIndex;
    if (this.debugFullWeatherClamp) clampTrackStateCell(cell);
    else clampTrackStateWeatherFields(cell);
  }

  applyConservativeFlow(sourceCells = this.activeCellsScratch) {
    // The flow graph is comparatively expensive to build and most clear/dry
    // fixed steps cannot transfer any water. Scan the supplied deterministic
    // cell order first so the common path performs no Map/array graph work.
    let hasFlowCandidate = false;
    for (let index = 0; index < sourceCells.length; index += 1) {
      if (Number(sourceCells[index]?.standingWaterDepthMm || 0) > 0.02) {
        hasFlowCandidate = true;
        break;
      }
    }
    if (!hasFlowCandidate) return;
    const deltas = this.flowDeltaByKey;
    const deltaKeys = this.flowDeltaKeysScratch;
    deltas.clear();
    deltaKeys.length = 0;
    const addDelta = (key, amount) => {
      if (!deltas.has(key)) deltaKeys.push(key);
      deltas.set(key, quantizeTrackStateNumber(Number(deltas.get(key) || 0) + amount));
    };
    const sortedCells = this.flowCellsScratch;
    sortedCells.length = sourceCells.length;
    for (let index = 0; index < sourceCells.length; index += 1) sortedCells[index] = sourceCells[index];
    sortedCells.sort((a, b) => a.x - b.x || a.z - b.z);
    sortedCells.forEach((cell) => {
      if (cell.standingWaterDepthMm <= 0.02) return;
      let bestKey = '';
      let bestX = 0;
      let bestZ = 0;
      let bestExisting = null;
      let bestDrop = 0;
      NEIGHBORS.forEach((offset) => {
        const coords = this.receiverCoordsScratch[0];
        coords.x = cell.x + offset.x;
        coords.z = cell.z + offset.z;
        const key = getTrackStateCellKey(coords);
        const existing = this.cells.get(key);
        const elevationM = existing
          ? Number(existing.elevationM || 0)
          : Number(this.getBaseSurfaceForCoordinates(coords)?.elevationM || 0);
        const drop = Number(cell.elevationM || 0) - elevationM;
        if (drop > 0.0001 && drop > bestDrop) {
          bestKey = key;
          bestX = coords.x;
          bestZ = coords.z;
          bestExisting = existing;
          bestDrop = drop;
        }
      });
      if (!bestKey) return;
      // Budgeted background flow may only exchange water between current
      // cells; creating/catching up a receiver here would bypass the budget.
      if (Number.isFinite(this.maxWeatherStepsPerStep)
        && (!bestExisting || bestExisting.lastUpdatedStep < this.stepIndex)) return;
      const coords = this.receiverCoordsScratch[0];
      coords.x = bestX;
      coords.z = bestZ;
      const neighbor = bestExisting || this.getOrCreateCell(coords, { coordinates: true });
      const amount = Math.min(
        cell.standingWaterDepthMm * 0.22,
        Math.max(0, bestDrop * 1000) * 0.04
      );
      if (amount <= 0) return;
      addDelta(cell.key, -amount);
      addDelta(neighbor.key, amount);
    });
    deltaKeys.sort(compareTrackStateCellKeys)
      .forEach((key) => {
        const cell = this.cells.get(key);
        this.prepareCellMutation(cell);
        cell.standingWaterDepthMm += Number(deltas.get(key) || 0);
        clampTrackStateCell(cell);
        this.refreshEnvironmentActivity(cell);
      });
    this.performanceCounters.flowBufferHighWater = Math.max(
      this.performanceCounters.flowBufferHighWater,
      deltaKeys.length
    );
  }

  applyTireContactEvent(event) {
    const payload = event.payload || {};
    if (payload.grounded === false || Number(payload.contactScale ?? 1) <= 0.001) return;
    const cell = this.getOrCreateCell(
      { x: Math.floor(event.x / this.cellSizeM), z: Math.floor(event.z / this.cellSizeM) },
      { coordinates: true, throughStep: this.stepIndex - 1 }
    );
    this.catchUpCellWeather(cell, this.stepIndex - 1);
    this.prepareCellMutation(cell);
    const contactScale = clamp(Number(payload.contactScale ?? 1), 0, 1);
    const distance = Math.max(0, Number(payload.distanceM) || 0);
    const slipEnergy = clamp(Number(payload.slipEnergy ?? payload.slip ?? 0), 0, 4);
    const physicalTotal = (field, fallback) => Math.max(
      0,
      Object.hasOwn(payload, field) ? Number(payload[field]) || 0 : fallback
    );
    const legacySlipWork = Math.max(0, Number(payload.slipWork)
      || Number(payload.normalLoadN || 0) * distance * contactScale * slipEnergy);
    const rollingDistance = physicalTotal('rollingDistanceM', distance);
    const normalImpulse = physicalTotal(
      'normalImpulseNs',
      Number(payload.normalLoadN || 0)
        * Number(payload.groundedContactDurationSeconds ?? payload.contactDurationSeconds ?? 0)
        * contactScale
    );
    const surfaceHeatingWork = physicalTotal('surfaceHeatingWorkJ', legacySlipWork);
    const rubberDepositionWork = physicalTotal(
      'rubberDepositionWorkJ',
      legacySlipWork + Number(payload.normalLoadN || 0) * rollingDistance * contactScale * 0.08
    );
    const waterDisplacementImpulse = physicalTotal(
      'waterDisplacementImpulseNs',
      Number(payload.normalLoadN || 0) * rollingDistance * contactScale
    );
    const looseMaterialSweepWork = physicalTotal(
      'looseMaterialSweepWorkJ',
      Number(payload.normalLoadN || 0) * rollingDistance * contactScale
    );
    const materialPickupCapacity = physicalTotal(
      'materialPickupCapacity',
      Number(payload.normalLoadN || 0) * rollingDistance * contactScale
    );
    const carriedMaterialDepositCapacity = physicalTotal(
      'carriedMaterialDepositCapacity',
      Number(payload.normalLoadN || 0) * rollingDistance * contactScale
    );
    const tireKey = `${event.vehicleId}:${event.wheelId}`;
    const carry = this.carryByTire.get(tireKey) || { dirt: 0, mud: 0, debris: 0 };
    const depositScale = clamp(carriedMaterialDepositCapacity / 12500, 0, 0.42);
    ['dirt', 'mud', 'debris'].forEach((field) => {
      const deposit = Math.min(Number(carry[field] || 0), Number(carry[field] || 0) * depositScale);
      cell[field] += deposit;
      carry[field] -= deposit;
    });
    const pickupScale = clamp(materialPickupCapacity / 36000, 0, 0.32);
    ['dirt', 'mud'].forEach((field) => {
      const pickup = Math.min(Number(cell[field] || 0), Number(cell[field] || 0) * pickupScale);
      cell[field] -= pickup;
      carry[field] = clamp(Number(carry[field] || 0) + pickup, 0, 1);
    });
    const rubberDeposit = rubberDepositionWork
      * 0.00000004
      * clamp(Number(cell.rubberAcceptance ?? 0.25), 0, 1);
    cell.rubber += rubberDeposit;
    cell.surfaceTemperatureC += surfaceHeatingWork * 0.000025;
    const groundedDuration = Math.max(0, Number(payload.groundedContactDurationSeconds || 0));
    const compactionWork = groundedDuration > 0
      ? normalImpulse * rollingDistance / groundedDuration
      : Number(payload.normalLoadN || 0) * rollingDistance * contactScale;
    cell.compaction += Math.max(0, compactionWork) * 0.000000625;

    const displacementScale = clamp(waterDisplacementImpulse / 20000, 0, 0.38);
    const displacedWater = cell.standingWaterDepthMm * displacementScale;
    const sweepScale = clamp(looseMaterialSweepWork / 14000, 0, 0.55);
    const sweptMarbles = cell.looseMarbles * sweepScale;
    const kickedLoose = (cell.dirt + cell.dust) * clamp(sweepScale * 0.16, 0, 0.12);
    const hasReceiverTransfer = displacedWater > 0.0000005
      || sweptMarbles > 0.0000005
      || kickedLoose > 0.0000005;

    if (!hasReceiverTransfer) {
      this.carryByTire.set(tireKey, {
        dirt: quantizeTrackStateNumber(carry.dirt),
        mud: quantizeTrackStateNumber(carry.mud),
        debris: quantizeTrackStateNumber(carry.debris)
      });
      clampTrackStateCell(cell);
      this.refreshEnvironmentActivity(cell);
      return;
    }

    const directionLength = Math.hypot(Number(payload.directionX || 0), Number(payload.directionZ || 0)) || 1;
    const dx = Number(payload.directionX || 0) / directionLength;
    const dz = Number(payload.directionZ || 0) / directionLength;
    const forwardX = Math.abs(dx) >= Math.abs(dz) ? Math.sign(dx) || 1 : 0;
    const forwardZ = Math.abs(dx) >= Math.abs(dz) ? 0 : Math.sign(dz) || 1;
    const sideX = -forwardZ;
    const sideZ = forwardX;
    const receiverCoords = this.receiverCoordsScratch;
    receiverCoords[0].x = cell.x + forwardX;
    receiverCoords[0].z = cell.z + forwardZ;
    receiverCoords[1].x = cell.x + sideX;
    receiverCoords[1].z = cell.z + sideZ;
    receiverCoords[2].x = cell.x - sideX;
    receiverCoords[2].z = cell.z - sideZ;
    const receivers = this.receiverCellsScratch;
    receivers.length = 3;
    for (let index = 0; index < 3; index += 1) {
      const key = getTrackStateCellKey(receiverCoords[index]);
      const existed = this.cells.has(key);
      receivers[index] = this.getOrCreateCell(receiverCoords[index], {
        coordinates: true,
        throughStep: this.stepIndex - 1
      });
      if (!existed) this.performanceCounters.receiverCellsCreated += 1;
    }
    receivers.forEach((receiver) => this.catchUpCellWeather(receiver, this.stepIndex - 1));
    receivers.forEach((receiver) => this.prepareCellMutation(receiver));
    cell.standingWaterDepthMm -= displacedWater;
    receivers.forEach((receiver, index) => {
      receiver.standingWaterDepthMm += displacedWater * (index === 0 ? 0.5 : 0.25);
    });
    cell.looseMarbles -= sweptMarbles;
    receivers[1].looseMarbles += sweptMarbles * 0.5;
    receivers[2].looseMarbles += sweptMarbles * 0.5;
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
    clampTrackStateCell(cell);
    this.refreshEnvironmentActivity(cell);
    receivers.forEach((receiver) => {
      clampTrackStateCell(receiver);
      this.refreshEnvironmentActivity(receiver);
    });
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
    this.prepareCellMutation(cell);
    if (event.type === 'crash-debris' || event.type === 'oil-spill') {
      cell.debris += Math.max(0, Number(event.payload?.debris || 0));
      cell.oil += Math.max(0, Number(event.payload?.oil || 0));
      cell.dirt += Math.max(0, Number(event.payload?.dirt || 0));
      clampTrackStateCell(cell);
      this.refreshEnvironmentActivity(cell);
    }
  }

  getWeatherTimelineIndex() {
    const cached = this.weatherTimelineIndex;
    if (cached?.timeline === this.weatherTimeline && cached.size === this.weatherTimeline.size
      && cached.forcing === this.lastWeatherForcing) return cached.entries;
    const entries = [...this.weatherTimeline.entries()];
    this.weatherTimelineIndex = { timeline: this.weatherTimeline, size: this.weatherTimeline.size,
      forcing: this.lastWeatherForcing, entries };
    return entries;
  }

  getWeatherForStep(stepIndex) {
    // Buildup can record a transition every tick. Walking that entire history
    // for every replayed tick turns catch-up into quadratic work as a race ages.
    const entries = this.getWeatherTimelineIndex();
    let low = 0, high = entries.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (Number(entries[middle][0]) <= Number(stepIndex)) low = middle + 1;
      else high = middle;
    }
    return low ? entries[low - 1][1] : null;
  }

  recordWeatherTransition(stepIndex, forcing) {
    if (!weatherForcingEqual(this.lastWeatherForcing, forcing)) {
      const cached = this.weatherTimelineIndex;
      const oldSize = this.weatherTimeline.size;
      const stored = { ...forcing };
      this.weatherTimeline.set(stepIndex, stored);
      this.lastWeatherForcing = stored;
      if (cached?.timeline === this.weatherTimeline && cached.size === oldSize
        && this.weatherTimeline.size === oldSize + 1
        && (!cached.entries.length || cached.entries.at(-1)[0] < stepIndex)) {
        cached.entries.push([stepIndex, stored]);
        cached.size++; cached.forcing = stored;
      } else this.weatherTimelineIndex = null;
    }
  }

  rotateHistoryCheckpoint(options = {}) {
    return this.serviceCheckpointSlice(options);
  }

  step(forcing = {}, { deferCheckpointRotation = false } = {}) {
    this.contactAccumulator.flushStep(this.stepIndex + 1, { collectEvents: false });
    this.stepIndex += 1;
    const normalizedForcing = normalizeForcing(forcing, this.normalizedForcingScratch);
    const weatherChanged = !weatherForcingEqual(this.lastWeatherForcing, normalizedForcing);
    this.recordWeatherTransition(this.stepIndex, normalizedForcing);
    if (weatherChanged) {
      this.weatherWakeIterator = this.cells.values();
      this.weatherWakeRemaining = this.cells.size;
      this.weatherWakeTotal = this.cells.size;
      this.weatherWakeKeys = null;
    }
    if (this.pendingEventsDirty) {
      this.pendingEvents.sort(compareTrackStateEvents);
      this.pendingEventsDirty = false;
    }
    let dueCount = 0;
    while (dueCount < this.pendingEvents.length
      && this.pendingEvents[dueCount].stepIndex <= this.stepIndex) {
      dueCount += 1;
    }
    for (let index = 0; index < dueCount; index += 1) {
      const event = this.pendingEvents[index];
      this.applyEvent(event);
      this.eventHistory.push(event);
    }
    if (dueCount) {
      this.pendingEvents.copyWithin(0, dueCount);
      this.pendingEvents.length -= dueCount;
    }
    const active = this.activeCellsScratch;
    const activeKeys = this.activeCellKeyScratch;
    active.length = 0;
    activeKeys.clear();
    const cellLimit = Math.min(this.maxCellsPerStep, this.maxWeatherStepsPerStep);
    while (active.length < cellLimit && this.weatherWakeRemaining > 0) {
      const next = this.weatherWakeIterator?.next?.();
      this.weatherWakeRemaining -= 1;
      if (!next || next.done || !next.value) continue;
      active.push(next.value);
      activeKeys.add(next.value.key);
    }
    if (this.weatherWakeRemaining <= 0) this.weatherWakeIterator = null;
    const activeCellCount = this.environmentActiveKeys.length;
    const available = cellLimit - active.length;
    let considered = 0;
    while (considered < activeCellCount && active.length < cellLimit) {
      const index = (this.environmentCellCursor + considered) % Math.max(1, activeCellCount);
      const key = this.environmentActiveKeys[index];
      const cell = this.cells.get(key);
      if (cell && !activeKeys.has(key)) {
        active.push(cell);
        activeKeys.add(key);
      }
      considered += 1;
    }
    if (activeCellCount && available > 0) {
      this.environmentCellCursor = (this.environmentCellCursor + considered) % activeCellCount;
    }
    let remainingWeatherSteps = this.maxWeatherStepsPerStep;
    let completedCells = 0;
    let integratedWeatherSteps = 0;
    const selectedCellCount = active.length;
    for (let index = 0; index < selectedCellCount; index++) {
      const cell = active[index];
      // Share the work allowance across selected cells so one old cell cannot
      // monopolize the tick. Contact reads remain synchronous and current.
      const allowance = Math.floor(remainingWeatherSteps / (selectedCellCount - index));
      const integrated = this.catchUpCellWeather(cell, this.stepIndex, allowance);
      remainingWeatherSteps -= integrated;
      integratedWeatherSteps += integrated;
      this.refreshEnvironmentActivity(cell, normalizedForcing);
      // Never transfer water from a partially integrated, stale cell.
      if (cell.lastUpdatedStep >= this.stepIndex) active[completedCells++] = cell;
    }
    active.length = completedCells;
    this.applyConservativeFlow(active);
    if (!deferCheckpointRotation) this.rotateHistoryCheckpoint();
    this.stepResultScratch.processedCellCount = selectedCellCount;
    this.stepResultScratch.weatherIntegrationSteps = integratedWeatherSteps;
    this.performanceCounters.backgroundWeatherSteps += integratedWeatherSteps;
    this.stepResultScratch.processedEventCount = dueCount;
    this.stepResultScratch.environmentActiveCellCount = this.environmentActiveKeys.length;
    return this.stepResultScratch;
  }

  advance(deltaSeconds = 0, forcing = {}, target = null) {
    this.runMaintenancePreparationSlice();
    this.accumulatorMs += Math.max(0, Number(deltaSeconds) || 0) * 1000;
    let completedSteps = 0;
    let processedCellCount = 0;
    let processedEventCount = 0;
    while (this.accumulatorMs + 1e-9 >= this.fixedStepMs && completedSteps < this.maxCatchUpSteps) {
      this.accumulatorMs -= this.fixedStepMs;
      const result = this.step(forcing, { deferCheckpointRotation: true });
      processedCellCount += result.processedCellCount;
      processedEventCount += result.processedEventCount;
      completedSteps += 1;
      const atAdvanceBoundary = completedSteps >= this.maxCatchUpSteps
        || this.accumulatorMs + 1e-9 < this.fixedStepMs;
      this.rotateHistoryCheckpoint({ allowFreeze: atAdvanceBoundary });
    }
    // At 60 Hz, most calls do not reach the 10 Hz surface tick. Use those
    // calls for one bounded checkpoint slice too, so a large field of cars
    // does not retain many seconds of contact events waiting for capture.
    // Freeze only at a completed simulation boundary (above): pending wheel
    // aggregates must remain attached to the same replay checkpoint.
    if (completedSteps === 0 && this.checkpointBuilder) {
      this.rotateHistoryCheckpoint({ allowFreeze: false });
    }
    const result = target || {};
    result.completedSteps = completedSteps;
    result.stepIndex = this.stepIndex;
    result.activeCellCount = this.cells.size;
    result.environmentActiveCellCount = this.environmentActiveKeys.length;
    result.pendingEventCount = this.pendingEvents.length;
    result.processedCellCount = processedCellCount;
    result.processedEventCount = processedEventCount;
    result.receiverCellsCreated = this.performanceCounters.receiverCellsCreated;
    result.flowBufferHighWater = this.performanceCounters.flowBufferHighWater;
    result.maintenancePreparedCellCount = this.performanceCounters.maintenancePreparedCellCount;
    result.weatherWakeRemaining = this.weatherWakeRemaining;
    result.checkpointPhase = this.checkpointBuilder?.phase || 'idle';
    result.checkpointTargetStep = this.checkpointBuilder?.targetPayload?.stepIndex || 0;
    result.checkpointPendingCells = this.checkpointBuilder?.frozen
      ? Math.max(0, this.checkpointBuilder.targetKeys.length - this.checkpointBuilder.cellCopies.size)
      : this.checkpointBuilder?.pendingKeySet?.size || 0;
    result.checkpointHashCharacters = this.checkpointBuilder?.hashTask?.processedCharacters || 0;
    result.checkpointEventOverage = Math.max(0, this.eventHistory.length - this.eventHistoryLimit);
    result.checkpointCompletedCount = this.performanceCounters.checkpointCompletedCount;
    result.checkpointMaximumSliceMs = this.performanceCounters.checkpointMaximumSliceMs;
    result.catchUpRemaining = this.accumulatorMs + 1e-9 >= this.fixedStepMs;
    return result;
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
    this.preparedBaseSurfaces.clear();
    const restored = restoreTrackStateSnapshot(this, snapshot);
    this.cellLookupRevision += 1;
    this.rebuildDerivedRuntimeState();
    this.restoreWeatherSchedule(snapshot);
    this.visualRevision += 1;
    for (const key of this.orderedCellKeys) {
      this.visualCellRevisions.set(key, this.visualRevision);
      this.visualDirtyKeys.add(key);
    }
    return restored;
  }

  getChecksum() {
    return getTrackStateChecksum(this);
  }

  getWeatherTimelineAfterHistoryBase() {
    const entries = [...this.weatherTimeline.entries()]
      .filter(([stepIndex]) => Number(stepIndex) > this.historyBaseStepIndex)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([stepIndex, forcing]) => [Number(stepIndex), { ...forcing }]);
    const firstReplayStep = this.historyBaseStepIndex + 1;
    if (!entries.length || entries[0][0] > firstReplayStep) {
      const forcing = this.getWeatherForStep(this.historyBaseStepIndex);
      if (forcing) entries.unshift([firstReplayStep, { ...forcing }]);
    }
    return entries;
  }

  createReplayRecord() {
    const finalSnapshot = this.createSnapshot();
    return {
      version: 2,
      historyBaseSnapshot: this.historyBaseSnapshot,
      historyBaseStepIndex: this.historyBaseStepIndex,
      historyBaseSequence: this.historyBaseSequence,
      initialSnapshot: this.historyBaseSnapshot,
      initialChecksum: this.historyBaseSnapshot.checksum,
      events: this.eventHistory.map((event) => ({ ...event, payload: { ...event.payload } })),
      weatherTimeline: this.getWeatherTimelineAfterHistoryBase(),
      finalStepIndex: this.stepIndex,
      finalChecksum: finalSnapshot.checksum,
      finalSnapshot
    };
  }

  createSyncPacket(kind = 'checksum', { sinceSequence = 0 } = {}) {
    if (kind === 'snapshot') {
      return {
        type: 'snapshot',
        snapshot: this.createSnapshot(),
        historyBaseSnapshot: this.historyBaseSnapshot
      };
    }
    if (kind === 'events') {
      if (Number(sinceSequence || 0) < this.historyBaseSequence) {
        return {
          type: 'events',
          snapshotRequired: true,
          historyBaseStepIndex: this.historyBaseStepIndex,
          historyBaseSequence: this.historyBaseSequence,
          checkpointChecksum: this.historyBaseSnapshot?.checksum || ''
        };
      }
      return {
        type: 'events',
        snapshotRequired: false,
        fromStepIndex: this.historyBaseStepIndex,
        toStepIndex: this.stepIndex,
        historyBaseSequence: this.historyBaseSequence,
        checkpointChecksum: this.historyBaseSnapshot?.checksum || '',
        checksum: this.getChecksum(),
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
      this.historyBaseSnapshot = packet.historyBaseSnapshot || this.initialSnapshot;
      return { applied: true, type: 'snapshot' };
    }
    if (packet.type === 'events') {
      if (packet.snapshotRequired) {
        return { applied: false, type: 'events', snapshotRequired: true };
      }
      if (packet.checkpointChecksum
        && String(packet.checkpointChecksum) !== String(this.historyBaseSnapshot?.checksum || '')) {
        return { applied: false, type: 'events', snapshotRequired: true, checkpointMismatch: true };
      }
      let appliedCount = 0;
      let duplicateCount = 0;
      let staleCount = 0;
      (packet.events || []).forEach((event) => {
        if (Number(event.stepIndex || 0) <= this.historyBaseStepIndex
          || Number(event.sequence || 0) <= this.historyBaseSequence) staleCount += 1;
        else if (this.eventIds.has(event.id)) duplicateCount += 1;
        else if (this.queueEvent(event)) appliedCount += 1;
      });
      const weatherEntries = [
        ...this.weatherTimeline.entries(),
        ...(packet.weatherTimeline || []).map(([stepIndex, forcing]) => [
          Number(stepIndex),
          normalizeForcing(forcing)
        ])
      ].sort(([left], [right]) => Number(left) - Number(right));
      this.weatherTimeline = new Map(weatherEntries);
      const checksumMatches = packet.checksum && Number(packet.toStepIndex) === this.stepIndex
        ? String(packet.checksum) === this.getChecksum()
        : null;
      return {
        applied: checksumMatches !== false,
        type: 'events',
        appliedCount,
        duplicateCount,
        staleCount,
        checksumMatches
      };
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

  getVisualCells(bounds = null, {maximumCells = Infinity, centerX = 0, centerZ = 0, minimumIntensity = 0} = {}) {
    // Scratch belongs to this presentation query, never to physics or returned samples.
    const scratch = this.visualQueryScratch ||= {
      candidates: [], distances: new Float64Array(0),
      sample: {visual: {}}, condition: {current: {}, baseline: {}}
    };
    const query = this.iterateVisualCells(bounds, { maximumCells, centerX, centerZ, minimumIntensity }, scratch);
    let result;
    do { result = query.next(); } while (!result.done);
    return result.value;
  }

  // Presentation jobs own their scratch so a debug/atlas query cannot overwrite
  // an in-progress render query. Only publication is delayed, never simulation.
  *iterateVisualCells(bounds = null, {maximumCells = Infinity, centerX = 0, centerZ = 0, minimumIntensity = 0} = {}, scratch = {
    candidates: [], distances: new Float64Array(0), sample: {visual: {}}, condition: {current: {}, baseline: {}}
  }) {
    const candidates = queryTrackStateCells(this.cells, bounds, scratch.candidates);
    const limited = Number.isFinite(maximumCells);
    // A min heap makes the nearest K query O(N + K log N), instead of
    // sorting every candidate and allocating samples that are immediately dropped.
    if (limited && scratch.distances.length < candidates.length) {
      scratch.distances = new Float64Array(Math.max(256, candidates.length * 2));
    }
    const distances = limited ? scratch.distances : null;
    if (limited) for (let i = 0; i < candidates.length; i++) {
      const cell = candidates[i];
      distances[i] = Math.hypot(cell.worldX-centerX, cell.worldZ-centerZ);
    }
    let remaining=candidates.length,cursor=0;
    const compare=(a,b)=>distances[a]-distances[b]||candidates[a].x-candidates[b].x||candidates[a].z-candidates[b].z;
    const sift=start=>{
      let i=start;
      while(i*2+1<remaining){
        let child=i*2+1;
        if(child+1<remaining&&compare(child+1,child)<0)child++;
        if(compare(i,child)<=0)break;
        const cell=candidates[i],distance=distances[i];
        candidates[i]=candidates[child];distances[i]=distances[child];
        candidates[child]=cell;distances[child]=distance;i=child;
      }
    };
    if(limited)for(let i=Math.floor(remaining/2)-1;i>=0;i--)sift(i);
    else candidates.sort((a,b)=>a.x-b.x||a.z-b.z);
    const result=[];
    const sampleStep = this.stepIndex;
    let sampledCells=0;
    const sampleScratch=scratch.sample,conditionScratch=scratch.condition;
    // Select nearest visible records before allocating every candidate's
    // public sample. Returned records own their values; saved cells stay intact.
    while((limited?remaining>0:cursor<candidates.length)&&result.length<maximumCells){
      const cell=limited?candidates[0]:candidates[cursor++];
      if(limited){remaining--;candidates[0]=candidates[remaining];distances[0]=distances[remaining];if(remaining)sift(0);}
      sampledCells++;
      // Yield before each bounded group, including the first after selection.
      if ((sampledCells - 1) % 32 === 0) yield null;
      const sample=getTrackStateCellSample(cell,sampleStep,sampleScratch,conditionScratch);
      if(minimumIntensity>0){
        let visible=false;
        for(const key in sample.visual)if(sample.visual[key]>=minimumIntensity){visible=true;break;}
        if(!visible)continue;
      }
      result.push({key:cell.key,x:cell.worldX,z:cell.worldZ,elevationM:cell.elevationM,
        effectiveGrip:sample.effectiveGrip,...sample.visual});
    }
    this.lastVisualQuery={candidateCells:candidates.length,sampledCells,returnedCells:result.length};
    return result;
  }

  consumeVisualDelta({ maximumCells = 256, includeAll = false } = {}) {
    if (includeAll) {
      for (const key of this.orderedCellKeys) this.visualDirtyKeys.add(key);
    }
    const limit = Math.max(1, Math.min(1024, Math.trunc(Number(maximumCells) || 256)));
    const keys = [...this.visualDirtyKeys]
      .sort(compareTrackStateCellKeys)
      .slice(0, limit);
    const cells = [];
    const dirtyTileKeys = new Set();
    const tileSizeM = 16;
    // Each emitted cell copies the scalar fields; the temporary sample never
    // escapes this loop. Do not share it with callers of sample().
    const scratch = this.visualDeltaScratch ||= {
      sample: { visual: {} }, condition: { current: {}, baseline: {} }
    };
    for (const key of keys) {
      this.visualDirtyKeys.delete(key);
      const cell = this.cells.get(key);
      if (!cell) continue;
      const sample = getTrackStateCellSample(cell, this.stepIndex, scratch.sample, scratch.condition);
      cells.push({
        key,
        x: cell.worldX,
        z: cell.worldZ,
        elevationM: cell.elevationM,
        revision: Number(this.visualCellRevisions.get(key) || 0),
        effectiveGrip: sample.effectiveGrip,
        ...sample.visual
      });
      dirtyTileKeys.add(`${Math.floor(cell.worldX / tileSizeM)}:${Math.floor(cell.worldZ / tileSizeM)}`);
    }
    return {
      stepIndex: this.stepIndex,
      cellRevision: this.visualRevision,
      visualRevision: this.visualRevision,
      tileSizeM,
      dirtyAtlasTiles: [...dirtyTileKeys].map((key) => {
        const [tileX, tileZ] = key.split(':').map(Number);
        return { tileX, tileZ, revision: this.visualRevision };
      }),
      cells,
      remainingDirtyCellCount: this.visualDirtyKeys.size
    };
  }

  getDebugState(bounds = null) {
    return {
      stepIndex: this.stepIndex,
      activeCellCount: this.cells.size,
      environmentActiveCellCount: this.environmentActiveKeys.length,
      receiverCellsCreated: this.performanceCounters.receiverCellsCreated,
      flowBufferHighWater: this.performanceCounters.flowBufferHighWater,
      maintenancePreparedCellCount: this.performanceCounters.maintenancePreparedCellCount,
      weatherWakeRemaining: this.weatherWakeRemaining,
      checkpointPhase: this.checkpointBuilder?.phase || 'idle',
      checkpointTargetStep: this.checkpointBuilder?.targetPayload?.stepIndex || 0,
      checkpointPendingCells: this.checkpointBuilder?.frozen
        ? Math.max(0, this.checkpointBuilder.targetKeys.length - this.checkpointBuilder.cellCopies.size)
        : this.checkpointBuilder?.pendingKeySet?.size || 0,
      checkpointHashCharacters: this.checkpointBuilder?.hashTask?.processedCharacters || 0,
      checkpointEventOverage: Math.max(0, this.eventHistory.length - this.eventHistoryLimit),
      checkpointCompletedCount: this.performanceCounters.checkpointCompletedCount,
      checkpointMaximumEventOverage: this.performanceCounters.checkpointMaximumEventOverage,
      checkpointMaximumSliceMs: this.performanceCounters.checkpointMaximumSliceMs,
      pendingEventCount: this.pendingEvents.length,
      pendingAggregateCount: this.contactAccumulator.size,
      appliedEventCount: this.eventHistory.length,
      historyBaseStepIndex: this.historyBaseStepIndex,
      historyBaseSequence: this.historyBaseSequence,
      checksum: this.getChecksum(),
      totals: this.getConservationTotals(),
      cells: bounds ? this.getVisualCells(bounds) : undefined
    };
  }
}
