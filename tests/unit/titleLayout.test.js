import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import Title from '../../src/ui/Title.js';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');

function createMockContext() {
  const text = [];
  const noop = () => {};
  return {
    text,
    save: noop,
    restore: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    arc: noop,
    ellipse: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    translate: noop,
    fillText: (value, x, y) => text.push({ value, x, y }),
    createRadialGradient: () => ({ addColorStop: noop }),
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; },
    set globalAlpha(value) { this._globalAlpha = value; },
    get globalAlpha() { return this._globalAlpha; }
  };
}

function markMainMenuReady(title) {
  title.mainMenuReady = true;
}

function assertBoundsUsable(bounds, width, height, minHeight = 44) {
  assert.ok(bounds.x >= 0);
  assert.ok(bounds.y >= 0);
  assert.ok(bounds.x + bounds.w <= width);
  assert.ok(bounds.y + bounds.h <= height);
  assert.ok(bounds.h >= minHeight);
}

test('portrait title main menu uses large lower buttons with matching hit bounds', () => {
  const title = new Title();
  markMainMenuReady(title);
  title.screen = 'main';
  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true });

  const first = title.menuBounds.get('recent-level');
  const last = title.menuBounds.get('options');
  assertBoundsUsable(first, 390, 844);
  assertBoundsUsable(last, 390, 844);
  assert.ok(first.y > 250);
  assert.equal(title.getActionAt(first.x + first.w / 2, first.y + first.h / 2), 'recent-level');
  assert.equal(title.getActionAt(last.x + last.w / 2, last.y + last.h / 2), 'options');
});

test('main menu shows RTG Studio loading splash until buttons are ready', () => {
  const title = new Title();
  const ctx = createMockContext();
  title.screen = 'main';
  title.draw(ctx, 390, 844, 'mobile', { isMobile: true, mainMenuReady: false });

  assert.equal(ctx.text.some((entry) => entry.value === 'RTG Studio'), true);
  assert.equal(ctx.text.some((entry) => entry.value === 'Loading...'), true);
  assert.equal(title.getSelectedAction(), null);
  assert.equal(title.getActionAt(195, 560), null);

  title.update(5);
  assert.equal(title.getSelectedAction(), null);

  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true, mainMenuReady: true });
  const first = title.menuBounds.get('recent-level');
  assert.equal(title.getActionAt(first.x + first.w / 2, first.y + first.h / 2), 'recent-level');
});

test('game folder includes doodad editor', () => {
  const title = new Title();
  assert.equal(title.folderOrders.game.includes('doodad-editor'), true);
  title.screen = 'game';
  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true });
  assert.equal(title.getSelectedAction(), 'level-editor');
  assert.equal(title.folderBounds.game.has('doodad-editor'), true);
});

test('canvas mouse click is suppressed after pointer-down navigation changes screens', () => {
  assert.equal(mainSource.includes('let suppressNextCanvasClick = false;'), true);
  assert.equal(mainSource.includes('function isGlobalOverlayOpen()'), true);
  assert.equal(mainSource.includes('const stateBefore = game.state;'), true);
  assert.equal(mainSource.includes('const titleScreenBefore = game.title?.screen;'), true);
  assert.equal(mainSource.includes('const overlayOpenBefore = isGlobalOverlayOpen();'), true);
  assert.equal(mainSource.includes('|| isGlobalOverlayOpen() !== overlayOpenBefore'), true);
  assert.equal(mainSource.includes('if (isGlobalOverlayOpen()) {'), true);
});

test('canvas context menu suppression follows the shared editor pointer policy', () => {
  assert.equal(mainSource.includes('shouldSuppressEditorContextMenu'), true);
  assert.equal(mainSource.includes('const CANVAS_EDITOR_IDS_BY_STATE = {'), true);
  assert.equal(mainSource.includes("editor: 'level'"), true);
  assert.equal(mainSource.includes("'race-editor': 'race'"), true);
  assert.equal(mainSource.includes("'car-editor': 'car'"), true);
  assert.equal(mainSource.includes("addDOMListener(canvas, 'contextmenu'"), true);
  assert.equal(mainSource.includes('event.preventDefault();\n  }));'), false);
});

