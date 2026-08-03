import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AeroModel,
  BrakeModel,
  ChassisIntegrator,
  DamageModel,
  HandlingAssist,
  PowertrainModel,
  SurfaceModel,
  SuspensionModel,
  TireModel,
  createRaceSimulationSystems
} from '../../src/racing/simulation/RaceSimulationSystems.js';
import {
  getAuthoritativeChassisState,
  getAuthoritativeVehicleState,
  getVehicleStateSnapshot
} from '../../src/racing/simulation/VehicleState.js';

const steeringConfig = {
  speedReferenceMps: 62,
  digitalResponseBase: 84,
  digitalResponseLowSpeedBonus: 36,
  analogResponseBase: 16,
  analogResponseLowSpeedBonus: 5.5,
  analogTargetPressBase: 4,
  analogTargetPressLowSpeedBonus: 2,
  analogTargetReleaseBase: 7.5,
  analogTargetReleaseHighSpeedBonus: 3.8,
  stoppedAuthority: 1,
  highwayAuthority: 0.2,
  parkingTireAngleRad: 0.56,
  highwayTireAngleRad: 0.045,
  returnRateBase: 20,
  returnRateHighSpeedBonus: 18,
  steeringRatio: 14.5,
  maxSteeringWheelRotationRad: Math.PI * 3
};

test('simulation registry owns every required vehicle subsystem', () => {
  const systems = createRaceSimulationSystems({ steeringConfig });
  assert.ok(systems.chassis instanceof ChassisIntegrator);
  assert.ok(systems.tires instanceof TireModel);
  assert.ok(systems.suspension instanceof SuspensionModel);
  assert.ok(systems.powertrain instanceof PowertrainModel);
  assert.ok(systems.brakes instanceof BrakeModel);
  assert.ok(systems.aero instanceof AeroModel);
  assert.ok(systems.surface instanceof SurfaceModel);
  assert.ok(systems.damage instanceof DamageModel);
  assert.ok(systems.handlingAssist instanceof HandlingAssist);
  assert.ok(Object.isFrozen(systems));
});

test('playtest session remains the single authoritative vehicle aggregate', () => {
  const session = {
    worldX: 4,
    worldZ: 8,
    speedMps: 12,
    carYaw: 0.3,
    bodyY: 1,
    vehicle3d: {
      enabled: true,
      position: { y: 2.5 },
      linearVelocity: { y: -1.2 },
      pitch: 0.1,
      roll: -0.2
    }
  };
  assert.equal(getAuthoritativeVehicleState(session), session);
  assert.equal(getAuthoritativeChassisState(session), session.vehicle3d);
  const snapshot = getVehicleStateSnapshot(session);
  assert.equal(snapshot.bodyY, 2.5);
  assert.equal(snapshot.verticalVelocityMps, -1.2);
  assert.equal(snapshot.chassis, session.vehicle3d);
});

test('powertrain resolves driven wheels and honors axle/center capacity for every layout', () => {
  const powertrain = new PowertrainModel();
  assert.deepEqual(powertrain.getDrivenWheelIds({ drivetrain: 'fwd' }), ['fl', 'fr']);
  assert.deepEqual(powertrain.getDrivenWheelIds({ drivetrain: 'rwd' }), ['rl', 'rr']);
  assert.deepEqual(powertrain.getDrivenWheelIds({ drivetrain: 'awd' }), ['fl', 'fr', 'rl', 'rr']);

  const capacities = { fl: 1000, fr: 3000, rl: 2000, rr: 4000 };
  const fwd = powertrain.resolveDrivetrainCapacity({
    tuning: { drivetrain: 'fwd', frontDifferentialAccel: 1 },
    capacityByWheel: capacities
  });
  const rwd = powertrain.resolveDrivetrainCapacity({
    tuning: { drivetrain: 'rwd', rearDifferentialAccel: 1 },
    capacityByWheel: capacities
  });
  const awd = powertrain.resolveDrivetrainCapacity({
    tuning: {
      drivetrain: 'awd',
      frontDifferentialAccel: 1,
      rearDifferentialAccel: 1,
      centerDifferentialLock: 1,
      centerDifferentialBalance: 0.5
    },
    capacityByWheel: capacities
  });
  assert.equal(fwd.limitN, 4000);
  assert.equal(rwd.limitN, 6000);
  assert.equal(awd.limitN, 10000);
  assert.deepEqual(fwd.forceByWheel, { fl: 1000, fr: 3000, rl: 0, rr: 0 });
  assert.deepEqual(rwd.forceByWheel, { fl: 0, fr: 0, rl: 2000, rr: 4000 });
});

