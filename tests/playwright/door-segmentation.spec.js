import { test, expect } from '@playwright/test';

async function loadSegmentedDoorScene(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.evaluate(() => {
    const width = 24;
    const height = 24;
    const rows = Array.from({ length: height }, () => '#'.repeat(width).split(''));

    for (let y = 2; y < 22; y += 1) {
      for (let x = 2; x < 8; x += 1) rows[y][x] = '.';
      for (let x = 16; x < 22; x += 1) rows[y][x] = '.';
    }
    for (let y = 4; y < 20; y += 1) {
      for (let x = 10; x < 14; x += 1) rows[y][x] = 'D';
    }

    window.__game.applyWorldData({
      schemaVersion: 1,
      tileSize: 32,
      width,
      height,
      spawn: { x: 5, y: 12 },
      tiles: rows.map((row) => row.join('')),
      regions: []
    });
    window.__game.state = 'playing';
    window.__game.player.x = 11.5 * 32;
    window.__game.player.y = 12.5 * 32;
    window.__game.camera.x = 0;
    window.__game.camera.y = 0;
    window.__game.draw();
  });
}

test('renders long doorway fillers as dark foreground blocks while leaving the span traversable', async ({ page }, testInfo) => {
  await loadSegmentedDoorScene(page);

  const state = await page.evaluate(() => ({
    midTile: window.__game.world.getTile(11, 12),
    midSolid: window.__game.world.isSolid(11, 12, window.__game.abilities),
  }));

  expect(state.midTile).toBe('D');
  expect(state.midSolid).toBe(false);

  await page.screenshot({ path: testInfo.outputPath('door-segmentation.png'), fullPage: true });
});
