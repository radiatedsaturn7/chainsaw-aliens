import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  addMaskToBoneBinding,
  bakeBoneFrames,
  bakeBoneTimelineFrames,
  buildBoneGraph,
  compositeBonePreview,
  constrainSharedJointPose,
  createBone,
  createDefaultBoneRig,
  deformLayersWithBonePose,
  getBoneAssignedMask,
  getBoneInfluenceSets,
  getBoneJointUsageCount,
  getPosedBoneGeometry,
  createLayerBinding,
  createSelectionBinding,
  moveBoneJoint,
  normalizeBoneRig,
  removeOrphanBoneJoints,
  removeMaskFromBoneBinding,
  reverseBoneDirection,
  samplePoseTimeline,
  solveTwoBoneIkPose,
  setPoseKeyAtTime,
  setBonePoseAtTime,
  setBonePoseForFrame,
  validateTwoBoneIkPose
} from '../../src/ui/pixel-editor/bones.js';
import PixelStudio, {
  buildPixelPortraitBoneActionGroups,
  buildPixelPortraitBoneActions,
  getPixelBoneTimelineDurationMs
} from '../../src/ui/PixelStudio.js';
import { createFrame } from '../../src/ui/pixel-editor/animation.js';
import { compositeLayers, createLayer } from '../../src/ui/pixel-editor/layers.js';
import { TOOL_IDS } from '../../src/ui/pixel-editor/tools.js';

const pixelStudioSource = readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8');

function createMockContext() {
  const noop = () => {};
  return {
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    arc: noop,
    moveTo: noop,
    lineTo: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    canvas: { width: 320, height: 240 }
  };
}

const shiftedPixels = (pixels, width, height, dx, dy) => {
  const shifted = new Array(width * height).fill(0);
  Array.from(pixels).forEach((value, index) => {
    if (!value) return;
    const x = (index % width) + dx;
    const y = Math.floor(index / width) + dy;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    shifted[y * width + x] = value;
  });
  return shifted;
};

test('bone rig normalization preserves bones bindings and frame poses', () => {
  const rig = normalizeBoneRig({
    bones: [{ id: 'arm', name: 'Arm', start: { x: 1, y: 2 }, end: { x: 5, y: 2 } }],
    bindings: [{ type: 'selection', layerIndex: 2, boneIds: ['arm'], pixels: [{ index: 7, weights: { arm: 3 } }] }],
    poses: [{ frameIndex: 4, bones: { arm: { angle: Math.PI / 2, dx: 1, dy: -1 } } }]
  });

  assert.equal(rig.version, 1);
  assert.equal(rig.bones[0].id, 'arm');
  assert.equal(rig.bindings[0].pixels[0].weights.arm, 1);
  assert.equal(rig.poses[0].bones.arm.angle, Math.PI / 2);
  assert.equal(rig.poseTimeline[0].timeMs, 480);
});

test('bone rig normalization collapses legacy multi-weight pixels to one explicit owner', () => {
  const rig = normalizeBoneRig({
    bindings: [{
      type: 'selection',
      layerIndex: 0,
      boneIds: ['arm', 'leg'],
      pixels: [{ index: 4, weights: { arm: 0.25, leg: 0.75 } }]
    }]
  });

  assert.deepEqual(rig.bindings[0].boneIds, ['leg']);
  assert.deepEqual(rig.bindings[0].pixels[0].weights, { leg: 1 });
});

test('bone layer and selection bindings deform pixels into normal baked frames', () => {
  let rig = createDefaultBoneRig();
  const created = createBone(rig, { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm', name: 'Arm' });
  rig = created.rig;
  const layer = createLayer(8, 8, 'Arm Art');
  layer.pixels[1 * 8 + 4] = 0xff0000ff;
  layer.pixels[2 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 8, 8, layer.pixels);
  rig = setBonePoseForFrame(rig, 0, 'arm', { angle: Math.PI / 2 });

  const baked = bakeBoneFrames([createFrame([layer], 120)], 8, 8, rig);
  const composite = compositeBonePreview([layer], 8, 8, rig, 0);

  assert.equal(baked.length, 1);
  assert.ok(baked[0].layers[0].pixels.some((pixel) => pixel === 0xff0000ff));
  assert.ok(composite.some((pixel) => pixel === 0xff0000ff));
  assert.notDeepEqual(Array.from(baked[0].layers[0].pixels), Array.from(layer.pixels));
});

test('bone selection bindings seed layer mesh deformation for unassigned opaque pixels', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  rig = createSelectionBinding(rig, 0, ['root'], mask, 4, 4);
  rig = setBonePoseForFrame(rig, 0, 'root', { angle: Math.PI / 2 });
  const layer = createLayer(4, 4, 'Mixed');
  layer.pixels[5] = 0xff0000ff;
  layer.pixels[15] = 0x00ff00ff;
  const baked = bakeBoneFrames([createFrame([layer], 120)], 4, 4, rig);

  assert.equal(rig.bindings[0].type, 'selection');
  assert.deepEqual(rig.bindings[0].pixels.map((pixel) => pixel.index), [5]);
  assert.equal(baked[0].layers[0].pixels[15], 0);
});

test('bone binding masks can add remove and report selected bone pixels', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const addMask = new Uint8Array(16);
  addMask[1] = 1;
  addMask[2] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', addMask, 4, 4);
  let assigned = getBoneAssignedMask(rig, 'root', 4, 4, 0);
  assert.equal(assigned[1], 1);
  assert.equal(assigned[2], 1);

  const removeMask = new Uint8Array(16);
  removeMask[1] = 1;
  rig = removeMaskFromBoneBinding(rig, 0, 'root', removeMask);
  assigned = getBoneAssignedMask(rig, 'root', 4, 4, 0);
  assert.equal(assigned[1], 0);
  assert.equal(assigned[2], 1);
});

test('assigning selected pixels to another bone clears prior explicit ownership', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 0, y: 0 }, { x: 2, y: 0 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 2, y: 0 }, { x: 4, y: 0 }, { id: 'leg' }).rig;
  const mask = new Uint8Array(16);
  mask[5] = 1;

  rig = addMaskToBoneBinding(rig, 0, 'arm', mask, 4, 4);
  rig = addMaskToBoneBinding(rig, 0, 'leg', mask, 4, 4);

  assert.equal(getBoneAssignedMask(rig, 'arm', 4, 4, 0)[5], 0);
  assert.equal(getBoneAssignedMask(rig, 'leg', 4, 4, 0)[5], 1);
});

test('assigning selected pixels to a node stores explicit joint ownership', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 0, y: 0 }, { x: 2, y: 0 }, { id: 'root' });
  rig = root.rig;
  const nodeId = root.bone.endJointId;
  const mask = new Uint8Array(16);
  mask[5] = 1;

  rig = createSelectionBinding(rig, 0, [nodeId], mask, 4, 4);

  assert.equal(getBoneAssignedMask(rig, nodeId, 4, 4, 0)[5], 1);
  assert.equal(getBoneAssignedMask(rig, 'root', 4, 4, 0)[5], 0);
  assert.deepEqual(rig.bindings[0].boneIds, [nodeId]);
});

test('node-owned bindings deform through their connected bone transform', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'root' });
  rig = root.rig;
  const layer = createLayer(8, 4, 'Node Owned');
  const index = 1 * 8 + 3;
  layer.pixels[index] = 0xff00ffff;
  const mask = new Uint8Array(8 * 4);
  mask[index] = 1;
  rig = createSelectionBinding(rig, 0, [root.bone.endJointId], mask, 8, 4);

  const [deformed] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { root: { angle: 0, dx: 2, dy: 0 } }
  });

  assert.equal(deformed.pixels[index], 0);
  assert.equal(deformed.pixels[1 * 8 + 5], 0xff00ffff);
});

test('layer binding to a new bone replaces previous layer pixel ownership', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 0, y: 0 }, { x: 2, y: 0 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 2, y: 0 }, { x: 4, y: 0 }, { id: 'leg' }).rig;
  const layer = createLayer(4, 4, 'Body');
  layer.pixels[5] = 0xff0000ff;
  layer.pixels[6] = 0x00ff00ff;

  rig = createLayerBinding(rig, 0, ['arm'], 4, 4, layer.pixels);
  rig = createLayerBinding(rig, 0, ['leg'], 4, 4, layer.pixels);

  assert.equal(getBoneAssignedMask(rig, 'arm', 4, 4, 0)[5], 0);
  assert.equal(getBoneAssignedMask(rig, 'arm', 4, 4, 0)[6], 0);
  assert.equal(getBoneAssignedMask(rig, 'leg', 4, 4, 0)[5], 1);
  assert.equal(getBoneAssignedMask(rig, 'leg', 4, 4, 0)[6], 1);
});

test('bone pose timeline interpolates and bakes timed frames', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(8, 8, 'Arm');
  layer.pixels[1 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 8, 8, layer.pixels);
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: 0 });
  rig = setBonePoseAtTime(rig, 1000, 'arm', { angle: Math.PI });

  const sampled = samplePoseTimeline(rig, 500);
  const baked = bakeBoneTimelineFrames(createFrame([layer], 250), 8, 8, rig, { frameDurationMs: 250 });

  assert.ok(sampled.bones.arm.angle > 1.5 && sampled.bones.arm.angle < 1.7);
  assert.equal(baked.length, 5);
  assert.ok(baked.every((frame) => frame.durationMs === 250));
});

test('bone pose timeline stays at rest before first nonzero key', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  rig = setBonePoseAtTime(rig, 500, 'arm', { angle: Math.PI / 2, dx: 1, dy: 0 });

  assert.deepEqual(samplePoseTimeline(rig, 0).bones, {});
  assert.deepEqual(samplePoseTimeline(rig, 499).bones, {});
});

test('bone pose timeline uses first key when it is at zero', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: Math.PI / 2, dx: 1, dy: 0 });

  assert.equal(samplePoseTimeline(rig, 0).bones.arm.angle, Math.PI / 2);
});

test('bone pose timeline interpolates sparse middle keys to the effective final pose', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 1, y: 3 }, { x: 4, y: 3 }, { id: 'leg' }).rig;
  rig = setPoseKeyAtTime(rig, 0, {
    arm: { angle: 0, dx: 0, dy: 0, scale: 1 },
    leg: { angle: 0, dx: 0, dy: 0, scale: 1 }
  });
  rig = setPoseKeyAtTime(rig, 500, {
    arm: { angle: Math.PI / 2, dx: 2, dy: 0, scale: 1 }
  });
  rig = setPoseKeyAtTime(rig, 1000, {
    leg: { angle: Math.PI, dx: 0, dy: 3, scale: 1 }
  });

  const sampled = samplePoseTimeline(rig, 750);

  assert.ok(sampled.bones.arm.angle > 1.55 && sampled.bones.arm.angle < 1.58);
  assert.equal(sampled.bones.arm.dx, 2);
  assert.ok(sampled.bones.leg.angle > 1.55 && sampled.bones.leg.angle < 1.58);
  assert.equal(sampled.bones.leg.dy, 1.5);
});

test('bone pose timeline respects matching first and last keys after sparse middle edits', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 1, y: 3 }, { x: 4, y: 3 }, { id: 'leg' }).rig;
  const endpointPose = {
    arm: { angle: 0.4, dx: 2, dy: 0, scale: 1 },
    leg: { angle: -0.25, dx: 0, dy: 3, scale: 1 }
  };
  rig = setPoseKeyAtTime(rig, 0, endpointPose);
  rig = setPoseKeyAtTime(rig, 1000, endpointPose);
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { timeMs: 500 },
    constrainBonePoseForCurrentRig: PixelStudio.prototype.constrainBonePoseForCurrentRig
  };

  PixelStudio.prototype.setBonePosePatchAtCurrentTime.call(fakeEditor, 'arm', { angle: 1.4, dx: 6 });

  const middle = samplePoseTimeline(fakeEditor.boneRig, 500);
  const between = samplePoseTimeline(fakeEditor.boneRig, 750);
  const end = samplePoseTimeline(fakeEditor.boneRig, 1000);
  const after = samplePoseTimeline(fakeEditor.boneRig, 1200);

  assert.equal(middle.bones.arm.angle, 1.4);
  assert.equal(middle.bones.arm.dx, 6);
  assert.ok(between.bones.arm.angle > endpointPose.arm.angle && between.bones.arm.angle < middle.bones.arm.angle);
  assert.ok(between.bones.arm.dx > endpointPose.arm.dx && between.bones.arm.dx < middle.bones.arm.dx);
  assert.deepEqual(end.bones, endpointPose);
  assert.deepEqual(after.bones, endpointPose);
});

test('bone pose timeline uses shortest angle interpolation across wraparound', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: Math.PI * 1.75, dx: 0, dy: 0 });
  rig = setBonePoseAtTime(rig, 1000, 'arm', { angle: -Math.PI * 1.75, dx: 0, dy: 0 });

  const sampled = samplePoseTimeline(rig, 500);

  assert.ok(sampled.bones.arm.angle > Math.PI * 1.9);
});

test('posed bone geometry follows sampled pose for editor overlays', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'arm' }).rig;
  rig = setBonePoseAtTime(rig, 500, 'arm', { angle: Math.PI / 2, dx: 1, dy: 0 });
  const pose = samplePoseTimeline(rig, 500);
  const [bone] = getPosedBoneGeometry(rig, pose);

  assert.equal(Math.round(bone.start.x), 3);
  assert.equal(Math.round(bone.start.y), 2);
  assert.equal(Math.round(bone.end.x), 3);
  assert.equal(Math.round(bone.end.y), 6);
});

test('rest bone deformation returns source pixels exactly', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(8, 4, 'Rest');
  layer.pixels[1 * 8 + 2] = 0xff0000ff;
  layer.pixels[1 * 8 + 3] = 0xff0000ff;
  layer.pixels[1 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 8, 4, layer.pixels);

  const [emptyRest] = deformLayersWithBonePose([layer], 8, 4, rig, { bones: {} });
  const [explicitRest] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { arm: { angle: 0, dx: 0, dy: 0, scale: 1 } }
  });

  assert.deepEqual(Array.from(emptyRest.pixels), Array.from(layer.pixels));
  assert.deepEqual(Array.from(explicitRest.pixels), Array.from(layer.pixels));
});

test('rest bone preview matches raw layer composite exactly', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.end, { x: 5, y: 1 }, {
    id: 'child',
    parentId: 'root',
    startJointId: root.bone.endJointId
  }).rig;
  const layer = createLayer(8, 4, 'Rest Composite');
  for (let x = 1; x <= 5; x += 1) layer.pixels[1 * 8 + x] = 0xff00ffff;
  const mask = new Uint8Array(8 * 4);
  mask[1 * 8 + 1] = 1;
  mask[1 * 8 + 2] = 1;
  rig = createSelectionBinding(rig, 0, ['root'], mask, 8, 4);

  const raw = compositeLayers([layer], 8, 4);
  const preview = compositeBonePreview([layer], 8, 4, rig, { bones: {} });

  assert.deepEqual(Array.from(preview), Array.from(raw));
});

test('integer bone translation offsets pixels exactly without mesh widening', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' }).rig;
  const layer = createLayer(8, 5, 'Translate');
  layer.pixels[2 * 8 + 2] = 0xff0000ff;
  layer.pixels[2 * 8 + 3] = 0xff0000ff;
  layer.pixels[2 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['root'], 8, 5, layer.pixels);

  const [deformed] = deformLayersWithBonePose([layer], 8, 5, rig, {
    bones: { root: { angle: 0, dx: 0, dy: -1, scale: 1 } }
  });

  assert.deepEqual(Array.from(deformed.pixels), shiftedPixels(layer.pixels, 8, 5, 0, -1));
});

test('integer root component translation offsets branched pixels exactly once', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.start, { x: 2, y: 4 }, { id: 'leg', startJointId: root.bone.startJointId }).rig;
  const layer = createLayer(8, 6, 'Branch Translate');
  for (let y = 2; y <= 3; y += 1) {
    for (let x = 2; x <= 5; x += 1) layer.pixels[y * 8 + x] = 0xff00ffff;
  }
  const mask = new Uint8Array(8 * 6);
  mask[2 * 8 + 2] = 1;
  mask[2 * 8 + 3] = 1;
  rig = createSelectionBinding(rig, 0, [root.bone.startJointId], mask, 8, 6);

  const [deformed] = deformLayersWithBonePose([layer], 8, 6, rig, {
    bones: {
      root: { angle: 0, dx: 0, dy: -1, scale: 1 },
      leg: { angle: 0, dx: 0, dy: -1, scale: 1 }
    }
  });

  assert.deepEqual(Array.from(deformed.pixels), shiftedPixels(layer.pixels, 8, 6, 0, -1));
});

