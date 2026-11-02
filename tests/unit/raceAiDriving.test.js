import assert from 'node:assert/strict';
import test from 'node:test';
import { planRaceAiDriving, selectRaceAiCars, getRaceAiRoadSafety } from '../../src/racing/RaceAiDriving.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {prepareRaceAiDirector, getRaceAiDirector} from '../../src/racing/RaceAiDirector.js';

const road = (pose = (d) => ({ x: 0, z: d, yaw: 0 })) => ({
  playtestSession: { routeRuntimeType: 'circuit', routeLength: 2000, aiRuntime: [] },
  getRaceWorldPoseAtDistance: (d) => ({ ...pose(d), segment: {} }),
  getRaceRoadHalfWidthWorld: () => 5,
  getRaceRightVector: (yaw) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) })
});
const car = { wheelbaseM: 2.65, widthM: 1.8 };
const racer = (extra = {}) => ({ worldX: 0, worldZ: 0, carYaw: 0, speedMps: 20,
  projectedDistance: 0, lineOffset: 0, ...extra });

test('advisory schedules reduce lookahead and traffic work while steering stays live',()=>{
  const measure=(detail,hz)=>{
    const e=road();e.playtestSession.debugAiNoRoadPlan=true;
    const ai=racer({physicsBudgetDetail:detail});e.playtestSession.aiRuntime=[ai];
    prepareRaceAiDirector(e);const director=getRaceAiDirector(e);
    let poses=0;const original=e.getRaceWorldPoseAtDistance;
    e.getRaceWorldPoseAtDistance=d=>{poses++;return original(d);};
    // Recreate the director after replacing the provider; force uncached
    // curvature so pose counts expose actual braking-lookahead frequency.
    prepareRaceAiDirector(e);const active=getRaceAiDirector(e);
    const options={seconds:1/hz,roadSafety:{risk:0,maxLineOffset:.78}};
    let extra=0;
    for(let i=0;i<hz*3;i++){
      active.headings.clear();active.road.clear();const before=poses;
      planRaceAiDriving(e,ai,car,options);
      if(poses-before>1)extra++;
    }
    const straight=planRaceAiDriving(e,ai,car,options);
    ai.worldX=2;
    assert.notEqual(planRaceAiDriving(e,ai,car,{...options,seconds:0}).steeringAngleRad,straight.steeringAngleRad);
    return {extra,traffic:active.stats.trafficCandidates};
  };
  for(const hz of [30,60,120]){
    const cheap=measure('cheap',hz),full=measure('full',hz);
    assert.ok(cheap.extra>=12&&cheap.extra<=13,JSON.stringify(cheap));
    assert.ok(full.extra>=30&&full.extra<=31,JSON.stringify(full));
    assert.ok(cheap.traffic<=22,JSON.stringify(cheap));
    assert.ok(full.traffic>=hz*3);
  }
});

test('planning phases are spread across the fleet and do not replay missed decisions',()=>{
  const e=road();e.playtestSession.debugAiIndependentPlanning=true;
  const ais=Array.from({length:20},()=>racer({physicsBudgetDetail:'cheap'}));
  const options={seconds:1/60,roadSafety:{risk:0,maxLineOffset:.78}};
  let samples=0;const original=e.getRaceWorldPoseAtDistance;
  e.getRaceWorldPoseAtDistance=d=>{samples++;return original(d);};
  ais.forEach((ai,i)=>planRaceAiDriving(e,ai,car,{...options,scheduleIndex:i}));
  const counts=[];
  for(let frame=0;frame<60;frame++){
    let decisions=0;
    ais.forEach((ai,i)=>{const before=samples;planRaceAiDriving(e,ai,car,{...options,scheduleIndex:i});if(samples-before>1)decisions++;});
    counts.push(decisions);
  }
  assert.ok(Math.max(...counts)<=3,JSON.stringify(counts));
  const before=samples;planRaceAiDriving(e,ais[0],car,{...options,seconds:10});
  assert.ok(samples-before<60,'a stall makes one fresh plan, not a backlog of plans');
});

test('promotion, teleport and sudden grip loss invalidate advice; detailed traffic reacts immediately',()=>{
  const e=road();e.playtestSession.debugAiIndependentPlanning=true;
  const ai=racer({physicsBudgetDetail:'cheap'}),leader=racer({worldZ:5,speedMps:0});
  const options={seconds:.001,roadSafety:{risk:0,maxLineOffset:.78}};
  e.playtestSession.aiRuntime=[ai];
  planRaceAiDriving(e,ai,car,options);
  e.playtestSession.aiRuntime.push(leader);
  ai.physicsBudgetDetail='full';
  assert.equal(planRaceAiDriving(e,ai,car,options).targetSpeedMps,0);
  leader.worldX=10;
  assert.ok(planRaceAiDriving(e,ai,car,options).targetSpeedMps>0);
  ai.physicsBudgetDetail='cheap';planRaceAiDriving(e,ai,car,options);
  let samples=0;const original=e.getRaceWorldPoseAtDistance;
  e.getRaceWorldPoseAtDistance=d=>{samples++;return original(d);};
  planRaceAiDriving(e,ai,car,{...options,seconds:0,grip:.4});
  assert.ok(samples>1,'grip loss refreshes braking advice');
  samples=0;ai.worldZ=100;ai.projectedDistance=100;leader.worldZ=105;leader.worldX=0;
  assert.equal(planRaceAiDriving(e,ai,car,{...options,seconds:0,grip:.4}).targetSpeedMps,0);
  assert.ok(samples>1,'teleport discards prior pose advice');
});

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
  editor.selectedRace.road.network=null;
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
  editor.projectRaceWorldPointToCamera = (point) => ({ ...point, visible: true, screenX: 100, screenY: 100, cameraZ: 20 });
  let drawn;
  editor.drawRaceProjectedCarSprite = (_ctx, _bounds, options) => { drawn = options; };
  editor.drawRaceProjectedAiCars({}, { x: 0, y: 0, w: 390, h: 240 });
  assert.equal(drawn.projected.x, 3);
  assert.equal(drawn.projected.z, 40);
  assert.equal(drawn.yaw, 0.2);
  drawn=null;
  editor.projectRaceWorldPointToCamera = point => ({...point,visible:true,screenX:10000,screenY:100,cameraZ:20});
  editor.drawRaceProjectedAiCars({}, {x:0,y:0,w:390,h:240});
  assert.equal(drawn,null,'off-screen cars must not rasterize their art');
});

