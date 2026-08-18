import {
  createVehicleRenderSnapshotBuffer,
  writeVehicleRenderSnapshot
} from './VehicleDynamicsWorkerProtocol.js';
import { createVehicleRenderStateFromRunner } from './VehicleRenderState.js';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const VEHICLE_VISUAL_STATE = Object.freeze({
  grounded: 1,
  brakeLights: 2,
  reverse: 4,
  handbrake: 8,
  activeAero: 16
});

export function getVehicleVisualState(state = {}) {
  let bits = state.grounded === false ? 0 : VEHICLE_VISUAL_STATE.grounded;
  if (Number(state.powertrainState?.telemetry?.brakeCommand || 0) > 0.01) {
    bits |= VEHICLE_VISUAL_STATE.brakeLights;
  }
  if (Number(state.powertrainState?.gear ?? state.gear ?? 0) < 0) bits |= VEHICLE_VISUAL_STATE.reverse;
  if (state.handbrakeCommandState?.active === true) bits |= VEHICLE_VISUAL_STATE.handbrake;
  if (Number(state.activeAeroState || 0) > 0.01) bits |= VEHICLE_VISUAL_STATE.activeAero;
  return bits;
}

export function createVehicleRenderSnapshotFromRunner(runner, {
  eventSequence = 0,
  visualState = null
} = {}) {
  return createVehicleRenderStateFromRunner(runner, {
    eventSequence,
    visualState: visualState === null ? getVehicleVisualState(runner?.state) : visualState
  });
}

export class VehicleDynamicsWorkerAuthority {
  constructor({
    runners = [],
    now = () => performance.now(),
    postSnapshot = () => {},
    onError = null,
    mutateTrackState = null,
    snapshotPoolSize = 3,
    snapshotSequenceControl = null
  } = {}) {
    this.now = now;
    this.postSnapshot = postSnapshot;
    this.onError = typeof onError === 'function' ? onError : null;
    this.mutateTrackState = typeof mutateTrackState === 'function' ? mutateTrackState : null;
    this.vehicles = new Map();
    this.latestInputs = new Map();
    this.eventSequence = 0;
    this.wakeSources = [];
    this.wakeSourceByVehicle = new Map();
    this.lastClockTimeMs = null;
    this.running = false;
    this.timer = null;
    this.nextClockDeadlineMs = null;
    this.snapshotBuffers = Array.from(
      { length: Math.max(2, Number(snapshotPoolSize) || 3) },
      () => createVehicleRenderSnapshotBuffer()
    );
    this.sharedSnapshotCursor = 0;
    this.droppedSnapshots = 0;
    this.overwrittenSnapshots = 0;
    this.bufferStarvationCount = 0;
    this.snapshotSequence = 0;
    this.snapshotSequenceControl = typeof SharedArrayBuffer === 'function'
      && snapshotSequenceControl instanceof SharedArrayBuffer
      ? new Int32Array(snapshotSequenceControl)
      : null;
    this.pendingTrackStateVisualDelta = null;
    runners.forEach((entry, index) => this.addVehicle(entry.id || `vehicle-${index}`, entry.runner, entry));
  }

  addVehicle(id, runner, { player = false, active = true, environmentController = null } = {}) {
    if (!runner?.advance) throw new TypeError('Worker authority vehicle requires a dynamics runner');
    this.vehicles.set(String(id), {
      id: String(id), runner, player, active, environmentController,
      lastImpactSequence: Math.max(0, Number(runner.activeImpact?.sequence || 0))
    });
  }

  setInput(vehicleId, input, { sequence = 0, timeSeconds = null } = {}) {
    const id = String(vehicleId);
    const previous = this.latestInputs.get(id);
    if (previous && Number(sequence) <= previous.sequence) return false;
    this.latestInputs.set(id, {
      input,
      sequence: Number(sequence) >>> 0,
      timeSeconds: timeSeconds !== null && timeSeconds !== undefined
        && Number.isFinite(Number(timeSeconds)) ? Number(timeSeconds) : null
    });
    return true;
  }

  setVehicleActive(vehicleId, active) {
    const vehicle = this.vehicles.get(String(vehicleId));
    if (!vehicle) return false;
    vehicle.active = active !== false;
    return true;
  }

