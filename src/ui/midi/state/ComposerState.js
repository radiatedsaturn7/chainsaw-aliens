import { createMethodProxy } from '../../../editor/shared/createMethodProxy.js';

export const createComposerStateModule = (composer) => ({
  ...createMethodProxy(composer, {
    applyTransition: {},
    transition: {}
  }),
  getSnapshot() {
    return {
      song: composer.song,
      selection: composer.selection,
      timeline: composer.timeline,
      tracks: composer.song?.tracks || []
    };
  }
});
