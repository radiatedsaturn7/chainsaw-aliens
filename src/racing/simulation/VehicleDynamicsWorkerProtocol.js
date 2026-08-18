import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import {
  VEHICLE_RENDER_STATE_SCHEMA_VERSION,
  VEHICLE_RENDER_WHEEL_FLAGS,
  reconstructVehicleRenderState
} from './VehicleRenderState.js';

export { VEHICLE_RENDER_WHEEL_FLAGS } from './VehicleRenderState.js';

export const VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION = 5;
export const VEHICLE_RENDER_SNAPSHOT_HEADER_WORDS = 5;
export const VEHICLE_RENDER_SNAPSHOT_FLOATS = 141;
export const VEHICLE_RENDER_SNAPSHOT_BYTES = (
  VEHICLE_RENDER_SNAPSHOT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT
  + VEHICLE_RENDER_SNAPSHOT_FLOATS * Float32Array.BYTES_PER_ELEMENT
);
export const VEHICLE_CONTROL_INPUT_FLOATS = 16;
export const VEHICLE_CONTROL_INPUT_BYTES = VEHICLE_CONTROL_INPUT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const VEHICLE_ENVIRONMENT_UPDATE_FLOATS = 24;
export const VEHICLE_ENVIRONMENT_UPDATE_BYTES = VEHICLE_ENVIRONMENT_UPDATE_FLOATS
  * Float32Array.BYTES_PER_ELEMENT;
export const VEHICLE_RESET_COMMAND_FLOATS = 12;
export const VEHICLE_RESET_COMMAND_BYTES = VEHICLE_RESET_COMMAND_FLOATS
  * Float32Array.BYTES_PER_ELEMENT;
const WEATHER_TYPE_BY_CODE = Object.freeze(['clear', 'rain', 'storm', 'snow']);
const WEATHER_CODE_BY_TYPE = Object.freeze(Object.fromEntries(
  WEATHER_TYPE_BY_CODE.map((type, code) => [type, code])
));
export const VEHICLE_CONTROL_INPUT_FLOAT = Object.freeze({
  steering: 0,
  driverSteeringIntent: 1,
  steeringTarget: 2,
  controllerFilterOutput: 3,
  centerSteeringAngleRad: 4,
  throttle: 5,
  brake: 6,
  clutch: 7,
  handbrake: 8,
  handbrakeHoldSequence: 9,
  handbrakeHoldSeconds: 10,
  gear: 11,
  flags: 12,
  activeAeroState: 13,
  steeringInputMode: 14
});

export const VEHICLE_RENDER_SNAPSHOT_HEADER = Object.freeze({
  protocolVersion: 0,
  stepIndex: 1,
  eventSequence: 2,
  visualState: 3,
  resetGeneration: 4
});

export const VEHICLE_RENDER_SNAPSHOT_FLOAT = Object.freeze({
  simulationTimeSeconds: 0,
  position: 1,
  orientation: 4,
  velocity: 8,
  angularVelocity: 11,
  wheelPoses: 14,
  suspensionPose: 122,
  tireTemperature: 126,
  speedMps: 130,
  groundSpeedMps: 131,
  bodyLongitudinalSpeedMps: 132,
  bodyLateralSpeedMps: 133,
  signedTravelSpeedMps: 134,
  engineRpm: 135,
  gear: 136,
  wheelAngularVelocity: 137
});

export const VEHICLE_RENDER_WHEEL_STRIDE = 27;
export const VEHICLE_RENDER_WHEEL_FLOAT = Object.freeze({
  hubPositionBody: 0,
  suspensionMountBody: 3,
  suspensionAxisBody: 6,
  contactPointWorld: 9,
  surfaceNormalWorld: 12,
  suspensionCompressionM: 15,
  steeringAngleRad: 16,
  spinAngleRad: 17,
  camberAngleRad: 18,
  toeAngleRad: 19,
  wheelAngularVelocityRadps: 20,
  normalLoadN: 21,
  gripCoefficient: 22,
  lateralForceN: 23,
  selfAligningMomentNm: 24,
  flags: 25,
  reserved: 26
});

export function createVehicleRenderSnapshotBuffer({ shared = false } = {}) {
  if (shared && typeof SharedArrayBuffer === 'function') {
    return new SharedArrayBuffer(VEHICLE_RENDER_SNAPSHOT_BYTES);
  }
  return new ArrayBuffer(VEHICLE_RENDER_SNAPSHOT_BYTES);
}

