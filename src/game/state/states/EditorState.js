export function createEditorState(game) {
  return {
    enter() {
      game.playtestActive = false;
      document.body.classList.add('editor-active');
    },
    exit(nextState) {
      if (nextState !== 'pixel-editor' && nextState !== 'midi-editor') {
        document.body.classList.remove('editor-active');
      }
    }
  };
}
