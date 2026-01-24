import { compositeLayers } from './layers.js';

export const createFrame = (layers, durationMs = 120) => ({
  layers: layers.map((layer) => ({
    ...layer,
    pixels: new Uint32Array(layer.pixels)
  })),
  durationMs
});

export const cloneFrame = (frame) => ({
  layers: frame.layers.map((layer) => ({
    ...layer,
    pixels: new Uint32Array(layer.pixels)
  })),
  durationMs: frame.durationMs
});

export const exportSpriteSheet = (frames, width, height, options = {}) => {
  const layout = options.layout || 'horizontal';
  const columns = options.columns || frames.length;
  let sheetWidth = width;
  let sheetHeight = height;
  let cols = frames.length;
  let rows = 1;
  if (layout === 'vertical') {
    cols = 1;
    rows = frames.length;
  } else if (layout === 'grid') {
    cols = Math.max(1, columns);
    rows = Math.ceil(frames.length / cols);
  }
  sheetWidth = width * cols;
  sheetHeight = height * rows;
  const canvas = document.createElement('canvas');
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const metadata = {
    width,
    height,
    frames: [],
    layout,
    columns: cols,
    rows
  };

  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * width;
    const y = row * height;
    const composite = compositeLayers(frame.layers, width, height);
    const imageData = ctx.createImageData(width, height);
    const bytes = new Uint32Array(imageData.data.buffer);
    bytes.set(composite);
    ctx.putImageData(imageData, x, y);
    metadata.frames.push({
      index,
      x,
      y,
      w: width,
      h: height,
      durationMs: frame.durationMs
    });
  });

  return { canvas, metadata };
};
