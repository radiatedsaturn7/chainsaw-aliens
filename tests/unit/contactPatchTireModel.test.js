import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContactPatchTireModel,
  calculateBrushTireForce,
  calculateAquaplaningState,
  calculateVelocitySensitiveDamperForce,
  calculateWheelContactKinematics,
  getAckermannSteeringAngles
} from '../../src/racing/simulation/ContactPatchTireModel.js';
import { advanceTireThermalState } from '../../src/racing/simulation/TireThermalModel.js';
import { createVehicleDynamicsConfig, createVehicleDynamicsState } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { RACE_TIRE_COMPOUNDS } from '../../src/racing/raceData.js';
import { resolveCompoundSurfaceGrip } from '../../src/racing/simulation/SurfaceConditionGrip.js';
import { quaternionFromEuler } from '../../src/racing/simulation/RigidBodyMath.js';

const config = createVehicleDynamicsConfig({
  massKg: 1400,
  wheelbaseM: 2.7,
  frontTrackWidthM: 1.6,
  rearTrackWidthM: 1.58,
  wheelRadiusM: 0.33,
  maxSteerAngleRad: 0.55,
  drivenWheelIds: ['rl', 'rr']
});
const controls = { steering: 0, throttle: 0, brake: 0, handbrake: 0, requestedGear: 1 };
const stateAt = ({ speed = 15, yawRate = 0, wheelOmega = null } = {}) => createVehicleDynamicsState({
  speedMps: speed,
  velocity: { x: 0, y: 0, z: speed },
  yawRateRadps: yawRate,
  wheelAngularVelocityRadps: wheelOmega || { fl: speed / 0.33, fr: speed / 0.33, rl: speed / 0.33, rr: speed / 0.33 }
});
const environment = {
  surfaceNormalByWheel: { fl: { x: 0, y: 1, z: 0 }, fr: { x: 0, y: 1, z: 0 }, rl: { x: 0, y: 1, z: 0 }, rr: { x: 0, y: 1, z: 0 } }
};

test('Ackermann geometry gives inside and outside front wheels independent steering and slip angles', () => {
  const angles = getAckermannSteeringAngles({ steeringAngleRad: 0.42, wheelbaseM: 2.7, frontTrackWidthM: 1.6 });
  assert.ok(angles.fr > angles.fl);
  const turning = stateAt({ yawRate: 0.7 });
  const fl = calculateWheelContactKinematics({ state: turning, config, controls: { ...controls, steering: 0.75 }, environment, wheelId: 'fl' });
  const fr = calculateWheelContactKinematics({ state: turning, config, controls: { ...controls, steering: 0.75 }, environment, wheelId: 'fr' });
  assert.notEqual(fl.steeringAngleRad, fr.steeringAngleRad);
  assert.notEqual(fl.slipAngleRad, fr.slipAngleRad);
});

test('signed slip distinguishes braking, locked wheels, and wheelspin', () => {
  const make = (omega) => calculateWheelContactKinematics({
    state: stateAt({ speed: 12, wheelOmega: { fl: omega, fr: omega, rl: omega, rr: omega } }),
    config, controls, environment, wheelId: 'rl'
  });
  assert.ok(make(50).slipRatio > 0);
  assert.ok(make(20).slipRatio < 0);
  assert.ok(make(0).slipRatio < -0.99);
  assert.ok(make(80).slipRatio > 1);
});

