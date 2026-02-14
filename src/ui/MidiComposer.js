import MidiComposerCore from './MidiComposerCore.js';
import { createDescriptorModules, createModuleFromDescriptor } from '../editor/shared/createMethodProxy.js';

const composerModuleDescriptors = {
  stateModule: {
    methods: {
      applyTransition: {},
      transition: {}
    },
    extend: ({ target: composer }) => ({
      getSnapshot() {
        return {
          song: composer.song,
          selection: composer.selection,
          timeline: composer.timeline,
          tracks: composer.song?.tracks || []
        };
      }
    })
  },
  inputModule: {
    handlePointer: {},
    route: {},
    handleKeyboard: {},
    handleGesture: {}
  },
  renderModule: {
    draw: 'draw',
    render: 'draw'
  },
  ioModule: {
    perform: {}
  }
};

export const createComposerStateModule = (composer) => createModuleFromDescriptor(composer, composerModuleDescriptors.stateModule);
export const createComposerInputModule = (composer) => createModuleFromDescriptor(composer, composerModuleDescriptors.inputModule);
export const createComposerRenderModule = (composer) => createModuleFromDescriptor(composer, composerModuleDescriptors.renderModule);
export const createComposerIOModule = (composer) => createModuleFromDescriptor(composer, composerModuleDescriptors.ioModule);

export default class MidiComposer extends MidiComposerCore {
  constructor(...args) {
    super(...args);
    Object.assign(this, createDescriptorModules(this, composerModuleDescriptors));
  }
}
