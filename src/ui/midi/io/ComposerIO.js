export const createComposerIOModule = (composer) => ({
  perform(action, ...args) {
    if (typeof composer[action] === 'function') return composer[action](...args);
    return null;
  }
});