export function getVehicleRenderSnapshotViews(buffer) {
  if (!(buffer instanceof ArrayBuffer)
    && !(typeof SharedArrayBuffer === 'function' && buffer instanceof SharedArrayBuffer)) {
    throw new TypeError('Vehicle render snapshot requires an ArrayBuffer or SharedArrayBuffer');
  }
  if (buffer.byteLength !== VEHICLE_RENDER_SNAPSHOT_BYTES) {
    throw new RangeError(`Vehicle render snapshot must be ${VEHICLE_RENDER_SNAPSHOT_BYTES} bytes`);
  }
  return {
    header: new Uint32Array(buffer, 0, VEHICLE_RENDER_SNAPSHOT_HEADER_WORDS),
    values: new Float32Array(
      buffer,
      VEHICLE_RENDER_SNAPSHOT_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      VEHICLE_RENDER_SNAPSHOT_FLOATS
    )
  };
}

export function createVehicleControlInputBuffer(input = {}) {
  const buffer = new ArrayBuffer(VEHICLE_CONTROL_INPUT_BYTES);
  const values = new Float32Array(buffer);
  values[VEHICLE_CONTROL_INPUT_FLOAT.steering] = finite(input.steering);
  values[VEHICLE_CONTROL_INPUT_FLOAT.driverSteeringIntent] = finite(input.driverSteeringIntent);
  values[VEHICLE_CONTROL_INPUT_FLOAT.steeringTarget] = finite(input.steeringTarget);
  values[VEHICLE_CONTROL_INPUT_FLOAT.controllerFilterOutput] = finite(input.controllerFilterOutput);
  values[VEHICLE_CONTROL_INPUT_FLOAT.centerSteeringAngleRad] = finite(input.centerSteeringAngleRad);
  values[VEHICLE_CONTROL_INPUT_FLOAT.throttle] = finite(input.throttle);
  values[VEHICLE_CONTROL_INPUT_FLOAT.brake] = finite(input.brake);
  values[VEHICLE_CONTROL_INPUT_FLOAT.clutch] = finite(input.clutch);
  values[VEHICLE_CONTROL_INPUT_FLOAT.handbrake] = finite(input.handbrake);
  values[VEHICLE_CONTROL_INPUT_FLOAT.handbrakeHoldSequence] = finite(input.handbrakeHoldSequence);
  values[VEHICLE_CONTROL_INPUT_FLOAT.handbrakeHoldSeconds] = finite(input.handbrakeHoldSeconds);
  values[VEHICLE_CONTROL_INPUT_FLOAT.gear] = finite(input.gear);
  values[VEHICLE_CONTROL_INPUT_FLOAT.activeAeroState] = finite(input.activeAeroState);
  values[VEHICLE_CONTROL_INPUT_FLOAT.steeringInputMode] = {
    keyboard: 1,
    gamepad: 2,
    'simulation-wheel': 3,
    ai: 4
  }[input.steeringInputMode] || 0;
  const assists = input.assists || {};
  values[VEHICLE_CONTROL_INPUT_FLOAT.flags] = (
    ((input.absEnabled ?? assists.absEnabled) === false ? 0 : 1)
    | ((input.tractionControlEnabled ?? assists.tractionControlEnabled) === false ? 0 : 2)
    | ((input.autoShift ?? assists.autoShift) ? 4 : 0)
    | ((input.stabilityControlEnabled ?? assists.stabilityControlEnabled) ? 8 : 0)
    | ((input.launchControlEnabled ?? assists.launchControlEnabled) ? 16 : 0)
  );
  return buffer;
}

