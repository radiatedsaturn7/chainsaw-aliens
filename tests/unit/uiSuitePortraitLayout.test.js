import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSharedMobileDrawerWidth,
  getSharedMobileLandscapeEditorLayout,
  getSharedMobilePortraitEditorLayout,
  getSharedMobileRailWidth,
  getSharedPortraitActionRailLayout,
  getSharedPortraitMultiRowTabLayout,
  getSharedPortraitMenuMetrics,
  drawSharedContextRibbon,
  drawSharedPortraitScrollHints,
  buildSharedEditorFileMenu,
  isMobileLandscapeLayout,
  isMobilePortraitLayout,
  renderSharedFileDrawer,
  resetSharedThumbstickState,
  splitFileDrawerStickyExitItems
} from '../../src/ui/uiSuite.js';

function createNoopContext() {
  const rects = [];
  return {
    rects,
    save() {},
    restore() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }); },
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillText() {},
    measureText(value) { return { width: String(value || '').length * 7 }; },
    set globalAlpha(value) { this._globalAlpha = value; },
    get globalAlpha() { return this._globalAlpha ?? 1; },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; }
  };
}

test('shared mobile portrait layout exposes stable editor regions', () => {
  for (const [width, height] of [[390, 844], [414, 896], [360, 740], [430, 932]]) {
    const layout = getSharedMobilePortraitEditorLayout(width, height);
    assert.equal(layout.isPortrait, true);
    assert.deepEqual(layout.leftRail, layout.rootRail);
    assert.deepEqual(layout.rightRail, layout.subRail);
    assert.deepEqual(layout.middleRail, layout.actionRail);
    assert.deepEqual(layout.mainEditor, layout.workSurface);
    assert.deepEqual(layout.bottomRail, layout.actionRail);
    assert.deepEqual(layout.rootTabs, layout.rootRail);
    assert.deepEqual(layout.sheetContent, layout.subRail);
    assert.equal(layout.menuPanel.w, layout.rootRail.w);
    assert.equal(layout.menuPanel.w, layout.subRail.w);
    assert.ok(layout.rootRail.y > layout.subRail.y);
    assert.ok(layout.menuSheet.y >= layout.workSurface.y);
    assert.ok(layout.menuSheet.y + layout.menuSheet.h <= layout.actionRail.y - layout.gap);
    assert.ok(layout.menuSheet.h >= Math.floor(height * 0.62));
    assert.ok(layout.menuSheet.h > layout.rootRail.h);
    assert.ok(layout.rootRail.h >= 44);
    assert.ok(layout.rootRail.y + layout.rootRail.h <= layout.menuSheet.y + layout.menuSheet.h);
    assert.ok(layout.rootRail.y >= layout.menuSheet.y + layout.menuSheet.h - layout.rootRail.h);
    assert.ok(layout.subRail.h >= 150);
    assert.ok(layout.subRail.y >= layout.menuSheet.y);
    assert.ok(layout.subRail.y + layout.subRail.h <= layout.rootRail.y - layout.gap);
    assert.ok(layout.actionRail.h >= 72);
    assert.ok(layout.actionRail.h <= 96);
    assert.ok(layout.workSurface.h >= 560 || layout.workSurfaceRatio >= 0.68);
    assert.ok(layout.workSurface.y < layout.actionRail.y);
    assert.ok(layout.workSurface.y + layout.workSurface.h <= layout.actionRail.y);
    assert.ok(layout.actionRail.y + layout.actionRail.h <= height);
  }
});

test('shared portrait multi-row tabs can align to the bottom of a rail', () => {
  const bounds = { x: 10, y: 100, w: 220, h: 120 };
  const tabs = ['file', 'draw', 'layers', 'frames'].map((id) => ({ id, label: id }));
  const layout = getSharedPortraitMultiRowTabLayout(bounds, tabs, {
    rowHeight: 36,
    gap: 6,
    padding: 8,
    minButtonWidth: 70,
    maxRows: 2,
    verticalAlign: 'bottom'
  });
  const bottomY = Math.max(...layout.buttons.map((button) => button.bounds.y + button.bounds.h));

  assert.equal(layout.rows, 2);
  assert.equal(bottomY, bounds.y + bounds.h - 8);
});

