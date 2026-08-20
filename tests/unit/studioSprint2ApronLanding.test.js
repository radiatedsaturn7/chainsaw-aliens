import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

import RaceEditor from '../../src/ui/RaceEditor.js';
import { quaternionFromEuler } from '../../src/racing/simulation/RigidBodyMath.js';

const WHEEL_IDS = ['fl', 'fr', 'rl', 'rr'];

function decodeDocument(path) {
  const envelope = JSON.parse(readFileSync(path, 'utf8'));
  return envelope?.__chainsawStorage === 'compact-v1'
    ? JSON.parse(gunzipSync(Buffer.from(envelope.data, 'base64')).toString('utf8'))
    : envelope;
}

test('Studio Sprint2 WRX2 angled apron-edge hill landing cannot become a lawn dart', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
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
  const results = [];
  assert.equal(editor.applyRaceCarRouteCenterReset({
    projection: { distance: 500 }, preserveMotion: false
  }), true);
  const centeredFixtureState = runner.createStateSnapshot();

  for (const side of [-1, 1]) {
    const centered = structuredClone(centeredFixtureState);
    const routeYaw = Number(centered.yawRad || session.carYaw || 0);
    const landingYaw = routeYaw + side * 0.06;
    const lateralOffsetM = side * 1.02;
    const position = {
      x: Number(centered.position.x) + Math.cos(routeYaw) * lateralOffsetM,
      y: Number(centered.position.y),
      z: Number(centered.position.z) - Math.sin(routeYaw) * lateralOffsetM
    };
    const settled = {
      ...centered,
      position,
      worldX: position.x,
      worldZ: position.z,
      heightM: position.y,
      carYaw: landingYaw,
      yawRad: landingYaw,
      orientation: quaternionFromEuler({ yaw: landingYaw, pitch: 0, roll: 0 }),
      routeDistance: 500,
      gear: 3,
      grounded: true
    };
    const speedMps = 20;
    runner.replaceAuthoritativeState({
      ...settled,
      velocity: {
        x: Math.sin(landingYaw) * speedMps,
        y: 0,
        z: Math.cos(landingYaw) * speedMps
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
      powertrainState: { ...settled.powertrainState, gear: 3, engineRpm: 2800 }
    });
    Object.assign(editor.raceInput, {
      rawThrottleAxis: 0.2,
      throttleAxis: 0.2,
      analogThrottleActive: true,
      rawBrakeAxis: 0,
      steeringWheel: 0,
      gear: 3,
      autoShift: false,
      paused: false
    });
    const recoveryStart = runner.penetrationRecoveryState.history.length;
    const stabilizationStart = runner.contactStabilizationState.history.length;
    let wasAirborne = false;
    let landingFrame = null;
    let minimumPostLandingLongitudinalSpeedMps = Infinity;
    const supportFamilies = new Set();
    const terrainRegions = new Set();
    for (let frame = 0; frame < 120; frame += 1) {
      assert.equal(editor.updatePlaytestSafely(1 / 60), true);
      const airborne = !runner.state.wheelGrounded && !runner.state.bodyGrounded;
      if (airborne) wasAirborne = true;
      if (wasAirborne && !airborne && landingFrame === null) landingFrame = frame;
      if (landingFrame !== null && frame - landingFrame <= 6) {
        minimumPostLandingLongitudinalSpeedMps = Math.min(
          minimumPostLandingLongitudinalSpeedMps,
          Math.abs(Number(runner.state.bodyLongitudinalSpeedMps || 0))
        );
      }
      for (const wheelId of WHEEL_IDS) {
        const patch = runner.state.contactPatches?.[wheelId];
        if (patch?.supportFamilyId !== null && patch?.supportFamilyId !== undefined) {
          supportFamilies.add(patch.supportFamilyId);
        }
        if (patch?.terrainSampleSource) terrainRegions.add(patch.terrainSampleSource);
      }
    }
    results.push({
      side,
      landingFrame,
      minimumPostLandingLongitudinalSpeedMps,
      finalLongitudinalSpeedMps: runner.state.bodyLongitudinalSpeedMps,
      recoveries: runner.penetrationRecoveryState.history.slice(recoveryStart),
      stabilization: runner.contactStabilizationState.history.slice(stabilizationStart),
      supportFamilies: [...supportFamilies],
      terrainRegions: [...terrainRegions]
    });
  }

  for (const result of results) {
    assert.notEqual(result.landingFrame, null, JSON.stringify(result));
    assert.deepEqual(result.recoveries, [], JSON.stringify(result));
    assert.equal(result.stabilization.some((event) => (
      event.reason === 'coupled-correction-safe-pose'
        || event.outcome === 'catastrophic-historical-recovery'
        || event.outcome === 'catastrophic-route-recovery'
    )), false, JSON.stringify(result));
    assert.ok(result.minimumPostLandingLongitudinalSpeedMps > 6,
      JSON.stringify(result));
    assert.ok(Math.abs(Number(result.finalLongitudinalSpeedMps || 0)) > 3,
      JSON.stringify(result));
    assert.ok(result.supportFamilies.length > 0, JSON.stringify(result));
    assert.equal(result.terrainRegions.some((source) => source.includes('corridor:')), true,
      JSON.stringify(result));
  }
});
