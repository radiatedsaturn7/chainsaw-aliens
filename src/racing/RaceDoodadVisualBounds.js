// Crop transparent billboard borders without changing saved art or collision sizes.
// Canvas identity plus its content revision keeps the alpha scan off the frame loop.
const cache = new WeakMap();
export function doodadAlphaBounds(canvas) {
  if (!canvas?.width || !canvas?.height) return null;
  const key = canvas.__raceArtCacheKey || '';
  const old = cache.get(canvas);
  if (old?.key === key && old.width === canvas.width && old.height === canvas.height) return old.bounds;
  const width = canvas.width, height = canvas.height;
  let bounds = null;
  try {
    const data = canvas.getContext?.('2d')?.getImageData(0, 0, width, height)?.data;
    if (data) {
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] < 32) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      if (right >= left) bounds = { x: left, y: top, width: right-left+1, height: bottom-top+1, imageWidth: width, imageHeight: height };
    }
  } catch { /* Non-readable canvases keep their original mapping. */ }
  cache.set(canvas, { key, width, height, bounds });
  return bounds;
}

export function doodadVisualLayout(doodad, canvas, { fence = false } = {}) {
  const widthM = Math.max(.001, Number(doodad.widthM) || 1.5);
  const heightM = Math.max(.05, Number(doodad.heightM) || 2);
  const offset = Number(doodad.groundOffsetM) || 0;
  const crop = !fence && !doodad.isFence && !doodad.model?.ref ? doodadAlphaBounds(canvas) : null;
  if (!crop) return { widthM, heightM, groundOffsetM: offset, crop: null, u0: 0, u1: 1, v0: 0, v1: 1 };
  const bottomPaddingM = heightM * (1-(crop.y+crop.height)/crop.imageHeight);
  return {
    widthM: widthM * crop.width/crop.imageWidth,
    heightM: heightM * crop.height/crop.imageHeight,
    // Previously authored padding compensation is removed exactly once. Any
    // additional intentional planting depth (or negative lift) is retained.
    groundOffsetM: offset < 0 ? offset : Math.max(0, offset-bottomPaddingM),
    crop, u0: crop.x/crop.imageWidth, u1: (crop.x+crop.width)/crop.imageWidth,
    v0: 1-(crop.y+crop.height)/crop.imageHeight, v1: 1-crop.y/crop.imageHeight
  };
}
