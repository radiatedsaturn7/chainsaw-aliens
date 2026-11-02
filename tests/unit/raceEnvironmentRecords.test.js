import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RACE_MATERIAL_OVERLAY_KEYS,
  RACE_TIRE_OVERLAY_KEYS,
  updateRaceEnvironmentRecord
} from '../../src/racing/RaceEnvironmentRecords.js';
import { createTrackStateCell } from '../../src/racing/trackState/TrackStateCell.js';
import { VehicleDynamicsRunner } from '../../src/racing/simulation/VehicleDynamicsRunner.js';

const WHEELS = ['fl', 'fr', 'rl', 'rr'];
function replaceRecord(target, source) {
  for (const key in target) delete target[key];
  if (source) for (const key in source) target[key] = source[key];
  return target;
}
function materialOverlay(record, index) {
  Object.assign(record, {
    baseSurfaceId: index % 2 ? 'asphalt' : 'dirt',
    surfaceId: index % 2 ? 'wet-asphalt' : 'dirt',
    effectiveGrip: 0.7 + index / 1000,
    effectiveGripMultiplier: 0.8,
    surfaceGripScale: 0.75,
    grip: 0.7 + index / 1000,
    trackStateConditionApplied: index % 4 !== 0
  });
}
function tireOverlay(record, index) {
  Object.assign(record, {
    temperatureF: 70 + index, treadTemperatureC: 20 + index / 2,
    carcassTemperatureC: undefined, internalAirTemperatureC: 20,
    effectivePressurePsi: 32 + index / 100, pressurePsi: 32 + index / 100,
    wear: index / 1000, damage: index % 10, rollingResistanceCoefficient: 0.012
  });
}

test('stable material records preserve field presence, custom adapters and live values', () => {
  const actual = {}, expected = {};
  const cell = createTrackStateCell();
  for (let index = 0; index < 200; index += 1) {
    cell.standingWaterDepthMm = index / 100;
    cell.baseGrip = 0.7 + index / 1000;
    cell.normal = { x: 0, y: 1, z: index / 100 };
    if (index % 3 === 0) cell.customValue = undefined;
    else delete cell.customValue;
    if (index === 30) Object.defineProperty(cell, 'hidden', {
      value: 7, enumerable: false, configurable: true
    });
    let source = index % 4 ? cell : null;
    if (index % 17 === 0) source = Object.assign(
      Object.create({ inheritedMaterial: index }), { dirt: 0.5 }
    );
    if (index % 19 === 0) source = Object.assign(Object.create(null), {
      dirt: 0.9, roughness: 0.2
    });
    assert.equal(updateRaceEnvironmentRecord(actual, source, RACE_MATERIAL_OVERLAY_KEYS), actual);
    replaceRecord(expected, source);
    materialOverlay(actual, index);
    materialOverlay(expected, index);
    assert.deepEqual(actual, expected);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    assert.equal(Object.hasOwn(actual, 'customValue'), Object.hasOwn(expected, 'customValue'));
    assert.equal(Object.hasOwn(actual, 'hidden'), false);
    if (source?.normal) assert.equal(actual.normal, source.normal, 'the copy stays shallow');
  }
});

test('tire and brake updates remove stale custom fields without changing explicit undefined', () => {
  const tire = {}, expectedTire = {}, brakes = {}, expectedBrakes = {};
  for (const source of [
    { widthMm: 225, pressurePsi: 32, customCompound: 'soft', optional: undefined },
    { widthMm: 245, pressurePsi: 34, optional: undefined },
    Object.assign(Object.create({ inheritedCompound: 'rain' }), { widthMm: 205 }),
    Object.create(null), null
  ]) {
    updateRaceEnvironmentRecord(tire, source, RACE_TIRE_OVERLAY_KEYS);
    replaceRecord(expectedTire, source);
    tireOverlay(tire, 12);
    tireOverlay(expectedTire, 12);
    assert.deepEqual(tire, expectedTire);
    assert.deepEqual(Object.keys(tire).sort(), Object.keys(expectedTire).sort());
  }
  for (const source of [{ fl: 12, rr: 3, custom: undefined }, { fl: 0 }, {}, null]) {
    updateRaceEnvironmentRecord(brakes, source);
    replaceRecord(expectedBrakes, source);
    assert.deepEqual(brakes, expectedBrakes);
    assert.deepEqual(Object.keys(brakes), Object.keys(expectedBrakes));
  }
});

