import GameCore from './GameCore.js';
import { createGameStateModule } from './state/GameState.js';
import { createGameSystemsModule } from './systems/GameSystems.js';
import { createGameRenderModule } from './render/GameRender.js';
import { createGameFlowModule } from './flow/GameFlow.js';

export default class Game extends GameCore {
  constructor(...args) {
    super(...args);
    this.stateModule = createGameStateModule(this);
    this.systemsModule = createGameSystemsModule(this);
    this.renderModule = createGameRenderModule(this);
    this.flowModule = createGameFlowModule(this);
  }
}
