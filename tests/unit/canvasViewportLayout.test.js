import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBrowserViewportSize,
  getCanvasViewportLayout,
  getLandscapeHandheldLayout,
  getPortraitHandheldLayout,
  mapPortraitHandheldPoint,
  shouldShowMobileFullscreenButton
} from '../../src/ui/shared/canvasViewportLayout.js';

test('browser viewport size prefers visualViewport over stale window dimensions', () => {
  assert.deepEqual(getBrowserViewportSize({
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: {
      width: 375.4,
      height: 612.6
    }
  }), {
    width: 375,
    height: 613
  });
});

test('browser viewport size falls back to inner dimensions when visualViewport is unavailable', () => {
  assert.deepEqual(getBrowserViewportSize({
    innerWidth: 844.2,
    innerHeight: 390.4
  }), {
    width: 844,
    height: 390
  });
  assert.deepEqual(getBrowserViewportSize({
    innerWidth: 740.5,
    innerHeight: 320.2,
    visualViewport: {
      width: 0,
      height: NaN
    }
  }), {
    width: 741,
    height: 320
  });
});

test('browser viewport size clamps missing dimensions to defaults and at least one pixel', () => {
  assert.deepEqual(getBrowserViewportSize({}, {
    defaultWidth: 0,
    defaultHeight: -10
  }), {
    width: 1,
    height: 1
  });
});

test('mobile landscape canvas fills CSS viewport without aspect stretching', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430]]) {
    const layout = getCanvasViewportLayout({
      isMobile: true,
      viewportWidth: width,
      viewportHeight: height,
      defaultCanvasWidth: 960,
      defaultCanvasHeight: 540,
      devicePixelRatio: 2
    });

    assert.equal(layout.isLandscape, true);
    assert.equal(layout.isPortrait, false);
    assert.equal(layout.styleWidth, width);
    assert.equal(layout.styleHeight, height);
    assert.equal(layout.physicalViewportWidth, width);
    assert.equal(layout.physicalViewportHeight, height);
    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.equal(layout.logicalWidth, width);
    assert.equal(layout.logicalHeight, height);
    assert.equal(layout.targetCanvasWidth, width * 2);
    assert.equal(layout.targetCanvasHeight, height * 2);
    assert.equal(layout.scale, 1);
    assert.equal(layout.dpr, 2);
  }
});

test('mobile portrait keeps viewport-sized DPR-backed canvas', () => {
  const layout = getCanvasViewportLayout({
    isMobile: true,
    viewportWidth: 390,
    viewportHeight: 844,
    defaultCanvasWidth: 960,
    defaultCanvasHeight: 540,
    devicePixelRatio: 4
  });

  assert.equal(layout.isPortrait, true);
  assert.equal(layout.styleWidth, 390);
  assert.equal(layout.styleHeight, 844);
  assert.equal(layout.viewportWidth, 390);
  assert.equal(layout.viewportHeight, 844);
  assert.equal(layout.logicalWidth, 390);
  assert.equal(layout.logicalHeight, 844);
  assert.equal(layout.targetCanvasWidth, 1170);
  assert.equal(layout.targetCanvasHeight, 2532);
  assert.equal(layout.dpr, 3);
  assert.equal(layout.scale, 1);
});

test('desktop canvas fills viewport without fit scaling', () => {
  for (const [width, height] of [[1280, 720], [1920, 1080], [1440, 900]]) {
    const layout = getCanvasViewportLayout({
      isMobile: false,
      viewportWidth: width,
      viewportHeight: height,
      defaultCanvasWidth: 960,
      defaultCanvasHeight: 540,
      devicePixelRatio: 2
    });

    assert.equal(layout.styleWidth, width);
    assert.equal(layout.styleHeight, height);
    assert.equal(layout.viewportWidth, width);
    assert.equal(layout.viewportHeight, height);
    assert.equal(layout.logicalWidth, width);
    assert.equal(layout.logicalHeight, height);
    assert.equal(layout.targetCanvasWidth, width);
    assert.equal(layout.targetCanvasHeight, height);
    assert.equal(layout.dpr, 1);
    assert.equal(layout.scale, 1);
  }
});

test('portrait handheld layout reserves top screen and bottom controls deck', () => {
  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const layout = getPortraitHandheldLayout(width, height);

    assert.ok(layout.screen.y >= 0);
    assert.ok(layout.screen.y + layout.screen.h <= height / 2);
    assert.ok(layout.controlsDeck.y >= height / 2);
    assert.ok(layout.controlsDeck.y + layout.controlsDeck.h <= height);
    assert.deepEqual(layout.renderViewport, { w: 960, h: 540 });
    assert.ok(Math.abs((layout.screen.w / layout.screen.h) - (16 / 9)) < 0.03);
    assert.ok(layout.screen.w <= layout.screenSlot.w);
    assert.ok(layout.screen.h <= layout.screenSlot.h);
    assert.ok(layout.controlsDeck.h >= 300);
    assert.ok(layout.dpad.w >= 96);
    assert.ok(layout.buttons.a.r >= 32);
    assert.ok(layout.dpad.y + layout.dpad.h / 2 > layout.controlsDeck.y + layout.controlsDeck.h * 0.26);
    assert.ok(layout.dpad.y + layout.dpad.h / 2 < layout.controlsDeck.y + layout.controlsDeck.h * 0.38);
    assert.ok(layout.buttons.a.y < layout.controlsDeck.y + layout.controlsDeck.h * 0.34);
    assert.ok(layout.buttons.jump.y > layout.controlsDeck.y + layout.controlsDeck.h * 0.34);
    assert.ok(layout.buttons.jump.y < layout.controlsDeck.y + layout.controlsDeck.h * 0.48);
    assert.ok(layout.buttons.a.y < layout.buttons.jump.y - layout.buttons.jump.r);
    assert.ok(layout.start.y > layout.controlsDeck.y + layout.controlsDeck.h * 0.82);
    assert.ok(layout.select.y > layout.controlsDeck.y + layout.controlsDeck.h * 0.82);
    assert.equal(layout.speakerSlots.length, 7);
    layout.speakerSlots.forEach((slot) => {
      assert.ok(slot.w >= 5);
      assert.ok(slot.h >= 42);
      assert.ok(slot.x > layout.controlsDeck.x + layout.controlsDeck.w * 0.7);
      assert.ok(slot.y > layout.controlsDeck.y + layout.controlsDeck.h * 0.78);
      assert.ok(slot.x > layout.start.x + layout.start.w);
      assert.ok(slot.x > layout.select.x + layout.select.w);
      assert.ok(slot.y > layout.buttons.a.y + layout.buttons.a.r);
      assert.ok(slot.y > layout.buttons.jump.y + layout.buttons.jump.r);
    });
  }
});

