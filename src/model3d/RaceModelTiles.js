import * as THREE from '../vendorBridge/three.js';
import {ModelAssetInstance,modelAssets} from './ModelAssets.js';
import {ensureModelSceneLighting} from './ModelRender.js';

export function clearRaceModelTiles(renderer){
  const group=renderer.modelTileGroup;if(!group)return;
  renderer.scene.remove(group);
  for(const source of group.userData.sources||[])source.dispose();
  for(const mesh of group.children)mesh.dispose?.();
  renderer.modelTileGroup=null;renderer.modelTileKey='';
}

// A single animated mesh per material is instanced across all matching tiles.
// Tile collision and terrain elevation remain owned by the Race surface model.
export function syncRaceModelTiles(renderer,placements,time=0,{library=modelAssets}={}){
  const ready=placements.flatMap(p=>{
    const model=library.get(p.binding?.ref);return model?[{...p,model,revision:library.entries.get(p.binding.ref)?.revision||0}]:[];
  });
  if(!ready.length){clearRaceModelTiles(renderer);return false;}
  const key=JSON.stringify(ready.map(p=>[p.key,p.position,p.size,p.binding,p.revision]));
  if(renderer.modelTileKey!==key){
    clearRaceModelTiles(renderer);
    const group=new THREE.Group();group.name='raceModelTiles';group.userData.sources=[];
    const batches=new Map();
    for(const p of ready){const k=JSON.stringify([p.binding,p.size]);if(!batches.has(k))batches.set(k,[]);batches.get(k).push(p);}
    for(const tiles of batches.values()){
      const first=tiles[0],source=new ModelAssetInstance();source.setModel(first.model,first.binding);group.userData.sources.push(source);
      const box=new THREE.Box3();for(const v of first.model.vertices)box.expandByPoint(new THREE.Vector3(...v.position));
      const size=box.isEmpty()?new THREE.Vector3(1,1,1):box.getSize(new THREE.Vector3()),center=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());
      const scale=first.size/Math.max(0.001,size.x,size.z);
      const fit=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,box.isEmpty()?0:-box.min.y,-center.z));
      source.root.updateMatrix();
      for(const child of source.root.children){
        const mesh=new THREE.InstancedMesh(child.geometry,child.material,tiles.length);mesh.name=`modelTile:${first.binding.ref}`;
        tiles.forEach((tile,index)=>{
          const matrix=new THREE.Matrix4().makeTranslation(...tile.position).multiply(fit).multiply(source.root.matrix);
          mesh.setMatrixAt(index,matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);
      }
    }
    renderer.scene.add(group);renderer.modelTileGroup=group;renderer.modelTileKey=key;ensureModelSceneLighting(renderer.scene);
  }
  for(const source of renderer.modelTileGroup.userData.sources){source.time=time*source.binding.speed;source.update(0);}
  for(const mesh of renderer.modelTileGroup.children)mesh.computeBoundingSphere();
  return true;
}
