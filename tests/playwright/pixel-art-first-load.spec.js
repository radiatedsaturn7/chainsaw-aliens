import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('editor-only tile art renders immediately on first world draw', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    const game = window.__game;
    game.enterEditor({ tab: 'tiles' });
    const targetX = game.world.spawn?.x || 12;
    const targetY = game.world.spawn?.y || 12;
    const tileChar = 'X';
    const size = 16;
    const packedMagenta = ((255 << 24) | (255 << 16) | (0 << 8) | 255) >>> 0;
    const pixels = new Array(size * size).fill(0);
    for (let y = 2; y < size - 2; y += 1) {
      for (let x = 2; x < size - 2; x += 1) {
        pixels[y * size + x] = packedMagenta;
      }
    }
    game.world.pixelArt = {
      tiles: {
        [tileChar]: {
          size,
          fps: 6,
          editor: {
            width: size,
            height: size,
            frames: [
              {
                layers: [
                  { id: 'base', name: 'Base', visible: true, pixels }
                ]
              }
            ]
          }
        }
      }
    };
    game.world.setTile(targetX, targetY, tileChar, { persist: true });
    window.__pixelRenderTestTarget = { x: targetX, y: targetY };
    game.player.x = (targetX + 0.5) * game.world.tileSize;
    game.player.y = (targetY + 0.5) * game.world.tileSize;
    game.snapCameraToPlayer();
  });
  await page.waitForFunction(() => window.__game.state === 'editor');
  await page.evaluate(() => {
    window.__game.exitEditor({ playtest: true });
  });
  await page.waitForFunction(() => window.__game.state === 'playing' && window.__game.playtestActive === true);

  await expect.poll(async () => page.evaluate(() => {
    const game = window.__game;
    const target = window.__pixelRenderTestTarget || { x: 12, y: 12 };
    const tileSize = game.world.tileSize;
    const left = Math.floor(target.x * tileSize - game.camera.x);
    const top = Math.floor(target.y * tileSize - game.camera.y);
    if (left + tileSize < 0 || top + tileSize < 0) return null;
    if (left >= game.canvas.width || top >= game.canvas.height) return null;
    const sampleW = Math.max(1, Math.min(tileSize, game.canvas.width - Math.max(0, left)));
    const sampleH = Math.max(1, Math.min(tileSize, game.canvas.height - Math.max(0, top)));
    const data = game.ctx.getImageData(Math.max(0, left), Math.max(0, top), sampleW, sampleH).data;
    let brightMagentaPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 200 && r > 200 && b > 200 && g < 80) brightMagentaPixels += 1;
    }
    const synthesizedFrames = Array.isArray(game.world.pixelArt?.tiles?.X?.frames)
      && game.world.pixelArt.tiles.X.frames.length > 0;
    return { brightMagentaPixels, synthesizedFrames };
  }), {
    timeout: 15_000
  }).toMatchObject({ synthesizedFrames: true, brightMagentaPixels: expect.any(Number) });

  const magentaCount = await page.evaluate(() => {
    const game = window.__game;
    const target = window.__pixelRenderTestTarget || { x: 12, y: 12 };
    const tileSize = game.world.tileSize;
    const left = Math.floor(target.x * tileSize - game.camera.x);
    const top = Math.floor(target.y * tileSize - game.camera.y);
    const data = game.ctx.getImageData(Math.max(0, left), Math.max(0, top), tileSize, tileSize).data;
    let brightMagentaPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 200 && b > 200 && g < 80) brightMagentaPixels += 1;
    }
    return brightMagentaPixels;
  });
  expect(magentaCount).toBeGreaterThan(24);

  await page.screenshot({
    path: 'artifacts/pixel-art-editor-only-first-draw.png',
    fullPage: false
  });
});
