export const createComposerStateModule = (composer) => ({
  applyTransition(transition, ...args) {
    if (transition && typeof composer[transition] === 'function') {
      return composer[transition](...args);
    }
    return null;
  },
  getSnapshot() {
    return {
      song: composer.song,
      selection: composer.selection,
      timeline: composer.timeline,
      tracks: composer.song?.tracks || []
    };
  }
});
