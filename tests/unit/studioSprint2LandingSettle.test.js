import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

import RaceEditor from '../../src/ui/RaceEditor.js';
import { rotateVectorToBody } from '../../src/racing/simulation/RigidBodyMath.js';

const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];

function decodeDocument(path) {
  const envelope = JSON.parse(readFileSync(path, 'utf8'));
  return envelope?.__chainsawStorage === 'compact-v1'
    ? JSON.parse(gunzipSync(Buffer.from(envelope.data, 'base64')).toString('utf8'))
    : envelope;
}

test('Studio Sprint2 WRX2 first jump dissipates passive landing energy and settles', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  assert.equal(editor.applyLoadedRaceDocument(decodeDocument(
    'tests/fixtures/studioSprint2PerformanceRaceDocument.json'
  ), { name: 'Studio Sprint2' }), true);
  assert.equal(editor.applyLoadedCarDocument(decodeDocument(
    'data/server-storage/files/cars/2022 Subaru WRX2/document.json'
  ), { name: '2022 Subaru WRX2' }), true);
  const worldBake = editor.buildRaceWorldBake({ retainTerrainCells: false });
  editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
    hydrateCars: false,
    preparedWorldBake: worldBake
  });
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  session.startupFramePending = false;
  assert.equal(editor.updatePlaytestSafely(0), true);
  editor.applyRaceCarRouteCenterReset({
    projection: { distance: 500 },
    preserveMotion: false
  });
  const runner = session.vehicleDynamicsRunner;
  const state = runner.createStateSnapshot();
  const yaw = Number(state.yawRad || session.carYaw || 0);
  const speedMps = 20;
  runner.replaceAuthoritativeState({
    ...state,
    velocity: {
      x: Math.sin(yaw) * speedMps,
      y: 0,
      z: Math.cos(yaw) * speedMps
    },
    speedMps,
    groundSpeedMps: speedMps,
    bodyLongitudinalSpeedMps: speedMps,
    signedTravelSpeedMps: speedMps,
    wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, speedMps / runner.config.wheelRadiusM
    ])),
    gear: 3,
    engineRpm: 2800,
    powertrainState: { ...state.powertrainState, gear: 3, engineRpm: 2800 }
  });
  Object.assign(editor.raceInput, {
    rawThrottleAxis: 0,
    throttleAxis: 0,
    analogThrottleActive: false,
    rawBrakeAxis: 0,
    steeringWheel: 0,
    gear: 3,
    autoShift: false,
    paused: false
  });

  let previousAirborne = null;
  let contactTransitions = 0;
  let wheelContactTransitions = 0;
  let previousWheelSupport = null;
  let maximumLateVerticalSpeedMps = 0;
  let maximumLatePitchRollRateRadps = 0;
  let lateVerticalPeak = null;
  let landingIsolated = false;
  let hasBeenAirborne = false;
  for (let frame = 0; frame < 600; frame += 1) {
    assert.equal(editor.updatePlaytestSafely(1 / 60), true);
    const airborne = !runner.state.wheelGrounded && !runner.state.bodyGrounded;
    if (airborne) hasBeenAirborne = true;
    if (!landingIsolated && hasBeenAirborne && previousAirborne === true && !airborne) {
      landingIsolated = true;
    }
    if (landingIsolated) {
      runner.state.velocity.x = 0;
      runner.state.velocity.z = 0;
      runner.state.groundSpeedMps = 0;
      runner.state.speedMps = 0;
      runner.state.bodyLongitudinalSpeedMps = 0;
      runner.state.bodyLateralSpeedMps = 0;
    }
    if (previousAirborne !== null && airborne !== previousAirborne) contactTransitions += 1;
    previousAirborne = airborne;
    const wheelSupport = WHEEL_IDS.map((wheelId) => (
      runner.state.contactPatches?.[wheelId]?.wheelGrounded ? '1' : '0'
    )).join('');
    if (previousWheelSupport !== null) {
      for (let index = 0; index < wheelSupport.length; index += 1) {
        if (wheelSupport[index] !== previousWheelSupport[index]) wheelContactTransitions += 1;
      }
    }
    previousWheelSupport = wheelSupport;
    if (frame >= 540) {
      const verticalSpeedMps = Math.abs(Number(runner.state.velocity.y || 0));
      if (verticalSpeedMps > maximumLateVerticalSpeedMps) {
        maximumLateVerticalSpeedMps = verticalSpeedMps;
        lateVerticalPeak = {
          frame,
          position: structuredClone(runner.state.position),
          velocity: structuredClone(runner.state.velocity),
          wheelLoadsN: structuredClone(runner.state.wheelLoadsN),
          compressionM: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
            wheelId, runner.state.suspensionState?.[wheelId]?.compressionM
          ])),
          unsprungVelocityMps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
            wheelId, runner.state.suspensionState?.[wheelId]?.unsprungVelocityMps
          ])),
          validTreadContact: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
            wheelId, runner.state.contactPatches?.[wheelId]?.validTreadContact
          ]))
        };
      }
      maximumLatePitchRollRateRadps = Math.max(maximumLatePitchRollRateRadps,
        Math.abs(Number(runner.state.angularVelocityWorld?.x || 0)),
        Math.abs(Number(runner.state.angularVelocityWorld?.z || 0)));
    }
  }

  assert.ok(runner.impactHistory.length <= 3, JSON.stringify({
    passiveImpacts: runner.impactHistory.length,
    impacts: runner.impactHistory.map((impact) => ({
      stepIndex: impact.stepIndex,
      preImpactKineticEnergyJ: impact.preImpactKineticEnergyJ,
      postImpactKineticEnergyJ: impact.postImpactKineticEnergyJ,
      bodyNormalImpulseNs: impact.bodyNormalImpulseNs,
      restitutionContributionNs: impact.restitutionContributionNs,
      suspensionImpulseByWheelNs: impact.suspensionImpulseByWheelNs,
      tireVerticalImpulseByWheelNs: impact.tireVerticalImpulseByWheelNs,
      positionalCorrectionWorldM: impact.positionalCorrectionWorldM,
      firstReboundApexM: impact.firstReboundApexM,
      secondReboundApexM: impact.secondReboundApexM
    }))
  }));
  assert.ok(contactTransitions <= 6, JSON.stringify({
    contactTransitions,
    impacts: runner.impactHistory.length,
    maximumLateVerticalSpeedMps,
    maximumLatePitchRollRateRadps,
    wheelContactTransitions,
    finalVelocity: runner.state.velocity,
    lateVerticalPeak
  }));
  assert.ok(maximumLateVerticalSpeedMps < 0.25,
    JSON.stringify({ maximumLateVerticalSpeedMps, lateVerticalPeak }));
  assert.ok(wheelContactTransitions <= 80,
    `wheel support transitions ${wheelContactTransitions}`);
  assert.ok(maximumLatePitchRollRateRadps < 0.075,
    `late pitch/roll rate ${maximumLatePitchRollRateRadps} rad/s`);
  assert.ok(Math.abs(Number(runner.state.velocity.y || 0)) < 0.05);
  assert.equal(runner.penetrationRecoveryState.history.length, 0);
  assert.ok(runner.impactHistory.every((impact) => (
    impact.postImpactKineticEnergyJ <= impact.preImpactKineticEnergyJ * 1.001 + 1
  )), JSON.stringify(runner.impactHistory));
});

