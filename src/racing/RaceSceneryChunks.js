import * as THREE from '../vendorBridge/three.js';
import { mixTapeRotation } from '../radio/MixTapePickup.js';

let buildSequence = 0;

// Count actual renderable meshes, including those nested in a native prop.
// These are submitted geometry counts, not a measurement of GPU frame time.
export function getRaceSceneryMeshStats(group) {
  let drawCalls = 0, polygons = 0;
  group.traverseVisible(entry => {
    if (!entry.isMesh) return;
    const { geometry, material } = entry;
    if (Array.isArray(material)) {
      drawCalls += geometry.groups.length;
      polygons += geometry.groups.reduce((sum, group) => sum + Math.floor(group.count / 3), 0);
    } else {
      drawCalls += 1;
      polygons += Math.floor((geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3) * (entry.isInstancedMesh ? entry.count : 1);
    }
  });
  return { drawCalls, polygons };
}

export function isRaceSceneryAnimated(entry) {
  return Boolean(entry.userData?.mixTape || (entry.userData?.modelInstance && !entry.userData.staticDoodadModel));
}

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

// An image arriving changes only that image's meshes, not terrain placement or
// other artwork in the same spatial chunk. Model/hitbox edits use the full path.
function refreshChunkArtwork(editor,renderer,holder,chunk,previous,next,key) {
  if(!holder.dynamicDoodadGroup||holder.chunkRevision!==chunk.revision)return null;
  for(const ref of holder.modelRefs||[])if(previous.modelKeys.get(ref)!==next.modelKeys.get(ref))return null;
  const changed=new Set();
  for(const ref of holder.artRefs||[])if(previous.artKeys.get(ref)!==next.artKeys.get(ref))changed.add(ref);
  const sprites=[];
  for(const sprite of chunk.visible){
    const def=editor.getRaceDoodadForScenery(sprite);
    if(!changed.has(String(def.artRef||sprite.artRef||'').trim()))continue;
    if(def.model?.ref||sprite.previewHitbox)return null;
    sprites.push(sprite);
  }
  const group=holder.dynamicDoodadGroup,retiredMaterials=new Set();
  for(const mesh of [...group.children])if(changed.has(mesh.userData.sceneryArtRef)){
    group.remove(mesh);mesh.geometry?.dispose();
    if(mesh.material&&!mesh.material.__raceSharedMaterial)retiredMaterials.add(mesh.material);
  }
  const temporary={scene:group,doodadResourceOwner:renderer};
  editor.addRaceThreeDoodads(temporary,{chunkSprites:sprites,chunkSceneKey:key});
  const added=temporary.dynamicDoodadGroup;
  if(added){for(const mesh of [...added.children])group.add(mesh);group.remove(added);}
  for(const material of renderer.doodadMaterialCache?.values()||[])retiredMaterials.delete(material);
  if(retiredMaterials.size){
    renderer.dynamicDoodadGroup.traverse(entry=>retiredMaterials.delete(entry.material));
    for(const material of retiredMaterials)material.dispose?.();
  }
  holder.dynamicDoodadAnimations=[];
  group.traverse(entry=>{if(isRaceSceneryAnimated(entry))holder.dynamicDoodadAnimations.push(entry);});
  holder.dynamicDoodadCount=group.children.length?chunk.visible.length:0;
  const meshStats=getRaceSceneryMeshStats(group);
  holder.dynamicDoodadDrawCalls=meshStats.drawCalls;
  holder.dynamicDoodadPolygons=meshStats.polygons;
  return sprites.length;
}

// Destruction of soft vegetation changes only visibility. Retain all neighboring
// props and their GPU resources; restore the exact triangles if IDs are cleared.
export function updateSoftVegetationVisibility(holder, visible) {
  if (!holder.visibilityIds || !holder.dynamicDoodadGroup) return false;
  const next = new Set(visible.map(sprite => sprite.id));
  const changed = new Set();
  for (const id of holder.visibilityIds) if (!next.has(id)) changed.add(id);
  for (const id of next) if (!holder.visibilityIds.has(id)) changed.add(id);
  const ranges = new Map();
  holder.dynamicDoodadGroup.traverse(mesh => {
    for (const range of mesh.userData.softVegetation || []) ranges.set(range.id, {mesh, range});
  });
  for (const id of changed) if (!ranges.has(id)) return false;
  for (const id of changed) {
    const {mesh, range} = ranges.get(id), attribute = mesh.geometry.getAttribute('position');
    const array = attribute.array;
    if (next.has(id)) {
      if (range.original) array.set(range.original, range.start);
    } else {
      range.original ||= array.slice(range.start, range.start + range.count);
      for (let i=0;i<range.count;i+=3) {
        array[range.start+i]=range.original[0];
        array[range.start+i+1]=range.original[1];
        array[range.start+i+2]=range.original[2];
      }
    }
    attribute.addUpdateRange(range.start, range.count);
    attribute.needsUpdate = true;
  }
  holder.visibilityIds = next;
  holder.dynamicDoodadCount = visible.length;
  return true;
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
  const snapshot=editor.raceDoodadSceneSnapshot;
  const sameGeometry=renderer.dynamicDoodadGroup
    && renderer.dynamicDoodadManagedState===state
    && renderer.dynamicDoodadManagedGeneration===state.generation
    && snapshot?.source===state.doodads
    && renderer.dynamicDoodadAssetSnapshot?.surfaceRevision===snapshot.surfaceRevision;
  const previousAssets=renderer.dynamicDoodadAssetSnapshot;
  const assetChanged=holder=>{
    if(sameScene)return false;
    if(!sameGeometry)return true;
    for(const ref of holder.artRefs||[])if(previousAssets.artKeys.get(ref)!==snapshot.artKeys.get(ref))return true;
    for(const ref of holder.modelRefs||[])if(previousAssets.modelKeys.get(ref)!==snapshot.modelKeys.get(ref))return true;
    return false;
  };
  if (!sameScene && !sameGeometry) {
    editor.clearRaceThreeDynamicDoodads(renderer);
    renderer.dynamicDoodadGroup = new THREE.Group();
    renderer.dynamicDoodadGroup.name = 'raceDynamicDoodads';
    renderer.scene.add(renderer.dynamicDoodadGroup);
    renderer.dynamicDoodadChunks = new Map();
  }
  if(!sameScene)renderer.dynamicDoodadBuildSequence=++buildSequence;
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
    if (holder.chunkRevision === chunk.revision && !assetChanged(holder)) continue;
    if (sameScene && updateSoftVegetationVisibility(holder, chunk.visible)) {
      holder.chunkRevision = chunk.revision;
      if (stats) stats.dynamicDoodadVisibilityUpdates = (stats.dynamicDoodadVisibilityUpdates || 0) + 1;
      continue;
    }
    const chunkSceneKey=`${renderer.dynamicDoodadBuildSequence}:${chunk.key}:${chunk.revision}`;
    const refreshed=sameGeometry&&!sameScene
      ? refreshChunkArtwork(editor,renderer,holder,chunk,previousAssets,snapshot,chunkSceneKey):null;
    if(refreshed===null)editor.addRaceThreeDoodads(holder, {
      chunkSprites: chunk.visible, chunkSceneKey
    });
    holder.artRefs=new Set();holder.modelRefs=new Set();
    for(const sprite of chunk.visible){
      const definition=editor.getRaceDoodadForScenery(sprite);
      holder.artRefs.add(String(definition.artRef||sprite.artRef||'').trim());
      if(definition.model?.ref)holder.modelRefs.add(definition.model.ref);
    }
    holder.chunkRevision = chunk.revision;
    holder.visibilityIds = new Set(chunk.visible.map(sprite => sprite.id));
    rebuilt += 1;
    placements += refreshed??chunk.visible.length;
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
  renderer.dynamicDoodadAssetSnapshot = snapshot;
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
