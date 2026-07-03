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
  deformLayersWithBones,
  deformLayersWithBonePose,
  getBoneAffectedPixelCounts,
  getBoneAssignedMask,
  getBoneInfluenceSets,
  getBoneJointUsageCount,
  getPosedBoneGeometry,
  createLayerBinding,
  createSelectionBinding,
  moveBoneJoint,
  normalizeBoneRig,
  normalizeBoneSkeleton,
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
  getPixelBoneBakeSampleTimes,
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

test('bone skeleton normalization does not de-dupe binding pixels', () => {
  const sourceBinding = {
    type: 'selection',
    layerIndex: 0,
    boneIds: ['arm', 'leg'],
    pixels: [
      { index: 4, weights: { arm: 1 } },
      { index: 4, weights: { leg: 1 } }
    ]
  };
  const source = {
    bones: [
      { id: 'arm', start: { x: 0, y: 0 }, end: { x: 3, y: 0 } },
      { id: 'leg', start: { x: 0, y: 1 }, end: { x: 3, y: 1 } }
    ],
    bindings: [sourceBinding]
  };

  const skeleton = normalizeBoneSkeleton(source);
  const full = normalizeBoneRig(source);

  assert.equal(skeleton.bindings[0], sourceBinding);
  assert.equal(skeleton.bindings[0].pixels.length, 2);
  assert.equal(full.bindings.length, 1);
  assert.deepEqual(full.bindings[0].boneIds, ['leg']);
  assert.equal(full.bindings[0].pixels.length, 1);
});

test('non-exclusive bone rig normalization preserves assignment ownership for pose caches', () => {
  const source = {
    bones: [
      { id: 'arm', start: { x: 0, y: 0 }, end: { x: 3, y: 0 } },
      { id: 'leg', start: { x: 0, y: 1 }, end: { x: 3, y: 1 } }
    ],
    bindings: [{
      type: 'selection',
      layerIndex: 0,
      boneIds: ['arm', 'leg'],
      pixels: [
        { index: 4, weights: { arm: 1 } },
        { index: 4, weights: { leg: 1 } }
      ]
    }]
  };

  const poseRig = normalizeBoneRig(source, { exclusive: false });
  const assignmentRig = normalizeBoneRig(source);

  assert.equal(poseRig.bindings.length, 1);
  assert.deepEqual(poseRig.bindings[0].boneIds, ['arm', 'leg']);
  assert.equal(poseRig.bindings[0].pixels.length, 2);
  assert.equal(assignmentRig.bindings.length, 1);
  assert.deepEqual(assignmentRig.bindings[0].boneIds, ['leg']);
  assert.equal(assignmentRig.bindings[0].pixels.length, 1);
});

test('posed bone geometry does not read binding pixels', () => {
  const binding = {
    type: 'selection',
    layerIndex: 0,
    boneIds: ['arm']
  };
  Object.defineProperty(binding, 'pixels', {
    get() {
      throw new Error('pose geometry should not normalize binding pixels');
    }
  });
  const rig = {
    bones: [{ id: 'arm', start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }],
    bindings: [binding],
    poseTimeline: [{ timeMs: 0, bones: { arm: { angle: Math.PI / 2 } } }]
  };

  const posed = getPosedBoneGeometry(rig, { bones: { arm: { angle: Math.PI / 2 } } });

  assert.equal(posed.length, 1);
  assert.ok(Math.abs(posed[0].angle - Math.PI / 2) < 0.0001);
});

test('pose timeline sampling does not read binding pixels', () => {
  const binding = {
    type: 'selection',
    layerIndex: 0,
    boneIds: ['arm']
  };
  Object.defineProperty(binding, 'pixels', {
    get() {
      throw new Error('pose timeline should not normalize binding pixels');
    }
  });
  const rig = {
    bones: [{ id: 'arm', start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }],
    bindings: [binding],
    poseTimeline: [{ timeMs: 100, bones: { arm: { angle: Math.PI / 2 } } }]
  };

  const sampled = samplePoseTimeline(rig, 100);

  assert.equal(sampled.bones.arm.angle, Math.PI / 2);
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

test('shared joint owned pixels resolve to the incoming parent edge', () => {
  let rig = createDefaultBoneRig();
  const torso = createBone(rig, { x: 2, y: 1 }, { x: 4, y: 1 }, { id: 'torso' });
  rig = torso.rig;
  rig = createBone(rig, torso.bone.end, { x: 6, y: 1 }, {
    id: 'head',
    parentId: 'torso',
    startJointId: torso.bone.endJointId
  }).rig;
  const layer = createLayer(8, 4, 'Shared Joint');
  const index = 1 * 8 + 4;
  layer.pixels[index] = 0xff00ffff;
  const mask = new Uint8Array(8 * 4);
  mask[index] = 1;
  rig = createSelectionBinding(rig, 0, [torso.bone.endJointId], mask, 8, 4);
  rig = {
    ...rig,
    bindings: rig.bindings.map((binding) => ({ ...binding, skinningMode: 'rigid-layer' }))
  };

  const [headMoved] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { head: { angle: 0, dx: 2, dy: 0, scale: 1 } }
  });
  assert.equal(headMoved.pixels[index], 0xff00ffff);
  assert.equal(headMoved.pixels[index + 2], 0);

  const [torsoMoved] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { torso: { angle: 0, dx: 2, dy: 0, scale: 1 } }
  });
  assert.equal(torsoMoved.pixels[index], 0);
  assert.equal(torsoMoved.pixels[index + 2], 0xff00ffff);
});

test('root joint owned pixels resolve to the outgoing root edge', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'root' });
  rig = root.rig;
  const layer = createLayer(8, 4, 'Root Joint');
  const index = 1 * 8 + 1;
  layer.pixels[index] = 0xff00ffff;
  const mask = new Uint8Array(8 * 4);
  mask[index] = 1;
  rig = createSelectionBinding(rig, 0, [root.bone.startJointId], mask, 8, 4);

  const [deformed] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { root: { angle: 0, dx: 2, dy: 0, scale: 1 } }
  });

  assert.equal(deformed.pixels[index], 0);
  assert.equal(deformed.pixels[index + 2], 0xff00ffff);
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

test('bone pose timeline bake can use an explicit frame count', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(8, 8, 'Arm');
  layer.pixels[1 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 8, 8, layer.pixels);
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: 0 });
  rig = setBonePoseAtTime(rig, 1000, 'arm', { angle: Math.PI });

  const baked = bakeBoneTimelineFrames(createFrame([layer], 250), 8, 8, rig, {
    frameDurationMs: 250,
    durationMs: 1000,
    frameCount: 3
  });

  assert.equal(baked.length, 3);
  assert.deepEqual(baked.map((frame) => frame.durationMs), [500, 500, 250]);
});

test('bone pose bake default samples keyframes and midpoint frames with variable durations', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(8, 8, 'Arm');
  layer.pixels[1 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 8, 8, layer.pixels);
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: 0 });
  rig = setBonePoseAtTime(rig, 1000, 'arm', { angle: Math.PI / 2 });
  rig = setBonePoseAtTime(rig, 2000, 'arm', { angle: Math.PI });

  const sampledTimes = [];
  const baked = bakeBoneTimelineFrames(createFrame([layer], 250), 8, 8, rig, {
    frameDurationMs: 250,
    durationMs: 2000,
    sampleTimes: getPixelBoneBakeSampleTimes(rig.poseTimeline),
    onSample: (timeMs) => sampledTimes.push(timeMs)
  });

  assert.equal(baked.length, 5);
  assert.deepEqual(sampledTimes, [0, 500, 1000, 1500, 2000]);
  assert.deepEqual(baked.map((frame) => frame.durationMs), [500, 500, 500, 500, 250]);
});

test('bone pose bake default keeps irregular key timing compact', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(8, 8, 'Arm');
  layer.pixels[1 * 8 + 4] = 0xff0000ff;
  rig = createLayerBinding(rig, 0, ['arm'], 8, 8, layer.pixels);
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: 0 });
  rig = setBonePoseAtTime(rig, 93, 'arm', { angle: Math.PI / 2 });
  rig = setBonePoseAtTime(rig, 1000, 'arm', { angle: Math.PI });

  const sampledTimes = [];
  const baked = bakeBoneTimelineFrames(createFrame([layer], 31), 8, 8, rig, {
    frameDurationMs: 31,
    durationMs: 1000,
    sampleTimes: getPixelBoneBakeSampleTimes(rig.poseTimeline),
    onSample: (timeMs) => sampledTimes.push(timeMs)
  });

  assert.deepEqual(getPixelBoneBakeSampleTimes(rig.poseTimeline), [0, 46.5, 93, 546.5, 1000]);
  assert.deepEqual(sampledTimes, [0, 46.5, 93, 546.5, 1000]);
  assert.deepEqual(baked.map((frame) => frame.durationMs), [47, 47, 454, 454, 31]);
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

test('setting start and end pose keys anchors the loop after later middle edits', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 1, y: 3 }, { x: 4, y: 3 }, { id: 'leg' }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { timeMs: 0, previewPose: { bones: { stale: { angle: 3 } } }, previewPoseTimeMs: 0, previewPoseSignature: 'stale' },
    getSelectedBone() {
      return this.boneRig.bones.find((bone) => bone.id === 'arm') || null;
    },
    getFullBoneTimelinePoseSnapshot: PixelStudio.prototype.getFullBoneTimelinePoseSnapshot,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.setBoneTimelineKey.call(fakeEditor);
  fakeEditor.boneEditor.timeMs = 1000;
  PixelStudio.prototype.setBoneTimelineKey.call(fakeEditor);
  fakeEditor.boneEditor.timeMs = 500;
  PixelStudio.prototype.setBonePosePatchAtCurrentTime.call(fakeEditor, 'leg', {
    angle: 1,
    dx: 0,
    dy: 10,
    scale: 1
  });

  const start = samplePoseTimeline(fakeEditor.boneRig, 0);
  const middle = samplePoseTimeline(fakeEditor.boneRig, 500);
  const between = samplePoseTimeline(fakeEditor.boneRig, 750);
  const end = samplePoseTimeline(fakeEditor.boneRig, 1000);
  const endKey = fakeEditor.boneRig.poseTimeline.find((key) => key.timeMs === 1000);

  assert.deepEqual(start.bones.leg, { angle: 0, dx: 0, dy: 0, scale: 1 });
  assert.equal(middle.bones.leg.dy, 10);
  assert.ok(between.bones.leg.dy > 0 && between.bones.leg.dy < 10);
  assert.deepEqual(end.bones.leg, { angle: 0, dx: 0, dy: 0, scale: 1 });
  assert.deepEqual(Object.keys(endKey.bones).sort(), ['arm', 'leg']);
  assert.equal(fakeEditor.boneEditor.previewPose, null);
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

test('large bound layer bone preview stays responsive', () => {
  const width = 128;
  const height = 128;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 32, y: 64 }, { x: 96, y: 64 }, { id: 'root' }).rig;
  const layer = createLayer(width, height, 'Large Sprite');
  layer.pixels.fill(0x66ccffff);
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < 4096; index += 1) mask[index] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, width, height);

  const startedAt = performance.now();
  const preview = compositeBonePreview([layer], width, height, rig, {
    bones: { root: { angle: 0.1, dx: 0, dy: 0, scale: 1 } }
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(preview.length, width * height);
  assert.ok(preview.some((pixel) => pixel === 0x66ccffff));
  assert.ok(elapsedMs < 2000, `large bone preview took ${Math.round(elapsedMs)}ms`);
});

test('large bound layer preview rotation keeps rigged pixels visible', () => {
  const width = 128;
  const height = 128;
  const riggedColor = 0x66ccffff;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 64, y: 64 }, { x: 96, y: 64 }, { id: 'hand' }).rig;
  const layer = createLayer(width, height, 'Large Character');
  layer.pixels.fill(0xff0000ff);
  const mask = new Uint8Array(width * height);
  for (let y = 32; y < 96; y += 1) {
    for (let x = 32; x < 96; x += 1) {
      const index = y * width + x;
      mask[index] = 1;
      layer.pixels[index] = riggedColor;
    }
  }
  rig = addMaskToBoneBinding(rig, 0, 'hand', mask, width, height);

  const sourceRiggedPixels = layer.pixels.reduce((count, pixel) => count + (pixel === riggedColor ? 1 : 0), 0);
  const [previewLayer] = deformLayersWithBones([layer], width, height, rig, {
    bones: { hand: { angle: 0.35, dx: 0, dy: 0, scale: 1 } }
  }, { preview: true });
  const previewRiggedPixels = previewLayer.pixels.reduce((count, pixel) => count + (pixel === riggedColor ? 1 : 0), 0);

  assert.ok(previewRiggedPixels >= sourceRiggedPixels);
});

test('active large pose preview rotation does not leave transparent holes inside rigged pixels', () => {
  const width = 128;
  const height = 128;
  const riggedColor = 0x66ccffff;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 64, y: 64 }, { x: 106, y: 64 }, { id: 'arm' }).rig;
  const layer = createLayer(width, height, 'Large Transparent Sprite');
  const mask = new Uint8Array(width * height);
  for (let y = 12; y < 124; y += 1) {
    for (let x = 12; x < 122; x += 1) {
      const index = y * width + x;
      mask[index] = 1;
      layer.pixels[index] = riggedColor;
    }
  }
  rig = addMaskToBoneBinding(rig, 0, 'arm', mask, width, height);

  const [previewLayer] = deformLayersWithBones([layer], width, height, rig, {
    bones: { arm: { angle: 0.45, dx: 0, dy: 0, scale: 1 } }
  }, {
    preview: true,
    activeBoneIds: new Set(['arm']),
    meshCache: new Map()
  });
  let transparentHoles = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (previewLayer.pixels[index]) continue;
      const filledLeftRight = previewLayer.pixels[index - 1] === riggedColor
        && previewLayer.pixels[index + 1] === riggedColor;
      const filledUpDown = previewLayer.pixels[index - width] === riggedColor
        && previewLayer.pixels[index + width] === riggedColor;
      if (filledLeftRight || filledUpDown) transparentHoles += 1;
    }
  }

  assert.equal(transparentHoles, 0);
});

test('bone only history skips layer pixel snapshots while preserving bone undo data', () => {
  const layer = createLayer(4, 4, 'History');
  layer.pixels[5] = 0xff00ffff;
  let committed = null;
  const fakeEditor = {
    animation: { currentFrameIndex: 0, frames: [createFrame([layer], 120)] },
    canvasState: { layers: [layer] },
    boneRig: createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig,
    runtime: {
      commitHistory(entry) {
        committed = entry;
      }
    },
    syncTileData() {},
    invalidateBoneDerivedCaches: PixelStudio.prototype.invalidateBoneDerivedCaches
  };
  fakeEditor.boneDerivedCache = { revision: 1, overlay: {}, preview: {} };

  PixelStudio.prototype.startHistory.call(fakeEditor, 'add pixels to bone', { includeLayers: false });
  fakeEditor.boneRig = createBone(fakeEditor.boneRig, { x: 3, y: 0 }, { x: 6, y: 0 }, { id: 'child' }).rig;
  PixelStudio.prototype.commitHistory.call(fakeEditor);

  assert.equal(committed.label, 'add pixels to bone');
  assert.equal(committed.layersBefore, undefined);
  assert.equal(committed.layersAfter, undefined);
  assert.equal(committed.boneRigBefore.bones.length, 1);
  assert.equal(committed.boneRigAfter.bones.length, 2);
});

test('setFrameLayers invalidates caches without undefined history locals', () => {
  const oldLayer = createLayer(2, 2, 'Old');
  const nextLayer = createLayer(2, 2, 'Next');
  const fakeEditor = Object.create(PixelStudio.prototype);
  fakeEditor.animation = { currentFrameIndex: 0, frames: [createFrame([oldLayer], 120)] };
  fakeEditor.canvasState = { layers: [oldLayer] };
  fakeEditor.boneDerivedCache = {
    revision: 1,
    layerRevision: 1,
    boneRevision: 1,
    overlay: {},
    overlayRaster: {},
    graphOverlayRaster: {},
    composite: {},
    preview: {},
    raster: {},
    geometry: {},
    mesh: {}
  };

  PixelStudio.prototype.setFrameLayers.call(fakeEditor, [nextLayer]);

  assert.equal(fakeEditor.canvasState.layers[0], nextLayer);
  assert.equal(fakeEditor.animation.frames[0].layers[0], nextLayer);
  assert.equal(fakeEditor.boneDerivedCache.layerRevision, 2);
  assert.equal(fakeEditor.boneDerivedCache.boneRevision, 2);
  assert.equal(fakeEditor.boneDerivedCache.composite, null);
  assert.equal(fakeEditor.boneDerivedCache.graphOverlayRaster, null);
});

test('selected bone binding overlay caches assigned indexes and invalidates by revision', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  mask[6] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, 4, 4);
  const fakeEditor = {
    boneRig: rig,
    boneDerivedCache: { revision: 1, overlay: null, preview: null },
    canvasState: { width: 4, height: 4, activeLayerIndex: 0 },
    getSelectedBoneOwnerId() {
      return 'root';
    }
  };

  const first = PixelStudio.prototype.getSelectedBoneBindingOverlayIndexes.call(fakeEditor);
  const second = PixelStudio.prototype.getSelectedBoneBindingOverlayIndexes.call(fakeEditor);
  fakeEditor.boneDerivedCache.revision += 1;
  const third = PixelStudio.prototype.getSelectedBoneBindingOverlayIndexes.call(fakeEditor);

  assert.deepEqual(first.sort((a, b) => a - b), [5, 6]);
  assert.equal(second, first);
  assert.notEqual(third, first);
  assert.deepEqual(third.sort((a, b) => a - b), [5, 6]);
});

test('selected bone binding overlay raster reuses assigned pixels while panning', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  mask[6] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, 4, 4);
  let overlayFillCount = 0;
  let drawImageCount = 0;
  let canvasFillCount = 0;
  const fakeEditor = {
    boneRig: rig,
    boneDerivedCache: { revision: 1, overlay: null, overlayRaster: null, preview: null },
    boneOverlayCanvas: { width: 0, height: 0 },
    boneOverlayCtx: {
      imageSmoothingEnabled: true,
      clearRect() {},
      fillRect() {
        overlayFillCount += 1;
      }
    },
    canvasState: { width: 4, height: 4, activeLayerIndex: 0 },
    getSelectedBoneOwnerId() {
      return 'root';
    },
    shouldHideBoneOverlaysDuringPlayback() {
      return false;
    },
    getSelectedBoneBindingOverlayIndexes: PixelStudio.prototype.getSelectedBoneBindingOverlayIndexes,
    getCachedSelectedBoneBindingOverlayRaster: PixelStudio.prototype.getCachedSelectedBoneBindingOverlayRaster
  };
  const ctx = {
    save() {},
    restore() {},
    drawImage() {
      drawImageCount += 1;
    },
    fillRect() {
      canvasFillCount += 1;
    }
  };

  PixelStudio.prototype.drawSelectedBoneBindingOverlay.call(fakeEditor, ctx, 0, 0, 8);
  PixelStudio.prototype.drawSelectedBoneBindingOverlay.call(fakeEditor, ctx, 40, 20, 8);

  assert.equal(overlayFillCount, 2);
  assert.equal(drawImageCount, 2);
  assert.equal(canvasFillCount, 0);
});

test('selected bone binding overlay raster invalidates by revision', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  mask[6] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, 4, 4);
  let overlayFillCount = 0;
  const fakeEditor = {
    boneRig: rig,
    boneDerivedCache: { revision: 1, overlay: null, overlayRaster: null, preview: null },
    boneOverlayCanvas: { width: 0, height: 0 },
    boneOverlayCtx: {
      imageSmoothingEnabled: true,
      clearRect() {},
      fillRect() {
        overlayFillCount += 1;
      }
    },
    canvasState: { width: 4, height: 4, activeLayerIndex: 0 },
    getSelectedBoneOwnerId() {
      return 'root';
    },
    shouldHideBoneOverlaysDuringPlayback() {
      return false;
    },
    getSelectedBoneBindingOverlayIndexes: PixelStudio.prototype.getSelectedBoneBindingOverlayIndexes,
    getCachedSelectedBoneBindingOverlayRaster: PixelStudio.prototype.getCachedSelectedBoneBindingOverlayRaster
  };
  const ctx = { save() {}, restore() {}, drawImage() {} };

  PixelStudio.prototype.drawSelectedBoneBindingOverlay.call(fakeEditor, ctx, 0, 0, 8);
  fakeEditor.boneDerivedCache.revision += 1;
  PixelStudio.prototype.drawSelectedBoneBindingOverlay.call(fakeEditor, ctx, 0, 0, 8);

  assert.equal(overlayFillCount, 4);
});

test('bone graph overlay raster reuses vector drawing while panning', () => {
  const rig = createBone(createDefaultBoneRig(), { x: -2, y: 1 }, { x: 3, y: 1 }, { id: 'root' }).rig;
  let vectorDraws = 0;
  let drawImages = 0;
  const fakeEditor = {
    boneRig: rig,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, graphOverlayRaster: null },
    boneEditor: {
      mode: 'bones',
      selectedJointId: rig.bones[0].startJointId,
      selectedBoneId: 'root',
      selectedEdgeBoneId: null,
      linkMode: false,
      chainAnchor: null,
      drag: null
    },
    boneGraphOverlayCanvas: { width: 0, height: 0 },
    boneGraphOverlayCtx: {
      imageSmoothingEnabled: true,
      clearRect() {}
    },
    shouldHideBoneOverlaysDuringPlayback() {
      return false;
    },
    getDisplayedBonesForBoneEditor() {
      return rig.bones;
    },
    getBoneGraphOverlaySignature: PixelStudio.prototype.getBoneGraphOverlaySignature,
    getBoneGraphOverlayBounds: PixelStudio.prototype.getBoneGraphOverlayBounds,
    getCachedBoneGraphOverlayRaster: PixelStudio.prototype.getCachedBoneGraphOverlayRaster,
    drawBoneOverlay: PixelStudio.prototype.drawBoneOverlay,
    drawBoneOverlayVector() {
      vectorDraws += 1;
    }
  };
  const ctx = {
    save() {},
    restore() {},
    drawImage() {
      drawImages += 1;
    }
  };

  PixelStudio.prototype.drawBoneOverlay.call(fakeEditor, ctx, 0, 0, 8);
  PixelStudio.prototype.drawBoneOverlay.call(fakeEditor, ctx, 40, 20, 8);

  assert.equal(vectorDraws, 1);
  assert.equal(drawImages, 2);
  assert.ok(fakeEditor.boneDerivedCache.graphOverlayRaster.bounds.x < 0);
});