test('Studio Sprint2 WRX2 third-hill trough dissipates landing energy', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  assert.equal(editor.applyLoadedRaceDocument(decodeDocument(
    'tests/fixtures/studioSprint2PerformanceRaceDocument.json'
  ), { name: 'Studio Sprint2' }), true);
  assert.equal(editor.applyLoadedCarDocument(decodeDocument(
    'data/server-storage/files/cars/2022 Subaru WRX2/document.json'
  ), { name: '2022 Subaru WRX2' }), true);
  editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
    hydrateCars: false,
    preparedWorldBake: editor.buildRaceWorldBake({ retainTerrainCells: false })
  });
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  session.startupFramePending = false;
  assert.equal(editor.updatePlaytestSafely(0), true);
  assert.equal(editor.applyRaceCarRouteCenterReset({
    projection: { distance: 145 },
    preserveMotion: false
  }), true);
  const runner = session.vehicleDynamicsRunner;
  const state = runner.createStateSnapshot();
  const yaw = Number(state.yawRad || 0);
  const speedMps = 20;
  runner.replaceAuthoritativeState({
    ...state,
    velocity: {
      x: Math.sin(yaw) * speedMps,
      y: 0,
      z: Math.cos(yaw) * speedMps
    },
    speedMps,
    groundSpeedMps: speedMps,
    bodyLongitudinalSpeedMps: speedMps,
    signedTravelSpeedMps: speedMps,
    wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, speedMps / runner.config.wheelRadiusM
    ]))
  });
  Object.assign(editor.raceInput, {
    rawThrottleAxis: 0,
    throttleAxis: 0,
    analogThrottleActive: false,
    rawBrakeAxis: 0,
    steeringWheel: 0,
    paused: false
  });
  let maximumLateVerticalSpeedMps = 0;
  let maximumLateUnsprungSpeedMps = 0;
  let wheelContactTransitions = 0;
  let previousWheelSupport = null;
  const largestCorrections = [];
  const impactLocations = [];
  let observedImpactCount = 0;
  let troughLandingIsolated = false;
  for (let frame = 0; frame < 720; frame += 1) {
    assert.equal(editor.updatePlaytestSafely(1 / 60), true);
    if (!troughLandingIsolated && runner.impactHistory.length >= 2) {
      troughLandingIsolated = true;
    }
    if (troughLandingIsolated) {
      runner.state.velocity.x = 0;
      runner.state.velocity.z = 0;
      runner.state.groundSpeedMps = 0;
      runner.state.speedMps = 0;
      runner.state.bodyLongitudinalSpeedMps = 0;
      runner.state.bodyLateralSpeedMps = 0;
    }
    const wheelSupport = WHEEL_IDS.map((wheelId) => (
      runner.state.contactPatches?.[wheelId]?.wheelGrounded ? '1' : '0'
    )).join('');
    if (previousWheelSupport !== null) {
      for (let index = 0; index < wheelSupport.length; index += 1) {
        if (wheelSupport[index] !== previousWheelSupport[index]) wheelContactTransitions += 1;
      }
    }
    previousWheelSupport = wheelSupport;
    if (runner.impactHistory.length > observedImpactCount) {
      observedImpactCount = runner.impactHistory.length;
      impactLocations.push({
        frame,
        stepIndex: runner.stepIndex,
        projection: editor.getRaceRouteProjectionForWorldPoint(runner.state.position),
        position: structuredClone(runner.state.position),
        velocity: structuredClone(runner.state.velocity),
        pitchRad: runner.state.pitchRad,
        rollRad: runner.state.rollRad
      });
    }
    const telemetry = runner.telemetry[runner.telemetry.length - 1];
    const correction = telemetry?.forces?.bodyCollision?.positionalCorrectionWorldM || {};
    const correctionM = Math.hypot(
      Number(correction.x || 0), Number(correction.y || 0), Number(correction.z || 0)
    );
    if (correctionM > 0.01) {
      largestCorrections.push({
        frame,
        stepIndex: runner.stepIndex,
        correctionM,
        position: structuredClone(runner.state.position),
        velocity: structuredClone(runner.state.velocity),
        pitchRad: runner.state.pitchRad,
        rollRad: runner.state.rollRad,
        bodyCollision: {
          swept: telemetry?.forces?.bodyCollision?.swept,
          maximumPenetrationAfterSolveM:
            telemetry?.forces?.bodyCollision?.maximumPenetrationAfterSolveM,
          localCcdRollbacks: telemetry?.forces?.bodyCollision?.localCcdRollbacks,
          contacts: telemetry?.forces?.bodyCollision?.contacts?.map((contact) => ({
            contactType: contact.contactType,
            featureId: contact.featureId,
            penetrationM: contact.penetrationM,
            triangleId: contact.triangleId
          }))
        }
      });
      largestCorrections.sort((a, b) => b.correctionM - a.correctionM);
      largestCorrections.length = Math.min(largestCorrections.length, 8);
    }
    if (frame >= 660) {
      maximumLateVerticalSpeedMps = Math.max(
        maximumLateVerticalSpeedMps,
        Math.abs(Number(runner.state.velocity?.y || 0))
      );
      maximumLateUnsprungSpeedMps = Math.max(
        maximumLateUnsprungSpeedMps,
        ...WHEEL_IDS.map((wheelId) => Math.abs(Number(
          runner.state.suspensionState?.[wheelId]?.unsprungVelocityMps || 0
        )))
      );
    }
  }
  assert.ok(runner.impactHistory.length <= 3, JSON.stringify({
    impacts: runner.impactHistory.length,
    routeDistance: runner.state.routeDistance,
    maximumLateVerticalSpeedMps,
    maximumLateUnsprungSpeedMps,
    wheelContactTransitions,
    largestCorrections,
    impactLocations,
    history: runner.impactHistory.map((impact) => ({
      stepIndex: impact.stepIndex,
      preImpactKineticEnergyJ: impact.preImpactKineticEnergyJ,
      postImpactKineticEnergyJ: impact.postImpactKineticEnergyJ,
      bodyNormalImpulseNs: impact.bodyNormalImpulseNs,
      restitutionContributionNs: impact.restitutionContributionNs,
      suspensionImpulseByWheelNs: impact.suspensionImpulseByWheelNs,
      tireVerticalImpulseByWheelNs: impact.tireVerticalImpulseByWheelNs,
      firstReboundApexM: impact.firstReboundApexM,
      secondReboundApexM: impact.secondReboundApexM,
      positionalCorrectionWorldM: impact.positionalCorrectionWorldM
    }))
  }));
  assert.ok(maximumLateVerticalSpeedMps < 0.1,
    JSON.stringify({
      maximumLateVerticalSpeedMps,
      maximumLateUnsprungSpeedMps,
      finalVerticalSpeedMps: runner.state.velocity?.y,
      finalUnsprungVelocityMps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
        wheelId, runner.state.suspensionState?.[wheelId]?.unsprungVelocityMps
      ])),
      wheelContactTransitions,
      impacts: runner.impactHistory.length,
      impactLocations,
      history: runner.impactHistory.map((impact) => ({
        stepIndex: impact.stepIndex,
        preImpactKineticEnergyJ: impact.preImpactKineticEnergyJ,
        postImpactKineticEnergyJ: impact.postImpactKineticEnergyJ,
        bodyNormalImpulseNs: impact.bodyNormalImpulseNs,
        suspensionImpulseByWheelNs: impact.suspensionImpulseByWheelNs,
        tireVerticalImpulseByWheelNs: impact.tireVerticalImpulseByWheelNs,
        firstReboundApexM: impact.firstReboundApexM,
        secondReboundApexM: impact.secondReboundApexM
      }))
    }));
  assert.ok(maximumLateUnsprungSpeedMps < 0.1,
    `late unsprung speed ${maximumLateUnsprungSpeedMps}`);
  assert.equal(runner.penetrationRecoveryState.history.length, 0);
});