test('stretchable bone pose scale changes posed length and skinned pixels', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm', stretch: true }).rig;
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: 0, dx: 0, dy: 0, scale: 2 });
  const posed = getPosedBoneGeometry(rig, samplePoseTimeline(rig, 0));
  const arm = posed.find((bone) => bone.id === 'arm');
  const layer = createLayer(12, 4, 'Stretch');
  layer.pixels[1 * 12 + 5] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 12, 4, layer.pixels);
  const [deformed] = deformLayersWithBonePose([layer], 12, 4, rig, samplePoseTimeline(rig, 0));

  assert.equal(Math.round(arm.length), 8);
  assert.equal(deformed.pixels[1 * 12 + 9], 0xff0000ff);
});

test('legacy stretch bones normalize to stretch edge mode', () => {
  const rig = normalizeBoneRig({
    bones: [{ id: 'arm', start: { x: 1, y: 1 }, end: { x: 5, y: 1 }, stretch: true }]
  });

  assert.equal(rig.bones[0].jointMode, 'stretch');
  assert.equal(rig.bones[0].stretch, true);
});

test('legacy bone edge modes migrate to rotate stretch and slide names', () => {
  const rig = normalizeBoneRig({
    bones: [
      { id: 'old-fixed', start: { x: 1, y: 1 }, end: { x: 5, y: 1 }, jointMode: 'fixed' },
      { id: 'old-none', start: { x: 1, y: 2 }, end: { x: 5, y: 2 }, jointMode: 'none' },
      { id: 'new-fixed', start: { x: 1, y: 3 }, end: { x: 5, y: 3 }, jointMode: 'fixed', jointModeVersion: 2 }
    ]
  });

  assert.equal(rig.bones[0].jointMode, 'rotate');
  assert.equal(rig.bones[1].jointMode, 'slide');
  assert.equal(rig.bones[2].jointMode, 'fixed');
  assert.deepEqual(rig.bones[2].jointSettings, { stiffness: 0.5, minAngle: -Math.PI, maxAngle: Math.PI, ikEnabled: true });
});

test('bone mesh deformation keeps pixel-art colors while covering rotated gaps', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(10, 10, 'Rotated Pixel');
  layer.pixels[1 * 10 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 10, 10, layer.pixels);

  const [deformed] = deformLayersWithBonePose([layer], 10, 10, rig, {
    bones: { arm: { angle: Math.PI / 4, dx: 0, dy: 0 } }
  });
  const movedPixels = Array.from(deformed.pixels).filter(Boolean);

  assert.ok(movedPixels.length >= 2);
  assert.ok(movedPixels.every((pixel) => pixel === 0xff0000ff));
});

test('bone mesh spans interpolate colors between differently weighted neighboring pixels', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 2 }, { x: 2, y: 2 }, { id: 'left' }).rig;
  rig = createBone(rig, { x: 3, y: 2 }, { x: 4, y: 2 }, { id: 'right' }).rig;
  const layer = createLayer(10, 5, 'Gradient Mesh');
  const leftIndex = 2 * 10 + 2;
  const rightIndex = 2 * 10 + 3;
  layer.pixels[leftIndex] = 0x000000ff;
  layer.pixels[rightIndex] = 0xffffffff;
  const leftMask = new Uint8Array(10 * 5);
  const rightMask = new Uint8Array(10 * 5);
  leftMask[leftIndex] = 1;
  rightMask[rightIndex] = 1;
  rig = createSelectionBinding(rig, 0, ['left'], leftMask, 10, 5);
  rig = createSelectionBinding(rig, 0, ['right'], rightMask, 10, 5);

  const [deformed] = deformLayersWithBonePose([layer], 10, 5, rig, {
    bones: { right: { angle: 0, dx: 3, dy: 0 } }
  });

  assert.equal(deformed.pixels[2 * 10 + 2], 0x000000ff);
  assert.equal(deformed.pixels[2 * 10 + 4], 0x808080ff);
  assert.equal(deformed.pixels[2 * 10 + 6], 0xffffffff);
});

test('unassigned opaque pixels on bound layers receive automatic nearest-bone weights', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'root' }).rig;
  const layer = createLayer(8, 4, 'Auto Mesh');
  const assignedIndex = 1 * 8 + 1;
  const unassignedIndex = 1 * 8 + 2;
  layer.pixels[assignedIndex] = 0xff0000ff;
  layer.pixels[unassignedIndex] = 0x0044ffff;
  const mask = new Uint8Array(8 * 4);
  mask[assignedIndex] = 1;
  rig = createSelectionBinding(rig, 0, ['root'], mask, 8, 4);

  const [deformed] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { root: { angle: 0, dx: 2, dy: 0 } }
  });

  assert.equal(deformed.pixels[unassignedIndex], 0);
  assert.equal(deformed.pixels[1 * 8 + 4], 0x0044ffff);
  const assignedMask = getBoneAssignedMask(rig, 'root', 8, 4, 0);
  assert.equal(assignedMask[assignedIndex], 1);
  assert.equal(assignedMask[unassignedIndex], 0);
});

test('transparent background only fills along stretched opaque mesh spans', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 2, y: 1 }, { id: 'left' }).rig;
  rig = createBone(rig, { x: 2, y: 1 }, { x: 3, y: 1 }, { id: 'right' }).rig;
  const layer = createLayer(8, 4, 'Transparent Mesh');
  const leftIndex = 1 * 8 + 1;
  const rightIndex = 1 * 8 + 2;
  layer.pixels[leftIndex] = 0x000000ff;
  layer.pixels[rightIndex] = 0xffffffff;
  const leftMask = new Uint8Array(8 * 4);
  const rightMask = new Uint8Array(8 * 4);
  leftMask[leftIndex] = 1;
  rightMask[rightIndex] = 1;
  rig = createSelectionBinding(rig, 0, ['left'], leftMask, 8, 4);
  rig = createSelectionBinding(rig, 0, ['right'], rightMask, 8, 4);

  const [deformed] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { right: { angle: 0, dx: 3, dy: 0 } }
  });

  assert.ok(deformed.pixels[1 * 8 + 3]);
  assert.ok(deformed.pixels[1 * 8 + 4]);
  assert.equal(deformed.pixels[0 * 8 + 4], 0);
  assert.equal(deformed.pixels[2 * 8 + 4], 0);
});

test('fully unbound layers remain unchanged during bone deformation', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'root' }).rig;
  const layer = createLayer(6, 4, 'Static');
  layer.pixels[1 * 6 + 2] = 0xff0000ff;

  const [deformed] = deformLayersWithBonePose([layer], 6, 4, rig, {
    bones: { root: { angle: 0, dx: 2, dy: 0 } }
  });

  assert.deepEqual(Array.from(deformed.pixels), Array.from(layer.pixels));
});

test('bone creation can preserve linked parent child structures', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'upper' });
  rig = upper.rig;
  const lower = createBone(rig, upper.bone.end, { x: 5, y: 2 }, { id: 'lower', parentId: upper.bone.id, startJointId: upper.bone.endJointId });
  rig = lower.rig;
  const hand = createBone(rig, lower.bone.end, { x: 6, y: 3 }, { id: 'hand', parentId: lower.bone.id, startJointId: lower.bone.endJointId });
  rig = normalizeBoneRig(hand.rig);

  assert.equal(rig.bones.find((bone) => bone.id === 'lower').parentId, 'upper');
  assert.equal(rig.bones.find((bone) => bone.id === 'hand').parentId, 'lower');
  assert.equal(rig.bones.find((bone) => bone.id === 'upper').endJointId, rig.bones.find((bone) => bone.id === 'lower').startJointId);
  assert.equal(rig.bones.find((bone) => bone.id === 'lower').endJointId, rig.bones.find((bone) => bone.id === 'hand').startJointId);
  assert.deepEqual(rig.bones.find((bone) => bone.id === 'lower').start, { x: 3, y: 1 });
});

test('shared bone joints branch and move as one node', () => {
  let rig = createDefaultBoneRig();
  const palm = createBone(rig, { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'palm' });
  rig = palm.rig;
  const fingerA = createBone(rig, palm.bone.end, { x: 6, y: 0 }, { id: 'finger-a', parentId: 'palm', startJointId: palm.bone.endJointId });
  rig = fingerA.rig;
  const fingerB = createBone(rig, palm.bone.end, { x: 6, y: 2 }, { id: 'finger-b', parentId: 'palm', startJointId: palm.bone.endJointId });
  rig = fingerB.rig;

  const branchJoint = palm.bone.endJointId;
  assert.equal(rig.bones.find((bone) => bone.id === 'finger-a').startJointId, branchJoint);
  assert.equal(rig.bones.find((bone) => bone.id === 'finger-b').startJointId, branchJoint);
  assert.equal(getBoneJointUsageCount(rig, branchJoint), 3);

  rig = moveBoneJoint(rig, branchJoint, { x: 5, y: 3 });
  assert.deepEqual(rig.bones.find((bone) => bone.id === 'palm').end, { x: 5, y: 3 });
  assert.deepEqual(rig.bones.find((bone) => bone.id === 'finger-a').start, { x: 5, y: 3 });
  assert.deepEqual(rig.bones.find((bone) => bone.id === 'finger-b').start, { x: 5, y: 3 });
});

test('selected bone direction can be reversed without losing the edge', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 2 }, { x: 4, y: 6 }, { id: 'torso' });
  rig = torso.rig;
  rig = reverseBoneDirection(rig, 'torso');
  const reversed = rig.bones.find((bone) => bone.id === 'torso');

  assert.equal(reversed.startJointId, torso.bone.endJointId);
  assert.equal(reversed.endJointId, torso.bone.startJointId);
  assert.deepEqual(reversed.start, torso.bone.end);
  assert.deepEqual(reversed.end, torso.bone.start);
  assert.equal(Math.round(reversed.angle * 1000), Math.round((-Math.PI / 2) * 1000));
});

test('pose shared node prefers incoming edge so torso rotates around head', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 7, y: 4 }, {
    id: 'right-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;

  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 16 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, drag: null, preview: true },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    }
  };

  const hit = PixelStudio.prototype.hitTestBone.call(fakeEditor, { col: 4, row: 4, x: 4, y: 4 });

  assert.equal(hit.bone.id, 'torso');
  assert.equal(hit.handle, 'end');
});

test('rotating torso endpoint carries downstream branched limbs', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 7, y: 4 }, {
    id: 'right-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'torso',
        handle: 'end',
        start: { x: 4, y: 4 },
        originalStart: { x: 4, y: 1 },
        originalEnd: { x: 4, y: 4 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        moved: false
      }
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getCurrentBonePreviewPose() {
      return { bones: {} };
    },
    setBonePosePatchAtCurrentTime: PixelStudio.prototype.setBonePosePatchAtCurrentTime,
    setBonePosePatchesAtCurrentTime() {
      throw new Error('branched endpoint rotation should not use IK patches');
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 6, row: 4, x: 6, y: 4 });
  const pose = samplePoseTimeline(fakeEditor.boneRig, 0);
  const posed = getPosedBoneGeometry(fakeEditor.boneRig, pose);
  const posedTorso = posed.find((bone) => bone.id === 'torso');
  const leftArm = posed.find((bone) => bone.id === 'left-arm');
  const rightArm = posed.find((bone) => bone.id === 'right-arm');

  assert.equal(handled, true);
  assert.ok(Math.abs(pose.bones.torso.angle - (Math.atan2(3, 2) - Math.PI / 2)) < 0.001);
  assert.ok(Math.hypot(leftArm.start.x - posedTorso.end.x, leftArm.start.y - posedTorso.end.y) < 0.001);
  assert.ok(Math.hypot(rightArm.start.x - posedTorso.end.x, rightArm.start.y - posedTorso.end.y) < 0.001);
});

test('reversing torso edge re-roots shared torso fan without detaching limbs', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 7, y: 4 }, {
    id: 'right-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 3, y: 7 }, {
    id: 'left-leg',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 5, y: 7 }, {
    id: 'right-leg',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;

  rig = reverseBoneDirection(rig, 'torso');
  const reversed = rig.bones.find((bone) => bone.id === 'torso');
  const graph = buildBoneGraph(rig);
  const rootFanIds = (graph.outgoingByJoint.get(reversed.startJointId) || []).map((bone) => bone.id).sort();

  assert.deepEqual(rootFanIds, ['left-arm', 'left-leg', 'right-arm', 'right-leg', 'torso']);
  assert.equal(graph.parentById.get('torso'), null);
  assert.equal(graph.parentById.get('left-arm'), null);
  assert.equal(graph.parentById.get('right-arm'), null);
  assert.equal(graph.parentById.get('left-leg'), null);
  assert.equal(graph.parentById.get('right-leg'), null);
  assert.equal(rig.bones.find((bone) => bone.id === 'left-arm').startJointId, reversed.startJointId);
});

test('translated reversed torso root moves head arms and legs as one fan', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 7, y: 4 }, {
    id: 'right-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 3, y: 7 }, {
    id: 'left-leg',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 5, y: 7 }, {
    id: 'right-leg',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = reverseBoneDirection(rig, 'torso');
  const reversed = rig.bones.find((bone) => bone.id === 'torso');
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'torso',
        handle: 'start',
        jointId: reversed.startJointId,
        start: { x: 4, y: 4 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        rootMoveBoneIds: ['torso', 'left-arm', 'right-arm', 'left-leg', 'right-leg'],
        originalRootPoseByBone: {
          torso: { angle: 0, dx: 0, dy: 0, scale: 1 },
          'left-arm': { angle: 0, dx: 0, dy: 0, scale: 1 },
          'right-arm': { angle: 0, dx: 0, dy: 0, scale: 1 },
          'left-leg': { angle: 0, dx: 0, dy: 0, scale: 1 },
          'right-leg': { angle: 0, dx: 0, dy: 0, scale: 1 }
        },
        moved: false
      }
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    setBonePosePatchesAtCurrentTime: PixelStudio.prototype.setBonePosePatchesAtCurrentTime
  };

  assert.deepEqual(PixelStudio.prototype.getRootPoseMoveBoneIds.call(fakeEditor, reversed.startJointId).sort(), [
    'left-arm',
    'left-leg',
    'right-arm',
    'right-leg',
    'torso'
  ]);
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 6, row: 5, x: 6, y: 5 }), true);
  const pose = samplePoseTimeline(fakeEditor.boneRig, 0);
  const posed = getPosedBoneGeometry(fakeEditor.boneRig, pose);
  const movedStarts = ['torso', 'left-arm', 'right-arm', 'left-leg', 'right-leg']
    .map((id) => posed.find((bone) => bone.id === id).start);

  movedStarts.forEach((start) => {
    assert.ok(Math.hypot(start.x - 6, start.y - 5) < 0.001);
  });
});

test('linked child dx dy cannot split a parent shared joint during pose', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 7, y: 4 }, {
    id: 'right-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;

  const posed = getPosedBoneGeometry(rig, {
    bones: {
      torso: { angle: Math.PI / 8, dx: 0, dy: 0, scale: 1 },
      'left-arm': { angle: 0, dx: -2, dy: 3, scale: 1 },
      'right-arm': { angle: 0, dx: 5, dy: -1, scale: 1 }
    }
  });
  const posedTorso = posed.find((bone) => bone.id === 'torso');
  const leftArm = posed.find((bone) => bone.id === 'left-arm');
  const rightArm = posed.find((bone) => bone.id === 'right-arm');

  assert.ok(Math.hypot(leftArm.start.x - posedTorso.end.x, leftArm.start.y - posedTorso.end.y) < 0.001);
  assert.ok(Math.hypot(rightArm.start.x - posedTorso.end.x, rightArm.start.y - posedTorso.end.y) < 0.001);
});

