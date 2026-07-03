import {
  GM_DRUM_BANK_LSB,
  GM_DRUM_BANK_MSB,
  GM_DRUM_CHANNEL,
  GM_DRUM_KITS,
  GM_DRUM_ROWS,
  GM_FAMILIES,
  GM_PROGRAMS,
  clampDrumPitch,
  formatProgramNumber,
  isDrumChannel,
  mapPitchToDrumRow
} from '../audio/gm.js';
import { buildMidiBytes, buildMultiTrackMidiBytes, parseMidi } from '../midi/midiParser.js';
import { buildZipFromStems, loadZipSongFromBytes } from '../songs/songLoader.js';
import { getGmSustainProfile } from '../game/Audio.js';
import { openProjectBrowser } from './ProjectBrowserModal.js';
import { loadProjectFile, saveProjectFile, saveProjectFileAndConfirm } from './projectFiles.js';
import { loadServerPreference, saveServerPreference } from './serverPreferences.js';
import { UI_SUITE, SHARED_EDITOR_LEFT_MENU, buildSharedDesktopContextTransportLayout, buildSharedEditorFileMenu, drawSharedDesktopContextPanel, drawSharedDesktopDropdown, drawSharedDesktopRibbon, drawSharedDesktopTopMenu, drawSharedFocusRing, drawSharedGamepadHintBar, drawSharedGamepadSlideOutHeader, drawSharedMenuButtonChrome, drawSharedMenuButtonLabel, drawSharedPanel, drawSharedPortraitActionRail, drawSharedPortraitMultiRowTabStrip, drawSharedPortraitScrollHints, drawSharedPortraitSheet, drawSharedThumbstick, drawSharedTransportIconButton, drawSharedTransportPopover, getSharedEditorDrawerWidth, getSharedMobileDrawerWidth, getSharedMobilePortraitEditorLayout, getSharedMobileRailWidth, getSharedPortraitActionRailLayout, getSharedPortraitMenuMetrics, getSharedThumbstickLayout, isMobileLandscapeLayout, isMobilePortraitLayout, normalizeSharedControlBounds, renderSharedFileDrawer, resetSharedThumbstickState, SharedEditorMenu, splitFileDrawerStickyExitItems } from './uiSuite.js';
import { resolveEditorShellTheme } from '../../ui/EditorShell.js';
import InputEventBus from '../input/eventBus.js';
import RobterspielInput from '../input/robterspiel.js';
import KeyboardInput from '../input/keyboard.js';
import TouchInput from '../input/touch.js';
import MidiRecorder from '../recording/recorder.js';
import RecordModeLayout from './recordMode.js';
import { radialIndexFromStick } from './midi/input/radial.js';
import { toRgba } from './midi/render/color.js';
import { KEY_LABELS, parseChordToken, parseChordProgressionInput, formatChordToken } from './midi/helpers/chords.js';
import { CACHED_SOUND_FONT_KEY, DEFAULT_PRELOAD_PROGRAMS } from './midi/io/storage.js';
import { initializeComposerState } from './midi/state/composerState.js';
import { registerComposerInputHandlers } from './midi/input/composerInputHandlers.js';
import { drawGhostNotes as drawComposerGhostNotes, drawRecordModeSidebar as drawComposerRecordModeSidebar } from './midi/render/composerRender.js';
import { createViewportController } from './shared/viewportController.js';
import { getEditorControllerRootMenuEntries, getEditorControllerRootMenuIds, getEditorDesktopControllerMenuIdForSection, getEditorPortraitRootMenuEntries, getEditorRootMenuEntries, getEditorRootMenuLabelMap } from './shared/editorMenuSpec.js';
import { applyDesktopDropdownWheelScrollState, buildCompactLandscapeCommandRailActions, buildCompactLandscapeCommandRailButtonLayout, buildDesktopDropdownRenderPlan, buildDesktopEditorShellPlan, buildGamepadSlideOutMenuPlan, buildLandscapeRootDrawerGridLayout, buildLandscapeTouchEditorShellPlan, buildMenuScrollDragState, createDesktopDropdownCommandHit, createPendingDesktopDropdownHit, findScrollableMenuRegion, getEditorPointerInteractionPolicy, resolveClosedDesktopDropdownState, resolveDesktopDropdownHoverSwitch, resolveDesktopDropdownRootId, resolveDesktopDropdownState, resolveEditorViewportModeFlags, resolveGamepadMenuState, resolveMenuScrollDrag, resolveOpenDesktopDropdownState, resolvePendingDesktopDropdownHit, shouldCloseDesktopDropdownOnPointerDown, updatePendingDesktopDropdownHit } from './shared/editorMenuLayout.js';
import { createEditorRuntime } from './shared/editor-runtime/EditorRuntime.js';
import { EDITOR_INPUT_ACTIONS, EditorInputActionNormalizer, SHARED_EDITOR_GAMEPAD_BINDINGS, SHARED_EDITOR_GAMEPAD_HINTS } from './shared/input/editorInputActions.js';
import { ControllerMenuStack, buildControllerExitConfirmMenu, buildControllerHelpMenu, buildControllerSystemMenu, drawCanvasControllerMenu } from './shared/input/controllerMenuStack.js';
import { openConfirmOverlay, openMultiNumberInputOverlay, openProgressOverlay, openTextInputOverlay } from './shared/textInputOverlay.js';
import { drawSharedMobileZoomSlider, getSharedMobileZoomSliderLayout } from './shared/mobileZoomSlider.js';
import { PEDAL_DEFINITIONS, PEDAL_DEFINITION_BY_TYPE, PEDAL_COLORS, PEDAL_FONTS } from './midi/pedals/pedalDefinitions.js';
import { createDefaultPedal } from './midi/pedals/pedalDefaults.js';
import { normalizeMidiPedals, sortMidiPedalsBySignalChain } from './midi/pedals/normalizeMidiPedals.js';
import { applyPedalChain } from './midi/pedals/applyPedalChain.js';

const SCALE_LIBRARY = [
  { id: 'major', label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian', label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', label: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'minor', label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'locrian', label: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10] }
];

const QUANTIZE_OPTIONS = [
  { id: '1', label: '1', divisor: 1 },
  { id: '1/2', label: '1/2', divisor: 2 },
  { id: '1/3', label: '1/3', divisor: 3 },
  { id: '1/4', label: '1/4', divisor: 4 },
  { id: '1/6', label: '1/6', divisor: 6 },
  { id: '1/8', label: '1/8', divisor: 8 },
  { id: '1/16', label: '1/16', divisor: 16 },
  { id: '1/32', label: '1/32', divisor: 32 }
];

const MIDI_COMPOSER_AUTOSAVE_DOC = 'MIDI Composer Autosave';
const MIDI_AUTOSAVE_SUFFIX = ' Autosave';
const MIDI_RESCUE_PREFIX = 'Intro Rescue';
export const MIDI_MAX_ZOOM_OUT_BARS = 12;
export const MIDI_PLAYBACK_MAX_CATCHUP_SECONDS = 0.35;
const MIDI_STALE_BACKLOG_SECONDS = 1.25;
const MIDI_SCHEDULE_LOOKAHEAD_SECONDS = 0.42;
const MIDI_MIN_SCHEDULE_LATENCY_SECONDS = 0.08;
const MIDI_MAX_PLAYBACK_EVENTS_PER_FRAME = 256;

const NOTE_LENGTH_OPTIONS = [
  { id: '1', label: '1', icon: 'w', divisor: 1 },
  { id: '1/2', label: '1/2', icon: 'd', divisor: 2 },
  { id: '1/3', label: '1/3', icon: 't', divisor: 3 },
  { id: '1/4', label: '1/4', icon: 'q', divisor: 4 },
  { id: '1/6', label: '1/6', icon: 's', divisor: 6 },
  { id: '1/8', label: '1/8', icon: 'e', divisor: 8 },
  { id: '1/16', label: '1/16', icon: 'x', divisor: 16 },
  { id: '1/32', label: '1/32', icon: 't', divisor: 32 }
];

const SOUNDFONT_CDNS = [
  { id: 'vendored', label: 'Vendored' }
];

const NOTE_VALUE_ICONS = {
  '1': '𝅝',
  '1/2': '𝅗𝅥',
  '1/3': '𝅘𝅥3',
  '1/4': '𝅘𝅥',
  '1/6': '𝅘𝅥𝅮6',
  '1/8': '𝅘𝅥𝅮',
  '1/16': '𝅘𝅥𝅯',
  '1/32': '𝅘𝅥𝅰'
};
const MAX_ACTIVE_NOTES = 96;

const TIME_SIGNATURE_OPTIONS = [
  { id: '3/4', beats: 3, unit: 4 },
  { id: '4/4', beats: 4, unit: 4 },
  { id: '5/4', beats: 5, unit: 4 },
  { id: '6/4', beats: 6, unit: 4 },
  { id: '7/4', beats: 7, unit: 4 }
];
const TIME_SIGNATURE_UNITS = [2, 4, 8, 16];

const TAB_OPTIONS = [
  { id: 'grid', label: 'Grid' },
  { id: 'song', label: 'Song' },
  { id: 'instruments', label: 'Mixer' },
  { id: 'virtual-instruments', label: 'Record' }
];

export const buildMidiSharedRootMenuEntries = ({
  includeFile = true,
  includeSettings = true
} = {}) => {
  const entries = getEditorRootMenuEntries('midi');
  return entries.filter((entry) => (
    (includeFile || entry.id !== 'file')
    && (includeSettings || entry.id !== 'settings')
  ));
};
const MIDI_CONTROLLER_ROOT_ENTRIES = getEditorControllerRootMenuEntries('midi');
const MIDI_CONTROLLER_SIBLING_ORDER = getEditorControllerRootMenuIds('midi');
const MIDI_CONTROLLER_ROOT_LABELS = getEditorRootMenuLabelMap('midi');
const MIDI_CONTROLLER_ROOT_TO_TAB = {
  edit: 'grid',
  view: 'grid',
  instruments: 'instruments',
  'virtual-instruments': 'virtual-instruments'
};
const MIDI_LANDSCAPE_RIGHT_DRAWER_TABS = new Set(
  MIDI_CONTROLLER_ROOT_ENTRIES
    .filter((entry) => ['file', 'view', 'record', 'settings'].includes(entry.specId || entry.id))
    .map((entry) => entry.id)
);
const MIDI_WORKSPACE_TAB_IDS = new Set(
  MIDI_CONTROLLER_ROOT_ENTRIES
    .filter((entry) => !['file', 'settings'].includes(entry.specId || entry.id))
    .map((entry) => entry.id)
);

const TOOL_OPTIONS = [
  { id: 'draw', label: 'Draw' }
];

const INSTRUMENT_FAMILY_TABS = [
  { id: 'piano-keys', label: 'Piano/Keys' },
  { id: 'guitars', label: 'Guitars' },
  { id: 'bass', label: 'Bass' },
  { id: 'drum-kits', label: 'Drum Kits' },
  { id: 'drums-perc', label: 'Drums/Perc' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'strings', label: 'Strings' },
  { id: 'brass', label: 'Brass' },
  { id: 'woodwinds', label: 'Woodwinds' },
  { id: 'synth', label: 'Synth' },
  { id: 'fx', label: 'FX' },
  { id: 'choir-voice', label: 'Choir/Voice' },
  { id: 'ethnic', label: 'Ethnic' },
  { id: 'misc', label: 'Misc' }
];

const VIRTUAL_INSTRUMENT_DEFAULT_MAPPING = [
  { id: 'drums', families: ['Drums', 'Percussive'], nameIncludes: ['drum', 'kit'], programRange: null },
  { id: 'bass', families: ['Bass'], nameIncludes: ['bass'], programRange: [32, 39] },
  { id: 'guitar', families: ['Guitar'], nameIncludes: ['guitar'], programRange: [24, 31] },
  {
    id: 'keyboard',
    families: ['Piano', 'Organ', 'Chromatic Percussion', 'Synth Lead', 'Synth Pad', 'Synth Effects'],
    nameIncludes: ['piano', 'keyboard', 'keys'],
    programRange: [0, 23]
  }
];

const MIDI_GAMEPAD_SEMANTIC_BINDINGS = {
  ...SHARED_EDITOR_GAMEPAD_BINDINGS
};

const GAMEPAD_BUTTONS = [
  { id: 'A', action: 'jump' },
  { id: 'B', action: 'dash' },
  { id: 'X', action: 'rev' },
  { id: 'Y', action: 'throw' },
  { id: 'LB', action: 'aimUp' },
  { id: 'RB', action: 'aimDown' },
  { id: 'Start', action: 'pause' },
  { id: 'Back', action: 'cancel' }
];

const GM_SCHEMA_VERSION = 3;
const LEGACY_MIDI_TICKS_PER_BEAT = 8;
const MIDI_TICKS_PER_BEAT = 24;
const DEFAULT_BANK_MSB = 0;
const DEFAULT_BANK_LSB = 0;
const DRUM_BANK_MSB = GM_DRUM_BANK_MSB;
const DRUM_BANK_LSB = GM_DRUM_BANK_LSB;

const TRACK_COLORS = ['#4fb7ff', '#ff9c42', '#55d68a', '#b48dff', '#ff6a6a', '#43d5d0'];
const DEFAULT_GRID_BARS = 16;
const DEFAULT_VISIBLE_ROWS = 12;
const DEFAULT_LABEL_WIDTH = 192;
const DEFAULT_LABEL_WIDTH_MOBILE = 152;
const DEFAULT_LABEL_WIDTH_MOBILE_PORTRAIT = 80;
const DEFAULT_LABEL_WIDTH_MOBILE_LANDSCAPE = 112;
const MIN_VISIBLE_ROWS = 5;
const MAX_VISIBLE_ROWS = 60;
const DEFAULT_GRID_TOP_PITCH = 59;
const DEFAULT_RULER_HEIGHT = 80;
const DEFAULT_RULER_HEIGHT_MOBILE_PORTRAIT = 44;
const DEFAULT_RULER_HEIGHT_MOBILE_LANDSCAPE = 44;
const MIDI_PORTRAIT_MIN_CELL_WIDTH = 1;
const MIDI_PORTRAIT_MELODIC_CELL_HEIGHT = 40;
const MIDI_PORTRAIT_MELODIC_MIN_CELL_HEIGHT = 36;
const MIDI_PORTRAIT_DRUM_CELL_HEIGHT = 34;
const MIDI_PORTRAIT_DRUM_MIN_CELL_HEIGHT = 32;
const MIDI_PORTRAIT_DEFAULT_VISIBLE_ROWS = 12;
const MIDI_LANDSCAPE_MELODIC_CELL_HEIGHT = 26;
const MIDI_LANDSCAPE_MELODIC_MIN_CELL_HEIGHT = 24;
const MIDI_LANDSCAPE_DRUM_CELL_HEIGHT = 24;
const MIDI_LANDSCAPE_DRUM_MIN_CELL_HEIGHT = 22;
const MIDI_MENU_ICON = '☰';
const MIDI_LOOP_ICON = '↻';
const MIDI_SONG_MODE_TABS = [
  { key: 'songRailMusicControls', label: 'Music', shortLabel: 'Music', mode: 'music-controls' },
  { key: 'songRailEditTab', label: 'Edit', shortLabel: 'Edit', mode: 'edit' },
  { key: 'songRailToolsTab', label: 'Tools', shortLabel: 'Tools', mode: 'tools' },
  { key: 'songMixVolumeTab', label: 'Volume', shortLabel: 'Vol', mode: 'volume' },
  { key: 'songMixPanTab', label: 'Pan', shortLabel: 'Pan', mode: 'pan' }
];

export function buildMidiPortraitRootTabs() {
  return getEditorPortraitRootMenuEntries('midi', {
    labelOverrides: { file: SHARED_EDITOR_LEFT_MENU.fileLabel }
  });
}

export function buildMidiPortraitMenuModel() {
  return {
    rootTabs: buildMidiPortraitRootTabs(),
    bottomRailActions: ['menu', 'undo', 'redo', 'play'],
    menuLoopIds: ['loop', 'loopToggle'],
    portraitRootPlacement: 'bottom-rail'
  };
}

export function getMidiPortraitPedalGridLayout(bounds, {
  titleHeight = 26,
  gap = 10,
  padding = 10
} = {}) {
  const panel = {
    x: bounds.x,
    y: bounds.y,
    w: Math.max(1, bounds.w),
    h: Math.max(1, bounds.h)
  };
  const gridY = panel.y + titleHeight + padding;
  const gridH = Math.max(1, panel.y + panel.h - padding - gridY);
  const slotW = Math.floor((panel.w - padding * 2 - gap) / 2);
  const slotH = Math.floor((gridH - gap) / 2);
  const slots = Array.from({ length: 4 }, (_, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return {
      x: panel.x + padding + col * (slotW + gap),
      y: gridY + row * (slotH + gap),
      w: slotW,
      h: slotH,
      slotIndex: index,
      control: 'pedal-slot'
    };
  });
  return { panel, slots };
}

export function buildMidiPortraitGridQuickStripItems({ song = {}, noteLengthLabel = '1/4' } = {}) {
  const tempo = Math.round(song.tempo || 120);
  return [
    { id: 'track', label: 'Track' },
    { id: 'tempo', label: String(tempo) },
    { id: 'loop', label: MIDI_LOOP_ICON, active: Boolean(song.loopEnabled) },
    { id: 'quantize', label: noteLengthLabel }
  ];
}

export function getMidiPortraitMasterVolumeLayout(anchorBounds, {
  height = 72,
  gap = 6,
  padding = 12
} = {}) {
  const panel = {
    x: anchorBounds.x,
    y: Math.max(0, anchorBounds.y - height - gap),
    w: anchorBounds.w,
    h: height
  };
  return {
    panel,
    slider: {
      x: panel.x + padding,
      y: panel.y + 38,
      w: Math.max(1, panel.w - padding * 2),
      h: 18,
      id: 'audio-volume'
    }
  };
}

export function getMidiPortraitTrackPickerLayout(bounds, trackCount = 0, {
  rowHeight = 46,
  gap = 6,
  padding = 10,
  maxHeight = 260
} = {}) {
  const count = Math.max(0, trackCount);
  const panelH = Math.min(maxHeight, Math.max(96, padding * 2 + Math.min(count, 5) * (rowHeight + gap) - gap + 28));
  const panel = {
    x: bounds.x,
    y: Math.max(0, bounds.y - panelH - gap),
    w: bounds.w,
    h: panelH
  };
  const list = {
    x: panel.x + padding,
    y: panel.y + 30,
    w: Math.max(1, panel.w - padding * 2),
    h: Math.max(1, panel.h - 40)
  };
  return {
    panel,
    list,
    rowHeight,
    gap,
    visibleRows: Math.max(1, Math.floor((list.h + gap) / Math.max(1, rowHeight + gap)))
  };
}

export function getMidiPortraitSongRailLayout({
  x = 0,
  y = 0,
  w = 0,
  h = 0,
  mode = 'music-controls',
  actionCount = 0
} = {}) {
  const panelPad = 6;
  const gap = 5;
  const tabRowGap = 12;
  const rowH = 30;
  const contentX = x + panelPad;
  const contentW = Math.max(0, w - panelPad * 2);
  const tabRows = [MIDI_SONG_MODE_TABS.slice(0, 3), MIDI_SONG_MODE_TABS.slice(3)];
  const tabs = [];
  tabRows.forEach((row, rowIndex) => {
    const tabW = Math.floor((contentW - gap * Math.max(0, row.length - 1)) / Math.max(1, row.length));
    row.forEach((entry, colIndex) => {
      tabs.push({
        ...entry,
        label: entry.shortLabel,
        x: contentX + colIndex * (tabW + gap),
        y: y + panelPad + rowIndex * (rowH + tabRowGap),
        w: tabW,
        h: rowH,
        active: entry.mode === mode
      });
    });
  });

  const minActionW = mode === 'music-controls' ? 52 : 70;
  const maxColumns = mode === 'music-controls' ? 4 : 3;
  const columns = actionCount > 0
    ? clamp(Math.floor((contentW + gap) / (minActionW + gap)), 1, maxColumns)
    : 0;
  const actionW = columns > 0
    ? Math.floor((contentW - gap * Math.max(0, columns - 1)) / columns)
    : 0;
  const actionH = 38;
  const actionRows = columns > 0
    ? Math.ceil(Math.max(0, actionCount) / columns)
    : 0;
  const actionBlockH = actionRows > 0
    ? actionRows * actionH + Math.max(0, actionRows - 1) * gap
    : 0;
  const tabsEndY = y + panelPad + tabRows.length * rowH + Math.max(0, tabRows.length - 1) * tabRowGap;
  const preferredBodyY = tabsEndY + 12;
  const bottomAlignedBodyY = y + h - panelPad - actionBlockH - 2;
  const bodyY = actionBlockH > 0
    ? Math.max(preferredBodyY, bottomAlignedBodyY)
    : preferredBodyY;
  const availableBodyH = Math.max(0, y + h - panelPad - bodyY);
  const actions = Array.from({ length: Math.max(0, actionCount) }, (_, index) => {
    const col = columns > 0 ? index % columns : 0;
    const row = columns > 0 ? Math.floor(index / columns) : 0;
    return {
      x: contentX + col * (actionW + gap),
      y: bodyY + row * (actionH + gap),
      w: actionW,
      h: actionH
    };
  });

  return {
    panelPad,
    gap,
    tabRowGap,
    rowH,
    contentX,
    contentW,
    tabs,
    bodyY,
    availableBodyH,
    actions,
    columns,
    actionW,
    actionH
  };
}

export function getMidiSongMixSliderYOffset({ portrait = false } = {}) {
  return portrait ? 12 : 8;
}

export function getMidiNoteHandleWidth(rect, { portrait = false } = {}) {
  const height = Math.max(1, Number(rect?.h) || 1);
  const width = Math.max(1, Number(rect?.w) || 1);
  const noteCap = Math.max(2, Math.floor(width / 2));
  const desired = portrait
    ? Math.max(10, Math.round(height * 0.42))
    : Math.max(8, Math.round(height * 0.5));
  const maxWidth = portrait ? 18 : 22;
  return Math.max(2, Math.min(maxWidth, noteCap, desired));
}

export function getMidiNoteEdgeHit(rect, x, handleWidth) {
  if (!rect || !Number.isFinite(x)) return null;
  if (x < rect.x || x > rect.x + rect.w) return null;
  const edgeWidth = Math.max(0, Math.min(Number(handleWidth) || 0, rect.w / 2));
  if (edgeWidth <= 0) return null;
  if (x <= rect.x + edgeWidth) return 'start';
  if (x >= rect.x + rect.w - edgeWidth) return 'end';
  return null;
}

export function resizeMidiNoteByEdge(original, {
  edge = 'end',
  snappedTick = 0,
  targetOriginal = original,
  gridTicks = 1,
  minDurationTicks = 1
} = {}) {
  const safeGridTicks = Math.max(1, Math.floor(Number(gridTicks) || 1));
  const minDuration = clamp(Math.floor(Number(minDurationTicks) || 1), 1, safeGridTicks);
  const originStart = clamp(Math.floor(Number(original?.startTick) || 0), 0, safeGridTicks - 1);
  const originDuration = Math.max(1, Math.floor(Number(original?.durationTicks) || 1));
  const originEnd = clamp(originStart + originDuration, originStart + 1, safeGridTicks);
  const targetStart = clamp(Math.floor(Number(targetOriginal?.startTick) || 0), 0, safeGridTicks - 1);
  const targetDuration = Math.max(1, Math.floor(Number(targetOriginal?.durationTicks) || 1));
  const targetEnd = clamp(targetStart + targetDuration, targetStart + 1, safeGridTicks);
  let deltaStart = 0;
  let deltaEnd = 0;

  if (edge === 'start') {
    const nextTargetStart = clamp(Math.floor(Number(snappedTick) || 0), 0, Math.max(0, targetEnd - minDuration));
    deltaStart = nextTargetStart - targetStart;
  } else {
    const nextTargetEnd = clamp(Math.floor(Number(snappedTick) || 0), Math.min(safeGridTicks, targetStart + minDuration), safeGridTicks);
    deltaEnd = nextTargetEnd - targetEnd;
  }

  const nextStart = edge === 'start'
    ? clamp(originStart + deltaStart, 0, Math.max(0, originEnd - minDuration))
    : originStart;
  const nextEnd = edge === 'start'
    ? originEnd
    : clamp(originEnd + deltaEnd, Math.min(safeGridTicks, nextStart + minDuration), safeGridTicks);
  const maxDuration = Math.max(1, safeGridTicks - nextStart);
  const safeMinDuration = Math.min(minDuration, maxDuration);
  return {
    ...original,
    startTick: nextStart,
    durationTicks: clamp(nextEnd - nextStart, safeMinDuration, maxDuration)
  };
}

export function getMidiResizeMinimumTicks({
  ticksPerBar = 16,
  noteLengthIndex = 0
} = {}) {
  const safeTicksPerBar = Math.max(1, Math.round(Number(ticksPerBar) || 16));
  const index = clamp(Math.floor(Number(noteLengthIndex) || 0), 0, NOTE_LENGTH_OPTIONS.length - 1);
  const selectedDivisor = NOTE_LENGTH_OPTIONS[index]?.divisor || 32;
  return Math.max(1, Math.round(safeTicksPerBar / selectedDivisor));
}

export function shouldMidiDeleteSelectedNoteOnTap() {
  return true;
}

export function getMidiPortraitRecordLayout(width, height, {
  actionRailHeight = 88,
  minGridHeight = 136,
  pedalHeight = 90
} = {}) {
  const layout = getSharedMobilePortraitEditorLayout(width, height, {
    middleRailHeight: actionRailHeight,
    minTopHeight: minGridHeight,
    minMainHeight: 240,
    sheetRatio: 0.54
  });
  const gap = 10;
  const gridH = Math.max(96, Math.min(layout.mainEditor.h, Math.round(layout.mainEditor.h * 0.36)));
  const gridBounds = {
    x: layout.mainEditor.x,
    y: layout.mainEditor.y,
    w: layout.mainEditor.w,
    h: gridH
  };
  const pedalBounds = {
    x: 0,
    y: gridBounds.y + gridBounds.h + gap,
    w: width,
    h: Math.max(64, Math.min(pedalHeight, layout.middleRail.y - (gridBounds.y + gridBounds.h + gap) - gap - 180))
  };
  const quickButtonSpace = 52;
  const instrumentBounds = {
    x: 0,
    y: pedalBounds.y + pedalBounds.h + gap + quickButtonSpace,
    w: width,
    h: Math.max(0, layout.middleRail.y - (pedalBounds.y + pedalBounds.h + gap + quickButtonSpace) - gap)
  };
  const controlRailBounds = {
    x: Math.max(8, width - 156),
    y: layout.menuSheet.y + 8,
    w: Math.min(148, Math.max(112, width * 0.38)),
    h: Math.max(140, Math.min(260, layout.menuSheet.h - 16))
  };
  return {
    ...layout,
    gridBounds,
    pedalBounds,
    instrumentBounds,
    controlRailBounds
  };
}

export function isMidiPortraitMainWorkspaceTab(activeTab) {
  const mainWorkspaceTabs = ['grid', 'song', 'instruments', 'pedals'];
  return mainWorkspaceTabs.includes(activeTab);
}

export function shouldMidiPortraitSheetOpen(activeTab, controllerMenuActive = false) {
  if (isMidiPortraitMainWorkspaceTab(activeTab)) return false;
  return Boolean(controllerMenuActive) || activeTab === 'file' || activeTab === 'settings' || activeTab === 'virtual-instruments';
}

export function getMidiPortraitFullScreenSheetLayout(width, height, {
  margin = 8,
  padding = 10
} = {}) {
  const stack = getMidiPortraitControlLayout(width, height, { padding });
  const sheet = {
    x: margin,
    y: margin,
    w: Math.max(1, width - margin * 2),
    h: Math.max(1, stack.bottomRail.y - stack.gap - margin)
  };
  const content = {
    ...stack.workSurface
  };
  return {
    sheet,
    rootRail: stack.viewRail,
    rootTabs: stack.viewRail,
    viewRail: stack.viewRail,
    subRail: content,
    sheetContent: content,
    zoomStrip: stack.zoomStrip,
    bottomRail: stack.bottomRail,
    content,
    gap: stack.gap,
    portraitRootPlacement: 'bottom-rail'
  };
}

export function getMidiPortraitControlLayout(width, height, {
  padding = 10,
  gap = 8,
  bottomRailHeight = 88,
  rootRailHeight = 144,
  zoomStripHeight = 34
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const safePadding = Math.max(0, padding);
  const railH = clamp(bottomRailHeight, 72, Math.max(72, Math.floor(safeHeight * 0.16)));
  const bottomRail = {
    x: safePadding,
    y: Math.max(safePadding, safeHeight - safePadding - railH),
    w: Math.max(1, safeWidth - safePadding * 2),
    h: railH
  };
  const viewRailH = clamp(rootRailHeight, 48, Math.max(48, Math.floor(safeHeight * 0.3)));
  const viewRail = {
    x: safePadding,
    y: Math.max(safePadding, bottomRail.y - gap - viewRailH),
    w: Math.max(1, safeWidth - safePadding * 2),
    h: viewRailH
  };
  const zoomStrip = {
    x: safePadding,
    y: Math.max(safePadding, viewRail.y - gap - zoomStripHeight),
    w: Math.max(1, safeWidth - safePadding * 2),
    h: zoomStripHeight
  };
  const workSurface = {
    x: safePadding,
    y: safePadding,
    w: Math.max(1, safeWidth - safePadding * 2),
    h: Math.max(1, zoomStrip.y - gap - safePadding)
  };
  return {
    bottomRail,
    rootRail: viewRail,
    rootTabs: viewRail,
    subRail: workSurface,
    sheetContent: workSurface,
    viewRail,
    zoomStrip,
    workSurface,
    gap,
    portraitRootPlacement: 'bottom-rail'
  };
}

export function getMidiSongActionSpecs(mode, { portrait = false, selectionLoopActive = false, clonePaintActive = false } = {}) {
  if (mode === 'edit') {
    return [
      { action: 'song-copy', label: 'Copy' },
      { action: 'song-cut', label: 'Cut' },
      { action: 'song-delete', label: 'Delete' },
      { action: 'song-paste', label: 'Paste' },
      { action: 'song-duplicate', label: portrait ? 'Dupe' : 'Duplicate' }
    ];
  }
  if (mode === 'tools') {
    return [
      { action: 'song-splice', label: 'Split' },
      { action: 'song-merge-left', label: portrait ? '← Merge' : 'Merge Left' },
      { action: 'song-merge-right', label: portrait ? 'Merge →' : 'Merge Right' },
      { action: 'song-clone-paint', label: portrait ? 'Clone' : 'Clone Paint', active: clonePaintActive },
      { action: 'song-shift-note', label: portrait ? 'Shift' : 'Shift Note' }
    ];
  }
  return [];
}

export function getMidiSongMusicControlSpecs({ portrait = false, isPlaying = false, loopEnabled = false, metronomeEnabled = false } = {}) {
  return [
    { key: 'songTransportStart', label: '⏮' },
    { key: 'songTransportBack', label: '⏪' },
    { key: 'songTransportForward', label: '⏩' },
    { key: 'songTransportEnd', label: '⏭' },
    { key: 'songTransportMetronome', label: 'M', active: metronomeEnabled },
    { key: 'songTransportPlayPause', label: isPlaying ? '❚❚' : '▶', active: isPlaying },
    { key: 'songTransportLoopThis', label: portrait ? MIDI_LOOP_ICON : 'Loop This', active: loopEnabled }
  ];
}

export function buildMidiGridZoomButtonModel() {
  return {
    visible: false,
    bounds: {
      zoomInX: null,
      zoomOutX: null,
      zoomInY: null,
      zoomOutY: null
    }
  };
}

export function getMidiGridZoomLimitsXForBars(bars = DEFAULT_GRID_BARS) {
  const safeBars = Math.max(1, Number(bars) || DEFAULT_GRID_BARS);
  const maxVisibleBars = Math.max(1, Math.min(MIDI_MAX_ZOOM_OUT_BARS, safeBars));
  return {
    minZoom: Math.max(1, safeBars / maxVisibleBars),
    maxZoom: Math.max(8, safeBars * 4)
  };
}

export function getMidiZoomFromSliderRatio(ratio, limits = getMidiGridZoomLimitsXForBars()) {
  const minZoom = Number.isFinite(limits?.minZoom) ? limits.minZoom : 1;
  const maxZoom = Math.max(minZoom, Number.isFinite(limits?.maxZoom) ? limits.maxZoom : minZoom);
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  if (safeRatio <= 0) return minZoom;
  if (safeRatio >= 1) return maxZoom;
  return minZoom + safeRatio * (maxZoom - minZoom);
}

export function getMidiPlacementSnapTicks({
  quantizeEnabled = true,
  ticksPerBar = 16,
  quantizeDivisor = 16,
  noteLengthDivisor = 4,
  drumTrack = false
} = {}) {
  void quantizeDivisor;
  void drumTrack;
  if (!quantizeEnabled) return 1;
  const divisor = noteLengthDivisor || 16;
  return Math.max(1, Math.round((Number(ticksPerBar) || 16) / (Number(divisor) || 16)));
}

const LOOP_HANDLE_MIN_WIDTH = 70;
const LOOP_HANDLE_MIN_HEIGHT = 38;
const DEFAULT_LOOP_BARS = 4;
const STANDARD_GUITAR_TUNING = [40, 45, 50, 55, 59, 64];
const STANDARD_BASS_TUNING = [28, 33, 38, 43];
const DEFAULT_KEYBOARD_START_OCTAVE = 4;
const MAX_KEYBOARD_START_OCTAVE = 7;
const GENRE_OPTIONS = [
  { id: 'random', label: 'Random' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'house', label: 'House' },
  { id: 'hip-hop', label: 'Hip-Hop' },
  { id: 'drum-bass', label: 'Drum & Bass' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'rock', label: 'Rock' }
];
const CHORD_PROGRESSION_LIBRARY = [
  {
    theme: 'happy',
    scale: 'major',
    chords: ['C', 'G', 'Am', 'F']
  },
  {
    theme: 'bright',
    scale: 'major',
    chords: ['C', 'F', 'G', 'C']
  },
  {
    theme: 'uplift',
    scale: 'major',
    chords: ['C', 'Am', 'F', 'G']
  },
  {
    theme: 'moody',
    scale: 'minor',
    chords: ['Am', 'F', 'C', 'G']
  },
  {
    theme: 'dark',
    scale: 'minor',
    chords: ['Am', 'G', 'F', 'E']
  }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uid = () => `note-${Math.floor(Math.random() * 1000000)}`;
const findNoteLengthIndex = (id) => {
  const index = NOTE_LENGTH_OPTIONS.findIndex((option) => option.id === id);
  return index >= 0 ? index : 0;
};
const isBlackKey = (pitchClass) => [1, 3, 6, 8, 10].includes(pitchClass);


const isDrumTrack = (track) => Boolean(track) && (track.instrument === 'drums' || isDrumChannel(track.channel));
const coerceDrumPitch = (pitch, rows = GM_DRUM_ROWS) => mapPitchToDrumRow(clampDrumPitch(pitch), rows);

export function getMidiPatternGridLayoutMetrics({
  x = 0,
  y = 0,
  w = 0,
  h = 0,
  gridTicks = 1,
  rows = 1,
  isMobile = false,
  isPortrait = false,
  drumGrid = false,
  simplified = false,
  hideLabels = false,
  gridZoomX = 1,
  gridZoomY = 1,
  baseVisibleRows = DEFAULT_VISIBLE_ROWS,
  zoomYLimits = { minZoom: 0.2, maxZoom: 1 },
  zoomXLimits = { minZoom: 1, maxZoom: 1 },
  portraitVisibleTicks = null,
  landscapeVisibleTicks = null,
  initialized = false
} = {}) {
  const portrait = Boolean(isMobile && isPortrait);
  const landscape = Boolean(isMobile && !isPortrait);
  const labelW = hideLabels
    ? 0
    : portrait
      ? DEFAULT_LABEL_WIDTH_MOBILE_PORTRAIT
      : landscape
        ? DEFAULT_LABEL_WIDTH_MOBILE_LANDSCAPE
        : DEFAULT_LABEL_WIDTH;
  const rulerH = simplified
    ? 0
    : portrait
      ? DEFAULT_RULER_HEIGHT_MOBILE_PORTRAIT
      : landscape
        ? DEFAULT_RULER_HEIGHT_MOBILE_LANDSCAPE
        : DEFAULT_RULER_HEIGHT;
  const viewW = Math.max(1, w - labelW);
  const viewH = Math.max(0, h - rulerH);
  const safeGridTicks = Math.max(1, gridTicks);
  const safeRows = Math.max(1, rows);
  const safeBaseVisibleRows = Math.max(1, Math.min(baseVisibleRows, safeRows));
  const baseCellWidth = viewW / safeGridTicks;
  let baseCellHeight = drumGrid
    ? Math.max(26, (h - rulerH - 12) / safeRows)
    : Math.min(24, (h - rulerH - 16) / safeBaseVisibleRows);
  let minZoomY = Number.isFinite(zoomYLimits?.minZoom) ? zoomYLimits.minZoom : 0.2;
  let maxZoomY = Number.isFinite(zoomYLimits?.maxZoom) ? zoomYLimits.maxZoom : 1;
  let minZoomX = Number.isFinite(zoomXLimits?.minZoom) ? zoomXLimits.minZoom : 1;
  let maxZoomX = Number.isFinite(zoomXLimits?.maxZoom) ? zoomXLimits.maxZoom : 1;
  let desiredVisibleRows = DEFAULT_VISIBLE_ROWS;

  if (portrait) {
    const targetCellHeight = drumGrid ? MIDI_PORTRAIT_DRUM_CELL_HEIGHT : MIDI_PORTRAIT_MELODIC_CELL_HEIGHT;
    const minCellHeight = drumGrid ? MIDI_PORTRAIT_DRUM_MIN_CELL_HEIGHT : MIDI_PORTRAIT_MELODIC_MIN_CELL_HEIGHT;
    baseCellHeight = targetCellHeight;
    minZoomY = Math.max(minZoomY, minCellHeight / baseCellHeight);
    maxZoomY = Math.max(maxZoomY, 2);
    minZoomX = Math.max(minZoomX, MIDI_PORTRAIT_MIN_CELL_WIDTH / Math.max(1, baseCellWidth));
    maxZoomX = Math.max(maxZoomX, minZoomX * 4);
    desiredVisibleRows = Math.min(safeRows, MIDI_PORTRAIT_DEFAULT_VISIBLE_ROWS);
  } else if (landscape) {
    const targetCellHeight = drumGrid ? MIDI_LANDSCAPE_DRUM_CELL_HEIGHT : MIDI_LANDSCAPE_MELODIC_CELL_HEIGHT;
    const minCellHeight = drumGrid ? MIDI_LANDSCAPE_DRUM_MIN_CELL_HEIGHT : MIDI_LANDSCAPE_MELODIC_MIN_CELL_HEIGHT;
    baseCellHeight = targetCellHeight;
    minZoomY = Math.max(minZoomY, minCellHeight / baseCellHeight);
    maxZoomY = Math.max(maxZoomY, 2);
    minZoomX = Math.max(minZoomX, safeGridTicks / Math.max(1, safeGridTicks));
    maxZoomX = Math.max(maxZoomX, minZoomX * 4);
    desiredVisibleRows = Math.max(1, Math.floor(viewH / targetCellHeight));
  }

  if (maxZoomY < minZoomY) maxZoomY = minZoomY;
  if (maxZoomX < minZoomX) maxZoomX = minZoomX;

  let nextZoomX = clamp(Number.isFinite(gridZoomX) ? gridZoomX : 1, minZoomX, maxZoomX);
  let nextZoomY = clamp(Number.isFinite(gridZoomY) ? gridZoomY : 1, minZoomY, maxZoomY);
  if (!initialized) {
    if (portrait && Number.isFinite(portraitVisibleTicks) && portraitVisibleTicks > 0) {
      nextZoomX = clamp(safeGridTicks / portraitVisibleTicks, minZoomX, maxZoomX);
    } else if (landscape && Number.isFinite(landscapeVisibleTicks) && landscapeVisibleTicks > 0) {
      nextZoomX = clamp(safeGridTicks / landscapeVisibleTicks, minZoomX, maxZoomX);
    }
    nextZoomY = clamp(viewH / (Math.max(1, desiredVisibleRows) * baseCellHeight), minZoomY, maxZoomY);
  }

  let cellWidth = baseCellWidth * nextZoomX;
  let cellHeight = baseCellHeight * nextZoomY;
  if (drumGrid && !portrait) {
    nextZoomY = 1;
    cellHeight = Math.max(24, (viewH - 4) / safeRows);
  }
  if (portrait) {
    cellWidth = Math.max(MIDI_PORTRAIT_MIN_CELL_WIDTH, cellWidth);
    cellHeight = Math.max(drumGrid ? MIDI_PORTRAIT_DRUM_MIN_CELL_HEIGHT : MIDI_PORTRAIT_MELODIC_MIN_CELL_HEIGHT, cellHeight);
  } else if (landscape) {
    cellHeight = Math.max(drumGrid ? MIDI_LANDSCAPE_DRUM_MIN_CELL_HEIGHT : MIDI_LANDSCAPE_MELODIC_MIN_CELL_HEIGHT, cellHeight);
  }

  return {
    portrait,
    landscape,
    labelW,
    rulerH,
    viewW,
    viewH,
    baseCellWidth,
    baseCellHeight,
    cellWidth,
    cellHeight,
    gridZoomX: nextZoomX,
    gridZoomY: nextZoomY,
    minZoomX,
    maxZoomX,
    minZoomY,
    maxZoomY,
    totalGridW: cellWidth * safeGridTicks,
    gridH: drumGrid && !portrait ? viewH : cellHeight * safeRows,
    originBaseX: x + labelW,
    originBaseY: y + rulerH
  };
}

const normalizeMidiTuning = (value, fallback) => {
  if (!Array.isArray(value)) return [...fallback];
  return fallback.map((fallbackPitch, index) => {
    const pitch = Number(value[index]);
    return Number.isFinite(pitch) ? clamp(Math.round(pitch), 0, 127) : fallbackPitch;
  });
};

const createDefaultSong = () => ({
  schemaVersion: GM_SCHEMA_VERSION,
  tempo: 120,
  loopBars: DEFAULT_GRID_BARS,
  loopStartTick: null,
  loopEndTick: null,
  loopEnabled: false,
  timeSignature: { beats: 4, unit: 4 },
  highContrast: false,
  reverseStrings: false,
  keyboardStartOctave: DEFAULT_KEYBOARD_START_OCTAVE,
  guitarTuning: [...STANDARD_GUITAR_TUNING],
  bassTuning: [...STANDARD_BASS_TUNING],
  staccatoEnabled: false,
  key: 0,
  scale: 'major',
  chordMode: false,
  tracks: [
    {
      id: 'track-piano',
      name: 'Piano',
      channel: 0,
      program: 0,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[0],
      automation: { pan: [], padding: [] },
      patterns: [{ id: 'pattern-piano', bars: DEFAULT_GRID_BARS, notes: [] }]
    },
    {
      id: 'track-guitar',
      name: 'Guitar',
      channel: 1,
      program: 24,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[1],
      automation: { pan: [], padding: [] },
      patterns: [{ id: 'pattern-guitar', bars: DEFAULT_GRID_BARS, notes: [] }]
    },
    {
      id: 'track-bass',
      name: 'Bass',
      channel: 2,
      program: 33,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[2],
      automation: { pan: [], padding: [] },
      patterns: [{ id: 'pattern-bass', bars: DEFAULT_GRID_BARS, notes: [] }]
    },
    {
      id: 'track-drums',
      name: 'Drums',
      instrument: 'drums',
      channel: GM_DRUM_CHANNEL,
      program: 0,
      bankMSB: DRUM_BANK_MSB,
      bankLSB: DRUM_BANK_LSB,
      volume: 0.9,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[3],
      automation: { pan: [], padding: [] },
      patterns: [{ id: 'pattern-drums', bars: DEFAULT_GRID_BARS, notes: [] }]
    }
  ],
  progression: [
    { root: 0, quality: 'min', startBar: 1, lengthBars: 1 },
    { root: 5, quality: 'min', startBar: 2, lengthBars: 1 },
    { root: 7, quality: 'maj', startBar: 3, lengthBars: 1 },
    { root: 3, quality: 'maj', startBar: 4, lengthBars: 1 }
  ]
});

const createDemoSong = () => scaleMidiSongTiming({
  schemaVersion: GM_SCHEMA_VERSION,
  tempo: 116,
  loopBars: 8,
  loopStartTick: null,
  loopEndTick: null,
  loopEnabled: true,
  timeSignature: { beats: 4, unit: 4 },
  highContrast: false,
  reverseStrings: false,
  keyboardStartOctave: DEFAULT_KEYBOARD_START_OCTAVE,
  guitarTuning: [...STANDARD_GUITAR_TUNING],
  bassTuning: [...STANDARD_BASS_TUNING],
  key: 0,
  scale: 'major',
  tracks: [
    {
      id: 'track-demo-piano',
      name: 'Piano',
      channel: 0,
      program: 0,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.85,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[0],
      patterns: [
        {
          id: 'pattern-demo-piano',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 8, pitch: 60, velocity: 0.9 },
            { id: uid(), startTick: 8, durationTicks: 8, pitch: 64, velocity: 0.85 },
            { id: uid(), startTick: 16, durationTicks: 8, pitch: 67, velocity: 0.85 },
            { id: uid(), startTick: 24, durationTicks: 8, pitch: 72, velocity: 0.9 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-strings',
      name: 'Strings',
      channel: 1,
      program: 48,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[1],
      patterns: [
        {
          id: 'pattern-demo-strings',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 16, pitch: 55, velocity: 0.7 },
            { id: uid(), startTick: 16, durationTicks: 16, pitch: 57, velocity: 0.7 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-brass',
      name: 'Brass',
      channel: 2,
      program: 61,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[2],
      patterns: [
        {
          id: 'pattern-demo-brass',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 6, pitch: 62, velocity: 0.8 },
            { id: uid(), startTick: 8, durationTicks: 6, pitch: 65, velocity: 0.8 },
            { id: uid(), startTick: 16, durationTicks: 6, pitch: 69, velocity: 0.8 },
            { id: uid(), startTick: 24, durationTicks: 6, pitch: 67, velocity: 0.8 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-synth',
      name: 'Synth Lead',
      channel: 3,
      program: 80,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.75,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[3],
      patterns: [
        {
          id: 'pattern-demo-synth',
          bars: 8,
          notes: [
            { id: uid(), startTick: 4, durationTicks: 4, pitch: 72, velocity: 0.7 },
            { id: uid(), startTick: 12, durationTicks: 4, pitch: 74, velocity: 0.7 },
            { id: uid(), startTick: 20, durationTicks: 4, pitch: 76, velocity: 0.7 },
            { id: uid(), startTick: 28, durationTicks: 4, pitch: 77, velocity: 0.7 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-guitar',
      name: 'Distortion',
      channel: 4,
      program: 30,
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[4],
      patterns: [
        {
          id: 'pattern-demo-guitar',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 4, pitch: 52, velocity: 0.8 },
            { id: uid(), startTick: 8, durationTicks: 4, pitch: 55, velocity: 0.8 },
            { id: uid(), startTick: 16, durationTicks: 4, pitch: 57, velocity: 0.8 },
            { id: uid(), startTick: 24, durationTicks: 4, pitch: 55, velocity: 0.8 }
          ]
        }
      ]
    },
    {
      id: 'track-demo-drums',
      name: 'Drums',
      instrument: 'drums',
      channel: GM_DRUM_CHANNEL,
      program: 0,
      bankMSB: DRUM_BANK_MSB,
      bankLSB: DRUM_BANK_LSB,
      volume: 0.9,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[5],
      patterns: [
        {
          id: 'pattern-demo-drums',
          bars: 8,
          notes: [
            { id: uid(), startTick: 0, durationTicks: 2, pitch: 36, velocity: 0.9 },
            { id: uid(), startTick: 4, durationTicks: 2, pitch: 38, velocity: 0.9 },
            { id: uid(), startTick: 8, durationTicks: 2, pitch: 42, velocity: 0.7 },
            { id: uid(), startTick: 12, durationTicks: 2, pitch: 46, velocity: 0.6 },
            { id: uid(), startTick: 16, durationTicks: 2, pitch: 36, velocity: 0.9 },
            { id: uid(), startTick: 20, durationTicks: 2, pitch: 38, velocity: 0.9 },
            { id: uid(), startTick: 24, durationTicks: 2, pitch: 49, velocity: 0.7 },
            { id: uid(), startTick: 28, durationTicks: 2, pitch: 51, velocity: 0.7 }
          ]
        }
      ]
    }
  ],
  progression: [
    { root: 0, quality: 'maj', startBar: 1, lengthBars: 2 },
    { root: 5, quality: 'maj', startBar: 3, lengthBars: 2 },
    { root: 7, quality: 'maj', startBar: 5, lengthBars: 2 },
    { root: 3, quality: 'maj', startBar: 7, lengthBars: 2 }
  ]
}, MIDI_TICKS_PER_BEAT / LEGACY_MIDI_TICKS_PER_BEAT);

function scaleMidiSongTiming(song, scale = 1) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (safeScale === 1 || !song || typeof song !== 'object') return song;
  const scaleTick = (value, { nullable = false } = {}) => {
    if (nullable && value === null) return null;
    if (!Number.isFinite(Number(value))) return value;
    return Math.max(0, Math.round(Number(value) * safeScale));
  };
  return {
    ...song,
    loopStartTick: scaleTick(song.loopStartTick, { nullable: true }),
    loopEndTick: scaleTick(song.loopEndTick, { nullable: true }),
    tracks: Array.isArray(song.tracks)
      ? song.tracks.map((track) => ({
        ...track,
        patterns: Array.isArray(track.patterns)
          ? track.patterns.map((pattern) => ({
            ...pattern,
            notes: Array.isArray(pattern.notes)
              ? pattern.notes.map((note) => ({
                ...note,
                startTick: scaleTick(note.startTick),
                durationTicks: Math.max(1, scaleTick(note.durationTicks))
              }))
              : []
          }))
          : []
      }))
      : []
  };
}

export default class MidiComposer {
  constructor(game) {
    this.game = game;
    this.sharedMenu = new SharedEditorMenu();
    this.controllerMenu = new ControllerMenuStack({
      siblingOrder: MIDI_CONTROLLER_SIBLING_ORDER
    });
    this.storageKey = 'chainsaw-midi-composer';
    this.song = this.loadSong();
    initializeComposerState(this, {
      quantizeOptions: QUANTIZE_OPTIONS,
      quantizeIndex: findNoteLengthIndex('1/4'),
      noteLengthIndex: findNoteLengthIndex('1/4'),
      song: this.song,
      cachedPrograms: this.loadCachedPrograms(),
      instrumentFamilyTabs: INSTRUMENT_FAMILY_TABS
    });
    this.toolsMenuOpen = false;
    this.genreMenuOpen = false;
    this.selectedGenre = 'random';
    this.qaOverlayOpen = false;
    this.confirmOverlayOpen = false;
    this.recordModeActive = false;
    this.recordQuantizeEnabled = true;
    this.recordQuantizeDivisor = 16;
    this.recordCountInEnabled = false;
    this.recordMetronomeEnabled = false;
    this.recordDevicePreference = 'auto';
    this.recordInstrument = 'keyboard';
    this.recordStatus = { degree: 1, octave: 0, velocity: 96 };
    this.nowPlaying = {
      active: false,
      label: '',
      detail: '',
      type: 'note'
    };
    this.nowPlayingNotes = new Map();
    this.recordStickIndicators = {
      left: { x: 0, y: 0, active: false },
      right: { x: 0, y: 0, active: false }
    };
    this.singleNoteRecordMode = {
      active: false,
      anchorTick: 0,
      measureStart: 0,
      measureEnd: 0,
      awaitingChord: true
    };
    this.singleNoteActiveNotes = new Map();
    this.recordSelector = {
      active: false,
      type: null,
      index: 0,
      stickEngaged: false
    };
    this.inputBus = new InputEventBus();
    this.keyboardInput = new KeyboardInput(this.inputBus);
    this.gamepadInput = new RobterspielInput(this.inputBus);
    this.touchInput = new TouchInput(this.inputBus);
    this.reverseStrings = Boolean(this.song?.reverseStrings);
    this.touchInput.setReverseStrings(this.reverseStrings);
    this.touchInput.setKeyboardStartOctave(this.song?.keyboardStartOctave ?? DEFAULT_KEYBOARD_START_OCTAVE);
    this.touchInput.setStringTunings({
      guitar: normalizeMidiTuning(this.song?.guitarTuning, STANDARD_GUITAR_TUNING),
      bass: normalizeMidiTuning(this.song?.bassTuning, STANDARD_BASS_TUNING)
    });
    this.recordLayout = new RecordModeLayout({ touchInput: this.touchInput });
    this.recorder = new MidiRecorder({ getTime: () => this.getRecordingTime() });
    this.recordGridSnapshot = null;
    this.recordGridZoomedOut = false;
    this.recordCountIn = null;
    this.registerInputHandlers();
    this.qaResults = [];
    this.draggingTrackControl = null;
    this.longPressTimer = null;
    this.lastAuditionTime = 0;
    this.gamepadMoveCooldown = 0;
    this.gamepadResizeCooldown = 0;
    this.gamepadCursorActive = false;
    this.gamepadSelection = { active: false };
    this.gamepadResizeMode = { active: false };
    this.gamepadTransportTap = { left: 0, right: 0 };
    this.inputActionNormalizer = new EditorInputActionNormalizer();
    this.lastPointer = { x: 0, y: 0 };
    this.placingEndMarker = false;
    this.placingStartMarker = false;
    this.settingsOpen = false;
    this.settingsScroll = 0;
    this.settingsScrollMax = 0;
    this.openDesktopDropdownRootId = null;
    this.closedDesktopDropdownRootId = null;
    this.desktopDropdown = null;
    this.desktopDropdownScroll = {};
    this.pendingDesktopDropdownHit = null;
    this.gamepadSlideOutMenuMeta = null;
    this.menuScrollRegions = [];
    this.landscapeRootDrawerOpen = false;
    this.songTrackScroll = 0;
    this.songTrackScrollMax = 0;
    this.instrumentListScroll = 0;
    this.instrumentListScrollMax = 0;
    this.pendingTrackFocusIndex = null;
    this.pendingGridFocus = null;
    this.pendingSongFocus = null;
    this.gridViewportMemory = null;
    this.songViewportMemory = null;
    this.lastPersistedSnapshot = null;
    this.lastSavedSnapshot = null;
    this._dirty = false;
    this._persistTimer = null;
    this._persistDelayMs = 300;
    this._historyCommitDelayMs = 500;
    this.trackPreloadPromises = new Map();
    this.pendingPlaybackAfterPreload = false;
    this.playbackClockSeconds = 0;
    this.playbackLastClockSeconds = null;
    this.playbackStartTick = 0;
    this.scheduledUntilTick = 0;
    this.playbackAudioAnchorSeconds = null;
    this.playbackAudioAnchorTick = 0;
    this.playbackEventCache = null;
    this.droppedPlaybackEvents = 0;
    this.runtime = createEditorRuntime({
      context: this,
      document: {
        folder: 'music',
        strings: {
          saveAsTitle: 'Save Song As',
          openTitle: 'Open Song',
          discardChanges: 'Discard unsaved song changes?',
          closePrompt: 'Save changes before closing?'
        },
        confirm: (ctx, message) => ctx.confirmDiscardChangesModal(message),
        serialize: (ctx) => ctx.song,
        isEmptyDocument: (_ctx, data) => {
          if (!data || typeof data !== 'object') return true;
          const tracks = Array.isArray(data.tracks) ? data.tracks : [];
          return !tracks.some((track) => {
            if (Array.isArray(track?.notes) && track.notes.length > 0) return true;
            const patterns = Array.isArray(track?.patterns) ? track.patterns : [];
            return patterns.some((pattern) => Array.isArray(pattern?.notes) && pattern.notes.length > 0);
          });
        },
        beforeSave: (ctx, meta) => {
          const previousName = ctx.song.name;
          ctx.song.name = meta.name;
          return () => { ctx.song.name = previousName; };
        },
        applyLoadedData: (ctx, data, meta) => {
          ctx.applyImportedSong(data);
          ctx.song.name = meta.name;
        },
        afterOpen: (ctx) => {
          ctx.activeTab = 'grid';
          ctx.focusFirstSongContentAfterOpen();
          ctx.mobilePortraitFilePanelBounds = null;
          ctx.controllerMenu.resetFocus();
        },
        onAfterSave: (ctx, meta) => {
          ctx.song.name = meta.name;
          ctx.selection.clear();
          ctx.lastPersistedSnapshot = JSON.stringify(ctx.song);
          ctx._dirty = false;
          ctx.commitHistorySnapshot();
        }
      },
      history: {
        limit: 80,
        debounceMs: this._historyCommitDelayMs,
        createSnapshot: () => {
          try {
            return JSON.stringify(this.song);
          } catch (error) {
            console.warn('history snapshot failed', error);
            return null;
          }
        },
        applySnapshot: (snapshot) => this.applySongSnapshot(snapshot, { updateHistory: false })
      }
    });
    this.history = this.runtime.history;
    this._needsEnsureState = false;
    this.debug = { perf: false };
    this.currentDocumentRef = null;
    this.savedSnapshot = null;
    this.fileMenuScroll = 0;
    this.fileMenuScrollMax = 0;
    this.fileMenuListBounds = null;
    this.mobilePortraitMenuSheetBounds = null;
    this.recentInstruments = this.loadInstrumentList('chainsaw-midi-recent', []);
    this.favoriteInstruments = this.loadInstrumentList('chainsaw-midi-favorites', []);
    this.controllerMapping = this.loadControllerMapping();
    this.selectionMenu = {
      open: false,
      x: 0,
      y: 0,
      bounds: []
    };
    this.songSelection = {
      active: false,
      trackIndex: 0,
      trackStartIndex: 0,
      trackEndIndex: 0,
      startTick: 0,
      endTick: 0
    };
    this.songSelectionMenu = {
      open: false,
      x: 0,
      y: 0,
      bounds: []
    };
    this.songSplitTool = {
      active: false,
      tick: 0,
      bounds: {
        lineGrab: null,
        handleTop: null,
        handleBottom: null,
        splitAction: null,
        cancelAction: null
      }
    };
    this.songShiftTool = {
      active: false,
      semitones: 0,
      bounds: {
        slider: null,
        knob: null,
        apply: null,
        cancel: null
      }
    };
    this.songClonePaintTool = {
      active: false,
      trackIndex: null,
      baseStartTick: null,
      baseEndTick: null,
      baseNotes: []
    };
    this.songClipboard = null;
    this.defaultNoteDurationTicks = null;
    this.noteLengthMenu = {
      open: false,
      anchor: null
    };
    this.tempoSliderOpen = false;
    this.pastePreview = null;
    this.panJoystick = {
      active: false,
      id: null,
      dx: 0,
      dy: 0,
      center: { x: 0, y: 0 },
      radius: 0,
      knobRadius: 0
    };
    this.gridZoomX = null;
    this.gridZoomY = null;
    this.gridOffset = { x: 0, y: 0 };
    this.gridOffsetInitialized = false;
    this.gridGesture = null;
    this.songGesture = null;
    this.timelineStartTick = 0;
    this.timelineSource = 'grid';
    this.songTimelineZoomX = 1;
    this.songTimelineOffsetX = 0;
    this.songMixControlMode = 'volume';
    this.songBottomRailMode = 'music-controls';
    this.midiPortraitTrackPickerOpen = false;
    this.midiPortraitTrackPickerScroll = 0;
    this.midiPortraitTrackPickerScrollMax = 0;
    this.midiPortraitMasterVolumeOpen = false;
    this.midiPortraitRecordSettingsOpen = false;
    this.transportHold = null;
    this.transportPopover = null;
    this.viewportController = createViewportController();
    this.songTimelineBounds = null;
    this.songPlayheadBounds = null;
    this.songRulerTap = {
      barIndex: null,
      at: 0
    };
    this.bounds = {
      headerInstrument: null,
      fileButton: null,
      leftSettings: null,
      headerTempoDown: null,
      headerTempoUp: null,
      headerPlayState: null,
      tabs: [],
      transportBar: null,
      play: null,
      stop: null,
      loopToggle: null,
      transportLoopToggle: null,
      railInstruments: null,
      railSettings: null,
      railZoom: null,
      returnStart: null,
      setStart: null,
      setEnd: null,
      prevBar: null,
      nextBar: null,
      goEnd: null,
      record: null,
      instrumentLauncher: null,
      metronome: null,
      timeDisplay: null,
      tempoDown: null,
      tempoUp: null,
      tempoButton: null,
      tempoSlider: null,
      instrumentTile: null,
      instrumentFavorite: null,
      instrumentSection: null,
      instrumentFamilyTab: null,
      gridControls: [],
      gridQuickControls: [],
      midiPortraitTrackPicker: null,
      midiPortraitTrackPickerScrollArea: null,
      midiPortraitTrackPickerRows: [],
      midiPortraitMasterVolumePanel: null,
      midiPortraitMasterVolumeSlider: null,
      recordVirtualInstrument: null,
      recordSettings: null,
      recordSettingsPanel: null,
      recordSettingsControls: [],
      toolButtons: [],
      quantizeToggle: null,
      quantizeValue: null,
      noteLength: null,
      snapToggle: null,
      scaleLock: null,
      preview: null,
      scrub: null,
      swing: null,
      settingsControls: [],
      controllerControls: [],
      soundfontUrl: null,
      soundfontReset: null,
      addTrack: null,
      removeTrack: null,
      duplicateTrack: null,
      instrumentPrev: null,
      instrumentNext: null,
      instrumentLabel: null,
      instrumentAdd: null,
      instrumentList: [],
      instrumentListScrollArea: null,
      songTrackScrollArea: null,
      instrumentSettingsControls: [],
      selectionMenu: [],
      noteLengthMenu: [],
      pasteAction: null,
      zoomInX: null,
      zoomOutX: null,
      zoomInY: null,
      zoomOutY: null,
      loopStartHandle: null,
      loopEndHandle: null,
      loopShiftStartHandle: null,
      loopShiftEndHandle: null,
      songZoomIn: null,
      songZoomOut: null,
      keyframeToggle: null,
      keyframePrev: null,
      keyframeSet: null,
      keyframeRemove: null,
      keyframeNext: null,
      songMixVolumeTab: null,
      songMixPanTab: null,
      songRailEditTab: null,
      songMixRail: null,
      transportPopoverButtons: [],
      pedalInspectorToggle: null
    };
    this.trackBounds = [];
    this.trackControlBounds = [];
    this.pedalSlotBounds = [];
    this.pedalPickerBounds = [];
    this.pedalInspectorBounds = [];
    this.pedalEditorOverlayBounds = null;
    this.pedalEditorModalBounds = null;
    this.pedalUiState = { selectedSlot: null, pickerSlot: null, pickerOpen: false, pickerPage: 0, pickerScroll: 0, editorOpen: false, draftPedal: null };
    this.patternBounds = [];
    this.noteBounds = [];
    this.toolsMenuBounds = [];
    this.fileMenuBounds = [];
    this.genreMenuBounds = [];
    this.noteLabelBounds = [];
    this.gridBounds = null;
    this.rulerBounds = null;
    this.gridZoomInitialized = false;
    this.songLaneBounds = [];
    this.songLabelBounds = [];
    this.songAutomationBounds = [];
    this.bounds.keyframePrev = null;
    this.bounds.keyframeSet = null;
    this.bounds.keyframeRemove = null;
    this.bounds.keyframeNext = null;
    this.bounds.songMixVolumeTab = null;
    this.bounds.songMixPanTab = null;
    this.songActionBounds = [];
    this.songPartBounds = [];
    this.songPartHandleBounds = [];
    this.songInstrumentBounds = null;
    this.songAddBounds = null;
    this.songRulerBounds = null;
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,.mid,.midi,.zip,application/json,audio/midi,application/zip';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      this.importSongFile(file)
        .catch((error) => {
          console.warn('Invalid song file', error);
          this.showEditorMessage('Failed to import song data.');
        })
        .finally(() => {
          this.fileInput.value = '';
        });
    });
    this.game.audio.ensureMidiSampler();
    this.audioSettings = this.loadAudioSettings();
    this.applyAudioSettings();
    this.ensureState();
    const initialSnapshot = JSON.stringify(this.song);
    this.lastPersistedSnapshot = initialSnapshot;
    this.history.reset(initialSnapshot);
    this.lastSavedSnapshot = initialSnapshot;
    this._dirty = false;
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
    this.preloadDefaultInstruments();
  }

  getRecordingTime() {
    if (this.game?.audio?.ctx?.currentTime) {
      return this.game.audio.ctx.currentTime;
    }
    return performance.now() / 1000;
  }

  getPlaybackClockSeconds() {
    return this.getRecordingTime();
  }

  resyncPlaybackClock(anchorTick = this.playheadTick) {
    const now = this.getPlaybackClockSeconds();
    this.playbackClockSeconds = now;
    this.playbackLastClockSeconds = now;
    this.playbackStartTick = anchorTick;
    this.lastPlaybackTick = anchorTick;
    this.scheduledUntilTick = anchorTick;
    const audioNow = this.game?.audio?.ctx?.currentTime;
    this.playbackAudioAnchorSeconds = Number.isFinite(audioNow)
      ? audioNow + Math.max(this.game?.audio?.midiLatency || 0, MIDI_MIN_SCHEDULE_LATENCY_SECONDS)
      : null;
    this.playbackAudioAnchorTick = anchorTick;
  }

  registerInputHandlers() {
    registerComposerInputHandlers(this);
  }

  loadSong() {
    const projectFilePayload = loadProjectFile('music', MIDI_COMPOSER_AUTOSAVE_DOC);
    if (projectFilePayload?.data) {
      const validation = this.validateSong(projectFilePayload.data);
      if (validation.valid) {
        return this.migrateSong(projectFilePayload.data);
      }
    }
    return createDefaultSong();
  }

  loadCachedPrograms() {
    try {
      const stored = loadServerPreference(CACHED_SOUND_FONT_KEY, []);
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  saveCachedPrograms() {
    void saveServerPreference(CACHED_SOUND_FONT_KEY, Array.from(this.cachedPrograms));
  }

  preloadDefaultInstruments() {
    const audio = this.game?.audio;
    if (!audio?.preloadSoundfontProgram) return;
    DEFAULT_PRELOAD_PROGRAMS.forEach((program) => audio.preloadSoundfontProgram(program, 0));
    audio.preloadSoundfontProgram(0, GM_DRUM_CHANNEL, DRUM_BANK_MSB, DRUM_BANK_LSB);
  }

  ensureDrumTrackSettings(track) {
    if (!isDrumTrack(track)) return track;
    track.instrument = 'drums';
    track.channel = GM_DRUM_CHANNEL;
    if (!Number.isInteger(track.bankMSB) || track.bankMSB === DEFAULT_BANK_MSB) {
      track.bankMSB = DRUM_BANK_MSB;
    }
    track.bankLSB = DRUM_BANK_LSB;
    track.program = clamp(track.program ?? 0, 0, 127);
    return track;
  }

  normalizeDrumPattern(track, pattern, rows = GM_DRUM_ROWS) {
    if (!pattern || !isDrumTrack(track)) return;
    pattern.notes = pattern.notes.map((note) => ({
      ...note,
      pitch: coerceDrumPitch(note.pitch, rows)
    }));
  }

  normalizeSongDrums() {
    if (!this.song?.tracks) return;
    this.song.tracks.forEach((track) => {
      if (!isDrumTrack(track)) return;
      this.ensureDrumTrackSettings(track);
      track.patterns?.forEach((pattern) => this.normalizeDrumPattern(track, pattern));
    });
  }

  markDirty() {
    this._dirty = true;
    this.invalidatePlaybackEventCache();
    this.schedulePersist();
  }

  invalidatePlaybackEventCache() {
    this.playbackEventCache = null;
  }

  schedulePersist() {
    if (this._persistTimer) {
      if (this._persistTimer.type === 'idle' && window.cancelIdleCallback) {
        window.cancelIdleCallback(this._persistTimer.id);
      } else {
        clearTimeout(this._persistTimer.id);
      }
      this._persistTimer = null;
    }
    if (this.isPlaying) {
      const id = window.setTimeout(() => this.flushPersist(), 1200);
      this._persistTimer = { type: 'timeout', id };
      return;
    }
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(() => this.flushPersist(), { timeout: 800 });
      this._persistTimer = { type: 'idle', id };
    } else {
      const id = window.setTimeout(() => this.flushPersist(), this._persistDelayMs);
      this._persistTimer = { type: 'timeout', id };
    }
  }

  flushPersist({ force = false } = {}) {
    if (!this._dirty) return;
    if (this.isPlaying && !force) {
      this.schedulePersist();
      return;
    }
    const perfEnabled = this.debug?.perf;
    const start = perfEnabled ? performance.now() : 0;
    try {
      this.normalizeSongDrums();
      const snapshot = JSON.stringify(this.song);
      if (snapshot !== this.lastPersistedSnapshot) {
        this.lastPersistedSnapshot = snapshot;
        const data = this.song;
        saveProjectFile('music', MIDI_COMPOSER_AUTOSAVE_DOC, data, { createVersion: false });
        const documentAutosaveName = this.getDocumentAutosaveName();
        if (documentAutosaveName && documentAutosaveName !== MIDI_COMPOSER_AUTOSAVE_DOC) {
          saveProjectFile('music', documentAutosaveName, data, { createVersion: false });
        }
      }
    } catch (error) {
      console.warn('persist failed', error);
    } finally {
      this._dirty = false;
      this._persistTimer = null;
      if (perfEnabled) {
        const elapsed = performance.now() - start;
        if (elapsed > 12) {
          const sizeEstimate = this.lastPersistedSnapshot?.length || this.history.currentSnapshot?.length || 0;
          console.warn(`[perf] flushPersist ${elapsed.toFixed(1)}ms (song ${sizeEstimate} chars)`);
        }
      }
    }
  }

  getDocumentAutosaveName() {
    const name = String(this.currentDocumentRef?.name || this.song?.name || '').trim();
    const baseName = name.replace(/(?: Autosave\d*)+$/g, '').trim();
    if (!baseName || baseName === MIDI_COMPOSER_AUTOSAVE_DOC) return '';
    return `${baseName}${MIDI_AUTOSAVE_SUFFIX}`;
  }

  persist({ commitHistory = false } = {}) {
    if (commitHistory) {
      if (this.isPlaying) {
        this.scheduleHistoryCommit();
      } else {
        this.commitHistorySnapshot();
      }
    }
    this.saveCurrentPersistentViewport();
    this.markDirty();
  }

  resetHistory() {
    this.history.reset();
    this.lastPersistedSnapshot = null;
  }

  markSavedSnapshot() {
    this.lastSavedSnapshot = this.lastPersistedSnapshot ?? this.history.currentSnapshot;
    if (this.lastPersistedSnapshot) {
      this._dirty = false;
    }
    this.runtime.markSavedSnapshot();
  }


  commitHistorySnapshot() {
    this.runtime.commitHistory(undefined, { baseSnapshot: this.history.currentSnapshot ?? this.lastPersistedSnapshot });
  }

  scheduleHistoryCommit() {
    this.runtime.scheduleHistoryCommit();
  }

  getMidiComposerEditorState() {
    if (!this.song || typeof this.song !== 'object') return null;
    if (!this.song.editorState || typeof this.song.editorState !== 'object') {
      this.song.editorState = {};
    }
    if (!this.song.editorState.midiComposer || typeof this.song.editorState.midiComposer !== 'object') {
      this.song.editorState.midiComposer = {};
    }
    const state = this.song.editorState.midiComposer;
    if (!state.trackViewports || typeof state.trackViewports !== 'object') {
      state.trackViewports = {};
    }
    return state;
  }

  getTrackViewportKey(track = this.getActiveTrack()) {
    if (!track) return null;
    return track.id || track.name || `track-${this.selectedTrackIndex}`;
  }

  sanitizeGridViewportState(viewport, track = this.getActiveTrack()) {
    if (!viewport || typeof viewport !== 'object') return null;
    const range = isDrumTrack(track) ? null : this.getPitchRange();
    const gridOffset = viewport.gridOffset && typeof viewport.gridOffset === 'object'
      ? {
        x: Number.isFinite(viewport.gridOffset.x) ? viewport.gridOffset.x : 0,
        y: Number.isFinite(viewport.gridOffset.y) ? viewport.gridOffset.y : 0
      }
      : null;
    const cursorTick = Number.isFinite(viewport.cursorTick) ? Math.max(0, Math.round(viewport.cursorTick)) : null;
    let cursorPitch = Number.isFinite(viewport.cursorPitch) ? Math.round(viewport.cursorPitch) : null;
    if (cursorPitch !== null && range) cursorPitch = clamp(cursorPitch, range.min, range.max);
    return {
      gridOffset,
      timelineStartTick: Number.isFinite(viewport.timelineStartTick) ? Math.max(0, viewport.timelineStartTick) : null,
      gridZoomX: Number.isFinite(viewport.gridZoomX) ? viewport.gridZoomX : null,
      gridZoomY: Number.isFinite(viewport.gridZoomY) ? viewport.gridZoomY : null,
      cursorTick,
      cursorPitch,
      selectedPatternIndex: Number.isInteger(viewport.selectedPatternIndex) ? Math.max(0, viewport.selectedPatternIndex) : null
    };
  }

  saveCurrentPersistentViewport() {
    const state = this.getMidiComposerEditorState();
    if (!state) return false;
    const track = this.getActiveTrack();
    const key = this.getTrackViewportKey(track);
    if (!state || !track || !key) return false;
    state.lastTrackId = track.id || key;
    state.lastTab = this.activeTab === 'song' ? 'song' : 'grid';
    const entry = state.trackViewports[key] && typeof state.trackViewports[key] === 'object'
      ? state.trackViewports[key]
      : {};
    entry.trackId = track.id || key;
    entry.trackName = track.name || '';
    entry.updatedAt = Date.now();
    entry.grid = {
      gridOffset: this.gridOffset ? { ...this.gridOffset } : { x: 0, y: 0 },
      timelineStartTick: Number.isFinite(this.timelineStartTick) ? this.timelineStartTick : 0,
      gridZoomX: Number.isFinite(this.gridZoomX) ? this.gridZoomX : this.getDefaultGridZoomX(),
      gridZoomY: Number.isFinite(this.gridZoomY) ? this.gridZoomY : this.getDefaultGridZoomY(),
      cursorTick: Number.isFinite(this.cursor?.tick) ? this.cursor.tick : this.playheadTick,
      cursorPitch: Number.isFinite(this.cursor?.pitch) ? this.cursor.pitch : null,
      selectedPatternIndex: this.selectedPatternIndex
    };
    entry.song = {
      songTimelineOffsetX: Number.isFinite(this.songTimelineOffsetX) ? this.songTimelineOffsetX : 0,
      songTrackScroll: Number.isFinite(this.songTrackScroll) ? this.songTrackScroll : 0,
      timelineStartTick: Number.isFinite(this.timelineStartTick) ? this.timelineStartTick : 0,
      gridZoomX: Number.isFinite(this.gridZoomX) ? this.gridZoomX : this.getDefaultGridZoomX(),
      selectedTrackIndex: this.selectedTrackIndex
    };
    state.trackViewports[key] = entry;
    return true;
  }

  persistViewportState() {
    if (this.saveCurrentPersistentViewport()) {
      this.markDirty();
    }
  }

  getSavedViewportForTrack(trackIndex = this.selectedTrackIndex) {
    const track = this.song?.tracks?.[trackIndex];
    const key = this.getTrackViewportKey(track);
    const state = this.song?.editorState?.midiComposer;
    if (!track || !key || !state?.trackViewports) return null;
    return state.trackViewports[key] || null;
  }

  restorePersistedViewportForTrack(trackIndex = this.selectedTrackIndex) {
    const track = this.song?.tracks?.[trackIndex];
    const saved = this.getSavedViewportForTrack(trackIndex);
    const grid = this.sanitizeGridViewportState(saved?.grid, track);
    if (!track || !grid) return false;
    this.selectedTrackIndex = clamp(trackIndex, 0, Math.max(0, this.song.tracks.length - 1));
    if (Number.isInteger(grid.selectedPatternIndex)) {
      this.selectedPatternIndex = clamp(grid.selectedPatternIndex, 0, Math.max(0, (track.patterns?.length || 1) - 1));
    }
    if (grid.gridOffset) this.gridOffset = { ...grid.gridOffset };
    if (Number.isFinite(grid.gridZoomX)) this.gridZoomX = grid.gridZoomX;
    if (Number.isFinite(grid.gridZoomY)) this.gridZoomY = grid.gridZoomY;
    if (Number.isFinite(grid.timelineStartTick)) this.timelineStartTick = grid.timelineStartTick;
    if (Number.isFinite(grid.cursorTick)) this.cursor.tick = grid.cursorTick;
    if (Number.isFinite(grid.cursorPitch)) this.cursor.pitch = this.coercePitchForTrack(grid.cursorPitch, track);
    this.playheadTick = Number.isFinite(grid.cursorTick) ? grid.cursorTick : this.timelineStartTick;
    this.resyncPlaybackClock(this.playheadTick);
    this.gridViewportMemory = {
      gridOffset: { ...this.gridOffset },
      timelineStartTick: this.timelineStartTick,
      gridZoomX: this.gridZoomX,
      gridZoomY: this.gridZoomY,
      selectedTrackIndex: this.selectedTrackIndex
    };
    if (saved.song && typeof saved.song === 'object') {
      this.songViewportMemory = {
        timelineStartTick: Number.isFinite(saved.song.timelineStartTick) ? saved.song.timelineStartTick : this.timelineStartTick,
        songTimelineOffsetX: Number.isFinite(saved.song.songTimelineOffsetX) ? saved.song.songTimelineOffsetX : 0,
        songTrackScroll: Number.isFinite(saved.song.songTrackScroll) ? saved.song.songTrackScroll : 0,
        gridZoomX: Number.isFinite(saved.song.gridZoomX) ? saved.song.gridZoomX : this.gridZoomX,
        selectedTrackIndex: this.selectedTrackIndex
      };
    }
    this.pendingGridFocus = null;
    this.pendingSongFocus = null;
    this.pendingTrackFocusIndex = this.selectedTrackIndex;
    this.timelineSource = 'grid';
    return true;
  }

  applySongSnapshot(snapshot, { updateHistory = true } = {}) {
    if (!snapshot) return;
    try {
      this.song = JSON.parse(snapshot);
    } catch (error) {
      return;
    }
    this.ensureState();
    this.highContrast = Boolean(this.song?.highContrast);
    this.chordMode = Boolean(this.song?.chordMode);
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, Math.max(0, this.song.tracks.length - 1));
    const activeTrack = this.song.tracks[this.selectedTrackIndex];
    const patternCount = activeTrack?.patterns?.length ?? 1;
    this.selectedPatternIndex = clamp(this.selectedPatternIndex, 0, Math.max(0, patternCount - 1));
    this.selection.clear();
    this.clipboard = null;
    if (updateHistory) {
      this.history.currentSnapshot = snapshot;
      this.history.pendingSnapshot = snapshot;
    }
    this.markDirty();
  }


  async saveSongToLibrary(options = {}) {
    if (this._persistTimer) {
      if (this._persistTimer.type === 'idle' && window.cancelIdleCallback) {
        window.cancelIdleCallback(this._persistTimer.id);
      } else {
        clearTimeout(this._persistTimer.id);
      }
      this._persistTimer = null;
    }
    this.saveCurrentPersistentViewport();
    const saved = await this.runtime.saveAsOrCurrent(options);
    if (saved) this._dirty = false;
    return saved;
  }

  buildRescueSongName(prefix = MIDI_RESCUE_PREFIX) {
    const source = String(this.currentDocumentRef?.name || this.song?.name || prefix || 'MIDI Rescue')
      .replace(new RegExp(`${MIDI_AUTOSAVE_SUFFIX}$`), '')
      .trim() || prefix;
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '-');
    return `${source} Rescue ${stamp}`;
  }

  async rescueSaveSong() {
    this.saveCurrentPersistentViewport();
    this.normalizeSongDrums();
    const name = this.buildRescueSongName();
    const data = JSON.parse(JSON.stringify({ ...this.song, name }));
    this.game?.showSaveStatusModal?.('Rescue saving...');
    this.game?.showSystemToast?.('Rescue saving...');
    this.statusMessage = 'Rescue saving...';
    try {
      const saved = saveProjectFile('music', name, data);
      const persisted = await saved?.syncPromise;
      if (persisted && persisted.persisted === false) {
        throw new Error(persisted.reason || 'Server did not persist rescue file');
      }
      this.game?.showSaveStatusModal?.('Rescue saved');
      setTimeout(() => this.game?.hideSaveStatusModal?.(), 1400);
      this.game?.showSystemToast?.(`Rescue saved: ${name}`);
      this.statusMessage = `Rescue saved: ${name}`;
      return { id: name, name };
    } catch (error) {
      const message = `Rescue failed: ${error?.message || error || 'Unknown error'}`;
      this.game?.showSaveStatusModal?.('Rescue failed');
      setTimeout(() => this.game?.hideSaveStatusModal?.(), 1800);
      this.game?.showSystemToast?.(message);
      this.statusMessage = message;
      throw error;
    }
  }

  async saveAndPaint() {
    const entry = await this.saveSongToLibrary();
    if (!entry || !this.game?.enterEditor) return;
    this.stopPlayback();
    this.game.enterEditor({ tab: 'music' });
    if (this.game.editor) {
      this.game.editor.getMusicTracks();
      this.game.editor.musicTrack = { id: entry.id, name: entry.name, source: 'library' };
      this.game.editor.mode = 'music';
      this.game.editor.musicTool = 'paint';
    }
  }


  getRobterSessionInstrumentFromTrack(track) {
    if (!track) return 'piano';
    if (isDrumTrack(track)) return 'drums';
    const name = String(track.name || '').toLowerCase();
    if (name.includes('bass')) return 'bass';
    if (name.includes('guitar')) return 'guitar';
    if (name.includes('piano') || name.includes('keys') || name.includes('keyboard') || name.includes('synth')) {
      return 'piano';
    }
    const program = Number.isFinite(track.program) ? track.program : 0;
    if (program >= 32 && program <= 39) return 'bass';
    if (program >= 24 && program <= 31) return 'guitar';
    if (program <= 7) return 'piano';
    return 'piano';
  }

  async playInRobterSession() {
    const session = this.game?.robterSession;
    if (!session) return;
    const blob = await this.buildRobterSessionZip();
    if (!blob) {
      this.showEditorMessage('No notes available to play in RobterSession yet.');
      return;
    }
    this.stopPlayback();
    const file = new File([blob], `${this.getExportBaseName()}-robtersession.zip`, { type: 'application/zip' });
    session.enter();
    const selectedTrack = this.song?.tracks?.[this.selectedTrackIndex] || null;
    const pedalsByInstrument = {};
    (this.song?.tracks || []).forEach((track) => {
      const instrument = this.getRobterSessionInstrumentFromTrack(track);
      const pedals = normalizeMidiPedals(track?.midiPedals).filter((pedal) => pedal && pedal.enabled !== false);
      if (!pedals.length || pedalsByInstrument[instrument]) return;
      pedalsByInstrument[instrument] = pedals.map((pedal) => ({ ...pedal, knobs: { ...(pedal.knobs || {}) } }));
    });
    session.setMidiLaunchContext({
      instrument: this.getRobterSessionInstrumentFromTrack(selectedTrack),
      pedalsByInstrument
    });
    await session.loadUploadedZip(file);
    if (this.game) {
      this.game.robterSessionReturnState = 'midi-editor';
      this.game.robterSessionReturnContext = {
        tab: this.recordModeActive || this.activeTab === 'virtual-instruments' ? 'virtual-instruments' : this.activeTab,
        recordModeActive: Boolean(this.recordModeActive || this.activeTab === 'virtual-instruments')
      };
      this.game.robterSessionAutoReturn = false;
      this.game.state = 'robtersession';
    }
  }

  async loadSongFromLibrary() {
    await this.runtime.open();
  }

  loadInstrumentList(key, fallback) {
    try {
      const stored = loadServerPreference(key, fallback);
      if (Array.isArray(stored)) return stored.filter((entry) => Number.isInteger(entry));
      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  saveInstrumentList(key, list) {
    try {
      void saveServerPreference(key, list);
    } catch (error) {
      // ignore
    }
  }

  addRecentInstrument(program) {
    if (!Number.isInteger(program)) return;
    const next = [program, ...this.recentInstruments.filter((entry) => entry !== program)].slice(0, 8);
    this.recentInstruments = next;
    this.saveInstrumentList('chainsaw-midi-recent', next);
  }

  toggleFavoriteInstrument(program) {
    if (!Number.isInteger(program)) return;
    const exists = this.favoriteInstruments.includes(program);
    const next = exists
      ? this.favoriteInstruments.filter((entry) => entry !== program)
      : [...this.favoriteInstruments, program];
    this.favoriteInstruments = next;
    this.saveInstrumentList('chainsaw-midi-favorites', next);
  }

  loadControllerMapping() {
    try {
      const stored = loadServerPreference('chainsaw-midi-controller-map', null);
      if (!stored || typeof stored !== 'object') throw new Error('invalid');
      return {
        place: stored.place || 'A',
        erase: stored.erase || 'X',
        tool: stored.tool || 'Y',
        instrument: stored.instrument || 'B',
        play: stored.play || 'Start',
        stop: stored.stop || 'Back',
        octaveUp: stored.octaveUp || 'LB',
        octaveDown: stored.octaveDown || 'RB'
      };
    } catch (error) {
      return {
        place: 'A',
        erase: 'X',
        tool: 'Y',
        instrument: 'B',
        play: 'Start',
        stop: 'Back',
        octaveUp: 'LB',
        octaveDown: 'RB'
      };
    }
  }

  saveControllerMapping() {
    try {
      void saveServerPreference('chainsaw-midi-controller-map', this.controllerMapping);
    } catch (error) {
      // ignore
    }
  }

  loadAudioSettings() {
    const defaults = {
      masterVolume: this.game?.audio?.volume ?? 0.4,
      masterPan: 0,
      reverbEnabled: true,
      reverbLevel: 0.18,
      latencyMs: 40,
      useSoundfont: true,
      soundfontCdn: 'vendored',
      drumKitId: this.game?.audio?.getDrumKit?.()?.id || 'standard'
    };
    try {
      const stored = loadServerPreference('chainsaw-midi-audio', null);
      if (!stored || typeof stored !== 'object') return defaults;
      return {
        masterVolume: typeof stored.masterVolume === 'number' ? stored.masterVolume : defaults.masterVolume,
        masterPan: typeof stored.masterPan === 'number' ? stored.masterPan : defaults.masterPan,
        reverbEnabled: typeof stored.reverbEnabled === 'boolean' ? stored.reverbEnabled : defaults.reverbEnabled,
        reverbLevel: typeof stored.reverbLevel === 'number' ? stored.reverbLevel : defaults.reverbLevel,
        latencyMs: typeof stored.latencyMs === 'number' ? stored.latencyMs : defaults.latencyMs,
        useSoundfont: typeof stored.useSoundfont === 'boolean' ? stored.useSoundfont : defaults.useSoundfont,
        soundfontCdn: typeof stored.soundfontCdn === 'string' ? stored.soundfontCdn : defaults.soundfontCdn,
        drumKitId: typeof stored.drumKitId === 'string' ? stored.drumKitId : defaults.drumKitId
      };
    } catch (error) {
      return defaults;
    }
  }

  saveAudioSettings() {
    try {
      void saveServerPreference('chainsaw-midi-audio', this.audioSettings);
    } catch (error) {
      // ignore
    }
  }

  applyAudioSettings() {
    const audio = this.game?.audio;
    if (!audio) return;
    audio.setVolume?.(clamp(this.audioSettings.masterVolume, 0, 1));
    audio.setMasterPan?.(clamp(this.audioSettings.masterPan, -1, 1));
    audio.setMidiLatency?.(Math.max(0, this.audioSettings.latencyMs / 1000));
    audio.setMidiReverbEnabled?.(this.audioSettings.reverbEnabled);
    audio.setMidiReverbLevel?.(clamp(this.audioSettings.reverbLevel, 0, 1));
    audio.setSoundfontEnabled?.(this.audioSettings.useSoundfont);
    audio.setSoundfontCdn?.(this.audioSettings.soundfontCdn);
    audio.setDrumKit?.(this.audioSettings.drumKitId);
  }

  validateSong(song) {
    if (!song || !Array.isArray(song.tracks)) {
      return { valid: false, error: 'Song must include a track list.' };
    }
    if (typeof song.tempo !== 'number' || typeof song.loopBars !== 'number') {
      return { valid: false, error: 'Song tempo and loop bars must be numbers.' };
    }
    if (song.timeSignature) {
      const beats = song.timeSignature?.beats;
      const unit = song.timeSignature?.unit;
      if (!Number.isInteger(beats) || beats < 1 || beats > 12 || !TIME_SIGNATURE_UNITS.includes(unit)) {
        return { valid: false, error: 'Song time signature must include valid beats and unit values.' };
      }
    }
    for (const track of song.tracks) {
      const drumTrack = isDrumTrack(track);
      const channel = drumTrack ? GM_DRUM_CHANNEL : (track.channel ?? 0);
      const program = track.program ?? 0;
      if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid channel.` };
      }
      if (!Number.isInteger(program) || program < 0 || program > 127) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid program.` };
      }
      const bankMSB = track.bankMSB ?? DEFAULT_BANK_MSB;
      const bankLSB = track.bankLSB ?? DEFAULT_BANK_LSB;
      if (!Number.isInteger(bankMSB) || bankMSB < 0 || bankMSB > 127) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid bank MSB.` };
      }
      if (!Number.isInteger(bankLSB) || bankLSB < 0 || bankLSB > 127) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid bank LSB.` };
      }
      const pan = typeof track.pan === 'number' ? track.pan : 0;
      if (typeof pan !== 'number' || pan < -1 || pan > 1) {
        return { valid: false, error: `Track "${track.name || track.id}" has invalid pan.` };
      }
    }
    return { valid: true };
  }

  migrateSong(song) {
    const schemaVersion = typeof song.schemaVersion === 'number' ? song.schemaVersion : 1;
    if (schemaVersion >= GM_SCHEMA_VERSION) {
      return song;
    }
    const timingScale = schemaVersion < 3 ? MIDI_TICKS_PER_BEAT / LEGACY_MIDI_TICKS_PER_BEAT : 1;
    const scaledSong = scaleMidiSongTiming(song, timingScale);
    const migrated = {
      ...scaledSong,
      schemaVersion: GM_SCHEMA_VERSION,
      tracks: scaledSong.tracks.map((track, index) => this.normalizeTrack(track, index, scaledSong.loopBars))
    };
    return migrated;
  }

  ensureState() {
    if (!this.song) {
      this.song = createDefaultSong();
    }
    if (!Array.isArray(this.song.tracks) || this.song.tracks.length === 0) {
      this.song.tracks = createDefaultSong().tracks;
    }
    if (typeof this.song.loopBars !== 'number' || this.song.loopBars < 1) {
      this.song.loopBars = DEFAULT_GRID_BARS;
    }
    this.song.schemaVersion = GM_SCHEMA_VERSION;
    this.song.tracks = this.song.tracks.map((track, index) => this.normalizeTrack(track, index, this.song.loopBars));
    this.normalizeSongDrums();
    if (typeof this.song.loopStartTick !== 'number') {
      this.song.loopStartTick = null;
    }
    if (typeof this.song.loopEndTick !== 'number') {
      this.song.loopEndTick = null;
    }
    if (typeof this.song.loopEnabled !== 'boolean') {
      this.song.loopEnabled = false;
    }
    if (!this.song.timeSignature || typeof this.song.timeSignature !== 'object') {
      this.song.timeSignature = { beats: 4, unit: 4 };
    }
    if (!Number.isInteger(this.song.timeSignature.beats) || this.song.timeSignature.beats < 1) {
      this.song.timeSignature.beats = 4;
    }
    if (!TIME_SIGNATURE_UNITS.includes(this.song.timeSignature.unit)) {
      this.song.timeSignature.unit = 4;
    }
    if (typeof this.song.highContrast !== 'boolean') {
      this.song.highContrast = false;
    }
    if (typeof this.song.reverseStrings !== 'boolean') {
      this.song.reverseStrings = false;
    }
    this.song.keyboardStartOctave = clamp(
      Math.round(Number.isFinite(Number(this.song.keyboardStartOctave)) ? Number(this.song.keyboardStartOctave) : DEFAULT_KEYBOARD_START_OCTAVE),
      0,
      MAX_KEYBOARD_START_OCTAVE
    );
    this.song.guitarTuning = normalizeMidiTuning(this.song.guitarTuning, STANDARD_GUITAR_TUNING);
    this.song.bassTuning = normalizeMidiTuning(this.song.bassTuning, STANDARD_BASS_TUNING);
    if (typeof this.song.staccatoEnabled !== 'boolean') {
      this.song.staccatoEnabled = false;
    }
    if (!Number.isInteger(this.song.key)) {
      this.song.key = 0;
    }
    if (!SCALE_LIBRARY.find((entry) => entry.id === this.song.scale)) {
      this.song.scale = 'major';
    }
    if (typeof this.song.chordMode !== 'boolean') {
      this.song.chordMode = false;
    }
    if (!this.song.progression) {
      this.song.progression = createDefaultSong().progression;
    }
    this.highContrast = Boolean(this.song.highContrast);
    this.chordMode = Boolean(this.song.chordMode);
    this.reverseStrings = Boolean(this.song.reverseStrings);
    this.staccatoEnabled = Boolean(this.song.staccatoEnabled);
    this.touchInput.setReverseStrings(this.reverseStrings);
    this.touchInput.setKeyboardStartOctave(this.song.keyboardStartOctave);
    this.touchInput.setStringTunings({
      guitar: this.song.guitarTuning,
      bass: this.song.bassTuning
    });
    this.beatsPerBar = this.song.timeSignature.beats;
    this.ensureDefaultLoopRegion();
    this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
    this.syncCursorToTrack();
    const activeTrack = this.getActiveTrack();
    if (activeTrack) {
      this.selectedPatternIndex = clamp(this.selectedPatternIndex, 0, activeTrack.patterns.length - 1);
    } else {
      this.selectedPatternIndex = 0;
    }
    this.preloadTrackPrograms();
    this._needsEnsureState = false;
    this.persist();
  }

  maybeEnsureState() {
    if (!this._needsEnsureState) return;
    this.ensureState();
  }

  ensureDefaultLoopRegion() {
    if (typeof this.song.loopStartTick === 'number' || typeof this.song.loopEndTick === 'number') return;
    this.song.loopStartTick = 0;
    this.song.loopEndTick = this.getDefaultLoopEndTick();
    const ticksPerBar = this.getTicksPerBar();
    this.song.loopBars = Math.max(this.song.loopBars || 1, Math.ceil(this.song.loopEndTick / ticksPerBar));
  }

  preloadTrackPrograms() {
    const audio = this.game?.audio;
    if (!audio?.ensureGmPlayer) return Promise.resolve([]);
    if (audio.getGmStatus?.().enabled === false) return Promise.resolve([]);
    return audio.ensureGmPlayer()
      .then(() => {
        const loads = this.song.tracks.map((track) => this.preloadTrackProgram(track));
        return Promise.allSettled(loads);
      })
      .catch(() => {
        // ignore preload errors; playback will fall back if needed
        return [];
      });
  }

  preloadTrackProgram(track) {
    const audio = this.game?.audio;
    if (!track || !audio?.preloadSoundfontProgram) return Promise.resolve(null);
    audio.preloadPedalResources?.(this.getPlaybackPedalsForTrack(track));
    const drumTrack = isDrumTrack(track);
    const program = Number.isFinite(track.program) ? track.program : 0;
    const channel = drumTrack ? GM_DRUM_CHANNEL : track.channel;
    const bankMSB = drumTrack ? DRUM_BANK_MSB : track.bankMSB;
    const bankLSB = drumTrack ? DRUM_BANK_LSB : track.bankLSB;
    const key = `${channel ?? 0}:${bankMSB ?? 0}:${bankLSB ?? 0}:${program}`;
    if (this.trackPreloadPromises.has(key)) return this.trackPreloadPromises.get(key);
    const promise = Promise.resolve(audio.preloadSoundfontProgram(program, channel, bankMSB, bankLSB))
      .catch(() => null)
      .finally(() => {
        window.setTimeout(() => {
          this.trackPreloadPromises.delete(key);
        }, 5000);
      });
    this.trackPreloadPromises.set(key, promise);
    return promise;
  }

  normalizeTrack(track, index, loopBars = DEFAULT_GRID_BARS) {
    const legacyProgram = this.mapLegacyInstrumentToProgram(track.instrument);
    const drumTrack = isDrumTrack(track);
    const channel = drumTrack
      ? GM_DRUM_CHANNEL
      : Number.isInteger(track.channel)
        ? track.channel
        : index % 16;
    const resolvedProgram = clamp(Number.isInteger(track.program) ? track.program : legacyProgram, 0, 127);
    const bankMSB = clamp(Number.isInteger(track.bankMSB)
      ? (drumTrack && track.bankMSB === DEFAULT_BANK_MSB ? DRUM_BANK_MSB : track.bankMSB)
      : drumTrack ? DRUM_BANK_MSB : DEFAULT_BANK_MSB, 0, 127);
    const bankLSB = clamp(Number.isInteger(track.bankLSB)
      ? track.bankLSB
      : drumTrack ? DRUM_BANK_LSB : DEFAULT_BANK_LSB, 0, 127);
    const normalized = {
      id: track.id || `track-${uid()}`,
      name: track.name || `Track ${index + 1}`,
      instrument: drumTrack ? 'drums' : track.instrument,
      channel: clamp(channel, 0, 15),
      program: resolvedProgram,
      instrumentFamily: drumTrack ? 'Drums' : (track.instrumentFamily || this.getProgramFamilyLabel(resolvedProgram)),
      bankMSB,
      bankLSB: drumTrack ? DRUM_BANK_LSB : bankLSB,
      volume: typeof track.volume === 'number' ? track.volume : 0.8,
      pan: typeof track.pan === 'number' ? clamp(track.pan, -1, 1) : 0,
      mute: Boolean(track.mute),
      solo: Boolean(track.solo),
      color: track.color || TRACK_COLORS[index % TRACK_COLORS.length],
      automation: {
        pan: Array.isArray(track.automation?.pan) ? track.automation.pan : [],
        padding: Array.isArray(track.automation?.padding) ? track.automation.padding : []
      },
      midiPedals: normalizeMidiPedals(track.midiPedals),
      patterns: Array.isArray(track.patterns) && track.patterns.length > 0
        ? track.patterns
        : [{ id: `pattern-${track.id || uid()}`, bars: loopBars, notes: [] }]
    };
    return drumTrack ? this.ensureDrumTrackSettings(normalized) : normalized;
  }

  mapLegacyInstrumentToProgram(instrument) {
    const mapping = {
      piano: 0,
      'electric-piano': 4,
      harpsichord: 6,
      clav: 7,
      bell: 9,
      celesta: 8,
      vibes: 11,
      marimba: 12,
      organ: 16,
      strings: 48,
      choir: 52,
      bass: 33,
      'guitar-nylon': 24,
      'guitar-steel': 25,
      'guitar-electric': 27,
      brass: 61,
      trumpet: 56,
      sax: 65,
      flute: 73,
      clarinet: 71,
      'synth-lead': 80,
      'synth-pad': 88,
      pluck: 45,
      lead: 80,
      pad: 88,
      keys: 0,
      guitar: 24,
      sine: 80,
      triangle: 81,
      square: 80,
      sawtooth: 81,
      drums: 0
    };
    if (!instrument) return 0;
    return mapping[instrument] ?? 0;
  }

  getActiveTrack() {
    return this.song.tracks[this.selectedTrackIndex];
  }

  syncCursorToTrack() {
    const track = this.getActiveTrack();
    if (!track) return;
    if (isDrumTrack(track)) {
      this.ensureDrumTrackSettings(track);
      this.cursor.pitch = this.coercePitchForTrack(this.cursor.pitch, track, GM_DRUM_ROWS);
      this.gridOffset.y = 0;
    }
  }

  getActivePattern() {
    const track = this.getActiveTrack();
    if (!track) return null;
    return track.patterns[this.selectedPatternIndex];
  }

  selectTrackDelta(delta) {
    const total = this.song.tracks.length;
    if (!total) return;
    this.selectTrackIndex((this.selectedTrackIndex + delta + total) % total);
  }

  isMobileLayout() {
    return Boolean(this.game?.isMobile);
  }

  getProgramLabel(program) {
    const entry = GM_PROGRAMS[program];
    if (!entry) return `Program ${program + 1}`;
    return `${formatProgramNumber(program)} ${entry.name}`;
  }

  getProgramFamilyLabel(program) {
    const entry = GM_PROGRAMS[program];
    return entry?.family || 'Misc';
  }

  getInstrumentCategory(program) {
    const entry = GM_PROGRAMS[program];
    const name = entry?.name || '';
    const family = entry?.family || '';
    if (name.includes('Choir') || name.includes('Voice')) return 'choir-voice';
    if (family === 'Piano' || family === 'Chromatic Percussion' || family === 'Organ') return 'piano-keys';
    if (family === 'Guitar') return 'guitars';
    if (family === 'Bass') return 'bass';
    if (family === 'Strings' || family === 'Ensemble') return 'strings';
    if (family === 'Brass') return 'brass';
    if (family === 'Reed' || family === 'Pipe') return 'woodwinds';
    if (family === 'Synth Lead' || family === 'Synth Pad') return 'synth';
    if (family === 'Percussive') return 'drums-perc';
    if (family === 'Synth FX' || family === 'Sound Effects') return 'fx';
    if (family === 'Ethnic') return 'ethnic';
    return 'misc';
  }

  getProgramsForFamily(familyId, query = '') {
    const search = query.trim().toLowerCase();
    if (familyId === 'favorites') {
      const favorites = this.favoriteInstruments
        .map((program) => GM_PROGRAMS[program])
        .filter(Boolean);
      return favorites.filter((entry) => {
        if (!search) return true;
        const nameMatch = entry.name.toLowerCase().includes(search);
        const numberMatch = formatProgramNumber(entry.program).includes(search);
        return nameMatch || numberMatch;
      });
    }
    if (familyId === 'drum-kits') {
      const availableKits = this.game?.audio?.listAvailableDrumKits?.();
      const drumKits = Array.isArray(availableKits) && availableKits.length ? availableKits : GM_DRUM_KITS;
      return drumKits.filter((kit) => {
        if (!search) return true;
        return String(kit.label || '').toLowerCase().includes(search)
          || formatProgramNumber(kit.program || 0).includes(search);
      }).map((kit) => ({
        program: clamp(kit.preset ?? kit.program ?? 0, 0, 127),
        name: kit.label || 'Drum Kit',
        kitId: kit.id,
        family: 'Drums'
      }));
    }
    return GM_PROGRAMS.filter((entry) => {
      const matchesFamily = this.getInstrumentCategory(entry.program) === familyId;
      if (!matchesFamily) return false;
      if (!search) return true;
      const nameMatch = entry.name.toLowerCase().includes(search);
      const numberMatch = formatProgramNumber(entry.program).includes(search);
      return nameMatch || numberMatch;
    });
  }

  isEditingDrumInstrument() {
    if (this.instrumentPicker.mode !== 'edit') return false;
    const targetIndex = this.instrumentPicker.trackIndex ?? this.selectedTrackIndex;
    return isDrumTrack(this.song.tracks[targetIndex]);
  }

  getInstrumentPickerTabs() {
    return INSTRUMENT_FAMILY_TABS;
  }

  getRecordModeVirtualInstruments() {
    return ['guitar', 'bass', 'keyboard', 'drums'];
  }

  getTrackInstrumentLabel(track) {
    if (!track) return 'Instrument';
    if (isDrumTrack(track)) {
      return `${track.name || 'Track'}: ${this.getDrumKitLabel(track)}`;
    }
    return `${track.name || 'Track'}: ${this.getProgramLabel(track.program)}`;
  }

  getDrumKitLabel(track) {
    if (!track) return 'Drum Kit';
    const audio = this.game?.audio;
    if (audio?.getDrumKitLabel) {
      return audio.getDrumKitLabel({
        bankMSB: track.bankMSB,
        bankLSB: track.bankLSB,
        program: track.program
      });
    }
    const kit = GM_DRUM_KITS.find((entry) =>
      entry.program === track.program && entry.bankMSB === track.bankMSB && entry.bankLSB === track.bankLSB);
    return kit?.label || `Drum Kit ${formatProgramNumber(track.program)}`;
  }

  getCacheKeyForTrack(track) {
    if (!track) return null;
    if (isDrumTrack(track)) {
      return `drums:${track.bankMSB}:${track.bankLSB}:${track.program}`;
    }
    return String(track.program);
  }

  getCacheKeyForProgram(program, channel, bankMSB = DEFAULT_BANK_MSB, bankLSB = DEFAULT_BANK_LSB) {
    if (!Number.isInteger(program)) return null;
    if (isDrumChannel(channel)) {
      return `drums:${bankMSB}:${bankLSB}:${program}`;
    }
    return String(program);
  }

  setPreviewLoading(key, loading) {
    if (!key) return;
    if (!loading && this.instrumentPreview.key !== key) return;
    this.instrumentPreview = { loading, key };
  }

  setDownloadLoading(key, loading) {
    if (!key) return;
    if (!loading && this.instrumentDownload.key !== key) return;
    this.instrumentDownload = { loading, key };
  }

  downloadTrackInstrument(track) {
    if (!track) return;
    this.downloadInstrumentProgram(track.program, track.channel, track.bankMSB, track.bankLSB);
  }

  downloadInstrumentProgram(program, channel, bankMSB = DEFAULT_BANK_MSB, bankLSB = DEFAULT_BANK_LSB) {
    const key = this.getCacheKeyForProgram(program, channel, bankMSB, bankLSB);
    if (!key || this.instrumentDownload.loading || this.cachedPrograms.has(key)) return;
    const audio = this.game?.audio;
    if (!audio?.cacheGmProgram) return;
    this.setDownloadLoading(key, true);
    audio.cacheGmProgram(program, channel, bankMSB, bankLSB)
      .then(() => {
        this.cachedPrograms.add(key);
        this.saveCachedPrograms();
      })
      .catch(() => {})
      .finally(() => {
        this.setDownloadLoading(key, false);
      });
  }

  getUniqueTrackName(baseName) {
    const existing = new Set(this.song.tracks.map((track) => track.name));
    if (!existing.has(baseName)) return baseName;
    let counter = 2;
    while (existing.has(`${baseName} ${counter}`)) {
      counter += 1;
    }
    return `${baseName} ${counter}`;
  }

  openInstrumentPicker(mode, trackIndex = null) {
    const previousTab = this.activeTab;
    this.instrumentPicker.mode = mode;
    this.instrumentPicker.returnTab = previousTab;
    this.instrumentPicker.trackIndex = trackIndex ?? this.selectedTrackIndex;
    const track = this.song.tracks[this.instrumentPicker.trackIndex];
    this.instrumentPicker.selectedProgram = mode === 'add' ? null : track?.program ?? null;
    const tabs = this.getInstrumentPickerTabs();
    const preferredTab = (mode === 'edit' && track)
      ? (isDrumTrack(track) ? 'drum-kits' : this.getInstrumentCategory(track.program))
      : null;
    this.instrumentPicker.familyTab = tabs.some((tab) => tab.id === preferredTab)
      ? preferredTab
      : (tabs[0]?.id || 'drums-perc');
    this.instrumentPicker.bounds = [];
    this.instrumentPicker.favoriteBounds = [];
    this.instrumentPicker.sectionBounds = [];
    this.instrumentPicker.tabBounds = [];
    this.instrumentPicker.tabPrevBounds = null;
    this.instrumentPicker.tabNextBounds = null;
    this.instrumentPicker.tabAreaBounds = null;
    this.instrumentPicker.confirmBounds = null;
    this.instrumentPicker.cancelBounds = null;
    this.instrumentPicker.downloadBounds = null;
    this.instrumentPicker.scrollUpBounds = null;
    this.instrumentPicker.scrollDownBounds = null;
    this.instrumentPicker.scroll = 0;
    this.instrumentPicker.scrollStep = 0;
    this.instrumentPicker.tabScrollX = 0;
    this.instrumentPicker.drumKitBounds = null;
    this.instrumentPicker.modalBounds = null;
    const selectedTabIndex = Math.max(0, tabs.findIndex((tab) => tab.id === this.instrumentPicker.familyTab));
    this.instrumentPicker.tabScrollX = Math.max(0, selectedTabIndex * 96);
    const availableKits = this.game?.audio?.listAvailableDrumKits?.();
    const drumKits = Array.isArray(availableKits) && availableKits.length ? availableKits : GM_DRUM_KITS;
    const matchedKit = track && isDrumTrack(track)
      ? drumKits.find((kit) => kit.program === track.program && kit.bankMSB === track.bankMSB && kit.bankLSB === track.bankLSB)
      : null;
    this.instrumentPicker.drumKitId = matchedKit?.id || this.audioSettings?.drumKitId || 'standard';
  }

  confirmInstrumentSelection() {
    if (!this.instrumentPicker.mode) return true;
    const targetIndex = this.instrumentPicker.trackIndex ?? this.selectedTrackIndex;
    const track = this.song.tracks[targetIndex];
    const selectedProgram = this.instrumentPicker.selectedProgram;
    const hasSelection = Number.isInteger(selectedProgram);
    const isAddMode = this.instrumentPicker.mode === 'add';
    const selectingDrumKit = this.instrumentPicker.familyTab === 'drum-kits';
    const selectedKit = (this.game?.audio?.listAvailableDrumKits?.() || GM_DRUM_KITS)
      .find((kit) => kit.id === this.instrumentPicker.drumKitId);
    const currentKit = track && isDrumTrack(track)
      ? (this.game?.audio?.listAvailableDrumKits?.() || GM_DRUM_KITS)
        .find((kit) => kit.program === track.program && kit.bankMSB === track.bankMSB && kit.bankLSB === track.bankLSB)
      : null;
    const kitChanged = Boolean(selectingDrumKit && track && (!currentKit || currentKit.id !== selectedKit?.id));
    const changed = isAddMode
      ? hasSelection
      : (selectingDrumKit ? kitChanged : (hasSelection && track && selectedProgram !== track.program));
    if (!changed) {
      this.instrumentPicker.mode = null;
      this.instrumentPicker.returnTab = null;
      return true;
    }
    this.applyInstrumentSelection(selectedProgram);
    return true;
  }

  shiftInstrumentPickerTab(delta) {
    const tabs = this.getInstrumentPickerTabs();
    if (!tabs.length) return;
    const step = Math.max(40, Number(this.instrumentPicker.tabScrollStep) || 120);
    const maxScroll = Math.max(0, Number(this.instrumentPicker.tabScrollMax) || 0);
    this.instrumentPicker.tabScrollX = clamp(
      (Number(this.instrumentPicker.tabScrollX) || 0) + delta * step,
      0,
      maxScroll
    );
  }

  getInstrumentPickerItems() {
    return [];
  }

  applyInstrumentSelection(program) {
    const selectedKit = (this.game?.audio?.listAvailableDrumKits?.() || GM_DRUM_KITS)
      .find((kit) => kit.id === this.instrumentPicker.drumKitId);
    const selectingDrumKit = this.instrumentPicker.familyTab === 'drum-kits';
    if (this.instrumentPicker.mode === 'add') {
      if (!Number.isInteger(program)) return;
      const addingDrums = selectingDrumKit;
      const resolvedProgram = addingDrums ? clamp(selectedKit?.preset ?? selectedKit?.program ?? 0, 0, 127) : program;
      const baseName = addingDrums ? (selectedKit?.label || 'Drums') : (GM_PROGRAMS[program]?.name || 'Track');
      const name = this.getUniqueTrackName(baseName);
      const track = {
        id: `track-${uid()}`,
        name,
        channel: addingDrums ? GM_DRUM_CHANNEL : this.getNextAvailableChannel(),
        program: resolvedProgram,
        instrument: addingDrums ? 'drums' : undefined,
        instrumentFamily: addingDrums ? 'Drums' : this.getProgramFamilyLabel(program),
        bankMSB: addingDrums ? (selectedKit?.bankMSB ?? DRUM_BANK_MSB) : DEFAULT_BANK_MSB,
        bankLSB: addingDrums ? (selectedKit?.bankLSB ?? DRUM_BANK_LSB) : DEFAULT_BANK_LSB,
        volume: 0.8,
        pan: 0,
        mute: false,
        solo: false,
        color: TRACK_COLORS[this.song.tracks.length % TRACK_COLORS.length],
        patterns: [{ id: `pattern-${uid()}`, bars: this.song.loopBars, notes: [] }]
      };
      this.song.tracks.push(addingDrums ? this.ensureDrumTrackSettings(track) : track);
      this.selectedTrackIndex = this.song.tracks.length - 1;
      this.pendingTrackFocusIndex = this.selectedTrackIndex;
      this.persist({ commitHistory: true });
      this.addRecentInstrument(program);
    } else {
      const targetIndex = this.instrumentPicker.trackIndex ?? this.selectedTrackIndex;
      const track = this.song.tracks[targetIndex];
      if (!track) return;
      if (selectingDrumKit) {
        track.instrument = 'drums';
        track.channel = GM_DRUM_CHANNEL;
        track.bankMSB = selectedKit?.bankMSB ?? DRUM_BANK_MSB;
        track.bankLSB = selectedKit?.bankLSB ?? DRUM_BANK_LSB;
        track.program = clamp(selectedKit?.preset ?? selectedKit?.program ?? track.program ?? 0, 0, 127);
        track.instrumentFamily = 'Drums';
      } else {
        if (!Number.isInteger(program)) return;
        if (isDrumTrack(track)) {
          track.channel = this.getNextAvailableChannel();
          delete track.instrument;
        }
        track.program = program;
        track.bankMSB = DEFAULT_BANK_MSB;
        track.bankLSB = DEFAULT_BANK_LSB;
        track.instrumentFamily = this.getProgramFamilyLabel(program);
        this.addRecentInstrument(program);
      }
      this.persist({ commitHistory: true });
    }
    this.instrumentPicker.mode = null;
    this.instrumentPicker.selectedProgram = null;
    this.preloadTrackPrograms();
    this.activeTab = this.instrumentPicker.returnTab || 'grid';
    this.instrumentPicker.returnTab = null;
  }

  resetTransientInteractionState() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.stopLivePreviewNotes();
    this.stopPlayback();
    this.dragState = null;
    this.gridGesture = null;
    this.songGesture = null;
    this.viewportController.endPinch();
    this.draggingTrackControl = null;
    this.toolsMenuOpen = false;
    this.genreMenuOpen = false;
    this.qaOverlayOpen = false;
    this.confirmOverlayOpen = false;
    this.tempoSliderOpen = false;
    this.settingsOpen = false;
    this.selectionMenu.open = false;
    this.controllerMenu.resetFocus();
    this.selectionMenu.bounds = [];
    this.songSelectionMenu.open = false;
    this.songSelectionMenu.bounds = [];
    this.instrumentPicker.mode = null;
    this.instrumentPicker.returnTab = null;
  }

  resetToFileMenu() {
    if (this.recordModeActive) this.exitRecordMode();
    this.activeTab = 'grid';
    this.fileMenuOpen = false;
    this.controllerMenu.resetFocus();
  }

  isModalOpen() {
    return this.qaOverlayOpen || this.confirmOverlayOpen || Boolean(this.instrumentPicker.mode);
  }

  closeModal() {
    if (this.qaOverlayOpen) {
      this.qaOverlayOpen = false;
    }
  }

  requestConfirmOverlay({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm = null, onCancel = null } = {}) {
    const danger = /delete|discard|remove|reset/i.test(String(confirmLabel || title || ''));
    this.confirmOverlayOpen = true;
    openConfirmOverlay({
      title,
      message,
      confirmText: confirmLabel,
      cancelText: cancelLabel,
      danger
    }).then((confirmed) => {
      this.confirmOverlayOpen = false;
      if (confirmed) {
        onConfirm?.();
      } else {
        onCancel?.();
      }
    });
  }

  confirmDiscardChangesModal(message) {
    if (!this.runtime?.hasUnsavedChanges?.()) return true;
    return new Promise((resolve) => {
      this.requestConfirmOverlay({
        title: 'Unsaved Changes',
        message: message || 'You have unfinished changes.',
        confirmLabel: 'Continue',
        cancelLabel: 'Cancel',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }

  showEditorMessage(message) {
    this.game?.showSystemToast?.(String(message || ''));
  }


  getLoopTicks() {
    const gridTicks = this.getGridTicks();
    if (typeof this.song.loopEndTick === 'number') {
      return clamp(this.song.loopEndTick, 1, gridTicks);
    }
    return gridTicks;
  }

  getGridTicks() {
    const ticksPerBar = this.getTicksPerBar();
    return Math.max(1, (this.song.loopBars || DEFAULT_GRID_BARS) * ticksPerBar);
  }

  getLoopStartTick() {
    if (typeof this.song.loopStartTick === 'number') {
      return clamp(this.song.loopStartTick, 0, this.getLoopTicks());
    }
    return 0;
  }

  getLoopRegion() {
    const start = this.getLoopStartTick();
    const end = this.getLoopTicks();
    return { start, end, length: Math.max(1, end - start) };
  }

  getDefaultLoopEndTick() {
    const ticksPerBar = this.getTicksPerBar();
    return ticksPerBar * DEFAULT_LOOP_BARS;
  }

  getBeatTicks() {
    const unit = this.song?.timeSignature?.unit || 4;
    const safeUnit = TIME_SIGNATURE_UNITS.includes(unit) ? unit : 4;
    return Math.max(1, Math.round(this.ticksPerBeat * (4 / safeUnit)));
  }

  getTicksPerBar() {
    return this.beatsPerBar * this.getBeatTicks();
  }

  getSongLastNoteTick() {
    const patterns = this.song.tracks
      .map((track) => track.patterns[this.selectedPatternIndex])
      .filter(Boolean);
    let lastTick = 0;
    let hasNotes = false;
    patterns.forEach((pattern) => {
      pattern.notes.forEach((note) => {
        hasNotes = true;
        lastTick = Math.max(lastTick, note.startTick + note.durationTicks);
      });
    });
    return hasNotes ? lastTick : 0;
  }

  getSongEndTick() {
    if (typeof this.song.loopEndTick === 'number') {
      return Math.max(1, this.song.loopEndTick);
    }
    const ticksPerBar = this.getTicksPerBar();
    return Math.max(ticksPerBar, this.getSongLastNoteTick() + ticksPerBar);
  }

  getPlaybackEndTick() {
    if (this.song.loopEnabled && typeof this.song.loopEndTick === 'number') {
      return this.getLoopTicks();
    }
    const ticksPerBar = this.getTicksPerBar();
    return Math.max(this.getGridTicks(), this.getSongLastNoteTick() + ticksPerBar);
  }

  getQuantizeTicks() {
    if (!this.quantizeEnabled) return 1;
    const ticksPerBar = this.getTicksPerBar();
    const divisor = this.quantizeOptions[this.quantizeIndex]?.divisor || 16;
    return Math.max(1, Math.round(ticksPerBar / divisor));
  }

  getPlacementSnapTicks(track = this.getActiveTrack()) {
    return getMidiPlacementSnapTicks({
      quantizeEnabled: this.quantizeEnabled,
      ticksPerBar: this.getTicksPerBar(),
      quantizeDivisor: this.quantizeOptions[this.quantizeIndex]?.divisor || 16,
      noteLengthDivisor: NOTE_LENGTH_OPTIONS[this.noteLengthIndex]?.divisor || 4,
      drumTrack: isDrumTrack(track)
    });
  }

  getNoteLengthTicks() {
    const ticksPerBar = this.getTicksPerBar();
    const divisor = NOTE_LENGTH_OPTIONS[this.noteLengthIndex]?.divisor || 4;
    return Math.max(1, Math.round(ticksPerBar / divisor));
  }

  getPlacementDurationTicks(track = this.getActiveTrack()) {
    if (!track) return this.getNoteLengthTicks();
    const staccatoFactor = this.staccatoEnabled ? 0.5 : 1;
    const baseDuration = Number.isFinite(this.defaultNoteDurationTicks) && this.defaultNoteDurationTicks > 0
      ? this.defaultNoteDurationTicks
      : this.getNoteLengthTicks();
    return Math.max(1, Math.round(baseDuration * staccatoFactor));
  }

  setNoteLengthIndex(index) {
    const total = NOTE_LENGTH_OPTIONS.length;
    const nextIndex = ((index % total) + total) % total;
    this.noteLengthIndex = nextIndex;
    this.defaultNoteDurationTicks = this.getNoteLengthTicks();
    this.persist({ commitHistory: true });
  }

  cycleTimeSignature() {
    const current = this.song.timeSignature || { beats: 4, unit: 4 };
    const currentIndex = TIME_SIGNATURE_OPTIONS.findIndex(
      (option) => option.beats === current.beats && option.unit === current.unit
    );
    const nextIndex = currentIndex >= 0
      ? (currentIndex + 1) % TIME_SIGNATURE_OPTIONS.length
      : 0;
    const next = TIME_SIGNATURE_OPTIONS[nextIndex];
    this.setTimeSignature(next.beats, next.unit);
  }

  setTimeSignature(beats, unit) {
    const nextBeats = clamp(Math.round(beats), 1, 12);
    const nextUnit = TIME_SIGNATURE_UNITS.includes(unit) ? unit : 4;
    this.song.timeSignature = { beats: nextBeats, unit: nextUnit };
    this.beatsPerBar = nextBeats;
    if (typeof this.song.loopBars === 'number') {
      this.song.loopEndTick = this.getTicksPerBar() * this.song.loopBars;
    }
    this._needsEnsureState = true;
    this.persist({ commitHistory: true });
  }

  getNextAvailableChannel() {
    const used = new Set(this.song.tracks.map((track) => track.channel));
    for (let channel = 0; channel < 16; channel += 1) {
      if (channel === GM_DRUM_CHANNEL) continue;
      if (!used.has(channel)) return channel;
    }
    return 0;
  }

  getNextEmptyBarStart() {
    const ticksPerBar = this.getTicksPerBar();
    const patterns = this.song.tracks
      .map((track) => track.patterns[this.selectedPatternIndex])
      .filter(Boolean);
    const lastTick = this.getSongLastNoteTick();
    const startBar = Math.max(0, Math.floor(lastTick / ticksPerBar) + 1);
    const totalBars = Math.max(this.song.loopBars, startBar + 2);
    for (let bar = startBar; bar < totalBars; bar += 1) {
      const start = bar * ticksPerBar;
      const end = start + ticksPerBar;
      const hasNotes = patterns.some((pattern) =>
        pattern.notes.some((note) => note.startTick < end && note.startTick + note.durationTicks > start));
      if (!hasNotes) {
        return start;
      }
    }
    return Math.ceil(lastTick / ticksPerBar) * ticksPerBar;
  }

  ensureGridCapacity(tickEnd) {
    const ticksPerBar = this.getTicksPerBar();
    const requiredBars = Math.max(1, Math.ceil((tickEnd + 1) / ticksPerBar));
    if (requiredBars > this.song.loopBars) {
      this.song.loopBars = requiredBars;
      this.song.tracks.forEach((track) => {
        track.patterns.forEach((pattern) => {
          pattern.bars = this.song.loopBars;
        });
      });
    }
  }

  ensureTimelineForTick(endTick) {
    if (!Number.isFinite(endTick)) return this.getSongTimelineTicks();
    this.ensureGridCapacity(endTick + 1);
    return this.getSongTimelineTicks();
  }

  ensureGridPanCapacity(desiredOffsetX) {
    if (!this.gridBounds) return;
    if (desiredOffsetX >= 0) return;
    // Viewport panning must not create thousands of empty measures.
  }

  getEditableGridTick() {
    return this.getGridTicks();
  }

  getSongTimelineTicks() {
    return this.getGridTicks();
  }

  getSongTimelineZoomLimits() {
    return { minZoom: 1, maxZoom: 8 };
  }

  clampSongTimelineOffset(offsetX, viewW, totalW) {
    const minX = Math.min(0, viewW - totalW);
    return clamp(offsetX, minX, 0);
  }

  clampTimelineOffsetX(offsetX, viewW, cellWidth) {
    const totalW = cellWidth * this.getGridTicks();
    const minX = Math.min(0, viewW - totalW);
    return clamp(offsetX, minX, 0);
  }

  updateTimelineStartTickFromGrid() {
    if (!this.gridBounds) return;
    this.timelineStartTick = Math.max(0, -this.gridOffset.x / this.gridBounds.cellWidth);
    this.timelineSource = 'grid';
  }

  updateTimelineStartTickFromSong() {
    if (!this.songTimelineBounds) return;
    this.timelineStartTick = Math.max(0, -this.songTimelineOffsetX / this.songTimelineBounds.cellWidth);
    this.timelineSource = 'song';
  }

  ensureTimelineCapacity() {
    // Viewport zooming must not expand authored song length.
  }

  ensureTimelinePanCapacity(desiredOffsetX, viewW, cellWidth) {
    if (desiredOffsetX >= 0) return;
    // Viewport panning must not expand authored song length.
  }

  setSongTimelineZoom(nextZoom, anchorTick = this.playheadTick) {
    const { minZoom, maxZoom } = this.getGridZoomLimitsX();
    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    if (!this.songTimelineBounds) {
      this.gridZoomX = clampedZoom;
      return;
    }
    const {
      x,
      w,
      originX,
      cellWidth
    } = this.songTimelineBounds;
    const anchorX = originX + anchorTick * cellWidth;
    const baseCellWidth = cellWidth / (this.gridZoomX || 1);
    const nextCellWidth = baseCellWidth * clampedZoom;
    const nextOriginX = anchorX - anchorTick * nextCellWidth;
    this.gridZoomX = clampedZoom;
    this.songTimelineOffsetX = this.clampTimelineOffsetX(nextOriginX - x, w, nextCellWidth);
    this.updateTimelineStartTickFromSong();
    this.ensureTimelineCapacity();
  }

  getVisibleCenterTick() {
    if (this.activeTab === 'song' && this.songTimelineBounds) {
      return this.getSongTickFromX(this.songTimelineBounds.x + this.songTimelineBounds.w / 2, this.songTimelineBounds);
    }
    if (this.gridBounds) {
      return (this.gridBounds.x + this.gridBounds.w / 2 - this.gridBounds.originX) / Math.max(0.0001, this.gridBounds.cellWidth);
    }
    return this.playheadTick;
  }

  getSelectedGridFocus() {
    const notes = this.getSelectedNotes?.() || [];
    if (notes.length) {
      const track = this.getActiveTrack();
      const minTick = Math.min(...notes.map((note) => note.startTick));
      const maxTick = Math.max(...notes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
      const avgPitch = notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length;
      return {
        tick: (minTick + maxTick) / 2,
        pitch: avgPitch,
        trackIndex: this.selectedTrackIndex
      };
    }
    if (this.cursor && Number.isFinite(this.cursor.tick) && Number.isFinite(this.cursor.pitch)) {
      return {
        tick: this.cursor.tick,
        pitch: this.cursor.pitch,
        trackIndex: this.selectedTrackIndex
      };
    }
    return {
      tick: this.playheadTick,
      pitch: null,
      trackIndex: this.selectedTrackIndex
    };
  }

  getSelectedSongFocus() {
    const range = this.getSongSelectionRange?.();
    if (range) {
      return {
        tick: (range.startTick + range.endTick) / 2,
        trackIndex: range.trackIndex ?? range.trackStartIndex ?? this.selectedTrackIndex
      };
    }
    return {
      tick: this.playheadTick,
      trackIndex: this.selectedTrackIndex
    };
  }

  getCurrentZoomFocus() {
    return this.activeTab === 'song' ? this.getSelectedSongFocus() : this.getSelectedGridFocus();
  }

  setHorizontalTimelineZoom(nextZoom, anchorTick = null, anchorScreenX = null) {
    const { minZoom, maxZoom } = this.getGridZoomLimitsX();
    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    const focus = this.getCurrentZoomFocus();
    if (this.activeTab === 'song') {
      this.setSongTimelineZoom(clampedZoom, Number.isFinite(anchorTick) ? anchorTick : focus.tick);
      return;
    }
    if (!this.gridBounds) {
      this.gridZoomX = clampedZoom;
      return;
    }
    const resolvedAnchorTick = Number.isFinite(anchorTick) ? anchorTick : focus.tick;
    const resolvedAnchorX = Number.isFinite(anchorScreenX)
      ? anchorScreenX
      : this.gridBounds.x + this.gridBounds.w / 2;
    const baseCellWidth = this.gridBounds.cellWidth / Math.max(0.0001, this.gridZoomX || 1);
    const nextCellWidth = baseCellWidth * clampedZoom;
    const nextOriginX = resolvedAnchorX - resolvedAnchorTick * nextCellWidth;
    this.gridZoomX = clampedZoom;
    this.gridOffset.x = nextOriginX - this.gridBounds.x;
    this.ensureGridPanCapacity(this.gridOffset.x);
    this.clampGridOffset(
      this.gridBounds.w,
      this.gridBounds.h,
      nextCellWidth * this.gridBounds.cols,
      this.gridBounds.gridH
    );
    this.updateTimelineStartTickFromGrid();
  }

  saveCurrentViewportMemory() {
    this.saveCurrentPersistentViewport();
    if (this.activeTab === 'grid') {
      this.gridViewportMemory = {
        gridOffset: { ...this.gridOffset },
        timelineStartTick: this.timelineStartTick,
        gridZoomX: this.gridZoomX,
        gridZoomY: this.gridZoomY,
        selectedTrackIndex: this.selectedTrackIndex
      };
    } else if (this.activeTab === 'song') {
      this.songViewportMemory = {
        timelineStartTick: this.timelineStartTick,
        songTimelineOffsetX: this.songTimelineOffsetX,
        songTrackScroll: this.songTrackScroll,
        gridZoomX: this.gridZoomX,
        selectedTrackIndex: this.selectedTrackIndex
      };
    }
  }

  selectTrackIndex(trackIndex, { restoreViewport = true, clearSelection = true } = {}) {
    if (!Number.isInteger(trackIndex) || !this.song?.tracks?.length) return;
    this.saveCurrentViewportMemory();
    const nextIndex = clamp(trackIndex, 0, Math.max(0, this.song.tracks.length - 1));
    this.selectedTrackIndex = nextIndex;
    if (clearSelection) {
      this.selection.clear();
      this.clearSongSelection?.();
    }
    this.closeSelectionMenu?.();
    this.syncCursorToTrack();
    if (restoreViewport && !this.restorePersistedViewportForTrack(nextIndex)) {
      const track = this.getActiveTrack();
      const pattern = track?.patterns?.[this.selectedPatternIndex] || track?.patterns?.[0];
      const notes = Array.isArray(pattern?.notes) ? pattern.notes : [];
      if (notes.length) {
        const latest = notes.reduce((best, note) => (
          !best || note.startTick > best.startTick ? note : best
        ), null);
        if (latest) {
          this.cursor.tick = latest.startTick;
          this.cursor.pitch = latest.pitch;
          this.playheadTick = latest.startTick;
          this.resyncPlaybackClock(this.playheadTick);
          this.pendingGridFocus = { trackIndex: nextIndex, tick: latest.startTick, pitch: latest.pitch };
          this.pendingSongFocus = { trackIndex: nextIndex, tick: latest.startTick };
        }
      }
    }
    this.persistViewportState();
  }

  restoreViewportMemory(tabId) {
    if (tabId === 'grid' && this.gridViewportMemory) {
      this.gridOffset = { ...this.gridViewportMemory.gridOffset };
      this.timelineStartTick = this.gridViewportMemory.timelineStartTick;
      this.gridZoomX = this.gridViewportMemory.gridZoomX;
      this.gridZoomY = this.gridViewportMemory.gridZoomY;
      this.timelineSource = 'grid';
      this.pendingGridFocus = null;
    } else if (tabId === 'song' && this.songViewportMemory) {
      this.timelineStartTick = this.songViewportMemory.timelineStartTick;
      this.songTimelineOffsetX = this.songViewportMemory.songTimelineOffsetX;
      this.songTrackScroll = this.songViewportMemory.songTrackScroll;
      this.gridZoomX = this.songViewportMemory.gridZoomX;
      this.timelineSource = 'song';
      this.pendingSongFocus = null;
    }
  }

  focusGridViewportOn({ tick, pitch, trackIndex } = {}) {
    const resolvedTick = Number.isFinite(tick) ? tick : this.playheadTick;
    if (!this.gridBounds) {
      this.pendingGridFocus = { tick: resolvedTick, pitch, trackIndex };
      return;
    }
    const { x, y, w, h, cellWidth, cellHeight, rows } = this.gridBounds;
    const row = Number.isFinite(pitch) ? this.getRowFromPitch(pitch) : -1;
    this.gridOffset.x = x + w / 2 - resolvedTick * cellWidth - x;
    if (row >= 0 && row < rows && !isDrumTrack(this.getActiveTrack())) {
      this.gridOffset.y = y + h / 2 - row * cellHeight - y;
    }
    this.clampGridOffset(w, h, cellWidth * this.gridBounds.cols, cellHeight * rows);
    this.updateTimelineStartTickFromGrid();
    this.pendingGridFocus = null;
  }

  focusSongViewportOn({ tick, trackIndex } = {}) {
    const resolvedTick = Number.isFinite(tick) ? tick : this.playheadTick;
    if (!this.songTimelineBounds) {
      this.pendingSongFocus = { tick: resolvedTick, trackIndex };
      return;
    }
    this.setSongTimelineZoom(this.gridZoomX, resolvedTick);
    if (Number.isInteger(trackIndex)) {
      this.pendingTrackFocusIndex = trackIndex;
    }
    this.pendingSongFocus = null;
  }

  findFirstSongContentFocus() {
    let best = null;
    this.song?.tracks?.forEach((track, trackIndex) => {
      const pattern = track.patterns?.[this.selectedPatternIndex] || track.patterns?.[0];
      pattern?.notes?.forEach((note) => {
        if (!best || note.startTick < best.tick) {
          best = { trackIndex, tick: note.startTick, pitch: note.pitch };
        }
      });
    });
    return best;
  }

  findLatestSongContentFocus() {
    let latestTick = -Infinity;
    const notes = [];
    this.song?.tracks?.forEach((track, trackIndex) => {
      const pattern = track.patterns?.[this.selectedPatternIndex] || track.patterns?.[0];
      pattern?.notes?.forEach((note) => {
        if (!Number.isFinite(note?.startTick) || !Number.isFinite(note?.pitch)) return;
        const startTick = Math.max(0, Math.round(note.startTick));
        if (startTick > latestTick) {
          latestTick = startTick;
          notes.length = 0;
        }
        if (startTick === latestTick) {
          notes.push({ trackIndex, tick: startTick, pitch: note.pitch });
        }
      });
    });
    if (!notes.length) return null;
    const anchor = notes[0];
    const clusterWindowTicks = this.getTicksPerBar();
    const cluster = [];
    this.song?.tracks?.forEach((track, trackIndex) => {
      const pattern = track.patterns?.[this.selectedPatternIndex] || track.patterns?.[0];
      pattern?.notes?.forEach((note) => {
        if (!Number.isFinite(note?.startTick) || !Number.isFinite(note?.pitch)) return;
        if (Math.abs(note.startTick - latestTick) <= clusterWindowTicks) {
          cluster.push({ trackIndex, tick: note.startTick, pitch: note.pitch });
        }
      });
    });
    const pitchSamples = cluster.filter((entry) => entry.trackIndex === anchor.trackIndex);
    const pitchSource = pitchSamples.length ? pitchSamples : cluster;
    const avgPitch = pitchSource.reduce((sum, entry) => sum + entry.pitch, 0) / Math.max(1, pitchSource.length);
    return {
      trackIndex: anchor.trackIndex,
      tick: latestTick,
      pitch: Number.isFinite(avgPitch) ? avgPitch : anchor.pitch
    };
  }

  focusFirstSongContentAfterOpen() {
    this.gridViewportMemory = null;
    this.songViewportMemory = null;
    const state = this.song?.editorState?.midiComposer;
    const lastTrackId = state?.lastTrackId;
    let restoreTrackIndex = this.song?.tracks?.findIndex((track) => track?.id === lastTrackId);
    if (!Number.isInteger(restoreTrackIndex) || restoreTrackIndex < 0) {
      restoreTrackIndex = clamp(this.selectedTrackIndex, 0, Math.max(0, (this.song?.tracks?.length || 1) - 1));
    }
    if (this.restorePersistedViewportForTrack(restoreTrackIndex)) return;

    const focus = this.findLatestSongContentFocus() || this.findFirstSongContentFocus();
    if (!focus) return;
    this.selectedTrackIndex = focus.trackIndex;
    this.cursor.tick = focus.tick;
    this.cursor.pitch = focus.pitch;
    this.playheadTick = focus.tick;
    this.resyncPlaybackClock(this.playheadTick);
    this.pendingGridFocus = focus;
    this.pendingSongFocus = focus;
    this.pendingTrackFocusIndex = focus.trackIndex;
  }

  getSongTimelineX(tick) {
    if (!this.songTimelineBounds) return 0;
    return this.songTimelineBounds.originX + tick * this.songTimelineBounds.cellWidth;
  }

  getSongSelectionRange() {
    if (!this.songSelection?.active) return null;
    const startTick = Math.min(this.songSelection.startTick, this.songSelection.endTick);
    const endTick = Math.max(this.songSelection.startTick, this.songSelection.endTick);
    if (!Number.isFinite(startTick) || !Number.isFinite(endTick)) return null;
    if (endTick <= startTick) return null;
    const trackTotal = this.song?.tracks?.length ?? 0;
    if (trackTotal <= 0) return null;
    const fallbackIndex = clamp(this.songSelection.trackIndex ?? 0, 0, Math.max(0, trackTotal - 1));
    const rawStart = Number.isInteger(this.songSelection.trackStartIndex) ? this.songSelection.trackStartIndex : fallbackIndex;
    const rawEnd = Number.isInteger(this.songSelection.trackEndIndex) ? this.songSelection.trackEndIndex : fallbackIndex;
    const startTrackIndex = clamp(Math.min(rawStart, rawEnd), 0, Math.max(0, trackTotal - 1));
    const endTrackIndex = clamp(Math.max(rawStart, rawEnd), 0, Math.max(0, trackTotal - 1));
    const trackIndices = [];
    for (let i = startTrackIndex; i <= endTrackIndex; i += 1) {
      trackIndices.push(i);
    }
    return {
      trackIndex: startTrackIndex,
      trackStartIndex: startTrackIndex,
      trackEndIndex: endTrackIndex,
      trackIndices,
      trackCount: trackIndices.length,
      startTick,
      endTick,
      durationTicks: endTick - startTick
    };
  }

  getSongLaneAt(x, y) {
    return this.songLaneBounds?.find((bounds) => this.pointInBounds(x, y, bounds)) || null;
  }

  isSongSelectionHit(tick, trackIndex) {
    const range = this.getSongSelectionRange();
    if (!range) return false;
    return trackIndex >= range.trackStartIndex
      && trackIndex <= range.trackEndIndex
      && tick >= range.startTick
      && tick <= range.endTick;
  }

  getAutomationValueAtTick(frames, tick, defaultValue) {
    if (!Array.isArray(frames) || frames.length === 0 || !Number.isFinite(tick)) {
      return defaultValue;
    }
    const sorted = [...frames].sort((a, b) => a.tick - b.tick);
    if (tick <= sorted[0].tick) return sorted[0].value ?? defaultValue;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (tick >= current.tick && tick <= next.tick) {
        const span = Math.max(1, next.tick - current.tick);
        const ratio = (tick - current.tick) / span;
        const currentValue = current.value ?? defaultValue;
        const nextValue = next.value ?? currentValue;
        return currentValue + (nextValue - currentValue) * ratio;
      }
    }
    return sorted[sorted.length - 1].value ?? defaultValue;
  }

  getTrackAutomationValue(track, type, tick, defaultValue) {
    if (!track) return defaultValue;
    const frames = track.automation?.[type] || [];
    return this.getAutomationValueAtTick(frames, tick, defaultValue);
  }

  getTrackPlaybackMix(track, tick = this.playheadTick) {
    if (!track) return { volume: 0, pan: 0 };
    const volume = this.getTrackAutomationValue(track, 'padding', tick, track.volume ?? 0.8);
    const pan = this.getTrackAutomationValue(track, 'pan', tick, track.pan ?? 0);
    return {
      volume: clamp(volume, 0, 1),
      pan: clamp(pan, -1, 1)
    };
  }

  getTrackBaseMix(track) {
    if (!track) return { volume: 0, pan: 0 };
    return {
      volume: clamp(track.volume ?? 0.8, 0, 1),
      pan: clamp(track.pan ?? 0, -1, 1)
    };
  }

  getExpandedGridWidth() {
    if (!this.gridBounds) return 0;
    return this.gridBounds.cellWidth * this.getGridTicks();
  }

  getScaleSteps() {
    const scale = SCALE_LIBRARY.find((entry) => entry.id === this.song.scale) || SCALE_LIBRARY[0];
    return scale.steps;
  }

  getScalePitchClasses() {
    const root = this.song.key || 0;
    return this.getScaleSteps().map((step) => (root + step) % 12);
  }

  snapPitchToScale(pitch) {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) return pitch;
    if (!this.scaleLock) return pitch;
    const pitchClasses = this.getScalePitchClasses();
    const octave = Math.floor(pitch / 12);
    const pitchClass = pitch % 12;
    if (pitchClasses.includes(pitchClass)) return pitch;
    let closest = pitch;
    let minDistance = Infinity;
    pitchClasses.forEach((candidate) => {
      const base = octave * 12 + candidate;
      const distance = Math.abs(base - pitch);
      if (distance < minDistance) {
        minDistance = distance;
        closest = base;
      }
    });
    return closest;
  }

  snapTick(tick) {
    const quantize = this.getQuantizeTicks();
    const ratio = tick / quantize;
    const snapped = this.isMobileLayout() ? Math.floor(ratio) : Math.round(ratio);
    return snapped * quantize;
  }

  snapTickForTrack(tick, track = this.getActiveTrack()) {
    const quantize = this.getPlacementSnapTicks(track);
    const ratio = tick / quantize;
    const snapped = this.isMobileLayout() ? Math.floor(ratio) : Math.round(ratio);
    return snapped * quantize;
  }

  getChordForTick(tick) {
    const bar = Math.floor(tick / this.getTicksPerBar()) + 1;
    return this.song.progression.find((chord) => bar >= chord.startBar && bar < chord.startBar + chord.lengthBars)
      || this.song.progression[0];
  }

  getChordTones(chord) {
    if (!chord) return [];
    const root = chord.root;
    const thirdInterval = chord.quality === 'min' ? 3 : chord.quality === 'dim' ? 3 : 4;
    const fifthInterval = chord.quality === 'dim' ? 6 : 7;
    return [root, (root + thirdInterval) % 12, (root + fifthInterval) % 12];
  }

  setChordMode(enabled) {
    if (isDrumTrack(this.getActiveTrack())) {
      this.chordMode = false;
      this.song.chordMode = false;
      this.persist({ commitHistory: true });
      return;
    }
    this.chordMode = Boolean(enabled);
    this.song.chordMode = this.chordMode;
    this.persist({ commitHistory: true });
  }

  setReverseStrings(enabled) {
    this.reverseStrings = Boolean(enabled);
    this.song.reverseStrings = this.reverseStrings;
    this.touchInput.setReverseStrings(this.reverseStrings);
    this.persist({ commitHistory: true });
  }

  setKeyboardStartOctave(octave) {
    const nextOctave = clamp(Math.round(Number(octave)), 0, MAX_KEYBOARD_START_OCTAVE);
    if (!Number.isFinite(nextOctave)) return;
    this.song.keyboardStartOctave = nextOctave;
    this.touchInput.setKeyboardStartOctave(nextOctave);
    this.persist({ commitHistory: true });
  }

  setStringTuning(instrument, tuning) {
    const key = instrument === 'bass' ? 'bassTuning' : 'guitarTuning';
    const fallback = instrument === 'bass' ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING;
    this.song[key] = normalizeMidiTuning(tuning, fallback);
    this.touchInput.setStringTunings({
      guitar: this.song.guitarTuning,
      bass: this.song.bassTuning
    });
    this.persist({ commitHistory: true });
  }

  resetStringTuning(instrument) {
    const fallback = instrument === 'bass' ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING;
    this.setStringTuning(instrument, fallback);
  }

  cycleStringTuning(instrument, stringIndex, delta = 1) {
    const key = instrument === 'bass' ? 'bassTuning' : 'guitarTuning';
    const fallback = instrument === 'bass' ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING;
    const tuning = normalizeMidiTuning(this.song[key], fallback);
    if (stringIndex < 0 || stringIndex >= tuning.length) return;
    tuning[stringIndex] = clamp(tuning[stringIndex] + delta, 0, 127);
    this.setStringTuning(instrument, tuning);
    this.previewRecordStringPitch(instrument, tuning[stringIndex]);
  }

  previewRecordStringPitch(instrument, pitch) {
    const track = this.getRecordingTrack(instrument);
    if (!track || !Number.isFinite(pitch)) return;
    const noteId = `record-tuning-${instrument}-${Date.now()}`;
    this.playLivePreviewNote(noteId, pitch, 96, track, track.pan);
    globalThis.setTimeout?.(() => this.stopLivePreviewNote(noteId), 450);
    this.nowPlaying = {
      active: true,
      label: this.formatPitchLabel(pitch, track),
      detail: `${instrument === 'bass' ? 'Bass' : 'Guitar'} tuning`,
      type: 'note'
    };
  }

  formatTuningSummary(tuning) {
    return normalizeMidiTuning(tuning, tuning?.length === 4 ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING)
      .map((pitch) => this.formatPitchLabel(pitch))
      .join(' ');
  }

  async promptStringTuning(instrument) {
    const isBass = instrument === 'bass';
    const title = isBass ? 'Bass Tuning' : 'Guitar Tuning';
    const current = normalizeMidiTuning(
      isBass ? this.song.bassTuning : this.song.guitarTuning,
      isBass ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING
    );
    const fields = current.map((pitch, index) => ({
      id: `string${index}`,
      label: `String ${index + 1} (${this.formatPitchLabel(pitch)})`,
      initialValue: pitch,
      min: 0,
      max: 127,
      step: 1,
      integer: true
    }));
    const values = await openMultiNumberInputOverlay({
      title,
      fields,
      confirmText: 'Apply',
      maxWidth: 520
    });
    if (!values) return;
    this.setStringTuning(instrument, current.map((pitch, index) => values[`string${index}`] ?? pitch));
  }

  async promptChordProgression() {
    const loopBars = Math.max(1, this.song.loopBars || DEFAULT_GRID_BARS);
    const perBar = [];
    for (let bar = 1; bar <= loopBars; bar += 1) {
      const chord = this.song.progression.find((entry) => bar >= entry.startBar && bar < entry.startBar + entry.lengthBars)
        || this.song.progression[0];
      perBar.push(formatChordToken(chord));
    }
    const suggested = `1-${loopBars} ${perBar.join(' ')}`.trim();
    const input = await openTextInputOverlay({
      title: 'Chord Progression',
      label: 'Enter chord progressions by bar (e.g. "1-4 C C D G; 5-6 D G; 7-9 C D G").',
      initialValue: suggested,
      inputType: 'text',
      width: 620,
      maxWidth: 700
    });
    if (!input) return;
    const progression = parseChordProgressionInput(input, loopBars);
    if (!progression) {
      this.showEditorMessage('Could not parse chord progression. Try format: 1-4 C C D G');
      return;
    }
    this.song.progression = progression;
    this.persist({ commitHistory: true });
  }

  buildProgressionFromLibrary(loopBars) {
    const template = CHORD_PROGRESSION_LIBRARY[Math.floor(Math.random() * CHORD_PROGRESSION_LIBRARY.length)];
    const chords = template?.chords?.length ? template.chords : ['C', 'F', 'G', 'C'];
    const progression = [];
    for (let bar = 1; bar <= loopBars; bar += 1) {
      const chord = parseChordToken(chords[(bar - 1) % chords.length]) || { root: 0, quality: 'maj' };
      progression.push({
        root: chord.root,
        quality: chord.quality,
        startBar: bar,
        lengthBars: 1
      });
    }
    return {
      progression,
      scale: template?.scale || 'major',
      theme: template?.theme || 'random'
    };
  }

  enterRecordMode() {
    if (this.recordModeActive) return;
    this.syncVirtualInstrumentToActiveTrack();
    this.recordModeActive = true;
    this.activeTab = 'grid';
    this.recordGridSnapshot = {
      gridZoomX: this.gridZoomX,
      gridZoomY: this.gridZoomY,
      gridZoomInitialized: this.gridZoomInitialized,
      gridOffset: this.gridOffset ? { ...this.gridOffset } : null
    };
    this.recordGridZoomedOut = false;
  }

  exitRecordMode() {
    if (!this.recordModeActive) return;
    if (this.recorder.isRecording) {
      this.stopRecording();
    }
    if (this.singleNoteRecordMode.active) {
      this.exitSingleNoteRecordMode();
    }
    this.touchInput?.releaseAllNotes?.();
    this.stopLivePreviewNotes();
    this.recordModeActive = false;
    if (this.recordGridSnapshot) {
      this.gridZoomX = this.recordGridSnapshot.gridZoomX;
      this.gridZoomY = this.recordGridSnapshot.gridZoomY;
      this.gridZoomInitialized = this.recordGridSnapshot.gridZoomInitialized;
      this.gridOffset = this.recordGridSnapshot.gridOffset ? { ...this.recordGridSnapshot.gridOffset } : { x: 0, y: 0 };
    }
    this.recordGridSnapshot = null;
    this.recordGridZoomedOut = false;
  }

  isLeftRailTabActive(tabId) {
    if (tabId === 'virtual-instruments') return this.recordModeActive;
    if (this.recordModeActive && tabId === 'grid') return false;
    return this.activeTab === tabId;
  }

  activateLeftRailTab(tabId) {
    const previousTab = this.activeTab;
    if (previousTab === 'grid' || previousTab === 'song') {
      this.saveCurrentViewportMemory();
      this.persistViewportState();
    }
    if (this.activeTab === 'instruments' && (tabId === 'grid' || tabId === 'song' || tabId === 'virtual-instruments' || tabId === 'pedals' || tabId === 'settings')) {
      this.confirmInstrumentSelection();
    }
    this.closeMidiPortraitTrackPicker();
    this.closeMidiPortraitMasterVolume();
    if (tabId === 'virtual-instruments') {
      this.enterRecordMode();
      return;
    }
    this.activeTab = tabId;
    if (tabId === 'grid' || tabId === 'song') {
      this.restoreViewportMemory(tabId);
    }
  }

  handleMobileLandscapeRootMenuTap(id) {
    if (id === 'undo') {
      this.runtime.undo();
      return;
    }
    if (id === 'redo') {
      this.runtime.redo();
      return;
    }
    if (id === 'file') {
      if (this.activeTab === 'file') {
        this.closeFileMenu();
      } else {
        if (this.activeTab === 'instruments' || this.instrumentPicker.mode) {
          this.confirmInstrumentSelection();
        }
        this.activeTab = 'file';
      }
      return;
    }
    this.activateLeftRailTab(id);
    this.closeSelectionMenu();
    this.pastePreview = null;
    this.noteLengthMenu.open = false;
    this.tempoSliderOpen = false;
  }

  closeMidiPortraitTrackPicker() {
    this.midiPortraitTrackPickerOpen = false;
    this.bounds.midiPortraitTrackPicker = null;
    this.bounds.midiPortraitTrackPickerScrollArea = null;
    this.bounds.midiPortraitTrackPickerRows = [];
  }

  closeMidiPortraitMasterVolume() {
    this.midiPortraitMasterVolumeOpen = false;
    this.bounds.midiPortraitMasterVolumePanel = null;
    this.bounds.midiPortraitMasterVolumeSlider = null;
  }

  getVirtualInstrumentForTrack(track) {
    if (!track) return 'keyboard';
    if (isDrumTrack(track)) return 'drums';
    const family = String(track.instrumentFamily || this.getProgramFamilyLabel(track.program) || '').toLowerCase();
    const name = String(track.name || this.getProgramLabel(track.program) || '').toLowerCase();
    const program = Number.isInteger(track.program) ? track.program : 0;
    for (const mapping of VIRTUAL_INSTRUMENT_DEFAULT_MAPPING) {
      if (Array.isArray(mapping.families) && mapping.families.some((entry) => family.includes(String(entry).toLowerCase()))) {
        return mapping.id;
      }
      if (Array.isArray(mapping.nameIncludes) && mapping.nameIncludes.some((entry) => name.includes(String(entry).toLowerCase()))) {
        return mapping.id;
      }
      if (Array.isArray(mapping.programRange)
        && mapping.programRange.length === 2
        && program >= mapping.programRange[0]
        && program <= mapping.programRange[1]) {
        return mapping.id;
      }
    }
    return 'keyboard';
  }

  syncVirtualInstrumentToActiveTrack() {
    const track = this.getActiveTrack();
    this.setRecordInstrument(this.getVirtualInstrumentForTrack(track), { closeMenus: false });
  }

  setRecordInstrument(instrument, { closeMenus = true } = {}) {
    const instruments = this.getRecordModeVirtualInstruments();
    const nextInstrument = instruments.includes(instrument) ? instrument : instruments[0];
    this.recordInstrument = nextInstrument;
    this.recordLayout.setAvailableInstruments(instruments);
    this.recordLayout.setInstrument(nextInstrument);
    this.gamepadInput.setInstrument(nextInstrument);
    if (closeMenus) {
      this.recordLayout.instrumentMenuOpen = false;
      this.recordLayout.instrumentDropdown = null;
      this.recordLayout.bounds.instrumentButtons = [];
      this.recordLayout.bounds.instrumentConfigButtons = [];
      this.recordLayout.bounds.instrumentDropdownItems = [];
      this.midiPortraitRecordSettingsOpen = false;
    }
  }

  toggleSingleNoteRecordMode() {
    if (this.singleNoteRecordMode.active) {
      this.exitSingleNoteRecordMode();
    } else {
      this.enterSingleNoteRecordMode();
    }
  }

  enterSingleNoteRecordMode() {
    if (this.recorder.isRecording) {
      this.stopRecording();
    }
    if (!this.recordModeActive) {
      this.enterRecordMode();
    }
    this.singleNoteRecordMode = {
      active: true,
      anchorTick: 0,
      measureStart: 0,
      measureEnd: 0,
      awaitingChord: true
    };
    this.setSingleNoteAnchorTick(this.playheadTick);
    this.singleNoteActiveNotes.clear();
  }

  exitSingleNoteRecordMode() {
    this.singleNoteRecordMode.active = false;
    this.singleNoteActiveNotes.clear();
  }

  setSingleNoteAnchorTick(tick) {
    const ticksPerBar = this.getTicksPerBar();
    const snappedTick = this.snapTickForTrack(tick);
    const measureStart = Math.floor(snappedTick / ticksPerBar) * ticksPerBar;
    this.singleNoteRecordMode.anchorTick = snappedTick;
    this.singleNoteRecordMode.measureStart = measureStart;
    this.singleNoteRecordMode.measureEnd = measureStart + ticksPerBar;
    this.cursor.tick = snappedTick;
    this.playheadTick = snappedTick;
    this.resyncPlaybackClock(this.playheadTick);
  }

  advanceSingleNoteAnchor() {
    if (!this.singleNoteRecordMode.active) return;
    const step = Math.max(1, this.getPlacementSnapTicks());
    const loopEnd = this.getLoopTicks();
    const nextTick = clamp(this.singleNoteRecordMode.anchorTick + step, 0, Math.max(0, loopEnd - 1));
    this.setSingleNoteAnchorTick(nextTick);
  }

  clearNotesInMeasure(pattern, startTick, endTick) {
    if (!pattern) return;
    pattern.notes = pattern.notes.filter((note) => {
      if (note.startTick >= startTick && note.startTick < endTick) {
        this.selection.delete(note.id);
        return false;
      }
      return true;
    });
  }

  placeSingleNoteAtAnchor(track, pattern, pitch, velocity) {
    if (!track || !pattern) return;
    const drumTrack = isDrumTrack(track);
    const duration = this.getPlacementDurationTicks(track);
    const note = {
      id: uid(),
      startTick: this.singleNoteRecordMode.anchorTick,
      durationTicks: duration,
      pitch,
      velocity: (velocity ?? 96) / 127
    };
    pattern.notes.push(note);
    this.selection.add(note.id);
    this.ensureGridCapacity(note.startTick + duration);
  }

  handleSingleNoteRecordOn(event) {
    const instrumentOverride = (event?.instrument === 'drums' || event?.channel === GM_DRUM_CHANNEL) ? 'drums' : null;
    const { track, pattern } = this.getRecordingTarget(instrumentOverride);
    if (!track || !pattern) return;
    const velocity = Number.isFinite(event.velocity) ? event.velocity : this.recordStatus.velocity;
    const clampedVelocity = clamp(velocity ?? 96, 1, 127);
    const drumTrack = isDrumTrack(track);
    const pitch = drumTrack
      ? this.coercePitchForTrack(event.pitch, track, GM_DRUM_ROWS)
      : event.pitch;
    if (this.singleNoteRecordMode.awaitingChord) {
      this.selection.clear();
      this.clearNotesInMeasure(pattern, this.singleNoteRecordMode.measureStart, this.singleNoteRecordMode.measureEnd);
      this.singleNoteRecordMode.awaitingChord = false;
    }
    if (!this.singleNoteActiveNotes.has(event.id)) {
      this.singleNoteActiveNotes.set(event.id, pitch);
      this.placeSingleNoteAtAnchor(track, pattern, pitch, clampedVelocity);
      this.persist({ commitHistory: true });
    }
    const previewPitch = Number.isFinite(event.previewPitch) ? event.previewPitch : pitch;
    this.recordStatus.velocity = clampedVelocity;
    this.playLivePreviewNote(event.id, previewPitch, clampedVelocity, track, track.pan);
    this.updateNowPlayingDisplay(event, pitch, track);
    this.recordStatus.velocity = clampedVelocity;
  }

  handleSingleNoteRecordOff(event) {
    if (!this.singleNoteActiveNotes.has(event.id)) return;
    this.singleNoteActiveNotes.delete(event.id);
    if (this.singleNoteActiveNotes.size === 0) {
      this.singleNoteRecordMode.awaitingChord = true;
    }
    this.stopLivePreviewNote(event.id);
    this.clearNowPlayingDisplay(event);
  }

  playLivePreviewNote(id, pitch, velocity, track, pan = 0) {
    if (!id || !track) return;
    const drumTrack = isDrumTrack(track);
    const pedals = this.getPlaybackPedalsForTrack(track);
    if (drumTrack) {
      this.playGmNote(pitch, 0.4, (velocity / 127) * track.volume, track, pan);
      return;
    }
    if (this.game?.audio?.startLiveGmNote) {
      this.game.audio.startLiveGmNote({
        id,
        pitch,
        duration: 8,
        volume: (velocity / 127) * track.volume,
        program: track.program,
        channel: track.channel,
        bankMSB: track.bankMSB,
        bankLSB: track.bankLSB,
        pan,
        pedals
      });
      this.livePreviewNotes.add(id);
      return;
    }
    this.playGmNote(pitch, 0.4, (velocity / 127) * track.volume, track, pan);
  }

  stopLivePreviewNote(id) {
    if (!id || !this.livePreviewNotes.has(id)) return;
    if (this.game?.audio?.stopLiveGmNote) {
      this.game.audio.stopLiveGmNote(id);
    }
    this.livePreviewNotes.delete(id);
  }

  stopLivePreviewNotes() {
    if (!this.livePreviewNotes.size) return;
    if (this.game?.audio?.stopLiveGmNote) {
      this.livePreviewNotes.forEach((noteId) => this.game.audio.stopLiveGmNote(noteId));
    }
    this.livePreviewNotes.clear();
  }

  startRecording() {
    if (this.recorder.isRecording) return;
    if (!this.recordModeActive) {
      this.enterRecordMode();
    }
    if (this.singleNoteRecordMode.active) {
      this.exitSingleNoteRecordMode();
    }
    if (!this.isPlaying) {
      this.togglePlayback();
    }
    const tempo = this.song.tempo || 120;
    const countInBars = this.recordCountInEnabled ? 1 : 0;
    const countInSeconds = countInBars * this.beatsPerBar * (60 / tempo);
    const startTime = this.getRecordingTime() + countInSeconds;
    this.recordCountIn = countInBars
      ? {
        startTime: this.getRecordingTime(),
        endTime: startTime,
        lastBeat: -1,
        beats: countInBars * this.beatsPerBar,
        tempo
      }
      : null;
    this.recorder.startRecording({
      tempo,
      ticksPerBeat: this.ticksPerBeat,
      beatsPerBar: this.beatsPerBar,
      startTime,
      quantizeDivisor: this.recordQuantizeEnabled ? this.recordQuantizeDivisor : null
    });
    this.playheadTick = 0;
    this.resyncPlaybackClock(this.playheadTick);
    this.recordStartTime = startTime;
  }

  stopRecording() {
    if (!this.recordModeActive) return;
    this.stopPlayback();
    this.recordCountIn = null;
    if (this.recorder.isRecording) {
      this.recorder.stopRecording(this.getRecordingTime());
      const { track, pattern } = this.getRecordingTarget();
      if (pattern) {
        this.recorder.commitRecordedTakeToScore({ pattern, startTickOffset: 0 });
        if (isDrumTrack(track)) {
          this.ensureDrumTrackSettings(track);
          this.normalizeDrumPattern(track, pattern, GM_DRUM_ROWS);
        }
        this.persist({ commitHistory: true });
        const lastNote = pattern.notes[pattern.notes.length - 1];
        if (lastNote) {
          this.playNote(track, lastNote, this.playheadTick);
        }
      }
    }
  }

  getRecordingTarget(instrumentOverride = null) {
    const track = this.getRecordingTrack(instrumentOverride);
    const pattern = track?.patterns?.[this.selectedPatternIndex] || null;
    return { track, pattern };
  }

  createRecordingTrackForInstrument(instrument) {
    const isBass = instrument === 'bass';
    const track = {
      id: `track-${instrument}-${uid()}`,
      name: this.getUniqueTrackName(isBass ? 'Bass' : instrument === 'guitar' ? 'Guitar' : 'Keys'),
      channel: this.getNextAvailableChannel(),
      program: isBass ? 33 : instrument === 'guitar' ? 27 : 0,
      instrument: undefined,
      instrumentFamily: isBass ? 'Bass' : instrument === 'guitar' ? 'Guitar' : 'Piano',
      bankMSB: DEFAULT_BANK_MSB,
      bankLSB: DEFAULT_BANK_LSB,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[this.song.tracks.length % TRACK_COLORS.length],
      patterns: [{ id: `pattern-${uid()}`, bars: this.song.loopBars, notes: [] }]
    };
    this.song.tracks.push(track);
    this.selectedTrackIndex = this.song.tracks.length - 1;
    this.selectedPatternIndex = 0;
    this.persist({ commitHistory: true });
    return track;
  }

  getRecordingTrack(instrumentOverride = null) {
    const instrument = instrumentOverride || this.recordInstrument;
    if (instrument === 'drums') {
      let drumTrack = this.song.tracks.find((candidate) => isDrumTrack(candidate));
      if (!drumTrack) {
        drumTrack = this.ensureDrumTrackSettings({
          id: `track-drums-${Date.now()}`,
          name: 'Drums',
          instrument: 'drums',
          channel: GM_DRUM_CHANNEL,
          program: 0,
          bankMSB: DRUM_BANK_MSB,
          bankLSB: DRUM_BANK_LSB,
          volume: 0.9,
          pan: 0,
          mute: false,
          solo: false,
          color: TRACK_COLORS[this.song.tracks.length % TRACK_COLORS.length],
          patterns: [{ id: `pattern-drums-${Date.now()}`, bars: this.song.loopBars, notes: [] }]
        });
        this.song.tracks.push(drumTrack);
      } else {
        this.ensureDrumTrackSettings(drumTrack);
      }
      const drumIndex = this.song.tracks.indexOf(drumTrack);
      if (drumIndex >= 0) {
        this.selectedTrackIndex = drumIndex;
      }
      return drumTrack;
    }
    const activeTrack = this.getActiveTrack();
    if (activeTrack && !isDrumTrack(activeTrack)) {
      return activeTrack;
    }
    const melodicIndex = this.song.tracks.findIndex((candidate) => !isDrumTrack(candidate));
    if (melodicIndex >= 0) {
      this.selectedTrackIndex = melodicIndex;
      return this.song.tracks[melodicIndex];
    }
    return this.createRecordingTrackForInstrument(instrument);
  }

  handleRecordedNoteOn(event) {
    if (!this.recordModeActive) return;
    if (this.singleNoteRecordMode.active) {
      this.handleSingleNoteRecordOn(event);
      return;
    }
    const now = this.getRecordingTime();
    const instrumentOverride = (event?.instrument === 'drums' || event?.channel === GM_DRUM_CHANNEL) ? 'drums' : null;
    const { track } = this.getRecordingTarget(instrumentOverride);
    if (!track) return;
    const velocity = Number.isFinite(event.velocity) ? event.velocity : this.recordStatus.velocity;
    const clampedVelocity = clamp(velocity ?? 96, 1, 127);
    const drumTrack = isDrumTrack(track);
    const pitch = drumTrack
      ? this.coercePitchForTrack(event.pitch, track, GM_DRUM_ROWS)
      : event.pitch;
    this.recordStatus.velocity = clampedVelocity;
    this.recorder.recordNoteOn({
      id: event.id,
      pitch,
      velocity: clampedVelocity,
      time: now,
      channel: drumTrack ? GM_DRUM_CHANNEL : track.channel,
      trackId: track.id
    });
    const previewPitch = Number.isFinite(event.previewPitch) ? event.previewPitch : pitch;
    this.playLivePreviewNote(event.id, previewPitch, clampedVelocity, track, track.pan);
    this.updateNowPlayingDisplay(event, pitch, track);
  }

  handleRecordedNoteOff(event) {
    if (!this.recordModeActive) return;
    if (this.singleNoteRecordMode.active) {
      this.handleSingleNoteRecordOff(event);
      return;
    }
    this.recorder.recordNoteOff({ id: event.id, time: this.getRecordingTime() });
    this.stopLivePreviewNote(event.id);
    this.clearNowPlayingDisplay(event);
  }

  formatPitchLabel(pitch, track) {
    if (isDrumTrack(track)) {
      const drumRow = this.getDrumRows().find((row) => row.pitch === pitch);
      return drumRow?.label || `Drum ${pitch}`;
    }
    const normalized = Math.round(pitch ?? 0);
    const label = KEY_LABELS[((normalized % 12) + 12) % 12];
    const octave = this.getOctaveLabel(normalized);
    return `${label}${octave}`;
  }

  updateNowPlayingDisplay(event, pitch, track) {
    if (!event) return;
    const notePitch = Number.isFinite(pitch) ? pitch : event.pitch;
    const label = event.displayLabel || this.formatPitchLabel(notePitch, track);
    const detail = event.displayDetail || '';
    const type = event.displayType || (isDrumTrack(track) ? 'drum' : 'note');
    this.nowPlaying = {
      active: true,
      label,
      detail,
      type
    };
    if (event.id) {
      this.nowPlayingNotes.set(event.id, { label, detail, type });
    }
  }

  clearNowPlayingDisplay(event) {
    if (!event?.id) return;
    this.nowPlayingNotes.delete(event.id);
    if (this.nowPlayingNotes.size === 0) {
      this.nowPlaying = {
        active: false,
        label: '',
        detail: '',
        type: 'note'
      };
    }
  }

  handleRecordedCc(event) {
    if (!this.recordModeActive) return;
    const { track } = this.getRecordingTarget();
    if (!track) return;
    if (event?.controller === 7) {
      const normalized = clamp((event.value ?? 127) / 127, 0, 1);
      this.game?.audio?.setMidiVolume?.(normalized);
    }
    this.recorder.recordCC({
      controller: event.controller,
      value: event.value,
      time: this.getRecordingTime(),
      channel: track.channel,
      trackId: track.id
    });
  }

  handleRecordedPitchBend(event) {
    if (!this.recordModeActive) return;
    const bendValue = Number.isFinite(event?.value) ? event.value : 8192;
    const bendSemitones = ((bendValue - 8192) / 8192) * 2;
    this.game?.audio?.setMidiPitchBend?.(bendSemitones);
    const { track } = this.getRecordingTarget();
    if (!track || isDrumTrack(track)) return;
    this.recorder.recordPitchBend({
      value: bendValue,
      time: this.getRecordingTime(),
      channel: track.channel,
      trackId: track.id
    });
  }

  isMobileLandscapeGridMode() {
    return this.isMobileLayout()
      && this.viewportWidth > this.viewportHeight
      && this.activeTab === 'grid'
      && !this.recordModeActive;
  }

  isPhysicalControllerConnected() {
    return Boolean(this.game?.input?.isGamepadConnected?.() || this.gamepadInput?.connected);
  }

  isMobileLandscapeThumbZoomMode() {
    if (!this.isMobileLayout() || this.recordModeActive) return false;
    const landscape = this.viewportWidth > this.viewportHeight;
    if (landscape) {
      return (this.activeTab === 'grid' || this.activeTab === 'song') && !this.isPhysicalControllerConnected();
    }
    return true;
  }

  applyMobilePanJoystick(dt = 0) {
    if (!this.isMobileLandscapeThumbZoomMode() || !this.panJoystick.active) return;
    const frameScale = dt > 0 ? dt * 60 : 1;
    const speed = 11;
    if (this.activeTab === 'song' && this.songTimelineBounds) {
      const nextOffset = this.songTimelineOffsetX - this.panJoystick.dx * speed * frameScale;
      this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
      this.songTimelineOffsetX = this.clampTimelineOffsetX(
        nextOffset,
        this.songTimelineBounds.w,
        this.songTimelineBounds.cellWidth
      );
      this.songTrackScroll = clamp(
        this.songTrackScroll + this.panJoystick.dy * speed * frameScale,
        0,
        this.songTrackScrollMax || 0
      );
      this.updateTimelineStartTickFromSong();
      this.ensureTimelineCapacity();
      return;
    }
    if (!this.gridBounds) return;
    this.gridOffset.x -= this.panJoystick.dx * speed * frameScale;
    this.gridOffset.y -= this.panJoystick.dy * speed * frameScale;
    this.ensureGridPanCapacity(this.gridOffset.x);
    this.clampGridOffset(
      this.gridBounds.w,
      this.gridBounds.h,
      this.getExpandedGridWidth(),
      this.gridBounds.gridH
    );
    this.updateTimelineStartTickFromGrid();
  }

  updatePanJoystick(x, y) {
    const { center, radius } = this.panJoystick;
    const dx = x - center.x;
    const dy = y - center.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.0001 || radius <= 0) {
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    const clamped = Math.min(dist, radius);
    const angle = Math.atan2(dy, dx);
    this.panJoystick.dx = Math.cos(angle) * (clamped / radius);
    this.panJoystick.dy = Math.sin(angle) * (clamped / radius);
  }

  update(input, dt) {
    this.maybeEnsureState();
    this.handleKeyboardShortcuts(input);
    this.handleGamepadInput(input, dt);
    this.applyMobilePanJoystick(dt);
    this.updateRecordMode(dt);
    if (this.isPlaying) {
      this.advancePlayhead(dt);
    }
    this.cleanupActiveNotes();
  }

  updateRecordMode(dt) {
    if (!this.recordModeActive) {
      this.keyboardInput.setEnabled(false);
      this.gamepadInput.setEnabled(false);
      this.game?.audio?.setMidiPitchBend?.(0);
      return;
    }
    this.updateCountInMetronome();
    this.keyboardInput.setEnabled(true);
    const scale = SCALE_LIBRARY.find((entry) => entry.id === this.song.scale) || SCALE_LIBRARY[0];
    this.gamepadInput.setEnabled(true);
    this.gamepadInput.setScale({ key: this.song.key || 0, steps: scale.steps });
    this.gamepadInput.setInstrument(this.recordInstrument);
    this.gamepadInput.update();

    const gamepadConnected = this.gamepadInput.connected;
    const preferred = this.recordDevicePreference === 'auto'
      ? (gamepadConnected ? 'gamepad' : 'touch')
      : this.recordDevicePreference;
    const recordInstruments = this.getRecordModeVirtualInstruments();
    if (!recordInstruments.includes(this.recordInstrument)) {
      this.setRecordInstrument(recordInstruments[0], { closeMenus: false });
    }
    this.recordLayout.setAvailableInstruments(recordInstruments);
    this.recordLayout.setDevice(preferred);
    this.recordLayout.setInstrument(this.recordInstrument);
    this.recordLayout.setInstrumentSettings({
      guitarTuning: this.song.guitarTuning,
      bassTuning: this.song.bassTuning,
      keyboardStartOctave: this.song.keyboardStartOctave
    });
    this.recordLayout.quantizeEnabled = this.recordQuantizeEnabled;
    this.recordLayout.quantizeLabel = `1/${this.recordQuantizeDivisor}`;
    this.recordLayout.countInEnabled = this.recordCountInEnabled;
    this.recordLayout.metronomeEnabled = this.recordMetronomeEnabled;

    if (preferred === 'touch') {
      this.gamepadInput.setEnabled(false);
    }

    this.updateRecordSelectors();
    this.gamepadInput.setSelectorActive(this.recordSelector.active);

    const leftStick = this.gamepadInput.getLeftStick();
    const rightStick = this.gamepadInput.getRightStick();
    const leftMagnitude = Math.hypot(leftStick.x, leftStick.y);
    const rightMagnitude = Math.hypot(rightStick.x, rightStick.y);
    const leftActive = leftMagnitude > 0.3
      || (this.recordSelector.active && this.recordSelector.type === 'scale');
    const rightActive = rightMagnitude > 0.3
      || (this.recordSelector.active && this.recordSelector.type === 'key');
    const leftDegree = this.gamepadInput.leftStickStableDirection || this.recordStatus.degree || 1;
    const leftPitch = this.gamepadInput.getPitchForScaleStep(leftDegree - 1);
    const activeTrack = this.getActiveTrack();
    const leftNoteLabel = this.recordInstrument === 'drums' ? null : this.formatPitchLabel(leftPitch, activeTrack);
    const bendSemitones = this.gamepadInput.getPitchBendSemitones();
    const bendDisplaySemitones = Math.round(bendSemitones * 2) / 2;
    const bendBasePitch = leftPitch;
    const bendTargetPitch = bendBasePitch + bendDisplaySemitones;
    const bendBaseLabel = this.recordInstrument === 'drums'
      ? ''
      : this.formatPitchLabel(bendBasePitch, activeTrack);
    const bendTargetLabel = this.recordInstrument === 'drums'
      ? ''
      : this.formatPitchLabel(bendTargetPitch, activeTrack);
    const bendActive = preferred === 'gamepad'
      && this.recordInstrument !== 'drums'
      && (Math.abs(bendSemitones) > 0.05 || rightActive);
    this.recordStickIndicators = {
      left: {
        x: leftStick.x,
        y: leftStick.y,
        active: leftActive,
        degree: leftDegree,
        noteLabel: leftNoteLabel
      },
      right: { x: rightStick.x, y: rightStick.y, active: rightActive },
      bend: {
        active: bendActive,
        semitones: bendSemitones,
        displaySemitones: bendDisplaySemitones,
        baseLabel: bendBaseLabel,
        targetLabel: bendTargetLabel
      }
    };

    const shouldApplyBend = preferred === 'gamepad'
      && !this.recordSelector.active
      && this.recordInstrument !== 'drums';
    if (shouldApplyBend) {
      this.game?.audio?.setMidiPitchBend?.(this.gamepadInput.getPitchBendSemitones());
    } else {
      this.game?.audio?.setMidiPitchBend?.(0);
    }

    this.recordStatus.degree = this.gamepadInput.leftStickStableDirection || this.recordStatus.degree;
    this.recordStatus.octave = this.gamepadInput.octaveOffset;
    if (preferred !== 'gamepad') {
      this.recordStatus.velocity = this.keyboardInput.velocity || this.recordStatus.velocity;
    }
    if (this.recorder.isRecording) {
      const elapsed = Math.max(0, this.getRecordingTime() - this.recorder.startTime);
      const ticks = (elapsed * this.song.tempo / 60) * this.ticksPerBeat;
      this.playheadTick = clamp(ticks, 0, this.getLoopTicks());
    }
  }

  toggleRecordSelector(type) {
    if (this.recordSelector.active && this.recordSelector.type === type) {
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
      return;
    }
    this.recordSelector.active = true;
    this.recordSelector.type = type;
    this.recordSelector.stickEngaged = false;
    if (type === 'key') {
      this.recordSelector.index = clamp(this.song.key || 0, 0, KEY_LABELS.length - 1);
    } else {
      const scaleIndex = SCALE_LIBRARY.findIndex((entry) => entry.id === this.song.scale);
      this.recordSelector.index = scaleIndex >= 0 ? scaleIndex : 0;
    }
  }

  updateRecordSelectors() {
    if (this.recordInstrument === 'drums') {
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
      return;
    }
    if (this.gamepadInput.wasButtonPressed(10)) {
      this.toggleRecordSelector('scale');
    }
    if (this.gamepadInput.wasButtonPressed(11)) {
      this.toggleRecordSelector('key');
    }
    if (!this.recordSelector.active || !this.recordSelector.type) return;
    if (this.recordSelector.type === 'scale') {
      const { x, y } = this.gamepadInput.getLeftStick();
      if (Math.hypot(x, y) < 0.6) return;
      const itemCount = SCALE_LIBRARY.length;
      const nextIndex = radialIndexFromStick(x, y, itemCount);
      if (nextIndex !== this.recordSelector.index) {
        this.recordSelector.index = nextIndex;
        this.song.scale = SCALE_LIBRARY[nextIndex]?.id || SCALE_LIBRARY[0].id;
        this.persist({ commitHistory: true });
      }
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
      return;
    }

    const { x, y } = this.gamepadInput.getRightStick();
    const magnitude = Math.hypot(x, y);
    if (magnitude >= 0.6) {
      this.recordSelector.stickEngaged = true;
      const itemCount = KEY_LABELS.length;
      const nextIndex = radialIndexFromStick(x, y, itemCount);
      if (nextIndex !== this.recordSelector.index) {
        this.recordSelector.index = nextIndex;
        this.song.key = nextIndex;
        this.persist({ commitHistory: true });
      }
      return;
    }
    if (magnitude <= 0.3 && this.recordSelector.stickEngaged) {
      this.recordSelector.active = false;
      this.recordSelector.type = null;
      this.recordSelector.stickEngaged = false;
    }
  }

  updateCountInMetronome() {
    if (!this.recordCountIn) return;
    const now = this.getRecordingTime();
    if (now >= this.recordCountIn.endTime) {
      this.recordCountIn = null;
      return;
    }
    const beatDuration = 60 / (this.recordCountIn.tempo || this.song.tempo || 120);
    const elapsed = Math.max(0, now - this.recordCountIn.startTime);
    const beatIndex = Math.floor(elapsed / beatDuration);
    const cappedBeat = Math.min(this.recordCountIn.beats - 1, beatIndex);
    if (cappedBeat <= this.recordCountIn.lastBeat) return;
    for (let beat = this.recordCountIn.lastBeat + 1; beat <= cappedBeat; beat += 1) {
      const pitch = beat % this.beatsPerBar === 0 ? 84 : 72;
      if (this.game?.audio?.playMidiNote) {
        this.game.audio.playMidiNote(pitch, 'sine', 0.15, 0.45);
      }
    }
    this.recordCountIn.lastBeat = cappedBeat;
  }

  handleKeyboardShortcuts(input) {
    const ctrl = input.isDownCode?.('ControlLeft') || input.isDownCode?.('ControlRight');
    const meta = input.isDownCode?.('MetaLeft') || input.isDownCode?.('MetaRight');
    const cmd = ctrl || meta;
    if (input.wasPressedCode?.('Enter')) {
      if (this.recordModeActive) {
        if (this.recorder.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      } else {
        this.enterRecordMode();
      }
    }
    if (cmd && input.wasPressedCode?.('KeyC')) {
      this.copySelection();
    }
    if (cmd && input.wasPressedCode?.('KeyZ')) {
      this.runtime.undo();
    }
    if (cmd && (input.wasPressedCode?.('KeyY') || (input.isShiftDown?.() && input.wasPressedCode?.('KeyZ')))) {
      this.runtime.redo();
    }
    if (cmd && input.wasPressedCode?.('KeyV')) {
      this.pasteSelection();
    }
    if (cmd && input.wasPressedCode?.('KeyD')) {
      this.duplicateSelection();
    }
  }

  handleGamepadInput(input, dt) {
    if (this.recordModeActive) {
      if (input?.wasGamepadPressed?.('cancel')) {
        this.exitRecordMode();
        this.activeTab = 'virtual-instruments';
        this.controllerMenu.resetFocus();
        this.controllerMenu.setMenus(this.buildControllerMenus(), {
          siblingOrder: MIDI_CONTROLLER_SIBLING_ORDER
        });
        this.controllerMenu.openRoot();
      }
      this.inputActionNormalizer.reset();
      return;
    }
    const normalized = this.inputActionNormalizer.updateGamepad(input, dt, {
      semanticBindings: MIDI_GAMEPAD_SEMANTIC_BINDINGS,
      includePanIntent: true,
      includeZoomIntent: true
    });
    if (!normalized.connected) {
      if (this.controllerMenu.active) this.controllerMenu.closeToSurface();
      this.gamepadCursorActive = false;
      return;
    }
    const { actions: semanticActions, axes, pressed, down, triggers } = normalized;
    const hasSemanticAction = (type) => semanticActions.some((entry) => entry.type === type);
    this.controllerMenu.setMenus(this.buildControllerMenus(), {
      siblingOrder: MIDI_CONTROLLER_SIBLING_ORDER
    });
    this.controllerMenu.ensureInitialFocus();
    if (this.controllerMenu.handleActions(semanticActions, axes, dt, this)) {
      return;
    }
    const drumTrack = isDrumTrack(this.getActiveTrack());
    const rtHeld = triggers.rtHeld;
    const ltHeld = triggers.ltHeld;
    const rtPressed = triggers.rtPressed;
    const rtReleased = triggers.rtReleased;
    const ltPressed = triggers.ltPressed;
    const lbHeld = Boolean(down.aimUp);
    const lbPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.PANEL_PREV);
    const rbPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.PANEL_NEXT);
    const dpadLeftPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.NAV_LEFT);
    const dpadRightPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.NAV_RIGHT);
    const dpadUpPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.NAV_UP);
    const dpadDownPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.NAV_DOWN);
    const backPressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.CANCEL);
    const focusTogglePressed = hasSemanticAction(EDITOR_INPUT_ACTIONS.FOCUS_TOGGLE);

    if (this.activeTab === 'grid' && !this.recordModeActive) {
      if (hasSemanticAction(EDITOR_INPUT_ACTIONS.UNDO)) {
        this.runtime.undo();
      }
      if (hasSemanticAction(EDITOR_INPUT_ACTIONS.REDO)) {
        this.runtime.redo();
      }
      if (hasSemanticAction(EDITOR_INPUT_ACTIONS.CONFIRM)) {
        this.paintNoteAt(this.cursor.tick, this.cursor.pitch, false);
      }
      if (hasSemanticAction(EDITOR_INPUT_ACTIONS.TOOL_OPTIONS)) {
        this.activeTab = 'settings';
      }
    }

    if (hasSemanticAction(EDITOR_INPUT_ACTIONS.MENU)) {
      this.activeTab = 'song';
    }

    if (backPressed) {
      if (this.singleNoteRecordMode.active) {
        this.exitSingleNoteRecordMode();
      } else {
        this.closeSelectionMenu();
      }
    }
    if (focusTogglePressed) {
      this.activeTab = this.activeTab === 'grid' ? 'song' : 'grid';
    }

    if (this.activeTab === 'grid') {
      this.gamepadMoveCooldown = Math.max(0, this.gamepadMoveCooldown - dt);
      this.gamepadResizeCooldown = Math.max(0, this.gamepadResizeCooldown - dt);
      if (this.selection.size === 0) {
        this.gamepadResizeMode.active = false;
      }
      if (lbHeld) {
        const now = performance.now();
        const tapWindow = 320;
        if (dpadUpPressed) {
          this.togglePlayback();
        }
        if (dpadDownPressed) {
          if (this.recordModeActive) {
            if (this.recorder.isRecording) {
              this.stopRecording();
            } else {
              this.startRecording();
            }
          } else {
            this.enterRecordMode();
          }
        }
        if (dpadLeftPressed) {
          if (now - this.gamepadTransportTap.left < tapWindow) {
            this.returnToStart();
          } else {
            this.jumpPlayheadBars(-1);
          }
          this.gamepadTransportTap.left = now;
        }
        if (dpadRightPressed) {
          if (now - this.gamepadTransportTap.right < tapWindow) {
            this.goToEnd();
          } else {
            this.jumpPlayheadBars(1);
          }
          this.gamepadTransportTap.right = now;
        }
      }
      if (!this.recordModeActive) {
        const tickStep = Math.max(1, this.getQuantizeTicks());
        if (lbPressed) {
          this.playheadTick = clamp(
            this.playheadTick - tickStep,
            0,
            this.getEditableGridTick()
          );
          this.resyncPlaybackClock(this.playheadTick);
          if (this.scrubAudition) {
            this.previewNotesAtTick(this.playheadTick);
          }
        }
        if (rbPressed) {
          this.playheadTick = clamp(
            this.playheadTick + tickStep,
            0,
            this.getEditableGridTick()
          );
          this.resyncPlaybackClock(this.playheadTick);
          if (this.scrubAudition) {
            this.previewNotesAtTick(this.playheadTick);
          }
        }
        const zoomDelta = axes.rightTrigger - axes.leftTrigger;
        if (Math.abs(zoomDelta) > 0.01) {
          const { minZoom, maxZoom } = this.getGridZoomLimitsX();
          const nextZoom = clamp((this.gridZoomX || 1) * (1 + zoomDelta * dt * 2), minZoom, maxZoom);
          this.setHorizontalTimelineZoom(nextZoom);
        }
      }

      if (!this.recordModeActive && this.gridBounds && !this.gamepadResizeMode.active) {
        const panDeadzone = 0.12;
        const rightPanX = Math.abs(axes.rightX) > panDeadzone ? axes.rightX : 0;
        const rightPanY = Math.abs(axes.rightY) > panDeadzone ? axes.rightY : 0;
        const panX = rightPanX;
        const panY = rightPanY;
        if (panX || panY) {
          const panSpeed = 420;
          this.gridOffset.x -= panX * panSpeed * dt;
          this.gridOffset.y -= panY * panSpeed * dt;
          this.ensureGridPanCapacity(this.gridOffset.x);
          this.clampGridOffset(
            this.gridBounds.w,
            this.gridBounds.h,
            this.getExpandedGridWidth(),
            this.gridBounds.gridH
          );
          this.updateTimelineStartTickFromGrid();
        }
      }

      if (this.gamepadResizeMode.active) {
        const resizeStep = Math.max(1, this.getResizeMinimumTicksForLayout());
        if (this.gamepadResizeCooldown <= 0) {
          const grow = axes.leftX > 0.55 || axes.leftY < -0.55 || axes.leftY > 0.55;
          const shrink = axes.rightX > 0.55 || axes.rightY < -0.55 || axes.rightY > 0.55;
          if (grow) {
            this.resizeSelectedNotesBy(resizeStep);
            this.gamepadResizeCooldown = 0.12;
          } else if (shrink) {
            this.resizeSelectedNotesBy(-resizeStep);
            this.gamepadResizeCooldown = 0.12;
          }
        }
      }

      if (!lbHeld && !ltHeld && !this.gamepadResizeMode.active) {
        const left = Boolean(down.left || down.dpadLeft);
        const right = Boolean(down.right || down.dpadRight);
        const up = Boolean(down.up || down.dpadUp);
        const downDir = Boolean(down.down || down.dpadDown);
        const moveX = right ? 1 : left ? -1 : 0;
        const moveY = downDir ? 1 : up ? -1 : 0;
        if ((moveX || moveY) && this.gamepadMoveCooldown <= 0) {
          const step = this.getQuantizeTicks();
          const range = this.getPitchRange();
          const maxTick = this.getGridTicks();
          this.cursor.tick = clamp(this.cursor.tick + moveX * step, 0, maxTick);
          this.cursor.pitch = clamp(this.cursor.pitch - moveY, range.min, range.max);
          this.gamepadMoveCooldown = 0.12;
          this.gamepadCursorActive = true;
          this.ensureCursorVisible();
        }
      }

      if (this.gamepadSelection.active && this.dragState?.mode === 'select') {
        const pos = this.getCellScreenPosition(this.cursor.tick, this.cursor.pitch);
        if (pos) {
          this.updateSelectionBox(pos.x, pos.y);
        }
      }

      if (rtReleased && this.gamepadSelection.active) {
        this.finalizeSelectionBox();
        this.dragState = null;
        this.gamepadSelection = { active: false };
        if (this.selection.size === 0) {
          this.closeSelectionMenu();
        }
      }
    }

  }

  buildControllerMenus() {
    const action = (id, label, onSelect, options = {}) => ({ id, label, onSelect, ...options });
    const rootItem = (id, label, submenu = id, tab = id) => ({
      id,
      label,
      submenu,
      onEnter: () => { this.activeTab = tab; }
    });
    const surfaceAction = (id, label, onSelect, options = {}) => action(id, label, () => {
      onSelect();
    }, options);
    return {
      root: {
        id: 'root',
        title: 'MIDI Composer',
        items: MIDI_CONTROLLER_ROOT_ENTRIES.map((entry) => rootItem(
          entry.id,
          entry.label,
          entry.controllerMenuId,
          MIDI_CONTROLLER_ROOT_TO_TAB[entry.id] || entry.id
        ))
      },
      grid: {
        id: 'grid',
        title: 'Grid',
        items: [
          surfaceAction('quantize', `Quantize: ${this.quantizeOptions[this.quantizeIndex]?.label || 'Grid'}`, () => { this.quantizeIndex = (this.quantizeIndex + 1) % this.quantizeOptions.length; }),
          surfaceAction('note-length', `Length: ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`, () => this.setNoteLengthIndex(this.noteLengthIndex + 1))
        ]
      },
      edit: {
        id: 'edit',
        title: 'Edit',
        items: this.getMidiEditMenuItems().map((item) => action(item.id, item.label, item.onClick, {
          disabled: Boolean(item.disabled)
        }))
      },
      view: {
        id: 'view',
        title: 'View',
        items: [
          action('zoom-in', 'Zoom In', () => this.setHorizontalTimelineZoom((this.gridZoomX || this.getDefaultGridZoomX()) * 1.15)),
          action('zoom-out', 'Zoom Out', () => this.setHorizontalTimelineZoom((this.gridZoomX || this.getDefaultGridZoomX()) / 1.15)),
          action('preview', this.previewOnEdit ? 'Preview: On' : 'Preview: Off', () => { this.previewOnEdit = !this.previewOnEdit; }),
          action('contrast', this.highContrast ? 'High Contrast: On' : 'High Contrast: Off', () => { this.highContrast = !this.highContrast; })
        ]
      },
      song: {
        id: 'song',
        title: 'Song',
        items: [
          surfaceAction('play', this.isPlaying ? 'Pause' : 'Play', () => this.togglePlayback()),
          surfaceAction('stop', 'Stop', () => this.stopPlayback()),
          action('loop', this.song.loopEnabled ? 'Loop: On' : 'Loop: Off', () => { this.song.loopEnabled = !this.song.loopEnabled; }),
          action('tempo', `Tempo: ${this.song.tempo} BPM`, () => { this.tempoSliderOpen = true; })
        ]
      },
      tracks: {
        id: 'tracks',
        title: 'Tracks / Mixer',
        items: [
          ...this.song.tracks.map((track, index) => surfaceAction(track.id, `${index + 1}: ${track.name}`, () => { this.selectedTrackIndex = index; this.activeTab = 'instruments'; }))
        ]
      },
      record: {
        id: 'record',
        title: 'Record',
        items: [
          action('enter-record', 'Enter Record Mode', () => this.enterRecordMode()),
          action('single-note', 'Single Note Record', () => this.enterSingleNoteRecordMode())
        ]
      },
      pedals: {
        id: 'pedals',
        title: 'Pedals',
        items: [
          surfaceAction('select-pedal-chain', 'Pedal Chain', () => { this.activeTab = 'pedals'; })
        ]
      },
      settings: {
        id: 'settings',
        title: 'Settings',
        items: [
          action('quantize', `Quantize: ${this.quantizeOptions[this.quantizeIndex]?.label || 'On'}`, () => { this.quantizeEnabled = !this.quantizeEnabled; }),
          action('preview', this.previewOnEdit ? 'Preview: On' : 'Preview: Off', () => { this.previewOnEdit = !this.previewOnEdit; }),
          action('contrast', this.highContrast ? 'High Contrast: On' : 'High Contrast: Off', () => { this.highContrast = !this.highContrast; })
        ]
      },
      file: {
        id: 'file',
        title: 'File',
        items: this.getFileMenuItems().map((item) => (
          item.divider || item.separator
            ? { ...item }
            : action(item.id, item.label, () => this.handleFileMenu(item.id))
        ))
      },
      system: buildControllerSystemMenu({
        fileMenuId: 'file',
        toolsMenuId: 'grid',
        onExit: () => this.exitToMainMenu()
      }),
      'exit-confirm': buildControllerExitConfirmMenu({
        onExit: () => this.exitToMainMenu(),
        message: 'Exit MIDI Composer and return to the main menu.'
      }),
      help: buildControllerHelpMenu(['MIDI record mode keeps performance controls', 'LS/D-pad moves grid cursor'])
    };
  }

  advancePlayhead(dt) {
    const tempo = this.song.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const now = this.getPlaybackClockSeconds();
    if (!Number.isFinite(this.playbackLastClockSeconds)) {
      this.resyncPlaybackClock(this.playheadTick);
    }
    const fallbackElapsed = Number(dt) || 0;
    const rawElapsed = Number.isFinite(now) && Number.isFinite(this.playbackLastClockSeconds)
      ? now - this.playbackLastClockSeconds
      : fallbackElapsed;
    const elapsedSource = rawElapsed > 0 ? rawElapsed : fallbackElapsed;
    const elapsedSeconds = clamp(Math.max(0, elapsedSource), 0, MIDI_PLAYBACK_MAX_CATCHUP_SECONDS);
    this.playbackLastClockSeconds = Number.isFinite(now) ? now : this.playbackLastClockSeconds;
    const loopTicks = this.getLoopTicks();
    const loopStart = this.getLoopStartTick();
    const loopActive = this.song.loopEnabled && typeof this.song.loopEndTick === 'number';
    const nextTick = this.playheadTick + ticksPerSecond * elapsedSeconds;
    if (loopActive) {
      const loopLength = Math.max(1, loopTicks - loopStart);
      const relative = nextTick - loopStart;
      const wrappedTick = loopStart + ((relative % loopLength) + loopLength) % loopLength;
      const lookaheadTicks = MIDI_SCHEDULE_LOOKAHEAD_SECONDS * ticksPerSecond;
      const crossedLoopEnd = nextTick >= loopTicks;
      if (crossedLoopEnd && this.scheduledUntilTick < loopTicks) {
        this.triggerPlayback(Math.max(this.scheduledUntilTick, loopStart), loopTicks, loopTicks, false, Math.min(nextTick, loopTicks));
      }
      this.playheadTick = wrappedTick;
      if (crossedLoopEnd || this.scheduledUntilTick < loopStart) {
        this.scheduledUntilTick = loopStart;
        this.playbackAudioAnchorTick = loopStart;
        const audioNow = this.game?.audio?.ctx?.currentTime;
        this.playbackAudioAnchorSeconds = Number.isFinite(audioNow)
          ? audioNow + Math.max(this.game?.audio?.midiLatency || 0, MIDI_MIN_SCHEDULE_LATENCY_SECONDS)
          : null;
      }
      const targetScheduleTick = Math.min(loopTicks, this.playheadTick + lookaheadTicks);
      if (targetScheduleTick > this.scheduledUntilTick) {
        this.triggerPlayback(this.scheduledUntilTick, targetScheduleTick, loopTicks, false, this.playheadTick);
      }
    } else {
      this.playheadTick = nextTick;
      this.ensureGridCapacity(this.playheadTick);
      const lookaheadTicks = MIDI_SCHEDULE_LOOKAHEAD_SECONDS * ticksPerSecond;
      const targetScheduleTick = this.playheadTick + lookaheadTicks;
      if (targetScheduleTick > this.scheduledUntilTick) {
        this.triggerPlayback(this.scheduledUntilTick, targetScheduleTick, loopTicks, false, this.playheadTick);
      }
    }
    if (this.isPlaying && !this.song.loopEnabled) {
      const playbackEndTick = this.getPlaybackEndTick();
      if (this.playheadTick >= playbackEndTick) {
        this.isPlaying = false;
      }
    }
  }

  triggerPlayback(startTick, endTick, loopTicks, wrap, currentTick = startTick) {
    const loopStart = this.getLoopStartTick();
    const shouldWrap = wrap && endTick < startTick;
    const crossed = shouldWrap
      ? [
        { start: startTick, end: loopTicks },
        { start: loopStart, end: endTick }
      ]
      : [{ start: startTick, end: endTick }];
    const perfEnabled = this.debug?.perf;
    const perfStart = perfEnabled ? performance.now() : 0;
    let noteCount = 0;
    let droppedCount = 0;
    const tempo = this.song?.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const cache = this.getPlaybackEventCache();
    crossed.forEach((range) => {
      const staleTicks = MIDI_STALE_BACKLOG_SECONDS * Math.max(0.0001, ticksPerSecond);
      const catchupTicks = MIDI_PLAYBACK_MAX_CATCHUP_SECONDS * Math.max(0.0001, ticksPerSecond);
      const audibleStart = currentTick - range.start >= staleTicks
        ? Math.max(range.start, currentTick - catchupTicks)
        : range.start;
      if (audibleStart > range.start) {
        droppedCount += this.countPlaybackEventsInRange(cache.events, range.start, audibleStart);
      }
      let emitted = 0;
      for (let index = this.findPlaybackEventIndex(cache.events, audibleStart); index < cache.events.length; index += 1) {
        const event = cache.events[index];
        if (event.tick >= range.end) break;
        if (emitted >= MIDI_MAX_PLAYBACK_EVENTS_PER_FRAME) {
          droppedCount += 1;
          continue;
        }
        const secondsFromAnchor = Math.max(0, (event.tick - this.playbackAudioAnchorTick) / Math.max(0.0001, ticksPerSecond));
        const secondsFromPlayhead = Math.max(0, (event.tick - currentTick) / Math.max(0.0001, ticksPerSecond));
        const minWhen = this.game?.audio?.ctx?.currentTime != null
          ? this.game.audio.ctx.currentTime + Math.max(this.game.audio.midiLatency || 0, MIDI_MIN_SCHEDULE_LATENCY_SECONDS)
          : null;
        const anchoredWhen = this.playbackAudioAnchorSeconds != null
          ? this.playbackAudioAnchorSeconds + secondsFromAnchor
          : null;
        const when = minWhen != null
          ? Math.max(minWhen, anchoredWhen ?? (minWhen + secondsFromPlayhead))
          : null;
        this.playNote(event.track, event.note, event.tick, { when });
        noteCount += 1;
        emitted += 1;
      }
      if (this.metronomeEnabled) {
        this.triggerMetronome(range.start, range.end, loopTicks);
      }
    });
    this.scheduledUntilTick = Math.max(this.scheduledUntilTick, endTick);
    this.droppedPlaybackEvents += droppedCount;
    if (perfEnabled) {
      const elapsed = performance.now() - perfStart;
      if (elapsed > 12 || droppedCount > 0) {
        const sizeEstimate = this.lastPersistedSnapshot?.length || this.history.currentSnapshot?.length || 0;
        console.warn(`[perf] triggerPlayback ${elapsed.toFixed(1)}ms (notes ${noteCount}, dropped ${droppedCount}, song ${sizeEstimate} chars)`);
      }
    }
  }

  getPlaybackEventCache() {
    if (this.playbackEventCache?.patternIndex === this.selectedPatternIndex) {
      return this.playbackEventCache;
    }
    const events = [];
    this.song.tracks.forEach((track) => {
      if (this.isTrackMuted(track)) return;
      const pattern = track.patterns[this.selectedPatternIndex];
      if (!pattern) return;
      const processed = this.getTrackPedalProcessing(track, pattern);
      processed.notes.forEach((note) => {
        if (this.shouldSlurNote(track, pattern, note)) return;
        events.push({
          tick: this.getSwingedTick(note.startTick),
          track,
          note
        });
      });
    });
    events.sort((a, b) => a.tick - b.tick || (a.note.pitch ?? 0) - (b.note.pitch ?? 0));
    this.playbackEventCache = {
      patternIndex: this.selectedPatternIndex,
      events
    };
    return this.playbackEventCache;
  }

  getAudiblePlaybackRangeStart(startTick, endTick, ticksPerSecond) {
    const rangeTicks = endTick - startTick;
    const catchupTicks = MIDI_MAX_AUDIBLE_CATCHUP_SECONDS * Math.max(0.0001, ticksPerSecond);
    return rangeTicks > catchupTicks ? Math.max(startTick, endTick - catchupTicks) : startTick;
  }

  findPlaybackEventIndex(events, tick) {
    let low = 0;
    let high = events.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (events[mid].tick < tick) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  countPlaybackEventsInRange(events, startTick, endTick) {
    if (!events?.length || endTick <= startTick) return 0;
    let count = 0;
    for (let index = this.findPlaybackEventIndex(events, startTick); index < events.length; index += 1) {
      if (events[index].tick >= endTick) break;
      count += 1;
    }
    return count;
  }

  triggerMetronome(startTick, endTick, loopTicks) {
    const beatTicks = this.getBeatTicks();
    const startBeat = Math.floor(startTick / beatTicks);
    const endBeat = Math.floor(endTick / beatTicks);
    for (let beat = startBeat; beat <= endBeat; beat += 1) {
      const beatTick = beat * beatTicks;
      if (beatTick >= startTick && beatTick < endTick) {
        const pitch = beat % this.beatsPerBar === 0 ? 84 : 72;
        if (this.game?.audio?.playMidiNote) {
          try {
            this.game.audio.playMidiNote(pitch, 'sine', 0.15, 0.4);
          } catch (error) {
            console.warn('MIDI metronome playback failed', error);
          }
        }
      }
    }
    if (endTick < startTick) {
      this.triggerMetronome(this.getLoopStartTick(), endTick, loopTicks);
    }
  }

  getSwingedTick(tick) {
    if (this.swing <= 0) return tick;
    const beatTicks = this.getBeatTicks();
    const swingAmount = (this.swing / 100) * (beatTicks / 2) * 0.6;
    const halfBeat = beatTicks / 2;
    const offset = tick % beatTicks;
    if (offset >= halfBeat && offset < beatTicks) {
      return tick + swingAmount;
    }
    return tick;
  }

  shouldSlurNote(track, pattern, note) {
    if (!this.slurEnabled || isDrumTrack(track)) return false;
    return pattern.notes.some((other) => {
      if (other.id === note.id || other.pitch !== note.pitch) return false;
      const otherEnd = other.startTick + other.durationTicks;
      return other.startTick < note.startTick && otherEnd >= note.startTick;
    });
  }

  playNote(track, note, startTick, options = {}) {
    const drumTrack = isDrumTrack(track);
    if (this.activeNotes.size >= MAX_ACTIVE_NOTES) return;
    const durationTicks = this.getEffectiveDurationTicks(note, track);
    const tempo = this.song?.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const duration = Math.max(0.03, durationTicks / Math.max(0.0001, ticksPerSecond));
    const velocity = note.velocity ?? 0.8;
    const pitch = drumTrack ? this.coercePitchForTrack(note.pitch, track, GM_DRUM_ROWS) : note.pitch;
    if (drumTrack) {
      this.ensureDrumTrackSettings(track);
    }
    const mix = this.getTrackPlaybackMix(track, startTick);
    const pedalPanOffset = clamp(track?._pedalPanOffset ?? 0, -1, 1);
    const resolvedPan = clamp(mix.pan + pedalPanOffset, -1, 1);
    this.playGmNote(pitch, duration, velocity * mix.volume, track, resolvedPan, { when: options.when });
    const now = performance.now();
    this.activeNotes.set(note.id, { trackId: track.id, expires: now + duration * 1000 + 120 });
    this.lastPlaybackTick = startTick;
  }

  applyPedalCcEvent(event, track) {
    const controller = Number(event?.controller);
    const value = clamp((Number(event?.value) || 0) / 127, 0, 1);
    const audio = this.game?.audio;
    if (!audio) return;
    if (controller === 91) {
      audio.setMidiReverbEnabled?.(value > 0.01);
      audio.setMidiReverbLevel?.(value);
      return;
    }
    if (controller === 74) {
      const shaped = clamp(0.42 + (value * 0.92), 0, 1);
      audio.setMidiVolume?.(shaped);
      audio.setMidiReverbLevel?.(clamp(this.audioSettings.reverbLevel * 0.65 + value * 0.25, 0, 1));
      return;
    }
    if (controller === 10) {
      if (track) track._pedalPanOffset = (value * 2 - 1) * 0.75;
      return;
    }
    if (controller === 1 || controller === 71) {
      const bend = (value - 0.5) * (controller === 1 ? 3.2 : 1.6);
      audio.setMidiPitchBend?.(bend, Number.isFinite(track?.channel) ? track.channel : null);
    }
  }

  getPlaybackPedalsForTrack(track) {
    const normalized = normalizeMidiPedals(track?.midiPedals);
    const activeTrack = this.getActiveTrack?.();
    const isEditingThisTrack = Boolean(
      track
      && activeTrack
      && track.id === activeTrack.id
      && this.pedalUiState?.editorOpen
      && Number.isInteger(this.pedalUiState?.selectedSlot)
      && this.pedalUiState?.draftPedal
    );
    if (!isEditingThisTrack) return normalized;
    const slot = this.pedalUiState.selectedSlot;
    normalized[slot] = JSON.parse(JSON.stringify(this.pedalUiState.draftPedal));
    return normalized;
  }

  playGmNote(pitch, duration, volume, track, pan = 0, options = {}) {
    if (this.game?.audio?.playGmNote) {
      const drumTrack = isDrumTrack(track);
      const resolvedPitch = drumTrack ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS) : pitch;
      const resolvedDuration = duration;
      if (drumTrack) {
        this.ensureDrumTrackSettings(track);
      }
      try {
        this.game.audio.playGmNote({
          pitch: resolvedPitch,
          duration: resolvedDuration,
          volume,
          program: track.program,
          channel: drumTrack ? GM_DRUM_CHANNEL : track.channel,
          bankMSB: drumTrack ? (track.bankMSB ?? DRUM_BANK_MSB) : track.bankMSB,
          bankLSB: drumTrack ? DRUM_BANK_LSB : track.bankLSB,
          pedals: this.getPlaybackPedalsForTrack(track),
          pan,
          preview: options.preview === true,
          trackId: track?.id ?? null,
          when: Number.isFinite(options.when) ? options.when : null
        });
      } catch (error) {
        console.error('MIDI audio playback failed', error);
        this.showEditorMessage?.(`MIDI audio failed: ${error?.message || error}`);
      }
      return;
    }
    if (this.game?.audio?.playMidiNote) {
      try {
        this.game.audio.playMidiNote(pitch, 'sine', duration, volume, null, pan);
      } catch (error) {
        console.error('MIDI audio playback failed', error);
        this.showEditorMessage?.(`MIDI audio failed: ${error?.message || error}`);
      }
    }
  }

  playPreviewGmNote(pitch, duration, volume, track, pan = 0) {
    if (!track) return;
    const busy = this.isPlaying || this.recorder?.isRecording;
    const previewDuration = Math.max(0.04, Math.min(duration, busy ? 0.18 : 0.36));
    const previewVolume = clamp((volume ?? track.volume ?? 0.8) * (busy ? 0.42 : 0.72), 0, 0.72);
    const previewTrack = {
      ...track,
      midiPedals: this.getPlaybackPedalsForTrack(track)
    };
    window.setTimeout(() => {
      this.playGmNote(pitch, previewDuration, previewVolume, previewTrack, pan, { preview: true });
    }, 0);
  }

  cleanupActiveNotes() {
    const now = performance.now();
    Array.from(this.activeNotes.entries()).forEach(([id, payload]) => {
      if (payload.expires <= now) {
        this.activeNotes.delete(id);
      }
    });
  }

  cancelLongPressTimer() {
    if (!this.longPressTimer) return;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  handlePedalPointerDown(x, y) {
    if (this.pedalUiState.editorOpen && this.pedalEditorOverlayBounds) {
      const pedalInspectorHit = this.pedalInspectorBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (pedalInspectorHit) {
        const slot = this.pedalUiState.selectedSlot;
        const track = this.getActiveTrack();
        if (!track || !Number.isInteger(slot)) return true;
        const pedals = normalizeMidiPedals(track.midiPedals);
        const sourcePedal = this.pedalUiState.draftPedal || pedals[slot];
        if (pedalInspectorHit.control === 'pedal-delete') {
          this.deletePedalFromEditor();
        } else if (pedalInspectorHit.control === 'pedal-ok') {
          this.commitPedalEditor();
        } else if (pedalInspectorHit.control === 'pedal-cancel') {
          this.cancelPedalEditor();
        } else if (pedalInspectorHit.control === 'pedal-stomp-toggle' && sourcePedal) {
          this.pedalUiState.draftPedal = { ...sourcePedal, enabled: !sourcePedal.enabled };
        } else if (pedalInspectorHit.control === 'pedal-knob') {
          const current = Number(sourcePedal?.knobs?.[pedalInspectorHit.knobKey]);
          this.dragState = {
            mode: 'pedal-knob-turn',
            bounds: pedalInspectorHit,
            startY: y,
            startValue: Number.isFinite(current) ? current : pedalInspectorHit.min
          };
        }
        return true;
      }
      if (!this.pedalEditorModalBounds || !this.pointInBounds(x, y, this.pedalEditorModalBounds)) {
        this.cancelPedalEditor();
      }
      return true;
    }
    const pedalPickerHit = this.pedalPickerBounds?.find((bounds) => this.pointInBounds(x, y, bounds) && bounds.control === 'pedal-picker-item');
    const pedalPickerScrollAreaHit = this.pedalPickerBounds?.find((bounds) => this.pointInBounds(x, y, bounds) && bounds.control === 'pedal-picker-scroll-area');
    if (pedalPickerScrollAreaHit) {
      this.dragState = {
        mode: 'pedal-picker-scroll',
        startY: y,
        startScroll: this.pedalUiState.pickerScroll || 0,
        moved: false,
        pendingPick: pedalPickerHit ? { ...pedalPickerHit } : null
      };
      return true;
    }
    if (pedalPickerHit) {
      this.insertPedalIntoSlot(this.pedalUiState.pickerSlot ?? 0, pedalPickerHit.pedalType);
      return true;
    }
    if (this.pedalUiState.pickerOpen) {
      this.pedalUiState.pickerOpen = false;
      this.pedalUiState.pickerSlot = null;
      this.pedalUiState.pickerScroll = 0;
      return true;
    }
    const pedalInspectorHit = this.pedalInspectorBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
    if (pedalInspectorHit) {
      const slot = this.pedalUiState.selectedSlot;
      const track = this.getActiveTrack();
      if (!track || !Number.isInteger(slot)) return true;
      const pedals = normalizeMidiPedals(track.midiPedals);
      const sourcePedal = this.pedalUiState.editorOpen
        ? this.pedalUiState.draftPedal
        : pedals[slot];
      if (pedalInspectorHit.control === 'pedal-delete') {
        this.deletePedalFromEditor();
      } else if (pedalInspectorHit.control === 'pedal-ok') {
        this.commitPedalEditor();
      } else if (pedalInspectorHit.control === 'pedal-cancel') {
        this.cancelPedalEditor();
      } else if (pedalInspectorHit.control === 'pedal-stomp-toggle' && sourcePedal) {
        if (this.pedalUiState.editorOpen) {
          this.pedalUiState.draftPedal = { ...sourcePedal, enabled: !sourcePedal.enabled };
        } else {
          pedals[slot] = { ...sourcePedal, enabled: !sourcePedal.enabled };
          track.midiPedals = pedals;
          this.persist({ commitHistory: true });
        }
      } else if (pedalInspectorHit.control === 'pedal-knob') {
        const current = Number(sourcePedal?.knobs?.[pedalInspectorHit.knobKey]);
        this.dragState = {
          mode: 'pedal-knob-turn',
          bounds: pedalInspectorHit,
          startY: y,
          startValue: Number.isFinite(current) ? current : pedalInspectorHit.min
        };
      }
      return true;
    }
    if (this.pedalUiState.editorOpen && this.pedalEditorOverlayBounds && this.pointInBounds(x, y, this.pedalEditorOverlayBounds)) {
      return true;
    }
    const pedalSlotHit = this.pedalSlotBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
    if (pedalSlotHit) {
      const track = this.getActiveTrack();
      const pedals = normalizeMidiPedals(track?.midiPedals);
      if (pedals[pedalSlotHit.slotIndex]) {
        this.openPedalEditorForSlot(pedalSlotHit.slotIndex);
      } else {
        this.pedalUiState.pickerSlot = pedalSlotHit.slotIndex;
        this.pedalUiState.pickerOpen = true;
        this.pedalUiState.pickerPage = 0;
        this.pedalUiState.pickerScroll = 0;
        this.pedalUiState.editorOpen = false;
        this.pedalUiState.draftPedal = null;
      }
      return true;
    }
    return false;
  }

  handlePointerDown(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    this.cancelLongPressTimer();
    this.pendingDesktopDropdownHit = null;
    if (!this.recordModeActive && this.dragState) {
      this.dragState = null;
      this.draggingTrackControl = null;
    }
    const { x, y } = payload;
    if (!this.isMobileLayout() && shouldCloseDesktopDropdownOnPointerDown({
      dropdown: this.desktopDropdown,
      point: payload,
      rootButtons: this.getDesktopRootButtons(),
      rootIdKey: 'desktopRootId'
    })) {
      this.closeMidiDesktopDropdown();
      return;
    }
    if (!this.isMobileLayout()) {
      const desktopDropdownHit = this.bounds.desktopDropdownItems?.find((item) => this.pointInBounds(x, y, item));
      if (desktopDropdownHit) {
        this.pendingDesktopDropdownHit = createPendingDesktopDropdownHit(desktopDropdownHit, { x, y });
        return;
      }
    }
    if (this.transportPopover) {
      const hit = this.bounds.transportPopoverButtons?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (hit) {
        hit.action?.();
        this.closeTransportPopover();
        return;
      }
      this.closeTransportPopover();
      return;
    }
    const suppressLandscapeMenuThumbstick = this.isMobileLandscapeThumbZoomMode() && this.landscapeRootDrawerOpen;
    if (!suppressLandscapeMenuThumbstick && this.isMobileLandscapeThumbZoomMode() && payload.touchCount > 0 && this.panJoystick.radius > 0) {
      const dx = payload.x - this.panJoystick.center.x;
      const dy = payload.y - this.panJoystick.center.y;
      if (Math.hypot(dx, dy) <= this.panJoystick.radius * 1.2) {
        this.panJoystick.active = true;
        this.panJoystick.id = payload.id ?? 'touch';
        this.updatePanJoystick(payload.x, payload.y);
        return;
      }
    }
    if (this.gamepadSlideOutMenuMeta?.scrollBounds
      && this.pointInBounds(x, y, this.gamepadSlideOutMenuMeta.scrollBounds)
      && (this.gamepadSlideOutMenuMeta.maxScroll || 0) > 0) {
      const pendingIndex = (this.gamepadSlideOutMenuMeta.itemBounds || [])
        .findIndex((bounds) => this.pointInBounds(x, y, bounds));
      const pendingItem = pendingIndex >= 0
        ? this.gamepadSlideOutMenuMeta.items?.[(this.gamepadSlideOutMenuMeta.scroll || 0) + pendingIndex]
        : null;
      const drag = buildMenuScrollDragState({
        regions: [{
          menuId: this.gamepadSlideOutMenuMeta.menuId,
          bounds: this.gamepadSlideOutMenuMeta.scrollBounds,
          maxScroll: this.gamepadSlideOutMenuMeta.maxScroll || 0,
          lineHeight: this.gamepadSlideOutMenuMeta.lineHeight || 44
        }],
        point: payload,
        scrollState: this.controllerMenu.scroll,
        pendingHit: pendingItem && !pendingItem.disabled ? pendingItem : null,
        thresholdPx: 6,
        defaultLineHeight: this.gamepadSlideOutMenuMeta.lineHeight || 44
      });
      if (drag) {
        this.dragState = { ...drag, mode: 'gamepad-submenu-scroll' };
        return;
      }
    }
    if (!this.recordModeActive
      && this.bounds.landscapeMenuButton
      && this.pointInBounds(x, y, this.bounds.landscapeMenuButton)) {
      this.landscapeRootDrawerOpen = !this.landscapeRootDrawerOpen;
      this.closeSelectionMenu();
      this.pastePreview = null;
      this.noteLengthMenu.open = false;
      this.tempoSliderOpen = false;
      return;
    }
    if (!this.recordModeActive
      && findScrollableMenuRegion(this.menuScrollRegions, payload)) {
      const rootScrollRegion = findScrollableMenuRegion(this.menuScrollRegions, payload);
      const hitButton = this.mobileLandscapeRootMenuButtons?.find((bounds) => this.pointInBounds(x, y, bounds));
      const drag = buildMenuScrollDragState({
        regions: this.menuScrollRegions,
        point: payload,
        scrollState: { [rootScrollRegion.menuId]: this.controllerMenu.scroll.root || 0 },
        pendingHit: hitButton ? { id: hitButton.id } : null,
        thresholdPx: 6,
        defaultLineHeight: 24
      });
      if (!drag) return;
      this.dragState = {
        ...drag,
        mode: 'mobile-landscape-root-scroll',
        pendingRootId: hitButton?.id || null
      };
      return;
    }
    if (!this.recordModeActive && this.landscapeRootDrawerOpen) {
      this.landscapeRootDrawerOpen = false;
      return;
    }

    if (this.recordModeActive) {
      const pedalOverlayOpen = this.pedalUiState.pickerOpen || this.pedalUiState.editorOpen;
      if (pedalOverlayOpen && this.handlePedalPointerDown(x, y)) return;
      if (this.bounds.record && this.pointInBounds(x, y, this.bounds.record)) {
        if (this.recorder.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
        return;
      }
      if (this.bounds.play && this.pointInBounds(x, y, this.bounds.play)) {
        this.togglePlayback();
        return;
      }
      if (this.bounds.returnStart && this.pointInBounds(x, y, this.bounds.returnStart)) {
        this.returnToStart();
        return;
      }
      if (this.bounds.prevBar && this.pointInBounds(x, y, this.bounds.prevBar)) {
        this.jumpPlayheadBars(-1);
        return;
      }
      if (this.bounds.nextBar && this.pointInBounds(x, y, this.bounds.nextBar)) {
        this.jumpPlayheadBars(1);
        return;
      }
      if (this.bounds.goEnd && this.pointInBounds(x, y, this.bounds.goEnd)) {
        this.goToEnd();
        return;
      }
      if (this.bounds.loopToggle && this.pointInBounds(x, y, this.bounds.loopToggle)) {
        this.toggleLoopEnabled();
        return;
      }
      const recordSettingsHit = this.bounds.recordSettingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (recordSettingsHit) {
        if (recordSettingsHit.id === 'record-quantize') this.recordQuantizeEnabled = !this.recordQuantizeEnabled;
        if (recordSettingsHit.id === 'record-countin') this.recordCountInEnabled = !this.recordCountInEnabled;
        if (recordSettingsHit.id === 'record-metronome') this.recordMetronomeEnabled = !this.recordMetronomeEnabled;
        if (recordSettingsHit.id === 'record-keyboard-octave-down') {
          this.setKeyboardStartOctave((this.song.keyboardStartOctave ?? DEFAULT_KEYBOARD_START_OCTAVE) - 1);
        }
        if (recordSettingsHit.id === 'record-keyboard-octave-up') {
          this.setKeyboardStartOctave((this.song.keyboardStartOctave ?? DEFAULT_KEYBOARD_START_OCTAVE) + 1);
        }
        if (recordSettingsHit.id === 'record-tuning-string') {
          this.cycleStringTuning(recordSettingsHit.instrument, recordSettingsHit.stringIndex, recordSettingsHit.delta ?? 1);
        }
        if (recordSettingsHit.id === 'record-tuning-reset') {
          this.resetStringTuning(recordSettingsHit.instrument);
        }
        return;
      }
      if (this.midiPortraitRecordSettingsOpen && this.bounds.recordSettingsPanel && this.pointInBounds(x, y, this.bounds.recordSettingsPanel)) {
        return;
      }
      if (!pedalOverlayOpen && this.handlePedalPointerDown(x, y)) return;
      if (this.bounds.recordVirtualInstrument && this.pointInBounds(x, y, this.bounds.recordVirtualInstrument)) {
        this.midiPortraitRecordSettingsOpen = false;
        this.recordLayout.instrumentMenuOpen = !this.recordLayout.instrumentMenuOpen;
        return;
      }
      if (this.bounds.recordSettings && this.pointInBounds(x, y, this.bounds.recordSettings)) {
        this.recordLayout.instrumentMenuOpen = false;
        this.midiPortraitRecordSettingsOpen = !this.midiPortraitRecordSettingsOpen;
        return;
      }
      const action = this.recordLayout.handlePointerDown(payload);
      if (action?.type === 'device') {
        this.recordDevicePreference = action.value;
        return;
      }
      if (action?.type === 'instrument') {
        const recordInstruments = this.getRecordModeVirtualInstruments();
        if (recordInstruments.includes(action.value)) {
          this.setRecordInstrument(action.value);
        }
        return;
      }
      if (action?.type === 'keyboard-octave') {
        this.setKeyboardStartOctave(action.value);
        return;
      }
      if (action?.type === 'string-tuning') {
        const key = action.instrument === 'bass' ? 'bassTuning' : 'guitarTuning';
        const fallback = action.instrument === 'bass' ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING;
        const tuning = normalizeMidiTuning(this.song[key], fallback);
        tuning[action.stringIndex] = action.pitch;
        this.setStringTuning(action.instrument, tuning);
        return;
      }
      if (action?.type === 'standard-tuning') {
        this.resetStringTuning(action.instrument);
        return;
      }
      if (action?.type === 'quantize') {
        this.recordQuantizeEnabled = this.recordLayout.quantizeEnabled;
        return;
      }
      if (action?.type === 'countin') {
        this.recordCountInEnabled = this.recordLayout.countInEnabled;
        return;
      }
      if (action?.type === 'metronome') {
        this.recordMetronomeEnabled = this.recordLayout.metronomeEnabled;
        return;
      }
      if (action?.type === 'playback-play') {
        this.togglePlayback();
        return;
      }
      if (action?.type === 'playback-stop') {
        this.stopPlayback();
        return;
      }
      if (action?.type === 'record-toggle') {
        if (this.recorder.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
        return;
      }
      if (action?.type === 'touch') {
        return;
      }
      if (action?.type) {
        return;
      }
      const tabHit = this.bounds.tabs?.find((tab) => this.pointInBounds(x, y, tab));
      if (tabHit) {
        this.exitRecordMode();
        if (this.isMobileLayout()) {
          this.activateLeftRailTab(tabHit.id);
        } else {
          this.openMidiDesktopDropdown(tabHit.desktopRootId || tabHit.id);
        }
        return;
      }
      if (this.bounds.fileButton && this.pointInBounds(x, y, this.bounds.fileButton)) {
        if (this.activeTab === 'instruments' || this.instrumentPicker.mode) {
          this.confirmInstrumentSelection();
        }
        this.exitRecordMode();
        if (this.isMobileLayout()) {
          this.activeTab = 'file';
        } else {
          this.openMidiDesktopDropdown('file');
        }
        return;
      }
      if (this.bounds.undoButton && this.pointInBounds(x, y, this.bounds.undoButton)) {
        this.runtime.undo();
        return;
      }
      if (this.bounds.redoButton && this.pointInBounds(x, y, this.bounds.redoButton)) {
        this.runtime.redo();
        return;
      }
      if (this.bounds.leftSettings && this.pointInBounds(x, y, this.bounds.leftSettings)) {
        this.exitRecordMode();
        if (this.isMobileLayout()) {
          this.activeTab = 'settings';
        } else {
          this.openMidiDesktopDropdown('settings');
        }
        return;
      }
      return;
    }
    if (this.qaOverlayOpen) {
      const hit = this.qaBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (hit) {
        if (hit.id === 'qa-load') this.loadDemoSong();
        if (hit.id === 'qa-run') this.runQaChecks();
        if (hit.id === 'qa-close') this.qaOverlayOpen = false;
      }
      return;
    }

    const isPortraitMainWorkspace = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: this.viewportWidth || this.game?.canvas?.width || 0,
      viewportHeight: this.viewportHeight || this.game?.canvas?.height || 0
    }) && isMidiPortraitMainWorkspaceTab(this.activeTab) && !this.mobilePortraitMenuSheetBounds;
    if (!isPortraitMainWorkspace && ((this.bounds.settings && this.pointInBounds(x, y, this.bounds.settings))
      || (this.bounds.leftSettings && this.pointInBounds(x, y, this.bounds.leftSettings)))) {
      if (!this.isMobileLayout()) {
        this.openMidiDesktopDropdown('settings');
        return;
      }
      this.activeTab = 'settings';
      this.closeSelectionMenu();
      this.pastePreview = null;
      this.noteLengthMenu.open = false;
      this.tempoSliderOpen = false;
      return;
    }

    if (this.activeTab === 'file') {
      if (this.fileMenuListBounds && this.pointInBounds(x, y, this.fileMenuListBounds)) {
        const fileHit = this.fileMenuBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
        this.dragState = {
          mode: 'file-menu-scroll',
          startY: y,
          startScroll: this.fileMenuScroll,
          moved: false,
          target: fileHit?.id || null
        };
        return;
      }
      const fileHit = this.fileMenuBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (fileHit) {
        this.dragState = { mode: 'file-menu-tap', target: fileHit.id, startX: x, startY: y, moved: false };
        return;
      }
    }

    if (this.genreMenuOpen) {
      const genreHit = this.genreMenuBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (genreHit) {
        if (genreHit.id === 'cancel') {
          this.genreMenuOpen = false;
          return;
        }
        this.selectedGenre = genreHit.id;
        this.generatePattern(genreHit.id);
        this.genreMenuOpen = false;
        return;
      }
      this.genreMenuOpen = false;
    }

    if (this.instrumentPicker.mode && this.instrumentPicker.modalBounds && !this.pointInBounds(x, y, this.instrumentPicker.modalBounds)) {
      this.instrumentPicker.mode = null;
      this.instrumentPicker.selectedProgram = null;
      this.instrumentPicker.returnTab = null;
      return;
    }

    if (this.instrumentPicker.mode) {
      if (this.instrumentPicker.tabPrevBounds && this.pointInBounds(x, y, this.instrumentPicker.tabPrevBounds)) {
        this.shiftInstrumentPickerTab(-1);
        return;
      }
      if (this.instrumentPicker.tabNextBounds && this.pointInBounds(x, y, this.instrumentPicker.tabNextBounds)) {
        this.shiftInstrumentPickerTab(1);
        return;
      }
      const familyHit = this.instrumentPicker.tabBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (familyHit) {
        if (payload.touchCount) {
          this.dragState = {
            mode: 'instrument-tab-swipe',
            startX: x,
            startY: y,
            tabId: familyHit.id,
            startTabScrollX: this.instrumentPicker.tabScrollX || 0,
            moved: false
          };
          return;
        }
        this.instrumentPicker.familyTab = familyHit.id;
        this.instrumentPicker.scroll = 0;
        return;
      }
      if (payload.touchCount
        && this.instrumentPicker.tabAreaBounds
        && this.pointInBounds(x, y, this.instrumentPicker.tabAreaBounds)) {
        this.dragState = {
          mode: 'instrument-tab-swipe',
          startX: x,
          startY: y,
          tabId: null,
          startTabScrollX: this.instrumentPicker.tabScrollX || 0,
          moved: false
        };
        return;
      }
      const favHit = this.instrumentPicker.favoriteBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (favHit) {
        this.toggleFavoriteInstrument(favHit.program);
        return;
      }
      if (this.instrumentPicker.confirmBounds && this.pointInBounds(x, y, this.instrumentPicker.confirmBounds)) {
        if (Number.isInteger(this.instrumentPicker.selectedProgram) || this.instrumentPicker.familyTab === 'drum-kits') {
          this.applyInstrumentSelection(this.instrumentPicker.selectedProgram);
        }
        return;
      }
      if (this.instrumentPicker.cancelBounds && this.pointInBounds(x, y, this.instrumentPicker.cancelBounds)) {
        this.instrumentPicker.mode = null;
        this.instrumentPicker.selectedProgram = null;
        this.instrumentPicker.returnTab = null;
        return;
      }
      const pickHit = this.instrumentPicker.bounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (pickHit) {
        if (payload.touchCount) {
          this.dragState = {
            mode: 'instrument-scroll',
            startY: y,
            startScroll: this.instrumentPicker.scroll,
            startX: x,
            moved: false,
            pendingPick: { ...pickHit }
          };
          return;
        }
        this.selectInstrumentPickerItem(pickHit);
        return;
      }
      if (this.instrumentPicker.scrollUpBounds && this.pointInBounds(x, y, this.instrumentPicker.scrollUpBounds)) {
        this.instrumentPicker.scroll = clamp(
          this.instrumentPicker.scroll - Math.max(1, this.instrumentPicker.scrollStep),
          0,
          this.instrumentPicker.scrollMax
        );
        return;
      }
      if (this.instrumentPicker.scrollDownBounds && this.pointInBounds(x, y, this.instrumentPicker.scrollDownBounds)) {
        this.instrumentPicker.scroll = clamp(
          this.instrumentPicker.scroll + Math.max(1, this.instrumentPicker.scrollStep),
          0,
          this.instrumentPicker.scrollMax
        );
        return;
      }
      const pickerTrackHit = this.bounds.instrumentList?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (pickerTrackHit) {
        this.selectedTrackIndex = pickerTrackHit.trackIndex;
        this.selection.clear();
        this.instrumentPicker.trackIndex = pickerTrackHit.trackIndex;
        const pickerTrack = this.song.tracks[pickerTrackHit.trackIndex];
        if (pickerTrack) {
          this.instrumentPicker.selectedProgram = pickerTrack.program ?? null;
          const tabs = this.getInstrumentPickerTabs();
          const preferredTab = isDrumTrack(pickerTrack)
            ? 'drum-kits'
            : this.getInstrumentCategory(pickerTrack.program);
          this.instrumentPicker.familyTab = tabs.some((tab) => tab.id === preferredTab)
            ? preferredTab
            : (tabs[0]?.id || this.instrumentPicker.familyTab || 'drums-perc');
          this.instrumentPicker.tabScrollX = Math.max(0, tabs.findIndex((tab) => tab.id === this.instrumentPicker.familyTab) * 96);
          const availableKits = this.game?.audio?.listAvailableDrumKits?.();
          const drumKits = Array.isArray(availableKits) && availableKits.length ? availableKits : GM_DRUM_KITS;
          const matchedKit = isDrumTrack(pickerTrack)
            ? drumKits.find((kit) => kit.program === pickerTrack.program && kit.bankMSB === pickerTrack.bankMSB && kit.bankLSB === pickerTrack.bankLSB)
            : null;
          if (matchedKit?.id) {
            this.instrumentPicker.drumKitId = matchedKit.id;
          }
          this.previewInstrument(pickerTrack.program, pickerTrack);
        }
        return;
      }
      if (this.instrumentPicker.sectionBounds.find((bounds) => this.pointInBounds(x, y, bounds))) {
        this.dragState = {
          mode: 'instrument-scroll',
          startY: y,
          startScroll: this.instrumentPicker.scroll
        };
      }
      return;
    }

    const noteLengthHit = this.bounds.noteLengthMenu?.find((bounds) => this.pointInBounds(x, y, bounds));
    if (noteLengthHit) {
      this.setNoteLengthIndex(noteLengthHit.index);
      this.noteLengthMenu.open = false;
      return;
    }

    if (this.activeTab === 'grid' && this.bounds.keyframeToggle && this.pointInBounds(x, y, this.bounds.keyframeToggle)) {
      this.keyframePanelOpen = !this.keyframePanelOpen;
      return;
    }
    if (this.bounds.keyframePrev && this.pointInBounds(x, y, this.bounds.keyframePrev)) {
      this.jumpSongMixKeyframe(-1);
      return;
    }
    if (this.bounds.keyframeSet && this.pointInBounds(x, y, this.bounds.keyframeSet)) {
      const track = this.getActiveTrack();
      if (track) {
        const tick = this.snapTick(this.playheadTick);
        const control = this.activeTab === 'song' ? this.songMixControlMode : null;
        const mixAtTick = this.getTrackPlaybackMix(track, tick);
        if (control === 'pan') {
          this.addSongAutomationKeyframe(track, 'pan', tick, mixAtTick.pan, { exactTick: true });
        } else if (control === 'volume') {
          this.addSongAutomationKeyframe(track, 'padding', tick, mixAtTick.volume, { exactTick: true });
        } else {
          this.addSongAutomationKeyframe(track, 'padding', tick, mixAtTick.volume, { exactTick: true });
          this.addSongAutomationKeyframe(track, 'pan', tick, mixAtTick.pan, { exactTick: true });
        }
      }
      return;
    }
    if (this.bounds.keyframeRemove && this.pointInBounds(x, y, this.bounds.keyframeRemove)) {
      const track = this.getActiveTrack();
      if (track) {
        const tick = this.snapTick(this.playheadTick);
        const control = this.activeTab === 'song' ? this.songMixControlMode : null;
        if (control === 'pan') {
          this.removeSongAutomationKeyframe(track, 'pan', tick);
        } else if (control === 'volume') {
          this.removeSongAutomationKeyframe(track, 'padding', tick);
        } else {
          this.removeSongAutomationKeyframe(track, 'padding', tick);
          this.removeSongAutomationKeyframe(track, 'pan', tick);
        }
      }
      return;
    }
    if (this.bounds.keyframeNext && this.pointInBounds(x, y, this.bounds.keyframeNext)) {
      this.jumpSongMixKeyframe(1);
      return;
    }

    if (this.activeTab === 'grid' && this.bounds.record && this.pointInBounds(x, y, this.bounds.record)) {
      this.enterRecordMode();
      return;
    }
    const gridQuickHit = this.activeTab === 'grid'
      ? this.bounds.gridQuickControls?.find((bounds) => this.pointInBounds(x, y, bounds))
      : null;
    if (this.activeTab === 'grid' && this.midiPortraitMasterVolumeOpen) {
      if (this.bounds.midiPortraitMasterVolumeSlider && this.pointInBounds(x, y, this.bounds.midiPortraitMasterVolumeSlider)) {
        this.dragState = { mode: 'slider', id: 'audio-volume', bounds: this.bounds.midiPortraitMasterVolumeSlider };
        this.updateSliderValue(x, y, 'audio-volume', this.bounds.midiPortraitMasterVolumeSlider);
        return;
      }
      const panelHit = this.bounds.midiPortraitMasterVolumePanel && this.pointInBounds(x, y, this.bounds.midiPortraitMasterVolumePanel);
      if (panelHit) return;
      if (!gridQuickHit) {
        this.closeMidiPortraitMasterVolume();
        return;
      }
    }
    if (this.activeTab === 'grid' && this.midiPortraitTrackPickerOpen) {
      const rowHit = this.bounds.midiPortraitTrackPickerRows?.find((bounds) => this.pointInBounds(x, y, bounds));
      const scrollAreaHit = this.bounds.midiPortraitTrackPickerScrollArea && this.pointInBounds(x, y, this.bounds.midiPortraitTrackPickerScrollArea);
      if (scrollAreaHit) {
        this.dragState = {
          mode: 'midi-portrait-track-picker-scroll',
          startY: y,
          startScroll: this.midiPortraitTrackPickerScroll || 0,
          moved: false,
          pendingTrackHit: rowHit ? { ...rowHit } : null
        };
        return;
      }
      if (rowHit) {
        this.selectMidiPortraitTrack(rowHit.trackIndex);
        return;
      }
      const pickerHit = this.bounds.midiPortraitTrackPicker && this.pointInBounds(x, y, this.bounds.midiPortraitTrackPicker);
      if (pickerHit) {
        return;
      }
      if (!gridQuickHit) {
        this.closeMidiPortraitTrackPicker();
        return;
      }
    }
    if (gridQuickHit) {
      this.handleMidiPortraitGridQuickControl(gridQuickHit.id);
      return;
    }
    if (this.tempoSliderOpen && this.bounds.tempoSlider && this.pointInBounds(x, y, this.bounds.tempoSlider)) {
      this.dragState = { mode: 'slider', id: 'song-tempo', bounds: this.bounds.tempoSlider };
      this.updateSliderValue(x, y, 'song-tempo', this.bounds.tempoSlider);
      return;
    }

    const pedalOverlayOpen = this.pedalUiState.pickerOpen || this.pedalUiState.editorOpen;
    if (pedalOverlayOpen && (this.activeTab === 'instruments' || this.activeTab === 'pedals')) {
      if (this.handlePedalPointerDown(x, y)) return;
    } else if (this.pedalUiState.pickerOpen || this.pedalUiState.editorOpen) {
      this.pedalUiState.pickerOpen = false;
      this.pedalUiState.pickerSlot = null;
      this.pedalUiState.pickerScroll = 0;
      this.pedalUiState.editorOpen = false;
      this.pedalUiState.draftPedal = null;
    }

    const quickMixHit = this.bounds.instrumentSettingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
    if (quickMixHit) {
      this.handleTrackControl(quickMixHit, x, y);
      return;
    }

    const tabHit = this.bounds.tabs?.find((tab) => this.pointInBounds(x, y, tab));
    if (tabHit) {
      if (this.isMobileLayout()) {
        this.activateLeftRailTab(tabHit.id);
      } else {
        this.openMidiDesktopDropdown(tabHit.desktopRootId || tabHit.id);
      }
      this.closeSelectionMenu();
      this.pastePreview = null;
      this.noteLengthMenu.open = false;
      this.tempoSliderOpen = false;
      return;
    }

    if (!pedalOverlayOpen && (this.activeTab === 'instruments' || this.activeTab === 'pedals')) {
      if (this.handlePedalPointerDown(x, y)) return;
    }

    if (this.bounds.railInstruments && this.pointInBounds(x, y, this.bounds.railInstruments)) {
      this.activeTab = 'instruments';
      return;
    }
    if (this.bounds.railSettings && this.pointInBounds(x, y, this.bounds.railSettings)) {
      this.activeTab = 'settings';
      return;
    }
    if (this.bounds.railZoom && this.pointInBounds(x, y, this.bounds.railZoom)) {
      this.dragState = { mode: 'slider', id: 'grid-zoom-x', bounds: this.bounds.railZoom };
      this.updateSliderValue(x, y, 'grid-zoom-x', this.bounds.railZoom);
      return;
    }

    if (this.bounds.fileButton && this.pointInBounds(x, y, this.bounds.fileButton)) {
      if (this.activeTab === 'instruments' || this.instrumentPicker.mode) {
        this.confirmInstrumentSelection();
      }
      if (!this.isMobileLayout()) {
        this.openMidiDesktopDropdown('file');
        return;
      }
      if (this.activeTab === 'file') {
        this.closeFileMenu();
        return;
      }
      this.activeTab = 'file';
      this.toolsMenuOpen = false;
      this.genreMenuOpen = false;
      this.closeSelectionMenu();
      this.pastePreview = null;
      this.noteLengthMenu.open = false;
      this.tempoSliderOpen = false;
      return;
    }
    if (this.bounds.undoButton && this.pointInBounds(x, y, this.bounds.undoButton)) {
      this.runtime.undo();
      return;
    }
    if (this.bounds.redoButton && this.pointInBounds(x, y, this.bounds.redoButton)) {
      this.runtime.redo();
      return;
    }
    if (this.bounds.play && this.pointInBounds(x, y, this.bounds.play)) {
      this.startTransportHold(this.bounds.play, payload);
      return;
    }

    const portraitSheetBlocksInput = this.mobilePortraitMenuSheetBounds
      && shouldMidiPortraitSheetOpen(this.activeTab, this.controllerMenu.active);
    if (portraitSheetBlocksInput && !this.pointInBounds(x, y, this.mobilePortraitMenuSheetBounds)) {
      this.controllerMenu.resetFocus();
      if (!['grid', 'song'].includes(this.activeTab)) this.activeTab = 'grid';
      return;
    }

    if (this.activeTab === 'grid') {
      if (this.bounds.play && this.pointInBounds(x, y, this.bounds.play)) {
        this.startTransportHold(this.bounds.play, payload);
        return;
      }
      if (this.bounds.stop && this.pointInBounds(x, y, this.bounds.stop)) {
        this.stopPlayback();
        return;
      }
      if ((this.bounds.transportLoopToggle && this.pointInBounds(x, y, this.bounds.transportLoopToggle))
        || (this.bounds.loopToggle && this.pointInBounds(x, y, this.bounds.loopToggle))) {
        this.toggleLoopEnabled();
        return;
      }
      if (this.bounds.returnStart && this.pointInBounds(x, y, this.bounds.returnStart)) {
        this.returnToStart();
        return;
      }
      if (this.bounds.setStart && this.pointInBounds(x, y, this.bounds.setStart)) {
        this.setLoopStartTick(this.playheadTick);
        return;
      }
      if (this.bounds.setEnd && this.pointInBounds(x, y, this.bounds.setEnd)) {
        this.setLoopEndTick(this.playheadTick);
        return;
      }
      if (this.bounds.prevBar && this.pointInBounds(x, y, this.bounds.prevBar)) {
        this.jumpPlayheadBars(-1);
        return;
      }
      if (this.bounds.nextBar && this.pointInBounds(x, y, this.bounds.nextBar)) {
        this.jumpPlayheadBars(1);
        return;
      }
      if (this.bounds.goEnd && this.pointInBounds(x, y, this.bounds.goEnd)) {
        this.goToEnd();
        return;
      }
      if (this.bounds.metronome && this.pointInBounds(x, y, this.bounds.metronome)) {
        this.metronomeEnabled = !this.metronomeEnabled;
        return;
      }
      if (this.bounds.tempoButton && this.pointInBounds(x, y, this.bounds.tempoButton)) {
        this.tempoSliderOpen = !this.tempoSliderOpen;
        this.noteLengthMenu.open = false;
        return;
      }
      if (this.tempoSliderOpen) {
        this.tempoSliderOpen = false;
      }
      if (this.bounds.noteLength && this.pointInBounds(x, y, this.bounds.noteLength)) {
        if (isDrumTrack(this.getActiveTrack())) return;
        this.noteLengthMenu.open = !this.noteLengthMenu.open;
        this.noteLengthMenu.anchor = { ...this.bounds.noteLength };
        this.tempoSliderOpen = false;
        return;
      }
      if (this.noteLengthMenu.open) {
        this.noteLengthMenu.open = false;
      }
    }

    if (this.activeTab === 'instruments' || this.instrumentPicker.mode) {
      if (this.instrumentPicker.mode) {
        if (this.instrumentPicker.tabPrevBounds && this.pointInBounds(x, y, this.instrumentPicker.tabPrevBounds)) {
          this.shiftInstrumentPickerTab(-1);
          return;
        }
        if (this.instrumentPicker.tabNextBounds && this.pointInBounds(x, y, this.instrumentPicker.tabNextBounds)) {
          this.shiftInstrumentPickerTab(1);
          return;
        }
        const familyHit = this.instrumentPicker.tabBounds.find((bounds) => this.pointInBounds(x, y, bounds));
        if (familyHit) {
          if (payload.touchCount) {
            this.dragState = {
              mode: 'instrument-tab-swipe',
              startX: x,
              startY: y,
              tabId: familyHit.id,
              startTabScrollX: this.instrumentPicker.tabScrollX || 0,
              moved: false
            };
            return;
          }
          this.instrumentPicker.familyTab = familyHit.id;
          this.instrumentPicker.scroll = 0;
          return;
        }
        if (payload.touchCount
          && this.instrumentPicker.tabAreaBounds
          && this.pointInBounds(x, y, this.instrumentPicker.tabAreaBounds)) {
          this.dragState = {
            mode: 'instrument-tab-swipe',
            startX: x,
            startY: y,
            tabId: null,
            startTabScrollX: this.instrumentPicker.tabScrollX || 0,
            moved: false
          };
          return;
        }
        const favHit = this.instrumentPicker.favoriteBounds.find((bounds) => this.pointInBounds(x, y, bounds));
        if (favHit) {
          this.toggleFavoriteInstrument(favHit.program);
          return;
        }
        if (this.instrumentPicker.confirmBounds && this.pointInBounds(x, y, this.instrumentPicker.confirmBounds)) {
          if (Number.isInteger(this.instrumentPicker.selectedProgram) || this.instrumentPicker.familyTab === 'drum-kits') {
            this.applyInstrumentSelection(this.instrumentPicker.selectedProgram);
          }
          return;
        }
        if (this.instrumentPicker.cancelBounds && this.pointInBounds(x, y, this.instrumentPicker.cancelBounds)) {
          this.instrumentPicker.mode = null;
          this.instrumentPicker.selectedProgram = null;
          this.instrumentPicker.returnTab = null;
          return;
        }
        const pickHit = this.instrumentPicker.bounds.find((bounds) => this.pointInBounds(x, y, bounds));
        if (pickHit) {
          if (payload.touchCount) {
            this.dragState = {
              mode: 'instrument-scroll',
              startY: y,
              startScroll: this.instrumentPicker.scroll,
              startX: x,
              moved: false,
              pendingPick: { ...pickHit }
            };
            return;
          }
          this.selectInstrumentPickerItem(pickHit);
          return;
        }
        if (this.instrumentPicker.scrollUpBounds && this.pointInBounds(x, y, this.instrumentPicker.scrollUpBounds)) {
          this.instrumentPicker.scroll = clamp(
            this.instrumentPicker.scroll - Math.max(1, this.instrumentPicker.scrollStep),
            0,
            this.instrumentPicker.scrollMax
          );
          return;
        }
        if (this.instrumentPicker.scrollDownBounds && this.pointInBounds(x, y, this.instrumentPicker.scrollDownBounds)) {
          this.instrumentPicker.scroll = clamp(
            this.instrumentPicker.scroll + Math.max(1, this.instrumentPicker.scrollStep),
            0,
            this.instrumentPicker.scrollMax
          );
          return;
        }
        const pickerTrackHit = this.bounds.instrumentList?.find((bounds) => this.pointInBounds(x, y, bounds));
        if (pickerTrackHit) {
          this.selectedTrackIndex = pickerTrackHit.trackIndex;
          this.selection.clear();
          this.instrumentPicker.trackIndex = pickerTrackHit.trackIndex;
          const pickerTrack = this.song.tracks[pickerTrackHit.trackIndex];
          if (pickerTrack) {
            this.instrumentPicker.selectedProgram = pickerTrack.program ?? null;
            const tabs = this.getInstrumentPickerTabs();
            const preferredTab = isDrumTrack(pickerTrack)
              ? 'drum-kits'
              : this.getInstrumentCategory(pickerTrack.program);
            this.instrumentPicker.familyTab = tabs.some((tab) => tab.id === preferredTab)
              ? preferredTab
              : (tabs[0]?.id || this.instrumentPicker.familyTab || 'drums-perc');
            this.instrumentPicker.tabScrollX = Math.max(0, tabs.findIndex((tab) => tab.id === this.instrumentPicker.familyTab) * 96);
            const availableKits = this.game?.audio?.listAvailableDrumKits?.();
            const drumKits = Array.isArray(availableKits) && availableKits.length ? availableKits : GM_DRUM_KITS;
            const matchedKit = isDrumTrack(pickerTrack)
              ? drumKits.find((kit) => kit.program === pickerTrack.program && kit.bankMSB === pickerTrack.bankMSB && kit.bankLSB === pickerTrack.bankLSB)
              : null;
            if (matchedKit?.id) {
              this.instrumentPicker.drumKitId = matchedKit.id;
            }
            this.previewInstrument(pickerTrack.program, pickerTrack);
          }
          return;
        }
        if (this.instrumentPicker.sectionBounds.find((bounds) => this.pointInBounds(x, y, bounds))) {
          this.dragState = {
            mode: 'instrument-scroll',
            startY: y,
            startScroll: this.instrumentPicker.scroll
          };
        }
        return;
      }

      if (this.bounds.instrumentAdd && this.pointInBounds(x, y, this.bounds.instrumentAdd)) {
        this.openInstrumentPicker('add', this.selectedTrackIndex);
        return;
      }
      const settingHit = this.bounds.instrumentSettingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (settingHit) {
        this.handleTrackControl(settingHit, x, y);
        return;
      }
      const listHit = this.bounds.instrumentList?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (payload.touchCount && this.bounds.instrumentListScrollArea && this.pointInBounds(x, y, this.bounds.instrumentListScrollArea)) {
        this.dragState = {
          mode: 'instrument-list-scroll',
          startY: y,
          startScroll: this.instrumentListScroll,
          moved: false,
          pendingTrackHit: listHit ? { ...listHit } : null
        };
        return;
      }
      if (listHit) {
        this.selectedTrackIndex = listHit.trackIndex;
        this.selection.clear();
        const selectedTrack = this.song.tracks[listHit.trackIndex];
        if (selectedTrack) {
          this.previewInstrument(selectedTrack.program, selectedTrack);
        }
        return;
      }
      return;
    }

    if (this.activeTab === 'song') {
      if (this.handleSongBottomRailPointerDown(x, y)) {
        return;
      }
      if (this.songSplitTool.active) {
        const splitActionHit = this.songSplitTool.bounds?.splitAction && this.pointInBounds(x, y, this.songSplitTool.bounds.splitAction);
        if (splitActionHit) {
          this.applySongSplitTool();
          return;
        }
        const splitCancelHit = this.songSplitTool.bounds?.cancelAction && this.pointInBounds(x, y, this.songSplitTool.bounds.cancelAction);
        if (splitCancelHit) {
          this.songSplitTool.active = false;
          return;
        }
        const splitHandleHit = (this.songSplitTool.bounds?.handleTop && this.pointInBounds(x, y, this.songSplitTool.bounds.handleTop))
          || (this.songSplitTool.bounds?.handleBottom && this.pointInBounds(x, y, this.songSplitTool.bounds.handleBottom))
          || (this.songSplitTool.bounds?.lineGrab && this.pointInBounds(x, y, this.songSplitTool.bounds.lineGrab));
        if (splitHandleHit) {
          this.dragState = { mode: 'song-split-adjust' };
          return;
        }
      }
      if (this.songShiftTool.active) {
        const applyHit = this.songShiftTool.bounds?.apply && this.pointInBounds(x, y, this.songShiftTool.bounds.apply);
        if (applyHit) {
          this.applySongShiftTool();
          return;
        }
        const cancelHit = this.songShiftTool.bounds?.cancel && this.pointInBounds(x, y, this.songShiftTool.bounds.cancel);
        if (cancelHit) {
          this.songShiftTool.active = false;
          return;
        }
        const sliderHit = this.songShiftTool.bounds?.slider && this.pointInBounds(x, y, this.songShiftTool.bounds.slider);
        if (sliderHit) {
          this.dragState = { mode: 'song-shift-slider' };
          return;
        }
      }
      const menuHit = this.songSelectionMenu.open
        ? this.songSelectionMenu.bounds?.find((bounds) => this.pointInBounds(x, y, bounds))
        : null;
      if (menuHit) {
        this.handleSongAction(menuHit.action);
        return;
      }
      if (this.songSelectionMenu.open) {
        this.clearSongSelection();
      }
      if (this.songPlayheadBounds && this.pointInBounds(x, y, this.songPlayheadBounds)) {
        this.playheadTick = clamp(this.getSongTickFromX(x, this.songTimelineBounds), 0, this.getSongTimelineTicks());
        this.resyncPlaybackClock(this.playheadTick);
        this.dragState = { mode: 'song-playhead', bounds: this.songTimelineBounds };
        return;
      }
      if (this.bounds.loopStartHandle && this.pointInBounds(x, y, this.bounds.loopStartHandle)) {
        this.dragState = { mode: 'song-loop-start' };
        this.setLoopStartTick(this.getSongTickFromX(x, this.songTimelineBounds));
        return;
      }
      if (this.bounds.loopEndHandle && this.pointInBounds(x, y, this.bounds.loopEndHandle)) {
        this.dragState = { mode: 'song-loop-end' };
        this.setLoopEndTick(this.getSongTickFromX(x, this.songTimelineBounds));
        return;
      }
      if (this.bounds.songZoomOut && this.pointInBounds(x, y, this.bounds.songZoomOut)) {
        this.setHorizontalTimelineZoom(this.gridZoomX / 1.5);
        return;
      }
      if (this.bounds.songZoomIn && this.pointInBounds(x, y, this.bounds.songZoomIn)) {
        this.setHorizontalTimelineZoom(this.gridZoomX * 1.5);
        return;
      }
      if (this.songInstrumentBounds && this.pointInBounds(x, y, this.songInstrumentBounds)) {
        this.openInstrumentPicker('edit', this.selectedTrackIndex);
        return;
      }
      if (this.songAddBounds && this.pointInBounds(x, y, this.songAddBounds)) {
        this.addTrack();
        return;
      }
      if (this.bounds.songRemoveTrack && this.pointInBounds(x, y, this.bounds.songRemoveTrack)) {
        this.removeTrack();
        return;
      }
      const labelHit = this.songLabelBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      const laneTapHit = this.songLaneBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (labelHit) {
        this.selectedTrackIndex = labelHit.trackIndex;
        this.clearSongSelection();
        return;
      }
      const partHandleHit = this.songPartHandleBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (partHandleHit) {
        this.selectedTrackIndex = partHandleHit.trackIndex;
        const pattern = this.song.tracks[partHandleHit.trackIndex]?.patterns?.[this.selectedPatternIndex];
        const range = this.getPatternPartRange(pattern, partHandleHit.partIndex, this.getSongTimelineTicks());
        const clonePaintHandleDrag = this.songClonePaintTool.active
          && this.songClonePaintTool.trackIndex === partHandleHit.trackIndex
          && this.songClonePaintTool.baseStartTick === range.startTick
          && this.songClonePaintTool.baseEndTick === range.endTick;
        this.songSelection = {
          active: true,
          trackIndex: partHandleHit.trackIndex,
          trackStartIndex: partHandleHit.trackIndex,
          trackEndIndex: partHandleHit.trackIndex,
          startTick: range.startTick,
          endTick: range.endTick
        };
        this.dragState = {
          mode: 'song-part-resize',
          trackIndex: partHandleHit.trackIndex,
          partIndex: partHandleHit.partIndex,
          edge: clonePaintHandleDrag ? 'end' : partHandleHit.edge
        };
        return;
      }
      const partHit = this.songPartBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (partHit) {
        const tappedTick = clamp(this.getSongTickFromX(x, partHit), 0, this.getSongTimelineTicks());
        const clonePaintBodyDrag = this.songClonePaintTool.active
          && this.songClonePaintTool.trackIndex === partHit.trackIndex
          && this.songClonePaintTool.baseStartTick === partHit.startTick
          && this.songClonePaintTool.baseEndTick === partHit.endTick;
        this.selectedTrackIndex = partHit.trackIndex;
        this.playheadTick = tappedTick;
        this.resyncPlaybackClock(this.playheadTick);
        this.songSelection = {
          active: true,
          trackIndex: partHit.trackIndex,
          trackStartIndex: partHit.trackIndex,
          trackEndIndex: partHit.trackIndex,
          startTick: partHit.startTick,
          endTick: partHit.endTick
        };
        this.dragState = clonePaintBodyDrag
          ? {
            mode: 'song-part-resize',
            trackIndex: partHit.trackIndex,
            partIndex: partHit.partIndex,
            edge: 'end'
          }
          : {
            mode: 'song-part-move',
            startX: x,
            startY: y,
            sourceTrackIndex: partHit.trackIndex,
            partIndex: partHit.partIndex,
            offsetTick: this.getSongTickFromX(x, partHit) - partHit.startTick,
            targetTrackIndex: partHit.trackIndex,
            targetStartTick: partHit.startTick,
            moved: false
          };
        return;
      }
      const automationHit = this.songAutomationBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (automationHit) {
        const track = this.song.tracks[automationHit.trackIndex];
        const tick = this.getSongTickFromX(x, automationHit);
        const ratio = clamp((automationHit.y + automationHit.h - y) / automationHit.h, 0, 1);
        const minValue = automationHit.type === 'pan' ? -1 : 0;
        const maxValue = automationHit.type === 'pan' ? 1 : 1;
        const value = minValue + ratio * (maxValue - minValue);
        this.selectedTrackIndex = automationHit.trackIndex;
        this.addSongAutomationKeyframe(track, automationHit.type, tick, value);
        return;
      }

      if (payload.touchCount
        && this.bounds.songTrackScrollArea
        && this.pointInBounds(x, y, this.bounds.songTrackScrollArea)
        && !labelHit
        && !laneTapHit) {
        this.dragState = {
          mode: 'song-track-scroll',
          startY: y,
          startScroll: this.songTrackScroll,
          moved: false,
          pendingTrackHit: laneTapHit ? { ...laneTapHit } : null
        };
        return;
      }
      const laneHit = this.songLaneBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (laneHit) {
        this.selectedTrackIndex = laneHit.trackIndex;
        const modifiers = this.getModifiers();
        const isTouch = payload.touchCount > 0;
        const tick = this.getSongTickFromX(x, laneHit);
        const selectionRange = this.getSongSelectionRange();
        const inSelection = this.isSongSelectionHit(tick, laneHit.trackIndex);
        if (inSelection && isTouch) {
          const track = this.song.tracks[laneHit.trackIndex];
          const pattern = track?.patterns?.[this.selectedPatternIndex];
          if (!pattern) return;
          const selectionNotesByTrack = selectionRange?.trackIndices?.map((trackIndex) => {
            const sourceTrack = this.song.tracks[trackIndex];
            const sourcePattern = sourceTrack?.patterns?.[this.selectedPatternIndex];
            return {
              trackIndex,
              notes: this.getSongNotesOverlapping(sourcePattern, selectionRange)
            };
          }).filter((entry) => entry.notes?.length) || [];
          this.songSelectionMenu.open = false;
          this.songSelectionMenu.bounds = [];
          this.dragState = {
            mode: 'song-move-pending',
            startX: x,
            startY: y,
            startOffsetX: this.songTimelineOffsetX,
            offsetTick: tick - selectionRange.startTick,
            originalRange: selectionRange,
            targetTrackIndex: selectionRange.trackStartIndex,
            targetStartTick: selectionRange.startTick,
            originalNotesByTrack: selectionNotesByTrack,
            grabTrackOffset: laneHit.trackIndex - selectionRange.trackStartIndex,
            moved: false
          };
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
          }
          this.longPressTimer = window.setTimeout(() => {
            if (navigator?.vibrate) {
              navigator.vibrate(20);
            }
            this.dragState = {
              ...this.dragState,
              mode: 'song-move',
              startX: this.lastPointer.x,
              startY: this.lastPointer.y
            };
            this.longPressTimer = null;
          }, 450);
          return;
        }
        if (isTouch) {
          this.clearSongSelection();
          this.dragState = {
            mode: 'song-pan-or-select',
            startX: x,
            startY: y,
            startOffsetX: this.songTimelineOffsetX,
            startScroll: this.songTrackScroll,
            bounds: laneHit,
            trackIndex: laneHit.trackIndex,
            startTick: tick,
            moved: false
          };
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
          }
          this.longPressTimer = window.setTimeout(() => {
            this.songSelection = {
              active: true,
              trackIndex: laneHit.trackIndex,
              trackStartIndex: laneHit.trackIndex,
              trackEndIndex: laneHit.trackIndex,
              startTick: tick,
              endTick: tick
            };
            this.dragState = {
              mode: 'song-select',
              bounds: laneHit,
              startX: this.lastPointer.x,
              startY: this.lastPointer.y,
              startTick: tick,
              trackIndex: laneHit.trackIndex
            };
            this.longPressTimer = null;
          }, 450);
          return;
        }
        this.clearSongSelection();
        const wantsSelection = modifiers.shift;
        if (wantsSelection) {
          this.dragState = {
            mode: 'song-select-pending',
            bounds: laneHit,
            startX: x,
            startY: y,
            startTick: tick,
            trackIndex: laneHit.trackIndex
          };
          return;
        }
        this.dragState = {
          mode: 'song-pan',
          startX: x,
          startOffsetX: this.songTimelineOffsetX,
          trackIndex: laneHit.trackIndex,
          moved: false
        };
        return;
      }
      if (this.songRulerBounds && this.pointInBounds(x, y, this.songRulerBounds)) {
        const tick = this.getSongTickFromX(x, this.songTimelineBounds);
        if (this.handleSongRulerTap(tick)) {
          this.clearSongSelection();
          this.dragState = null;
          return;
        }
        this.playheadTick = clamp(tick, 0, this.getSongTimelineTicks());
        this.resyncPlaybackClock(this.playheadTick);
        this.clearSongSelection();
        this.dragState = {
          mode: 'song-scrub',
          bounds: this.songTimelineBounds
        };
        return;
      }
      if (this.songTimelineBounds && this.pointInBounds(x, y, this.songTimelineBounds)) {
        this.clearSongSelection();
        this.dragState = {
          mode: 'song-pan',
          startX: x,
          startOffsetX: this.songTimelineOffsetX
        };
      }
      return;
    }

    if (this.activeTab === 'settings') {
      const controlHit = this.bounds.settingsControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (controlHit) {
        this.handleSettingsControl(controlHit, { x, y });
        return;
      }
      const controllerHit = this.bounds.controllerControls?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (controllerHit) {
        const options = GAMEPAD_BUTTONS.map((entry) => entry.id);
        const current = this.controllerMapping[controllerHit.actionId] || options[0];
        const nextIndex = (options.indexOf(current) + 1) % options.length;
        this.controllerMapping[controllerHit.actionId] = options[nextIndex];
        this.saveControllerMapping();
        return;
      }
      const trackControlHit = this.trackControlBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (trackControlHit) {
        this.handleTrackControl(trackControlHit, x, y);
        return;
      }
      const trackHit = this.trackBounds.find((bounds) => this.pointInBounds(x, y, bounds));
      if (trackHit) {
        this.selectedTrackIndex = trackHit.index;
        this.selection.clear();
        return;
      }
      if (this.bounds.settingsPanel && this.pointInBounds(x, y, this.bounds.settingsPanel)) {
        this.dragState = {
          mode: 'settings-scroll',
          startY: y,
          startScroll: this.settingsScroll
        };
      }
      return;
    }

    if (this.activeTab === 'grid') {
      if (this.bounds.pasteAction && this.pointInBounds(x, y, this.bounds.pasteAction)) {
        this.applyPastePreview();
        return;
      }
      const labelHit = this.noteLabelBounds?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (labelHit) {
        this.auditionPitch(labelHit.pitch);
        return;
      }
      const menuHit = this.bounds.selectionMenu?.find((bounds) => this.pointInBounds(x, y, bounds));
      if (menuHit) {
        this.handleSelectionMenuAction(menuHit.action);
        return;
      }
      if (this.selectionMenu.open) {
        this.closeSelectionMenu();
      }
      if (this.bounds.instrumentPrev && this.pointInBounds(x, y, this.bounds.instrumentPrev)) {
        this.selectTrackDelta(-1);
        return;
      }
      if (this.bounds.instrumentNext && this.pointInBounds(x, y, this.bounds.instrumentNext)) {
        this.selectTrackDelta(1);
        return;
      }
      if (this.bounds.instrumentLabel && this.pointInBounds(x, y, this.bounds.instrumentLabel)) {
        this.openInstrumentPicker('edit', this.selectedTrackIndex);
        return;
      }
      if (this.bounds.chordMode && this.pointInBounds(x, y, this.bounds.chordMode)) {
        if (isDrumTrack(this.getActiveTrack())) return;
        this.setChordMode(!this.chordMode);
        return;
      }
      if (this.bounds.chordEdit && this.pointInBounds(x, y, this.bounds.chordEdit)) {
        if (isDrumTrack(this.getActiveTrack())) return;
        this.promptChordProgression();
        return;
      }
      if (this.bounds.barsMinus && this.pointInBounds(x, y, this.bounds.barsMinus)) {
        this.adjustLoopBars(-1);
        return;
      }
      if (this.bounds.barsPlus && this.pointInBounds(x, y, this.bounds.barsPlus)) {
        this.adjustLoopBars(1);
        return;
      }
      if (this.bounds.zoomOutX && this.pointInBounds(x, y, this.bounds.zoomOutX)) {
        this.setHorizontalTimelineZoom(this.gridZoomX / 1.5);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.zoomInX && this.pointInBounds(x, y, this.bounds.zoomInX)) {
        this.setHorizontalTimelineZoom(this.gridZoomX * 1.5);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.zoomOutY && this.pointInBounds(x, y, this.bounds.zoomOutY)) {
        const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridBounds?.rows || 1);
        this.gridZoomY = clamp(this.gridZoomY / 1.5, minZoom, maxZoom);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.zoomInY && this.pointInBounds(x, y, this.bounds.zoomInY)) {
        const { minZoom, maxZoom } = this.getGridZoomLimits(this.gridBounds?.rows || 1);
        this.gridZoomY = clamp(this.gridZoomY * 1.5, minZoom, maxZoom);
        this.suppressNextGridTap = true;
        return;
      }
      if (this.bounds.loopStartHandle && this.pointInBounds(x, y, this.bounds.loopStartHandle)) {
        this.dragState = { mode: 'loop-start' };
        this.setLoopStartTick(this.getTickFromX(x));
        return;
      }
      if (this.bounds.loopEndHandle && this.pointInBounds(x, y, this.bounds.loopEndHandle)) {
        this.dragState = { mode: 'loop-end' };
        this.setLoopEndTick(this.getTickFromX(x));
        return;
      }
      if (this.rulerBounds && this.pointInBounds(x, y, this.rulerBounds)) {
        const modifiers = this.getModifiers();
        const tick = this.getTickFromX(x);
        if (this.isNearLoopMarker(x, 'start')) {
          this.dragState = { mode: 'loop-start' };
          this.setLoopStartTick(tick);
          return;
        }
        if (this.isNearLoopMarker(x, 'end')) {
          this.dragState = { mode: 'loop-end' };
          this.setLoopEndTick(tick);
          return;
        }
        if (this.placingStartMarker) {
          this.setLoopStartTick(tick);
          this.placingStartMarker = false;
          return;
        }
        if (this.placingEndMarker || modifiers.shift) {
          this.setLoopEndTick(tick);
          this.placingEndMarker = false;
          return;
        }
        if (modifiers.alt || payload.button === 2) {
          this.clearLoopEndTick();
          this.clearLoopStartTick();
          return;
        }
        if (payload.touchCount) {
          this.longPressTimer = window.setTimeout(() => {
            this.setLoopStartTick(tick);
            this.longPressTimer = null;
          }, 450);
        }
        this.playheadTick = clamp(tick, 0, this.getEditableGridTick());
        this.resyncPlaybackClock(this.playheadTick);
        if (this.scrubAudition) {
          this.previewNotesAtTick(this.playheadTick);
        }
        this.dragState = { mode: 'scrub' };
        return;
      }
      if (this.gridBounds && this.pointInBounds(x, y, this.gridBounds)) {
        this.handleGridPointerDown(payload);
      }
    }
  }

  handlePointerMove(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    this.pendingDesktopDropdownHit = updatePendingDesktopDropdownHit(this.pendingDesktopDropdownHit, payload);
    if (this.transportHold && Math.hypot(payload.x - this.transportHold.x, payload.y - this.transportHold.y) > 12) {
      this.cancelTransportHold();
    }
    if (!this.isMobileLayout() && !payload.touchCount && !this.dragState) {
      this.handleDesktopTopMenuHover(payload.x, payload.y);
    }
    if (this.recordModeActive) {
      if (this.dragState?.mode === 'pedal-picker-scroll') {
        const dy = this.dragState.startY - payload.y;
        if (!this.dragState.moved && Math.abs(dy) > 6) this.dragState.moved = true;
        if (this.dragState.moved) {
          this.pedalUiState.pickerScroll = clamp(this.dragState.startScroll + dy, 0, this.pedalUiState.pickerScrollMax || 0);
        }
        return;
      }
      if (this.dragState?.mode === 'pedal-knob-turn') {
        const bounds = this.dragState.bounds;
        const delta = (this.dragState.startY - payload.y) / 120;
        const min = Number.isFinite(bounds?.min) ? bounds.min : 0;
        const max = Number.isFinite(bounds?.max) ? bounds.max : 1;
        const next = clamp(this.dragState.startValue + delta * (max - min), min, max);
        this.updateSelectedPedalKnob(bounds.knobKey, next);
        return;
      }
      this.recordLayout.handlePointerMove(payload);
      return;
    }

    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id || this.panJoystick.id === 'touch')) {
      this.updatePanJoystick(payload.x, payload.y);
      return;
    }
    if (this.qaOverlayOpen) return;
    if (this.dragState?.mode === 'mobile-landscape-root-scroll') {
      this.dragState = {
        ...resolveMenuScrollDrag(this.dragState, payload),
        mode: 'mobile-landscape-root-scroll',
        pendingRootId: this.dragState.pendingRootId
      };
      if (this.dragState.moved) this.controllerMenu.scroll.root = this.dragState.nextScroll;
      return;
    }
    if (this.dragState?.mode === 'gamepad-submenu-scroll') {
      this.dragState = {
        ...resolveMenuScrollDrag(this.dragState, payload),
        mode: 'gamepad-submenu-scroll'
      };
      if (this.dragState.moved) this.controllerMenu.scroll[this.dragState.menuId] = this.dragState.nextScroll;
      return;
    }
    if (this.dragState?.mode === 'song-track-scroll') {
      const delta = this.dragState.startY - payload.y;
      if (!this.dragState.moved && Math.abs(delta) > 6) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.songTrackScroll = clamp(this.dragState.startScroll + delta, 0, this.songTrackScrollMax);
      }
      return;
    }
    if (this.dragState?.mode === 'instrument-list-scroll') {
      const delta = this.dragState.startY - payload.y;
      if (!this.dragState.moved && Math.abs(delta) > 6) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.instrumentListScroll = clamp(this.dragState.startScroll + delta, 0, this.instrumentListScrollMax);
      }
      return;
    }
    if (this.dragState?.mode === 'midi-portrait-track-picker-scroll') {
      const delta = this.dragState.startY - payload.y;
      if (!this.dragState.moved && Math.abs(delta) > 6) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.midiPortraitTrackPickerScroll = clamp(this.dragState.startScroll + delta, 0, this.midiPortraitTrackPickerScrollMax);
      }
      return;
    }
    if (this.dragState?.mode === 'song-pan-or-select') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        this.dragState.mode = Math.abs(dy) > Math.abs(dx) ? 'song-track-scroll' : 'song-pan';
      }
      if (this.dragState.mode === 'song-track-scroll') {
        const delta = this.dragState.startY - payload.y;
        this.songTrackScroll = clamp((this.dragState.startScroll ?? 0) + delta, 0, this.songTrackScrollMax);
        return;
      }
      if (this.dragState.mode === 'song-pan' && this.songTimelineBounds) {
        const nextOffset = this.dragState.startOffsetX + dx;
        this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
        this.songTimelineOffsetX = this.clampTimelineOffsetX(
          nextOffset,
          this.songTimelineBounds.w,
          this.songTimelineBounds.cellWidth
        );
        this.updateTimelineStartTickFromSong();
        this.ensureTimelineCapacity();
      }
      return;
    }
    if (this.dragState?.mode === 'song-move-pending') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        this.dragState.mode = 'song-pan';
        if (this.songTimelineBounds) {
          const nextOffset = this.dragState.startOffsetX + dx;
          this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
          this.songTimelineOffsetX = this.clampTimelineOffsetX(
            nextOffset,
            this.songTimelineBounds.w,
            this.songTimelineBounds.cellWidth
          );
          this.updateTimelineStartTickFromSong();
          this.ensureTimelineCapacity();
        }
      }
      return;
    }
    if (this.dragState?.mode === 'song-move') {
      const laneHit = this.getSongLaneAt(payload.x, payload.y) || this.songLaneBounds?.[this.dragState.targetTrackIndex];
      if (laneHit) {
        const tick = this.getSongTickFromX(payload.x, laneHit);
        const duration = this.dragState.originalRange.durationTicks;
        const totalTicks = this.getSongTimelineTicks();
        const nextStartTick = clamp(tick - this.dragState.offsetTick, 0, Math.max(0, totalTicks - duration));
        const trackCount = this.dragState.originalRange.trackCount || 1;
        const maxStartTrack = Math.max(0, this.song.tracks.length - trackCount);
        const nextStartTrackIndex = clamp(
          laneHit.trackIndex - (this.dragState.grabTrackOffset ?? 0),
          0,
          maxStartTrack
        );
        this.dragState.targetTrackIndex = nextStartTrackIndex;
        this.dragState.targetStartTick = nextStartTick;
        this.dragState.moved = true;
        this.songSelection = {
          active: true,
          trackIndex: nextStartTrackIndex,
          trackStartIndex: nextStartTrackIndex,
          trackEndIndex: nextStartTrackIndex + trackCount - 1,
          startTick: nextStartTick,
          endTick: nextStartTick + duration
        };
      }
      return;
    }
    if (this.dragState?.mode === 'song-part-move') {
      const laneHit = this.getSongLaneAt(payload.x, payload.y) || this.songLaneBounds?.[this.dragState.targetTrackIndex];
      if (laneHit) {
        const dx = payload.x - (this.dragState.startX ?? payload.x);
        const dy = payload.y - (this.dragState.startY ?? payload.y);
        const pointerMoved = Math.abs(dx) > 6 || Math.abs(dy) > 6;
        if (!pointerMoved && !this.dragState.moved) {
          return;
        }
        const pattern = this.song.tracks[this.dragState.sourceTrackIndex]?.patterns?.[this.selectedPatternIndex];
        const range = this.getPatternPartRange(pattern, this.dragState.partIndex, this.getSongTimelineTicks());
        const duration = range.endTick - range.startTick;
        const tick = this.getSongTickFromX(payload.x, laneHit);
        const nextTrackIndex = laneHit.trackIndex;
        const nextStartTick = clamp(tick - this.dragState.offsetTick, 0, Math.max(0, this.getSongTimelineTicks() - duration));
        this.dragState.targetTrackIndex = nextTrackIndex;
        this.dragState.targetStartTick = nextStartTick;
        this.dragState.moved = nextTrackIndex !== this.dragState.sourceTrackIndex || nextStartTick !== range.startTick;
        this.songSelection = {
          active: true,
          trackIndex: nextTrackIndex,
          trackStartIndex: nextTrackIndex,
          trackEndIndex: nextTrackIndex,
          startTick: nextStartTick,
          endTick: nextStartTick + duration
        };
      }
      return;
    }
    if (this.dragState?.mode === 'song-part-resize') {
      const lane = this.songLaneBounds?.find((b) => b.trackIndex === this.dragState.trackIndex);
      if (lane) {
        const tick = this.getSongTickFromX(payload.x, lane);
        this.resizeSongPartEdge(this.dragState.trackIndex, this.dragState.partIndex, this.dragState.edge, tick);
      }
      return;
    }
    if (this.dragState?.mode === 'song-split-adjust') {
      const range = this.getSongSelectionRange();
      if (range && this.songTimelineBounds) {
        this.songSplitTool.tick = clamp(
          this.getSongTickFromX(payload.x, this.songTimelineBounds),
          range.startTick + 1,
          range.endTick - 1
        );
      }
      return;
    }
    if (this.dragState?.mode === 'song-shift-slider') {
      const slider = this.songShiftTool.bounds?.slider;
      if (slider) {
        const ratio = clamp((slider.y + slider.h - payload.y) / slider.h, 0, 1);
        this.songShiftTool.semitones = Math.round(-12 + ratio * 24);
      }
      return;
    }
    if (this.dragState?.mode === 'song-scrub') {
      const bounds = this.dragState.bounds || this.songTimelineBounds;
      if (bounds) {
        const tick = this.getSongTickFromX(payload.x, bounds);
        this.playheadTick = clamp(tick, 0, this.getSongTimelineTicks());
        this.resyncPlaybackClock(this.playheadTick);
      }
      return;
    }
    if (this.dragState?.mode === 'song-loop-start') {
      if (this.songTimelineBounds) {
        this.setLoopStartTick(this.getSongTickFromX(payload.x, this.songTimelineBounds));
      }
      return;
    }
    if (this.dragState?.mode === 'song-loop-end') {
      if (this.songTimelineBounds) {
        this.setLoopEndTick(this.getSongTickFromX(payload.x, this.songTimelineBounds));
      }
      return;
    }
    if (this.dragState?.mode === 'song-pan') {
      const dx = payload.x - this.dragState.startX;
      const threshold = 6;
      if (!this.dragState.moved && Math.abs(dx) > threshold) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved && this.songTimelineBounds) {
        const nextOffset = this.dragState.startOffsetX + dx;
        this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
        this.songTimelineOffsetX = this.clampTimelineOffsetX(
          nextOffset,
          this.songTimelineBounds.w,
          this.songTimelineBounds.cellWidth
        );
        this.updateTimelineStartTickFromSong();
        this.ensureTimelineCapacity();
      }
      return;
    }
    if (this.dragState?.mode === 'song-select-pending' || this.dragState?.mode === 'song-select') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (this.dragState.mode === 'song-select-pending' && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.mode = 'song-select';
        this.songSelection = {
          active: true,
          trackIndex: this.dragState.trackIndex,
          trackStartIndex: this.dragState.trackIndex,
          trackEndIndex: this.dragState.trackIndex,
          startTick: this.dragState.startTick,
          endTick: this.dragState.startTick
        };
      }
      if (this.dragState.mode === 'song-select' && this.dragState.bounds) {
        const tick = this.getSongTickFromX(payload.x, this.dragState.bounds);
        this.songSelection.endTick = tick;
        const laneHit = this.getSongLaneAt(payload.x, payload.y);
        if (laneHit) {
          this.songSelection.trackEndIndex = laneHit.trackIndex;
        }
      }
      return;
    }
    if (this.dragState?.mode === 'song-playhead') {
      const bounds = this.dragState.bounds || this.songTimelineBounds;
      if (bounds) {
        const tick = this.getSongTickFromX(payload.x, bounds);
        this.playheadTick = clamp(tick, 0, this.getSongTimelineTicks());
        this.resyncPlaybackClock(this.playheadTick);
      }
      return;
    }
    if (this.dragState?.mode === 'instrument-tab-swipe') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      if (!this.dragState.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        const maxScroll = Math.max(0, Number(this.instrumentPicker.tabScrollMax) || 0);
        this.instrumentPicker.tabScrollX = clamp(
          (Number(this.dragState.startTabScrollX) || 0) - dx,
          0,
          maxScroll
        );
      }
      return;
    }
    if (this.dragState?.mode === 'instrument-scroll') {
      const delta = this.dragState.startY - payload.y;
      if (!this.dragState.moved && Math.abs(delta) > 6) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.instrumentPicker.scroll = clamp(this.dragState.startScroll + delta, 0, this.instrumentPicker.scrollMax);
      }
      return;
    }
    if (this.dragState?.mode === 'settings-scroll') {
      const delta = this.dragState.startY - payload.y;
      this.settingsScroll = clamp(this.dragState.startScroll + delta, 0, this.settingsScrollMax);
      return;
    }
    if (this.dragState?.mode === 'file-menu-scroll') {
      const dy = this.dragState.startY - payload.y;
      if (Math.abs(dy) > 8) this.dragState.moved = true;
      if (this.dragState.moved) {
        this.fileMenuScroll = clamp(this.dragState.startScroll + Math.round(dy / 24), 0, this.fileMenuScrollMax);
      }
      return;
    }
    if (this.dragState?.mode === 'file-menu-tap') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this.dragState.moved = true;
      }
      return;
    }
    if (this.dragState?.mode === 'slider') {
      this.updateSliderValue(payload.x, payload.y, this.dragState.id, this.dragState.bounds);
      return;
    }
    if (this.dragState?.mode === 'pedal-picker-scroll') {
      const dy = this.dragState.startY - payload.y;
      if (!this.dragState.moved && Math.abs(dy) > 6) this.dragState.moved = true;
      if (this.dragState.moved) {
        this.pedalUiState.pickerScroll = clamp(this.dragState.startScroll + dy, 0, this.pedalUiState.pickerScrollMax || 0);
      }
      return;
    }
    if (this.dragState?.mode === 'pedal-knob-turn') {
      const bounds = this.dragState.bounds;
      const delta = (this.dragState.startY - payload.y) / 120;
      const min = Number.isFinite(bounds?.min) ? bounds.min : 0;
      const max = Number.isFinite(bounds?.max) ? bounds.max : 1;
      const next = clamp(this.dragState.startValue + delta * (max - min), min, max);
      this.updateSelectedPedalKnob(bounds.knobKey, next);
      return;
    }
    if (this.draggingTrackControl) {
      this.updateTrackControl(payload.x, payload.y);
      return;
    }
    if (!this.dragState || !this.gridBounds) return;
    if (this.dragState.mode === 'touch-pan' || this.dragState.mode === 'pan') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
      if (this.dragState.moved) {
        this.gridOffset.x = this.dragState.startOffsetX + dx;
        this.gridOffset.y = this.dragState.startOffsetY + dy;
        this.ensureGridPanCapacity(this.gridOffset.x);
        const { gridH, w, h } = this.gridBounds;
        const gridW = this.getExpandedGridWidth();
        this.clampGridOffset(w, h, gridW, gridH);
        this.updateTimelineStartTickFromGrid();
      }
      return;
    }
    if (this.dragState.mode === 'scrub') {
      const tick = this.getTickFromX(payload.x);
      this.playheadTick = clamp(tick, 0, this.getEditableGridTick());
      this.resyncPlaybackClock(this.playheadTick);
      if (this.scrubAudition) {
        this.previewNotesAtTick(this.playheadTick);
      }
      return;
    }
    if (this.dragState.mode === 'loop-start') {
      this.setLoopStartTick(this.getTickFromX(payload.x));
      return;
    }
    if (this.dragState.mode === 'loop-end') {
      this.setLoopEndTick(this.getTickFromX(payload.x));
      return;
    }
    if (!this.pointInBounds(payload.x, payload.y, this.gridBounds)) return;
    const cell = this.getGridCell(payload.x, payload.y);
    if (!cell) return;
    if (this.dragState.mode === 'paint') {
      this.paintNoteAt(cell.tick, cell.pitch, true);
    } else if (this.dragState.mode === 'pan-or-tap') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
        this.cancelLongPressTimer();
      }
      if (this.dragState.moved) {
        this.gridOffset.x = this.dragState.startOffsetX + dx;
        this.gridOffset.y = this.dragState.startOffsetY + dy;
        this.ensureGridPanCapacity(this.gridOffset.x);
        const { gridH, w, h } = this.gridBounds;
        const gridW = this.getExpandedGridWidth();
        this.clampGridOffset(w, h, gridW, gridH);
        this.updateTimelineStartTickFromGrid();
      }
    } else if (this.dragState.mode === 'paste-preview') {
      this.updatePastePreviewPosition(cell.tick, cell.pitch);
    } else if (this.dragState.mode === 'move') {
      const dx = payload.x - this.dragState.startX;
      const dy = payload.y - this.dragState.startY;
      const threshold = 6;
      if (!this.dragState.moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        this.dragState.moved = true;
      }
      if (this.dragState.moved) {
        this.moveSelectionTo(cell.tick, cell.pitch);
      }
    } else if (this.dragState.mode === 'resize') {
      this.resizeSelectionTo(cell.tick);
    } else if (this.dragState.mode === 'select') {
      this.updateSelectionBox(payload.x, payload.y);
    }
  }

  handleDesktopTopMenuHover(x, y) {
    const rootHit = resolveDesktopDropdownHoverSwitch({
      buttons: this.getDesktopRootButtons(),
      point: { x, y },
      openRootId: this.openDesktopDropdownRootId,
      rootIdKey: 'desktopRootId'
    });
    const nextTab = rootHit?.rootId || null;
    if (!nextTab) return false;
    this.openMidiDesktopDropdown(nextTab);
    return true;
  }

  handlePointerUp(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    const x = payload.x;
    const y = payload.y;
    if (this.transportHold) {
      const hold = this.transportHold;
      this.cancelTransportHold();
      if (!hold.fired) this.togglePlayback();
      return;
    }
    if (this.recordModeActive) {
      this.cancelLongPressTimer();
      if (this.dragState?.mode === 'pedal-picker-scroll') {
        if (!this.dragState.moved && this.dragState.pendingPick) {
          this.insertPedalIntoSlot(this.pedalUiState.pickerSlot ?? 0, this.dragState.pendingPick.pedalType);
        }
        this.dragState = null;
        return;
      }
      if (this.dragState?.mode === 'pedal-knob-turn') {
        this.dragState = null;
        return;
      }
      this.recordLayout.handlePointerUp(payload);
      return;
    }

    if (this.panJoystick.active && (payload.id === undefined || this.panJoystick.id === payload.id || this.panJoystick.id === 'touch')) {
      this.panJoystick.active = false;
      this.panJoystick.id = null;
      this.panJoystick.dx = 0;
      this.panJoystick.dy = 0;
      return;
    }
    this.cancelLongPressTimer();
    if (this.suppressNextGridTap) {
      this.suppressNextGridTap = false;
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'mobile-landscape-root-scroll') {
      const pendingRootId = this.dragState.pendingRootId;
      const wasMoved = this.dragState.moved;
      this.dragState = null;
      if (!wasMoved && pendingRootId) {
        this.handleMobileLandscapeRootMenuTap(pendingRootId);
      }
      return;
    }
    if (this.dragState?.mode === 'gamepad-submenu-scroll') {
      const pendingItem = this.dragState.pendingHit;
      const wasMoved = this.dragState.moved;
      this.dragState = null;
      if (!wasMoved && typeof pendingItem?.onSelect === 'function') pendingItem.onSelect(this);
      return;
    }
    if (this.dragState?.mode === 'touch-pan' || this.dragState?.mode === 'pan') {
      const shouldToggle = !this.dragState.moved && this.dragState.mode === 'touch-pan' && this.dragState.cell;
      const cell = this.dragState.cell;
      const moved = this.dragState.moved;
      this.dragState = null;
      if (shouldToggle) {
        this.selection.clear();
        this.toggleNoteAt(cell.tick, cell.pitch);
      }
      if (moved) this.persistViewportState();
      return;
    }
    if (this.dragState?.mode === 'song-track-scroll') {
      if (!this.dragState.moved && this.dragState.pendingTrackHit && Number.isInteger(this.dragState.pendingTrackHit.trackIndex)) {
        this.selectTrackIndex(this.dragState.pendingTrackHit.trackIndex, { restoreViewport: false });
      } else if (this.dragState.moved) {
        this.persistViewportState();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'instrument-list-scroll') {
      if (!this.dragState.moved && this.dragState.pendingTrackHit) {
        const trackIndex = this.dragState.pendingTrackHit.trackIndex;
        this.selectedTrackIndex = trackIndex;
        this.selection.clear();
        const selectedTrack = this.song.tracks[trackIndex];
        if (selectedTrack) {
          this.previewInstrument(selectedTrack.program, selectedTrack);
        }
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'midi-portrait-track-picker-scroll') {
      if (!this.dragState.moved && this.dragState.pendingTrackHit) {
        this.selectMidiPortraitTrack(this.dragState.pendingTrackHit.trackIndex);
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-pan-or-select') {
      if (!this.dragState.moved && Number.isInteger(this.dragState.trackIndex)) {
        this.selectTrackIndex(this.dragState.trackIndex, { restoreViewport: false });
      } else if (this.dragState.moved) {
        this.persistViewportState();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-move-pending') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'instrument-tab-swipe') {
      if (!this.dragState.moved && this.dragState.tabId) {
        this.instrumentPicker.familyTab = this.dragState.tabId;
        this.instrumentPicker.scroll = 0;
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'instrument-scroll'
      || this.dragState?.mode === 'settings-scroll'
      || this.dragState?.mode === 'slider'
      || this.dragState?.mode === 'pedal-knob-turn'
      || this.dragState?.mode === 'pedal-picker-scroll') {
      if (this.dragState?.mode === 'instrument-scroll' && !this.dragState.moved && this.dragState.pendingPick) {
        this.selectInstrumentPickerItem(this.dragState.pendingPick);
      }
      if (this.dragState?.mode === 'slider' || (this.dragState?.mode === 'pedal-knob-turn' && !this.pedalUiState.editorOpen)) {
        this.commitHistorySnapshot();
      }
      if (this.dragState?.mode === 'slider' && (this.dragState.id === 'grid-zoom-x' || this.dragState.id === 'song-zoom-x')) {
        this.persistViewportState();
      }
      if (this.dragState?.mode === 'pedal-picker-scroll' && !this.dragState.moved && this.dragState.pendingPick) {
        this.insertPedalIntoSlot(this.pedalUiState.pickerSlot ?? 0, this.dragState.pendingPick.pedalType);
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'file-menu-scroll') {
      const target = this.dragState.target;
      const wasMoved = this.dragState.moved;
      this.dragState = null;
      if (!wasMoved && target) this.handleFileMenu(target);
      return;
    }
    if (this.dragState?.mode === 'file-menu-tap') {
      const target = this.dragState.target;
      const wasMoved = this.dragState.moved;
      this.dragState = null;
      if (wasMoved) return;
      if (target) {
        this.handleFileMenu(target);
      }
      return;
    }
    if (this.dragState?.mode === 'song-select') {
      this.finalizeSongSelection();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-select-pending') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-pan') {
      if (!this.dragState.moved && Number.isInteger(this.dragState.trackIndex)) {
        this.selectTrackIndex(this.dragState.trackIndex, { restoreViewport: false });
      } else if (this.dragState.moved) {
        this.persistViewportState();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-part-move') {
      if (this.dragState.moved) {
        this.moveSongPart(
          this.dragState.sourceTrackIndex,
          this.dragState.partIndex,
          this.dragState.targetTrackIndex,
          this.dragState.targetStartTick
        );
      } else {
        this.finalizeSongSelection();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-part-resize') {
      if (this.songClonePaintTool.active) {
        const range = this.getSongSelectionRange();
        if (range) {
          this.applySongClonePaintToRange(range);
          this.persist({ commitHistory: true });
        }
      }
      this.commitHistorySnapshot();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-split-adjust') {
      this.commitHistorySnapshot();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-shift-slider') {
      this.commitHistorySnapshot();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-scrub') {
      this.persistViewportState();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-playhead') {
      this.persistViewportState();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'loop-start' || this.dragState?.mode === 'loop-end') {
      this.commitHistorySnapshot();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-loop-start' || this.dragState?.mode === 'song-loop-end') {
      this.commitHistorySnapshot();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'song-move') {
      if (this.dragState.moved) {
        this.applySongSelectionMove(this.dragState);
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'paste-preview') {
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'resize') {
      this.commitHistorySnapshot();
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'move') {
      if (shouldMidiDeleteSelectedNoteOnTap() && !this.dragState.moved && this.dragState.startedSelected && this.dragState.hit?.note) {
        this.deleteNote(this.dragState.hit.note);
      } else if (this.dragState.moved) {
        this.commitHistorySnapshot();
      }
      this.dragState = null;
      return;
    }
    if (this.dragState?.mode === 'pan-or-tap') {
      const shouldToggle = !this.dragState.moved && this.dragState.cell;
      const cell = this.dragState.cell;
      const moved = this.dragState.moved;
      this.dragState = null;
      if (shouldToggle) {
        this.toggleNoteAt(cell.tick, cell.pitch);
      }
      if (moved) this.persistViewportState();
      return;
    }
    const pendingDesktopDropdownHit = this.pendingDesktopDropdownHit;
    this.pendingDesktopDropdownHit = null;
    if (pendingDesktopDropdownHit) {
      const { shouldActivate } = resolvePendingDesktopDropdownHit(pendingDesktopDropdownHit, { x, y });
      if (shouldActivate) {
        pendingDesktopDropdownHit.action?.();
        this.closeMidiDesktopDropdown();
        this.closeSelectionMenu();
        this.pastePreview = null;
        this.noteLengthMenu.open = false;
        this.tempoSliderOpen = false;
      }
      return;
    }
    if (this.dragState?.mode === 'select') {
      this.finalizeSelectionBox();
    }
    if (this.draggingTrackControl) {
      this.commitHistorySnapshot();
    }
    this.dragState = null;
    this.draggingTrackControl = null;
  }

  handleWheel(payload) {
    this.lastPointer = { x: payload.x, y: payload.y };
    if (this.qaOverlayOpen) return;
    const modifiers = this.getModifiers();
    const desktopDropdownScroll = applyDesktopDropdownWheelScrollState({
      dropdown: this.desktopDropdown,
      payload,
      scrollState: this.desktopDropdownScroll
    });
    if (desktopDropdownScroll) {
      this.desktopDropdownScroll = desktopDropdownScroll.scrollState;
      return;
    }
    if (this.activeTab === 'settings' && this.bounds.settingsPanel) {
      if (!this.pointInBounds(payload.x, payload.y, this.bounds.settingsPanel)) return;
      this.settingsScroll = clamp(this.settingsScroll + payload.deltaY, 0, this.settingsScrollMax);
      return;
    }
    const rootScrollRegion = findScrollableMenuRegion(this.menuScrollRegions, payload);
    if (rootScrollRegion) {
      const step = Math.max(-1, Math.min(1, Math.round(payload.deltaY / 48) || Math.sign(payload.deltaY)));
      this.controllerMenu.scroll.root = clamp(
        (this.controllerMenu.scroll.root || 0) + step,
        0,
        rootScrollRegion.maxScroll || 0
      );
      return;
    }
    if (this.activeTab === 'grid' && this.gridBounds) {
      const inGrid = this.pointInBounds(payload.x, payload.y, this.gridBounds);
      const inRuler = this.rulerBounds && this.pointInBounds(payload.x, payload.y, this.rulerBounds);
      if (!inGrid && !inRuler) return;
      const delta = payload.deltaY;
      if (modifiers.shift) {
        this.gridOffset.x -= delta;
        this.ensureGridPanCapacity(this.gridOffset.x);
      } else {
        this.gridOffset.y -= delta;
      }
      this.clampGridOffset(
        this.gridBounds.w,
        this.gridBounds.h,
        this.getExpandedGridWidth(),
        this.gridBounds.gridH
      );
      this.updateTimelineStartTickFromGrid();
      this.persistViewportState();
      return;
    }
    if (this.activeTab === 'song' && this.songTimelineBounds) {
      const inTimeline = this.pointInBounds(payload.x, payload.y, this.songTimelineBounds);
      if (!inTimeline) return;
      const delta = payload.deltaY;
      if (modifiers.meta) {
        const nextZoom = this.viewportController.zoomWithFactor(this.gridZoomX, delta, {
          minZoom: this.getGridZoomLimitsX().minZoom,
          maxZoom: this.getGridZoomLimitsX().maxZoom
        });
        this.setHorizontalTimelineZoom(nextZoom, this.getSongTickFromX(payload.x, this.songTimelineBounds), payload.x);
      } else {
        const nextOffset = this.songTimelineOffsetX - delta;
        this.ensureTimelinePanCapacity(nextOffset, this.songTimelineBounds.w, this.songTimelineBounds.cellWidth);
        this.songTimelineOffsetX = this.clampTimelineOffsetX(
          nextOffset,
          this.songTimelineBounds.w,
          this.songTimelineBounds.cellWidth
        );
        this.updateTimelineStartTickFromSong();
        this.ensureTimelineCapacity();
      }
      this.persistViewportState();
    }
  }

  shouldHandleGestureStart(payload) {
    if (this.recordModeActive) return false;
    const touches = payload?.touches;
    const instrumentBounds = this.recordLayout?.bounds?.instrument;
    if (touches && instrumentBounds && this.recordLayout?.device !== 'gamepad') {
      const touchingInstrument = touches.some((touch) => this.pointInBounds(touch.x, touch.y, instrumentBounds));
      if (touchingInstrument) return false;
    }
    return true;
  }

  handleGestureStart(payload) {
    if (this.qaOverlayOpen) return;
    if (this.activeTab === 'grid') {
      if (!this.gridBounds) return;
      if (!this.pointInBounds(payload.x, payload.y, this.gridBounds)) return;
      this.gridGesture = this.viewportController.beginPinch(payload, {
        startZoomX: this.gridZoomX,
        startZoomY: this.gridZoomY,
        startOffsetX: this.gridOffset.x,
        startOffsetY: this.gridOffset.y,
        viewX: this.gridBounds.x,
        viewY: this.gridBounds.y,
        cellWidth: this.gridBounds.cellWidth,
        cellHeight: this.gridBounds.cellHeight,
        originX: this.gridBounds.originX,
        originY: this.gridBounds.originY,
        cols: this.gridBounds.cols,
        rows: this.gridBounds.rows,
        viewW: this.gridBounds.w,
        viewH: this.gridBounds.h
      });
      return;
    }
    if (this.activeTab === 'song') {
      if (!this.songTimelineBounds) return;
      if (!this.pointInBounds(payload.x, payload.y, this.songTimelineBounds)) return;
      this.songGesture = this.viewportController.beginPinch(payload, {
        startZoomX: this.gridZoomX,
        startOffsetX: this.songTimelineOffsetX,
        originX: this.songTimelineBounds.originX,
        cellWidth: this.songTimelineBounds.cellWidth,
        timelineTicks: this.songTimelineBounds.timelineTicks,
        viewX: this.songTimelineBounds.x,
        viewW: this.songTimelineBounds.w
      });
    }
  }

  handleGestureMove(payload) {
    if (this.gridGesture?.startDistance) {
      const pinch = this.viewportController.updatePinch(payload);
      if (!pinch) return;
      const scale = pinch.scale;
      const gridContext = pinch.context;
      const { minZoom, maxZoom } = this.getGridZoomLimits(gridContext.rows || 1);
      const zoomXLimits = this.getGridZoomLimitsX();
      const nextZoomX = clamp(gridContext.startZoomX * scale, zoomXLimits.minZoom, zoomXLimits.maxZoom);
      const nextZoomY = clamp(gridContext.startZoomY * scale, minZoom, maxZoom);
      const baseCellWidth = gridContext.cellWidth / gridContext.startZoomX;
      const baseCellHeight = gridContext.cellHeight / gridContext.startZoomY;
      const nextCellWidth = baseCellWidth * nextZoomX;
      const nextCellHeight = baseCellHeight * nextZoomY;
      const pinchStartX = payload.x - pinch.deltaX;
      const pinchStartY = payload.y - pinch.deltaY;
      const gridCoordX = (pinchStartX - gridContext.originX) / gridContext.cellWidth;
      const gridCoordY = (pinchStartY - gridContext.originY) / gridContext.cellHeight;
      const nextOriginX = payload.x - gridCoordX * nextCellWidth;
      const nextOriginY = payload.y - gridCoordY * nextCellHeight;
      this.gridZoomX = nextZoomX;
      this.gridZoomY = nextZoomY;
      this.suppressNextGridTap = true;
      this.gridOffset.x = nextOriginX - gridContext.viewX;
      this.gridOffset.y = nextOriginY - gridContext.viewY;
      this.ensureGridPanCapacity(this.gridOffset.x);
      const nextGridW = nextCellWidth * gridContext.cols;
      const nextGridH = nextCellHeight * gridContext.rows;
      this.clampGridOffset(gridContext.viewW, gridContext.viewH, nextGridW, nextGridH);
      this.updateTimelineStartTickFromGrid();
      return;
    }
    if (this.songGesture?.startDistance) {
      const pinch = this.viewportController.updatePinch(payload);
      if (!pinch) return;
      const scale = pinch.scale;
      const songContext = pinch.context;
      const zoomXLimits = this.getGridZoomLimitsX();
      const nextZoomX = clamp(songContext.startZoomX * scale, zoomXLimits.minZoom, zoomXLimits.maxZoom);
      const baseCellWidth = songContext.cellWidth / songContext.startZoomX;
      const nextCellWidth = baseCellWidth * nextZoomX;
      const pinchStartX = payload.x - pinch.deltaX;
      const coordX = (pinchStartX - songContext.originX) / songContext.cellWidth;
      const nextOriginX = payload.x - coordX * nextCellWidth;
      this.gridZoomX = nextZoomX;
      this.songTimelineOffsetX = this.clampTimelineOffsetX(
        nextOriginX - songContext.viewX,
        songContext.viewW,
        nextCellWidth
      );
      this.updateTimelineStartTickFromSong();
      this.ensureTimelineCapacity();
    }
  }

  handleGestureEnd() {
    if (this.gridGesture || this.songGesture) {
      this.persistViewportState();
    }
    this.gridGesture = null;
    this.songGesture = null;
    this.viewportController.endPinch();
  }

  handleGridPointerDown(payload) {
    const { x, y } = payload;
    const modifiers = this.getModifiers();
    const track = this.getActiveTrack();
    const drumTrack = isDrumTrack(track);
    if (this.song.loopEnabled && this.isNearLoopMarker(x, 'start')) {
      this.dragState = { mode: 'loop-start' };
      this.setLoopStartTick(this.getTickFromX(x));
      return;
    }
    if (this.song.loopEnabled && this.isNearLoopMarker(x, 'end')) {
      this.dragState = { mode: 'loop-end' };
      this.setLoopEndTick(this.getTickFromX(x));
      return;
    }
    const hit = this.getNoteHitAt(x, y);
    const cell = this.getGridCell(x, y);
    if (!cell && !hit) return;
    const pointerPolicy = !this.isMobileLayout()
      ? getEditorPointerInteractionPolicy('midi', { mode: 'desktop', pointerType: 'mouse' })
      : null;
    const shouldPanWithButton = Boolean(pointerPolicy) && (
      (payload.button === 1 && pointerPolicy.workSurfaceGestures.middleDragPan)
      || (payload.button === 2 && pointerPolicy.workSurfaceGestures.rightDragPan)
    );
    if ((payload.touchCount && !hit) || modifiers.alt || shouldPanWithButton) {
      if (!cell) return;
      const pointerId = payload.id;
      this.dragState = {
        mode: payload.touchCount ? 'touch-pan' : 'pan',
        id: pointerId,
        startX: x,
        startY: y,
        startOffsetX: this.gridOffset.x,
        startOffsetY: this.gridOffset.y,
        moved: false,
        cell,
        hit
      };
      if (payload.touchCount) {
        this.longPressTimer = window.setTimeout(() => {
          if (!this.dragState || this.dragState.mode !== 'touch-pan') {
            this.longPressTimer = null;
            return;
          }
          if (this.dragState.id !== undefined && this.dragState.id !== pointerId) {
            this.longPressTimer = null;
            return;
          }
          if (typeof navigator !== 'undefined' && navigator?.vibrate) {
            navigator.vibrate(20);
          }
          this.dragState = {
            mode: 'select',
            id: pointerId,
            startX: this.dragState.startX,
            startY: this.dragState.startY,
            currentX: this.lastPointer.x,
            currentY: this.lastPointer.y,
            appendSelection: false
          };
          this.longPressTimer = null;
        }, 450);
      }
      return;
    }
    if (this.pastePreview) {
      if (!cell) return;
      this.updatePastePreviewPosition(cell.tick, cell.pitch);
      this.dragState = { mode: 'paste-preview' };
      return;
    }
    if (hit) {
      if (modifiers.meta) {
        this.toggleSelection(hit.note.id);
        return;
      }
      const startedSelected = this.selection.has(hit.note.id);
      if (!startedSelected) {
        this.selection.clear();
        this.selection.add(hit.note.id);
      }
      if (hit.edge && !drumTrack) {
        this.dragState = {
          mode: 'resize',
          id: payload.id,
          edge: hit.edge,
          resizeNoteId: hit.note.id,
          originalNotes: this.getSelectedNotes().map((note) => ({ ...note }))
        };
        return;
      }
      if (!cell) return;
      if (modifiers.shift) {
        this.duplicateSelection();
      }
      this.dragState = {
        mode: 'move',
        id: payload.id,
        startTick: this.snapTickForTrack(cell.tick),
        startPitch: cell.pitch,
        startX: x,
        startY: y,
        moved: false,
        cell,
        hit,
        startedSelected,
        originalNotes: this.getSelectedNotes().map((note) => ({ ...note }))
      };
      this.previewNote(hit.note, cell.pitch);
      return;
    }
    if (modifiers.meta) {
      this.dragState = { mode: 'select', startX: x, startY: y, currentX: x, currentY: y };
      return;
    }
    this.selection.clear();
    this.dragState = {
      mode: 'pan-or-tap',
      startX: x,
      startY: y,
      startOffsetX: this.gridOffset.x,
      startOffsetY: this.gridOffset.y,
      currentX: x,
      currentY: y,
      cell,
      moved: false
    };
  }

  toggleNoteAt(tick, pitch) {
    this.cancelLongPressTimer();
    if (this.selectionMenu.open) {
      this.closeSelectionMenu();
    }
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = isDrumTrack(track);
    const snappedTick = this.snapTickForTrack(tick, track);
    const snappedPitch = drumTrack
      ? this.coercePitchForTrack(pitch, track)
      : this.snapPitchToScale(pitch);
    const existingIndex = pattern.notes.findIndex(
      (note) => note.startTick === snappedTick && note.pitch === snappedPitch
    );
    if (existingIndex >= 0) {
      const [removed] = pattern.notes.splice(existingIndex, 1);
      if (removed) {
        this.selection.delete(removed.id);
      }
      this.persist({ commitHistory: true });
      return;
    }
    const duration = this.getPlacementDurationTicks(track);
    const note = {
      id: uid(),
      startTick: snappedTick,
      durationTicks: duration,
      pitch: snappedPitch,
      velocity: 0.9
    };
    pattern.notes.push(note);
    this.selection.clear();
    this.selection.add(note.id);
    this.defaultNoteDurationTicks = note.durationTicks;
    this.cursor = { tick: snappedTick, pitch: snappedPitch };
    this.ensureGridCapacity(snappedTick + duration);
    this.persist({ commitHistory: true });
    this.previewNote(note, snappedPitch);
    this.panJoystick.active = false;
    this.panJoystick.id = null;
    this.gridGesture = null;
    this.viewportController.endPinch();
  }

  paintNoteAt(tick, pitch, continuous) {
    if (this.selectionMenu.open) {
      this.closeSelectionMenu();
    }
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = isDrumTrack(track);
    const snappedTick = this.snapTickForTrack(tick, track);
    const snappedPitch = drumTrack
      ? this.coercePitchForTrack(pitch, track)
      : this.snapPitchToScale(pitch);
    const existing = pattern.notes.find((note) => note.startTick === snappedTick && note.pitch === snappedPitch);
    if (existing) {
      if (!continuous) {
        this.selection.clear();
        this.selection.add(existing.id);
        this.previewNote(existing, snappedPitch);
      }
      return;
    }
    const duration = this.getPlacementDurationTicks(track);
    const note = {
      id: uid(),
      startTick: snappedTick,
      durationTicks: duration,
      pitch: snappedPitch,
      velocity: 0.9
    };
    pattern.notes.push(note);
    this.selection.clear();
    this.selection.add(note.id);
    this.defaultNoteDurationTicks = note.durationTicks;
    this.cursor = { tick: snappedTick, pitch: snappedPitch };
    this.ensureGridCapacity(snappedTick + duration);
    this.persist({ commitHistory: true });
    this.previewNote(note, snappedPitch);
  }

  eraseNoteAt(tick, pitch) {
    const hit = this.getNoteAtCell(tick, pitch);
    if (!hit) return;
    this.deleteNote(hit.note);
  }

  deleteNote(note) {
    const pattern = this.getActivePattern();
    if (!pattern) return;
    pattern.notes = pattern.notes.filter((entry) => entry.id !== note.id);
    this.selection.delete(note.id);
    this.persist({ commitHistory: true });
  }

  moveSelectionTo(tick, pitch) {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !this.dragState?.originalNotes || !track) return;
    const drumTrack = isDrumTrack(track);
    const startTick = this.snapTickForTrack(tick, track);
    const snappedPitch = drumTrack
      ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS)
      : this.snapPitchToScale(pitch);
    const deltaTick = startTick - this.dragState.startTick;
    const deltaPitch = drumTrack ? 0 : snappedPitch - this.dragState.startPitch;
    const gridTicks = this.getGridTicks();
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const original = this.dragState.originalNotes.find((entry) => entry.id === note.id);
      const nextStart = clamp(original.startTick + deltaTick, 0, gridTicks - 1);
      const nextPitch = drumTrack
        ? this.coercePitchForTrack(original.pitch, track, GM_DRUM_ROWS)
        : clamp(original.pitch + deltaPitch, this.getPitchRange().min, this.getPitchRange().max);
      return {
        ...note,
        startTick: nextStart,
        durationTicks: Math.max(1, original?.durationTicks ?? note.durationTicks),
        pitch: drumTrack ? nextPitch : this.snapPitchToScale(nextPitch)
      };
    });
    const selectedNotes = this.getSelectedNotes();
    if (!selectedNotes.length) return;
    const maxEndTick = Math.max(...selectedNotes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    this.persist();
    this.scheduleHistoryCommit();
    const previewTarget = selectedNotes[0];
    if (previewTarget) {
      this.previewNote(previewTarget, snappedPitch);
    }
  }

  resizeSelectionTo(tick) {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !this.dragState?.originalNotes || !track || isDrumTrack(track)) return;
    const gridTicks = this.getGridTicks();
    const minDurationTicks = this.getResizeMinimumTicksForLayout();
    const resizeTargetId = this.dragState.resizeNoteId;
    const targetOriginal = this.dragState.originalNotes.find((entry) => entry.id === resizeTargetId)
      || this.dragState.originalNotes[0];
    if (!targetOriginal) return;
    const targetStart = clamp(Math.floor(Number(targetOriginal.startTick) || 0), 0, Math.max(0, gridTicks - 1));
    const targetEnd = clamp(targetStart + Math.max(1, Math.floor(Number(targetOriginal.durationTicks) || 1)), targetStart + 1, gridTicks);
    const rawTick = clamp(Math.floor(Number(tick) || 0), 0, gridTicks);
    const resizeStep = Math.max(1, minDurationTicks);
    const snappedTick = this.dragState.edge === 'start'
      ? clamp(targetEnd - Math.round((targetEnd - rawTick) / resizeStep) * resizeStep, 0, Math.max(0, targetEnd - resizeStep))
      : clamp(targetStart + Math.round((rawTick - targetStart) / resizeStep) * resizeStep, Math.min(gridTicks, targetStart + resizeStep), gridTicks);
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const original = this.dragState.originalNotes.find((entry) => entry.id === note.id) || note;
      return resizeMidiNoteByEdge(original, {
        edge: this.dragState.edge,
        snappedTick,
        targetOriginal,
        gridTicks,
        minDurationTicks
      });
    });
    const maxEndTick = Math.max(...this.getSelectedNotes().map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    const first = this.getSelectedNotes()[0];
    if (first) {
      this.defaultNoteDurationTicks = Math.max(1, first.durationTicks);
    }
    this.persist();
    this.scheduleHistoryCommit();
  }

  resizeSelectedNotesBy(deltaTicks) {
    if (!deltaTicks) return;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track || isDrumTrack(track)) return;
    const gridTicks = this.getGridTicks();
    const minDurationTicks = this.getResizeMinimumTicksForLayout();
    const selected = this.getSelectedNotes();
    if (!selected.length) return;
    pattern.notes = pattern.notes.map((note) => {
      if (!this.selection.has(note.id)) return note;
      const maxDuration = Math.max(1, gridTicks - note.startTick);
      const minDuration = Math.min(minDurationTicks, maxDuration);
      const resizeStep = Math.max(1, minDurationTicks);
      const duration = clamp(Math.round((note.durationTicks + deltaTicks) / resizeStep) * resizeStep, minDuration, maxDuration);
      return { ...note, durationTicks: duration };
    });
    const maxEndTick = Math.max(...this.getSelectedNotes().map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    const first = this.getSelectedNotes()[0];
    if (first) {
      this.defaultNoteDurationTicks = Math.max(1, first.durationTicks);
    }
    this.persist();
    this.scheduleHistoryCommit();
  }

  updateSelectionBox(x, y) {
    if (!this.dragState) return;
    this.dragState.currentX = x;
    this.dragState.currentY = y;
  }

  finalizeSelectionBox() {
    if (!this.dragState || !this.gridBounds) return;
    const { startX, startY, currentX, currentY } = this.dragState;
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);
    const pattern = this.getActivePattern();
    if (!pattern) return;
    if (!this.dragState.appendSelection) {
      this.selection.clear();
    }
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (rect && rect.x + rect.w >= minX && rect.x <= maxX && rect.y + rect.h >= minY && rect.y <= maxY) {
        this.selection.add(note.id);
      }
    });
    if (this.selection.size > 0) {
      this.openSelectionMenu(maxX + 12, maxY + 12);
    }
  }

  openSelectionMenu(x, y) {
    this.selectionMenu.open = true;
    this.selectionMenu.x = x;
    this.selectionMenu.y = y;
  }

  closeSelectionMenu() {
    this.selectionMenu.open = false;
    this.selectionMenu.bounds = [];
    this.bounds.selectionMenu = [];
  }

  deleteSelectedNotes() {
    const pattern = this.getActivePattern();
    if (!pattern || this.selection.size === 0) return;
    pattern.notes = pattern.notes.filter((note) => !this.selection.has(note.id));
    this.selection.clear();
    this.closeSelectionMenu();
    this.persist({ commitHistory: true });
  }

  beginPastePreview() {
    if (!this.clipboard) return;
    const track = this.getActiveTrack();
    if (!track) return;
    const drumTrack = isDrumTrack(track) || this.clipboard.isDrum;
    const nextTick = this.getNextEmptyBarStart();
    const basePitch = drumTrack
      ? this.coercePitchForTrack(this.clipboard.basePitch ?? this.cursor.pitch ?? this.getPitchRange().min, track, GM_DRUM_ROWS)
      : this.cursor.pitch || this.getPitchRange().min;
    this.pastePreview = {
      tick: this.snapTickForTrack(nextTick, track),
      pitch: drumTrack ? basePitch : this.snapPitchToScale(basePitch),
      notes: this.clipboard.notes,
      isDrum: drumTrack
    };
    this.cursor.tick = this.pastePreview.tick;
    this.cursor.pitch = this.pastePreview.pitch;
  }

  updatePastePreviewPosition(tick, pitch) {
    if (!this.pastePreview) return;
    const track = this.getActiveTrack();
    const drumTrack = this.pastePreview.isDrum || isDrumTrack(track);
    this.pastePreview.tick = drumTrack ? this.snapTickForTrack(tick, track) : this.snapTick(tick);
    if (!drumTrack) {
      this.pastePreview.pitch = this.snapPitchToScale(pitch);
    }
    this.cursor.tick = this.pastePreview.tick;
    this.cursor.pitch = this.pastePreview.pitch;
  }

  applyPastePreview() {
    if (!this.clipboard || !this.pastePreview) return;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = this.pastePreview.isDrum || isDrumTrack(track);
    const gridTicks = this.getGridTicks();
    const baseTick = this.pastePreview.tick;
    const basePitch = this.pastePreview.pitch;
    const newIds = [];
    this.clipboard.notes.forEach((note) => {
      const rawStart = baseTick + note.startTick;
      const startTick = clamp(rawStart, 0, gridTicks - 1);
      const pitchValue = drumTrack
        ? this.coercePitchForTrack(note.pitchAbsolute ?? note.pitch, track, GM_DRUM_ROWS)
        : clamp(basePitch + note.pitch, this.getPitchRange().min, this.getPitchRange().max);
      const newNote = {
        id: uid(),
        startTick,
        durationTicks: Math.max(1, note.durationTicks),
        pitch: pitchValue,
        velocity: note.velocity
      };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    const maxEndTick = Math.max(...newIds.map((id) => {
      const note = pattern.notes.find((entry) => entry.id === id);
      return note ? note.startTick + this.getEffectiveDurationTicks(note, track) : 0;
    }));
    this.ensureGridCapacity(maxEndTick);
    this.pastePreview = null;
    this.persist({ commitHistory: true });
  }

  copySelection() {
    const notes = this.getSelectedNotes();
    const track = this.getActiveTrack();
    if (!track || notes.length === 0) return;
    const drumTrack = isDrumTrack(track);
    const minTick = Math.min(...notes.map((note) => note.startTick));
    const minPitch = Math.min(...notes.map((note) => note.pitch));
    const width = Math.max(...notes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track))) - minTick;
    this.clipboard = {
      notes: notes.map((note) => ({
        ...note,
        startTick: note.startTick - minTick,
        durationTicks: Math.max(1, note.durationTicks),
        pitch: drumTrack ? note.pitch : note.pitch - minPitch,
        pitchAbsolute: note.pitch
      })),
      width,
      height: drumTrack ? 0 : Math.max(...notes.map((note) => note.pitch)) - minPitch,
      isDrum: drumTrack,
      basePitch: drumTrack ? notes[0].pitch : minPitch
    };
  }

  selectAllActivePatternNotes({ openMenu = false } = {}) {
    const pattern = this.getActivePattern();
    if (!pattern) return;
    this.selection = new Set(pattern.notes.map((note) => note.id));
    if (openMenu) {
      this.openSelectionMenu(this.lastPointer.x + 12, this.lastPointer.y + 12);
    }
  }

  getMidiEditMenuItems() {
    const selectedNotes = this.getSelectedNotes();
    const hasSelection = selectedNotes.length > 0;
    const pattern = this.getActivePattern();
    const hasPatternNotes = Boolean(pattern?.notes?.length);
    const hasClipboard = Boolean(this.clipboard);
    return [
      { id: 'undo', label: 'Undo', onClick: () => this.runtime.undo() },
      { id: 'redo', label: 'Redo', onClick: () => this.runtime.redo() },
      { id: 'select-all', label: 'Select All', disabled: !hasPatternNotes, onClick: () => this.selectAllActivePatternNotes() },
      { id: 'copy', label: 'Copy', disabled: !hasSelection, onClick: () => this.copySelection() },
      {
        id: 'cut',
        label: 'Cut',
        disabled: !hasSelection,
        onClick: () => {
          this.copySelection();
          this.deleteSelectedNotes();
          this.beginPastePreview();
        }
      },
      { id: 'paste', label: 'Paste', disabled: !hasClipboard, onClick: () => this.pasteSelection() },
      { id: 'delete', label: 'Delete', disabled: !hasSelection, onClick: () => this.deleteSelectedNotes() }
    ];
  }

  pasteSelection() {
    if (!this.clipboard) return;
    if (!this.pastePreview) {
      this.beginPastePreview();
    }
  }

  duplicateSelection() {
    const notes = this.getSelectedNotes();
    if (notes.length === 0) return;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const drumTrack = isDrumTrack(track);
    const gridTicks = this.getGridTicks();
    const span = Math.max(...notes.map((note) => note.startTick + this.getEffectiveDurationTicks(note, track)))
      - Math.min(...notes.map((note) => note.startTick));
    const newIds = [];
    notes.forEach((note) => {
      const rawStart = note.startTick + span;
      const startTick = clamp(rawStart, 0, gridTicks - 1);
      const newNote = {
        ...note,
        id: uid(),
        startTick,
        durationTicks: Math.max(1, note.durationTicks),
        pitch: drumTrack ? this.coercePitchForTrack(note.pitch, track, GM_DRUM_ROWS) : note.pitch
      };
      pattern.notes.push(newNote);
      newIds.push(newNote.id);
    });
    this.selection = new Set(newIds);
    const maxEndTick = Math.max(...notes.map((note) => note.startTick + span + this.getEffectiveDurationTicks(note, track)));
    this.ensureGridCapacity(maxEndTick);
    this.persist({ commitHistory: true });
  }

  toggleSelection(noteId) {
    if (this.selection.has(noteId)) {
      this.selection.delete(noteId);
    } else {
      this.selection.add(noteId);
    }
  }

  getSelectedNotes() {
    const pattern = this.getActivePattern();
    if (!pattern) return [];
    return pattern.notes.filter((note) => this.selection.has(note.id));
  }

  previewNote(note, pitch) {
    if (!this.previewOnEdit || !note) return;
    const now = performance.now();
    if (now - this.lastAuditionTime < 90) return;
    this.lastAuditionTime = now;
    const track = this.getActiveTrack();
    if (!track) return;
    const drumTrack = isDrumTrack(track);
    const durationTicks = this.getEffectiveDurationTicks(note, track);
    const duration = durationTicks / this.ticksPerBeat;
    const resolvedPitch = drumTrack ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS) : pitch;
    this.playPreviewGmNote(resolvedPitch, duration, track.volume, track);
  }

  auditionPitch(pitch) {
    const now = performance.now();
    if (now - this.lastAuditionTime < 90) return;
    this.lastAuditionTime = now;
    const track = this.getActiveTrack();
    if (!track) return;
    const drumTrack = isDrumTrack(track);
    const resolvedPitch = drumTrack ? this.coercePitchForTrack(pitch, track, GM_DRUM_ROWS) : pitch;
    const duration = this.getPlacementDurationTicks(track) / this.ticksPerBeat;
    this.playPreviewGmNote(resolvedPitch, duration, track.volume, track);
  }

  selectInstrumentPickerItem(pickHit) {
    if (!pickHit) return;
    this.instrumentPicker.selectedProgram = pickHit.program;
    if (pickHit.kitId) {
      this.instrumentPicker.drumKitId = pickHit.kitId;
      this.audioSettings.drumKitId = pickHit.kitId;
      this.saveAudioSettings();
      this.applyAudioSettings();
      this.previewDrumKitSelection(pickHit);
      return;
    }
    this.previewInstrument(pickHit.program);
  }

  previewDrumKitSelection(pickHit) {
    const now = performance.now();
    if (now - this.lastAuditionTime < 120) return;
    this.lastAuditionTime = now;
    const availableKits = this.game?.audio?.listAvailableDrumKits?.();
    const drumKits = Array.isArray(availableKits) && availableKits.length ? availableKits : GM_DRUM_KITS;
    const selectedKit = drumKits.find((kit) => kit.id === pickHit?.kitId) || drumKits[0];
    if (!selectedKit) return;
    const previewTrack = {
      instrument: 'drums',
      channel: GM_DRUM_CHANNEL,
      program: clamp(selectedKit.preset ?? selectedKit.program ?? 0, 0, 127),
      bankMSB: selectedKit.bankMSB ?? DRUM_BANK_MSB,
      bankLSB: selectedKit.bankLSB ?? DRUM_BANK_LSB,
      volume: 0.9
    };
    [36, 38, 42, 49].forEach((pitch, index) => {
      window.setTimeout(() => {
        this.playPreviewGmNote(pitch, 0.45, 0.95, previewTrack);
      }, index * 150);
    });
  }

  previewInstrument(program, trackOverride = null) {
    if (!Number.isInteger(program)) return;
    const now = performance.now();
    if (now - this.lastAuditionTime < 120) return;
    this.lastAuditionTime = now;
    const track = trackOverride || this.getActiveTrack();
    const volume = track?.volume ?? 0.8;
    const isDrum = isDrumTrack(track);
    const channel = isDrum ? GM_DRUM_CHANNEL : (track?.channel ?? 0);
    const key = this.getCacheKeyForProgram(
      program,
      channel,
      track?.bankMSB ?? DEFAULT_BANK_MSB,
      track?.bankLSB ?? DEFAULT_BANK_LSB
    ) || String(program);
    const audio = this.game?.audio;
    if (audio?.loadGmProgram) {
      const loadPromise = isDrum ? audio.loadGmDrumKit?.() : audio.loadGmProgram(program);
      if (loadPromise?.finally) {
        this.setPreviewLoading(key, true);
        loadPromise.finally(() => this.setPreviewLoading(key, false));
      }
    }
    const sequence = isDrum
      ? [36, 38, 42, 49]
      : [60, 65, 67, 72];
    const baseVolume = Math.min(1, volume + 0.1);
    sequence.forEach((pitch, index) => {
      window.setTimeout(() => {
        this.playPreviewGmNote(pitch, 0.45, baseVolume, {
          program,
          channel,
          bankMSB: isDrum ? DRUM_BANK_MSB : DEFAULT_BANK_MSB,
          bankLSB: isDrum ? DRUM_BANK_LSB : DEFAULT_BANK_LSB,
          instrument: isDrum ? 'drums' : track?.instrument
        });
      }, index * 160);
    });
  }

  previewNotesAtTick(tick) {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return;
    const processed = this.getTrackPedalProcessing(track, pattern);
    processed.notes.forEach((note) => {
      const durationTicks = this.getEffectiveDurationTicks(note, track);
      if (note.startTick <= tick && note.startTick + durationTicks > tick) {
        this.previewNote(note, note.pitch);
      }
    });
  }

  getModifiers() {
    const input = this.game?.input;
    return {
      alt: input?.isDownCode?.('AltLeft') || input?.isDownCode?.('AltRight'),
      shift: input?.isShiftDown?.(),
      meta: input?.isDownCode?.('ControlLeft')
        || input?.isDownCode?.('ControlRight')
        || input?.isDownCode?.('MetaLeft')
        || input?.isDownCode?.('MetaRight')
    };
  }

  setTempo(value) {
    this.song.tempo = clamp(value, 40, 240);
    this.persist();
    this.scheduleHistoryCommit();
  }

  jumpPlayheadBars(delta) {
    const ticksPerBar = this.getTicksPerBar();
    const next = this.playheadTick + ticksPerBar * delta;
    this.playheadTick = clamp(next, 0, this.getEditableGridTick());
    this.resyncPlaybackClock(this.playheadTick);
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.isPlaying = false;
      this.resyncPlaybackClock(this.playheadTick);
      this.flushPersist({ force: true });
      return;
    }
    this.resyncPlaybackClock(this.playheadTick);
    this.isPlaying = true;
  }

  stopPlayback() {
    this.isPlaying = false;
    this.game?.audio?.clearMidiPedalBuses?.();
    this.returnToStart();
    this.resyncPlaybackClock(this.playheadTick);
    this.flushPersist({ force: true });
  }

  returnToStart() {
    this.playheadTick = this.song.loopEnabled ? this.getLoopStartTick() : 0;
    this.resyncPlaybackClock(this.playheadTick);
  }

  goToEnd() {
    this.playheadTick = this.getSongEndTick();
    this.resyncPlaybackClock(this.playheadTick);
  }

  getTransportActions() {
    return [
      { id: 'start', label: '⏮', col: 0, row: 0, action: () => this.returnToStart() },
      { id: 'back', label: '⏪', col: 0, row: 1, action: () => this.jumpPlayheadBars(-1) },
      { id: 'forward', label: '⏩', col: 0, row: 2, action: () => this.jumpPlayheadBars(1) },
      { id: 'end', label: '⏭', col: 0, row: 3, action: () => this.goToEnd() },
      { id: 'metronome', label: 'M', col: 1, row: 0, active: this.metronomeEnabled, action: () => { this.metronomeEnabled = !this.metronomeEnabled; } },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶', col: 1, row: 1, primary: true, active: this.isPlaying, action: () => this.togglePlayback() },
      { id: 'loop', label: MIDI_LOOP_ICON, col: 1, row: 2, active: this.song.loopEnabled, action: () => this.toggleLoopEnabled() }
    ];
  }

  openTransportPopover(anchor) {
    this.transportPopover = { anchor: { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h } };
  }

  closeTransportPopover() {
    this.transportPopover = null;
    this.bounds.transportPopoverButtons = [];
  }

  startTransportHold(anchor, payload) {
    this.cancelTransportHold();
    this.transportHold = {
      x: payload.x,
      y: payload.y,
      anchor,
      fired: false,
      timer: window.setTimeout(() => {
        if (!this.transportHold) return;
        this.transportHold.fired = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
        this.openTransportPopover(anchor);
      }, 500)
    };
  }

  cancelTransportHold() {
    if (this.transportHold?.timer) window.clearTimeout(this.transportHold.timer);
    this.transportHold = null;
  }

  drawTransportPopover(ctx) {
    if (!this.transportPopover) return;
    const layout = drawSharedTransportPopover(ctx, this.transportPopover.anchor, { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }, this.getTransportActions(), {
      columns: 2,
      columnWidth: 54,
      rowHeight: 42
    });
    this.bounds.transportPopoverButtons = layout.buttons.map((button) => ({ ...button.bounds, id: button.id, action: button.action }));
  }

  setLoopStartTick(tick) {
    const ticksPerBar = this.getTicksPerBar();
    const gridTicks = this.getGridTicks();
    const loopEnd = typeof this.song.loopEndTick === 'number' ? this.song.loopEndTick : gridTicks;
    const maxStart = Math.max(0, loopEnd - ticksPerBar);
    const snapped = clamp(Math.round(tick / ticksPerBar) * ticksPerBar, 0, maxStart);
    this.song.loopStartTick = snapped;
    if (typeof this.song.loopEndTick === 'number' && this.song.loopEndTick <= snapped) {
      this.song.loopEndTick = Math.max(ticksPerBar, snapped + ticksPerBar);
      this.ensureGridCapacity(this.song.loopEndTick);
    } else if (typeof this.song.loopEndTick === 'number' && this.song.loopEndTick > gridTicks) {
      this.ensureGridCapacity(this.song.loopEndTick);
    }
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.resyncPlaybackClock(this.playheadTick);
    this.persist();
    this.scheduleHistoryCommit();
  }

  setLoopEndTick(tick) {
    const ticksPerBar = this.getTicksPerBar();
    const start = typeof this.song.loopStartTick === 'number' ? this.song.loopStartTick : 0;
    const minEnd = Math.max(ticksPerBar, start + ticksPerBar);
    const snapped = Math.max(minEnd, Math.round(tick / ticksPerBar) * ticksPerBar);
    this.song.loopEndTick = snapped;
    this.ensureGridCapacity(snapped);
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.resyncPlaybackClock(this.playheadTick);
    this.persist();
    this.scheduleHistoryCommit();
  }

  setLoopToMeasureIndex(barIndex) {
    const ticksPerBar = this.getTicksPerBar();
    const safeIndex = Math.max(0, Math.floor(Number(barIndex) || 0));
    const start = safeIndex * ticksPerBar;
    const end = start + ticksPerBar;
    this.song.loopStartTick = start;
    this.song.loopEndTick = end;
    this.song.loopEnabled = true;
    this.ensureGridCapacity(end);
    this.playheadTick = clamp(this.playheadTick, start, end);
    this.resyncPlaybackClock(this.playheadTick);
    this.persist({ commitHistory: true });
  }

  handleSongRulerTap(tick) {
    const ticksPerBar = this.getTicksPerBar();
    const barIndex = Math.max(0, Math.floor(tick / ticksPerBar));
    const now = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    const isDoubleTap = this.songRulerTap
      && this.songRulerTap.barIndex === barIndex
      && now - this.songRulerTap.at <= 300;
    this.songRulerTap = { barIndex, at: now };
    if (!isDoubleTap) return false;
    this.setLoopToMeasureIndex(barIndex);
    return true;
  }

  clearLoopStartTick() {
    this.song.loopStartTick = null;
    this.placingStartMarker = false;
    this.persist({ commitHistory: true });
  }

  clearLoopEndTick() {
    this.song.loopEndTick = null;
    this.song.loopEnabled = false;
    this.placingEndMarker = false;
    this.persist({ commitHistory: true });
  }

  toggleLoopEnabled() {
    if (typeof this.song.loopEndTick !== 'number') {
      this.song.loopStartTick = 0;
      this.song.loopEndTick = this.getDefaultLoopEndTick();
      this.song.loopEnabled = true;
      this.ensureGridCapacity(this.song.loopEndTick);
      this.persist({ commitHistory: true });
      return;
    }
    this.song.loopEnabled = !this.song.loopEnabled;
    this.persist({ commitHistory: true });
  }

  adjustLoopBars(delta) {
    const ticksPerBar = this.getTicksPerBar();
    if (typeof this.song.loopEndTick === 'number') {
      const nextEnd = Math.max(ticksPerBar, this.song.loopEndTick + delta * ticksPerBar);
      this.song.loopEndTick = nextEnd;
      this.song.loopBars = Math.max(1, Math.ceil(nextEnd / ticksPerBar));
      this.song.tracks.forEach((track) => {
        track.patterns.forEach((pattern) => {
          pattern.bars = this.song.loopBars;
        });
      });
      this.ensureGridCapacity(nextEnd);
      this._needsEnsureState = true;
      this.persist({ commitHistory: true });
      return;
    }
    this.song.loopBars = Math.max(1, this.song.loopBars + delta);
    this.song.tracks.forEach((track) => {
      track.patterns.forEach((pattern) => {
        pattern.bars = this.song.loopBars;
      });
    });
    this._needsEnsureState = true;
    this.persist({ commitHistory: true });
  }

  getEndMarkerLabel() {
    if (typeof this.song.loopEndTick !== 'number') return 'End ∞';
    const ticksPerBar = this.getTicksPerBar();
    const bar = Math.max(1, Math.round(this.song.loopEndTick / ticksPerBar));
    return `End ${bar} bar${bar === 1 ? '' : 's'}`;
  }

  getStartMarkerLabel() {
    if (typeof this.song.loopStartTick !== 'number') return 'Start 1';
    const ticksPerBar = this.getTicksPerBar();
    const bar = Math.max(1, Math.round(this.song.loopStartTick / ticksPerBar) + 1);
    return `Start ${bar} bar${bar === 1 ? '' : 's'}`;
  }

  getPositionLabel() {
    const ticksPerBar = this.getTicksPerBar();
    const bar = Math.floor(this.playheadTick / ticksPerBar) + 1;
    const beat = Math.floor((this.playheadTick % ticksPerBar) / this.ticksPerBeat) + 1;
    return `Pos ${bar}:${beat}`;
  }

  addTrack() {
    this.openInstrumentPicker('add');
  }

  removeTrack() {
    if (this.song.tracks.length <= 1) return;
    const track = this.getActiveTrack();
    const noteCount = track?.patterns?.reduce((sum, pattern) => sum + (pattern?.notes?.length || 0), 0) || 0;
    const trackName = track?.name || 'this track';
    const detail = noteCount > 0
      ? `This will delete "${trackName}" and ${noteCount} note${noteCount === 1 ? '' : 's'}.`
      : `This will delete "${trackName}".`;
    this.requestConfirmOverlay({
      title: 'Remove Instrument?',
      message: detail,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      onConfirm: () => {
        this.song.tracks.splice(this.selectedTrackIndex, 1);
        this.selectedTrackIndex = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
        this.syncCursorToTrack();
        this.persist({ commitHistory: true });
      }
    });
  }

  duplicateTrack() {
    const track = this.getActiveTrack();
    if (!track) return;
    const cloned = {
      ...track,
      id: `track-${uid()}`,
      name: `${track.name} Copy`,
      midiPedals: normalizeMidiPedals(track.midiPedals).map((pedal) => (pedal ? { ...pedal, id: `pedal_${uid()}`, knobs: { ...pedal.knobs } } : null)),
      patterns: track.patterns.map((pattern) => ({
        ...pattern,
        id: `pattern-${uid()}`,
        notes: pattern.notes.map((note) => ({ ...note, id: uid() }))
      }))
    };
    this.song.tracks.splice(this.selectedTrackIndex + 1, 0, cloned);
    this.selectedTrackIndex += 1;
    this.persist({ commitHistory: true });
  }

  async handleTrackControl(hit, pointerX = hit?.x, pointerY = hit?.y) {
    if (hit.control === 'master-volume' || hit.control === 'master-pan') {
      this.draggingTrackControl = hit;
      this.updateTrackControl(pointerX, pointerY);
      return;
    }
    const track = this.song.tracks[hit.trackIndex];
    if (!track) return;
    if (hit.control === 'mute') {
      track.mute = !track.mute;
    } else if (hit.control === 'solo') {
      track.solo = !track.solo;
    } else if (hit.control === 'duplicate') {
      this.duplicateTrack();
      return;
    } else if (hit.control === 'remove') {
      this.removeTrack();
      return;
    } else if (hit.control === 'transport-home') {
      this.returnToStart();
      return;
    } else if (hit.control === 'transport-rewind') {
      this.jumpPlayheadBars(-1);
      return;
    } else if (hit.control === 'transport-play') {
      this.togglePlayback();
      return;
    } else if (hit.control === 'transport-forward') {
      this.jumpPlayheadBars(1);
      return;
    } else if (hit.control === 'transport-end') {
      this.goToEnd();
      return;
    } else if (hit.control === 'transport-loop') {
      this.toggleLoopEnabled();
      return;
    } else if (hit.control === 'transport-record') {
      this.enterRecordMode();
      return;
    } else if (hit.control === 'instrument') {
      if (isDrumTrack(track)) {
        this.instrumentPicker.familyTab = 'drums-perc';
      }
      this.openInstrumentPicker('edit', hit.trackIndex);
      return;
    } else if (hit.control === 'download') {
      this.downloadTrackInstrument(track);
      return;
    } else if (hit.control === 'channel-down') {
      this.setTrackChannel(track, track.channel - 1);
      return;
    } else if (hit.control === 'channel-up') {
      this.setTrackChannel(track, track.channel + 1);
      return;
    } else if (hit.control === 'channel-prompt') {
      const nextChannel = await openTextInputOverlay({
        title: 'Set MIDI Channel',
        label: 'Set channel (1-16)',
        initialValue: String(track.channel + 1),
        inputType: 'int',
        min: 1,
        max: 16
      });
      if (nextChannel) {
        const parsed = Number.parseInt(nextChannel, 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 16) {
          this.setTrackChannel(track, parsed - 1);
        } else {
          this.showEditorMessage('Channel must be 1-16.');
        }
      }
      return;
    } else if (hit.control === 'set-drums') {
      this.setTrackChannel(track, GM_DRUM_CHANNEL);
      return;
    } else if (hit.control === 'bank') {
      if (isDrumTrack(track)) {
        const available = this.game?.audio?.listAvailableDrumKits?.();
        const kits = Array.isArray(available) && available.length ? available : GM_DRUM_KITS;
        if (!kits.length) return;
        const currentIndex = Math.max(0, kits.findIndex((kit) =>
          kit.program === track.program && kit.bankMSB === track.bankMSB && kit.bankLSB === track.bankLSB));
        const nextIndex = (currentIndex + 1) % kits.length;
        const nextKit = kits[nextIndex];
        track.bankMSB = nextKit.bankMSB;
        track.bankLSB = nextKit.bankLSB;
        track.program = nextKit.program;
        this.persist({ commitHistory: true });
        return;
      }
      const current = `${track.bankMSB},${track.bankLSB}`;
      const nextBank = await openTextInputOverlay({
        title: 'Set MIDI Bank',
        label: 'Enter bank MSB,LSB (0-127,0-127)',
        initialValue: current,
        inputType: 'text'
      });
      if (nextBank) {
        const [msbRaw, lsbRaw] = nextBank.split(',').map((value) => Number.parseInt(value.trim(), 10));
        if (Number.isInteger(msbRaw) && Number.isInteger(lsbRaw) && msbRaw >= 0 && msbRaw <= 127 && lsbRaw >= 0 && lsbRaw <= 127) {
          track.bankMSB = msbRaw;
          track.bankLSB = lsbRaw;
        } else {
          this.showEditorMessage('Bank values must be 0-127.');
        }
      }
      this.persist({ commitHistory: true });
      return;
    } else if (hit.control === 'name') {
      const nextName = await openTextInputOverlay({
        title: 'Track Name',
        label: 'Track name?',
        initialValue: track.name,
        inputType: 'text'
      });
      if (nextName) track.name = nextName;
    } else if (hit.control === 'volume') {
      this.draggingTrackControl = hit;
      this.updateTrackControl(pointerX, pointerY);
    } else if (hit.control === 'pan') {
      this.draggingTrackControl = hit;
      this.updateTrackControl(pointerX, pointerY);
    }
    this.persist({ commitHistory: true });
  }

  getSongTickFromX(x, bounds) {
    if (!this.songTimelineBounds) {
      const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
      const tick = ratio * this.getSongTimelineTicks();
      return this.snapTick(tick);
    }
    const { originX, cellWidth, timelineTicks } = this.songTimelineBounds;
    const tick = clamp((x - originX) / cellWidth, 0, timelineTicks);
    return this.snapTick(tick);
  }

  finalizeSongSelection() {
    if (!this.songSelection?.active) return;
    const minTicks = this.ticksPerBeat;
    if (this.songSelection.endTick === this.songSelection.startTick) {
      this.songSelection.endTick = this.songSelection.startTick + minTicks;
    }
    const totalTicks = this.getSongTimelineTicks();
    this.songSelection.startTick = clamp(this.songSelection.startTick, 0, totalTicks);
    this.songSelection.endTick = clamp(this.songSelection.endTick, 0, totalTicks);
    const trackTotal = this.song?.tracks?.length ?? 0;
    const maxTrack = Math.max(0, trackTotal - 1);
    this.songSelection.trackStartIndex = clamp(this.songSelection.trackStartIndex ?? this.songSelection.trackIndex ?? 0, 0, maxTrack);
    this.songSelection.trackEndIndex = clamp(this.songSelection.trackEndIndex ?? this.songSelection.trackIndex ?? 0, 0, maxTrack);
    this.songSelection.trackIndex = clamp(this.songSelection.trackIndex ?? this.songSelection.trackStartIndex ?? 0, 0, maxTrack);
    // Song actions now live in the bottom rail; keep selection without opening the floating context menu.
    this.songSelectionMenu.open = false;
    this.songSelectionMenu.bounds = [];
    this.songSelectionMenu.x = this.lastPointer.x;
    this.songSelectionMenu.y = this.lastPointer.y;
    if (this.songClonePaintTool.active) {
      const range = this.getSongSelectionRange();
      if (range) {
        this.applySongClonePaintToRange(range);
      }
    }
  }

  clearSongSelection() {
    this.songSelection.active = false;
    this.songSelectionMenu.open = false;
    this.songSelectionMenu.bounds = [];
    this.songSplitTool.active = false;
    this.songShiftTool.active = false;
    if (this.songClonePaintTool?.active) {
      this.songClonePaintTool.active = false;
      this.songClonePaintTool.baseStartTick = null;
      this.songClonePaintTool.baseEndTick = null;
      this.songClonePaintTool.baseNotes = [];
    }
  }

  applySongClonePaintToRange(range) {
    if (!this.songClonePaintTool.active || !range) return;
    if (this.songClonePaintTool.trackIndex !== range.trackIndex) return;
    const pattern = this.song.tracks[range.trackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!pattern) return;
    const baseStart = this.songClonePaintTool.baseStartTick;
    const baseEnd = this.songClonePaintTool.baseEndTick;
    if (!Number.isFinite(baseStart) || !Number.isFinite(baseEnd) || baseEnd <= baseStart) return;
    const baseSpan = Math.max(1, baseEnd - baseStart);
    let baseNotes = Array.isArray(this.songClonePaintTool.baseNotes)
      ? this.songClonePaintTool.baseNotes
      : [];
    if (baseNotes.length === 0) {
      baseNotes = this.collectSongClonePaintBaseNotes(pattern, baseStart, baseEnd);
      this.songClonePaintTool.baseNotes = baseNotes;
    }
    if (!baseNotes.length) return;
    const targetStart = range.startTick;
    const targetEnd = range.endTick;
    if (targetEnd <= baseEnd) return;
    const totalTicks = this.ensureTimelineForTick(targetEnd);
    const limitTicks = Math.max(totalTicks, targetEnd);
    const nextEnd = clamp(targetEnd, 0, limitTicks);
    if (this.debug?.clonePaintQA) {
      console.info('clonePaint apply', { baseStart, baseEnd, targetEnd, totalTicks, limitTicks });
    }
    const ranges = this.getPatternPartRanges(pattern, limitTicks);
    const rangeIndex = ranges.findIndex((entry) => baseStart >= entry.startTick && baseStart < entry.endTick);
    if (rangeIndex >= 0) {
      ranges[rangeIndex] = {
        startTick: ranges[rangeIndex].startTick,
        endTick: Math.max(ranges[rangeIndex].endTick, nextEnd)
      };
      pattern.partRanges = this.normalizePartRanges(ranges, limitTicks);
      pattern.partBoundaries = [];
      pattern.partRangeStart = null;
      pattern.partRangeEnd = null;
      this.refreshPatternPartRange(pattern, nextEnd);
    }
    this.splitNotesAtTick(pattern, baseEnd);
    this.splitNotesAtTick(pattern, nextEnd);
    pattern.notes = pattern.notes.filter((note) => note.startTick < baseEnd || note.startTick >= nextEnd);
    let cursor = baseEnd;
    while (cursor < nextEnd) {
      baseNotes.forEach((note) => {
        const rel = note.relStart ?? 0;
        const start = cursor + rel;
        const originalDuration = Math.max(1, note.durationTicks || this.ticksPerBeat);
        if (start >= nextEnd) return;
        const clampedStart = Math.max(start, targetStart);
        const trimLeft = clampedStart - start;
        const clampedDuration = Math.min(
          originalDuration - trimLeft,
          nextEnd - clampedStart,
          baseSpan - rel
        );
        if (clampedDuration < 1) return;
        if (clampedStart < baseEnd && cursor === baseEnd) return;
        pattern.notes.push({
          ...note,
          id: uid(),
          startTick: clampedStart,
          durationTicks: clampedDuration
        });
      });
      cursor += baseSpan;
    }
    this.persist({ commitHistory: true });
  }

  runClonePaintSanityCheck() {
    const debug = this.debug?.clonePaintQA;
    const trackIndex = Number.isInteger(this.songClonePaintTool.trackIndex)
      ? this.songClonePaintTool.trackIndex
      : this.selectedTrackIndex;
    const pattern = this.song?.tracks?.[trackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!pattern) {
      if (debug) console.warn('Clone paint sanity check skipped: missing pattern.');
      return { ok: false, reason: 'missing pattern' };
    }
    const baseStart = this.songClonePaintTool.baseStartTick ?? 0;
    const baseEnd = this.songClonePaintTool.baseEndTick ?? baseStart + this.ticksPerBeat;
    const targetEnd = baseEnd + this.ticksPerBeat * 8;
    const totalTicks = this.ensureTimelineForTick(targetEnd);
    const limitTicks = Math.max(totalTicks, targetEnd);
    const ranges = this.getPatternPartRanges(pattern, limitTicks);
    const expanded = ranges.some((entry) => entry.startTick <= baseStart && entry.endTick >= targetEnd);
    const notesExist = pattern.notes.some((note) => note.startTick >= baseEnd && note.startTick < targetEnd);
    const ok = expanded && notesExist;
    if (debug) console.info('Clone paint sanity check result:', { ok, expanded, notesExist });
    return { ok, expanded, notesExist, targetEnd };
  }

  collectSongClonePaintBaseNotes(pattern, baseStart, baseEnd) {
    if (!pattern || !Array.isArray(pattern.notes)) return [];
    return pattern.notes
      .filter((note) => note.startTick >= baseStart && note.startTick < baseEnd)
      .map((note) => ({
        relStart: note.startTick - baseStart,
        durationTicks: Math.min(
          note.durationTicks,
          Math.max(1, baseEnd - note.startTick)
        ),
        pitch: note.pitch,
        velocity: note.velocity
      }))
      .filter((note) => note.durationTicks > 0);
  }

  applySongSelectionMove(dragState) {
    if (!dragState?.originalRange || !Array.isArray(dragState.originalNotesByTrack)) return;
    const totalTicks = this.getSongTimelineTicks();
    const offset = dragState.targetStartTick - dragState.originalRange.startTick;
    const trackCount = dragState.originalRange.trackCount || 1;
    const maxStartTrack = Math.max(0, this.song.tracks.length - trackCount);
    const targetStartTrackIndex = clamp(dragState.targetTrackIndex, 0, maxStartTrack);
    dragState.originalNotesByTrack.forEach((entry) => {
      const originTrackIndex = entry.trackIndex;
      const targetTrackIndex = clamp(
        targetStartTrackIndex + (originTrackIndex - dragState.originalRange.trackStartIndex),
        0,
        this.song.tracks.length - 1
      );
      const originTrack = this.song.tracks[originTrackIndex];
      const targetTrack = this.song.tracks[targetTrackIndex];
      const originPattern = originTrack?.patterns?.[this.selectedPatternIndex];
      const targetPattern = targetTrack?.patterns?.[this.selectedPatternIndex];
      if (!originPattern || !targetPattern) return;
      const noteIds = new Set(entry.notes.map((note) => note.id));
      if (originPattern === targetPattern && originTrackIndex === targetTrackIndex) {
        originPattern.notes = originPattern.notes.map((note) => {
          if (!noteIds.has(note.id)) return note;
          return {
            ...note,
            startTick: clamp(note.startTick + offset, 0, totalTicks)
          };
        });
      } else {
        originPattern.notes = originPattern.notes.filter((note) => !noteIds.has(note.id));
        entry.notes.forEach((note) => {
          targetPattern.notes.push({
            ...note,
            startTick: clamp(note.startTick + offset, 0, totalTicks)
          });
        });
      }
    });
    this.songSelection = {
      active: true,
      trackIndex: targetStartTrackIndex,
      trackStartIndex: targetStartTrackIndex,
      trackEndIndex: targetStartTrackIndex + trackCount - 1,
      startTick: dragState.targetStartTick,
      endTick: dragState.targetStartTick + dragState.originalRange.durationTicks
    };
    this.selectedTrackIndex = targetStartTrackIndex;
    this.persist({ commitHistory: true });
    this.finalizeSongSelection();
  }

  getSongMixAutomationType() {
    return this.songMixControlMode === 'pan' ? 'pan' : 'padding';
  }

  jumpSongMixKeyframe(direction) {
    if (this.activeTab !== 'song') return;
    const track = this.getActiveTrack();
    if (!track) return;
    const type = this.getSongMixAutomationType();
    const frames = track.automation?.[type] || [];
    if (!frames.length) return;
    const sorted = [...frames].sort((a, b) => a.tick - b.tick);
    const threshold = this.ticksPerBeat / 8;
    const currentTick = this.snapTick(this.playheadTick);
    let target = null;
    if (direction < 0) {
      target = [...sorted].reverse().find((frame) => frame.tick < currentTick - threshold) || sorted[sorted.length - 1];
    } else {
      target = sorted.find((frame) => frame.tick > currentTick + threshold) || sorted[0];
    }
    if (!target) return;
    this.playheadTick = clamp(target.tick, 0, this.getSongTimelineTicks());
    this.resyncPlaybackClock(this.playheadTick);
  }

  addSongAutomationKeyframe(track, type, tick, value, options = {}) {
    if (!track) return;
    if (!track.automation) {
      track.automation = { pan: [], padding: [] };
    }
    const frames = track.automation[type] || [];
    const exactTick = options.exactTick === true;
    const existing = exactTick
      ? frames.find((frame) => frame.tick === tick)
      : frames.find((frame) => Math.abs(frame.tick - tick) <= this.ticksPerBeat / 2);
    if (existing) {
      existing.value = value;
    } else {
      frames.push({ tick, value });
    }
    frames.sort((a, b) => a.tick - b.tick);
    track.automation[type] = frames;
    const commitHistory = options.commitHistory !== false;
    this.persist({ commitHistory });
  }

  removeSongAutomationKeyframe(track, type, tick) {
    if (!track?.automation?.[type]) return;
    const frames = track.automation[type];
    const threshold = this.ticksPerBeat / 2;
    const index = frames.findIndex((frame) => Math.abs(frame.tick - tick) <= threshold);
    if (index < 0) return;
    frames.splice(index, 1);
    track.automation[type] = frames;
    this.persist({ commitHistory: true });
  }

  getSongSelectionNotes(pattern, range) {
    if (!pattern || !range) return [];
    return pattern.notes.filter((note) => note.startTick >= range.startTick && note.startTick < range.endTick);
  }

  getSongNotesOverlapping(pattern, range) {
    if (!pattern || !range) return [];
    return pattern.notes.filter((note) => (
      note.startTick < range.endTick && (note.startTick + note.durationTicks) > range.startTick
    ));
  }

  shiftNotesAfterTick(pattern, tick, deltaTicks) {
    pattern.notes.forEach((note) => {
      if (note.startTick >= tick) {
        note.startTick = Math.max(0, note.startTick + deltaTicks);
      }
    });
  }

  splitNotesAtTick(pattern, tick) {
    if (!pattern?.notes?.length) return 0;
    const newNotes = [];
    pattern.notes.forEach((note) => {
      const endTick = note.startTick + note.durationTicks;
      if (note.startTick < tick && endTick > tick) {
        const firstDuration = tick - note.startTick;
        const secondDuration = endTick - tick;
        if (firstDuration < 1 || secondDuration < 1) return;
        note.durationTicks = firstDuration;
        newNotes.push({
          ...note,
          id: uid(),
          startTick: tick,
          durationTicks: secondDuration
        });
      }
    });
    if (newNotes.length) {
      pattern.notes.push(...newNotes);
    }
    return newNotes.length;
  }

  splitSongTracksAtTicks(tracks, ticks) {
    if (!Array.isArray(tracks) || !tracks.length) return 0;
    const sortedTicks = [...new Set(
      ticks
        .filter((tick) => Number.isFinite(tick))
        .map((tick) => Math.max(0, Math.round(tick)))
    )].sort((a, b) => a - b);
    if (!sortedTicks.length) return 0;
    let splitCount = 0;
    tracks.forEach((entry) => {
      sortedTicks.forEach((tick) => {
        splitCount += this.splitNotesAtTick(entry.pattern, tick);
      });
    });
    return splitCount;
  }


  getPatternPartBoundaries(pattern, totalTicks) {
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ranges = this.getPatternPartRanges(pattern, limit);
    if (!ranges.length) return [0, limit];
    const boundaries = [];
    ranges.forEach((range) => {
      boundaries.push(range.startTick, range.endTick);
    });
    return [...new Set(boundaries)].sort((a, b) => a - b);
  }

  getPatternPartRangeBounds(pattern, totalTicks) {
    if (!pattern) return null;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const rangeStart = Number.isFinite(pattern.partRangeStart) ? pattern.partRangeStart : null;
    const rangeEnd = Number.isFinite(pattern.partRangeEnd) ? pattern.partRangeEnd : null;
    if (Number.isFinite(rangeStart) || Number.isFinite(rangeEnd)) {
      const startTick = clamp(Math.round(rangeStart ?? 0), 0, Math.max(0, limit - 1));
      const endTick = clamp(Math.round(rangeEnd ?? limit), startTick + 1, limit);
      return { startTick, endTick };
    }
    const hasExplicitParts = Array.isArray(pattern.partBoundaries) && pattern.partBoundaries.length > 0;
    if (hasExplicitParts) {
      return { startTick: 0, endTick: limit };
    }
    const implicit = this.getImplicitPatternPartRange(pattern, limit);
    return implicit || { startTick: 0, endTick: limit };
  }

  normalizePartRanges(ranges, totalTicks) {
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const sorted = ranges
      .filter((range) => range && Number.isFinite(range.startTick) && Number.isFinite(range.endTick))
      .map((range) => {
        const startTick = clamp(Math.round(range.startTick), 0, Math.max(0, limit - 1));
        const endTick = clamp(Math.round(range.endTick), startTick + 1, limit);
        return { startTick, endTick };
      })
      .filter((range) => range.endTick > range.startTick)
      .sort((a, b) => a.startTick - b.startTick);
    const merged = [];
    sorted.forEach((range) => {
      const last = merged[merged.length - 1];
      if (last && range.startTick < last.endTick) {
        last.endTick = Math.max(last.endTick, range.endTick);
      } else {
        merged.push({ ...range });
      }
    });
    return merged;
  }

  appendOrphanNotesToPartRanges(pattern, ranges, totalTicks) {
    if (!pattern || !Array.isArray(pattern.notes) || pattern.notes.length === 0 || !Array.isArray(ranges) || ranges.length === 0) {
      return ranges;
    }
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const repaired = ranges.map((range) => ({ ...range }));
    let leadRange = null;
    const sortedNotes = [...pattern.notes]
      .filter((note) => note && Number.isFinite(note.startTick))
      .sort((a, b) => a.startTick - b.startTick);

    sortedNotes.forEach((note) => {
      const noteStart = clamp(Math.floor(note.startTick), 0, Math.max(0, limit - 1));
      const duration = Math.max(1, Math.ceil(note.durationTicks || this.ticksPerBeat || 1));
      const noteEnd = clamp(noteStart + duration, noteStart + 1, limit);
      const containingIndex = repaired.findIndex((range) => noteStart >= range.startTick && noteStart < range.endTick);
      if (containingIndex >= 0) {
        repaired[containingIndex].endTick = Math.max(repaired[containingIndex].endTick, noteEnd);
        return;
      }

      let previousIndex = -1;
      for (let index = 0; index < repaired.length; index += 1) {
        if (repaired[index].startTick <= noteStart) {
          previousIndex = index;
        } else {
          break;
        }
      }

      if (previousIndex >= 0) {
        repaired[previousIndex].endTick = Math.max(repaired[previousIndex].endTick, noteEnd);
        return;
      }

      if (!leadRange) {
        leadRange = { startTick: noteStart, endTick: noteEnd };
      } else {
        leadRange.startTick = Math.min(leadRange.startTick, noteStart);
        leadRange.endTick = Math.max(leadRange.endTick, noteEnd);
      }
    });

    return leadRange ? [leadRange, ...repaired] : repaired;
  }

  getPatternPartRanges(pattern, totalTicks) {
    if (!pattern) return [];
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
      const normalized = this.normalizePartRanges(pattern.partRanges, limit);
      return this.normalizePartRanges(this.appendOrphanNotesToPartRanges(pattern, normalized, limit), limit);
    }
    if (Array.isArray(pattern.partBoundaries) && pattern.partBoundaries.length > 0) {
      const bounds = this.getPatternPartRangeBounds(pattern, limit);
      if (!bounds) return [];
      const startTick = clamp(Math.round(bounds.startTick), 0, Math.max(0, limit - 1));
      const endTick = clamp(Math.round(bounds.endTick), startTick + 1, limit);
      const inner = pattern.partBoundaries
        .filter((tick) => Number.isFinite(tick))
        .map((tick) => clamp(Math.round(tick), startTick + 1, endTick - 1))
        .filter((tick) => tick > startTick && tick < endTick);
      const boundaries = [...new Set([startTick, ...inner, endTick])].sort((a, b) => a - b);
      const ranges = [];
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        ranges.push({ startTick: boundaries[i], endTick: boundaries[i + 1] });
      }
      return this.normalizePartRanges(ranges, limit);
    }
    const implicit = this.getImplicitPatternPartRange(pattern, limit);
    return implicit ? [implicit] : [];
  }

  getImplicitPatternPartRange(pattern, totalTicks) {
    if (!pattern || !Array.isArray(pattern.notes) || pattern.notes.length === 0) return null;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ticksPerBar = this.getTicksPerBar();
    let minStart = Infinity;
    let maxEnd = 0;
    pattern.notes.forEach((note) => {
      minStart = Math.min(minStart, note.startTick);
      const endTick = note.startTick + Math.max(1, note.durationTicks || this.ticksPerBeat);
      maxEnd = Math.max(maxEnd, endTick);
    });
    if (!Number.isFinite(minStart)) return null;
    const startTick = clamp(Math.floor(minStart), 0, Math.max(0, limit - 1));
    const inferredEnd = clamp(Math.ceil(maxEnd / ticksPerBar) * ticksPerBar, startTick + 1, limit);
    return {
      startTick,
      endTick: inferredEnd
    };
  }

  refreshPatternPartRange(pattern, totalTicks) {
    if (!pattern) return;
    if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
      const ranges = this.normalizePartRanges(pattern.partRanges, totalTicks);
      if (!ranges.length) {
        pattern.partRanges = [];
        return;
      }
      if (Array.isArray(pattern.notes) && pattern.notes.length > 0) {
        const trimmed = ranges.filter((range) => pattern.notes.some((note) => {
          const noteStart = note.startTick;
          const noteEnd = note.startTick + Math.max(1, note.durationTicks || this.ticksPerBeat);
          return noteEnd > range.startTick && noteStart < range.endTick;
        }));
        pattern.partRanges = trimmed.length ? trimmed : ranges;
      } else {
        pattern.partRanges = [];
      }
      return;
    }
    const hasExplicitParts = Array.isArray(pattern.partBoundaries) && pattern.partBoundaries.length > 0;
    const hasExplicitRange = Number.isFinite(pattern.partRangeStart) || Number.isFinite(pattern.partRangeEnd);
    if (!hasExplicitParts && !hasExplicitRange) return;
    const implicit = this.getImplicitPatternPartRange(pattern, totalTicks);
    if (!implicit) {
      pattern.partBoundaries = [];
      pattern.partRangeStart = null;
      pattern.partRangeEnd = null;
      return;
    }
    pattern.partRangeStart = implicit.startTick;
    pattern.partRangeEnd = implicit.endTick;
    if (Array.isArray(pattern.partBoundaries)) {
      pattern.partBoundaries = pattern.partBoundaries
        .filter((tick) => Number.isFinite(tick))
        .map((tick) => clamp(Math.round(tick), implicit.startTick + 1, implicit.endTick - 1))
        .filter((tick) => tick > implicit.startTick && tick < implicit.endTick);
      pattern.partBoundaries = [...new Set(pattern.partBoundaries)].sort((a, b) => a - b);
    }
  }

  splitPatternPartsAtTicks(pattern, ticks, totalTicks) {
    if (!pattern) return 0;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ranges = this.getPatternPartRanges(pattern, limit);
    if (!ranges.length) return 0;
    let added = 0;
    ticks.forEach((tick) => {
      if (!Number.isFinite(tick)) return;
      const nextTick = clamp(Math.round(tick), 0, limit);
      const rangeIndex = ranges.findIndex((range) => nextTick > range.startTick && nextTick < range.endTick);
      if (rangeIndex === -1) return;
      const target = ranges[rangeIndex];
      const left = { startTick: target.startTick, endTick: nextTick };
      const right = { startTick: nextTick, endTick: target.endTick };
      if (left.endTick - left.startTick < 1 || right.endTick - right.startTick < 1) return;
      ranges.splice(rangeIndex, 1, left, right);
      added += 1;
    });
    pattern.partRanges = this.normalizePartRanges(ranges, limit);
    pattern.partBoundaries = [];
    pattern.partRangeStart = null;
    pattern.partRangeEnd = null;
    return added;
  }

  splitSongTrackPartsAtTicks(tracks, ticks, totalTicks) {
    if (!Array.isArray(tracks) || !tracks.length) return 0;
    return tracks.reduce((sum, entry) => sum + this.splitPatternPartsAtTicks(entry.pattern, ticks, totalTicks), 0);
  }

  mergeSongTrackPartsInRange(tracks, range, totalTicks) {
    if (!Array.isArray(tracks) || !tracks.length || !range) return 0;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    let merged = 0;
    tracks.forEach((entry) => {
      const pattern = entry?.pattern;
      if (!pattern) return;
      if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
        const ranges = this.normalizePartRanges(pattern.partRanges, limit);
        const next = ranges.filter((part) => part.endTick <= range.startTick || part.startTick >= range.endTick);
        if (next.length !== ranges.length) {
          pattern.partRanges = next;
          merged += 1;
        }
        return;
      }
      const existing = Array.isArray(pattern.partBoundaries) ? pattern.partBoundaries : [];
      const next = existing.filter((tick) => tick <= range.startTick || tick >= range.endTick)
        .map((tick) => clamp(Math.round(tick), 1, limit - 1));
      if (next.length !== existing.length) {
        pattern.partBoundaries = [...new Set(next)].sort((a, b) => a - b);
        merged += 1;
      }
    });
    return merged;
  }

  mergeSongTrackPartsAtBoundary(tracks, boundaryTick, totalTicks) {
    if (!Array.isArray(tracks) || !tracks.length || !Number.isFinite(boundaryTick)) return 0;
    const limit = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    if (limit <= 1) return 0;
    const boundary = clamp(Math.round(boundaryTick), 1, limit - 1);
    if (boundary <= 0 || boundary >= limit) return 0;
    let merged = 0;
    tracks.forEach((entry) => {
      const pattern = entry?.pattern;
      if (!pattern) return;
      if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0) {
        const ranges = this.normalizePartRanges(pattern.partRanges, limit);
        if (ranges.length < 2) return;
        let leftIndex = ranges.findIndex((range, index) => (
          index < ranges.length - 1
            && range.endTick === boundary
            && ranges[index + 1].startTick === boundary
        ));
        if (leftIndex === -1) {
          leftIndex = ranges.findIndex((range, index) => (
            index < ranges.length - 1
              && boundary >= range.endTick
              && boundary <= ranges[index + 1].startTick
          ));
        }
        if (leftIndex === -1) {
          let closestDistance = Number.POSITIVE_INFINITY;
          for (let index = 0; index < ranges.length - 1; index += 1) {
            const leftGap = Math.abs(boundary - ranges[index].endTick);
            const rightGap = Math.abs(boundary - ranges[index + 1].startTick);
            const distance = Math.min(leftGap, rightGap);
            if (distance < closestDistance) {
              closestDistance = distance;
              leftIndex = index;
            }
          }
        }
        if (leftIndex === -1 || leftIndex >= ranges.length - 1) return;
        const rightIndex = leftIndex + 1;
        const mergedRange = {
          startTick: ranges[leftIndex].startTick,
          endTick: ranges[rightIndex].endTick
        };
        ranges.splice(leftIndex, 2, mergedRange);
        pattern.partRanges = ranges;
        merged += 1;
        return;
      }
      const existing = Array.isArray(pattern.partBoundaries) ? pattern.partBoundaries : [];
      const normalized = existing
        .map((tick) => clamp(Math.round(tick), 1, limit - 1));
      if (!normalized.length) return;
      let dropBoundary = boundary;
      if (!normalized.includes(boundary)) {
        dropBoundary = normalized.reduce((closest, tick) => (
          Math.abs(tick - boundary) < Math.abs(closest - boundary) ? tick : closest
        ), normalized[0]);
      }
      const next = normalized.filter((tick) => tick !== dropBoundary);
      if (next.length !== normalized.length) {
        pattern.partBoundaries = [...new Set(next)].sort((a, b) => a - b);
        merged += 1;
      }
    });
    return merged;
  }

  startSongSplitTool(range) {
    if (!range) return;
    const fallbackTick = range.startTick + Math.floor(range.durationTicks / 2);
    const pointerX = Number.isFinite(this.songSelectionMenu.x)
      ? this.songSelectionMenu.x
      : this.lastPointer.x;
    const pointerTick = this.songTimelineBounds
      ? this.getSongTickFromX(pointerX, this.songTimelineBounds)
      : fallbackTick;
    const splitTick = clamp(pointerTick, range.startTick + 1, range.endTick - 1);
    this.songSplitTool.active = true;
    this.songSplitTool.tick = splitTick;
    this.songSelectionMenu.open = false;
  }

  applySongSplitTool() {
    const range = this.getSongSelectionRange();
    if (!range || !this.songSplitTool.active) return;
    const tracks = range.trackIndices.map((trackIndex) => ({
      trackIndex,
      track: this.song.tracks[trackIndex],
      pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
    })).filter((entry) => entry.track && entry.pattern);
    if (!tracks.length) return;
    const totalTicks = this.getSongTimelineTicks();
    const splitTick = clamp(Math.round(this.songSplitTool.tick), range.startTick + 1, range.endTick - 1);
    this.splitSongTrackPartsAtTicks(tracks, [splitTick], totalTicks);
    this.splitSongTracksAtTicks(tracks, [splitTick]);
    this.songSelection.startTick = range.startTick;
    this.songSelection.endTick = splitTick;
    this.songSplitTool.active = false;
    this.persist({ commitHistory: true });
  }

  applySongShiftTool() {
    const range = this.getSongSelectionRange();
    if (!range || !this.songShiftTool.active) return;
    const delta = clamp(Math.round(this.songShiftTool.semitones), -12, 12);
    if (!delta) {
      this.songShiftTool.active = false;
      return;
    }
    const tracks = range.trackIndices.map((trackIndex) => ({
      trackIndex,
      track: this.song.tracks[trackIndex],
      pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
    })).filter((entry) => entry.track && entry.pattern);
    tracks.forEach((entry) => {
      if (isDrumTrack(entry.track)) return;
      entry.pattern.notes.forEach((note) => {
        if (note.startTick >= range.startTick && note.startTick < range.endTick) {
          note.pitch = clamp(note.pitch + delta, 0, 127);
        }
      });
    });
    this.songShiftTool.active = false;
    this.persist({ commitHistory: true });
  }


  getPatternPartRange(pattern, partIndex, totalTicks) {
    const ranges = this.getPatternPartRanges(pattern, totalTicks);
    if (!ranges.length) {
      return { partIndex: 0, startTick: 0, endTick: totalTicks || 1 };
    }
    const idx = clamp(partIndex, 0, Math.max(0, ranges.length - 1));
    return {
      partIndex: idx,
      startTick: ranges[idx].startTick,
      endTick: ranges[idx].endTick
    };
  }

  setPatternPartEdge(pattern, partIndex, edge, tick, totalTicks) {
    if (!pattern) return false;
    const total = Math.max(1, Math.round(totalTicks || this.getSongTimelineTicks() || 1));
    const ranges = this.getPatternPartRanges(pattern, total);
    if (!ranges.length) return false;
    const idx = clamp(partIndex, 0, Math.max(0, ranges.length - 1));
    const range = ranges[idx];
    const prev = idx > 0 ? ranges[idx - 1] : null;
    const next = idx < ranges.length - 1 ? ranges[idx + 1] : null;
    if (edge === 'start') {
      const minTick = prev ? prev.endTick + 1 : 0;
      const maxTick = range.endTick - 1;
      range.startTick = clamp(Math.round(tick), minTick, maxTick);
    } else if (edge === 'end') {
      const minTick = range.startTick + 1;
      const maxTick = next ? next.startTick - 1 : total;
      range.endTick = clamp(Math.round(tick), minTick, maxTick);
    } else {
      return false;
    }
    pattern.partRanges = this.normalizePartRanges(ranges, total);
    pattern.partBoundaries = [];
    pattern.partRangeStart = null;
    pattern.partRangeEnd = null;
    return true;
  }

  moveSongPart(sourceTrackIndex, sourcePartIndex, targetTrackIndex, targetStartTick) {
    const totalTicks = this.getSongTimelineTicks();
    const sourcePattern = this.song.tracks[sourceTrackIndex]?.patterns?.[this.selectedPatternIndex];
    const targetPattern = this.song.tracks[targetTrackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!sourcePattern || !targetPattern) return;
    const sourceRanges = this.getPatternPartRanges(sourcePattern, totalTicks);
    if (!sourceRanges.length) return;
    const sourceIndex = clamp(sourcePartIndex, 0, Math.max(0, sourceRanges.length - 1));
    const sourceRange = sourceRanges[sourceIndex];
    const duration = sourceRange.endTick - sourceRange.startTick;
    const nextStart = clamp(Math.round(targetStartTick), 0, Math.max(0, totalTicks - duration));
    const nextEnd = nextStart + duration;
    this.splitSongTracksAtTicks([
      { pattern: sourcePattern },
      { pattern: targetPattern }
    ], [sourceRange.startTick, sourceRange.endTick, nextStart, nextEnd]);

    const movedNotes = sourcePattern.notes.filter((note) => note.startTick >= sourceRange.startTick && note.startTick < sourceRange.endTick);
    sourcePattern.notes = sourcePattern.notes.filter((note) => note.startTick < sourceRange.startTick || note.startTick >= sourceRange.endTick);
    const offset = nextStart - sourceRange.startTick;
    movedNotes.forEach((note) => {
      targetPattern.notes.push({
        ...note,
        id: uid(),
        startTick: clamp(note.startTick + offset, 0, totalTicks)
      });
    });
    if (sourcePattern === targetPattern) {
      sourceRanges[sourceIndex] = { startTick: nextStart, endTick: nextEnd };
      sourcePattern.partRanges = this.normalizePartRanges(sourceRanges, totalTicks);
    } else {
      const targetRanges = this.getPatternPartRanges(targetPattern, totalTicks);
      const normalizedTargetRanges = targetRanges.length ? targetRanges : [];
      sourceRanges.splice(sourceIndex, 1);
      normalizedTargetRanges.push({ startTick: nextStart, endTick: nextEnd });
      sourcePattern.partRanges = this.normalizePartRanges(sourceRanges, totalTicks);
      targetPattern.partRanges = this.normalizePartRanges(normalizedTargetRanges, totalTicks);
    }
    sourcePattern.partBoundaries = [];
    targetPattern.partBoundaries = [];
    sourcePattern.partRangeStart = null;
    sourcePattern.partRangeEnd = null;
    targetPattern.partRangeStart = null;
    targetPattern.partRangeEnd = null;
    this.refreshPatternPartRange(sourcePattern, totalTicks);
    this.refreshPatternPartRange(targetPattern, totalTicks);
    if (this.songClonePaintTool.active) {
      const isBasePart = this.songClonePaintTool.trackIndex === sourceTrackIndex
        && this.songClonePaintTool.baseStartTick === sourceRange.startTick
        && this.songClonePaintTool.baseEndTick === sourceRange.endTick;
      if (isBasePart) {
        this.songClonePaintTool.trackIndex = targetTrackIndex;
        this.songClonePaintTool.baseStartTick = nextStart;
        this.songClonePaintTool.baseEndTick = nextEnd;
      }
    }

    const targetPartIndex = targetPattern.partRanges
      ? targetPattern.partRanges.findIndex((range) => range.startTick === nextStart && range.endTick === nextEnd)
      : -1;
    const nextPartIndex = targetPartIndex >= 0 ? targetPartIndex : 0;
    this.songSelection = {
      active: true,
      trackIndex: targetTrackIndex,
      trackStartIndex: targetTrackIndex,
      trackEndIndex: targetTrackIndex,
      startTick: nextStart,
      endTick: nextEnd
    };
    this.dragState.selectedPartIndex = nextPartIndex;
    this.selectedTrackIndex = targetTrackIndex;
    this.persist({ commitHistory: true });
  }

  resizeSongPartEdge(trackIndex, partIndex, edge, tick) {
    let totalTicks = this.getSongTimelineTicks();
    const pattern = this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex];
    if (!pattern) return;
    const clonePaintActive = this.songClonePaintTool.active
      && this.songClonePaintTool.trackIndex === trackIndex
      && Number.isFinite(this.songClonePaintTool.baseStartTick)
      && Number.isFinite(this.songClonePaintTool.baseEndTick);
    if (clonePaintActive && edge === 'end' && tick > totalTicks) {
      totalTicks = this.ensureTimelineForTick(tick);
    }
    const limitTicks = Math.max(totalTicks, tick);
    const before = this.getPatternPartRange(pattern, partIndex, limitTicks);
    const changed = this.setPatternPartEdge(pattern, partIndex, edge, tick, limitTicks);
    if (!changed) return;
    const after = this.getPatternPartRange(pattern, partIndex, limitTicks);

    if (edge === 'end') {
      if (after.endTick < before.endTick) {
        this.splitNotesAtTick(pattern, after.endTick);
        pattern.notes = pattern.notes.filter((note) => note.startTick < after.endTick || note.startTick >= before.endTick);
      }
    } else if (edge === 'start') {
      if (after.startTick > before.startTick) {
        this.splitNotesAtTick(pattern, after.startTick);
        pattern.notes = pattern.notes.filter((note) => note.startTick < before.startTick || note.startTick >= after.startTick);
      }
    }

    this.songSelection = {
      active: true,
      trackIndex,
      trackStartIndex: trackIndex,
      trackEndIndex: trackIndex,
      startTick: after.startTick,
      endTick: after.endTick
    };
    this.persist();
    this.scheduleHistoryCommit();
  }

  handleSongAction(action) {
    if (action === 'song-splice') {
      const totalTicks = this.getSongTimelineTicks();
      const splitTick = clamp(Math.round(this.playheadTick), 1, Math.max(1, totalTicks - 1));
      const range = this.getSongSelectionRange();
      let tracks = [];
      if (range) {
        tracks = range.trackIndices.map((trackIndex) => ({
          trackIndex,
          track: this.song.tracks[trackIndex],
          pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
        })).filter((entry) => entry.track && entry.pattern);
      } else {
        const track = this.song.tracks[this.selectedTrackIndex];
        const pattern = track?.patterns?.[this.selectedPatternIndex];
        if (track && pattern) {
          tracks = [{ trackIndex: this.selectedTrackIndex, track, pattern }];
        }
      }
      if (!tracks.length) return;
      const splitParts = this.splitSongTrackPartsAtTicks(tracks, [splitTick], totalTicks);
      const splitNotes = this.splitSongTracksAtTicks(tracks, [splitTick]);
      if (splitParts > 0 || splitNotes > 0) {
        this.persist({ commitHistory: true });
      }
      return;
    }

    if (action === 'song-paste') {
      const notesByTrack = this.songClipboard?.notesByTrack;
      if (!Array.isArray(notesByTrack) || notesByTrack.length === 0) return;
      const totalTicks = Math.max(1, this.getSongTimelineTicks());
      const durationTicks = Math.max(1, Math.round(this.songClipboard.durationTicks || this.ticksPerBeat));
      const expandedTicks = totalTicks + durationTicks;
      const startTick = clamp(Math.round(this.playheadTick || 0), 0, expandedTicks - 1);
      const endTick = clamp(startTick + durationTicks, startTick + 1, expandedTicks);
      const anchorTrack = Number.isInteger(this.songClipboard.anchorTrackIndex)
        ? this.songClipboard.anchorTrackIndex
        : clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
      const targetAnchorTrack = clamp(this.selectedTrackIndex, 0, this.song.tracks.length - 1);
      const pastedTracks = [];
      notesByTrack.forEach((entry) => {
        const targetTrackIndex = clamp(
          targetAnchorTrack + (entry.trackIndex - anchorTrack),
          0,
          this.song.tracks.length - 1
        );
        const targetPattern = this.song.tracks[targetTrackIndex]?.patterns?.[this.selectedPatternIndex];
        if (!targetPattern) return;
        pastedTracks.push({ trackIndex: targetTrackIndex, pattern: targetPattern });
      });
      const uniquePastedTracks = pastedTracks.filter((entry, index, list) => (
        list.findIndex((candidate) => candidate.trackIndex === entry.trackIndex) === index
      ));
      this.splitSongTrackPartsAtTicks(uniquePastedTracks, [startTick, endTick], expandedTicks);
      uniquePastedTracks.forEach((entry) => {
        const ranges = this.getPatternPartRanges(entry.pattern, expandedTicks);
        ranges.push({ startTick, endTick });
        entry.pattern.partRanges = this.normalizePartRanges(ranges, expandedTicks);
        entry.pattern.partBoundaries = [];
        entry.pattern.partRangeStart = null;
        entry.pattern.partRangeEnd = null;
      });
      notesByTrack.forEach((entry) => {
        const targetTrackIndex = clamp(
          targetAnchorTrack + (entry.trackIndex - anchorTrack),
          0,
          this.song.tracks.length - 1
        );
        const targetPattern = this.song.tracks[targetTrackIndex]?.patterns?.[this.selectedPatternIndex];
        if (!targetPattern) return;
        entry.notes.forEach((note) => {
          targetPattern.notes.push({
            ...note,
            id: uid(),
            startTick: startTick + note.startTick
          });
        });
        this.refreshPatternPartRange(targetPattern, expandedTicks);
      });
      if (uniquePastedTracks.length > 0) {
        const trackIndices = uniquePastedTracks.map((entry) => entry.trackIndex).sort((a, b) => a - b);
        this.songSelection = {
          active: true,
          trackIndex: trackIndices[0],
          trackStartIndex: trackIndices[0],
          trackEndIndex: trackIndices[trackIndices.length - 1],
          startTick,
          endTick
        };
        this.selectedTrackIndex = trackIndices[0];
      }
      this.songSelectionMenu.open = false;
      this.ensureGridCapacity(endTick);
      this.persist({ commitHistory: true });
      return;
    }

    const range = this.getSongSelectionRange();
    if (!range) return;
    const tracks = range.trackIndices.map((trackIndex) => ({
      trackIndex,
      track: this.song.tracks[trackIndex],
      pattern: this.song.tracks[trackIndex]?.patterns?.[this.selectedPatternIndex]
    })).filter((entry) => entry.track && entry.pattern);
    if (!tracks.length) return;

    if (action === 'song-copy') {
      const notesByTrack = tracks.map((entry) => ({
        trackIndex: entry.trackIndex,
        notes: this.getSongSelectionNotes(entry.pattern, range).map((note) => ({
          ...note,
          startTick: note.startTick - range.startTick
        }))
      })).filter((entry) => entry.notes.length > 0);
      this.songClipboard = {
        anchorTrackIndex: range.trackStartIndex,
        durationTicks: range.durationTicks,
        notesByTrack
      };
      return;
    }

    if (action === 'song-cut') {
      this.handleSongAction('song-copy');
      this.splitSongTracksAtTicks(tracks, [range.startTick, range.endTick]);
      tracks.forEach((entry) => {
        entry.pattern.notes = entry.pattern.notes.filter((note) => (
          note.startTick < range.startTick || note.startTick >= range.endTick
        ));
        this.refreshPatternPartRange(entry.pattern, this.getSongTimelineTicks());
      });
      this.persist({ commitHistory: true });
      return;
    }

    if (action === 'song-delete') {
      tracks.forEach((entry) => {
        const overlapping = this.getSongNotesOverlapping(entry.pattern, range);
        entry.pattern.notes = entry.pattern.notes.filter((note) => !overlapping.includes(note));
        this.refreshPatternPartRange(entry.pattern, this.getSongTimelineTicks());
      });
      this.persist({ commitHistory: true });
      return;
    }

    if (action === 'song-clone-paint') {
      const nextActive = !this.songClonePaintTool.active;
      this.songClonePaintTool.active = nextActive;
      if (nextActive) {
        const targetPattern = tracks.find((entry) => entry.trackIndex === range.trackIndex)?.pattern;
        const timelineTicks = this.getSongTimelineTicks();
        const partRanges = this.getPatternPartRanges(targetPattern, timelineTicks);
        const baseRange = partRanges.find((entry) => (
          range.startTick >= entry.startTick && range.startTick < entry.endTick
        ))
          || partRanges[0]
          || { startTick: range.startTick, endTick: range.endTick };
        const baseStart = baseRange.startTick;
        const baseEnd = baseRange.endTick;
        this.songClonePaintTool.trackIndex = range.trackIndex;
        this.songClonePaintTool.baseStartTick = baseStart;
        this.songClonePaintTool.baseEndTick = baseEnd;
        const baseNotes = this.collectSongClonePaintBaseNotes(targetPattern, baseStart, baseEnd);
        this.songClonePaintTool.baseNotes = baseNotes;
        this.applySongClonePaintToRange(range);
      } else {
        this.songClonePaintTool.trackIndex = null;
        this.songClonePaintTool.baseStartTick = null;
        this.songClonePaintTool.baseEndTick = null;
        this.songClonePaintTool.baseNotes = [];
      }
      this.songSelectionMenu.open = false;
      return;
    }

    if (action === 'song-duplicate') {
      const totalTicks = this.getSongTimelineTicks();
      const durationTicks = Math.max(1, range.durationTicks);
      const insertStart = range.endTick;
      const insertEnd = clamp(insertStart + durationTicks, 0, totalTicks + durationTicks);
      tracks.forEach((entry) => {
        const targetPattern = entry.pattern;
        if (!targetPattern) return;
        const selectionNotes = this.getSongSelectionNotes(targetPattern, range);
        selectionNotes.forEach((note) => {
          targetPattern.notes.push({
            ...note,
            id: uid(),
            startTick: note.startTick + durationTicks
          });
        });
        const ranges = this.getPatternPartRanges(targetPattern, totalTicks);
        ranges.push({ startTick: insertStart, endTick: insertEnd });
        targetPattern.partRanges = this.normalizePartRanges(ranges, totalTicks + durationTicks);
        targetPattern.partBoundaries = [];
        targetPattern.partRangeStart = null;
        targetPattern.partRangeEnd = null;
        this.refreshPatternPartRange(targetPattern, totalTicks + durationTicks);
      });
      this.ensureGridCapacity(insertEnd);
      this.songSelection.startTick = insertStart;
      this.songSelection.endTick = insertEnd;
      this.songSelectionMenu.open = false;
      this.persist({ commitHistory: true });
      return;
    }

    if (action === 'song-merge-left') {
      const totalTicks = this.getSongTimelineTicks();
      const merged = this.mergeSongTrackPartsAtBoundary(tracks, range.startTick, totalTicks);
      this.songSplitTool.active = false;
      if (merged > 0) {
        this.persist({ commitHistory: true });
      }
      return;
    }

    if (action === 'song-merge-right') {
      const totalTicks = this.getSongTimelineTicks();
      const merged = this.mergeSongTrackPartsAtBoundary(tracks, range.endTick, totalTicks);
      this.songSplitTool.active = false;
      if (merged > 0) {
        this.persist({ commitHistory: true });
      }
      return;
    }

    if (action === 'song-shift-note') {
      this.songShiftTool.active = true;
      this.songShiftTool.semitones = 0;
      this.songSelectionMenu.open = false;
      return;
    }

    if (action === 'song-loop-selection') {
      const sameLoopRange = this.song.loopEnabled
        && this.song.loopStartTick === range.startTick
        && this.song.loopEndTick === range.endTick;
      if (sameLoopRange) {
        this.song.loopEnabled = false;
      } else {
        this.setLoopStartTick(range.startTick);
        this.setLoopEndTick(range.endTick);
        this.song.loopEnabled = true;
      }
      this.persist({ commitHistory: true });
    }
  }

  handleSongBottomRailPointerDown(x, y) {
    if (this.bounds.songMixVolumeTab && this.pointInBounds(x, y, this.bounds.songMixVolumeTab)) {
      this.setSongBottomRailMode('volume');
      this.songMixControlMode = 'volume';
      return true;
    }
    if (this.bounds.songRailMusicControls && this.pointInBounds(x, y, this.bounds.songRailMusicControls)) {
      this.setSongBottomRailMode('music-controls');
      return true;
    }
    if (this.bounds.songRailEditTab && this.pointInBounds(x, y, this.bounds.songRailEditTab)) {
      this.setSongBottomRailMode('edit');
      return true;
    }
    if (this.bounds.songRailToolsTab && this.pointInBounds(x, y, this.bounds.songRailToolsTab)) {
      this.setSongBottomRailMode('tools');
      return true;
    }
    if (this.bounds.songMixPanTab && this.pointInBounds(x, y, this.bounds.songMixPanTab)) {
      this.setSongBottomRailMode('pan');
      this.songMixControlMode = 'pan';
      return true;
    }
    const songToolActionHit = (this.songBottomRailMode === 'tools' || this.songBottomRailMode === 'edit')
      ? this.bounds.songToolsActions?.find((bounds) => this.pointInBounds(x, y, bounds))
      : null;
    if (songToolActionHit) {
      this.handleSongAction(songToolActionHit.action);
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportStart
      && this.pointInBounds(x, y, this.bounds.songTransportStart)) {
      this.playheadTick = 0;
      this.resyncPlaybackClock(this.playheadTick);
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportBack
      && this.pointInBounds(x, y, this.bounds.songTransportBack)) {
      this.jumpPlayheadBars(-1);
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportPlayPause
      && this.pointInBounds(x, y, this.bounds.songTransportPlayPause)) {
      this.startTransportHold(this.bounds.songTransportPlayPause, { x, y });
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportMetronome
      && this.pointInBounds(x, y, this.bounds.songTransportMetronome)) {
      this.metronomeEnabled = !this.metronomeEnabled;
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportForward
      && this.pointInBounds(x, y, this.bounds.songTransportForward)) {
      this.jumpPlayheadBars(1);
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportEnd
      && this.pointInBounds(x, y, this.bounds.songTransportEnd)) {
      this.playheadTick = this.getSongTimelineTicks();
      this.resyncPlaybackClock(this.playheadTick);
      return true;
    }
    if (this.songBottomRailMode === 'music-controls'
      && this.bounds.songTransportLoopThis
      && this.pointInBounds(x, y, this.bounds.songTransportLoopThis)) {
      this.toggleLoopEnabled();
      return true;
    }
    return false;
  }

  setSongBottomRailMode(mode) {
    this.songBottomRailMode = mode;
    this.bounds.songToolsActions = [];
    this.bounds.songTransportRecord = null;
    this.bounds.songTransportStart = null;
    this.bounds.songTransportBack = null;
    this.bounds.songTransportPlayPause = null;
    this.bounds.songTransportMetronome = null;
    this.bounds.songTransportForward = null;
    this.bounds.songTransportEnd = null;
    this.bounds.songTransportLoopThis = null;
  }

  setTrackChannel(track, channel) {
    const nextChannel = clamp(channel, 0, 15);
    const drumTarget = isDrumTrack(track) || nextChannel === GM_DRUM_CHANNEL;
    track.channel = drumTarget ? GM_DRUM_CHANNEL : nextChannel;
    if (drumTarget) {
      this.ensureDrumTrackSettings(track);
    }
    this.preloadTrackPrograms();
    this.persist({ commitHistory: true });
  }

  updateTrackControl(x, y) {
    const hit = this.draggingTrackControl;
    if (!hit) return;
    if (hit.control === 'master-volume' || hit.control === 'master-pan') {
      const ratio = clamp((x - hit.x) / hit.w, 0, 1);
      if (hit.control === 'master-volume') {
        this.audioSettings.masterVolume = ratio;
      }
      if (hit.control === 'master-pan') {
        this.audioSettings.masterPan = clamp(ratio * 2 - 1, -1, 1);
      }
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    const track = this.song.tracks[hit.trackIndex];
    if (!track) return;
    const ratio = clamp((x - hit.x) / hit.w, 0, 1);
    if (this.activeTab === 'song' && (hit.control === 'volume' || hit.control === 'pan')) {
      const tick = this.snapTick(this.playheadTick);
      if (hit.control === 'volume') {
        this.addSongAutomationKeyframe(track, 'padding', tick, ratio, { commitHistory: false, exactTick: true });
      } else {
        this.addSongAutomationKeyframe(track, 'pan', tick, clamp(ratio * 2 - 1, -1, 1), { commitHistory: false, exactTick: true });
      }
      this.scheduleHistoryCommit();
      return;
    }
    if (hit.control === 'volume') {
      track.volume = ratio;
    }
    if (hit.control === 'pan') {
      track.pan = clamp(ratio * 2 - 1, -1, 1);
    }
    this.persist();
    this.scheduleHistoryCommit();
  }

  handleSettingsControl(control, pointer) {
    if (!control?.id) return;
    if (control.disabled) return;
    if (control.id === 'audio-volume'
      || control.id === 'audio-master-pan'
      || control.id === 'audio-latency'
      || control.id === 'audio-reverb-level') {
      this.dragState = { mode: 'slider', id: control.id, bounds: control };
      this.updateSliderValue(pointer.x, pointer.y, control.id, control);
      return;
    }
    if (control.id === 'audio-reverb-toggle') {
      this.audioSettings.reverbEnabled = !this.audioSettings.reverbEnabled;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-soundfont-toggle') {
      this.audioSettings.useSoundfont = !this.audioSettings.useSoundfont;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-soundfont-cdn') {
      const currentIndex = SOUNDFONT_CDNS.findIndex((entry) => entry.id === this.audioSettings.soundfontCdn);
      const nextIndex = (currentIndex + 1) % SOUNDFONT_CDNS.length;
      this.audioSettings.soundfontCdn = SOUNDFONT_CDNS[nextIndex].id;
      this.saveAudioSettings();
      this.applyAudioSettings();
      return;
    }
    if (control.id === 'audio-soundfont-preload') {
      const track = this.getActiveTrack();
      if (!track) return;
      this.game?.audio?.preloadSoundfontProgram?.(track.program, track.channel, track.bankMSB, track.bankLSB);
      return;
    }
    if (control.id === 'grid-preview') {
      this.previewOnEdit = !this.previewOnEdit;
      return;
    }
    if (control.id === 'grid-quantize-toggle') {
      this.quantizeEnabled = !this.quantizeEnabled;
      return;
    }
    if (control.id === 'grid-scrub') {
      this.scrubAudition = !this.scrubAudition;
      return;
    }
    if (control.id === 'grid-scale-lock') {
      this.scaleLock = !this.scaleLock;
      return;
    }
    if (control.id === 'grid-chord-mode') {
      this.setChordMode(!this.chordMode);
      return;
    }
    if (control.id === 'grid-chord-progression') {
      this.promptChordProgression();
      return;
    }
    if (control.id === 'grid-staccato') {
      this.staccatoEnabled = !this.staccatoEnabled;
      this.song.staccatoEnabled = this.staccatoEnabled;
      this.persist({ commitHistory: true });
      return;
    }
    if (control.id === 'playback-loop') {
      this.toggleLoopEnabled();
      return;
    }
    if (control.id === 'playback-metronome') {
      this.metronomeEnabled = !this.metronomeEnabled;
      return;
    }
    if (control.id === 'playback-swing') {
      this.dragState = { mode: 'slider', id: control.id, bounds: control };
      this.updateSliderValue(pointer.x, pointer.y, control.id, control);
      return;
    }
    if (control.id === 'ui-contrast') {
      this.highContrast = !this.highContrast;
      this.song.highContrast = this.highContrast;
      this.persist({ commitHistory: true });
      return;
    }
    if (control.id === 'touch-reverse-strings') {
      this.setReverseStrings(!this.reverseStrings);
      return;
    }
    if (control.id === 'touch-keyboard-octave-down') {
      this.setKeyboardStartOctave((this.song.keyboardStartOctave ?? DEFAULT_KEYBOARD_START_OCTAVE) - 1);
      return;
    }
    if (control.id === 'touch-keyboard-octave-up') {
      this.setKeyboardStartOctave((this.song.keyboardStartOctave ?? DEFAULT_KEYBOARD_START_OCTAVE) + 1);
      return;
    }
    if (control.id === 'touch-guitar-tuning') {
      this.promptStringTuning('guitar');
      return;
    }
    if (control.id === 'touch-guitar-tuning-reset') {
      this.resetStringTuning('guitar');
      return;
    }
    if (control.id === 'touch-bass-tuning') {
      this.promptStringTuning('bass');
      return;
    }
    if (control.id === 'touch-bass-tuning-reset') {
      this.resetStringTuning('bass');
      return;
    }
    if (control.id === 'virtual-device-gamepad') {
      if (this.gamepadInput.connected) {
        this.recordDevicePreference = 'gamepad';
      }
      return;
    }
    if (control.id === 'virtual-device-touch') {
      this.recordDevicePreference = 'touch';
      return;
    }
    if (control.id === 'grid-select-all') {
      const pattern = this.getActivePattern();
      if (!pattern) return;
      this.selection = new Set(pattern.notes.map((note) => note.id));
      this.openSelectionMenu(this.lastPointer.x + 12, this.lastPointer.y + 12);
      return;
    }
    if (control.id === 'grid-quantize-value') {
      this.quantizeIndex = (this.quantizeIndex + 1) % this.quantizeOptions.length;
      return;
    }
    if (control.id === 'grid-note-length') {
      this.setNoteLengthIndex(this.noteLengthIndex + 1);
      return;
    }
    if (control.id === 'grid-time-signature') {
      this.cycleTimeSignature();
      return;
    }
    if (control.id === 'grid-time-signature-beats-down') {
      this.setTimeSignature(this.song.timeSignature.beats - 1, this.song.timeSignature.unit);
      return;
    }
    if (control.id === 'grid-time-signature-beats-up') {
      this.setTimeSignature(this.song.timeSignature.beats + 1, this.song.timeSignature.unit);
      return;
    }
    if (control.id === 'grid-time-signature-unit-down') {
      const currentIndex = TIME_SIGNATURE_UNITS.indexOf(this.song.timeSignature.unit);
      const nextIndex = currentIndex <= 0 ? TIME_SIGNATURE_UNITS.length - 1 : currentIndex - 1;
      this.setTimeSignature(this.song.timeSignature.beats, TIME_SIGNATURE_UNITS[nextIndex]);
      return;
    }
    if (control.id === 'grid-time-signature-unit-up') {
      const currentIndex = TIME_SIGNATURE_UNITS.indexOf(this.song.timeSignature.unit);
      const nextIndex = currentIndex === -1
        ? 0
        : (currentIndex + 1) % TIME_SIGNATURE_UNITS.length;
      this.setTimeSignature(this.song.timeSignature.beats, TIME_SIGNATURE_UNITS[nextIndex]);
      return;
    }
    if (control.id === 'song-tempo') {
      this.dragState = { mode: 'slider', id: control.id, bounds: control };
      this.updateSliderValue(pointer.x, pointer.y, control.id, control);
    }
  }

  updateSliderValue(x, y, id, bounds) {
    if (!bounds) return;
    const ratio = clamp((x - bounds.x) / bounds.w, 0, 1);
    if (id === 'audio-volume') {
      this.audioSettings.masterVolume = ratio;
    }
    if (id === 'audio-master-pan') {
      this.audioSettings.masterPan = clamp(ratio * 2 - 1, -1, 1);
    }
    if (id === 'audio-reverb-level') {
      this.audioSettings.reverbLevel = ratio;
    }
    if (id === 'audio-latency') {
      this.audioSettings.latencyMs = Math.round(ratio * 120);
    }
    if (id === 'playback-swing') {
      this.swing = Math.round(ratio * 60);
    }
    if (id === 'song-tempo') {
      const tempo = Math.round(40 + ratio * 200);
      this.setTempo(tempo);
    }
    if (id === 'grid-zoom-x') {
      const zoomXLimits = this.getGridZoomLimitsX();
      this.setHorizontalTimelineZoom(getMidiZoomFromSliderRatio(ratio, zoomXLimits));
    }
    this.saveAudioSettings();
    this.applyAudioSettings();
  }

  handleSelectionMenuAction(action) {
    if (action === 'selection-copy') {
      this.copySelection();
      this.closeSelectionMenu();
      this.beginPastePreview();
      return;
    }
    if (action === 'selection-cut') {
      this.copySelection();
      this.deleteSelectedNotes();
      this.closeSelectionMenu();
      this.beginPastePreview();
      return;
    }
    if (action === 'selection-delete') {
      this.deleteSelectedNotes();
      this.closeSelectionMenu();
      return;
    }
    if (action === 'selection-paste') {
      this.pasteSelection();
      this.closeSelectionMenu();
      return;
    }
    if (action === 'selection-cancel') {
      this.selection.clear();
      this.closeSelectionMenu();
    }
  }

  isTrackMuted(track) {
    const soloTracks = this.song.tracks.filter((entry) => entry.solo);
    if (soloTracks.length > 0) {
      return !track.solo;
    }
    return track.mute;
  }

  async handleToolsMenu(action) {
    if (action === 'generate') {
      this.genreMenuOpen = true;
      this.toolsMenuOpen = false;
      return;
    }
    if (action === 'export-json') {
      this.exportSongJson();
    }
    if (action === 'export-midi') {
      this.exportSongMidi();
    }
    if (action === 'export-midi-zip') {
      this.exportSongMidiZip();
    }
    if (action === 'export-wav') {
      await this.exportSongWav();
    }
    if (action === 'import') {
      await this.importSong();
    }
    if (action === 'qa') {
      this.qaOverlayOpen = true;
      this.toolsMenuOpen = false;
    }
    if (action === 'demo') {
      this.loadDemoSong();
    }
    if (action === 'soundfont') {
      const currentIndex = SOUNDFONT_CDNS.findIndex((entry) => entry.id === this.audioSettings.soundfontCdn);
      const nextIndex = (currentIndex + 1) % SOUNDFONT_CDNS.length;
      this.audioSettings.soundfontCdn = SOUNDFONT_CDNS[nextIndex].id;
      this.saveAudioSettings();
      this.applyAudioSettings();
      this.toolsMenuOpen = false;
    }
    if (action === 'soundfont-reset') {
      this.audioSettings.soundfontCdn = 'vendored';
      this.saveAudioSettings();
      this.applyAudioSettings();
      this.toolsMenuOpen = false;
    }
  }

  async promptForNewSongName() {
    const fallback = this.currentDocumentRef?.name || 'new-song';
    const value = await openTextInputOverlay({
      title: 'New Song File',
      label: 'New song file name?',
      initialValue: fallback,
      inputType: 'text'
    });
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  exitToMainMenu() {
    this.game?.exitEditorToMainMenu?.('midi');
  }

  closeFileMenu() {
    this.activeTab = 'grid';
    this.fileMenuOpen = false;
  }

  async handleFileMenu(action) {
    if (String(action).startsWith('nav-')) {
      const tabId = String(action).slice(4);
      this.activateLeftRailTab(tabId);
      this.controllerMenu.resetFocus();
      return;
    }
    if (action === 'new') {
      if (!(await this.confirmDiscardChangesModal('Discard unsaved song changes?'))) return;
      const result = await openProjectBrowser({
        mode: 'saveAs',
        fixedFolder: 'music',
        initialFolder: 'music',
        title: 'New Song'
      });
      const newName = result?.name;
      if (!newName) return;
      this.stopPlayback();
      this.song = createDefaultSong();
      this.song.name = newName;
      this.ensureState();
      this.gridOffsetInitialized = false;
      this.gridZoomX = this.getDefaultGridZoomX();
      this.gridZoomY = this.getDefaultGridZoomY();
      this.gridZoomInitialized = false;
      this.playheadTick = 0;
      this.lastPlaybackTick = 0;
      this.game?.showSaveStatusModal?.('Saving...');
      this.game?.showSystemToast?.('Saving...');
      this.statusMessage = 'Saving...';
      try {
        await saveProjectFileAndConfirm('music', newName, JSON.parse(JSON.stringify(this.song)));
        this.currentDocumentRef = { folder: 'music', name: newName };
        this.lastPersistedSnapshot = JSON.stringify(this.song);
        this._dirty = false;
        this.commitHistorySnapshot();
        this.markSavedSnapshot();
        this.game?.showSaveStatusModal?.('Saved');
        setTimeout(() => this.game?.hideSaveStatusModal?.(), 1400);
        this.game?.showSystemToast?.('Saved');
        this.statusMessage = 'Saved';
      } catch (error) {
        const message = `Save failed: ${error?.message || error || 'Unknown error'}`;
        this.game?.showSaveStatusModal?.(message);
        setTimeout(() => this.game?.hideSaveStatusModal?.(), 1800);
        this.game?.showSystemToast?.(message);
        this.statusMessage = message;
        throw error;
      }
      this.resyncPlaybackClock(this.playheadTick);
      return;
    }
    if (action === 'save') {
      await this.saveSongToLibrary();
      return;
    }
    if (action === 'save-as') {
      await this.saveSongToLibrary({ forceSaveAs: true });
      return;
    }
    if (action === 'rescue-save') {
      await this.rescueSaveSong();
      return;
    }
    if (action === 'save-paint') {
      this.saveAndPaint();
      return;
    }
    if (action === 'load' || action === 'open') {
      await this.loadSongFromLibrary();
      return;
    }
    if (action === 'export-json') {
      this.exportSongJson();
      return;
    }
    if (action === 'export-midi') {
      this.exportSongMidi();
      return;
    }
    if (action === 'export-midi-zip') {
      this.exportSongMidiZip();
      return;
    }
    if (action === 'export-wav') {
      await this.exportSongWav();
      return;
    }
    if (action === 'import') {
      await this.importSong();
      return;
    }
    if (action === 'undo') {
      this.runtime.undo();
      return;
    }
    if (action === 'redo') {
      this.runtime.redo();
      return;
    }
    if (action === 'play-robtersession') {
      this.playInRobterSession();
      return;
    }
    if (action === 'settings') {
      this.activeTab = 'settings';
      return;
    }
    if (action === 'theme') {
      this.generateTheme();
      return;
    }
    if (action === 'sample') {
      if (!(await this.confirmDiscardChangesModal('Discard unsaved song changes?'))) return;
      this.loadDemoSong();
      return;
    }
    if (action === 'back-menu' || action === 'back-menu-fixed') {
      this.activeTab = 'grid';
      return;
    }
    if (action === 'close-menu' || action === 'close-menu-fixed') {
      this.closeFileMenu();
      return;
    }
    if (action === 'exit-main' || action === 'exit-main-fixed') {
      this.exitToMainMenu();
      return;
    }
    if (action === 'close') {
      this.exitToMainMenu();
    }
  }

  generateTheme() {
    const scaleOptions = SCALE_LIBRARY.map((entry) => entry.id);
    const scale = scaleOptions[Math.floor(Math.random() * scaleOptions.length)] || 'minor';
    const key = Math.floor(Math.random() * 12);
    const templates = scale === 'major'
      ? [
        [
          { root: 0, quality: 'maj' },
          { root: 5, quality: 'maj' },
          { root: 7, quality: 'maj' },
          { root: 3, quality: 'maj' }
        ],
        [
          { root: 0, quality: 'maj' },
          { root: 9, quality: 'min' },
          { root: 5, quality: 'maj' },
          { root: 7, quality: 'maj' }
        ]
      ]
      : [
        [
          { root: 0, quality: 'min' },
          { root: 5, quality: 'min' },
          { root: 7, quality: 'maj' },
          { root: 3, quality: 'maj' }
        ],
        [
          { root: 0, quality: 'min' },
          { root: 3, quality: 'maj' },
          { root: 7, quality: 'maj' },
          { root: 5, quality: 'min' }
        ]
      ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    this.song.key = key;
    this.song.scale = scale;
    this.song.progression = template.map((entry, index) => ({
      root: entry.root,
      quality: entry.quality,
      startBar: index + 1,
      lengthBars: 1
    }));
    this.persist({ commitHistory: true });
  }

  generatePattern(genre = this.selectedGenre) {
    const style = genre || 'random';
    const resolvedStyle = style === 'random'
      ? GENRE_OPTIONS[Math.floor(Math.random() * (GENRE_OPTIONS.length - 1)) + 1]?.id || 'ambient'
      : style;
    const ticksPerBar = this.getTicksPerBar();
    const loopBars = Math.max(1, this.song.loopBars || DEFAULT_GRID_BARS);
    const theme = this.buildProgressionFromLibrary(loopBars);
    this.song.progression = theme.progression;
    this.song.scale = theme.scale;
    this.song.key = 0;

    this.song.tracks.forEach((track) => {
      const pattern = track.patterns[this.selectedPatternIndex];
      if (!pattern) return;
      pattern.notes = [];
      if (isDrumTrack(track)) {
        const kick = 36;
        const snare = 38;
        const hat = 42;
        const crash = 49;
        const eighth = Math.max(1, Math.round(ticksPerBar / 8));
        for (let bar = 0; bar < loopBars; bar += 1) {
          const base = bar * ticksPerBar;
          const isFinalBar = bar === loopBars - 1;
          if (isFinalBar) {
            pattern.notes.push({ id: uid(), startTick: base, durationTicks: 2, pitch: kick, velocity: 0.95 });
            pattern.notes.push({ id: uid(), startTick: base, durationTicks: 2, pitch: crash, velocity: 0.85 });
            for (let beat = 1; beat < this.beatsPerBar; beat += 1) {
              pattern.notes.push({
                id: uid(),
                startTick: base + beat * this.ticksPerBeat,
                durationTicks: 2,
                pitch: snare,
                velocity: 0.9
              });
            }
          } else {
            pattern.notes.push({ id: uid(), startTick: base, durationTicks: 2, pitch: kick, velocity: 0.95 });
            pattern.notes.push({ id: uid(), startTick: base + this.ticksPerBeat * 2, durationTicks: 2, pitch: kick, velocity: 0.95 });
            pattern.notes.push({ id: uid(), startTick: base + this.ticksPerBeat, durationTicks: 2, pitch: snare, velocity: 0.9 });
            pattern.notes.push({ id: uid(), startTick: base + this.ticksPerBeat * 3, durationTicks: 2, pitch: snare, velocity: 0.9 });
          }
          for (let step = 0; step < this.beatsPerBar * 2; step += 1) {
            pattern.notes.push({
              id: uid(),
              startTick: base + step * eighth,
              durationTicks: 1,
              pitch: hat,
              velocity: 0.55
            });
          }
        }
        return;
      }

      const isBass = /bass/i.test(track.name || '');
      const basePitch = isBass ? 36 : resolvedStyle === 'hip-hop' ? 48 : 60;
      for (let bar = 0; bar < loopBars; bar += 1) {
        const chord = this.getChordForTick(bar * ticksPerBar);
        const chordRoot = chord?.root ?? 0;
        const chordTones = this.getChordTones({ ...chord, root: chordRoot });
        const barStart = bar * ticksPerBar;
        if (isBass) {
          const step = Math.random() > 0.5 ? this.ticksPerBeat : Math.max(1, Math.round(this.ticksPerBeat / 2));
          for (let tick = barStart; tick < barStart + ticksPerBar; tick += step) {
            pattern.notes.push({
              id: uid(),
              startTick: tick,
              durationTicks: step,
              pitch: basePitch + chordRoot,
              velocity: 0.8
            });
          }
        } else {
          const eighth = Math.max(1, Math.round(ticksPerBar / 8));
          const patternSteps = [0, 2, 4, 6, 7];
          patternSteps.forEach((stepIndex, index) => {
            const pitchClass = chordTones[index % chordTones.length] ?? chordRoot;
            pattern.notes.push({
              id: uid(),
              startTick: barStart + stepIndex * eighth,
              durationTicks: eighth,
              pitch: basePitch + pitchClass + (index > 2 ? 12 : 0),
              velocity: 0.75
            });
          });
        }
      }
    });
    this.persist({ commitHistory: true });
  }

  getExportBaseName() {
    return 'chainsaw-midi-song';
  }

  getExportKeySignature() {
    if (!Number.isFinite(this.song?.key)) return null;
    const keyLabel = KEY_LABELS[((this.song.key % 12) + 12) % 12] || 'C';
    const scale = this.song.scale === 'minor' ? 'minor' : 'major';
    return { key: keyLabel, scale };
  }



  getTrackPedalProcessing(track, pattern) {
    const sourceNotes = (pattern?.notes || []).map((note) => ({ ...note }));
    return applyPedalChain({
      notes: sourceNotes,
      cc: [],
      pedals: track?.midiPedals || [],
      track,
      songSettings: {
        ticksPerBeat: this.ticksPerBeat,
        beatsPerBar: this.beatsPerBar,
        tempo: this.song?.tempo || 120
      }
    });
  }

  insertPedalIntoSlot(slotIndex, pedalType) {
    const track = this.getActiveTrack();
    if (!track || slotIndex < 0 || slotIndex > 3) return;
    const pedal = createDefaultPedal(pedalType);
    if (!pedal) return;
    const next = normalizeMidiPedals(track.midiPedals);
    next[slotIndex] = pedal;
    track.midiPedals = sortMidiPedalsBySignalChain(next);
    const selectedIndex = track.midiPedals.findIndex((entry) => entry?.id === pedal.id);
    this.pedalUiState.selectedSlot = selectedIndex >= 0 ? selectedIndex : null;
    this.pedalUiState.pickerSlot = null;
    this.pedalUiState.pickerOpen = false;
    this.pedalUiState.editorOpen = true;
    this.pedalUiState.draftPedal = JSON.parse(JSON.stringify(pedal));
    this.persist({ commitHistory: true });
  }

  updateSelectedPedalKnob(knobKey, value) {
    const track = this.getActiveTrack();
    const slot = this.pedalUiState.selectedSlot;
    if (!track || !Number.isInteger(slot)) return;
    if (this.pedalUiState.editorOpen && this.pedalUiState.draftPedal) {
      this.pedalUiState.draftPedal = {
        ...this.pedalUiState.draftPedal,
        knobs: { ...this.pedalUiState.draftPedal.knobs, [knobKey]: value }
      };
      return;
    }
    const pedals = normalizeMidiPedals(track.midiPedals);
    const pedal = pedals[slot];
    if (!pedal) return;
    pedals[slot] = { ...pedal, knobs: { ...pedal.knobs, [knobKey]: value } };
    track.midiPedals = pedals;
    this.persist({ commitHistory: true });
  }

  openPedalEditorForSlot(slotIndex) {
    const track = this.getActiveTrack();
    const pedals = normalizeMidiPedals(track?.midiPedals);
    const pedal = pedals?.[slotIndex] || null;
    if (!pedal) return;
    this.pedalUiState.selectedSlot = slotIndex;
    this.pedalUiState.editorOpen = true;
    this.pedalUiState.pickerOpen = false;
    this.pedalUiState.draftPedal = JSON.parse(JSON.stringify(pedal));
  }

  commitPedalEditor() {
    const track = this.getActiveTrack();
    const slot = this.pedalUiState.selectedSlot;
    if (!track || !Number.isInteger(slot) || !this.pedalUiState.draftPedal) return;
    const pedals = normalizeMidiPedals(track.midiPedals);
    pedals[slot] = JSON.parse(JSON.stringify(this.pedalUiState.draftPedal));
    track.midiPedals = pedals;
    this.pedalUiState.editorOpen = false;
    this.pedalUiState.draftPedal = null;
    this.persist({ commitHistory: true });
  }

  cancelPedalEditor() {
    this.pedalUiState.editorOpen = false;
    this.pedalUiState.draftPedal = null;
  }

  deletePedalFromEditor() {
    const track = this.getActiveTrack();
    const slot = this.pedalUiState.selectedSlot;
    if (!track || !Number.isInteger(slot)) return;
    const pedals = normalizeMidiPedals(track.midiPedals);
    pedals[slot] = null;
    track.midiPedals = pedals;
    this.pedalUiState.editorOpen = false;
    this.pedalUiState.draftPedal = null;
    this.pedalUiState.selectedSlot = null;
    this.persist({ commitHistory: true });
  }

  buildExportTrackNotes(track, pattern, ticksPerSecond) {
    if (!pattern?.notes?.length) return { notes: [], cc: [] };
    const processed = this.getTrackPedalProcessing(track, pattern);
    const notes = processed.notes.map((note) => {
      const startTick = Math.max(0, note.startTick ?? 0);
      const durationTicks = Math.max(1, this.getEffectiveDurationTicks(note, track));
      const endTick = startTick + durationTicks;
      return {
        tStartSec: startTick / ticksPerSecond,
        tEndSec: endTick / ticksPerSecond,
        midi: note.pitch,
        vel: clamp(note.velocity ?? 0.8, 0.05, 1)
      };
    });
    const cc = (processed.cc || []).map((event) => ({
      controller: event.controller,
      value: event.value,
      tSec: Math.max(0, (event.tick || 0) / ticksPerSecond)
    }));
    return { notes, cc };
  }

  buildExportTracks() {
    const tempo = this.song?.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    return this.song.tracks
      .map((track, index) => {
        const pattern = track.patterns?.[this.selectedPatternIndex];
        const { notes, cc } = this.buildExportTrackNotes(track, pattern, ticksPerSecond);
        return {
          id: track.id || `track-${index + 1}`,
          name: track.name || `Track ${index + 1}`,
          channel: Number.isFinite(track.channel) ? track.channel : 0,
          program: Number.isFinite(track.program) ? track.program : 0,
          notes,
          cc
        };
      })
      .filter((track) => track.notes.length > 0);
  }

  async buildRobterSessionZip() {
    const tempo = this.song?.tempo || 120;
    const timeSignature = this.song?.timeSignature || { beats: 4, unit: 4 };
    const keySignature = this.getExportKeySignature();
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const stems = this.song.tracks
      .map((track, index) => {
        const pattern = track.patterns?.[this.selectedPatternIndex];
        const { notes, cc } = this.buildExportTrackNotes(track, pattern, ticksPerSecond);
        if (!notes.length) return null;
        const bytes = buildMidiBytes({
          notes,
          cc,
          bpm: tempo,
          timeSignature,
          keySignature,
          program: Number.isFinite(track.program) ? track.program : 0,
          channel: Number.isFinite(track.channel) ? track.channel : 0
        });
        const safeName = String(track.name || `Track ${index + 1}`).trim() || `Track ${index + 1}`;
        const sanitized = safeName.replace(/[\\/:*?"<>|]/g, '').trim() || `Track ${index + 1}`;
        const filename = `${sanitized}.mid`;
        return { filename, bytes };
      })
      .filter(Boolean);
    if (!stems.length) return null;
    return buildZipFromStems(stems);
  }

  prepareForDownload() {
    window.dispatchEvent(new CustomEvent('chainsaw-download-start'));
  }

  downloadBlob(blob, filename) {
    this.prepareForDownload();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
      window.dispatchEvent(new CustomEvent('chainsaw-download-complete'));
    }, 60000);
  }

  openDownloadReadyOverlay(blob, filename) {
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
    root.style.pointerEvents = 'none';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return new Promise((resolve) => {
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
      ].forEach((type) => {
        overlay.addEventListener(type, shieldEvent);
      });

      const panel = document.createElement('div');
      panel.className = 'shared-text-input-panel';
      panel.classList.add('multi-field');
      overlay.appendChild(panel);

      const title = document.createElement('h3');
      title.className = 'shared-text-input-title';
      title.textContent = 'WAV Ready';
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
        body.style.overflow = previousOverflow;
        body.style.touchAction = previousTouchAction;
        previousActive?.focus?.();
        resolve(downloaded);
      };

      const cleanupDownloadUrl = () => {
        window.setTimeout(() => {
          revokeDownloadUrl();
          window.dispatchEvent(new CustomEvent('chainsaw-download-complete'));
        }, 60000);
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

      let downloadStarted = false;
      const triggerDownload = () => {
        if (downloadStarted) return;
        downloadStarted = true;
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
        cleanupDownloadUrl();
        window.setTimeout(() => cleanup(true), 500);
      };

      bindOverlayActionButton(cancelBtn, () => {
        revokeDownloadUrl();
        cleanup(false);
      });
      bindOverlayActionButton(downloadBtn, triggerDownload);
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
        if (event.key === 'Enter') {
          event.preventDefault();
          triggerDownload();
        }
      });

      root.appendChild(overlay);
      overlay.focus({ preventScroll: true });
      downloadBtn.focus({ preventScroll: true });
    });
  }

  openWavExportProgressOverlay() {
    return openProgressOverlay({
      title: 'Processing WAV',
      message: 'Preparing export...'
    });
  }

  getTimestampedExportFilename(extension) {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '-');
    return `${this.getExportBaseName()}-${stamp}.${extension}`;
  }

  exportSongJson() {
    const data = JSON.stringify(this.song, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.downloadBlob(blob, `${this.getExportBaseName()}.json`);
  }

  exportSongMidi() {
    const tempo = this.song?.tempo || 120;
    const timeSignature = this.song?.timeSignature || { beats: 4, unit: 4 };
    const keySignature = this.getExportKeySignature();
    const tracks = this.buildExportTracks();
    const bytes = buildMultiTrackMidiBytes({
      tracks,
      bpm: tempo,
      timeSignature,
      keySignature
    });
    const blob = new Blob([bytes], { type: 'audio/midi' });
    this.downloadBlob(blob, `${this.getExportBaseName()}.mid`);
  }

  async exportSongMidiZip() {
    const tempo = this.song?.tempo || 120;
    const timeSignature = this.song?.timeSignature || { beats: 4, unit: 4 };
    const keySignature = this.getExportKeySignature();
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const stems = this.song.tracks
      .map((track, index) => {
        const pattern = track.patterns?.[this.selectedPatternIndex];
        const { notes, cc } = this.buildExportTrackNotes(track, pattern, ticksPerSecond);
        if (!notes.length) return null;
        const bytes = buildMidiBytes({
          notes,
          cc,
          bpm: tempo,
          timeSignature,
          keySignature,
          program: Number.isFinite(track.program) ? track.program : 0,
          channel: Number.isFinite(track.channel) ? track.channel : 0
        });
        const safeName = String(track.name || `Track ${index + 1}`).trim() || `Track ${index + 1}`;
        const sanitized = safeName.replace(/[\\/:*?"<>|]/g, '').trim() || `Track ${index + 1}`;
        const filename = `(${sanitized}).mid`;
        return { filename, bytes };
      })
      .filter(Boolean);
    if (!stems.length) return;
    const blob = await buildZipFromStems(stems);
    this.downloadBlob(blob, `${this.getExportBaseName()}-stems.zip`);
  }

  getWavProgramWaveform(program = 0) {
    const family = GM_PROGRAMS[Math.round(clamp(program, 0, GM_PROGRAMS.length - 1))]?.family || '';
    if (family === 'Bass' || family === 'Organ') return 'square';
    if (family === 'Guitar' || family === 'Strings' || family === 'Brass' || family === 'Synth Lead') return 'sawtooth';
    if (family === 'Chromatic Percussion' || family === 'Piano' || family === 'Synth Pad') return 'triangle';
    return 'sine';
  }

  createWavImpulse(ctx, duration = 1.4, decay = 2.5) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * ((1 - i / length) ** decay);
      }
    }
    return impulse;
  }

  buildWavDistortionCurve(amount = 0.6, samples = 1024) {
    const curve = new Float32Array(samples);
    const k = 5 + amount * 80;
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  createWavNoiseBuffer(ctx, duration = 0.3, type = 'noise') {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const t = i / ctx.sampleRate;
      const p = t / Math.max(duration, 0.001);
      const noise = (Math.random() * 2 - 1) * (1 - p);
      if (type === 'kick') {
        const freq = 120 * (1 - p) + 42;
        data[i] = Math.sin(2 * Math.PI * freq * t) * ((1 - p) ** 2);
      } else if (type === 'tom') {
        const freq = 220 * (1 - p) + 80;
        data[i] = Math.sin(2 * Math.PI * freq * t) * (1 - p) * 0.7 + noise * 0.18;
      } else if (type === 'hat') {
        data[i] = noise * 0.45;
      } else if (type === 'crash') {
        data[i] = noise * 0.62;
      } else {
        data[i] = noise * 0.8;
      }
    }
    return buffer;
  }

  getWavDrumType(pitch) {
    if (pitch === 35 || pitch === 36) return 'kick';
    if (pitch === 38 || pitch === 40) return 'snare';
    if (pitch >= 42 && pitch <= 46) return 'hat';
    if (pitch >= 47 && pitch <= 50) return 'tom';
    if (pitch >= 49 && pitch <= 57) return 'crash';
    return 'snare';
  }

  applyWavPedalChain(ctx, inputNode, pedals = [], when = 0, duration = 0.4) {
    let current = inputNode;
    const enabled = normalizeMidiPedals(pedals).filter((pedal) => pedal && pedal.enabled !== false);
    enabled.forEach((pedal) => {
      const knobs = pedal.knobs || {};
      if (pedal.type === 'compressor') {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -38 + clamp(knobs.threshold ?? 0.42, 0, 1) * 30;
        comp.ratio.value = 1.4 + clamp(knobs.ratio ?? 0.45, 0, 1) * 9;
        const makeup = ctx.createGain();
        makeup.gain.value = 0.72 + clamp(knobs.makeup ?? 0.32, 0, 1) * 0.45;
        current.connect(comp);
        comp.connect(makeup);
        current = makeup;
      } else if (pedal.type === 'eq') {
        const low = ctx.createBiquadFilter();
        const mid = ctx.createBiquadFilter();
        const high = ctx.createBiquadFilter();
        low.type = 'lowshelf'; low.frequency.value = 180; low.gain.value = (clamp(knobs.low ?? 0.5, 0, 1) - 0.5) * 24;
        mid.type = 'peaking'; mid.frequency.value = 1150; mid.Q.value = 0.9; mid.gain.value = (clamp(knobs.mid ?? 0.5, 0, 1) - 0.5) * 20;
        high.type = 'highshelf'; high.frequency.value = 3400; high.gain.value = (clamp(knobs.high ?? 0.5, 0, 1) - 0.5) * 24;
        current.connect(low); low.connect(mid); mid.connect(high);
        current = high;
      } else if (pedal.type === 'overdrive') {
        const pre = ctx.createGain();
        const shape = ctx.createWaveShaper();
        const tone = ctx.createBiquadFilter();
        const bite = ctx.createBiquadFilter();
        const out = ctx.createGain();
        pre.gain.value = 1 + clamp(knobs.drive ?? 0.42, 0, 1) * 3.8;
        shape.curve = this.buildWavDistortionCurve(clamp(knobs.drive ?? 0.42, 0, 1) * 0.72);
        shape.oversample = '4x';
        tone.type = 'lowpass';
        tone.frequency.value = 1200 + clamp(knobs.tone ?? 0.55, 0, 1) * 5200;
        bite.type = 'highpass';
        bite.frequency.value = 55 + clamp(knobs.bite ?? 0.4, 0, 1) * 420;
        out.gain.value = 0.34 + (1 - clamp(knobs.drive ?? 0.42, 0, 1)) * 0.28;
        current.connect(pre); pre.connect(shape); shape.connect(tone); tone.connect(bite); bite.connect(out);
        current = out;
      } else if (pedal.type === 'tape') {
        const drive = clamp(knobs.drive ?? 0.34, 0, 1);
        const toneValue = clamp(knobs.tone ?? 0.52, 0, 1);
        const wow = clamp(knobs.wow ?? 0.18, 0, 1);
        const pre = ctx.createGain();
        const shape = ctx.createWaveShaper();
        const tone = ctx.createBiquadFilter();
        const delay = ctx.createDelay(0.05);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const out = ctx.createGain();
        pre.gain.value = 1 + drive * 1.6;
        shape.curve = this.buildWavDistortionCurve(drive * 0.22);
        shape.oversample = '2x';
        tone.type = 'lowpass';
        tone.frequency.value = 3600 + toneValue * 5200;
        delay.delayTime.value = 0.012;
        lfo.frequency.value = 0.18 + wow * 1.2;
        lfoGain.gain.value = wow * 0.0028;
        out.gain.value = 0.64 + (1 - drive) * 0.12;
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start(when);
        lfo.stop(when + duration + 0.5);
        current.connect(pre); pre.connect(shape); shape.connect(tone); tone.connect(delay); delay.connect(out);
        current = out;
      } else if (pedal.type === 'reverb') {
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const convolver = ctx.createConvolver();
        const wetLowpass = ctx.createBiquadFilter();
        const wetHighpass = ctx.createBiquadFilter();
        const sum = ctx.createGain();
        const mix = clamp(knobs.mix ?? 0.34, 0, 1);
        const decay = clamp(knobs.decay ?? 0.44, 0, 1);
        dry.gain.value = 1 - mix * 0.3;
        wet.gain.value = mix * 0.42;
        wetLowpass.type = 'lowpass';
        wetLowpass.frequency.value = 2800 + (1 - decay) * 2400;
        wetHighpass.type = 'highpass';
        wetHighpass.frequency.value = 90;
        convolver.buffer = this.createWavImpulse(ctx, 0.25 + clamp(knobs.room ?? 0.45, 0, 1) * 1.8, 1.2 + decay * 4);
        current.connect(dry); current.connect(convolver); convolver.connect(wetHighpass); wetHighpass.connect(wetLowpass); wetLowpass.connect(wet); dry.connect(sum); wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'echo') {
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const delay = ctx.createDelay(1.5);
        const feedback = ctx.createGain();
        const toneLow = ctx.createBiquadFilter();
        const toneHigh = ctx.createBiquadFilter();
        const sum = ctx.createGain();
        const mix = clamp(knobs.mix ?? 0.34, 0, 1);
        const feedbackValue = clamp(knobs.feedback ?? 0.24, 0, 0.62);
        delay.delayTime.value = 0.07 + clamp(knobs.time ?? 0.32, 0, 1) * 0.46;
        feedback.gain.value = 0.1 + feedbackValue * 0.5;
        toneLow.type = 'lowpass';
        toneLow.frequency.value = 1700 + (1 - feedbackValue) * 3600;
        toneHigh.type = 'highpass';
        toneHigh.frequency.value = 90 + feedbackValue * 120;
        dry.gain.value = 1 - mix * 0.24;
        wet.gain.value = mix * 0.36;
        current.connect(dry); current.connect(delay); delay.connect(toneHigh); toneHigh.connect(toneLow); toneLow.connect(feedback); feedback.connect(delay); delay.connect(wet); dry.connect(sum); wet.connect(sum);
        current = sum;
      } else if (pedal.type === 'studioEq') {
        const highpass = ctx.createBiquadFilter();
        const warm = ctx.createBiquadFilter();
        const presence = ctx.createBiquadFilter();
        const air = ctx.createBiquadFilter();
        const out = ctx.createGain();
        highpass.type = 'highpass';
        highpass.frequency.value = 30 + clamp(knobs.lowCut ?? 0.32, 0, 1) * 170;
        warm.type = 'lowshelf';
        warm.frequency.value = 220;
        warm.gain.value = (clamp(knobs.warmth ?? 0.52, 0, 1) - 0.5) * 7;
        presence.type = 'peaking';
        presence.frequency.value = 2800;
        presence.Q.value = 0.85;
        presence.gain.value = (clamp(knobs.presence ?? 0.54, 0, 1) - 0.5) * 6;
        air.type = 'highshelf';
        air.frequency.value = 7600;
        air.gain.value = (clamp(knobs.air ?? 0.5, 0, 1) - 0.5) * 5;
        out.gain.value = 0.96;
        current.connect(highpass); highpass.connect(warm); warm.connect(presence); presence.connect(air); air.connect(out);
        current = out;
      } else if ((pedal.type === 'chorus' || pedal.type === 'phaser' || pedal.type === 'wah' || pedal.type === 'volumePhaser') && ctx.createOscillator) {
        const filter = ctx.createBiquadFilter();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        filter.type = pedal.type === 'wah' ? 'bandpass' : 'allpass';
        filter.frequency.value = pedal.type === 'wah' ? 560 : 600;
        const wahLike = pedal.type === 'wah';
        filter.Q.value = wahLike
          ? 0.55 + clamp(knobs.mix ?? 0.48, 0, 1) * 1.8
          : 1 + clamp(knobs.mix ?? knobs.depth ?? 0.5, 0, 1) * 8;
        lfo.frequency.value = wahLike
          ? 0.12 + clamp(knobs.rate ?? 0.38, 0, 1) * 1.65
          : 0.2 + clamp(knobs.rate ?? knobs.phase ?? 0.5, 0, 1) * 4;
        lfoGain.gain.value = wahLike
          ? 120 + clamp(knobs.sweep ?? 0.48, 0, 1) * 760
          : 180 + clamp(knobs.sweep ?? knobs.depth ?? 0.5, 0, 1) * 1800;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start(when);
        lfo.stop(when + duration + 0.5);
        current.connect(filter);
        current = filter;
      } else if (pedal.type === 'limiter') {
        const threshold = clamp(knobs.threshold ?? 0.58, 0, 1);
        const ceiling = clamp(knobs.ceiling ?? 0.72, 0, 1);
        const release = clamp(knobs.release ?? 0.34, 0, 1);
        const limiter = ctx.createDynamicsCompressor();
        const ceilingGain = ctx.createGain();
        limiter.threshold.value = -22 + threshold * 14;
        limiter.knee.value = 1.5;
        limiter.ratio.value = 12 + threshold * 8;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.04 + release * 0.22;
        ceilingGain.gain.value = 0.72 + ceiling * 0.22;
        current.connect(limiter);
        limiter.connect(ceilingGain);
        current = ceilingGain;
      }
    });
    if (enabled.length && ctx.createGain) {
      const outputTrim = ctx.createGain();
      outputTrim.gain.value = 0.76;
      current.connect(outputTrim);
      return outputTrim;
    }
    return current;
  }

  cloneAudioBufferToContext(ctx, sourceBuffer) {
    if (!sourceBuffer) return null;
    if (!this.wavCloneCache) this.wavCloneCache = new WeakMap();
    let ctxCache = this.wavCloneCache.get(ctx);
    if (!ctxCache) {
      ctxCache = new WeakMap();
      this.wavCloneCache.set(ctx, ctxCache);
    }
    const cached = ctxCache.get(sourceBuffer);
    if (cached) return cached;
    const targetLength = Math.max(1, Math.round(sourceBuffer.duration * ctx.sampleRate));
    const buffer = ctx.createBuffer(sourceBuffer.numberOfChannels, targetLength, ctx.sampleRate);
    const ratio = sourceBuffer.sampleRate / ctx.sampleRate;
    for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel += 1) {
      const sourceData = sourceBuffer.getChannelData(channel);
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
    ctxCache.set(sourceBuffer, buffer);
    return buffer;
  }

  scheduleWavNote(ctx, destination, event) {
    const when = Math.max(0, event.startSec);
    const duration = Math.max(0.04, event.durationSec);
    const pedals = event.pedals || [];
    const dryDestination = destination?.dry || destination;
    const reverbDestination = destination?.reverb || null;
    const audio = this.game?.audio || null;
    const fallbackInstrument = event.isDrum
      ? audio?.getFallbackDrum?.(event.pitch)
      : audio?.getFallbackInstrument?.(event.program);
    const sample = event.soundfontSample?.buffer
      ? event.soundfontSample
      : fallbackInstrument
      ? (audio?.midiSamples?.[fallbackInstrument] || audio?.midiSamples?.lead || null)
      : (audio?.midiSamples?.lead || null);
    let source;
    let input;
    let sampled = false;
    if (sample?.buffer) {
      source = ctx.createBufferSource();
      source.buffer = this.cloneAudioBufferToContext(ctx, sample.buffer);
      source.playbackRate.value = (event.isDrum || sample.isDrums) ? 1 : 2 ** ((event.pitch - sample.baseNote) / 12);
      input = source;
      sampled = true;
    } else if (event.isDrum) {
      source = ctx.createBufferSource();
      source.buffer = this.createWavNoiseBuffer(ctx, Math.min(1.2, duration + 0.2), this.getWavDrumType(event.pitch));
      input = source;
    } else {
      source = ctx.createOscillator();
      source.type = this.getWavProgramWaveform(event.program);
      source.frequency.value = 440 * (2 ** ((event.pitch - 69) / 12));
      input = source;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sampled ? 9000 : (event.isDrum ? 9000 : 1800 + clamp(event.program ?? 0, 0, 127) * 45);
    const gain = ctx.createGain();
    const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    input.connect(filter);
    audio?.applyPitchPhaserToSource?.(source, pedals, when, duration);
    const chainOutput = this.applyWavPedalChain(ctx, filter, pedals, when, duration);
    chainOutput.connect(gain);
    if (panNode) {
      panNode.pan.value = clamp(event.pan ?? 0, -1, 1);
      gain.connect(panNode);
      panNode.connect(dryDestination);
    } else {
      gain.connect(dryDestination);
    }
    if (reverbDestination) {
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.2;
      gain.connect(reverbSend);
      reverbSend.connect(reverbDestination);
    }
    const level = sampled
      ? clamp(event.volume ?? 0.7, 0, 1)
      : clamp(event.volume ?? 0.7, 0, 1) * (event.isDrum ? 0.42 : 0.26);
    const soundfontSample = Boolean(event.soundfontSample?.buffer || sample?.isSoundfont);
    const profile = getGmSustainProfile({
      program: event.program,
      channel: event.channel,
      isDrums: event.isDrum || sample?.isDrums
    });
    const effectiveDuration = profile.mode === 'oneshot'
      ? Math.min(duration, profile.maxDuration ?? duration)
      : Math.min(duration, profile.maxDuration ?? duration);
    const release = Math.max(0.01, profile.release ?? (event.isDrum ? 0.06 : 0.2));
    const attack = Math.max(0.001, profile.attack ?? (event.isDrum ? 0.004 : 0.012));
    const decay = Math.max(0.001, profile.decay ?? 0.12);
    const sustainUntil = when + Math.max(attack, effectiveDuration);
    const attackAt = when + Math.min(attack, Math.max(0.001, effectiveDuration * 0.45));
    const decayAt = Math.min(sustainUntil, attackAt + decay);
    const peak = Math.max(0.0001, level);
    const sustainLevel = Math.max(0.0001, peak * clamp(profile.sustain ?? 0.7, 0.0001, 1));
    const tailLevel = Math.max(0.0001, peak * clamp(profile.tail ?? profile.sustain ?? 0.4, 0.0001, 1));
    if (sampled && profile.loopSample !== false && !event.isDrum && !sample?.isDrums) {
      const rate = Math.max(0.0001, source.playbackRate?.value || 1);
      const audibleBufferDuration = source.buffer?.duration ? source.buffer.duration / rate : Infinity;
      if (audibleBufferDuration < effectiveDuration + release + 0.04 && source.buffer?.duration >= 0.18) {
        const bufferDuration = source.buffer.duration;
        source.loop = true;
        source.loopStart = clamp(bufferDuration * 0.45, 0.04, Math.max(0.05, bufferDuration - 0.08));
        source.loopEnd = clamp(bufferDuration * 0.88, source.loopStart + 0.04, bufferDuration);
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

  buildWavRenderEvents(options = {}) {
    const tempo = this.song?.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const loopEnabled = this.song?.loopEnabled
      && typeof this.song?.loopStartTick === 'number'
      && typeof this.song?.loopEndTick === 'number'
      && this.song.loopEndTick > this.song.loopStartTick;
    const loopCount = Math.max(1, Math.floor(options.loopCount || 1));
    const renderStartTick = loopEnabled ? this.song.loopStartTick : 0;
    const renderEndTick = loopEnabled ? this.song.loopEndTick : Infinity;
    const loopTicks = loopEnabled ? Math.max(1, this.song.loopEndTick - this.song.loopStartTick) : 0;
    const loopSeconds = loopEnabled ? loopTicks / ticksPerSecond : 0;
    const events = [];
    this.song.tracks.forEach((track) => {
      if (this.isTrackMuted(track)) return;
      const pattern = track.patterns?.[this.selectedPatternIndex];
      if (!pattern?.notes?.length) return;
      const processed = this.getTrackPedalProcessing(track, pattern);
      const isDrums = isDrumTrack(track);
      if (isDrums) this.ensureDrumTrackSettings(track);
      processed.notes.forEach((note) => {
        const startTick = Math.max(0, this.getSwingedTick(note.startTick ?? 0));
        if (startTick < renderStartTick || startTick >= renderEndTick) return;
        if (this.shouldSlurNote(track, pattern, note)) return;
        const durationTicks = this.getEffectiveDurationTicks(note, track);
        const mix = this.getTrackPlaybackMix(track, startTick);
        const pitch = isDrums ? this.coercePitchForTrack(note.pitch, track, GM_DRUM_ROWS) : note.pitch;
        const pedals = this.getPlaybackPedalsForTrack(track);
        const baseEvent = {
          startSec: (startTick - renderStartTick) / ticksPerSecond,
          durationSec: Math.max(1, durationTicks) / this.ticksPerBeat,
          pitch,
          volume: clamp((note.velocity ?? 0.8) * mix.volume, 0, 1),
          pan: clamp(mix.pan + clamp(track?._pedalPanOffset ?? 0, -1, 1), -1, 1),
          program: Number.isFinite(track.program) ? track.program : 0,
          channel: Number.isFinite(track.channel) ? track.channel : 0,
          bankMSB: Number.isFinite(track.bankMSB) ? track.bankMSB : 0,
          bankLSB: Number.isFinite(track.bankLSB) ? track.bankLSB : 0,
          isDrum: isDrums || isDrumChannel(track.channel),
          pedals
        };
        const octave = pedals.find((pedal) => pedal && pedal.enabled !== false && pedal.type === 'octave') || null;
        if (!octave) {
          events.push(baseEvent);
          return;
        }
        const up = Math.round(clamp(octave.knobs?.up ?? 0, 0, 2));
        const down = Math.round(clamp(octave.knobs?.down ?? 0, 0, 2));
        const octaveMix = clamp(octave.knobs?.mix ?? 0.75, 0, 1);
        events.push(baseEvent);
        if (up > 0) events.push({ ...baseEvent, pitch: clamp(baseEvent.pitch + up * 12, 0, 127), volume: baseEvent.volume * octaveMix * 0.75 });
        if (down > 0) events.push({ ...baseEvent, pitch: clamp(baseEvent.pitch - down * 12, 0, 127), volume: baseEvent.volume * octaveMix * 0.75 });
      });
    });
    if (loopCount <= 1) {
      return events.sort((a, b) => a.startSec - b.startSec);
    }
    const repeatSeconds = loopEnabled
      ? loopSeconds
      : Math.max(0.1, ...events.map((event) => event.startSec + event.durationSec));
    const loopedEvents = [];
    for (let repeat = 0; repeat < loopCount; repeat += 1) {
      const offset = repeat * repeatSeconds;
      events.forEach((event) => {
        loopedEvents.push({ ...event, startSec: event.startSec + offset });
      });
    }
    return loopedEvents.sort((a, b) => a.startSec - b.startSec);
  }

  prepareWavChannelData(audioBuffer, channels, options = {}) {
    const length = audioBuffer.length;
    const safetyFadeSamples = Math.min(Math.floor(audioBuffer.sampleRate * 0.006), Math.floor(length / 2));
    const fadeInSamples = Math.min(Math.max(0, Math.floor((options.fadeInSeconds || 0) * audioBuffer.sampleRate)), length);
    const fadeOutSamples = Math.min(Math.max(0, Math.floor((options.fadeOutSeconds || 0) * audioBuffer.sampleRate)), length);
    const data = Array.from({ length: channels }, (_, channel) => new Float32Array(audioBuffer.getChannelData(channel)));
    data.forEach((channelData) => {
      let sum = 0;
      for (let i = 0; i < length; i += 1) sum += channelData[i] || 0;
      const dc = sum / Math.max(1, length);
      for (let i = 0; i < length; i += 1) {
        let sample = (channelData[i] || 0) - dc;
        const inFade = Math.max(safetyFadeSamples, fadeInSamples);
        const outFade = Math.max(safetyFadeSamples, fadeOutSamples);
        if (inFade > 0 && i < inFade) sample *= i / inFade;
        if (outFade > 0 && i >= length - outFade) sample *= (length - i - 1) / outFade;
        channelData[i] = sample;
      }
    });
    let peak = 0;
    data.forEach((channelData) => {
      for (let i = 0; i < length; i += 1) {
        peak = Math.max(peak, Math.abs(channelData[i] || 0));
      }
    });
    const scale = peak > 0.98 ? 0.98 / peak : 1;
    if (scale < 1) {
      data.forEach((channelData) => {
        for (let i = 0; i < length; i += 1) {
          channelData[i] *= scale;
        }
      });
    }
    return data;
  }

  encodeWav(audioBuffer, options = {}) {
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
    const channelData = this.prepareWavChannelData(audioBuffer, channels, options);
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

  createRepeatedLoopAudioBuffer(rendered, loopSeconds, loopCount, tailSeconds = 3) {
    const channels = rendered.numberOfChannels || 1;
    const sampleRate = rendered.sampleRate;
    const loopSamples = Math.max(1, Math.round(loopSeconds * sampleRate));
    const tailSamples = Math.max(0, Math.round(tailSeconds * sampleRate));
    const sourceLoopStart = loopSamples;
    const sourceTailStart = loopSamples * 2;
    const repeatedSamples = loopSamples * Math.max(1, Math.floor(loopCount || 1));
    const totalSamples = repeatedSamples + tailSamples;
    const output = this.game?.audio?.ctx?.createBuffer
      ? this.game.audio.ctx.createBuffer(channels, totalSamples, sampleRate)
      : new AudioBuffer({ length: totalSamples, numberOfChannels: channels, sampleRate });
    for (let channel = 0; channel < channels; channel += 1) {
      const sourceData = rendered.getChannelData(channel);
      const outputData = output.getChannelData(channel);
      for (let i = 0; i < repeatedSamples; i += 1) {
        const sourceIndex = sourceLoopStart + (i % loopSamples);
        outputData[i] = sourceData[sourceIndex] || 0;
      }
      for (let i = 0; i < tailSamples; i += 1) {
        outputData[repeatedSamples + i] = sourceData[sourceTailStart + i] || 0;
      }
    }
    return output;
  }

  getWavLoopRenderInfo(options = {}) {
    const tempo = this.song?.tempo || 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const loopEnabled = this.song?.loopEnabled
      && typeof this.song?.loopStartTick === 'number'
      && typeof this.song?.loopEndTick === 'number'
      && this.song.loopEndTick > this.song.loopStartTick;
    const loopCount = Math.max(1, Math.floor(options.loopCount || 1));
    if (!loopEnabled || loopCount <= 1) {
      return { useFastLoop: false, loopSeconds: 0, loopCount };
    }
    return {
      useFastLoop: true,
      loopSeconds: (this.song.loopEndTick - this.song.loopStartTick) / ticksPerSecond,
      loopCount
    };
  }

  async attachSoundfontSamplesToWavEvents(events) {
    const audio = this.game?.audio;
    if (!audio?.getSoundfontBufferForNote) return events;
    const samplePromises = new Map();
    const getSampleKey = (event) => [
      event.pitch,
      event.program,
      event.channel,
      event.bankMSB,
      event.bankLSB
    ].join(':');
    await Promise.all(events.map(async (event) => {
      const key = getSampleKey(event);
      try {
        if (!samplePromises.has(key)) {
          samplePromises.set(key, audio.getSoundfontBufferForNote({
            pitch: event.pitch,
            program: event.program,
            channel: event.channel,
            bankMSB: event.bankMSB,
            bankLSB: event.bankLSB
          }).catch(() => null));
        }
        const sample = await samplePromises.get(key);
        if (sample?.buffer) event.soundfontSample = sample;
      } catch (error) {
        // Fallback synth path remains available per note.
      }
    }));
    return events;
  }

  parseWavExportOptionsInput(input, loopEnabled) {
    const parts = String(input || '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));
    if (loopEnabled) {
      return {
        loopCount: clamp(Math.floor(parts[0] || 1), 1, 64),
        fadeInSeconds: clamp(parts[1] || 0, 0, 120),
        fadeOutSeconds: clamp(parts[2] || 0, 0, 120)
      };
    }
    return {
      loopCount: 1,
      fadeInSeconds: clamp(parts[0] || 0, 0, 120),
      fadeOutSeconds: clamp(parts[1] || 0, 0, 120)
    };
  }

  async promptWavExportOptions() {
    const loopEnabled = this.song?.loopEnabled
      && typeof this.song?.loopStartTick === 'number'
      && typeof this.song?.loopEndTick === 'number'
      && this.song.loopEndTick > this.song.loopStartTick;
    const fields = [
      {
        id: 'loopCount',
        label: 'Repeat',
        initialValue: 1,
        min: 1,
        max: 64,
        step: 1,
        integer: true
      },
      {
        id: 'fadeInSeconds',
        label: 'Fade in seconds',
        initialValue: 0,
        min: 0,
        max: 120,
        step: 0.1
      },
      {
        id: 'fadeOutSeconds',
        label: 'Fade out seconds',
        initialValue: 0,
        min: 0,
        max: 120,
        step: 0.1
      }
    ];
    const values = await openMultiNumberInputOverlay({
      title: 'Export WAV',
      fields,
      confirmText: 'Export',
      maxWidth: 460
    });
    if (values === null) return null;
    return {
      loopCount: clamp(Math.floor(values.loopCount || 1), 1, 64),
      fadeInSeconds: clamp(values.fadeInSeconds || 0, 0, 120),
      fadeOutSeconds: clamp(values.fadeOutSeconds || 0, 0, 120)
    };
  }

  async exportSongWav() {
    let progress = null;
    try {
      const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineCtor) {
        this.showEditorMessage('WAV export is not supported by this browser.');
        return;
      }
      const exportOptions = await this.promptWavExportOptions();
      if (!exportOptions) return;
      const loopRender = this.getWavLoopRenderInfo(exportOptions);
      const renderOptions = loopRender.useFastLoop
        ? { ...exportOptions, loopCount: 2 }
        : exportOptions;
      progress = this.openWavExportProgressOverlay();
      progress.update(8, 'Collecting notes...');
      const events = this.buildWavRenderEvents(renderOptions);
      if (!events.length) {
        progress.close();
        progress = null;
        this.showEditorMessage('No notes available to export.');
        return;
      }
      this.showEditorMessage('Rendering WAV...');
      await new Promise((resolve) => setTimeout(resolve, 20));
      this.game?.audio?.ensureMidiSampler?.();
      progress.update(22, 'Loading instruments...');
      await this.attachSoundfontSamplesToWavEvents(events);
      progress.update(38, 'Building audio graph...');
      const tailSeconds = 3;
      const duration = loopRender.useFastLoop
        ? loopRender.loopSeconds * 2 + tailSeconds
        : Math.max(...events.map((event) => event.startSec + event.durationSec)) + tailSeconds;
      const sampleRate = Math.max(22050, Math.min(96000, Math.round(this.game?.audio?.ctx?.sampleRate || 44100)));
      const ctx = new OfflineCtor(2, Math.ceil(duration * sampleRate), sampleRate);
      const settings = this.audioSettings || {};
      const masterVolume = clamp(settings.masterVolume ?? this.game?.audio?.volume ?? 0.4, 0, 1);
      const masterPan = clamp(settings.masterPan ?? this.game?.audio?.masterPan ?? 0, -1, 1);
      const midiBusVolume = 0.8;
      const reverbEnabled = settings.reverbEnabled !== false;
      const reverbLevel = reverbEnabled ? clamp(settings.reverbLevel ?? this.game?.audio?.midiReverbLevel ?? 0.18, 0, 1) : 0;
      const master = ctx.createGain();
      master.gain.value = midiBusVolume;
      const globalReverbSend = ctx.createGain();
      globalReverbSend.gain.value = reverbLevel;
      const reverb = ctx.createConvolver();
      reverb.buffer = this.createWavImpulse(ctx, 1.4, 2.5);
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 8;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      const outputGain = ctx.createGain();
      const exportPlaybackTrim = 0.7;
      outputGain.gain.value = masterVolume * exportPlaybackTrim;
      const outputPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (outputPan) outputPan.pan.value = masterPan;
      master.connect(limiter);
      master.connect(globalReverbSend);
      globalReverbSend.connect(reverb);
      reverb.connect(limiter);
      limiter.connect(outputGain);
      if (outputPan) {
        outputGain.connect(outputPan);
        outputPan.connect(ctx.destination);
      } else {
        outputGain.connect(ctx.destination);
      }
      events.forEach((event) => this.scheduleWavNote(ctx, { dry: master, reverb }, event));
      progress.update(60, 'Rendering audio...');
      const renderPulse = window.setInterval(() => progress?.update(88, 'Rendering audio...'), 300);
      const rendered = await ctx.startRendering();
      window.clearInterval(renderPulse);
      progress.update(92, 'Encoding WAV...');
      const filename = this.getTimestampedExportFilename('wav');
      const exportBuffer = loopRender.useFastLoop
        ? this.createRepeatedLoopAudioBuffer(rendered, loopRender.loopSeconds, loopRender.loopCount, tailSeconds)
        : rendered;
      const blob = this.encodeWav(exportBuffer, exportOptions);
      progress.update(100, 'WAV ready.');
      await new Promise((resolve) => setTimeout(resolve, 120));
      progress.close();
      progress = null;
      const downloaded = await this.openDownloadReadyOverlay(blob, filename);
      this.showEditorMessage(downloaded ? 'WAV exported.' : 'WAV export canceled.');
    } catch (error) {
      progress?.close();
      console.error('WAV export failed', error);
      this.showEditorMessage(`WAV export failed: ${error?.message || error}`);
    }
  }

  async importSong() {
    if (!(await this.confirmDiscardChangesModal('Discard unsaved song changes?'))) return;
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  async importSongFile(file) {
    const name = file?.name || '';
    const lowerName = name.toLowerCase();
    if (lowerName.endsWith('.mid') || lowerName.endsWith('.midi')) {
      const bytes = await file.arrayBuffer();
      const midiData = parseMidi(bytes);
      const song = this.buildSongFromMidiSources([{
        label: name.replace(/\.(mid|midi)$/i, '') || 'MIDI Track',
        midiData
      }]);
      this.applyImportedSong(song);
      return;
    }
    if (lowerName.endsWith('.zip')) {
      const bytes = await file.arrayBuffer();
      const { stems } = await loadZipSongFromBytes(bytes);
      const sources = [];
      stems.forEach((stem, instrument) => {
        if (!stem?.bytes) return;
        sources.push({
          label: instrument || stem.filename?.replace(/\.mid(i)?$/i, '') || 'MIDI Stem',
          midiData: parseMidi(stem.bytes)
        });
      });
      if (sources.length === 0) {
        throw new Error('No MIDI stems found in zip.');
      }
      const song = this.buildSongFromMidiSources(sources);
      this.applyImportedSong(song);
      return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    this.applyImportedSong(data);
  }

  buildSongFromMidiSources(sources) {
    const baseSong = createDefaultSong();
    const first = sources.find((entry) => entry?.midiData) || {};
    const tempo = Number.isFinite(first.midiData?.bpm) ? first.midiData.bpm : baseSong.tempo;
    const timeSignature = first.midiData?.timeSignature || baseSong.timeSignature;
    const beatUnit = TIME_SIGNATURE_UNITS.includes(timeSignature?.unit) ? timeSignature.unit : 4;
    const ticksPerBar = this.ticksPerBeat * (4 / beatUnit) * (timeSignature?.beats || 4);
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const tracks = [];
    let maxEndTick = 0;
    let colorIndex = 0;

    const toTick = (seconds) => Math.max(0, Math.round(seconds * ticksPerSecond));
    sources.forEach((source) => {
      const midiData = source.midiData;
      if (!midiData) return;
      const trackGroups = midiData.tracks?.length
        ? midiData.tracks
        : [{
          trackIndex: 0,
          channel: midiData.notes.find((note) => Number.isFinite(note.channel))?.channel ?? 0,
          program: null,
          notes: midiData.notes
        }];
      trackGroups.forEach((group, groupIndex) => {
        if (!group?.notes?.length) return;
        const isDrum = isDrumChannel(group.channel ?? 0);
        const program = Number.isFinite(group.program) ? group.program : 0;
        const groupLabel = source.label || `Track ${tracks.length + 1}`;
        const name = trackGroups.length > 1 ? `${groupLabel} ${groupIndex + 1}` : groupLabel;
        const notes = group.notes.map((note) => {
          const startTick = toTick(note.tStartSec);
          const endTick = Math.max(startTick + 1, toTick(note.tEndSec));
          const durationTicks = Math.max(1, endTick - startTick);
          maxEndTick = Math.max(maxEndTick, endTick);
          return {
            id: uid(),
            startTick,
            durationTicks,
            pitch: isDrum ? coerceDrumPitch(note.midi, GM_DRUM_ROWS) : note.midi,
            velocity: clamp(note.vel ?? 0.8, 0.1, 1)
          };
        });
        const track = {
          id: `track-${Date.now()}-${tracks.length}`,
          name,
          channel: isDrum ? GM_DRUM_CHANNEL : (Number.isFinite(group.channel) ? group.channel : 0),
          program,
          bankMSB: isDrum ? DRUM_BANK_MSB : DEFAULT_BANK_MSB,
          bankLSB: isDrum ? DRUM_BANK_LSB : DEFAULT_BANK_LSB,
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          instrument: isDrum ? 'drums' : undefined,
          instrumentFamily: isDrum ? 'Drums' : this.getProgramFamilyLabel(program),
          color: TRACK_COLORS[colorIndex % TRACK_COLORS.length],
          patterns: [{
            id: `pattern-${uid()}`,
            bars: baseSong.loopBars,
            notes
          }]
        };
        tracks.push(track);
        colorIndex += 1;
      });
    });

    if (tracks.length === 0) {
      return baseSong;
    }

    const loopBars = Math.max(DEFAULT_GRID_BARS, Math.ceil((maxEndTick || ticksPerBar) / ticksPerBar));
    tracks.forEach((track) => {
      track.patterns.forEach((pattern) => {
        pattern.bars = loopBars;
      });
    });

    return {
      ...baseSong,
      tempo,
      timeSignature: {
        beats: timeSignature?.beats || 4,
        unit: timeSignature?.unit || 4
      },
      loopBars,
      loopStartTick: 0,
      loopEndTick: loopBars * ticksPerBar,
      loopEnabled: true,
      tracks
    };
  }

  applyImportedSong(data) {
    const validation = this.validateSong(data);
    if (!validation.valid) {
      const message = validation.error || 'Invalid song schema.';
      console.warn(message);
      this.showEditorMessage(message);
      return;
    }
    this.song = this.migrateSong(data);
    this.selectedTrackIndex = 0;
    this.selectedPatternIndex = 0;
    this.ensureState();
    this.gridOffsetInitialized = false;
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
    this.resetHistory();
    this.persist();
    this.flushPersist();
    this.markSavedSnapshot();
  }

  loadDemoSong() {
    this.song = createDemoSong();
    this.ensureState();
    this.resetHistory();
    this.gridOffsetInitialized = false;
    this.gridZoomX = this.getDefaultGridZoomX();
    this.gridZoomY = this.getDefaultGridZoomY();
    this.gridZoomInitialized = false;
    this.qaResults = [{ label: 'Demo loaded', status: 'pass' }];
    this.persist();
    this.flushPersist();
    this.markSavedSnapshot();
    if (!this.isPlaying) {
      this.togglePlayback();
    }
  }

  runQaChecks() {
    const results = [];
    const loopTicks = this.getLoopTicks();
    results.push({
      label: 'Playhead moves',
      status: this.isPlaying ? 'warn' : 'pass'
    });
    results.push({
      label: 'Loop wraps',
      status: loopTicks > 0 ? 'pass' : 'fail'
    });
    const pattern = this.getActivePattern();
    results.push({
      label: 'Notes update',
      status: pattern && Array.isArray(pattern.notes) ? 'pass' : 'fail'
    });
    const snapshot = JSON.stringify(this.song);
    this.applyImportedSong(JSON.parse(snapshot));
    const roundtrip = JSON.stringify(this.song) === snapshot;
    results.push({
      label: 'Export/import roundtrip',
      status: roundtrip ? 'pass' : 'fail'
    });
    this.qaResults = results;
  }

  getDrumRows() {
    return [...GM_DRUM_ROWS].reverse();
  }

  getDrumHitDurationTicks() {
    return Math.max(1, this.getQuantizeTicks());
  }

  getEffectiveDurationTicks(note, track = this.getActiveTrack()) {
    if (!note) return 1;
    return Math.max(1, note.durationTicks);
  }

  coercePitchForTrack(pitch, track = this.getActiveTrack(), rows = null) {
    if (!isDrumTrack(track)) return pitch;
    const drumRows = rows || this.getDrumRows();
    return coerceDrumPitch(pitch, drumRows);
  }

  getBaseVisibleRows(rows) {
    return Math.max(1, Math.min(DEFAULT_VISIBLE_ROWS, rows));
  }

  initializeGridOffset(track, rows, cellHeight) {
    if (this.gridOffsetInitialized) return;
    this.gridOffsetInitialized = true;
    if (!track || isDrumTrack(track)) {
      this.gridOffset.y = 0;
      return;
    }
    const topRow = clamp(this.getRowFromPitch(DEFAULT_GRID_TOP_PITCH), 0, Math.max(0, rows - 1));
    this.gridOffset.y = -topRow * cellHeight;
  }

  getDefaultGridZoomX() {
    const bars = Math.max(1, this.song?.loopBars || DEFAULT_GRID_BARS);
    return Math.max(1, bars / 4);
  }

  getDefaultGridZoomY() {
    return 1;
  }

  getOctaveLabel(pitch) {
    return Math.floor(pitch / 12) - 1;
  }

  getGridZoomLimits(rows) {
    const baseVisibleRows = this.getBaseVisibleRows(rows);
    const maxVisibleRows = Math.min(rows, MAX_VISIBLE_ROWS);
    const minZoom = maxVisibleRows > 0 ? baseVisibleRows / maxVisibleRows : 1;
    const maxZoom = baseVisibleRows / MIN_VISIBLE_ROWS;
    return {
      minZoom: clamp(minZoom, 0.2, 1),
      maxZoom: Math.max(1, maxZoom)
    };
  }

  getGridZoomLimitsX() {
    const bars = Math.max(1, this.song?.loopBars || DEFAULT_GRID_BARS);
    return getMidiGridZoomLimitsXForBars(bars);
  }

  getPitchRange() {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) {
      const pitches = this.getDrumRows().map((row) => row.pitch);
      return { min: Math.min(...pitches), max: Math.max(...pitches) };
    }
    return { min: 24, max: 108 };
  }

  getGridCell(x, y) {
    if (!this.gridBounds) return null;
    const { originX, originY, cellWidth, cellHeight, rows, cols } = this.gridBounds;
    const col = Math.floor((x - originX) / cellWidth);
    const row = Math.floor((y - originY) / cellHeight);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    const tick = col;
    const pitch = this.getPitchFromRow(row);
    return { tick, pitch };
  }

  getCellScreenPosition(tick, pitch) {
    if (!this.gridBounds) return null;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(pitch);
    if (row < 0) return null;
    return {
      x: originX + tick * cellWidth,
      y: originY + row * cellHeight
    };
  }

  getTickFromX(x) {
    if (!this.gridBounds) return 0;
    const { originX, cellWidth } = this.gridBounds;
    return Math.floor((x - originX) / cellWidth);
  }

  getPitchFromRow(row) {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) {
      const rows = this.getDrumRows();
      const entry = rows[row];
      return entry?.pitch ?? rows[0].pitch;
    }
    const range = this.getPitchRange();
    return range.max - row;
  }

  getRowFromPitch(pitch) {
    const track = this.getActiveTrack();
    if (isDrumTrack(track)) {
      const rows = this.getDrumRows();
      const mapped = coerceDrumPitch(pitch, rows);
      return rows.findIndex((row) => row.pitch === mapped);
    }
    const range = this.getPitchRange();
    return range.max - pitch;
  }

  isNearLoopMarker(x, marker) {
    if (!this.gridBounds) return false;
    const tick = marker === 'start' ? this.song.loopStartTick : this.song.loopEndTick;
    if (typeof tick !== 'number') return false;
    const markerX = this.gridBounds.originX + tick * this.gridBounds.cellWidth;
    const threshold = Math.max(6, this.gridBounds.cellWidth * 0.35);
    return Math.abs(x - markerX) <= threshold;
  }

  isInsideLoopRegion(x) {
    if (!this.gridBounds) return false;
    if (!this.song.loopEnabled) return false;
    if (typeof this.song.loopStartTick !== 'number' || typeof this.song.loopEndTick !== 'number') return false;
    const startX = this.gridBounds.originX + this.song.loopStartTick * this.gridBounds.cellWidth;
    const endX = this.gridBounds.originX + this.song.loopEndTick * this.gridBounds.cellWidth;
    return x > Math.min(startX, endX) && x < Math.max(startX, endX);
  }

  shiftLoopRegion(deltaTicks) {
    if (typeof this.song.loopStartTick !== 'number' || typeof this.song.loopEndTick !== 'number') return;
    const ticksPerBar = this.getTicksPerBar();
    const loopLength = Math.max(1, this.song.loopEndTick - this.song.loopStartTick);
    let nextStart = this.song.loopStartTick + deltaTicks;
    let nextEnd = nextStart + loopLength;
    if (nextEnd > this.getGridTicks()) {
      this.ensureGridCapacity(nextEnd);
    }
    const maxStart = Math.max(0, this.getGridTicks() - loopLength);
    nextStart = clamp(nextStart, 0, maxStart);
    nextEnd = nextStart + loopLength;
    this.song.loopStartTick = nextStart;
    this.song.loopEndTick = nextEnd;
    this.playheadTick = clamp(this.playheadTick, this.getLoopStartTick(), this.getLoopTicks());
    this.resyncPlaybackClock(this.playheadTick);
    this.persist({ commitHistory: true });
  }

  getNoteHitAt(x, y) {
    if (!this.gridBounds) return null;
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return null;
    const drumTrack = isDrumTrack(track);
    let handleHit = null;
    let bodyHit = null;
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      if (y < rect.y || y > rect.y + rect.h) return;
      const handleWidth = !drumTrack && this.selection.has(note.id) ? this.getNoteHandleWidth(rect) : 0;
      const edge = getMidiNoteEdgeHit(rect, x, handleWidth);
      if (edge) {
        handleHit = { note, edge };
        return;
      }
      if (x >= rect.x && x <= rect.x + rect.w) {
        bodyHit = { note, edge: null };
      }
    });
    return handleHit || bodyHit;
  }

  getNoteAtCell(tick, pitch, pointerX = null) {
    const pattern = this.getActivePattern();
    const track = this.getActiveTrack();
    if (!pattern || !track) return null;
    const drumTrack = isDrumTrack(track);
    const hit = pattern.notes.find((note) => {
      const durationTicks = this.getEffectiveDurationTicks(note, track);
      return tick >= note.startTick && tick < note.startTick + durationTicks && note.pitch === pitch;
    });
    if (!hit) return null;
    const rect = this.getNoteRect(hit);
    if (!rect) return null;
    if (drumTrack) {
      return { note: hit, edge: null };
    }
    const handleWidth = this.getNoteHandleWidth(rect);
    const cursorX = typeof pointerX === 'number' ? pointerX : this.lastPointer.x;
    return { note: hit, edge: getMidiNoteEdgeHit(rect, cursorX, handleWidth) };
  }

  getNoteHandleWidth(rect) {
    const isPortrait = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight
    });
    return getMidiNoteHandleWidth(rect, { portrait: isPortrait });
  }

  getResizeMinimumTicksForLayout() {
    return getMidiResizeMinimumTicks({
      ticksPerBar: this.getTicksPerBar(),
      noteLengthIndex: this.noteLengthIndex
    });
  }

  getNoteRect(note) {
    if (!this.gridBounds) return null;
    const track = this.getActiveTrack();
    if (!track) return null;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(note.pitch);
    if (row < 0) return null;
    const durationTicks = this.getEffectiveDurationTicks(note, track);
    return {
      x: originX + note.startTick * cellWidth,
      y: originY + row * cellHeight + 1,
      w: Math.max(cellWidth * durationTicks, cellWidth),
      h: cellHeight - 2
    };
  }

  ensureCursorVisible() {
    if (!this.gridBounds) return;
    const { x, y, w, h, originX, originY, cellWidth, cellHeight, rows, cols } = this.gridBounds;
    const row = this.getRowFromPitch(this.cursor.pitch);
    const col = clamp(this.cursor.tick, 0, cols);
    const cursorX = originX + col * cellWidth;
    const cursorY = originY + row * cellHeight;
    const margin = 24;
    if (cursorX < x + margin) {
      this.gridOffset.x += (x + margin) - cursorX;
    } else if (cursorX > x + w - margin) {
      this.gridOffset.x -= cursorX - (x + w - margin);
    }
    if (isDrumTrack(this.getActiveTrack())) {
      this.gridOffset.y = 0;
    } else if (cursorY < y + margin) {
      this.gridOffset.y += (y + margin) - cursorY;
    } else if (cursorY > y + h - margin) {
      this.gridOffset.y -= cursorY - (y + h - margin);
    }
    this.clampGridOffset(w, h, cellWidth * cols, cellHeight * rows);
    this.updateTimelineStartTickFromGrid();
  }

  pointInBounds(x, y, bounds) {
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  clampGridOffset(viewW, viewH, gridW, gridH) {
    if (!this.gridOffset) {
      this.gridOffset = { x: 0, y: 0 };
    }
    const minX = Math.min(0, viewW - gridW);
    const minY = Math.min(0, viewH - gridH);
    this.gridOffset.x = clamp(this.gridOffset.x, minX, 0);
    this.gridOffset.y = clamp(this.gridOffset.y, minY, 0);
  }

  resetInteractiveBoundsForFrame() {
    Object.keys(this.bounds).forEach((key) => {
      this.bounds[key] = Array.isArray(this.bounds[key]) ? [] : null;
    });
    this.trackBounds = [];
    this.trackControlBounds = [];
    this.pedalSlotBounds = [];
    this.pedalPickerBounds = [];
    this.pedalInspectorBounds = [];
    this.pedalEditorOverlayBounds = null;
    this.pedalEditorModalBounds = null;
    this.patternBounds = [];
    this.noteBounds = [];
    this.toolsMenuBounds = [];
    this.fileMenuBounds = [];
    this.fileMenuListBounds = null;
    this.genreMenuBounds = [];
    this.noteLabelBounds = [];
    this.gridBounds = null;
    this.rulerBounds = null;
    this.songLaneBounds = [];
    this.songLabelBounds = [];
    this.songAutomationBounds = [];
    this.songActionBounds = [];
    this.songPartBounds = [];
    this.songPartHandleBounds = [];
    this.songInstrumentBounds = null;
    this.songAddBounds = null;
    this.songRulerBounds = null;
    this.mobilePortraitMenuSheetBounds = null;
    this.mobilePortraitFilePanelBounds = null;
    this.menuScrollRegions = [];
    this.mobileLandscapeRootMenuBounds = null;
    this.mobileLandscapeRootMenuButtons = [];
    this.mobileLandscapeRootMenuScrollMax = 0;
    this.bounds.landscapeMenuButton = null;
  }

  draw(ctx, width, height) {
    const track = this.getActiveTrack();
    const pattern = this.getActivePattern();
    const perfEnabled = this.debug?.perf;
    const perfStart = perfEnabled ? performance.now() : 0;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.resetInteractiveBoundsForFrame();
    ctx.save();
    ctx.fillStyle = this.highContrast ? '#000' : '#070707';
    ctx.fillRect(0, 0, width, height);
    this.bounds.tempoButton = null;
    this.bounds.tempoSlider = null;
    this.bounds.settings = null;
    this.bounds.noteLengthMenu = [];
    this.bounds.railInstruments = null;
    this.bounds.railSettings = null;
    this.bounds.railZoom = null;
    this.bounds.transportLoopToggle = null;
    this.bounds.leftSettings = null;
    this.editorShellTheme = resolveEditorShellTheme();

    const viewportMode = resolveEditorViewportModeFlags({
      viewportWidth: width,
      viewportHeight: height,
      isMobile: this.isMobileLayout(),
      gamepadConnected: this.isPhysicalControllerConnected()
    });
    this.activeModeContract = viewportMode.modeContract;
    const isMobile = viewportMode.isMobileViewport;
    if (this.recordModeActive && isMobile) {
      this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
      this.openDesktopDropdownRootId = null;
      this.closedDesktopDropdownRootId = null;
      this.drawRecordMode(ctx, width, height, track, pattern);
      ctx.restore();
      if (perfEnabled) {
        const elapsed = performance.now() - perfStart;
        if (elapsed > 12) {
          const noteCount = this.song.tracks.reduce((sum, t) => sum + (t.patterns?.[this.selectedPatternIndex]?.notes?.length || 0), 0);
          const sizeEstimate = this.lastPersistedSnapshot?.length || this.history.currentSnapshot?.length || 0;
          console.warn(`[perf] draw ${elapsed.toFixed(1)}ms (notes ${noteCount}, song ${sizeEstimate} chars)`);
        }
      }
      return;
    }
    if (viewportMode.isMobileViewport) {
      this.desktopDropdown = resolveDesktopDropdownState({ isDesktop: false });
      this.openDesktopDropdownRootId = null;
      this.closedDesktopDropdownRootId = null;
      this.drawMobileLayout(ctx, width, height, track, pattern);
    } else {
      this.drawDesktopLayout(ctx, width, height, track, pattern);
    }

    this.drawNoteLengthMenu(ctx, width, height);
    this.drawTempoSlider(ctx, width, height);

    if (this.genreMenuOpen) {
      this.drawGenreMenu(ctx, width, height);
    }

    if (this.instrumentPicker.mode) {
      this.drawInstrumentPickerModal(ctx, width, height, track);
    }

    if (this.qaOverlayOpen) {
      this.drawQaOverlay(ctx, width, height);
    }

    if (viewportMode.isMobileLandscape) {
      this.drawMobilePanJoystick(ctx, width, height);
    } else if (!isMobile) {
      resetSharedThumbstickState(this.panJoystick);
    }
    if (isMobile && this.game?.input?.isGamepadConnected?.()) {
      this.drawGamepadHintBar(ctx, {
        x: isMobile ? 10 : 92,
        y: height - 34,
        w: Math.max(240, width - (isMobile ? 20 : 112)),
        h: 28
      }, this.activeTab === 'grid' ? 'MIDI Grid' : 'MIDI Chrome');
    }
    if (this.shouldDrawControllerOverlay(width, height)) {
      drawCanvasControllerMenu(ctx, this.controllerMenu, {
        width,
        height,
        contextLabel: this.activeTab === 'grid' ? 'MIDI Grid' : 'MIDI Chrome'
      });
    }

    ctx.restore();
    if (perfEnabled) {
      const elapsed = performance.now() - perfStart;
      if (elapsed > 12) {
        const noteCount = this.song.tracks.reduce((sum, t) => sum + (t.patterns?.[this.selectedPatternIndex]?.notes?.length || 0), 0);
        const sizeEstimate = this.lastPersistedSnapshot?.length || this.history.currentSnapshot?.length || 0;
        console.warn(`[perf] draw ${elapsed.toFixed(1)}ms (notes ${noteCount}, song ${sizeEstimate} chars)`);
      }
    }
  }

  drawGamepadHintBar(ctx, bounds, contextLabel) {
    drawSharedGamepadHintBar(ctx, bounds, contextLabel, SHARED_EDITOR_GAMEPAD_HINTS);
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

  getGamepadMenuState(width = this.viewportWidth || 0, height = this.viewportHeight || 0) {
    return resolveGamepadMenuState({
      viewportWidth: width,
      viewportHeight: height,
      gamepadConnected: this.isPhysicalControllerConnected(),
      isMobile: this.isMobileLayout(),
      menuActive: this.controllerMenu.active,
      activeMenuId: this.controllerMenu.getActiveMenuId()
    });
  }

  isMidiLandscapeRightDrawerTab(tabId = this.activeTab) {
    return MIDI_LANDSCAPE_RIGHT_DRAWER_TABS.has(tabId);
  }

  drawMidiLandscapeRootDrawer(ctx, bounds) {
    if (!bounds) return;
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const rootEntries = buildMidiSharedRootMenuEntries();
    const grid = buildLandscapeRootDrawerGridLayout({
      bounds,
      itemCount: rootEntries.length,
      padding: 8,
      gap: SHARED_EDITOR_LEFT_MENU.buttonGap,
      rowHeight: SHARED_EDITOR_LEFT_MENU.buttonHeightMobile
    });
    this.controllerMenu.scroll.root = 0;
    this.mobileLandscapeRootMenuBounds = grid.listBounds;
    this.mobileLandscapeRootMenuButtons = [];
    this.mobileLandscapeRootMenuScrollMax = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(grid.listBounds.x, grid.listBounds.y, grid.listBounds.w, grid.listBounds.h);
    ctx.clip();
    grid.items.forEach(({ index, bounds }) => {
      const entry = rootEntries[index];
      const button = {
        ...bounds,
        id: entry.id
      };
      this.mobileLandscapeRootMenuButtons.push(button);
      this.drawButton(ctx, button, entry.label, this.isLeftRailTabActive(entry.id), false, this.controllerMenu.isFocusedItem('root', entry.id));
    });
    ctx.restore();
  }

  drawMidiLandscapeRightDrawer(ctx, bounds) {
    if (!bounds) return;
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    const pad = 8;
    const content = {
      x: bounds.x + pad,
      y: bounds.y + pad,
      w: Math.max(1, bounds.w - pad * 2),
      h: Math.max(1, bounds.h - pad * 2)
    };
    if (this.activeTab === 'file') {
      this.drawFilePanel(ctx, content.x, content.y, content.w, content.h);
    } else if (this.activeTab === 'view') {
      this.drawControllerSubmenuPanel(ctx, content.x, content.y, content.w, content.h, 'view', { isMobile: true, layoutMode: 'list' });
    } else if (this.activeTab === 'settings') {
      this.drawSettingsPanel(ctx, content.x, content.y, content.w, content.h);
    } else if (this.activeTab === 'virtual-instruments') {
      this.drawControllerSubmenuPanel(ctx, content.x, content.y, content.w, content.h, 'record', { isMobile: true, layoutMode: 'list' });
    }
  }

  drawGamepadSlideOutPanel(ctx, bounds) {
    const menuId = this.getActiveGamepadMenuId();
    const plan = buildGamepadSlideOutMenuPlan('midi', {
      rootOpen: !menuId,
      activeRootId: menuId || this.getDesktopControllerMenuId(),
      focusedItemId: this.controllerMenu.getFocusedItem(menuId)?.id
    });
    const menu = this.controllerMenu.menus?.[menuId];
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panel, border: UI_SUITE.colors.border });
    drawSharedGamepadSlideOutHeader(ctx, bounds, menu?.title || plan.submenu?.title || 'Menu', { hint: plan.headerHint });
    this.gamepadSlideOutMenuMeta = null;
    this.drawControllerSubmenuPanel(
      ctx,
      bounds.x + 8,
      bounds.y + 52,
      Math.max(1, bounds.w - 16),
      Math.max(1, bounds.h - 60),
      menuId,
      { isMobile: true, layoutMode: 'list', maxColumns: 1, minColumnWidth: Math.max(1, bounds.w - 16), scrollGroup: 'gamepadSubmenu' }
    );
  }



  drawDangerButton(ctx, bounds, label) {
    if (!bounds) return;
    ctx.save();
    ctx.fillStyle = 'rgba(145,30,30,0.95)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,130,130,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.restore();
  }

  drawDesktopLayout(ctx, width, height, track, pattern) {
    const openDesktopRootId = resolveDesktopDropdownRootId({
      openRootId: this.openDesktopDropdownRootId,
      closedRootId: this.closedDesktopDropdownRootId,
      isDesktop: true
    });
    const shellLayout = buildDesktopEditorShellPlan('midi', {
      viewportWidth: width,
      viewportHeight: height,
      activeRootId: openDesktopRootId,
      dropdownScroll: this.desktopDropdownScroll?.[openDesktopRootId] || 0
    });
    this.desktopDropdown = resolveDesktopDropdownState({
      isDesktop: true,
      dropdown: shellLayout.dropdown,
      previousDropdown: this.desktopDropdown
    });

    this.drawDesktopTopMenu(ctx, shellLayout.topMenu);
    this.drawDesktopRibbon(ctx, shellLayout.leftRibbon, track);
    this.drawDesktopLeftOptions(ctx, shellLayout.leftOptions, { includeDesktopTransport: this.activeTab !== 'instruments' });

    const { x: contentX, y: contentY, w: contentW, h: contentH } = shellLayout.workSurface;
    if (this.activeTab === 'grid') {
      this.drawGridTab(ctx, contentX, contentY, contentW, contentH, track, pattern);
    } else if (this.activeTab === 'song') {
      this.drawSongTab(ctx, contentX, contentY, contentW, contentH);
    } else if (this.activeTab === 'instruments') {
      const pedalTransportH = 44;
      const minMixerH = Math.min(380, Math.max(220, contentH - pedalTransportH - 140));
      const preferredPedalBoardH = Math.min(210, Math.max(140, Math.round(contentH * 0.22)));
      const maxPedalBoardH = Math.max(140, contentH - pedalTransportH - minMixerH);
      const pedalBoardAreaH = clamp(preferredPedalBoardH, 140, maxPedalBoardH);
      const mixerH = Math.max(minMixerH, contentH - pedalBoardAreaH - pedalTransportH);
      this.drawInstrumentPanel(ctx, contentX, contentY, contentW, mixerH, track);
      this.drawMixerPedalTransport(ctx, contentX, contentY + mixerH, contentW, pedalTransportH, track);
      this.drawPedalBoardPanel(ctx, contentX, contentY + mixerH + pedalTransportH, contentW, pedalBoardAreaH, track);
    } else if (this.activeTab === 'pedals') {
      this.drawPedalBoardPanel(ctx, contentX, contentY, contentW, contentH, track);
    } else if (this.activeTab === 'settings') {
      this.drawSettingsPanel(ctx, contentX, contentY, contentW, contentH);
    } else if (this.activeTab === 'file') {
      this.drawGridTab(ctx, contentX, contentY, contentW, contentH, track, pattern);
    }
    if (shellLayout.dropdown) this.drawDesktopDropdown(ctx, shellLayout.dropdown);
  }

  getDesktopControllerMenuId(tabId = this.activeTab) {
    if (this.recordModeActive) return 'record';
    return getEditorDesktopControllerMenuIdForSection('midi', tabId) || tabId;
  }

  getDesktopMenuLabel(menuId = this.getDesktopControllerMenuId()) {
    return MIDI_CONTROLLER_ROOT_LABELS[menuId] || MIDI_CONTROLLER_ROOT_LABELS[this.activeTab] || menuId;
  }

  getDesktopRootButtons() {
    return [
      this.bounds.fileButton ? { ...this.bounds.fileButton, desktopRootId: 'file' } : null,
      ...(this.bounds.tabs || []),
      this.bounds.leftSettings ? { ...this.bounds.leftSettings, desktopRootId: 'settings' } : null
    ].filter(Boolean);
  }

  openMidiDesktopDropdown(rootId) {
    const nextDropdown = resolveOpenDesktopDropdownState({
      rootId,
      currentOpenRootId: this.openDesktopDropdownRootId,
      closedRootId: this.closedDesktopDropdownRootId,
      dropdown: this.desktopDropdown
    });
    if (!nextDropdown) return;
    this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
    this.openDesktopDropdownRootId = nextDropdown.openRootId;
    this.desktopDropdown = nextDropdown.dropdown;
  }

  closeMidiDesktopDropdown() {
    const nextDropdown = resolveClosedDesktopDropdownState({
      dropdown: this.desktopDropdown,
      openRootId: this.openDesktopDropdownRootId,
      fallbackRootId: this.getDesktopControllerMenuId()
    });
    this.closedDesktopDropdownRootId = nextDropdown.closedRootId;
    this.openDesktopDropdownRootId = nextDropdown.openRootId;
    this.desktopDropdown = nextDropdown.dropdown;
  }

  drawDesktopTopMenu(ctx, plan) {
    this.bounds.tabs = [];
    this.bounds.fileButton = null;
    this.bounds.leftSettings = null;
    this.bounds.settings = null;
    drawSharedDesktopTopMenu(ctx, plan, {
      focusedId: this.controllerMenu.getFocusedItem('root')?.id,
      registerButton: (button) => {
      const bounds = { ...button.bounds, id: button.id };
      bounds.desktopRootId = button.id;
      if (button.id === 'file') {
        this.bounds.fileButton = bounds;
      } else if (button.id === 'settings') {
        this.bounds.leftSettings = bounds;
        this.bounds.settings = { ...bounds };
      } else {
        this.bounds.tabs.push(bounds);
      }
      }
    });
  }

  drawDesktopRibbon(ctx, bounds, track) {
    this.bounds.undoButton = null;
    this.bounds.redoButton = null;
    const tabLabel = this.getDesktopMenuLabel();
    drawSharedDesktopRibbon(ctx, bounds, {
      title: this.song?.name || 'MIDI',
      subtitle: `${tabLabel} | ${track?.name || 'Track'}`
    });
  }

  drawDesktopLeftOptions(ctx, bounds, options = {}) {
    const includeDesktopTransport = options.includeDesktopTransport === true;
    const { contextBounds, transportBounds } = buildSharedDesktopContextTransportLayout(bounds, {
      includeTransport: includeDesktopTransport,
      transportMinHeight: 144,
      transportMaxHeight: 172,
      transportRatio: 0.28,
      minContextHeight: 120
    });
    const menuId = this.getDesktopControllerMenuId();
    const track = this.song?.tracks?.[this.selectedTrackIndex] || null;
    const pattern = track?.patterns?.[this.selectedPatternIndex] || track?.patterns?.[0] || null;
    const noteCount = Array.isArray(pattern?.notes) ? pattern.notes.length : 0;
    const lines = [
      `Song: ${this.song?.name || 'Untitled'}`,
      `Active: ${this.getDesktopMenuLabel(menuId)}`,
      `Track: ${this.selectedTrackIndex + 1}/${Math.max(1, this.song?.tracks?.length || 1)}${track?.name ? ` ${track.name}` : ''}`,
      `Pattern: ${this.selectedPatternIndex + 1}/${Math.max(1, track?.patterns?.length || 1)}`,
      `Tempo: ${this.song?.tempo || 120} BPM`,
      `Notes: ${noteCount}`
    ];
    drawSharedDesktopContextPanel(ctx, contextBounds, {
      lines,
      status: this.recordModeActive ? 'Recording enabled' : (this.singleNoteRecordMode.active ? 'Single note mode' : '')
    });
    if (transportBounds) {
      this.drawDesktopTransportPanel(ctx, transportBounds);
    }
  }

  drawDesktopTransportPanel(ctx, bounds) {
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    const pad = 10;
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Transport', bounds.x + pad, bounds.y + 17, bounds.w - pad * 2);
    ctx.restore();
    const buttonSpecs = [
      { id: 'returnStart', label: '⏮' },
      { id: 'prevBar', label: '⏪' },
      { id: 'record', label: '●', active: this.recordModeActive, emphasis: true, role: 'record' },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶', active: this.isPlaying, emphasis: true },
      { id: 'nextBar', label: '⏩' },
      { id: 'goEnd', label: '⏭' }
    ];
    const buttonGap = 6;
    const buttonH = 34;
    const columns = 3;
    const buttonW = Math.max(34, Math.floor((bounds.w - pad * 2 - buttonGap * (columns - 1)) / columns));
    buttonSpecs.forEach((button, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const buttonBounds = {
        x: bounds.x + pad + col * (buttonW + buttonGap),
        y: bounds.y + 34 + row * (buttonH + buttonGap),
        w: buttonW,
        h: buttonH
      };
      this.bounds[button.id] = buttonBounds;
      drawSharedTransportIconButton(ctx, buttonBounds, {
        icon: button.label,
        active: Boolean(button.active),
        emphasis: Boolean(button.emphasis),
        role: button.role || 'default'
      });
    });
    const controlsY = bounds.y + 34 + 2 * (buttonH + buttonGap) + 6;
    const controlW = Math.max(72, Math.floor((bounds.w - pad * 2 - buttonGap) / 2));
    this.bounds.transportLoopToggle = { x: bounds.x + pad, y: controlsY, w: controlW, h: 26 };
    this.bounds.loopToggle = this.bounds.transportLoopToggle;
    this.drawToggle(ctx, this.bounds.transportLoopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);
    this.bounds.metronome = { x: bounds.x + pad + controlW + buttonGap, y: controlsY, w: controlW, h: 26 };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);
    const zoomRailLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomRailLimits.minZoom, zoomRailLimits.maxZoom);
    const zoomRatio = clamp((this.gridZoomX - zoomRailLimits.minZoom) / Math.max(0.0001, zoomRailLimits.maxZoom - zoomRailLimits.minZoom), 0, 1);
    this.bounds.railZoom = { x: bounds.x + pad, y: controlsY + 38, w: bounds.w - pad * 2, h: 12 };
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(this.bounds.railZoom.x, this.bounds.railZoom.y, this.bounds.railZoom.w, this.bounds.railZoom.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(this.bounds.railZoom.x, this.bounds.railZoom.y, this.bounds.railZoom.w * zoomRatio, this.bounds.railZoom.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(this.bounds.railZoom.x, this.bounds.railZoom.y, this.bounds.railZoom.w, this.bounds.railZoom.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText(`Grid Zoom ${this.gridZoomX.toFixed(2)}x`, this.bounds.railZoom.x, this.bounds.railZoom.y - 4);
    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = '#ff9c42';
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText('Single Note Mode', bounds.x + pad, bounds.y + bounds.h - 8, bounds.w - pad * 2);
    }
  }

  drawDesktopDropdown(ctx, dropdown) {
    const menuId = dropdown.specId || dropdown.rootId;
    const controllerMenus = this.buildControllerMenus();
    const menu = controllerMenus[menuId] || controllerMenus[dropdown.rootId] || this.controllerMenu.menus?.[menuId] || this.controllerMenu.menus?.[dropdown.rootId];
    const items = this.controllerMenu.getItems(menu);
    const dropdownPlan = buildDesktopDropdownRenderPlan({
      dropdown: this.desktopDropdown?.rootId === dropdown.rootId ? this.desktopDropdown : dropdown,
      items,
      hiddenIds: menuId === 'grid' ? ['place-note', 'erase-note'] : [],
      disableActionlessItems: true
    });
    this.bounds.desktopDropdownItems = [];
    drawSharedDesktopDropdown(ctx, dropdownPlan, {
      isActive: (item) => this.isControllerSubmenuItemActive(menuId, item.id),
      isFocused: (item) => this.controllerMenu.isFocusedItem(menuId, item.id),
      registerButton: ({ item, bounds }) => {
        if (typeof item.onSelect === 'function') {
          const action = () => item.onSelect(this);
          this.bounds.desktopDropdownItems.push(createDesktopDropdownCommandHit(item, bounds, action));
        }
      }
    });
  }

  drawControllerSubmenuPanel(ctx, x, y, w, h, menuId, options = {}) {
    const menu = this.controllerMenu.menus?.[menuId];
    if (!menu) return;
    const items = this.controllerMenu.getItems(menu);
    const rowHeight = options.isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : this.sharedMenu.getButtonHeight(false);
    const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const visibleRows = Math.max(1, Math.floor(Math.max(0, h - 24) / Math.max(1, rowHeight + rowGap)));
    const scroll = this.controllerMenu.syncScrollToItem(
      menuId,
      this.controllerMenu.getFocusedItem(menuId)?.id,
      items,
      visibleRows,
      this.controllerMenu.scroll?.[menuId] || 0
    );
    const result = this.sharedMenu.drawDrawer(ctx, {
      panel: { x, y, w, h },
      title: '',
      items,
      scroll,
      isMobile: Boolean(options.isMobile),
      showTitle: false,
      footerMode: 'none',
      layoutMode: options.layoutMode || (options.isMobile && items.length > 4 ? 'auto-grid' : 'list'),
      minColumnWidth: options.minColumnWidth || (options.isMobile ? 112 : 140),
      maxColumns: options.maxColumns || (options.isMobile ? 2 : 3),
      drawButton: (bounds, item) => {
        this.drawButton(
          ctx,
          bounds,
          item.label,
          this.isControllerSubmenuItemActive(menuId, item.id),
          false,
          this.controllerMenu.isFocusedItem(menuId, item.id)
        );
      }
    });
    if (options.isMobile) {
      drawSharedPortraitScrollHints(ctx, result.listBounds, {
        scroll: result.scroll,
        scrollMax: result.scrollMax
      });
    }
    if (options.scrollGroup) {
      this.gamepadSlideOutMenuMeta = {
        menuId,
        scrollBounds: result.listBounds,
        maxScroll: result.scrollMax,
        scroll: result.scroll,
        lineHeight: rowHeight + rowGap,
        itemBounds: result.itemBounds,
        items
      };
    }
  }

  isControllerSubmenuItemActive(menuId, itemId) {
    if (menuId === 'tracks') {
      const track = this.song.tracks[this.selectedTrackIndex];
      return itemId === track?.id;
    }
    if (menuId === 'song' && itemId === 'play') return this.isPlaying;
    if (menuId === 'settings') {
      if (itemId === 'quantize') return Boolean(this.quantizeEnabled);
      if (itemId === 'preview') return Boolean(this.previewOnEdit);
      if (itemId === 'contrast') return Boolean(this.highContrast);
    }
    return false;
  }

  drawRecordMode(ctx, width, height, track, pattern) {
    const isMobile = this.isMobileLayout();
    if (!isMobile) {
      this.drawDesktopLayout(ctx, width, height, track, pattern);
      return;
    }
    let contentX;
    let contentY;
    let contentW;
    let contentH;
    let menuH;
    let gap;

    if (isMobile && isMobilePortraitLayout({ isMobile: true, viewportWidth: width, viewportHeight: height })) {
      const layout = getMidiPortraitRecordLayout(width, height);
      const grid = layout.gridBounds;
      if (!this.recordGridZoomedOut && track) {
        const rows = isDrumTrack(track)
          ? this.getDrumRows().length
          : this.getPitchRange().max - this.getPitchRange().min + 1;
        const { minZoom } = this.getGridZoomLimits(rows);
        const zoomXLimits = this.getGridZoomLimitsX();
        this.gridZoomX = zoomXLimits.minZoom;
        this.gridZoomY = minZoom;
        this.gridZoomInitialized = true;
        this.recordGridZoomedOut = true;
      }
      this.drawPatternEditor(ctx, grid.x, grid.y, grid.w, grid.h, track, pattern, {
        summary: true,
        hideLabels: true,
        uniformNotes: true,
        simplified: true
      });
      this.drawGhostNotes(ctx);
      this.drawMobileBottomRail(ctx, layout.middleRail.x, layout.middleRail.y, layout.middleRail.w, layout.middleRail.h, track);
      this.recordLayout.layout(width, height, 0, 0, {
        gridBounds: layout.gridBounds,
        instrumentBounds: layout.instrumentBounds,
        controlRailBounds: layout.controlRailBounds,
        touchDensity: {
          keyboardWhiteKeys: 8,
          stringFrets: 7
        }
      });
      const recordSelector = this.recordSelector.active
        ? {
          type: this.recordSelector.type,
          index: this.recordSelector.index,
          title: this.recordSelector.type === 'key' ? 'Scale Root' : 'Scale Mode',
          items: this.recordSelector.type === 'key'
            ? KEY_LABELS
            : SCALE_LIBRARY.map((entry) => entry.label)
        }
        : null;
      this.recordLayout.draw(ctx, {
        showGamepadHints: this.recordLayout.device === 'gamepad' && this.gamepadInput.connected,
        isPlaying: this.isPlaying,
        isRecording: this.recorder.isRecording,
        selector: recordSelector,
        stickIndicators: this.recordStickIndicators,
        nowPlaying: this.nowPlaying,
        nowPlayingPlacement: 'preview',
        showSettingsRail: false,
        hideInstrumentConfig: true
      });
      const pedalOverlayOpen = this.pedalUiState.pickerOpen || this.pedalUiState.editorOpen;
      if (!pedalOverlayOpen) {
        this.drawPedalBoardPanel(ctx, layout.pedalBounds.x, layout.pedalBounds.y, layout.pedalBounds.w, layout.pedalBounds.h, track, { embedded: true, compact: true });
      }
      const quickY = Math.max(8, layout.instrumentBounds.y - 52);
      const quickGap = 8;
      const quickX = 10;
      const quickW = Math.floor((width - quickX * 2 - quickGap * 2) / 3);
      this.bounds.recordVirtualInstrument = {
        x: quickX,
        y: quickY,
        w: quickW,
        h: 42
      };
      this.drawButton(ctx, this.bounds.recordVirtualInstrument, 'Virtual', this.recordLayout.instrumentMenuOpen, false);
      this.bounds.recordSettings = {
        x: quickX + quickW + quickGap,
        y: quickY,
        w: quickW,
        h: 42
      };
      this.drawButton(ctx, this.bounds.recordSettings, 'Settings', this.midiPortraitRecordSettingsOpen, false);
      this.bounds.record = {
        x: quickX + (quickW + quickGap) * 2,
        y: quickY,
        w: quickW,
        h: 42
      };
      this.drawButton(ctx, this.bounds.record, this.recorder.isRecording ? 'Stop Rec' : 'Record', this.recorder.isRecording, false);
      if (this.midiPortraitRecordSettingsOpen) {
        const settingsH = this.recordInstrument === 'guitar' ? 278 : this.recordInstrument === 'bass' ? 230 : 176;
        this.drawMidiPortraitRecordSettingsPanel(ctx, {
          x: 10,
          y: Math.max(8, quickY - settingsH - 10),
          w: width - 20,
          h: Math.min(settingsH, Math.max(132, quickY - 18))
        });
      }
      if (pedalOverlayOpen) {
        this.drawPedalBoardPanel(ctx, layout.pedalBounds.x, layout.pedalBounds.y, layout.pedalBounds.w, layout.pedalBounds.h, track, { embedded: true, compact: true });
      }
      return;
    }

    const padding = 10;
    gap = 10;
    const sidebarW = getSharedMobileRailWidth(width, height);
    const sidebarX = 0;
    const sidebarY = 0;
    const sidebarH = height;
    this.drawMobileSidebar(ctx, sidebarX, sidebarY, sidebarW, sidebarH, track, { menuOnly: true });
    contentX = sidebarX + sidebarW + gap;
    contentY = padding;
    contentW = width - contentX - padding;
    contentH = height - padding * 2;
    menuH = Math.max(0, (this.bounds.settings?.y ?? sidebarY) + (this.bounds.settings?.h ?? 0) - sidebarY + SHARED_EDITOR_LEFT_MENU.panelPadding);

    const controlRailW = clamp(Math.round(contentW * 0.2), 132, 204);
    const controlRailGap = 10;
    const controlRailBounds = {
      x: contentX + contentW - controlRailW,
      y: contentY,
      w: controlRailW,
      h: menuH
    };
    const gridBounds = {
      x: contentX,
      y: contentY,
      w: Math.max(0, contentW - controlRailW - controlRailGap),
      h: menuH
    };
    const instrumentY = contentY + menuH + gap;
    const instrumentH = Math.max(0, height - instrumentY);
    const instrumentBounds = {
      x: 0,
      y: instrumentY,
      w: width,
      h: instrumentH
    };

    const layout = this.recordLayout.layout(contentW, contentH, contentX, contentY, {
      gridBounds,
      instrumentBounds,
      controlRailBounds
    });
    const grid = layout.grid;
    if (!this.recordGridZoomedOut && track) {
      const rows = isDrumTrack(track)
        ? this.getDrumRows().length
        : this.getPitchRange().max - this.getPitchRange().min + 1;
      const { minZoom } = this.getGridZoomLimits(rows);
      const zoomXLimits = this.getGridZoomLimitsX();
      this.gridZoomX = zoomXLimits.minZoom;
      this.gridZoomY = minZoom;
      this.gridZoomInitialized = true;
      this.recordGridZoomedOut = true;
    }
    if (grid) {
      this.drawPatternEditor(ctx, grid.x, grid.y, grid.w, grid.h, track, pattern, {
        summary: true,
        hideLabels: true,
        uniformNotes: true,
        simplified: true
      });
      this.drawGhostNotes(ctx);
    }
    const recordSelector = this.recordSelector.active
      ? {
        type: this.recordSelector.type,
        index: this.recordSelector.index,
        title: this.recordSelector.type === 'key' ? 'Scale Root' : 'Scale Mode',
        items: this.recordSelector.type === 'key'
          ? KEY_LABELS
          : SCALE_LIBRARY.map((entry) => entry.label)
      }
      : null;
    this.recordLayout.draw(ctx, {
      showGamepadHints: this.recordLayout.device === 'gamepad' && this.gamepadInput.connected,
      isPlaying: this.isPlaying,
      isRecording: this.recorder.isRecording,
      selector: recordSelector,
      stickIndicators: this.recordStickIndicators,
      nowPlaying: this.nowPlaying,
      nowPlayingPlacement: this.isMobileLayout() && this.viewportWidth > this.viewportHeight ? 'preview' : 'instrument'
    });

  }

  drawRecordModeSidebar(ctx, x, y, w, h) {
    return drawComposerRecordModeSidebar(this, ctx, x, y, w, h, TAB_OPTIONS);
  }

  drawGhostNotes(ctx) {
    drawComposerGhostNotes(this, ctx);
  }

  clearMidiPortraitDrawerBounds() {
    this.bounds.tabs = [];
    this.bounds.settings = null;
    this.bounds.settingsPanel = null;
    this.bounds.settingsControls = [];
    this.fileMenuBounds = [];
    this.fileMenuListBounds = null;
    this.mobilePortraitFilePanelBounds = null;
  }

  clearMidiPortraitStackBounds() {
    this.bounds.gridQuickControls = [];
    this.bounds.midiPortraitTrackPicker = null;
    this.bounds.midiPortraitTrackPickerScrollArea = null;
    this.bounds.midiPortraitTrackPickerRows = [];
    this.bounds.midiPortraitMasterVolumePanel = null;
    this.bounds.midiPortraitMasterVolumeSlider = null;
    this.bounds.songMixRail = null;
    this.bounds.songToolsActions = [];
    this.bounds.songTransportRecord = null;
    this.bounds.songTransportStart = null;
    this.bounds.songTransportBack = null;
    this.bounds.songTransportPlayPause = null;
    this.bounds.songTransportMetronome = null;
    this.bounds.songTransportForward = null;
    this.bounds.songTransportEnd = null;
    this.bounds.songTransportLoopThis = null;
    this.bounds.songMixVolumeTab = null;
    this.bounds.songMixPanTab = null;
    this.bounds.instrumentSettingsControls = [];
    this.bounds.railZoom = null;
  }

  drawMobileLayout(ctx, width, height, track, pattern) {
    const padding = 10;
    const gap = 10;
    this.mobilePortraitMenuSheetBounds = null;
    if (isMobilePortraitLayout({ isMobile: true, viewportWidth: width, viewportHeight: height })) {
      const layout = getSharedMobilePortraitEditorLayout(width, height, {
        middleRailHeight: 88,
        minTopHeight: 230,
        minMainHeight: 240
      });
      const sheetOpen = shouldMidiPortraitSheetOpen(this.activeTab, this.controllerMenu.active);
      const contextualRailHeight = sheetOpen || this.activeTab === 'song'
        ? (this.activeTab === 'song' ? 184 : 144)
        : (this.activeTab === 'grid' ? 56 : 48);
      const controlLayout = getMidiPortraitControlLayout(width, height, {
        rootRailHeight: contextualRailHeight
      });
      const fullWorkSurface = {
        x: padding,
        y: padding,
        w: Math.max(1, width - padding * 2),
        h: Math.max(1, controlLayout.bottomRail.y - gap - padding)
      };
      const mainWorkSurface = (this.activeTab === 'instruments' || this.activeTab === 'pedals')
        ? fullWorkSurface
        : controlLayout.workSurface;
      this.clearMidiPortraitStackBounds();
      if (!sheetOpen) {
        this.clearMidiPortraitDrawerBounds();
      }
      if (this.activeTab === 'song') {
        this.drawSongTab(ctx, mainWorkSurface.x, mainWorkSurface.y, mainWorkSurface.w, mainWorkSurface.h, {
          portraitRailBounds: controlLayout.viewRail
        });
      } else if (this.activeTab === 'instruments') {
        this.drawInstrumentPanel(ctx, mainWorkSurface.x, mainWorkSurface.y, mainWorkSurface.w, mainWorkSurface.h, track, {
          portraitMain: true
        });
      } else if (this.activeTab === 'pedals') {
        this.drawPedalBoardPanel(ctx, mainWorkSurface.x, mainWorkSurface.y, mainWorkSurface.w, mainWorkSurface.h, track, {
          portraitGrid: true
        });
      } else if (this.activeTab === 'virtual-instruments') {
        this.enterRecordMode();
        return;
      } else {
        this.drawPatternEditor(ctx, mainWorkSurface.x, mainWorkSurface.y, mainWorkSurface.w, mainWorkSurface.h, track, pattern);
        if (this.activeTab === 'grid') {
          this.clearGridZoomButtonBounds();
        }
      }
      if (sheetOpen) {
        const portraitSheet = getMidiPortraitFullScreenSheetLayout(width, height, { padding });
        const sheetBounds = portraitSheet.sheet;
        const sheetContent = portraitSheet.content;
        this.mobilePortraitMenuSheetBounds = { ...sheetBounds };
        drawSharedPortraitSheet(ctx, sheetBounds);
        if (this.activeTab === 'file') {
          this.mobilePortraitFilePanelBounds = { ...sheetContent };
          this.drawFilePanel(ctx, sheetContent.x, sheetContent.y, sheetContent.w, sheetContent.h);
          this.mobilePortraitFilePanelBounds = null;
        } else if (this.activeTab === 'settings') {
          this.drawSettingsPanel(ctx, sheetContent.x, sheetContent.y, sheetContent.w, sheetContent.h);
        } else if (this.activeTab === 'virtual-instruments') {
          this.drawControllerSubmenuPanel(ctx, sheetContent.x, sheetContent.y, sheetContent.w, sheetContent.h, 'record', { isMobile: true, layoutMode: 'auto-grid' });
        } else {
          this.drawControllerSubmenuPanel(ctx, sheetContent.x, sheetContent.y, sheetContent.w, sheetContent.h, 'grid', { isMobile: true, layoutMode: 'auto-grid' });
        }
      }
      if (this.activeTab === 'grid' || this.activeTab === 'song' || sheetOpen) {
        this.drawMidiHorizontalZoomSlider(ctx, controlLayout.zoomStrip.x, controlLayout.zoomStrip.y, controlLayout.zoomStrip.w, controlLayout.zoomStrip.h);
      }
      if (sheetOpen) {
        this.drawMobilePortraitRootTabs(ctx, controlLayout.viewRail, track);
      } else if (this.activeTab === 'grid') {
        this.drawMidiPortraitGridQuickStrip(ctx, controlLayout.viewRail.x, controlLayout.viewRail.y, controlLayout.viewRail.w, controlLayout.viewRail.h, track);
      }
      this.drawMobileBottomRail(ctx, controlLayout.bottomRail.x, controlLayout.bottomRail.y, controlLayout.bottomRail.w, controlLayout.bottomRail.h, track);
      return;
    }
    const isLandscape = width > height;
    const gamepadMenuState = this.getGamepadMenuState(width, height);
    const gamepadOwnsLandscapeMenu = gamepadMenuState.isLandscapeMenuMode;
    const gamepadSubmenuOnLeft = gamepadMenuState.drawSlideOut;
    if (!isLandscape || gamepadOwnsLandscapeMenu) this.landscapeRootDrawerOpen = false;
    const showLandscapeRightDrawer = isLandscape && !gamepadOwnsLandscapeMenu && this.isMidiLandscapeRightDrawerTab(this.activeTab);
    const showsGridBottomRail = isLandscape && (this.activeTab === 'grid' || this.activeTab === 'song') && !gamepadOwnsLandscapeMenu;
    const landscapeLayout = isLandscape
      ? buildLandscapeTouchEditorShellPlan('midi', {
        viewportWidth: width,
        viewportHeight: height,
        bottomRailHeight: showsGridBottomRail ? 72 : 0,
        rightRailWidth: Math.min(340, Math.max(248, Math.floor(width * 0.28))),
        reserveRightRail: showLandscapeRightDrawer
      })
      : null;
    const rootMenuSurface = landscapeLayout?.surfaces.compactCommandRail ?? landscapeLayout?.surfaces.rootMenu;
    const workSurface = landscapeLayout?.surfaces.workSurface;
    const toolOptionsSurface = landscapeLayout?.surfaces.toolOptions;
    const submenuDrawerSurface = landscapeLayout?.surfaces.submenu;
    const overlayDrawerSurface = landscapeLayout?.surfaces.overlayDrawer;
    const rootDrawerSurface = landscapeLayout?.surfaces.rootDrawer ?? overlayDrawerSurface;
    const sidebarW = rootMenuSurface?.w ?? getSharedMobileRailWidth(width, height);
    const sidebarX = rootMenuSurface?.x ?? 0;
    const sidebarY = rootMenuSurface?.y ?? 0;
    const sidebarH = rootMenuSurface?.h ?? height;
    const contentX = workSurface?.x ?? (sidebarX + sidebarW + gap);
    const contentY = workSurface?.y ?? padding;
    const contentW = workSurface?.w ?? (width - contentX - padding);
    const contentH = workSurface?.h ?? (height - padding * 2);
    const bottomRail = toolOptionsSurface ?? { x: contentX, y: contentY + contentH + 8, w: contentW, h: 0 };
    const rightDrawerW = isLandscape && !gamepadOwnsLandscapeMenu
      ? ((submenuDrawerSurface ?? overlayDrawerSurface)?.w ?? getSharedMobileDrawerWidth(width, height, sidebarW, { edgePadding: 0 }))
      : 0;
    const rootDrawerW = isLandscape && !gamepadOwnsLandscapeMenu
      ? (rootDrawerSurface?.w ?? rightDrawerW)
      : 0;
    const submenuSurface = rightDrawerW > 0
      ? {
        x: (submenuDrawerSurface ?? overlayDrawerSurface)?.x ?? width - rightDrawerW,
        y: (submenuDrawerSurface ?? overlayDrawerSurface)?.y ?? 0,
        w: rightDrawerW,
        h: (submenuDrawerSurface ?? overlayDrawerSurface)?.h ?? height
      }
      : null;
    const rootDrawer = rootDrawerW > 0
      ? {
        x: rootDrawerSurface?.x ?? (sidebarX + sidebarW),
        y: rootDrawerSurface?.y ?? 0,
        w: rootDrawerW,
        h: rootDrawerSurface?.h ?? height
      }
      : null;

    if (gamepadSubmenuOnLeft) {
      this.drawGamepadSlideOutPanel(ctx, { x: sidebarX, y: sidebarY, w: sidebarW, h: sidebarH });
    } else {
      this.drawMobileSidebar(ctx, sidebarX, sidebarY, sidebarW, sidebarH, track, { menuOnly: isLandscape });
    }

    if (this.landscapeRootDrawerOpen && rootDrawer) {
      this.drawPatternEditor(ctx, contentX, contentY, contentW, contentH, track, pattern);
      this.clearGridZoomButtonBounds();
      this.drawMidiLandscapeRootDrawer(ctx, rootDrawer);
      if (showLandscapeRightDrawer) {
        this.drawMidiLandscapeRightDrawer(ctx, submenuSurface);
      }
    } else if (showLandscapeRightDrawer) {
      this.drawPatternEditor(ctx, contentX, contentY, contentW, contentH, track, pattern);
      this.clearGridZoomButtonBounds();
      this.drawMidiLandscapeRightDrawer(ctx, submenuSurface);
    } else if (this.activeTab === 'grid') {
      this.drawPatternEditor(ctx, contentX, contentY, contentW, contentH, track, pattern);
      this.clearGridZoomButtonBounds();
      if (showsGridBottomRail) {
        this.drawMobileBottomRail(ctx, bottomRail.x, bottomRail.y, bottomRail.w, bottomRail.h, track);
      }
    } else if (this.activeTab === 'song') {
      this.drawSongTab(ctx, contentX, contentY, contentW, contentH);
      if (showsGridBottomRail) {
        this.drawMobileBottomRail(ctx, bottomRail.x, bottomRail.y, bottomRail.w, bottomRail.h, track);
      }
    } else if (this.activeTab === 'instruments') {
      const pedalTransportH = 64;
      const minMixerH = Math.min(380, Math.max(220, contentH - pedalTransportH - 140));
      const preferredPedalBoardH = Math.min(210, Math.max(140, Math.round(contentH * 0.22)));
      const maxPedalBoardH = Math.max(140, contentH - pedalTransportH - minMixerH);
      const pedalBoardAreaH = clamp(preferredPedalBoardH, 140, maxPedalBoardH);
      const mixerH = Math.max(minMixerH, contentH - pedalBoardAreaH - pedalTransportH);
      const bottomPanelX = contentX + 10;
      const bottomPanelY = contentY + mixerH + 4;
      const bottomPanelW = contentW - 20;
      const bottomPanelH = pedalTransportH + pedalBoardAreaH - 8;
      this.drawInstrumentPanel(ctx, contentX, contentY, contentW, mixerH, track);
      ctx.fillStyle = this.editorShellTheme.surfaceAlt;
      ctx.fillRect(bottomPanelX, bottomPanelY, bottomPanelW, bottomPanelH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(bottomPanelX, bottomPanelY, bottomPanelW, bottomPanelH);
      this.drawMixerPedalTransport(ctx, contentX, contentY + mixerH, contentW, pedalTransportH, track, { embedded: true, rowH: 48 });
      this.drawPedalBoardPanel(ctx, contentX, contentY + mixerH + pedalTransportH, contentW, pedalBoardAreaH, track, { embedded: true });
    } else if (this.activeTab === 'pedals') {
      this.drawPedalBoardPanel(ctx, contentX, contentY, contentW, contentH, track);
    } else if (this.activeTab === 'settings') {
      this.drawSettingsPanel(ctx, contentX, contentY, contentW, contentH);
    } else if (this.activeTab === 'file') {
      this.drawPatternEditor(ctx, contentX, contentY, contentW, contentH, track, pattern);
      this.drawFilePanel(ctx, contentX, contentY, contentW, contentH);
    }

    if (isLandscape && this.activeTab !== 'instruments' && this.activeTab !== 'grid' && this.activeTab !== 'song') {
      this.drawLandscapeZoomOverlay(ctx, width, height);
    }
  }

  drawMobilePortraitRootTabs(ctx, bounds) {
    drawSharedPanel(ctx, bounds);
    this.bounds.tabs = [];
    const tabs = buildMidiPortraitRootTabs();
    drawSharedPortraitMultiRowTabStrip(ctx, bounds, tabs, {
      activeId: this.activeTab,
      focusedId: this.controllerMenu.getFocusedItem('root')?.id,
      minButtonWidth: 54,
      maxButtonWidth: 160,
      maxColumns: 4,
      balanceLastRow: true,
      verticalAlign: 'bottom',
      padding: 4,
      gap: 5,
      drawButton: (buttonBounds, tab, state) => {
        if (tab.id === 'file') this.bounds.fileButton = buttonBounds;
        if (MIDI_WORKSPACE_TAB_IDS.has(tab.id)) this.bounds.tabs.push({ ...buttonBounds, id: tab.id });
        if (tab.id === 'settings') this.bounds.settings = buttonBounds;
        this.drawButton(ctx, buttonBounds, tab.label, this.isLeftRailTabActive(tab.id), false, state.focused);
      }
    });
  }

  drawMidiPortraitGridQuickStrip(ctx, x, y, w, h, track) {
    if (h <= 0) return;
    const bounds = { x, y, w, h };
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    this.bounds.gridQuickControls = [];
    this.bounds.midiPortraitTrackPicker = null;
    this.bounds.midiPortraitTrackPickerScrollArea = null;
    this.bounds.midiPortraitTrackPickerRows = [];
    this.bounds.midiPortraitMasterVolumePanel = null;
    this.bounds.midiPortraitMasterVolumeSlider = null;
    const items = buildMidiPortraitGridQuickStripItems({
      song: this.song,
      noteLengthLabel: this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex], true)
    });
    drawSharedPortraitMultiRowTabStrip(ctx, bounds, items, {
      activeId: this.song.loopEnabled ? 'loop' : null,
      minButtonWidth: 64,
      maxButtonWidth: 96,
      maxRows: 1,
      maxColumns: 4,
      rowHeight: 42,
      gap: 6,
      padding: 6,
      verticalAlign: 'bottom',
      drawButton: (buttonBounds, item) => {
        this.drawSmallButton(ctx, buttonBounds, item.label, Boolean(item.active));
        this.bounds.gridQuickControls.push({ ...buttonBounds, id: item.id });
      }
    });
    if (this.midiPortraitTrackPickerOpen) {
      this.drawMidiPortraitTrackPicker(ctx, bounds);
    }
    if (this.midiPortraitMasterVolumeOpen) {
      this.drawMidiPortraitMasterVolumePanel(ctx, bounds);
    }
  }

  handleMidiPortraitGridQuickControl(id) {
    if (id === 'track') {
      this.closeMidiPortraitMasterVolume();
      this.midiPortraitTrackPickerOpen = !this.midiPortraitTrackPickerOpen;
      this.midiPortraitTrackPickerScroll = clamp(this.midiPortraitTrackPickerScroll, 0, this.midiPortraitTrackPickerScrollMax || 0);
      return;
    }
    if (id === 'tempo') {
      this.closeMidiPortraitTrackPicker();
      this.closeMidiPortraitMasterVolume();
      this.tempoSliderOpen = !this.tempoSliderOpen;
      return;
    }
    if (id === 'loop') {
      this.closeMidiPortraitTrackPicker();
      this.closeMidiPortraitMasterVolume();
      this.toggleLoopEnabled();
      return;
    }
    if (id === 'quantize') {
      this.closeMidiPortraitTrackPicker();
      this.closeMidiPortraitMasterVolume();
      this.tempoSliderOpen = false;
      this.noteLengthMenu.open = !this.noteLengthMenu.open;
      const quantizeBounds = this.bounds.gridQuickControls?.find((bounds) => bounds.id === 'quantize');
      this.noteLengthMenu.anchor = quantizeBounds ? { ...quantizeBounds } : null;
      return;
    }
  }

  selectMidiPortraitTrack(trackIndex) {
    if (!Number.isInteger(trackIndex)) return;
    this.selectTrackIndex(trackIndex);
    this.closeMidiPortraitTrackPicker();
  }

  drawMidiPortraitTrackPicker(ctx, anchorBounds) {
    const layout = getMidiPortraitTrackPickerLayout(anchorBounds, this.song.tracks.length);
    this.bounds.midiPortraitTrackPicker = layout.panel;
    this.bounds.midiPortraitTrackPickerScrollArea = layout.list;
    this.bounds.midiPortraitTrackPickerRows = [];
    drawSharedPanel(ctx, layout.panel, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Track', layout.panel.x + 12, layout.panel.y + 17);
    ctx.beginPath();
    ctx.rect(layout.list.x, layout.list.y, layout.list.w, layout.list.h);
    ctx.clip();
    const contentH = Math.max(0, this.song.tracks.length * (layout.rowHeight + layout.gap) - layout.gap);
    this.midiPortraitTrackPickerScrollMax = Math.max(0, contentH - layout.list.h);
    this.midiPortraitTrackPickerScroll = clamp(this.midiPortraitTrackPickerScroll, 0, this.midiPortraitTrackPickerScrollMax);
    let rowY = layout.list.y - this.midiPortraitTrackPickerScroll;
    this.song.tracks.forEach((track, index) => {
      const row = {
        x: layout.list.x,
        y: rowY,
        w: layout.list.w,
        h: layout.rowHeight,
        trackIndex: index
      };
      if (row.y + row.h >= layout.list.y - 4 && row.y <= layout.list.y + layout.list.h + 4) {
        this.bounds.midiPortraitTrackPickerRows.push(row);
        const active = index === this.selectedTrackIndex;
        this.drawSmallButton(ctx, row, `${index + 1}. ${track.name || 'Track'}`, active);
      }
      rowY += layout.rowHeight + layout.gap;
    });
    ctx.restore();
    drawSharedPortraitScrollHints(ctx, layout.list, {
      scroll: this.midiPortraitTrackPickerScroll,
      scrollMax: this.midiPortraitTrackPickerScrollMax
    });
  }

  drawMidiPortraitMasterVolumePanel(ctx, anchorBounds) {
    const layout = getMidiPortraitMasterVolumeLayout(anchorBounds);
    this.bounds.midiPortraitMasterVolumePanel = layout.panel;
    this.bounds.midiPortraitMasterVolumeSlider = layout.slider;
    drawSharedPanel(ctx, layout.panel, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Master Vol ${Math.round((this.audioSettings.masterVolume ?? 0.4) * 100)}`, layout.panel.x + 12, layout.panel.y + 18);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(layout.slider.x, layout.slider.y, layout.slider.w, layout.slider.h);
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.fillRect(layout.slider.x, layout.slider.y, layout.slider.w * clamp(this.audioSettings.masterVolume ?? 0.4, 0, 1), layout.slider.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(layout.slider.x, layout.slider.y, layout.slider.w, layout.slider.h);
    ctx.restore();
  }

  drawMidiPortraitRecordSettingsPanel(ctx, panel) {
    this.bounds.recordSettingsPanel = panel;
    this.bounds.recordSettingsControls = [];
    drawSharedPanel(ctx, panel, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    ctx.save();
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Record Settings', panel.x + 12, panel.y + 18);
    const gap = 8;
    const buttonY = panel.y + 36;
    const buttonH = 40;
    const buttonW = Math.floor((panel.w - 24 - gap * 2) / 3);
    const controls = [
      { id: 'record-quantize', label: 'Quant', active: this.recordQuantizeEnabled },
      { id: 'record-countin', label: 'Count', active: this.recordCountInEnabled },
      { id: 'record-metronome', label: 'Click', active: this.recordMetronomeEnabled }
    ];
    controls.forEach((control, index) => {
      const bounds = {
        x: panel.x + 12 + index * (buttonW + gap),
        y: buttonY,
        w: buttonW,
        h: buttonH,
        id: control.id
      };
      this.drawButton(ctx, bounds, control.label, control.active, false);
      this.bounds.recordSettingsControls.push(bounds);
    });
    let nextY = buttonY + buttonH + 14;
    const drawSectionLabel = (label) => {
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, panel.x + 12, nextY);
      nextY += 14;
    };
    const pushButton = (bounds, label, active = false) => {
      this.drawButton(ctx, bounds, label, active, false);
      this.bounds.recordSettingsControls.push(bounds);
    };
    if (this.recordInstrument === 'keyboard') {
      drawSectionLabel('Virtual Instrument');
      const currentOctave = this.song.keyboardStartOctave ?? DEFAULT_KEYBOARD_START_OCTAVE;
      const octaveW = Math.floor((panel.w - 24 - gap * 2) / 3);
      pushButton({ x: panel.x + 12, y: nextY, w: octaveW, h: buttonH, id: 'record-keyboard-octave-down' }, 'Oct -');
      pushButton({ x: panel.x + 12 + octaveW + gap, y: nextY, w: octaveW, h: buttonH, id: 'record-keyboard-octave-label', disabled: true }, `C${currentOctave}`, true);
      pushButton({ x: panel.x + 12 + (octaveW + gap) * 2, y: nextY, w: octaveW, h: buttonH, id: 'record-keyboard-octave-up' }, 'Oct +');
      nextY += buttonH + 10;
    }
    if (this.recordInstrument === 'guitar' || this.recordInstrument === 'bass') {
      const instrument = this.recordInstrument;
      const fallback = instrument === 'bass' ? STANDARD_BASS_TUNING : STANDARD_GUITAR_TUNING;
      const tuning = normalizeMidiTuning(
        instrument === 'bass' ? this.song.bassTuning : this.song.guitarTuning,
        fallback
      );
      drawSectionLabel(`${instrument === 'bass' ? 'Bass' : 'Guitar'} Tuning`);
      const columns = instrument === 'bass' ? 4 : 3;
      const stringButtonW = Math.floor((panel.w - 24 - gap * (columns - 1)) / columns);
      const stringButtonH = 38;
      tuning.forEach((pitch, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const bounds = {
          x: panel.x + 12 + col * (stringButtonW + gap),
          y: nextY + row * (stringButtonH + gap),
          w: stringButtonW,
          h: stringButtonH,
          id: 'record-tuning-string',
          instrument,
          stringIndex: index,
          delta: 1
        };
        pushButton(bounds, `S${index + 1} ${this.formatPitchLabel(pitch)}`);
      });
      nextY += Math.ceil(tuning.length / columns) * (stringButtonH + gap) + 2;
      pushButton({
        x: panel.x + 12,
        y: nextY,
        w: panel.w - 24,
        h: 38,
        id: 'record-tuning-reset',
        instrument
      }, 'Reset Standard');
      nextY += 46;
    }
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText('Tap string notes to tune up by semitone', panel.x + 12, panel.y + panel.h - 18);
    ctx.restore();
  }

  drawMobileSidebar(ctx, x, y, w, h, track, options = {}) {
    const panelGap = 10;
    const rowH = SHARED_EDITOR_LEFT_MENU.buttonHeightMobile;
    const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const panelPadding = clamp(Math.round(rowH * 0.25), 8, 12);
    const rootEntries = buildMidiSharedRootMenuEntries();
    const menuRows = rootEntries.length;
    const menuH = options.menuOnly
      ? h
      : Math.min(h * 0.62, menuRows * rowH + (menuRows - 1) * rowGap + panelPadding * 2);
    const menuX = x;
    const menuY = y;
    const controlsX = x;
    const controlsY = y + menuH + panelGap;
    const controlsH = Math.max(0, h - menuH - panelGap);

    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(menuX, menuY, w, menuH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(menuX, menuY, w, menuH);

    const innerX = menuX + panelPadding;
    const innerW = w - panelPadding * 2;
    if (options.menuOnly) {
      const actions = buildCompactLandscapeCommandRailActions({
        menu: {
          id: 'menu',
          label: 'Menu',
          active: this.landscapeRootDrawerOpen,
          action: () => { this.landscapeRootDrawerOpen = !this.landscapeRootDrawerOpen; }
        },
        undo: { id: 'undo', label: 'Undo', action: () => this.runtime.undo() },
        redo: { id: 'redo', label: 'Redo', action: () => this.runtime.redo() },
        quick: {
          id: 'play',
          label: this.isPlaying ? 'Pause' : 'Play',
          active: this.isPlaying,
          action: () => this.togglePlayback()
        }
      });
      this.bounds.tabs = [];
      this.mobileLandscapeRootMenuBounds = null;
      this.mobileLandscapeRootMenuButtons = [];
      this.mobileLandscapeRootMenuScrollMax = 0;
      buildCompactLandscapeCommandRailButtonLayout({
        bounds: { x: menuX, y: menuY, w, h: menuH },
        actions,
        buttonHeight: rowH,
        buttonGap: rowGap,
        paddingX: panelPadding,
        paddingY: panelPadding
      }).forEach(({ action: entry, bounds }) => {
        this.drawButton(ctx, bounds, entry.displayLabel ?? entry.label, Boolean(entry.active), false, this.controllerMenu.isFocusedItem('root', entry.id));
        if (entry.id === 'menu') this.bounds.landscapeMenuButton = bounds;
        if (entry.id === 'undo') this.bounds.undoButton = bounds;
        if (entry.id === 'redo') this.bounds.redoButton = bounds;
        if (entry.id === 'play') this.bounds.play = bounds;
      });
      return;
    }
    let cursorY = menuY + panelPadding;
    this.bounds.tabs = [];
    const menuButtonW = Math.min(innerW, SHARED_EDITOR_LEFT_MENU.buttonWidthMobile);
    const visibleRows = Math.max(1, Math.floor((menuH - panelPadding * 2 + rowGap) / Math.max(1, rowH + rowGap)));
    const rootScroll = options.menuOnly
      ? this.controllerMenu.syncScrollToItem(
        'root',
        this.controllerMenu.getFocusedItem('root')?.id,
        rootEntries,
        visibleRows,
        this.controllerMenu.scroll?.root || 0
      )
      : 0;
    if (options.menuOnly) {
      this.controllerMenu.scroll.root = rootScroll;
      this.mobileLandscapeRootMenuBounds = { x: menuX, y: menuY, w, h: menuH };
      this.mobileLandscapeRootMenuButtons = [];
      this.mobileLandscapeRootMenuScrollMax = Math.max(0, rootEntries.length - visibleRows);
      this.menuScrollRegions.push({
        menuId: 'root',
        bounds: this.mobileLandscapeRootMenuBounds,
        maxScroll: this.mobileLandscapeRootMenuScrollMax,
        lineHeight: 24
      });
    }
    rootEntries.slice(rootScroll, rootScroll + visibleRows).forEach((entry) => {
      const bounds = { x: innerX + (innerW - menuButtonW) * 0.5, y: cursorY, w: menuButtonW, h: rowH, id: entry.id };
      if (options.menuOnly) this.mobileLandscapeRootMenuButtons.push(bounds);
      if (entry.id === 'file') this.bounds.fileButton = bounds;
      if (MIDI_WORKSPACE_TAB_IDS.has(entry.id)) this.bounds.tabs.push(bounds);
      if (entry.id === 'settings') this.bounds.settings = bounds;
      this.drawButton(ctx, bounds, entry.label, this.isLeftRailTabActive(entry.id), false, this.controllerMenu.isFocusedItem('root', entry.id));
      cursorY += rowH + rowGap;
    });
    if (options.menuOnly) {
      drawSharedPortraitScrollHints(ctx, { x: menuX, y: menuY, w, h: menuH }, {
        scroll: rootScroll,
        scrollMax: Math.max(0, rootEntries.length - visibleRows)
      });
    }

    if (options.menuOnly) {
      return;
    }

    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(controlsX, controlsY, w, controlsH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(controlsX, controlsY, w, controlsH);

    const controlX = controlsX + panelPadding;
    const controlW = w - panelPadding * 2;
    let controlY = controlsY + panelPadding;
    this.bounds.instrumentSettingsControls = [];
    const buttonSize = rowH;
    const compactLayout = controlW < 220;
    const noteW = compactLayout ? controlW : Math.min(140, Math.max(90, controlW * 0.5));
    const selectorW = controlW - buttonSize * 2;
    const selectorX = controlX + buttonSize;
    const trackName = track?.name || 'Track';
    const instrumentName = track
      ? isDrumTrack(track)
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program)
      : 'Instrument';

    this.bounds.instrumentPrev = { x: controlX, y: controlY, w: buttonSize, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentPrev, '<', false);
    this.bounds.instrumentNext = {
      x: controlX + controlW - buttonSize,
      y: controlY,
      w: buttonSize,
      h: rowH
    };
    this.drawSmallButton(ctx, this.bounds.instrumentNext, '>', false);
    this.bounds.instrumentLabel = {
      x: selectorX + rowGap,
      y: controlY,
      w: selectorW - rowGap * 2,
      h: rowH
    };
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    const clippedName = this.truncateLabel(ctx, trackName, this.bounds.instrumentLabel.w - 8);
    ctx.fillText(clippedName, this.bounds.instrumentLabel.x + this.bounds.instrumentLabel.w / 2, controlY + 16);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '10px Courier New';
    const clippedInstrument = this.truncateLabel(ctx, instrumentName, this.bounds.instrumentLabel.w - 8);
    ctx.fillText(clippedInstrument, this.bounds.instrumentLabel.x + this.bounds.instrumentLabel.w / 2, controlY + 30);
    ctx.textAlign = 'left';
    controlY += rowH + rowGap;

    this.bounds.record = { x: controlX, y: controlY, w: controlW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.record, 'Record', false);
    controlY += rowH + rowGap;

    if (track) {
      const mix = this.getTrackBaseMix(track);
      const mixH = Math.max(86, Math.min(110, Math.round(controlsH * 0.24)));
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(controlX, controlY, controlW, mixH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(controlX, controlY, controlW, mixH);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText('Mix Controls', controlX + 8, controlY + 14);

      const buttonH = Math.max(22, Math.round(rowH * 0.55));
      const mixButtonGap = 8;
      const mixButtonW = Math.max(60, Math.min(90, (controlW - 24 - mixButtonGap) / 2));
      const mixButtonY = controlY + 20;
      const muteBounds = {
        x: controlX + 8,
        y: mixButtonY,
        w: mixButtonW,
        h: buttonH,
        trackIndex: this.selectedTrackIndex,
        control: 'mute'
      };
      const soloBounds = {
        x: muteBounds.x + mixButtonW + mixButtonGap,
        y: mixButtonY,
        w: mixButtonW,
        h: buttonH,
        trackIndex: this.selectedTrackIndex,
        control: 'solo'
      };
      this.drawSmallButton(ctx, muteBounds, 'Mute', track.mute);
      this.drawSmallButton(ctx, soloBounds, 'Solo', track.solo);
      this.bounds.instrumentSettingsControls.push(muteBounds, soloBounds);

      const sliderW = Math.max(0, controlW - 16);
      const volumeBounds = {
        x: controlX + 8,
        y: muteBounds.y + buttonH + 8,
        w: sliderW,
        h: 12,
        trackIndex: this.selectedTrackIndex,
        control: 'volume'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px Courier New';
      ctx.fillText('Volume', volumeBounds.x, volumeBounds.y - 4);
      this.bounds.instrumentSettingsControls.push(volumeBounds);

      const panBounds = {
        x: controlX + 8,
        y: volumeBounds.y + volumeBounds.h + 16,
        w: sliderW,
        h: 10,
        trackIndex: this.selectedTrackIndex,
        control: 'pan'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = '#4fb7ff';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mix.pan + 1) / 2), panBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px Courier New';
      ctx.fillText('Pan', panBounds.x, panBounds.y - 4);
      this.bounds.instrumentSettingsControls.push(panBounds);

      controlY += mixH + rowGap;
    }

    const noteLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
    this.bounds.noteLength = { x: controlX, y: controlY, w: noteW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLabel, false);
    controlY += rowH + rowGap;
    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    this.bounds.tempoButton = { x: controlX, y: controlY, w: controlW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);
    const transportGap = 6;
    const transportCols = 5;
    const transportW = (controlW - transportGap * (transportCols - 1)) / transportCols;
    const transportButtonSize = Math.max(40, Math.min(rowH, transportW));
    const transportButtons = [
      { id: 'returnStart', label: '⏮' },
      { id: 'prevBar', label: '⏪' },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶' },
      { id: 'nextBar', label: '⏩' },
      { id: 'goEnd', label: '⏭' }
    ];
    const transportY = controlsY + controlsH - panelPadding - transportButtonSize;
    const toggleCols = controlW < 220 ? 1 : 2;
    const toggleW = toggleCols === 1 ? controlW : Math.max(90, (controlW - rowGap) / 2);
    const toggleBlockH = toggleCols === 1 ? rowH * 2 + rowGap : rowH;
    const toggleRowY = transportY - rowGap - toggleBlockH;
    this.bounds.loopToggle = { x: controlX, y: toggleRowY, w: toggleW, h: rowH };
    this.drawToggle(ctx, this.bounds.loopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);
    if (toggleCols === 1) {
      this.bounds.metronome = { x: controlX, y: toggleRowY + rowH + rowGap, w: toggleW, h: rowH };
    } else {
      this.bounds.metronome = { x: controlX + toggleW + rowGap, y: toggleRowY, w: toggleW, h: rowH };
    }
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);
    transportButtons.forEach((button, index) => {
      const bounds = {
        x: controlX + index * (transportW + transportGap),
        y: transportY,
        w: transportW,
        h: transportButtonSize
      };
      this.bounds[button.id] = bounds;
      this.drawSmallButton(ctx, bounds, button.label, button.id === 'play' && this.isPlaying);
    });
  }

  drawMobilePanJoystick(ctx, width, height) {
    if (!this.isMobileLandscapeThumbZoomMode()) {
      resetSharedThumbstickState(this.panJoystick);
      return;
    }
    if (isMobilePortraitLayout({ isMobile: true, viewportWidth: width, viewportHeight: height })) {
      const layout = getMidiPortraitControlLayout(width, height);
      const railLayout = getSharedPortraitActionRailLayout(layout.bottomRail);
      this.panJoystick.center = railLayout.thumbstickCenter;
      this.panJoystick.radius = railLayout.thumbstickRadius;
      this.panJoystick.knobRadius = railLayout.knobRadius;
      drawSharedThumbstick(ctx, this.panJoystick);
      return;
    }
    if (this.landscapeRootDrawerOpen) {
      resetSharedThumbstickState(this.panJoystick);
      return;
    }
    const { center, radius: joystickRadius, knobRadius } = getSharedThumbstickLayout(width, height);
    this.panJoystick.center = center;
    this.panJoystick.radius = joystickRadius;
    this.panJoystick.knobRadius = knobRadius;
    drawSharedThumbstick(ctx, this.panJoystick);
  }

  drawLandscapeZoomOverlay(ctx, width, height) {
    const zoomXLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomXLimits.minZoom, zoomXLimits.maxZoom);
    const ratio = clamp((this.gridZoomX - zoomXLimits.minZoom) / Math.max(0.0001, zoomXLimits.maxZoom - zoomXLimits.minZoom), 0, 1);
    const controlBase = Math.min(width, height);
    const controlMargin = Math.max(16, controlBase * 0.04);
    const joystickRadius = Math.min(78, controlBase * 0.14);
    const joystickCenterX = controlMargin + joystickRadius;
    const { railBounds, hitBounds } = getSharedMobileZoomSliderLayout({
      width,
      height,
      joystickCenterX,
      joystickRadius,
      controlMargin
    });
    this.bounds.railZoom = hitBounds;
    drawSharedMobileZoomSlider(ctx, railBounds, ratio);
  }

  drawMidiHorizontalZoomSlider(ctx, x, y, w, h) {
    if (h <= 0) {
      this.bounds.railZoom = null;
      return;
    }
    const bounds = { x, y, w, h };
    drawSharedPanel(ctx, bounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    const zoomRailLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomRailLimits.minZoom, zoomRailLimits.maxZoom);
    const ratio = clamp((this.gridZoomX - zoomRailLimits.minZoom) / Math.max(0.0001, zoomRailLimits.maxZoom - zoomRailLimits.minZoom), 0, 1);
    const sliderPad = 14;
    const sliderH = 14;
    const railBounds = {
      x: bounds.x + sliderPad,
      y: bounds.y + Math.round((bounds.h - sliderH) / 2),
      w: Math.max(1, bounds.w - sliderPad * 2),
      h: sliderH
    };
    this.bounds.railZoom = {
      x: railBounds.x,
      y: railBounds.y - 10,
      w: railBounds.w,
      h: railBounds.h + 20
    };
    drawSharedMobileZoomSlider(ctx, railBounds, ratio);
  }

  drawEqualWidthButtonRow(ctx, items, options = {}) {
    const {
      x,
      y,
      width,
      height,
      gap = 8,
      draw = (bounds, item) => this.drawButton(ctx, bounds, item.label, Boolean(item.active), false)
    } = options;
    if (!Array.isArray(items) || !items.length || !Number.isFinite(width) || width <= 0) return [];
    const totalGap = gap * Math.max(0, items.length - 1);
    const availableW = Math.max(0, width - totalGap);
    const baseW = Math.floor(availableW / items.length);
    let remainder = availableW - (baseW * items.length);
    let xCursor = x;
    return items.map((item) => {
      const itemW = baseW + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      const bounds = { x: xCursor, y, w: itemW, h: height };
      draw(bounds, item);
      xCursor += itemW + gap;
      return bounds;
    });
  }

  drawMobileBottomRail(ctx, x, y, w, h, track) {
    this.bounds.railInstruments = null;
    this.bounds.railSettings = null;
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);

    const portraitRailLayout = isMobilePortraitLayout({ isMobile: true, viewportWidth: this.viewportWidth || w, viewportHeight: this.viewportHeight || h })
      ? getSharedPortraitActionRailLayout({ x, y, w, h })
      : null;
    const railX = portraitRailLayout?.actionArea.x ?? x;
    const railW = portraitRailLayout?.actionArea.w ?? w;
    const padding = 8;
    const gap = 8;
    const rowH = 48;
    if (h < 112) {
      const reserveThumbstick = isMobilePortraitLayout({
        isMobile: true,
        viewportWidth: this.viewportWidth || w,
        viewportHeight: this.viewportHeight || h
      });
      const portraitActionById = {
        menu: { id: 'menu', boundsKey: 'fileButton', label: MIDI_MENU_ICON, onClick: () => {
          if (this.activeTab === 'file') this.closeFileMenu();
          else this.activeTab = 'file';
        } },
        undo: { id: 'undo', boundsKey: 'undoButton', label: '↶', onClick: () => this.undo() },
        redo: { id: 'redo', boundsKey: 'redoButton', label: '↷', onClick: () => this.redo() },
        play: { id: 'play', label: this.isPlaying ? '❚❚' : '▶', active: this.isPlaying, primary: true, onClick: () => this.togglePlayback() }
      };
      const portraitActions = buildMidiPortraitMenuModel().bottomRailActions.map((id) => portraitActionById[id]).filter(Boolean);
      drawSharedPortraitActionRail(ctx, { x, y, w, h }, this.panJoystick, portraitActions, {
        drawPanel: false,
        drawButton: (bounds, button) => {
          this.bounds[button.boundsKey || button.id] = bounds;
          this.drawSmallButton(ctx, bounds, button.label, Boolean(button.active));
        },
        reserveThumbstick
      });
      this.drawTransportPopover(ctx);
      return;
    }
    const row1Y = y + 8;
    const row2Y = row1Y + rowH + 10;
    const innerW = railW - padding * 2;

    const navW = 48;
    const instrumentLabelW = Math.max(100, Math.floor(innerW * 0.38));
    this.bounds.instrumentPrev = { x: railX + padding, y: row1Y, w: navW, h: rowH };
    this.bounds.instrumentLabel = { x: railX + padding + navW + 4, y: row1Y, w: instrumentLabelW, h: rowH };
    this.bounds.instrumentNext = { x: this.bounds.instrumentLabel.x + instrumentLabelW + 4, y: row1Y, w: navW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentPrev, '<', false);
    const instrumentLabel = track
      ? isDrumTrack(track)
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program)
      : 'Instrument';
    this.drawSmallButton(ctx, this.bounds.instrumentLabel, instrumentLabel, false);
    this.drawSmallButton(ctx, this.bounds.instrumentNext, '>', false);

    const noteW = 130;
    const noteX = this.bounds.instrumentNext.x + navW + gap;
    this.bounds.noteLength = { x: noteX, y: row1Y, w: noteW, h: rowH };
    const noteLabel = this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex]);
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLabel, false);
    this.bounds.quantizeValue = null;

    const afterNoteX = this.bounds.noteLength.x + noteW + gap;
    const rowRight = railX + railW - padding;
    const rowRemaining = Math.max(0, rowRight - afterNoteX);
    const tempoW = Math.max(108, Math.min(148, Math.round(rowRemaining * 0.42)));
    const metronomeW = Math.max(84, rowRemaining - tempoW - gap);

    this.bounds.metronome = { x: afterNoteX, y: row1Y, w: metronomeW, h: rowH };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);

    this.bounds.tempoButton = {
      x: this.bounds.metronome.x + this.bounds.metronome.w + gap,
      y: row1Y,
      w: tempoW,
      h: rowH
    };
    this.drawSmallButton(ctx, this.bounds.tempoButton, `${this.song.tempo} BPM`, this.tempoSliderOpen);

    const transportGap = 6;
    const transportCols = 7;
    const transportW = (innerW - transportGap * (transportCols - 1)) / transportCols;
    const transportButtons = [
      { id: 'record', label: '●', active: this.recordModeActive },
      { id: 'returnStart', label: '⏮' },
      { id: 'prevBar', label: '⏪' },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶', active: this.isPlaying },
      { id: 'nextBar', label: '⏩' },
      { id: 'goEnd', label: '⏭' },
      { id: 'loopToggle', label: MIDI_LOOP_ICON, active: this.song.loopEnabled }
    ];
    transportButtons.forEach((button, index) => {
      const bounds = {
        x: railX + padding + index * (transportW + transportGap),
        y: row2Y,
        w: transportW,
        h: rowH
      };
      this.bounds[button.id] = bounds;
      this.drawSmallButton(ctx, bounds, button.label, Boolean(button.active));
    });
  }


  drawMixerPedalTransport(ctx, x, y, w, h, track, options = {}) {
    const embedded = options.embedded === true;
    const rowH = options.rowH || 36;
    const panelX = embedded ? (x + 18) : (x + 10);
    const panelY = embedded ? (y + 8) : (y + 4);
    const panelW = embedded ? (w - 36) : (w - 20);
    const panelH = Math.max(rowH + 12, h - (embedded ? 16 : 8));
    if (!embedded) {
      ctx.fillStyle = this.editorShellTheme.surfaceAlt;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(panelX, panelY, panelW, panelH);
    }
    const buttons = [
      { label: '●', control: 'transport-record' },
      { label: '⏮', control: 'transport-home' },
      { label: '⏪', control: 'transport-rewind' },
      { label: this.isPlaying ? '❚❚' : '▶', control: 'transport-play', active: this.isPlaying },
      { label: '⏩', control: 'transport-forward' },
      { label: '⏭', control: 'transport-end' },
      { label: MIDI_LOOP_ICON, control: 'transport-loop', active: this.song.loopEnabled }
    ];
    const gap = 6;
    const bw = (panelW - 16 - gap * (buttons.length - 1)) / buttons.length;
    buttons.forEach((entry, i) => {
      const b = {
        x: panelX + 8 + i * (bw + gap),
        y: panelY + 6,
        w: bw,
        h: rowH,
        trackIndex: this.selectedTrackIndex,
        control: entry.control
      };
      this.drawSmallButton(ctx, b, entry.label, Boolean(entry.active));
      this.bounds.instrumentSettingsControls.push(b);
    });
  }


  drawPedalBoardPanel(ctx, x, y, w, h, track, options = {}) {
    this.pedalSlotBounds = [];
    this.pedalPickerBounds = [];
    this.pedalInspectorBounds = [];
    this.pedalEditorOverlayBounds = null;
    this.pedalEditorModalBounds = null;
    if (!track) return;
    const embedded = options.embedded === true;
    const portraitGrid = options.portraitGrid === true;
    const compact = options.compact === true;
    const desktopOverview = !this.isMobileLayout() && !embedded && !compact && !portraitGrid && h >= 180;
    const panelX = portraitGrid ? x : (embedded ? (x + 18) : (x + 10));
    const panelW = portraitGrid ? Math.max(1, w) : (embedded ? (w - 36) : (w - 20));
    const panelH = portraitGrid ? Math.max(160, h) : Math.max(compact ? 72 : 96, h - (embedded ? 10 : 8));
    const panelY = portraitGrid ? y : (embedded ? (y + 4) : (y + h - panelH - 2));
    if (!embedded) {
      drawSharedPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    }
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.fillText('Pedal Board', panelX + 10, panelY + 16);

    const pedals = normalizeMidiPedals(track.midiPedals);
    if (Number.isInteger(this.pedalUiState.selectedSlot) && !pedals[this.pedalUiState.selectedSlot]) {
      this.pedalUiState.selectedSlot = null;
      this.pedalUiState.editorOpen = false;
      this.pedalUiState.draftPedal = null;
    }

    const gap = 8;
    const portraitLayout = portraitGrid
      ? getMidiPortraitPedalGridLayout({ x: panelX, y: panelY, w: panelW, h: panelH }, { gap: 6, padding: 6, titleHeight: 18 })
      : null;
    const slotW = portraitLayout ? null : Math.floor((panelW - 20 - gap * 3) / 4);
    const slotH = portraitLayout ? null : Math.max(compact ? 48 : 64, panelH - 32);
    for (let i = 0; i < 4; i += 1) {
      const b = portraitLayout?.slots[i] || { x: panelX + 10 + i * (slotW + gap), y: panelY + 24, w: slotW, h: slotH, slotIndex: i, control: 'pedal-slot' };
      this.pedalSlotBounds.push(b);
      const pedal = pedals[i];
      const body = pedal ? (PEDAL_COLORS[pedal.color] || '#666') : 'rgba(90,90,90,0.6)';
      ctx.fillStyle = body;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = this.pedalUiState.selectedSlot === i ? '#ffe16a' : 'rgba(0,0,0,0.65)';
      ctx.lineWidth = this.pedalUiState.selectedSlot === i ? 3 : 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.lineWidth = 1;
      if (!pedal) {
        ctx.fillStyle = UI_SUITE.colors.text;
        ctx.font = `24px ${UI_SUITE.font.family}`;
        ctx.fillText('+', b.x + b.w / 2 - 7, b.y + b.h * 0.6);
      } else {
        const pedalDef = PEDAL_DEFINITION_BY_TYPE[pedal.type];
        ctx.fillStyle = pedal.enabled ? UI_SUITE.colors.text : UI_SUITE.colors.muted;
        ctx.font = PEDAL_FONTS[pedal.type] || 'bold 12px Courier New';
        ctx.fillText(pedal.name, b.x + 6, b.y + 18);
        ctx.font = `bold 10px ${UI_SUITE.font.family}`;
        ctx.fillText(pedalDef?.effectLabel || pedal.type, b.x + 6, b.y + 32);
        ctx.fillStyle = pedal.enabled ? '#73ff8f' : '#555';
        ctx.fillRect(b.x + b.w - 12, b.y + 6, 6, 6);
        if (desktopOverview) {
          const knobDefs = pedalDef?.knobs?.slice(0, 4) || [];
          const rowTop = b.y + 48;
          const rowGap = 26;
          knobDefs.forEach((knob, knobIndex) => {
            const raw = Number(pedal.knobs?.[knob.key] ?? knob.defaultValue);
            const ratio = clamp((raw - knob.min) / Math.max(0.0001, knob.max - knob.min), 0, 1);
            const rowY = rowTop + knobIndex * rowGap;
            const label = knob.label || knob.key;
            const value = (((raw - knob.min) / Math.max(0.0001, knob.max - knob.min)) * 10).toFixed(1);
            ctx.fillStyle = 'rgba(0,0,0,0.38)';
            ctx.fillRect(b.x + 8, rowY + 8, Math.max(1, b.w - 16), 6);
            ctx.fillStyle = '#ffe16a';
            ctx.fillRect(b.x + 8, rowY + 8, Math.max(1, (b.w - 16) * ratio), 6);
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.strokeRect(b.x + 8, rowY + 8, Math.max(1, b.w - 16), 6);
            ctx.fillStyle = UI_SUITE.colors.text;
            ctx.font = `10px ${UI_SUITE.font.family}`;
            ctx.fillText(label, b.x + 8, rowY + 4, Math.max(1, b.w - 58));
            ctx.fillStyle = '#ffe16a';
            ctx.textAlign = 'right';
            ctx.fillText(value, b.x + b.w - 8, rowY + 4);
            ctx.textAlign = 'left';
          });
          ctx.fillStyle = UI_SUITE.colors.muted;
          ctx.font = `10px ${UI_SUITE.font.family}`;
          ctx.fillText('Click to edit', b.x + 8, b.y + b.h - 10);
        } else {
          const knobY = b.y + b.h - 16;
          [0.24, 0.5, 0.76].forEach((pos) => {
            const kx = b.x + b.w * pos;
            ctx.fillStyle = 'rgba(16,16,20,0.95)';
            ctx.beginPath();
            ctx.arc(kx, knobY, 5, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    }

    if (this.pedalUiState.pickerOpen) {
      const viewportW = this.viewportWidth || w;
      const viewportH = this.viewportHeight || (y + h + 100);
      const mw = Math.min(420, Math.max(280, Math.round(w * 0.34)));
      const mh = Math.min(520, Math.max(320, Math.round(viewportH * 0.62)));
      const mx = Math.round((viewportW - mw) / 2);
      const my = Math.round((viewportH - mh) / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, viewportW, viewportH);
      drawSharedPanel(ctx, { x: mx, y: my, w: mw, h: mh }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `14px ${UI_SUITE.font.family}`;
      ctx.fillText('Choose Pedal', mx + 12, my + 20);
      const list = { x: mx + 10, y: my + 30, w: mw - 20, h: mh - 40, control: 'pedal-picker-scroll-area' };
      this.pedalPickerBounds.push(list);
      const itemH = 56;
      const gapY = 8;
      const contentH = PEDAL_DEFINITIONS.length * (itemH + gapY);
      this.pedalUiState.pickerScrollMax = Math.max(0, contentH - list.h);
      this.pedalUiState.pickerScroll = clamp(this.pedalUiState.pickerScroll || 0, 0, this.pedalUiState.pickerScrollMax);
      let rowY = list.y - this.pedalUiState.pickerScroll;
      PEDAL_DEFINITIONS.forEach((def) => {
        const b = { x: list.x + 4, y: rowY, w: list.w - 8, h: itemH, control: 'pedal-picker-item', pedalType: def.type };
        if (b.y + b.h >= list.y - 8 && b.y <= list.y + list.h + 8) {
          this.pedalPickerBounds.push(b);
          ctx.fillStyle = PEDAL_COLORS[def.color] || '#666';
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.fillStyle = UI_SUITE.colors.text;
          ctx.font = PEDAL_FONTS[def.type] || 'bold 13px Courier New';
          ctx.fillText(def.name, b.x + 8, b.y + 20);
          ctx.fillStyle = UI_SUITE.colors.muted;
          ctx.font = `11px ${UI_SUITE.font.family}`;
          ctx.fillText(def.effectLabel || def.type, b.x + 8, b.y + 38);
        }
        rowY += itemH + gapY;
      });
    }


    const selectedSlot = this.pedalUiState.selectedSlot;
    const selectedPedal = Number.isInteger(selectedSlot) ? pedals[selectedSlot] : null;
    const editorPedal = this.pedalUiState.editorOpen ? (this.pedalUiState.draftPedal || selectedPedal) : null;
    if (!editorPedal || !this.pedalUiState.editorOpen) return;

    const def = PEDAL_DEFINITION_BY_TYPE[editorPedal.type];
    const modalW = Math.min(320, Math.max(220, Math.round(w * 0.28)));
    const modalH = Math.min(560, Math.max(360, modalW * 2));
    const viewportW = this.viewportWidth || w;
    const viewportH = this.viewportHeight || (y + h + 100);
    const modalX = Math.round((viewportW - modalW) / 2);
    const modalY = Math.round((viewportH - modalH) / 2);
    this.pedalEditorOverlayBounds = { x: 0, y: 0, w: viewportW, h: viewportH };
    this.pedalEditorModalBounds = { x: modalX, y: modalY, w: modalW, h: modalH };
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, viewportW, viewportH);
    ctx.fillStyle = PEDAL_COLORS[editorPedal.color] || '#666';
    ctx.fillRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.strokeRect(modalX, modalY, modalW, modalH);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(modalX + 8, modalY + 8, modalW - 16, 20);
    const editorDef = PEDAL_DEFINITION_BY_TYPE[editorPedal.type];
    ctx.fillStyle = '#fff';
    ctx.font = (PEDAL_FONTS[editorPedal.type] || 'bold 20px Courier New').replace('12px', '20px');
    ctx.fillText(editorPedal.name, modalX + 12, modalY + 25);
    ctx.font = 'bold 16px Courier New';
    ctx.fillText(editorDef?.effectLabel || editorPedal.type, modalX + 12, modalY + 46);

    const ledRadius = 6;
    const ledX = modalX + modalW - 24;
    const ledY = modalY + 20;
    ctx.beginPath();
    ctx.fillStyle = editorPedal.enabled ? '#36f26d' : '#e14343';
    ctx.arc(ledX, ledY, ledRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(editorPedal.enabled ? 'ON' : 'OFF', ledX - 10, ledY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const patterns = {
      octave: [[0.3, 0.28], [0.7, 0.28], [0.3, 0.5], [0.7, 0.5]],
      compressor: [[0.22, 0.32], [0.4, 0.32], [0.58, 0.32], [0.76, 0.32]],
      wah: [[0.5, 0.26], [0.35, 0.42], [0.65, 0.42], [0.5, 0.56]],
      chorus: [[0.25, 0.38], [0.75, 0.38], [0.5, 0.54], [0.5, 0.72]],
      eq: [[0.2, 0.48], [0.4, 0.42], [0.6, 0.42], [0.8, 0.48]],
      overdrive: [[0.28, 0.34], [0.72, 0.34], [0.5, 0.56], [0.5, 0.76]],
      reverb: [[0.26, 0.4], [0.74, 0.4], [0.26, 0.64], [0.74, 0.64]],
      phaser: [[0.5, 0.34], [0.5, 0.52], [0.3, 0.68], [0.7, 0.68]]
    };
    const knobDefs = def?.knobs?.slice(0, 4) || [];
    const points = patterns[editorPedal.type] || patterns.chorus;
    knobDefs.forEach((knob, index) => {
      const [nx, ny] = points[index] || [0.5, 0.5];
      const centerX = modalX + modalW * nx;
      const centerY = modalY + modalH * ny - 20;
      const radius = 26;
      const hit = { x: centerX - 30, y: centerY - 30, w: 60, h: 72, control: 'pedal-knob', knobKey: knob.key, min: knob.min, max: knob.max };
      this.pedalInspectorBounds.push(hit);
      const raw = editorPedal.knobs?.[knob.key] ?? knob.defaultValue;
      const ratio = (raw - knob.min) / Math.max(0.0001, knob.max - knob.min);
      const minAngleDeg = 225;
      const maxAngleDeg = 315;
      const angle = (minAngleDeg + ratio * (maxAngleDeg - minAngleDeg)) * (Math.PI / 180);
      ctx.fillStyle = 'rgba(12,12,16,0.96)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 5, (minAngleDeg * Math.PI) / 180, (maxAngleDeg * Math.PI) / 180);
      ctx.stroke();
      ctx.lineWidth = 1;
      const minX = centerX + Math.cos((minAngleDeg * Math.PI) / 180) * (radius + 9);
      const minY = centerY + Math.sin((minAngleDeg * Math.PI) / 180) * (radius + 9);
      const maxX = centerX + Math.cos((maxAngleDeg * Math.PI) / 180) * (radius + 9);
      const maxY = centerY + Math.sin((maxAngleDeg * Math.PI) / 180) * (radius + 9);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('min', minX - 8, minY + 8);
      ctx.fillText('max', maxX + 8, maxY + 8);
      ctx.strokeStyle = '#ffe16a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * (radius - 4), centerY + Math.sin(angle) * (radius - 4));
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText(knob.label, centerX, centerY + 42);
      const scaled = ((raw - knob.min) / Math.max(0.0001, knob.max - knob.min)) * 10;
      ctx.font = 'bold 11px Courier New';
      ctx.fillStyle = '#ffe16a';
      ctx.fillText(`${scaled.toFixed(1)}/10`, centerX, centerY + 56);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    });

    const stompY = modalY + Math.round(modalH * 0.7);
    const stompH = Math.round(modalH * 0.2);
    const stomp = { x: modalX + 10, y: stompY, w: modalW - 20, h: stompH, control: 'pedal-stomp-toggle' };
    this.pedalInspectorBounds.push(stomp);
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(stomp.x, stomp.y, stomp.w, stomp.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(stomp.x, stomp.y, stomp.w, stomp.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(editorPedal.enabled ? 'ON' : 'OFF', stomp.x + stomp.w / 2, stomp.y + stomp.h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const btnY = modalY + modalH - 40;
    const btnW = Math.floor((modalW - 28) / 3);
    const cancel = { x: modalX + 8, y: btnY, w: btnW, h: 34, control: 'pedal-cancel' };
    const ok = { x: cancel.x + btnW + 6, y: btnY, w: btnW, h: 34, control: 'pedal-ok' };
    const del = { x: ok.x + btnW + 6, y: btnY, w: btnW, h: 34, control: 'pedal-delete' };
    this.pedalInspectorBounds.push(cancel, ok, del);
    this.drawButton(ctx, cancel, 'Cancel', false, false);
    this.drawButton(ctx, ok, 'OK', true, false);
    this.drawDangerButton(ctx, del, 'Delete');
  }



  getSidebarWidth(viewWidth, {
    ratio,
    min,
    max,
    padding,
    gap,
    minContent
  }) {
    const safePadding = padding ?? 16;
    const safeGap = gap ?? 12;
    const safeContent = minContent ?? 200;
    const available = viewWidth - safePadding * 2 - safeGap - safeContent;
    const maxAllowed = Math.max(0, Math.min(max, available));
    const minAllowed = Math.min(min, maxAllowed || min);
    return clamp(viewWidth * ratio, minAllowed, maxAllowed || minAllowed);
  }

  getButtonFontSize(bounds, isMobile) {
    const target = Math.round(bounds.h * 0.45);
    const maxSize = isMobile ? 18 : 16;
    return clamp(target, 12, maxSize);
  }

  truncateLabel(ctx, label, maxWidth) {
    if (ctx.measureText(label).width <= maxWidth) return label;
    let truncated = label;
    while (truncated.length > 4 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  }

  getNoteLengthDisplay(option, includeLabel = false) {
    if (!option) return '';
    const icon = NOTE_VALUE_ICONS[option.label] || option.icon || option.label;
    if (includeLabel && option.label && option.label !== icon) {
      return `${icon} ${option.label}`;
    }
    return icon;
  }

  getCompactNoteLengthDisplay(option) {
    if (!option) return '';
    return NOTE_VALUE_ICONS[option.label] || option.icon || option.label;
  }

  drawHeader(ctx, x, y, w, h, track) {
    const padding = 12;
    const gmStatus = this.game?.audio?.getGmStatus?.();
    if (gmStatus) {
      const statusText = !gmStatus.enabled
        ? 'SoundFont Off'
        : gmStatus.error
          ? 'SoundFont Error'
          : gmStatus.loading
            ? 'Loading SoundFont…'
            : 'SoundFont Ready';
      ctx.fillStyle = gmStatus.error ? this.editorShellTheme.danger : this.editorShellTheme.textMuted;
      ctx.font = '12px Courier New';
      ctx.fillText(statusText, x + padding, y + padding + 12);
      if (gmStatus.error) {
        const bannerText = `SoundFont error: ${gmStatus.error}`;
        const bannerH = 22;
        const bannerY = y + h - bannerH - 8;
        ctx.fillStyle = this.editorShellTheme.dangerSurface;
        ctx.fillRect(x + 8, bannerY, w - 16, bannerH);
        ctx.strokeStyle = this.editorShellTheme.dangerBorder;
        ctx.strokeRect(x + 8, bannerY, w - 16, bannerH);
        ctx.fillStyle = this.editorShellTheme.dangerText;
        ctx.font = '12px Courier New';
        ctx.fillText(this.truncateLabel(ctx, bannerText, w - 28), x + 14, bannerY + 15);
      }
    }
  }

  drawTabs(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panelAlt;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    const gap = 6;
    const isMobile = this.isMobileLayout();
    const fileW = isMobile ? 72 : 80;
    const tabsW = w - fileW - gap;
    const tabW = (tabsW - gap * (TAB_OPTIONS.length - 1)) / TAB_OPTIONS.length;
    this.bounds.tabs = [];
    this.bounds.fileButton = { x, y, w: fileW, h };
    this.drawButton(ctx, this.bounds.fileButton, SHARED_EDITOR_LEFT_MENU.fileLabel, this.activeTab === 'file', false, this.controllerMenu.isFocusedItem('root', 'file'));
    let cursorX = x + fileW + gap;
    TAB_OPTIONS.forEach((tab, index) => {
      const tabX = cursorX + index * (tabW + gap);
      const bounds = { x: tabX, y, w: tabW, h, id: tab.id };
      this.bounds.tabs.push(bounds);
      const active = this.isLeftRailTabActive(tab.id);
      this.drawButton(ctx, bounds, tab.label, active, false, this.controllerMenu.isFocusedItem('root', tab.id));
    });
  }

  drawTransportBar(ctx, x, y, w, h) {
    ctx.fillStyle = UI_SUITE.colors.panelAlt;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    this.bounds.transportBar = { x, y, w, h };
    const isMobile = this.isMobileLayout();
    const gap = 12;
    const topAreaH = Math.max(46, h * 0.5);
    const buttonH = Math.max(34, topAreaH - 20);
    const baseButtonW = Math.min(72, (w - gap * 7) / 6);
    const buttonSpecs = [
      { id: 'returnStart', label: '⏮', w: baseButtonW },
      { id: 'prevBar', label: '⏪', w: baseButtonW },
      { id: 'record', label: '●', w: baseButtonW, active: this.recordModeActive, emphasis: true },
      { id: 'play', label: this.isPlaying ? '❚❚' : '▶', w: baseButtonW * 1.3, active: this.isPlaying, emphasis: true },
      { id: 'nextBar', label: '⏩', w: baseButtonW },
      { id: 'goEnd', label: '⏭', w: baseButtonW }
    ];
    const rawTotalW = buttonSpecs.reduce((sum, button) => sum + button.w, 0) + gap * (buttonSpecs.length - 1);
    const scale = rawTotalW > w ? w / rawTotalW : 1;
    const totalW = rawTotalW * scale;
    const startX = x + (w - totalW) / 2;
    const centerY = y + 10;
    const drawTransportButton = (button, bx) => {
      const buttonW = button.w * scale;
      const bounds = { x: bx, y: centerY, w: buttonW, h: buttonH };
      this.bounds[button.id] = bounds;
      drawSharedTransportIconButton(ctx, bounds, {
        icon: button.label,
        active: Boolean(button.active),
        emphasis: Boolean(button.emphasis),
        role: button.id === 'record' ? 'record' : 'default'
      });
    };
    let cursorX = startX;
    buttonSpecs.forEach((button) => {
      drawTransportButton(button, cursorX);
      cursorX += button.w * scale + gap;
    });

    const railY = y + topAreaH;
    const railPadding = 12;
    const railGap = 10;
    const railH = 24;
    const railW = w - railPadding * 2;
    const zoomW = Math.max(220, Math.round(railW * 0.36));
    const buttonW = Math.max(96, Math.round((railW - zoomW - railGap * 3) / 3));
    let railX = x + railPadding;
    this.bounds.railInstruments = { x: railX, y: railY, w: buttonW, h: railH };
    this.drawSmallButton(ctx, this.bounds.railInstruments, 'Instruments', this.activeTab === 'instruments');
    railX += buttonW + railGap;
    this.bounds.railSettings = { x: railX, y: railY, w: buttonW, h: railH };
    this.drawSmallButton(ctx, this.bounds.railSettings, 'Settings', this.activeTab === 'settings');
    railX += buttonW + railGap;
    this.bounds.transportLoopToggle = { x: railX, y: railY, w: buttonW, h: railH };
    this.bounds.loopToggle = this.bounds.transportLoopToggle;
    this.drawToggle(ctx, this.bounds.transportLoopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);

    const zoomRailLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomRailLimits.minZoom, zoomRailLimits.maxZoom);
    const zoomRatio = clamp((this.gridZoomX - zoomRailLimits.minZoom) / Math.max(0.0001, zoomRailLimits.maxZoom - zoomRailLimits.minZoom), 0, 1);
    const sliderY = railY + railH + 8;
    this.bounds.railZoom = { x: x + w - railPadding - zoomW, y: sliderY, w: zoomW, h: 12 };
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(this.bounds.railZoom.x, this.bounds.railZoom.y, this.bounds.railZoom.w, this.bounds.railZoom.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(this.bounds.railZoom.x, this.bounds.railZoom.y, this.bounds.railZoom.w * zoomRatio, this.bounds.railZoom.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(this.bounds.railZoom.x, this.bounds.railZoom.y, this.bounds.railZoom.w, this.bounds.railZoom.h);
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText(`Grid Zoom ${this.gridZoomX.toFixed(2)}x`, this.bounds.railZoom.x, this.bounds.railZoom.y - 4);

    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = UI_SUITE.colors.accent2;
      ctx.font = `${isMobile ? 12 : 13}px ${UI_SUITE.font.family}`;
      ctx.fillText('Single Note Mode', x + 12, y + h - 6);
    }

    const position = this.getPositionLabel();
    ctx.fillStyle = UI_SUITE.colors.accent;
    ctx.font = `${isMobile ? 12 : 13}px ${UI_SUITE.font.family}`;
    ctx.fillText(position, x + 12, y + 18);
  }

  drawGridTab(ctx, x, y, w, h, track, pattern) {
    const controlsH = this.drawGridControls(ctx, x, y, w, track);
    const gridY = y + controlsH + 12;
    const gridH = h - controlsH - 12;
    this.drawPatternEditor(ctx, x, gridY, w, gridH, track, pattern);
    this.clearGridZoomButtonBounds();
  }

  drawSongTab(ctx, x, y, w, h, options = {}) {
    const padding = 0;
    const rulerH = DEFAULT_RULER_HEIGHT;
    const rulerY = y + padding;
    const laneAreaY = rulerY + rulerH;
    const isMobile = this.isMobileLayout();
    const isPortrait = isMobilePortraitLayout({
      isMobile,
      viewportWidth: this.viewportWidth || w,
      viewportHeight: this.viewportHeight || h
    });
    let baseMixRailH = isPortrait ? 206 : (isMobile ? 148 : 120);
    const railGap = 8;
    const externalPortraitRail = isPortrait ? options.portraitRailBounds : null;
    const portraitSongZoomH = 0;
    const portraitSongZoomGap = portraitSongZoomH > 0 ? railGap : 0;
    const extraTrackRowH = isMobile ? 0 : 48;
    if (externalPortraitRail) {
      baseMixRailH = externalPortraitRail.h;
    }
    let laneAreaH = externalPortraitRail
      ? Math.max(0, h - rulerH)
      : Math.max(0, h - rulerH - baseMixRailH - railGap - portraitSongZoomH - portraitSongZoomGap + extraTrackRowH);
    const trackCount = Math.max(1, this.song.tracks.length);
    const laneGap = trackCount > 8 ? 6 : 10;
    const visibleLaneCount = Math.min(4, trackCount);
    const showAutomation = this.keyframePanelOpen;
    const referenceCellHeight = Number.isFinite(this.gridBounds?.cellHeight)
      ? this.gridBounds.cellHeight
      : 24;
    let laneBlockH;
    let laneH;
    let automationH;
    if (isMobile) {
      const zoomDecoupledCellHeight = (Number.isFinite(this.gridBounds?.cellHeight)
        && Number.isFinite(this.gridZoomY)
        && this.gridZoomY > 0)
        ? (this.gridBounds.cellHeight / this.gridZoomY)
        : referenceCellHeight;
      const songLaneCellHeight = clamp(zoomDecoupledCellHeight, 8, 24);
      // Keep Song ribbons fixed around ~3 grid-note rows, with a touch-friendly height boost, independent of live grid zoom.
      laneH = Math.max(56, Math.round(songLaneCellHeight * 3.8));
      if (showAutomation) {
        automationH = Math.max(24, Math.round(songLaneCellHeight * 1.2));
        laneBlockH = laneH + 6 + automationH + 6 + automationH;
      } else {
        automationH = 0;
        laneBlockH = laneH;
      }
      const desiredLaneAreaH = visibleLaneCount * laneBlockH + Math.max(0, visibleLaneCount - 1) * laneGap;
      laneAreaH = Math.min(laneAreaH, desiredLaneAreaH);
    } else {
      laneBlockH = Math.max(48, (laneAreaH - laneGap * Math.max(0, visibleLaneCount - 1)) / visibleLaneCount);
      laneH = showAutomation ? Math.max(36, laneBlockH * 0.42) : laneBlockH;
      automationH = showAutomation ? Math.max(24, (laneBlockH - laneH) / 2 - 6) : 0;
    }
    const laneContentH = Math.max(0, trackCount * laneBlockH + Math.max(0, trackCount - 1) * laneGap);
    this.songTrackScrollMax = Math.max(0, laneContentH - laneAreaH);
    this.songTrackScroll = clamp(this.songTrackScroll, 0, this.songTrackScrollMax);
    if (Number.isInteger(this.pendingTrackFocusIndex) && this.activeTab === 'song') {
      const focusTop = this.pendingTrackFocusIndex * (laneBlockH + laneGap);
      const centered = focusTop - (laneAreaH - laneBlockH) * 0.5;
      this.songTrackScroll = clamp(centered, 0, this.songTrackScrollMax);
      this.pendingTrackFocusIndex = null;
    }
    let laneScrollY = this.songTrackScroll;
    const labelW = isPortrait
      ? Math.min(96, Math.max(DEFAULT_LABEL_WIDTH_MOBILE_PORTRAIT, Math.round(w * 0.24)))
      : (isMobile ? DEFAULT_LABEL_WIDTH_MOBILE : DEFAULT_LABEL_WIDTH);
    const laneX = x + padding + labelW;
    const laneW = w - padding * 2 - labelW;
    this.songActionBounds = [];
    this.songPartBounds = [];
    this.songPartHandleBounds = [];

    this.songInstrumentBounds = null;
    this.bounds.songZoomIn = null;
    this.bounds.songZoomOut = null;
    this.songPlayheadBounds = null;
    const selectionRange = this.getSongSelectionRange();

    this.songLaneBounds = [];
    this.songLabelBounds = [];
    this.songAutomationBounds = [];
    this.bounds.songTrackScrollArea = { x: x + padding, y: laneAreaY, w: w - padding * 2, h: laneAreaH };
    let timelineTicks = this.getSongTimelineTicks();
    const baseCellWidth = laneW / timelineTicks;
    const zoomXLimits = this.getGridZoomLimitsX();
    this.gridZoomX = clamp(this.gridZoomX, zoomXLimits.minZoom, zoomXLimits.maxZoom);
    let cellWidth = baseCellWidth * this.gridZoomX;
    this.ensureTimelineCapacity();
    timelineTicks = this.getSongTimelineTicks();
    cellWidth = (laneW / timelineTicks) * this.gridZoomX;
    let offsetX = -this.timelineStartTick * cellWidth;
    offsetX = this.clampTimelineOffsetX(offsetX, laneW, cellWidth);
    this.songTimelineOffsetX = offsetX;
    this.timelineStartTick = Math.max(0, -offsetX / cellWidth);
    this.timelineSource = 'song';
    const totalW = cellWidth * timelineTicks;
    const originX = laneX + offsetX;
    this.songTimelineBounds = {
      x: laneX,
      y: rulerY,
      w: laneW,
      h: laneAreaH + rulerH,
      originX,
      cellWidth,
      totalW,
      timelineTicks
    };
    if (this.pendingSongFocus) {
      const focusTick = Number.isFinite(this.pendingSongFocus.tick) ? this.pendingSongFocus.tick : this.playheadTick;
      const focusOffset = laneW / 2 - focusTick * cellWidth;
      this.songTimelineOffsetX = this.clampTimelineOffsetX(focusOffset, laneW, cellWidth);
      this.timelineStartTick = Math.max(0, -this.songTimelineOffsetX / cellWidth);
      this.songTimelineBounds.originX = laneX + this.songTimelineOffsetX;
      if (Number.isInteger(this.pendingSongFocus.trackIndex)) {
        const focusTop = this.pendingSongFocus.trackIndex * (laneBlockH + laneGap);
        const centered = focusTop - (laneAreaH - laneBlockH) * 0.5;
        this.songTrackScroll = clamp(centered, 0, this.songTrackScrollMax);
        laneScrollY = this.songTrackScroll;
      }
      this.pendingSongFocus = null;
    }
    this.songRulerBounds = {
      x: laneX,
      y: rulerY,
      w: laneW,
      h: rulerH
    };

    this.song.tracks.forEach((track, index) => {
      const laneTop = laneAreaY - laneScrollY + index * (laneBlockH + laneGap);
      if (laneTop + laneBlockH < laneAreaY - 4 || laneTop > laneAreaY + laneAreaH + 4) return;
      const labelX = x + padding;
      ctx.fillStyle = index === this.selectedTrackIndex ? 'rgba(255,225,106,0.3)' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(labelX, laneTop, labelW, laneBlockH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(labelX, laneTop, labelW, laneBlockH);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText(this.truncateLabel(ctx, track.name, labelW - 20), labelX + 10, laneTop + 18);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '10px Courier New';
      const instrumentLabel = isDrumTrack(track)
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program);
      ctx.fillText(this.truncateLabel(ctx, instrumentLabel, labelW - 20), labelX + 10, laneTop + 34);
      this.songLabelBounds.push({ x: labelX, y: laneTop, w: labelW, h: laneBlockH, trackIndex: index });

      const laneBounds = { x: laneX, y: laneTop, w: laneW, h: laneH, trackIndex: index };
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      ctx.strokeStyle = track.color || 'rgba(255,255,255,0.2)';
      ctx.strokeRect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      this.songLaneBounds.push(laneBounds);

      ctx.save();
      ctx.beginPath();
      ctx.rect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      ctx.clip();
      const ticksPerBar = this.getTicksPerBar();
      for (let barTick = 0; barTick <= timelineTicks; barTick += ticksPerBar) {
        const barX = originX + barTick * cellWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(barX, laneBounds.y);
        ctx.lineTo(barX, laneBounds.y + laneBounds.h);
        ctx.stroke();
      }
      if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
        const loopStartX = originX + this.song.loopStartTick * cellWidth;
        const loopEndX = originX + this.song.loopEndTick * cellWidth;
        ctx.fillStyle = 'rgba(255,225,106,0.12)';
        ctx.fillRect(loopStartX, laneBounds.y, loopEndX - loopStartX, laneBounds.h);
      }

      const pattern = track.patterns?.[this.selectedPatternIndex];
      if (pattern) {
        const partRanges = this.getPatternPartRanges(pattern, timelineTicks)
          .map((range, idx) => ({ ...range, partIndex: idx }));
        partRanges.forEach((range) => {
          const partStart = range.startTick;
          const partEnd = range.endTick;
          const partX = originX + partStart * cellWidth;
          const partW = Math.max(1, (partEnd - partStart) * cellWidth);
          const partBounds = {
            x: partX,
            y: laneBounds.y,
            w: partW,
            h: laneBounds.h,
            trackIndex: index,
            partIndex: range.partIndex,
            startTick: partStart,
            endTick: partEnd
          };
          this.songPartBounds.push(partBounds);
          const partSelected = selectionRange
            && selectionRange.trackStartIndex === index
            && selectionRange.trackEndIndex === index
            && selectionRange.startTick === partStart
            && selectionRange.endTick === partEnd;
          const partBaseColor = track.color || '#ffffff';
          ctx.fillStyle = partSelected
            ? toRgba(partBaseColor, 0.66)
            : toRgba(partBaseColor, 0.3);
          ctx.fillRect(partX, laneBounds.y, partW, laneBounds.h);
          if (Array.isArray(pattern.partRanges) && pattern.partRanges.length > 0 && range.partIndex > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,225,106,0.6)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(partX, laneBounds.y + 1);
            ctx.lineTo(partX, laneBounds.y + laneBounds.h - 1);
            ctx.stroke();
            ctx.restore();
          }
          if (partSelected) {
            const handleW = 14;
            const handleHitPad = 8;
            const clonePaintSelectedPart = this.songClonePaintTool.active
              && this.songClonePaintTool.trackIndex === index
              && this.songClonePaintTool.baseStartTick === partStart
              && this.songClonePaintTool.baseEndTick === partEnd;
            const leftHandle = {
              x: partX - handleW / 2,
              y: laneBounds.y + 2,
              w: handleW,
              h: Math.max(8, laneBounds.h - 4),
              trackIndex: index,
              partIndex: range.partIndex,
              edge: 'start'
            };
            const rightHandle = {
              x: partX + partW - handleW / 2,
              y: laneBounds.y + 2,
              w: handleW,
              h: Math.max(8, laneBounds.h - 4),
              trackIndex: index,
              partIndex: range.partIndex,
              edge: 'end'
            };
            this.songPartHandleBounds.push(
              {
                ...leftHandle,
                x: leftHandle.x - handleHitPad,
                y: leftHandle.y - handleHitPad,
                w: leftHandle.w + handleHitPad * 2,
                h: leftHandle.h + handleHitPad * 2
              },
              {
                ...rightHandle,
                x: rightHandle.x - handleHitPad,
                y: rightHandle.y - handleHitPad,
                w: rightHandle.w + handleHitPad * 2,
                h: rightHandle.h + handleHitPad * 2
              }
            );
            const leftHandleColor = clonePaintSelectedPart
              ? 'rgba(120,170,255,0.9)'
              : 'rgba(255,225,106,0.95)';
            const rightHandleColor = clonePaintSelectedPart
              ? 'rgba(80,255,205,0.98)'
              : 'rgba(255,225,106,0.95)';
            ctx.fillStyle = leftHandleColor;
            ctx.fillRect(leftHandle.x, leftHandle.y, leftHandle.w, leftHandle.h);
            ctx.fillStyle = rightHandleColor;
            ctx.fillRect(rightHandle.x, rightHandle.y, rightHandle.w, rightHandle.h);
          }
        });
      }

      if (pattern) {
        const notes = pattern.notes || [];
        if (notes.length > 0) {
          const pitches = notes.map((note) => note.pitch);
          const minPitch = Math.min(...pitches);
          const maxPitch = Math.max(...pitches);
          const range = Math.max(1, maxPitch - minPitch);
          notes.forEach((note) => {
            const noteX = originX + note.startTick * cellWidth;
            const noteW = Math.max(2, note.durationTicks * cellWidth);
            const pitchRatio = (note.pitch - minPitch) / range;
            const noteY = laneBounds.y + 4 + (1 - pitchRatio) * (laneBounds.h - 8);
            ctx.fillStyle = toRgba(track.color, 0.7);
            ctx.fillRect(noteX, noteY - 2, noteW, 4);
          });
        }
      }

      const laneOverlayMode = this.songBottomRailMode === 'pan'
        ? 'pan'
        : (this.songBottomRailMode === 'volume' ? 'volume' : null);
      if (laneOverlayMode) {
        this.drawSongAutomationOverlay(ctx, laneBounds, track, {
          originX,
          cellWidth,
          timelineTicks,
          mode: laneOverlayMode
        });
      }

      if (selectionRange && index >= selectionRange.trackStartIndex && index <= selectionRange.trackEndIndex) {
        const selStart = originX + selectionRange.startTick * cellWidth;
        const selEnd = originX + selectionRange.endTick * cellWidth;
        ctx.fillStyle = 'rgba(255,225,106,0.2)';
        ctx.fillRect(selStart, laneBounds.y, selEnd - selStart, laneBounds.h);
        ctx.strokeStyle = 'rgba(255,225,106,0.6)';
        ctx.strokeRect(selStart, laneBounds.y, selEnd - selStart, laneBounds.h);
      }
      if (this.songSplitTool.active
        && selectionRange
        && (index < selectionRange.trackStartIndex || index > selectionRange.trackEndIndex)) {
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
      }
      ctx.restore();

      if (showAutomation) {
        const panBounds = {
          x: laneX,
          y: laneTop + laneH + 6,
          w: laneW,
          h: automationH,
          trackIndex: index,
          type: 'pan'
        };
        const padBounds = {
          x: laneX,
          y: panBounds.y + automationH + 6,
          w: laneW,
          h: automationH,
          trackIndex: index,
          type: 'padding'
        };
        const panValue = this.getTrackAutomationValue(track, 'pan', this.playheadTick, track.pan ?? 0);
        const volumeValue = this.getTrackAutomationValue(track, 'padding', this.playheadTick, track.volume ?? 0.8);
        this.drawAutomationLane(ctx, panBounds, track.automation?.pan || [], -1, 1, 'Pan', {
          originX,
          cellWidth
        }, { tick: this.playheadTick, value: panValue });
        this.drawAutomationLane(ctx, padBounds, track.automation?.padding || [], 0, 1, 'Volume', {
          originX,
          cellWidth
        }, { tick: this.playheadTick, value: volumeValue });
        this.songAutomationBounds.push(panBounds, padBounds);
      }
    });

    if (isMobile && this.bounds.songTrackScrollArea) {
      drawSharedPortraitScrollHints(ctx, this.bounds.songTrackScrollArea, {
        scroll: this.songTrackScroll,
        scrollMax: this.songTrackScrollMax
      });
    }

    this.drawTimelineRuler(ctx, laneX, rulerY, laneW, rulerH, timelineTicks, this.songTimelineBounds);
    this.drawSongPlayhead(ctx, this.songTimelineBounds.y, laneAreaY + laneAreaH);

    const selectedTrack = this.song.tracks[this.selectedTrackIndex];
    const zoomStripY = laneAreaY + laneAreaH + railGap;
    if (isPortrait && portraitSongZoomH > 0) {
      this.drawMidiHorizontalZoomSlider(ctx, x + padding, zoomStripY, w - padding * 2, portraitSongZoomH);
    }
    const mixRailY = zoomStripY + portraitSongZoomH + portraitSongZoomGap;
    const mixRailH = Math.max(baseMixRailH, y + h - mixRailY);
    const mixRailBounds = externalPortraitRail
      ? { ...externalPortraitRail }
      : { x: x + padding, y: mixRailY, w: w - padding * 2, h: mixRailH };
    this.bounds.songMixRail = mixRailBounds;
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(mixRailBounds.x, mixRailBounds.y, mixRailBounds.w, mixRailBounds.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(mixRailBounds.x, mixRailBounds.y, mixRailBounds.w, mixRailBounds.h);

    if (!isPortrait) {
      const zoomRailLimits = this.getGridZoomLimitsX();
      this.gridZoomX = clamp(this.gridZoomX, zoomRailLimits.minZoom, zoomRailLimits.maxZoom);
      const zoomRatio = clamp((this.gridZoomX - zoomRailLimits.minZoom) / Math.max(0.0001, zoomRailLimits.maxZoom - zoomRailLimits.minZoom), 0, 1);
      const viewportWidth = this.viewportWidth || (x + w);
      const viewportHeight = this.viewportHeight || (y + h);
      const controlBase = Math.min(viewportWidth, viewportHeight);
      const controlMargin = Math.max(16, controlBase * 0.04);
      const joystickRadius = Math.min(78, controlBase * 0.14);
      const joystickCenterX = controlMargin + joystickRadius;
      const { railBounds: zoomRailBounds, hitBounds: zoomHitBounds } = getSharedMobileZoomSliderLayout({
        width: viewportWidth,
        height: viewportHeight,
        joystickCenterX,
        joystickRadius,
        controlMargin
      });
      this.bounds.railZoom = zoomHitBounds;
      drawSharedMobileZoomSlider(ctx, zoomRailBounds, zoomRatio);
    }

    this.bounds.songRemoveTrack = null;
    this.bounds.songRailMusicControls = null;
    this.bounds.songRailEditTab = null;
    this.bounds.songRailToolsTab = null;
    this.bounds.instrumentSettingsControls = [];
    this.bounds.songToolsActions = [];
    this.songAddBounds = null;
    this.bounds.keyframeSet = null;
    this.bounds.keyframeRemove = null;
    this.bounds.keyframePrev = null;
    this.bounds.keyframeNext = null;

    const panelPad = isPortrait ? 10 : 12;
    const rowH = isPortrait ? 40 : 44;
    const tabY = mixRailBounds.y + panelPad;

    this.bounds.songTransportRecord = null;
    this.bounds.songTransportStart = null;
    this.bounds.songTransportBack = null;
    this.bounds.songTransportPlayPause = null;
    this.bounds.songTransportMetronome = null;
    this.bounds.songTransportForward = null;
    this.bounds.songTransportEnd = null;
    this.bounds.songTransportLoopThis = null;
    this.bounds.songMixVolumeTab = null;
    this.bounds.songMixPanTab = null;

    const editActionCount = 5;
    const musicActionCount = this.songBottomRailMode === 'music-controls'
      ? getMidiSongMusicControlSpecs({
        portrait: isPortrait,
        isPlaying: this.isPlaying,
        loopEnabled: this.song.loopEnabled,
        metronomeEnabled: this.metronomeEnabled
      }).length
      : editActionCount;
    const portraitRailLayout = isPortrait
      ? getMidiPortraitSongRailLayout({
        x: mixRailBounds.x,
        y: mixRailBounds.y,
        w: mixRailBounds.w,
        h: mixRailBounds.h,
        mode: this.songBottomRailMode,
        actionCount: musicActionCount
      })
      : null;
    if (portraitRailLayout) {
      portraitRailLayout.tabs.forEach((entry) => {
        const bounds = { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
        this.bounds[entry.key] = bounds;
        this.drawButton(ctx, bounds, entry.label, this.songBottomRailMode === entry.mode, false);
      });
    } else {
      const topTabGap = 8;
      const topTabY = tabY;
      const topTabH = rowH;
      const modeTabs = [
        { key: 'songRailMusicControls', label: 'Music Controls', mode: 'music-controls', w: isMobile ? 152 : 176 },
        { key: 'songRailEditTab', label: 'Edit', mode: 'edit', w: isMobile ? 78 : 88 },
        { key: 'songRailToolsTab', label: 'Tools', mode: 'tools', w: isMobile ? 86 : 96 },
        { key: 'songMixVolumeTab', label: 'Volume', mode: 'volume', w: isMobile ? 92 : 102 },
        { key: 'songMixPanTab', label: 'Pan', mode: 'pan', w: isMobile ? 76 : 86 }
      ];
      let tabX = mixRailBounds.x + panelPad;
      modeTabs.forEach((entry) => {
        const bounds = { x: tabX, y: topTabY, w: entry.w, h: topTabH };
        this.bounds[entry.key] = bounds;
        this.drawButton(ctx, bounds, entry.label, this.songBottomRailMode === entry.mode, false);
        tabX += entry.w + topTabGap;
      });
    }

    const bodyY = portraitRailLayout ? portraitRailLayout.bodyY : tabY + rowH + 10;
    if (this.songBottomRailMode === 'music-controls') {
      const rowHControls = rowH;
      const gap = 8;
      const controls = getMidiSongMusicControlSpecs({
        portrait: isPortrait,
        isPlaying: this.isPlaying,
        loopEnabled: this.song.loopEnabled,
        metronomeEnabled: this.metronomeEnabled
      });
      let boundsList = portraitRailLayout
        ? []
        : this.drawEqualWidthButtonRow(ctx, controls, {
          x: mixRailBounds.x + panelPad,
          y: bodyY,
          width: mixRailBounds.w - panelPad * 2,
          height: rowHControls,
          gap,
          draw: (bounds, entry) => this.drawButton(ctx, bounds, entry.label, Boolean(entry.active), false)
        });
      if (portraitRailLayout) {
        const firstRow = portraitRailLayout.actions.slice(0, 4);
        const secondRowSource = portraitRailLayout.actions.slice(4);
        const secondRow = secondRowSource.map((bounds, index) => ({
          ...bounds,
          x: portraitRailLayout.contentX + portraitRailLayout.contentW * 0.5
            - (bounds.w * secondRowSource.length + portraitRailLayout.gap * Math.max(0, secondRowSource.length - 1)) * 0.5
            + index * (bounds.w + portraitRailLayout.gap)
        }));
        boundsList = [...firstRow, ...secondRow];
        controls.forEach((entry, index) => {
          const bounds = boundsList[index];
          if (bounds) this.drawButton(ctx, bounds, entry.label, Boolean(entry.active), false);
        });
      }
      controls.forEach((entry, index) => {
        this.bounds[entry.key] = boundsList[index] || null;
      });
    }

    if (this.songBottomRailMode === 'edit' || this.songBottomRailMode === 'tools') {
      const isSelectionLoopActive = Boolean(
        selectionRange
        && this.song.loopEnabled
        && this.song.loopStartTick === selectionRange.startTick
        && this.song.loopEndTick === selectionRange.endTick
      );
      const actions = getMidiSongActionSpecs(this.songBottomRailMode, {
        portrait: isPortrait,
        selectionLoopActive: isSelectionLoopActive,
        clonePaintActive: this.songClonePaintTool.active
      });
      const toolButtonH = rowH;
      const toolGap = 8;
      const actionBounds = portraitRailLayout
        ? portraitRailLayout.actions
        : this.drawEqualWidthButtonRow(ctx, actions, {
          x: mixRailBounds.x + panelPad,
          y: bodyY,
          width: mixRailBounds.w - panelPad * 2,
          height: toolButtonH,
          gap: toolGap,
          draw: (bounds, entry) => this.drawSmallButton(ctx, bounds, entry.label, Boolean(entry.active))
        });
      if (portraitRailLayout) {
        actions.forEach((entry, index) => {
          const bounds = actionBounds[index];
          if (bounds) this.drawButton(ctx, bounds, entry.label, Boolean(entry.active), false);
        });
      }
      this.bounds.songToolsActions = actionBounds.map((bounds, index) => ({
        ...bounds,
        action: actions[index].action
      }));
    }

    if (selectedTrack && (this.songBottomRailMode === 'volume' || this.songBottomRailMode === 'pan')) {
      const control = this.songBottomRailMode === 'pan' ? 'pan' : 'volume';
      this.songMixControlMode = control;
      const contentX = mixRailBounds.x + panelPad;
      const contentW = mixRailBounds.w - panelPad * 2;
      const columnGap = 10;
      const sliderY = bodyY + getMidiSongMixSliderYOffset({ portrait: isPortrait });
      const sliderW = isPortrait ? contentW : Math.floor((contentW - columnGap * 2) * 0.5);
      const sliderH = 40;
      const sliderBounds = {
        x: contentX,
        y: sliderY,
        w: sliderW,
        h: sliderH,
        trackIndex: this.selectedTrackIndex,
        control
      };
      const mix = this.getTrackPlaybackMix(selectedTrack, this.playheadTick);
      const value = control === 'pan' ? ((mix.pan + 1) / 2) : mix.volume;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sliderBounds.x, sliderBounds.y, sliderBounds.w, sliderBounds.h);
      ctx.fillStyle = control === 'pan' ? '#4fb7ff' : '#ffe16a';
      ctx.fillRect(sliderBounds.x, sliderBounds.y, sliderBounds.w * value, sliderBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(sliderBounds.x, sliderBounds.y, sliderBounds.w, sliderBounds.h);
      this.bounds.instrumentSettingsControls.push(sliderBounds);

      const buttonW = isPortrait ? Math.floor((contentW - columnGap) / 2) : Math.max(72, Math.floor((contentW - sliderW - columnGap * 2) / 2));
      const buttonH = rowH;
      const buttonsX = isPortrait ? contentX : contentX + sliderW + columnGap;
      const buttonsY = isPortrait ? sliderY + sliderH + 8 : sliderY;
      this.bounds.keyframeSet = {
        x: buttonsX,
        y: buttonsY,
        w: buttonW,
        h: buttonH
      };
      this.bounds.keyframeRemove = {
        x: buttonsX + buttonW + columnGap,
        y: buttonsY,
        w: buttonW,
        h: buttonH
      };
      this.drawButton(ctx, this.bounds.keyframeSet, 'Set Keyframe', false, false);
      this.drawButton(ctx, this.bounds.keyframeRemove, 'Remove Keyframe', false, false);
    }

    if (!selectedTrack) {
      this.songAddBounds = null;
    }
    this.drawSongSelectionMenu(ctx);
    this.drawSongSplitTool(ctx);
    this.drawSongShiftTool(ctx);
  }

  drawTimelineRuler(ctx, x, y, w, h, loopTicks, timeline) {
    if (!timeline) return;
    const { originX, cellWidth } = timeline;
    const ticksPerBar = this.getTicksPerBar();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
      const loopStartX = originX + this.song.loopStartTick * cellWidth;
      const loopEndX = originX + this.song.loopEndTick * cellWidth;
      ctx.fillStyle = 'rgba(255,225,106,0.25)';
      ctx.fillRect(loopStartX, y, loopEndX - loopStartX, h);
      const handleW = Math.max(LOOP_HANDLE_MIN_WIDTH, Math.round(h * 1.4));
      const handleH = Math.max(LOOP_HANDLE_MIN_HEIGHT, Math.round(h * 1.1));
      const handleY = y + Math.max(1, Math.round((h - handleH) / 2));
      const gap = 3;
      const minX = originX;
      const maxX = originX + loopTicks * cellWidth - handleW;
      this.bounds.loopStartHandle = {
        x: clamp(loopStartX - handleW - gap, minX, maxX),
        y: handleY,
        w: handleW,
        h: handleH
      };
      this.bounds.loopEndHandle = {
        x: clamp(loopEndX + gap, minX, maxX),
        y: handleY,
        w: handleW,
        h: handleH
      };
      ctx.fillStyle = '#55d68a';
      ctx.fillRect(this.bounds.loopStartHandle.x, this.bounds.loopStartHandle.y, handleW, handleH);
      ctx.fillStyle = '#ff6a6a';
      ctx.fillRect(this.bounds.loopEndHandle.x, this.bounds.loopEndHandle.y, handleW, handleH);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeRect(this.bounds.loopStartHandle.x, this.bounds.loopStartHandle.y, handleW, handleH);
      ctx.strokeRect(this.bounds.loopEndHandle.x, this.bounds.loopEndHandle.y, handleW, handleH);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      [this.bounds.loopStartHandle, this.bounds.loopEndHandle].forEach((handle) => {
        const ridgeXLeft = handle.x + Math.round(handleW * 0.35);
        const ridgeXRight = handle.x + Math.round(handleW * 0.65);
        ctx.beginPath();
        ctx.moveTo(ridgeXLeft, handle.y + 3);
        ctx.lineTo(ridgeXLeft, handle.y + handleH - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ridgeXRight, handle.y + 3);
        ctx.lineTo(ridgeXRight, handle.y + handleH - 3);
        ctx.stroke();
      });
    } else {
      this.bounds.loopStartHandle = null;
      this.bounds.loopEndHandle = null;
    }
    const totalBars = Math.max(1, Math.ceil(loopTicks / ticksPerBar));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let bar = 0; bar <= totalBars; bar += 1) {
      const barX = originX + bar * ticksPerBar * cellWidth;
      ctx.beginPath();
      ctx.moveTo(barX, y + 2);
      ctx.lineTo(barX, y + h - 2);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (let bar = 0; bar < totalBars; bar += 1) {
      const barX = originX + bar * ticksPerBar * cellWidth;
      ctx.fillText(`${bar + 1}`, barX + 4, y + h - 8);
    }
    if (typeof this.song.loopStartTick === 'number') {
      const startX = originX + this.song.loopStartTick * cellWidth;
      ctx.strokeStyle = '#55d68a';
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX, y + h);
      ctx.stroke();
      ctx.fillStyle = '#55d68a';
      ctx.fillText('START', startX + 4, y + h - 8);
    }
    if (typeof this.song.loopEndTick === 'number') {
      const endX = originX + this.song.loopEndTick * cellWidth;
      ctx.strokeStyle = '#ff6a6a';
      ctx.beginPath();
      ctx.moveTo(endX, y);
      ctx.lineTo(endX, y + h);
      ctx.stroke();
      ctx.fillStyle = '#ff6a6a';
      ctx.fillText('END', endX + 4, y + h - 8);
    }
    ctx.restore();
  }

  drawSongPlayhead(ctx, topY, bottomY) {
    if (!this.songTimelineBounds) return;
    const xPos = this.getSongTimelineX(this.playheadTick);
    const handleWidth = 14;
    this.songPlayheadBounds = {
      x: xPos - handleWidth / 2,
      y: topY,
      w: handleWidth,
      h: bottomY - topY
    };
    const handleH = Math.min(20, Math.max(8, bottomY - topY));
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(xPos - handleWidth / 2, topY + 2, handleWidth, handleH);
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeRect(xPos - handleWidth / 2, topY + 2, handleWidth, handleH);
    ctx.strokeStyle = '#ffe16a';
    ctx.beginPath();
    ctx.moveTo(xPos, topY);
    ctx.lineTo(xPos, bottomY);
    ctx.stroke();
  }

  drawSongSelectionMenu(ctx) {
    if (!this.songSelectionMenu.open || !this.songTimelineBounds) {
      this.songSelectionMenu.bounds = [];
      return;
    }
    const range = this.getSongSelectionRange();
    if (!range) {
      this.songSelectionMenu.bounds = [];
      this.songSelectionMenu.open = false;
      return;
    }
    const laneBounds = this.songLaneBounds.find((entry) => entry.trackIndex === range.trackIndex);
    if (!laneBounds) {
      this.songSelectionMenu.bounds = [];
      return;
    }
    const isPortrait = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: this.viewportWidth || 0,
      viewportHeight: this.viewportHeight || 0
    });
    const actions = [
      { action: 'song-merge-left', label: isPortrait ? '← Merge' : 'Merge Left' },
      { action: 'song-merge-right', label: isPortrait ? 'Merge →' : 'Merge Right' },
      { action: 'song-splice', label: isPortrait ? 'Split' : 'Split Parts' },
      { action: 'song-clone-paint', label: isPortrait ? 'Clone' : 'clone paint' },
      { action: 'song-duplicate', label: isPortrait ? 'Dupe' : 'Duplicate' },
      { action: 'song-shift-note', label: isPortrait ? 'Shift' : 'Shift Note' },
      { action: 'song-copy', label: 'Copy' },
      { action: 'song-cut', label: 'Cut' },
      { action: 'song-delete', label: 'Delete' },
      { action: 'song-loop-selection', label: isPortrait ? MIDI_LOOP_ICON : 'Loop this' }
    ];
    const menuScale = 1.25;
    const buttonW = (this.isMobileLayout() ? 188 : 168) * menuScale;
    const buttonH = (this.isMobileLayout() ? 50 : 44) * menuScale;
    const gap = 10 * menuScale;
    const columns = 2;
    const rows = Math.ceil(actions.length / columns);
    const menuW = columns * buttonW + gap * (columns + 1);
    const menuH = rows * buttonH + gap * (rows + 1);
    const selStart = this.getSongTimelineX(range.startTick);
    const selEnd = this.getSongTimelineX(range.endTick);
    const midX = (selStart + selEnd) / 2 - menuW / 2;
    let menuX = clamp(midX, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - menuW);
    let menuY = laneBounds.y - menuH - 8;
    if (menuY < this.songTimelineBounds.y) {
      menuY = laneBounds.y + laneBounds.h + 8;
    }
    menuY = clamp(menuY, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - menuH);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(menuX, menuY, menuW, menuH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(menuX, menuY, menuW, menuH);
    this.songSelectionMenu.bounds = [];
    actions.forEach((entry, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const bx = menuX + gap + col * (buttonW + gap);
      const by = menuY + gap + row * (buttonH + gap);
      const bounds = {
        x: bx,
        y: by,
        w: buttonW,
        h: buttonH,
        action: entry.action,
        __midiScaled125: true
      };
      this.drawSmallButton(ctx, bounds, entry.label, false);
      this.songSelectionMenu.bounds.push(bounds);
    });
  }

  drawSongSplitTool(ctx) {
    if (!this.songSplitTool.active || !this.songTimelineBounds) {
      this.songSplitTool.bounds.lineGrab = null;
      this.songSplitTool.bounds.handleTop = null;
      this.songSplitTool.bounds.handleBottom = null;
      this.songSplitTool.bounds.splitAction = null;
      this.songSplitTool.bounds.cancelAction = null;
      return;
    }
    const range = this.getSongSelectionRange();
    if (!range || range.durationTicks < 2) {
      this.songSplitTool.active = false;
      return;
    }
    const tick = clamp(Math.round(this.songSplitTool.tick), range.startTick + 1, range.endTick - 1);
    this.songSplitTool.tick = tick;
    const x = this.getSongTimelineX(tick);
    const top = this.songTimelineBounds.y;
    const bottom = this.songTimelineBounds.y + this.songTimelineBounds.h;
    const grabW = this.isMobileLayout() ? 72 : 56;
    this.songSplitTool.bounds.lineGrab = {
      x: x - grabW / 2,
      y: top,
      w: grabW,
      h: bottom - top
    };
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = '#ff5959';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();

    const handleW = this.isMobileLayout() ? 34 : 28;
    const handleH = this.isMobileLayout() ? 18 : 14;
    const hitPad = this.isMobileLayout() ? 14 : 10;
    const topHandle = { x: x - handleW / 2, y: top + 2, w: handleW, h: handleH };
    const bottomHandle = { x: x - handleW / 2, y: bottom - handleH - 2, w: handleW, h: handleH };
    this.songSplitTool.bounds.handleTop = {
      x: topHandle.x - hitPad,
      y: topHandle.y - hitPad,
      w: topHandle.w + hitPad * 2,
      h: topHandle.h + hitPad * 2
    };
    this.songSplitTool.bounds.handleBottom = {
      x: bottomHandle.x - hitPad,
      y: bottomHandle.y - hitPad,
      w: bottomHandle.w + hitPad * 2,
      h: bottomHandle.h + hitPad * 2
    };
    ctx.fillStyle = '#ff5959';
    ctx.fillRect(topHandle.x, topHandle.y, topHandle.w, topHandle.h);
    ctx.fillRect(bottomHandle.x, bottomHandle.y, bottomHandle.w, bottomHandle.h);

    const action = {
      x: 0,
      y: 0,
      w: 108,
      h: 30,
      action: 'song-split-apply'
    };
    const cancelAction = {
      x: 0,
      y: 0,
      w: 92,
      h: 30,
      action: 'song-split-cancel'
    };
    const selectedLane = this.songLaneBounds.find((entry) => entry.trackIndex === range.trackIndex);
    if (selectedLane) {
      const onFirstTrack = range.trackIndex === 0;
      const anchorY = onFirstTrack
        ? selectedLane.y + selectedLane.h + 8
        : selectedLane.y - action.h - 8;
      const controlsY = clamp(anchorY, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - action.h);
      const totalW = action.w + 8 + cancelAction.w;
      const startX = clamp(x - totalW / 2, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - totalW);
      action.x = startX;
      action.y = controlsY;
      cancelAction.x = startX + action.w + 8;
      cancelAction.y = controlsY;
    } else {
      action.x = clamp(x + 12, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - 110);
      action.y = clamp(top + 12, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - 34);
      cancelAction.x = clamp(action.x + action.w + 8, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - cancelAction.w);
      cancelAction.y = action.y;
    }
    this.songSplitTool.bounds.splitAction = action;
    this.songSplitTool.bounds.cancelAction = cancelAction;
    this.drawSmallButton(ctx, action, 'Split here', true);
    this.drawSmallButton(ctx, cancelAction, 'Cancel', false);
  }

  drawSongShiftTool(ctx) {
    if (!this.songShiftTool.active || !this.songTimelineBounds) {
      this.songShiftTool.bounds.slider = null;
      this.songShiftTool.bounds.knob = null;
      this.songShiftTool.bounds.apply = null;
      this.songShiftTool.bounds.cancel = null;
      return;
    }
    const range = this.getSongSelectionRange();
    const lane = range ? this.songLaneBounds.find((entry) => entry.trackIndex === range.trackIndex) : null;
    if (!range || !lane) {
      this.songShiftTool.active = false;
      return;
    }
    const sliderH = Math.min(220, Math.max(140, lane.h + 80));
    const sliderW = this.isMobileLayout() ? 28 : 22;
    const sliderX = clamp(lane.x + lane.w + 14, this.songTimelineBounds.x, this.songTimelineBounds.x + this.songTimelineBounds.w - sliderW - 120);
    const sliderY = clamp(lane.y + lane.h / 2 - sliderH / 2, this.songTimelineBounds.y, this.songTimelineBounds.y + this.songTimelineBounds.h - sliderH);
    const slider = { x: sliderX, y: sliderY, w: sliderW, h: sliderH };
    this.songShiftTool.bounds.slider = slider;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(slider.x, slider.y, slider.w, slider.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(slider.x, slider.y, slider.w, slider.h);

    const ratio = (clamp(this.songShiftTool.semitones, -12, 12) + 12) / 24;
    const knobY = slider.y + slider.h - ratio * slider.h;
    const knob = { x: slider.x - 8, y: knobY - 8, w: slider.w + 16, h: 16 };
    this.songShiftTool.bounds.knob = knob;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(knob.x, knob.y, knob.w, knob.h);

    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText(`Shift ${this.songShiftTool.semitones > 0 ? '+' : ''}${this.songShiftTool.semitones}`, slider.x - 10, slider.y - 8);

    const apply = { x: slider.x + slider.w + 10, y: slider.y + 4, w: 92, h: 30, action: 'song-shift-apply' };
    const cancel = { x: slider.x + slider.w + 10, y: slider.y + 40, w: 92, h: 30, action: 'song-shift-cancel' };
    this.songShiftTool.bounds.apply = apply;
    this.songShiftTool.bounds.cancel = cancel;
    this.drawSmallButton(ctx, apply, 'Apply', true);
    this.drawSmallButton(ctx, cancel, 'Cancel', false);
  }


  drawSongAutomationOverlay(ctx, laneBounds, track, options = {}) {
    if (!laneBounds || !track) return;
    const mode = options.mode === 'pan' ? 'pan' : 'volume';
    const automationType = mode === 'pan' ? 'pan' : 'padding';
    const minValue = mode === 'pan' ? -1 : 0;
    const maxValue = mode === 'pan' ? 1 : 1;
    const defaultValue = mode === 'pan'
      ? clamp(track.pan ?? 0, -1, 1)
      : clamp(track.volume ?? 0.8, 0, 1);
    const totalTicks = Math.max(1, options.timelineTicks || this.getSongTimelineTicks());
    const originX = Number.isFinite(options.originX) ? options.originX : laneBounds.x;
    const cellWidth = Number.isFinite(options.cellWidth) ? options.cellWidth : (laneBounds.w / totalTicks);
    const keyframes = Array.isArray(track.automation?.[automationType])
      ? track.automation[automationType]
      : [];

    const sorted = [...keyframes]
      .filter((frame) => Number.isFinite(frame?.tick))
      .sort((a, b) => a.tick - b.tick);

    const ticks = sorted.length
      ? [0, ...sorted.map((frame) => clamp(frame.tick, 0, totalTicks)), totalTicks]
      : [0, totalTicks];
    const uniqueTicks = [...new Set(ticks)].sort((a, b) => a - b);

    ctx.save();
    ctx.beginPath();
    ctx.rect(laneBounds.x, laneBounds.y, laneBounds.w, laneBounds.h);
    ctx.clip();

    if (mode === 'pan') {
      const centerY = laneBounds.y + laneBounds.h / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(laneBounds.x, centerY);
      ctx.lineTo(laneBounds.x + laneBounds.w, centerY);
      ctx.stroke();
    }

    const strokeColor = mode === 'pan' ? 'rgba(79,183,255,0.95)' : 'rgba(255,225,106,0.95)';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    uniqueTicks.forEach((tick, index) => {
      const raw = this.getTrackAutomationValue(track, automationType, tick, defaultValue);
      const value = clamp(raw, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + tick * cellWidth;
      const y = laneBounds.y + laneBounds.h - valueRatio * laneBounds.h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    sorted.forEach((frame) => {
      const tick = clamp(frame.tick, 0, totalTicks);
      const value = clamp(frame.value ?? defaultValue, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + tick * cellWidth;
      const y = laneBounds.y + laneBounds.h - valueRatio * laneBounds.h;
      const markerSize = this.isMobileLayout() ? 18 : 14;
      const markerHalf = markerSize / 2;
      ctx.fillStyle = strokeColor;
      ctx.fillRect(x - markerHalf, y - markerHalf, markerSize, markerSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(x - markerHalf, y - markerHalf, markerSize, markerSize);
    });

    ctx.restore();
  }

  drawAutomationLane(ctx, bounds, keyframes, minValue, maxValue, label, timeline, indicator = null) {
    const keyframeSize = this.isMobileLayout() ? 24 : 20;
    const keyframeHalf = keyframeSize / 2;
    ctx.fillStyle = UI_SUITE.colors.panel;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px Courier New';
    ctx.fillText(label, bounds.x + 6, bounds.y + bounds.h - 3);

    const totalTicks = this.getSongTimelineTicks();
    const originX = timeline?.originX ?? bounds.x;
    const cellWidth = timeline?.cellWidth ?? (bounds.w / totalTicks || 1);
    if (!keyframes.length) {
      if (indicator && Number.isFinite(indicator.tick) && Number.isFinite(indicator.value)) {
        const value = clamp(indicator.value, minValue, maxValue);
        const valueRatio = (value - minValue) / (maxValue - minValue || 1);
        const x = originX + indicator.tick * cellWidth;
        const y = bounds.y + bounds.h - valueRatio * bounds.h;
        ctx.save();
        ctx.beginPath();
        ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - keyframeHalf, y - keyframeHalf, keyframeSize, keyframeSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeRect(x - keyframeHalf, y - keyframeHalf, keyframeSize, keyframeSize);
        ctx.restore();
      }
      return;
    }
    const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,225,106,0.8)';
    ctx.beginPath();
    sorted.forEach((frame, index) => {
      const value = clamp(frame.value ?? 0, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + frame.tick * cellWidth;
      const y = bounds.y + bounds.h - valueRatio * bounds.h;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    sorted.forEach((frame) => {
      const value = clamp(frame.value ?? 0, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + frame.tick * cellWidth;
      const y = bounds.y + bounds.h - valueRatio * bounds.h;
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(x - keyframeHalf, y - keyframeHalf, keyframeSize, keyframeSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeRect(x - keyframeHalf, y - keyframeHalf, keyframeSize, keyframeSize);
    });
    if (indicator && Number.isFinite(indicator.tick) && Number.isFinite(indicator.value)) {
      const value = clamp(indicator.value, minValue, maxValue);
      const valueRatio = (value - minValue) / (maxValue - minValue || 1);
      const x = originX + indicator.tick * cellWidth;
      const y = bounds.y + bounds.h - valueRatio * bounds.h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - keyframeHalf, y - keyframeHalf, keyframeSize, keyframeSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeRect(x - keyframeHalf, y - keyframeHalf, keyframeSize, keyframeSize);
    }
    ctx.restore();
  }

  drawGridControls(ctx, x, y, w, track) {
    const rowH = 44;
    const gap = 8;
    const buttonSize = rowH;
    let cursorX = x;
    ctx.font = '13px Courier New';
    this.bounds.instrumentSettingsControls = [];
    this.bounds.keyframeToggle = null;
    this.bounds.keyframePrev = null;
    this.bounds.keyframeSet = null;
    this.bounds.keyframeRemove = null;
    this.bounds.keyframeNext = null;
    const drumGrid = isDrumTrack(track);
    const label = track
      ? drumGrid
        ? `[${this.getDrumKitLabel(track)}]`
        : `[${this.getProgramLabel(track.program)}]`
      : '[No Track]';
    this.bounds.instrumentPrev = { x: cursorX, y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.instrumentPrev, '<', false, false);
    cursorX += buttonSize + gap;

    const labelW = Math.min(w * 0.6, Math.max(160, ctx.measureText(label).width + 28));
    this.bounds.instrumentLabel = { x: cursorX, y, w: labelW, h: rowH };
    this.drawButton(ctx, this.bounds.instrumentLabel, label, false, true);
    cursorX += labelW + gap;

    this.bounds.instrumentNext = { x: cursorX, y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.instrumentNext, '>', false, false);
    cursorX += buttonSize + gap * 2;

    const row2Y = y + rowH + gap;
    let row2X = x;
    if (!drumGrid) {
      const noteLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
      const noteW = Math.min(160, Math.max(120, ctx.measureText(noteLabel).width + 28));
      this.bounds.noteLength = { x: cursorX, y, w: noteW, h: rowH };
      this.drawButton(ctx, this.bounds.noteLength, noteLabel, false, false);

      const chordLabel = this.chordMode ? 'Chord Mode' : 'Piano Mode';
      const chordW = Math.min(180, Math.max(140, ctx.measureText(chordLabel).width + 28));
      this.bounds.chordMode = { x: row2X, y: row2Y, w: chordW, h: rowH };
      this.drawButton(ctx, this.bounds.chordMode, chordLabel, this.chordMode, false);
      row2X += chordW + gap;

      const editLabel = 'Edit Chords';
      const editW = Math.min(150, Math.max(120, ctx.measureText(editLabel).width + 28));
      this.bounds.chordEdit = { x: row2X, y: row2Y, w: editW, h: rowH };
      this.drawButton(ctx, this.bounds.chordEdit, editLabel, false, false);
      row2X += editW + gap;
    } else {
      this.bounds.noteLength = null;
      this.bounds.chordMode = null;
      this.bounds.chordEdit = null;
    }

    const barsLabel = `Bars ${Math.max(1, this.song.loopBars || DEFAULT_GRID_BARS)}`;
    const barsLabelW = Math.min(140, Math.max(96, ctx.measureText(barsLabel).width + 28));
    this.bounds.barsMinus = { x: row2X, y: row2Y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.barsMinus, '−', false, false);
    row2X += buttonSize + gap;
    this.bounds.barsLabel = { x: row2X, y: row2Y, w: barsLabelW, h: rowH };
    this.drawButton(ctx, this.bounds.barsLabel, barsLabel, false, true);
    row2X += barsLabelW + gap;
    this.bounds.barsPlus = { x: row2X, y: row2Y, w: buttonSize, h: rowH };
    this.drawButton(ctx, this.bounds.barsPlus, '+', false, false);

    const keyframeRowY = row2Y + rowH + gap;
    const keyframeLabel = this.keyframePanelOpen ? 'Keyframes ▾' : 'Keyframes ▸';
    const keyframeW = Math.min(180, Math.max(140, ctx.measureText(keyframeLabel).width + 28));
    this.bounds.keyframeToggle = { x, y: keyframeRowY, w: keyframeW, h: rowH };
    this.drawButton(ctx, this.bounds.keyframeToggle, keyframeLabel, this.keyframePanelOpen, false);

    let extraHeight = rowH + gap;
    if (this.keyframePanelOpen && track) {
      const panelY = keyframeRowY + rowH + gap;
      const panelPadding = 10;
      const sliderW = w - panelPadding * 2;
      const sliderX = x + panelPadding;
      const sliderH = 16;
      const sliderGap = 20;
      const mixAtPlayhead = this.getTrackPlaybackMix(track, this.playheadTick);
      const mixVolume = clamp(mixAtPlayhead.volume ?? track.volume ?? 0.8, 0, 1);
      const mixPan = clamp(mixAtPlayhead.pan ?? track.pan ?? 0, -1, 1);

      const panelHeight = panelPadding + 10 + sliderH + sliderGap + sliderH + 18 + 32 + panelPadding;
      ctx.fillStyle = UI_SUITE.colors.panel;
      ctx.fillRect(x, panelY, w, panelHeight);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(x, panelY, w, panelHeight);

      const volumeBounds = {
        x: sliderX,
        y: panelY + panelPadding + 10,
        w: sliderW,
        h: sliderH,
        trackIndex: this.selectedTrackIndex,
        control: 'volume'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mixVolume, volumeBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText(`Volume ${Math.round(mixVolume * 100)}%`, sliderX, volumeBounds.y - 6);
      this.bounds.instrumentSettingsControls.push(volumeBounds);

      const panBounds = {
        x: sliderX,
        y: volumeBounds.y + sliderH + sliderGap,
        w: sliderW,
        h: sliderH,
        trackIndex: this.selectedTrackIndex,
        control: 'pan'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = '#4fb7ff';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mixPan + 1) / 2), panBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px Courier New';
      ctx.fillText(`Pan (L/R) ${Math.round(mixPan * 100)}%`, sliderX, panBounds.y - 6);
      this.bounds.instrumentSettingsControls.push(panBounds);

      const buttonY = panBounds.y + sliderH + 18;
      const buttonGap = 12;
      const buttonW = (w - panelPadding * 2 - buttonGap) / 2;
      this.bounds.keyframeSet = {
        x: sliderX,
        y: buttonY,
        w: buttonW,
        h: 32
      };
      this.bounds.keyframeRemove = {
        x: sliderX + buttonW + buttonGap,
        y: buttonY,
        w: buttonW,
        h: 32
      };
      this.drawButton(ctx, this.bounds.keyframeSet, 'Set Keyframe', false, false);
      this.drawButton(ctx, this.bounds.keyframeRemove, 'Remove Keyframe', false, false);

      extraHeight += panelHeight + gap;
    }

    return rowH * 2 + gap + extraHeight;
  }

  clearGridZoomButtonBounds() {
    Object.assign(this.bounds, buildMidiGridZoomButtonModel().bounds);
  }

  drawGridZoomControls(ctx, x, y, w, h) {
    this.clearGridZoomButtonBounds();
  }

  drawInstrumentPanel(ctx, x, y, w, h, track, options = {}) {
    const isMobile = this.isMobileLayout();
    const padding = 12;
    const bottomPadding = this.instrumentPicker.mode ? 4 : padding;
    const modalOnly = options.modalOnly === true;
    if (options.portraitMain === true) {
      if (this.instrumentPicker.mode) {
        this.bounds.instrumentList = [];
        this.bounds.instrumentListScrollArea = null;
        this.bounds.instrumentSettingsControls = [];
        this.bounds.instrumentAdd = null;
        return;
      }
      const gap = 10;
      const showList = !this.instrumentPicker.mode;
      const minListH = Math.min(h, 176);
      const maxListH = Math.max(minListH, Math.min(200, Math.round(h * 0.36)));
      const listH = showList ? clamp(Math.round(h * 0.3), minListH, maxListH) : 0;
      const settingsY = y + (showList ? listH + gap : 0);
      const settingsH = Math.max(0, h - (showList ? listH + gap : 0));
      if (settingsH > 0) {
        this.drawInstrumentPanel(ctx, x, settingsY, w, settingsH, track, { modalOnly: true });
      }
      if (!showList) return;

      drawSharedPanel(ctx, { x, y, w, h: listH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `14px ${UI_SUITE.font.family}`;
      ctx.fillText('Instruments', x + padding, y + 20);

      const addButtonH = 38;
      const listStartY = y + 30;
      const listHInner = Math.max(0, listH - 42 - addButtonH);
      const rowH = 44;
      const rowGap = 6;
      const contentH = Math.max(0, this.song.tracks.length * (rowH + rowGap) - rowGap);
      this.instrumentListScrollMax = Math.max(0, contentH - listHInner);
      this.instrumentListScroll = clamp(this.instrumentListScroll, 0, this.instrumentListScrollMax);
      this.bounds.instrumentListScrollArea = {
        x: x + padding,
        y: listStartY,
        w: w - padding * 2,
        h: listHInner
      };
      this.bounds.instrumentList = [];
      let cursorY = listStartY - this.instrumentListScroll;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.bounds.instrumentListScrollArea.x, this.bounds.instrumentListScrollArea.y, this.bounds.instrumentListScrollArea.w, this.bounds.instrumentListScrollArea.h);
      ctx.clip();
      this.song.tracks.forEach((listTrack, index) => {
        const bounds = {
          x: x + padding,
          y: cursorY,
          w: w - padding * 2,
          h: rowH,
          trackIndex: index
        };
        if (bounds.y + bounds.h >= listStartY - 4 && bounds.y <= listStartY + listHInner + 4) {
          const isActive = index === this.selectedTrackIndex;
          drawSharedPanel(ctx, bounds, {
            fill: isActive ? 'rgba(255,225,106,0.18)' : UI_SUITE.colors.panel,
            border: listTrack.color || UI_SUITE.colors.border
          });
          ctx.fillStyle = UI_SUITE.colors.text;
          ctx.font = `13px ${UI_SUITE.font.family}`;
          ctx.fillText(this.truncateLabel(ctx, listTrack.name, bounds.w - 20), bounds.x + 10, bounds.y + 20);
          ctx.fillStyle = UI_SUITE.colors.muted;
          ctx.font = `11px ${UI_SUITE.font.family}`;
          const label = isDrumChannel(listTrack.channel)
            ? this.getDrumKitLabel(listTrack)
            : this.getProgramLabel(listTrack.program);
          ctx.fillText(this.truncateLabel(ctx, label, bounds.w - 20), bounds.x + 10, bounds.y + 40);
          this.bounds.instrumentList.push(bounds);
        }
        cursorY += rowH + rowGap;
      });
      ctx.restore();
      drawSharedPortraitScrollHints(ctx, this.bounds.instrumentListScrollArea, {
        scroll: this.instrumentListScroll,
        scrollMax: this.instrumentListScrollMax
      });
      this.bounds.instrumentAdd = {
        x: x + padding,
        y: y + listH - addButtonH - 8,
        w: w - padding * 2,
        h: addButtonH
      };
      this.drawButton(ctx, this.bounds.instrumentAdd, 'Add Instrument', false, false);
      return;
    }
    const panelGap = modalOnly ? 0 : 12;
    const leftW = modalOnly ? 0 : clamp(w * 0.32, 240, 360);
    const rightW = modalOnly ? Math.max(0, w - padding * 2) : Math.max(0, w - padding * 2 - leftW - panelGap);
    const leftX = x + padding;
    const leftY = y + padding;
    const panelH = h - padding - bottomPadding;
    const rightX = modalOnly ? leftX : (leftX + leftW + panelGap);
    const rightY = leftY;
    const rowH = clamp(Math.round(h * 0.08), isMobile ? 48 : 44, isMobile ? 60 : 54);
    const addButtonH = clamp(Math.round(rowH * 0.8), 32, 40);
    const controlsH = 0;

    this.bounds.instrumentList = [];
    this.bounds.instrumentListScrollArea = null;
    this.bounds.instrumentSettingsControls = [];

    if (!modalOnly) {
      drawSharedPanel(ctx, { x: leftX, y: leftY, w: leftW, h: panelH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });

      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `14px ${UI_SUITE.font.family}`;
      ctx.fillText('Instruments', leftX + 10, leftY + 18);
      const listStartY = leftY + 28;
      const addButtonBottomInset = 4;
      const listBottomGap = 8;
      const listTopInset = listStartY - leftY;
      const listH = Math.max(0, panelH - listTopInset - addButtonH - listBottomGap - addButtonBottomInset - controlsH);
      this.bounds.instrumentListScrollArea = { x: leftX + 4, y: listStartY, w: leftW - 8, h: listH };
      const listItemGap = 6;
      const visibleRows = Math.max(4, Math.min(5, this.song.tracks.length || 4));
      const compactRowH = Math.floor((listH - listItemGap * Math.max(0, visibleRows - 1)) / Math.max(1, visibleRows));
      const listRowH = clamp(compactRowH, 32, 96);
      const listContentH = Math.max(0, this.song.tracks.length * listRowH + Math.max(0, this.song.tracks.length - 1) * listItemGap);
      this.instrumentListScrollMax = Math.max(0, listContentH - listH);
      this.instrumentListScroll = clamp(this.instrumentListScroll, 0, this.instrumentListScrollMax);
      if (Number.isInteger(this.pendingTrackFocusIndex) && this.activeTab === 'instruments') {
        const focusTop = this.pendingTrackFocusIndex * (listRowH + listItemGap);
        const centered = focusTop - (listH - listRowH) * 0.5;
        this.instrumentListScroll = clamp(centered, 0, this.instrumentListScrollMax);
        this.pendingTrackFocusIndex = null;
      }
      let cursorY = listStartY - this.instrumentListScroll;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.bounds.instrumentListScrollArea.x, this.bounds.instrumentListScrollArea.y, this.bounds.instrumentListScrollArea.w, this.bounds.instrumentListScrollArea.h);
      ctx.clip();
      this.song.tracks.forEach((listTrack, index) => {
        const bounds = { x: leftX + 8, y: cursorY, w: leftW - 16, h: listRowH, trackIndex: index };
        if (bounds.y + bounds.h < listStartY - 4 || bounds.y > listStartY + listH + 4) {
          cursorY += listRowH + listItemGap;
          return;
        }
        const isActive = index === this.selectedTrackIndex;
        drawSharedPanel(ctx, bounds, {
          fill: isActive ? 'rgba(255,225,106,0.18)' : UI_SUITE.colors.panel,
          border: listTrack.color || UI_SUITE.colors.border
        });
        ctx.fillStyle = UI_SUITE.colors.text;
        ctx.font = `13px ${UI_SUITE.font.family}`;
        ctx.fillText(listTrack.name, bounds.x + 10, bounds.y + 18);
        ctx.fillStyle = UI_SUITE.colors.muted;
        ctx.font = `11px ${UI_SUITE.font.family}`;
        const label = isDrumChannel(listTrack.channel)
          ? this.getDrumKitLabel(listTrack)
          : this.getProgramLabel(listTrack.program);
        ctx.fillText(label, bounds.x + 10, bounds.y + 36);
        this.bounds.instrumentList.push(bounds);
        cursorY += listRowH + listItemGap;
      });
      ctx.restore();
      drawSharedPortraitScrollHints(ctx, this.bounds.instrumentListScrollArea, {
        scroll: this.instrumentListScroll,
        scrollMax: this.instrumentListScrollMax
      });

      this.bounds.instrumentAdd = { x: leftX + 8, y: leftY + panelH - addButtonH - addButtonBottomInset, w: leftW - 16, h: addButtonH };
      ctx.fillStyle = UI_SUITE.colors.panelAlt;
      ctx.fillRect(this.bounds.instrumentAdd.x, this.bounds.instrumentAdd.y, this.bounds.instrumentAdd.w, this.bounds.instrumentAdd.h);
      this.drawButton(ctx, this.bounds.instrumentAdd, 'Add Instrument', false, false);
    } else {
      this.bounds.instrumentAdd = null;
    }

    if (this.instrumentPicker.mode && !modalOnly) {
      this.bounds.instrumentSettingsControls = [];
      return;
    }

    drawSharedPanel(ctx, { x: rightX, y: rightY, w: rightW, h: panelH }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });

    if (this.instrumentPicker.mode) {
      const header = this.instrumentPicker.mode === 'add' ? 'Add Instrument' : 'Change Instrument';
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `15px ${UI_SUITE.font.family}`;
      ctx.fillText(header, rightX + 12, rightY + 22);
      const previewOffset = this.instrumentPreview.loading ? 16 : 0;
      if (this.instrumentPreview.loading) {
        ctx.fillStyle = UI_SUITE.colors.muted;
        ctx.font = `11px ${UI_SUITE.font.family}`;
        ctx.fillText('Downloading preview…', rightX + 12, rightY + 38);
      }

      const tabY = rightY + 34 + previewOffset;
      const tabH = 34;
      const tabNavW = 30;
      const tabNavGap = 6;
      const tabsAvailableW = rightW - padding * 2 - (tabNavW + tabNavGap) * 2;
      const tabsX = rightX + padding + tabNavW + tabNavGap;
      const tabGap = 6;
      const minTabW = 90;
      const pickerTabs = this.getInstrumentPickerTabs();
      const tabRows = 1;
      const tabCols = Math.max(1, Math.floor((tabsAvailableW + tabGap) / (minTabW + tabGap)));
      const tabW = (tabsAvailableW - Math.max(0, tabCols - 1) * tabGap) / Math.max(1, tabCols);
      const tabStride = tabW + tabGap;
      const tabContentW = Math.max(0, pickerTabs.length * tabStride - tabGap);
      const maxTabScroll = Math.max(0, tabContentW - tabsAvailableW);
      this.instrumentPicker.tabScrollMax = maxTabScroll;
      this.instrumentPicker.tabScrollStep = Math.max(tabStride * 2, tabsAvailableW * 0.7);
      const tabScrollX = clamp(Number(this.instrumentPicker.tabScrollX) || 0, 0, maxTabScroll);
      this.instrumentPicker.tabScrollX = tabScrollX;
      this.instrumentPicker.tabBounds = [];
      this.instrumentPicker.tabPrevBounds = {
        x: rightX + padding,
        y: tabY,
        w: tabNavW,
        h: tabH
      };
      this.instrumentPicker.tabNextBounds = {
        x: rightX + rightW - padding - tabNavW,
        y: tabY,
        w: tabNavW,
        h: tabH
      };
      this.instrumentPicker.tabAreaBounds = {
        x: rightX + padding,
        y: tabY,
        w: rightW - padding * 2,
        h: tabRows * tabH + Math.max(0, tabRows - 1) * tabGap
      };
      this.drawSmallButton(ctx, this.instrumentPicker.tabPrevBounds, '<', false);
      this.drawSmallButton(ctx, this.instrumentPicker.tabNextBounds, '>', false);
      ctx.save();
      ctx.beginPath();
      ctx.rect(tabsX, tabY, tabsAvailableW, tabH);
      ctx.clip();
      pickerTabs.forEach((tab, index) => {
        const tabX = tabsX + index * tabStride - tabScrollX;
        if ((tabX + tabW) < tabsX || tabX > (tabsX + tabsAvailableW)) return;
        const bounds = { x: tabX, y: tabY, w: tabW, h: tabH, id: tab.id };
        this.instrumentPicker.tabBounds.push(bounds);
        this.drawButton(ctx, bounds, tab.label, this.instrumentPicker.familyTab === tab.id, false);
      });
      ctx.restore();

      const selectorY = tabY + tabH + 10;
      const footerH = 52;
      const footerButtonH = 32;
      const liftPickerFooter = modalOnly && isMobile && h > w;
      const footerLift = liftPickerFooter ? 56 : 0;
      const footerY = Math.max(selectorY + 8, rightY + panelH - footerH + 6 - footerLift);
      const scrollY = selectorY;
      const scrollH = Math.max(0, footerY - scrollY - 8);
      this.instrumentPicker.sectionBounds = [{ x: rightX + padding, y: scrollY, w: rightW - padding * 2, h: scrollH }];

      const programs = this.getProgramsForFamily(this.instrumentPicker.familyTab);
      const tiles = programs.length
        ? programs.map((entry) => ({
          program: entry.program,
          kitId: entry.kitId || null,
          label: `${formatProgramNumber(entry.program)} ${entry.name}`
        }))
        : [{ type: 'empty', label: 'No instruments in this tab yet.' }];

      const columns = 1;
      const tileGap = 10;
      const tileW = (rightW - padding * 2 - tileGap * (columns - 1)) / columns;
      const tileH = 56;
      this.instrumentPicker.scrollStep = tileH + tileGap;
      let tileX = rightX + padding;
      let tileY = scrollY - this.instrumentPicker.scroll;
      this.instrumentPicker.bounds = [];
      this.instrumentPicker.favoriteBounds = [];

      ctx.save();
      ctx.beginPath();
      ctx.rect(rightX + padding, scrollY, rightW - padding * 2, scrollH);
      ctx.clip();
      tiles.forEach((item) => {
        if (item.type === 'empty') {
          ctx.fillStyle = UI_SUITE.colors.muted;
          ctx.font = `12px ${UI_SUITE.font.family}`;
          ctx.fillText(item.label, rightX + padding, tileY + 18);
          tileY += 28;
          tileX = rightX + padding;
          return;
        }
        const bounds = { x: tileX, y: tileY, w: tileW, h: tileH, program: item.program, kitId: item.kitId || null };
        if (tileY + tileH >= scrollY - tileH && tileY <= scrollY + scrollH + tileH) {
          const isSelected = this.instrumentPicker.selectedProgram === item.program;
          this.drawButton(ctx, bounds, item.label, isSelected, true);
          this.instrumentPicker.bounds.push(bounds);
          const favoriteBounds = { x: bounds.x + bounds.w - 40, y: bounds.y + 6, w: 34, h: 34, program: item.program };
          this.instrumentPicker.favoriteBounds.push(favoriteBounds);
          ctx.fillStyle = this.favoriteInstruments.includes(item.program) ? UI_SUITE.colors.accent : UI_SUITE.colors.muted;
          ctx.font = `18px ${UI_SUITE.font.family}`;
          ctx.fillText('★', favoriteBounds.x + 8, favoriteBounds.y + 22);
        }
        tileX += tileW + tileGap;
        if ((tileX + tileW) > rightX + rightW - padding + 1) {
          tileX = rightX + padding;
          tileY += tileH + tileGap;
        }
      });
      const totalHeight = tileY - scrollY + tileH + this.instrumentPicker.scroll;
      ctx.restore();

      this.instrumentPicker.scrollMax = Math.max(0, totalHeight - scrollH);
      this.instrumentPicker.scroll = clamp(this.instrumentPicker.scroll, 0, this.instrumentPicker.scrollMax);

      this.instrumentPicker.scrollUpBounds = null;
      this.instrumentPicker.scrollDownBounds = null;
      if (this.instrumentPicker.scrollMax > 0) {
        const scrollButtonW = 26;
        const scrollButtonH = 22;
        const scrollButtonX = rightX + rightW - padding - scrollButtonW;
        this.instrumentPicker.scrollUpBounds = {
          x: scrollButtonX,
          y: scrollY + 6,
          w: scrollButtonW,
          h: scrollButtonH
        };
        this.instrumentPicker.scrollDownBounds = {
          x: scrollButtonX,
          y: scrollY + scrollH - scrollButtonH - 6,
          w: scrollButtonW,
          h: scrollButtonH
        };
        this.drawSmallButton(ctx, this.instrumentPicker.scrollUpBounds, '▲', false);
        this.drawSmallButton(ctx, this.instrumentPicker.scrollDownBounds, '▼', false);
      }

      this.instrumentPicker.drumKitBounds = null;
      this.instrumentPicker.downloadBounds = null;

      const actionY = footerY;
      const buttonW = (rightW - padding * 2 - 12) / 2;
      this.instrumentPicker.confirmBounds = {
        x: rightX + padding,
        y: actionY,
        w: buttonW,
        h: footerButtonH
      };
      this.instrumentPicker.cancelBounds = {
        x: rightX + padding + buttonW + 12,
        y: actionY,
        w: buttonW,
        h: footerButtonH
      };
      const confirmLabel = this.instrumentPicker.mode === 'add' ? 'Add' : 'Apply';
      this.drawButton(ctx, this.instrumentPicker.confirmBounds, confirmLabel, false, false);
      this.drawButton(ctx, this.instrumentPicker.cancelBounds, 'Cancel', false, false);
      return;
    }

    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `15px ${UI_SUITE.font.family}`;
    ctx.fillText('Instrument Settings', rightX + 12, rightY + 22);
    if (!track) return;

    const infoY = rightY + 40;
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillText(track.name, rightX + 12, infoY + 12);
    const instrumentLabel = isDrumTrack(track)
      ? this.getDrumKitLabel(track)
      : this.getProgramLabel(track.program);
    ctx.fillText(instrumentLabel, rightX + 12, infoY + 28);
    const activePreview = this.instrumentPreview.loading
      && this.instrumentPreview.key === this.getCacheKeyForTrack(track);
    const previewOffset = activePreview ? 18 : 0;
    if (activePreview) {
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      ctx.fillText('Downloading preview…', rightX + 12, infoY + 44);
    }

    const buttonRowY = infoY + 40 + previewOffset;
    const buttonGap = 8;
    const compactActions = isMobile && rightW < 430;
    const buttonCols = compactActions ? 2 : 4;
    const buttonW = (rightW - padding * 2 - buttonGap * (buttonCols - 1)) / buttonCols;
    const buttonH = compactActions ? 38 : 32;
    const buttonBoundsAt = (index) => {
      const col = index % buttonCols;
      const row = Math.floor(index / buttonCols);
      return {
        x: rightX + padding + col * (buttonW + buttonGap),
        y: buttonRowY + row * (buttonH + buttonGap),
        w: buttonW,
        h: buttonH
      };
    };
    const changeBounds = {
      ...buttonBoundsAt(0),
      trackIndex: this.selectedTrackIndex,
      control: 'instrument'
    };
    const renameBounds = {
      ...buttonBoundsAt(1),
      trackIndex: this.selectedTrackIndex,
      control: 'name'
    };
    const duplicateBounds = {
      ...buttonBoundsAt(2),
      trackIndex: this.selectedTrackIndex,
      control: 'duplicate'
    };
    const removeBounds = {
      ...buttonBoundsAt(3),
      trackIndex: this.selectedTrackIndex,
      control: 'remove'
    };
    this.drawButton(ctx, changeBounds, 'Change', false, false);
    this.drawButton(ctx, renameBounds, 'Rename', false, false);
    this.drawButton(ctx, duplicateBounds, 'Duplicate', false, false);
    this.drawDangerButton(ctx, removeBounds, 'Remove');
    this.bounds.instrumentSettingsControls.push(changeBounds, renameBounds, duplicateBounds, removeBounds);

    const mix = this.getTrackBaseMix(track);
    const actionRows = Math.ceil(4 / buttonCols);
    const toggleRowY = buttonRowY + actionRows * (buttonH + buttonGap) + 4;
    const muteBounds = {
      x: rightX + padding,
      y: toggleRowY,
      w: 80,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'mute'
    };
    const soloBounds = {
      x: rightX + padding + 90,
      y: toggleRowY,
      w: 80,
      h: 32,
      trackIndex: this.selectedTrackIndex,
      control: 'solo'
    };
    this.drawButton(ctx, muteBounds, 'Mute', track.mute, false);
    this.drawButton(ctx, soloBounds, 'Solo', track.solo, false);
    this.bounds.instrumentSettingsControls.push(muteBounds, soloBounds);

    const sliderX = rightX + padding;
    const sliderW = rightW - padding * 2;
    const volumeBounds = {
      x: sliderX,
      y: toggleRowY + 50,
      w: sliderW,
      h: isMobile ? 38 : 18,
      trackIndex: this.selectedTrackIndex,
      control: 'volume'
    };
    const volumeBar = {
      x: volumeBounds.x,
      y: volumeBounds.y + Math.max(0, Math.floor((volumeBounds.h - 18) / 2)),
      w: volumeBounds.w,
      h: 18
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(volumeBar.x, volumeBar.y, volumeBar.w, volumeBar.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(volumeBar.x, volumeBar.y, volumeBar.w * mix.volume, volumeBar.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(volumeBar.x, volumeBar.y, volumeBar.w, volumeBar.h);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText('Volume', sliderX, volumeBar.y - 6);
    this.bounds.instrumentSettingsControls.push(volumeBounds);

    const panBounds = {
      x: sliderX,
      y: volumeBounds.y + volumeBounds.h + 12,
      w: sliderW,
      h: isMobile ? 36 : 16,
      trackIndex: this.selectedTrackIndex,
      control: 'pan'
    };
    const panBar = {
      x: panBounds.x,
      y: panBounds.y + Math.max(0, Math.floor((panBounds.h - 16) / 2)),
      w: panBounds.w,
      h: 16
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(panBar.x, panBar.y, panBar.w, panBar.h);
    ctx.fillStyle = '#4fb7ff';
    ctx.fillRect(panBar.x, panBar.y, panBar.w * ((mix.pan + 1) / 2), panBar.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(panBar.x, panBar.y, panBar.w, panBar.h);
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText('Pan', sliderX, panBar.y - 6);
    this.bounds.instrumentSettingsControls.push(panBounds);
  }

  drawSettingsPanel(ctx, x, y, w, h) {
    drawSharedPanel(ctx, { x, y, w, h }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    this.bounds.settingsPanel = { x, y, w, h };

    const padding = 14;
    let cursorY = y + padding - this.settingsScroll;
    const sectionGap = 22;
    const portraitStacked = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: this.viewportWidth || w,
      viewportHeight: this.viewportHeight || h
    });
    const rowH = portraitStacked ? 86 : 56;
    const labelW = portraitStacked ? 0 : Math.min(180, w * 0.38);
    const textW = portraitStacked ? Math.max(1, w - padding * 2) : Math.max(1, labelW - 10);
    this.bounds.settingsControls = [];
    this.bounds.controllerControls = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding, y + padding, w - padding * 2, h - padding * 2);
    ctx.clip();

    const drawSectionTitle = (label) => {
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `16px ${UI_SUITE.font.family}`;
      ctx.fillText(label, x + padding, cursorY + 16);
      cursorY += 28;
    };

    const drawSettingText = (label, description) => {
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `13px ${UI_SUITE.font.family}`;
      ctx.fillText(this.truncateLabel(ctx, label, textW), x + padding, cursorY + 22);
      if (description) {
        ctx.fillStyle = UI_SUITE.colors.muted;
        ctx.font = `11px ${UI_SUITE.font.family}`;
        ctx.fillText(this.truncateLabel(ctx, description, textW), x + padding, cursorY + 40);
      }
    };

    const drawToggle = (label, value, id, description) => {
      const bounds = portraitStacked
        ? { x: x + padding, y: cursorY + 46, w: w - padding * 2, h: 36, id }
        : { x: x + padding + labelW, y: cursorY, w: w - padding * 2 - labelW, h: rowH, id };
      drawSettingText(label, description);
      this.drawButton(ctx, bounds, value ? 'On' : 'Off', value, false);
      this.bounds.settingsControls.push(bounds);
      cursorY += rowH + 10;
    };

    const drawAction = (label, valueText, id, description) => {
      const bounds = portraitStacked
        ? { x: x + padding, y: cursorY + 46, w: w - padding * 2, h: 36, id }
        : { x: x + padding + labelW, y: cursorY, w: w - padding * 2 - labelW, h: rowH, id };
      drawSettingText(label, description);
      this.drawButton(ctx, bounds, valueText, false, false);
      this.bounds.settingsControls.push(bounds);
      cursorY += rowH + 10;
    };

    const drawButtonRow = (label, buttons, description) => {
      const buttonGap = 10;
      const buttonH = 36;
      const totalW = w - padding * 2 - labelW;
      const buttonW = (totalW - buttonGap * (buttons.length - 1)) / buttons.length;
      const baseX = x + padding + labelW;
      const baseY = portraitStacked ? cursorY + 46 : cursorY + Math.round((rowH - buttonH) / 2);
      drawSettingText(label, description);
      buttons.forEach((button, index) => {
        const bounds = {
          x: baseX + index * (buttonW + buttonGap),
          y: baseY,
          w: buttonW,
          h: buttonH,
          id: button.id,
          disabled: button.disabled
        };
        this.drawButton(ctx, bounds, button.label, button.active, button.disabled);
        this.bounds.settingsControls.push(bounds);
      });
      cursorY += rowH + 10;
    };

    const drawTimeSignatureControls = () => {
      if (!portraitStacked) {
        drawButtonRow(
          'Time Sig',
          [
            { id: 'grid-time-signature-beats-down', label: 'Beats -', active: false },
            { id: 'grid-time-signature-beats-up', label: 'Beats +', active: false },
            { id: 'grid-time-signature-unit-down', label: 'Note -', active: false },
            { id: 'grid-time-signature-unit-up', label: 'Note +', active: false }
          ],
          `Current: ${this.song.timeSignature?.beats || 4}/${this.song.timeSignature?.unit || 4}`
        );
        return;
      }
      const description = `Current: ${this.song.timeSignature?.beats || 4}/${this.song.timeSignature?.unit || 4}`;
      const buttonGap = 10;
      const buttonH = 34;
      const buttonW = Math.floor((w - padding * 2 - buttonGap) / 2);
      drawSettingText('Time Signature', description);
      const rows = [
        [
          { id: 'grid-time-signature-beats-down', label: 'Beats -' },
          { id: 'grid-time-signature-beats-up', label: 'Beats +' }
        ],
        [
          { id: 'grid-time-signature-unit-down', label: 'Note -' },
          { id: 'grid-time-signature-unit-up', label: 'Note +' }
        ]
      ];
      rows.forEach((row, rowIndex) => {
        row.forEach((button, index) => {
          const bounds = {
            x: x + padding + index * (buttonW + buttonGap),
            y: cursorY + 46 + rowIndex * (buttonH + 8),
            w: buttonW,
            h: buttonH,
            id: button.id
          };
          this.drawButton(ctx, bounds, button.label, false, false);
          this.bounds.settingsControls.push(bounds);
        });
      });
      cursorY += 124;
    };

    const drawSlider = (label, valueText, ratio, id, description) => {
      const bounds = portraitStacked
        ? { x: x + padding, y: cursorY + 46, w: w - padding * 2, h: 36, id }
        : { x: x + padding + labelW, y: cursorY, w: w - padding * 2 - labelW, h: rowH, id };
      const barBounds = {
        x: bounds.x,
        y: portraitStacked ? bounds.y + 8 : cursorY + 24,
        w: bounds.w,
        h: 16
      };
      drawSettingText(label, description);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(barBounds.x, barBounds.y, barBounds.w * ratio, barBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `12px ${UI_SUITE.font.family}`;
      ctx.fillText(valueText, barBounds.x, barBounds.y + 32);
      this.bounds.settingsControls.push(bounds);
      cursorY += rowH + 10;
    };

    const gmStatus = this.game?.audio?.getGmStatus?.();

    drawSectionTitle('Audio');
    drawSlider('Master Volume', `${Math.round(this.audioSettings.masterVolume * 100)}%`, this.audioSettings.masterVolume, 'audio-volume', 'Overall output level.');
    drawSlider(
      'Master Pan',
      `${Math.round(this.audioSettings.masterPan * 100)}%`,
      (clamp(this.audioSettings.masterPan, -1, 1) + 1) / 2,
      'audio-master-pan',
      'Pan the entire mix left/right.'
    );
    drawToggle('Reverb', this.audioSettings.reverbEnabled, 'audio-reverb-toggle', 'Adds space to GM playback.');
    drawSlider('Reverb Level', `${Math.round(this.audioSettings.reverbLevel * 100)}%`, this.audioSettings.reverbLevel, 'audio-reverb-level', 'Wet mix for the reverb bus.');
    drawSlider('Output Latency', `${this.audioSettings.latencyMs} ms`, this.audioSettings.latencyMs / 120, 'audio-latency', 'Increase if audio crackles.');
    drawToggle('SoundFont Instruments', this.audioSettings.useSoundfont, 'audio-soundfont-toggle', 'Use sample-based GM instruments (recommended).');
    const cdnLabel = SOUNDFONT_CDNS.find((entry) => entry.id === this.audioSettings.soundfontCdn)?.label || 'GitHub Pages';
    drawAction('SoundFont CDN', cdnLabel, 'audio-soundfont-cdn', 'Switch CDN source for the FluidR3_GM bank.');
    drawAction('Preload Instrument', 'Load', 'audio-soundfont-preload', 'Preload the active track SoundFont.');
    if (gmStatus) {
      ctx.fillStyle = gmStatus.error ? '#ff8a8a' : UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      const statusText = gmStatus.error
        ? `SoundFont error: ${gmStatus.error}`
        : gmStatus.loading
          ? 'SoundFont status: Loading…'
          : 'SoundFont status: Ready';
      ctx.fillText(statusText, x + padding, cursorY + 16);
      cursorY += 28;
    }
    const midiDebug = this.game?.audio?.getMidiDebugInfo?.();
    if (midiDebug) {
      ctx.fillStyle = UI_SUITE.colors.muted;
      ctx.font = `11px ${UI_SUITE.font.family}`;
      const debugKit = midiDebug.drumKit?.label || 'Standard Kit';
      ctx.fillText(`Drum Kit: ${debugKit}`, x + padding, cursorY + 16);
      cursorY += 18;
      const drumNote = midiDebug.lastDrumNote
        ? `${midiDebug.lastDrumNote.label} (${midiDebug.lastDrumNote.pitch})`
        : 'None';
      ctx.fillText(`Last Drum: ${drumNote}`, x + padding, cursorY + 16);
      cursorY += 18;
      const channelType = midiDebug.lastChannelType
        ? `${midiDebug.lastChannelType} (Ch ${Number.isInteger(midiDebug.lastChannel) ? midiDebug.lastChannel + 1 : '?'})`
        : 'None';
      ctx.fillText(`Channel: ${channelType}`, x + padding, cursorY + 16);
      cursorY += 24;
    }
    cursorY += sectionGap;

    drawSectionTitle('Grid & Editing');
    drawToggle('Preview On', this.previewOnEdit, 'grid-preview', 'Audition notes as you place them.');
    drawAction('Grid', this.quantizeOptions[this.quantizeIndex].label, 'grid-quantize-value', 'Quantize grid step size.');
    drawToggle('Quant', this.quantizeEnabled, 'grid-quantize-toggle', 'Enable quantized placement.');
    drawToggle('Staccato', this.staccatoEnabled, 'grid-staccato', 'Shorten placed notes while keeping grid timing.');
    drawTimeSignatureControls();
    drawToggle('Snap', this.scaleLock, 'grid-scale-lock', 'Snap pitches to the current scale.');
    drawToggle('Chord Mode', this.chordMode, 'grid-chord-mode', 'Show chord tones and highlight chord notes.');
    drawAction('Chords', 'Edit', 'grid-chord-progression', 'Define chord progressions by bar range.');
    drawToggle('Scrub', this.scrubAudition, 'grid-scrub', 'Audition notes while scrubbing.');
    drawAction('All', 'Select', 'grid-select-all', 'Select all notes in the current pattern.');
    drawToggle('High Contrast', this.highContrast, 'ui-contrast', 'Boosts UI contrast for clarity.');
    cursorY += sectionGap;

    drawSectionTitle('Virtual Instruments');
    const gamepadConnected = this.gamepadInput.connected;
    const preferredDevice = this.recordDevicePreference === 'auto'
      ? (gamepadConnected ? 'gamepad' : 'touch')
      : this.recordDevicePreference;
    drawButtonRow(
      'Input',
      [
        {
          id: 'virtual-device-gamepad',
          label: gamepadConnected ? 'Gamepad' : 'No Pad',
          active: preferredDevice === 'gamepad',
          disabled: !gamepadConnected
        },
        {
          id: 'virtual-device-touch',
          label: 'Touch',
          active: preferredDevice === 'touch',
          disabled: false
        }
      ],
      'Choose the control source for virtual instruments.'
    );
    cursorY += sectionGap;

    drawSectionTitle('Touch Input');
    drawToggle(
      'Reverse Strings',
      this.reverseStrings,
      'touch-reverse-strings',
      'Place the lowest string at the top for guitar/bass.'
    );
    cursorY += sectionGap;

    drawSectionTitle('Tempo & Playback');
    drawSlider('Tempo', `${this.song.tempo} BPM`, (this.song.tempo - 40) / 200, 'song-tempo', 'Adjust playback tempo.');
    drawToggle('Loop Enabled', this.song.loopEnabled, 'playback-loop', 'Loops between Start and End markers.');
    drawSlider('Swing', `${Math.round(this.swing)}%`, this.swing / 60, 'playback-swing', 'Delays off-beats for groove.');
    cursorY += sectionGap;

    drawSectionTitle('Controller');
    ctx.fillStyle = UI_SUITE.colors.muted;
    ctx.font = `11px ${UI_SUITE.font.family}`;
    ctx.fillText('Shared editor controller profile.', x + padding, cursorY + 8);
    cursorY += 20;
    SHARED_EDITOR_GAMEPAD_HINTS.forEach((line) => {
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `12px ${UI_SUITE.font.family}`;
      ctx.fillText(line, x + padding, cursorY + 16);
      cursorY += 20;
    });
    cursorY += sectionGap;

    drawSectionTitle('Tracks');
    const mixerHeight = this.drawTrackMixer(ctx, x + padding, cursorY, w - padding * 2);
    cursorY += mixerHeight;

    drawSectionTitle('Help');
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    const helpLines = [
      'Drag a box to select notes, then use Copy / Cut / Paste.',
      'A: place note',
      'X: erase note',
      'Y: undo',
      'RB+Y: redo',
      'RT + Left Stick: selection box',
      'LB + D-Pad: play/record/measure jump',
      'Back: focus grid/song',
      'Drag on grid to move selection.'
    ];
    helpLines.forEach((line) => {
      ctx.fillText(line, x + padding, cursorY + 18);
      cursorY += 20;
    });
    cursorY += sectionGap;

    const contentHeight = cursorY - y + padding + this.settingsScroll;
    ctx.restore();
    this.settingsScrollMax = Math.max(0, contentHeight - h + padding);
    this.settingsScroll = clamp(this.settingsScroll, 0, this.settingsScrollMax);
    drawSharedPortraitScrollHints(ctx, this.bounds.settingsPanel, {
      scroll: this.settingsScroll,
      scrollMax: this.settingsScrollMax
    });
  }

  drawHelpPanel(ctx, x, y, w, h) {
    drawSharedPanel(ctx, { x, y, w, h }, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    const padding = 16;
    let cursorY = y + padding;
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `18px ${UI_SUITE.font.family}`;
    ctx.fillText('Controller Help', x + padding, cursorY + 18);
    cursorY += 32;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    const lines = [
      'Move Cursor: D-pad / Left Stick',
      'A: place note',
      'X: erase note',
      'Y: undo',
      'RB+Y: redo',
      'LT/RT: scrub or zoom context',
      'RT + Left Stick: selection box',
      'LB + D-Pad: play/record/measure jump',
      'LB + Left Stick: grow selection note',
      'LB + Right Stick: shrink selection note',
      'Back: focus grid/song'
    ];
    lines.forEach((line) => {
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.fillText(line, x + padding, cursorY + 18);
      cursorY += 22;
    });
  }

  drawTrackMixer(ctx, x, y, w) {
    const isMobile = this.isMobileLayout();
    const rowH = isMobile ? 86 : 78;
    const gap = 10;
    this.trackBounds = [];
    this.trackControlBounds = [];
    let cursorY = y;
    const masterBounds = { x, y: cursorY, w, h: rowH };
    drawSharedPanel(ctx, masterBounds, { fill: UI_SUITE.colors.panelAlt, border: UI_SUITE.colors.border });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `13px ${UI_SUITE.font.family}`;
    ctx.fillText('Master', masterBounds.x + 10, masterBounds.y + 22);
    const masterVolumeBounds = {
      x: masterBounds.x + 120,
      y: masterBounds.y + 42,
      w: masterBounds.w - 140,
      h: 12,
      control: 'master-volume'
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(masterVolumeBounds.x, masterVolumeBounds.y, masterVolumeBounds.w, masterVolumeBounds.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(
      masterVolumeBounds.x,
      masterVolumeBounds.y,
      masterVolumeBounds.w * clamp(this.audioSettings.masterVolume, 0, 1),
      masterVolumeBounds.h
    );
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(masterVolumeBounds.x, masterVolumeBounds.y, masterVolumeBounds.w, masterVolumeBounds.h);
    this.trackControlBounds.push(masterVolumeBounds);

    const masterPanBounds = {
      x: masterBounds.x + 120,
      y: masterBounds.y + 60,
      w: masterBounds.w - 140,
      h: 10,
      control: 'master-pan'
    };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(masterPanBounds.x, masterPanBounds.y, masterPanBounds.w, masterPanBounds.h);
    ctx.fillStyle = '#4fb7ff';
    ctx.fillRect(
      masterPanBounds.x,
      masterPanBounds.y,
      masterPanBounds.w * ((clamp(this.audioSettings.masterPan, -1, 1) + 1) / 2),
      masterPanBounds.h
    );
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(masterPanBounds.x, masterPanBounds.y, masterPanBounds.w, masterPanBounds.h);
    this.trackControlBounds.push(masterPanBounds);
    cursorY += rowH + gap;
    this.song.tracks.forEach((track, index) => {
      const mix = this.getTrackBaseMix(track);
      const bounds = { x, y: cursorY, w, h: rowH, index };
      drawSharedPanel(ctx, bounds, {
        fill: index === this.selectedTrackIndex ? 'rgba(255,225,106,0.2)' : UI_SUITE.colors.panel,
        border: track.color || UI_SUITE.colors.border
      });
      ctx.fillStyle = UI_SUITE.colors.text;
      ctx.font = `13px ${UI_SUITE.font.family}`;
      ctx.fillText(track.name, bounds.x + 10, bounds.y + 22);
      const muteBounds = { x: bounds.x + 10, y: bounds.y + 28, w: 44, h: 44, trackIndex: index, control: 'mute' };
      const soloBounds = { x: bounds.x + 60, y: bounds.y + 28, w: 44, h: 44, trackIndex: index, control: 'solo' };
      this.drawButton(ctx, muteBounds, 'M', track.mute, false);
      this.drawButton(ctx, soloBounds, 'S', track.solo, false);
      this.trackControlBounds.push(muteBounds, soloBounds);
      const volumeBounds = {
        x: bounds.x + 120,
        y: bounds.y + 42,
        w: bounds.w - 140,
        h: 12,
        trackIndex: index,
        control: 'volume'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      this.trackControlBounds.push(volumeBounds);

      const panBounds = {
        x: bounds.x + 120,
        y: bounds.y + 60,
        w: bounds.w - 140,
        h: 10,
        trackIndex: index,
        control: 'pan'
      };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      ctx.fillStyle = '#4fb7ff';
      ctx.fillRect(panBounds.x, panBounds.y, panBounds.w * ((mix.pan + 1) / 2), panBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(panBounds.x, panBounds.y, panBounds.w, panBounds.h);
      this.trackControlBounds.push(panBounds);
      this.trackBounds.push(bounds);
      cursorY += rowH + gap;
    });
    return cursorY - y;
  }

  drawTopBar(ctx, x, y, w, h, track) {
    ctx.fillStyle = this.editorShellTheme.surfaceAlt;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    this.bounds.endMarker = null;
    this.bounds.loopToggle = null;

    const isMobile = this.isMobileLayout();
    const rowGap = 8;
    const rowH = isMobile ? 30 : 28;
    const titleRowY = y + 10;
    const instrumentRowY = isMobile ? titleRowY + rowH + rowGap : titleRowY;
    const controlsRowY = isMobile ? instrumentRowY + rowH + rowGap : titleRowY;

    ctx.fillStyle = '#fff';
    ctx.font = isMobile ? '16px Courier New' : '18px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Pattern Sequencer', x + 12, titleRowY - 6);

    const gmStatus = this.game?.audio?.getGmStatus?.();
    if (gmStatus) {
      const statusText = gmStatus.error
        ? 'GM Bank Error'
        : gmStatus.loading
          ? 'Loading instrument bank…'
          : 'GM Bank Ready';
      ctx.fillStyle = gmStatus.error ? '#ff6a6a' : 'rgba(255,255,255,0.7)';
      ctx.font = '11px Courier New';
      ctx.fillText(statusText, x + 12, titleRowY + (isMobile ? 12 : 10));
    }

    const settingsW = isMobile ? 96 : 110;
    this.bounds.settings = { x: x + w - settingsW - 12, y: titleRowY, w: settingsW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.settings, 'Settings', this.settingsOpen);

    let cursorX = x + 12;
    const buttonSize = rowH;
    this.bounds.instrumentPrev = { x: cursorX, y: instrumentRowY, w: buttonSize, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentPrev, '<', false);
    cursorX += buttonSize + 6;

    const instrumentLabel = this.getTrackInstrumentLabel(track);
    ctx.font = '13px Courier New';
    const labelWidth = Math.min(260, Math.max(140, ctx.measureText(instrumentLabel).width + 24));
    this.bounds.instrumentLabel = { x: cursorX, y: instrumentRowY, w: labelWidth, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentLabel, instrumentLabel, false);
    cursorX += labelWidth + 6;

    this.bounds.instrumentNext = { x: cursorX, y: instrumentRowY, w: buttonSize, h: rowH };
    this.drawSmallButton(ctx, this.bounds.instrumentNext, '>', false);
    cursorX += buttonSize + 10;

    this.bounds.addTrack = { x: cursorX, y: instrumentRowY, w: 64, h: rowH };
    this.drawSmallButton(ctx, this.bounds.addTrack, 'Add', false);
    cursorX += 70;

    this.bounds.removeTrack = { x: cursorX, y: instrumentRowY, w: 78, h: rowH };
    this.drawDangerButton(ctx, this.bounds.removeTrack, 'Remove');

    const controlStartX = isMobile ? x + 12 : x + w - 400;
    const playW = isMobile ? 90 : 100;
    this.bounds.play = { x: controlStartX, y: controlsRowY, w: playW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.play, this.isPlaying ? 'Stop' : 'Play', this.isPlaying);

    const slurX = controlStartX + playW + 10;
    this.bounds.slur = { x: slurX, y: controlsRowY, w: 90, h: rowH };
    this.drawToggle(ctx, this.bounds.slur, `Slur ${this.slurEnabled ? 'On' : 'Off'}`, this.slurEnabled);

    let noteLengthX = slurX + 100;
    const noteLengthLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
    this.bounds.noteLength = { x: noteLengthX, y: controlsRowY, w: 96, h: rowH };
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLengthLabel, false);

    noteLengthX += 110;
    if (track && isDrumTrack(track)) {
      this.bounds.drumView = { x: noteLengthX, y: controlsRowY, w: 140, h: rowH };
      const drumLabel = this.drumAdvanced ? 'Drum View: Full' : 'Drum View: Basic';
      this.drawSmallButton(ctx, this.bounds.drumView, drumLabel, false);
      noteLengthX += 150;
    } else {
      this.bounds.drumView = null;
    }

    this.bounds.metronome = { x: noteLengthX, y: controlsRowY, w: 108, h: rowH };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);

    const tempoX = noteLengthX + this.bounds.metronome.w + 8;
    const tempoLabel = `${this.song.tempo} BPM`;
    const tempoW = isMobile ? 88 : 96;
    this.bounds.tempoButton = { x: tempoX, y: controlsRowY, w: tempoW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);
  }

  drawTransport(ctx, x, y, w, h) {
    const scale = Math.min(1, w / 980);
    const offset = (value) => value * scale;
    const buttonW = 92 * scale;
    const buttonH = 36 * scale;
    this.bounds.play = { x: x + offset(16), y: y + offset(18), w: buttonW, h: buttonH };
    ctx.fillStyle = this.isPlaying ? '#ffe16a' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.bounds.play.x, this.bounds.play.y, buttonW, buttonH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(this.bounds.play.x, this.bounds.play.y, buttonW, buttonH);
    ctx.fillStyle = this.isPlaying ? '#0b0b0b' : '#fff';
    ctx.font = `${Math.max(12, Math.round(16 * scale))}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(this.isPlaying ? 'STOP' : 'PLAY', this.bounds.play.x + buttonW / 2, this.bounds.play.y + buttonH * 0.65);
    ctx.textAlign = 'left';

    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(11, Math.round(14 * scale))}px Courier New`;
    const tempoW = Math.min(offset(200), Math.max(offset(120), ctx.measureText(tempoLabel).width + offset(24)));
    this.bounds.tempoButton = { x: x + offset(130), y: y + offset(16), w: tempoW, h: offset(24) };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);

    this.bounds.endMarker = { x: x + offset(340), y: y + offset(16), w: offset(140), h: offset(24) };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.endMarker.x, this.bounds.endMarker.y, this.bounds.endMarker.w, this.bounds.endMarker.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(this.bounds.endMarker.x, this.bounds.endMarker.y, this.bounds.endMarker.w, this.bounds.endMarker.h);
    ctx.fillStyle = '#fff';
    const endLabel = this.placingEndMarker ? 'Set End...' : this.getEndMarkerLabel();
    ctx.fillText(endLabel, this.bounds.endMarker.x + offset(8), this.bounds.endMarker.y + offset(16));

    this.bounds.loopToggle = { x: x + offset(490), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.loopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);

    this.bounds.metronome = { x: x + offset(610), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);

    this.bounds.quantizeToggle = { x: x + offset(740), y: y + offset(16), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.quantizeToggle, `Quant ${this.quantizeEnabled ? 'On' : 'Off'}`, this.quantizeEnabled);
    this.bounds.quantizeValue = { x: x + offset(860), y: y + offset(16), w: offset(70), h: offset(24) };
    this.drawToggle(ctx, this.bounds.quantizeValue, this.quantizeOptions[this.quantizeIndex].label, true);

    this.bounds.swing = { x: x + offset(16), y: y + offset(58), w: offset(200), h: offset(16) };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    const knobX = this.bounds.swing.x + (this.swing / 60) * this.bounds.swing.w;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(knobX - offset(4), this.bounds.swing.y - offset(2), offset(8), this.bounds.swing.h + offset(4));
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(10, Math.round(12 * scale))}px Courier New`;
    ctx.fillText(`Swing ${Math.round(this.swing)}%`, this.bounds.swing.x + offset(210), this.bounds.swing.y + offset(12));

    this.bounds.preview = { x: x + offset(340), y: y + offset(54), w: offset(150), h: offset(24) };
    this.drawToggle(ctx, this.bounds.preview, `Preview ${this.previewOnEdit ? 'On' : 'Off'}`, this.previewOnEdit);

    this.bounds.scrub = { x: x + offset(500), y: y + offset(54), w: offset(150), h: offset(24) };
    this.drawToggle(ctx, this.bounds.scrub, `Scrub ${this.scrubAudition ? 'On' : 'Off'}`, this.scrubAudition);

    this.bounds.key = { x: x + offset(660), y: y + offset(54), w: offset(60), h: offset(24) };
    this.drawToggle(ctx, this.bounds.key, KEY_LABELS[this.song.key], true);
    const scaleLabel = SCALE_LIBRARY.find((scale) => scale.id === this.song.scale)?.label || 'Major';
    this.bounds.scale = { x: x + offset(728), y: y + offset(54), w: offset(110), h: offset(24) };
    this.drawToggle(ctx, this.bounds.scale, scaleLabel, true);
    this.bounds.scaleLock = { x: x + offset(848), y: y + offset(54), w: offset(120), h: offset(24) };
    this.drawToggle(ctx, this.bounds.scaleLock, `Scale Lock ${this.scaleLock ? 'On' : 'Off'}`, this.scaleLock);

    this.bounds.tools = { x: x + w - offset(120), y: y + offset(18), w: offset(100), h: offset(28) };
    this.drawToggle(ctx, this.bounds.tools, 'Tools', false);

    const ticksPerBar = this.getTicksPerBar();
    const beatTicks = this.getBeatTicks();
    const bar = Math.floor(this.playheadTick / ticksPerBar) + 1;
    const beat = Math.floor((this.playheadTick % ticksPerBar) / beatTicks) + 1;
    ctx.fillStyle = '#ffe16a';
    ctx.font = `${Math.max(11, Math.round(14 * scale))}px Courier New`;
    ctx.fillText(`Position ${bar}:${beat}`, x + w - offset(160), y + offset(70));
    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = '#ff9c42';
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px Courier New`;
      ctx.fillText('Single Note', x + w - offset(160), y + offset(88));
    }
  }

  drawTransportCompact(ctx, x, y, w, h) {
    const innerX = x + 12;
    const innerW = w - 24;
    const rowH = 30;
    const gap = 8;
    const colGap = 12;
    const colW = (innerW - colGap) / 2;
    let rowY = y + 12;

    this.bounds.play = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.play, this.isPlaying ? 'Stop' : 'Play', this.isPlaying);
    this.bounds.tools = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tools, 'Tools', false);
    rowY += rowH + gap;

    const tempoLabel = `Tempo ${this.song.tempo}BPM`;
    this.bounds.tempoButton = { x: innerX, y: rowY, w: innerW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.tempoButton, tempoLabel, this.tempoSliderOpen);
    rowY += rowH + gap;

    this.bounds.endMarker = { x: innerX, y: rowY, w: innerW, h: rowH };
    const endLabel = this.placingEndMarker ? 'Set End...' : this.getEndMarkerLabel();
    this.drawSmallButton(ctx, this.bounds.endMarker, endLabel, false);
    rowY += rowH + gap;

    this.bounds.loopToggle = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.loopToggle, `Loop ${this.song.loopEnabled ? 'On' : 'Off'}`, this.song.loopEnabled);
    this.bounds.metronome = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.metronome, `Metro ${this.metronomeEnabled ? 'On' : 'Off'}`, this.metronomeEnabled);
    rowY += rowH + gap;

    this.bounds.quantizeToggle = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.quantizeToggle, `Quant ${this.quantizeEnabled ? 'On' : 'Off'}`, this.quantizeEnabled);
    this.bounds.quantizeValue = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawSmallButton(ctx, this.bounds.quantizeValue, this.quantizeOptions[this.quantizeIndex].label, true);
    rowY += rowH + gap;

    this.bounds.noteLength = { x: innerX, y: rowY, w: colW, h: rowH };
    const noteLengthLabel = `Note ${this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex])}`;
    this.drawSmallButton(ctx, this.bounds.noteLength, noteLengthLabel, false);
    this.bounds.preview = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.preview, `Preview ${this.previewOnEdit ? 'On' : 'Off'}`, this.previewOnEdit);
    rowY += rowH + gap;

    this.bounds.scrub = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.scrub, `Scrub ${this.scrubAudition ? 'On' : 'Off'}`, this.scrubAudition);
    this.bounds.key = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.key, KEY_LABELS[this.song.key], true);
    rowY += rowH + gap;

    const scaleLabel = SCALE_LIBRARY.find((scale) => scale.id === this.song.scale)?.label || 'Major';
    this.bounds.scale = { x: innerX, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.scale, scaleLabel, true);
    this.bounds.scaleLock = { x: innerX + colW + colGap, y: rowY, w: colW, h: rowH };
    this.drawToggle(ctx, this.bounds.scaleLock, `Scale Lock ${this.scaleLock ? 'On' : 'Off'}`, this.scaleLock);
    rowY += rowH + gap;

    this.bounds.swing = { x: innerX, y: rowY + 6, w: innerW, h: 16 };
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(this.bounds.swing.x, this.bounds.swing.y, this.bounds.swing.w, this.bounds.swing.h);
    const knobX = this.bounds.swing.x + (this.swing / 60) * this.bounds.swing.w;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(knobX - 4, this.bounds.swing.y - 2, 8, this.bounds.swing.h + 4);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText(`Swing ${Math.round(this.swing)}%`, this.bounds.swing.x + 6, this.bounds.swing.y + 30);
    if (this.singleNoteRecordMode.active) {
      ctx.fillStyle = '#ff9c42';
      ctx.font = '12px Courier New';
      ctx.fillText('Single Note Mode', innerX, this.bounds.swing.y + 50);
    }
  }

  drawTrackList(ctx, x, y, w, h) {
    const isMobile = this.isMobileLayout();
    ctx.fillStyle = this.editorShellTheme.surfaceAlt;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = `${isMobile ? 18 : 16}px Courier New`;
    ctx.fillText('Tracks', x + 16, y + 26);

    const buttonY = y + 36;
    const buttonH = isMobile ? 28 : 22;
    this.bounds.addTrack = { x: x + 16, y: buttonY, w: 80, h: buttonH };
    this.bounds.removeTrack = { x: x + 104, y: buttonY, w: 90, h: buttonH };
    this.bounds.duplicateTrack = { x: x + 202, y: buttonY, w: 120, h: buttonH };
    this.drawSmallButton(ctx, this.bounds.addTrack, 'Add', false);
    this.drawDangerButton(ctx, this.bounds.removeTrack, 'Remove');
    this.drawSmallButton(ctx, this.bounds.duplicateTrack, 'Duplicate', false);

    this.trackBounds = [];
    this.trackControlBounds = [];
    const listY = y + (isMobile ? 84 : 72);
    const rowH = isMobile ? 104 : 80;
    this.song.tracks.forEach((track, index) => {
      const mix = this.getTrackBaseMix(track);
      const rowY = listY + index * rowH;
      const isActive = index === this.selectedTrackIndex;
      ctx.fillStyle = isActive ? 'rgba(255,225,106,0.2)' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 12, rowY, w - 24, rowH - 8);
      ctx.strokeStyle = track.color || 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x + 12, rowY, w - 24, rowH - 8);
      ctx.fillStyle = track.color || '#fff';
      ctx.fillRect(x + 18, rowY + 8, 8, rowH - 24);
      ctx.fillStyle = '#fff';
      ctx.font = `${isMobile ? 16 : 14}px Courier New`;
      ctx.fillText(track.name, x + 32, rowY + (isMobile ? 26 : 20));
      this.trackControlBounds.push({
        x: x + 30,
        y: rowY + 6,
        w: w - 170,
        h: isMobile ? 24 : 20,
        trackIndex: index,
        control: 'name'
      });
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${isMobile ? 14 : 12}px Courier New`;
      const isDrums = isDrumTrack(track);
      const instrumentLabel = isDrums
        ? this.getDrumKitLabel(track)
        : this.getProgramLabel(track.program);
      ctx.fillText(instrumentLabel, x + 32, rowY + (isMobile ? 50 : 38));
      this.trackControlBounds.push({
        x: x + 30,
        y: rowY + (isMobile ? 34 : 26),
        w: w - 170,
        h: isMobile ? 26 : 18,
        trackIndex: index,
        control: 'instrument'
      });

      const channelButtonH = isMobile ? 22 : 18;
      const channelDownBounds = { x: x + w - 170, y: rowY + 8, w: 20, h: channelButtonH };
      const channelLabelBounds = { x: x + w - 146, y: rowY + 8, w: 50, h: channelButtonH };
      const channelUpBounds = { x: x + w - 92, y: rowY + 8, w: 20, h: channelButtonH };
      this.drawSmallButton(ctx, channelDownBounds, '<', false);
      this.drawSmallButton(ctx, channelLabelBounds, `Ch ${track.channel + 1}`, false);
      this.drawSmallButton(ctx, channelUpBounds, '>', false);
      this.trackControlBounds.push({ ...channelDownBounds, trackIndex: index, control: 'channel-down' });
      this.trackControlBounds.push({ ...channelLabelBounds, trackIndex: index, control: 'channel-prompt' });
      this.trackControlBounds.push({ ...channelUpBounds, trackIndex: index, control: 'channel-up' });

      const muteBounds = { x: x + w - 64, y: rowY + 8, w: isMobile ? 28 : 22, h: channelButtonH };
      const soloBounds = { x: x + w - 34, y: rowY + 8, w: isMobile ? 28 : 22, h: channelButtonH };
      this.drawSmallButton(ctx, muteBounds, 'M', track.mute);
      this.drawSmallButton(ctx, soloBounds, 'S', track.solo);
      this.trackControlBounds.push({ ...muteBounds, trackIndex: index, control: 'mute' });
      this.trackControlBounds.push({ ...soloBounds, trackIndex: index, control: 'solo' });

      const bankBounds = { x: x + 32, y: rowY + (isMobile ? 64 : 50), w: 120, h: isMobile ? 20 : 18 };
      const bankLabel = isDrums ? this.getDrumKitLabel(track) : `Bank ${track.bankMSB}/${track.bankLSB}`;
      this.drawSmallButton(ctx, bankBounds, bankLabel, false);
      this.trackControlBounds.push({ ...bankBounds, trackIndex: index, control: 'bank' });
      if (!isDrums) {
        const drumsBounds = { x: bankBounds.x + bankBounds.w + 8, y: bankBounds.y, w: 100, h: bankBounds.h };
        this.drawSmallButton(ctx, drumsBounds, 'Set Drums', false);
        this.trackControlBounds.push({ ...drumsBounds, trackIndex: index, control: 'set-drums' });
      }

      const volumeBounds = { x: x + 32, y: rowY + (isMobile ? 86 : 64), w: w - 70, h: isMobile ? 12 : 10 };
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      ctx.fillStyle = '#ffe16a';
      ctx.fillRect(volumeBounds.x, volumeBounds.y, volumeBounds.w * mix.volume, volumeBounds.h);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(volumeBounds.x, volumeBounds.y, volumeBounds.w, volumeBounds.h);
      this.trackControlBounds.push({ ...volumeBounds, trackIndex: index, control: 'volume' });

      this.trackBounds.push({ x: x + 12, y: rowY, w: w - 24, h: rowH - 8, index });
    });
  }

  drawPatternEditor(ctx, x, y, w, h, track, pattern, options = {}) {
    if (!track || !pattern) return;
    const simplified = options.simplified;
    const gridTicks = this.getGridTicks();
    const drumGrid = isDrumTrack(track);
    const rows = drumGrid
      ? this.getDrumRows().length
      : this.getPitchRange().max - this.getPitchRange().min + 1;
    const isMobile = this.isMobileLayout();
    const viewportWidth = this.viewportWidth || (x + w);
    const viewportHeight = this.viewportHeight || (y + h);
    const isPortrait = isMobilePortraitLayout({ isMobile, viewportWidth, viewportHeight });
    const baseVisibleRows = this.getBaseVisibleRows(rows);
    const { minZoom, maxZoom } = this.getGridZoomLimits(rows);
    const zoomXLimits = this.getGridZoomLimitsX();
    const metrics = getMidiPatternGridLayoutMetrics({
      x,
      y,
      w,
      h,
      gridTicks,
      rows,
      isMobile,
      isPortrait,
      drumGrid,
      simplified,
      hideLabels: options.hideLabels,
      gridZoomX: this.gridZoomX,
      gridZoomY: this.gridZoomY,
      baseVisibleRows,
      zoomYLimits: { minZoom, maxZoom },
      zoomXLimits,
      portraitVisibleTicks: this.getTicksPerBar() * 2,
      landscapeVisibleTicks: this.getTicksPerBar() * 4,
      initialized: this.gridZoomInitialized
    });
    const {
      labelW,
      rulerH,
      viewW,
      viewH,
      cellWidth,
      cellHeight,
      totalGridW,
      gridH
    } = metrics;
    this.gridZoomX = metrics.gridZoomX;
    this.gridZoomY = metrics.gridZoomY;
    if (!this.gridZoomInitialized) {
      this.gridZoomInitialized = true;
    }
    if (drumGrid && !metrics.portrait) {
      this.gridOffset.y = 0;
    }
    if (Number.isFinite(this.timelineStartTick)) {
      if (this.timelineSource === 'song') {
        this.gridOffset.x = -this.timelineStartTick * cellWidth;
        this.timelineSource = 'grid';
      } else {
        this.timelineStartTick = Math.max(0, -this.gridOffset.x / cellWidth);
      }
    }
    this.initializeGridOffset(track, rows, cellHeight);
    this.clampGridOffset(viewW, viewH, totalGridW, drumGrid && !metrics.portrait ? viewH : gridH);
    const originX = x + labelW + this.gridOffset.x;
    const originY = y + rulerH + (drumGrid && !metrics.portrait ? 0 : this.gridOffset.y);

    this.rulerBounds = { x: x + labelW, y, w: viewW, h: rulerH };
    this.gridBounds = {
      x: x + labelW,
      y: y + rulerH,
      w: viewW,
      h: viewH,
      cols: gridTicks,
      rows,
      cellWidth,
      cellHeight,
      originX,
      originY,
      gridW: totalGridW,
      gridH,
      labelX: x,
      labelW
    };
    if (this.pendingGridFocus) {
      this.focusGridViewportOn(this.pendingGridFocus);
      this.gridBounds.originX = x + labelW + this.gridOffset.x;
      this.gridBounds.originY = y + rulerH + (drumGrid && !metrics.portrait ? 0 : this.gridOffset.y);
    }

    ctx.fillStyle = this.editorShellTheme.surfaceAlt;
    ctx.fillRect(x, y, w, viewH + rulerH);
    if (!simplified) {
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(x, y, w, viewH + rulerH);
    }

    if (!simplified) {
      this.drawRuler(ctx, x + labelW, y, viewW, rulerH, gridTicks);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + labelW, y + rulerH, viewW, viewH);
    ctx.clip();
    this.drawGrid(ctx, track, pattern, gridTicks, options);
    if (!simplified) {
      this.drawPlayhead(ctx);
      this.drawCursor(ctx);
    }
    ctx.restore();

    if (!options.hideLabels) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, labelW, viewH + rulerH);
      ctx.strokeStyle = UI_SUITE.colors.border;
      ctx.strokeRect(x, y, labelW, viewH + rulerH);
      this.drawLabelColumn(ctx, track);
    }
    if (!simplified) {
      this.drawSelectionMenu(ctx);
    }
  }

  drawRuler(ctx, x, y, w, h, loopTicks) {
    if (!this.gridBounds) return;
    this.drawTimelineRuler(ctx, x, y, w, h, loopTicks, this.gridBounds);
  }

  drawGrid(ctx, track, pattern, loopTicks, options = {}) {
    const { originX, originY, cellWidth, cellHeight, rows } = this.gridBounds;
    const isDrumGrid = isDrumTrack(track);
    const chordMode = this.chordMode;
    const scalePitchClasses = this.getScalePitchClasses();
    const simplified = options.simplified;
    this.bounds.pasteAction = null;

    for (let row = 0; row < rows; row += 1) {
      if (options.summary) {
        ctx.fillStyle = UI_SUITE.colors.panel;
      } else if (isDrumGrid) {
        ctx.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.03)';
      } else {
        const pitch = this.getPitchFromRow(row);
        const pitchClass = pitch % 12;
        const isScaleTone = scalePitchClasses.includes(pitchClass);
        if (!chordMode) {
          ctx.fillStyle = isBlackKey(pitchClass)
            ? 'rgba(0,0,0,0.4)'
            : 'rgba(255,255,255,0.06)';
        } else if (isScaleTone) {
          ctx.fillStyle = this.editorShellTheme.surfaceAlt;
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
        }
      }
      ctx.fillRect(originX, originY + row * cellHeight, cellWidth * loopTicks, cellHeight);
    }

    if (isDrumGrid && !simplified && !options.summary) {
      const padInset = Math.max(1, Math.min(4, Math.round(Math.min(cellWidth, cellHeight) * 0.12)));
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      for (let row = 0; row < rows; row += 1) {
        const yPos = originY + row * cellHeight + padInset;
        const padH = Math.max(2, cellHeight - padInset * 2);
        for (let tick = 0; tick < loopTicks; tick += 1) {
          const xPos = originX + tick * cellWidth + padInset;
          const padW = Math.max(2, cellWidth - padInset * 2);
          ctx.strokeRect(xPos, yPos, padW, padH);
        }
      }
    }

    const ticksPerBar = this.getTicksPerBar();
    if (!options.summary && !isDrumGrid && chordMode) {
      for (let barTick = 0; barTick < loopTicks; barTick += ticksPerBar) {
        const chord = this.getChordForTick(barTick);
        const chordTones = this.getChordTones(chord);
        if (!chordTones.length) continue;
        const barEnd = Math.min(loopTicks, barTick + ticksPerBar);
        const barWidth = (barEnd - barTick) * cellWidth;
        for (let row = 0; row < rows; row += 1) {
          const pitch = this.getPitchFromRow(row);
          const pitchClass = pitch % 12;
          if (!chordTones.includes(pitchClass)) continue;
          ctx.fillStyle = 'rgba(79,183,255,0.16)';
          ctx.fillRect(originX + barTick * cellWidth, originY + row * cellHeight, barWidth, cellHeight);
        }
      }
    }
    if (this.song.loopEnabled && typeof this.song.loopStartTick === 'number' && typeof this.song.loopEndTick === 'number') {
      const loopStartX = originX + this.song.loopStartTick * cellWidth;
      const loopEndX = originX + this.song.loopEndTick * cellWidth;
      ctx.fillStyle = 'rgba(255,225,106,0.18)';
      ctx.fillRect(loopStartX, originY, loopEndX - loopStartX, rows * cellHeight);
    }
    if (!simplified) {
      const gridStep = this.getPlacementSnapTicks(track);
      for (let barTick = 0; barTick <= loopTicks; barTick += ticksPerBar) {
        const xPos = originX + barTick * cellWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xPos, originY);
        ctx.lineTo(xPos, originY + rows * cellHeight);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (let tick = 0; tick <= loopTicks; tick += gridStep) {
        const xPos = originX + tick * cellWidth;
        const isBeat = tick % this.ticksPerBeat === 0;
        ctx.strokeStyle = isBeat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(xPos, originY);
        ctx.lineTo(xPos, originY + rows * cellHeight);
        ctx.stroke();
      }

      if (typeof this.song.loopStartTick === 'number') {
        const startX = originX + this.song.loopStartTick * cellWidth;
        ctx.strokeStyle = '#55d68a';
        ctx.beginPath();
        ctx.moveTo(startX, originY);
        ctx.lineTo(startX, originY + rows * cellHeight);
        ctx.stroke();
      }
      if (typeof this.song.loopEndTick === 'number') {
        const endX = originX + this.song.loopEndTick * cellWidth;
        ctx.strokeStyle = '#ff6a6a';
        ctx.beginPath();
        ctx.moveTo(endX, originY);
        ctx.lineTo(endX, originY + rows * cellHeight);
        ctx.stroke();
      }
      for (let row = 0; row <= rows; row += 1) {
        const yPos = originY + row * cellHeight;
        let isOctave = false;
        if (!options.summary && !isDrumGrid && row < rows) {
          const pitch = this.getPitchFromRow(row);
          isOctave = pitch % 12 === 0;
        }
        ctx.strokeStyle = options.summary
          ? 'rgba(255,255,255,0.12)'
          : isOctave
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = options.summary ? 1 : (isOctave ? 2 : 1);
        ctx.beginPath();
        ctx.moveTo(originX, yPos);
        ctx.lineTo(originX + loopTicks * cellWidth, yPos);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }

    this.noteBounds = [];
    pattern.notes.forEach((note) => {
      const rect = this.getNoteRect(note);
      if (!rect) return;
      const baseColor = track.color || '#4fb7ff';
      let noteFill = baseColor;
      if (!options.uniformNotes && !isDrumGrid && !chordMode) {
        const pitchClass = note.pitch % 12;
        noteFill = isBlackKey(pitchClass)
          ? toRgba(baseColor, 0.7)
          : toRgba(baseColor, 0.95);
      }
      ctx.fillStyle = this.selection.has(note.id) ? '#ffe16a' : noteFill;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      if (!simplified && this.activeNotes.has(note.id)) {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
      if (!simplified && !options.summary && !isDrumGrid && chordMode) {
        const chord = this.getChordForTick(note.startTick);
        const chordTones = this.getChordTones(chord);
        if (chordTones.includes(note.pitch % 12)) {
          ctx.strokeStyle = '#ffe16a';
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        }
      }
      if (!simplified && !isDrumGrid && this.selection.has(note.id)) {
        const handleHeight = rect.h;
        const handleWidth = this.getNoteHandleWidth(rect);
        const handleY = rect.y;
        const leftHandleX = rect.x;
        const rightHandleX = rect.x + rect.w - handleWidth;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        ctx.lineWidth = 1;
        ctx.fillStyle = '#ffe9b3';
        ctx.fillRect(leftHandleX, handleY, handleWidth, handleHeight);
        ctx.fillRect(rightHandleX, handleY, handleWidth, handleHeight);
        ctx.strokeStyle = '#0b0b0b';
        ctx.strokeRect(leftHandleX, handleY, handleWidth, handleHeight);
        ctx.strokeRect(rightHandleX, handleY, handleWidth, handleHeight);
        ctx.strokeStyle = 'rgba(11, 11, 11, 0.65)';
        const ridgeCount = 3;
        const ridgeGap = handleWidth / (ridgeCount + 1);
        for (let ridge = 1; ridge <= ridgeCount; ridge += 1) {
          const ridgeXLeft = leftHandleX + ridge * ridgeGap;
          const ridgeXRight = rightHandleX + ridge * ridgeGap;
          ctx.beginPath();
          ctx.moveTo(ridgeXLeft, handleY + 3);
          ctx.lineTo(ridgeXLeft, handleY + handleHeight - 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ridgeXRight, handleY + 3);
          ctx.lineTo(ridgeXRight, handleY + handleHeight - 3);
          ctx.stroke();
        }
      }
      this.noteBounds.push({ ...rect, noteId: note.id });
    });

    if (this.pastePreview) {
      this.drawPastePreview(ctx, track);
    }

    if (!simplified) {
      this.bounds.loopShiftStartHandle = null;
      this.bounds.loopShiftEndHandle = null;

      if (this.dragState?.mode === 'select') {
        const { startX, startY, currentX, currentY } = this.dragState;
        const rectX = Math.min(startX, currentX);
        const rectY = Math.min(startY, currentY);
        const rectW = Math.abs(currentX - startX);
        const rectH = Math.abs(currentY - startY);
        ctx.strokeStyle = '#ffe16a';
        ctx.strokeRect(rectX, rectY, rectW, rectH);
      }
    } else {
      this.bounds.loopShiftStartHandle = null;
      this.bounds.loopShiftEndHandle = null;
    }
  }

  drawPastePreview(ctx, track) {
    if (!this.pastePreview || !this.gridBounds) return;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const drumTrack = this.pastePreview.isDrum || isDrumTrack(track);
    const baseTick = this.pastePreview.tick;
    const basePitch = this.pastePreview.pitch;
    ctx.save();
    ctx.globalAlpha = 0.5;
    this.pastePreview.notes.forEach((note) => {
      const startTick = baseTick + note.startTick;
      const pitchValue = drumTrack
        ? this.coercePitchForTrack(note.pitchAbsolute ?? note.pitch, track, GM_DRUM_ROWS)
        : basePitch + note.pitch;
      const durationTicks = Math.max(1, note.durationTicks);
      const row = this.getRowFromPitch(pitchValue);
      if (row < 0) return;
      const noteX = originX + startTick * cellWidth;
      const noteY = originY + row * cellHeight + 1;
      const noteW = Math.max(cellWidth * durationTicks, cellWidth);
      const noteH = cellHeight - 2;
      ctx.fillStyle = track.color || '#4fb7ff';
      ctx.fillRect(noteX, noteY, noteW, noteH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(noteX, noteY, noteW, noteH);
    });
    ctx.restore();

    const anchorPitch = drumTrack ? this.coercePitchForTrack(basePitch, track, GM_DRUM_ROWS) : basePitch;
    const baseRow = this.getRowFromPitch(anchorPitch);
    if (baseRow >= 0) {
      const buttonW = 110;
      const buttonH = 26;
      const minX = this.gridBounds.x;
      const maxX = this.gridBounds.x + this.gridBounds.w - buttonW;
      const minY = this.gridBounds.y;
      const maxY = this.gridBounds.y + this.gridBounds.h - buttonH;
      const anchorX = originX + baseTick * cellWidth;
      const anchorY = originY + baseRow * cellHeight;
      const buttonX = clamp(anchorX, minX, maxX);
      const buttonY = clamp(anchorY - buttonH - 8, minY, maxY);
      this.bounds.pasteAction = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
      this.drawSmallButton(ctx, this.bounds.pasteAction, 'Paste Here', false);
    }
  }

  drawLabelColumn(ctx, track) {
    if (!this.gridBounds || !track) return;
    const { labelX, labelW, originY, cellHeight, rows } = this.gridBounds;
    const drumGrid = isDrumTrack(track);
    const drumRows = this.getDrumRows();
    this.noteLabelBounds = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(labelX, originY, labelW, rows * cellHeight);
    ctx.clip();
    ctx.font = '12px Courier New';
    for (let row = 0; row < rows; row += 1) {
      const pitch = this.getPitchFromRow(row);
      let label = drumGrid
        ? drumRows[row]?.label || 'Drum'
        : KEY_LABELS[((pitch % 12) + 12) % 12];
      if (!drumGrid && pitch % 12 === 0) {
        label = `${label}${this.getOctaveLabel(pitch)}`;
      }
      const bounds = {
        x: labelX,
        y: originY + row * cellHeight,
        w: labelW,
        h: cellHeight,
        pitch
      };
      this.noteLabelBounds.push(bounds);
      if (drumGrid) {
        const inset = Math.max(4, Math.round(cellHeight * 0.12));
        const padX = bounds.x + inset;
        const padY = bounds.y + inset / 2;
        const padW = Math.max(12, bounds.w - inset * 2);
        const padH = Math.max(12, bounds.h - inset);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(padX, padY, padW, padH);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(padX, padY, padW, padH);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(label, padX + padW / 2, padY + padH * 0.65);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(label, labelX + 8, originY + row * cellHeight + cellHeight * 0.75);
      }
    }
    ctx.restore();
  }

  drawPlayhead(ctx) {
    if (!this.gridBounds) return;
    const { originX, originY, cellWidth, rows, cellHeight } = this.gridBounds;
    const xPos = originX + this.playheadTick * cellWidth;
    ctx.strokeStyle = '#ffe16a';
    ctx.beginPath();
    ctx.moveTo(xPos, originY);
    ctx.lineTo(xPos, originY + rows * cellHeight);
    ctx.stroke();
  }

  drawCursor(ctx) {
    if (!this.gridBounds) return;
    const gamepadConnected = this.game?.input?.isGamepadConnected?.();
    if (!this.gamepadCursorActive && !gamepadConnected) return;
    const { originX, originY, cellWidth, cellHeight } = this.gridBounds;
    const row = this.getRowFromPitch(this.cursor.pitch);
    if (row < 0) return;
    const x = originX + this.cursor.tick * cellWidth;
    const y = originY + row * cellHeight;
    ctx.strokeStyle = '#55d68a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
    ctx.lineWidth = 1;
  }

  drawSelectionMenu(ctx) {
    if (!this.selectionMenu.open || this.selection.size === 0 || !this.gridBounds) {
      this.bounds.selectionMenu = [];
      return;
    }
    const actions = [
      { action: 'selection-copy', label: 'Copy' },
      { action: 'selection-cut', label: 'Cut' },
      { action: 'selection-delete', label: 'Delete' },
      { action: 'selection-paste', label: 'Paste' },
      { action: 'selection-cancel', label: 'Cancel' }
    ];
    const menuScale = 1.25;
    const menuW = 140 * menuScale;
    const rowH = 32 * menuScale;
    const gap = 6 * menuScale;
    const menuH = actions.length * rowH + gap * 2;
    const viewportW = this.viewportWidth ?? this.gridBounds.x + this.gridBounds.w;
    const viewportH = this.viewportHeight ?? this.gridBounds.y + this.gridBounds.h;
    const minX = Math.max(8, this.gridBounds.x);
    const maxX = Math.min(viewportW - menuW - 8, this.gridBounds.x + this.gridBounds.w - menuW);
    const minY = Math.max(8, this.gridBounds.y);
    const maxY = Math.min(viewportH - menuH - 8, this.gridBounds.y + this.gridBounds.h - menuH);
    const menuX = clamp(this.selectionMenu.x, minX, Math.max(minX, maxX));
    const menuY = clamp(this.selectionMenu.y, minY, Math.max(minY, maxY));
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(menuX, menuY, menuW, menuH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(menuX, menuY, menuW, menuH);
    this.bounds.selectionMenu = [];
    actions.forEach((entry, index) => {
      const bounds = {
        x: menuX + gap,
        y: menuY + gap + index * rowH,
        w: menuW - gap * 2,
        h: rowH - 4,
        action: entry.action
      };
      this.drawSmallButton(ctx, bounds, entry.label, false);
      this.bounds.selectionMenu.push(bounds);
    });
  }

  drawNoteLengthMenu(ctx, width, height) {
    if (!this.noteLengthMenu.open) {
      this.noteLengthMenu.open = false;
      this.bounds.noteLengthMenu = [];
      return;
    }
    const options = NOTE_LENGTH_OPTIONS;
    const columns = 4;
    const rows = Math.ceil(options.length / columns);
    const gap = 6;
    const padding = 8;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    const maxLabelW = Math.max(...options.map((option) => ctx.measureText(this.getCompactNoteLengthDisplay(option)).width));
    const cellW = Math.max(60, Math.round(maxLabelW + 28));
    const cellH = 30;
    const menuW = columns * cellW + gap * (columns - 1) + padding * 2;
    const menuH = rows * cellH + gap * (rows - 1) + padding * 2;
    const menuX = Math.max(8, (width - menuW) / 2);
    const menuY = Math.max(8, (height - menuH) / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    drawSharedPanel(ctx, { x: menuX, y: menuY, w: menuW, h: menuH }, {
      fill: UI_SUITE.colors.panelAlt,
      border: UI_SUITE.colors.border
    });

    this.bounds.noteLengthMenu = [];
    options.forEach((option, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cellX = menuX + padding + col * (cellW + gap);
      const cellY = menuY + padding + row * (cellH + gap);
      const bounds = { x: cellX, y: cellY, w: cellW, h: cellH, index };
      const isActive = index === this.noteLengthIndex;
      this.drawSmallButton(ctx, bounds, this.getCompactNoteLengthDisplay(option), isActive);
      this.bounds.noteLengthMenu.push(bounds);
    });
  }

  drawTempoSlider(ctx, width, height) {
    if (!this.tempoSliderOpen) {
      this.bounds.tempoSlider = null;
      return;
    }
    const padding = 10;
    const sliderW = Math.min(320, width - 40);
    const sliderH = 72;
    const sliderX = Math.max(8, (width - sliderW) / 2);
    const sliderY = Math.max(8, (height - sliderH) / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    drawSharedPanel(ctx, { x: sliderX, y: sliderY, w: sliderW, h: sliderH }, {
      fill: UI_SUITE.colors.panelAlt,
      border: UI_SUITE.colors.border
    });
    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `12px ${UI_SUITE.font.family}`;
    ctx.fillText(`Tempo ${this.song.tempo}BPM`, sliderX + padding, sliderY + 16);

    const barBounds = {
      x: sliderX + padding,
      y: sliderY + 30,
      w: sliderW - padding * 2,
      h: 14
    };
    const ratio = clamp((this.song.tempo - 40) / 200, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(barBounds.x, barBounds.y, barBounds.w * ratio, barBounds.h);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(barBounds.x, barBounds.y, barBounds.w, barBounds.h);
    this.bounds.tempoSlider = barBounds;
  }

  drawSettingsDialog(ctx, width, height) {
    const dialogW = Math.min(1020, width - 40);
    const dialogH = Math.min(680, height - 40);
    const dialogX = (width - dialogW) / 2;
    const dialogY = (height - dialogH) / 2;
    const padding = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    drawSharedPanel(ctx, { x: dialogX, y: dialogY, w: dialogW, h: dialogH }, {
      fill: UI_SUITE.colors.panelAlt,
      border: UI_SUITE.colors.border
    });

    ctx.fillStyle = UI_SUITE.colors.text;
    ctx.font = `18px ${UI_SUITE.font.family}`;
    ctx.fillText('Settings', dialogX + padding, dialogY + 28);
    this.bounds.settingsDialog = { x: dialogX, y: dialogY, w: dialogW, h: dialogH };
    this.bounds.settingsClose = { x: dialogX + dialogW - 72, y: dialogY + 14, w: 56, h: 24 };
    this.drawSmallButton(ctx, this.bounds.settingsClose, 'Close', false);

    const contentY = dialogY + 48;
    const stacked = dialogW < 820;
    if (stacked) {
      const transportX = dialogX + padding;
      const transportY = contentY;
      const transportW = dialogW - padding * 2;
      const transportH = Math.min(340, dialogH * 0.55);
      this.drawTransportCompact(ctx, transportX, transportY, transportW, transportH);

      const trackX = transportX;
      const trackY = transportY + transportH + 20;
      const trackH = dialogH - (trackY - dialogY) - padding;
      this.drawTrackList(ctx, trackX, trackY, transportW, trackH);

      if (this.toolsMenuOpen) {
        this.drawToolsMenu(ctx, transportX + transportW - 180, transportY + 12);
      }
    } else {
      const trackW = 320;
      const trackX = dialogX + padding;
      const trackY = contentY;
      const trackH = dialogH - (trackY - dialogY) - padding;
      this.drawTrackList(ctx, trackX, trackY, trackW, trackH);

      const transportX = trackX + trackW + 20;
      const transportY = contentY;
      const transportW = dialogX + dialogW - transportX - padding;
      const transportH = 90;
      this.drawTransport(ctx, transportX, transportY, transportW, transportH);

      if (this.toolsMenuOpen) {
        this.drawToolsMenu(ctx, transportX + transportW - 180, transportY + 12);
      }
    }
  }

  drawInstrumentPickerModal(ctx, width, height, track) {
    const isPortrait = isMobilePortraitLayout({
      isMobile: this.isMobileLayout(),
      viewportWidth: width,
      viewportHeight: height
    });
    const modalW = isPortrait
      ? clamp(Math.round(width * 0.82), 280, width - 48)
      : clamp(Math.round(width * 0.625), 420, width - 32);
    const modalH = Math.min(height - 32, Math.max(500, Math.round(height * 0.84)));
    const modalX = Math.round((width - modalW) / 2);
    const modalY = Math.round((height - modalH) / 2);
    this.instrumentPicker.modalBounds = { x: modalX, y: modalY, w: modalW, h: modalH };
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, width, height);
    this.drawInstrumentPanel(ctx, modalX, modalY, modalW, modalH, track, { modalOnly: true });
  }

  drawInstrumentPicker(ctx, width, height) {
    const dialogW = Math.min(520, width - 24);
    const dialogH = Math.min(600, height - 24);
    const dialogX = (width - dialogW) / 2;
    const dialogY = (height - dialogH) / 2;
    const padding = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);

    ctx.fillStyle = '#fff';
    ctx.font = '18px Courier New';
    ctx.fillText('Select Instrument', dialogX + padding, dialogY + 28);

    this.instrumentPicker.closeBounds = { x: dialogX + dialogW - 72, y: dialogY + 14, w: 56, h: 24 };
    this.drawSmallButton(ctx, this.instrumentPicker.closeBounds, 'Close', false);

    const inputY = dialogY + 42;
    const items = this.getInstrumentPickerItems();
    const rowH = clamp(Math.round(dialogH * 0.05), 24, 30);
    const listStartY = inputY + 36;
    const listHeight = dialogY + dialogH - listStartY - 40;
    const visibleRows = Math.max(1, Math.floor(listHeight / rowH));
    this.instrumentPicker.scrollMax = Math.max(0, items.length - visibleRows);
    this.instrumentPicker.scroll = clamp(this.instrumentPicker.scroll, 0, this.instrumentPicker.scrollMax);
    this.instrumentPicker.bounds = [];
    let rowY = listStartY;
    const visibleItems = items.slice(this.instrumentPicker.scroll, this.instrumentPicker.scroll + visibleRows);
    visibleItems.forEach((item) => {
      if (item.type === 'family') {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px Courier New';
        ctx.fillText(item.label, dialogX + padding, rowY + 16);
      } else {
        const bounds = {
          x: dialogX + padding,
          y: rowY - 2,
          w: dialogW - padding * 2,
          h: rowH,
          program: item.program
        };
        this.drawSmallButton(ctx, bounds, item.label, false);
        this.instrumentPicker.bounds.push(bounds);
      }
      rowY += rowH;
    });

    if (items.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px Courier New';
      ctx.fillText('No matching programs.', dialogX + padding, listStartY + 20);
    }

    if (this.instrumentPicker.scrollMax > 0) {
      const buttonW = 26;
      const buttonH = 22;
      const buttonsY = dialogY + dialogH - buttonH - 12;
      this.instrumentPicker.scrollUp = {
        x: dialogX + padding,
        y: buttonsY,
        w: buttonW,
        h: buttonH
      };
      this.instrumentPicker.scrollDown = {
        x: dialogX + padding + buttonW + 8,
        y: buttonsY,
        w: buttonW,
        h: buttonH
      };
      this.drawSmallButton(ctx, this.instrumentPicker.scrollUp, '▲', false);
      this.drawSmallButton(ctx, this.instrumentPicker.scrollDown, '▼', false);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px Courier New';
      ctx.fillText(
        `Showing ${this.instrumentPicker.scroll + 1}-${Math.min(this.instrumentPicker.scroll + visibleItems.length, items.length)} of ${items.length}`,
        this.instrumentPicker.scrollDown.x + buttonW + 10,
        buttonsY + 16
      );
    }
  }

  drawToolsMenu(ctx, x, y) {
    const items = [
      { id: 'generate', label: 'Generate Pattern' },
      { id: 'export-json', label: 'Export JSON' },
      { id: 'export-midi', label: 'Export MIDI' },
      { id: 'export-midi-zip', label: 'Export MIDI ZIP' },
      { id: 'export-wav', label: 'Export WAV' },
      { id: 'import', label: 'Import MIDI/ZIP/JSON' },
      { id: 'demo', label: 'Play Demo' },
      { id: 'soundfont', label: 'SoundFont CDN' },
      { id: 'soundfont-reset', label: 'SoundFont Default' },
      { id: 'qa', label: 'QA Overlay' }
    ];
    const width = 180;
    const height = items.length * 22 + 16;
    const viewportW = this.viewportWidth ?? x + width;
    const viewportH = this.viewportHeight ?? y + height;
    const menuX = clamp(x, 8, Math.max(8, viewportW - width - 8));
    const menuY = clamp(y, 8, Math.max(8, viewportH - height - 8));
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(menuX, menuY, width, height);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(menuX, menuY, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    this.toolsMenuBounds = [];
    items.forEach((item, index) => {
      const itemY = menuY + 18 + index * 22;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(item.label, menuX + 12, itemY);
      this.toolsMenuBounds.push({
        x: menuX + 8,
        y: itemY - 12,
        w: width - 16,
        h: 18,
        id: item.id
      });
    });
  }

  getFileMenuItems() {
    return buildSharedEditorFileMenu({
      supported: {
        undo: false,
        redo: false
      },
      labels: {
        export: 'Export JSON',
        import: 'Import MIDI/ZIP/JSON'
      },
      actions: {
        new: () => this.handleFileMenu('new'),
        save: () => this.handleFileMenu('save'),
        'save-as': () => this.handleFileMenu('save-as'),
        open: () => this.handleFileMenu('load'),
        export: () => this.handleFileMenu('export-json'),
        import: () => this.handleFileMenu('import')
      },
      includeFooter: false,
      extras: [
        { divider: true },
        { id: 'rescue-save', label: 'Rescue Save' },
        { id: 'export-midi', label: 'Export MIDI' },
        { id: 'export-midi-zip', label: 'Export MIDI ZIP' },
        { id: 'export-wav', label: 'Export WAV' },
        { id: 'save-paint', label: 'Save and Paint' },
        { id: 'play-robtersession', label: 'Play in RobterSession' },
        { id: 'theme', label: 'Generate Theme' },
        { id: 'sample', label: 'Load Sample Song' },
        { id: 'exit-main', label: 'Exit to Main Menu' }
      ]
    }).filter((item) => !item.disabled);
  }

  drawFilePanel(ctx, x, y, w, h) {
    const isMobile = this.isMobileLayout();
    let panelX = x;
    let panelY = y;
    let panelW = w;
    let panelH = h;

    if (isMobile) {
      const viewportW = this.viewportWidth ?? x + w;
      const viewportH = this.viewportHeight ?? y + h;
      const railW = getSharedMobileRailWidth(viewportW, viewportH);
      panelW = getSharedMobileDrawerWidth(viewportW, viewportH, railW, { edgePadding: 0 });
      panelX = viewportW - panelW;
      panelY = 0;
      panelH = viewportH;
      if (this.mobilePortraitFilePanelBounds) {
        panelX = this.mobilePortraitFilePanelBounds.x;
        panelY = this.mobilePortraitFilePanelBounds.y;
        panelW = this.mobilePortraitFilePanelBounds.w;
        panelH = this.mobilePortraitFilePanelBounds.h;
      }
    }

    this.fileMenuBounds = [];
    const allFileItems = this.getFileMenuItems();
    const stickyExit = isMobile || isMobileLandscapeLayout({
      isMobile,
      viewportWidth: this.viewportWidth ?? panelX + panelW,
      viewportHeight: this.viewportHeight ?? panelY + panelH
    });
    const { listItems: fileItems, exitItem } = stickyExit
      ? splitFileDrawerStickyExitItems(allFileItems)
      : { listItems: allFileItems, exitItem: null };
    const rowHeight = this.sharedMenu.getButtonHeight(isMobile);
    const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
    const visibleRows = Math.max(1, Math.floor(Math.max(0, panelH - 24) / Math.max(1, rowHeight + rowGap)));
    this.fileMenuScroll = this.controllerMenu.syncScrollToItem(
      'file',
      this.controllerMenu.getFocusedItem('file')?.id,
      fileItems,
      visibleRows,
      this.fileMenuScroll || 0
    );
    const result = this.sharedMenu.drawDrawer(ctx, {
      panel: { x: panelX, y: panelY, w: panelW, h: panelH },
      title: '',
      items: fileItems,
      scroll: this.fileMenuScroll,
      isMobile,
      showTitle: false,
      footerMode: stickyExit && exitItem ? 'exit-only' : 'none',
      footerItem: exitItem,
      drawButton: (bounds, item) => {
        this.drawButton(ctx, bounds, item.label, false, false, this.controllerMenu.isFocusedItem('file', item.id));
        this.fileMenuBounds.push({ ...bounds, id: item.id });
      }
    });

    this.fileMenuScroll = result.scroll;
    this.fileMenuScrollMax = result.scrollMax;
    this.fileMenuListBounds = result.listBounds;
  }



  drawGenreMenu(ctx, width, height) {
    const panelW = 260;
    const rowH = 46;
    const gap = 10;
    const items = [...GENRE_OPTIONS, { id: 'cancel', label: 'Cancel' }];
    const panelH = items.length * rowH + gap * 2;
    const panelX = width - panelW - gap;
    const panelY = Math.min(height - panelH - gap, gap + 40);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = '#fff';
    ctx.font = '13px Courier New';
    this.genreMenuBounds = [];
    items.forEach((item, index) => {
      const itemY = panelY + gap + index * rowH;
      const bounds = {
        x: panelX + gap,
        y: itemY,
        w: panelW - gap * 2,
        h: rowH - 8,
        id: item.id
      };
      const active = item.id === this.selectedGenre;
      this.drawButton(ctx, bounds, item.label, active, true);
      this.genreMenuBounds.push(bounds);
    });
  }

  drawQaOverlay(ctx, width, height) {
    const overlayW = Math.min(520, width - 80);
    const overlayH = Math.min(320, height - 120);
    const overlayX = (width - overlayW) / 2;
    const overlayY = (height - overlayH) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(12,14,18,0.95)';
    ctx.fillRect(overlayX, overlayY, overlayW, overlayH);
    ctx.strokeStyle = UI_SUITE.colors.border;
    ctx.strokeRect(overlayX, overlayY, overlayW, overlayH);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.fillText('QA Overlay', overlayX + 16, overlayY + 28);

    const buttons = [
      { id: 'qa-load', label: 'Play Demo', x: overlayX + 16, y: overlayY + 50, w: 120, h: 24 },
      { id: 'qa-run', label: 'Run Checks', x: overlayX + 150, y: overlayY + 50, w: 120, h: 24 },
      { id: 'qa-close', label: 'Close', x: overlayX + overlayW - 86, y: overlayY + 50, w: 70, h: 24 }
    ];
    this.qaBounds = [];
    buttons.forEach((button) => {
      this.drawSmallButton(ctx, button, button.label, false);
      this.qaBounds.push(button);
    });

    ctx.font = '12px Courier New';
    let listY = overlayY + 92;
    if (this.qaResults.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('Run checks to verify playhead, loop, edits, and import/export.', overlayX + 16, listY);
    } else {
      this.qaResults.forEach((result) => {
        const color = result.status === 'pass' ? '#55d68a' : result.status === 'warn' ? '#ffd24a' : '#ff6a6a';
        ctx.fillStyle = color;
        ctx.fillText(`${result.label}: ${result.status.toUpperCase()}`, overlayX + 16, listY);
        listY += 20;
      });
    }
  }

  drawButton(ctx, bounds, label, active, subtle, focused = false) {
    const controlBounds = normalizeSharedControlBounds(bounds);
    Object.assign(bounds, controlBounds);
    const color = drawSharedMenuButtonChrome(ctx, controlBounds, { active, subtle });
    const isMobile = this.isMobileLayout();
    const fontSize = this.getButtonFontSize(controlBounds, isMobile);
    drawSharedMenuButtonLabel(ctx, controlBounds, label, {
      fontSize,
      color,
      maxWidth: Math.max(0, controlBounds.w - Math.max(6, Math.round(controlBounds.h * 0.2)) * 2)
    });
    if (focused) {
      drawSharedFocusRing(ctx, controlBounds);
    }
  }

  drawSmallButton(ctx, bounds, label, active) {
    this.drawButton(ctx, bounds, label, active, false);
  }

  drawToggle(ctx, bounds, label, active) {
    const controlBounds = normalizeSharedControlBounds(bounds);
    Object.assign(bounds, controlBounds);
    const color = drawSharedMenuButtonChrome(ctx, controlBounds, { active, subtle: true });
    drawSharedMenuButtonLabel(ctx, controlBounds, label, {
      fontSize: this.isMobileLayout() ? 14 : 12,
      color,
      align: 'left',
      x: controlBounds.x + 10,
      maxWidth: Math.max(0, controlBounds.w - 20)
    });
  }
}