test('authoritative powertrain follows the torque curve and physically modulates shifts and assists', () => {
  const model = new PowertrainModel();
  const tuning = {
    drivetrain: 'awd',
    gearRatios: [3.5, 2.1, 1.4],
    reverseRatio: 3.2,
    finalDrive: 4,
    gearFinalDrive: 4,
    shiftTimeMs: 180,
    idleRpm: 800,
    revLimitRpm: 7000,
    launchRpm: 3600,
    frontBrakeBias: 0.64,
    brakePressure: 1,
    engineCurve: {
      torquePoints: [
        { rpm: 800, torqueLbFt: 120 },
        { rpm: 3500, torqueLbFt: 300 },
        { rpm: 7000, torqueLbFt: 180 }
      ]
    }
  };
  const config = {
    ...tuning,
    idleRpm: 800,
    maxRpm: 7000,
    revLimiterDropRpm: 280,
    drivetrainEfficiency: 0.86,
    brakeForceN: 16000,
    handbrakeForceN: 7000,
    wheelRadiusM: 0.33,
    wheelbaseM: 2.65,
    drivenWheelIds: ['fl', 'fr', 'rl', 'rr']
  };
  const capacityByWheel = { fl: 4000, fr: 4000, rl: 4000, rr: 4000 };
  const driveShareByWheel = { fl: 0.25, fr: 0.25, rl: 0.25, rr: 0.25 };
  const kinematicsAtSlip = (slipRatio = 0) => Object.fromEntries(
    ['fl', 'fr', 'rl', 'rr'].map((wheelId) => [wheelId, {
      wheelAngularVelocityRadps: 80,
      longitudinalVelocityMps: 25,
      slipRatio
    }])
  );
  const run = ({ previous = {}, controls = {}, slipRatio = 0, damage = {}, groundSpeedMps = 25,
    stateOverrides = {} } = {}) => (
    model.stepAuthoritativeWheelTorques({
      tuning,
      config,
      previous,
      controls: {
        throttle: 1,
        brake: 0,
        clutch: 0,
        handbrake: 0,
        requestedGear: 1,
        centerSteeringAngleRad: 0,
        assists: {
          absEnabled: true,
          tractionControlEnabled: true,
          stabilityControlEnabled: true,
          launchControlEnabled: true
        },
        ...controls
      },
      kinematicsByWheel: kinematicsAtSlip(slipRatio),
      capacityByWheel,
      driveShareByWheel,
      state: {
        groundSpeedMps,
        engineRpm: previous.engineRpm || 3500,
        angularVelocityWorld: {},
        ...stateOverrides
      },
      damage,
      dt: 1 / 120
    })
  );

  const peak = run({ previous: { engineRpm: 3500, gear: 1, targetGear: 1 } });
  const low = run({ previous: { engineRpm: 800, gear: 1, targetGear: 1 } });
  assert.ok(peak.telemetry.curveTorqueNm > low.telemetry.curveTorqueNm * 1.5);

  let shifting = run({
    previous: peak.state,
    controls: { requestedGear: 2 }
  });
  let minimumShiftTorqueScale = shifting.state.shiftTorqueScale;
  for (let step = 0; step < 24; step += 1) {
    shifting = run({ previous: shifting.state, controls: { requestedGear: 2 } });
    minimumShiftTorqueScale = Math.min(minimumShiftTorqueScale, shifting.state.shiftTorqueScale);
  }
  assert.ok(minimumShiftTorqueScale < 0.05);
  assert.equal(shifting.state.gear, 2);

  const clutchOpen = run({
    previous: { engineRpm: 3500, gear: 1, targetGear: 1 },
    controls: { clutch: 1 }
  });
  assert.ok(Object.values(clutchOpen.wheelDriveTorqueNm).every((torque) => torque === 0));

  const limited = run({
    previous: { engineRpm: 7000, gear: 1, targetGear: 1, limiterSequence: 0 }
  });
  assert.equal(limited.telemetry.revLimiterActive, true);
  assert.equal(limited.telemetry.combustionTorqueNm, 0);

  let tractionControlled = peak;
  for (let step = 0; step < 18; step += 1) {
    tractionControlled = run({ previous: tractionControlled.state, slipRatio: 0.8 });
  }
  const tractionDisabled = run({
    previous: tractionControlled.state,
    slipRatio: 0.8,
    controls: { assists: { tractionControlEnabled: false, absEnabled: true } }
  });
  assert.ok(tractionControlled.state.tractionTorqueScale < 0.5);
  assert.equal(tractionDisabled.state.tractionTorqueScale, 1);

  const launchOn = run({
    previous: { engineRpm: 5200, gear: 1, targetGear: 1 },
    slipRatio: 0.5,
    groundSpeedMps: 2,
    controls: { assists: { launchControlEnabled: true, tractionControlEnabled: false } }
  });
  const launchOff = run({
    previous: { engineRpm: 5200, gear: 1, targetGear: 1 },
    slipRatio: 0.5,
    groundSpeedMps: 2,
    controls: { assists: { launchControlEnabled: false, tractionControlEnabled: false } }
  });
  assert.equal(launchOn.telemetry.launchControlActive, true);
  assert.ok(Math.abs(launchOn.wheelDriveTorqueNm.fl) < Math.abs(launchOff.wheelDriveTorqueNm.fl));

  const absOn = run({
    previous: peak.state,
    slipRatio: -0.8,
    controls: { throttle: 0, brake: 1 }
  });
  const absOff = run({
    previous: peak.state,
    slipRatio: -0.8,
    controls: { throttle: 0, brake: 1, assists: { absEnabled: false, tractionControlEnabled: false } }
  });
  assert.ok(absOn.wheelBrakeTorqueNm.fl < absOff.wheelBrakeTorqueNm.fl);
  assert.ok(absOn.wheelBrakeTorqueNm.fl > absOn.wheelBrakeTorqueNm.rl);
  const undamagedBrakeMap = run({
    previous: peak.state,
    slipRatio: -0.3,
    controls: { throttle: 0, brake: 1 },
    damage: { brakes: {} }
  });
  assert.ok(Object.values(undamagedBrakeMap.wheelBrakeTorqueNm).every(Number.isFinite));

  const stabilityOn = run({
    previous: peak.state,
    controls: { throttle: 0, centerSteeringAngleRad: 0 },
    stateOverrides: { angularVelocityWorld: { y: 1 } }
  });
  const stabilityOff = run({
    previous: peak.state,
    controls: {
      throttle: 0,
      centerSteeringAngleRad: 0,
      assists: { stabilityControlEnabled: false }
    },
    stateOverrides: { angularVelocityWorld: { y: 1 } }
  });
  assert.ok(stabilityOn.telemetry.stabilityBrakeTorqueNm > 0);
  assert.equal(stabilityOff.telemetry.stabilityBrakeTorqueNm, 0);

  const damaged = run({
    previous: { engineRpm: 3500, gear: 1, targetGear: 1 },
    damage: { engine: 60, transmission: 40 }
  });
  assert.ok(Math.abs(damaged.wheelDriveTorqueNm.fl) < Math.abs(peak.wheelDriveTorqueNm.fl));
});

