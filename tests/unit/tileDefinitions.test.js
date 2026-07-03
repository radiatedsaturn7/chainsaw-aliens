import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTileDefinitions, serializeTileProperties } from '../../src/content/tileDefinitions.js';
import World from '../../src/world/World.js';

test('shared tile definitions expose default gameplay properties', () => {
  const definitions = buildTileDefinitions();

  assert.equal(definitions.byChar.get('#').solid, true);
  assert.equal(definitions.byChar.get('=').oneWay, true);
  assert.equal(definitions.byChar.get('*').hazardDamage, 1);
  assert.equal(definitions.byChar.get('<').conveyor.direction, -1);
  assert.equal(definitions.byChar.get('I').slipperiness, 1);
});

test('tile property overrides are normalized and keyed by tile id', () => {
  const definitions = buildTileDefinitions({
    solid: {
      solid: false,
      slipperiness: 0.5,
      hazardDamage: 2,
      conveyor: { direction: 1, speed: 140 },
      destructible: true
    }
  });
  const solid = definitions.byChar.get('#');

  assert.equal(solid.solid, false);
  assert.equal(solid.slipperiness, 0.5);
  assert.equal(solid.hazardDamage, 2);
  assert.deepEqual(solid.conveyor, { direction: 1, speed: 140 });
  assert.equal(solid.destructible, true);
  assert.deepEqual(serializeTileProperties(solid).conveyor, { direction: 1, speed: 140 });
});

test('world collision and movement helpers read tile property overrides', () => {
  const world = new World();
  world.applyData({
    tileSize: 32,
    width: 3,
    height: 2,
    spawn: { x: 1, y: 1 },
    tiles: ['#*<', '=I~'],
    pixelArt: {
      tileProperties: {
        solid: { solid: false, hazardDamage: 3 },
        spikes: { hazardDamage: 0, solid: true },
        'conveyor-left': { solid: true, conveyor: { direction: 1, speed: 160 } },
        oneway: { oneWay: false, solid: true },
        ice: { slipperiness: 0.35 },
        water: { liquid: 'acid', hazardDamage: 4 }
      }
    }
  });

  assert.equal(world.isSolid(0, 0), false);
  assert.equal(world.isHazard(0, 0), true);
  assert.equal(world.isSolid(1, 0), true);
  assert.equal(world.isHazard(1, 0), false);
  assert.deepEqual(world.getTileConveyor(2, 0), { direction: 1, speed: 160 });
  assert.equal(world.isOneWay(0, 1), false);
  assert.equal(world.isSolid(0, 1), true);
  assert.equal(world.getTileSlipperiness(1, 1), 0.35);
  assert.equal(world.getTileLiquid(2, 1), 'acid');
  assert.equal(world.isHazard(2, 1), true);
});

test('world rebuilds elevator runtime lists from editable tile properties', () => {
  const world = new World();
  world.applyData({
    tileSize: 32,
    width: 3,
    height: 1,
    spawn: { x: 0, y: 0 },
    tiles: ['#=I'],
    pixelArt: {
      tileProperties: {
        solid: { elevatorRole: 'platform', solid: true },
        oneway: { elevatorRole: 'path', oneWay: true },
        ice: { solid: true }
      }
    }
  });

  assert.equal(world.hasElevatorPlatform(0, 0), true);
  assert.equal(world.hasElevatorPath(1, 0), true);
  assert.equal(world.hasElevatorPlatform(2, 0), false);
  assert.deepEqual(world.data.elevators || [], []);
  assert.deepEqual(world.data.elevatorPaths || [], []);
});
