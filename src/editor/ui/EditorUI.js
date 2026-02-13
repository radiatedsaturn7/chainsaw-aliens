export const createEditorUIModule = (editor) => ({
  trigger(action, ...args) {
    if (typeof editor[action] === 'function') return editor[action](...args);
    return null;
  }
});
