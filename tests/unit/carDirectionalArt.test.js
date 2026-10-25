import * as THREE from '../../src/vendorBridge/three.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { RACE_CAR_SHELL_FRAME_SLOTS as slots } from '../../src/racing/raceData.js';
import { CAR_EXTERIOR_COMPONENTS as components, getCarViewSlot, getCarViewCameraYaw, resolveCarAngleLayers } from '../../src/racing/CarDirectionalArt.js';

const editor = () => {
  const e = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  e.selectedCar.art.mirrorAngleEdits = false; // Independent-angle editing coverage.
  return e;
};
function context() {
  const images = [];
  return new Proxy({ images, globalAlpha: 1, measureText: (s) => ({ width: String(s).length * 6 }),
    drawImage: (canvas) => images.push(canvas.ref), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (target, key) => key in target ? target[key] : () => {}
  });
}
function populate(e) {
  for (const slot of slots) for (const component of components) e.setCarAngleArt(component, slot, `${slot}-${component}`);
}

test('eight physical camera bearings select front, rear, and both sides without steering bias', () => {
  assert.equal(getCarViewSlot(0, 0), 'rear');
  assert.equal(getCarViewSlot(0, Math.PI), 'front');
  assert.equal(getCarViewSlot(0, -Math.PI / 2), 'right');
  assert.equal(getCarViewSlot(0, Math.PI / 2), 'left');
  for (const yaw of [0, 0.7, -3.1, 8]) for (const slot of slots) {
    assert.equal(getCarViewSlot(yaw, getCarViewCameraYaw(slot, yaw)), slot);
  }
});

test('all 32 graphic assignments survive the car document save/load path', () => {
  const e = editor();
  populate(e);
  const document = JSON.parse(JSON.stringify(e.serializeSelectedCarDocument()));
  const reopened = e.normalizeLoadedCarDocument(document.car);
  for (const slot of slots) {
    const car = resolveCarAngleLayers(reopened, slot);
    const choice = e.getRaceCarProjectedArtRef(car, 0, getCarViewCameraYaw(slot), { steering: 1, reversing: true });
    assert.equal(choice.artRef, `${slot}-body`);
    assert.equal(choice.viewSlot, slot);
    assert.equal(e.getCarTireArtEntry(car).artRef, `${slot}-tires`);
    assert.equal(car.art.brakeLightArtRef, `${slot}-brakes`);
    assert.equal(car.art.shadowArtRef, `${slot}-shadow`);
  }
  assert.equal(e.collectRaceCarArtRefs(reopened).filter((ref) => slots.some((slot) => ref.startsWith(`${slot}-`))).length, 32);
});

test('assigning and resetting one angle preserves the other angles and legacy defaults', async () => {
  const e = editor();
  e.setSelectedCarArtRef('body', 'legacy-body');
  e.selectedCarShellFrameSlot = 'right';
  await e.openCarArtPickerForComponent('body');
  assert.equal(e.selectedCar.art.body, 'legacy-body');
  assert.equal(e.getRaceCarProjectedArtRef(e.selectedCar, 0, getCarViewCameraYaw('front')).artRef, 'legacy-body');
  assert.equal(e.getCarEditorPreviewBodyArtRef(), 'Test body Art');
  e.setCarAngleArt('body', 'left', 'left-body');
  e.resetCarAngleArt('body');
  assert.equal(e.getRaceCarProjectedArtRef(e.selectedCar, 0, getCarViewCameraYaw('right')).artRef, null);
  assert.equal(e.getRaceCarProjectedArtRef(e.selectedCar, 0, getCarViewCameraYaw('left')).artRef, 'left-body');
  const reopened = e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument().car);
  assert.equal(reopened.art.angleLayers.right.body.artRef, null);
});

