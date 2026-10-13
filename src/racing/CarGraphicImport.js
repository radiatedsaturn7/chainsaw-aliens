import { fitTireTextureRegions } from './CarTireTextureFit.js';
import { RACE_CAR_SHELL_FRAME_SLOTS } from './raceData.js';

export function carSheetDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Use an image containing 4 columns and 2 rows of sprites.');
  }
  if (width * height > 4194304) throw new Error('Please use a sheet with at most 4 million pixels.');
  return { width: width / 4, height: height / 2 };
}

// Choose transparent gutters near the expected grid. Each row gets its own
// column boundaries, so horizontally staggered artwork need not line up.
function gutter(counts, target, radius) {
  let best = -1;
  for (let i = Math.max(1, Math.ceil(target - radius)); i < Math.min(counts.length - 1, target + radius); i++) {
    if (!counts[i] && (best < 0 || Math.abs(i - target) < Math.abs(best - target))) best = i;
  }
  if (best < 0) throw new Error('Could not separate the sprites without cutting visible pixels. Use a transparent PNG with empty space between complete sprites.');
  return best;
}

export function prepareCarSheet(image, { alphaThreshold = 8, columns = 4, rows: rowCount = 2 } = {}) {
  if (![[4,2], [2,1], [1,2], [2,2]].some(([c,r]) => c === columns && r === rowCount)) throw new Error('Unsupported sheet layout');
  carSheetDimensions(image.width, image.height);
  const { width: sw, height: sh } = image;
  if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 32) throw new Error('Background cleanup must be between 0 and 32.');
  // Generated sheets can contain near-invisible alpha haze across empty gaps.
  // Clean a copy so changing the setting never destroys the source image.
  const data = new Uint8ClampedArray(image.data);
  let cleanedPixels = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0 && data[i] <= alphaThreshold) { data[i] = 0; cleanedPixels++; }
  }
  if (data.length !== sw * sh * 4) throw new Error('Invalid image pixel data.');
  const rows = new Uint32Array(sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (data[(y * sw + x) * 4 + 3]) rows[y]++;
  const split = gutter;
  const ys = rowCount === 1 ? [0, sh] : [0, split(rows, sh / 2, sh / 4), sh];
  const crops = [];
  const columnCount = columns;
  for (let row = 0; row < rowCount; row++) {
    const columns = new Uint32Array(sw);
    for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = 0; x < sw; x++) if (data[(y * sw + x) * 4 + 3]) columns[x]++;
    const xs = [0, ...Array.from({ length: columnCount - 1 }, (_, i) => split(columns, sw * (i + 1) / columnCount, sw / (columnCount * 2))), sw];
    for (let col = 0; col < columnCount; col++) {
      let left = sw, top = sh, right = -1, bottom = -1;
      for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = xs[col]; x < xs[col + 1]; x++) {
        if (!data[(y * sw + x) * 4 + 3]) continue;
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      if (right < left) throw new Error(`Frame ${crops.length + 1} is empty. Check that every cell in the selected layout contains artwork.`);
      crops.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
    }
  }
  // One pixel of padding on every edge; odd differences round to a pixel,
  // avoiding resampling or changing the relative scale of different views.
  const width = Math.max(...crops.map(c => c.width)) + 2;
  const height = Math.max(...crops.map(c => c.height)) + 2;
  const frames = crops.map(crop => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const dx = Math.floor((width - crop.width) / 2), dy = Math.floor((height - crop.height) / 2);
    for (let y = 0; y < crop.height; y++) {
      const start = ((crop.y + y) * sw + crop.x) * 4;
      pixels.set(data.subarray(start, start + crop.width * 4), ((dy + y) * width + dx) * 4);
    }
    return pixels;
  });
  return { width, height, frames, crops, cleanedPixels, alphaThreshold };
}

export function carSheetDocument(image, prepared = prepareCarSheet(image)) {
  const { width, height } = prepared;
  const frames = prepared.frames.map(data => {
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = data.subarray(i, i + 4);
      pixels.push(a ? '#' + [r, g, b, ...(a === 255 ? [] : [a])].map(n => n.toString(16).padStart(2, '0')).join('') : null);
    }
    return pixels;
  });
  return { frameBounds: prepared.crops.map(c => ({ x: Math.floor((width-c.width)/2), y: Math.floor((height-c.height)/2), width:c.width, height:c.height })), kind: 'actor-state-animation', width, height, ...(width === height ? { size: width } : {}), fps: 2, frames };
}

export function assignCarSheet(car, component, artRef, mapping, document = null) {
  if (!['body', 'tires', 'brakes', 'shadow'].includes(component) || mapping.length !== 8 || new Set(mapping).size !== 8 || mapping.some(n => !Number.isInteger(n) || n < 0 || n > 7)) {
    throw new Error('Assign each of the eight frames to one angle.');
  }
  car.art ||= {};
  car.art.angleLayers ||= {};
  RACE_CAR_SHELL_FRAME_SLOTS.forEach((slot, index) => {
    car.art.angleLayers[slot] ||= {};
    car.art.angleLayers[slot][component] = { ...car.art.angleLayers[slot][component], artRef, frameIndex: mapping[index] };
    if (component === 'body' && document) {
      const pixels = document.frames[mapping[index]];
      let left = document.width, right = -1, top = document.height, bottom = -1;
      pixels.forEach((pixel, i) => {
        if (!pixel || (pixel.length === 9 && pixel.slice(-2) === '00')) return;
        const x = i % document.width, y = Math.floor(i / document.width);
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      });
      if (right >= left) {
        const entry = car.art.angleLayers[slot][component];
        entry.fitToCar = true;
        entry.transforms = { ...entry.transforms,
          bodyScaleX: document.width / (right - left + 1),
          bodyScaleY: document.height / (bottom - top + 1)
        };
      }
    }
  });
}

export function assignCarTireSheet(car, artRef, document, { treadFrame = 0, wheelFrame = document.frames.length === 8 ? 2 : 1 } = {}) {
  if (![2,4,8].includes(document.frames.length) || [treadFrame,wheelFrame].some(i => !Number.isInteger(i) || i < 0 || i >= document.frames.length)) throw new Error('Select valid tread and wheel frames.');
  car.art ||= {};
  const fitted = fitTireTextureRegions(document.frames, document.width, document.height, { treadFrame, wheelFrame });
  const surface = (index, role) => ({ artRef, frameIndex:index, ...fitted[role] });
  car.art.tireSurfaces = { tread:surface(treadFrame,'tread'), wheel:surface(wheelFrame,'wheel') };
  car.art.angleLayers ||= {};
  RACE_CAR_SHELL_FRAME_SLOTS.forEach(slot => {
    car.art.angleLayers[slot] ||= {};
    car.art.angleLayers[slot].tires = { tireMode:'auto', ...car.art.angleLayers[slot].tires, cylinder:true, ...surface(['left','right'].includes(slot) ? wheelFrame : treadFrame, ['left','right'].includes(slot) ? 'wheel' : 'tread') };
  });
}