test('bone graph overlay raster invalidates on zoom selection and bone revision', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  let vectorDraws = 0;
  const fakeEditor = {
    boneRig: rig,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, graphOverlayRaster: null },
    boneEditor: {
      mode: 'bones',
      selectedJointId: rig.bones[0].startJointId,
      selectedBoneId: 'root',
      selectedEdgeBoneId: null,
      linkMode: false,
      chainAnchor: null,
      drag: null
    },
    boneGraphOverlayCanvas: { width: 0, height: 0 },
    boneGraphOverlayCtx: {
      imageSmoothingEnabled: true,
      clearRect() {}
    },
    shouldHideBoneOverlaysDuringPlayback() {
      return false;
    },
    getDisplayedBonesForBoneEditor() {
      return rig.bones;
    },
    getBoneGraphOverlaySignature: PixelStudio.prototype.getBoneGraphOverlaySignature,
    getBoneGraphOverlayBounds: PixelStudio.prototype.getBoneGraphOverlayBounds,
    getCachedBoneGraphOverlayRaster: PixelStudio.prototype.getCachedBoneGraphOverlayRaster,
    drawBoneOverlay: PixelStudio.prototype.drawBoneOverlay,
    drawBoneOverlayVector() {
      vectorDraws += 1;
    }
  };
  const ctx = { save() {}, restore() {}, drawImage() {} };

  PixelStudio.prototype.drawBoneOverlay.call(fakeEditor, ctx, 0, 0, 8);
  fakeEditor.boneEditor.selectedEdgeBoneId = 'root';
  PixelStudio.prototype.drawBoneOverlay.call(fakeEditor, ctx, 0, 0, 8);
  PixelStudio.prototype.drawBoneOverlay.call(fakeEditor, ctx, 0, 0, 12);
  fakeEditor.boneDerivedCache.boneRevision += 1;
  PixelStudio.prototype.drawBoneOverlay.call(fakeEditor, ctx, 0, 0, 12);

  assert.equal(vectorDraws, 4);
});

test('bone only cache invalidation preserves layer raster cache', () => {
  const pixels = new Uint32Array([0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffffffff]);
  let imageDataUploads = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    linePreview: null,
    curvePreview: null,
    shapePreview: null,
    polygonPreview: null,
    gradientPreview: null,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, composite: null, preview: null, raster: null, geometry: null },
    bonePreviewCanvas: { width: 0, height: 0 },
    bonePreviewCtx: {
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData() {
        imageDataUploads += 1;
      }
    },
    shouldShowBonePreview() {
      return false;
    },
    shouldCacheStaticCanvasRaster: PixelStudio.prototype.shouldCacheStaticCanvasRaster,
    invalidateBoneDerivedCaches: PixelStudio.prototype.invalidateBoneDerivedCaches
  };

  const first = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);
  PixelStudio.prototype.invalidateBoneDerivedCaches.call(fakeEditor, { layers: false, bones: true });
  const second = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);

  assert.equal(second, first);
  assert.equal(imageDataUploads, 1);
});

test('bone preview composite cache reuses pan zoom draws and invalidates on revision', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const layer = createLayer(8, 4, 'Preview Cache');
  layer.pixels[1 * 8 + 2] = 0xff0000ff;
  const mask = new Uint8Array(8 * 4);
  mask[1 * 8 + 2] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, 8, 4);
  let poseReads = 0;
  const fakeEditor = {
    animation: { currentFrameIndex: 0 },
    canvasState: { width: 8, height: 4, layers: [layer] },
    boneRig: rig,
    boneDerivedCache: { revision: 1, overlay: null, preview: null },
    shouldShowBonePreview() {
      return true;
    },
    getCurrentBonePreviewPose() {
      poseReads += 1;
      return { bones: { root: { angle: 0.2, dx: 0, dy: 0, scale: 1 } } };
    },
    getBonePoseCacheSignature: PixelStudio.prototype.getBonePoseCacheSignature,
    getLayerPixelRefs: PixelStudio.prototype.getLayerPixelRefs,
    layerPixelRefsMatch: PixelStudio.prototype.layerPixelRefsMatch
  };

  const first = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 8, 4);
  const second = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 8, 4);
  fakeEditor.boneDerivedCache.revision += 1;
  const third = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 8, 4);

  assert.equal(second, first);
  assert.notEqual(third, first);
  assert.equal(third.length, 32);
  assert.equal(poseReads, 2);
});

test('pose rest preview uses static layer composite without building skinned preview', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const layer = createLayer(8, 4, 'Rest Pose');
  layer.pixels[1 * 8 + 2] = 0xff0000ff;
  const mask = new Uint8Array(8 * 4);
  mask[1 * 8 + 2] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, 8, 4);
  const fakeEditor = {
    animation: { currentFrameIndex: 0 },
    canvasState: { width: 8, height: 4, layers: [layer] },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0 },
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, composite: null, preview: null },
    leftPanelTab: 'bones',
    shouldShowBonePreview() {
      return true;
    },
    getCurrentBonePreviewPose() {
      return { bones: { root: { angle: 0, dx: 0, dy: 0, scale: 1 } }, nodes: {} };
    },
    isBonePoseVisuallyRest: PixelStudio.prototype.isBonePoseVisuallyRest,
    getCachedLayerComposite: PixelStudio.prototype.getCachedLayerComposite,
    getBonePoseCacheSignature: PixelStudio.prototype.getBonePoseCacheSignature,
    getLayerPixelRefs: PixelStudio.prototype.getLayerPixelRefs,
    layerPixelRefsMatch: PixelStudio.prototype.layerPixelRefsMatch
  };

  const preview = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 8, 4);

  assert.equal(preview, fakeEditor.boneDerivedCache.composite.pixels);
  assert.equal(fakeEditor.boneDerivedCache.preview, null);
  assert.equal(preview[1 * 8 + 2], 0xff0000ff);
});

test('bone editor static composite cache reuses layer composite while panning', () => {
  const layer = createLayer(4, 4, 'Static');
  layer.pixels[5] = 0xff0000ff;
  const fakeEditor = {
    animation: { currentFrameIndex: 0 },
    canvasState: { width: 4, height: 4, layers: [layer] },
    boneDerivedCache: { revision: 1, overlay: null, composite: null, preview: null },
    shouldShowBonePreview() {
      return false;
    },
    getLayerPixelRefs: PixelStudio.prototype.getLayerPixelRefs,
    layerPixelRefsMatch: PixelStudio.prototype.layerPixelRefsMatch
  };

  const first = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 4, 4);
  const second = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 4, 4);
  fakeEditor.boneDerivedCache.revision += 1;
  const third = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 4, 4);

  assert.equal(second, first);
  assert.notEqual(third, first);
  assert.equal(third.length, 16);
});

test('static composite cache observes in-place layer pixel edits', () => {
  const layer = createLayer(2, 2, 'Dirty');
  layer.pixels[0] = 0xff0000ff;
  const fakeEditor = {
    animation: { currentFrameIndex: 0 },
    canvasState: { width: 2, height: 2, layers: [layer] },
    layerContentRevision: 1,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, composite: null, preview: null },
    shouldShowBonePreview() {
      return false;
    },
    getLayerPixelRefs: PixelStudio.prototype.getLayerPixelRefs,
    layerPixelRefsMatch: PixelStudio.prototype.layerPixelRefsMatch
  };

  const first = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 2, 2);
  layer.pixels[0] = 0xffffffff;
  fakeEditor.layerContentRevision += 1;
  const second = PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 2, 2);

  assert.notEqual(second, first);
  assert.equal(second[0], 0xffffffff);
});

test('bone preview raster cache avoids repeated image data uploads while panning', () => {
  const pixels = new Uint32Array([0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffffffff]);
  let imageDataUploads = 0;
  const fakeEditor = {
    boneDerivedCache: { revision: 1, overlay: null, preview: null, raster: null, geometry: null },
    bonePreviewCanvas: { width: 0, height: 0 },
    bonePreviewCtx: {
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData() {
        imageDataUploads += 1;
      }
    },
    shouldShowBonePreview() {
      return true;
    },
    shouldCacheStaticCanvasRaster: PixelStudio.prototype.shouldCacheStaticCanvasRaster
  };

  const first = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);
  const second = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);
  fakeEditor.boneDerivedCache.revision += 1;
  const third = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);

  assert.equal(second, first);
  assert.equal(third, first);
  assert.equal(imageDataUploads, 2);
});

test('bone canvas draw uses cached raster without offscreen upload while panning', () => {
  const pixels = new Uint32Array(100 * 100);
  let previewReads = 0;
  let rasterReads = 0;
  let offscreenWrites = 0;
  let uploads = 0;
  let gridStrokes = 0;
  let imageDraws = 0;
  const offscreen = {};
  Object.defineProperty(offscreen, 'width', {
    get() { return 100; },
    set() { offscreenWrites += 1; }
  });
  Object.defineProperty(offscreen, 'height', {
    get() { return 100; },
    set() { offscreenWrites += 1; }
  });
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasState: { width: 100, height: 100 },
    view: { zoomLevels: [8], zoomIndex: 0, panX: 0, panY: 0, showGrid: true },
    toolOptions: { wrapDraw: false, brushSize: 1, symmetry: { horizontal: false, vertical: false } },
    tiledPreview: { enabled: false },
    animation: { onion: { enabled: false } },
    activeToolId: TOOL_IDS.PENCIL,
    selection: { active: false, floating: null, start: null, end: null, lassoPoints: [] },
    gamepadCursor: { active: false },
    cursor: { x: -999, y: -999 },
    offscreen,
    offscreenCtx: {
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData() {
        uploads += 1;
      }
    },
    isHueShiftNeutral() {
      return true;
    },
    getCachedBonePreviewComposite() {
      previewReads += 1;
      return pixels;
    },
    getCachedBoneCanvasRaster() {
      rasterReads += 1;
      return { cached: true };
    },
    shouldDrawCanvasGrid: PixelStudio.prototype.shouldDrawCanvasGrid,
    drawPixelBackground() {},
    drawOnionSkin() {},
    drawSelectionMarchingAnts() {},
    getGridCellFromScreen() {
      return null;
    },
    drawSelectedBoneBindingOverlay() {},
    drawBoneOverlay() {}
  };
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {
      imageDraws += 1;
    },
    strokeRect() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      gridStrokes += 1;
    }
  };

  PixelStudio.prototype.drawCanvasArea.call(fakeEditor, ctx, 0, 0, 320, 240);
  fakeEditor.view.panX = 24;
  fakeEditor.view.panY = -16;
  PixelStudio.prototype.drawCanvasArea.call(fakeEditor, ctx, 0, 0, 320, 240);

  assert.equal(previewReads, 2);
  assert.equal(rasterReads, 2);
  assert.equal(imageDraws, 2);
  assert.equal(offscreenWrites, 0);
  assert.equal(uploads, 0);
  assert.equal(gridStrokes, 0);
});

test('bone canvas grid is skipped for larger rig canvases while normal draw keeps it', () => {
  const fakeEditor = {
    leftPanelTab: 'bones',
    view: { showGrid: true },
    tiledPreview: { enabled: false }
  };

  assert.equal(PixelStudio.prototype.shouldDrawCanvasGrid.call(fakeEditor, 100, 100, 8, false), false);
  assert.equal(PixelStudio.prototype.shouldDrawCanvasGrid.call(fakeEditor, 32, 32, 8, false), true);
  assert.equal(PixelStudio.prototype.shouldDrawCanvasGrid.call(fakeEditor, 32, 32, 4, false), false);
  fakeEditor.leftPanelTab = 'draw';
  assert.equal(PixelStudio.prototype.shouldDrawCanvasGrid.call(fakeEditor, 100, 100, 4, false), true);
});

test('bone editor static raster cache avoids repeated image data uploads while panning', () => {
  const pixels = new Uint32Array([0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffffffff]);
  let imageDataUploads = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    linePreview: null,
    curvePreview: null,
    shapePreview: null,
    polygonPreview: null,
    gradientPreview: null,
    boneDerivedCache: { revision: 1, overlay: null, composite: null, preview: null, raster: null, geometry: null },
    bonePreviewCanvas: { width: 0, height: 0 },
    bonePreviewCtx: {
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData() {
        imageDataUploads += 1;
      }
    },
    shouldShowBonePreview() {
      return false;
    },
    shouldCacheStaticCanvasRaster: PixelStudio.prototype.shouldCacheStaticCanvasRaster
  };

  const first = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);
  const second = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels);
  const hueShift = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 2, pixels, { hueShift: true });

  assert.equal(second, first);
  assert.equal(hueShift, null);
  assert.equal(imageDataUploads, 1);
});

test('active strokes bypass static raster cache for live drawing', () => {
  const pixels = new Uint32Array([0xff0000ff, 0xffffffff]);
  const fakeEditor = {
    leftPanelTab: 'draw',
    strokeState: { mode: 'paint' },
    linePreview: null,
    curvePreview: null,
    shapePreview: null,
    polygonPreview: null,
    gradientPreview: null,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, raster: null },
    bonePreviewCanvas: { width: 0, height: 0 },
    bonePreviewCtx: {
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData() {}
    },
    shouldShowBonePreview() {
      return false;
    },
    shouldCacheStaticCanvasRaster: PixelStudio.prototype.shouldCacheStaticCanvasRaster
  };

  const raster = PixelStudio.prototype.getCachedBoneCanvasRaster.call(fakeEditor, 2, 1, pixels);

  assert.equal(raster, null);
});

test('active pose preview cache passes only the dragged bone ids', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 4, y: 0 }, { x: 7, y: 0 }, { id: 'leg' }).rig;
  const layer = createLayer(4, 2, 'Preview');
  layer.pixels[1] = 0xff0000ff;
  const mask = new Uint8Array(8);
  mask[1] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'arm', mask, 4, 2);
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneEditor: {
      mode: 'pose',
      drag: { type: 'pose', boneId: 'arm', rootMoveBoneIds: [] },
      timeMs: 0
    },
    animation: { currentFrameIndex: 0 },
    canvasState: { width: 4, height: 2, layers: [layer] },
    boneRig: rig,
    layerContentRevision: 1,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, overlay: null, composite: null, preview: null, mesh: new Map() },
    shouldShowBonePreview() {
      return true;
    },
    getCurrentBonePreviewPose() {
      return { bones: { arm: { angle: 0.2, dx: 0, dy: 0, scale: 1 }, leg: { angle: 0.4, dx: 0, dy: 0, scale: 1 } } };
    },
    getActivePosePreviewBoneIds: PixelStudio.prototype.getActivePosePreviewBoneIds,
    getBonePoseCacheSignature: PixelStudio.prototype.getBonePoseCacheSignature,
    getCachedBoneRigContext: PixelStudio.prototype.getCachedBoneRigContext,
    getLayerPixelRefs: PixelStudio.prototype.getLayerPixelRefs,
    layerPixelRefsMatch: PixelStudio.prototype.layerPixelRefsMatch
  };

  PixelStudio.prototype.getCachedBonePreviewComposite.call(fakeEditor, 4, 2);

  const preview = fakeEditor.boneDerivedCache.preview;
  assert.equal(preview.activeBoneSignature, 'arm');
});

test('pose drag uses transient preview pose until pointer up commits one key', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'arm' }).rig;
  const originalRig = rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneEditor: {
      mode: 'pose',
      timeMs: 120,
      drag: { type: 'pose', boneId: 'arm', handle: 'end', moved: true }
    },
    boneRig: rig,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, rigContext: null },
    setBoneChainAnchor() {},
    commitHistory() {
      this.committed = true;
      this.pendingHistory = null;
    },
    getCachedBoneRigContext: PixelStudio.prototype.getCachedBoneRigContext,
    constrainBonePoseForCurrentRig: PixelStudio.prototype.constrainBonePoseForCurrentRig,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    getCurrentBonePreviewPose: PixelStudio.prototype.getCurrentBonePreviewPose
  };

  PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime.call(fakeEditor, 'arm', {
    angle: 0.5,
    dx: 0,
    dy: 0,
    scale: 1
  });

  assert.equal(fakeEditor.boneRig, originalRig);
  assert.equal(fakeEditor.boneRig.poseTimeline.length, 0);
  assert.equal(fakeEditor.getCurrentBonePreviewPose().bones.arm.angle, 0.5);

  PixelStudio.prototype.handleBonePointerUp.call(fakeEditor);

  assert.notEqual(fakeEditor.boneRig, originalRig);
  assert.equal(fakeEditor.boneRig.poseTimeline.length, 1);
  assert.equal(fakeEditor.boneRig.poseTimeline[0].timeMs, 120);
  assert.equal(fakeEditor.boneRig.poseTimeline[0].bones.arm.angle, 0.5);
  assert.equal(fakeEditor.boneEditor.previewPose, null);
  assert.equal(fakeEditor.committed, true);
});

test('bone rig context cache reuses normalized rig and invalidates by revision', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 4, y: 0 }, { id: 'root' }).rig;
  const layer = createLayer(4, 2, 'Bound');
  layer.pixels[1] = 0xff0000ff;
  const mask = new Uint8Array(8);
  mask[1] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'root', mask, 4, 2);
  const fakeEditor = {
    boneRig: rig,
    boneDerivedCache: { revision: 1, layerRevision: 1, boneRevision: 1, rigContext: null }
  };

  const first = PixelStudio.prototype.getCachedBoneRigContext.call(fakeEditor);
  const second = PixelStudio.prototype.getCachedBoneRigContext.call(fakeEditor);
  fakeEditor.boneDerivedCache.boneRevision += 1;
  const third = PixelStudio.prototype.getCachedBoneRigContext.call(fakeEditor);

  assert.equal(second, first);
  assert.equal(second.normalizedRig, first.normalizedRig);
  assert.notEqual(third, first);
  assert.notEqual(third.normalizedRig, first.normalizedRig);
});

test('bone affected pixel counts expose unassigned bones', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'assigned' }).rig;
  rig = createBone(rig, { x: 4, y: 0 }, { x: 7, y: 0 }, { id: 'empty' }).rig;
  const mask = new Uint8Array(8);
  mask[1] = 1;
  mask[2] = 1;
  rig = addMaskToBoneBinding(rig, 0, rig.bones[0].endJointId, mask, 4, 2);

  const counts = getBoneAffectedPixelCounts(rig, 0);

  assert.equal(counts.assigned, 2);
  assert.equal(counts.empty, 0);
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
      { id: 'new-fixed', start: { x: 1, y: 3 }, end: { x: 5, y: 3 }, jointMode: 'fixed', jointModeVersion: 2 },
      { id: 'free', start: { x: 1, y: 4 }, end: { x: 5, y: 4 }, jointMode: 'free', jointModeVersion: 2 }
    ]
  });

  assert.equal(rig.bones[0].jointMode, 'rotate');
  assert.equal(rig.bones[1].jointMode, 'slide');
  assert.equal(rig.bones[2].jointMode, 'fixed');
  assert.equal(rig.bones[3].jointMode, 'free');
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

test('bone mesh spans favor lower ordered bone instead of dithering colors', () => {
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
  assert.equal(deformed.pixels[2 * 10 + 4], 0xffffffff);
  assert.equal(deformed.pixels[2 * 10 + 6], 0xffffffff);
});

test('automatic overlapping bone weights favor the lower ordered bone', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 2 }, { x: 5, y: 2 }, { id: 'top' }).rig;
  rig = createBone(rig, { x: 1, y: 2 }, { x: 5, y: 2 }, { id: 'bottom' }).rig;
  const layer = createLayer(8, 5, 'Overlap Order');
  const assignedTop = 2 * 8 + 1;
  const assignedBottom = 2 * 8 + 5;
  const automatic = 2 * 8 + 3;
  layer.pixels[assignedTop] = 0xff0000ff;
  layer.pixels[assignedBottom] = 0x00ff00ff;
  layer.pixels[automatic] = 0x3366ffff;
  const topMask = new Uint8Array(8 * 5);
  const bottomMask = new Uint8Array(8 * 5);
  topMask[assignedTop] = 1;
  bottomMask[assignedBottom] = 1;
  rig = createSelectionBinding(rig, 0, ['top'], topMask, 8, 5);
  rig = createSelectionBinding(rig, 0, ['bottom'], bottomMask, 8, 5);

  const [deformed] = deformLayersWithBonePose([layer], 8, 5, rig, {
    bones: { bottom: { angle: 0, dx: 1, dy: 0, scale: 1 } }
  });

  assert.equal(deformed.pixels[automatic], 0);
  assert.equal(deformed.pixels[2 * 8 + 4], 0x3366ffff);
});

test('normal mesh rotation rasterizes continuous pixel coverage', () => {
  const width = 20;
  const height = 20;
  const color = 0xff8844ff;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 6, y: 6 }, { x: 14, y: 6 }, { id: 'arm' }).rig;
  const layer = createLayer(width, height, 'Mesh Block');
  let sourcePixels = 0;
  for (let y = 4; y < 10; y += 1) {
    for (let x = 8; x < 14; x += 1) {
      layer.pixels[y * width + x] = color;
      sourcePixels += 1;
    }
  }
  rig = createLayerBinding(rig, 0, ['arm'], width, height, layer.pixels);

  const [deformed] = deformLayersWithBonePose([layer], width, height, rig, {
    bones: { arm: { angle: Math.PI / 4, dx: 0, dy: 0, scale: 1 } }
  });
  const movedPixels = Array.from(deformed.pixels).filter(Boolean);

  assert.ok(movedPixels.length > sourcePixels, `expected filled rotated coverage, got ${movedPixels.length}`);
  assert.ok(movedPixels.every((pixel) => pixel === color));
  assert.equal(deformed.pixels[10 * width + 8], color);
  assert.equal(deformed.pixels[10 * width + 9], color);
  assert.equal(deformed.pixels[10 * width + 10], color);
});

