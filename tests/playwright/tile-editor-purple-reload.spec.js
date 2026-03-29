import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, chromium } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('tile editor solid block stays purple after full browser reopen from editor route', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chainsaw-aliens-purple-'));

  const context1 = await chromium.launchPersistentContext(userDataDir, { headless: true });
  const page1 = context1.pages()[0] || await context1.newPage();
  await waitForGameReady(page1);

  await page1.evaluate(async () => {
    const game = window.__game;
    game.enterEditor({ tab: 'tiles' });
    game.enterPixelStudio({ returnState: 'editor', tilePicker: true });
    const studio = game.pixelStudio;
    const solidTile = studio.tileLibrary.find((tile) => tile.id === 'solid');
    studio.setActiveTile(solidTile);
    studio.tilePickerMode = false;
    studio.loadTileData();
    const packedPurple = ((255 << 24) | (255 << 8) | 255) >>> 0;
    studio.activeLayer.pixels.fill(packedPurple);
    studio.syncTileData();
    studio.currentDocumentRef = { folder: 'art', name: 'solid-purple-reload' };
    await studio.saveArtDocument();
    game.exitPixelStudio();
  });

  await expect.poll(async () => page1.evaluate(() => {
    const payload = window.localStorage.getItem('robter:vfs:art:Tile Art Autosave');
    if (!payload) return null;
    const parsed = JSON.parse(payload);
    return parsed?.data?.tiles?.['#']?.ref || null;
  })).toBe('Tile Art 23');

  await context1.close();

  const context2 = await chromium.launchPersistentContext(userDataDir, { headless: true });
  const page2 = context2.pages()[0] || await context2.newPage();
  await waitForGameReady(page2);

  await page2.evaluate(() => {
    const game = window.__game;
    game.enterEditor({ tab: 'tiles' });
    game.enterPixelStudio({ returnState: 'editor', tilePicker: true });
    const studio = game.pixelStudio;
    const solidTile = studio.tileLibrary.find((tile) => tile.id === 'solid');
    studio.setActiveTile(solidTile);
    studio.tilePickerMode = false;
    studio.loadTileData();
  });

  const purplePixels = await page2.evaluate(() => {
    const frame = window.__game.world.pixelArt?.tiles?.['#']?.frames?.[0] || [];
    return frame.filter((entry) => entry === '#ff00ff').length;
  });

  expect(purplePixels).toBeGreaterThan(24);

  await context2.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
