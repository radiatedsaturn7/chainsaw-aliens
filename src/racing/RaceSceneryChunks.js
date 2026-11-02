import * as THREE from '../vendorBridge/three.js';
import { mixTapeRotation } from '../radio/MixTapePickup.js';

let buildSequence = 0;

function animate(renderer, time) {
  for (const entry of renderer.dynamicDoodadAnimations || []) {
    if (entry.userData.mixTape) entry.rotation.y = entry.userData.baseYaw + mixTapeRotation(time);
    const instance = entry.userData.modelInstance;
    if (instance) { instance.time = time * instance.binding.speed; instance.update(0); }
  }
}

function report(renderer, stats) {
  if (!stats) return;
  stats.threeDoodads = renderer.dynamicDoodadCount;
  stats.drawCalls = (Number(stats.drawCalls) || 0) + renderer.dynamicDoodadDrawCalls;
  stats.polygons = (Number(stats.polygons) || 0) + renderer.dynamicDoodadPolygons;
}

export function syncManagedRaceSceneryChunks(editor, renderer, state, sceneKey, stats = null) {
  const sameScene = renderer.dynamicDoodadGroup
    && renderer.dynamicDoodadManagedState === state
    && renderer.dynamicDoodadManagedGeneration === state.generation
    && renderer.dynamicDoodadSceneKey === sceneKey;
  const time = Number(state.session.elapsedMs || 0) / 1000;
  if (sameScene && renderer.dynamicDoodadVisibilityRevision === state.visibilityRevision) {
    animate(renderer, time);
    if (!renderer.dynamicDoodadGroup.parent) renderer.scene.add(renderer.dynamicDoodadGroup);
    report(renderer, stats);
    if (stats) stats.dynamicDoodadCacheHits = (Number(stats.dynamicDoodadCacheHits) || 0) + 1;
    return renderer.dynamicDoodadCount > 0;
  }
  if (!sameScene) {
    editor.clearRaceThreeDynamicDoodads(renderer);
    renderer.dynamicDoodadGroup = new THREE.Group();
    renderer.dynamicDoodadGroup.name = 'raceDynamicDoodads';
    renderer.scene.add(renderer.dynamicDoodadGroup);
    renderer.dynamicDoodadChunks = new Map();
    renderer.dynamicDoodadBuildSequence = ++buildSequence;
  }
  let rebuilt = 0, placements = 0;
  for (const chunk of state.chunks.values()) {
    let holder = renderer.dynamicDoodadChunks.get(chunk.key);
    if (!holder) {
      holder = {
        scene: renderer.dynamicDoodadGroup,
        doodadResourceOwner: renderer,
        dynamicDoodadGroup: null,
        chunkRevision: -1
      };
      renderer.dynamicDoodadChunks.set(chunk.key, holder);
    }
    if (holder.chunkRevision === chunk.revision) continue;
    editor.addRaceThreeDoodads(holder, {
      chunkSprites: chunk.visible,
      chunkSceneKey: `${renderer.dynamicDoodadBuildSequence}:${chunk.key}:${chunk.revision}`
    });
    holder.chunkRevision = chunk.revision;
    rebuilt += 1;
    placements += chunk.visible.length;
  }
  renderer.dynamicDoodadAnimations = [];
  renderer.dynamicDoodadCount = 0;
  renderer.dynamicDoodadDrawCalls = 0;
  renderer.dynamicDoodadPolygons = 0;
  for (const holder of renderer.dynamicDoodadChunks.values()) {
    renderer.dynamicDoodadCount += Number(holder.dynamicDoodadCount || 0);
    renderer.dynamicDoodadDrawCalls += Number(holder.dynamicDoodadDrawCalls || 0);
    renderer.dynamicDoodadPolygons += Number(holder.dynamicDoodadPolygons || 0);
    for (const animation of holder.dynamicDoodadAnimations || []) renderer.dynamicDoodadAnimations.push(animation);
  }
  renderer.dynamicDoodadManagedState = state;
  renderer.dynamicDoodadManagedGeneration = state.generation;
  renderer.dynamicDoodadSceneKey = sceneKey;
  renderer.dynamicDoodadVisibilityRevision = state.visibilityRevision;
  animate(renderer, time);
  report(renderer, stats);
  if (stats) {
    stats.dynamicDoodadRebuilds = (Number(stats.dynamicDoodadRebuilds) || 0) + 1;
    stats.dynamicDoodadChunkRebuilds = (Number(stats.dynamicDoodadChunkRebuilds) || 0) + rebuilt;
    stats.dynamicDoodadRebuiltPlacements = (Number(stats.dynamicDoodadRebuiltPlacements) || 0) + placements;
  }
  return renderer.dynamicDoodadCount > 0;
}
