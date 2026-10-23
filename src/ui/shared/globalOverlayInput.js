// Only active dialogs block canvas input. Status notifications may remain mounted
// while saving, or be hidden for reuse after completing a save.
export function hasBlockingGlobalOverlay(root) {
  return Array.from(root?.children || []).some(element => (
    !element.hidden
    && element.style?.display !== 'none'
    && element.style?.visibility !== 'hidden'
    && element.dataset?.nonBlockingOverlay !== 'true'
  ));
}
