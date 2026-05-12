import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('open waits for pending save-as completion to avoid dirty prompt race', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(async () => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title' });
    const studio = game.pixelStudio;
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 2, 2);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    await studio.importImageFromFile(new File([blob], 'black.png', { type: 'image/png' }));
    window.__pendingSaveRace = studio.saveArtDocument({ forceSaveAs: true });
  });

  await page.getByRole('button', { name: 'Save' }).click();
  await page.evaluate(() => window.__game.pixelStudio.loadArtDocument());

  await expect(page.locator('.project-browser-row', { hasText: 'black' })).toBeVisible();
});