test('both camera controls wrap around eight angles and leave racing camera settings alone', () => {
  const e = editor();
  e.activeRootId = 'art';
  e.activeAction = 'body-art';
  const session = { carEditorPreview: true, carYaw: 0.8, launchLockMs: 2000 };
  const visited = new Set();
  for (let i = 0; i < 8; i++) {
    const yaw = e.getRacePlaytestCameraYaw(session);
    visited.add(getCarViewSlot(session.carYaw, yaw));
    e.cycleCarShellFrameSlot(1);
  }
  assert.equal(visited.size, 8);
  assert.equal(e.selectedCarShellFrameSlot, 'front');
  e.cycleCarShellFrameSlot(-1);
  assert.equal(e.selectedCarShellFrameSlot, 'frontLeft');
  assert.equal(e.getRacePlaytestCameraYaw({ ...session, carEditorPreview: false }), 0.8);
  e.activeAction = 'car-art-interior';
  assert.equal(e.getRacePlaytestCameraYaw(session), 0.8);
});

test('angle controls and component sliders fit narrow and wide exterior panels', () => {
  for (const [width, height] of [[224, 170], [360, 190], [430, 240]]) for (const component of components) {
    const e = editor();
    e.activeRootId = 'art'; e.carArtActiveComponent = component;
    e.drawCarEditorActivePanel(context(), { x: 0, y: 0, w: width, h: height });
    for (const id of ['car-angle-left', 'car-angle-right', ...(component==='brakes'?['car-fx-select','car-fx-properties']:[`car-art-pick-${component}`, `car-art-reset-${component}`])]) {
      const button = e.buttons.find((b) => b.id === id);
      assert.ok(button, `${component}: ${id}`);
      assert.ok(button.bounds.x >= 0 && button.bounds.x + button.bounds.w <= width, id);
    }
    const tabs = e.buttons.find((b) => b.id === `car-art-tab-${component}`).bounds;
    for (const region of e.carArtSliderRegions) assert.ok(region.y + region.h <= tabs.y,
      `${width}x${height} ${component} ${region.id} overlaps tabs`);
    e.buttons.find((b) => b.id === 'car-angle-right').onClick();
    assert.equal(e.selectedCarShellFrameSlot, 'frontRight');
  }
});

test('the shared renderer draws body, tires, brakes and shadow from the same view', () => {
  const e = editor(); populate(e);
  e.getRaceArtSpriteCanvas = (ref) => ({ ref, width: 32, height: 32 });
  e.getRaceCarBillboardLayerCanvas = (canvas) => canvas;
  e.drawScrolledCarTireArt = (ctx, canvas) => ctx.drawImage(canvas);
  for (const slot of slots) {
    const ctx = context();
    e.drawRaceCarBillboardLayers(ctx, { car: e.selectedCar,
      artChoice: e.getRaceCarProjectedArtRef(e.selectedCar, 0, getCarViewCameraYaw(slot)), braking: true });
    for (const component of components) assert.ok(ctx.images.includes(`${slot}-${component}`), `${slot} ${component}`);
    assert.ok(ctx.images.every((ref) => ref.startsWith(`${slot}-`)));
  }
});

test('procedural body remains visible when only directional tires or shadow are assigned', () => {
  const e = editor();
  e.setCarAngleArt('tires', 'right', 'right-tires');
  e.setCarAngleArt('shadow', 'right', 'right-shadow');
  const session = { carYaw: 0, cameraYaw: -Math.PI / 2, cameraView: 'third-person', worldX: 0, worldZ: 0 };
  e.getRacePlayerRenderPose = () => ({ yaw: 0, x: 0, z: 0, elevation: 0 });
  e.getRaceSessionDamage = () => ({});
  const options = e.getRacePlayerDynamicCarRenderOptions({ session, car: e.selectedCar, cameraYaw: session.cameraYaw });
  assert.equal(options.drawBody, true);
  assert.equal(options.drawWheels, false);
  assert.equal(options.drawShadow, false);
});

test('exterior preview lights the brakes and centers the orbit on the car', () => {
  const e = editor();
  e.activeRootId = 'art'; e.activeAction = 'body-art';
  const session = { carEditorPreview: true, carYaw: 0.6, cameraView: 'third-person', worldX: 4, worldZ: 8 };
  e.getRacePlayerRenderPose = () => ({ yaw: 0.6, x: 4, z: 8, elevation: 0 });
  e.getRaceSessionDamage = () => ({});
  assert.equal(e.getRacePlayerDynamicCarRenderOptions({ session, car: e.selectedCar }).braking, true);
  const anchor = e.getRaceThirdPersonCameraAnchor(session, { carWorldX: 4, carWorldZ: 8, cameraView: 'third-person' });
  assert.equal(anchor.x, 4);
  assert.equal(anchor.z, 8);
});

