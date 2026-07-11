import { openProjectBrowser } from './ProjectBrowserModal.js';
import { ensureActorDefinition } from '../content/actorEditorData.js';
import { discardCachedProjectFile, listProjectFiles, loadProjectFile, saveProjectFileAndConfirm, sanitizeProjectFileName } from './projectFiles.js';
import { hydrateServerStorage } from './serverStorage.js';
import {
  UI_SUITE,
  buildSharedDesktopContextTransportLayout,
  buildSharedEditorFileMenu,
  drawSharedContextRibbon,
  drawSharedDesktopContextPanel,
  drawSharedDesktopDropdown,
  drawSharedDesktopRibbon,
  drawSharedDesktopTopMenu,
  drawSharedGamepadHintBar,
  drawSharedGamepadSlideOutHeader,
  drawSharedMenuButtonChrome,
  drawSharedMenuButtonLabel,
  drawSharedPanel,
  drawSharedPortraitActionRail,
  drawSharedPortraitMultiRowTabStrip,
  drawSharedPortraitScrollHints,
  drawSharedPortraitSheet,
  drawSharedTransportPopover,
  getSharedMobileDrawerWidth,
  getSharedMobilePortraitEditorLayout,
  normalizeSharedControlBounds,
  resetSharedThumbstickState
} from './uiSuite.js';
import { drawSharedMobileZoomSlider } from './shared/mobileZoomSlider.js';
import { openChoiceOverlay, openConfirmOverlay, openProgressOverlay, openTextInputOverlay } from './shared/textInputOverlay.js';
import { openColorPickerOverlay } from './shared/colorPickerOverlay.js';
import { applyDesktopDropdownWheelScrollState, buildCompactLandscapeCommandRailActions, buildCompactLandscapeCommandRailButtonLayout, buildDesktopDropdownRenderPlan, buildDesktopEditorShellPlan, buildGamepadSlideOutMenuPlan, buildLandscapeRootDrawerGridLayout, buildLandscapeTouchEditorShellPlan, buildMenuScrollDragState, canRenderEditorPlanSurface, canRenderEditorSurface, createDesktopDropdownCommandHit, createDesktopRootMenuHit, createPendingDesktopDropdownHit, getEditorPointerInteractionPolicy, resolveClosedDesktopDropdownState, resolveDesktopDropdownHoverSwitch, resolveDesktopDropdownRootId, resolveDesktopDropdownState, resolveDesktopRootMenuHit, resolveEditorViewportModeFlags, resolveGamepadMenuState, resolveMenuScrollDrag, resolveOpenDesktopDropdownState, resolvePendingDesktopDropdownHit, shouldCloseDesktopDropdownOnPointerDown, updatePendingDesktopDropdownHit } from './shared/editorMenuLayout.js';
import { getEditorControllerRootMenuEntries, getEditorControllerRootMenuIds, getEditorPortraitRootMenuEntries, getEditorRootMenuLabelMap, getStandardEditorActionRailIds } from './shared/editorMenuSpec.js';
import { EDITOR_INPUT_ACTIONS, EditorInputActionNormalizer, SHARED_EDITOR_GAMEPAD_BINDINGS, SHARED_EDITOR_GAMEPAD_HINTS } from './shared/input/editorInputActions.js';
import { ControllerMenuStack, buildControllerExitConfirmMenu, buildControllerHelpMenu, buildControllerSystemMenu, drawCanvasControllerMenu } from './shared/input/controllerMenuStack.js';
import {
  CUTSCENE_WEATHER_EFFECTS,
  createWeatherRuntimeState,
  cutsceneEffectToWeather,
  drawWeatherParticles,
  resetWeatherRuntimeState,
  updateWeatherSystem
} from '../shared/weatherEffects.js';
import {
  GM_DRUM_BANK_LSB,
  GM_DRUM_BANK_MSB,
  GM_DRUM_CHANNEL,
  GM_DRUM_ROWS,
  clampDrumPitch,
  isDrumChannel,
  mapPitchToDrumRow
} from '../audio/gm.js';
import { getGmSustainProfile } from '../game/Audio.js';

const DEFAULT_CUTSCENE_NAME = 'New Cutscene';
const CUTSCENE_SCHEMA_VERSION = 2;
const DEFAULT_WIDTH = 256;
const DEFAULT_HEIGHT = 144;
const DEFAULT_DURATION_MS = 6000;
const DEFAULT_FPS = 30;
export function buildCutscenePortraitMenuModel() {
  return {
    rootTabs: getEditorPortraitRootMenuEntries('cutscene'),
    bottomRailActions: getStandardEditorActionRailIds('play'),
    portraitRootPlacement: 'bottom-rail'
  };
}

export function buildCutscenePortraitEditorLayout(width, height) {
  const layout = getSharedMobilePortraitEditorLayout(width, height, {
    middleRailHeight: 96,
    minTopHeight: 220,
    minMainHeight: 220,
    sheetRatio: 0.62
  });
  const rootRailH = Math.min(112, Math.max(96, Math.floor(layout.menuSheet.h * 0.22)));
  const rootRail = {
    x: layout.menuSheet.x,
    y: layout.menuSheet.y + layout.menuSheet.h - rootRailH,
    w: layout.menuSheet.w,
    h: rootRailH
  };
  const sheetContent = {
    x: layout.menuSheet.x,
    y: layout.menuSheet.y + layout.gap,
    w: layout.menuSheet.w,
    h: Math.max(1, rootRail.y - layout.gap - (layout.menuSheet.y + layout.gap))
  };
  return {
    ...layout,
    leftRail: rootRail,
    rightRail: sheetContent,
    rootTabs: rootRail,
    sheetContent,
    rootRail,
    subRail: sheetContent,
    portraitRootPlacement: 'bottom-rail'
  };
}
const CUTSCENE_MENU_TABS = buildCutscenePortraitMenuModel().rootTabs;
const CUTSCENE_CONTROLLER_ROOT_ENTRIES = getEditorControllerRootMenuEntries('cutscene');
const CUTSCENE_DESKTOP_MENU_LABELS = getEditorRootMenuLabelMap('cutscene');
const getCutsceneMenuLabel = (id, fallback = 'Add') => CUTSCENE_DESKTOP_MENU_LABELS[id] || fallback;
const CUTSCENE_CONTROLLER_ROOTS = getEditorControllerRootMenuIds('cutscene');
const KEYFRAME_EASING = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const KEYFRAME_MODES = ['start', 'playhead', 'end'];
const CUTSCENE_FX_TYPES = ['none', 'shear', 'wave-x', 'wave-y', 'sine-wobble'];
const CUTSCENE_EFFECT_TYPES = CUTSCENE_WEATHER_EFFECTS.map((entry) => entry.id);
const CUTSCENE_KEYFRAME_HIT_SIZE = 24;
const CUTSCENE_SELECTION_HIT_PAD = 12;
const CUTSCENE_EXPORT_WIDTH = 1920;
const CUTSCENE_EXPORT_HEIGHT = 1080;
const CUTSCENE_EXPORT_SEGMENT_MS = 10000;
const CUTSCENE_MP4_AUDIO_TAIL_SECONDS = 3;
const CUTSCENE_TIMELINE_MIN_ZOOM = 0.5;
const CUTSCENE_TIMELINE_MAX_ZOOM = 12;
const CUTSCENE_TIMELINE_MIN_LANE_H = 30;
const CUTSCENE_TIMELINE_SNAP_PX = 10;
const CUTSCENE_HISTORY_ENTRY_LIMIT = 80;
const CUTSCENE_HISTORY_BYTE_LIMIT = 48 * 1024 * 1024;
const CUTSCENE_MOVIE_RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const safeNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const normalizeHexColor = (value) => {
  const text = String(value || '').trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(text)) return null;
  return `#${text.replace(/^#/, '').toLowerCase()}`;
};
export function selectCutsceneMovieRecordingMimeType(MediaRecorderCtor = globalThis?.MediaRecorder) {
  if (!MediaRecorderCtor) return '';
  return CUTSCENE_MOVIE_RECORDING_MIME_TYPES.find((type) => {
    try {
      return MediaRecorderCtor.isTypeSupported?.(type);
    } catch (_error) {
      return false;
    }
  }) || '';
}
export function getCutsceneMp4ExportFilename(name = DEFAULT_CUTSCENE_NAME, now = Date.now()) {
  const safeName = String(name || DEFAULT_CUTSCENE_NAME)
    .trim()
    .replace(/[^\w .()-]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'cutscene';
  return `${safeName}-${now}.mp4`;
}
export function getCutsceneMovieExportLayout(doc = createDefaultCutscene(), targetWidth = CUTSCENE_EXPORT_WIDTH, targetHeight = CUTSCENE_EXPORT_HEIGHT) {
  const sourceWidth = Math.max(1, Math.floor(safeNumber(doc?.width, DEFAULT_WIDTH)));
  const sourceHeight = Math.max(1, Math.floor(safeNumber(doc?.height, DEFAULT_HEIGHT)));
  const outputWidth = Math.max(1, Math.floor(safeNumber(targetWidth, CUTSCENE_EXPORT_WIDTH)));
  const outputHeight = Math.max(1, Math.floor(safeNumber(targetHeight, CUTSCENE_EXPORT_HEIGHT)));
  const projection = getCutsceneRenderProjection(
    { width: sourceWidth, height: sourceHeight },
    { x: 0, y: 0, w: outputWidth, h: outputHeight },
    { fit: 'contain' }
  );
  return {
    sourceWidth,
    sourceHeight,
    outputWidth,
    outputHeight,
    fit: 'contain',
    scale: projection.scale,
    drawX: projection.stageRect.x,
    drawY: projection.stageRect.y,
    drawWidth: projection.stageRect.w,
    drawHeight: projection.stageRect.h,
    frameWidth: sourceWidth,
    frameHeight: sourceHeight,
    stageBounds: { x: 0, y: 0, w: sourceWidth, h: sourceHeight }
  };
}
const isVisualClip = (clip) => clip?.type === 'art' || clip?.type === 'actor' || clip?.type === 'image' || clip?.type === 'text' || clip?.type === 'color-board';
const isAudioClip = (clip) => clip?.type === 'music' || clip?.type === 'sfx';
const isEffectClip = (clip) => clip?.type === 'effect';
const isKeyframeClip = (clip) => isVisualClip(clip) || isEffectClip(clip) || isAudioClip(clip);
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const getFrameStepMs = (doc) => 1000 / clamp(Math.floor(safeNumber(doc?.fps, DEFAULT_FPS)), 1, 120);
const getScaleX = (source = {}) => Math.max(0.05, safeNumber(source.scaleX, 1));
const getScaleY = (source = {}) => Math.max(0.05, safeNumber(source.scaleY, 1));
const getEffectiveScaleX = (source = {}) => Math.max(0.05, safeNumber(source.scale, 1)) * getScaleX(source);
const getEffectiveScaleY = (source = {}) => Math.max(0.05, safeNumber(source.scale, 1)) * getScaleY(source);
const getNowMs = () => (typeof performance !== 'undefined' && Number.isFinite(performance.now?.()) ? performance.now() : Date.now());
const isDefaultActorSize = (size = {}) => Math.round(safeNumber(size.width, 24)) === 24 && Math.round(safeNumber(size.height, 24)) === 24;
const isCutsceneDebugEnabled = () => {
  try {
    return Boolean(globalThis?.localStorage?.getItem?.('chainsaw-cutscene-debug'));
  } catch (error) {
    return false;
  }
};
const debugCutscenePlayback = (event, details = {}) => {
  const payload = { event, at: Date.now(), ...details };
  if (isCutsceneDebugEnabled()) console.info('[cutscene]', event, details);
  try {
    const body = JSON.stringify(payload);
    if (globalThis?.navigator?.sendBeacon) {
      globalThis.navigator.sendBeacon('/__debug/cutscene', new Blob([body], { type: 'application/json' }));
    } else {
      globalThis?.fetch?.('/__debug/cutscene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch (error) {
    // Debug telemetry must never affect editor playback.
  }
};
export function parseCutsceneDurationInput(value, fallbackMs = DEFAULT_DURATION_MS) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return Math.max(500, Math.round(safeNumber(fallbackMs, DEFAULT_DURATION_MS)));
  const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*(ms|msec|millisecond|milliseconds|s|sec|secs|second|seconds)?$/);
  if (!match) return Math.max(500, Math.round(safeNumber(fallbackMs, DEFAULT_DURATION_MS)));
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return Math.max(500, Math.round(safeNumber(fallbackMs, DEFAULT_DURATION_MS)));
  const unit = match[2] || '';
  const asMs = unit.startsWith('m')
    ? numeric
    : unit.startsWith('s') || Math.abs(numeric) < 1000
      ? numeric * 1000
      : numeric;
  return Math.max(500, Math.round(asMs));
}

const getFullPreviewDurationMs = (doc) => Math.max(
  1,
  safeNumber(doc?.durationMs, DEFAULT_DURATION_MS)
);

function getCutsceneTimelineClipColor(clip = {}) {
  if (clip.type === 'text') return '#b46aff';
  if (clip.type === 'color-board') return normalizeHexColor(clip.color) || '#d88cff';
  if (clip.type === 'music' || clip.type === 'sfx') return '#8aff9a';
  if (clip.type === 'effect') return '#45f0ff';
  if (clip.type === 'actor') return '#7898ff';
  if (clip.type === 'art' || clip.type === 'image') return '#6ab8ff';
  if (clip.type === 'pause') return '#ffb36a';
  return '#d88cff';
}

function assignTimelineClipSlots(clips = []) {
  const sorted = [...clips].sort((a, b) => safeNumber(a.startMs) - safeNumber(b.startMs) || getClipEndMs(a) - getClipEndMs(b) || String(a.id).localeCompare(String(b.id)));
  const slotEnds = [];
  const slots = new Map();
  sorted.forEach((clip) => {
    const start = safeNumber(clip.startMs);
    const end = Math.max(start + 1, getClipEndMs(clip));
    let slot = slotEnds.findIndex((lastEnd) => lastEnd <= start);
    if (slot < 0) {
      slot = slotEnds.length;
      slotEnds.push(end);
    } else {
      slotEnds[slot] = end;
    }
    slots.set(clip.id, slot);
  });
  return { slots, slotCount: Math.max(1, slotEnds.length) };
}

export function createDefaultCutscene(name = DEFAULT_CUTSCENE_NAME) {
  return {
    schemaVersion: CUTSCENE_SCHEMA_VERSION,
    name,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    durationMs: DEFAULT_DURATION_MS,
    fps: DEFAULT_FPS,
    snapEnabled: true,
    snapSize: 8,
    sceneFadeInMs: 0,
    sceneFadeOutMs: 0,
    masterVolume: 1,
    assets: [],
    layers: [
      { id: 'background', name: 'Background', type: 'visual', visible: true, locked: false },
      { id: 'sprites', name: 'Sprites', type: 'visual', visible: true, locked: false },
      { id: 'text', name: 'Text', type: 'text', visible: true, locked: false },
      { id: 'effects', name: 'Effects', type: 'effect', visible: true, locked: false },
      { id: 'audio', name: 'Audio', type: 'audio', visible: true, locked: false }
    ],
    tracks: [],
    clips: []
  };
}

export function normalizeCutsceneDocument(source = {}, fallbackName = DEFAULT_CUTSCENE_NAME) {
  const doc = source && typeof source === 'object' ? source : {};
  const base = createDefaultCutscene(doc.name || fallbackName);
  const normalized = {
    ...base,
    ...doc,
    schemaVersion: CUTSCENE_SCHEMA_VERSION,
    name: String(doc.name || fallbackName || DEFAULT_CUTSCENE_NAME),
    width: Math.max(64, Math.floor(Number(doc.width || DEFAULT_WIDTH))),
    height: Math.max(64, Math.floor(Number(doc.height || DEFAULT_HEIGHT))),
    durationMs: Math.max(500, Math.floor(Number(doc.durationMs || DEFAULT_DURATION_MS))),
    fps: clamp(Math.floor(Number(doc.fps || DEFAULT_FPS)), 12, 60),
    snapEnabled: doc.snapEnabled !== false,
    snapSize: clamp(Math.round(safeNumber(doc.snapSize, 8)), 1, 64),
    sceneFadeInMs: clamp(Math.round(safeNumber(doc.sceneFadeInMs, 0)), 0, Math.max(0, Math.floor(Number(doc.durationMs || DEFAULT_DURATION_MS)))),
    sceneFadeOutMs: clamp(Math.round(safeNumber(doc.sceneFadeOutMs, 0)), 0, Math.max(0, Math.floor(Number(doc.durationMs || DEFAULT_DURATION_MS)))),
    masterVolume: clamp(safeNumber(doc.masterVolume, 1), 0, 1),
    assets: Array.isArray(doc.assets) ? doc.assets.filter(Boolean).map((asset, index) => ({
      id: asset.id || `asset-${index}`,
      type: asset.type || 'image',
      name: asset.name || asset.ref || `Asset ${index + 1}`,
      ref: asset.ref || '',
      actorRef: asset.actorRef || '',
      dataUrl: asset.dataUrl || '',
      width: Math.max(0, safeNumber(asset.width, 0)),
      height: Math.max(0, safeNumber(asset.height, 0))
    })) : [],
    layers: Array.isArray(doc.layers) && doc.layers.length
      ? doc.layers.filter(Boolean).map((layer, index) => ({
        id: layer.id || `layer-${index}`,
        name: layer.name || `Layer ${index + 1}`,
        type: layer.type || 'visual',
        visible: layer.visible !== false,
        locked: Boolean(layer.locked)
      }))
      : base.layers,
    clips: []
  };
  normalized.clips = Array.isArray(doc.clips) ? doc.clips.filter(Boolean).map((clip, index) => normalizeCutsceneClip(clip, normalized, index)) : [];
  normalized.tracks = normalizeCutsceneTracks(doc.tracks, normalized.clips);
  reconcileCutsceneClipTracks(normalized);
  return normalized;
}

function getCutsceneAudioAssetRef(doc, clip) {
  const asset = (doc?.assets || []).find((entry) => entry?.id === clip?.assetId) || null;
  return String(asset?.ref || clip?.assetId || '').trim();
}

function isCutsceneMidiTrackMuted(song, track) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  const soloTracks = tracks.filter((entry) => entry?.solo);
  return soloTracks.length > 0 ? !track?.solo : Boolean(track?.mute);
}

function getCutsceneMidiLoopTicks(song, ticksPerBeat) {
  if (Number.isFinite(song?.loopEndTick)) return Math.max(1, Number(song.loopEndTick));
  const beatsPerBar = 4;
  const loopBars = Number.isFinite(song?.loopBars) ? song.loopBars : 8;
  return Math.max(1, loopBars * beatsPerBar * ticksPerBeat);
}

function getCutsceneMidiLoopStartTick(song, loopTicks) {
  if (!Number.isFinite(song?.loopStartTick)) return 0;
  return clamp(Number(song.loopStartTick), 0, loopTicks);
}

function collectSongMidiRenderEvents(song, clip, clipRef, masterVolume = 1) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  const tempo = Number.isFinite(song?.tempo) ? song.tempo : 120;
  const ticksPerBeat = Number.isFinite(song?.ticksPerBeat) ? song.ticksPerBeat : 8;
  const ticksPerSecond = (tempo / 60) * ticksPerBeat;
  const loopTicks = getCutsceneMidiLoopTicks(song, ticksPerBeat);
  const loopStartTick = getCutsceneMidiLoopStartTick(song, loopTicks);
  const clipStartSec = safeNumber(clip?.startMs, 0) / 1000;
  const clipDurationSec = Math.max(0, safeNumber(clip?.durationMs, 0) / 1000);
  const clipEndSec = clipStartSec + clipDurationSec;
  const offsetTick = Math.max(0, safeNumber(clip?.offsetMs, 0) / 1000) * ticksPerSecond;
  const loopEnabled = clip?.loop === true;
  const events = [];

  tracks.forEach((track) => {
    if (!track || isCutsceneMidiTrackMuted(song, track)) return;
    const pattern = track.patterns?.[0];
    if (!Array.isArray(pattern?.notes) || !pattern.notes.length) return;
    const isDrums = track.instrument === 'drums' || track.isPercussion === true || isDrumChannel(track.channel);
    const channel = isDrums ? GM_DRUM_CHANNEL : clamp(track.channel ?? 0, 0, 15);
    const bankMSB = isDrums ? (track.bankMSB ?? GM_DRUM_BANK_MSB) : (track.bankMSB ?? 0);
    const bankLSB = isDrums ? (track.bankLSB ?? GM_DRUM_BANK_LSB) : (track.bankLSB ?? 0);
    const program = clamp(track.program ?? 0, 0, 127);
    const trackVolume = clamp(track.volume ?? 0.8, 0, 1);
    const pan = clamp(track.pan ?? 0, -1, 1);
    const notes = pattern.notes
      .filter((note) => Number.isFinite(note?.startTick))
      .sort((a, b) => a.startTick - b.startTick || (a.pitch ?? 0) - (b.pitch ?? 0));
    let repeat = 0;
    while (repeat < 512) {
      const repeatTickOffset = repeat * Math.max(1, loopTicks - loopStartTick);
      let emittedInRepeat = false;
      notes.forEach((note) => {
        const rawStartTick = Math.max(0, Number(note.startTick || 0));
        const sourceTick = repeat === 0 ? rawStartTick : loopStartTick + (rawStartTick - loopStartTick) + repeatTickOffset;
        if (repeat > 0 && rawStartTick < loopStartTick) return;
        const relativeTick = sourceTick - offsetTick;
        if (relativeTick < 0) return;
        const startSec = clipStartSec + relativeTick / ticksPerSecond;
        if (startSec >= clipEndSec) return;
        const durationSec = Math.max(0.03, Math.max(1, Number(note.durationTicks || ticksPerBeat)) / ticksPerSecond);
        const absoluteMs = startSec * 1000;
        const clipVolume = sampleCutsceneAudioVolume(clip, absoluteMs);
        const pitch = isDrums ? mapPitchToDrumRow(clampDrumPitch(note.pitch), GM_DRUM_ROWS) : clamp(Math.round(note.pitch ?? 60), 0, 127);
        events.push({
          startSec,
          durationSec: Math.min(durationSec, Math.max(0.03, clipEndSec - startSec)),
          pitch,
          volume: clamp((note.velocity ?? 0.8) * trackVolume * clipVolume * masterVolume, 0, 1),
          pan,
          program,
          channel,
          bankMSB,
          bankLSB,
          isDrum: isDrums,
          clipId: clip?.id || '',
          trackId: track.id ?? null,
          ref: clipRef
        });
        emittedInRepeat = true;
      });
      if (!loopEnabled) break;
      const nextRepeatStartSec = clipStartSec + ((repeat + 1) * Math.max(1, loopTicks - loopStartTick) - offsetTick) / ticksPerSecond;
      if (nextRepeatStartSec >= clipEndSec && !emittedInRepeat) break;
      repeat += 1;
    }
  });

  return events;
}

export function collectCutsceneMidiRenderEvents(doc = createDefaultCutscene(), resolveSong = () => null) {
  const safeDoc = normalizeCutsceneDocument(doc, doc?.name);
  const masterVolume = clamp(safeNumber(safeDoc.masterVolume, 1), 0, 1);
  const events = [];
  (safeDoc.clips || []).forEach((clip) => {
    if (clip?.type !== 'music') return;
    const ref = getCutsceneAudioAssetRef(safeDoc, clip);
    if (!ref) return;
    const entry = resolveSong(ref);
    const song = entry?.song || entry || null;
    if (!song) return;
    events.push(...collectSongMidiRenderEvents(song, clip, ref, masterVolume));
  });
  return events.sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
}

function normalizeCutsceneTracks(sourceTracks = [], clips = []) {
  const tracks = [];
  const seen = new Set();
  if (Array.isArray(sourceTracks) && sourceTracks.length) {
    sourceTracks.filter(Boolean).forEach((track, index) => {
      const id = String(track.id || `track-${index + 1}`);
      if (!id || seen.has(id)) return;
      seen.add(id);
      tracks.push({
        id,
        name: String(track.name || `Track ${tracks.length + 1}`)
      });
    });
  }
  if (!tracks.length) {
    (clips || []).forEach((clip, index) => {
      const id = String(clip.trackId || `track-${clip.id || index + 1}`);
      if (seen.has(id)) return;
      seen.add(id);
      tracks.push({ id, name: `Track ${tracks.length + 1}` });
    });
  }
  if (!tracks.length) tracks.push({ id: 'track-1', name: 'Track 1' });
  return tracks;
}

function reconcileCutsceneClipTracks(doc) {
  const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
  const clips = Array.isArray(doc?.clips) ? doc.clips : [];
  const trackIds = new Set(tracks.map((track) => track.id));
  clips.forEach((clip, index) => {
    if (clip.trackId && trackIds.has(clip.trackId)) return;
    const fallback = tracks[index] || tracks[0];
    if (fallback) {
      clip.trackId = fallback.id;
      return;
    }
    const track = { id: `track-${clip.id || index + 1}`, name: `Track ${tracks.length + 1}` };
    tracks.push(track);
    trackIds.add(track.id);
    clip.trackId = track.id;
  });
}

export function normalizeCutsceneClip(clip = {}, doc = createDefaultCutscene(), index = 0) {
  const layerId = clip.layerId || (clip.type === 'text' ? 'text' : isEffectClip(clip) ? 'effects' : isAudioClip(clip) || clip.type === 'pause' ? 'audio' : doc.layers?.[0]?.id) || 'sprites';
  const type = clip.type || 'image';
  const startMs = Math.max(0, Math.floor(Number(clip.startMs || 0)));
  const durationMs = Math.max(type === 'pause' ? 0 : 1, Math.floor(Number(clip.durationMs ?? (type === 'pause' ? 0 : 1200))));
  const baseTransform = normalizeBaseTransform(clip, doc, type, durationMs);
  return {
    id: clip.id || `clip-${index}`,
    type,
    layerId,
    trackId: clip.trackId || '',
    assetId: clip.assetId || '',
    assetRef: clip.assetRef || '',
    actorRef: clip.actorRef || '',
    stateId: clip.stateId || '',
    stateEvents: normalizeActorStateEvents(clip.stateEvents, clip.stateId),
    text: clip.text || '',
    startMs,
    durationMs,
    loop: Boolean(clip.loop),
    volume: clamp(safeNumber(clip.volume, 1), 0, 1),
    fadeMs: Math.max(0, Math.floor(safeNumber(clip.fadeMs, 250))),
    effectType: CUTSCENE_EFFECT_TYPES.includes(clip.effectType) ? clip.effectType : 'rain',
    intensity: clamp(safeNumber(clip.intensity, 1), 0, 4),
    wind: clamp(safeNumber(clip.wind, 0), -4, 4),
    opacity: clamp(safeNumber(clip.opacity, 1), 0, 1),
    prompt: clip.prompt || 'Press a button',
    waitForInput: clip.waitForInput !== false,
    color: clip.color || '#ffffff',
    backgroundColor: clip.backgroundColor || 'rgba(0,0,0,0)',
    fontSize: Math.max(8, Number(clip.fontSize || 8)),
    fontFamily: ['terminal', 'block'].includes(clip.fontFamily) ? clip.fontFamily : 'terminal',
    textAlign: ['left', 'center', 'right'].includes(clip.textAlign) ? clip.textAlign : 'center',
    textBorderEnabled: type === 'text' ? clip.textBorderEnabled !== false : Boolean(clip.textBorderEnabled),
    textBorderColor: normalizeHexColor(clip.textBorderColor) || '#000000',
    textBorderSize: clamp(Math.round(safeNumber(clip.textBorderSize, 1)), 0, 4),
    animation: clip.animation || 'none',
    revealSpeed: clamp(safeNumber(clip.revealSpeed, 30), 1, 120),
    showCursor: clip.showCursor !== false,
    cursorBlinkMs: Math.max(80, Math.floor(safeNumber(clip.cursorBlinkMs, 420))),
    easing: KEYFRAME_EASING.includes(clip.easing) ? clip.easing : 'linear',
    fadeInMs: Math.max(0, Math.floor(safeNumber(clip.fadeInMs, 0))),
    fadeOutMs: Math.max(0, Math.floor(safeNumber(clip.fadeOutMs, 0))),
    playAnimation: Boolean(clip.playAnimation),
    animationStartMs: Math.max(0, Math.floor(safeNumber(clip.animationStartMs, 0))),
    animationSpeed: Math.max(0.05, safeNumber(clip.animationSpeed, 1)),
    loopAnimation: clip.loopAnimation !== false,
    activeFrameIndex: Math.max(0, Math.floor(safeNumber(clip.activeFrameIndex, 0))),
    fx: normalizeCutsceneFx(clip.fx),
    ...baseTransform,
    keyframes: normalizeKeyframes(clip.keyframes, doc, type, durationMs)
  };
}

function normalizeTransformLike(source = {}, doc = createDefaultCutscene(), type = 'image') {
  const fallbackW = type === 'color-board' ? doc.width : type === 'text' ? 180 : 96;
  const fallbackH = type === 'color-board' ? doc.height : type === 'text' ? 40 : 72;
  return {
    x: Number.isFinite(Number(source.x)) ? Number(source.x) : Math.round(doc.width / 2),
    y: Number.isFinite(Number(source.y)) ? Number(source.y) : Math.round(doc.height / 2),
    scale: Math.max(0.05, Number(source.scale ?? 1)),
    scaleX: Math.max(0.05, Number(source.scaleX ?? 1)),
    scaleY: Math.max(0.05, Number(source.scaleY ?? 1)),
    aspectLocked: source.aspectLocked !== false,
    rotation: Number(source.rotation || 0),
    opacity: clamp(Number(source.opacity ?? 1), 0, 1),
    w: Math.max(1, Number(source.w || fallbackW)),
    h: Math.max(1, Number(source.h || fallbackH))
  };
}

function normalizeBaseTransform(clip = {}, doc = createDefaultCutscene(), type = 'image') {
  if (!isVisualClip({ type })) return {};
  const firstKey = Array.isArray(clip.keyframes) && clip.keyframes.length
    ? [...clip.keyframes].sort((a, b) => safeNumber(a?.timeMs) - safeNumber(b?.timeMs))[0]
    : null;
  return normalizeTransformLike({
    ...(firstKey || {}),
    ...clip
  }, doc, type);
}

function normalizeCutsceneFx(fx = {}) {
  const type = CUTSCENE_FX_TYPES.includes(fx?.type) ? fx.type : 'none';
  return {
    type,
    amount: clamp(safeNumber(fx?.amount, type === 'none' ? 0 : 0.2), -4, 4),
    frequency: clamp(safeNumber(fx?.frequency, 2), 0.1, 24),
    speed: clamp(safeNumber(fx?.speed, 1), -12, 12),
    phase: safeNumber(fx?.phase, 0)
  };
}

function normalizeActorStateEvents(events, fallbackStateId = '') {
  const source = Array.isArray(events) && events.length
    ? events
    : (fallbackStateId ? [{ timeMs: 0, stateId: fallbackStateId }] : []);
  return source.filter(Boolean).map((event, index) => ({
    id: event.id || `state-event-${index}`,
    timeMs: Math.max(0, Math.floor(safeNumber(event.timeMs, index * 1000))),
    stateId: event.stateId || fallbackStateId || '',
    playAnimation: event.playAnimation !== false,
    loopAnimation: event.loopAnimation !== false,
    animationSpeed: Math.max(0.05, safeNumber(event.animationSpeed, 1)),
    animationStartMs: Math.max(0, Math.floor(safeNumber(event.animationStartMs, 0)))
  })).sort((a, b) => a.timeMs - b.timeMs);
}

export function resolveActorStateEvent(clip = {}, localTime = 0) {
  const events = normalizeActorStateEvents(clip.stateEvents, clip.stateId);
  if (!events.length) return null;
  const safeLocal = Math.max(0, safeNumber(localTime));
  let current = events[0];
  for (const event of events) {
    if (event.timeMs <= safeLocal) current = event;
    else break;
  }
  return current;
}

function normalizeKeyframes(keyframes, doc, type, clipDurationMs = DEFAULT_DURATION_MS) {
  if (!isKeyframeClip({ type })) return [];
  const durationMs = Math.max(1, Math.floor(safeNumber(clipDurationMs, DEFAULT_DURATION_MS)));
  const list = Array.isArray(keyframes) ? keyframes : [];
  const normalized = list.map((keyframe, index) => {
    const base = {
      timeMs: clamp(Math.floor(Number(keyframe.timeMs ?? (index === 0 ? 0 : durationMs))), 0, durationMs),
      manual: keyframe.manual === true,
      autoHold: keyframe.autoHold === true
    };
    if (isEffectClip({ type })) {
      return {
        ...base,
        opacity: clamp(safeNumber(keyframe.opacity, 1), 0, 1),
        intensity: clamp(safeNumber(keyframe.intensity, 1), 0, 4),
        wind: clamp(safeNumber(keyframe.wind, 0), -4, 4)
      };
    }
    if (isAudioClip({ type })) {
      return {
        ...base,
        volume: clamp(safeNumber(keyframe.volume, 1), 0, 1)
      };
    }
    return {
      ...base,
      ...normalizeTransformLike(keyframe, doc, type)
    };
  }).sort((a, b) => a.timeMs - b.timeMs);
  const byTime = new Map();
  normalized.forEach((keyframe) => {
    if (!keyframe.manual) return;
    byTime.set(keyframe.timeMs, keyframe);
  });
  return Array.from(byTime.values()).sort((a, b) => a.timeMs - b.timeMs);
}

export function sampleCutsceneClip(clip, timeMs) {
  if (!clip || timeMs < clip.startMs || timeMs > clip.startMs + clip.durationMs) return null;
  const localTime = clamp(timeMs - clip.startMs, 0, clip.durationMs);
  const base = normalizeTransformLike(clip, { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, clip.type);
  const keyframes = Array.isArray(clip.keyframes) ? [...clip.keyframes].sort((a, b) => a.timeMs - b.timeMs) : [];
  let left = { ...base, timeMs: 0 };
  let right = left;
  if (!keyframes.length) {
    right = left;
  } else if (localTime < keyframes[0].timeMs) {
    right = left;
  } else if (localTime === keyframes[0].timeMs) {
    left = keyframes[0];
    right = left;
  } else {
    left = keyframes[keyframes.length - 1];
    right = left;
    for (let index = 0; index < keyframes.length - 1; index += 1) {
      if (localTime >= keyframes[index].timeMs && localTime <= keyframes[index + 1].timeMs) {
        left = keyframes[index];
        right = keyframes[index + 1];
        break;
      }
    }
    if (localTime >= keyframes[keyframes.length - 1].timeMs) {
      left = keyframes[keyframes.length - 1];
      right = left;
    }
  }
  const span = Math.max(1, right.timeMs - left.timeMs);
  const t = applyEasing(clamp((localTime - left.timeMs) / span, 0, 1), clip.easing);
  const opacity = applyClipAnimationOpacity(clip, localTime, left.opacity, right.opacity, t);
  return {
    timeMs: localTime,
    x: lerp(left.x, right.x, t),
    y: lerp(left.y, right.y, t),
    scale: lerp(left.scale, right.scale, t),
    scaleX: lerp(getScaleX(left), getScaleX(right), t),
    scaleY: lerp(getScaleY(left), getScaleY(right), t),
    aspectLocked: clip.aspectLocked !== false,
    rotation: lerp(left.rotation, right.rotation, t),
    opacity,
    w: lerp(left.w, right.w, t),
    h: lerp(left.h, right.h, t)
  };
}

export function sampleCutsceneAudioVolume(clip, timeMs) {
  if (!isAudioClip(clip)) return clamp(safeNumber(clip?.volume, 1), 0, 1);
  if (!clip || timeMs < clip.startMs || timeMs > clip.startMs + clip.durationMs) return 0;
  const localTime = clamp(timeMs - clip.startMs, 0, Math.max(1, clip.durationMs));
  const baseVolume = clamp(safeNumber(clip.volume, 1), 0, 1);
  const keyframes = Array.isArray(clip.keyframes)
    ? clip.keyframes.filter((entry) => entry?.manual === true).sort((a, b) => safeNumber(a.timeMs) - safeNumber(b.timeMs))
    : [];
  if (!keyframes.length || localTime < safeNumber(keyframes[0].timeMs)) return baseVolume;
  let left = keyframes[0];
  let right = left;
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    if (localTime >= safeNumber(keyframes[index].timeMs) && localTime <= safeNumber(keyframes[index + 1].timeMs)) {
      left = keyframes[index];
      right = keyframes[index + 1];
      break;
    }
  }
  if (localTime >= safeNumber(keyframes[keyframes.length - 1].timeMs)) {
    left = keyframes[keyframes.length - 1];
    right = left;
  }
  const span = Math.max(1, safeNumber(right.timeMs) - safeNumber(left.timeMs));
  const t = left === right ? 0 : applyEasing(clamp((localTime - safeNumber(left.timeMs)) / span, 0, 1), clip.easing);
  return clamp(lerp(safeNumber(left.volume, baseVolume), safeNumber(right.volume, left.volume ?? baseVolume), t), 0, 1);
}

export function sampleCutsceneEffectClip(clip, timeMs) {
  if (!isEffectClip(clip) || timeMs < clip.startMs || timeMs > clip.startMs + clip.durationMs) return null;
  const localTime = clamp(timeMs - clip.startMs, 0, clip.durationMs);
  const base = {
    timeMs: 0,
    opacity: clamp(safeNumber(clip.opacity, 1), 0, 1),
    intensity: clamp(safeNumber(clip.intensity, 1), 0, 4),
    wind: clamp(safeNumber(clip.wind, 0), -4, 4)
  };
  const keyframes = Array.isArray(clip.keyframes)
    ? clip.keyframes.filter((entry) => entry?.manual === true).sort((a, b) => safeNumber(a.timeMs) - safeNumber(b.timeMs))
    : [];
  let left = base;
  let right = base;
  if (keyframes.length && localTime >= safeNumber(keyframes[0].timeMs)) {
    left = keyframes[keyframes.length - 1];
    right = left;
    for (let index = 0; index < keyframes.length - 1; index += 1) {
      if (localTime >= safeNumber(keyframes[index].timeMs) && localTime <= safeNumber(keyframes[index + 1].timeMs)) {
        left = keyframes[index];
        right = keyframes[index + 1];
        break;
      }
    }
  }
  const span = Math.max(1, safeNumber(right.timeMs) - safeNumber(left.timeMs));
  const t = applyEasing(clamp((localTime - safeNumber(left.timeMs)) / span, 0, 1), clip.easing);
  return {
    timeMs: localTime,
    opacity: lerp(clamp(safeNumber(left.opacity, base.opacity), 0, 1), clamp(safeNumber(right.opacity, base.opacity), 0, 1), t),
    intensity: lerp(clamp(safeNumber(left.intensity, base.intensity), 0, 4), clamp(safeNumber(right.intensity, base.intensity), 0, 4), t),
    wind: lerp(clamp(safeNumber(left.wind, base.wind), -4, 4), clamp(safeNumber(right.wind, base.wind), -4, 4), t)
  };
}

