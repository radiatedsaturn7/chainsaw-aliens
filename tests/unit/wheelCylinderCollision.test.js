import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWheelCylinderSupportFeatures,
  sweepWheelCylinders
} from '../../src/racing/simulation/WheelCylinderCollision.js';
import { ChassisBodyCollision } from '../../src/racing/simulation/ChassisBodyCollision.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const WRX2_WHEEL = Object.freeze({ radiusM: 0.337, widthM: 0.245 });

function surfaceSample(heightM, triangleId, normal = { x: 0, y: 1, z: 0 }) {
  return {
    valid: true,
    heightM,
    normal,
    triangleId,
    source: 'prepared-wrx2-fixture',
    region: 'road',
    friction: 0.8
  };
}

function cylinder({
  wheelId = 'fl', start = { x: -0.08, y: WRX2_WHEEL.radiusM, z: 0 },
  end = { x: 0.08, y: WRX2_WHEEL.radiusM, z: 0 },
  forward = { x: 1, y: 0, z: 0 }, lateral = { x: 0, y: 0, z: 1 }
} = {}) {
  return {
    wheelId,
    previousHubPositionWorld: start,
    hubPositionWorld: end,
    previousWheelForwardWorld: forward,
    wheelForwardWorld: forward,
    previousWheelLateralWorld: lateral,
    wheelLateralWorld: lateral,
    previousSuspensionAxisWorld: { x: 0, y: -1, z: 0 },
    suspensionAxisWorld: { x: 0, y: -1, z: 0 },
    ...WRX2_WHEEL,
    validTreadContact: true,
    collisionFriction: 0.65
  };
}

function stepEnvironment(heightM, { diagonal = false } = {}) {
  return {
    sampleTerrainAtWorldPoint: (point) => {
      const raised = diagonal ? point.x + point.z >= 0 : point.x >= 0;
      return surfaceSample(raised ? heightM : 0, raised ? `curb-${heightM}` : 'road-flat');
    }
  };
}

for (const heightM of [0.05, 0.1, 0.15, 0.25]) {
  test(`WRX2 finite-width wheel sweep catches a ${Math.round(heightM * 100)} cm step`, () => {
    const result = sweepWheelCylinders({
      cylinders: [cylinder()],
      environment: stepEnvironment(heightM),
      toleranceM: 0.008,
      spacingM: 0.01,
      radialSamples: 32
    });
    assert.ok(result, 'the leading cylinder must reach the raised terrain before the hub passes it');
    assert.ok(result.fraction > 0 && result.fraction < 1);
    assert.equal(result.contacts.every(({ poweredTreadContact }) => !poweredTreadContact), true);
    assert.equal(result.contacts.some(({ contactType }) => contactType === 'wheel-leading-tread'), true);
    assert.equal(result.terrainTriangleIds.includes(`curb-${heightM}`), true);
    assert.equal(result.contacts.every(({ collisionNormal }) => collisionNormal.x < 0), true,
      'the curb impulse must oppose approach rather than add a forward climbing force');
  });
}

test('diagonal curb resolves the first partial-width tread contact', () => {
  const result = sweepWheelCylinders({
    cylinders: [cylinder()],
    environment: stepEnvironment(0.15, { diagonal: true }),
    toleranceM: 0.008,
    spacingM: 0.01,
    radialSamples: 32
  });
  assert.ok(result);
  assert.equal(result.contacts.some(({ partialWidth }) => partialWidth), true);
  assert.equal(new Set(result.contacts.map(({ widthFraction }) => widthFraction)).size < 3, true);
});

test('lateral cylinder sweep produces a non-powered sidewall impact', () => {
  const result = sweepWheelCylinders({
    cylinders: [cylinder({
      start: { x: 0, y: WRX2_WHEEL.radiusM, z: -0.2 },
      end: { x: 0, y: WRX2_WHEEL.radiusM, z: 0.12 }
    })],
    environment: {
      sampleTerrainAtWorldPoint: (point) => surfaceSample(
        point.z >= 0 ? 0.12 : 0,
        point.z >= 0 ? 'lateral-step' : 'road-flat',
        point.z >= 0 ? { x: 0, y: 0.3, z: -0.953939 } : { x: 0, y: 1, z: 0 }
      )
    },
    toleranceM: 0.008,
    spacingM: 0.01,
    radialSamples: 32
  });
  assert.ok(result);
  assert.equal(result.contacts.some(({ contactType }) => contactType === 'wheel-sidewall'), true);
  assert.equal(result.contacts.every(({ poweredTreadContact }) => !poweredTreadContact), true);
});

