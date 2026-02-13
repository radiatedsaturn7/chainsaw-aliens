import EditorCore from './EditorCore.js';
import { createEditorStateModule } from './state/EditorState.js';
import { createEditorInputModule } from './input/EditorInput.js';
import { createEditorRenderModule } from './render/EditorRender.js';
import { createEditorUIModule } from './ui/EditorUI.js';

export default class Editor extends EditorCore {
  constructor(...args) {
    super(...args);
    this.stateModule = createEditorStateModule(this);
    this.inputModule = createEditorInputModule(this);
    this.renderModule = createEditorRenderModule(this);
    this.uiModule = createEditorUIModule(this);
  }
}
