import LevelEditor from '../ui/LevelEditor.js';
import { createDescriptorModules, createModuleFromDescriptor } from './shared/createMethodProxy.js';

const editorModuleDescriptors = {
  stateModule: {
    methods: {
      transition: {},
      applyTransition: {}
    },
    extend: ({ target: editor }) => ({
      selectors() {
        return {
          world: editor.world,
          selection: editor.selection,
          activeTool: editor.activeTool,
          zoom: editor.zoom
        };
      }
    })
  },
  inputModule: {
    route: {},
    handlePointer: {}
  },
  renderModule: {
    render: 'draw',
    draw: 'draw'
  },
  uiModule: {
    trigger: {}
  }
};

export const createEditorStateModule = (editor) => createModuleFromDescriptor(editor, editorModuleDescriptors.stateModule);
export const createEditorInputModule = (editor) => createModuleFromDescriptor(editor, editorModuleDescriptors.inputModule);
export const createEditorRenderModule = (editor) => createModuleFromDescriptor(editor, editorModuleDescriptors.renderModule);
export const createEditorUIModule = (editor) => createModuleFromDescriptor(editor, editorModuleDescriptors.uiModule);

export default class Editor extends LevelEditor {
  constructor(...args) {
    super(...args);
    Object.assign(this, createDescriptorModules(this, editorModuleDescriptors));
  }
}
