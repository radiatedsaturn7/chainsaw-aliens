import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VEHICLE_BODY_SHAPE_PRESETS,
  normalizeVehicleBodyProfile,
  resolveVehicleBodyProfile
} from '../../src/racing/simulation/VehicleBodyProfile.js';
import {
  ChassisBodyCollision,
  createChassisBodyContactCandidates
} from '../../src/racing/simulation/ChassisBodyCollision.js';
import { createVehicleDynamicsConfigFromTuning } from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import { quaternionFromEuler } from '../../src/racing/simulation/RigidBodyMath.js';
import { createDefaultCar, WRX2_PHYSICAL_PROFILE } from '../../src/racing/raceData.js';

const terrain = (point) => ({
  heightM: 0.08 * Number(point.x || 0),
  normal: { x: -0.079745, y: 0.996815, z: 0 },
  friction: 0.7
});

function configFor(profile) {
  return createVehicleDynamicsConfigFromTuning({
    weightKg: 1600, wheelbaseM: 2.75, wheelRadiusM: 0.35,
    lengthM: profile.overallLengthM, widthM: profile.overallWidthM,
    heightM: profile.overallHeightM, groundClearanceM: profile.groundClearanceM,
    physics: { bodyShapePreset: profile.preset, bodyProfile: profile }
  });
}

test('car, SUV, pickup, and custom profiles produce category-specific compound pieces', () => {
  const profiles = Object.fromEntries(VEHICLE_BODY_SHAPE_PRESETS.map((preset) => [preset,
    normalizeVehicleBodyProfile(preset === 'custom' ? {
      preset,
      customColliders: [
        { id: 'custom-lower', type: 'box', centerM: { x: 0, y: -0.2, z: 0 }, sizeM: { x: 1.8, y: 0.4, z: 4 } },
        { id: 'custom-upper', type: 'box', centerM: { x: 0, y: 0.5, z: -0.2 }, sizeM: { x: 1.5, y: 0.8, z: 2 } }
      ]
    } : { preset })
  ]));
  assert.deepEqual(profiles.car.pieces.map(({ id }) => id),
    ['lower-chassis', 'front-body-hood', 'cabin', 'rear-body-trunk']);
  assert.deepEqual(profiles.suv.pieces.map(({ id }) => id), ['lower-chassis', 'cabin']);
  assert.deepEqual(profiles.pickup.pieces.map(({ id }) => id),
    ['lower-frame-body', 'front-body-hood', 'front-cab', 'bed']);
  assert.deepEqual(profiles.custom.pieces.map(({ id }) => id), ['custom-lower', 'custom-upper']);
  assert.notDeepEqual(profiles.car.pieces, profiles.suv.pieces);
  assert.notDeepEqual(profiles.car.pieces, profiles.pickup.pieces);
});

test('legacy road-car dimensions migrate to a car body while preserving CG and inertia', () => {
  const tuning = {
    class: 'road', lengthM: 4.71, widthM: 1.84, heightM: 1.48,
    groundClearanceM: 0.13,
    physicalVehicleProfile: {
      cgLocationBodyM: { x: 0.01, y: 0.53, z: -0.08 },
      inertiaTensorBodyKgM2: { xx: 2200, yy: 2600, zz: 700 }
    }
  };
  const profile = resolveVehicleBodyProfile(tuning);
  const config = createVehicleDynamicsConfigFromTuning(tuning);
  assert.equal(profile.preset, 'car');
  assert.equal(profile.overallLengthM, 4.71);
  assert.deepEqual(profile.cgPositionM, tuning.physicalVehicleProfile.cgLocationBodyM);
  assert.equal(config.inertiaTensorBodyKgM2.xx, 2200);
  assert.deepEqual(config.cgLocationBodyM, tuning.physicalVehicleProfile.cgLocationBodyM);
});

