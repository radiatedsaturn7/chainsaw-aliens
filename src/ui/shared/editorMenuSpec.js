export const EDITOR_LAYOUT_MODES = {
  PORTRAIT: 'portrait',
  LANDSCAPE_TOUCH: 'landscape-touch',
  DESKTOP: 'desktop',
  GAMEPAD: 'gamepad'
};

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((entry) => deepFreeze(entry));
  return value;
};

export const GAMEPAD_MENU_PLACEMENT_SURFACES = deepFreeze({
  root: 'left-slide-rail',
  submenu: 'slide-out-drawer',
  settings: 'slide-out-drawer'
});

export const GAMEPAD_MENU_RENDER_SURFACES = deepFreeze({
  root: GAMEPAD_MENU_PLACEMENT_SURFACES.root,
  submenu: 'left-slide-out-drawer',
  command: 'left-slide-out-drawer',
  persistentContext: 'work-surface-overlay'
});

export const EDITOR_MENU_PLACEMENTS = deepFreeze({
  [EDITOR_LAYOUT_MODES.PORTRAIT]: {
    root: 'bottom-rail',
    submenu: 'bottom-sheet',
    settings: 'bottom-sheet'
  },
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
    root: 'left-rail',
    submenu: 'right-drawer',
    settings: 'right-drawer'
  },
  [EDITOR_LAYOUT_MODES.DESKTOP]: {
    root: 'top-menu',
    submenu: 'dropdown',
    settings: 'dropdown'
  },
  [EDITOR_LAYOUT_MODES.GAMEPAD]: {
    root: GAMEPAD_MENU_PLACEMENT_SURFACES.root,
    submenu: GAMEPAD_MENU_PLACEMENT_SURFACES.submenu,
    settings: GAMEPAD_MENU_PLACEMENT_SURFACES.settings
  }
});

export const EDITOR_MENU_MODE_CONTRACTS = deepFreeze({
  [EDITOR_LAYOUT_MODES.PORTRAIT]: {
    rootSurface: 'bottom-rail',
    submenuSurface: 'bottom-sheet',
    commandSurface: 'bottom-sheet',
    persistentContextSurface: 'bottom-sheet',
    rowActivation: 'tap-release',
    pointerType: 'touch',
    gestureScroll: true
  },
  [EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH]: {
    rootSurface: 'left-rail',
    submenuSurface: 'right-drawer',
    commandSurface: 'right-drawer',
    persistentContextSurface: 'bottom-rail',
    rowActivation: 'tap-release',
    pointerType: 'touch',
    gestureScroll: true
  },
  [EDITOR_LAYOUT_MODES.DESKTOP]: {
    rootSurface: 'top-menu',
    submenuSurface: 'dropdown',
    commandSurface: 'top-dropdown',
    persistentContextSurface: 'left-context-panel',
    rowActivation: 'release',
    pointerType: 'mouse',
    gestureScroll: false
  },
  [EDITOR_LAYOUT_MODES.GAMEPAD]: {
    rootSurface: GAMEPAD_MENU_RENDER_SURFACES.root,
    submenuSurface: GAMEPAD_MENU_RENDER_SURFACES.submenu,
    commandSurface: GAMEPAD_MENU_RENDER_SURFACES.command,
    persistentContextSurface: GAMEPAD_MENU_RENDER_SURFACES.persistentContext,
    rowActivation: 'confirm-button',
    pointerType: 'controller',
    gestureScroll: true
  }
});

const section = (id, label, actions = []) => ({ id, label, actions });

const actionEntries = (ids, labels = {}) => Object.fromEntries(ids.map((id) => [
  id,
  {
    id,
    label: labels[id] || toTitleLabel(id)
  }
]));
const EDITOR_ACTION_LABEL_OVERRIDES = {};

