import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DRIVETRAINS,
  RACE_TIRE_COMPOUNDS,
  RACE_COMPETITION_MODES,
  RACE_TIME_OF_DAY,
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
  assert.equal(project.cars[0].defaultTransmissionType, 'manual');
  assert.equal(project.cars[0].transmissions.manual.shiftMode, 'manual');
  assert.equal(project.cars[0].transmissions.automatic.shiftMode, 'automatic');
  assert.equal(project.cars[0].audio.engineSoundId, null);
  assert.equal(project.cars[0].audio.engineProfile, 'wrx-flat-four-manual');
  assert.deepEqual(project.cars[0].setup.tireCompoundByWheel, { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' });
  assert.equal(RACE_TIRE_COMPOUNDS.some((compound) => compound.id === 'rain'), true);
  assert.equal(RACE_TIRE_COMPOUNDS.some((compound) => compound.id === 'snow'), true);
  assert.equal(project.cars[1].name, '2022 Subaru BRZ');
  assert.equal(project.cars[1].tuning.drivetrain, 'rwd');
  assert.equal(project.cars[1].tuning.powerHp, 228);
  assert.equal(project.cars[1].tuning.torqueLbFt, 184);
  assert.equal(project.cars[1].transmissions.automatic.label, '6AT');
  assert.equal(project.cars[2].name, '2022 Honda Civic Si');
  assert.equal(project.cars[2].tuning.drivetrain, 'fwd');
  assert.equal(project.cars[2].tuning.powerHp, 200);
  assert.equal(project.cars[2].tuning.torqueLbFt, 192);
  assert.equal(project.cars[2].transmissions.automatic.label, 'CVT');
  assert.equal(getSurfaceById('snow').grip < getSurfaceById('asphalt').grip, true);
});

test('race data scaffold supports playtest scenarios, hazards, AI, and co-driver calls', () => {
  const race = createDefaultRace();

  assert.equal(RACE_COMPETITION_MODES.includes(race.competition.mode), true);
  assert.equal(Array.isArray(race.competition.aiDrivers), true);
  assert.equal(race.competition.aiDrivers[0].carId, 'starter-rwd');
  assert.equal(race.hazards.some((hazard) => hazard.type === 'zombie-pack'), true);
  assert.equal(race.hazards.some((hazard) => hazard.type === 'jump'), true);
  assert.equal(race.hazards.some((hazard) => hazard.type === 'damage-wall'), true);
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
  assert.equal(byId['daytona-tri-oval'].road.width, 24);
  assert.equal(byId['daytona-tri-oval'].road.segments.some((segment) => segment.banking === 31), true);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.sourceLengthMi, 2.5);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.bankingDegrees.turns, 31);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.bankingDegrees.triOval, 18);
  assert.equal(byId['daytona-tri-oval'].referenceFacts.bankingDegrees.backstretch, 3);
});

test('createTestTrackRace aliases WeatherTech by Laguna Seca name', () => {
  assert.equal(createTestTrackRace('laguna-seca').id, 'weathertech-raceway');
  assert.equal(createTestTrackRace('nordschleife').id, 'nurburgring-nordschleife');
  assert.equal(createTestTrackRace('nurburgring').id, 'nurburgring-nordschleife');
  assert.equal(createTestTrackRace('daytona').id, 'daytona-tri-oval');
});
