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
  getSurfaceById
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
  assert.equal(race.finishBehavior.type, 'return-to-origin');
  assert.equal(RACE_TIME_OF_DAY.includes(race.timeOfDay), true);
  assert.equal(DRIVETRAINS.includes(car.tuning.drivetrain), true);
  assert.equal(project.cars[0].name, '2022 Subaru WRX');
  assert.equal(project.cars[0].tuning.drivetrain, 'awd');
  assert.equal(project.cars[0].tuning.powerHp, 271);
  assert.equal(project.cars[0].tuning.torqueLbFt, 258);
  assert.equal(project.cars[0].defaultTransmissionType, 'automatic');
  assert.equal(project.cars[0].transmissions.manual.shiftMode, 'manual');
  assert.equal(project.cars[0].transmissions.automatic.shiftMode, 'automatic');
  assert.equal(project.cars[0].audio.engineSoundId, null);
  assert.equal(project.cars[0].audio.engineProfile, 'wrx-flat-four-cvt');
  assert.deepEqual(project.cars[0].setup.tireCompoundByWheel, { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' });
  assert.equal(RACE_TIRE_COMPOUNDS.some((compound) => compound.id === 'rain'), true);
  assert.equal(RACE_TIRE_COMPOUNDS.some((compound) => compound.id === 'snow'), true);
  assert.equal(project.cars[1].name, '2022 Subaru BRZ');
  assert.equal(project.cars[1].tuning.drivetrain, 'rwd');
  assert.equal(project.cars[1].tuning.powerHp, 228);
  assert.equal(project.cars[1].tuning.torqueLbFt, 184);
  assert.equal(project.cars[1].transmissions.automatic.label, '6AT');
  assert.equal(project.cars[2].name, '2023 Honda Civic Type R');
  assert.equal(project.cars[2].tuning.drivetrain, 'fwd');
  assert.equal(project.cars[2].tuning.powerHp, 315);
  assert.equal(project.cars[2].tuning.torqueLbFt, 310);
  assert.equal(project.cars[2].transmissions.automatic.label, 'Auto Assist');
  assert.equal(getSurfaceById('snow').grip < getSurfaceById('asphalt').grip, true);
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

test('built-in test races model requested real-world track references', () => {
  const races = createBuiltInTestRaces();
  const byId = Object.fromEntries(races.map((race) => [race.id, race]));

  assert.deepEqual(races.map((race) => race.id), [
    'weathertech-raceway',
    'nurburgring-nordschleife',
    'col-de-turini',
    'ouninpohja',
    'daytona-tri-oval'
  ]);

  assert.equal(byId['weathertech-raceway'].type, 'circuit');
  assert.equal(Math.abs(routeLength(byId['weathertech-raceway']) - 3602) < 8, true);
  assert.equal(byId['weathertech-raceway'].road.segments.every((segment) => segment.surface === 'asphalt'), true);
  assert.equal(byId['weathertech-raceway'].hazards.some((hazard) => hazard.id === 'laguna-corkscrew-drop'), true);
  assert.equal(byId['weathertech-raceway'].referenceFacts.sourceLengthKm, 3.602);
  assert.equal(byId['weathertech-raceway'].referenceFacts.turns, 11);
  assert.equal(byId['weathertech-raceway'].referenceFacts.roadWidthM, 10);
  assert.equal(byId['weathertech-raceway'].referenceFacts.signatureSections.includes('Corkscrew'), true);

  assert.equal(byId['nurburgring-nordschleife'].type, 'circuit');
  assert.equal(Math.abs(routeLength(byId['nurburgring-nordschleife']) - 20832) < 24, true);
  assert.equal(byId['nurburgring-nordschleife'].road.segments.some((segment) => segment.codriver === 'nurb-karussell'), true);
  assert.equal(byId['nurburgring-nordschleife'].referenceFacts.referenceBasis.includes('Nordschleife'), true);
  assert.equal(byId['nurburgring-nordschleife'].referenceFacts.sourceLengthKm, 20.832);
  assert.equal(byId['nurburgring-nordschleife'].referenceFacts.elevationChangeM, 300);
  assert.equal(byId['nurburgring-nordschleife'].referenceFacts.signatureSections.includes('Karussell'), true);

  assert.equal(byId['col-de-turini'].type, 'destination');
  assert.equal(Math.abs(routeLength(byId['col-de-turini']) - 31500) < 35, true);
  assert.equal(byId['col-de-turini'].weather, 'snow');
  assert.equal(byId['col-de-turini'].road.segments.some((segment) => segment.surface === 'asphalt'), true);
  assert.equal(byId['col-de-turini'].road.segments.some((segment) => segment.surface === 'snow'), true);
  assert.equal(Math.max(...byId['col-de-turini'].road.nodes.map((node) => node.elevation)) >= 0.42, true);
  assert.deepEqual(byId['col-de-turini'].referenceFacts.surfaceSequence, ['asphalt', 'wet-asphalt', 'snow', 'wet-asphalt', 'asphalt']);
  assert.equal(byId['col-de-turini'].referenceFacts.passElevationM, 1607);
  assert.equal(byId['col-de-turini'].referenceFacts.roadWidthM, 6);

  assert.equal(byId.ouninpohja.type, 'destination');
  assert.equal(Math.abs(routeLength(byId.ouninpohja) - 33000) < 36, true);
  assert.equal(byId.ouninpohja.road.segments.every((segment) => segment.surface === 'gravel'), true);
  assert.equal(byId.ouninpohja.hazards.filter((hazard) => hazard.type === 'jump').length >= 3, true);
  assert.equal(byId.ouninpohja.referenceFacts.surface, 'gravel');
  assert.deepEqual(byId.ouninpohja.referenceFacts.elevationRangeM, [97, 180]);
  assert.equal(byId.ouninpohja.referenceFacts.roadWidthM, 6);
  assert.equal(byId.ouninpohja.referenceFacts.signatureSections.includes('Yellow House Jump'), true);

  assert.equal(byId['daytona-tri-oval'].type, 'circuit');
  assert.equal(Math.abs(routeLength(byId['daytona-tri-oval']) - 4023) < 8, true);
  assert.equal(byId['daytona-tri-oval'].road.width, 14.4);
  assert.equal(byId['daytona-tri-oval'].road.segments.some((segment) => segment.banking === 31), true);
  assert.equal(byId['daytona-tri-oval'].renderSurfaceStepM, 10);
  assert.deepEqual(byId['daytona-tri-oval'].scenery, []);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.sourceLengthMi, 2.5);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.bankingDegrees.turns, 31);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.bankingDegrees.triOval, 18);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.bankingDegrees.backstretch, 3);
});

