import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  default as CutsceneEditor,
  CutscenePlayer,
  clampCutscenePointForClip,
  computeCutsceneFitDimensions,
  collectCutsceneMidiRenderEvents,
  createDefaultCutscene,
  drawCutsceneDocument,
  getCutsceneMovieExportLayout,
  getCutsceneRenderProjection,
  getCutsceneTimelineLayout,
  getCutsceneMp4ExportFilename,
  getCutsceneSceneFadeAlpha,
  getVisualClipScreenBounds,
  normalizeCutsceneDocument,
  parseCutsceneDurationInput,
  resolveActorStateEvent,
  resolveCutsceneActorVisualDimensions,
  sampleCutsceneEffectClip,
  sampleCutsceneAudioVolume,
  sampleCutsceneClip,
  screenToCutscenePoint,
  selectCutsceneMovieRecordingMimeType,
  timelineMsToX,
  timelineXToMs
} from '../../src/ui/CutsceneEditor.js';
import { listProjectFiles, loadProjectFile, PROJECT_FOLDERS, resetProjectFilesForTests, saveProjectFile } from '../../src/ui/projectFiles.js';
import { listServerIndexedFiles } from '../../src/ui/serverStorage.js';
import {
  WEATHER_PROFILES,
  createWeatherRuntimeState,
  cutsceneEffectToWeather,
  updateWeatherSystem
} from '../../src/shared/weatherEffects.js';

const gameCoreSource = readFileSync(new URL('../../src/game/GameCore.js', import.meta.url), 'utf8');
const audioSource = readFileSync(new URL('../../src/game/Audio.js', import.meta.url), 'utf8');
const levelEditorSource = readFileSync(new URL('../../src/ui/LevelEditorCore.js', import.meta.url), 'utf8');
const cutsceneEditorSource = readFileSync(new URL('../../src/ui/CutsceneEditor.js', import.meta.url), 'utf8');

function createMockContext() {
  const state = {};
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (text) => ({ width: String(text || '').length * 8 });
      if (prop === 'canvas') return { width: 390, height: 844 };
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function createRecordingContext() {
  const calls = [];
  const state = {
    calls,
    fillStyle: '#000000',
    globalAlpha: 1,
    fillRect(x, y, w, h) {
      calls.push({ type: 'fillRect', fillStyle: state.fillStyle, globalAlpha: state.globalAlpha, x, y, w, h });
    },
    fillText(text, x, y, maxWidth) {
      calls.push({ type: 'fillText', fillStyle: state.fillStyle, globalAlpha: state.globalAlpha, text: String(text || ''), x, y, maxWidth });
    }
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (text) => ({ width: String(text || '').length * 8 });
      if (prop === 'canvas') return { width: 390, height: 844 };
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function pngDataUrl(width, height) {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff
  ]);
  return `data:image/png;base64,${header.toString('base64')}`;
}

function createMobileCutsceneEditor(game = {}) {
  return new CutsceneEditor({ isMobile: true, exitCutsceneEditor() {}, ...game });
}

test('cutscene project folder is registered', () => {
  assert.equal(PROJECT_FOLDERS.includes('cutscenes'), true);
  assert.equal(Object.hasOwn(listServerIndexedFiles(), 'cutscenes'), true);
});

test('cutscene documents normalize with default layers and editable clips', () => {
  const doc = normalizeCutsceneDocument({
    name: 'Intro',
    clips: [{
      id: 'title',
      type: 'text',
      text: 'Earth is out of ammo.',
      startMs: 100,
      durationMs: 1000
    }]
  });

  assert.equal(doc.name, 'Intro');
  assert.equal(doc.layers.some((layer) => layer.id === 'text'), true);
  assert.equal(doc.clips[0].type, 'text');
  assert.equal(doc.clips[0].fontSize, 8);
  assert.equal(doc.clips[0].keyframes.length, 0);
  assert.equal(Number.isFinite(doc.clips[0].x), true);
  assert.equal(Number.isFinite(doc.clips[0].y), true);
  assert.equal(doc.snapEnabled, true);
  assert.equal(doc.snapSize, 8);
});

test('cutscene documents normalize to schema v2 with safe arrays and new clip fields', () => {
  const doc = normalizeCutsceneDocument({
    schemaVersion: 1,
    assets: null,
    layers: null,
    clips: [{
      type: 'music',
      assetId: 'song',
      loop: true,
      volume: 0.4,
      fadeMs: 120
    }, {
      type: 'pause',
      startMs: 500,
      waitForInput: true
    }, {
      type: 'actor',
      actorRef: 'Skitter',
      stateId: 'walk',
      fadeInMs: 120,
      playAnimation: true,
      fx: { type: 'wave-x', amount: 0.5, frequency: 3, speed: 2 },
      stateEvents: [{ timeMs: 250, stateId: 'attack' }]
    }, {
      type: 'effect',
      effectType: 'blizzard',
      intensity: 0,
      wind: -2,
      opacity: 0.75,
      keyframes: [
        { timeMs: 500, intensity: 4, opacity: 1, wind: -1, manual: true },
        { timeMs: 1500, intensity: 0, opacity: 0, wind: 0, manual: true }
      ]
    }]
  });

  assert.equal(doc.schemaVersion, 2);
  assert.equal(Array.isArray(doc.assets), true);
  assert.equal(Array.isArray(doc.layers), true);
  assert.equal(Array.isArray(doc.clips), true);
  assert.equal(doc.clips[0].loop, true);
  assert.equal(doc.clips[0].volume, 0.4);
  assert.equal(doc.clips[0].fadeMs, 120);
  assert.equal(doc.clips[1].type, 'pause');
  assert.equal(doc.clips[2].type, 'actor');
  assert.equal(doc.clips[2].fadeInMs, 120);
  assert.equal(doc.clips[2].playAnimation, true);
  assert.equal(doc.clips[2].fx.type, 'wave-x');
  assert.equal(doc.clips[2].stateEvents[0].stateId, 'attack');
  assert.equal(doc.clips[3].type, 'effect');
  assert.equal(doc.clips[3].effectType, 'blizzard');
  assert.equal(doc.clips[3].intensity, 0);
  assert.equal(doc.clips[3].wind, -2);
  assert.equal(doc.clips[3].opacity, 0.75);
  assert.equal(doc.clips[3].keyframes.length, 2);
  assert.equal(doc.clips[3].keyframes[1].intensity, 0);
});

test('cutscene clip sampler holds base pose before first explicit key', () => {
  const doc = createDefaultCutscene('Sampler');
  const clip = normalizeCutsceneDocument({
    ...doc,
    clips: [{
      id: 'ship',
      type: 'image',
      startMs: 0,
      durationMs: 1000,
      x: 10,
      y: 20,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 16,
      h: 16,
      keyframes: [
        { timeMs: 1000, x: 110, y: 220, scale: 2, rotation: 1, opacity: 0.5, w: 32, h: 32, manual: true }
      ]
    }]
  }).clips[0];

  const sample = sampleCutsceneClip(clip, 500);
  assert.equal(Math.round(sample.x), 10);
  assert.equal(Math.round(sample.y), 20);
  assert.equal(sample.scale, 1);
  assert.equal(sample.rotation, 0);
  const keyed = sampleCutsceneClip(clip, 1000);
  assert.equal(Math.round(keyed.x), 110);
  assert.equal(Math.round(keyed.y), 220);
});

test('cutscene image fit dimensions fill matching aspect canvas', () => {
  assert.deepEqual(computeCutsceneFitDimensions(1536, 864, { width: 256, height: 144 }), { width: 256, height: 144 });
  assert.deepEqual(computeCutsceneFitDimensions(1536, 1536, { width: 256, height: 144 }), { width: 144, height: 144 });
});

test('cutscene visual transforms normalize independent axis scale', () => {
  const doc = normalizeCutsceneDocument({
    clips: [{
      id: 'image',
      type: 'image',
      startMs: 0,
      durationMs: 1000,
      x: 128,
      y: 72,
      w: 100,
      h: 50,
      scale: 1,
      scaleX: 2,
      scaleY: 0.5,
      aspectLocked: false
    }]
  });
  const sample = sampleCutsceneClip(doc.clips[0], 500);
  const bounds = getVisualClipScreenBounds(doc.clips[0], doc, 500, { x: 0, y: 0, w: 256, h: 144 });

  assert.equal(sample.scaleX, 2);
  assert.equal(sample.scaleY, 0.5);
  assert.equal(sample.aspectLocked, false);
  assert.equal(Math.round(bounds.w), 200);
  assert.equal(Math.round(bounds.h), 25);
});

test('cutscene clip sampler applies explicit visual fade settings', () => {
  const doc = createDefaultCutscene('Fade');
  const clip = normalizeCutsceneDocument({
    ...doc,
    clips: [{
      id: 'ship',
      type: 'art',
      startMs: 0,
      durationMs: 1000,
      fadeInMs: 500,
      fadeOutMs: 250,
      keyframes: [
        { timeMs: 0, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, w: 16, h: 16 },
        { timeMs: 1000, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, w: 16, h: 16 }
      ]
    }]
  }).clips[0];

  assert.equal(sampleCutsceneClip(clip, 250).opacity, 0.5);
  assert.equal(sampleCutsceneClip(clip, 900).opacity, 0.4);
});

test('cutscene color boards normalize and render with sampled opacity', () => {
  const doc = normalizeCutsceneDocument({
    width: 256,
    height: 144,
    clips: [{
      id: 'board',
      type: 'color-board',
      color: '#123456',
      startMs: 0,
      durationMs: 1000,
      keyframes: [
        { timeMs: 0, x: 128, y: 72, scale: 1, rotation: 0, opacity: 0.25, w: 256, h: 144, manual: true },
        { timeMs: 1000, x: 128, y: 72, scale: 1, rotation: 0, opacity: 0.75, w: 256, h: 144, manual: true }
      ]
    }]
  });
  const clip = doc.clips[0];
  const sample = sampleCutsceneClip(clip, 500);
  const ctx = createRecordingContext();

  drawCutsceneDocument(ctx, doc, 500, { x: 0, y: 0, w: 256, h: 144 });

  const boardDraw = ctx.calls.find((call) => call.fillStyle === '#123456');
  assert.equal(clip.type, 'color-board');
  assert.equal(clip.w, 256);
  assert.equal(clip.h, 144);
  assert.equal(sample.opacity, 0.5);
  assert.equal(Boolean(boardDraw), true);
  assert.equal(boardDraw.globalAlpha, 0.5);
});

test('cutscene draw order uses top timeline tracks as top visual layers', () => {
  const doc = normalizeCutsceneDocument({
    width: 256,
    height: 144,
    tracks: [
      { id: 'top', name: 'Top Board' },
      { id: 'bottom', name: 'Bottom Board' }
    ],
    clips: [{
      id: 'top-board',
      type: 'color-board',
      color: '#000000',
      trackId: 'top',
      startMs: 0,
      durationMs: 1000,
      opacity: 1
    }, {
      id: 'bottom-board',
      type: 'color-board',
      color: '#ffffff',
      trackId: 'bottom',
      startMs: 0,
      durationMs: 1000,
      opacity: 1
    }]
  });
  const ctx = createRecordingContext();

  drawCutsceneDocument(ctx, doc, 500, { x: 0, y: 0, w: 256, h: 144 });

  const bottomIndex = ctx.calls.findIndex((call) => call.fillStyle === '#ffffff');
  const topIndex = ctx.calls.findIndex((call) => call.fillStyle === '#000000');
  assert.equal(bottomIndex >= 0, true);
  assert.equal(topIndex >= 0, true);
  assert.equal(topIndex > bottomIndex, true);
});

test('cutscene color board opacity keyframes use local clip time', () => {
  const doc = normalizeCutsceneDocument({
    width: 256,
    height: 144,
    clips: [{
      id: 'fade-board',
      type: 'color-board',
      color: '#000000',
      startMs: 1000,
      durationMs: 1000,
      opacity: 0,
      keyframes: [
        { timeMs: 0, x: 128, y: 72, scale: 1, rotation: 0, opacity: 0, w: 256, h: 144, manual: true },
        { timeMs: 1000, x: 128, y: 72, scale: 1, rotation: 0, opacity: 1, w: 256, h: 144, manual: true }
      ]
    }]
  });

  assert.equal(sampleCutsceneClip(doc.clips[0], 1000).opacity, 0);
  assert.equal(sampleCutsceneClip(doc.clips[0], 1500).opacity, 0.5);
  assert.equal(sampleCutsceneClip(doc.clips[0], 2000).opacity, 1);
});

test('cutscene scene transitions fade the full stage from and to black', () => {
  const doc = normalizeCutsceneDocument({
    durationMs: 2000,
    sceneFadeInMs: 500,
    sceneFadeOutMs: 400,
    clips: []
  });

  assert.equal(doc.sceneFadeInMs, 500);
  assert.equal(doc.sceneFadeOutMs, 400);
  assert.equal(getCutsceneSceneFadeAlpha(doc, 0), 1);
  assert.equal(getCutsceneSceneFadeAlpha(doc, 250), 0.5);
  assert.equal(getCutsceneSceneFadeAlpha(doc, 1000), 0);
  assert.equal(getCutsceneSceneFadeAlpha(doc, 1800), 0.5);
  assert.equal(getCutsceneSceneFadeAlpha(doc, 2000), 1);
});

test('cutscene document draws scene transition black overlay', () => {
  const ctx = createMockContext();
  const fills = [];
  ctx.fillRect = (x, y, w, h) => fills.push({ x, y, w, h, fillStyle: ctx.fillStyle });
  const doc = normalizeCutsceneDocument({
    durationMs: 1000,
    sceneFadeInMs: 500,
    clips: []
  });

  drawCutsceneDocument(ctx, doc, 250, { x: 0, y: 0, w: 256, h: 144 });

  assert.equal(fills.some((entry) => entry.fillStyle === 'rgba(0,0,0,0.5)' && entry.w === 256 && entry.h === 144), true);
});

test('cutscene timeline hit testing uses inner object track bounds', () => {
  const layout = getCutsceneTimelineLayout({ x: 10, y: 20, w: 390, h: 140 }, 6000, [
    { id: 'art-1', type: 'art', assetRef: 'hero' },
    { id: 'text-1', type: 'text', text: 'Hello' }
  ]);
  assert.equal(timelineXToMs(layout.track.x, layout), 0);
  assert.equal(Math.round(timelineXToMs(layout.track.x + layout.track.w / 2, layout)), 3000);
  assert.equal(timelineXToMs(layout.track.x + layout.track.w, layout), 6000);
  assert.equal(layout.laneBounds.length, 2);
  assert.equal(layout.laneBounds[0].clipId, 'art-1');
});

test('cutscene timeline viewport zoom maps visible time range', () => {
  const layout = getCutsceneTimelineLayout({ x: 10, y: 20, w: 390, h: 140 }, 6000, [
    { id: 'art-1', type: 'art', assetRef: 'hero' }
  ], { zoomX: 3, scrollMs: 1000 });

  assert.equal(layout.visibleStartMs, 1000);
  assert.equal(layout.visibleEndMs, 3000);
  assert.equal(timelineXToMs(layout.track.x, layout), 1000);
  assert.equal(timelineXToMs(layout.track.x + layout.track.w, layout), 3000);
  assert.equal(Math.round(timelineXToMs(timelineMsToX(1800, layout), layout)), 1800);
});

test('cutscene editor timeline zoom buttons preserve selected clip focus', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'clip-1', type: 'text', startMs: 1500, durationMs: 1000, text: 'Focus' }]
  });
  editor.selectedClipId = 'clip-1';
  editor.timelineZoomX = 2;
  editor.timelineScrollMs = 1000;

  editor.adjustTimelineZoom(2);

  assert.equal(editor.timelineZoomX, 4);
  assert.equal(editor.timelineScrollMs, 1500);
});

