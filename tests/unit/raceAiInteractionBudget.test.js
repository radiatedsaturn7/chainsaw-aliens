import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRaceAiPhysicsBudget, RACE_AI_DETAIL_POLICY } from '../../src/racing/RaceAiPhysicsBudget.js';
import { consumeRaceAiSimulationStep } from '../../src/racing/RaceAiScheduling.js';
import { createMechanicalState } from '../../src/racing/simulation/MechanicalModel.js';

const car = (id, distance, extra = {}) => ({ id, worldX: distance, worldZ: 0, speedMps: 0, ...extra });
const sessionFor = cars => ({ worldX: 0, worldZ: 0, bodyY: 500.55, aiRuntime: cars });
const fullIds = session => session.aiRuntime.filter(ai => ai.physicsBudgetDetail === 'full').map(ai => ai.id).sort();

test('all distant opponents receive no detailed quota and remain scheduled for cheap updates', () => {
  const session = sessionFor([1000, 2000, 3000, 4000].map((distance, i) => car(i, distance)));
  assignRaceAiPhysicsBudget(session, { seconds: 1 / 60 });
  assert.equal(session.aiDetailedPhysicsCount, 0);
  assert.equal(session.aiCheapPhysicsCount, 4);
  for (const [index, ai] of session.aiRuntime.entries()) {
    let advanced = 0;
    for (let frame = 0; frame < 60; frame++) advanced += consumeRaceAiSimulationStep(ai, session, 1 / 60, index);
    assert.equal(ai.simulationPipelineHz, 20);
    assert.ok(advanced > 0.95 && advanced <= 1.000000001);
    assert.equal(ai.physicsBudgetReason, 'outside-interaction');
  }
});

test('submillimetre rank jitter cannot alternate the third and fourth selected cars', () => {
  const session = sessionFor([car('a', 20), car('b', 25), car('c', 30), car('d', 30.001)]);
  assignRaceAiPhysicsBudget(session);
  for (let frame = 0; frame < 240; frame++) {
    session.aiRuntime[2].worldX = 30 + (frame % 2 ? 0.0001 : -0.0001);
    assignRaceAiPhysicsBudget(session, { seconds: 1 / 60 });
    assert.deepEqual(fullIds(session), ['a', 'b', 'c']);
  }
  assert.equal(session.aiPhysicsBudgetTransitions, 3, 'only the initial three assignments');
});

test('entry and exit distances have hysteresis and teleporting away releases residence immediately', () => {
  const ai = car('boundary', RACE_AI_DETAIL_POLICY.enterDistanceM + 1);
  const session = sessionFor([ai]);
  assignRaceAiPhysicsBudget(session); assert.equal(ai.physicsBudgetDetail, 'cheap');
  ai.worldX = RACE_AI_DETAIL_POLICY.enterDistanceM;
  assignRaceAiPhysicsBudget(session); assert.equal(ai.physicsBudgetDetail, 'full');
  ai.worldX = RACE_AI_DETAIL_POLICY.exitDistanceM - 0.1;
  assignRaceAiPhysicsBudget(session); assert.equal(ai.physicsBudgetDetail, 'full');
  ai.worldX = RACE_AI_DETAIL_POLICY.exitDistanceM + 0.1;
  assignRaceAiPhysicsBudget(session); assert.equal(ai.physicsBudgetDetail, 'cheap');
});

test('residence follows simulation time at 30, 60 and 120 updates per second', () => {
  const transitions = [];
  for (const hz of [30, 60, 120]) {
    const session = sessionFor([car('a', 20), car('b', 30), car('c', 40), car('d', 50)]);
    assignRaceAiPhysicsBudget(session);
    session.aiRuntime[3].worldX = 15;
    let switchedAt = null;
    for (let frame = 1; frame <= hz; frame++) {
      assignRaceAiPhysicsBudget(session, { seconds: 1 / hz });
      if (session.aiRuntime[3].physicsBudgetDetail === 'full') { switchedAt = frame / hz; break; }
    }
    assert.ok(switchedAt >= RACE_AI_DETAIL_POLICY.minimumResidenceSeconds - 1e-9);
    assert.ok(switchedAt <= RACE_AI_DETAIL_POLICY.minimumResidenceSeconds + 1 / hz + 1e-9);
    transitions.push(switchedAt);
  }
  assert.ok(Math.max(...transitions) - Math.min(...transitions) <= 1 / 30 + 1e-9);
});

test('ties use stable identities and do not change when the input fleet is reordered', () => {
  const session = sessionFor(['d', 'c', 'b', 'a'].map(id => car(id, 20)));
  assignRaceAiPhysicsBudget(session); assert.deepEqual(fullIds(session), ['a', 'b', 'c']);
  session.aiRuntime.reverse();
  assignRaceAiPhysicsBudget(session, { seconds: 1 });
  assert.deepEqual(fullIds(session), ['a', 'b', 'c']);
});

