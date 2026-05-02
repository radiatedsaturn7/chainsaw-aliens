import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('actor editor pixel art saves to art doc and reopens with drawn pixels', async ({ page }) => {
  await waitForGameReady(page);

  const setupResult = await page.evaluate(async () => {
    const game = window.__game;
    await game.enterActorEditor();
    const actorEditor = game.actorEditor;
    await actorEditor.newActor();
    const state = actorEditor.actor.states[0];
    actorEditor.openStateAnimation(state);
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'pixel-editor' && game.pixelStudio?.decalEditSession?.type === 'actor-state') {
          resolve();
          return;
        }
        if (Date.now() - started > 8000) {
          reject(new Error('Timed out entering actor-state pixel editor session'));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });

    const studio = game.pixelStudio;
    const packedRed = ((255 << 24) | 255) >>> 0;
    studio.activeLayer.pixels[0] = packedRed;
    studio.activeLayer.pixels[1] = packedRed;

    await studio.saveArtDocument();
    const savedName = studio.currentDocumentRef?.name || '';
    const savedPayload = window.localStorage.getItem(`robter:vfs:art:${savedName}`);
    if (!savedPayload) {
      throw new Error(`Expected saved art payload for ${savedName}`);
    }
    const parsed = JSON.parse(savedPayload);
    const savedFrame = parsed?.data?.frames?.[0] || [];
    const savedPixel = savedFrame[0] || null;

    game.exitPixelStudio();
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'actor-editor') {
          resolve();
          return;
        }
        if (Date.now() - started > 8000) {
          reject(new Error('Timed out returning to actor editor'));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });

    actorEditor.exitToMenu();
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'title') {
          resolve();
          return;
        }
        if (Date.now() - started > 8000) {
          reject(new Error('Timed out returning to title'));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });

    window.localStorage.setItem('robter:vfs:art:Tile Art Autosave', JSON.stringify({
      id: 'Tile Art Autosave',
      folder: 'art',
      savedAt: Date.now(),
      data: {
        tiles: {
          '#': {
            frames: [['#00ff00']],
            editor: {
              width: 1,
              height: 1,
              frames: [{ durationMs: 33, layers: [] }]
            }
          }
        }
      }
    }));

    game.openProjectBrowserFromTitle();
    return { savedName, savedPixel };
  });

  expect(setupResult.savedName).toBeTruthy();
  expect(setupResult.savedPixel).toBe('#ff0000');

  await page.getByRole('button', { name: 'Art' }).click();
  await page.locator('.project-browser-row', { hasText: setupResult.savedName }).getByRole('button', { name: 'Open' }).click();

  const reopenResult = await page.evaluate(async () => {
    const game = window.__game;
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (game.state === 'pixel-editor') {
          resolve();
          return;
        }
        if (Date.now() - started > 8000) {
          reject(new Error('Timed out entering pixel editor from project browser'));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
    return {
      reopenedPixel: game.pixelStudio?.activeLayer?.pixels?.[0] ?? 0,
      currentDocumentRef: game.pixelStudio?.currentDocumentRef || null
    };
  });

  expect(reopenResult.currentDocumentRef?.name).toBe(setupResult.savedName);
  expect(reopenResult.reopenedPixel >>> 0).toBe(((255 << 24) | 255) >>> 0);
});
