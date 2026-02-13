export const createGameFlowModule = (game) => ({
  run(step, ...args) {
    if (typeof game[step] === 'function') return game[step](...args);
    return null;
  }
});
