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

export const REQUIRED_DESKTOP_ROOT_PREFIX = ['file', 'edit', 'view'];
export const REQUIRED_FILE_ACTION_IDS = ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main'];
export const REQUIRED_EDIT_ACTION_IDS = ['undo', 'redo'];

export const toTitleLabel = (value) => String(value || '')
  .split('-')
  .filter(Boolean)
  .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
  .join(' ');

export const EDITOR_MENU_SPECS = {
  pixel: {
    editorId: 'pixel',
    title: 'Pixel Editor',
    root: ['file', 'edit', 'view', 'draw', 'select', 'tools', 'canvas', 'layers', 'frames', 'rigging'],
    portraitRoot: [
      { id: 'file', panel: 'file', label: 'File' },
      { id: 'draw', panel: 'draw', label: 'Draw' },
      { id: 'select', panel: 'select', label: 'Select' },
      { id: 'tools', panel: 'tools', label: 'Tools' },
      { id: 'canvas', panel: 'canvas', label: 'Canvas' },
      { id: 'layers', panel: 'layers', label: 'Layers' },
      { id: 'frames', panel: 'animation', label: 'Frames' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'copy-image', 'paste-image', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'clear']),
      view: section('view', 'View', ['zoom-in', 'zoom-out', 'zoom-fit', 'grid', 'tile-preview', 'onion']),
      draw: section('draw', 'Draw', ['pencil', 'brush', 'eraser', 'fill', 'line', 'shape', 'clone', 'brush-settings']),
      select: section('select', 'Select', ['select-rect', 'select-ellipse', 'select-lasso', 'select-magic', 'move', 'copy', 'cut', 'paste', 'clear']),
      tools: section('tools', 'Tools', ['eraser', 'eyedropper', 'gradient', 'clone', 'dither', 'color-replace', 'hue-shift']),
      canvas: section('canvas', 'Canvas', ['grid', 'wrap', 'symmetry', 'tile-preview', 'resize', 'scale', 'crop', 'offset', 'import-image', 'export-image']),
      layers: section('layers', 'Layers', ['layer-add', 'layer-duplicate', 'layer-delete', 'layer-rename', 'layer-visibility', 'layer-up', 'layer-down', 'layer-merge-up', 'layer-merge-down', 'layer-flatten']),
      frames: section('frames', 'Frames', ['frame-add', 'frame-duplicate', 'frame-delete', 'frame-delay', 'frame-loop', 'frame-play', 'frame-step', 'frame-rewind', 'frame-up', 'frame-down']),
      rigging: section('rigging', 'Rigging', ['bone-add', 'bone-bind-layer', 'bone-bind-selection', 'bone-bake'])
    }
  },
  level: {
    editorId: 'level',
    title: 'Level Editor',
    root: ['file', 'edit', 'view', 'tools', 'tiles', 'tile-art', 'actors', 'triggers', 'powerups', 'structures', 'graphics', 'music', 'settings', 'playtest'],
    portraitRoot: [
      { id: 'file', panel: 'file', label: 'File' },
      { id: 'tools', panel: 'toolbox', label: 'Tools' },
      { id: 'assets', panel: 'tiles', label: 'Assets' },
      { id: 'settings', panel: 'level-settings', label: 'Settings' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'playtest', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']),
      view: section('view', 'View', ['zoom-in', 'zoom-out', 'zoom-reset', 'playtest']),
      tools: section('tools', 'Tools', ['toolbox', 'tile-mode', 'enemy-mode', 'prefab-mode', 'shape-mode', 'erase']),
      tiles: section('tiles', 'Tiles', ['tile-paint']),
      'tile-art': section('tile-art', 'Tile Art', ['open-tile-art', 'tile-art-picker']),
      actors: section('actors', 'Actors / NPCs', ['enemy-mode']),
      assets: section('assets', 'Assets', ['tile-paint', 'open-tile-art', 'enemy-mode', 'powerup-place', 'prefab-mode']),
      triggers: section('triggers', 'Triggers', ['trigger-draw', 'spawn']),
      powerups: section('powerups', 'Powerups', ['powerup-place']),
      structures: section('structures', 'Structures', ['prefab-mode']),
      graphics: section('graphics', 'Graphics', ['open-graphics', 'graphics-take-screenshot', 'graphics-apply-decal']),
      music: section('music', 'Music', ['open-music', 'music-trigger', 'music-paint', 'music-erase', 'open-midi-composer']),
      settings: section('settings', 'Settings', ['resize-level', 'crop-level', 'spawn-point', 'start-everything', 'random-level', 'midi']),
      playtest: section('playtest', 'Playtest', ['playtest'])
    }
  },
  actor: {
    editorId: 'actor',
    title: 'Actor Editor',
    root: ['file', 'edit', 'view', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'actor', label: 'Settings' },
      { id: 'states', label: 'States' },
      { id: 'tools', label: 'Tools' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy-state', 'paste-state', 'duplicate-state', 'delete-state']),
      view: section('view', 'View', ['state-graph', 'hitbox-zones', 'play-scene']),
      actor: section('actor', 'Settings', ['actor-settings', 'metadata', 'aggression', 'loot-rules']),
      settings: section('settings', 'Settings', ['actor-settings', 'metadata', 'aggression', 'loot-rules']),
      states: section('states', 'States', ['add-state', 'duplicate-state', 'delete-state', 'state-list']),
      'linked-parts': section('linked-parts', 'Linked Parts', ['open-linked-parts', 'add-linked-part']),
      visuals: section('visuals', 'Visuals', ['animation', 'art-reference', 'frame-timing', 'state-graph']),
      collision: section('collision', 'Collision', ['hitbox-zones', 'hurtbox-zones', 'body-damage']),
      behavior: section('behavior', 'Behavior', ['conditions', 'actions', 'movement', 'loot', 'audio']),
      preview: section('preview', 'Preview', ['play-scene', 'state-graph', 'hitbox-zones']),
      tools: section('tools', 'Tools', ['state-graph', 'play-scene', 'hitbox-zones'])
    }
  },
  midi: {
    editorId: 'midi',
    title: 'MIDI Editor',
    root: ['file', 'edit', 'view', 'grid', 'song', 'tracks', 'record', 'pedals', 'settings'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'grid', label: 'Grid' },
      { id: 'song', label: 'Song' },
      { id: 'instruments', label: 'Mixer' },
      { id: 'virtual-instruments', label: 'Record' },
      { id: 'pedals', label: 'Pedals' },
      { id: 'settings', label: 'Settings' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'rescue-save', 'export-midi', 'export-midi-zip', 'export-wav', 'save-paint', 'play-robtersession', 'theme', 'sample', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'select-all', 'copy', 'cut', 'paste', 'delete']),
      view: section('view', 'View', ['zoom-in', 'zoom-out', 'preview', 'contrast']),
      grid: section('grid', 'Grid', ['quantize', 'note-length']),
      song: section('song', 'Song', ['play', 'stop', 'loop', 'tempo']),
      tracks: section('tracks', 'Tracks / Mixer', []),
      record: section('record', 'Record', ['enter-record', 'single-note']),
      pedals: section('pedals', 'Pedals', ['select-pedal-chain']),
      settings: section('settings', 'Settings', ['quantize', 'preview', 'contrast'])
    }
  },
  sfx: {
    editorId: 'sfx',
    title: 'SFX Editor',
    root: ['file', 'edit', 'view', 'timeline', 'layers', 'envelopes', 'generate', 'tools', 'settings'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'generate', label: 'Generate' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'layers', label: 'Layers' },
      { id: 'envelopes', label: 'Envelopes' },
      { id: 'tools', label: 'Tools' },
      { id: 'settings', label: 'Settings' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']),
      view: section('view', 'View', ['play', 'stop', 'start', 'end', 'loop']),
      timeline: section('timeline', 'Timeline', ['play', 'stop', 'start', 'end']),
      layers: section('layers', 'Layers', ['add-layer', 'duplicate-layer', 'delete-layer']),
      envelopes: section('envelopes', 'Envelopes', ['volume', 'pitch', 'pan', 'add-point', 'delete-point']),
      generate: section('generate', 'Generate', ['generate', 'wave-noise', 'wave-saw', 'wave-triangle', 'wave-square', 'wave-custom']),
      tools: section('tools', 'Tools', ['split', 'trim', 'normalize', 'fade', 'reverse', 'bitcrusher', 'stretch', 'loop-wizard']),
      settings: section('settings', 'Settings', ['loop'])
    }
  },
  cutscene: {
    editorId: 'cutscene',
    title: 'Cutscene Editor',
    root: ['file', 'edit', 'view', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'export', 'settings'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'add', label: 'Add' },
      { id: 'timeline', label: 'Time' },
      { id: 'clips', label: 'Clips' },
      { id: 'keyframes', label: 'Keys' },
      { id: 'stage', label: 'Stage' },
      { id: 'audio', label: 'Audio' },
      { id: 'settings', label: 'Settings' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']),
      view: section('view', 'View', ['view-canvas', 'view-split', 'view-timeline', 'timeline-zoom-out', 'timeline-zoom-in', 'timeline-fit']),
      add: section('add', 'Add', ['art', 'actor', 'text', 'color-board', 'music', 'sfx', 'effect', 'pause']),
      timeline: section('timeline', 'Timeline', ['play', 'step-frame', 'view-canvas', 'view-split', 'view-timeline', 'timeline-zoom-out', 'timeline-zoom-in', 'timeline-fit']),
      clips: section('clips', 'Clips', ['clip-options', 'copy', 'cut', 'paste', 'duplicate', 'move-to-track', 'new-track', 'delete']),
      keyframes: section('keyframes', 'Keyframes', ['set-start', 'set-end', 'set-key', 'delete-key', 'prev-key', 'next-key', 'key-mode', 'ease']),
      stage: section('stage', 'Stage', ['scene-duration', 'scene-fade-in', 'scene-fade-out', 'snap-toggle', 'snap-size', 'master-volume']),
      audio: section('audio', 'Audio', ['music', 'sfx', 'volume', 'fade', 'loop', 'master-volume']),
      export: section('export', 'Export', ['export-mp4', 'save', 'save-as']),
      settings: section('settings', 'Settings', ['scene-duration', 'snap-toggle', 'snap-size', 'master-volume', 'view-canvas', 'view-split', 'view-timeline'])
    }
  },
  race: {
    editorId: 'race',
    title: 'Race Editor',
    root: ['file', 'edit', 'view', 'road', 'surfaces', 'scenery', 'weather', 'race', 'drive'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'road', label: 'Road' },
      { id: 'surfaces', label: 'Surface' },
      { id: 'race', label: 'Race' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy-segment', 'paste-segment', 'delete-segment']),
      view: section('view', 'View', ['preview-mode7', 'zoom-fit', 'toggle-scenery', 'toggle-racing-line']),
      road: section('road', 'Road', ['draw-road', 'move-node', 'segment-length', 'curve', 'elevation', 'square-turn', 'road-width']),
      surfaces: section('surfaces', 'Surfaces', ['ground-tile-next', 'paint-ground', 'edge-tile', 'surface-asphalt', 'surface-dirt', 'surface-gravel', 'surface-snow', 'surface-wet-asphalt', 'surface-texture']),
      scenery: section('scenery', 'Scenery', ['add-sprite', 'move-sprite', 'delete-sprite', 'side-left', 'side-right']),
      weather: section('weather', 'Weather', ['weather-clear', 'weather-rain', 'weather-storm', 'weather-snow']),
      race: section('race', 'Race', ['generate-random-race', 'race-circuit', 'race-destination', 'laps', 'finish-return', 'finish-level', 'finish-race']),
      drive: section('drive', 'Drive', ['test-drive'])
    }
  },
  car: {
    editorId: 'car',
    title: 'Car Editor',
    root: ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'art', label: 'Art' },
      { id: 'drivetrain', label: 'Drive' },
      { id: 'tuning', label: 'Tune' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy-layer', 'paste-layer', 'delete-layer']),
      view: section('view', 'View', ['preview-turns', 'toggle-tires', 'toggle-spoilers', 'zoom-fit']),
      art: section('art', 'Art', ['edit-shell', 'edit-tires', 'edit-spoiler', 'turn-left', 'turn-center', 'turn-right']),
      drivetrain: section('drivetrain', 'Drivetrain', ['drivetrain-rwd', 'drivetrain-fwd', 'drivetrain-awd', 'power', 'weight']),
      tuning: section('tuning', 'Tuning', ['tire-grip', 'brake-balance', 'final-drive', 'diff-accel', 'diff-decel']),
      aero: section('aero', 'Aero', ['aero-front', 'aero-rear']),
      suspension: section('suspension', 'Suspension', ['spring-front', 'spring-rear', 'damping-front', 'damping-rear', 'antiroll-front', 'antiroll-rear']),
      drive: section('drive', 'Drive', ['test-drive'])
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
  cutscene: {},
  race: {},
  car: {}
};