test('Studio Sprint2 WRX2 settles after respawning on a slight incline', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  assert.equal(editor.applyLoadedRaceDocument(decodeDocument(
    'tests/fixtures/studioSprint2PerformanceRaceDocument.json'
  ), { name: 'Studio Sprint2' }), true);
  assert.equal(editor.applyLoadedCarDocument(decodeDocument(
    'data/server-storage/files/cars/2022 Subaru WRX2/document.json'
  ), { name: '2022 Subaru WRX2' }), true);
  editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
    hydrateCars: false,
    preparedWorldBake: editor.buildRaceWorldBake({ retainTerrainCells: false })
  });
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.startupFramePending = false;
  assert.equal(editor.updatePlaytestSafely(0), true);
  assert.equal(editor.applyRaceCarRouteCenterReset({
    projection: { distance: 110 },
    preserveMotion: false
  }), true);
  const runner = editor.playtestSession.vehicleDynamicsRunner;
  assert.ok(Math.abs(Number(runner.state.pitchRad || 0)) > 0.05,
    `expected inclined reset, pitch ${runner.state.pitchRad}`);

  // An intentional analog press releases the parked reset. Once it returns to
  // zero, an untouched car must still converge to rest.
  runner.addInputSample(runner.simulationTimeSeconds + 1 / runner.config.chassisHz, {
    throttle: 0.2,
    requestedGear: 1
  });
  runner.advance(1 / runner.config.chassisHz);
  assert.equal(runner.stationaryResetHold, null);
  runner.addInputSample(runner.simulationTimeSeconds + 1 / runner.config.chassisHz, {
    throttle: 0,
    brake: 0,
    steering: 0,
    requestedGear: 1
  });

  let maximumLatePitchRollRateRadps = 0;
  let maximumLateUnsprungSpeedMps = 0;
  let lateWheelContactTransitions = 0;
  let previousSupport = null;
  for (let frame = 0; frame < 600; frame += 1) {
    runner.advance(1 / 120);
    if (frame < 480) continue;
    const angularVelocityBody = runner.state.angularVelocityWorld || {};
    maximumLatePitchRollRateRadps = Math.max(maximumLatePitchRollRateRadps,
      Math.abs(Number(angularVelocityBody.x || 0)),
      Math.abs(Number(angularVelocityBody.z || 0)));
    maximumLateUnsprungSpeedMps = Math.max(maximumLateUnsprungSpeedMps,
      ...WHEEL_IDS.map((wheelId) => Math.abs(Number(
        runner.state.suspensionState?.[wheelId]?.unsprungVelocityMps || 0
      ))));
    const support = WHEEL_IDS.map((wheelId) => (
      runner.state.contactPatches?.[wheelId]?.wheelGrounded ? '1' : '0'
    )).join('');
    if (previousSupport !== null && support !== previousSupport) lateWheelContactTransitions += 1;
    previousSupport = support;
  }

  assert.ok(maximumLatePitchRollRateRadps < 0.025,
    `persistent incline pitch/roll ${maximumLatePitchRollRateRadps} rad/s; unsprung ${maximumLateUnsprungSpeedMps} m/s; transitions ${lateWheelContactTransitions}; ground speed ${runner.state.groundSpeedMps} m/s`);
  assert.ok(maximumLateUnsprungSpeedMps < 0.025,
    `persistent incline unsprung speed ${maximumLateUnsprungSpeedMps} m/s`);
  assert.equal(lateWheelContactTransitions, 0,
    `late incline wheel contact transitions ${lateWheelContactTransitions}`);
});

