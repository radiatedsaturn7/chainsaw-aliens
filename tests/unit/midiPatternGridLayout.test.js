import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import MidiComposer, {
  MIDI_MAX_ZOOM_OUT_BARS,
  MIDI_PLAYBACK_MAX_CATCHUP_SECONDS,
  buildMidiPortraitGridQuickStripItems,
  buildMidiPortraitRootTabs,
  buildMidiGridZoomButtonModel,
  getMidiGridZoomLimitsXForBars,
  getMidiPlacementSnapTicks,
  getMidiZoomFromSliderRatio,
  getMidiPortraitControlLayout,
  getMidiPortraitFullScreenSheetLayout,
  getMidiPatternGridLayoutMetrics,
  getMidiPortraitMasterVolumeLayout,
  getMidiPortraitPedalGridLayout,
  getMidiPortraitRecordLayout,
  getMidiPortraitSongRailLayout,
  getMidiPortraitTrackPickerLayout,
  getMidiNoteEdgeHit,
  getMidiNoteHandleWidth,
  getMidiResizeMinimumTicks,
  getMidiSongMixSliderYOffset,
  getMidiSongMusicControlSpecs,
  getMidiSongActionSpecs,
  resizeMidiNoteByEdge,
  isMidiPortraitMainWorkspaceTab,
  shouldMidiDeleteSelectedNoteOnTap,
  shouldMidiPortraitSheetOpen
} from '../../src/ui/MidiComposerCore.js';
import { getSharedPortraitMultiRowTabLayout } from '../../src/ui/uiSuite.js';
import TouchInput from '../../src/input/touch.js';
import MidiSongPlayer from '../../src/game/MidiSongPlayer.js';

const midiComposerSource = readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const textInputOverlaySource = readFileSync(new URL('../../src/ui/shared/textInputOverlay.js', import.meta.url), 'utf8');
const audioSource = readFileSync(new URL('../../src/game/Audio.js', import.meta.url), 'utf8');

function midiMethodBody(name, nextName) {
  const start = midiComposerSource.indexOf(`  ${name}(`);
  const end = midiComposerSource.indexOf(`  ${nextName}(`, start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return midiComposerSource.slice(start, end);
}

function createMidiComposerRangeHarness() {
  const composer = Object.create(MidiComposer.prototype);
  composer.ticksPerBeat = 4;
  composer.getSongTimelineTicks = () => 512;
  return composer;
}

test('MIDI song player can play cutscene tracks once without looping', () => {
  const played = [];
  const player = new MidiSongPlayer({
    playGmNote(note) { played.push(note); }
  });
  player.setSong({
    tempo: 60,
    loopStartTick: 0,
    loopEndTick: 8,
    tracks: [{
      id: 'track-1',
      volume: 1,
      pan: 0,
      channel: 0,
      program: 0,
      patterns: [{ notes: [{ pitch: 60, startTick: 0, durationTicks: 4, velocity: 1 }] }]
    }]
  }, 'cutscene-song', { loop: false });
  player.setFade(1, 0);

  player.update(0.1);
  player.update(2.9);

  assert.equal(played.length, 1);
  assert.equal(player.finished, true);
  assert.equal(player.playheadTick, 8);
});

test('MIDI song player schedules notes ahead of the visual playhead', () => {
  const played = [];
  const player = new MidiSongPlayer({
    ctx: { currentTime: 10 },
    midiLatency: 0.08,
    playGmNote(note) { played.push(note); }
  });
  player.setSong({
    tempo: 60,
    loopStartTick: 0,
    loopEndTick: 16,
    tracks: [{
      id: 'track-1',
      volume: 1,
      pan: 0,
      channel: 0,
      program: 0,
      patterns: [{ notes: [{ pitch: 60, startTick: 1, durationTicks: 4, velocity: 1 }] }]
    }]
  }, 'lookahead-song', { loop: false });
  player.setFade(1, 0);

  player.update(0.01);

  assert.equal(played.length, 1);
  assert.equal(played[0].pitch, 60);
  assert.ok(played[0].when > 10.08);
  assert.ok(played[0].when < 10.25);
});

test('MIDI song player lookahead does not drift ahead over many frames', () => {
  const played = [];
  const audio = {
    ctx: { currentTime: 0 },
    midiLatency: 0.04,
    playGmNote(note) { played.push(note); }
  };
  const player = new MidiSongPlayer(audio);
  player.setSong({
    tempo: 120,
    loopStartTick: 0,
    loopEndTick: 128,
    tracks: [{
      id: 'track-1',
      volume: 1,
      pan: 0,
      channel: 0,
      program: 0,
      patterns: [{
        notes: Array.from({ length: 16 }, (_, index) => ({
          pitch: 60 + (index % 4),
          startTick: index * 2,
          durationTicks: 1,
          velocity: 1
        }))
      }]
    }]
  }, 'drift-song', { loop: false });
  player.setFade(1, 0);

  for (let frame = 0; frame < 60; frame += 1) {
    audio.ctx.currentTime = frame / 60;
    player.update(1 / 60);
    const maxAheadTicks = 0.17 * player.getTicksPerSecond();
    assert.ok(
      player.scheduledUntilTick - player.playheadTick <= maxAheadTicks,
      `scheduled cursor drifted too far ahead on frame ${frame}`
    );
  }

  assert.ok(played.length > 4);
  assert.ok(played.every((note) => note.when < 1.25));
});

test('MIDI song player starts at cutscene offset and uses tempo-based durations', () => {
  const played = [];
  const player = new MidiSongPlayer({
    playGmNote(note) { played.push(note); }
  });
  player.setSong({
    tempo: 120,
    loopStartTick: 0,
    loopEndTick: 64,
    tracks: [{
      id: 'track-1',
      volume: 1,
      pan: 0,
      channel: 0,
      program: 0,
      patterns: [{
        notes: [
          { pitch: 60, startTick: 0, durationTicks: 8, velocity: 1 },
          { pitch: 64, startTick: 16, durationTicks: 8, velocity: 1 }
        ]
      }]
    }]
  }, 'cutscene-song', { loop: false, offsetMs: 1000 });
  player.setFade(1, 0);

  player.update(0.05);

  assert.equal(played.length, 1);
  assert.equal(played[0].pitch, 64);
  assert.equal(played[0].duration, 0.5);
});

test('MIDI song player drops stale backlog notes after a long frame', () => {
  const played = [];
  const player = new MidiSongPlayer({
    playGmNote(note) { played.push(note); }
  });
  player.setSong({
    tempo: 60,
    loopStartTick: 0,
    loopEndTick: 200,
    tracks: [{
      id: 'track-1',
      volume: 1,
      pan: 0,
      channel: 0,
      program: 0,
      patterns: [{
        notes: Array.from({ length: 20 }, (_, tick) => ({
          pitch: 60 + (tick % 4),
          startTick: tick,
          durationTicks: 1,
          velocity: 1
        }))
      }]
    }]
  }, 'dense-song', { loop: false });
  player.setFade(1, 0);

  player.update(1.2);

  assert.ok(played.length < 4);
  assert.ok(player.droppedEvents > 0);
  assert.ok(played.every((note) => note.pitch >= 60));
});

test('MIDI portrait file and settings sheet uses full-height panel above root tabs', () => {
  const layout = getMidiPortraitFullScreenSheetLayout(390, 844);

  assert.deepEqual(layout.sheet, { x: 8, y: 8, w: 374, h: 730 });
  assert.equal(layout.rootRail.h, 144);
  assert.equal(layout.rootRail.y, 594);
  assert.equal(layout.content.x, 10);
  assert.equal(layout.content.y, 10);
  assert.equal(layout.content.w, 370);
  assert.equal(layout.content.h, 534);
  assert.ok(layout.content.h > 500);
  assert.ok(layout.content.y + layout.content.h <= layout.zoomStrip.y);
});

test('MIDI portrait control layout keeps bottom rail, root menu, and zoom in a fixed stack', () => {
  const layout = getMidiPortraitControlLayout(390, 844);

  assert.equal(layout.bottomRail.h, 88);
  assert.equal(layout.bottomRail.y, 746);
  assert.equal(layout.bottomRail.y + layout.bottomRail.h, 834);
  assert.equal(layout.rootRail.h, 144);
  assert.equal(layout.rootRail.y + layout.rootRail.h + layout.gap, layout.bottomRail.y);
  assert.equal(layout.zoomStrip.h, 34);
  assert.equal(layout.zoomStrip.y + layout.zoomStrip.h + layout.gap, layout.rootRail.y);
  assert.ok(layout.workSurface.y + layout.workSurface.h + layout.gap <= layout.zoomStrip.y);
});

test('MIDI portrait control stack stays flush and non-overlapping on phone sizes', () => {
  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const layout = getMidiPortraitControlLayout(width, height);

    assert.equal(layout.workSurface.y, 10);
    assert.equal(layout.workSurface.y + layout.workSurface.h + layout.gap, layout.zoomStrip.y);
    assert.equal(layout.zoomStrip.y + layout.zoomStrip.h + layout.gap, layout.rootRail.y);
    assert.equal(layout.rootRail.y + layout.rootRail.h + layout.gap, layout.bottomRail.y);
    assert.equal(layout.bottomRail.y + layout.bottomRail.h, height - 10);
    assert.ok(layout.workSurface.h >= Math.floor(height * 0.58));
  }
});