export function readVehicleControlInput(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== VEHICLE_CONTROL_INPUT_BYTES) {
    throw new RangeError(`Vehicle control input must be a ${VEHICLE_CONTROL_INPUT_BYTES}-byte ArrayBuffer`);
  }
  const values = new Float32Array(buffer);
  const flags = values[VEHICLE_CONTROL_INPUT_FLOAT.flags] | 0;
  const steeringInputMode = [null, 'keyboard', 'gamepad', 'simulation-wheel', 'ai'][
    Math.trunc(values[VEHICLE_CONTROL_INPUT_FLOAT.steeringInputMode])
  ] || null;
  return {
    steering: values[VEHICLE_CONTROL_INPUT_FLOAT.steering],
    driverSteeringIntent: values[VEHICLE_CONTROL_INPUT_FLOAT.driverSteeringIntent],
    steeringTarget: values[VEHICLE_CONTROL_INPUT_FLOAT.steeringTarget],
    controllerFilterOutput: values[VEHICLE_CONTROL_INPUT_FLOAT.controllerFilterOutput],
    centerSteeringAngleRad: values[VEHICLE_CONTROL_INPUT_FLOAT.centerSteeringAngleRad],
    throttle: values[VEHICLE_CONTROL_INPUT_FLOAT.throttle],
    brake: values[VEHICLE_CONTROL_INPUT_FLOAT.brake],
    clutch: values[VEHICLE_CONTROL_INPUT_FLOAT.clutch],
    handbrake: values[VEHICLE_CONTROL_INPUT_FLOAT.handbrake],
    handbrakeHoldSequence: Math.trunc(values[VEHICLE_CONTROL_INPUT_FLOAT.handbrakeHoldSequence]),
    handbrakeHoldSeconds: values[VEHICLE_CONTROL_INPUT_FLOAT.handbrakeHoldSeconds],
    requestedGear: Math.trunc(values[VEHICLE_CONTROL_INPUT_FLOAT.gear]),
    activeAeroState: values[VEHICLE_CONTROL_INPUT_FLOAT.activeAeroState],
    steeringInputMode,
    absEnabled: (flags & 1) !== 0,
    tractionControlEnabled: (flags & 2) !== 0,
    autoShift: (flags & 4) !== 0,
    assists: {
      absEnabled: (flags & 1) !== 0,
      tractionControlEnabled: (flags & 2) !== 0,
      autoShift: (flags & 4) !== 0,
      stabilityControlEnabled: (flags & 8) !== 0,
      launchControlEnabled: (flags & 16) !== 0
    }
  };
}

export function createVehicleEnvironmentUpdateBuffer({
  weatherState = {}, race = {}, weatherForcing = {}, damage = {}
} = {}) {
  const values = new Float32Array(VEHICLE_ENVIRONMENT_UPDATE_FLOATS);
  const type = String(weatherState.id || race.weather || 'clear');
  const panels = damage.panels || {};
  let bodyDamage = 0;
  for (const key in panels) bodyDamage = Math.max(bodyDamage, finite(panels[key]));
  values[0] = WEATHER_CODE_BY_TYPE[type] ?? 0;
  values[1] = finite(
    weatherState.effectiveIntensity ?? weatherState.targetIntensity ?? race.weatherIntensity
  );
  values[2] = finite(weatherForcing.ambientTemperatureC, 22);
  values[3] = finite(weatherForcing.precipitationRateMmPerS);
  values[4] = finite(weatherForcing.sunIntensity);
  values[5] = finite(weatherForcing.windIntensity);
  values[6] = finite(weatherForcing.windDirectionRad
    ?? race.windDirectionRad
    ?? finite(race.windDirectionDeg ?? race.weatherWindDirectionDeg) * Math.PI / 180);
  values[7] = finite(weatherForcing.humidity);
  values[8] = finite(race.windSpeedMps, -1);
  values[9] = finite(race.gustStrength, -1);
  values[10] = bodyDamage;
  values[11] = finite(panels.front) / 100;
  values[12] = finite(panels.rear) / 100;
  values[13] = finite(damage.engine);
  values[14] = finite(damage.transmission);
  for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
    const wheelId = RACE_WHEEL_IDS[index];
    values[15 + index] = finite(damage.brakes?.[wheelId]);
    values[19 + index] = finite(damage.tires?.[wheelId]);
  }
  return values.buffer;
}

