const defaultEquality = (left, right) => left === right;

export class SnapshotHistory {
  constructor({
    limit = 50,
    debounceMs = 0,
    createSnapshot = null,
    applySnapshot = null,
    areSnapshotsEqual = defaultEquality,
    schedule = (callback, ms) => window.setTimeout(callback, ms),
    clearScheduled = (timerId) => window.clearTimeout(timerId),
    onUndo = null,
    onRedo = null
  } = {}) {
    this.limit = Math.max(1, Number(limit) || 1);
    this.debounceMs = Math.max(0, Number(debounceMs) || 0);
    this.createSnapshot = typeof createSnapshot === 'function' ? createSnapshot : null;
    this.applySnapshot = typeof applySnapshot === 'function' ? applySnapshot : null;
    this.areSnapshotsEqual = typeof areSnapshotsEqual === 'function' ? areSnapshotsEqual : defaultEquality;
    this.schedule = typeof schedule === 'function' ? schedule : ((callback, ms) => window.setTimeout(callback, ms));
    this.clearScheduled = typeof clearScheduled === 'function' ? clearScheduled : ((timerId) => window.clearTimeout(timerId));
    this.onUndo = typeof onUndo === 'function' ? onUndo : null;
    this.onRedo = typeof onRedo === 'function' ? onRedo : null;

    this.undoStack = [];
    this.redoStack = [];
    this.currentSnapshot = null;
    this.pendingSnapshot = null;
    this._commitTimer = null;
  }

  get isEntryMode() {
    return Boolean(this.onUndo || this.onRedo);
  }

  _resolveSnapshot(snapshot) {
    if (snapshot !== undefined) return snapshot;
    if (!this.createSnapshot) return null;
    return this.createSnapshot();
  }

  _trimUndoStack() {
    if (this.undoStack.length > this.limit) {
      this.undoStack.splice(0, this.undoStack.length - this.limit);
    }
  }

  commit(snapshot, { baseSnapshot } = {}) {
    const resolvedSnapshot = this._resolveSnapshot(snapshot);
    if (resolvedSnapshot == null) return false;

    if (this.isEntryMode) {
      this.undoStack.push(resolvedSnapshot);
      this._trimUndoStack();
      this.redoStack = [];
      this.currentSnapshot = resolvedSnapshot;
      this.pendingSnapshot = resolvedSnapshot;
      return true;
    }

    if (this.areSnapshotsEqual(resolvedSnapshot, this.pendingSnapshot)
      || this.areSnapshotsEqual(resolvedSnapshot, this.currentSnapshot)) {
      return false;
    }

    const base = baseSnapshot ?? this.pendingSnapshot ?? this.currentSnapshot;
    if (base != null && !this.areSnapshotsEqual(base, resolvedSnapshot)) {
      this.undoStack.push(base);
      this._trimUndoStack();
    }

    this.redoStack = [];
    this.currentSnapshot = resolvedSnapshot;
    this.pendingSnapshot = resolvedSnapshot;
    return true;
  }

  scheduleCommit() {
    if (this._commitTimer != null) {
      this.clearScheduled(this._commitTimer);
      this._commitTimer = null;
    }
    const delay = this.debounceMs;
    this._commitTimer = this.schedule(() => {
      this._commitTimer = null;
      this.commit();
    }, delay);
  }

  flushPendingCommit() {
    if (this._commitTimer != null) {
      this.clearScheduled(this._commitTimer);
      this._commitTimer = null;
    }
    return this.commit();
  }

  apply(snapshot, { trackAsCurrent = true } = {}) {
    if (!this.applySnapshot || snapshot == null) return false;
    this.applySnapshot(snapshot);
    if (trackAsCurrent) {
      this.currentSnapshot = snapshot;
      this.pendingSnapshot = snapshot;
    }
    return true;
  }

  reset(snapshot = undefined) {
    if (this._commitTimer != null) {
      this.clearScheduled(this._commitTimer);
      this._commitTimer = null;
    }
    this.undoStack = [];
    this.redoStack = [];
    const resolvedSnapshot = snapshot === undefined ? this._resolveSnapshot(undefined) : snapshot;
    this.currentSnapshot = resolvedSnapshot;
    this.pendingSnapshot = resolvedSnapshot;
  }

  undo() {
    const entry = this.undoStack.pop();
    if (entry == null) return null;

    if (this.isEntryMode) {
      if (this.onUndo) this.onUndo(entry);
      this.redoStack.push(entry);
      return entry;
    }

    const current = this._resolveSnapshot(undefined);
    if (current != null) {
      this.redoStack.push(current);
    }
    this.apply(entry);
    return entry;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (entry == null) return null;

    if (this.isEntryMode) {
      if (this.onRedo) this.onRedo(entry);
      this.undoStack.push(entry);
      this._trimUndoStack();
      return entry;
    }

    const current = this._resolveSnapshot(undefined);
    if (current != null) {
      this.undoStack.push(current);
      this._trimUndoStack();
    }
    this.apply(entry);
    return entry;
  }
}

export const createSnapshotHistory = (options = {}) => new SnapshotHistory(options);