test('body frame selection updates only the selected angle and its menu label', () => {
  const e = editor(); populate(e);
  e.selectedCarShellFrameSlot = 'frontRight';
  e.adjustCarShellFrameIndex(1);
  assert.equal(e.getCarEditorPreviewBodyFrameIndex(), 1);
  assert.ok(e.getCarShellFrameMenuLabel().includes('Frame 1'));
  assert.equal(e.selectedCar.art.angleLayers.front.body.frameIndex, 0);
});

test('each angle keeps every component size, offset, graphic, and visibility independent after save/load', () => {
  const e = editor(); populate(e);
  const baseline = structuredClone(e.selectedCar.art);
  for (const [index, slot] of slots.entries()) {
    e.selectedCarShellFrameSlot = slot;
    for (const id of ['body-x', 'body-y', 'tire-x', 'tire-y', 'brake-x', 'brake-y', 'shadow-x', 'shadow-y']) e.setCarArtScaleValue(id, 1 + index * 0.2);
    for (const id of ['body-offset-x', 'body-offset-y', 'front-offset-x', 'front-offset-y', 'rear-offset-x', 'rear-offset-y', 'brake-offset-x', 'brake-offset-y', 'shadow-offset-x', 'shadow-offset-y']) e.setCarArtScaleValue(id, index * 0.1);
    if (index % 2) for (const component of ['body', 'brakes', 'shadow']) e.toggleCarArtLayer(component);
    e.setCarTireVisibilityMode(['hidden', 'front', 'rear', 'visible'][index % 4]);
  }
  const restored = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  for (const [index, slot] of slots.entries()) {
    const car = resolveCarAngleLayers(restored, slot);
    for (const field of ['bodyScaleX', 'bodyScaleY', 'tireScaleX', 'tireScaleY', 'brakeLightScaleX', 'brakeLightScaleY', 'shadowScaleX', 'shadowScaleY']) assert.equal(car.art[field], 1 + index * 0.2, `${slot} ${field}`);
    for (const value of Object.values(e.getCarArtOffsets(car))) assert.equal(value, index * 0.1, slot);
    for (const component of ['body', 'brakes', 'shadow']) assert.equal(e.getCarArtLayerVisibility(car)[component], index % 2 === 0, `${slot} ${component}`);
    assert.equal(e.getCarTireVisibilityMode(car), ['hidden', 'front', 'rear', 'visible'][index % 4]);
    assert.equal(e.getRaceCarProjectedArtRef(car, 0, getCarViewCameraYaw(slot)).artRef, `${slot}-body`);
  }
  for (const key of Object.keys(baseline).filter((key) => key !== 'angleLayers' && key !== 'interior' && key !== 'turnFrames')) assert.deepEqual(e.selectedCar.art[key], baseline[key], `global ${key}`);
});

test('transform-only and visibility-only overrides inherit artwork and remain partial after normalization', () => {
  const e = editor();
  e.setSelectedCarArtRef('body', 'legacy');
  e.selectedCarShellFrameSlot = 'left';
  e.setCarArtScaleValue('body-x', 2);
  e.toggleCarArtLayer('shadow');
  const restored = e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument().car);
  assert.equal(Object.hasOwn(restored.art.angleLayers.left.body, 'artRef'), false);
  assert.equal(e.getRaceCarProjectedArtRef(restored, 0, getCarViewCameraYaw('left')).artRef, 'legacy');
  assert.equal(resolveCarAngleLayers(restored, 'left').art.bodyScaleX, 2);
  assert.equal(resolveCarAngleLayers(restored, 'right').art.bodyScaleX, 1);
});