test('smooth ramp retains authored support normal while its sharp entry is swept', () => {
  const smooth = sweepWheelCylinders({
    cylinders: [cylinder()],
    environment: {
      sampleTerrainAtWorldPoint: (point) => {
        const heightM = Math.max(0, point.x * 0.1);
        const magnitude = Math.hypot(0.1, 1);
        return surfaceSample(heightM, 'smooth-ramp', { x: -0.1 / magnitude, y: 1 / magnitude, z: 0 });
      }
    },
    toleranceM: 0.008,
    spacingM: 0.01,
    radialSamples: 32
  });
  assert.ok(smooth);
  assert.equal(smooth.contacts.every(({ collisionNormal }) => collisionNormal.y > 0.99), true,
    'a smooth ramp retains its authored support normal instead of becoming a curb face');

  const sharp = sweepWheelCylinders({
    cylinders: [cylinder()],
    environment: {
      sampleTerrainAtWorldPoint: (point) => surfaceSample(
        point.x < 0 ? 0 : 0.04 + point.x * 0.35,
        point.x < 0 ? 'road-flat' : 'sharp-ramp'
      )
    },
    toleranceM: 0.008,
    spacingM: 0.01,
    radialSamples: 32
  });
  assert.ok(sharp);
  assert.equal(sharp.contacts.some(({ triangleId }) => triangleId === 'sharp-ramp'), true);
});

test('narrow convex crest cannot pass between the previous and proposed cylinder poses', () => {
  const result = sweepWheelCylinders({
    cylinders: [cylinder({
      start: { x: -0.12, y: WRX2_WHEEL.radiusM, z: 0 },
      end: { x: 0.12, y: WRX2_WHEEL.radiusM, z: 0 }
    })],
    environment: {
      sampleTerrainAtWorldPoint: (point) => surfaceSample(
        Math.abs(point.x) < 0.018 ? 0.14 : 0,
        Math.abs(point.x) < 0.018 ? 'narrow-crest' : 'road-flat'
      )
    },
    toleranceM: 0.008,
    spacingM: 0.009,
    radialSamples: 32
  });
  assert.ok(result);
  assert.equal(result.terrainTriangleIds.includes('narrow-crest'), true);
});

test('prepared triangle identity is preserved through a wheel-cylinder sweep', () => {
  const result = sweepWheelCylinders({
    cylinders: [cylinder({
      start: { x: -0.12, y: 0.45, z: 0 },
      end: { x: 0.12, y: 0.45, z: 0 }
    })],
    environment: {
      sampleTerrainAtWorldPoint: (point) => surfaceSample(
        0.1 + point.x * 0.3,
        'prepared-triangle-42',
        { x: -0.287348, y: 0.957826, z: 0 }
      ),
      sampleTerrainTrianglesInBounds: () => [{
        id: 'prepared-triangle-42',
        vertices: [
          { x: -1, y: -0.2, z: -2 },
          { x: 2, y: 0.7, z: -2 },
          { x: -1, y: -0.2, z: 2 }
        ],
        normal: { x: -0.287348, y: 0.957826, z: 0 },
        source: 'prepared-wrx2-fixture',
        region: 'road'
      }]
    },
    toleranceM: 0.008,
    spacingM: 0.01,
    radialSamples: 32
  });
  assert.ok(result);
  assert.equal(result.contacts.some(({ mechanism }) => mechanism === 'prepared-triangle'), true);
  assert.equal(result.terrainTriangleIds.includes('prepared-triangle-42'), true);
  assert.equal(new Set(result.contacts.map(({ id }) => id)).size, result.contacts.length,
    'the prepared triangle and height contract must not submit the same feature twice');
});

test('finite wheel-cylinder support exposes both physical sidewall faces', () => {
  const features = createWheelCylinderSupportFeatures([cylinder()], 0.5);
  assert.equal(features.length, 10);
  assert.deepEqual([...new Set(features.map(({ contactType }) => contactType))], ['wheel-sidewall']);
  assert.deepEqual([...new Set(features.map(({ poweredTreadContact }) => poweredTreadContact))], [false]);
  assert.equal(features.some(({ id }) => id.includes('inner')), true);
  assert.equal(features.some(({ id }) => id.includes('outer')), true);
});

