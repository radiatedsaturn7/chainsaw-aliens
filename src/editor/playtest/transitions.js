export const startPlaytestTransition = (game) => game.exitEditor({ playtest: true });
export const stopPlaytestTransition = (game, options = {}) => game.exitEditor({ playtest: false, ...options });