test('changing artwork preserves that view’s overrides and resetting size preserves graphics and visibility', () => {
  const e = editor(); populate(e);
  e.selectedCarShellFrameSlot = 'rear';
  e.setCarArtScaleValue('body-x', 2.5);
  e.setCarArtScaleValue('body-offset-y', -0.6);
  e.toggleCarArtLayer('body');
  e.setCarAngleArt('body', 'rear', 'replacement');
  assert.equal(e.getCarEditorAngleCar().art.bodyScaleX, 2.5);
  assert.equal(e.getCarEditorAngleCar().art.bodyOffsetY, -0.6);
  e.resetCarArtComponentTransform('body');
  assert.equal(e.getCarEditorAngleCar().art.bodyScaleX, 1);
  assert.equal(e.getCarEditorAngleCar().art.bodyOffsetY, 0);
  assert.equal(e.getCarArtLayerVisibility(e.getCarEditorAngleCar()).body, false);
  assert.equal(e.selectedCar.art.angleLayers.rear.body.artRef, 'replacement');
  assert.equal(e.selectedCar.art.angleLayers.front.body.artRef, 'front-body');
  e.setCarArtScaleValue('body-x', 1.8);
  e.resetCarAngleArt('body');
  assert.equal(e.getCarEditorAngleCar().art.bodyScaleX, 1.8);
});

test('view switching restores panel values and updates the active preview immediately', () => {
  const e = editor();
  e.carEditorPreviewPlaytest = { carId: e.selectedCar.id, session: { runtimeCar: structuredClone(e.selectedCar) } };
  e.selectedCarShellFrameSlot = 'front';
  e.setCarArtScaleValue('body-x', 2);
  e.selectedCarShellFrameSlot = 'right';
  e.setCarArtScaleValue('body-x', 3);
  const drawn = [];
  e.drawCarArtSlider = (_ctx, region, _label, value) => drawn.push({ id: region.id, value });
  e.activeRootId = 'art';
  for (const [slot, expected] of [['front', 2], ['right', 3], ['rear', 1]]) {
    e.selectedCarShellFrameSlot = slot;
    drawn.length = 0;
    e.drawCarEditorActivePanel(context(), { x: 0, y: 0, w: 360, h: 240 });
    assert.equal(drawn.find((r) => r.id === 'body-x').value, expected);
  }
  assert.equal(e.carEditorPreviewPlaytest.session.runtimeCar.art.angleLayers.right.body.transforms.bodyScaleX, 3);
});

test('the renderer applies per-view transforms and visibility including explicitly hidden default shadows', () => {
  const e = editor(); populate(e);
  e.selectedCarShellFrameSlot = 'right';
  e.setCarArtScaleValue('body-x', 2);
  e.toggleCarArtLayer('brakes');
  e.toggleCarArtLayer('shadow');
  e.setCarTireVisibilityMode('front');
  e.getRaceArtSpriteCanvas = (ref) => ({ ref, width: 32, height: 32 });
  const widths = [];
  e.getRaceCarBillboardLayerCanvas = (canvas, width) => { widths.push({ ref: canvas.ref, width }); return canvas; };
  e.drawScrolledCarTireArt = (ctx, canvas) => ctx.drawImage(canvas);
  for (const slot of ['right', 'left']) {
    const ctx = context(); widths.length = 0;
    e.drawRaceCarBillboardLayers(ctx, { car: e.selectedCar, baseWidth: 100,
      artChoice: e.getRaceCarProjectedArtRef(e.selectedCar, 0, getCarViewCameraYaw(slot)), braking: true });
    assert.equal(widths.find((w) => w.ref === `${slot}-body`).width, slot === 'right' ? 200 : 100);
    assert.equal(ctx.images.includes(`${slot}-brakes`), slot !== 'right');
    assert.equal(ctx.images.includes(`${slot}-shadow`), slot !== 'right');
    assert.equal(ctx.images.filter((ref) => ref === `${slot}-tires`).length, 2);
  }
  e.resetCarAngleArt('shadow');
  const ctx = context(); let shadows = 0;
  ctx.ellipse = () => shadows++;
  e.drawRaceCarBillboardLayers(ctx, { car: e.selectedCar,
    artChoice: e.getRaceCarProjectedArtRef(e.selectedCar, 0, getCarViewCameraYaw('right')), forceDefaultShadowLayer: true });
  assert.equal(shadows, 0);
});

