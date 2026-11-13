import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

import {
  DRIVETRAINS,
  RACE_STOCK_PERFORMANCE_TARGETS,
  RACE_TIRE_COMPOUNDS,
  RACE_COMPETITION_MODES,
  RACE_TIME_OF_DAY,
  STUDIO_SPRINT_GRAPHIC_SETTINGS,
  createBuiltInRaceCars,
  createBuiltInTestRaces,
  createDefaultCar,
  createDefaultRace,
  createDefaultRaceProject,
  createTestTrackRace,
  getSurfaceById,
  normalizeRaceFinishBehavior
} from '../../src/racing/raceData.js';

function routeLength(race) {
  const nodes = race.road.nodes || [];
  let length = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    length += Math.hypot(
      Number(nodes[index].x || 0) - Number(nodes[index - 1].x || 0),
      Number(nodes[index].y || 0) - Number(nodes[index - 1].y || 0)
    );
  }
  return length;
}

test('race data scaffold supports default races, cars, and surfaces', () => {
  const project = createDefaultRaceProject();
  const race = createDefaultRace();
  const car = createDefaultCar();

  assert.equal(project.races.length, 6);
  assert.equal(project.cars.length, 3);
  assert.deepEqual(createBuiltInRaceCars().map((entry) => entry.id), [
    'starter-rwd',
    'subaru-brz-2022',
    'honda-civic-type-r-2023'
  ]);
  assert.deepEqual(project.races.map((entry) => entry.id), [
    'test-loop',
    'weathertech-raceway',
    'nurburgring-nordschleife',
    'col-de-turini',
    'ouninpohja',
    'daytona-tri-oval'
  ]);
  assert.equal(race.road.segments.length > 0, true);
  assert.deepEqual(race.road.nodes, [{ x: 0, y: 0, elevation: 0, role: 'start', locked: true }]);
  assert.deepEqual(project.races[0].road.nodes, [{ x: 0, y: 0, elevation: 0, role: 'start', locked: true }]);
  assert.equal(race.finishBehavior.type, 'menu');
  assert.equal(race.finishBehavior.menuScreen, 'world-map');
  assert.equal(RACE_TIME_OF_DAY.includes(race.timeOfDay), true);
  assert.equal(DRIVETRAINS.includes(car.tuning.drivetrain), true);
  assert.equal(project.cars[0].name, 'AWD');
  assert.ok(project.cars.every(car => car.__systemPreset === true));
  assert.equal(project.cars[0].tuning.drivetrain, 'awd');
  assert.equal(project.cars[0].tuning.powerHp, 271);
  assert.equal(project.cars[0].tuning.torqueLbFt, 258);
  assert.equal(project.cars[0].defaultTransmissionType, 'automatic');
  assert.equal(project.cars[0].transmissions.manual.shiftMode, 'manual');
  assert.equal(project.cars[0].transmissions.automatic.shiftMode, 'automatic');
  assert.equal(project.cars[0].audio.engineSoundId, null);
  assert.equal(project.cars[0].audio.engineProfile, 'wrx-flat-four-cvt');
  assert.equal(project.cars[0].camera.trackingMode, 'dynamic');
  assert.equal(project.cars[0].art.interior.dashboard.artRef, null);
  assert.equal(project.cars[0].art.interior.steeringWheel.artRef, null);
  assert.deepEqual(project.cars[0].setup.tireCompoundByWheel, { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' });
  assert.equal(RACE_TIRE_COMPOUNDS.some((compound) => compound.id === 'rain'), true);
  assert.equal(RACE_TIRE_COMPOUNDS.some((compound) => compound.id === 'snow'), true);
  assert.equal(project.cars[1].name, 'RWD');
  assert.equal(project.cars[1].tuning.drivetrain, 'rwd');
  assert.equal(project.cars[1].tuning.powerHp, 228);
  assert.equal(project.cars[1].tuning.torqueLbFt, 184);
  assert.equal(project.cars[1].transmissions.automatic.label, '6AT');
  assert.equal(project.cars[2].name, 'FWD');
  assert.equal(project.cars[2].tuning.drivetrain, 'fwd');
  assert.equal(project.cars[2].tuning.powerHp, 315);
  assert.equal(project.cars[2].tuning.torqueLbFt, 310);
  assert.equal(project.cars[2].transmissions.automatic.label, 'Auto Assist');
  assert.equal(getSurfaceById('snow').grip < getSurfaceById('asphalt').grip, true);
});

test('race finish behavior normalizes legacy and linked destinations', () => {
  assert.deepEqual(normalizeRaceFinishBehavior(), {
    type: 'return-to-origin',
    targetLevel: null,
    targetRace: null,
    spawnX: null,
    spawnY: null
  });
  assert.deepEqual(normalizeRaceFinishBehavior({
    type: 'level',
    targetLevel: 'Hub',
    targetRace: 'ignored',
    spawnX: 12.9,
    spawnY: 7.2
  }), {
    type: 'level',
    targetLevel: 'Hub',
    targetRace: null,
    spawnX: 12,
    spawnY: 7
  });
  assert.deepEqual(normalizeRaceFinishBehavior({
    type: 'race',
    targetRace: 'Final Run',
    targetLevel: 'ignored',
    spawnX: 4,
    spawnY: 5
  }), {
    type: 'race',
    targetLevel: null,
    targetRace: 'Final Run',
    spawnX: null,
    spawnY: null
  });
});

test('race data scaffold supports playtest scenarios, hazardless Studio Sprint, AI, and co-driver calls', () => {
  const race = createDefaultRace();

  assert.equal(RACE_COMPETITION_MODES.includes(race.competition.mode), true);
  assert.equal(Array.isArray(race.competition.aiDrivers), true);
  assert.equal(race.competition.aiDrivers[0].carId, 'starter-rwd');
  assert.deepEqual(race.hazards, []);
  assert.equal(race.road.segments.every((segment) => !Array.isArray(segment.hazardIds) || segment.hazardIds.length === 0), true);
  assert.equal(race.codriver.enabled, true);
  assert.equal(race.codriver.calls.length > 0, true);
  assert.equal(race.road.segments.some((segment) => segment.codriver), true);
});

test('built-in real tracks use dense sourced geometry instead of scaled sketches', () => {
 const races=createBuiltInTestRaces();
 assert.deepEqual(races.map(r=>r.id),['weathertech-raceway','nurburgring-nordschleife','col-de-turini','ouninpohja','daytona-tri-oval']);
 for(const r of races){
  assert.match(r.source.provider,/OpenStreetMap/);assert.ok(r.source.osmWayIds.length>0);
  assert.ok(r.road.nodes.length>60,r.name);assert.ok(Object.keys(r.road.tileMap.cells).length>0);
  assert.ok(r.road.nodes.every(n=>Number.isFinite(n.elevation)));assert.equal(r.road.autoExtend,false);
  const tolerance=r.type==='circuit'?30:150;
  assert.ok(Math.abs(routeLength(r)-r.source.mappedLengthM)<tolerance,r.name);
  assert.equal(r.hazards.length,0,'No invented drop/jump obstacles from the old sketches');
 }
 const daytona=races.find(r=>r.id==='daytona-tri-oval');
 assert.ok(daytona.road.segments.some(s=>s.banking===31));
 const ouni=races.find(r=>r.id==='ouninpohja');assert.ok(ouni.road.segments.filter(s=>s.surface==='gravel').length/ouni.road.segments.length>.99,'Mapped gravel road with an unspecified-surface bridge');
 const again=createBuiltInTestRaces();races[0].road.nodes[0].x=999999;
 assert.notEqual(again[0].road.nodes[0].x,999999,'Templates must be independent editable copies');
});

test('WRX race car tuning exposes real-world top speed calibration', () => {
  const wrx = createDefaultCar('starter-rwd');

  assert.equal(wrx.tuning.topSpeedMph, 145);
  assert.equal(wrx.tuning.dragCoefficient, 0.34);
  assert.equal(wrx.tuning.accelerationCalibration >= 1.06, true);
});

test('built-in race cars expose real-world power, torque, drivetrain, and gear counts', () => {
  const cars = Object.fromEntries(createBuiltInRaceCars().map((car) => [car.id, car]));

  assert.equal(cars['starter-rwd'].tuning.powerHp, 271);
  assert.equal(cars['starter-rwd'].tuning.torqueLbFt, 258);
  assert.equal(cars['starter-rwd'].tuning.drivetrain, 'awd');
  assert.equal(cars['starter-rwd'].transmissions.manual.gearRatios.length, 6);
  assert.equal(cars['starter-rwd'].transmissions.automatic.gearRatios.length, 8);
  assert.deepEqual(cars['starter-rwd'].transmissions.manual.gearRatios, [3.454, 1.947, 1.366, 0.972, 0.738, 0.666]);
  assert.deepEqual(cars['starter-rwd'].transmissions.automatic.gearRatios, [3.49, 2.19, 1.55, 1.18, 0.92, 0.74, 0.58, 0.47]);
  assert.equal(cars['starter-rwd'].transmissions.manual.gearFinalDrive, 4.11);

  assert.equal(cars['subaru-brz-2022'].tuning.powerHp, 228);
  assert.equal(cars['subaru-brz-2022'].tuning.torqueLbFt, 184);
  assert.equal(cars['subaru-brz-2022'].tuning.drivetrain, 'rwd');
  assert.equal(cars['subaru-brz-2022'].transmissions.manual.gearRatios.length, 6);
  assert.equal(cars['subaru-brz-2022'].transmissions.automatic.gearRatios.length, 6);
  assert.deepEqual(cars['subaru-brz-2022'].transmissions.manual.gearRatios, [3.626, 2.188, 1.541, 1.213, 1.0, 0.767]);
  assert.deepEqual(cars['subaru-brz-2022'].transmissions.automatic.gearRatios, [3.538, 2.06, 1.404, 1.0, 0.713, 0.582]);
  assert.equal(cars['subaru-brz-2022'].transmissions.manual.gearFinalDrive, 4.10);
  assert.equal(cars['subaru-brz-2022'].transmissions.automatic.gearFinalDrive, 3.909);

  assert.equal(cars['honda-civic-type-r-2023'].tuning.powerHp, 315);
  assert.equal(cars['honda-civic-type-r-2023'].tuning.torqueLbFt, 310);
  assert.equal(cars['honda-civic-type-r-2023'].tuning.drivetrain, 'fwd');
  assert.equal(cars['honda-civic-type-r-2023'].transmissions.manual.gearRatios.length, 6);
  assert.deepEqual(cars['honda-civic-type-r-2023'].transmissions.manual.gearRatios, [3.625, 2.115, 1.529, 1.125, 0.911, 0.734]);
  assert.equal(cars['honda-civic-type-r-2023'].transmissions.manual.gearFinalDrive, 3.84);
});

test('built-in race car performance target bands match calibrated playtest ranges', () => {
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].zeroToSixtySec, [4.8, 5.6]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].zeroToSixtySecByTransmission.automatic, [5.6, 6.35]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].quarterMileSec, [13.5, 14.3]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].quarterMileSecByTransmission.automatic, [14.4, 15.2]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].quarterMileTrapMphByTransmission.automatic, [90, 96]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].topSpeedMph, [143, 146]);

  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].zeroToSixtySec, [5.3, 6.8]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].quarterMileSec, [13.8, 15.2]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].topSpeedMph, [136, 145]);

  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].zeroToSixtySec, [4.5, 5.4]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].quarterMileSec, [13.2, 13.9]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].topSpeedMph, [165, 171]);
});

