import test from 'node:test';
import assert from 'node:assert/strict';

import PixelStudio from '../../src/ui/PixelStudio.js';
import { TOOL_IDS } from '../../src/ui/pixel-editor/tools.js';

const handleCloneDown = PixelStudio.prototype.handleCloneDown;

const configureSeamFixCloneDefaults = PixelStudio.prototype.configureSeamFixCloneDefaults;

function createCloneEditor({ rotation = 0 } = {}) {
  const editor = Object.create(PixelStudio.prototype);
  const activeLayer = { pixels: new Uint32Array(25) };
  editor.canvasState = {
    width: 5,
    height: 5,
    activeLayerIndex: 0,
    layers: [activeLayer]
  };
  editor.selection = { active: false, mask: null };
  editor.cloneOffset = { row: 0, col: 0 };
  editor.cloneSourcePixels = new Uint32Array(25);
  editor.toolOptions = { cloneRotationDegrees: rotation, cloneAlphaMode: 'skip' };
  editor.strokeState = {
    brushCenter: { row: 2, col: 2 },
    cloneDestinationAnchor: { row: 2, col: 2 }
  };
  editor.blendPixel = (_dest, src) => src;
  editor.markLayerPixelsDirty = () => {};
  return editor;
}

function createFrameCloneEditor() {
  const editor = Object.create(PixelStudio.prototype);
  const sourceLayer = { pixels: new Uint32Array(25) };
  const destLayer = { pixels: new Uint32Array(25) };
  sourceLayer.pixels[1 * 5 + 1] = 0xff112233;
  destLayer.pixels[1 * 5 + 1] = 0xffaabbcc;
  editor.canvasState = {
    width: 5,
    height: 5,
    activeLayerIndex: 0,
    layers: [sourceLayer]
  };
  editor.animation = {
    currentFrameIndex: 0,
    frames: [
      { layers: [sourceLayer] },
      { layers: [destLayer] }
    ]
  };
  editor.selection = { active: false, mask: null };
  editor.toolOptions = {
    brushSize: 1,
    brushHardness: 1,
    symmetry: { horizontal: false, vertical: false },
    cloneRotationDegrees: 0,
    cloneAlphaMode: 'skip'
  };
  editor.cloneSource = null;
  editor.cloneOffset = null;
  editor.cloneSourcePixels = null;
  editor.cloneSourceSnapshot = null;
  editor.clonePickSourceArmed = false;
  editor.cloneColorPickArmed = false;
  editor.startHistory = () => {};
  editor.markLayerPixelsDirty = () => {};
  editor.isMobileLayout = () => false;
  return { editor, sourceLayer, destLayer };
}

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
  assert.equal(editor.statusMessage, 'Clone source set F1 L1');
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

test('clone source keeps the frame snapshot selected before switching frames', () => {
  const { editor, destLayer } = createFrameCloneEditor();

  handleCloneDown.call(editor, { row: 1, col: 1 }, { altKey: true });
  editor.animation.currentFrameIndex = 1;
  editor.canvasState.layers = editor.animation.frames[1].layers;

  handleCloneDown.call(editor, { row: 2, col: 2 }, {});

  assert.equal(destLayer.pixels[2 * 5 + 2], 0xff112233);
});

test('clone source uses the frozen source pixels after the source frame changes', () => {
  const { editor, sourceLayer, destLayer } = createFrameCloneEditor();

  handleCloneDown.call(editor, { row: 1, col: 1 }, { altKey: true });
  sourceLayer.pixels[1 * 5 + 1] = 0xff445566;
  editor.animation.currentFrameIndex = 1;
  editor.canvasState.layers = editor.animation.frames[1].layers;

  handleCloneDown.call(editor, { row: 2, col: 2 }, {});

  assert.equal(destLayer.pixels[2 * 5 + 2], 0xff112233);
});

test('clone rotation 0 samples the aligned source pixel', () => {
  const editor = createCloneEditor({ rotation: 0 });
  editor.cloneSourcePixels[2 * 5 + 3] = 0xff336699;

  editor.applyClone({ row: 2, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 3], 0xff336699);
});

