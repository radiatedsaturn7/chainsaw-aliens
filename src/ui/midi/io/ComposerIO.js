import { createMethodProxy } from '../../../editor/shared/createMethodProxy.js';

export const createComposerIOModule = (composer) => (
  createMethodProxy(composer, {
    perform: {}
  })
);
