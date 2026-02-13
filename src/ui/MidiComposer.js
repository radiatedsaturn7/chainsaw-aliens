import MidiComposerCore from './MidiComposerCore.js';
import { createComposerStateModule } from './midi/state/ComposerState.js';
import { createComposerInputModule } from './midi/input/ComposerInput.js';
import { createComposerRenderModule } from './midi/render/ComposerRender.js';
import { createComposerIOModule } from './midi/io/ComposerIO.js';

export default class MidiComposer extends MidiComposerCore {
  constructor(...args) {
    super(...args);
    this.stateModule = createComposerStateModule(this);
    this.inputModule = createComposerInputModule(this);
    this.renderModule = createComposerRenderModule(this);
    this.ioModule = createComposerIOModule(this);
  }
}