test('root fan timeline interpolation keeps shared starts connected', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = createBone(rig, torso.bone.end, { x: 7, y: 4 }, {
    id: 'right-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = reverseBoneDirection(rig, 'torso');
  rig = setPoseKeyAtTime(rig, 0, {
    torso: { angle: 0, dx: 0, dy: 0, scale: 1 },
    'left-arm': { angle: 0, dx: 3, dy: -2, scale: 1 }
  });
  rig = setPoseKeyAtTime(rig, 1000, {
    torso: { angle: 0, dx: 4, dy: 2, scale: 1 }
  });

  const pose = samplePoseTimeline(rig, 500);
  const posed = getPosedBoneGeometry(rig, pose);
  const starts = ['torso', 'left-arm', 'right-arm'].map((id) => posed.find((bone) => bone.id === id).start);

  starts.forEach((start) => {
    assert.ok(Math.hypot(start.x - starts[0].x, start.y - starts[0].y) < 0.001);
  });
  assert.equal(pose.bones.torso.dx, 2);
  assert.equal(pose.bones['left-arm'].dx, 2);
  assert.equal(pose.bones['right-arm'].dx, 2);
});

test('shared joint pose constraint mirrors root fan translation only', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 4 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 1, y: 4 }, {
    id: 'left-arm',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  rig = reverseBoneDirection(rig, 'torso');

  const constrained = constrainSharedJointPose(rig, {
    bones: {
      torso: { angle: 0.5, dx: 2, dy: 3, scale: 1 },
      'left-arm': { angle: -0.75, dx: -4, dy: 0, scale: 1 }
    }
  });

  assert.equal(constrained.bones.torso.dx, 2);
  assert.equal(constrained.bones['left-arm'].dx, 2);
  assert.equal(constrained.bones['left-arm'].dy, 3);
  assert.equal(constrained.bones.torso.angle, 0.5);
  assert.equal(constrained.bones['left-arm'].angle, -0.75);
});

test('fractional bone pose points produce fractional geometry with crisp raster output', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'arm' }).rig;
  const layer = createLayer(10, 8, 'Arm');
  layer.pixels[2 * 10 + 2] = 0xff0000ff;
  layer.pixels[2 * 10 + 3] = 0xff0000ff;
  layer.pixels[2 * 10 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 10, 8, layer.pixels);
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'arm',
        handle: 'end',
        start: { x: 6, y: 2 },
        originalStart: { x: 2, y: 2 },
        originalEnd: { x: 6, y: 2 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        moved: false
      }
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getCurrentBonePreviewPose() {
      return { bones: {} };
    },
    setBonePosePatchAtCurrentTime: PixelStudio.prototype.setBonePosePatchAtCurrentTime
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 5, row: 3, x: 5.25, y: 3.75 }), true);
  const pose = samplePoseTimeline(fakeEditor.boneRig, 0);
  const posed = getPosedBoneGeometry(fakeEditor.boneRig, pose).find((bone) => bone.id === 'arm');
  const preview = compositeBonePreview([layer], 10, 8, fakeEditor.boneRig, pose);

  assert.notEqual(Math.round(posed.end.x * 1000) / 1000, Math.round(posed.end.x));
  assert.notEqual(Math.round(posed.end.y * 1000) / 1000, Math.round(posed.end.y));
  assert.ok(preview.some((pixel) => pixel === 0xff0000ff));
  assert.equal(preview.length, 80);
});

test('normalizing duplicate source joints aliases branches onto one shared node', () => {
  const rig = normalizeBoneRig({
    joints: [
      { id: 'center-a', x: 4, y: 4 },
      { id: 'center-b', x: 4, y: 4 },
      { id: 'left', x: 2, y: 2 },
      { id: 'right', x: 6, y: 2 }
    ],
    bones: [
      { id: 'left-arm', startJointId: 'center-a', endJointId: 'left', start: { x: 4, y: 4 }, end: { x: 2, y: 2 } },
      { id: 'right-arm', startJointId: 'center-b', endJointId: 'right', start: { x: 4, y: 4 }, end: { x: 6, y: 2 } }
    ]
  });

  assert.equal(rig.joints.filter((joint) => joint.x === 4 && joint.y === 4).length, 1);
  assert.equal(rig.bones[0].startJointId, rig.bones[1].startJointId);
});

test('two bone IK pose preserves limb lengths while moving end effector', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'upper' });
  rig = upper.rig;
  const lower = createBone(rig, upper.bone.end, { x: 8, y: 0 }, {
    id: 'lower',
    parentId: upper.bone.id,
    startJointId: upper.bone.endJointId
  });
  rig = lower.rig;

  const patches = solveTwoBoneIkPose(rig, 'upper', 'lower', { x: 4, y: 4 });
  assert.ok(patches.upper);
  assert.ok(patches.lower);
  const posed = getPosedBoneGeometry(rig, { bones: patches });
  const posedUpper = posed.find((bone) => bone.id === 'upper');
  const posedLower = posed.find((bone) => bone.id === 'lower');

  assert.ok(Math.abs(posedUpper.length - 4) < 0.001);
  assert.ok(Math.abs(posedLower.length - 4) < 0.001);
  assert.ok(Math.hypot(posedLower.end.x - 4, posedLower.end.y - 4) < 0.75);
  assert.equal(validateTwoBoneIkPose(rig, 'upper', 'lower', { bones: {} }, patches).ok, true);
});

test('two bone IK pose keeps the bend direction closest to the current pose', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 8, y: 0 }, {
    id: 'lower',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;

  const target = { x: 4, y: -4 };
  const straightBend = solveTwoBoneIkPose(rig, 'upper', 'lower', target, {
    currentPose: { bones: { upper: { angle: 0 }, lower: { angle: 0 } } }
  });
  const downwardBend = solveTwoBoneIkPose(rig, 'upper', 'lower', target, {
    currentPose: { bones: { upper: { angle: -Math.PI / 2 }, lower: { angle: 0 } } }
  });

  assert.ok(Math.abs(straightBend.upper.angle) < 0.001);
  assert.ok(downwardBend.upper.angle < -1);
});

test('two bone IK validation blocks movement of sibling bones on the same joint', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 8, y: 0 }, {
    id: 'lower-a',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;
  rig = createBone(rig, upper.bone.end, { x: 8, y: 1 }, {
    id: 'lower-b',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;

  const patches = solveTwoBoneIkPose(rig, 'upper', 'lower-a', { x: 4, y: 4 });
  const validation = validateTwoBoneIkPose(rig, 'upper', 'lower-a', { bones: {} }, patches);

  assert.equal(validation.ok, false);
  assert.equal(validation.reason, 'outside-chain-moved');
});

test('bone influence sets expose upstream and downstream direction', () => {
  let rig = createDefaultBoneRig();
  const shoulder = createBone(rig, { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'upper' });
  rig = shoulder.rig;
  const forearm = createBone(rig, shoulder.bone.end, { x: 6, y: 0 }, {
    id: 'forearm',
    parentId: 'upper',
    startJointId: shoulder.bone.endJointId
  });
  rig = forearm.rig;
  rig = createBone(rig, forearm.bone.end, { x: 7, y: 1 }, {
    id: 'finger',
    parentId: 'forearm',
    startJointId: forearm.bone.endJointId
  }).rig;

  const forearmSets = getBoneInfluenceSets(rig, 'forearm');
  assert.equal(forearmSets.upstream.has('upper'), true);
  assert.equal(forearmSets.downstream.has('finger'), true);
  assert.equal(forearmSets.downstream.has('upper'), false);
});

test('posed child bones inherit parent rotation through shared joints', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'upper' });
  rig = upper.rig;
  const lower = createBone(rig, upper.bone.end, { x: 10, y: 2 }, {
    id: 'lower',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  });
  rig = lower.rig;

  const posed = getPosedBoneGeometry(rig, { bones: { upper: { angle: Math.PI / 2, dx: 0, dy: 0 } } });
  const posedUpper = posed.find((bone) => bone.id === 'upper');
  const posedLower = posed.find((bone) => bone.id === 'lower');

  assert.ok(Math.hypot(posedLower.start.x - posedUpper.end.x, posedLower.start.y - posedUpper.end.y) < 0.001);
  assert.equal(Math.round(posedLower.end.x), Math.round(posedUpper.end.x));
  assert.equal(Math.round(posedLower.end.y), Math.round(posedUpper.end.y + 4));
});

test('posed child bones infer directed parent links from shared joints', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 10, y: 2 }, {
    id: 'lower',
    startJointId: upper.bone.endJointId
  }).rig;

  const posed = getPosedBoneGeometry(rig, { bones: { upper: { angle: Math.PI / 2, dx: 1, dy: 0 } } });
  const posedUpper = posed.find((bone) => bone.id === 'upper');
  const posedLower = posed.find((bone) => bone.id === 'lower');

  assert.ok(Math.hypot(posedLower.start.x - posedUpper.end.x, posedLower.start.y - posedUpper.end.y) < 0.001);
  assert.equal(Math.round(posedLower.end.x), Math.round(posedUpper.end.x));
  assert.equal(Math.round(posedLower.end.y), Math.round(posedUpper.end.y + 4));
});

test('reversed bone direction does not inherit the old parent relationship', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 10, y: 2 }, {
    id: 'lower',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;
  rig = reverseBoneDirection(rig, 'lower');

  const posed = getPosedBoneGeometry(rig, { bones: { upper: { angle: Math.PI / 2, dx: 1, dy: 0 } } });
  const posedLower = posed.find((bone) => bone.id === 'lower');

  assert.deepEqual(posedLower.start, { x: 10, y: 2 });
});

test('pose body dragging a linked bone is blocked so shared joints stay attached', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'upper' });
  rig = upper.rig;
  const lower = createBone(rig, upper.bone.end, { x: 10, y: 2 }, {
    id: 'lower',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  });
  rig = lower.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      drag: {
        type: 'pose',
        boneId: 'lower',
        handle: 'body',
        start: { x: 8.5, y: 2.5 },
        originalPose: { angle: 0, dx: 0, dy: 0 },
        moved: false
      }
    },
    setBonePosePatchAtCurrentTime() {
      throw new Error('linked bone body drag should not set a detached pose offset');
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 9, row: 3 });

  assert.equal(handled, true);
  assert.equal(fakeEditor.boneEditor.drag.moved, false);
  assert.equal(fakeEditor.statusMessage, 'Rotate or move the shared joint to keep linked bones attached');
});

test('pose endpoint IK is blocked before keying when it would move sibling bones', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 8, y: 0 }, {
    id: 'lower-a',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;
  rig = createBone(rig, upper.bone.end, { x: 8, y: 1 }, {
    id: 'lower-b',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'lower-a',
        handle: 'end',
        start: { x: 8.5, y: 0.5 },
        originalStart: { x: 4, y: 0 },
        originalEnd: { x: 8, y: 0 },
        originalPose: { angle: 0, dx: 0, dy: 0 },
        moved: false
      }
    },
    getCurrentBonePreviewPose() {
      return { bones: {} };
    },
    setBonePosePatchesAtCurrentTime() {
      throw new Error('invalid IK should not write pose patches');
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 3, row: 3 });

  assert.equal(handled, true);
  assert.equal(fakeEditor.boneEditor.drag.moved, false);
  assert.equal(fakeEditor.statusMessage, 'Move the child joint only; this would detach connected bones');
});

test('pose endpoint drag uses direct rotation when selected bone IK is disabled', () => {
  const buildRig = (ikEnabled) => {
    let rig = createDefaultBoneRig();
    const upper = createBone(rig, { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'upper' });
    rig = upper.rig;
    return createBone(rig, upper.bone.end, { x: 8, y: 0 }, {
      id: 'lower',
      parentId: 'upper',
      startJointId: upper.bone.endJointId,
      jointSettings: { ikEnabled }
    }).rig;
  };
  const makeEditor = (rig) => ({
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'lower',
        handle: 'end',
        start: { x: 8.5, y: 0.5 },
        originalStart: { x: 4, y: 0 },
        originalEnd: { x: 8, y: 0 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        moved: false
      }
    },
    getCurrentBonePreviewPose() {
      return { bones: {} };
    },
    setBonePosePatchesAtCurrentTime(patches) {
      this.patches = patches;
    },
    setBonePosePatchAtCurrentTime(boneId, patch) {
      this.patch = { boneId, patch };
    }
  });

  const enabledEditor = makeEditor(buildRig(true));
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(enabledEditor, { col: 4, row: 4 }), true);
  assert.deepEqual(Object.keys(enabledEditor.patches).sort(), ['lower', 'upper']);
  assert.equal(enabledEditor.patch, undefined);

  const disabledEditor = makeEditor(buildRig(false));
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(disabledEditor, { col: 4, row: 4 }), true);
  assert.equal(disabledEditor.patches, undefined);
  assert.equal(disabledEditor.patch.boneId, 'lower');
  assert.ok(Math.abs(disabledEditor.patch.patch.angle - Math.atan2(4.5, 0.5)) < 0.0001);
});

test('pose start drag can move a root joint fan without detaching children', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 4, y: 4 }, { x: 4, y: 1 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.start, { x: 1, y: 5 }, {
    id: 'left-leg',
    startJointId: torso.bone.startJointId
  }).rig;
  const rootJointId = torso.bone.startJointId;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'torso',
        handle: 'start',
        jointId: rootJointId,
        start: { x: 4.5, y: 4.5 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        rootMoveBoneIds: ['torso', 'left-leg'],
        originalRootPoseByBone: {
          torso: { angle: 0, dx: 0, dy: 0, scale: 1 },
          'left-leg': { angle: 0, dx: 0, dy: 0, scale: 1 }
        },
        moved: false
      }
    },
    setBonePosePatchesAtCurrentTime: PixelStudio.prototype.setBonePosePatchesAtCurrentTime
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 6, row: 5 });
  const pose = samplePoseTimeline(fakeEditor.boneRig, 0);
  const posed = getPosedBoneGeometry(fakeEditor.boneRig, pose);
  const torsoPosed = posed.find((bone) => bone.id === 'torso');
  const legPosed = posed.find((bone) => bone.id === 'left-leg');

  assert.equal(handled, true);
  assert.equal(pose.bones.torso.dx, 2);
  assert.equal(pose.bones['left-leg'].dy, 1);
  assert.ok(Math.hypot(torsoPosed.start.x - legPosed.start.x, torsoPosed.start.y - legPosed.start.y) < 0.001);
});

test('pose root drag keys only root bones so child bones inherit once', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 10, y: 2 }, {
    id: 'lower',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'upper',
        handle: 'start',
        jointId: upper.bone.startJointId,
        start: { x: 2.5, y: 2.5 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        rootMoveBoneIds: ['upper'],
        originalRootPoseByBone: {
          upper: { angle: 0, dx: 0, dy: 0, scale: 1 }
        },
        moved: false
      }
    },
    setBonePosePatchesAtCurrentTime: PixelStudio.prototype.setBonePosePatchesAtCurrentTime
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 2, row: 1 }), true);
  const pose = samplePoseTimeline(fakeEditor.boneRig, 0);
  const posed = getPosedBoneGeometry(fakeEditor.boneRig, pose);
  const posedUpper = posed.find((bone) => bone.id === 'upper');
  const posedLower = posed.find((bone) => bone.id === 'lower');

  assert.equal(pose.bones.upper.dy, -1);
  assert.equal(pose.bones.lower, undefined);
  assert.ok(Math.hypot(posedLower.start.x - posedUpper.end.x, posedLower.start.y - posedUpper.end.y) < 0.001);
  assert.deepEqual(posedLower.end, { x: 10, y: 1 });
});

test('pose mode consumes empty canvas taps instead of starting pixel selection', () => {
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 8 },
    boneRig: createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedJointId: null, selectedBoneId: null, chainAnchor: null, drag: null },
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 30, row: 30 });

  assert.equal(handled, true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.statusMessage, 'Tap a bone node or edge to pose');
});

test('tools mode consumes canvas input without selecting bones or pixels', () => {
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig,
    boneEditor: { mode: 'time', drag: null, pendingBindNodeTap: null },
    setBoneChainAnchor() {
      throw new Error('tools mode should not select bones');
    },
    handleToolPointerDown() {
      throw new Error('tools mode should not start pixel selection');
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 1, row: 1 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 3, row: 3 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.statusMessage, 'Choose a bone tool command first');
});

