import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('importing image from tile-picker session still saves an art doc', async ({ page }) => {
  await waitForGameReady(page);

  const saved = await page.evaluate(async () => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title', tilePicker: true });
    const studio = game.pixelStudio;

    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 2, 2);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    await studio.importImageFromFile(new File([blob], 'black.png', { type: 'image/png' }));

    studio.currentDocumentRef = { folder: 'art', name: 'black-from-tile-picker' };
    await studio.saveArtDocument();
    const payload = localStorage.getItem('robter:vfs:art:black-from-tile-picker');
    const parsed = payload ? JSON.parse(payload) : null;
    return { hasPayload: Boolean(payload), hasFrames: Array.isArray(parsed?.data?.frames) };
  });

  expect(saved.hasPayload).toBeTruthy();
  expect(saved.hasFrames).toBeTruthy();
});