test('cutscene editor open focuses first clip content instead of empty timeline origin', () => {
  const editor = createMobileCutsceneEditor();

  editor.applyDocument({
    durationMs: 6000,
    clips: [
      { id: 'late', type: 'text', startMs: 3000, durationMs: 500, text: 'Late' },
      { id: 'early', type: 'text', startMs: 1200, durationMs: 600, text: 'Early' }
    ]
  }, 'focus-test');

  assert.equal(editor.selectedClipId, 'early');
  assert.equal(editor.playheadMs, 1200);
  assert.equal(editor.timelineScrollTrack, 1);
});

test('cutscene timeline viewport exposes only scrolled visible tracks', () => {
  const clips = Array.from({ length: 8 }, (_, index) => ({ id: `clip-${index}`, type: 'text', text: `Clip ${index}` }));
  const layout = getCutsceneTimelineLayout({ x: 10, y: 20, w: 390, h: 140 }, 6000, clips, {
    zoomX: 1,
    scrollTrack: 3,
    minLaneHeight: 30
  });

  assert.equal(layout.scrollTrack, 3);
  assert.equal(layout.laneBounds[0].clipId, 'clip-3');
  assert.equal(layout.laneBounds.length < clips.length, true);
  assert.equal(layout.maxScrollTrack > 0, true);
});

test('cutscene document draws effect clips and preserves pixelated scaling', () => {
  const ctx = createMockContext();
  const doc = normalizeCutsceneDocument({
    durationMs: 3000,
    clips: [{
      id: 'rain',
      type: 'effect',
      effectType: 'rain',
      startMs: 0,
      durationMs: 3000,
      intensity: 0.5
    }]
  });

  drawCutsceneDocument(ctx, doc, 1000, { x: 0, y: 0, w: 300, h: 180 });

  assert.equal(ctx.imageSmoothingEnabled, false);
});

test('cutscene visual stage helpers preserve drag offsets and offscreen clamp', () => {
  const doc = normalizeCutsceneDocument({
    width: 200,
    height: 100,
    clips: [{
      id: 'large',
      type: 'actor',
      startMs: 0,
      durationMs: 1000,
      x: 100,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 120,
      h: 80
    }]
  });
  const clip = doc.clips[0];
  const bounds = getVisualClipScreenBounds(clip, doc, 0, { x: 0, y: 0, w: 400, h: 200 });
  const touched = screenToCutscenePoint(bounds.x + 10, bounds.y + 10, {
    stageRect: { x: 0, y: 0, w: 400, h: 200 },
    scale: 2
  });
  const anchorX = clip.x - touched.x;
  const anchorY = clip.y - touched.y;

  assert.notEqual(anchorX, 0);
  assert.notEqual(anchorY, 0);
  assert.deepEqual(clampCutscenePointForClip({ x: -1000, y: -1000 }, clip, clip, doc), { x: -60, y: -40 });
  assert.deepEqual(clampCutscenePointForClip({ x: 1000, y: 1000 }, clip, clip, doc), { x: 260, y: 140 });
});

test('actor state events resolve latest state before local time', () => {
  const clip = normalizeCutsceneDocument({
    clips: [{
      type: 'actor',
      stateId: 'idle',
      stateEvents: [
        { timeMs: 0, stateId: 'idle' },
        { timeMs: 500, stateId: 'attack' },
        { timeMs: 900, stateId: 'idle' }
      ]
    }]
  }).clips[0];

  assert.equal(resolveActorStateEvent(clip, 10).stateId, 'idle');
  assert.equal(resolveActorStateEvent(clip, 650).stateId, 'attack');
  assert.equal(resolveActorStateEvent(clip, 1200).stateId, 'idle');
});

test('cutscene actor visual dimensions match gameplay authored-size rules', () => {
  const autoActor = {
    name: 'Auto Actor',
    size: { width: 24, height: 24 },
    states: [{ id: 'idle', animation: { imageDataUrl: pngDataUrl(48, 32) } }]
  };
  const manualActor = {
    name: 'Manual Actor',
    sizeMode: 'manual',
    size: { width: 80, height: 44 },
    states: [{ id: 'idle', animation: { imageDataUrl: pngDataUrl(48, 32) } }]
  };
  const sizedActor = {
    name: 'Sized Actor',
    size: { width: 30, height: 28 },
    states: [{ id: 'idle', animation: { imageDataUrl: pngDataUrl(48, 32) } }]
  };

  assert.deepEqual(resolveCutsceneActorVisualDimensions(autoActor, 'idle'), { width: 48, height: 32 });
  assert.deepEqual(resolveCutsceneActorVisualDimensions(manualActor, 'idle'), { width: 80, height: 44 });
  assert.deepEqual(resolveCutsceneActorVisualDimensions(sizedActor, 'idle'), { width: 30, height: 28 });
});

test('cutscene player completes and calls onDone', () => {
  const player = new CutscenePlayer({});
  let done = false;
  player.play({ durationMs: 500, clips: [] }, { onDone: () => { done = true; } });
  player.update(0.6);

  assert.equal(player.active, false);
  assert.equal(done, true);
});

test('cutscene player calls onDone at most once', () => {
  const player = new CutscenePlayer({});
  let count = 0;
  player.play({ durationMs: 500, clips: [] }, { onDone: () => { count += 1; } });
  player.stop();
  player.stop();

  assert.equal(count, 1);
});

test('cutscene player supports pause markers and resumes on input', () => {
  const player = new CutscenePlayer({});
  player.play({
    durationMs: 1000,
    clips: [{ id: 'pause-1', type: 'pause', startMs: 100, waitForInput: true }]
  });

  player.update(0.2);
  assert.equal(player.active, true);
  assert.equal(player.timeMs, 100);
  assert.equal(player.handleInput({ wasPressed: (id) => id === 'attack' }), true);
  player.update(0.95);
  assert.equal(player.active, false);
});

test('cutscene player fires zero-time MIDI before waiting for input', () => {
  const events = [];
  const player = new CutscenePlayer({
    playCutsceneMidi(ref, options) { events.push(['play', ref, options.volume]); }
  });
  player.play({
    durationMs: 1000,
    assets: [{ id: 'asset-1', type: 'music', ref: 'Intro' }],
    clips: [
      { id: 'music-1', type: 'music', assetId: 'asset-1', startMs: 0, durationMs: 1000, volume: 0.75 },
      { id: 'pause-1', type: 'pause', startMs: 100, waitForInput: true }
    ]
  });

  assert.deepEqual(events, [['play', 'Intro', 0.75]]);
  player.update(0.2);

  assert.deepEqual(events, [['play', 'Intro', 0.75]]);
  assert.equal(player.timeMs, 100);
  assert.equal(player.waitingPauseClipId, 'pause-1');
});

test('cutscene player starts overlapping music at trackhead offset and skips prior one-shot sfx', () => {
  const events = [];
  const player = new CutscenePlayer({
    playCutsceneMidi(ref, options) { events.push(['music', ref, options.offsetMs]); },
    playSfxById(ref) { events.push(['sfx', ref]); }
  });
  player.play({
    durationMs: 2000,
    assets: [
      { id: 'music-asset', type: 'music', ref: 'Theme' },
      { id: 'sfx-asset', type: 'sfx', ref: 'Boom' }
    ],
    clips: [
      { id: 'music-1', type: 'music', assetId: 'music-asset', startMs: 0, durationMs: 1200, volume: 1 },
      { id: 'sfx-1', type: 'sfx', assetId: 'sfx-asset', startMs: 200, durationMs: 100, loop: false }
    ]
  }, { startMs: 500 });

  player.update(0.01);

  assert.deepEqual(events, [['music', 'Theme', 500]]);
});

test('cutscene player starts overlapping looped sfx when preview starts inside it', () => {
  const events = [];
  const player = new CutscenePlayer({
    playSfxById(ref, options) { events.push(['sfx', ref, options.loop]); }
  });
  player.play({
    durationMs: 2000,
    assets: [{ id: 'sfx-asset', type: 'sfx', ref: 'Wind' }],
    clips: [{ id: 'sfx-1', type: 'sfx', assetId: 'sfx-asset', startMs: 200, durationMs: 1000, loop: true }]
  }, { startMs: 500 });

  player.update(0.01);

  assert.deepEqual(events, [['sfx', 'Wind', true]]);
});

test('cutscene player does not fire audio scheduled after a pause before input resumes', () => {
  const events = [];
  const player = new CutscenePlayer({
    playSfxById(ref) { events.push(ref); }
  });
  player.play({
    durationMs: 1000,
    assets: [
      { id: 'asset-early', type: 'sfx', ref: 'Early' },
      { id: 'asset-late', type: 'sfx', ref: 'Late' }
    ],
    clips: [
      { id: 'sfx-early', type: 'sfx', assetId: 'asset-early', startMs: 0, durationMs: 50 },
      { id: 'pause-1', type: 'pause', startMs: 100, waitForInput: true },
      { id: 'sfx-late', type: 'sfx', assetId: 'asset-late', startMs: 150, durationMs: 50 }
    ]
  });

  player.update(0.2);
  assert.deepEqual(events, ['Early']);

  player.handleInput({ wasPressed: (id) => id === 'attack' });
  player.update(0.06);
  assert.deepEqual(events, ['Early', 'Late']);
});

test('cutscene player starts and stops looped sfx clips', () => {
  const events = [];
  const player = new CutscenePlayer({
    playSfxById(ref, options) { events.push(['play', ref, options.loop, options.key]); },
    stopSfxById(ref) { events.push(['stop', ref]); }
  });
  player.play({
    durationMs: 1000,
    assets: [{ id: 'asset-1', type: 'sfx', ref: 'Boom' }],
    clips: [{ id: 'sfx-1', type: 'sfx', assetId: 'asset-1', startMs: 0, durationMs: 100, loop: true }]
  });

  player.update(0.01);
  player.update(0.2);

  assert.deepEqual(events[0], ['play', 'Boom', true, 'sfx-1']);
  assert.deepEqual(events[1], ['stop', 'Boom']);
});

test('cutscene player stops music clips at their timeline end', () => {
  const events = [];
  const player = new CutscenePlayer({
    playActorMidi(ref, options) { events.push(['play', ref, options.volume]); },
    stopActorMidi(ref) { events.push(['stop', ref]); }
  });
  player.play({
    durationMs: 1000,
    assets: [{ id: 'asset-1', type: 'music', ref: 'Theme' }],
    clips: [{ id: 'music-1', type: 'music', assetId: 'asset-1', startMs: 0, durationMs: 100, volume: 0.5 }]
  });

  player.update(0.01);
  player.update(0.2);

  assert.deepEqual(events[0], ['play', 'Theme', 0.5]);
  assert.deepEqual(events[1], ['stop', 'Theme']);
});

test('cutscene player prefers cutscene MIDI ownership APIs in game runtime', () => {
  const events = [];
  const player = new CutscenePlayer({
    playCutsceneMidi(ref, options) { events.push(['play-cutscene', ref, options.volume]); },
    stopCutsceneMidi(ref) { events.push(['stop-cutscene', ref]); },
    playActorMidi(ref) { events.push(['play-actor', ref]); },
    stopActorMidi(ref) { events.push(['stop-actor', ref]); }
  });
  player.play({
    durationMs: 1000,
    assets: [{ id: 'asset-1', type: 'music', ref: 'Theme' }],
    clips: [{ id: 'music-1', type: 'music', assetId: 'asset-1', startMs: 0, durationMs: 100, volume: 0.5 }]
  });

  player.update(0.01);
  player.update(0.2);

  assert.deepEqual(events, [
    ['play-cutscene', 'Theme', 0.5],
    ['stop-cutscene', 'Theme']
  ]);
});


test('cutscene editor draws safely on tiny and mobile viewports', () => {
  const editor = new CutsceneEditor({ isMobile: true, exitCutsceneEditor() {} });
  const ctx = createMockContext();

  assert.doesNotThrow(() => editor.draw(ctx, 1, 1));
  assert.doesNotThrow(() => editor.draw(ctx, 390, 844));
  assert.doesNotThrow(() => editor.draw(ctx, 844, 390));
});

test('cutscene editor starts with canvas and timeline visible instead of menu open', () => {
  const editor = new CutsceneEditor({ isMobile: true, exitCutsceneEditor() {} });
  editor.resetToFileMenu();
  const ctx = createMockContext();
  editor.draw(ctx, 390, 844);

  assert.equal(editor.menuOpen, false);
  assert.ok(editor.bounds.stage?.h > 0);
  assert.ok(editor.bounds.timelineTrack?.w > 0);
});

test('cutscene editor workspace view controls switch canvas and timeline modes', async () => {
  const editor = new CutsceneEditor({ isMobile: true, exitCutsceneEditor() {} });

  editor.handleButton('view-timeline');
  await editor.pendingAction;
  assert.equal(editor.workspaceMode, 'timeline');
  let layout = editor.computeLayout(390, 844);
  assert.equal(layout.timelineBounds.h > layout.stageBounds.h, true);

  editor.handleButton('view-canvas');
  await editor.pendingAction;
  assert.equal(editor.workspaceMode, 'canvas');
  layout = editor.computeLayout(390, 844);
  assert.equal(layout.stageBounds.h > layout.timelineBounds.h, true);

  editor.handleButton('view-split');
  await editor.pendingAction;
  assert.equal(editor.workspaceMode, 'split');
});

test('cutscene editor empty timeline drag pans zoomed time and tracks', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: Array.from({ length: 20 }, (_, index) => ({
      id: `clip-${index}`,
      type: 'text',
      text: `Clip ${index}`,
      startMs: 500,
      durationMs: 1000
    }))
  });
  editor.timelineZoomX = 3;
  editor.workspaceMode = 'timeline';
  editor.draw(createMockContext(), 390, 844);
  const track = editor.bounds.timelineTrack;
  const beforeMs = editor.timelineScrollMs;
  const beforeTrack = editor.timelineScrollTrack;

  editor.handlePointerDown({ x: track.x + track.w - 8, y: track.y + 80 });
  editor.handlePointerMove({ x: track.x + 20, y: track.y + 62 });
  editor.handlePointerUp();

  assert.equal(editor.timelineScrollMs > beforeMs, true);
  assert.equal(editor.timelineScrollTrack >= beforeTrack, true);
  assert.equal(Number.isInteger(editor.timelineScrollTrack), false);
});

test('cutscene timeline layout supports fractional vertical track scroll', () => {
  const clips = Array.from({ length: 8 }, (_, index) => ({ id: `clip-${index}`, type: 'text', text: `Clip ${index}` }));
  const layout = getCutsceneTimelineLayout({ x: 0, y: 0, w: 320, h: 180 }, 6000, clips, {
    zoomX: 1,
    scrollTrack: 1.5,
    minLaneHeight: 30
  });

  assert.equal(layout.scrollTrack, 1.5);
  assert.equal(layout.scrollTrackIndex, 1);
  assert.equal(layout.scrollTrackOffset, 0.5);
  assert.equal(layout.laneBounds[0].index, 1);
  assert.equal(layout.laneBounds[0].bounds.y < layout.track.y, true);
});

test('cutscene editor thumbstick down pans down through tracks smoothly', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: Array.from({ length: 10 }, (_, index) => ({
      id: `clip-${index}`,
      type: 'text',
      text: `Clip ${index}`,
      durationMs: 1000
    }))
  });
  editor.workspaceMode = 'timeline';
  editor.bounds.timeline = { x: 0, y: 0, w: 320, h: 150 };
  editor.panJoystick.active = true;
  editor.panJoystick.dx = 0;
  editor.panJoystick.dy = 1;
  const before = editor.timelineScrollTrack;

  editor.update({}, 0.25);

  assert.equal(editor.timelineScrollTrack > before, true);
  assert.equal(Number.isInteger(editor.timelineScrollTrack), false);
});