test('shared editor file menu exposes consistent action aliases', () => {
  const calls = [];
  const items = buildSharedEditorFileMenu({
    actions: {
      new: () => calls.push('new'),
      save: () => calls.push('save')
    },
    extras: [
      { id: 'custom-onclick', label: 'Custom OnClick', onClick: () => calls.push('custom-onclick') },
      { id: 'custom-action', label: 'Custom Action', action: () => calls.push('custom-action') }
    ],
    footer: {
      onClose: () => calls.push('close'),
      onExit: () => calls.push('exit')
    }
  });

  const byId = Object.fromEntries(items.filter((item) => item.id).map((item) => [item.id, item]));
  assert.deepEqual(items.slice(0, 6).map((item) => item.id), [
    'new',
    'save',
    'save-as',
    'open',
    'export',
    'import'
  ]);
  assert.equal(items.some((item) => item.id === 'undo'), false);
  assert.equal(items.some((item) => item.id === 'redo'), false);
  assert.equal(byId.new.action, byId.new.onClick);
  assert.equal(byId.save.action, byId.save.onClick);
  assert.equal(byId['custom-onclick'].action, byId['custom-onclick'].onClick);
  assert.equal(byId['custom-action'].action, byId['custom-action'].onClick);
  assert.equal(byId['close-menu'].action, byId['close-menu'].onClick);
  assert.equal(byId['exit-main'].action, byId['exit-main'].onClick);

  byId.new.action();
  byId.save.onClick();
  byId['custom-onclick'].action();
  byId['custom-action'].onClick();
  byId['close-menu'].action();
  byId['exit-main'].onClick();
  assert.deepEqual(calls, ['new', 'save', 'custom-onclick', 'custom-action', 'close', 'exit']);
});

test('shared mobile portrait layout honors custom bottom rail cap', () => {
  const layout = getSharedMobilePortraitEditorLayout(430, 932, {
    middleRailHeight: 140,
    maxBottomRailHeight: 88
  });
  assert.equal(layout.bottomRail.h, 88);
  assert.ok(layout.workSurfaceRatio >= 0.78);
});

test('shared portrait action rail reserves bottom-left thumbstick and right action area', () => {
  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const layout = getSharedMobilePortraitEditorLayout(width, height);
    const controls = getSharedPortraitActionRailLayout(layout.middleRail);

    assert.ok(controls.thumbstickBounds.x >= layout.middleRail.x);
    assert.ok(controls.thumbstickBounds.y >= layout.middleRail.y);
    assert.ok(controls.thumbstickBounds.x + controls.thumbstickBounds.w <= layout.middleRail.x + layout.middleRail.w);
    assert.ok(controls.thumbstickBounds.y + controls.thumbstickBounds.h <= layout.middleRail.y + layout.middleRail.h);
    assert.equal(controls.thumbstickCenter.x, controls.thumbstickBounds.x + controls.thumbstickBounds.w / 2);
    assert.equal(controls.thumbstickCenter.y, controls.thumbstickBounds.y + controls.thumbstickBounds.h / 2);
    assert.ok(controls.thumbstickRadius > 0);
    assert.ok(controls.actionArea.x > controls.thumbstickBounds.x + controls.thumbstickBounds.w);
    assert.ok(controls.actionArea.w >= 220);
    assert.ok(layout.menuSheet.y + layout.menuSheet.h <= layout.middleRail.y - layout.gap);
  }
});

test('shared portrait menu metrics keep rows scrollable', () => {
  const metrics = getSharedPortraitMenuMetrics({ x: 8, y: 8, w: 183, h: 230 }, {
    rowHeight: 44,
    rowGap: 8
  });
  assert.ok(metrics.visibleRows >= 3);
  assert.ok(metrics.visibleRows < 8);
  assert.equal(metrics.listBounds.x, 16);
  assert.equal(metrics.listBounds.y, 16);
});

test('shared portrait scroll hints draw a scrollbar track and thumb', () => {
  const ctx = createNoopContext();
  const result = drawSharedPortraitScrollHints(ctx, { x: 10, y: 20, w: 200, h: 300 }, {
    scroll: 5,
    scrollMax: 10
  });

  assert.ok(result.track);
  assert.ok(result.thumb);
  assert.equal(ctx.rects.length, 2);
  assert.ok(result.thumb.h >= 24);
  assert.ok(result.thumb.y > result.track.y);
  assert.ok(result.thumb.y + result.thumb.h <= result.track.y + result.track.h);
});

test('shared context ribbon lays out visible actions and skips hidden actions', () => {
  const ctx = createNoopContext();
  const registered = [];
  const result = drawSharedContextRibbon(ctx, { x: 0, y: 0, w: 360, h: 56 }, [
    { id: 'copy', label: 'Copy' },
    { id: 'delete', label: 'Delete' },
    { id: 'hidden', label: 'Hidden', hidden: true }
  ], {
    title: 'Selection',
    registerAction: (bounds, action) => registered.push({ bounds, action })
  });

  assert.deepEqual(result.buttons.map((button) => button.id), ['copy', 'delete']);
  assert.deepEqual(registered.map((entry) => entry.action.id), ['copy', 'delete']);
  assert.ok(result.buttons[1].bounds.x > result.buttons[0].bounds.x);
});

test('mobile portrait detection requires a mobile viewport', () => {
  assert.equal(isMobilePortraitLayout({ isMobile: true, viewportWidth: 390, viewportHeight: 844 }), true);
  assert.equal(isMobilePortraitLayout({ isMobile: false, viewportWidth: 390, viewportHeight: 844 }), false);
  assert.equal(isMobilePortraitLayout({ isMobile: true, viewportWidth: 844, viewportHeight: 390 }), false);
});

