import * as THREE from '../vendorBridge/three.js';

// Batch within the existing spatial chunk, preserving its culling/destruction
// lifecycle. Keep placement metadata and source ownership for editing/cleanup.
export function batchStaticDoodadModels(group) {
  const batches = new Map();
  for (const placement of group.children) {
    const instance = placement.userData.modelInstance;
    if (!instance || !placement.userData.staticDoodadModel || placement.userData.mixTape) continue;
    if (instance.root.children.some(mesh => mesh.material.transparent)) continue;
    let entries = batches.get(instance.model);
    if (!entries) batches.set(instance.model, entries = []);
    entries.push(placement);
  }
  for (const placements of batches.values()) {
    if (placements.length < 2) continue;
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    if (placements.some(p => p.userData.modelInstance.root.children.some(mesh => mesh.matrixWorld.determinant() <= 0))) continue;
    const first = placements[0].userData.modelInstance.root;
    for (let i = 0; i < first.children.length; i++) {
      const source = first.children[i];
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
      mesh.name = `staticModelBatch:${first.name}:${i}`;
      mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
      mesh.userData.borrowedModelResources = true;
      mesh.userData.spriteIds = placements.map(p => p.userData.spriteId);
      placements.forEach((p, index) => {
        const child = p.userData.modelInstance.root.children[i];
        mesh.setMatrixAt(index, inverse.clone().multiply(child.matrixWorld));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      group.add(mesh);
    }
    for (const p of placements) p.userData.modelInstance.root.visible = false;
  }
}