test('MIDI portrait grid can use a compact rail to avoid quick-strip dead space', () => {
  const layout = getMidiPortraitControlLayout(390, 844, { rootRailHeight: 56 });

  assert.equal(layout.rootRail.h, 56);
  assert.equal(layout.rootRail.y + layout.rootRail.h + layout.gap, layout.bottomRail.y);
  assert.equal(layout.zoomStrip.y + layout.zoomStrip.h + layout.gap, layout.rootRail.y);
  assert.ok(layout.workSurface.h > getMidiPortraitControlLayout(390, 844).workSurface.h);
});

test('MIDI portrait song can use taller rail for transport buttons', () => {
  const layout = getMidiPortraitControlLayout(390, 844, { rootRailHeight: 184 });

  assert.equal(layout.rootRail.h, 184);
  assert.equal(layout.rootRail.y + layout.rootRail.h + layout.gap, layout.bottomRail.y);
  assert.ok(layout.workSurface.h < getMidiPortraitControlLayout(390, 844).workSurface.h);
});

test('MIDI portrait menu root rail is stable and separate from lifted action rail', () => {
  const menu = getMidiPortraitFullScreenSheetLayout(390, 844);
  const controls = getMidiPortraitControlLayout(390, 844);

  assert.equal(menu.rootRail.y, controls.rootRail.y);
  assert.equal(menu.zoomStrip.y, controls.zoomStrip.y);
  assert.equal(menu.bottomRail.y, controls.bottomRail.y);
  assert.equal(menu.rootRail.y + menu.rootRail.h + menu.gap, menu.bottomRail.y);
  assert.ok(menu.content.y + menu.content.h <= menu.rootRail.y);
});

test('MIDI portrait grid uses compact labels and touch-sized melodic cells', () => {
  const layout = getMidiPatternGridLayoutMetrics({
    x: 10,
    y: 10,
    w: 370,
    h: 728,
    gridTicks: 64,
    rows: 60,
    isMobile: true,
    isPortrait: true,
    drumGrid: false,
    gridZoomX: 1,
    gridZoomY: 0.2,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: { minZoom: 1, maxZoom: 4 },
    initialized: true
  });

  assert.equal(layout.portrait, true);
  assert.ok(layout.labelW <= 88);
  assert.ok(layout.rulerH < 80);
  assert.ok(layout.cellWidth >= 4);
  assert.ok(layout.cellWidth < 8);
  assert.ok(layout.cellHeight >= 36);
  assert.ok(layout.viewW > 0);
  assert.ok(layout.viewH > 0);
  assert.ok(layout.totalGridW >= layout.viewW);
  assert.ok(layout.gridH > layout.viewH);
});

test('MIDI portrait grid initializes to about twelve visible melodic rows', () => {
  const layout = getMidiPatternGridLayoutMetrics({
    x: 10,
    y: 10,
    w: 370,
    h: 728,
    gridTicks: 64,
    rows: 60,
    isMobile: true,
    isPortrait: true,
    drumGrid: false,
    gridZoomX: 1,
    gridZoomY: 1,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: { minZoom: 1, maxZoom: 4 },
    portraitVisibleTicks: 32,
    initialized: false
  });

  const visibleRows = layout.viewH / layout.cellHeight;
  assert.ok(visibleRows >= 11.75);
  assert.ok(visibleRows <= 12.25);
  assert.ok(layout.viewW / layout.cellWidth >= 32);
});

test('MIDI portrait drum grid keeps rows touch-usable with vertical panning', () => {
  const layout = getMidiPatternGridLayoutMetrics({
    w: 370,
    h: 728,
    gridTicks: 64,
    rows: 47,
    isMobile: true,
    isPortrait: true,
    drumGrid: true,
    gridZoomX: 1,
    gridZoomY: 0.2,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: { minZoom: 1, maxZoom: 4 },
    initialized: true
  });

  assert.ok(layout.labelW <= 88);
  assert.ok(layout.cellHeight >= 32);
  assert.ok(layout.gridH > layout.viewH);
});

test('MIDI mobile landscape uses compact labels and usable rows', () => {
  const layout = getMidiPatternGridLayoutMetrics({
    w: 650,
    h: 340,
    gridTicks: 64,
    rows: 60,
    isMobile: true,
    isPortrait: false,
    drumGrid: false,
    gridZoomX: 1,
    gridZoomY: 1,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: { minZoom: 1, maxZoom: 4 },
    initialized: true
  });

  assert.equal(layout.portrait, false);
  assert.equal(layout.landscape, true);
  assert.ok(layout.labelW <= 120);
  assert.equal(layout.rulerH, 44);
  assert.ok(layout.cellHeight >= 24);
  assert.ok(layout.viewH / layout.cellHeight >= 10);
  assert.ok(layout.cellWidth < 34);
});

test('MIDI mobile landscape initializes to at least four visible measures', () => {
  const layout = getMidiPatternGridLayoutMetrics({
    w: 740,
    h: 360,
    gridTicks: 128,
    rows: 60,
    isMobile: true,
    isPortrait: false,
    drumGrid: false,
    gridZoomX: 1,
    gridZoomY: 1,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: { minZoom: 0.25, maxZoom: 64 },
    landscapeVisibleTicks: 64,
    initialized: false
  });

  assert.equal(layout.landscape, true);
  assert.ok(layout.viewW / layout.cellWidth >= 64);
  assert.ok(layout.viewH / layout.cellHeight >= 10);
});