function applyEasing(t, easing = 'linear') {
  if (easing === 'ease-in') return t * t;
  if (easing === 'ease-out') return 1 - ((1 - t) * (1 - t));
  if (easing === 'ease-in-out') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return t;
}

function getClipEndMs(clip) {
  return safeNumber(clip?.startMs) + Math.max(0, safeNumber(clip?.durationMs));
}

export function getCutsceneTimelineLayout(bounds, durationMs = DEFAULT_DURATION_MS, clips = [], options = {}) {
  const safeBounds = {
    x: safeNumber(bounds?.x),
    y: safeNumber(bounds?.y),
    w: Math.max(1, safeNumber(bounds?.w, 1)),
    h: Math.max(1, safeNumber(bounds?.h, 1))
  };
  const sourceClips = Array.isArray(clips) && clips.length ? clips : [];
  const sourceTracks = Array.isArray(options.tracks) && options.tracks.length ? options.tracks : [];
  const lanes = sourceTracks.length
    ? sourceTracks.map((track, index) => ({
        id: track.id || `track-${index}`,
        trackId: track.id || `track-${index}`,
        label: track.name || `Track ${index + 1}`,
        clipId: null,
        type: 'track',
        index
      }))
    : sourceClips.length
      ? sourceClips.map((clip, index) => ({
          id: clip.id || `track-${index}`,
          trackId: clip.trackId || clip.id || `track-${index}`,
          label: clip.name || clip.text || clip.assetRef || clip.actorRef || clip.assetId || clip.effectType || clip.type || `Track ${index + 1}`,
          clipId: clip.id,
          type: clip.type,
          index
        }))
    : [{ id: 'empty', label: 'Track', clipId: null, index: 0 }];
  const labelW = Math.min(96, Math.max(58, safeBounds.w * 0.22));
  const laneGap = 6;
  const laneTop = safeBounds.y + 30;
  const duration = Math.max(1, safeNumber(durationMs, DEFAULT_DURATION_MS));
  const zoomX = clamp(safeNumber(options.zoomX, 1), CUTSCENE_TIMELINE_MIN_ZOOM, CUTSCENE_TIMELINE_MAX_ZOOM);
  const visibleDuration = zoomX > 1 ? Math.max(1, duration / zoomX) : duration;
  const maxScrollMs = Math.max(0, duration - visibleDuration);
  const scrollMs = clamp(safeNumber(options.scrollMs, 0), 0, maxScrollMs);
  const hasViewport = Object.hasOwn(options, 'zoomX') || Object.hasOwn(options, 'scrollMs') || Object.hasOwn(options, 'scrollTrack') || Object.hasOwn(options, 'minLaneHeight');
  const trackH = Math.max(1, safeBounds.h - 40);
  const minLaneH = Math.max(22, safeNumber(options.minLaneHeight, CUTSCENE_TIMELINE_MIN_LANE_H));
  const visibleTrackCount = hasViewport
    ? clamp(Math.max(1, Math.floor((trackH + laneGap) / (minLaneH + laneGap))), 1, Math.max(1, lanes.length))
    : lanes.length;
  const maxScrollTrack = Math.max(0, lanes.length - visibleTrackCount);
  const scrollTrack = clamp(safeNumber(options.scrollTrack, 0), 0, maxScrollTrack);
  const scrollTrackIndex = Math.floor(scrollTrack);
  const scrollTrackOffset = scrollTrack - scrollTrackIndex;
  const visibleLanes = lanes.slice(scrollTrackIndex, scrollTrackIndex + visibleTrackCount + (scrollTrackOffset > 0.001 ? 1 : 0));
  const laneH = hasViewport
    ? Math.max(22, Math.floor((trackH - laneGap * Math.max(0, visibleTrackCount - 1)) / Math.max(1, visibleTrackCount)))
    : Math.max(22, Math.floor((safeBounds.h - 40 - laneGap * (lanes.length - 1)) / Math.max(1, lanes.length)));
  const track = {
    x: safeBounds.x + labelW,
    y: laneTop,
    w: Math.max(1, safeBounds.w - labelW - 8),
    h: trackH
  };
  const laneBounds = visibleLanes.map((lane, index) => ({
    ...lane,
    bounds: {
      x: track.x,
      y: laneTop + (index - scrollTrackOffset) * (laneH + laneGap),
      w: track.w,
      h: laneH
    }
  })).filter((lane) => lane.bounds.y + lane.bounds.h >= track.y && lane.bounds.y <= track.y + track.h);
  return {
    bounds: safeBounds,
    lanes,
    laneBounds,
    track,
    labelW,
    laneGap,
    laneH,
    duration,
    zoomX,
    scrollMs,
    scrollTrackIndex,
    scrollTrackOffset,
    visibleStartMs: scrollMs,
    visibleEndMs: scrollMs + visibleDuration,
    visibleDuration,
    maxScrollMs,
    scrollTrack,
    visibleTrackCount,
    maxScrollTrack
  };
}

export function timelineXToMs(x, timelineLayout) {
  const track = timelineLayout?.track || { x: 0, w: 1 };
  const duration = Math.max(1, safeNumber(timelineLayout?.duration, DEFAULT_DURATION_MS));
  const startMs = safeNumber(timelineLayout?.visibleStartMs, 0);
  const visibleDuration = Math.max(1, safeNumber(timelineLayout?.visibleDuration, duration));
  return clamp(startMs + ((safeNumber(x) - track.x) / Math.max(1, track.w)) * visibleDuration, 0, duration);
}

export function timelineMsToX(ms, timelineLayout) {
  const track = timelineLayout?.track || { x: 0, w: 1 };
  const duration = Math.max(1, safeNumber(timelineLayout?.duration, DEFAULT_DURATION_MS));
  const startMs = safeNumber(timelineLayout?.visibleStartMs, 0);
  const visibleDuration = Math.max(1, safeNumber(timelineLayout?.visibleDuration, duration));
  return track.x + ((clamp(safeNumber(ms), 0, duration) - startMs) / visibleDuration) * track.w;
}

export function getCutsceneStageProjection(doc = createDefaultCutscene(), bounds = {}) {
  return getCutsceneRenderProjection(doc, bounds, { fit: 'contain' });
}

export function getCutsceneRenderProjection(doc = createDefaultCutscene(), bounds = {}, options = {}) {
  const safeDoc = normalizeCutsceneDocument(doc);
  const safeBounds = {
    x: safeNumber(bounds.x),
    y: safeNumber(bounds.y),
    w: Math.max(1, safeNumber(bounds.w, 1)),
    h: Math.max(1, safeNumber(bounds.h, 1))
  };
  const fit = options?.fit === 'cover' ? 'cover' : 'contain';
  const scaleMethod = fit === 'cover' ? Math.max : Math.min;
  const scale = Math.max(0.001, scaleMethod(safeBounds.w / safeDoc.width, safeBounds.h / safeDoc.height));
  const w = safeDoc.width * scale;
  const h = safeDoc.height * scale;
  return {
    doc: safeDoc,
    bounds: safeBounds,
    fit,
    scale,
    stageRect: {
      x: safeBounds.x + (safeBounds.w - w) / 2,
      y: safeBounds.y + (safeBounds.h - h) / 2,
      w,
      h
    }
  };
}

export function screenToCutscenePoint(x, y, projection) {
  const rect = projection?.stageRect || { x: 0, y: 0 };
  const scale = Math.max(0.001, safeNumber(projection?.scale, 1));
  return {
    x: (safeNumber(x) - rect.x) / scale,
    y: (safeNumber(y) - rect.y) / scale
  };
}

export function clampCutscenePointForClip(point, clip, keyframe, doc = createDefaultCutscene()) {
  const safeDoc = normalizeCutsceneDocument(doc);
  const halfW = Math.max(1, safeNumber(keyframe?.w, clip?.type === 'text' ? 180 : 96) * getEffectiveScaleX(keyframe)) / 2;
  const halfH = Math.max(1, safeNumber(keyframe?.h, clip?.type === 'text' ? 40 : 72) * getEffectiveScaleY(keyframe)) / 2;
  return {
    x: clamp(safeNumber(point?.x), -halfW, safeDoc.width + halfW),
    y: clamp(safeNumber(point?.y), -halfH, safeDoc.height + halfH)
  };
}

export function getVisualClipScreenBounds(clip, doc, timeMs, stageBounds) {
  if (!isVisualClip(clip)) return null;
  const sample = sampleCutsceneClip(clip, timeMs);
  if (!sample) return null;
  const projection = getCutsceneStageProjection(doc, stageBounds);
  const w = Math.max(1, sample.w * getEffectiveScaleX(sample) * projection.scale);
  const h = Math.max(1, sample.h * getEffectiveScaleY(sample) * projection.scale);
  const cx = projection.stageRect.x + sample.x * projection.scale;
  const cy = projection.stageRect.y + sample.y * projection.scale;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    id: clip.id,
    centerX: cx,
    centerY: cy,
    docX: sample.x,
    docY: sample.y,
    sample
  };
}

function applyClipAnimationOpacity(clip, localTime, leftOpacity, rightOpacity, t) {
  let opacity = lerp(leftOpacity, rightOpacity, t);
  const fadeInMs = Math.max(0, safeNumber(clip.fadeInMs, 0));
  const fadeOutMs = Math.max(0, safeNumber(clip.fadeOutMs, 0));
  if (fadeInMs > 0) opacity *= clamp(localTime / fadeInMs, 0, 1);
  if (fadeOutMs > 0) opacity *= clamp((clip.durationMs - localTime) / fadeOutMs, 0, 1);
  return clamp(opacity, 0, 1);
}

export function getCutsceneSceneFadeAlpha(doc = {}, timeMs = 0) {
  const durationMs = Math.max(1, safeNumber(doc.durationMs, DEFAULT_DURATION_MS));
  const safeTime = clamp(safeNumber(timeMs), 0, durationMs);
  const fadeInMs = Math.max(0, safeNumber(doc.sceneFadeInMs, 0));
  const fadeOutMs = Math.max(0, safeNumber(doc.sceneFadeOutMs, 0));
  let alpha = 0;
  if (fadeInMs > 0 && safeTime < fadeInMs) {
    alpha = Math.max(alpha, 1 - (safeTime / fadeInMs));
  }
  if (fadeOutMs > 0 && safeTime > durationMs - fadeOutMs) {
    alpha = Math.max(alpha, (safeTime - (durationMs - fadeOutMs)) / fadeOutMs);
  }
  return clamp(alpha, 0, 1);
}

export function getCutsceneTriggerActionDefaults(cutsceneId = '') {
  return { cutsceneId, pauseGameplay: true, skippable: true };
}

export class CutscenePlayer {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.doc = null;
    this.timeMs = 0;
    this.startTimeMs = 0;
    this.onDone = null;
    this.skippable = true;
    this.ignorePauseMarkers = false;
    this.firedAudio = new Set();
    this.loopingAudio = new Map();
    this.audioClipById = new Map();
    this.waitingPauseClipId = null;
    this.imageCache = new Map();
    this.artCache = new Map();
    this.weatherStates = new Map();
  }

  play(doc, { onDone = null, skippable = true, ignorePauseMarkers = false, startMs = 0 } = {}) {
    this.doc = normalizeCutsceneDocument(doc);
    this.timeMs = clamp(Math.round(safeNumber(startMs)), 0, this.doc.durationMs);
    this.startTimeMs = this.timeMs;
    this.onDone = onDone;
    this.skippable = skippable !== false;
    this.ignorePauseMarkers = Boolean(ignorePauseMarkers);
    this.firedAudio.clear();
    this.stopLoopingAudio();
    this.audioClipById = new Map((this.doc.clips || []).map((clip) => [clip.id, clip]));
    this.weatherStates.clear();
    this.waitingPauseClipId = null;
    this.active = true;
    this.fireDueAudio();
  }

  stop() {
    if (!this.active) return;
    const done = this.onDone;
    this.active = false;
    this.doc = null;
    this.audioClipById.clear();
    this.startTimeMs = 0;
    this.onDone = null;
    this.firedAudio.clear();
    this.waitingPauseClipId = null;
    this.weatherStates.clear();
    this.stopLoopingAudio();
    try { done?.(); } catch (error) { /* cutscene callbacks should not crash playback */ }
  }

  update(dt) {
    if (!this.active || !this.doc) return;
    if (this.waitingPauseClipId) return;
    const advancedTimeMs = this.timeMs + Math.max(0, dt) * 1000;
    this.timeMs = advancedTimeMs;
    const pauseClip = this.ignorePauseMarkers ? null : (this.doc.clips || [])
      .filter((clip) => clip.type === 'pause' && clip.waitForInput !== false && !this.firedAudio.has(`pause:${clip.id}`))
      .sort((a, b) => a.startMs - b.startMs)
      .find((clip) => this.timeMs >= clip.startMs);
    if (pauseClip) {
      this.timeMs = pauseClip.startMs;
    }
    this.fireDueAudio();
    this.updateActiveAudioVolumes();
    if (pauseClip) {
      this.timeMs = pauseClip.startMs;
      this.waitingPauseClipId = pauseClip.id;
      this.firedAudio.add(`pause:${pauseClip.id}`);
      return;
    }
    this.stopExpiredLoopingAudio();
    if (this.timeMs >= this.doc.durationMs) {
      this.stop();
    }
  }

  handleInput(input) {
    if (!this.active) return false;
    if (this.waitingPauseClipId && (input.wasPressed?.('attack') || input.wasPressed?.('jump') || input.wasPressed?.('interact') || input.wasPressed?.('pause') || input.wasPressed?.('cancel'))) {
      this.waitingPauseClipId = null;
      return true;
    }
    if (!this.skippable) return false;
    if (input.wasPressed?.('attack') || input.wasPressed?.('jump') || input.wasPressed?.('interact') || input.wasPressed?.('pause') || input.wasPressed?.('cancel')) {
      this.stop();
      return true;
    }
    return false;
  }

  fireDueAudio() {
    const clips = this.doc?.clips || [];
    const masterVolume = clamp(safeNumber(this.doc?.masterVolume, 1), 0, 1);
    clips.forEach((clip) => {
      if (clip.type !== 'music' && clip.type !== 'sfx') return;
      if (this.timeMs < clip.startMs || this.firedAudio.has(clip.id)) return;
      if (this.startTimeMs > clip.startMs && this.startTimeMs >= getClipEndMs(clip)) return;
      if (this.startTimeMs > clip.startMs && clip.type === 'sfx' && !clip.loop) {
        this.firedAudio.add(clip.id);
        return;
      }
      this.firedAudio.add(clip.id);
      const asset = (this.doc.assets || []).find((entry) => entry.id === clip.assetId) || null;
      const ref = asset?.ref || clip.assetId;
      const volume = clamp(sampleCutsceneAudioVolume(clip, this.startTimeMs > clip.startMs ? this.startTimeMs : this.timeMs) * masterVolume, 0, 1);
      if (clip.type === 'music') {
        const offsetMs = Math.max(
          0,
          (this.startTimeMs > clip.startMs ? this.startTimeMs : this.timeMs) - safeNumber(clip.startMs)
        );
        if (typeof this.game.playCutsceneMidiLayer === 'function') {
          this.game.playCutsceneMidiLayer(clip.id, ref, { fadeMs: clip.fadeMs, volume, offsetMs, loop: clip.loop === true });
        } else if (typeof this.game.playCutsceneMidi === 'function') {
          this.game.playCutsceneMidi(ref, { fadeMs: clip.fadeMs, volume, offsetMs });
        } else {
          this.game.playActorMidi?.(ref, { fadeMs: clip.fadeMs, volume, offsetMs });
        }
      } else {
        this.game.playSfxById?.(ref, { volume, loop: clip.loop, key: clip.id });
      }
      if (clip.type === 'music' || clip.type === 'sfx') {
        this.loopingAudio.set(clip.id, { type: clip.type, ref, clipId: clip.id, volume });
      }
    });
  }

  updateActiveAudioVolumes() {
    const masterVolume = clamp(safeNumber(this.doc?.masterVolume, 1), 0, 1);
    this.loopingAudio.forEach((entry, clipId) => {
      const clip = this.audioClipById.get(clipId);
      if (!clip || this.timeMs < clip.startMs || this.timeMs > getClipEndMs(clip)) return;
      const volume = clamp(sampleCutsceneAudioVolume(clip, this.timeMs) * masterVolume, 0, 1);
      if (Math.abs(volume - safeNumber(entry.volume, -1)) < 0.002) return;
      entry.volume = volume;
      if (entry.type === 'music') {
        this.game.setCutsceneMidiLayerVolume?.(clip.id, volume);
      } else {
        this.game.setSfxVolumeById?.(entry.ref, { key: clip.id, volume });
      }
    });
  }

  stopExpiredLoopingAudio() {
    this.loopingAudio.forEach((entry, clipId) => {
      const clip = this.audioClipById.get(clipId);
      if (!clip || this.timeMs < getClipEndMs(clip)) return;
      if (entry.type === 'music') {
        if (typeof this.game.stopCutsceneMidiLayer === 'function') {
          this.game.stopCutsceneMidiLayer(clip.id, { fadeMs: clip.fadeMs });
        } else if (typeof this.game.stopCutsceneMidi === 'function') {
          this.game.stopCutsceneMidi(entry.ref, { fadeMs: clip.fadeMs });
        } else {
          this.game.stopActorMidi?.(entry.ref, { fadeMs: clip.fadeMs });
        }
      }
      if (entry.type === 'sfx') this.game.stopSfxById?.(entry.ref, { key: clip.id });
      this.loopingAudio.delete(clipId);
    });
  }

  stopLoopingAudio() {
    this.loopingAudio.forEach((entry) => {
      if (entry.type === 'music') {
        if (typeof this.game.stopCutsceneMidiLayer === 'function') {
          this.game.stopCutsceneMidiLayer(entry.clipId, { fadeMs: 120 });
        } else if (typeof this.game.stopCutsceneMidi === 'function') {
          this.game.stopCutsceneMidi(entry.ref, { fadeMs: 120 });
        } else {
          this.game.stopActorMidi?.(entry.ref, { fadeMs: 120 });
        }
      }
      if (entry.type === 'sfx') this.game.stopSfxById?.(entry.ref, { key: entry.clipId });
    });
    this.loopingAudio.clear();
  }

  draw(ctx, width, height) {
    if (!this.active || !this.doc) return;
    drawCutsceneDocument(ctx, this.doc, this.timeMs, { x: 0, y: 0, w: width, h: height }, this, { fit: 'contain', drawBorder: false });
  }

  getImageForAsset(asset) {
    if (!asset?.dataUrl) return null;
    if (this.imageCache.has(asset.id)) return this.imageCache.get(asset.id);
    if (typeof Image === 'undefined') return null;
    const image = new Image();
    image.src = asset.dataUrl;
    this.imageCache.set(asset.id, image);
    return image;
  }

  getArtFrameForAsset(asset) {
    if (!asset?.ref) return null;
    return getCachedArtCanvas(asset.ref, this.artCache);
  }

  getVisualFrameForClip(clip, asset, timeMs) {
    return getVisualFrameCanvas(clip, asset, timeMs, this.artCache);
  }
}

export function drawCutsceneDocument(ctx, doc, timeMs, bounds, runtime = null, options = {}) {
  if (!ctx || !bounds) return;
  const fit = options?.fit === 'cover' ? 'cover' : 'contain';
  const projection = getCutsceneRenderProjection(doc, bounds, { fit });
  const safeDoc = projection.doc;
  const safeBounds = projection.bounds;
  const { x: stageX, y: stageY, w: stageW, h: stageH } = projection.stageRect;
  const scale = projection.scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#06090d';
  ctx.fillRect(safeBounds.x, safeBounds.y, safeBounds.w, safeBounds.h);
  ctx.fillStyle = '#101820';
  ctx.fillRect(stageX, stageY, stageW, stageH);
  ctx.beginPath();
  ctx.rect(stageX, stageY, stageW, stageH);
  ctx.clip();
  const visibleLayers = new Set((safeDoc.layers || []).filter((layer) => layer.visible !== false).map((layer) => layer.id));
  const trackOrder = new Map((safeDoc.tracks || []).map((track, index) => [track.id, index]));
  const getClipTrackOrder = (clip, fallbackIndex) => {
    if (trackOrder.has(clip?.trackId)) return trackOrder.get(clip.trackId);
    return trackOrder.size + fallbackIndex;
  };
  (safeDoc.clips || [])
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => {
      const trackDelta = getClipTrackOrder(b.clip, b.index) - getClipTrackOrder(a.clip, a.index);
      return trackDelta || b.index - a.index;
    })
    .forEach(({ clip }) => {
    if (!visibleLayers.has(clip.layerId)) return;
    if (isEffectClip(clip)) {
      drawCutsceneEffect(ctx, safeDoc, clip, timeMs, { x: stageX, y: stageY, w: stageW, h: stageH, scale }, runtime);
      return;
    }
    const sample = sampleCutsceneClip(clip, timeMs);
    if (!sample || clip.type === 'music' || clip.type === 'sfx' || clip.type === 'pause') return;
    drawCutsceneClip(ctx, safeDoc, clip, sample, { x: stageX, y: stageY, scale, pixelSnap: options?.pixelSnap === true }, runtime);
  });
  const sceneFadeAlpha = getCutsceneSceneFadeAlpha(safeDoc, timeMs);
  if (sceneFadeAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${sceneFadeAlpha})`;
    ctx.fillRect(stageX, stageY, stageW, stageH);
  }
  ctx.restore();
  if (options?.drawBorder !== false) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(stageX, stageY, stageW, stageH);
    ctx.restore();
  }
}

function drawCutsceneClip(ctx, doc, clip, sample, stage, runtime) {
  const shouldPixelSnap = stage?.pixelSnap === true && clip?.type === 'text' && Math.abs(safeNumber(sample.rotation, 0)) < 0.0001;
  const x = shouldPixelSnap ? Math.round(stage.x + sample.x * stage.scale) : stage.x + sample.x * stage.scale;
  const y = shouldPixelSnap ? Math.round(stage.y + sample.y * stage.scale) : stage.y + sample.y * stage.scale;
  const w = Math.max(1, sample.w * getEffectiveScaleX(sample) * stage.scale);
  const h = Math.max(1, sample.h * getEffectiveScaleY(sample) * stage.scale);
  if (![x, y, w, h].every(Number.isFinite)) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = clamp(safeNumber(sample.opacity, 1), 0, 1);
  ctx.translate(x, y);
  ctx.rotate(sample.rotation);
  const fx = normalizeCutsceneFx(clip.fx);
  if (fx.type !== 'none') {
    const source = renderClipToFxCanvas(doc, clip, sample, w, h, stage, runtime);
    if (source) {
      drawFxCanvas(ctx, source, w, h, fx, sample.timeMs);
      ctx.restore();
      return;
    }
    if (fx.type === 'shear') ctx.transform(1, 0, fx.amount, 1, 0, 0);
  }
  drawClipContent(ctx, doc, clip, sample, stage, runtime, w, h);
  ctx.restore();
}

function drawClipContent(ctx, doc, clip, sample, stage, runtime, w, h) {
  ctx.imageSmoothingEnabled = false;
  if (clip.type === 'color-board') {
    ctx.fillStyle = normalizeHexColor(clip.color) || '#000000';
    ctx.fillRect(-w / 2, -h / 2, w, h);
  } else if (clip.type === 'text') {
    if (clip.backgroundColor && clip.backgroundColor !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = clip.backgroundColor;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    drawPixelTextClip(ctx, clip, sample, stage, w, h);
  } else {
    const asset = (doc.assets || []).find((entry) => entry.id === clip.assetId) || null;
    const image = clip.type === 'art' || clip.type === 'actor'
      ? runtime?.getVisualFrameForClip?.(clip, asset, clip.startMs + sample.timeMs)
      : runtime?.getImageForAsset?.(asset);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
    } else if (image?.width > 0 && image.height > 0) {
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = clip.color || '#6ac7ff';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
  }
}

const BITMAP_GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '01100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '01100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '11110', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
};

function getBitmapGlyph(char) {
  return BITMAP_GLYPHS[String(char || ' ').toUpperCase()] || BITMAP_GLYPHS['?'];
}

function measureBitmapText(text, unit) {
  return String(text || '').length * unit * 6;
}

function wrapBitmapText(text, maxWidth, unit) {
  const lines = [];
  String(text || '').split(/\r?\n/).forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    const words = paragraph.split(/(\s+)/);
    let line = '';
    words.forEach((part) => {
      const next = `${line}${part}`;
      if (line && measureBitmapText(next.trimEnd(), unit) > maxWidth && part.trim()) {
        lines.push(line.trimEnd());
        line = part.trimStart();
      } else {
        line = next;
      }
    });
    lines.push(line.trimEnd());
  });
  return lines.length ? lines : [''];
}

function estimateCutsceneTextBounds(text, doc = createDefaultCutscene(), fontSize = 8) {
  const unit = Math.max(1, Math.floor(safeNumber(fontSize, 8) / 8));
  const maxW = Math.max(120, safeNumber(doc.width, 256) - 24);
  const minW = 160;
  const padding = unit * 8;
  const explicitLines = String(text || '').split(/\r?\n/);
  const longestExplicitLine = explicitLines.reduce((max, line) => Math.max(max, measureBitmapText(line, unit)), 0);
  const w = clamp(Math.max(minW, longestExplicitLine + padding), minW, maxW);
  const wrapped = wrapBitmapText(text, Math.max(unit * 6, w - unit * 2), unit);
  const lineH = unit * 9;
  const h = clamp(wrapped.length * lineH + padding, 34, Math.max(34, safeNumber(doc.height, 144) - 16));
  return { w, h };
}

function drawBitmapText(ctx, text, x, y, unit, color, family = 'terminal') {
  ctx.fillStyle = color;
  const scaleX = family === 'block' ? 1.15 : 1;
  String(text || '').split('').forEach((char, charIndex) => {
    const glyph = getBitmapGlyph(char);
    const originX = x + charIndex * unit * 6 * scaleX;
    glyph.forEach((row, rowIndex) => {
      row.split('').forEach((pixel, colIndex) => {
        if (pixel === '1') ctx.fillRect(originX + colIndex * unit * scaleX, y + rowIndex * unit, Math.ceil(unit * scaleX), Math.ceil(unit));
      });
    });
  });
}

function drawBitmapTextWithBorder(ctx, text, x, y, unit, clip) {
  const borderSize = clip.textBorderEnabled === false ? 0 : clamp(Math.round(safeNumber(clip.textBorderSize, 1)), 0, 4);
  if (borderSize > 0) {
    for (let offsetY = -borderSize; offsetY <= borderSize; offsetY += 1) {
      for (let offsetX = -borderSize; offsetX <= borderSize; offsetX += 1) {
        if (!offsetX && !offsetY) continue;
        drawBitmapText(
          ctx,
          text,
          x + offsetX * unit,
          y + offsetY * unit,
          unit,
          clip.textBorderColor || '#000000',
          clip.fontFamily
        );
      }
    }
  }
  drawBitmapText(ctx, text, x, y, unit, clip.color || '#fff', clip.fontFamily);
}

function drawPixelTextClip(ctx, clip, sample, stage, w, h) {
  const textScale = Math.max(0.05, Math.min(getEffectiveScaleX(sample), getEffectiveScaleY(sample)));
  const rawUnit = Math.max(1, Math.floor((clip.fontSize * textScale) / 8)) * stage.scale;
  const unit = stage?.pixelSnap === true ? Math.max(1, Math.round(rawUnit)) : rawUnit;
  const lineH = unit * 9;
  const maxWidth = Math.max(unit * 6, w - unit * 2);
  const localTime = Math.max(0, safeNumber(sample.timeMs, 0));
  const fullText = String(clip.text || '');
  const revealCount = clip.animation === 'typewriter'
    ? Math.min(fullText.length, Math.floor((localTime / 1000) * safeNumber(clip.revealSpeed, 30)))
    : fullText.length;
  const visibleText = fullText.slice(0, revealCount);
  const lines = wrapBitmapText(visibleText, maxWidth, unit);
  const totalH = lines.length * lineH;
  let y = -totalH / 2;
  lines.forEach((line) => {
    const textW = measureBitmapText(line, unit);
    const x = clip.textAlign === 'left'
      ? -w / 2 + unit
      : clip.textAlign === 'right'
        ? w / 2 - unit - textW
        : -textW / 2;
    drawBitmapTextWithBorder(ctx, line, stage?.pixelSnap === true ? Math.round(x) : x, stage?.pixelSnap === true ? Math.round(y) : y, unit, clip);
    y += lineH;
  });
  const cursorVisible = clip.showCursor !== false && clip.animation === 'typewriter' && revealCount < fullText.length
    && Math.floor(localTime / Math.max(80, safeNumber(clip.cursorBlinkMs, 420))) % 2 === 0;
  if (cursorVisible) {
    const lastLine = lines[lines.length - 1] || '';
    const textW = measureBitmapText(lastLine, unit);
    const cursorX = clip.textAlign === 'left'
      ? -w / 2 + unit + textW
      : clip.textAlign === 'right'
        ? w / 2 - unit
        : -textW / 2 + textW;
    const cursorY = -totalH / 2 + (lines.length - 1) * lineH;
    const snappedCursorX = stage?.pixelSnap === true ? Math.round(cursorX) : cursorX;
    const snappedCursorY = stage?.pixelSnap === true ? Math.round(cursorY) : cursorY;
    const borderSize = clip.textBorderEnabled === false ? 0 : clamp(Math.round(safeNumber(clip.textBorderSize, 1)), 0, 4);
    if (borderSize > 0) {
      ctx.fillStyle = clip.textBorderColor || '#000000';
      for (let offsetY = -borderSize; offsetY <= borderSize; offsetY += 1) {
        for (let offsetX = -borderSize; offsetX <= borderSize; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          ctx.fillRect(snappedCursorX + unit + offsetX * unit, snappedCursorY + offsetY * unit, unit * 4, unit * 7);
        }
      }
    }
    ctx.fillStyle = clip.color || '#fff';
    ctx.fillRect(snappedCursorX + unit, snappedCursorY, unit * 4, unit * 7);
  }
}

function getCutsceneWeatherState(runtime, clip, weatherType, stage) {
  const holder = runtime || {};
  if (!holder.weatherStates) holder.weatherStates = new Map();
  const key = `${clip.id || `effect-${clip.startMs}`}:${weatherType}`;
  let state = holder.weatherStates.get(key);
  const weatherScale = getCutsceneWeatherRenderScale(stage, weatherType);
  const signature = [
    weatherType,
    Math.round(stage.x),
    Math.round(stage.y),
    Math.round(stage.w),
    Math.round(stage.h),
    Math.round(weatherScale * 1000)
  ].join(':');
  if (!state) {
    state = createWeatherRuntimeState();
    holder.weatherStates.set(key, state);
  }
  if (state.signature !== signature) {
    resetWeatherRuntimeState(state);
    state.signature = signature;
    state.lastLocalMs = null;
  }
  return state;
}

function getCutsceneWeatherRenderScale(stage, weatherType) {
  const stageScale = Math.max(0.05, safeNumber(stage?.scale, 1));
  if (weatherType === 'weather-snow' || weatherType === 'weather-blizzard') {
    return Math.max(0.75, stageScale);
  }
  return Math.max(0.75, stageScale);
}

function advanceCutsceneWeatherState(state, clip, localMs, stage, weatherType, effectSample = null) {
  const intensity = clamp(safeNumber(effectSample?.intensity, clip.intensity ?? 1), 0, 4);
  const weatherScale = getCutsceneWeatherRenderScale(stage, weatherType);
  const windBias = safeNumber(effectSample?.wind, clip.wind ?? 0) * 48 * weatherScale;
  const bounds = {
    left: stage.x,
    top: stage.y,
    right: stage.x + stage.w,
    bottom: stage.y + stage.h
  };
  const targetMs = Math.max(0, safeNumber(localMs, 0));
  const shouldRebuild = state.lastLocalMs === null
    || state.lastLocalMs === undefined
    || targetMs < state.lastLocalMs
    || targetMs - state.lastLocalMs > 280;
  if (shouldRebuild) {
    resetWeatherRuntimeState(state);
    state.signature = state.signature;
    const warmTargetMs = Math.max(targetMs, 420);
    let elapsedMs = 0;
    while (elapsedMs < warmTargetMs) {
      const stepMs = Math.min(50, warmTargetMs - elapsedMs);
      updateWeatherSystem({
        state,
        particles: state.particles,
        weatherType,
        bounds,
        dt: stepMs / 1000,
        intensity,
        windBias,
        scale: weatherScale
      });
      elapsedMs += stepMs;
    }
  } else {
    const deltaMs = Math.max(0, targetMs - state.lastLocalMs);
    let elapsedMs = 0;
    while (elapsedMs < deltaMs) {
      const stepMs = Math.min(50, deltaMs - elapsedMs);
      updateWeatherSystem({
        state,
        particles: state.particles,
        weatherType,
        bounds,
        dt: stepMs / 1000,
        intensity,
        windBias,
        scale: weatherScale
      });
      elapsedMs += stepMs;
    }
  }
  state.lastLocalMs = targetMs;
}

function drawCutsceneEffect(ctx, doc, clip, timeMs, stage, runtime = null) {
  if (!isEffectClip(clip) || timeMs < clip.startMs || timeMs > clip.startMs + clip.durationMs) return;
  const localMs = Math.max(0, timeMs - clip.startMs);
  const weatherType = cutsceneEffectToWeather(clip.effectType);
  const sample = sampleCutsceneEffectClip(clip, timeMs);
  if (!sample) return;
  const state = getCutsceneWeatherState(runtime, clip, weatherType, stage);
  advanceCutsceneWeatherState(state, clip, localMs, stage, weatherType, sample);
  const alpha = clamp(safeNumber(sample.opacity, 1), 0, 1);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawWeatherParticles(ctx, state.particles, {
    weatherType,
    fogPhase: state.time,
    bounds: { x: stage.x, y: stage.y, w: stage.w, h: stage.h },
    lightning: state.lightning
  });
  ctx.restore();
}

function renderClipToFxCanvas(doc, clip, sample, w, h, stage, runtime) {
  if (typeof document === 'undefined') return null;
  const pad = Math.ceil(Math.max(8, Math.min(w, h) * 0.25));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w + pad * 2));
  canvas.height = Math.max(1, Math.ceil(h + pad * 2));
  const fxCtx = canvas.getContext('2d');
  if (!fxCtx) return null;
  fxCtx.save();
  fxCtx.imageSmoothingEnabled = false;
  fxCtx.translate(canvas.width / 2, canvas.height / 2);
  drawClipContent(fxCtx, doc, clip, sample, stage, runtime, w, h);
  fxCtx.restore();
  return { canvas, pad };
}

function drawFxCanvas(ctx, source, w, h, fx, localTimeMs = 0) {
  const canvas = source.canvas || source;
  const pad = safeNumber(source.pad, 0);
  ctx.imageSmoothingEnabled = false;
  const phase = safeNumber(fx.phase) + (safeNumber(localTimeMs) / 1000) * safeNumber(fx.speed, 1) * Math.PI * 2;
  if (fx.type === 'shear') {
    ctx.save();
    ctx.transform(1, 0, safeNumber(fx.amount), 1, 0, 0);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();
    return;
  }
  const slice = 2;
  const amp = safeNumber(fx.amount, 0.2) * Math.min(w, h);
  const freq = safeNumber(fx.frequency, 2) * Math.PI * 2;
  if (fx.type === 'wave-y') {
    for (let sx = 0; sx < canvas.width; sx += slice) {
      const sw = Math.min(slice, canvas.width - sx);
      const nx = clamp((sx - pad) / Math.max(1, w), 0, 1);
      const offset = Math.sin(nx * freq + phase) * amp;
      ctx.drawImage(canvas, sx, 0, sw, canvas.height, -canvas.width / 2 + sx, -canvas.height / 2 + offset, sw, canvas.height);
    }
    return;
  }
  for (let sy = 0; sy < canvas.height; sy += slice) {
    const sh = Math.min(slice, canvas.height - sy);
    const ny = clamp((sy - pad) / Math.max(1, h), 0, 1);
    const wobble = fx.type === 'sine-wobble' ? Math.sin(ny * freq * 0.5 + phase * 0.7) * amp * 0.35 : 0;
    const offset = Math.sin(ny * freq + phase) * amp + wobble;
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, -canvas.width / 2 + offset, -canvas.height / 2 + sy, canvas.width, sh);
  }
}

function normalizeArtFramePixels(frame) {
  if (Array.isArray(frame) && frame.some((value) => typeof value === 'string')) return frame;
  if (Array.isArray(frame) && Array.isArray(frame[0]) && frame[0].some((value) => typeof value === 'string')) return frame[0];
  if (frame && typeof frame === 'object') {
    if (Array.isArray(frame.pixels) && frame.pixels.some((value) => typeof value === 'string')) return frame.pixels;
    if (Array.isArray(frame.data) && frame.data.some((value) => typeof value === 'string')) return frame.data;
    const layers = Array.isArray(frame.layers) ? frame.layers : [];
    const firstLayer = layers.find((layer) => Array.isArray(layer?.pixels) && layer.pixels.length);
    if (firstLayer) return firstLayer.pixels;
  }
  return null;
}

function parseArtColor(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      r: value & 255,
      g: (value >>> 8) & 255,
      b: (value >>> 16) & 255,
      a: (value >>> 24) & 255
    };
  }
  const text = String(value || '');
  if (!/^#?[0-9a-fA-F]{6}$/.test(text)) return null;
  const clean = text.startsWith('#') ? text.slice(1) : text;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: 255
  };
}

function readPngDataUrlDimensions(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') || typeof atob !== 'function') return null;
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
}

function getImageDataUrlDimensions(dataUrl) {
  const png = readPngDataUrlDimensions(dataUrl);
  if (png?.width > 0 && png?.height > 0) return Promise.resolve(png);
  if (typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      width: Math.max(1, safeNumber(image.naturalWidth || image.width, 1)),
      height: Math.max(1, safeNumber(image.naturalHeight || image.height, 1))
    });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

export function computeCutsceneFitDimensions(sourceWidth, sourceHeight, doc = createDefaultCutscene()) {
  const width = Math.max(1, safeNumber(sourceWidth, 1));
  const height = Math.max(1, safeNumber(sourceHeight, 1));
  const docWidth = Math.max(1, safeNumber(doc?.width, DEFAULT_WIDTH));
  const docHeight = Math.max(1, safeNumber(doc?.height, DEFAULT_HEIGHT));
  const fitScale = Math.min(docWidth / width, docHeight / height);
  return {
    width: Math.max(1, Math.round(width * fitScale)),
    height: Math.max(1, Math.round(height * fitScale))
  };
}

function getArtDocumentDimensions(ref) {
  const payload = loadProjectFile('art', ref);
  const art = payload?.data || null;
  if (!art) return null;
  if (art.tiles && typeof art.tiles === 'object') {
    const tile = Object.values(art.tiles).find((entry) => entry) || null;
    const width = safeNumber(tile?.width || tile?.editor?.width || tile?.size, 0);
    const height = safeNumber(tile?.height || tile?.editor?.height || tile?.size || width, 0);
    if (width > 0 && height > 0) return { width, height };
  }
  const width = safeNumber(art.width || art.editor?.width || art.size, 0);
  const height = safeNumber(art.height || art.editor?.height || art.size || width, 0);
  if (width > 0 && height > 0) return { width, height };
  return null;
}

function getCachedArtCanvas(ref, cache = new Map()) {
  const frames = getCachedArtCanvases(ref, cache) || [];
  return frames[0]?.canvas || null;
}

function getCachedArtCanvases(ref, cache = new Map()) {
  if (typeof document === 'undefined') return null;
  const payload = loadProjectFile('art', ref);
  let art = payload?.data || null;
  if (!art) return [];
  if (!Array.isArray(art.frames) && art.tiles && typeof art.tiles === 'object') {
    art = Object.values(art.tiles).find((entry) => entry) || art;
  }
  const rawFrames = Array.isArray(art.frames) ? art.frames : (Array.isArray(art.editor?.frames) ? art.editor.frames : []);
  if (!rawFrames.length) return [];
  const firstFrame = normalizeArtFramePixels(rawFrames[0]);
  if (!Array.isArray(firstFrame) || !firstFrame.length) return [];
  const width = Math.max(1, Math.floor(Number(art.width || art.editor?.width || art.size || Math.sqrt(firstFrame.length)) || 1));
  const height = Math.max(1, Math.floor(Number(art.height || art.editor?.height || art.size || Math.ceil(firstFrame.length / width)) || 1));
  const cacheKey = `${ref}:${payload?.savedAt || 0}:${width}x${height}:${rawFrames.length}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const durationMs = Math.max(20, Math.round(1000 / Math.max(1, Number(art.fps || 8))));
  const frames = rawFrames.map((rawFrame, index) => {
    const frame = normalizeArtFramePixels(rawFrame);
    if (!Array.isArray(frame) || !frame.length) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i += 1) {
      const color = parseArtColor(frame[i]);
      const base = i * 4;
      if (!color || color.a === 0) {
        imageData.data[base + 3] = 0;
      } else {
        imageData.data[base] = color.r;
        imageData.data[base + 1] = color.g;
        imageData.data[base + 2] = color.b;
        imageData.data[base + 3] = color.a;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return { canvas, durationMs: Math.max(20, Number(rawFrame?.durationMs || durationMs)), index };
  }).filter(Boolean);
  cache.set(cacheKey, frames);
  return frames;
}