test('cutscene editor playhead key mode creates a local keyframe', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 1000,
      durationMs: 2000,
      x: 20,
      y: 20,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 20,
      h: 20
    }]
  });
  editor.selectedClipId = 'actor';
  editor.keyframeMode = 'playhead';
  editor.playheadMs = 1750;

  editor.setSelectedKeyframe('playhead');

  assert.equal(editor.getSelectedClip().keyframes.length, 1);
  assert.equal(editor.getSelectedClip().keyframes.some((keyframe) => keyframe.timeMs === 750), true);
  assert.deepEqual(editor.selectedKeyframe, { clipId: 'actor', timeMs: 750 });
});

test('cutscene editor start key updates hidden base pose and end creates a visible key', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      startMs: 100,
      durationMs: 1200,
      x: 30,
      y: 40,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 60,
      h: 20
    }]
  });
  editor.selectedClipId = 'text';
  editor.playheadMs = 700;

  editor.setSelectedKeyframe('start');
  assert.deepEqual(editor.getSelectedClip().keyframes.map((keyframe) => keyframe.timeMs), []);
  assert.equal(editor.selectedKeyframe, null);
  assert.equal(editor.playheadMs, 100);

  editor.setSelectedKeyframe('end');
  assert.deepEqual(editor.getSelectedClip().keyframes.map((keyframe) => keyframe.timeMs), [1200]);
  assert.equal(editor.getSelectedClip().keyframes.every((keyframe) => keyframe.manual === true), true);
});

test('cutscene visual keyframes normalize to sparse manual keys without implicit endpoints', () => {
  const doc = normalizeCutsceneDocument({
    clips: [{
      id: 'text-1',
      type: 'text',
      durationMs: 2400,
      keyframes: [
        { timeMs: 0, x: 10, y: 10, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, autoHold: true },
        { timeMs: 0, x: 20, y: 20, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20 },
        { timeMs: 1000, x: 40, y: 40, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20 },
        { timeMs: 1500, x: 60, y: 60, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true },
        { timeMs: 2400, x: 80, y: 80, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20 }
      ]
    }]
  });

  const keyTimes = doc.clips[0].keyframes.map((keyframe) => keyframe.timeMs);
  assert.deepEqual(keyTimes, [1500]);
  assert.equal(doc.clips[0].x, 10);
  assert.equal(doc.clips[0].y, 10);
});

test('cutscene editor selects and deletes sparse explicit keyframes', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 100,
      durationMs: 1200,
      x: 20,
      y: 20,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 20,
      h: 20,
      keyframes: [
        { timeMs: 600, x: 80, y: 60, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true }
      ]
    }]
  });
  editor.selectedClipId = 'actor';

  editor.deleteSelectedKeyframe();
  assert.equal(editor.getSelectedClip().keyframes.length, 1);
  assert.equal(editor.statusText, 'Select a keyframe first');

  editor.selectKeyframe(editor.getSelectedClip(), 600);
  editor.deleteSelectedKeyframe();
  assert.deepEqual(editor.getSelectedClip().keyframes.map((keyframe) => keyframe.timeMs), []);
  assert.equal(sampleCutsceneClip(editor.getSelectedClip(), 200).x, 20);
  assert.equal(sampleCutsceneClip(editor.getSelectedClip(), 200).y, 20);
});

test('cutscene editor keyframe markers select keys and move the playhead', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 100,
      durationMs: 1200,
      keyframes: [
        { timeMs: 600, x: 80, y: 60, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true },
        { timeMs: 1200, x: 140, y: 100, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true }
      ]
    }]
  });
  editor.selectedClipId = 'actor';
  editor.draw(createMockContext(), 390, 844);
  const marker = editor.bounds.keyframes.find((entry) => entry.id === 'actor' && entry.timeMs === 600);

  editor.handlePointerDown({ x: marker.x + marker.w / 2, y: marker.y + marker.h / 2 });

  assert.deepEqual(editor.selectedKeyframe, { clipId: 'actor', timeMs: 600 });
  assert.equal(editor.playheadMs, 700);
});

test('cutscene editor tapping visual clips selects without creating keyframes', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 0,
      durationMs: 1200,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 20,
      h: 20,
      keyframes: [
        { timeMs: 600, x: 80, y: 60, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true }
      ]
    }]
  });
  editor.playheadMs = 300;
  editor.draw(createMockContext(), 390, 844);
  const hit = editor.bounds.visualClips.find((entry) => entry.id === 'actor');

  editor.handlePointerDown({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
  editor.handlePointerUp();

  assert.equal(editor.selectedClipId, 'actor');
  assert.equal(editor.selectedKeyframe, null);
  assert.deepEqual(editor.getSelectedClip().keyframes.map((keyframe) => keyframe.timeMs), [600]);
});

test('cutscene editor empty stage taps deselect without moving clips', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      startMs: 0,
      durationMs: 1200,
      text: 'Move',
      x: 128,
      y: 72,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 40,
      h: 16
    }]
  });
  editor.selectedClipId = 'text';
  editor.draw(createMockContext(), 390, 844);

  editor.handlePointerDown({ x: editor.bounds.stage.x + 4, y: editor.bounds.stage.y + 4 });
  editor.handlePointerUp();

  assert.equal(editor.selectedClipId, null);
  assert.equal(editor.selectedKeyframe, null);
  assert.equal(editor.document.clips[0].x, 128);
  assert.equal(editor.document.clips[0].y, 72);
});

test('cutscene editor tapping selected clips keeps selection without opening actions', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      text: 'Hold',
      x: 64,
      y: 64,
      w: 32,
      h: 16
    }]
  });
  editor.selectedClipId = 'text';
  editor.draw(createMockContext(), 390, 844);
  const outline = editor.bounds.stageSelection[0];

  editor.handlePointerDown({ x: outline.x + outline.w / 2, y: outline.y + outline.h / 2 });
  editor.handlePointerUp();

  assert.equal(editor.selectedClipId, 'text');
  assert.equal(editor.menuOpen, false);
  assert.equal(editor.document.clips[0].x, 64);
  assert.equal(editor.document.clips[0].y, 64);
});

test('cutscene editor dragging clips with no keyframes moves base pose only', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      startMs: 0,
      durationMs: 1200,
      text: 'Move',
      x: 30,
      y: 40,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 60,
      h: 20
    }]
  });
  editor.draw(createMockContext(), 390, 844);
  const hit = editor.bounds.visualClips.find((entry) => entry.id === 'text');

  editor.handlePointerDown({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
  editor.handlePointerMove({ x: hit.x + hit.w / 2 + 40, y: hit.y + hit.h / 2 + 20 });
  editor.handlePointerUp();

  assert.equal(editor.getSelectedClip().keyframes.length, 0);
  assert.notEqual(editor.getSelectedClip().x, 30);
  assert.notEqual(editor.getSelectedClip().y, 40);
});

test('cutscene editor dragging with an active keyframe moves the keyframe only', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    snapEnabled: false,
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 0,
      durationMs: 1200,
      x: 30,
      y: 40,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 24,
      h: 24,
      keyframes: [
        { timeMs: 600, x: 80, y: 70, scale: 1, rotation: 0, opacity: 1, w: 24, h: 24, manual: true }
      ]
    }]
  });
  editor.selectedClipId = 'actor';
  editor.selectKeyframe(editor.getSelectedClip(), 600);
  editor.playheadMs = 600;
  editor.draw(createMockContext(), 390, 844);
  const outline = editor.bounds.stageSelection[0];
  const grabX = outline.x + outline.w / 2;
  const grabY = outline.y + outline.h / 2;

  editor.handlePointerDown({ x: grabX, y: grabY });
  editor.handlePointerMove({ x: grabX + 24, y: grabY + 16 });
  editor.handlePointerUp();

  assert.equal(editor.getSelectedClip().x, 30);
  assert.equal(editor.getSelectedClip().y, 40);
  assert.notEqual(editor.getSelectedClip().keyframes[0].x, 80);
  assert.notEqual(editor.getSelectedClip().keyframes[0].y, 70);
});

test('cutscene editor draws an outline for selected visual clips', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      text: 'Meanwhile...',
      x: 128,
      y: 72,
      w: 80,
      h: 16,
      scaleX: 1.5,
      scaleY: 0.5
    }, {
      id: 'music',
      type: 'music',
      startMs: 0,
      durationMs: 1000
    }]
  });
  editor.selectedClipId = 'text';
  editor.draw(createMockContext(), 390, 844);

  assert.equal(editor.bounds.stageSelection.length, 1);
  assert.equal(editor.bounds.stageSelection[0].id, 'text');
  assert.equal(Math.round(editor.bounds.stageSelection[0].w) > Math.round(editor.bounds.stageSelection[0].h), true);

  editor.selectedClipId = 'music';
  editor.draw(createMockContext(), 390, 844);
  assert.equal(editor.bounds.stageSelection.length, 0);
});

test('cutscene editor selected outline is expanded and draggable', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    snapEnabled: false,
    clips: [{
      id: 'text',
      type: 'text',
      text: 'Meanwhile...',
      x: 40,
      y: 40,
      w: 32,
      h: 12
    }]
  });
  editor.selectedClipId = 'text';
  editor.draw(createMockContext(), 390, 844);
  const outline = editor.bounds.stageSelection[0];

  assert.equal(outline.w > outline.visualW, true);
  assert.equal(outline.h > outline.visualH, true);

  editor.handlePointerDown({ x: outline.x + 2, y: outline.y + 2 });
  editor.handlePointerMove({ x: outline.x + 42, y: outline.y + 18 });
  editor.handlePointerUp();

  assert.equal(editor.getSelectedClip().keyframes.length, 0);
  assert.notEqual(editor.getSelectedClip().x, 40);
});

test('cutscene editor stage movement snaps and can be disabled', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    snapEnabled: true,
    snapSize: 8,
    clips: [{
      id: 'text',
      type: 'text',
      text: 'Move',
      x: 40,
      y: 40,
      w: 32,
      h: 12
    }]
  });
  editor.selectedClipId = 'text';
  editor.draw(createMockContext(), 390, 844);
  let outline = editor.bounds.stageSelection[0];

  editor.handlePointerDown({ x: outline.x + outline.w / 2, y: outline.y + outline.h / 2 });
  editor.handlePointerMove({ x: outline.x + outline.w / 2 + 13, y: outline.y + outline.h / 2 + 13 });
  editor.handlePointerUp();

  assert.equal(editor.getSelectedClip().x % 8, 0);
  assert.equal(editor.getSelectedClip().y % 8, 0);

  editor.toggleStageSnap();
  editor.draw(createMockContext(), 390, 844);
  outline = editor.bounds.stageSelection[0];
  editor.handlePointerDown({ x: outline.x + outline.w / 2, y: outline.y + outline.h / 2 });
  editor.handlePointerMove({ x: outline.x + outline.w / 2 + 5, y: outline.y + outline.h / 2 + 7 });
  editor.handlePointerUp();

  assert.equal(editor.document.snapEnabled, false);
  assert.equal(editor.getSelectedClip().x % 8 === 0 && editor.getSelectedClip().y % 8 === 0, false);
});

test('cutscene editor keyframe targets are touch-sized and adjacent key actions work', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 100,
      durationMs: 1200,
      x: 20,
      y: 20,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 20,
      h: 20,
      keyframes: [
        { timeMs: 300, x: 50, y: 40, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true },
        { timeMs: 900, x: 90, y: 80, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true }
      ]
    }]
  });
  editor.selectedClipId = 'actor';
  editor.playheadMs = 700;
  editor.draw(createMockContext(), 390, 844);

  assert.equal(editor.bounds.keyframes.every((entry) => entry.w >= 24 && entry.h >= 24), true);
  assert.equal(editor.bounds.stageKeyframes.every((entry) => entry.w >= 24 && entry.h >= 24), true);

  editor.selectAdjacentKeyframe(1);
  assert.deepEqual(editor.selectedKeyframe, { clipId: 'actor', timeMs: 900 });
  assert.equal(editor.playheadMs, 1000);

  editor.selectAdjacentKeyframe(-1);
  assert.deepEqual(editor.selectedKeyframe, { clipId: 'actor', timeMs: 300 });
  assert.equal(editor.playheadMs, 400);
});

test('cutscene editor track controls reorder object tracks', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [
      { id: 'art-1', type: 'art', durationMs: 1000 },
      { id: 'text-1', type: 'text', durationMs: 1000 }
    ]
  });
  editor.selectedClipId = 'text-1';
  const artTrackId = editor.document.clips.find((clip) => clip.id === 'art-1').trackId;
  const textTrackId = editor.document.clips.find((clip) => clip.id === 'text-1').trackId;

  editor.moveSelectedTrack(-1);
  assert.deepEqual(editor.document.clips.map((clip) => clip.id), ['art-1', 'text-1']);
  assert.deepEqual(editor.document.tracks.map((track) => track.id), [textTrackId, artTrackId]);

  editor.moveSelectedTrackTo('bottom');
  assert.deepEqual(editor.document.clips.map((clip) => clip.id), ['art-1', 'text-1']);
  assert.deepEqual(editor.document.tracks.map((track) => track.id), [artTrackId, textTrackId]);

  editor.clipOptionsTab = 'edit';
  const items = editor.getMenuItems().map((item) => item.id);
  assert.equal(items.includes('copy'), false);
  assert.equal(editor.getClipOptionItems(editor.getSelectedClip(), 'edit').some((item) => item.id === 'move-to-track'), true);
});

test('cutscene editor timeline vertical drag reorders object tracks', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [
      { id: 'art-1', type: 'art', durationMs: 1000 },
      { id: 'text-1', type: 'text', durationMs: 1000 }
    ]
  });
  editor.draw(createMockContext(), 390, 844);
  const textClip = editor.bounds.clips.find((entry) => entry.id === 'text-1');
  const artTrackId = editor.document.clips.find((entry) => entry.id === 'art-1').trackId;
  const artLane = editor.bounds.trackLabels.find((entry) => entry.trackId === artTrackId);

  editor.handlePointerDown({ x: textClip.x + 8, y: textClip.y + textClip.h / 2 });
  editor.handlePointerMove({ x: textClip.x + 8, y: artLane.y + artLane.h / 2 });
  editor.handlePointerUp();

  assert.deepEqual(editor.document.clips.map((clip) => clip.id), ['art-1', 'text-1']);
  assert.equal(editor.document.clips.find((clip) => clip.id === 'text-1').trackId, artTrackId);
  assert.equal(editor.document.tracks.length, 2);
});

test('cutscene editor supports multiple clips on one timeline track', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    tracks: [{ id: 'dialogue', name: 'Dialogue' }],
    clips: [
      { id: 'text-1', type: 'text', text: '2994 AD', trackId: 'dialogue', durationMs: 1000 },
      { id: 'text-2', type: 'text', text: 'THE LAST MESSAGE', trackId: 'dialogue', startMs: 1200, durationMs: 1000 }
    ]
  });

  editor.draw(createMockContext(), 390, 844);

  assert.equal(editor.document.tracks.length, 1);
  assert.deepEqual(editor.document.clips.map((clip) => clip.trackId), ['dialogue', 'dialogue']);
  assert.equal(editor.bounds.trackLabels.length, 1);
  assert.equal(editor.bounds.clips.filter((clip) => clip.trackId === 'dialogue').length, 2);
  assert.equal(editor.getClipOptionItems(editor.document.clips[0], 'edit').some((item) => item.id === 'move-to-track'), true);
  assert.equal(editor.bounds.clips[0].y, editor.bounds.clips[1].y);
});

