import { expect, test } from '@playwright/test';

test('Physics Surface benchmark measures real browser drawing separately from Node physics', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });
  const result = await page.evaluate(async () => {
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
    const car = editor.project.cars.find((candidate) => candidate.id === 'starter-rwd');
    editor.project.selectedCarId = car.id;
    editor.startPlaytest(car.id, { hydrateCars: false });
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.startupFramePending = false;
    editor.playtestSession.launchLockMs = 0;
    editor.setRacePhysicsSurfaceVisible(true);
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    const bounds = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    const drawSamples = [];
    for (let frame = 0; frame < 45; frame += 1) {
      editor.updatePlaytestSafely(1 / 60);
      const startedAt = performance.now();
      editor.drawRacePlaytestFrameSafely(ctx, bounds);
      drawSamples.push(performance.now() - startedAt);
    }
    const timerCountsBeforeDisable = Object.fromEntries(Object.entries(
      editor.playtestSession.physicsSurfaceDebugTimers || {}
    ).map(([name, samples]) => [name, samples.length]));
    editor.setRacePhysicsSurfaceVisible(false);
    for (let frame = 0; frame < 5; frame += 1) {
      editor.updatePlaytestSafely(1 / 60);
      editor.drawRacePlaytestFrameSafely(ctx, bounds);
    }
    const timerCountsAfterDisable = Object.fromEntries(Object.entries(
      editor.playtestSession.physicsSurfaceDebugTimers || {}
    ).map(([name, samples]) => [name, samples.length]));
    const ordered = [...drawSamples].sort((left, right) => left - right);
    const timers = Object.fromEntries(Object.keys(timerCountsBeforeDisable).map((name) => [
      name, editor.getRacePhysicsDebugTimerPercentile(name, 0.95)
    ]));
    return {
      authority: 'chromium-canvas-render',
      sampleCount: drawSamples.length,
      drawP95Ms: ordered[Math.floor(ordered.length * 0.95)],
      timers,
      timerCountsBeforeDisable,
      timerCountsAfterDisable
    };
  });
  expect(result.authority).toBe('chromium-canvas-render');
  expect(result.sampleCount).toBe(45);
  expect(Number.isFinite(result.drawP95Ms)).toBe(true);
  expect(Object.keys(result.timerCountsBeforeDisable).length).toBeGreaterThan(0);
  expect(result.timerCountsAfterDisable).toEqual(result.timerCountsBeforeDisable);
});
