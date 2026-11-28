// The 3D world is rendered offscreen, then composited into the unchanged 2D
// game viewport. The optional display mode adds bounded sampling on HiDPI;
// it does not raise the authored minimum, or lower explicit supersampling.
const WORLD_MAX_WIDTH = 32768;
const WORLD_MAX_HEIGHT = 18432;
const MAX_DISPLAY_DENSITY = 1.5;
const DISPLAY_PIXEL_BUDGET = 1280 * 720;

export function readRace3dPresentationOptions(search = '') {
  const params = new URLSearchParams(search);
  return {
    displayDensity: params.get('race3dResolution') === 'display',
    linearFilter: params.get('race3dFilter') === 'linear'
  };
}

export function race3dTargetSize(bounds, authoredScale, context, options) {
  const width = Math.min(WORLD_MAX_WIDTH, Math.max(1, Math.round(Number(bounds?.w || 1) * authoredScale)));
  const height = Math.min(WORLD_MAX_HEIGHT, Math.max(1, Math.round(Number(bounds?.h || 1) * authoredScale)));
  if (!options?.displayDensity) return { width, height, density: 1 };
  const transform = context?.getTransform?.();
  if (!transform) return { width, height, density: 1 };
  // The destination can already be scaled or downscaled by the handheld UI.
  // Use its real compositing transform rather than window.devicePixelRatio.
  const target = Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d));
  if (!Number.isFinite(target)) return { width, height, density: 1 };
  const density = Math.max(1, Math.min(
    Math.floor(target * 4) / 4,
    MAX_DISPLAY_DENSITY,
    Math.sqrt(DISPLAY_PIXEL_BUDGET / (width * height)),
    WORLD_MAX_WIDTH / width,
    WORLD_MAX_HEIGHT / height
  ));
  if (density === 1) return { width, height, density };
  return { width: Math.floor(width * density), height: Math.floor(height * density), density };
}

export function compositeRace3dWorld(context, canvas, bounds, options) {
  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = options?.linearFilter === true;
  try {
    context.drawImage(canvas, Number(bounds.x || 0), Number(bounds.y || 0), Number(bounds.w || 1), Number(bounds.h || 1));
  } finally {
    // The race HUD, portraits, and pixel art keep their original sampling.
    context.imageSmoothingEnabled = previousSmoothing;
  }
}