test('built-in races retain renderer defaults and imported skybox/margin settings', () => {
  const races = [createDefaultRace(), ...createBuiltInTestRaces()];
  races.forEach((race) => {
    assert.equal(race.groundRenderer, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundRenderer);
    assert.equal(race.groundTextureBaseWorldM, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundTextureBaseWorldM);
    assert.equal(race.groundTextureFilterMode, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundTextureFilterMode);
    assert.ok(race.skyboxArtRef);
    assert.equal(race.surfaceArt.boundary, STUDIO_SPRINT_GRAPHIC_SETTINGS.surfaceArt.boundary);
    assert.equal(race.margin.marginMode, race.source?'hidden':STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.marginMode);
    assert.equal(race.margin.shoulderMode, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.shoulderMode);
    assert.equal(race.margin.collisionEdge, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.collisionEdge);
    assert.equal(race.margin.collisionEffect, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.collisionEffect);
    assert.equal(race.renderDebug.terrainEnabled, true);
    assert.equal(race.renderDebug.texturesEnabled, true);
    assert.equal(race.renderDebug.detailEnabled, false);

  });
});

test('built-in test races are seeded as editable storage race files', () => {
  const storageNames = [
    'WeatherTech Raceway Laguna Seca',
    'Nurburgring Nordschleife',
    'Col de Turini',
    'Ouninpohja',
    'Daytona Tri-Oval'
  ];

  storageNames.forEach((name) => {
    const raw = JSON.parse(fs.readFileSync(`data/server-storage/files/races/${name}/document.json`, 'utf8'));
    const payload = raw.__chainsawStorage
      ? JSON.parse(zlib.gunzipSync(Buffer.from(raw.data, 'base64')).toString('utf8'))
      : raw;
    assert.equal(payload.kind, 'race-track');
    assert.equal(payload.race.name, name);
    assert.equal(payload.race.groundRenderer, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundRenderer);
    assert.ok(payload.race.skyboxArtRef);
    assert.ok(payload.race.roadTextures.road.artRef);
    assert.match(payload.race.source.provider,/OpenStreetMap/);
    assert.ok(payload.race.road.nodes.length>60);
  });
});

test('createTestTrackRace aliases WeatherTech by Laguna Seca name', () => {
  assert.equal(createTestTrackRace('laguna-seca').id, 'weathertech-raceway');
  assert.equal(createTestTrackRace('nordschleife').id, 'nurburgring-nordschleife');
  assert.equal(createTestTrackRace('nurburgring').id, 'nurburgring-nordschleife');
  assert.equal(createTestTrackRace('daytona').id, 'daytona-tri-oval');
});