test('inverted suspension rejects wrong-side tread support while wheels remain free to spin', () => {
  const model = new ContactPatchTireModel();
  const inverted = createVehicleDynamicsState({
    position: { x: 0, y: config.bodyHeightM - config.cgHeightM, z: 0 },
    orientation: quaternionFromEuler({ roll: Math.PI }),
    grounded: false,
    wheelAngularVelocityRadps: { fl: 0, fr: 0, rl: 40, rr: 40 }
  });
  const result = model.step({
    state: inverted,
    controls: { ...controls, throttle: 1 },
    config,
    dt: 1 / 360,
    environment: {
      surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
      surfaceNormalByWheel: environment.surfaceNormalByWheel
    }
  });
  assert.equal(result.wheelGrounded, false);
  assert.equal(result.supportedWheelCount, 0);
  assert.deepEqual(result.validTreadContactByWheel, {
    fl: false, fr: false, rl: false, rr: false
  });
  assert.ok(Object.values(result.invalidContactReasonByWheel).every(Boolean));
  assert.deepEqual(result.worldForceN, { x: 0, y: 0, z: 0 });
  assert.deepEqual(result.suspensionForceWorldN, { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(result.wheelAngularVelocityRadps.rl) > 1);
  assert.ok(Math.abs(result.wheelAngularVelocityRadps.rr) > 1);
});

test('side-resting suspension cannot turn steering or wheelspin into chassis tire force', () => {
  const model = new ContactPatchTireModel();
  const sideResting = createVehicleDynamicsState({
    position: { x: 0, y: config.bodyWidthM * 0.5, z: 0 },
    orientation: quaternionFromEuler({ roll: Math.PI / 2 }),
    grounded: false,
    wheelAngularVelocityRadps: { fl: 30, fr: 30, rl: 50, rr: 50 }
  });
  const result = model.step({
    state: sideResting,
    controls: { ...controls, steering: 1, throttle: 1 },
    config,
    dt: 1 / 360,
    environment: {
      surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
      surfaceNormalByWheel: environment.surfaceNormalByWheel
    }
  });
  assert.equal(result.supportedWheelCount, 0);
  assert.deepEqual(result.worldForceN, { x: 0, y: 0, z: 0 });
  assert.deepEqual(result.suspensionForceWorldN, { x: 0, y: 0, z: 0 });
  assert.ok(Object.values(result.contactPatches).every((patch) => (
    patch.worldForceN.x === 0 && patch.worldForceN.y === 0 && patch.worldForceN.z === 0
  )));
});

test('substep wheel inertia settles sub-limit launch torque without false slip oscillation', () => {
  const model = new ContactPatchTireModel();
  const launchConfig = createVehicleDynamicsConfig({
    ...config,
    drivenWheelIds: ['fl', 'fr', 'rl', 'rr'],
    enginePeakTorqueNm: 258,
    powertrainTuning: {
      drivetrain: 'awd',
      gearRatios: [3.46],
      finalDrive: 4.11,
      drivetrainEfficiency: 0.88
    }
  });
  const launchState = stateAt({ speed: 0 });
  const surfaceHeightByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
  let maxSlipRatio = 0;
  for (let substep = 0; substep < 120; substep += 1) {
    const result = model.step({
      state: launchState,
      controls: { ...controls, throttle: 0.35 },
      config: launchConfig,
      dt: 1 / 360,
      environment: {
        surfaceHeightByWheel,
        materialByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((wheelId) => [
          wheelId,
          { baseSurfaceId: 'dirt', surfaceId: 'dirt', grip: 0.72 }
        ]))
      }
    });
    launchState.wheelAngularVelocityRadps = result.wheelAngularVelocityRadps;
    maxSlipRatio = Math.max(
      maxSlipRatio,
      ...Object.values(result.contactPatches).map((patch) => Math.abs(Number(patch.slipRatio || 0)))
    );
  }
  assert.ok(maxSlipRatio < 0.08, `expected stable static launch slip, received ${maxSlipRatio}`);
});

test('aquaplaning evacuates water per tire and unloads forces instead of applying static grip', () => {
  const kinematics = {
    longitudinalVelocityMps: 42,
    lateralVelocityMps: 1.5,
    wheelAngularVelocityRadps: 130,
    effectiveRollingRadiusM: 0.33,
    slipRatio: 0.08
  };
  const shallow = calculateAquaplaningState({
    kinematics, normalLoadN: 3600,
    tire: { widthMm: 245, pressurePsi: 34, treadDepthMm: 7 },
    material: { standingWaterDepthMm: 0.2 }
  });
  const flooded = calculateAquaplaningState({
    kinematics, normalLoadN: 3600,
    tire: { widthMm: 285, pressurePsi: 24, treadDepthMm: 1.2 },
    material: { standingWaterDepthMm: 7 }
  });
  assert.ok(flooded.liftFraction > shallow.liftFraction);
  assert.ok(flooded.supportedNormalLoadN < shallow.supportedNormalLoadN);
  assert.ok(flooded.lateralForceScale < flooded.longitudinalForceScale);
  assert.ok(flooded.displacedWaterVolumeM3ps > 0);
});

