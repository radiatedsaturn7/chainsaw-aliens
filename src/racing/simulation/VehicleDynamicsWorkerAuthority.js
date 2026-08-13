import { RACE_WHEEL_IDS } from './SimulationMath.js';
import {
  createVehicleRenderSnapshotBuffer,
  VEHICLE_RENDER_WHEEL_FLAGS,
  writeVehicleRenderSnapshot
} from './VehicleDynamicsWorkerProtocol.js';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rotateLocalOffset(orientation = {}, offset = {}) {
  const qx = finite(orientation.x);
  const qy = finite(orientation.y);
  const qz = finite(orientation.z);
  const qw = finite(orientation.w, 1);
  const x = finite(offset.x);
  const y = finite(offset.y);
  const z = finite(offset.z);
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx
  };
}

function multiplyQuaternion(left = {}, right = {}) {
  const lx = finite(left.x); const ly = finite(left.y); const lz = finite(left.z); const lw = finite(left.w, 1);
  const rx = finite(right.x); const ry = finite(right.y); const rz = finite(right.z); const rw = finite(right.w, 1);
  return {
    x: lw * rx + lx * rw + ly * rz - lz * ry,
    y: lw * ry - lx * rz + ly * rw + lz * rx,
    z: lw * rz + lx * ry - ly * rx + lz * rw,
    w: lw * rw - lx * rx - ly * ry - lz * rz
  };
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
  visualState = null,
  wheelSpinAngles = {}
} = {}) {
  const state = runner?.state || {};
  const config = runner?.config || {};
  const position = state.position || {};
  const orientation = state.orientation || { w: 1 };
  const frontZ = finite(config.cgToFrontAxleM, finite(config.wheelbaseM, 2.65) * 0.5);
  const rearZ = -finite(config.cgToRearAxleM, finite(config.wheelbaseM, 2.65) * 0.5);
  const wheelPoses = {};
  const suspensionPose = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    const isFront = wheelId[0] === 'f';
    const isLeft = wheelId[1] === 'l';
    const halfTrack = finite(
      isFront ? config.frontTrackWidthM : config.rearTrackWidthM,
      1.58
    ) * 0.5;
    const suspension = state.suspensionState?.[wheelId] || {};
    const patch = state.contactPatches?.[wheelId] || {};
    const travel = finite(
      state.suspensionTravel?.[wheelId],
      suspension.compressionRatio ?? suspension.compressionM
    );
    const hubPosition = patch.hubPositionWorld
      || suspension.hubPositionWorld
      || patch.wheelCenterWorld;
    const local = rotateLocalOffset(orientation, {
      x: isLeft ? -halfTrack : halfTrack,
      y: -finite(config.cgHeightM, 0.55) + finite(config.wheelRadiusM, 0.337) - travel,
      z: isFront ? frontZ : rearZ
    });
    const steeringAngle = finite(state.steeringTelemetry?.actualWheelAnglesRad?.[wheelId]);
    const spinAngle = finite(wheelSpinAngles[wheelId]);
    const steerOrientation = { x: 0, y: Math.sin(steeringAngle * 0.5), z: 0, w: Math.cos(steeringAngle * 0.5) };
    const spinOrientation = { x: Math.sin(spinAngle * 0.5), y: 0, z: 0, w: Math.cos(spinAngle * 0.5) };
    const normalLoadN = finite(patch.normalLoadN);
    const flags = (
      (patch.validTreadContact === true ? VEHICLE_RENDER_WHEEL_FLAGS.validTreadContact : 0)
      | (patch.geometricContact === true || patch.contactPointWorld
        ? VEHICLE_RENDER_WHEEL_FLAGS.geometricContact : 0)
      | (normalLoadN > 1 ? VEHICLE_RENDER_WHEEL_FLAGS.loadBearing : 0)
      | (patch.normalLoadKnown === false ? 0 : VEHICLE_RENDER_WHEEL_FLAGS.normalLoadKnown)
    );
    wheelPoses[wheelId] = {
      position: hubPosition ? {
        x: finite(hubPosition.x),
        y: finite(hubPosition.y),
        z: finite(hubPosition.z)
      } : {
        x: finite(position.x) + local.x,
        y: finite(position.y) + local.y,
        z: finite(position.z) + local.z
      },
      orientation: multiplyQuaternion(multiplyQuaternion(orientation, steerOrientation), spinOrientation),
      contactPoint: patch.contactPointWorld || {},
      normal: patch.surfaceNormalWorld || { x: 0, y: 1, z: 0 },
      suspensionMount: patch.suspensionMountPositionWorld
        || suspension.suspensionMountPositionWorld || {},
      suspensionAxis: patch.suspensionAxisWorld
        || suspension.suspensionAxisWorld || { x: 0, y: -1, z: 0 },
      normalLoadN,
      gripCoefficient: finite(patch.gripCoefficient, 1),
      steeringAngleRad: finite(patch.steeringAngleRad, steeringAngle),
      lateralForceN: finite(patch.lateralForceN),
      selfAligningMomentNm: finite(patch.selfAligningMomentNm),
      flags
    };
    suspensionPose[wheelId] = travel;
  }
  return {
    stepIndex: runner?.stepIndex || 0,
    eventSequence,
    visualState: visualState === null ? getVehicleVisualState(state) : visualState,
    simulationTimeSeconds: runner?.simulationTimeSeconds || 0,
    position,
    orientation,
    velocity: state.velocity || {},
    angularVelocity: state.angularVelocityWorld || {},
    wheelPoses,
    suspensionPose,
    tireTemperature: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId, finite(state.tireState?.[wheelId]?.temperatureF, 70)
    ])),
    wheelAngularVelocity: state.wheelAngularVelocityRadps || {},
    speedMps: finite(state.speedMps, state.groundSpeedMps),
    groundSpeedMps: finite(state.groundSpeedMps, state.speedMps),
    bodyLongitudinalSpeedMps: finite(state.bodyLongitudinalSpeedMps, state.speedMps),
    bodyLateralSpeedMps: finite(state.bodyLateralSpeedMps),
    signedTravelSpeedMps: finite(state.signedTravelSpeedMps, state.speedMps),
    engineRpm: finite(state.powertrainState?.engineRpm, state.engineRpm),
    gear: finite(state.powertrainState?.gear, state.gear)
  };
}