test('cutscene editor stacks only overlapping clips on the same timeline track', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    tracks: [{ id: 'dialogue', name: 'Dialogue' }],
    clips: [
      { id: 'text-1', type: 'text', text: 'A', trackId: 'dialogue', startMs: 0, durationMs: 1200 },
      { id: 'text-2', type: 'text', text: 'B', trackId: 'dialogue', startMs: 600, durationMs: 1200 }
    ]
  });

  editor.draw(createMockContext(), 390, 844);

  const first = editor.bounds.clips.find((clip) => clip.id === 'text-1');
  const second = editor.bounds.clips.find((clip) => clip.id === 'text-2');
  assert.notEqual(first.y, second.y);
});

test('cutscene editor timeline uses purple text clips and board clip colors', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    tracks: [{ id: 'track-1', name: 'Track 1' }, { id: 'track-2', name: 'Track 2' }],
    clips: [
      { id: 'text-1', type: 'text', text: 'A', trackId: 'track-1', durationMs: 1000 },
      { id: 'board-1', type: 'color-board', color: '#123456', trackId: 'track-2', durationMs: 1000 }
    ]
  });
  const ctx = createRecordingContext();

  editor.draw(ctx, 390, 844);

  assert.equal(ctx.calls.some((call) => call.type === 'fillRect' && call.fillStyle === '#b46aff'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'fillRect' && call.fillStyle === '#123456'), true);
});

test('cutscene editor main drawer exposes compact portrait root tabs', () => {
  const editor = createMobileCutsceneEditor();
  editor.menuOpen = true;
  editor.draw(createMockContext(), 390, 844);

  const tabIds = editor.bounds.menuButtons.map((button) => button.id).filter((id) => String(id).startsWith('tab:'));

  assert.deepEqual(tabIds, ['tab:file', 'tab:add', 'tab:timeline', 'tab:clips', 'tab:keyframes', 'tab:stage', 'tab:audio', 'tab:settings']);
  assert.equal(editor.getMenuItems('file').some((item) => item.id === 'export'), true);
});

test('cutscene editor track tap selects track and edit panel shows track options', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    tracks: [{ id: 'dialogue', name: 'Dialogue' }],
    clips: [{ id: 'text-1', type: 'text', text: 'A', trackId: 'dialogue', durationMs: 1000 }]
  });
  editor.selectedClipId = null;
  editor.draw(createMockContext(), 390, 844);
  const lane = editor.bounds.trackLabels.find((entry) => entry.trackId === 'dialogue');

  editor.handlePointerDown({ x: lane.x + 8, y: lane.y + lane.h / 2 });
  editor.handlePointerUp();

  assert.equal(editor.selectedTrackId, 'dialogue');
  assert.equal(editor.selectedClipId, null);
  editor.handleButton('clip-options');
  await editor.pendingAction;
  editor.draw(createMockContext(), 390, 844);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'rename-track'), true);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'clip-options-tab:track'), false);
});

test('cutscene editor draws timeline and stage keyframe markers', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'actor',
      type: 'actor',
      startMs: 0,
      durationMs: 1600,
      stateId: 'idle',
      stateEvents: [
        { id: 'state-1', timeMs: 0, stateId: 'idle' },
        { id: 'state-2', timeMs: 800, stateId: 'attack' }
      ],
      keyframes: [
        { timeMs: 800, x: 80, y: 60, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true },
        { timeMs: 1600, x: 140, y: 100, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true }
      ]
    }]
  });
  editor.selectedClipId = 'actor';
  editor.playheadMs = 800;

  editor.draw(createMockContext(), 390, 844);

  assert.equal(editor.bounds.keyframes.length >= 1, true);
  assert.equal(editor.bounds.stageKeyframes.length >= 1, true);
  assert.equal(editor.bounds.stateEvents.length >= 2, true);
});

test('cutscene editor timeline handle resizes selected clip duration', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{
      id: 'text-1',
      type: 'text',
      text: 'STATUS REPORT',
      startMs: 0,
      durationMs: 1000
    }]
  });
  editor.selectedClipId = 'text-1';
  editor.draw(createMockContext(), 390, 844);
  const handle = editor.bounds.clipHandles[0];

  editor.handlePointerDown({ x: handle.x + handle.w / 2, y: handle.y + handle.h / 2 });
  editor.handlePointerMove({ x: handle.x + handle.w / 2 + 80, y: handle.y + handle.h / 2 });
  editor.handlePointerUp();

  assert.equal(editor.document.clips[0].durationMs > 1000, true);
});

test('cutscene editor timeline move snaps clip start to playhead', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'text-1', type: 'text', text: 'STATUS REPORT', startMs: 200, durationMs: 700 }]
  });
  editor.selectedClipId = 'text-1';
  editor.playheadMs = 1000;
  editor.draw(createMockContext(), 390, 844);
  const clipBounds = editor.bounds.clips.find((entry) => entry.id === 'text-1');
  const layout = editor.getTimelineLayout(editor.bounds.timeline);
  const startX = clipBounds.x + 8;
  const targetX = startX + timelineMsToX(990, layout) - timelineMsToX(200, layout);

  editor.handlePointerDown({ x: startX, y: clipBounds.y + clipBounds.h / 2 });
  editor.handlePointerMove({ x: targetX, y: clipBounds.y + clipBounds.h / 2 });

  assert.equal(editor.document.clips[0].startMs, 1000);
  assert.equal(editor.timelineSnapGuideMs, 1000);
});

test('cutscene editor timeline move snaps clip end to playhead', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'text-1', type: 'text', text: 'STATUS REPORT', startMs: 200, durationMs: 700 }]
  });
  editor.selectedClipId = 'text-1';
  editor.playheadMs = 1000;
  editor.draw(createMockContext(), 390, 844);
  const clipBounds = editor.bounds.clips.find((entry) => entry.id === 'text-1');
  const layout = editor.getTimelineLayout(editor.bounds.timeline);
  const startX = clipBounds.x + 8;
  const targetX = startX + timelineMsToX(290, layout) - timelineMsToX(200, layout);

  editor.handlePointerDown({ x: startX, y: clipBounds.y + clipBounds.h / 2 });
  editor.handlePointerMove({ x: targetX, y: clipBounds.y + clipBounds.h / 2 });

  assert.equal(editor.document.clips[0].startMs, 300);
  assert.equal(editor.document.clips[0].startMs + editor.document.clips[0].durationMs, 1000);
});

test('cutscene editor timeline duration resize snaps clip end to playhead', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'text-1', type: 'text', text: 'STATUS REPORT', startMs: 500, durationMs: 300 }]
  });
  editor.selectedClipId = 'text-1';
  editor.playheadMs = 1000;
  editor.draw(createMockContext(), 390, 844);
  const handle = editor.bounds.clipHandles[0];
  const layout = editor.getTimelineLayout(editor.bounds.timeline);
  const startX = handle.x + handle.w / 2;
  const targetX = startX + timelineMsToX(990, layout) - timelineMsToX(800, layout);

  editor.handlePointerDown({ x: startX, y: handle.y + handle.h / 2 });
  editor.handlePointerMove({ x: targetX, y: handle.y + handle.h / 2 });

  assert.equal(editor.document.clips[0].durationMs, 500);
  assert.equal(editor.document.clips[0].startMs + editor.document.clips[0].durationMs, 1000);
});

test('cutscene editor timeline snapping respects snap off', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    snapEnabled: false,
    clips: [{ id: 'text-1', type: 'text', text: 'STATUS REPORT', startMs: 200, durationMs: 700 }]
  });
  editor.selectedClipId = 'text-1';
  editor.playheadMs = 1000;
  editor.draw(createMockContext(), 390, 844);
  const clipBounds = editor.bounds.clips.find((entry) => entry.id === 'text-1');
  const layout = editor.getTimelineLayout(editor.bounds.timeline);
  const startX = clipBounds.x + 8;
  const targetX = startX + timelineMsToX(990, layout) - timelineMsToX(200, layout);

  editor.handlePointerDown({ x: startX, y: clipBounds.y + clipBounds.h / 2 });
  editor.handlePointerMove({ x: targetX, y: clipBounds.y + clipBounds.h / 2 });

  assert.equal(editor.document.clips[0].startMs, 990);
  assert.equal(editor.timelineSnapGuideMs, null);
});

test('cutscene editor play starts from current playhead and step advances one frame', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    fps: 20,
    clips: [{ id: 'actor-1', type: 'actor', startMs: 0, durationMs: 2400 }]
  });
  editor.playheadMs = 700;

  editor.stepFrame();
  assert.equal(editor.isPlaying, false);
  assert.equal(Math.round(editor.playheadMs), 750);

  editor.handleButton('play');
  await editor.pendingAction;
  assert.equal(editor.isPlaying, true);
  assert.equal(editor.playheadMs, 750);
  assert.equal(editor.document.durationMs, 6000);

  editor.update({}, 0.25);
  editor.update({}, 0.25);

  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 1250);

  editor.update({
    wasPressed: (id) => id === 'pause' || id === 'cancel' || id === 'attack'
  }, 2);
  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 3250);

  editor.update({}, 3.5);
  assert.equal(editor.playheadMs, 6000);
  assert.equal(editor.isPlaying, false);

  editor.playheadMs = 900;
  editor.handleButton('play');
  await editor.pendingAction;
  assert.equal(editor.isPlaying, true);
  assert.equal(editor.playheadMs, 900);
});

test('cutscene editor play respects arbitrary timeline cursor', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'art-1', type: 'art', startMs: 0, durationMs: 2400 }]
  });
  editor.playheadMs = 1465;

  editor.handleButton('play');
  await editor.pendingAction;
  editor.update({}, 0.017);

  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 1482);
  assert.equal(Math.round(editor.previewPlayer.timeMs), 1482);

  editor.update({}, 1);
  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 2482);
});

test('cutscene editor preview ignores pause markers and keeps playing', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 3000,
    clips: [
      { id: 'pause-1', type: 'pause', startMs: 100, waitForInput: true },
      { id: 'actor-1', type: 'actor', startMs: 0, durationMs: 2400 }
    ]
  });

  await editor.playScene();
  editor.update({}, 0.2);

  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 200);
  assert.equal(editor.previewPlayer.waitingPauseClipId, null);
});

test('cutscene editor play button toggles active preview pause', async () => {
  const originalPerformance = globalThis.performance;
  let now = 1000;
  globalThis.performance = { now: () => now };
  try {
    const editor = createMobileCutsceneEditor();
    editor.document = normalizeCutsceneDocument({
      durationMs: 6000,
      clips: [{ id: 'actor-1', type: 'actor', startMs: 0, durationMs: 2400 }]
    });

    editor.handleButton('play');
    await editor.pendingAction;
    now += 17;
    editor.update({}, 0.017);
    editor.handleButton('play');
    await editor.pendingAction;

    assert.equal(editor.isPlaying, false);
    assert.equal(Math.round(editor.playheadMs), 17);

    now += 1000;
    editor.update({}, 1);
    assert.equal(editor.isPlaying, false);
    assert.equal(Math.round(editor.playheadMs), 17);

    editor.handleButton('play');
    await editor.pendingAction;
    assert.equal(editor.isPlaying, true);
    assert.equal(Math.round(editor.playheadMs), 17);

    editor.update({}, 6);
    assert.equal(editor.isPlaying, false);
    assert.equal(editor.playheadMs, 6000);
  } finally {
    globalThis.performance = originalPerformance;
  }
});

test('cutscene editor visual preview continues if audio preview player becomes inactive', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'actor-1', type: 'actor', startMs: 0, durationMs: 2400 }]
  });

  editor.handleButton('play');
  await editor.pendingAction;
  editor.update({}, 0.017);
  editor.previewPlayer.active = false;
  editor.update({}, 1);

  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 1017);

  editor.update({}, 5);
  assert.equal(editor.isPlaying, false);
  assert.equal(editor.playheadMs, 6000);
});

test('cutscene editor visual preview continues if audio preview player stops early', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'actor-1', type: 'actor', startMs: 0, durationMs: 2400 }]
  });

  editor.handleButton('play');
  await editor.pendingAction;
  editor.update({}, 0.017);
  editor.previewPlayer.stop();
  editor.update({}, 1);

  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 1017);

  editor.update({}, 5);
  assert.equal(editor.isPlaying, false);
  assert.equal(editor.playheadMs, 6000);
});

test('cutscene editor visual preview continues if audio preview update throws', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    clips: [{ id: 'actor-1', type: 'actor', startMs: 0, durationMs: 2400 }]
  });

  editor.handleButton('play');
  await editor.pendingAction;
  editor.previewPlayer.update = () => { throw new Error('audio failed'); };
  editor.update({}, 0.017);

  assert.equal(editor.isPlaying, true);
  assert.equal(editor.previewPlayer.active, false);
  assert.equal(Math.round(editor.playheadMs), 17);

  editor.update({}, 1);
  assert.equal(editor.isPlaying, true);
  assert.equal(Math.round(editor.playheadMs), 1017);

  editor.update({}, 5);
  assert.equal(editor.isPlaying, false);
  assert.equal(editor.playheadMs, 6000);
});

test('cutscene editor trims huge undo snapshots by memory budget', () => {
  const editor = createMobileCutsceneEditor();
  editor.historyByteLimit = 1200;
  editor.document = {
    ...createDefaultCutscene(),
    clips: [
      {
        id: 'big-text',
        type: 'text',
        startMs: 0,
        durationMs: 1000,
        text: 'x'.repeat(900)
      }
    ]
  };

  editor.captureHistory('one');
  editor.document.clips[0].durationMs = 1200;
  editor.captureHistory('two');
  editor.document.clips[0].durationMs = 1400;
  editor.captureHistory('three');

  assert.equal(editor.history.length, 1);
  assert.equal(editor.history[0].label, 'three');
  assert.ok(editor.history[0].byteSize > 900);
});

test('cutscene editor preview fires scheduled music and sfx audio', async () => {
  const events = [];
  const editor = new CutsceneEditor({
    exitCutsceneEditor() {},
    playActorMidi(ref, options) { events.push(['music', ref, options.volume]); },
    stopActorMidi(ref) { events.push(['stop-music', ref]); },
    playSfxById(ref, options) { events.push(['sfx', ref, options.loop, options.key]); },
    stopSfxById(ref) { events.push(['stop-sfx', ref]); }
  });
  editor.document = normalizeCutsceneDocument({
    durationMs: 6000,
    assets: [
      { id: 'music-asset', type: 'music', ref: 'Theme' },
      { id: 'sfx-asset', type: 'sfx', ref: 'Boom' }
    ],
    clips: [
      { id: 'music-1', type: 'music', assetId: 'music-asset', startMs: 0, durationMs: 200, volume: 0.6 },
      { id: 'sfx-1', type: 'sfx', assetId: 'sfx-asset', startMs: 300, durationMs: 100, loop: true }
    ]
  });

  await editor.playScene();
  editor.update({}, 0.01);
  editor.update({}, 0.3);
  editor.update({}, 0.2);

  assert.deepEqual(events[0], ['music', 'Theme', 0.6]);
  assert.deepEqual(events[1], ['sfx', 'Boom', true, 'sfx-1']);
  assert.deepEqual(events[2], ['stop-music', 'Theme']);
  assert.deepEqual(events[3], ['stop-sfx', 'Boom']);
  assert.equal(editor.isPlaying, true);

  editor.update({}, 5.5);
  assert.equal(editor.isPlaying, false);
  assert.equal(editor.playheadMs, 6000);
});

