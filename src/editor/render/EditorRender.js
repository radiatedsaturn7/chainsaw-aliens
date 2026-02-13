import { createMethodProxy } from '../shared/createMethodProxy.js';

export const createEditorRenderModule = (editor) => (
  createMethodProxy(editor, {
    render: 'draw',
    draw: 'draw'
  })
);