export const EDITOR_ROOT_LABEL_OVERRIDES = {
  pixel: {
    frames: 'Frames',
    rigging: 'Rigging'
  },
  level: {
    tools: 'Toolbox',
    actors: 'Actors',
    'tile-art': 'Tile Art',
    structures: 'Structures',
    settings: 'Settings',
    toolbox: 'Toolbox',
    npcs: 'Actors',
    pixels: 'Tile Art',
    prefabs: 'Structures',
    'level-settings': 'Settings'
  },
  midi: {
    tracks: 'Mixer',
    instruments: 'Mixer',
    record: 'Record',
    'virtual-instruments': 'Record'
  },
  actor: {},
  sfx: {},
  cutscene: {},
  race: {},
  car: {}
};

export const EDITOR_DESKTOP_SECTION_MAP = {
  pixel: {
    frames: 'animation',
    rigging: 'bones'
  },
  actor: {
    file: 'actor',
    edit: 'states',
    view: 'tools',
    settings: 'actor',
    states: 'states',
    'linked-parts': 'linked-parts',
    visuals: 'states',
    collision: 'states',
    behavior: 'states',
    preview: 'tools'
  }
};

export const EDITOR_DESKTOP_CONTROLLER_MENU_MAP = {
  pixel: {
    frames: 'frames',
    rigging: 'bones'
  },
  midi: {
    tracks: 'tracks',
    record: 'record'
  }
};