test('three-node tire thermal state couples surface, airflow, water, and pressure', () => {
  const base = { temperatureF: 100, coldPressurePsi: 32, pressureReferenceTemperatureC: 20 };
  const hot = advanceTireThermalState({
    previous: base, dt: 1,
    patch: { longitudinalForceN: 3500, lateralForceN: 1800, longitudinalVelocityMps: 25,
      lateralVelocityMps: 3, wheelAngularVelocityRadps: 95, effectiveRollingRadiusM: 0.33,
      slipRatio: 0.25, slipAngleRad: 0.12, normalLoadN: 3800 },
    material: { surfaceTemperatureC: 55 }, ambientTemperatureC: 30
  });
  const wet = advanceTireThermalState({
    previous: base, dt: 1,
    patch: { longitudinalVelocityMps: 25, wheelAngularVelocityRadps: 75,
      effectiveRollingRadiusM: 0.33, normalLoadN: 3800 },
    material: { surfaceTemperatureC: 5, standingWaterDepthMm: 5 }, ambientTemperatureC: 5
  });
  assert.ok(hot.treadTemperatureC > wet.treadTemperatureC);
  assert.notEqual(hot.treadTemperatureC, hot.carcassTemperatureC);
  assert.notEqual(hot.carcassTemperatureC, hot.internalAirTemperatureC);
  assert.ok(hot.effectivePressurePsi > 32);
});

test('split grip and an unloaded wheel produce independent finite force limits', () => {
  const model = new ContactPatchTireModel();
  const result = model.step({
    state: stateAt({ speed: 10, wheelOmega: { fl: 45, fr: 45, rl: 45, rr: 45 } }),
    controls: { ...controls, steering: 0.35, brake: 0.4 }, config, dt: 1 / 360,
    environment: {
      normalLoadByWheel: { fl: 3500, fr: 3500, rl: 0, rr: 3500 },
      materialByWheel: { fl: { grip: 0.25 }, fr: { grip: 1 }, rl: { grip: 1 }, rr: { grip: 1 } }
    }
  });
  assert.ok(result.contactPatches.fl.combinedSlipLimitN < result.contactPatches.fr.combinedSlipLimitN);
  assert.equal(result.contactPatches.rl.combinedSlipLimitN, 0);
  assert.equal(result.contactPatches.rl.worldForceN.x, 0);
  for (const wheel of Object.values(result.contactPatches)) {
    Object.values(wheel.worldForceN).forEach((value) => assert.ok(Number.isFinite(value)));
  }
});

test('known surface geometry never gives airborne wheels fallback static load', () => {
  const model = new ContactPatchTireModel();
  const surfaceHeightByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
  const airborneState = createVehicleDynamicsState({
    position: { x: 0, y: config.cgHeightM + 1, z: 0 },
    velocity: { x: 0, y: 0, z: 20 },
    speedMps: 20
  });
  const result = model.step({
    state: airborneState,
    controls: { ...controls, steering: 1, throttle: 1, brake: 1, handbrake: 1 },
    config,
    dt: 1 / 360,
    environment: { surfaceHeightByWheel }
  });

  assert.equal(result.grounded, false);
  assert.deepEqual(result.wheelLoadsN, { fl: 0, fr: 0, rl: 0, rr: 0 });
  assert.deepEqual(result.suspensionForceWorldN, { x: 0, y: 0, z: 0 });
  assert.deepEqual(result.worldForceN, { x: 0, y: 0, z: 0 });
  assert.equal(result.worldMomentNm.y, 0);
  assert.ok(Math.abs(result.worldMomentNm.x) > 1);
});

