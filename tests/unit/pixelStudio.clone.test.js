import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';

const handleCloneDown = PixelStudio.prototype.handleCloneDown;

const configureSeamFixCloneDefaults = PixelStudio.prototype.configureSeamFixCloneDefaults;

test('Alt sets clone source and resets offset without starting a stroke', () => {
  let started = false;
  const editor = {
    cloneSource: null,
    cloneOffset: { row: 9, col: 9 },
    statusMessage: '',
    startStroke() {
      started = true;
    },
    isMobileLayout() {
      return false;
    }
  };

  const point = { row: 3, col: 4 };
  handleCloneDown.call(editor, point, { altKey: true });

  assert.deepEqual(editor.cloneSource, point);
  assert.equal(editor.cloneOffset, null);
  assert.equal(editor.statusMessage, 'Clone source set');
  assert.equal(started, false);
});

test('clone stroke keeps initial aligned offset across separate strokes', () => {
  const calls = [];
  const editor = {
    cloneSource: { row: 8, col: 7 },
    cloneOffset: null,
    startStroke(point, options) {
      calls.push({ point, options });
    },
    statusMessage: '',
    isMobileLayout() {
      return false;
    }
  };

  handleCloneDown.call(editor, { row: 5, col: 4 }, {});
  assert.deepEqual(editor.cloneOffset, { row: 3, col: 3 });
  assert.equal(calls.length, 1);

  handleCloneDown.call(editor, { row: 2, col: 2 }, {});
  assert.deepEqual(editor.cloneOffset, { row: 3, col: 3 });
  assert.equal(calls.length, 2);
});

test('clone shows guidance when painting before setting a source', () => {
  let started = false;
  const editor = {
    cloneSource: null,
    cloneOffset: null,
    statusMessage: '',
    startStroke() {
      started = true;
    },
    isMobileLayout() {
      return false;
    }
  };

  handleCloneDown.call(editor, { row: 1, col: 1 }, {});

  assert.equal(started, false);
  assert.equal(editor.statusMessage, 'Set clone source with Alt-click first');
});


test('mobile set-source mode allows touch to choose clone source', () => {
  const editor = {
    cloneSource: null,
    cloneOffset: { row: 2, col: 2 },
    clonePickSourceArmed: true,
    statusMessage: '',
    startStroke() {
      throw new Error('should not start stroke while setting source');
    },
    isMobileLayout() {
      return true;
    }
  };

  const point = { row: 6, col: 7 };
  handleCloneDown.call(editor, point, { fromTouch: 1 });

  assert.deepEqual(editor.cloneSource, point);
  assert.equal(editor.cloneOffset, null);
  assert.equal(editor.clonePickSourceArmed, false);
  assert.equal(editor.statusMessage, 'Clone source set. Tap again to paint.');
});


test('seam-fix entry defaults to clone tool with source-pick armed', () => {
  const editor = {
    activeToolId: 'pencil',
    clonePickSourceArmed: false,
    cloneSource: { row: 1, col: 1 },
    cloneOffset: { row: 2, col: 2 },
    statusMessage: '',
    view: { showGrid: true },
    toolOptions: { brushSize: 1, brushOpacity: 1, brushHardness: 1 },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    setBrushSize(value) {
      this.toolOptions.brushSize = value;
    },
    setBrushHardness(value) {
      this.toolOptions.brushHardness = value;
    },
    setBrushOpacity(value) {
      this.toolOptions.brushOpacity = value;
    }
  };

  configureSeamFixCloneDefaults.call(editor);

  assert.equal(editor.activeToolId, 'clone');
  assert.equal(editor.view.showGrid, false);
  assert.equal(editor.toolOptions.brushSize, 16);
  assert.equal(editor.toolOptions.brushHardness, 0);
  assert.equal(editor.toolOptions.brushOpacity, 0.5);
  assert.equal(editor.clonePickSourceArmed, true);
  assert.equal(editor.cloneSource, null);
  assert.equal(editor.cloneOffset, null);
  assert.equal(editor.statusMessage, 'Tap canvas to set clone source');
});
