export function parseArtPixelRgba(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      r: value & 255,
      g: (value >>> 8) & 255,
      b: (value >>> 16) & 255,
      a: (value >>> 24) & 255
    };
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text)) return null;
  const hex = text.startsWith('#') ? text.slice(1) : text;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255
  };
}

export function resolveArtDocument(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.frames) || Array.isArray(data?.editor?.frames)) return data;
  if (data.tiles && typeof data.tiles === 'object') {
    return Object.values(data.tiles).find((entry) => entry && typeof entry === 'object') || data;
  }
  return data;
}

export function getArtDocumentFrames(data) {
  const source = resolveArtDocument(data);
  const frames = Array.isArray(source?.frames)
    ? source.frames
    : (Array.isArray(source?.editor?.frames) ? source.editor.frames : []);
  return { frames, source };
}

export function normalizeArtFramePixels(frame, source = {}) {
  if (!frame) return null;
  if (Array.isArray(frame) && frame.length && !Array.isArray(frame[0])) return frame;
  if (Array.isArray(frame) && Array.isArray(frame[0])) return frame[0];
  if (typeof frame !== 'object') return null;
  if (Array.isArray(frame.pixels) && frame.pixels.length) return frame.pixels;
  if (Array.isArray(frame.data) && frame.data.length) return frame.data;
  const layers = Array.isArray(frame.layers) ? frame.layers : [];
  const width = Math.max(1, Math.round(Number(source?.width || source?.editor?.width || source?.size || 16)));
  const height = Math.max(1, Math.round(Number(source?.height || source?.editor?.height || source?.size || width)));
  const composite = new Array(width * height).fill(null);
  let painted = false;
  layers.forEach((layer) => {
    if (layer?.visible === false) return;
    const pixels = Array.isArray(layer?.pixels) ? layer.pixels : (Array.isArray(layer?.data) ? layer.data : null);
    if (!pixels) return;
    pixels.forEach((value, index) => {
      const rgba = parseArtPixelRgba(value);
      if (!rgba || rgba.a === 0) return;
      composite[index] = value;
      painted = true;
    });
  });
  return painted ? composite : null;
}

export function buildArtPreviewPixels(data, { frameIndex = 0, maxDimension = 64 } = {}) {
  const { frames, source } = getArtDocumentFrames(data);
  if (!frames.length || !source) return null;
  const index = Math.max(0, Math.round(Number(frameIndex) || 0)) % frames.length;
  const pixels = normalizeArtFramePixels(frames[index], source);
  if (!Array.isArray(pixels) || !pixels.length) return null;
  const width = Math.max(1, Math.round(Number(source.width || source?.editor?.width || source.size || Math.sqrt(pixels.length) || 1)));
  const height = Math.max(1, Math.round(Number(source.height || source?.editor?.height || source.size || Math.ceil(pixels.length / width) || width)));
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / Math.max(1, maxDimension)));
  const previewWidth = Math.max(1, Math.floor(width / scale));
  const previewHeight = Math.max(1, Math.floor(height / scale));
  const rgba = new Uint8ClampedArray(previewWidth * previewHeight * 4);
  let visiblePixelCount = 0;
  for (let y = 0; y < previewHeight; y += 1) {
    for (let x = 0; x < previewWidth; x += 1) {
      const color = parseArtPixelRgba(pixels[Math.min(height - 1, y * scale) * width + Math.min(width - 1, x * scale)]);
      if (!color) continue;
      const offset = (y * previewWidth + x) * 4;
      rgba[offset] = color.r;
      rgba[offset + 1] = color.g;
      rgba[offset + 2] = color.b;
      rgba[offset + 3] = color.a;
      if (color.a > 0) visiblePixelCount += 1;
    }
  }
  return { width: previewWidth, height: previewHeight, rgba, visiblePixelCount };
}