test('airborne wheel acceleration and braking conserve wheel-plus-chassis angular momentum', () => {
  const model = new ContactPatchTireModel();
  const airborneConfig = createVehicleDynamicsConfig({
    ...config,
    drivenWheelIds: ['fl', 'fr', 'rl', 'rr'],
    enginePeakTorqueNm: 320,
    powertrainTuning: { drivetrain: 'awd', gearRatios: [3.4, 1.9], finalDrive: 4.1 }
  });
  const initialOmega = 20 / airborneConfig.wheelRadiusM;
  const makeState = () => createVehicleDynamicsState({
    position: { x: 0, y: airborneConfig.cgHeightM + 2, z: 0 },
    velocity: { x: 0, y: 0, z: 20 },
    speedMps: 20,
    engineRpm: 4500,
    gear: 2,
    wheelAngularVelocityRadps: {
      fl: initialOmega, fr: initialOmega, rl: initialOmega, rr: initialOmega
    }
  });
  const run = (input) => model.step({
    state: makeState(),
    controls: { ...controls, requestedGear: 2, ...input },
    config: airborneConfig,
    dt: 1 / 360,
    environment: {
      grounded: false,
      surfaceHeightByWheel: { fl: Number.NaN, fr: Number.NaN, rl: Number.NaN, rr: Number.NaN }
    }
  });
  const accelerating = run({ throttle: 1, brake: 0 });
  const braking = run({ throttle: 0, brake: 1 });

  for (const result of [accelerating, braking]) {
    for (const wheelId of ['fl', 'fr', 'rl', 'rr']) {
      const patch = result.contactPatches[wheelId];
      const deltaOmega = result.wheelAngularVelocityRadps[wheelId] - initialOmega;
      const expectedImpulse = -airborneConfig.wheelInertiaKgM2 * deltaOmega;
      const reaction = result.wheelAngularMomentumReactionImpulseWorldNms[wheelId];
      const projectedReaction = reaction.x * patch.wheelLateralWorld.x
        + reaction.y * patch.wheelLateralWorld.y
        + reaction.z * patch.wheelLateralWorld.z;
      assert.ok(Math.abs(projectedReaction - expectedImpulse) < 1e-4,
        `${wheelId}: ${projectedReaction} versus ${expectedImpulse}`);
    }
    assert.equal(result.worldMomentNm.y, 0, 'airborne steering/torque must not invent yaw');
  }
  assert.ok(accelerating.worldMomentNm.x * braking.worldMomentNm.x < 0,
    'acceleration and braking must create opposite pitch reactions');
  assert.ok(accelerating.wheelAngularVelocityRadps.fl > initialOmega);
  assert.ok(braking.wheelAngularVelocityRadps.fl < initialOmega);
});

test('geometric suspension preload supports weight and unloads continuously at full droop', () => {
  const model = new ContactPatchTireModel();
  const heights = { fl: 0, fr: 0, rl: 0, rr: 0 };
  const evaluate = (heightM) => model.step({
    state: createVehicleDynamicsState({ position: { x: 0, y: heightM, z: 0 } }),
    controls,
    config,
    dt: 1 / 360,
    environment: { surfaceHeightByWheel: heights }
  });
  const supported = evaluate(config.cgHeightM);
  assert.ok(Math.abs(Object.values(supported.wheelLoadsN).reduce((sum, load) => sum + load, 0)
    - config.massKg * 9.81) < 0.01);
  const staticCompressionM = (config.massKg * 9.81 / 4)
    / supported.suspensionState.fl.geometry.wheelRateNpm;
  const nearDroop = evaluate(config.cgHeightM + staticCompressionM - 0.0001);
  const beyondDroop = evaluate(config.cgHeightM + staticCompressionM + 0.0001);
  assert.ok(nearDroop.wheelLoadsN.fl < 5);
  assert.equal(beyondDroop.wheelLoadsN.fl, 0);
});

test('velocity-sensitive dampers use continuous digressive bump and rebound slopes', () => {
  const options = {
    bumpDamperNsM: 2850,
    reboundDamperNsM: 4050,
    highSpeedThresholdMps: 0.25,
    highSpeedScale: 0.62
  };
  const atThreshold = calculateVelocitySensitiveDamperForce({
    ...options,
    relativeVelocityMps: 0.25
  });
  const justAbove = calculateVelocitySensitiveDamperForce({
    ...options,
    relativeVelocityMps: 0.250001
  });
  const highSpeed = calculateVelocitySensitiveDamperForce({
    ...options,
    relativeVelocityMps: 1
  });
  const rebound = calculateVelocitySensitiveDamperForce({
    ...options,
    relativeVelocityMps: -1
  });

  assert.equal(atThreshold, 712.5);
  assert.ok(Math.abs(justAbove - atThreshold) < 0.01);
  assert.equal(highSpeed, 2037.75);
  assert.equal(rebound, -2895.75);
  assert.ok(highSpeed < 2850, 'high-speed damping must use the reduced slope, not multiply the full force');
});

