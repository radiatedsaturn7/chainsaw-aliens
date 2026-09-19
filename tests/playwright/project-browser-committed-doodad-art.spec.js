import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('committed Tree and Factory art previews and doodads load on a clean browser', async ({ page }) => {
  await waitForGameReady(page);
  await page.evaluate(() => window.__game.openProjectBrowserFromTitle());
  await page.getByRole('button', { name: 'Art' }).click();

  for (const name of ['tree', '1000014256']) {
    const image = page.locator(`.project-browser-row[data-name="${name}"] .project-browser-art-preview-image`);
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (
      element.naturalWidth > 0
      && element.naturalHeight > 0
      && (element.getAttribute('src') || '').startsWith('data:image/png')
    ))).toBe(true);
  }

  await page.getByRole('button', { name: 'Close' }).click();
  for (const [doodadName, artRef] of [['tree', 'tree'], ['Factory', '1000014256']]) {
    await page.evaluate(async ({ doodadName: name }) => {
      const response = await fetch(`/__storage/file?folder=doodads&name=${encodeURIComponent(name)}`);
      const payload = await response.json();
      window.__game.enterDoodadEditor();
      window.__game.doodadEditor.loadDoodadDocument(payload.file.data, name);
    }, { doodadName });
    await page.waitForFunction(({ artRef: expected }) => {
      const editor = window.__game.doodadEditor;
      return editor.artLoadState?.ref === expected
        && editor.artLoadState?.status === 'ready'
        && Boolean(editor.getDoodadArtCanvas(expected));
    }, { artRef });
  }
});