test('MIDI landscape controller mode avoids duplicate touch controls and keeps side menu scrollable', () => {
  const thumbModeBody = midiMethodBody('isMobileLandscapeThumbZoomMode', 'updatePanJoystick');
  const mobileLayoutBody = midiMethodBody('drawMobileLayout', 'drawMobileBottomRail');
  const bottomRailBody = midiMethodBody('drawMobileBottomRail', 'drawPatternEditor');
  const pointerBody = `${midiMethodBody('handlePointerDown', 'handlePointerMove')}\n${midiMethodBody('handlePointerMove', 'handlePointerUp')}\n${midiMethodBody('handlePointerUp', 'handleWheel')}`;
  const wheelBody = midiMethodBody('handleWheel', 'shouldHandleGestureStart');

  assert.equal(thumbModeBody.includes("this.activeTab === 'grid' || this.activeTab === 'song'"), true);
  assert.equal(thumbModeBody.includes('!this.isPhysicalControllerConnected()'), true);
  assert.equal(mobileLayoutBody.includes('const controllerConnected = this.isPhysicalControllerConnected();'), true);
  assert.equal(mobileLayoutBody.includes("const showsGridBottomRail = isLandscape && (this.activeTab === 'grid' || this.activeTab === 'song') && !controllerConnected;"), true);
  assert.equal(mobileLayoutBody.includes('bottomRailHeight: showsGridBottomRail ? 72 : 0'), true);
  assert.equal(bottomRailBody.includes('reserveThumbstick'), true);
  assert.equal(pointerBody.includes("mode: 'mobile-landscape-root-scroll'"), true);
  assert.equal(pointerBody.includes('pendingRootId'), true);
  assert.equal(midiComposerSource.includes('handleMobileLandscapeRootMenuTap(id)'), true);
  assert.equal(pointerBody.includes('this.mobileLandscapeRootMenuScrollMax'), true);
  assert.equal(pointerBody.includes('this.controllerMenu.scroll.root'), true);
  assert.equal(wheelBody.includes('this.mobileLandscapeRootMenuBounds'), true);
});

test('MIDI grid hit testing can derive expected portrait cells from shared metrics', () => {
  const layout = getMidiPatternGridLayoutMetrics({
    x: 10,
    y: 10,
    w: 370,
    h: 728,
    gridTicks: 64,
    rows: 60,
    isMobile: true,
    isPortrait: true,
    drumGrid: false,
    gridZoomX: 1,
    gridZoomY: 1,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: { minZoom: 1, maxZoom: 4 },
    initialized: true
  });
  const originX = layout.originBaseX - layout.cellWidth * 4;
  const originY = layout.originBaseY - layout.cellHeight * 8;
  const screenX = originX + layout.cellWidth * 6 + layout.cellWidth / 2;
  const screenY = originY + layout.cellHeight * 11 + layout.cellHeight / 2;

  assert.equal(Math.floor((screenX - originX) / layout.cellWidth), 6);
  assert.equal(Math.floor((screenY - originY) / layout.cellHeight), 11);
});

test('MIDI portrait note handles stay inside notes and selected note taps delete', () => {
  const rect = { x: 100, y: 20, w: 40, h: 36 };
  const handleWidth = getMidiNoteHandleWidth(rect, { portrait: true });

  assert.ok(handleWidth <= 18);
  assert.ok(handleWidth <= rect.w / 2);
  assert.equal(getMidiNoteEdgeHit(rect, rect.x - 1, handleWidth), null);
  assert.equal(getMidiNoteEdgeHit(rect, rect.x + rect.w + 1, handleWidth), null);
  assert.equal(getMidiNoteEdgeHit(rect, rect.x + 1, handleWidth), 'start');
  assert.equal(getMidiNoteEdgeHit(rect, rect.x + rect.w - 1, handleWidth), 'end');
  assert.equal(getMidiNoteEdgeHit(rect, rect.x + rect.w / 2, handleWidth), null);
  assert.equal(shouldMidiDeleteSelectedNoteOnTap(), true);
});

test('MIDI resize helper expands notes from either edge', () => {
  const note = { id: 'n1', startTick: 8, durationTicks: 8, pitch: 60 };
  const left = resizeMidiNoteByEdge(note, {
    edge: 'start',
    snappedTick: 4,
    targetOriginal: note,
    gridTicks: 64
  });
  const right = resizeMidiNoteByEdge(note, {
    edge: 'end',
    snappedTick: 20,
    targetOriginal: note,
    gridTicks: 64
  });

  assert.deepEqual(left, { ...note, startTick: 4, durationTicks: 12 });
  assert.deepEqual(right, { ...note, startTick: 8, durationTicks: 12 });
});

test('MIDI portrait resize minimum follows one smaller note value', () => {
  assert.equal(getMidiResizeMinimumTicks({ ticksPerBar: 16, noteLengthIndex: 3 }), 2);
  assert.equal(getMidiResizeMinimumTicks({ ticksPerBar: 16, noteLengthIndex: 5 }), 1);
  assert.equal(getMidiResizeMinimumTicks({ ticksPerBar: 32, noteLengthIndex: 5 }), 2);
  assert.equal(getMidiResizeMinimumTicks({ ticksPerBar: 32, noteLengthIndex: 6 }), 1);
  assert.equal(getMidiResizeMinimumTicks({ ticksPerBar: 32, noteLengthIndex: 7 }), 1);
});

test('MIDI resize helper clamps shrink to portrait minimum duration', () => {
  const note = { id: 'n1', startTick: 8, durationTicks: 8, pitch: 60 };
  const left = resizeMidiNoteByEdge(note, {
    edge: 'start',
    snappedTick: 15,
    targetOriginal: note,
    gridTicks: 64,
    minDurationTicks: 2
  });
  const right = resizeMidiNoteByEdge(note, {
    edge: 'end',
    snappedTick: 9,
    targetOriginal: note,
    gridTicks: 64,
    minDurationTicks: 2
  });

  assert.deepEqual(left, { ...note, startTick: 14, durationTicks: 2 });
  assert.deepEqual(right, { ...note, startTick: 8, durationTicks: 2 });
});

test('MIDI portrait resize paths pass selected note minimum duration', () => {
  const resizeBody = midiMethodBody('resizeSelectionTo', 'resizeSelectedNotesBy');
  const controllerResizeBody = midiMethodBody('resizeSelectedNotesBy', 'openSelectionMenu');
  const minBody = midiMethodBody('getResizeMinimumTicksForLayout', 'getNoteRect');

  assert.equal(resizeBody.includes('const minDurationTicks = this.getResizeMinimumTicksForLayout();'), true);
  assert.equal(resizeBody.includes('minDurationTicks'), true);
  assert.equal(controllerResizeBody.includes('const minDurationTicks = this.getResizeMinimumTicksForLayout();'), true);
  assert.equal(controllerResizeBody.includes('const minDuration = Math.min(minDurationTicks, maxDuration);'), true);
  assert.equal(minBody.includes('isMobilePortraitLayout'), true);
  assert.equal(minBody.includes('getMidiResizeMinimumTicks'), true);
  assert.equal(minBody.includes('if (!isPortrait) return 1;'), true);
});

test('MIDI touch notes do not long-press into selection mode', () => {
  const pointerDownBody = midiMethodBody('handleGridPointerDown', 'toggleNoteAt');
  const moveReleaseBody = `${midiMethodBody('handlePointerMove', 'handlePointerUp')}\n${midiMethodBody('handlePointerUp', 'handleWheel')}`;

  assert.equal(pointerDownBody.includes('appendSelection: true'), false);
  assert.equal(pointerDownBody.includes("this.dragState.mode !== 'move' && this.dragState.mode !== 'resize'"), false);
  assert.equal(moveReleaseBody.includes('shouldMidiDeleteSelectedNoteOnTap()'), true);
});

test('MIDI file menu open aliases load and menu button toggles closed', () => {
  const pointerDownBody = midiMethodBody('handlePointerDown', 'handlePointerMove');

  assert.equal(midiComposerSource.includes("action === 'load' || action === 'open'"), true);
  assert.equal(pointerDownBody.includes("if (this.activeTab === 'file')"), true);
  assert.equal(pointerDownBody.includes('this.closeFileMenu();'), true);
});

test('MIDI WAV ready overlay uses a real button for touch downloads', () => {
  const overlayBody = midiMethodBody('openDownloadReadyOverlay', 'openWavExportProgressOverlay');

  assert.equal(overlayBody.includes("document.createElement('button')"), true);
  assert.equal(overlayBody.includes('downloadBtn.addEventListener'), true);
  assert.equal(overlayBody.includes('downloadStarted'), true);
  assert.equal(overlayBody.includes("downloadBtn = document.createElement('a')"), false);
  assert.equal(overlayBody.includes("document.getElementById('global-overlay-root')"), true);
  assert.equal(overlayBody.includes('root.appendChild(overlay)'), true);
  assert.equal(overlayBody.includes("'pointerdown'"), true);
  assert.equal(overlayBody.includes("'touchstart'"), true);
  assert.equal(overlayBody.includes('event.stopPropagation();'), true);
  assert.equal(overlayBody.includes('urlRevoked'), true);
});