test('interpolated bone mesh pixels do not overwrite real transformed pixels', () => {
  const width = 8;
  const height = 4;
  const black = 0x000000ff;
  const white = 0xffffffff;
  const red = 0xff0000ff;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 0, y: 0 }, { x: 1, y: 0 }, { id: 'mover' }).rig;
  rig = createBone(rig, { x: 0, y: 2 }, { x: 1, y: 2 }, { id: 'anchor' }).rig;
  rig = createBone(rig, { x: 6, y: 3 }, { x: 7, y: 3 }, { id: 'real' }).rig;
  const layer = createLayer(width, height, 'Priority');
  layer.pixels[1 * width + 1] = black;
  layer.pixels[1 * width + 2] = white;
  layer.pixels[1 * width + 3] = red;
  [
    ['mover', 1],
    ['anchor', 2],
    ['real', 3]
  ].forEach(([boneId, x]) => {
    const mask = new Uint8Array(width * height);
    mask[1 * width + x] = 1;
    rig = addMaskToBoneBinding(rig, 0, boneId, mask, width, height);
  });

  const [deformed] = deformLayersWithBonePose([layer], width, height, rig, {
    bones: { mover: { angle: 0, dx: 2, dy: 0, scale: 1 } }
  });

  assert.equal(deformed.pixels[1 * width + 3], red);
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

test('pose node drag stores an incoming edge smart target at shared joints', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 12 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null, drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    startHistory() {
      this.historyCount = (this.historyCount || 0) + 1;
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 5, y: 2, col: 5, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'lhand');
  assert.equal(fakeEditor.boneEditor.selectedJointId, hand.bone.endJointId);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'lhand');
  assert.equal(fakeEditor.historyCount, undefined);

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 5, y: 2, col: 5, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'lhand');
  assert.equal(fakeEditor.boneEditor.drag.handle, 'end');
  assert.equal(fakeEditor.boneEditor.drag.poseTarget.action, 'edge');
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'lhand');
  assert.equal(fakeEditor.historyCount, 1);
});

test('selected edge overrides smart pose node target at shared joints', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 12 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: 'chainsaw', drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    startHistory() {},
    setBonePosePatchAtCurrentTime(boneId, patch) {
      this.patch = { boneId, patch };
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 5, y: 2, col: 5, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'chainsaw');
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 5, y: 2, col: 5, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'chainsaw');
  assert.equal(fakeEditor.boneEditor.drag.handle, 'start');
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 5, y: 4, col: 5, row: 4 }), true);

  assert.equal(fakeEditor.patch.boneId, 'chainsaw');
  assert.ok(Math.abs(fakeEditor.patch.patch.angle - Math.PI / 2) < 0.001);
});

test('pose terminal node drag solves nearest two-bone IK chain', () => {
  let rig = createDefaultBoneRig();
  const shoulder = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = shoulder.rig;
  const saw = createBone(rig, shoulder.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: shoulder.bone.endJointId
  });
  rig = saw.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 12 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null, drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointsForBoneEditor: PixelStudio.prototype.getDisplayedJointsForBoneEditor,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    isPoseIkEnabledForBone: PixelStudio.prototype.isPoseIkEnabledForBone,
    setBonePreviewPosePatchesAtCurrentTime(patches) {
      this.patches = patches;
    },
    startHistory() {}
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag.poseTarget.action, 'ik-chain');
  assert.deepEqual(fakeEditor.boneEditor.drag.ikTarget.ikBoneIds, ['lhand', 'chainsaw']);

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 6, y: 5, col: 6, row: 5 }), true);
  assert.ok(fakeEditor.patches.lhand);
  assert.ok(fakeEditor.patches.chainsaw);
  assert.ok(fakeEditor.patches.lhand.angle > 0);
  assert.equal(fakeEditor.statusMessage, 'Solving LHand + Chainsaw');
});

test('pose terminal free node resolves as direct edge instead of IK', () => {
  let rig = createDefaultBoneRig();
  const leg = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'leg', name: 'Leg' });
  rig = leg.rig;
  const foot = createBone(rig, leg.bone.end, { x: 8, y: 2 }, {
    id: 'foot',
    name: 'Foot',
    parentId: 'leg',
    startJointId: leg.bone.endJointId,
    jointMode: 'free'
  });
  rig = foot.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: { mode: 'pose', selectedEdgeBoneId: 'foot' },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    isPoseIkEnabledForBone: PixelStudio.prototype.isPoseIkEnabledForBone,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget
  };

  const target = PixelStudio.prototype.resolvePoseNodeDragTarget.call(fakeEditor, {
    bone: foot.bone,
    handle: 'end',
    jointId: foot.bone.endJointId
  });

  assert.equal(target.action, 'edge');
  assert.equal(target.bone.id, 'foot');
  assert.equal(target.handle, 'end');
});

test('pose terminal free foot node drag translates only the free bone', () => {
  let rig = createDefaultBoneRig();
  const leg = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'leg', name: 'Leg' });
  rig = leg.rig;
  const foot = createBone(rig, leg.bone.end, { x: 8, y: 2 }, {
    id: 'foot',
    name: 'Foot',
    parentId: 'leg',
    startJointId: leg.bone.endJointId,
    jointMode: 'free'
  });
  rig = foot.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 12 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null, drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointsForBoneEditor: PixelStudio.prototype.getDisplayedJointsForBoneEditor,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    isPoseIkEnabledForBone: PixelStudio.prototype.isPoseIkEnabledForBone,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig,
    startHistory() {}
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'foot');
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag.poseTarget.action, 'edge');
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'foot');
  assert.equal(fakeEditor.boneEditor.drag.handle, 'end');

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 6, y: 5, col: 6, row: 5 }), true);

  assert.equal(fakeEditor.boneEditor.previewPose.bones.leg?.angle || 0, 0);
  assert.equal(fakeEditor.boneEditor.previewPose.bones.foot.angle, 0);
  assert.equal(fakeEditor.boneEditor.previewPose.bones.foot.dx, -2);
  assert.equal(fakeEditor.boneEditor.previewPose.bones.foot.dy, 3);
  assert.equal(fakeEditor.boneEditor.previewPose.bones.foot.scale, 1);
  assert.equal(fakeEditor.statusMessage, 'Free moving Foot');
});

test('pose terminal node drag bends upstream bone to the target side', () => {
  let rig = createDefaultBoneRig();
  const shoulder = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = shoulder.rig;
  rig = createBone(rig, shoulder.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: shoulder.bone.endJointId
  }).rig;
  const makeEditor = () => ({
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 12 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null, drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointsForBoneEditor: PixelStudio.prototype.getDisplayedJointsForBoneEditor,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    isPoseIkEnabledForBone: PixelStudio.prototype.isPoseIkEnabledForBone,
    setBonePreviewPosePatchesAtCurrentTime(patches) {
      this.patches = patches;
    },
    startHistory() {}
  });
  const below = makeEditor();
  const above = makeEditor();

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(below, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(below, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(below, { x: 6, y: 5, col: 6, row: 5 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(above, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(above, { x: 8, y: 2, col: 8, row: 2 }), true);
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(above, { x: 6, y: -1, col: 6, row: -1 }), true);

  assert.ok(below.patches.lhand.angle > 0);
  assert.ok(above.patches.lhand.angle < 0);
});

test('pose target action cycles editable connected edges at selected joints', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  const saw = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  });
  rig = saw.rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      selectedBoneId: 'lhand',
      selectedJointId: hand.bone.endJointId,
      selectedEdgeBoneId: null,
      chainAnchor: { jointId: hand.bone.endJointId }
    },
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getPoseTargetForSelectedJoint: PixelStudio.prototype.getPoseTargetForSelectedJoint,
    getPoseTargetEdgeBone: PixelStudio.prototype.getPoseTargetEdgeBone,
    getPoseTargetLabel: PixelStudio.prototype.getPoseTargetLabel,
    cyclePoseTargetEdge: PixelStudio.prototype.cyclePoseTargetEdge,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge
  };

  assert.equal(PixelStudio.prototype.getPoseTargetLabel.call(fakeEditor), 'Drag node: rotates LHand');
  PixelStudio.prototype.cyclePoseTargetEdge.call(fakeEditor);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'chainsaw');
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'chainsaw');
  assert.equal(fakeEditor.statusMessage, 'Pose target: Chainsaw');
  assert.equal(PixelStudio.prototype.getPoseTargetLabel.call(fakeEditor), 'Drag node: rotates Chainsaw');
});

test('pose fan rotation patches incoming hand when downstream chainsaw is used as handle', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  const saw = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  });
  rig = saw.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'chainsaw',
        handle: 'start',
        jointId: hand.bone.endJointId,
        start: { x: 5, y: 2 },
        originalStart: { x: 5, y: 2 },
        originalEnd: { x: 8, y: 2 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        fanRotation: {
          jointId: hand.bone.endJointId,
          incoming: { id: 'lhand' },
          outgoing: { id: 'chainsaw' },
          boneIds: ['lhand', 'chainsaw']
        },
        fanPivot: { x: 2, y: 2 },
        originalFanPoseByBone: {
          lhand: { angle: 0, dx: 0, dy: 0, scale: 1 },
          chainsaw: { angle: 0, dx: 0, dy: 0, scale: 1 }
        },
        poseTarget: { action: 'edge', boneId: 'chainsaw', handle: 'start', jointId: hand.bone.endJointId },
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    buildPoseRotationPatches: PixelStudio.prototype.buildPoseRotationPatches,
    setBonePreviewPosePatchesAtCurrentTime(patches) {
      this.patches = patches;
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 5, y: 5, col: 5, row: 5 });

  assert.equal(handled, true);
  assert.ok(fakeEditor.patches.lhand);
  assert.ok(fakeEditor.patches.chainsaw);
  assert.ok(Math.abs(fakeEditor.patches.lhand.angle - Math.PI / 4) < 0.0001);
  assert.equal(fakeEditor.patches.chainsaw.angle, 0);
  assert.equal(fakeEditor.statusMessage, 'Rotating LHand + Chainsaw');
});

test('pose rotate widget patches selected node without rotating connected edges', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'chainsaw',
        handle: 'rotate-widget',
        jointId: hand.bone.endJointId,
        start: { x: 7, y: 0 },
        originalStart: { x: 5, y: 2 },
        originalEnd: { x: 8, y: 2 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        widgetRotation: {
          jointId: hand.bone.endJointId,
          boneId: 'chainsaw',
          direction: 'outgoing',
          boneIds: ['chainsaw'],
          localNode: true,
          baseAngle: 0
        },
        widgetPivot: { x: 5, y: 2 },
        widgetStartAngle: 0,
        originalNodePoseByJoint: {
          [hand.bone.endJointId]: { angle: 0 }
        },
        originalWidgetPoseByBone: {
          chainsaw: { angle: 0, dx: 0, dy: 0, scale: 1 }
        },
        fanRotation: {
          jointId: hand.bone.endJointId,
          incoming: { id: 'lhand' },
          outgoing: { id: 'chainsaw' },
          boneIds: ['lhand', 'chainsaw']
        },
        poseTarget: { action: 'edge', boneId: 'chainsaw', handle: 'rotate-widget', jointId: hand.bone.endJointId },
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    buildPoseNodeRotationPatches: PixelStudio.prototype.buildPoseNodeRotationPatches,
    buildPoseRotationPatches: PixelStudio.prototype.buildPoseRotationPatches,
    setNodePreviewPosePatchesAtCurrentTime(patches) {
      this.nodePatches = patches;
    },
    setBonePreviewPosePatchesAtCurrentTime(patches) {
      this.patches = patches;
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 5, y: 5, col: 5, row: 5 });

  assert.equal(handled, true);
  assert.equal(fakeEditor.patches, undefined);
  assert.deepEqual(Object.keys(fakeEditor.nodePatches), [hand.bone.endJointId]);
  assert.ok(Math.abs(fakeEditor.nodePatches[hand.bone.endJointId].angle - Math.PI / 2) < 0.0001);
  assert.equal(fakeEditor.statusMessage, 'Rotating Node');
});

test('pose rotate widget rotates a free foot node instead of translating it', () => {
  let rig = createDefaultBoneRig();
  const leg = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'leg', name: 'Leg' });
  rig = leg.rig;
  const foot = createBone(rig, leg.bone.end, { x: 8, y: 2 }, {
    id: 'foot',
    name: 'Foot',
    parentId: 'leg',
    startJointId: leg.bone.endJointId,
    jointMode: 'free'
  });
  rig = foot.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'foot',
        handle: 'rotate-widget',
        jointId: foot.bone.endJointId,
        start: { x: 10, y: 2 },
        originalStart: { x: 5, y: 2 },
        originalEnd: { x: 8, y: 2 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        widgetRotation: {
          jointId: foot.bone.endJointId,
          boneId: 'foot',
          direction: 'incoming',
          boneIds: ['foot'],
          localNode: true,
          baseAngle: Math.PI
        },
        widgetPivot: { x: 8, y: 2 },
        widgetStartAngle: 0,
        originalNodePoseByJoint: {
          [foot.bone.endJointId]: { angle: 0 }
        },
        originalWidgetPoseByBone: {
          foot: { angle: 0, dx: 0, dy: 0, scale: 1 }
        },
        poseTarget: { action: 'edge', boneId: 'foot', handle: 'rotate-widget', jointId: foot.bone.endJointId },
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    buildPoseNodeRotationPatches: PixelStudio.prototype.buildPoseNodeRotationPatches,
    buildPoseRotationPatches: PixelStudio.prototype.buildPoseRotationPatches,
    setNodePreviewPosePatchesAtCurrentTime(patches) {
      this.nodePatches = patches;
    },
    setBonePreviewPosePatchAtCurrentTime() {
      throw new Error('free rotate widget should not translate the bone');
    },
    setBonePreviewPosePatchesAtCurrentTime() {
      throw new Error('free rotate widget should not write bone patches');
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 8, y: 5, col: 8, row: 5 });

  assert.equal(handled, true);
  assert.deepEqual(Object.keys(fakeEditor.nodePatches), [foot.bone.endJointId]);
  assert.ok(Math.abs(fakeEditor.nodePatches[foot.bone.endJointId].angle - Math.PI / 2) < 0.0001);
  assert.equal(fakeEditor.statusMessage, 'Rotating Node');
});

test('pose selected node exposes a circular rotate widget hit target', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 20 },
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      selectedJointId: hand.bone.endJointId,
      selectedBoneId: 'chainsaw',
      selectedEdgeBoneId: 'chainsaw',
      chainAnchor: { jointId: hand.bone.endJointId }
    },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointPoint: PixelStudio.prototype.getDisplayedJointPoint,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getPoseTargetForSelectedJoint: PixelStudio.prototype.getPoseTargetForSelectedJoint,
    getCurrentBonePreviewPose() {
      return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
    },
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getDisplayedPoseWidgetRotationTarget: PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget,
    getPoseRotateWidgetGeometry: PixelStudio.prototype.getPoseRotateWidgetGeometry,
    getPoseRotateWidgetHit: PixelStudio.prototype.getPoseRotateWidgetHit,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge
  };

  const target = PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(fakeEditor, hand.bone.endJointId, rig.bones);
  const geometry = PixelStudio.prototype.getPoseRotateWidgetGeometry.call(fakeEditor, { x: 5, y: 2 }, 20, target);
  const hit = PixelStudio.prototype.getPoseRotateWidgetHit.call(fakeEditor, {
    x: geometry.knob.x,
    y: geometry.knob.y,
    col: Math.floor(geometry.knob.x),
    row: Math.floor(geometry.knob.y)
  });

  assert.ok(hit);
  assert.equal(hit.handle, 'rotate-widget');
  assert.equal(hit.jointId, hand.bone.endJointId);
  assert.equal(hit.bone.id, 'chainsaw');
  assert.ok(Math.hypot(geometry.knob.x - 5, geometry.knob.y - 2) > PixelStudio.prototype.getBoneHitRadius.call(fakeEditor));
});

test('pose rotate widget faces incoming edge away from the selected node', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 20 },
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      selectedJointId: hand.bone.endJointId,
      selectedBoneId: 'lhand',
      selectedEdgeBoneId: 'lhand',
      chainAnchor: { jointId: hand.bone.endJointId }
    },
    getCachedBoneRigContext: PixelStudio.prototype.getCachedBoneRigContext,
    getCurrentBonePreviewPose() {
      return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
    },
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getDisplayedPoseWidgetRotationTarget: PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget,
    getPoseRotateWidgetGeometry: PixelStudio.prototype.getPoseRotateWidgetGeometry,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge
  };

  const target = PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(fakeEditor, hand.bone.endJointId, rig.bones);
  const geometry = PixelStudio.prototype.getPoseRotateWidgetGeometry.call(fakeEditor, { x: 5, y: 2 }, 20, target);

  assert.equal(target.direction, 'incoming');
  assert.ok(Math.abs(target.baseAngle - Math.PI) < 0.0001);
  assert.ok(geometry.knob.x < 5);
  assert.ok(Math.abs(geometry.knob.y - 2) < 0.0001);
});

test('pose rotate widget pointer down starts rotation before normal node movement', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 20 },
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      selectedJointId: hand.bone.endJointId,
      selectedBoneId: 'chainsaw',
      selectedEdgeBoneId: 'chainsaw',
      chainAnchor: { jointId: hand.bone.endJointId },
      drag: null
    },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointPoint: PixelStudio.prototype.getDisplayedJointPoint,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getCurrentBonePreviewPose() {
      return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
    },
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getDisplayedPoseWidgetRotationTarget: PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget,
    getPoseRotateWidgetGeometry: PixelStudio.prototype.getPoseRotateWidgetGeometry,
    getPoseRotateWidgetHit: PixelStudio.prototype.getPoseRotateWidgetHit,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getPoseTargetForSelectedJoint: PixelStudio.prototype.getPoseTargetForSelectedJoint,
    getPoseFanRotationTarget: PixelStudio.prototype.getPoseFanRotationTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    getSelectedBoneAffectedPixelCount() {
      return 1;
    },
    hitTestBone() {
      throw new Error('rotate widget should win before normal bone hits');
    },
    startHistory(label, options) {
      this.history = { label, options };
    }
  };
  const target = PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(fakeEditor, hand.bone.endJointId, rig.bones);
  const geometry = PixelStudio.prototype.getPoseRotateWidgetGeometry.call(fakeEditor, { x: 5, y: 2 }, 20, target);

  const handled = PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: geometry.knob.x,
    y: geometry.knob.y,
    col: Math.floor(geometry.knob.x),
    row: Math.floor(geometry.knob.y)
  });

  assert.equal(handled, true);
  assert.equal(fakeEditor.boneEditor.drag.handle, 'rotate-widget');
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'chainsaw');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.boneId, 'chainsaw');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.direction, 'outgoing');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.localNode, true);
  assert.equal(fakeEditor.history.label, 'pose bone');
});

test('pose rotate widget pointer down starts rotation for selected free foot node', () => {
  let rig = createDefaultBoneRig();
  const leg = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'leg', name: 'Leg' });
  rig = leg.rig;
  const foot = createBone(rig, leg.bone.end, { x: 8, y: 2 }, {
    id: 'foot',
    name: 'Foot',
    parentId: 'leg',
    startJointId: leg.bone.endJointId,
    jointMode: 'free'
  });
  rig = foot.rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 20 },
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      selectedJointId: foot.bone.endJointId,
      selectedBoneId: 'foot',
      selectedEdgeBoneId: 'foot',
      chainAnchor: { jointId: foot.bone.endJointId },
      drag: null
    },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointPoint: PixelStudio.prototype.getDisplayedJointPoint,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getCurrentBonePreviewPose() {
      return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
    },
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getDisplayedPoseWidgetRotationTarget: PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget,
    getPoseRotateWidgetGeometry: PixelStudio.prototype.getPoseRotateWidgetGeometry,
    getPoseRotateWidgetHit: PixelStudio.prototype.getPoseRotateWidgetHit,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getPoseTargetForSelectedJoint: PixelStudio.prototype.getPoseTargetForSelectedJoint,
    getPoseFanRotationTarget: PixelStudio.prototype.getPoseFanRotationTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    getSelectedBoneAffectedPixelCount() {
      return 1;
    },
    hitTestBone() {
      throw new Error('free foot rotate widget should win before normal bone hits');
    },
    startHistory(label, options) {
      this.history = { label, options };
    }
  };
  const target = PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(fakeEditor, foot.bone.endJointId, rig.bones);
  const geometry = PixelStudio.prototype.getPoseRotateWidgetGeometry.call(fakeEditor, { x: 8, y: 2 }, 20, target);

  const handled = PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: geometry.knob.x,
    y: geometry.knob.y,
    col: Math.floor(geometry.knob.x),
    row: Math.floor(geometry.knob.y)
  });

  assert.equal(handled, true);
  assert.equal(fakeEditor.boneEditor.drag.handle, 'rotate-widget');
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'foot');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.boneId, 'foot');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.direction, 'incoming');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.localNode, true);
  assert.equal(fakeEditor.history.label, 'pose bone');
});

test('pose rotate widget overlay bounds include external knob and halo', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 1, y: 2 }, { x: 3.8, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 6, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      selectedJointId: hand.bone.endJointId,
      selectedBoneId: 'chainsaw',
      selectedEdgeBoneId: 'chainsaw',
      chainAnchor: { jointId: hand.bone.endJointId }
    },
    getDisplayedJointPoint: PixelStudio.prototype.getDisplayedJointPoint,
    getCurrentBonePreviewPose() {
      return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
    },
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getDisplayedPoseWidgetRotationTarget: PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget,
    getPoseRotateWidgetGeometry: PixelStudio.prototype.getPoseRotateWidgetGeometry,
    getBoneGraphOverlayBounds: PixelStudio.prototype.getBoneGraphOverlayBounds
  };
  const displayedBones = rig.bones;
  const selectedPoint = PixelStudio.prototype.getDisplayedJointPoint.call(fakeEditor, hand.bone.endJointId, displayedBones);
  const target = PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(fakeEditor, hand.bone.endJointId, displayedBones);
  const geometry = PixelStudio.prototype.getPoseRotateWidgetGeometry.call(fakeEditor, selectedPoint, 20, target);

  const bounds = PixelStudio.prototype.getBoneGraphOverlayBounds.call(fakeEditor, displayedBones, 20);

  assert.ok(bounds.x <= geometry.knob.x - geometry.knobRadius);
  assert.ok(bounds.y <= geometry.knob.y - geometry.knobRadius);
  assert.ok(bounds.x + bounds.w >= geometry.knob.x + geometry.knobRadius);
  assert.ok(bounds.y + bounds.h >= geometry.knob.y + geometry.knobRadius);
  assert.ok(bounds.x + bounds.w > 6);
});

