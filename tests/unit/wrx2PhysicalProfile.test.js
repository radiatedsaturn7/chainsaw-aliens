import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_CAR_TUNING,
  RACE_CAR_DIMENSIONS,
  WRX2_PHYSICAL_PROFILE,
  WRX_2022_TRANSMISSIONS
} from '../../src/racing/raceData.js';
import { createVehicleDynamicsConfigFromTuning } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const config = createVehicleDynamicsConfigFromTuning({
  ...DEFAULT_CAR_TUNING,
  ...WRX_2022_TRANSMISSIONS.manual,
  ...RACE_CAR_DIMENSIONS['wrx-2022']
});

test('WRX2 authoritative configuration uses explicit SI physical values', () => {
  assert.equal(config.physicalProfileId, WRX2_PHYSICAL_PROFILE.id);
  assert.equal(config.massKg, 1495);
  assert.deepEqual(config.cgLocationBodyM, WRX2_PHYSICAL_PROFILE.cgLocationBodyM);
  assert.deepEqual(config.inertiaTensorBodyKgM2, WRX2_PHYSICAL_PROFILE.inertiaTensorBodyKgM2);
  assert.equal(config.maxSteerAngleRad, WRX2_PHYSICAL_PROFILE.maxSteerAngleRad);
  assert.equal(config.steeringWheelRatio, WRX2_PHYSICAL_PROFILE.steeringWheelRatio);
  assert.equal(config.suspensionSpringRateFrontNpm, WRX2_PHYSICAL_PROFILE.suspensionSpringRateFrontNpm);
  assert.equal(config.suspensionSpringRateRearNpm, WRX2_PHYSICAL_PROFILE.suspensionSpringRateRearNpm);
  assert.equal(config.suspensionBumpDamperFrontNsM, WRX2_PHYSICAL_PROFILE.suspensionBumpDamperFrontNsM);
  assert.equal(config.suspensionReboundDamperRearNsM, WRX2_PHYSICAL_PROFILE.suspensionReboundDamperRearNsM);
  assert.equal(config.antiRollStiffnessFrontNpm, WRX2_PHYSICAL_PROFILE.antiRollStiffnessFrontNpm);
  assert.equal(config.tireVerticalStiffnessNpm, WRX2_PHYSICAL_PROFILE.tireVerticalStiffnessNpm);
  assert.deepEqual(config.unsprungMassByWheelKg, WRX2_PHYSICAL_PROFILE.unsprungMassByWheelKg);
  assert.equal(config.dragCoefficient, WRX2_PHYSICAL_PROFILE.dragCoefficient);
  assert.equal(config.frontalAreaM2, WRX2_PHYSICAL_PROFILE.frontalAreaM2);
  assert.equal(config.frontRideHeightM, WRX2_PHYSICAL_PROFILE.frontRideHeightM);
  assert.equal(config.rearRideHeightM, WRX2_PHYSICAL_PROFILE.rearRideHeightM);
});

test('legacy normalized setup values do not overwrite WRX2 physical coefficients', () => {
  assert.equal(DEFAULT_CAR_TUNING.springFront, 0.5);
  assert.notEqual(config.suspensionSpringRateFrontNpm, DEFAULT_CAR_TUNING.springFront);
  assert.notEqual(config.antiRollStiffnessFrontNpm, DEFAULT_CAR_TUNING.antiRollFront);
  assert.notEqual(config.frontRideHeightM, DEFAULT_CAR_TUNING.rideHeightFront);
});

test('WRX2 aero calibration implies a plausible power-limited top-speed envelope', () => {
  const airDensityKgM3 = 1.225;
  const wheelPowerW = DEFAULT_CAR_TUNING.powerHp * 745.7 * WRX_2022_TRANSMISSIONS.manual.drivetrainEfficiency;
  const equilibriumSpeedMps = Math.cbrt(
    2 * wheelPowerW / (airDensityKgM3 * config.dragCoefficient * config.frontalAreaM2)
  );
  const equilibriumSpeedMph = equilibriumSpeedMps * 2.2369362921;
  assert.ok(equilibriumSpeedMph > 125 && equilibriumSpeedMph < 165);
});
