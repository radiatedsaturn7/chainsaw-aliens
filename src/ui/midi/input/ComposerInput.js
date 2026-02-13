import { createMethodProxy } from '../../../editor/shared/createMethodProxy.js';

export const createComposerInputModule = (composer) => (
  createMethodProxy(composer, {
    handlePointer: {},
    route: {},
    handleKeyboard: {},
    handleGesture: {}
  })
);