test('clone rotation samples from the rotated source coordinate', () => {
  const editor = createCloneEditor({ rotation: 90 });
  editor.cloneSourcePixels[1 * 5 + 2] = 0xffcc4400;

  editor.applyClone({ row: 2, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 3], 0xffcc4400);
});

test('clone rotation skips out-of-bounds source samples', () => {
  const editor = createCloneEditor({ rotation: 90 });
  editor.cloneOffset = { row: -2, col: 0 };
  editor.cloneSourcePixels[0] = 0xffffffff;

  editor.applyClone({ row: 2, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 3], 0);
});

test('clone rotation maps destination stroke movement onto the calibrated source angle', () => {
  const editor = createCloneEditor({ rotation: 90 });
  editor.cloneOffset = { row: 0, col: -1 };
  editor.cloneSourcePixels[2 * 5 + 1] = 0xff111111;
  editor.cloneSourcePixels[2 * 5 + 2] = 0xff222222;
  editor.cloneSourcePixels[2 * 5 + 3] = 0xff333333;
  editor.strokeState.cloneDestinationAnchor = { row: 2, col: 2 };

  editor.applyClone({ row: 2, col: 2 }, 1);
  editor.strokeState.brushCenter = { row: 3, col: 2 };
  editor.applyClone({ row: 3, col: 2 }, 1);
  editor.strokeState.brushCenter = { row: 4, col: 2 };
  editor.applyClone({ row: 4, col: 2 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 2], 0xff111111);
  assert.equal(editor.activeLayer.pixels[3 * 5 + 2], 0xff222222);
  assert.equal(editor.activeLayer.pixels[4 * 5 + 2], 0xff333333);
});