test('node-local pose rotates terminal node pixels without disconnecting its vector', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  const saw = createBone(rig, hand.bone.end, { x: 8, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  });
  rig = saw.rig;
  const width = 12;
  const height = 6;
  const layer = createLayer(width, height, 'Layer');
  layer.pixels[1 * width + 8] = 0xff00ffff;
  const mask = new Uint8Array(width * height);
  mask[1 * width + 8] = 1;
  rig = createSelectionBinding(rig, 0, [saw.bone.endJointId], mask, width, height);
  const pose = {
    timeMs: 0,
    bones: {},
    nodes: {
      [saw.bone.endJointId]: { angle: Math.PI / 2 }
    }
  };

  const posedBones = getPosedBoneGeometry(rig, pose);
  const posedSaw = posedBones.find((bone) => bone.id === 'chainsaw');
  const output = deformLayersWithBonePose([layer], width, height, rig, pose);

  assert.deepEqual(posedSaw.start, { x: 5, y: 2 });
  assert.deepEqual(posedSaw.end, { x: 8, y: 2 });
  assert.equal(output[0].pixels[1 * width + 8], 0);
  assert.equal(output[0].pixels[2 * width + 8], 0xff00ffff);
});

test('pose rotate widget can start dragging outside canvas bounds in portrait', () => {
  let rig = createDefaultBoneRig();
  const hand = createBone(rig, { x: 1, y: 2 }, { x: 3.8, y: 2 }, { id: 'lhand', name: 'LHand' });
  rig = hand.rig;
  rig = createBone(rig, hand.bone.end, { x: 6, y: 2 }, {
    id: 'chainsaw',
    name: 'Chainsaw',
    parentId: 'lhand',
    startJointId: hand.bone.endJointId
  }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 80, h: 80, cellSize: 20, mainX: 0, mainY: 0 },
    canvasState: { width: 4, height: 4 },
    cursor: {},
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      selectedJointId: hand.bone.endJointId,
      selectedBoneId: 'chainsaw',
      selectedEdgeBoneId: 'chainsaw',
      chainAnchor: { jointId: hand.bone.endJointId },
      drag: null
    },
    transportPopover: null,
    uiSliderDrag: null,
    mobileDrawerBounds: null,
    boneUiRegions: [],
    uiButtons: [],
    menuOpen: false,
    controlsOverlayOpen: false,
    paletteGridOpen: false,
    selectionContextMenu: null,
    brushPickerOpen: false,
    transformModal: null,
    pasteImportModal: null,
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    activeToolId: TOOL_IDS.PENCIL,
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointPoint: PixelStudio.prototype.getDisplayedJointPoint,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getCurrentBonePreviewPose() {
      return samplePoseTimeline(this.boneRig, this.boneEditor.timeMs || 0);
    },
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getDisplayedPoseWidgetRotationTarget: PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget,
    getPoseRotateWidgetGeometry: PixelStudio.prototype.getPoseRotateWidgetGeometry,
    getPoseRotateWidgetHit: PixelStudio.prototype.getPoseRotateWidgetHit,
    getPoseRotateWidgetScreenHit: PixelStudio.prototype.getPoseRotateWidgetScreenHit,
    getPoseTargetForSelectedJoint: PixelStudio.prototype.getPoseTargetForSelectedJoint,
    getPoseFanRotationTarget: PixelStudio.prototype.getPoseFanRotationTarget,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    handleBonePointerDown: PixelStudio.prototype.handleBonePointerDown,
    setInputMode(mode) {
      this.inputMode = mode;
    },
    enforceBoneEditorToolMode() {},
    getSelectedBoneAffectedPixelCount() {
      return 1;
    },
    startHistory(label) {
      this.historyLabel = label;
    },
    startMenuScrollDrag() {
      throw new Error('outside-canvas widget should not start menu scrolling');
    },
    handleButtonClick() {
      throw new Error('outside-canvas widget should not route to buttons');
    },
    hitTestBone() {
      throw new Error('outside-canvas widget should not fall through to normal bone hits');
    },
    cancelLongPress() {
      this.cancelledLongPress = true;
    },
    isMobileLayout() {
      return true;
    },
    isPointInCircle() {
      return false;
    },
    shouldUseUnboundedWrapPointer() {
      return false;
    },
    clearSelection() {
      throw new Error('outside-canvas widget should not clear selection');
    }
  };
  const selectedPoint = PixelStudio.prototype.getDisplayedJointPoint.call(fakeEditor, hand.bone.endJointId, rig.bones);
  const target = PixelStudio.prototype.getDisplayedPoseWidgetRotationTarget.call(fakeEditor, hand.bone.endJointId, rig.bones);
  const geometry = PixelStudio.prototype.getPoseRotateWidgetGeometry.call(fakeEditor, selectedPoint, fakeEditor.canvasBounds.cellSize, target);
  const payload = {
    x: geometry.knob.x * fakeEditor.canvasBounds.cellSize,
    y: geometry.knob.y * fakeEditor.canvasBounds.cellSize,
    button: 0,
    touchCount: 1
  };
  assert.equal(PixelStudio.prototype.isPointInBounds.call(fakeEditor, payload, fakeEditor.canvasBounds), false);

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, payload);

  assert.equal(fakeEditor.inputMode, 'canvas');
  assert.equal(fakeEditor.boneEditor.drag.handle, 'rotate-widget');
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'chainsaw');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.boneId, 'chainsaw');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.direction, 'outgoing');
  assert.equal(fakeEditor.boneEditor.drag.widgetRotation.localNode, true);
  assert.equal(fakeEditor.historyLabel, 'pose bone');
  assert.equal(fakeEditor.cancelledLongPress, true);
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

test('pose list-selected bone drag translates only that bone', () => {
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
    canvasBounds: { cellSize: 10 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedJointId: null, selectedBoneId: 'lower', selectedEdgeBoneId: 'lower', selectionSource: 'list', chainAnchor: null, drag: null },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig,
    startHistory(label) {
      this.historyLabel = label;
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { x: 10, y: 2, col: 10, row: 2 }), true);
  assert.equal(fakeEditor.boneEditor.drag.poseTarget.action, 'bone-move');
  assert.equal(fakeEditor.historyLabel, 'pose bone');
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 12, y: 3, col: 12, row: 3 }), true);

  assert.deepEqual(fakeEditor.boneEditor.previewPose.bones.lower, { angle: 0, dx: 2, dy: 1, scale: 1 });
  assert.equal(fakeEditor.boneEditor.previewPose.bones.upper, undefined);
  assert.equal(fakeEditor.statusMessage, 'Moving Bone 2');
});

test('pose list-selected bone drag between keyframes preserves sampled base pose', () => {
  let rig = createDefaultBoneRig();
  const upper = createBone(rig, { x: 2, y: 2 }, { x: 6, y: 2 }, { id: 'upper' });
  rig = upper.rig;
  rig = createBone(rig, upper.bone.end, { x: 10, y: 2 }, {
    id: 'lower',
    parentId: 'upper',
    startJointId: upper.bone.endJointId
  }).rig;
  rig = setBonePoseAtTime(rig, 0, 'upper', { angle: 0, dx: 0, dy: 0, scale: 1 });
  rig = setBonePoseAtTime(rig, 1000, 'upper', { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 });
  const displayed = getPosedBoneGeometry(rig, samplePoseTimeline(rig, 500));
  const lower = displayed.find((bone) => bone.id === 'lower');
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 10 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 500, selectedJointId: null, selectedBoneId: 'lower', selectedEdgeBoneId: 'lower', selectionSource: 'list', chainAnchor: null, drag: null },
    getDisplayedBonesForBoneEditor() {
      return displayed;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig,
    startHistory() {}
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: lower.end.x,
    y: lower.end.y,
    col: Math.floor(lower.end.x),
    row: Math.floor(lower.end.y)
  }), true);
  assert.equal(fakeEditor.boneEditor.drag.poseTarget.action, 'bone-move');
  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, {
    x: lower.end.x + 1,
    y: lower.end.y + 2,
    col: Math.floor(lower.end.x + 1),
    row: Math.floor(lower.end.y + 2)
  }), true);

  assert.ok(Math.abs(fakeEditor.boneEditor.previewPose.bones.upper.angle - Math.PI / 4) < 0.0001);
  assert.deepEqual(fakeEditor.boneEditor.previewPose.bones.lower, { angle: 0, dx: 1, dy: 2, scale: 1 });
});

test('pose terminal endpoint drag rotates selected child without moving sibling bones', () => {
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
      throw new Error('terminal endpoint drag should not use IK patches');
    },
    setBonePosePatchAtCurrentTime(boneId, patch) {
      this.patch = { boneId, patch };
    }
  };

  const handled = PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 3, row: 3 });

  assert.equal(handled, true);
  assert.equal(fakeEditor.patch.boneId, 'lower-a');
  assert.ok(Math.abs(fakeEditor.patch.patch.angle - Math.atan2(3.5, -0.5)) < 0.0001);
  assert.equal(fakeEditor.patch.patch.dx, 0);
  assert.equal(fakeEditor.patch.patch.dy, 0);
});

test('pose terminal endpoint drag uses direct rotation regardless of saved IK setting', () => {
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
  assert.equal(enabledEditor.patches, undefined);
  assert.equal(enabledEditor.patch.boneId, 'lower');
  assert.ok(Math.abs(enabledEditor.patch.patch.angle - Math.atan2(4.5, 0.5)) < 0.0001);

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

test('bone only modes clear pixel selections while rig mode preserves assignable selections', () => {
  const fakeEditor = {
    boneEditor: { mode: 'bind', drag: { type: 'pose' }, pendingBindNodeTap: {}, linkMode: true, chainAnchor: {} },
    selection: {
      active: true,
      mask: new Uint8Array([1]),
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      mode: 'rect',
      baseMask: new Uint8Array([1]),
      start: { col: 0, row: 0 },
      end: { col: 0, row: 0 },
      lassoPoints: [{ col: 0, row: 0 }],
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
  fakeEditor.selection.mode = 'rect';
  fakeEditor.selection.baseMask = new Uint8Array([1]);
  fakeEditor.selection.start = { col: 0, row: 0 };
  fakeEditor.selection.end = { col: 0, row: 0 };
  fakeEditor.selection.lassoPoints = [{ col: 0, row: 0 }];
  fakeEditor.selection.floating = new Uint32Array([1]);
  fakeEditor.selection.floatingMode = 'paste';
  fakeEditor.selection.floatingBounds = { x: 0, y: 0, w: 1, h: 1 };
  fakeEditor.selection.offset = { x: 2, y: 3 };
  fakeEditor.ensureBindSelectionTool = () => {};
  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');

  assert.equal(fakeEditor.selection.active, true);
  assert.ok(fakeEditor.selection.mask);
  assert.deepEqual(fakeEditor.selection.bounds, { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(fakeEditor.selection.mode, null);
  assert.equal(fakeEditor.selection.baseMask, null);
  assert.equal(fakeEditor.selection.start, null);
  assert.equal(fakeEditor.selection.end, null);
  assert.deepEqual(fakeEditor.selection.lassoPoints, []);
  assert.equal(fakeEditor.selection.floating, null);
  assert.equal(fakeEditor.selection.floatingMode, null);
  assert.equal(fakeEditor.selection.floatingBounds, null);
  assert.deepEqual(fakeEditor.selection.offset, { x: 0, y: 0 });
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
    gamepadCursor: { active: false },
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

test('selected edge property cycles rotate locked free stretch spring slide and hinge', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: rig.bones[0].startJointId,
      selectedBoneId: 'arm',
      selectedEdgeBoneId: null
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
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
  assert.equal(fakeEditor.boneRig.bones[0].jointMode, 'free');
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

test('selected edge reverse applies only to the clicked edge', () => {
  let rig = createDefaultBoneRig();
  const left = createBone(rig, { x: 2, y: 2 }, { x: 2, y: 5 }, { id: 'left' });
  rig = left.rig;
  rig = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, {
    id: 'right',
    startJointId: left.bone.startJointId
  }).rig;
  const rightBefore = rig.bones.find((bone) => bone.id === 'right');
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: 'right',
      chainAnchor: null
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.reverseSelectedBoneDirection.call(fakeEditor);

  const leftAfter = fakeEditor.boneRig.bones.find((bone) => bone.id === 'left');
  const rightAfter = fakeEditor.boneRig.bones.find((bone) => bone.id === 'right');
  assert.equal(leftAfter.startJointId, left.bone.startJointId);
  assert.equal(leftAfter.endJointId, left.bone.endJointId);
  assert.equal(rightAfter.startJointId, rightBefore.endJointId);
  assert.equal(rightAfter.endJointId, rightBefore.startJointId);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'right');
});

test('selected edge delete removes only the edge and preserves endpoint nodes', () => {
  let rig = createDefaultBoneRig();
  const left = createBone(rig, { x: 2, y: 2 }, { x: 2, y: 5 }, { id: 'left' });
  rig = left.rig;
  const right = createBone(rig, { x: 2, y: 2 }, { x: 5, y: 2 }, {
    id: 'right',
    startJointId: left.bone.startJointId
  });
  rig = right.rig;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  rig = createSelectionBinding(rig, 0, ['right'], mask, 4, 4);
  rig = createSelectionBinding(rig, 0, [left.bone.startJointId], mask, 4, 4);
  rig = setPoseKeyAtTime(rig, 0, { left: { angle: 0.2 }, right: { angle: 0.5 } });
  const preservedJointIds = new Set([right.bone.startJointId, right.bone.endJointId]);
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: 'right',
      chainAnchor: null
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getSelectedBoneOwnerId: PixelStudio.prototype.getSelectedBoneOwnerId,
    getBoneChainAnchorFromSelection() {
      return null;
    },
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.deleteSelectedBone.call(fakeEditor);

  assert.equal(fakeEditor.boneRig.bones.some((bone) => bone.id === 'right'), false);
  assert.equal(fakeEditor.boneRig.bones.some((bone) => bone.id === 'left'), true);
  preservedJointIds.forEach((jointId) => {
    assert.equal(fakeEditor.boneRig.joints.some((joint) => joint.id === jointId), true);
  });
  assert.equal(fakeEditor.boneRig.bindings.some((binding) => binding.boneIds.includes('right')), false);
  assert.equal(fakeEditor.boneRig.bindings.some((binding) => binding.boneIds.includes(left.bone.startJointId)), true);
  assert.equal(fakeEditor.boneRig.poseTimeline[0].bones.right, undefined);
  assert.ok(fakeEditor.boneRig.poseTimeline[0].bones.left);
});

test('selected edge actions use edge-specific labels', () => {
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
      mode: 'bones',
      linkMode: false,
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: 'right'
    },
    selection: { active: false, mask: null },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getCurrentBoneTimelineKey() {
      return null;
    }
  };

  const actions = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'bones');

  assert.equal(actions.find((entry) => entry.id === 'bone-reverse').label, 'Reverse Edge');
  assert.equal(actions.find((entry) => entry.id === 'bone-delete').label, 'Delete Edge');
});

test('pressing bones mode again preserves selected edge', () => {
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
      mode: 'bones',
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: 'right',
      drag: { type: 'edit' },
      pendingBindNodeTap: { type: 'node-select' }
    },
    selection: { active: false, mask: null },
    clearBoneEditorBlockingSelectionState: PixelStudio.prototype.clearBoneEditorBlockingSelectionState,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    resetBoneEditorTransientState: PixelStudio.prototype.resetBoneEditorTransientState,
    setBoneEditorMode: PixelStudio.prototype.setBoneEditorMode,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    cancelLongPress() {},
    setInputMode() {}
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bones');

  assert.equal(fakeEditor.boneEditor.mode, 'bones');
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'right');
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
});

test('leaving bones mode clears selected edge', () => {
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
      mode: 'bones',
      selectedJointId: left.bone.startJointId,
      selectedBoneId: 'left',
      selectedEdgeBoneId: 'right',
      chainAnchor: null
    },
    activeToolId: TOOL_IDS.PENCIL,
    selection: { active: false, mask: null },
    clearBoneEditorBlockingSelectionState: PixelStudio.prototype.clearBoneEditorBlockingSelectionState,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    resetBoneEditorTransientState: PixelStudio.prototype.resetBoneEditorTransientState,
    setBoneEditorMode: PixelStudio.prototype.setBoneEditorMode,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getBoneChainAnchorFromSelection: PixelStudio.prototype.getBoneChainAnchorFromSelection,
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    }
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');

  assert.equal(fakeEditor.boneEditor.mode, 'bind');
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, null);
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
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

test('pose endpoint drag starts from displayed geometry without jumping toward rest pose', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  rig = setBonePoseAtTime(rig, 0, 'arm', { angle: Math.PI / 2, dx: 2, dy: 1, scale: 1 });
  const displayed = getPosedBoneGeometry(rig, samplePoseTimeline(rig, 0));
  const displayedArm = displayed.find((bone) => bone.id === 'arm');
  let capturedPatch = null;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 10 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getDisplayedBonesForBoneEditor() {
      return displayed;
    },
    hitTestBone() {
      return {
        bone: displayedArm,
        handle: 'end',
        jointId: displayedArm.endJointId,
        joint: { ...displayedArm.end }
      };
    },
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getCachedBoneSkeletonContext() {
      const normalizedRig = normalizeBoneSkeleton(this.boneRig);
      return { normalizedRig, graph: buildBoneGraph(normalizedRig) };
    },
    setBoneJointSelection(jointId, joint) {
      this.boneEditor.selectedJointId = jointId;
      this.selectedJoint = joint;
    },
    getSelectedBoneAffectedPixelCount() {
      return 1;
    },
    startHistory() {},
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime(_boneId, patch) {
      capturedPatch = patch;
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: displayedArm.end.x,
    y: displayedArm.end.y,
    col: Math.floor(displayedArm.end.x),
    row: Math.floor(displayedArm.end.y)
  }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: displayedArm.end.x,
    y: displayedArm.end.y,
    col: Math.floor(displayedArm.end.x),
    row: Math.floor(displayedArm.end.y)
  }), true);
  assert.deepEqual(fakeEditor.boneEditor.drag.originalStart, displayedArm.start);

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, {
    x: displayedArm.end.x,
    y: displayedArm.end.y + 0.1
  }), true);

  assert.ok(Math.abs(capturedPatch.angle - (Math.PI / 2)) < 0.05);
});

test('pose child endpoint drag after parent rotation uses displayed angle delta', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'root',
    startJointId: root.bone.endJointId
  }).rig;
  rig = setBonePoseAtTime(rig, 0, 'root', { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 });
  const pose = samplePoseTimeline(rig, 0);
  const displayed = getPosedBoneGeometry(rig, pose);
  const child = rig.bones.find((bone) => bone.id === 'child');
  const displayedChild = displayed.find((bone) => bone.id === 'child');
  const displayedAngle = Math.atan2(
    displayedChild.end.y - displayedChild.start.y,
    displayedChild.end.x - displayedChild.start.x
  );
  const targetAngle = displayedAngle + 0.25;
  const target = {
    x: displayedChild.start.x + Math.cos(targetAngle) * child.length,
    y: displayedChild.start.y + Math.sin(targetAngle) * child.length
  };
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'child',
        handle: 'end',
        start: { ...displayedChild.end },
        originalStart: { ...displayedChild.start },
        originalDisplayedAngle: displayedAngle,
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        basePose: pose,
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime(boneId, patch) {
      this.patch = { boneId, patch };
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, target), true);

  assert.equal(fakeEditor.patch.boneId, 'child');
  assert.ok(Math.abs(fakeEditor.patch.patch.angle - 0.25) < 0.0001);
});

test('pose endpoint drag between keyframes uses sampled displayed angle delta', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'root',
    startJointId: root.bone.endJointId
  }).rig;
  rig = setBonePoseAtTime(rig, 0, 'root', { angle: 0, dx: 0, dy: 0, scale: 1 });
  rig = setBonePoseAtTime(rig, 1000, 'root', { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 });
  const pose = samplePoseTimeline(rig, 500);
  const displayed = getPosedBoneGeometry(rig, pose);
  const child = rig.bones.find((bone) => bone.id === 'child');
  const displayedChild = displayed.find((bone) => bone.id === 'child');
  const displayedAngle = Math.atan2(
    displayedChild.end.y - displayedChild.start.y,
    displayedChild.end.x - displayedChild.start.x
  );
  const targetAngle = displayedAngle - 0.3;
  const target = {
    x: displayedChild.start.x + Math.cos(targetAngle) * child.length,
    y: displayedChild.start.y + Math.sin(targetAngle) * child.length
  };
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 500,
      drag: {
        type: 'pose',
        boneId: 'child',
        handle: 'end',
        start: { ...displayedChild.end },
        originalStart: { ...displayedChild.start },
        originalDisplayedAngle: displayedAngle,
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        basePose: pose,
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, target), true);

  assert.ok(Math.abs(fakeEditor.boneEditor.previewPose.bones.child.angle + 0.3) < 0.0001);
  assert.ok(Math.abs(fakeEditor.boneEditor.previewPose.bones.root.angle - Math.PI / 4) < 0.0001);
});

test('pose shared-joint fan drag captures displayed pivot after existing pose offsets', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.end, { x: 9, y: 1 }, {
    id: 'child',
    parentId: 'root',
    startJointId: root.bone.endJointId
  }).rig;
  rig = setBonePoseAtTime(rig, 0, 'root', { angle: Math.PI / 2, dx: 4, dy: 3, scale: 1 });
  const displayed = getPosedBoneGeometry(rig, samplePoseTimeline(rig, 0));
  const displayedRoot = displayed.find((bone) => bone.id === 'root');
  const displayedChild = displayed.find((bone) => bone.id === 'child');
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { cellSize: 10 },
    boneRig: rig,
    boneEditor: { mode: 'pose', timeMs: 0, selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getDisplayedBonesForBoneEditor() {
      return displayed;
    },
    hitTestBone() {
      return {
        bone: displayedChild,
        handle: 'start',
        jointId: displayedChild.startJointId,
        joint: { ...displayedChild.start }
      };
    },
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getPoseFanRotationTarget: PixelStudio.prototype.getPoseFanRotationTarget,
    getCachedBoneSkeletonContext() {
      const normalizedRig = normalizeBoneSkeleton(this.boneRig);
      return { normalizedRig, graph: buildBoneGraph(normalizedRig) };
    },
    setBoneJointSelection(jointId, joint) {
      this.boneEditor.selectedJointId = jointId;
      this.selectedJoint = joint;
    },
    getSelectedBoneAffectedPixelCount() {
      return 1;
    },
    startHistory() {}
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: displayedChild.start.x,
    y: displayedChild.start.y,
    col: Math.floor(displayedChild.start.x),
    row: Math.floor(displayedChild.start.y)
  }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, {
    x: displayedChild.start.x,
    y: displayedChild.start.y,
    col: Math.floor(displayedChild.start.x),
    row: Math.floor(displayedChild.start.y)
  }), true);

  assert.deepEqual(fakeEditor.boneEditor.drag.fanPivot, displayedRoot.start);
});

