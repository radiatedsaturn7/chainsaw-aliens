import assert from 'node:assert/strict';
import test from 'node:test';
import { planRaceAiDriving, selectRaceAiCars } from '../../src/racing/RaceAiDriving.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

const road = (pose = (d) => ({ x: 0, z: d, yaw: 0 })) => ({
  playtestSession: { routeRuntimeType: 'circuit', routeLength: 2000, aiRuntime: [] },
  getRaceWorldPoseAtDistance: (d) => ({ ...pose(d), segment: {} }),
  getRaceRoadHalfWidthWorld: () => 5,
  getRaceRightVector: (yaw) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) })
});
const car = { wheelbaseM: 2.65, widthM: 1.8 };
const racer = (extra = {}) => ({ worldX: 0, worldZ: 0, carYaw: 0, speedMps: 20,
  projectedDistance: 0, lineOffset: 0, ...extra });

test('random grid uses all available custom cars before repeating, without changing the catalog', () => {
  const cars = [{ id: 'custom' }, { id: 'brz' }, { id: 'wrx' }];
  const original = structuredClone(cars);
  const a = selectRaceAiCars(cars, 8, () => 0);
  const b = selectRaceAiCars(cars, 8, () => 0.99);
  assert.notDeepEqual(a, b);
  assert.equal(a.length, 8);
  for (const start of [0, 3]) assert.equal(new Set(a.slice(start, start + 3)).size, 3);
  assert.deepEqual(cars, original);
  assert.deepEqual(selectRaceAiCars([], 11), []);
  assert.deepEqual(selectRaceAiCars([{ id: 'only' }], 3), ['only', 'only', 'only']);
});

test('steering corrects position, heading, and chosen lane on a straight', () => {
  const editor = road();
  assert.equal(planRaceAiDriving(editor, racer(), car).steeringAngleRad, 0);
  assert.ok(planRaceAiDriving(editor, racer({ worldX: 3 }), car).steeringAngleRad < 0);
  assert.ok(planRaceAiDriving(editor, racer({ worldX: -3 }), car).steeringAngleRad > 0);
  assert.ok(planRaceAiDriving(editor, racer({ carYaw: 0.25 }), car).steeringAngleRad < 0);
  assert.ok(planRaceAiDriving(editor, racer({ lineOffset: 0.5 }), car).steeringAngleRad < 0);
});

test('AI anticipates geometric bends and brakes earlier with lower grip', () => {
  const editor = road((d) => d < 60 ? { x: 0, z: d, yaw: 0 }
    : { x: 20 * (1 - Math.cos((d - 60) / 20)), z: 60 + 20 * Math.sin((d - 60) / 20), yaw: (d - 60) / 20 });
  const dry = planRaceAiDriving(editor, racer({ speedMps: 35 }), car, { grip: 1, topSpeedMps: 60 });
  const wet = planRaceAiDriving(editor, racer({ speedMps: 35 }), car, { grip: 0.4, topSpeedMps: 60 });
  assert.ok(dry.targetSpeedMps < 35);
  assert.ok(wet.targetSpeedMps < dry.targetSpeedMps);
  assert.equal(planRaceAiDriving(road(), racer(), car).targetSpeedMps, 60);
});

test('AI yields to slower traffic while allowing cars in other lanes', () => {
  const editor = road();
  const ai = racer();
  editor.playtestSession.aiRuntime = [ai, racer({ worldZ: 12, speedMps: 5 })];
  assert.ok(planRaceAiDriving(editor, ai, car).targetSpeedMps <= 5);
  editor.playtestSession.aiRuntime[1].worldX = 4;
  assert.equal(planRaceAiDriving(editor, ai, car).targetSpeedMps, 60);
  Object.assign(editor.playtestSession, { worldX: 0, worldZ: 12, speedMps: 0 });
  assert.equal(planRaceAiDriving(editor, ai, car).targetSpeedMps, 0);
});