function getActorStateDimensions(animation = {}) {
  const artRef = String(animation?.artRef || '').trim();
  if (artRef) {
    const payload = loadProjectFile('art', artRef);
    const width = Number(payload?.data?.width || payload?.data?.editor?.width || payload?.data?.size || 0);
    const height = Number(payload?.data?.height || payload?.data?.editor?.height || payload?.data?.size || width || 0);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) return { width, height };
  }
  const frame = Array.isArray(animation?.frames) ? animation.frames.find((entry) => entry?.imageDataUrl) : null;
  const inline = readPngDataUrlDimensions(frame?.imageDataUrl || animation?.imageDataUrl || '');
  if (inline?.width > 0 && inline?.height > 0) return inline;
  return null;
}

export function resolveCutsceneActorVisualDimensions(actorData = {}, stateId = '') {
  const actor = ensureActorDefinition(actorData || {});
  const size = {
    width: Math.max(1, safeNumber(actor?.size?.width, 24)),
    height: Math.max(1, safeNumber(actor?.size?.height, 24))
  };
  const states = Array.isArray(actor.states) ? actor.states : [];
  const state = states.find((entry) => (entry.id || entry.name) === stateId)
    || states.find((entry) => entry?.animation?.artRef || entry?.animation?.imageDataUrl || entry?.animation?.frames?.length)
    || null;
  const art = getActorStateDimensions(state?.animation);
  if (actor?.sizeMode !== 'manual' && isDefaultActorSize(size) && art) return art;
  return size;
}

function getActorAnimationForClip(clip, asset) {
  const actorRef = clip.actorRef || asset?.actorRef || asset?.ref || '';
  const payload = loadProjectFile('actors', actorRef);
  const states = Array.isArray(payload?.data?.states) ? payload.data.states : [];
  const event = resolveActorStateEvent(clip, safeNumber(clip._localTimeForState, 0));
  const stateId = event?.stateId || clip.stateId;
  const selected = states.find((state) => (state.id || state.name) === stateId) || states.find((state) => state?.animation) || null;
  return selected?.animation || null;
}

function getVisualFrameCanvas(clip, asset, timeMs, cache = new Map()) {
  if (clip?.type === 'actor') {
    const localTime = Math.max(0, safeNumber(timeMs) - safeNumber(clip.startMs));
    const event = resolveActorStateEvent(clip, localTime);
    const playbackClip = {
      ...clip,
      _localTimeForState: localTime,
      playAnimation: event?.playAnimation ?? clip.playAnimation,
      loopAnimation: event?.loopAnimation ?? clip.loopAnimation,
      animationSpeed: event?.animationSpeed ?? clip.animationSpeed,
      animationStartMs: event?.animationStartMs ?? clip.animationStartMs
    };
    const animation = getActorAnimationForClip(playbackClip, asset);
    const artRef = animation?.artRef || '';
    if (artRef) return chooseAnimationFrame(getCachedArtCanvases(artRef, cache), playbackClip, timeMs);
    return null;
  }
  if (clip?.type === 'art') return chooseAnimationFrame(getCachedArtCanvases(asset?.ref || clip.assetRef, cache), clip, timeMs);
  return null;
}

function chooseAnimationFrame(frames = [], clip = {}, timeMs = 0) {
  if (!Array.isArray(frames) || !frames.length) return null;
  if (!clip.playAnimation) return frames[clamp(Math.floor(clip.activeFrameIndex || 0), 0, frames.length - 1)]?.canvas || frames[0].canvas;
  const elapsed = Math.max(0, (safeNumber(timeMs) - safeNumber(clip.startMs) - safeNumber(clip.animationStartMs)) * safeNumber(clip.animationSpeed, 1));
  const totalDuration = frames.reduce((sum, frame) => sum + Math.max(20, safeNumber(frame.durationMs, 120)), 0);
  let cursor = clip.loopAnimation !== false ? elapsed % Math.max(1, totalDuration) : Math.min(elapsed, Math.max(0, totalDuration - 1));
  for (const frame of frames) {
    const duration = Math.max(20, safeNumber(frame.durationMs, 120));
    if (cursor < duration) return frame.canvas;
    cursor -= duration;
  }
  return frames[frames.length - 1].canvas;
}

export default class CutsceneEditor {
  constructor(game) {
    this.game = game;
    this.document = createDefaultCutscene();
    this.currentDocumentRef = null;
    this.playheadMs = 0;
    this.isPlaying = false;
    this.playbackLastNow = null;
    this.playbackStartedAt = null;
    this.playbackStartPlayhead = 0;
    this.playbackAccumulatedMs = 0;
    this.previewPlayer = new CutscenePlayer(game || {});
    this.previewPlaybackTargetMs = DEFAULT_DURATION_MS;
    this.ignorePreviewDone = false;
    this.selectedClipId = null;
    this.selectedTrackId = null;
    this.selectedKeyframe = null;
    this.bounds = {};
    this.drag = null;
    this.clipboardClip = null;
    this.fileInput = null;
    this.statusText = '';
    this.pendingAction = null;
    this.movieExportInProgress = false;
    this.menuOpen = false;
    this.activeMenuTab = 'add';
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdown = null;
    this.desktopDropdownScroll = {};
    this.pendingDesktopDropdownHit = null;
    this.activeViewportMode = 'desktop';
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.menuScroll = 0;
    this.menuScrollDrag = null;
    this.landscapeRootScroll = 0;
    this.landscapeRootDrawerOpen = false;
    this.controllerMenu = new ControllerMenuStack({
      siblingOrder: CUTSCENE_CONTROLLER_ROOTS
    });
    this.inputNormalizer = new EditorInputActionNormalizer();
    this.clipOptionsOpen = false;
    this.clipOptionsTab = 'keys';
    this.keyframeMode = 'playhead';
    this.workspaceMode = 'split';
    this.timelineZoomX = 1;
    this.timelineScrollMs = 0;
    this.timelineScrollTrack = 0;
    this.timelineSnapGuideMs = null;
    this.panJoystick = { center: { x: 0, y: 0 }, radius: 0, knobRadius: 0, dx: 0, dy: 0, active: false, id: null };
    this.timelineZoomSlider = { active: false, id: null, bounds: null, railBounds: null };
    this.transportHold = null;
    this.transportPopover = null;
    this.history = [];
    this.redoStack = [];
    this.historyLimit = CUTSCENE_HISTORY_ENTRY_LIMIT;
    this.historyByteLimit = CUTSCENE_HISTORY_BYTE_LIMIT;
    this.previewRuntime = {
      imageCache: new Map(),
      artCache: new Map(),
      weatherStates: new Map(),
      getImageForAsset: (asset) => this.getImageForAsset(asset),
      getArtFrameForAsset: (asset) => this.getArtFrameForAsset(asset),
      getVisualFrameForClip: (clip, asset, timeMs) => this.getVisualFrameForClip(clip, asset, timeMs)
    };
    this.openColorPicker = openColorPickerOverlay;
  }