export class VehicleDynamicsWorkerAuthority {
  constructor({
    runners = [],
    now = () => performance.now(),
    postSnapshot = () => {},
    onError = null,
    mutateTrackState = null,
    snapshotPoolSize = 3
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
    runners.forEach((entry, index) => this.addVehicle(entry.id || `vehicle-${index}`, entry.runner, entry));
  }

  addVehicle(id, runner, { player = false, active = true, environmentController = null } = {}) {
    if (!runner?.advance) throw new TypeError('Worker authority vehicle requires a dynamics runner');
    this.vehicles.set(String(id), {
      id: String(id), runner, player, active, environmentController,
      lastImpactSequence: Math.max(0, Number(runner.activeImpact?.sequence || 0)),
      wheelSpinAngles: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, 0]))
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
      parkUntilDrive: state.parkUntilDrive === true
    });
    for (const wheelId of RACE_WHEEL_IDS) vehicle.wheelSpinAngles[wheelId] = 0;
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
    if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) this.snapshotBuffers.push(buffer);
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
      const fixedStepSeconds = 1 / Math.max(1, Number(vehicle.runner.config?.chassisHz || 120));
      const advance = vehicle.runner.advance(deltaSeconds, {
        input: latest?.input || null,
        inputTimeSeconds: latest?.timeSeconds,
        onFixedStep: (telemetry) => {
          for (const wheelId of RACE_WHEEL_IDS) {
            vehicle.wheelSpinAngles[wheelId] = (
              vehicle.wheelSpinAngles[wheelId]
              + Number(vehicle.runner.state?.wheelAngularVelocityRadps?.[wheelId] || 0)
                * fixedStepSeconds
            ) % (Math.PI * 2);
          }
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
              } else {
                this.eventSequence += Math.max(0, Number(mutation) || 0);
              }
          }
        }
      });
      completedSteps += Number(advance.completedSteps || 0);
      backlogSteps = Math.max(backlogSteps, Number(advance.backlogSteps || 0));
      if (advance.completedSteps > 0 && this.snapshotBuffers.length) {
        const buffer = this.snapshotBuffers.pop();
        writeVehicleRenderSnapshot(buffer, createVehicleRenderSnapshotFromRunner(vehicle.runner, {
          eventSequence: this.eventSequence,
          wheelSpinAngles: vehicle.wheelSpinAngles
        }));
        pendingSnapshots.push({
          vehicleId: vehicle.id,
          buffer,
          backlogSteps: advance.backlogSteps
        });
      }
    }
    const workerStepMs = Math.max(0, this.now() - wallStart);
    for (const snapshot of pendingSnapshots) {
      snapshot.workerStepMs = workerStepMs;
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
