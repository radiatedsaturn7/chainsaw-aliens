import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import HUD from '../../src/ui/HUD.js';

const gameCoreSource = readFileSync(new URL('../../src/game/GameCore.js', import.meta.url), 'utf8');
const levelEditorSource = readFileSync(new URL('../../src/ui/LevelEditorCore.js', import.meta.url), 'utf8');
const midiComposerSource = readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const pixelStudioSource = readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8');
const sfxEditorSource = readFileSync(new URL('../../src/ui/SfxEditor.js', import.meta.url), 'utf8');

function methodBody(name, nextName) {
  const start = gameCoreSource.indexOf(`  ${name}(`);
  const end = gameCoreSource.indexOf(`  ${nextName}(`, start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return gameCoreSource.slice(start, end);
}

function levelMethodBody(name, nextName) {
  const start = levelEditorSource.indexOf(`  ${name}(`);
  const end = levelEditorSource.indexOf(`  ${nextName}(`, start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return levelEditorSource.slice(start, end);
}

function createRecordingContext() {
  const text = [];
  return {
    canvas: { width: 960, height: 540 },
    text,
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    rect() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    translate() {},
    fillText(value) { text.push(String(value)); },
    set globalAlpha(value) { this._globalAlpha = value; },
    get globalAlpha() { return this._globalAlpha ?? 1; },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
    set shadowColor(value) { this._shadowColor = value; },
    get shadowColor() { return this._shadowColor; },
    set shadowBlur(value) { this._shadowBlur = value; },
    get shadowBlur() { return this._shadowBlur; }
  };
}

function createPlayer() {
  return {
    health: 8,
    maxHealth: 10,
    animTime: 0,
    magBootsHeat: 0,
    magBootsOverheat: 0,
    attackTimer: 0,
    chainsawHeld: false,
    flameMode: false
  };
}

test('HUD can suppress objective text during gameplay', () => {
  const hud = new HUD();
  const hiddenCtx = createRecordingContext();
  hud.draw(hiddenCtx, createPlayer(), 'Reach the marker', { showObjective: false });

  assert.equal(hiddenCtx.text.some((line) => line.startsWith('Objective:')), false);

  const defaultCtx = createRecordingContext();
  hud.draw(defaultCtx, createPlayer(), 'Reach the marker', {});

  assert.equal(defaultCtx.text.some((line) => line === 'Objective: Reach the marker'), true);
});

test('gameplay draw suppresses objective and no longer draws credits text directly', () => {
  const drawBody = methodBody('_drawByState', 'drawVictory');

  assert.equal(gameCoreSource.includes('Credits: ${this.player.credits}'), false);
  assert.equal(drawBody.includes('showObjective: false'), true);
});

test('level editor playtest starts with debug overlays off', () => {
  const exitEditorBody = methodBody('exitEditor', 'returnToEditorFromPlaytest');

  assert.equal(exitEditorBody.includes('this.debugMode = false;'), true);
  assert.equal(exitEditorBody.includes('this.showCompanionPathDebug = false;'), true);
});

test('game start spawn pause does not play the upgrade spawn tune', () => {
  const spawnPauseBody = methodBody('startSpawnPause', 'snapCameraToPlayer');
  const pickupBody = methodBody('checkPickups', 'checkSavePoints');

  assert.equal(spawnPauseBody.includes('this.audio.spawnTune()'), false);
  assert.equal(spawnPauseBody.includes('this.spawnPauseTimer = 3;'), false);
  assert.equal(spawnPauseBody.includes('this.spawnPauseTimer = 0;'), true);
  assert.equal(spawnPauseBody.includes('Math.max(this.player.invulnTimer, 0.75)'), true);
  assert.equal(pickupBody.includes('this.audio.spawnTune()'), true);
});

test('gameplay viewport changes recenter the camera after mobile orientation flips', () => {
  const setViewportBody = methodBody('setViewport', 'syncMobileControlsViewport');
  const syncBody = methodBody('syncMobileControlsViewport', 'recenterCameraAfterViewportChange');
  const recenterBody = methodBody('recenterCameraAfterViewportChange', 'getPortraitHandheldLayout');

  assert.equal(setViewportBody.includes('const previousCameraWidth = this.camera?.width;'), true);
  assert.equal(setViewportBody.includes('this.recenterCameraAfterViewportChange(previousCameraWidth, previousCameraHeight);'), true);
  assert.equal(syncBody.includes('this.recenterCameraAfterViewportChange(previousCameraWidth, previousCameraHeight);'), true);
  assert.equal(recenterBody.includes("'playing'"), true);
  assert.equal(recenterBody.includes('this.snapCameraToPlayer();'), true);
});

test('level editor portrait menu button has no open-menu tooltip text', () => {
  assert.equal(levelEditorSource.includes('Open editor menu'), false);
});

test('level editor portrait menu button toggles the drawer and mobile tooltips stay off bottom overlay', () => {
  assert.equal(levelEditorSource.includes("this.drawer.open = !this.drawer.open"), true);
  assert.equal(levelEditorSource.includes("button.tooltip && !this.isMobileLayout()"), true);
  assert.equal(levelEditorSource.includes("!this.isMobileLayout() && this.tooltipTimer > 0 ? this.activeTooltip : ''"), true);
});

test('level editor adds in-panel portrait guidance for music and triggers', () => {
  assert.equal(levelEditorSource.includes('Zone Paint: choose a track, then drag a music area.'), true);
  assert.equal(levelEditorSource.includes('Triggers: Draw Trigger Zone, then drag a rectangle on the map.'), true);
});

test('level editor groups level management actions under settings and contextualizes decals', () => {
  assert.equal(levelEditorSource.includes("id: 'level-settings'"), true);
  assert.equal(levelEditorSource.includes("rootItem('level-settings', 'Settings')"), true);
  assert.equal(levelEditorSource.includes("hidden: !selected"), true);
  assert.equal(levelEditorSource.includes("buildContextRibbonActions()"), true);
});

test('level trigger editor touch scroll is handled before row selection', () => {
  const downBody = levelMethodBody('handlePointerDown', 'handlePointerMove');
  const upBody = levelMethodBody('handlePointerUp', 'handleGestureStart');
  const triggerScrollIndex = downBody.indexOf('this.triggerEditorScrollDrag = {');
  const firstClickIndex = downBody.indexOf('if (this.handleUIClick(payload.x, payload.y)) return;');
  const releaseIndex = upBody.indexOf('if (this.triggerEditorScrollDrag &&');
  const releaseBody = upBody.slice(releaseIndex, upBody.indexOf('if (this.panelScrollTapCandidate', releaseIndex));

  assert.notEqual(triggerScrollIndex, -1);
  assert.notEqual(firstClickIndex, -1);
  assert.ok(triggerScrollIndex < firstClickIndex);
  assert.equal(releaseBody.includes('this.triggerEditorScrollTapCandidate = null;'), true);
});

test('pixel editor exposes a selection contextual ribbon in portrait', () => {
  assert.equal(pixelStudioSource.includes("title: ''"), true);
  assert.equal(pixelStudioSource.includes("id: 'paste', label: 'Paste'"), true);
  assert.equal(pixelStudioSource.includes("this.selection.active"), true);
  assert.equal(pixelStudioSource.includes("drawSharedContextRibbon(ctx, ribbonBounds"), true);
});

test('sfx editor exposes selected layer contextual actions in portrait', () => {
  assert.equal(sfxEditorSource.includes("title: 'Layer'"), true);
  assert.equal(sfxEditorSource.includes("duplicate-layer"), true);
  assert.equal(sfxEditorSource.includes("drawSharedContextRibbon(ctx"), true);
});

test('midi portrait paths use real mixer and portrait record layout', () => {
  assert.equal(midiComposerSource.includes('getMidiPortraitSongRailLayout'), true);
  assert.equal(midiComposerSource.includes('getMidiPortraitRecordLayout'), true);
  assert.equal(midiComposerSource.includes('portraitMain: true'), true);
  assert.equal(midiComposerSource.includes("touchDensity: {\n          keyboardWhiteKeys: 8,\n          stringFrets: 7"), true);
  assert.equal(midiComposerSource.includes("this.drawButton(ctx, this.bounds.record, this.recorder.isRecording ? 'Stop Rec' : 'Record'"), true);
  assert.equal(midiComposerSource.includes("layoutMode: options.layoutMode || (options.isMobile && items.length > 4 ? 'auto-grid' : 'list')"), true);
  assert.equal(midiComposerSource.includes("portraitGrid: true"), true);
  assert.equal(midiComposerSource.includes("nav-pedals"), true);
  assert.equal(midiComposerSource.includes("drawMidiPortraitGridQuickStrip"), true);
  assert.equal(midiComposerSource.includes("showSettingsRail: false"), true);
  assert.equal(midiComposerSource.includes("hideInstrumentConfig: true"), true);
  assert.equal(midiComposerSource.includes("nowPlayingPlacement: 'preview'"), true);
  assert.equal(midiComposerSource.includes("drawMidiPortraitRecordSettingsPanel"), true);
  assert.equal(midiComposerSource.includes("record-tuning-string"), true);
  assert.equal(midiComposerSource.includes("cycleStringTuning"), true);
  assert.equal(midiComposerSource.includes("setRecordInstrument(action.value)"), true);
  assert.equal(midiComposerSource.includes("return ['guitar', 'bass', 'keyboard', 'drums'];"), true);
  assert.equal(midiComposerSource.includes("if (this.bounds.play && this.pointInBounds(x, y, this.bounds.play))"), true);
  assert.equal(midiComposerSource.includes("this.previewRecordStringPitch(instrument, tuning[stringIndex])"), true);
  assert.equal(midiComposerSource.includes("const pedalOverlayOpen = this.pedalUiState.pickerOpen || this.pedalUiState.editorOpen"), true);
  assert.equal(midiComposerSource.includes("if (!pedalOverlayOpen && (this.activeTab === 'instruments' || this.activeTab === 'pedals'))"), true);
  assert.equal(midiComposerSource.includes("async handleTrackControl(hit, pointerX = hit?.x, pointerY = hit?.y)"), true);
  assert.equal(midiComposerSource.includes("this.handleTrackControl(settingHit, x, y);"), true);
  assert.equal(midiComposerSource.includes("this.updateTrackControl(pointerX, pointerY);"), true);
  assert.equal(midiComposerSource.includes("getTrackBaseMix(track)"), true);
  assert.equal(midiComposerSource.includes("const mix = this.getTrackBaseMix(track);"), true);
  assert.equal(midiComposerSource.includes("if (this.instrumentPicker.mode) {\n        this.bounds.instrumentList = [];"), true);
  assert.equal(midiComposerSource.includes("if (this.instrumentPicker.mode && !modalOnly)"), true);
  assert.equal(midiComposerSource.includes("this.confirmOverlayOpen = true;"), true);
  assert.equal(midiComposerSource.includes("return this.qaOverlayOpen || this.confirmOverlayOpen || Boolean(this.instrumentPicker.mode);"), true);
  assert.equal(midiComposerSource.includes("resetInteractiveBoundsForFrame()"), true);
  assert.equal(midiComposerSource.includes("this.resetInteractiveBoundsForFrame();"), true);
  assert.equal(midiComposerSource.includes("this.trackControlBounds = [];"), true);
  assert.equal(midiComposerSource.includes("this.mobilePortraitMenuSheetBounds = null;"), true);
  assert.equal(midiComposerSource.includes("getMidiSongMusicControlSpecs({"), true);
  assert.equal(midiComposerSource.includes("noteLengthLabel: this.getNoteLengthDisplay(NOTE_LENGTH_OPTIONS[this.noteLengthIndex], true)"), true);
  assert.equal(midiComposerSource.includes("if (id === 'quantize')"), true);
  assert.equal(midiComposerSource.includes("this.noteLengthMenu.open = !this.noteLengthMenu.open;"), true);
  assert.equal(midiComposerSource.includes("this.noteLengthMenu.anchor = quantizeBounds ? { ...quantizeBounds } : null;"), true);
  assert.equal(midiComposerSource.includes("clamp(Math.round(width * 0.82), 280, width - 48)"), true);
  assert.equal(midiComposerSource.includes("key: 'songTransportRecord'"), false);
  assert.equal(midiComposerSource.includes("const navBounds = { x: panelX, y: panelY, w: panelW, h: 104 };"), false);
  assert.equal(midiComposerSource.includes("const mainWorkspaceTabs = ['grid', 'song', 'instruments', 'pedals'];"), true);
  assert.equal(midiComposerSource.includes("clearMidiPortraitDrawerBounds()"), true);
  assert.equal(midiComposerSource.includes("this.fileMenuListBounds = null;"), true);
  assert.equal(midiComposerSource.includes("if (!sheetOpen) {\n        this.clearMidiPortraitDrawerBounds();"), true);
  assert.equal(midiComposerSource.includes("const isPortraitMainWorkspace = isMobilePortraitLayout"), true);
  assert.equal(midiComposerSource.includes("const portraitSheetBlocksInput = this.mobilePortraitMenuSheetBounds"), true);
  assert.equal(midiComposerSource.includes("const footerLift = liftPickerFooter ? 56 : 0;"), true);
  assert.equal(midiComposerSource.includes("drawMobileBottomRail(ctx, x, y, w, h, track) {\n    this.bounds.railInstruments = null"), true);
  assert.equal(midiComposerSource.includes("const wahLike = pedal.type === 'wah';"), true);
  assert.equal(midiComposerSource.includes("balanceLastRow: true"), true);
  assert.equal(midiComposerSource.includes("getMidiPortraitFullScreenSheetLayout(width, height, { padding })"), true);
  assert.equal(midiComposerSource.includes("const fullScreenSheet = this.activeTab === 'file' || this.activeTab === 'settings';"), false);
  assert.equal(midiComposerSource.includes("getMidiPortraitControlLayout(width, height)"), true);
  assert.equal(midiComposerSource.includes("drawMidiHorizontalZoomSlider(ctx"), true);
  assert.equal(midiComposerSource.includes("this.drawMobilePortraitRootTabs(ctx, controlLayout.viewRail, track);"), true);
  assert.equal(midiComposerSource.includes("this.drawMidiPortraitGridQuickStrip(ctx, controlLayout.viewRail.x, controlLayout.viewRail.y, controlLayout.viewRail.w, controlLayout.viewRail.h, track);"), true);
  assert.equal(midiComposerSource.includes("portraitRailBounds: controlLayout.viewRail"), true);
  assert.equal(midiComposerSource.includes("this.dragState = { mode: 'slider', id: 'grid-zoom-x', bounds: this.bounds.railZoom };"), true);
  assert.equal(midiComposerSource.includes("this.settingsScroll = clamp(this.settingsScroll + payload.deltaY, 0, this.settingsScrollMax);"), true);
  assert.equal(midiComposerSource.includes("{ id: 'record-quantize', label: 'Quant'"), true);
  assert.equal(midiComposerSource.includes("{ id: 'record-countin', label: 'Count'"), true);
  assert.equal(midiComposerSource.includes("{ id: 'record-metronome', label: 'Click'"), true);
  assert.equal(midiComposerSource.includes("key: 'songTransportMetronome', label: 'M'"), true);
});

test('midi live wah pedal path is trimmed to avoid crackling', () => {
  const audioSource = readFileSync(new URL('../../src/game/Audio.js', import.meta.url), 'utf8');
  assert.equal(audioSource.includes('outputTrim.gain.value = enabled.length ? 0.82 : 1'), true);
  assert.equal(audioSource.includes('const hasPedals = Array.isArray(pedals) && pedals.some'), true);
  assert.equal(audioSource.includes('const clampedVolume = clamp(volume ?? 1, 0, hasPedals ? 0.82 : 1)'), true);
  assert.equal(audioSource.includes('filter.Q.value = 0.7 + clamp(knobs.mix ?? 0.7, 0, 1) * 2.6'), true);
  assert.equal(audioSource.includes('lfoGain.gain.value = 160 + clamp(knobs.sweep ?? 0.6, 0, 1) * 1150'), true);
});
