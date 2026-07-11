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

const writeAscii = (bytes, text) => {
  for (let index = 0; index < text.length; index += 1) bytes.push(text.charCodeAt(index));
};

const writeU16 = (bytes, value) => {
  const safe = Math.max(0, Math.round(Number(value) || 0));
  bytes.push(safe & 0xff, (safe >> 8) & 0xff);
};

const getGifTablePower = (colorCount) => {
  let size = 2;
  let power = 1;
  while (size < colorCount && size < 256) {
    size *= 2;
    power += 1;
  }
  return { size, power };
};

const makeQuantizedColor = (rBucket, gBucket, bBucket) => ({
  r: Math.round((rBucket / 5) * 255),
  g: Math.round((gBucket / 6) * 255),
  b: Math.round((bBucket / 5) * 255)
});

const buildGifPalette = (framePixels) => {
  const exactColors = new Map();
  for (const pixels of framePixels) {
    for (const pixel of pixels) {
      if ((pixel >>> 24) < 128) continue;
      const key = pixel & 0x00ffffff;
      if (!exactColors.has(key)) {
        exactColors.set(key, {
          r: pixel & 0xff,
          g: (pixel >>> 8) & 0xff,
          b: (pixel >>> 16) & 0xff
        });
      }
    }
  }

  if (exactColors.size <= 255) {
    const colors = [{ r: 0, g: 0, b: 0 }];
    const exactIndex = new Map();
    for (const [key, color] of exactColors.entries()) {
      exactIndex.set(key, colors.length);
      colors.push(color);
    }
    return {
      colors,
      getIndex(pixel) {
        if ((pixel >>> 24) < 128) return 0;
        return exactIndex.get(pixel & 0x00ffffff) || 0;
      }
    };
  }

  const colors = [{ r: 0, g: 0, b: 0 }];
  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 7; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        colors.push(makeQuantizedColor(r, g, b));
      }
    }
  }

  return {
    colors,
    getIndex(pixel) {
      if ((pixel >>> 24) < 128) return 0;
      const r = pixel & 0xff;
      const g = (pixel >>> 8) & 0xff;
      const b = (pixel >>> 16) & 0xff;
      const rBucket = Math.min(5, Math.floor((r * 6) / 256));
      const gBucket = Math.min(6, Math.floor((g * 7) / 256));
      const bBucket = Math.min(5, Math.floor((b * 6) / 256));
      return 1 + ((rBucket * 7 + gBucket) * 6 + bBucket);
    }
  };
};

const packGifSubBlocks = (bytes, data) => {
  for (let offset = 0; offset < data.length; offset += 255) {
    const block = data.slice(offset, offset + 255);
    bytes.push(block.length, ...block);
  }
  bytes.push(0);
};

export const encodeGifLzw = (indices, minCodeSize) => {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let bitBuffer = 0;
  let bitCount = 0;
  const output = [];

  const resetDictionaryState = () => {
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
  };

  const writeCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  resetDictionaryState();
  writeCode(clearCode);
  let hasPreviousCode = false;
  const maxLiteralCode = clearCode - 1;

  for (const rawValue of indices) {
    const value = Math.max(0, Math.min(maxLiteralCode, Math.round(Number(rawValue) || 0)));
    writeCode(value);
    if (hasPreviousCode) {
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
      if (nextCode >= 4096) {
        writeCode(clearCode);
        resetDictionaryState();
        hasPreviousCode = false;
        continue;
      }
    } else {
      hasPreviousCode = true;
    }
  }

  if (!indices.length) writeCode(0);
  writeCode(endCode);
  if (bitCount > 0) output.push(bitBuffer & 0xff);
  return output;
};

export const exportAnimatedGif = (frames, width, height, options = {}) => {
  const safeFrames = Array.isArray(frames) && frames.length ? frames : [];
  if (!safeFrames.length) throw new Error('No frames available for GIF export.');
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const framePixels = safeFrames.map((frame) => compositeLayers(frame.layers || [], safeWidth, safeHeight));
  const palette = buildGifPalette(framePixels);
  const { size: tableSize, power } = getGifTablePower(palette.colors.length);
  const minCodeSize = Math.max(2, power);
  const bytes = [];

  writeAscii(bytes, 'GIF89a');
  writeU16(bytes, safeWidth);
  writeU16(bytes, safeHeight);
  bytes.push(0x80 | (7 << 4) | (power - 1), 0, 0);
  for (let index = 0; index < tableSize; index += 1) {
    const color = palette.colors[index] || { r: 0, g: 0, b: 0 };
    bytes.push(color.r, color.g, color.b);
  }

  bytes.push(0x21, 0xff, 0x0b);
  writeAscii(bytes, 'NETSCAPE2.0');
  bytes.push(0x03, 0x01);
  writeU16(bytes, Math.max(0, Math.round(Number(options.loopCount) || 0)));
  bytes.push(0x00);

  framePixels.forEach((pixels, frameIndex) => {
    const delayCs = Math.max(2, Math.round(Math.max(1, Number(safeFrames[frameIndex]?.durationMs) || 120) / 10));
    bytes.push(0x21, 0xf9, 0x04, 0x09);
    writeU16(bytes, delayCs);
    bytes.push(0, 0);

    bytes.push(0x2c);
    writeU16(bytes, 0);
    writeU16(bytes, 0);
    writeU16(bytes, safeWidth);
    writeU16(bytes, safeHeight);
    bytes.push(0);

    const indices = Array.from(pixels, (pixel) => palette.getIndex(pixel));
    bytes.push(minCodeSize);
    packGifSubBlocks(bytes, encodeGifLzw(indices, minCodeSize));
  });

  bytes.push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
};

export const exportAnimationGif = exportAnimatedGif;