test('Three.js procedural wheels and body honor per-angle visibility when artwork is absent', () => {
  const e = editor();
  e.selectedCarShellFrameSlot = 'right';
  e.setCarTireVisibilityMode('front');
  e.toggleCarArtLayer('body'); e.toggleCarArtLayer('brakes');
  const renderer = { scene: new THREE.Scene() };
  e.getRaceThreeSolidMaterial = () => new THREE.MeshBasicMaterial();
  e.getRaceCompositedSurfaceAtWorldPoint = () => ({ elevation: 0 });
  e.getRaceWheelVisualCenterPositions = () => ({ fl: {}, fr: {}, rl: {}, rr: {} });
  const rightCar = e.getCarEditorAngleCar();
  e.addRaceThreeProceduralCar(renderer, { car: rightCar, drawShadow: false });
  assert.deepEqual(Object.keys(renderer.dynamicCarGroup.userData.parts.wheels).sort(), ['fl', 'fr']);
  assert.equal(renderer.dynamicCarGroup.userData.parts.body, null);
  assert.equal(renderer.dynamicCarGroup.userData.parts.taillights.length, 0);
  // The cached renderer must rebuild when changing to a view with different visibility.
  e.selectedCarShellFrameSlot = 'left';
  e.addRaceThreeProceduralCar(renderer, { car: e.getCarEditorAngleCar(), drawShadow: false });
  assert.equal(Object.keys(renderer.dynamicCarGroup.userData.parts.wheels).length, 4);
  assert.ok(renderer.dynamicCarGroup.userData.parts.body);
  assert.equal(renderer.dynamicCarGroup.userData.parts.taillights.length, 2);
});

test('fitted body uses car height and rotates only its artwork at the selected angle', () => {
  const e = editor();
  e.setCarAngleArt('body', 'frontRight', 'fitted');
  const entry = e.selectedCar.art.angleLayers.frontRight.body;
  entry.fitToCar = true;
  entry.transforms = { bodyScaleX: 2, bodyScaleY: 1.5, bodyRotationDeg: 12 };
  e.getRaceArtSpriteCanvas = () => ({ ref: 'fitted', width: 40, height: 20 });
  const sizes = [], rotations = [];
  e.getRaceCarBillboardLayerCanvas = (canvas,w,h) => { sizes.push([w,h]); return canvas; };
  const ctx = context(); ctx.rotate = angle => rotations.push(angle);
  e.drawRaceCarBillboardLayers(ctx, { car: e.selectedCar, baseWidth: 100, baseHeight: 80,
    bodyBaseWidth: 100, bodyBaseHeight: 80, bodyRotationRad: 0.1,
    drawWheels: false, drawShadowLayer: false,
    artChoice: { artRef: 'fitted', viewSlot: 'frontRight', frameIndex: 0 } });
  assert.deepEqual(sizes[0], [200,120]);
  assert.ok(rotations.some(angle => Math.abs(angle - (0.1 + 12 * Math.PI / 180)) < 1e-9));
  const restored = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  assert.equal(resolveCarAngleLayers(restored, 'frontRight').art.bodyRotationDeg, 12);
  assert.notEqual(resolveCarAngleLayers(restored, 'front').art.bodyRotationDeg, 12);
  e.selectedCarShellFrameSlot = 'frontRight';
  e.resetCarArtComponentTransform('body');
  assert.equal(e.getCarEditorAngleCar().art.bodyRotationDeg, 12);
});

test('expanded exterior offsets survive save/load and reach the renderer without old clamps', () => {
  const e = editor();
  e.selectedCarShellFrameSlot = 'frontRight';
  for (const [id, field] of [['body-offset-x','bodyOffsetX'], ['body-offset-y','bodyOffsetY'], ['front-offset-x','frontTireOffsetX'], ['rear-offset-y','rearTireOffsetY'], ['brake-offset-x','brakeLightOffsetX'], ['shadow-offset-y','shadowOffsetY']]) {
    e.setCarArtScaleValue(id, -12);
    assert.equal(e.getCarEditorAngleCar().art[field], -12);
  }
  const restored = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  const offsets = e.getCarArtOffsets(resolveCarAngleLayers(restored, 'frontRight'));
  for (const key of ['bodyX','bodyY','frontTireX','rearTireY','brakeX','shadowY']) assert.equal(offsets[key], -12);
  e.setCarArtScaleValue('body-offset-x', 100);
  assert.equal(e.getCarEditorAngleCar().art.bodyOffsetX, 16);
});