test('game core advances active MIDI music players during cutscene editor preview', () => {
  const branchStart = gameCoreSource.indexOf("if (this.state === 'cutscene-editor')");
  const branchEnd = gameCoreSource.indexOf("if (this.state === 'robtersession')", branchStart);
  const branchBody = gameCoreSource.slice(branchStart, branchEnd);
  const helperStart = gameCoreSource.indexOf('\n  updateActiveMusicPlayers(dt)');
  const helperEnd = gameCoreSource.indexOf('updateProjectBrowserMusicPreview', helperStart);
  const helperBody = gameCoreSource.slice(helperStart, helperEnd);

  assert.equal(branchBody.includes('this.cutsceneEditor.update(this.input, dt);'), true);
  assert.equal(branchBody.includes('this.updateActiveMusicPlayers(dt);'), true);
  assert.equal(helperBody.includes('this.musicPlayers.forEach((player) => player.update(dt));'), true);
  assert.equal(helperBody.includes('this.getMusicZoneAt'), false);
});

test('game core treats cutscene editor as a shared editor transition state', () => {
  const constructorStart = gameCoreSource.indexOf('  constructor(');
  const constructorEnd = gameCoreSource.indexOf('\n  handleSharedStateTransitionCleanup', constructorStart);
  const constructorBody = gameCoreSource.slice(constructorStart, constructorEnd);
  const isEditorStart = gameCoreSource.indexOf('  isEditorState(state = this.state)');
  const isEditorEnd = gameCoreSource.indexOf('\n  handleSharedStateTransitionCleanup', isEditorStart);
  const isEditorBody = gameCoreSource.slice(isEditorStart, isEditorEnd);
  const cleanupStart = gameCoreSource.indexOf('  handleSharedStateTransitionCleanup');
  const cleanupEnd = gameCoreSource.indexOf('\n  enterEditor(', cleanupStart);
  const cleanupBody = gameCoreSource.slice(cleanupStart, cleanupEnd);
  const updateStart = gameCoreSource.indexOf('  _updateByState(dt)');
  const updateEnd = gameCoreSource.indexOf('\n  enterEditor(', updateStart);
  const updateBody = gameCoreSource.slice(updateStart, updateEnd);

  assert.equal(constructorBody.includes("'cutscene-editor': 'cutsceneEditor'"), true);
  assert.equal(constructorBody.includes('this.editorStateKeys = new Set(Object.keys(this.editorStateTargetKeys));'), true);
  assert.equal(isEditorBody.includes("state === 'pixel-preview'"), true);
  assert.equal(cleanupBody.includes('this.isEditorState(from)'), true);
  assert.equal(cleanupBody.includes('this.isEditorState(to)'), true);
  assert.equal(cleanupBody.includes('this.editorStateKeys.has(to)'), true);
  assert.equal(cleanupBody.includes('this.cutsceneEditor?.resetTransientInteractionState?.();'), true);
  assert.equal(cleanupBody.includes("to === 'cutscene-editor'"), false);
  assert.equal(updateBody.includes('if (this.isEditorState(this.state)) {'), true);
});

test('cutscene editor clears transient menu and pointer state on shared cleanup', () => {
  const editor = new CutsceneEditor({ isMobile: true });
  editor.drag = { mode: 'clip' };
  editor.menuScrollDrag = { menuId: 'timeline' };
  editor.menuOpen = true;
  editor.menuScroll = 4;
  editor.landscapeRootScroll = 3;
  editor.clipOptionsOpen = true;
  editor.timelineZoomSlider.active = true;
  editor.timelineZoomSlider.id = 'zoom';
  editor.panJoystick.active = true;
  editor.panJoystick.id = 'touch';
  editor.panJoystick.dx = 0.5;
  editor.panJoystick.dy = -0.25;
  editor.transportHold = { x: 1 };
  editor.transportPopover = { open: true };
  editor.controllerMenu.openRoot();

  editor.resetTransientInteractionState();

  assert.equal(editor.drag, null);
  assert.equal(editor.menuScrollDrag, null);
  assert.equal(editor.menuOpen, false);
  assert.equal(editor.menuScroll, 0);
  assert.equal(editor.landscapeRootScroll, 0);
  assert.equal(editor.clipOptionsOpen, false);
  assert.equal(editor.timelineZoomSlider.active, false);
  assert.equal(editor.timelineZoomSlider.id, null);
  assert.equal(editor.panJoystick.active, false);
  assert.equal(editor.panJoystick.id, null);
  assert.equal(editor.panJoystick.dx, 0);
  assert.equal(editor.panJoystick.dy, 0);
  assert.equal(editor.transportHold, null);
  assert.equal(editor.transportPopover, null);
  assert.equal(editor.controllerMenu.active, false);
});

test('game core advances active MIDI music players during in-game cutscenes', () => {
  const branchStart = gameCoreSource.indexOf("if (this.state === 'playing' && this.cutscenePlayer?.active)");
  const branchEnd = gameCoreSource.indexOf("if (\n      this.playtestActive", branchStart);
  const branchBody = gameCoreSource.slice(branchStart, branchEnd);

  assert.equal(branchBody.includes('this.cutscenePlayer.update(dt);'), true);
  assert.equal(branchBody.includes('this.updateActiveMusicPlayers(dt);'), true);
  assert.ok(branchBody.indexOf('this.cutscenePlayer.update(dt);') < branchBody.indexOf('this.updateActiveMusicPlayers(dt);'));
  assert.ok(branchBody.indexOf('this.updateActiveMusicPlayers(dt);') < branchBody.indexOf('return;'));
});

test('cutscene editor only reports saved after server persistence succeeds', async () => {
  resetProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  const posts = [];
  globalThis.fetch = async (url, options = {}) => {
    posts.push({ url, options });
    return {
      ok: true,
      async json() {
        const body = JSON.parse(options.body || '{}');
        return {
          ok: true,
          file: {
            version: body.version,
            folder: body.folder,
            name: body.name,
            savedAt: body.savedAt,
            data: body.data
          }
        };
      }
    };
  };
  try {
    const editor = createMobileCutsceneEditor();
    editor.currentDocumentRef = { folder: 'cutscenes', name: 'c1' };
    editor.document.name = 'c1';

    await editor.saveDocument();

    assert.equal(posts[0]?.url, '/__storage/file');
    assert.equal(editor.statusText, 'Saved c1');
    assert.deepEqual(editor.currentDocumentRef, { folder: 'cutscenes', name: 'c1' });
  } finally {
    globalThis.fetch = originalFetch;
    resetProjectFilesForTests();
  }
});

test('cutscene editor shows saving while server confirmation is pending', async () => {
  resetProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  let resolveFetch;
  const fetchStarted = new Promise((resolve) => {
    globalThis.fetch = async (_url, options = {}) => {
      resolve();
      return new Promise((fetchResolve) => {
        resolveFetch = () => fetchResolve({
          ok: true,
          async json() {
            const body = JSON.parse(options.body || '{}');
            return {
              ok: true,
              file: {
                version: body.version,
                folder: body.folder,
                name: body.name,
                savedAt: body.savedAt,
                data: body.data
              }
            };
          }
        });
      });
    };
  });
  try {
    const editor = createMobileCutsceneEditor();
    editor.currentDocumentRef = { folder: 'cutscenes', name: 'c1' };
    editor.document.name = 'c1';

    const savePromise = editor.saveDocument();
    await fetchStarted;

    assert.equal(editor.statusText, 'Saving c1...');
    resolveFetch();
    await savePromise;
    assert.equal(editor.statusText, 'Saved c1');
  } finally {
    globalThis.fetch = originalFetch;
    resetProjectFilesForTests();
  }
});

test('cutscene editor draws status text in portrait action rail', () => {
  const editor = createMobileCutsceneEditor();
  const ctx = createRecordingContext();
  editor.statusText = 'Saving c1...';
  editor.bounds = { buttons: [] };

  editor.drawActionRail(ctx, { x: 0, y: 0, w: 390, h: 120 }, true);

  assert.equal(ctx.calls.some((call) => call.type === 'fillText' && call.text === 'Saving c1...'), true);
});

test('cutscene editor first save prompts for a name and lists the saved cutscene', async () => {
  resetProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => ({
    ok: true,
    async json() {
      const body = JSON.parse(options.body || '{}');
      return {
        ok: true,
        file: {
          version: body.version,
          folder: body.folder,
          name: body.name,
          savedAt: body.savedAt,
          data: body.data
        }
      };
    }
  });
  try {
    const editor = createMobileCutsceneEditor();
    editor.requestText = async ({ confirmText }) => {
      assert.equal(confirmText, 'Save');
      return 'c1';
    };

    await editor.saveDocument();

    assert.equal(editor.statusText, 'Saved c1');
    assert.deepEqual(editor.currentDocumentRef, { folder: 'cutscenes', name: 'c1' });
    assert.deepEqual(listProjectFiles('cutscenes').map((entry) => entry.name), ['c1']);
  } finally {
    globalThis.fetch = originalFetch;
    resetProjectFilesForTests();
  }
});

test('cutscene editor open can load a cutscene immediately after save', async () => {
  resetProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => ({
    ok: true,
    async json() {
      if (String(url).includes('/__storage/index')) {
        return { ok: true, index: { levels: {}, art: {}, music: {}, actors: {}, sfx: {}, cutscenes: {} } };
      }
      const body = JSON.parse(options.body || '{}');
      return {
        ok: true,
        file: {
          version: body.version,
          folder: body.folder,
          name: body.name,
          savedAt: body.savedAt,
          data: body.data
        }
      };
    }
  });
  try {
    const editor = createMobileCutsceneEditor();
    editor.requestText = async () => 'c1';
    editor.document = normalizeCutsceneDocument({ name: 'draft', durationMs: 2400, clips: [{ id: 'actor-1', type: 'actor', durationMs: 2400 }] });

    await editor.saveDocument();
    editor.applyDocument(createDefaultCutscene('blank'), 'blank');
    editor.currentDocumentRef = null;
    const payload = loadProjectFile('cutscenes', 'c1');
    editor.applyDocument(payload.data, 'c1');
    editor.currentDocumentRef = { folder: 'cutscenes', name: 'c1' };

    assert.equal(editor.currentDocumentRef.name, 'c1');
    assert.equal(editor.document.name, 'c1');
    assert.equal(editor.document.clips[0]?.id, 'actor-1');
  } finally {
    globalThis.fetch = originalFetch;
    resetProjectFilesForTests();
  }
});

test('cutscene editor does not report saved when server persistence fails', async () => {
  resetProjectFilesForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    async json() { return { ok: false, error: 'No storage API' }; }
  });
  try {
    const editor = createMobileCutsceneEditor();
    editor.currentDocumentRef = { folder: 'cutscenes', name: 'c1' };
    editor.document.name = 'c1';

    await editor.saveDocument();

    assert.match(editor.statusText, /^Save failed:/);
    assert.deepEqual(editor.currentDocumentRef, { folder: 'cutscenes', name: 'c1' });
    assert.deepEqual(listProjectFiles('cutscenes'), []);
  } finally {
    globalThis.fetch = originalFetch;
    resetProjectFilesForTests();
  }
});

test('cutscene editor separates scene length from selected clip length', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 3000,
    clips: [{
      id: 'text',
      type: 'text',
      startMs: 1000,
      durationMs: 2000,
      x: 10,
      y: 10,
      scale: 1,
      rotation: 0,
      opacity: 1,
      w: 20,
      h: 20,
      keyframes: [
        { timeMs: 1500, x: 20, y: 20, scale: 1, rotation: 0, opacity: 1, w: 20, h: 20, manual: true }
      ]
    }]
  });
  editor.selectedClipId = 'text';
  editor.playheadMs = 2800;
  editor.requestText = async ({ title }) => (title === 'Scene Length' ? '1800' : '650');

  await editor.editSceneDuration();

  assert.equal(editor.document.durationMs, 1800);
  assert.equal(editor.playheadMs, 1800);
  assert.equal(editor.getSelectedClip().durationMs, 2000);
  assert.equal(editor.getSelectedClip().keyframes.at(-1).timeMs, 1500);
  assert.equal(editor.statusText, 'Scene 1800ms (1.80s); later clips preserved');

  await editor.editSelectedDuration();

  assert.equal(editor.document.durationMs, 1800);
  assert.equal(editor.getSelectedClip().durationMs, 650);
});

test('cutscene editor menus expose scene length and clip length distinctly', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{ id: 'text', type: 'text' }]
  });
  editor.selectedClipId = 'text';

  editor.activeMenuTab = 'stage';
  const stageItems = editor.getMenuItems();
  editor.activeMenuTab = 'clip';
  const clipItems = editor.getMenuItems();

  assert.equal(stageItems.some((item) => item.id === 'scene-duration' && item.label === 'Scene Length'), true);
  assert.equal(stageItems.some((item) => item.id === 'scene-fade-in' && item.label === 'Fade In 0ms'), true);
  assert.equal(stageItems.some((item) => item.id === 'scene-fade-out' && item.label === 'Fade Out 0ms'), true);
  assert.equal(stageItems.some((item) => item.id === 'snap-toggle' && item.label === 'Snap On'), true);
  assert.equal(stageItems.some((item) => item.id === 'snap-size' && item.label === 'Grid 8'), true);
  assert.equal(stageItems.some((item) => item.id === 'master-volume' && item.label === 'Master 100'), true);
  assert.equal(clipItems.some((item) => item.id === 'clip-duration'), false);
  assert.equal(editor.getSelectedVisualContextActions(editor.getSelectedClip()).some((item) => item.id === 'set-key'), true);
});

test('cutscene editor edits scene transition durations', async () => {
  const editor = createMobileCutsceneEditor();
  const inputs = ['700', '900'];
  editor.requestText = async () => inputs.shift();

  await editor.editSceneFade('in');
  await editor.editSceneFade('out');

  assert.equal(editor.document.sceneFadeInMs, 700);
  assert.equal(editor.document.sceneFadeOutMs, 900);
  assert.equal(editor.statusText, 'Scene Fade Out: 900ms');
});

test('cutscene scene duration parser accepts seconds and milliseconds', () => {
  assert.equal(parseCutsceneDurationInput('95'), 95000);
  assert.equal(parseCutsceneDurationInput('95s'), 95000);
  assert.equal(parseCutsceneDurationInput('95000ms'), 95000);
  assert.equal(parseCutsceneDurationInput('1800'), 1800);
  assert.equal(parseCutsceneDurationInput('10.1'), 10100);
});

test('cutscene preview and export use scene duration as soft end boundary', () => {
  const previewDurationStart = cutsceneEditorSource.indexOf('const getFullPreviewDurationMs = (doc) => Math.max(');
  const previewDurationBody = cutsceneEditorSource.slice(previewDurationStart, cutsceneEditorSource.indexOf('function getCutsceneTimelineClipColor', previewDurationStart));
  assert.equal(previewDurationBody.includes('getClipEndMs'), false);
  assert.equal(previewDurationBody.includes('safeNumber(doc?.durationMs'), true);
});

test('cutscene editor exposes compatible MP4 export and helpers', () => {
  const editor = createMobileCutsceneEditor();
  editor.activeMenuTab = 'file';
  const fileItems = editor.getMenuItems();
  const supported = new Set(['video/webm;codecs=vp8,opus']);
  const fakeRecorder = {
    isTypeSupported: (type) => supported.has(type)
  };
  const exportLayout = getCutsceneMovieExportLayout({ width: 256, height: 144 });

  assert.equal(fileItems.some((item) => item.id === 'export' && item.label === 'Export MP4'), true);
  assert.equal(selectCutsceneMovieRecordingMimeType(fakeRecorder), 'video/webm;codecs=vp8,opus');
  assert.equal(selectCutsceneMovieRecordingMimeType(null), '');
  assert.equal(getCutsceneMp4ExportFilename('Intro Scene!', 123).endsWith('.mp4'), true);
  assert.equal(getCutsceneMp4ExportFilename('Intro Scene!', 123), 'Intro-Scene-123.mp4');
  assert.deepEqual(exportLayout, {
    sourceWidth: 256,
    sourceHeight: 144,
    outputWidth: 1920,
    outputHeight: 1080,
    fit: 'contain',
    scale: 7.5,
    drawX: 0,
    drawY: 0,
    drawWidth: 1920,
    drawHeight: 1080,
    frameWidth: 256,
    frameHeight: 144,
    stageBounds: { x: 0, y: 0, w: 256, h: 144 }
  });
  assert.deepEqual(getCutsceneRenderProjection({ width: 256, height: 144 }, { x: 0, y: 0, w: 1920, h: 1080 }).stageRect, {
    x: 0,
    y: 0,
    w: 1920,
    h: 1080
  });
});

