import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('committed Tree and Factory art previews and doodads load on a clean browser', async ({ page }) => {
  await waitForGameReady(page);
  for (const name of ['tree', '1000014256']) {
    const preview = await page.evaluate(async ({ artName }) => {
      const response = await fetch(`/__storage/file?folder=art&name=${encodeURIComponent(artName)}`);
      const payload = await response.json();
      const { createArtPreviewDataUrl } = await import('/src/ui/ProjectBrowserModal.js');
      const source = createArtPreviewDataUrl(payload.file.data);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      return { source, width: image.naturalWidth, height: image.naturalHeight };
    }, { artName: name });
    expect(preview.source).toContain('data:image/png');
    expect(preview.width).toBeGreaterThan(0);
    expect(preview.height).toBeGreaterThan(0);
  }

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
