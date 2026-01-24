import { uint32ToRgba, rgbaToUint32 } from './palette.js';

export const createLayer = (width, height, name = 'Layer') => ({
  name,
  visible: true,
  locked: false,
  opacity: 1,
  pixels: new Uint32Array(width * height)
});

export const cloneLayer = (layer) => ({
  name: layer.name,
  visible: layer.visible,
  locked: layer.locked,
  opacity: layer.opacity,
  pixels: new Uint32Array(layer.pixels)
});

export const clearLayer = (layer) => {
  layer.pixels.fill(0);
};

const blendChannel = (src, dst, alpha) => Math.round(src * alpha + dst * (1 - alpha));

export const blendPixels = (dstValue, srcValue, opacity = 1) => {
  const src = uint32ToRgba(srcValue);
  if (!src.a) return dstValue;
  const dst = uint32ToRgba(dstValue);
  const srcAlpha = (src.a / 255) * opacity;
  const outA = srcAlpha + (dst.a / 255) * (1 - srcAlpha);
  if (outA <= 0) return 0;
  const outR = blendChannel(src.r, dst.r, srcAlpha / outA);
  const outG = blendChannel(src.g, dst.g, srcAlpha / outA);
  const outB = blendChannel(src.b, dst.b, srcAlpha / outA);
  return rgbaToUint32({ r: outR, g: outG, b: outB, a: Math.round(outA * 255) });
};

export const compositeLayers = (layers, width, height) => {
  const output = new Uint32Array(width * height);
  layers.forEach((layer) => {
    if (!layer.visible || layer.opacity <= 0) return;
    for (let i = 0; i < output.length; i += 1) {
      const src = layer.pixels[i];
      if (!src) continue;
      output[i] = blendPixels(output[i], src, layer.opacity);
    }
  });
  return output;
};

export const mergeDown = (layers, index) => {
  if (index <= 0 || index >= layers.length) return layers;
  const upper = layers[index];
  const lower = layers[index - 1];
  const merged = cloneLayer(lower);
  merged.name = `${lower.name}+${upper.name}`;
  for (let i = 0; i < merged.pixels.length; i += 1) {
    merged.pixels[i] = blendPixels(lower.pixels[i], upper.pixels[i], upper.opacity);
  }
  const nextLayers = layers.map((layer, idx) => {
    if (idx === index - 1) return merged;
    if (idx === index) return null;
    return layer;
  }).filter(Boolean);
  return nextLayers;
};

export const flattenLayers = (layers, width, height) => {
  const merged = createLayer(width, height, 'Flattened');
  merged.pixels = compositeLayers(layers, width, height);
  return [merged];
};

export const reorderLayer = (layers, from, to) => {
  const next = layers.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