test('bone only modes clear pixel selections when entered', () => {
  const fakeEditor = {
    boneEditor: { mode: 'bind', drag: { type: 'pose' }, pendingBindNodeTap: {}, linkMode: true, chainAnchor: {} },
    selection: {
      active: true,
      mask: new Uint8Array([1]),
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      floating: new Uint32Array([1]),
      floatingMode: 'paste',
      floatingBounds: { x: 0, y: 0, w: 1, h: 1 },
      offset: { x: 2, y: 3 }
    },
    clearSelection: PixelStudio.prototype.clearSelection,
    getBoneChainAnchorFromSelection() {
      return null;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    }
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'pose');

  assert.equal(fakeEditor.selection.active, false);
  assert.equal(fakeEditor.selection.mask, null);
  assert.equal(fakeEditor.selection.floating, null);
  assert.equal(fakeEditor.inputMode, 'canvas');

  fakeEditor.selection.active = true;
  fakeEditor.selection.mask = new Uint8Array([1]);
  fakeEditor.selection.bounds = { x: 0, y: 0, w: 1, h: 1 };
  fakeEditor.ensureBindSelectionTool = () => {};
  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');

  assert.equal(fakeEditor.selection.active, false);
  assert.equal(fakeEditor.selection.mask, null);
});

test('bone mode hopping converts stale paint tools to rig selection tools', () => {
  const fakeEditor = {
    activeToolId: TOOL_IDS.ERASER,
    boneEditor: { mode: 'bones', drag: { type: 'create' }, pendingBindNodeTap: {}, linkMode: true, chainAnchor: null, playing: true },
    selection: { active: true, mask: new Uint8Array([1]), offset: { x: 2, y: 3 } },
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    clearSelection() {
      this.selection.active = false;
      this.selection.mask = null;
    },
    cancelLongPress() {
      this.cancelledLongPress = true;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    getBoneChainAnchorFromSelection() {
      return null;
    }
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'pose');
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.ERASER);
  assert.equal(fakeEditor.selection.active, false);
  assert.equal(fakeEditor.inputMode, 'canvas');

  fakeEditor.activeToolId = TOOL_IDS.PENCIL;
  fakeEditor.boneEditor.drag = { type: 'pose' };
  fakeEditor.boneEditor.pendingBindNodeTap = {};
  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'time');
  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bones');
  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');

  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
  assert.equal(fakeEditor.boneEditor.playing, false);
});

test('bone only modes block off canvas drags from starting pixel selections', () => {
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneEditor: { mode: 'pose', drag: null },
    canvasBounds: { x: 10, y: 10, w: 80, h: 80, cellSize: 10 },
    canvasViewportBounds: { x: 0, y: 0, w: 100, h: 100 },
    cursor: {},
    isMobileLayout() {
      return false;
    },
    startMenuScrollDrag() {
      return false;
    },
    handleButtonClick() {
      return false;
    },
    isPointInBounds(point, bounds) {
      return point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.w && point.y <= bounds.y + bounds.h;
    },
    isSelectionToolActive() {
      return true;
    },
    isBoneEditorBoneOnlyMode: PixelStudio.prototype.isBoneEditorBoneOnlyMode,
    handleToolPointerDown() {
      throw new Error('bone only modes should not start pixel selection');
    },
    clearSelection() {
      this.selectionCleared = true;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    cancelLongPress() {
      this.cancelledLongPress = true;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 5, y: 5, button: 0 });

  assert.equal(fakeEditor.selectionCleared, true);
  assert.equal(fakeEditor.inputMode, 'canvas');
  assert.equal(fakeEditor.cancelledLongPress, true);
});

test('rig pointer down normalizes stale paint tool before starting assignment selection', () => {
  const calls = [];
  const fakeEditor = {
    leftPanelTab: 'bones',
    activeToolId: TOOL_IDS.ERASER,
    boneEditor: { mode: 'bind', drag: { type: 'pose' }, pendingBindNodeTap: {}, selectedJointId: null, selectedBoneId: null },
    canvasBounds: { x: 10, y: 10, w: 80, h: 80, cellSize: 10 },
    toolOptions: { wrapDraw: false },
    cursor: {},
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    view: { panX: 0, panY: 0 },
    viewportController: {
      beginPan() {
        throw new Error('rig assignment should not start panning');
      }
    },
    startMenuScrollDrag() {
      return false;
    },
    handleButtonClick() {
      return false;
    },
    isMobileLayout() {
      return false;
    },
    isPointInCircle() {
      return false;
    },
    isPointInBounds(point, bounds) {
      return point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.w && point.y <= bounds.y + bounds.h;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    shouldUseUnboundedWrapPointer: PixelStudio.prototype.shouldUseUnboundedWrapPointer,
    getEffectiveToolId() {
      return this.activeToolId;
    },
    setActiveTool(toolId) {
      calls.push(['tool', toolId]);
      this.activeToolId = toolId;
    },
    getGridCellFromScreen() {
      return { col: 3, row: 3 };
    },
    getGridCellFromScreenUnbounded() {
      throw new Error('stale eraser should be normalized before wrap pointer logic');
    },
    getBoneCanvasPointFromScreen(_x, _y, point) {
      return point;
    },
    handleBonePointerDown(point) {
      calls.push(['bone', point, this.activeToolId]);
      return false;
    },
    handleToolPointerDown(point) {
      calls.push(['tool-down', point, this.activeToolId]);
    },
    startLongPress() {
      calls.push(['long-press']);
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 30, y: 30, button: 0 });

  assert.deepEqual(calls, [
    ['tool', TOOL_IDS.SELECT_RECT],
    ['bone', { col: 3, row: 3 }, TOOL_IDS.SELECT_RECT],
    ['tool-down', { col: 3, row: 3 }, TOOL_IDS.SELECT_RECT]
  ]);
  assert.equal(fakeEditor.inputMode, 'canvas');
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
});

test('active bone drag can move a joint off canvas', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'bones',
      drag: {
        type: 'edit',
        boneId: 'arm',
        handle: 'end',
        jointId: rig.bones[0].endJointId,
        start: { x: 4, y: 1 },
        originalStart: { x: 1, y: 1 },
        originalEnd: { x: 4, y: 1 },
        moved: false
      }
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: -2, row: 7, x: -2, y: 7 }), true);

  const moved = fakeEditor.boneRig.bones[0];
  assert.deepEqual(moved.end, { x: -2, y: 7 });
});

test('rig mode shows rest bones and suppresses posed preview while playback is active', () => {
  const rig = setBonePoseAtTime(
    createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig,
    0,
    'arm',
    { angle: Math.PI / 2, dx: 1, dy: 0 }
  );
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: { mode: 'bind', playing: true, preview: true, timeMs: 0 },
    getCurrentBonePreviewPose: PixelStudio.prototype.getCurrentBonePreviewPose
  };

  assert.equal(PixelStudio.prototype.shouldShowBonePreview.call(fakeEditor), false);
  assert.deepEqual(PixelStudio.prototype.getDisplayedBonesForBoneEditor.call(fakeEditor)[0].end, { x: 5, y: 1 });
});

test('selected edge property cycles rotate fixed stretch spring slide and hinge', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: rig.bones[0].startJointId,
      selectedBoneId: 'arm',
      selectedEdgeBoneId: null
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getSelectedBone() {
      return this.boneRig.bones[0];
    },
    getCurrentBoneTimelineKey() {
      return null;
    },
    startHistory() {},
    commitHistory() {}
  };

  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'rotate');
  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'fixed');
  assert.equal(fakeEditor.boneRig.bones[0].stretch, false);
  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'stretch');
  assert.equal(fakeEditor.boneRig.bones[0].stretch, true);
  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'spring');
  assert.equal(fakeEditor.boneRig.bones[0].stretch, false);
  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'slide');
  assert.equal(fakeEditor.boneRig.bones[0].stretch, false);
  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'hinge');
  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'rotate');
});

test('selected node edge mode applies to immediate outgoing edges', () => {
  let rig = createDefaultBoneRig();
  const left = createBone(rig, { x: 2, y: 2 }, { x: 2, y: 5 }, { id: 'left' });
  rig = left.rig;
  rig = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, {
    id: 'right',
    startJointId: left.bone.startJointId
  }).rig;
  rig = createBone(rig, left.bone.end, { x: 2, y: 8 }, {
    id: 'left-child',
    parentId: 'left',
    startJointId: left.bone.endJointId
  }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: null
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);

  assert.equal(fakeEditor.boneRig.bones.find((bone) => bone.id === 'left').jointMode, 'fixed');
  assert.equal(fakeEditor.boneRig.bones.find((bone) => bone.id === 'right').jointMode, 'fixed');
  assert.equal(fakeEditor.boneRig.bones.find((bone) => bone.id === 'left-child').jointMode, 'rotate');
});

test('selected edge mode applies to only the clicked edge', () => {
  let rig = createDefaultBoneRig();
  const left = createBone(rig, { x: 2, y: 2 }, { x: 2, y: 5 }, { id: 'left' });
  rig = left.rig;
  rig = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, {
    id: 'right',
    startJointId: left.bone.startJointId
  }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: 'right'
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.cycleSelectedBoneEdgeMode.call(fakeEditor);

  assert.equal(fakeEditor.boneRig.bones.find((bone) => bone.id === 'left').jointMode, 'rotate');
  assert.equal(fakeEditor.boneRig.bones.find((bone) => bone.id === 'right').jointMode, 'fixed');
});

test('selected bone IK toggle flips the joint setting and label', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { mode: 'bones', linkMode: false, selectedJointId: rig.bones[0].startJointId, selectedBoneId: 'arm', selectedEdgeBoneId: null },
    selection: { active: false, mask: null },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getSelectedBone() {
      return this.boneRig.bones[0];
    },
    getCurrentBoneTimelineKey() {
      return null;
    },
    startHistory() {},
    commitHistory() {}
  };

  let ikAction = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'bones')
    .find((entry) => entry.id === 'bone-ik');
  assert.equal(ikAction.label, 'IK On');
  assert.equal(ikAction.active, true);

  PixelStudio.prototype.toggleSelectedBoneIk.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointSettings.ikEnabled, false);
  ikAction = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'bones')
    .find((entry) => entry.id === 'bone-ik');
  assert.equal(ikAction.label, 'IK Off');
  assert.equal(ikAction.active, false);

  PixelStudio.prototype.toggleSelectedBoneIk.call(fakeEditor);
  assert.equal(fakeEditor.boneRig.bones[0].jointSettings.ikEnabled, true);
});

test('spring timeline scale uses deterministic bounce while stretch is linear', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'spring', jointMode: 'spring' }).rig;
  rig = setBonePoseAtTime(rig, 0, 'spring', { angle: 0, dx: 0, dy: 0, scale: 1 });
  rig = setBonePoseAtTime(rig, 1000, 'spring', { angle: 0, dx: 0, dy: 0, scale: 2 });
  const springMid = samplePoseTimeline(rig, 625).bones.spring.scale;

  rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'stretch', jointMode: 'stretch' }).rig;
  rig = setBonePoseAtTime(rig, 0, 'stretch', { angle: 0, dx: 0, dy: 0, scale: 1 });
  rig = setBonePoseAtTime(rig, 1000, 'stretch', { angle: 0, dx: 0, dy: 0, scale: 2 });
  const stretchMid = samplePoseTimeline(rig, 625).bones.stretch.scale;

  assert.notEqual(Math.round(springMid * 1000), Math.round(stretchMid * 1000));
  assert.equal(stretchMid, 1.625);
  assert.equal(samplePoseTimeline(rig, 1000).bones.stretch.scale, 2);
});

test('spring edge mode applies damped pose scale while stretch follows target length', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm', jointMode: 'spring' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'arm',
        handle: 'end',
        start: { x: 5.5, y: 1.5 },
        originalStart: { x: 1, y: 1 },
        originalPose: { angle: 0.25, dx: 0, dy: 0, scale: 1 },
        moved: false
      }
    },
    setBonePosePatchAtCurrentTime: PixelStudio.prototype.setBonePosePatchAtCurrentTime
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 9, row: 6 }), true);
  const springTargetScale = (9.5 - 1) / 4;
  const springPose = samplePoseTimeline(fakeEditor.boneRig, 0).bones.arm;
  assert.ok(Math.abs(springPose.scale - (1 + (springTargetScale - 1) * 0.5)) < 0.0001);
  assert.equal(springPose.angle, 0.25);

  rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm', jointMode: 'stretch' }).rig;
  fakeEditor.boneRig = rig;
  fakeEditor.boneEditor.drag.originalPose = { angle: 0, dx: 0, dy: 0, scale: 1 };
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 9, row: 6 }), true);
  const stretchTargetScale = Math.hypot(9.5 - 1, 6.5 - 1) / 4;
  const stretchPose = samplePoseTimeline(fakeEditor.boneRig, 0).bones.arm;
  assert.ok(Math.abs(stretchPose.scale - stretchTargetScale) < 0.0001);
  assert.ok(Math.abs(stretchPose.angle - Math.atan2(5.5, 8.5)) < 0.0001);
});

test('spring edge mode stretches only explicitly assigned spring pixels', () => {
  let rig = createDefaultBoneRig();
  const spring = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'spring', jointMode: 'spring' });
  rig = spring.rig;
  rig = createBone(rig, spring.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'spring',
    startJointId: spring.bone.endJointId
  }).rig;
  const layer = createLayer(16, 4, 'Spring');
  const springMask = new Uint8Array(16 * 4);
  const childMask = new Uint8Array(16 * 4);
  layer.pixels[1 * 16 + 3] = 0xff00ffff;
  springMask[1 * 16 + 3] = 1;
  layer.pixels[1 * 16 + 6] = 0xffaa00ff;
  childMask[1 * 16 + 6] = 1;
  layer.pixels[1 * 16 + 7] = 0xffaa00ff;
  childMask[1 * 16 + 7] = 1;
  rig = createSelectionBinding(rig, 0, ['spring'], springMask, 16, 4);
  rig = createSelectionBinding(rig, 0, ['child'], childMask, 16, 4);

  const [deformed] = deformLayersWithBonePose([layer], 16, 4, rig, {
    bones: { spring: { angle: 0, dx: 0, dy: 0, scale: 2 } }
  });

  assert.equal(deformed.pixels[1 * 16 + 5], 0xff00ffff);
  assert.equal(deformed.pixels[1 * 16 + 10], 0xffaa00ff);
  assert.equal(deformed.pixels[1 * 16 + 11], 0xffaa00ff);
  assert.equal(deformed.pixels[1 * 16 + 12], 0);
});

test('spring edge mode does not stretch pixels assigned to the downstream node', () => {
  let rig = createDefaultBoneRig();
  const spring = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'spring', jointMode: 'spring' });
  rig = spring.rig;
  rig = createBone(rig, spring.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'spring',
    startJointId: spring.bone.endJointId
  }).rig;
  const layer = createLayer(16, 4, 'Downstream Node');
  const downstreamMask = new Uint8Array(16 * 4);
  for (let x = 6; x <= 8; x += 1) {
    layer.pixels[1 * 16 + x] = 0xffaa00ff;
    downstreamMask[1 * 16 + x] = 1;
  }
  rig = createSelectionBinding(rig, 0, [spring.bone.endJointId], downstreamMask, 16, 4);

  const [deformed] = deformLayersWithBonePose([layer], 16, 4, rig, {
    bones: { spring: { angle: 0, dx: 0, dy: 0, scale: 2 } }
  });
  const filledXs = [];
  for (let x = 0; x < 16; x += 1) {
    if (deformed.pixels[1 * 16 + x]) filledXs.push(x);
  }

  assert.deepEqual(filledXs, [10, 11, 12]);
});

