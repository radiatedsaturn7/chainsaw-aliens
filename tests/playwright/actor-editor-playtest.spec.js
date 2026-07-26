import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

test('actor editor workflow renders a white-square custom actor in playtest', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    window.__game.enterActorEditor();
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    const whiteSquare = canvas.toDataURL('image/png');

    const actor = JSON.parse(JSON.stringify(window.__game.actorEditor.actor));
    actor.name = 'White Square';
    actor.gravity = false;
    actor.size = { width: 32, height: 32 };
    actor.states[0].animation = {
      imageDataUrl: whiteSquare,
      frames: [{ imageDataUrl: whiteSquare, durationMs: 120 }],
      fps: 8
    };
    window.__game.actorEditor.setActor(actor);
    window.__game.actorEditor.playtestActor();
  });

  await page.waitForFunction(() => window.__game.state === 'playing');
  await page.waitForFunction(() => window.__game.enemies.some((enemy) => String(enemy.type).startsWith('custom:')));

  const customActorType = await page.evaluate(() => (
    window.__game.enemies.find((enemy) => String(enemy.type).startsWith('custom:'))?.type || ''
  ));
  expect(customActorType).toMatch(/^custom:/);

  await page.screenshot({
    path: 'artifacts/actor-editor-white-square-playtest.png',
    fullPage: false
  });
});

test('level editor tiles persist after playtest round-trip', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    window.__game.enterEditor({ tab: 'tiles' });
  });
  await page.waitForFunction(() => window.__game.state === 'editor');

  const markerTile = await page.evaluate(() => {
    const marker = 'X';
    window.__game.world.setTile(12, 12, marker, { persist: true });
    return window.__game.world.getTile(12, 12);
  });
  expect(markerTile).toBe('X');

  await page.evaluate(() => {
    window.__game.exitEditor({ playtest: true });
  });
  await page.waitForFunction(() => window.__game.state === 'playing' && window.__game.playtestActive === true);

  await page.evaluate(() => {
    window.__game.returnToEditorFromPlaytest();
  });
  await page.waitForFunction(() => window.__game.state === 'editor' && window.__game.playtestActive === false);

  const tileAfterReturn = await page.evaluate(() => window.__game.world.getTile(12, 12));
  expect(tileAfterReturn).toBe('X');
});
