import test from 'node:test';
import assert from 'node:assert/strict';

import Title from '../../src/ui/Title.js';

function createMockContext() {
  const noop = () => {};
  return {
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
    fillText: noop,
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

function assertBoundsUsable(bounds, width, height, minHeight = 44) {
  assert.ok(bounds.x >= 0);
  assert.ok(bounds.y >= 0);
  assert.ok(bounds.x + bounds.w <= width);
  assert.ok(bounds.y + bounds.h <= height);
  assert.ok(bounds.h >= minHeight);
}

test('portrait title main menu uses large lower buttons with matching hit bounds', () => {
  const title = new Title();
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

test('portrait title main menu fits short mobile browser viewports', () => {
  for (const [width, height] of [[360, 480], [390, 520], [414, 560], [360, 620], [390, 640], [390, 700], [414, 896]]) {
    const title = new Title();
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
    'actor-editor',
    'back'
  ]);
  assert.deepEqual(title.controlsOrder, [
    'robtersession',
    'mobile',
    'gamepad',
    'keyboard',
    'display-sepia',
    'display-night-vision',
    'display-color',
    'back'
  ]);
});

test('portrait options screen fits input and display controls', () => {
  const title = new Title();
  title.screen = 'controls';
  title.draw(createMockContext(), 390, 844, 'mobile', { isMobile: true, displayMode: 'sepia' });

  title.controlsOrder.forEach((action) => {
    const bounds = title.controlsBounds.get(action);
    assertBoundsUsable(bounds, 390, 844);
    assert.equal(title.getActionAt(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2), action);
  });
});