export const REQUIRED_DESKTOP_ROOT_PREFIX = ['file', 'edit', 'view'];
export const DESKTOP_FILE_BASELINE_ACTION_IDS = ['new', 'save', 'save-as', 'open', 'export', 'import'];
export const DESKTOP_FILE_FOOTER_ACTION_ID = 'exit-main';
export const REQUIRED_FILE_ACTION_IDS = [...DESKTOP_FILE_BASELINE_ACTION_IDS, DESKTOP_FILE_FOOTER_ACTION_ID];
export const REQUIRED_EDIT_ACTION_IDS = ['undo', 'redo'];
export const PORTRAIT_ROOT_MAX_ITEMS = 8;
export const PORTRAIT_FORBIDDEN_ROOT_IDS = ['edit', 'view'];
export const PORTRAIT_DYNAMIC_EMPTY_SECTION_IDS = {
  level: ['assets'],
  midi: ['settings'],
  sfx: ['settings'],
  cutscene: ['settings']
};
export const STANDARD_EDITOR_ACTION_RAIL_PREFIX = ['menu', 'undo', 'redo'];
export const SHARED_EDITOR_IDS = ['pixel', 'level', 'actor', 'midi', 'sfx', 'cutscene', 'race', 'car', 'tile'];
export const SUPPORTED_EDITOR_WORK_SURFACES = ['canvas', 'stage', 'grid', 'timeline'];
export const RACE_FORBIDDEN_EXPLICIT_ROUTE_TYPE_ACTION_IDS = ['race-circuit', 'race-destination'];
export const EDIT_ACTION_ROLE_GROUPS = {
  history: ['undo', 'redo'],
  clipboard: ['copy', 'cut', 'paste', 'copy-state', 'paste-state', 'copy-segment', 'paste-segment', 'copy-layer', 'paste-layer'],
  selection: ['select-all'],
  duplicate: ['duplicate-state'],
  destructive: ['clear', 'delete', 'delete-state', 'delete-segment', 'delete-layer', 'tile-reset'],
  targetEdit: ['tile-edit-art']
};
export const EDIT_ACTION_ROLE_ORDER = ['history', 'clipboard', 'selection', 'duplicate', 'targetEdit', 'destructive'];

const EDIT_ACTION_ROLE_BY_ID = Object.fromEntries(
  Object.entries(EDIT_ACTION_ROLE_GROUPS)
    .flatMap(([role, actionIds]) => actionIds.map((actionId) => [actionId, role]))
);
const FILE_FORBIDDEN_EDIT_ACTION_IDS = new Set([
  ...EDIT_ACTION_ROLE_GROUPS.history,
  ...EDIT_ACTION_ROLE_GROUPS.clipboard,
  'copy-image',
  'paste-image'
]);
const FILE_SCOPED_ACTION_IDS = new Set(REQUIRED_FILE_ACTION_IDS);

export const toTitleLabel = (value) => String(value || '')
  .split('-')
  .filter(Boolean)
  .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
  .join(' ');

