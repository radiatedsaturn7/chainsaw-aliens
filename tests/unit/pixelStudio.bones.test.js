import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  addMaskToBoneBinding,
  bakeBoneFrames,
  bakeBoneTimelineFrames,
  compositeBonePreview,
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
  samplePoseTimeline,
  solveTwoBoneIkPose,
  setBonePoseAtTime,
  setBonePoseForFrame
} from '../../src/ui/pixel-editor/bones.js';
import PixelStudio, {
  buildPixelPortraitBoneActionGroups,
  buildPixelPortraitBoneActions,
  getPixelBoneTimelineDurationMs
} from '../../src/ui/PixelStudio.js';
import { createFrame } from '../../src/ui/pixel-editor/animation.js';
import { createLayer } from '../../src/ui/pixel-editor/layers.js';

const pixelStudioSource = readFileSync(new URL('../../src/ui/PixelStudio.js', import.meta.url), 'utf8');

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
  rig = createBone(rig, { x: 2, y: 2 }, { x: 3, y: 2 }, { id: 'left' }).rig;
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

test('portrait bone editor uses one root action row with focused submenus', () => {
  assert.deepEqual(
    buildPixelPortraitBoneActions().map((entry) => entry.label),
    ['Bones', 'Bind', 'Pose', 'Tools']
  );

  const groups = buildPixelPortraitBoneActionGroups();
  assert.deepEqual(groups.bones.actionIds, ['bone-add', 'bone-link', 'bone-delete', 'bone-prev', 'bone-next']);
  assert.equal(groups.bind.actionIds.includes('bind-mode'), true);
  assert.equal(groups.bind.actionIds.includes('bind-prev'), true);
  assert.equal(groups.bind.actionIds.includes('bind-next'), true);
  assert.equal(groups.bind.actionIds.includes('bind-add'), true);
  assert.equal(groups.bind.actionIds.includes('selection-clipboard'), false);
  assert.equal(groups.bind.actionIds.includes('selection-transform-tools'), false);
  assert.deepEqual(groups.pose.actionIds, ['pose-set', 'pose-delete', 'pose-prev', 'pose-next', 'pose-back', 'pose-forward', 'pose-length']);
  assert.equal(groups.pose.actionIds.includes('pose-time'), false);
  assert.equal(groups.time.actionIds.includes('time-rewind'), true);
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
  assert.equal(pixelStudioSource.includes("&& (mode === 'pose' || mode === 'time' || this.boneEditor?.playing)"), true);
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
  assert.equal(pixelStudioSource.includes("id: 'bone-link'"), true);
  assert.equal(pixelStudioSource.includes('createLinkedBoneFromAnchor(end)'), true);
  assert.equal(pixelStudioSource.includes('drawSelectedBoneBindingOverlay(ctx'), true);
  assert.equal(pixelStudioSource.includes('this.animation.frames.splice(insertAt, 0, ...baked)'), true);
  assert.equal(pixelStudioSource.includes('bones: cloneBoneRig(this.boneRig)'), true);
  assert.equal(pixelStudioSource.includes('if (options.includeFrames)'), true);
  assert.equal(pixelStudioSource.includes("this.startHistory('bake bone animation', { includeFrames: true })"), true);
});
