export const createGameSystemsModule = (game) => ({
  update(systemMethod, ...args) {
    if (typeof game[systemMethod] === 'function') return game[systemMethod](...args);
    return null;
  }
});