export function readVehicleEnvironmentUpdate(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== VEHICLE_ENVIRONMENT_UPDATE_BYTES) {
    throw new RangeError(
      `Vehicle environment update must be a ${VEHICLE_ENVIRONMENT_UPDATE_BYTES}-byte ArrayBuffer`
    );
  }
  const values = new Float32Array(buffer);
  const brakes = {};
  const tires = {};
  for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
    brakes[RACE_WHEEL_IDS[index]] = values[15 + index];
    tires[RACE_WHEEL_IDS[index]] = values[19 + index];
  }
  return {
    weatherState: {
      id: WEATHER_TYPE_BY_CODE[Math.trunc(values[0])] || 'clear',
      effectiveIntensity: values[1]
    },
    raceAtmosphere: {
      weather: WEATHER_TYPE_BY_CODE[Math.trunc(values[0])] || 'clear',
      weatherIntensity: values[1],
      windDirectionRad: values[6],
      windSpeedMps: values[8] < 0 ? undefined : values[8],
      gustStrength: values[9] < 0 ? undefined : values[9]
    },
    weatherForcing: {
      type: WEATHER_TYPE_BY_CODE[Math.trunc(values[0])] || 'clear',
      ambientTemperatureC: values[2],
      precipitationRateMmPerS: values[3],
      sunIntensity: values[4],
      windIntensity: values[5],
      windDirectionRad: values[6],
      humidity: values[7]
    },
    damage: {
      bodyDamage: values[10],
      frontAeroDamage: values[11],
      rearAeroDamage: values[12],
      engine: values[13],
      transmission: values[14],
      brakes,
      tires
    }
  };
}

export function createVehicleResetCommandBuffer(state = {}) {
  const values = new Float32Array(VEHICLE_RESET_COMMAND_FLOATS);
  const position = state.position || {
    x: state.worldX,
    y: state.heightM ?? state.bodyY,
    z: state.worldZ
  };
  const orientation = state.orientation || {};
  values[0] = finite(position.x);
  values[1] = finite(position.y);
  values[2] = finite(position.z);
  values[3] = finite(orientation.x);
  values[4] = finite(orientation.y);
  values[5] = finite(orientation.z);
  values[6] = finite(orientation.w, 1);
  values[7] = finite(state.routeDistance, -1);
  values[8] = finite(state.gear, 1);
  values[9] = finite(state.engineRpm, 800);
  values[10] = state.grounded === false ? 0 : 1;
  values[11] = state.parkUntilDrive === true ? 1 : 0;
  return values.buffer;
}

export function readVehicleResetCommand(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== VEHICLE_RESET_COMMAND_BYTES) {
    throw new RangeError(
      `Vehicle reset command must be a ${VEHICLE_RESET_COMMAND_BYTES}-byte ArrayBuffer`
    );
  }
  const values = new Float32Array(buffer);
  return {
    position: { x: values[0], y: values[1], z: values[2] },
    orientation: { x: values[3], y: values[4], z: values[5], w: values[6] },
    routeDistance: values[7] < 0 ? null : values[7],
    gear: Math.trunc(values[8]),
    engineRpm: values[9],
    grounded: values[10] !== 0,
    parkUntilDrive: values[11] !== 0,
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocityWorld: { x: 0, y: 0, z: 0 },
    speedMps: 0
  };
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function writeVector(values, offset, vector = {}) {
  values[offset] = finite(vector.x);
  values[offset + 1] = finite(vector.y);
  values[offset + 2] = finite(vector.z);
}

function writeQuaternion(values, offset, quaternion = {}) {
  values[offset] = finite(quaternion.x);
  values[offset + 1] = finite(quaternion.y);
  values[offset + 2] = finite(quaternion.z);
  values[offset + 3] = finite(quaternion.w, 1);
}

