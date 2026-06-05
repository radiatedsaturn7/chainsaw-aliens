import { openProjectBrowser } from './ProjectBrowserModal.js';
import { ensureProjectFileIndex, listProjectFiles, loadProjectFile, saveProjectFile } from './projectFiles.js';
import { ACTOR_ATTACK_TARGETS, ACTION_TYPES, CONDITION_TYPES, createDefaultActor, createDefaultState, DEFAULT_TAXONOMIES, ensureActorDefinition, LOOT_ITEM_OPTIONS, MOVEMENT_BEHAVIORS, MOVEMENT_PRESET_TEMPLATES } from '../content/actorEditorData.js';
import { getSharedMobilePortraitEditorLayout, getSharedMobileRailWidth, SHARED_EDITOR_LEFT_MENU, UI_SUITE } from './uiSuite.js';
import { invalidateActorDefinitionCache } from '../entities/ScriptedActor.js';
import { EDITOR_INPUT_ACTIONS, EditorInputActionNormalizer, SHARED_EDITOR_GAMEPAD_BINDINGS, SHARED_EDITOR_GAMEPAD_HINTS } from './shared/input/editorInputActions.js';
import { ControllerMenuStack, buildControllerExitConfirmMenu, buildControllerHelpMenu, buildControllerSystemMenu, renderDomControllerMenu } from './shared/input/controllerMenuStack.js';

const ACTOR_FOLDER = 'actors';
const clone = (value) => JSON.parse(JSON.stringify(value));
const DEFAULT_ACTOR_SIZE = { width: 24, height: 24 };

export function buildActorPortraitMenuModel() {
  return {
    rootTabs: [
      { id: 'file', label: 'File' },
      { id: 'actor', label: 'Settings' },
      { id: 'states', label: 'States' },
      { id: 'tools', label: 'Tools' }
    ],
    bottomRailActions: ['menu', 'undo', 'redo', 'playtest'],
    primaryActionLabel: 'Play Scene'
  };
}