test('fixed edge mode blocks direct pose edits while following parent transforms', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.end, { x: 9, y: 1 }, {
    id: 'fixed',
    parentId: 'root',
    startJointId: root.bone.endJointId,
    jointMode: 'fixed'
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'fixed',
        handle: 'end',
        start: { x: 9.5, y: 1.5 },
        originalStart: { x: 5, y: 1 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        moved: false
      }
    },
    setBonePosePatchAtCurrentTime() {
      throw new Error('fixed bones should not receive direct pose patches');
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 9, row: 5 }), true);
  assert.equal(fakeEditor.boneEditor.drag.moved, false);
  assert.equal(fakeEditor.statusMessage, 'Fixed edges only follow parent or root movement');

  const posed = getPosedBoneGeometry(rig, { bones: { root: { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 }, fixed: { angle: 1, dx: 4, dy: 4, scale: 3 } } });
  const fixedBone = posed.find((bone) => bone.id === 'fixed');
  assert.ok(Math.abs(fixedBone.start.x - 1) < 0.001);
  assert.ok(Math.abs(fixedBone.start.y - 5) < 0.001);
  assert.ok(Math.abs(fixedBone.end.x - 1) < 0.001);
  assert.ok(Math.abs(fixedBone.end.y - 9) < 0.001);
});

test('pose hit testing prefers editable downstream edge over fixed incoming edge at shared node', () => {
  let rig = createDefaultBoneRig();
  const fixed = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'fixed', jointMode: 'fixed' });
  rig = fixed.rig;
  rig = createBone(rig, fixed.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'fixed',
    startJointId: fixed.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 8 },
    boneRig: rig,
    boneEditor: { mode: 'pose' },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment
  };

  const hit = PixelStudio.prototype.hitTestBone.call(fakeEditor, { col: 5, row: 1 });

  assert.equal(hit.bone.id, 'child');
  assert.equal(hit.handle, 'start');
});

test('fixed root edge does not block posing editable downstream child edge', () => {
  let rig = createDefaultBoneRig();
  const fixed = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'fixed', jointMode: 'fixed' });
  rig = fixed.rig;
  rig = createBone(rig, fixed.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'fixed',
    startJointId: fixed.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 8 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    getRootPoseMoveBoneIds: PixelStudio.prototype.getRootPoseMoveBoneIds,
    getCurrentBonePreviewPose: PixelStudio.prototype.getCurrentBonePreviewPose,
    setBonePosePatchAtCurrentTime: PixelStudio.prototype.setBonePosePatchAtCurrentTime,
    constrainBonePoseForCurrentRig: PixelStudio.prototype.constrainBonePoseForCurrentRig,
    startHistory() {},
    commitHistory() {}
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 5, row: 1 }), true);
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'child');
  assert.equal(fakeEditor.boneEditor.drag.handle, 'start');
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 5, row: 3 }), true);

  const childPose = samplePoseTimeline(fakeEditor.boneRig, 0).bones.child;
  assert.equal(Boolean(childPose), true);
  assert.ok(Math.abs(childPose.angle) > 0.5);
  assert.equal(childPose.dy, 0);
});

test('fixed root fan translation moves all outgoing fixed edges without rotating them', () => {
  let rig = createDefaultBoneRig();
  const left = createBone(rig, { x: 2, y: 2 }, { x: 2, y: 5 }, { id: 'left', jointMode: 'fixed' });
  rig = left.rig;
  rig = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, {
    id: 'right',
    jointMode: 'fixed',
    startJointId: left.bone.startJointId
  }).rig;

  const posed = getPosedBoneGeometry(rig, {
    bones: { left: { angle: 1, dx: 3, dy: 1, scale: 2 } }
  });
  const leftPosed = posed.find((bone) => bone.id === 'left');
  const rightPosed = posed.find((bone) => bone.id === 'right');

  assert.deepEqual(leftPosed.start, { x: 5, y: 3 });
  assert.deepEqual(leftPosed.end, { x: 5, y: 6 });
  assert.deepEqual(rightPosed.start, { x: 5, y: 3 });
  assert.deepEqual(rightPosed.end, { x: 8, y: 3 });
});

test('symmetric car strut rig keeps fixed root mounts connected while springs extend', () => {
  let rig = createDefaultBoneRig();
  const leftMount = createBone(rig, { x: 8, y: 2 }, { x: 4, y: 4 }, { id: 'left-mount', jointMode: 'fixed' });
  rig = leftMount.rig;
  const rightMount = createBone(rig, { x: 8, y: 2 }, { x: 12, y: 4 }, {
    id: 'right-mount',
    jointMode: 'fixed',
    startJointId: leftMount.bone.startJointId
  });
  rig = rightMount.rig;
  const leftStrut = createBone(rig, leftMount.bone.end, { x: 4, y: 8 }, {
    id: 'left-strut',
    jointMode: 'spring',
    parentId: 'left-mount',
    startJointId: leftMount.bone.endJointId
  });
  rig = leftStrut.rig;
  const rightStrut = createBone(rig, rightMount.bone.end, { x: 12, y: 8 }, {
    id: 'right-strut',
    jointMode: 'spring',
    parentId: 'right-mount',
    startJointId: rightMount.bone.endJointId
  });
  rig = rightStrut.rig;
  rig = createBone(rig, leftStrut.bone.end, { x: 4, y: 10 }, {
    id: 'left-wheel',
    jointMode: 'fixed',
    parentId: 'left-strut',
    startJointId: leftStrut.bone.endJointId
  }).rig;
  rig = createBone(rig, rightStrut.bone.end, { x: 12, y: 10 }, {
    id: 'right-wheel',
    jointMode: 'fixed',
    parentId: 'right-strut',
    startJointId: rightStrut.bone.endJointId
  }).rig;

  const posed = getPosedBoneGeometry(rig, {
    bones: {
      'left-mount': { angle: 0, dx: 2, dy: 1, scale: 1 },
      'left-strut': { angle: 0, dx: 0, dy: 0, scale: 1.25 },
      'right-strut': { angle: 0, dx: 0, dy: 0, scale: 1.25 }
    }
  });
  const byId = Object.fromEntries(posed.map((bone) => [bone.id, bone]));

  assert.deepEqual(byId['left-mount'].start, byId['right-mount'].start);
  assert.ok(Math.abs(byId['left-mount'].end.x - 6) < 0.001);
  assert.ok(Math.abs(byId['right-mount'].end.x - 14) < 0.001);
  assert.deepEqual(byId['left-strut'].start, byId['left-mount'].end);
  assert.deepEqual(byId['right-strut'].start, byId['right-mount'].end);
  assert.ok(Math.abs(byId['left-strut'].end.y - 10) < 0.001);
  assert.ok(Math.abs(byId['right-strut'].end.y - 10) < 0.001);
  assert.deepEqual(byId['left-wheel'].start, byId['left-strut'].end);
  assert.deepEqual(byId['right-wheel'].start, byId['right-strut'].end);
});

test('hinge edge mode preserves the rest bend direction for L shapes', () => {
  const solveByDrag = (childEndY, targetY) => {
    let rig = createDefaultBoneRig();
    const upper = createBone(rig, { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'upper' });
    rig = upper.rig;
    rig = createBone(rig, upper.bone.end, { x: 4, y: childEndY }, {
      id: 'lower',
      parentId: 'upper',
      startJointId: upper.bone.endJointId,
      jointMode: 'hinge'
    }).rig;
    const fakeEditor = {
      leftPanelTab: 'bones',
      boneRig: rig,
      boneEditor: {
        timeMs: 0,
        drag: {
          type: 'pose',
          boneId: 'lower',
          handle: 'end',
          start: { x: 4.5, y: childEndY + 0.5 },
          originalStart: { x: 4, y: 0 },
          originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
          moved: false
        }
      },
      getCurrentBonePreviewPose() {
        return { bones: {} };
      },
      setBonePosePatchesAtCurrentTime(patches) {
        this.patches = patches;
      }
    };
    assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 4, row: targetY }), true);
    return fakeEditor.patches;
  };

  assert.ok(solveByDrag(4, -4).lower.angle < -3);
  assert.ok(solveByDrag(-4, 4).lower.angle > 2.5);
});

test('pose reset writes selected bone rest pose at current time', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  rig = setBonePoseAtTime(rig, 250, 'arm', { angle: 1, dx: 2, dy: 3, scale: 2 });
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { timeMs: 250 },
    getSelectedBone() {
      return this.boneRig.bones[0];
    },
    setBonePosePatchAtCurrentTime: PixelStudio.prototype.setBonePosePatchAtCurrentTime,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.resetSelectedBonePose.call(fakeEditor);
  assert.deepEqual(samplePoseTimeline(fakeEditor.boneRig, 250).bones.arm, { angle: 0, dx: 0, dy: 0, scale: 1 });
});

test('pose mode uses larger bone hit targets for touch editing', () => {
  const fakeEditor = {
    canvasBounds: { cellSize: 16 },
    boneEditor: { mode: 'pose' }
  };

  assert.equal(PixelStudio.prototype.getBoneHitRadius.call(fakeEditor), 2.25);
  fakeEditor.boneEditor.mode = 'bones';
  assert.equal(PixelStudio.prototype.getBoneHitRadius.call(fakeEditor), 1.5);
});

test('single bone bindings soften near child joint so connected pixels stretch instead of separating', () => {
  let rig = createDefaultBoneRig();
  const neck = createBone(rig, { x: 8, y: 8 }, { x: 8, y: 4 }, { id: 'neck' });
  rig = neck.rig;
  rig = createBone(rig, neck.bone.end, { x: 8, y: 1 }, {
    id: 'head',
    parentId: 'neck',
    startJointId: neck.bone.endJointId
  }).rig;
  const layer = createLayer(16, 16, 'Neck');
  const neckJointPixel = 4 * 16 + 8;
  layer.pixels[neckJointPixel] = 0xff00ffff;
  const mask = new Uint8Array(16 * 16);
  mask[neckJointPixel] = 1;
  rig = createSelectionBinding(rig, 0, ['neck'], mask, 16, 16);

  const [deformed] = deformLayersWithBonePose([layer], 16, 16, rig, {
    bones: { head: { angle: 0, dx: 4, dy: 0 } }
  });
  const movedXs = [];
  for (let index = 0; index < deformed.pixels.length; index += 1) {
    if (deformed.pixels[index] === 0xff00ffff) movedXs.push(index % 16);
  }

  assert.equal(deformed.pixels[neckJointPixel], 0xff00ffff);
  assert.ok(movedXs.some((x) => x > 8));
});

test('bone stretch bridge fills the gap between rest and moved pixels', () => {
  let rig = createDefaultBoneRig();
  const neck = createBone(rig, { x: 8, y: 10 }, { x: 8, y: 5 }, { id: 'neck' });
  rig = neck.rig;
  rig = createBone(rig, neck.bone.end, { x: 8, y: 2 }, {
    id: 'head',
    parentId: 'neck',
    startJointId: neck.bone.endJointId
  }).rig;
  const layer = createLayer(20, 20, 'Stretch');
  const mask = new Uint8Array(20 * 20);
  for (let y = 4; y <= 6; y += 1) {
    const index = y * 20 + 8;
    layer.pixels[index] = 0xff00ffff;
    mask[index] = 1;
  }
  rig = createSelectionBinding(rig, 0, ['neck'], mask, 20, 20);

  const [deformed] = deformLayersWithBonePose([layer], 20, 20, rig, {
    bones: { head: { angle: 0, dx: 5, dy: 0 } }
  });

  const bridgeRow = 5;
  const filledXs = [];
  for (let x = 8; x <= 12; x += 1) {
    if (deformed.pixels[bridgeRow * 20 + x] === 0xff00ffff) filledXs.push(x);
  }

  assert.deepEqual(filledXs, [8, 9, 10, 11, 12]);
});

test('slide edge mode translates assigned pixels without stretch bridge', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'slide', jointMode: 'slide' }).rig;
  const layer = createLayer(12, 6, 'Slide');
  const mask = new Uint8Array(12 * 6);
  for (let x = 2; x <= 4; x += 1) {
    const index = 2 * 12 + x;
    layer.pixels[index] = 0xffaa00ff;
    mask[index] = 1;
  }
  rig = createSelectionBinding(rig, 0, ['slide'], mask, 12, 6);

  const [deformed] = deformLayersWithBonePose([layer], 12, 6, rig, {
    bones: { slide: { angle: Math.PI / 2, dx: 4, dy: 1, scale: 3 } }
  });

  assert.equal(deformed.pixels[3 * 12 + 6], 0xffaa00ff);
  assert.equal(deformed.pixels[3 * 12 + 7], 0xffaa00ff);
  assert.equal(deformed.pixels[3 * 12 + 8], 0xffaa00ff);
  assert.equal(deformed.pixels[2 * 12 + 2], 0);
  assert.equal(deformed.pixels[3 * 12 + 9], 0);
});

test('normalizing old parented rigs merges matching endpoints into joints', () => {
  const rig = normalizeBoneRig({
    bones: [
      { id: 'upper', start: { x: 1, y: 1 }, end: { x: 4, y: 1 } },
      { id: 'lower', parentId: 'upper', start: { x: 4, y: 1 }, end: { x: 6, y: 1 } }
    ]
  });

  assert.equal(rig.bones[0].endJointId, rig.bones[1].startJointId);
  assert.equal(rig.joints.length, 3);
});

test('removing orphan bone joints preserves shared joints still in use', () => {
  let rig = createDefaultBoneRig();
  const base = createBone(rig, { x: 0, y: 0 }, { x: 2, y: 0 }, { id: 'base' });
  rig = base.rig;
  const child = createBone(rig, base.bone.end, { x: 4, y: 0 }, { id: 'child', parentId: 'base', startJointId: base.bone.endJointId });
  rig = child.rig;
  rig.bones = rig.bones.filter((bone) => bone.id !== 'child');
  rig = removeOrphanBoneJoints(rig);

  assert.equal(Boolean(rig.joints.find((joint) => joint.id === base.bone.endJointId)), true);
  assert.equal(Boolean(rig.joints.find((joint) => joint.id === child.bone.endJointId)), false);
});

test('bone overlay marks selected node chains with green edges and blue downstream nodes', () => {
  let rig = createDefaultBoneRig();
  const chest = createBone(rig, { x: 4, y: 6 }, { x: 4, y: 4 }, { id: 'chest' });
  rig = chest.rig;
  rig = createBone(rig, chest.bone.end, { x: 4, y: 2 }, {
    id: 'head',
    parentId: 'chest',
    startJointId: chest.bone.endJointId
  }).rig;
  rig = createBone(rig, chest.bone.end, { x: 2, y: 4 }, {
    id: 'left-arm',
    parentId: 'chest',
    startJointId: chest.bone.endJointId
  }).rig;
  rig = createBone(rig, chest.bone.end, { x: 6, y: 4 }, {
    id: 'right-arm',
    parentId: 'chest',
    startJointId: chest.bone.endJointId
  }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: chest.bone.endJointId,
      selectedBoneId: 'head',
      chainAnchor: { jointId: chest.bone.endJointId }
    },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    }
  };

  const activeIds = PixelStudio.prototype.getActiveBoneOverlayIds.call(fakeEditor);
  const nodeIds = PixelStudio.prototype.getBoneOverlayNodeIds.call(fakeEditor);

  assert.deepEqual([...activeIds].sort(), ['chest', 'head', 'left-arm', 'right-arm']);
  assert.equal(nodeIds.selectedJointId, chest.bone.endJointId);
  assert.equal(nodeIds.downstream.has(rig.bones.find((bone) => bone.id === 'head').endJointId), true);
  assert.equal(nodeIds.downstream.has(rig.bones.find((bone) => bone.id === 'left-arm').endJointId), true);
  assert.equal(nodeIds.downstream.has(rig.bones.find((bone) => bone.id === 'right-arm').endJointId), true);
});

test('bind mode bone hits use larger node targets and fall through away from bones', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'chest' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 8 },
    boneRig: rig,
    activeToolId: TOOL_IDS.SELECT_RECT,
    boneEditor: { mode: 'bind', selectedJointId: null, selectedBoneId: null, chainAnchor: null, drag: null, pendingBindNodeTap: null },
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    setBoneChainAnchor(bone, handle = 'end') {
      const point = handle === 'start' ? bone.start : bone.end;
      const jointId = handle === 'start' ? bone.startJointId : bone.endJointId;
      this.boneEditor.selectedJointId = jointId;
      this.boneEditor.selectedBoneId = bone.id;
      this.boneEditor.chainAnchor = { boneId: bone.id, handle, jointId, x: point.x, y: point.y };
    }
  };

  assert.equal(PixelStudio.prototype.getBoneHitRadius.call(fakeEditor), 3.5);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 6, row: 1 }), true);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'chest');
  assert.equal(fakeEditor.boneEditor.selectedJointId, rig.bones[0].endJointId);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap.hit.handle, 'end');
  assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'chest');
  assert.equal(fakeEditor.boneEditor.selectedJointId, rig.bones[0].endJointId);
  assert.equal(fakeEditor.boneEditor.chainAnchor.handle, 'end');
  assert.equal(fakeEditor.boneEditor.drag, null);

  fakeEditor.boneEditor.selectedBoneId = null;
  fakeEditor.boneEditor.chainAnchor = null;
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 10, row: 10 }), false);
});

