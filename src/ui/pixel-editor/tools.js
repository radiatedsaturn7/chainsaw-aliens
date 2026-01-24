export const TOOL_IDS = {
  PENCIL: 'pencil',
  ERASER: 'eraser',
  EYEDROPPER: 'eyedropper',
  LINE: 'line',
  FILL: 'fill',
  SELECT_RECT: 'select-rect',
  SELECT_ELLIPSE: 'select-ellipse',
  SELECT_LASSO: 'select-lasso',
  MOVE: 'move',
  CLONE: 'clone',
  DITHER: 'dither',
  COLOR_REPLACE: 'color-replace'
};

export const createToolRegistry = (editor) => ([
  {
    id: TOOL_IDS.PENCIL,
    name: 'Pencil',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startStroke(point, { mode: 'paint' }),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['brushSize', 'symmetry', 'wrap']
  },
  {
    id: TOOL_IDS.ERASER,
    name: 'Eraser',
    cursor: 'cell',
    onPointerDown: (point) => editor.startStroke(point, { mode: 'erase' }),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['brushSize', 'symmetry', 'wrap']
  },
  {
    id: TOOL_IDS.EYEDROPPER,
    name: 'Eyedropper',
    cursor: 'copy',
    onPointerDown: (point) => editor.pickColor(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: []
  },
  {
    id: TOOL_IDS.LINE,
    name: 'Line',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startLine(point),
    onPointerMove: (point) => editor.updateLine(point),
    onPointerUp: () => editor.commitLine(),
    optionsUI: ['linePerfect', 'symmetry', 'wrap']
  },
  {
    id: TOOL_IDS.FILL,
    name: 'Fill',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.applyFill(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['fillMode', 'fillTolerance', 'wrap']
  },
  {
    id: TOOL_IDS.SELECT_RECT,
    name: 'Rect Select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startSelection(point, 'rect'),
    onPointerMove: (point) => editor.updateSelection(point),
    onPointerUp: () => editor.commitSelection(),
    optionsUI: ['selectionActions']
  },
  {
    id: TOOL_IDS.SELECT_ELLIPSE,
    name: 'Ellipse Select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startSelection(point, 'ellipse'),
    onPointerMove: (point) => editor.updateSelection(point),
    onPointerUp: () => editor.commitSelection(),
    optionsUI: ['selectionActions']
  },
  {
    id: TOOL_IDS.SELECT_LASSO,
    name: 'Lasso Select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.addLassoPoint(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['selectionActions']
  },
  {
    id: TOOL_IDS.MOVE,
    name: 'Move',
    cursor: 'move',
    onPointerDown: (point) => editor.startMove(point),
    onPointerMove: (point) => editor.updateMove(point),
    onPointerUp: () => editor.commitMove(),
    onKeyDown: (event) => editor.handleMoveKey(event),
    onGamepad: (action) => editor.handleMoveGamepad(action),
    optionsUI: ['transform']
  },
  {
    id: TOOL_IDS.CLONE,
    name: 'Clone',
    cursor: 'crosshair',
    onPointerDown: (point, modifiers) => editor.handleCloneDown(point, modifiers),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['brushSize', 'wrap']
  },
  {
    id: TOOL_IDS.DITHER,
    name: 'Dither',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startStroke(point, { mode: 'dither' }),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['ditherPattern', 'ditherStrength', 'brushSize']
  },
  {
    id: TOOL_IDS.COLOR_REPLACE,
    name: 'Color Replace',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.replaceColor(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['replaceScope']
  }
]);
