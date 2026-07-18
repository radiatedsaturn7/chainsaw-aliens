import { loadProjectFile } from '../projectFiles.js';

export function getRaceArtSpriteCanvasShared(artRef = '', {
  frameIndex = 0,
  cache = null,
  documentRef = typeof document !== 'undefined' ? document : null,
  playtestSession = null,
  racePreloadingArt = false,
  getNowMs = () => 0,
  onRuntimeMiss = null
} = {}) {
  const clean = String(artRef || '').trim();
  if (!clean || !documentRef) return null;
  const requestedFrameIndex = Math.max(0, Math.round(Number(frameIndex) || 0));
  const missStartMs = playtestSession && !racePreloadingArt ? getNowMs() : 0;
  const payload = loadProjectFile('art', clean);
  const cacheKey = `${clean}:${Number(payload?.savedAt || 0)}:frame:${requestedFrameIndex}`;
  if (cache?.has?.(cacheKey)) return cache.get(cacheKey);
  let data = payload?.data || payload;
  if (payload?.__chainsawStorage && typeof payload.data === 'string' && payload.encoding === 'json') {
    try {
      data = JSON.parse(payload.data);
    } catch (_error) {
      data = null;
    }
  }
  if (!Array.isArray(data?.frames) && data?.tiles && typeof data.tiles === 'object') {
    data = Object.values(data.tiles).find((entry) => entry) || data;
  }
  const rawFrames = Array.isArray(data?.frames)
    ? data.frames
    : (Array.isArray(data?.editor?.frames) ? data.editor.frames : []);
  const frame = rawFrames[requestedFrameIndex] || rawFrames[0] || null;
  const normalizeFramePixels = (source) => {
    if (!source) return null;
    if (Array.isArray(source) && source.length && !Array.isArray(source[0])) return source;
    if (Array.isArray(source) && Array.isArray(source[0])) return source[0];
    if (source && typeof source === 'object') {
      if (Array.isArray(source.pixels) && source.pixels.length) return source.pixels;
      if (Array.isArray(source.data) && source.data.length) return source.data;
      const layers = Array.isArray(source.layers) ? source.layers : [];
      const width = Math.max(1, Math.round(Number(data?.width || data?.editor?.width || data?.size || 16)));
      const height = Math.max(1, Math.round(Number(data?.height || data?.editor?.height || data?.size || width)));
      const composite = new Array(width * height).fill(0);
      let painted = false;
      layers.forEach((layer) => {
        if (layer?.visible === false) return;
        const pixels = Array.isArray(layer?.pixels) ? layer.pixels : Array.isArray(layer?.data) ? layer.data : null;
        if (!pixels) return;
        pixels.forEach((value, index) => {
          if (!value) return;
          composite[index] = value;
          painted = true;
        });
      });
      if (painted) return composite;
    }
    return null;
  };
  const pixels = normalizeFramePixels(frame) || normalizeFramePixels(data);
  if (!Array.isArray(pixels) || !pixels.length) {
    cache?.set?.(cacheKey, null);
    return null;
  }
  const width = Math.max(1, Math.round(Number(data?.width || data?.editor?.width || data?.size || Math.sqrt(pixels.length) || 16)));
  const height = Math.max(1, Math.round(Number(data?.height || data?.editor?.height || data?.size || Math.ceil(pixels.length / width) || width)));
  const canvas = documentRef.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.__raceArtCacheKey = cacheKey;
  const artCtx = canvas.getContext('2d');
  if (!artCtx) {
    cache?.set?.(cacheKey, null);
    return null;
  }
  const parsePixel = (value) => {
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
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255
    };
  };
  if (typeof artCtx.createImageData === 'function' && typeof artCtx.putImageData === 'function') {
    const imageData = artCtx.createImageData(width, height);
    for (let i = 0; i < width * height; i += 1) {
      const color = parsePixel(pixels[i]);
      const base = i * 4;
      if (!color || color.a === 0) {
        imageData.data[base + 3] = 0;
        continue;
      }
      imageData.data[base] = color.r;
      imageData.data[base + 1] = color.g;
      imageData.data[base + 2] = color.b;
      imageData.data[base + 3] = color.a;
    }
    artCtx.putImageData(imageData, 0, 0);
  } else {
    pixels.forEach((value, index) => {
      const color = parsePixel(value);
      if (!color || color.a === 0) return;
      artCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
      artCtx.fillRect(index % width, Math.floor(index / width), 1, 1);
    });
  }
  cache?.set?.(cacheKey, canvas);
  if (missStartMs > 0 && typeof onRuntimeMiss === 'function') {
    onRuntimeMiss(Math.max(0, getNowMs() - missStartMs));
  }
  return canvas;
}
