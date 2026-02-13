export function createPixelEditorState(game) {
  return {
    enter() {
      game.playtestActive = false;
      game.pixelStudio.resetFocus();
      document.body.classList.add('editor-active');
    },
    exit(nextState) {
      if (nextState !== 'editor' && nextState !== 'midi-editor') {
        document.body.classList.remove('editor-active');
      }
    }
  };
}
