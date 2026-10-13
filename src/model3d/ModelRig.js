import * as THREE from '../vendorBridge/three.js';
import {modelId} from './ModelDocument.js';
const identity=[0,0,0,1];
const v=value=>new THREE.Vector3(...value);
const q=value=>new THREE.Quaternion(...value);
export function jointMatrices(model, pose={}) {
  const matrices=new Map(),visiting=new Set();
  const visit=id=>{
    if(matrices.has(id))return matrices.get(id);
    if(visiting.has(id))throw Error('Joint hierarchy contains a cycle');
    const joint=model.joints.find(j=>j.id===id);if(!joint)throw Error('Joint parent not found');
    visiting.add(id);const state=pose[id]||{};
    const matrix=new THREE.Matrix4().compose(v(state.position||joint.position),q(state.rotation||joint.rotation||identity),v(state.scale||joint.scale||[1,1,1]));
    if(joint.parent)matrix.premultiply(visit(joint.parent));
    visiting.delete(id);matrices.set(id,matrix);return matrix;
  };
  for(const joint of model.joints)visit(joint.id);return matrices;
}
export function addJoint(model, worldPosition, parent=null, name='Joint') {
  if(parent&&!model.joints.some(j=>j.id===parent))throw Error('Select a valid parent joint');
  const local=v(worldPosition);if(parent)local.applyMatrix4(jointMatrices(model).get(parent).clone().invert());
  const joint={id:modelId(model,'joint'),name,parent,position:local.toArray(),rotation:[...identity],scale:[1,1,1]};
  model.joints.push(joint);return joint.id;
}
export function assignVerticesToJoint(model, vertices, jointId, weight=1) {
  if(!model.joints.some(j=>j.id===jointId))throw Error('Select a joint');
  weight=Math.max(0,Math.min(1,Number(weight)));if(!Number.isFinite(weight))throw Error('Invalid weight');
  for(const vertex of model.vertices.filter(v=>vertices.includes(v.id))){
    const previous=(vertex.weights||[]).find(w=>w.joint===jointId);
    const other=(vertex.weights||[]).filter(w=>w.joint!==jointId),total=other.reduce((n,w)=>n+w.weight,0);
    vertex.weights=other.map(w=>({...w,weight:total?w.weight*(1-weight)/total:0})).filter(w=>w.weight>0);
    if(weight>0)vertex.weights.push({...(previous||{}),joint:jointId,weight});
  }
}
export function addAnimation(model,name='Animation',duration=1){
  const clip={id:modelId(model,'clip'),name,duration:Math.max(0.01,duration),fps:24,loop:true,tracks:{}};model.animations.push(clip);return clip.id;
}
export function setKeyframe(model,clipId,jointId,time,transform){
  const clip=model.animations.find(c=>c.id===clipId),joint=model.joints.find(j=>j.id===jointId);
  if(!clip||!joint)throw Error('Select an animation and joint');
  if(!Number.isFinite(time)||time<0)throw Error('Invalid keyframe time');
  clip.duration=Math.max(clip.duration,time);clip.tracks[jointId] ||= [];
  const key={time,position:[...(transform.position||joint.position)],rotation:q(transform.rotation||joint.rotation||identity).normalize().toArray(),scale:[...(transform.scale||joint.scale||[1,1,1])]};
  clip.tracks[jointId]=clip.tracks[jointId].filter(k=>Math.abs(k.time-time)>1e-6).concat(key).sort((a,b)=>a.time-b.time);
}
export function sampleAnimation(model,clipId,time,{loop=true}={}){
  const clip=model.animations.find(c=>c.id===clipId);if(!clip)return {};
  const t=loop&&clip.loop?((time%clip.duration)+clip.duration)%clip.duration:Math.max(0,Math.min(clip.duration,time));const pose={};
  for(const [id,keys] of Object.entries(clip.tracks)){
    if(!keys.length)continue;let a=keys[0],b=keys.at(-1);
    if(t<=a.time)b=a;else if(t>=b.time)a=b;else for(let i=1;i<keys.length;i++)if(keys[i].time>=t){a=keys[i-1];b=keys[i];break;}
    const alpha=a===b?0:(t-a.time)/(b.time-a.time);
    pose[id]={position:v(a.position).lerp(v(b.position),alpha).toArray(),rotation:q(a.rotation).slerp(q(b.rotation),alpha).normalize().toArray(),scale:v(a.scale).lerp(v(b.scale),alpha).toArray()};
  }return pose;
}
export function skinVertices(model,pose={}){
  const bind=jointMatrices(model),animated=jointMatrices(model,pose),skin=new Map([...bind].map(([id,matrix])=>[id,animated.get(id).clone().multiply(matrix.clone().invert())]));
  return model.vertices.map(vertex=>{
    const output=new THREE.Vector3();let total=0;
    for(const influence of vertex.weights||[]){const matrix=influence.bindMatrix&&animated.has(influence.joint)?animated.get(influence.joint).clone().multiply(new THREE.Matrix4().fromArray(influence.bindMatrix)):skin.get(influence.joint);if(!matrix||!(influence.weight>0))continue;output.addScaledVector(v(vertex.position).applyMatrix4(matrix),influence.weight);total+=influence.weight;}
    if(total<1)output.addScaledVector(v(vertex.position),1-total);else if(total>1)output.divideScalar(total);
    return {id:vertex.id,position:output.toArray()};
  });
}
export function solveIK(model,pose,endJointId,target,{chainLength=3,iterations=24,tolerance=0.001}={}){
  const end=model.joints.find(j=>j.id===endJointId);if(!end)throw Error('Select the chain end joint');
  const result=structuredClone(pose),goal=v(target),chain=[];let parent=end.parent;
  while(parent&&chain.length<chainLength){const joint=model.joints.find(j=>j.id===parent);if(!joint)break;chain.push(joint);parent=joint.parent;}
  for(let step=0;step<iterations;step++){
    for(const joint of chain){
      const matrices=jointMatrices(model,result),origin=new THREE.Vector3().setFromMatrixPosition(matrices.get(joint.id));
      const tip=new THREE.Vector3().setFromMatrixPosition(matrices.get(end.id));if(tip.distanceTo(goal)<tolerance)return result;
      const from=tip.sub(origin),to=goal.clone().sub(origin);if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)continue;
      const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
      const world=new THREE.Quaternion().setFromRotationMatrix(matrices.get(joint.id));
      const parentRotation=joint.parent?new THREE.Quaternion().setFromRotationMatrix(matrices.get(joint.parent)):new THREE.Quaternion();
      result[joint.id]={...(result[joint.id]||{}),rotation:parentRotation.invert().multiply(delta).multiply(world).normalize().toArray()};
    }
  }return result;
}