  resolveCutsceneViewportMode(width = this.viewportWidth || this.game?.canvas?.width || 0, height = this.viewportHeight || this.game?.canvas?.height || 0) {
    return resolveEditorViewportModeFlags({
      editorId: 'cutscene',
      viewportWidth: width,
      viewportHeight: height,
      isMobile: this.isMobileLayout(),
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.())
    });
  }

  isMobileLayout() {
    return Boolean(this.game?.deviceIsMobile || this.game?.isMobile);
  }

  resetTransientInteractionState() {
    this.drag = null;
    this.menuScrollDrag = null;
    this.menuOpen = false;
    this.menuScroll = 0;
    this.landscapeRootScroll = 0;
    this.clipOptionsOpen = false;
    this.timelineZoomSlider.active = false;
    this.timelineZoomSlider.id = null;
    this.panJoystick.active = false;
    this.panJoystick.id = null;
    this.panJoystick.dx = 0;
    this.panJoystick.dy = 0;
    this.transportHold = null;
    this.transportPopover = null;
    this.controllerMenu.resetFocus();
  }

  resetToFileMenu() {
    this.selectedClipId = null;
    this.menuOpen = false;
    this.activeMenuTab = 'file';
  }

  applyDocument(data, name = DEFAULT_CUTSCENE_NAME) {
    this.pausePlayback();
    this.document = normalizeCutsceneDocument(data, name);
    this.playheadMs = 0;
    this.selectedClipId = this.document.clips[0]?.id || null;
    this.selectedTrackId = null;
    this.selectedKeyframe = null;
    this.statusText = `Loaded ${this.document.name}`;
    this.timelineScrollMs = 0;
    this.timelineScrollTrack = 0;
    this.timelineZoomX = 1;
    this.focusInitialDocumentContent();
    this.history = [];
    this.redoStack = [];
    this.previewRuntime.weatherStates?.clear?.();
  }

  update(input, dt) {
    try {
      if (!this.document) this.document = createDefaultCutscene();
      if (this.isPlaying) {
        const now = getNowMs();
        const explicitMs = Math.max(0, Number(dt) || 0) * 1000;
        this.playbackAccumulatedMs += explicitMs;
        const fallbackMs = Number.isFinite(now) && Number.isFinite(this.playbackLastNow)
          ? Math.max(0, now - this.playbackLastNow)
          : 0;
        this.playbackLastNow = now;
        const wallMs = Number.isFinite(now) && Number.isFinite(this.playbackStartedAt)
          ? Math.max(0, now - this.playbackStartedAt)
          : 0;
        this.playheadMs = this.playbackStartPlayhead + Math.max(this.playbackAccumulatedMs, wallMs, fallbackMs);
        if (this.previewPlayer?.active) {
          try {
            this.previewPlayer.update(Math.max(0, Number(dt) || 0));
          } catch (error) {
            debugCutscenePlayback('preview-player-update-failed', {
              playheadMs: this.playheadMs,
              targetMs: this.previewPlaybackTargetMs,
              message: error?.message || String(error)
            });
            this.previewPlayer.active = false;
          }
        }
        if (this.playheadMs >= this.previewPlaybackTargetMs) {
          this.playheadMs = this.previewPlaybackTargetMs;
          debugCutscenePlayback('complete', { playheadMs: this.playheadMs, targetMs: this.previewPlaybackTargetMs });
          this.pausePlayback();
          this.statusText = 'Cutscene preview complete';
        }
      }
      this.playheadMs = clamp(this.playheadMs, 0, Math.max(1, this.document.durationMs || DEFAULT_DURATION_MS));
      if (input?.wasPressed?.('undo')) this.undo();
      if (input?.wasPressed?.('redo')) this.redo();
      this.updateControllerInput(input, dt);
      this.updateThumbstickPan(dt);
    } catch (error) {
      debugCutscenePlayback('update-failed', {
        playheadMs: this.playheadMs,
        targetMs: this.previewPlaybackTargetMs,
        playing: this.isPlaying,
        message: error?.message || String(error)
      });
      this.isPlaying = false;
      if (isCutsceneDebugEnabled()) console.warn('[cutscene] update failed', error);
      this.statusText = `Cutscene update error: ${error?.message || error}`;
    }
  }

  updateControllerInput(input, dt) {
    const inputSource = input || this.game?.input;
    const normalized = this.inputNormalizer.updateGamepad(inputSource, dt, {
      semanticBindings: SHARED_EDITOR_GAMEPAD_BINDINGS
    });
    if (!normalized.connected) {
      if (this.controllerMenu.active) this.controllerMenu.closeToSurface();
      return false;
    }
    this.controllerMenu.setMenus(this.buildControllerMenus(), {
      siblingOrder: CUTSCENE_CONTROLLER_ROOTS
    });
    this.controllerMenu.ensureInitialFocus();
    if (this.controllerMenu.handleActions(normalized.actions, normalized.axes, dt, this)) {
      return true;
    }
    const hasAction = (type) => normalized.actions.some((entry) => entry.type === type);
    if (hasAction(EDITOR_INPUT_ACTIONS.UNDO)) this.undo();
    if (hasAction(EDITOR_INPUT_ACTIONS.REDO)) this.redo();
    if (hasAction(EDITOR_INPUT_ACTIONS.PANEL_PREV)) this.stepFrame(-1);
    if (hasAction(EDITOR_INPUT_ACTIONS.PANEL_NEXT)) this.stepFrame(1);
    return false;
  }

  buildControllerMenus() {
    const rootItem = (entry) => ({
      id: entry.id,
      label: entry.label || getCutsceneMenuLabel(entry.id, entry.id),
      sourceId: entry.specId || entry.id,
      submenu: entry.id,
      onEnter: () => {
        this.activeMenuTab = entry.id;
        this.menuOpen = true;
        this.clipOptionsOpen = false;
        this.menuScroll = 0;
      }
    });
    const actionItem = (item) => (
      item.divider || item.separator
        ? { ...item }
        : {
          id: item.id,
          label: item.label,
          disabled: Boolean(item.disabled),
          active: Boolean(item.active),
          onSelect: () => this.handleButton(item.id)
        }
    );
    const menuForTab = (id) => ({
      id,
      title: getCutsceneMenuLabel(id, id),
      items: this.getMenuItems(id).map(actionItem)
    });
    return {
      root: {
        id: 'root',
        title: 'Cutscene Editor',
        items: CUTSCENE_CONTROLLER_ROOT_ENTRIES.map(rootItem)
      },
      ...Object.fromEntries(CUTSCENE_CONTROLLER_ROOT_ENTRIES.map((entry) => [entry.id, menuForTab(entry.id)])),
      system: buildControllerSystemMenu({
        fileMenuId: 'file',
        toolsMenuId: 'settings',
        onExit: () => this.game.exitCutsceneEditor?.()
      }),
      'exit-confirm': buildControllerExitConfirmMenu({
        onExit: () => this.game.exitCutsceneEditor?.(),
        message: 'Exit Cutscene Editor and return to the main menu.'
      }),
      help: buildControllerHelpMenu(['RS pans timeline', 'LT/RT zoom timeline'])
    };
  }

  getActiveGamepadMenuId() {
    return this.getGamepadMenuState().activeSubmenuId;
  }

  shouldDrawGamepadSubmenuOnLeft(width, height) {
    return this.getGamepadMenuState(width, height).drawSlideOut;
  }

  shouldDrawControllerOverlay(width, height) {
    return this.getGamepadMenuState(width, height).drawControllerOverlay;
  }

  drawGamepadHintBar(ctx, bounds, contextLabel) {
    drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS);
  }

  getGamepadMenuState(width = this.viewportWidth || this.game?.canvas?.width || 0, height = this.viewportHeight || this.game?.canvas?.height || 0) {
    const viewportMode = this.resolveCutsceneViewportMode(width, height);
    return resolveGamepadMenuState({
      viewportWidth: width,
      viewportHeight: height,
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.()),
      isMobile: viewportMode.isMobileViewport,
      menuActive: this.controllerMenu.active,
      activeMenuId: this.controllerMenu.getActiveMenuId()
    });
  }

  stop() {
    this.pausePlayback();
  }

  draw(ctx, width, height) {
    this.bounds = { buttons: [], clips: [], clipHandles: [], visualClips: [], menuButtons: [], contextButtons: [], clipOptionButtons: [], keyframes: [], stateEvents: [], stageKeyframes: [], trackLabels: [], trackLanes: [], stageSelection: [] };
    const safeW = Math.max(1, Math.floor(Number(width) || 1));
    const safeH = Math.max(1, Math.floor(Number(height) || 1));
    this.viewportWidth = safeW;
    this.viewportHeight = safeH;
    try {
      if (!this.document) this.document = createDefaultCutscene();
      ctx.save();
      ctx.fillStyle = UI_SUITE.colors.bg;
      ctx.fillRect(0, 0, safeW, safeH);
      const gamepadMenuState = this.getGamepadMenuState(safeW, safeH);
      const layout = this.computeLayout(safeW, safeH, { gamepadMenuState });
      const { stageBounds, timelineBounds, railBounds, contextBounds, zoomBounds } = layout;
      const drawGamepadLeft = gamepadMenuState.drawSlideOut;
      if (layout.isDesktop) this.drawDesktopShellChrome(ctx, layout.desktopShell);
      const canRenderLandscapeRootRail = layout.isLandscapeTouch
        && canRenderEditorPlanSurface(layout.landscapeShell, 'left-rail');
      const canRenderLandscapeBottomRail = layout.isLandscapeTouch
        ? canRenderEditorPlanSurface(layout.landscapeShell, 'bottom-tool-rail')
        : canRenderEditorSurface(this.activeViewportMode, 'bottom-action-rail');
      const canRenderLandscapeRootDrawer = layout.isLandscapeTouch
        && canRenderEditorPlanSurface(layout.landscapeShell, 'left-overlay-drawer');
      const canRenderLandscapeSubmenu = layout.isLandscapeTouch
        && canRenderEditorPlanSurface(layout.landscapeShell, 'right-drawer')
        && canRenderEditorPlanSurface(layout.landscapeShell, 'landscape-right-submenu');
      if (canRenderLandscapeRootRail && !drawGamepadLeft) this.drawLandscapeRootRail(ctx, layout.leftMenuBounds);
      this.bounds.stage = stageBounds;
      this.bounds.timeline = timelineBounds;
      this.bounds.timelineZoom = null;
      drawCutsceneDocument(ctx, this.document, this.playheadMs, stageBounds, this.previewRuntime);
      this.updateVisualClipBounds(stageBounds);
      this.drawSelectedClipOutline(ctx, stageBounds);
      this.drawStageKeyframeMarkers(ctx, stageBounds);
      this.drawTimeline(ctx, timelineBounds);
      this.drawContextRibbon(ctx, contextBounds);
      this.drawTimelineZoomSlider(ctx, zoomBounds);
      if (!layout.isDesktop && (layout.isPortrait || canRenderLandscapeBottomRail)) {
        this.drawActionRail(ctx, railBounds, layout.isPortrait);
      }
      if (drawGamepadLeft) {
        this.drawGamepadSlideOutPanel(ctx, layout.leftMenuBounds);
      } else if (this.clipOptionsOpen && (this.getSelectedClip() || this.getSelectedTrack())) {
        this.drawClipOptionsPanel(ctx, layout.menuBounds, layout.isPortrait);
      }
      if (layout.isDesktop) {
        this.drawDesktopLeftOptions(ctx, layout.menuBounds);
        this.drawDesktopDropdown(ctx, layout.desktopShell);
      } else if (!drawGamepadLeft && (this.menuOpen || this.landscapeRootDrawerOpen)) {
        if (layout.isLandscapeTouch && (canRenderLandscapeRootDrawer || canRenderLandscapeSubmenu)) {
          if (this.landscapeRootDrawerOpen) {
            if (canRenderLandscapeRootDrawer) this.drawLandscapeRootDrawer(ctx, layout.rootMenuBounds ?? layout.menuBounds);
            if (canRenderLandscapeSubmenu) this.drawLandscapeSubmenuPanel(ctx, layout.menuBounds);
          }
          else if (canRenderLandscapeSubmenu) this.drawLandscapeSubmenuPanel(ctx, layout.menuBounds);
        }
        else this.drawMenu(ctx, layout.menuBounds, layout.isPortrait);
      }
      if (gamepadMenuState.isLandscapeMenuMode && canRenderEditorSurface(this.activeViewportMode, 'gamepad-hint-bar')) {
        this.drawGamepadHintBar(ctx, {
          x: stageBounds.x + 12,
          y: stageBounds.y + Math.max(8, stageBounds.h - 36),
          w: Math.max(240, stageBounds.w - 24),
          h: 28
        }, 'Cutscene Editor');
      }
      if (gamepadMenuState.drawControllerOverlay) {
        drawCanvasControllerMenu(ctx, this.controllerMenu, {
          width: safeW,
          height: safeH,
          contextLabel: 'Cutscene Editor'
        });
      }
      ctx.restore();
    } catch (error) {
      ctx.restore?.();
      this.drawError(ctx, safeW, safeH, error);
    }
  }

  updateVisualClipBounds(stageBounds) {
    this.bounds.visualClips = (this.document.clips || [])
      .map((clip, index) => ({ clip, index, bounds: getVisualClipScreenBounds(clip, this.document, this.playheadMs, stageBounds) }))
      .filter((entry) => entry.bounds)
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.bounds)
      .filter(Boolean)
  }

  drawStageKeyframeMarkers(ctx, stageBounds) {
    const selected = this.getSelectedClip();
    if (!isVisualClip(selected) || !Array.isArray(selected.keyframes) || !stageBounds) return;
    const projection = getCutsceneStageProjection(this.document, stageBounds);
    const active = this.getSelectedKeyframe(selected);
    ctx.save();
    selected.keyframes.filter((keyframe) => keyframe?.manual === true).forEach((keyframe) => {
      const x = projection.stageRect.x + keyframe.x * projection.scale;
      const y = projection.stageRect.y + keyframe.y * projection.scale;
      const size = keyframe === active ? 12 : 9;
      const marker = { x: x - CUTSCENE_KEYFRAME_HIT_SIZE / 2, y: y - CUTSCENE_KEYFRAME_HIT_SIZE / 2, w: CUTSCENE_KEYFRAME_HIT_SIZE, h: CUTSCENE_KEYFRAME_HIT_SIZE, id: selected.id, timeMs: keyframe.timeMs };
      this.bounds.stageKeyframes.push(marker);
      ctx.fillStyle = keyframe === active ? '#ffe16a' : 'rgba(126,215,255,0.9)';
      ctx.strokeStyle = '#061018';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  drawSelectedClipOutline(ctx, stageBounds) {
    const selected = this.getSelectedClip();
    if (!isVisualClip(selected) || !stageBounds) return;
    const sample = sampleCutsceneClip(selected, this.playheadMs);
    if (!sample) return;
    const projection = getCutsceneStageProjection(this.document, stageBounds);
    const cx = projection.stageRect.x + sample.x * projection.scale;
    const cy = projection.stageRect.y + sample.y * projection.scale;
    const w = Math.max(1, sample.w * getEffectiveScaleX(sample) * projection.scale);
    const h = Math.max(1, sample.h * getEffectiveScaleY(sample) * projection.scale);
    if (![cx, cy, w, h].every(Number.isFinite)) return;
    this.bounds.stageSelection.push({
      x: cx - w / 2 - CUTSCENE_SELECTION_HIT_PAD,
      y: cy - h / 2 - CUTSCENE_SELECTION_HIT_PAD,
      w: w + CUTSCENE_SELECTION_HIT_PAD * 2,
      h: h + CUTSCENE_SELECTION_HIT_PAD * 2,
      visualX: cx - w / 2,
      visualY: cy - h / 2,
      visualW: w,
      visualH: h,
      id: selected.id,
      rotation: safeNumber(sample.rotation, 0)
    });
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(safeNumber(sample.rotation, 0));
    ctx.strokeStyle = '#ffe16a';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]);
    const handle = Math.max(6, Math.min(12, Math.min(w, h) * 0.12));
    ctx.fillStyle = '#071015';
    ctx.strokeStyle = '#ffe16a';
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2]
    ].forEach(([x, y]) => {
      ctx.fillRect(x - handle / 2, y - handle / 2, handle, handle);
      ctx.strokeRect(x - handle / 2, y - handle / 2, handle, handle);
    });
    ctx.restore();
  }

  computeLayout(width, height, { gamepadMenuState = null } = {}) {
    const viewportMode = this.resolveCutsceneViewportMode(width, height);
    this.activeModeContract = viewportMode.modeContract;
    this.activeSpecModeContract = viewportMode.specModeContract;
    this.activeViewportMode = viewportMode.mode;
    const isPortrait = viewportMode.isMobilePortrait;
    const isDesktop = viewportMode.isDesktop;
    const margin = 10;
    const mode = ['canvas', 'timeline'].includes(this.workspaceMode) ? this.workspaceMode : 'split';
    if (isPortrait) {
      this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
      const shared = buildCutscenePortraitEditorLayout(width, height);
      const work = shared.mainEditor;
      const contextH = 48;
      const zoomH = 24;
      const gap = 6;
      const timelineH = mode === 'timeline'
        ? Math.max(120, work.h - contextH - zoomH - 80)
        : mode === 'canvas'
          ? clamp(Math.round(work.h * 0.16), 64, 92)
          : clamp(Math.round(work.h * 0.28), 112, Math.max(112, work.h - 96));
      const zoomBounds = { x: work.x, y: Math.max(work.y, work.y + work.h - zoomH), w: work.w, h: zoomH };
      const contextBounds = { x: work.x, y: Math.max(work.y, zoomBounds.y - contextH - gap), w: work.w, h: contextH };
      const timelineBounds = { x: work.x, y: contextBounds.y - timelineH - gap, w: work.w, h: timelineH };
      const stageBounds = { x: work.x, y: work.y, w: work.w, h: Math.max(64, timelineBounds.y - work.y - gap) };
      return {
        isPortrait,
        mode,
        stageBounds,
        timelineBounds,
        contextBounds,
        zoomBounds,
        railBounds: shared.middleRail,
        menuBounds: {
          ...shared.menuSheet,
          rootTabs: shared.rootTabs,
          rootRail: shared.rootRail,
          subRail: shared.subRail,
          sheetContent: shared.sheetContent
        },
        portraitRootPlacement: shared.portraitRootPlacement
      };
    }
    if (isDesktop) {
      resetSharedThumbstickState(this.panJoystick);
      const openDesktopRootId = resolveDesktopDropdownRootId({
        openRootId: this.openDesktopDropdownRootId,
        closedRootId: this.closedDesktopDropdownRootId,
        isDesktop
      });
      const shell = buildDesktopEditorShellPlan('cutscene', {
        viewportWidth: width,
        viewportHeight: height,
        activeRootId: openDesktopRootId,
        dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0
      });
      this.desktopDropdown = resolveDesktopDropdownState({
        isDesktop: true,
        dropdown: shell.dropdown,
        previousDropdown: this.desktopDropdown
      });
      const work = shell.workSurface;
      const contextH = 46;
      const timelineH = mode === 'timeline'
        ? Math.max(160, work.h - contextH - margin * 3 - 96)
        : mode === 'canvas'
          ? clamp(Math.round(work.h * 0.14), 64, 92)
          : clamp(Math.round(work.h * 0.24), 104, 148);
      const timelineBounds = { x: work.x, y: work.y + work.h - timelineH, w: work.w, h: timelineH };
      const contextBounds = { x: work.x, y: timelineBounds.y - contextH - margin, w: work.w, h: contextH };
      const stageBounds = { x: work.x, y: work.y, w: work.w, h: Math.max(80, contextBounds.y - work.y - margin) };
      return {
        isPortrait: false,
        isDesktop: true,
        mode,
        stageBounds,
        timelineBounds,
        contextBounds,
        zoomBounds: null,
        railBounds: null,
        menuBounds: shell.leftOptions,
        desktopShell: shell
      };
    }
    this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
    resetSharedThumbstickState(this.panJoystick);
    const railH = 86;
    const resolvedGamepadMenuState = gamepadMenuState || this.getGamepadMenuState(width, height);
    const gamepadSubmenuOnLeft = resolvedGamepadMenuState.drawSlideOut;
    const landscape = buildLandscapeTouchEditorShellPlan('cutscene', {
      viewportWidth: width,
      viewportHeight: height,
      bottomRailHeight: railH,
      rightRailWidth: Math.min(340, Math.max(248, Math.floor(width * 0.28))),
      reserveRightRail: !gamepadSubmenuOnLeft && (this.landscapeRootDrawerOpen || this.menuOpen || this.clipOptionsOpen)
    });
    const work = landscape.surfaces.workSurface;
    const submenuDrawer = landscape.surfaces.submenu;
    const overlayDrawer = landscape.surfaces.overlayDrawer;
    const rootDrawer = landscape.surfaces.rootDrawer ?? overlayDrawer;
    const commandRail = landscape.surfaces.compactCommandRail ?? landscape.surfaces.rootMenu;
    const drawerSurface = submenuDrawer ?? overlayDrawer;
    const drawerW = drawerSurface?.w ?? getSharedMobileDrawerWidth(width, height, commandRail?.w || 76, { edgePadding: 0 });
    const rootDrawerW = rootDrawer?.w ?? drawerW;
    const contextH = 46;
    const timelineH = mode === 'timeline'
      ? Math.max(160, work.h - contextH - margin * 3 - 96)
      : mode === 'canvas'
        ? clamp(Math.round(work.h * 0.14), 64, 92)
        : clamp(Math.round(work.h * 0.24), 104, 148);
    const timelineBounds = { x: work.x, y: work.y + work.h - timelineH, w: work.w, h: timelineH };
    const contextBounds = { x: work.x, y: timelineBounds.y - contextH - margin, w: work.w, h: contextH };
    const stageBounds = { x: work.x, y: work.y, w: work.w, h: Math.max(80, contextBounds.y - work.y - margin) };
    return {
      isPortrait,
      isLandscapeTouch: true,
      mode,
      stageBounds,
      timelineBounds,
      contextBounds,
      zoomBounds: null,
      railBounds: landscape.surfaces.toolOptions,
      landscapeShell: landscape,
      leftMenuBounds: commandRail,
      rootMenuBounds: {
        x: rootDrawer?.x ?? commandRail.x + commandRail.w,
        y: rootDrawer?.y ?? 0,
        w: rootDrawerW,
        h: rootDrawer?.h ?? height
      },
      menuBounds: {
        x: drawerSurface?.x ?? width - drawerW,
        y: drawerSurface?.y ?? 0,
        w: drawerW,
        h: drawerSurface?.h ?? height
      }
    };
  }

  updateThumbstickPan(dt) {
    if (!canRenderEditorSurface(this.activeViewportMode, 'touch-thumbstick')
      || !this.panJoystick?.active
      || !this.bounds.timeline) return;
    const dx = clamp(safeNumber(this.panJoystick.dx, 0), -1, 1);
    const dy = clamp(safeNumber(this.panJoystick.dy, 0), -1, 1);
    if (Math.abs(dx) < 0.04 && Math.abs(dy) < 0.04) return;
    const seconds = Math.max(0.001, safeNumber(dt, 0.016));
    const layout = this.getTimelineLayout(this.bounds.timeline);
    const pxPerSecond = Math.max(120, layout.track.w * 0.9);
    this.panTimeline(dx * pxPerSecond * seconds, dy * pxPerSecond * seconds, this.bounds.timeline);
  }

  drawTimelineZoomSlider(ctx, bounds) {
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) {
      this.timelineZoomSlider.bounds = null;
      this.timelineZoomSlider.railBounds = null;
      return;
    }
    const padX = 16;
    const railH = 10;
    const rail = {
      x: bounds.x + padX,
      y: bounds.y + Math.max(3, Math.floor((bounds.h - railH) / 2)),
      w: Math.max(1, bounds.w - padX * 2),
      h: railH
    };
    const ratio = clamp((safeNumber(this.timelineZoomX, 1) - CUTSCENE_TIMELINE_MIN_ZOOM) / Math.max(0.001, CUTSCENE_TIMELINE_MAX_ZOOM - CUTSCENE_TIMELINE_MIN_ZOOM), 0, 1);
    this.timelineZoomSlider.railBounds = rail;
    this.timelineZoomSlider.bounds = { x: rail.x, y: rail.y - 10, w: rail.w, h: rail.h + 20 };
    this.bounds.timelineZoom = this.timelineZoomSlider.bounds;
    drawSharedMobileZoomSlider(ctx, rail, ratio, { knobColor: '#45f0ff', railColor: 'rgba(7,16,21,0.72)' });
  }

  setTimelineZoomFromScreen(x) {
    const rail = this.timelineZoomSlider.railBounds;
    if (!rail || !this.bounds.timeline) return;
    const t = clamp((safeNumber(x, rail.x) - rail.x) / Math.max(1, rail.w), 0, 1);
    const nextZoom = CUTSCENE_TIMELINE_MIN_ZOOM + t * (CUTSCENE_TIMELINE_MAX_ZOOM - CUTSCENE_TIMELINE_MIN_ZOOM);
    this.adjustTimelineZoom(nextZoom / Math.max(0.001, safeNumber(this.timelineZoomX, 1)));
  }

  drawError(ctx, width, height, error) {
    this.statusText = `Cutscene draw error: ${error?.message || error}`;
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.bg;
    ctx.fillRect(0, 0, width, height);
    const panel = {
      x: 16,
      y: 16,
      w: Math.max(1, width - 32),
      h: Math.min(Math.max(96, height - 32), 160)
    };
    drawSharedPanel(ctx, panel, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `14px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Cutscene Editor recovered from a draw error.', panel.x + 12, panel.y + 14);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillText(String(error?.message || error || ''), panel.x + 12, panel.y + 42, panel.w - 24);
    ctx.restore();
  }

  getTimelineViewportOptions(bounds = this.bounds.timeline) {
    return {
      zoomX: this.timelineZoomX,
      scrollMs: this.timelineScrollMs,
      scrollTrack: this.timelineScrollTrack,
      minLaneHeight: this.workspaceMode === 'timeline' ? CUTSCENE_TIMELINE_MIN_LANE_H + 4 : CUTSCENE_TIMELINE_MIN_LANE_H,
      tracks: this.document?.tracks || []
    };
  }

  getTimelineLayout(bounds = this.bounds.timeline) {
    const layout = getCutsceneTimelineLayout(bounds, this.document?.durationMs, this.document?.clips || [], this.getTimelineViewportOptions(bounds));
    this.timelineZoomX = layout.zoomX;
    this.timelineScrollMs = layout.scrollMs;
    this.timelineScrollTrack = layout.scrollTrack;
    return layout;
  }

  clampTimelineViewport(bounds = this.bounds.timeline) {
    this.getTimelineLayout(bounds);
  }

  fitTimeline() {
    this.timelineZoomX = 1;
    this.timelineScrollMs = 0;
    this.timelineScrollTrack = 0;
    this.statusText = 'Timeline fit';
  }

  setWorkspaceMode(mode) {
    if (!['split', 'canvas', 'timeline'].includes(mode)) return;
    this.workspaceMode = mode;
    this.statusText = mode === 'canvas' ? 'Canvas view' : mode === 'timeline' ? 'Timeline view' : 'Split view';
  }

  adjustTimelineZoom(multiplier, anchorMs = null) {
    const oldZoom = clamp(safeNumber(this.timelineZoomX, 1), CUTSCENE_TIMELINE_MIN_ZOOM, CUTSCENE_TIMELINE_MAX_ZOOM);
    const duration = Math.max(1, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS));
    const oldVisible = oldZoom > 1 ? duration / oldZoom : duration;
    const oldStart = clamp(safeNumber(this.timelineScrollMs, 0), 0, Math.max(0, duration - oldVisible));
    const defaultAnchor = oldStart + oldVisible / 2;
    const selectedAnchor = this.getSelectedTimelineFocusMs();
    const anchor = clamp(Number.isFinite(anchorMs)
      ? safeNumber(anchorMs, defaultAnchor)
      : safeNumber(selectedAnchor, defaultAnchor), 0, duration);
    const ratio = oldVisible > 0 ? clamp((anchor - oldStart) / oldVisible, 0, 1) : 0.5;
    const nextZoom = clamp(oldZoom * safeNumber(multiplier, 1), CUTSCENE_TIMELINE_MIN_ZOOM, CUTSCENE_TIMELINE_MAX_ZOOM);
    const nextVisible = nextZoom > 1 ? duration / nextZoom : duration;
    this.timelineZoomX = nextZoom;
    this.timelineScrollMs = clamp(anchor - ratio * nextVisible, 0, Math.max(0, duration - nextVisible));
    this.statusText = `Timeline ${nextZoom.toFixed(nextZoom >= 10 ? 0 : 1)}x`;
  }

  getSelectedTimelineFocusMs() {
    const selected = this.getSelectedClip();
    if (selected) {
      return safeNumber(selected.startMs) + Math.max(1, safeNumber(selected.durationMs, 1)) / 2;
    }
    return this.playheadMs;
  }

  focusInitialDocumentContent() {
    const clips = Array.isArray(this.document?.clips) ? this.document.clips : [];
    if (!clips.length) return;
    const first = [...clips].sort((a, b) => safeNumber(a.startMs) - safeNumber(b.startMs))[0];
    if (!first) return;
    this.selectedClipId = first.id || this.selectedClipId;
    this.selectedTrackId = null;
    this.playheadMs = clamp(safeNumber(first.startMs), 0, this.document.durationMs);
    const focusMs = safeNumber(first.startMs) + Math.max(1, safeNumber(first.durationMs, 1)) / 2;
    const duration = Math.max(1, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS));
    const visible = this.timelineZoomX > 1 ? duration / this.timelineZoomX : duration;
    this.timelineScrollMs = clamp(focusMs - visible / 2, 0, Math.max(0, duration - visible));
    const trackIndex = this.getTrackIndexById(first.trackId);
    if (trackIndex >= 0) this.timelineScrollTrack = trackIndex;
  }

  panTimeline(deltaX = 0, deltaY = 0, bounds = this.bounds.timeline) {
    const layout = this.getTimelineLayout(bounds);
    if (deltaX) {
      const msPerPx = layout.visibleDuration / Math.max(1, layout.track.w);
      this.timelineScrollMs = clamp(layout.scrollMs + safeNumber(deltaX) * msPerPx, 0, layout.maxScrollMs);
    }
    if (deltaY) {
      const laneStep = Math.max(1, layout.laneH + layout.laneGap);
      this.timelineScrollTrack = clamp(layout.scrollTrack + safeNumber(deltaY) / laneStep, 0, layout.maxScrollTrack);
    }
    this.clampTimelineViewport(bounds);
  }

  getTimelineSnapThresholdMs(timelineLayout) {
    const track = timelineLayout?.track;
    if (!track?.w) return 0;
    return Math.max(1, (safeNumber(timelineLayout.visibleDuration, this.document?.durationMs || DEFAULT_DURATION_MS) / Math.max(1, track.w)) * CUTSCENE_TIMELINE_SNAP_PX);
  }

  snapMovedTimelineClipToPlayhead(startMs, clip, timelineLayout) {
    const durationMs = Math.max(1, safeNumber(clip?.durationMs, 1));
    const maxStart = Math.max(0, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS) - durationMs);
    const clampedStart = clamp(Math.round(startMs), 0, maxStart);
    if (this.document?.snapEnabled === false) return { startMs: clampedStart, snapped: false };
    const playheadMs = clamp(safeNumber(this.playheadMs), 0, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS));
    const thresholdMs = this.getTimelineSnapThresholdMs(timelineLayout);
    const candidates = [];
    if (playheadMs <= maxStart) candidates.push({ startMs: playheadMs, distance: Math.abs(clampedStart - playheadMs) });
    const endStart = playheadMs - durationMs;
    if (endStart >= 0 && endStart <= maxStart) candidates.push({ startMs: endStart, distance: Math.abs(clampedStart + durationMs - playheadMs) });
    const best = candidates
      .filter((candidate) => candidate.distance <= thresholdMs)
      .sort((a, b) => a.distance - b.distance)[0];
    return best ? { startMs: Math.round(best.startMs), snapped: true } : { startMs: clampedStart, snapped: false };
  }

  snapResizedTimelineClipToPlayhead(durationMs, clip, minDuration, maxDuration, timelineLayout) {
    const clampedDuration = clamp(Math.round(durationMs), minDuration, maxDuration);
    if (this.document?.snapEnabled === false) return { durationMs: clampedDuration, snapped: false };
    const playheadMs = clamp(safeNumber(this.playheadMs), 0, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS));
    const snappedDuration = playheadMs - safeNumber(clip?.startMs);
    if (snappedDuration < minDuration || snappedDuration > maxDuration) return { durationMs: clampedDuration, snapped: false };
    const thresholdMs = this.getTimelineSnapThresholdMs(timelineLayout);
    const distance = Math.abs(safeNumber(clip?.startMs) + clampedDuration - playheadMs);
    if (distance > thresholdMs) return { durationMs: clampedDuration, snapped: false };
    return { durationMs: Math.round(snappedDuration), snapped: true };
  }

  drawTimeline(ctx, bounds) {
    ctx.save();
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border, title: 'Timeline', titleSize: 13 });
    const clips = this.document.clips || [];
    const layout = this.getTimelineLayout(bounds);
    this.bounds.timelineTrack = layout.track;
    const playX = timelineMsToX(this.playheadMs, layout);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.bounds.x, layout.track.y, layout.bounds.w, layout.track.h);
    ctx.clip();
    layout.laneBounds.forEach((lane) => {
      const { y, h } = lane.bounds;
      const selectedTrack = lane.trackId && lane.trackId === this.selectedTrackId;
      ctx.fillStyle = selectedTrack ? 'rgba(255,225,106,0.18)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(lane.bounds.x, y, lane.bounds.w, h);
      ctx.fillStyle = selectedTrack ? '#ffe16a' : UI_SUITE.colors.muted;
      ctx.fillText(lane.label, bounds.x + 8, y + h / 2 + 4, layout.labelW - 12);
      this.bounds.trackLabels.push({ x: bounds.x, y, w: layout.labelW, h, id: lane.trackId, trackId: lane.trackId, trackIndex: lane.index });
      this.bounds.trackLanes.push({ x: bounds.x, y, w: bounds.w, h, id: lane.trackId, trackId: lane.trackId, trackIndex: lane.index });
    });
    ctx.restore();
    const tickCount = Math.max(2, Math.min(8, Math.floor(layout.track.w / 80)));
    for (let i = 0; i <= tickCount; i += 1) {
      const tickMs = layout.visibleStartMs + (layout.visibleDuration / tickCount) * i;
      const x = timelineMsToX(tickMs, layout);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(x, layout.track.y);
      ctx.lineTo(x, bounds.y + bounds.h - 8);
      ctx.stroke();
    }
    if (playX >= layout.track.x && playX <= layout.track.x + layout.track.w) {
      ctx.strokeStyle = '#ffe16a';
      ctx.lineWidth = this.timelineSnapGuideMs != null ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(playX, layout.track.y);
      ctx.lineTo(playX, bounds.y + bounds.h - 8);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.track.x, layout.track.y, layout.track.w, layout.track.h);
    ctx.clip();
    const trackSlots = new Map();
    (this.document.tracks || []).forEach((track) => {
      const trackClips = clips.filter((entry) => (entry.trackId || '') === track.id);
      trackSlots.set(track.id, assignTimelineClipSlots(trackClips));
    });
    clips.forEach((clip) => {
      const lane = layout.laneBounds.find((entry) => entry.trackId === clip.trackId);
      if (!lane) return;
      const packing = trackSlots.get(clip.trackId) || assignTimelineClipSlots([clip]);
      const stackedCount = Math.min(3, Math.max(1, packing.slotCount));
      const slot = Math.min(safeNumber(packing.slots.get(clip.id), 0), stackedCount - 1);
      const slotH = Math.max(14, Math.floor((lane.bounds.h - 6) / stackedCount));
      const y = lane.bounds.y + 3 + slot * slotH;
      const x = timelineMsToX(clip.startMs, layout);
      const endX = timelineMsToX(clip.startMs + Math.max(120, clip.durationMs || 120), layout);
      if (endX < layout.track.x || x > layout.track.x + layout.track.w) return;
      const visibleX = Math.max(layout.track.x, x);
      const visibleEndX = Math.min(layout.track.x + layout.track.w, Math.max(endX, x + (clip.type === 'pause' ? 16 : 22)));
      const w = Math.max(clip.type === 'pause' ? 16 : 22, visibleEndX - visibleX);
      const h = Math.max(12, slotH - 4);
      const clipBounds = { x: visibleX, y, w, h, id: clip.id, laneId: lane.id, trackId: lane.trackId, trackIndex: lane.index, startMs: clip.startMs, endMs: getClipEndMs(clip) };
      ctx.fillStyle = getCutsceneTimelineClipColor(clip);
      ctx.fillRect(visibleX, y, w, h);
      if (clip.id === this.selectedClipId) {
        ctx.strokeStyle = '#ffe16a';
        ctx.lineWidth = 2;
        ctx.strokeRect(visibleX + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
      }
      ctx.fillStyle = '#071015';
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText(this.getClipLabel(clip), visibleX + 5, y + Math.max(12, h / 2 + 4), Math.max(10, w - 10));
      this.bounds.clips.push(clipBounds);
      if (clip.id === this.selectedClipId && clip.type !== 'pause') {
        const handleX = timelineMsToX(clip.startMs + Math.max(120, clip.durationMs || 120), layout) - 8;
        if (handleX >= layout.track.x - 16 && handleX <= layout.track.x + layout.track.w) {
          const handle = { x: clamp(handleX, layout.track.x, layout.track.x + layout.track.w - 16), y, w: 16, h, id: clip.id, edge: 'end' };
          this.bounds.clipHandles.push(handle);
          ctx.fillStyle = 'rgba(7,16,21,0.75)';
          ctx.fillRect(handle.x + 5, handle.y + 3, 6, Math.max(4, handle.h - 6));
          ctx.fillStyle = '#fff7b0';
          ctx.fillRect(handle.x + 7, handle.y + 5, 2, Math.max(2, handle.h - 10));
        }
      }
      if (isKeyframeClip(clip) && Array.isArray(clip.keyframes)) {
        clip.keyframes.filter((keyframe) => keyframe?.manual === true).forEach((keyframe) => {
          const keyX = timelineMsToX(clip.startMs + keyframe.timeMs, layout);
          if (keyX < layout.track.x || keyX > layout.track.x + layout.track.w) return;
          const keyY = y + Math.max(6, (lane.bounds.h - 6) / 2);
          const isActive = clip.id === this.selectedClipId && this.getSelectedKeyframe(clip) === keyframe;
          this.bounds.keyframes.push({ x: keyX - CUTSCENE_KEYFRAME_HIT_SIZE / 2, y: keyY - CUTSCENE_KEYFRAME_HIT_SIZE / 2, w: CUTSCENE_KEYFRAME_HIT_SIZE, h: CUTSCENE_KEYFRAME_HIT_SIZE, id: clip.id, timeMs: keyframe.timeMs });
          ctx.fillStyle = isActive ? '#071015' : '#fff7b0';
          ctx.strokeStyle = isActive ? '#ffe16a' : 'rgba(7,16,21,0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(keyX, keyY - 6);
          ctx.lineTo(keyX + 6, keyY);
          ctx.lineTo(keyX, keyY + 6);
          ctx.lineTo(keyX - 6, keyY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }
      if (clip.type === 'actor' && Array.isArray(clip.stateEvents)) {
        clip.stateEvents.forEach((event) => {
          const eventX = timelineMsToX(clip.startMs + event.timeMs, layout);
          if (eventX < layout.track.x || eventX > layout.track.x + layout.track.w) return;
          const eventBounds = { x: eventX - 5, y: y + 1, w: 10, h: Math.max(1, lane.bounds.h - 8), id: clip.id, eventId: event.id, timeMs: event.timeMs };
          this.bounds.stateEvents.push(eventBounds);
          ctx.fillStyle = '#45f0ff';
          ctx.fillRect(eventX - 1, eventBounds.y, 2, eventBounds.h);
          ctx.beginPath();
          ctx.moveTo(eventX, eventBounds.y);
          ctx.lineTo(eventX + 5, eventBounds.y + 6);
          ctx.lineTo(eventX - 5, eventBounds.y + 6);
          ctx.closePath();
          ctx.fill();
        });
      }
    });
    ctx.restore();
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'right';
    const zoomLabel = layout.zoomX > 1 ? ` ${layout.zoomX.toFixed(layout.zoomX >= 10 ? 0 : 1)}x` : '';
    ctx.fillText(`${Math.round(this.playheadMs)}ms / ${Math.round(layout.duration)}ms${zoomLabel}`, bounds.x + bounds.w - 8, bounds.y + 18);
    if (layout.maxScrollMs > 0) {
      const bar = { x: layout.track.x, y: bounds.y + bounds.h - 8, w: layout.track.w, h: 3 };
      const thumbW = Math.max(18, bar.w * (layout.visibleDuration / layout.duration));
      const thumbX = bar.x + (bar.w - thumbW) * (layout.scrollMs / Math.max(1, layout.maxScrollMs));
      ctx.fillStyle = UI_SUITE.colors.panel;
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = UI_SUITE.colors.accent;
      ctx.fillRect(thumbX, bar.y, thumbW, bar.h);
    }
    if (layout.maxScrollTrack > 0) {
      const bar = { x: bounds.x + bounds.w - 5, y: layout.track.y, w: 3, h: layout.track.h };
      const thumbH = Math.max(18, bar.h * (layout.visibleTrackCount / Math.max(1, layout.lanes.length)));
      const thumbY = bar.y + (bar.h - thumbH) * (layout.scrollTrack / Math.max(1, layout.maxScrollTrack));
      ctx.fillStyle = UI_SUITE.colors.panel;
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = UI_SUITE.colors.accent;
      ctx.fillRect(bar.x, thumbY, bar.w, thumbH);
    }
    ctx.restore();
  }

  drawActionRail(ctx, bounds, isPortrait) {
    ctx.save();
    const portraitActionById = {
      menu: { id: 'menu', label: '☰', onClick: () => this.toggleBottomMenu() },
      undo: { id: 'undo', label: '↶', onClick: () => this.undo() },
      redo: { id: 'redo', label: '↷', onClick: () => this.redo() },
      play: { id: 'play', label: this.isPlaying ? '❚❚' : '▶', primary: true, active: this.isPlaying, onClick: () => this.togglePlayback(), onHold: true }
    };
    const actions = (isPortrait ? buildCutscenePortraitMenuModel().bottomRailActions.map((id) => portraitActionById[id]).filter(Boolean) : [
      { id: 'view-canvas', label: 'Canvas', active: this.workspaceMode === 'canvas', onClick: () => this.setWorkspaceMode('canvas') },
      { id: 'view-split', label: 'Split', active: this.workspaceMode === 'split', onClick: () => this.setWorkspaceMode('split') },
      { id: 'view-timeline', label: 'Time', active: this.workspaceMode === 'timeline', onClick: () => this.setWorkspaceMode('timeline') },
      { id: 'timeline-zoom-out', label: 'Zoom -', onClick: () => this.adjustTimelineZoom(1 / 1.35) },
      { id: 'timeline-zoom-in', label: 'Zoom +', onClick: () => this.adjustTimelineZoom(1.35) }
    ]);
    if (isPortrait) {
      drawSharedPortraitActionRail(ctx, bounds, this.panJoystick, actions, {
        drawButton: (buttonBounds, action) => this.drawActionButton(ctx, buttonBounds, action)
      });
      if (this.statusText) {
        const statusPad = 8;
        const statusH = 24;
        const statusW = Math.min(bounds.w - 16, Math.max(140, this.statusText.length * 7 + statusPad * 2));
        const statusX = bounds.x + Math.floor((bounds.w - statusW) / 2);
        const statusY = bounds.y + 8;
        ctx.fillStyle = 'rgba(7,16,21,0.92)';
        ctx.strokeStyle = 'rgba(255,225,106,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect?.(statusX, statusY, statusW, statusH, 8);
        if (typeof ctx.roundRect === 'function') {
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(statusX, statusY, statusW, statusH);
          ctx.strokeRect(statusX, statusY, statusW, statusH);
        }
        ctx.fillStyle = UI_SUITE.colors.text;
        ctx.font = `11px ${UI_SUITE.font.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.statusText, statusX + statusW / 2, statusY + statusH / 2, statusW - statusPad * 2);
      }
    } else {
      drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
      const gap = 10;
      const buttonH = 48;
      const titleW = Math.min(260, Math.max(120, bounds.w * 0.3));
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `14px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.fillText(this.currentDocumentRef?.name || this.document.name, bounds.x + 12, bounds.y + 28, titleW - 16);
      const actionX = bounds.x + titleW;
      const actionW = Math.max(1, bounds.x + bounds.w - 12 - actionX);
      const buttonW = Math.max(52, Math.floor((actionW - gap * (actions.length - 1)) / actions.length));
      actions.forEach((action, index) => {
        this.drawActionButton(ctx, {
          x: actionX + index * (buttonW + gap),
          y: bounds.y + Math.floor((bounds.h - buttonH) / 2),
          w: index === actions.length - 1 ? Math.max(52, actionX + actionW - (actionX + index * (buttonW + gap))) : buttonW,
          h: buttonH
        }, action);
      });
      if (this.statusText) {
        ctx.fillStyle = UI_SUITE.colors.muted;
        ctx.font = `11px ${UI_SUITE.font.family}`;
        ctx.fillText(this.statusText, bounds.x + 12, bounds.y + bounds.h - 12, titleW - 16);
      }
    }
    if (this.transportPopover) this.drawTransportPopover(ctx);
    ctx.restore();
  }

  drawActionButton(ctx, bounds, action) {
    const normalized = normalizeSharedControlBounds({ ...bounds, id: action.id });
    const color = drawSharedMenuButtonChrome(ctx, normalized, { active: Boolean(action.active), primary: Boolean(action.primary) });
    drawSharedMenuButtonLabel(ctx, normalized, action.label, {
      color,
      fontSize: 17,
      maxWidth: Math.max(10, normalized.w - 10)
    });
    this.bounds.buttons.push({ ...normalized, id: action.id, onClick: action.onClick, onHold: action.onHold });
  }

  drawDesktopShellChrome(ctx, shell) {
    if (!shell) return;
    const openRootId = resolveDesktopDropdownRootId({
      openRootId: this.openDesktopDropdownRootId,
      closedRootId: this.closedDesktopDropdownRootId,
      isDesktop: true
    });
    drawSharedDesktopTopMenu(ctx, shell.topMenu, {
      activeId: openRootId,
      focusedId: this.controllerMenu.getFocusedItem('root')?.id,
      idPrefix: 'desktop-root:',
      registerButton: (button) => {
      this.bounds.buttons.push(createDesktopRootMenuHit(button, null, { idPrefix: 'desktop-root:' }));
      }
    });
    drawSharedDesktopRibbon(ctx, shell.leftRibbon, {
      title: 'Cutscene',
      subtitle: getCutsceneMenuLabel(this.activeMenuTab)
    });
  }

  drawDesktopLeftOptions(ctx, bounds) {
    if (!bounds) return;
    const { contextBounds, transportBounds } = buildSharedDesktopContextTransportLayout(bounds, {
      includeTransport: true,
      gap: 8,
      minContextHeight: 120
    });
    this.bounds.desktopMenuPanel = contextBounds;
    this.bounds.menuScrollMax = 0;
    this.menuScroll = 0;
    const selectedClip = this.getSelectedClip();
    const selectedTrack = this.getSelectedTrack();
    const lines = [
      `Document: ${this.currentDocumentRef?.name || this.document.name || 'Untitled'}`,
      `Mode: ${this.workspaceMode}`,
      `Active: ${getCutsceneMenuLabel(this.activeMenuTab)}`,
      selectedClip ? `Clip: ${selectedClip.name || selectedClip.id}` : selectedTrack ? `Track: ${selectedTrack.name || selectedTrack.id}` : 'Selection: None',
      `Duration: ${Math.round(Math.max(1, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS)) / 100) / 10}s`
    ];
    drawSharedDesktopContextPanel(ctx, contextBounds, {
      lines,
      status: this.statusText || '',
      contentRoles: ['document-summary', 'selection-summary', 'transport', 'status'],
      padding: 10
    });
    if (transportBounds) this.drawDesktopTransportPanel(ctx, transportBounds);
  }

  drawDesktopTransportPanel(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    const pad = 10;
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Transport', bounds.x + pad, bounds.y + 17, bounds.w - pad * 2);
    const actions = this.getTransportActions();
    const rowY = bounds.y + 34;
    const rowH = 36;
    const buttonGap = 6;
    const buttonW = Math.max(34, Math.floor((bounds.w - pad * 2 - buttonGap * (actions.length - 1)) / actions.length));
    actions.forEach((action, index) => {
      this.drawActionButton(ctx, {
        x: bounds.x + pad + index * (buttonW + buttonGap),
        y: rowY,
        w: buttonW,
        h: rowH
      }, action);
    });
    const labelY = rowY + rowH + 10;
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText(this.currentDocumentRef?.name || this.document.name, bounds.x + pad, labelY, bounds.w - pad * 2);
    if (this.statusText) {
      ctx.fillText(this.statusText, bounds.x + pad, labelY + 16, bounds.w - pad * 2);
    }
  }

  drawDesktopDropdown(ctx, shell) {
    this.bounds.desktopDropdownItems = [];
    if (!shell?.dropdown) return;
    const controllerMenus = this.buildControllerMenus();
    const controllerMenu = controllerMenus[shell.dropdown.rootId] || controllerMenus[shell.dropdown.specId];
    const controllerItems = this.controllerMenu.getItems(controllerMenu);
    const dropdownPlan = buildDesktopDropdownRenderPlan({
      dropdown: this.desktopDropdown?.rootId === shell.dropdown.rootId ? this.desktopDropdown : shell.dropdown,
      items: controllerItems,
      disableActionlessItems: true
    });
    if (!dropdownPlan.renderedItems.length) return;
    drawSharedDesktopDropdown(ctx, dropdownPlan, {
      isActive: (item) => Boolean(item.active) || this.isControllerMenuItemActive(shell.dropdown.rootId, item.id),
      registerScrollRegion: (region) => {
        this.menuScrollRegions.push(region);
      },
      registerButton: ({ item, bounds }) => {
        const action = item.action || item.onClick || (typeof item.onSelect === 'function' ? () => item.onSelect(this) : null);
        const button = createDesktopDropdownCommandHit(item, bounds, action);
        if (button.action) this.bounds.desktopDropdownItems.push(button);
      }
    });
  }

  getTransportActions() {
    const duration = Math.max(1, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS));
    const step = getFrameStepMs(this.document);
    return [
      { id: 'start', label: '⏮', col: 0, row: 0, action: () => { this.pausePlayback(); this.playheadMs = 0; } },
      { id: 'back', label: '⏪', col: 0, row: 1, action: () => { this.pausePlayback(); this.playheadMs = clamp(this.playheadMs - step, 0, duration); } },
      { id: 'forward', label: '⏩', col: 0, row: 2, action: () => { this.pausePlayback(); this.playheadMs = clamp(this.playheadMs + step, 0, duration); } },
      { id: 'end', label: '⏭', col: 0, row: 3, action: () => { this.pausePlayback(); this.playheadMs = duration; } },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶', col: 1, row: 1, primary: true, active: this.isPlaying, action: () => this.togglePlayback() }
    ];
  }

  drawTransportPopover(ctx) {
    const layout = drawSharedTransportPopover(ctx, this.transportPopover.anchor, { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }, this.getTransportActions(), {
      columns: 2,
      columnWidth: 54,
      rowHeight: 42
    });
    this.bounds.transportPopoverButtons = layout.buttons.map((button) => ({ ...button.bounds, id: button.id, action: button.action }));
  }

  openTransportPopover(anchor) {
    this.transportPopover = { anchor: { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h } };
  }

  closeTransportPopover() {
    this.transportPopover = null;
    this.bounds.transportPopoverButtons = [];
  }

  startTransportHold(button, x, y) {
    this.cancelTransportHold();
    this.transportHold = {
      x,
      y,
      button,
      fired: false,
      timer: window.setTimeout(() => {
        if (!this.transportHold) return;
        this.transportHold.fired = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
        this.openTransportPopover(button);
      }, 500)
    };
  }

  cancelTransportHold() {
    if (this.transportHold?.timer) window.clearTimeout(this.transportHold.timer);
    this.transportHold = null;
  }

  getTimelineViewActions() {
    return [
      { id: 'view-canvas', label: 'Canvas', active: this.workspaceMode === 'canvas' },
      { id: 'view-split', label: 'Split', active: this.workspaceMode === 'split' },
      { id: 'view-timeline', label: 'Time', active: this.workspaceMode === 'timeline' },
      { id: 'timeline-fit', label: 'Fit' }
    ];
  }

  drawContextRibbon(ctx, bounds) {
    const selected = this.getSelectedClip();
    const selectedTrack = this.getSelectedTrack();
    if (!bounds) return;
    const actions = !selected && !selectedTrack
      ? this.getTimelineViewActions()
      : [{ id: 'clip-options', label: 'Edit', active: this.clipOptionsOpen, primary: true }];
    drawSharedContextRibbon(ctx, bounds, actions, {
      title: selected ? 'Clip' : selectedTrack ? 'Track' : 'View',
      minButtonWidth: selected || selectedTrack ? 54 : 58,
      registerAction: (buttonBounds, action) => this.bounds.contextButtons.push({ ...buttonBounds, id: action.id }),
      drawButton: (buttonBounds, action) => {
        const color = drawSharedMenuButtonChrome(ctx, buttonBounds, { active: Boolean(action.active) || (action.id === 'loop' && selected?.loop) });
        drawSharedMenuButtonLabel(ctx, buttonBounds, action.label, { color, fontSize: 11, maxWidth: buttonBounds.w - 8 });
      }
    });
  }

  getSelectedVisualContextActions(selected) {
    if (selected?.type === 'text') {
      return [
        { id: 'edit-text', label: 'Edit' },
        { id: 'text-color', label: 'Color' },
        { id: 'font-size', label: `Size ${selected.fontSize}` },
        { id: 'set-key', label: 'Set Key' },
        { id: 'actions', label: 'More' }
      ];
    }
    if (selected?.type === 'actor') {
      return [
        { id: 'actor-state', label: 'State' },
        { id: 'next-state', label: 'Next' },
        { id: 'play-animation', label: selected.playAnimation ? 'Anim On' : 'Anim Off' },
        { id: 'set-key', label: 'Set Key' },
        { id: 'actions', label: 'More' }
      ];
    }
    if (selected?.type === 'color-board') {
      return [
        { id: 'board-color', label: 'Color' },
        { id: 'opacity', label: `Opacity ${Math.round(safeNumber(selected.opacity, 1) * 100)}%` },
        { id: 'set-key', label: 'Set Key' },
        { id: 'actions', label: 'More' }
      ];
    }
    return [
      { id: 'scale', label: 'Scale' },
      { id: 'rotate', label: 'Rotate' },
      { id: 'fx', label: 'FX' },
      { id: 'set-key', label: 'Set Key' },
      { id: 'actions', label: 'More' }
    ];
  }

  getClipOptionItems(clip = this.getSelectedClip(), tab = this.clipOptionsTab) {
    const selectedTrack = this.getSelectedTrack();
    if (!clip && selectedTrack) {
      const trackIndex = this.getSelectedTrackIndex();
      const trackCount = (this.document.tracks || []).length;
      return [
        { id: 'rename-track', label: 'Rename' },
        { id: 'track-up', label: 'Move Up', disabled: trackIndex <= 0 },
        { id: 'track-down', label: 'Move Down', disabled: trackIndex < 0 || trackIndex >= trackCount - 1 },
        { id: 'track-top', label: 'To Top', disabled: trackIndex <= 0 },
        { id: 'track-bottom', label: 'To Bottom', disabled: trackIndex < 0 || trackIndex >= trackCount - 1 },
        { id: 'delete-track', label: 'Delete Track', disabled: trackCount <= 1 }
      ];
    }
    if (!clip) return [];
    if (tab === 'edit') {
      return [
        { id: 'copy', label: 'Copy' },
        { id: 'cut', label: 'Cut' },
        { id: 'paste', label: 'Paste', disabled: !this.clipboardClip },
        { id: 'duplicate', label: 'Duplicate' },
        { id: 'delete', label: 'Delete' },
        { id: 'move-to-track', label: 'Move To Track', disabled: (this.document.tracks || []).length <= 1 },
        { id: 'new-track', label: 'New Track' }
      ];
    }
    if (tab === 'keys') {
      const selectedKey = this.getSelectedKeyframe(clip);
      return isKeyframeClip(clip) ? [
        { id: 'set-key', label: 'Set Key Frame' },
        { id: 'delete-key', label: 'Remove Key Frame', disabled: !selectedKey || this.isProtectedKeyframe(clip, selectedKey) },
        { id: 'prev-key', label: 'Previous Key Frame', disabled: !(clip.keyframes || []).some((entry) => entry?.manual === true) },
        { id: 'next-key', label: 'Next Key Frame', disabled: !(clip.keyframes || []).some((entry) => entry?.manual === true) },
        { id: 'key-mode', label: this.getSelectedKeyframeLabel(clip) },
        { id: 'ease', label: this.getEasingLabel(clip.easing) }
      ] : [
        { id: 'delete', label: 'Delete' }
      ];
    }
    if (isAudioClip(clip)) {
      const editable = this.getSelectedKeyframe(clip) || clip;
      return [
        { id: 'loop', label: clip.loop ? 'Loop On' : 'Loop Off' },
        { id: 'volume', label: `Volume ${Math.round(safeNumber(editable.volume, clip.volume ?? 1) * 100)}` },
        { id: 'fade', label: `Fade ${clip.fadeMs ?? 250}` },
        { id: 'delete', label: 'Delete' }
      ];
    }
    if (isEffectClip(clip)) {
      const editable = this.getEditableEffectState(clip) || clip;
      return [
        { id: 'effect-type', label: clip.effectType || 'Effect Type' },
        { id: 'effect-intensity', label: `Power ${safeNumber(editable.intensity, clip.intensity ?? 1)}` },
        { id: 'opacity', label: `Opacity ${Math.round(safeNumber(editable.opacity, 1) * 100)}%` },
        { id: 'effect-wind', label: `Wind ${safeNumber(editable.wind, clip.wind ?? 0)}` },
        { id: 'delete', label: 'Delete' }
      ];
    }
    if (clip.type === 'text') {
      return [
        { id: 'edit-text', label: 'Edit Text' },
        { id: 'text-color', label: 'Text Color' },
        { id: 'text-border', label: clip.textBorderEnabled === false ? 'Border Off' : 'Border On' },
        { id: 'font-size', label: `Font Size ${clip.fontSize}` },
        { id: 'font-family', label: 'Font' },
        { id: 'text-align', label: `Justify ${clip.textAlign}` },
        { id: 'reveal-speed', label: `Reveal ${clip.revealSpeed}` },
        { id: 'opacity', label: `Opacity ${Math.round(safeNumber((this.getEditableTransform(clip) || clip).opacity, 1) * 100)}%` },
        { id: 'fade-in', label: `Fade In ${clip.fadeInMs || 0}` },
        { id: 'fade-out', label: `Fade Out ${clip.fadeOutMs || 0}` }
      ];
    }
    if (clip.type === 'actor') {
      return [
        { id: 'actor-state', label: 'Actor State' },
        { id: 'add-state', label: 'Add State Key' },
        { id: 'next-state', label: 'Next State' },
        { id: 'play-animation', label: clip.playAnimation ? 'Anim On' : 'Anim Off' },
        { id: 'anim-speed', label: `Anim Speed ${clip.animationSpeed || 1}` },
        { id: 'anim-loop', label: clip.loopAnimation ? 'Loop Anim' : 'Once Anim' },
        { id: 'scale', label: 'Scale' },
        { id: 'rotate', label: 'Rotate' },
        { id: 'opacity', label: `Opacity ${Math.round(safeNumber((this.getEditableTransform(clip) || clip).opacity, 1) * 100)}%` }
      ];
    }
    return [
      ...(clip.type === 'color-board' ? [{ id: 'board-color', label: 'Board Color' }] : []),
      { id: 'scale', label: 'Scale' },
      { id: 'scale-x', label: `Scale X ${Math.round(getScaleX(this.getEditableTransform(clip) || clip) * 100)}%` },
      { id: 'scale-y', label: `Scale Y ${Math.round(getScaleY(this.getEditableTransform(clip) || clip) * 100)}%` },
      { id: 'aspect-lock', label: clip.aspectLocked === false ? 'Ratio Free' : 'Ratio Lock' },
      { id: 'rotate', label: 'Rotate' },
      { id: 'opacity', label: `Opacity ${Math.round(safeNumber((this.getEditableTransform(clip) || clip).opacity, 1) * 100)}%` },
      { id: 'fx', label: 'FX' },
      { id: 'fade-in', label: `Fade In ${clip.fadeInMs || 0}` },
      { id: 'fade-out', label: `Fade Out ${clip.fadeOutMs || 0}` },
      { id: 'delete', label: 'Delete' }
    ];
  }

  drawClipOptionsPanel(ctx, bounds, isPortrait) {
    const clip = this.getSelectedClip();
    const track = this.getSelectedTrack();
    if ((!clip && !track) || !bounds) return;
    const panel = isPortrait
      ? bounds
      : { x: bounds.x, y: Math.max(10, bounds.y), w: Math.min(420, bounds.w), h: Math.min(bounds.h, 320) };
    this.bounds.clipOptionsPanel = panel;
    if (isPortrait) drawSharedPortraitSheet(ctx, panel);
    else drawSharedPanel(ctx, panel, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const pad = 10;
    const gap = 8;
    const tabs = track && !clip ? [] : ['keys', 'settings', 'edit'];
    const tabH = tabs.length ? 40 : 0;
    if (tabs.length && !tabs.includes(this.clipOptionsTab)) this.clipOptionsTab = 'settings';
    if (tabs.length) {
      const tabW = Math.floor((panel.w - pad * 2 - gap * (tabs.length - 1)) / tabs.length);
      tabs.forEach((tab, index) => {
        const button = { x: panel.x + pad + index * (tabW + gap), y: panel.y + pad, w: tabW, h: tabH, id: `clip-options-tab:${tab}` };
        const label = tab === 'keys' ? 'Keys' : tab === 'settings' ? 'Settings' : 'Edit';
        const color = drawSharedMenuButtonChrome(ctx, button, { active: this.clipOptionsTab === tab });
        drawSharedMenuButtonLabel(ctx, button, label, { color, fontSize: 13, maxWidth: button.w - 8 });
        this.bounds.clipOptionButtons.push(button);
      });
    } else {
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `13px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.fillText(track?.name || 'Track', panel.x + pad, panel.y + pad + 18, panel.w - pad * 2);
    }
    const items = this.getClipOptionItems(clip, this.clipOptionsTab);
    const contentTop = panel.y + pad + (tabs.length ? tabH + gap : 30);
    const content = { x: panel.x + pad, y: contentTop, w: panel.w - pad * 2, h: panel.y + panel.h - pad - contentTop };
    const cols = isPortrait ? 2 : 1;
    const rowH = 42;
    const itemGap = 8;
    const buttonW = Math.floor((content.w - itemGap * (cols - 1)) / cols);
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const y = content.y + row * (rowH + itemGap);
      if (y + rowH > content.y + content.h) return;
      const button = { x: content.x + col * (buttonW + itemGap), y, w: buttonW, h: rowH, id: item.id };
      const color = drawSharedMenuButtonChrome(ctx, button, { subtle: Boolean(item.disabled) });
      drawSharedMenuButtonLabel(ctx, button, item.label, { color, fontSize: 12, maxWidth: button.w - 10 });
      if (!item.disabled) this.bounds.clipOptionButtons.push(button);
    });
  }

  drawMenu(ctx, bounds, isPortrait) {
    if (!bounds) return;
    if (!CUTSCENE_MENU_TABS.some((tab) => tab.id === this.activeMenuTab)) {
      this.activeMenuTab = 'add';
      this.menuScroll = 0;
    }
    this.bounds.menuPanel = bounds;
    if (isPortrait) drawSharedPortraitSheet(ctx, bounds);
    else drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const tabH = isPortrait ? 42 : 40;
    const pad = 10;
    const gap = 7;
    const tabRows = isPortrait ? 0 : 1;
    const tabCols = isPortrait ? 0 : Math.ceil(CUTSCENE_MENU_TABS.length / tabRows);
    const tabStripH = isPortrait ? 0 : tabRows * tabH + gap * (tabRows - 1);
    const rootRail = isPortrait ? (bounds.rootTabs || bounds.rootRail || bounds) : bounds;
    const sheetContent = isPortrait ? (bounds.subRail || bounds.sheetContent || bounds) : bounds;
    if (isPortrait) {
      drawSharedPortraitMultiRowTabStrip(ctx, rootRail, CUTSCENE_MENU_TABS, {
        activeId: this.activeMenuTab,
        minButtonWidth: 64,
        maxButtonWidth: 112,
        maxRows: 2,
        balanceLastRow: true,
        verticalAlign: 'bottom',
        padding: 8,
        gap,
        rowHeight: tabH,
        drawButton: (buttonBounds, tab, state) => {
          const button = { ...buttonBounds, id: `tab:${tab.id}` };
          const color = drawSharedMenuButtonChrome(ctx, button, { active: state.active, focused: state.focused });
          drawSharedMenuButtonLabel(ctx, button, tab.label, { color, fontSize: 11, maxWidth: button.w - 6 });
          this.bounds.menuButtons.push(button);
        }
      });
    } else {
      const tabW = Math.max(52, Math.floor((rootRail.w - pad * 2 - gap * (tabCols - 1)) / tabCols));
      const tabY = bounds.y + pad;
      CUTSCENE_MENU_TABS.forEach((tab, index) => {
        const col = index % tabCols;
        const row = Math.floor(index / tabCols);
        const button = {
          x: rootRail.x + pad + col * (tabW + gap),
          y: tabY + row * (tabH + gap),
          w: tabW,
          h: tabH,
          id: `tab:${tab.id}`
        };
        const color = drawSharedMenuButtonChrome(ctx, button, { active: this.activeMenuTab === tab.id });
        drawSharedMenuButtonLabel(ctx, button, tab.label, { color, fontSize: 11, maxWidth: button.w - 6 });
        this.bounds.menuButtons.push(button);
      });
    }
    const items = this.getMenuItems().filter((item) => !item.divider && !item.separator);
    const content = isPortrait
      ? { x: sheetContent.x + pad, y: sheetContent.y + pad, w: sheetContent.w - pad * 2, h: Math.max(1, sheetContent.h - pad * 2) }
      : { x: bounds.x + pad, y: bounds.y + pad + tabStripH + gap, w: bounds.w - pad * 2, h: bounds.h - pad * 2 - tabStripH - gap };
    this.bounds.menuContent = content;
    const rowH = 42;
    const cols = isPortrait ? 2 : 1;
    const itemGap = 8;
    const buttonW = Math.floor((content.w - itemGap * (cols - 1)) / cols);
    const visibleRows = Math.max(1, Math.floor((content.h + itemGap) / (rowH + itemGap)));
    const maxScroll = Math.max(0, Math.ceil(items.length / cols) - visibleRows);
    this.bounds.menuScrollMax = maxScroll;
    this.bounds.menuScrollCols = cols;
    this.menuScroll = clamp(Math.round(this.menuScroll || 0), 0, maxScroll);
    items.slice(this.menuScroll * cols, (this.menuScroll + visibleRows) * cols).forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const button = {
        x: content.x + col * (buttonW + itemGap),
        y: content.y + row * (rowH + itemGap),
        w: buttonW,
        h: rowH,
        id: item.id
      };
      const color = drawSharedMenuButtonChrome(ctx, button, { active: Boolean(item.active), subtle: Boolean(item.disabled) });
      drawSharedMenuButtonLabel(ctx, button, item.label, { color, fontSize: 12, maxWidth: button.w - 10 });
      if (!item.disabled) this.bounds.menuButtons.push(button);
    });
    drawSharedPortraitScrollHints(ctx, content, { scroll: this.menuScroll, scrollMax: maxScroll });
  }

  drawLandscapeRootRail(ctx, bounds) {
    if (!bounds) return;
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const pad = 8;
    const gap = 7;
    const rowH = 40;
    const actions = buildCompactLandscapeCommandRailActions({
      menu: {
        id: 'landscape-menu',
        label: 'Menu',
        active: this.landscapeRootDrawerOpen,
        onClick: () => {
          this.landscapeRootDrawerOpen = !this.landscapeRootDrawerOpen;
          this.menuOpen = false;
          this.clipOptionsOpen = false;
        }
      },
      undo: { id: 'undo', label: 'Undo', onClick: () => this.undo() },
      redo: { id: 'redo', label: 'Redo', onClick: () => this.redo() },
      quick: { id: 'play', label: this.isPlaying ? 'Pause' : 'Play', active: this.isPlaying, onClick: () => this.togglePlayback() }
    });
    buildCompactLandscapeCommandRailButtonLayout({
      bounds,
      actions,
      buttonHeight: rowH,
      buttonGap: gap,
      paddingX: pad,
      paddingY: pad
    }).forEach(({ action, bounds: buttonBounds }) => {
      const button = {
        ...buttonBounds,
        id: action.id,
        onClick: action.onClick
      };
      const color = drawSharedMenuButtonChrome(ctx, button, { active: Boolean(action.active) });
      drawSharedMenuButtonLabel(ctx, button, action.displayLabel ?? action.label, { color, fontSize: 11, maxWidth: button.w - 8 });
      this.bounds.buttons.push(button);
    });
  }

  drawLandscapeRootDrawer(ctx, bounds) {
    if (!bounds) return;
    this.bounds.landscapeRootPanel = bounds;
    this.bounds.landscapeRootButtons = [];
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const pad = 10;
    const rowH = bounds.w >= 340 ? 40 : 38;
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Menu', bounds.x + pad, bounds.y + 20, bounds.w - pad * 2);
    ctx.restore();
    const grid = buildLandscapeRootDrawerGridLayout({
      bounds,
      itemCount: CUTSCENE_CONTROLLER_ROOT_ENTRIES.length,
      padding: pad,
      gap: 8,
      rowHeight: rowH,
      minRowHeight: rowH,
      maxRowHeight: rowH,
      headerHeight: 28
    });
    this.bounds.landscapeRootScrollMax = 0;
    this.bounds.landscapeRootContent = grid.listBounds;
    this.landscapeRootScroll = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(grid.listBounds.x, grid.listBounds.y, grid.listBounds.w, grid.listBounds.h);
    ctx.clip();
    grid.items.forEach(({ index, bounds }) => {
      const entry = CUTSCENE_CONTROLLER_ROOT_ENTRIES[index];
      if (!entry) return;
      const id = entry.id;
      const button = {
        ...bounds,
        id: `landscape-tab:${id}`
      };
      const color = drawSharedMenuButtonChrome(ctx, button, { active: this.activeMenuTab === id });
      drawSharedMenuButtonLabel(ctx, button, entry.label || getCutsceneMenuLabel(id, id), { color, fontSize: 11, maxWidth: button.w - 8 });
      this.bounds.landscapeRootButtons.push(button);
    });
    ctx.restore();
  }

  drawLandscapeSubmenuPanel(ctx, bounds) {
    if (!bounds) return;
    this.bounds.menuPanel = bounds;
    this.bounds.menuButtons = [];
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const pad = 10;
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(getCutsceneMenuLabel(this.activeMenuTab, 'Menu'), bounds.x + pad, bounds.y + 20, bounds.w - pad * 2);
    ctx.restore();
    const items = this.getMenuItems(this.activeMenuTab).filter((item) => !item.divider && !item.separator);
    const content = { x: bounds.x + pad, y: bounds.y + 38, w: bounds.w - pad * 2, h: bounds.h - 48 };
    this.bounds.menuContent = content;
    const rowH = 42;
    const gap = 8;
    const visibleRows = Math.max(1, Math.floor((content.h + gap) / (rowH + gap)));
    const maxScroll = Math.max(0, items.length - visibleRows);
    this.bounds.menuScrollMax = maxScroll;
    this.bounds.menuScrollCols = 1;
    this.menuScroll = clamp(Math.round(this.menuScroll || 0), 0, maxScroll);
    items.slice(this.menuScroll, this.menuScroll + visibleRows).forEach((item, index) => {
      const button = {
        x: content.x,
        y: content.y + index * (rowH + gap),
        w: content.w,
        h: rowH,
        id: item.id
      };
      const color = drawSharedMenuButtonChrome(ctx, button, { active: Boolean(item.active), subtle: Boolean(item.disabled) });
      drawSharedMenuButtonLabel(ctx, button, item.label, { color, fontSize: 12, maxWidth: button.w - 10 });
      if (!item.disabled) this.bounds.menuButtons.push(button);
    });
    drawSharedPortraitScrollHints(ctx, content, { scroll: this.menuScroll, scrollMax: maxScroll });
  }

  drawGamepadSlideOutPanel(ctx, bounds) {
    if (!bounds) return;
    const menuId = this.getActiveGamepadMenuId();
    const plan = buildGamepadSlideOutMenuPlan('cutscene', {
      rootOpen: !menuId,
      activeRootId: menuId || this.activeMenuTab || 'add',
      focusedItemId: this.controllerMenu.getFocusedItem(menuId)?.id
    });
    const menu = this.controllerMenu.menus?.[menuId];
    const items = this.controllerMenu.getItems(menu);
    const plannedItems = menuId ? (plan.submenu?.items || []) : plan.rootEntries;
    const plannedFocusById = new Map(plannedItems.map((item) => [item.id, Boolean(item.focused)]));
    const focusedItemId = this.controllerMenu.getFocusedItem(menuId)?.id
      || plan.focus?.submenuItemId
      || plan.focus?.rootItemId
      || null;
    this.bounds.menuPanel = bounds;
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    drawSharedGamepadSlideOutHeader(ctx, bounds, menu?.title || plan.submenu?.title || 'Menu', { hint: plan.headerHint });
    ctx.save();
    const rowH = 40;
    const gap = 8;
    const list = {
      x: bounds.x + 10,
      y: bounds.y + 52,
      w: Math.max(1, bounds.w - 20),
      h: Math.max(1, bounds.h - 62)
    };
    const visibleRows = Math.max(1, Math.floor((list.h + gap) / (rowH + gap)));
    const maxScroll = Math.max(0, items.length - visibleRows);
    const scroll = this.controllerMenu.syncScrollToItem(
      menuId,
      focusedItemId,
      items,
      visibleRows,
      this.controllerMenu.scroll?.[menuId] || 0
    );
    this.bounds.gamepadMenuPanel = bounds;
    this.bounds.gamepadMenuContent = list;
    this.bounds.gamepadMenuId = menuId;
    this.bounds.gamepadMenuScrollMax = maxScroll;
    items.slice(scroll, scroll + visibleRows).forEach((item, index) => {
      if (item.divider || item.separator) return;
      const button = {
        x: list.x,
        y: list.y + index * (rowH + gap),
        w: list.w,
        h: rowH,
        id: item.id
      };
      const color = drawSharedMenuButtonChrome(ctx, button, {
        active: this.isControllerMenuItemActive(menuId, item.id),
        focused: this.controllerMenu.isFocusedItem(menuId, item.id, index) || Boolean(plannedFocusById.get(item.id)),
        subtle: Boolean(item.disabled)
      });
      drawSharedMenuButtonLabel(ctx, button, item.label, { color, fontSize: 12, maxWidth: button.w - 10 });
      if (!item.disabled) this.bounds.menuButtons.push(button);
    });
    drawSharedPortraitScrollHints(ctx, list, { scroll, scrollMax: maxScroll });
    ctx.restore();
  }

  isControllerMenuItemActive(menuId, itemId) {
    if (menuId === this.activeMenuTab) return this.getMenuItems(menuId).some((item) => item.id === itemId && item.active);
    return false;
  }

  handleDesktopContextPointer(x, y) {
    const keyMarker = this.bounds.keyframes?.find((entry) => this.pointIn(entry, x, y))
      || this.bounds.stageKeyframes?.find((entry) => this.pointIn(entry, x, y));
    if (keyMarker) {
      const clip = (this.document.clips || []).find((entry) => entry.id === keyMarker.id);
      if (!clip) return true;
      this.selectedClipId = clip.id;
      this.selectedTrackId = null;
      this.selectKeyframe(clip, keyMarker.timeMs);
      this.playheadMs = clamp(clip.startMs + safeNumber(keyMarker.timeMs), 0, this.document.durationMs);
      this.clipOptionsOpen = true;
      this.statusText = this.getSelectedKeyframeLabel(clip);
      return true;
    }
    const clipHit = this.bounds.clips?.find((entry) => this.pointIn(entry, x, y))
      || this.bounds.clipHandles?.find((entry) => this.pointIn(entry, x, y))
      || this.bounds.visualClips?.find((entry) => this.pointIn(entry, x, y))
      || this.bounds.stageSelection?.find((entry) => this.pointIn(entry, x, y));
    if (clipHit?.id) {
      if (this.selectedClipId !== clipHit.id) this.selectedKeyframe = null;
      this.selectedClipId = clipHit.id;
      this.selectedTrackId = null;
      this.clipOptionsOpen = true;
      this.statusText = `Clip: ${this.getClipLabel(this.getSelectedClip())}`;
      return true;
    }
    const trackHit = this.bounds.trackLabels?.find((entry) => this.pointIn(entry, x, y))
      || this.bounds.trackLanes?.find((entry) => this.pointIn(entry, x, y));
    if (trackHit?.trackId) {
      this.selectedTrackId = trackHit.trackId;
      this.selectedClipId = null;
      this.selectedKeyframe = null;
      this.clipOptionsOpen = true;
      const track = this.getSelectedTrack();
      this.statusText = `Track: ${track?.name || track?.id || trackHit.trackId}`;
      return true;
    }
    if ((this.bounds.stage && this.pointIn(this.bounds.stage, x, y))
      || (this.bounds.timeline && this.pointIn(this.bounds.timeline, x, y))) {
      this.clipOptionsOpen = false;
      this.statusText = 'No context item';
      return true;
    }
    return false;
  }

  handlePointerDown(payload) {
    if (!payload) return;
    const x = safeNumber(payload.x);
    const y = safeNumber(payload.y);
    this.pendingDesktopDropdownHit = null;
    const isDesktopMode = this.activeViewportMode === 'desktop';
    if (isDesktopMode && shouldCloseDesktopDropdownOnPointerDown({
      dropdown: this.desktopDropdown,
      point: { x, y },
      rootButtons: this.bounds.buttons,
      interactiveRegions: this.menuScrollRegions,
      idPrefix: 'desktop-root:'
    })) {
      const nextDropdown = resolveClosedDesktopDropdownState({
        dropdown: this.desktopDropdown,
        openRootId: this.openDesktopDropdownRootId,
        fallbackRootId: this.activeMenuTab || 'add'
      });
      this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
      this.openDesktopDropdownRootId = nextDropdown.openRootId;
      this.desktopDropdown = nextDropdown.dropdown;
      return;
    }
    if (this.transportPopover) {
      const hit = this.bounds.transportPopoverButtons?.find((entry) => this.pointIn(entry, x, y));
      if (hit) {
        hit.action?.();
        this.closeTransportPopover();
        return;
      }
      this.closeTransportPopover();
      return;
    }
    const desktopDropdownHit = isDesktopMode
      ? this.bounds.desktopDropdownItems?.find((entry) => this.pointIn(entry, x, y))
      : null;
    if (desktopDropdownHit) {
      this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, { x, y });
      return;
    }
    const desktopDropdownRegion = isDesktopMode
      ? this.menuScrollRegions?.find((region) => region?.bounds && this.pointIn(region.bounds, x, y))
      : null;
    if (desktopDropdownRegion) {
      return;
    }
    if (isDesktopMode && this.bounds.desktopMenuPanel && this.pointIn(this.bounds.desktopMenuPanel, x, y)) {
      return;
    }
    if (this.bounds.landscapeRootPanel && this.pointIn(this.bounds.landscapeRootPanel, x, y)) {
      const rootButton = this.bounds.landscapeRootButtons?.find((entry) => this.pointIn(entry, x, y));
      const content = this.bounds.landscapeRootContent || this.bounds.landscapeRootPanel;
      const visibleRows = Math.max(1, Math.floor((content.h + 7) / (40 + 7)));
      this.menuScrollDrag = buildMenuScrollDragState({
        regions: [{
          menuId: 'landscape-root',
          bounds: this.bounds.landscapeRootPanel,
          maxScroll: this.bounds.landscapeRootScrollMax || 0,
          lineHeight: Math.max(1, content.h / visibleRows)
        }],
        point: { x, y },
        scrollState: { 'landscape-root': this.landscapeRootScroll || 0 },
        pendingHit: rootButton ? { id: rootButton.id } : null,
        thresholdPx: 6
      }) || { menuId: 'landscape-root', startY: y, thresholdPx: 6, maxScroll: 0, moved: false, pendingHit: rootButton ? { id: rootButton.id } : null };
      return;
    }
    if (this.bounds.gamepadMenuPanel && this.pointIn(this.bounds.gamepadMenuPanel, x, y)) {
      const menuId = this.bounds.gamepadMenuId || this.getActiveGamepadMenuId();
      const menuButton = this.bounds.menuButtons?.find((entry) => this.pointIn(entry, x, y));
      const content = this.bounds.gamepadMenuContent || this.bounds.gamepadMenuPanel;
      const visibleRows = Math.max(1, Math.floor((content.h + 8) / (40 + 8)));
      this.menuScrollDrag = buildMenuScrollDragState({
        regions: [{
          menuId: 'gamepad-submenu',
          bounds: content,
          maxScroll: this.bounds.gamepadMenuScrollMax || 0,
          lineHeight: Math.max(1, content.h / visibleRows)
        }],
        point: { x, y },
        scrollState: { 'gamepad-submenu': this.controllerMenu.scroll?.[menuId] || 0 },
        pendingHit: menuButton ? { id: menuButton.id } : null,
        thresholdPx: 6
      }) || { menuId: 'gamepad-submenu', startY: y, thresholdPx: 6, maxScroll: 0, moved: false, pendingHit: menuButton ? { id: menuButton.id } : null };
      this.menuScrollDrag.controllerMenuId = menuId;
      return;
    }
    if (this.menuOpen && this.bounds.menuPanel && this.pointIn(this.bounds.menuPanel, x, y)) {
      const menuButton = this.bounds.menuButtons?.find((entry) => this.pointIn(entry, x, y));
      const content = this.bounds.menuContent || this.bounds.menuPanel;
      const visibleRows = Math.max(1, Math.floor((content.h + 8) / (42 + 8)));
      this.menuScrollDrag = buildMenuScrollDragState({
        regions: [{
          menuId: 'submenu',
          bounds: this.bounds.menuPanel,
          maxScroll: this.bounds.menuScrollMax || 0,
          lineHeight: Math.max(1, content.h / visibleRows)
        }],
        point: { x, y },
        scrollState: { submenu: this.menuScroll || 0 },
        pendingHit: menuButton ? { id: menuButton.id } : null,
        thresholdPx: 6
      }) || { menuId: 'submenu', startY: y, thresholdPx: 6, maxScroll: 0, moved: false, pendingHit: menuButton ? { id: menuButton.id } : null };
      return;
    }
    if (this.menuOpen) {
      this.menuOpen = false;
      this.menuScroll = 0;
      this.menuScrollDrag = null;
      return;
    }
    if (this.landscapeRootDrawerOpen) {
      this.landscapeRootDrawerOpen = false;
      this.menuScrollDrag = null;
      return;
    }
    if (this.clipOptionsOpen && this.bounds.clipOptionsPanel && this.pointIn(this.bounds.clipOptionsPanel, x, y)) {
      const optionButton = this.bounds.clipOptionButtons?.find((entry) => this.pointIn(entry, x, y));
      if (optionButton) this.handleButton(optionButton.id);
      return;
    }
    if (this.clipOptionsOpen) {
      this.clipOptionsOpen = false;
      return;
    }
    if (this.timelineZoomSlider.bounds && this.pointIn(this.timelineZoomSlider.bounds, x, y)) {
      this.timelineZoomSlider.active = true;
      this.timelineZoomSlider.id = payload.id ?? 'pointer';
      this.setTimelineZoomFromScreen(x);
      return;
    }
    const contextButton = this.bounds.contextButtons?.find((entry) => this.pointIn(entry, x, y));
    if (contextButton) {
      this.handleButton(contextButton.id);
      return;
    }
    const button = this.bounds.buttons?.find((entry) => this.pointIn(entry, x, y));
    if (button) {
      if (button.onHold) {
        this.startTransportHold(button, x, y);
        return;
      }
      this.handleButton(button.id);
      return;
    }
    const pointerMode = this.activeViewportMode || this.resolveCutsceneViewportMode().mode;
    const pointerPolicy = getEditorPointerInteractionPolicy('cutscene', {
      mode: pointerMode,
      pointerType: pointerMode === 'desktop' ? 'mouse' : 'touch',
      gamepadConnected: Boolean(this.game?.input?.isGamepadConnected?.())
    });
    if ((payload.button ?? 0) === 2 && pointerPolicy.rightClick.opensContextMenu) {
      if (this.handleDesktopContextPointer(x, y)) return;
    }
    if (pointerPolicy.thumbstick.allowed && this.panJoystick?.radius > 0 && this.pointInThumbstick(x, y)) {
      this.panJoystick.active = true;
      this.panJoystick.id = payload.id ?? 'pointer';
      this.updateThumbstickFromPoint(x, y);
      return;
    }
    const handle = this.bounds.clipHandles?.find((entry) => this.pointIn(entry, x, y));
    if (handle) {
      const clip = (this.document.clips || []).find((entry) => entry.id === handle.id);
      if (!clip) return;
      this.selectedClipId = clip.id;
      this.selectedTrackId = null;
      this.drag = {
        type: 'clip-duration',
        id: clip.id,
        startX: x,
        originalDuration: Math.max(1, safeNumber(clip.durationMs, 1)),
        historyCaptured: false,
        moved: false
      };
      return;
    }
    const keyMarker = this.bounds.keyframes?.find((entry) => this.pointIn(entry, x, y));
    if (keyMarker) {
      const clip = (this.document.clips || []).find((entry) => entry.id === keyMarker.id);
      if (!clip) return;
      this.selectedClipId = clip.id;
      this.selectedTrackId = null;
      this.selectKeyframe(clip, keyMarker.timeMs);
      this.playheadMs = clamp(clip.startMs + safeNumber(keyMarker.timeMs), 0, this.document.durationMs);
      this.statusText = this.getSelectedKeyframeLabel(clip);
      return;
    }
    const trackLabel = this.bounds.trackLabels?.find((entry) => this.pointIn(entry, x, y));
    if (trackLabel?.trackId) {
      this.selectedTrackId = trackLabel.trackId;
      this.selectedClipId = null;
      this.selectedKeyframe = null;
      this.drag = {
        type: 'track-reorder',
        trackId: trackLabel.trackId,
        startX: x,
        startY: y,
        originalIndex: this.getTrackIndexById(trackLabel.trackId),
        currentIndex: this.getTrackIndexById(trackLabel.trackId),
        historyCaptured: false,
        moved: false
      };
      return;
    }
    const clip = this.bounds.clips?.find((entry) => this.pointIn(entry, x, y));
    if (clip) {
      if (this.selectedClipId !== clip.id) this.selectedKeyframe = null;
      this.selectedClipId = clip.id;
      this.selectedTrackId = null;
      this.drag = {
        type: 'clip-timeline',
        id: clip.id,
        startX: x,
        startY: y,
        originalStart: this.getSelectedClip()?.startMs || 0,
        originalIndex: this.getSelectedClipTrackIndex(),
        currentIndex: this.getSelectedClipTrackIndex(),
        historyCaptured: false,
        moved: false
      };
      return;
    }
    if (this.bounds.stage && this.pointIn(this.bounds.stage, x, y)) {
      const selectionHit = this.bounds.stageSelection?.find((entry) => this.pointIn(entry, x, y));
      if (selectionHit?.id) {
        this.startStageMoveDrag(selectionHit.id, x, y, true);
        return;
      }
      const visualHit = this.bounds.visualClips?.find((entry) => this.pointIn(entry, x, y));
      if (visualHit) {
        this.selectedTrackId = null;
        this.startStageMoveDrag(visualHit.id, x, y, this.selectedClipId === visualHit.id);
        return;
      }
      const stageKey = this.bounds.stageKeyframes?.find((entry) => this.pointIn(entry, x, y));
      if (stageKey) {
        const clip = (this.document.clips || []).find((entry) => entry.id === stageKey.id);
        if (!clip) return;
        this.selectedClipId = clip.id;
        this.selectedTrackId = null;
        this.selectKeyframe(clip, stageKey.timeMs);
        this.playheadMs = clamp(clip.startMs + safeNumber(stageKey.timeMs), 0, this.document.durationMs);
        this.statusText = this.getSelectedKeyframeLabel(clip);
        return;
      }
      if (this.selectedClipId || this.selectedKeyframe || this.selectedTrackId) {
        this.selectedClipId = null;
        this.selectedTrackId = null;
        this.selectedKeyframe = null;
        this.clipOptionsOpen = false;
        this.statusText = 'Deselected';
      }
      return;
    }
    const trackLane = this.bounds.trackLanes?.find((entry) => this.pointIn(entry, x, y));
    if (trackLane?.trackId) {
      this.selectedTrackId = trackLane.trackId;
      this.selectedClipId = null;
      this.selectedKeyframe = null;
      this.drag = {
        type: 'track-reorder',
        trackId: trackLane.trackId,
        startX: x,
        startY: y,
        originalIndex: this.getTrackIndexById(trackLane.trackId),
        currentIndex: this.getTrackIndexById(trackLane.trackId),
        historyCaptured: false,
        moved: false
      };
      return;
    }
    if (this.bounds.timeline && this.pointIn(this.bounds.timeline, x, y)) {
      const timelineLayout = this.getTimelineLayout(this.bounds.timeline);
      this.bounds.timelineTrack = timelineLayout.track;
      this.playheadMs = timelineXToMs(x, timelineLayout);
      this.drag = {
        type: 'timeline-pan',
        startX: x,
        startY: y,
        startScrollMs: this.timelineScrollMs,
        startScrollTrack: this.timelineScrollTrack,
        moved: false
      };
    }
  }

  startStageMoveDrag(clipId, x, y, wasAlreadySelected = false) {
    if (!clipId || !this.bounds.stage) return;
    if (this.selectedClipId !== clipId) this.selectedKeyframe = null;
    this.selectedClipId = clipId;
    this.selectedTrackId = null;
    const selected = this.getSelectedClip();
    const transformTarget = this.getSelectedKeyframe(selected) || selected;
    if (!selected || !transformTarget) return;
    const projection = getCutsceneStageProjection(this.document, this.bounds.stage);
    const point = screenToCutscenePoint(x, y, projection);
    this.drag = {
      type: 'stage-move',
      id: selected.id,
      startX: x,
      startY: y,
      moved: false,
      wasAlreadySelected,
      historyCaptured: false,
      anchorX: transformTarget.x - point.x,
      anchorY: transformTarget.y - point.y
    };
  }

  handlePointerMove(payload) {
    if (!payload) return;
    const x = safeNumber(payload.x);
    const y = safeNumber(payload.y);
    if (this.pendingDesktopDropdownHit) {
      this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, { x, y });
    }
    if (this.transportHold && Math.hypot(x - this.transportHold.x, y - this.transportHold.y) > 12) {
      this.cancelTransportHold();
    }
    if (this.activeViewportMode === 'desktop' && !payload.touchCount && !this.drag && !this.menuScrollDrag) {
      const rootButton = resolveDesktopDropdownHoverSwitch({
        buttons: this.bounds.buttons,
        point: { x, y },
        openRootId: this.openDesktopDropdownRootId,
        idPrefix: 'desktop-root:'
      });
      if (rootButton) {
        const rootId = rootButton.rootId;
        const nextTab = CUTSCENE_DESKTOP_MENU_LABELS[rootId] ? rootId : 'add';
        const nextDropdown = resolveOpenDesktopDropdownState({
          rootId: nextTab,
          currentOpenRootId: this.openDesktopDropdownRootId,
          closedRootId: this.closedDesktopDropdownRootId,
          dropdown: this.desktopDropdown
        });
        if (!nextDropdown) return;
        this.openDesktopDropdownRootId = nextDropdown.openRootId;
        this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
        this.desktopDropdown = nextDropdown.dropdown;
        this.menuOpen = false;
        this.clipOptionsOpen = false;
        this.menuScroll = 0;
        return;
      }
    }
    if (this.menuScrollDrag) {
      const drag = resolveMenuScrollDrag(this.menuScrollDrag, { x, y });
      this.menuScrollDrag = drag;
      if (drag?.moved && drag.menuId === 'landscape-root' && this.bounds.landscapeRootScrollMax > 0) {
        this.landscapeRootScroll = drag.nextScroll;
      } else if (drag?.moved && drag.menuId === 'gamepad-submenu' && this.bounds.gamepadMenuScrollMax > 0) {
        const menuId = drag.controllerMenuId || this.bounds.gamepadMenuId || this.getActiveGamepadMenuId();
        if (menuId) {
          this.controllerMenu.scroll = this.controllerMenu.scroll || {};
          this.controllerMenu.scroll[menuId] = drag.nextScroll;
        }
      } else if (drag?.moved && drag.menuId === 'submenu' && this.bounds.menuScrollMax > 0) {
        this.menuScroll = drag.nextScroll;
      }
      return;
    }
    if (this.timelineZoomSlider.active) {
      this.setTimelineZoomFromScreen(x);
      return;
    }
    if (this.panJoystick?.active) {
      this.updateThumbstickFromPoint(x, y);
      return;
    }
    if (!this.drag) return;
    if (!this.drag.moved && Math.hypot(x - safeNumber(this.drag.startX), y - safeNumber(this.drag.startY)) >= 7) {
      this.drag.moved = true;
      if (this.drag.type === 'stage-move' && !this.drag.historyCaptured) {
        this.captureHistory('Move clip');
        this.drag.historyCaptured = true;
      } else if (this.drag.type === 'clip-timeline' && !this.drag.historyCaptured) {
        this.captureHistory('Move clip time');
        this.drag.historyCaptured = true;
      } else if (this.drag.type === 'clip-duration' && !this.drag.historyCaptured) {
        this.captureHistory('Resize clip');
        this.drag.historyCaptured = true;
      }
    }
    if (this.drag.type === 'stage-move') {
      if (this.drag.moved) this.moveSelectedClipToStagePoint(x, y, this.drag);
    } else if (this.drag.type === 'clip-timeline') {
      const clip = this.getSelectedClip();
      if (!clip || !this.bounds.timeline) return;
      const verticalIntent = Math.abs(y - safeNumber(this.drag.startY)) > Math.abs(x - safeNumber(this.drag.startX)) + 4;
      if (verticalIntent) {
        this.timelineSnapGuideMs = null;
        const nextIndex = this.getTimelineTrackIndexAtY(y);
        if (nextIndex >= 0 && nextIndex !== this.drag.currentIndex) {
          this.assignSelectedClipToTrackIndex(nextIndex, { capture: false });
          this.drag.currentIndex = this.getSelectedClipTrackIndex();
        }
        return;
      }
      const timelineLayout = this.getTimelineLayout(this.bounds.timeline);
      const deltaMs = timelineXToMs(x, timelineLayout) - timelineXToMs(this.drag.startX, timelineLayout);
      const snap = this.snapMovedTimelineClipToPlayhead(this.drag.originalStart + deltaMs, clip, timelineLayout);
      clip.startMs = snap.startMs;
      this.timelineSnapGuideMs = snap.snapped ? this.playheadMs : null;
      if (snap.snapped) this.statusText = 'Snapped to playhead';
    } else if (this.drag.type === 'track-reorder') {
      const nextIndex = this.getTimelineTrackIndexAtY(y);
      if (nextIndex >= 0 && nextIndex !== this.drag.currentIndex) {
        if (!this.drag.historyCaptured) {
          this.captureHistory('Move track');
          this.drag.historyCaptured = true;
        }
        this.moveTrackToIndex(this.drag.trackId, nextIndex, { capture: false });
        this.drag.currentIndex = this.getTrackIndexById(this.drag.trackId);
      }
    } else if (this.drag.type === 'clip-duration') {
      const clip = this.getSelectedClip();
      if (!clip || !this.bounds.timeline) return;
      const timelineLayout = this.getTimelineLayout(this.bounds.timeline);
      const deltaMs = timelineXToMs(x, timelineLayout) - timelineXToMs(this.drag.startX, timelineLayout);
      const minDuration = getFrameStepMs(this.document);
      const maxDuration = Math.max(minDuration, this.document.durationMs - clip.startMs);
      const snap = this.snapResizedTimelineClipToPlayhead(this.drag.originalDuration + deltaMs, clip, minDuration, maxDuration, timelineLayout);
      clip.durationMs = snap.durationMs;
      this.timelineSnapGuideMs = snap.snapped ? this.playheadMs : null;
      if (snap.snapped) this.statusText = 'Snapped to playhead';
      this.normalizeClipKeyframes(clip);
    } else if (this.drag.type === 'timeline-pan') {
      if (!this.bounds.timeline || !this.drag.moved) return;
      const layout = this.getTimelineLayout(this.bounds.timeline);
      const msPerPx = layout.visibleDuration / Math.max(1, layout.track.w);
      this.timelineScrollMs = clamp(safeNumber(this.drag.startScrollMs, 0) - (x - safeNumber(this.drag.startX)) * msPerPx, 0, layout.maxScrollMs);
      const laneStep = Math.max(1, layout.laneH + layout.laneGap);
      this.timelineScrollTrack = clamp(safeNumber(this.drag.startScrollTrack, 0) - (y - safeNumber(this.drag.startY)) / laneStep, 0, layout.maxScrollTrack);
      this.clampTimelineViewport(this.bounds.timeline);
    }
  }

  handlePointerUp(payload = {}) {
    if (this.transportHold) {
      const hold = this.transportHold;
      this.cancelTransportHold();
      if (!hold.fired) this.handleButton(hold.button.id);
      return;
    }
    if (this.menuScrollDrag) {
      const drag = this.menuScrollDrag;
      this.menuScrollDrag = null;
      if (!drag.moved && drag.pendingHit?.id) this.handleButton(drag.pendingHit.id);
    }
    if (this.pendingDesktopDropdownHit) {
      const hit = this.pendingDesktopDropdownHit;
      this.pendingDesktopDropdownHit = null;
      const x = safeNumber(payload.x, NaN);
      const y = safeNumber(payload.y, NaN);
      const { shouldActivate } = resolvePendingDesktopDropdownHit(hit, { x, y });
      if (shouldActivate) {
        hit.action?.();
        const nextDropdown = resolveClosedDesktopDropdownState({
          dropdown: this.desktopDropdown,
          openRootId: this.openDesktopDropdownRootId,
          fallbackRootId: this.activeMenuTab
        });
        this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
        this.openDesktopDropdownRootId = nextDropdown.openRootId;
        this.desktopDropdown = nextDropdown.dropdown;
      }
      return;
    }
    if (this.timelineZoomSlider.active) {
      this.timelineZoomSlider.active = false;
      this.timelineZoomSlider.id = null;
    }
    if (this.panJoystick?.active) {
      this.panJoystick.active = false;
      this.panJoystick.id = null;
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
    }
    this.timelineSnapGuideMs = null;
    this.drag = null;
  }

  handleWheel(payload) {
    if (!payload) return;
    const x = safeNumber(payload.x, NaN);
    const y = safeNumber(payload.y, NaN);
    const desktopDropdownScroll = applyDesktopDropdownWheelScrollState({
      dropdown: this.desktopDropdown,
      payload,
      scrollState: this.desktopDropdownScroll
    });
    if (desktopDropdownScroll) {
      this.desktopDropdownScroll = desktopDropdownScroll.scrollState;
      return;
    }
    if (this.bounds.desktopMenuPanel && Number.isFinite(x) && Number.isFinite(y) && this.pointIn(this.bounds.desktopMenuPanel, x, y)) {
      this.menuScroll = clamp((this.menuScroll || 0) + (Number(payload.deltaY || 0) > 0 ? 1 : -1), 0, this.bounds.menuScrollMax || 0);
      return;
    }
    if (this.menuOpen) {
      this.menuScroll = Math.max(0, (this.menuScroll || 0) + (Number(payload.deltaY || 0) > 0 ? 1 : -1));
      return;
    }
    if (this.bounds.timeline && Number.isFinite(x) && Number.isFinite(y) && this.pointIn(this.bounds.timeline, x, y)) {
      const layout = this.getTimelineLayout(this.bounds.timeline);
      if (payload.ctrlKey || payload.metaKey || payload.shiftKey) {
        this.adjustTimelineZoom(Number(payload.deltaY || 0) > 0 ? 1 / 1.15 : 1.15, timelineXToMs(x, layout));
      } else {
        this.panTimeline(Number(payload.deltaX || 0), Number(payload.deltaY || 0), this.bounds.timeline);
      }
      return;
    }
    this.playheadMs = clamp(this.playheadMs + Number(payload.deltaY || 0) * 4, 0, this.document.durationMs);
  }

  pointIn(bounds, x, y) {
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  pointInThumbstick(x, y) {
    const center = this.panJoystick?.center;
    const radius = safeNumber(this.panJoystick?.radius, 0);
    if (!center || radius <= 0) return false;
    return Math.hypot(safeNumber(x) - safeNumber(center.x), safeNumber(y) - safeNumber(center.y)) <= radius + 12;
  }

  updateThumbstickFromPoint(x, y) {
    const center = this.panJoystick?.center;
    const radius = Math.max(1, safeNumber(this.panJoystick?.radius, 1));
    if (!center) return;
    const dx = safeNumber(x) - safeNumber(center.x);
    const dy = safeNumber(y) - safeNumber(center.y);
    const distance = Math.hypot(dx, dy);
    const scale = distance > radius ? radius / Math.max(1, distance) : 1;
    this.panJoystick.dx = clamp((dx * scale) / radius, -1, 1);
    this.panJoystick.dy = clamp((dy * scale) / radius, -1, 1);
  }

  getSelectedClip() {
    return (this.document.clips || []).find((clip) => clip.id === this.selectedClipId) || null;
  }

  getSelectedTrack() {
    const tracks = this.document.tracks || [];
    if (this.selectedTrackId) return tracks.find((track) => track.id === this.selectedTrackId) || null;
    return this.getSelectedClipTrack();
  }

  ensureTrackForClip(clip, preferredName = '') {
    if (!clip) return null;
    const tracks = this.document.tracks || (this.document.tracks = []);
    const existing = clip.trackId ? tracks.find((track) => track.id === clip.trackId) : null;
    if (existing) return existing;
    const track = {
      id: makeId('track'),
      name: preferredName || this.getClipLabel(clip) || `Track ${tracks.length + 1}`
    };
    tracks.push(track);
    clip.trackId = track.id;
    return track;
  }

  normalizeClipKeyframes(clip) {
    if (!isVisualClip(clip)) return;
    clip.keyframes = normalizeKeyframes(clip.keyframes, this.document, clip.type, clip.durationMs);
    if (this.selectedKeyframe?.clipId === clip.id && !this.getSelectedKeyframe(clip)) {
      this.selectedKeyframe = null;
    }
  }

  getSelectedLayerIndex() {
    const clip = this.getSelectedClip();
    if (!clip || !Array.isArray(this.document.layers)) return -1;
    return this.document.layers.findIndex((layer) => layer.id === clip.layerId);
  }

  assignSelectedClipToLayer(layerId) {
    const clip = this.getSelectedClip();
    const layer = (this.document.layers || []).find((entry) => entry.id === layerId);
    if (!clip || !layer || clip.layerId === layer.id || clip.type === 'pause') return;
    this.captureHistory('Change clip layer');
    clip.layerId = layer.id;
    this.statusText = `Clip layer: ${layer.name || layer.id}`;
  }

  moveSelectedClipLayer(delta) {
    const clip = this.getSelectedClip();
    if (!clip || clip.type === 'pause') return;
    const layers = this.document.layers || [];
    const index = this.getSelectedLayerIndex();
    const nextIndex = clamp(index + delta, 0, Math.max(0, layers.length - 1));
    if (index < 0 || nextIndex === index) return;
    this.captureHistory('Move clip layer');
    clip.layerId = layers[nextIndex].id;
    this.statusText = `Clip layer: ${layers[nextIndex].name || layers[nextIndex].id}`;
  }

  moveSelectedLayer(delta) {
    const layers = this.document.layers || [];
    const index = this.getSelectedLayerIndex();
    const nextIndex = clamp(index + delta, 0, Math.max(0, layers.length - 1));
    if (index < 0 || nextIndex === index) return;
    this.captureHistory('Move layer');
    const [layer] = layers.splice(index, 1);
    layers.splice(nextIndex, 0, layer);
    this.statusText = `Layer order: ${layer.name || layer.id}`;
  }

  getTrackIndexById(trackId) {
    return (this.document.tracks || []).findIndex((track) => track.id === trackId);
  }

  getSelectedClipTrack() {
    const clip = this.getSelectedClip();
    if (!clip) return null;
    return (this.document.tracks || []).find((track) => track.id === clip.trackId) || null;
  }

  getSelectedTrackIndex() {
    const track = this.getSelectedTrack();
    return track ? this.getTrackIndexById(track.id) : -1;
  }

  getSelectedClipTrackIndex() {
    const track = this.getSelectedClipTrack();
    return track ? this.getTrackIndexById(track.id) : -1;
  }

  getTimelineTrackIndexAtY(y) {
    const lane = this.bounds.trackLabels?.find((entry) => y >= entry.y && y <= entry.y + entry.h)
      || this.bounds.clips?.find((entry) => y >= entry.y && y <= entry.y + entry.h);
    if (Number.isFinite(lane?.trackIndex)) return clamp(Math.round(lane.trackIndex), 0, Math.max(0, (this.document.tracks || []).length - 1));
    const lanes = this.bounds.trackLabels || [];
    if (!lanes.length) return -1;
    let nearest = lanes[0];
    let best = Infinity;
    lanes.forEach((entry) => {
      const centerY = entry.y + entry.h / 2;
      const distance = Math.abs(centerY - y);
      if (distance < best) {
        best = distance;
        nearest = entry;
      }
    });
    return Number.isFinite(nearest?.trackIndex) ? nearest.trackIndex : -1;
  }

  assignSelectedClipToTrackIndex(nextIndex, options = {}) {
    const clip = this.getSelectedClip();
    const tracks = this.document.tracks || [];
    const index = this.getSelectedClipTrackIndex();
    const target = clamp(Math.round(safeNumber(nextIndex, index)), 0, Math.max(0, tracks.length - 1));
    if (!clip || !tracks[target] || target === index) return;
    if (options.capture !== false) this.captureHistory('Move clip to track');
    clip.trackId = tracks[target].id;
    this.statusText = `${this.getClipLabel(clip)} -> ${tracks[target].name || `Track ${target + 1}`}`;
  }

  moveTrackToIndex(trackId, nextIndex, options = {}) {
    const tracks = this.document.tracks || [];
    const index = this.getTrackIndexById(trackId);
    const target = clamp(Math.round(safeNumber(nextIndex, index)), 0, Math.max(0, tracks.length - 1));
    if (index < 0 || target === index) return;
    if (options.capture !== false) this.captureHistory('Move track');
    const [track] = tracks.splice(index, 1);
    tracks.splice(target, 0, track);
    this.statusText = `${track.name || track.id} -> row ${target + 1}`;
  }

  moveSelectedTrackToIndex(nextIndex, options = {}) {
    const track = this.getSelectedTrack();
    if (!track) return;
    this.moveTrackToIndex(track.id, nextIndex, options);
  }

  moveSelectedTrack(delta) {
    const index = this.getSelectedTrackIndex();
    const nextIndex = clamp(index + delta, 0, Math.max(0, (this.document.tracks || []).length - 1));
    this.moveSelectedTrackToIndex(nextIndex);
  }

  moveSelectedTrackTo(edge) {
    const tracks = this.document.tracks || [];
    const index = this.getSelectedTrackIndex();
    if (index < 0) return;
    const nextIndex = edge === 'top' ? 0 : tracks.length - 1;
    this.moveSelectedTrackToIndex(nextIndex);
  }

  async renameSelectedTrack() {
    const track = this.getSelectedTrack();
    if (!track) return;
    const value = await this.requestText({
      title: 'Rename Track',
      label: 'Track Name',
      initialValue: track.name || 'Track'
    });
    if (value == null) return;
    const name = String(value).trim();
    if (!name) return;
    this.captureHistory('Rename track');
    track.name = name;
    this.statusText = `Track: ${name}`;
  }

  async moveSelectedClipToTrack() {
    const clip = this.getSelectedClip();
    const tracks = this.document.tracks || [];
    if (!clip || !tracks.length) return;
    const choice = await openChoiceOverlay({
      title: 'Move To Track',
      choices: tracks.map((track, index) => ({
        id: track.id,
        label: track.name || `Track ${index + 1}`,
        description: clip.trackId === track.id ? 'Current track' : ''
      }))
    });
    if (!choice) return;
    const index = this.getTrackIndexById(choice);
    this.assignSelectedClipToTrackIndex(index);
  }

  async createTrackForSelectedClip() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    const tracks = this.document.tracks || (this.document.tracks = []);
    const value = await this.requestText({
      title: 'New Track',
      label: 'Track Name',
      initialValue: `Track ${tracks.length + 1}`
    });
    if (value == null) return;
    const name = String(value).trim() || `Track ${tracks.length + 1}`;
    this.captureHistory('New track');
    const track = { id: makeId('track'), name };
    tracks.push(track);
    clip.trackId = track.id;
    this.statusText = `${this.getClipLabel(clip)} -> ${name}`;
  }

  deleteSelectedTrack() {
    const track = this.getSelectedTrack();
    const tracks = this.document.tracks || [];
    const clips = this.document.clips || [];
    const index = track ? this.getTrackIndexById(track.id) : -1;
    if (!track || index < 0 || tracks.length <= 1) return;
    this.captureHistory('Delete track');
    const fallback = tracks[index + 1] || tracks[index - 1];
    clips.forEach((clip) => {
      if (clip.trackId === track.id) clip.trackId = fallback.id;
    });
    tracks.splice(index, 1);
    this.selectedTrackId = fallback.id;
    this.statusText = `Removed ${track.name || track.id}`;
  }

  selectKeyframe(clip, timeMs) {
    if (!isKeyframeClip(clip) || !Array.isArray(clip.keyframes)) {
      this.selectedKeyframe = null;
      return null;
    }
    const safeTime = Math.round(safeNumber(timeMs, 0));
    const keyframe = clip.keyframes.find((entry) => entry?.manual === true && Math.round(safeNumber(entry.timeMs)) === safeTime) || null;
    this.selectedKeyframe = keyframe ? { clipId: clip.id, timeMs: keyframe.timeMs } : null;
    return keyframe;
  }

  getSelectedKeyframe(clip = this.getSelectedClip()) {
    if (!isKeyframeClip(clip) || !Array.isArray(clip.keyframes) || !this.selectedKeyframe) return null;
    if (this.selectedKeyframe.clipId !== clip.id) return null;
    return clip.keyframes.find((entry) => entry?.manual === true && Math.round(safeNumber(entry.timeMs)) === Math.round(safeNumber(this.selectedKeyframe.timeMs))) || null;
  }

  isProtectedKeyframe(clip, keyframe) {
    return false;
  }

  getSelectedKeyframeLabel(clip = this.getSelectedClip()) {
    const keyframe = this.getSelectedKeyframe(clip);
    if (!keyframe) return 'No key selected';
    const timeMs = Math.round(safeNumber(keyframe.timeMs));
    return `Key ${timeMs}ms`;
  }

  selectAdjacentKeyframe(direction) {
    const clip = this.getSelectedClip();
    if (!isKeyframeClip(clip) || !Array.isArray(clip.keyframes) || !clip.keyframes.length) {
      this.statusText = 'No keyframes on selected clip';
      return;
    }
    const keys = [...clip.keyframes].sort((a, b) => safeNumber(a.timeMs) - safeNumber(b.timeMs));
    const selectedKey = this.getSelectedKeyframe(clip);
    const localPlayhead = clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs));
    const origin = selectedKey ? safeNumber(selectedKey.timeMs) : localPlayhead;
    let next = null;
    if (direction < 0) {
      next = [...keys].reverse().find((keyframe) => safeNumber(keyframe.timeMs) < origin) || keys.at(-1);
    } else {
      next = keys.find((keyframe) => safeNumber(keyframe.timeMs) > origin) || keys[0];
    }
    if (!next) return;
    this.selectKeyframe(clip, next.timeMs);
    this.playheadMs = clamp(clip.startMs + safeNumber(next.timeMs), 0, this.document.durationMs);
    this.statusText = this.getSelectedKeyframeLabel(clip);
  }

  moveSelectedClipToStagePoint(x, y, drag = null) {
    const clip = this.getSelectedClip();
    if (!clip || !this.bounds.stage) return;
    let keyframe = this.getSelectedKeyframe(clip);
    if (!keyframe) {
      keyframe = clip;
      if (Array.isArray(clip.keyframes) && clip.keyframes.length && drag?.moved) {
        this.statusText = 'Moved base pose; select or set a keyframe to animate';
      }
    }
    if (!keyframe) return;
    const projection = getCutsceneStageProjection(this.document, this.bounds.stage);
    const point = screenToCutscenePoint(x, y, projection);
    const anchored = {
      x: point.x + safeNumber(drag?.anchorX, 0),
      y: point.y + safeNumber(drag?.anchorY, 0)
    };
    const snapped = this.applyStageSnap(anchored);
    const clamped = clampCutscenePointForClip(snapped, clip, keyframe, this.document);
    keyframe.x = clamped.x;
    keyframe.y = clamped.y;
  }

  applyStageSnap(point) {
    if (this.document?.snapEnabled === false) return point;
    const snap = clamp(Math.round(safeNumber(this.document?.snapSize, 8)), 1, 64);
    return {
      x: Math.round(safeNumber(point?.x) / snap) * snap,
      y: Math.round(safeNumber(point?.y) / snap) * snap
    };
  }

  toggleStageSnap() {
    this.captureHistory('Toggle snap');
    this.document.snapEnabled = this.document.snapEnabled === false;
    this.statusText = this.document.snapEnabled === false ? 'Snap off' : `Snap ${this.document.snapSize || 8}px`;
  }

  async editStageSnapSize() {
    const value = await this.requestText({
      title: 'Grid Size',
      label: 'Pixels',
      initialValue: String(clamp(Math.round(safeNumber(this.document.snapSize, 8)), 1, 64)),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Grid size');
    this.document.snapSize = clamp(Math.round(safeNumber(value, this.document.snapSize || 8)), 1, 64);
    this.statusText = `Grid ${this.document.snapSize}px`;
  }

  handleButton(id) {
    if (this.pendingAction) return;
    const run = async () => {
      if (id?.startsWith?.('desktop-root:')) {
        const rootId = id.slice('desktop-root:'.length);
        const nextDropdown = resolveOpenDesktopDropdownState({
          rootId: CUTSCENE_DESKTOP_MENU_LABELS[rootId] ? rootId : 'add',
          currentOpenRootId: this.openDesktopDropdownRootId,
          closedRootId: this.closedDesktopDropdownRootId,
          dropdown: this.desktopDropdown
        });
        if (!nextDropdown) return;
        this.openDesktopDropdownRootId = nextDropdown.openRootId;
        this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
        this.desktopDropdown = nextDropdown.dropdown;
        this.menuOpen = false;
        this.clipOptionsOpen = false;
        this.menuScroll = 0;
        return;
      }
      if (id?.startsWith?.('landscape-tab:')) {
        const rootId = id.slice('landscape-tab:'.length);
        this.activeMenuTab = CUTSCENE_DESKTOP_MENU_LABELS[rootId] ? rootId : 'add';
        this.menuOpen = true;
        this.landscapeRootDrawerOpen = true;
        this.clipOptionsOpen = false;
        this.menuScroll = 0;
        return;
      }
      if (id?.startsWith?.('tab:')) {
        this.activeMenuTab = id.slice(4);
        this.menuScroll = 0;
        this.clipOptionsOpen = false;
        return;
      }
      if (id?.startsWith?.('clip-options-tab:')) {
        const tab = id.slice('clip-options-tab:'.length);
        this.clipOptionsTab = ['keys', 'settings', 'edit'].includes(tab) ? tab : 'settings';
        return;
      }
      if (id?.startsWith?.('layer:')) {
        this.assignSelectedClipToLayer(id.slice(6));
        return;
      }
      if (id?.startsWith?.('select-track:')) {
        this.selectedClipId = id.slice('select-track:'.length);
        this.selectedTrackId = null;
        this.selectedKeyframe = null;
        return;
      }
      if (id === 'menu') {
        this.toggleBottomMenu();
        return;
      }
      if (id === 'landscape-menu') {
        this.landscapeRootDrawerOpen = !this.landscapeRootDrawerOpen;
        this.menuOpen = false;
        this.clipOptionsOpen = false;
        this.menuScroll = 0;
        return;
      }
      if (id === 'undo') {
        this.undo();
        return;
      }
      if (id === 'redo') {
        this.redo();
        return;
      }
      if (id === 'new') await this.newDocument();
      if (id === 'open') await this.openDocument();
      if (id === 'save') await this.saveDocument();
      if (id === 'save-as') await this.saveDocument({ forceSaveAs: true });
      if (id === 'export' || id === 'export-mp4') await this.exportMovieMp4();
      if (id === 'text') await this.addTextClip();
      if (id === 'color-board') await this.addColorBoardClip();
      if (id === 'art') await this.addArtClip();
      if (id === 'actor') await this.addActorClip();
      if (id === 'import') this.importImageClip();
      if (id === 'music') await this.addAudioClip('music');
      if (id === 'sfx') await this.addAudioClip('sfx');
      if (id === 'effect') await this.addEffectClip();
      if (id === 'pause') this.addPauseClip();
      if (id === 'play') await this.togglePlayback();
      if (id === 'step-frame') this.stepFrame();
      if (id === 'actions') await this.openSelectedClipActions();
      if (id === 'clip-options') {
        this.menuOpen = false;
        this.clipOptionsOpen = !this.clipOptionsOpen;
        if (!['keys', 'settings', 'edit'].includes(this.clipOptionsTab)) this.clipOptionsTab = 'settings';
        return;
      }
      if (id === 'set-start') this.setSelectedKeyframe('start');
      if (id === 'set-end') this.setSelectedKeyframe('end');
      if (id === 'set-key') this.setSelectedKeyframe(this.keyframeMode);
      if (id === 'delete-key') this.deleteSelectedKeyframe();
      if (id === 'prev-key') this.selectAdjacentKeyframe(-1);
      if (id === 'next-key') this.selectAdjacentKeyframe(1);
      if (id === 'key-mode') this.cycleKeyframeMode();
      if (id === 'ease') this.cycleSelectedEasing();
      if (id === 'fade-in') await this.editSelectedFadeVisual('in');
      if (id === 'fade-out') await this.editSelectedFadeVisual('out');
      if (id === 'edit-text') await this.editSelectedTextContent();
      if (id === 'text-color') await this.editSelectedTextColor();
      if (id === 'text-border') this.toggleSelectedTextBorder();
      if (id === 'text-border-color') await this.editSelectedTextBorderColor();
      if (id === 'text-border-size') await this.editSelectedTextBorderSize();
      if (id === 'board-color') await this.editSelectedBoardColor();
      if (id === 'font-size') await this.editSelectedFontSize();
      if (id === 'font-family') await this.editSelectedFontFamily();
      if (id === 'text-align') await this.editSelectedTextAlign();
      if (id === 'reveal-speed') await this.editSelectedRevealSpeed();
      if (id === 'scale') await this.editSelectedScale();
      if (id === 'scale-x') await this.editSelectedAxisScale('x');
      if (id === 'scale-y') await this.editSelectedAxisScale('y');
      if (id === 'aspect-lock') this.toggleSelectedAspectLock();
      if (id === 'rotate') await this.editSelectedRotation();
      if (id === 'opacity') await this.editSelectedOpacity();
      if (id === 'fx') await this.editSelectedFx();
      if (id === 'reset-transform') this.resetSelectedTransform();
      if (id === 'play-animation') this.toggleSelectedAnimationPlayback();
      if (id === 'anim-speed') await this.editSelectedAnimationSpeed();
      if (id === 'anim-loop') this.toggleSelectedAnimationLoop();
      if (id === 'actor-state') await this.editSelectedActorState();
      if (id === 'add-state') await this.addActorStateEvent();
      if (id === 'delete-state') this.deleteActorStateEvent();
      if (id === 'next-state') this.nextActorStateEvent();
      if (id === 'loop') this.toggleSelectedLoop();
      if (id === 'volume') await this.editSelectedVolume();
      if (id === 'fade') await this.editSelectedFade();
      if (id === 'effect-type') await this.editSelectedEffectType();
      if (id === 'effect-intensity') await this.editSelectedEffectNumber('intensity', 'Effect Power', 1);
      if (id === 'effect-wind') await this.editSelectedEffectNumber('wind', 'Effect Wind', 0);
      if (id === 'clip-duration') await this.editSelectedDuration();
      if (id === 'snap-toggle') this.toggleStageSnap();
      if (id === 'snap-size') await this.editStageSnapSize();
      if (id === 'scene-fade-in') await this.editSceneFade('in');
      if (id === 'scene-fade-out') await this.editSceneFade('out');
      if (id === 'master-volume') await this.editMasterVolume();
      if (id === 'view-canvas') this.setWorkspaceMode('canvas');
      if (id === 'view-split') this.setWorkspaceMode('split');
      if (id === 'view-timeline') this.setWorkspaceMode('timeline');
      if (id === 'timeline-zoom-out') this.adjustTimelineZoom(1 / 1.35);
      if (id === 'timeline-zoom-in') this.adjustTimelineZoom(1.35);
      if (id === 'timeline-fit') this.fitTimeline();
      if (id === 'track-up') this.moveSelectedTrack(-1);
      if (id === 'track-down') this.moveSelectedTrack(1);
      if (id === 'track-top') this.moveSelectedTrackTo('top');
      if (id === 'track-bottom') this.moveSelectedTrackTo('bottom');
      if (id === 'move-to-track') await this.moveSelectedClipToTrack();
      if (id === 'new-track') await this.createTrackForSelectedClip();
      if (id === 'rename-track') await this.renameSelectedTrack();
      if (id === 'delete-track') this.deleteSelectedTrack();
      if (id === 'scene-duration') await this.editSceneDuration();
      if (id === 'clip-layer-up') this.moveSelectedClipLayer(1);
      if (id === 'clip-layer-down') this.moveSelectedClipLayer(-1);
      if (id === 'layer-up') this.moveSelectedLayer(1);
      if (id === 'layer-down') this.moveSelectedLayer(-1);
      if (id === 'duplicate') this.duplicateSelectedClip();
      if (id === 'copy') this.copySelectedClip();
      if (id === 'cut') this.cutSelectedClip();
      if (id === 'paste') this.pasteClipboardClip();
      if (id === 'delete') this.deleteSelectedClip();
      if (id === 'close-menu') {
        this.menuOpen = false;
        this.menuScroll = 0;
      }
      if (id === 'back' || id === 'exit-main') this.game.exitCutsceneEditor?.();
    };
    this.pendingAction = run()
      .catch((error) => {
        this.statusText = `Action failed: ${error?.message || error}`;
      })
      .finally(() => {
        this.pendingAction = null;
      });
  }

  toggleBottomMenu() {
    if (this.clipOptionsOpen) {
      this.clipOptionsOpen = false;
      return;
    }
    if (this.menuOpen || this.menuScrollDrag || this.timelineZoomSlider.active || this.panJoystick.active) {
      this.menuOpen = false;
      this.menuScroll = 0;
      this.menuScrollDrag = null;
      this.timelineZoomSlider.active = false;
      this.panJoystick.active = false;
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    this.activeMenuTab = CUTSCENE_MENU_TABS.some((tab) => tab.id === this.activeMenuTab) ? this.activeMenuTab : 'add';
    this.clipOptionsOpen = false;
    this.menuOpen = true;
    this.menuScroll = 0;
  }

  getMenuItems(tabId = this.activeMenuTab) {
    const selected = this.getSelectedClip();
    if (tabId === 'file') {
      return buildSharedEditorFileMenu({
        labels: {
          export: 'Export MP4'
        },
        actions: {
          new: () => this.newDocument(),
          open: () => this.openDocument(),
          save: () => this.saveDocument(),
          'save-as': () => this.saveDocument({ forceSaveAs: true }),
          export: () => this.exportMovieMp4(),
          import: () => this.importImageClip()
        },
        footer: {
          onClose: () => {
            this.menuOpen = false;
            this.menuScroll = 0;
          },
          onExit: () => this.game.exitCutsceneEditor?.()
        }
      }).map((item) => (item.id === 'export' ? { ...item, disabled: this.movieExportInProgress } : item));
    }
    if (tabId === 'edit') {
      return [
        { id: 'undo', label: 'Undo' },
        { id: 'redo', label: 'Redo' },
        { id: 'copy', label: 'Copy', disabled: !selected },
        { id: 'cut', label: 'Cut', disabled: !selected },
        { id: 'paste', label: 'Paste', disabled: !this.clipboardClip },
        { id: 'delete', label: 'Delete', disabled: !selected }
      ];
    }
    if (tabId === 'view') {
      return [
        { id: 'view-canvas', label: 'Canvas View', active: this.workspaceMode === 'canvas' },
        { id: 'view-split', label: 'Split View', active: this.workspaceMode === 'split' },
        { id: 'view-timeline', label: 'Timeline View', active: this.workspaceMode === 'timeline' },
        { id: 'timeline-zoom-out', label: 'Zoom Out' },
        { id: 'timeline-zoom-in', label: 'Zoom In' },
        { id: 'timeline-fit', label: 'Fit Timeline' }
      ];
    }
    if (tabId === 'add') {
      return [
        { id: 'art', label: 'Art' },
        { id: 'actor', label: 'Actor' },
        { id: 'text', label: 'Text' },
        { id: 'color-board', label: 'Color Board' },
        { id: 'music', label: 'Music' },
        { id: 'sfx', label: 'SFX' },
        { id: 'effect', label: 'Effect' },
        { id: 'pause', label: 'Pause' }
      ];
    }
    if (tabId === 'timeline') {
      return [
        { id: 'play', label: this.isPlaying ? 'Pause' : 'Play' },
        { id: 'step-frame', label: 'Step Frame' }
      ];
    }
    if (tabId === 'clips') {
      return [
        { id: 'clip-options', label: 'Clip Options', disabled: !selected && !this.getSelectedTrack() },
        { id: 'duplicate', label: 'Duplicate', disabled: !selected },
        { id: 'move-to-track', label: 'Move To Track', disabled: !selected || (this.document.tracks || []).length <= 1 },
        { id: 'new-track', label: 'New Track', disabled: !selected }
      ];
    }
    if (tabId === 'keyframes') {
      return [
        { id: 'set-start', label: 'Set Start Key', disabled: !selected },
        { id: 'set-end', label: 'Set End Key', disabled: !selected },
        { id: 'set-key', label: 'Set Playhead Key', disabled: !selected },
        { id: 'delete-key', label: 'Delete Key', disabled: !this.getSelectedKeyframe(selected) },
        { id: 'prev-key', label: 'Previous Key', disabled: !selected },
        { id: 'next-key', label: 'Next Key', disabled: !selected },
        { id: 'key-mode', label: this.getSelectedKeyframeLabel(selected), disabled: !selected },
        { id: 'ease', label: `Ease ${this.getEasingLabel(selected?.easing)}`, disabled: !selected }
      ];
    }
    if (tabId === 'audio') {
      return [
        { id: 'volume', label: 'Clip Volume', disabled: !selected || !isAudioClip(selected) },
        { id: 'fade', label: 'Clip Fade', disabled: !selected || !isAudioClip(selected) },
        { id: 'loop', label: selected?.loop ? 'Loop On' : 'Loop Off', disabled: !selected || !isAudioClip(selected) },
        { id: 'master-volume', label: `Master ${Math.round(clamp(safeNumber(this.document.masterVolume, 1), 0, 1) * 100)}` }
      ];
    }
    if (tabId === 'settings') {
      return [];
    }
    return [
      { id: 'scene-duration', label: 'Scene Length' },
      { id: 'scene-fade-in', label: `Fade In ${this.document.sceneFadeInMs || 0}ms` },
      { id: 'scene-fade-out', label: `Fade Out ${this.document.sceneFadeOutMs || 0}ms` },
      { id: 'snap-toggle', label: this.document.snapEnabled === false ? 'Snap Off' : 'Snap On' },
      { id: 'snap-size', label: `Grid ${clamp(Math.round(safeNumber(this.document.snapSize, 8)), 1, 64)}` }
    ];
  }

  getClipLabel(clip) {
    const asset = (this.document.assets || []).find((entry) => entry.id === clip.assetId);
    if (clip.type === 'text') return `Text: ${clip.text || 'Text'}`;
    if (clip.type === 'pause') return `Pause: ${clip.prompt || 'Input'}`;
    if (clip.type === 'color-board') return `Color Board: ${clip.color || '#000000'}`;
    if (clip.type === 'art') return `Art: ${asset?.name || clip.assetRef || clip.assetId}`;
    if (clip.type === 'actor') return `Actor: ${asset?.name || clip.actorRef || clip.assetId}${clip.stateId ? `/${clip.stateId}` : ''}`;
    if (clip.type === 'image') return `Import: ${asset?.name || clip.assetId}`;
    if (clip.type === 'music') return `${clip.loop ? 'Loop ' : ''}Music: ${asset?.name || clip.assetId}`;
    if (clip.type === 'sfx') return `${clip.loop ? 'Loop ' : ''}SFX: ${asset?.name || clip.assetId}`;
    if (clip.type === 'effect') return `FX: ${clip.effectType || 'rain'}`;
    return clip.id || clip.type;
  }

  getKeyframeModeLabel() {
    if (this.keyframeMode === 'start') return 'Start';
    if (this.keyframeMode === 'end') return 'End';
    return 'Playhead';
  }

  getEasingLabel(easing = 'linear') {
    if (easing === 'ease-in') return 'Ease In';
    if (easing === 'ease-out') return 'Ease Out';
    if (easing === 'ease-in-out') return 'Ease In/Out';
    return 'Linear';
  }

  async preparePreviewAudioResources(doc = this.document) {
    if (!doc || typeof this.game?.prepareCutsceneAudioResources !== 'function') return;
    this.statusText = 'Preparing audio...';
    await this.game.prepareCutsceneAudioResources(doc);
  }

  async togglePlayback() {
    if (this.isPlaying) {
      this.pausePlayback();
      return;
    }
    await this.playScene();
  }

  async playScene() {
    if (!this.document) this.document = createDefaultCutscene();
    const previewDurationMs = getFullPreviewDurationMs(this.document);
    this.document.durationMs = Math.max(this.document.durationMs || DEFAULT_DURATION_MS, previewDurationMs);
    const startMs = clamp(this.playheadMs, 0, previewDurationMs);
    await this.preparePreviewAudioResources(this.document);
    this.playheadMs = startMs;
    this.previewPlaybackTargetMs = previewDurationMs;
    const now = getNowMs();
    this.isPlaying = true;
    this.playbackLastNow = now;
    this.playbackStartedAt = now;
    this.playbackStartPlayhead = startMs;
    this.playbackAccumulatedMs = 0;
    this.ignorePreviewDone = false;
    this.previewPlayer.play(this.document, {
      skippable: false,
      ignorePauseMarkers: true,
      startMs,
      onDone: () => {
        debugCutscenePlayback('preview-player-done', {
          editorPlaying: this.isPlaying,
          playheadMs: this.playheadMs,
          targetMs: this.previewPlaybackTargetMs,
          ignored: this.ignorePreviewDone
        });
      }
    });
    debugCutscenePlayback('play', { startMs, targetMs: previewDurationMs, documentDurationMs: this.document.durationMs });
    this.statusText = `Playing cutscene ${startMs}-${previewDurationMs}ms`;
  }

  playPlayback() {
    return this.playScene();
  }

  pausePlayback() {
    debugCutscenePlayback('pause', { playheadMs: this.playheadMs, targetMs: this.previewPlaybackTargetMs, previewActive: Boolean(this.previewPlayer?.active) });
    if (this.previewPlayer?.active) {
      this.ignorePreviewDone = true;
      this.previewPlayer.stop();
      this.ignorePreviewDone = false;
    }
    this.isPlaying = false;
    this.playbackLastNow = null;
    this.playbackStartedAt = null;
    this.playbackStartPlayhead = this.playheadMs;
    this.playbackAccumulatedMs = 0;
  }

  stepFrame() {
    this.pausePlayback();
    this.playheadMs = clamp(this.playheadMs + getFrameStepMs(this.document), 0, this.document.durationMs);
    this.statusText = `Frame ${Math.round(this.playheadMs)}ms`;
  }

  openMovieExportProgressOverlay() {
    if (typeof document === 'undefined') {
      return { update() {}, close() {} };
    }
    return openProgressOverlay({
      title: 'Export MP4',
      message: 'Preparing movie...',
      cancelText: ''
    });
  }

  prepareForDownload() {
    window.dispatchEvent(new CustomEvent('chainsaw-download-start'));
  }

  openMovieDownloadReadyOverlay(blob, filename) {
    if (typeof document === 'undefined') return Promise.resolve(false);
    if (!blob?.size) return Promise.reject(new Error('MP4 export produced no downloadable video.'));
    const previousActive = document.activeElement;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    const url = URL.createObjectURL(blob);
    let root = document.getElementById('global-overlay-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'global-overlay-root';
      Object.assign(root.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        pointerEvents: 'none'
      });
      document.body.appendChild(root);
    }
    root.style.display = 'block';
    root.style.pointerEvents = 'auto';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    return new Promise((resolve, reject) => {
      const overlay = document.createElement('div');
      overlay.className = 'shared-text-input-overlay';
      overlay.tabIndex = -1;
      overlay.style.pointerEvents = 'auto';
      const shieldEvent = (event) => {
        event.stopPropagation();
      };
      [
        'pointerdown',
        'pointerup',
        'pointermove',
        'click',
        'touchstart',
        'touchend',
        'touchmove',
        'mousedown',
        'mouseup'
      ].forEach((type) => overlay.addEventListener(type, shieldEvent));
      const panel = document.createElement('div');
      panel.className = 'shared-text-input-panel multi-field';
      overlay.appendChild(panel);
      const title = document.createElement('h3');
      title.className = 'shared-text-input-title';
      title.textContent = 'MP4 Ready';
      panel.appendChild(title);
      const label = document.createElement('div');
      label.className = 'shared-text-input-label';
      label.textContent = filename;
      panel.appendChild(label);
      const buttonRow = document.createElement('div');
      buttonRow.className = 'shared-text-input-actions';
      panel.appendChild(buttonRow);
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'shared-text-input-btn';
      cancelBtn.textContent = 'Cancel';
      buttonRow.appendChild(cancelBtn);
      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'shared-text-input-btn primary';
      downloadBtn.textContent = 'Download';
      buttonRow.appendChild(downloadBtn);
      const openLink = document.createElement('a');
      openLink.className = 'shared-text-input-btn';
      openLink.href = url;
      openLink.target = '_blank';
      openLink.rel = 'noopener';
      openLink.textContent = 'Open Video';
      buttonRow.appendChild(openLink);
      let settled = false;
      let urlRevoked = false;
      const revokeDownloadUrl = () => {
        if (urlRevoked) return;
        urlRevoked = true;
        URL.revokeObjectURL(url);
      };
      const cleanup = (downloaded) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        root.style.pointerEvents = 'none';
        body.style.overflow = previousOverflow;
        body.style.touchAction = previousTouchAction;
        previousActive?.focus?.();
        resolve(downloaded);
      };
      const triggerDownload = () => {
        this.prepareForDownload();
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => {
          revokeDownloadUrl();
          window.dispatchEvent(new CustomEvent('chainsaw-download-complete'));
        }, 60000);
        window.setTimeout(() => cleanup(true), 500);
      };
      const bindOverlayActionButton = (button, handler) => {
        let handled = false;
        const activate = (event) => {
          if (handled) return;
          handled = true;
          event.preventDefault();
          event.stopPropagation();
          handler();
        };
        button.addEventListener('click', activate);
        button.addEventListener('touchend', activate);
        button.addEventListener('pointerup', activate);
      };
      bindOverlayActionButton(cancelBtn, () => {
        revokeDownloadUrl();
        cleanup(false);
      });
      bindOverlayActionButton(downloadBtn, triggerDownload);
      openLink.addEventListener('click', (event) => {
        event.stopPropagation();
        window.setTimeout(() => cleanup(true), 500);
      });
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          revokeDownloadUrl();
          cleanup(false);
        }
      });
      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          revokeDownloadUrl();
          cleanup(false);
        }
      });
      root.appendChild(overlay);
      window.setTimeout(() => downloadBtn.focus({ preventScroll: true }), 0);
      if (!downloadBtn.isConnected) {
        cleanup(false);
        reject(new Error('Could not show the MP4 download button.'));
      }
    });
  }

  buildMovieExportRuntime() {
    return {
      imageCache: this.previewRuntime.imageCache,
      artCache: this.previewRuntime.artCache,
      weatherStates: new Map(),
      getImageForAsset: (asset) => this.getImageForAsset(asset),
      getArtFrameForAsset: (asset) => this.getArtFrameForAsset(asset),
      getVisualFrameForClip: (clip, asset, timeMs) => this.getVisualFrameForClip(clip, asset, timeMs)
    };
  }

  renderMovieExportFrame(exportCtx, doc, timeMs, layout, runtime) {
    exportCtx.imageSmoothingEnabled = false;
    drawCutsceneDocument(exportCtx, doc, timeMs, layout.stageBounds || { x: 0, y: 0, w: layout.outputWidth, h: layout.outputHeight }, runtime, { fit: layout.fit || 'contain', drawBorder: false, pixelSnap: true });
  }

  advanceMovieExportAudio(player, dtSeconds) {
    const dt = Math.max(0, Number(dtSeconds) || 0);
    player?.update?.(dt);
  }

  async transcodeMovieBlobToMp4(blob, layout = null) {
    const params = new URLSearchParams();
    if (layout?.outputWidth && layout?.outputHeight) {
      params.set('outputWidth', String(Math.max(1, Math.floor(layout.outputWidth))));
      params.set('outputHeight', String(Math.max(1, Math.floor(layout.outputHeight))));
    }
    const url = params.toString() ? `/__export/mp4?${params.toString()}` : '/__export/mp4';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob
    });
    if (!response.ok) {
      let message = `MP4 encoder failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.blob();
  }

  async transcodeMovieRecordingToMp4({ videoBlob, audioBlob = null }) {
    if (!videoBlob?.size) throw new Error('Movie recorder produced no video data.');
    const form = new FormData();
    form.append('video', videoBlob, 'video.webm');
    if (audioBlob?.size) {
      form.append('audio', audioBlob, audioBlob.type === 'audio/wav' ? 'audio.wav' : 'audio.webm');
    }
    const response = await fetch('/__export/mp4-recording', {
      method: 'POST',
      body: form
    });
    if (!response.ok) {
      let message = `MP4 recorder encoder failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.blob();
  }

  async transcodeFrameMovieToMp4({ frames, audioBlob = null, fps = DEFAULT_FPS }) {
    const form = new FormData();
    form.append('fps', String(fps));
    frames.forEach((frame, index) => {
      form.append('frame', frame, `frame-${String(index).padStart(6, '0')}.png`);
    });
    if (audioBlob?.size) {
      form.append('audio', audioBlob, audioBlob.type === 'audio/wav' ? 'audio.wav' : 'audio.webm');
    }
    const response = await fetch('/__export/mp4-frames', {
      method: 'POST',
      body: form
    });
    if (!response.ok) {
      let message = `MP4 frame encoder failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.blob();
  }

  getMovieExportContentKey(safeDoc, { durationMs, fps, frameCount, layout, segmentMs, segmentCount }) {
    const source = JSON.stringify({
      version: 7,
      doc: safeDoc,
      durationMs,
      fps,
      frameCount,
      segmentMs,
      segmentCount,
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
      outputWidth: layout.outputWidth,
      outputHeight: layout.outputHeight
    });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `cutscene-mp4-v7-${safeDoc.name || 'cutscene'}-${durationMs}-${fps}-${frameCount}-${segmentMs}-${(hash >>> 0).toString(16)}`;
  }

  async createMovieExportSession(metadata) {
    const response = await fetch('/__export/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });
    if (!response.ok) {
      let message = `Could not create export session (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    const payload = await response.json();
    if (!payload?.session?.id) throw new Error('Export session response was invalid.');
    return payload.session;
  }

  async uploadMovieExportFrame(sessionId, index, blob) {
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/frame/${index}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'image/png' },
      body: blob
    });
    if (!response.ok) {
      let message = `Could not upload frame ${index + 1} (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.json();
  }

  async uploadMovieExportSegmentFrame(sessionId, segmentIndex, frameIndex, blob) {
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/segment/${segmentIndex}/frame/${frameIndex}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'image/png' },
      body: blob
    });
    if (!response.ok) {
      let message = `Could not upload segment ${segmentIndex + 1} frame ${frameIndex + 1} (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.json();
  }

  async uploadMovieExportAudio(sessionId, blob) {
    if (!blob?.size) return null;
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/audio`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob
    });
    if (!response.ok) {
      let message = `Could not upload movie audio (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.json();
  }

  async encodeMovieExportSession(sessionId) {
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/encode`, {
      method: 'POST'
    });
    if (!response.ok) {
      let message = `MP4 encoder failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.json();
  }

  async encodeMovieExportSegment(sessionId, segmentIndex) {
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/segment/${segmentIndex}/encode`, {
      method: 'POST'
    });
    if (!response.ok) {
      let message = `MP4 segment encoder failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.json();
  }

  async finalizeMovieExportSession(sessionId) {
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/finalize`, {
      method: 'POST'
    });
    if (!response.ok) {
      let message = `MP4 finalization failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.json();
  }

  async downloadMovieExportResult(sessionId) {
    const response = await fetch(`/__export/session/${encodeURIComponent(sessionId)}/result`);
    if (!response.ok) {
      let message = `Could not download MP4 (${response.status})`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch (_error) {}
      throw new Error(message);
    }
    return response.blob();
  }

  canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode movie frame.'));
      }, 'image/png');
    });
  }

  cloneAudioBufferToContext(ctx, sourceBuffer) {
    if (!ctx || !sourceBuffer) return null;
    const targetLength = Math.max(1, Math.round(sourceBuffer.duration * ctx.sampleRate));
    const buffer = ctx.createBuffer(sourceBuffer.numberOfChannels || 1, targetLength, ctx.sampleRate);
    const ratio = sourceBuffer.sampleRate / ctx.sampleRate;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const sourceData = sourceBuffer.getChannelData(Math.min(channel, sourceBuffer.numberOfChannels - 1));
      const destData = buffer.getChannelData(channel);
      for (let i = 0; i < destData.length; i += 1) {
        const sourceIndex = i * ratio;
        const leftIndex = Math.min(sourceData.length - 1, Math.floor(sourceIndex));
        const rightIndex = Math.min(sourceData.length - 1, leftIndex + 1);
        const mix = sourceIndex - leftIndex;
        const left = sourceData[leftIndex] || 0;
        const right = sourceData[rightIndex] || 0;
        destData[i] = left + (right - left) * mix;
      }
    }
    return buffer;
  }

  createOfflineNoiseBuffer(ctx, duration = 0.4, type = 'snare') {
    const length = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.03, duration)));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const t = i / ctx.sampleRate;
      const fade = Math.max(0, 1 - t / Math.max(0.03, duration));
      const noise = (Math.random() * 2 - 1) * fade;
      if (type === 'kick') {
        const freq = 120 * fade + 42;
        data[i] = Math.sin(2 * Math.PI * freq * t) * fade;
      } else if (type === 'hat') {
        data[i] = noise * 0.35;
      } else {
        data[i] = noise * 0.65;
      }
    }
    return buffer;
  }

  getOfflineDrumType(pitch) {
    if (pitch === 36 || pitch === 35) return 'kick';
    if (pitch === 42 || pitch === 44 || pitch === 46) return 'hat';
    return 'snare';
  }

  scheduleOfflineMidiEvent(ctx, destination, event) {
    const when = Math.max(0, event.startSec);
    const duration = Math.max(0.03, event.durationSec);
    const sample = event.soundfontSample?.buffer
      ? event.soundfontSample
      : this.game?.audio?.midiSamples?.lead || null;
    let source;
    let sampled = false;
    if (event.soundfontSample?.buffer || sample?.buffer) {
      source = ctx.createBufferSource();
      source.buffer = this.cloneAudioBufferToContext(ctx, (event.soundfontSample || sample).buffer);
      source.playbackRate.value = event.isDrum || event.soundfontSample?.isDrums || sample?.isDrums
        ? 1
        : 2 ** ((event.pitch - (event.soundfontSample?.baseNote ?? sample.baseNote ?? 60)) / 12);
      sampled = true;
    } else if (event.isDrum) {
      source = ctx.createBufferSource();
      source.buffer = this.createOfflineNoiseBuffer(ctx, Math.min(1.2, duration + 0.2), this.getOfflineDrumType(event.pitch));
    } else {
      source = ctx.createOscillator();
      source.type = 'triangle';
      source.frequency.value = 440 * (2 ** ((event.pitch - 69) / 12));
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sampled ? 9000 : (event.isDrum ? 9000 : 2400);
    const gain = ctx.createGain();
    const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    source.connect(filter);
    filter.connect(gain);
    if (panNode) {
      panNode.pan.value = clamp(event.pan ?? 0, -1, 1);
      gain.connect(panNode);
      panNode.connect(destination);
    } else {
      gain.connect(destination);
    }

    const profile = getGmSustainProfile({ program: event.program, channel: event.channel, isDrums: event.isDrum });
    const release = Math.max(0.01, profile.release ?? (event.isDrum ? 0.06 : 0.2));
    const attack = Math.max(0.001, profile.attack ?? (event.isDrum ? 0.004 : 0.012));
    const decay = Math.max(0.001, profile.decay ?? 0.12);
    const effectiveDuration = profile.mode === 'oneshot'
      ? Math.min(duration, profile.maxDuration ?? duration)
      : Math.min(duration, profile.maxDuration ?? duration);
    const attackAt = when + Math.min(attack, Math.max(0.001, effectiveDuration * 0.45));
    const decayAt = Math.min(when + effectiveDuration, attackAt + decay);
    const sustainUntil = when + Math.max(attack, effectiveDuration);
    const peak = Math.max(0.0001, clamp(event.volume ?? 0.7, 0, 1) * (sampled ? 0.95 : 0.32));
    const sustainLevel = Math.max(0.0001, peak * clamp(profile.sustain ?? 0.7, 0.0001, 1));
    const tailLevel = Math.max(0.0001, peak * clamp(profile.tail ?? profile.sustain ?? 0.4, 0.0001, 1));

    if (source.buffer && !event.isDrum && profile.loopSample !== false) {
      const rate = Math.max(0.0001, source.playbackRate?.value || 1);
      const audibleBufferDuration = source.buffer.duration / rate;
      if (audibleBufferDuration < effectiveDuration + release + 0.04 && source.buffer.duration >= 0.18) {
        source.loop = true;
        source.loopStart = clamp(source.buffer.duration * 0.45, 0.04, Math.max(0.05, source.buffer.duration - 0.08));
        source.loopEnd = clamp(source.buffer.duration * 0.88, source.loopStart + 0.04, source.buffer.duration);
      }
    }

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, attackAt);
    if (profile.mode === 'oneshot') {
      gain.gain.exponentialRampToValueAtTime(0.0001, sustainUntil + release);
    } else if (profile.mode === 'decay') {
      gain.gain.exponentialRampToValueAtTime(sustainLevel, decayAt);
      if (sustainUntil > decayAt + 0.01) {
        gain.gain.exponentialRampToValueAtTime(tailLevel, sustainUntil);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, sustainUntil + release);
    } else {
      gain.gain.exponentialRampToValueAtTime(sustainLevel, decayAt);
      gain.gain.setValueAtTime(sustainLevel, sustainUntil);
      gain.gain.exponentialRampToValueAtTime(0.0001, sustainUntil + release);
    }
    source.start(when);
    source.stop(sustainUntil + release + 0.08);
  }

  prepareWavChannelData(audioBuffer) {
    const channels = Math.min(2, audioBuffer.numberOfChannels || 1);
    const length = audioBuffer.length;
    const safetyFadeSamples = Math.min(Math.floor(audioBuffer.sampleRate * 0.006), Math.floor(length / 2));
    const data = Array.from({ length: channels }, (_, channel) => new Float32Array(audioBuffer.getChannelData(channel)));
    data.forEach((channelData) => {
      let sum = 0;
      for (let i = 0; i < length; i += 1) sum += channelData[i] || 0;
      const dc = sum / Math.max(1, length);
      for (let i = 0; i < length; i += 1) {
        let sample = (channelData[i] || 0) - dc;
        if (i < safetyFadeSamples) sample *= i / safetyFadeSamples;
        if (i >= length - safetyFadeSamples) sample *= (length - i - 1) / safetyFadeSamples;
        channelData[i] = sample;
      }
    });
    let peak = 0;
    data.forEach((channelData) => {
      for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(channelData[i] || 0));
    });
    if (peak > 0.98) {
      const scale = 0.98 / peak;
      data.forEach((channelData) => {
        for (let i = 0; i < length; i += 1) channelData[i] *= scale;
      });
    }
    return data;
  }

  encodeOfflineWav(audioBuffer) {
    const channels = Math.min(2, audioBuffer.numberOfChannels || 1);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataSize = length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeString = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    const channelData = this.prepareWavChannelData(audioBuffer);
    let offset = 44;
    for (let i = 0; i < length; i += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = clamp(channelData[channel][i] || 0, -1, 1);
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async renderCutsceneMidiAudioBlob(safeDoc, durationMs, progress = null) {
    const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtor) return null;
    const resolveSong = (trackId) => (
      this.game?.preparedCutsceneAudio?.music?.get(trackId)
      || this.game?.getLibrarySong?.(trackId)
      || (() => {
        const payload = loadProjectFile('music', trackId);
        return payload?.data ? { id: trackId, name: trackId, song: payload.data } : null;
      })()
    );
    const events = collectCutsceneMidiRenderEvents(safeDoc, resolveSong);
    if (!events.length) return null;
    this.game?.audio?.ensureMidiSampler?.();
    progress?.update?.(13, 'Loading MIDI instruments...');
    const samplePromises = new Map();
    await Promise.all(events.map(async (event) => {
      const key = [event.pitch, event.program, event.channel, event.bankMSB, event.bankLSB].join(':');
      if (!samplePromises.has(key)) {
        samplePromises.set(key, this.game?.audio?.getSoundfontBufferForNote?.({
          pitch: event.pitch,
          program: event.program,
          channel: event.channel,
          bankMSB: event.bankMSB,
          bankLSB: event.bankLSB
        }).catch(() => null));
      }
      event.soundfontSample = await samplePromises.get(key);
    }));
    const sampleRate = Math.max(22050, Math.min(96000, Math.round(this.game?.audio?.ctx?.sampleRate || 44100)));
    const duration = Math.max(0.1, durationMs / 1000) + CUTSCENE_MP4_AUDIO_TAIL_SECONDS;
    const ctx = new OfflineCtor(2, Math.ceil(duration * sampleRate), sampleRate);
    const master = ctx.createGain();
    master.gain.value = clamp(this.game?.audio?.volume ?? 0.4, 0, 1) * 0.78;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    events.forEach((event) => this.scheduleOfflineMidiEvent(ctx, master, event));
    progress?.update?.(14, 'Rendering MIDI audio...');
    const rendered = await ctx.startRendering();
    return this.encodeOfflineWav(rendered);
  }

  async recordCutsceneAudioBlob(safeDoc, durationMs) {
    if (typeof MediaRecorder === 'undefined' || typeof MediaStream === 'undefined') return null;
    await this.game?.audio?.ensure?.();
    const capture = this.game?.audio?.beginMasterCapture?.({ monitor: false }) || null;
    if (!capture?.stream) return null;
    const chunks = [];
    let player = null;
    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'video/webm;codecs=opus', 'video/webm']
        .find((type) => {
          try { return MediaRecorder.isTypeSupported?.(type); } catch (_error) { return false; }
        }) || '';
      const recorder = new MediaRecorder(capture.stream, mimeType ? { mimeType, audioBitsPerSecond: 192000 } : { audioBitsPerSecond: 192000 });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data?.size) chunks.push(event.data);
        });
        recorder.addEventListener('stop', resolve, { once: true });
        recorder.addEventListener('error', (event) => reject(event.error || new Error('Movie audio recording failed')), { once: true });
      });
      player = new CutscenePlayer(this.game || {});
      player.play(safeDoc, { skippable: false, ignorePauseMarkers: true, startMs: 0 });
      recorder.start(250);
      this.advanceMovieExportAudio(player, 0);
      const start = getNowMs();
      let previousElapsed = 0;
      await new Promise((resolve) => {
        const step = () => {
          const elapsed = Math.min(durationMs, getNowMs() - start);
          this.advanceMovieExportAudio(player, (elapsed - previousElapsed) / 1000);
          previousElapsed = elapsed;
          if (elapsed >= durationMs) {
            resolve();
            return;
          }
          window.setTimeout(step, 16);
        };
        step();
      });
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      player.stop();
      player = null;
      return chunks.length ? new Blob(chunks, { type: mimeType || 'audio/webm' }) : null;
    } finally {
      player?.stop?.();
      this.game?.audio?.endMasterCapture?.(capture);
    }
  }

  async exportMovieMp4Deterministic(progress) {
    if (!this.document) this.document = createDefaultCutscene();
    const safeDoc = normalizeCutsceneDocument(this.document, this.document.name);
    const durationMs = getFullPreviewDurationMs(safeDoc);
    const fps = clamp(Math.round(safeNumber(safeDoc.fps, DEFAULT_FPS)), 12, 30);
    const layout = getCutsceneMovieExportLayout(safeDoc);
    const frameCount = Math.max(1, Math.ceil((durationMs / 1000) * fps));
    const segmentMs = CUTSCENE_EXPORT_SEGMENT_MS;
    const segmentCount = Math.max(1, Math.ceil(durationMs / segmentMs));
    const contentKey = this.getMovieExportContentKey(safeDoc, { durationMs, fps, frameCount, layout, segmentMs, segmentCount });
    progress.update(5, 'Creating export session...');
    const session = await this.createMovieExportSession({
      name: safeDoc.name || 'cutscene',
      contentKey,
      durationMs,
      fps,
      frameCount,
      segmentMs,
      segmentCount,
      sourceWidth: layout.frameWidth,
      sourceHeight: layout.frameHeight,
      outputWidth: layout.outputWidth,
      outputHeight: layout.outputHeight
    });
    if (session.outputReady) {
      progress.update(95, 'Using cached MP4...');
      return this.downloadMovieExportResult(session.id);
    }
    const canvas = document.createElement('canvas');
    canvas.width = layout.frameWidth;
    canvas.height = layout.frameHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create movie canvas.');
    ctx.imageSmoothingEnabled = false;

    progress.update(8, 'Preparing audio...');
    await this.preparePreviewAudioResources(safeDoc);
    progress.update(12, 'Rendering MIDI audio and movie segments...');
    const audioPromise = session.audioReady
      ? Promise.resolve(null)
      : this.renderCutsceneMidiAudioBlob(safeDoc, durationMs, progress)
        .catch(() => null)
        .then((blob) => blob || this.recordCutsceneAudioBlob(safeDoc, durationMs).catch(() => null));
    const runtime = this.buildMovieExportRuntime();
    const encodedSegments = new Set(Array.isArray(session.segments) ? session.segments : []);
    let completedFrames = 0;
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const segmentStartMs = segmentIndex * segmentMs;
      const segmentEndMs = Math.min(durationMs, (segmentIndex + 1) * segmentMs);
      const startFrame = Math.floor((segmentStartMs / 1000) * fps);
      const endFrame = Math.min(frameCount, Math.max(startFrame + 1, Math.ceil((segmentEndMs / 1000) * fps)));
      const segmentFrameCount = Math.max(1, endFrame - startFrame);
      if (encodedSegments.has(segmentIndex)) {
        completedFrames += segmentFrameCount;
        progress.update(16 + Math.floor((completedFrames / Math.max(1, frameCount)) * 58), `Skipping saved segment ${segmentIndex + 1} / ${segmentCount}`);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        continue;
      }
      progress.update(16 + Math.floor((completedFrames / Math.max(1, frameCount)) * 58), `Rendering segment ${segmentIndex + 1} / ${segmentCount}`);
      for (let localFrame = 0; localFrame < segmentFrameCount; localFrame += 1) {
        const globalFrame = startFrame + localFrame;
        const elapsed = Math.min(durationMs, (globalFrame / fps) * 1000);
        this.renderMovieExportFrame(ctx, safeDoc, elapsed, layout, runtime);
        const blob = await this.canvasToPngBlob(canvas);
        await this.uploadMovieExportSegmentFrame(session.id, segmentIndex, localFrame, blob);
        completedFrames += 1;
        if (localFrame % 5 === 0) {
          progress.update(16 + Math.floor((completedFrames / Math.max(1, frameCount)) * 58), `Segment ${segmentIndex + 1} / ${segmentCount}: frame ${localFrame + 1} / ${segmentFrameCount}`);
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      }
      progress.update(74, `Encoding segment ${segmentIndex + 1} / ${segmentCount}`);
      await this.encodeMovieExportSegment(session.id, segmentIndex);
      if (segmentIndex % 2 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
    progress.update(76, 'Segments checkpointed.');
    const audioBlob = await audioPromise;
    if (audioBlob?.size && !session.audioReady) {
      progress.update(82, audioBlob.type === 'audio/wav' ? 'Uploading rendered MIDI audio...' : 'Uploading captured audio...');
      await this.uploadMovieExportAudio(session.id, audioBlob);
    }
    progress.update(88, 'Finalizing MP4...');
    await this.finalizeMovieExportSession(session.id);
    progress.update(96, 'Downloading MP4...');
    return this.downloadMovieExportResult(session.id);
  }

  getMovieRecorderUnavailableMessage() {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return 'MP4 export is unavailable in this environment.';
    }
    if (typeof MediaRecorder === 'undefined') {
      return 'Movie export is not supported by this browser.';
    }
    const canvas = document.createElement('canvas');
    if (!canvas.captureStream) {
      return 'Movie export is not supported by this browser.';
    }
    if (!selectCutsceneMovieRecordingMimeType(MediaRecorder)) {
      return 'Movie export is not supported by this browser.';
    }
    return '';
  }

  async exportMovieMp4() {
    if (this.movieExportInProgress) {
      this.statusText = 'Movie export already running';
      return;
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      this.statusText = 'MP4 export is unavailable in this environment.';
      return;
    }
    this.movieExportInProgress = true;
    let progress = this.openMovieExportProgressOverlay();
    try {
      const mp4Blob = await this.exportMovieMp4Deterministic(progress);
      progress.update(100, 'MP4 ready.');
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      progress.close();
      progress = null;
      const safeDoc = normalizeCutsceneDocument(this.document, this.document?.name);
      const filename = getCutsceneMp4ExportFilename(safeDoc.name);
      this.statusText = 'MP4 ready. Choose Download.';
      const downloaded = await this.openMovieDownloadReadyOverlay(mp4Blob, filename);
      this.statusText = downloaded ? 'MP4 exported.' : 'MP4 export canceled.';
    } catch (error) {
      progress?.close();
      progress = null;
      const message = String(error?.message || error || '');
      if (/FFmpeg is not usable|Not enough free disk|INSUFFICIENT_STORAGE/i.test(message)) {
        this.statusText = `MP4 export failed: ${message}`;
        return;
      }
      this.movieExportInProgress = false;
      if (!this.getMovieRecorderUnavailableMessage()) {
        await this.exportMovieMp4MediaRecorder(error, { rethrow: false });
        return;
      }
      this.statusText = `MP4 export failed: ${message}`;
    } finally {
      this.movieExportInProgress = false;
    }
  }

  async exportMovieMp4MediaRecorder(previousError = null, options = {}) {
    const rethrow = options?.rethrow === true;
    if (this.movieExportInProgress) {
      const message = 'Movie export already running';
      this.statusText = message;
      if (rethrow) throw new Error(message);
      return;
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      const message = 'MP4 export is unavailable in this environment.';
      this.statusText = message;
      if (rethrow) throw new Error(message);
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      const message = 'Movie export is not supported by this browser.';
      this.statusText = message;
      if (rethrow) throw new Error(message);
      return;
    }
    const recordingCanvas = document.createElement('canvas');
    if (!recordingCanvas.captureStream) {
      const message = 'Movie export is not supported by this browser.';
      this.statusText = message;
      if (rethrow) throw new Error(message);
      return;
    }
    const recordingMime = selectCutsceneMovieRecordingMimeType(MediaRecorder);
    if (!recordingMime) {
      const message = 'Movie export is not supported by this browser.';
      this.statusText = message;
      if (rethrow) throw new Error(message);
      return;
    }
    if (!this.document) this.document = createDefaultCutscene();
    const safeDoc = normalizeCutsceneDocument(this.document, this.document.name);
    const durationMs = getFullPreviewDurationMs(safeDoc);
    const fps = clamp(Math.round(safeNumber(safeDoc.fps, DEFAULT_FPS)), 12, 60);
    const layout = getCutsceneMovieExportLayout(safeDoc);
    const recordingScale = Math.max(1, Math.floor(Math.min(
      5,
      1280 / Math.max(1, layout.frameWidth),
      720 / Math.max(1, layout.frameHeight)
    )));
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = layout.frameWidth;
    frameCanvas.height = layout.frameHeight;
    recordingCanvas.width = layout.frameWidth * recordingScale;
    recordingCanvas.height = layout.frameHeight * recordingScale;
    const ctx = frameCanvas.getContext('2d');
    const recordingCtx = recordingCanvas.getContext('2d');
    if (!ctx || !recordingCtx) {
      const message = 'Could not create movie canvas.';
      this.statusText = message;
      if (rethrow) throw new Error(message);
      return;
    }
    ctx.imageSmoothingEnabled = false;
    recordingCtx.imageSmoothingEnabled = false;

    this.movieExportInProgress = true;
    let progress = this.openMovieExportProgressOverlay();
    let recorder = null;
    let audioPromise = null;
    let videoStream = null;
    let wakeLock = null;
    let rejectRecording = null;
    const hiddenExportMessage = 'MP4 export interrupted because the page was hidden. Keep the screen awake while exporting.';
    let pageHiddenDuringExport = false;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pageHiddenDuringExport = true;
        try {
          if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
        } catch (_error) {}
        rejectRecording?.(new Error(hiddenExportMessage));
      }
    };
    try {
      progress.update(8, previousError ? 'Frame export failed; using fallback...' : 'Preparing movie...');
      await this.game?.audio?.ensure?.();
      await this.preparePreviewAudioResources(safeDoc);
      if (globalThis.navigator?.wakeLock?.request) {
        wakeLock = await globalThis.navigator.wakeLock.request('screen').catch(() => null);
      }
      videoStream = recordingCanvas.captureStream(0);
      const stream = new MediaStream(videoStream.getVideoTracks());
      const chunks = [];
      recorder = new MediaRecorder(stream, {
        mimeType: recordingMime,
        videoBitsPerSecond: Math.max(12000000, recordingCanvas.width * recordingCanvas.height * fps * 0.35)
      });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data?.size) chunks.push(event.data);
        });
        recorder.addEventListener('stop', resolve, { once: true });
        recorder.addEventListener('error', (event) => reject(event.error || new Error('Movie recording failed')), { once: true });
      });
      const runtime = this.buildMovieExportRuntime();
      recorder.start(250);
      audioPromise = this.renderCutsceneMidiAudioBlob(safeDoc, durationMs, progress)
        .catch(() => null)
        .then((blob) => blob || this.recordCutsceneAudioBlob(safeDoc, durationMs).catch(() => null));
      const start = getNowMs();
      let lastProgressAt = 0;
      const videoTrack = videoStream.getVideoTracks()[0];
      progress.update(15, 'Recording...');
      document.addEventListener('visibilitychange', handleVisibilityChange);
      await new Promise((resolve, reject) => {
        rejectRecording = reject;
        const render = () => {
          if (pageHiddenDuringExport || document.hidden) {
            reject(new Error(hiddenExportMessage));
            return;
          }
          const elapsed = Math.min(durationMs, getNowMs() - start);
          this.renderMovieExportFrame(ctx, safeDoc, elapsed, layout, runtime);
          recordingCtx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
          recordingCtx.drawImage(frameCanvas, 0, 0, recordingCanvas.width, recordingCanvas.height);
          videoTrack?.requestFrame?.();
          if (elapsed - lastProgressAt >= 250 || elapsed >= durationMs) {
            lastProgressAt = elapsed;
            progress.update(15 + Math.floor((elapsed / Math.max(1, durationMs)) * 65), `Recording ${Math.round(elapsed)}ms / ${Math.round(durationMs)}ms`);
          }
          if (elapsed >= durationMs) {
            resolve();
            return;
          }
          window.requestAnimationFrame(render);
        };
        render();
      });
      rejectRecording = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      videoStream.getTracks().forEach((track) => track.stop?.());
      videoStream = null;
      if (!chunks.length) throw new Error('Movie recorder produced no video data.');
      const sourceBlob = new Blob(chunks, { type: recordingMime });
      progress.update(82, 'Finishing audio...');
      const audioBlob = await audioPromise;
      progress.update(88, 'Encoding MP4...');
      const mp4Blob = await this.transcodeMovieRecordingToMp4({ videoBlob: sourceBlob, audioBlob });
      progress.update(100, 'MP4 ready.');
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      progress.close();
      progress = null;
      const filename = getCutsceneMp4ExportFilename(safeDoc.name);
      this.statusText = 'MP4 ready. Choose Download.';
      const downloaded = await this.openMovieDownloadReadyOverlay(mp4Blob, filename);
      this.statusText = downloaded ? 'MP4 exported.' : 'MP4 export canceled.';
    } catch (error) {
      progress?.close();
      this.statusText = `MP4 export failed: ${error?.message || error}`;
      if (rethrow) throw error;
    } finally {
      rejectRecording = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      this.movieExportInProgress = false;
      try {
        if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
      } catch (_error) {}
      videoStream?.getTracks?.().forEach((track) => track.stop?.());
      try {
        const releaseWakeLock = wakeLock?.release?.();
        releaseWakeLock?.catch?.(() => {});
      } catch (_error) {}
    }
  }

  captureHistory(label = 'Edit') {
    const document = JSON.stringify(this.document);
    this.history.push({
      label,
      document,
      byteSize: document.length,
      selectedClipId: this.selectedClipId,
      selectedTrackId: this.selectedTrackId,
      selectedKeyframe: this.selectedKeyframe ? { ...this.selectedKeyframe } : null,
      playheadMs: this.playheadMs
    });
    this.trimHistoryMemory(this.history);
    this.redoStack = [];
  }

  trimHistoryMemory(stack = this.history) {
    while (stack.length > this.historyLimit) stack.shift();
    let total = stack.reduce((sum, entry) => sum + safeNumber(entry?.byteSize, String(entry?.document || '').length), 0);
    while (stack.length > 1 && total > this.historyByteLimit) {
      const removed = stack.shift();
      total -= safeNumber(removed?.byteSize, String(removed?.document || '').length);
    }
  }

  restoreSnapshot(snapshot) {
    if (!snapshot?.document) return;
    this.document = normalizeCutsceneDocument(JSON.parse(snapshot.document), this.document?.name);
    this.selectedClipId = snapshot.selectedClipId || this.document.clips[0]?.id || null;
    this.selectedTrackId = snapshot.selectedTrackId || null;
    this.selectedKeyframe = snapshot.selectedKeyframe ? { ...snapshot.selectedKeyframe } : null;
    this.playheadMs = clamp(snapshot.playheadMs || 0, 0, this.document.durationMs);
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) {
      this.statusText = 'Nothing to undo';
      return;
    }
    const document = JSON.stringify(this.document);
    this.redoStack.push({
      document,
      byteSize: document.length,
      selectedClipId: this.selectedClipId,
      selectedTrackId: this.selectedTrackId,
      selectedKeyframe: this.selectedKeyframe ? { ...this.selectedKeyframe } : null,
      playheadMs: this.playheadMs
    });
    this.trimHistoryMemory(this.redoStack);
    this.restoreSnapshot(previous);
    this.statusText = `Undo ${previous.label || ''}`.trim();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) {
      this.statusText = 'Nothing to redo';
      return;
    }
    const document = JSON.stringify(this.document);
    this.history.push({
      document,
      byteSize: document.length,
      selectedClipId: this.selectedClipId,
      selectedTrackId: this.selectedTrackId,
      selectedKeyframe: this.selectedKeyframe ? { ...this.selectedKeyframe } : null,
      playheadMs: this.playheadMs
    });
    this.trimHistoryMemory(this.history);
    this.restoreSnapshot(next);
    this.statusText = 'Redo';
  }

  async requestText({ title, label, initialValue, placeholder = '', fallback = '', inputType = 'text', confirmText = 'Apply', multiline = false, rows = 6 }) {
    if (typeof document === 'undefined') return initialValue || fallback;
    const value = await openTextInputOverlay({
      title,
      label,
      initialValue,
      placeholder,
      inputType,
      confirmText,
      multiline,
      rows
    });
    return value == null ? null : String(value);
  }

  async newDocument() {
    const name = await this.requestText({
      title: 'New Cutscene',
      label: 'Name',
      initialValue: DEFAULT_CUTSCENE_NAME,
      fallback: DEFAULT_CUTSCENE_NAME
    }) || DEFAULT_CUTSCENE_NAME;
    this.applyDocument(createDefaultCutscene(name), name);
    this.currentDocumentRef = null;
  }

  async openDocument() {
    if (typeof document === 'undefined') {
      this.statusText = 'Open is unavailable in this environment';
      return;
    }
    await hydrateServerStorage().catch(() => null);
    const result = await openProjectBrowser({ folders: ['cutscenes'], fixedFolder: 'cutscenes' });
    const payload = result?.payload || (result?.name ? loadProjectFile('cutscenes', result.name) : null);
    if (!payload?.data) return;
    this.applyDocument(payload.data, result.name);
    this.currentDocumentRef = { folder: 'cutscenes', name: result.name };
  }

  async saveDocument({ forceSaveAs = false } = {}) {
    const existing = this.currentDocumentRef?.name || this.document.name || DEFAULT_CUTSCENE_NAME;
    let name = sanitizeProjectFileName(existing);
    if (forceSaveAs) {
      const result = await openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: 'cutscenes',
        initialFolder: 'cutscenes',
        initialName: existing,
        title: 'Save Cutscene As'
      });
      if (!result?.name) return;
      name = sanitizeProjectFileName(result.name);
    } else if (!this.currentDocumentRef?.name || name === DEFAULT_CUTSCENE_NAME) {
      const requested = await this.requestText({
        title: 'Save Cutscene',
        label: 'Name',
        initialValue: name || existing,
        fallback: name || DEFAULT_CUTSCENE_NAME,
        confirmText: 'Save'
      });
      name = sanitizeProjectFileName(requested || name || existing);
    }
    if (!name) return;
    this.document.name = name;
    this.statusText = `Saving ${name}...`;
    try {
      await saveProjectFileAndConfirm('cutscenes', name, this.document);
      this.currentDocumentRef = { folder: 'cutscenes', name };
      this.statusText = `Saved ${name}`;
    } catch (error) {
      discardCachedProjectFile('cutscenes', name);
      this.statusText = `Save failed: ${error?.message || error}`;
    }
  }

  async addTextClip() {
    const text = await this.requestText({
      title: 'Add Text',
      label: 'Text',
      initialValue: 'Meanwhile...',
      fallback: 'Meanwhile...',
      inputType: 'textarea',
      multiline: true,
      rows: 8,
      confirmText: 'Add'
    }) || 'Meanwhile...';
    this.captureHistory('Add text');
    const textBounds = estimateCutsceneTextBounds(text, this.document, 8);
    const clip = normalizeCutsceneClip({
      id: makeId('text'),
      type: 'text',
      layerId: 'text',
      text,
      fontSize: 8,
      startMs: this.playheadMs,
      durationMs: 1800,
      animation: 'typewriter',
      x: this.document.width / 2,
      y: clamp(this.document.height - textBounds.h / 2 - 12, textBounds.h / 2, this.document.height - textBounds.h / 2),
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: textBounds.w,
      h: textBounds.h,
      fadeInMs: 250
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, 'Text');
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.statusText = 'Added text clip';
  }

  async addColorBoardClip() {
    const value = await this.openColorPicker({
      title: 'Color Board',
      initialValue: '#000000'
    });
    const color = normalizeHexColor(value) || '#000000';
    this.captureHistory('Add color board');
    const clip = normalizeCutsceneClip({
      id: makeId('color-board'),
      type: 'color-board',
      layerId: 'sprites',
      color,
      startMs: this.playheadMs,
      durationMs: 2400,
      x: this.document.width / 2,
      y: this.document.height / 2,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      aspectLocked: true,
      rotation: 0,
      opacity: 1,
      w: this.document.width,
      h: this.document.height
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, 'Board');
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.menuOpen = false;
    this.statusText = `Added board ${color}`;
  }

  async addArtClip() {
    const files = listProjectFiles('art').map((entry) => entry.name).filter(Boolean);
    const ref = typeof document === 'undefined'
      ? files[0]
      : await openChoiceOverlay({
        title: 'Choose Art',
        choices: files.map((name, index) => ({ label: name, value: name, primary: index === 0 })),
        cancelText: 'Cancel'
      });
    if (!ref) {
      this.statusText = 'No art selected';
      return;
    }
    this.captureHistory('Add art');
    const asset = { id: makeId('art-asset'), type: 'art', name: ref, ref };
    this.document.assets.push(asset);
    const artDims = getArtDocumentDimensions(ref);
    const fitted = artDims ? computeCutsceneFitDimensions(artDims.width, artDims.height, this.document) : { width: 96, height: 72 };
    const clip = normalizeCutsceneClip({
      id: makeId('art'),
      type: 'art',
      layerId: 'sprites',
      assetId: asset.id,
      assetRef: ref,
      startMs: this.playheadMs,
      durationMs: 2400,
      x: this.document.width / 2,
      y: this.document.height / 2,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      aspectLocked: true,
      rotation: 0,
      opacity: 1,
      w: fitted.width,
      h: fitted.height
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, ref);
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.menuOpen = false;
    this.statusText = `Added art ${ref}`;
  }

  getActorStateOptions(actorData) {
    return (Array.isArray(actorData?.states) ? actorData.states : [])
      .filter((state) => state && (state.animation?.artRef || state.animation?.imageDataUrl || (Array.isArray(state.animation?.frames) && state.animation.frames.length)))
      .map((state, index) => ({
        id: state.id || state.name || `state-${index}`,
        label: state.name || state.id || `State ${index + 1}`,
        animation: state.animation || {}
      }));
  }

  async addActorClip() {
    const files = listProjectFiles('actors').map((entry) => entry.name).filter(Boolean);
    const ref = typeof document === 'undefined'
      ? files[0]
      : await openChoiceOverlay({
        title: 'Choose Actor',
        choices: files.map((name, index) => ({ label: name, value: name, primary: index === 0 })),
        cancelText: 'Cancel'
      });
    if (!ref) {
      this.statusText = 'No actor selected';
      return;
    }
    const payload = loadProjectFile('actors', ref);
    const states = this.getActorStateOptions(payload?.data);
    const stateId = typeof document === 'undefined'
      ? states[0]?.id
      : await openChoiceOverlay({
        title: 'Choose Actor State',
        choices: states.map((state, index) => ({ label: state.label, value: state.id, primary: index === 0 })),
        cancelText: 'Cancel'
      });
    if (!stateId) {
      this.statusText = 'No actor state selected';
      return;
    }
    const state = states.find((entry) => entry.id === stateId) || states[0];
    this.captureHistory('Add actor');
    const asset = { id: makeId('actor-asset'), type: 'actor', name: ref, ref, actorRef: ref };
    this.document.assets.push(asset);
    const dims = resolveCutsceneActorVisualDimensions(payload?.data, stateId);
    const clip = normalizeCutsceneClip({
      id: makeId('actor'),
      type: 'actor',
      layerId: 'sprites',
      assetId: asset.id,
      actorRef: ref,
      stateId,
      startMs: this.playheadMs,
      durationMs: 2400,
      playAnimation: true,
      loopAnimation: true,
      stateEvents: [{ timeMs: 0, stateId, playAnimation: true, loopAnimation: true, animationSpeed: 1, animationStartMs: 0 }],
      x: this.document.width / 2,
      y: this.document.height / 2,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: dims.width,
      h: dims.height
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, ref);
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.menuOpen = false;
    this.statusText = `Added actor ${ref}`;
  }

  importImageClip() {
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      this.statusText = 'Image import is unavailable in this environment';
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        this.captureHistory('Import image');
        const dataUrl = String(reader.result || '');
        const dims = await getImageDataUrlDimensions(dataUrl);
        const fitted = computeCutsceneFitDimensions(dims?.width || this.document.width, dims?.height || this.document.height, this.document);
        const asset = { id: `asset-${Date.now()}`, type: 'image', name: file.name, dataUrl, width: dims?.width || 0, height: dims?.height || 0 };
        this.document.assets.push(asset);
        const clip = normalizeCutsceneClip({
          id: makeId('image'),
          type: 'image',
          layerId: 'sprites',
          assetId: asset.id,
          startMs: this.playheadMs,
          durationMs: 2400,
          x: this.document.width / 2,
          y: this.document.height / 2,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
          aspectLocked: true,
          rotation: 0,
          opacity: 1,
          w: fitted.width,
          h: fitted.height
        }, this.document, this.document.clips.length);
        this.ensureTrackForClip(clip, file.name);
        this.document.clips.push(clip);
        this.selectedClipId = clip.id;
        this.selectedTrackId = null;
        this.menuOpen = false;
        this.statusText = `Imported ${file.name}`;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }

  async addAudioClip(type) {
    const folder = type === 'music' ? 'music' : 'sfx';
    const files = listProjectFiles(folder).map((entry) => entry.name).filter(Boolean);
    const first = files[0] || '';
    const ref = typeof document === 'undefined'
      ? first
      : await openChoiceOverlay({
        title: type === 'music' ? 'Choose Music' : 'Choose SFX',
        choices: files.map((name, index) => ({ label: name, value: name, primary: index === 0 })),
        cancelText: 'Cancel'
      });
    if (!ref) return;
    this.captureHistory(`Add ${type}`);
    const asset = { id: makeId(type), type, name: ref, ref };
    this.document.assets.push(asset);
    const clip = normalizeCutsceneClip({
      id: makeId(`${type}-clip`),
      type,
      layerId: 'audio',
      assetId: asset.id,
      startMs: this.playheadMs,
      durationMs: type === 'music' ? 2400 : 500,
      loop: false,
      volume: 1,
      fadeMs: type === 'music' ? 250 : 0
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, ref);
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.menuOpen = false;
    this.statusText = `Added ${type.toUpperCase()} cue`;
  }

  async addEffectClip() {
    const effectType = typeof document === 'undefined'
      ? 'rain'
      : await openChoiceOverlay({
        title: 'Choose Effect',
        choices: CUTSCENE_EFFECT_TYPES.map((value, index) => ({
          label: value,
          value,
          primary: index === 0
        })),
        cancelText: 'Cancel'
      });
    if (!effectType) return;
    this.captureHistory('Add effect');
    const clip = normalizeCutsceneClip({
      id: makeId('effect'),
      type: 'effect',
      layerId: 'effects',
      startMs: this.playheadMs,
      durationMs: Math.max(1200, Math.min(3000, this.document.durationMs - this.playheadMs || 2400)),
      effectType,
      intensity: 1,
      wind: effectType === 'hurricane' || effectType === 'blizzard' ? -1.5 : 0
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, effectType);
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.menuOpen = false;
    this.statusText = `Added ${effectType}`;
  }

  addPauseClip() {
    this.captureHistory('Add pause');
    const clip = normalizeCutsceneClip({
      id: makeId('pause'),
      type: 'pause',
      layerId: 'audio',
      startMs: this.playheadMs,
      durationMs: 0,
      prompt: 'Press a button',
      waitForInput: true
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip, 'Pause');
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.menuOpen = false;
    this.statusText = 'Added pause marker';
  }

  async editSelectedEffectType() {
    const clip = this.getSelectedClip();
    if (!isEffectClip(clip)) return;
    const current = CUTSCENE_EFFECT_TYPES.includes(clip.effectType) ? clip.effectType : 'rain';
    const effectType = typeof document === 'undefined'
      ? current
      : await openChoiceOverlay({
        title: 'Effect Type',
        choices: CUTSCENE_EFFECT_TYPES.map((value) => ({
          label: value,
          value,
          primary: value === current
        })),
        cancelText: 'Cancel'
      });
    if (!effectType) return;
    this.captureHistory('Effect type');
    clip.effectType = effectType;
    this.statusText = `Effect ${effectType}`;
  }

  async editSelectedEffectNumber(field, title, fallback = 0) {
    const clip = this.getSelectedClip();
    if (!isEffectClip(clip)) return;
    const target = this.getEditableEffectState(clip) || clip;
    const value = await this.requestText({
      title,
      label: field === 'intensity' ? '0-4' : '-4 to 4',
      initialValue: String(safeNumber(target[field], fallback)),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory(title);
    if (field === 'intensity') target[field] = clamp(safeNumber(value, fallback), 0, 4);
    else target[field] = clamp(safeNumber(value, fallback), -4, 4);
    this.statusText = `${title}: ${target[field]}`;
  }

  getActiveKeyframe(clip) {
    if (!isKeyframeClip(clip) || !Array.isArray(clip.keyframes) || !clip.keyframes.length) return null;
    const selected = this.getSelectedKeyframe(clip);
    if (selected) return selected;
    if (this.keyframeMode === 'start') return clip.keyframes[0];
    if (this.keyframeMode === 'end') return clip.keyframes[clip.keyframes.length - 1];
    const local = clamp(this.playheadMs - clip.startMs, 0, Math.max(1, clip.durationMs));
    return clip.keyframes.find((keyframe) => Math.round(keyframe.timeMs) === Math.round(local)) || null;
  }

  getEditableTransform(clip = this.getSelectedClip()) {
    if (!isVisualClip(clip)) return null;
    return this.getSelectedKeyframe(clip) || clip;
  }

  getEditableEffectState(clip = this.getSelectedClip()) {
    if (!isEffectClip(clip)) return null;
    return this.getSelectedKeyframe(clip) || clip;
  }

  setSelectedKeyframe(which, options = {}) {
    const clip = this.getSelectedClip();
    if (!isKeyframeClip(clip)) {
      this.statusText = 'Select artwork, text, or FX first';
      return;
    }
    const { capture = true, closeMenu = true } = options;
    if (closeMenu) this.menuOpen = false;
    if (capture) this.captureHistory(`Set ${which}`);
    const localTime = which === 'end'
      ? Math.max(1, clip.durationMs)
      : which === 'playhead'
        ? clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs))
        : 0;
    if (isEffectClip(clip)) {
      const current = sampleCutsceneEffectClip(clip, this.playheadMs) || clip;
      const applyEffect = (target) => {
        target.opacity = clamp(safeNumber(current.opacity, clip.opacity ?? 1), 0, 1);
        target.intensity = clamp(safeNumber(current.intensity, clip.intensity ?? 1), 0, 4);
        target.wind = clamp(safeNumber(current.wind, clip.wind ?? 0), -4, 4);
      };
      if (localTime <= 0) {
        if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
        applyEffect(clip);
        clip.keyframes = clip.keyframes.filter((keyframe) => Math.round(safeNumber(keyframe.timeMs)) !== 0);
        this.selectedKeyframe = null;
        this.playheadMs = clamp(clip.startMs, 0, this.document.durationMs);
        this.statusText = 'Set hidden FX start';
        return;
      }
      const next = { timeMs: localTime, manual: true };
      applyEffect(next);
      if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
      const index = clip.keyframes.findIndex((keyframe) => keyframe.timeMs === localTime);
      if (index >= 0) clip.keyframes[index] = next;
      else clip.keyframes.push(next);
      clip.keyframes.sort((a, b) => a.timeMs - b.timeMs);
      this.selectKeyframe(clip, localTime);
      this.playheadMs = clamp(clip.startMs + localTime, 0, this.document.durationMs);
      this.statusText = `Set ${which} FX keyframe`;
      return;
    }
    if (isAudioClip(clip)) {
      const currentVolume = sampleCutsceneAudioVolume(clip, clamp(this.playheadMs, clip.startMs, getClipEndMs(clip)));
      if (localTime <= 0) {
        if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
        clip.volume = currentVolume;
        clip.keyframes = clip.keyframes.filter((keyframe) => Math.round(safeNumber(keyframe.timeMs)) !== 0);
        this.selectedKeyframe = null;
        this.playheadMs = clamp(clip.startMs, 0, this.document.durationMs);
        this.statusText = 'Set hidden audio start';
        return;
      }
      const next = { timeMs: localTime, manual: true, volume: currentVolume };
      if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
      const index = clip.keyframes.findIndex((keyframe) => keyframe.timeMs === localTime);
      if (index >= 0) clip.keyframes[index] = next;
      else clip.keyframes.push(next);
      clip.keyframes.sort((a, b) => a.timeMs - b.timeMs);
      this.selectKeyframe(clip, localTime);
      this.playheadMs = clamp(clip.startMs + localTime, 0, this.document.durationMs);
      this.statusText = `Set ${which} audio keyframe`;
      return;
    }
    const current = sampleCutsceneClip(clip, this.playheadMs) || clip.keyframes[0] || {};
    const applyTransform = (target) => {
      target.x = safeNumber(current.x, this.document.width / 2);
      target.y = safeNumber(current.y, this.document.height / 2);
      target.scale = Math.max(0.05, safeNumber(current.scale, 1));
      target.scaleX = getScaleX(current);
      target.scaleY = getScaleY(current);
      target.aspectLocked = clip.aspectLocked !== false;
      target.rotation = safeNumber(current.rotation, 0);
      target.opacity = clamp(safeNumber(current.opacity, 1), 0, 1);
      target.w = Math.max(1, safeNumber(current.w, clip.type === 'text' ? 180 : 96));
      target.h = Math.max(1, safeNumber(current.h, clip.type === 'text' ? 40 : 72));
    };
    if (localTime <= 0) {
      if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
      applyTransform(clip);
      clip.keyframes = clip.keyframes.filter((keyframe) => Math.round(safeNumber(keyframe.timeMs)) !== 0);
      this.selectedKeyframe = null;
      this.playheadMs = clamp(clip.startMs, 0, this.document.durationMs);
      this.statusText = 'Set hidden start pose';
      return;
    }
    const next = {
      timeMs: localTime,
      manual: true
    };
    applyTransform(next);
    if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
    const index = clip.keyframes.findIndex((keyframe) => keyframe.timeMs === localTime);
    if (index >= 0) clip.keyframes[index] = next;
    else clip.keyframes.push(next);
    clip.keyframes.sort((a, b) => a.timeMs - b.timeMs);
    this.selectKeyframe(clip, localTime);
    this.playheadMs = clamp(clip.startMs + localTime, 0, this.document.durationMs);
    this.statusText = `Set ${which} keyframe`;
  }

  deleteSelectedKeyframe() {
    const clip = this.getSelectedClip();
    if (!isKeyframeClip(clip) || !Array.isArray(clip.keyframes)) {
      this.statusText = 'Select a keyframe first';
      return;
    }
    const keyframe = this.getSelectedKeyframe(clip);
    if (!keyframe) {
      this.statusText = 'Select a keyframe first';
      return;
    }
    this.captureHistory('Delete keyframe');
    clip.keyframes = clip.keyframes.filter((entry) => entry !== keyframe);
    this.selectedKeyframe = null;
    this.statusText = 'Deleted keyframe';
  }

  cycleKeyframeMode() {
    const index = KEYFRAME_MODES.indexOf(this.keyframeMode);
    this.keyframeMode = KEYFRAME_MODES[(index + 1) % KEYFRAME_MODES.length];
    const clip = this.getSelectedClip();
    if (isKeyframeClip(clip)) {
      if (this.keyframeMode === 'start') this.selectKeyframe(clip, 0);
      else if (this.keyframeMode === 'end') this.selectKeyframe(clip, clip.durationMs);
      else {
        const local = clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs));
        this.selectKeyframe(clip, local);
      }
    }
    this.statusText = `Keyframe mode: ${this.getKeyframeModeLabel()}`;
  }

  cycleSelectedEasing() {
    const clip = this.getSelectedClip();
    if (!isKeyframeClip(clip)) return;
    this.captureHistory('Change easing');
    const index = KEYFRAME_EASING.indexOf(clip.easing);
    clip.easing = KEYFRAME_EASING[(index + 1) % KEYFRAME_EASING.length];
    this.statusText = `Easing: ${this.getEasingLabel(clip.easing)}`;
  }

  toggleSelectedLoop() {
    const clip = this.getSelectedClip();
    if (!isAudioClip(clip)) return;
    this.captureHistory('Toggle loop');
    clip.loop = !clip.loop;
    this.statusText = clip.loop ? 'Loop enabled' : 'Loop disabled';
  }

  async editSelectedFadeVisual(which) {
    const clip = this.getSelectedClip();
    if (!isVisualClip(clip)) return;
    const prop = which === 'out' ? 'fadeOutMs' : 'fadeInMs';
    const value = await this.requestText({
      title: which === 'out' ? 'Fade Out' : 'Fade In',
      label: 'Milliseconds',
      initialValue: String(clip[prop] || 0),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory(`Fade ${which}`);
    clip[prop] = Math.max(0, Math.round(safeNumber(value, clip[prop] || 0)));
  }

  async editSelectedTextContent() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = await this.requestText({
      title: 'Edit Text',
      label: 'Text',
      initialValue: clip.text || '',
      fallback: clip.text || '',
      inputType: 'textarea',
      multiline: true,
      rows: 8
    });
    if (value == null) return;
    this.captureHistory('Edit text');
    clip.text = String(value);
    const textBounds = estimateCutsceneTextBounds(clip.text, this.document, clip.fontSize || 8);
    clip.w = Math.max(safeNumber(clip.w, 0), textBounds.w);
    clip.h = Math.max(safeNumber(clip.h, 0), textBounds.h);
    const clamped = clampCutscenePointForClip({ x: clip.x, y: clip.y }, clip, clip, this.document);
    clip.x = clamped.x;
    clip.y = clamped.y;
    this.statusText = 'Updated text';
  }

  async editSelectedTextColor() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = await this.openColorPicker({
      title: 'Text Color',
      initialValue: clip.color || '#ffffff'
    });
    const color = normalizeHexColor(value);
    if (!color) return;
    this.captureHistory('Text color');
    clip.color = color;
    this.statusText = `Text ${color}`;
  }

  toggleSelectedTextBorder() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    this.captureHistory('Toggle text border');
    clip.textBorderEnabled = clip.textBorderEnabled === false;
    this.statusText = clip.textBorderEnabled ? 'Text border on' : 'Text border off';
  }

  async editSelectedTextBorderColor() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = await this.openColorPicker({
      title: 'Border Color',
      initialValue: clip.textBorderColor || '#000000'
    });
    const color = normalizeHexColor(value);
    if (!color) return;
    this.captureHistory('Text border color');
    clip.textBorderColor = color;
    this.statusText = `Border ${color}`;
  }

  async editSelectedTextBorderSize() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = await this.requestText({
      title: 'Border Size',
      label: 'Pixels',
      initialValue: String(clip.textBorderSize ?? 1),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Text border size');
    clip.textBorderSize = clamp(Math.round(safeNumber(value, clip.textBorderSize ?? 1)), 0, 4);
    if (clip.textBorderSize > 0) clip.textBorderEnabled = true;
    this.statusText = `Border ${clip.textBorderSize}`;
  }

  async editSelectedBoardColor() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'color-board') return;
    const value = await this.openColorPicker({
      title: 'Board Color',
      initialValue: normalizeHexColor(clip.color) || '#000000'
    });
    const color = normalizeHexColor(value);
    if (!color) return;
    this.captureHistory('Board color');
    clip.color = color;
    this.statusText = `Board ${color}`;
  }

  async editSelectedFontSize() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = await this.requestText({
      title: 'Font Size',
      label: 'Pixels',
      initialValue: String(clip.fontSize || 18),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Font size');
    clip.fontSize = clamp(Math.round(safeNumber(value, clip.fontSize || 18)), 8, 64);
    this.statusText = `Font ${clip.fontSize}`;
  }

  async editSelectedFontFamily() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = typeof document === 'undefined'
      ? clip.fontFamily
      : await openChoiceOverlay({
        title: 'Pixel Font',
        choices: [
          { label: 'Terminal', value: 'terminal', primary: clip.fontFamily !== 'block' },
          { label: 'Block', value: 'block', primary: clip.fontFamily === 'block' }
        ],
        cancelText: 'Cancel'
      });
    if (!value) return;
    this.captureHistory('Pixel font');
    clip.fontFamily = value;
    this.statusText = `Font ${value}`;
  }

  async editSelectedTextAlign() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = typeof document === 'undefined'
      ? clip.textAlign
      : await openChoiceOverlay({
        title: 'Text Align',
        choices: [
          { label: 'Left', value: 'left', primary: clip.textAlign === 'left' },
          { label: 'Center', value: 'center', primary: clip.textAlign === 'center' },
          { label: 'Right', value: 'right', primary: clip.textAlign === 'right' }
        ],
        cancelText: 'Cancel'
      });
    if (!['left', 'center', 'right'].includes(value)) return;
    this.captureHistory('Text align');
    clip.textAlign = value;
    this.statusText = `Align ${value}`;
  }

  async editSelectedRevealSpeed() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'text') return;
    const value = await this.requestText({
      title: 'Reveal Speed',
      label: 'Chars/sec',
      initialValue: String(clip.revealSpeed || 30),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Reveal speed');
    clip.animation = 'typewriter';
    clip.revealSpeed = clamp(Math.round(safeNumber(value, clip.revealSpeed || 30)), 1, 120);
    this.statusText = `Reveal ${clip.revealSpeed} cps`;
  }

  async editSelectedScale() {
    const clip = this.getSelectedClip();
    const keyframe = this.getEditableTransform(clip);
    if (!isVisualClip(clip) || !keyframe) return;
    const value = await this.requestText({
      title: 'Scale',
      label: 'Multiplier',
      initialValue: String(Math.round(safeNumber(keyframe.scale, 1) * 100) / 100),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Scale clip');
    keyframe.scale = clamp(safeNumber(value, keyframe.scale || 1), 0.05, 12);
    this.statusText = `Scale ${Math.round(keyframe.scale * 100)}%`;
  }

  async editSelectedAxisScale(axis) {
    const clip = this.getSelectedClip();
    const keyframe = this.getEditableTransform(clip);
    if (!isVisualClip(clip) || !keyframe) return;
    const field = axis === 'y' ? 'scaleY' : 'scaleX';
    const value = await this.requestText({
      title: axis === 'y' ? 'Scale Y' : 'Scale X',
      label: 'Multiplier',
      initialValue: String(Math.round(safeNumber(keyframe[field], 1) * 100) / 100),
      inputType: 'number'
    });
    if (value == null) return;
    const next = clamp(safeNumber(value, keyframe[field] || 1), 0.05, 12);
    this.captureHistory(axis === 'y' ? 'Scale Y' : 'Scale X');
    keyframe[field] = next;
    if (clip.aspectLocked !== false) {
      keyframe.scaleX = next;
      keyframe.scaleY = next;
    }
    this.statusText = `${axis === 'y' ? 'Y' : 'X'} ${Math.round(next * 100)}%`;
  }

  toggleSelectedAspectLock() {
    const clip = this.getSelectedClip();
    const keyframe = this.getEditableTransform(clip);
    if (!isVisualClip(clip) || !keyframe) return;
    this.captureHistory('Aspect lock');
    clip.aspectLocked = clip.aspectLocked === false;
    if (clip.aspectLocked !== false) {
      const next = Math.max(getScaleX(keyframe), getScaleY(keyframe));
      keyframe.scaleX = next;
      keyframe.scaleY = next;
    }
    this.statusText = clip.aspectLocked === false ? 'Ratio free' : 'Ratio locked';
  }

  async editSelectedRotation() {
    const clip = this.getSelectedClip();
    const keyframe = this.getEditableTransform(clip);
    if (!isVisualClip(clip) || !keyframe) return;
    const value = await this.requestText({
      title: 'Rotate',
      label: 'Degrees',
      initialValue: String(Math.round(safeNumber(keyframe.rotation, 0) * 180 / Math.PI)),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Rotate clip');
    keyframe.rotation = safeNumber(value, 0) * Math.PI / 180;
    this.statusText = `Rotate ${Math.round(safeNumber(value, 0))}deg`;
  }

  async editSelectedOpacity() {
    const clip = this.getSelectedClip();
    if (isEffectClip(clip)) {
      const target = this.getEditableEffectState(clip) || clip;
      const value = await this.requestText({
        title: 'Opacity',
        label: 'Percent',
        initialValue: String(Math.round(clamp(safeNumber(target.opacity, 1), 0, 1) * 100)),
        inputType: 'number'
      });
      if (value == null) return;
      this.captureHistory('Opacity');
      target.opacity = clamp(safeNumber(value, Math.round(clamp(safeNumber(target.opacity, 1), 0, 1) * 100)) / 100, 0, 1);
      this.statusText = `Opacity ${Math.round(target.opacity * 100)}%`;
      return;
    }
    const keyframe = this.getEditableTransform(clip);
    if (!isVisualClip(clip) || !keyframe) return;
    const value = await this.requestText({
      title: 'Opacity',
      label: 'Percent',
      initialValue: String(Math.round(clamp(safeNumber(keyframe.opacity, 1), 0, 1) * 100)),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Opacity');
    keyframe.opacity = clamp(safeNumber(value, Math.round(clamp(safeNumber(keyframe.opacity, 1), 0, 1) * 100)) / 100, 0, 1);
    this.statusText = `Opacity ${Math.round(keyframe.opacity * 100)}%`;
  }

  resetSelectedTransform() {
    const clip = this.getSelectedClip();
    const keyframe = this.getEditableTransform(clip);
    if (!isVisualClip(clip) || !keyframe) return;
    this.captureHistory('Reset transform');
    keyframe.scale = 1;
    keyframe.scaleX = 1;
    keyframe.scaleY = 1;
    keyframe.rotation = 0;
    clip.fx = normalizeCutsceneFx({ type: 'none' });
    this.statusText = 'Reset transform';
  }

  async editSelectedFx() {
    const clip = this.getSelectedClip();
    if (!isVisualClip(clip)) return;
    const current = normalizeCutsceneFx(clip.fx);
    const type = typeof document === 'undefined'
      ? current.type
      : await openChoiceOverlay({
        title: 'Visual FX',
        choices: CUTSCENE_FX_TYPES.map((value) => ({
          label: value === 'none' ? 'None' : value,
          value,
          primary: value === current.type
        })),
        cancelText: 'Cancel'
      });
    if (!type) return;
    const amountValue = type === 'none' ? '0' : await this.requestText({
      title: 'FX Amount',
      label: type === 'shear' ? 'Shear amount' : 'Wave amount',
      initialValue: String(current.amount || 0.2),
      inputType: 'number'
    });
    if (amountValue == null) return;
    const frequencyValue = type === 'none' ? String(current.frequency || 2) : await this.requestText({
      title: 'FX Frequency',
      label: 'Cycles',
      initialValue: String(current.frequency || 2),
      inputType: 'number'
    });
    if (frequencyValue == null) return;
    const speedValue = type === 'none' ? String(current.speed || 1) : await this.requestText({
      title: 'FX Speed',
      label: 'Cycles/sec',
      initialValue: String(current.speed || 1),
      inputType: 'number'
    });
    if (speedValue == null) return;
    this.captureHistory('Visual FX');
    clip.fx = normalizeCutsceneFx({
      type,
      amount: safeNumber(amountValue, current.amount),
      frequency: safeNumber(frequencyValue, current.frequency),
      speed: safeNumber(speedValue, current.speed),
      phase: current.phase
    });
    this.statusText = type === 'none' ? 'FX off' : `FX ${type}`;
  }

  toggleSelectedAnimationPlayback() {
    const clip = this.getSelectedClip();
    if (!isVisualClip(clip)) return;
    this.captureHistory('Toggle animation');
    clip.playAnimation = !clip.playAnimation;
    this.statusText = clip.playAnimation ? 'Animation plays' : 'Animation holds';
  }

  toggleSelectedAnimationLoop() {
    const clip = this.getSelectedClip();
    if (!isVisualClip(clip)) return;
    this.captureHistory('Toggle animation loop');
    clip.loopAnimation = !clip.loopAnimation;
    this.statusText = clip.loopAnimation ? 'Animation loops' : 'Animation plays once';
  }

  async editSelectedAnimationSpeed() {
    const clip = this.getSelectedClip();
    if (!isVisualClip(clip)) return;
    const value = await this.requestText({
      title: 'Animation Speed',
      label: 'Multiplier',
      initialValue: String(clip.animationSpeed || 1),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Animation speed');
    clip.animationSpeed = Math.max(0.05, safeNumber(value, clip.animationSpeed || 1));
  }

  async editSelectedActorState() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'actor') return;
    const actorRef = clip.actorRef || (this.document.assets || []).find((asset) => asset.id === clip.assetId)?.ref;
    const payload = loadProjectFile('actors', actorRef);
    const states = this.getActorStateOptions(payload?.data);
    if (!states.length) {
      this.statusText = 'No animated actor states';
      return;
    }
    const stateId = typeof document === 'undefined'
      ? states[0].id
      : await openChoiceOverlay({
        title: 'Choose Actor State',
        choices: states.map((state) => ({ label: state.label, value: state.id, primary: state.id === clip.stateId })),
        cancelText: 'Cancel'
      });
    if (!stateId) return;
    this.captureHistory('Actor state');
    const local = clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs));
    const event = this.getActiveActorStateEvent(clip, local) || clip.stateEvents?.[0];
    if (event) event.stateId = stateId;
    else clip.stateEvents = normalizeActorStateEvents([{ timeMs: local, stateId }], stateId);
    clip.stateId = clip.stateEvents?.[0]?.stateId || stateId;
    this.resizeSelectedActorKeysToRuntimeSize(clip, payload?.data, stateId);
    this.statusText = `Actor state: ${stateId}`;
  }

  resizeSelectedActorKeysToRuntimeSize(clip, actorData, stateId) {
    if (clip?.type !== 'actor' || !Array.isArray(clip.keyframes)) return;
    const dims = resolveCutsceneActorVisualDimensions(actorData, stateId);
    clip.keyframes.forEach((keyframe) => {
      keyframe.w = dims.width;
      keyframe.h = dims.height;
    });
  }

  getActorStatesForClip(clip) {
    if (clip?.type !== 'actor') return [];
    const actorRef = clip.actorRef || (this.document.assets || []).find((asset) => asset.id === clip.assetId)?.ref;
    const payload = loadProjectFile('actors', actorRef);
    return this.getActorStateOptions(payload?.data);
  }

  getActiveActorStateEvent(clip, localTime = null) {
    if (clip?.type !== 'actor') return null;
    const local = localTime == null
      ? clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs))
      : localTime;
    const resolved = resolveActorStateEvent(clip, local);
    return (clip.stateEvents || []).find((event) => event.id === resolved?.id)
      || (clip.stateEvents || []).find((event) => event.timeMs === resolved?.timeMs && event.stateId === resolved?.stateId)
      || null;
  }

  async addActorStateEvent() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'actor') return;
    const states = this.getActorStatesForClip(clip);
    if (!states.length) {
      this.statusText = 'No animated actor states';
      return;
    }
    const local = clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs));
    const current = resolveActorStateEvent(clip, local);
    const stateId = typeof document === 'undefined'
      ? (current?.stateId || states[0].id)
      : await openChoiceOverlay({
        title: 'Add Actor State',
        choices: states.map((state) => ({ label: state.label, value: state.id, primary: state.id === current?.stateId })),
        cancelText: 'Cancel'
      });
    if (!stateId) return;
    this.captureHistory('Add actor state');
    clip.stateEvents = normalizeActorStateEvents([
      ...(clip.stateEvents || []),
      {
        id: makeId('state-event'),
        timeMs: local,
        stateId,
        playAnimation: current?.playAnimation ?? clip.playAnimation,
        loopAnimation: current?.loopAnimation ?? clip.loopAnimation,
        animationSpeed: current?.animationSpeed ?? clip.animationSpeed,
        animationStartMs: current?.animationStartMs ?? 0
      }
    ], stateId);
    clip.stateId = clip.stateEvents[0]?.stateId || stateId;
    const actorRef = clip.actorRef || (this.document.assets || []).find((asset) => asset.id === clip.assetId)?.ref;
    const payload = loadProjectFile('actors', actorRef);
    this.resizeSelectedActorKeysToRuntimeSize(clip, payload?.data, stateId);
    this.statusText = `Added state ${stateId}`;
  }

  deleteActorStateEvent() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'actor' || (clip.stateEvents || []).length <= 1) {
      this.statusText = 'Keep at least one actor state';
      return;
    }
    const local = clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs));
    const event = this.getActiveActorStateEvent(clip, local);
    if (!event) return;
    this.captureHistory('Delete actor state');
    clip.stateEvents = normalizeActorStateEvents((clip.stateEvents || []).filter((entry) => entry !== event), clip.stateId);
    clip.stateId = clip.stateEvents[0]?.stateId || clip.stateId;
    this.statusText = 'Deleted actor state';
  }

  nextActorStateEvent() {
    const clip = this.getSelectedClip();
    if (clip?.type !== 'actor') return;
    const states = this.getActorStatesForClip(clip);
    if (!states.length) return;
    const local = clamp(Math.round(this.playheadMs - clip.startMs), 0, Math.max(1, clip.durationMs));
    const event = this.getActiveActorStateEvent(clip, local) || clip.stateEvents?.[0];
    if (!event) return;
    const index = Math.max(0, states.findIndex((state) => state.id === event.stateId));
    this.captureHistory('Next actor state');
    event.stateId = states[(index + 1) % states.length].id;
    const actorRef = clip.actorRef || (this.document.assets || []).find((asset) => asset.id === clip.assetId)?.ref;
    const payload = loadProjectFile('actors', actorRef);
    this.resizeSelectedActorKeysToRuntimeSize(clip, payload?.data, event.stateId);
    this.statusText = `Actor state: ${event.stateId}`;
  }

  async editSelectedVolume() {
    const clip = this.getSelectedClip();
    if (!isAudioClip(clip)) return;
    const keyframe = this.getSelectedKeyframe(clip);
    const target = keyframe || clip;
    const value = await this.requestText({
      title: keyframe ? 'Audio Key Volume' : 'Audio Volume',
      label: '0-100',
      initialValue: String(Math.round(safeNumber(target.volume, clip.volume ?? 1) * 100)),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory(keyframe ? 'Change key volume' : 'Change volume');
    target.volume = clamp(safeNumber(value, 100) / 100, 0, 1);
  }

  async editSelectedFade() {
    const clip = this.getSelectedClip();
    if (!isAudioClip(clip)) return;
    const value = await this.requestText({
      title: 'Audio Fade',
      label: 'Milliseconds',
      initialValue: String(clip.fadeMs ?? 250),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Change fade');
    clip.fadeMs = Math.max(0, Math.round(safeNumber(value, clip.fadeMs ?? 250)));
  }

  async editSelectedDuration() {
    const clip = this.getSelectedClip();
    if (!clip || clip.type === 'pause') return;
    const value = await this.requestText({
      title: 'Clip Duration',
      label: 'Milliseconds',
      initialValue: String(clip.durationMs || 1000),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Change duration');
    const maxClipDuration = Math.max(1, Math.round(safeNumber(this.document.durationMs, DEFAULT_DURATION_MS) - safeNumber(clip.startMs)));
    clip.durationMs = clamp(Math.round(safeNumber(value, clip.durationMs || 1000)), 1, maxClipDuration);
    this.normalizeClipKeyframes(clip);
  }

  async editSceneDuration() {
    const value = await this.requestText({
      title: 'Scene Length',
      label: 'Seconds or ms',
      initialValue: `${Math.round(safeNumber(this.document.durationMs, DEFAULT_DURATION_MS))}ms`,
      placeholder: '95s or 95000ms',
      inputType: 'text'
    });
    if (value == null) return;
    const nextDuration = parseCutsceneDurationInput(value, this.document.durationMs || DEFAULT_DURATION_MS);
    const maxClipEnd = Math.max(0, ...(this.document.clips || []).map((entry) => getClipEndMs(entry)));
    if (maxClipEnd > nextDuration) {
      const confirmed = typeof document === 'undefined'
        ? true
        : await openConfirmOverlay({
            title: 'Shorten Scene?',
            message: 'Scene ends before some clips. Keep hidden tail data?',
            confirmText: 'Keep Hidden',
            cancelText: 'Cancel'
          });
      if (!confirmed) return;
    }
    this.captureHistory('Scene length');
    this.document.durationMs = nextDuration;
    this.document.sceneFadeInMs = clamp(Math.round(safeNumber(this.document.sceneFadeInMs, 0)), 0, nextDuration);
    this.document.sceneFadeOutMs = clamp(Math.round(safeNumber(this.document.sceneFadeOutMs, 0)), 0, nextDuration);
    this.playheadMs = clamp(this.playheadMs, 0, nextDuration);
    if (this.isPlaying && this.playheadMs >= nextDuration) this.pausePlayback();
    this.statusText = maxClipEnd > nextDuration
      ? `Scene ${nextDuration}ms (${(nextDuration / 1000).toFixed(2)}s); later clips preserved`
      : `Scene ${nextDuration}ms (${(nextDuration / 1000).toFixed(2)}s)`;
  }

  async editSceneFade(which) {
    const prop = which === 'out' ? 'sceneFadeOutMs' : 'sceneFadeInMs';
    const title = which === 'out' ? 'Scene Fade Out' : 'Scene Fade In';
    const value = await this.requestText({
      title,
      label: 'Milliseconds',
      initialValue: String(this.document[prop] || 0),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory(title);
    const maxFade = Math.max(0, Math.round(safeNumber(this.document.durationMs, DEFAULT_DURATION_MS)));
    this.document[prop] = clamp(Math.round(safeNumber(value, this.document[prop] || 0)), 0, maxFade);
    this.statusText = `${title}: ${this.document[prop]}ms`;
  }

  async editMasterVolume() {
    const value = await this.requestText({
      title: 'Master Volume',
      label: '0-100',
      initialValue: String(Math.round(clamp(safeNumber(this.document.masterVolume, 1), 0, 1) * 100)),
      inputType: 'number'
    });
    if (value == null) return;
    this.captureHistory('Master volume');
    this.document.masterVolume = clamp(safeNumber(value, 100) / 100, 0, 1);
    this.statusText = `Master ${Math.round(this.document.masterVolume * 100)}%`;
  }

  clampClipsToSceneDuration() {
    const duration = Math.max(1, safeNumber(this.document?.durationMs, DEFAULT_DURATION_MS));
    (this.document.clips || []).forEach((clip) => {
      clip.startMs = clamp(Math.round(safeNumber(clip.startMs)), 0, duration);
      if (clip.type === 'pause') {
        clip.durationMs = 0;
        return;
      }
      clip.durationMs = Math.max(1, Math.min(Math.round(safeNumber(clip.durationMs, 1)), Math.max(1, duration - clip.startMs)));
      this.normalizeClipKeyframes(clip);
    });
  }

  getSelectedClipActionChoices(clip = this.getSelectedClip()) {
    if (!clip) return [];
    const choices = [];
    if (isVisualClip(clip)) {
      const selectedKey = this.getSelectedKeyframe(clip);
      choices.push({ label: 'Set Keyframe', value: 'set-key', primary: true });
      choices.push({ label: this.getSelectedKeyframeLabel(clip), value: 'key-mode' });
      choices.push({ label: 'Delete Key', value: 'delete-key', disabled: !selectedKey || this.isProtectedKeyframe(clip, selectedKey) });
      choices.push({ label: 'Fade In', value: 'fade-in' });
      choices.push({ label: 'Fade Out', value: 'fade-out' });
      choices.push({ label: 'Easing', value: 'ease' });
      choices.push({ label: 'Scale', value: 'scale' });
      choices.push({ label: 'Scale X', value: 'scale-x' });
      choices.push({ label: 'Scale Y', value: 'scale-y' });
      choices.push({ label: clip.aspectLocked === false ? 'Lock Ratio' : 'Unlock Ratio', value: 'aspect-lock' });
      choices.push({ label: 'Rotate', value: 'rotate' });
      choices.push({ label: `Opacity ${Math.round(safeNumber((this.getEditableTransform(clip) || clip).opacity, 1) * 100)}%`, value: 'opacity' });
      choices.push({ label: 'FX', value: 'fx' });
      choices.push({ label: 'Reset Transform', value: 'reset-transform' });
      if (clip.type === 'text') {
        choices.push({ label: 'Edit Text', value: 'edit-text' });
        choices.push({ label: 'Text Color', value: 'text-color' });
        choices.push({ label: clip.textBorderEnabled === false ? 'Border Off' : 'Border On', value: 'text-border' });
        choices.push({ label: 'Border Color', value: 'text-border-color' });
        choices.push({ label: 'Border Size', value: 'text-border-size' });
        choices.push({ label: 'Font Size', value: 'font-size' });
        choices.push({ label: 'Font', value: 'font-family' });
        choices.push({ label: 'Justify', value: 'text-align' });
        choices.push({ label: 'Reveal Speed', value: 'reveal-speed' });
      }
      if (clip.type === 'color-board') {
        choices.push({ label: 'Board Color', value: 'board-color' });
      }
      if (clip.type === 'actor') {
        choices.push({ label: 'Change Animation', value: 'actor-state' });
        choices.push({ label: 'Add State Key', value: 'add-state' });
      }
    }
    choices.push({ label: 'Copy', value: 'copy' });
    choices.push({ label: 'Cut', value: 'cut' });
    choices.push({ label: 'Duplicate', value: 'duplicate' });
    choices.push({ label: 'Delete', value: 'delete' });
    return choices;
  }

  getSelectedClipActionGroups(clip = this.getSelectedClip()) {
    const choices = this.getSelectedClipActionChoices(clip).filter((choice) => !choice.disabled);
    const byValue = new Map(choices.map((choice) => [choice.value, choice]));
    const groupDefs = [
      { label: 'Keyframes', values: ['set-key', 'key-mode', 'delete-key', 'actor-state', 'add-state'] },
      { label: 'Transform', values: ['fade-in', 'fade-out', 'ease', 'rotate', 'opacity', 'fx', 'reset-transform'] },
      { label: 'Size', values: ['scale', 'scale-x', 'scale-y', 'aspect-lock'] },
      { label: 'Text', values: ['edit-text', 'text-color', 'text-border', 'text-border-color', 'text-border-size', 'font-size', 'font-family', 'text-align', 'reveal-speed'] },
      { label: 'Board', values: ['board-color'] },
      { label: 'Edit', values: ['copy', 'cut', 'duplicate', 'delete'] }
    ];
    const groupedValues = new Set();
    const groups = groupDefs
      .map((group) => {
        const groupChoices = group.values
          .map((value) => byValue.get(value))
          .filter(Boolean);
        groupChoices.forEach((choice) => groupedValues.add(choice.value));
        return { label: group.label, value: group.label.toLowerCase(), choices: groupChoices };
      })
      .filter((group) => group.choices.length > 0);
    const otherChoices = choices.filter((choice) => !groupedValues.has(choice.value));
    if (otherChoices.length) groups.push({ label: 'Other', value: 'other', choices: otherChoices });
    return groups;
  }

  async openSelectedClipActions() {
    const clip = this.getSelectedClip();
    if (!clip) {
      this.statusText = 'Select a clip first';
      return;
    }
    const choices = this.getSelectedClipActionChoices(clip).filter((choice) => !choice.disabled);
    let action = choices.find((choice) => !choice.disabled)?.value;
    if (typeof document !== 'undefined') {
      const groups = this.getSelectedClipActionGroups(clip);
      if (groups.length > 1 || choices.length > 8) {
        const groupValue = await openChoiceOverlay({
          title: this.getClipLabel(clip),
          message: 'Choose an action group',
          choices: groups.map((group) => ({ label: group.label, value: group.value })),
          cancelText: 'Cancel'
        });
        const group = groups.find((entry) => entry.value === groupValue);
        action = group ? await openChoiceOverlay({
          title: group.label,
          choices: group.choices,
          cancelText: 'Back'
        }) : null;
      } else {
        action = await openChoiceOverlay({
          title: this.getClipLabel(clip),
          choices,
          cancelText: 'Cancel'
        });
      }
    }
    if (!action) return;
    await this.handleContextAction(action);
  }

  async handleContextAction(action) {
    if (action === 'actions') return;
    if (action === 'set-key') this.setSelectedKeyframe(this.keyframeMode);
    if (action === 'key-mode') this.cycleKeyframeMode();
    if (action === 'delete-key') this.deleteSelectedKeyframe();
    if (action === 'fade-in') await this.editSelectedFadeVisual('in');
    if (action === 'fade-out') await this.editSelectedFadeVisual('out');
    if (action === 'ease') this.cycleSelectedEasing();
    if (action === 'scale') await this.editSelectedScale();
    if (action === 'scale-x') await this.editSelectedAxisScale('x');
    if (action === 'scale-y') await this.editSelectedAxisScale('y');
    if (action === 'aspect-lock') this.toggleSelectedAspectLock();
    if (action === 'rotate') await this.editSelectedRotation();
    if (action === 'opacity') await this.editSelectedOpacity();
    if (action === 'fx') await this.editSelectedFx();
    if (action === 'reset-transform') this.resetSelectedTransform();
    if (action === 'edit-text') await this.editSelectedTextContent();
    if (action === 'text-color') await this.editSelectedTextColor();
    if (action === 'text-border') this.toggleSelectedTextBorder();
    if (action === 'text-border-color') await this.editSelectedTextBorderColor();
    if (action === 'text-border-size') await this.editSelectedTextBorderSize();
    if (action === 'board-color') await this.editSelectedBoardColor();
    if (action === 'font-size') await this.editSelectedFontSize();
    if (action === 'font-family') await this.editSelectedFontFamily();
    if (action === 'text-align') await this.editSelectedTextAlign();
    if (action === 'reveal-speed') await this.editSelectedRevealSpeed();
    if (action === 'actor-state') await this.editSelectedActorState();
    if (action === 'add-state') await this.addActorStateEvent();
    if (action === 'copy') this.copySelectedClip();
    if (action === 'cut') this.cutSelectedClip();
    if (action === 'duplicate') this.duplicateSelectedClip();
    if (action === 'delete') this.deleteSelectedClip();
  }

  cloneClipForClipboard(clip) {
    return clip ? JSON.parse(JSON.stringify(clip)) : null;
  }

  copySelectedClip() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    this.clipboardClip = this.cloneClipForClipboard(clip);
    this.statusText = 'Copied clip';
  }

  cutSelectedClip() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    this.captureHistory('Cut clip');
    this.clipboardClip = this.cloneClipForClipboard(clip);
    this.document.clips = (this.document.clips || []).filter((entry) => entry.id !== clip.id);
    this.selectedClipId = this.document.clips[0]?.id || null;
    this.selectedTrackId = null;
    this.statusText = 'Cut clip';
  }

  pasteClipboardClip() {
    if (!this.clipboardClip) {
      this.statusText = 'Nothing to paste';
      return;
    }
    this.captureHistory('Paste clip');
    const source = this.cloneClipForClipboard(this.clipboardClip);
    const clip = normalizeCutsceneClip({
      ...source,
      id: makeId(`${source.type || 'clip'}-paste`),
      startMs: clamp(Math.round(this.playheadMs), 0, this.document.durationMs)
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(clip);
    this.document.clips.push(clip);
    this.selectedClipId = clip.id;
    this.selectedTrackId = null;
    this.document.durationMs = Math.max(this.document.durationMs, getClipEndMs(clip) + 500);
    this.statusText = 'Pasted clip';
  }

  duplicateSelectedClip() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    this.captureHistory('Duplicate clip');
    const copy = normalizeCutsceneClip({
      ...JSON.parse(JSON.stringify(clip)),
      id: makeId(`${clip.type}-copy`),
      startMs: clamp(clip.startMs + 250, 0, this.document.durationMs)
    }, this.document, this.document.clips.length);
    this.ensureTrackForClip(copy);
    this.document.clips.push(copy);
    this.selectedClipId = copy.id;
    this.selectedTrackId = null;
  }

  deleteSelectedClip() {
    const clip = this.getSelectedClip();
    if (!clip) return;
    this.captureHistory('Delete clip');
    this.document.clips = (this.document.clips || []).filter((entry) => entry.id !== clip.id);
    this.selectedClipId = this.document.clips[0]?.id || null;
    this.selectedTrackId = null;
    this.statusText = 'Deleted clip';
  }

  getImageForAsset(asset) {
    if (!asset?.dataUrl) return null;
    const cache = this.previewRuntime.imageCache;
    if (cache.has(asset.id)) return cache.get(asset.id);
    if (typeof Image === 'undefined') return null;
    const image = new Image();
    image.src = asset.dataUrl;
    cache.set(asset.id, image);
    return image;
  }

  getArtFrameForAsset(asset) {
    if (!asset?.ref) return null;
    return getCachedArtCanvas(asset.ref, this.previewRuntime.artCache);
  }

  getVisualFrameForClip(clip, asset, timeMs) {
    return getVisualFrameCanvas(clip, asset, timeMs, this.previewRuntime.artCache);
  }
}