test('pure pursuit follows a full geometric circle without a curve metadata hint', () => {
  const radius = 50;
  const editor = road((d) => ({ x: radius * (1 - Math.cos(d / radius)),
    z: radius * Math.sin(d / radius), yaw: d / radius }));
  const ai = racer({ speedMps: 12 });
  let maxError = 0;
  for (let step = 0; step < 1800; step += 1) {
    const plan = planRaceAiDriving(editor, ai, car);
    ai.carYaw += ai.speedMps / car.wheelbaseM * Math.tan(plan.steeringAngleRad) / 60;
    ai.worldX += Math.sin(ai.carYaw) * ai.speedMps / 60;
    ai.worldZ += Math.cos(ai.carYaw) * ai.speedMps / 60;
    ai.projectedDistance = ((Math.atan2(ai.worldZ, radius - ai.worldX) + Math.PI * 2) % (Math.PI * 2)) * radius;
    maxError = Math.max(maxError, Math.abs(Math.hypot(ai.worldX - radius, ai.worldZ) - radius));
  }
  assert.ok(maxError < 0.5, `maximum path error ${maxError}`);
});

test('starting a race randomizes actual runtime cars and places separate opponents on the track', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const playerId=editor.getRaceCarProjectIdentity(editor.selectedCar);
  const savedCars=['WRX4','Buse','pz-24'].map((name,index)=>{const saved=editor.withSavedRaceCarRuntimeIdentity(structuredClone(editor.selectedCar),name);saved.tuning.powerHp=200+index*100;editor.upsertRaceProjectCar(saved);return saved;});
  editor.selectedRace.competition.carSelection={availableCarIds:savedCars.map(car=>editor.getRaceCarProjectIdentity(car)),defaultCarId:editor.getRaceCarProjectIdentity(savedCars[1])};
  editor.setRaceAiCount(4);
  const savedDrivers = structuredClone(editor.selectedRace.competition.aiDrivers);
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const runtime = editor.playtestSession.aiRuntime;
  assert.equal(runtime.length, 4);
  assert.equal(new Set(runtime.slice(0,3).map(ai=>ai.carId)).size,3);
  assert.equal(runtime[3].carId,editor.getRaceCarProjectIdentity(savedCars[1]));
  assert.ok(runtime.every(ai=>ai.carId!==playerId));
  for(const ai of runtime)assert.equal(ai.runtimeCar.__playtestId,ai.carId);
  assert.deepEqual(runtime.map((ai) => ai.carId), editor.playtestSession.aiDrivers.map((ai) => ai.carId));
  assert.deepEqual(editor.selectedRace.competition.aiDrivers, savedDrivers);
  assert.equal(new Set(runtime.map((ai) => `${ai.worldX},${ai.worldZ}`)).size, 4);
  assert.ok(runtime.every((ai) => Number.isFinite(ai.carYaw)));
});

test('AI crosses the finish before slowing down on a destination route', () => {
  const editor = road();
  editor.playtestSession.routeRuntimeType = 'destination';
  assert.ok(planRaceAiDriving(editor, racer({ projectedDistance: 1999, worldZ: 1999 }), car).targetSpeedMps > 0);
  assert.equal(planRaceAiDriving(editor, racer({ projectedDistance: 2000, worldZ: 2000 }), car).targetSpeedMps, 0);
});

