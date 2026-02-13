const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const worldToScreen = (point, viewport) => {
  const zoom = Number.isFinite(viewport?.zoom) ? viewport.zoom : 1;
  const camX = Number.isFinite(viewport?.x) ? viewport.x : 0;
  const camY = Number.isFinite(viewport?.y) ? viewport.y : 0;
  return {
    x: (point.x - camX) * zoom,
    y: (point.y - camY) * zoom
  };
};

export const screenToWorld = (point, viewport) => {
  const zoom = Number.isFinite(viewport?.zoom) && viewport.zoom !== 0 ? viewport.zoom : 1;
  const camX = Number.isFinite(viewport?.x) ? viewport.x : 0;
  const camY = Number.isFinite(viewport?.y) ? viewport.y : 0;
  return {
    x: point.x / zoom + camX,
    y: point.y / zoom + camY
  };
};

export const createViewportController = (options = {}) => {
  const state = {
    pan: null,
    pinch: null
  };

  const resolveZoomBounds = (overrides = {}) => ({
    min: Number.isFinite(overrides.minZoom) ? overrides.minZoom : (Number.isFinite(options.minZoom) ? options.minZoom : 0.1),
    max: Number.isFinite(overrides.maxZoom) ? overrides.maxZoom : (Number.isFinite(options.maxZoom) ? options.maxZoom : 10)
  });

  return {
    clampZoom(value, overrides = {}) {
      const { min, max } = resolveZoomBounds(overrides);
      const fallback = Number.isFinite(options.defaultZoom) ? options.defaultZoom : min;
      const numeric = Number.isFinite(value) ? value : fallback;
      return clamp(numeric, min, max);
    },

    zoomWithStep(currentValue, stepDelta, overrides = {}) {
      const step = Number.isFinite(overrides.zoomStep) ? overrides.zoomStep : (Number.isFinite(options.zoomStep) ? options.zoomStep : 1);
      const next = Number.isFinite(currentValue) ? currentValue + stepDelta * step : stepDelta * step;
      return this.clampZoom(next, overrides);
    },

    zoomWithFactor(currentZoom, deltaY, overrides = {}) {
      const zoomInFactor = Number.isFinite(overrides.zoomInFactor) ? overrides.zoomInFactor : (Number.isFinite(options.zoomInFactor) ? options.zoomInFactor : 1.1);
      const zoomOutFactor = Number.isFinite(overrides.zoomOutFactor) ? overrides.zoomOutFactor : (Number.isFinite(options.zoomOutFactor) ? options.zoomOutFactor : 0.9);
      const factor = deltaY > 0 ? zoomOutFactor : zoomInFactor;
      return this.clampZoom((Number.isFinite(currentZoom) ? currentZoom : 1) * factor, overrides);
    },

    beginPan(payload, current = {}, extra = {}) {
      state.pan = {
        x: payload.x,
        y: payload.y,
        startX: Number.isFinite(current.x) ? current.x : 0,
        startY: Number.isFinite(current.y) ? current.y : 0,
        source: extra.source || 'pointer'
      };
      return state.pan;
    },

    updatePan(payload, extra = {}) {
      if (!state.pan) return null;
      const scaleX = Number.isFinite(extra.scaleX) ? extra.scaleX : 1;
      const scaleY = Number.isFinite(extra.scaleY) ? extra.scaleY : 1;
      return {
        x: state.pan.startX + (payload.x - state.pan.x) * scaleX,
        y: state.pan.startY + (payload.y - state.pan.y) * scaleY,
        source: state.pan.source
      };
    },

    endPan() {
      state.pan = null;
    },

    beginPinch(payload, context = {}) {
      state.pinch = {
        startDistance: payload.distance,
        startX: payload.x,
        startY: payload.y,
        context
      };
      return state.pinch;
    },

    updatePinch(payload) {
      if (!state.pinch?.startDistance) return null;
      return {
        scale: payload.distance / state.pinch.startDistance,
        deltaX: payload.x - state.pinch.startX,
        deltaY: payload.y - state.pinch.startY,
        context: state.pinch.context
      };
    },

    endPinch() {
      state.pinch = null;
    },

    cancelInteractions() {
      state.pan = null;
      state.pinch = null;
    },

    getState() {
      return state;
    }
  };
};