test('chassis manifold applies the swept wheel impulse once at time of impact', () => {
  const collision = new ChassisBodyCollision({
    bodyLengthM: 4.67, bodyWidthM: 1.8, bodyHeightM: 1.46,
    bodyGroundClearanceM: 0.135, cgHeightM: 0.55
  });
  const previous = {
    position: { x: -0.08, y: 2, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 20, y: 0, z: 0 },
    angularVelocityWorld: { x: 0, y: 0, z: 0 }
  };
  const working = {
    ...previous,
    position: { x: 0.08, y: 2, z: 0 },
    velocity: { ...previous.velocity },
    angularVelocityWorld: { ...previous.angularVelocityWorld }
  };
  const result = collision.step({
    workingState: working,
    previousWorkingState: previous,
    config: {
      massKg: 1600,
      inertiaTensorBodyKgM2: { xx: 2200, yy: 2600, zz: 900 },
      bodyLengthM: 4.67, bodyWidthM: 1.8, bodyHeightM: 1.46,
      bodyGroundClearanceM: 0.135, cgHeightM: 0.55,
      bodyCollisionToleranceM: 0.008,
      bodyCollisionFriction: 0.65,
      bodyCollisionRestitution: 0.04,
      bodyCollisionSolverIterations: 6,
      wheelCylinderSweepSpacingM: 0.01,
      wheelCylinderRadialSamples: 32
    },
    environment: {
      ...stepEnvironment(0.15),
      wheelCylinderSweeps: [cylinder()]
    },
    dt: 1 / 360,
    advanceState: false
  });
  assert.equal(result.sweepSource, 'wheel-cylinder');
  assert.ok(result.timeOfImpactFraction > 0 && result.timeOfImpactFraction < 1);
  assert.equal(result.contacts.some(({ contactType }) => contactType === 'wheel-leading-tread'), true);
  assert.equal(result.contacts.every(({ poweredTreadContact }) => !poweredTreadContact), true);
  assert.ok(result.wheelCylinderNormalImpulseNs > 0);
  assert.ok(working.velocity.x < previous.velocity.x);
  assert.equal(result.penetrationBiasContributionNs, 0,
    'wheel collision must not receive an energy-adding positional lift');
});

