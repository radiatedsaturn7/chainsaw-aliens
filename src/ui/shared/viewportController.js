const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 8;
const DEFAULT_ZOOM_STEP = 0.1;

export function clampZoom(zoom, options = {}) {
  const minZoom = Number.isFinite(options.minZoom) ? options.minZoom : DEFAULT_MIN_ZOOM;
  const maxZoom = Number.isFinite(options.maxZoom) ? options.maxZoom : DEFAULT_MAX_ZOOM;
  const fallbackZoom = Number.isFinite(options.fallbackZoom) ? options.fallbackZoom : 1;
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return Math.min(maxZoom, Math.max(minZoom, fallbackZoom));
  }
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}

export function applyZoomStep(zoom, direction, options = {}) {
  const step = Number.isFinite(options.step) ? options.step : DEFAULT_ZOOM_STEP;
  const nextZoom = (Number.isFinite(zoom) ? zoom : 1) + step * Math.sign(direction || 0);
  return clampZoom(nextZoom, options);
}

export function startPan({ x, y, offsetX, offsetY }) {
  return {
    x,
    y,
    offsetX: Number.isFinite(offsetX) ? offsetX : 0,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0
  };
}

export function movePan(panState, payload, options = {}) {
  if (!panState) return null;
  const zoom = Number.isFinite(options.zoom) && options.zoom > 0 ? options.zoom : 1;
  const scaleWithZoom = options.scaleWithZoom !== false;
  const divisor = scaleWithZoom ? zoom : 1;
  const dx = ((payload?.x ?? panState.x) - panState.x) / divisor;
  const dy = ((payload?.y ?? panState.y) - panState.y) / divisor;
  return {
    offsetX: panState.offsetX - dx,
    offsetY: panState.offsetY - dy
  };
}

export function endPan() {
  return null;
}

export function startPinch({ x, y, distance, zoom, offsetX, offsetY }) {
  if (!Number.isFinite(distance) || distance <= 0) return null;
  return {
    x,
    y,
    distance,
    zoom: Number.isFinite(zoom) ? zoom : 1,
    offsetX: Number.isFinite(offsetX) ? offsetX : 0,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0
  };
}

export function movePinch(pinchState, payload, options = {}) {
  if (!pinchState) return null;
  const distance = Number.isFinite(payload?.distance) && payload.distance > 0 ? payload.distance : pinchState.distance;
  const scale = distance / pinchState.distance;
  const zoom = clampZoom(pinchState.zoom * scale, options);
  const scaleWithZoom = options.scaleWithZoom !== false;
  const divisor = scaleWithZoom ? zoom : 1;
  const dx = ((payload?.x ?? pinchState.x) - pinchState.x) / divisor;
  const dy = ((payload?.y ?? pinchState.y) - pinchState.y) / divisor;
  return {
    zoom,
    offsetX: pinchState.offsetX - dx,
    offsetY: pinchState.offsetY - dy
  };
}

export function endPinch() {
  return null;
}

export function worldToScreen(x, y, viewport) {
  const zoom = Number.isFinite(viewport?.zoom) ? viewport.zoom : 1;
  const offsetX = Number.isFinite(viewport?.offsetX) ? viewport.offsetX : 0;
  const offsetY = Number.isFinite(viewport?.offsetY) ? viewport.offsetY : 0;
  return {
    x: (x - offsetX) * zoom,
    y: (y - offsetY) * zoom
  };
}

export function screenToWorld(x, y, viewport) {
  const zoom = Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
  const offsetX = Number.isFinite(viewport?.offsetX) ? viewport.offsetX : 0;
  const offsetY = Number.isFinite(viewport?.offsetY) ? viewport.offsetY : 0;
  return {
    x: x / zoom + offsetX,
    y: y / zoom + offsetY
  };
}
