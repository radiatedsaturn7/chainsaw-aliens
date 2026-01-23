export default class InputEventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const handlers = this.listeners.get(type);
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  emit(type, payload) {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    handlers.forEach((handler) => handler(payload));
  }
}