test('pose drag ignores invalid pointer coordinates without writing patches', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'arm',
        handle: 'end',
        start: { x: 5, y: 1 },
        originalStart: { x: 1, y: 1 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        moved: true
      }
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    setBonePreviewPosePatchAtCurrentTime() {
      throw new Error('invalid pointer coordinates should not write a pose patch');
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, {}), true);
  assert.equal(fakeEditor.boneEditor.drag.moved, false);
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
  assert.equal(fakeEditor.statusMessage, 'Locked edges only follow parent or root movement');

  const posed = getPosedBoneGeometry(rig, { bones: { root: { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 }, fixed: { angle: 1, dx: 4, dy: 4, scale: 3 } } });
  const fixedBone = posed.find((bone) => bone.id === 'fixed');
  assert.ok(Math.abs(fixedBone.start.x - 1) < 0.001);
  assert.ok(Math.abs(fixedBone.start.y - 5) < 0.001);
  assert.ok(Math.abs(fixedBone.end.x - 1) < 0.001);
  assert.ok(Math.abs(fixedBone.end.y - 9) < 0.001);
});

test('free edge endpoint drag translates without rotating or scaling', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'free', jointMode: 'free' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'free',
        handle: 'end',
        start: { x: 5, y: 1 },
        originalStart: { x: 1, y: 1 },
        originalEnd: { x: 5, y: 1 },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime(boneId, patch) {
      this.posePatch = { boneId, patch };
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 1, y: 9 }), true);
  assert.equal(fakeEditor.posePatch.boneId, 'free');
  assert.equal(fakeEditor.posePatch.patch.angle, 0);
  assert.equal(fakeEditor.posePatch.patch.scale, 1);
  assert.deepEqual({ dx: fakeEditor.posePatch.patch.dx, dy: fakeEditor.posePatch.patch.dy }, { dx: -4, dy: 8 });
  assert.equal(fakeEditor.statusMessage, 'Free moving Bone 1');

  const posed = getPosedBoneGeometry(rig, { bones: { free: fakeEditor.posePatch.patch } });
  const freeBone = posed.find((bone) => bone.id === 'free');
  assert.ok(Math.abs(freeBone.end.x - 1) < 0.001);
  assert.ok(Math.abs(freeBone.end.y - 9) < 0.001);
});

test('free edge start drag translates without rotating or scaling', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'free', jointMode: 'free' }).rig;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      timeMs: 0,
      drag: {
        type: 'pose',
        boneId: 'free',
        handle: 'start',
        start: { x: 1, y: 1 },
        originalStart: { x: 1, y: 1 },
        originalEnd: { x: 5, y: 1 },
        originalPose: { angle: 0.25, dx: 2, dy: -1, scale: 1.2 },
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime(boneId, patch) {
      this.posePatch = { boneId, patch };
    }
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 4, y: 6 }), true);
  assert.equal(fakeEditor.posePatch.boneId, 'free');
  assert.deepEqual(fakeEditor.posePatch.patch, {
    angle: 0.25,
    dx: 5,
    dy: 4,
    scale: 1.2
  });
  assert.equal(fakeEditor.statusMessage, 'Free moving Bone 1');
});

test('free edge endpoint drag at a keyframe preserves angle and writes translation only', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'free', jointMode: 'free' }).rig;
  rig = setBonePoseAtTime(rig, 250, 'free', { angle: 0.4, dx: 2, dy: 1, scale: 1 });
  const pose = samplePoseTimeline(rig, 250);
  const displayed = getPosedBoneGeometry(rig, pose);
  const displayedFree = displayed.find((bone) => bone.id === 'free');
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 250,
      drag: {
        type: 'pose',
        boneId: 'free',
        handle: 'end',
        start: { ...displayedFree.end },
        originalStart: { ...displayedFree.start },
        originalEnd: { ...displayedFree.end },
        originalPose: { angle: 0.4, dx: 2, dy: 1, scale: 1 },
        basePose: pose,
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, {
    x: displayedFree.end.x + 3,
    y: displayedFree.end.y - 2
  }), true);

  assert.deepEqual(fakeEditor.boneEditor.previewPose.bones.free, {
    angle: 0.4,
    dx: 5,
    dy: -1,
    scale: 1
  });
});

test('free edge endpoint drag between keyframes preserves sampled upstream pose', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' });
  rig = root.rig;
  rig = createBone(rig, root.bone.end, { x: 9, y: 1 }, {
    id: 'free',
    jointMode: 'free',
    parentId: 'root',
    startJointId: root.bone.endJointId
  }).rig;
  rig = setBonePoseAtTime(rig, 0, 'root', { angle: 0, dx: 0, dy: 0, scale: 1 });
  rig = setBonePoseAtTime(rig, 1000, 'root', { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 });
  const pose = samplePoseTimeline(rig, 500);
  const displayed = getPosedBoneGeometry(rig, pose);
  const displayedFree = displayed.find((bone) => bone.id === 'free');
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: {
      mode: 'pose',
      timeMs: 500,
      drag: {
        type: 'pose',
        boneId: 'free',
        handle: 'end',
        start: { ...displayedFree.end },
        originalStart: { ...displayedFree.start },
        originalEnd: { ...displayedFree.end },
        originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
        basePose: pose,
        moved: false
      }
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    setBonePreviewPosePatchAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchAtCurrentTime,
    setBonePreviewPosePatchesAtCurrentTime: PixelStudio.prototype.setBonePreviewPosePatchesAtCurrentTime,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig
  };

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, {
    x: displayedFree.end.x + 2,
    y: displayedFree.end.y + 3
  }), true);

  assert.ok(Math.abs(fakeEditor.boneEditor.previewPose.bones.root.angle - Math.PI / 4) < 0.0001);
  assert.equal(fakeEditor.boneEditor.previewPose.bones.free.angle, 0);
  assert.ok(Math.abs(fakeEditor.boneEditor.previewPose.bones.free.dx - 2) < 0.0001);
  assert.ok(Math.abs(fakeEditor.boneEditor.previewPose.bones.free.dy - 3) < 0.0001);
  assert.equal(fakeEditor.boneEditor.previewPose.bones.free.scale, 1);
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

test('pose hit testing keeps a selected fixed edge at a shared node', () => {
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
    boneEditor: { mode: 'pose', selectedEdgeBoneId: 'fixed' },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment
  };

  const hit = PixelStudio.prototype.hitTestBone.call(fakeEditor, { col: 5, row: 1 });

  assert.equal(hit.bone.id, 'fixed');
  assert.equal(hit.handle, 'end');
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
  assert.equal(fakeEditor.boneEditor.drag, null);
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

test('selected fixed shared joint translates its downstream pose branch', () => {
  let rig = createDefaultBoneRig();
  const head = createBone(rig, { x: 4, y: 1 }, { x: 4, y: 3 }, { id: 'head', jointMode: 'fixed' });
  rig = head.rig;
  const chest = createBone(rig, head.bone.end, { x: 4, y: 7 }, {
    id: 'chest',
    parentId: 'head',
    startJointId: head.bone.endJointId
  });
  rig = chest.rig;
  const leftArm = createBone(rig, head.bone.end, { x: 2, y: 5 }, {
    id: 'left-arm',
    parentId: 'head',
    startJointId: head.bone.endJointId
  });
  rig = leftArm.rig;
  rig = createBone(rig, head.bone.end, { x: 6, y: 5 }, {
    id: 'right-arm',
    parentId: 'head',
    startJointId: head.bone.endJointId
  }).rig;
  const collarJointId = head.bone.endJointId;
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: { mode: 'pose', selectedEdgeBoneId: 'head' },
    getCachedBoneSkeletonContext() {
      return { graph: buildBoneGraph(this.boneRig) };
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    getPoseBranchMoveTarget: PixelStudio.prototype.getPoseBranchMoveTarget,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget
  };

  const target = PixelStudio.prototype.resolvePoseNodeDragTarget.call(fakeEditor, {
    bone: head.bone,
    handle: 'end',
    jointId: collarJointId
  });

  assert.equal(target.action, 'branch-move');
  assert.equal(target.bone.id, 'head');
  assert.deepEqual(target.branchMovePatchBoneIds, ['head']);
  assert.deepEqual([...target.branchMoveBoneIds].sort(), ['chest', 'head', 'left-arm', 'right-arm']);

  fakeEditor.boneEditor.drag = {
    type: 'pose',
    boneId: 'head',
    handle: target.handle,
    start: { x: 4, y: 3 },
    originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
    basePose: { bones: {}, nodes: {} },
    branchMoveBoneIds: target.branchMoveBoneIds,
    branchMovePatchBoneIds: target.branchMovePatchBoneIds,
    originalBranchPoseByBone: { head: { angle: 0, dx: 0, dy: 0, scale: 1 } },
    poseTarget: {
      action: target.action,
      boneId: target.bone.id,
      handle: target.handle,
      jointId: target.jointId,
      branchMoveBoneIds: target.branchMoveBoneIds,
      branchMovePatchBoneIds: target.branchMovePatchBoneIds
    },
    moved: false
  };
  fakeEditor.setBonePreviewPosePatchesAtCurrentTime = function setBonePreviewPosePatchesAtCurrentTime(patches) {
    this.previewPatches = patches;
  };
  fakeEditor.getBonePointerCoords = PixelStudio.prototype.getBonePointerCoords;

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { x: 4, y: 5 }), true);
  assert.deepEqual(fakeEditor.previewPatches, {
    head: { angle: 0, dx: 0, dy: 2, scale: 1 }
  });

  const posed = getPosedBoneGeometry(rig, { bones: fakeEditor.previewPatches });
  const headPosed = posed.find((bone) => bone.id === 'head');
  const chestPosed = posed.find((bone) => bone.id === 'chest');
  const leftArmPosed = posed.find((bone) => bone.id === 'left-arm');
  assert.deepEqual(headPosed.start, { x: 4, y: 3 });
  assert.deepEqual(headPosed.end, { x: 4, y: 5 });
  assert.deepEqual(chestPosed.start, { x: 4, y: 5 });
  assert.deepEqual(leftArmPosed.start, { x: 4, y: 5 });
});

test('inherited fixed branch movement patches controlling parent after rotation', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'root' });
  rig = root.rig;
  const fixed = createBone(rig, root.bone.end, { x: 9, y: 1 }, {
    id: 'fixed',
    parentId: 'root',
    startJointId: root.bone.endJointId,
    jointMode: 'fixed'
  });
  rig = fixed.rig;
  rig = createBone(rig, fixed.bone.end, { x: 11, y: 1 }, {
    id: 'child',
    parentId: 'fixed',
    startJointId: fixed.bone.endJointId
  }).rig;
  rig = setBonePoseAtTime(rig, 0, 'root', { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 });
  const displayed = getPosedBoneGeometry(rig, samplePoseTimeline(rig, 0));
  const displayedFixed = displayed.find((bone) => bone.id === 'fixed');
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneRig: rig,
    boneEditor: { mode: 'pose', selectedEdgeBoneId: 'fixed', timeMs: 0 },
    getCachedBoneSkeletonContext() {
      return { graph: buildBoneGraph(this.boneRig) };
    },
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    getPoseBranchMoveTarget: PixelStudio.prototype.getPoseBranchMoveTarget,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget
  };
  const target = PixelStudio.prototype.resolvePoseNodeDragTarget.call(fakeEditor, {
    bone: fixed.bone,
    handle: 'end',
    jointId: fixed.bone.endJointId
  });

  assert.equal(target.action, 'branch-move');
  assert.deepEqual(target.branchMovePatchBoneIds, ['root']);

  fakeEditor.boneEditor.drag = {
    type: 'pose',
    boneId: 'fixed',
    handle: target.handle,
    start: { ...displayedFixed.end },
    originalPose: { angle: 0, dx: 0, dy: 0, scale: 1 },
    basePose: samplePoseTimeline(rig, 0),
    branchMoveBoneIds: target.branchMoveBoneIds,
    branchMovePatchBoneIds: target.branchMovePatchBoneIds,
    originalBranchPoseByBone: {
      root: { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 }
    },
    poseTarget: {
      action: target.action,
      boneId: target.bone.id,
      handle: target.handle,
      jointId: target.jointId,
      branchMoveBoneIds: target.branchMoveBoneIds,
      branchMovePatchBoneIds: target.branchMovePatchBoneIds
    },
    moved: false
  };
  fakeEditor.setBonePreviewPosePatchesAtCurrentTime = function setBonePreviewPosePatchesAtCurrentTime(patches) {
    this.previewPatches = patches;
  };
  fakeEditor.getBonePointerCoords = PixelStudio.prototype.getBonePointerCoords;

  assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, {
    x: displayedFixed.end.x + 2,
    y: displayedFixed.end.y
  }), true);

  assert.deepEqual(fakeEditor.previewPatches, {
    root: { angle: Math.PI / 2, dx: 2, dy: 0, scale: 1 }
  });
  const moved = getPosedBoneGeometry(rig, { bones: fakeEditor.previewPatches });
  const movedFixed = moved.find((bone) => bone.id === 'fixed');
  assert.ok(Math.abs(movedFixed.end.x - (displayedFixed.end.x + 2)) < 0.0001);
  assert.ok(Math.abs(movedFixed.end.y - displayedFixed.end.y) < 0.0001);
});

test('fixed branch pointer selection remains active after shared node taps', () => {
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
    boneEditor: { mode: 'pose', selectedEdgeBoneId: 'fixed', timeMs: 0, drag: null },
    getCachedBoneSkeletonContext() {
      return { graph: buildBoneGraph(this.boneRig) };
    },
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    getDisplayedJointsForBoneEditor() {
      return this.boneRig.joints;
    },
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    getBoneEdgeMode: PixelStudio.prototype.getBoneEdgeMode,
    isPoseEditableBoneEdge: PixelStudio.prototype.isPoseEditableBoneEdge,
    getPoseBranchMoveTarget: PixelStudio.prototype.getPoseBranchMoveTarget,
    resolvePoseIkDragTarget: PixelStudio.prototype.resolvePoseIkDragTarget,
    resolvePoseNodeDragTarget: PixelStudio.prototype.resolvePoseNodeDragTarget,
    getPoseFanRotationTarget: PixelStudio.prototype.getPoseFanRotationTarget,
    getPoseWidgetRotationTarget: PixelStudio.prototype.getPoseWidgetRotationTarget,
    getSelectedBoneAffectedPixelCount() { return 1; },
    startHistory() {},
    commitHistory() {}
  };

  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 5, row: 1 }), true);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(PixelStudio.prototype.handleBonePointerDown.call(fakeEditor, { col: 5, row: 1 }), true);
  assert.equal(fakeEditor.boneEditor.drag.poseTarget.action, 'branch-move');
  assert.equal(fakeEditor.boneEditor.drag.boneId, 'fixed');
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'fixed');

  assert.equal(PixelStudio.prototype.handleBonePointerUp.call(fakeEditor), true);
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'fixed');
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

test('hinge edge endpoint drag directly rotates the selected L shape edge', () => {
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
        throw new Error(`terminal hinge endpoint drag should not use IK patches: ${Object.keys(patches).join(',')}`);
      },
      setBonePosePatchAtCurrentTime(boneId, patch) {
        this.patch = { boneId, patch };
      }
    };
    assert.equal(PixelStudio.prototype.handleBonePointerMove.call(fakeEditor, { col: 4, row: targetY }), true);
    return fakeEditor.patch;
  };

  const downRest = solveByDrag(4, -4);
  assert.equal(downRest.boneId, 'lower');
  assert.ok(downRest.patch.angle < -2.9);

  const upRest = solveByDrag(-4, 4);
  assert.equal(upRest.boneId, 'lower');
  assert.ok(upRest.patch.angle > 3);
});

test('pose reset writes full skeleton rest pose at current time', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 1, y: 3 }, { x: 5, y: 3 }, { id: 'leg' }).rig;
  rig = setBonePoseAtTime(rig, 250, 'arm', { angle: 1, dx: 2, dy: 3, scale: 2 });
  rig = setBonePoseAtTime(rig, 250, 'leg', { angle: 0.5, dx: 1, dy: 2, scale: 1.5 });
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { timeMs: 250, previewPose: { bones: { arm: { angle: 9 } } }, previewPoseTimeMs: 250, previewPoseSignature: 'stale' },
    getSelectedBone() {
      return this.boneRig.bones[0];
    },
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.resetSelectedBonePose.call(fakeEditor);
  assert.deepEqual(samplePoseTimeline(fakeEditor.boneRig, 250).bones.arm, { angle: 0, dx: 0, dy: 0, scale: 1 });
  assert.deepEqual(samplePoseTimeline(fakeEditor.boneRig, 250).bones.leg, { angle: 0, dx: 0, dy: 0, scale: 1 });
  assert.equal(fakeEditor.boneEditor.previewPose, null);
});

test('pose copy and paste stores a full current skeleton pose', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 1 }, { x: 5, y: 1 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 1, y: 3 }, { x: 5, y: 3 }, { id: 'leg' }).rig;
  rig = setBonePoseAtTime(rig, 250, 'arm', { angle: 1, dx: 2, dy: 0, scale: 1 });
  rig = setBonePoseAtTime(rig, 250, 'leg', { angle: 0.5, dx: 0, dy: 4, scale: 1 });
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { timeMs: 250, previewPose: null },
    getSelectedBone() {
      return this.boneRig.bones[0];
    },
    getFullBoneTimelinePoseSnapshot: PixelStudio.prototype.getFullBoneTimelinePoseSnapshot,
    constrainPoseForCurrentRig: PixelStudio.prototype.constrainPoseForCurrentRig,
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.copyCurrentBonePose.call(fakeEditor);
  fakeEditor.boneEditor.timeMs = 1000;
  PixelStudio.prototype.pasteCopiedBonePose.call(fakeEditor);

  const pasted = samplePoseTimeline(fakeEditor.boneRig, 1000);
  assert.deepEqual(pasted.bones.arm, { angle: 1, dx: 2, dy: 0, scale: 1 });
  assert.deepEqual(pasted.bones.leg, { angle: 0.5, dx: 0, dy: 4, scale: 1 });
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

test('rig mode canvas drag away from nodes creates an assignable pixel selection', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'chest' }).rig;
  const selectedOwnerId = rig.bones[0].endJointId;
  const fakeEditor = {
    leftPanelTab: 'bones',
    activeToolId: TOOL_IDS.SELECT_RECT,
    tools: [
      {
        id: TOOL_IDS.SELECT_RECT,
        onPointerDown: (point) => PixelStudio.prototype.startSelection.call(fakeEditor, point, 'rect'),
        onPointerMove: (point) => PixelStudio.prototype.updateSelection.call(fakeEditor, point),
        onPointerUp: () => PixelStudio.prototype.commitSelection.call(fakeEditor)
      }
    ],
    boneRig: {
      ...rig,
      bindings: []
    },
    boneEditor: {
      mode: 'bind',
      selectedJointId: selectedOwnerId,
      selectedBoneId: 'chest',
      selectedEdgeBoneId: null,
      chainAnchor: { boneId: 'chest', jointId: selectedOwnerId, handle: 'end', x: 4, y: 1 },
      drag: null,
      pendingBindNodeTap: null,
      playing: false
    },
    canvasBounds: { x: 0, y: 0, w: 160, h: 160, cellSize: 10, mainX: 0, mainY: 0 },
    canvasState: { width: 16, height: 16, activeLayerIndex: 0 },
    tempToolOverrides: new Map(),
    cloneColorPickArmed: false,
    selection: {
      active: false,
      mask: null,
      bounds: null,
      mode: null,
      start: null,
      end: null,
      combineMode: 'replace',
      baseMask: null,
      lassoPoints: [],
      floating: null,
      floatingMode: null,
      floatingBounds: null,
      offset: { x: 0, y: 0 }
    },
    toolOptions: { wrapDraw: false },
    cursor: {},
    gamepadCursor: { active: false },
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    view: { panX: 0, panY: 0 },
    viewportController: {
      beginPan() {
        throw new Error('rig selection should not pan');
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
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    clearBoneEditorBlockingSelectionState: PixelStudio.prototype.clearBoneEditorBlockingSelectionState,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    shouldUseUnboundedWrapPointer: PixelStudio.prototype.shouldUseUnboundedWrapPointer,
    getEffectiveToolId: PixelStudio.prototype.getEffectiveToolId,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    getDisplayedBonesForBoneEditor() {
      return this.boneRig.bones;
    },
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    setInputMode(mode) {
      this.inputMode = mode;
    },
    cancelLongPress() {},
    getGridCellFromScreen(x, y) {
      return { col: Math.floor(x / 10), row: Math.floor(y / 10) };
    },
    getBoneCanvasPointFromScreen(_x, _y, point) {
      return point;
    },
    getBoundsFromPoints: PixelStudio.prototype.getBoundsFromPoints,
    getMaskBounds: PixelStudio.prototype.getMaskBounds,
    prepareSelectionCombineBase: PixelStudio.prototype.prepareSelectionCombineBase,
    applySelectionMask: PixelStudio.prototype.applySelectionMask,
    startSelection: PixelStudio.prototype.startSelection,
    updateSelection: PixelStudio.prototype.updateSelection,
    commitSelection: PixelStudio.prototype.commitSelection,
    handleToolPointerDown: PixelStudio.prototype.handleToolPointerDown,
    handleToolPointerMove: PixelStudio.prototype.handleToolPointerMove,
    handleToolPointerUp: PixelStudio.prototype.handleToolPointerUp,
    handleBonePointerDown: PixelStudio.prototype.handleBonePointerDown,
    handleBonePointerMove: PixelStudio.prototype.handleBonePointerMove,
    handleBonePointerUp: PixelStudio.prototype.handleBonePointerUp,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getBoneChainAnchorFromSelection: PixelStudio.prototype.getBoneChainAnchorFromSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    startHistory() {},
    commitHistory() {},
    finishBoneBindingAction() {},
    clearSelection: PixelStudio.prototype.clearSelection,
    getSelectedBoneOwnerId: PixelStudio.prototype.getSelectedBoneOwnerId,
    addSelectionToSelectedBone: PixelStudio.prototype.addSelectionToSelectedBone
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 80, y: 80, button: 0 });
  PixelStudio.prototype.handlePointerMove.call(fakeEditor, { x: 100, y: 100, buttons: 1 });
  PixelStudio.prototype.handlePointerUp.call(fakeEditor, { x: 100, y: 100, button: 0 });

  assert.equal(fakeEditor.inputMode, 'canvas');
  assert.equal(fakeEditor.boneEditor.selectedJointId, selectedOwnerId);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'chest');
  assert.deepEqual(fakeEditor.selection.bounds, { x: 8, y: 8, w: 3, h: 3 });
  assert.equal(fakeEditor.selection.active, true);

  PixelStudio.prototype.addSelectionToSelectedBone.call(fakeEditor);
  const binding = fakeEditor.boneRig.bindings.find((entry) => entry.boneIds.includes(selectedOwnerId));
  assert.ok(binding);
  assert.equal(binding.pixels.length, 9);
});

