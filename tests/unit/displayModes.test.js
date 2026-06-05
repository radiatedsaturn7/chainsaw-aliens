import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DISPLAY_MODE,
  DISPLAY_MODES,
  getDisplayActionForMode,
  getDisplayModeForAction,
  getDisplayModeLabelForAction,
  normalizeDisplayMode
} from '../../src/ui/shared/displayModes.js';

test('display mode helpers default to sepia and map title actions', () => {
  assert.equal(DEFAULT_DISPLAY_MODE, DISPLAY_MODES.SEPIA);
  assert.equal(normalizeDisplayMode('bogus'), DISPLAY_MODES.SEPIA);
  assert.equal(normalizeDisplayMode(DISPLAY_MODES.NIGHT_VISION), DISPLAY_MODES.NIGHT_VISION);
  assert.equal(getDisplayModeForAction('display-sepia'), DISPLAY_MODES.SEPIA);
  assert.equal(getDisplayModeForAction('display-night-vision'), DISPLAY_MODES.NIGHT_VISION);
  assert.equal(getDisplayModeForAction('display-color'), DISPLAY_MODES.COLOR);
  assert.equal(getDisplayModeForAction('keyboard'), null);
  assert.equal(getDisplayActionForMode(DISPLAY_MODES.COLOR), 'display-color');
  assert.equal(getDisplayModeLabelForAction('display-night-vision'), 'Display: Night Vision');
});
