export const createEditorInputModule = (editor) => ({
  route(eventName, ...args) {
    if (typeof editor[eventName] === 'function') return editor[eventName](...args);
    return null;
  }
});