test('physical deceleration differential allocates engine braking by per-wheel capacity', () => {
  const model = new ContactPatchTireModel();
  const decelConfig = createVehicleDynamicsConfig({
    ...config,
    drivenWheelIds: ['rl', 'rr'],
    powertrainTuning: { drivetrain: 'rwd', rearDifferentialDecel: 1 }
  });
  const result = model.step({
    state: stateAt({ speed: 18 }),
    controls: { ...controls, throttle: 0, requestedGear: 3 },
    config: decelConfig,
    dt: 1 / 360,
    environment: {
      normalLoadByWheel: { fl: 3500, fr: 3500, rl: 3500, rr: 3500 },
      materialByWheel: { fl: { grip: 1 }, fr: { grip: 1 }, rl: { grip: 0.35 }, rr: { grip: 1.1 } }
    }
  });
  assert.ok(result.driveForceShareByWheel.rr > result.driveForceShareByWheel.rl);
  assert.ok(Math.abs(result.driveForceShareByWheel.rl + result.driveForceShareByWheel.rr - 1) < 1e-9);
});

test('combined braking/acceleration and cornering stay inside the brush combined-slip limit', () => {
  const cases = [
    { slipRatio: -0.35, slipAngleRad: 0.18 },
    { slipRatio: 0.42, slipAngleRad: -0.16 }
  ];
  for (const kinematics of cases) {
    const force = calculateBrushTireForce({
      kinematics: { ...kinematics, camberAngleRad: -0.02 }, normalLoadN: 3800,
      tire: { pressurePsi: 30, widthMm: 265 }, material: { grip: 1 }
    });
    assert.notEqual(force.longitudinalForceN, 0);
    assert.notEqual(force.lateralForceN, 0);
    assert.ok(Math.hypot(force.longitudinalForceN, force.lateralForceN) <= force.combinedSlipLimitN + 1e-6);
    assert.ok(force.utilization <= 1.000001);
  }
});

test('banked-road forces stay in the local surface tangent plane and retain application points', () => {
  const normal = { x: 0.25, y: Math.sqrt(1 - 0.25 ** 2), z: 0 };
  const model = new ContactPatchTireModel();
  const result = model.step({
    state: stateAt({ speed: 16, yawRate: 0.4 }), controls: { ...controls, steering: 0.5 }, config, dt: 1 / 360,
    environment: { surfaceNormalByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((id) => [id, normal])) }
  });
  for (const patch of Object.values(result.contactPatches)) {
    const normalComponent = patch.worldForceN.x * patch.surfaceNormalWorld.x
      + patch.worldForceN.y * patch.surfaceNormalWorld.y
      + patch.worldForceN.z * patch.surfaceNormalWorld.z;
    assert.ok(Math.abs(normalComponent) < 0.01);
    assert.deepEqual(patch.forceApplicationPointWorld, patch.contactPointWorld);
    assert.deepEqual(patch.momentApplicationPointWorld, patch.contactPointWorld);
  }
});

test('force is finite and continuous through zero contact speed', () => {
  const model = new ContactPatchTireModel();
  const forces = [-0.0000001, 0, 0.0000001].map((speed) => model.step({
    state: stateAt({ speed, wheelOmega: { fl: 0, fr: 0, rl: 0, rr: 0 } }),
    controls, config, dt: 1 / 360, environment: {}
  }).contactPatches.fl.worldForceN.z);
  forces.forEach((force) => assert.ok(Number.isFinite(force)));
  assert.ok(Math.abs(forces[2] - forces[0]) < 1);
});

