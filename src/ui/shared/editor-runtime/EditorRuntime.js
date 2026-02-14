import { createDocumentLifecycle } from '../../editor-documents/documentLifecycle.js';
import { createSnapshotHistory } from '../history/SnapshotHistory.js';

export function createEditorRuntime({ context, document, history } = {}) {
  if (!context) throw new Error('createEditorRuntime requires a context object.');
  if (!document) throw new Error('createEditorRuntime requires a document adapter.');

  const documentLifecycle = createDocumentLifecycle({
    folder: document.folder,
    strings: document.strings,
    confirm: document.confirm,
    serialize: (ctx) => document.serialize(ctx),
    deserialize: document.deserialize,
    applyLoadedData: (ctx, data, meta) => {
      document.applyLoadedData(ctx, data, meta);
      document.onAfterLoad?.(ctx, { data, ...meta });
    },
    onMarkSavedSnapshot: document.onMarkSavedSnapshot,
    afterSave: (ctx, meta) => {
      document.onAfterSave?.(ctx, meta);
    }
  });

  const snapshotHistory = history ? createSnapshotHistory(history) : null;

  return {
    documentLifecycle,
    history: snapshotHistory,
    captureSnapshot: () => documentLifecycle.captureSnapshot(context),
    markSavedSnapshot: () => documentLifecycle.markSavedSnapshot(context),
    hasUnsavedChanges: () => documentLifecycle.hasUnsavedChanges(context),
    confirmDiscardChanges: () => documentLifecycle.confirmDiscardChanges(context),
    saveAsOrCurrent: (options) => documentLifecycle.saveAsOrCurrent(context, options),
    open: () => documentLifecycle.open(context),
    closeWithPrompt: async (onClose) => documentLifecycle.closeWithPrompt(context, async () => {
      await document.onClose?.(context);
      await onClose?.();
    }),
    commitHistory: (snapshot, options) => snapshotHistory?.commit(snapshot, options),
    scheduleHistoryCommit: () => snapshotHistory?.scheduleCommit(),
    flushHistoryCommit: () => snapshotHistory?.flushPendingCommit(),
    resetHistory: (snapshot) => snapshotHistory?.reset(snapshot),
    undo: () => snapshotHistory?.undo(),
    redo: () => snapshotHistory?.redo()
  };
}