test('portrait handheld maps screen points to landscape gameplay viewport', () => {
  const layout = getPortraitHandheldLayout(390, 844);
  const center = mapPortraitHandheldPoint(layout, layout.screen.x + layout.screen.w / 2, layout.screen.y + layout.screen.h / 2);
  const topLeft = mapPortraitHandheldPoint(layout, layout.screen.x, layout.screen.y);
  const bottomRight = mapPortraitHandheldPoint(layout, layout.screen.x + layout.screen.w, layout.screen.y + layout.screen.h);

  assert.equal(Math.round(center.x), 480);
  assert.equal(Math.round(center.y), 270);
  assert.equal(Math.round(topLeft.x), 0);
  assert.equal(Math.round(topLeft.y), 0);
  assert.equal(Math.round(bottomRight.x), 960);
  assert.equal(Math.round(bottomRight.y), 540);
});

test('landscape handheld layout keeps controls outside gameplay screen', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430], [960, 540]]) {
    const layout = getLandscapeHandheldLayout(width, height);

    assert.deepEqual(layout.renderViewport, { w: 960, h: 540 });
    assert.ok(Math.abs((layout.screen.w / layout.screen.h) - (16 / 9)) < 0.03);
    assert.ok(layout.leftRail.x + layout.leftRail.w < layout.screen.x);
    assert.ok(layout.screen.x + layout.screen.w < layout.rightRail.x);
    assert.ok(layout.dpad.w >= 116);
    assert.ok(layout.dpad.x + layout.dpad.w <= layout.leftRail.x + layout.leftRail.w);
    assert.ok(layout.dpad.y + layout.dpad.h / 2 > layout.leftRail.y + layout.leftRail.h * 0.52);
    assert.ok(layout.dpad.y + layout.dpad.h / 2 < layout.leftRail.y + layout.leftRail.h * 0.6);
    assert.ok(layout.buttons.a.r >= 36);
    assert.ok(layout.buttons.a.x - layout.buttons.a.r >= layout.rightRail.x);
    assert.ok(layout.buttons.jump.x + layout.buttons.jump.r <= layout.rightRail.x + layout.rightRail.w);
    assert.ok(Math.hypot(layout.buttons.a.x - layout.buttons.jump.x, layout.buttons.a.y - layout.buttons.jump.y) >= layout.buttons.a.r * 3.1);
    assert.ok(layout.buttons.a.y > layout.rightRail.y + layout.rightRail.h * 0.28);
    assert.ok(layout.buttons.jump.y > layout.rightRail.y + layout.rightRail.h * 0.55);
    assert.ok(layout.select.x >= layout.leftRail.x);
    assert.ok(layout.select.x + layout.select.w <= layout.leftRail.x + layout.leftRail.w);
    assert.ok(layout.start.x >= layout.rightRail.x);
    assert.ok(layout.start.x + layout.start.w <= layout.rightRail.x + layout.rightRail.w);
    assert.ok(layout.start.y >= layout.rightRail.y + 28);
    assert.ok(layout.select.y >= layout.leftRail.y + 28);
    assert.ok(layout.start.y <= layout.rightRail.y + 32);
    assert.ok(layout.select.y <= layout.leftRail.y + 32);
    assert.ok(layout.start.y < layout.screen.y + layout.screen.h * 0.28);
    assert.ok(layout.select.y < layout.screen.y + layout.screen.h * 0.28);
    assert.ok(layout.start.y + layout.start.h < layout.buttons.a.y - layout.buttons.a.r);
  }
});

test('mobile fullscreen button is limited to title main menu', () => {
  assert.equal(shouldShowMobileFullscreenButton({
    isMobile: true,
    gameState: 'title',
    titleScreen: 'main'
  }), true);
  assert.equal(shouldShowMobileFullscreenButton({
    isMobile: true,
    gameState: 'title',
    titleScreen: ''
  }), true);
  assert.equal(shouldShowMobileFullscreenButton({
    isMobile: true,
    gameState: 'title',
    titleScreen: 'tools'
  }), false);
  assert.equal(shouldShowMobileFullscreenButton({
    isMobile: true,
    gameState: 'playing',
    titleScreen: 'main'
  }), false);
  assert.equal(shouldShowMobileFullscreenButton({
    isMobile: true,
    isFullscreen: true,
    gameState: 'title',
    titleScreen: 'main'
  }), false);
  assert.equal(shouldShowMobileFullscreenButton({
    isMobile: false,
    gameState: 'title',
    titleScreen: 'main'
  }), false);
});
