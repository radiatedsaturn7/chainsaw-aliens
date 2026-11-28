import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createVehicleRenderStateFromRunner,
  reconstructVehicleRenderState
} from '../../src/racing/simulation/VehicleRenderState.js';
import { quaternionFromEuler } from '../../src/racing/simulation/RigidBodyMath.js';

const wheelIds = ['fl', 'fr', 'rl', 'rr'];

function runnerFor({ pitch = 0, roll = 0, yaw = 0, compression = 0.08,
  position = { x: 4, y: 1.2, z: 8 }, spin = 0.4 } = {}) {
  const orientation = quaternionFromEuler({ pitch, roll, yaw });
  const contactPatches = {};
  const suspensionState = {};
  for (const wheelId of wheelIds) {
    const front = wheelId[0] === 'f';
    const left = wheelId[1] === 'l';
    suspensionState[wheelId] = { compressionM: compression };
    contactPatches[wheelId] = {
      normalLoadN: 2800,
      validTreadContact: true,
      geometricContact: true,
      normalLoadKnown: true,
      steeringAngleRad: front ? 0.2 : 0,
      camberAngleRad: left ? -0.03 : 0.03,
      toeAngleRad: front ? 0.01 : -0.005,
      contactPointWorld: { x: position.x, y: 0, z: position.z },
      surfaceNormalWorld: { x: 0, y: 1, z: 0 }
    };
  }
  return {
    stepIndex: 10,
    simulationTimeSeconds: 1,
    renderWheelSpinAngles: Object.fromEntries(wheelIds.map((id) => [id, spin])),
    config: {
      wheelbaseM: 2.7, cgToFrontAxleM: 1.35, cgToRearAxleM: 1.35,
      frontTrackWidthM: 1.6, rearTrackWidthM: 1.58,
      cgHeightM: 0.55, wheelRadiusM: 0.337
    },
    state: {
      position, orientation, velocity: {}, angularVelocityWorld: {},
      contactPatches, suspensionState,
      wheelAngularVelocityRadps: Object.fromEntries(wheelIds.map((id) => [id, 20])),
      tireState: {}, grounded: true
    }
  };
}

for (const scenario of [
  { name: 'hill pitch', options: { pitch: 0.3 } },
  { name: 'banked-road roll', options: { roll: -0.24 } },
  { name: 'full suspension compression', options: { compression: 0.2 } },
  { name: 'body collision correction', options: { position: { x: 4.08, y: 1.3, z: 7.9 }, yaw: 0.1 } },
  { name: 'local CCD rollback', options: { position: { x: 3.92, y: 1.18, z: 7.75 }, yaw: -0.08 } },
  { name: 'recovery reset', options: { position: { x: 0, y: 0.9, z: 0 }, yaw: 1.2 } }
]) {
  test(`VehicleRenderState preserves body-local wheels through ${scenario.name}`, () => {
    const state = createVehicleRenderStateFromRunner(runnerFor(scenario.options));
    const before = Object.fromEntries(wheelIds.map((id) => [id, {
      ...state.wheels[id].hubPositionBody
    }]));
    reconstructVehicleRenderState(state);
    for (const wheelId of wheelIds) {
      assert.deepEqual(state.wheels[wheelId].hubPositionBody, before[wheelId]);
      assert.equal(Number.isFinite(state.wheelPoses[wheelId].position.x), true);
      assert.equal(state.wheels[wheelId].camberAngleRad,
        wheelId[1] === 'l' ? -0.03 : 0.03);
    }
  });
}

test('VehicleRenderState wheel spin wraps forward without reversing', () => {
  const state = createVehicleRenderStateFromRunner(runnerFor({ spin: Math.PI * 2 + 0.2 }));
  assert.equal(state.wheels.fl.spinAngleRad > Math.PI * 2, true);
  assert.equal(state.wheelPoses.fl.angularSpeedRadps, 20);
});

test('VehicleRenderState always contains four finite attached wheels without contacts', () => {
  const runner = runnerFor();
  runner.state.contactPatches = {};
  runner.state.suspensionState = {};
  runner.state.grounded = false;
  runner.state.vehicleResetGeneration = 8;
  const state = createVehicleRenderStateFromRunner(runner);
  assert.equal(state.resetGeneration, 8);
  assert.deepEqual(Object.keys(state.wheels).sort(), wheelIds);
  for (const wheelId of wheelIds) {
    assert.equal(state.wheels[wheelId].resetGeneration, 8);
    assert.equal(state.wheels[wheelId].loadBearing, false);
    assert.equal(state.wheels[wheelId].terrainDataAvailable, false);
    assert.equal(Number.isFinite(state.wheels[wheelId].hubPositionBody.x), true);
    assert.equal(Number.isFinite(state.wheelPoses[wheelId].position.x), true);
  }
});