test('aero and rolling resistance remain deterministic and contact-aware', () => {
  const aero = new AeroModel();
  const tuning = {
    aeroFront: 0.5,
    aeroRear: 0.25,
    dragCoefficient: 0.4,
    widthM: 1.8,
    lengthM: 4.5,
    weightKg: 1400
  };
  const downforce = aero.getDownforceByAxle(tuning, 120 * 0.44704);
  assert.ok(Math.abs(downforce.front - 1156.537619978) < 1e-6);
  assert.ok(Math.abs(downforce.rear - 578.268809989) < 1e-6);
  assert.equal(aero.getLoadEffectiveness(1), 0.36);
  const airborne = aero.getLongitudinalResistance({
    tuning,
    speedMps: 20,
    setupModifiers: { aeroDrag: 1 },
    tireContactScale: 0
  });
  assert.equal(airborne.rollingResistanceN, 0);
  assert.ok(airborne.aeroDragN > 0);
});

test('tires and brakes produce no ground force without wheel load', () => {
  const tires = new TireModel();
  const brakes = new BrakeModel();
  assert.equal(tires.getLoadSensitiveWheelLimit({
    wheelId: 'fl',
    normalLoads: { fl: 0 },
    grip: 1
  }), 0);
  const braking = brakes.calculate({
    tuning: { brakeForceN: 16500, brakePressure: 1, frontBrakeBias: 0.62, absEnabled: true },
    brake: 1,
    limitByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
    normalLoads: { fl: 0, fr: 0, rl: 0, rr: 0 },
    speedMps: 20
  });
  assert.equal(braking.force, 0);
  assert.ok(Object.values(braking.absInterventionByWheel).every((value) => value > 0));
});