test('WRX2 resolves explicit production dimensions without replacing authored CG or inertia', () => {
  const wrx = createDefaultCar();
  const config = createVehicleDynamicsConfigFromTuning(wrx.tuning);
  assert.equal(config.bodyShapePreset, 'car');
  assert.equal(config.bodyProfile.overallLengthM, 4.67);
  assert.equal(config.bodyProfile.overallWidthM, 1.83);
  assert.equal(config.bodyProfile.overallHeightM, 1.465);
  assert.equal(config.bodyProfile.groundClearanceM, 0.135);
  assert.deepEqual(config.cgLocationBodyM, WRX2_PHYSICAL_PROFILE.cgLocationBodyM);
  assert.deepEqual(config.inertiaTensorBodyKgM2, WRX2_PHYSICAL_PROFILE.inertiaTensorBodyKgM2);
});

for (const preset of VEHICLE_BODY_SHAPE_PRESETS) {
  test(`${preset} compound resolves upright, side, roof, nose, tail, crest, bank, rollover, and high-speed impacts`, () => {
    const profile = normalizeVehicleBodyProfile(preset === 'custom' ? {
      preset,
      customColliders: [
        { id: 'custom-body', type: 'box', centerM: { x: 0, y: 0, z: 0 }, sizeM: { x: 1.9, y: 1.2, z: 4.4 } }
      ]
    } : { preset });
    const config = configFor(profile);
    const collision = new ChassisBodyCollision(config);
    const fixtures = [
      { pitch: 0, roll: 0, y: profile.cgPositionM.y },
      { pitch: 0, roll: Math.PI / 2, y: profile.overallWidthM * 0.45 },
      { pitch: 0, roll: Math.PI, y: profile.overallHeightM - profile.cgPositionM.y },
      { pitch: -1.1, roll: 0, y: 1.2 },
      { pitch: 1.1, roll: 0, y: 1.2 },
      { pitch: 0.18, roll: 0.22, y: 0.7 },
      { pitch: 0, roll: 0.45, y: 0.8 },
      { pitch: 0.2, roll: 1.15, y: 0.9, angular: { x: 0.4, y: 0.2, z: 2 } },
      { pitch: 0, roll: 0, y: 4, velocity: { x: 0, y: -100, z: 28 } }
    ];
    fixtures.forEach((fixture) => {
      const state = {
        position: { x: 0, y: fixture.y, z: 0 },
        orientation: quaternionFromEuler({ pitch: fixture.pitch, roll: fixture.roll }),
        velocity: fixture.velocity || { x: 0, y: -2, z: 1 },
        angularVelocityWorld: fixture.angular || { x: 0, y: 0, z: 0 }
      };
      let contacted = false;
      for (let step = 0; step < 180; step += 1) {
        state.velocity.y -= 9.81 / 360;
        const result = collision.step({
          workingState: state, config,
          environment: { sampleTerrainAtWorldPoint: terrain },
          dt: 1 / 360
        });
        contacted ||= result.contacts.length > 0;
      }
      assert.equal(contacted, true, `${preset} fixture ${fixture.pitch}/${fixture.roll}`);
      const penetration = collision.samplePosePenetration(state, {
        sampleTerrainAtWorldPoint: terrain
      }, config.bodyCollisionToleranceM);
      assert.equal(Number(penetration.maximumPenetrationM || 0)
        <= config.bodyCollisionToleranceM + 0.003, true);
    });
    const candidates = createChassisBodyContactCandidates(config);
    assert.equal(candidates.length >= profile.pieces.length * 8, true);
  });
}

test('body profile survives authoritative configuration serialization exactly', () => {
  const profile = normalizeVehicleBodyProfile({ preset: 'pickup', collisionFriction: 0.73 });
  const first = configFor(profile);
  const second = configFor(JSON.parse(JSON.stringify(first.bodyProfile)));
  assert.deepEqual(second.bodyProfile, first.bodyProfile);
  assert.equal(second.bodyCollisionFriction, 0.73);
});