test('rig mode enables assign when a selected node has an active pixel selection', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'chest' }).rig;
  const selectedOwnerId = rig.bones[0].endJointId;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  const fakeEditor = {
    leftPanelTab: 'bones',
    activeToolId: TOOL_IDS.SELECT_RECT,
    boneRig: rig,
    boneEditor: {
      mode: 'bind',
      selectedJointId: selectedOwnerId,
      selectedBoneId: 'chest',
      selectedEdgeBoneId: null
    },
    selection: {
      active: true,
      mask,
      bounds: { x: 1, y: 1, w: 1, h: 1 },
      combineMode: 'replace'
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getCurrentBoneTimelineKey() {
      return null;
    },
    getBoneContextActions: PixelStudio.prototype.getBoneContextActions
  };

  const assign = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'bind', { full: true })
    .find((entry) => entry.id === 'bind-add');

  assert.ok(assign);
  assert.equal(assign.disabled, false);
});

test('pressing rig mode again preserves selection and keeps assign enabled', () => {
  const rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'chest' }).rig;
  const selectedOwnerId = rig.bones[0].endJointId;
  const mask = new Uint8Array(16);
  mask[5] = 1;
  let clearCalls = 0;
  const fakeEditor = {
    activeToolId: TOOL_IDS.PENCIL,
    boneRig: rig,
    boneEditor: {
      mode: 'bind',
      selectedJointId: selectedOwnerId,
      selectedBoneId: 'chest',
      selectedEdgeBoneId: null,
      drag: { type: 'pose' },
      pendingBindNodeTap: { type: 'node-select' },
      linkMode: true,
      chainAnchor: null,
      playing: true
    },
    selection: {
      active: true,
      mask,
      bounds: { x: 1, y: 1, w: 1, h: 1 },
      mode: 'rect',
      baseMask: new Uint8Array(16),
      start: { col: 1, row: 1 },
      end: { col: 1, row: 1 },
      lassoPoints: [{ col: 1, row: 1 }],
      combineMode: 'replace',
      floating: null,
      floatingMode: null,
      floatingBounds: null,
      offset: { x: 0, y: 0 }
    },
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    enforceBoneEditorToolMode: PixelStudio.prototype.enforceBoneEditorToolMode,
    resetBoneEditorTransientState: PixelStudio.prototype.resetBoneEditorTransientState,
    setBoneEditorMode: PixelStudio.prototype.setBoneEditorMode,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    getBoneChainAnchorFromSelection: PixelStudio.prototype.getBoneChainAnchorFromSelection,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getCurrentBoneTimelineKey() {
      return null;
    },
    getBoneContextActions: PixelStudio.prototype.getBoneContextActions,
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    },
    clearSelection() {
      clearCalls += 1;
      this.selection.active = false;
      this.selection.mask = null;
      this.selection.bounds = null;
    }
  };

  PixelStudio.prototype.setBoneEditorMode.call(fakeEditor, 'bind');

  assert.equal(clearCalls, 0);
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
  assert.equal(fakeEditor.boneEditor.drag, null);
  assert.equal(fakeEditor.boneEditor.pendingBindNodeTap, null);
  assert.equal(fakeEditor.boneEditor.playing, false);
  assert.equal(fakeEditor.selection.active, true);
  assert.equal(fakeEditor.selection.mask, mask);
  assert.deepEqual(fakeEditor.selection.bounds, { x: 1, y: 1, w: 1, h: 1 });
  assert.equal(fakeEditor.selection.mode, null);
  assert.equal(fakeEditor.selection.baseMask, null);
  assert.equal(fakeEditor.selection.start, null);
  assert.equal(fakeEditor.selection.end, null);
  assert.deepEqual(fakeEditor.selection.lassoPoints, []);

  const assign = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'bind', { full: true })
    .find((entry) => entry.id === 'bind-add');
  assert.ok(assign);
  assert.equal(assign.disabled, false);
});

test('rig selection masks only include opaque active layer pixels', () => {
  const layer = createLayer(4, 2, 'Art');
  layer.pixels[1] = 0xff0000ff;
  layer.pixels[3] = 0xffffffff;
  layer.pixels[6] = 0xff00ffff;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasState: { width: 4, height: 2, activeLayerIndex: 0, layers: [layer] },
    boneEditor: { mode: 'bind' },
    selection: { combineMode: 'replace', baseMask: null },
    getMaskBounds: PixelStudio.prototype.getMaskBounds,
    filterMaskToActiveLayerOpaque: PixelStudio.prototype.filterMaskToActiveLayerOpaque
  };
  const mask = new Uint8Array(8);
  mask.fill(1);

  PixelStudio.prototype.applySelectionMask.call(fakeEditor, mask);

  assert.deepEqual([...fakeEditor.selection.mask], [0, 1, 0, 1, 0, 0, 1, 0]);
  assert.deepEqual(fakeEditor.selection.bounds, { x: 1, y: 0, w: 3, h: 2 });

  fakeEditor.selection.combineMode = 'add';
  fakeEditor.selection.baseMask = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 1]);
  const addMask = new Uint8Array(8);
  addMask[6] = 1;

  PixelStudio.prototype.applySelectionMask.call(fakeEditor, addMask);

  assert.deepEqual([...fakeEditor.selection.mask], [0, 0, 0, 0, 0, 0, 1, 0]);
});

test('rig unassigned action selects opaque active layer pixels without explicit bindings', () => {
  const layer = createLayer(4, 2, 'Art');
  layer.pixels[0] = 0xff0000ff;
  layer.pixels[1] = 0xff00ff00;
  layer.pixels[2] = 0xffffffff;
  let rig = createBone(createDefaultBoneRig(), { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'root' }).rig;
  const assignedMask = new Uint8Array(8);
  assignedMask[1] = 1;
  rig = createSelectionBinding(rig, 0, [rig.bones[0].endJointId], assignedMask, 4, 2);
  const fakeEditor = {
    canvasState: { width: 4, height: 2, activeLayerIndex: 0, layers: [layer] },
    boneRig: rig,
    boneEditor: { mode: 'bind' },
    selection: {},
    activeToolId: TOOL_IDS.PENCIL,
    statusMessage: '',
    getMaskBounds: PixelStudio.prototype.getMaskBounds,
    setSelectionMask: PixelStudio.prototype.setSelectionMask,
    getActiveLayerAssignedRigMask: PixelStudio.prototype.getActiveLayerAssignedRigMask,
    ensureBindSelectionTool: PixelStudio.prototype.ensureBindSelectionTool,
    isBindSelectionTool: PixelStudio.prototype.isBindSelectionTool,
    setActiveTool(toolId) {
      this.activeToolId = toolId;
    }
  };

  PixelStudio.prototype.selectUnassignedRigPixels.call(fakeEditor);

  assert.deepEqual([...fakeEditor.selection.mask], [1, 0, 1, 0, 0, 0, 0, 0]);
  assert.equal(fakeEditor.selection.active, true);
  assert.equal(fakeEditor.activeToolId, TOOL_IDS.SELECT_RECT);
});

test('converting rig assignments replaces active frame layers ordered by rig depth', () => {
  const layer = createLayer(4, 2, 'Art');
  layer.pixels[0] = 0xff0000ff;
  layer.pixels[1] = 0xff00ff00;
  layer.pixels[2] = 0xffffffff;
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 0, y: 0 }, { x: 1, y: 0 }, { id: 'root' });
  rig = root.rig;
  const child = createBone(rig, root.bone.end, { x: 2, y: 0 }, {
    id: 'child',
    parentId: 'root',
    startJointId: root.bone.endJointId
  });
  rig = child.rig;
  rig.joints.find((joint) => joint.id === root.bone.startJointId).name = 'Body';
  rig.joints.find((joint) => joint.id === child.bone.endJointId).name = 'Hand';
  const bodyMask = new Uint8Array(8);
  bodyMask[0] = 1;
  const handMask = new Uint8Array(8);
  handMask[2] = 1;
  rig = createSelectionBinding(rig, 0, [root.bone.startJointId], bodyMask, 4, 2);
  rig = createSelectionBinding(rig, 0, [child.bone.endJointId], handMask, 4, 2);
  const fakeEditor = {
    canvasState: { width: 4, height: 2, activeLayerIndex: 0, layers: [layer] },
    currentFrame: { layers: [layer] },
    boneRig: rig,
    boneEditor: { reverseRigLayerOrder: false },
    startHistory() {},
    commitHistory() {},
    setFrameLayers(layers) {
      this.canvasState.layers = layers;
      this.currentFrame.layers = layers;
    },
    getRigOwnerDepths: PixelStudio.prototype.getRigOwnerDepths,
    getRigOwnerLayerName: PixelStudio.prototype.getRigOwnerLayerName
  };

  PixelStudio.prototype.convertRigAssignmentsToLayers.call(fakeEditor);

  assert.deepEqual(fakeEditor.currentFrame.layers.map((entry) => entry.name), ['Body', 'Hand']);
  assert.equal(fakeEditor.currentFrame.layers[0].pixels[0], 0xff0000ff);
  assert.equal(fakeEditor.currentFrame.layers[0].pixels[2], 0);
  assert.equal(fakeEditor.currentFrame.layers[1].pixels[0], 0);
  assert.equal(fakeEditor.currentFrame.layers[1].pixels[2], 0xffffffff);
  assert.deepEqual(fakeEditor.boneRig.bindings.map((binding) => ({
    layerIndex: binding.layerIndex,
    boneIds: binding.boneIds,
    skinningMode: binding.skinningMode
  })), [
    { layerIndex: 0, boneIds: [root.bone.startJointId], skinningMode: 'rigid-layer' },
    { layerIndex: 1, boneIds: [child.bone.endJointId], skinningMode: 'rigid-layer' }
  ]);

  const posedLayers = deformLayersWithBonePose(fakeEditor.currentFrame.layers, 4, 2, fakeEditor.boneRig, {
    bones: { child: { angle: 0, dx: 1, dy: 0, scale: 1 } }
  });
  assert.equal(posedLayers[0].pixels[0], 0xff0000ff);
  assert.equal(posedLayers[1].pixels[3], 0xffffffff);

  fakeEditor.canvasState.layers = [layer];
  fakeEditor.currentFrame.layers = [layer];
  fakeEditor.boneRig = rig;
  fakeEditor.boneEditor.reverseRigLayerOrder = true;

  PixelStudio.prototype.convertRigAssignmentsToLayers.call(fakeEditor);

  assert.deepEqual(fakeEditor.currentFrame.layers.map((entry) => entry.name), ['Hand', 'Body']);
  assert.deepEqual(fakeEditor.boneRig.bindings.map((binding) => ({
    layerIndex: binding.layerIndex,
    boneIds: binding.boneIds,
    skinningMode: binding.skinningMode
  })), [
    { layerIndex: 0, boneIds: [child.bone.endJointId], skinningMode: 'rigid-layer' },
    { layerIndex: 1, boneIds: [root.bone.startJointId], skinningMode: 'rigid-layer' }
  ]);
});

test('moving bone order preserves rig data and changes overlap priority', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 2 }, { x: 5, y: 2 }, { id: 'bottom' }).rig;
  rig = createBone(rig, { x: 1, y: 2 }, { x: 5, y: 2 }, { id: 'top' }).rig;
  const layer = createLayer(8, 5, 'Order Move');
  const bottomIndex = 2 * 8 + 1;
  const topIndex = 2 * 8 + 5;
  const autoIndex = 2 * 8 + 3;
  layer.pixels[bottomIndex] = 0xff0000ff;
  layer.pixels[topIndex] = 0x00ff00ff;
  layer.pixels[autoIndex] = 0xffffffff;
  const bottomMask = new Uint8Array(8 * 5);
  const topMask = new Uint8Array(8 * 5);
  bottomMask[bottomIndex] = 1;
  topMask[topIndex] = 1;
  rig = createSelectionBinding(rig, 0, ['bottom'], bottomMask, 8, 5);
  rig = createSelectionBinding(rig, 0, ['top'], topMask, 8, 5);
  const fakeEditor = {
    boneRig: rig,
    boneEditor: { selectedBoneId: null, selectedEdgeBoneId: null, selectedJointId: null },
    statusMessage: '',
    startHistory() {},
    commitHistory() {}
  };

  PixelStudio.prototype.moveBoneOrder.call(fakeEditor, 'bottom', 1);

  assert.deepEqual(fakeEditor.boneRig.bones.map((bone) => bone.id), ['top', 'bottom']);
  assert.equal(fakeEditor.boneRig.bindings.length, rig.bindings.length);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'bottom');
  const [deformed] = deformLayersWithBonePose([layer], 8, 5, fakeEditor.boneRig, {
    bones: { bottom: { angle: 0, dx: 1, dy: 0, scale: 1 } }
  });
  assert.equal(deformed.pixels[autoIndex], 0);
  assert.equal(deformed.pixels[2 * 8 + 4], 0xffffffff);
});

test('pose preview overlapping pixels render lower list bones on top', () => {
  const width = 8;
  const height = 5;
  const backColor = 0xff0000ff;
  const frontColor = 0xff00ff00;
  const createOverlapRig = (reverseOrder = false) => {
    let rig = createDefaultBoneRig();
    rig = createBone(rig, { x: 1, y: 2 }, { x: 2, y: 2 }, { id: 'back' }).rig;
    rig = createBone(rig, { x: 5, y: 2 }, { x: 6, y: 2 }, { id: 'front' }).rig;
    if (reverseOrder) rig = { ...rig, bones: [rig.bones[1], rig.bones[0]] };
    const layer = createLayer(width, height, 'Feet');
    const backIndex = 2 * width + 1;
    const frontIndex = 2 * width + 5;
    layer.pixels[backIndex] = backColor;
    layer.pixels[frontIndex] = frontColor;
    const backMask = new Uint8Array(width * height);
    const frontMask = new Uint8Array(width * height);
    backMask[backIndex] = 1;
    frontMask[frontIndex] = 1;
    rig = createSelectionBinding(rig, 0, ['back'], backMask, width, height);
    rig = createSelectionBinding(rig, 0, ['front'], frontMask, width, height);
    return { rig, layer };
  };
  const pose = {
    bones: {
      back: { angle: 0, dx: 2, dy: 0, scale: 1 },
      front: { angle: 0, dx: -2, dy: 0, scale: 1 }
    }
  };

  const normal = createOverlapRig(false);
  const normalPreview = compositeBonePreview([normal.layer], width, height, normal.rig, pose, { meshCache: new Map() });
  const reversed = createOverlapRig(true);
  const reversedPreview = compositeBonePreview([reversed.layer], width, height, reversed.rig, pose, { meshCache: new Map() });

  assert.equal(normalPreview[2 * width + 3], frontColor);
  assert.equal(reversedPreview[2 * width + 3], backColor);
});

test('active pose preview keeps lower ordered static bone pixels on top', () => {
  const width = 8;
  const height = 5;
  const backColor = 0xff0000ff;
  const frontColor = 0xff00ff00;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 1, y: 2 }, { x: 2, y: 2 }, { id: 'back' }).rig;
  rig = createBone(rig, { x: 5, y: 2 }, { x: 6, y: 2 }, { id: 'front' }).rig;
  const layer = createLayer(width, height, 'Active Feet');
  const backIndex = 2 * width + 1;
  const frontIndex = 2 * width + 5;
  layer.pixels[backIndex] = backColor;
  layer.pixels[frontIndex] = frontColor;
  const backMask = new Uint8Array(width * height);
  const frontMask = new Uint8Array(width * height);
  backMask[backIndex] = 1;
  frontMask[frontIndex] = 1;
  rig = createSelectionBinding(rig, 0, ['back'], backMask, width, height);
  rig = createSelectionBinding(rig, 0, ['front'], frontMask, width, height);

  const [frontOnTop] = deformLayersWithBones([layer], width, height, rig, {
    bones: { back: { angle: 0, dx: 4, dy: 0, scale: 1 } }
  }, {
    preview: true,
    activeBoneIds: new Set(['back']),
    meshCache: new Map()
  });
  const backOnTopRig = { ...rig, bones: [rig.bones[1], rig.bones[0]] };
  const [backOnTop] = deformLayersWithBones([layer], width, height, backOnTopRig, {
    bones: { back: { angle: 0, dx: 4, dy: 0, scale: 1 } }
  }, {
    preview: true,
    activeBoneIds: new Set(['back']),
    meshCache: new Map()
  });

  assert.equal(frontOnTop.pixels[frontIndex], frontColor);
  assert.equal(backOnTop.pixels[frontIndex], backColor);
});

test('rigid layer bindings do not auto weight or interpolate unassigned pixels', () => {
  let rig = createDefaultBoneRig();
  const root = createBone(rig, { x: 1, y: 1 }, { x: 3, y: 1 }, { id: 'head' });
  rig = root.rig;
  const layer = createLayer(8, 4, 'Head Layer');
  const headIndex = 1 * 8 + 3;
  const chestIndex = 1 * 8 + 2;
  layer.pixels[headIndex] = 0xffffffff;
  layer.pixels[chestIndex] = 0xff0000ff;
  const mask = new Uint8Array(8 * 4);
  mask[headIndex] = 1;
  rig = createSelectionBinding(rig, 0, [root.bone.endJointId], mask, 8, 4);
  rig = {
    ...rig,
    bindings: rig.bindings.map((binding) => ({ ...binding, skinningMode: 'rigid-layer' }))
  };

  const [deformed] = deformLayersWithBonePose([layer], 8, 4, rig, {
    bones: { head: { angle: 0, dx: 2, dy: 0, scale: 1 } }
  });

  assert.equal(deformed.pixels[chestIndex], 0xff0000ff);
  assert.equal(deformed.pixels[headIndex], 0);
  assert.equal(deformed.pixels[1 * 8 + 5], 0xffffffff);
});

test('rigid layer rotation rasterizes continuous pixel coverage', () => {
  const width = 20;
  const height = 20;
  const color = 0xff00ffff;
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 6, y: 6 }, { x: 14, y: 6 }, { id: 'arm' }).rig;
  const layer = createLayer(width, height, 'Rigid Block');
  const mask = new Uint8Array(width * height);
  let sourcePixels = 0;
  for (let y = 4; y < 10; y += 1) {
    for (let x = 8; x < 14; x += 1) {
      const index = y * width + x;
      layer.pixels[index] = color;
      mask[index] = 1;
      sourcePixels += 1;
    }
  }
  rig = createSelectionBinding(rig, 0, ['arm'], mask, width, height);
  rig = {
    ...rig,
    bindings: rig.bindings.map((binding) => ({ ...binding, skinningMode: 'rigid-layer' }))
  };

  const [deformed] = deformLayersWithBonePose([layer], width, height, rig, {
    bones: { arm: { angle: Math.PI / 4, dx: 0, dy: 0, scale: 1 } }
  });
  const movedPixels = Array.from(deformed.pixels).filter(Boolean);

  assert.ok(movedPixels.length > sourcePixels, `expected filled rotated coverage, got ${movedPixels.length}`);
  assert.ok(movedPixels.every((pixel) => pixel === color));
  assert.equal(deformed.pixels[10 * width + 8], color);
  assert.equal(deformed.pixels[10 * width + 9], color);
  assert.equal(deformed.pixels[10 * width + 10], color);
});

test('rigid layer pose preview skips layers outside the active bone set', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 0, y: 0 }, { x: 2, y: 0 }, { id: 'head' }).rig;
  rig = createBone(rig, { x: 0, y: 1 }, { x: 2, y: 1 }, { id: 'chest' }).rig;
  const headLayer = createLayer(8, 4, 'Head');
  const chestLayer = createLayer(8, 4, 'Chest');
  headLayer.pixels[1] = 0xffffffff;
  chestLayer.pixels[8 + 1] = 0xff0000ff;
  const headMask = new Uint8Array(8 * 4);
  const chestMask = new Uint8Array(8 * 4);
  headMask[1] = 1;
  chestMask[8 + 1] = 1;
  rig = createSelectionBinding(rig, 0, ['head'], headMask, 8, 4);
  rig = createSelectionBinding(rig, 1, ['chest'], chestMask, 8, 4);
  rig = {
    ...rig,
    bindings: rig.bindings.map((binding) => ({ ...binding, skinningMode: 'rigid-layer' }))
  };

  const [headPreview, chestPreview] = deformLayersWithBones([headLayer, chestLayer], 8, 4, rig, {
    bones: {
      head: { angle: 0, dx: 2, dy: 0, scale: 1 },
      chest: { angle: 0, dx: 2, dy: 0, scale: 1 }
    }
  }, {
    preview: true,
    activeBoneIds: new Set(['head'])
  });

  assert.equal(headPreview.pixels[1], 0);
  assert.equal(headPreview.pixels[3], 0xffffffff);
  assert.equal(chestPreview.pixels[8 + 1], 0xff0000ff);
  assert.equal(chestPreview.pixels[8 + 3], 0);
});