test('WRX2 curb impact remains identical at every supported render rate and approach speed', () => {
  const durationSeconds = 0.12;
  const run = (fps, speedMps) => {
    const massKg = 1600;
    const runner = new VehicleDynamicsRunner({
      config: {
        chassisHz: 120,
        tireHz: 360,
        telemetryRetention: 'history',
        telemetryLimit: 64,
        massKg,
        bodyLengthM: 4.67,
        bodyWidthM: 1.8,
        bodyHeightM: 1.46,
        bodyGroundClearanceM: 0.135,
        cgHeightM: 0.55,
        wheelRadiusM: WRX2_WHEEL.radiusM,
        tireByWheel: { fl: { widthMm: WRX2_WHEEL.widthM * 1000 } },
        inertiaTensorBodyKgM2: { xx: 2200, yy: 2600, zz: 900 },
        bodyCollisionToleranceM: 0.008,
        bodyCollisionFriction: 0.65,
        bodyCollisionRestitution: 0.04,
        wheelCylinderSweepSpacingM: 0.01,
        wheelCylinderRadialSamples: 32,
        handlingPreset: 'simulation'
      },
      initialState: {
        position: { x: -0.28, y: 2, z: 0 },
        velocity: { x: speedMps, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        angularVelocityWorld: { x: 0, y: 0, z: 0 },
        grounded: false
      },
      tireContactSubsystem: {
        step: ({ state }) => ({
          worldForceN: {},
          worldMomentNm: {},
          suspensionForceWorldN: { x: 0, y: massKg * 9.81, z: 0 },
          externalForceWorldN: {},
          externalMomentWorldNm: {},
          wheelLoadsN: { fl: 1000 },
          wheelSlip: { fl: 0 },
          suspensionTravel: { fl: 0.05 },
          suspensionState: { fl: { compressionM: 0.05, inContact: true } },
          tireForcesN: {},
          wheelAngularVelocityRadps: { fl: speedMps / WRX2_WHEEL.radiusM },
          contactPatches: {
            fl: {
              hubPositionWorld: {
                x: state.position.x,
                y: WRX2_WHEEL.radiusM,
                z: 0
              },
              wheelForwardWorld: { x: 1, y: 0, z: 0 },
              wheelLateralWorld: { x: 0, y: 0, z: 1 },
              suspensionAxisWorld: { x: 0, y: -1, z: 0 },
              effectiveRollingRadiusM: WRX2_WHEEL.radiusM,
              validTreadContact: true,
              normalLoadN: 1000
            }
          },
          supportedWheelCount: 1,
          validTreadContactByWheel: { fl: true },
          invalidContactReasonByWheel: { fl: null },
          grounded: true,
          groundHeightM: 0
        })
      },
      environmentProvider: () => ({
        ...stepEnvironment(0.15),
        airDensityKgM3: 0
      })
    });
    let elapsed = 0;
    while (elapsed < durationSeconds - 1e-12) {
      const frameSeconds = Math.min(1 / fps, durationSeconds - elapsed);
      runner.advance(frameSeconds);
      elapsed += frameSeconds;
    }
    const collisionFrames = runner.telemetry.filter((frame) => (
      frame.forces?.bodyCollision?.wheelCylinderSweeps?.length
    ));
    return {
      snapshot: runner.createStateSnapshot(),
      collisionHistory: collisionFrames.map((frame) => ({
        stepIndex: frame.stepIndex,
        sweeps: frame.forces.bodyCollision.wheelCylinderSweeps
      }))
    };
  };

  for (const speedMps of [5, 15, 30]) {
    const results = [30, 60, 90, 120, 144].map((fps) => run(fps, speedMps));
    assert.ok(results[0].collisionHistory.length > 0,
      `${speedMps} m/s must contact the curb: ${JSON.stringify(results[0].snapshot.position)} ${JSON.stringify(results[0].snapshot.velocity)}`);
    results.slice(1).forEach((result) => assert.deepEqual(result, results[0]));
  }
});

test('all WRX2 rise fixtures keep the same swept contact across speed and render partitions', () => {
  const fixtures = {
    'curb-5cm': (point) => surfaceSample(point.x >= 0 ? 0.05 : 0, point.x >= 0 ? 'curb-5cm' : 'flat'),
    'curb-10cm': (point) => surfaceSample(point.x >= 0 ? 0.1 : 0, point.x >= 0 ? 'curb-10cm' : 'flat'),
    'curb-15cm': (point) => surfaceSample(point.x >= 0 ? 0.15 : 0, point.x >= 0 ? 'curb-15cm' : 'flat'),
    'step-25cm': (point) => surfaceSample(point.x >= 0 ? 0.25 : 0, point.x >= 0 ? 'step-25cm' : 'flat'),
    'smooth-ramp': (point) => surfaceSample(
      Math.max(0, point.x * 0.2), 'smooth-ramp',
      { x: -0.196116, y: 0.980581, z: 0 }
    ),
    'sharp-ramp': (point) => surfaceSample(
      point.x < 0 ? 0 : 0.05 + point.x * 0.35,
      point.x < 0 ? 'flat' : 'sharp-ramp'
    ),
    'diagonal-curb': (point) => surfaceSample(
      point.x + point.z >= 0 ? 0.15 : 0,
      point.x + point.z >= 0 ? 'diagonal-curb' : 'flat'
    ),
    'narrow-crest': (point) => surfaceSample(
      Math.abs(point.x) < 0.018 ? 0.14 : 0,
      Math.abs(point.x) < 0.018 ? 'narrow-crest' : 'flat'
    )
  };
  const run = (sampleTerrainAtWorldPoint, speedMps, fps) => {
    let observedSeconds = 0;
    let completedSubsteps = 0;
    const maximumSeconds = 0.2;
    while (observedSeconds < maximumSeconds - 1e-12) {
      observedSeconds = Math.min(maximumSeconds, observedSeconds + 1 / fps);
      const targetSubstep = Math.floor((observedSeconds + 1e-10) * 360);
      while (completedSubsteps < targetSubstep) {
        const startX = -0.45 + completedSubsteps / 360 * speedMps;
        const endX = -0.45 + (completedSubsteps + 1) / 360 * speedMps;
        const result = sweepWheelCylinders({
          cylinders: [cylinder({
            start: { x: startX, y: WRX2_WHEEL.radiusM, z: 0 },
            end: { x: endX, y: WRX2_WHEEL.radiusM, z: 0 }
          })],
          environment: { sampleTerrainAtWorldPoint },
          toleranceM: 0.008,
          spacingM: 0.01,
          radialSamples: 32
        });
        completedSubsteps += 1;
        if (result) return {
          substep: completedSubsteps,
          fraction: Number(result.fraction.toFixed(12)),
          contacts: result.contacts.map((contact) => ({
            contactType: contact.contactType,
            triangleId: contact.triangleId,
            widthFraction: contact.widthFraction,
            partialWidth: contact.partialWidth,
            mechanism: contact.mechanism
          }))
        };
      }
    }
    return null;
  };
  Object.entries(fixtures).forEach(([name, sampleTerrainAtWorldPoint]) => {
    [5, 15, 30].forEach((speedMps) => {
      const results = [30, 60, 90, 120, 144].map((fps) => (
        run(sampleTerrainAtWorldPoint, speedMps, fps)
      ));
      assert.ok(results[0], `${name} at ${speedMps} m/s must produce a cylinder contact`);
      results.slice(1).forEach((result) => assert.deepEqual(result, results[0]));
    });
  });
});