const readPngDataUrlDimensions = (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return null;
  try {
    const binary = atob(dataUrl.split(',', 2)[1] || '');
    if (binary.length < 24) return null;
    const readUint32 = (offset) => (
      ((binary.charCodeAt(offset) & 0xff) << 24)
      | ((binary.charCodeAt(offset + 1) & 0xff) << 16)
      | ((binary.charCodeAt(offset + 2) & 0xff) << 8)
      | (binary.charCodeAt(offset + 3) & 0xff)
    ) >>> 0;
    return { width: readUint32(16), height: readUint32(20) };
  } catch (error) {
    return null;
  }
};
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const toTitleLabel = (value) => String(value || '').split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
const STATE_OPTION_TYPE = 'state-option';
const LOOT_OPTION_TYPE = 'loot-option';
const MUSIC_OPTION_TYPE = 'music-option';
const SFX_OPTION_TYPE = 'sfx-option';
const PLAYER_INPUT_OPTIONS = [
  { id: 'attack', label: 'Attack' },
  { id: 'jump', label: 'Jump' },
  { id: 'action', label: 'Action' },
  { id: 'down', label: 'Down' }
];
const CONDITION_SPECS = {
  always: { label: 'Always', fields: [] },
  'timer-elapsed': { label: 'After X milliseconds', fields: [{ key: 'seconds', label: 'Milliseconds', type: 'number', min: 0, step: 10, defaultValue: 1000, toDisplay: (v) => Math.round(Number(v || 0) * 1000), fromDisplay: (v) => Number(v || 0) / 1000 }] },
  'actor-health-below': { label: 'My health is below', fields: [{ key: 'ratio', label: 'Health %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 50, toDisplay: (v) => Math.round(Number(v ?? 0.5) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'player-health-below': { label: 'Player health is below', fields: [{ key: 'ratio', label: 'Health %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 50, toDisplay: (v) => Math.round(Number(v ?? 0.5) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'can-see-player': { label: 'Can see player (aggro range)', fields: [] },
  'cannot-see-player': { label: 'Cannot see player (aggro range)', fields: [] },
  'player-within': { label: 'Player within distance', fields: [{ key: 'distance', label: 'Distance (px)', type: 'number', min: 0, step: 1, defaultValue: 160 }] },
  'player-farther-than': { label: 'Player farther than distance', fields: [{ key: 'distance', label: 'Distance (px)', type: 'number', min: 0, step: 1, defaultValue: 200 }] },
  'player-has-item': { label: 'Player has item', fields: [{ key: 'itemId', label: 'Item', type: LOOT_OPTION_TYPE, defaultValue: 'health' }] },
  'player-presses-action': { label: 'Player presses button', fields: [{ key: 'action', label: 'Button', type: 'select', options: PLAYER_INPUT_OPTIONS, defaultValue: 'action' }] },
  'touched-wall': { label: 'Touched wall', fields: [] },
  'touched-floor': { label: 'Touched floor', fields: [] },
  'touched-ceiling': { label: 'Touched ceiling', fields: [] },
  'took-damage': { label: 'I took damage', fields: [] },
  'damaged-player': { label: 'I damaged player', fields: [] },
  'is-dead': { label: 'I am dead', fields: [] },
  'random-chance': { label: 'Random chance succeeds', fields: [{ key: 'chance', label: 'Chance %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 25, toDisplay: (v) => Math.round(Number(v || 0) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'cooldown-ready': { label: 'Cooldown is ready', fields: [{ key: 'key', label: 'Cooldown key', type: 'text', defaultValue: 'default' }] },
  'linked-part-destroyed': { label: 'Linked part destroyed', fields: [{ key: 'partId', label: 'Part ID / Role', type: 'text', defaultValue: '' }] },
  'root-entered-state': { label: 'Root entered state', fields: [{ key: 'stateId', label: 'State', type: STATE_OPTION_TYPE, defaultValue: '' }] },
  'child-entered-state': { label: 'Child entered state', fields: [{ key: 'stateId', label: 'State', type: STATE_OPTION_TYPE, defaultValue: '' }] }
};
const ACTION_SPECS = {
  'switch-state': { label: 'Switch to state', fields: [{ key: 'stateId', label: 'State', type: STATE_OPTION_TYPE, defaultValue: '' }] },
  'reverse-direction': { label: 'Reverse direction', fields: [] },
  'set-velocity': { label: 'Set velocity', fields: [{ key: 'vx', label: 'X speed', type: 'number', step: 1, defaultValue: 0 }, { key: 'vy', label: 'Y speed', type: 'number', step: 1, defaultValue: 0 }] },
  jump: { label: 'Jump', fields: [{ key: 'speed', label: 'Jump speed', type: 'number', min: 0, step: 1, defaultValue: 220 }] },
  'stop-moving': { label: 'Stop moving', fields: [] },
  delay: { label: 'Delay', fields: [{ key: 'ms', label: 'Milliseconds', type: 'number', min: 0, step: 10, defaultValue: 100 }] },
  'rewind-animation': { label: 'Rewind Animation', fields: [] },
  'emit-damage': { label: 'Emit area damage', fields: [{ key: 'amount', label: 'Damage amount', type: 'number', min: 0, step: 1, defaultValue: 1 }, { key: 'radius', label: 'Radius (px)', type: 'number', min: 0, step: 1, defaultValue: 32 }] },
  'emit-particles': { label: 'Emit particles', fields: [{ key: 'count', label: 'Count', type: 'number', min: 1, max: 256, step: 1, defaultValue: 12 }, { key: 'color', label: 'Color', type: 'text', defaultValue: 'rgba(255,95,46,0.9)' }, { key: 'size', label: 'Size', type: 'number', min: 1, step: 1, defaultValue: 5 }, { key: 'sizeRandomness', label: 'Size randomness', type: 'number', min: 0, step: 1, defaultValue: 3 }, { key: 'lifeMs', label: 'Lifetime ms', type: 'number', min: 16, step: 16, defaultValue: 450 }, { key: 'lifeRandomnessMs', label: 'Life randomness ms', type: 'number', min: 0, step: 16, defaultValue: 250 }, { key: 'radius', label: 'Spawn radius', type: 'number', min: 0, step: 1, defaultValue: 12 }, { key: 'speed', label: 'Speed', type: 'number', min: 0, step: 1, defaultValue: 120 }, { key: 'speedRandomness', label: 'Speed randomness', type: 'number', min: 0, step: 1, defaultValue: 80 }, { key: 'angle', label: 'Direction', type: 'number', step: 1, defaultValue: 0, toDisplay: (v) => Math.round(Number(v || 0) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'spread', label: 'Spread degrees', type: 'number', min: 0, step: 1, defaultValue: Math.PI * 2, toDisplay: (v) => Math.round(Number(v ?? Math.PI * 2) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'gravity', label: 'Gravity', type: 'checkbox', defaultValue: false }, { key: 'gravityScale', label: 'Gravity scale', type: 'number', min: 0, step: 0.1, defaultValue: 1 }, { key: 'spin', label: 'Spin rad/sec', type: 'number', step: 0.1, defaultValue: 0 }, { key: 'frameDurationMs', label: 'Frame ms', type: 'number', min: 16, step: 16, defaultValue: 120 }, { key: 'offsetX', label: 'Offset X', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'offsetY', label: 'Offset Y', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'particleArtRef', label: 'Particle sprite', type: 'text', defaultValue: '' }, { key: 'cooldownMs', label: 'Cooldown ms', type: 'number', min: 0, step: 10, defaultValue: 100 }] },
  'spawn-bullets': { label: 'Spawn bullet', fields: [{ key: 'aimAtPlayer', label: 'Aim at player', type: 'checkbox', defaultValue: true }, { key: 'angle', label: 'Angle (degrees)', type: 'number', step: 1, defaultValue: 0, toDisplay: (v) => Math.round(Number(v || 0) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'speed', label: 'Bullet speed', type: 'number', min: 0, step: 1, defaultValue: 220 }, { key: 'shots', label: 'Shots', type: 'number', min: 1, max: 32, step: 1, defaultValue: 1 }, { key: 'shotDelayMs', label: 'Shot Delay ms', type: 'number', min: 0, step: 10, defaultValue: 0 }, { key: 'restartAnimationEachShot', label: 'Restart anim each shot', type: 'checkbox', defaultValue: false }, { key: 'offsetX', label: 'Spawn offset X', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'offsetY', label: 'Spawn offset Y', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'projectileArtRef', label: 'Projectile Art Ref', type: 'text', defaultValue: '' }] },
  'spawn-beam': { label: 'Fire beam', fields: [{ key: 'targetPlayer', label: 'Target player', type: 'checkbox', defaultValue: true }, { key: 'angle', label: 'Initial angle', type: 'number', step: 1, defaultValue: 0, toDisplay: (v) => Math.round(Number(v || 0) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'minAngle', label: 'Min angle', type: 'number', step: 1, defaultValue: -Math.PI, toDisplay: (v) => Math.round(Number(v ?? -Math.PI) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'maxAngle', label: 'Max angle', type: 'number', step: 1, defaultValue: Math.PI, toDisplay: (v) => Math.round(Number(v ?? Math.PI) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'targetOffsetX', label: 'Target offset X', type: 'number', step: 1, defaultValue: 0 }, { key: 'targetOffsetY', label: 'Target offset Y', type: 'number', step: 1, defaultValue: 0 }, { key: 'rotationSpeed', label: 'Turret deg/sec', type: 'number', min: 0, step: 1, defaultValue: 180 }, { key: 'accuracy', label: 'Miss degrees', type: 'number', min: 0, step: 1, defaultValue: 15 }, { key: 'trailLifeMs', label: 'Trail life ms', type: 'number', min: 0, step: 10, defaultValue: 0 }, { key: 'durationMs', label: 'Duration ms', type: 'number', min: 50, step: 50, defaultValue: 1000 }, { key: 'maxDistance', label: 'Max distance', type: 'number', min: 16, step: 8, defaultValue: 640 }, { key: 'damage', label: 'Damage', type: 'number', min: 0, step: 1, defaultValue: 1 }, { key: 'width', label: 'Beam width', type: 'number', min: 2, step: 1, defaultValue: 10 }, { key: 'offsetX', label: 'Muzzle offset X', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'offsetY', label: 'Muzzle offset Y', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'startArtRef', label: 'Start sprite', type: 'text', defaultValue: '' }, { key: 'repeatArtRef', label: 'Repeat sprite', type: 'text', defaultValue: '' }, { key: 'impactArtRef', label: 'Impact sprite', type: 'text', defaultValue: '' }] },
  'spawn-homing-missile': { label: 'Homing missile', fields: [{ key: 'targetPlayer', label: 'Target player', type: 'checkbox', defaultValue: true }, { key: 'angle', label: 'Launch angle', type: 'number', step: 1, defaultValue: -Math.PI / 2, toDisplay: (v) => Math.round(Number(v || 0) * (180 / Math.PI)), fromDisplay: (v) => Number(v || 0) * (Math.PI / 180) }, { key: 'targetOffsetX', label: 'Target offset X', type: 'number', step: 1, defaultValue: 0 }, { key: 'targetOffsetY', label: 'Target offset Y', type: 'number', step: 1, defaultValue: 0 }, { key: 'initialSpeed', label: 'Initial speed', type: 'number', min: 0, step: 1, defaultValue: 80 }, { key: 'acceleration', label: 'Acceleration', type: 'number', min: 0, step: 1, defaultValue: 260 }, { key: 'maxSpeed', label: 'Max speed', type: 'number', min: 1, step: 1, defaultValue: 260 }, { key: 'turnSpeed', label: 'Turn deg/sec', type: 'number', min: 0, step: 1, defaultValue: 180 }, { key: 'durationMs', label: 'Lifetime ms', type: 'number', min: 100, step: 100, defaultValue: 4000 }, { key: 'damage', label: 'Damage', type: 'number', min: 0, step: 1, defaultValue: 1 }, { key: 'radius', label: 'Hit radius', type: 'number', min: 4, step: 1, defaultValue: 10 }, { key: 'shots', label: 'Shots', type: 'number', min: 1, max: 32, step: 1, defaultValue: 1 }, { key: 'shotDelayMs', label: 'Shot Delay ms', type: 'number', min: 0, step: 10, defaultValue: 0 }, { key: 'offsetX', label: 'Muzzle offset X', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'offsetY', label: 'Muzzle offset Y', type: 'number', min: -9999, max: 9999, step: 1, defaultValue: 0 }, { key: 'missileArtRef', label: 'Missile sprite', type: 'text', defaultValue: '' }, { key: 'explosionArtRef', label: 'Explosion sprite', type: 'text', defaultValue: '' }, { key: 'smokeArtRef', label: 'Smoke trail sprite', type: 'text', defaultValue: '' }] },
  'spawn-actor': { label: 'Spawn actor', fields: [{ key: 'actorId', label: 'Actor ID', type: 'text', defaultValue: '' }, { key: 'offsetX', label: 'Offset X', type: 'number', step: 1, defaultValue: 0 }, { key: 'offsetY', label: 'Offset Y', type: 'number', step: 1, defaultValue: 0 }] },
  'delete-actor': { label: 'Delete actor', fields: [] },
  'play-sound': { label: 'Play sound', fields: [{ key: 'soundId', label: 'Sound ID', type: 'text', defaultValue: '' }] },
  'play-fx': { label: 'Play FX', fields: [{ key: 'fxId', label: 'SFX', type: SFX_OPTION_TYPE, defaultValue: '', emptyLabel: 'Select SFX' }, { key: 'volume', label: 'Volume', type: 'number', min: 0, step: 0.05, defaultValue: 1 }, { key: 'pitchCents', label: 'Pitch cents', type: 'number', step: 10, defaultValue: 0 }, { key: 'loop', label: 'Loop', type: 'checkbox', defaultValue: false }] },
  'stop-fx': { label: 'Stop FX', fields: [{ key: 'fxId', label: 'SFX', type: SFX_OPTION_TYPE, defaultValue: '', emptyLabel: 'All SFX' }] },
  'play-midi': { label: 'Play MIDI', fields: [{ key: 'trackId', label: 'MIDI track', type: MUSIC_OPTION_TYPE, defaultValue: '', emptyLabel: 'Select MIDI track' }, { key: 'fadeMs', label: 'Fade ms', type: 'number', min: 0, step: 50, defaultValue: 250 }] },
  'stop-midi': { label: 'Stop MIDI', fields: [{ key: 'trackId', label: 'MIDI track', type: MUSIC_OPTION_TYPE, defaultValue: '', emptyLabel: 'Current MIDI' }, { key: 'fadeMs', label: 'Fade ms', type: 'number', min: 0, step: 50, defaultValue: 250 }] },
  'become-invulnerable': { label: 'Become invulnerable', fields: [] },
  'become-vulnerable': { label: 'Become vulnerable', fields: [] },
  'enable-body-damage': { label: 'Enable body damage', fields: [] },
  'disable-body-damage': { label: 'Disable body damage', fields: [] },
  'drop-loot': { label: 'Drop loot', fields: [{ key: 'itemId', label: 'Item', type: LOOT_OPTION_TYPE, defaultValue: 'loot' }, { key: 'chance', label: 'Chance %', type: 'number', min: 0, max: 100, step: 1, defaultValue: 100, toDisplay: (v) => Math.round(Number(v || 0) * 100), fromDisplay: (v) => Number(v || 0) / 100 }] },
  'face-player': { label: 'Face player', fields: [] },
  'signal-root': { label: 'Signal root actor', fields: [{ key: 'signal', label: 'Signal name', type: 'text', defaultValue: '' }] },
  'signal-children': { label: 'Signal child actors', fields: [{ key: 'signal', label: 'Signal name', type: 'text', defaultValue: '' }] },
  'destroy-linked-part': { label: 'Destroy linked part', fields: [{ key: 'partId', label: 'Part ID / Role', type: 'text', defaultValue: '' }] },
  'open-weak-point': { label: 'Open weak point', fields: [{ key: 'weakPointId', label: 'Weak point ID', type: 'text', defaultValue: '' }] },
  'close-weak-point': { label: 'Close weak point', fields: [{ key: 'weakPointId', label: 'Weak point ID', type: 'text', defaultValue: '' }] }
};

export default class ActorEditor {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.actor = ensureActorDefinition(createDefaultActor());
    this.currentDocumentRef = null;
    this.selectedStateId = this.actor.initialStateId;
    this.stateClipboard = null;
    this.overlay = null;
    this.partRefreshToken = 0;
    this.artPreviewCache = new Map();
    this.previewTimers = [];
    this.activeMenuSection = 'actor';
    this.fileMenuOpen = true;
    this.actorPortraitMenuOpen = false;
    this.stateGraphOpen = false;
    this.hideMobileSectionHeaders = false;
    this.actorArtHueShiftDegrees = 0;
    this.actorArtHueShiftSaturation = 100;
    this.undoStack = [];
    this.redoStack = [];
    this.inputActionNormalizer = new EditorInputActionNormalizer();
    this.controllerMenu = new ControllerMenuStack({
      siblingOrder: ['file', 'states', 'linked-parts', 'tools', 'settings']
    });
    this.gamepadFocusIndex = 0;
    this.gamepadFocusRepeat = 0;
  }

  normalizeArtFramePixels(frame) {
    if (Array.isArray(frame) && frame.some((value) => typeof value === 'string')) return frame;
    if (Array.isArray(frame) && Array.isArray(frame[0]) && frame[0].some((value) => typeof value === 'string')) return frame[0];
    if (frame && typeof frame === 'object') {
      if (Array.isArray(frame.pixels) && frame.pixels.some((value) => typeof value === 'string')) return frame.pixels;
      if (Array.isArray(frame.data) && frame.data.some((value) => typeof value === 'string')) return frame.data;
    }
    return null;
  }

  buildArtPreviewFrameUrl(frame, width, height, cacheKey) {
    const pixels = this.normalizeArtFramePixels(frame);
    if (!Array.isArray(pixels) || !pixels.length) return '';
    if (this.artPreviewCache.has(cacheKey)) return this.artPreviewCache.get(cacheKey);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const sourceIndex = py * width + px;
        const color = pixels[sourceIndex];
        const base = (py * width + px) * 4;
        if (typeof color !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(color)) {
          if (base + 3 < imageData.data.length) imageData.data[base + 3] = 0;
          continue;
        }
        const hex = color.startsWith('#') ? color.slice(1) : color;
        if (base + 3 < imageData.data.length) {
          imageData.data[base] = parseInt(hex.slice(0, 2), 16);
          imageData.data[base + 1] = parseInt(hex.slice(2, 4), 16);
          imageData.data[base + 2] = parseInt(hex.slice(4, 6), 16);
          imageData.data[base + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const url = canvas.toDataURL('image/png');
    this.artPreviewCache.set(cacheKey, url);
    return url;
  }

  getAnimationPreviewFrames(animation = {}) {
    const artRef = typeof animation?.artRef === 'string' ? animation.artRef : '';
    if (artRef) {
      const artDoc = loadProjectFile('art', artRef);
      const savedAt = Number(artDoc?.savedAt || 0);
      const frames = Array.isArray(artDoc?.data?.frames) ? artDoc.data.frames : [];
      if (frames.length) {
        const width = Math.max(1, Math.round(Number(artDoc?.data?.width || artDoc?.data?.size || 16)));
        const height = Math.max(1, Math.round(Number(artDoc?.data?.height || artDoc?.data?.size || width || 16)));
        return frames.map((frame, index) => ({
          imageDataUrl: this.buildArtPreviewFrameUrl(frame, width, height, `${artRef}:${savedAt}:${index}:${width}x${height}`),
          durationMs: Math.round(1000 / Math.max(1, Number(animation?.fps || artDoc?.data?.fps || 8)))
        })).filter((frame) => frame.imageDataUrl);
      }
    }
    const fromFrames = Array.isArray(animation?.frames) && animation.frames.length
      ? animation.frames.filter((frame) => frame?.imageDataUrl)
      : [];
    if (fromFrames.length) return fromFrames;
    if (animation?.imageDataUrl) {
      return [{ imageDataUrl: animation.imageDataUrl, durationMs: Math.round(1000 / Math.max(1, Number(animation?.fps || 8))) }];
    }
    return [];
  }

  getAnimationDimensions(animation = {}) {
    const artRef = typeof animation?.artRef === 'string' ? animation.artRef.trim() : '';
    if (artRef) {
      const artDoc = loadProjectFile('art', artRef);
      const width = Number(artDoc?.data?.width || artDoc?.data?.size || 0);
      const height = Number(artDoc?.data?.height || artDoc?.data?.size || width || 0);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { width: Math.round(width), height: Math.round(height) };
      }
    }
    const frame = Array.isArray(animation?.frames) ? animation.frames.find((entry) => entry?.imageDataUrl) : null;
    const parsed = readPngDataUrlDimensions(frame?.imageDataUrl || animation?.imageDataUrl || '');
    if (parsed?.width > 0 && parsed?.height > 0) return parsed;
    return null;
  }

  getActorDefaultArtDimensions(actor) {
    const states = Array.isArray(actor?.states) ? actor.states : [];
    const state = states.find((entry) => entry?.animation?.artRef || entry?.animation?.imageDataUrl || entry?.animation?.frames?.length)
      || states[0];
    return this.getAnimationDimensions(state?.animation || {});
  }

  shouldAutoSizeActor(actor) {
    if (actor?.sizeMode === 'manual') return false;
    const width = Number(actor?.size?.width || 0);
    const height = Number(actor?.size?.height || 0);
    return !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
      || (Math.round(width) === DEFAULT_ACTOR_SIZE.width && Math.round(height) === DEFAULT_ACTOR_SIZE.height);
  }

  applyDefaultArtSize(actor) {
    const next = ensureActorDefinition(actor);
    if (!this.shouldAutoSizeActor(next)) return next;
    const dims = this.getActorDefaultArtDimensions(next);
    if (!dims || dims.width <= 0 || dims.height <= 0) return next;
    const oldWidth = Math.max(1, Number(next?.size?.width || DEFAULT_ACTOR_SIZE.width));
    const oldHeight = Math.max(1, Number(next?.size?.height || DEFAULT_ACTOR_SIZE.height));
    const scaleX = dims.width / oldWidth;
    const scaleY = dims.height / oldHeight;
    const collisionZones = Array.isArray(next.collisionZones)
      ? next.collisionZones.map((zone) => ({
        ...zone,
        x: Number(zone.x || 0) * scaleX,
        y: Number(zone.y || 0) * scaleY,
        width: Math.max(1, Number(zone.width || 1) * scaleX),
        height: Math.max(1, Number(zone.height || 1) * scaleY)
      }))
      : [];
    return { ...next, size: { width: dims.width, height: dims.height }, sizeMode: 'auto', collisionZones };
  }

  captureFocusedInputState() {
    const active = document.activeElement;
    if (!this.overlay || !active || !this.overlay.contains(active)) return null;
    const tag = active.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return null;
    const path = [];
    let node = active;
    while (node && node !== this.overlay) {
      const parent = node.parentElement;
      if (!parent) return null;
      path.unshift(Array.prototype.indexOf.call(parent.children, node));
      node = parent;
    }
    return {
      path,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  restoreFocusedInputState(focusState) {
    if (!focusState || !this.overlay) return;
    let node = this.overlay;
    for (const index of focusState.path) {
      node = node?.children?.[index] || null;
      if (!node) return;
    }
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return;
    node.focus();
    if (typeof focusState.selectionStart === 'number' && typeof focusState.selectionEnd === 'number') {
      const maxSelection = String(node.value || '').length;
      const start = Math.min(focusState.selectionStart, maxSelection);
      const end = Math.min(focusState.selectionEnd, maxSelection);
      node.setSelectionRange(start, end);
    }
  }

  getConditionSpec(type) {
    return CONDITION_SPECS[type] || { label: toTitleLabel(type), fields: [] };
  }

  getActionSpec(type) {
    return ACTION_SPECS[type] || { label: toTitleLabel(type), fields: [] };
  }

  createParamsFromSpec(spec, stateOptions = []) {
    const params = {};
    (spec?.fields || []).forEach((field) => {
      if (field.type === STATE_OPTION_TYPE) {
        params[field.key] = field.defaultValue || stateOptions[0]?.id || '';
        return;
      }
      params[field.key] = field.defaultValue ?? '';
    });
    return params;
  }

  renderParamFields({ fields, params, onParamInput, stateOptions }) {
    const wrap = el('div', 'actor-editor-inline-actions');
    (fields || []).forEach((field) => {
      const fieldWrap = el('label', 'actor-editor-field');
      fieldWrap.appendChild(el('span', 'actor-editor-field-label', field.label));
      let input = null;
      if (field.type === 'checkbox') {
        input = el('input');
        input.type = 'checkbox';
        input.checked = !!params?.[field.key];
        input.oninput = (event) => onParamInput(field, event.target.checked);
      } else if (field.type === 'select' || field.type === STATE_OPTION_TYPE || field.type === LOOT_OPTION_TYPE || field.type === MUSIC_OPTION_TYPE || field.type === SFX_OPTION_TYPE) {
        input = el('select');
        const options = field.type === STATE_OPTION_TYPE
          ? stateOptions
          : field.type === LOOT_OPTION_TYPE
            ? LOOT_ITEM_OPTIONS
            : field.type === MUSIC_OPTION_TYPE
              ? [{ id: '', label: field.emptyLabel || 'None' }, ...listProjectFiles('music').map((entry) => ({ id: entry.name, label: entry.name }))]
              : field.type === SFX_OPTION_TYPE
                ? [{ id: '', label: field.emptyLabel || 'None' }, ...listProjectFiles('sfx').map((entry) => ({ id: entry.name, label: entry.name }))]
              : (field.options || []);
        options.forEach((option) => {
          const node = el('option');
          node.value = option.id;
          node.textContent = option.label || option.id;
          input.appendChild(node);
        });
        const selected = params?.[field.key] ?? field.defaultValue ?? options[0]?.id ?? '';
        input.value = selected;
        input.oninput = (event) => onParamInput(field, event.target.value);
      } else {
        input = el('input');
        if (field.type === 'number') {
          input.type = 'text';
          const allowsNegative = field.min == null || Number(field.min) < 0;
          input.inputMode = allowsNegative ? 'text' : 'decimal';
          input.pattern = allowsNegative ? '-?[0-9]*[.]?[0-9]*' : '[0-9]*[.]?[0-9]*';
        } else {
          input.type = 'text';
        }
        const storedValue = params?.[field.key];
        const displayValue = field.toDisplay ? field.toDisplay(storedValue) : (storedValue ?? field.defaultValue ?? '');
        input.value = displayValue;
        const commitInputValue = (event) => {
          const rawText = String(event.target.value ?? '').trim();
          const raw = field.type === 'number'
            ? (rawText === '' ? '' : Number(rawText))
            : event.target.value;
          if (field.type === 'number' && rawText !== '' && !Number.isFinite(raw)) return;
          onParamInput(field, raw);
        };
        if (field.type === 'number') {
          input.onchange = commitInputValue;
          input.onblur = commitInputValue;
          input.onkeydown = (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commitInputValue(event);
            input.blur();
          };
        } else {
          input.oninput = commitInputValue;
        }
      }
      fieldWrap.appendChild(input);
      wrap.appendChild(fieldWrap);
    });
    return wrap;
  }

  activate() {
    this.active = true;
    this.mount();
  }

  clearPreviewTimers() {
    this.previewTimers.forEach((timer) => clearInterval(timer));
    this.previewTimers = [];
  }

  deactivate() {
    this.active = false;
    this.clearPreviewTimers();
    this.overlay?.remove();
    this.overlay = null;
  }

  update(input, dt = 0) {
    this.handleGamepadInput(input, dt);
  }
  draw() {}
  resetTransientInteractionState() {
    this.controllerMenu.resetFocus();
  }

  resetToFileMenu() {
    const viewportW = Number(window.innerWidth || 0);
    const viewportH = Number(window.innerHeight || 0);
    const isPortraitPhone = Math.min(viewportW, viewportH) <= 900 && viewportH > viewportW;
    this.fileMenuOpen = !isPortraitPhone;
    this.actorPortraitMenuOpen = !isPortraitPhone;
    this.activeMenuSection = 'actor';
    this.controllerMenu.resetFocus();
    if (this.active) this.render();
  }

  mount() {
    if (this.overlay) this.overlay.remove();
    ensureProjectFileIndex();
    const root = document.getElementById('global-overlay-root') || document.body;
    const overlay = el('div', 'actor-editor-overlay');
    overlay.style.pointerEvents = 'auto';
    overlay.innerHTML = '';
    this.overlay = overlay;
    root.appendChild(overlay);
    this.render();
  }

  ensureStateSelection() {
    if (!this.actor.states.some((state) => state.id === this.selectedStateId)) {
      this.selectedStateId = this.actor.states[0]?.id || null;
    }
  }

  get selectedState() {
    this.ensureStateSelection();
    return this.actor.states.find((state) => state.id === this.selectedStateId) || this.actor.states[0];
  }

  captureHistorySnapshot() {
    return JSON.stringify(this.actor);
  }

  setActor(next, { render = true, recordHistory = true } = {}) {
    const before = this.captureHistorySnapshot();
    this.actor = this.applyDefaultArtSize(next);
    this.game.registerRuntimeActorDefinition?.(this.actor);
    this.ensureStateSelection();
    const after = this.captureHistorySnapshot();
    if (recordHistory && before !== after) {
      this.undoStack.push(before);
      if (this.undoStack.length > 80) this.undoStack.shift();
      this.redoStack = [];
    }
    if (render) this.render();
  }

  undo() {
    const previous = this.undoStack.pop();
    if (!previous) {
      this.showInlineSaveStatus?.('Nothing to undo');
      return;
    }
    this.redoStack.push(this.captureHistorySnapshot());
    this.setActor(JSON.parse(previous), { recordHistory: false });
    this.showInlineSaveStatus?.('Undo');
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) {
      this.showInlineSaveStatus?.('Nothing to redo');
      return;
    }
    this.undoStack.push(this.captureHistorySnapshot());
    this.setActor(JSON.parse(next), { recordHistory: false });
    this.showInlineSaveStatus?.('Redo');
  }

  async newActor() {
    this.currentDocumentRef = null;
    this.resetActorArtHuePreview();
    this.undoStack = [];
    this.redoStack = [];
    this.setActor(createDefaultActor(), { recordHistory: false });
  }

  async openActor() {
    await openProjectBrowser({
      fixedFolder: ACTOR_FOLDER,
      initialFolder: ACTOR_FOLDER,
      title: 'Open Actor',
      onOpen: ({ payload, name }) => {
        this.currentDocumentRef = { folder: ACTOR_FOLDER, name };
        this.resetActorArtHuePreview();
        this.undoStack = [];
        this.redoStack = [];
        this.setActor(ensureActorDefinition(payload?.data || createDefaultActor(name)), { recordHistory: false });
        this.fileMenuOpen = false;
        this.actorPortraitMenuOpen = false;
        this.activeMenuSection = 'actor';
      }
    });
  }

  async saveActor(forceSaveAs = false) {
    const MIN_SAVING_TOAST_MS = 350;
    const fallback = this.currentDocumentRef?.name || `${this.actor.name || 'actor'}.json`;
    const shouldForceSaveAs = forceSaveAs
      || !this.currentDocumentRef?.name
      || /^actor(\.json)?$/i.test(String(fallback || '').trim());
    let name = fallback;
    if (shouldForceSaveAs) {
      const picked = await openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: ACTOR_FOLDER,
        initialFolder: ACTOR_FOLDER,
        title: 'Save Actor As',
        initialName: fallback
      });
      if (!picked || picked.action !== 'saveAs') return;
      name = String(picked.name || '').trim();
    }
    if (!name) return;
    let payload = ensureActorDefinition(this.actor);
    if (!this.isActorHueShiftNeutral()) {
      payload = await this.buildActorHueShiftedCopy(payload, this.actorArtHueShiftDegrees, this.actorArtHueShiftSaturation);
      this.resetActorArtHuePreview();
      this.setActor(payload, { recordHistory: false });
    }
    const savingStartedAt = Date.now();
    this.showInlineSaveStatus?.('Saving...');
    this.game.showSaveStatusModal?.('Saving...');
    this.game.showSystemToast?.('Saving...');
    let saved = null;
    try {
      saved = saveProjectFile(ACTOR_FOLDER, name, payload);
      if (saved?.syncPromise) {
        await saved.syncPromise;
      }
    } catch (error) {
      console.error('Actor save failed', error);
      this.showInlineSaveStatus?.('Save failed');
      this.game.showSaveStatusModal?.('Save failed');
      setTimeout(() => {
        this.game.hideSaveStatusModal?.();
        this.showInlineSaveStatus?.('');
      }, 1800);
      return;
    }
    const elapsed = Date.now() - savingStartedAt;
    if (elapsed < MIN_SAVING_TOAST_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_SAVING_TOAST_MS - elapsed));
    }
    const persistedName = String(saved?.name || name);
    const persistedPayload = loadProjectFile(ACTOR_FOLDER, persistedName);
    if (!persistedPayload?.data) {
      this.showInlineSaveStatus?.('Save failed');
      this.game.showSaveStatusModal?.('Save failed');
      setTimeout(() => {
        this.game.hideSaveStatusModal?.();
        this.showInlineSaveStatus?.('');
      }, 3000);
      return;
    }
    this.currentDocumentRef = { folder: ACTOR_FOLDER, name: persistedName };
    this.actor = ensureActorDefinition(persistedPayload.data);
    invalidateActorDefinitionCache(this.actor.id);
    this.game.registerRuntimeActorDefinition?.(this.actor);
    this.render();
    this.showInlineSaveStatus?.('Saved');
    this.game.showSaveStatusModal?.('Saved');
    setTimeout(() => this.game.hideSaveStatusModal?.(), 3000);
    setTimeout(() => this.showInlineSaveStatus?.(''), 3000);
    this.game.showSystemToast?.('Saved');
  }

  showInlineSaveStatus(message = '') {
    if (!this.overlay) return;
    let badge = this.overlay.querySelector('.actor-editor-save-status');
    if (!badge) {
      badge = el('div', 'actor-editor-save-status');
      Object.assign(badge.style, {
        position: 'fixed',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '8px 12px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'rgba(5,10,20,0.92)',
        color: '#fff',
        fontFamily: 'Courier New, monospace'
      });
      this.overlay.appendChild(badge);
    }
    badge.textContent = String(message || '');
    badge.style.display = message ? 'block' : 'none';
  }

  resetActorArtHuePreview() {
    this.actorArtHueShiftDegrees = 0;
    this.actorArtHueShiftSaturation = 100;
  }

  isActorHueShiftNeutral() {
    return Math.abs(Number(this.actorArtHueShiftDegrees || 0)) < 0.001
      && Math.abs(Number(this.actorArtHueShiftSaturation || 100) - 100) < 0.001;
  }

  getActorHuePreviewFilter() {
    if (this.isActorHueShiftNeutral()) return '';
    return `hue-rotate(${Number(this.actorArtHueShiftDegrees || 0)}deg) saturate(${Math.max(0, Number(this.actorArtHueShiftSaturation || 100)) / 100})`;
  }

  exitToMenu() {
    this.deactivate();
    this.game.transitionTo('title', { forceCleanup: true });
  }

  playActorScene() {
    const normalized = ensureActorDefinition(this.actor);
    this.game.registerRuntimeActorDefinition?.(normalized);
    this.game.startActorEditorPlaytest(normalized.id, normalized);
  }

  playtestActor() {
    this.playActorScene();
  }

  openStateAnimation(state) {
    this.game.enterPixelStudio({ returnState: 'actor-editor', resetFocus: false });
    this.game.pixelStudio.loadActorStateImageForEditing({
      actorId: this.actor.id,
      stateId: state.id,
      animation: state.animation || {},
      onCommit: (animation) => {
        const next = clone(this.actor);
        const target = next.states.find((entry) => entry.id === state.id);
        if (!target) return;
        const artRef = String(animation?.artRef || target.animation?.artRef || '');
        target.animation = {
          imageDataUrl: '',
          frames: [],
          fps: Math.max(1, Number(animation?.fps || target.animation?.fps || 8)),
          artRef,
          updatedAt: Date.now()
        };
        this.artPreviewCache.clear();
        this.actor = this.applyDefaultArtSize(next);
        this.render();
      }
    }).catch((error) => console.warn('Failed to open actor animation in Pixel Studio', error));
  }

  getProjectileArtPreviewFrames(artRef) {
    const ref = String(artRef || '').trim();
    if (!ref) return [];
    return this.getAnimationPreviewFrames({ artRef: ref, frames: [], fps: 8 });
  }

  openProjectileArtEditor(initialArtRef, onCommit) {
    return this.openActionArtEditor(initialArtRef, onCommit, 'projectile');
  }

  openActionArtEditor(initialArtRef, onCommit, slotId = 'action', documentName = '') {
    this.game.enterPixelStudio({ returnState: 'actor-editor', resetFocus: false });
    this.game.pixelStudio.loadActorStateImageForEditing({
      actorId: this.actor.id,
      stateId: `${this.selectedStateId || 'state'}-${slotId}`,
      animation: { artRef: String(initialArtRef || '').trim(), frames: [], fps: 8 },
      documentName,
      onCommit: (animation) => {
        const nextArtRef = String(animation?.artRef || initialArtRef || '').trim();
        if (!nextArtRef) return;
        onCommit?.(nextArtRef);
      }
    }).catch((error) => console.warn('Failed to open projectile art in Pixel Studio', error));
  }

  openCollisionZoneEditor(actor, { state = null } = {}) {
    const modal = el('div', 'actor-editor-overlay actor-editor-dialog-overlay');
    const card = el('div', 'actor-editor-card actor-editor-modal-card');
    Object.assign(card.style, { width: 'min(960px, 96vw)', height: 'min(92dvh, 760px)' });
    const viewportWrap = el('div');
    Object.assign(viewportWrap.style, { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' });
    card.appendChild(viewportWrap);
    const controls = el('div', 'actor-editor-inline-actions');
    const zoneType = el('select');
    [
      { id: 'solid', label: 'Yellow: Collidable' },
      { id: 'solid-damage-player', label: 'Red: Collidable + damages player' },
      { id: 'damage-player', label: 'Pink: Damage player (not collidable)' },
      { id: 'solid-hurtbox', label: 'Blue: Collidable + actor takes damage' },
      { id: 'hurtbox', label: 'Green: Actor takes damage (not collidable)' }
    ].forEach((option) => { const node = el('option'); node.value = option.id; node.textContent = option.label; zoneType.appendChild(node); });
    const clearBtn = el('button', 'actor-editor-btn small', 'Clear all');
    const paintBtn = el('button', 'actor-editor-btn small active', 'Paint');
    const eraseBtn = el('button', 'actor-editor-btn small', 'Erase');
    const brushSize = el('input');
    brushSize.type = 'number';
    brushSize.min = '1';
    brushSize.max = '12';
    brushSize.step = '1';
    brushSize.value = '1';
    brushSize.style.width = '72px';
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 560;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxHeight = '100%';
    canvas.style.border = '1px solid rgba(255,255,255,0.25)';
    canvas.style.background = '#080d17';
    canvas.style.touchAction = 'none';
    const canvasWrap = el('div');
    Object.assign(canvasWrap.style, { flex: '1', minHeight: '0', overflow: 'hidden', position: 'relative' });
    canvasWrap.appendChild(canvas);
    viewportWrap.appendChild(canvasWrap);
    const bottomTools = el('div');
    Object.assign(bottomTools.style, { display: 'grid', gridTemplateColumns: '96px 1fr', gap: '8px', alignItems: 'stretch' });
    const thumbCol = el('div');
    Object.assign(thumbCol.style, { display: 'flex', alignItems: 'stretch', justifyContent: 'center' });
    const controlsCol = el('div');
    Object.assign(controlsCol.style, { display: 'flex', flexDirection: 'column', gap: '8px' });
    const toolbarRow1 = el('div', 'actor-editor-inline-actions');
    const toolbarRow2 = el('div', 'actor-editor-inline-actions');
    toolbarRow2.style.alignItems = 'center';
    toolbarRow2.style.justifyContent = 'space-between';
    toolbarRow2.style.flexWrap = 'nowrap';
    const zoomOutBtn = el('button', 'actor-editor-btn small', 'Zoom -');
    const zoomInBtn = el('button', 'actor-editor-btn small', 'Zoom +');
    const zoomRow = el('div', 'actor-editor-inline-actions');
    const thumbstick = el('div');
    thumbstick.className = 'actor-editor-thumbstick';
    Object.assign(thumbstick.style, {
      width: '88px', height: '88px', borderRadius: '999px', border: '2px solid rgba(255,255,255,0.25)',
      position: 'relative', background: 'rgba(0,0,0,0.35)', touchAction: 'none'
    });
    const stickKnob = el('div');
    Object.assign(stickKnob.style, {
      width: '34px', height: '34px', borderRadius: '999px', background: 'rgba(255,255,255,0.7)',
      position: 'absolute', left: '27px', top: '27px'
    });
    thumbstick.appendChild(stickKnob);
    const actionRow = el('div', 'actor-editor-inline-actions');
    actionRow.style.flexWrap = 'nowrap';
    const ok = el('button', 'actor-editor-btn', 'OK');
    const cancel = el('button', 'actor-editor-btn', 'Cancel');
    controls.appendChild(el('span', 'actor-editor-note', 'Brush'));
    controls.appendChild(brushSize);
    controls.appendChild(zoneType);
    controls.appendChild(paintBtn);
    controls.appendChild(eraseBtn);
    controls.appendChild(clearBtn);
    toolbarRow1.appendChild(controls);
    thumbCol.appendChild(thumbstick);
    controlsCol.append(toolbarRow1, toolbarRow2);
    bottomTools.append(thumbCol, controlsCol);
    actionRow.append(cancel, ok);
    zoomRow.append(zoomOutBtn, zoomInBtn);
    const rightRow = el('div', 'actor-editor-inline-actions');
    rightRow.style.marginLeft = 'auto';
    rightRow.style.flexWrap = 'nowrap';
    rightRow.appendChild(actionRow);
    toolbarRow2.append(zoomRow, rightRow);
    card.appendChild(bottomTools);
    modal.appendChild(card);
    document.body.appendChild(modal);
    const editingState = state ? clone(state) : null;
    const sourceZones = editingState
      ? (Array.isArray(editingState.collisionZones) ? editingState.collisionZones : actor.collisionZones)
      : actor.collisionZones;
    const zones = Array.isArray(sourceZones) ? clone(sourceZones) : [];
    const previewState = editingState || actor.states?.find((entry) => entry.id === actor.initialStateId) || actor.states?.[0];
    const preview = this.getAnimationPreviewFrames(previewState?.animation || {})[0]?.imageDataUrl || '';
    const image = new Image();
    if (preview) image.src = preview;
    const colors = { solid: 'rgba(255,220,0,0.35)', 'solid-damage-player': 'rgba(255,0,0,0.35)', 'damage-player': 'rgba(255,90,160,0.35)', 'solid-hurtbox': 'rgba(70,140,255,0.35)', hurtbox: 'rgba(80,255,120,0.35)' };
    let eraseMode = false;
    let painting = false;
    let paintPointerId = null;
    const actorW = Math.max(1, Number(actor?.size?.width || 32));
    const actorH = Math.max(1, Number(actor?.size?.height || 32));
    const zoneGrid = Array.from({ length: actorH }, () => Array.from({ length: actorW }, () => null));
    zones.forEach((zone) => {
      const startX = Math.max(0, Math.floor(zone.x));
      const startY = Math.max(0, Math.floor(zone.y));
      const endX = Math.min(actorW, startX + Math.max(1, Math.floor(zone.width)));
      const endY = Math.min(actorH, startY + Math.max(1, Math.floor(zone.height)));
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) zoneGrid[y][x] = zone.type || 'solid';
      }
    });
    const pad = 24;
    const resizeCanvasToViewport = () => {
      const rect = canvasWrap.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width || 640));
      const h = Math.max(220, Math.floor(rect.height || 560));
      canvas.width = w;
      canvas.height = h;
    };
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    const getPreviewDimensions = () => {
      const imageW = image?.naturalWidth > 0 ? image.naturalWidth : actorW;
      const imageH = image?.naturalHeight > 0 ? image.naturalHeight : actorH;
      return { width: imageW, height: imageH, imageW, imageH };
    };
    const getScale = () => {
      const dims = getPreviewDimensions();
      return Math.min((canvas.width - pad * 2) / dims.width, (canvas.height - pad * 2) / dims.height) * zoom;
    };
    const getBox = () => {
      const scale = getScale();
      const dims = getPreviewDimensions();
      return { x: (canvas.width - dims.width * scale) / 2 + panX, y: (canvas.height - dims.height * scale) / 2 + panY, w: dims.width * scale, h: dims.height * scale, scale, ...dims };
    };
    const toActorPoint = (screenX, screenY) => {
      const box = getBox();
      const imagePxX = Math.max(0, Math.min(box.imageW - 1, Math.floor((screenX - box.x) / box.scale)));
      const imagePxY = Math.max(0, Math.min(box.imageH - 1, Math.floor((screenY - box.y) / box.scale)));
      return {
        x: Math.max(0, Math.min(actorW - 1, Math.floor(imagePxX * (actorW / Math.max(1, box.imageW))))),
        y: Math.max(0, Math.min(actorH - 1, Math.floor(imagePxY * (actorH / Math.max(1, box.imageH)))))
      };
    };
    const applyBrush = (screenX, screenY) => {
      const point = toActorPoint(screenX, screenY);
      const radius = Math.max(1, Math.min(12, Math.floor(Number(brushSize.value) || 1)));
      const half = Math.floor(radius / 2);
      for (let y = point.y - half; y <= point.y + half; y += 1) {
        for (let x = point.x - half; x <= point.x + half; x += 1) {
          if (x < 0 || y < 0 || x >= actorW || y >= actorH) continue;
          zoneGrid[y][x] = eraseMode ? null : zoneType.value;
        }
      }
    };
    const rebuildZonesFromGrid = () => {
      const consumed = Array.from({ length: actorH }, () => Array.from({ length: actorW }, () => false));
      const next = [];
      for (let y = 0; y < actorH; y += 1) {
        for (let x = 0; x < actorW; x += 1) {
          const type = zoneGrid[y][x];
          if (!type || consumed[y][x]) continue;
          let width = 1;
          while (x + width < actorW && zoneGrid[y][x + width] === type && !consumed[y][x + width]) width += 1;
          let height = 1;
          outer: while (y + height < actorH) {
            for (let xx = x; xx < x + width; xx += 1) {
              if (zoneGrid[y + height][xx] !== type || consumed[y + height][xx]) break outer;
            }
            height += 1;
          }
          for (let yy = y; yy < y + height; yy += 1) {
            for (let xx = x; xx < x + width; xx += 1) consumed[yy][xx] = true;
          }
          next.push({ type, x, y, width, height });
        }
      }
      zones.length = 0;
      zones.push(...next);
    };
    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const box = getBox();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f1726';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      if (image.complete && image.naturalWidth > 0) {
        const baseScale = box.scale;
        const drawW = image.naturalWidth * baseScale;
        const drawH = image.naturalHeight * baseScale;
        const drawX = box.x + ((box.w - drawW) * 0.5);
        const drawY = box.y + ((box.h - drawH) * 0.5);
        ctx.drawImage(image, drawX, drawY, drawW, drawH);
      }
      zones.forEach((zone) => {
        const ix = zone.x * (box.imageW / Math.max(1, actorW));
        const iy = zone.y * (box.imageH / Math.max(1, actorH));
        const iw = zone.width * (box.imageW / Math.max(1, actorW));
        const ih = zone.height * (box.imageH / Math.max(1, actorH));
        const x = box.x + ix * box.scale;
        const y = box.y + iy * box.scale;
        const w = iw * box.scale;
        const h = ih * box.scale;
        ctx.fillStyle = colors[zone.type] || colors.solid;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y, w, h);
      });
    };
    const pointer = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);
      return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
    };
    canvas.onpointerdown = (event) => {
      if (!event.isPrimary) return;
      event.preventDefault();
      event.stopPropagation();
      canvas.setPointerCapture?.(event.pointerId);
      paintPointerId = event.pointerId;
      const p = pointer(event);
      painting = true;
      applyBrush(p.x, p.y);
      rebuildZonesFromGrid();
      render();
    };
    canvas.onpointermove = (event) => {
      if (paintPointerId != null && event.pointerId !== paintPointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (!painting) return;
      const p = pointer(event);
      applyBrush(p.x, p.y);
      // Fill gaps when pointer events skip on mobile by interpolating.
      if (typeof canvas._lastPaintX === 'number' && typeof canvas._lastPaintY === 'number') {
        const dx = p.x - canvas._lastPaintX;
        const dy = p.y - canvas._lastPaintY;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
        for (let i = 1; i <= steps; i += 1) {
          const ix = canvas._lastPaintX + (dx * i) / steps;
          const iy = canvas._lastPaintY + (dy * i) / steps;
          applyBrush(ix, iy);
        }
      }
      canvas._lastPaintX = p.x;
      canvas._lastPaintY = p.y;
      rebuildZonesFromGrid();
      render();
    };
    canvas.onpointerup = (event) => {
      if (paintPointerId != null && event.pointerId !== paintPointerId) return;
      if (!painting) return;
      painting = false;
      paintPointerId = null;
      canvas._lastPaintX = null;
      canvas._lastPaintY = null;
      render();
    };
    canvas.onpointercancel = () => { painting = false; paintPointerId = null; };
    canvas.onpointerleave = () => {};
    clearBtn.onclick = () => {
      for (let y = 0; y < actorH; y += 1) for (let x = 0; x < actorW; x += 1) zoneGrid[y][x] = null;
      zones.length = 0;
      render();
    };
    paintBtn.onclick = () => { eraseMode = false; paintBtn.classList.add('active'); eraseBtn.classList.remove('active'); };
    eraseBtn.onclick = () => { eraseMode = true; eraseBtn.classList.add('active'); paintBtn.classList.remove('active'); };
    zoomOutBtn.onclick = () => { zoom = Math.max(0.5, zoom - 0.2); render(); };
    zoomInBtn.onclick = () => { zoom = Math.min(6, zoom + 0.2); render(); };
    let stickDrag = null;
    const centerKnob = () => { stickKnob.style.left = '27px'; stickKnob.style.top = '27px'; };
    thumbstick.onpointerdown = (event) => {
      event.preventDefault();
      stickDrag = { id: event.pointerId };
      thumbstick.setPointerCapture?.(event.pointerId);
    };
    thumbstick.onpointermove = (event) => {
      if (!stickDrag || stickDrag.id !== event.pointerId) return;
      event.preventDefault();
      const rect = thumbstick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-24, Math.min(24, event.clientX - cx));
      const dy = Math.max(-24, Math.min(24, event.clientY - cy));
      stickKnob.style.left = `${27 + dx}px`;
      stickKnob.style.top = `${27 + dy}px`;
      panX -= dx * 0.15;
      panY -= dy * 0.15;
      render();
    };
    thumbstick.onpointerup = () => { stickDrag = null; centerKnob(); };
    thumbstick.onpointercancel = () => { stickDrag = null; centerKnob(); };
    const cleanup = () => {
      window.removeEventListener('resize', resizeCanvasToViewport);
      modal.remove();
    };
    cancel.onclick = () => cleanup();
    ok.onclick = () => {
      if (editingState) {
        const next = clone(this.actor);
        const target = next.states.find((entry) => entry.id === editingState.id);
        if (target) target.collisionZones = zones;
        this.setActor(next);
      } else {
        this.setActor({ ...actor, collisionZones: zones });
      }
      cleanup();
    };
    image.onload = () => render();
    requestAnimationFrame(() => {
      resizeCanvasToViewport();
      render();
    });
    window.addEventListener('resize', resizeCanvasToViewport);
    render();
  }

  buildProjectileArtControl(params, onCommit) {
    return this.buildActionArtControl(params, {
      artKey: 'projectileArtRef',
      emptyLabel: 'Create projectile art',
      editPrefix: 'Edit',
      alt: 'Projectile art preview',
      slotId: 'projectile',
      onCommit
    });
  }

  buildActionSlotArtDocName(action, artKey) {
    const slugifyPart = (value, fallback) => String(value || fallback || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;
    return [
      slugifyPart(this.actor?.id || this.actor?.name, 'actor'),
      slugifyPart(this.selectedStateId, 'state'),
      slugifyPart(action?.id || action?.type, 'action'),
      slugifyPart(artKey, 'sprite'),
      'art'
    ].join('-');
  }

  buildActionArtControl(params, { artKey, label, emptyLabel, editPrefix = 'Edit', alt = 'Action art preview', slotId = 'action', documentName = '', onCommit }) {
    const wrap = el('div', 'actor-editor-inline-actions');
    const button = el('button', 'actor-editor-btn small');
    button.type = 'button';
    const artRef = String(params?.[artKey] || '').trim();
    const frames = this.getProjectileArtPreviewFrames(artRef);
    const preview = frames[0];
    if (preview?.imageDataUrl) {
      const image = el('img', 'actor-editor-thumb');
      image.src = preview.imageDataUrl;
      image.alt = alt;
      button.appendChild(image);
      button.appendChild(el('span', '', label ? `${label}: ${artRef}` : (artRef || emptyLabel)));
    } else {
      button.textContent = artRef ? `${editPrefix} ${artRef}` : emptyLabel;
    }
    button.onclick = () => this.openActionArtEditor(artRef, onCommit, slotId, documentName);
    wrap.appendChild(button);
    return wrap;
  }

  addState() {
    const copy = clone(this.actor);
    const next = createDefaultState(`State ${copy.states.length + 1}`);
    copy.states.push(next);
    this.selectedStateId = next.id;
    this.setActor(copy);
  }

  duplicateState(state) {
    const copy = clone(this.actor);
    const next = clone(state);
    next.id = `${state.id}-${copy.states.length + 1}`;
    next.name = `${state.name} Copy`;
    const sourceArtRef = String(state?.animation?.artRef || '').trim();
    if (sourceArtRef) {
      const sourceDoc = loadProjectFile('art', sourceArtRef);
      const duplicateName = `${sourceArtRef} copy ${Date.now()}`;
      const saved = saveProjectFile('art', duplicateName, sourceDoc?.data || sourceDoc || {});
      if (saved?.name) {
        next.animation = {
          ...(next.animation || {}),
          artRef: saved.name
        };
      }
    }
    copy.states.push(next);
    this.selectedStateId = next.id;
    this.setActor(copy);
  }

  deleteState(state) {
    if (this.actor.states.length <= 1) return;
    const copy = clone(this.actor);
    copy.states = copy.states.filter((entry) => entry.id !== state.id);
    if (copy.initialStateId === state.id) copy.initialStateId = copy.states[0].id;
    if (copy.deathStateId === state.id) copy.deathStateId = '';
    this.selectedStateId = copy.states[0].id;
    this.setActor(copy);
  }

  moveState(state, direction) {
    const copy = clone(this.actor);
    const index = copy.states.findIndex((entry) => entry.id === state.id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= copy.states.length) return;
    const [item] = copy.states.splice(index, 1);
    copy.states.splice(nextIndex, 0, item);
    this.setActor(copy);
  }

  copyState(state) { this.stateClipboard = clone(state); }
  pasteState() {
    if (!this.stateClipboard) return;
    const copy = clone(this.actor);
    const next = clone(this.stateClipboard);
    next.id = `${next.id}-${Date.now().toString(36)}`;
    next.name = `${next.name} Paste`;
    copy.states.push(next);
    this.selectedStateId = next.id;
    this.setActor(copy);
  }

  updateSelectedState(mutator, options = {}) {
    const copy = clone(this.actor);
    const state = copy.states.find((entry) => entry.id === this.selectedStateId);
    if (!state) return;
    mutator(state, copy);
    this.setActor(copy, options);
  }

  captureScrollState() {
    if (!this.overlay) return null;
    const center = this.overlay.querySelector('.actor-editor-center');
    return center ? { top: center.scrollTop, left: center.scrollLeft } : null;
  }

  restoreScrollState(scrollState) {
    if (!scrollState || !this.overlay) return;
    const center = this.overlay.querySelector('.actor-editor-center');
    if (!center) return;
    center.scrollTop = scrollState.top || 0;
    center.scrollLeft = scrollState.left || 0;
  }

  render() {
    if (!this.overlay) return;
    const focusState = this.captureFocusedInputState();
    const scrollState = this.captureScrollState();
    this.clearPreviewTimers();
    this.ensureStateSelection();
    const actor = this.actor;
    const state = this.selectedState;
    this.overlay.innerHTML = '';
    const shell = el('div', 'actor-editor-shell');
    this.overlay.appendChild(shell);

    const body = el('div', 'actor-editor-body');
    shell.appendChild(body);
    const left = el('div', 'actor-editor-left');
    const center = el('div', 'actor-editor-center');
    const rightRail = el('div', 'actor-editor-right-rail');
    const viewportW = Number(window.innerWidth || 0);
    const viewportH = Number(window.innerHeight || 0);
    const isMobileViewport = Math.min(viewportW, viewportH) <= 900;
    const isMobileLandscape = isMobileViewport && viewportW > viewportH;
    const isMobilePortrait = isMobileViewport && viewportH > viewportW;
    this.hideMobileSectionHeaders = isMobileLandscape;
    const portraitInset = isMobilePortrait ? 8 : 0;
    const portraitLayout = isMobilePortrait
      ? getSharedMobilePortraitEditorLayout(viewportW - portraitInset * 2, viewportH - portraitInset * 2, {
        middleRailHeight: 88,
        minTopHeight: 230,
        minMainHeight: 240
      })
      : null;
    const railWidth = portraitLayout
      ? portraitLayout.leftRail.w
      : isMobileViewport
      ? getSharedMobileRailWidth(viewportW, viewportH)
      : SHARED_EDITOR_LEFT_MENU.width();
    if (portraitLayout) {
      const topMenus = el('div', 'actor-editor-portrait-top actor-editor-portrait-sheet');
      const middleRail = el('div', 'actor-editor-portrait-middle');
      topMenus.append(rightRail, left);
      middleRail.appendChild(this.renderPortraitMiddleRail());
      body.append(center, middleRail);
      const sheetOpen = this.actorPortraitMenuOpen || this.fileMenuOpen || this.controllerMenu.active;
      if (sheetOpen) body.appendChild(topMenus);
      topMenus.style.display = 'flex';
      topMenus.style.flexDirection = 'column';
      topMenus.style.gap = `${portraitLayout.gap}px`;
      topMenus.style.position = 'absolute';
      topMenus.style.left = `${portraitLayout.menuSheet.x}px`;
      topMenus.style.top = `${portraitLayout.menuSheet.y}px`;
      topMenus.style.width = `${portraitLayout.menuSheet.w}px`;
      topMenus.style.height = `${portraitLayout.menuSheet.h}px`;
      topMenus.style.minHeight = '0';
      topMenus.style.zIndex = '12';
      topMenus.style.boxSizing = 'border-box';
      topMenus.style.padding = `${portraitLayout.gap}px`;
      topMenus.style.background = UI_SUITE.colors.panel;
      topMenus.style.border = `1px solid ${UI_SUITE.colors.border}`;
      left.style.height = `${portraitLayout.rootRail.h}px`;
      rightRail.style.height = `${Math.max(1, portraitLayout.menuSheet.h - portraitLayout.rootRail.h - portraitLayout.gap * 3)}px`;
      middleRail.style.height = `${portraitLayout.middleRail.h}px`;
      middleRail.style.minHeight = `${portraitLayout.middleRail.h}px`;
      middleRail.style.overflow = 'hidden';
      center.style.height = `${portraitLayout.mainEditor.h}px`;
    } else {
      body.append(left, center, rightRail);
    }
    shell.style.display = 'flex';
    shell.style.flexDirection = 'column';
    shell.style.height = '100%';
    if (portraitLayout) {
      shell.style.padding = `${portraitInset}px`;
      shell.style.gap = `${portraitLayout.gap}px`;
    }
    body.style.display = 'flex';
    body.style.flexDirection = portraitLayout ? 'column' : 'row';
    body.style.gap = `${SHARED_EDITOR_LEFT_MENU.desktopContentGap}px`;
    body.style.flex = '1';
    body.style.minHeight = '0';
    body.style.overflowX = 'hidden';
    if (portraitLayout) {
      body.style.position = 'relative';
      body.style.gap = `${portraitLayout.gap}px`;
    }
    left.style.width = `${railWidth}px`;
    left.style.flex = `0 0 ${railWidth}px`;
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = `${UI_SUITE.spacing.gap}px`;
    left.style.overflow = 'visible';
    left.style.zIndex = '2';
    center.style.flex = '1';
    center.style.minWidth = '0';
    center.style.overflow = 'auto';
    center.style.overflowX = 'hidden';
    rightRail.style.width = `${railWidth}px`;
    rightRail.style.flex = `0 0 ${railWidth}px`;
    rightRail.style.display = 'flex';
    rightRail.style.flexDirection = 'column';
    rightRail.style.gap = `${UI_SUITE.spacing.gap}px`;
    rightRail.style.minHeight = '0';
    rightRail.style.overflow = 'hidden';

    left.appendChild(this.renderSidebarMenu());
    center.appendChild(this.renderMainPanel(actor, state));
    rightRail.appendChild(this.renderRightRail());
    if (this.game?.input?.isGamepadConnected?.()) {
      shell.appendChild(this.renderGamepadHintBar());
    }
    const controllerMenu = renderDomControllerMenu(this.controllerMenu, { contextLabel: 'Actor Editor' });
    if (controllerMenu) shell.appendChild(controllerMenu);
    if (this.stateGraphOpen) {
      this.overlay.appendChild(this.renderStateGraphModal());
    }
    this.restoreScrollState(scrollState);
    this.restoreFocusedInputState(focusState);
  }

  renderGamepadHintBar() {
    const bar = el('div', 'actor-editor-gamepad-hint');
    const context = el('span', 'actor-editor-gamepad-context', 'Actor Editor');
    const prompts = el('span', 'actor-editor-gamepad-prompts', SHARED_EDITOR_GAMEPAD_HINTS.join('  |  '));
    bar.append(context, prompts);
    return bar;
  }

  renderPortraitMiddleRail() {
    const rail = el('div', 'actor-editor-menu-rail actor-editor-portrait-quickrail');
    Object.assign(rail.style, {
      background: UI_SUITE.colors.panel,
      border: `1px solid ${UI_SUITE.colors.border}`,
      padding: `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`,
      display: 'flex',
      alignItems: 'center',
      gap: `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`,
      height: '100%',
      boxSizing: 'border-box',
      overflowX: 'auto'
    });
    rail.appendChild(this.renderPortraitRailThumbstick());
    [
      ['☰', () => {
        this.actorPortraitMenuOpen = true;
        this.fileMenuOpen = true;
        this.render();
      }],
      ['↶', () => this.undo()],
      ['↷', () => this.redo()],
      ['▶', () => this.playActorScene(), 'Play Scene']
    ].forEach(([label, handler, title]) => {
      const btn = el('button', 'actor-editor-btn', label);
      btn.title = title || label;
      btn.setAttribute('aria-label', title || label);
      btn.style.minWidth = '54px';
      btn.style.minHeight = `${UI_SUITE.spacing.tap}px`;
      this.styleRailButton(btn, false);
      btn.style.width = '54px';
      btn.style.flex = '0 0 54px';
      btn.style.textAlign = 'center';
      btn.style.padding = '8px 0';
      btn.onclick = handler;
      rail.appendChild(btn);
    });
    return rail;
  }

  renderPortraitRailThumbstick() {
    const stick = el('div', 'actor-editor-portrait-rail-thumbstick');
    Object.assign(stick.style, {
      width: '64px',
      height: '64px',
      flex: '0 0 64px',
      borderRadius: '999px',
      border: `2px solid ${UI_SUITE.colors.border}`,
      background: 'rgba(0,0,0,0.42)',
      position: 'relative',
      touchAction: 'none',
      boxSizing: 'border-box'
    });
    const knob = el('div');
    Object.assign(knob.style, {
      width: '28px',
      height: '28px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.85)',
      position: 'absolute',
      left: '16px',
      top: '16px',
      pointerEvents: 'none'
    });
    stick.appendChild(knob);
    let drag = null;
    const centerKnob = () => {
      knob.style.left = '16px';
      knob.style.top = '16px';
    };
    stick.onpointerdown = (event) => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      stick.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    stick.onpointermove = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      const dist = Math.hypot(dx, dy);
      const max = 20;
      const scale = dist > max ? max / dist : 1;
      knob.style.left = `${16 + dx * scale}px`;
      knob.style.top = `${16 + dy * scale}px`;
      const center = this.overlay?.querySelector('.actor-editor-center');
      if (center) {
        center.scrollLeft -= dx * 0.8;
        center.scrollTop -= dy * 0.8;
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
      event.preventDefault();
    };
    const endDrag = (event) => {
      if (drag && (!event || drag.id === event.pointerId)) {
        drag = null;
        centerKnob();
      }
    };
    stick.onpointerup = endDrag;
    stick.onpointercancel = endDrag;
    return stick;
  }

  getGamepadFocusableElements() {
    if (!this.overlay) return [];
    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(this.overlay.querySelectorAll(selector))
      .filter((node) => node.offsetParent !== null && !node.closest('.actor-editor-gamepad-hint'));
  }

  moveGamepadFocus(direction) {
    const elements = this.getGamepadFocusableElements();
    if (!elements.length) return;
    const activeIndex = elements.indexOf(document.activeElement);
    const baseIndex = activeIndex >= 0 ? activeIndex : this.gamepadFocusIndex;
    this.gamepadFocusIndex = (baseIndex + direction + elements.length) % elements.length;
    elements[this.gamepadFocusIndex]?.focus?.({ preventScroll: false });
  }

  handleGamepadInput(input, dt = 0) {
    const normalized = this.inputActionNormalizer.updateGamepad(input, dt, {
      semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS,
      includePanIntent: true,
      includeZoomIntent: true
    });
    if (!normalized.connected || !this.overlay) return;
    this.controllerMenu.setMenus(this.buildControllerMenus(), {
      siblingOrder: ['file', 'states', 'linked-parts', 'tools', 'settings']
    });
    this.controllerMenu.ensureInitialFocus();
    if (!this.overlay.querySelector('.actor-editor-gamepad-hint')) {
      this.render();
      return;
    }
    const { axes, actions } = normalized;
    const hasAction = (type) => actions.some((entry) => entry.type === type);
    const menuWasActive = this.controllerMenu.active;
    const menuWasId = this.controllerMenu.getActiveMenuId();
    const menuWasSelected = this.controllerMenu.selected[menuWasId] ?? 0;
    if (this.controllerMenu.handleActions(actions, axes, dt, this)) {
      this.syncControllerMenuViewState();
      const menuIsId = this.controllerMenu.getActiveMenuId();
      const menuIsSelected = this.controllerMenu.selected[menuIsId] ?? 0;
      if (actions.length || menuWasActive !== this.controllerMenu.active || menuWasId !== menuIsId || menuWasSelected !== menuIsSelected) {
        this.render();
      }
      return;
    }
    this.gamepadFocusRepeat = Math.max(0, this.gamepadFocusRepeat - dt);
    if (hasAction(EDITOR_INPUT_ACTIONS.UNDO)) this.undo();
    if (hasAction(EDITOR_INPUT_ACTIONS.REDO)) this.redo();
    if (hasAction(EDITOR_INPUT_ACTIONS.MENU)) {
      this.activeMenuSection = 'settings';
      this.render();
      return;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.TOOL_OPTIONS)) {
      this.activeMenuSection = 'tools';
      this.fileMenuOpen = false;
      this.render();
      return;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.PANEL_PREV) || hasAction(EDITOR_INPUT_ACTIONS.PANEL_NEXT)) {
      const sections = ['states', 'details', 'animation', 'behavior', 'loot', 'settings'];
      const index = Math.max(0, sections.indexOf(this.activeMenuSection));
      const direction = hasAction(EDITOR_INPUT_ACTIONS.PANEL_NEXT) ? 1 : -1;
      this.activeMenuSection = sections[(index + direction + sections.length) % sections.length];
      this.fileMenuOpen = false;
      this.render();
      return;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.NAV_DOWN) || hasAction(EDITOR_INPUT_ACTIONS.NAV_RIGHT)) this.moveGamepadFocus(1);
    if (hasAction(EDITOR_INPUT_ACTIONS.NAV_UP) || hasAction(EDITOR_INPUT_ACTIONS.NAV_LEFT)) this.moveGamepadFocus(-1);
    if (this.gamepadFocusRepeat <= 0 && Math.hypot(axes.leftX, axes.leftY) > 0.55) {
      this.moveGamepadFocus(Math.abs(axes.leftY) >= Math.abs(axes.leftX) ? Math.sign(axes.leftY) : Math.sign(axes.leftX));
      this.gamepadFocusRepeat = 0.16;
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.CONFIRM)) {
      const target = document.activeElement && this.overlay.contains(document.activeElement)
        ? document.activeElement
        : this.getGamepadFocusableElements()[this.gamepadFocusIndex];
      target?.click?.();
      target?.focus?.();
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.CANCEL)) {
      if (this.stateGraphOpen) {
        this.stateGraphOpen = false;
        this.render();
      } else if (this.fileMenuOpen) {
        this.fileMenuOpen = false;
        this.actorPortraitMenuOpen = false;
        this.render();
      } else if (this.actorPortraitMenuOpen) {
        this.actorPortraitMenuOpen = false;
        this.render();
      }
    }
    if (hasAction(EDITOR_INPUT_ACTIONS.SECONDARY)) {
      const state = this.selectedState;
      if (state && this.actor.states.length > 1) this.deleteState(state);
    }
    const center = this.overlay.querySelector('.actor-editor-center');
    if (center && Math.hypot(axes.rightX, axes.rightY) > 0.12) {
      center.scrollLeft += axes.rightX * 420 * dt;
      center.scrollTop += axes.rightY * 420 * dt;
    }
  }

  syncControllerMenuViewState() {
    const menuId = this.controllerMenu.getActiveMenuId();
    if (menuId === 'file') {
      this.fileMenuOpen = true;
      return;
    }
    if (menuId === 'states' || menuId === 'linked-parts' || menuId === 'tools') {
      this.fileMenuOpen = false;
      this.activeMenuSection = menuId;
      return;
    }
    if (menuId === 'settings') {
      this.fileMenuOpen = false;
      this.activeMenuSection = 'actor';
      return;
    }
    if (menuId === 'root' || !this.controllerMenu.active) {
      this.fileMenuOpen = false;
    }
  }

  buildControllerMenus() {
    const action = (id, label, onSelect, options = {}) => ({ id, label, onSelect, ...options });
    const rootItem = (id, label, submenu = id, section = id) => ({
      id,
      label,
      submenu,
      onEnter: () => {
        this.activeMenuSection = section;
        this.fileMenuOpen = id === 'file';
        this.actorPortraitMenuOpen = true;
        this.render();
      }
    });
    return {
      root: {
        id: 'root',
        title: 'Actor Editor',
        items: [
          rootItem('file', 'File'),
          rootItem('states', 'States'),
          rootItem('linked-parts', 'Linked Parts'),
          rootItem('tools', 'Tools'),
          rootItem('settings', 'Settings', 'settings', 'actor'),
          action('undo', 'Undo', () => this.undo()),
          action('redo', 'Redo', () => this.redo())
        ]
      },
      states: {
        id: 'states',
        title: 'States',
        items: [
          action('add-state', 'Add State', () => this.addState()),
          action('duplicate-state', 'Duplicate State', () => this.duplicateState(this.selectedState)),
          action('delete-state', 'Delete State', () => this.deleteState(this.selectedState)),
          ...this.actor.states.map((state) => action(state.id, state.name || state.id, () => { this.selectedStateId = state.id; this.activeMenuSection = 'states'; this.render(); }))
        ]
      },
      'linked-parts': {
        id: 'linked-parts',
        title: 'Linked Parts',
        items: [
          action('open-linked-parts', 'Open Linked Parts', () => { this.activeMenuSection = 'linked-parts'; this.render(); })
        ]
      },
      tools: {
        id: 'tools',
        title: 'Tools',
        items: [
          action('state-graph', 'State Graph', () => { this.stateGraphOpen = true; this.fileMenuOpen = false; this.render(); }),
          action('playtest', 'Play Scene', () => this.playActorScene()),
          action('collision', 'Collision / Hitbox Zones', () => this.openCollisionZoneEditor(this.actor)),
          action('undo', 'Undo', () => this.undo()),
          action('redo', 'Redo', () => this.redo())
        ]
      },
      settings: {
        id: 'settings',
        title: 'Settings',
        items: [
          action('open-settings', 'Open Settings', () => { this.activeMenuSection = 'actor'; this.fileMenuOpen = false; this.render(); })
        ]
      },
      file: {
        id: 'file',
        title: 'File',
        items: [
          action('new', 'New', () => this.newActor()),
          action('open', 'Open', () => this.openActor()),
          action('save', 'Save', () => this.saveActor(false)),
          action('save-as', 'Save As', () => this.saveActor(true)),
          action('exit-main', 'Exit to Main Menu', () => this.exitToMenu())
        ]
      },
      system: buildControllerSystemMenu({
        fileMenuId: 'file',
        toolsMenuId: 'tools',
        onExit: () => this.exitToMenu()
      }),
      'exit-confirm': buildControllerExitConfirmMenu({
        onExit: () => this.exitToMenu(),
        message: 'Exit Actor Editor and return to the main menu.'
      }),
      help: buildControllerHelpMenu(['D-pad/LS moves menu focus', 'RS scrolls center panel'])
    };
  }

  renderSidebarMenu() {
    const viewportW = Number(window.innerWidth || 0);
    const viewportH = Number(window.innerHeight || 0);
    const isPortraitMobile = Math.min(viewportW, viewportH) <= 900 && viewportH > viewportW;
    const portraitModel = buildActorPortraitMenuModel();
    const menu = el('div', 'actor-editor-menu-rail');
    menu.style.display = 'flex';
    menu.style.flexDirection = isPortraitMobile ? 'row' : 'column';
    menu.style.gap = `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`;
    menu.style.background = UI_SUITE.colors.panel;
    menu.style.border = `1px solid ${UI_SUITE.colors.border}`;
    menu.style.padding = `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`;
    menu.style.height = '100%';
    menu.style.minHeight = '0';
    menu.style.overflowY = isPortraitMobile ? 'hidden' : 'auto';
    menu.style.overflowX = isPortraitMobile ? 'hidden' : 'visible';
    const makeMenuBtn = (label, id, onClick) => {
      const btn = el('button', `actor-editor-btn${this.activeMenuSection === id ? ' active' : ''}`, label);
      const controllerId = id === 'actor' ? 'settings' : id;
      this.styleRailButton(btn, this.activeMenuSection === id, this.controllerMenu.isFocusedItem('root', controllerId));
      if (isPortraitMobile) {
        btn.style.flex = '1 1 0';
        btn.style.minWidth = '0';
        btn.style.textAlign = 'center';
        btn.style.padding = '8px 4px';
      }
      btn.onclick = onClick || (() => {
        this.activeMenuSection = id;
        this.fileMenuOpen = false;
        this.actorPortraitMenuOpen = true;
        this.render();
      });
      return btn;
    };
    const fileBtn = el('button', `actor-editor-btn${this.fileMenuOpen ? ' active' : ''}`, 'File');
    this.styleRailButton(fileBtn, this.fileMenuOpen, this.controllerMenu.isFocusedItem('root', 'file'));
    if (isPortraitMobile) {
      fileBtn.style.flex = '1 1 0';
      fileBtn.style.minWidth = '0';
      fileBtn.style.textAlign = 'center';
      fileBtn.style.padding = '8px 4px';
    }
    fileBtn.onclick = () => {
      this.fileMenuOpen = !this.fileMenuOpen;
      this.actorPortraitMenuOpen = this.fileMenuOpen || this.actorPortraitMenuOpen;
      this.render();
    };
    menu.appendChild(fileBtn);
    const rootTabs = isPortraitMobile
      ? portraitModel.rootTabs.filter((tab) => tab.id !== 'file')
      : [
        { id: 'actor', label: 'Settings' },
        { id: 'states', label: 'States' },
        { id: 'linked-parts', label: 'Linked Parts' },
        { id: 'tools', label: 'Tools' }
      ];
    rootTabs.forEach((tab) => menu.appendChild(makeMenuBtn(tab.label, tab.id)));
    if (isPortraitMobile) return menu;
    const undoBtn = el('button', 'actor-editor-btn', 'Undo');
    this.styleRailButton(undoBtn, false, this.controllerMenu.isFocusedItem('root', 'undo'));
    undoBtn.onclick = () => this.undo();
    menu.appendChild(undoBtn);
    const redoBtn = el('button', 'actor-editor-btn', 'Redo');
    this.styleRailButton(redoBtn, false, this.controllerMenu.isFocusedItem('root', 'redo'));
    redoBtn.onclick = () => this.redo();
    menu.appendChild(redoBtn);
    return menu;
  }

  appendSectionHeading(section, label) {
    if (this.hideMobileSectionHeaders) return;
    section.appendChild(el('h2', '', label));
  }

  getKnownTaxonomyOptions(actor) {
    const options = new Set(DEFAULT_TAXONOMIES);
    (actor?.taxonomies || []).forEach((entry) => options.add(String(entry)));
    (actor?.aggressiveTo || []).forEach((entry) => options.add(String(entry)));
    const actorDocs = listProjectFiles(ACTOR_FOLDER);
    actorDocs.forEach(({ name }) => {
      const payload = loadProjectFile(ACTOR_FOLDER, name);
      const definition = payload?.data || null;
      const normalized = ensureActorDefinition(definition || null);
      (normalized.taxonomies || []).forEach((entry) => options.add(String(entry)));
      (normalized.aggressiveTo || []).forEach((entry) => options.add(String(entry)));
    });
    return Array.from(options).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  renderTaxonomyEditor(actor, {
    key,
    label,
    helperText,
    addLabel = 'Add taxonomy'
  }) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', label));
    if (helperText) section.appendChild(el('div', 'actor-editor-note', helperText));
    const list = actor[key] || [];
    const options = this.getKnownTaxonomyOptions(actor);
    const checkGrid = el('div', 'actor-editor-grid');
    options.forEach((taxonomy) => {
      const toggle = el('label', 'actor-editor-toggle');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = list.includes(taxonomy);
      box.oninput = (event) => {
        const next = clone(actor);
        const current = new Set(next[key] || []);
        if (event.target.checked) current.add(taxonomy);
        else current.delete(taxonomy);
        next[key] = Array.from(current);
        this.setActor(next);
      };
      toggle.append(box, taxonomy);
      checkGrid.appendChild(toggle);
    });
    section.appendChild(checkGrid);

    const addRow = el('div', 'actor-editor-inline-actions');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'custom taxonomy';
    const addBtn = el('button', 'actor-editor-btn', addLabel);
    addBtn.onclick = () => {
      const value = String(input.value || '').trim();
      if (!value) return;
      const next = clone(actor);
      const current = new Set(next[key] || []);
      current.add(value);
      next[key] = Array.from(current);
      this.setActor(next);
      input.value = '';
    };
    addRow.append(input, addBtn);
    section.appendChild(addRow);
    return section;
  }

  renderFileMenuRail() {
    const subRail = el('div', 'actor-editor-file-subrail');
    subRail.style.background = UI_SUITE.colors.panel;
    subRail.style.border = `1px solid ${UI_SUITE.colors.border}`;
    subRail.style.padding = `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`;
    subRail.style.display = 'flex';
    subRail.style.flexDirection = 'column';
    subRail.style.gap = `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`;
    const list = el('div', 'actor-editor-file-subrail-list');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`;
    [
      ['new', 'New', () => this.newActor()],
      ['open', 'Open', () => this.openActor()],
      ['save', 'Save', () => this.saveActor(false)],
      ['save-as', 'Save As', () => this.saveActor(true)]
    ].forEach(([id, label, handler]) => {
      const btn = el('button', 'actor-editor-btn', label);
      this.styleRailButton(btn, false, this.controllerMenu.isFocusedItem('file', id));
      btn.onclick = handler;
      list.appendChild(btn);
    });
    subRail.appendChild(list);
    const exitBtn = el('button', 'actor-editor-btn actor-editor-file-exit-btn', 'Exit to Main Menu');
    this.styleRailButton(exitBtn, false, this.controllerMenu.isFocusedItem('file', 'exit-main'));
    exitBtn.onclick = () => this.exitToMenu();
    subRail.appendChild(exitBtn);
    return subRail;
  }

  renderRightRail() {
    if (this.fileMenuOpen) return this.renderFileMenuRail();
    const activeMenuId = this.controllerMenu.getActiveMenuId();
    if (this.controllerMenu.active && activeMenuId && !['root', 'system', 'help', 'file', 'exit-confirm'].includes(activeMenuId)) {
      return this.renderControllerSubmenuRail(activeMenuId);
    }
    if (this.activeMenuSection === 'states') return this.renderStateRailSection();
    if (this.activeMenuSection === 'actor') return this.renderActorRailSection();
    if (this.activeMenuSection === 'tools') return this.renderToolsRailSection();
    const rail = el('div', 'actor-editor-menu-rail');
    Object.assign(rail.style, {
      background: UI_SUITE.colors.panel,
      border: `1px solid ${UI_SUITE.colors.border}`,
      padding: `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`,
      minHeight: '0',
      height: '100%',
      overflowY: 'auto'
    });
    return rail;
  }

  renderControllerSubmenuRail(menuId) {
    const menu = this.controllerMenu.menus?.[menuId];
    const rail = el('div', 'actor-editor-menu-rail');
    Object.assign(rail.style, {
      background: UI_SUITE.colors.panel,
      border: `1px solid ${UI_SUITE.colors.border}`,
      padding: `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`,
      overflowY: 'auto',
      minHeight: '0',
      height: '100%'
    });
    this.controllerMenu.getItems(menu).forEach((item) => {
      if (item.divider || item.separator) return;
      const btn = el('button', 'actor-editor-btn', item.label);
      this.styleRailButton(btn, this.isControllerMenuItemActive(menuId, item.id), this.controllerMenu.isFocusedItem(menuId, item.id));
      btn.disabled = Boolean(item.disabled);
      btn.onclick = () => item.onSelect?.(this);
      rail.appendChild(btn);
    });
    return rail;
  }

  isControllerMenuItemActive(menuId, itemId) {
    if (menuId === 'states') return itemId === this.selectedStateId;
    return false;
  }

  renderToolsRailSection() {
    const rail = el('div', 'actor-editor-menu-rail');
    Object.assign(rail.style, {
      background: UI_SUITE.colors.panel,
      border: `1px solid ${UI_SUITE.colors.border}`,
      padding: `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`,
      minHeight: '0',
      height: '100%',
      overflowY: 'auto'
    });
    [
      ['State Graph', () => { this.stateGraphOpen = true; this.fileMenuOpen = false; this.render(); }],
      ['Play Scene', () => this.playActorScene()],
      ['Collision / Hitbox Zones', () => this.openCollisionZoneEditor(this.actor)]
    ].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn', label);
      this.styleRailButton(btn, false);
      btn.onclick = handler;
      rail.appendChild(btn);
    });
    return rail;
  }

  renderActorRailSection() {
    const rail = el('div', 'actor-editor-menu-rail');
    Object.assign(rail.style, {
      background: UI_SUITE.colors.panel,
      border: `1px solid ${UI_SUITE.colors.border}`,
      padding: `${SHARED_EDITOR_LEFT_MENU.panelPadding}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: `${SHARED_EDITOR_LEFT_MENU.buttonGap}px`,
      minHeight: '0',
      height: '100%',
      overflowY: 'auto'
    });
    const viewportW = Number(window.innerWidth || 0);
    const viewportH = Number(window.innerHeight || 0);
    const isPortraitMobile = Math.min(viewportW, viewportH) <= 900 && viewportH > viewportW;
    const firstState = this.actor.states?.find((state) => state.id === this.actor.initialStateId) || this.actor.states?.[0];
    const firstFrame = this.getAnimationPreviewFrames(firstState?.animation || {})[0] || null;
    if (!firstFrame?.imageDataUrl) {
      rail.appendChild(el('div', 'actor-editor-note', 'Variant preview appears here once the first state has art.'));
      return rail;
    }
    if (isPortraitMobile) {
      const row = el('div', 'actor-editor-inline-actions');
      row.style.alignItems = 'center';
      row.appendChild(el('div', 'actor-editor-note', 'Variant preview'));
      const compactPreview = el('img');
      compactPreview.src = firstFrame.imageDataUrl;
      compactPreview.alt = 'First state preview';
      Object.assign(compactPreview.style, {
        width: '56px',
        height: '56px',
        objectFit: 'contain',
        imageRendering: 'pixelated',
        border: `1px solid ${UI_SUITE.colors.border}`,
        background: UI_SUITE.colors.panelAlt
      });
      const filter = this.getActorHuePreviewFilter();
      if (filter) compactPreview.style.filter = filter;
      row.appendChild(compactPreview);
      rail.appendChild(row);
      return rail;
    }
    rail.appendChild(el('div', 'actor-editor-note', 'Variant preview (first state)'));
    const preview = el('img');
    preview.src = firstFrame.imageDataUrl;
    preview.alt = 'First state preview';
    preview.style.width = '100%';
    preview.style.imageRendering = 'pixelated';
    preview.style.border = `1px solid ${UI_SUITE.colors.border}`;
    preview.style.background = UI_SUITE.colors.panelAlt;
    const filter = this.getActorHuePreviewFilter();
    if (filter) preview.style.filter = filter;
    rail.appendChild(preview);
    return rail;
  }

  styleRailButton(btn, active = false, focused = false) {
    const viewportW = Number(window.innerWidth || 0);
    const viewportH = Number(window.innerHeight || 0);
    const isMobileViewport = Math.min(viewportW, viewportH) <= 900;
    const buttonHeight = isMobileViewport
      ? UI_SUITE.spacing.tap
      : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop;
    btn.style.display = 'block';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.minHeight = `${buttonHeight}px`;
    btn.style.borderRadius = '0';
    btn.style.border = `1px solid ${UI_SUITE.colors.border}`;
    btn.style.padding = '8px 10px';
    btn.style.background = active ? UI_SUITE.colors.accent : 'rgba(0,0,0,0.6)';
    btn.style.color = active ? UI_SUITE.colors.bg : UI_SUITE.colors.text;
    btn.style.fontFamily = UI_SUITE.font.family;
    btn.style.fontSize = '12px';
    btn.style.lineHeight = '1.15';
    btn.style.overflow = 'hidden';
    btn.style.textOverflow = 'ellipsis';
    btn.style.outline = focused ? `2px solid ${UI_SUITE.colors.accent}` : 'none';
    btn.style.outlineOffset = focused ? '2px' : '0';
  }

  renderStateRailSection() {
    const wrap = el('div', 'actor-editor-list');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';
    const controls = el('div', 'actor-editor-inline-actions');
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '6px';
    [['Add', () => this.addState()], ['Duplicate', () => this.duplicateState(this.selectedState)], ['Remove', () => this.deleteState(this.selectedState)]].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn small', label);
      this.styleRailButton(btn, false);
      if (label === 'Remove' && this.actor.states.length <= 1) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
      btn.onclick = handler;
      controls.appendChild(btn);
    });
    wrap.appendChild(controls);
    this.actor.states.forEach((state) => {
      const badges = [
        state.id === this.actor.initialStateId ? 'start' : '',
        state.id === this.actor.deathStateId ? 'death' : ''
      ].filter(Boolean);
      const label = badges.length ? `${state.name || state.id} (${badges.join(', ')})` : (state.name || state.id);
      const btn = el('button', `actor-editor-btn small${this.selectedStateId === state.id ? ' active' : ''}`, label);
      this.styleRailButton(btn, this.selectedStateId === state.id);
      btn.onclick = () => {
        this.selectedStateId = state.id;
        this.render();
      };
      wrap.appendChild(btn);
    });
    return wrap;
  }

  renderMainPanel(actor, state) {
    const wrap = el('div', 'actor-editor-main-panel');
    if (this.activeMenuSection === 'actor') {
      wrap.appendChild(this.renderActorSettings(actor));
      return wrap;
    }
    if (this.activeMenuSection === 'linked-parts') {
      wrap.appendChild(this.renderLinkedParts(actor));
      return wrap;
    }
    wrap.appendChild(this.renderStateEditor(state));
    return wrap;
  }

  renderActorSettings(actor) {
    const section = el('section', 'actor-editor-card');
    this.appendSectionHeading(section, 'Actor settings');
    const grid = el('div', 'actor-editor-grid');
    section.appendChild(grid);
    const addField = (label, input) => {
      const wrap = el('label', 'actor-editor-field');
      wrap.appendChild(el('span', 'actor-editor-field-label', label));
      wrap.appendChild(input);
      grid.appendChild(wrap);
    };
    const text = (value, onInput, { deferred = false, numeric = false, type = 'text' } = {}) => {
      const input = el('input');
      input.type = type;
      input.value = value ?? '';
      if (numeric) {
        input.inputMode = 'text';
        input.pattern = '-?[0-9]*[.]?[0-9]*';
      }
      if (!deferred) {
        input.oninput = onInput;
        return input;
      }
      const commit = (event) => {
        if (numeric) {
          const raw = String(event.target.value ?? '').trim();
          if (raw === '' || !Number.isFinite(Number(raw))) return;
        }
        onInput(event);
      };
      input.onchange = commit;
      input.onblur = commit;
      input.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commit(event);
        input.blur();
      };
      return input;
    };
    const checkbox = (checked, onInput, labelText = null) => {
      const wrap = el('label', 'actor-editor-toggle');
      const input = el('input'); input.type = 'checkbox'; input.checked = !!checked; input.oninput = onInput; wrap.appendChild(input); if (labelText) wrap.append(labelText); return wrap;
    };
    const select = (value, options, onInput) => {
      const input = el('select');
      options.forEach((option) => { const o = el('option'); o.value = option.id; o.textContent = option.label; if (option.id === value) o.selected = true; input.appendChild(o); });
      input.oninput = onInput; return input;
    };
    addField('Name', text(actor.name, (event) => this.setActor({ ...actor, name: event.target.value }), { deferred: true }));
    addField('Attack who (legacy)', select(actor.attackTarget, ACTOR_ATTACK_TARGETS, (event) => this.setActor({ ...actor, attackTarget: event.target.value })));
    addField('Health', text(actor.health, (event) => this.setActor({ ...actor, health: Number(event.target.value || 0) || 1 }), { deferred: true, numeric: true }));
    const healthTint = actor.healthTint || { enabled: false, color: '#ff3333', maxIntensity: 0.1, keepAfterDeath: false };
    addField('Health tint', checkbox(healthTint.enabled, (event) => this.setActor({
      ...actor,
      healthTint: { ...healthTint, enabled: event.target.checked }
    }), 'Enabled'));
    addField('Health tint color', text(healthTint.color || '#ff3333', (event) => this.setActor({
      ...actor,
      healthTint: { ...healthTint, color: event.target.value || '#ff3333' }
    }), { type: 'color' }));
    addField('Health tint max %', text(Math.round(Number(healthTint.maxIntensity ?? 0.1) * 100), (event) => this.setActor({
      ...actor,
      healthTint: {
        ...healthTint,
        maxIntensity: Math.max(0, Math.min(1, Number(event.target.value || 0) / 100))
      }
    }), { deferred: true, numeric: true }));
    addField('Keep tint after death', checkbox(healthTint.keepAfterDeath, (event) => this.setActor({
      ...actor,
      healthTint: { ...healthTint, keepAfterDeath: event.target.checked }
    }), 'Enabled'));
    const stateOptions = (actor.states || []).map((state) => ({ id: state.id, label: state.name || state.id }));
    addField('First state', select(actor.initialStateId, stateOptions, (event) => this.setActor({ ...actor, initialStateId: event.target.value })));
    addField('Death state', select(actor.deathStateId || '', [{ id: '', label: 'None' }, ...stateOptions], (event) => this.setActor({ ...actor, deathStateId: event.target.value })));
    addField('Destroy after death', checkbox(actor.destroyAfterDeath !== false, (event) => this.setActor({ ...actor, destroyAfterDeath: event.target.checked }), 'Enabled'));
    addField('Collidable after death', checkbox(actor.collidableAfterDeath, (event) => this.setActor({ ...actor, collidableAfterDeath: event.target.checked }), 'Enabled'));
    addField('Respawn on room re-entry', checkbox(actor.respawnOnRoomEntry !== false, (event) => this.setActor({ ...actor, respawnOnRoomEntry: event.target.checked }), 'Enabled'));
    addField('Gravity', checkbox(actor.gravity, (event) => this.setActor({ ...actor, gravity: event.target.checked }), 'On'));
    addField('Body contact damage', checkbox(actor.bodyDamageEnabled, (event) => this.setActor({ ...actor, bodyDamageEnabled: event.target.checked }), 'Enabled'));
    addField('Contact damage amount', text(actor.contactDamage, (event) => this.setActor({ ...actor, contactDamage: Number(event.target.value || 0) || 0 }), { deferred: true, numeric: true }));
    addField('Invulnerable by default', checkbox(actor.invulnerable, (event) => this.setActor({ ...actor, invulnerable: event.target.checked }), 'Enabled'));
    addField('Destructible', checkbox(actor.destructible, (event) => this.setActor({ ...actor, destructible: event.target.checked }), 'Enabled'));
    addField('Root actor', checkbox(actor.isRoot, (event) => this.setActor({ ...actor, isRoot: event.target.checked }), 'Placeable in Level Editor'));
    const facingWrap = el('div', 'actor-editor-inline-actions');
    [
      { id: 'face-player', label: 'Face player' },
      { id: 'face-left', label: 'Face left' },
      { id: 'face-right', label: 'Face right' }
    ].forEach((option) => {
      const label = el('label', 'actor-editor-toggle');
      const input = el('input');
      input.type = 'radio';
      input.name = 'actor-facing-mode';
      input.checked = (actor.facingMode || 'face-player') === option.id;
      input.oninput = () => this.setActor({ ...actor, facingMode: option.id });
      label.appendChild(input);
      label.append(option.label);
      facingWrap.appendChild(label);
    });
    addField('Facing', facingWrap);
    const sizeWrap = el('div', 'actor-editor-inline-actions');
    sizeWrap.style.display = 'flex';
    sizeWrap.style.alignItems = 'center';
    sizeWrap.style.gap = '8px';
    const widthInput = el('input');
    widthInput.type = 'text';
    widthInput.inputMode = 'numeric';
    widthInput.value = String(actor.size.width || 24);
    const commitWidth = (event) => {
      const width = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(width) || width <= 0) return;
      this.setActor({ ...actor, size: { width, height: actor.size.height }, sizeMode: 'manual' });
    };
    widthInput.onchange = commitWidth;
    widthInput.onblur = commitWidth;
    const heightInput = el('input');
    heightInput.type = 'text';
    heightInput.inputMode = 'numeric';
    heightInput.value = String(actor.size.height || 24);
    const commitHeight = (event) => {
      const height = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(height) || height <= 0) return;
      this.setActor({ ...actor, size: { width: actor.size.width, height }, sizeMode: 'manual' });
    };
    heightInput.onchange = commitHeight;
    heightInput.onblur = commitHeight;
    widthInput.style.width = '76px';
    heightInput.style.width = '76px';
    sizeWrap.appendChild(widthInput);
    sizeWrap.appendChild(el('span', 'actor-editor-note', '×'));
    sizeWrap.appendChild(heightInput);
    addField('Size (w × h)', sizeWrap);
    const zoneBtn = el('button', 'actor-editor-btn', 'Collision / Hitbox Zones');
    zoneBtn.type = 'button';
    zoneBtn.onclick = () => this.openCollisionZoneEditor(actor);
    addField('Collision editor', zoneBtn);
    section.appendChild(this.renderTaxonomyEditor(actor, {
      key: 'taxonomies',
      label: 'I belong to taxonomy',
      helperText: 'Pick one or more taxonomy tags that describe this actor.',
      addLabel: 'Add taxonomy'
    }));
    section.appendChild(this.renderTaxonomyEditor(actor, {
      key: 'aggressiveTo',
      label: 'I am aggressive to taxonomy',
      helperText: 'This actor considers these taxonomies hostile.',
      addLabel: 'Add hostile taxonomy'
    }));

    const artAdjustments = el('div', 'actor-editor-subsection');
    artAdjustments.appendChild(el('h3', '', 'Art hue/saturation'));
    artAdjustments.appendChild(el('div', 'actor-editor-note', 'Preview hue/saturation here. Changes are applied to all state art when you Save / Save As.'));
    const controls = el('div', 'actor-editor-inline-actions');
    const hueInput = el('input');
    hueInput.type = 'range';
    hueInput.min = '-180';
    hueInput.max = '180';
    hueInput.step = '1';
    hueInput.value = String(this.actorArtHueShiftDegrees);
    hueInput.style.minWidth = '180px';
    hueInput.style.background = 'linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
    hueInput.oninput = (event) => {
      this.actorArtHueShiftDegrees = Number(event.target.value || 0);
      this.render();
    };
    const satInput = el('input');
    satInput.type = 'range';
    satInput.min = '0';
    satInput.max = '200';
    satInput.step = '1';
    satInput.value = String(this.actorArtHueShiftSaturation);
    satInput.style.minWidth = '180px';
    const hueColor = `hsl(${((Number(this.actorArtHueShiftDegrees || 0) % 360) + 360) % 360} 100% 50%)`;
    satInput.style.background = `linear-gradient(90deg, #808080, ${hueColor})`;
    satInput.oninput = (event) => {
      this.actorArtHueShiftSaturation = Number(event.target.value || 100);
      this.render();
    };
    const resetHue = el('button', 'actor-editor-btn', 'Reset preview');
    resetHue.onclick = () => {
      this.resetActorArtHuePreview();
      this.render();
    };
    controls.append(hueInput, satInput, resetHue);
    artAdjustments.appendChild(controls);
    section.appendChild(artAdjustments);

    const lootSection = el('div', 'actor-editor-subsection');
    lootSection.appendChild(el('h3', '', 'Loot on death'));
    const lootList = el('div', 'actor-editor-list');
    actor.loot.forEach((loot, index) => {
      const row = el('div', 'actor-editor-list-row');
      const itemSelect = select(loot.itemId, LOOT_ITEM_OPTIONS, (event) => {
        const next = clone(actor); next.loot[index].itemId = event.target.value; this.setActor(next);
      });
      const chance = text(loot.probability ?? 1, (event) => { const next = clone(actor); next.loot[index].probability = Number(event.target.value || 0) || 0; this.setActor(next); }, { deferred: true, numeric: true });
      const qty = text(`${loot.minQty ?? 1}-${loot.maxQty ?? 1}`, (event) => {
        const [minQty, maxQty] = String(event.target.value).split('-').map((part) => Number(part));
        const next = clone(actor); next.loot[index].minQty = minQty || 1; next.loot[index].maxQty = maxQty || next.loot[index].minQty; this.setActor(next);
      }, { deferred: true });
      const guaranteed = checkbox(loot.guaranteed, (event) => { const next = clone(actor); next.loot[index].guaranteed = event.target.checked; this.setActor(next); }, 'Guaranteed');
      const remove = el('button', 'actor-editor-btn small', 'Remove');
      remove.onclick = () => { const next = clone(actor); next.loot.splice(index, 1); this.setActor(next); };
      row.append(itemSelect, chance, qty, guaranteed, remove);
      lootList.appendChild(row);
    });
    const addLoot = el('button', 'actor-editor-btn', 'Add loot');
    addLoot.onclick = () => { const next = clone(actor); next.loot.push({ itemId: 'health', probability: 0.3, minQty: 1, maxQty: 1, guaranteed: false }); this.setActor(next); };
    lootSection.append(lootList, addLoot);
    section.appendChild(lootSection);

    const advanced = el('details', 'actor-editor-advanced');
    advanced.appendChild(el('summary', '', 'Advanced'));
    advanced.appendChild(el('div', 'actor-editor-note', `Internal ID auto-generated from name: ${actor.id}`));
    section.appendChild(advanced);
    return section;
  }

  shiftRgbaHue(r, g, b, hueShiftDegrees = 0, saturationPercent = 100) {
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
      if (max === nr) hue = ((ng - nb) / delta) % 6;
      else if (max === ng) hue = (nb - nr) / delta + 2;
      else hue = (nr - ng) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    const saturationScale = Math.max(0, Math.min(2, (Number(saturationPercent || 100) || 100) / 100));
    const adjustedSaturation = Math.max(0, Math.min(1, saturation * saturationScale));
    const nextHue = ((hue + hueShiftDegrees) % 360 + 360) % 360;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * adjustedSaturation;
    const x = chroma * (1 - Math.abs(((nextHue / 60) % 2) - 1));
    const m = lightness - chroma / 2;
    let rr = 0; let gg = 0; let bb = 0;
    if (nextHue < 60) [rr, gg, bb] = [chroma, x, 0];
    else if (nextHue < 120) [rr, gg, bb] = [x, chroma, 0];
    else if (nextHue < 180) [rr, gg, bb] = [0, chroma, x];
    else if (nextHue < 240) [rr, gg, bb] = [0, x, chroma];
    else if (nextHue < 300) [rr, gg, bb] = [x, 0, chroma];
    else [rr, gg, bb] = [chroma, 0, x];
    return {
      r: Math.round((rr + m) * 255),
      g: Math.round((gg + m) * 255),
      b: Math.round((bb + m) * 255)
    };
  }

  async hueShiftImageDataUrl(imageDataUrl, hueShiftDegrees = 0, saturationPercent = 100) {
    if (!imageDataUrl) return imageDataUrl;
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageDataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Number(image.naturalWidth || image.width || 0);
    canvas.height = Number(image.naturalHeight || image.height || 0);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas.width || !canvas.height) return imageDataUrl;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bytes = data.data;
    for (let i = 0; i < bytes.length; i += 4) {
      const alpha = bytes[i + 3];
      if (alpha <= 0) continue;
      const shifted = this.shiftRgbaHue(bytes[i], bytes[i + 1], bytes[i + 2], hueShiftDegrees, saturationPercent);
      bytes[i] = shifted.r;
      bytes[i + 1] = shifted.g;
      bytes[i + 2] = shifted.b;
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  }

  async buildActorHueShiftedCopy(sourceActor, hueShiftDegrees = 0, saturationPercent = 100) {
    const degrees = Number(hueShiftDegrees || 0);
    const saturation = Number(saturationPercent || 100);
    if (Math.abs(degrees) < 0.001 && Math.abs(saturation - 100) < 0.001) return ensureActorDefinition(sourceActor);
    const copy = clone(ensureActorDefinition(sourceActor));
    const cache = new Map();
    const shiftUrl = async (url) => {
      if (!url) return url;
      if (cache.has(url)) return cache.get(url);
      const shifted = await this.hueShiftImageDataUrl(url, degrees, saturation);
      cache.set(url, shifted);
      return shifted;
    };
    for (const state of copy.states || []) {
      if (state?.animation?.imageDataUrl) {
        state.animation.imageDataUrl = await shiftUrl(state.animation.imageDataUrl);
      }
      if (Array.isArray(state?.animation?.frames)) {
        for (const frame of state.animation.frames) {
          if (frame?.imageDataUrl) {
            frame.imageDataUrl = await shiftUrl(frame.imageDataUrl);
          }
        }
      }
    }
    return ensureActorDefinition(copy);
  }


  buildStatePreviewButton(state, { large = false } = {}) {
    const preview = el('button', `actor-editor-preview${large ? ' large' : ''}`);
    preview.type = 'button';
    preview.onclick = (event) => {
      event.stopPropagation();
      this.openStateAnimation(state);
    };
    const frames = this.getAnimationPreviewFrames(state.animation || {});
    if (frames.length) {
      const image = el('img', 'actor-editor-preview-image');
      image.src = frames[0].imageDataUrl;
      image.alt = `${state.name} preview`;
      const previewFilter = this.getActorHuePreviewFilter();
      if (previewFilter) image.style.filter = previewFilter;
      preview.appendChild(image);
      if (large && frames.length > 1) {
        let frameIndex = 0;
        const timer = setInterval(() => {
          frameIndex = (frameIndex + 1) % frames.length;
          image.src = frames[frameIndex].imageDataUrl;
        }, Math.max(80, Number(frames[0].durationMs || Math.round(1000 / Math.max(1, Number(state.animation?.fps || 8))))));
        this.previewTimers.push(timer);
      }
      const label = el('span', 'actor-editor-preview-label', large ? 'Edit animation in Pixel Editor' : `${frames.length}f`);
      preview.appendChild(label);
    } else {
      preview.textContent = large ? 'Create animation in Pixel Editor' : 'Draw';
    }
    return preview;
  }

  renderStateList(actor) {
    const section = el('section', 'actor-editor-card');
    this.appendSectionHeading(section, 'States');
    const controls = el('div', 'actor-editor-toolbar');
    [['Add state', () => this.addState()], ['Duplicate selected', () => this.duplicateState(this.selectedState)]].forEach(([label, handler]) => {
      const btn = el('button', 'actor-editor-btn', label); btn.onclick = handler; controls.appendChild(btn);
    });
    section.appendChild(controls);
    const list = el('div', 'actor-editor-state-list');
    actor.states.forEach((state, index) => {
      const row = el('div', `actor-editor-state-row${this.selectedStateId === state.id ? ' active' : ''}`);
      row.onclick = () => { this.selectedStateId = state.id; this.render(); };
      const preview = this.buildStatePreviewButton(state);
      const meta = el('div', 'actor-editor-state-meta');
      const badges = [
        state.id === actor.initialStateId ? 'start' : '',
        state.id === actor.deathStateId ? 'death' : ''
      ].filter(Boolean);
      meta.append(
        el('strong', '', badges.length ? `${state.name} (${badges.join(', ')})` : state.name),
        el('span', '', `${state.movement.type} • ${(state.transitions || []).length} transition(s)`)
      );
      const rowBtns = el('div', 'actor-editor-inline-actions');
      [['↑', () => this.moveState(state, -1)], ['↓', () => this.moveState(state, 1)], ['Copy', () => this.copyState(state)], ['Duplicate', () => this.duplicateState(state)], ['Delete', () => this.deleteState(state)]].forEach(([label, handler]) => {
        const btn = el('button', 'actor-editor-btn small', label); btn.onclick = (event) => { event.stopPropagation(); handler(); }; rowBtns.appendChild(btn);
      });
      row.append(preview, meta, rowBtns);
      list.appendChild(row);
      if (index === 0) row.dataset.initial = 'true';
    });
    section.appendChild(list);
    return section;
  }

  renderStateEditor(state) {
    const section = el('section', 'actor-editor-card');
    this.appendSectionHeading(section, 'State editor');
    if (!state) return section;
    const name = el('input');
    name.value = state.name;
    const commitStateName = (event) => this.updateSelectedState((draft) => { draft.name = event.target.value; });
    name.onchange = commitStateName;
    name.onblur = commitStateName;
    name.onkeydown = (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitStateName(event);
      name.blur();
    };
    section.appendChild(name);
    section.appendChild(this.buildStatePreviewButton(state, { large: true }));
    const zoneRow = el('div', 'actor-editor-inline-actions');
    const inheritedZones = !Array.isArray(state.collisionZones);
    const inheritToggle = el('label', 'actor-editor-toggle');
    const inheritInput = el('input');
    inheritInput.type = 'checkbox';
    inheritInput.checked = inheritedZones;
    inheritInput.oninput = (event) => this.updateSelectedState((draft) => {
      draft.collisionZones = event.target.checked ? null : clone(this.actor.collisionZones || []);
    });
    inheritToggle.append(inheritInput, 'Inherit actor zones');
    const editStateZones = el('button', 'actor-editor-btn small', 'Edit state zones');
    editStateZones.disabled = inheritedZones;
    editStateZones.style.opacity = inheritedZones ? '0.55' : '1';
    editStateZones.onclick = () => this.openCollisionZoneEditor(this.actor, { state });
    zoneRow.append(inheritToggle, editStateZones);
    section.appendChild(zoneRow);

    const movementWrap = el('div', 'actor-editor-subsection');
    movementWrap.appendChild(el('h3', '', 'Movement behavior'));
    const movementSelect = el('select');
    MOVEMENT_BEHAVIORS.forEach((behavior) => { const option = el('option'); option.value = behavior.id; option.textContent = behavior.label; if (behavior.id === state.movement.type) option.selected = true; movementSelect.appendChild(option); });
    movementSelect.oninput = (event) => this.updateSelectedState((draft) => { draft.movement.type = event.target.value; draft.movement.params = { ...(MOVEMENT_PRESET_TEMPLATES[event.target.value] || {}) }; });
    movementWrap.appendChild(movementSelect);
    const behavior = MOVEMENT_BEHAVIORS.find((entry) => entry.id === state.movement.type) || MOVEMENT_BEHAVIORS[0];
    const behaviorParams = Array.isArray(behavior?.params) ? behavior.params : [];
    movementWrap.appendChild(el('div', 'actor-editor-note', behavior.description));
    behaviorParams.forEach((param) => {
      const field = el('label', 'actor-editor-field');
      field.appendChild(el('span', 'actor-editor-field-label', param));
      const input = el('input');
      input.value = state.movement.params?.[param] ?? '';
      input.inputMode = 'text';
      input.pattern = '-?[0-9]*[.]?[0-9]*';
      const commit = (event) => this.updateSelectedState((draft) => {
        const value = String(event.target.value ?? '').trim();
        draft.movement.params[param] = value === 'true'
          ? true
          : value === 'false'
            ? false
            : value === ''
              ? ''
              : (Number.isFinite(Number(value)) ? Number(value) : event.target.value);
      });
      input.onchange = commit;
      input.onblur = commit;
      input.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commit(event);
        input.blur();
      };
      field.appendChild(input); movementWrap.appendChild(field);
    });
    section.appendChild(movementWrap);

    const overrides = el('div', 'actor-editor-subsection');
    overrides.appendChild(el('h3', '', 'State overrides'));
    const disableTint = el('label', 'actor-editor-toggle');
    const disableTintInput = el('input');
    disableTintInput.type = 'checkbox';
    disableTintInput.checked = state.disableHealthTint === true;
    disableTintInput.oninput = (event) => this.updateSelectedState((draft) => {
      draft.disableHealthTint = event.target.checked;
    });
    disableTint.append(disableTintInput, 'Disable health tint in this state');
    overrides.appendChild(disableTint);
    ['bodyDamageEnabled', 'contactDamage', 'invulnerable'].forEach((key) => {
      const field = el('label', 'actor-editor-field');
      field.appendChild(el('span', 'actor-editor-field-label', key));
      const input = el('input');
      input.value = state.overrides?.[key] ?? '';
      input.placeholder = 'inherit';
      input.inputMode = 'text';
      if (key === 'contactDamage') input.pattern = '-?[0-9]*[.]?[0-9]*';
      const commit = (event) => this.updateSelectedState((draft) => {
        const value = String(event.target.value ?? '').trim();
        draft.overrides[key] = value === ''
          ? null
          : value === 'true'
            ? true
            : value === 'false'
              ? false
              : (Number.isFinite(Number(value)) ? Number(value) : event.target.value);
      });
      input.onchange = commit;
      input.onblur = commit;
      input.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commit(event);
        input.blur();
      };
      field.appendChild(input); overrides.appendChild(field);
    });
    section.appendChild(overrides);

    section.appendChild(this.renderTransitionEditor(state));
    return section;
  }

  renderTransitionEditor(state) {
    const section = el('div', 'actor-editor-subsection');
    const stateOptions = this.actor.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
    section.appendChild(el('h3', '', 'Transitions (edges)'));
    section.appendChild(el('div', 'actor-editor-note', 'Transitions are checked top-to-bottom. The first matching transition runs.'));
    const list = el('div', 'actor-editor-list');
    state.transitions.forEach((transition, transitionIndex) => {
      const card = el('details', 'actor-editor-subsection');
      card.open = true;
      const heading = el('summary', '', transition.name || `Transition ${transitionIndex + 1}`);
      const name = el('input');
      name.value = transition.name || '';
      name.placeholder = `Transition ${transitionIndex + 1}`;
      const commitTransitionName = (event) => this.updateSelectedState((draft) => {
        draft.transitions[transitionIndex].name = event.target.value;
      });
      name.onchange = commitTransitionName;
      name.onblur = commitTransitionName;
      name.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitTransitionName(event);
        name.blur();
      };
      const toolbar = el('div', 'actor-editor-inline-actions');
      [['↑', () => this.moveTransition(transitionIndex, -1)], ['↓', () => this.moveTransition(transitionIndex, 1)], ['Remove', () => this.removeTransition(transitionIndex)]].forEach(([label, handler]) => {
        const btn = el('button', 'actor-editor-btn small', label);
        btn.onclick = handler;
        toolbar.appendChild(btn);
      });
      const mode = el('select');
      ['all', 'any'].forEach((entry) => {
        const option = el('option');
        option.value = entry;
        option.textContent = entry.toUpperCase();
        if (entry === transition.conditionMode) option.selected = true;
        mode.appendChild(option);
      });
      mode.oninput = (event) => this.updateSelectedState((draft) => {
        draft.transitions[transitionIndex].conditionMode = event.target.value;
      });
      card.append(heading, name, mode, toolbar);
      card.appendChild(this.renderConditionEditor(state, transitionIndex, stateOptions));
      card.appendChild(this.renderActionEditor(state, transitionIndex, stateOptions));
      list.appendChild(card);
    });
    const add = el('button', 'actor-editor-btn', 'Add transition');
    add.onclick = () => this.addTransition();
    section.append(list, add);
    return section;
  }

  renderConditionEditor(state, transitionIndex, stateOptions) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', 'Conditions'));
    const transition = state.transitions[transitionIndex];
    const list = el('div', 'actor-editor-list');
    transition.conditions.forEach((condition, index) => {
      const row = el('div', 'actor-editor-list-row');
      const spec = this.getConditionSpec(condition.type);
      const type = el('select');
      CONDITION_TYPES.forEach((entry) => {
        const option = el('option');
        option.value = entry;
        option.textContent = this.getConditionSpec(entry).label;
        if (entry === condition.type) option.selected = true;
        type.appendChild(option);
      });
      type.oninput = (event) => this.updateSelectedState((draft) => {
        const nextType = event.target.value;
        draft.transitions[transitionIndex].conditions[index].type = nextType;
        draft.transitions[transitionIndex].conditions[index].params = this.createParamsFromSpec(this.getConditionSpec(nextType), stateOptions);
      });
      const params = this.renderParamFields({
        fields: spec.fields,
        params: condition.params || {},
        stateOptions,
        onParamInput: (field, value) => this.updateSelectedState((draft) => {
          const nextValue = value === '' ? '' : (field.fromDisplay ? field.fromDisplay(value) : value);
          draft.transitions[transitionIndex].conditions[index].params = draft.transitions[transitionIndex].conditions[index].params || {};
          draft.transitions[transitionIndex].conditions[index].params[field.key] = nextValue;
        })
      });
      const remove = el('button', 'actor-editor-btn small', 'Remove');
      remove.onclick = () => this.updateSelectedState((draft) => {
        draft.transitions[transitionIndex].conditions.splice(index, 1);
        if (!draft.transitions[transitionIndex].conditions.length) draft.transitions[transitionIndex].conditions.push({ id: 'always', type: 'always', params: {} });
      });
      row.append(type, params, remove); list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Add condition');
    add.onclick = () => this.updateSelectedState((draft) => {
      draft.transitions[transitionIndex].conditions.push({ id: `cond-${Date.now()}`, type: 'timer-elapsed', params: this.createParamsFromSpec(this.getConditionSpec('timer-elapsed'), stateOptions) });
    });
    section.append(list, add);
    return section;
  }

  renderActionEditor(state, transitionIndex, stateOptions) {
    const section = el('div', 'actor-editor-subsection');
    section.appendChild(el('h3', '', 'Actions'));
    const transition = state.transitions[transitionIndex];
    const list = el('div', 'actor-editor-list');
    transition.actions.forEach((action, index) => {
      const row = el('div', 'actor-editor-list-row');
      const spec = this.getActionSpec(action.type);
      const type = el('select');
      ACTION_TYPES.forEach((entry) => {
        const option = el('option');
        option.value = entry;
        option.textContent = this.getActionSpec(entry).label;
        if (entry === action.type) option.selected = true;
        type.appendChild(option);
      });
      type.oninput = (event) => this.updateSelectedState((draft) => {
        const nextType = event.target.value;
        draft.transitions[transitionIndex].actions[index].type = nextType;
        draft.transitions[transitionIndex].actions[index].params = this.createParamsFromSpec(this.getActionSpec(nextType), stateOptions);
      });
      const hiddenArtKeys = {
        'emit-particles': new Set(['particleArtRef']),
        'spawn-bullets': new Set(['projectileArtRef']),
        'spawn-beam': new Set(['startArtRef', 'repeatArtRef', 'impactArtRef']),
        'spawn-homing-missile': new Set(['missileArtRef', 'explosionArtRef', 'smokeArtRef'])
      }[action.type];
      const actionFields = hiddenArtKeys
        ? (spec.fields || []).filter((field) => !hiddenArtKeys.has(field.key))
        : spec.fields;
      const params = this.renderParamFields({
        fields: actionFields,
        params: action.params || {},
        stateOptions,
        onParamInput: (field, value) => this.updateSelectedState((draft) => {
          const nextValue = value === '' ? '' : (field.fromDisplay ? field.fromDisplay(value) : value);
          draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
          draft.transitions[transitionIndex].actions[index].params[field.key] = nextValue;
        })
      });
      if (action.type === 'spawn-bullets') {
        const projectileArt = this.buildProjectileArtControl(action.params || {}, (nextArtRef) => {
          this.updateSelectedState((draft) => {
            draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
            draft.transitions[transitionIndex].actions[index].params.projectileArtRef = nextArtRef;
          });
        });
        row.appendChild(projectileArt);
        const pick = el('button', 'actor-editor-btn small', 'Set gun location');
        pick.onclick = async () => {
          const point = await this.openBulletSpawnPicker(state, action.params || {});
          if (!point) return;
          this.updateSelectedState((draft) => {
            draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
            draft.transitions[transitionIndex].actions[index].params.offsetX = point.x;
            draft.transitions[transitionIndex].actions[index].params.offsetY = point.y;
          });
        };
        row.appendChild(pick);
      }
      if (action.type === 'emit-particles') {
        row.appendChild(this.buildActionArtControl(action.params || {}, {
          artKey: 'particleArtRef',
          label: 'Particle sprite',
          emptyLabel: 'Create particle sprite',
          alt: 'Particle sprite preview',
          slotId: `${action.id || 'particles'}-particleArtRef`,
          documentName: String(action.params?.particleArtRef || '').trim() ? '' : this.buildActionSlotArtDocName(action, 'particleArtRef'),
          onCommit: (nextArtRef) => {
            this.updateSelectedState((draft) => {
              draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
              draft.transitions[transitionIndex].actions[index].params.particleArtRef = nextArtRef;
            });
          }
        }));
        const preview = el('button', 'actor-editor-btn small', 'Preview particles');
        preview.onclick = () => this.openParticlePreview(state, action.params || {});
        row.appendChild(preview);
        const pick = el('button', 'actor-editor-btn small', 'Set particle origin');
        pick.onclick = async () => {
          const point = await this.openBulletSpawnPicker(state, action.params || {});
          if (!point) return;
          this.updateSelectedState((draft) => {
            draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
            draft.transitions[transitionIndex].actions[index].params.offsetX = point.x;
            draft.transitions[transitionIndex].actions[index].params.offsetY = point.y;
          });
        };
        row.appendChild(pick);
      }
      if (action.type === 'spawn-beam') {
        const artKeys = ['startArtRef', 'repeatArtRef', 'impactArtRef'];
        const artRefs = artKeys.map((key) => String(action.params?.[key] || '').trim()).filter(Boolean);
        [
          ['startArtRef', 'Start sprite', 'Create start sprite'],
          ['repeatArtRef', 'Repeat sprite', 'Create repeat sprite'],
          ['impactArtRef', 'Impact sprite', 'Create impact sprite']
        ].forEach(([artKey, label, emptyLabel]) => {
          const artRef = String(action.params?.[artKey] || '').trim();
          const isSharedRef = !!artRef && artRefs.filter((ref) => ref === artRef).length > 1;
          row.appendChild(this.buildActionArtControl(action.params || {}, {
            artKey,
            label,
            emptyLabel,
            alt: `${label} preview`,
            slotId: `${action.id || 'beam'}-${artKey}`,
            documentName: (!artRef || isSharedRef) ? this.buildActionSlotArtDocName(action, artKey) : '',
            onCommit: (nextArtRef) => {
              this.updateSelectedState((draft) => {
                draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
                draft.transitions[transitionIndex].actions[index].params[artKey] = nextArtRef;
              });
            }
          }));
        });
        const pick = el('button', 'actor-editor-btn small', 'Set muzzle location');
        pick.onclick = async () => {
          const point = await this.openBulletSpawnPicker(state, action.params || {});
          if (!point) return;
          this.updateSelectedState((draft) => {
            draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
            draft.transitions[transitionIndex].actions[index].params.offsetX = point.x;
            draft.transitions[transitionIndex].actions[index].params.offsetY = point.y;
          });
        };
        row.appendChild(pick);
      }
      if (action.type === 'spawn-homing-missile') {
        const artKeys = ['missileArtRef', 'explosionArtRef', 'smokeArtRef'];
        const artRefs = artKeys.map((key) => String(action.params?.[key] || '').trim()).filter(Boolean);
        [
          ['missileArtRef', 'Missile sprite', 'Create missile sprite'],
          ['explosionArtRef', 'Explosion sprite', 'Create explosion sprite'],
          ['smokeArtRef', 'Smoke trail sprite', 'Create smoke trail sprite']
        ].forEach(([artKey, label, emptyLabel]) => {
          const artRef = String(action.params?.[artKey] || '').trim();
          const isSharedRef = !!artRef && artRefs.filter((ref) => ref === artRef).length > 1;
          row.appendChild(this.buildActionArtControl(action.params || {}, {
            artKey,
            label,
            emptyLabel,
            alt: `${label} preview`,
            slotId: `${action.id || 'missile'}-${artKey}`,
            documentName: (!artRef || isSharedRef) ? this.buildActionSlotArtDocName(action, artKey) : '',
            onCommit: (nextArtRef) => {
              this.updateSelectedState((draft) => {
                draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
                draft.transitions[transitionIndex].actions[index].params[artKey] = nextArtRef;
              });
            }
          }));
        });
        const pick = el('button', 'actor-editor-btn small', 'Set muzzle location');
        pick.onclick = async () => {
          const point = await this.openBulletSpawnPicker(state, action.params || {});
          if (!point) return;
          this.updateSelectedState((draft) => {
            draft.transitions[transitionIndex].actions[index].params = draft.transitions[transitionIndex].actions[index].params || {};
            draft.transitions[transitionIndex].actions[index].params.offsetX = point.x;
            draft.transitions[transitionIndex].actions[index].params.offsetY = point.y;
          });
        };
        row.appendChild(pick);
      }
      const moveUp = el('button', 'actor-editor-btn small', '↑');
      moveUp.type = 'button';
      moveUp.title = 'Move action up';
      moveUp.disabled = index === 0;
      moveUp.onclick = () => this.updateSelectedState((draft) => {
        const actions = draft.transitions[transitionIndex].actions;
        if (!Array.isArray(actions) || index <= 0 || index >= actions.length) return;
        [actions[index - 1], actions[index]] = [actions[index], actions[index - 1]];
      });
      const moveDown = el('button', 'actor-editor-btn small', '↓');
      moveDown.type = 'button';
      moveDown.title = 'Move action down';
      moveDown.disabled = index >= transition.actions.length - 1;
      moveDown.onclick = () => this.updateSelectedState((draft) => {
        const actions = draft.transitions[transitionIndex].actions;
        if (!Array.isArray(actions) || index < 0 || index >= actions.length - 1) return;
        [actions[index], actions[index + 1]] = [actions[index + 1], actions[index]];
      });
      const remove = el('button', 'actor-editor-btn small', 'Remove');
      remove.onclick = () => this.updateSelectedState((draft) => { draft.transitions[transitionIndex].actions.splice(index, 1); });
      row.append(type, params, moveUp, moveDown, remove); list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Add action'); add.onclick = () => this.updateSelectedState((draft, actorDraft) => {
      const actorStateOptions = actorDraft.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
      draft.transitions[transitionIndex].actions.push({ id: `action-${Date.now()}`, type: 'switch-state', params: this.createParamsFromSpec(this.getActionSpec('switch-state'), actorStateOptions) });
    });
    section.append(list, add);
    return section;
  }

  openParticlePreview(state, params = {}) {
    const actorFrame = this.getAnimationPreviewFrames(state?.animation || {})[0] || null;
    const particleFrames = this.getProjectileArtPreviewFrames(params.particleArtRef || '');
    const modal = el('div', 'actor-editor-overlay actor-editor-dialog-overlay');
    const card = el('div', 'actor-editor-card actor-editor-modal-card');
    Object.assign(card.style, {
      width: 'min(96vw, 920px)',
      height: 'min(88dvh, 720px)'
    });
    const title = el('div', '', 'Particle preview');
    const canvas = el('canvas');
    canvas.width = 800;
    canvas.height = 520;
    Object.assign(canvas.style, {
      width: '100%',
      flex: '1',
      minHeight: '0',
      background: '#07111f',
      border: '1px solid rgba(255,255,255,0.22)',
      imageRendering: 'pixelated'
    });
    const actions = el('div', 'actor-editor-inline-actions');
    const restart = el('button', 'actor-editor-btn small', 'Restart');
    const close = el('button', 'actor-editor-btn small', 'Close');
    actions.append(restart, close);
    card.append(title, canvas, actions);
    modal.appendChild(card);
    document.body.appendChild(modal);

    const loadImage = (src) => new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });

    let raf = 0;
    let closed = false;
    let lastTime = 0;
    let emitTimer = 0;
    let particles = [];
    let actorImage = null;
    let particleImages = [];
    const count = Math.max(1, Math.min(256, Math.floor(Number(params.count || 1))));
    const radius = Math.max(0, Number(params.radius || 0));
    const speed = Math.max(0, Number(params.speed || 0));
    const speedRandomness = Math.max(0, Number(params.speedRandomness || 0));
    const spread = Math.max(0, Number(params.spread ?? Math.PI * 2));
    const size = Math.max(1, Number(params.size || 4));
    const sizeRandomness = Math.max(0, Number(params.sizeRandomness || 0));
    const lifeMs = Math.max(16, Number(params.lifeMs || 450));
    const lifeRandomnessMs = Math.max(0, Number(params.lifeRandomnessMs || 0));
    const cooldown = Math.max(0.016, Number(params.cooldownMs ?? 100) / 1000);
    const color = String(params.color || 'rgba(255,95,46,0.9)');
    const gravity = params.gravity === true || params.gravity === 'true';
    const gravityScale = Math.max(0, Number(params.gravityScale ?? 1));
    const spin = Number(params.spin || 0);
    const frameDuration = Math.max(16, Number(params.frameDurationMs || 120)) / 1000;
    const baseAngle = Number(params.angle || 0);

    const getActorDraw = () => {
      const frameDims = readPngDataUrlDimensions(actorFrame?.imageDataUrl || '') || { width: 32, height: 32 };
      const imageScaledW = frameDims.width > 0 ? (frameDims.width / 16) * 32 : frameDims.width;
      const imageScaledH = frameDims.height > 0 ? (frameDims.height / 16) * 32 : frameDims.height;
      const actorW = Math.max(Number(this.actor?.size?.width || 32), imageScaledW || 0);
      const actorH = Math.max(Number(this.actor?.size?.height || 32), imageScaledH || 0);
      const scale = Math.min(
        (canvas.width - 160) / Math.max(1, actorW),
        (canvas.height - 120) / Math.max(1, actorH),
        1.4
      );
      return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        w: actorW * scale,
        h: actorH * scale,
        scale
      };
    };

    const spawnBurst = () => {
      const draw = getActorDraw();
      const originX = draw.x + Number(params.offsetX || 0) * draw.scale;
      const originY = draw.y + Number(params.offsetY || 0) * draw.scale;
      for (let i = 0; i < count; i += 1) {
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnRadius = Math.sqrt(Math.random()) * radius * draw.scale;
        const particleAngle = baseAngle + (Math.random() - 0.5) * spread;
        const particleSpeed = Math.max(0, speed + (Math.random() * 2 - 1) * speedRandomness) * draw.scale;
        const particleSize = Math.max(1, size + (Math.random() * 2 - 1) * sizeRandomness) * draw.scale;
        const life = Math.max(0.016, (lifeMs + (Math.random() * 2 - 1) * lifeRandomnessMs) / 1000);
        particles.push({
          x: originX + Math.cos(spawnAngle) * spawnRadius,
          y: originY + Math.sin(spawnAngle) * spawnRadius,
          vx: Math.cos(particleAngle) * particleSpeed,
          vy: Math.sin(particleAngle) * particleSpeed,
          life,
          maxLife: life,
          size: particleSize,
          angle: particleAngle,
          spin: spin + (Math.random() * 2 - 1) * Math.abs(spin),
          frameOffset: Math.random()
        });
      }
      if (particles.length > 900) particles.splice(0, particles.length - 900);
    };

    const reset = () => {
      particles = [];
      emitTimer = 0;
      lastTime = performance.now();
      spawnBurst();
    };

    const render = (time) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dt = Math.min(0.05, Math.max(0, (time - lastTime) / 1000 || 0));
      lastTime = time;
      emitTimer -= dt;
      while (emitTimer <= 0) {
        spawnBurst();
        emitTimer += cooldown;
      }
      particles.forEach((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.angle += particle.spin * dt;
        if (gravity) particle.vy += 900 * gravityScale * dt * getActorDraw().scale;
      });
      particles = particles.filter((particle) => particle.life > 0);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#07111f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const draw = getActorDraw();
      if (actorImage) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(actorImage, draw.x - draw.w / 2, draw.y - draw.h / 2, draw.w, draw.h);
        ctx.restore();
      }
      const originX = draw.x + Number(params.offsetX || 0) * draw.scale;
      const originY = draw.y + Number(params.offsetY || 0) * draw.scale;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(originX - 10, originY);
      ctx.lineTo(originX + 10, originY);
      ctx.moveTo(originX, originY - 10);
      ctx.lineTo(originX, originY + 10);
      ctx.stroke();
      ctx.restore();
      particles.forEach((particle) => {
        const alpha = Math.max(0, Math.min(1, particle.life / Math.max(0.0001, particle.maxLife)));
        ctx.save();
        ctx.globalAlpha = alpha;
        if (particleImages.length) {
          const frameIndex = Math.floor(((particle.maxLife - particle.life) / frameDuration + particle.frameOffset * particleImages.length)) % particleImages.length;
          const image = particleImages[frameIndex];
          const scale = Math.max(0.05, particle.size / Math.max(1, Math.max(image.width, image.height)));
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.angle || 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, Math.max(1.5, particle.size * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      raf = requestAnimationFrame(render);
    };

    const cleanup = () => {
      closed = true;
      cancelAnimationFrame(raf);
      modal.remove();
    };
    restart.onclick = reset;
    close.onclick = cleanup;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) cleanup();
    });

    Promise.all([
      loadImage(actorFrame?.imageDataUrl || ''),
      Promise.all(particleFrames.map((frame) => loadImage(frame.imageDataUrl)))
    ]).then(([nextActorImage, nextParticleImages]) => {
      if (closed) return;
      actorImage = nextActorImage;
      particleImages = nextParticleImages.filter(Boolean);
      reset();
      raf = requestAnimationFrame(render);
    });
  }

  async openBulletSpawnPicker(state, params = {}) {
    const frame = this.getAnimationPreviewFrames(state?.animation || {})[0];
    if (!frame?.imageDataUrl) return null;
    return new Promise((resolve) => {
      const modal = el('div', 'actor-editor-overlay actor-editor-dialog-overlay');
      const card = el('div', 'actor-editor-card actor-editor-modal-card');
      card.style.width = 'min(90vw, 1280px)';
      card.style.height = '82vh';
      card.appendChild(el('div', '', 'Tap gun spawn location, then press OK'));
      const stage = el('div');
      stage.className = 'actor-editor-canvas-stage';
      stage.style.flex = '1';
      stage.style.display = 'flex';
      stage.style.alignItems = 'center';
      stage.style.justifyContent = 'center';
      const img = el('img');
      img.src = frame.imageDataUrl;
      img.style.maxWidth = '94vw';
      img.style.maxHeight = '78vh';
      img.style.imageRendering = 'pixelated';
      img.style.cursor = 'crosshair';
      img.style.display = 'block';
      img.style.touchAction = 'none';
      stage.appendChild(img);
      let zoom = 1.25;
      let panX = 0;
      let panY = 0;
      const applyZoom = () => {
        img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        img.style.transformOrigin = 'center center';
      };
      const clampPan = () => {
        const stageRect = stage.getBoundingClientRect();
        const baseW = Math.max(1, img.offsetWidth || img.clientWidth || 1);
        const baseH = Math.max(1, img.offsetHeight || img.clientHeight || 1);
        const scaledW = baseW * zoom;
        const scaledH = baseH * zoom;
        const maxPanX = (stageRect.width / 2) + (scaledW / 2) - 1;
        const maxPanY = (stageRect.height / 2) + (scaledH / 2) - 1;
        const minPanX = -maxPanX;
        const minPanY = -maxPanY;
        panX = Math.max(minPanX, Math.min(maxPanX, panX));
        panY = Math.max(minPanY, Math.min(maxPanY, panY));
      };
      applyZoom();
      const crosshair = el('div');
      crosshair.style.position = 'absolute';
      crosshair.style.width = '28px';
      crosshair.style.height = '28px';
      crosshair.style.marginLeft = '-14px';
      crosshair.style.marginTop = '-14px';
      crosshair.style.border = '2px solid #ff5555';
      crosshair.style.borderRadius = '50%';
      crosshair.style.pointerEvents = 'none';
      crosshair.style.display = 'none';
      const hLine = el('div');
      hLine.style.position = 'absolute';
      hLine.style.left = '-10px';
      hLine.style.top = '12px';
      hLine.style.width = '48px';
      hLine.style.height = '2px';
      hLine.style.background = '#ff5555';
      const vLine = el('div');
      vLine.style.position = 'absolute';
      vLine.style.left = '12px';
      vLine.style.top = '-10px';
      vLine.style.width = '2px';
      vLine.style.height = '48px';
      vLine.style.background = '#ff5555';
      crosshair.append(hLine, vLine);
      stage.appendChild(crosshair);
      card.appendChild(stage);
      const actions = el('div', 'actor-editor-inline-actions');
      actions.style.display = 'flex';
      actions.style.alignItems = 'center';
      actions.style.justifyContent = 'space-between';
      actions.style.flexWrap = 'nowrap';
      actions.style.width = '100%';
      actions.style.gap = '8px';
      actions.style.height = '72px';
      actions.style.paddingTop = '2px';
      actions.style.paddingBottom = '2px';
      const zoomIn = el('button', 'actor-editor-btn small', 'Zoom +');
      const zoomOut = el('button', 'actor-editor-btn small', 'Zoom -');
      const resetView = el('button', 'actor-editor-btn small', 'Reset');
      zoomIn.onclick = () => { zoom = Math.min(16, zoom * 1.25); clampPan(); applyZoom(); updateCrosshairFromPicked(); };
      zoomOut.onclick = () => { zoom = Math.max(1, zoom / 1.25); clampPan(); applyZoom(); updateCrosshairFromPicked(); };
      resetView.onclick = () => { zoom = 1; panX = 0; panY = 0; applyZoom(); updateCrosshairFromPicked(); };
      let picked = null;
      const ok = el('button', 'actor-editor-btn', 'OK');
      ok.disabled = true;
      ok.style.opacity = '0.6';
      const closePicker = (result = null) => {
        stopJoystickPan();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('blur', onWindowBlur);
        modal.remove();
        resolve(result);
      };
      ok.onclick = () => {
        if (!picked) return;
        closePicker(picked);
      };
      const cancel = el('button', 'actor-editor-btn', 'Cancel');
      cancel.onclick = () => closePicker(null);
      const joystick = el('div');
      joystick.style.width = '92px';
      joystick.style.height = '92px';
      joystick.style.borderRadius = '50%';
      joystick.style.border = '1px solid rgba(255,255,255,0.35)';
      joystick.style.position = 'relative';
      joystick.style.background = 'rgba(0,0,0,0.25)';
      joystick.style.touchAction = 'none';
      const knob = el('div');
      knob.style.width = '34px';
      knob.style.height = '34px';
      knob.style.borderRadius = '50%';
      knob.style.background = 'rgba(255,255,255,0.7)';
      knob.style.position = 'absolute';
      knob.style.left = '29px';
      knob.style.top = '29px';
      joystick.appendChild(knob);
      const spacer = el('div');
      spacer.style.flex = '1 1 auto';
      actions.append(joystick, zoomIn, zoomOut, resetView, spacer, ok, cancel);
      [zoomOut, zoomIn, resetView, ok, cancel].forEach((btn) => {
        btn.style.padding = '8px 12px';
        btn.style.minHeight = '44px';
      });
      card.appendChild(actions);
      const updateCrosshairFromPicked = () => {
        if (!picked) return;
        const rect = img.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const nativeW = Math.max(1, img.naturalWidth || Number(state?.animation?.width || 32));
        const nativeH = Math.max(1, img.naturalHeight || Number(state?.animation?.height || 32));
        const imageScaledW = nativeW > 0 ? (nativeW / 16) * 32 : nativeW;
        const imageScaledH = nativeH > 0 ? (nativeH / 16) * 32 : nativeH;
        const drawW = Math.max(Number(this.actor?.size?.width || 32), imageScaledW || 0);
        const drawH = Math.max(Number(this.actor?.size?.height || 32), imageScaledH || 0);
        const relX = (picked.x + drawW / 2) / drawW;
        const relY = (picked.y + drawH / 2) / drawH;
        crosshair.style.left = `${rect.left - stageRect.left + relX * rect.width}px`;
        crosshair.style.top = `${rect.top - stageRect.top + relY * rect.height}px`;
        crosshair.style.display = 'block';
      };
      const setPickFromClient = (clientX, clientY) => {
        const rect = img.getBoundingClientRect();
        const relX = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
        const relY = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
        const nativeW = Math.max(1, img.naturalWidth || Number(state?.animation?.width || 32));
        const nativeH = Math.max(1, img.naturalHeight || Number(state?.animation?.height || 32));
        const imageScaledW = nativeW > 0 ? (nativeW / 16) * 32 : nativeW;
        const imageScaledH = nativeH > 0 ? (nativeH / 16) * 32 : nativeH;
        const width = Math.max(Number(this.actor?.size?.width || 32), imageScaledW || 0);
        const height = Math.max(Number(this.actor?.size?.height || 32), imageScaledH || 0);
        picked = {
          x: Math.round(relX * width - width / 2),
          y: Math.round(relY * height - height / 2)
        };
        updateCrosshairFromPicked();
        ok.disabled = false;
        ok.style.opacity = '1';
      };
      const nativeW = Math.max(1, img.naturalWidth || Number(state?.animation?.width || 32));
      const nativeH = Math.max(1, img.naturalHeight || Number(state?.animation?.height || 32));
      const imageScaledW = nativeW > 0 ? (nativeW / 16) * 32 : nativeW;
      const imageScaledH = nativeH > 0 ? (nativeH / 16) * 32 : nativeH;
      const width = Math.max(Number(this.actor?.size?.width || 32), imageScaledW || 0);
      const height = Math.max(Number(this.actor?.size?.height || 32), imageScaledH || 0);
      picked = {
        x: Number.isFinite(Number(params?.offsetX)) ? Number(params.offsetX) : 0,
        y: Number.isFinite(Number(params?.offsetY)) ? Number(params.offsetY) : 0
      };
      picked.x = Math.max(-Math.floor(width / 2), Math.min(Math.ceil(width / 2), picked.x));
      picked.y = Math.max(-Math.floor(height / 2), Math.min(Math.ceil(height / 2), picked.y));
      ok.disabled = false;
      ok.style.opacity = '1';
      requestAnimationFrame(() => updateCrosshairFromPicked());
      img.onclick = (event) => {
        setPickFromClient(event.clientX, event.clientY);
      };
      let pinchDistance = null;
      const getTouchDistance = (touches) => {
        if (!touches || touches.length < 2) return null;
        const a = touches[0];
        const b = touches[1];
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      };
      stage.addEventListener('touchstart', (event) => {
        pinchDistance = getTouchDistance(event.touches);
      }, { passive: true });
      let panTouch = null;
      stage.addEventListener('touchmove', (event) => {
        if (joystickDrag) return;
        const nextDistance = getTouchDistance(event.touches);
        if (!nextDistance || !pinchDistance) return;
        const ratio = nextDistance / Math.max(1, pinchDistance);
        if (Math.abs(ratio - 1) < 0.04) return;
        zoom = Math.max(1, Math.min(16, zoom * ratio));
        pinchDistance = nextDistance;
        clampPan();
        applyZoom();
        updateCrosshairFromPicked();
      }, { passive: true });
      stage.addEventListener('touchend', () => { pinchDistance = null; }, { passive: true });
      let joystickDrag = false;
      let joystickVector = { x: 0, y: 0 };
      let joystickTimer = null;
      let lastTick = 0;
      const updateJoystick = (clientX, clientY) => {
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const radius = rect.width * 0.35;
        const mag = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, radius / mag);
        const ndx = dx * k;
        const ndy = dy * k;
        knob.style.left = `${rect.width / 2 + ndx - 17}px`;
        knob.style.top = `${rect.height / 2 + ndy - 17}px`;
        joystickVector = {
          x: Math.max(-1, Math.min(1, ndx / Math.max(1, radius))),
          y: Math.max(-1, Math.min(1, ndy / Math.max(1, radius)))
        };
      };
      const startJoystickPan = () => {
        if (joystickTimer) return;
        lastTick = performance.now();
        joystickTimer = window.setInterval(() => {
          if (!joystickDrag) return;
          const now = performance.now();
          const dt = Math.max(0.5, Math.min(2.2, (now - lastTick) / 16));
          lastTick = now;
          const deadzone = 0.03;
          const rawX = joystickVector.x;
          const rawY = joystickVector.y;
          const mag = Math.hypot(rawX, rawY);
          if (mag <= deadzone) return;
          const analog = Math.min(1, (mag - deadzone) / (1 - deadzone));
          const nx = rawX / mag;
          const ny = rawY / mag;
          const frameScale = dt;
          const speed = 8;
          panX -= nx * analog * speed * frameScale;
          panY -= ny * analog * speed * frameScale;
          clampPan();
          applyZoom();
          updateCrosshairFromPicked();
        }, 16);
      };
      const stopJoystickPan = () => {
        if (joystickTimer) window.clearInterval(joystickTimer);
        joystickTimer = null;
      };
      joystick.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        joystickDrag = true;
        updateJoystick(event.clientX, event.clientY);
        startJoystickPan();
        joystick.setPointerCapture?.(event.pointerId);
      });
      const onPointerMove = (event) => { if (joystickDrag) updateJoystick(event.clientX, event.clientY); };
      const onPointerUp = () => {
        joystickDrag = false;
        joystickVector = { x: 0, y: 0 };
        stopJoystickPan();
        knob.style.left = '29px';
        knob.style.top = '29px';
      };
      const onWindowBlur = () => onPointerUp();
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('blur', onWindowBlur);
      stage.addEventListener('pointerdown', (event) => {
        if (joystickDrag) return;
        if (event.pointerType !== 'touch') return;
        event.preventDefault();
        panTouch = { x: event.clientX, y: event.clientY };
      });
      stage.addEventListener('pointermove', (event) => {
        if (joystickDrag) return;
        if (!panTouch || event.pointerType !== 'touch') return;
        event.preventDefault();
        panX += (event.clientX - panTouch.x);
        panY += (event.clientY - panTouch.y);
        panTouch = { x: event.clientX, y: event.clientY };
        clampPan();
        applyZoom();
        updateCrosshairFromPicked();
      });
      stage.addEventListener('pointerup', () => { panTouch = null; });
      modal.appendChild(card);
      document.body.appendChild(modal);
    });
  }

  addTransition() {
    this.updateSelectedState((draft, actorDraft) => {
      const actorStateOptions = actorDraft.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
      const transitionIndex = draft.transitions.length + 1;
      draft.transitions.push({
        id: `transition-${Date.now()}`,
        name: `Transition ${transitionIndex}`,
        conditionMode: 'all',
        conditions: [{ id: `cond-${Date.now()}`, type: 'timer-elapsed', params: this.createParamsFromSpec(this.getConditionSpec('timer-elapsed'), actorStateOptions) }],
        actions: [{ id: `action-${Date.now()}`, type: 'switch-state', params: this.createParamsFromSpec(this.getActionSpec('switch-state'), actorStateOptions) }]
      });
    });
  }

  moveTransition(index, delta) {
    this.updateSelectedState((draft) => {
      const next = index + delta;
      if (next < 0 || next >= draft.transitions.length) return;
      const [entry] = draft.transitions.splice(index, 1);
      draft.transitions.splice(next, 0, entry);
    });
  }

  removeTransition(index) {
    this.updateSelectedState((draft, actorDraft) => {
      draft.transitions.splice(index, 1);
      if (draft.transitions.length) return;
      const actorStateOptions = actorDraft.states.map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
      draft.transitions.push({
        id: `transition-${Date.now()}`,
        name: 'Transition 1',
        conditionMode: 'all',
        conditions: [{ id: 'always', type: 'always', params: {} }],
        actions: [{ id: `action-${Date.now()}`, type: 'switch-state', params: this.createParamsFromSpec(this.getActionSpec('switch-state'), actorStateOptions) }]
      });
    });
  }

  renderLinkedParts(actor) {
    const section = el('section', 'actor-editor-card');
    this.appendSectionHeading(section, 'Linked parts');
    section.appendChild(el('div', 'actor-editor-note', 'Only root actors are placeable in Level Editor. Linked child parts spawn with the root.'));
    const list = el('div', 'actor-editor-list');
    actor.linkedParts.forEach((part, index) => {
      const row = el('div', 'actor-editor-list-row');
      row.append(el('strong', '', part.actorName || part.actorId), el('span', '', `offset ${part.offsetX || 0}, ${part.offsetY || 0} • role ${part.role || 'part'}`));
      const remove = el('button', 'actor-editor-btn small', 'Unlink');
      remove.onclick = () => { const next = clone(actor); next.linkedParts.splice(index, 1); this.setActor(next); };
      row.appendChild(remove);
      list.appendChild(row);
    });
    const add = el('button', 'actor-editor-btn', 'Link child actor');
    add.onclick = async () => {
      await openProjectBrowser({
        fixedFolder: ACTOR_FOLDER,
        initialFolder: ACTOR_FOLDER,
        title: 'Link child actor',
        onOpen: ({ payload, name }) => {
          const definition = ensureActorDefinition(payload?.data || createDefaultActor(name));
          const next = clone(actor);
          next.linkedParts.push({ actorId: definition.id, actorName: definition.name, offsetX: 0, offsetY: 0, role: 'part', sync: 'state' });
          this.setActor(next);
        }
      });
    };
    section.append(list, add);
    return section;
  }

  describeCondition(condition) {
    const spec = this.getConditionSpec(condition?.type);
    const base = spec?.label || toTitleLabel(condition?.type || 'condition');
    const fields = Array.isArray(spec?.fields) ? spec.fields : [];
    if (!fields.length) return base;
    const parts = fields.map((field) => {
      const rawValue = condition?.params?.[field.key];
      const value = field.toDisplay ? field.toDisplay(rawValue) : rawValue;
      return `${field.label}: ${value ?? field.defaultValue ?? ''}`;
    }).filter(Boolean);
    return parts.length ? `${base} (${parts.join(', ')})` : base;
  }

  renderStateGraphModal() {
    const scrim = el('div', 'actor-editor-overlay-scrim');
    const card = el('div', 'actor-editor-card');
    Object.assign(card.style, {
      width: 'min(980px, 92vw)',
      maxHeight: '85vh',
      overflow: 'auto',
      padding: '16px'
    });
    const head = el('div', 'actor-editor-toolbar');
    head.append(el('h2', '', 'State graph preview'));
    const close = el('button', 'actor-editor-btn', 'Close');
    close.onclick = () => {
      this.stateGraphOpen = false;
      this.render();
    };
    head.appendChild(close);
    card.appendChild(head);
    const note = el('div', 'actor-editor-note', 'Transitions are shown in evaluation order (top to bottom).');
    card.appendChild(note);

    this.actor.states.forEach((state) => {
      const stateSection = el('div', 'actor-editor-subsection');
      const title = el('h3', '', state.name || state.id);
      stateSection.appendChild(title);
      const previewRow = el('div', 'actor-editor-inline-actions');
      const frame = this.getAnimationPreviewFrames(state.animation || {})[0] || null;
      if (frame?.imageDataUrl) {
        const preview = el('img');
        preview.src = frame.imageDataUrl;
        preview.alt = `${state.name || state.id} preview`;
        Object.assign(preview.style, {
          width: '48px',
          height: '48px',
          imageRendering: 'pixelated',
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(0,0,0,0.35)'
        });
        previewRow.appendChild(preview);
      }
      const transitions = Array.isArray(state.transitions) ? state.transitions : [];
      if (!transitions.length) {
        previewRow.appendChild(el('div', 'actor-editor-note', 'No transitions.'));
      }
      stateSection.appendChild(previewRow);
      transitions.forEach((transition, index) => {
        const conditions = Array.isArray(transition.conditions) ? transition.conditions : [];
        const actions = Array.isArray(transition.actions) ? transition.actions : [];
        const switchAction = actions.find((action) => action?.type === 'switch-state');
        const targetState = this.actor.states.find((entry) => entry.id === switchAction?.params?.stateId);
        const targetLabel = targetState?.name || switchAction?.params?.stateId || '(no state target)';
        const conditionLabel = conditions.length
          ? conditions.map((condition) => this.describeCondition(condition)).join(transition.conditionMode === 'any' ? ' OR ' : ' AND ')
          : 'Always';
        const line = el('div', 'actor-editor-note', `${state.name || state.id} → ${conditionLabel} → ${targetLabel}`);
        line.style.padding = '4px 0';
        line.dataset.transitionIndex = String(index);
        stateSection.appendChild(line);
      });
      card.appendChild(stateSection);
    });

    scrim.onclick = (event) => {
      if (event.target !== scrim) return;
      this.stateGraphOpen = false;
      this.render();
    };
    scrim.appendChild(card);
    return scrim;
  }

}
