import { expect, test } from '@playwright/test';

test('app boots in Chromium and exposes the game runtime', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });

  await expect.poll(async () => page.evaluate(() => Boolean(window.__gameReady && window.__game)), {
    timeout: 60_000
  }).toBe(true);

  const state = await page.evaluate(() => window.__game?.state || null);
  expect(state).not.toBe('loading');
});
