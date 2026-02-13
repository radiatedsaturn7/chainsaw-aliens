import { createMethodProxy } from '../shared/createMethodProxy.js';

export const createEditorUIModule = (editor) => (
  createMethodProxy(editor, {
    trigger: {}
  })
);