test('mobile landscape rails leave room for a visible right drawer', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430], [960, 540]]) {
    assert.equal(isMobileLandscapeLayout({ isMobile: true, viewportWidth: width, viewportHeight: height }), true);
    const railWidth = getSharedMobileRailWidth(width, height);
    const drawerWidth = getSharedMobileDrawerWidth(width, height, railWidth, { edgePadding: 0 });
    const editorWidth = width - railWidth - drawerWidth;
    assert.ok(railWidth >= 120);
    assert.ok(drawerWidth >= 220);
    assert.ok(drawerWidth <= width - railWidth);
    assert.ok(editorWidth >= 260);
  }
});

test('shared mobile landscape editor layout reserves thumbstick outside menu rails', () => {
  for (const [width, height] of [[740, 360], [844, 390], [932, 430]]) {
    const layout = getSharedMobileLandscapeEditorLayout(width, height, {
      bottomRailHeight: 96
    });

    assert.ok(layout.leftRail.x >= 0);
    assert.ok(layout.leftRail.y >= 0);
    assert.ok(layout.leftRail.x + layout.leftRail.w <= width);
    assert.ok(layout.leftRail.y + layout.leftRail.h <= height);
    assert.ok(layout.rightRail.x + layout.rightRail.w <= width);
    assert.ok(layout.workSurface.x > layout.leftRail.x + layout.leftRail.w);
    assert.ok(layout.workSurface.x + layout.workSurface.w < layout.rightRail.x);
    assert.ok(layout.workSurface.y + layout.workSurface.h <= height);
    assert.ok(layout.bottomRail.y + layout.bottomRail.h <= height);
    assert.ok(layout.leftRail.y + layout.leftRail.h <= layout.thumbstickBounds.y);
  }
});

test('file drawer sticky exit split keeps main menu exit out of scroll list', () => {
  const { listItems, exitItem } = splitFileDrawerStickyExitItems([
    { id: 'new', label: 'New' },
    { id: 'save', label: 'Save' },
    { divider: true },
    { id: 'exit-main', label: 'Exit to Main Menu' }
  ]);

  assert.equal(exitItem.id, 'exit-main');
  assert.equal(exitItem.label, 'Exit');
  assert.deepEqual(listItems.map((item) => item.id), ['new', 'save']);
});

test('shared file drawer auto-grid uses multiple columns before scrolling', () => {
  const ctx = createNoopContext();
  const drawn = [];
  const result = renderSharedFileDrawer(ctx, {
    panel: { x: 0, y: 0, w: 320, h: 220 },
    items: Array.from({ length: 6 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` })),
    title: '',
    rowHeight: 44,
    rowGap: 8,
    buttonHeight: 44,
    showTitle: false,
    footerMode: 'none',
    layoutMode: 'auto-grid',
    minColumnWidth: 120,
    maxColumns: 2,
    layout: {
      padding: 8,
      headerHeight: 8,
      footerHeight: 0,
      footerBottomPadding: 8
    },
    drawButton: (bounds, item) => drawn.push({ bounds, item })
  });

  assert.equal(result.columns, 2);
  assert.equal(result.scrollMax, 0);
  assert.equal(drawn.length, 6);
  assert.equal(drawn[0].bounds.y, drawn[1].bounds.y);
  assert.ok(drawn[1].bounds.x > drawn[0].bounds.x);
  assert.ok(drawn[2].bounds.y > drawn[0].bounds.y);
});

test('shared file drawer auto-grid keeps sticky footer outside item bounds', () => {
  const ctx = createNoopContext();
  const result = renderSharedFileDrawer(ctx, {
    panel: { x: 0, y: 0, w: 320, h: 180 },
    items: Array.from({ length: 4 }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` })),
    title: '',
    rowHeight: 44,
    rowGap: 8,
    buttonHeight: 44,
    showTitle: false,
    footerMode: 'exit-only',
    footerItem: { id: 'exit-main', label: 'Exit to Main Menu' },
    layoutMode: 'auto-grid',
    minColumnWidth: 120,
    maxColumns: 2,
    layout: {
      padding: 8,
      headerHeight: 8,
      footerHeight: 44,
      footerBottomPadding: 8
    },
    drawButton: () => {}
  });

  assert.equal(result.columns, 2);
  assert.equal(result.exitBounds.id, 'exit-main');
  assert.equal(result.itemBounds.some((bounds) => bounds.id === 'exit-main'), false);
  result.itemBounds.forEach((bounds) => {
    assert.ok(bounds.y + bounds.h <= result.exitBounds.y);
  });
});

test('shared thumbstick reset clears geometry and active drag state', () => {
  const thumbstick = {
    center: { x: 64, y: 120 },
    radius: 42,
    knobRadius: 18,
    active: true,
    id: 'touch',
    dx: 0.5,
    dy: -0.25
  };

  resetSharedThumbstickState(thumbstick);

  assert.deepEqual(thumbstick.center, { x: 0, y: 0 });
  assert.equal(thumbstick.radius, 0);
  assert.equal(thumbstick.knobRadius, 0);
  assert.equal(thumbstick.active, false);
  assert.equal(thumbstick.id, null);
  assert.equal(thumbstick.dx, 0);
  assert.equal(thumbstick.dy, 0);
});
