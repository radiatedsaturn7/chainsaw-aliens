function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function parsePixel(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      r: value & 255,
      g: (value >>> 8) & 255,
      b: (value >>> 16) & 255,
      a: (value >>> 24) & 255
    };
  }
  const text = String(value || '').trim();
  if (!/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text)) return null;
  const hex = text.startsWith('#') ? text.slice(1) : text;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length >= 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
  };
}

function getFramePixels(source = null, document = {}) {
  if (!source) return null;
  if (Array.isArray(source) && source.length && !Array.isArray(source[0])) return source;
  if (Array.isArray(source) && Array.isArray(source[0])) return source[0];
  if (!source || typeof source !== 'object') return null;
  if (Array.isArray(source.pixels) && source.pixels.length) return source.pixels;
  if (Array.isArray(source.data) && source.data.length) return source.data;
  const layers = Array.isArray(source.layers) ? source.layers : [];
  const width = Math.max(1, Math.round(Number(document.width || document.editor?.width || document.size || 16)));
  const height = Math.max(1, Math.round(Number(document.height || document.editor?.height || document.size || width)));
  const composite = new Array(width * height).fill(0);
  let painted = false;
  layers.forEach((layer) => {
    if (layer?.visible === false) return;
    const pixels = Array.isArray(layer?.pixels)
      ? layer.pixels
      : Array.isArray(layer?.data)
        ? layer.data
        : null;
    if (!pixels) return;
    pixels.forEach((value, index) => {
      if (!value) return;
      composite[index] = value;
      painted = true;
    });
  });
  return painted ? composite : null;
}

function toRgbaPixels(source = [], width = 1, height = 1) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const color = parsePixel(source[index]);
    if (!color || color.a === 0) continue;
    const offset = index * 4;
    pixels[offset] = color.r;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.b;
    pixels[offset + 3] = color.a;
  }
  return pixels;
}

function quantizeTerrainChannel(value) {
  return clamp(Math.round(Math.round((Number(value) || 0) / 4) * 4), 0, 255);
}

function buildMipLevels(baseLevel, { quantize = false, maxLevels = 9 } = {}) {
  const levels = [{
    width: Math.max(1, Math.floor(Number(baseLevel.width) || 1)),
    height: Math.max(1, Math.floor(Number(baseLevel.height) || 1)),
    data: baseLevel.data
  }];
  while (levels.length < maxLevels) {
    const previous = levels[levels.length - 1];
    if (previous.width <= 1 && previous.height <= 1) break;
    const width = Math.max(1, Math.ceil(previous.width / 2));
    const height = Math.max(1, Math.ceil(previous.height / 2));
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let alphaSum = 0;
        let count = 0;
        for (let offsetY = 0; offsetY < 2; offsetY += 1) {
          for (let offsetX = 0; offsetX < 2; offsetX += 1) {
            const sourceX = Math.min(previous.width - 1, x * 2 + offsetX);
            const sourceY = Math.min(previous.height - 1, y * 2 + offsetY);
            const sourceOffset = (sourceY * previous.width + sourceX) * 4;
            const alpha = Number(previous.data[sourceOffset + 3] || 0) / 255;
            r += Number(previous.data[sourceOffset] || 0) * alpha;
            g += Number(previous.data[sourceOffset + 1] || 0) * alpha;
            b += Number(previous.data[sourceOffset + 2] || 0) * alpha;
            alphaSum += alpha;
            count += 1;
          }
        }
        const targetOffset = (y * width + x) * 4;
        if (alphaSum <= 0.001) continue;
        const outputR = Math.round(r / alphaSum);
        const outputG = Math.round(g / alphaSum);
        const outputB = Math.round(b / alphaSum);
        data[targetOffset] = quantize ? quantizeTerrainChannel(outputR) : outputR;
        data[targetOffset + 1] = quantize ? quantizeTerrainChannel(outputG) : outputG;
        data[targetOffset + 2] = quantize ? quantizeTerrainChannel(outputB) : outputB;
        data[targetOffset + 3] = Math.round(clamp(alphaSum / count, 0, 1) * 255);
      }
    }
    levels.push({ width, height, data });
  }
  return levels;
}

