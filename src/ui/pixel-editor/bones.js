import { cloneLayer, compositeLayers, createLayer } from './layers.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const clonePoint = (point = {}) => ({
  x: Number.isFinite(point.x) ? point.x : 0,
  y: Number.isFinite(point.y) ? point.y : 0
});

const POINT_EPSILON = 0.001;
const BONE_JOINT_MODES = ['rotate', 'fixed', 'stretch', 'spring', 'slide', 'hinge'];

const normalizeJointMode = (bone = {}) => {
  if (bone.jointMode === 'none') return 'slide';
  if (bone.jointMode === 'fixed' && bone.jointModeVersion !== 2) return bone.stretch ? 'stretch' : 'rotate';
  if (BONE_JOINT_MODES.includes(bone.jointMode)) return bone.jointMode;
  return bone.stretch ? 'stretch' : 'rotate';
};

const normalizeJointSettings = (settings = {}) => ({
  stiffness: Number.isFinite(settings.stiffness) ? Math.max(0, Math.min(1, settings.stiffness)) : 0.5,
  minAngle: Number.isFinite(settings.minAngle) ? settings.minAngle : -Math.PI,
  maxAngle: Number.isFinite(settings.maxAngle) ? settings.maxAngle : Math.PI,
  ikEnabled: settings.ikEnabled !== false
});

export const createDefaultBoneRig = () => ({
  version: 1,
  joints: [],
  bones: [],
  bindings: [],
  poses: [],
  poseTimeline: []
});

export const cloneBoneRig = (rig = createDefaultBoneRig()) => normalizeBoneRig(rig);

export const normalizeBoneRig = (rig = {}) => {
  const bones = Array.isArray(rig.bones) ? rig.bones : [];
  const sourceJoints = Array.isArray(rig.joints) ? rig.joints : [];
  const bindings = Array.isArray(rig.bindings) ? rig.bindings : [];
  const poses = Array.isArray(rig.poses) ? rig.poses : [];
  const poseTimeline = Array.isArray(rig.poseTimeline) ? rig.poseTimeline : [];
  const joints = [];
  const jointById = new Map();
  const jointAliasById = new Map();
  let nextJointIndex = 1;
  const addJoint = (point, preferredId = null) => {
    let id = preferredId ? String(preferredId) : `joint-${nextJointIndex}`;
    const aliasedId = jointAliasById.get(id);
    if (aliasedId && jointById.has(aliasedId)) return jointById.get(aliasedId);
    while (jointById.has(id)) {
      nextJointIndex += 1;
      id = `joint-${nextJointIndex}`;
    }
    const joint = { id, ...clonePoint(point) };
    joints.push(joint);
    jointById.set(id, joint);
    if (preferredId) jointAliasById.set(String(preferredId), id);
    nextJointIndex += 1;
    return joint;
  };
  const findJointAt = (point) => joints.find((joint) => (
    Math.abs(joint.x - point.x) <= POINT_EPSILON
    && Math.abs(joint.y - point.y) <= POINT_EPSILON
  )) || null;
  sourceJoints.forEach((joint) => {
    const id = joint?.id ? String(joint.id) : null;
    const existing = findJointAt(clonePoint(joint));
    if (existing && id) {
      jointAliasById.set(id, existing.id);
      return;
    }
    addJoint(joint, id);
  });
  const getOrCreateJoint = (point, preferredId = null) => {
    if (preferredId) {
      const id = String(preferredId);
      const aliasedId = jointAliasById.get(id) || id;
      if (jointById.has(aliasedId)) return jointById.get(aliasedId);
    }
    return findJointAt(point) || addJoint(point, preferredId);
  };
  const normalizedBones = [];
  const boneById = new Map();
  bones.forEach((bone, index) => {
    const id = String(bone.id || `bone-${index + 1}`);
    const parentId = bone.parentId ? String(bone.parentId) : null;
    const parent = parentId ? boneById.get(parentId) : null;
    const startSource = clonePoint(bone.start || (parent ? parent.end : null));
    const endSource = clonePoint(bone.end);
    let startJoint = null;
    if (bone.startJointId) {
      const aliasedId = jointAliasById.get(String(bone.startJointId)) || String(bone.startJointId);
      if (jointById.has(aliasedId)) startJoint = jointById.get(aliasedId);
    } else if (parent && Math.hypot(startSource.x - parent.end.x, startSource.y - parent.end.y) <= POINT_EPSILON) {
      startJoint = jointById.get(parent.endJointId);
    } else {
      startJoint = getOrCreateJoint(startSource, bone.startJointId);
    }
    const endJoint = getOrCreateJoint(endSource, bone.endJointId);
    const start = clonePoint(startJoint);
    const end = clonePoint(endJoint);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const jointMode = normalizeJointMode(bone);
    const normalized = {
      id,
      name: String(bone.name || `Bone ${index + 1}`),
      parentId,
      startJointId: startJoint.id,
      endJointId: endJoint.id,
      start,
      end,
      length: Number.isFinite(bone.length) ? Math.max(1, bone.length) : Math.max(1, Math.hypot(dx, dy)),
      angle: Number.isFinite(bone.angle) ? bone.angle : Math.atan2(dy, dx),
      locked: Boolean(bone.locked),
      stretch: jointMode === 'stretch',
      jointMode,
      jointModeVersion: 2,
      jointSettings: normalizeJointSettings(bone.jointSettings)
    };
    normalizedBones.push(normalized);
    boneById.set(id, normalized);
  });
  const normalizedBindings = bindings.map((binding, index) => ({
    id: String(binding.id || `binding-${index + 1}`),
    type: binding.type === 'selection' ? 'selection' : 'layer',
    layerIndex: Math.max(0, Math.round(Number(binding.layerIndex) || 0)),
    boneIds: Array.isArray(binding.boneIds) ? binding.boneIds.map(String) : [],
    pixels: Array.isArray(binding.pixels)
      ? binding.pixels.map((pixel) => ({
          index: Math.max(0, Math.round(Number(pixel.index) || 0)),
          weights: normalizeWeights(pixel.weights)
        }))
      : [],
    name: String(binding.name || `Binding ${index + 1}`)
  }));
  return {
    version: 1,
    joints,
    bones: normalizedBones,
    bindings: normalizeExclusiveBindings(normalizedBindings),
    poses: poses.map((pose) => ({
      frameIndex: Math.max(0, Math.round(Number(pose.frameIndex) || 0)),
      bones: normalizePoseBones(pose.bones)
    })),
    poseTimeline: normalizePoseTimeline(poseTimeline.length
      ? poseTimeline
      : poses.map((pose) => ({
          timeMs: Math.max(0, Math.round(Number(pose.frameIndex) || 0) * 120),
          bones: pose.bones
        })))
  };
};

export const normalizePoseTimeline = (timeline = []) => {
  const normalized = (Array.isArray(timeline) ? timeline : [])
    .map((key, index) => ({
      id: String(key.id || `pose-${index + 1}`),
      timeMs: Math.max(0, Math.round(Number(key.timeMs) || 0)),
      interpolation: key.interpolation === 'hold' ? 'hold' : 'linear',
      bones: normalizePoseBones(key.bones)
    }))
    .sort((a, b) => a.timeMs - b.timeMs);
  return normalized.filter((key, index) => index === 0 || key.timeMs !== normalized[index - 1].timeMs);
};

const normalizeWeights = (weights = {}) => {
  const entries = Object.entries(weights || {})
    .map(([id, weight]) => [String(id), clamp01(weight)])
    .filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([id, weight]) => [id, weight / total]));
};

const getPrimaryBoneId = (weights = {}, fallbackBoneIds = []) => {
  const entries = Object.entries(normalizeWeights(weights));
  if (entries.length) {
    return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0])[0];
  }
  return fallbackBoneIds.map(String).find(Boolean) || null;
};

const singleBoneWeights = (boneId) => (boneId ? { [String(boneId)]: 1 } : {});

