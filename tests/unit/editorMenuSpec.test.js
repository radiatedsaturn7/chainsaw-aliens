import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EDITOR_LAYOUT_MODES,
  EDITOR_MENU_SPECS,
  REQUIRED_DESKTOP_ROOT_PREFIX,
  REQUIRED_EDIT_ACTION_IDS,
  REQUIRED_FILE_ACTION_IDS,
  getEditorControllerRootMenuEntries,
  getEditorControllerRootMenuIds,
  getEditorDesktopControllerMenuId,
  getEditorDesktopControllerMenuIdForSection,
  getEditorDesktopRootIdForSection,
  getEditorDesktopSectionId,
  getEditorMenuRuntimeId,
  getEditorMenuSpecIdForRuntime,
  getEditorMenuSection,
  getEditorPortraitRootMenuEntries,
  getEditorRootMenuEntries,
  getEditorRootMenuLabelMap,
  getEditorRootMenuIds,
  validateEditorMenuSpec
} from '../../src/ui/shared/editorMenuSpec.js';

const uiSpecSource = readFileSync(new URL('../../UISpec.md', import.meta.url), 'utf8');
const sectionForTest = (id, actions = []) => ({ id, label: id, actions });

test('shared editor menu specs validate for every editor', () => {
  for (const spec of Object.values(EDITOR_MENU_SPECS)) {
    assert.deepEqual(validateEditorMenuSpec(spec), []);
    Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
      assert.ok(spec.placements[mode]);
    });
  }
});

test('menu spec validation catches duplicate and missing action wiring', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.sfx);
  spec.root = ['timeline', 'file', 'edit', ...spec.root.slice(2), 'file'];
  spec.sections.timeline.actions.push('play');
  spec.sections.file.actions = spec.sections.file.actions.filter((id) => id !== 'open');
  spec.sections.edit.actions = spec.sections.edit.actions.filter((id) => id !== 'redo');
  delete spec.actions.stop;
  spec.aliases.timeline = 'file';
  spec.aliases.missingRoot = 'ghost';
  spec.sections.missingRoot = sectionForTest('missingRoot', ['play']);
  spec.aliases.layers = 'file';
  spec.portraitRoot.push({ id: 'ghost-panel', label: 'Ghost' });

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'sfx root menu "timeline" is duplicated.',
    'sfx root menu "file" is duplicated.',
    'sfx root menu 1 must be "file" for desktop menu consistency.',
    'sfx root menu 2 must be "edit" for desktop menu consistency.',
    'sfx root menu 3 must be "view" for desktop menu consistency.',
    'sfx portrait root menu "ghost-panel" does not resolve to a root menu, section, panel, or runtime alias.',
    'sfx file menu is missing required action "open".',
    'sfx edit menu is missing required action "redo".',
    'sfx action "stop" is missing from actions map.',
    'sfx section "timeline" duplicates action "play".',
    'sfx action "stop" is missing from actions map.',
    'sfx alias "timeline" collides with root menu "file".',
    'sfx alias "missingRoot" is missing from root menus.',
    'sfx alias "layers" collides with root menu "file".',
    'sfx alias runtime id "file" is duplicated.'
  ]);
});

test('menu spec validation catches misordered desktop File and Edit baselines', () => {
  const spec = structuredClone(EDITOR_MENU_SPECS.level);
  spec.sections.file.actions = ['save', 'new', 'save-as', 'open', 'export', 'import', 'playtest', 'exit-main'];
  spec.sections.edit.actions = ['redo', 'undo', 'copy', 'cut', 'paste', 'delete'];

  assert.deepEqual(validateEditorMenuSpec(spec), [
    'level file menu action 1 must be "new" for desktop File dropdown consistency.',
    'level file menu action 2 must be "save" for desktop File dropdown consistency.',
    'level edit menu action 1 must be "undo" for desktop Edit dropdown consistency.',
    'level edit menu action 2 must be "redo" for desktop Edit dropdown consistency.'
  ]);
});