test('post-peak force falls smoothly and aligning torque provides pneumatic return', () => {
  const common = { normalLoadN: 3600, tire: {}, material: { grip: 1 } };
  const peak = calculateBrushTireForce({ ...common, kinematics: { slipRatio: 0.16, slipAngleRad: 0, camberAngleRad: 0 } });
  const slide = calculateBrushTireForce({ ...common, kinematics: { slipRatio: 3, slipAngleRad: 0, camberAngleRad: 0 } });
  assert.ok(slide.postPeakSlidingForceN < peak.combinedSlipLimitN);
  const corner = calculateBrushTireForce({ ...common, kinematics: { slipRatio: 0, slipAngleRad: 0.08, camberAngleRad: 0 } });
  assert.ok(corner.pneumaticTrailM > 0);
  assert.ok(corner.selfAligningMomentNm * corner.lateralForceN <= 0);
});

test('brush-to-sliding transition is continuous in value and first derivative', () => {
  const normalLoadN = 3600;
  const tire = { compoundGrip: 1, longitudinalStiffnessN: normalLoadN * 18 };
  const material = { surfaceGripScale: 1 };
  const peakSlipRatio = (3 * normalLoadN) / tire.longitudinalStiffnessN;
  const forceAt = (slipRatio) => calculateBrushTireForce({
    normalLoadN,
    tire,
    material,
    kinematics: { slipRatio, slipAngleRad: 0, camberAngleRad: 0 }
  }).longitudinalForceN;
  const delta = 1e-4;
  const leftValue = forceAt(peakSlipRatio - delta);
  const peakValue = forceAt(peakSlipRatio);
  const rightValue = forceAt(peakSlipRatio + delta);
  const leftDerivative = (peakValue - leftValue) / delta;
  const rightDerivative = (rightValue - peakValue) / delta;

  assert.ok(Math.abs(rightValue - leftValue) < 1);
  assert.ok(Math.abs(rightDerivative - leftDerivative) < 250);
  assert.ok(Math.abs(peakValue - normalLoadN) < 0.01);

  const configuredTire = { ...tire, peakSlip: 0.24, slidingFrictionRatio: 0.72 };
  const configuredForceAt = (slipRatio) => calculateBrushTireForce({
    normalLoadN,
    tire: configuredTire,
    material,
    kinematics: { slipRatio, slipAngleRad: 0, camberAngleRad: 0 }
  }).longitudinalForceN;
  const configuredLeft = configuredForceAt(configuredTire.peakSlip - delta);
  const configuredPeak = configuredForceAt(configuredTire.peakSlip);
  const configuredRight = configuredForceAt(configuredTire.peakSlip + delta);
  assert.ok(Math.abs(configuredRight - configuredLeft) < 1);
  assert.ok(Math.abs(
    (configuredRight - configuredPeak) / delta
      - (configuredPeak - configuredLeft) / delta
  ) < 250);
  assert.ok(Math.abs(configuredPeak - normalLoadN) < 0.01);
});

test('relaxation length and breakaway hysteresis preserve per-wheel transition state', () => {
  const model = new ContactPatchTireModel();
  const transitionConfig = createVehicleDynamicsConfig({
    ...config,
    tireByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map((wheelId) => [wheelId, {
        relaxationLengthM: 1.2,
        peakSlip: 0.12,
        breakawayHysteresis: 0.02,
        recoveryHysteresis: 0.04
      }]))
  });
  const transitionState = stateAt({ speed: 20 });
  const neutral = model.step({
    state: transitionState,
    controls,
    config: transitionConfig,
    dt: 1 / 360,
    environment
  });
  transitionState.contactPatches = neutral.contactPatches;
  const turnIn = model.step({
    state: transitionState,
    controls: { ...controls, steering: 1 },
    config: transitionConfig,
    dt: 1 / 360,
    environment
  });
  const front = turnIn.contactPatches.fl;
  assert.ok(Math.abs(front.relaxedSlipAngleRad) < Math.abs(front.rawSlipAngleRad));

  transitionState.contactPatches = {
    ...turnIn.contactPatches,
    fl: { ...front, breakawayActive: true }
  };
  const recovering = model.step({
    state: transitionState,
    controls: { ...controls, steering: 0.25 },
    config: transitionConfig,
    dt: 1 / 360,
    environment
  });
  assert.equal(typeof recovering.contactPatches.fl.breakawayActive, 'boolean');
  assert.equal(recovering.contactPatches.fl.relaxationLengthM, 1.2);
});

