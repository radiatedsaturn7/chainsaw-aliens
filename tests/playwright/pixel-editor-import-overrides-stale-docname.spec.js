import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('import image replaces stale current doc name so Save As targets imported filename', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(async () => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title' });
    const studio = game.pixelStudio;
    studio.currentDocumentRef = { folder: 'art', name: 'Tile Art Autosave' };

    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 2, 2);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    await studio.importImageFromFile(new File([blob], 'black.png', { type: 'image/png' }));
    window.__pendingSaveAs2 = studio.saveArtDocument({ forceSaveAs: true });
  });

  const input = page.locator('.project-browser-savebox input.project-browser-search');
  await expect(input).toHaveValue('black');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForFunction(async () => {
    if (!window.__pendingSaveAs2) return false;
    const result = await window.__pendingSaveAs2;
    return Boolean(result?.name === 'black');
  });

  await page.evaluate(() => window.__game.openProjectBrowserFromTitle());
  await page.getByRole('button', { name: 'Art' }).click();
  await expect(page.locator('.project-browser-row[data-name="black"]')).toBeVisible();
});