test('bind mode drag from a node keeps the node selected instead of painting pixels', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'chest' }).rig;
  const events = [];
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 8 },
    boneRig: rig,
    activeToolId: TOOL_IDS.SELECT_RECT,
    boneEditor: { mode: 'bind', selectedJointId: null, selectedBoneId: null, chainAnchor: null, drag: null, pendingBindNodeTap: null },
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    handleToolPointerDown(point) {
      events.push(['down', point]);
    },
    handleToolPointerMove(point) {
      events.push(['move', point]);
    },
    setBoneChainAnchor(bone, handle = 'end') {
      const point = handle === 'start' ? bone.start : bone.end;
      const jointId = handle === 'start' ? bone.startJointId : bone.endJointId;
      this.boneEditor.selectedJointId = jointId;
      this.boneEditor.selectedBoneId = bone.id;
      this.boneEditor.chainAnchor = { boneId: bone.id, handle, jointId, x: point.x, y: point.y };
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 6, row: 1 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 6, row: 3 }), true);

  assert.deepEqual(events, []);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap.type, 'node-select');
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'chest');
  assert.equal(fakeEditor.boneEditor.selectedJointId, rig.bones[0].endJointId);
  assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
});

const createCarDemoStyleRig = () => normalizeBoneRig({
    joints: [
      { id: 'root', x: 5.0642, y: 3.6121 },
      { id: 'right-mount', x: 10.2057, y: 7.6884 },
      { id: 'right-strut', x: 10.3322, y: 9.6943 },
      { id: 'right-wheel', x: 10.3469, y: 11.3714 },
      { id: 'left-mount', x: 2.5004, y: 7.3437 },
      { id: 'left-strut', x: 2.4533, y: 9.8549 },
      { id: 'left-wheel', x: 2.4156, y: 11.3895 }
    ],
    bones: [
      { id: 'body-right', startJointId: 'root', endJointId: 'right-mount', start: { x: 5.0642, y: 3.6121 }, end: { x: 10.2057, y: 7.6884 } },
      { id: 'right-strut', startJointId: 'right-mount', endJointId: 'right-strut', start: { x: 10.2057, y: 7.6884 }, end: { x: 10.3322, y: 9.6943 } },
      { id: 'right-wheel', startJointId: 'right-strut', endJointId: 'right-wheel', start: { x: 10.3322, y: 9.6943 }, end: { x: 10.3469, y: 11.3714 } },
      { id: 'body-left', startJointId: 'root', endJointId: 'left-mount', start: { x: 5.0642, y: 3.6121 }, end: { x: 2.5004, y: 7.3437 } },
      { id: 'left-strut', startJointId: 'left-mount', endJointId: 'left-strut', start: { x: 2.5004, y: 7.3437 }, end: { x: 2.4533, y: 9.8549 } },
      { id: 'left-wheel', startJointId: 'left-strut', endJointId: 'left-wheel', start: { x: 2.4533, y: 9.8549 }, end: { x: 2.4156, y: 11.3895 } }
    ]
  });

const createBoneEditorHitTestFake = (rig, mode = 'bind') => ({
  leftPanelTab: 'bones',
  canvasBounds: { cellSize: 16 },
  boneRig: rig,
  activeToolId: TOOL_IDS.SELECT_RECT,
  boneEditor: { mode, selectedJointId: null, selectedBoneId: null, selectedEdgeBoneId: null, chainAnchor: null, drag: null, pendingBindNodeTap: null, linkMode: false },
  getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
  getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
  hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
  hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
  hitTestBone: PixelStudio.prototype.hitTestBone,
  distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
  isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
  ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
  getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
  setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
  getDisplayedJointsForBoneEditor: PixelStudio.prototype.getDisplayedJointsForBoneEditor,
  getDisplayedBonesForBoneEditor() {
    return this.boneRig.bones;
  },
  setActiveTool(toolId) {
    this.activeToolId = toolId;
  },
  setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
  startHistory(label) {
    this.historyLabel = label;
  }
});

test('car demo style fractional rig can select every node in rig mode', () => {
  const rig = createCarDemoStyleRig();
  const fakeEditor = {
    ...createBoneEditorHitTestFake(rig, 'bind')
  };

  rig.joints.forEach((joint) => {
    assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: joint.x, y: joint.y, col: Math.floor(joint.x), row: Math.floor(joint.y) }), true);
    assert.equal(fakeEditor.boneEditor.selectedJointId, joint.id);
    assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  });
});

test('car demo style rig canvas taps bypass stale bone list scroll hitboxes in rig mode', () => {
  const rig = createCarDemoStyleRig();
  const canvasBounds = { x: 40, y: 70, w: 16 * 16, h: 16 * 16, cellSize: 16, mainX: 40, mainY: 70 };
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds,
    canvasState: { width: 16, height: 16 },
    boneListMeta: { scrollBounds: canvasBounds, lineHeight: 24, maxScroll: 10 },
    focusScroll: { bones: 0 },
    uiButtons: [{ bounds: canvasBounds, onClick: () => { throw new Error('stale bone UI hitbox should not consume canvas tap'); } }],
    cursor: {},
    boneRig: rig,
    activeToolId: TOOL_IDS.SELECT_RECT,
    toolOptions: { wrapDraw: false },
    panJoystick: { center: { x: -999, y: -999 }, radius: 1 },
    boneEditor: {
      mode: 'bind',
      selectedJointId: null,
      selectedBoneId: null,
      selectedEdgeBoneId: null,
      chainAnchor: null,
      drag: null,
      pendingBindNodeTap: null,
      linkMode: false
    },
    selection: { active: true, mask: new Uint8Array([1]), start: { col: 0, row: 0 }, end: { col: 2, row: 2 } },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    startMenuScrollDrag: PixelStudio.prototype.startMenuScrollDrag,
    handlePointerDown: PixelStudio.prototype.handlePointerDown,
    getGridCellFromScreen: PixelStudio.prototype.getGridCellFromScreen,
    getBoneCanvasPointFromScreen: PixelStudio.prototype.getBoneCanvasPointFromScreen,
    handleBonePointerDown: PixelStudio.prototype.handleBonePointerDown,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    clearBoneEditorBlockingSelectionState: PixelStudio.prototype.clearBoneEditorBlockingSelectionState,
    clearSelection: PixelStudio.prototype.clearSelection,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    getDisplayedJointsForBoneEditor: PixelStudio.prototype.getDisplayedJointsForBoneEditor,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    shouldUseUnboundedWrapPointer: PixelStudio.prototype.shouldUseUnboundedWrapPointer,
    getEffectiveToolId: PixelStudio.prototype.getEffectiveToolId,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    isMobileLayout() {
      return true;
    },
    isPointInCircle() {
      return false;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    handleButtonClick() {
      throw new Error('bone canvas tap should not be routed to UI buttons');
    },
    handleToolPointerDown() {
      throw new Error('bone canvas tap should not start pixel selection');
    },
    cancelLongPress() {
      this.longPressCancelled = true;
    }
  };

  rig.joints.forEach((joint) => {
    const payload = {
      x: canvasBounds.mainX + joint.x * canvasBounds.cellSize,
      y: canvasBounds.mainY + joint.y * canvasBounds.cellSize,
      button: 0,
      touchCount: 1
    };
    PixelStudio.prototype.handlePointerDown.call(fakeEditor, payload);
    assert.equal(fakeEditor.boneEditor.selectedJointId, joint.id);
    assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, null);
    assert.equal(fakeEditor.menuScrollDrag, undefined);
    assert.equal(fakeEditor.selection.active, false);
    assert.equal(fakeEditor.selection.start, null);
    assert.equal(fakeEditor.selection.end, null);
    assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  });
});

test('bones menu buttons over the canvas consume taps instead of adding bones underneath', () => {
  const calls = [];
  const canvasBounds = { x: 40, y: 70, w: 200, h: 200, cellSize: 10, mainX: 40, mainY: 70 };
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds,
    cursor: {},
    uiButtons: [{
      bounds: { x: 70, y: 90, w: 80, h: 44 },
      group: 'bone-actions',
      onClick: () => calls.push('button')
    }],
    boneEditor: { mode: 'bones', drag: null },
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handleButtonClick: PixelStudio.prototype.handleButtonClick,
    startMenuScrollDrag() {
      return false;
    },
    isMobileLayout() {
      return true;
    },
    isPointInCircle() {
      return false;
    },
    handleBonePointerDown() {
      throw new Error('button tap should not reach bone canvas handling');
    },
    handleToolPointerDown() {
      throw new Error('button tap should not reach pixel tool handling');
    },
    setInputMode(mode) {
      this.inputMode = mode;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 80, y: 100, button: 0, touchCount: 1 });

  assert.deepEqual(calls, ['button']);
  assert.equal(fakeEditor.inputMode, undefined);
});

test('bone pose timeline over the canvas consumes taps and drags for scrubbing', () => {
  const canvasBounds = { x: 40, y: 70, w: 200, h: 200, cellSize: 10, mainX: 40, mainY: 70 };
  const timelineBounds = { x: 60, y: 90, w: 120, h: 40 };
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds,
    cursor: {},
    uiButtons: [],
    boneRig: { poseTimeline: [{ timeMs: 0 }, { timeMs: 1000 }] },
    boneEditor: { mode: 'pose', timeMs: 0, playing: true, drag: null },
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    getBoneTimelineLayout: PixelStudio.prototype.getBoneTimelineLayout,
    boneTimelineMsToX: PixelStudio.prototype.boneTimelineMsToX,
    boneTimelineXToMs: PixelStudio.prototype.boneTimelineXToMs,
    adjustBoneTimelineZoom: PixelStudio.prototype.adjustBoneTimelineZoom,
    setBoneTimelineZoomFromSlider: PixelStudio.prototype.setBoneTimelineZoomFromSlider,
    panBoneTimeline: PixelStudio.prototype.panBoneTimeline,
    drawBoneTimelineStrip: PixelStudio.prototype.drawBoneTimelineStrip,
    drawButton() {},
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handleButtonClick: PixelStudio.prototype.handleButtonClick,
    startMenuScrollDrag() {
      return false;
    },
    isMobileLayout() {
      return true;
    },
    isPointInCircle() {
      return false;
    },
    handleBonePointerDown() {
      throw new Error('timeline tap should not reach bone canvas handling');
    },
    handleToolPointerDown() {
      throw new Error('timeline tap should not reach pixel tool handling');
    },
    setInputMode(mode) {
      this.inputMode = mode;
    }
  };
  const ctx = createMockContext();
  PixelStudio.prototype.drawBoneTimelineStrip.call(fakeEditor, ctx, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  assert.equal(fakeEditor.uiButtons[0].group, 'bone-timeline');
  assert.equal(fakeEditor.uiButtons[0].id, 'bone-timeline');

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 90, y: 100, button: 0, id: 7, touchCount: 1 });
  assert.equal(fakeEditor.boneEditor.timeMs, 250);
  assert.equal(fakeEditor.boneEditor.playing, false);
  assert.equal(fakeEditor.inputMode, undefined);
  assert.equal(fakeEditor.uiSliderDrag.id, 7);

  PixelStudio.prototype.handlePointerMove.call(fakeEditor, { x: 150, y: 100, buttons: 1, id: 7, touchCount: 1 });
  assert.equal(fakeEditor.boneEditor.timeMs, 750);
});

test('active ui slider drag receives pointer move events', () => {
  const calls = [];
  const fakeEditor = {
    cursor: {},
    uiSliderDrag: {
      id: 9,
      onDrag: (payload) => calls.push(payload.x)
    }
  };

  PixelStudio.prototype.handlePointerMove.call(fakeEditor, { x: 42, y: 10, buttons: 1, id: 9 });
  PixelStudio.prototype.handlePointerMove.call(fakeEditor, { x: 84, y: 10, buttons: 1, id: 9 });

  assert.deepEqual(calls, [42, 84]);
});

