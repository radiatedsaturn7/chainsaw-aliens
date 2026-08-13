import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';

export const VEHICLE_DYNAMICS_WORKER_PROTOCOL_VERSION = 2;
export const VEHICLE_RENDER_SNAPSHOT_HEADER_WORDS = 4;
export const VEHICLE_RENDER_SNAPSHOT_FLOATS = 133;
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
  visualState: 3
});

export const VEHICLE_RENDER_SNAPSHOT_FLOAT = Object.freeze({
  simulationTimeSeconds: 0,
  position: 1,
  orientation: 4,
  velocity: 8,
  angularVelocity: 11,
  wheelPoses: 14,
  suspensionPose: 114,
  tireTemperature: 118,
  speedMps: 122,
  groundSpeedMps: 123,
  bodyLongitudinalSpeedMps: 124,
  bodyLateralSpeedMps: 125,
  signedTravelSpeedMps: 126,
  engineRpm: 127,
  gear: 128,
  wheelAngularVelocity: 129
});

export const VEHICLE_RENDER_WHEEL_STRIDE = 25;
export const VEHICLE_RENDER_WHEEL_FLOAT = Object.freeze({
  position: 0,
  orientation: 3,
  contactPoint: 7,
  surfaceNormal: 10,
  suspensionMount: 13,
  suspensionAxis: 16,
  normalLoadN: 19,
  gripCoefficient: 20,
  steeringAngleRad: 21,
  lateralForceN: 22,
  selfAligningMomentNm: 23,
  flags: 24
});

export const VEHICLE_RENDER_WHEEL_FLAGS = Object.freeze({
  validTreadContact: 1,
  geometricContact: 2,
  loadBearing: 4,
  normalLoadKnown: 8
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
  values[VEHICLE_RENDER_SNAPSHOT_FLOAT.simulationTimeSeconds] = finite(snapshot.simulationTimeSeconds);
  writeVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.position, snapshot.position);
  writeQuaternion(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.orientation, snapshot.orientation);
  writeVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.velocity, snapshot.velocity);
  writeVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.angularVelocity, snapshot.angularVelocity);
  let offset = VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelPoses;
  for (const wheelId of RACE_WHEEL_IDS) {
    const pose = snapshot.wheelPoses?.[wheelId] || {};
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.position, pose.position);
    writeQuaternion(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.orientation, pose.orientation);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.contactPoint, pose.contactPoint);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.surfaceNormal, pose.normal);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionMount, pose.suspensionMount);
    writeVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionAxis, pose.suspensionAxis);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.normalLoadN] = finite(pose.normalLoadN);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.gripCoefficient] = finite(pose.gripCoefficient, 1);
    values[offset + VEHICLE_RENDER_WHEEL_FLOAT.steeringAngleRad] = finite(pose.steeringAngleRad);
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
  const wheelPoses = {};
  const suspensionPose = {};
  const tireTemperature = {};
  const wheelAngularVelocity = {};
  let offset = VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelPoses;
  for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
    const wheelId = RACE_WHEEL_IDS[index];
    const flags = Math.trunc(values[offset + VEHICLE_RENDER_WHEEL_FLOAT.flags]);
    wheelPoses[wheelId] = {
      position: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.position),
      orientation: readQuaternion(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.orientation),
      contactPoint: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.contactPoint),
      normal: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.surfaceNormal),
      suspensionMount: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionMount),
      suspensionAxis: readVector(values, offset + VEHICLE_RENDER_WHEEL_FLOAT.suspensionAxis),
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
      inContact: (flags & VEHICLE_RENDER_WHEEL_FLAGS.loadBearing) !== 0
    };
    suspensionPose[wheelId] = values[VEHICLE_RENDER_SNAPSHOT_FLOAT.suspensionPose + index];
    tireTemperature[wheelId] = values[VEHICLE_RENDER_SNAPSHOT_FLOAT.tireTemperature + index];
    wheelAngularVelocity[wheelId] = values[VEHICLE_RENDER_SNAPSHOT_FLOAT.wheelAngularVelocity + index];
    offset += VEHICLE_RENDER_WHEEL_STRIDE;
  }
  return {
    protocolVersion: header[VEHICLE_RENDER_SNAPSHOT_HEADER.protocolVersion],
    stepIndex: header[VEHICLE_RENDER_SNAPSHOT_HEADER.stepIndex],
    eventSequence: header[VEHICLE_RENDER_SNAPSHOT_HEADER.eventSequence],
    visualState: header[VEHICLE_RENDER_SNAPSHOT_HEADER.visualState],
    simulationTimeSeconds: values[VEHICLE_RENDER_SNAPSHOT_FLOAT.simulationTimeSeconds],
    position: readVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.position),
    orientation: readQuaternion(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.orientation),
    velocity: readVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.velocity),
    angularVelocity: readVector(values, VEHICLE_RENDER_SNAPSHOT_FLOAT.angularVelocity),
    wheelPoses,
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
  };
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