test('mirrored edits link all requested pairs bidirectionally, preserve pictures and can be disabled', () => {
  const e = editor(); populate(e);
  delete e.selectedCar.art.mirrorAngleEdits;
  for (const [a,b] of [['front','rear'],['frontRight','frontLeft'],['right','left'],['rearRight','rearLeft']]) {
    e.selectedCarShellFrameSlot = a;
    e.updateCarAngleOverrides('body', { transforms: { bodyOffsetX: 9, bodyOffsetY: -11, bodyScaleX: 2, bodyRotationDeg: 7 } });
    const partner = e.selectedCar.art.angleLayers[b].body;
    assert.equal(partner.artRef, `${b}-body`);
    assert.deepEqual(partner.transforms, { bodyOffsetX: -9, bodyOffsetY: -11, bodyScaleX: 2, bodyRotationDeg: -7 });
    e.selectedCarShellFrameSlot = b;
    e.setCarArtScaleValue('body-offset-x', -6);
    assert.equal(e.selectedCar.art.angleLayers[a].body.transforms.bodyOffsetX, 6);
  }
  const restored = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  assert.equal(restored.art.mirrorAngleEdits, true);
  assert.equal(restored.art.angleLayers.left.body.transforms.bodyOffsetX, -6);
  e.selectedCar.art.mirrorAngleEdits = false;
  e.selectedCarShellFrameSlot = 'front';
  e.setCarArtScaleValue('body-offset-x', 15);
  assert.equal(e.selectedCar.art.angleLayers.rear.body.transforms.bodyOffsetX, -6);
  assert.equal(e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument().car).art.mirrorAngleEdits, false);
});

test('reset choices and rotation slider preserve unselected adjustments', () => {
  const e = editor();
  assert.equal(e.isActionAvailable('car-import-graphic'), true);
  assert.equal(e.isActionAvailable('car-art-settings'), true);
  e.setCarAngleArt('body','front','retained');
  e.setCarArtScaleValue('body-offset-x', 9);
  e.setCarArtScaleValue('body-x', 3);
  e.setCarArtScaleValue('body-rotation', 17);
  e.resetCarArtAdjustments('body', { rotation:true });
  assert.equal(e.getCarEditorAngleCar().art.bodyRotationDeg,0);
  assert.equal(e.getCarEditorAngleCar().art.bodyOffsetX,9);
  assert.equal(e.getCarEditorAngleCar().art.bodyScaleX,3);
  assert.equal(e.selectedCar.art.angleLayers.front.body.artRef,'retained');
  e.resetCarArtAdjustments('body', { position:true, scale:true });
  assert.equal(e.getCarEditorAngleCar().art.bodyOffsetX,0);
  assert.equal(e.getCarEditorAngleCar().art.bodyScaleX,1);
});

test('left/right tire visibility persists per angle and switches cached 3D wheels', () => {
  const e = editor();
  const renderer = { scene: new THREE.Scene() };
  e.getRaceThreeSolidMaterial = () => new THREE.MeshBasicMaterial();
  e.getRaceCompositedSurfaceAtWorldPoint = () => ({ elevation: 0 });
  e.getRaceWheelVisualCenterPositions = () => ({ fl: {}, fr: {}, rl: {}, rr: {} });
  for (const [mode, expected] of [['left', ['fl', 'rl']], ['right', ['fr', 'rr']], ['visible', ['fl', 'fr', 'rl', 'rr']]]) {
    e.setCarTireVisibilityMode(mode);
    const saved = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
    const car = resolveCarAngleLayers(saved, 'front');
    assert.equal(e.getCarTireVisibilityMode(car), mode);
    assert.equal(e.getCarTireVisibilityMode(resolveCarAngleLayers(saved, 'rear')), 'visible');
    e.addRaceThreeProceduralCar(renderer, { car, drawShadow: false });
    assert.deepEqual(Object.keys(renderer.dynamicCarGroup.userData.parts.wheels).sort(), expected);
  }
  e.setCarTireVisibilityMode('rear');
  for (const mode of ['left', 'right', 'visible', 'auto', 'hidden', 'front', 'rear']) {
    e.cycleCarTireVisibilityMode();
    assert.equal(e.getCarTireVisibilityMode(e.getCarEditorAngleCar()), mode);
  }
});

