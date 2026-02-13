export const createGameRenderModule = (game) => ({
  render(method = 'draw', ...args) {
    if (typeof game[method] === 'function') return game[method](...args);
    return null;
  }
});
