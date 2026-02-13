export const createComposerInputModule = (composer) => ({
  handlePointer(eventName, ...args) {
    if (typeof composer[eventName] === 'function') return composer[eventName](...args);
    return null;
  },
  handleKeyboard(eventName, ...args) {
    if (typeof composer[eventName] === 'function') return composer[eventName](...args);
    return null;
  },
  handleGesture(eventName, ...args) {
    if (typeof composer[eventName] === 'function') return composer[eventName](...args);
    return null;
  }
});