test('active pose preview does not clone layers outside the active bone set', () => {
  let rig = createDefaultBoneRig();
  rig = createBone(rig, { x: 0, y: 0 }, { x: 3, y: 0 }, { id: 'arm' }).rig;
  rig = createBone(rig, { x: 0, y: 3 }, { x: 3, y: 3 }, { id: 'leg' }).rig;
  const armLayer = createLayer(8, 4, 'Arm');
  const legLayer = createLayer(8, 4, 'Leg');
  armLayer.pixels[1] = 0xff0000ff;
  legLayer.pixels[25] = 0x00ff00ff;
  const armMask = new Uint8Array(32);
  const legMask = new Uint8Array(32);
  armMask[1] = 1;
  legMask[25] = 1;
  rig = addMaskToBoneBinding(rig, 0, 'arm', armMask, 8, 4);
  rig = addMaskToBoneBinding(rig, 1, 'leg', legMask, 8, 4);

  const result = deformLayersWithBones([armLayer, legLayer], 8, 4, rig, {
    bones: { arm: { angle: 0.4, dx: 0, dy: 0, scale: 1 } }
  }, {
    preview: true,
    activeBoneIds: new Set(['arm']),
    meshCache: new Map()
  });

  assert.notEqual(result[0], armLayer);
  assert.equal(result[1], legLayer);
});

test('bone action grid registers button groups for bone ui hit testing', () => {
  const fakeEditor = {
    uiButtons: [],
    drawButton() {},
    registerFocusable() {},
    drawPortraitActionGrid: PixelStudio.prototype.drawPortraitActionGrid
  };

  PixelStudio.prototype.drawPortraitActionGrid.call(fakeEditor, {}, 10, 20, 120, [
    { id: 'bind-add', label: 'Assign', action() {} }
  ], { group: 'bone-actions' });

  assert.equal(fakeEditor.uiButtons.length, 1);
  assert.equal(fakeEditor.uiButtons[0].group, 'bone-actions');
});

test('bone editor ui tap over canvas does not clear rig selection or route to canvas', () => {
  const mask = new Uint8Array(16);
  mask[5] = 1;
  let buttonClicks = 0;
  let clearCalls = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 160, h: 160 },
    cursor: {},
    selection: {
      active: true,
      mask,
      bounds: { x: 1, y: 1, w: 1, h: 1 }
    },
    boneEditor: { mode: 'bind' },
    uiButtons: [
      {
        bounds: { x: 20, y: 20, w: 60, h: 36 },
        group: 'bone-actions',
        onClick: () => {
          buttonClicks += 1;
        }
      }
    ],
    boneUiRegions: [],
    transportPopover: null,
    uiSliderDrag: null,
    menuOpen: false,
    controlsOverlayOpen: false,
    paletteGridOpen: false,
    selectionContextMenu: null,
    brushPickerOpen: false,
    transformModal: null,
    pasteImportModal: null,
    mobileDrawerBounds: null,
    mobileZoomSliderBounds: null,
    activeToolId: TOOL_IDS.SELECT_RECT,
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    view: { panX: 0, panY: 0 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    startMenuScrollDrag() {
      throw new Error('bone ui tap should not start menu scroll');
    },
    handleButtonClick(x, y) {
      const hit = this.hitTestUiButton({ x, y });
      if (!hit) return false;
      hit.onClick?.();
      return true;
    },
    setInputMode() {
      throw new Error('bone ui tap should not route to canvas');
    },
    handleBonePointerDown() {
      throw new Error('bone ui tap should not hit bones');
    },
    handleToolPointerDown() {
      throw new Error('bone ui tap should not select pixels');
    },
    clearSelection() {
      clearCalls += 1;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 30, y: 30, button: 0 });

  assert.equal(buttonClicks, 1);
  assert.equal(clearCalls, 0);
  assert.equal(fakeEditor.selection.active, true);
  assert.equal(fakeEditor.pointerDownOnUi, true);
});

test('bone list touch drag scrolls before bone ui hit consumes the tap', () => {
  let rowClicks = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 220, h: 260 },
    cursor: {},
    selection: { active: false },
    boneEditor: { mode: 'time', submenu: 'nodes', drag: null },
    uiButtons: [{
      bounds: { x: 24, y: 44, w: 120, h: 38 },
      group: 'bone-actions',
      onClick: () => {
        rowClicks += 1;
      }
    }],
    boneUiRegions: [{ x: 20, y: 40, w: 180, h: 132 }],
    boneListMeta: {
      scrollBounds: { x: 20, y: 40, w: 180, h: 132 },
      lineHeight: 44,
      maxScroll: 5
    },
    focusScroll: { bones: 0 },
    focusGroups: { file: [] },
    focusGroupMeta: { file: { maxVisible: 1 } },
    transportPopover: null,
    uiSliderDrag: null,
    menuOpen: false,
    controlsOverlayOpen: false,
    paletteGridOpen: false,
    selectionContextMenu: null,
    brushPickerOpen: false,
    transformModal: null,
    pasteImportModal: null,
    mobileDrawerBounds: null,
    mobileZoomSliderBounds: null,
    panJoystick: { center: { x: -100, y: -100 }, radius: 1, active: false },
    view: { panX: 0, panY: 0 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    startMenuScrollDrag: PixelStudio.prototype.startMenuScrollDrag,
    handlePointerMove: PixelStudio.prototype.handlePointerMove,
    handlePointerUp: PixelStudio.prototype.handlePointerUp,
    handleButtonClick() {
      throw new Error('scrollable bone list touch should start scroll drag before button click');
    },
    setInputMode() {
      throw new Error('bone list drag should not route to canvas');
    },
    handleBonePointerDown() {
      throw new Error('bone list drag should not hit bones');
    },
    handleToolPointerDown() {
      throw new Error('bone list drag should not select pixels');
    },
    cancelLongPress() {}
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 30, y: 50, button: 0, touchCount: 1, id: 1 });

  assert.equal(fakeEditor.menuScrollDrag?.scrollGroup, 'bones');
  assert.equal(fakeEditor.pointerDownOnUi, undefined);
  assert.equal(rowClicks, 0);

  PixelStudio.prototype.handlePointerMove.call(fakeEditor, { x: 30, y: 6, id: 1 });

  assert.equal(fakeEditor.menuScrollDrag.moved, true);
  assert.equal(fakeEditor.focusScroll.bones, 1);

  PixelStudio.prototype.handlePointerUp.call(fakeEditor, { x: 30, y: 6, id: 1 });

  assert.equal(fakeEditor.menuScrollDrag, null);
  assert.equal(rowClicks, 0);
});

test('bone list touch tap still invokes row action when not dragged', () => {
  let rowClicks = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 220, h: 260 },
    cursor: {},
    selection: { active: false },
    boneEditor: { mode: 'time', submenu: 'nodes', drag: null },
    uiButtons: [{
      bounds: { x: 24, y: 44, w: 120, h: 38 },
      group: 'bone-actions',
      onClick: () => {
        rowClicks += 1;
      }
    }],
    boneUiRegions: [{ x: 20, y: 40, w: 180, h: 132 }],
    boneListMeta: {
      scrollBounds: { x: 20, y: 40, w: 180, h: 132 },
      lineHeight: 44,
      maxScroll: 5
    },
    focusScroll: { bones: 0 },
    focusGroups: { file: [] },
    focusGroupMeta: { file: { maxVisible: 1 } },
    transportPopover: null,
    uiSliderDrag: null,
    menuOpen: false,
    controlsOverlayOpen: false,
    paletteGridOpen: false,
    selectionContextMenu: null,
    brushPickerOpen: false,
    transformModal: null,
    pasteImportModal: null,
    mobileDrawerBounds: null,
    mobileZoomSliderBounds: null,
    panJoystick: { center: { x: -100, y: -100 }, radius: 1, active: false },
    view: { panX: 0, panY: 0 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    startMenuScrollDrag: PixelStudio.prototype.startMenuScrollDrag,
    handlePointerUp: PixelStudio.prototype.handlePointerUp,
    handleButtonClick() {
      throw new Error('bone list tap should be deferred through menu scroll drag');
    },
    setInputMode() {
      throw new Error('bone list tap should not route to canvas');
    },
    handleBonePointerDown() {
      throw new Error('bone list tap should not hit bones');
    },
    handleToolPointerDown() {
      throw new Error('bone list tap should not select pixels');
    },
    cancelLongPress() {}
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 30, y: 50, button: 0, touchCount: 1, id: 1 });
  PixelStudio.prototype.handlePointerUp.call(fakeEditor, { x: 30, y: 50, id: 1 });

  assert.equal(rowClicks, 1);
  assert.equal(fakeEditor.menuScrollDrag, null);
  assert.equal(fakeEditor.focusScroll.bones, 0);
});

test('portrait rig drawer tap over canvas preserves selection and never routes through', () => {
  const mask = new Uint8Array(16);
  mask[5] = 1;
  let clearCalls = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    mobileDrawer: 'panel',
    mobileDrawerBounds: { x: 20, y: 20, w: 120, h: 120 },
    canvasBounds: { x: 0, y: 0, w: 160, h: 160 },
    cursor: {},
    selection: {
      active: true,
      mask,
      bounds: { x: 1, y: 1, w: 1, h: 1 }
    },
    boneEditor: { mode: 'bind' },
    uiButtons: [],
    boneUiRegions: [],
    transportPopover: null,
    uiSliderDrag: null,
    activeToolId: TOOL_IDS.SELECT_RECT,
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    view: { panX: 0, panY: 0 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    handleButtonClick() {
      return false;
    },
    startMenuScrollDrag() {
      throw new Error('portrait rig drawer tap should not start scroll behind ui');
    },
    setInputMode() {
      throw new Error('portrait rig drawer tap should not route to canvas');
    },
    handleBonePointerDown() {
      throw new Error('portrait rig drawer tap should not hit bones');
    },
    handleToolPointerDown() {
      throw new Error('portrait rig drawer tap should not select pixels');
    },
    clearSelection() {
      clearCalls += 1;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 40, y: 40, button: 0, touchCount: 1 });

  assert.equal(clearCalls, 0);
  assert.equal(fakeEditor.selection.active, true);
  assert.equal(fakeEditor.pointerDownOnUi, true);
});

