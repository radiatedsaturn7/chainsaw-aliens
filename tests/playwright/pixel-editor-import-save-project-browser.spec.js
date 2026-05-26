import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('import black.png in pixel editor, save, exit to main menu, and reopen from project browser', async ({ page }) => {
  await waitForGameReady(page);

  const result = await page.evaluate(async () => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title' });

    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'pixel-editor' && game.pixelStudio) return resolve();
        if (Date.now() - started > 8000) return reject(new Error('Timed out entering pixel editor'));
        requestAnimationFrame(tick);
      };
      tick();
    });

    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 4, 4);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const blackFile = new File([blob], 'black.png', { type: 'image/png' });

    const studio = game.pixelStudio;
    await studio.importImageFromFile(blackFile);
    studio.currentDocumentRef = { folder: 'art', name: 'black-import-save-check' };
    await studio.saveArtDocument();

    game.exitPixelStudio({ toTitle: true });
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'title') return resolve();
        if (Date.now() - started > 8000) return reject(new Error('Timed out returning to title'));
        requestAnimationFrame(tick);
      };
      tick();
    });

    game.openProjectBrowserFromTitle();

    const response = await fetch(`/__storage/file?folder=art&name=${encodeURIComponent('black-import-save-check')}`);
    const payload = response.ok ? await response.json() : null;
    const firstPixel = payload?.file?.data?.frames?.[0]?.[0] ?? payload?.file?.data?.tiles?.['#']?.frames?.[0]?.[0] ?? null;

    return { firstPixel, hasPayload: Boolean(payload) };
  });

  expect(result.hasPayload).toBeTruthy();

  await page.getByRole('button', { name: 'Art' }).click();
  await page.locator('.project-browser-row', { hasText: 'black-import-save-check' }).getByRole('button', { name: 'Open' }).click();

  const reopen = await page.evaluate(async () => {
    const game = window.__game;
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'pixel-editor' && game.pixelStudio?.currentDocumentRef?.name) return resolve();
        if (Date.now() - started > 8000) return reject(new Error('Timed out reopening from project browser'));
        requestAnimationFrame(tick);
      };
      tick();
    });

    return {
      docName: game.pixelStudio?.currentDocumentRef?.name ?? null,
      importedPixel: game.pixelStudio?.activeLayer?.pixels?.[0] ?? 0
    };
  });

  expect(reopen.docName).toBe('black-import-save-check');
  expect(reopen.importedPixel >>> 0).toBe(0xff000000 >>> 0);
});
