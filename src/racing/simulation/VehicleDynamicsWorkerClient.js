import {
  VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
  createVehicleRenderSnapshotBuffer,
  interpolateVehicleRenderSnapshots,
  readVehicleRenderSnapshot
} from './VehicleDynamicsWorkerProtocol.js';
import { VehicleDynamicsWorkerMetrics } from './VehicleDynamicsWorkerMetrics.js';

export const VEHICLE_DYNAMICS_REQUIRED_CHASSIS_STEPS_PER_SECOND = 120;

export function createVehicleDynamicsWorkerQualificationFromReport(report = {}) {
  const chassisHz = Math.max(1, Number(report.settings?.chassisHz || 120));
  const run = report.runs?.find(({ fps }) => Number(fps) === 60);
  if (!run) return qualifyVehicleDynamicsWorkerMigration({});
  const completedSteps = Number(run.counters?.completedSteps || run.finalStepIndex || 0);
  const physicsTotalMs = Number(
    run.timers?.raceSimulationVehicleAuthorityUpdate?.inclusiveTotalMs || 0
  );
  const achievedStepsPerSecond = physicsTotalMs > 0
    ? completedSteps / (physicsTotalMs / 1000)
    : 0;
  const stepsPerFrame = chassisHz / 60;
  const measuredP95StepMs = Number(run.physicsStepMs?.p95);
  const hasMeasuredFixedStepP95 = Number.isFinite(measuredP95StepMs);
  const qualification = qualifyVehicleDynamicsWorkerMigration({
    requiredStepsPerSecond: chassisHz,
    achievedStepsPerSecond,
    p95StepMs: Number.isFinite(measuredP95StepMs)
      ? measuredP95StepMs
      : Number(run.physicsUpdateMs?.p95 || Infinity) / stepsPerFrame,
    backlogStart: 0,
    backlogEnd: Number(run.peakBacklogSteps || 0),
    growingBacklog: Number(run.peakBacklogSteps || 0) > 0
  });
  if (report.environment?.designatedReferenceMachine !== true) {
    return Object.freeze({
      ...qualification,
      qualified: false,
      reasons: Object.freeze([
        'performance report was not captured on the designated reference machine',
        ...qualification.reasons
      ])
    });
  }
  if (!hasMeasuredFixedStepP95) {
    return Object.freeze({
      ...qualification,
      qualified: false,
      reasons: Object.freeze([
        'designated performance report does not contain measured fixed-step p95 data',
        ...qualification.reasons
      ])
    });
  }
  return qualification;
}

export function qualifyVehicleDynamicsWorkerMigration(result = {}) {
  const requiredStepsPerSecond = Math.max(1, Number(
    result.requiredStepsPerSecond || VEHICLE_DYNAMICS_REQUIRED_CHASSIS_STEPS_PER_SECOND
  ));
  const achievedStepsPerSecond = Number(result.achievedStepsPerSecond || 0);
  const stepBudgetMs = 1000 / requiredStepsPerSecond;
  const p95StepMs = Number(result.p95StepMs ?? Infinity);
  const backlogStart = Math.max(0, Number(result.backlogStart || 0));
  const backlogEnd = Math.max(0, Number(result.backlogEnd || 0));
  const reasons = [];
  if (achievedStepsPerSecond < requiredStepsPerSecond) {
    reasons.push(`single-thread throughput ${achievedStepsPerSecond.toFixed(2)} < ${requiredStepsPerSecond} steps/s`);
  }
  if (!(p95StepMs <= stepBudgetMs)) {
    reasons.push(`single-thread p95 ${p95StepMs.toFixed(3)}ms > ${stepBudgetMs.toFixed(3)}ms step budget`);
  }
  if (backlogEnd > backlogStart || result.growingBacklog === true) {
    reasons.push(`single-thread backlog grew from ${backlogStart} to ${backlogEnd}`);
  }
  return Object.freeze({
    qualified: reasons.length === 0,
    requiredStepsPerSecond,
    achievedStepsPerSecond,
    stepBudgetMs,
    p95StepMs,
    backlogStart,
    backlogEnd,
    reasons
  });
}