test('cutscene MP4 export uses ffmpeg h264 aac server transcode and real download button', () => {
  assert.equal(cutsceneEditorSource.includes("const url = params.toString() ? `/__export/mp4?${params.toString()}` : '/__export/mp4';"), true);
  assert.equal(cutsceneEditorSource.includes("fetch('/__export/mp4-frames'"), true);
  assert.equal(cutsceneEditorSource.includes("fetch('/__export/session'"), true);
  assert.equal(cutsceneEditorSource.includes('createMovieExportSession'), true);
  assert.equal(cutsceneEditorSource.includes('uploadMovieExportSegmentFrame'), true);
  assert.equal(cutsceneEditorSource.includes('uploadMovieExportAudio'), true);
  assert.equal(cutsceneEditorSource.includes('encodeMovieExportSegment'), true);
  assert.equal(cutsceneEditorSource.includes('finalizeMovieExportSession'), true);
  assert.equal(cutsceneEditorSource.includes('downloadMovieExportResult'), true);
  assert.equal(cutsceneEditorSource.includes('CUTSCENE_EXPORT_SEGMENT_MS = 10000'), true);
  assert.equal(cutsceneEditorSource.includes('Skipping saved segment'), true);
  assert.equal(cutsceneEditorSource.includes('Segments checkpointed.'), true);
  assert.equal(cutsceneEditorSource.includes('exportMovieMp4Deterministic'), true);
  assert.equal(cutsceneEditorSource.includes('exportMovieMp4MediaRecorder(null, { rethrow: true })'), false);
  assert.equal(cutsceneEditorSource.includes('exportMovieMp4MediaRecorder(error, { rethrow: false })'), true);
  assert.ok(cutsceneEditorSource.indexOf('const mp4Blob = await this.exportMovieMp4Deterministic(progress);') < cutsceneEditorSource.indexOf('exportMovieMp4MediaRecorder(error, { rethrow: false })'));
  assert.equal(cutsceneEditorSource.includes('transcodeMovieRecordingToMp4'), true);
  assert.equal(cutsceneEditorSource.includes("fetch('/__export/mp4-recording'"), true);
  assert.equal(cutsceneEditorSource.includes('transcodeFrameMovieToMp4'), true);
  assert.equal(cutsceneEditorSource.includes("form.append('frame'"), true);
  assert.equal(cutsceneEditorSource.includes('canvasToPngBlob'), true);
  assert.equal(cutsceneEditorSource.includes('new MediaRecorder'), true);
  assert.equal(cutsceneEditorSource.includes('renderMovieExportFrame'), true);
  assert.equal(cutsceneEditorSource.includes('exportCtx.imageSmoothingEnabled = false'), true);
  assert.equal(cutsceneEditorSource.includes('frameCanvas.width = layout.frameWidth'), true);
  assert.equal(cutsceneEditorSource.includes('frameCanvas.height = layout.frameHeight'), true);
  assert.equal(cutsceneEditorSource.includes('recordingCanvas.captureStream(0)'), true);
  assert.equal(cutsceneEditorSource.includes('new MediaStream(videoStream.getVideoTracks())'), true);
  assert.equal(cutsceneEditorSource.includes('tracks.push(...capture.stream.getAudioTracks())'), false);
  assert.equal(cutsceneEditorSource.includes('recordingCtx.drawImage(frameCanvas'), true);
  assert.equal(cutsceneEditorSource.includes("params.set('outputWidth'"), true);
  assert.equal(cutsceneEditorSource.includes("params.set('outputHeight'"), true);
  assert.equal(cutsceneEditorSource.includes('transcodeMovieBlobToMp4(sourceBlob, layout)'), false);
  assert.equal(cutsceneEditorSource.includes('transcodeMovieRecordingToMp4({ videoBlob: sourceBlob, audioBlob })'), true);
  assert.equal(cutsceneEditorSource.includes('drawBorder: false, pixelSnap: true'), true);
  assert.equal(cutsceneEditorSource.includes('stage?.pixelSnap === true ? Math.max(1, Math.round(rawUnit)) : rawUnit'), true);
  assert.equal(cutsceneEditorSource.includes("globalThis.navigator.wakeLock.request('screen')"), true);
  assert.equal(cutsceneEditorSource.includes("document.addEventListener('visibilitychange', handleVisibilityChange);"), true);
  assert.equal(cutsceneEditorSource.includes('MP4 export interrupted because the page was hidden'), true);
  assert.equal(cutsceneEditorSource.includes('const frameCount = Math.max(1, Math.ceil((durationMs / 1000) * fps));'), true);
  assert.equal(cutsceneEditorSource.includes('version: 7'), true);
  assert.equal(cutsceneEditorSource.includes('cutscene-mp4-v7'), true);
  assert.equal(cutsceneEditorSource.includes("{ fit: layout.fit || 'contain', drawBorder: false, pixelSnap: true }"), true);
  assert.equal(cutsceneEditorSource.includes('videoBitsPerSecond: Math.max(12000000'), true);
  assert.equal(cutsceneEditorSource.includes('beginMasterCapture'), true);
  assert.equal(cutsceneEditorSource.includes('beginMasterCapture?.({ monitor: false })'), true);
  assert.equal(cutsceneEditorSource.includes('renderCutsceneMidiAudioBlob(safeDoc, durationMs'), true);
  assert.equal(cutsceneEditorSource.includes('OfflineAudioContext'), true);
  assert.equal(cutsceneEditorSource.includes('preparePreviewAudioResources(safeDoc)'), true);
  assert.equal(cutsceneEditorSource.includes('endMasterCapture'), true);
  assert.equal(cutsceneEditorSource.includes('advanceMovieExportAudio(player'), true);
  assert.equal(cutsceneEditorSource.includes('player?.update?.(dt)'), true);
  assert.equal(cutsceneEditorSource.includes('this.game?.updateActiveMusicPlayers?.(dt)'), false);
  assert.equal(cutsceneEditorSource.includes('this.game?.updateProjectBrowserMusicPreview?.(dt)'), false);
  assert.equal(audioSource.includes('beginMasterCapture({ monitor = true } = {})'), true);
  assert.equal(audioSource.includes('source.disconnect(this.ctx.destination)'), true);
  assert.equal(audioSource.includes('capture.source.connect(capture.output)'), true);
  assert.equal(audioSource.includes('createMediaStreamDestination'), true);
  assert.equal(cutsceneEditorSource.includes("downloadBtn = document.createElement('button')"), true);
  assert.equal(cutsceneEditorSource.includes("downloadBtn = document.createElement('a')"), false);
  assert.equal(cutsceneEditorSource.includes("pointerEvents: 'none'"), true);
  assert.equal(cutsceneEditorSource.includes("root.style.pointerEvents = 'auto';"), true);
  assert.equal(cutsceneEditorSource.includes("overlay.style.pointerEvents = 'auto';"), true);
  assert.equal(cutsceneEditorSource.includes('bindOverlayActionButton(downloadBtn, triggerDownload);'), true);
  assert.equal(cutsceneEditorSource.includes("this.statusText = 'MP4 ready. Choose Download.';"), true);
  assert.equal(cutsceneEditorSource.includes('MP4 export produced no downloadable video.'), true);
  assert.equal(cutsceneEditorSource.includes('Could not show the MP4 download button.'), true);
  assert.equal(cutsceneEditorSource.includes('event.preventDefault();'), true);
  assert.equal(cutsceneEditorSource.includes("openLink.textContent = 'Open Video';"), true);
  const serverSource = readFileSync(new URL('../../tools/dev_server.py', import.meta.url), 'utf8');
  assert.equal(serverSource.includes('/__export/mp4'), true);
  assert.equal(serverSource.includes('/__export/mp4-recording'), true);
  assert.equal(serverSource.includes('"-fps_mode"'), true);
  assert.equal(serverSource.includes('"cfr"'), true);
  assert.equal(serverSource.includes('f"fps={fps},setsar=1"'), true);
  assert.equal(serverSource.includes('/__export/mp4-frames'), true);
  assert.equal(serverSource.includes('/__export/session'), true);
  assert.equal(serverSource.includes('EXPORT_SESSION_ROOT'), true);
  assert.equal(serverSource.includes('def _stream_request_body_to_file'), true);
  assert.equal(serverSource.includes('_handle_export_session_segment_frame_upload'), true);
  assert.equal(serverSource.includes('_handle_encode_export_session_segment'), true);
  assert.equal(serverSource.includes('_handle_finalize_export_session'), true);
  assert.equal(serverSource.includes('MIN_EXPORT_FREE_BYTES'), true);
  assert.equal(serverSource.includes('_get_ffmpeg_status'), true);
  assert.equal(serverSource.includes('sourceWidth'), true);
  assert.equal(serverSource.includes('outputWidth'), true);
  assert.equal(serverSource.includes('outputHeight'), true);
  assert.equal(serverSource.includes('force_original_aspect_ratio=decrease:flags=neighbor'), true);
  assert.equal(serverSource.includes('pad='), true);
  assert.equal(serverSource.includes('setsar=1'), true);
  assert.equal(serverSource.includes('"-map",'), true);
  assert.equal(serverSource.includes('"0:v:0"'), true);
  assert.equal(serverSource.includes('"1:a:0"'), true);
  assert.equal(serverSource.includes('"-fflags",'), true);
  assert.equal(serverSource.includes('"+genpts"'), true);
  assert.equal(serverSource.includes('"-avoid_negative_ts",'), true);
  assert.equal(serverSource.includes('"make_zero"'), true);
  assert.equal(serverSource.includes('frame-%06d.png'), true);
  assert.equal(serverSource.includes('def _read_multipart_form'), true);
  assert.equal(serverSource.includes('libx264'), true);
  assert.equal(serverSource.includes('yuv420p'), true);
  assert.equal(serverSource.includes('"-crf",'), true);
  assert.equal(serverSource.includes('"animation",'), true);
  assert.equal(serverSource.includes('aac'), true);
  assert.equal(serverSource.includes('+faststart'), true);
  assert.equal(serverSource.includes('MAX_MP4_UPLOAD_BYTES'), true);
  assert.equal(serverSource.includes('shutil.copyfileobj(handle, self.wfile'), true);
  assert.equal(serverSource.includes('output_path.read_bytes()'), false);
});

test('cutscene editor adds full-stage color boards and edits color and opacity', async () => {
  const editor = createMobileCutsceneEditor();
  editor.playheadMs = 500;
  let pickerTitle = '';
  const pickerValues = ['#445566', '#778899'];
  editor.openColorPicker = async (options) => {
    pickerTitle = options.title;
    return pickerValues.shift();
  };

  editor.activeMenuTab = 'add';
  assert.equal(editor.getMenuItems().some((item) => item.id === 'color-board'), true);

  await editor.addColorBoardClip();

  const clip = editor.getSelectedClip();
  assert.equal(pickerTitle, 'Color Board');
  assert.equal(clip.type, 'color-board');
  assert.equal(clip.color, '#445566');
  assert.equal(clip.startMs, 500);
  assert.equal(clip.w, editor.document.width);
  assert.equal(clip.h, editor.document.height);
  assert.equal(clip.x, editor.document.width / 2);
  assert.equal(clip.y, editor.document.height / 2);
  assert.equal(editor.menuOpen, false);

  editor.activeMenuTab = 'clip';
  const itemIds = editor.getMenuItems().map((item) => item.id);
  const contextIds = editor.getSelectedVisualContextActions(clip).map((item) => item.id);
  const actionValues = editor.getSelectedClipActionChoices().map((choice) => choice.value);
  assert.equal(itemIds.includes('board-color'), false);
  assert.equal(itemIds.includes('opacity'), false);
  assert.equal(contextIds.includes('board-color'), true);
  assert.equal(contextIds.includes('opacity'), true);
  assert.equal(actionValues.includes('board-color'), true);
  assert.equal(actionValues.includes('opacity'), true);

  await editor.editSelectedBoardColor();
  assert.equal(clip.color, '#778899');

  editor.requestText = async () => '45';
  await editor.editSelectedOpacity();
  assert.equal(clip.opacity, 0.45);

  clip.keyframes = [{
    timeMs: 1000,
    manual: true,
    x: clip.x,
    y: clip.y,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 0.8,
    w: clip.w,
    h: clip.h
  }];
  editor.selectKeyframe(clip, 1000);
  editor.requestText = async () => '25';
  await editor.editSelectedOpacity();

  assert.equal(clip.opacity, 0.45);
  assert.equal(clip.keyframes[0].opacity, 0.25);
});

test('cutscene editor exposes text justification and axis scale controls', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      text: 'Readout',
      textAlign: 'right',
      scaleX: 1.25,
      scaleY: 0.75,
      aspectLocked: false
    }]
  });
  editor.selectedClipId = 'text';
  editor.activeMenuTab = 'clip';
  const itemIds = editor.getMenuItems().map((item) => item.id);
  const contextIds = editor.getSelectedVisualContextActions(editor.getSelectedClip()).map((item) => item.id);
  const actionValues = editor.getSelectedClipActionChoices().map((choice) => choice.value);

  assert.equal(itemIds.includes('edit-text'), false);
  assert.equal(contextIds.includes('edit-text'), true);
  assert.equal(contextIds.includes('text-color'), true);
  assert.equal(contextIds.includes('font-size'), true);
  assert.equal(contextIds.includes('actions'), true);
  assert.equal(actionValues.includes('edit-text'), true);
  assert.equal(actionValues.includes('text-align'), true);
  assert.equal(actionValues.includes('text-border'), true);
  assert.equal(actionValues.includes('text-border-color'), true);
  assert.equal(actionValues.includes('text-border-size'), true);
  assert.equal(actionValues.includes('scale-x'), true);
  assert.equal(actionValues.includes('scale-y'), true);
});

test('cutscene editor new text defaults to 8px and uses color picker for text color', async () => {
  const editor = createMobileCutsceneEditor();
  editor.requestText = async () => 'Meanwhile...';

  await editor.addTextClip();

  assert.equal(editor.getSelectedClip().fontSize, 8);
  assert.equal(editor.getSelectedClip().keyframes.length, 0);
  assert.equal(editor.getSelectedClip().textBorderEnabled, true);
  assert.equal(editor.getSelectedClip().textBorderColor, '#000000');
  assert.equal(editor.getSelectedClip().textBorderSize, 1);

  let pickerOptions = null;
  editor.openColorPicker = async (options) => {
    pickerOptions = options;
    return '#33ccff';
  };
  await editor.editSelectedTextColor();

  assert.equal(pickerOptions.title, 'Text Color');
  assert.equal(pickerOptions.initialValue, '#ffffff');
  assert.equal(editor.getSelectedClip().color, '#33ccff');
});