test('Studio Sprint2 WRX2 launches without persistent bounce after a maximum-grade respawn', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  assert.equal(editor.applyLoadedRaceDocument(decodeDocument(
    'tests/fixtures/studioSprint2PerformanceRaceDocument.json'
  ), { name: 'Studio Sprint2' }), true);
  assert.equal(editor.applyLoadedCarDocument(decodeDocument(
    'data/server-storage/files/cars/2022 Subaru WRX2/document.json'
  ), { name: '2022 Subaru WRX2' }), true);
  editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
    hydrateCars: false,
    preparedWorldBake: editor.buildRaceWorldBake({ retainTerrainCells: false })
  });
  editor.playtestSession.countdownRemainingMs = 0;
  editor.playtestSession.startupFramePending = false;
  assert.equal(editor.updatePlaytestSafely(0), true);
  assert.equal(editor.applyRaceCarRouteCenterReset({
    projection: { distance: 220 },
    preserveMotion: false
  }), true);
  const runner = editor.playtestSession.vehicleDynamicsRunner;
  const resetGradeDegrees = Math.abs(Number(runner.state.pitchRad || 0)) * 180 / Math.PI;
  assert.ok(resetGradeDegrees > 12, `expected maximum grade, got ${resetGradeDegrees} degrees`);

  // Deliberately accelerate through the real editor input/update path.
  Object.assign(editor.raceInput, {
    rawThrottleAxis: 0.35,
    throttleAxis: 0.35,
    analogThrottleActive: true,
    rawBrakeAxis: 0,
    steeringWheel: 0,
    gear: 1,
    autoShift: false,
    paused: false
  });

  let maximumPostWindowPitchRollRateRadps = 0;
  let maximumPostWindowUnsprungSpeedMps = 0;
  let postWindowWheelContactTransitions = 0;
  let maximumDrivingPitchRollRateRadps = 0;
  let drivingWheelContactTransitions = 0;
  let previousDrivingSupport = null;
  let previousSupport = null;
  for (let frame = 0; frame < 360; frame += 1) {
    if (frame === 180) {
      Object.assign(editor.raceInput, {
        rawThrottleAxis: 0,
        throttleAxis: 0,
        analogThrottleActive: false,
        rawBrakeAxis: 1,
        brakeAxis: 1,
        keyboardBrake: true
      });
    }
    assert.equal(editor.updatePlaytestSafely(1 / 60), true);
    if (frame >= 120 && frame < 180) {
      const drivingAngularVelocityBody = rotateVectorToBody(
        runner.state.angularVelocityWorld, runner.state.orientation
      );
      maximumDrivingPitchRollRateRadps = Math.max(maximumDrivingPitchRollRateRadps,
        Math.abs(Number(drivingAngularVelocityBody.x || 0)),
        Math.abs(Number(drivingAngularVelocityBody.z || 0)));
      const drivingSupport = WHEEL_IDS.map((wheelId) => (
        runner.state.contactPatches?.[wheelId]?.wheelGrounded ? '1' : '0'
      )).join('');
      if (previousDrivingSupport !== null && drivingSupport !== previousDrivingSupport) {
        drivingWheelContactTransitions += 1;
      }
      previousDrivingSupport = drivingSupport;
    }
    if (frame < 240) continue;
    const angularVelocityBody = rotateVectorToBody(
      runner.state.angularVelocityWorld, runner.state.orientation
    );
    maximumPostWindowPitchRollRateRadps = Math.max(maximumPostWindowPitchRollRateRadps,
      Math.abs(Number(angularVelocityBody.x || 0)),
      Math.abs(Number(angularVelocityBody.z || 0)));
    maximumPostWindowUnsprungSpeedMps = Math.max(maximumPostWindowUnsprungSpeedMps,
      ...WHEEL_IDS.map((wheelId) => Math.abs(Number(
        runner.state.suspensionState?.[wheelId]?.unsprungVelocityMps || 0
      ))));
    const support = WHEEL_IDS.map((wheelId) => (
      runner.state.contactPatches?.[wheelId]?.wheelGrounded ? '1' : '0'
    )).join('');
    if (previousSupport !== null && support !== previousSupport) postWindowWheelContactTransitions += 1;
    previousSupport = support;
  }

  assert.ok(maximumDrivingPitchRollRateRadps < 0.1,
    `sustained steep acceleration pitch/roll ${maximumDrivingPitchRollRateRadps} rad/s`);
  assert.equal(drivingWheelContactTransitions, 0,
    `sustained steep acceleration wheel contact transitions ${drivingWheelContactTransitions}`);
  assert.ok(maximumPostWindowPitchRollRateRadps < 0.04,
    `post-window pitch/roll ${maximumPostWindowPitchRollRateRadps} rad/s; unsprung ${maximumPostWindowUnsprungSpeedMps} m/s; transitions ${postWindowWheelContactTransitions}; ground speed ${runner.state.groundSpeedMps} m/s`);
  assert.ok(maximumPostWindowUnsprungSpeedMps < 0.3,
    `post-window unsprung speed ${maximumPostWindowUnsprungSpeedMps} m/s`);
  assert.equal(postWindowWheelContactTransitions, 0,
    `post-window wheel contact transitions ${postWindowWheelContactTransitions}`);
});