export class VehicleDynamicsWorkerClient {
  constructor({ worker, performanceQualification, now = () => performance.now() } = {}) {
    if (!worker?.postMessage) throw new TypeError('VehicleDynamicsWorkerClient requires a Worker');
    this.qualification = qualifyVehicleDynamicsWorkerMigration(
      performanceQualification || {}
    );
    if (!this.qualification.qualified) {
      throw new Error(`Vehicle dynamics worker performance gate failed: ${this.qualification.reasons.join('; ')}`);
    }
    this.worker = worker;
    this.now = now;
    this.metrics = new VehicleDynamicsWorkerMetrics();
    this.previousSnapshot = null;
    this.latestSnapshot = null;
    this.snapshotsByVehicle = new Map();
    this.pendingResetSequenceByVehicle = new Map();
    this.minimumEventSequenceByVehicle = new Map();
    this.latestReceiveTimeMs = 0;
    this.latestTrackStateVisualDelta = null;
    this.lastError = null;
    this.ready = false;
    this.closed = false;
    this.boundMessage = (event) => this.#handleMessage(event.data);
    this.boundWorkerError = (event) => {
      this.lastError = {
        requestType: 'worker-runtime',
        vehicleId: null,
        message: String(event?.message || event?.error?.message || 'Vehicle dynamics worker failed')
      };
    };
    worker.addEventListener?.('message', this.boundMessage);
    worker.addEventListener?.('error', this.boundWorkerError);
    if (!worker.addEventListener) worker.onmessage = this.boundMessage;
  }

  initialize(payload = {}, transferables = []) {
    if (this.closed) return;
    const vehicleCount = Math.max(1, Number(payload.vehicles?.length || 1));
    const shared = typeof SharedArrayBuffer === 'function';
    const snapshotBuffers = Array.from(
      { length: shared ? Math.max(4, vehicleCount * 4) : Math.max(40, vehicleCount * 40) },
      () => createVehicleRenderSnapshotBuffer({ shared })
    );
    this.worker.postMessage({
      type: 'initialize',
      protocolVersion: VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
      payload,
      snapshotBuffers
    }, [
      ...snapshotBuffers.filter((buffer) => buffer instanceof ArrayBuffer),
      ...transferables
    ]);
  }

  submitInput(inputBuffer, inputSequence, collectedAtMs = this.now(), vehicleId = 'player') {
    if (this.closed) return;
    if (!(inputBuffer instanceof ArrayBuffer)) {
      throw new TypeError('Worker input must be a compact transferable ArrayBuffer');
    }
    this.worker.postMessage({
      type: 'input',
      inputSequence: Number(inputSequence) >>> 0,
      collectedAtMs,
      inputBuffer,
      vehicleId
    }, [inputBuffer]);
  }

  setVehicleActive(vehicleId, active) {
    if (this.closed) return;
    this.worker.postMessage({
      type: 'setVehicleActive',
      vehicleId: String(vehicleId),
      active: active !== false
    });
  }

  submitEnvironmentUpdate(buffer, vehicleId = 'player') {
    if (this.closed) return;
    if (!(buffer instanceof ArrayBuffer)) {
      throw new TypeError('Worker environment update must be a compact transferable ArrayBuffer');
    }
    this.worker.postMessage({
      type: 'environmentUpdate', buffer, vehicleId: String(vehicleId)
    }, [buffer]);
  }

  submitReset(buffer, resetSequence, vehicleId = 'player') {
    if (this.closed) return;
    if (!(buffer instanceof ArrayBuffer)) {
      throw new TypeError('Worker reset must be a compact transferable ArrayBuffer');
    }
    const id = String(vehicleId);
    this.pendingResetSequenceByVehicle.set(id, Number(resetSequence) >>> 0);
    this.snapshotsByVehicle.delete(id);
    if (id === 'player') {
      this.previousSnapshot = null;
      this.latestSnapshot = null;
    }
    this.worker.postMessage({
      type: 'resetVehicle',
      vehicleId: id,
      resetSequence: Number(resetSequence) >>> 0,
      buffer
    }, [buffer]);
  }

