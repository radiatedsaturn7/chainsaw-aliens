import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createAirslayerDocument} from '../../tools/vehicle-validation/create-airslayer.mjs';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('saved Airslayer survives editor round trip with its own engine, chassis and both six-speed transmissions', () => {
  const document = createAirslayerDocument();
  const editor = new RaceEditor({});
  const saved = JSON.parse(fs.readFileSync('data/server-storage/files/cars/STI Airslayer/document.json'));
  const car = editor.normalizeLoadedCarDocument(saved);
  assert.deepEqual(car.tuning, editor.normalizeLoadedCarDocument(document).tuning);
  assert.equal(car.name, 'STI Airslayer');
  assert.equal(car.setup.tireSize.wheelDiameterIn, 19);
  const source = editor.normalizeLoadedCarDocument(JSON.parse(fs.readFileSync('data/server-storage/files/cars/RTG-001/document.json')));
  for (const angle of Object.keys(source.art.angleLayers)) {
    assert.equal(car.art.angleLayers[angle].body.artRef, 'catalog-sti-airslayer-body');
    assert.notEqual(car.art.angleLayers[angle].body.artRef, source.art.angleLayers[angle].body.artRef);
  }
  assert.deepEqual(car.art.smoke, source.art.smoke);
  for (const transmissionType of ['manual', 'automatic']) {
    const tuning = editor.getRaceCarTuning(car, {transmissionType});
    assert.equal(tuning.powerHp, 862);
    assert.equal(tuning.torqueLbFt, 664);
    assert.equal(tuning.weightKg, 1190);
    assert.equal(tuning.drivetrain, 'awd');
    assert.deepEqual(tuning.gearRatios, [2.8, 2.1, 1.65, 1.35, 1.12, .95]);
    assert.equal(tuning.finalDrive, 4);
    assert.ok(tuning.engineCurve.torquePoints.length >= 6);
    const config = createVehicleDynamicsConfigFromTuning(tuning);
    assert.equal(config.massKg, 1190);
    assert.ok(Number.isFinite(config.wheelRadiusM));
    const gearedMph = tuning.revLimitRpm / 60 / tuning.finalDrive / tuning.gearRatios.at(-1) * config.wheelRadiusM * 2 * Math.PI * 2.236936;
    assert.ok(gearedMph > 130);
  }
});
