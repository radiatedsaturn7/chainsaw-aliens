export function createMidiEditorState(game) {
  return {
    enter() {
      game.playtestActive = false;
      document.body.classList.add('editor-active');
    },
    exit(nextState) {
      if (nextState !== 'editor' && nextState !== 'pixel-editor') {
        document.body.classList.remove('editor-active');
      }
    }
  };
}