test('clone rotation keeps a thin calibrated source line from painting adjacent transparent pixels', () => {
  const editor = createCloneEditor({ rotation: 90 });
  editor.cloneOffset = { row: 0, col: -1 };
  editor.cloneSourcePixels[2 * 5 + 1] = 0xff111111;
  editor.cloneSourcePixels[2 * 5 + 2] = 0xff222222;
  editor.cloneSourcePixels[2 * 5 + 3] = 0xff333333;
  editor.strokeState.cloneDestinationAnchor = { row: 2, col: 2 };

  editor.applyClone({ row: 3, col: 1 }, 1);
  editor.applyClone({ row: 3, col: 2 }, 1);
  editor.applyClone({ row: 3, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[3 * 5 + 1], 0);
  assert.equal(editor.activeLayer.pixels[3 * 5 + 2], 0xff222222);
  assert.equal(editor.activeLayer.pixels[3 * 5 + 3], 0);
});

test('clone alpha skip leaves destination unchanged for transparent source pixels', () => {
  const editor = createCloneEditor();
  editor.activeLayer.pixels[2 * 5 + 3] = 0xff778899;
  editor.cloneSourcePixels[2 * 5 + 3] = 0x00000000;
  editor.toolOptions.cloneAlphaMode = 'skip';

  editor.applyClone({ row: 2, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 3], 0xff778899);
});

test('clone alpha copy erases destination for transparent source pixels', () => {
  const editor = createCloneEditor();
  editor.activeLayer.pixels[2 * 5 + 3] = 0xff778899;
  editor.cloneSourcePixels[2 * 5 + 3] = 0x00000000;
  editor.toolOptions.cloneAlphaMode = 'copy';

  editor.applyClone({ row: 2, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 3], 0x00000000);
});

test('clone alpha skip still paints opaque source pixels', () => {
  const editor = createCloneEditor();
  editor.activeLayer.pixels[2 * 5 + 3] = 0xff778899;
  editor.cloneSourcePixels[2 * 5 + 3] = 0xff112233;
  editor.toolOptions.cloneAlphaMode = 'skip';

  editor.applyClone({ row: 2, col: 3 }, 1);

  assert.equal(editor.activeLayer.pixels[2 * 5 + 3], 0xff112233);
});

test('clone angle delta maps source line to destination line', () => {
  const editor = createCloneEditor();
  const horizontal = { start: { row: 2, col: 1 }, end: { row: 2, col: 4 } };
  const verticalDown = { start: { row: 1, col: 1 }, end: { row: 4, col: 1 } };
  const verticalUp = { start: { row: 4, col: 1 }, end: { row: 1, col: 1 } };

  assert.equal(editor.getCloneAngleDeltaDegrees(horizontal, verticalDown), 90);
  assert.equal(editor.getCloneAngleDeltaDegrees(horizontal, verticalUp), -90);
});

test('clone angle delta normalizes to signed degrees', () => {
  const editor = createCloneEditor();
  const source = { start: { row: 0, col: 0 }, end: { row: -1, col: 0 } };
  const destination = { start: { row: 0, col: 0 }, end: { row: 0, col: -1 } };

  assert.equal(editor.getCloneAngleDeltaDegrees(source, destination), -90);
});

test('clone angle calibration ignores zero-length lines without changing rotation', () => {
  const editor = createCloneEditor({ rotation: 45 });
  editor.activeToolId = TOOL_IDS.CLONE;
  editor.startCloneAngleCalibration();

  assert.equal(editor.handleCloneAngleCalibrationDown({ row: 2, col: 2 }), true);
  assert.equal(editor.handleCloneAngleCalibrationUp(), true);

  assert.equal(editor.toolOptions.cloneRotationDegrees, 45);
  assert.equal(editor.cloneAngleCalibration.phase, 'source');
});

test('clone angle calibration uses two drawn lines to set rotation', () => {
  const editor = createCloneEditor();
  editor.activeToolId = TOOL_IDS.CLONE;
  editor.startCloneAngleCalibration();

  editor.handleCloneAngleCalibrationDown({ row: 2, col: 1 });
  editor.handleCloneAngleCalibrationMove({ row: 2, col: 4 });
  editor.handleCloneAngleCalibrationUp();

  assert.equal(editor.cloneAngleCalibration.phase, 'destination');

  editor.handleCloneAngleCalibrationDown({ row: 1, col: 1 });
  editor.handleCloneAngleCalibrationMove({ row: 4, col: 1 });
  editor.handleCloneAngleCalibrationUp();

  assert.equal(editor.toolOptions.cloneRotationDegrees, 90);
  assert.equal(editor.cloneAngleCalibration, null);
});

test('clone angle calibration can reuse the same start point for a new angle', () => {
  const editor = createCloneEditor();
  editor.activeToolId = TOOL_IDS.CLONE;
  editor.startCloneAngleCalibration();

  editor.handleCloneAngleCalibrationDown({ row: 2, col: 2 });
  editor.handleCloneAngleCalibrationMove({ row: 2, col: 4 });
  editor.handleCloneAngleCalibrationUp();
  editor.handleCloneAngleCalibrationDown({ row: 2, col: 2 });
  editor.handleCloneAngleCalibrationMove({ row: 4, col: 2 });
  editor.handleCloneAngleCalibrationUp();

  assert.equal(editor.toolOptions.cloneRotationDegrees, 90);
  assert.equal(editor.cloneAngleCalibration, null);

  editor.startCloneAngleCalibration();
  editor.handleCloneAngleCalibrationDown({ row: 2, col: 2 });
  editor.handleCloneAngleCalibrationMove({ row: 2, col: 4 });
  editor.handleCloneAngleCalibrationUp();
  editor.handleCloneAngleCalibrationDown({ row: 2, col: 2 });
  editor.handleCloneAngleCalibrationMove({ row: 1, col: 2 });
  editor.handleCloneAngleCalibrationUp();

  assert.equal(editor.toolOptions.cloneRotationDegrees, -90);
  assert.equal(editor.cloneAngleCalibration, null);
});

test('zero-length destination angle keeps the captured source angle', () => {
  const editor = createCloneEditor({ rotation: 35 });
  editor.activeToolId = TOOL_IDS.CLONE;
  editor.startCloneAngleCalibration();

  editor.handleCloneAngleCalibrationDown({ row: 2, col: 2 });
  editor.handleCloneAngleCalibrationMove({ row: 2, col: 4 });
  editor.handleCloneAngleCalibrationUp();
  const sourceLine = editor.cloneAngleCalibration.sourceLine;

  editor.handleCloneAngleCalibrationDown({ row: 1, col: 1 });
  editor.handleCloneAngleCalibrationUp();

  assert.equal(editor.toolOptions.cloneRotationDegrees, 35);
  assert.equal(editor.cloneAngleCalibration.phase, 'destination');
  assert.deepEqual(editor.cloneAngleCalibration.sourceLine, sourceLine);
});

test('arming clone source clears stale angle and stroke state', () => {
  const editor = createCloneEditor();
  editor.cloneSource = { row: 1, col: 2 };
  editor.clonePickSourceArmed = false;
  editor.cloneColorPickArmed = true;
  editor.cloneAngleCalibration = { phase: 'destination', sourceLine: null, activeLine: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } } };
  editor.cloneSourcePixels = new Uint32Array(25);
  editor.strokeState = { mode: 'clone' };

  editor.armCloneSourcePick();

  assert.equal(editor.clonePickSourceArmed, true);
  assert.equal(editor.cloneColorPickArmed, false);
  assert.equal(editor.cloneAngleCalibration, null);
  assert.equal(editor.cloneSourcePixels, null);
  assert.equal(editor.strokeState, null);
  assert.equal(editor.statusMessage, 'Tap canvas to replace clone source');
});

