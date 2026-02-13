export const createGameStateModule = (game) => ({
  transition(action, ...args) {
    if (typeof game[action] === 'function') return game[action](...args);
    return null;
  },
  snapshot() {
    return {
      state: game.state,
      world: game.world,
      player: game.player,
      enemies: game.enemies
    };
  }
});
