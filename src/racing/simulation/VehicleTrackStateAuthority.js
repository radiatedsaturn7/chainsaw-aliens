import { TrackState } from '../trackState/TrackState.js';
import { queueRaceTrackStateTireEvents } from '../trackState/TrackStateIntegration.js';
import { RACE_WHEEL_IDS } from './SimulationMath.js';

function createScratch() {
  const positions = {};
  const previousPositions = {};
  const longitudinalSlipByWheel = {};
  const lateralSlipByWheel = {};
  const wheelContactScaleByWheel = {};
  const tireTemperatures = {};
  const lockByWheel = {};
  const wheelSpinByWheel = {};
  const physicalMutationTotalsByWheel = {};
  const contactByWheel = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    positions[wheelId] = { x: 0, z: 0 };
    previousPositions[wheelId] = { x: 0, z: 0 };
    longitudinalSlipByWheel[wheelId] = 0;
    lateralSlipByWheel[wheelId] = 0;
    wheelContactScaleByWheel[wheelId] = 0;
    tireTemperatures[wheelId] = 70;
    lockByWheel[wheelId] = 0;
    wheelSpinByWheel[wheelId] = 0;
    physicalMutationTotalsByWheel[wheelId] = {};
    contactByWheel[wheelId] = {};
  }
  return {
    initialized: false,
    positions,
    previousPositions,
    longitudinalSlipByWheel,
    lateralSlipByWheel,
    wheelContactScaleByWheel,
    tireTemperatures,
    lockByWheel,
    wheelSpinByWheel,
    physicalMutationTotalsByWheel,
    contactByWheel,
    wheelSurfaceState: { positions },
    brakeState: { lockByWheel },
    direction: { x: 0, z: 1 }
  };
}