export function writeVehicleRenderSnapshot(buffer, snapshot = {}) {
  const { header, values } = getVehicleRenderSnapshotViews(buffer);
  header[VEHICLE_RENDER_SNAPSHOT_HEADER.protocolVersion] = VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION;
  header[VEHICLE_RENDER_SNAPSHOT_HEADER.stepIndex] = Number(snapshot.stepIndex || 0) >>> 0;
  header[VEHICLE_RENDER_SNAPSHOT_HEADER.eventSequence] = Number(snapshot.eventSequence || 0) >>> 0;
  header[VEHICLE_RENDER_SNAPSHOT_HEADER.visualState] = Number(snapshot.visualState || 0) >>> 0;
  header[VEHICLE_RENDER_SNAPSHOT_HEADER.resetGeneration]
    = Number(snapshot.resetGeneration || 0) >>> 0;
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.simulationTimeSeconds] = finite(snapshot.simulationTimeSeconds);
  writeVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.position, snapshot.position);
  writeQuaternion(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.orientation, snapshot.orientation);
  writeVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.velocity, snapshot.velocity);
  writeVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.angularVelocity, snapshot.angularVelocity);
  let offset = VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelPoses;
  for (const wheelId of RACE_WHEEL_IDS) {
    const pose = snapshot.wheels?.[wheelId] || snapshot.wheelPoses?.[wheelId] || {};
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.hubPositionBody, pose.hubPositionBody);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionMountBody, pose.suspensionMountBody);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionAxisBody, pose.suspensionAxisBody);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.contactPointWorld, pose.contactPointWorld || pose.contactPoint);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.surfaceNormalWorld, pose.surfaceNormalWorld || pose.normal);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionCompressionM] = finite(
      pose.suspensionCompressionM, snapshot.suspensionPose?.[wheelId]
    );
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.steeringAngleRad] = finite(pose.steeringAngleRad);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.spinAngleRad] = finite(pose.spinAngleRad);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.camberAngleRad] = finite(pose.camberAngleRad);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.toeAngleRad] = finite(pose.toeAngleRad);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.wheelAngularVelocityRadps] = finite(
      pose.wheelAngularVelocityRadps, snapshot.wheelAngularVelocity?.[wheelId]
    );
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.normalLoadN] = finite(pose.normalLoadN);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.gripCoefficient] = finite(pose.gripCoefficient, 1);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.lateralForceN] = finite(pose.lateralForceN);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.selfAligningMomentNm] = finite(pose.selfAligningMomentNm);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.flags] = finite(pose.flags);
    offset += VEHICLE_RENDER_WHEEL_STRIDE;
  }
  for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
    const wheelId = RACE_WHEEL_IDS[index];
    values[VEHICLE_RENDER_SNAPSHOT_FLOAT.suspensionPose + index] = finite(snapshot.suspensionPose?.[wheelId]);
    values[VEHICLE_RENDER_SNAPSHOT_FLOAT.tireTemperature + index] = finite(snapshot.tireTemperature?.[wheelId], 70);
    values[VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelAngularVelocity + index] = finite(snapshot.wheelAngularVelocity?.[wheelId]);
  }
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.speedMps] = finite(snapshot.speedMps);
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.groundSpeedMps] = finite(snapshot.groundSpeedMps, snapshot.speedMps);
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.bodyLongitudinalSpeedMps] = finite(snapshot.bodyLongitudinalSpeedMps, snapshot.speedMps);
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.bodyLateralSpeedMps] = finite(snapshot.bodyLateralSpeedMps);
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.signedTravelSpeedMps] = finite(snapshot.signedTravelSpeedMps, snapshot.speedMps);
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.engineRpm] = finite(snapshot.engineRpm);
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.gear] = finite(snapshot.gear);
  return buffer;
}

function readVector(values, offset) {
  return { x: values[offset], y: values[offset + 1], z: values[offset + 2] };
}

function readQuaternion(values, offset) {
  return {
    x: values[offset], y: values[offset + 1], z: values[offset + 2], w: values[offset + 3]
  };
}

