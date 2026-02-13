export const createEditorRenderModule = (editor) => ({
  render(method = 'draw', ...args) {
    if (typeof editor[method] === 'function') return editor[method](...args);
    return null;
  }
});