  #handleMessage(message = {}) {
    if (message.type === 'snapshot' && message.buffer) {
      const receiveStart = this.now();
      const decoded = readVehicleRenderSnapshot(message.buffer);
      if (message.trackStateVisualDelta?.cells) {
        this.latestTrackStateVisualDelta = message.trackStateVisualDelta;
      }
      const vehicleId = String(message.vehicleId || 'player');
      const pendingReset = this.pendingResetSequenceByVehicle.has(vehicleId);
      const minimumEventSequence = Number(
        this.minimumEventSequenceByVehicle.get(vehicleId) || 0
      );
      if (pendingReset || decoded.eventSequence < minimumEventSequence) {
        if (message.buffer instanceof ArrayBuffer) {
          this.worker.postMessage(
            { type: 'recycleSnapshotBuffer', buffer: message.buffer }, [message.buffer]
          );
        }
        return;
      }
      const history = this.snapshotsByVehicle.get(vehicleId) || {
        snapshots: [], previous: null, latest: null, droppedSnapshots: 0, snapshotIntervalSeconds: 0
      };
      history.droppedSnapshots = Math.max(
        history.droppedSnapshots, Number(message.droppedSnapshots || 0)
      );
      if (!history.latest || decoded.stepIndex > history.latest.stepIndex) {
        if (history.latest && decoded.stepIndex > history.latest.stepIndex + 1) {
          history.droppedSnapshots += decoded.stepIndex - history.latest.stepIndex - 1;
        }
        if (history.latest) {
          history.snapshotIntervalSeconds = Math.max(
            0, decoded.simulationTimeSeconds - history.latest.simulationTimeSeconds
          );
        }
        history.snapshots.push(decoded);
        if (history.snapshots.length > 4) history.snapshots.shift();
        history.previous = history.latest;
        history.latest = decoded;
        this.snapshotsByVehicle.set(vehicleId, history);
        if (vehicleId === 'player') {
          this.previousSnapshot = history.previous;
          this.latestSnapshot = history.latest;
        }
        this.latestReceiveTimeMs = receiveStart;
      }
      this.metrics.recordWorker(message.workerStepMs, message.backlogSteps);
      if (message.buffer instanceof ArrayBuffer) {
        this.worker.postMessage(
          { type: 'recycleSnapshotBuffer', buffer: message.buffer }, [message.buffer]
        );
      }
    } else if (message.type === 'ready') {
      this.ready = true;
    } else if (message.type === 'resetApplied') {
      const vehicleId = String(message.vehicleId || 'player');
      const pending = this.pendingResetSequenceByVehicle.get(vehicleId);
      if (pending !== undefined && Number(message.resetSequence) >= pending) {
        this.pendingResetSequenceByVehicle.delete(vehicleId);
        this.minimumEventSequenceByVehicle.set(
          vehicleId,
          Math.max(0, Number(message.eventSequence) || 0)
        );
        this.snapshotsByVehicle.delete(vehicleId);
        if (vehicleId === 'player') {
          this.previousSnapshot = null;
          this.latestSnapshot = null;
        }
      }
    } else if (message.type === 'error') {
      this.lastError = {
        requestType: message.requestType || null,
        vehicleId: message.vehicleId || null,
        message: String(message.message || 'Vehicle dynamics worker error')
      };
      if (message.requestType === 'resetVehicle') {
        const vehicleId = String(message.vehicleId || 'player');
        this.pendingResetSequenceByVehicle.delete(vehicleId);
        this.minimumEventSequenceByVehicle.delete(vehicleId);
      }
    }
  }

  getInterpolatedSnapshot(renderTimeSeconds, vehicleId = 'player') {
    const history = this.snapshotsByVehicle.get(String(vehicleId));
    const snapshots = history?.snapshots || [];
    let previous = snapshots.at(-2) || history?.previous;
    let latest = snapshots.at(-1) || history?.latest;
    for (let index = 1; index < snapshots.length; index += 1) {
      if (renderTimeSeconds <= snapshots[index].simulationTimeSeconds) {
        previous = snapshots[index - 1];
        latest = snapshots[index];
        break;
      }
    }
    return interpolateVehicleRenderSnapshots(
      previous || (vehicleId === 'player' ? this.previousSnapshot : null),
      latest || (vehicleId === 'player' ? this.latestSnapshot : null),
      renderTimeSeconds
    );
  }

  getPresentationTelemetry(vehicleId = 'player') {
    const history = this.snapshotsByVehicle.get(String(vehicleId));
    const latest = history?.latest || null;
    return {
      snapshotAgeMs: latest ? Math.max(0, this.now() - this.latestReceiveTimeMs) : Infinity,
      snapshotIntervalMs: Number(history?.snapshotIntervalSeconds || 0) * 1000,
      droppedSnapshots: Number(history?.droppedSnapshots || 0)
    };
  }

  getMetrics(options) {
    return this.metrics.getSummary(options);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.worker.removeEventListener?.('message', this.boundMessage);
    this.worker.removeEventListener?.('error', this.boundWorkerError);
    this.worker.terminate?.();
  }
}