test('cutscene editor adds multiple multiline text clips on the shared text layer', async () => {
  const paragraph = `THE LAST MESSAGE I RECEIVED
WAS FROM DOM.

THREE THOUSAND KILOMETERS AWAY,
HE AND HIS WIFE WERE STILL ALIVE.

I GUIDED THEM THROUGH SURVIVAL
AS BEST I COULD.

THEY WERE MY LAST CONNECTION
TO THE OLD WORLD.`;
  const editor = createMobileCutsceneEditor();
  const prompts = [];
  const inputs = ['First caption', paragraph];
  editor.requestText = async (options) => {
    prompts.push(options);
    return inputs.shift();
  };

  await editor.addTextClip();
  await editor.addTextClip();

  const textClips = editor.document.clips.filter((clip) => clip.type === 'text');
  assert.equal(textClips.length, 2);
  assert.notEqual(textClips[0].id, textClips[1].id);
  assert.equal(textClips.every((clip) => clip.layerId === 'text'), true);
  assert.equal(textClips[1].text, paragraph);
  assert.equal(textClips[1].h > textClips[0].h, true);
  assert.equal(prompts.every((options) => options.multiline === true), true);
  assert.equal(prompts.every((options) => options.inputType === 'textarea'), true);

  editor.selectedClipId = textClips[1].id;
  const firstTrackId = textClips[0].trackId;
  const secondTrackId = textClips[1].trackId;
  editor.moveSelectedTrack(-1);
  assert.deepEqual(editor.document.clips.map((clip) => clip.id), [textClips[0].id, textClips[1].id]);
  assert.deepEqual(editor.document.tracks.map((track) => track.id), [secondTrackId, firstTrackId]);
  assert.equal(editor.document.clips.every((clip) => clip.layerId === 'text'), true);
});

test('cutscene editor edits text content and text border settings', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'caption',
      type: 'text',
      text: 'Old text',
      textBorderEnabled: true,
      textBorderColor: '#000000',
      textBorderSize: 1
    }]
  });
  editor.selectedClipId = 'caption';
  editor.requestText = async ({ title }) => {
    if (title === 'Edit Text') return 'New text';
    if (title === 'Border Size') return '2';
    return '';
  };
  editor.openColorPicker = async () => '#112233';

  await editor.editSelectedTextContent();
  editor.toggleSelectedTextBorder();
  await editor.editSelectedTextBorderColor();
  await editor.editSelectedTextBorderSize();

  const clip = editor.getSelectedClip();
  assert.equal(clip.text, 'New text');
  assert.equal(clip.textBorderEnabled, true);
  assert.equal(clip.textBorderColor, '#112233');
  assert.equal(clip.textBorderSize, 2);
});

test('cutscene text border renders before crisp bitmap text and can be disabled', () => {
  const doc = normalizeCutsceneDocument({
    clips: [{
      id: 'caption',
      type: 'text',
      text: 'A',
      startMs: 0,
      durationMs: 1000,
      x: 128,
      y: 72,
      w: 80,
      h: 24,
      fontSize: 8,
      color: '#ffffff',
      textBorderEnabled: true,
      textBorderColor: '#000000',
      textBorderSize: 1
    }]
  });
  const ctx = createRecordingContext();
  drawCutsceneDocument(ctx, doc, 100, { x: 0, y: 0, w: 256, h: 144 });
  const borderIndex = ctx.calls.findIndex((call) => call.fillStyle === '#000000');
  const textIndex = ctx.calls.findIndex((call) => call.fillStyle === '#ffffff');

  assert.notEqual(borderIndex, -1);
  assert.notEqual(textIndex, -1);
  assert.equal(borderIndex < textIndex, true);

  const disabledDoc = normalizeCutsceneDocument({
    clips: [{
      ...doc.clips[0],
      textBorderEnabled: false
    }]
  });
  const disabledCtx = createRecordingContext();
  drawCutsceneDocument(disabledCtx, disabledDoc, 100, { x: 0, y: 0, w: 256, h: 144 });
  assert.equal(disabledCtx.calls.some((call) => call.fillStyle === '#000000'), false);
  assert.equal(disabledCtx.calls.some((call) => call.fillStyle === '#ffffff'), true);
});

test('cutscene editor new actor clips start without visible transform keyframes', async () => {
  resetProjectFilesForTests();
  saveProjectFile('actors', 'skitter', {
    states: [{
      id: 'idle',
      name: 'Idle',
      animation: {
        frames: [{ duration: 100, imageDataUrl: pngDataUrl(16, 16) }]
      }
    }]
  });
  const editor = createMobileCutsceneEditor();

  await editor.addActorClip();

  assert.equal(editor.getSelectedClip().type, 'actor');
  assert.equal(editor.getSelectedClip().keyframes.length, 0);
});

test('cutscene editor axis scale respects aspect lock', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'image',
      type: 'image',
      w: 100,
      h: 50,
      scaleX: 1,
      scaleY: 1,
      aspectLocked: true
    }]
  });
  editor.selectedClipId = 'image';
  editor.requestText = async () => '1.5';

  await editor.editSelectedAxisScale('x');

  assert.equal(editor.getSelectedClip().scaleX, 1.5);
  assert.equal(editor.getSelectedClip().scaleY, 1.5);

  editor.toggleSelectedAspectLock();
  editor.requestText = async () => '0.5';
  await editor.editSelectedAxisScale('y');

  assert.equal(editor.getSelectedClip().aspectLocked, false);
  assert.equal(editor.getSelectedClip().scaleX, 1.5);
  assert.equal(editor.getSelectedClip().scaleY, 0.5);
});

test('cutscene editor reset transform clears active keyframe transform and fx', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{
      id: 'text',
      type: 'text',
      fx: { type: 'sine-wobble', amount: 0.4 },
      x: 10,
      y: 10,
      scale: 2,
      scaleX: 1.5,
      scaleY: 0.5,
      rotation: 1,
      opacity: 1,
      w: 20,
      h: 20
    }]
  });
  editor.selectedClipId = 'text';

  editor.resetSelectedTransform();

  assert.equal(editor.getSelectedClip().scale, 1);
  assert.equal(editor.getSelectedClip().scaleX, 1);
  assert.equal(editor.getSelectedClip().scaleY, 1);
  assert.equal(editor.getSelectedClip().rotation, 0);
  assert.equal(editor.getSelectedClip().fx.type, 'none');
});

test('cutscene document draw handles normalized visual fx safely', () => {
  const ctx = createMockContext();
  const doc = normalizeCutsceneDocument({
    clips: [{
      id: 'fx-text',
      type: 'text',
      text: 'Wave',
      startMs: 0,
      durationMs: 1000,
      fx: { type: 'wave-y', amount: 0.25, frequency: 4, speed: 1 },
      keyframes: [
        { timeMs: 0, x: 40, y: 40, scale: 1, rotation: 0, opacity: 1, w: 80, h: 20 },
        { timeMs: 1000, x: 40, y: 40, scale: 1, rotation: 0, opacity: 1, w: 80, h: 20 }
      ]
    }]
  });

  assert.doesNotThrow(() => drawCutsceneDocument(ctx, doc, 500, { x: 0, y: 0, w: 200, h: 120 }));
});

test('cutscene editor selected clip actions expose actor keyframe and state choices', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{ id: 'actor', type: 'actor', stateId: 'idle' }]
  });
  editor.selectedClipId = 'actor';

  const actions = editor.getSelectedClipActionChoices().map((choice) => choice.value);

  assert.equal(actions.includes('set-key'), true);
  assert.equal(actions.includes('actor-state'), true);
  assert.equal(actions.includes('copy'), true);
  assert.equal(actions.includes('cut'), true);
  assert.equal(actions.includes('delete'), true);
});

test('cutscene editor selected clip ribbon exposes only options and draws tabbed options panel', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{ id: 'text', type: 'text', text: 'Readout', durationMs: 1000 }]
  });
  editor.selectedClipId = 'text';
  editor.draw(createMockContext(), 390, 844);

  assert.deepEqual(editor.bounds.contextButtons.map((button) => button.id), ['clip-options']);

  editor.handleButton('clip-options');
  await editor.pendingAction;
  assert.equal(editor.clipOptionsOpen, true);
  editor.draw(createMockContext(), 390, 844);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'clip-options-tab:keys'), true);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'clip-options-tab:edit'), true);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'clip-options-tab:track'), false);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'set-key'), true);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'delete-key'), false);

  editor.handleButton('clip-options-tab:settings');
  await editor.pendingAction;
  assert.equal(editor.clipOptionsTab, 'settings');
  editor.draw(createMockContext(), 390, 844);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'edit-text'), true);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'opacity'), true);

  editor.handleButton('clip-options-tab:edit');
  await editor.pendingAction;
  editor.draw(createMockContext(), 390, 844);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'copy'), true);
  assert.equal(editor.bounds.clipOptionButtons.some((button) => button.id === 'duplicate'), true);

  editor.handleButton('menu');
  await editor.pendingAction;
  assert.equal(editor.clipOptionsOpen, false);
  assert.equal(editor.menuOpen, false);
});

test('cutscene editor open menu outside tap closes without changing selection', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{ id: 'text', type: 'text', text: 'Readout', durationMs: 1000 }]
  });
  editor.selectedClipId = 'text';
  editor.menuOpen = true;
  editor.draw(createMockContext(), 390, 844);

  editor.handlePointerDown({ x: 12, y: 12 });

  assert.equal(editor.menuOpen, false);
  assert.equal(editor.selectedClipId, 'text');
});

test('cutscene editor bottom menu opens root after closing clip options', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{ id: 'text', type: 'text', text: 'Readout', durationMs: 1000 }]
  });
  editor.selectedClipId = 'text';
  editor.clipOptionsOpen = true;

  editor.handleButton('menu');
  await editor.pendingAction;
  assert.equal(editor.clipOptionsOpen, false);
  assert.equal(editor.menuOpen, false);

  editor.handleButton('menu');
  await editor.pendingAction;
  assert.equal(editor.menuOpen, true);
});

test('cutscene editor groups selected clip actions for mobile-friendly menus', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    clips: [{ id: 'actor', type: 'actor', stateId: 'idle' }]
  });
  editor.selectedClipId = 'actor';

  const groups = editor.getSelectedClipActionGroups();

  assert.deepEqual(groups.map((group) => group.label), ['Keyframes', 'Transform', 'Size', 'Edit']);
  assert.equal(groups.every((group) => group.choices.length <= 7), true);
  assert.equal(groups.find((group) => group.label === 'Keyframes').choices.some((choice) => choice.value === 'set-key'), true);
  assert.equal(groups.find((group) => group.label === 'Edit').choices.some((choice) => choice.value === 'delete'), true);
});

test('cutscene editor copies cuts and pastes selected clips without schema changes', () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 2000,
    clips: [{ id: 'text-1', type: 'text', text: 'Hello', startMs: 100, durationMs: 500 }]
  });
  editor.selectedClipId = 'text-1';

  editor.copySelectedClip();
  assert.equal(editor.clipboardClip.text, 'Hello');

  editor.cutSelectedClip();
  assert.equal(editor.document.clips.length, 0);

  editor.playheadMs = 750;
  editor.pasteClipboardClip();

  assert.equal(editor.document.clips.length, 1);
  assert.equal(editor.document.clips[0].text, 'Hello');
  assert.equal(editor.document.clips[0].startMs, 750);
  assert.notEqual(editor.document.clips[0].id, 'text-1');
});

test('cutscene document draw handles malformed documents and missing assets', () => {
  const ctx = createMockContext();
  assert.doesNotThrow(() => drawCutsceneDocument(ctx, {
    width: -1,
    height: 0,
    layers: [{ id: 'sprites', visible: true }],
    clips: [{ type: 'image', layerId: 'sprites', startMs: 0, durationMs: 100, assetId: 'missing' }]
  }, 20, { x: 0, y: 0, w: 120, h: 80 }));
});

test('cutscene editor avoids blocking prompt APIs', () => {
  assert.equal(cutsceneEditorSource.includes('window.prompt'), false);
});

test('cutscene editor exposes Art and Import as separate workflows', () => {
  const editor = createMobileCutsceneEditor();
  const addItems = editor.getMenuItems('add');
  const fileItems = editor.getMenuItems('file');

  assert.equal(addItems.some((item) => item.id === 'art' && item.label === 'Art'), true);
  assert.equal(fileItems.some((item) => item.id === 'import' && item.label === 'Import'), true);
  assert.equal(cutsceneEditorSource.includes("{ id: 'art', label: 'Art' }"), true);
  assert.equal(cutsceneEditorSource.includes("listProjectFiles('art')"), true);
  assert.equal(cutsceneEditorSource.includes("input.accept = 'image/*'"), true);
});

test('cutscene editor exposes actor and animation controls', () => {
  assert.equal(cutsceneEditorSource.includes("{ id: 'actor', label: 'Actor' }"), true);
  assert.equal(cutsceneEditorSource.includes("listProjectFiles('actors')"), true);
  assert.equal(cutsceneEditorSource.includes('playAnimation'), true);
  assert.equal(cutsceneEditorSource.includes('fadeInMs'), true);
});

test('level triggers and gameplay runtime support play-cutscene', () => {
  assert.equal(levelEditorSource.includes("{ id: 'play-cutscene', label: 'Play Cutscene' }"), true);
  assert.equal(levelEditorSource.includes('getTriggerCutsceneOptions()'), true);
  assert.equal(levelEditorSource.includes("base.params = { cutsceneId, pauseGameplay: true, skippable: true };"), true);
  assert.equal(gameCoreSource.includes("if (action.type === 'play-cutscene')"), true);
  assert.equal(gameCoreSource.includes("loadProjectFile('cutscenes', cutsceneId)"), true);
  assert.equal(gameCoreSource.includes('let cutsceneFinished = false;'), true);
  assert.equal(gameCoreSource.includes('if (cutsceneFinished) return;'), true);
  assert.equal(gameCoreSource.includes('const finishCutscene = () => {'), true);
  assert.equal(gameCoreSource.includes('this.triggerState.pending = this.triggerState.pending.filter((entry) => entry.triggerId !== triggerId);'), true);
  assert.equal(gameCoreSource.includes("this.stopCutsceneMidi('', { fadeMs: params.fadeMs ?? 120 });"), true);
  assert.equal(gameCoreSource.includes("this.transitionTo('playing');"), true);
  assert.equal(gameCoreSource.includes('this.cutscenePlayer.play(payload.data'), true);
  assert.equal(gameCoreSource.includes('onDone: finishCutscene'), true);
  assert.equal(gameCoreSource.includes('playCutsceneMidi(trackId'), true);
  assert.equal(gameCoreSource.includes('stopCutsceneMidi(trackId'), true);
  assert.equal(gameCoreSource.includes('playCutsceneMidiLayer(layerKey, trackId'), true);
  assert.equal(gameCoreSource.includes('setCutsceneMidiLayerVolume(layerKey, volume)'), true);
  assert.equal(gameCoreSource.includes('stopCutsceneMidiLayer(layerKey'), true);
  assert.equal(gameCoreSource.includes('this.setActiveMusicTrack(resolvedTrackId, { volume, loop: false, restart: true, offsetMs });'), true);
  assert.equal(gameCoreSource.includes('if (this.cutsceneMusicTrackId || this.cutscenePlayer?.active) return;'), true);
  assert.equal(gameCoreSource.includes('if (this.cutsceneMusicTrackId || this.cutscenePlayer?.active) {'), true);
  assert.equal(cutsceneEditorSource.includes('this.game.playCutsceneMidiLayer(clip.id, ref'), true);
  assert.equal(cutsceneEditorSource.includes('this.game.stopCutsceneMidiLayer(clip.id'), true);
  assert.equal(gameCoreSource.includes('pending: [], pendingIds: new Set()'), true);
  assert.equal(gameCoreSource.includes('this.triggerState.startupPending.delete(id);'), true);
  assert.equal(gameCoreSource.includes('state.firedStartup = true;'), true);
  assert.equal(gameCoreSource.includes('dispatchTriggerCandidates(candidates = [])'), true);
  assert.equal(gameCoreSource.includes('const cutscenes = eligible.filter(({ trigger }) => this.triggerHasCutsceneAction(trigger));'), true);
  assert.equal(gameCoreSource.includes('const ordered = [...cutscenes, ...others];'), true);
  assert.equal(gameCoreSource.includes('ordered.slice(1).forEach(({ trigger, triggerId }) => this.queuePendingTrigger(trigger, triggerId));'), true);
  assert.equal(gameCoreSource.includes('this.drainPendingTriggers();'), true);
  const pointerStart = gameCoreSource.indexOf('  _handlePointerDownByState(payload, delegate = null) {');
  const pointerEnd = gameCoreSource.indexOf('  handlePointerUp(payload)', pointerStart);
  const pointerBody = gameCoreSource.slice(pointerStart, pointerEnd);
  assert.equal(pointerBody.includes('this.cutscenePlayer.stop();'), false);
  const updateStart = gameCoreSource.indexOf('  updateWorldTriggers(tileX, tileY) {');
  const updateEnd = gameCoreSource.indexOf('  isRoomCleared(roomIndex)', updateStart);
  const updateBody = gameCoreSource.slice(updateStart, updateEnd);
  assert.ok(updateBody.indexOf('candidates.push({ trigger, triggerId: id });') < updateBody.lastIndexOf('this.dispatchTriggerCandidates(candidates);'));
  assert.equal(updateBody.includes('this.fireTrigger(trigger, id);'), false);
});

