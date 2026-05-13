import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

async function importAndSaveAs(page, { format, name, width, height }) {
  await page.evaluate(async ({ format, name, width, height }) => {
    const game = window.__game;
    game.transitionTo('title');
    game.enterPixelStudio({ returnState: 'title' });
    const studio = game.pixelStudio;

    let file;
    if (format === 'gif') {
      // 1x1 black GIF89a
      const gifBytes = new Uint8Array([
        0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
        0x00,0x00,0x00,0xff,0xff,0xff,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,
        0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b
      ]);
      file = new File([gifBytes], `${name}.gif`, { type: 'image/gif' });
    } else {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise((resolve) => c.toBlob(resolve, mime, 0.95));
      file = new File([blob], `${name}.${format === 'jpeg' ? 'jpg' : format}`, { type: mime });
    }

    await studio.importImageFromFile(file);
    window.__saveFlow = studio.saveArtDocument({ forceSaveAs: true });
  }, { format, name, width, height });

  await expect(page.locator('.project-browser-savebox input.project-browser-search')).toHaveValue(name);
  await page.evaluate(() => {
    const saveBtn = Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === 'Save');
    if (!saveBtn) throw new Error('Save button not found');
    saveBtn.click();
  });
  await page.waitForFunction(async () => Boolean((await window.__saveFlow)?.name));

  const dirty = await page.evaluate(() => window.__game.pixelStudio.runtime.hasUnsavedChanges());
  expect(dirty).toBeFalsy();

  await page.evaluate(() => {
    const game = window.__game;
    game.exitPixelStudio({ toTitle: true });
    game.openProjectBrowserFromTitle();
  });

  await page.getByRole('button', { name: 'Art' }).click();
  await page.locator('.project-browser-row', { hasText: name }).getByRole('button', { name: 'Open' }).click();
  await page.waitForFunction(() => window.__game.state === 'pixel-editor');
  const docName = await page.evaluate(() => window.__game.pixelStudio.currentDocumentRef?.name || null);
  expect(docName).toBe(name);
}

test('imports PNG, JPEG, and GIF files and persists them to project browser', async ({ page }) => {
  await waitForGameReady(page);

  await importAndSaveAs(page, { format: 'png', name: 'black-png', width: 8, height: 8 });
  await importAndSaveAs(page, { format: 'jpeg', name: 'black-jpeg', width: 8, height: 8 });
  await importAndSaveAs(page, { format: 'gif', name: 'black-gif', width: 1, height: 1 });
});


test('large 4096x4096 PNG imports with scaling and saves successfully', async ({ page }) => {
  test.setTimeout(180000);
  await waitForGameReady(page);

  await importAndSaveAs(page, { format: 'png', name: 'black-4096', width: 4096, height: 4096 });

  const dims = await page.evaluate(() => ({
    w: window.__game.pixelStudio.canvasState.width,
    h: window.__game.pixelStudio.canvasState.height
  }));
  expect(dims.w).toBeLessThanOrEqual(512);
  expect(dims.h).toBeLessThanOrEqual(512);
});