test('shared text input overlays shield panel pointer events from canvas handlers', () => {
  assert.equal(textInputOverlaySource.includes('OVERLAY_PANEL_SHIELDED_EVENTS'), true);
  assert.equal(textInputOverlaySource.includes("'pointerdown'"), true);
  assert.equal(textInputOverlaySource.includes("'touchstart'"), true);
  assert.equal(textInputOverlaySource.includes("'mousedown'"), true);
  assert.equal(textInputOverlaySource.includes('event.stopPropagation();'), true);
  assert.equal(textInputOverlaySource.includes('shieldOverlayPanelEvents(panel);'), true);
  assert.equal(textInputOverlaySource.includes('getOverlayRoot().appendChild(overlay);'), true);
});

test('MIDI edit previews use async low-priority audio path', () => {
  const previewBody = midiMethodBody('previewNote', 'auditionPitch');
  const auditionBody = midiMethodBody('auditionPitch', 'selectInstrumentPickerItem');
  const previewPlayBody = midiMethodBody('playPreviewGmNote', 'cleanupActiveNotes');

  assert.equal(previewBody.includes('this.playPreviewGmNote'), true);
  assert.equal(previewBody.includes('this.playGmNote('), false);
  assert.equal(auditionBody.includes('this.playPreviewGmNote'), true);
  assert.equal(auditionBody.includes('this.playGmNote('), false);
  assert.equal(previewPlayBody.includes('window.setTimeout'), true);
  assert.equal(previewPlayBody.includes('preview: true'), true);
  assert.equal(previewPlayBody.includes('this.isPlaying || this.recorder?.isRecording'), true);
});

test('MIDI audio protects timeline voices and bounds pedal buses', () => {
  assert.equal(audioSource.includes('this.midiPreviewVoiceLimit'), true);
  assert.equal(audioSource.includes("voice.group === 'preview'"), true);
  assert.equal(audioSource.includes('enforceMidiVoiceLimits()'), true);
  assert.equal(audioSource.includes('this.midiPedalBusLimit'), true);
  assert.equal(audioSource.includes('pruneMidiPedalBusCache()'), true);
  assert.equal(audioSource.includes('this.midiPedalBusMaxAgeSeconds'), true);
  assert.equal(audioSource.includes('preview = false'), true);
  assert.equal(audioSource.includes("voiceGroup = preview ? 'preview' : 'timeline'"), true);
});

test('MIDI pedal changes clear cached DSP buses', () => {
  const insertBody = midiMethodBody('insertPedalIntoSlot', 'updateSelectedPedalKnob');
  const updateBody = midiMethodBody('updateSelectedPedalKnob', 'openPedalEditorForSlot');
  const commitBody = midiMethodBody('commitPedalEditor', 'cancelPedalEditor');
  const deleteBody = midiMethodBody('deletePedalFromEditor', 'buildExportTrackNotes');
  const stopBody = midiMethodBody('stopPlayback', 'returnToStart');

  assert.equal(insertBody.includes('clearMidiPedalBuses'), true);
  assert.equal(updateBody.includes('clearMidiPedalBuses'), true);
  assert.equal(commitBody.includes('clearMidiPedalBuses'), true);
  assert.equal(deleteBody.includes('clearMidiPedalBuses'), true);
  assert.equal(stopBody.includes('clearMidiPedalBuses'), true);
});

test('MIDI non-loop playback ignores loop end marker', () => {
  const advanceBody = midiMethodBody('advancePlayhead', 'triggerPlayback');
  const returnBody = midiMethodBody('returnToStart', 'goToEnd');
  const toggleBody = midiMethodBody('togglePlayback', 'stopPlayback');

  assert.equal(advanceBody.includes("const loopActive = this.song.loopEnabled && typeof this.song.loopEndTick === 'number';"), true);
  assert.equal(advanceBody.includes('if (loopActive)'), true);
  assert.equal(advanceBody.includes('} else if (nextTick >= loopTicks)'), false);
  assert.equal(advanceBody.includes('this.ensureGridCapacity(this.playheadTick);'), true);
  assert.equal(advanceBody.includes('const playbackEndTick = this.getPlaybackEndTick();'), true);
  assert.equal(advanceBody.includes('if (this.playheadTick >= playbackEndTick)'), true);
  assert.equal(returnBody.includes('this.song.loopEnabled ? this.getLoopStartTick() : 0'), true);
  assert.equal(toggleBody.includes('this.returnToStart();'), false);
  assert.equal(toggleBody.includes('this.resyncPlaybackClock(this.playheadTick);'), true);
});

test('MIDI grid zoom plus minus buttons are disabled', () => {
  const model = buildMidiGridZoomButtonModel();

  assert.equal(model.visible, false);
  assert.deepEqual(model.bounds, {
    zoomInX: null,
    zoomOutX: null,
    zoomInY: null,
    zoomOutY: null
  });
});

test('MIDI horizontal zoom caps zoom-out to twelve measures', () => {
  const limits = getMidiGridZoomLimitsXForBars(16);

  assert.ok(limits.minZoom > 1);
  assert.equal(limits.minZoom, 16 / MIDI_MAX_ZOOM_OUT_BARS);
  assert.equal(getMidiGridZoomLimitsXForBars(8).minZoom, 1);
  assert.equal(limits.maxZoom, 64);
});

test('MIDI horizontal zoom slider maps full left and right range', () => {
  const limits = getMidiGridZoomLimitsXForBars(16);

  assert.equal(getMidiZoomFromSliderRatio(0, limits), limits.minZoom);
  assert.equal(getMidiZoomFromSliderRatio(-1, limits), limits.minZoom);
  assert.equal(getMidiZoomFromSliderRatio(1, limits), limits.maxZoom);
  assert.equal(getMidiZoomFromSliderRatio(2, limits), limits.maxZoom);
  assert.equal(getMidiZoomFromSliderRatio(0.5, limits), limits.minZoom + (limits.maxZoom - limits.minZoom) / 2);
});

test('MIDI zoom controls use selected content focus instead of assigning zoom directly', () => {
  const sliderBody = midiMethodBody('updateSliderValue', 'handleSelectionMenuAction');
  const helperBody = midiMethodBody('setHorizontalTimelineZoom', 'getSongTimelineX');
  const wheelBody = midiMethodBody('handleWheel', 'shouldHandleGestureStart');

  assert.equal(sliderBody.includes('this.setHorizontalTimelineZoom(getMidiZoomFromSliderRatio'), true);
  assert.equal(sliderBody.includes('this.gridZoomX = getMidiZoomFromSliderRatio'), false);
  assert.equal(helperBody.includes('const focus = this.getCurrentZoomFocus();'), true);
  assert.equal(helperBody.includes('focus.tick'), true);
  assert.equal(helperBody.includes('this.gridOffset.x = nextOriginX - this.gridBounds.x;'), true);
  assert.equal(wheelBody.includes('this.getSongTickFromX(payload.x, this.songTimelineBounds)'), true);
});

test('MIDI grid zoom centers selected note focus when no pointer anchor is provided', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.activeTab = 'grid';
  composer.gridZoomX = 1;
  composer.gridOffset = { x: 0, y: 0 };
  composer.timelineStartTick = 0;
  composer.gridBounds = {
    x: 10,
    y: 20,
    w: 200,
    h: 120,
    cols: 100,
    rows: 20,
    cellWidth: 5,
    cellHeight: 10,
    originX: 10,
    originY: 20,
    gridH: 200
  };
  composer.getGridZoomLimitsX = () => ({ minZoom: 0.5, maxZoom: 4 });
  composer.getCurrentZoomFocus = () => ({ tick: 20, pitch: 60, trackIndex: 0 });
  composer.ensureGridPanCapacity = () => {};

  composer.setHorizontalTimelineZoom(2);

  assert.equal(composer.gridZoomX, 2);
  assert.equal(composer.gridBounds.x + composer.gridBounds.w / 2, composer.gridBounds.x + composer.gridOffset.x + 20 * 10);
});