function buildCleanTerrainBaseLevel(baseLevel) {
  const maxSource = Math.max(baseLevel.width, baseLevel.height);
  const scale = maxSource > 512 ? 512 / maxSource : 1;
  const width = Math.max(1, Math.round(baseLevel.width * scale));
  const height = Math.max(1, Math.round(baseLevel.height * scale));
  if (width === baseLevel.width && height === baseLevel.height) {
    const data = new Uint8ClampedArray(baseLevel.data.length);
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = quantizeTerrainChannel(baseLevel.data[offset]);
      data[offset + 1] = quantizeTerrainChannel(baseLevel.data[offset + 1]);
      data[offset + 2] = quantizeTerrainChannel(baseLevel.data[offset + 2]);
      data[offset + 3] = baseLevel.data[offset + 3];
    }
    return { width, height, data };
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const minY = clamp(Math.floor(y / height * baseLevel.height), 0, baseLevel.height - 1);
    const maxY = clamp(Math.ceil((y + 1) / height * baseLevel.height) - 1, 0, baseLevel.height - 1);
    for (let x = 0; x < width; x += 1) {
      const minX = clamp(Math.floor(x / width * baseLevel.width), 0, baseLevel.width - 1);
      const maxX = clamp(Math.ceil((x + 1) / width * baseLevel.width) - 1, 0, baseLevel.width - 1);
      let r = 0;
      let g = 0;
      let b = 0;
      let alphaSum = 0;
      let count = 0;
      for (let sourceY = minY; sourceY <= maxY; sourceY += 1) {
        for (let sourceX = minX; sourceX <= maxX; sourceX += 1) {
          const sourceOffset = (sourceY * baseLevel.width + sourceX) * 4;
          const alpha = Number(baseLevel.data[sourceOffset + 3] || 0) / 255;
          r += Number(baseLevel.data[sourceOffset] || 0) * alpha;
          g += Number(baseLevel.data[sourceOffset + 1] || 0) * alpha;
          b += Number(baseLevel.data[sourceOffset + 2] || 0) * alpha;
          alphaSum += alpha;
          count += 1;
        }
      }
      if (alphaSum <= 0.001) continue;
      const targetOffset = (y * width + x) * 4;
      data[targetOffset] = quantizeTerrainChannel(r / alphaSum);
      data[targetOffset + 1] = quantizeTerrainChannel(g / alphaSum);
      data[targetOffset + 2] = quantizeTerrainChannel(b / alphaSum);
      data[targetOffset + 3] = Math.round(clamp(alphaSum / Math.max(1, count), 0, 1) * 255);
    }
  }
  return { width, height, data };
}

export function packRaceArtDocumentForRuntime(document = {}, {
  artRef = '',
  savedAt = 0,
  buildTexture = false
} = {}) {
  let data = document;
  if (!Array.isArray(data?.frames) && data?.tiles && typeof data.tiles === 'object') {
    data = Object.values(data.tiles).find((entry) => entry) || data;
  }
  const rawFrames = Array.isArray(data?.frames)
    ? data.frames
    : Array.isArray(data?.editor?.frames)
      ? data.editor.frames
      : [];
  const fallbackPixels = getFramePixels(data, data);
  const sources = rawFrames.length ? rawFrames : fallbackPixels ? [data] : [];
  const width = Math.max(1, Math.round(Number(data?.width || data?.editor?.width || data?.size || 16)));
  const height = Math.max(1, Math.round(Number(data?.height || data?.editor?.height || data?.size || width)));
  const frames = sources
    .map((frame, index) => {
      const pixels = getFramePixels(frame, data);
      return pixels ? { index, pixels: toRgbaPixels(pixels, width, height) } : null;
    })
    .filter(Boolean);
  if (!frames.length) return null;
  const baseLevel = { width, height, data: frames[0].pixels };
  return {
    packed: true,
    version: 1,
    artRef: String(artRef || '').trim(),
    savedAt: Number(savedAt || 0),
    width,
    height,
    frames,
    texture: buildTexture
      ? {
        mipLevels: buildMipLevels(baseLevel),
        terrainMipLevels: buildMipLevels(buildCleanTerrainBaseLevel(baseLevel), { quantize: true })
      }
      : null
  };
}

export function getPackedRaceArtTransferables(assets = []) {
  const buffers = new Set();
  (assets || []).forEach((asset) => {
    (asset?.frames || []).forEach((frame) => {
      if (frame?.pixels?.buffer) buffers.add(frame.pixels.buffer);
    });
    (asset?.texture?.mipLevels || []).forEach((level) => {
      if (level?.data?.buffer) buffers.add(level.data.buffer);
    });
    (asset?.texture?.terrainMipLevels || []).forEach((level) => {
      if (level?.data?.buffer) buffers.add(level.data.buffer);
    });
  });
  return [...buffers];
}

