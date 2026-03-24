import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('actor editor playtest renders a white-square custom actor', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    const whiteSquare = canvas.toDataURL('image/png');

    const actor = {
      id: 'white-square',
      name: 'White Square',
      gravity: false,
      health: 3,
      size: { width: 32, height: 32 },
      states: [{
        id: 'idle',
        name: 'Idle',
        animation: {
          imageDataUrl: whiteSquare,
          frames: [{ imageDataUrl: whiteSquare, durationMs: 120 }],
          fps: 8
        },
        movement: { type: 'none', params: {} },
        overrides: { bodyDamageEnabled: null, contactDamage: null, invulnerable: null },
        conditions: [{ id: 'always', type: 'always', params: {} }],
        conditionMode: 'all',
        actions: []
      }],
      initialStateId: 'idle'
    };

    window.__game.registerRuntimeActorDefinition(actor);
    window.__game.startActorEditorPlaytest(actor.id, actor);
  });

  await page.waitForFunction(() => window.__game.state === 'playing');
  await page.waitForFunction(() => window.__game.enemies.some((enemy) => enemy.type === 'custom:white-square'));

  await expect.poll(async () => page.evaluate(() => {
    const game = window.__game;
    const enemy = game.enemies.find((entry) => entry.type === 'custom:white-square');
    if (!enemy) return false;
    const sx = Math.round(enemy.x - game.camera.x);
    const sy = Math.round(enemy.y - game.camera.y);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;
    if (sx < 0 || sy < 0 || sx >= game.canvas.width || sy >= game.canvas.height) return false;
    const pixel = game.ctx.getImageData(sx, sy, 1, 1).data;
    return pixel[0] >= 200 && pixel[1] >= 200 && pixel[2] >= 200;
  }), {
    timeout: 15_000
  }).toBeTruthy();

  await page.screenshot({
    path: 'artifacts/actor-editor-white-square-playtest.png',
    fullPage: false
  });
});
