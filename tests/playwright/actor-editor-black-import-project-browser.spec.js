import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('actor editor animation can import black.png, save as black, preview, and appear in art browser', async ({ page }) => {
  await waitForGameReady(page);

  const setup = await page.evaluate(async () => {
    const game = window.__game;
    await game.enterActorEditor();
    const actorEditor = game.actorEditor;
    await actorEditor.newActor();
    const state = actorEditor.actor.states[0];
    actorEditor.openStateAnimation(state);

    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'pixel-editor' && game.pixelStudio?.decalEditSession?.type === 'actor-state') return resolve();
        if (Date.now() - started > 8000) return reject(new Error('Timed out entering actor-state pixel editor'));
        requestAnimationFrame(tick);
      };
      tick();
    });

    const studio = game.pixelStudio;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 4, 4);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'black.png', { type: 'image/png' });

    await studio.importImageFromFile(file);
    studio.currentDocumentRef = { folder: 'art', name: 'black' };
    await studio.saveArtDocument();

    const saved = window.localStorage.getItem('robter:vfs:art:black');

    game.exitPixelStudio();
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'actor-editor') return resolve();
        if (Date.now() - started > 8000) return reject(new Error('Timed out returning to actor editor'));
        requestAnimationFrame(tick);
      };
      tick();
    });

    const previewUrl = actorEditor.getAnimationPreviewFrames(actorEditor.actor.states[0]?.animation || {})?.[0]?.imageDataUrl || null;

    actorEditor.exitToMenu();
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
    return { saved: Boolean(saved), previewUrl };
  });

  expect(setup.saved).toBeTruthy();
  expect(setup.previewUrl).toBeTruthy();

  await page.getByRole('button', { name: 'Art' }).click();
  await expect(page.locator('.project-browser-row', { hasText: 'black' })).toBeVisible();
});
