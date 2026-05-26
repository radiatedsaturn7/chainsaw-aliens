import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('save-as with empty filename still persists using fallback name', async ({ page }) => {
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
    window.__pendingSaveAs3 = studio.saveArtDocument({ forceSaveAs: true });
  });

  const input = page.locator('.project-browser-savebox input.project-browser-search');
  await input.fill('');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForFunction(async () => {
    const res = await window.__pendingSaveAs3;
    return Boolean(res?.name);
  });

  const hasAny = await page.evaluate(async () => {
    const black = await fetch(`/__storage/file?folder=art&name=${encodeURIComponent('black')}`);
    const untitled = await fetch(`/__storage/file?folder=art&name=${encodeURIComponent('untitled')}`);
    return black.ok || untitled.ok;
  });
  expect(hasAny).toBeTruthy();
});