Object.values(EDITOR_MENU_SPECS).forEach((spec) => {
  const actionIds = Array.from(new Set(Object.values(spec.sections).flatMap((entry) => entry.actions)));
  spec.actions = actionEntries(actionIds, Object.fromEntries(Object.values(spec.sections).map((entry) => [entry.id, entry.label])));
  spec.placements = { ...EDITOR_MENU_PLACEMENTS };
  spec.aliases = { ...(EDITOR_MENU_ALIASES[spec.editorId] || {}) };
  spec.rootLabelOverrides = { ...(EDITOR_ROOT_LABEL_OVERRIDES[spec.editorId] || {}) };
  spec.desktopSections = { ...(EDITOR_DESKTOP_SECTION_MAP[spec.editorId] || {}) };
  spec.desktopControllerMenus = { ...(EDITOR_DESKTOP_CONTROLLER_MENU_MAP[spec.editorId] || {}) };
  if (spec.actions?.['test-drive']) spec.actions['test-drive'].label = 'Playtest';
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

export const getEditorDesktopSectionId = (editorId, rootId) => {
  const spec = getEditorMenuSpec(editorId);
  if (!spec || !rootId) return null;
  const specId = getEditorMenuSpecIdForRuntime(editorId, rootId);
  if (!(spec.root || []).includes(specId)) return null;
  return spec.desktopSections?.[specId] || getEditorMenuRuntimeId(editorId, specId);
};

export const getEditorDesktopRootIdForSection = (editorId, sectionId) => {
  const spec = getEditorMenuSpec(editorId);
  if (!spec || !sectionId) return null;
  const match = (spec.root || []).find((rootId) => (
    getEditorDesktopSectionId(editorId, rootId) === sectionId
  ));
  return match || null;
};

export const getEditorDesktopControllerMenuId = (editorId, rootId) => {
  const spec = getEditorMenuSpec(editorId);
  if (!spec || !rootId) return null;
  const specId = getEditorMenuSpecIdForRuntime(editorId, rootId);
  if (!(spec.root || []).includes(specId)) return null;
  return spec.desktopControllerMenus?.[specId] || getEditorMenuRuntimeId(editorId, specId);
};

export const getEditorDesktopControllerMenuIdForSection = (editorId, sectionId) => {
  const rootId = getEditorDesktopRootIdForSection(editorId, sectionId);
  return rootId ? getEditorDesktopControllerMenuId(editorId, rootId) : null;
};

export function getEditorRootMenuEntries(editorId, {
  labelOverrides = {},
  extraEntries = []
} = {}) {
  const spec = getEditorMenuSpec(editorId);
  if (!spec) return [];
  const mergedLabelOverrides = {
    ...(spec.rootLabelOverrides || {}),
    ...labelOverrides
  };
  return [
    ...spec.root.map((specId) => {
      const sectionEntry = spec.sections[specId] || {};
      const id = getEditorMenuRuntimeId(editorId, specId);
      return {
        id,
        specId,
        label: mergedLabelOverrides[id] || mergedLabelOverrides[specId] || sectionEntry.label || toTitleLabel(specId)
      };
    }),
    ...extraEntries
  ];
}

export function getEditorControllerRootMenuIds(editorId, options = {}) {
  return getEditorControllerRootMenuEntries(editorId, options).map((entry) => entry.controllerMenuId);
}

export function getEditorControllerRootMenuEntries(editorId, options = {}) {
  return getEditorRootMenuEntries(editorId, options).map((entry) => ({
    ...entry,
    controllerMenuId: getEditorDesktopControllerMenuId(editorId, entry.specId || entry.id) || entry.id
  }));
}

export function getEditorRootMenuLabelMap(editorId, options = {}) {
  return Object.fromEntries(getEditorRootMenuEntries(editorId, options).flatMap((entry) => [
    [entry.id, entry.label],
    ...(entry.specId ? [[entry.specId, entry.label]] : [])
  ]));
}

export function getEditorPortraitRootMenuEntries(editorId, {
  labelOverrides = {},
  maxItems = 8
} = {}) {
  const spec = getEditorMenuSpec(editorId);
  if (!spec) return [];
  const roots = Array.isArray(spec.portraitRoot) && spec.portraitRoot.length
    ? spec.portraitRoot
    : getEditorRootMenuEntries(editorId);
  return roots.slice(0, Math.max(0, maxItems)).map((entry) => {
    if (typeof entry === 'string') {
      const sectionEntry = spec.sections[entry] || {};
      const id = getEditorMenuRuntimeId(editorId, entry);
      return {
        id,
        specId: entry,
        panel: id,
        label: labelOverrides[id] || labelOverrides[entry] || sectionEntry.label || toTitleLabel(entry)
      };
    }
    const id = entry.id;
    const specId = entry.specId || getEditorMenuSpecIdForRuntime(editorId, id);
    return {
      ...entry,
      id,
      specId,
      panel: entry.panel || id,
      label: labelOverrides[id] || labelOverrides[specId] || entry.label || toTitleLabel(id)
    };
  });
}

export function validateEditorMenuSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['Spec must be an object.'];
  if (!spec.editorId) errors.push('Spec requires editorId.');
  if (!Array.isArray(spec.root) || !spec.root.length) errors.push(`${spec.editorId || 'unknown'} requires root menus.`);
  if (spec.portraitRoot != null && (!Array.isArray(spec.portraitRoot) || !spec.portraitRoot.length)) {
    errors.push(`${spec.editorId || 'unknown'} portraitRoot must be a non-empty array when provided.`);
  }
  const duplicateRootIds = (spec.root || []).filter((id, index, ids) => ids.indexOf(id) !== index);
  Array.from(new Set(duplicateRootIds)).forEach((id) => {
    errors.push(`${spec.editorId} root menu "${id}" is duplicated.`);
  });
  REQUIRED_DESKTOP_ROOT_PREFIX.forEach((id, index) => {
    if ((spec.root || [])[index] !== id) {
      errors.push(`${spec.editorId} root menu ${index + 1} must be "${id}" for desktop menu consistency.`);
    }
  });
  const sections = spec.sections || {};
  (spec.root || []).forEach((id) => {
    if (!sections[id]) errors.push(`${spec.editorId} root menu "${id}" is missing a section.`);
  });
  if ((spec.portraitRoot || []).length > 8) {
    errors.push(`${spec.editorId} portraitRoot must expose no more than 8 bottom menu items.`);
  }
  const portraitRootIds = (spec.portraitRoot || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const duplicatePortraitRootIds = portraitRootIds.filter((id, index, ids) => ids.indexOf(id) !== index);
  Array.from(new Set(duplicatePortraitRootIds)).forEach((id) => {
    errors.push(`${spec.editorId} portrait root menu "${id}" is duplicated.`);
  });
  const aliasRuntimeIds = Object.values(spec.aliases || {});
  (spec.portraitRoot || []).forEach((entry) => {
    const id = typeof entry === 'string' ? entry : entry.id;
    const specId = typeof entry === 'string' ? entry : entry.specId;
    const panel = typeof entry === 'string' ? null : entry.panel;
    const candidates = [id, specId, panel].filter(Boolean);
    const resolves = candidates.some((candidate) => (
      (spec.root || []).includes(candidate)
      || Boolean(sections[candidate])
      || aliasRuntimeIds.includes(candidate)
    ));
    if (!resolves) {
      errors.push(`${spec.editorId} portrait root menu "${id}" does not resolve to a root menu, section, panel, or runtime alias.`);
    }
  });
  REQUIRED_FILE_ACTION_IDS.forEach((actionId) => {
    if (!sections.file?.actions?.includes(actionId)) {
      errors.push(`${spec.editorId} file menu is missing required action "${actionId}".`);
    }
  });
  if (REQUIRED_FILE_ACTION_IDS.every((actionId) => sections.file?.actions?.includes(actionId))) {
    REQUIRED_FILE_ACTION_IDS.slice(0, 6).forEach((actionId, index) => {
      if (sections.file?.actions?.[index] !== actionId) {
        errors.push(`${spec.editorId} file menu action ${index + 1} must be "${actionId}" for desktop File dropdown consistency.`);
      }
    });
  }
  REQUIRED_EDIT_ACTION_IDS.forEach((actionId) => {
    if (!sections.edit?.actions?.includes(actionId)) {
      errors.push(`${spec.editorId} edit menu is missing required action "${actionId}".`);
    }
  });
  if (REQUIRED_EDIT_ACTION_IDS.every((actionId) => sections.edit?.actions?.includes(actionId))) {
    REQUIRED_EDIT_ACTION_IDS.forEach((actionId, index) => {
      if (sections.edit?.actions?.[index] !== actionId) {
        errors.push(`${spec.editorId} edit menu action ${index + 1} must be "${actionId}" for desktop Edit dropdown consistency.`);
      }
    });
  }
  Object.values(sections).forEach((entry) => {
    if (!entry.id) errors.push(`${spec.editorId} section is missing id.`);
    if (!entry.label) errors.push(`${spec.editorId} section "${entry.id}" is missing label.`);
    if (!Array.isArray(entry.actions)) errors.push(`${spec.editorId} section "${entry.id}" needs actions array.`);
    const duplicateActions = (entry.actions || []).filter((id, index, ids) => ids.indexOf(id) !== index);
    Array.from(new Set(duplicateActions)).forEach((id) => {
      errors.push(`${spec.editorId} section "${entry.id}" duplicates action "${id}".`);
    });
    (entry.actions || []).forEach((actionId) => {
      if (!spec.actions?.[actionId]) errors.push(`${spec.editorId} action "${actionId}" is missing from actions map.`);
    });
  });
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    if (!spec.placements?.[mode]) errors.push(`${spec.editorId} is missing ${mode} placement.`);
  });
  Object.entries(spec.aliases || {}).forEach(([specId, runtimeId]) => {
    if (!spec.sections?.[specId]) errors.push(`${spec.editorId} alias "${specId}" is missing a source section.`);
    if (!(spec.root || []).includes(specId)) errors.push(`${spec.editorId} alias "${specId}" is missing from root menus.`);
    if (!runtimeId) errors.push(`${spec.editorId} alias "${specId}" is missing a runtime id.`);
    if ((spec.root || []).includes(runtimeId)) errors.push(`${spec.editorId} alias "${specId}" collides with root menu "${runtimeId}".`);
  });
  const duplicateAliasRuntimeIds = aliasRuntimeIds.filter((id, index, ids) => ids.indexOf(id) !== index);
  Array.from(new Set(duplicateAliasRuntimeIds)).forEach((id) => {
    errors.push(`${spec.editorId} alias runtime id "${id}" is duplicated.`);
  });
  Object.entries(spec.desktopSections || {}).forEach(([rootId, sectionId]) => {
    if (!(spec.root || []).includes(rootId)) errors.push(`${spec.editorId} desktop section root "${rootId}" is missing from root menus.`);
    if (!sections[sectionId] && !aliasRuntimeIds.includes(sectionId)) {
      errors.push(`${spec.editorId} desktop section "${rootId}" targets missing section "${sectionId}".`);
    }
  });
  Object.entries(spec.desktopControllerMenus || {}).forEach(([rootId, menuId]) => {
    if (!(spec.root || []).includes(rootId)) errors.push(`${spec.editorId} desktop controller root "${rootId}" is missing from root menus.`);
    if (!menuId) errors.push(`${spec.editorId} desktop controller root "${rootId}" is missing a menu id.`);
  });
  return errors;
}
