import { test, expect } from '@playwright/test';

test('saved P1 loads through travel worker, artwork transfer and first rendered frames', async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('BROWSER', message.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.__gameReady, null, { timeout: 60000 });
  const result = await page.evaluate(async () => {
    const game = window.__game;
    const messages = [];
    const toast = game.showSystemToast.bind(game);
    game.showSystemToast = message => { messages.push(message); toast(message); };
    const started = await game.startRaceTravel({ raceName: 'p1', carSelection: 'specific', carRef: 'RTG-001' });
    return { started, messages, status: game.raceEditor.status,
      diagnostics: game.raceRuntimePreparation?.lastDiagnostics,
      phase: game.raceEditor.racePlaytestPreparation?.phase };
  });
  console.log('P1_START', JSON.stringify(result));
  expect(result.started, JSON.stringify(result)).toBe(true);
  await page.waitForFunction(() => {
    const session = window.__game.raceEditor.playtestSession;
    return session?.running && !session.startupFramePending && session.elapsedMs > 2000;
  }, null, { timeout: 90000 });
  await page.screenshot({ path: 'test-results/p1-running.png' });
  console.log('P1_RUNNING', await page.evaluate(() => ({ state: window.__game.state,
    elapsed: window.__game.raceEditor.playtestSession?.elapsedMs,
    diagnostics: window.__game.raceRuntimePreparation?.lastDiagnostics })));
  expect(errors).toEqual([]);
});