test('bone pose timeline supports zoomed key selection and panning', () => {
  const timelineBounds = { x: 60, y: 90, w: 240, h: 40 };
  const fakeEditor = {
    uiButtons: [],
    boneRig: { poseTimeline: [{ timeMs: 0 }, { timeMs: 500 }, { timeMs: 1000 }] },
    boneEditor: { mode: 'pose', timeMs: 250, playing: true, timelineZoom: 2, timelineScrollMs: 250 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    getBoneTimelineLayout: PixelStudio.prototype.getBoneTimelineLayout,
    boneTimelineMsToX: PixelStudio.prototype.boneTimelineMsToX,
    boneTimelineXToMs: PixelStudio.prototype.boneTimelineXToMs,
    adjustBoneTimelineZoom: PixelStudio.prototype.adjustBoneTimelineZoom,
    setBoneTimelineZoomFromSlider: PixelStudio.prototype.setBoneTimelineZoomFromSlider,
    panBoneTimeline: PixelStudio.prototype.panBoneTimeline,
    drawBoneTimelineStrip: PixelStudio.prototype.drawBoneTimelineStrip,
    drawButton() {},
    isMobileLayout() {
      return true;
    }
  };
  const ctx = createMockContext();
  PixelStudio.prototype.drawBoneTimelineStrip.call(fakeEditor, ctx, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  const layout = PixelStudio.prototype.getBoneTimelineLayout.call(fakeEditor, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  const keyX = PixelStudio.prototype.boneTimelineMsToX.call(fakeEditor, 500, layout);
  const keyHit = fakeEditor.uiButtons.find((button) => button.id === 'bone-key-500');
  assert.ok(keyHit);
  assert.ok(keyHit.bounds.w >= 28);

  keyHit.onClick({ x: keyX, y: timelineBounds.y + 20 });
  assert.equal(fakeEditor.boneEditor.timeMs, 500);
  assert.equal(fakeEditor.boneEditor.playing, false);

  const timelineHit = fakeEditor.uiButtons.find((button) => button.id === 'bone-timeline');
  timelineHit.onClick({ x: layout.railBounds.x + 80, y: timelineBounds.y + 36 });
  timelineHit.onDrag({ x: layout.railBounds.x + 120, y: timelineBounds.y + 36 });
  assert.ok(fakeEditor.boneEditor.timelineScrollMs < 250);
  assert.ok(fakeEditor.boneEditor.timelineScrollMs >= 0);
});

test('bone pose timeline zoom slider replaces buttons and keeps the playhead in view', () => {
  const timelineBounds = { x: 60, y: 90, w: 240, h: 56 };
  const fakeEditor = {
    uiButtons: [],
    boneRig: { poseTimeline: [{ timeMs: 0 }, { timeMs: 500 }, { timeMs: 1000 }] },
    boneEditor: { mode: 'pose', timeMs: 700, playing: false, timelineZoom: 1, timelineScrollMs: 0 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    getBoneTimelineLayout: PixelStudio.prototype.getBoneTimelineLayout,
    boneTimelineMsToX: PixelStudio.prototype.boneTimelineMsToX,
    boneTimelineXToMs: PixelStudio.prototype.boneTimelineXToMs,
    adjustBoneTimelineZoom: PixelStudio.prototype.adjustBoneTimelineZoom,
    setBoneTimelineZoomFromSlider: PixelStudio.prototype.setBoneTimelineZoomFromSlider,
    panBoneTimeline: PixelStudio.prototype.panBoneTimeline,
    drawBoneTimelineStrip: PixelStudio.prototype.drawBoneTimelineStrip,
    drawButton() {},
    isMobileLayout() {
      return false;
    }
  };
  const ctx = createMockContext();
  PixelStudio.prototype.drawBoneTimelineStrip.call(fakeEditor, ctx, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  assert.equal(fakeEditor.uiButtons.some((button) => button.id === 'bone-timeline-zoom-in'), false);
  assert.equal(fakeEditor.uiButtons.some((button) => button.id === 'bone-timeline-zoom-out'), false);
  const slider = fakeEditor.uiButtons.find((button) => button.id === 'bone-timeline-zoom-slider');
  assert.ok(slider);
  slider.onClick({ x: slider.bounds.x + slider.bounds.w });
  assert.ok(fakeEditor.boneEditor.timelineZoom > 1);
  const layout = PixelStudio.prototype.getBoneTimelineLayout.call(fakeEditor, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  assert.ok(fakeEditor.boneEditor.timeMs >= layout.scrollMs);
  assert.ok(fakeEditor.boneEditor.timeMs <= layout.scrollMs + layout.visibleMs);
});

test('canvas zoom sliders support tap and drag gestures', () => {
  const ctx = createMockContext();
  const portraitEditor = {
    uiButtons: [],
    view: { zoomIndex: 0, zoomLevels: [1, 2, 4, 8, 16] },
    mobileZoomSliderBounds: null,
    updateZoomFromSliderX: PixelStudio.prototype.updateZoomFromSliderX,
    drawPixelPortraitZoomSlider: PixelStudio.prototype.drawPixelPortraitZoomSlider
  };

  PixelStudio.prototype.drawPixelPortraitZoomSlider.call(portraitEditor, ctx, { x: 10, y: 20, w: 210, h: 36 });
  const portraitSlider = portraitEditor.uiButtons[0];
  assert.equal(typeof portraitSlider.onDrag, 'function');
  portraitSlider.onClick({ x: portraitSlider.bounds.x });
  assert.equal(portraitEditor.view.zoomIndex, 0);
  portraitSlider.onDrag({ x: portraitSlider.bounds.x + portraitSlider.bounds.w });
  assert.equal(portraitEditor.view.zoomIndex, 4);

  const controlsEditor = {
    uiButtons: [],
    view: { zoomIndex: 0, zoomLevels: [1, 2, 4, 8, 16] },
    panJoystick: { center: { x: 0, y: 0 }, radius: 0, knobRadius: 0 },
    mobileZoomSliderBounds: null,
    isMobileLayout() {
      return true;
    },
    updateZoomFromSliderX: PixelStudio.prototype.updateZoomFromSliderX,
    resetMobilePanZoomControls: PixelStudio.prototype.resetMobilePanZoomControls,
    drawMobilePanZoomControls: PixelStudio.prototype.drawMobilePanZoomControls
  };

  PixelStudio.prototype.drawMobilePanZoomControls.call(controlsEditor, ctx, 320, 240);
  const controlsSlider = controlsEditor.uiButtons[0];
  assert.equal(typeof controlsSlider.onDrag, 'function');
  controlsSlider.onClick({ x: controlsSlider.bounds.x });
  assert.equal(controlsEditor.view.zoomIndex, 0);
  controlsSlider.onDrag({ x: controlsSlider.bounds.x + controlsSlider.bounds.w });
  assert.equal(controlsEditor.view.zoomIndex, 4);
});

test('bone pose timeline wheel pans and modifier wheel zooms around pointer', () => {
  const timelineBounds = { x: 60, y: 90, w: 240, h: 40 };
  const fakeEditor = {
    leftPanelTab: 'bones',
    uiButtons: [],
    boneRig: { poseTimeline: [{ timeMs: 0 }, { timeMs: 500 }, { timeMs: 1000 }] },
    boneEditor: { mode: 'pose', timeMs: 500, playing: true, timelineZoom: 2, timelineScrollMs: 250 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    getBoneTimelineLayout: PixelStudio.prototype.getBoneTimelineLayout,
    getBoneTimelineHitLayout: PixelStudio.prototype.getBoneTimelineHitLayout,
    boneTimelineMsToX: PixelStudio.prototype.boneTimelineMsToX,
    boneTimelineXToMs: PixelStudio.prototype.boneTimelineXToMs,
    adjustBoneTimelineZoom: PixelStudio.prototype.adjustBoneTimelineZoom,
    setBoneTimelineZoomFromSlider: PixelStudio.prototype.setBoneTimelineZoomFromSlider,
    panBoneTimeline: PixelStudio.prototype.panBoneTimeline,
    handleBoneTimelineWheel: PixelStudio.prototype.handleBoneTimelineWheel,
    handleWheel: PixelStudio.prototype.handleWheel,
    drawBoneTimelineStrip: PixelStudio.prototype.drawBoneTimelineStrip,
    drawButton() {},
    isMobileLayout() {
      return false;
    },
    zoomBy() {
      throw new Error('timeline wheel should not zoom the canvas');
    }
  };
  const ctx = createMockContext();
  PixelStudio.prototype.drawBoneTimelineStrip.call(fakeEditor, ctx, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  const layout = PixelStudio.prototype.getBoneTimelineLayout.call(fakeEditor, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);

  PixelStudio.prototype.handleWheel.call(fakeEditor, { x: layout.railBounds.x + 80, y: timelineBounds.y + 20, deltaX: 60, deltaY: 0 });
  assert.ok(fakeEditor.boneEditor.timelineScrollMs > 250);
  assert.equal(fakeEditor.boneEditor.playing, false);

  const beforeZoom = fakeEditor.boneEditor.timelineZoom;
  PixelStudio.prototype.handleWheel.call(fakeEditor, { x: layout.railBounds.x + 120, y: timelineBounds.y + 20, deltaX: 0, deltaY: -80, ctrlKey: true });
  assert.ok(fakeEditor.boneEditor.timelineZoom > beforeZoom);
  const zoomedLayout = PixelStudio.prototype.getBoneTimelineLayout.call(fakeEditor, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  assert.ok(fakeEditor.boneEditor.timeMs >= zoomedLayout.scrollMs);
  assert.ok(fakeEditor.boneEditor.timeMs <= zoomedLayout.scrollMs + zoomedLayout.visibleMs);
});

test('bone pose timeline pinch zoom and two finger pan do not change canvas zoom', () => {
  const timelineBounds = { x: 60, y: 90, w: 240, h: 40 };
  const fakeEditor = {
    leftPanelTab: 'bones',
    uiButtons: [],
    boneRig: { poseTimeline: [{ timeMs: 0 }, { timeMs: 500 }, { timeMs: 1000 }] },
    boneEditor: { mode: 'pose', timeMs: 500, playing: true, timelineZoom: 2, timelineScrollMs: 250 },
    boneTimelineGesture: null,
    canvasBounds: { x: 0, y: 0, w: 320, h: 240 },
    view: { zoomIndex: 4, panX: 0, panY: 0, zoomLevels: [1, 2, 3, 4, 5, 6] },
    viewportController: {
      cancelInteractions() {
        this.cancelled = true;
      },
      beginPinch() {
        throw new Error('timeline pinch should not start canvas pinch');
      },
      updatePinch() {
        throw new Error('timeline pinch should not update canvas pinch');
      },
      endPinch() {
        this.ended = true;
      }
    },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    getBoneTimelineLayout: PixelStudio.prototype.getBoneTimelineLayout,
    getBoneTimelineHitLayout: PixelStudio.prototype.getBoneTimelineHitLayout,
    boneTimelineMsToX: PixelStudio.prototype.boneTimelineMsToX,
    boneTimelineXToMs: PixelStudio.prototype.boneTimelineXToMs,
    adjustBoneTimelineZoom: PixelStudio.prototype.adjustBoneTimelineZoom,
    setBoneTimelineZoomFromSlider: PixelStudio.prototype.setBoneTimelineZoomFromSlider,
    panBoneTimeline: PixelStudio.prototype.panBoneTimeline,
    handleGestureStart: PixelStudio.prototype.handleGestureStart,
    handleGestureMove: PixelStudio.prototype.handleGestureMove,
    handleGestureEnd: PixelStudio.prototype.handleGestureEnd,
    drawBoneTimelineStrip: PixelStudio.prototype.drawBoneTimelineStrip,
    drawButton() {},
    isMobileLayout() {
      return true;
    }
  };
  const ctx = createMockContext();
  PixelStudio.prototype.drawBoneTimelineStrip.call(fakeEditor, ctx, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  const layout = PixelStudio.prototype.getBoneTimelineLayout.call(fakeEditor, timelineBounds.x, timelineBounds.y, timelineBounds.w, timelineBounds.h);
  const startX = layout.railBounds.x + layout.railBounds.w / 2;

  PixelStudio.prototype.handleGestureStart.call(fakeEditor, { x: startX, y: timelineBounds.y + 20, distance: 100 });
  assert.ok(fakeEditor.boneTimelineGesture);
  assert.equal(fakeEditor.viewportController.cancelled, true);

  PixelStudio.prototype.handleGestureMove.call(fakeEditor, { x: startX + 40, y: timelineBounds.y + 20, distance: 150 });
  assert.ok(fakeEditor.boneEditor.timelineZoom > 2);
  assert.notEqual(fakeEditor.boneEditor.timelineScrollMs, 250);
  assert.equal(fakeEditor.view.zoomIndex, 4);
  assert.equal(fakeEditor.boneEditor.playing, false);

  PixelStudio.prototype.handleGestureEnd.call(fakeEditor);
  assert.equal(fakeEditor.boneTimelineGesture, null);
});

test('car demo style fractional rig can select every node in bones mode', () => {
  const rig = createCarDemoStyleRig();
  const fakeEditor = createBoneEditorHitTestFake(rig, 'bones');

  rig.joints.forEach((joint) => {
    assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: joint.x, y: joint.y, col: Math.floor(joint.x), row: Math.floor(joint.y) }), true);
    assert.equal(fakeEditor.boneEditor.selectedJointId, joint.id);
    assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, null);
    assert.equal(fakeEditor.boneEditor.drag.type, 'edit');
    assert.equal(fakeEditor.boneEditor.drag.jointId, joint.id);
    fakeEditor.boneEditor.drag = null;
  });
});

test('bones mode selects edges only away from joint hit targets', () => {
  const rig = createCarDemoStyleRig();
  const fakeEditor = createBoneEditorHitTestFake(rig, 'bones');
  const root = rig.joints.find((joint) => joint.id === 'root');
  const rightMount = rig.joints.find((joint) => joint.id === 'right-mount');
  const bodyRight = rig.bones.find((bone) => bone.id === 'body-right');

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: rightMount.x - 0.2,
    y: rightMount.y - 0.2,
    col: Math.floor(rightMount.x),
    row: Math.floor(rightMount.y)
  }), true);
  assert.equal(fakeEditor.boneEditor.selectedJointId, 'right-mount');
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, null);
  fakeEditor.boneEditor.drag = null;

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: (root.x + rightMount.x) / 2,
    y: (root.y + rightMount.y) / 2,
    col: Math.floor((root.x + rightMount.x) / 2),
    row: Math.floor((root.y + rightMount.y) / 2)
  }), true);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, bodyRight.id);
  assert.equal(fakeEditor.boneEditor.drag.handle, 'body');
});

test('rig mode ignores edge hits away from nodes', () => {
  const rig = createCarDemoStyleRig();
  const fakeEditor = createBoneEditorHitTestFake(rig, 'bind');
  const root = rig.joints.find((joint) => joint.id === 'root');
  const rightMount = rig.joints.find((joint) => joint.id === 'right-mount');

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: (root.x + rightMount.x) / 2,
    y: (root.y + rightMount.y) / 2,
    col: Math.floor((root.x + rightMount.x) / 2),
    row: Math.floor((root.y + rightMount.y) / 2)
  }), false);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, null);
  assert.equal(fakeEditor.boneEditor.selectedJointId, null);
});

test('entering bind mode and finishing assignments reset stale move selection state', () => {
  const fakeEditor = {
    activeToolId: TOOL_IDS.MOVE,
    boneEditor: { mode: 'bones', drag: { type: 'create' }, linkMode: true, pendingBindNodeTap: { start: { col: 1, row: 1 } }, chainAnchor: null },
    selection: { active: true, mask: new Uint8Array([1]), bounds: { x: 0, y: 0, w: 1, h: 1 } },
    getBoneChainAnchorFromSelection() {
      return { jointId: 'joint-1', x: 1, y: 1 };
    },
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    clearSelection() {
      this.selection.active = false;
      this.selection.mask = null;
      this.selection.bounds = null;
    }
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.linkMode, false);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);

  fakeEditor.selection.active = true;
  fakeEditor.selection.mask = new Uint8Array([1]);
  fakeEditor.selection.bounds = { x: 0, y: 0, w: 1, h: 1 };
  PixelStudio.prototype.finishBoneBindingAction.call(fakeEditor);

  assert.equal(fakeEditor.selection.active, false);
  assert.equal(fakeEditor.selection.mask, null);
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
});

test('returning to bones after erasing clears stale bone state and allows node selection', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    leftPanelTabs: ['draw', 'bones'],
    leftPanelTab: 'bones',
    leftPanelTabIndex: 1,
    pixelPortraitSubpanel: 'tools',
    focusScroll: { toolOptions: 4 },
    activeToolId: TOOL_IDS.ERASER,
    boneRig: rig,
    canvasBounds: { cellSize: 8 },
    boneEditor: {
      mode: 'bones',
      selectedJointId: 'missing-joint',
      selectedBoneId: 'missing-bone',
      chainAnchor: null,
      drag: { type: 'create' },
      pendingBindNodeTap: { start: { col: 1, row: 1 } }
    },
    selection: { active: true, mask: new Uint8Array([1]), offset: { x: 2, y: 2 } },
    isMobileLayout() {
      return false;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    clearSelection() {
      this.selection.active = false;
      this.selection.mask = null;
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    startHistory() {}
  };

  PixelStudio.prototype.setLeftPanelTab.call(fakeEditor, 'draw');
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);

  fakeEditor.activeToolId = TOOL_IDS.ERASER;
  fakeEditor.boneEditor.drag = { type: 'create' };
  fakeEditor.boneEditor.pendingBindNodeTap = { start: { col: 1, row: 1 } };
  PixelStudio.prototype.setLeftPanelTab.call(fakeEditor, 'bones');

  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
  assert.equal(fakeEditor.boneEditor.selectedJointId, rig.bones[0].endJointId);
  assert.equal(fakeEditor.inputMode, 'canvas');
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 4, row: 1 }), true);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'arm');
  assert.equal(fakeEditor.boneEditor.drag.type, 'edit');
});

test('returning to rig from an eraser restores bind selection and bone taps', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    activeToolId: TOOL_IDS.ERASER,
    boneRig: rig,
    canvasBounds: { cellSize: 8 },
    boneEditor: {
      mode: 'bones',
      selectedJointId: null,
      selectedBoneId: null,
      chainAnchor: null,
      drag: { type: 'create' },
      pendingBindNodeTap: { start: { col: 1, row: 1 } }
    },
    selection: { active: false, mask: null },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getBoneChainAnchorFromSelection: PixelStudio.prototype.getBoneChainAnchorFromSelection,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 4, row: 1 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'arm');
  assert.equal(fakeEditor.boneEditor.selectedJointId, rig.bones[0].endJointId);
});

test('rig entry clears stale floating selection before node taps', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    activeToolId: TOOL_IDS.MOVE,
    boneRig: rig,
    canvasBounds: { cellSize: 8 },
    moveTransformDrag: { type: 'move' },
    selectionContextMenu: { x: 1, y: 1 },
    boneEditor: {
      mode: 'bones',
      selectedJointId: null,
      selectedBoneId: null,
      chainAnchor: null,
      drag: { type: 'create' },
      pendingBindNodeTap: { start: { col: 1, row: 1 } }
    },
    selection: {
      active: true,
      mask: new Uint8Array([1]),
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      mode: 'rect',
      start: { col: 0, row: 0 },
      end: { col: 1, row: 1 },
      floating: new Uint32Array([0xffcc6600]),
      floatingMode: 'paste',
      floatingBounds: { x: 0, y: 0, w: 8, h: 8 },
      offset: { x: 5, y: 6 },
      lassoPoints: [{ col: 0, row: 0 }, { col: 1, row: 1 }]
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    clearSelection: PixelStudio.prototype.clearSelection,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getBoneChainAnchorFromSelection: PixelStudio.prototype.getBoneChainAnchorFromSelection,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');

  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
  assert.equal(fakeEditor.selection.active, false);
  assert.equal(fakeEditor.selection.mask, null);
  assert.equal(fakeEditor.selection.floating, null);
  assert.equal(fakeEditor.selection.floatingMode, null);
  assert.equal(fakeEditor.selectionContextMenu, null);
  assert.equal(fakeEditor.moveTransformDrag, null);

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 4, row: 1 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'arm');
  assert.equal(fakeEditor.boneEditor.selectedJointId, rig.bones[0].endJointId);
});

