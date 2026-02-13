import { createMethodProxy } from '../shared/createMethodProxy.js';

export const createEditorInputModule = (editor) => (
  createMethodProxy(editor, {
    route: {},
    handlePointer: {}
  })
);