test('clone reset clears rotation and offset while preserving clone source', () => {
  const editor = createCloneEditor({ rotation: 45 });
  editor.cloneSource = { row: 1, col: 2 };
  editor.cloneOffset = { row: 3, col: 4 };
  editor.cloneSourceSnapshot = { width: 5, height: 5, pixels: new Uint32Array(25) };
  editor.cloneAngleCalibration = { phase: 'destination', sourceLine: null, activeLine: null };

  editor.resetCloneAlignment();

  assert.equal(editor.toolOptions.cloneRotationDegrees, 0);
  assert.equal(editor.cloneAngleCalibration, null);
  assert.deepEqual(editor.cloneSource, { row: 1, col: 2 });
  assert.equal(editor.cloneOffset, null);
  assert.ok(editor.cloneSourceSnapshot);
});

test('clone reset lets the next stroke compute a fresh destination alignment', () => {
  const calls = [];
  const editor = {
    cloneSource: { row: 4, col: 4 },
    cloneOffset: { row: 9, col: 9 },
    cloneSourceSnapshot: { width: 5, height: 5, pixels: new Uint32Array(25) },
    cloneAngleCalibration: null,
    toolOptions: { cloneRotationDegrees: 90 },
    statusMessage: '',
    cancelCloneAngleCalibration: PixelStudio.prototype.cancelCloneAngleCalibration,
    setCloneRotationDegrees: PixelStudio.prototype.setCloneRotationDegrees,
    resetCloneAlignment: PixelStudio.prototype.resetCloneAlignment,
    startStroke(point, options) {
      calls.push({ point, options });
    },
    isMobileLayout() {
      return false;
    }
  };

  editor.resetCloneAlignment();
  handleCloneDown.call(editor, { row: 2, col: 1 }, {});

  assert.deepEqual(editor.cloneOffset, { row: 2, col: 3 });
  assert.equal(editor.toolOptions.cloneRotationDegrees, 0);
  assert.equal(calls.length, 1);
});

test('clone target resets destination alignment without replacing source', () => {
  let started = false;
  const editor = {
    cloneSource: { row: 4, col: 4 },
    cloneOffset: { row: 9, col: 9 },
    clonePickTargetArmed: true,
    cloneColorPickArmed: true,
    statusMessage: '',
    startStroke() {
      started = true;
    },
    isMobileLayout() {
      return false;
    }
  };

  handleCloneDown.call(editor, { row: 2, col: 1 }, {});

  assert.deepEqual(editor.cloneSource, { row: 4, col: 4 });
  assert.deepEqual(editor.cloneOffset, { row: 2, col: 3 });
  assert.equal(editor.clonePickTargetArmed, false);
  assert.equal(editor.cloneColorPickArmed, false);
  assert.equal(started, false);
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
  assert.equal(editor.statusMessage, 'Clone source set F1 L1. Tap destination.');
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
