import { openProjectBrowser } from '../ProjectBrowserModal.js';
import { saveProjectFile } from '../projectFiles.js';

export function createDocumentLifecycle(adapter) {
  const MIN_SAVING_TOAST_MS = 350;
  const isDefaultDocumentName = (name) => {
    const value = String(name || '').trim().toLowerCase();
    if (!value) return true;
    if (value === 'untitled' || value === 'untitled.json') return true;
    if (value.startsWith('new-')) return true;
    if (value.includes('autosave')) return true;
    return false;
  };
  const captureSnapshot = (context) => JSON.stringify(adapter.serialize(context));

  const markSavedSnapshot = (context) => {
    context.savedSnapshot = captureSnapshot(context);
    adapter.onMarkSavedSnapshot?.(context);
  };

  const hasUnsavedChanges = (context) => {
    if (context.savedSnapshot == null) return false;
    return captureSnapshot(context) !== context.savedSnapshot;
  };

  const isEffectivelyEmptyDocument = (context) => {
    const currentData = adapter.serialize(context);
    if (adapter.isEmptyDocument) return !!adapter.isEmptyDocument(context, currentData);
    return false;
  };

  const confirmDiscardChanges = async (context) => {
    if (!hasUnsavedChanges(context)) return true;
    if (isEffectivelyEmptyDocument(context)) return true;
    const result = adapter.confirm?.(context, adapter.strings.discardChanges);
    return (await Promise.resolve(result)) ?? false;
  };

  const saveAsOrCurrent = async (context, options = {}) => {
    const { forceSaveAs = false } = options;
    let name = context.currentDocumentRef?.name;
    if (forceSaveAs || !name || isDefaultDocumentName(name)) {
      const result = await openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: adapter.folder,
        initialFolder: adapter.folder,
        initialName: context.currentDocumentRef?.name || '',
        title: adapter.strings.saveAsTitle
      });
      if (!result?.name) return null;
      name = result.name;
    }

    const data = adapter.serialize(context);
    const savingStartedAt = Date.now();
    context.game?.showSaveStatusModal?.('Saving...');
    context.game?.showSystemToast?.('Saving...');
    context.statusMessage = 'Saving...';
    const saved = saveProjectFile(adapter.folder, name, data);
    if (adapter.waitForSync !== false) {
      await saved?.syncPromise;
    }
    const elapsed = Date.now() - savingStartedAt;
    if (elapsed < MIN_SAVING_TOAST_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_SAVING_TOAST_MS - elapsed));
    }
    context.currentDocumentRef = { folder: adapter.folder, name };
    adapter.afterSave?.(context, { name, data });
    markSavedSnapshot(context);
    context.game?.showSaveStatusModal?.('Saved');
    setTimeout(() => context.game?.hideSaveStatusModal?.(), 1400);
    context.game?.showSystemToast?.('Saved');
    context.statusMessage = 'Saved';
    return { id: name, name };
  };

  const open = async (context) => {
    if (!(await confirmDiscardChanges(context))) return false;
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
        adapter.afterOpen?.(context, { name, payload, data });
      }
    });
    return true;
  };

  const closeWithPrompt = async (context, onClose) => {
    if (hasUnsavedChanges(context)) {
      const shouldSave = await Promise.resolve(adapter.confirm?.(context, adapter.strings.closePrompt));
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