test('loaded art documents reset stale bone editor state before selection normalization', () => {
  const fakeEditor = {
    boneEditor: {
      mode: 'bind',
      submenu: 'pose',
      selectedJointId: 'old-joint',
      selectedBoneId: 'old-bone',
      selectedEdgeBoneId: 'old-edge',
      linkMode: false,
      chainAnchor: { jointId: 'old-joint' },
      drag: { type: 'pose' },
      pendingBindNodeTap: { type: 'node-select' },
      playing: true,
      timeMs: 250
    },
    selection: {
      active: true,
      mask: new Uint8Array([1]),
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      floating: new Uint32Array([1]),
      floatingMode: 'paste',
      floatingBounds: { x: 0, y: 0, w: 1, h: 1 },
      offset: { x: 3, y: 4 }
    },
    moveTransformDrag: { type: 'move' },
    transformModal: { type: 'resize' },
    pasteImportModal: { bounds: { x: 0, y: 0, w: 20, h: 20 } },
    brushPickerOpen: true,
    paletteGridOpen: true,
    paletteColorPickerOpen: true,
    paletteRemoveMarked: new Set([1]),
    quickWheel: { active: true, type: 'tool', center: { x: 4, y: 4 }, selectionIndex: 0 },
    transportPopover: { type: 'play' },
    transportPopoverButtons: [{ bounds: { x: 0, y: 0, w: 1, h: 1 } }],
    uiSliderDrag: { id: 1 },
    menuScrollDrag: { id: 2 },
    clearSelection: PixelStudio.prototype.clearSelection
  };

  PixelStudio.prototype.resetLoadedBoneEditorState.call(fakeEditor);

  assert.equal(fakeEditor.boneEditor.mode, 'bones');
  assert.equal(fakeEditor.boneEditor.submenu, null);
  assert.equal(fakeEditor.boneEditor.selectedJointId, null);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, null);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, null);
  assert.equal(fakeEditor.boneEditor.linkMode, true);
  assert.equal(fakeEditor.boneEditor.chainAnchor, null);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
  assert.equal(fakeEditor.boneEditor.playing, false);
  assert.equal(fakeEditor.boneEditor.timeMs, 0);
  assert.equal(fakeEditor.selection.active, false);
  assert.equal(fakeEditor.selection.floating, null);
  assert.equal(fakeEditor.moveTransformDrag, null);
  assert.equal(fakeEditor.transformModal, null);
  assert.equal(fakeEditor.pasteImportModal, null);
  assert.equal(fakeEditor.brushPickerOpen, false);
  assert.equal(fakeEditor.paletteGridOpen, false);
  assert.equal(fakeEditor.paletteColorPickerOpen, false);
  assert.equal(fakeEditor.paletteRemoveMarked.size, 0);
  assert.equal(fakeEditor.quickWheel.active, false);
  assert.equal(fakeEditor.transportPopover, null);
  assert.deepEqual(fakeEditor.transportPopoverButtons, []);
  assert.equal(fakeEditor.uiSliderDrag, null);
  assert.equal(fakeEditor.menuScrollDrag, null);
});

test('mobile portrait drawer closes and still routes bone canvas taps', () => {
  const calls = [];
  const fakeEditor = {
    leftPanelTab: 'bones',
    mobileDrawer: 'panel',
    mobileDrawerBounds: { x: 0, y: 400, w: 390, h: 320 },
    pixelPortraitSubpanel: 'bones',
    canvasBounds: { x: 20, y: 20, w: 200, h: 200, cellSize: 10, mainX: 20, mainY: 20 },
    cursor: {},
    activeToolId: TOOL_IDS.SELECT_RECT,
    boneEditor: { mode: 'bind', drag: null },
    toolOptions: { wrapDraw: false },
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    view: { panX: 0, panY: 0 },
    viewportController: {
      beginPan() {
        throw new Error('bone tap should not pan');
      }
    },
    uiButtons: [{ bounds: { x: 0, y: 0, w: 390, h: 390 }, onClick: () => calls.push('stale-button') }],
    isMobileLayout() {
      return true;
    },
    isPointInBounds(point, bounds) {
      return point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.w && point.y <= bounds.y + bounds.h;
    },
    isPointInCircle() {
      return false;
    },
    startMenuScrollDrag() {
      return false;
    },
    enforceBoneEditorToolMode() {
      calls.push('enforce');
    },
    shouldUseUnboundedWrapPointer: PixelStudio.prototype.shouldUseUnboundedWrapPointer,
    getGridCellFromScreen() {
      return { col: 4, row: 5 };
    },
    getBoneCanvasPointFromScreen(_x, _y, point) {
      return point;
    },
    handleBonePointerDown(point) {
      calls.push(['bone', point]);
      return true;
    },
    handleToolPointerDown() {
      throw new Error('bone tap should not start pixel tools');
    },
    cancelLongPress() {
      calls.push('cancel-long-press');
    },
    setInputMode(mode) {
      this.inputMode = mode;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 60, y: 70, button: 0, touchCount: 1 });

  assert.equal(fakeEditor.mobileDrawer, null);
  assert.equal(fakeEditor.mobileDrawerBounds, null);
  assert.equal(fakeEditor.pixelPortraitSubpanel, null);
  assert.equal(fakeEditor.inputMode, 'canvas');
  assert.deepEqual(calls, ['enforce', ['bone', { col: 4, row: 5 }], 'cancel-long-press']);
});

test('bone overlay source uses yellow only for selected nodes, not edges', () => {
  const overlayStart = pixelStudioSource.indexOf('drawBoneOverlay(ctx');
  const overlayEnd = pixelStudioSource.indexOf('async choosePixelExportFormat()');
  const overlaySource = pixelStudioSource.slice(overlayStart, overlayEnd);

  assert.equal(overlaySource.includes('const selectedYellow = \'#ffe16a\''), true);
  assert.equal(overlaySource.includes('ctx.strokeStyle = selectedYellow'), false);
  assert.equal(overlaySource.includes("'#82f59a'"), true);
  assert.equal(overlaySource.includes("'#6ad7ff'"), true);
  assert.equal(overlaySource.includes('getActiveBoneOverlayIds(displayedBones)'), true);
  assert.equal(pixelStudioSource.includes("ctx.fillStyle = 'rgba(130, 245, 154, 0.32)'"), true);
});

test('bone editor suppresses generic pixel selection overlays', () => {
  assert.equal(pixelStudioSource.includes("const showGenericSelectionOverlays = this.leftPanelTab !== 'bones'"), true);
  assert.equal(pixelStudioSource.includes('if (showGenericSelectionOverlays && this.selection.active && this.selection.bounds)'), true);
  assert.equal(pixelStudioSource.includes('if (showGenericSelectionOverlays && this.selection.floating)'), true);
  assert.equal(pixelStudioSource.includes("if (this.leftPanelTab === 'bones') {\n      this.drawSelectedBoneBindingOverlay"), true);
});

test('tools commands close the tool mode and return to pose', () => {
  const fakeEditor = {
    boneEditor: { mode: 'time', submenu: 'time', timeMs: 500, playing: true },
    setBoneEditorMode: PixelStudio.prototype.setBoneEditorMode,
    getBoneChainAnchorFromSelection() {
      return null;
    },
    setInputMode() {}
  };

  PixelStudio.prototype.runBoneToolCommand.call(fakeEditor, () => {
    fakeEditor.boneEditor.timeMs = 0;
    fakeEditor.boneEditor.playing = false;
  }, 'pose');

  assert.equal(fakeEditor.boneEditor.mode, 'pose');
  assert.equal(fakeEditor.boneEditor.submenu, null);
  assert.equal(fakeEditor.boneEditor.timeMs, 0);
  assert.equal(fakeEditor.boneEditor.playing, false);
});

test('baking bone animation switches to the animation frames panel', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(6, 4, 'Arm');
  layer.pixels[1 * 6 + 3] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 6, 4, layer.pixels);
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { mode: 'time', submenu: 'time', segmentMs: 120, durationMs: 120, timeMs: 0 },
    canvasState: { width: 6, height: 4 },
    animation: { currentFrameIndex: 0, frames: [createFrame([layer], 120)] },
    currentFrame: createFrame([layer], 120),
    leftPanelTab: 'bones',
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    setBoneEditorMode: PixelStudio.prototype.setBoneEditorMode,
    getBoneChainAnchorFromSelection() {
      return null;
    },
    setInputMode() {},
    stopAnimationPreview() {},
    startHistory() {},
    commitHistory() {},
    setFrameLayers(layers) {
      this.currentFrame.layers = layers;
    }
  };

  PixelStudio.prototype.bakeBoneAnimationToCopiedFrames.call(fakeEditor);

  assert.equal(fakeEditor.leftPanelTab, 'animation');
  assert.equal(fakeEditor.boneEditor.mode, 'pose');
  assert.equal(fakeEditor.boneEditor.submenu, null);
  assert.ok(fakeEditor.animation.frames.length > 1);
});

test('portrait bone editor uses one root action row with focused submenus', () => {
  assert.deepEqual(
    buildPixelPortraitBoneActions().map((entry) => entry.label),
    ['Bones', 'Rig', 'Pose', 'Tools']
  );

  const groups = buildPixelPortraitBoneActionGroups();
  assert.deepEqual(groups.bones.actionIds, ['bone-add', 'bone-link', 'bone-reverse', 'bone-stretch', 'bone-ik', 'bone-delete']);
  assert.equal(groups.bind.actionIds.includes('bind-mode'), true);
  assert.equal(groups.bind.actionIds.includes('bind-prev'), false);
  assert.equal(groups.bind.actionIds.includes('bind-next'), false);
  assert.equal(groups.bind.actionIds.includes('bind-add'), true);
  assert.equal(groups.bind.actionIds.includes('selection-clipboard'), false);
  assert.equal(groups.bind.actionIds.includes('selection-transform-tools'), false);
  assert.deepEqual(groups.pose.actionIds, ['pose-set', 'pose-reset', 'pose-delete', 'pose-back', 'pose-forward', 'pose-length']);
  assert.equal(groups.pose.actionIds.includes('pose-time'), false);
  assert.deepEqual(groups.time.actionIds, ['time-bake']);
  assert.equal(groups.time.actionIds.includes('time-rewind'), false);
  assert.equal(groups.time.actionIds.includes('time-play'), false);
  assert.equal(groups.time.actionIds.includes('time-forward'), false);
  assert.equal(pixelStudioSource.includes("id: 'bone-play'"), true);
  assert.equal(pixelStudioSource.includes("transportMode: 'bones'"), true);
  assert.equal(pixelStudioSource.includes("this.transportPopover?.mode === 'bones'"), true);
  assert.equal(pixelStudioSource.includes("this.boneEditor.submenu === entry.id ? null : entry.id"), true);
});

test('bone transport actions scrub and play the pose timeline', () => {
  const fakeEditor = {
    boneEditor: { mode: 'bones', submenu: 'time', timeMs: 250, segmentMs: 100, playing: false },
    animation: { playing: true },
    runBoneToolCommand: PixelStudio.prototype.runBoneToolCommand,
    nudgeBoneTime: PixelStudio.prototype.nudgeBoneTime,
    toggleBoneTimelinePlayback: PixelStudio.prototype.toggleBoneTimelinePlayback,
    getBoneTimelineDurationMs() {
      return 500;
    },
    setBoneEditorMode(mode) {
      this.boneEditor.mode = mode;
    }
  };
  const actions = PixelStudio.prototype.getBoneTransportActions.call(fakeEditor);

  assert.deepEqual(actions.map((entry) => entry.id), ['bone-start', 'bone-back', 'bone-forward', 'bone-play']);
  actions.find((entry) => entry.id === 'bone-play').action();
  assert.equal(fakeEditor.boneEditor.playing, true);
  assert.equal(fakeEditor.animation.playing, false);
  assert.equal(fakeEditor.boneEditor.mode, 'pose');
  actions.find((entry) => entry.id === 'bone-forward').action();
  assert.equal(fakeEditor.boneEditor.timeMs, 350);
  assert.equal(fakeEditor.boneEditor.playing, false);
  actions.find((entry) => entry.id === 'bone-start').action();
  assert.equal(fakeEditor.boneEditor.timeMs, 0);
});

test('bone pose timeline duration respects explicit length and later keys', () => {
  assert.equal(getPixelBoneTimelineDurationMs([], { segmentMs: 500, durationMs: 1500 }), 1500);
  assert.equal(getPixelBoneTimelineDurationMs([{ timeMs: 2400 }], { segmentMs: 500, durationMs: 1500 }), 2400);
  assert.equal(getPixelBoneTimelineDurationMs([], { segmentMs: 750, durationMs: 0 }), 750);
});

test('PixelStudio exposes bone editor as a non-runtime frame baking workflow', () => {
  assert.equal(pixelStudioSource.includes("this.leftPanelTabs = ['file', 'draw', 'select', 'tools', 'canvas', 'layers', 'animation', 'bones']"), true);
  assert.equal(pixelStudioSource.includes("id: 'bone-editor'"), false);
  assert.equal(pixelStudioSource.includes('drawBoneEditorPanel(ctx'), true);
  assert.equal(pixelStudioSource.includes('handleBonePointerDown(point)'), true);
  assert.equal(pixelStudioSource.includes('compositeBonePreview(this.canvasState.layers'), true);
  assert.equal(pixelStudioSource.includes('let composite = this.shouldShowBonePreview()'), true);
  assert.equal(pixelStudioSource.includes('getDisplayedBonesForBoneEditor()'), true);
  assert.equal(pixelStudioSource.includes("&& (mode === 'pose' || mode === 'time')"), true);
  assert.equal(pixelStudioSource.includes('setBonePosePatchAtCurrentTime(boneId'), true);
  assert.equal(pixelStudioSource.includes('drag tip rotate, body move'), true);
  assert.equal(pixelStudioSource.includes('bakeBoneAnimationToCopiedFrames()'), true);
  assert.equal(pixelStudioSource.includes('drawBoneContextRail(ctx'), true);
  assert.equal(pixelStudioSource.includes('drawBoneTimelineStrip(ctx'), true);
  assert.equal(pixelStudioSource.includes('addSelectionToSelectedBone()'), true);
  assert.equal(pixelStudioSource.includes('removeSelectionFromSelectedBone()'), true);
  assert.equal(pixelStudioSource.includes('drawBoneContextSubmenuSheet(ctx'), true);
  assert.equal(pixelStudioSource.includes('promptBoneTimelineLength()'), true);
  assert.equal(pixelStudioSource.includes("label: 'Length'"), true);
  assert.equal(pixelStudioSource.includes("label: 'Frame Time'"), false);
  assert.equal(pixelStudioSource.includes("label: 'Assign'"), true);
  assert.equal(pixelStudioSource.includes("label: 'Rig'"), true);
  assert.equal(pixelStudioSource.includes("label: 'Reset'"), true);
  assert.equal(pixelStudioSource.includes("id: 'bone-link'"), true);
  assert.equal(pixelStudioSource.includes('createLinkedBoneFromAnchor(end)'), true);
  assert.equal(pixelStudioSource.includes('drawSelectedBoneBindingOverlay(ctx'), true);
  assert.equal(pixelStudioSource.includes('this.animation.frames.splice(insertAt, 0, ...baked)'), true);
  assert.equal(pixelStudioSource.includes('bones: cloneBoneRig(this.boneRig)'), true);
  assert.equal(pixelStudioSource.includes('if (options.includeFrames)'), true);
  assert.equal(pixelStudioSource.includes("this.startHistory('bake bone animation', { includeFrames: true })"), true);
});
