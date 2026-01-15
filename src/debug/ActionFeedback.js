export const ACTIONS = [
  'move',
  'jump',
  'land',
  'dash',
  'chainsaw bite',
  'chainsaw rev',
  'hit',
  'stagger',
  'execute',
  'take damage',
  'interact',
  'pickup',
  'menu navigate'
];

export default class ActionFeedback {
  constructor() {
    this.window = 2.5;
    this.events = new Map();
    ACTIONS.forEach((action) => {
      this.events.set(action, { visual: -Infinity, audio: -Infinity });
    });
  }

  reset() {
    ACTIONS.forEach((action) => {
      this.events.set(action, { visual: -Infinity, audio: -Infinity });
    });
  }

  record(action, type, time) {
    if (!this.events.has(action)) return;
    const entry = this.events.get(action);
    entry[type] = time;
  }

  status(action, time) {
    const entry = this.events.get(action);
    if (!entry) return 'fail';
    const visual = time - entry.visual <= this.window;
    const audio = time - entry.audio <= this.window;
    if (visual && audio) return 'pass';
    if (!visual && !audio) return 'fail';
    return 'warn';
  }

  summary(time) {
    const results = [];
    ACTIONS.forEach((action) => {
      results.push({ action, status: this.status(action, time) });
    });
    return results;
  }
}
