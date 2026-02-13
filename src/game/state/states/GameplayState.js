function releaseInputCapture() {
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  if (document.releasePointerCapture) {
    try {
      document.releasePointerCapture();
    } catch (_) {
      // no-op: best effort cleanup for post-playtest input lockups
    }
  }
}

export function createGameplayState(game) {
  return {
    enter() {
      document.body.classList.remove('editor-active');
    },
    exit(nextState) {
      if (nextState === 'editor' || nextState === 'pixel-editor' || nextState === 'midi-editor') {
        releaseInputCapture();
        game.mobileControls.reset();
        game.input.reset();
      }
    }
  };
}
