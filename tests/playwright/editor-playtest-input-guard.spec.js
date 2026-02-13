import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
}

test('editor playtest round-trip keeps input working and avoids listener duplication', async ({ page }) => {
  await waitForGameReady(page);

  await page.evaluate(() => {
    const probe = {
      adds: 0,
      active: 0,
      maxActive: 0,
      trackedHandlers: new WeakSet()
    };

    const originalAdd = window.addEventListener.bind(window);
    const originalRemove = window.removeEventListener.bind(window);
    const isEditorGuardListener = (type, handler) => type === 'keydown'
      && typeof handler === 'function'
      && handler.toString().includes("codes = ['KeyS', 'KeyL', 'KeyZ', 'KeyY', 'KeyP']");

    window.addEventListener = (type, handler, options) => {
      if (isEditorGuardListener(type, handler) && !probe.trackedHandlers.has(handler)) {
        probe.trackedHandlers.add(handler);
        probe.adds += 1;
        probe.active += 1;
        probe.maxActive = Math.max(probe.maxActive, probe.active);
      }
      return originalAdd(type, handler, options);
    };

    window.removeEventListener = (type, handler, options) => {
      if (isEditorGuardListener(type, handler) && probe.trackedHandlers.has(handler)) {
        probe.trackedHandlers.delete(handler);
        probe.active = Math.max(0, probe.active - 1);
      }
      return originalRemove(type, handler, options);
    };

    window.__editorListenerProbe = {
      getSnapshot: () => ({
        adds: probe.adds,
        active: probe.active,
        maxActive: probe.maxActive
      }),
      cleanup: () => {
        window.addEventListener = originalAdd;
        window.removeEventListener = originalRemove;
      }
    };
  });

  await page.evaluate(() => window.__game.enterEditor());
  await page.waitForFunction(() => window.__game.state === 'editor');

  await page.evaluate(() => window.__game.exitEditor({ playtest: true }));
  await page.waitForFunction(() => window.__game.state === 'playing' && window.__game.playtestActive === true);

  await page.evaluate(() => window.__game.returnToEditorFromPlaytest());
  await page.waitForFunction(() => window.__game.state === 'editor' && window.__game.playtestActive === false);

  const beforeX = await page.evaluate(() => window.__game.editor.camera.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(140);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(50);
  const afterX = await page.evaluate(() => window.__game.editor.camera.x);
  expect(afterX).toBeGreaterThan(beforeX);

  const listenerSnapshot = await page.evaluate(() => window.__editorListenerProbe.getSnapshot());
  expect(listenerSnapshot.adds).toBe(2);
  expect(listenerSnapshot.maxActive).toBe(2);
  expect(listenerSnapshot.active).toBe(2);

  const editorBindingState = await page.evaluate(() => ({
    globalListenersBound: window.__game.editor.globalListenersBound,
    hasListenerDisposer: Boolean(window.__game.editor.listenerDisposer)
  }));
  expect(editorBindingState.globalListenersBound).toBeTruthy();
  expect(editorBindingState.hasListenerDisposer).toBeTruthy();

  await page.evaluate(() => {
    window.__editorListenerProbe.cleanup();
  });
});
