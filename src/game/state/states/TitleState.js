export function createTitleState(game) {
  return {
    enter() {
      game.playtestActive = false;
      game.setRevAudio(false);
      document.body.classList.remove('editor-active');
    }
  };
}
