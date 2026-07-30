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
    const sizeTiles = 24;
    game.applyWorldData({
      schemaVersion: 1,
      tileSize: 32,
      width: sizeTiles,
      height: sizeTiles,
      spawn: { x: 12, y: 12 },
      tiles: Array.from({ length: sizeTiles }, () => '.'.repeat(sizeTiles)),
      regions: [],
      enemies: [],
      elevatorPaths: [],
      elevators: [],
      pixelArt: { tiles: {} },
      musicZones: [],
      midiTracks: [],
      triggers: [],
      decals: []
    });
    game.enterEditor({ tab: 'tiles' });
    const targetX = Math.min(
      game.world.width - 2,
      Math.max(1, Number(game.world.spawn?.x || 12) + 2)
    );
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
    window.__pixelArtPlaytestDraws = 0;
    window.__pixelArtOriginalDrawImage = game.ctx.drawImage;
    game.ctx.drawImage = function trackedPixelArtDraw(source, ...args) {
      const destinationX = Number(args[0]);
      const destinationY = Number(args[1]);
      if (destinationX === targetX * game.world.tileSize
        && destinationY === targetY * game.world.tileSize
        && Number(source?.width) === size
        && Number(source?.height) === size) {
        try {
          const pixel = source.getContext?.('2d')?.getImageData?.(3, 3, 1, 1)?.data;
          if (pixel && pixel[0] > 200 && pixel[2] > 200 && pixel[1] < 80 && pixel[3] > 200) {
            window.__pixelArtPlaytestDraws += 1;
          }
        } catch (_error) {
          // A non-readable source is not the generated tile frame.
        }
      }
      return window.__pixelArtOriginalDrawImage.call(this, source, ...args);
    };
    game.snapCameraToPlayer();
  });
  await page.waitForFunction(() => window.__game.state === 'editor');
  await page.evaluate(() => {
    window.__pixelArtPlaytestDraws = 0;
    window.__game.exitEditor({ playtest: true });
  });
  await page.waitForFunction(() => window.__game.state === 'playing' && window.__game.playtestActive === true);

  await expect.poll(async () => page.evaluate(() => {
    const game = window.__game;
    const synthesizedFrames = Array.isArray(game.world.pixelArt?.tiles?.X?.frames)
      && game.world.pixelArt.tiles.X.frames.length > 0;
    const target = window.__pixelRenderTestTarget;
    const tilePersisted = target && game.world.getTile(target.x, target.y) === 'X';
    return synthesizedFrames && tilePersisted
      ? Number(window.__pixelArtPlaytestDraws || 0)
      : -1;
  }), {
    timeout: 15_000
  }).toBeGreaterThan(0);

  await page.evaluate(() => {
    if (window.__pixelArtOriginalDrawImage) {
      window.__game.ctx.drawImage = window.__pixelArtOriginalDrawImage;
      window.__pixelArtOriginalDrawImage = null;
    }
  });

  await page.screenshot({
    path: 'artifacts/pixel-art-editor-only-first-draw.png',
    fullPage: false
  });
});
