export default class UndoStack {
  constructor(limit = 50) {
    this.limit = limit;
    this.stack = [];
    this.redoStack = [];
  }

  push(entry) {
    if (!entry) return;
    this.stack.push(entry);
    if (this.stack.length > this.limit) {
      this.stack.shift();
    }
    this.redoStack = [];
  }

  canUndo() {
    return this.stack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    const entry = this.stack.pop();
    this.redoStack.push(entry);
    return entry;
  }

  redo() {
    if (!this.canRedo()) return null;
    const entry = this.redoStack.pop();
    this.stack.push(entry);
    return entry;
  }
}
