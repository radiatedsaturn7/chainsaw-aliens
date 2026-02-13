import Minimap from '../world/Minimap.js';
import { openProjectBrowser } from '../ui/ProjectBrowserModal.js';
import { vfsList, vfsSave } from '../ui/vfs.js';
import { UI_SUITE, formatMenuLabel } from '../ui/uiSuite.js';
import { clamp, randInt, pickOne } from './input/random.js';
import { startPlaytestTransition, stopPlaytestTransition } from './playtest/transitions.js';

const ROOM_SIZE_PRESETS = [
  [1, 1], [2, 1], [3, 1], [4, 1],
  [1, 2], [1, 3], [1, 4],
  [2, 2], [3, 3], [4, 4]
];
const ROOM_BASE_WIDTH = 38;
const ROOM_BASE_HEIGHT = 18;

const EDITOR_MIN_ZOOM = 0.25;
const EDITOR_MAX_ZOOM = 3;
const EDITOR_ZOOM_SLIDER_EXPONENT = 2.322;

const DEFAULT_TILE_TYPES = [
  { id: 'solid', label: 'Solid Block', char: '#' },
  { id: 'empty', label: 'Empty', char: '.' },
  { id: 'hidden-path', label: 'Hidden Path Block', char: 'Z' },
  { id: 'ice-solid', label: 'Icy Solid Block', char: 'F' },
  { id: 'rock-solid', label: 'Rock Solid Block', char: 'R' },
  { id: 'sand-solid', label: 'Sand Block', char: 'E' },
  { id: 'purple-solid', label: 'Purple Solid Block', char: 'Q' },
  { id: 'crystal-blue', label: 'Blue Crystal Block', char: 'J' },
  { id: 'crystal-green', label: 'Green Crystal Block', char: 'G' },
  { id: 'crystal-purple', label: 'Purple Crystal Block', char: 'V' },
  { id: 'triangle', label: 'Triangle Block', char: '^' },
  { id: 'triangle-flip', label: 'Triangle Block (Flipped)', char: 'v' },
  { id: 'oneway', label: 'One-Way Platform', char: '=' },
  { id: 'sand-platform', label: 'Sand Platform', char: 's' },
  { id: 'elevator-path', label: 'Elevator Path', char: null, special: 'elevator-path' },
  { id: 'elevator-platform', label: 'Elevator Platform', char: null, special: 'elevator-platform' },
  { id: 'water', label: 'Water', char: '~' },
  { id: 'acid', label: 'Acid', char: 'A' },
  { id: 'lava', label: 'Lava', char: 'L' },
  { id: 'spikes', label: 'Spikes', char: '*' },
  { id: 'crystal-spikes', label: 'Crystal Spikes', char: '!' },
  { id: 'ice', label: 'Ice Block', char: 'I' },
  { id: 'conveyor-left', label: 'Conveyor Left', char: '<' },
  { id: 'conveyor-right', label: 'Conveyor Right', char: '>' },
  { id: 'anchor', label: 'Anchor Socket', char: 'a' },
  { id: 'wood', label: 'Wood Barricade', char: 'W' },
  { id: 'metal', label: 'Welded Metal Plate', char: 'X' },
  { id: 'brittle', label: 'Brittle Wall', char: 'C' },
  { id: 'debris', label: 'Heavy Debris', char: 'U' },
  { id: 'snow', label: 'Snow Block', char: 'N' },
  { id: 'lead', label: 'Lead Block', char: 'P' },
  { id: 'box', label: 'Pull Box', char: 'K' },
  { id: 'switch', label: 'Counterweight Switch', char: 'T' },
  { id: 'bossGate', label: 'Rift Seal', char: 'B' },
  { id: 'door', label: 'Door', char: 'D' },
  { id: 'abilityG', label: 'Tools: Chainsaw Throw', char: 'g' },
  { id: 'abilityP', label: 'Tools: Flame-Saw', char: 'p' },
  { id: 'abilityM', label: 'Ability: Mag Boots', char: 'm' },
  { id: 'abilityR', label: 'Ability: Resonance', char: 'r' },
  { id: 'abilityF', label: 'Weapon: Flamethrower', char: 'f' },
  { id: 'health', label: 'Vitality Core', char: 'H' },
  { id: 'spawn', label: 'Player Spawn', char: null, special: 'spawn' },
  { id: 'checkpoint', label: 'Checkpoint', char: 'S' },
  { id: 'shop', label: 'Shop', char: '$' },
  { id: 'objective', label: 'Objective', char: 'O' }
];

const STANDARD_ENEMY_TYPES = [
  { id: 'practice', label: 'Pulse Drone', glyph: 'PD', description: 'Restless drone that fires pulse volleys while circling the arena.' },
  { id: 'skitter', label: 'Skitter', glyph: 'SK', description: 'Fast ground skimmer that rushes the player.' },
  { id: 'spitter', label: 'Spitter', glyph: 'SP', description: 'Ranged turret that spits corrosive shots.' },
  { id: 'bulwark', label: 'Bulwark', glyph: 'BW', description: 'Armored guard that opens when you get close.' },
  { id: 'floater', label: 'Floater', glyph: 'FL', description: 'Hovering drone that drifts around the room.' },
  { id: 'drifter', label: 'Drifter', glyph: 'DF', description: 'Slow-floating creep that stalks the player.' },
  { id: 'bobber', label: 'Bobber', glyph: 'BB', description: 'Bouncy flier that bobbles left and right.' },
  { id: 'harrier', label: 'Harrier', glyph: 'HR', description: 'Aggressive flier that strafes and dives.' },
  { id: 'slicer', label: 'Slicer', glyph: 'SL', description: 'Swift melee threat that darts along the floor.' },
  { id: 'hivenode', label: 'Hive Node', glyph: 'HN', description: 'Stationary nest that spawns skitters.' },
  { id: 'bouncer', label: 'Bouncer', glyph: 'BO', description: 'Leaping brute that hops toward targets.' },
  { id: 'pouncer', label: 'Pouncer', glyph: 'PN', description: 'Spring-loaded hunter that lunges forward.' },
  { id: 'coward', label: 'Coward', glyph: 'CW', description: 'Shy skirmisher that backs away when you approach.' },
  { id: 'ranger', label: 'Ranger', glyph: 'RG', description: 'Marksman that kites and fires precise shots.' },
  { id: 'sentinel', label: 'Sentinel', glyph: 'SE', description: 'Orbital sentinel that fires in pulses.' }
];

const BOSS_ENEMY_TYPES = [
  { id: 'finalboss', label: 'Rift Tyrant', glyph: 'RT', description: 'Commanding rift entity that unleashes volatile blasts.' },
  { id: 'sunderbehemoth', label: 'Sunder Behemoth', glyph: 'SB', description: 'Towering brute that smashes the arena.' },
  { id: 'riftram', label: 'Rift Ram', glyph: 'RR', description: 'Charging juggernaut that barrels through obstacles.' },
  { id: 'broodtitan', label: 'Brood Titan', glyph: 'BT', description: 'Massive brood carrier that floods the area.' },
  { id: 'nullaegis', label: 'Null Aegis', glyph: 'NA', description: 'Shielded guardian that deflects incoming threats.' },
  { id: 'hexmatron', label: 'Hex Matron', glyph: 'HM', description: 'Rift matron weaving hex fields and bursts.' },
  { id: 'gravewarden', label: 'Grave Warden', glyph: 'GW', description: 'Cryptic sentinel that punishes careless movement.' },
  { id: 'obsidiancrown', label: 'Obsidian Crown', glyph: 'OC', description: 'Regal boss that rains down obsidian strikes.' },
  { id: 'cataclysmcolossus', label: 'Cataclysm Colossus', glyph: 'CC', description: 'Planet-cracking colossus with sweeping attacks.' }
];

const BOSS_ROOM_PREFS = {
  finalboss: { shape: 'large', theme: 'rift', hazards: ['A'] },
  sunderbehemoth: { shape: 'long', theme: 'industrial', hazards: ['*'] },
  riftram: { shape: 'long', theme: 'industrial', hazards: ['*'] },
  broodtitan: { shape: 'square', theme: 'cave', hazards: ['L'] },
  nullaegis: { shape: 'square', theme: 'rift', hazards: ['A'] },
  hexmatron: { shape: 'tall', theme: 'ice', hazards: ['~'] },
  gravewarden: { shape: 'tall', theme: 'cave', hazards: ['L'] },
  obsidiancrown: { shape: 'large', theme: 'industrial', hazards: ['*'] },
  cataclysmcolossus: { shape: 'large', theme: 'cave', hazards: ['L'] }
};

const ENEMY_TYPES = [...STANDARD_ENEMY_TYPES, ...BOSS_ENEMY_TYPES];

const SHAPE_TOOLS = [
  { id: 'rect', label: 'Rectangle Fill', short: 'RECT' },
  { id: 'hollow', label: 'Hollow Rectangle', short: 'HOLL' },
  { id: 'line', label: 'Line', short: 'LINE' },
  { id: 'stair', label: 'Stair Generator', short: 'ST' },
  { id: 'triangle', label: 'Triangle Fill', short: 'TRI' },
  { id: 'triangle-1x1', label: 'Triangle Block 1x1', short: 'T1' },
  { id: 'triangle-2x1', label: 'Triangle Block 2x1', short: 'T2W' },
  { id: 'triangle-1x2', label: 'Triangle Block 1x2', short: 'T2H' }
];

const PREFAB_TYPES = [
  { id: 'room', label: 'Room', short: 'RM', roomType: true },
  { id: 'circular', label: 'Circular Room', short: 'CIR', roomType: true },
  { id: 'cave', label: 'Cave Room', short: 'CAV', roomType: true },
  { id: 'corridor', label: 'Corridor', short: 'CR' },
  { id: 'staircase', label: 'Staircase', short: 'SC' },
  { id: 'platform', label: 'Platform Run', short: 'PL' },
  { id: 'arena', label: 'Arena', short: 'AR', roomType: true },
  { id: 'puzzle', label: 'Puzzle Kit', short: 'PZ' },
  { id: 'door', label: 'Door', short: 'DR' },
  { id: 'water-pit', label: 'Water Pit', short: 'WP' },
  { id: 'lava-pit', label: 'Lava Pit', short: 'LP' },
  { id: 'acid-pit', label: 'Acid Pit', short: 'AP' },
  { id: 'spike-pit', label: 'Spike Pit', short: 'SP' },
  { id: 'spike-wall-pit', label: 'Spike Wall Pit', short: 'SW' },
  { id: 'spike-ceiling-pit', label: 'Spike Ceiling Pit', short: 'SC' },
  { id: 'powerup-t', label: 'Powerup T', short: 'PT' },
  { id: 'large-t-solid', label: 'Large T Solid', short: 'TS' },
  { id: 'large-t-ice', label: 'Large T Ice', short: 'TI' },
  { id: 'solid-platform', label: 'Platform (Solid)', short: 'PS' },
  { id: 'industrial-platform', label: 'Industrial Platform', short: 'IP' },
  { id: 'conveyor-belt', label: 'Conveyor Belt', short: 'CB' },
  { id: 'elevator', label: 'Elevator', short: 'EL' },
  { id: 'elevator-horizontal', label: 'Horizontal Elevator', short: 'EH' },
  { id: 'moving-platform', label: 'Moving Platform', short: 'MP' },
  { id: 'stalactite', label: 'Stalactite', short: 'ST' },
  { id: 'stalagmite', label: 'Stalagmite', short: 'SM' },
  { id: 'cave-platform', label: 'Cave Platform', short: 'CP' },
  { id: 'sand-mound', label: 'Sand Mound', short: 'SD' },
  { id: 'sand-platform', label: 'Sand Platform', short: 'SP' }
];

const POWERUP_TYPES = [
  { id: 'powerup-chainsaw', label: 'Tool: Chainsaw Rig', char: 'g' },
  { id: 'powerup-ignitir', label: 'Weapon: Ignitir', char: 'i' },
  { id: 'powerup-flamethrower', label: 'Weapon: Flamethrower', char: 'f' },
  { id: 'powerup-map', label: 'Map Cache', char: 'M' }
];

const MODE_LABELS = {
  tile: 'Tile',
  enemy: 'Enemies',
  prefab: 'Structures',
  shape: 'Shapes',
  trigger: 'Triggers',
  pixel: 'Pixel Art',
  music: 'Music Zones',
  midi: 'MIDI'
};

const TRIGGER_CONDITIONS = [
  'When player enters this location',
  'When player presses attack',
  'When player presses jump',
  'When player ducks',
  'When player holds attack',
  'When this zone takes damage from player',
  'When zone takes damage from enemy'
];

const TRIGGER_ACTION_TYPES = [
  { id: 'load-level', label: 'Load Level' },
  { id: 'kill-player', label: 'Kill Player' },
  { id: 'kill-enemy', label: 'Kill Enemy' },
  { id: 'spawn-enemy', label: 'Spawn Enemy' },
  { id: 'heal-player', label: 'Heal Player' },
  { id: 'heal-enemy', label: 'Heal Enemy' },
  { id: 'save-game', label: 'Save Game' },
  { id: 'add-item', label: 'Add Weapon / Item' },
  { id: 'play-animation', label: 'Play Animation' },
  { id: 'move-entity', label: 'Move Entity / Object' },
  { id: 'fade-in', label: 'Fade In' },
  { id: 'fade-out', label: 'Fade Out' },
  { id: 'display-text', label: 'Display Text' },
  { id: 'wait', label: 'Wait (ms)' },
  { id: 'fade-out-music', label: 'Fade Out Music' },
  { id: 'fade-in-music', label: 'Fade In Music' }
];

const TRIGGER_ITEM_OPTIONS = ['chainsaw-throw', 'flame-saw', 'mag-boots', 'resonance', 'flamethrower', 'health-pack'];
const TRIGGER_ANIMATION_OPTIONS = ['spark-burst', 'explosion-small', 'portal-open', 'screen-shake'];
const TRIGGER_TARGET_OPTIONS = ['player', 'enemy', 'object'];
const TRIGGER_ENEMY_TARGET_OPTIONS = ['nearest', 'all-in-zone', 'by-tag'];
const TRIGGER_TEXT_OPTIONS = ['Warning!', 'Door unlocked.', 'Boss incoming!', 'Checkpoint reached.', 'Objective updated.'];

const TILE_TOOL_LABELS = {
  paint: 'Paint',
  erase: 'Erase',
  move: 'Move'
};

const BIOME_THEMES = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'light-blue', name: 'Light Blue', color: '#9ad9ff' },
  { id: 'dark-green', name: 'Dark Green', color: '#1f6b3a' },
  { id: 'light-grey', name: 'Light Grey', color: '#c7c7c7' },
  { id: 'red', name: 'Red', color: '#e04646' },
  { id: 'purple', name: 'Purple', color: '#8b4cc7' }
];

const PIXEL_GRID_SIZE = 16;
const PIXEL_PALETTE = [
  { id: 'clear', label: 'Clear', color: null },
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'black', label: 'Black', color: '#101010' },
  { id: 'gray', label: 'Gray', color: '#7b7b7b' },
  { id: 'blue', label: 'Blue', color: '#4fb7ff' },
  { id: 'red', label: 'Red', color: '#ff6a6a' },
  { id: 'orange', label: 'Orange', color: '#ff9c42' },
  { id: 'yellow', label: 'Yellow', color: '#ffd24a' },
  { id: 'green', label: 'Green', color: '#55d68a' },
  { id: 'purple', label: 'Purple', color: '#b48dff' }
];

const MUSIC_TRACKS = [
  { id: 'ambient-rift', label: 'Ambient Rift' },
  { id: 'industrial-hum', label: 'Industrial Hum' },
  { id: 'glacier-drift', label: 'Glacier Drift' },
  { id: 'boss-surge', label: 'Boss Surge' }
];

const MIDI_INSTRUMENTS = [
  { id: 'piano', label: 'Piano' },
  { id: 'electric-piano', label: 'E.Piano' },
  { id: 'harpsichord', label: 'Harpsichord' },
  { id: 'clav', label: 'Clav' },
  { id: 'bell', label: 'Bell' },
  { id: 'celesta', label: 'Celesta' },
  { id: 'vibes', label: 'Vibes' },
  { id: 'marimba', label: 'Marimba' },
  { id: 'organ', label: 'Organ' },
  { id: 'strings', label: 'Strings' },
  { id: 'choir', label: 'Choir' },
  { id: 'bass', label: 'Bass' },
  { id: 'guitar-nylon', label: 'Nylon Gtr' },
  { id: 'guitar-steel', label: 'Steel Gtr' },
  { id: 'guitar-electric', label: 'E.Guitar' },
  { id: 'brass', label: 'Brass' },
  { id: 'trumpet', label: 'Trumpet' },
  { id: 'sax', label: 'Sax' },
  { id: 'flute', label: 'Flute' },
  { id: 'clarinet', label: 'Clarinet' },
  { id: 'synth-lead', label: 'Synth Lead' },
  { id: 'synth-pad', label: 'Synth Pad' },
  { id: 'pluck', label: 'Pluck' },
  { id: 'sine', label: 'Sine' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'square', label: 'Square' },
  { id: 'sawtooth', label: 'Saw' }
];

const MIDI_NOTE_LENGTHS = [
  { id: 'whole', label: 'Whole', length: 16 },
  { id: 'half', label: 'Half', length: 8 },
  { id: 'quarter', label: 'Quarter', length: 4 },
  { id: 'eighth', label: '1/8', length: 2 },
  { id: 'sixteenth', label: '1/16', length: 1 }
];

const EDITOR_AUTOSAVE_KEY = 'chainsaw-editor-autosave';


