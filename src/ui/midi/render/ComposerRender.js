import { createMethodProxy } from '../../../editor/shared/createMethodProxy.js';

export const createComposerRenderModule = (composer) => (
  createMethodProxy(composer, {
    draw: 'draw',
    render: 'draw'
  })
);