  resetVehicle(vehicleId, state, { sequence = 0, reason = 'track-center-reset' } = {}) {
    const vehicle = this.vehicles.get(String(vehicleId));
    if (!vehicle) return null;
    const reset = vehicle.runner.resetAuthoritativeState(state, {
      reason,
      parkUntilDrive: state.parkUntilDrive === true,
      resetGeneration: sequence
    });
    vehicle.lastImpactSequence = Math.max(
      0,
      Number(vehicle.runner.activeImpact?.sequence
        || vehicle.runner.impactHistory?.at(-1)?.sequence
        || 0)
    );
    this.latestInputs.delete(vehicle.id);
    this.eventSequence = Math.max(
      this.eventSequence + 1,
      Number(sequence) >>> 0,
      Number(reset.event?.sequence || 0)
    );
    if (reset.renderState) reset.renderState.eventSequence = this.eventSequence;
    return reset;
  }

  updateEnvironmentState(environmentState = {}, vehicleId = null) {
    for (const vehicle of this.vehicles.values()) {
      const globalState = {
        weatherState: environmentState.weatherState,
        raceAtmosphere: environmentState.raceAtmosphere
      };
      vehicle.environmentController?.updateEnvironmentState?.(
        vehicleId === null || String(vehicleId) === vehicle.id
          ? environmentState
          : globalState
      );
    }
  }

  recycleSnapshotBuffer(buffer) {
    const shared = typeof SharedArrayBuffer === 'function' && buffer instanceof SharedArrayBuffer;
    if (shared && !(this.snapshotBuffers[0] instanceof SharedArrayBuffer)) {
      this.snapshotBuffers.length = 0;
      this.sharedSnapshotCursor = 0;
    }
    if ((buffer instanceof ArrayBuffer || shared) && buffer.byteLength > 0
      && !this.snapshotBuffers.includes(buffer)) this.snapshotBuffers.push(buffer);
  }