test('WRX race car tuning exposes Daytona high speed calibration', () => {
  const wrx = createDefaultCar('starter-rwd');

  assert.equal(wrx.tuning.topSpeedMph, 161);
  assert.equal(wrx.tuning.dragCoefficient <= 0.08, true);
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
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].quarterMileSec, [13.5, 14.3]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['starter-rwd'].topSpeedMph, [158, 162]);

  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].zeroToSixtySec, [5.3, 6.8]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].quarterMileSec, [13.8, 15.2]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['subaru-brz-2022'].topSpeedMph, [136, 145]);

  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].zeroToSixtySec, [4.5, 5.4]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].quarterMileSec, [13.2, 13.9]);
  assert.deepEqual(RACE_STOCK_PERFORMANCE_TARGETS['honda-civic-type-r-2023'].topSpeedMph, [165, 171]);
});

test('built-in test races use Studio Sprint graphic settings by default', () => {
  const races = [createDefaultRace(), ...createBuiltInTestRaces()];
  races.forEach((race) => {
    assert.equal(race.groundRenderer, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundRenderer);
    assert.equal(race.groundTextureBaseWorldM, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundTextureBaseWorldM);
    assert.equal(race.groundTextureFilterMode, STUDIO_SPRINT_GRAPHIC_SETTINGS.groundTextureFilterMode);
    assert.equal(race.skyboxArtRef, STUDIO_SPRINT_GRAPHIC_SETTINGS.skyboxArtRef);
    assert.equal(race.surfaceArt.boundary, STUDIO_SPRINT_GRAPHIC_SETTINGS.surfaceArt.boundary);
    assert.equal(race.margin.marginMode, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.marginMode);
    assert.equal(race.margin.shoulderMode, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.shoulderMode);
    assert.equal(race.margin.collisionEdge, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.collisionEdge);
    assert.equal(race.margin.collisionEffect, STUDIO_SPRINT_GRAPHIC_SETTINGS.margin.collisionEffect);
    assert.equal(race.renderDebug.terrainEnabled, true);
    assert.equal(race.renderDebug.texturesEnabled, true);
    assert.equal(race.renderDebug.detailEnabled, false);
    if (race.id === 'daytona-tri-oval') {
      assert.equal(race.renderSurfaceStepM, 10);
    }
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
    assert.equal(payload.race.skyboxArtRef, STUDIO_SPRINT_GRAPHIC_SETTINGS.skyboxArtRef);
    assert.equal(payload.race.renderDebug.terrainEnabled, true);
    assert.equal(payload.race.renderDebug.detailEnabled, false);
    if (name === 'Daytona Tri-Oval') {
      assert.equal(payload.race.renderSurfaceStepM, 10);
    }
  });
});

test('createTestTrackRace aliases WeatherTech by Laguna Seca name', () => {
  assert.equal(createTestTrackRace('laguna-seca').id, 'weathertech-raceway');
  assert.equal(createTestTrackRace('nordschleife').id, 'nurburgring-nordschleife');
  assert.equal(createTestTrackRace('nurburgring').id, 'nurburgring-nordschleife');
  assert.equal(createTestTrackRace('daytona').id, 'daytona-tri-oval');
});
