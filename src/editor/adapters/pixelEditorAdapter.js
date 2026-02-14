import { ensurePixelArtStore, ensurePixelTileData } from './editorDataContracts.js';

export function createPixelEditorAdapter(options = {}) {
  const {
    getWorld,
    clamp,
    persist,
    gridSize = 16,
    defaultTarget = null
  } = options;

  const state = {
    tool: 'paint',
    target: defaultTarget,
    colorIndex: 1,
    frameIndex: 0,
    paintActive: false,
    gridBounds: null,
    paletteBounds: [],
    frameBounds: null
  };

  const getActivePixelFrame = () => {
    const tileChar = state.target?.char;
    const pixelData = ensurePixelTileData(getWorld(), tileChar, { size: gridSize, fps: 6 });
    if (!pixelData) return null;
    if (!Array.isArray(pixelData.frames) || pixelData.frames.length === 0) {
      pixelData.frames = [Array((pixelData.size || gridSize) * (pixelData.size || gridSize)).fill(null)];
    }
    if (state.frameIndex >= pixelData.frames.length) {
      state.frameIndex = 0;
    }
    return { pixelData, frame: pixelData.frames[state.frameIndex] };
  };

  return {
    state,
    ensureStore: () => ensurePixelArtStore(getWorld()),
    getPixelData: (tileChar) => ensurePixelTileData(getWorld(), tileChar, { size: gridSize, fps: 6 }),
    getActivePixelFrame,
    setPixelCell(cellX, cellY, color) {
      const active = getActivePixelFrame();
      if (!active) return;
      const { pixelData, frame } = active;
      const size = pixelData.size || gridSize;
      if (cellX < 0 || cellY < 0 || cellX >= size || cellY >= size) return;
      const index = cellY * size + cellX;
      if (frame[index] === color) return;
      frame[index] = color;
      persist();
    },
    addFrame() {
      const active = getActivePixelFrame();
      if (!active) return;
      const size = active.pixelData.size || gridSize;
      active.pixelData.frames.push(Array(size * size).fill(null));
      state.frameIndex = active.pixelData.frames.length - 1;
      persist();
    },
    removeFrame() {
      const active = getActivePixelFrame();
      if (!active || active.pixelData.frames.length <= 1) return;
      active.pixelData.frames.splice(state.frameIndex, 1);
      state.frameIndex = clamp(state.frameIndex, 0, active.pixelData.frames.length - 1);
      persist();
    },
    cycleFrame(direction) {
      const active = getActivePixelFrame();
      if (!active) return;
      const total = active.pixelData.frames.length;
      state.frameIndex = ((state.frameIndex + direction) % total + total) % total;
    },
    adjustFps(delta) {
      const active = getActivePixelFrame();
      if (!active) return;
      active.pixelData.fps = clamp((active.pixelData.fps || 6) + delta, 1, 24);
      persist();
    }
  };
}
