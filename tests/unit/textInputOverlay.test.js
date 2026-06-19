import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/ui/shared/textInputOverlay.js', import.meta.url), 'utf8');

test('confirm overlay buttons are not blocked by capture-phase panel shielding', () => {
  assert.equal(source.includes("overlay.style.pointerEvents = 'auto';"), true);
  assert.equal(source.includes("root.style.pointerEvents = 'none';"), true);
  assert.equal(source.includes("}, true);"), false);
  assert.equal(source.includes("bindOverlayActionButton(okBtn, () => cleanup(true));"), true);
  assert.equal(source.includes("bindOverlayActionButton(cancelBtn, () => cleanup(false));"), true);
});