test('cutscene editor exposes ambient effects from the editor menus', () => {
  assert.equal(cutsceneEffectToWeather('snow'), 'weather-snow');
  assert.equal(cutsceneEffectToWeather('blizzard'), 'weather-blizzard');
  assert.equal(cutsceneEffectToWeather('storm'), 'weather-storm');
  assert.equal(WEATHER_PROFILES['weather-storm'].gustRate, 10);
  assert.equal(cutsceneEditorSource.includes("{ id: 'effect', label: 'Effect' }"), true);
  assert.equal(cutsceneEditorSource.includes('effectType'), true);
  assert.equal(cutsceneEditorSource.includes('drawCutsceneEffect'), true);
  assert.equal(cutsceneEditorSource.includes('drawWeatherParticles'), true);
  assert.equal(cutsceneEditorSource.includes('imageSmoothingEnabled = false'), true);
  assert.equal(cutsceneEditorSource.includes('getCutsceneWeatherRenderScale'), true);
});

test('shared weather system emits gameplay-style blizzard particles and gusts', () => {
  const state = createWeatherRuntimeState();
  const values = [0.12, 0.72, 0.34, 0.91, 0.48, 0.62, 0.2, 0.85];
  let index = 0;
  const rng = () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };

  updateWeatherSystem({
    state,
    particles: state.particles,
    weatherType: 'weather-blizzard',
    bounds: { left: 0, top: 0, right: 320, bottom: 180 },
    dt: 0.25,
    rng
  });

  assert.equal(state.particles.some((particle) => particle.style.weatherType === 'weather-blizzard' && particle.style.kind === 'weather'), true);
  assert.equal(state.particles.some((particle) => particle.style.weatherType === 'weather-blizzard' && particle.style.kind === 'gust'), true);
  assert.notEqual(state.wind.value, 0);
});

test('shared weather system allows zero intensity without spawning particles', () => {
  const state = createWeatherRuntimeState();
  updateWeatherSystem({
    state,
    particles: state.particles,
    weatherType: 'weather-snow',
    bounds: { left: 0, top: 0, right: 320, bottom: 180 },
    dt: 1,
    intensity: 0,
    windBias: 0,
    scale: 1
  });

  assert.equal(state.particles.length, 0);
});

test('cutscene editor exposes pixelated typewriter text controls and main menu exit', () => {
  assert.equal(cutsceneEditorSource.includes('drawBitmapText'), true);
  assert.equal(cutsceneEditorSource.includes("animation === 'typewriter'"), true);
  assert.equal(cutsceneEditorSource.includes("'font-size'"), true);
  assert.equal(cutsceneEditorSource.includes("'reveal-speed'"), true);
  assert.equal(cutsceneEditorSource.includes("if (id === 'back' || id === 'exit-main') this.game.exitCutsceneEditor?.();"), true);
});

test('cutscene effects use shared weather runtime state instead of seeded particle layout', () => {
  const ctx = createMockContext();
  const runtime = { weatherStates: new Map() };
  const doc = createDefaultCutscene('Weather');
  doc.clips.push({
    id: 'fx-1',
    type: 'effect',
    layerId: 'effects',
    effectType: 'blizzard',
    startMs: 0,
    durationMs: 2000
  });

  drawCutsceneDocument(ctx, doc, 500, { x: 0, y: 0, w: 320, h: 180 }, runtime);

  const state = runtime.weatherStates.get('fx-1:weather-blizzard');
  assert.ok(state);
  assert.equal(state.particles.some((particle) => particle.style.weatherType === 'weather-blizzard'), true);
  assert.equal(cutsceneEditorSource.includes('seededNoise'), false);
  assert.equal(cutsceneEditorSource.includes('updateWeatherSystem'), true);
});

test('cutscene effect keyframes interpolate opacity intensity and wind', () => {
  const doc = normalizeCutsceneDocument({
    durationMs: 3000,
    clips: [{
      id: 'fx-fade',
      type: 'effect',
      effectType: 'snow',
      startMs: 0,
      durationMs: 2000,
      opacity: 1,
      intensity: 4,
      wind: -2,
      keyframes: [
        { timeMs: 0, opacity: 1, intensity: 4, wind: -2, manual: true },
        { timeMs: 2000, opacity: 0, intensity: 0, wind: 0, manual: true }
      ]
    }]
  });

  const sample = sampleCutsceneEffectClip(doc.clips[0], 1000);
  assert.equal(sample.opacity, 0.5);
  assert.equal(sample.intensity, 2);
  assert.equal(sample.wind, -1);
});

test('cutscene audio keyframes normalize and interpolate volume', () => {
  const doc = normalizeCutsceneDocument({
    durationMs: 3000,
    clips: [{
      id: 'music',
      type: 'music',
      startMs: 500,
      durationMs: 2000,
      volume: 1,
      keyframes: [
        { timeMs: 500, manual: true, volume: 1 },
        { timeMs: 1500, manual: true, volume: 0 }
      ]
    }]
  });
  const clip = doc.clips[0];

  assert.equal(clip.keyframes.length, 2);
  assert.equal(sampleCutsceneAudioVolume(clip, 1000), 1);
  assert.equal(sampleCutsceneAudioVolume(clip, 2000), 0);
  assert.ok(sampleCutsceneAudioVolume(clip, 1500) > 0.45);
  assert.ok(sampleCutsceneAudioVolume(clip, 1500) < 0.55);
});

test('cutscene MP4 MIDI render events use clip timing and song ticks', () => {
  const doc = normalizeCutsceneDocument({
    durationMs: 3000,
    masterVolume: 0.5,
    assets: [{ id: 'music-a', type: 'music', ref: 'Theme' }],
    clips: [{
      id: 'music',
      type: 'music',
      assetId: 'music-a',
      startMs: 500,
      durationMs: 2000,
      volume: 0.8,
      keyframes: [
        { timeMs: 0, manual: true, volume: 1 },
        { timeMs: 2000, manual: true, volume: 0.5 }
      ]
    }]
  });
  const song = {
    tempo: 120,
    tracks: [{
      id: 'lead',
      volume: 0.75,
      pan: -0.25,
      program: 4,
      channel: 2,
      patterns: [{ notes: [{ startTick: 8, durationTicks: 8, pitch: 64, velocity: 0.9 }] }]
    }]
  };

  const events = collectCutsceneMidiRenderEvents(doc, (ref) => (ref === 'Theme' ? { song } : null));

  assert.equal(events.length, 1);
  assert.equal(events[0].startSec, 1);
  assert.equal(events[0].durationSec, 0.5);
  assert.equal(events[0].pitch, 64);
  assert.equal(events[0].program, 4);
  assert.equal(events[0].channel, 2);
  assert.equal(events[0].pan, -0.25);
  assert.ok(events[0].volume > 0.2);
  assert.ok(events[0].volume < 0.31);
});

test('cutscene MP4 MIDI render events honor solo tracks and drum mapping', () => {
  const doc = normalizeCutsceneDocument({
    durationMs: 2000,
    assets: [{ id: 'music-a', type: 'music', ref: 'Beat' }],
    clips: [{ id: 'music', type: 'music', assetId: 'music-a', startMs: 0, durationMs: 2000, volume: 1 }]
  });
  const song = {
    tempo: 120,
    tracks: [
      {
        id: 'muted-by-solo',
        volume: 1,
        patterns: [{ notes: [{ startTick: 0, durationTicks: 4, pitch: 60, velocity: 1 }] }]
      },
      {
        id: 'drums',
        solo: true,
        instrument: 'drums',
        program: 0,
        channel: 9,
        patterns: [{ notes: [{ startTick: 0, durationTicks: 4, pitch: 36, velocity: 1 }] }]
      }
    ]
  };

  const events = collectCutsceneMidiRenderEvents(doc, () => ({ song }));

  assert.equal(events.length, 1);
  assert.equal(events[0].trackId, 'drums');
  assert.equal(events[0].isDrum, true);
  assert.equal(events[0].channel, 9);
  assert.equal(events[0].pitch, 36);
});

test('cutscene editor exposes audio key actions and edits selected key volume', async () => {
  const editor = createMobileCutsceneEditor();
  editor.document = normalizeCutsceneDocument({
    durationMs: 3000,
    clips: [{ id: 'music', type: 'music', startMs: 0, durationMs: 2000, volume: 1 }]
  });
  editor.selectedClipId = 'music';
  editor.playheadMs = 1000;
  editor.keyframeMode = 'playhead';
  editor.setSelectedKeyframe('playhead');
  const clip = editor.getSelectedClip();
  assert.equal(clip.keyframes.length, 1);
  assert.equal(clip.keyframes[0].volume, 1);

  editor.requestText = async () => '25';
  await editor.editSelectedVolume();
  assert.equal(clip.volume, 1);
  assert.equal(clip.keyframes[0].volume, 0.25);

  const keyItems = editor.getClipOptionItems(clip, 'keys');
  const settingItems = editor.getClipOptionItems(clip, 'settings');
  assert.equal(keyItems.some((item) => item.id === 'set-key'), true);
  assert.equal(settingItems.some((item) => item.id === 'clip-duration'), false);
});

test('cutscene player layers overlapping MIDI clips without replacing earlier music', () => {
  const events = [];
  const player = new CutscenePlayer({
    playCutsceneMidiLayer(key, ref, options) { events.push(['play-layer', key, ref, options.volume, options.loop]); },
    setCutsceneMidiLayerVolume(key, volume) { events.push(['volume-layer', key, Math.round(volume * 100) / 100]); },
    stopCutsceneMidiLayer(key) { events.push(['stop-layer', key]); }
  });
  player.play({
    durationMs: 2000,
    masterVolume: 1,
    assets: [
      { id: 'music-a', type: 'music', ref: 'Intro' },
      { id: 'music-b', type: 'music', ref: 'Hit' }
    ],
    clips: [
      { id: 'bed', type: 'music', assetId: 'music-a', startMs: 0, durationMs: 1800, volume: 0.8 },
      { id: 'sting', type: 'music', assetId: 'music-b', startMs: 500, durationMs: 500, volume: 0.5 }
    ]
  });
  player.update(0.5);
  player.update(0.6);
  player.update(1);

  assert.deepEqual(events.filter((event) => event[0] === 'play-layer').map((event) => event.slice(1, 3)), [['bed', 'Intro'], ['sting', 'Hit']]);
  assert.equal(events.some((event) => event[0] === 'stop-layer' && event[1] === 'sting'), true);
  assert.equal(events.some((event) => event[0] === 'stop-layer' && event[1] === 'bed'), true);
});

test('cutscene player updates looped SFX volume from keyframes', () => {
  const events = [];
  const player = new CutscenePlayer({
    playSfxById(ref, options) { events.push(['sfx', ref, options.volume, options.key]); },
    setSfxVolumeById(ref, options) { events.push(['sfx-volume', ref, Math.round(options.volume * 100) / 100, options.key]); },
    stopSfxById(ref, options) { events.push(['sfx-stop', ref, options?.key]); }
  });
  player.play({
    durationMs: 1200,
    assets: [{ id: 'sfx-a', type: 'sfx', ref: 'Wind' }],
    clips: [{
      id: 'wind',
      type: 'sfx',
      assetId: 'sfx-a',
      startMs: 0,
      durationMs: 1000,
      loop: true,
      volume: 1,
      keyframes: [
        { timeMs: 0, manual: true, volume: 1 },
        { timeMs: 1000, manual: true, volume: 0 }
      ]
    }]
  });
  player.update(0.5);
  player.update(0.6);

  assert.deepEqual(events[0], ['sfx', 'Wind', 1, 'wind']);
  assert.equal(events.some((event) => event[0] === 'sfx-volume' && event[1] === 'Wind' && event[3] === 'wind'), true);
  assert.equal(events.some((event) => event[0] === 'sfx-stop' && event[1] === 'Wind' && event[2] === 'wind'), true);
});

test('cutscene effect opacity fades rendered weather particles', () => {
  const alphaValues = [];
  const ctx = createMockContext();
  ctx.save = () => {};
  ctx.restore = () => {};
  Object.defineProperty(ctx, 'globalAlpha', {
    get() { return alphaValues.length ? alphaValues[alphaValues.length - 1] : 1; },
    set(value) { alphaValues.push(value); }
  });
  const runtime = { weatherStates: new Map() };
  const doc = createDefaultCutscene('Weather Fade');
  doc.clips.push({
    id: 'fx-fade',
    type: 'effect',
    layerId: 'effects',
    effectType: 'snow',
    startMs: 0,
    durationMs: 2000,
    intensity: 4,
    keyframes: [
      { timeMs: 0, opacity: 1, intensity: 4, wind: 0, manual: true },
      { timeMs: 2000, opacity: 0, intensity: 0, wind: 0, manual: true }
    ]
  });

  drawCutsceneDocument(ctx, doc, 1000, { x: 0, y: 0, w: 320, h: 180 }, runtime);

  assert.equal(alphaValues.some((value) => Math.abs(value - 0.5) < 0.001), true);
});

test('cutscene weather changes do not reuse stale rain particles in fullscreen export scale', () => {
  const ctx = createMockContext();
  const runtime = { weatherStates: new Map() };
  const doc = createDefaultCutscene('Weather Change');
  doc.clips.push({
    id: 'fx-1',
    type: 'effect',
    layerId: 'effects',
    effectType: 'rain',
    startMs: 0,
    durationMs: 2000
  });

  drawCutsceneDocument(ctx, doc, 500, { x: 0, y: 0, w: 1920, h: 1080 }, runtime, { fit: 'cover' });
  assert.equal(runtime.weatherStates.get('fx-1:weather-rain')?.particles.some((particle) => particle.style.weatherType === 'weather-rain'), true);

  doc.clips[0].effectType = 'snow';
  drawCutsceneDocument(ctx, doc, 500, { x: 0, y: 0, w: 1920, h: 1080 }, runtime, { fit: 'cover' });
  const snowState = runtime.weatherStates.get('fx-1:weather-snow');

  assert.ok(snowState);
  assert.equal(snowState.particles.some((particle) => particle.style.weatherType === 'weather-rain'), false);
  assert.equal(snowState.particles.some((particle) => particle.style.weatherType === 'weather-snow'), true);
  assert.equal(snowState.particles.some((particle) => particle.style.weatherType === 'weather-snow' && particle.style.vy > 200), true);
});
