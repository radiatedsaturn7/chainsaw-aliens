import test from 'node:test';
import assert from 'node:assert/strict';

test('chainsaw forward directional overlap reaches large enemy at contact edge', async () => {
  globalThis.window = globalThis.window || { location: { search: '' } };
  const { default: GameCore } = await import('../../src/game/GameCore.js');
  const ctx = {
    doesEntityOverlapAttackBox: GameCore.prototype.doesEntityOverlapAttackBox
  };
  const largeEnemy = { x: 175, y: 100, width: 150, height: 90 };
  const hit = GameCore.prototype.doesEntityOverlapDirectionalAttackBox.call(
    ctx,
    largeEnemy,
    100,
    94,
    1,
    80,
    30,
    58
  );
  assert.equal(hit, true);
});