export function readVehicleRenderSnapshot(buffer) {
  const { header, values } = getVehicleRenderSnapshotViews(buffer);
  const wheels = {};
  const suspensionPose = {};
  const tireTemperature = {};
  const wheelAngularVelocity = {};
  let offset = VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelPoses;
  for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
    const wheelId = RACE_WHEEL_IDS[index];
    const flags = Math.trunc(values[offset + VEHICLE_RENDER_WHEEL_FLOAT.flags]);
    wheels[wheelId] = {
      hubPositionBody: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.hubPositionBody),
      suspensionMountBody: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionMountBody),
      suspensionAxisBody: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionAxisBody),
      contactPointWorld: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.contactPointWorld),
      surfaceNormalWorld: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.surfaceNormalWorld),
      suspensionCompressionM: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionCompressionM],
      spinAngleRad: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.spinAngleRad],
      camberAngleRad: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.camberAngleRad],
      toeAngleRad: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.toeAngleRad],
      wheelAngularVelocityRadps: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.wheelAngularVelocityRadps],
      normalLoadN: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.normalLoadN],
      gripCoefficient: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.gripCoefficient],
      steeringAngleRad: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.steeringAngleRad],
      lateralForceN: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.lateralForceN],
      selfAligningMomentNm: values[offset + VEHICLE_RENDER_WHEEL_FLOAT.selfAligningMomentNm],
      flags,
      validTreadContact: (flags & VEHICLE_RENDER_WHEEL_FLAGS.validTreadContact) !== 0,
      geometricContact: (flags & VEHICLE_RENDER_WHEEL_FLAGS.geometricContact) !== 0,
      loadBearing: (flags & VEHICLE_RENDER_WHEEL_FLAGS.loadBearing) !== 0,
      normalLoadKnown: (flags & VEHICLE_RENDER_WHEEL_FLAGS.normalLoadKnown) !== 0,
      terrainDataAvailable: (flags & VEHICLE_RENDER_WHEEL_FLAGS.terrainDataAvailable) !== 0,
      provisional: (flags & VEHICLE_RENDER_WHEEL_FLAGS.provisional) !== 0,
      inContact: (flags & VEHICLE_RENDER_WHEEL_FLAGS.loadBearing) !== 0
    };
    suspensionPose[wheelId] = values[VEHICLE_RENDER_SNAPSHOT_FLOAT.suspensionPose + index];
    tireTemperature[wheelId] = values[VEHICLE_RENDER_SNAPSHOT_FLOAT.tireTemperature + index];
    wheelAngularVelocity[wheelId] = values[VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelAngularVelocity + index];
    offset += VEHICLE_RENDER_WHEEL_STRIDE;
  }
  return reconstructVehicleRenderState({
    schemaVersion: VEHICLE_RENDER_STATE_SCHEMA_VERSION,
    protocolVersion: header[VEHICLE_RENDER_SNAPSHOT_HEADER.protocolVersion],
    stepIndex: header[VEHICLE_RENDER_SNAPSHOT_HEADER.stepIndex],
    eventSequence: header[VEHICLE_RENDER_SNAPSHOT_HEADER.eventSequence],
    visualState: header[VEHICLE_RENDER_SNAPSHOT_HEADER.visualState],
    resetGeneration: header[VEHICLE_RENDER_SNAPSHOT_HEADER.resetGeneration],
    simulationTimeSeconds: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.simulationTimeSeconds],
    position: readVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.position),
    orientation: readQuaternion(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.orientation),
    velocity: readVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.velocity),
    angularVelocity: readVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.angularVelocity),
    wheels,
    suspensionPose,
    tireTemperature,
    wheelAngularVelocity,
    speedMps: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.speedMps],
    groundSpeedMps: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.groundSpeedMps],
    bodyLongitudinalSpeedMps: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.bodyLongitudinalSpeedMps],
    bodyLateralSpeedMps: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.bodyLateralSpeedMps],
    signedTravelSpeedMps: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.signedTravelSpeedMps],
    engineRpm: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.engineRpm],
    gear: Math.trunc(values[VEHICLE_RENDER_SNAPSHOT_FLOAT.gear])
  });
}

function lerp(left, right, alpha) {
  const from = finite(left);
  const to = finite(right, from);
  return from + (to - from) * alpha;
}

function interpolateVector(left = {}, right = {}, alpha) {
  return {
    x: lerp(left.x, right.x, alpha),
    y: lerp(left.y, right.y, alpha),
    z: lerp(left.z, right.z, alpha)
  };
}

function interpolateQuaternion(left = { x: 0, y: 0, z: 0, w: 1 }, right = left, alpha) {
  let dot = left.x * right.x + left.y * right.y + left.z * right.z + left.w * right.w;
  const sign = dot < 0 ? -1 : 1;
  dot *= sign;
  const x = lerp(left.x, right.x * sign, alpha);
  const y = lerp(left.y, right.y * sign, alpha);
  const z = lerp(left.z, right.z * sign, alpha);
  const w = lerp(left.w, right.w * sign, alpha);
  const inverseLength = 1 / Math.max(1e-12, Math.hypot(x, y, z, w));
  return { x: x * inverseLength, y: y * inverseLength, z: z * inverseLength, w: w * inverseLength };
}