test('closing velocity admits an approaching car but equal-speed and receding traffic stay cheap', () => {
  const approaching = car('approaching', 150, { carYaw: -Math.PI / 2, speedMps: 80 });
  const receding = car('receding', 150, { carYaw: Math.PI / 2, speedMps: 80 });
  const session = sessionFor([approaching, receding]);
  assignRaceAiPhysicsBudget(session); assert.deepEqual(fullIds(session), ['approaching']);
  approaching.carYaw = Math.PI / 2;
  session.carYaw = Math.PI / 2; session.speedMps = 80;
  assignRaceAiPhysicsBudget(session, { seconds: 1 });
  assert.equal(session.aiDetailedPhysicsCount, 0);
});

test('authoritative height is already in metres and separated road decks do not create false contact overrides', () => {
  const stateAt = y => ({ state: { position: { y }, velocity: { x: 0, y: 0, z: 0 } } });
  const session = sessionFor([
    car('same-deck', 12, { vehicleDynamicsRunner: stateAt(500.55) }),
    car('other-deck', 0, { vehicleDynamicsRunner: stateAt(620.55) })
  ]);
  session.vehicleDynamicsRunner = stateAt(500.55);
  assignRaceAiPhysicsBudget(session);
  assert.deepEqual(fullIds(session), ['same-deck']);
  assert.equal(session.aiDetailedPhysicsSafetyCount, 0);
});

test('a fourth imminent player collision preempts residence and all queued impacts bypass the ordinary ceiling', () => {
  const session = sessionFor([car('a', 20), car('b', 25), car('c', 30), car('incoming', 150)]);
  assignRaceAiPhysicsBudget(session);
  const incoming = session.aiRuntime[3];
  Object.assign(incoming, { worldX: 12, carYaw: -Math.PI / 2, speedMps: 100 });
  assignRaceAiPhysicsBudget(session, { seconds: 1 / 60 });
  assert.equal(incoming.physicsBudgetDetail, 'full');
  assert.equal(incoming.physicsBudgetReason, 'imminent-player-contact');
  consumeRaceAiSimulationStep(incoming, session, 1 / 60, 2);
  assert.equal(incoming.simulationPipelineHz, 60);
  for (const ai of session.aiRuntime) ai.vehicleDynamicsRunner = { pendingCollisionImpulses: [{ source: 'player' }] };
  assignRaceAiPhysicsBudget(session, { seconds: 1 / 60 });
  assert.equal(session.aiDetailedPhysicsCount, 4);
  assert.equal(session.aiDetailedPhysicsSafetyCount, 4);
  assert.equal(session.aiDetailedPhysicsOverflowCount, 1);
  for (const ai of session.aiRuntime) assert.equal(ai.vehicleDynamicsRunner.pendingCollisionImpulses.length, 1);
});

test('four simultaneous imminent contacts bypass the ceiling before impulses are queued', () => {
  const session = sessionFor([
    car('east', 12, { carYaw: -Math.PI / 2, speedMps: 100 }),
    car('west', -12, { carYaw: Math.PI / 2, speedMps: 100 }),
    car('north', 0, { worldZ: 12, carYaw: Math.PI, speedMps: 100 }),
    car('south', 0, { worldZ: -12, carYaw: 0, speedMps: 100 })
  ]);
  assignRaceAiPhysicsBudget(session, { seconds: 1 / 60 });
  assert.equal(session.aiDetailedPhysicsCount, 4);
  assert.equal(session.aiDetailedPhysicsSafetyCount, 4);
  for (const ai of session.aiRuntime) assert.equal(ai.physicsBudgetReason, 'imminent-player-contact');
  session.aiRuntime = [];
  assignRaceAiPhysicsBudget(session);
  assert.equal(session.aiDetailedPhysicsCount, 0);
  assert.equal(session.aiDetailedPhysicsSafetyCount, 0);
  assert.equal(session.aiDetailedPhysicsOverflowCount, 0);
});

test('worker authority keeps its own policy and returning to main thread applies spatial eligibility', () => {
  const session = sessionFor([car('far', 1000)]);
  assignRaceAiPhysicsBudget(session, { worker: true });
  assert.equal(session.aiRuntime[0].physicsBudgetDetail, null);
  assert.equal(session.aiDetailedPhysicsCount, 1);
  assignRaceAiPhysicsBudget(session);
  assert.equal(session.aiDetailedPhysicsCount, 0);
});

