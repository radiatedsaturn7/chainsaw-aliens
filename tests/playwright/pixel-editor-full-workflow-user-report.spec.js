import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('reported workflow: import -> save as -> exit -> project browser open saved file', async ({ page }) => {
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
    window.__saveFlow = studio.saveArtDocument({ forceSaveAs: true });
  });

  await expect(page.locator('.project-browser-savebox input.project-browser-search')).toHaveValue('black');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForFunction(async () => Boolean((await window.__saveFlow)?.name));

  const dirty = await page.evaluate(() => window.__game.pixelStudio.runtime.hasUnsavedChanges());
  expect(dirty).toBeFalsy();

  await page.evaluate(() => {
    const game = window.__game;
    game.exitPixelStudio({ toTitle: true });
    game.openProjectBrowserFromTitle();
  });

  await page.getByRole('button', { name: 'Art' }).click();
  await page.locator('.project-browser-row', { hasText: 'black' }).getByRole('button', { name: 'Open' }).click();

  await page.waitForFunction(() => window.__game.state === 'pixel-editor');
  const docName = await page.evaluate(() => window.__game.pixelStudio.currentDocumentRef?.name || null);
  expect(docName).toBe('black');
});
