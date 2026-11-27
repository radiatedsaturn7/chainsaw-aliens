import * as THREE from '../vendorBridge/three.js';
import {normalizeModelBinding,modelWheelBindingForAxle,placeOutboardWheelFace} from './ModelBinding.js';
import {automotiveTrackProfile} from './AutomotiveMaterials.js';
import {wrxPilotPart} from './WrxVisualPilot.js';
import {isStudioRosterWheel} from './StudioRosterModels.js';
import {isWrxStudioDocument} from './WrxBundledModels.js';
import {syncWrxBrakeHardware} from './WrxBrakeHardware.js';
import {isNativeModelWheelCar,hasAuthoritativeModelWheelPose} from './ModelWheel.js';
import {jointMatrices} from './ModelRig.js';
import {ModelAssetInstance,modelAssets} from './ModelAssets.js';

const visualWheelIds=['fl','fr','rl','rr'];
const wheelCentroidByDocument=new WeakMap();
const anchorScratch=new THREE.Vector3(),wheelScratch=new THREE.Vector3(),qScratch=new THREE.Quaternion();

// The legacy/startup render path can have four world wheel centers before
// it has an authoritative chassis snapshot. Keep the exact WRX model on
// those wheels instead of applying the authored CG offset to a route origin.
// Only the visual root is corrected; wheel positions, pitch and roll,
// authoritative physics poses, control inputs and collision stay intact.
export function fitWrxFallbackVisualBody(parts,car,session){
  if(car?.art?.bodyModel?.ref!=='Field-Forgetmenot'||(typeof location!=='undefined'&&!wrxPilotPart(car.art.bodyModel.ref)))return false;
  const body=parts.body,instance=body?.userData?.modelInstance;
  if(!instance?.model)return false;
  instance.object.position.set(0,0,0);
  if(visualWheelIds.every(id=>hasAuthoritativeModelWheelPose(session?.vehicleRenderState?.wheelPoses?.[id])))return false;
  if(!visualWheelIds.every(id=>parts.wheels?.[id]?.position))return false;
  let anchor=wheelCentroidByDocument.get(instance.model);
  if(!anchor){
    const mat=jointMatrices(instance.model);
    const moving=instance.model.joints.filter(j=>visualWheelIds.includes(j.name?.slice(-2).toLowerCase())&&j.name.startsWith('WheelMount_'));
    if(moving.length!==4||moving.some(j=>!mat.has(j.id)))return false;
    anchor=new THREE.Vector3();
    for(const j of moving)anchor.add(anchorScratch.setFromMatrixPosition(mat.get(j.id)));
    anchor.multiplyScalar(.25);wheelCentroidByDocument.set(instance.model,anchor);
  }
  instance.root.updateMatrix();
  anchorScratch.copy(anchor).applyMatrix4(instance.root.matrix);
  wheelScratch.set(0,0,0);
  for(const id of visualWheelIds)wheelScratch.add(parts.wheels[id].position);
  wheelScratch.multiplyScalar(.25).sub(body.position).applyQuaternion(qScratch.copy(body.quaternion).invert());
  instance.object.position.copy(wheelScratch.sub(anchorScratch));
  return true;
}

// Replace procedural parts in the existing vehicle scene. Parent transforms
// continue to come from physics (including suspension, steering and body roll).
export const raceVehicleEnvironmentProfile=(profile,model,part)=>
  profile==='track-clear'&&isWrxStudioDocument(model,part)?'track-clear-rally':profile;