export default class Editor {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.mode = 'tile';
    this.previousNonTriggerMode = 'tile';
    this.tileTool = 'paint';
    this.tileType = DEFAULT_TILE_TYPES[0];
    this.customTile = null;
    this.enemyType = ENEMY_TYPES[0];
    this.enemyCategory = 'standard';
    this.shapeTool = SHAPE_TOOLS[0];
    this.prefabType = PREFAB_TYPES[0];
    this.pixelTool = 'paint';
    this.pixelTarget = DEFAULT_TILE_TYPES.find((tile) => tile.char) || DEFAULT_TILE_TYPES[0];
    this.pixelColorIndex = 1;
    this.pixelFrameIndex = 0;
    this.pixelPaintActive = false;
    this.pixelGridBounds = null;
    this.pixelPaletteBounds = [];
    this.pixelFrameBounds = null;
    this.musicTool = 'paint';
    this.musicTrack = null;
    this.musicDragStart = null;
    this.musicDragTarget = null;
    this.triggerZoneStart = null;
    this.triggerZoneTarget = null;
    this.triggerEditorOpen = false;
    this.selectedTriggerId = null;
    this.triggerEditorView = 'main';
    this.triggerActionDraft = null;
    this.triggerEditingActionId = null;
    this.midiTrackIndex = 0;
    this.midiNoteLength = 4;
    this.midiGridBounds = null;
    this.midiNoteBounds = [];
    this.midiNoteDrag = null;
    this.midiNoteDirty = false;
    this.midiInstrumentScroll = 0;
    this.midiInstrumentScrollBounds = null;
    this.midiInstrumentScrollMax = 0;
    this.startWithEverything = true;
    this.currentDocumentRef = null;
    this.savedSnapshot = null;
    this.camera = { x: 0, y: 0 };
    this.previewMinimap = new Minimap(this.game.world);
    this.pendingWorldRefresh = null;
    this.zoom = 1;
    this.dragging = false;
    this.dragMode = null;
    this.dragStart = null;
    this.panStart = null;
    this.zoomStart = null;
    this.gestureStart = null;
    this.dragButton = null;
    this.pendingChanges = new Map();
    this.pendingSpawn = null;
    this.pendingEnemies = new Map();
    this.pendingElevatorPaths = new Map();
    this.pendingElevators = new Map();
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.hoverTile = null;
    this.regionName = 'Unknown';
    this.lastPointer = { x: 0, y: 0 };
    this.uiButtons = [];
    this.uiSections = {
      file: true,
      playtest: true,
      toolbox: true,
      tiles: true,
      triggers: true,
      enemies: true,
      prefabs: true
    };
    this.panelTabs = ['file', 'toolbox', 'tiles', 'triggers', 'powerups', 'enemies', 'bosses', 'prefabs', 'music'];
    this.panelTabIndex = 0;
    this.panelScroll = {
      file: 0,
      toolbox: 0,
      tiles: 0,
      triggers: 0,
      powerups: 0,
      enemies: 0,
      bosses: 0,
      prefabs: 0,
      shapes: 0,
      pixels: 0,
      music: 0,
      midi: 0
    };
    this.panelScrollMax = {
      file: 0,
      toolbox: 0,
      tiles: 0,
      triggers: 0,
      powerups: 0,
      enemies: 0,
      bosses: 0,
      prefabs: 0,
      shapes: 0,
      pixels: 0,
      music: 0,
      midi: 0
    };
    this.panelScrollBounds = null;
    this.panelScrollView = null;
    this.panelScrollDrag = null;
    this.panelScrollTapCandidate = null;
    this.panelMenuIndex = {
      file: 0,
      toolbox: 0,
      tiles: 0,
      triggers: 0,
      powerups: 0,
      enemies: 0,
      bosses: 0,
      prefabs: 0,
      shapes: 0,
      pixels: 0,
      music: 0,
      midi: 0
    };
    this.panelMenuFocused = false;
    this.drawer = {
      open: true,
      tabIndex: 0,
      tabs: ['file', 'toolbox', 'tiles', 'triggers', 'powerups', 'enemies', 'bosses', 'prefabs', 'music'],
      swipeStart: null
    };
    this.drawerBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.activeTooltip = '';
    this.tooltipTimer = 0;
    this.sanitizeDebug = { enabled: false, reasonLog: new Map() };
    this.editorBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.moveSelection = null;
    this.moveTarget = null;
    this.pendingPointer = null;
    this.longPressTimer = null;
    this.longPressFired = false;
    this.radialMenu = { active: false, x: 0, y: 0, items: [] };
    this.recentTiles = [];
    this.recentEnemies = [];
    this.recentPrefabs = [];
    this.recentShapes = [];
    this.rotation = 0;
    this.playtestPressTimer = null;
    this.playtestPressActive = false;
    this.playtestSpawnOverride = null;
    this.precisionZoom = null;
    this.playButtonBounds = null;
    this.dragSource = null;
    this.panJoystick = {
      center: { x: 0, y: 0 },
      radius: 0,
      knobRadius: 0,
      dx: 0,
      dy: 0,
      active: false,
      id: null
    };
    this.zoomSlider = {
      bounds: { x: 0, y: 0, w: 0, h: 0 },
      active: false,
      id: null
    };
    this.randomLevelSize = { width: 150, height: 100 };
    this.newLevelSizeDraft = { width: ROOM_BASE_WIDTH, height: ROOM_BASE_HEIGHT };
    this.randomLevelSlider = {
      active: null,
      bounds: {
        width: null,
        height: null
      }
    };
    this.randomLevelDialog = { open: false, focus: 'width', mode: 'random' };
    this.randomLevelSliderRepeat = 0;
    this.randomLevelFocusRepeat = 0;
    this.autosaveKey = EDITOR_AUTOSAVE_KEY;
    this.autosaveLoaded = false;
    this.gamepadCursor = {
      x: 0,
      y: 0,
      active: false
    };
    this.focusOverride = null;
    this.dragStart = null;
    this.dragTarget = null;
    this.recordRecent('tiles', this.tileType);
    this.recordRecent('enemies', this.enemyType);
    this.recordRecent('prefabs', this.prefabType);
    this.recordRecent('shapes', this.shapeTool);

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.midiFileInput = document.createElement('input');
    this.midiFileInput.type = 'file';
    this.midiFileInput.accept = 'application/json';
    this.midiFileInput.style.display = 'none';
    document.body.appendChild(this.midiFileInput);

    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.game.applyWorldData(data);
          this.persistAutosave();
          this.resetView();
          this.syncPreviewMinimap();
          this.markSavedSnapshot();
        } catch (error) {
          console.error('Failed to load world data:', error);
        }
      };
      reader.readAsText(file);
      this.fileInput.value = '';
    });

    this.midiFileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          this.replaceMidiTracks(data);
        } catch (error) {
          console.error('Failed to load MIDI tracks:', error);
        }
      };
      reader.readAsText(file);
      this.midiFileInput.value = '';
    });

    window.addEventListener('keydown', (event) => {
      if (!this.active) return;
      const codes = ['KeyS', 'KeyL', 'KeyZ', 'KeyY', 'KeyP'];
      if (event.ctrlKey || codes.includes(event.code)) {
        event.preventDefault();
      }
    });

    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearTransientPointers('visibility-hidden');
      }
    });
    window.addEventListener('blur', () => {
      this.clearTransientPointers('window-blur');
    });
  }


  isFinitePoint(point) {
    return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  sanitizeView(reason = 'unknown') {
    const logOnce = (detail) => {
      if (!this.sanitizeDebug?.enabled) return;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const last = this.sanitizeDebug.reasonLog.get(detail) || 0;
      if (now - last < 1200) return;
      this.sanitizeDebug.reasonLog.set(detail, now);
      console.warn(`[Editor] sanitizeView corrected ${detail}`);
    };

    if (!Number.isFinite(this.zoom) || this.zoom <= 0) {
      this.zoom = 1;
      logOnce(`${reason}:zoom-invalid`);
    }
    const clampedZoom = clamp(this.zoom, EDITOR_MIN_ZOOM, EDITOR_MAX_ZOOM);
    if (clampedZoom !== this.zoom) {
      this.zoom = clampedZoom;
      logOnce(`${reason}:zoom-clamped`);
    }
    if (!Number.isFinite(this.camera.x)) {
      this.camera.x = 0;
      logOnce(`${reason}:camera-x-invalid`);
    }
    if (!Number.isFinite(this.camera.y)) {
      this.camera.y = 0;
      logOnce(`${reason}:camera-y-invalid`);
    }
    this.clampCamera();
    if (!Number.isFinite(this.camera.x)) this.camera.x = 0;
    if (!Number.isFinite(this.camera.y)) this.camera.y = 0;
  }

  updateLayoutBounds(width = this.game.canvas?.width || 0, height = this.game.canvas?.height || 0) {
    if (!width || !height) return;
    const controlMargin = 18;
    const controlBase = Math.min(width, height);
    if (this.isMobileLayout()) {
      const joystickRadius = Math.min(78, controlBase * 0.14);
      const knobRadius = Math.max(22, joystickRadius * 0.45);
      const center = {
        x: controlMargin + joystickRadius,
        y: height - controlMargin - joystickRadius
      };
      this.panJoystick.center = center;
      this.panJoystick.radius = joystickRadius;
      this.panJoystick.knobRadius = knobRadius;
      const sliderHeight = 10;
      let sliderX = center.x + joystickRadius + 24;
      let sliderWidth = width - sliderX - controlMargin;
      const sliderY = height - controlMargin - sliderHeight;
      if (sliderWidth < 160) {
        sliderX = controlMargin;
        sliderWidth = width - controlMargin * 2;
      }
      this.zoomSlider.bounds = { x: sliderX, y: sliderY - 14, w: sliderWidth, h: sliderHeight + 28 };

      const drawerWidth = Math.min(UI_SUITE.layout.leftMenuWidthDesktop, Math.max(UI_SUITE.layout.railWidthMobile + 96, width - 120));
      const collapsedWidth = UI_SUITE.layout.railWidthMobile;
      const panelW = this.drawer.open ? drawerWidth : collapsedWidth;
      this.editorBounds = { x: panelW, y: 0, w: width - panelW, h: height };
      this.drawerBounds = { x: 0, y: 0, w: panelW, h: height };
    } else {
      this.panJoystick.center = { x: 0, y: 0 };
      this.panJoystick.radius = 0;
      this.panJoystick.knobRadius = 0;
      this.zoomSlider.bounds = { x: 0, y: 0, w: 0, h: 0 };
      this.editorBounds = { x: 0, y: 0, w: width, h: height };
      this.drawerBounds = { x: 0, y: 0, w: 0, h: 0 };
    }
  }

  clearTransientPointers(reason = 'unknown') {
    this.resetTransientInputState();
    this.updateLayoutBounds();
    this.sanitizeView(`clearTransientPointers:${reason}`);
  }

  resetTransientInputState() {
    this.dragging = false;
    this.dragMode = null;
    this.dragButton = null;
    this.dragSource = null;
    this.panStart = null;
    this.zoomStart = null;
    this.gestureStart = null;
    this.pendingPointer = null;
    this.longPressFired = false;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.panelScrollDrag = null;
    this.panelScrollTapCandidate = null;
    this.drawer.swipeStart = null;
    this.triggerZoneStart = null;
    this.triggerZoneTarget = null;
    this.musicDragStart = null;
    this.musicDragTarget = null;
    this.panJoystick.active = false;
    this.panJoystick.id = null;
    this.panJoystick.dx = 0;
    this.panJoystick.dy = 0;
    this.zoomSlider.active = false;
    this.zoomSlider.id = null;
    this.playtestPressActive = false;
    if (this.playtestPressTimer) {
      clearTimeout(this.playtestPressTimer);
      this.playtestPressTimer = null;
    }
  }

  activate() {
    this.active = true;
    this.resetTransientInputState();
    this.loadAutosaveOrSeed();
    this.restorePlaytestSpawn();
    this.resetView();
    this.getMusicTracks();
    this.syncPreviewMinimap();
    this.updateLayoutBounds();
    this.sanitizeView('activate');
    this.markSavedSnapshot();
  }

  deactivate() {
    this.active = false;
    this.resetTransientInputState();
    this.dragging = false;
    this.dragMode = null;
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.pendingElevatorPaths.clear();
    this.pendingElevators.clear();
    this.moveSelection = null;
    this.moveTarget = null;
    this.dragStart = null;
    this.dragTarget = null;
    this.dragSource = null;
    this.gamepadCursor.active = false;
    this.pixelPaintActive = false;
    this.musicDragStart = null;
    this.musicDragTarget = null;
    if (this.pendingWorldRefresh) {
      window.clearTimeout(this.pendingWorldRefresh);
      this.pendingWorldRefresh = null;
    }
  }

  syncPreviewMinimap() {
    this.previewMinimap = new Minimap(this.game.world);
    const rooms = this.game.world.rooms || [];
    this.previewMinimap.knownRooms = new Set(rooms.map((_, index) => index));
    this.previewMinimap.exploredRooms = new Set(rooms.map((_, index) => index));
  }

  scheduleWorldRefresh() {
    if (this.pendingWorldRefresh) {
      window.clearTimeout(this.pendingWorldRefresh);
    }
    this.pendingWorldRefresh = window.setTimeout(() => {
      this.flushWorldRefresh();
    }, 120);
  }

  flushWorldRefresh() {
    if (this.pendingWorldRefresh) {
      window.clearTimeout(this.pendingWorldRefresh);
      this.pendingWorldRefresh = null;
    }
    this.game.refreshWorldCaches();
    this.syncPreviewMinimap();
    this.panJoystick.active = false;
    this.panJoystick.id = null;
    this.panJoystick.dx = 0;
    this.panJoystick.dy = 0;
    this.zoomSlider.active = false;
    this.zoomSlider.id = null;
  }

  loadAutosaveOrSeed() {
    if (this.autosaveLoaded) return;
    this.autosaveLoaded = true;
    if (this.loadAutosave()) return;
    this.createRandomLevel(150, 100);
  }

  clearAutosave() {
    const storage = this.getStorage();
    if (!storage) return;
    storage.removeItem(this.autosaveKey);
    this.autosaveLoaded = false;
  }

  getStorage() {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  loadAutosave() {
    const storage = this.getStorage();
    if (!storage) return false;
    const raw = storage.getItem(this.autosaveKey);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data || !data.tiles || !data.width || !data.height) {
        storage.removeItem(this.autosaveKey);
        return false;
      }
      this.game.applyWorldData(data);
      this.syncPreviewMinimap();
      return true;
    } catch (error) {
      storage.removeItem(this.autosaveKey);
      return false;
    }
  }

  persistAutosave() {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.autosaveKey, JSON.stringify(this.game.buildWorldData()));
    } catch (error) {
      console.warn('Unable to save editor autosave:', error);
    }
  }

  resetView() {
    const { canvas } = this.game;
    const candidates = [
      this.focusOverride,
      this.game.world?.spawnPoint,
      this.game.spawnPoint,
      this.game.world?.spawn && Number.isFinite(this.game.world.spawn.x) && Number.isFinite(this.game.world.spawn.y)
        ? {
          x: (this.game.world.spawn.x + 0.5) * this.game.world.tileSize,
          y: this.game.world.spawn.y * this.game.world.tileSize
        }
        : null,
      this.game.player,
      { x: 0, y: 0 }
    ];
    const focus = candidates.find((point) => this.isFinitePoint(point)) || { x: 0, y: 0 };
    this.zoom = 1;
    const bounds = this.getCameraBounds();
    this.camera.x = clamp(focus.x - canvas.width / 2, bounds.minX, bounds.maxX);
    this.camera.y = clamp(focus.y - canvas.height / 2, bounds.minY, bounds.maxY);
    this.focusOverride = null;
    this.updateLayoutBounds(canvas.width, canvas.height);
    this.sanitizeView('resetView');
  }

  setFocusOverride(point) {
    this.focusOverride = point;
  }

  update(input, dt) {
    this.handleKeyboard(input, dt);
    this.handleGamepad(input, dt);
    if (!this.isMobileLayout()) {
      if (this.panJoystick.active || this.panJoystick.dx !== 0 || this.panJoystick.dy !== 0) {
        this.panJoystick.active = false;
        this.panJoystick.id = null;
        this.panJoystick.dx = 0;
        this.panJoystick.dy = 0;
      }
      if (this.zoomSlider.active) {
        this.zoomSlider.active = false;
        this.zoomSlider.id = null;
      }
    } else if (Math.abs(this.panJoystick.dx) > 0.01 || Math.abs(this.panJoystick.dy) > 0.01) {
      const panSpeed = 320 * dt * (1 / this.zoom);
      this.camera.x += this.panJoystick.dx * panSpeed;
      this.camera.y += this.panJoystick.dy * panSpeed;
      this.clampCamera();
    }
    this.sanitizeView('update');
    this.updateHover();
    if (this.tooltipTimer > 0) {
      this.tooltipTimer = Math.max(0, this.tooltipTimer - dt);
    }
  }

  handleKeyboard(input, dt = 0) {
    if (input.wasPressedCode('KeyQ')) {
      this.mode = 'tile';
      this.tileTool = 'paint';
    }
    if (input.wasPressedCode('KeyE')) {
      this.mode = 'tile';
      this.tileTool = 'erase';
    }
    if (input.wasPressedCode('KeyM')) {
      this.mode = 'tile';
      this.tileTool = 'move';
    }
    if (input.wasPressedCode('KeyT')) this.mode = 'enemy';
    if (input.wasPressedCode('KeyR')) this.mode = 'prefab';
    if (input.wasPressedCode('KeyG')) this.mode = 'shape';

    for (let i = 1; i <= 9; i += 1) {
      if (input.wasPressedCode(`Digit${i}`)) {
        const type = DEFAULT_TILE_TYPES[i - 1];
        if (type) {
          this.setTileType(type);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      }
    }

    if (input.wasPressedCode('KeyS')) {
      this.saveToFile();
    }
    if (input.wasPressedCode('KeyL')) {
      this.openFileDialog();
    }
    if (input.wasPressedCode('KeyP')) {
      startPlaytestTransition(this.game);
    }

    if (input.wasPressedCode('Escape')) {
      stopPlaytestTransition(this.game);
    }

    if ((input.isDownCode('ControlLeft') || input.isDownCode('ControlRight')) && input.wasPressedCode('KeyZ')) {
      this.undo();
    }
    if ((input.isDownCode('ControlLeft') || input.isDownCode('ControlRight')) && input.wasPressedCode('KeyY')) {
      this.redo();
    }

    const panSpeed = 320 * dt * (1 / this.zoom);
    if (!input.isShiftDown()) {
      if (input.isDownCode('ArrowLeft')) this.camera.x -= panSpeed;
      if (input.isDownCode('ArrowRight')) this.camera.x += panSpeed;
      if (input.isDownCode('ArrowUp')) this.camera.y -= panSpeed;
      if (input.isDownCode('ArrowDown')) this.camera.y += panSpeed;
      this.clampCamera();
    } else {
      if (input.isDownCode('ArrowUp')) this.adjustZoom(0.8, this.game.canvas.width / 2, this.game.canvas.height / 2);
      if (input.isDownCode('ArrowDown')) this.adjustZoom(-0.8, this.game.canvas.width / 2, this.game.canvas.height / 2);
    }
  }

  getActivePanelTab() {
    return this.panelTabs[this.panelTabIndex] || 'file';
  }

  setPanelTab(tabId) {
    const index = this.panelTabs.indexOf(tabId);
    if (index === -1) return;
    this.panelTabIndex = index;
    const drawerIndex = this.drawer.tabs.indexOf(tabId);
    if (drawerIndex >= 0) {
      this.drawer.tabIndex = drawerIndex;
    }
    if (tabId === 'bosses') {
      this.enemyCategory = 'boss';
    } else if (tabId === 'enemies') {
      this.enemyCategory = 'standard';
    }
    if (tabId === 'music') {
      this.getMusicTracks();
    }
  }

  cyclePanelTab(direction) {
    const current = this.getActivePanelTab();
    const currentIndex = Math.max(0, this.panelTabs.indexOf(current));
    const nextIndex = (currentIndex + direction + this.panelTabs.length) % this.panelTabs.length;
    const nextTab = this.panelTabs[nextIndex];
    this.setPanelTab(nextTab);
    const drawerIndex = this.drawer.tabs.indexOf(nextTab);
    if (drawerIndex >= 0) {
      this.drawer.tabIndex = drawerIndex;
    }
    if (nextTab === 'music') {
      this.getMusicTracks();
    }
  }

  closeFileMenu() {
    if (this.isMobileLayout()) {
      this.drawer.open = false;
    }
    this.setPanelTab('toolbox');
  }

  async exitToMainMenu() {
    await this.closeEditorWithPrompt();
  }

  getPanelConfig(tabId, { includeExtras = false } = {}) {
    const tileToolButtons = [
      { id: 'paint', label: 'Paint', tooltip: 'Paint tiles. (Q)' },
      { id: 'erase', label: 'Erase', tooltip: 'Erase tiles. (E)' },
      { id: 'move', label: 'Move', tooltip: 'Move items or pan. (M)' }
    ];
    const spawnTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'spawn');
    let items = [];
    let columns = 1;
    const enemySource = tabId === 'bosses'
      ? BOSS_ENEMY_TYPES
      : STANDARD_ENEMY_TYPES;

    if (tabId === 'playtest') {
      items = [{
        id: 'playtest',
        label: 'Playtest',
        tooltip: 'Start playtest from spawn',
        onClick: () => this.game.exitEditor({ playtest: true })
      }];
    } else if (tabId === 'file') {
      items = [
        {
          id: 'new-level',
          label: 'New',
          tooltip: 'Create a new level',
          onClick: () => this.newLevelDocument()
        },
        {
          id: 'save-storage',
          label: 'Save',
          tooltip: 'Save level to browser storage',
          onClick: () => this.saveLevelToStorage()
        },
        {
          id: 'save-as-storage',
          label: 'Save As',
          tooltip: 'Save level with a new name',
          onClick: () => this.saveLevelToStorage({ forceSaveAs: true })
        },
        {
          id: 'load-storage',
          label: 'Open',
          tooltip: 'Open level from browser storage',
          onClick: () => this.loadLevelFromStorage()
        },
        {
          id: 'resize-level',
          label: 'Resize',
          tooltip: 'Resize level canvas',
          onClick: () => this.resizeLevelDocument()
        },
        { id: 'divider-1', label: '────────', tooltip: '', onClick: () => {} },
        {
          id: 'export-json',
          label: 'Export',
          tooltip: 'Export world JSON',
          onClick: () => this.saveToFile()
        },
        {
          id: 'import-json',
          label: 'Import',
          tooltip: 'Import world JSON',
          onClick: () => this.openFileDialog()
        },
        { id: 'divider-2', label: '────────', tooltip: '', onClick: () => {} },
        {
          id: 'undo',
          label: 'Undo',
          tooltip: 'Undo last change (Ctrl+Z)',
          onClick: () => this.undo()
        },
        {
          id: 'redo',
          label: 'Redo',
          tooltip: 'Redo last change (Ctrl+Y)',
          onClick: () => this.redo()
        },
        { id: 'divider-3', label: '────────', tooltip: '', onClick: () => {} },
        {
          id: 'playtest',
          label: 'Playtest',
          tooltip: 'Start playtest from spawn',
          onClick: () => this.game.exitEditor({ playtest: true })
        },
        ...(spawnTile
          ? [{
            id: 'spawn-point',
            label: 'Spawn Point',
            tooltip: 'Place the player spawn point',
            onClick: () => {
              this.setTileType(spawnTile);
              this.mode = 'tile';
              this.tileTool = 'paint';
            }
          }]
          : []),
        {
          id: 'start-everything',
          label: `Start with everything: ${this.startWithEverything ? 'ON' : 'OFF'}`,
          tooltip: 'Toggle playtest loadout',
          onClick: () => {
            this.startWithEverything = !this.startWithEverything;
          }
        },
        {
          id: 'random-level',
          label: 'Random Level',
          tooltip: 'Create a random level layout',
          onClick: () => this.promptRandomLevel()
        },
        { id: 'divider-4', label: '────────', tooltip: '', onClick: () => {} },
        {
          id: 'close-menu',
          label: 'Close Menu',
          tooltip: 'Close file menu',
          onClick: () => this.closeFileMenu()
        },
        {
          id: 'exit-main',
          label: 'Exit to Main Menu',
          tooltip: 'Exit editor to title',
          onClick: () => this.exitToMainMenu()
        }
      ];
      columns = 2;
    } else if (tabId === 'tiles') {
      items = DEFAULT_TILE_TYPES.map((tile) => ({
        id: tile.id,
        label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
        tile,
        tooltip: `Tile: ${tile.label}`,
        onClick: () => {
          this.setTileType(tile);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      }));
    } else if (tabId === 'triggers') {
      const triggers = this.ensureTriggers();
      items = [
        {
          id: 'trigger-draw',
          label: 'Draw Trigger Zone',
          tooltip: 'Draw a rectangle trigger zone',
          onClick: () => {
            this.mode = 'trigger';
          }
        },
        ...triggers.map((trigger, index) => ({
          id: trigger.id,
          label: `Trigger ${index + 1}`,
          tooltip: trigger.condition,
          onClick: () => {
            this.selectedTriggerId = trigger.id;
            this.triggerEditorOpen = true;
            this.mode = 'trigger';
          }
        }))
      ];
    } else if (tabId === 'enemies' || tabId === 'bosses') {
      items = enemySource.map((enemy) => ({
        id: enemy.id,
        label: `${enemy.label} [${enemy.glyph}]`,
        enemy,
        tooltip: `Enemy: ${enemy.label}`,
        onClick: () => {
          this.setEnemyType(enemy);
          this.mode = 'enemy';
        }
      }));
    } else if (tabId === 'powerups') {
      items = POWERUP_TYPES.map((powerup) => ({
        id: powerup.id,
        label: `${powerup.label} [${powerup.char.toUpperCase()}]`,
        tile: powerup,
        tooltip: `Powerup: ${powerup.label}`,
        onClick: () => {
          this.setTileType(powerup);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      }));
      columns = 2;
    } else if (tabId === 'prefabs') {
      items = PREFAB_TYPES.map((prefab) => ({
        id: prefab.id,
        label: prefab.label,
        prefab,
        tooltip: `Prefab: ${prefab.label}`,
        onClick: () => {
          this.setPrefabType(prefab);
          this.mode = 'prefab';
        }
      }));
    } else if (tabId === 'toolbox') {
      items = [
        ...tileToolButtons.map((tool) => ({
          id: `tile-${tool.id}`,
          label: `Tool: ${tool.label}`,
          tooltip: tool.tooltip,
          onClick: () => {
            this.mode = 'tile';
            this.tileTool = tool.id;
          }
        })),
        ...SHAPE_TOOLS.map((shape) => ({
        id: shape.id,
        label: shape.label,
        shape,
        tooltip: `Shape: ${shape.label}`,
        onClick: () => {
          this.setShapeTool(shape);
          this.mode = 'shape';
        }
      }))
      ];
    } else if (tabId === 'pixels') {
      items = [
        {
          id: 'pixel-brush',
          label: 'Pixel Brush',
          tooltip: 'Paint pixels',
          onClick: () => {
            this.mode = 'pixel';
            this.pixelTool = 'paint';
          }
        },
        {
          id: 'pixel-erase',
          label: 'Pixel Erase',
          tooltip: 'Erase pixels',
          onClick: () => {
            this.mode = 'pixel';
            this.pixelTool = 'erase';
            this.pixelColorIndex = 0;
          }
        },
        {
          id: 'pixel-prev-frame',
          label: 'Prev Frame',
          tooltip: 'Previous pixel frame',
          onClick: () => this.cyclePixelFrame(-1)
        },
        {
          id: 'pixel-next-frame',
          label: 'Next Frame',
          tooltip: 'Next pixel frame',
          onClick: () => this.cyclePixelFrame(1)
        },
        {
          id: 'pixel-add-frame',
          label: 'Add Frame',
          tooltip: 'Add a new frame',
          onClick: () => this.addPixelFrame()
        },
        {
          id: 'pixel-remove-frame',
          label: 'Remove Frame',
          tooltip: 'Remove current frame',
          onClick: () => this.removePixelFrame()
        },
        {
          id: 'pixel-fps-up',
          label: 'FPS +',
          tooltip: 'Increase animation FPS',
          onClick: () => this.adjustPixelFps(1)
        },
        {
          id: 'pixel-fps-down',
          label: 'FPS -',
          tooltip: 'Decrease animation FPS',
          onClick: () => this.adjustPixelFps(-1)
        }
      ];
      items.push(...DEFAULT_TILE_TYPES.filter((tile) => tile.char).map((tile) => ({
        id: `pixel-${tile.id}`,
        label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
        tile,
        tooltip: `Pixel target: ${tile.label}`,
        onClick: () => {
          this.pixelTarget = tile;
          this.mode = 'pixel';
        }
      })));
      columns = 2;
    } else if (tabId === 'music') {
      const tracks = this.getMusicTracks();
      items = [
        {
          id: 'music-paint',
          label: 'Zone Paint',
          tooltip: 'Paint music zones',
          onClick: () => {
            this.mode = 'music';
            this.musicTool = 'paint';
          }
        },
        {
          id: 'music-erase',
          label: 'Zone Erase',
          tooltip: 'Erase music zones',
          onClick: () => {
            this.mode = 'music';
            this.musicTool = 'erase';
          }
        }
      ];
      items.push(...tracks.map((track) => ({
        id: `music-${track.id}`,
        label: track.name || track.label || track.id,
        track,
        tooltip: `Music: ${track.name || track.label || track.id}`,
        onClick: () => {
          this.musicTrack = track;
          this.mode = 'music';
          this.game.audio?.playSong?.(track.id);
        }
      })));
      columns = 2;
    } else if (tabId === 'midi') {
      const tracks = this.ensureMidiTracks();
      items = [
        {
          id: 'midi-add-track',
          label: 'Add Track',
          tooltip: 'Add a new MIDI track',
          onClick: () => this.addMidiTrack()
        },
        {
          id: 'midi-remove-track',
          label: 'Remove Track',
          tooltip: 'Remove selected track',
          onClick: () => this.removeMidiTrack()
        }
      ];
      items.push(...MIDI_NOTE_LENGTHS.map((length) => ({
        id: `midi-length-${length.id}`,
        label: `Note: ${length.label}`,
        tooltip: `Set ${length.label} note length`,
        onClick: () => {
          this.midiNoteLength = length.length;
        }
      })));
      items.push(...tracks.map((track, index) => ({
        id: `midi-track-${track.id}`,
        label: track.name || `Track ${index + 1}`,
        trackIndex: index,
        tooltip: `Edit ${track.name || `Track ${index + 1}`}`,
        onClick: () => {
          this.midiTrackIndex = index;
          this.mode = 'midi';
        }
      })));
      columns = 2;
    }

    if (includeExtras) {
      items.push(
        {
          id: 'save',
          label: 'Save',
          tooltip: 'Save level to browser storage',
          onClick: () => this.saveLevelToStorage()
        },
        {
          id: 'load',
          label: 'Open',
          tooltip: 'Open level from browser storage',
          onClick: () => this.loadLevelFromStorage()
        },
        {
          id: 'exit',
          label: 'Close',
          tooltip: 'Close editor',
          onClick: () => this.closeEditorWithPrompt()
        }
      );
    }

    return { items, columns };
  }

  navigatePanelMenu(input) {
    const activeTab = this.getActivePanelTab();
    const { items, columns } = this.getPanelConfig(activeTab, { includeExtras: this.isMobileLayout() });
    if (items.length === 0) return false;
    if (!input.wasGamepadPressed('dpadUp')
      && !input.wasGamepadPressed('dpadDown')
      && !input.wasGamepadPressed('dpadLeft')
      && !input.wasGamepadPressed('dpadRight')) {
      return false;
    }
    const total = items.length;
    const index = Math.max(0, Math.min(this.panelMenuIndex[activeTab] ?? 0, total - 1));
    let nextIndex = index;
    if (input.wasGamepadPressed('dpadUp')) nextIndex -= columns;
    else if (input.wasGamepadPressed('dpadDown')) nextIndex += columns;
    else if (input.wasGamepadPressed('dpadLeft')) nextIndex -= 1;
    else if (input.wasGamepadPressed('dpadRight')) nextIndex += 1;
    nextIndex = ((nextIndex % total) + total) % total;
    this.panelMenuIndex[activeTab] = nextIndex;
    const nextItem = items[nextIndex];
    if (this.panelScrollView) {
      const { contentHeight, buttonHeight, buttonGap, columns, padding } = this.panelScrollView;
      const row = Math.floor(nextIndex / columns);
      const itemTop = padding + row * (buttonHeight + buttonGap);
      const itemBottom = itemTop + buttonHeight;
      let scrollY = this.panelScroll[activeTab] || 0;
      if (itemTop < scrollY) {
        scrollY = itemTop;
      } else if (itemBottom > scrollY + contentHeight - padding) {
        scrollY = itemBottom - (contentHeight - padding);
      }
      this.panelScroll[activeTab] = clamp(scrollY, 0, this.panelScrollMax[activeTab] || 0);
    }
    if (nextItem.tooltip) {
      this.activeTooltip = nextItem.tooltip;
      this.tooltipTimer = 2;
    }
    return true;
  }

  activatePanelSelection() {
    const activeTab = this.getActivePanelTab();
    const { items } = this.getPanelConfig(activeTab, { includeExtras: this.isMobileLayout() });
    if (items.length === 0) return false;
    const index = Math.max(0, Math.min(this.panelMenuIndex[activeTab] ?? 0, items.length - 1));
    const nextItem = items[index];
    if (!nextItem) return false;
    if (typeof nextItem.onClick === 'function') nextItem.onClick();
    if (nextItem.tooltip) {
      this.activeTooltip = nextItem.tooltip;
      this.tooltipTimer = 2;
    }
    return true;
  }

  handleGamepad(input, dt) {
    if (!input.isGamepadConnected()) {
      if (this.dragging && this.dragSource === 'gamepad') {
        this.endStroke();
      }
      this.gamepadCursor.active = false;
      return;
    }

    if (!this.gamepadCursor.active) {
      const centerX = this.game.canvas.width / 2;
      const centerY = this.game.canvas.height / 2;
      const worldCenter = this.screenToWorld(centerX, centerY);
      this.gamepadCursor = { x: worldCenter.x, y: worldCenter.y, active: true };
      this.lastPointer = { x: centerX, y: centerY };
    }

    const axes = input.getGamepadAxes();
    const tileSize = this.game.world.tileSize;
    const moveSpeed = 420 * dt * (1 / this.zoom);
    const panSpeed = 320 * dt * (1 / this.zoom);
    const deadzone = 0.18;
    const stickX = Math.abs(axes.leftX) > deadzone ? axes.leftX : 0;
    const stickY = Math.abs(axes.leftY) > deadzone ? axes.leftY : 0;
    const lookX = Math.abs(axes.rightX) > deadzone ? axes.rightX : 0;
    const lookY = Math.abs(axes.rightY) > deadzone ? axes.rightY : 0;
    const dialogOpen = this.randomLevelDialog.open;

    if (dialogOpen) {
      this.randomLevelSliderRepeat = Math.max(0, this.randomLevelSliderRepeat - dt);
      this.randomLevelFocusRepeat = Math.max(0, this.randomLevelFocusRepeat - dt);
      if (!this.randomLevelDialog.focus) {
        this.randomLevelDialog.focus = 'width';
      }
      const focusOrder = ['width', 'height', 'cancel', 'ok'];
      const moveFocus = (dir) => {
        const currentIndex = Math.max(0, focusOrder.indexOf(this.randomLevelDialog.focus));
        const nextIndex = clamp(currentIndex + dir, 0, focusOrder.length - 1);
        this.randomLevelDialog.focus = focusOrder[nextIndex];
        this.randomLevelSlider.active = ['width', 'height'].includes(this.randomLevelDialog.focus)
          ? this.randomLevelDialog.focus
          : null;
      };
      if (input.wasGamepadPressed('dpadUp') || (stickY < -0.5 && this.randomLevelFocusRepeat <= 0)) {
        moveFocus(-1);
        this.randomLevelFocusRepeat = 0.18;
      }
      if (input.wasGamepadPressed('dpadDown') || (stickY > 0.5 && this.randomLevelFocusRepeat <= 0)) {
        moveFocus(1);
        this.randomLevelFocusRepeat = 0.18;
      }
      if (['cancel', 'ok'].includes(this.randomLevelDialog.focus)) {
        if (input.wasGamepadPressed('dpadLeft') || input.wasGamepadPressed('dpadRight')) {
          this.randomLevelDialog.focus = this.randomLevelDialog.focus === 'cancel' ? 'ok' : 'cancel';
        }
      }
      if (!this.randomLevelSlider.active && ['width', 'height'].includes(this.randomLevelDialog.focus)) {
        this.randomLevelSlider.active = this.randomLevelDialog.focus;
      }
      if (this.randomLevelSlider.active) {
        if (input.wasGamepadPressed('dpadLeft')) {
          this.adjustRandomLevelSlider(this.randomLevelSlider.active, -1);
        }
        if (input.wasGamepadPressed('dpadRight')) {
          this.adjustRandomLevelSlider(this.randomLevelSlider.active, 1);
        }
        const sliderInput = stickX;
        if (Math.abs(sliderInput) > 0.3 && this.randomLevelSliderRepeat <= 0) {
          const magnitude = Math.abs(sliderInput);
          const step = magnitude > 0.75 ? 6 : 3;
          this.adjustRandomLevelSlider(this.randomLevelSlider.active, Math.sign(sliderInput) * step);
          this.randomLevelSliderRepeat = 0.05;
        }
      }
    }

    const moveX = dialogOpen ? 0 : stickX;
    const moveY = dialogOpen ? 0 : stickY;

    this.gamepadCursor.x += moveX * moveSpeed;
    this.gamepadCursor.y += moveY * moveSpeed;

    if (moveX === 0 && moveY === 0) {
      if (this.navigatePanelMenu(input)) {
        this.panelMenuFocused = true;
      }
    } else {
      this.panelMenuFocused = false;
    }

    if (lookX !== 0 || lookY !== 0) {
      const deltaX = lookX * panSpeed;
      const deltaY = lookY * panSpeed;
      this.camera.x += deltaX;
      this.camera.y += deltaY;
      this.gamepadCursor.x += deltaX;
      this.gamepadCursor.y += deltaY;
      this.clampCamera();
    }

    const zoomDelta = (axes.rightTrigger - axes.leftTrigger) * dt * 1.4;
    if (Math.abs(zoomDelta) > 0.0001) {
      this.setZoom(this.zoom + zoomDelta, this.lastPointer.x, this.lastPointer.y);
    }

    const maxWorldX = this.game.world.width * tileSize - 1;
    const maxWorldY = this.game.world.height * tileSize - 1;
    this.gamepadCursor.x = clamp(this.gamepadCursor.x, 0, maxWorldX);
    this.gamepadCursor.y = clamp(this.gamepadCursor.y, 0, maxWorldY);

    this.keepCursorInView();
    const screenPos = this.worldToScreen(this.gamepadCursor.x, this.gamepadCursor.y);
    this.lastPointer = { x: screenPos.x, y: screenPos.y };

    if (input.wasGamepadPressed('throw')) {
      this.cycleMode(1);
    }
    if (input.wasGamepadPressed('dash')) {
      this.cycleTileTool();
    }
    if (input.wasGamepadPressed('aimUp')) {
      this.cyclePanelTab(-1);
    }
    if (input.wasGamepadPressed('aimDown')) {
      this.cyclePanelTab(1);
    }

    if (dialogOpen && this.randomLevelDialog.justOpened) {
      this.randomLevelDialog.justOpened = false;
    } else if (dialogOpen && input.wasGamepadPressed('jump')) {
      if (this.randomLevelDialog.focus === 'cancel') {
        this.cancelRandomLevel();
      } else {
        this.confirmRandomLevel();
      }
      return;
    } else if (dialogOpen && input.wasGamepadPressed('dash')) {
      this.cancelRandomLevel();
      return;
    }

    if (input.wasGamepadPressed('pause')) {
      this.startPlaytestFromCursor();
      return;
    }
    if (input.wasGamepadPressed('cancel')) {
      stopPlaytestTransition(this.game);
      return;
    }

    const primaryDown = input.isGamepadDown('jump');
    const secondaryDown = input.isGamepadDown('attack');
    const pressPrimary = input.wasGamepadPressed('jump');
    const pressSecondary = input.wasGamepadPressed('attack');

    if (pressPrimary || pressSecondary) {
      if (this.panelMenuFocused && pressPrimary && this.activatePanelSelection()) {
        return;
      }
      if (this.handleUIClick(this.lastPointer.x, this.lastPointer.y)) {
        return;
      }
      if (this.isPointInBounds(this.lastPointer.x, this.lastPointer.y, this.playButtonBounds)) {
        startPlaytestTransition(this.game);
        return;
      }
    }

    if ((pressPrimary || pressSecondary)
      && (!this.dragging || this.dragSource === 'gamepad')
      && !['pixel', 'music', 'midi'].includes(this.mode)) {
      this.dragButton = pressSecondary ? 2 : 0;
      const { tileX, tileY } = this.screenToTile(this.lastPointer.x, this.lastPointer.y);
      const dragMode = pressSecondary
        ? (this.mode === 'enemy' ? 'enemy' : 'erase')
        : this.resolveDragMode(this.mode);
      this.beginStroke(dragMode, tileX, tileY, 'gamepad');
    }

    if (this.dragging && this.dragSource === 'gamepad') {
      if (primaryDown || secondaryDown) {
        const { tileX, tileY } = this.screenToTile(this.lastPointer.x, this.lastPointer.y);
        if (this.dragMode === 'paint' || this.dragMode === 'erase') {
          this.applyPaint(tileX, tileY, this.dragMode);
        }
        if (this.dragMode === 'enemy') {
          const paintMode = this.dragButton === 2 ? 'erase' : 'paint';
          this.applyEnemy(tileX, tileY, paintMode);
        }
        if (this.dragMode === 'move') {
          this.moveTarget = { x: tileX, y: tileY };
        }
        if (this.dragMode === 'shape' || this.dragMode === 'prefab') {
          this.dragTarget = { x: tileX, y: tileY };
        }
      } else {
        this.endStroke();
      }
    }
  }

  keepCursorInView() {
    const margin = 80;
    const viewW = this.game.canvas.width;
    const viewH = this.game.canvas.height;
    const minX = this.camera.x + margin / this.zoom;
    const maxX = this.camera.x + viewW / this.zoom - margin / this.zoom;
    const minY = this.camera.y + margin / this.zoom;
    const maxY = this.camera.y + viewH / this.zoom - margin / this.zoom;
    if (this.gamepadCursor.x < minX) {
      this.camera.x = this.gamepadCursor.x - margin / this.zoom;
    } else if (this.gamepadCursor.x > maxX) {
      this.camera.x = this.gamepadCursor.x - viewW / this.zoom + margin / this.zoom;
    }
    if (this.gamepadCursor.y < minY) {
      this.camera.y = this.gamepadCursor.y - margin / this.zoom;
    } else if (this.gamepadCursor.y > maxY) {
      this.camera.y = this.gamepadCursor.y - viewH / this.zoom + margin / this.zoom;
    }
    this.clampCamera();
  }

  cycleMode(direction) {
    const modes = ['tile', 'enemy', 'prefab', 'shape', 'pixel', 'music', 'midi'];
    const currentIndex = Math.max(0, modes.indexOf(this.mode));
    const nextIndex = (currentIndex + direction + modes.length) % modes.length;
    this.mode = modes[nextIndex];
    if (this.mode === 'tile') {
      this.tileTool = 'paint';
    }
  }

  cycleTileTool() {
    if (this.mode !== 'tile') {
      this.mode = 'tile';
    }
    const tools = ['paint', 'erase', 'move'];
    const currentIndex = Math.max(0, tools.indexOf(this.tileTool));
    this.tileTool = tools[(currentIndex + 1) % tools.length];
  }

  cycleSelection(direction) {
    if (this.mode === 'tile') {
      const tiles = DEFAULT_TILE_TYPES;
      const index = Math.max(0, tiles.findIndex((tile) => tile.id === this.tileType.id));
      const next = tiles[(index + direction + tiles.length) % tiles.length];
      this.setTileType(next);
      this.tileTool = 'paint';
      return;
    }
    if (this.mode === 'enemy') {
      const index = Math.max(0, ENEMY_TYPES.findIndex((enemy) => enemy.id === this.enemyType.id));
      const next = ENEMY_TYPES[(index + direction + ENEMY_TYPES.length) % ENEMY_TYPES.length];
      this.setEnemyType(next);
      return;
    }
    if (this.mode === 'prefab') {
      const index = Math.max(0, PREFAB_TYPES.findIndex((prefab) => prefab.id === this.prefabType.id));
      const next = PREFAB_TYPES[(index + direction + PREFAB_TYPES.length) % PREFAB_TYPES.length];
      this.setPrefabType(next);
      return;
    }
    if (this.mode === 'shape') {
      const index = Math.max(0, SHAPE_TOOLS.findIndex((shape) => shape.id === this.shapeTool.id));
      const next = SHAPE_TOOLS[(index + direction + SHAPE_TOOLS.length) % SHAPE_TOOLS.length];
      this.setShapeTool(next);
    }
  }

  resolveDragMode(mode, tileTool = this.tileTool) {
    if (mode === 'tile') {
      if (tileTool === 'move') return 'move';
      if (tileTool === 'erase') return 'erase';
      return 'paint';
    }
    if (mode === 'enemy') return 'enemy';
    if (mode === 'prefab') return 'prefab';
    if (mode === 'shape') return 'shape';
    return 'paint';
  }

  captureWorldSnapshot() {
    return JSON.stringify(this.game.buildWorldData());
  }

  markSavedSnapshot() {
    this.savedSnapshot = this.captureWorldSnapshot();
  }

  hasUnsavedChanges() {
    if (this.savedSnapshot == null) return false;
    return this.captureWorldSnapshot() !== this.savedSnapshot;
  }

  async promptForNewLevelName() {
    const fallback = this.currentDocumentRef?.name || 'new-level';
    const value = window.prompt('New level file name?', fallback);
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  promptForLevelDimensions(initial = null) {
    const current = initial || this.newLevelSizeDraft || { width: this.game.world?.width || 64, height: this.game.world?.height || 36 };
    const hint = 'Enter size (e.g. 96x54) or room preset (1x1,2x1,3x1,4x1,1x2,1x3,1x4,2x2,3x3,4x4).';
    const value = window.prompt(`${hint}
Level size:`, `${current.width}x${current.height}`);
    if (value == null) return null;
    const raw = value.trim().toLowerCase();
    if (!raw) return null;
    const roomPreset = raw.match(/^(\d)\s*x\s*(\d)$/);
    if (roomPreset) {
      const rw = clamp(parseInt(roomPreset[1], 10), 1, 4);
      const rh = clamp(parseInt(roomPreset[2], 10), 1, 4);
      if ((rw <= 4 && rh === 1) || (rw === 1 && rh <= 4) || (rw === rh && rw >= 1 && rw <= 4)) {
        return {
          width: clamp(rw * ROOM_BASE_WIDTH, 24, 256),
          height: clamp(rh * ROOM_BASE_HEIGHT, 24, 256)
        };
      }
    }
    return this.parseLevelSize(raw);
  }

  buildEmptyLevelData(width, height) {
    const w = clamp(Math.round(width), 24, 256);
    const h = clamp(Math.round(height), 24, 256);
    const tiles = Array.from({ length: h }, (_, y) => {
      const row = Array.from({ length: w }, (_, x) => {
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return '#';
        return '.';
      }).join('');
      return row;
    });
    const spawn = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    return {
      schemaVersion: 1,
      tileSize: this.game.world.tileSize || 32,
      width: w,
      height: h,
      spawn,
      tiles,
      regions: [],
      enemies: [],
      elevatorPaths: [],
      elevators: [],
      pixelArt: { tiles: {} },
      musicZones: [],
      midiTracks: []
    };
  }

  resizeLevelDocument() {
    this.randomLevelDialog.mode = 'resize';
    this.randomLevelDialog.open = true;
    this.randomLevelDialog.justOpened = true;
    this.randomLevelDialog.focus = 'width';
    this.randomLevelSlider.active = 'width';
    this.randomLevelSliderRepeat = 0;
    this.randomLevelFocusRepeat = 0;
    this.randomLevelSize.width = this.game.world.width;
    this.randomLevelSize.height = this.game.world.height;
  }

  async newLevelDocument() {
    this.randomLevelDialog.mode = 'new';
    this.randomLevelDialog.open = true;
    this.randomLevelDialog.justOpened = true;
    this.randomLevelDialog.focus = 'width';
    this.randomLevelSlider.active = 'width';
    this.randomLevelSliderRepeat = 0;
    this.randomLevelFocusRepeat = 0;
    this.randomLevelSize.width = this.newLevelSizeDraft.width;
    this.randomLevelSize.height = this.newLevelSizeDraft.height;
  }

  async closeEditorWithPrompt() {
    if (this.hasUnsavedChanges()) {
      const shouldSave = this.game?.showInlineConfirm?.('Save changes before closing?');
      if (shouldSave) {
        await this.saveLevelToStorage();
      }
    }
    stopPlaytestTransition(this.game, { toTitle: true });
  }

  openFileDialog() {
    this.fileInput.click();
  }

  saveToFile() {
    const data = this.game.buildWorldData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chainsaw-world.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  ensurePixelArtStore() {
    if (!this.game.world.pixelArt) {
      this.game.world.pixelArt = { tiles: {} };
    }
    if (!this.game.world.pixelArt.tiles) {
      this.game.world.pixelArt.tiles = {};
    }
    return this.game.world.pixelArt;
  }

  getPixelArtData(tileChar) {
    if (!tileChar) return null;
    const store = this.ensurePixelArtStore();
    if (!store.tiles[tileChar]) {
      store.tiles[tileChar] = {
        size: PIXEL_GRID_SIZE,
        fps: 6,
        frames: [Array(PIXEL_GRID_SIZE * PIXEL_GRID_SIZE).fill(null)]
      };
    }
    return store.tiles[tileChar];
  }

  getActivePixelFrame() {
    const tileChar = this.pixelTarget?.char;
    const pixelData = this.getPixelArtData(tileChar);
    if (!pixelData) return null;
    if (!Array.isArray(pixelData.frames) || pixelData.frames.length === 0) {
      pixelData.frames = [Array(pixelData.size * pixelData.size).fill(null)];
    }
    if (this.pixelFrameIndex >= pixelData.frames.length) {
      this.pixelFrameIndex = 0;
    }
    const frame = pixelData.frames[this.pixelFrameIndex];
    return { pixelData, frame };
  }

  setPixelCell(cellX, cellY, color) {
    const active = this.getActivePixelFrame();
    if (!active) return;
    const { pixelData, frame } = active;
    const size = pixelData.size || PIXEL_GRID_SIZE;
    if (cellX < 0 || cellY < 0 || cellX >= size || cellY >= size) return;
    const index = cellY * size + cellX;
    if (frame[index] === color) return;
    frame[index] = color;
    this.persistAutosave();
  }

  addPixelFrame() {
    const active = this.getActivePixelFrame();
    if (!active) return;
    const { pixelData } = active;
    const size = pixelData.size || PIXEL_GRID_SIZE;
    pixelData.frames.push(Array(size * size).fill(null));
    this.pixelFrameIndex = pixelData.frames.length - 1;
    this.persistAutosave();
  }

  removePixelFrame() {
    const active = this.getActivePixelFrame();
    if (!active) return;
    const { pixelData } = active;
    if (pixelData.frames.length <= 1) return;
    pixelData.frames.splice(this.pixelFrameIndex, 1);
    this.pixelFrameIndex = clamp(this.pixelFrameIndex, 0, pixelData.frames.length - 1);
    this.persistAutosave();
  }

  cyclePixelFrame(direction) {
    const active = this.getActivePixelFrame();
    if (!active) return;
    const total = active.pixelData.frames.length;
    this.pixelFrameIndex = ((this.pixelFrameIndex + direction) % total + total) % total;
  }

  adjustPixelFps(delta) {
    const active = this.getActivePixelFrame();
    if (!active) return;
    active.pixelData.fps = clamp((active.pixelData.fps || 6) + delta, 1, 24);
    this.persistAutosave();
  }


  ensureTriggers() {
    if (!this.game.world.triggers) {
      this.game.world.triggers = [];
    }
    this.game.world.triggers.forEach((trigger) => this.normalizeTrigger(trigger));
    return this.game.world.triggers;
  }

  addTriggerZone(rect) {
    const triggers = this.ensureTriggers();
    const trigger = {
      id: `trigger-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      rect,
      condition: TRIGGER_CONDITIONS[0],
      actions: []
    };
    triggers.push(trigger);
    this.selectedTriggerId = trigger.id;
    this.triggerEditorOpen = true;
    this.triggerEditorView = 'main';
    this.triggerActionDraft = null;
    this.triggerEditingActionId = null;
    this.persistAutosave();
  }

  removeTriggerAt(tileX, tileY) {
    const triggers = this.ensureTriggers();
    const index = triggers.findIndex((trigger) => {
      const [x, y, w, h] = trigger.rect;
      return tileX >= x && tileX < x + w && tileY >= y && tileY < y + h;
    });
    if (index === -1) return false;
    const [removed] = triggers.splice(index, 1);
    if (removed?.id === this.selectedTriggerId) {
      this.selectedTriggerId = triggers[0]?.id || null;
      this.triggerEditorOpen = Boolean(this.selectedTriggerId);
      this.triggerEditorView = 'main';
      this.triggerActionDraft = null;
      this.triggerEditingActionId = null;
    }
    this.persistAutosave();
    return true;
  }

  getSelectedTrigger() {
    if (!this.selectedTriggerId) return null;
    const triggers = this.ensureTriggers();
    const trigger = triggers.find((entry) => entry.id === this.selectedTriggerId) || null;
    if (trigger) this.normalizeTrigger(trigger);
    return trigger;
  }

  createTriggerAction(typeId) {
    const base = {
      id: `action-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      type: typeId,
      params: {}
    };
    switch (typeId) {
      case 'load-level':
        base.params = { levelName: 'Level 1' };
        break;
      case 'kill-enemy':
        base.params = { target: TRIGGER_ENEMY_TARGET_OPTIONS[0], tag: 'boss' };
        break;
      case 'spawn-enemy':
        base.params = { enemyType: STANDARD_ENEMY_TYPES[0]?.id || 'practice', offsetX: 0, offsetY: 0 };
        break;
      case 'heal-player':
        base.params = { amount: 2 };
        break;
      case 'heal-enemy':
        base.params = { target: TRIGGER_ENEMY_TARGET_OPTIONS[0], amount: 2 };
        break;
      case 'save-game':
        base.params = { slot: 1 };
        break;
      case 'add-item':
        base.params = { itemId: TRIGGER_ITEM_OPTIONS[0], quantity: 1 };
        break;
      case 'play-animation':
        base.params = { animationId: TRIGGER_ANIMATION_OPTIONS[0], target: 'zone' };
        break;
      case 'move-entity':
        base.params = { target: TRIGGER_TARGET_OPTIONS[0], dx: 0, dy: 0 };
        break;
      case 'fade-in':
      case 'fade-out':
      case 'fade-out-music':
        base.params = { durationMs: 1000 };
        break;
      case 'fade-in-music':
        base.params = { musicId: MUSIC_TRACKS[0]?.id || 'ambient-rift', durationMs: 1000 };
        break;
      case 'display-text':
        base.params = { text: TRIGGER_TEXT_OPTIONS[0], durationMs: 2000 };
        break;
      case 'wait':
        base.params = { durationMs: 500 };
        break;
      default:
        base.params = {};
    }
    return base;
  }


  openTriggerActionEditor(action, { isNew = false } = {}) {
    if (!action) return;
    this.triggerActionDraft = JSON.parse(JSON.stringify(action));
    this.triggerEditingActionId = isNew ? null : action.id;
    this.triggerEditorView = 'edit-action';
  }

  commitTriggerActionDraft(trigger) {
    if (!trigger || !this.triggerActionDraft) return;
    if (this.triggerEditingActionId) {
      const index = trigger.actions.findIndex((entry) => entry.id === this.triggerEditingActionId);
      if (index >= 0) {
        trigger.actions[index] = JSON.parse(JSON.stringify(this.triggerActionDraft));
      }
    } else {
      trigger.actions.push(JSON.parse(JSON.stringify(this.triggerActionDraft)));
    }
    this.triggerEditorView = 'main';
    this.triggerActionDraft = null;
    this.triggerEditingActionId = null;
    this.persistAutosave();
  }

  deleteEditingTriggerAction(trigger) {
    if (!trigger || !this.triggerEditingActionId) return;
    const index = trigger.actions.findIndex((entry) => entry.id === this.triggerEditingActionId);
    if (index >= 0) trigger.actions.splice(index, 1);
    this.triggerEditorView = 'main';
    this.triggerActionDraft = null;
    this.triggerEditingActionId = null;
    this.persistAutosave();
  }

  normalizeTrigger(trigger) {
    if (!trigger || typeof trigger !== 'object') return;
    if (!Array.isArray(trigger.actions)) {
      trigger.actions = [];
      return;
    }
    trigger.actions = trigger.actions.map((action) => {
      if (typeof action === 'string') {
        const type = TRIGGER_ACTION_TYPES.find((entry) => entry.label === action)?.id || 'play-animation';
        return this.createTriggerAction(type);
      }
      if (!action.type) {
        action.type = 'play-animation';
      }
      if (!action.id) {
        action.id = `action-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
      }
      if (!action.params || typeof action.params !== 'object') {
        action.params = {};
      }
      return action;
    });
  }

  getTriggerLevelNames() {
    const levels = vfsList('levels').map((entry) => entry.name);
    return levels.length ? levels : ['Level 1'];
  }

  cycleOption(value, options, direction = 1) {
    if (!Array.isArray(options) || options.length === 0) return value;
    const index = options.indexOf(value);
    const nextIndex = ((Math.max(index, 0) + direction) % options.length + options.length) % options.length;
    return options[nextIndex];
  }

  adjustTriggerActionParam(action, key, delta, { min = -999, max = 999 } = {}) {
    if (!action?.params) return;
    const current = Number(action.params[key] || 0);
    action.params[key] = clamp(current + delta, min, max);
  }

  formatTriggerActionSummary(action) {
    if (!action) return '';
    const params = action.params || {};
    switch (action.type) {
      case 'load-level':
        return `Level: ${params.levelName || 'Level 1'}`;
      case 'kill-enemy':
        return `Target: ${params.target || 'nearest'}`;
      case 'spawn-enemy':
        return `Enemy: ${params.enemyType || 'practice'} @ (${params.offsetX || 0}, ${params.offsetY || 0})`;
      case 'heal-player':
        return `Amount: +${params.amount || 0}`;
      case 'heal-enemy':
        return `Target: ${params.target || 'nearest'} +${params.amount || 0}`;
      case 'save-game':
        return `Slot: ${params.slot || 1}`;
      case 'add-item':
        return `Item: ${params.itemId || 'item'} x${params.quantity || 1}`;
      case 'play-animation':
        return `${params.animationId || 'animation'} on ${params.target || 'zone'}`;
      case 'move-entity':
        return `${params.target || 'player'} by (${params.dx || 0}, ${params.dy || 0})`;
      case 'fade-in':
        return `Duration: ${params.durationMs || 0}ms`;
      case 'fade-out':
        return `Duration: ${params.durationMs || 0}ms`;
      case 'display-text':
        return `"${params.text || ''}" (${params.durationMs || 0}ms)`;
      case 'wait':
        return `${params.durationMs || 0}ms`;
      case 'fade-out-music':
        return `Duration: ${params.durationMs || 0}ms`;
      case 'fade-in-music':
        return `${params.musicId || 'ambient-rift'} (${params.durationMs || 0}ms)`;
      default:
        return 'No params';
    }
  }

  async saveLevelToStorage(options = {}) {
    const { forceSaveAs = false } = options;
    let name = this.currentDocumentRef?.name;
    if (forceSaveAs || !name) {
      const result = await openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: 'levels',
        initialFolder: 'levels',
        title: 'Save Level As'
      });
      if (!result?.name) return;
      name = result.name;
    }
    vfsSave('levels', name, this.game.buildWorldData());
    this.currentDocumentRef = { folder: 'levels', name };
    this.markSavedSnapshot();
  }

  loadLevelFromStorage() {
    openProjectBrowser({
      mode: 'open',
      fixedFolder: 'levels',
      initialFolder: 'levels',
      title: 'Open Level',
      onOpen: ({ name, payload }) => {
        if (!payload?.data) return;
        this.game.applyWorldData(payload.data);
        this.currentDocumentRef = { folder: 'levels', name };
        this.flushWorldRefresh();
        this.markSavedSnapshot();
      }
    });
  }

  ensureMusicZones() {
    if (!this.game.world.musicZones) {
      this.game.world.musicZones = [];
    }
    return this.game.world.musicZones;
  }

  addMusicZone(rect, trackId) {
    const zones = this.ensureMusicZones();
    zones.push({
      id: `music-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      rect,
      track: trackId
    });
    this.persistAutosave();
  }

  removeMusicZoneAt(tileX, tileY) {
    const zones = this.ensureMusicZones();
    const index = zones.findIndex((zone) => {
      const [x, y, w, h] = zone.rect;
      return tileX >= x && tileX < x + w && tileY >= y && tileY < y + h;
    });
    if (index === -1) return false;
    zones.splice(index, 1);
    this.persistAutosave();
    return true;
  }

  ensureMidiTracks() {
    if (!this.game.world.midiTracks) {
      this.game.world.midiTracks = [];
    }
    if (this.game.world.midiTracks.length === 0) {
      const defaultInstrument = MIDI_INSTRUMENTS[0]?.id || 'piano';
      this.game.world.midiTracks = MUSIC_TRACKS.map((track) => ({
        id: track.id,
        name: track.label,
        instrument: defaultInstrument,
        notes: []
      }));
    }
    return this.game.world.midiTracks;
  }

  loadSavedSongLibrary() {
    return vfsList('music').map((entry) => ({
      id: entry.name,
      name: entry.name
    }));
  }

  getLibraryTracks() {
    const library = this.loadSavedSongLibrary();
    return library.map((entry) => ({
      id: entry.id,
      name: entry.name,
      source: 'library'
    }));
  }

  getMusicTracks() {
    const tracks = this.ensureMidiTracks();
    const libraryTracks = this.getLibraryTracks();
    const merged = [...libraryTracks, ...tracks.filter((track) => !libraryTracks.some((entry) => entry.id === track.id))];
    if (!merged.length) return merged;
    if (!this.musicTrack || !merged.some((entry) => entry.id === this.musicTrack.id)) {
      this.musicTrack = merged[0];
    }
    return merged;
  }

  getMusicTrackLabel(trackId) {
    if (!trackId) return '';
    const tracks = this.getMusicTracks();
    const match = tracks.find((track) => track.id === trackId);
    return match?.name || match?.label || trackId;
  }

  normalizeMidiTracks(rawTracks) {
    if (!Array.isArray(rawTracks)) return [];
    const fallbackInstrument = MIDI_INSTRUMENTS[0]?.id || 'piano';
    return rawTracks.map((track, index) => ({
      id: track.id || `track-${Date.now()}-${index}`,
      name: track.name || `Track ${index + 1}`,
      instrument: track.instrument || fallbackInstrument,
      notes: Array.isArray(track.notes)
        ? track.notes.map((note) => ({
          pitch: note.pitch,
          start: note.start,
          length: note.length || 1
        }))
        : []
    }));
  }

  replaceMidiTracks(data) {
    const tracks = Array.isArray(data) ? data : data?.midiTracks || data?.tracks || [];
    const normalized = this.normalizeMidiTracks(tracks);
    this.game.world.midiTracks = normalized.length > 0
      ? normalized
      : [{
        id: `track-${Date.now()}`,
        name: 'Track 1',
        instrument: MIDI_INSTRUMENTS[0]?.id || 'piano',
        notes: []
      }];
    this.midiTrackIndex = 0;
    this.musicTrack = this.game.world.midiTracks[0] || null;
    this.persistAutosave();
    this.flushWorldRefresh();
  }

  openMidiFilePicker() {
    if (this.midiFileInput) {
      this.midiFileInput.click();
    }
  }

  getActiveMidiTrack() {
    const tracks = this.ensureMidiTracks();
    if (this.midiTrackIndex >= tracks.length) {
      this.midiTrackIndex = 0;
    }
    return tracks[this.midiTrackIndex];
  }

  addMidiTrack() {
    const tracks = this.ensureMidiTracks();
    const index = tracks.length + 1;
    tracks.push({
      id: `track-${Date.now()}-${index}`,
      name: `Track ${index}`,
      instrument: MIDI_INSTRUMENTS[0]?.id || 'sine',
      notes: []
    });
    this.midiTrackIndex = tracks.length - 1;
    this.persistAutosave();
  }

  removeMidiTrack() {
    const tracks = this.ensureMidiTracks();
    if (tracks.length <= 1) return;
    tracks.splice(this.midiTrackIndex, 1);
    this.midiTrackIndex = clamp(this.midiTrackIndex, 0, tracks.length - 1);
    this.persistAutosave();
  }

  toggleMidiNote(pitch, start, length) {
    const track = this.getActiveMidiTrack();
    if (!track) return;
    const existingIndex = track.notes.findIndex((note) => note.pitch === pitch && note.start === start);
    if (existingIndex >= 0) {
      track.notes.splice(existingIndex, 1);
    } else {
      const maxLength = this.midiGridBounds?.cols || 16;
      const nextLength = clamp(length || 1, 1, maxLength);
      track.notes.push({ pitch, start, length: nextLength });
      this.previewMidiNote(pitch, track.instrument);
    }
    this.persistAutosave();
  }

  previewMidiNote(pitch, instrument) {
    if (!this.game?.audio) return;
    this.game.audio.playMidiNote(pitch, instrument);
  }

  promptRandomLevel() {
    this.randomLevelDialog.open = true;
    this.randomLevelDialog.justOpened = true;
    this.randomLevelDialog.focus = 'width';
    this.randomLevelSlider.active = 'width';
    this.randomLevelSliderRepeat = 0;
    this.randomLevelFocusRepeat = 0;
  }

  confirmRandomLevel() {
    const mode = this.randomLevelDialog.mode || 'random';
    this.randomLevelDialog.open = false;
    this.randomLevelDialog.justOpened = false;
    this.randomLevelDialog.focus = null;
    this.randomLevelSlider.active = null;
    if (mode === 'random') {
      this.createRandomLevel(this.randomLevelSize.width, this.randomLevelSize.height);
      return;
    }
    const data = this.buildEmptyLevelData(this.randomLevelSize.width, this.randomLevelSize.height);
    this.game.applyWorldData(data);
    this.newLevelSizeDraft = { width: data.width, height: data.height };
    if (mode === 'new') {
      const fallback = this.currentDocumentRef?.name || `new-level-${Date.now()}`;
      this.currentDocumentRef = { folder: 'levels', name: fallback };
      this.markSavedSnapshot();
    }
    this.resetView();
    this.syncPreviewMinimap();
  }

  cancelRandomLevel() {
    this.randomLevelDialog.open = false;
    this.randomLevelDialog.justOpened = false;
    this.randomLevelDialog.focus = null;
    this.randomLevelSlider.active = null;
  }

  parseLevelSize(value) {
    if (!value) return null;
    const match = value.toLowerCase().match(/(\d+)\s*[x,]\s*(\d+)/);
    if (!match) return null;
    const width = clamp(parseInt(match[1], 10), 24, 256);
    const height = clamp(parseInt(match[2], 10), 24, 256);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height };
  }

  createRandomLevel(width, height) {
    const tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));
    const rooms = [];
    const elevatorPaths = [];
    const elevators = [];
    const elevatorPathSet = new Set();
    const elevatorSet = new Set();
    const spawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const blockWidth = 38;
    const blockHeight = 18;
    const minRoomSpacing = 6;
    const roomPadding = Math.max(1, Math.floor(minRoomSpacing / 2));
    const cols = Math.max(1, Math.floor((width - 2) / blockWidth));
    const rows = Math.max(1, Math.floor((height - 2) / blockHeight));
    const maxRooms = cols * rows;

    const setTile = (x, y, char) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      tiles[y][x] = char;
    };
    const addElevatorPath = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const key = `${x},${y}`;
      if (elevatorPathSet.has(key)) return;
      elevatorPathSet.add(key);
      elevatorPaths.push({ x, y });
    };
    const addElevatorPlatform = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const key = `${x},${y}`;
      if (elevatorSet.has(key)) return;
      elevatorSet.add(key);
      elevators.push({ x, y });
    };
    const getRoomWallTile = (room) => room.wallTile || '#';

    const carveRectRoom = (room) => {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          const wall = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
          setTile(x, y, wall ? getRoomWallTile(room) : '.');
        }
      }
    };

    const carveCircularRoom = (room) => {
      const centerX = room.x + room.w / 2;
      const centerY = room.y + room.h / 2;
      const radiusX = Math.max(room.w / 2, 1);
      const radiusY = Math.max(room.h / 2, 1);
      const isInside = (x, y) => {
        const dx = (x + 0.5 - centerX) / radiusX;
        const dy = (y + 0.5 - centerY) / radiusY;
        return dx * dx + dy * dy <= 1;
      };
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          if (!isInside(x, y)) continue;
          const wall = !isInside(x + 1, y)
            || !isInside(x - 1, y)
            || !isInside(x, y + 1)
            || !isInside(x, y - 1);
          setTile(x, y, wall ? getRoomWallTile(room) : '.');
        }
      }
    };

    const carveCaveRoom = (room) => {
      const widthSpan = room.w;
      const heightSpan = room.h;
      const maxSideInset = Math.min(2, Math.max(0, Math.floor(widthSpan / 2) - 1));
      const maxBottomInset = Math.min(2, Math.max(0, Math.floor(heightSpan / 2) - 1));
      const leftInsetByRow = [];
      const rightInsetByRow = [];
      const bottomInsetByColumn = [];

      for (let y = 0; y < heightSpan; y += 1) {
        let leftInset = Math.floor(Math.random() * (maxSideInset + 1));
        let rightInset = Math.floor(Math.random() * (maxSideInset + 1));
        if (leftInset + rightInset >= widthSpan - 1) {
          rightInset = Math.max(0, widthSpan - 2 - leftInset);
        }
        leftInsetByRow[y] = leftInset;
        rightInsetByRow[y] = rightInset;
      }

      for (let x = 0; x < widthSpan; x += 1) {
        bottomInsetByColumn[x] = Math.floor(Math.random() * (maxBottomInset + 1));
      }

      for (let y = 0; y < heightSpan; y += 1) {
        const leftEdge = room.x + leftInsetByRow[y];
        const rightEdge = room.x + widthSpan - 1 - rightInsetByRow[y];
        for (let x = room.x; x < room.x + widthSpan; x += 1) {
          const columnIndex = x - room.x;
          const bottomEdge = room.y + heightSpan - 1 - bottomInsetByColumn[columnIndex];
          if (x < leftEdge || x > rightEdge || y + room.y > bottomEdge) continue;
          const wall = x === leftEdge || x === rightEdge || y + room.y === room.y || y + room.y === bottomEdge;
          setTile(x, y + room.y, wall ? getRoomWallTile(room) : '.');
        }
      }
    };

    const carveTriangleRoom = (room, orientation) => {
      const widthSpan = Math.max(room.w - 1, 1);
      const heightSpan = Math.max(room.h - 1, 1);
      const signX = orientation.x;
      const signY = orientation.y;
      const origin = {
        x: signX > 0 ? room.x : room.x + room.w - 1,
        y: signY > 0 ? room.y : room.y + room.h - 1
      };
      const isInside = (x, y) => {
        const relX = signX * (x - origin.x);
        const relY = signY * (y - origin.y);
        return relX >= 0 && relY >= 0 && (relX / widthSpan + relY / heightSpan <= 1);
      };
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          if (!isInside(x, y)) continue;
          const wall = !isInside(x + 1, y)
            || !isInside(x - 1, y)
            || !isInside(x, y + 1)
            || !isInside(x, y - 1);
          setTile(x, y, wall ? getRoomWallTile(room) : '.');
        }
      }
    };

    const roomsOverlap = (room) => rooms.some((other) => (
      room.x < other.x + other.w
      && room.x + room.w > other.x
      && room.y < other.y + other.h
      && room.y + room.h > other.y
    ));

    const placeRoom = (room) => {
      if (room.x < 1 || room.y < 1 || room.x + room.w >= width - 1 || room.y + room.h >= height - 1) {
        return false;
      }
      if (roomsOverlap(room)) return false;
      room.area = room.w * room.h;
      rooms.push(room);
      return true;
    };

    const findFloorInRoom = (room, attempts = 40) => {
      for (let i = 0; i < attempts; i += 1) {
        const x = randInt(room.x + 1, room.x + room.w - 2);
        const y = randInt(room.y + 1, room.y + room.h - 2);
        if (tiles[y]?.[x] === '.') return { x, y };
      }
      return null;
    };

    const carveCorridor = (start, end) => {
      const widen = (x, y) => {
        setTile(x, y, '.');
        setTile(x + 1, y, '.');
      };
      const carveLine = (x1, y1, x2, y2) => {
        const dx = Math.sign(x2 - x1);
        const dy = Math.sign(y2 - y1);
        let x = x1;
        let y = y1;
        widen(x, y);
        while (x !== x2 || y !== y2) {
          if (x !== x2) x += dx;
          if (y !== y2) y += dy;
          widen(x, y);
        }
      };
      if (Math.random() < 0.5) {
        carveLine(start.x, start.y, end.x, start.y);
        carveLine(end.x, start.y, end.x, end.y);
      } else {
        carveLine(start.x, start.y, start.x, end.y);
        carveLine(start.x, end.y, end.x, end.y);
      }
    };

    const addPillars = (room) => {
      if (room.w < 16 || room.h < 16) return;
      const pillars = randInt(1, 3);
      for (let i = 0; i < pillars; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        setTile(spot.x, spot.y, getRoomWallTile(room));
      }
    };

    const addPlatform = (room) => {
      if (room.w < 14 || room.h < 10) return;
      const platformY = randInt(room.y + 2, room.y + room.h - 3);
      const platformStart = randInt(room.x + 2, room.x + Math.floor(room.w / 2));
      const platformEnd = randInt(platformStart + 3, room.x + room.w - 3);
      for (let x = platformStart; x <= platformEnd; x += 1) {
        if (tiles[platformY]?.[x] === '.') setTile(x, platformY, '=');
      }
    };

    const addPlatformRun = (room) => {
      if (room.h < 24 || room.w < 18) return;
      const runCount = clamp(Math.floor(room.h / 18), 2, 4);
      for (let i = 0; i < runCount; i += 1) {
        const platformY = randInt(room.y + 2, room.y + room.h - 3);
        const minSpan = Math.max(8, Math.floor(room.w * 0.45));
        const platformStart = randInt(room.x + 2, room.x + room.w - minSpan - 2);
        const platformEnd = randInt(platformStart + minSpan, room.x + room.w - 2);
        for (let x = platformStart; x <= platformEnd; x += 1) {
          if (tiles[platformY]?.[x] === '.') setTile(x, platformY, '=');
        }
      }
    };

    const addStaircase = (room) => {
      if (room.h < 24 || room.w < 12) return;
      const maxSteps = Math.min(room.h - 4, room.w - 4, 18);
      const startLeft = Math.random() < 0.5;
      const stepX = startLeft ? 1 : -1;
      const startX = startLeft ? room.x + 2 : room.x + room.w - 3;
      const startY = room.y + room.h - 3;
      for (let i = 0; i < maxSteps; i += 1) {
        const x = startX + stepX * i;
        const y = startY - i;
        if (tiles[y]?.[x] === '.') setTile(x, y, '=');
      }
    };

    const buildCenteredPattern = (widths) => {
      const height = widths.length;
      const width = Math.max(...widths);
      const coords = [];
      widths.forEach((rowWidth, rowIndex) => {
        const left = Math.floor((width - rowWidth) / 2);
        for (let x = 0; x < rowWidth; x += 1) {
          coords.push({ dx: left + x, dy: rowIndex });
        }
      });
      return { coords, width, height };
    };

    const prefabPatterns = {
      stalactite: buildCenteredPattern([7, 7, 5, 5, 3, 3, 1]),
      stalagmite: buildCenteredPattern([1, 3, 3, 5, 5, 7, 7]),
      sandMound: {
        width: 7,
        height: 4,
        coords: [
          { dx: 0, dy: 0 },
          { dx: 6, dy: 0 },
          { dx: 1, dy: 1 },
          { dx: 5, dy: 1 },
          { dx: 2, dy: 2 },
          { dx: 4, dy: 2 },
          { dx: 3, dy: 3 }
        ]
      },
      sandDune: buildCenteredPattern([3, 5, 7, 5, 3]),
      largeT: {
        width: 7,
        height: 6,
        coords: [
          ...Array.from({ length: 7 }, (_, x) => ({ dx: x, dy: 0 })),
          ...Array.from({ length: 5 }, (_, y) => ({ dx: 2, dy: y + 1 })),
          ...Array.from({ length: 5 }, (_, y) => ({ dx: 3, dy: y + 1 })),
          ...Array.from({ length: 5 }, (_, y) => ({ dx: 4, dy: y + 1 }))
        ]
      },
      cavePlatform: {
        width: 6,
        height: 4,
        coords: [
          ...Array.from({ length: 4 }, (_, x) => ({ dx: x + 1, dy: 0 })),
          ...Array.from({ length: 6 }, (_, x) => ({ dx: x, dy: 1 })),
          ...Array.from({ length: 6 }, (_, x) => ({ dx: x, dy: 2 })),
          ...Array.from({ length: 4 }, (_, x) => ({ dx: x + 1, dy: 3 }))
        ]
      },
      industrialPlatform: {
        width: 6,
        height: 1,
        coords: Array.from({ length: 6 }, (_, x) => ({ dx: x, dy: 0 }))
      },
      sandPlatform: {
        width: 7,
        height: 1,
        coords: Array.from({ length: 7 }, (_, x) => ({ dx: x, dy: 0 }))
      },
      crystalShard: buildCenteredPattern([1, 3, 5, 3, 1]),
      crystalSpire: buildCenteredPattern([1, 3, 5, 5, 3, 1])
    };

    const placePatternInRoom = (room, pattern, options = {}) => {
      const { width, height, coords } = pattern;
      if (room.w < width + 2 || room.h < height + 2) return false;
      const attempts = options.attempts ?? 30;
      const tileChar = options.tileChar || getRoomWallTile(room);
      const minX = room.x + 1;
      const maxX = room.x + room.w - width - 1;
      const minY = room.y + 1;
      const maxY = room.y + room.h - height - 1;
      if (maxX < minX || maxY < minY) return false;
      for (let i = 0; i < attempts; i += 1) {
        const originX = randInt(minX, maxX);
        let originY = randInt(minY, maxY);
        if (options.anchor === 'ceiling') {
          originY = room.y + 1;
        } else if (options.anchor === 'floor') {
          originY = room.y + room.h - height - 1;
        }
        const canPlace = coords.every(({ dx, dy }) => tiles[originY + dy]?.[originX + dx] === '.');
        if (!canPlace) continue;
        coords.forEach(({ dx, dy }) => setTile(originX + dx, originY + dy, tileChar));
        return true;
      }
      return false;
    };

    const addIcePatch = (room) => {
      if (room.w < 8) return;
      const spot = findFloorInRoom(room);
      if (!spot) return;
      const length = randInt(3, Math.min(8, room.w - 4));
      const startX = clamp(spot.x - Math.floor(length / 2), room.x + 1, room.x + room.w - length - 1);
      for (let x = startX; x < startX + length; x += 1) {
        if (tiles[spot.y]?.[x] === '.') setTile(x, spot.y, 'I');
      }
    };

    const addSandPlatform = (room) => {
      placePatternInRoom(room, prefabPatterns.sandPlatform, { tileChar: 's' });
    };

    const addSandMound = (room) => {
      placePatternInRoom(room, prefabPatterns.sandMound, { tileChar: 'E' });
    };

    const addSandDune = (room) => {
      placePatternInRoom(room, prefabPatterns.sandDune, { tileChar: 'E' });
    };

    const addSandStalactite = (room) => {
      placePatternInRoom(room, prefabPatterns.stalactite, { anchor: 'ceiling', tileChar: 'E' });
    };

    const addSandStalagmite = (room) => {
      placePatternInRoom(room, prefabPatterns.stalagmite, { anchor: 'floor', tileChar: 'E' });
    };

    const addCrystalCluster = (room) => {
      const crystalTiles = ['J', 'G', 'V'];
      const pattern = pickOne([prefabPatterns.crystalShard, prefabPatterns.crystalSpire]);
      placePatternInRoom(room, pattern, { tileChar: pickOne(crystalTiles) });
    };

    const addStalactite = (room) => {
      placePatternInRoom(room, prefabPatterns.stalactite, { anchor: 'ceiling' });
    };

    const addStalagmite = (room) => {
      placePatternInRoom(room, prefabPatterns.stalagmite, { anchor: 'floor' });
    };

    const addCavePlatform = (room) => {
      placePatternInRoom(room, prefabPatterns.cavePlatform);
    };

    const addIndustrialPlatform = (room) => {
      placePatternInRoom(room, prefabPatterns.industrialPlatform);
    };

    const addIndustrialT = (room) => {
      placePatternInRoom(room, prefabPatterns.largeT, { anchor: 'floor' });
    };

    const addSwitchTile = (room) => {
      const spot = findFloorInRoom(room);
      if (!spot) return;
      setTile(spot.x, spot.y, 'T');
    };

    const addConveyor = (room, options = {}) => {
      if (room.w < 10) return;
      const spot = findFloorInRoom(room);
      if (!spot) return;
      const length = randInt(4, Math.min(10, room.w - 4));
      const anchorX = options.anchorX ?? spot.x;
      const startX = clamp(anchorX - Math.floor(length / 2), room.x + 1, room.x + room.w - length - 1);
      const dir = Math.random() < 0.5 ? '<' : '>';
      for (let x = startX; x < startX + length; x += 1) {
        if (tiles[spot.y]?.[x] === '.') setTile(x, spot.y, dir);
      }
      const spikeChance = 0.65;
      if (Math.random() < spikeChance) {
        const endX = dir === '<' ? startX : startX + length - 1;
        const spikeX = dir === '<' ? endX - 1 : endX + 1;
        if (spikeX >= room.x + 1 && spikeX <= room.x + room.w - 2) {
          if (tiles[spot.y]?.[spikeX] === '.') setTile(spikeX, spot.y, '*');
        }
      }
      return { x: startX, y: spot.y, length, dir };
    };

    const addPit = (room, hazard) => {
      const pitWidth = 6;
      const pitHeight = 2;
      if (room.w < pitWidth + 2 || room.h < pitHeight + 2) return;
      const wallTile = getRoomWallTile(room);
      const startX = randInt(room.x + 1, room.x + room.w - pitWidth - 1);
      const startY = randInt(room.y + 1, room.y + room.h - pitHeight - 1);
      for (let y = 0; y < pitHeight; y += 1) {
        for (let x = 0; x < pitWidth; x += 1) {
          const tileX = startX + x;
          const tileY = startY + y;
          const isBottom = y === pitHeight - 1;
          const isWall = x === 0 || x === pitWidth - 1;
          const char = isBottom || isWall ? wallTile : hazard;
          setTile(tileX, tileY, char);
        }
      }
    };

    const addHazardFloor = (room, hazard, reservedTiles = new Set()) => {
      const minSize = 8;
      if (room.w < minSize || room.h < minSize) return;
      const floorY = room.y + room.h - 2;
      const depth = randInt(1, 2);
      const topY = Math.max(room.y + 1, floorY - depth + 1);
      for (let y = topY; y <= floorY; y += 1) {
        for (let x = room.x + 1; x <= room.x + room.w - 2; x += 1) {
          if (reservedTiles.has(`${x},${y}`)) continue;
          if (tiles[y]?.[x] === '.') setTile(x, y, hazard);
        }
      }
    };

    const addElevator = (room, options = {}) => {
      const shaftHeight = 6;
      if (room.h < shaftHeight + 4) return;
      const anchorX = options.anchorX ?? randInt(room.x + 2, room.x + room.w - 3);
      const shaftX = clamp(anchorX, room.x + 2, room.x + room.w - 3);
      const shaftY = randInt(room.y + 2, room.y + room.h - shaftHeight - 2);
      for (let y = 0; y < shaftHeight; y += 1) {
        const tileY = shaftY + y;
        for (let dx = -1; dx <= 1; dx += 1) {
          const tileX = shaftX + dx;
          if (tileX < room.x + 1 || tileX > room.x + room.w - 2) continue;
          if (tiles[tileY]?.[tileX] !== 'D') setTile(tileX, tileY, '.');
        }
      }
      for (let y = 0; y < shaftHeight; y += 1) {
        const tileY = shaftY + y;
        setTile(shaftX, tileY, '.');
        addElevatorPath(shaftX, tileY);
      }
      const platformY = shaftY + shaftHeight - 1;
      for (let dx = -1; dx <= 1; dx += 1) {
        addElevatorPlatform(shaftX + dx, platformY);
      }
      const spikeChance = 0.7;
      const spikeY = platformY + 1;
      if (Math.random() < spikeChance && spikeY < room.y + room.h - 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const spikeX = shaftX + dx;
          if (tiles[spikeY]?.[spikeX] === '.') setTile(spikeX, spikeY, '*');
        }
      }
      return { x: shaftX, y: platformY };
    };

    const addHorizontalElevator = (room, options = {}) => {
      const shaftLength = 7;
      if (room.w < shaftLength + 4) return;
      const anchorY = options.anchorY ?? randInt(room.y + 2, room.y + room.h - 3);
      const shaftY = clamp(anchorY, room.y + 2, room.y + room.h - 3);
      const shaftX = randInt(room.x + 2, room.x + room.w - shaftLength - 2);
      for (let x = 0; x < shaftLength; x += 1) {
        const tileX = shaftX + x;
        for (let dy = -1; dy <= 1; dy += 1) {
          const tileY = shaftY + dy;
          if (tileY < room.y + 1 || tileY > room.y + room.h - 2) continue;
          if (tiles[tileY]?.[tileX] !== 'D') setTile(tileX, tileY, '.');
        }
      }
      for (let x = 0; x < shaftLength; x += 1) {
        const tileX = shaftX + x;
        setTile(tileX, shaftY, '.');
        addElevatorPath(tileX, shaftY);
      }
      const platformX = shaftX;
      for (let dx = -1; dx <= 1; dx += 1) {
        addElevatorPlatform(platformX + dx, shaftY);
      }
      const spikeChance = 0.55;
      if (Math.random() < spikeChance) {
        const spikeX = shaftX - 1;
        if (spikeX >= room.x + 1 && tiles[shaftY]?.[spikeX] === '.') {
          setTile(spikeX, shaftY, '*');
        }
      }
      return { x: platformX, y: shaftY };
    };

    const addTriangleBlocks = (room) => {
      const count = randInt(1, 3);
      const wallTile = getRoomWallTile(room);
      const triangleSizes = [
        { w: 1, h: 1 },
        { w: 2, h: 1 },
        { w: 1, h: 2 }
      ];
      for (let i = 0; i < count; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        const size = pickOne(triangleSizes);
        const orientation = pickOne([
          { x: 1, y: 1 },
          { x: -1, y: 1 },
          { x: 1, y: -1 },
          { x: -1, y: -1 }
        ]);
        const origin = {
          x: orientation.x > 0 ? spot.x : spot.x + size.w - 1,
          y: orientation.y > 0 ? spot.y : spot.y + size.h - 1
        };
        const widthSpan = Math.max(size.w - 1, 1);
        const heightSpan = Math.max(size.h - 1, 1);
        for (let y = 0; y < size.h; y += 1) {
          for (let x = 0; x < size.w; x += 1) {
            const tileX = origin.x + orientation.x * x;
            const tileY = origin.y + orientation.y * y;
            const relX = orientation.x * (tileX - origin.x);
            const relY = orientation.y * (tileY - origin.y);
            if (relX / widthSpan + relY / heightSpan <= 1) {
              if (tiles[tileY]?.[tileX] === '.') setTile(tileX, tileY, wallTile);
            }
          }
        }
      }
    };

    const biomeTypes = ['cave', 'industrial', 'ice', 'desert', 'crystal'];
    const biomeSeeds = [];
    const usedSeedKeys = new Set();
    while (biomeSeeds.length < biomeTypes.length) {
      const seedCol = randInt(0, cols - 1);
      const seedRow = randInt(0, rows - 1);
      const key = `${seedCol},${seedRow}`;
      if (usedSeedKeys.has(key)) continue;
      usedSeedKeys.add(key);
      biomeSeeds.push({ col: seedCol, row: seedRow, type: biomeTypes[biomeSeeds.length] });
    }
    const biomeMap = Array.from({ length: rows }, () => Array.from({ length: cols }, () => biomeTypes[0]));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        let bestSeed = biomeSeeds[0];
        let bestDistance = Infinity;
        biomeSeeds.forEach((seed) => {
          const distance = Math.abs(seed.col - col) + Math.abs(seed.row - row);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestSeed = seed;
          }
        });
        biomeMap[row][col] = bestSeed.type;
      }
    }

    const addCorridorDetails = (room) => {
      if (room.w < 6 || room.h < 6) return;
      if (Math.random() < 0.6) addPlatform(room);
      if (Math.random() < 0.4) addTriangleBlocks(room);
      if (room.biome === 'cave') {
        if (Math.random() < 0.4) addStalactite(room);
        if (Math.random() < 0.4) addStalagmite(room);
        if (Math.random() < 0.4) addCavePlatform(room);
      } else if (room.biome === 'industrial') {
        if (Math.random() < 0.45) addIndustrialPlatform(room);
        if (Math.random() < 0.25) addIndustrialT(room);
        if (Math.random() < 0.3) addConveyor(room);
      } else if (room.biome === 'ice') {
        if (Math.random() < 0.45) addIcePatch(room);
      } else if (room.biome === 'desert') {
        if (Math.random() < 0.45) addSandPlatform(room);
        if (Math.random() < 0.35) addSandDune(room);
      } else if (room.biome === 'crystal') {
        if (Math.random() < 0.5) addCrystalCluster(room);
      }
    };

    const pickSpanStart = (minValue, maxValue, span, positions) => {
      const maxStart = maxValue - (span - 1);
      const minStart = minValue;
      if (maxStart < minStart) return minStart;
      const choices = positions
        .map((position) => clamp(position, minStart, maxStart))
        .filter((value, index, list) => list.indexOf(value) === index);
      return pickOne(choices.length ? choices : [minStart]);
    };

    const carveConnection = (from, to) => {
      const horizontal = from.y === to.y;
      const wideJoin = Math.random() < 0.3;
      const isCorridor = wideJoin;
      const span = isCorridor
        ? (horizontal ? Math.min(from.h - 2, to.h - 2) : Math.min(from.w - 2, to.w - 2))
        : 2;
      const doorwayTile = isCorridor ? '.' : 'D';

      if (horizontal) {
        const doorX = to.x > from.x ? from.x + from.w - 1 : from.x;
        const otherDoorX = to.x > from.x ? to.x : to.x + to.w - 1;
        const minY = Math.max(from.y + 1, to.y + 1);
        const maxY = Math.min(from.y + from.h - 2, to.y + to.h - 2);
        const maxSpan = Math.max(1, maxY - minY + 1);
        const corridorSpan = Math.min(span, maxSpan);
        const minStart = minY;
        const maxStart = maxY - (corridorSpan - 1);
        const midStart = Math.floor((minStart + maxStart) / 2);
        const startY = pickSpanStart(minY, maxY, corridorSpan, [minStart, midStart, maxStart]);
        for (let i = 0; i < corridorSpan; i += 1) {
          setTile(doorX, startY + i, doorwayTile);
          setTile(otherDoorX, startY + i, doorwayTile);
        }
        const startX = Math.min(doorX, otherDoorX) + 1;
        const endX = Math.max(doorX, otherDoorX) - 1;
        for (let i = 0; i < corridorSpan; i += 1) {
          for (let x = startX; x <= endX; x += 1) {
            setTile(x, startY + i, doorwayTile);
          }
        }
        if (isCorridor) {
          addCorridorDetails({
            x: startX,
            y: startY,
            w: endX - startX + 1,
            h: corridorSpan,
            biome: from.biome,
            wallTile: from.wallTile
          });
        }
        return;
      }

      const doorY = to.y > from.y ? from.y + from.h - 1 : from.y;
      const otherDoorY = to.y > from.y ? to.y : to.y + to.h - 1;
      const minX = Math.max(from.x + 1, to.x + 1);
      const maxX = Math.min(from.x + from.w - 2, to.x + to.w - 2);
      const maxSpan = Math.max(1, maxX - minX + 1);
      const corridorSpan = Math.min(span, maxSpan);
      const minStart = minX;
      const maxStart = maxX - (corridorSpan - 1);
      const midStart = Math.floor((minStart + maxStart) / 2);
      const startX = pickSpanStart(minX, maxX, corridorSpan, [minStart, midStart, maxStart]);
      for (let i = 0; i < corridorSpan; i += 1) {
        setTile(startX + i, doorY, doorwayTile);
        setTile(startX + i, otherDoorY, doorwayTile);
      }
      const startY = Math.min(doorY, otherDoorY) + 1;
      const endY = Math.max(doorY, otherDoorY) - 1;
      for (let i = 0; i < corridorSpan; i += 1) {
        for (let y = startY; y <= endY; y += 1) {
          setTile(startX + i, y, doorwayTile);
        }
      }
      if (isCorridor) {
        addCorridorDetails({
          x: startX,
          y: startY,
          w: corridorSpan,
          h: endY - startY + 1,
          biome: from.biome,
          wallTile: from.wallTile
        });
      }
    };

    const addRoomDetails = (room) => {
      addPillars(room);
      if (Math.random() < 0.65) addPlatform(room);
      if (room.h >= 28) {
        addPlatformRun(room);
        addStaircase(room);
      }
      addTriangleBlocks(room);
      if (room.biome === 'cave') {
        if (Math.random() < 0.5) addStalactite(room);
        if (Math.random() < 0.5) addStalagmite(room);
        if (Math.random() < 0.45) addCavePlatform(room);
        if (Math.random() < 0.6) addPit(room, pickOne(['~', 'L']));
      } else if (room.biome === 'industrial') {
        if (Math.random() < 0.5) addIndustrialPlatform(room);
        if (Math.random() < 0.4) addIndustrialT(room);
        if (Math.random() < 0.35) addSwitchTile(room);
        let elevatorSpot = null;
        let conveyorSpot = null;
        if (Math.random() < 0.45) {
          elevatorSpot = addElevator(room);
        } else if (Math.random() < 0.25) {
          elevatorSpot = addHorizontalElevator(room);
        }
        if (Math.random() < 0.55) {
          conveyorSpot = addConveyor(room, {
            anchorX: elevatorSpot?.x
          });
        }
        if (!elevatorSpot && conveyorSpot && Math.random() < 0.5) {
          addElevator(room, { anchorX: conveyorSpot.x });
        }
        if (Math.random() < 0.45) addPit(room, '*');
      } else if (room.biome === 'ice') {
        if (Math.random() < 0.6) addIcePatch(room);
        if (Math.random() < 0.4) addPit(room, '~');
        if (Math.random() < 0.35) addPit(room, '*');
      } else if (room.biome === 'desert') {
        if (Math.random() < 0.55) addSandPlatform(room);
        if (Math.random() < 0.5) addSandMound(room);
        if (Math.random() < 0.45) addSandDune(room);
        if (Math.random() < 0.5) addSandStalactite(room);
        if (Math.random() < 0.5) addSandStalagmite(room);
        if (Math.random() < 0.35) addPit(room, '~');
      } else if (room.biome === 'crystal') {
        if (Math.random() < 0.65) addCrystalCluster(room);
        if (Math.random() < 0.5) addCrystalCluster(room);
        if (Math.random() < 0.35) addHazardFloor(room, '!');
      }
    };

    const cellIndex = (col, row) => row * cols + col;
    const cellFromIndex = (index) => ({ col: index % cols, row: Math.floor(index / cols) });
    const cellCenterDistance = (col, row) => {
      const centerX = 1 + col * blockWidth + Math.floor(blockWidth / 2);
      const centerY = 1 + row * blockHeight + Math.floor(blockHeight / 2);
      return Math.hypot(centerX - spawn.x, centerY - spawn.y);
    };
    const targetRooms = clamp(Math.floor(maxRooms * 0.7), 3, maxRooms);
    const occupied = new Set();
    const adjacency = new Map();
    const startCellIndex = (() => {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const dist = cellCenterDistance(col, row);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = cellIndex(col, row);
          }
        }
      }
      return bestIndex;
    })();
    occupied.add(startCellIndex);
    adjacency.set(startCellIndex, new Set());
    while (occupied.size < targetRooms) {
      const frontier = Array.from(occupied).filter((index) => {
        const { col, row } = cellFromIndex(index);
        return (
          (col > 0 && !occupied.has(cellIndex(col - 1, row)))
          || (col < cols - 1 && !occupied.has(cellIndex(col + 1, row)))
          || (row > 0 && !occupied.has(cellIndex(col, row - 1)))
          || (row < rows - 1 && !occupied.has(cellIndex(col, row + 1)))
        );
      });
      if (frontier.length === 0) break;
      const fromIndex = pickOne(frontier);
      const { col, row } = cellFromIndex(fromIndex);
      const neighbors = [];
      if (col > 0 && !occupied.has(cellIndex(col - 1, row))) neighbors.push(cellIndex(col - 1, row));
      if (col < cols - 1 && !occupied.has(cellIndex(col + 1, row))) neighbors.push(cellIndex(col + 1, row));
      if (row > 0 && !occupied.has(cellIndex(col, row - 1))) neighbors.push(cellIndex(col, row - 1));
      if (row < rows - 1 && !occupied.has(cellIndex(col, row + 1))) neighbors.push(cellIndex(col, row + 1));
      if (neighbors.length === 0) break;
      const nextIndex = pickOne(neighbors);
      occupied.add(nextIndex);
      if (!adjacency.has(fromIndex)) adjacency.set(fromIndex, new Set());
      if (!adjacency.has(nextIndex)) adjacency.set(nextIndex, new Set());
      adjacency.get(fromIndex).add(nextIndex);
      adjacency.get(nextIndex).add(fromIndex);
    }

    const biomeRoomTypes = {
      cave: ['cave', 'circular'],
      industrial: ['room'],
      ice: ['room', 'circular'],
      desert: ['room', 'circular'],
      crystal: ['room', 'circular']
    };
    const biomeWallTiles = {
      cave: 'R',
      ice: 'F',
      industrial: '#',
      desert: 'E',
      crystal: 'Q'
    };

    occupied.forEach((index) => {
      const { col, row } = cellFromIndex(index);
      const biome = biomeMap[row]?.[col] || 'industrial';
      const roomType = pickOne(biomeRoomTypes[biome] || ['room']);
      const roomX = 1 + col * blockWidth + roomPadding;
      const roomY = 1 + row * blockHeight + roomPadding;
      const roomW = Math.max(6, blockWidth - roomPadding * 2);
      const roomH = Math.max(6, blockHeight - roomPadding * 2);
      const room = {
        x: roomX,
        y: roomY,
        w: roomW,
        h: roomH,
        type: roomType,
        biome,
        wallTile: biomeWallTiles[biome] || '#',
        cellIndex: index
      };
      placeRoom(room);
      if (roomType === 'cave') {
        carveCaveRoom(room);
      } else if (roomType === 'circular') {
        carveCircularRoom(room);
      } else {
        carveRectRoom(room);
      }
      addRoomDetails(room);
    });

    rooms.forEach((room) => {
      room.center = {
        x: Math.floor(room.x + room.w / 2),
        y: Math.floor(room.y + room.h / 2)
      };
      room.area = room.w * room.h;
    });

    const linkedPairs = new Set();
    const pairKey = (a, b) => {
      const left = Math.min(a, b);
      const right = Math.max(a, b);
      return `${left}:${right}`;
    };
    const roomByCell = new Map(rooms.map((room) => [room.cellIndex, room]));
    const addConnection = (aIndex, bIndex) => {
      const key = pairKey(aIndex, bIndex);
      if (linkedPairs.has(key)) return;
      linkedPairs.add(key);
      const fromRoom = roomByCell.get(aIndex);
      const toRoom = roomByCell.get(bIndex);
      if (!fromRoom || !toRoom) return;
      carveConnection(fromRoom, toRoom);
    };
    adjacency.forEach((neighbors, index) => {
      neighbors.forEach((neighbor) => addConnection(index, neighbor));
    });

    rooms.forEach((room) => {
      const { col, row } = cellFromIndex(room.cellIndex);
      const extraNeighbors = [];
      if (col > 0) extraNeighbors.push(cellIndex(col - 1, row));
      if (col < cols - 1) extraNeighbors.push(cellIndex(col + 1, row));
      if (row > 0) extraNeighbors.push(cellIndex(col, row - 1));
      if (row < rows - 1) extraNeighbors.push(cellIndex(col, row + 1));
      extraNeighbors.forEach((neighbor) => {
        if (!occupied.has(neighbor)) return;
        if (Math.random() < 0.25) addConnection(room.cellIndex, neighbor);
      });
    });

    const findRoomDoorTiles = (room) => {
      const doors = [];
      const topY = room.y;
      const bottomY = room.y + room.h - 1;
      const leftX = room.x;
      const rightX = room.x + room.w - 1;
      for (let x = leftX; x <= rightX; x += 1) {
        if (tiles[topY]?.[x] === 'D') doors.push({ x, y: topY, side: 'top' });
        if (tiles[bottomY]?.[x] === 'D') doors.push({ x, y: bottomY, side: 'bottom' });
      }
      for (let y = topY; y <= bottomY; y += 1) {
        if (tiles[y]?.[leftX] === 'D') doors.push({ x: leftX, y, side: 'left' });
        if (tiles[y]?.[rightX] === 'D') doors.push({ x: rightX, y, side: 'right' });
      }
      return doors;
    };

    const clearDoorFronts = () => {
      const clearDepth = 2;
      const extraSolidDepth = 3;
      const clearSpan = 0;
      const isSolidBlock = (room, tile) => tile === getRoomWallTile(room);
      rooms.forEach((room) => {
        const doors = findRoomDoorTiles(room);
        doors.forEach((door) => {
          if (door.side === 'top' || door.side === 'bottom') {
            const dir = door.side === 'top' ? 1 : -1;
            for (let dy = 1; dy <= clearDepth; dy += 1) {
              for (let dx = -clearSpan; dx <= clearSpan; dx += 1) {
                const nx = door.x + dx;
                const ny = door.y + dir * dy;
                if (nx < room.x + 1 || nx > room.x + room.w - 2) continue;
                if (ny < room.y + 1 || ny > room.y + room.h - 2) continue;
                if (tiles[ny]?.[nx] !== 'D') setTile(nx, ny, '.');
              }
            }
            if (door.side === 'top') {
              for (let dy = clearDepth + 1; dy <= extraSolidDepth; dy += 1) {
                for (let dx = -clearSpan; dx <= clearSpan; dx += 1) {
                  const nx = door.x + dx;
                  const ny = door.y + dir * dy;
                  if (nx < room.x + 1 || nx > room.x + room.w - 2) continue;
                  if (ny < room.y + 1 || ny > room.y + room.h - 2) continue;
                  if (tiles[ny]?.[nx] !== 'D' && isSolidBlock(room, tiles[ny]?.[nx])) {
                    setTile(nx, ny, '.');
                  }
                }
              }
            }
          } else {
            const dir = door.side === 'left' ? 1 : -1;
            for (let dx = 1; dx <= clearDepth; dx += 1) {
              for (let dy = -clearSpan; dy <= clearSpan; dy += 1) {
                const nx = door.x + dir * dx;
                const ny = door.y + dy;
                if (nx < room.x + 1 || nx > room.x + room.w - 2) continue;
                if (ny < room.y + 1 || ny > room.y + room.h - 2) continue;
                if (tiles[ny]?.[nx] !== 'D') setTile(nx, ny, '.');
              }
            }
          }
        });
      });
    };

    const addUpperDoorSupports = () => {
      const supportChance = 0.9;
      rooms.forEach((room) => {
        const topY = room.y;
        const supportY = room.y + 3;
        if (supportY >= room.y + room.h - 1) return;
        let segmentStart = null;
        for (let x = room.x; x <= room.x + room.w - 1; x += 1) {
          const isDoor = tiles[topY]?.[x] === 'D';
          if (isDoor && segmentStart === null) {
            segmentStart = x;
          }
          if ((!isDoor || x === room.x + room.w - 1) && segmentStart !== null) {
            const segmentEnd = isDoor ? x : x - 1;
            if (Math.random() < supportChance) {
              const supportChar = Math.random() < 0.55 ? '=' : getRoomWallTile(room);
              for (let sx = segmentStart; sx <= segmentEnd; sx += 1) {
                if (tiles[supportY]?.[sx] === '.') {
                  setTile(sx, supportY, supportChar);
                }
              }
            }
            segmentStart = null;
          }
        }
      });
    };

    const addLowerDoorPlatforms = () => {
      rooms.forEach((room) => {
        const bottomY = room.y + room.h - 1;
        const platformY = bottomY - 2;
        if (platformY <= room.y) return;
        let segmentStart = null;
        for (let x = room.x; x <= room.x + room.w - 1; x += 1) {
          const isDoor = tiles[bottomY]?.[x] === 'D';
          if (isDoor && segmentStart === null) {
            segmentStart = x;
          }
          if ((!isDoor || x === room.x + room.w - 1) && segmentStart !== null) {
            const segmentEnd = isDoor ? x : x - 1;
            for (let sx = segmentStart; sx <= segmentEnd; sx += 1) {
              if (tiles[platformY]?.[sx] === '.') {
                setTile(sx, platformY, '=');
              }
            }
            segmentStart = null;
          }
        }
      });
    };

    clearDoorFronts();
    addUpperDoorSupports();
    addLowerDoorPlatforms();

    const clearElevatorsInRoom = (room) => {
      for (let i = elevatorPaths.length - 1; i >= 0; i -= 1) {
        const path = elevatorPaths[i];
        if (path.x >= room.x && path.x <= room.x + room.w - 1 && path.y >= room.y && path.y <= room.y + room.h - 1) {
          elevatorPathSet.delete(`${path.x},${path.y}`);
          elevatorPaths.splice(i, 1);
        }
      }
      for (let i = elevators.length - 1; i >= 0; i -= 1) {
        const platform = elevators[i];
        if (
          platform.x >= room.x
          && platform.x <= room.x + room.w - 1
          && platform.y >= room.y
          && platform.y <= room.y + room.h - 1
        ) {
          elevatorSet.delete(`${platform.x},${platform.y}`);
          elevators.splice(i, 1);
        }
      }
    };

    const carveSimpleRoom = (room, wallTile) => {
      const doorTiles = new Set(findRoomDoorTiles(room).map((door) => `${door.x},${door.y}`));
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) {
          const key = `${x},${y}`;
          if (doorTiles.has(key)) {
            setTile(x, y, 'D');
            continue;
          }
          const wall = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
          setTile(x, y, wall ? wallTile : '.');
        }
      }
    };

    const placeUpsideTPrefab = (centerX, centerY, tileChar) => {
      const originX = centerX - 3;
      const originY = centerY - 3;
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          if (y <= 2) {
            if (x >= 2 && x <= 4) {
              setTile(originX + x, originY + y, tileChar);
            }
          } else {
            setTile(originX + x, originY + y, tileChar);
          }
        }
      }
    };

    let spawnRoom = rooms[0];
    let bestDistance = Infinity;
    rooms.forEach((room) => {
      const dist = Math.hypot(room.center.x - spawn.x, room.center.y - spawn.y);
      if (dist < bestDistance) {
        bestDistance = dist;
        spawnRoom = room;
      }
    });
    spawn.x = spawnRoom.center.x;
    spawn.y = spawnRoom.center.y;
    setTile(spawn.x, spawn.y, '.');

    const getDoorLandingPads = (room) => {
      const pads = [];
      const doors = findRoomDoorTiles(room);
      doors.forEach((door) => {
        if (door.side === 'bottom') return;
        let padX = door.x;
        let padY = door.y;
        if (door.side === 'top') {
          padY = door.y + 1;
        } else if (door.side === 'left') {
          padX = door.x + 1;
        } else if (door.side === 'right') {
          padX = door.x - 1;
        } else if (door.side === 'bottom') {
          padY = door.y - 1;
        }
        if (padX < room.x + 1 || padX > room.x + room.w - 2) return;
        if (padY < room.y + 1 || padY > room.y + room.h - 2) return;
        pads.push({ x: padX, y: padY, type: 'clear' });
        const platformY = Math.min(room.y + room.h - 2, padY + 1);
        if (platformY >= room.y + 1 && platformY <= room.y + room.h - 2) {
          pads.push({ x: padX, y: platformY, type: 'platform' });
        }
      });
      return pads;
    };

    const addHazardRooms = () => {
      const hazardTypes = ['L', 'A', '~'];
      const candidates = rooms.filter((room) => {
        if (room === spawnRoom) return false;
        if (room.w < 8 || room.h < 8) return false;
        const doors = findRoomDoorTiles(room);
        return !doors.some((door) => door.side === 'bottom');
      });
      if (candidates.length === 0) return;
      const targetCount = clamp(Math.floor(candidates.length * 0.3), 1, Math.min(4, candidates.length));
      for (let i = 0; i < targetCount; i += 1) {
        const index = randInt(0, candidates.length - 1);
        const room = candidates.splice(index, 1)[0];
        const landingPads = getDoorLandingPads(room);
        const reserved = new Set(landingPads.map((pad) => `${pad.x},${pad.y}`));
        addHazardFloor(room, pickOne(hazardTypes), reserved);
        landingPads.forEach((pad) => {
          if (pad.type === 'platform') {
            if (tiles[pad.y]?.[pad.x] !== 'D') setTile(pad.x, pad.y, '=');
          } else if (tiles[pad.y]?.[pad.x] !== 'D') {
            setTile(pad.x, pad.y, '.');
          }
        });
      }
    };

    addHazardRooms();

    const addSpawnPitPlatform = () => {
      const wallTile = getRoomWallTile(spawnRoom);
      const topY = spawn.y + 1;
      const bottomY = spawn.y + 2;
      const leftX = spawn.x - 2;
      const rightX = spawn.x + 2;
      if (topY >= height || bottomY >= height) return;
      for (let x = leftX; x <= rightX; x += 1) {
        if (x < 0 || x >= width) continue;
        if (tiles[bottomY]?.[x] !== 'D') setTile(x, bottomY, wallTile);
        if (x === leftX || x === rightX) {
          if (tiles[topY]?.[x] !== 'D') setTile(x, topY, wallTile);
        } else if (tiles[topY]?.[x] !== 'D') {
          setTile(x, topY, '=');
        }
      }
    };

    addSpawnPitPlatform();

    const distanceFromSpawn = (() => {
      const distances = new Map();
      const queue = [spawnRoom.cellIndex];
      distances.set(spawnRoom.cellIndex, 0);
      while (queue.length) {
        const current = queue.shift();
        const dist = distances.get(current) ?? 0;
        const neighbors = adjacency.get(current) || [];
        Array.from(neighbors).forEach((neighbor) => {
          if (distances.has(neighbor)) return;
          distances.set(neighbor, dist + 1);
          queue.push(neighbor);
        });
      }
      return distances;
    })();
    const roomDistance = (room) => distanceFromSpawn.get(room.cellIndex) ?? Infinity;
    const reservedRooms = new Set([spawnRoom.cellIndex]);
    const selectedRooms = [];
    const powerupPrefabTile = 'F';

    const isRoomFarEnough = (room, minSteps = 3) => selectedRooms.every((entry) => {
      const a = cellFromIndex(room.cellIndex);
      const b = cellFromIndex(entry.cellIndex);
      return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) >= minSteps;
    });

    const isRoomFarFrom = (room, list, minSteps = 2) => list.every((entry) => {
      const a = cellFromIndex(room.cellIndex);
      const b = cellFromIndex(entry.cellIndex);
      return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) >= minSteps;
    });

    const placePowerupPrefabRoom = (room, options) => {
      const {
        powerupChar,
        wallTile,
        prefabTile = powerupPrefabTile,
        blockChar = null,
        prefabOffsetY = 0
      } = options;
      const centerX = Math.floor(room.x + room.w / 2);
      const centerY = Math.floor(room.y + room.h / 2) + prefabOffsetY;
      const originX = centerX - 3;
      const originY = centerY - 3;
      if (originX < room.x + 1 || originX + 6 > room.x + room.w - 2) return false;
      if (originY < room.y + 1 || originY + 6 > room.y + room.h - 2) return false;
      clearElevatorsInRoom(room);
      carveSimpleRoom(room, wallTile);
      placeUpsideTPrefab(centerX, centerY, prefabTile);
      setTile(centerX, centerY, powerupChar);
      if (blockChar) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const bx = centerX + dx;
            const by = centerY + dy;
            if (bx <= room.x || bx >= room.x + room.w - 1) continue;
            if (by <= room.y || by >= room.y + room.h - 1) continue;
            setTile(bx, by, blockChar);
          }
        }
      }
      return true;
    };

    const placeMapRoom = (room) => placePowerupPrefabRoom(room, {
      powerupChar: 'M',
      wallTile: 'F'
    });

    const powerupSpecs = [
      {
        id: 'chainsaw',
        powerupChar: 'g',
        wallTile: 'F',
        minW: 10,
        minH: 10
      },
      {
        id: 'magboots',
        powerupChar: 'm',
        wallTile: 'F',
        minW: 10,
        minH: 10,
        blockChar: 'Q'
      },
      {
        id: 'flamethrower',
        powerupChar: 'f',
        wallTile: 'F',
        minW: 10,
        minH: 18,
        prefabOffsetY: -4
      },
      {
        id: 'ignitir',
        powerupChar: 'i',
        wallTile: 'N',
        minW: 10,
        minH: 10,
        blockChar: 'N'
      }
    ];

    const sortedRooms = rooms
      .filter((room) => room !== spawnRoom)
      .sort((a, b) => roomDistance(a) - roomDistance(b));

    const maxSpecialRooms = Math.floor(rooms.length / 11);
    const specialOrder = ['chainsaw', 'magboots', 'flamethrower', 'ignitir', 'boss'];
    const specialsToPlace = specialOrder.slice(0, Math.min(maxSpecialRooms, specialOrder.length));
    const powerupsToPlace = powerupSpecs.filter((spec) => specialsToPlace.includes(spec.id));

    powerupsToPlace.forEach((spec, index) => {
      const targetIndex = Math.min(sortedRooms.length - 1, (index + 1) * 10);
      const tryPlace = (room) => {
        if (reservedRooms.has(room.cellIndex)) return false;
        if (room.w < spec.minW || room.h < spec.minH) return false;
        if (!isRoomFarEnough(room, 3)) return false;
        const placed = placePowerupPrefabRoom(room, spec);
        if (!placed) return false;
        reservedRooms.add(room.cellIndex);
        selectedRooms.push(room);
        return true;
      };
      let placed = false;
      for (let i = targetIndex; i < sortedRooms.length; i += 1) {
        if (tryPlace(sortedRooms[i])) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        for (let i = 0; i < targetIndex; i += 1) {
          if (tryPlace(sortedRooms[i])) break;
        }
      }
    });

    if (specialsToPlace.includes('boss')) {
      const selectedBossId = this.enemyType?.id;
      const bossPref = BOSS_ROOM_PREFS[selectedBossId] || BOSS_ROOM_PREFS.finalboss;
      const shape = bossPref.shape ?? 'large';
      const buildRoomGroup = (room) => {
        const { col, row } = cellFromIndex(room.cellIndex);
        if (shape === 'small') {
          return [room];
        }
        if (shape === 'long') {
          if (col + 1 >= cols) return null;
          const indices = [cellIndex(col, row), cellIndex(col + 1, row)];
          if (indices.some((index) => reservedRooms.has(index))) return null;
          const roomGroup = indices.map((index) => roomByCell.get(index)).filter(Boolean);
          if (roomGroup.length !== 2) return null;
          return roomGroup;
        }
        if (shape === 'tall') {
          if (row + 1 >= rows) return null;
          const indices = [cellIndex(col, row), cellIndex(col, row + 1)];
          if (indices.some((index) => reservedRooms.has(index))) return null;
          const roomGroup = indices.map((index) => roomByCell.get(index)).filter(Boolean);
          if (roomGroup.length !== 2) return null;
          return roomGroup;
        }
        if (col + 1 >= cols || row + 1 >= rows) return null;
        const indices = [
          cellIndex(col, row),
          cellIndex(col + 1, row),
          cellIndex(col, row + 1),
          cellIndex(col + 1, row + 1)
        ];
        if (indices.some((index) => reservedRooms.has(index))) return null;
        const roomGroup = indices.map((index) => roomByCell.get(index)).filter(Boolean);
        if (roomGroup.length !== 4) return null;
        return roomGroup;
      };
      let bestBoss = null;
      let bestDistance = -Infinity;
      rooms.forEach((room) => {
        if (reservedRooms.has(room.cellIndex)) return;
        const roomGroup = buildRoomGroup(room);
        if (!roomGroup) return;
        const groupCenter = roomGroup.reduce((acc, entry) => {
          const cell = cellFromIndex(entry.cellIndex);
          acc.col += cell.col;
          acc.row += cell.row;
          return acc;
        }, { col: 0, row: 0 });
        groupCenter.col /= roomGroup.length;
        groupCenter.row /= roomGroup.length;
        const farFromPowerups = selectedRooms.every((selected) => {
          const selectedCell = cellFromIndex(selected.cellIndex);
          return Math.abs(selectedCell.col - groupCenter.col) + Math.abs(selectedCell.row - groupCenter.row) >= 3;
        });
        if (!farFromPowerups) return;
        const avgDistance = roomGroup.reduce((sum, entry) => sum + roomDistance(entry), 0) / roomGroup.length;
        if (avgDistance > bestDistance) {
          bestDistance = avgDistance;
          bestBoss = { rooms: roomGroup };
        }
      });
      if (bestBoss) {
        bestBoss.rooms.forEach((room) => reservedRooms.add(room.cellIndex));
        selectedRooms.push(...bestBoss.rooms);
        const minX = Math.min(...bestBoss.rooms.map((room) => room.x));
        const minY = Math.min(...bestBoss.rooms.map((room) => room.y));
        const maxX = Math.max(...bestBoss.rooms.map((room) => room.x + room.w - 1));
        const maxY = Math.max(...bestBoss.rooms.map((room) => room.y + room.h - 1));
        const bossRoom = {
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          wallTile: '#'
        };
        clearElevatorsInRoom(bossRoom);
        carveSimpleRoom(bossRoom, '#');
        addElevator(bossRoom);
        if (shape !== 'small') {
          addHorizontalElevator(bossRoom);
        }
        if (bossPref.theme === 'industrial') {
          addConveyor(bossRoom);
        }
        const hazards = bossPref.hazards ?? [];
        hazards.forEach((hazard) => addPit(bossRoom, hazard));
        if (bossPref.theme === 'industrial' && !hazards.includes('*')) {
          addPit(bossRoom, '*');
        }
        if (bossPref.theme === 'ice') {
          const iceY = bossRoom.y + bossRoom.h - 2;
          for (let x = bossRoom.x + 2; x < bossRoom.x + bossRoom.w - 2; x += 2) {
            if (tiles[iceY]?.[x] === '.') setTile(x, iceY, 'I');
          }
        }
        if (hazards.includes('*')) {
          const spikeY = bossRoom.y + bossRoom.h - 2;
          for (let x = bossRoom.x + 2; x < bossRoom.x + bossRoom.w - 2; x += 3) {
            if (tiles[spikeY]?.[x] === '.') setTile(x, spikeY, '*');
          }
        }
        const pads = getDoorLandingPads(bossRoom);
        pads.forEach((pad) => {
          if (tiles[pad.y]?.[pad.x] === '.') setTile(pad.x, pad.y, 'P');
        });
      }
    }

    const mapRoomCount = rooms.length >= 40 ? 2 : 1;
    let placedMaps = 0;
    for (let i = sortedRooms.length - 1; i >= 0 && placedMaps < mapRoomCount; i -= 1) {
      const room = sortedRooms[i];
      if (reservedRooms.has(room.cellIndex)) continue;
      if (room.w < 10 || room.h < 10) continue;
      if (!isRoomFarEnough(room, 2)) continue;
      if (placeMapRoom(room)) {
        reservedRooms.add(room.cellIndex);
        selectedRooms.push(room);
        placedMaps += 1;
      }
    }

    const healthTarget = 13;
    const healthBlockTypes = ['N', 'P', 'Q'];
    const healthCandidates = sortedRooms.filter((room) => (
      !reservedRooms.has(room.cellIndex)
      && room.w >= 8
      && room.h >= 8
    ));
    const healthRooms = [];

    const placeHealthSurrounded = (room, blockChar) => {
      const spot = findFloorInRoom(room);
      if (!spot) return false;
      const cx = clamp(spot.x, room.x + 2, room.x + room.w - 3);
      const cy = clamp(spot.y, room.y + 2, room.y + room.h - 3);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (dx === 0 && dy === 0) continue;
          if (tx <= room.x || tx >= room.x + room.w - 1) continue;
          if (ty <= room.y || ty >= room.y + room.h - 1) continue;
          setTile(tx, ty, blockChar);
        }
      }
      setTile(cx, cy, 'H');
      return true;
    };

    const placeHealthHigh = (room) => {
      const x = clamp(Math.floor(room.x + room.w / 2), room.x + 1, room.x + room.w - 2);
      const y = room.y + 2;
      if (tiles[y]?.[x] !== '.') return false;
      setTile(x, y, 'H');
      return true;
    };

    const placeHealthHidden = (room, blockChar) => {
      if (room.w < 10 || room.h < 8) return false;
      const fromLeft = Math.random() < 0.5;
      const dir = fromLeft ? 1 : -1;
      const corridorStartX = fromLeft ? room.x + 2 : room.x + room.w - 3;
      const entryY = randInt(room.y + 3, room.y + room.h - 3);
      const corridorLength = 3;
      for (let step = 0; step < corridorLength; step += 1) {
        const cx = corridorStartX + dir * step;
        for (let dy = 0; dy <= 1; dy += 1) {
          setTile(cx, entryY - dy, 'Z');
        }
      }
      const healthX = corridorStartX + dir * (corridorLength - 1);
      const healthY = entryY - 1;
      setTile(healthX, healthY, 'H');
      if (Math.random() < 0.5) {
        const entranceX = corridorStartX - dir;
        for (let dy = 0; dy <= 1; dy += 1) {
          if (entranceX <= room.x || entranceX >= room.x + room.w - 1) continue;
          setTile(entranceX, entryY - dy, blockChar);
        }
      }
      return true;
    };

    const placeHealthInRoom = (room) => {
      const mode = healthRooms.length % 3;
      const blockChar = pickOne(healthBlockTypes);
      if (mode === 0) return placeHealthSurrounded(room, blockChar);
      if (mode === 1) return placeHealthHidden(room, blockChar);
      return placeHealthHigh(room);
    };

    let placedHealth = 0;
    const placeWithSpacing = (minSteps) => {
      for (let i = 0; i < healthCandidates.length && placedHealth < healthTarget; i += 1) {
        const room = healthCandidates[i];
        if (!isRoomFarFrom(room, healthRooms, minSteps)) continue;
        if (placeHealthInRoom(room)) {
          healthRooms.push(room);
          placedHealth += 1;
        }
      }
    };

    placeWithSpacing(2);
    if (placedHealth < healthTarget) {
      placeWithSpacing(1);
    }

    const ensureDoorConnectivity = () => {
      const blockers = new Set(['#', 'B', 'W', 'X', 'C', 'U', 'I', '<', '>', '^', 'v', 'N', 'P', 'Q', 'E', 'G', 'J', 'V']);
      const carveLine = (room, start, end) => {
        const dx = Math.sign(end.x - start.x);
        const dy = Math.sign(end.y - start.y);
        let x = start.x;
        let y = start.y;
        const carveTile = (tx, ty) => {
          if (tx < room.x + 1 || tx > room.x + room.w - 2) return;
          if (ty < room.y + 1 || ty > room.y + room.h - 2) return;
          if (tiles[ty]?.[tx] !== 'D') setTile(tx, ty, '.');
        };
        carveTile(x, y);
        while (x !== end.x || y !== end.y) {
          if (x !== end.x) x += dx;
          if (y !== end.y) y += dy;
          carveTile(x, y);
        }
      };
      const getDoorPad = (room, door) => {
        const pad = { x: door.x, y: door.y };
        if (door.side === 'top') pad.y += 1;
        if (door.side === 'bottom') pad.y -= 1;
        if (door.side === 'left') pad.x += 1;
        if (door.side === 'right') pad.x -= 1;
        if (pad.x < room.x + 1 || pad.x > room.x + room.w - 2) return null;
        if (pad.y < room.y + 1 || pad.y > room.y + room.h - 2) return null;
        return pad;
      };
      const isPassable = (room, tx, ty) => {
        const tile = tiles[ty]?.[tx];
        const headTile = tiles[ty - 1]?.[tx];
        if (!tile || !headTile) return false;
        const wallTile = getRoomWallTile(room);
        if (tile === wallTile || headTile === wallTile) return false;
        if (blockers.has(tile) || blockers.has(headTile)) return false;
        return true;
      };
      const floodFrom = (room, start) => {
        const visited = new Set();
        const queue = [start];
        const keyFor = (tx, ty) => `${tx},${ty}`;
        while (queue.length) {
          const current = queue.shift();
          const key = keyFor(current.x, current.y);
          if (visited.has(key)) continue;
          visited.add(key);
          const neighbors = [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 }
          ];
          neighbors.forEach((next) => {
            if (next.x < room.x + 1 || next.x > room.x + room.w - 2) return;
            if (next.y < room.y + 1 || next.y > room.y + room.h - 2) return;
            if (!isPassable(room, next.x, next.y)) return;
            queue.push(next);
          });
        }
        return visited;
      };

      rooms.forEach((room) => {
        const doors = findRoomDoorTiles(room);
        const pads = doors.map((door) => getDoorPad(room, door)).filter(Boolean);
        if (pads.length < 2) return;
        let anchor = pads[0];
        let reachable = floodFrom(room, anchor);
        const keyFor = (pad) => `${pad.x},${pad.y}`;
        pads.slice(1).forEach((pad) => {
          if (!reachable.has(keyFor(pad))) {
            carveLine(room, anchor, { x: pad.x, y: anchor.y });
            carveLine(room, { x: pad.x, y: anchor.y }, pad);
            reachable = floodFrom(room, anchor);
          }
        });
      });
    };

    const enforceAcidSupports = () => {
      for (let y = 0; y < height - 1; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (tiles[y][x] !== 'A') continue;
          const below = tiles[y + 1]?.[x];
          if (below && below !== 'D') {
            setTile(x, y + 1, '#');
          }
        }
      }
    };

    const enforceSpikeSupports = () => {
      const supports = new Set(['#', 'F', 'R', 'W', 'X', 'C', 'U', 'I', '<', '>', 'N', 'P', 'Q', 'E', 'G', 'J', 'V']);
      const canSupport = (x, y) => {
        const tile = tiles[y]?.[x];
        return tile && tile !== 'D' && supports.has(tile);
      };
      const placeSupport = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        if (tiles[y]?.[x] === 'D') return false;
        setTile(x, y, '#');
        return true;
      };
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (tiles[y][x] !== '*' && tiles[y][x] !== '!') continue;
          if (canSupport(x, y + 1) || canSupport(x, y - 1) || canSupport(x - 1, y) || canSupport(x + 1, y)) {
            continue;
          }
          if (placeSupport(x, y + 1)) continue;
          if (placeSupport(x + 1, y)) continue;
          if (placeSupport(x - 1, y)) continue;
          placeSupport(x, y - 1);
        }
      }
    };

    const isSpawnBufferTile = (x, y) => Math.abs(x - spawn.x) <= 3 && Math.abs(y - spawn.y) <= 3;
    const isSpawnPlatformTile = (x, y) => {
      const dx = x - spawn.x;
      const dy = y - spawn.y;
      return (dy === 1 && Math.abs(dx) <= 2) || (dy === 2 && Math.abs(dx) <= 2);
    };
    const clearSpawnBufferTiles = () => {
      for (let y = spawn.y - 3; y <= spawn.y + 3; y += 1) {
        for (let x = spawn.x - 3; x <= spawn.x + 3; x += 1) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (isSpawnPlatformTile(x, y)) continue;
          setTile(x, y, '.');
        }
      }
    };

    clearSpawnBufferTiles();
    ensureDoorConnectivity();
    enforceAcidSupports();
    enforceSpikeSupports();

    const enemies = [];
    const difficultyOrder = [
      'practice',
      'skitter',
      'coward',
      'slicer',
      'pouncer',
      'bouncer',
      'spitter',
      'ranger',
      'bulwark',
      'floater',
      'drifter',
      'bobber',
      'harrier',
      'hivenode',
      'sentinel'
    ];
    const roomsByDistance = rooms
      .filter((room) => room !== spawnRoom)
      .sort((a, b) => roomDistance(a) - roomDistance(b));
    const maxDist = Math.hypot(width / 2, height / 2) || 1;
    const usedRooms = new Set();
    const placeEnemy = (room, type) => {
      const spot = findFloorInRoom(room);
      if (!spot) return false;
      enemies.push({ x: spot.x, y: spot.y, type });
      return true;
    };

    difficultyOrder.forEach((type, index) => {
      if (!roomsByDistance.length) return;
      const targetIndex = Math.floor((index / Math.max(1, difficultyOrder.length - 1)) * (roomsByDistance.length - 1));
      let placed = false;
      for (let offset = 0; offset < roomsByDistance.length; offset += 1) {
        const candidate = roomsByDistance[(targetIndex + offset) % roomsByDistance.length];
        if (usedRooms.has(candidate.cellIndex)) continue;
        if (placeEnemy(candidate, type)) {
          usedRooms.add(candidate.cellIndex);
          placed = true;
          break;
        }
      }
      if (!placed) {
        for (let i = 0; i < roomsByDistance.length; i += 1) {
          const candidate = roomsByDistance[i];
          if (placeEnemy(candidate, type)) break;
        }
      }
    });

    roomsByDistance.forEach((room) => {
      const enemyCount = clamp(Math.floor(room.area / 220) + Math.floor(Math.hypot(room.center.x - spawn.x, room.center.y - spawn.y) / maxDist * 3), 1, 7);
      const distance = Math.hypot(room.center.x - spawn.x, room.center.y - spawn.y);
      const ratio = clamp(distance / maxDist, 0, 1);
      const centerIndex = Math.floor(ratio * (difficultyOrder.length - 1));
      const minIndex = clamp(centerIndex - 2, 0, difficultyOrder.length - 1);
      const maxIndex = clamp(centerIndex + 2, 0, difficultyOrder.length - 1);
      for (let i = 0; i < enemyCount; i += 1) {
        const spot = findFloorInRoom(room);
        if (!spot) continue;
        const index = randInt(minIndex, maxIndex);
        enemies.push({ x: spot.x, y: spot.y, type: difficultyOrder[index] });
      }
    });

    const regions = [];
    const regionCols = 3;
    const regionRows = 2;
    const regionWidth = Math.floor(width / regionCols);
    const regionHeight = Math.floor(height / regionRows);
    BIOME_THEMES.forEach((theme, index) => {
      const col = index % regionCols;
      const row = Math.floor(index / regionCols);
      const x = col * regionWidth;
      const y = row * regionHeight;
      const w = col === regionCols - 1 ? width - x : regionWidth;
      const h = row === regionRows - 1 ? height - y : regionHeight;
      regions.push({
        id: theme.id,
        name: theme.name,
        color: theme.color,
        rect: [x, y, w, h]
      });
    });

    const filteredEnemies = enemies.filter((enemy) => !isSpawnBufferTile(enemy.x, enemy.y));
    const filteredElevatorPaths = elevatorPaths.filter((path) => !isSpawnBufferTile(path.x, path.y));
    const filteredElevators = elevators.filter((platform) => !isSpawnBufferTile(platform.x, platform.y));

    const data = {
      schemaVersion: 1,
      tileSize: this.game.world.tileSize,
      width,
      height,
      spawn,
      tiles: tiles.map((row) => row.join('')),
      regions,
      enemies: filteredEnemies,
      elevatorPaths: filteredElevatorPaths,
      elevators: filteredElevators
    };

    this.game.applyWorldData(data);
    this.syncPreviewMinimap();
    this.game.runPlayabilityCheck();
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.persistAutosave();
    this.resetView();
    this.game.runGoldenPathSimulation({
      restoreState: 'editor',
      maxSimSeconds: 5,
      timeoutWarning: 'Random level playtest exceeded 5 seconds. Check the layout or shorten paths.'
    });
    this.resetView();
  }

  undo() {
    const action = this.undoStack.pop();
    if (!action) return;
    this.applyAction(action, 'undo');
    this.redoStack.push(action);
    this.persistAutosave();
  }

  redo() {
    const action = this.redoStack.pop();
    if (!action) return;
    this.applyAction(action, 'redo');
    this.undoStack.push(action);
    this.persistAutosave();
  }

  applyAction(action, direction) {
    const applyTiles = direction === 'undo'
      ? action.tiles.map((tile) => ({ x: tile.x, y: tile.y, char: tile.prev }))
      : action.tiles.map((tile) => ({ x: tile.x, y: tile.y, char: tile.next }));

    applyTiles.forEach((tile) => {
      this.game.world.setTile(tile.x, tile.y, tile.char);
    });

    if (action.spawn) {
      const spawn = direction === 'undo' ? action.spawn.prev : action.spawn.next;
      if (spawn) {
        this.game.world.setSpawnTile(spawn.x, spawn.y);
      }
    }

    if (action.enemies) {
      const changes = direction === 'undo'
        ? action.enemies.map((enemy) => ({ x: enemy.x, y: enemy.y, type: enemy.prev }))
        : action.enemies.map((enemy) => ({ x: enemy.x, y: enemy.y, type: enemy.next }));
      changes.forEach((enemy) => {
        if (enemy.type) {
          this.game.world.setEnemy(enemy.x, enemy.y, enemy.type);
        } else {
          this.game.world.removeEnemy(enemy.x, enemy.y);
        }
      });
    }

    if (action.elevatorPaths) {
      const changes = direction === 'undo'
        ? action.elevatorPaths.map((path) => ({ x: path.x, y: path.y, active: path.prev }))
        : action.elevatorPaths.map((path) => ({ x: path.x, y: path.y, active: path.next }));
      changes.forEach((path) => {
        this.game.world.setElevatorPath(path.x, path.y, path.active);
      });
    }

    if (action.elevators) {
      const changes = direction === 'undo'
        ? action.elevators.map((platform) => ({ x: platform.x, y: platform.y, active: platform.prev }))
        : action.elevators.map((platform) => ({ x: platform.x, y: platform.y, active: platform.next }));
      changes.forEach((platform) => {
        this.game.world.setElevatorPlatform(platform.x, platform.y, platform.active);
      });
    }

    this.game.refreshWorldCaches();
  }

  beginStroke(mode, tileX, tileY, source = 'pointer') {
    this.dragging = true;
    this.dragMode = mode;
    this.dragSource = source;
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.moveSelection = null;
    this.moveTarget = null;
    if (mode === 'pan') {
      this.panStart = { x: this.lastPointer.x, y: this.lastPointer.y, camX: this.camera.x, camY: this.camera.y };
      return;
    }
    if (mode === 'zoom') {
      this.zoomStart = {
        x: this.lastPointer.x,
        y: this.lastPointer.y,
        zoom: this.zoom
      };
      return;
    }
    if (mode === 'move') {
      const selection = this.pickMoveSelection(tileX, tileY);
      if (selection) {
        this.moveSelection = selection;
        this.moveTarget = { x: tileX, y: tileY };
        return;
      }
      this.panStart = { x: this.lastPointer.x, y: this.lastPointer.y, camX: this.camera.x, camY: this.camera.y };
      this.dragMode = 'pan';
      return;
    }
    if (mode === 'shape' || mode === 'prefab') {
      this.dragStart = { x: tileX, y: tileY };
      this.dragTarget = { x: tileX, y: tileY };
      return;
    }
    if (mode === 'enemy') {
      const paintMode = this.dragButton === 2 ? 'erase' : 'paint';
      this.applyEnemy(tileX, tileY, paintMode);
      return;
    }
    this.applyPaint(tileX, tileY, mode);
  }

  endStroke() {
    if (!this.dragging) return;
    if (this.dragMode === 'pan') {
      this.dragging = false;
      this.dragMode = null;
      this.panStart = null;
      this.endPrecisionZoom();
      return;
    }
    if (this.dragMode === 'zoom') {
      this.dragging = false;
      this.dragMode = null;
      this.zoomStart = null;
      this.endPrecisionZoom();
      return;
    }
    if (this.dragMode === 'move' && this.moveSelection && this.moveTarget) {
      this.applyMove(this.moveTarget.x, this.moveTarget.y);
    }
    if (this.dragMode === 'shape' && this.dragStart && this.dragTarget) {
      this.applyShape(this.dragStart, this.dragTarget);
    }
    if (this.dragMode === 'prefab' && this.dragStart && this.dragTarget) {
      this.applyPrefab(this.dragStart, this.dragTarget);
    }

    const tiles = Array.from(this.pendingChanges.values());
    const enemies = Array.from(this.pendingEnemies.values());
    const elevatorPaths = Array.from(this.pendingElevatorPaths.values());
    const elevators = Array.from(this.pendingElevators.values());
    if (tiles.length > 0 || this.pendingSpawn || enemies.length > 0 || elevatorPaths.length > 0 || elevators.length > 0) {
      const action = {
        tiles,
        spawn: this.pendingSpawn,
        enemies,
        elevatorPaths,
        elevators
      };
      this.undoStack.push(action);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.scheduleWorldRefresh();
      this.persistAutosave();
    }
    this.pendingChanges.clear();
    this.pendingSpawn = null;
    this.pendingEnemies.clear();
    this.pendingElevatorPaths.clear();
    this.pendingElevators.clear();
    this.dragging = false;
    this.dragMode = null;
    this.dragButton = null;
    this.dragSource = null;
    this.zoomStart = null;
    this.moveSelection = null;
    this.moveTarget = null;
    this.dragStart = null;
    this.dragTarget = null;
    this.endPrecisionZoom();
  }

  handlePointerDown(payload) {
    if (!this.active) return;
    this.updateLayoutBounds();
    this.sanitizeView('handlePointerDown');
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.randomLevelDialog.open) {
      if (this.isPointInBounds(payload.x, payload.y, this.randomLevelSlider.bounds.width)) {
        this.randomLevelSlider.active = 'width';
        this.randomLevelDialog.focus = 'width';
        this.updateRandomLevelSlider('width', payload.x);
        return;
      }
      if (this.isPointInBounds(payload.x, payload.y, this.randomLevelSlider.bounds.height)) {
        this.randomLevelSlider.active = 'height';
        this.randomLevelDialog.focus = 'height';
        this.updateRandomLevelSlider('height', payload.x);
        return;
      }
      this.handleUIClick(payload.x, payload.y);
      return;
    }
    if (this.isPointInBounds(payload.x, payload.y, this.playButtonBounds)) {
      this.startPlaytestFromCursor();
      return;
    }

    if (this.isMobileLayout()) {
      if (this.isPointInCircle(payload.x, payload.y, this.panJoystick.center, this.panJoystick.radius * 1.2)) {
        this.panJoystick.active = true;
        this.panJoystick.id = payload.id ?? null;
        this.updatePanJoystick(payload.x, payload.y);
        return;
      }

      if (this.isPointInBounds(payload.x, payload.y, this.zoomSlider.bounds)) {
        this.zoomSlider.active = true;
        this.zoomSlider.id = payload.id ?? null;
        this.updateZoomFromSlider(payload.x);
        return;
      }
    }

    if (this.radialMenu.active) {
      if (this.handleUIClick(payload.x, payload.y)) return;
      this.closeRadialMenu();
      return;
    }

    if (this.isMobileLayout() && this.drawer.open && this.panelScrollBounds
      && this.isPointInBounds(payload.x, payload.y, this.panelScrollBounds)) {
      this.panelScrollDrag = {
        id: payload.id ?? null,
        startY: payload.y,
        startScroll: this.panelScroll[this.getActivePanelTab()] || 0,
        moved: false
      };
      this.panelScrollTapCandidate = { x: payload.x, y: payload.y, id: payload.id ?? null };
      return;
    }

    if (this.handleUIClick(payload.x, payload.y)) return;


    if (this.mode === 'pixel') {
      const paletteHit = this.pixelPaletteBounds.find((bounds) => this.isPointInBounds(payload.x, payload.y, bounds));
      if (paletteHit) {
        this.pixelColorIndex = paletteHit.index;
        this.pixelTool = paletteHit.color ? 'paint' : 'erase';
        return;
      }
      const cell = this.getPixelCellAt(payload.x, payload.y);
      if (cell) {
        this.pixelPaintActive = true;
        const selected = PIXEL_PALETTE[this.pixelColorIndex];
        const color = this.pixelTool === 'erase' ? null : selected?.color || null;
        this.setPixelCell(cell.col, cell.row, color);
        return;
      }
    }

    if (this.mode === 'midi') {
      const noteHit = this.getMidiNoteHit(payload.x, payload.y);
      if (noteHit?.note) {
        const cell = this.getMidiCellAt(payload.x, payload.y);
        if (cell) {
          const rows = this.midiGridBounds?.rows || 12;
          const basePitch = 60;
          const noteRow = rows - 1 - ((noteHit.note.pitch - basePitch + rows) % rows);
          this.midiNoteDrag = {
            note: noteHit.note,
            type: noteHit.edge === 'end' ? 'resize' : 'move',
            offsetCol: cell.col - noteHit.note.start,
            offsetRow: cell.row - noteRow,
            originStart: noteHit.note.start,
            originLength: noteHit.note.length || 1,
            originPitch: noteHit.note.pitch
          };
          this.midiNoteDirty = false;
        }
        return;
      }
      const cell = this.getMidiCellAt(payload.x, payload.y);
      if (cell) {
        const rows = this.midiGridBounds?.rows || 12;
        const basePitch = 60;
        const pitch = basePitch + (rows - 1 - cell.row);
        this.toggleMidiNote(pitch, cell.col, this.midiNoteLength);
        return;
      }
    }

    if (this.isMobileLayout()
      && this.isPointInBounds(payload.x, payload.y, this.drawerBounds)
      && !(this.panelScrollBounds && this.isPointInBounds(payload.x, payload.y, this.panelScrollBounds))) {
      this.drawer.swipeStart = { x: payload.x, y: payload.y };
      return;
    }

    if (this.mode === 'trigger') {
      if (this.isMobileLayout() && !this.isPointerInEditorArea(payload.x, payload.y)) return;
      const { tileX, tileY } = this.screenToTile(payload.x, payload.y);
      this.triggerZoneStart = { x: tileX, y: tileY };
      this.triggerZoneTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.mode === 'music' && this.getActivePanelTab() === 'music') {
      if (this.isMobileLayout() && !this.isPointerInEditorArea(payload.x, payload.y)) return;
      const { tileX, tileY } = this.screenToTile(payload.x, payload.y);
      if (this.musicTool === 'erase') {
        this.removeMusicZoneAt(tileX, tileY);
        return;
      }
      this.musicDragStart = { x: tileX, y: tileY };
      this.musicDragTarget = { x: tileX, y: tileY };
      if (this.musicTrack?.id) this.game.audio?.playSong?.(this.musicTrack.id);
      return;
    }

    if (this.isMobileLayout()) {
      if (!this.isPointerInEditorArea(payload.x, payload.y)) return;
      const { tileX, tileY } = this.screenToTile(payload.x, payload.y);
      this.pendingPointer = {
        x: payload.x,
        y: payload.y,
        tileX,
        tileY,
        mode: this.mode,
        tileTool: this.tileTool,
        shapeTool: this.shapeTool,
        prefabType: this.prefabType
      };
      this.longPressFired = false;
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        if (!this.pendingPointer) return;
        this.longPressFired = true;
        this.openRadialMenu(this.pendingPointer.x, this.pendingPointer.y);
        this.pendingPointer = null;
      }, 520);
      return;
    }

    this.dragButton = payload.button;
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (payload.button === 1 || (payload.button === 0 && this.game.input.isDownCode('Space'))) {
      this.beginStroke('pan', tileX, tileY);
      return;
    }

    if (payload.button === 2) {
      if (this.mode === 'enemy') {
        this.beginStroke('enemy', tileX, tileY);
      } else {
        this.mode = 'tile';
        this.tileTool = 'erase';
        this.beginStroke('erase', tileX, tileY);
      }
      return;
    }

    const dragMode = this.resolveDragMode(this.mode);
    if (dragMode === 'move' || dragMode === 'erase' || dragMode === 'enemy' || dragMode === 'prefab' || dragMode === 'shape') {
      this.beginStroke(dragMode, tileX, tileY);
      return;
    }

    this.mode = 'tile';
    this.tileTool = 'paint';
    this.beginStroke('paint', tileX, tileY);
  }

  handlePointerMove(payload) {
    if (!this.active) return;
    this.sanitizeView('handlePointerMove');
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.pixelPaintActive && this.mode === 'pixel') {
      const cell = this.getPixelCellAt(payload.x, payload.y);
      if (cell) {
        const selected = PIXEL_PALETTE[this.pixelColorIndex];
        const color = this.pixelTool === 'erase' ? null : selected?.color || null;
        this.setPixelCell(cell.col, cell.row, color);
      }
      return;
    }

    if (this.mode === 'midi' && this.midiNoteDrag) {
      const bounds = this.midiGridBounds;
      if (!bounds) return;
      const { x: gridX, y: gridY, cellSize, rows, cols } = bounds;
      const col = clamp(Math.floor((payload.x - gridX) / cellSize), 0, cols - 1);
      const row = clamp(Math.floor((payload.y - gridY) / cellSize), 0, rows - 1);
      const basePitch = 60;
      if (this.midiNoteDrag.type === 'resize') {
        const start = this.midiNoteDrag.note.start;
        const nextLength = clamp(col - start + 1, 1, cols - start);
        this.midiNoteDrag.note.length = nextLength;
      } else {
        const length = clamp(this.midiNoteDrag.note.length || 1, 1, cols);
        const nextStart = clamp(col - this.midiNoteDrag.offsetCol, 0, cols - length);
        const nextRow = clamp(row - this.midiNoteDrag.offsetRow, 0, rows - 1);
        const nextPitch = basePitch + (rows - 1 - nextRow);
        this.midiNoteDrag.note.start = nextStart;
        this.midiNoteDrag.note.pitch = nextPitch;
      }
      this.midiNoteDirty = true;
      return;
    }

    if (this.triggerZoneStart && this.mode === 'trigger') {
      const { tileX, tileY } = this.screenToTile(payload.x ?? this.lastPointer.x, payload.y ?? this.lastPointer.y);
      this.triggerZoneTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.musicDragStart && this.mode === 'music' && this.getActivePanelTab() === 'music') {
      const { tileX, tileY } = this.screenToTile(payload.x, payload.y);
      this.musicDragTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.isMobileLayout()) {
      if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
        this.updatePanJoystick(payload.x, payload.y);
        return;
      }
      if (this.zoomSlider.active && (payload.id === undefined || this.zoomSlider.id === payload.id)) {
        this.updateZoomFromSlider(payload.x);
        return;
      }
    }

    if (this.isMobileLayout() && this.panelScrollDrag
      && (payload.id === undefined || this.panelScrollDrag.id === payload.id)) {
      const activeTab = this.getActivePanelTab();
      const maxScroll = this.panelScrollMax[activeTab] || 0;
      const delta = this.panelScrollDrag.startY - payload.y;
      if (Math.abs(delta) > 6) {
        this.panelScrollDrag.moved = true;
      }
      this.panelScroll[activeTab] = clamp(this.panelScrollDrag.startScroll + delta, 0, maxScroll);
      if (this.panelScrollDrag.moved) {
        if (this.drawer.swipeStart) this.drawer.swipeStart = null;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
      return;
    }

    if (this.randomLevelDialog.open && this.randomLevelSlider.active) {
      this.updateRandomLevelSlider(this.randomLevelSlider.active, payload.x);
      return;
    }
    if (this.randomLevelDialog.open) return;
    if (this.isMobileLayout() && this.drawer.swipeStart) {
      const dx = payload.x - this.drawer.swipeStart.x;
      const dy = payload.y - this.drawer.swipeStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
        const direction = dx > 0 ? -1 : 1;
        const nextIndex = (this.drawer.tabIndex + direction + this.drawer.tabs.length) % this.drawer.tabs.length;
        this.drawer.tabIndex = nextIndex;
        this.drawer.swipeStart = null;
      }
      return;
    }

    if (this.isMobileLayout() && this.pendingPointer) {
      const dx = payload.x - this.pendingPointer.x;
      const dy = payload.y - this.pendingPointer.y;
      if (Math.hypot(dx, dy) > 10) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        const { tileX, tileY } = this.screenToTile(this.pendingPointer.x, this.pendingPointer.y);
        this.dragButton = 0;
        const dragMode = this.resolveDragMode(this.pendingPointer.mode, this.pendingPointer.tileTool);
        if (this.pendingPointer.shapeTool) {
          this.shapeTool = this.pendingPointer.shapeTool;
        }
        if (this.pendingPointer.prefabType) {
          this.prefabType = this.pendingPointer.prefabType;
        }
        this.beginStroke(dragMode, tileX, tileY);
        if (['paint', 'erase', 'enemy'].includes(dragMode)) {
          this.startPrecisionZoom();
        }
        this.pendingPointer = null;
      } else {
        return;
      }
    }

    if (this.isMobileLayout() && !this.isPointerInEditorArea(payload.x, payload.y) && !this.dragging) return;
    const { tileX, tileY } = this.screenToTile(payload.x, payload.y);

    if (!this.dragging) return;

    if (this.dragMode === 'pan' && this.panStart) {
      const dx = (payload.x - this.panStart.x) / this.zoom;
      const dy = (payload.y - this.panStart.y) / this.zoom;
      this.camera.x = this.panStart.camX - dx;
      this.camera.y = this.panStart.camY - dy;
      this.clampCamera();
      return;
    }

    if (this.dragMode === 'zoom' && this.zoomStart) {
      const dy = payload.y - this.zoomStart.y;
      const factor = 1 - dy * 0.005;
      this.setZoom(this.zoomStart.zoom * factor, this.zoomStart.x, this.zoomStart.y);
      return;
    }

    if (this.dragMode === 'move') {
      this.moveTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.dragMode === 'shape' || this.dragMode === 'prefab') {
      this.dragTarget = { x: tileX, y: tileY };
      return;
    }

    if (this.dragMode === 'paint' || this.dragMode === 'erase') {
      this.applyPaint(tileX, tileY, this.dragMode);
    }

    if (this.dragMode === 'enemy') {
      const paintMode = this.dragButton === 2 ? 'erase' : 'paint';
      this.applyEnemy(tileX, tileY, paintMode);
    }
  }

  handlePointerUp(payload = {}) {
    if (!this.active) return;
    this.sanitizeView('handlePointerUp');
    if (this.pixelPaintActive && this.mode === 'pixel') {
      this.pixelPaintActive = false;
      return;
    }
    if (this.mode === 'midi' && this.midiNoteDrag) {
      this.midiNoteDrag = null;
      if (this.midiNoteDirty) {
        this.persistAutosave();
        this.midiNoteDirty = false;
      }
      return;
    }
    if (this.triggerZoneStart && this.mode === 'trigger') {
      const { tileX, tileY } = this.screenToTile(payload.x ?? this.lastPointer.x, payload.y ?? this.lastPointer.y);
      this.triggerZoneTarget = { x: tileX, y: tileY };
      const start = this.triggerZoneStart;
      const end = this.triggerZoneTarget || start;
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);
      this.addTriggerZone([minX, minY, maxX - minX + 1, maxY - minY + 1]);
      this.triggerZoneStart = null;
      this.triggerZoneTarget = null;
      return;
    }

    if (this.musicDragStart && this.mode === 'music' && this.getActivePanelTab() === 'music') {
      const start = this.musicDragStart;
      const end = this.musicDragTarget || start;
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);
      const width = Math.max(1, maxX - minX + 1);
      const height = Math.max(1, maxY - minY + 1);
      const tracks = this.getMusicTracks();
      const trackId = this.musicTrack?.id || tracks[0]?.id;
      this.addMusicZone([minX, minY, width, height], trackId);
      this.musicDragStart = null;
      this.musicDragTarget = null;
      return;
    }
    if (this.playtestPressActive) {
      this.playtestPressActive = false;
      if (this.playtestPressTimer) {
        clearTimeout(this.playtestPressTimer);
        this.playtestPressTimer = null;
        startPlaytestTransition(this.game);
      }
      return;
    }

    if (this.isMobileLayout()) {
      if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id)) {
        this.panJoystick.active = false;
        this.panJoystick.id = null;
        this.panJoystick.dx = 0;
        this.panJoystick.dy = 0;
        return;
      }

      if (this.zoomSlider.active && (payload.id === undefined || this.zoomSlider.id === payload.id)) {
        this.zoomSlider.active = false;
        this.zoomSlider.id = null;
        return;
      }
    }

    if (this.randomLevelDialog.open && this.randomLevelSlider.active) {
      this.randomLevelSlider.active = null;
    }

    if (this.drawer.swipeStart) {
      this.drawer.swipeStart = null;
    }

    if (this.panelScrollTapCandidate && (!this.panelScrollDrag || !this.panelScrollDrag.moved)
      && (payload.id === undefined || this.panelScrollTapCandidate.id === (payload.id ?? null))) {
      const tap = this.panelScrollTapCandidate;
      this.panelScrollTapCandidate = null;
      if (this.handleUIClick(tap.x, tap.y)) {
        this.panelScrollDrag = null;
        return;
      }
    }

    if (this.panelScrollDrag && (payload.id === undefined || this.panelScrollDrag.id === payload.id)) {
      this.panelScrollDrag = null;
    }

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.pendingPointer) {
      const { tileX, tileY } = this.screenToTile(this.pendingPointer.x, this.pendingPointer.y);
      if (!this.longPressFired) {
        const dragMode = this.resolveDragMode(this.pendingPointer.mode, this.pendingPointer.tileTool);
        if (this.pendingPointer.shapeTool) {
          this.shapeTool = this.pendingPointer.shapeTool;
        }
        if (this.pendingPointer.prefabType) {
          this.prefabType = this.pendingPointer.prefabType;
        }
        this.beginStroke(dragMode, tileX, tileY);
        this.endStroke();
      }
      this.pendingPointer = null;
      return;
    }

    this.endStroke();
  }

  handleGestureStart(payload) {
    if (!this.active) return;
    this.dragging = false;
    this.dragMode = null;
    this.panStart = null;
    this.zoomStart = null;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.pendingPointer = null;
    this.gestureStart = {
      x: payload.x,
      y: payload.y,
      camX: this.camera.x,
      camY: this.camera.y,
      zoom: this.zoom,
      distance: payload.distance
    };
  }

  handleGestureMove(payload) {
    if (!this.active || !this.gestureStart) return;
    const zoomFactor = payload.distance / this.gestureStart.distance;
    this.setZoom(this.gestureStart.zoom * zoomFactor, payload.x, payload.y);
    const dx = (payload.x - this.gestureStart.x) / this.zoom;
    const dy = (payload.y - this.gestureStart.y) / this.zoom;
    this.camera.x = this.gestureStart.camX - dx;
    this.camera.y = this.gestureStart.camY - dy;
    this.clampCamera();
    this.sanitizeView('handleGestureMove');
  }

  handleGestureEnd() {
    if (!this.active) return;
    this.gestureStart = null;
  }

  handleWheel(payload) {
    if (!this.active) return;
    if (this.mode === 'midi' && this.midiInstrumentScrollBounds) {
      const { x, y, w, h } = this.midiInstrumentScrollBounds;
      if (payload.x >= x && payload.x <= x + w && payload.y >= y && payload.y <= y + h) {
        const delta = payload.deltaY > 0 ? 1 : -1;
        this.midiInstrumentScroll = clamp(this.midiInstrumentScroll + delta, 0, this.midiInstrumentScrollMax);
        return;
      }
    }
    if (!this.isMobileLayout() && this.panelScrollBounds) {
      const { x, y, w, h } = this.panelScrollBounds;
      if (payload.x >= x && payload.x <= x + w && payload.y >= y && payload.y <= y + h) {
        const activeTab = this.getActivePanelTab();
        const maxScroll = this.panelScrollMax[activeTab] || 0;
        const nextScroll = clamp((this.panelScroll[activeTab] || 0) + payload.deltaY, 0, maxScroll);
        this.panelScroll[activeTab] = nextScroll;
        return;
      }
    }
    const zoomFactor = payload.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.zoom * zoomFactor, payload.x, payload.y);
  }

  addUIButton(bounds, onClick, tooltip = '') {
    this.uiButtons.push({ ...bounds, onClick, tooltip });
  }

  handleUIClick(x, y) {
    for (let index = this.uiButtons.length - 1; index >= 0; index -= 1) {
      const button = this.uiButtons[index];
      if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
        button.onClick();
        if (button.tooltip) {
          this.activeTooltip = button.tooltip;
          this.tooltipTimer = 3;
        }
        return true;
      }
    }
    return false;
  }

  isPointInBounds(x, y, bounds) {
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  isPointInCircle(x, y, center, radius) {
    const dx = x - center.x;
    const dy = y - center.y;
    return Math.hypot(dx, dy) <= radius;
  }

  getPixelCellAt(x, y) {
    if (!this.pixelGridBounds) return null;
    const { x: gridX, y: gridY, cellSize, size } = this.pixelGridBounds;
    if (x < gridX || y < gridY) return null;
    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col < 0 || row < 0 || col >= size || row >= size) return null;
    return { col, row };
  }

  getMidiCellAt(x, y) {
    if (!this.midiGridBounds) return null;
    const { x: gridX, y: gridY, cellSize, rows, cols } = this.midiGridBounds;
    if (x < gridX || y < gridY) return null;
    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
  }

  getMidiNoteHit(x, y) {
    if (!this.midiNoteBounds || this.midiNoteBounds.length === 0) return null;
    for (let index = this.midiNoteBounds.length - 1; index >= 0; index -= 1) {
      const bounds = this.midiNoteBounds[index];
      if (x < bounds.x || x > bounds.x + bounds.w || y < bounds.y || y > bounds.y + bounds.h) continue;
      const edgePadding = 5;
      const isEndEdge = x >= bounds.x + bounds.w - edgePadding;
      return { note: bounds.note, edge: isEndEdge ? 'end' : null };
    }
    return null;
  }

  updatePanJoystick(x, y) {
    const { center, radius } = this.panJoystick;
    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.01) {
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    const clamped = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    const scaled = clamped / radius;
    this.panJoystick.dx = Math.cos(angle) * scaled;
    this.panJoystick.dy = Math.sin(angle) * scaled;
  }

  updateZoomFromSlider(x) {
    const { bounds } = this.zoomSlider;
    if (!bounds || bounds.w <= 0) return;
    const t = Math.min(1, Math.max(0, (x - bounds.x) / bounds.w));
    const nextZoom = this.sliderTToZoom(t);
    this.setZoom(nextZoom, this.game.canvas.width / 2, this.game.canvas.height / 2);
  }

  updateRandomLevelSlider(kind, x) {
    const bounds = this.randomLevelSlider.bounds[kind];
    if (!bounds || bounds.w <= 0) return;
    const t = clamp((x - bounds.x) / bounds.w, 0, 1);
    const min = bounds.min;
    const max = bounds.max;
    const value = Math.round(min + (max - min) * t);
    if (kind === 'width') {
      this.randomLevelSize.width = value;
    } else {
      this.randomLevelSize.height = value;
    }
  }

  adjustRandomLevelSlider(kind, step) {
    if (!kind) return;
    const bounds = this.randomLevelSlider.bounds[kind];
    const min = bounds?.min ?? 24;
    const max = bounds?.max ?? 256;
    if (kind === 'width') {
      this.randomLevelSize.width = clamp(this.randomLevelSize.width + step, min, max);
    } else {
      this.randomLevelSize.height = clamp(this.randomLevelSize.height + step, min, max);
    }
  }

  setRandomLevelRoomPreset(roomsWide, roomsHigh) {
    const width = clamp(roomsWide * ROOM_BASE_WIDTH, 24, 256);
    const height = clamp(roomsHigh * ROOM_BASE_HEIGHT, 24, 256);
    this.randomLevelSize.width = width;
    this.randomLevelSize.height = height;
    this.randomLevelDialog.focus = 'width';
    this.randomLevelSlider.active = 'width';
  }

  promptRandomLevelDimension(kind) {
    const current = kind === 'width' ? this.randomLevelSize.width : this.randomLevelSize.height;
    const label = kind === 'width' ? 'Level width' : 'Level height';
    const raw = window.prompt(`${label} (24-256):`, String(current));
    if (raw == null) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, 24, 256);
    if (kind === 'width') this.randomLevelSize.width = next;
    else this.randomLevelSize.height = next;
    this.randomLevelDialog.focus = kind;
    this.randomLevelSlider.active = kind;
  }


  getCameraBounds() {
    const tileSize = this.game.world.tileSize;
    const worldW = this.game.world.width * tileSize;
    const worldH = this.game.world.height * tileSize;
    const viewW = this.game.canvas.width / this.zoom;
    const viewH = this.game.canvas.height / this.zoom;
    let extraLeft = 0;
    let extraRight = 0;
    if (this.isMobileLayout()) {
      extraLeft = (this.drawerBounds?.w || 0) / this.zoom;
    } else {
      extraRight = 372 / this.zoom;
    }
    const minX = -extraLeft;
    const maxX = Math.max(worldW - viewW + extraRight, minX);
    const minY = 0;
    const maxY = Math.max(worldH - viewH, minY);
    return { minX, maxX, minY, maxY };
  }

  clampCamera() {
    const bounds = this.getCameraBounds();
    this.camera.x = clamp(this.camera.x, bounds.minX, bounds.maxX);
    this.camera.y = clamp(this.camera.y, bounds.minY, bounds.maxY);
  }

  setTileType(tile) {
    this.tileType = tile;
    this.customTile = null;
    this.recordRecent('tiles', tile);
  }

  setEnemyType(enemy) {
    this.enemyType = enemy;
    this.enemyCategory = BOSS_ENEMY_TYPES.some((entry) => entry.id === enemy.id) ? 'boss' : 'standard';
    this.recordRecent('enemies', enemy);
  }

  setShapeTool(tool) {
    this.shapeTool = tool;
    this.recordRecent('shapes', tool);
  }

  setPrefabType(prefab) {
    this.prefabType = prefab;
    this.recordRecent('prefabs', prefab);
  }

  recordRecent(kind, item) {
    const listMap = {
      tiles: this.recentTiles,
      enemies: this.recentEnemies,
      prefabs: this.recentPrefabs,
      shapes: this.recentShapes
    };
    const list = listMap[kind] || [];
    const next = [item, ...list.filter((entry) => entry.id !== item.id)];
    const trimmed = next.slice(0, 6);
    if (kind === 'tiles') {
      this.recentTiles = trimmed;
    } else {
      if (kind === 'enemies') {
        this.recentEnemies = trimmed;
      } else if (kind === 'prefabs') {
        this.recentPrefabs = trimmed;
      } else if (kind === 'shapes') {
        this.recentShapes = trimmed;
      }
    }
  }

  openRadialMenu(x, y) {
    const items = [];
    this.recentTiles.slice(0, 3).forEach((tile) => {
      items.push({
        id: `tile-${tile.id}`,
        label: tile.char ? tile.char.toUpperCase() : 'SP',
        tooltip: tile.label,
        action: () => {
          this.setTileType(tile);
          this.mode = 'tile';
          this.tileTool = 'paint';
        }
      });
    });
    this.recentEnemies.slice(0, 2).forEach((enemy) => {
      items.push({
        id: `enemy-${enemy.id}`,
        label: enemy.glyph,
        tooltip: enemy.label,
        action: () => {
          this.setEnemyType(enemy);
          this.mode = 'enemy';
        }
      });
    });
    this.recentPrefabs.slice(0, 2).forEach((prefab) => {
      items.push({
        id: `prefab-${prefab.id}`,
        label: prefab.short || 'PF',
        tooltip: `Prefab: ${prefab.label}`,
        action: () => {
          this.setPrefabType(prefab);
          this.mode = 'prefab';
        }
      });
    });
    this.recentShapes.slice(0, 2).forEach((shape) => {
      items.push({
        id: `shape-${shape.id}`,
        label: shape.short || 'SH',
        tooltip: `Shape: ${shape.label}`,
        action: () => {
          this.setShapeTool(shape);
          this.mode = 'shape';
        }
      });
    });
    items.push({
      id: 'quick-erase',
      label: 'ER',
      tooltip: 'Erase',
      action: () => {
        this.mode = 'tile';
        this.tileTool = 'erase';
      }
    });
    items.push({
      id: 'quick-rotate',
      label: '⟳',
      tooltip: 'Rotate',
      action: () => {
        this.rotation = (this.rotation + 90) % 360;
        this.activeTooltip = `Rotation: ${this.rotation}°`;
        this.tooltipTimer = 2;
      }
    });

    this.radialMenu = { active: true, x, y, items };
  }

  closeRadialMenu() {
    this.radialMenu = { active: false, x: 0, y: 0, items: [] };
  }

  triggerHaptic() {
    if (!this.isMobileLayout()) return;
    if (navigator?.vibrate) {
      navigator.vibrate(12);
    }
  }

  startPrecisionZoom() {
    if (!this.isMobileLayout()) return;
    if (this.precisionZoom) return;
    if (this.zoom >= 1.3) return;
    this.precisionZoom = { previous: this.zoom };
    this.setZoom(1.4, this.lastPointer.x, this.lastPointer.y);
  }

  endPrecisionZoom() {
    if (!this.precisionZoom) return;
    const previous = this.precisionZoom.previous;
    this.precisionZoom = null;
    this.setZoom(previous, this.lastPointer.x, this.lastPointer.y);
  }

  startPlaytestFromCursor() {
    startPlaytestTransition(this.game);
  }

  restorePlaytestSpawn() {
    if (!this.playtestSpawnOverride) return;
    const previous = this.playtestSpawnOverride;
    this.playtestSpawnOverride = null;
    if (previous) {
      this.game.world.setSpawnTile(previous.x, previous.y);
    }
  }

  applyPaint(tileX, tileY, mode) {
    const ensured = this.ensureInBounds(tileX, tileY);
    if (!ensured) return;
    const { tileX: safeX, tileY: safeY } = ensured;

    if (mode === 'erase') {
      if (this.tileType.special === 'elevator-path') {
        this.setElevatorPath(safeX, safeY, false);
        return;
      }
      if (this.tileType.special === 'elevator-platform') {
        this.setElevatorPlatform(safeX, safeY, false);
        return;
      }
      this.setTile(safeX, safeY, '.');
      return;
    }

    if (this.tileType.special === 'spawn') {
      this.setSpawn(safeX, safeY);
      return;
    }

    if (this.tileType.special === 'elevator-path') {
      this.setElevatorPath(safeX, safeY, true);
      return;
    }

    if (this.tileType.special === 'elevator-platform') {
      this.setElevatorPlatform(safeX, safeY, true);
      return;
    }

    const char = this.tileType.char || '.';
    this.setTile(safeX, safeY, char);
  }

  getDragBounds(start, end) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    return {
      x1,
      x2,
      y1,
      y2,
      width: x2 - x1 + 1,
      height: y2 - y1 + 1
    };
  }

  buildShapeTiles(start, end, char) {
    const tool = this.shapeTool;
    const bounds = this.getDragBounds(start, end);
    const tiles = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const signX = Math.sign(dx) || 1;
    const signY = Math.sign(dy) || 1;
    const widthSpan = Math.max(bounds.width - 1, 1);
    const heightSpan = Math.max(bounds.height - 1, 1);
    let triangleChar = char;
    if (char === '^' || char === 'v') {
      const highPoint = start.y <= end.y ? start : end;
      const lowPoint = start.y <= end.y ? end : start;
      if (lowPoint.x !== highPoint.x) {
        triangleChar = lowPoint.x > highPoint.x ? 'v' : '^';
      }
    }

    if (tool.id === 'rect') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          tiles.push({ x, y, char });
        }
      }
    } else if (tool.id === 'hollow') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          if (x === bounds.x1 || x === bounds.x2 || y === bounds.y1 || y === bounds.y2) {
            tiles.push({ x, y, char });
          }
        }
      }
    } else if (tool.id === 'line') {
      if (Math.abs(dx) >= Math.abs(dy)) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          tiles.push({ x, y: start.y, char });
        }
      } else {
        for (let y = bounds.y1; y <= bounds.y2; y += 1) {
          tiles.push({ x: start.x, y, char });
        }
      }
    } else if (tool.id === 'stair') {
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i += 1) {
        const x = start.x + signX * i;
        const y = start.y + signY * i;
        tiles.push({ x, y, char });
      }
    } else if (tool.id === 'triangle') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const relX = signX * (x - start.x);
          const relY = signY * (y - start.y);
          if (relX >= 0 && relY >= 0 && (relX / widthSpan + relY / heightSpan <= 1)) {
            tiles.push({ x, y, char: triangleChar });
          }
        }
      }
    } else if (tool.id === 'triangle-1x1' || tool.id === 'triangle-2x1' || tool.id === 'triangle-1x2') {
      const sizeMap = {
        'triangle-1x1': { w: 1, h: 1 },
        'triangle-2x1': { w: 2, h: 1 },
        'triangle-1x2': { w: 1, h: 2 }
      };
      const size = sizeMap[tool.id];
      const widthSpanFixed = Math.max(size.w - 1, 1);
      const heightSpanFixed = Math.max(size.h - 1, 1);
      const target = {
        x: start.x + signX * (size.w - 1),
        y: start.y + signY * (size.h - 1)
      };
      const fixedBounds = this.getDragBounds(start, target);
      for (let y = fixedBounds.y1; y <= fixedBounds.y2; y += 1) {
        for (let x = fixedBounds.x1; x <= fixedBounds.x2; x += 1) {
          const relX = signX * (x - start.x);
          const relY = signY * (y - start.y);
          if (relX >= 0 && relY >= 0 && (relX / widthSpanFixed + relY / heightSpanFixed <= 1)) {
            tiles.push({ x, y, char: triangleChar });
          }
        }
      }
    }
    return tiles;
  }

  buildPrefabTiles(start, end) {
    const bounds = this.getDragBounds(start, end);
    const prefab = {
      tiles: [],
      elevatorPaths: [],
      elevators: []
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const signX = Math.sign(dx) || 1;
    const signY = Math.sign(dy) || 1;
    const addTile = (x, y, char) => {
      prefab.tiles.push({ x, y, char });
    };
    const addElevatorPath = (x, y) => {
      prefab.elevatorPaths.push({ x, y });
    };
    const addElevatorPlatform = (x, y) => {
      prefab.elevators.push({ x, y });
    };
    const buildFixed = (width, height, callback) => {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const tileX = start.x + signX * x;
          const tileY = start.y + signY * y;
          const char = callback(x, y, width, height);
          if (char) addTile(tileX, tileY, char);
        }
      }
    };

    if (this.prefabType.id === 'room' || this.prefabType.id === 'arena') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const wall = x === bounds.x1 || x === bounds.x2 || y === bounds.y1 || y === bounds.y2;
          addTile(x, y, wall ? '#' : '.');
        }
      }
    } else if (this.prefabType.id === 'circular') {
      const centerX = (bounds.x1 + bounds.x2) / 2;
      const centerY = (bounds.y1 + bounds.y2) / 2;
      const radiusX = Math.max((bounds.x2 - bounds.x1) / 2, 1);
      const radiusY = Math.max((bounds.y2 - bounds.y1) / 2, 1);
      const isInside = (x, y) => {
        const dxNorm = (x - centerX) / radiusX;
        const dyNorm = (y - centerY) / radiusY;
        return dxNorm * dxNorm + dyNorm * dyNorm <= 1;
      };

      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          if (!isInside(x, y)) continue;
          const wall = !isInside(x + 1, y)
            || !isInside(x - 1, y)
            || !isInside(x, y + 1)
            || !isInside(x, y - 1);
          addTile(x, y, wall ? '#' : '.');
        }
      }
    } else if (this.prefabType.id === 'cave') {
      const width = bounds.x2 - bounds.x1 + 1;
      const height = bounds.y2 - bounds.y1 + 1;
      const maxSideInset = Math.min(2, Math.max(0, Math.floor(width / 2) - 1));
      const maxBottomInset = Math.min(2, Math.max(0, Math.floor(height / 2) - 1));
      const leftInsetByRow = [];
      const rightInsetByRow = [];
      const bottomInsetByColumn = [];

      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        const rowIndex = y - bounds.y1;
        let leftInset = Math.floor(Math.random() * (maxSideInset + 1));
        let rightInset = Math.floor(Math.random() * (maxSideInset + 1));
        if (leftInset + rightInset >= width - 1) {
          rightInset = Math.max(0, width - 2 - leftInset);
        }
        leftInsetByRow[rowIndex] = leftInset;
        rightInsetByRow[rowIndex] = rightInset;
      }

      for (let x = bounds.x1; x <= bounds.x2; x += 1) {
        const columnIndex = x - bounds.x1;
        bottomInsetByColumn[columnIndex] = Math.floor(Math.random() * (maxBottomInset + 1));
      }

      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        const rowIndex = y - bounds.y1;
        const leftEdge = bounds.x1 + leftInsetByRow[rowIndex];
        const rightEdge = bounds.x2 - rightInsetByRow[rowIndex];
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          const columnIndex = x - bounds.x1;
          const bottomEdge = bounds.y2 - bottomInsetByColumn[columnIndex];
          if (x < leftEdge || x > rightEdge || y > bottomEdge) continue;
          const wall = x === leftEdge || x === rightEdge || y === bounds.y1 || y === bottomEdge;
          addTile(x, y, wall ? '#' : '.');
        }
      }
    } else if (this.prefabType.id === 'corridor') {
      if (Math.abs(dx) >= Math.abs(dy)) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          addTile(x, start.y, '.');
          addTile(x, start.y + signY, '.');
        }
      } else {
        for (let y = bounds.y1; y <= bounds.y2; y += 1) {
          addTile(start.x, y, '.');
          addTile(start.x + signX, y, '.');
        }
      }
    } else if (this.prefabType.id === 'staircase') {
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i += 1) {
        addTile(start.x + signX * i, start.y + signY * i, '#');
      }
    } else if (this.prefabType.id === 'platform') {
      for (let x = bounds.x1; x <= bounds.x2; x += 1) {
        addTile(x, start.y, '=');
      }
    } else if (this.prefabType.id === 'puzzle') {
      const switchTile = { x: start.x, y: start.y, char: 'T' };
      const doorTile = { x: end.x, y: end.y, char: 'B' };
      addTile(switchTile.x, switchTile.y, switchTile.char);
      addTile(doorTile.x, doorTile.y, doorTile.char);
      if (Math.abs(dx) >= Math.abs(dy)) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        for (let x = minX + 1; x < maxX; x += 1) {
          addTile(x, start.y, 'a');
        }
      } else {
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        for (let y = minY + 1; y < maxY; y += 1) {
          addTile(start.x, y, 'a');
        }
      }
    } else if (this.prefabType.id === 'door') {
      for (let y = bounds.y1; y <= bounds.y2; y += 1) {
        for (let x = bounds.x1; x <= bounds.x2; x += 1) {
          addTile(x, y, 'D');
        }
      }
    } else if (this.prefabType.id === 'water-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : '~';
      });
    } else if (this.prefabType.id === 'lava-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : 'L';
      });
    } else if (this.prefabType.id === 'acid-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : 'A';
      });
    } else if (this.prefabType.id === 'spike-pit') {
      buildFixed(6, 2, (x, y, width, height) => {
        const wall = y === height - 1 || x === 0 || x === width - 1;
        return wall ? '#' : '*';
      });
    } else if (this.prefabType.id === 'spike-wall-pit') {
      buildFixed(6, 3, (x, y, width, height) => {
        if (y === height - 1) return '#';
        if (y === 0) return x === 0 || x === width - 1 ? '#' : '.';
        return x === 0 || x === width - 1 ? '*' : '.';
      });
    } else if (this.prefabType.id === 'spike-ceiling-pit') {
      buildFixed(6, 3, (x, y, width, height) => {
        if (y === height - 1) return '#';
        if (y === 0) return x === 0 || x === width - 1 ? '#' : '*';
        return x === 0 || x === width - 1 ? '#' : '.';
      });
    } else if (this.prefabType.id === 'powerup-t') {
      buildFixed(7, 7, (x, y) => {
        if (y <= 2) return x >= 2 && x <= 4 ? '#' : null;
        return '#';
      });
    } else if (this.prefabType.id === 'large-t-solid') {
      buildFixed(7, 6, (x, y) => {
        if (y === 0) return '#';
        return x >= 2 && x <= 4 ? '#' : null;
      });
    } else if (this.prefabType.id === 'large-t-ice') {
      buildFixed(7, 6, (x, y) => {
        if (y === 0) return 'I';
        return x >= 2 && x <= 4 ? 'I' : null;
      });
    } else if (this.prefabType.id === 'solid-platform') {
      buildFixed(6, 1, () => '#');
    } else if (this.prefabType.id === 'industrial-platform') {
      buildFixed(6, 1, () => '#');
    } else if (this.prefabType.id === 'conveyor-belt') {
      const dir = signX < 0 ? '<' : '>';
      buildFixed(6, 1, () => dir);
    } else if (this.prefabType.id === 'elevator') {
      const height = 6;
      for (let y = 0; y < height; y += 1) {
        const tileX = start.x;
        const tileY = start.y + signY * y;
        addTile(tileX, tileY, '.');
        addElevatorPath(tileX, tileY);
      }
      const platformY = start.y + signY * (height - 1);
      for (let dx = -1; dx <= 1; dx += 1) {
        addElevatorPlatform(start.x + dx, platformY);
      }
    } else if (this.prefabType.id === 'elevator-horizontal') {
      const width = 7;
      for (let x = 0; x < width; x += 1) {
        const tileX = start.x + signX * x;
        const tileY = start.y;
        addTile(tileX, tileY, '.');
        addElevatorPath(tileX, tileY);
      }
      for (let dx = -1; dx <= 1; dx += 1) {
        addElevatorPlatform(start.x + dx, start.y);
      }
    } else if (this.prefabType.id === 'moving-platform') {
      const width = 6;
      for (let x = 0; x < width; x += 1) {
        const tileX = start.x + signX * x;
        const tileY = start.y;
        addTile(tileX, tileY, '.');
        addElevatorPath(tileX, tileY);
      }
      addElevatorPlatform(start.x, start.y);
    } else if (this.prefabType.id === 'stalactite') {
      const widths = [7, 7, 5, 5, 3, 3, 1];
      buildFixed(7, 7, (x, y, width) => {
        const rowWidth = widths[y] || 1;
        const left = Math.floor((width - rowWidth) / 2);
        return x >= left && x < left + rowWidth ? '#' : null;
      });
    } else if (this.prefabType.id === 'stalagmite') {
      const widths = [1, 3, 3, 5, 5, 7, 7];
      buildFixed(7, 7, (x, y, width) => {
        const rowWidth = widths[y] || 1;
        const left = Math.floor((width - rowWidth) / 2);
        return x >= left && x < left + rowWidth ? '#' : null;
      });
    } else if (this.prefabType.id === 'cave-platform') {
      buildFixed(6, 4, (x, y, width, height) => {
        const edgeRows = y === 0 || y === height - 1;
        if (edgeRows) {
          return x >= 1 && x <= width - 2 ? '#' : null;
        }
        return '#';
      });
    } else if (this.prefabType.id === 'sand-mound') {
      const moundRows = [
        new Set([0, 6]),
        new Set([1, 5]),
        new Set([2, 4]),
        new Set([3])
      ];
      buildFixed(7, 4, (x, y) => (moundRows[y]?.has(x) ? 'E' : null));
    } else if (this.prefabType.id === 'sand-platform') {
      buildFixed(7, 1, () => 's');
    }
    return prefab;
  }

  applyShape(start, end) {
    const char = this.tileType.char || '.';
    const tiles = this.buildShapeTiles(start, end, char);
    tiles.forEach((tile) => {
      const ensured = this.ensureInBounds(tile.x, tile.y);
      if (!ensured) return;
      this.setTile(ensured.tileX, ensured.tileY, tile.char);
    });
    if (this.shapeTool.placeholder) {
      this.activeTooltip = `${this.shapeTool.label}: tile art pending`;
      this.tooltipTimer = 2;
    }
  }

  applyPrefab(start, end) {
    const prefab = this.buildPrefabTiles(start, end);
    prefab.tiles.forEach((tile) => {
      const ensured = this.ensureInBounds(tile.x, tile.y);
      if (!ensured) return;
      this.setTile(ensured.tileX, ensured.tileY, tile.char);
    });
    prefab.elevatorPaths.forEach((path) => {
      const ensured = this.ensureInBounds(path.x, path.y);
      if (!ensured) return;
      this.setElevatorPath(ensured.tileX, ensured.tileY, true);
    });
    prefab.elevators.forEach((platform) => {
      const ensured = this.ensureInBounds(platform.x, platform.y);
      if (!ensured) return;
      this.setElevatorPlatform(ensured.tileX, ensured.tileY, true);
    });
  }

  setTile(tileX, tileY, char) {
    const key = `${tileX},${tileY}`;
    const prev = this.game.world.getTile(tileX, tileY);
    if (prev === char) return;
    this.game.world.setTile(tileX, tileY, char);
    this.triggerHaptic();

    if (!this.pendingChanges.has(key)) {
      this.pendingChanges.set(key, { x: tileX, y: tileY, prev, next: char });
    } else {
      const entry = this.pendingChanges.get(key);
      entry.next = char;
    }
  }

  recordElevatorPathChange(tileX, tileY, prev, next) {
    const key = `${tileX},${tileY}`;
    if (!this.pendingElevatorPaths.has(key)) {
      this.pendingElevatorPaths.set(key, { x: tileX, y: tileY, prev, next });
    } else {
      const entry = this.pendingElevatorPaths.get(key);
      entry.next = next;
    }
  }

  recordElevatorPlatformChange(tileX, tileY, prev, next) {
    const key = `${tileX},${tileY}`;
    if (!this.pendingElevators.has(key)) {
      this.pendingElevators.set(key, { x: tileX, y: tileY, prev, next });
    } else {
      const entry = this.pendingElevators.get(key);
      entry.next = next;
    }
  }

  setElevatorPath(tileX, tileY, active) {
    const prev = this.game.world.hasElevatorPath(tileX, tileY);
    if (prev === active) return;
    this.game.world.setElevatorPath(tileX, tileY, active);
    this.triggerHaptic();
    this.recordElevatorPathChange(tileX, tileY, prev, active);
  }

  setElevatorPlatform(tileX, tileY, active) {
    const prev = this.game.world.hasElevatorPlatform(tileX, tileY);
    if (prev === active) return;
    this.game.world.setElevatorPlatform(tileX, tileY, active);
    this.triggerHaptic();
    this.recordElevatorPlatformChange(tileX, tileY, prev, active);
  }

  setSpawn(tileX, tileY) {
    const prev = this.game.world.spawn || null;
    this.game.world.setSpawnTile(tileX, tileY);
    this.triggerHaptic();
    if (!this.pendingSpawn) {
      this.pendingSpawn = {
        prev,
        next: { x: tileX, y: tileY }
      };
    } else {
      this.pendingSpawn.next = { x: tileX, y: tileY };
    }
    this.clearSpawnBuffer(tileX, tileY);
  }

  isSpawnPlatformTile(spawnX, spawnY, tileX, tileY) {
    const dx = tileX - spawnX;
    const dy = tileY - spawnY;
    return (dy === 1 && Math.abs(dx) <= 2) || (dy === 2 && Math.abs(dx) <= 2);
  }

  clearSpawnBuffer(spawnX, spawnY) {
    for (let y = spawnY - 3; y <= spawnY + 3; y += 1) {
      for (let x = spawnX - 3; x <= spawnX + 3; x += 1) {
        if (!this.isInBounds(x, y)) continue;
        if (this.isSpawnPlatformTile(spawnX, spawnY, x, y)) continue;
        if (this.game.world.hasElevatorPath(x, y)) {
          this.setElevatorPath(x, y, false);
        }
        if (this.game.world.hasElevatorPlatform(x, y)) {
          this.setElevatorPlatform(x, y, false);
        }
        if (this.game.world.enemyAt(x, y)) {
          this.removeEnemy(x, y);
        }
        this.setTile(x, y, '.');
      }
    }
  }

  ensureInBounds(tileX, tileY) {
    if (this.isInBounds(tileX, tileY)) {
      return { tileX, tileY };
    }
    const { offsetX, offsetY } = this.game.world.expandToInclude(tileX, tileY);
    if (offsetX || offsetY) {
      const tileSize = this.game.world.tileSize;
      this.camera.x += offsetX * tileSize;
      this.camera.y += offsetY * tileSize;
    }
    return { tileX: tileX + offsetX, tileY: tileY + offsetY };
  }

  recordEnemyChange(tileX, tileY, prev, next) {
    const key = `${tileX},${tileY}`;
    if (!this.pendingEnemies.has(key)) {
      this.pendingEnemies.set(key, { x: tileX, y: tileY, prev, next });
    } else {
      const entry = this.pendingEnemies.get(key);
      entry.next = next;
    }
  }

  setEnemy(tileX, tileY, type) {
    const prev = this.game.world.enemyAt(tileX, tileY);
    if (prev?.type === type) return;
    this.game.world.setEnemy(tileX, tileY, type);
    this.triggerHaptic();
    this.recordEnemyChange(tileX, tileY, prev?.type || null, type);
  }

  removeEnemy(tileX, tileY) {
    const prev = this.game.world.enemyAt(tileX, tileY);
    if (!prev) return;
    this.game.world.removeEnemy(tileX, tileY);
    this.triggerHaptic();
    this.recordEnemyChange(tileX, tileY, prev.type, null);
  }

  applyEnemy(tileX, tileY, mode) {
    const ensured = this.ensureInBounds(tileX, tileY);
    if (!ensured) return;
    const { tileX: safeX, tileY: safeY } = ensured;
    if (mode === 'erase') {
      this.removeEnemy(safeX, safeY);
      return;
    }
    this.setEnemy(safeX, safeY, this.enemyType.id);
  }

  pickMoveSelection(tileX, tileY) {
    if (!this.isInBounds(tileX, tileY)) return null;
    const enemy = this.game.world.enemyAt(tileX, tileY);
    if (enemy) {
      return { kind: 'enemy', type: enemy.type, origin: { x: tileX, y: tileY } };
    }
    if (this.game.world.hasElevatorPlatform(tileX, tileY)) {
      return { kind: 'elevator', origin: { x: tileX, y: tileY } };
    }
    const spawn = this.game.world.spawn;
    if (spawn && spawn.x === tileX && spawn.y === tileY) {
      return { kind: 'spawn', origin: { x: tileX, y: tileY } };
    }
    const char = this.game.world.getTile(tileX, tileY);
    if (char && char !== '.') {
      return { kind: 'tile', char, origin: { x: tileX, y: tileY } };
    }
    return null;
  }

  applyMove(tileX, tileY) {
    const ensured = this.ensureInBounds(tileX, tileY);
    if (!ensured || !this.moveSelection) return;
    const { tileX: safeX, tileY: safeY } = ensured;
    const { kind, origin } = this.moveSelection;
    if (origin.x === safeX && origin.y === safeY) return;
    if (kind === 'enemy') {
      this.removeEnemy(origin.x, origin.y);
      this.setEnemy(safeX, safeY, this.moveSelection.type);
      return;
    }
    if (kind === 'elevator') {
      this.setElevatorPlatform(origin.x, origin.y, false);
      this.setElevatorPlatform(safeX, safeY, true);
      return;
    }
    if (kind === 'spawn') {
      this.setSpawn(safeX, safeY);
      return;
    }
    if (kind === 'tile') {
      this.setTile(origin.x, origin.y, '.');
      this.setTile(safeX, safeY, this.moveSelection.char);
    }
  }

  selectTile(tileX, tileY) {
    if (!this.isInBounds(tileX, tileY)) return;
    if (this.game.world.hasElevatorPlatform(tileX, tileY)) {
      const platformTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'elevator-platform');
      if (platformTile) {
        this.setTileType(platformTile);
        this.mode = 'tile';
        this.tileTool = 'paint';
      }
      return;
    }
    if (this.game.world.hasElevatorPath(tileX, tileY)) {
      const pathTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'elevator-path');
      if (pathTile) {
        this.setTileType(pathTile);
        this.mode = 'tile';
        this.tileTool = 'paint';
      }
      return;
    }
    const spawn = this.game.world.spawn;
    if (spawn && spawn.x === tileX && spawn.y === tileY) {
      const spawnTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'spawn');
      if (spawnTile) {
        this.setTileType(spawnTile);
        this.mode = 'tile';
        this.tileTool = 'paint';
      }
      return;
    }
    const char = this.game.world.getTile(tileX, tileY);
    const known = DEFAULT_TILE_TYPES.find((tile) => tile.char === char);
    if (known) {
      this.setTileType(known);
      this.mode = 'tile';
      this.tileTool = 'paint';
      return;
    }
    this.customTile = { id: 'custom', label: `Tile ${char}`, char };
    this.tileType = this.customTile;
    this.mode = 'tile';
    this.tileTool = 'paint';
  }

  updateHover() {
    if (this.isMobileLayout() && !this.isPointerInEditorArea(this.lastPointer.x, this.lastPointer.y)) {
      this.hoverTile = null;
      return;
    }
    const { tileX, tileY, worldX, worldY } = this.screenToTile(this.lastPointer.x, this.lastPointer.y);
    this.hoverTile = { x: tileX, y: tileY, worldX, worldY };
    const region = this.game.world.regionAt(worldX, worldY);
    this.regionName = region.name || region.id;
  }

  isMobileLayout() {
    return Boolean(this.game.isMobile);
  }

  isPointerInEditorArea(x, y) {
    if (!this.isMobileLayout()) return true;
    return x >= this.editorBounds.x
      && x <= this.editorBounds.x + this.editorBounds.w
      && y >= this.editorBounds.y
      && y <= this.editorBounds.y + this.editorBounds.h;
  }

  sliderTToZoom(t) {
    const normalized = clamp(t, 0, 1);
    const curved = Math.pow(normalized, EDITOR_ZOOM_SLIDER_EXPONENT);
    return EDITOR_MIN_ZOOM + (EDITOR_MAX_ZOOM - EDITOR_MIN_ZOOM) * curved;
  }

  zoomToSliderT(zoom) {
    const normalized = clamp((zoom - EDITOR_MIN_ZOOM) / (EDITOR_MAX_ZOOM - EDITOR_MIN_ZOOM), 0, 1);
    return Math.pow(normalized, 1 / EDITOR_ZOOM_SLIDER_EXPONENT);
  }

  adjustZoom(delta, anchorX, anchorY) {
    this.setZoom(this.zoom + delta * 0.02, anchorX, anchorY);
  }

  setZoom(nextZoom, anchorX, anchorY) {
    const safeAnchorX = Number.isFinite(anchorX) ? anchorX : (this.game.canvas?.width || 0) * 0.5;
    const safeAnchorY = Number.isFinite(anchorY) ? anchorY : (this.game.canvas?.height || 0) * 0.5;
    const clamped = Math.min(EDITOR_MAX_ZOOM, Math.max(EDITOR_MIN_ZOOM, Number.isFinite(nextZoom) ? nextZoom : 1));
    if (Math.abs(clamped - this.zoom) < 0.001) {
      this.sanitizeView('setZoom');
      return;
    }
    const worldPos = this.screenToWorld(safeAnchorX, safeAnchorY);
    this.zoom = clamped;
    this.camera.x = worldPos.x - safeAnchorX / this.zoom;
    this.camera.y = worldPos.y - safeAnchorY / this.zoom;
    this.clampCamera();
    this.sanitizeView('setZoom');
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.camera.x) * this.zoom,
      y: (y - this.camera.y) * this.zoom
    };
  }

  screenToWorld(x, y) {
    return {
      x: x / this.zoom + this.camera.x,
      y: y / this.zoom + this.camera.y
    };
  }

  screenToTile(x, y) {
    const world = this.screenToWorld(x, y);
    const tileSize = this.game.world.tileSize;
    return {
      worldX: world.x,
      worldY: world.y,
      tileX: Math.floor(world.x / tileSize),
      tileY: Math.floor(world.y / tileSize)
    };
  }

  isInBounds(tileX, tileY) {
    return tileX >= 0 && tileY >= 0 && tileX < this.game.world.width && tileY < this.game.world.height;
  }

  draw(ctx) {
    const { canvas } = this.game;
    this.updateLayoutBounds(canvas.width, canvas.height);
    this.sanitizeView('draw');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    this.game.drawWorld(ctx, { showDoors: true });
    this.drawEditorMarkers(ctx);
    this.drawGrid(ctx);
    this.drawCursor(ctx);
    ctx.restore();
    this.drawHUD(ctx, canvas.width, canvas.height);
  }

  drawEditorMarkers(ctx) {
    const { tileSize } = this.game.world;
    if (this.game.world.elevatorPaths?.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,220,255,0.7)';
      ctx.lineWidth = 2;
      this.game.world.elevatorPaths.forEach((path) => {
        const cx = path.x * tileSize + tileSize / 2;
        const cy = path.y * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy);
        ctx.lineTo(cx + 6, cy);
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx, cy + 6);
        ctx.stroke();
      });
      ctx.restore();
    }
    if (this.game.world.elevators?.length) {
      ctx.save();
      ctx.strokeStyle = '#ffd36a';
      ctx.lineWidth = 2;
      this.game.world.elevators.forEach((platform) => {
        const x = platform.x * tileSize + 6;
        const y = platform.y * tileSize + tileSize / 2 - 6;
        ctx.strokeRect(x, y, tileSize - 12, 12);
      });
      ctx.restore();
    }
    const zones = this.game.world.musicZones || [];
    const showMusicZones = this.getActivePanelTab() === 'music';
    if (showMusicZones && zones.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(120, 200, 255, 0.18)';
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.font = '12px Courier New';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      zones.forEach((zone) => {
        const [x, y, w, h] = zone.rect;
        const px = x * tileSize;
        const py = y * tileSize;
        const pw = w * tileSize;
        const ph = h * tileSize;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(px, py, pw, ph);
        if (zone.track) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(this.getMusicTrackLabel(zone.track), px + 6, py + 6);
          ctx.fillStyle = 'rgba(120, 200, 255, 0.18)';
        }
      });
      ctx.restore();
    }

    const triggers = this.game.world.triggers || [];
    if (triggers.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 180, 80, 0.14)';
      ctx.strokeStyle = 'rgba(255, 180, 80, 0.9)';
      ctx.lineWidth = 2;
      triggers.forEach((trigger, index) => {
        const [x, y, w, h] = trigger.rect;
        const px = x * tileSize;
        const py = y * tileSize;
        const pw = w * tileSize;
        const ph = h * tileSize;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(px, py, pw, ph);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(`Trigger ${index + 1}`, px + 6, py + 6);
        ctx.fillStyle = 'rgba(255, 180, 80, 0.14)';
      });
      ctx.restore();
    }
    if (this.triggerZoneStart && this.triggerZoneTarget) {
      const minX = Math.min(this.triggerZoneStart.x, this.triggerZoneTarget.x);
      const minY = Math.min(this.triggerZoneStart.y, this.triggerZoneTarget.y);
      const maxX = Math.max(this.triggerZoneStart.x, this.triggerZoneTarget.x);
      const maxY = Math.max(this.triggerZoneStart.y, this.triggerZoneTarget.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,180,80,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(minX * tileSize, minY * tileSize, (maxX - minX + 1) * tileSize, (maxY - minY + 1) * tileSize);
      ctx.restore();
    }

    if (showMusicZones && this.musicDragStart && this.musicDragTarget) {
      const minX = Math.min(this.musicDragStart.x, this.musicDragTarget.x);
      const minY = Math.min(this.musicDragStart.y, this.musicDragTarget.y);
      const maxX = Math.max(this.musicDragStart.x, this.musicDragTarget.x);
      const maxY = Math.max(this.musicDragStart.y, this.musicDragTarget.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        minX * tileSize,
        minY * tileSize,
        (maxX - minX + 1) * tileSize,
        (maxY - minY + 1) * tileSize
      );
      ctx.restore();
    }
    for (let y = 0; y < this.game.world.height; y += 1) {
      for (let x = 0; x < this.game.world.width; x += 1) {
        const tile = this.game.world.getTile(x, y);
        const cx = x * tileSize + tileSize / 2;
        const cy = y * tileSize + tileSize / 2;
        if (tile === 'S') {
          ctx.strokeStyle = '#6cf';
          ctx.strokeRect(cx - 8, cy - 16, 16, 18);
        }
        if (tile === '$') {
          ctx.strokeStyle = '#9f6';
          ctx.beginPath();
          ctx.arc(cx, cy - 6, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (tile === 'O') {
          ctx.strokeStyle = '#ffb84d';
          ctx.beginPath();
          ctx.arc(cx, cy - 4, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (tile === 'a') {
          ctx.strokeStyle = '#6cf';
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, cy - 6);
          ctx.lineTo(cx, cy + 6);
          ctx.stroke();
        }
        if (['g', 'p', 'm', 'r', 'i'].includes(tile)) {
          ctx.fillStyle = '#fff';
          ctx.font = '12px Courier New';
          ctx.textAlign = 'center';
          ctx.fillText(tile.toUpperCase(), cx, cy + 4);
        }
        if (tile === 'Z') {
          ctx.fillStyle = '#fff';
          ctx.font = '12px Courier New';
          ctx.textAlign = 'center';
          ctx.fillText('H', cx, cy + 4);
        }
      }
    }

    this.game.world.enemies.forEach((enemy) => {
      const cx = enemy.x * tileSize + tileSize / 2;
      const cy = enemy.y * tileSize + tileSize / 2;
      const marker = ENEMY_TYPES.find((entry) => entry.id === enemy.type);
      const isBoss = BOSS_ENEMY_TYPES.some((entry) => entry.id === enemy.type);
      const color = isBoss ? '#ffb3d6' : '#f66';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.strokeRect(cx - 10, cy - 10, 20, 20);
      ctx.fillStyle = color;
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(marker?.glyph || 'EN', cx, cy + 4);
      ctx.restore();
    });

    const spawn = this.game.world.spawn;
    if (spawn) {
      ctx.save();
      ctx.strokeStyle = '#ff6';
      ctx.lineWidth = 2;
      ctx.strokeRect(spawn.x * tileSize + 6, spawn.y * tileSize + 6, tileSize - 12, tileSize - 12);
      ctx.beginPath();
      ctx.moveTo(spawn.x * tileSize + tileSize / 2, spawn.y * tileSize + 6);
      ctx.lineTo(spawn.x * tileSize + tileSize / 2, spawn.y * tileSize + tileSize - 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGrid(ctx) {
    const tileSize = this.game.world.tileSize;
    ctx.save();
    const glow = this.dragging || this.radialMenu.active;
    ctx.strokeStyle = glow ? 'rgba(120,200,255,0.2)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = glow ? 1.4 : 1;
    if (glow) {
      ctx.shadowColor = 'rgba(120,200,255,0.35)';
      ctx.shadowBlur = 8;
    }
    for (let x = 0; x <= this.game.world.width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize, 0);
      ctx.lineTo(x * tileSize, this.game.world.height * tileSize);
      ctx.stroke();
    }
    for (let y = 0; y <= this.game.world.height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileSize);
      ctx.lineTo(this.game.world.width * tileSize, y * tileSize);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCursor(ctx) {
    if (!this.hoverTile) return;
    const tileSize = this.game.world.tileSize;
    const getTilePreviewChar = (tile) => (tile?.id === 'hidden-path' ? 'H' : tile?.char);
    const drawHighlight = (tileX, tileY, color) => {
      if (!this.isInBounds(tileX, tileY)) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(tileX * tileSize, tileY * tileSize, tileSize, tileSize);
      ctx.restore();
    };

    if (this.dragMode === 'move' && this.moveSelection && this.moveTarget) {
      drawHighlight(this.moveSelection.origin.x, this.moveSelection.origin.y, '#f66');
      drawHighlight(this.moveTarget.x, this.moveTarget.y, '#6f6');
      return;
    }

    const drawGhostTiles = (tiles, color) => {
      ctx.save();
      ctx.fillStyle = color;
      tiles.forEach((tile) => {
        if (!this.isInBounds(tile.x, tile.y)) return;
        ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
      });
      ctx.restore();
    };

    if (this.mode === 'shape' || this.mode === 'prefab') {
      const previewStart = this.dragStart || { x: this.hoverTile.x, y: this.hoverTile.y };
      const previewEnd = this.dragTarget || { x: this.hoverTile.x, y: this.hoverTile.y };
      const previewTiles = this.mode === 'shape'
        ? this.buildShapeTiles(previewStart, previewEnd, this.tileType.char || '.')
        : this.buildPrefabTiles(previewStart, previewEnd);
      const prefabPreviewTiles = Array.isArray(previewTiles)
        ? previewTiles
        : [
          ...previewTiles.tiles,
          ...previewTiles.elevatorPaths.map((tile) => ({ ...tile, char: '.' })),
          ...previewTiles.elevators.map((tile) => ({ ...tile, char: '.' }))
        ];
      const previewColor = this.mode === 'shape'
        ? 'rgba(100,200,255,0.2)'
        : 'rgba(190,170,255,0.2)';
      drawGhostTiles(prefabPreviewTiles, previewColor);
    }

    const ghostX = this.hoverTile.x * tileSize;
    const ghostY = this.hoverTile.y * tileSize;
    ctx.save();
    if (this.mode === 'tile' && this.tileTool === 'erase') {
      ctx.fillStyle = 'rgba(255,80,80,0.25)';
      ctx.fillRect(ghostX, ghostY, tileSize, tileSize);
    } else if (this.mode === 'enemy') {
      ctx.fillStyle = 'rgba(255,120,120,0.18)';
      ctx.fillRect(ghostX, ghostY, tileSize, tileSize);
      ctx.fillStyle = 'rgba(255,180,180,0.85)';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(this.enemyType?.glyph || 'EN', ghostX + tileSize / 2, ghostY + tileSize / 2 + 4);
    } else if (this.mode === 'tile') {
      ctx.fillStyle = 'rgba(140,200,255,0.2)';
      ctx.fillRect(ghostX, ghostY, tileSize, tileSize);
      if (this.tileType.special === 'elevator-path') {
        ctx.strokeStyle = 'rgba(180,240,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ghostX + tileSize / 2 - 6, ghostY + tileSize / 2);
        ctx.lineTo(ghostX + tileSize / 2 + 6, ghostY + tileSize / 2);
        ctx.moveTo(ghostX + tileSize / 2, ghostY + tileSize / 2 - 6);
        ctx.lineTo(ghostX + tileSize / 2, ghostY + tileSize / 2 + 6);
        ctx.stroke();
      } else if (this.tileType.special === 'elevator-platform') {
        ctx.strokeStyle = 'rgba(255,220,140,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ghostX + 6, ghostY + tileSize / 2 - 6, tileSize - 12, 12);
      } else if (this.tileType.char) {
        const previewChar = getTilePreviewChar(this.tileType);
        ctx.fillStyle = 'rgba(220,240,255,0.8)';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(previewChar.toUpperCase(), ghostX + tileSize / 2, ghostY + tileSize / 2 + 4);
      }
    }
    ctx.restore();

    const color = this.mode === 'tile' && this.tileTool === 'erase'
      ? '#ff6b6b'
      : this.mode === 'enemy'
        ? '#ff9a9a'
        : this.mode === 'prefab'
          ? '#bba8ff'
          : this.mode === 'shape'
            ? '#7fd9ff'
            : '#ffffff';
    drawHighlight(this.hoverTile.x, this.hoverTile.y, color);
  }

  drawHUD(ctx, width, height) {
    const tileSize = this.game.world.tileSize;
    const tileLabel = this.tileType.label || 'Unknown';
    const modeLabel = MODE_LABELS[this.mode] || 'Tile';
    const tileToolLabel = TILE_TOOL_LABELS[this.tileTool] || 'Paint';
    const enemyLabel = this.enemyType?.label || 'Enemy';
    const prefabLabel = this.prefabType?.label || 'Prefab';
    const shapeLabel = this.shapeTool?.label || 'Shape';
    const tileToolButtons = [
      { id: 'paint', label: 'Paint', tooltip: 'Paint tiles. (Q)' },
      { id: 'erase', label: 'Erase', tooltip: 'Erase tiles. (E)' },
      { id: 'move', label: 'Move', tooltip: 'Move items or pan. (M)' }
    ];
    let infoPanelBottom = 12;
    ctx.save();
    ctx.font = '13px Courier New';
    ctx.textAlign = 'left';
    this.uiButtons = [];
    this.pixelPaletteBounds = [];
    this.pixelGridBounds = null;
    this.pixelFrameBounds = null;
    this.midiGridBounds = null;
    this.midiNoteBounds = [];
    this.midiInstrumentScrollBounds = null;
    let hoverTooltip = '';
    const pointer = this.lastPointer;
    this.randomLevelSlider.bounds.width = null;
    this.randomLevelSlider.bounds.height = null;

    const isHovered = (x, y, w, h) => (
      pointer && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h
    );

    const drawTilePreview = (x, y, size, tile) => {
      const char = tile?.id === 'hidden-path' ? 'H' : tile?.char;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(x, y, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, size, size);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      if (tile?.special === 'spawn') {
        ctx.strokeStyle = '#ff6';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
        ctx.beginPath();
        ctx.moveTo(centerX, y + 4);
        ctx.lineTo(centerX, y + size - 4);
        ctx.stroke();
      } else if (tile?.special === 'elevator-path') {
        ctx.strokeStyle = 'rgba(140,220,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - size * 0.25, centerY);
        ctx.lineTo(centerX + size * 0.25, centerY);
        ctx.moveTo(centerX, centerY - size * 0.25);
        ctx.lineTo(centerX, centerY + size * 0.25);
        ctx.stroke();
      } else if (tile?.special === 'elevator-platform') {
        ctx.strokeStyle = 'rgba(255,220,140,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, centerY - size * 0.15, size - 8, size * 0.3);
      } else if (char === '#') {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      } else if (char === '^') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + size - 2);
        ctx.lineTo(x + size - 2, y + size - 2);
        ctx.lineTo(x + size - 2, y + 2);
        ctx.closePath();
        ctx.fill();
      } else if (char === 'v') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + 2, y + size - 2);
        ctx.lineTo(x + size - 2, y + size - 2);
        ctx.closePath();
        ctx.fill();
      } else if (char === '=' || char === 's') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 3, centerY);
        ctx.lineTo(x + size - 3, centerY);
        ctx.stroke();
      } else if (char === 'e') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(centerX, y + 4);
        ctx.lineTo(centerX, y + size - 4);
        ctx.stroke();
      } else if (char === '~' || char === 'A' || char === 'L') {
        ctx.fillStyle = char === '~' ? '#3b9fe0' : char === 'A' ? '#36c777' : '#f25a42';
        ctx.fillRect(x + 2, y + size / 2, size - 4, size / 2 - 2);
      } else if (char === '*' || char === '!') {
        ctx.strokeStyle = char === '!' ? '#c98bff' : '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + size - 4);
        ctx.lineTo(centerX, y + size / 2);
        ctx.lineTo(x + size - 4, y + size - 4);
        ctx.stroke();
      } else if (char === 'I') {
        ctx.fillStyle = '#8fd6ff';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      } else if (char === 'E') {
        ctx.fillStyle = '#d6b06d';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.strokeStyle = '#b58b4a';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
      } else if (char === 'Q') {
        ctx.fillStyle = '#6b2bbd';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.strokeStyle = '#4c1f8a';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
      } else if (char === 'J' || char === 'G' || char === 'V') {
        ctx.fillStyle = char === 'J' ? '#4fb7ff' : char === 'G' ? '#4bd47e' : '#b35cff';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + size - 6);
        ctx.lineTo(x + size - 6, y + 4);
        ctx.stroke();
      } else if (char === 'N') {
        ctx.fillStyle = '#e4f4ff';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.strokeStyle = '#9ad9ff';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + size - 6);
        ctx.lineTo(x + size - 6, y + 4);
        ctx.stroke();
      } else if (char === 'P') {
        ctx.fillStyle = '#8c92a8';
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.strokeStyle = '#5e6270';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
      } else if (char === '<' || char === '>') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        if (char === '<') {
          ctx.moveTo(x + size - 4, centerY);
          ctx.lineTo(x + 4, centerY);
          ctx.lineTo(x + 8, centerY - 4);
          ctx.moveTo(x + 4, centerY);
          ctx.lineTo(x + 8, centerY + 4);
        } else {
          ctx.moveTo(x + 4, centerY);
          ctx.lineTo(x + size - 4, centerY);
          ctx.lineTo(x + size - 8, centerY - 4);
          ctx.moveTo(x + size - 4, centerY);
          ctx.lineTo(x + size - 8, centerY + 4);
        }
        ctx.stroke();
      } else if (char === 'D') {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
        ctx.beginPath();
        ctx.moveTo(centerX, y + 5);
        ctx.lineTo(centerX, y + size - 5);
        ctx.stroke();
      } else if (char === 'a') {
        ctx.strokeStyle = '#6cf';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size * 0.18);
        ctx.lineTo(centerX, centerY + size * 0.18);
        ctx.stroke();
      } else if (char === 'i') {
        ctx.fillStyle = 'rgba(90, 190, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.32, 0, Math.PI * 2);
        ctx.stroke();
      } else if (char) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.toUpperCase(), centerX, centerY + 1);
      }
      ctx.restore();
    };

    const drawPrefabPreview = (x, y, size, prefab) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(x, y, size, size);
      ctx.fillStyle = 'rgba(180,180,255,0.12)';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#fff';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prefab?.short || prefab?.label?.slice(0, 2) || 'PR', x + size / 2, y + size / 2);
      ctx.restore();
    };

    const drawEnemyPreview = (x, y, size, enemy) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 120, 120, 0.18)';
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = 'rgba(255, 140, 140, 0.8)';
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
      ctx.fillStyle = '#ffbfbf';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(enemy?.glyph || 'EN', x + size / 2, y + size / 2 + 1);
      ctx.restore();
    };

    const drawButton = (x, y, w, h, label, active, onClick, tooltip = '', preview = null, focused = false) => {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = active ? 'rgba(255,225,106,0.7)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(x, y, w, h);
      if (focused) {
        ctx.save();
        ctx.strokeStyle = '#9ad9ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        ctx.restore();
      }
      ctx.fillStyle = active ? '#0b0b0b' : '#fff';
      ctx.save();
      ctx.textBaseline = 'middle';
      const previewSize = preview ? Math.min(22, h - 8) : 0;
      const previewX = x + 8;
      const previewY = y + (h - previewSize) / 2;
      if (preview?.type === 'tile') {
        drawTilePreview(previewX, previewY, previewSize, preview.tile);
      } else if (preview?.type === 'prefab') {
        drawPrefabPreview(previewX, previewY, previewSize, preview.prefab);
      } else if (preview?.type === 'enemy') {
        drawEnemyPreview(previewX, previewY, previewSize, preview.enemy);
      }
      const textOffset = preview ? previewSize + 14 : 8;
      ctx.fillText(formatMenuLabel(label), x + textOffset, y + h / 2);
      ctx.restore();
      this.addUIButton({ x, y, w, h }, onClick, tooltip);
      if (tooltip && !this.isMobileLayout() && isHovered(x, y, w, h)) {
        hoverTooltip = tooltip;
      }
    };

    const drawSlider = (x, y, w, label, value, min, max, kind, active = false) => {
      const clampedValue = clamp(value, min, max);
      const t = max === min ? 0 : (clampedValue - min) / (max - min);
      const h = 10;
      const knobX = x + t * w;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = active ? 'rgba(18,60,90,0.8)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(knobX, y + h / 2, h * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${label}: ${Math.round(clampedValue)}`, x, y - 4);
      ctx.restore();
      this.randomLevelSlider.bounds[kind] = { x, y: y - 16, w, h: h + 26, min, max };
    };

    const wrapText = (text, maxWidth) => {
      const words = text.split(' ');
      const lines = [];
      let line = '';
      words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      });
      if (line) lines.push(line);
      return lines;
    };

    const controlMargin = 18;
    const controlBase = Math.min(width, height);
    let joystickRadius = 0;
    let knobRadius = 0;
    let joystickCenter = { x: 0, y: 0 };
    let sliderX = 0;
    let sliderWidth = 0;
    const sliderHeight = 10;
    let sliderY = height;

    if (this.isMobileLayout()) {
      joystickRadius = Math.min(78, controlBase * 0.14);
      knobRadius = Math.max(22, joystickRadius * 0.45);
      joystickCenter = {
        x: controlMargin + joystickRadius,
        y: height - controlMargin - joystickRadius
      };
      this.panJoystick.center = joystickCenter;
      this.panJoystick.radius = joystickRadius;
      this.panJoystick.knobRadius = knobRadius;

      sliderX = joystickCenter.x + joystickRadius + 24;
      sliderWidth = width - sliderX - controlMargin;
      sliderY = height - controlMargin - sliderHeight;
      if (sliderWidth < 160) {
        sliderX = controlMargin;
        sliderWidth = width - controlMargin * 2;
      }
      this.zoomSlider.bounds = {
        x: sliderX,
        y: sliderY - 14,
        w: sliderWidth,
        h: sliderHeight + 28
      };
    } else {
      this.panJoystick.center = { x: 0, y: 0 };
      this.panJoystick.radius = 0;
      this.panJoystick.knobRadius = 0;
      this.zoomSlider.bounds = { x: 0, y: 0, w: 0, h: 0 };
    }

    if (this.isMobileLayout()) {
      const drawerWidth = Math.min(UI_SUITE.layout.leftMenuWidthDesktop, Math.max(UI_SUITE.layout.railWidthMobile + 96, width - 120));
      const collapsedWidth = UI_SUITE.layout.railWidthMobile;
      const panelW = this.drawer.open ? drawerWidth : collapsedWidth;
      const panelX = 0;
      const panelY = 0;
      const panelH = height;
      this.editorBounds = { x: panelW, y: 0, w: width - panelW, h: height };
      this.drawerBounds = { x: panelX, y: panelY, w: panelW, h: panelH };
      ctx.globalAlpha = 1;
      ctx.fillStyle = UI_SUITE.colors.panel;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      const handleAreaH = 34;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(panelX, panelY, panelW, handleAreaH);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(panelX + panelW / 2 - 18, panelY + 10, 36, 4);
      this.addUIButton(
        { x: panelX, y: panelY, w: panelW, h: handleAreaH },
        () => {
          this.drawer.open = !this.drawer.open;
        },
        this.drawer.open ? 'Collapse drawer' : 'Expand drawer'
      );

      if (!this.drawer.open) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        let summary = `${modeLabel}`;
        if (this.mode === 'tile') {
          summary = `${modeLabel} (${tileToolLabel})`;
        } else if (this.mode === 'enemy') {
          summary = `${modeLabel}`;
        } else if (this.mode === 'prefab') {
          summary = `${modeLabel}`;
        } else if (this.mode === 'shape') {
          summary = `${modeLabel}`;
        }
        ctx.fillText(summary, panelW / 2, panelY + 46);
      } else {
        const tabs = [
          { id: 'file', label: 'File' },
          { id: 'toolbox', label: 'Toolbox' },
          { id: 'tiles', label: 'Tiles' },
          { id: 'triggers', label: 'Triggers' },
          { id: 'powerups', label: 'Powerups' },
          { id: 'enemies', label: 'Enemies' },
          { id: 'bosses', label: 'Bosses' },
          { id: 'prefabs', label: 'Structures' },
          { id: 'music', label: 'Music' }
        ];
        const activeTab = this.getActivePanelTab();
        const panelPadding = 10;
        const tabColumnW = Math.max(92, Math.min(124, Math.floor(panelW * 0.32)));
        const tabX = panelX + panelPadding;
        const tabY = panelY + handleAreaH + 8;
        const tabW = tabColumnW - panelPadding * 1.5;
        const tabButtonH = 36;
        const tabGap = 8;
        ctx.font = `14px ${UI_SUITE.font.family}`;
        tabs.forEach((tab, index) => {
          const y = tabY + index * (tabButtonH + tabGap);
          drawButton(
            tabX,
            y,
            tabW,
            tabButtonH,
            tab.label,
            activeTab === tab.id,
            () => this.setPanelTab(tab.id),
            `${tab.label} drawer`
          );
        });

        const contentX = panelX + tabColumnW + 6;
        const contentW = panelW - tabColumnW - panelPadding - 6;
        const baseContentY = tabY;
        let contentY = baseContentY;
        const reservedBottom = joystickRadius * 2 + 32;
        let contentHeight = Math.max(0, panelY + panelH - contentY - reservedBottom);
        const isPreviewTab = activeTab === 'tiles'
          || activeTab === 'prefabs'
          || activeTab === 'powerups'
          || activeTab === 'enemies'
          || activeTab === 'bosses';
        const buttonHeight = isPreviewTab ? 60 : 52;
        const buttonGap = 10;
        const contentPadding = 10;
        let items = [];
        let columns = 1;
        const spawnTile = DEFAULT_TILE_TYPES.find((tile) => tile.special === 'spawn');

        if (activeTab === 'playtest') {
          items = [{
            id: 'playtest',
            label: 'Playtest',
            active: false,
            tooltip: 'Start playtest from spawn',
            onClick: () => this.game.exitEditor({ playtest: true })
          }];
          columns = 1;
        } else if (activeTab === 'file') {
          items = [
            {
              id: 'new-level',
              label: 'New',
              active: false,
              tooltip: 'Create a new level',
              onClick: () => this.newLevelDocument()
            },
            {
              id: 'save-storage',
              label: 'Save',
              active: false,
              tooltip: 'Save level to browser storage',
              onClick: () => this.saveLevelToStorage()
            },
            {
              id: 'save-as-storage',
              label: 'Save As',
              active: false,
              tooltip: 'Save level with a new name',
              onClick: () => this.saveLevelToStorage({ forceSaveAs: true })
            },
            {
              id: 'load-storage',
              label: 'Open',
              active: false,
              tooltip: 'Open level from browser storage',
              onClick: () => this.loadLevelFromStorage()
            },
            {
              id: 'resize-level',
              label: 'Resize',
              active: false,
              tooltip: 'Resize level canvas',
              onClick: () => this.resizeLevelDocument()
            },
            { id: 'divider-1', divider: true },
            {
              id: 'export-json',
              label: 'Export',
              active: false,
              tooltip: 'Export world JSON',
              onClick: () => this.saveToFile()
            },
            {
              id: 'import-json',
              label: 'Import',
              active: false,
              tooltip: 'Import world JSON',
              onClick: () => this.openFileDialog()
            },
            { id: 'divider-2', divider: true },
            {
              id: 'undo',
              label: 'Undo',
              active: false,
              tooltip: 'Undo last change (Ctrl+Z)',
              onClick: () => this.undo()
            },
            {
              id: 'redo',
              label: 'Redo',
              active: false,
              tooltip: 'Redo last change (Ctrl+Y)',
              onClick: () => this.redo()
            },
            { id: 'divider-3', divider: true },
            {
              id: 'playtest',
              label: 'Playtest',
              active: false,
              tooltip: 'Start playtest from spawn',
              onClick: () => this.game.exitEditor({ playtest: true })
            },
            ...(spawnTile
              ? [{
                id: 'spawn-point',
                label: 'Spawn point',
                active: this.tileType?.special === 'spawn',
                tooltip: 'Place the player spawn point',
                onClick: () => {
                  this.setTileType(spawnTile);
                  this.mode = 'tile';
                  this.tileTool = 'paint';
                }
              }]
              : []),
            {
              id: 'start-everything',
              label: `Start with everything: ${this.startWithEverything ? 'On' : 'Off'}`,
              active: false,
              tooltip: 'Toggle playtest loadout',
              onClick: () => {
                this.startWithEverything = !this.startWithEverything;
              }
            },
            {
              id: 'random-level',
              label: 'Random level',
              active: false,
              tooltip: 'Create a random level layout',
              onClick: () => this.promptRandomLevel()
            },
            { id: 'divider-4', divider: true },
            {
              id: 'close-menu',
              label: 'Close Menu',
              active: false,
              tooltip: 'Close file menu',
              onClick: () => this.closeFileMenu()
            },
            {
              id: 'exit-main',
              label: 'Exit to Main Menu',
              active: false,
              tooltip: 'Exit editor to title',
              onClick: () => this.exitToMainMenu()
            }
          ];
          columns = 1;
        } else if (activeTab === 'tiles') {
          items = DEFAULT_TILE_TYPES.map((tile) => ({
            id: tile.id,
            label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
            active: this.tileType.id === tile.id,
            preview: { type: 'tile', tile },
            tooltip: `Tile: ${tile.label}`,
            onClick: () => {
              this.setTileType(tile);
              this.mode = 'tile';
              this.tileTool = 'paint';
            }
          }));
          columns = 1;
        } else if (activeTab === 'toolbox') {
          items = [
            ...tileToolButtons.map((tool) => ({
              id: `tile-${tool.id}`,
              label: `${tool.label.toUpperCase()} TOOL`,
              active: this.tileTool === tool.id && this.mode === 'tile',
              tooltip: tool.tooltip,
              onClick: () => {
                this.mode = 'tile';
                this.tileTool = tool.id;
              }
            })),
            ...SHAPE_TOOLS.map((shape) => ({
              id: shape.id,
              label: shape.label,
              active: this.mode === 'shape' && this.shapeTool.id === shape.id,
              tooltip: `Shape: ${shape.label}`,
              onClick: () => {
                this.setShapeTool(shape);
                this.mode = 'shape';
              }
            }))
          ];
          columns = 1;
        } else if (activeTab === 'triggers') {
          const triggers = this.ensureTriggers();
          items = [
            {
              id: 'trigger-draw',
              label: 'DRAW TRIGGER ZONE',
              active: this.mode === 'trigger',
              tooltip: 'Draw a rectangle trigger zone',
              onClick: () => {
                this.mode = 'trigger';
              }
            },
            ...triggers.map((trigger, index) => ({
              id: trigger.id,
              label: `TRIGGER ${index + 1}`,
              active: this.selectedTriggerId === trigger.id,
              tooltip: trigger.condition,
              onClick: () => {
                this.selectedTriggerId = trigger.id;
                this.triggerEditorOpen = true;
                this.triggerEditorView = 'main';
                this.triggerActionDraft = null;
                this.triggerEditingActionId = null;
                this.mode = 'trigger';
              }
            }))
          ];
          columns = 1;
        } else if (activeTab === 'enemies' || activeTab === 'bosses') {
          const enemySource = activeTab === 'bosses'
            ? BOSS_ENEMY_TYPES
            : STANDARD_ENEMY_TYPES;
          items = enemySource.map((enemy) => ({
            id: enemy.id,
            label: `${enemy.label} [${enemy.glyph}]`,
            active: this.enemyType.id === enemy.id,
            preview: { type: 'enemy', enemy },
            tooltip: `Enemy: ${enemy.label}`,
            onClick: () => {
              this.setEnemyType(enemy);
              this.mode = 'enemy';
            }
          }));
          columns = 1;
        } else if (activeTab === 'powerups') {
          items = POWERUP_TYPES.map((powerup) => ({
            id: powerup.id,
            label: `${powerup.label} [${powerup.char.toUpperCase()}]`,
            active: this.tileType.id === powerup.id,
            preview: { type: 'tile', tile: powerup },
            tooltip: `Powerup: ${powerup.label}`,
            onClick: () => {
              this.setTileType(powerup);
              this.mode = 'tile';
              this.tileTool = 'paint';
            }
          }));
          columns = 1;
        } else if (activeTab === 'prefabs') {
          items = PREFAB_TYPES.map((prefab) => ({
            id: prefab.id,
            label: prefab.label,
            active: this.prefabType.id === prefab.id,
            preview: { type: 'prefab', prefab },
            tooltip: `Prefab: ${prefab.label}`,
            onClick: () => {
              this.setPrefabType(prefab);
              this.mode = 'prefab';
            }
          }));
          columns = 1;
        } else if (activeTab === 'pixels') {
          items = [
            {
              id: 'pixel-brush',
              label: 'PIXEL BRUSH',
              active: this.mode === 'pixel' && this.pixelTool === 'paint',
              tooltip: 'Paint pixels',
              onClick: () => {
                this.mode = 'pixel';
                this.pixelTool = 'paint';
              }
            },
            {
              id: 'pixel-erase',
              label: 'PIXEL ERASE',
              active: this.mode === 'pixel' && this.pixelTool === 'erase',
              tooltip: 'Erase pixels',
              onClick: () => {
                this.mode = 'pixel';
                this.pixelTool = 'erase';
                this.pixelColorIndex = 0;
              }
            },
            {
              id: 'pixel-prev-frame',
              label: 'PREV FRAME',
              active: false,
              tooltip: 'Previous frame',
              onClick: () => this.cyclePixelFrame(-1)
            },
            {
              id: 'pixel-next-frame',
              label: 'NEXT FRAME',
              active: false,
              tooltip: 'Next frame',
              onClick: () => this.cyclePixelFrame(1)
            },
            {
              id: 'pixel-add-frame',
              label: 'ADD FRAME',
              active: false,
              tooltip: 'Add frame',
              onClick: () => this.addPixelFrame()
            },
            {
              id: 'pixel-remove-frame',
              label: 'REMOVE FRAME',
              active: false,
              tooltip: 'Remove frame',
              onClick: () => this.removePixelFrame()
            }
          ];
          items.push(...DEFAULT_TILE_TYPES.filter((tile) => tile.char).map((tile) => ({
            id: tile.id,
            label: tile.char ? `${tile.label} [${tile.char}]` : tile.label,
            active: this.pixelTarget?.id === tile.id,
            preview: { type: 'tile', tile },
            tooltip: `Pixel target: ${tile.label}`,
            onClick: () => {
              this.pixelTarget = tile;
              this.mode = 'pixel';
            }
          })));
          columns = 1;
        } else if (activeTab === 'music') {
          const tracks = this.getMusicTracks();
          items = [
            {
              id: 'music-paint',
              label: 'ZONE PAINT',
              active: this.mode === 'music' && this.musicTool === 'paint',
              tooltip: 'Paint music zones',
              onClick: () => {
                this.mode = 'music';
                this.musicTool = 'paint';
              }
            },
            {
              id: 'music-erase',
              label: 'ZONE ERASE',
              active: this.mode === 'music' && this.musicTool === 'erase',
              tooltip: 'Erase music zones',
              onClick: () => {
                this.mode = 'music';
                this.musicTool = 'erase';
              }
            }
          ];
          items.push(...tracks.map((track) => ({
            id: track.id,
            label: track.name || track.label || track.id,
            active: this.musicTrack?.id === track.id,
            tooltip: `Music: ${track.name || track.label || track.id}`,
            onClick: () => {
              this.musicTrack = track;
              this.mode = 'music';
            }
          })));
          columns = 1;
        } else if (activeTab === 'midi') {
          const tracks = this.ensureMidiTracks();
          items = [
            {
              id: 'midi-add-track',
              label: 'ADD TRACK',
              active: false,
              tooltip: 'Add MIDI track',
              onClick: () => this.addMidiTrack()
            },
            {
              id: 'midi-remove-track',
              label: 'REMOVE TRACK',
              active: false,
              tooltip: 'Remove MIDI track',
              onClick: () => this.removeMidiTrack()
            }
          ];
          items.push(...tracks.map((track, index) => ({
            id: track.id,
            label: track.name || `Track ${index + 1}`,
            active: this.midiTrackIndex === index,
            tooltip: `Edit ${track.name || `Track ${index + 1}`}`,
            onClick: () => {
              this.midiTrackIndex = index;
              this.mode = 'midi';
            }
          })));
          columns = 1;
        } else {
          items = SHAPE_TOOLS.map((shape) => ({
            id: shape.id,
            label: shape.label,
            active: this.mode === 'shape' && this.shapeTool.id === shape.id,
            tooltip: `Shape: ${shape.label}`,
            onClick: () => {
              this.setShapeTool(shape);
              this.mode = 'shape';
            }
          }));
          columns = 1;
        }

        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(5,6,8,0.38)';
        ctx.fillRect(contentX, contentY, contentW, contentHeight);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeRect(contentX, contentY, contentW, contentHeight);

        const columnWidth = (contentW - contentPadding * 2 - buttonGap * (columns - 1)) / columns;
        const rows = Math.ceil(items.length / columns);
        const totalHeight = rows * (buttonHeight + buttonGap) - buttonGap + contentPadding * 2;
        const maxScroll = Math.max(0, totalHeight - contentHeight);
        this.panelScrollMax[activeTab] = maxScroll;
        const scrollY = clamp(this.panelScroll[activeTab] || 0, 0, maxScroll);
        this.panelScroll[activeTab] = scrollY;
        this.panelScrollBounds = { x: contentX, y: contentY, w: contentW, h: contentHeight };
        this.panelScrollView = {
          contentHeight,
          buttonHeight,
          buttonGap,
          columns,
          padding: contentPadding
        };
        const gamepadActive = this.game.input?.isGamepadConnected?.() ?? false;
        const focusedIndex = this.panelMenuIndex[activeTab] ?? 0;
        items.forEach((item, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const x = contentX + contentPadding + col * (columnWidth + buttonGap);
          const y = contentY + contentPadding + row * (buttonHeight + buttonGap) - scrollY;
          if (item.divider) {
            const dividerY = y + Math.max(8, Math.floor(buttonHeight * 0.5));
            if (dividerY >= contentY + 4 && dividerY <= contentY + contentHeight - 4) {
              ctx.strokeStyle = UI_SUITE.colors.border;
              ctx.beginPath();
              ctx.moveTo(x, dividerY);
              ctx.lineTo(x + columnWidth, dividerY);
              ctx.stroke();
            }
            return;
          }
          if (y + buttonHeight < contentY + 4 || y > contentY + contentHeight - 4) return;
          drawButton(
            x,
            y,
            columnWidth,
            buttonHeight,
            item.label,
            item.active,
            item.onClick,
            item.tooltip,
            item.preview,
            gamepadActive && index === focusedIndex
          );
        });

        if (activeTab === 'file') {
          const footerH = Math.max(28, buttonHeight);
          const footerY = contentY + contentHeight - footerH - 10;
          const footerGap = 8;
          const footerW = Math.floor((contentW - contentPadding * 2 - footerGap) / 2);
          drawButton(
            contentX + contentPadding,
            footerY,
            footerW,
            footerH,
            'Close Menu',
            false,
            () => this.closeFileMenu(),
            'Close file menu'
          );
          drawButton(
            contentX + contentPadding + footerW + footerGap,
            footerY,
            footerW,
            footerH,
            'Exit to Main Menu',
            false,
            () => this.exitToMainMenu(),
            'Exit editor to title'
          );
        }

      }
      if (!this.drawer.open) {
        this.panelScrollBounds = null;
        this.panelScrollView = null;
      }
    } else {
      this.editorBounds = { x: 0, y: 0, w: width, h: height };
      const panelWidth = 360;
      const panelX = width - panelWidth - 12;
      const panelY = 12;
      const panelH = height - 24;
      const tabs = [
        { id: 'tools', label: 'TOOLS' },
        { id: 'tiles', label: 'TILES' },
        { id: 'powerups', label: 'POWERUPS' },
        { id: 'enemies', label: 'ENEMIES' },
        { id: 'bosses', label: 'BOSSES' },
        { id: 'prefabs', label: 'STRUCTURES' },
        { id: 'shapes', label: 'SHAPES' },
        { id: 'music', label: 'MUSIC' }
      ];
      const tabMargin = 12;
      const tabGap = 6;
      const tabArrowW = 22;
      const tabArrowGap = 6;
      const tabHeight = 26;
      const tabRowW = panelWidth - tabMargin * 2 - (tabArrowW + tabArrowGap) * 2;
      const tabWidth = (tabRowW - tabGap * (tabs.length - 1)) / tabs.length;
      const tabY = panelY;
      const activeTab = this.getActivePanelTab();

      drawButton(
        panelX + tabMargin,
        tabY,
        tabArrowW,
        tabHeight,
        '◀',
        false,
        () => this.cyclePanelTab(-1),
        'Previous tab'
      );
      drawButton(
        panelX + panelWidth - tabMargin - tabArrowW,
        tabY,
        tabArrowW,
        tabHeight,
        '▶',
        false,
        () => this.cyclePanelTab(1),
        'Next tab'
      );
      tabs.forEach((tab, index) => {
        const x = panelX + tabMargin + tabArrowW + tabArrowGap + index * (tabWidth + tabGap);
        drawButton(
          x,
          tabY,
          tabWidth,
          tabHeight,
          tab.label,
          activeTab === tab.id,
          () => this.setPanelTab(tab.id),
          `${tab.label} panel`
        );
      });

      let contentY = tabY + tabHeight + 10;
      let contentHeight = Math.max(0, panelY + panelH - contentY);
      const contentX = panelX;
      const contentW = panelWidth;
      const contentPadding = 12;
      const buttonGap = 10;
      const isTallButtons = activeTab === 'tiles'
        || activeTab === 'prefabs'
        || activeTab === 'enemies'
        || activeTab === 'bosses';
      const buttonHeight = isTallButtons ? 40 : 32;
      const { items, columns } = this.getPanelConfig(activeTab);

      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(contentX, contentY, contentW, contentHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(contentX, contentY, contentW, contentHeight);

      const columnWidth = (contentW - contentPadding * 2 - buttonGap * (columns - 1)) / columns;
      const rows = Math.ceil(items.length / columns);
      const totalHeight = rows * (buttonHeight + buttonGap) - buttonGap + contentPadding * 2;
      const maxScroll = Math.max(0, totalHeight - contentHeight);
      this.panelScrollMax[activeTab] = maxScroll;
      const scrollY = clamp(this.panelScroll[activeTab] || 0, 0, maxScroll);
      this.panelScroll[activeTab] = scrollY;
      this.panelScrollBounds = { x: contentX, y: contentY, w: contentW, h: contentHeight };
      this.panelScrollView = {
        contentHeight,
        buttonHeight,
        buttonGap,
        columns,
        padding: contentPadding
      };

      const getActiveState = (item) => {
        if (activeTab === 'file') {
          if (item.id.startsWith('mode-')) {
            return this.mode === item.id.replace('mode-', '');
          }
          if (item.id.startsWith('tile-')) {
            return this.mode === 'tile' && this.tileTool === item.id.replace('tile-', '');
          }
          return false;
        }
        if (activeTab === 'tiles' || activeTab === 'powerups') return this.tileType.id === item.id;
        if (activeTab === 'enemies' || activeTab === 'bosses') return this.enemyType.id === item.id;
        if (activeTab === 'prefabs') return this.prefabType.id === item.id;
        if (activeTab === 'toolbox') {
          if (item.id?.startsWith('tile-')) {
            return this.mode === 'tile' && this.tileTool === item.id.replace('tile-', '');
          }
          return this.shapeTool.id === item.id;
        }
        if (activeTab === 'triggers') return this.selectedTriggerId === item.id;
        if (activeTab === 'pixels') {
          if (item.id === 'pixel-brush') return this.mode === 'pixel' && this.pixelTool === 'paint';
          if (item.id === 'pixel-erase') return this.mode === 'pixel' && this.pixelTool === 'erase';
          if (item.tile) return this.pixelTarget?.id === item.tile.id;
          return false;
        }
        if (activeTab === 'music') {
          if (item.id === 'music-paint') return this.mode === 'music' && this.musicTool === 'paint';
          if (item.id === 'music-erase') return this.mode === 'music' && this.musicTool === 'erase';
          if (item.track) return this.musicTrack?.id === item.track.id;
          return false;
        }
        if (activeTab === 'midi') {
          if (typeof item.trackIndex === 'number') {
            return this.midiTrackIndex === item.trackIndex;
          }
        }
        return false;
      };

      const gamepadActive = this.game.input?.isGamepadConnected?.() ?? false;
      const focusedIndex = this.panelMenuIndex[activeTab] ?? 0;
      items.forEach((item, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = contentX + contentPadding + col * (columnWidth + buttonGap);
        const y = contentY + contentPadding + row * (buttonHeight + buttonGap) - scrollY;
        if (y + buttonHeight < contentY + 4 || y > contentY + contentHeight - 4) return;
        const preview = item.tile
          ? { type: 'tile', tile: item.tile }
          : item.prefab
            ? { type: 'prefab', prefab: item.prefab }
            : item.enemy
              ? { type: 'enemy', enemy: item.enemy }
              : null;
        drawButton(
          x,
          y,
          columnWidth,
          buttonHeight,
          item.label,
          getActiveState(item),
          item.onClick,
          item.tooltip,
          preview,
          gamepadActive && index === focusedIndex
        );
      });

      if (activeTab === 'file') {
        const footerH = 30;
        const footerY = contentY + contentHeight - footerH - 10;
        const footerGap = 8;
        const footerW = Math.floor((contentW - contentPadding * 2 - footerGap) / 2);
        drawButton(
          contentX + contentPadding,
          footerY,
          footerW,
          footerH,
          'Close Menu',
          false,
          () => this.closeFileMenu(),
          'Close file menu'
        );
        drawButton(
          contentX + contentPadding + footerW + footerGap,
          footerY,
          footerW,
          footerH,
          'Exit to Main Menu',
          false,
          () => this.exitToMainMenu(),
          'Exit editor to title'
        );
      }

      const infoLines = [];
      if (infoLines.length > 0) {
      const infoHeight = infoLines.length * 18 + 12;
      ctx.globalAlpha = 0.85;
      const infoX = 12;
      const infoY = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(infoX, infoY, panelWidth, infoHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(infoX, infoY, panelWidth, infoHeight);
      ctx.fillStyle = '#fff';
      infoLines.forEach((line, index) => {
        ctx.fillText(line, infoX + 12, infoY + 22 + index * 18);
      });
      infoPanelBottom = infoY + infoHeight + 12;
      }
    }


    if (this.triggerEditorOpen) {
      const selected = this.getSelectedTrigger();
      if (selected) {
        const panelWidth = this.isMobileLayout() ? Math.min(width - 24, 440) : 420;
        const panelHeight = this.isMobileLayout() ? Math.min(height - 24, 620) : 560;
        const panelX = this.isMobileLayout() ? 12 : width - panelWidth - (this.isMobileLayout() ? 12 : 384);
        const panelY = 12;
        const levelNames = this.getTriggerLevelNames();
        const enemyOptions = [...STANDARD_ENEMY_TYPES, ...BOSS_ENEMY_TYPES].map((entry) => entry.id);
        const sectionButtonH = 40;
        const rowGap = 8;
        const draft = this.triggerActionDraft;

        ctx.save();
        ctx.fillStyle = 'rgba(15,18,22,0.95)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        ctx.strokeStyle = 'rgba(255,180,80,0.95)';
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        ctx.fillStyle = '#fff';
        ctx.font = '15px Courier New';
        ctx.fillText('Trigger Editor', panelX + 12, panelY + 22);

        let y = panelY + 36;
        if (this.triggerEditorView === 'main') {
          drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, 'Add Condition', false, () => { this.triggerEditorView = 'pick-condition'; }, 'Choose trigger condition');
          y += sectionButtonH + rowGap;
          drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, 'Add Action', false, () => { this.triggerEditorView = 'pick-action'; }, 'Add action to trigger');
          y += sectionButtonH + rowGap + 4;
          ctx.font = '12px Courier New';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText(`Condition: ${selected.condition}`, panelX + 12, y + 10);
          y += 16;
          ctx.fillText('Actions (tap to edit)', panelX + 12, y + 10);
          y += 14;
          selected.actions.forEach((action, index) => {
            const label = TRIGGER_ACTION_TYPES.find((entry) => entry.id === action.type)?.label || action.type;
            const rowY = y;
            const summary = this.formatTriggerActionSummary(action);
            drawButton(panelX + 12, rowY, panelWidth - 102, sectionButtonH, `${index + 1}. ${label}`, false, () => { this.openTriggerActionEditor(action, { isNew: false }); }, summary);
            drawButton(panelX + panelWidth - 84, rowY, 34, sectionButtonH, '↑', false, () => { if (index <= 0) return; const [moved] = selected.actions.splice(index, 1); selected.actions.splice(index - 1, 0, moved); this.persistAutosave(); }, 'Move action up');
            drawButton(panelX + panelWidth - 46, rowY, 34, sectionButtonH, 'X', false, () => { selected.actions.splice(index, 1); this.persistAutosave(); }, 'Delete action');
            y += sectionButtonH + 2;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(summary, panelX + 16, y + 9);
            y += 20;
          });
          const deleteY = panelY + panelHeight - 52;
          drawButton(panelX + 12, deleteY, panelWidth - 24, 40, 'Delete Trigger', false, () => {
            const triggers = this.ensureTriggers();
            const idx = triggers.findIndex((entry) => entry.id === selected.id);
            if (idx >= 0) {
              triggers.splice(idx, 1);
              this.selectedTriggerId = triggers[0]?.id || null;
              this.triggerEditorOpen = Boolean(this.selectedTriggerId);
              this.triggerEditorView = 'main';
              this.triggerActionDraft = null;
              this.triggerEditingActionId = null;
              this.persistAutosave();
            }
          }, 'Remove trigger zone');
        } else if (this.triggerEditorView === 'pick-condition') {
          drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, 'Back', false, () => { this.triggerEditorView = 'main'; }, 'Return to trigger');
          y += sectionButtonH + rowGap;
          TRIGGER_CONDITIONS.forEach((condition) => {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, condition, selected.condition === condition, () => { selected.condition = condition; this.triggerEditorView = 'main'; this.persistAutosave(); }, condition);
            y += sectionButtonH + 4;
          });
        } else if (this.triggerEditorView === 'pick-action') {
          drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, 'Back', false, () => { this.triggerEditorView = 'main'; }, 'Return to trigger');
          y += sectionButtonH + rowGap;
          TRIGGER_ACTION_TYPES.forEach((type) => {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, type.label, false, () => { this.openTriggerActionEditor(this.createTriggerAction(type.id), { isNew: true }); }, `Add action: ${type.label}`);
            y += sectionButtonH + 4;
          });
        } else if (this.triggerEditorView === 'edit-action' && draft) {
          const actionLabel = TRIGGER_ACTION_TYPES.find((entry) => entry.id === draft.type)?.label || draft.type;
          drawButton(panelX + 12, y, 110, sectionButtonH, 'Cancel', false, () => { this.triggerEditorView = 'main'; this.triggerActionDraft = null; this.triggerEditingActionId = null; }, 'Cancel editing');
          drawButton(panelX + panelWidth - 122, y, 110, sectionButtonH, 'OK', false, () => { this.commitTriggerActionDraft(selected); }, 'Save action');
          y += sectionButtonH + rowGap;
          ctx.font = '12px Courier New';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(`Action: ${actionLabel}`, panelX + 12, y + 10);
          y += 18;
          const numericRow = (label, key, step, min, max) => {
            drawButton(panelX + 12, y, 54, sectionButtonH, '-', false, () => { this.adjustTriggerActionParam(draft, key, -step, { min, max }); }, `${label} down`);
            drawButton(panelX + 70, y, panelWidth - 140, sectionButtonH, `${label}: ${draft.params[key] || 0}`, false, () => {}, label);
            drawButton(panelX + panelWidth - 66, y, 54, sectionButtonH, '+', false, () => { this.adjustTriggerActionParam(draft, key, step, { min, max }); }, `${label} up`);
            y += sectionButtonH + 4;
          };
          if (draft.type === 'load-level') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Level: ${draft.params.levelName || levelNames[0]}`, false, () => { draft.params.levelName = this.cycleOption(draft.params.levelName, levelNames, 1); }, 'Cycle level');
            y += sectionButtonH + 4;
          } else if (draft.type === 'spawn-enemy') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Enemy: ${draft.params.enemyType || enemyOptions[0]}`, false, () => { draft.params.enemyType = this.cycleOption(draft.params.enemyType, enemyOptions, 1); }, 'Cycle enemy');
            y += sectionButtonH + 4;
            numericRow('Offset X', 'offsetX', 1, -200, 200);
            numericRow('Offset Y', 'offsetY', 1, -200, 200);
          } else if (draft.type === 'heal-player' || draft.type === 'heal-enemy') {
            numericRow('Amount', 'amount', 1, 0, 99);
            if (draft.type === 'heal-enemy') {
              drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Target: ${draft.params.target || TRIGGER_ENEMY_TARGET_OPTIONS[0]}`, false, () => { draft.params.target = this.cycleOption(draft.params.target, TRIGGER_ENEMY_TARGET_OPTIONS, 1); }, 'Cycle target');
              y += sectionButtonH + 4;
            }
          } else if (draft.type === 'kill-enemy') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Target: ${draft.params.target || TRIGGER_ENEMY_TARGET_OPTIONS[0]}`, false, () => { draft.params.target = this.cycleOption(draft.params.target, TRIGGER_ENEMY_TARGET_OPTIONS, 1); }, 'Cycle target');
            y += sectionButtonH + 4;
          } else if (draft.type === 'save-game') {
            numericRow('Slot', 'slot', 1, 1, 9);
          } else if (draft.type === 'add-item') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Item: ${draft.params.itemId || TRIGGER_ITEM_OPTIONS[0]}`, false, () => { draft.params.itemId = this.cycleOption(draft.params.itemId, TRIGGER_ITEM_OPTIONS, 1); }, 'Cycle item');
            y += sectionButtonH + 4;
            numericRow('Quantity', 'quantity', 1, 1, 99);
          } else if (draft.type === 'play-animation') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Animation: ${draft.params.animationId || TRIGGER_ANIMATION_OPTIONS[0]}`, false, () => { draft.params.animationId = this.cycleOption(draft.params.animationId, TRIGGER_ANIMATION_OPTIONS, 1); }, 'Cycle animation');
            y += sectionButtonH + 4;
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Target: ${draft.params.target || 'zone'}`, false, () => { draft.params.target = this.cycleOption(draft.params.target, ['zone', ...TRIGGER_TARGET_OPTIONS], 1); }, 'Cycle target');
            y += sectionButtonH + 4;
          } else if (draft.type === 'move-entity') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Target: ${draft.params.target || TRIGGER_TARGET_OPTIONS[0]}`, false, () => { draft.params.target = this.cycleOption(draft.params.target, TRIGGER_TARGET_OPTIONS, 1); }, 'Cycle target');
            y += sectionButtonH + 4;
            numericRow('Delta X', 'dx', 1, -200, 200);
            numericRow('Delta Y', 'dy', 1, -200, 200);
          } else if (draft.type === 'display-text') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Text: ${draft.params.text || TRIGGER_TEXT_OPTIONS[0]}`, false, () => { draft.params.text = this.cycleOption(draft.params.text, TRIGGER_TEXT_OPTIONS, 1); }, 'Cycle text');
            y += sectionButtonH + 4;
            numericRow('Duration (ms)', 'durationMs', 100, 100, 15000);
          } else if (draft.type === 'wait' || draft.type === 'fade-in' || draft.type === 'fade-out' || draft.type === 'fade-out-music') {
            numericRow('Duration (ms)', 'durationMs', 100, 0, 15000);
          } else if (draft.type === 'fade-in-music') {
            drawButton(panelX + 12, y, panelWidth - 24, sectionButtonH, `Music: ${draft.params.musicId || MUSIC_TRACKS[0]?.id || 'ambient-rift'}`, false, () => { draft.params.musicId = this.cycleOption(draft.params.musicId, MUSIC_TRACKS.map((track) => track.id), 1); }, 'Cycle music track');
            y += sectionButtonH + 4;
            numericRow('Duration (ms)', 'durationMs', 100, 0, 15000);
          }
          if (this.triggerEditingActionId) {
            const deleteY = panelY + panelHeight - 52;
            drawButton(panelX + 12, deleteY, panelWidth - 24, 40, 'Delete Action', false, () => { this.deleteEditingTriggerAction(selected); }, 'Delete this action');
          }
        }
        ctx.restore();
      }
    }

    if (this.mode === 'pixel') {
      const panelWidth = 300;
      const panelX = this.isMobileLayout()
        ? this.editorBounds.x + this.editorBounds.w - panelWidth - 12
        : 12;
      const panelY = this.isMobileLayout()
        ? this.editorBounds.y + 12
        : infoPanelBottom;
      const panelPadding = 12;
      const panelHeight = 360;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'left';
      const targetLabel = this.pixelTarget?.label || 'Tile';
      const targetChar = this.pixelTarget?.char ? ` [${this.pixelTarget.char}]` : '';
      ctx.fillText(`Pixel Editor: ${targetLabel}${targetChar}`, panelX + panelPadding, panelY + 20);

      const pixelData = this.getPixelArtData(this.pixelTarget?.char);
      const size = pixelData?.size || PIXEL_GRID_SIZE;
      const frame = pixelData?.frames?.[this.pixelFrameIndex] || [];
      const cellSize = 12;
      const gridX = panelX + panelPadding;
      const gridY = panelY + 36;
      const gridSize = size * cellSize;
      this.pixelGridBounds = { x: gridX, y: gridY, cellSize, size };
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(gridX, gridY, gridSize, gridSize);
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const color = frame[row * size + col];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(gridX + col * cellSize, gridY + row * cellSize, cellSize, cellSize);
          }
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let row = 0; row <= size; row += 1) {
        ctx.beginPath();
        ctx.moveTo(gridX, gridY + row * cellSize);
        ctx.lineTo(gridX + gridSize, gridY + row * cellSize);
        ctx.stroke();
      }
      for (let col = 0; col <= size; col += 1) {
        ctx.beginPath();
        ctx.moveTo(gridX + col * cellSize, gridY);
        ctx.lineTo(gridX + col * cellSize, gridY + gridSize);
        ctx.stroke();
      }

      const paletteY = gridY + gridSize + 14;
      const paletteSize = 20;
      PIXEL_PALETTE.forEach((entry, index) => {
        const px = panelX + panelPadding + index * (paletteSize + 6);
        const py = paletteY;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(px, py, paletteSize, paletteSize);
        if (entry.color) {
          ctx.fillStyle = entry.color;
          ctx.fillRect(px + 2, py + 2, paletteSize - 4, paletteSize - 4);
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 4);
          ctx.lineTo(px + paletteSize - 4, py + paletteSize - 4);
          ctx.moveTo(px + paletteSize - 4, py + 4);
          ctx.lineTo(px + 4, py + paletteSize - 4);
          ctx.stroke();
        }
        if (this.pixelColorIndex === index) {
          ctx.strokeStyle = '#9ad9ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(px - 2, py - 2, paletteSize + 4, paletteSize + 4);
          ctx.lineWidth = 1;
        }
        this.pixelPaletteBounds.push({
          x: px,
          y: py,
          w: paletteSize,
          h: paletteSize,
          index,
          color: entry.color
        });
      });

      const frameY = paletteY + paletteSize + 14;
      drawButton(
        panelX + panelPadding,
        frameY,
        70,
        26,
        'Prev',
        false,
        () => this.cyclePixelFrame(-1),
        'Previous frame'
      );
      drawButton(
        panelX + panelPadding + 78,
        frameY,
        70,
        26,
        'Next',
        false,
        () => this.cyclePixelFrame(1),
        'Next frame'
      );
      drawButton(
        panelX + panelPadding + 156,
        frameY,
        60,
        26,
        '+Frm',
        false,
        () => this.addPixelFrame(),
        'Add frame'
      );
      drawButton(
        panelX + panelPadding + 222,
        frameY,
        60,
        26,
        '-Frm',
        false,
        () => this.removePixelFrame(),
        'Remove frame'
      );
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText(
        `Frame ${this.pixelFrameIndex + 1}/${pixelData?.frames?.length || 1} | FPS ${(pixelData?.fps || 6)}`,
        panelX + panelPadding,
        frameY + 48
      );
      drawButton(
        panelX + panelPadding + 200,
        frameY + 34,
        40,
        24,
        'FPS+',
        false,
        () => this.adjustPixelFps(1),
        'Increase FPS'
      );
      drawButton(
        panelX + panelPadding + 244,
        frameY + 34,
        40,
        24,
        'FPS-',
        false,
        () => this.adjustPixelFps(-1),
        'Decrease FPS'
      );
      ctx.restore();
    }

    if (this.mode === 'midi') {
      const track = this.getActiveMidiTrack();
      const panelWidth = 360;
      const panelX = this.isMobileLayout()
        ? this.editorBounds.x + 12
        : 12;
      const panelY = this.isMobileLayout()
        ? this.editorBounds.y + this.editorBounds.h - 300
        : infoPanelBottom;
      const instrumentColumns = 4;
      const instrumentButtonW = 80;
      const instrumentButtonH = 24;
      const instrumentButtonGap = 8;
      const instrumentRows = Math.ceil(MIDI_INSTRUMENTS.length / instrumentColumns);
      const instrumentRowHeight = instrumentButtonH + 6;
      const visibleInstrumentRows = Math.min(3, instrumentRows);
      const gridRows = 12;
      const gridCols = 16;
      const gridCellSize = 14;
      const gridH = gridRows * gridCellSize;
      const noteButtonH = 20;
      const noteButtonW = 60;
      const noteButtonGap = 6;
      const noteSectionHeight = 12 + noteButtonH + 6;
      const panelHeight = 120 + noteSectionHeight + visibleInstrumentRows * instrumentRowHeight + gridH;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(`MIDI Editor: ${track?.name || 'Track'}`, panelX + 12, panelY + 20);

      const controlX = panelX + panelWidth - 92;
      const controlButtonW = 80;
      const controlButtonH = 20;
      drawButton(
        controlX,
        panelY + 18,
        controlButtonW,
        controlButtonH,
        'LOAD',
        false,
        () => this.openMidiFilePicker(),
        'Load/replace MIDI tracks'
      );
      drawButton(
        controlX,
        panelY + 42,
        38,
        controlButtonH,
        '+Trk',
        false,
        () => this.addMidiTrack(),
        'Add track'
      );
      drawButton(
        controlX + 42,
        panelY + 42,
        38,
        controlButtonH,
        '-Trk',
        false,
        () => this.removeMidiTrack(),
        'Remove track'
      );
      const noteLabelY = panelY + 72;
      ctx.font = '12px Courier New';
      ctx.fillStyle = '#fff';
      ctx.fillText('Note Length:', panelX + 12, noteLabelY);
      const noteButtonsY = noteLabelY + 12;
      MIDI_NOTE_LENGTHS.forEach((entry, index) => {
        const col = index % 5;
        const x = panelX + 12 + col * (noteButtonW + noteButtonGap);
        drawButton(
          x,
          noteButtonsY,
          noteButtonW,
          noteButtonH,
          entry.label,
          this.midiNoteLength === entry.length,
          () => {
            this.midiNoteLength = entry.length;
          },
          `${entry.label} note`
        );
      });

      const instrumentLabel = MIDI_INSTRUMENTS.find((entry) => entry.id === track?.instrument)?.label || 'Instrument';
      const instrumentLabelY = noteButtonsY + noteButtonH + 12;
      ctx.fillText(`Instrument: ${instrumentLabel}`, panelX + 12, instrumentLabelY);
      const instrumentStartY = instrumentLabelY + 14;
      const visibleInstrumentHeight = visibleInstrumentRows * instrumentRowHeight;
      this.midiInstrumentScrollMax = Math.max(0, instrumentRows - visibleInstrumentRows);
      this.midiInstrumentScroll = clamp(this.midiInstrumentScroll, 0, this.midiInstrumentScrollMax);
      this.midiInstrumentScrollBounds = {
        x: panelX + 12,
        y: instrumentStartY,
        w: panelWidth - 24,
        h: visibleInstrumentHeight
      };
      MIDI_INSTRUMENTS.forEach((entry, index) => {
        const row = Math.floor(index / instrumentColumns);
        if (row < this.midiInstrumentScroll || row >= this.midiInstrumentScroll + visibleInstrumentRows) return;
        const col = index % instrumentColumns;
        const drawRow = row - this.midiInstrumentScroll;
        drawButton(
          panelX + 12 + col * (instrumentButtonW + instrumentButtonGap),
          instrumentStartY + drawRow * instrumentRowHeight,
          instrumentButtonW,
          instrumentButtonH,
          entry.label,
          track?.instrument === entry.id,
          () => {
            if (track) {
              track.instrument = entry.id;
              this.persistAutosave();
            }
          },
          `Set ${entry.label}`
        );
      });
      if (instrumentRows > visibleInstrumentRows) {
        const scrollButtonW = 28;
        drawButton(
          panelX + panelWidth - scrollButtonW - 10,
          instrumentStartY - 2,
          scrollButtonW,
          instrumentButtonH,
          '▲',
          false,
          () => {
            this.midiInstrumentScroll = clamp(this.midiInstrumentScroll - 1, 0, this.midiInstrumentScrollMax);
          },
          'Scroll instruments up'
        );
        drawButton(
          panelX + panelWidth - scrollButtonW - 10,
          instrumentStartY + visibleInstrumentHeight - instrumentButtonH + 2,
          scrollButtonW,
          instrumentButtonH,
          '▼',
          false,
          () => {
            this.midiInstrumentScroll = clamp(this.midiInstrumentScroll + 1, 0, this.midiInstrumentScrollMax);
          },
          'Scroll instruments down'
        );
      }

      const gridX = panelX + 12;
      const gridY = instrumentStartY + visibleInstrumentHeight + 10;
      const gridW = gridCols * gridCellSize;
      this.midiGridBounds = { x: gridX, y: gridY, cellSize: gridCellSize, rows: gridRows, cols: gridCols };
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(gridX, gridY, gridW, gridH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      for (let row = 0; row <= gridRows; row += 1) {
        ctx.beginPath();
        ctx.moveTo(gridX, gridY + row * gridCellSize);
        ctx.lineTo(gridX + gridW, gridY + row * gridCellSize);
        ctx.stroke();
      }
      for (let col = 0; col <= gridCols; col += 1) {
        ctx.beginPath();
        ctx.moveTo(gridX + col * gridCellSize, gridY);
        ctx.lineTo(gridX + col * gridCellSize, gridY + gridH);
        ctx.stroke();
      }
      if (track?.notes) {
        track.notes.forEach((note) => {
          const pitchOffset = note.pitch - 60;
          const row = gridRows - 1 - ((pitchOffset % gridRows + gridRows) % gridRows);
          const col = note.start % gridCols;
          const length = clamp(note.length || 1, 1, gridCols - col);
          ctx.fillStyle = 'rgba(120,200,255,0.7)';
          const noteX = gridX + col * gridCellSize + 1;
          const noteY = gridY + row * gridCellSize + 1;
          const noteW = length * gridCellSize - 2;
          const noteH = gridCellSize - 2;
          ctx.fillRect(noteX, noteY, noteW, noteH);
          this.midiNoteBounds.push({
            x: noteX,
            y: noteY,
            w: noteW,
            h: noteH,
            note
          });
        });
      }
      ctx.restore();
    }

    if (this.isMobileLayout()) {
      const zoomT = this.zoomToSliderT(this.zoom);
      const sliderKnobX = sliderX + zoomT * sliderWidth;
      const sliderCenterY = sliderY + sliderHeight / 2;
      const sliderKnobRadius = sliderHeight * 1.6;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sliderX, sliderCenterY - sliderHeight / 2, sliderWidth, sliderHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sliderX, sliderCenterY);
      ctx.lineTo(sliderX + sliderWidth, sliderCenterY);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sliderKnobX, sliderCenterY, sliderKnobRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
      ctx.restore();

      const joystickKnobX = joystickCenter.x + this.panJoystick.dx * joystickRadius;
      const joystickKnobY = joystickCenter.y + this.panJoystick.dy * joystickRadius;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(joystickCenter.x, joystickCenter.y, joystickRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(joystickKnobX, joystickKnobY, knobRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.stroke();
      ctx.restore();
    }

    if (this.randomLevelDialog.open) {
      const dialogW = Math.min(560, width * 0.9);
      const dialogH = 320;
      const dialogX = (width - dialogW) / 2;
      const dialogY = (height - dialogH) / 2;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(12,14,18,0.95)';
      ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const dialogTitle = this.randomLevelDialog.mode === 'new' ? 'New Level Size' : (this.randomLevelDialog.mode === 'resize' ? 'Resize Level' : 'Random Level Size');
      ctx.fillText(dialogTitle, dialogX + dialogW / 2, dialogY + 12);

      const sliderW = dialogW - 40;
      const sliderX = dialogX + 20;
      const sliderY = dialogY + 56;
      drawSlider(
        sliderX,
        sliderY,
        sliderW,
        'Width',
        this.randomLevelSize.width,
        24,
        256,
        'width',
        this.randomLevelDialog.focus === 'width'
      );
      drawSlider(
        sliderX,
        sliderY + 32,
        sliderW,
        'Height',
        this.randomLevelSize.height,
        24,
        256,
        'height',
        this.randomLevelDialog.focus === 'height'
      );


      const tickMin = 16;
      const tickMax = 256;
      const tickStep = 16;
      const drawSizeTicks = (y, kind) => {
        for (let value = tickMin; value <= tickMax; value += tickStep) {
          const t = (value - tickMin) / (tickMax - tickMin);
          const tx = sliderX + t * sliderW;
          const active = (kind === 'width' ? this.randomLevelSize.width : this.randomLevelSize.height) === value;
          ctx.strokeStyle = active ? '#ffe16a' : 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.moveTo(tx, y);
          ctx.lineTo(tx, y + (active ? 10 : 6));
          ctx.stroke();
          this.addUIButton({ x: tx - 6, y: y - 2, w: 12, h: 14 }, () => {
            if (kind === 'width') this.randomLevelSize.width = value;
            else this.randomLevelSize.height = value;
          }, `${kind} ${value}`);
        }
      };
      drawSizeTicks(sliderY + 12, 'width');
      drawSizeTicks(sliderY + 44, 'height');

      const presetStartY = sliderY + 66;
      const presetCols = 5;
      const presetGap = 8;
      const presetW = Math.floor((dialogW - 40 - presetGap * (presetCols - 1)) / presetCols);
      const presetH = 26;
      ROOM_SIZE_PRESETS.forEach(([rw, rh], index) => {
        const col = index % presetCols;
        const row = Math.floor(index / presetCols);
        const px = dialogX + 20 + col * (presetW + presetGap);
        const py = presetStartY + row * (presetH + 6);
        drawButton(
          px,
          py,
          presetW,
          presetH,
          `${rw}x${rh}`,
          false,
          () => this.setRandomLevelRoomPreset(rw, rh),
          `Set level to ${rw}x${rh} rooms`
        );
      });

      const buttonW = 120;
      const buttonH = 34;
      const buttonY = dialogY + dialogH - 42;
      drawButton(
        dialogX + dialogW / 2 - buttonW - 10,
        buttonY,
        buttonW,
        buttonH,
        'CANCEL',
        this.randomLevelDialog.focus === 'cancel',
        () => this.cancelRandomLevel(),
        'Cancel random level'
      );
      drawButton(
        dialogX + dialogW / 2 + 10,
        buttonY,
        buttonW,
        buttonH,
        'OK',
        this.randomLevelDialog.focus === 'ok',
        () => this.confirmRandomLevel(),
        'Generate random level'
      );
      if (this.game.input.isGamepadConnected()) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('A: OK   B: Cancel', dialogX + dialogW / 2, buttonY + buttonH + 6);
      }
      ctx.restore();
    }

    if (this.radialMenu.active && this.radialMenu.items.length > 0) {
      const centerX = this.radialMenu.x;
      const centerY = this.radialMenu.y;
      const radius = 86;
      const itemRadius = 26;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(10,12,14,0.9)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
      ctx.fill();
      const step = (Math.PI * 2) / this.radialMenu.items.length;
      this.radialMenu.items.forEach((item, index) => {
        const angle = -Math.PI / 2 + index * step;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        ctx.fillStyle = 'rgba(20,24,28,0.95)';
        ctx.beginPath();
        ctx.arc(x, y, itemRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, x, y + 1);
        this.addUIButton(
          { x: x - itemRadius, y: y - itemRadius, w: itemRadius * 2, h: itemRadius * 2 },
          () => {
            item.action();
            this.closeRadialMenu();
          },
          item.tooltip
        );
      });
      ctx.restore();
    }

    if (['pixel', 'music', 'midi'].includes(this.mode)) {
      const mapSize = this.isMobileLayout() ? 140 : 180;
      const mapX = this.editorBounds.x + this.editorBounds.w - mapSize - 16;
      const mapY = this.editorBounds.y + 16;
      const viewCenter = {
        x: this.camera.x + (this.editorBounds.w / 2) / this.zoom,
        y: this.camera.y + (this.editorBounds.h / 2) / this.zoom
      };
      ctx.save();
      ctx.font = '12px Courier New';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.textAlign = 'left';
      ctx.fillText('Preview', mapX, mapY - 6);
      this.previewMinimap.draw(ctx, mapX, mapY, mapSize, mapSize, viewCenter);
      ctx.restore();
    }

    const playSize = this.isMobileLayout() ? 58 : 52;
    const playPadding = 16;
    const playX = width - playSize - playPadding;
    const playY = this.editorBounds.y + this.editorBounds.h - playSize - playPadding;
    this.playButtonBounds = { x: playX, y: playY, w: playSize, h: playSize };
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(0,180,120,0.95)';
    ctx.beginPath();
    ctx.arc(playX + playSize / 2, playY + playSize / 2, playSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(playX + playSize * 0.42, playY + playSize * 0.34);
    ctx.lineTo(playX + playSize * 0.42, playY + playSize * 0.66);
    ctx.lineTo(playX + playSize * 0.7, playY + playSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const enemyInfo = this.enemyType?.description;
    const showEnemyInfo = enemyInfo && (this.getActivePanelTab() === 'enemies' || this.mode === 'enemy');
    if (showEnemyInfo) {
      ctx.save();
      const boxWidth = this.isMobileLayout()
        ? Math.min(260, this.editorBounds.w - 24)
        : 320;
      const boxX = this.isMobileLayout() ? this.editorBounds.x + 12 : 12;
      const maxTextWidth = boxWidth - 20;
      ctx.font = '12px Courier New';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const title = `${this.enemyType.label}`;
      const lines = wrapText(enemyInfo, maxTextWidth);
      const boxHeight = 18 + lines.length * 16 + 16;
      const tooltipHeight = this.isMobileLayout() ? 22 : 24;
      const maxY = this.isMobileLayout()
        ? this.editorBounds.y + 12
        : Math.max(12, ctx.canvas.height - boxHeight - tooltipHeight - 12);
      const boxY = maxY;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      ctx.fillStyle = '#fff';
      ctx.fillText(title, boxX + 10, boxY + 8);
      lines.forEach((line, index) => {
        ctx.fillText(line, boxX + 10, boxY + 26 + index * 16);
      });
      ctx.restore();
    }

    const tooltip = hoverTooltip || (this.tooltipTimer > 0 ? this.activeTooltip : '');
    const fallbackTooltip = `Mode: ${modeLabel} | Tile: ${tileLabel} | Enemy: ${enemyLabel} | Prefab: ${prefabLabel} | Shape: ${shapeLabel}`;
    const tooltipText = tooltip || fallbackTooltip;
    const tooltipHeight = this.isMobileLayout() ? 22 : 24;
    const baseTooltipY = this.isMobileLayout()
      ? this.editorBounds.y + this.editorBounds.h - tooltipHeight
      : height - tooltipHeight;
    const sliderSafeY = this.isMobileLayout()
      ? sliderY - tooltipHeight - 12
      : baseTooltipY;
    const tooltipY = Math.max(0, Math.min(baseTooltipY, sliderSafeY));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, tooltipY, width, tooltipHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(0, tooltipY, width, tooltipHeight);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(tooltipText, width / 2, tooltipY + tooltipHeight - 7);
    ctx.restore();
  }
}