function makeMipReader(levels = [], { nearest = false } = {}) {
  return (levelIndex = 0, u = 0, v = 0) => {
    if (!levels.length) return null;
    const level = levels[clamp(Math.round(Number(levelIndex) || 0), 0, levels.length - 1)];
    const width = Math.max(1, Number(level.width) || 1);
    const height = Math.max(1, Number(level.height) || 1);
    const wrappedU = ((Number(u || 0) % 1) + 1) % 1;
    const wrappedV = ((Number(v || 0) % 1) + 1) % 1;
    const read = (x, y) => {
      const wrappedX = ((x % width) + width) % width;
      const wrappedY = ((y % height) + height) % height;
      const offset = (wrappedY * width + wrappedX) * 4;
      return {
        r: Number(level.data[offset] || 0),
        g: Number(level.data[offset + 1] || 0),
        b: Number(level.data[offset + 2] || 0),
        a: Number(level.data[offset + 3] || 0) / 255
      };
    };
    if (nearest) return read(Math.floor(wrappedU * width), Math.floor(wrappedV * height));
    const sourceX = wrappedU * width - 0.5;
    const sourceY = wrappedV * height - 0.5;
    const x0 = Math.floor(sourceX);
    const y0 = Math.floor(sourceY);
    const tx = sourceX - x0;
    const ty = sourceY - y0;
    const c00 = read(x0, y0);
    const c10 = read(x0 + 1, y0);
    const c01 = read(x0, y0 + 1);
    const c11 = read(x0 + 1, y0 + 1);
    const mix = (a, b, t) => a + (b - a) * t;
    return {
      r: mix(mix(c00.r, c10.r, tx), mix(c01.r, c11.r, tx), ty),
      g: mix(mix(c00.g, c10.g, tx), mix(c01.g, c11.g, tx), ty),
      b: mix(mix(c00.b, c10.b, tx), mix(c01.b, c11.b, tx), ty),
      a: mix(mix(c00.a, c10.a, tx), mix(c01.a, c11.a, tx), ty)
    };
  };
}

export function createPackedRaceArtTextureSampler(texture = null, {
  width = 1,
  height = 1,
  baseWorldM = 1
} = {}) {
  const mipLevels = texture?.mipLevels || [];
  const terrainMipLevels = texture?.terrainMipLevels || [];
  if (!mipLevels.length || !terrainMipLevels.length) return null;
  const readColor = makeMipReader(mipLevels);
  const readTerrainColor = makeMipReader(terrainMipLevels, { nearest: true });
  const toCss = (color) => color && color.a > 0.01
    ? `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`
    : null;
  const average = (levels, reader, baseWidth, baseHeight, u = 0, v = 0, footprint = 0) => {
    const pixelFootprint = Math.max(0, Number(footprint) || 0) * Math.max(baseWidth, baseHeight);
    const mip = pixelFootprint <= 1.15
      ? 0
      : clamp(Math.log2(pixelFootprint), 0, levels.length - 1);
    const low = Math.floor(mip);
    const high = Math.min(levels.length - 1, low + 1);
    const amount = mip - low;
    const first = reader(low, u, v);
    const second = reader(high, u, v) || first;
    if (!first && !second) return null;
    if (!first || !second || amount <= 0.0001) return toCss(first || second);
    return toCss({
      r: first.r + (second.r - first.r) * amount,
      g: first.g + (second.g - first.g) * amount,
      b: first.b + (second.b - first.b) * amount,
      a: first.a + (second.a - first.a) * amount
    });
  };
  return {
    width,
    height,
    mipLevels,
    terrainMipLevels,
    worldWidthUnits: Math.max(1, width / 32),
    worldHeightUnits: Math.max(1, height / 32),
    worldWidthM: Math.max(baseWorldM, (width / 32) * baseWorldM),
    worldHeightM: Math.max(baseWorldM, (height / 32) * baseWorldM),
    readColor: (u, v) => readColor(0, u, v),
    readTerrainColor: (u, v) => readTerrainColor(0, u, v),
    sample: (u, v) => toCss(readColor(0, u, v)),
    terrainSample: (u, v) => toCss(readTerrainColor(0, u, v)),
    averageSample: (u, v, footprint) => average(mipLevels, readColor, width, height, u, v, footprint),
    terrainAverageSample: (u, v, footprint) => {
      const base = terrainMipLevels[0] || { width, height };
      return average(
        terrainMipLevels,
        readTerrainColor,
        Math.max(1, Number(base.width) || 1),
        Math.max(1, Number(base.height) || 1),
        u,
        v,
        footprint
      );
    }
  };
}