test('MIDI melodic grid spans C1 through C8 while drum rows stay unchanged', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.song = {
    tracks: [
      { instrument: 'piano' },
      { instrument: 'drums', channel: 9 }
    ]
  };
  composer.selectedTrackIndex = 0;

  assert.deepEqual(composer.getPitchRange(), { min: 24, max: 108 });
  assert.equal(composer.getPitchFromRow(0), 108);
  assert.equal(composer.getRowFromPitch(108), 0);
  assert.equal(composer.getOctaveLabel(24), 1);
  assert.equal(composer.getOctaveLabel(108), 8);

  composer.selectedTrackIndex = 1;
  const drumRange = composer.getPitchRange();
  assert.notDeepEqual(drumRange, { min: 24, max: 108 });
  assert.equal(composer.getRowFromPitch(36) >= 0, true);
});

test('MIDI opening a song focuses the latest available note instead of empty measure one', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.song = {
    tracks: [
      { patterns: [{ notes: [{ startTick: 32, durationTicks: 4, pitch: 72 }] }] },
      { patterns: [{ notes: [{ startTick: 112, durationTicks: 4, pitch: 40 }] }] },
      { patterns: [{ notes: [{ startTick: 176, durationTicks: 4, pitch: 60 }, { startTick: 172, durationTicks: 4, pitch: 64 }] }] }
    ]
  };
  composer.selectedPatternIndex = 0;
  composer.selectedTrackIndex = 0;
  composer.cursor = { tick: 0, pitch: 72 };
  composer.playheadTick = 0;
  composer.getTicksPerBar = () => 16;
  composer.resyncPlaybackClock = (tick) => { composer.lastPlaybackTick = tick; };

  composer.focusFirstSongContentAfterOpen();

  assert.equal(composer.selectedTrackIndex, 2);
  assert.equal(composer.cursor.tick, 176);
  assert.equal(composer.cursor.pitch, 62);
  assert.deepEqual(composer.pendingGridFocus, { trackIndex: 2, tick: 176, pitch: 62 });
  assert.deepEqual(composer.pendingSongFocus, { trackIndex: 2, tick: 176, pitch: 62 });
});

test('MIDI opening a song restores saved per-track viewport before latest-note fallback', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.song = {
    editorState: {
      midiComposer: {
        lastTrackId: 'track-b',
        trackViewports: {
          'track-b': {
            grid: {
              gridOffset: { x: -320, y: -640 },
              timelineStartTick: 88,
              gridZoomX: 2.5,
              gridZoomY: 1.25,
              cursorTick: 352,
              cursorPitch: 108,
              selectedPatternIndex: 0
            },
            song: {
              songTimelineOffsetX: -144,
              songTrackScroll: 36,
              timelineStartTick: 80,
              gridZoomX: 2.5
            }
          }
        }
      }
    },
    tracks: [
      { id: 'track-a', instrument: 'piano', patterns: [{ notes: [{ startTick: 16, pitch: 60 }] }] },
      { id: 'track-b', instrument: 'piano', patterns: [{ notes: [{ startTick: 40, pitch: 72 }] }] }
    ]
  };
  composer.selectedPatternIndex = 0;
  composer.selectedTrackIndex = 0;
  composer.cursor = { tick: 0, pitch: 60 };
  composer.playheadTick = 0;
  composer.gridOffset = { x: 0, y: 0 };
  composer.gridZoomX = 1;
  composer.gridZoomY = 1;
  composer.resyncPlaybackClock = (tick) => { composer.lastPlaybackTick = tick; };

  composer.focusFirstSongContentAfterOpen();

  assert.equal(composer.selectedTrackIndex, 1);
  assert.deepEqual(composer.gridOffset, { x: -320, y: -640 });
  assert.equal(composer.gridZoomX, 2.5);
  assert.equal(composer.gridZoomY, 1.25);
  assert.equal(composer.cursor.tick, 352);
  assert.equal(composer.cursor.pitch, 108);
  assert.equal(composer.playheadTick, 352);
  assert.deepEqual(composer.pendingGridFocus, null);
  assert.equal(composer.songViewportMemory.songTimelineOffsetX, -144);
});

test('MIDI per-track viewport persistence stores separate track positions without undo history', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.song = {
    tracks: [
      { id: 'track-a', instrument: 'piano', name: 'A', patterns: [{ notes: [] }] },
      { id: 'track-b', instrument: 'piano', name: 'B', patterns: [{ notes: [] }] }
    ]
  };
  composer.selectedTrackIndex = 0;
  composer.selectedPatternIndex = 0;
  composer.activeTab = 'grid';
  composer.gridOffset = { x: -10, y: -20 };
  composer.gridZoomX = 1.5;
  composer.gridZoomY = 1.1;
  composer.timelineStartTick = 12;
  composer.songTimelineOffsetX = -30;
  composer.songTrackScroll = 0;
  composer.cursor = { tick: 12, pitch: 60 };
  composer.playheadTick = 12;
  composer.selection = { clear() {} };
  composer.closeSelectionMenu = () => {};
  composer.closeMidiPortraitTrackPicker = () => {};
  composer.closeMidiPortraitMasterVolume = () => {};
  composer.clearSongSelection = () => {};
  composer.syncCursorToTrack = () => {};
  composer.resyncPlaybackClock = (tick) => { composer.lastPlaybackTick = tick; };
  composer.markDirty = () => { composer.dirtyMarked = true; };

  composer.selectTrackIndex(1, { restoreViewport: false });
  composer.gridOffset = { x: -200, y: -300 };
  composer.gridZoomX = 2;
  composer.gridZoomY = 1.4;
  composer.timelineStartTick = 48;
  composer.cursor = { tick: 48, pitch: 72 };
  composer.persistViewportState();

  const viewports = composer.song.editorState.midiComposer.trackViewports;
  assert.equal(viewports['track-a'].grid.cursorTick, 12);
  assert.equal(viewports['track-a'].grid.cursorPitch, 60);
  assert.equal(viewports['track-b'].grid.cursorTick, 48);
  assert.equal(viewports['track-b'].grid.cursorPitch, 72);
  assert.equal(composer.song.editorState.midiComposer.lastTrackId, 'track-b');
  assert.equal(composer.dirtyMarked, true);
});

test('MIDI grid and song tabs remember their session viewport when switching views', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.activeTab = 'grid';
  composer.gridOffset = { x: -40, y: -80 };
  composer.timelineStartTick = 12;
  composer.gridZoomX = 3;
  composer.gridZoomY = 1.5;
  composer.selectedTrackIndex = 2;
  composer.closeMidiPortraitTrackPicker = () => {};
  composer.closeMidiPortraitMasterVolume = () => {};

  composer.activateLeftRailTab('song');
  composer.timelineStartTick = 64;
  composer.songTimelineOffsetX = -120;
  composer.songTrackScroll = 44;
  composer.gridZoomX = 2;

  composer.activateLeftRailTab('grid');

  assert.deepEqual(composer.gridOffset, { x: -40, y: -80 });
  assert.equal(composer.timelineStartTick, 12);
  assert.equal(composer.gridZoomX, 3);
  assert.equal(composer.gridZoomY, 1.5);
});

