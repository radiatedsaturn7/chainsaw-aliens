import * as THREE from '../vendorBridge/three.js';
import {normalizeModelBinding} from './ModelBinding.js';
import {jointMatrices} from './ModelRig.js';
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
    const bindingKey=JSON.stringify(binding);
    if(instance.model!==model||instance.raceBindingKey!==bindingKey){
      instance.setModel(model,binding);
      instance.raceBindingKey=bindingKey;
    }
    if(instance.binding.clip&&model.animations.some(clip=>clip.id===instance.binding.clip||clip.name===instance.binding.clip)){
      instance.time=Math.max(0,Number(session?.elapsedMs)||0)/1000*instance.binding.speed;
      instance.update(0);
    }
    if(wheelId)part.userData.spin.rotation.x=Number(session?.vehicleRenderState?.wheelPoses?.[wheelId]?.spinAngleRad)||0;
    return part;
  };
  parts.body=install(parts.body,car.art?.bodyModel);
  for(const [id,part] of Object.entries(parts.wheels||{}))parts.wheels[id]=install(part,car.art?.wheelModel,id);
}


const raceLampMount=/^(Headlight|Taillight)Mount_[LR]$/;
const mountedLampsByDocument=new WeakMap();
function mountedLampLocalFrames(model){
 if(!mountedLampsByDocument.has(model)){
  const mounts=model.joints.filter(j=>raceLampMount.test(j.name));
  const poses=mounts.length?jointMatrices(model):null;
  mountedLampsByDocument.set(model,new Map(mounts.map(j=>[j.name,poses.get(j.id)])));
 }
 return mountedLampsByDocument.get(model);
}
export function hasRaceModelLampMounts(car){
 const model=modelAssets.get(car?.art?.bodyModel?.ref);
 return Boolean(model&&mountedLampLocalFrames(model).size);
}
export function syncRaceModelLamps(part,session,{braking=false,enabled=true,defaultHeadlights=false}={}){
 const instance=part?.userData?.modelInstance;
 const root=instance?.root;
 if(!root)return false;
 let lights=instance.raceMountedLamps;
 if(instance.raceLampRoot!==root){
  for(const lamp of lights?.values()||[]){instance.object.remove(lamp);lamp.geometry.dispose();lamp.material.dispose();}
  lights=new Map();
  for(const [name,pose] of mountedLampLocalFrames(instance.model)){
    const isTail=name.startsWith('Tail');
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),
      new THREE.MeshStandardMaterial({color:isTail?0xa01719:0xfff1d2,
       emissive:isTail?0xf21821:0xffe7bd,emissiveIntensity:0}));
    lamp.name=name+'_glow';
    lamp.position.setFromMatrixPosition(pose);
    lamp.quaternion.setFromRotationMatrix(pose);
    lamp.translateZ(.008);
    lamp.scale.set(isTail?.037:.048,isTail?.075:.021,.012);
    const binding=instance.binding;
    const bindingTransform=new THREE.Matrix4().compose(new THREE.Vector3(...binding.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...binding.rotation)),new THREE.Vector3(...binding.scale));
    lamp.updateMatrix();lamp.matrix.premultiply(bindingTransform);lamp.matrix.decompose(lamp.position,lamp.quaternion,lamp.scale);
    instance.object.add(lamp);lights.set(name,lamp);
  }
  instance.raceMountedLamps=lights;instance.raceLampRoot=root;
 }
 const headlights=Boolean(session?.mechanical?.headlights??defaultHeadlights);
 for(const [name,lamp] of lights){
  const tail=name.startsWith('Tail');
  lamp.visible=enabled&&(headlights||tail&&braking);
  lamp.material.emissiveIntensity=tail?(braking?3.1:1.05):(session?.mechanical?.highBeams?2.9:1.95);
 }
 return lights.size>0;
}

// Build the same chassis-local placement used by the outer Three car, from
// live render data so road illumination still follows the chassis in cockpit.
export function getRaceModelLampWorldFrames(car,{x=0,y=0,z=0,yaw=0,pitch=0,roll=0}={}){
 const model=modelAssets.get(car?.art?.bodyModel?.ref);
 if(!model)return null;
 const named=mountedLampLocalFrames(model);
 if(!named.size)return null;
 const binding=normalizeModelBinding(car.art.bodyModel);
 const modelToWorld=new THREE.Matrix4().compose(
  new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,roll,'YXZ')),new THREE.Vector3(1,1,1))
  .multiply(new THREE.Matrix4().compose(new THREE.Vector3(...binding.position),
   new THREE.Quaternion().setFromEuler(new THREE.Euler(...binding.rotation)),new THREE.Vector3(...binding.scale)));
 const frame=(prefix,side)=>{
  const local=named.get(prefix+'Mount_'+side);
  if(!local)return null;
  const transform=modelToWorld.clone().multiply(local);
  return {position:new THREE.Vector3().setFromMatrixPosition(transform),
   forward:new THREE.Vector3(0,0,1).transformDirection(transform),
   up:new THREE.Vector3(0,1,0).transformDirection(transform)};
 };
 const pair=(prefix)=>{
  const l=frame(prefix,'L'),r=frame(prefix,'R');
  if(!l||!r)return null;
  return {left:l.position,right:r.position,forward:l.forward.add(r.forward).normalize(),up:l.up.add(r.up).normalize()};
 };
 return {front:pair('Headlight'),rear:pair('Taillight')};
}