test('chassis load transfer conserves supported load before tire sensitivity', () => {
  const chassis = new ChassisIntegrator();
  const tuning = {
    weightKg: 1400,
    wheelbaseM: 2.7,
    trackWidthM: 1.8,
    cgHeightM: 0.55,
    frontWeightDistribution: 0.55
  };
  const loads = chassis.getWheelNormalLoads(tuning, 2.5, 3.2, 30, {
    aeroDownforce: { front: 200, rear: 300 },
    aeroLoadEffectiveness: 0.8
  });
  const total = Object.values(loads).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - (1400 * 9.81 + 400)) < 1e-8);
  assert.ok(loads.fr > loads.fl);
  assert.ok(loads.rl > loads.fl);
});

test('surface and suspension models keep loose/bump inputs explicit', () => {
  const surface = new SurfaceModel();
  const suspension = new SuspensionModel();
  assert.equal(surface.getLooseSurfaceFactor({
    surfaceByWheel: { fl: 'gravel', fr: 'gravel', rl: 'gravel', rr: 'gravel' },
    terrainByWheel: { fl: 'road', fr: 'road', rl: 'road', rr: 'road' }
  }), 0.72);
  const bumpiness = suspension.getSegmentBumpiness(
    { surface: 'snow', bumpiness: 0.1 },
    0.4
  );
  assert.equal(bumpiness, 0.459);
  const scales = suspension.getBumpNormalLoadScales({
    segment: { surface: 'gravel' },
    bumpiness: 0.3,
    distance: 50,
    speedMps: 20
  });
  assert.ok(scales.intensity > 0);
  assert.ok(['fl', 'fr', 'rl', 'rr'].every((wheelId) => scales[wheelId] >= 0.38));
});

test('damage and assists return explicit next state without editor ownership', () => {
  const damage = new DamageModel();
  const state = damage.createState();
  damage.apply(state, 'suspension', 20, { keys: ['fl'], pull: 0.1 });
  damage.apply(state, 'engine', 50);
  assert.equal(state.suspension.fl, 20);
  assert.equal(state.suspension.fr, 0);
  assert.equal(damage.getEffects(state).enginePower, 0.7);

  const assists = new HandlingAssist(steeringConfig);
  assert.equal(assists.getMaxSteerForSpeed(0), 1);
  assert.ok(assists.getMaxSteerForSpeed(62) <= 0.2000001);
  const tractionControl = assists.stepTractionControlCut({
    targetCut: 0.4,
    previousCut: 1,
    looseSurfaceFactor: 0.5,
    seconds: 1 / 60,
    active: true
  });
  assert.ok(tractionControl.appliedCut < 1);
  assert.equal(tractionControl.nextCut, tractionControl.appliedCut);

  const rollIntervention = assists.calculatePhysicalInterventions({
    preset: 'sport',
    state: { angularVelocityWorld: { x: 0, y: 0, z: 1 }, velocity: {}, contactPatches: {} },
    controls: {},
    config: { yawInertiaKgM2: 9000, rollInertiaKgM2: 1000, wheelbaseM: 2.65 },
    supportScale: 1
  }).find((entry) => entry.trigger === 'roll-stability');
  assert.ok(rollIntervention);
  assert.equal(Math.abs(rollIntervention.appliedValue - (-54)) < 0.001, true);
});
