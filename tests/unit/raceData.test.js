import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DRIVETRAINS,
  RACE_COMPETITION_MODES,
  RACE_TIME_OF_DAY,
  createDefaultCar,
  createDefaultRace,
  createDefaultRaceProject,
  getSurfaceById
} from '../../src/racing/raceData.js';

test('race data scaffold supports default races, cars, and surfaces', () => {
  const project = createDefaultRaceProject();
  const race = createDefaultRace();
  const car = createDefaultCar();

  assert.equal(project.races.length, 1);
  assert.equal(project.cars.length, 2);
  assert.equal(race.road.segments.length > 0, true);
  assert.equal(race.finishBehavior.type, 'return-to-origin');
  assert.equal(RACE_TIME_OF_DAY.includes(race.timeOfDay), true);
  assert.equal(DRIVETRAINS.includes(car.tuning.drivetrain), true);
  assert.equal(project.cars[0].name, '2022 Subaru WRX 6MT');
  assert.equal(project.cars[0].tuning.drivetrain, 'awd');
  assert.equal(project.cars[0].tuning.powerHp, 271);
  assert.equal(project.cars[0].tuning.torqueLbFt, 258);
  assert.equal(project.cars[0].tuning.shiftMode, 'manual');
  assert.equal(project.cars[1].name, '2022 Subaru WRX SPT');
  assert.equal(project.cars[1].tuning.shiftMode, 'automatic');
  assert.equal(project.cars[1].tuning.topSpeedMph, 135);
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