function interpolateQuaternionWithAngularDirection(left, right, alpha, angularVelocity = {}) {
  const inverseLeft = { x: -left.x, y: -left.y, z: -left.z, w: left.w };
  let relative = {
    x: inverseLeft.w * right.x + inverseLeft.x * right.w
      + inverseLeft.y * right.z - inverseLeft.z * right.y,
    y: inverseLeft.w * right.y - inverseLeft.x * right.z
      + inverseLeft.y * right.w + inverseLeft.z * right.x,
    z: inverseLeft.w * right.z + inverseLeft.x * right.y
      - inverseLeft.y * right.x + inverseLeft.z * right.w,
    w: inverseLeft.w * right.w - inverseLeft.x * right.x
      - inverseLeft.y * right.y - inverseLeft.z * right.z
  };
  if (relative.w < 0) relative = {
    x: -relative.x, y: -relative.y, z: -relative.z, w: -relative.w
  };
  const vectorLength = Math.hypot(relative.x, relative.y, relative.z);
  if (vectorLength < 1e-10) return interpolateQuaternion(left, right, alpha);
  let axis = {
    x: relative.x / vectorLength,
    y: relative.y / vectorLength,
    z: relative.z / vectorLength
  };
  let angle = 2 * Math.atan2(vectorLength, Math.max(-1, Math.min(1, relative.w)));
  const directionDot = axis.x * finite(angularVelocity.x)
    + axis.y * finite(angularVelocity.y) + axis.z * finite(angularVelocity.z);
  if (directionDot < -1e-7) {
    axis = { x: -axis.x, y: -axis.y, z: -axis.z };
    angle = Math.PI * 2 - angle;
  }
  const halfAngle = angle * clamp(alpha, 0, 1) * 0.5;
  const sine = Math.sin(halfAngle);
  const delta = { x: axis.x * sine, y: axis.y * sine, z: axis.z * sine, w: Math.cos(halfAngle) };
  return {
    x: left.w * delta.x + left.x * delta.w + left.y * delta.z - left.z * delta.y,
    y: left.w * delta.y - left.x * delta.z + left.y * delta.w + left.z * delta.x,
    z: left.w * delta.z + left.x * delta.y - left.y * delta.x + left.z * delta.w,
    w: left.w * delta.w - left.x * delta.x - left.y * delta.y - left.z * delta.z
  };
}

function extrapolateQuaternion(orientation = {}, angularVelocity = {}, seconds = 0) {
  const magnitude = Math.hypot(
    finite(angularVelocity.x), finite(angularVelocity.y), finite(angularVelocity.z)
  );
  if (magnitude < 1e-9 || seconds <= 0) return { ...orientation };
  const halfAngle = magnitude * seconds * 0.5;
  const scale = Math.sin(halfAngle) / magnitude;
  const delta = {
    x: finite(angularVelocity.x) * scale,
    y: finite(angularVelocity.y) * scale,
    z: finite(angularVelocity.z) * scale,
    w: Math.cos(halfAngle)
  };
  return interpolateQuaternion(orientation, {
    x: orientation.w * delta.x + orientation.x * delta.w
      + orientation.y * delta.z - orientation.z * delta.y,
    y: orientation.w * delta.y - orientation.x * delta.z
      + orientation.y * delta.w + orientation.z * delta.x,
    z: orientation.w * delta.z + orientation.x * delta.y
      - orientation.y * delta.x + orientation.z * delta.w,
    w: orientation.w * delta.w - orientation.x * delta.x
      - orientation.y * delta.y - orientation.z * delta.z
  }, 1);
}