test('Studio Sprint2 WRX2 hard first-hill crash cannot contaminate an inclined reset', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  assert.equal(editor.applyLoadedRaceDocument(decodeDocument(
    'tests/fixtures/studioSprint2PerformanceRaceDocument.json'
  ), { name: 'Studio Sprint2' }), true);
  assert.equal(editor.applyLoadedCarDocument(decodeDocument(
    'data/server-storage/files/cars/2022 Subaru WRX2/document.json'
  ), { name: '2022 Subaru WRX2' }), true);
  editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
    hydrateCars: false,
    preparedWorldBake: editor.buildRaceWorldBake({ retainTerrainCells: false })
  });
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  session.startupFramePending = false;
  assert.equal(editor.updatePlaytestSafely(0), true);
  assert.equal(editor.applyRaceCarRouteCenterReset({
    projection: { distance: 500 },
    preserveMotion: false
  }), true);
  const runner = session.vehicleDynamicsRunner;
  const launchState = runner.createStateSnapshot();
  const yaw = Number(launchState.yawRad || session.carYaw || 0);
  const speedMps = 28;
  runner.replaceAuthoritativeState({
    ...launchState,
    velocity: {
      x: Math.sin(yaw) * speedMps,
      y: 0,
      z: Math.cos(yaw) * speedMps
    },
    speedMps,
    groundSpeedMps: speedMps,
    bodyLongitudinalSpeedMps: speedMps,
    signedTravelSpeedMps: speedMps,
    wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
      wheelId, speedMps / runner.config.wheelRadiusM
    ])),
    gear: 3,
    engineRpm: 3500,
    powertrainState: { ...launchState.powertrainState, gear: 3, engineRpm: 3500 }
  });
  Object.assign(editor.raceInput, {
    keyboardThrottle: true,
    rawThrottleAxis: 0.7,
    throttleAxis: 0.7,
    analogThrottleActive: false,
    rawBrakeAxis: 0,
    brakeAxis: 0,
    keyboardBrake: false,
    steeringWheel: 0,
    gear: 3,
    autoShift: false,
    paused: false
  });

  for (let frame = 0; frame < 600; frame += 1) {
    assert.equal(editor.updatePlaytestSafely(1 / 60), true);
  }
  assert.ok(runner.impactHistory.length >= 5,
    `expected the real multi-impact crash, observed ${runner.impactHistory.length}`);
  assert.ok(runner.impactHistory.some((impact) => Number(impact.preImpactKineticEnergyJ) > 10000),
    'the reproduced crash did not contain a hard terrain impact');

  editor.raceInput.autoShift = true;
  assert.equal(editor.applyRaceCarRouteCenterReset({
    // Reset onto the same slight incline used by the parked-settle regression;
    // crash state must not follow the car to a known, independently stable pose.
    projection: { distance: 110 },
    preserveMotion: false
  }), true);
  assert.equal(runner.pendingCollisionImpulses.length, 0);
  assert.equal(runner.activeImpact, null);
  assert.equal(runner.penetrationRecoveryState.currentIncident, null);
  assert.deepEqual(runner.state.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(runner.state.angularVelocityWorld, { x: 0, y: 0, z: 0 });
  for (const tire of Object.values(runner.state.tireState)) {
    assert.equal(Object.hasOwn(tire, 'hubPositionWorld'), false);
    assert.equal(Object.hasOwn(tire, 'normalLoadN'), false);
    assert.equal(Object.hasOwn(tire, 'tireVerticalDeflectionM'), false);
    assert.equal(Object.hasOwn(tire, 'slipRatio'), false);
  }
  const parkedPosition = structuredClone(runner.state.position);
  const parkedOrientation = structuredClone(runner.state.orientation);
  Object.assign(editor.raceInput, {
    keyboardThrottle: false,
    rawThrottleAxis: 0,
    throttleAxis: 0,
    analogThrottleActive: false,
    keyboardBrake: false,
    rawBrakeAxis: 0,
    brakeAxis: 0,
    steeringWheel: 0,
    gear: 1,
    autoShift: true
  });
  for (let frame = 0; frame < 300; frame += 1) {
    assert.equal(editor.updatePlaytestSafely(1 / 60), true);
  }
  assert.ok(runner.stationaryResetHold);
  assert.deepEqual(runner.state.position, parkedPosition);
  assert.deepEqual(runner.state.orientation, parkedOrientation);
  assert.deepEqual(runner.state.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(runner.state.angularVelocityWorld, { x: 0, y: 0, z: 0 });
  assert.equal(Object.values(runner.state.suspensionState).every((suspension) => (
    Number(suspension.unsprungVelocityMps || 0) === 0
      && Number(suspension.compressionVelocityMps || 0) === 0
      && Number(suspension.damperVelocityMps || 0) === 0
  )), true);
});

