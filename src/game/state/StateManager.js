export default class StateManager {
  constructor({ initialState = 'loading', handlers = {}, onTransition = null } = {}) {
    this.currentState = initialState;
    this.handlers = handlers;
    this.onTransition = onTransition;
  }

  setHandlers(handlers = {}) {
    this.handlers = handlers;
  }

  transition(nextState, context = {}) {
    if (!nextState || nextState === this.currentState) return this.currentState;
    const prevState = this.currentState;
    const prevHandler = this.handlers[prevState];
    if (prevHandler?.exit) prevHandler.exit(nextState, context);

    this.currentState = nextState;

    if (this.onTransition) {
      this.onTransition({ prevState, nextState, context });
    }

    const nextHandler = this.handlers[nextState];
    if (nextHandler?.enter) nextHandler.enter(prevState, context);
    return this.currentState;
  }
}