test('MIDI song timeline touch panning and thumbstick support horizontal and vertical movement', () => {
  const thumbModeBody = midiMethodBody('isMobileLandscapeThumbZoomMode', 'applyMobilePanJoystick');
  const joystickBody = midiMethodBody('applyMobilePanJoystick', 'updatePanJoystick');
  const pointerDownBody = midiMethodBody('handlePointerDown', 'handlePointerMove');
  const pointerMoveBody = midiMethodBody('handlePointerMove', 'handlePointerUp');
  const drawMobileBody = midiMethodBody('drawMobileLayout', 'drawFilePanel');

  assert.equal(thumbModeBody.includes("this.activeTab === 'grid' || this.activeTab === 'song'"), true);
  assert.equal(joystickBody.includes("this.activeTab === 'song' && this.songTimelineBounds"), true);
  assert.equal(joystickBody.includes('this.songTimelineOffsetX - this.panJoystick.dx'), true);
  assert.equal(joystickBody.includes('this.songTrackScroll + this.panJoystick.dy'), true);
  assert.equal(pointerDownBody.includes('&& !laneTapHit'), true);
  assert.equal(pointerDownBody.includes('startScroll: this.songTrackScroll'), true);
  assert.equal(pointerMoveBody.includes("this.dragState.mode = Math.abs(dy) > Math.abs(dx) ? 'song-track-scroll' : 'song-pan';"), true);
  assert.equal(pointerMoveBody.includes("this.dragState.mode === 'song-track-scroll'"), true);
  assert.equal(drawMobileBody.includes("isLandscape && (this.activeTab === 'grid' || this.activeTab === 'song') && !controllerConnected"), true);
});

test('MIDI song ruler double tap loops exactly one measure', () => {
  const pointerDownBody = midiMethodBody('handlePointerDown', 'handlePointerMove');
  const loopMeasureBody = midiMethodBody('setLoopToMeasureIndex', 'handleSongRulerTap');
  const rulerTapBody = midiMethodBody('handleSongRulerTap', 'clearLoopStartTick');

  assert.equal(pointerDownBody.includes('this.handleSongRulerTap(tick)'), true);
  assert.equal(loopMeasureBody.includes('const start = safeIndex * ticksPerBar;'), true);
  assert.equal(loopMeasureBody.includes('const end = start + ticksPerBar;'), true);
  assert.equal(loopMeasureBody.includes('this.song.loopEnabled = true;'), true);
  assert.equal(loopMeasureBody.includes('this.resyncPlaybackClock(this.playheadTick);'), true);
  assert.equal(rulerTapBody.includes('now - this.songRulerTap.at <= 300'), true);
  assert.equal(rulerTapBody.includes('this.setLoopToMeasureIndex(barIndex);'), true);
});

test('MIDI song ruler and playhead render above track lanes', () => {
  const drawSongBody = midiMethodBody('drawSongTab', 'drawTimelineRuler');
  const playheadBody = midiMethodBody('drawSongPlayhead', 'drawSongSelectionMenu');
  const lanesIndex = drawSongBody.indexOf('this.song.tracks.forEach');
  const rulerIndex = drawSongBody.lastIndexOf('this.drawTimelineRuler');
  const playheadIndex = drawSongBody.lastIndexOf('this.drawSongPlayhead');

  assert.ok(lanesIndex >= 0);
  assert.ok(rulerIndex > lanesIndex);
  assert.ok(playheadIndex > rulerIndex);
  assert.equal(playheadBody.includes('ctx.fillRect(xPos - handleWidth / 2'), true);
});

test('MIDI portrait grid slider-left zoom shows at most twelve measures', () => {
  const limits = getMidiGridZoomLimitsXForBars(16);
  const layout = getMidiPatternGridLayoutMetrics({
    x: 10,
    y: 10,
    w: 370,
    h: 728,
    gridTicks: 64,
    rows: 60,
    isMobile: true,
    isPortrait: true,
    drumGrid: false,
    gridZoomX: limits.minZoom,
    gridZoomY: 1,
    baseVisibleRows: 12,
    zoomYLimits: { minZoom: 0.2, maxZoom: 2.4 },
    zoomXLimits: limits,
    initialized: true
  });

  assert.equal(layout.gridZoomX, limits.minZoom);
  assert.ok(Math.abs((64 / layout.gridZoomX) - (MIDI_MAX_ZOOM_OUT_BARS * 4)) < 0.001);
  assert.ok(layout.cellWidth > 4);
});

test('MIDI playback clock clamps stale-frame catch up', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.song = { tempo: 120, loopEnabled: false, tracks: [], loopBars: 4 };
  composer.ticksPerBeat = 4;
  composer.playheadTick = 0;
  composer.lastPlaybackTick = 0;
  composer.playbackLastClockSeconds = 0;
  composer.getPlaybackClockSeconds = () => 10;
  composer.getLoopTicks = () => 16;
  composer.getLoopStartTick = () => 0;
  composer.getPlaybackEndTick = () => 999;
  composer.ensureGridCapacity = () => {};
  composer.triggerPlayback = () => {};

  composer.advancePlayhead(10);

  assert.equal(composer.playheadTick, 8 * MIDI_PLAYBACK_MAX_CATCHUP_SECONDS);
});

test('MIDI viewport pan and zoom capacity do not expand authored song length', () => {
  const composer = Object.create(MidiComposer.prototype);
  composer.song = {
    loopBars: 4,
    tracks: [{ patterns: [{ bars: 4 }] }]
  };
  composer.getTicksPerBar = () => 4;
  composer.getGridTicks = () => 16;
  composer.getSongTimelineTicks = () => 16;
  composer.gridBounds = { x: 0, w: 100, cellWidth: 1 };
  composer.gridZoomX = 0.1;
  composer.timelineStartTick = 999;

  composer.ensureGridPanCapacity(-10000);
  composer.ensureTimelinePanCapacity(-10000, 100, 1);
  composer.ensureTimelineCapacity();

  assert.equal(composer.song.loopBars, 4);
  assert.equal(composer.song.tracks[0].patterns[0].bars, 4);
});

test('MIDI drum notes use editable note length instead of fixed quarter hits', () => {
  const effectiveDurationBody = midiMethodBody('getEffectiveDurationTicks', 'coercePitchForTrack');
  const noteLengthBody = midiMethodBody('setNoteLengthIndex', 'cycleTimeSignature');
  const menuBody = midiMethodBody('drawNoteLengthMenu', 'drawToolsMenu');
  const moveBody = midiMethodBody('moveSelectionTo', 'resizeSelectionTo');

  assert.equal(effectiveDurationBody.includes('isDrumTrack(track)'), false);
  assert.equal(noteLengthBody.includes('isDrumTrack(this.getActiveTrack())'), false);
  assert.equal(menuBody.includes('isDrumTrack(this.getActiveTrack())'), false);
  assert.equal(moveBody.includes('drumDuration'), false);
  assert.equal(midiComposerSource.includes('isDrums ? this.getDrumHitDurationTicks()'), false);
});

test('MIDI placement snaps to selected note value for every track type', () => {
  assert.equal(getMidiPlacementSnapTicks({
    quantizeEnabled: true,
    ticksPerBar: 16,
    quantizeDivisor: 4,
    noteLengthDivisor: 8,
    drumTrack: true
  }), 2);
  assert.equal(getMidiPlacementSnapTicks({
    quantizeEnabled: true,
    ticksPerBar: 16,
    quantizeDivisor: 4,
    noteLengthDivisor: 8,
    drumTrack: false
  }), 2);
  assert.equal(getMidiPlacementSnapTicks({
    quantizeEnabled: false,
    ticksPerBar: 16,
    quantizeDivisor: 4,
    noteLengthDivisor: 8,
    drumTrack: true
  }), 1);

  const pointerDownBody = midiMethodBody('handlePointerDown', 'handlePointerMove');
  const drawPatternBody = midiMethodBody('drawPatternEditor', 'drawPastePreview');
  const toggleBody = midiMethodBody('toggleNoteAt', 'paintNoteAt');
  const paintBody = midiMethodBody('paintNoteAt', 'eraseNoteAt');
  const moveBody = midiMethodBody('moveSelectionTo', 'resizeSelectionTo');

  assert.equal(midiComposerSource.includes('const divisor = drumTrack ? noteLengthDivisor : quantizeDivisor;'), false);
  assert.equal(pointerDownBody.includes('if (isDrumTrack(this.getActiveTrack())) {\n        this.noteLengthMenu.open = false;'), false);
  assert.equal(drawPatternBody.includes('this.getPlacementSnapTicks(track)'), true);
  assert.equal(toggleBody.includes('this.snapTickForTrack(tick, track)'), true);
  assert.equal(paintBody.includes('this.snapTickForTrack(tick, track)'), true);
  assert.equal(moveBody.includes('this.snapTickForTrack(tick, track)'), true);
});