test('compound, pressure, size, temperature, wear, damage, load sensitivity, and Track State contamination affect grip', () => {
  const kinematics = { slipRatio: 0.2, slipAngleRad: 0.08, camberAngleRad: 0 };
  const healthy = calculateBrushTireForce({
    kinematics, normalLoadN: 3500,
    tire: { compoundGrip: 1.1, pressurePsi: 32, widthMm: 285, temperatureF: 190, wear: 0, damage: 0, loadSensitivityExponent: 0.1 },
    material: { grip: 1, standingWaterDepthMm: 0, snowDepthMm: 0, iceDepthMm: 0, dirt: 0, mud: 0, oil: 0, looseMarbles: 0, roughness: 0 }
  });
  const contaminated = calculateBrushTireForce({
    kinematics, normalLoadN: 3500,
    tire: { compoundGrip: 0.9, pressurePsi: 45, widthMm: 205, temperatureF: 330, wear: 0.7, damage: 50, loadSensitivityExponent: 0.1 },
    material: { grip: 1, standingWaterDepthMm: 6, snowDepthMm: 20, iceDepthMm: 1, dirt: 0.5, mud: 0.5, oil: 0.4, looseMarbles: 0.5, roughness: 0.6 }
  });
  assert.ok(healthy.gripCoefficient > contaminated.gripCoefficient);
});

test('Track State snow and compound grip remain continuous across the display-surface threshold', () => {
  const compound = RACE_TIRE_COMPOUNDS.find((entry) => entry.id === 'tarmac');
  const gripAt = (snowDepthMm) => {
    const effectiveGrip = 1 - Math.min(1, snowDepthMm / 35) * 0.42;
    const material = {
      baseSurfaceId: 'asphalt',
      surfaceId: snowDepthMm > 2 ? 'snow' : 'asphalt',
      snowDepthMm,
      effectiveGrip,
      grip: effectiveGrip,
      trackStateConditionApplied: true
    };
    const compoundGrip = resolveCompoundSurfaceGrip(compound, material);
    const force = calculateBrushTireForce({
      kinematics: { slipRatio: 0.08, slipAngleRad: 0.06, camberAngleRad: 0 },
      normalLoadN: 4000,
      tire: { compound, pressurePsi: 32, effectivePressurePsi: 32, targetPressurePsi: 32,
        treadTemperatureC: 75, referenceLoadN: 4000, widthMm: 245 },
      material
    });
    return { compoundGrip, mu: force.gripCoefficient };
  };
  const before = gripAt(1.99);
  const after = gripAt(2.01);
  assert.ok(Math.abs(after.compoundGrip - before.compoundGrip) < 0.002);
  assert.ok(Math.abs(after.mu - before.mu) < 0.002);
  assert.ok(gripAt(10).mu < after.mu);
  assert.ok(gripAt(35).mu < gripAt(10).mu);
  assert.ok(gripAt(35).mu > 0.1, 'deep snow must not receive the same penalty repeatedly');
});

test('Track State grip scale does not apply the base gravel coefficient twice', () => {
  const compound = RACE_TIRE_COMPOUNDS.find((entry) => entry.id === 'tarmac');
  const material = {
    baseSurfaceId: 'gravel',
    surfaceId: 'snow',
    snowDepthMm: 4,
    effectiveGrip: 0.64189,
    effectiveGripMultiplier: 0.943956,
    surfaceGripScale: 0.943956,
    trackStateConditionApplied: true
  };
  const compoundGrip = resolveCompoundSurfaceGrip(compound, material);
  const force = calculateBrushTireForce({
    kinematics: { slipRatio: 0.08, slipAngleRad: 0.04, camberAngleRad: 0 },
    normalLoadN: 4000,
    tire: {
      compound,
      pressurePsi: 32,
      effectivePressurePsi: 32,
      targetPressurePsi: 32,
      treadTemperatureC: 75,
      referenceLoadN: 4000,
      widthMm: 245
    },
    material
  });

  assert.ok(Math.abs(force.gripCoefficient - compoundGrip * material.surfaceGripScale) < 0.00001);
  assert.ok(force.gripCoefficient > compoundGrip * material.effectiveGrip + 0.15);
});
