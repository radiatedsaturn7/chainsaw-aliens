export const createEditorStateModule = (editor) => ({
  transition(action, ...args) {
    if (typeof editor[action] === 'function') return editor[action](...args);
    return null;
  },
  selectors() {
    return {
      world: editor.world,
      selection: editor.selection,
      activeTool: editor.activeTool,
      zoom: editor.zoom
    };
  }
});
