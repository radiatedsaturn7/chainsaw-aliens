const { test, expect } = require('@playwright/test');

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await expect(page.locator('#game')).toBeVisible();
}

test('smoke: load app and visit each editor with view/canvas checks', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    window.__game.enterEditor();
  });
  await page.waitForFunction(() => window.__game.state === 'editor');
  const editorView = await page.evaluate(() => ({
    hasCamera: Boolean(window.__game.editor?.camera),
    canvasWidth: window.__game.canvas?.width || 0,
    canvasHeight: window.__game.canvas?.height || 0
  }));
  expect(editorView.hasCamera).toBeTruthy();
  expect(editorView.canvasWidth).toBeGreaterThan(0);
  expect(editorView.canvasHeight).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__game.enterPixelStudio();
  });
  await page.waitForFunction(() => window.__game.state === 'pixel-editor');
  await page.waitForFunction(() => Boolean(window.__game.pixelStudio?.canvasBounds));
  const pixelView = await page.evaluate(() => ({
    hasCanvasBounds: Boolean(window.__game.pixelStudio?.canvasBounds),
    hasZoomLevels: (window.__game.pixelStudio?.view?.zoomLevels?.length || 0) > 0
  }));
  expect(pixelView.hasCanvasBounds).toBeTruthy();
  expect(pixelView.hasZoomLevels).toBeTruthy();

  await page.evaluate(() => {
    window.__game.enterMidiComposer();
  });
  await page.waitForFunction(() => window.__game.state === 'midi-editor');
  await page.waitForFunction(() => Boolean(window.__game.midiComposer?.gridBounds));
  const midiView = await page.evaluate(() => ({
    hasGridBounds: Boolean(window.__game.midiComposer?.gridBounds),
    activeTab: window.__game.midiComposer?.activeTab
  }));
  expect(midiView.hasGridBounds).toBeTruthy();
  expect(midiView.activeTab).toBe('grid');
});

test('regression: editor survives playtest round trip and still handles input', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    window.__game.enterEditor();
  });
  await page.waitForFunction(() => window.__game.state === 'editor');

  await page.evaluate(() => {
    window.__game.exitEditor({ playtest: true });
  });
  await page.waitForFunction(() => window.__game.state === 'playing' && window.__game.playtestActive === true);

  await page.evaluate(() => {
    window.__game.returnToEditorFromPlaytest();
  });
  await page.waitForFunction(() => window.__game.state === 'editor' && window.__game.playtestActive === false);

  const beforeX = await page.evaluate(() => window.__game.editor.camera.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(50);
  const afterX = await page.evaluate(() => window.__game.editor.camera.x);

  expect(afterX).toBeGreaterThan(beforeX);
});