test('portrait title main menu fits short mobile browser viewports', () => {
  for (const [width, height] of [[360, 480], [390, 520], [414, 560], [360, 620], [390, 640], [390, 700], [414, 896]]) {
    const title = new Title();
    markMainMenuReady(title);
    title.screen = 'main';
    title.draw(createMockContext(), width, height, 'mobile', { isMobile: true });

    title.menuOrder.forEach((action) => {
      const bounds = title.menuBounds.get(action);
      assertBoundsUsable(bounds, width, height);
      assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
    });
  }
});

test('landscape title main menu fits short mobile browser viewports before fullscreen', () => {
  for (const [width, height] of [[640, 300], [740, 320], [844, 340], [740, 360], [844, 390], [932, 430]]) {
    const title = new Title();
    markMainMenuReady(title);
    title.screen = 'main';
    title.draw(createMockContext(), width, height, 'mobile', { isMobile: true });

    title.menuOrder.forEach((action) => {
      const bounds = title.menuBounds.get(action);
      assertBoundsUsable(bounds, width, height, 24);
      assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
    });
  }
});

test('portrait folder screens keep all buttons visible and tappable', () => {
  for (const folder of ['graphics', 'audio', 'game']) {
    const title = new Title();
    title.screen = folder;
    title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true });

    title.folderOrders[folder].forEach((action) => {
      const bounds = title.folderBounds[folder].get(action);
      assertBoundsUsable(bounds, 390, 844);
      assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
    });
  }
});

test('landscape title bounds remain visible and match pointer hit testing', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430]]) {
    const title = new Title();
    markMainMenuReady(title);
    title.screen = 'main';
    title.draw(createMockContext(), width, height, 'mobile', { isMobile: true });

    title.menuOrder.forEach((action) => {
      const bounds = title.menuBounds.get(action);
      assertBoundsUsable(bounds, width, height, 24);
      assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
    });
  }
});

test('landscape folder bounds fit short mobile viewports', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430]]) {
    for (const folder of ['graphics', 'audio', 'game']) {
      const title = new Title();
      title.screen = folder;
      title.draw(createMockContext(), width, height, 'mobile', { isMobile: true });

      title.folderOrders[folder].forEach((action) => {
        const bounds = title.folderBounds[folder].get(action);
        assertBoundsUsable(bounds, width, height, 24);
        assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
      });
    }
  }
});

test('controller selection order matches studio launcher hierarchy', () => {
  const title = new Title();
  markMainMenuReady(title);
  assert.equal(title.screen, 'main');
  assert.deepEqual(title.menuOrder, ['recent-level', 'graphics', 'audio', 'game', 'options']);
  assert.deepEqual(title.folderOrders.graphics, [
    'pixel-editor',
    'cutscene-editor',
    'back'
  ]);
  assert.deepEqual(title.folderOrders.audio, [
    'midi-editor',
    'sfx-editor',
    'back'
  ]);
  assert.deepEqual(title.folderOrders.game, [
    'level-editor',
    'tile-editor',
    'race-editor',
    'car-editor',
    'doodad-editor',
    'actor-editor',
    'back'
  ]);
  assert.deepEqual(title.optionsOrder, [
    'latest-changes',
    'robtersession',
    'controls',
    'display',
    'back'
  ]);
  assert.deepEqual(title.controlsOrder, [
    'mobile',
    'gamepad',
    'keyboard',
    'back'
  ]);
  assert.deepEqual(title.displayOrder, [
    'display-sepia',
    'display-night-vision',
    'display-color',
    'back'
  ]);
});

test('portrait options screen fits submenus', () => {
  const title = new Title();
  title.screen = 'options';
  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true, displayMode: 'sepia' });

  title.optionsOrder.forEach((action) => {
    const bounds = title.optionsBounds.get(action);
    assertBoundsUsable(bounds, 390, 844);
    assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
  });
});

test('portrait controls screen fits input controls', () => {
  const title = new Title();
  title.screen = 'controls';
  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true, displayMode: 'sepia' });

  title.controlsOrder.forEach((action) => {
    const bounds = title.controlsBounds.get(action);
    assertBoundsUsable(bounds, 390, 844);
    assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
  });
});

test('portrait display screen fits display controls', () => {
  const title = new Title();
  title.screen = 'display';
  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true, displayMode: 'sepia' });

  title.displayOrder.forEach((action) => {
    const bounds = title.displayBounds.get(action);
    assertBoundsUsable(bounds, 390, 844);
    assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
  });
});
