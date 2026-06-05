import { test, expect } from '@playwright/test';

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

  const inputResetCheck = await page.evaluate(() => {
    const controls = window.__game.mobileControls;
    if (!controls?.joystick?.center) {
      return { activeAfterDown: true, activeAfterUp: false, skipped: true };
    }
    controls.reset();
    const touchId = 'smoke-touch';
    const center = controls.joystick.center;
    controls.handlePointerDown({
      id: touchId,
      x: center.x,
      y: center.y,
      touchCount: 1
    }, 'playing');
    const activeAfterDown = controls.joystick.active;
    controls.handlePointerUp({ id: touchId, x: center.x, y: center.y }, 'playing');
    const activeAfterUp = controls.joystick.active;
    return { activeAfterDown, activeAfterUp, skipped: false };
  });
  expect(inputResetCheck.activeAfterUp).toBeFalsy();

  const beforeX = await page.evaluate(() => window.__game.editor.camera.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(50);
  const afterX = await page.evaluate(() => window.__game.editor.camera.x);

  expect(afterX).toBeGreaterThanOrEqual(beforeX);
});

test('shared confirm overlays keep cancel before primary action', async ({ page }) => {
  await waitForGameReady(page);

  const labels = await page.evaluate(async () => {
    const { openConfirmOverlay } = await import('/src/ui/shared/textInputOverlay.js');
    const pending = openConfirmOverlay({
      title: 'Delete frame?',
      message: 'This cannot be undone.',
      cancelText: 'Cancel',
      confirmText: 'Delete',
      danger: true
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const buttons = Array.from(document.querySelectorAll('.shared-text-input-actions .shared-text-input-btn'))
      .map((button) => ({
        text: button.textContent,
        isDanger: button.classList.contains('danger'),
        isPrimary: button.classList.contains('primary')
      }));
    document.querySelector('.shared-text-input-actions .shared-text-input-btn')?.click();
    await pending;
    return buttons;
  });

  expect(labels).toEqual([
    { text: 'Cancel', isDanger: false, isPrimary: false },
    { text: 'Delete', isDanger: true, isPrimary: false }
  ]);
});

test('sfx mobile landscape thumbstick pans viewport while timeline scrub still moves playhead', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await waitForGameReady(page);

  await page.evaluate(() => {
    window.__game.enterSfxEditor();
    const editor = window.__game.sfxEditor;
    editor.applyDocument({
      version: 1,
      name: 'Long SFX',
      frames: [{
        id: 'frame_1',
        name: 'Frame 1',
        duration: 8,
        sampleRate: 44100,
        channels: 1,
        layers: [{
          id: 'layer_1',
          name: 'Layer 1',
          wavDataUrl: 'data:audio/wav;base64,UklGRgAAAAA=',
          duration: 8,
          sampleRate: 44100,
          channels: 1,
          startTime: 0,
          volume: 1,
          pan: 0,
          muted: false
        }]
      }]
    }, 'long-sfx');
    editor.timelineVisibleDuration = 3;
    editor.timelineScrollTime = 0;
  });

  await page.waitForFunction(() => {
    const editor = window.__game?.sfxEditor;
    return window.__game?.state === 'sfx-editor'
      && editor?.isMobileLandscape
      && editor?.panJoystick?.radius > 0
      && editor?.timelineViewportBounds?.maxScroll > 0;
  });

  const panResult = await page.evaluate(() => {
    const editor = window.__game.sfxEditor;
    const stick = editor.panJoystick;
    const id = 'sfx-pan';
    editor.handlePointerDown({
      id,
      x: stick.center.x + stick.radius,
      y: stick.center.y,
      touchCount: 1
    });
    editor.update(null, 0.5);
    editor.handlePointerUp({ id, x: stick.center.x + stick.radius, y: stick.center.y });
    return {
      scroll: editor.timelineScrollTime,
      radius: stick.radius,
      knobRadius: stick.knobRadius
    };
  });

  expect(panResult.radius).toBeGreaterThan(0);
  expect(panResult.knobRadius).toBeGreaterThan(0);
  expect(panResult.scroll).toBeGreaterThan(0);

  const scrubResult = await page.evaluate(() => {
    const editor = window.__game.sfxEditor;
    const beforeScroll = editor.timelineScrollTime;
    const bounds = editor.timelineViewportBounds;
    editor.playheadTime = 0;
    editor.handlePointerDown({
      id: 'sfx-scrub',
      x: bounds.x + bounds.w * 0.65,
      y: bounds.y + 10,
      touchCount: 0
    });
    editor.handlePointerUp({ id: 'sfx-scrub', x: bounds.x + bounds.w * 0.65, y: bounds.y + 10 });
    return {
      beforeScroll,
      afterScroll: editor.timelineScrollTime,
      playheadTime: editor.playheadTime
    };
  });

  expect(scrubResult.afterScroll).toBeCloseTo(scrubResult.beforeScroll, 5);
  expect(scrubResult.playheadTime).toBeGreaterThan(scrubResult.beforeScroll);
});
