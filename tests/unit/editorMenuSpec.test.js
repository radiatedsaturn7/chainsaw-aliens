import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_SPECS,
  getEditorMenuRuntimeId,
  getEditorMenuSpecIdForRuntime,
  getEditorMenuSection,
  getEditorRootMenuEntries,
  getEditorRootMenuIds,
  validateEditorMenuSpec
} from '../../src/ui/shared/editorMenuSpec.js';

test('shared editor menu specs validate for every editor', () => {
  for (const spec of Object.values(EDITOR_MENU_SPECS)) {
    assert.deepEqual(validateEditorMenuSpec(spec), []);
    assert.equal(new Set(spec.root).size, spec.root.length);
    Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
      assert.ok(spec.placements[mode]);
    });
  }
});

test('shared editor menu specs preserve required root menu order', () => {
  assert.deepEqual(getEditorRootMenuIds('pixel'), ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'rigging']);
  assert.deepEqual(getEditorRootMenuIds('level'), ['file', 'tools', 'tiles', 'tile-art', 'actors', 'triggers', 'powerups', 'structures', 'graphics', 'music', 'settings', 'playtest']);
  assert.deepEqual(getEditorRootMenuIds('actor'), ['file', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview']);
  assert.deepEqual(getEditorRootMenuIds('midi'), ['file', 'grid', 'song', 'tracks', 'record', 'pedals', 'settings']);
  assert.deepEqual(getEditorRootMenuIds('sfx'), ['file', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings']);
  assert.deepEqual(getEditorRootMenuIds('cutscene'), ['file', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'export', 'settings']);
});

test('menu specs include high-risk actions from the UI plan', () => {
  assert.ok(getEditorMenuSection('pixel', 'layers').actions.includes('layer-merge-up'));
  assert.ok(getEditorMenuSection('pixel', 'layers').actions.includes('layer-merge-down'));
  assert.ok(getEditorMenuSection('level', 'playtest').actions.includes('start-playtest'));
  assert.ok(getEditorMenuSection('actor', 'preview').actions.includes('play-scene'));
  assert.ok(getEditorMenuSection('midi', 'song').actions.includes('tempo'));
  assert.ok(getEditorMenuSection('sfx', 'envelopes').actions.includes('pitch'));
  assert.ok(getEditorMenuSection('cutscene', 'export').actions.includes('export-mp4'));
});

test('menu specs expose runtime aliases for existing editor state ids', () => {
  assert.equal(getEditorMenuRuntimeId('level', 'tile-art'), 'pixels');
  assert.equal(getEditorMenuRuntimeId('level', 'actors'), 'npcs');
  assert.equal(getEditorMenuRuntimeId('level', 'structures'), 'prefabs');
  assert.equal(getEditorMenuRuntimeId('pixel', 'frames'), 'animation');
  assert.equal(getEditorMenuRuntimeId('pixel', 'rigging'), 'bones');
  assert.equal(getEditorMenuRuntimeId('midi', 'tracks'), 'instruments');
  assert.equal(getEditorMenuRuntimeId('midi', 'record'), 'virtual-instruments');
  assert.equal(getEditorMenuSpecIdForRuntime('level', 'pixels'), 'tile-art');
  assert.equal(getEditorMenuSpecIdForRuntime('midi', 'virtual-instruments'), 'record');
});

test('shared root menu entries are render-ready while preserving spec ids', () => {
  const level = getEditorRootMenuEntries('level', {
    labelOverrides: { file: 'Menu' },
    extraEntries: [{ id: 'undo', label: 'Undo' }, { id: 'redo', label: 'Redo' }]
  });
  assert.deepEqual(level.map((entry) => entry.id), [
    'file',
    'toolbox',
    'tiles',
    'pixels',
    'npcs',
    'triggers',
    'powerups',
    'prefabs',
    'graphics',
    'music',
    'level-settings',
    'playtest',
    'undo',
    'redo'
  ]);
  assert.equal(level.find((entry) => entry.id === 'pixels').specId, 'tile-art');
  assert.equal(level.find((entry) => entry.id === 'file').label, 'Menu');

  const midi = getEditorRootMenuEntries('midi');
  assert.ok(midi.some((entry) => entry.id === 'instruments' && entry.specId === 'tracks'));
  assert.ok(midi.some((entry) => entry.id === 'virtual-instruments' && entry.specId === 'record'));
});