export function interpolateVehicleRenderSnapshots(previous, latest, renderTimeSeconds) {
  if (!previous) return latest || null;
  if (!latest) return previous;
  if (Number(previous.resetGeneration || 0) !== Number(latest.resetGeneration || 0)) {
    const coherent = reconstructVehicleRenderState({ ...latest });
    coherent.interpolationAlpha = 1;
    coherent.extrapolationDurationSeconds = 0;
    return coherent;
  }
  const duration = latest.simulationTimeSeconds - previous.simulationTimeSeconds;
  const alpha = duration > 0
    ? clamp((finite(renderTimeSeconds) - previous.simulationTimeSeconds) / duration, 0, 1)
    : 1;
  const wheels = {};
  const suspensionPose = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    const leftWheel = previous.wheels[wheelId];
    const rightWheel = latest.wheels[wheelId];
    let spinDelta = finite(rightWheel.spinAngleRad) - finite(leftWheel.spinAngleRad);
    const expectedDirection = Math.sign(lerp(
      leftWheel.wheelAngularVelocityRadps, rightWheel.wheelAngularVelocityRadps, alpha
    ));
    while (expectedDirection >= 0 && spinDelta < 0) spinDelta += Math.PI * 2;
    while (expectedDirection < 0 && spinDelta > 0) spinDelta -= Math.PI * 2;
    wheels[wheelId] = {
      hubPositionBody: interpolateVector(leftWheel.hubPositionBody, rightWheel.hubPositionBody, alpha),
      suspensionMountBody: interpolateVector(leftWheel.suspensionMountBody, rightWheel.suspensionMountBody, alpha),
      suspensionAxisBody: interpolateVector(leftWheel.suspensionAxisBody, rightWheel.suspensionAxisBody, alpha),
      contactPointWorld: interpolateVector(leftWheel.contactPointWorld, rightWheel.contactPointWorld, alpha),
      surfaceNormalWorld: interpolateVector(leftWheel.surfaceNormalWorld, rightWheel.surfaceNormalWorld, alpha),
      suspensionCompressionM: lerp(leftWheel.suspensionCompressionM, rightWheel.suspensionCompressionM, alpha),
      steeringAngleRad: lerp(leftWheel.steeringAngleRad, rightWheel.steeringAngleRad, alpha),
      spinAngleRad: finite(leftWheel.spinAngleRad) + spinDelta * alpha,
      camberAngleRad: lerp(leftWheel.camberAngleRad, rightWheel.camberAngleRad, alpha),
      toeAngleRad: lerp(leftWheel.toeAngleRad, rightWheel.toeAngleRad, alpha),
      wheelAngularVelocityRadps: lerp(leftWheel.wheelAngularVelocityRadps, rightWheel.wheelAngularVelocityRadps, alpha),
      normalLoadN: lerp(leftWheel.normalLoadN, rightWheel.normalLoadN, alpha),
      gripCoefficient: lerp(leftWheel.gripCoefficient, rightWheel.gripCoefficient, alpha),
      lateralForceN: lerp(leftWheel.lateralForceN, rightWheel.lateralForceN, alpha),
      selfAligningMomentNm: lerp(leftWheel.selfAligningMomentNm, rightWheel.selfAligningMomentNm, alpha),
      flags: rightWheel.flags,
      validTreadContact: rightWheel.validTreadContact,
      geometricContact: rightWheel.geometricContact,
      loadBearing: rightWheel.loadBearing,
      normalLoadKnown: rightWheel.normalLoadKnown
    };
    suspensionPose[wheelId] = lerp(
      previous.suspensionPose[wheelId], latest.suspensionPose[wheelId], alpha
    );
  }
  const extrapolationDurationSeconds = clamp(
    finite(renderTimeSeconds) - latest.simulationTimeSeconds, 0, 0.033
  );
  const result = {
    ...latest,
    simulationTimeSeconds: lerp(previous.simulationTimeSeconds, latest.simulationTimeSeconds, alpha),
    position: interpolateVector(previous.position, latest.position, alpha),
    orientation: interpolateQuaternionWithAngularDirection(
      previous.orientation,
      latest.orientation,
      alpha,
      interpolateVector(previous.angularVelocity, latest.angularVelocity, alpha)
    ),
    velocity: interpolateVector(previous.velocity, latest.velocity, alpha),
    angularVelocity: interpolateVector(previous.angularVelocity, latest.angularVelocity, alpha),
    wheels,
    suspensionPose,
    speedMps: lerp(previous.speedMps, latest.speedMps, alpha),
    groundSpeedMps: lerp(previous.groundSpeedMps, latest.groundSpeedMps, alpha),
    bodyLongitudinalSpeedMps: lerp(previous.bodyLongitudinalSpeedMps, latest.bodyLongitudinalSpeedMps, alpha),
    bodyLateralSpeedMps: lerp(previous.bodyLateralSpeedMps, latest.bodyLateralSpeedMps, alpha),
    signedTravelSpeedMps: lerp(previous.signedTravelSpeedMps, latest.signedTravelSpeedMps, alpha),
    engineRpm: lerp(previous.engineRpm, latest.engineRpm, alpha),
    interpolationAlpha: alpha,
    extrapolationDurationSeconds
  };
  if (extrapolationDurationSeconds > 0) {
    result.position = {
      x: result.position.x + result.velocity.x * extrapolationDurationSeconds,
      y: result.position.y + result.velocity.y * extrapolationDurationSeconds,
      z: result.position.z + result.velocity.z * extrapolationDurationSeconds
    };
    result.orientation = extrapolateQuaternion(
      result.orientation, result.angularVelocity, extrapolationDurationSeconds
    );
    for (const wheelId of RACE_WHEEL_IDS) {
      result.wheels[wheelId].spinAngleRad += Number(
        result.wheels[wheelId].wheelAngularVelocityRadps || 0
      ) * extrapolationDurationSeconds;
    }
  }
  return reconstructVehicleRenderState(result);
}