test('real all-distant fleet uses zero detailed solver steps, then four queued impacts promote and apply without losing state', async () => {
  const { default: RaceEditor } = await import('../../src/ui/RaceEditor.js');
  const editor = new RaceEditor({}, { mode: 'race' });
  editor.selectedRace.road.network.nodes[1].z = 2000;
  editor.selectedRace.road.network.edges[0].widthM = 12;
  editor.selectedRace.road.network.finishNodeId = 'end';
  editor.selectedRace.road.nodes = [];
  editor.selectedRace.road.segments = [{ length: 2000, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 12, hazardIds: [] }];
  editor.selectedRace.hazards = []; editor.selectedRace.scenery = [];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const session = editor.playtestSession;
  Object.assign(session, { countdownRemainingMs: 0, startupFramePending: false, preparing: false, running: true, launchLockMs: 0 });
  if (session.raceIntro) session.raceIntro.active = false;
  editor.updatePlaytest(1 / 60);
  const car = editor.selectedCar;
  session.aiRuntime = Array.from({ length: 29 }, (_, index) => {
    const distance = 200 + index * 40, pose = editor.getRaceWorldPoseAtDistance(distance);
    return { id: `distant-${index}`, carId: car.id, runtimeCar: car, worldX: pose.x, worldZ: pose.z ?? pose.y,
      carYaw: pose.yaw, speedMps: 5, projectedDistance: distance, distance, gear: 1, rpm: 2200,
      lap: 2, currentLapMs: 1000, engineDrive: { throttle: .5, brake: 0 }, difficulty: 'hard', lineOffset: 0 };
  });
  const updatePhysics = editor.updateRaceAiVehiclePhysics.bind(editor);
  const solved = [];
  editor.updateRaceAiVehiclePhysics = (ai, options) => {
    if (options.seconds > 0) solved.push(ai.id);
    return updatePhysics(ai, options);
  };
  for (let frame = 0; frame < 3; frame++) editor.updateRaceAiDrivers(1 / 60);
  // AI mechanical condition is optional; exercise its continuity explicitly.
  for (const ai of session.aiRuntime) ai.vehicleDynamicsRunner.state.mechanical = createMechanicalState({}, {}, car.mechanics);
  const initial = session.aiRuntime.map(ai => ({ runner: ai.vehicleDynamicsRunner, fuel: ai.vehicleDynamicsRunner.state.mechanical.fuel }));
  for (let frame = 0; frame < 87; frame++) editor.updateRaceAiDrivers(1 / 60);
  assert.equal(session.aiDetailedPhysicsCount, 0);
  assert.equal(solved.length, 0, 'the real pipeline performs no positive-duration detailed steps for a distant fleet');
  for (const [index, ai] of session.aiRuntime.entries()) {
    assert.equal(ai.vehicleDynamicsRunner, initial[index].runner, 'steady cheap operation never reconstructs its runner');
    assert.ok(ai.distance > 200 + index * 40 + 1, `cheap car ${index} continues racing`);
    assert.ok(ai.vehicleDynamicsRunner.observedTimeSeconds > 1.4);
    assert.ok(ai.vehicleDynamicsRunner.state.mechanical.fuel < initial[index].fuel);
    assert.equal(ai.lap, 2);
    assert.ok(Math.abs(ai.currentLapMs - 2500) < 1e-6);
  }
  const impacted = session.aiRuntime.slice(0, 4);
  const before = impacted.map(ai => ({ runner: ai.vehicleDynamicsRunner, x: ai.worldX, z: ai.worldZ,
    time: ai.vehicleDynamicsRunner.observedTimeSeconds, fuel: ai.vehicleDynamicsRunner.state.mechanical.fuel }));
  for (const ai of impacted) ai.vehicleDynamicsRunner.queueCollisionImpulse({ impulseWorldNs: { x: 1500, y: 0, z: 0 }, source: 'player' });
  editor.updateRaceAiDrivers(1 / 60);
  assert.deepEqual(solved.sort(), impacted.map(ai => ai.id).sort());
  assert.equal(session.aiDetailedPhysicsCount, 4);
  assert.equal(session.aiDetailedPhysicsOverflowCount, 1);
  for (const [index, ai] of impacted.entries()) {
    const runner = ai.vehicleDynamicsRunner;
    assert.notEqual(runner, before[index].runner, 'promotion rebuilds stale solver caches');
    assert.equal(runner.pendingCollisionImpulses.length, 0, 'the full step consumes its retained impulse');
    assert.ok(runner.state.velocity.x > .01, 'the collision impulse affects motion');
    assert.ok(Math.hypot(ai.worldX - before[index].x, ai.worldZ - before[index].z) < 2, 'no promotion teleport');
    assert.ok(runner.observedTimeSeconds > before[index].time);
    assert.ok(runner.state.mechanical.fuel <= before[index].fuel);
    assert.equal(ai.lap, 2);
  }
});
