import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('tile editor save keeps Solid Block blue after reopening the app page', async ({ page, context }) => {
  await waitForGameReady(page);

  await page.evaluate(async () => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title', tilePicker: true });
    const studio = game.pixelStudio;
    const solidTile = studio.tileLibrary.find((tile) => tile.id === 'solid');
    studio.setActiveTile(solidTile);
    studio.tilePickerMode = false;
    studio.loadTileData();
    const packedBlue = ((255 << 24) | (255 << 16)) >>> 0;
    studio.activeLayer.pixels.fill(packedBlue);
    studio.syncTileData();
    studio.currentDocumentRef = { folder: 'art', name: 'solid-blue-persistence' };
    await studio.saveArtDocument();
  });

  await expect.poll(async () => page.evaluate(() => {
    const payload = window.localStorage.getItem('robter:vfs:art:solid-blue-persistence');
    if (!payload) return null;
    const parsed = JSON.parse(payload);
    return parsed?.data?.tiles?.['#']?.frames?.[0]?.[0] || null;
  })).toBe('#0000ff');

  await page.screenshot({ path: 'artifacts/tile-editor-solid-blue-saved.png', fullPage: false });

  await page.close();
  const reopenedPage = await context.newPage();
  await waitForGameReady(reopenedPage);

  await reopenedPage.evaluate(() => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title', tilePicker: true });
    const studio = game.pixelStudio;
    const solidTile = studio.tileLibrary.find((tile) => tile.id === 'solid');
    studio.setActiveTile(solidTile);
    studio.tilePickerMode = false;
    studio.loadTileData();
  });

  const persistedStorageColor = await reopenedPage.evaluate(() => {
    const payload = window.localStorage.getItem('robter:vfs:art:solid-blue-persistence');
    if (!payload) return null;
    const parsed = JSON.parse(payload);
    return parsed?.data?.tiles?.['#']?.frames?.[0]?.[0] || null;
  });
  expect(persistedStorageColor).toBe('#0000ff');

  const restoredBluePixels = await reopenedPage.evaluate(() => {
    const frame = window.__game.world.pixelArt?.tiles?.['#']?.frames?.[0];
    if (!Array.isArray(frame)) return 0;
    return frame.filter((entry) => entry === '#0000ff').length;
  });
  expect(restoredBluePixels).toBeGreaterThan(24);

  await reopenedPage.screenshot({ path: 'artifacts/tile-editor-solid-blue-reopened.png', fullPage: false });
});