  tick(clockTimeMs = this.now()) {
    const timeMs = finite(clockTimeMs);
    if (this.lastClockTimeMs === null) {
      this.lastClockTimeMs = timeMs;
      return { completedSteps: 0, backlogSteps: 0, workerStepMs: 0 };
    }
    const deltaSeconds = Math.max(0, (timeMs - this.lastClockTimeMs) / 1000);
    this.lastClockTimeMs = timeMs;
    const wallStart = this.now();
    let completedSteps = 0;
    let backlogSteps = 0;
    const pendingSnapshots = [];
    this.wakeSources.length = 0;
    for (const vehicle of this.vehicles.values()) {
      if (!vehicle.active) continue;
      const state = vehicle.runner.state || {};
      const config = vehicle.runner.config || {};
      let source = this.wakeSourceByVehicle.get(vehicle.id);
      if (!source) {
        source = { id: vehicle.id, position: { x: 0, y: 0, z: 0 } };
        this.wakeSourceByVehicle.set(vehicle.id, source);
      }
      source.position.x = finite(state.position?.x);
      source.position.y = finite(state.position?.y);
      source.position.z = finite(state.position?.z);
      source.yawRad = finite(state.yawRad);
      source.speedMps = Math.abs(finite(state.speedMps));
      source.widthM = finite(config.bodyWidthM, 1.8);
      source.dragAreaM2 = finite(config.dragCoefficient, 0.32)
        * finite(config.frontalAreaM2, 2.2);
      this.wakeSources.push(source);
    }
    for (const vehicle of this.vehicles.values()) {
      if (!vehicle.active) continue;
      vehicle.environmentController?.setWakeSources?.(this.wakeSources, vehicle.id);
      const latest = this.latestInputs.get(vehicle.id);
      const advance = vehicle.runner.advance(deltaSeconds, {
        input: latest?.input || null,
        inputTimeSeconds: latest?.timeSeconds,
        onFixedStep: (telemetry) => {
          const impactSequence = Math.max(
            0,
            Number(vehicle.runner.activeImpact?.sequence
              || vehicle.runner.impactHistory?.at(-1)?.sequence
              || 0)
          );
          if (impactSequence > vehicle.lastImpactSequence) {
            this.eventSequence += impactSequence - vehicle.lastImpactSequence;
            vehicle.lastImpactSequence = impactSequence;
          }
          if (this.mutateTrackState) {
              const mutation = this.mutateTrackState({ vehicle, telemetry }) || 0;
              if (mutation && typeof mutation === 'object'
                && Number.isFinite(Number(mutation.eventSequence))) {
                this.eventSequence = Math.max(
                  this.eventSequence, Number(mutation.eventSequence) || 0
                );
                if (mutation.visualDelta?.cells) {
                  this.pendingTrackStateVisualDelta = mutation.visualDelta;
                }
              } else {
                this.eventSequence += Math.max(0, Number(mutation) || 0);
              }
          }
        }
      });
      completedSteps += Number(advance.completedSteps || 0);
      backlogSteps = Math.max(backlogSteps, Number(advance.backlogSteps || 0));
      if (advance.completedSteps > 0 && this.snapshotBuffers.length) {
        const hasSharedRing = typeof SharedArrayBuffer === 'function'
          && this.snapshotBuffers[0] instanceof SharedArrayBuffer;
        const ringCursor = this.sharedSnapshotCursor++;
        const snapshotSlot = hasSharedRing ? ringCursor % this.snapshotBuffers.length : -1;
        const buffer = hasSharedRing
          ? this.snapshotBuffers[snapshotSlot]
          : this.snapshotBuffers.pop();
        if (hasSharedRing && ringCursor >= this.snapshotBuffers.length) {
          this.overwrittenSnapshots += 1;
        }
        this.snapshotSequence += 1;
        if (snapshotSlot >= 0 && this.snapshotSequenceControl) {
          Atomics.store(this.snapshotSequenceControl, snapshotSlot, this.snapshotSequence * 2 - 1);
        }
        writeVehicleRenderSnapshot(buffer, createVehicleRenderSnapshotFromRunner(vehicle.runner, {
          eventSequence: this.eventSequence
        }));
        if (snapshotSlot >= 0 && this.snapshotSequenceControl) {
          Atomics.store(this.snapshotSequenceControl, snapshotSlot, this.snapshotSequence * 2);
        }
        pendingSnapshots.push({
          vehicleId: vehicle.id,
          buffer,
          snapshotSequence: this.snapshotSequence,
          snapshotSlot,
          backlogSteps: advance.backlogSteps
        });
      } else if (advance.completedSteps > 0) {
        this.droppedSnapshots += 1;
        this.bufferStarvationCount += 1;
      }
    }
    const workerStepMs = Math.max(0, this.now() - wallStart);
    for (const snapshot of pendingSnapshots) {
      snapshot.workerStepMs = workerStepMs;
      snapshot.droppedSnapshots = this.droppedSnapshots;
      snapshot.overwrittenSnapshots = this.overwrittenSnapshots;
      snapshot.bufferStarvationCount = this.bufferStarvationCount;
      if (this.pendingTrackStateVisualDelta) {
        snapshot.trackStateVisualDelta = this.pendingTrackStateVisualDelta;
        this.pendingTrackStateVisualDelta = null;
      }
      this.postSnapshot(snapshot);
    }
    return {
      completedSteps,
      backlogSteps,
      workerStepMs
    };
  }

  start({ intervalMs = 1000 / 120 } = {}) {
    if (this.running) return;
    this.running = true;
    const resolvedIntervalMs = Math.max(1, Number(intervalMs) || (1000 / 120));
    this.lastClockTimeMs = this.now();
    this.nextClockDeadlineMs = this.lastClockTimeMs + resolvedIntervalMs;
    const scheduleNextTick = () => {
      if (!this.running) return;
      const delayMs = Math.max(0, this.nextClockDeadlineMs - this.now());
      this.timer = setTimeout(() => {
        if (!this.running) return;
        const tickTimeMs = this.now();
        this.nextClockDeadlineMs += resolvedIntervalMs;
        if (this.nextClockDeadlineMs < tickTimeMs - resolvedIntervalMs * 8) {
          this.nextClockDeadlineMs = tickTimeMs + resolvedIntervalMs;
        }
        try {
          this.tick(tickTimeMs);
          scheduleNextTick();
        } catch (error) {
          this.stop();
          this.onError?.(error);
        }
      }, delayMs);
    };
    scheduleNextTick();
  }

  stop() {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.nextClockDeadlineMs = null;
  }
}
