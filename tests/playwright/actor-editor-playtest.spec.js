import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('actor editor workflow renders a white-square custom actor in playtest', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    window.__game.enterActorEditor();
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    const whiteSquare = canvas.toDataURL('image/png');

    const actor = JSON.parse(JSON.stringify(window.__game.actorEditor.actor));
    actor.name = 'White Square';
    actor.gravity = false;
    actor.size = { width: 32, height: 32 };
    actor.states[0].animation = {
      imageDataUrl: whiteSquare,
      frames: [{ imageDataUrl: whiteSquare, durationMs: 120 }],
      fps: 8
    };
    window.__game.actorEditor.setActor(actor);
    window.__game.actorEditor.playtestActor();
  });

  await page.waitForFunction(() => window.__game.state === 'playing');
  await page.waitForFunction(() => window.__game.enemies.some((enemy) => String(enemy.type).startsWith('custom:')));

  await expect.poll(async () => page.evaluate(() => {
    const game = window.__game;
    const enemy = game.enemies.find((entry) => String(entry.type).startsWith('custom:'));
    if (!enemy) return false;
    const sx = Math.round(enemy.x - game.camera.x);
    const sy = Math.round(enemy.y - game.camera.y);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;
    if (sx < 0 || sy < 0 || sx >= game.canvas.width || sy >= game.canvas.height) return false;
    const center = game.ctx.getImageData(sx, sy, 1, 1).data;
    const nearEdgeX = Math.min(game.canvas.width - 1, sx + 14);
    const nearEdge = game.ctx.getImageData(nearEdgeX, sy, 1, 1).data;
    const centerBright = center[0] >= 200 && center[1] >= 200 && center[2] >= 200;
    const nearEdgeBright = nearEdge[0] >= 180 && nearEdge[1] >= 180 && nearEdge[2] >= 180;
    return centerBright && nearEdgeBright;
  }), {
    timeout: 15_000
  }).toBeTruthy();

  await page.screenshot({
    path: 'artifacts/actor-editor-white-square-playtest.png',
    fullPage: false
  });
});
