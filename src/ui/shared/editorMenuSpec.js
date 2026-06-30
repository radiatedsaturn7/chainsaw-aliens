export const EDITOR_LAYOUT_MODES = {
  PORTRAIT: 'portrait',
  LANDSCAPE_TOUCH: 'landscape-touch',
  DESKTOP: 'desktop',
  GAMEPAD: 'gamepad'
};

export const EDITOR_MENU_PLACEMENTS = {
  [EDITOR_LAYOUT_MODES.PORTRAIT]: {
    root: 'bottom-rail',
    submenu: 'bottom-sheet',
    settings: 'top-context'
  },
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
    root: 'left-rail',
    submenu: 'right-drawer',
    settings: 'right-drawer'
  },
  [EDITOR_LAYOUT_MODES.DESKTOP]: {
    root: 'top-menu',
    submenu: 'dropdown',
    settings: 'left-panel'
  },
  [EDITOR_LAYOUT_MODES.GAMEPAD]: {
    root: 'left-slide-rail',
    submenu: 'slide-out-drawer',
    settings: 'slide-out-drawer'
  }
};

const section = (id, label, actions = []) => ({ id, label, actions });

const actionEntries = (ids, labels = {}) => Object.fromEntries(ids.map((id) => [
  id,
  {
    id,
    label: labels[id] || toTitleLabel(id)
  }
]));

export const toTitleLabel = (value) => String(value || '')
  .split('-')
  .filter(Boolean)
  .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
  .join(' ');

