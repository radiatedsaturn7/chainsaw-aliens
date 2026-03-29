import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, chromium } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('pink solid tile persists in tile editor preview and level editor room across reopen', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chainsaw-aliens-pink-'));
  const context1 = await chromium.launchPersistentContext(userDataDir, { headless: true });
  const page1 = context1.pages()[0] || await context1.newPage();
  await waitForGameReady(page1);

  await page1.evaluate(async () => {
    const game = window.__game;
    game.enterEditor({ tab: 'tiles' });
    for (let y = 10; y <= 14; y += 1) {
      for (let x = 10; x <= 14; x += 1) {
        if (x === 10 || x === 14 || y === 10 || y === 14) {
          game.world.setTile(x, y, '#', { persist: true });
        }
      }
    }
    window.__pinkRoomTarget = { x: 10, y: 10 };
    game.player.x = (10.5) * game.world.tileSize;
    game.player.y = (10.5) * game.world.tileSize;
    game.snapCameraToPlayer();

    game.enterPixelStudio({ returnState: 'editor', tilePicker: true });
    const studio = game.pixelStudio;
    const solidTile = studio.tileLibrary.find((tile) => tile.id === 'solid');
    studio.setActiveTile(solidTile);
    studio.tilePickerMode = false;
    studio.loadTileData();
    const packedPink = ((255 << 24) | (255 << 16) | (105 << 8) | 255) >>> 0;
    studio.activeLayer.pixels.fill(packedPink);
    studio.syncTileData();
    studio.currentDocumentRef = { folder: 'art', name: 'pink-room-test' };
    await studio.saveArtDocument();
    game.exitPixelStudio();
  });
  await page1.waitForFunction(() => window.__game.state === 'editor');

  await expect.poll(async () => page1.evaluate(() => {
    const manual = window.localStorage.getItem('robter:vfs:art:pink-room-test');
    const autosave = window.localStorage.getItem('robter:vfs:art:Tile Art Autosave');
    const parseFirst = (raw) => {
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.data?.tiles?.['#']?.frames?.[0]?.[0] || null;
    };
    return { manual: parseFirst(manual), autosave: parseFirst(autosave) };
  })).toMatchObject({ manual: '#ff69ff', autosave: '#ff69ff' });

  const firstState = await page1.evaluate(() => {
    const game = window.__game;
    const frame = game.world.pixelArt?.tiles?.['#']?.frames?.[0] || [];
    return {
      tile: game.world.getTile(10, 10),
      pinkPixels: frame.filter((entry) => entry === '#ff69ff').length
    };
  });
  expect(firstState.tile).toBe('#');
  expect(firstState.pinkPixels).toBeGreaterThan(24);
  await page1.screenshot({ path: 'artifacts/pink-room-editor-initial.png', fullPage: false });

  await context1.close();

  const context2 = await chromium.launchPersistentContext(userDataDir, { headless: true });
  const page2 = context2.pages()[0] || await context2.newPage();
  await waitForGameReady(page2);
  const tilePreview = await page2.evaluate(() => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title', tilePicker: true });
    const studio = game.pixelStudio;
    const solidTile = studio.tileLibrary.find((tile) => tile.id === 'solid');
    studio.setActiveTile(solidTile);
    studio.tilePickerMode = false;
    studio.loadTileData();
    const frame = game.world.pixelArt?.tiles?.['#']?.frames?.[0] || [];
    return frame.filter((entry) => entry === '#ff69ff').length;
  });
  const reopenedStored = await page2.evaluate(() => {
    const autosave = window.localStorage.getItem('robter:vfs:art:Tile Art Autosave');
    if (!autosave) return null;
    const parsed = JSON.parse(autosave);
    return parsed?.data?.tiles?.['#']?.frames?.[0]?.[0] || null;
  });
  expect(reopenedStored).toBe('#ff69ff');
  expect(tilePreview).toBeGreaterThan(24);
  await page2.screenshot({ path: 'artifacts/pink-room-tile-editor-reopen.png', fullPage: false });

  await context2.close();

  const context3 = await chromium.launchPersistentContext(userDataDir, { headless: true });
  const page3 = context3.pages()[0] || await context3.newPage();
  await waitForGameReady(page3);
  await page3.evaluate(() => {
    const game = window.__game;
    game.enterEditor({ tab: 'tiles' });
    game.player.x = (10.5) * game.world.tileSize;
    game.player.y = (10.5) * game.world.tileSize;
    game.snapCameraToPlayer();
  });
  await page3.waitForFunction(() => window.__game.state === 'editor');
  const finalState = await page3.evaluate(() => {
    const game = window.__game;
    const tile = game.world.getTile(10, 10);
    const frame = game.world.pixelArt?.tiles?.['#']?.frames?.[0] || [];
    return {
      tile,
      pinkPixels: frame.filter((entry) => entry === '#ff69ff').length
    };
  });
  expect(finalState.tile).toBe('#');
  expect(finalState.pinkPixels).toBeGreaterThan(24);
  await page3.screenshot({ path: 'artifacts/pink-room-editor-reopen.png', fullPage: false });
  await context3.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