export function createWorkerTrackStateAuthority({
  snapshot = null,
  options = {},
  weatherForcing = {},
  tireCompoundByWheel = {},
  contactStepSeconds = 1 / 120
} = {}) {
  const trackState = snapshot
    ? TrackState.fromSnapshot(snapshot, options)
    : new TrackState(options);
  const scratchByVehicle = new Map();
  const liveWeatherForcing = { ...weatherForcing };
  const mutate = ({ vehicle, telemetry }) => {
    const vehicleId = vehicle.id || 'player';
    let scratch = scratchByVehicle.get(vehicleId);
    if (!scratch) {
      scratch = createScratch();
      scratchByVehicle.set(vehicleId, scratch);
    }
    const state = telemetry?.state || vehicle.runner?.state || {};
    const patches = state.contactPatches || {};
    for (const wheelId of RACE_WHEEL_IDS) {
      const patch = patches[wheelId] || {};
      const point = patch.contactPointWorld || {};
      const previous = scratch.previousPositions[wheelId];
      const current = scratch.positions[wheelId];
      if (!scratch.initialized) {
        previous.x = Number(point.x || 0);
        previous.z = Number(point.z || 0);
      } else {
        previous.x = current.x;
        previous.z = current.z;
      }
      current.x = Number(point.x || 0);
      current.z = Number(point.z || 0);
      const radiusM = Math.max(0.01, Number(patch.effectiveRollingRadiusM || 0.33));
      const rollingSpeed = Number(patch.wheelAngularVelocityRadps || 0) * radiusM;
      const groundSpeed = Number(patch.longitudinalVelocityMps || 0);
      const longitudinalSlipSpeed = rollingSpeed - groundSpeed;
      const lateralSpeed = Number(patch.lateralVelocityMps || 0);
      const normalLoadN = Math.max(0, Number(patch.normalLoadN || state.wheelLoadsN?.[wheelId] || 0));
      const energy = patch.tireEnergyWork || {};
      const longitudinalWorkJ = Math.max(0, Number(
        energy.longitudinalFrictionWorkJ
          ?? Math.abs(Number(patch.longitudinalForceN || 0) * longitudinalSlipSpeed) * contactStepSeconds
      ));
      const lateralWorkJ = Math.max(0, Number(
        energy.lateralFrictionWorkJ
          ?? Math.abs(Number(patch.lateralForceN || 0) * lateralSpeed) * contactStepSeconds
      ));
      const distanceM = Math.abs(groundSpeed) * contactStepSeconds;
      const totals = scratch.physicalMutationTotalsByWheel[wheelId];
      totals.rollingDistanceM = distanceM;
      totals.groundedContactDurationSeconds = normalLoadN > 1 ? contactStepSeconds : 0;
      totals.normalImpulseNs = normalLoadN * contactStepSeconds;
      totals.longitudinalSlipWorkJ = longitudinalWorkJ;
      totals.lateralScrubWorkJ = lateralWorkJ;
      totals.lockedWheelWorkJ = longitudinalSlipSpeed < 0 ? longitudinalWorkJ : 0;
      totals.wheelspinWorkJ = longitudinalSlipSpeed > 0 ? longitudinalWorkJ : 0;
      totals.surfaceHeatingWorkJ = Math.max(0, Number(
        patch.frictionHeatingWorkJ ?? (longitudinalWorkJ + lateralWorkJ) * 0.62
      ));
      totals.rubberDepositionWorkJ = (longitudinalWorkJ + lateralWorkJ) * 0.82
        + normalLoadN * distanceM * 0.025;
      totals.waterDisplacementImpulseNs = Math.max(
        0, Number(patch.aquaplaning?.displacedWaterVolumeM3ps || 0)
      ) * 1000 * Math.max(Math.abs(groundSpeed), Math.abs(rollingSpeed)) * contactStepSeconds;
      totals.looseMaterialSweepWorkJ = normalLoadN * distanceM;
      totals.materialPickupCapacity = totals.looseMaterialSweepWorkJ;
      totals.carriedMaterialDepositCapacity = totals.looseMaterialSweepWorkJ;
      scratch.longitudinalSlipByWheel[wheelId] = Math.abs(Number(patch.slipRatio || 0));
      scratch.lateralSlipByWheel[wheelId] = Math.abs(Math.tan(Number(patch.slipAngleRad || 0)));
      scratch.wheelContactScaleByWheel[wheelId] = normalLoadN > 1 ? 1 : 0;
      scratch.tireTemperatures[wheelId] = Number(state.tireState?.[wheelId]?.temperatureF || 70);
      scratch.lockByWheel[wheelId] = Math.max(0, -Number(patch.slipRatio || 0));
      scratch.wheelSpinByWheel[wheelId] = Math.max(0, Number(patch.slipRatio || 0));
    }
    scratch.initialized = true;
    const yaw = Number(state.yawRad || 0);
    scratch.direction.x = Math.sin(yaw);
    scratch.direction.z = Math.cos(yaw);
    const beforeSequence = trackState.nextSequence;
    queueRaceTrackStateTireEvents(trackState, {
      vehicleId,
      normalLoads: state.wheelLoadsN,
      tireSlipByWheel: state.wheelSlip,
      longitudinalSlipByWheel: scratch.longitudinalSlipByWheel,
      lateralSlipByWheel: scratch.lateralSlipByWheel,
      wheelContactScaleByWheel: scratch.wheelContactScaleByWheel,
      wheelSurfaceState: scratch.wheelSurfaceState,
      previousPositions: scratch.previousPositions,
      speedMps: Math.abs(Number(state.speedMps || 0)),
      tireCompoundByWheel,
      tireTemperatures: scratch.tireTemperatures,
      brakeState: scratch.brakeState,
      wheelSpinByWheel: scratch.wheelSpinByWheel,
      physicalMutationTotalsByWheel: scratch.physicalMutationTotalsByWheel,
      contactDurationSeconds: contactStepSeconds,
      direction: scratch.direction,
      wheelIds: RACE_WHEEL_IDS,
      collectAcceptedEvents: false,
      contactByWheel: scratch.contactByWheel
    });
    const advance = trackState.advance(contactStepSeconds, liveWeatherForcing);
    return {
      eventCount: Math.max(0, trackState.nextSequence - beforeSequence),
      eventSequence: Math.max(0, trackState.nextSequence - 1),
      advance
    };
  };
  return {
    trackState,
    mutate,
    updateWeatherForcing(next = {}) {
      Object.assign(liveWeatherForcing, next);
    }
  };
}
