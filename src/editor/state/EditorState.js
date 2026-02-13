import { createMethodProxy } from '../shared/createMethodProxy.js';

export const createEditorStateModule = (editor) => ({
  ...createMethodProxy(editor, {
    transition: {},
    applyTransition: {}
  }),
  selectors() {
    return {
      world: editor.world,
      selection: editor.selection,
      activeTool: editor.activeTool,
      zoom: editor.zoom
    };
  }
});
