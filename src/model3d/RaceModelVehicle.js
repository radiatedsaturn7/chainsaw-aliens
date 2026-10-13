import * as THREE from '../vendorBridge/three.js';
import {ModelAssetInstance,modelAssets} from './ModelAssets.js';

// Replace procedural parts in the existing vehicle scene. Parent transforms
// continue to come from physics (including suspension, steering and body roll).
export function updateRaceModelParts(group,car,session,{library=modelAssets}={}){
  const parts=group.userData.parts;
  const install=(part,binding,wheelId=null)=>{
    if(!part||!binding?.ref)return part;
    const model=library.get(binding.ref);if(!model)return part;
    let instance=part.userData.modelInstance;
    if(!instance){
      const replacement=new THREE.Group();replacement.name=part.name;
      replacement.position.copy(part.position);replacement.rotation.order=part.rotation.order;replacement.quaternion.copy(part.quaternion);
      group.remove(part);part.geometry?.dispose();
      if(part.material&&!part.material.__raceSharedMaterial)part.material.dispose();
      instance=new ModelAssetInstance();replacement.userData.modelInstance=instance;
      const spin=new THREE.Group();spin.add(instance.object);replacement.add(spin);replacement.userData.spin=spin;
      group.add(replacement);part=replacement;
    }
    instance.setModel(model,binding);
    instance.time=Math.max(0,Number(session?.elapsedMs)||0)/1000*instance.binding.speed;
    instance.update(0);
    if(wheelId)part.userData.spin.rotation.x=Number(session?.vehicleRenderState?.wheelPoses?.[wheelId]?.spinAngleRad)||0;
    return part;
  };
  parts.body=install(parts.body,car.art?.bodyModel);
  for(const [id,part] of Object.entries(parts.wheels||{}))parts.wheels[id]=install(part,car.art?.wheelModel,id);
}