test('VehicleRenderState ignores stale tire-substep world hubs at high chassis speed', () => {
  const runner = runnerFor({ position: { x: 80, y: 1.2, z: 160 } });
  for (const wheelId of wheelIds) {
    runner.state.contactPatches[wheelId].hubPositionWorld = {
      x: wheelId[1] === 'l' ? -0.8 : 0.8,
      y: 0.5,
      z: wheelId[0] === 'f' ? 1.35 : -1.35
    };
    runner.state.contactPatches[wheelId].suspensionMountPositionWorld = {
      x: 0,
      y: 1,
      z: 0
    };
  }

  const first = createVehicleRenderStateFromRunner(runner);
  runner.state.position = { x: 86, y: 1.2, z: 172 };
  const second = createVehicleRenderStateFromRunner(runner);

  for (const wheelId of wheelIds) {
    assert.deepEqual(second.wheels[wheelId].hubPositionBody,
      first.wheels[wheelId].hubPositionBody);
    assert.equal(second.wheelPoses[wheelId].position.x - first.wheelPoses[wheelId].position.x, 6);
    assert.equal(second.wheelPoses[wheelId].position.z - first.wheelPoses[wheelId].position.z, 12);
  }
});

test('grounded showcase wheels start at rest height, not full suspension droop',()=>{
 const runner=runnerFor({position:{x:0,y:10.55,z:0}});
 Object.assign(runner.config,{suspensionTravelFrontM:.2,suspensionTravelRearM:.3,staticSagRatioFront:.4,staticSagRatioRear:.5});
 runner.state.suspensionState={};runner.state.contactPatches={};
 const before=structuredClone(runner.state);
 const render=createVehicleRenderStateFromRunner(runner);
 for(const id of wheelIds)assert.ok(Math.abs(render.wheelPoses[id].position.y-render.wheels[id].radiusM-10)<1e-9);
 assert.deepEqual(runner.state,before,'presentation must not advance or modify physics');
 runner.state.grounded=false;
 const airborne=createVehicleRenderStateFromRunner(runner);
 assert.ok(airborne.wheelPoses.fl.position.y<render.wheelPoses.fl.position.y-.07);
});

test('AI body and wheels advance together between fixed steps without changing physics',async()=>{
 const {raceAiRenderState}=await import('../../src/racing/RaceAiRenderState.js');
 const runner=runnerFor();runner.config.chassisHz=60;runner.stepIndex=60;
 runner.simulationTimeSeconds=1;runner.observedTimeSeconds=1+1/120;
 runner.state.velocity={x:0,y:0,z:24};runner.state.angularVelocityWorld={x:0,y:0,z:0};
 runner.state.wheelAngularVelocityRadps=Object.fromEntries(wheelIds.map(id=>[id,72]));
 const canonical=createVehicleRenderStateFromRunner(runner),before=structuredClone(canonical);
 const session={vehicleRenderState:canonical,vehicleDynamicsRunner:runner,physicsBudgetDetail:'full'};
 const render=raceAiRenderState(session);
 assert.ok(Math.abs(render.position.z-canonical.position.z-.2)<1e-8);
 for(const id of wheelIds){
  assert.ok(Math.abs(render.wheelPoses[id].position.z-canonical.wheelPoses[id].position.z-.2)<1e-8);
  assert.ok(Math.abs(render.wheels[id].spinAngleRad-canonical.wheels[id].spinAngleRad-.6)<1e-8);
 }
 assert.deepEqual(canonical,before,'presentation must not alter authoritative snapshot');
 runner.pendingCollisionImpulses=[{}];assert.strictEqual(raceAiRenderState(session),canonical);
 runner.pendingCollisionImpulses=[];session.workerVehicleId='ai';assert.strictEqual(raceAiRenderState(session),canonical);
 delete session.workerVehicleId;runner.observedTimeSeconds=100;
 assert.ok(raceAiRenderState(session).position.z-canonical.position.z<=.400001,'lead capped at one tick');
});
