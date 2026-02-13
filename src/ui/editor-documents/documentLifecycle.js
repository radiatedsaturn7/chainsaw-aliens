import { openProjectBrowser } from '../ProjectBrowserModal.js';
import { vfsSave } from '../vfs.js';

export function createDocumentLifecycle(adapter) {
  const captureSnapshot = (context) => JSON.stringify(adapter.serialize(context));

  const markSavedSnapshot = (context) => {
    context.savedSnapshot = captureSnapshot(context);
    adapter.onMarkSavedSnapshot?.(context);
  };

  const hasUnsavedChanges = (context) => {
    if (context.savedSnapshot == null) return false;
    return captureSnapshot(context) !== context.savedSnapshot;
  };

  const confirmDiscardChanges = (context) => {
    if (!hasUnsavedChanges(context)) return true;
    return adapter.confirm?.(context, adapter.strings.discardChanges) ?? false;
  };

  const saveAsOrCurrent = async (context, options = {}) => {
    const { forceSaveAs = false } = options;
    let name = context.currentDocumentRef?.name;
    if (forceSaveAs || !name) {
      const result = await openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: adapter.folder,
        initialFolder: adapter.folder,
        title: adapter.strings.saveAsTitle
      });
      if (!result?.name) return null;
      name = result.name;
    }

    const data = adapter.serialize(context);
    vfsSave(adapter.folder, name, data);
    context.currentDocumentRef = { folder: adapter.folder, name };
    adapter.afterSave?.(context, { name, data });
    markSavedSnapshot(context);
    return { id: name, name };
  };

  const open = (context) => {
    if (!confirmDiscardChanges(context)) return false;
    openProjectBrowser({
      mode: 'open',
      fixedFolder: adapter.folder,
      initialFolder: adapter.folder,
      title: adapter.strings.openTitle,
      onOpen: ({ name, payload }) => {
        if (!payload?.data) return;
        const data = adapter.deserialize ? adapter.deserialize(context, payload.data) : payload.data;
        adapter.applyLoadedData(context, data, { name, payload });
        context.currentDocumentRef = { folder: adapter.folder, name };
        markSavedSnapshot(context);
      }
    });
    return true;
  };

  const closeWithPrompt = async (context, onClose) => {
    if (hasUnsavedChanges(context)) {
      const shouldSave = adapter.confirm?.(context, adapter.strings.closePrompt);
      if (shouldSave) {
        const saved = await saveAsOrCurrent(context);
        if (!saved) return false;
      }
    }
    await onClose?.();
    return true;
  };

  return {
    captureSnapshot,
    markSavedSnapshot,
    hasUnsavedChanges,
    confirmDiscardChanges,
    saveAsOrCurrent,
    open,
    closeWithPrompt
  };
}