test('canonical steady-state updates perform no property deletion and keep other owned slots untouched', () => {
  let deletes = 0;
  const target = new Proxy({}, {
    deleteProperty(object, key) { deletes += 1; return Reflect.deleteProperty(object, key); }
  });
  const cell = createTrackStateCell();
  updateRaceEnvironmentRecord(target, cell, RACE_MATERIAL_OVERLAY_KEYS);
  materialOverlay(target, 0);
  const otherSlots = Array.from({ length: 7 }, () => structuredClone({ ...target }));
  const before = structuredClone(otherSlots);
  for (let index = 1; index <= 120; index += 1) {
    cell.standingWaterDepthMm = index / 100;
    cell.lastUpdatedStep = index;
    updateRaceEnvironmentRecord(target, cell, RACE_MATERIAL_OVERLAY_KEYS);
    materialOverlay(target, index);
  }
  assert.equal(deletes, 0, 'normal updates retain the same material property slots');
  assert.equal(target.standingWaterDepthMm, 1.2);
  assert.deepEqual(otherSlots, before, 'updating a slot creates no cross-slot alias');
  updateRaceEnvironmentRecord(target, null, RACE_MATERIAL_OVERLAY_KEYS);
  materialOverlay(target, 0);
  assert.ok(deletes > 0, 'a real schema transition removes source-owned fields');
  assert.equal('standingWaterDepthMm' in target, false, 'absent is not replaced by undefined');
});

test('stable records match replacement through eight-slot reuse in real tire/vehicle integration', () => {
  function make(update) {
    const slots = Array.from({ length: 8 }, () => ({
      surfaceHeightByWheel: { fl: 0, fr: 0, rl: 0, rr: 0 },
      materialByWheel: Object.fromEntries(WHEELS.map(id => [id, {}])),
      tireByWheel: Object.fromEntries(WHEELS.map(id => [id, {}])),
      damage: { engine: 0, transmission: 0, brakes: {} }
    }));
    const cells = WHEELS.map((_id, index) => createTrackStateCell({ x: index }));
    let cursor = 0;
    const runner = new VehicleDynamicsRunner({
      config: { physicsQualityProfile: 'realtime', telemetryRetention: 'none' },
      initialState: { heightM: 0.55, speedMps: 8 },
      environmentProvider: ({ stepIndex }) => {
        const slot = slots[cursor++ % slots.length];
        WHEELS.forEach((id, index) => {
          const cell = cells[index];
          cell.standingWaterDepthMm = stepIndex % 30 / 15;
          cell.surfaceTemperatureC = 21 + stepIndex / 120;
          if (stepIndex % 7 === 0) cell.custom = index;
          else delete cell.custom;
          update(slot.materialByWheel[id], stepIndex % 9 ? cell : null, RACE_MATERIAL_OVERLAY_KEYS);
          materialOverlay(slot.materialByWheel[id], stepIndex);
          update(slot.tireByWheel[id], {
            widthMm: 225 + index * 10, pressurePsi: 32, custom: stepIndex % 3
          }, RACE_TIRE_OVERLAY_KEYS);
          tireOverlay(slot.tireByWheel[id], stepIndex);
        });
        update(slot.damage.brakes, stepIndex % 11 ? { fl: stepIndex % 10, rr: 2 } : {});
        return slot;
      }
    });
    return { runner, slots };
  }
  const stable = make(updateRaceEnvironmentRecord);
  const baseline = make(replaceRecord);
  for (let step = 0; step < 180; step += 1) {
    const input = { throttle: step < 120 ? 0.2 : 0, brake: step < 120 ? 0 : 0.2,
      centerSteeringAngleRad: step < 60 ? 0 : 0.015, requestedGear: 2 };
    stable.runner.advance(1 / 120, { input });
    baseline.runner.advance(1 / 120, { input });
    assert.deepEqual(stable.runner.createStateSnapshot(), baseline.runner.createStateSnapshot());
    for (let index = 0; index < stable.slots.length; index += 1) {
      assert.deepEqual(stable.slots[index].materialByWheel, baseline.slots[index].materialByWheel);
      assert.deepEqual(stable.slots[index].tireByWheel, baseline.slots[index].tireByWheel);
      assert.deepEqual(stable.slots[index].damage, baseline.slots[index].damage);
    }
  }
});