function matrixTransform(matrix){
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  matrix.decompose(position,rotation,scale);return {position:position.toArray(),rotation:rotation.toArray(),scale:scale.toArray()};
}
export function reparentJoint(model,jointId,parent=null){
  const joint=model.joints.find(j=>j.id===jointId);if(!joint)throw Error('Select a joint');
  if(parent===joint.parent)return;
  let ancestor=parent;
  while(ancestor){if(ancestor===jointId)throw Error('A joint cannot be parented to its descendant');const next=model.joints.find(j=>j.id===ancestor);if(!next)throw Error('Parent joint not found');ancestor=next.parent;}
  const bind=jointMatrices(model),local=bind.get(jointId).clone();
  if(parent)local.premultiply(bind.get(parent).clone().invert());
  // Bake the old world motion into the new parent's local coordinates.
  const tracks=new Map();
  for(const clip of model.animations){
    if(!Object.keys(clip.tracks).length)continue;
    const times=new Set([0,clip.duration,...Object.values(clip.tracks).flatMap(keys=>keys.map(k=>k.time))]);
    for(let t=0;t<clip.duration;t+=1/Math.max(1,Number(clip.fps)||24))times.add(t);
    const keys=[...times].sort((a,b)=>a-b).map(time=>{
      const world=jointMatrices(model,sampleAnimation(model,clip.id,time,{loop:false})),matrix=world.get(jointId).clone();
      if(parent)matrix.premultiply(world.get(parent).clone().invert());
      return {time,...matrixTransform(matrix)};
    });tracks.set(clip.id,keys);
  }
  Object.assign(joint,matrixTransform(local),{parent});
  for(const clip of model.animations)if(tracks.has(clip.id))clip.tracks[jointId]=tracks.get(clip.id);
}
export function deleteJoint(model,jointId){
  const joint=model.joints.find(j=>j.id===jointId);if(!joint)throw Error('Select a joint');
  for(const child of model.joints.filter(j=>j.parent===jointId))reparentJoint(model,child.id,joint.parent);
  model.joints=model.joints.filter(j=>j.id!==jointId);
  for(const clip of model.animations)delete clip.tracks[jointId];
  for(const vertex of model.vertices){const weights=(vertex.weights||[]).filter(w=>w.joint!==jointId),total=weights.reduce((n,w)=>n+w.weight,0);vertex.weights=weights.map(w=>({...w,weight:total?w.weight/total:0}));}
}