export const EDITOR_MENU_SPECS = {
  pixel: {
    editorId: 'pixel',
    title: 'Pixel Editor',
    workSurface: 'canvas',
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
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'clear']),
      view: section('view', 'View', ['zoom-in', 'zoom-out', 'zoom-fit', 'grid', 'tile-preview', 'onion']),
      draw: section('draw', 'Draw', ['pencil', 'brush', 'fill', 'line', 'shape', 'brush-settings']),
      select: section('select', 'Select', ['select-rect', 'select-ellipse', 'select-lasso', 'select-magic', 'move']),
      tools: section('tools', 'Tools', ['eraser', 'eyedropper', 'gradient', 'clone', 'dither', 'color-replace', 'hue-shift']),
      canvas: section('canvas', 'Canvas', ['wrap', 'symmetry', 'resize', 'scale', 'crop', 'offset', 'import-image', 'export-image']),
      layers: section('layers', 'Layers', ['layer-add', 'layer-duplicate', 'layer-delete', 'layer-rename', 'layer-visibility', 'layer-up', 'layer-down', 'layer-merge-up', 'layer-merge-down', 'layer-flatten']),
      frames: section('frames', 'Frames', ['frame-add', 'frame-duplicate', 'frame-delete', 'frame-delay', 'frame-loop', 'frame-play', 'frame-step', 'frame-rewind', 'frame-up', 'frame-down']),
      rigging: section('rigging', 'Rigging', ['bone-add', 'bone-bind-layer', 'bone-bind-selection', 'bone-bake'])
    }
  },
  level: {
    editorId: 'level',
    title: 'Level Editor',
    workSurface: 'canvas',
    root: ['file', 'edit', 'view', 'tools', 'tiles', 'tile-art', 'actors', 'triggers', 'powerups', 'structures', 'graphics', 'music', 'settings', 'playtest'],
    portraitRoot: [
      { id: 'file', panel: 'file', label: 'File' },
      { id: 'tools', panel: 'toolbox', label: 'Tools' },
      { id: 'assets', panel: 'tiles', label: 'Assets' },
      { id: 'settings', panel: 'level-settings', label: 'Settings' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'load-wrx', 'load-brz', 'load-civic', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'delete']),
      view: section('view', 'View', ['zoom-in', 'zoom-out', 'zoom-reset']),
      tools: section('tools', 'Tools', ['toolbox', 'tile-mode', 'shape-mode', 'erase']),
      tiles: section('tiles', 'Tiles', ['tile-paint']),
      'tile-art': section('tile-art', 'Tile Art', ['open-tile-art', 'tile-art-picker']),
      actors: section('actors', 'Actors / NPCs', ['enemy-mode']),
      assets: section('assets', 'Assets', []),
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
    workSurface: 'stage',
    root: ['file', 'edit', 'view', 'settings', 'states', 'linked-parts', 'visuals', 'collision', 'behavior', 'preview'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'settings', label: 'Settings' },
      { id: 'states', label: 'States' },
      { id: 'preview', label: 'Preview' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy-state', 'paste-state', 'duplicate-state', 'delete-state']),
      view: section('view', 'View', ['zoom-fit']),
      settings: section('settings', 'Settings', ['actor-settings', 'metadata', 'aggression', 'loot-rules']),
      states: section('states', 'States', ['add-state', 'state-list']),
      'linked-parts': section('linked-parts', 'Linked Parts', ['open-linked-parts', 'add-linked-part']),
      visuals: section('visuals', 'Visuals', ['animation', 'art-reference', 'frame-timing', 'state-graph']),
      collision: section('collision', 'Collision', ['hitbox-zones', 'hurtbox-zones', 'body-damage']),
      behavior: section('behavior', 'Behavior', ['conditions', 'actions', 'movement', 'loot', 'audio']),
      preview: section('preview', 'Preview', ['play-scene'])
    }
  },
  midi: {
    editorId: 'midi',
    title: 'MIDI Editor',
    workSurface: 'grid',
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
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy', 'cut', 'paste', 'select-all', 'delete']),
      view: section('view', 'View', ['zoom-in', 'zoom-out', 'preview', 'contrast']),
      grid: section('grid', 'Grid', ['quantize', 'note-length']),
      song: section('song', 'Song', ['play', 'stop', 'loop', 'tempo']),
      tracks: section('tracks', 'Tracks / Mixer', []),
      record: section('record', 'Record', ['enter-record', 'single-note']),
      pedals: section('pedals', 'Pedals', ['select-pedal-chain']),
      settings: section('settings', 'Settings', [])
    }
  },
  sfx: {
    editorId: 'sfx',
    title: 'SFX Editor',
    workSurface: 'timeline',
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
      view: section('view', 'View', ['zoom-fit', 'loop']),
      timeline: section('timeline', 'Timeline', ['play', 'stop', 'start', 'end']),
      layers: section('layers', 'Layers', ['add-layer', 'duplicate-layer', 'delete-layer']),
      envelopes: section('envelopes', 'Envelopes', ['volume', 'pitch', 'pan', 'add-point', 'delete-point']),
      generate: section('generate', 'Generate', ['generate', 'wave-noise', 'wave-saw', 'wave-triangle', 'wave-square', 'wave-custom']),
      tools: section('tools', 'Tools', ['split', 'trim', 'normalize', 'fade', 'reverse', 'bitcrusher', 'stretch', 'loop-wizard']),
      settings: section('settings', 'Settings', [])
    }
  },
  cutscene: {
    editorId: 'cutscene',
    title: 'Cutscene Editor',
    workSurface: 'stage',
    root: ['file', 'edit', 'view', 'add', 'timeline', 'clips', 'keyframes', 'stage', 'audio', 'settings'],
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
      timeline: section('timeline', 'Timeline', ['play', 'step-frame']),
      clips: section('clips', 'Clips', ['clip-options', 'duplicate', 'move-to-track', 'new-track']),
      keyframes: section('keyframes', 'Keyframes', ['set-start', 'set-end', 'set-key', 'delete-key', 'prev-key', 'next-key', 'key-mode', 'ease']),
      stage: section('stage', 'Stage', ['scene-duration', 'scene-fade-in', 'scene-fade-out', 'snap-toggle', 'snap-size']),
      audio: section('audio', 'Audio', ['volume', 'fade', 'loop', 'master-volume']),
      settings: section('settings', 'Settings', [])
    }
  },
  race: {
    editorId: 'race',
    title: 'Race Editor',
    workSurface: 'stage',
    root: ['file', 'edit', 'view', 'track', 'ground', 'sprites', 'settings'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'track', label: 'Track' },
      { id: 'ground', label: 'Ground' },
      { id: 'sprites', label: 'Sprites' },
      { id: 'settings', label: 'Settings' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'generate-random-race', 'load-weathertech-raceway', 'load-nurburgring-nordschleife', 'load-col-de-turini', 'load-ouninpohja', 'load-daytona-tri-oval', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'copy-segment', 'paste-segment', 'delete-segment']),
      view: section('view', 'View', ['preview-mode7', 'zoom-fit', 'toggle-scenery', 'toggle-racing-line']),
      track: section('track', 'Track', ['draw-road', 'move-node', 'remove-node', 'remove-edge', 'insert-node', 'snap-node', 'segment-width', 'segment-bumpiness', 'boundary-collidable', 'snow-condition', 'edge-tile', 'surface-asphalt', 'surface-dirt', 'surface-gravel', 'surface-snow', 'surface-wet-asphalt']),
      ground: section('ground', 'Ground', [
        'ground-tile-next',
        'ground-tile-grass',
        'ground-tile-dirt',
        'ground-tile-gravel',
        'ground-tile-snow',
        'ground-tile-asphalt',
        'ground-tile-wet-asphalt',
        'elevation-up',
        'elevation-down',
        'elevation-up-tiny',
        'elevation-up-small',
        'elevation-up-medium',
        'elevation-up-large',
        'elevation-down-tiny',
        'elevation-down-small',
        'elevation-down-medium',
        'elevation-down-large',
        'elevation-brush-size',
        'ground-brush-small',
        'ground-brush-medium',
        'ground-brush-large',
        'ground-brush-xl',
        'ground-brush-xxl',
        'ground-brush-shape-square',
        'ground-brush-shape-round',
        'ground-brush-falloff-hard',
        'ground-brush-falloff-soft',
        'ground-brush-falloff-airbrush',
        'ground-brush-strength-25',
        'ground-brush-strength-50',
        'ground-brush-strength-75',
        'ground-brush-strength-100'
      ]),
      sprites: section('sprites', 'Sprites', ['sprite-select', 'race-decal', 'race-ground-box', 'paint-sprite', 'sprite-brush-settings', 'erase-sprite', 'paint-decal', 'erase-decal', 'paint-tile', 'erase-tile']),
      settings: section('settings', 'Settings', ['ai-count', 'add-sprite', 'skybox-next', 'race-sun', 'race-weather', 'race-margin', 'race-tiles', 'race-tire-fx', 'race-texture-scale'])
    }
  },
  car: {
    editorId: 'car',
    title: 'Car Editor',
    workSurface: 'stage',
    root: ['file', 'edit', 'view', 'art', 'drivetrain', 'tuning', 'aero', 'suspension', 'drive'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'art', label: 'Art' },
      { id: 'drivetrain', label: 'Drive' },
      { id: 'tuning', label: 'Tune' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo']),
      view: section('view', 'View', ['zoom-fit']),
      art: section('art', 'Art', ['body-art', 'tire-treads', 'brake-lights', 'add-ons']),
      drivetrain: section('drivetrain', 'Drivetrain', ['drivetrain-menu', 'engine-sound-next', 'power-curve', 'weight-balance']),
      tuning: section('tuning', 'Tuning', ['default-tires', 'tire-pressure', 'tire-size', 'brake-balance', 'final-drive', 'diff-accel', 'diff-decel']),
      aero: section('aero', 'Aero', ['aero-front', 'aero-rear']),
      suspension: section('suspension', 'Suspension', ['spring-front', 'spring-rear', 'damping-front', 'damping-rear', 'antiroll-front', 'antiroll-rear']),
      drive: section('drive', 'Drive', ['test-drive'])
    }
  },
  tile: {
    editorId: 'tile',
    title: 'Tile Editor',
    workSurface: 'grid',
    root: ['file', 'edit', 'view', 'tiles', 'properties'],
    portraitRoot: [
      { id: 'file', label: 'File' },
      { id: 'tiles', label: 'Tiles' },
      { id: 'properties', label: 'Props' }
    ],
    sections: {
      file: section('file', 'File', ['new', 'save', 'save-as', 'open', 'export', 'import', 'exit-main']),
      edit: section('edit', 'Edit', ['undo', 'redo', 'tile-edit-art', 'tile-reset']),
      view: section('view', 'View', ['zoom-fit', 'tile-preview']),
      tiles: section('tiles', 'Tiles', ['tile-prev', 'tile-next']),
      properties: section('properties', 'Properties', ['tile-edit-properties', 'tile-toggle-solid', 'tile-toggle-one-way', 'tile-toggle-destructible'])
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
  car: {},
  tile: {}
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
  car: {},
  tile: {}
};

export const EDITOR_DESKTOP_SECTION_MAP = {
  pixel: {
    frames: 'animation',
    rigging: 'bones'
  },
  actor: {
    file: 'settings',
    edit: 'states',
    view: 'view',
    settings: 'settings',
    states: 'states',
    'linked-parts': 'linked-parts',
    visuals: 'states',
    collision: 'states',
    behavior: 'states',
    preview: 'preview'
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
  },
  tile: {
    file: 'tile-file',
    edit: 'tile-edit',
    view: 'tile-view',
    tiles: 'tile-list',
    properties: 'tile-properties'
  }
};

Object.values(EDITOR_MENU_SPECS).forEach((spec) => {
  const actionIds = Array.from(new Set(Object.values(spec.sections).flatMap((entry) => entry.actions)));
  spec.actions = actionEntries(actionIds, Object.fromEntries(Object.values(spec.sections).map((entry) => [entry.id, entry.label])));
  Object.entries(EDITOR_ACTION_LABEL_OVERRIDES).forEach(([id, label]) => {
    if (spec.actions?.[id]) spec.actions[id].label = label;
  });
  spec.placements = structuredClone(EDITOR_MENU_PLACEMENTS);
  spec.modeContracts = structuredClone(EDITOR_MENU_MODE_CONTRACTS);
  spec.aliases = { ...(EDITOR_MENU_ALIASES[spec.editorId] || {}) };
  spec.rootLabelOverrides = { ...(EDITOR_ROOT_LABEL_OVERRIDES[spec.editorId] || {}) };
  spec.desktopSections = { ...(EDITOR_DESKTOP_SECTION_MAP[spec.editorId] || {}) };
  spec.desktopControllerMenus = { ...(EDITOR_DESKTOP_CONTROLLER_MENU_MAP[spec.editorId] || {}) };
  if (spec.actions?.['test-drive']) spec.actions['test-drive'].label = 'Playtest';
});

export const getEditorMenuSpec = (editorId) => EDITOR_MENU_SPECS[editorId] || null;

export function getStandardEditorActionRailIds(contextActionId = null) {
  return [
    ...STANDARD_EDITOR_ACTION_RAIL_PREFIX,
    ...(contextActionId ? [contextActionId] : [])
  ];
}

export const getEditorWorkSurfaceType = (editorId) => (
  getEditorMenuSpec(editorId)?.workSurface || 'canvas'
);

export const getEditorMenuModeContract = (editorId, mode = EDITOR_LAYOUT_MODES.DESKTOP) => {
  const resolvedMode = Object.values(EDITOR_LAYOUT_MODES).includes(mode)
    ? mode
    : EDITOR_LAYOUT_MODES.DESKTOP;
  const contract = getEditorMenuSpec(editorId)?.modeContracts?.[resolvedMode] || EDITOR_MENU_MODE_CONTRACTS[resolvedMode];
  return contract ? { ...contract } : null;
};

export const getEditorMenuSection = (editorId, sectionId) => (
  getEditorMenuSpec(editorId)?.sections?.[sectionId] || null
);

export const getEditorEditActionRole = (actionId) => EDIT_ACTION_ROLE_BY_ID[actionId] || null;

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
  maxItems = PORTRAIT_ROOT_MAX_ITEMS
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
  if (!spec.workSurface) {
    errors.push(`${spec.editorId || 'unknown'} requires workSurface.`);
  } else if (!SUPPORTED_EDITOR_WORK_SURFACES.includes(spec.workSurface)) {
    errors.push(`${spec.editorId || 'unknown'} work surface type "${spec.workSurface}" is unsupported.`);
  }
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
  if ((spec.portraitRoot || []).length > PORTRAIT_ROOT_MAX_ITEMS) {
    errors.push(`${spec.editorId} portraitRoot must expose no more than ${PORTRAIT_ROOT_MAX_ITEMS} bottom menu items.`);
  }
  const portraitRootIds = (spec.portraitRoot || []).map((entry) => (typeof entry === 'string' ? entry : entry.id));
  const duplicatePortraitRootIds = portraitRootIds.filter((id, index, ids) => ids.indexOf(id) !== index);
  Array.from(new Set(duplicatePortraitRootIds)).forEach((id) => {
    errors.push(`${spec.editorId} portrait root menu "${id}" is duplicated.`);
  });
  const aliasRuntimeIds = Object.values(spec.aliases || {});
  const aliasSpecIds = Object.keys(spec.aliases || {});
  const portraitSectionIds = new Set((spec.portraitRoot || []).flatMap((entry) => (
    typeof entry === 'string'
      ? [entry]
      : [entry.id, entry.specId, entry.panel].filter(Boolean)
  )));
  Object.keys(sections).forEach((sectionId) => {
    const resolvesFromRoot = (spec.root || []).includes(sectionId);
    const resolvesFromPortrait = portraitSectionIds.has(sectionId);
    const resolvesFromAlias = aliasSpecIds.includes(sectionId) || aliasRuntimeIds.includes(sectionId);
    if (!resolvesFromRoot && !resolvesFromPortrait && !resolvesFromAlias) {
      errors.push(`${spec.editorId} section "${sectionId}" is not reachable from a root menu, portrait panel, or runtime alias.`);
    }
  });
  (spec.portraitRoot || []).forEach((entry) => {
    const id = typeof entry === 'string' ? entry : entry.id;
    const specId = typeof entry === 'string' ? entry : entry.specId;
    const panel = typeof entry === 'string' ? null : entry.panel;
    if (PORTRAIT_FORBIDDEN_ROOT_IDS.includes(id)) {
      errors.push(`${spec.editorId} portrait root menu must not expose desktop-only "${id}" root; use the bottom rail or a workflow submenu instead.`);
    }
    const candidates = [id, specId, panel].filter(Boolean);
    const resolves = candidates.some((candidate) => (
      (spec.root || []).includes(candidate)
      || Boolean(sections[candidate])
      || aliasRuntimeIds.includes(candidate)
    ));
    if (!resolves) {
      errors.push(`${spec.editorId} portrait root menu "${id}" does not resolve to a root menu, section, panel, or runtime alias.`);
    }
    const resolvedSectionId = candidates.find((candidate) => Boolean(sections[candidate]));
    const resolvedSection = resolvedSectionId ? sections[resolvedSectionId] : null;
    const dynamicEmptySections = PORTRAIT_DYNAMIC_EMPTY_SECTION_IDS[spec.editorId] || [];
    if (resolvedSection && (resolvedSection.actions || []).length === 0 && !dynamicEmptySections.includes(resolvedSectionId)) {
      errors.push(`${spec.editorId} portrait root menu "${id}" resolves to empty section "${resolvedSectionId}"; add actions or register it as a dynamic portrait panel.`);
    }
  });
  REQUIRED_FILE_ACTION_IDS.forEach((actionId) => {
    if (!sections.file?.actions?.includes(actionId)) {
      errors.push(`${spec.editorId} file menu is missing required action "${actionId}".`);
    }
  });
  if (REQUIRED_FILE_ACTION_IDS.every((actionId) => sections.file?.actions?.includes(actionId))) {
    DESKTOP_FILE_BASELINE_ACTION_IDS.forEach((actionId, index) => {
      if (sections.file?.actions?.[index] !== actionId) {
        errors.push(`${spec.editorId} file menu action ${index + 1} must be "${actionId}" for desktop File dropdown consistency.`);
      }
    });
    const fileActions = sections.file?.actions || [];
    if (fileActions[fileActions.length - 1] !== DESKTOP_FILE_FOOTER_ACTION_ID) {
      errors.push(`${spec.editorId} file menu must keep "${DESKTOP_FILE_FOOTER_ACTION_ID}" as the final File command.`);
    }
    fileActions.forEach((actionId) => {
      if (FILE_FORBIDDEN_EDIT_ACTION_IDS.has(actionId)) {
        const role = getEditorEditActionRole(actionId) || 'clipboard';
        errors.push(`${spec.editorId} file menu must not include ${role} action "${actionId}"; use the Edit drawer instead.`);
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
  (sections.edit?.actions || []).forEach((actionId) => {
    if (!getEditorEditActionRole(actionId)) {
      errors.push(`${spec.editorId} edit action "${actionId}" is missing a shared edit action role.`);
    }
  });
  let previousEditRoleIndex = -1;
  (sections.edit?.actions || []).forEach((actionId) => {
    const role = getEditorEditActionRole(actionId);
    if (!role) return;
    const roleIndex = EDIT_ACTION_ROLE_ORDER.indexOf(role);
    if (roleIndex < previousEditRoleIndex) {
      errors.push(`${spec.editorId} edit action "${actionId}" must not appear after a later Edit role group; expected role order is ${EDIT_ACTION_ROLE_ORDER.join(' > ')}.`);
      return;
    }
    previousEditRoleIndex = Math.max(previousEditRoleIndex, roleIndex);
  });
  Object.values(sections).forEach((entry) => {
    if (!entry.id) errors.push(`${spec.editorId} section is missing id.`);
    if (!entry.label) errors.push(`${spec.editorId} section "${entry.id}" is missing label.`);
    if (!Array.isArray(entry.actions)) errors.push(`${spec.editorId} section "${entry.id}" needs actions array.`);
    const duplicateActions = (entry.actions || []).filter((id, index, ids) => ids.indexOf(id) !== index);
    Array.from(new Set(duplicateActions)).forEach((id) => {
      errors.push(`${spec.editorId} section "${entry.id}" duplicates action "${id}".`);
    });
    (entry.actions || []).forEach((actionId) => {
      if (entry.id !== 'file' && FILE_SCOPED_ACTION_IDS.has(actionId)) {
        errors.push(`${spec.editorId} section "${entry.id}" must not include File action "${actionId}"; keep document actions in File.`);
      }
      if (!spec.actions?.[actionId]) errors.push(`${spec.editorId} action "${actionId}" is missing from actions map.`);
    });
  });
  const actionOwners = new Map();
  Object.values(sections).forEach((entry) => {
    (entry.actions || []).forEach((actionId) => {
      if (!actionOwners.has(actionId)) actionOwners.set(actionId, []);
      const owners = actionOwners.get(actionId);
      if (!owners.includes(entry.id)) owners.push(entry.id);
    });
  });
  Array.from(actionOwners.entries()).forEach(([actionId, owners]) => {
    if (owners.length > 1) {
      errors.push(`${spec.editorId} action "${actionId}" must have one shared menu owner; found in ${owners.join(', ')}.`);
    }
  });
  if (spec.editorId === 'race') {
    const raceActions = Object.values(sections).flatMap((entry) => entry.actions || []);
    RACE_FORBIDDEN_EXPLICIT_ROUTE_TYPE_ACTION_IDS.forEach((actionId) => {
      if (raceActions.includes(actionId) || spec.actions?.[actionId]) {
        errors.push(`race menus must infer route type from endpoint connection instead of exposing explicit "${actionId}" action.`);
      }
    });
  }
  Object.values(EDITOR_LAYOUT_MODES).forEach((mode) => {
    if (!spec.placements?.[mode]) errors.push(`${spec.editorId} is missing ${mode} placement.`);
    const contract = spec.modeContracts?.[mode];
    if (!contract) {
      errors.push(`${spec.editorId} is missing ${mode} mode contract.`);
      return;
    }
    const sharedContract = EDITOR_MENU_MODE_CONTRACTS[mode];
    if (spec.placements?.[mode]?.root !== contract.rootSurface) {
      errors.push(`${spec.editorId} ${mode} mode contract rootSurface must match placement root "${spec.placements?.[mode]?.root}".`);
    }
    const placementSubmenu = spec.placements?.[mode]?.submenu;
    const submenuMatches = placementSubmenu === contract.submenuSurface
      || (mode === EDITOR_LAYOUT_MODES.GAMEPAD
        && placementSubmenu === GAMEPAD_MENU_PLACEMENT_SURFACES.submenu
        && contract.submenuSurface === GAMEPAD_MENU_RENDER_SURFACES.submenu);
    if (!submenuMatches) {
      errors.push(`${spec.editorId} ${mode} mode contract submenuSurface must match placement submenu "${spec.placements?.[mode]?.submenu}".`);
    }
    if (sharedContract && contract.pointerType !== sharedContract.pointerType) {
      errors.push(`${spec.editorId} ${mode} mode contract pointerType must match shared pointerType "${sharedContract.pointerType}" instead of "${contract.pointerType}".`);
    }
    if (sharedContract && contract.gestureScroll !== sharedContract.gestureScroll) {
      errors.push(`${spec.editorId} ${mode} mode contract gestureScroll must match shared gestureScroll ${sharedContract.gestureScroll} instead of ${contract.gestureScroll}.`);
    }
    if (mode === EDITOR_LAYOUT_MODES.PORTRAIT) {
      if (spec.placements?.[mode]?.root !== 'bottom-rail') {
        errors.push(`${spec.editorId} portrait root placement must use bottom-rail instead of "${spec.placements?.[mode]?.root}".`);
      }
      if (spec.placements?.[mode]?.submenu !== 'bottom-sheet') {
        errors.push(`${spec.editorId} portrait submenu placement must use bottom-sheet instead of "${spec.placements?.[mode]?.submenu}".`);
      }
      if (spec.placements?.[mode]?.settings !== 'bottom-sheet') {
        errors.push(`${spec.editorId} portrait settings placement must use bottom-sheet instead of "${spec.placements?.[mode]?.settings}".`);
      }
      if (contract.commandSurface !== 'bottom-sheet') {
        errors.push(`${spec.editorId} portrait command surface must use bottom-sheet instead of "${contract.commandSurface}".`);
      }
      if (contract.rowActivation !== 'tap-release') {
        errors.push(`${spec.editorId} portrait row activation must use tap-release instead of "${contract.rowActivation}".`);
      }
      if (contract.persistentContextSurface !== 'bottom-sheet') {
        errors.push(`${spec.editorId} portrait persistent context surface must use bottom-sheet instead of "${contract.persistentContextSurface}".`);
      }
    }
    if (mode === EDITOR_LAYOUT_MODES.LANDSCAPE_TOUCH) {
      if (spec.placements?.[mode]?.root !== 'left-rail') {
        errors.push(`${spec.editorId} landscape root placement must use left-rail instead of "${spec.placements?.[mode]?.root}".`);
      }
      if (spec.placements?.[mode]?.submenu !== 'right-drawer') {
        errors.push(`${spec.editorId} landscape submenu placement must use right-drawer instead of "${spec.placements?.[mode]?.submenu}".`);
      }
      if (spec.placements?.[mode]?.settings !== 'right-drawer') {
        errors.push(`${spec.editorId} landscape settings placement must use right-drawer instead of "${spec.placements?.[mode]?.settings}".`);
      }
      if (contract.commandSurface !== 'right-drawer') {
        errors.push(`${spec.editorId} landscape command surface must use right-drawer instead of "${contract.commandSurface}".`);
      }
      if (contract.rowActivation !== 'tap-release') {
        errors.push(`${spec.editorId} landscape row activation must use tap-release instead of "${contract.rowActivation}".`);
      }
      if (contract.persistentContextSurface !== 'bottom-rail') {
        errors.push(`${spec.editorId} landscape persistent context surface must use bottom-rail instead of "${contract.persistentContextSurface}".`);
      }
    }
    if (mode === EDITOR_LAYOUT_MODES.DESKTOP) {
      if (contract.commandSurface !== 'top-dropdown') {
        errors.push(`${spec.editorId} desktop command surface must use top-dropdown instead of "${contract.commandSurface}".`);
      }
      if (contract.rowActivation !== 'release') {
        errors.push(`${spec.editorId} desktop row activation must use release instead of "${contract.rowActivation}".`);
      }
      if (contract.persistentContextSurface !== 'left-context-panel') {
        errors.push(`${spec.editorId} desktop persistent context surface must use left-context-panel instead of "${contract.persistentContextSurface}".`);
      }
    }
    if (mode === EDITOR_LAYOUT_MODES.GAMEPAD) {
      if (spec.placements?.[mode]?.root !== GAMEPAD_MENU_PLACEMENT_SURFACES.root) {
        errors.push(`${spec.editorId} gamepad root placement must use ${GAMEPAD_MENU_PLACEMENT_SURFACES.root} instead of "${spec.placements?.[mode]?.root}".`);
      }
      if (spec.placements?.[mode]?.submenu !== GAMEPAD_MENU_PLACEMENT_SURFACES.submenu) {
        errors.push(`${spec.editorId} gamepad submenu placement must use ${GAMEPAD_MENU_PLACEMENT_SURFACES.submenu} instead of "${spec.placements?.[mode]?.submenu}".`);
      }
      if (spec.placements?.[mode]?.settings !== GAMEPAD_MENU_PLACEMENT_SURFACES.settings) {
        errors.push(`${spec.editorId} gamepad settings placement must use ${GAMEPAD_MENU_PLACEMENT_SURFACES.settings} instead of "${spec.placements?.[mode]?.settings}".`);
      }
      if (contract.commandSurface !== GAMEPAD_MENU_RENDER_SURFACES.command) {
        errors.push(`${spec.editorId} gamepad command surface must use ${GAMEPAD_MENU_RENDER_SURFACES.command} instead of "${contract.commandSurface}".`);
      }
      if (contract.rowActivation !== 'confirm-button') {
        errors.push(`${spec.editorId} gamepad row activation must use confirm-button instead of "${contract.rowActivation}".`);
      }
      if (contract.persistentContextSurface !== GAMEPAD_MENU_RENDER_SURFACES.persistentContext) {
        errors.push(`${spec.editorId} gamepad persistent context surface must use ${GAMEPAD_MENU_RENDER_SURFACES.persistentContext} instead of "${contract.persistentContextSurface}".`);
      }
    }
    if (mode === EDITOR_LAYOUT_MODES.DESKTOP && spec.placements?.[mode]?.settings !== contract.submenuSurface) {
      errors.push(`${spec.editorId} desktop settings placement must use command dropdown "${contract.submenuSurface}" instead of "${spec.placements?.[mode]?.settings}".`);
    }
    if (!contract.commandSurface) errors.push(`${spec.editorId} ${mode} mode contract requires commandSurface.`);
    if (!contract.rowActivation) errors.push(`${spec.editorId} ${mode} mode contract requires rowActivation.`);
    if (!contract.pointerType) errors.push(`${spec.editorId} ${mode} mode contract requires pointerType.`);
    if (typeof contract.gestureScroll !== 'boolean') errors.push(`${spec.editorId} ${mode} mode contract requires boolean gestureScroll.`);
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
  Object.keys(spec.rootLabelOverrides || {}).forEach((id) => {
    if (!(spec.root || []).includes(id) && !aliasRuntimeIds.includes(id)) {
      errors.push(`${spec.editorId} root label override "${id}" must target a root menu or runtime alias.`);
    }
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

export function validateSharedEditorMenuSpecs() {
  const errors = [];
  const specIds = Object.keys(EDITOR_MENU_SPECS);
  SHARED_EDITOR_IDS.forEach((editorId) => {
    if (!EDITOR_MENU_SPECS[editorId]) errors.push(`Missing shared editor menu spec "${editorId}".`);
  });
  specIds
    .filter((editorId) => !SHARED_EDITOR_IDS.includes(editorId))
    .forEach((editorId) => {
      errors.push(`Unexpected shared editor menu spec "${editorId}".`);
    });
  SHARED_EDITOR_IDS.forEach((editorId) => {
    if (EDITOR_MENU_SPECS[editorId]) {
      validateEditorMenuSpec(EDITOR_MENU_SPECS[editorId]).forEach((error) => errors.push(error));
    }
  });
  return errors;
}
