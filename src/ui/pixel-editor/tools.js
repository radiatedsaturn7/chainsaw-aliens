export const TOOL_IDS = {
  PENCIL: 'pencil',
  ERASER: 'eraser',
  EYEDROPPER: 'eyedropper',
  LINE: 'line',
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  POLYGON: 'polygon',
  GRADIENT: 'gradient',
  FILL: 'fill',
  SELECT_RECT: 'select-rect',
  SELECT_ELLIPSE: 'select-ellipse',
  SELECT_LASSO: 'select-lasso',
  SELECT_MAGIC_LASSO: 'select-magic-lasso',
  SELECT_MAGIC_COLOR: 'select-magic-color',
  MOVE: 'move',
  CLONE: 'clone',
  DITHER: 'dither',
  COLOR_REPLACE: 'color-replace'
};

export const createToolRegistry = (editor) => ([
  {
    id: TOOL_IDS.PENCIL,
    name: 'Pencil',
    category: 'draw',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startStroke(point, { mode: 'paint' }),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['brushSize', 'symmetry', 'wrap']
  },
  {
    id: TOOL_IDS.ERASER,
    name: 'Eraser',
    category: 'tools',
    cursor: 'cell',
    onPointerDown: (point) => editor.startStroke(point, { mode: 'erase' }),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['brushSize', 'symmetry', 'wrap']
  },
  {
    id: TOOL_IDS.EYEDROPPER,
    name: 'Eyedropper',
    category: 'tools',
    cursor: 'copy',
    onPointerDown: (point) => editor.pickColor(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: []
  },
  {
    id: TOOL_IDS.LINE,
    name: 'Line',
    category: 'draw',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startLine(point),
    onPointerMove: (point) => editor.updateLine(point),
    onPointerUp: () => editor.commitLine(),
    optionsUI: ['linePerfect', 'symmetry', 'wrap']
  },
  {
    id: TOOL_IDS.RECT,
    name: 'Rectangle',
    category: 'draw',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startShape(point, 'rect'),
    onPointerMove: (point) => editor.updateShape(point),
    onPointerUp: () => editor.commitShape(),
    optionsUI: ['shapeFill']
  },
  {
    id: TOOL_IDS.ELLIPSE,
    name: 'Oval',
    category: 'draw',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startShape(point, 'ellipse'),
    onPointerMove: (point) => editor.updateShape(point),
    onPointerUp: () => editor.commitShape(),
    optionsUI: ['shapeFill']
  },
  {
    id: TOOL_IDS.POLYGON,
    name: 'Polygon',
    category: 'draw',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startShape(point, 'polygon'),
    onPointerMove: (point) => editor.updateShape(point),
    onPointerUp: () => editor.commitShape(),
    optionsUI: ['shapeFill', 'polygonSides']
  },
  {
    id: TOOL_IDS.GRADIENT,
    name: 'Gradient',
    category: 'tools',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startGradient(point),
    onPointerMove: (point) => editor.updateGradient(point),
    onPointerUp: () => editor.commitGradient(),
    optionsUI: ['gradientStrength']
  },
  {
    id: TOOL_IDS.FILL,
    name: 'Fill',
    category: 'draw',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.applyFill(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['fillMode', 'fillTolerance', 'wrap']
  },
  {
    id: TOOL_IDS.SELECT_RECT,
    name: 'Rect Select',
    category: 'select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startSelection(point, 'rect'),
    onPointerMove: (point) => editor.updateSelection(point),
    onPointerUp: () => editor.commitSelection(),
    optionsUI: ['selectionActions']
  },
  {
    id: TOOL_IDS.SELECT_ELLIPSE,
    name: 'Oval Select',
    category: 'select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startSelection(point, 'ellipse'),
    onPointerMove: (point) => editor.updateSelection(point),
    onPointerUp: () => editor.commitSelection(),
    optionsUI: ['selectionActions']
  },
  {
    id: TOOL_IDS.SELECT_LASSO,
    name: 'Lasso Select',
    category: 'select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.addLassoPoint(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['selectionActions']
  },
  {
    id: TOOL_IDS.SELECT_MAGIC_LASSO,
    name: 'Magic Lasso',
    category: 'select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.applyMagicSelection(point, { contiguous: true }),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['selectionActions', 'magicThreshold']
  },
  {
    id: TOOL_IDS.SELECT_MAGIC_COLOR,
    name: 'Magic Color',
    category: 'select',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.applyMagicSelection(point, { contiguous: false }),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['selectionActions', 'magicThreshold']
  },
  {
    id: TOOL_IDS.MOVE,
    name: 'Move',
    category: 'tools',
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
    category: 'tools',
    cursor: 'crosshair',
    onPointerDown: (point, modifiers) => editor.handleCloneDown(point, modifiers),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['brushSize', 'wrap']
  },
  {
    id: TOOL_IDS.DITHER,
    name: 'Dither',
    category: 'tools',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.startStroke(point, { mode: 'dither' }),
    onPointerMove: (point) => editor.continueStroke(point),
    onPointerUp: () => editor.finishStroke(),
    optionsUI: ['ditherPattern', 'ditherStrength', 'brushSize']
  },
  {
    id: TOOL_IDS.COLOR_REPLACE,
    name: 'Color Replace',
    category: 'tools',
    cursor: 'crosshair',
    onPointerDown: (point) => editor.replaceColor(point),
    onPointerMove: null,
    onPointerUp: null,
    optionsUI: ['replaceScope']
  }
]);