export const EDITOR_MENU_SPECS = {
  pixel: {
    editorId: 'pixel',
    title: 'Pixel Editor',
    root: ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'rigging'],
    sections: {
      file: section('file', 'File', ['new', 'open', 'save', 'save-as', 'import-image', 'export-image', 'exit-main']),
      draw: section('draw', 'Draw', ['pencil', 'brush', 'eraser', 'fill', 'line', 'shape', 'clone', 'brush-settings']),
      select: section('select', 'Select', ['select-rect', 'select-ellipse', 'select-lasso', 'select-magic', 'move', 'copy', 'cut', 'paste', 'clear']),
      tools: section('tools', 'Tools', ['undo', 'redo', 'copy', 'paste']),
      canvas: section('canvas', 'Canvas', ['grid', 'wrap', 'symmetry', 'tile-preview', 'resize', 'scale', 'crop', 'offset', 'import-image', 'export-image']),
      layers: section('layers', 'Layers', ['layer-list', 'layer-add', 'layer-duplicate', 'layer-delete', 'layer-rename', 'layer-visibility', 'layer-up', 'layer-down', 'layer-merge-up', 'layer-merge-down', 'layer-flatten']),
      frames: section('frames', 'Frames', ['frame-list', 'frame-add', 'frame-duplicate', 'frame-delete', 'frame-delay', 'frame-loop', 'frame-up', 'frame-down', 'frame-playback']),
      rigging: section('rigging', 'Rigging', ['bone-list', 'bone-add', 'bone-bind-layer', 'bone-bind-selection', 'bone-timeline', 'bone-bake'])
    }
  },
  level: {
    editorId: 'level',
    title: 'Level Editor',
    root: ['file', 'tools', 'tiles', 'tile-art', 'actors', 'triggers', 'powerups', 'structures', 'graphics', 'music', 'settings', 'playtest'],
    sections: {
      file: section('file', 'File', ['new', 'open', 'save', 'save-as', 'exit-main']),
      tools: section('tools', 'Tools', ['tile-mode', 'actor-mode', 'structure-mode', 'shape-mode', 'erase']),
      tiles: section('tiles', 'Tiles', ['tile-list', 'tile-paint']),
      'tile-art': section('tile-art', 'Tile Art', ['open-tile-art', 'tile-art-picker']),
      actors: section('actors', 'Actors / NPCs', ['actor-list', 'actor-place']),
      triggers: section('triggers', 'Triggers', ['trigger-list', 'spawn-point']),
      powerups: section('powerups', 'Powerups', ['powerup-list', 'powerup-place']),
      structures: section('structures', 'Structures', ['structure-list', 'structure-place']),
      graphics: section('graphics', 'Graphics', ['decal-list', 'open-graphics']),
      music: section('music', 'Music', ['open-music', 'open-midi-composer']),
      settings: section('settings', 'Settings', ['level-settings', 'midi-settings', 'world-settings']),
      playtest: section('playtest', 'Playtest', ['start-playtest'])
    }
  },
  actor: {
    editorId: 'actor',
    title: 'Actor Editor',
    root: ['file', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview'],
    sections: {
      file: section('file', 'File', ['new', 'open', 'save', 'save-as', 'exit-main']),
      settings: section('settings', 'Settings', ['actor-settings', 'metadata']),
      states: section('states', 'States', ['add-state', 'duplicate-state', 'delete-state', 'state-list']),
      'linked-parts': section('linked-parts', 'Linked Parts', ['open-linked-parts', 'add-linked-part']),
      visuals: section('visuals', 'Visuals', ['animation', 'art-reference', 'frame-timing']),
      collision: section('collision', 'Collision', ['hitbox-zones', 'hurtbox-zones']),
      behavior: section('behavior', 'Behavior', ['conditions', 'actions', 'movement', 'loot', 'audio']),
      preview: section('preview', 'Preview', ['play-scene', 'state-graph'])
    }
  },
  midi: {
    editorId: 'midi',
    title: 'MIDI Editor',
    root: ['file', 'grid', 'song', 'tracks', 'record', 'pedals', 'settings'],
    sections: {
      file: section('file', 'File', ['new', 'open', 'save', 'save-as', 'import-midi', 'export-midi', 'exit-main']),
      grid: section('grid', 'Grid', ['place-note', 'erase-note', 'select-all', 'copy', 'paste', 'quantize', 'note-length']),
      song: section('song', 'Song', ['play', 'stop', 'loop', 'tempo', 'arrangement']),
      tracks: section('tracks', 'Tracks / Mixer', ['track-list', 'instrument', 'volume', 'pan', 'mute', 'solo']),
      record: section('record', 'Record', ['virtual-instruments', 'single-note-record', 'input-settings']),
      pedals: section('pedals', 'Pedals', ['pedal-board', 'open-mixer']),
      settings: section('settings', 'Settings', ['preview-on-edit', 'high-contrast', 'audio-settings'])
    }
  },
  sfx: {
    editorId: 'sfx',
    title: 'SFX Editor',
    root: ['file', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings'],
    sections: {
      file: section('file', 'File', ['new', 'open', 'save', 'save-as', 'import', 'export', 'exit-main']),
      timeline: section('timeline', 'Timeline', ['play', 'stop', 'scrub', 'start', 'end']),
      layers: section('layers', 'Layers', ['layer-list', 'add-layer', 'duplicate-layer', 'delete-layer', 'reorder-layer']),
      envelopes: section('envelopes', 'Envelopes', ['volume', 'pitch', 'pan', 'add-point', 'delete-point']),
      generate: section('generate', 'Generate', ['waveform', 'generator-controls', 'generate']),
      tools: section('tools', 'Tools', ['copy', 'cut', 'paste', 'split', 'undo', 'redo']),
      settings: section('settings', 'Settings', ['loop', 'duration', 'sample-rate'])
    }
  },
  cutscene: {
    editorId: 'cutscene',
    title: 'Cutscene Editor',
    root: ['file', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'export', 'settings'],
    sections: {
      file: section('file', 'File', ['new', 'open', 'save', 'save-as', 'import', 'exit-main']),
      add: section('add', 'Add', ['art', 'actor', 'text', 'color-board', 'music', 'sfx', 'effect', 'pause']),
      timeline: section('timeline', 'Timeline', ['play', 'stop', 'scrub', 'zoom', 'snap']),
      clips: section('clips', 'Clips', ['clip-options', 'asset-binding', 'track-placement']),
      keyframes: section('keyframes', 'Keyframes', ['position', 'scale', 'opacity', 'easing', 'start-mode', 'end-mode', 'playhead-mode']),
      stage: section('stage', 'Stage', ['scene-length', 'fade-in', 'fade-out', 'snap-grid', 'master-volume']),
      audio: section('audio', 'Audio', ['music', 'sfx', 'master-volume']),
      export: section('export', 'Export', ['export-mp4', 'export-progress']),
      settings: section('settings', 'Settings', ['workspace-mode', 'snap-size'])
    }
  }
};

export const EDITOR_MENU_ALIASES = {
  pixel: {
    frames: 'animation',
    rigging: 'bones'
  },
  level: {
    tools: 'toolbox',
    'tile-art': 'pixels',
    actors: 'npcs',
    structures: 'prefabs',
    settings: 'level-settings'
  },
  actor: {},
  midi: {
    tracks: 'instruments',
    record: 'virtual-instruments'
  },
  sfx: {},
  cutscene: {}
};

Object.values(EDITOR_MENU_SPECS).forEach((spec) => {
  const actionIds = Array.from(new Set(Object.values(spec.sections).flatMap((entry) => entry.actions)));
  spec.actions = actionEntries(actionIds, Object.fromEntries(Object.values(spec.sections).map((entry) => [entry.id, entry.label])));
  spec.placements = { ...EDITOR_MENU_PLACEMENTS };
  spec.aliases = { ...(EDITOR_MENU_ALIASES[spec.editorId] || {}) };
});

export const getEditorMenuSpec = (editorId) => EDITOR_MENU_SPECS[editorId] || null;

export const getEditorMenuSection = (editorId, sectionId) => (
  getEditorMenuSpec(editorId)?.sections?.[sectionId] || null
);

export const getEditorRootMenuIds = (editorId) => (
  getEditorMenuSpec(editorId)?.root?.slice() || []
);

export const getEditorMenuRuntimeId = (editorId, specId) => (
  getEditorMenuSpec(editorId)?.aliases?.[specId] || specId
);

export const getEditorMenuSpecIdForRuntime = (editorId, runtimeId) => {
  const aliases = getEditorMenuSpec(editorId)?.aliases || {};
  const match = Object.entries(aliases).find(([, value]) => value === runtimeId);
  return match?.[0] || runtimeId;
};

export function getEditorRootMenuEntries(editorId, {
  labelOverrides = {},
  extraEntries = []
} = {}) {
  const spec = getEditorMenuSpec(editorId);
  if (!spec) return [];
  return [
    ...spec.root.map((specId) => {
      const sectionEntry = spec.sections[specId] || {};
      const id = getEditorMenuRuntimeId(editorId, specId);
      return {
        id,
        specId,
        label: labelOverrides[id] || labelOverrides[specId] || sectionEntry.label || toTitleLabel(specId)
      };
    }),
    ...extraEntries
  ];
}

export function validateEditorMenuSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['Spec must be an object.'];
  if (!spec.editorId) errors.push('Spec requires editorId.');
  if (!Array.isArray(spec.root) || !spec.root.length) errors.push(`${spec.editorId || 'unknown'} requires root menus.`);
  const sections = spec.sections || {};
  (spec.root || []).forEach((id) => {
    if (!sections[id]) errors.push(`${spec.editorId} root menu "${id}" is missing a section.`);
  });
  Object.values(sections).forEach((entry) => {
    if (!entry.id) errors.push(`${spec.editorId} section is missing id.`);
    if (!entry.label) errors.push(`${spec.editorId} section "${entry.id}" is missing label.`);
    if (!Array.isArray(entry.actions)) errors.push(`${spec.editorId} section "${entry.id}" needs actions array.`);
  });
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    if (!spec.placements?.[mode]) errors.push(`${spec.editorId} is missing ${mode} placement.`);
  });
  Object.entries(spec.aliases || {}).forEach(([specId, runtimeId]) => {
    if (!spec.sections?.[specId]) errors.push(`${spec.editorId} alias "${specId}" is missing a source section.`);
    if (!runtimeId) errors.push(`${spec.editorId} alias "${specId}" is missing a runtime id.`);
  });
  return errors;
}
