import test from 'node:test';
import assert from 'node:assert/strict';
import { hasBlockingGlobalOverlay } from '../../src/ui/shared/globalOverlayInput.js';

test('persistent save failure survives timer hides and dismisses explicitly', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window ||= { location: { search: '' } };
  const { default: Game } = await import('../../src/game/GameCore.js');
  const element = () => ({ style: {}, dataset: {}, children: [], appendChild(child) { child.remove(); this.children.push(child); child.parent = this; }, remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; } });
  const root = element();
  globalThis.document = { getElementById: () => root, createElement: element };
  const game = Object.create(Game.prototype);
  try {
    game.showSaveStatusModal('Save failed: detailed error', { persistent: true });
    assert.equal(game._saveStatusModalEl.textContent, 'Save failed: detailed error');
    assert.equal(game._saveStatusModalTimer, undefined);
    game.hideSaveStatusModal();
    assert.equal(game._saveStatusModalEl.style.display, 'block');
    const dismiss = game._saveStatusModalEl.children[0];
    assert.equal(dismiss.textContent, 'Dismiss');
    dismiss.onclick({ stopPropagation() {} });
    assert.equal(game._saveStatusModalEl.style.display, 'none');
    assert.equal(root.children.length, 0);
    for (let attempt = 0; attempt < 2; attempt++) {
      game.showSaveStatusModal('Saving...');
      assert.equal(hasBlockingGlobalOverlay(root), false);
      game.showSaveStatusModal('Saved');
      assert.equal(hasBlockingGlobalOverlay(root), false);
      game.hideSaveStatusModal();
      assert.equal(root.children.length, 0);
    }
  } finally { globalThis.window = oldWindow; globalThis.document = oldDocument; }
});

test('real dialogs still block input when sharing the root with a save notification', () => {
  const status = { dataset: { nonBlockingOverlay: 'true' }, style: {} };
  const dialog = { style: {} };
  const root = { children: [status, dialog] };
  assert.equal(hasBlockingGlobalOverlay(root), true);
  dialog.style.display = 'none';
  assert.equal(hasBlockingGlobalOverlay(root), false);
  dialog.style.display = 'block';
  dialog.hidden = true;
  assert.equal(hasBlockingGlobalOverlay(root), false);
  assert.equal(hasBlockingGlobalOverlay(null), false);
});