test('projected tire artwork draws only the selected car side', () => {
  const e = editor(); populate(e);
  e.getRaceArtSpriteCanvas = ref => ({ ref, width: 32, height: 32 });
  e.getRaceCarBillboardLayerCanvas = canvas => canvas;
  const wheels = { fl: {x:10,y:10}, fr: {x:20,y:10}, rl: {x:30,y:10}, rr: {x:40,y:10} };
  for (const body of [false, true]) for (const [mode, ids] of [['left',['fl','rl']],['right',['fr','rr']]]) {
    e.setCarTireVisibilityMode(mode);
    const ctx = context(), drawn = []; let x;
    ctx.translate = value => { x = value; };
    e.drawScrolledCarTireArt = () => { drawn.push(x); return true; };
    const choice = e.getRaceCarProjectedArtRef(e.selectedCar,0,getCarViewCameraYaw('front'));
    const resolved = resolveCarAngleLayers(e.selectedCar, 'front');
    const expectedWheels = body ? e.getRaceSpriteWheelRig({car:resolved,viewSlot:'front',tireCanvas:{width:32,height:32}}).wheels : wheels;
    e.drawRaceCarBillboardLayers(ctx, {car:e.selectedCar, wheelBillboards:wheels,
      artChoice:{...choice,artRef:body ? choice.artRef : null}});
    const expected = ids.map(id => expectedWheels[id].x).sort((a,b)=>a-b);
    assert.deepEqual(drawn.sort((a,b)=>a-b),expected);
  }
});

test('sprite bodies and textured cylinders keep the same view throughout each 45-degree sector',()=>{
 const e=editor();populate(e);
 e.selectedCar.art.tireSurfaces={tread:{artRef:'tread'},wheel:{artRef:'rim'}};
 for(const slot of slots){e.setCarAngleArt('tires',slot,'tread');e.selectedCar.art.angleLayers[slot].tires.cylinder=true;}
 e.getRaceArtSpriteCanvas=ref=>({ref,width:32,height:32});e.getRaceCarBillboardLayerCanvas=c=>c;
 const draw=(yaw,turn=0,spin=0)=>{
  const commands=[];const ctx=new Proxy({globalAlpha:1,measureText:s=>({width:s.length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>commands.push([k,...args.map(v=>typeof v==='object'?v?.ref:v)])});
  e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,session:{vehicleRenderState:{wheelPoses:{fl:{spinAngleRad:spin},fr:{spinAngleRad:spin},rl:{spinAngleRad:spin},rr:{spinAngleRad:spin}}}},artChoice:e.getRaceCarProjectedArtRef(e.selectedCar,0,yaw),frontTireAngle:turn,drawShadowLayer:false});return commands;
 };
 for(const slot of slots){const center=getCarViewCameraYaw(slot);const at=draw(center);assert.ok(at.some(c=>c[0]==='transform'),'actual cylinder triangles rendered');for(const delta of [-0.38,-0.1,0.1,0.38])assert.deepEqual(draw(center+delta),at,`${slot}: camera motion within a frame cannot rotate tires`);assert.notDeepEqual(draw(center+Math.PI/4),at,'next view advances the complete car');assert.notDeepEqual(draw(center,0,0.3),at,'rolling spin remains animated');}
 assert.notDeepEqual(draw(getCarViewCameraYaw('front'),0.2),draw(getCarViewCameraYaw('front')),'physical steering remains live');
});
