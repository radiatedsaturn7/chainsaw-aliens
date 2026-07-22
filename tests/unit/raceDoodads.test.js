import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRaceDoodadFromLegacyScenery,
  getDoodadRuleForSpeed,
  normalizeRaceDoodadDocument,
  serializeRaceDoodadDocument
} from '../../src/racing/raceDoodads.js';

test('race doodad documents normalize threshold rules', () => {
  const doodad = normalizeRaceDoodadDocument({
    name: 'Road Sign',
    artRef: 'sign-art',
    widthM: 1.2,
    heightM: 2.4,
    defaultRule: { behavior: 'collide', speedDrainPercent: 40, damage: { panels: 10 } },
    rules: [
      { minSpeedMph: 120, behavior: 'fly-off', speedDrainPercent: 20 },
      { minSpeedMph: 30, behavior: 'flatten', speedDrainPercent: 10 }
    ]
  });

  assert.equal(doodad.id, 'road-sign');
  assert.equal(doodad.artRef, 'sign-art');
  assert.equal(doodad.groundOffsetM, 0);
  assert.equal(doodad.hitboxWidthM, 1.2);
  assert.equal(doodad.hitboxHeightM, 2.4);
  assert.deepEqual(doodad.rules.map((rule) => rule.minSpeedMph), [30, 120]);
  assert.equal(getDoodadRuleForSpeed(doodad, 0).behavior, 'collide');
  assert.equal(getDoodadRuleForSpeed(doodad, 45).behavior, 'flatten');
  assert.equal(getDoodadRuleForSpeed(doodad, 140).behavior, 'fly-off');
});

test('legacy race scenery definition converts into doodad document data', () => {
  const doodad = createRaceDoodadFromLegacyScenery({
    id: 'tree-def',
    label: 'Track Tree',
    artRef: 'Tree Art',
    widthM: 2,
    heightM: 7,
    behavior: 'indestructible'
  });
  const payload = serializeRaceDoodadDocument(doodad);

  assert.equal(payload.kind, 'race-doodad');
  assert.equal(payload.doodad.name, 'Track Tree');
  assert.equal(payload.doodad.artRef, 'Tree Art');
  assert.equal(payload.doodad.hitboxWidthM, 2);
  assert.equal(payload.doodad.hitboxHeightM, 7);
  assert.equal(payload.doodad.defaultRule.behavior, 'collide');
});

test('race doodad documents preserve explicit hitbox dimensions', () => {
  const doodad = normalizeRaceDoodadDocument({
    name: 'Tall Tree',
    artRef: 'tree-art',
    widthM: 5,
    heightM: 12,
    groundOffsetM: 1.4,
    hitboxWidthM: 1.8,
    hitboxHeightM: 4.5
  });
  const payload = serializeRaceDoodadDocument(doodad);

  assert.equal(doodad.hitboxWidthM, 1.8);
  assert.equal(doodad.hitboxHeightM, 4.5);
  assert.equal(doodad.groundOffsetM, 1.4);
  assert.equal(payload.doodad.hitboxWidthM, 1.8);
  assert.equal(payload.doodad.hitboxHeightM, 4.5);
  assert.equal(payload.doodad.groundOffsetM, 1.4);
});
