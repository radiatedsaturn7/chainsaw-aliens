export function createRobterSessionState(game) {
  return {
    enter() {
      game.setRevAudio(false);
      game.playtestActive = false;
      document.body.classList.remove('editor-active');
    }
  };
}