test('Studio Sprint2 reset visibly returns an off-road crash to stable flat uphill and downhill support', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  assert.equal(editor.applyLoadedRaceDocument(decodeDocument(
    'tests/fixtures/studioSprint2PerformanceRaceDocument.json'
  ), { name: 'Studio Sprint2' }), true);
  assert.equal(editor.applyLoadedCarDocument(decodeDocument(
    'data/server-storage/files/cars/2022 Subaru WRX2/document.json'
  ), { name: '2022 Subaru WRX2' }), true);
  editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
    hydrateCars: false,
    preparedWorldBake: editor.buildRaceWorldBake({ retainTerrainCells: false })
  });
  const session = editor.playtestSession;
  session.countdownRemainingMs = 0;
  session.startupFramePending = false;
  assert.equal(editor.updatePlaytestSafely(0), true);
  const runner = session.vehicleDynamicsRunner;
  Object.assign(editor.raceInput, {
    keyboardThrottle: false,
    rawThrottleAxis: 0,
    throttleAxis: 0,
    analogThrottleActive: false,
    keyboardBrake: false,
    rawBrakeAxis: 0,
    brakeAxis: 0,
    steeringWheel: 0,
    gear: 1,
    autoShift: true
  });
  for (const [label, distance] of [['flat', 40], ['uphill', 220], ['downhill', 374]]) {
    const roadPose = editor.getRaceWorldPoseAtDistance(distance, {
      runtimeType: session.routeRuntimeType
    });
    runner.replaceAuthoritativeState({
      ...runner.createStateSnapshot(),
      position: {
        x: Number(roadPose.x || 0) + 25,
        y: Number(roadPose.elevation || 0) + 12,
        z: Number(roadPose.z || 0) - 20
      },
      orientation: { x: 0, y: 0, z: 1, w: 0 },
      velocity: { x: 18, y: -12, z: 9 },
      angularVelocityWorld: { x: 3, y: -2, z: 4 },
      grounded: false,
      supportedWheelCount: 0
    });
    editor.resetRaceCarToRouteCenter({
      projection: { distance },
      preserveMotion: false
    });
    assert.ok(session.pendingEdgeCenterReset, `${label}: reset command was not queued`);
    session.edgeResetFadeMs = 0;
    editor.updateRaceEdgeCenterResetFade();
    assert.equal(session.pendingEdgeCenterReset, null, `${label}: reset command did not apply`);
    assert.ok(Math.hypot(
      Number(runner.state.position.x) - Number(roadPose.x || 0),
      Number(runner.state.position.z) - Number(roadPose.z || 0)
    ) < 0.25, `${label}: reset did not return to road`);
    assert.equal(runner.state.grounded, true, `${label}: grounded`);
    assert.ok(Number(runner.state.supportedWheelCount || 0) >= 3, `${label}: support`);
    assert.ok(runner.stationaryResetHold, `${label}: hold`);
    const parkedPosition = structuredClone(runner.state.position);
    const parkedOrientation = structuredClone(runner.state.orientation);
    const impactCount = runner.impactHistory.length;
    const recoveryCount = runner.penetrationRecoveryState.history.length;
    for (let frame = 0; frame < 300; frame += 1) {
      assert.equal(editor.updatePlaytestSafely(1 / 60), true, `${label}:${frame}`);
      assert.deepEqual(runner.state.position, parkedPosition, `${label}:position:${frame}`);
      assert.deepEqual(runner.state.orientation, parkedOrientation, `${label}:orientation:${frame}`);
      assert.deepEqual(runner.state.velocity, { x: 0, y: 0, z: 0 }, `${label}:velocity:${frame}`);
      assert.deepEqual(
        runner.state.angularVelocityWorld,
        { x: 0, y: 0, z: 0 },
        `${label}:angular:${frame}`
      );
      assert.equal(Object.values(runner.state.suspensionState).every((suspension) => (
        Number(suspension.unsprungVelocityMps || 0) === 0
          && Number(suspension.compressionVelocityMps || 0) === 0
          && Number(suspension.damperVelocityMps || 0) === 0
      )), true, `${label}:wheel motion:${frame}`);
    }
    assert.equal(runner.impactHistory.length, impactCount, `${label}:impact`);
    assert.equal(runner.penetrationRecoveryState.history.length, recoveryCount, `${label}:recovery`);
  }
});