test('art preloading includes the cars drawn for this race instead of the saved lineup', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.project.cars.push({ id: 'custom-grid-car', art: { body: 'custom-grid-body' } });
  editor.playtestSession = { raceId: editor.selectedRace.id, aiDrivers: [{ carId: 'custom-grid-car' }] };
  assert.ok(editor.collectSelectedRaceArtRefs().includes('custom-grid-body'));
});

test('crossing the grid start does not award an extra lap, including rolling starts', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.upsertRaceProjectCar(editor.withSavedRaceCarRuntimeIdentity(structuredClone(editor.selectedCar), 'Grid Opponent'));
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

test('independent AI braking lookahead reuses segment endpoints instead of sampling them twice',()=>{
  const e=road();e.playtestSession.debugAiIndependentPlanning=true;let samples=0;const original=e.getRaceWorldPoseAtDistance;
  e.getRaceWorldPoseAtDistance=(...args)=>{samples++;return original(...args);};
  const plan=planRaceAiDriving(e,racer({speedMps:100}),car,{topSpeedMps:100});
  assert.equal(plan.targetSpeedMps,100);
  assert.equal(samples,45,'two safety samples, one steering sample and 42 distinct braking endpoints');
});


test('steep and narrow roads reduce pace and keep the requested line away from edges',()=>{
 const flat=road(), hill=road(d=>({x:0,z:d,yaw:0,elevation:d*.1}));
 const ai=racer({lineOffset:.7});
 const safe=getRaceAiRoadSafety(hill,ai,car);
 assert.ok(safe.maxLineOffset<=.21);
 const hillPlan=planRaceAiDriving(hill,ai,car);
 const flatPlan=planRaceAiDriving(flat,ai,car);
 assert.ok(hillPlan.targetSpeedMps<flatPlan.targetSpeedMps);
 assert.ok(hillPlan.lookahead<flatPlan.lookahead);
 flat.getRaceRoadHalfWidthWorld=()=>1.5;
 const narrow=getRaceAiRoadSafety(flat,ai,car);
 assert.equal(narrow.maxLineOffset,0);
});


test('recorded Mount Washington side-by-side queue does not mutually brake on a bend',()=>{
 const e=road();
 const a=racer({worldX:1316.9560654854224,worldZ:-906.7888488645672,carYaw:-1.2734713813587397,speedMps:0});
 const b=racer({worldX:1316.2442617274578,worldZ:-908.9926930364625,carYaw:-1.075579400294879,speedMps:0});
 e.playtestSession.aiRuntime=[a,b];
 for(const ai of [a,b]) assert.ok(planRaceAiDriving(e,ai,car).targetSpeedMps>1);
 // A stopped car truly ahead still requires a stop.
 const leader=racer({worldX:0,worldZ:4,speedMps:0});
 const follower=racer({speedMps:0});e.playtestSession.aiRuntime=[leader,follower];
 assert.equal(planRaceAiDriving(e,follower,car).targetSpeedMps,0);
});

test('speed and lightweight traffic advice alternate after initialization and surface work can defer speed safely',()=>{
 const e=road(),ai=racer({physicsBudgetDetail:'cheap'});e.playtestSession.aiRuntime=[ai];
 const options={seconds:1/60,scheduleIndex:0};
 planRaceAiDriving(e,ai,car,options);
 let overlaps=0,lastSpeed=0,lastTraffic=0,maxSpeedGap=0,maxTrafficGap=0;
 for(let i=1;i<=600;i++){
  const speed=ai.speedPlanUpdates,traffic=ai.trafficPlanUpdates;
  planRaceAiDriving(e,ai,car,{...options,surfacePlanRefreshed:i%15===0});
  if(ai.speedPlanUpdates>speed){maxSpeedGap=Math.max(maxSpeedGap,(i-lastSpeed)/60);lastSpeed=i;}
  if(ai.trafficPlanUpdates>traffic){maxTrafficGap=Math.max(maxTrafficGap,(i-lastTraffic)/60);lastTraffic=i;}
  if(ai.speedPlanUpdates>speed&&ai.trafficPlanUpdates>traffic)overlaps++;
 }
 assert.equal(overlaps,0);assert.ok(maxSpeedGap<=.32);assert.ok(maxTrafficGap<=.22);
 // Even constant competing surface work cannot starve speed/traffic forever.
 const before=ai.speedPlanUpdates;
 for(let i=0;i<60;i++)planRaceAiDriving(e,ai,car,{...options,surfacePlanRefreshed:true});
 assert.ok(ai.speedPlanUpdates>=before+3);
 // Sudden loss of grip bypasses deferral and refreshes both plans.
 const rev=ai.speedPlanUpdates;planRaceAiDriving(e,ai,car,{...options,grip:.2,surfacePlanRefreshed:true});
 assert.equal(ai.speedPlanUpdates,rev+1);
});
