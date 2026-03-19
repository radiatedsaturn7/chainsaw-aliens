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
    window.__game.camera.x = 0;
    window.__game.camera.y = 0;
    window.__game.draw();
  });
}

test('normalizes a tall shared doorway into two door caps and saves a visual regression screenshot', async ({ page }, testInfo) => {
  await loadSegmentedDoorScene(page);

  const tiles = await page.evaluate(() => {
    const readColumn = (x, yStart, yEnd) => {
      const out = [];
      for (let y = yStart; y <= yEnd; y += 1) out.push(window.__game.world.getTile(x, y));
      return out;
    };
    return {
      upper: readColumn(11, 4, 5),
      middle: readColumn(11, 6, 17),
      lower: readColumn(11, 18, 19)
    };
  });

  expect(tiles.upper).toEqual(['D', 'D']);
  expect(tiles.middle).toEqual(Array(12).fill('#'));
  expect(tiles.lower).toEqual(['D', 'D']);

  await page.screenshot({ path: testInfo.outputPath('door-segmentation.png'), fullPage: true });
});