export function interpolateVehicleRenderSnapshots(previous, latest, renderTimeSeconds) {
  if (!previous) return latest || null;
  if (!latest) return previous;
  const duration = latest.simulationTimeSeconds - previous.simulationTimeSeconds;
  const alpha = duration > 0
    ? clamp((finite(renderTimeSeconds) - previous.simulationTimeSeconds) / duration, 0, 1)
    : 1;
  const wheelPoses = {};
  const suspensionPose = {};
  for (const wheelId of RACE_WHEEL_IDS) {
    wheelPoses[wheelId] = {
      position: interpolateVector(previous.wheelPoses[wheelId].position, latest.wheelPoses[wheelId].position, alpha),
      orientation: interpolateQuaternion(previous.wheelPoses[wheelId].orientation, latest.wheelPoses[wheelId].orientation, alpha),
      contactPoint: interpolateVector(previous.wheelPoses[wheelId].contactPoint, latest.wheelPoses[wheelId].contactPoint, alpha),
      normal: interpolateVector(previous.wheelPoses[wheelId].normal, latest.wheelPoses[wheelId].normal, alpha),
      suspensionMount: interpolateVector(previous.wheelPoses[wheelId].suspensionMount, latest.wheelPoses[wheelId].suspensionMount, alpha),
      suspensionAxis: interpolateVector(previous.wheelPoses[wheelId].suspensionAxis, latest.wheelPoses[wheelId].suspensionAxis, alpha),
      normalLoadN: lerp(previous.wheelPoses[wheelId].normalLoadN, latest.wheelPoses[wheelId].normalLoadN, alpha),
      gripCoefficient: lerp(previous.wheelPoses[wheelId].gripCoefficient, latest.wheelPoses[wheelId].gripCoefficient, alpha),
      steeringAngleRad: lerp(previous.wheelPoses[wheelId].steeringAngleRad, latest.wheelPoses[wheelId].steeringAngleRad, alpha),
      lateralForceN: lerp(previous.wheelPoses[wheelId].lateralForceN, latest.wheelPoses[wheelId].lateralForceN, alpha),
      selfAligningMomentNm: lerp(previous.wheelPoses[wheelId].selfAligningMomentNm, latest.wheelPoses[wheelId].selfAligningMomentNm, alpha),
      flags: latest.wheelPoses[wheelId].flags,
      validTreadContact: latest.wheelPoses[wheelId].validTreadContact,
      geometricContact: latest.wheelPoses[wheelId].geometricContact,
      loadBearing: latest.wheelPoses[wheelId].loadBearing,
      normalLoadKnown: latest.wheelPoses[wheelId].normalLoadKnown,
      inContact: latest.wheelPoses[wheelId].inContact
    };
    suspensionPose[wheelId] = lerp(
      previous.suspensionPose[wheelId], latest.suspensionPose[wheelId], alpha
    );
  }
  return {
    ...latest,
    simulationTimeSeconds: lerp(previous.simulationTimeSeconds, latest.simulationTimeSeconds, alpha),
    position: interpolateVector(previous.position, latest.position, alpha),
    orientation: interpolateQuaternion(previous.orientation, latest.orientation, alpha),
    velocity: interpolateVector(previous.velocity, latest.velocity, alpha),
    angularVelocity: interpolateVector(previous.angularVelocity, latest.angularVelocity, alpha),
    wheelPoses,
    suspensionPose,
    speedMps: lerp(previous.speedMps, latest.speedMps, alpha),
    groundSpeedMps: lerp(previous.groundSpeedMps, latest.groundSpeedMps, alpha),
    bodyLongitudinalSpeedMps: lerp(previous.bodyLongitudinalSpeedMps, latest.bodyLongitudinalSpeedMps, alpha),
    bodyLateralSpeedMps: lerp(previous.bodyLateralSpeedMps, latest.bodyLateralSpeedMps, alpha),
    signedTravelSpeedMps: lerp(previous.signedTravelSpeedMps, latest.signedTravelSpeedMps, alpha),
    engineRpm: lerp(previous.engineRpm, latest.engineRpm, alpha),
    interpolationAlpha: alpha
  };
}
