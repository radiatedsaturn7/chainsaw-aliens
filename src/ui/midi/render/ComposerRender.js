export const createComposerRenderModule = (composer) => ({
  draw(method = 'draw', ...args) {
    if (typeof composer[method] === 'function') return composer[method](...args);
    return null;
  }
});