test('MIDI song sections append orphan notes to the previous section', () => {
  const composer = createMidiComposerRangeHarness();
  const pattern = {
    partRanges: [{ startTick: 0, endTick: 192 }],
    notes: [
      { startTick: 0, durationTicks: 8 },
      { startTick: 192, durationTicks: 8 },
      { startTick: 200, durationTicks: 8 },
      { startTick: 256, durationTicks: 8 },
      { startTick: 264, durationTicks: 8 },
      { startTick: 320, durationTicks: 8 },
      { startTick: 328, durationTicks: 8 }
    ]
  };

  assert.deepEqual(composer.getPatternPartRanges(pattern, 512), [
    { startTick: 0, endTick: 336 }
  ]);
});

test('MIDI song sections append between-section orphans instead of prepending the next section', () => {
  const composer = createMidiComposerRangeHarness();
  const pattern = {
    partRanges: [
      { startTick: 0, endTick: 64 },
      { startTick: 128, endTick: 192 }
    ],
    notes: [
      { startTick: 16, durationTicks: 8 },
      { startTick: 96, durationTicks: 8 },
      { startTick: 144, durationTicks: 8 }
    ]
  };

  assert.deepEqual(composer.getPatternPartRanges(pattern, 256), [
    { startTick: 0, endTick: 104 },
    { startTick: 128, endTick: 192 }
  ]);
});

test('MIDI song sections create a leading section for notes before the first range', () => {
  const composer = createMidiComposerRangeHarness();
  const pattern = {
    partRanges: [{ startTick: 64, endTick: 128 }],
    notes: [
      { startTick: 8, durationTicks: 8 },
      { startTick: 24, durationTicks: 8 },
      { startTick: 72, durationTicks: 8 }
    ]
  };

  assert.deepEqual(composer.getPatternPartRanges(pattern, 256), [
    { startTick: 8, endTick: 32 },
    { startTick: 64, endTick: 128 }
  ]);
});

test('MIDI song sections keep implicit note-span behavior without explicit ranges', () => {
  const composer = createMidiComposerRangeHarness();
  composer.getTicksPerBar = () => 16;
  const pattern = {
    notes: [
      { startTick: 7, durationTicks: 5 },
      { startTick: 35, durationTicks: 4 }
    ]
  };

  assert.deepEqual(composer.getPatternPartRanges(pattern, 128), [
    { startTick: 7, endTick: 48 }
  ]);
});

test('MIDI portrait song rail keeps music edit tools above volume and pan', () => {
  for (const [width, railHeight] of [[360, 184], [390, 184], [414, 184]]) {
    const edit = getMidiPortraitSongRailLayout({
      x: 10,
      y: 420,
      w: width - 20,
      h: railHeight,
      mode: 'edit',
      actionCount: 5
    });
    const tools = getMidiPortraitSongRailLayout({
      x: 10,
      y: 420,
      w: width - 20,
      h: railHeight,
      mode: 'tools',
      actionCount: 5
    });
    const music = getMidiPortraitSongRailLayout({
      x: 10,
      y: 420,
      w: width - 20,
      h: railHeight,
      mode: 'music-controls',
      actionCount: 7
    });

    assert.equal(edit.tabs.length, 5);
    assert.equal(new Set(edit.tabs.map((tab) => tab.y)).size, 2);
    assert.equal(new Set(edit.tabs.slice(0, 3).map((tab) => tab.y)).size, 1);
    assert.equal(new Set(edit.tabs.slice(3).map((tab) => tab.y)).size, 1);
    assert.ok(edit.tabs[3].y - (edit.tabs[0].y + edit.tabs[0].h) >= 12);
    assert.ok(edit.tabs.slice(3).every((tab) => tab.w > edit.tabs[0].w));
    assert.ok(edit.tabs.every((tab) => tab.w >= 50));
    assert.ok(edit.actions.every((action) => action.w >= 72));
    assert.ok(edit.actions.every((action) => action.h >= 38));
    assert.ok(Math.min(...edit.actions.map((action) => action.y)) - Math.max(...edit.tabs.map((tab) => tab.y + tab.h)) >= 16);
    assert.ok(420 + railHeight - Math.max(...edit.actions.map((action) => action.y + action.h)) <= 8);
    assert.ok(tools.actions.every((action) => action.x + action.w <= width - 10));
    assert.ok(tools.actions.every((action) => action.y + action.h <= 420 + railHeight - 2));
    assert.equal(music.actions.length, 7);
    assert.equal(new Set(music.actions.slice(0, 4).map((action) => action.y)).size, 1);
    assert.equal(new Set(music.actions.slice(4).map((action) => action.y)).size, 1);
  }
});

test('MIDI portrait volume and pan sliders sit lower than landscape sliders', () => {
  assert.equal(getMidiSongMixSliderYOffset({ portrait: true }), 12);
  assert.equal(getMidiSongMixSliderYOffset({ portrait: false }), 8);
});

test('MIDI portrait song actions use compact labels', () => {
  const editLabels = getMidiSongActionSpecs('edit', { portrait: true }).map((action) => action.label);
  const toolLabels = getMidiSongActionSpecs('tools', { portrait: true }).map((action) => action.label);
  const musicControls = getMidiSongMusicControlSpecs({ portrait: true, isPlaying: false, loopEnabled: true });

  assert.ok(editLabels.includes('Dupe'));
  assert.equal(editLabels.includes('Duplicate'), false);
  assert.ok(toolLabels.includes('← Merge'));
  assert.ok(toolLabels.includes('Merge →'));
  assert.ok(toolLabels.includes('Clone'));
  assert.equal(toolLabels.includes('↻'), false);
  assert.equal(toolLabels.includes('Loop This'), false);
  assert.equal(toolLabels.includes('Merge Left'), false);
  assert.equal(toolLabels.includes('Merge Right'), false);
  assert.deepEqual(musicControls.map((control) => control.key), [
    'songTransportStart',
    'songTransportBack',
    'songTransportForward',
    'songTransportEnd',
    'songTransportMetronome',
    'songTransportPlayPause',
    'songTransportLoopThis'
  ]);
  assert.equal(musicControls.find((control) => control.key === 'songTransportMetronome')?.label, 'M');
});

test('MIDI portrait mixer stays in the main workspace instead of forcing the sheet open', () => {
  assert.equal(isMidiPortraitMainWorkspaceTab('grid'), true);
  assert.equal(isMidiPortraitMainWorkspaceTab('song'), true);
  assert.equal(isMidiPortraitMainWorkspaceTab('instruments'), true);
  assert.equal(isMidiPortraitMainWorkspaceTab('pedals'), true);
  assert.equal(isMidiPortraitMainWorkspaceTab('settings'), false);
  assert.equal(isMidiPortraitMainWorkspaceTab('file'), false);
  assert.equal(shouldMidiPortraitSheetOpen('grid', false), false);
  assert.equal(shouldMidiPortraitSheetOpen('song', false), false);
  assert.equal(shouldMidiPortraitSheetOpen('instruments', false), false);
  assert.equal(shouldMidiPortraitSheetOpen('pedals', false), false);
  assert.equal(shouldMidiPortraitSheetOpen('song', true), false);
  assert.equal(shouldMidiPortraitSheetOpen('instruments', true), false);
  assert.equal(shouldMidiPortraitSheetOpen('pedals', true), false);
  assert.equal(shouldMidiPortraitSheetOpen('settings', false), true);
  assert.equal(shouldMidiPortraitSheetOpen('file', false), true);
});

