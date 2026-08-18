import { VehicleDynamicsRunner } from './VehicleDynamicsRunner.js';
import { VehicleDynamicsWorkerAuthority } from './VehicleDynamicsWorkerAuthority.js';
import {
  VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION,
  readVehicleControlInput,
  readVehicleEnvironmentUpdate,
  readVehicleResetCommand
} from './VehicleDynamicsWorkerProtocol.js';
import { createPackedRaceWorkerEnvironmentProvider } from './PackedRaceWorkerEnvironment.js';
import { createWorkerTrackStateAuthority } from './VehicleTrackStateAuthority.js';

export function createVehicleDynamicsWorkerMessageHandler({
  scope = globalThis,
  createRunner = (definition) => new VehicleDynamicsRunner(definition),
  createAuthority = (options) => new VehicleDynamicsWorkerAuthority(options),
  now = () => performance.now()
} = {}) {
  let authority = null;
  let trackStateAuthority = null;
  const postSnapshot = (message) => {
    const transfer = message.buffer instanceof ArrayBuffer ? [message.buffer] : [];
    scope.postMessage({ type: 'snapshot', ...message }, transfer);
  };
  const postStatus = (message) => scope.postMessage(message);

  return function handleMessage(event) {
    const message = event?.data || event || {};
    try {
      if (message.type === 'initialize') {
        if (message.protocolVersion !== VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION) {
          throw new Error(`Unsupported vehicle dynamics worker protocol ${message.protocolVersion}`);
        }
        authority?.stop();
        const definitions = Array.isArray(message.payload?.vehicles)
          ? message.payload.vehicles
          : [message.payload?.vehicle || message.payload].filter(Boolean);
        trackStateAuthority = message.payload?.trackState
          ? createWorkerTrackStateAuthority(message.payload.trackState)
          : null;
        const runners = definitions.map((definition, index) => {
          let runner = null;
          const packedEnvironment = definition.physicsWorld
            ? createPackedRaceWorkerEnvironmentProvider({
                ...definition.physicsWorld,
                trackState: trackStateAuthority?.trackState || null
              })
            : () => (definition.environment || {});
          runner = createRunner({
            config: definition.config,
            initialState: definition.initialState,
            inputTimeline: definition.inputTimeline,
            // The production initializer supplies the already-packed immutable
            // physics world once. Per-step terrain payloads are intentionally
            // not part of this protocol.
            environmentProvider: (request) => packedEnvironment(request, runner?.config)
          });
          for (const wheelId of Object.keys(runner.renderWheelSpinAngles || {})) {
            runner.renderWheelSpinAngles[wheelId] = Number(
              definition.renderWheelSpinAngles?.[wheelId] || 0
            );
          }
          return {
            id: definition.id || `vehicle-${index}`,
            player: definition.player === true,
            active: definition.active !== false,
            runner,
            environmentController: packedEnvironment
          };
        });
        authority = createAuthority({
          runners,
          now,
          postSnapshot,
          onError: (error) => postStatus({
            type: 'error',
            message: String(error?.message || error),
            stack: String(error?.stack || '')
          }),
          mutateTrackState: trackStateAuthority?.mutate,
          snapshotPoolSize: Math.max(3, runners.length * 2)
        });
        authority.trackState = trackStateAuthority?.trackState || null;
        (message.snapshotBuffers || []).forEach((buffer) => authority.recycleSnapshotBuffer(buffer));
        authority.start({ intervalMs: message.payload?.clockIntervalMs });
        postStatus({ type: 'ready', vehicleCount: runners.length });
        return;
      }
      if (!authority) throw new Error('Vehicle dynamics worker is not initialized');
      if (message.type === 'input') {
        authority.setInput(
          message.vehicleId || 'player',
          readVehicleControlInput(message.inputBuffer),
          {
            sequence: message.inputSequence,
            timeSeconds: message.inputTimeSeconds
          }
        );
      } else if (message.type === 'setVehicleActive') {
        if (!authority.setVehicleActive(message.vehicleId, message.active)) {
          throw new Error(`Unknown vehicle dynamics worker vehicle ${message.vehicleId}`);
        }
      } else if (message.type === 'environmentUpdate') {
        const update = readVehicleEnvironmentUpdate(message.buffer);
        authority.updateEnvironmentState(update, message.vehicleId || null);
        trackStateAuthority?.updateWeatherForcing(update.weatherForcing);
      } else if (message.type === 'resetVehicle') {
        const vehicleId = message.vehicleId || 'player';
        const reset = authority.resetVehicle(
          vehicleId,
          readVehicleResetCommand(message.buffer),
          {
            sequence: message.resetSequence,
            reason: 'track-center-reset'
          }
        );
        if (!reset) throw new Error(`Unknown vehicle dynamics worker vehicle ${vehicleId}`);
        postStatus({
          type: 'resetApplied',
          vehicleId,
          resetSequence: Number(message.resetSequence) >>> 0,
          eventSequence: authority.eventSequence,
          stepIndex: reset.event?.stepIndex ?? null
        });
      } else if (message.type === 'recycleSnapshotBuffer') {
        authority.recycleSnapshotBuffer(message.buffer);
      } else if (message.type === 'requestTrackStateCheckpoint') {
        postStatus({
          type: 'trackStateCheckpoint',
          requestId: message.requestId,
          snapshot: authority.trackState?.createSnapshot?.() || null
        });
      } else if (message.type === 'requestDiagnostics') {
        postStatus({
          type: 'diagnostics',
          running: authority.running,
          lastClockTimeMs: authority.lastClockTimeMs,
          vehicles: [...authority.vehicles.values()].map((vehicle) => ({
            id: vehicle.id,
            active: vehicle.active,
            stepIndex: vehicle.runner.stepIndex,
            observedTimeSeconds: vehicle.runner.observedTimeSeconds,
            backlogSteps: vehicle.runner.diagnostics?.backlogSteps || 0,
            hasInput: authority.latestInputs.has(vehicle.id),
            inputTimeSeconds: authority.latestInputs.get(vehicle.id)?.timeSeconds
          }))
        });
      } else if (message.type === 'stop') {
        authority.stop();
        postStatus({ type: 'stopped' });
      }
    } catch (error) {
      postStatus({
        type: 'error',
        requestType: message.type || null,
        vehicleId: message.vehicleId || null,
        resetSequence: message.resetSequence ?? null,
        message: String(error?.message || error),
        stack: String(error?.stack || '')
      });
    }
  };
}

const isWorkerScope = typeof WorkerGlobalScope !== 'undefined'
  && globalThis instanceof WorkerGlobalScope;
if (isWorkerScope) {
  globalThis.addEventListener('message', createVehicleDynamicsWorkerMessageHandler());
}
