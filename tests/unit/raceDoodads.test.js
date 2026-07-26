import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RACE_DOODAD_SIZE_LIMITS,
  createRaceDoodadFromLegacyScenery,
  getDoodadRuleForSpeed,
  getRaceDoodadGroundOffsetLimit,
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

test('race doodad documents preserve large editor-authored dimensions', () => {
  const doodad = normalizeRaceDoodadDocument({
    name: 'Giant Billboard',
    widthM: 240,
    heightM: 180,
    hitboxWidthM: 220,
    hitboxHeightM: 160
  });
  const clamped = normalizeRaceDoodadDocument({
    name: 'Overlarge Billboard',
    widthM: RACE_DOODAD_SIZE_LIMITS.maxWidthM + 50,
    heightM: RACE_DOODAD_SIZE_LIMITS.maxHeightM + 50,
    hitboxWidthM: RACE_DOODAD_SIZE_LIMITS.maxWidthM + 50,
    hitboxHeightM: RACE_DOODAD_SIZE_LIMITS.maxHeightM + 50
  });

  assert.equal(doodad.widthM, 240);
  assert.equal(doodad.heightM, 180);
  assert.equal(doodad.hitboxWidthM, 220);
  assert.equal(doodad.hitboxHeightM, 160);
  assert.equal(clamped.widthM, RACE_DOODAD_SIZE_LIMITS.maxWidthM);
  assert.equal(clamped.heightM, RACE_DOODAD_SIZE_LIMITS.maxHeightM);
  assert.equal(clamped.hitboxWidthM, RACE_DOODAD_SIZE_LIMITS.maxWidthM);
  assert.equal(clamped.hitboxHeightM, RACE_DOODAD_SIZE_LIMITS.maxHeightM);
});

test('race doodad documents clamp plant depth to one full doodad height', () => {
  const tall = normalizeRaceDoodadDocument({
    name: 'Buried Tower',
    widthM: 12,
    heightM: 48,
    groundOffsetM: 42
  });
  const overDeep = normalizeRaceDoodadDocument({
    name: 'Too Deep Tower',
    widthM: 12,
    heightM: 48,
    groundOffsetM: 80
  });
  const shallow = normalizeRaceDoodadDocument({
    name: 'Short Sign',
    widthM: 1,
    heightM: 3,
    groundOffsetM: 8
  });

  assert.equal(getRaceDoodadGroundOffsetLimit(tall.heightM), 48);
  assert.equal(tall.groundOffsetM, 42);
  assert.equal(overDeep.groundOffsetM, 48);
  assert.equal(shallow.groundOffsetM, 3);
});