export function updateRaceModelParts(group,car,session,{
  library=modelAssets,automotiveProfile=null,automotiveRenderer=null,automotiveConditions=null
}={}){
  const parts=group.userData.parts;
  // Gameplay passes the same conditions that are used to draw sky and fog.
  // Stand-alone previews may supply a fixed probe or just a simulation session.
  const conditions=automotiveConditions??{night:session?.night===true,weather:session?.triggerWeather??session?.weatherFxState?.weatherId};
  const profile=automotiveProfile??conditions.skyProbe??automotiveTrackProfile(conditions);
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
    // Race wheel IDs name -X left and +X right in the chassis frame.
    if(wheelId)binding=placeOutboardWheelFace(modelWheelBindingForAxle(binding,wheelId),String(wheelId).toLowerCase().endsWith('l')?-1:1,isStudioRosterWheel(model,binding.ref));
    const bindingKey=JSON.stringify(binding);
    if(instance.model!==model||instance.raceBindingKey!==bindingKey){
      instance.setModel(model,binding,{vehicleVisual:true});
      instance.raceBindingKey=bindingKey;
    }
    if(instance.root.userData.automotiveMaterials?.length){
      const environment=automotiveProfile??raceVehicleEnvironmentProfile(profile,model,wheelId?'wheel':'body');
      instance.setAutomotiveEnvironment(environment,automotiveRenderer);
    }
    if(instance.binding.clip&&model.animations.some(clip=>clip.id===instance.binding.clip||clip.name===instance.binding.clip)){
      instance.time=Math.max(0,Number(session?.elapsedMs)||0)/1000*instance.binding.speed;
      instance.update(0);
    }
    if(wheelId){
      const pose=session?.vehicleRenderState?.wheelPoses?.[wheelId];
      // A native body uses the canonical world wheel orientation (which
      // already includes spin). Do not apply spin a second time here.
      const canonical=isNativeModelWheelCar(car)&&hasAuthoritativeModelWheelPose(pose);
      part.userData.spin.rotation.x=canonical?0:Number(pose?.spinAngleRad)||0;
      syncWrxBrakeHardware(part,car,wheelId,canonical?pose.spinAngleRad:0,model);
      const studioCaliper=instance.root.children.find(mesh=>mesh.material?.name?.startsWith('[studio9:static-caliper]'));
      if(studioCaliper){
        const spin=Number(pose?.spinAngleRad)||0;
        studioCaliper.rotation.x=spin*(wheelId.endsWith('l')?1:-1);
      }
    }
    return part;
  };
  parts.body=install(parts.body,car.art?.bodyModel);
  for(const [id,part] of Object.entries(parts.wheels||{}))parts.wheels[id]=install(part,car.art?.wheelModel,id);
  fitWrxFallbackVisualBody(parts,car,session);
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
// Shared optical masks for a lens explicitly authored in this UV layout.
// Do not blanket-light the whole silver housing or put a sphere in front
// of the bodywork. Road beams still originate at the four authored mounts.
let wrxReflectorMasks;
function reflectorMask(highBeam){
 const w=64,h=48,bytes=new Uint8Array(w*h*4);
 const glow=(u,v,cx,cy,rx,ry,slant)=>{
  const dx=(u-cx)/rx,dy=(v-cy-slant*(u-cx))/ry,r=dx*dx+dy*dy;
  return Math.pow(Math.max(0,1-r),1.5);
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/(w-1),v=y/(h-1);
  const main=glow(u,v,.561,.442,.178,.191,.24);
  const hi=highBeam?glow(u,v,.209,.472,.088,.192,.16):0;
  const sat=Math.max(main,hi*.92),i=4*(y*w+x);
  bytes[i+0]=Math.round(255*sat);
  bytes[i+1]=Math.round((249-main*7+hi*3)*sat);
  bytes[i+2]=Math.round((222+main*25-hi*8)*sat);
  bytes[i+3]=255;
 }
 const map=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);
 map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.LinearFilter;
 map.needsUpdate=true;return map;
}
// Red and white channels share the same built-in UVs but never illuminate
// each other's optical pockets. Cache the six combinations for all WRX instances.
const wrxRearMasks=new Map();
function rearLensMask(redState,reversing){
 const key=redState*2+Number(reversing);
 if(wrxRearMasks.has(key))return wrxRearMasks.get(key);
 const w=96,h=56,bytes=new Uint8Array(w*h*4);
 const smooth=x=>Math.max(0,Math.min(1,x));
 const spot=(u,v,cx,cy,rx,ry)=>Math.pow(Math.max(0,1-((u-cx)/rx)**2-((v-cy)/ry)**2),.52);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/(w-1),v=y/(h-1),band=.49+.07*Math.sin(Math.PI*u)-.02*u+.085;
  const r=redState ? spot(u,v,.43,.316,.368,.174)*smooth((band-.103-v)*34)*(redState===2?1:.49):0;
  const white=reversing?spot(u,v,.29,band,.169,.068):0;
  const optics=.88+.12*Math.cos(u*83*Math.PI);
  const i=(y*w+x)*4;
  bytes[i]=Math.round(255*Math.max(r,.88*white)*optics);
  bytes[i+1]=Math.round(255*Math.max(.105*r,.93*white)*optics);
  bytes[i+2]=Math.round(255*Math.max(.095*r,white)*optics);
  bytes[i+3]=255;
 }
 const map=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);
 map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.LinearFilter;map.needsUpdate=true;
 wrxRearMasks.set(key,map);return map;
}
const studioLightColors={head:0xf5e9da,brake:0xff171a,running:0xde161b,reverse:0xebf2ff,'signal-left':0xffaa34,'signal-right':0xffaa34};
export function studioLampLevels(session,{braking=false,reversing=false,enabled=true,headlights=null,defaultHeadlights=false}={}){
 const state=session?.mechanical??{},head=Boolean(headlights??state.headlights??defaultHeadlights);
 const power=enabled?Math.max(0,Math.min(1,state.effects?.lights??1)):0;
 const signal=state.turnSignal??session?.turnSignal,blink=Math.floor((Number(session?.elapsedMs)||0)/380)%2===0;
 return {head:head*power*(state.highBeams?2.1:1.35),brake:Number(braking)*power*2.7,
  running:head*power*.75,reverse:Number(reversing)*power*1.65,
  'signal-left':(blink&&(state.hazards||signal==='hazard'||signal==='left'))?power*1.8:0,
  'signal-right':(blink&&(state.hazards||signal==='hazard'||signal==='right'))?power*1.8:0};
}
export function syncRaceModelLamps(part,session,{braking=false,reversing=false,enabled=true,headlights=null,defaultHeadlights=false}={}){
 const instance=part?.userData?.modelInstance;
 const root=instance?.root;
 if(!root)return false;
 let lights=instance.raceMountedLamps;
 if(instance.raceLampRoot!==root){
  for(const lamp of lights?.values()||[]){instance.object.remove(lamp);lamp.geometry.dispose();lamp.material.dispose();}
  lights=new Map();
  instance.raceStudioLights=root.children.flatMap(mesh=>{
   const mat=mesh.material,role=/^\[studio9:([a-z-]+)\]/.exec(mat?.name??'')?.[1];
   if(!role||!mat.emissive||studioLightColors[role]===undefined)return [];
   mat.userData.raceVehicleLamp=true;
   mat.emissive.set(studioLightColors[role]);mat.emissiveIntensity=0;return [{role,mat}];
  });
  const studioFront=instance.raceStudioLights.some(x=>x.role==='head'),studioRear=instance.raceStudioLights.some(x=>x.role==='brake');
  const frames=mountedLampLocalFrames(instance.model);
  // Use the original lens as the glow surface only when the artist has explicitly
  // marked a single rear light-bar material. Standard lamp meshes remain the default.
  const rearBars=new Set(root.children.filter(
    mesh=>mesh.isMesh && /^\[race-lamp:tail-bar\] /.test(mesh.material?.name)
  ).map(mesh=>mesh.material));
  const rearBar=rearBars.size===1&&frames.has('TaillightMount_L')&&frames.has('TaillightMount_R')
    ?rearBars.values().next().value:null;
  instance.raceRearBarMaterial=rearBar;
  const rearLenses=instance.binding?.ref==='Field-Forgetmenot'
    ?root.children.filter(mesh=>mesh.isMesh&&mesh.material?.name==='WRX fitted rear lens'
      &&mesh.material?.emissive&&mesh.material?.map):[];
  const rearLens=rearLenses.length===1&&frames.has('TaillightMount_L')&&frames.has('TaillightMount_R')
    ?rearLenses[0].material:null;
  instance.raceRearLensMaterial=rearLens;
  if(rearLens){
   rearLens.emissive.set(0xffffff);rearLens.emissiveMap=rearLensMask(0,false);
   rearLens.emissiveIntensity=0;rearLens.needsUpdate=true;
  }
  const wrxReflectors=instance.binding?.ref==='Field-Forgetmenot'
    ? root.children.filter(mesh=>mesh.isMesh&&mesh.material?.name==='Continuous reflector headlight lens'
      &&mesh.material?.emissive&&mesh.material?.map)
    : [];
  const frontLens=wrxReflectors.length===1&&frames.has('HeadlightMount_L')&&frames.has('HeadlightMount_R')
    ?wrxReflectors[0].material:null;
  instance.raceFrontReflectorMaterial=frontLens;
  if(frontLens){
    wrxReflectorMasks ||= [reflectorMask(false),reflectorMask(true)];
    frontLens.emissive.set(0xf4f6ff);
    frontLens.emissiveMap=wrxReflectorMasks[0];
    frontLens.emissiveIntensity=0;
    frontLens.needsUpdate=true;
  }
  if(rearBar)rearBar.emissive.set(0xa61117);
  for(const [name,pose] of frames){
    const isTail=name.startsWith('Tail');
    if(isTail?(rearLens||studioRear):(frontLens||studioFront))continue;
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
 const headOn=Boolean(headlights??session?.mechanical?.headlights??defaultHeadlights);
 const studio=instance.raceStudioLights??[];
 if(studio.length){
  const levels=studioLampLevels(session,{braking,reversing,enabled,headlights,defaultHeadlights});
  for(const {mat,role} of studio)mat.emissiveIntensity=levels[role];
 }
 const rearBar=instance.raceRearBarMaterial;
 const frontLens=instance.raceFrontReflectorMaterial;
 if(frontLens){
   const high=Boolean(session?.mechanical?.highBeams);
   const lampPower=Math.max(0,Math.min(1,session?.mechanical?.effects?.lights??1));
   frontLens.emissiveMap=wrxReflectorMasks[high?1:0];
   frontLens.emissiveIntensity=enabled&&headOn?lampPower*(high?1.75:1.28):0;
 }
 const rearLens=instance.raceRearLensMaterial;
 if(rearLens){
  const redState=braking?2:headOn?1:0;
  rearLens.emissiveMap=rearLensMask(redState,reversing);
  rearLens.emissiveIntensity=enabled&&(redState||reversing)
    ?1.6*Math.max(0,Math.min(1,session?.mechanical?.effects?.lights??1)):0;
 }
 if(rearBar)rearBar.emissiveIntensity=enabled?(braking?4:headOn?2:0):0;
 for(const [name,lamp] of lights){
  const tail=name.startsWith('Tail');
  lamp.visible=enabled&&(headOn||tail&&braking)&&!(tail&&rearBar);
  lamp.material.emissiveIntensity=tail?(braking?3.1:1.05):(session?.mechanical?.highBeams?2.9:1.95);
 }
 return lights.size>0||Boolean(frontLens)||Boolean(rearLens)||studio.length>0;
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