const resolveJointOwnerBoneId = (rig, ownerId) => {
  const id = String(ownerId || '');
  if (!id) return null;
  if (rig.bones.some((bone) => bone.id === id)) return id;
  if (!rig.joints.some((joint) => joint.id === id)) return null;
  const child = rig.bones.find((bone) => bone.startJointId === id);
  if (child) return child.id;
  const parent = rig.bones.find((bone) => bone.endJointId === id);
  if (parent) return parent.id;
  const startOnly = rig.bones.find((bone) => bone.startJointId === id);
  return startOnly?.id || null;
};

const resolveWeightsForSkinning = (rig, weights = {}) => {
  const resolved = {};
  Object.entries(normalizeWeights(weights)).forEach(([ownerId, weight]) => {
    const boneId = resolveJointOwnerBoneId(rig, ownerId);
    if (!boneId) return;
    resolved[boneId] = (resolved[boneId] || 0) + weight;
  });
  return normalizeWeights(resolved);
};

const normalizeExclusiveBindings = (bindings = []) => {
  const candidates = [];
  const latestByKey = new Map();
  bindings.forEach((binding, bindingIndex) => {
    const fallbackBoneIds = Array.isArray(binding.boneIds) ? binding.boneIds.map(String) : [];
    (binding.pixels || []).forEach((pixel) => {
      const ownerId = getPrimaryBoneId(pixel.weights, fallbackBoneIds);
      if (!ownerId) return;
      const candidate = {
        binding,
        bindingIndex,
        index: Math.max(0, Math.round(Number(pixel.index) || 0)),
        ownerId: String(ownerId),
        order: candidates.length
      };
      candidates.push(candidate);
      latestByKey.set(`${binding.layerIndex}:${candidate.index}`, candidate);
    });
  });
  const groups = new Map();
  candidates.forEach((candidate) => {
    if (latestByKey.get(`${candidate.binding.layerIndex}:${candidate.index}`) !== candidate) return;
    const groupKey = `${candidate.bindingIndex}:${candidate.ownerId}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: candidate.binding.boneIds?.length === 1 && candidate.binding.boneIds[0] === candidate.ownerId
          ? candidate.binding.id
          : `${candidate.binding.id}-${candidate.ownerId}`,
        type: candidate.binding.type,
        layerIndex: candidate.binding.layerIndex,
        boneIds: [candidate.ownerId],
        pixels: [],
        name: candidate.binding.name,
        order: candidate.order
      });
    }
    groups.get(groupKey).pixels.push({
      index: candidate.index,
      weights: singleBoneWeights(candidate.ownerId)
    });
  });
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((binding) => ({
      id: binding.id,
      type: binding.type,
      layerIndex: binding.layerIndex,
      boneIds: binding.boneIds,
      pixels: binding.pixels.sort((a, b) => a.index - b.index),
      name: binding.name
    }))
    .filter((binding) => binding.pixels.length);
};

const normalizePoseBones = (bones = {}) => Object.fromEntries(
  Object.entries(bones || {}).map(([id, pose]) => [
    String(id),
    {
      angle: Number.isFinite(pose?.angle) ? pose.angle : 0,
      dx: Number.isFinite(pose?.dx) ? pose.dx : 0,
      dy: Number.isFinite(pose?.dy) ? pose.dy : 0,
      scale: Number.isFinite(pose?.scale) ? Math.max(0.05, pose.scale) : 1
    }
  ])
);

const mergePoseBoneMaps = (base = {}, patch = {}) => {
  const bones = { ...base };
  Object.entries(patch || {}).forEach(([id, pose]) => {
    const previous = bones[id] || { angle: 0, dx: 0, dy: 0, scale: 1 };
    bones[id] = {
      angle: Number.isFinite(pose?.angle) ? pose.angle : previous.angle,
      dx: Number.isFinite(pose?.dx) ? pose.dx : previous.dx,
      dy: Number.isFinite(pose?.dy) ? pose.dy : previous.dy,
      scale: Number.isFinite(pose?.scale) ? Math.max(0.05, pose.scale) : previous.scale
    };
  });
  return bones;
};

const shortestAngleDelta = (from, to) => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

const lerpAngle = (from, to, t) => from + shortestAngleDelta(from, to) * Math.max(0, Math.min(1, t));

const springEase = (t, stiffness = 0.5) => {
  const clamped = Math.max(0, Math.min(1, t));
  const smooth = clamped * clamped * (3 - 2 * clamped);
  const amplitude = 0.06 + Math.max(0, Math.min(1, stiffness)) * 0.24;
  return smooth + Math.sin(Math.PI * clamped) * Math.sin(Math.PI * 4 * clamped) * amplitude;
};

export const createBone = (rig, start, end, options = {}) => {
  const next = cloneBoneRig(rig);
  const id = options.id || `bone-${Date.now().toString(36)}-${next.bones.length + 1}`;
  const safeStart = clonePoint(start);
  const safeEnd = clonePoint(end);
  const findJointAt = (point) => next.joints.find((joint) => (
    Math.abs(joint.x - point.x) <= POINT_EPSILON
    && Math.abs(joint.y - point.y) <= POINT_EPSILON
  )) || null;
  const addJoint = (point) => {
    const joint = { id: `joint-${Date.now().toString(36)}-${next.joints.length + 1}`, ...clonePoint(point) };
    next.joints.push(joint);
    return joint;
  };
  const parent = options.parentId ? next.bones.find((bone) => bone.id === String(options.parentId)) : null;
  const startJoint = options.startJointId
    ? next.joints.find((joint) => joint.id === String(options.startJointId))
    : (parent && Math.hypot(safeStart.x - parent.end.x, safeStart.y - parent.end.y) <= POINT_EPSILON
        ? next.joints.find((joint) => joint.id === parent.endJointId)
        : null);
  const resolvedStartJoint = startJoint || findJointAt(safeStart) || addJoint(safeStart);
  const resolvedEndJoint = (options.endJointId
    ? next.joints.find((joint) => joint.id === String(options.endJointId))
    : null) || findJointAt(safeEnd) || addJoint(safeEnd);
  const resolvedStart = clonePoint(resolvedStartJoint);
  const resolvedEnd = clonePoint(resolvedEndJoint);
  const dx = resolvedEnd.x - resolvedStart.x;
  const dy = resolvedEnd.y - resolvedStart.y;
  const jointMode = normalizeJointMode({ ...options, jointModeVersion: 2 });
  const bone = {
    id,
    name: options.name || `Bone ${next.bones.length + 1}`,
    parentId: options.parentId || null,
    startJointId: resolvedStartJoint.id,
    endJointId: resolvedEndJoint.id,
    start: resolvedStart,
    end: resolvedEnd,
    length: Math.max(1, Math.hypot(dx, dy)),
    angle: Math.atan2(dy, dx),
    locked: false,
    stretch: jointMode === 'stretch',
    jointMode,
    jointModeVersion: 2,
    jointSettings: normalizeJointSettings(options.jointSettings)
  };
  next.bones.push(bone);
  return { rig: next, bone };
};

const refreshBoneGeometry = (bone, jointById) => {
  const start = jointById.get(bone.startJointId) || bone.start;
  const end = jointById.get(bone.endJointId) || bone.end;
  bone.start = clonePoint(start);
  bone.end = clonePoint(end);
  const dx = bone.end.x - bone.start.x;
  const dy = bone.end.y - bone.start.y;
  bone.length = Math.max(1, Math.hypot(dx, dy));
  bone.angle = Math.atan2(dy, dx);
};

export const syncBoneRigFromJoints = (rig) => {
  const next = cloneBoneRig(rig);
  const jointById = new Map(next.joints.map((joint) => [joint.id, joint]));
  next.bones.forEach((bone) => refreshBoneGeometry(bone, jointById));
  return next;
};

export const getBoneJointUsageCount = (rig, jointId) => {
  const safeRig = normalizeBoneRig(rig);
  return safeRig.bones.reduce((count, bone) => (
    count
    + (bone.startJointId === jointId ? 1 : 0)
    + (bone.endJointId === jointId ? 1 : 0)
  ), 0);
};

export const buildBoneGraph = (rig = createDefaultBoneRig()) => {
  const safeRig = normalizeBoneRig(rig);
  const incomingByJoint = new Map();
  const outgoingByJoint = new Map();
  const parentById = new Map();
  const childrenByParent = new Map();
  const byId = new Map(safeRig.bones.map((bone) => [bone.id, bone]));
  safeRig.bones.forEach((bone) => {
    if (!incomingByJoint.has(bone.endJointId)) incomingByJoint.set(bone.endJointId, []);
    incomingByJoint.get(bone.endJointId).push(bone);
    if (!outgoingByJoint.has(bone.startJointId)) outgoingByJoint.set(bone.startJointId, []);
    outgoingByJoint.get(bone.startJointId).push(bone);
  });
  safeRig.bones.forEach((bone) => {
    const explicit = bone.parentId ? byId.get(bone.parentId) : null;
    const incoming = incomingByJoint.get(bone.startJointId) || [];
    const parent = explicit && explicit.endJointId === bone.startJointId
      ? explicit
      : incoming.find((entry) => entry.id !== bone.id) || null;
    parentById.set(bone.id, parent?.id || null);
    if (parent) {
      if (!childrenByParent.has(parent.id)) childrenByParent.set(parent.id, []);
      childrenByParent.get(parent.id).push(bone);
    }
  });
  return {
    rig: safeRig,
    byId,
    incomingByJoint,
    outgoingByJoint,
    parentById,
    childrenByParent,
    roots: safeRig.bones.filter((bone) => !parentById.get(bone.id))
  };
};

const clonePoseBone = (pose = {}) => ({
  angle: Number.isFinite(pose?.angle) ? pose.angle : 0,
  dx: Number.isFinite(pose?.dx) ? pose.dx : 0,
  dy: Number.isFinite(pose?.dy) ? pose.dy : 0,
  scale: Number.isFinite(pose?.scale) ? Math.max(0.05, pose.scale) : 1
});

export const constrainSharedJointPose = (rig, pose = {}) => {
  const graph = buildBoneGraph(rig);
  const bones = {};
  Object.entries(pose?.bones || {}).forEach(([boneId, bonePose]) => {
    bones[String(boneId)] = clonePoseBone(bonePose);
  });
  graph.outgoingByJoint.forEach((outgoing, jointId) => {
    if (outgoing.length < 2) return;
    if ((graph.incomingByJoint.get(jointId) || []).length) return;
    const keyed = outgoing.find((bone) => bones[bone.id]);
    if (!keyed) return;
    const canonical = bones[keyed.id];
    outgoing.forEach((bone) => {
      const previous = bones[bone.id] || { angle: 0, dx: 0, dy: 0, scale: 1 };
      bones[bone.id] = {
        ...previous,
        dx: canonical.dx || 0,
        dy: canonical.dy || 0
      };
    });
  });
  return { ...pose, bones };
};

const getChildBones = (rig, boneId) => {
  const graph = buildBoneGraph(rig);
  return graph.childrenByParent.get(String(boneId || '')) || [];
};

export const getBoneInfluenceSets = (rig, selectedBoneId) => {
  const graph = buildBoneGraph(rig);
  const safeRig = graph.rig;
  const selected = safeRig.bones.find((bone) => bone.id === String(selectedBoneId));
  const upstream = new Set();
  const downstream = new Set();
  if (!selected) return { selected: null, upstream, downstream };
  let parentId = graph.parentById.get(selected.id);
  while (parentId) {
    const parent = safeRig.bones.find((bone) => bone.id === parentId);
    if (!parent || upstream.has(parent.id)) break;
    upstream.add(parent.id);
    parentId = graph.parentById.get(parent.id);
  }
  const visitChildren = (boneId) => {
    (graph.childrenByParent.get(boneId) || []).forEach((child) => {
      if (downstream.has(child.id)) return;
      downstream.add(child.id);
      visitChildren(child.id);
    });
  };
  visitChildren(selected.id);
  return { selected: selected.id, upstream, downstream };
};

export const moveBoneJoint = (rig, jointId, point) => {
  const next = cloneBoneRig(rig);
  const joint = next.joints.find((entry) => entry.id === jointId);
  if (!joint) return next;
  joint.x = Number.isFinite(point?.x) ? point.x : joint.x;
  joint.y = Number.isFinite(point?.y) ? point.y : joint.y;
  const jointById = new Map(next.joints.map((entry) => [entry.id, entry]));
  next.bones.forEach((bone) => refreshBoneGeometry(bone, jointById));
  return next;
};

export const reverseBoneDirection = (rig, boneId) => {
  const next = cloneBoneRig(rig);
  const bone = next.bones.find((entry) => entry.id === String(boneId || ''));
  if (!bone) return next;
  const oldStartJointId = bone.startJointId;
  const oldEndJointId = bone.endJointId;
  bone.startJointId = oldEndJointId;
  bone.endJointId = oldStartJointId;
  const start = bone.start;
  bone.start = clonePoint(bone.end);
  bone.end = clonePoint(start);
  refreshBoneGeometry(bone, new Map(next.joints.map((joint) => [joint.id, joint])));
  const graph = buildBoneGraph(next);
  next.bones.forEach((entry) => {
    entry.parentId = graph.parentById.get(entry.id) || null;
  });
  return next;
};

export const solveTwoBoneIkPose = (rig, parentBoneId, childBoneId, target, options = {}) => {
  const safeRig = normalizeBoneRig(rig);
  const parent = safeRig.bones.find((bone) => bone.id === String(parentBoneId));
  const child = safeRig.bones.find((bone) => bone.id === String(childBoneId));
  if (!parent || !child || parent.endJointId !== child.startJointId) return null;
  const root = parent.start;
  const safeTarget = clonePoint(target);
  const parentLength = Math.max(1, parent.length || Math.hypot(parent.end.x - parent.start.x, parent.end.y - parent.start.y));
  const childLength = Math.max(1, child.length || Math.hypot(child.end.x - child.start.x, child.end.y - child.start.y));
  const dx = safeTarget.x - root.x;
  const dy = safeTarget.y - root.y;
  const rawDistance = Math.hypot(dx, dy);
  const maxReach = Math.max(1, parentLength + childLength - 0.0001);
  const minReach = Math.max(0.0001, Math.abs(parentLength - childLength) + 0.0001);
  const distance = Math.max(minReach, Math.min(maxReach, rawDistance || maxReach));
  const targetAngle = rawDistance > 0.0001 ? Math.atan2(dy, dx) : parent.angle;
  const parentCos = Math.max(-1, Math.min(1, (
    parentLength * parentLength + distance * distance - childLength * childLength
  ) / Math.max(0.0001, 2 * parentLength * distance)));
  const buildSolution = (bendSign) => {
    const parentOffset = Math.acos(parentCos) * bendSign;
    const parentGlobalAngle = targetAngle + parentOffset;
    const elbow = {
      x: root.x + Math.cos(parentGlobalAngle) * parentLength,
      y: root.y + Math.sin(parentGlobalAngle) * parentLength
    };
    const childGlobalAngle = Math.atan2(safeTarget.y - elbow.y, safeTarget.x - elbow.x);
    const parentDeltaAngle = parentGlobalAngle - parent.angle;
    return {
      [parent.id]: {
        angle: parentDeltaAngle,
        dx: 0,
        dy: 0,
        scale: 1
      },
      [child.id]: {
        angle: childGlobalAngle - child.angle - parentDeltaAngle,
        dx: 0,
        dy: 0,
        scale: 1
      }
    };
  };
  if (options.bendSign === -1 || options.bendSign === 1) return buildSolution(options.bendSign);
  const currentPose = options.currentPose?.bones || {};
  const score = (solution) => (
    Math.abs(shortestAngleDelta(currentPose[parent.id]?.angle || 0, solution[parent.id].angle))
    + Math.abs(shortestAngleDelta(currentPose[child.id]?.angle || 0, solution[child.id].angle))
  );
  const positive = buildSolution(1);
  const negative = buildSolution(-1);
  return score(negative) < score(positive) ? negative : positive;
};

export const removeOrphanBoneJoints = (rig) => {
  const next = cloneBoneRig(rig);
  const used = new Set();
  next.bones.forEach((bone) => {
    used.add(bone.startJointId);
    used.add(bone.endJointId);
  });
  next.joints = next.joints.filter((joint) => used.has(joint.id));
  return next;
};

export const getPoseForFrame = (rig, frameIndex) => {
  const safeRig = normalizeBoneRig(rig);
  return safeRig.poses.find((pose) => pose.frameIndex === frameIndex) || { frameIndex, bones: {} };
};

export const setBonePoseForFrame = (rig, frameIndex, boneId, posePatch = {}) => {
  const next = cloneBoneRig(rig);
  let pose = next.poses.find((entry) => entry.frameIndex === frameIndex);
  if (!pose) {
    pose = { frameIndex, bones: {} };
    next.poses.push(pose);
    next.poses.sort((a, b) => a.frameIndex - b.frameIndex);
  }
  const previous = pose.bones[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
  pose.bones[boneId] = {
    angle: Number.isFinite(posePatch.angle) ? posePatch.angle : previous.angle,
    dx: Number.isFinite(posePatch.dx) ? posePatch.dx : previous.dx,
    dy: Number.isFinite(posePatch.dy) ? posePatch.dy : previous.dy,
    scale: Number.isFinite(posePatch.scale) ? Math.max(0.05, posePatch.scale) : previous.scale
  };
  return next;
};

export const setBonePoseAtTime = (rig, timeMs, boneId, posePatch = {}) => {
  const next = cloneBoneRig(rig);
  const safeTime = Math.max(0, Math.round(Number(timeMs) || 0));
  let key = next.poseTimeline.find((entry) => entry.timeMs === safeTime);
  if (!key) {
    key = { id: `pose-${Date.now().toString(36)}-${next.poseTimeline.length + 1}`, timeMs: safeTime, interpolation: 'linear', bones: {} };
    next.poseTimeline.push(key);
    next.poseTimeline.sort((a, b) => a.timeMs - b.timeMs);
  }
  const previous = key.bones[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
  key.bones[boneId] = {
    angle: Number.isFinite(posePatch.angle) ? posePatch.angle : previous.angle,
    dx: Number.isFinite(posePatch.dx) ? posePatch.dx : previous.dx,
    dy: Number.isFinite(posePatch.dy) ? posePatch.dy : previous.dy,
    scale: Number.isFinite(posePatch.scale) ? Math.max(0.05, posePatch.scale) : previous.scale
  };
  key.bones = constrainSharedJointPose(next, { bones: key.bones }).bones;
  return next;
};

export const setPoseKeyAtTime = (rig, timeMs, bones = {}) => {
  const next = cloneBoneRig(rig);
  const safeTime = Math.max(0, Math.round(Number(timeMs) || 0));
  let key = next.poseTimeline.find((entry) => entry.timeMs === safeTime);
  if (!key) {
    key = { id: `pose-${Date.now().toString(36)}-${next.poseTimeline.length + 1}`, timeMs: safeTime, interpolation: 'linear', bones: {} };
    next.poseTimeline.push(key);
  }
  key.bones = constrainSharedJointPose(next, { bones: normalizePoseBones(bones) }).bones;
  next.poseTimeline = normalizePoseTimeline(next.poseTimeline);
  return next;
};

const collectOpaquePixelIndexes = (layerPixels, width, height) => {
  const indexes = [];
  if (!layerPixels) return indexes;
  for (let index = 0; index < width * height; index += 1) {
    if (layerPixels[index]) indexes.push(index);
  }
  return indexes;
};

const collectMaskIndexes = (mask, width, height) => {
  const indexes = [];
  if (!mask) return indexes;
  for (let index = 0; index < width * height; index += 1) {
    if (mask[index]) indexes.push(index);
  }
  return indexes;
};

const assignPixelsToSingleBone = (rig, layerIndex, boneId, pixelIndexes, type, name) => {
  const next = cloneBoneRig(rig);
  const ownerId = String(boneId || '');
  const indexSet = new Set((pixelIndexes || []).map((index) => Math.max(0, Math.round(Number(index) || 0))));
  if (!ownerId || !indexSet.size) return next;
  next.bindings = next.bindings
    .map((binding) => {
      if (binding.layerIndex !== layerIndex) return binding;
      return {
        ...binding,
        pixels: binding.pixels.filter((pixel) => !indexSet.has(pixel.index))
      };
    })
    .filter((binding) => binding.pixels.length);
  let binding = next.bindings.find((entry) => (
    entry.layerIndex === layerIndex
    && entry.type === type
    && entry.boneIds.length === 1
    && entry.boneIds[0] === ownerId
  ));
  if (!binding) {
    binding = {
      id: `binding-${Date.now().toString(36)}-${next.bindings.length + 1}`,
      type,
      layerIndex,
      boneIds: [ownerId],
      pixels: [],
      name
    };
    next.bindings.push(binding);
  }
  const existing = new Map(binding.pixels.map((pixel) => [pixel.index, pixel]));
  indexSet.forEach((index) => {
    existing.set(index, { index, weights: singleBoneWeights(ownerId) });
  });
  binding.pixels = [...existing.values()].sort((a, b) => a.index - b.index);
  next.bindings = normalizeExclusiveBindings(next.bindings);
  return next;
};

export const removePoseKeyAtTime = (rig, timeMs) => {
  const next = cloneBoneRig(rig);
  const safeTime = Math.max(0, Math.round(Number(timeMs) || 0));
  next.poseTimeline = next.poseTimeline.filter((entry) => entry.timeMs !== safeTime);
  return next;
};

export const getPoseKeyAtTime = (rig, timeMs) => {
  const safeRig = normalizeBoneRig(rig);
  const safeTime = Math.max(0, Math.round(Number(timeMs) || 0));
  return safeRig.poseTimeline.find((entry) => entry.timeMs === safeTime) || null;
};

export const samplePoseTimeline = (rig, timeMs) => {
  const safeRig = normalizeBoneRig(rig);
  const timeline = safeRig.poseTimeline;
  const safeTime = Math.max(0, Number(timeMs) || 0);
  if (!timeline.length) return { timeMs: safeTime, bones: {} };
  const effectivePoseAt = (keyIndex) => {
    let bones = {};
    for (let index = 0; index <= keyIndex; index += 1) {
      bones = mergePoseBoneMaps(bones, timeline[index].bones);
    }
    return constrainSharedJointPose(safeRig, { timeMs: timeline[keyIndex].timeMs, bones }).bones;
  };
  if (safeTime < timeline[0].timeMs) {
    return constrainSharedJointPose(safeRig, {
      timeMs: safeTime,
      bones: timeline[0].timeMs <= 0 ? effectivePoseAt(0) : {}
    });
  }
  const last = timeline[timeline.length - 1];
  if (safeTime >= last.timeMs) return constrainSharedJointPose(safeRig, { timeMs: safeTime, bones: effectivePoseAt(timeline.length - 1) });
  let previousIndex = 0;
  let nextIndex = timeline.length - 1;
  for (let index = 1; index < timeline.length; index += 1) {
    if (timeline[index].timeMs >= safeTime) {
      nextIndex = index;
      previousIndex = index - 1;
      break;
    }
  }
  const previous = timeline[previousIndex];
  const next = timeline[nextIndex];
  const previousBones = effectivePoseAt(previousIndex);
  const nextBones = effectivePoseAt(nextIndex);
  if (previous.interpolation === 'hold') {
    return constrainSharedJointPose(safeRig, { timeMs: safeTime, bones: previousBones });
  }
  const t = (safeTime - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs);
  const ids = new Set([...Object.keys(previousBones), ...Object.keys(nextBones)]);
  const bones = {};
  ids.forEach((id) => {
    const a = previousBones[id] || { angle: 0, dx: 0, dy: 0, scale: 1 };
    const b = nextBones[id] || a;
    const bone = safeRig.bones.find((entry) => entry.id === id);
    const scaleT = bone?.jointMode === 'spring' ? springEase(t, bone.jointSettings?.stiffness) : t;
    bones[id] = {
      angle: lerpAngle(a.angle, b.angle, t),
      dx: lerpValue(a.dx, b.dx, t),
      dy: lerpValue(a.dy, b.dy, t),
      scale: lerpValue(a.scale ?? 1, b.scale ?? 1, scaleT)
    };
  });
  return constrainSharedJointPose(safeRig, { timeMs: safeTime, bones });
};

const lerpValue = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

const isRestPose = (pose = {}, epsilon = 0.0001) => {
  const bones = pose?.bones || {};
  return Object.values(bones).every((bonePose) => (
    Math.abs(Number(bonePose?.angle) || 0) <= epsilon
    && Math.abs(Number(bonePose?.dx) || 0) <= epsilon
    && Math.abs(Number(bonePose?.dy) || 0) <= epsilon
    && Math.abs((Number.isFinite(bonePose?.scale) ? bonePose.scale : 1) - 1) <= epsilon
  ));
};

export const createLayerBinding = (rig, layerIndex, boneIds, width, height, layerPixels = null) => {
  const ownerId = boneIds.map(String).find(Boolean);
  return assignPixelsToSingleBone(
    rig,
    layerIndex,
    ownerId,
    collectOpaquePixelIndexes(layerPixels, width, height),
    'layer',
    `Layer ${layerIndex + 1}`
  );
};

export const createSelectionBinding = (rig, layerIndex, boneIds, mask, width, height) => {
  const ownerId = boneIds.map(String).find(Boolean);
  return assignPixelsToSingleBone(
    rig,
    layerIndex,
    ownerId,
    collectMaskIndexes(mask, width, height),
    'selection',
    `Selection ${(rig?.bindings?.length || 0) + 1}`
  );
};

export const addMaskToBoneBinding = (rig, layerIndex, boneId, mask, width, height) => {
  return assignPixelsToSingleBone(
    rig,
    layerIndex,
    boneId,
    collectMaskIndexes(mask, width, height),
    'selection',
    `Selection ${(rig?.bindings?.length || 0) + 1}`
  );
};

export const removeMaskFromBoneBinding = (rig, layerIndex, boneId, mask) => {
  const next = cloneBoneRig(rig);
  if (!boneId || !mask) return next;
  next.bindings = next.bindings.map((binding) => {
    if (binding.layerIndex !== layerIndex || !binding.boneIds.includes(boneId)) return binding;
    return {
      ...binding,
      pixels: binding.pixels.filter((pixel) => !mask[pixel.index])
    };
  }).filter((binding) => binding.type !== 'selection' || binding.pixels.length || !binding.boneIds.includes(boneId));
  return next;
};

export const getBoneAssignedMask = (rig, boneId, width, height, layerIndex = null) => {
  const safeRig = normalizeBoneRig(rig);
  const mask = new Uint8Array(width * height);
  safeRig.bindings.forEach((binding) => {
    if (!binding.boneIds.includes(boneId)) return;
    if (layerIndex != null && binding.layerIndex !== layerIndex) return;
    binding.pixels.forEach((pixel) => {
      if (pixel.index >= 0 && pixel.index < mask.length && pixel.weights?.[boneId] > 0) mask[pixel.index] = 1;
    });
  });
  return mask;
};

const buildPoseGeometryMap = (rig, frameIndexOrPose) => {
  const rawPose = typeof frameIndexOrPose === 'object' && frameIndexOrPose
    ? frameIndexOrPose
    : getPoseForFrame(rig, frameIndexOrPose);
  const graph = buildBoneGraph(rig);
  const safeRig = graph.rig;
  const pose = constrainSharedJointPose(safeRig, rawPose);
  const result = new Map();
  const computing = new Set();
  const compute = (bone) => {
    if (result.has(bone.id)) return result.get(bone.id);
    if (computing.has(bone.id)) {
      const fallback = {
        bone,
        pose: pose.bones?.[bone.id] || { angle: 0, dx: 0, dy: 0, scale: 1 },
        start: bone.start,
        end: bone.end,
        angle: bone.angle,
        deltaAngle: 0,
        scale: 1,
        children: graph.childrenByParent.get(bone.id) || []
      };
      result.set(bone.id, fallback);
      computing.delete(bone.id);
      return fallback;
    }
    computing.add(bone.id);
    const rawBonePose = pose.bones?.[bone.id] || { angle: 0, dx: 0, dy: 0, scale: 1 };
    const mode = bone.jointMode || 'rotate';
    const settings = bone.jointSettings || normalizeJointSettings();
    const poseAngle = mode === 'fixed'
      ? 0
      : (mode === 'hinge'
          ? Math.max(settings.minAngle, Math.min(settings.maxAngle, rawBonePose.angle || 0))
          : (rawBonePose.angle || 0));
    const parentId = graph.parentById.get(bone.id);
    const parent = parentId ? graph.byId.get(parentId) : null;
    const parentGeometry = parent ? compute(parent) : null;
    const inheritsParent = parentGeometry && parent?.endJointId === bone.startJointId;
    const allowFixedTranslation = mode !== 'fixed' || !inheritsParent;
    const bonePose = {
      angle: poseAngle,
      dx: allowFixedTranslation ? (rawBonePose.dx || 0) : 0,
      dy: allowFixedTranslation ? (rawBonePose.dy || 0) : 0,
      scale: rawBonePose.scale
    };
    const inheritedAngle = inheritsParent ? parentGeometry.deltaAngle : 0;
    const incomingAtStart = graph.incomingByJoint.get(bone.startJointId) || [];
    const outgoingAtStart = graph.outgoingByJoint.get(bone.startJointId) || [];
    const locksSharedBranch = inheritsParent && (incomingAtStart.length + outgoingAtStart.length > 2 || outgoingAtStart.length > 1);
    const startBase = inheritsParent ? parentGeometry.end : bone.start;
    const start = locksSharedBranch
      ? { ...parentGeometry.end }
      : {
          x: startBase.x + (bonePose.dx || 0),
          y: startBase.y + (bonePose.dy || 0)
        };
    const globalAngle = bone.angle + inheritedAngle + (bonePose.angle || 0);
    const canScale = mode === 'stretch' || mode === 'spring';
    const scale = canScale && Number.isFinite(bonePose.scale) ? Math.max(0.05, bonePose.scale) : 1;
    const end = {
      x: start.x + Math.cos(globalAngle) * bone.length * scale,
      y: start.y + Math.sin(globalAngle) * bone.length * scale
    };
    const geometry = {
      bone,
      pose: bonePose,
      start,
      end,
      angle: globalAngle,
      deltaAngle: globalAngle - bone.angle,
      scale,
      skinScale: mode === 'spring' ? 1 : scale,
      children: graph.childrenByParent.get(bone.id) || []
    };
    result.set(bone.id, geometry);
    computing.delete(bone.id);
    return geometry;
  };
  safeRig.bones.forEach((bone) => compute(bone));
  return Object.fromEntries([...result.entries()]);
};

const transformPointByBone = (x, y, entry, options = {}) => {
  if (!entry) return { x, y };
  const { bone } = entry;
  const sx = entry.start.x;
  const sy = entry.start.y;
  const localX = x - bone.start.x;
  const localY = y - bone.start.y;
  const restUx = Math.cos(bone.angle);
  const restUy = Math.sin(bone.angle);
  const restPx = -restUy;
  const restPy = restUx;
  const scale = entry.bone?.jointMode === 'spring' && options.allowSpringScale
    ? (entry.scale || 1)
    : (entry.skinScale ?? entry.scale ?? 1);
  const along = (localX * restUx + localY * restUy) * scale;
  const perp = localX * restPx + localY * restPy;
  const posedUx = Math.cos(entry.angle);
  const posedUy = Math.sin(entry.angle);
  const posedPx = -posedUy;
  const posedPy = posedUx;
  return {
    x: sx + along * posedUx + perp * posedPx,
    y: sy + along * posedUy + perp * posedPy
  };
};

export const getPosedBoneGeometry = (rig, frameIndexOrPose) => {
  const safeRig = normalizeBoneRig(rig);
  const transformMap = buildPoseGeometryMap(safeRig, frameIndexOrPose);
  return safeRig.bones.map((bone) => {
    const entry = transformMap[bone.id];
    const start = entry?.start || transformPointByBone(bone.start.x, bone.start.y, entry);
    const end = entry?.end || transformPointByBone(bone.end.x, bone.end.y, entry);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return {
      ...bone,
      start,
      end,
      length: Math.max(1, Math.hypot(dx, dy)),
      angle: Math.atan2(dy, dx)
    };
  });
};

const mergePosePatches = (basePose = {}, patches = {}) => {
  const bones = { ...(basePose.bones || {}) };
  Object.entries(patches || {}).forEach(([boneId, patch]) => {
    const previous = bones[boneId] || { angle: 0, dx: 0, dy: 0, scale: 1 };
    bones[boneId] = {
      angle: Number.isFinite(patch?.angle) ? patch.angle : previous.angle,
      dx: Number.isFinite(patch?.dx) ? patch.dx : previous.dx,
      dy: Number.isFinite(patch?.dy) ? patch.dy : previous.dy,
      scale: Number.isFinite(patch?.scale) ? Math.max(0.05, patch.scale) : previous.scale
    };
  });
  return { ...basePose, bones };
};

const getPosedJointPositionGroups = (posedBones) => {
  const groups = new Map();
  posedBones.forEach((bone) => {
    if (bone.startJointId) {
      if (!groups.has(bone.startJointId)) groups.set(bone.startJointId, []);
      groups.get(bone.startJointId).push(bone.start);
    }
    if (bone.endJointId) {
      if (!groups.has(bone.endJointId)) groups.set(bone.endJointId, []);
      groups.get(bone.endJointId).push(bone.end);
    }
  });
  return groups;
};

const pointDistance = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));

export const validateTwoBoneIkPose = (rig, parentBoneId, childBoneId, basePose = {}, patches = {}, options = {}) => {
  const safeRig = normalizeBoneRig(rig);
  const parentId = String(parentBoneId || '');
  const childId = String(childBoneId || '');
  const allowedIds = new Set([parentId, childId]);
  const patchIds = Object.keys(patches || {});
  if (!parentId || !childId || patchIds.some((id) => !allowedIds.has(id))) {
    return { ok: false, reason: 'unexpected-patch' };
  }
  const parent = safeRig.bones.find((bone) => bone.id === parentId);
  const child = safeRig.bones.find((bone) => bone.id === childId);
  if (!parent || !child || parent.endJointId !== child.startJointId) {
    return { ok: false, reason: 'not-two-bone-chain' };
  }
  if (safeRig.bones.some((bone) => bone.id !== childId && bone.startJointId === parent.endJointId)) {
    return { ok: false, reason: 'outside-chain-moved' };
  }

  const epsilon = Number.isFinite(options.epsilon) ? options.epsilon : 0.01;
  const before = getPosedBoneGeometry(safeRig, basePose);
  const after = getPosedBoneGeometry(safeRig, mergePosePatches(basePose, patches));
  const beforeById = new Map(before.map((bone) => [bone.id, bone]));
  const afterById = new Map(after.map((bone) => [bone.id, bone]));
  const parentBefore = beforeById.get(parentId);
  const parentAfter = afterById.get(parentId);
  if (!parentBefore || !parentAfter || pointDistance(parentBefore.start, parentAfter.start) > epsilon) {
    return { ok: false, reason: 'root-moved' };
  }

  for (const bone of safeRig.bones) {
    if (allowedIds.has(bone.id)) continue;
    const beforeBone = beforeById.get(bone.id);
    const afterBone = afterById.get(bone.id);
    if (!beforeBone || !afterBone) continue;
    if (pointDistance(beforeBone.start, afterBone.start) > epsilon || pointDistance(beforeBone.end, afterBone.end) > epsilon) {
      return { ok: false, reason: 'outside-chain-moved' };
    }
  }

  const afterJointGroups = getPosedJointPositionGroups(after);
  for (const points of afterJointGroups.values()) {
    if (points.length < 2) continue;
    const [first] = points;
    if (points.some((point) => pointDistance(point, first) > epsilon)) {
      return { ok: false, reason: 'shared-joint-split' };
    }
  }
  return { ok: true, reason: 'ok' };
};

const distanceToPoint = (x, y, point) => Math.hypot(x - point.x, y - point.y);

const distanceToSegment = (x, y, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return distanceToPoint(x, y, a);
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq));
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
};

const withAddedWeight = (weights, boneId, amount) => {
  if (!boneId || amount <= 0) return weights;
  const next = { ...weights };
  Object.keys(next).forEach((id) => {
    next[id] *= (1 - amount);
  });
  next[boneId] = (next[boneId] || 0) + amount;
  return normalizeWeights(next);
};

const softenWeightsForConnectedJoints = (rig, x, y, weights) => {
  const normalized = normalizeWeights(weights);
  const entries = Object.entries(normalized);
  if (entries.length !== 1) return normalized;
  const [boneId] = entries[0];
  const bone = rig.bones.find((entry) => entry.id === boneId);
  if (!bone) return normalized;
  const radius = Math.max(2.5, Math.min(12, bone.length * 0.8));
  let next = normalized;
  const parent = bone.parentId ? rig.bones.find((entry) => entry.id === bone.parentId) : null;
  if (parent && parent.endJointId === bone.startJointId && parent.jointMode !== 'spring') {
    const t = 1 - Math.min(1, distanceToPoint(x, y, bone.start) / radius);
    next = withAddedWeight(next, parent.id, t * 0.65);
  }
  const children = getChildBones(rig, bone.id).filter((child) => child.startJointId === bone.endJointId);
  if (children.length && bone.jointMode !== 'spring') {
    const t = 1 - Math.min(1, distanceToPoint(x, y, bone.end) / radius);
    const amount = (t * 0.65) / children.length;
    children.forEach((child) => {
      next = withAddedWeight(next, child.id, amount);
    });
  }
  return next;
};

const transformWeightedPoint = (x, y, weights, transformMap, vertex = null) => {
  const entries = Object.entries(normalizeWeights(weights));
  if (!entries.length) return { x, y };
  let outX = 0;
  let outY = 0;
  entries.forEach(([boneId, weight]) => {
    const point = transformPointByBone(x, y, transformMap[boneId], {
      allowSpringScale: vertex?.explicitBoneId === boneId
    });
    outX += point.x * weight;
    outY += point.y * weight;
  });
  return { x: outX, y: outY };
};

const getConnectedAutomaticWeights = (rig, x, y, nearestEntries) => {
  const nearest = nearestEntries[0];
  const second = nearestEntries.find((entry) => {
    const a = nearest.bone;
    const b = entry.bone;
    return a.startJointId === b.startJointId
      || a.startJointId === b.endJointId
      || a.endJointId === b.startJointId
      || a.endJointId === b.endJointId;
  });
  if (!second) return null;
  const sharedJointId = [nearest.bone.startJointId, nearest.bone.endJointId]
    .find((id) => id === second.bone.startJointId || id === second.bone.endJointId);
  const sharedJoint = rig.joints.find((joint) => joint.id === sharedJointId);
  const radius = Math.max(2.5, Math.min(12, Math.min(nearest.bone.length, second.bone.length) * 0.8));
  if (!sharedJoint || distanceToPoint(x, y, sharedJoint) > radius) return null;
  const nearestScore = 1 / Math.max(0.001, nearest.distance);
  const secondScore = 1 / Math.max(0.001, second.distance);
  const total = nearestScore + secondScore;
  return normalizeWeights({
    [nearest.bone.id]: nearestScore / total,
    [second.bone.id]: secondScore / total
  });
};

export const getAutomaticBoneWeightsForPixel = (rig, x, y, candidateBoneIds = null) => {
  const safeRig = normalizeBoneRig(rig);
  const allowed = candidateBoneIds?.size
    ? new Set([...candidateBoneIds].map(String))
    : null;
  const candidates = safeRig.bones
    .filter((bone) => !allowed || allowed.has(bone.id))
    .map((bone) => ({
      bone,
      distance: distanceToSegment(x, y, bone.start, bone.end)
    }))
    .sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return {};
  return getConnectedAutomaticWeights(safeRig, x, y, candidates) || { [candidates[0].bone.id]: 1 };
};

const buildLayerSkinMesh = (rig, layer, width, height, layerBindings) => {
  const explicitByIndex = new Map();
  const candidateBoneIds = new Set();
  layerBindings.forEach((binding) => {
    binding.boneIds.forEach((id) => {
      const boneId = resolveJointOwnerBoneId(rig, id);
      if (boneId) candidateBoneIds.add(boneId);
    });
    binding.pixels.forEach((pixel) => {
      Object.keys(pixel.weights || {}).forEach((id) => {
        const boneId = resolveJointOwnerBoneId(rig, id);
        if (boneId) candidateBoneIds.add(boneId);
      });
      explicitByIndex.set(pixel.index, normalizeWeights(pixel.weights));
    });
  });
  const vertices = new Map();
  for (let index = 0; index < width * height; index += 1) {
    const value = layer.pixels[index];
    if (!value) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const explicitWeights = explicitByIndex.get(index);
    const resolvedExplicitWeights = explicitWeights && Object.keys(explicitWeights).length
      ? resolveWeightsForSkinning(rig, explicitWeights)
      : null;
    const baseWeights = resolvedExplicitWeights
      ? resolvedExplicitWeights
      : getAutomaticBoneWeightsForPixel(rig, x + 0.5, y + 0.5, candidateBoneIds);
    const weights = softenWeightsForConnectedJoints(rig, x + 0.5, y + 0.5, baseWeights);
    vertices.set(index, {
      index,
      x,
      y,
      value,
      weights,
      explicit: Boolean(resolvedExplicitWeights),
      explicitBoneId: resolvedExplicitWeights ? getSingleWeightBoneId(resolvedExplicitWeights) : null
    });
  }
  return vertices;
};

const getSingleWeightBoneId = (weights = {}) => {
  const entries = Object.entries(normalizeWeights(weights));
  return entries.length === 1 && entries[0][1] > 0 ? entries[0][0] : null;
};

const renderSlideModeVertices = (targetLayer, width, height, vertices, transformMap) => {
  const slideVertices = [];
  vertices.forEach((vertex) => {
    const boneId = getSingleWeightBoneId(vertex.weights);
    const entry = boneId ? transformMap[boneId] : null;
    if (!vertex.explicit || entry?.bone?.jointMode !== 'slide') return;
    slideVertices.push({ vertex, entry });
  });
  slideVertices.forEach(({ vertex }) => {
    vertices.delete(vertex.index);
    targetLayer.pixels[vertex.index] = 0;
  });
  slideVertices.forEach(({ vertex, entry }) => {
    const dx = Math.round((entry.start?.x || 0) - (entry.bone?.start?.x || 0));
    const dy = Math.round((entry.start?.y || 0) - (entry.bone?.start?.y || 0));
    const x = vertex.x + dx;
    const y = vertex.y + dy;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    targetLayer.pixels[y * width + x] = vertex.value;
  });
};

const renderExactIntegerTranslation = (layers, width, height, rig, bindingsByLayer, transformMap) => {
  const output = layers.map(cloneLayer);
  const epsilon = 0.0001;
  const layerTranslations = new Map();
  for (const [layerIndex, layerBindings] of bindingsByLayer.entries()) {
    const sourceLayer = layers[layerIndex];
    if (!sourceLayer) continue;
    const vertices = buildLayerSkinMesh(rig, sourceLayer, width, height, layerBindings);
    if (!vertices.size) {
      layerTranslations.set(layerIndex, { vertices, dx: 0, dy: 0 });
      continue;
    }
    let layerDx = null;
    let layerDy = null;
    for (const vertex of vertices.values()) {
      const center = transformWeightedPoint(vertex.x + 0.5, vertex.y + 0.5, vertex.weights, transformMap, vertex);
      const dx = center.x - (vertex.x + 0.5);
      const dy = center.y - (vertex.y + 0.5);
      const roundedDx = Math.round(dx);
      const roundedDy = Math.round(dy);
      if (Math.abs(dx - roundedDx) > epsilon || Math.abs(dy - roundedDy) > epsilon) return null;
      if (layerDx == null) {
        layerDx = roundedDx;
        layerDy = roundedDy;
      } else if (layerDx !== roundedDx || layerDy !== roundedDy) {
        return null;
      }
    }
    layerTranslations.set(layerIndex, { vertices, dx: layerDx || 0, dy: layerDy || 0 });
  }
  let translated = false;
  for (const [layerIndex, translation] of layerTranslations.entries()) {
    const targetLayer = output[layerIndex];
    if (!targetLayer) continue;
    translation.vertices.forEach((vertex) => {
      targetLayer.pixels[vertex.index] = 0;
    });
    translation.vertices.forEach((vertex) => {
      const x = vertex.x + translation.dx;
      const y = vertex.y + translation.dy;
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      targetLayer.pixels[y * width + x] = vertex.value;
      if (translation.dx !== 0 || translation.dy !== 0) translated = true;
    });
  }
  return translated ? output : null;
};

export const deformLayersWithBones = (layers, width, height, rig, frameIndex) => {
  const safeRig = normalizeBoneRig(rig);
  if (!safeRig.bones.length || !safeRig.bindings.length) return layers.map(cloneLayer);
  const pose = typeof frameIndex === 'object' && frameIndex
    ? frameIndex
    : getPoseForFrame(safeRig, frameIndex);
  if (isRestPose(pose)) return layers.map(cloneLayer);
  const transformMap = buildPoseGeometryMap(safeRig, frameIndex);
  const output = layers.map(cloneLayer);
  const bindingsByLayer = new Map();
  safeRig.bindings.forEach((binding) => {
    if (!bindingsByLayer.has(binding.layerIndex)) bindingsByLayer.set(binding.layerIndex, []);
    bindingsByLayer.get(binding.layerIndex).push(binding);
  });
  const exactTranslation = renderExactIntegerTranslation(layers, width, height, safeRig, bindingsByLayer, transformMap);
  if (exactTranslation) return exactTranslation;
  bindingsByLayer.forEach((layerBindings, layerIndex) => {
    const sourceLayer = layers[layerIndex];
    const targetLayer = output[layerIndex];
    if (!sourceLayer || !targetLayer) return;
    const vertices = buildLayerSkinMesh(safeRig, sourceLayer, width, height, layerBindings);
    renderSlideModeVertices(targetLayer, width, height, vertices, transformMap);
    vertices.forEach((vertex) => {
      targetLayer.pixels[vertex.index] = 0;
    });
    vertices.forEach((vertex) => {
      rasterizeTransformedPixelQuad(targetLayer.pixels, width, height, vertex, transformMap);
      if (Object.keys(normalizeWeights(vertex.weights)).length > 1) {
        rasterizePixelStretchBridge(targetLayer.pixels, width, height, vertex, transformMap);
      }
    });
    vertices.forEach((vertex) => {
      const right = vertices.get(vertex.index + 1);
      if (right && right.y === vertex.y) {
        rasterizePixelMeshSpan(targetLayer.pixels, width, height, vertex, right, transformMap);
      }
      const down = vertices.get(vertex.index + width);
      if (down) {
        rasterizePixelMeshSpan(targetLayer.pixels, width, height, vertex, down, transformMap);
      }
    });
    fillSmallHoles(targetLayer.pixels, width, height);
  });
  return output;
};

export const deformLayersWithBonePose = (layers, width, height, rig, pose) => (
  deformLayersWithBones(layers, width, height, rig, pose)
);

export const bakeBoneFrames = (frames, width, height, rig) => frames.map((frame, frameIndex) => ({
  ...frame,
  layers: deformLayersWithBones(frame.layers, width, height, rig, frameIndex)
}));

export const bakeBoneTimelineFrames = (sourceFrame, width, height, rig, options = {}) => {
  const safeRig = normalizeBoneRig(rig);
  const frameDurationMs = Math.max(1, Math.round(Number(options.frameDurationMs) || Number(sourceFrame?.durationMs) || 120));
  const lastKey = safeRig.poseTimeline[safeRig.poseTimeline.length - 1] || null;
  const durationMs = Math.max(
    frameDurationMs,
    Math.round(Number(options.durationMs) || lastKey?.timeMs || frameDurationMs)
  );
  const frames = [];
  for (let timeMs = 0; timeMs <= durationMs; timeMs += frameDurationMs) {
    const pose = samplePoseTimeline(safeRig, timeMs);
    frames.push({
      durationMs: frameDurationMs,
      layers: deformLayersWithBonePose(sourceFrame.layers, width, height, safeRig, pose)
    });
  }
  return frames;
};

export const compositeBonePreview = (layers, width, height, rig, frameIndex) => (
  compositeLayers(deformLayersWithBones(layers, width, height, rig, frameIndex), width, height)
);

const getPixelChannels = (value) => ({
  r: (value >>> 24) & 0xff,
  g: (value >>> 16) & 0xff,
  b: (value >>> 8) & 0xff,
  a: value & 0xff
});

const packPixelChannels = ({ r, g, b, a }) => (
  ((Math.max(0, Math.min(255, Math.round(r))) << 24)
    | (Math.max(0, Math.min(255, Math.round(g))) << 16)
    | (Math.max(0, Math.min(255, Math.round(b))) << 8)
    | Math.max(0, Math.min(255, Math.round(a)))) >>> 0
);

const interpolatePixelColor = (from, to, t) => {
  const a = getPixelChannels(from);
  const b = getPixelChannels(to);
  const clampedT = Math.max(0, Math.min(1, t));
  return packPixelChannels({
    r: lerpValue(a.r, b.r, clampedT),
    g: lerpValue(a.g, b.g, clampedT),
    b: lerpValue(a.b, b.b, clampedT),
    a: lerpValue(a.a, b.a, clampedT)
  });
};

const writePixel = (pixels, width, height, x, y, value) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  pixels[y * width + x] = value >>> 0;
};

const stampPixel = (pixels, width, height, x, y, value) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = y * width + x;
  pixels[index] = value;
  if (x + 1 < width && !pixels[index + 1]) pixels[index + 1] = value;
  if (y + 1 < height && !pixels[index + width]) pixels[index + width] = value;
};

const drawPixelLine = (pixels, width, height, x0, y0, x1, y1, value, radius = 0) => {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const sx = ax < bx ? 1 : -1;
  const dy = -Math.abs(by - ay);
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  while (true) {
    for (let yy = -radius; yy <= radius; yy += 1) {
      for (let xx = -radius; xx <= radius; xx += 1) {
        if (xx * xx + yy * yy > radius * radius) continue;
        stampPixel(pixels, width, height, ax + xx, ay + yy, value);
      }
    }
    if (ax === bx && ay === by) break;
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
};

const drawInterpolatedPixelLine = (pixels, width, height, x0, y0, x1, y1, value0, value1) => {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const sx = ax < bx ? 1 : -1;
  const dy = -Math.abs(by - ay);
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
  let step = 0;
  while (true) {
    writePixel(pixels, width, height, ax, ay, interpolatePixelColor(value0, value1, step / steps));
    if (ax === bx && ay === by) break;
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
    step += 1;
  }
};

const rasterizePixelMeshSpan = (pixels, width, height, from, to, transformMap) => {
  const a = transformWeightedPoint(from.x + 0.5, from.y + 0.5, from.weights, transformMap, from);
  const b = transformWeightedPoint(to.x + 0.5, to.y + 0.5, to.weights, transformMap, to);
  drawInterpolatedPixelLine(
    pixels,
    width,
    height,
    a.x - 0.5,
    a.y - 0.5,
    b.x - 0.5,
    b.y - 0.5,
    from.value,
    to.value
  );
};

const rasterizePixelStretchBridge = (pixels, width, height, vertex, transformMap) => {
  const { x, y, weights, value } = vertex;
  const center = transformWeightedPoint(x + 0.5, y + 0.5, weights, transformMap, vertex);
  const startX = x;
  const startY = y;
  const endX = Math.round(center.x - 0.5);
  const endY = Math.round(center.y - 0.5);
  const distance = Math.hypot(endX - startX, endY - startY);
  if (distance < 1.25) return;
  const radius = distance > 8 ? 1 : 0;
  drawPixelLine(pixels, width, height, startX, startY, endX, endY, value, radius);
};

const rasterizeTransformedPixelQuad = (pixels, width, height, vertex, transformMap) => {
  const { x, y, weights, value } = vertex;
  const singleBoneId = getSingleWeightBoneId(weights);
  const singleEntry = singleBoneId ? transformMap[singleBoneId] : null;
  if (singleEntry && Math.abs((singleEntry.scale || 1) - 1) <= 0.0001 && Math.abs(singleEntry.deltaAngle || 0) <= 0.0001) {
    const center = transformWeightedPoint(x + 0.5, y + 0.5, weights, transformMap, vertex);
    const targetX = Math.round(center.x - 0.5);
    const targetY = Math.round(center.y - 0.5);
    if (Math.abs(center.x - 0.5 - targetX) <= 0.0001 && Math.abs(center.y - 0.5 - targetY) <= 0.0001) {
      writePixel(pixels, width, height, targetX, targetY, value);
      return;
    }
  }
  const corners = [
    transformWeightedPoint(x, y, weights, transformMap, vertex),
    transformWeightedPoint(x + 1, y, weights, transformMap, vertex),
    transformWeightedPoint(x + 1, y + 1, weights, transformMap, vertex),
    transformWeightedPoint(x, y + 1, weights, transformMap, vertex)
  ];
  const minX = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.x)) - 0.5));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...corners.map((point) => point.x)) - 0.5));
  const minY = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.y)) - 0.5));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...corners.map((point) => point.y)) - 0.5));
  let wrote = false;
  for (let row = minY; row <= maxY; row += 1) {
    for (let col = minX; col <= maxX; col += 1) {
      const point = { x: col + 0.5, y: row + 0.5 };
      if (!pointInTriangle(point, corners[0], corners[1], corners[2])
        && !pointInTriangle(point, corners[0], corners[2], corners[3])) {
        continue;
      }
      pixels[row * width + col] = value;
      wrote = true;
    }
  }
  const center = transformWeightedPoint(x + 0.5, y + 0.5, weights, transformMap, vertex);
  stampPixel(pixels, width, height, Math.round(center.x - 0.5), Math.round(center.y - 0.5), value);
};

const pointInTriangle = (p, a, b, c) => {
  const d1 = triangleSign(p, a, b);
  const d2 = triangleSign(p, b, c);
  const d3 = triangleSign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
};

const triangleSign = (p1, p2, p3) => (
  (p1.x - p3.x) * (p2.y - p3.y)
  - (p2.x - p3.x) * (p1.y - p3.y)
);

const fillSmallHoles = (pixels, width, height) => {
  const copy = new Uint32Array(pixels);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (copy[index]) continue;
      const left = copy[index - 1];
      const right = copy[index + 1];
      const up = copy[index - width];
      const down = copy[index + width];
      if (left && right) pixels[index] = left;
      else if (up && down) pixels[index] = up;
    }
  }
};

export const createBakedFrameLayer = (pixels, width, height, name = 'Bone Bake') => {
  const layer = createLayer(width, height, name);
  layer.pixels = new Uint32Array(pixels);
  return layer;
};
