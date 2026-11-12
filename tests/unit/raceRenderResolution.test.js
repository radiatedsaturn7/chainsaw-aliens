import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';

function makeRendererEditor(t) {
  const priorDocument = globalThis.document;
  globalThis.document = { createElement() { throw new Error('a cached renderer must be reused'); } };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  });
  const editor = Object.create(RaceEditor.prototype);
  let resizeCount = 0;
  const canvas = { width: 1, height: 1 };
  const renderer = {
    canvas, camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(),
    staticWorldKey: 'prepared', staticTerrainTriangles: 1, staticPolygons: 1, staticDrawCalls: 1,
    threeRenderer: {
      setSize(width, height) { canvas.width = width; canvas.height = height; resizeCount++; },
      clear() {}, render() {}
    }
  };
  editor.raceThreeWorldRenderer = renderer;
  editor.raceWebGLTrackDynamicScale = 1;
  editor.getRaceGroundScanlineSettings = () => ({ resolution: 50 });
  return { editor, renderer, resizeCount: () => resizeCount };
}

test('viewport capability and draw sizing reuse the actual half-resolution target', t => {
  const { editor, renderer, resizeCount } = makeRendererEditor(t);
  const bounds = { x: 0, y: 0, w: 1920, h: 1080 };
  assert.equal(editor.getRaceThreeWorldRendererForViewport(bounds), renderer);
  assert.deepEqual(renderer.canvas, { width: 960, height: 540 });
  for (let frame = 0; frame < 10; frame++) {
    editor.getRaceThreeWorldRendererForViewport(bounds);
    editor.getRaceThreeWorldRendererForViewport(bounds, editor.getRaceWebGLTrackRenderResolution({ resolution: 50 }));
  }
  assert.equal(resizeCount(), 1, 'capability checks must not resize back to full resolution');
  editor.raceWebGLTrackDynamicScale = 0.8;
  editor.getRaceThreeWorldRendererForViewport(bounds);
  assert.deepEqual(renderer.canvas, { width: 768, height: 432 });
  assert.equal(resizeCount(), 2);
});

test('scaled Three world keeps logical camera, sprite bounds and compositing coordinates', t => {
  const { editor, renderer, resizeCount } = makeRendererEditor(t);
  const bounds = { x: 17, y: 23, w: 1001, h: 701 };
  const composite = [];
  let spriteBounds;
  const ctx = { imageSmoothingEnabled: true, drawImage(...args) { composite.push(args); } };
  Object.assign(editor, {
    getNowMs: () => 0,
    getRaceThreeStaticWorldKey: () => 'prepared',
    getRaceForwardVector: () => ({ x: 0, z: 1 }),
    getRaceThreeElevationM: () => 2,
    getRaceThreeCameraFov: () => 62,
    getRaceThreeCameraLookDropScale: () => 1,
    alignRaceThreeCameraHorizon() {}, clearRaceThreeDynamicCar() {}, syncRaceThreeAiModels() {},
    addRaceThreeDoodads() {}, syncRaceThreeDecals() {}, syncRaceTileModels() {},
    syncRaceThreeTireTracks() {}, syncRaceThreeTrackState() {},
    updateRaceSnowEnvironmentRenderField: () => [], syncRaceThreeEnvironmentSnow: () => false,
    syncRaceThreeCarSprites(_renderer, logicalBounds) { spriteBounds = logicalBounds; },
    getRaceSessionCar: () => ({}), getRaceCarDimensions: () => ({ widthM: 2, lengthM: 4 }),
    raceHeadlightsEnabled: () => false
  });
  // Exercise the early capability check and the actual scene draw in one frame.
  editor.getRaceThreeWorldRendererForViewport(bounds);
  const stats = {};
  assert.equal(editor.drawRaceThreeWorldScene(ctx, bounds, [{}], {
    camera: { x: 0, z: 0 }, tileMap: {}, weatherState: {}, stats
  }), true);
  assert.deepEqual(renderer.canvas, { width: 501, height: 351 });
  assert.equal(resizeCount(), 1);
  assert.equal(renderer.camera.aspect, 1001 / 701, 'rounding the target must not change perspective');
  assert.equal(spriteBounds, bounds);
  assert.deepEqual(composite[0], [renderer.canvas, 17, 23, 1001, 701]);
  assert.equal(ctx.imageSmoothingEnabled, true);
  assert.equal(stats.webglRenderWidth, 501);
  assert.equal(stats.webglRenderHeight, 351);
  assert.equal(stats.effectiveRenderScaleX, 501 / 1001);
  assert.equal(stats.effectiveRenderScaleY, 351 / 701);
});

test('slow simulation frames cannot lower configured resolution or change sharpness across pause',()=>{
 const editor=Object.create(RaceEditor.prototype);
 editor.playtestSession={running:true};editor.getRaceGroundRenderer=()=> 'webgl-track';
 editor.raceWebGLTrackDynamicScale=1;
 for(const paused of [false,true,false]){
  editor.raceInput={paused};
  for(let i=0;i<60;i++){
   editor.lastRacePlaytestFpsMs=0;
   editor.updateRacePlaytestFps(paused?1/60:1/25);
   assert.equal(editor.getRaceWebGLTrackRenderResolution({resolution:75}),.75);
  }
 }
});