test('portrait rig rail region over canvas preserves selection without a button hit', () => {
  const mask = new Uint8Array(16);
  mask[5] = 1;
  let clearCalls = 0;
  const fakeEditor = {
    leftPanelTab: 'bones',
    mobileDrawerBounds: null,
    canvasBounds: { x: 0, y: 0, w: 180, h: 180 },
    cursor: {},
    selection: {
      active: true,
      mask,
      bounds: { x: 1, y: 1, w: 1, h: 1 }
    },
    boneEditor: { mode: 'bind' },
    uiButtons: [],
    boneUiRegions: [{ x: 30, y: 30, w: 120, h: 48 }],
    transportPopover: null,
    uiSliderDrag: null,
    activeToolId: TOOL_IDS.SELECT_RECT,
    panJoystick: { center: { x: -100, y: -100 }, radius: 1 },
    view: { panX: 0, panY: 0 },
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    handleButtonClick() {
      return false;
    },
    startMenuScrollDrag() {
      throw new Error('portrait rig rail tap should not start scroll behind ui');
    },
    setInputMode() {
      throw new Error('portrait rig rail tap should not route to canvas');
    },
    handleBonePointerDown() {
      throw new Error('portrait rig rail tap should not hit bones');
    },
    handleToolPointerDown() {
      throw new Error('portrait rig rail tap should not select pixels');
    },
    clearSelection() {
      clearCalls += 1;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 40, y: 40, button: 0, touchCount: 1 });

  assert.equal(clearCalls, 0);
  assert.equal(fakeEditor.selection.active, true);
  assert.equal(fakeEditor.pointerDownOnUi, true);
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
    assert.equal(fakeEditor.selection.active, true);
    assert.deepEqual(fakeEditor.selection.start, { col: 0, row: 0 });
    assert.deepEqual(fakeEditor.selection.end, { col: 2, row: 2 });
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
    boneEditor: { mode: 'pose', timeMs: 0, durationMs: 1000, playing: true, drag: null },
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
    boneEditor: { mode: 'pose', timeMs: 250, durationMs: 1000, playing: true, timelineZoom: 2, timelineScrollMs: 250 },
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
    boneEditor: { mode: 'pose', timeMs: 700, durationMs: 1000, playing: false, timelineZoom: 1, timelineScrollMs: 0 },
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
    boneEditor: { mode: 'pose', timeMs: 500, durationMs: 1000, playing: true, timelineZoom: 2, timelineScrollMs: 250 },
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
    boneEditor: { mode: 'pose', timeMs: 500, durationMs: 1000, playing: true, timelineZoom: 2, timelineScrollMs: 250 },
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
  assert.equal(fakeEditor.selection.active, true);
  assert.ok(fakeEditor.selection.mask);
  assert.deepEqual(fakeEditor.selection.bounds, { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(fakeEditor.selection.mode, null);
  assert.equal(fakeEditor.selection.start, null);
  assert.equal(fakeEditor.selection.end, null);
  assert.deepEqual(fakeEditor.selection.lassoPoints, []);
  assert.equal(fakeEditor.selection.floating, null);
  assert.equal(fakeEditor.selection.floatingMode, null);
  assert.equal(fakeEditor.selection.floatingBounds, null);
  assert.deepEqual(fakeEditor.selection.offset, { x: 0, y: 0 });
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
    ensureBindSelectionTool() {
      calls.push('ensure-bind-tool');
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
  assert.deepEqual(calls, ['ensure-bind-tool', ['bone', { col: 4, row: 5 }], 'cancel-long-press']);
});

test('bone overlay source uses yellow for selected nodes and only the selected edge', () => {
  const overlayStart = pixelStudioSource.indexOf('drawBoneOverlay(ctx');
  const overlayEnd = pixelStudioSource.indexOf('async choosePixelExportFormat()');
  const overlaySource = pixelStudioSource.slice(overlayStart, overlayEnd);

  assert.equal(overlaySource.includes('const selectedYellow = \'#ffe16a\''), true);
  assert.equal(overlaySource.includes('const selectedEdgeBoneId = this.boneEditor.selectedEdgeBoneId || null'), true);
  assert.equal(overlaySource.includes("const poseTargetEdgeId = this.boneEditor.mode === 'pose' ? getPoseTargetEdge.call(this)?.id || null : null"), true);
  assert.equal(overlaySource.includes('const highlightedEdgeBoneId = selectedEdgeBoneId || poseTargetEdgeId'), true);
  assert.equal(overlaySource.includes('const selectedEdge = highlightedEdgeBoneId === bone.id'), true);
  assert.equal(overlaySource.includes('ctx.strokeStyle = selectedEdge ? selectedYellow'), true);
  assert.equal(overlaySource.includes('const arrowSize = Math.max(5, Math.min(12, zoom * 0.36))'), true);
  assert.equal(overlaySource.includes('? { selectedJointId: null, downstream: new Set() }'), true);
  assert.equal(overlaySource.includes("'#82f59a'"), true);
  assert.equal(overlaySource.includes("'#6ad7ff'"), true);
  assert.equal(overlaySource.includes('selectedEdgeBoneId ? new Set() : this.getActiveBoneOverlayIds(displayedBones, adjacency)'), true);
  assert.equal(pixelStudioSource.includes("ctx.fillStyle = 'rgba(130, 245, 154, 0.32)'"), true);
});

test('bone editor shows generic pixel selection overlays only in rig mode', () => {
  assert.equal(pixelStudioSource.includes("const showGenericSelectionOverlays = this.leftPanelTab !== 'bones' || this.boneEditor?.mode === 'bind'"), true);
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
    canvasState: { width: 6, height: 4, layers: [layer] },
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

test('baking pose timeline frames uses the same flattened preview render as the pose editor', () => {
  let rig = createBone(createDefaultBoneRig(), { x: 1, y: 1 }, { x: 4, y: 1 }, { id: 'arm' }).rig;
  const layer = createLayer(7, 5, 'Arm');
  layer.pixels[1 * 7 + 3] = 0xff0000ff;
  layer.pixels[1 * 7 + 4] = 0xff00ffff;
  rig = createLayerBinding(rig, 0, ['arm'], 7, 5, layer.pixels);
  rig = setPoseKeyAtTime(rig, 0, { arm: { angle: 0, dx: 0, dy: 0, scale: 1 } });
  rig = setPoseKeyAtTime(rig, 100, { arm: { angle: Math.PI / 2, dx: 0, dy: 0, scale: 1 } });

  const fakeEditor = {
    boneRig: rig,
    boneEditor: { mode: 'time', submenu: 'time', segmentMs: 100, durationMs: 100, timeMs: 0, bakeFrameCount: 0 },
    canvasState: { width: 7, height: 5, layers: [layer] },
    animation: { currentFrameIndex: 0, frames: [createFrame([layer], 31)] },
    currentFrame: createFrame([layer], 31),
    leftPanelTab: 'bones',
    getBoneTimelineDurationMs: PixelStudio.prototype.getBoneTimelineDurationMs,
    getBoneBakeSampleTimes: PixelStudio.prototype.getBoneBakeSampleTimes,
    getBoneBakeFrameDurationMs: PixelStudio.prototype.getBoneBakeFrameDurationMs,
    renderBonePreviewBakeFrame: PixelStudio.prototype.renderBonePreviewBakeFrame,
    getCachedBoneRigContext: PixelStudio.prototype.getCachedBoneRigContext,
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

  const baked = fakeEditor.animation.frames.slice(1);
  assert.equal(baked.length, 3);
  assert.deepEqual(baked.map((frame) => frame.durationMs), [50, 50, 31]);
  const normalizedRig = normalizeBoneRig(rig, { exclusive: false });
  const graph = buildBoneGraph(normalizedRig);
  const expectedFinal = compositeBonePreview([layer], 7, 5, rig, samplePoseTimeline(normalizedRig, 100), {
    meshCache: new Map(),
    normalizedRig,
    graph
  });
  assert.equal(baked[2].layers.length, 1);
  assert.equal(baked[2].layers[0].name, 'Baked Pose 3');
  assert.deepEqual(Array.from(baked[2].layers[0].pixels), Array.from(expectedFinal));
});

test('portrait bone editor uses one root action row with focused submenus', () => {
  assert.deepEqual(
    buildPixelPortraitBoneActions().map((entry) => entry.label),
    ['Build', 'Rig', 'Pose', 'Tools']
  );

  const groups = buildPixelPortraitBoneActionGroups();
  assert.equal(groups.bones.title, 'Build');
  assert.deepEqual(groups.bones.actionIds, ['bone-add', 'bone-link', 'bone-reverse', 'bone-stretch', 'bone-ik', 'bone-delete']);
  assert.equal(groups.nodes.title, 'Nodes');
  assert.equal(groups.bind.actionIds.includes('bind-mode'), true);
  assert.equal(groups.bind.actionIds.includes('bind-prev'), false);
  assert.equal(groups.bind.actionIds.includes('bind-next'), false);
  assert.equal(groups.bind.actionIds.includes('bind-add'), true);
  assert.equal(groups.bind.actionIds.includes('selection-clipboard'), false);
  assert.equal(groups.bind.actionIds.includes('selection-transform-tools'), false);
  assert.deepEqual(groups.pose.actionIds, ['pose-target', 'pose-set', 'pose-reset', 'pose-copy', 'pose-paste', 'pose-delete', 'pose-length']);
  assert.equal(groups.pose.actionIds.includes('pose-back'), false);
  assert.equal(groups.pose.actionIds.includes('pose-forward'), false);
  assert.equal(groups.pose.actionIds.includes('pose-time'), false);
  assert.deepEqual(groups.time.actionIds, ['time-bake', 'time-hide-bones', 'time-frame-count', 'time-convert-layers', 'time-reverse-layers', 'time-list-bones']);
  assert.equal(groups.time.actionIds.includes('time-rewind'), false);
  assert.equal(groups.time.actionIds.includes('time-play'), false);
  assert.equal(groups.time.actionIds.includes('time-forward'), false);
  assert.equal(pixelStudioSource.includes("id: 'bone-play'"), true);
  assert.equal(pixelStudioSource.includes("transportMode: 'bones'"), true);
  assert.equal(pixelStudioSource.includes("this.transportPopover?.mode === 'bones'"), true);
  assert.equal(pixelStudioSource.includes("this.boneEditor.submenu === entry.id ? null : entry.id"), true);
});

test('bone editor keeps node list behind tools list bones action', () => {
  const labels = [];
  const rig = normalizeBoneRig({
    joints: [
      { id: 'root', x: 0, y: 0, name: 'Head' },
      { id: 'tip', x: 4, y: 0 }
    ],
    bones: [{ id: 'root-bone', name: 'Root Bone', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, startJointId: 'root', endJointId: 'tip' }]
  });
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      mode: 'time',
      submenu: 'time',
      selectedJointId: 'root',
      selectedBoneId: 'root-bone',
      selectedEdgeBoneId: null,
      linkMode: true,
      timeMs: 0
    },
    selection: { active: false, mask: null },
    activeToolId: TOOL_IDS.PENCIL,
    focusScroll: { bones: 0 },
    boneUiRegions: [],
    uiButtons: [],
    registerFocusable() {},
    drawButton(ctx, bounds, label) {
      labels.push(label);
    },
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getAffectedEdgeSummary() {
      return 'Root Bone';
    },
    getCurrentBoneTimelineKey() {
      return null;
    },
    getBoneBakeFrameCount() {
      return 1;
    },
    toggleReverseRigLayerOrder() {},
    convertRigAssignmentsToLayers() {},
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    drawBoneNodeList: PixelStudio.prototype.drawBoneNodeList,
    drawBoneTimelineStrip() {},
    getBoneEditorActions: PixelStudio.prototype.getBoneEditorActions,
    getBoneContextActions: PixelStudio.prototype.getBoneContextActions
  };

  PixelStudio.prototype.drawBoneEditorPanel.call(fakeEditor, createMockContext(), 0, 0, 220, 260, { isMobile: false });

  assert.equal(labels.includes('Tools'), true);
  assert.equal(labels.includes('List Bones'), true);
  assert.equal(labels.includes('Node 1'), false);
  assert.equal(labels.includes('Head'), false);
  assert.equal(fakeEditor.boneListMeta, null);

  labels.length = 0;
  const nodesAction = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'time', { full: true })
    .find((entry) => entry.id === 'time-list-bones');
  assert.ok(nodesAction);
  nodesAction.action();
  assert.equal(fakeEditor.boneEditor.submenu, 'nodes');

  PixelStudio.prototype.drawBoneEditorPanel.call(fakeEditor, createMockContext(), 0, 0, 220, 260, { isMobile: false });

  assert.equal(labels.includes('Root Bone'), true);
  assert.ok(fakeEditor.boneListMeta);
});

test('bone list selection updates selected edge and exposes ordering controls', () => {
  const rig = normalizeBoneRig({
    joints: [
      { id: 'root', x: 0, y: 0 },
      { id: 'mid', x: 4, y: 0 },
      { id: 'tip', x: 8, y: 0 }
    ],
    bones: [
      { id: 'root-bone', name: 'Root Bone', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, startJointId: 'root', endJointId: 'mid' },
      { id: 'tip-bone', name: 'Tip Bone', start: { x: 4, y: 0 }, end: { x: 8, y: 0 }, startJointId: 'mid', endJointId: 'tip' }
    ]
  });
  const fakeEditor = {
    boneRig: rig,
    boneEditor: {
      selectedJointId: 'root',
      selectedBoneId: 'root-bone',
      selectedEdgeBoneId: 'root-bone',
      chainAnchor: null
    },
    focusScroll: { bones: 1 },
    boneUiRegions: [],
    uiButtons: [],
    renameCalls: [],
    moveCalls: [],
    registerFocusable() {},
    drawButton() {},
    renameSelectedBone() {
      this.renameCalls.push(this.boneEditor.selectedBoneId);
    },
    moveBoneOrder(boneId, delta) {
      this.moveCalls.push([boneId, delta]);
    }
  };

  PixelStudio.prototype.drawBoneNodeList.call(fakeEditor, createMockContext(), 0, 0, 160, 80, { isMobile: false, group: 'bone-actions' });
  assert.equal(fakeEditor.uiButtons.length, 6);
  assert.equal(fakeEditor.uiButtons[3].group, 'bone-actions');

  fakeEditor.uiButtons[3].onClick();

  assert.equal(fakeEditor.boneEditor.selectedJointId, null);
  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'tip-bone');
  assert.equal(fakeEditor.boneEditor.selectedEdgeBoneId, 'tip-bone');
  assert.equal(fakeEditor.boneEditor.selectionSource, 'list');
  assert.equal(fakeEditor.boneEditor.chainAnchor, null);

  fakeEditor.uiButtons[4].onClick();
  assert.deepEqual(fakeEditor.moveCalls, [['tip-bone', -1]]);
  fakeEditor.uiButtons[5].onClick();
  assert.deepEqual(fakeEditor.renameCalls, ['tip-bone']);
});

test('bone tools expose hide during playback and bake frame count controls', () => {
  const fakeEditor = {
    boneRig: { bindings: [{}] },
    boneEditor: {
      mode: 'time',
      hideBonesDuringPlayback: false,
      bakeFrameCount: 7
    },
    selection: { active: false },
    getSelectedBone() {
      return null;
    },
    getSelectedEdgeBone() {
      return null;
    },
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getCurrentBoneTimelineKey() {
      return null;
    },
    getBoneBakeFrameCount: PixelStudio.prototype.getBoneBakeFrameCount,
    toggleHideBonesDuringPlayback: PixelStudio.prototype.toggleHideBonesDuringPlayback,
    promptBoneBakeFrameCount() {},
    bakeBoneAnimationToCopiedFrames() {}
  };

  const actions = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'time', { full: true });
  assert.deepEqual(actions.map((entry) => entry.id), ['time-bake', 'time-hide-bones', 'time-frame-count', 'time-convert-layers', 'time-reverse-layers', 'time-list-bones']);
  assert.equal(actions.find((entry) => entry.id === 'time-frame-count').label, 'Frames: 7');
  assert.equal(actions.find((entry) => entry.id === 'time-convert-layers').label, 'Rig to Layers');
  assert.equal(actions.find((entry) => entry.id === 'time-reverse-layers').label, 'Root Top: Off');
  assert.equal(actions.find((entry) => entry.id === 'time-list-bones').label, 'List Bones');
  actions.find((entry) => entry.id === 'time-hide-bones').action();
  assert.equal(fakeEditor.boneEditor.hideBonesDuringPlayback, true);
});

test('bone tools derive default bake frame count from pose keyframes', () => {
  const fakeEditor = {
    boneRig: {
      bindings: [{}],
      poseTimeline: [{ timeMs: 93 }, { timeMs: 0 }, { timeMs: 100 }]
    },
    currentFrame: { durationMs: 31 },
    boneEditor: {
      mode: 'time',
      hideBonesDuringPlayback: false,
      bakeFrameCount: 0,
      durationMs: 0,
      segmentMs: 0
    },
    selection: { active: false },
    getSelectedBone() {
      return null;
    },
    getSelectedEdgeBone() {
      return null;
    },
    getAffectedEdgeBones: PixelStudio.prototype.getAffectedEdgeBones,
    getCurrentBoneTimelineKey() {
      return null;
    },
    getBoneBakeFrameCount: PixelStudio.prototype.getBoneBakeFrameCount,
    toggleHideBonesDuringPlayback: PixelStudio.prototype.toggleHideBonesDuringPlayback,
    promptBoneBakeFrameCount() {},
    bakeBoneAnimationToCopiedFrames() {}
  };

  assert.equal(PixelStudio.prototype.getBoneBakeFrameCount.call(fakeEditor), 5);
  const actions = PixelStudio.prototype.getBoneContextActions.call(fakeEditor, 'time', { full: true });
  assert.equal(actions.find((entry) => entry.id === 'time-frame-count').label, 'Frames: 5');

  fakeEditor.currentFrame.durationMs = 50;
  assert.equal(PixelStudio.prototype.getBoneBakeFrameCount.call(fakeEditor), 5);

  fakeEditor.boneRig.poseTimeline = [{ timeMs: 0 }, { timeMs: 1000 }];
  fakeEditor.currentFrame.durationMs = 250;
  assert.equal(PixelStudio.prototype.getBoneBakeFrameCount.call(fakeEditor), 3);

  fakeEditor.boneEditor.bakeFrameCount = 8;
  assert.equal(PixelStudio.prototype.getBoneBakeFrameCount.call(fakeEditor), 8);
});

test('rigging entry switches to build mode without opening the portrait drawer', () => {
  const fakeEditor = {
    leftPanelTab: 'draw',
    mobileDrawer: 'panel',
    mobileDrawerBounds: { x: 1, y: 2, w: 3, h: 4 },
    pixelPortraitSubpanel: 'tools',
    boneListMeta: { scrollBounds: { x: 0, y: 0, w: 10, h: 10 } },
    boneEditor: { mode: 'pose', submenu: 'pose' },
    setLeftPanelTab(tab) {
      this.leftPanelTab = tab;
    },
    setBoneEditorMode: PixelStudio.prototype.setBoneEditorMode,
    resetBoneEditorTransientState() {},
    getBoneChainAnchorFromSelection() {
      return null;
    }
  };

  PixelStudio.prototype.enterRiggingBuildMode.call(fakeEditor);

  assert.equal(fakeEditor.leftPanelTab, 'bones');
  assert.equal(fakeEditor.boneEditor.mode, 'bones');
  assert.equal(fakeEditor.boneEditor.submenu, null);
  assert.equal(fakeEditor.mobileDrawer, null);
  assert.equal(fakeEditor.mobileDrawerBounds, null);
  assert.equal(fakeEditor.pixelPortraitSubpanel, null);
  assert.equal(fakeEditor.boneListMeta, null);
});

test('bone overlays can be hidden only during playback', () => {
  const fakeEditor = {
    leftPanelTab: 'bones',
    boneEditor: { hideBonesDuringPlayback: true, playing: true },
    shouldHideBoneOverlaysDuringPlayback: PixelStudio.prototype.shouldHideBoneOverlaysDuringPlayback
  };

  assert.equal(PixelStudio.prototype.shouldHideBoneOverlaysDuringPlayback.call(fakeEditor), true);
  fakeEditor.boneEditor.playing = false;
  assert.equal(PixelStudio.prototype.shouldHideBoneOverlaysDuringPlayback.call(fakeEditor), false);
});

test('bone transport actions scrub and play the pose timeline', () => {
  const fakeEditor = {
    boneEditor: { mode: 'bones', submenu: 'time', timeMs: 250, segmentMs: 100, playing: false, hideBonesDuringPlayback: false },
    animation: { playing: true, loop: false },
    runBoneToolCommand: PixelStudio.prototype.runBoneToolCommand,
    nudgeBoneTime: PixelStudio.prototype.nudgeBoneTime,
    toggleBoneTimelinePlayback: PixelStudio.prototype.toggleBoneTimelinePlayback,
    toggleHideBonesDuringPlayback: PixelStudio.prototype.toggleHideBonesDuringPlayback,
    getBoneTimelineDurationMs() {
      return 500;
    },
    setBoneEditorMode(mode) {
      this.boneEditor.mode = mode;
    }
  };
  const actions = PixelStudio.prototype.getBoneTransportActions.call(fakeEditor);

  assert.deepEqual(actions.map((entry) => entry.id), ['bone-start', 'bone-back', 'bone-forward', 'bone-play', 'bone-loop', 'bone-hide']);
  actions.find((entry) => entry.id === 'bone-play').action();
  assert.equal(fakeEditor.boneEditor.playing, true);
  assert.equal(fakeEditor.animation.playing, false);
  assert.equal(fakeEditor.boneEditor.mode, 'pose');
  actions.find((entry) => entry.id === 'bone-loop').action();
  assert.equal(fakeEditor.animation.loop, true);
  assert.equal(fakeEditor.boneEditor.mode, 'pose');
  actions.find((entry) => entry.id === 'bone-hide').action();
  assert.equal(fakeEditor.boneEditor.hideBonesDuringPlayback, true);
  assert.equal(fakeEditor.boneEditor.mode, 'pose');
  actions.find((entry) => entry.id === 'bone-forward').action();
  assert.equal(fakeEditor.boneEditor.timeMs, 350);
  assert.equal(fakeEditor.boneEditor.playing, false);
  actions.find((entry) => entry.id === 'bone-start').action();
  assert.equal(fakeEditor.boneEditor.timeMs, 0);
});

test('bone transport popover uses an opaque panel with restored full viewport placement', () => {
  const fillRects = [];
  const ctx = {
    ...createMockContext(),
    canvas: { width: 320, height: 520 },
    fillRect(x, y, w, h) {
      fillRects.push({ fillStyle: this.fillStyle, x, y, w, h });
    }
  };
  const fakeEditor = {
    transportPopover: { mode: 'bones', anchor: { x: 250, y: 472, w: 54, h: 42 } },
    canvasBounds: { x: 0, y: 64, w: 320, h: 96 },
    boneEditor: { playing: false, hideBonesDuringPlayback: false },
    animation: { loop: false },
    uiButtons: [],
    getTransportActions: PixelStudio.prototype.getTransportActions,
    getBoneTransportActions: PixelStudio.prototype.getBoneTransportActions,
    drawTransportPopover: PixelStudio.prototype.drawTransportPopover
  };

  PixelStudio.prototype.drawTransportPopover.call(fakeEditor, ctx);

  assert.equal(fillRects[0].fillStyle, 'rgba(8,10,14,0.98)');
  assert.ok(fillRects[0].y + fillRects[0].h > fakeEditor.canvasBounds.y + fakeEditor.canvasBounds.h);
  assert.equal(fakeEditor.transportPopoverButtons.length, 6);
  assert.equal(fakeEditor.transportPopoverButtons.some((button) => button.id === 'bone-loop'), true);
  assert.equal(fakeEditor.transportPopoverButtons.some((button) => button.id === 'bone-hide'), true);
});

test('bone playback honors loop when the pose timeline reaches the end', () => {
  const fakeEditor = {
    boneEditor: { playing: true, timeMs: 490 },
    animation: { playing: false, loop: true },
    getBoneTimelineDurationMs() {
      return 500;
    },
    updateAnimation: PixelStudio.prototype.updateAnimation
  };

  PixelStudio.prototype.updateAnimation.call(fakeEditor, 20);

  assert.equal(fakeEditor.boneEditor.playing, true);
  assert.equal(fakeEditor.boneEditor.timeMs, 500);
  assert.equal(fakeEditor.boneEditor.loopEndHeld, true);

  PixelStudio.prototype.updateAnimation.call(fakeEditor, 20);

  assert.equal(fakeEditor.boneEditor.playing, true);
  assert.equal(fakeEditor.boneEditor.timeMs, 20);
  assert.equal(fakeEditor.boneEditor.loopEndHeld, false);

  fakeEditor.animation.loop = false;
  fakeEditor.boneEditor.playing = true;
  fakeEditor.boneEditor.timeMs = 490;
  fakeEditor.boneEditor.loopEndHeld = true;
  PixelStudio.prototype.updateAnimation.call(fakeEditor, 20);

  assert.equal(fakeEditor.boneEditor.playing, false);
  assert.equal(fakeEditor.boneEditor.timeMs, 500);
  assert.equal(fakeEditor.boneEditor.loopEndHeld, false);
});

test('portrait bone transport popover draws after toolbar and bone rail overlays', () => {
  const drawPortraitStart = pixelStudioSource.indexOf('drawMobilePortraitLayout(ctx, width, height)');
  const toolbarCall = pixelStudioSource.indexOf('this.drawMobileToolbar(ctx, actionArea.x, actionArea.y, actionArea.w, actionArea.h);', drawPortraitStart);
  const boneRailCall = pixelStudioSource.indexOf('this.drawBoneContextRail(ctx, paletteStrip.x, paletteStrip.y, paletteStrip.w, paletteStrip.h, { isMobile: true });', drawPortraitStart);
  const popoverCall = pixelStudioSource.indexOf('this.drawTransportPopover(ctx);', drawPortraitStart);
  const toolbarStart = pixelStudioSource.indexOf('drawMobileToolbar(ctx, x, y, w, h)', drawPortraitStart);
  const toolbarEnd = pixelStudioSource.indexOf('drawMobilePanZoomControls(ctx, width, height, surfaceBounds = null)', toolbarStart);
  const toolbarPopoverCall = pixelStudioSource.indexOf('this.drawTransportPopover(ctx);', toolbarStart);

  assert.ok(toolbarCall > drawPortraitStart);
  assert.ok(boneRailCall > toolbarCall);
  assert.ok(popoverCall > boneRailCall);
  assert.equal(toolbarPopoverCall > toolbarStart && toolbarPopoverCall < toolbarEnd, false);
});

test('bone transport popover taps run the control and do not pass through to the canvas', () => {
  let loop = false;
  let canvasHit = false;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 320, h: 320 },
    transportPopover: { mode: 'bones' },
    transportPopoverButtons: [
      {
        id: 'bone-loop',
        bounds: { x: 12, y: 12, w: 48, h: 40 },
        onClick() {
          loop = true;
        }
      }
    ],
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    closeTransportPopover: PixelStudio.prototype.closeTransportPopover,
    shouldBoneCanvasOwnPointerDown() {
      return true;
    },
    handleBonePointerDown() {
      canvasHit = true;
      return true;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 20, y: 20, button: 0, id: 1 });

  assert.equal(loop, true);
  assert.equal(canvasHit, false);
  assert.equal(fakeEditor.transportPopover, null);
  assert.equal(fakeEditor.pointerDownOnUi, true);
});

test('bone editor UI buttons over the canvas do not create bones', () => {
  let clicked = false;
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 320, h: 320, cellSize: 16, mainX: 0, mainY: 0 },
    canvasViewportBounds: { x: 0, y: 0, w: 320, h: 320 },
    boneEditor: { mode: 'bones', drag: null },
    boneUiRegions: [],
    uiButtons: [
      {
        bounds: { x: 20, y: 20, w: 72, h: 40 },
        onClick() {
          clicked = true;
        }
      }
    ],
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    handleButtonClick: PixelStudio.prototype.handleButtonClick,
    handleBonePointerDown() {
      this.boneEditor.drag = { type: 'create' };
      return true;
    },
    startMenuScrollDrag() {
      return false;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: 32, y: 32, button: 0, id: 1 });

  assert.equal(clicked, true);
  assert.equal(fakeEditor.pointerDownOnUi, true);
  assert.equal(fakeEditor.boneEditor.drag, null);
});

test('visible off-canvas bone nodes can be selected and deleted', () => {
  const created = createBone(createDefaultBoneRig(), { x: -2, y: 5 }, { x: 2, y: 5 }, { id: 'offscreen' });
  const fakeEditor = {
    leftPanelTab: 'bones',
    canvasBounds: { x: 0, y: 0, w: 100, h: 100, cellSize: 10, mainX: 0, mainY: 0 },
    canvasViewportBounds: { x: -60, y: 0, w: 180, h: 120 },
    canvasState: { width: 10, height: 10 },
    cursor: {},
    boneRig: created.rig,
    boneEditor: { mode: 'bones', selectedBoneId: null, selectedJointId: null, selectedEdgeBoneId: null, drag: null },
    boneUiRegions: [],
    uiButtons: [],
    paletteBounds: [],
    layerBounds: [],
    frameBounds: [],
    isPointInBounds: PixelStudio.prototype.isPointInBounds,
    hitTestUiButton: PixelStudio.prototype.hitTestUiButton,
    isBoneEditorUiHit: PixelStudio.prototype.isBoneEditorUiHit,
    isBoneEditorPointerUiHit: PixelStudio.prototype.isBoneEditorPointerUiHit,
    shouldBoneCanvasOwnPointerDown: PixelStudio.prototype.shouldBoneCanvasOwnPointerDown,
    handlePriorityUiDragHit: PixelStudio.prototype.handlePriorityUiDragHit,
    handleButtonClick: PixelStudio.prototype.handleButtonClick,
    getBoneCanvasPointFromScreen: PixelStudio.prototype.getBoneCanvasPointFromScreen,
    getBoneEditorOffCanvasHitPoint: PixelStudio.prototype.getBoneEditorOffCanvasHitPoint,
    getBonePointerCoords: PixelStudio.prototype.getBonePointerCoords,
    getBoneHitRadius: PixelStudio.prototype.getBoneHitRadius,
    getDisplayedBonesForBoneEditor: PixelStudio.prototype.getDisplayedBonesForBoneEditor,
    getDisplayedJointsForBoneEditor: PixelStudio.prototype.getDisplayedJointsForBoneEditor,
    hitTestBone: PixelStudio.prototype.hitTestBone,
    hitTestBoneNode: PixelStudio.prototype.hitTestBoneNode,
    hitTestBoneJoint: PixelStudio.prototype.hitTestBoneJoint,
    distanceToBoneSegment: PixelStudio.prototype.distanceToBoneSegment,
    handleBonePointerDown: PixelStudio.prototype.handleBonePointerDown,
    setBoneJointSelection: PixelStudio.prototype.setBoneJointSelection,
    setBoneChainAnchor: PixelStudio.prototype.setBoneChainAnchor,
    getBoneForSelectedJoint: PixelStudio.prototype.getBoneForSelectedJoint,
    ensureBoneNodeSelection: PixelStudio.prototype.ensureBoneNodeSelection,
    getSelectedJoint: PixelStudio.prototype.getSelectedJoint,
    getSelectedBone: PixelStudio.prototype.getSelectedBone,
    getSelectedEdgeBone: PixelStudio.prototype.getSelectedEdgeBone,
    getSelectedBoneOwnerId: PixelStudio.prototype.getSelectedBoneOwnerId,
    getBoneChainAnchorFromSelection: PixelStudio.prototype.getBoneChainAnchorFromSelection,
    deleteSelectedBone: PixelStudio.prototype.deleteSelectedBone,
    setInputMode(mode) {
      this.inputMode = mode;
    },
    enforceBoneEditorToolMode() {},
    startHistory() {},
    commitHistory() {},
    cancelLongPress() {},
    startMenuScrollDrag() {
      return false;
    },
    isMobileLayout() {
      return false;
    },
    isPointInCircle() {
      return false;
    }
  };

  PixelStudio.prototype.handlePointerDown.call(fakeEditor, { x: -20, y: 50, button: 0, id: 1 });

  assert.equal(fakeEditor.boneEditor.selectedBoneId, 'offscreen');
  assert.equal(fakeEditor.boneEditor.drag?.type, 'edit');

  fakeEditor.boneEditor.drag = null;
  PixelStudio.prototype.deleteSelectedBone.call(fakeEditor);

  assert.equal(fakeEditor.boneRig.bones.length, 0);
  assert.equal(fakeEditor.boneRig.joints.length, 0);
});

test('bone pose timeline duration respects explicit length and later keys', () => {
  assert.equal(getPixelBoneTimelineDurationMs([], {}), 2000);
  assert.equal(getPixelBoneTimelineDurationMs([], { segmentMs: 500, durationMs: 1500 }), 1500);
  assert.equal(getPixelBoneTimelineDurationMs([{ timeMs: 2400 }], { segmentMs: 500, durationMs: 1500 }), 2400);
  assert.equal(getPixelBoneTimelineDurationMs([], { segmentMs: 750, durationMs: 0 }), 750);
  assert.equal(getPixelBoneTimelineDurationMs([{ timeMs: 1000 }, { timeMs: 250 }], { segmentMs: 500, durationMs: 0 }), 1000);
});

test('PixelStudio exposes bone editor as a non-runtime frame baking workflow', () => {
  assert.equal(pixelStudioSource.includes('const PIXEL_LEFT_PANEL_TABS = PIXEL_CONTROLLER_ROOT_ENTRIES.map((entry) => entry.id);'), true);
  assert.equal(pixelStudioSource.includes('this.leftPanelTabs = PIXEL_LEFT_PANEL_TABS.slice();'), true);
  assert.equal(pixelStudioSource.includes('const PIXEL_CONTROLLER_ROOT_ENTRIES = getEditorControllerRootMenuEntries(\'pixel\');'), true);
  assert.equal(pixelStudioSource.includes("id: 'bone-editor'"), false);
  assert.equal(pixelStudioSource.includes('drawBoneEditorPanel(ctx'), true);
  assert.equal(pixelStudioSource.includes('handleBonePointerDown(point)'), true);
  assert.equal(pixelStudioSource.includes('compositeBonePreview(this.canvasState.layers'), true);
  assert.equal(pixelStudioSource.includes('getCachedBonePreviewComposite(width, height'), true);
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