test('shared editor menu specs keep File, Edit, and View as required desktop roots', () => {
  for (const [editorId, spec] of Object.entries(EDITOR_MENU_SPECS)) {
    assert.deepEqual(spec.root.slice(0, REQUIRED_DESKTOP_ROOT_PREFIX.length), REQUIRED_DESKTOP_ROOT_PREFIX, editorId);
    REQUIRED_FILE_ACTION_IDS.forEach((actionId) => {
      assert.ok(spec.sections.file.actions.includes(actionId), `${editorId} file menu should include ${actionId}`);
    });
    assert.deepEqual(spec.sections.file.actions.slice(0, 6), ['new', 'save', 'save-as', 'open', 'export', 'import'], `${editorId} file menu should use the shared desktop file order`);
    REQUIRED_EDIT_ACTION_IDS.forEach((actionId) => {
      assert.ok(spec.sections.edit.actions.includes(actionId), `${editorId} edit menu should include ${actionId}`);
    });
    assert.deepEqual(spec.sections.edit.actions.slice(0, 2), ['undo', 'redo'], `${editorId} edit menu should use the shared desktop edit order`);
  }
});

test('shared editor menu specs preserve required root menu order', () => {
  assert.deepEqual(getEditorRootMenuIds('pixel'), ['file', 'edit', 'view', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'rigging']);
  assert.deepEqual(getEditorRootMenuIds('level'), ['file', 'edit', 'view', 'tools', 'tiles', 'tile-art', 'actors', 'triggers', 'powerups', 'structures', 'graphics', 'music', 'settings', 'playtest']);
  assert.deepEqual(getEditorRootMenuIds('actor'), ['file', 'edit', 'view', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview']);
  assert.deepEqual(getEditorRootMenuIds('midi'), ['file', 'edit', 'view', 'grid', 'song', 'tracks', 'record', 'pedals', 'settings']);
  assert.deepEqual(getEditorRootMenuIds('sfx'), ['file', 'edit', 'view', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings']);
  assert.deepEqual(getEditorRootMenuIds('cutscene'), ['file', 'edit', 'view', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'export', 'settings']);
  assert.deepEqual(getEditorRootMenuIds('race'), ['file', 'edit', 'view', 'road', 'surfaces', 'scenery', 'weather', 'race', 'drive']);
  assert.deepEqual(getEditorRootMenuIds('car'), ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive']);
});

test('canonical UI spec root lists include the required desktop View root', () => {
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Draw, Select, Tools, Canvas, Layers, Frames, Rigging.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Tools, Tiles, Tile Art, Actors/NPCs, Triggers, Powerups, Structures, Graphics/Decals, Music, Settings, Playtest.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Settings, States, Linked Parts, Visuals, Collision, Behavior, Preview.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Grid, Song, Tracks/Mixer, Record, Pedals, Settings.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Timeline, Layers, Envelopes, Generate, Tools, Settings.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Add, Timeline, Clips, Keyframes, Stage, Audio, Export, Settings.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Road, Surfaces, Scenery, Weather, Race, Drive.'), true);
  assert.equal(uiSpecSource.includes('- Root: File, Edit, View, Art, Drivetrain, Tuning, Aero, Suspension, Drive.'), true);
});

test('canonical UI spec avoids stale placeholder menu rows', () => {
  [
    'Layers: layer list',
    'Frames: frame list',
    'Rigging: bones, bind layer',
    'Song: play, stop, loop, tempo, arrangement.',
    'Tracks/Mixer: track list',
    'Record: virtual instruments',
    'Pedals: pedal board and mixer shortcuts.',
    'Timeline: play, stop, scrub',
    'Layers: layer list, add',
    'Keyframes: position, scale, opacity'
  ].forEach((text) => {
    assert.equal(uiSpecSource.includes(text), false, `UISpec should not include stale placeholder row "${text}"`);
  });
  assert.equal(uiSpecSource.includes('Tracks/Mixer: dynamic track rows from the runtime mixer.'), true);
  assert.equal(uiSpecSource.includes('Pedals: pedal chain controls.'), true);
  assert.equal(uiSpecSource.includes('Timeline: play, stop, start, end.'), true);
});

test('shared editor menu specs expose compact portrait bottom roots', () => {
  const expected = {
    pixel: ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames'],
    level: ['file', 'tools', 'assets', 'settings'],
    actor: ['file', 'actor', 'states', 'tools'],
    midi: ['file', 'grid', 'song', 'instruments', 'virtual-instruments', 'pedals', 'settings'],
    sfx: ['file', 'generate', 'timeline', 'layers', 'envelopes', 'tools', 'settings'],
    cutscene: ['file', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'settings'],
    race: ['file', 'road', 'surfaces', 'race'],
    car: ['file', 'art', 'drivetrain', 'tuning']
  };

  Object.entries(expected).forEach(([editorId, ids]) => {
    const entries = getEditorPortraitRootMenuEntries(editorId);
    assert.deepEqual(entries.map((entry) => entry.id), ids, editorId);
    assert.ok(entries.length <= 8, `${editorId} portrait roots should fit the bottom rail`);
  });

  const cutsceneIds = getEditorPortraitRootMenuEntries('cutscene').map((entry) => entry.id);
  assert.equal(cutsceneIds.includes('export'), false);
  assert.ok(getEditorMenuSection('cutscene', 'file').actions.includes('export'));
  assert.deepEqual(getEditorMenuSection('level', 'assets').actions, ['tile-paint', 'open-tile-art', 'enemy-mode', 'powerup-place', 'prefab-mode']);
  assert.deepEqual(getEditorMenuSection('actor', 'actor').actions, ['actor-settings', 'metadata', 'aggression', 'loot-rules']);
  assert.deepEqual(getEditorMenuSection('actor', 'tools').actions, ['state-graph', 'play-scene', 'hitbox-zones']);
});

test('every editor portrait root menu stays bottom-rail sized', () => {
  for (const editorId of Object.keys(EDITOR_MENU_SPECS)) {
    const entries = getEditorPortraitRootMenuEntries(editorId);
    assert.ok(entries.length > 0, `${editorId} should expose portrait roots`);
    assert.ok(entries.length <= 8, `${editorId} portrait root menu should have no more than eight bottom items`);
    assert.equal(EDITOR_MENU_SPECS[editorId].placements[EDITOR_LAYOUT_MODES.PORTRAIT].root, 'bottom-rail', editorId);
    assert.equal(EDITOR_MENU_SPECS[editorId].placements[EDITOR_LAYOUT_MODES.PORTRAIT].submenu, 'bottom-sheet', editorId);
  }
});

test('menu specs include high-risk actions from the UI plan', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'clear']);
  assert.deepEqual(getEditorMenuSection('pixel', 'view').actions, ['zoom-in', 'zoom-out', 'zoom-fit', 'grid', 'tile-preview', 'onion']);
  assert.deepEqual(getEditorMenuSection('midi', 'edit').actions, ['undo', 'redo', 'select-all', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('midi', 'view').actions, ['zoom-in', 'zoom-out', 'preview', 'contrast']);
  assert.deepEqual(getEditorMenuSection('actor', 'edit').actions, ['undo', 'redo', 'copy-state', 'paste-state', 'duplicate-state', 'delete-state']);
  assert.deepEqual(getEditorMenuSection('actor', 'view').actions, ['state-graph', 'hitbox-zones', 'play-scene']);
  assert.deepEqual(getEditorMenuSection('sfx', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('sfx', 'view').actions, ['play', 'stop', 'start', 'end', 'loop']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'edit').actions, ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']);
  assert.deepEqual(getEditorMenuSection('cutscene', 'view').actions, ['view-canvas', 'view-split', 'view-timeline', 'timeline-zoom-out', 'timeline-zoom-in', 'timeline-fit']);
  assert.ok(getEditorMenuSection('pixel', 'layers').actions.includes('layer-merge-up'));
  assert.ok(getEditorMenuSection('pixel', 'layers').actions.includes('layer-merge-down'));
  assert.ok(getEditorMenuSection('level', 'playtest').actions.includes('playtest'));
  assert.ok(getEditorMenuSection('actor', 'preview').actions.includes('play-scene'));
  assert.ok(getEditorMenuSection('midi', 'song').actions.includes('tempo'));
  assert.ok(getEditorMenuSection('sfx', 'envelopes').actions.includes('pitch'));
  assert.ok(getEditorMenuSection('cutscene', 'export').actions.includes('export-mp4'));
  assert.ok(getEditorMenuSection('race', 'race').actions.includes('generate-random-race'));
  assert.deepEqual(getEditorMenuSection('race', 'file').actions.slice(0, 6), ['new', 'save', 'save-as', 'open', 'export', 'import']);
  assert.deepEqual(getEditorMenuSection('car', 'file').actions.slice(0, 6), ['new', 'save', 'save-as', 'open', 'export', 'import']);
});

test('Pixel shared menu spec exposes layer and frame management commands', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'layers').actions, [
    'layer-add',
    'layer-duplicate',
    'layer-delete',
    'layer-rename',
    'layer-visibility',
    'layer-up',
    'layer-down',
    'layer-merge-up',
    'layer-merge-down',
    'layer-flatten'
  ]);
  assert.deepEqual(getEditorMenuSection('pixel', 'frames').actions, [
    'frame-add',
    'frame-duplicate',
    'frame-delete',
    'frame-delay',
    'frame-loop',
    'frame-play',
    'frame-step',
    'frame-rewind',
    'frame-up',
    'frame-down'
  ]);
});

test('Pixel shared menu spec exposes concrete rigging drawer commands', () => {
  assert.deepEqual(getEditorMenuSection('pixel', 'rigging').actions, [
    'bone-add',
    'bone-bind-layer',
    'bone-bind-selection',
    'bone-bake'
  ]);
  assert.equal(getEditorMenuSection('pixel', 'rigging').actions.includes('bone-list'), false);
  assert.equal(getEditorMenuSection('pixel', 'rigging').actions.includes('bone-timeline'), false);
});

test('MIDI shared menu spec uses runtime drawer command ids', () => {
  assert.deepEqual(getEditorMenuSection('midi', 'grid').actions, ['quantize', 'note-length']);
  assert.deepEqual(getEditorMenuSection('midi', 'song').actions, ['play', 'stop', 'loop', 'tempo']);
  assert.deepEqual(getEditorMenuSection('midi', 'tracks').actions, []);
  assert.deepEqual(getEditorMenuSection('midi', 'record').actions, ['enter-record', 'single-note']);
  assert.deepEqual(getEditorMenuSection('midi', 'pedals').actions, ['select-pedal-chain']);
  assert.deepEqual(getEditorMenuSection('midi', 'settings').actions, ['quantize', 'preview', 'contrast']);
  ['open-grid', 'open-song', 'open-tracks', 'open-record', 'open-pedals', 'open-mixer', 'open-settings'].forEach((id) => {
    Object.values(EDITOR_MENU_SPECS.midi.sections).forEach((section) => {
      assert.equal(section.actions.includes(id), false, `midi ${section.id} should not include stale navigation action ${id}`);
    });
  });
  assert.equal(getEditorMenuSection('midi', 'tracks').actions.includes('track-list'), false);
  assert.equal(getEditorMenuSection('midi', 'record').actions.includes('virtual-instruments'), false);
  assert.equal(getEditorMenuSection('midi', 'settings').actions.includes('audio-settings'), false);
});

test('Actor shared menu spec includes concrete desktop drawer actions', () => {
  assert.deepEqual(getEditorMenuSection('actor', 'settings').actions, [
    'actor-settings',
    'metadata',
    'aggression',
    'loot-rules'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'visuals').actions, [
    'animation',
    'art-reference',
    'frame-timing',
    'state-graph'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'collision').actions, [
    'hitbox-zones',
    'hurtbox-zones',
    'body-damage'
  ]);
  assert.deepEqual(getEditorMenuSection('actor', 'preview').actions, [
    'play-scene',
    'state-graph',
    'hitbox-zones'
  ]);
});

test('Actor desktop root sections come from the shared menu spec', () => {
  assert.equal(getEditorDesktopSectionId('actor', 'file'), 'actor');
  assert.equal(getEditorDesktopSectionId('actor', 'settings'), 'actor');
  assert.equal(getEditorDesktopSectionId('actor', 'view'), 'tools');
  assert.equal(getEditorDesktopSectionId('actor', 'preview'), 'tools');
  assert.equal(getEditorDesktopSectionId('actor', 'collision'), 'states');
  assert.equal(getEditorDesktopSectionId('actor', 'missing'), null);
});

test('Race shared surface menu includes tile-backed terrain authoring commands', () => {
  assert.deepEqual(getEditorMenuSection('race', 'surfaces').actions, [
    'ground-tile-next',
    'paint-ground',
    'edge-tile',
    'surface-asphalt',
    'surface-dirt',
    'surface-gravel',
    'surface-snow',
    'surface-wet-asphalt',
    'surface-texture'
  ]);
  assert.equal(uiSpecSource.includes('Surfaces: selected ground tile, paint ground, selected-segment edge tile'), true);
});

test('Pixel desktop root, section, and controller menu aliases come from the shared menu spec', () => {
  assert.equal(getEditorDesktopSectionId('pixel', 'frames'), 'animation');
  assert.equal(getEditorDesktopSectionId('pixel', 'rigging'), 'bones');
  assert.equal(getEditorDesktopSectionId('pixel', 'draw'), 'draw');
  assert.equal(getEditorDesktopRootIdForSection('pixel', 'animation'), 'frames');
  assert.equal(getEditorDesktopRootIdForSection('pixel', 'bones'), 'rigging');
  assert.equal(getEditorDesktopRootIdForSection('pixel', 'draw'), 'draw');
  assert.equal(getEditorDesktopControllerMenuId('pixel', 'frames'), 'frames');
  assert.equal(getEditorDesktopControllerMenuId('pixel', 'rigging'), 'bones');
  assert.equal(getEditorDesktopControllerMenuIdForSection('pixel', 'animation'), 'frames');
  assert.equal(getEditorDesktopControllerMenuIdForSection('pixel', 'bones'), 'bones');
});

test('MIDI desktop mixer and record controller aliases come from the shared menu spec', () => {
  assert.equal(getEditorDesktopSectionId('midi', 'tracks'), 'instruments');
  assert.equal(getEditorDesktopSectionId('midi', 'record'), 'virtual-instruments');
  assert.equal(getEditorDesktopRootIdForSection('midi', 'instruments'), 'tracks');
  assert.equal(getEditorDesktopRootIdForSection('midi', 'virtual-instruments'), 'record');
  assert.equal(getEditorDesktopControllerMenuIdForSection('midi', 'instruments'), 'tracks');
  assert.equal(getEditorDesktopControllerMenuIdForSection('midi', 'virtual-instruments'), 'record');
});

test('shared controller root helpers expose runtime menu ids and labels', () => {
  assert.deepEqual(getEditorControllerRootMenuIds('pixel'), ['file', 'edit', 'view', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'bones']);
  assert.deepEqual(getEditorControllerRootMenuIds('level'), ['file', 'edit', 'view', 'toolbox', 'tiles', 'pixels', 'npcs', 'triggers', 'powerups', 'prefabs', 'graphics', 'music', 'level-settings', 'playtest']);
  assert.deepEqual(getEditorControllerRootMenuIds('midi'), ['file', 'edit', 'view', 'grid', 'song', 'tracks', 'record', 'pedals', 'settings']);
  assert.deepEqual(getEditorControllerRootMenuIds('sfx'), ['file', 'edit', 'view', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings']);
  assert.deepEqual(getEditorControllerRootMenuIds('cutscene'), ['file', 'edit', 'view', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'export', 'settings']);
  assert.deepEqual(getEditorControllerRootMenuIds('actor'), ['file', 'edit', 'view', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview']);
  assert.deepEqual(getEditorControllerRootMenuIds('race'), ['file', 'edit', 'view', 'road', 'surfaces', 'scenery', 'weather', 'race', 'drive']);
  assert.deepEqual(getEditorControllerRootMenuIds('car'), ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive']);

  const pixelLabels = getEditorRootMenuLabelMap('pixel');
  assert.equal(pixelLabels.frames, 'Frames');
  assert.equal(pixelLabels.animation, 'Frames');
  assert.equal(pixelLabels.rigging, 'Rigging');
  assert.equal(pixelLabels.bones, 'Rigging');

  const levelLabels = getEditorRootMenuLabelMap('level');
  assert.equal(levelLabels['tile-art'], 'Tile Art');
  assert.equal(levelLabels.pixels, 'Tile Art');
  assert.equal(levelLabels.actors, 'Actors');
  assert.equal(levelLabels.npcs, 'Actors');

  const midiLabels = getEditorRootMenuLabelMap('midi');
  assert.equal(midiLabels.tracks, 'Mixer');
  assert.equal(midiLabels.instruments, 'Mixer');
  assert.equal(midiLabels.record, 'Record');
  assert.equal(midiLabels['virtual-instruments'], 'Record');

  const raceLabels = getEditorRootMenuLabelMap('race');
  assert.equal(raceLabels.drive, 'Drive');
  assert.equal(raceLabels.surfaces, 'Surfaces');

  const carLabels = getEditorRootMenuLabelMap('car');
  assert.equal(carLabels.drivetrain, 'Drivetrain');
  assert.equal(carLabels.suspension, 'Suspension');
});

test('shared controller root entries carry render id and controller submenu id', () => {
  const pixel = getEditorControllerRootMenuEntries('pixel');
  assert.deepEqual(
    pixel.filter((entry) => entry.specId === 'frames' || entry.specId === 'rigging')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['animation', 'frames', 'frames', 'Frames'],
      ['bones', 'rigging', 'bones', 'Rigging']
    ]
  );

  const level = getEditorControllerRootMenuEntries('level');
  assert.deepEqual(
    level.filter((entry) => ['tools', 'tile-art', 'actors', 'structures', 'settings'].includes(entry.specId))
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId]),
    [
      ['toolbox', 'tools', 'toolbox'],
      ['pixels', 'tile-art', 'pixels'],
      ['npcs', 'actors', 'npcs'],
      ['prefabs', 'structures', 'prefabs'],
      ['level-settings', 'settings', 'level-settings']
    ]
  );

  const midi = getEditorControllerRootMenuEntries('midi');
  assert.deepEqual(
    midi.filter((entry) => entry.specId === 'tracks' || entry.specId === 'record')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['instruments', 'tracks', 'tracks', 'Mixer'],
      ['virtual-instruments', 'record', 'record', 'Record']
    ]
  );

  const race = getEditorControllerRootMenuEntries('race');
  assert.deepEqual(
    race.filter((entry) => entry.specId === 'road' || entry.specId === 'drive')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['road', 'road', 'road', 'Road'],
      ['drive', 'drive', 'drive', 'Drive']
    ]
  );

  const car = getEditorControllerRootMenuEntries('car');
  assert.deepEqual(
    car.filter((entry) => entry.specId === 'drivetrain' || entry.specId === 'drive')
      .map((entry) => [entry.id, entry.specId, entry.controllerMenuId, entry.label]),
    [
      ['drivetrain', 'drivetrain', 'drivetrain', 'Drivetrain'],
      ['drive', 'drive', 'drive', 'Drive']
    ]
  );
});

test('Level desktop and landscape root aliases resolve to existing panel tabs', () => {
  assert.equal(getEditorDesktopSectionId('level', 'tools'), 'toolbox');
  assert.equal(getEditorDesktopSectionId('level', 'toolbox'), 'toolbox');
  assert.equal(getEditorDesktopSectionId('level', 'tile-art'), 'pixels');
  assert.equal(getEditorDesktopSectionId('level', 'actors'), 'npcs');
  assert.equal(getEditorDesktopSectionId('level', 'structures'), 'prefabs');
  assert.equal(getEditorDesktopSectionId('level', 'settings'), 'level-settings');
  assert.equal(getEditorDesktopRootIdForSection('level', 'toolbox'), 'tools');
  assert.equal(getEditorDesktopRootIdForSection('level', 'pixels'), 'tile-art');
  assert.equal(getEditorDesktopRootIdForSection('level', 'npcs'), 'actors');
  assert.equal(getEditorDesktopRootIdForSection('level', 'prefabs'), 'structures');
  assert.equal(getEditorDesktopRootIdForSection('level', 'level-settings'), 'settings');
});

test('SFX shared menu spec uses runtime command ids instead of abstract placeholders', () => {
  assert.deepEqual(getEditorMenuSection('sfx', 'timeline').actions, [
    'play',
    'stop',
    'start',
    'end'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'layers').actions, [
    'add-layer',
    'duplicate-layer',
    'delete-layer'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'generate').actions, [
    'generate',
    'wave-noise',
    'wave-saw',
    'wave-triangle',
    'wave-square',
    'wave-custom'
  ]);
  assert.deepEqual(getEditorMenuSection('sfx', 'settings').actions, ['loop']);
  assert.equal(getEditorMenuSection('sfx', 'generate').actions.includes('open-generate'), false);
  assert.equal(getEditorMenuSection('sfx', 'settings').actions.includes('open-settings'), false);
  assert.equal(getEditorMenuSection('sfx', 'timeline').actions.includes('scrub'), false);
  assert.equal(getEditorMenuSection('sfx', 'layers').actions.includes('layer-list'), false);
  assert.equal(getEditorMenuSection('sfx', 'layers').actions.includes('reorder-layer'), false);
});

test('Cutscene shared menu spec uses runtime drawer command ids', () => {
  assert.deepEqual(getEditorMenuSection('cutscene', 'timeline').actions, [
    'play',
    'step-frame',
    'view-canvas',
    'view-split',
    'view-timeline',
    'timeline-zoom-out',
    'timeline-zoom-in',
    'timeline-fit'
  ]);
  assert.deepEqual(getEditorMenuSection('cutscene', 'keyframes').actions, [
    'set-start',
    'set-end',
    'set-key',
    'delete-key',
    'prev-key',
    'next-key',
    'key-mode',
    'ease'
  ]);
  assert.deepEqual(getEditorMenuSection('cutscene', 'settings').actions, [
    'scene-duration',
    'snap-toggle',
    'snap-size',
    'master-volume',
    'view-canvas',
    'view-split',
    'view-timeline'
  ]);
});

test('Level shared menu spec uses stable runtime command ids instead of placeholder lists', () => {
  assert.deepEqual(getEditorMenuSection('level', 'tools').actions, [
    'toolbox',
    'tile-mode',
    'enemy-mode',
    'prefab-mode',
    'shape-mode',
    'erase'
  ]);
  assert.deepEqual(getEditorMenuSection('level', 'triggers').actions, ['trigger-draw', 'spawn']);
  assert.deepEqual(getEditorMenuSection('level', 'graphics').actions, [
    'open-graphics',
    'graphics-take-screenshot',
    'graphics-apply-decal'
  ]);
  assert.deepEqual(getEditorMenuSection('level', 'settings').actions, [
    'resize-level',
    'crop-level',
    'spawn-point',
    'start-everything',
    'random-level',
    'midi'
  ]);
  assert.equal(getEditorMenuSection('level', 'tiles').actions.includes('tile-list'), false);
  assert.equal(getEditorMenuSection('level', 'actors').actions.includes('actor-list'), false);
  assert.equal(getEditorMenuSection('level', 'structures').actions.includes('structure-list'), false);
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
    'edit',
    'view',
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
  assert.equal(midi.find((entry) => entry.id === 'instruments').label, 'Mixer');
  assert.equal(midi.find((entry) => entry.id === 'virtual-instruments').label, 'Record');

  const defaultLevel = getEditorRootMenuEntries('level');
  assert.equal(defaultLevel.find((entry) => entry.id === 'toolbox').label, 'Toolbox');
  assert.equal(defaultLevel.find((entry) => entry.id === 'pixels').label, 'Tile Art');
  assert.equal(defaultLevel.find((entry) => entry.id === 'npcs').label, 'Actors');
  assert.equal(defaultLevel.find((entry) => entry.id === 'prefabs').label, 'Structures');
});