test('MIDI portrait root tabs fit without horizontal scrolling', () => {
  const tabs = buildMidiPortraitRootTabs();
  const layout = getSharedPortraitMultiRowTabLayout(
    { x: 8, y: 640, w: 344, h: 104 },
    tabs,
    { minButtonWidth: 54, maxButtonWidth: 160, rowHeight: 40, maxRows: 2, maxColumns: 4, balanceLastRow: true, padding: 4, gap: 5 }
  );

  assert.deepEqual(tabs.map((tab) => tab.id), ['file', 'grid', 'song', 'instruments', 'virtual-instruments', 'pedals', 'settings']);
  assert.equal(layout.buttons.length, tabs.length);
  assert.ok(layout.rows <= 2);
  assert.ok(layout.columns <= 4);
  assert.equal(layout.buttons.filter((button) => button.row === 0).length, 4);
  assert.equal(layout.buttons.filter((button) => button.row === 1).length, 3);
  assert.ok(layout.buttons.filter((button) => button.row === 1).every((button) => button.bounds.w >= 108));
  assert.ok(layout.buttons.find((button) => button.id === 'settings').bounds.w >= 108);
  assert.ok(layout.buttons.every((button) => button.bounds.x >= 8));
  assert.ok(layout.buttons.every((button) => button.bounds.x + button.bounds.w <= 352));
});

test('MIDI portrait pedal grid exposes four touchable slots', () => {
  const layout = getMidiPortraitPedalGridLayout({ x: 8, y: 120, w: 344, h: 360 });

  assert.equal(layout.slots.length, 4);
  assert.ok(layout.slots.every((slot) => slot.w >= 150));
  assert.ok(layout.slots.every((slot) => slot.h >= 140));
  assert.ok(layout.slots.every((slot) => slot.x >= layout.panel.x));
  assert.ok(layout.slots.every((slot) => slot.y + slot.h <= layout.panel.y + layout.panel.h));
});

test('MIDI portrait pedal grid fills almost all of the expanded pedal workspace', () => {
  const layout = getMidiPortraitPedalGridLayout(
    { x: 10, y: 10, w: 370, h: 728 },
    { gap: 6, padding: 6, titleHeight: 18 }
  );
  const bottomWaste = layout.panel.y + layout.panel.h - Math.max(...layout.slots.map((slot) => slot.y + slot.h));

  assert.ok(layout.slots.every((slot) => slot.w >= 176));
  assert.ok(layout.slots.every((slot) => slot.h >= 340));
  assert.ok(bottomWaste <= 8);
});

test('MIDI portrait grid quick strip uses four readable controls', () => {
  const items = buildMidiPortraitGridQuickStripItems({
    song: {
      tempo: 123,
      loopEnabled: true,
      tracks: [{ name: 'Lead' }, { name: 'Bass' }]
    },
    noteLengthLabel: '𝅘𝅥 1/4'
  });

  assert.deepEqual(items.map((item) => item.id), ['track', 'tempo', 'loop', 'quantize']);
  assert.deepEqual(items.map((item) => item.label), ['Track', '123', '↻', '𝅘𝅥 1/4']);
  assert.equal(items.some((item) => item.id === 'volume'), false);
  assert.equal(items.some((item) => item.label === 'Vol'), false);
  assert.equal(items.some((item) => item.label.includes('Tr ')), false);
  assert.equal(items.some((item) => item.label.includes('BPM')), false);
  assert.equal(items.some((item) => item.label.includes('%')), false);
});

test('MIDI portrait grid quick strip keeps all quick controls on one row', () => {
  const items = buildMidiPortraitGridQuickStripItems({
    song: { tempo: 123, loopEnabled: true },
    noteLengthLabel: '1/4'
  });
  const layout = getSharedPortraitMultiRowTabLayout(
    { x: 10, y: 682, w: 370, h: 56 },
    items,
    { minButtonWidth: 64, maxButtonWidth: 96, maxRows: 1, maxColumns: 4, rowHeight: 42, gap: 6, padding: 6 }
  );

  assert.equal(layout.rows, 1);
  assert.equal(layout.columns, 4);
  assert.equal(layout.fits, true);
  assert.equal(new Set(layout.buttons.map((button) => button.bounds.y)).size, 1);
  assert.ok(layout.buttons.every((button) => button.bounds.y >= 682));
  assert.ok(layout.buttons.every((button) => button.bounds.y + button.bounds.h <= 738));
  assert.ok(56 - layout.totalHeight <= 14);
});

test('MIDI portrait master volume panel fits above quick strip', () => {
  const layout = getMidiPortraitMasterVolumeLayout({ x: 8, y: 540, w: 344, h: 84 });

  assert.ok(layout.panel.y >= 0);
  assert.ok(layout.panel.y + layout.panel.h < 540);
  assert.ok(layout.slider.w >= 300);
  assert.equal(layout.slider.id, 'audio-volume');
});

test('MIDI portrait track picker fits above quick strip and exposes scroll rows', () => {
  const layout = getMidiPortraitTrackPickerLayout({ x: 8, y: 540, w: 344, h: 84 }, 12);

  assert.ok(layout.panel.y >= 0);
  assert.ok(layout.panel.y + layout.panel.h < 540);
  assert.ok(layout.list.w >= 300);
  assert.ok(layout.visibleRows >= 4);
  assert.ok(layout.visibleRows < 12);
});

test('MIDI portrait record layout keeps virtual instrument wide and below grid', () => {
  for (const [width, height] of [[360, 740], [390, 844], [414, 896]]) {
    const layout = getMidiPortraitRecordLayout(width, height);

    assert.ok(layout.gridBounds.w >= width - 24);
    assert.ok(layout.gridBounds.h >= 96);
    assert.ok(layout.pedalBounds.y >= layout.gridBounds.y + layout.gridBounds.h);
    assert.ok(layout.pedalBounds.h >= 64);
    assert.ok(layout.instrumentBounds.y >= layout.pedalBounds.y + layout.pedalBounds.h);
    assert.ok(layout.instrumentBounds.w === width);
    assert.ok(layout.instrumentBounds.h > 180);
    assert.ok(layout.instrumentBounds.y + layout.instrumentBounds.h <= layout.middleRail.y);
  }
});

test('TouchInput supports portrait-only reduced keyboard and fret density', () => {
  const touch = new TouchInput();
  touch.setBounds({ x: 0, y: 0, w: 320, h: 120 }, { keyboardWhiteKeys: 8, stringFrets: 7 });
  assert.equal(touch.keyRects.filter((key) => !key.black).length, 8);

  touch.setInstrument('guitar');
  touch.setBounds({ x: 0, y: 0, w: 320, h: 160 }, { keyboardWhiteKeys: 8, stringFrets: 7 });
  assert.equal(touch.stringLayout.fretCount, 7);
  assert.equal(touch.stringRects.filter((cell) => !cell.open).length, 6 * 7);

  touch.setBounds({ x: 0, y: 0, w: 320, h: 160 });
  assert.equal(touch.stringLayout.fretCount, 12);
});

test('TouchInput string notes keep selected virtual instrument metadata', () => {
  const events = [];
  const touch = new TouchInput({ emit: (type, event) => events.push({ type, event }) });
  touch.setInstrument('bass');
  touch.setBounds({ x: 0, y: 0, w: 320, h: 160 }, { stringFrets: 7 });

  const strum = touch.stringLayout.strumZone;
  touch.handlePointerDown({ id: 'test', x: strum.x + strum.w / 2, y: 40 });

  const noteOn = events.find((entry) => entry.type === 'noteon');
  assert.equal(noteOn?.event.instrument, 'bass');
  assert.notEqual(noteOn?.event.channel, 9);
});
