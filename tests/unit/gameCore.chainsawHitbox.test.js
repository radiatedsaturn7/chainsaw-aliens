import test from 'node:test';
import assert from 'node:assert/strict';

test('chainsaw directional overlap reaches large enemy at contact edge', async () => {
  globalThis.window = globalThis.window || { location: { search: '' } };
  const { default: GameCore } = await import('../../src/game/GameCore.js');
  const ctx = { doesEntityOverlapAttackBox: GameCore.prototype.doesEntityOverlapAttackBox };
  const largeEnemy = { x: 175, y: 100, width: 150, height: 90 };
  const hit = GameCore.prototype.doesEntityOverlapDirectionalAttackBox.call(ctx, largeEnemy, 100, 94, 1, 80, 30, 58);
  assert.equal(hit, true);
});

test('chainsaw close-contact fallback overlaps enemy regardless facing', async () => {
  globalThis.window = globalThis.window || { location: { search: '' } };
  const { default: GameCore } = await import('../../src/game/GameCore.js');
  const ctx = {
    world: { tileSize: 24 },
    player: { x: 100, y: 100, width: 24, height: 24 }
  };
  const largeEnemy = { x: 175, y: 100, width: 150, height: 90 };
  const hit = GameCore.prototype.doesEntityOverlapPlayerBody.call(ctx, largeEnemy, 8, 8);
  assert.equal(hit, true);
});