test('AI corrects a displaced car using the actual tire and chassis simulation', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.road.segments = [{ length: 1200, curve: 0, elevation: 0,
    surface: 'asphalt', roadWidthM: 10, hazardIds: [] }];
  editor.selectedRace.road.nodes = [];
  editor.selectedRace.hazards = [];
  editor.selectedRace.scenery = [];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  editor.playtestSession.countdownRemainingMs = 0;
  const selectedCar = editor.selectedCar;
  const tuning = editor.getRaceCarTuning(selectedCar);
  const ai = racer({ id: 'physics-line-test', carId: selectedCar.id, difficulty: 'hard',
    worldX: 2, worldZ: 60, speedMps: 12, projectedDistance: 60, distance: 60,
    gear: 2, rpm: 3000, engineDrive: { throttle: 0.15, brake: 0 } });
  for (let frame = 0; frame < 120; frame += 1) {
    editor.updateRaceAiVehiclePhysics(ai, { car: selectedCar, tuning, seconds: 1 / 60 });
    ai.projectedDistance = editor.getRaceRouteProjectionForWorldPoint({ x: ai.worldX, z: ai.worldZ }).distance;
  }
  assert.ok(Math.abs(ai.worldX) < 1, `remaining lateral error: ${ai.worldX}`);
  assert.ok(ai.worldZ > 70, 'opponent continues forward while correcting');
});

test('AI sprites use physical position and heading instead of snapping to their desired line', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  const ai = racer({ carId: editor.selectedCar.id, worldX: 3, worldZ: 40, carYaw: 0.2,
    projectedDistance: 40, lineOffset: -0.5 });
  editor.playtestSession = { routeRuntimeType: 'destination', routeLength: 1200, aiRuntime: [ai] };
  editor.projectRaceWorldPointToCamera = (point) => ({ ...point, visible: true, screenY: 100, cameraZ: 20 });
  let drawn;
  editor.drawRaceProjectedCarSprite = (_ctx, _bounds, options) => { drawn = options; };
  editor.drawRaceProjectedAiCars({}, { x: 0, y: 0, w: 390, h: 240 });
  assert.equal(drawn.projected.x, 3);
  assert.equal(drawn.projected.z, 40);
  assert.equal(drawn.yaw, 0.2);
});

test('art preloading includes the cars drawn for this race instead of the saved lineup', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.project.cars.push({ id: 'custom-grid-car', art: { body: 'custom-grid-body' } });
  editor.playtestSession = { raceId: editor.selectedRace.id, aiDrivers: [{ carId: 'custom-grid-car' }] };
  assert.ok(editor.collectSelectedRaceArtRefs().includes('custom-grid-body'));
});

test('crossing the grid start does not award an extra lap, including rolling starts', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.setRaceAiCount(1);
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const session = editor.playtestSession;
  session.routeRuntimeType = 'circuit';
  session.trackState = null;
  const ai = session.aiRuntime[0];
  editor.getRaceRouteProjectionForWorldPoint = () => ({ distance: 1 });
  editor.getRaceAiLongitudinalPhysicsStep = () => ({ gripFactor: 1 });
  editor.updateRaceAiVehiclePhysics = () => {};
  Object.assign(ai, { awaitingStartLine: true, projectedDistance: session.routeLength - 1, speedMps: 10 });
  editor.updateRaceAiDrivers(1 / 60);
  assert.equal(ai.lap, 1);
  assert.equal(ai.awaitingStartLine, false);
  ai.projectedDistance = session.routeLength - 1;
  editor.updateRaceAiDrivers(1 / 60);
  assert.equal(ai.lap, 2);
  Object.assign(ai, { lap: 1, awaitingStartLine: true, projectedDistance: session.routeLength - 1 });
  editor.updateRaceAiDrivers(1 / 60, { preStartMode: 'rolling', rollingStartSpeedMps: 10 });
  assert.equal(ai.lap, 1);
  assert.equal(ai.awaitingStartLine, false);
});

test('AI braking lookahead reuses segment endpoints instead of sampling them twice',()=>{
  const e=road();let samples=0;const original=e.getRaceWorldPoseAtDistance;
  e.getRaceWorldPoseAtDistance=(...args)=>{samples++;return original(...args);};
  const plan=planRaceAiDriving(e,racer({speedMps:100}),car,{topSpeedMps:100});
  assert.equal(plan.targetSpeedMps,100);
  assert.equal(samples,43,'one steering sample plus 42 distinct endpoints across a 320 metre braking horizon');
});
