import * as THREE from '../vendorBridge/three.js';
import {ModelAssetInstance, modelAssets, normalizeModelBinding} from '../model3d/ModelAssets.js';
import {modelWheelBindingForAxle,placeOutboardWheelFace} from '../model3d/ModelBinding.js';
import {jointMatrices} from '../model3d/ModelRig.js';
import {ensureModelSceneLighting} from '../model3d/ModelRender.js';
import {syncWrxBrakeHardware} from '../model3d/WrxBrakeHardware.js';
import {createModelWheel, isDedicatedModelWheelCar} from '../model3d/ModelWheel.js';

const GARAGE_WIDGETS=new Set(['garage-preview','tuning-car-preview','upgrades-car-preview']);
export const usesGarageModelPreview=(element,car)=>GARAGE_WIDGETS.has(element?.id)&&Boolean(isDedicatedModelWheelCar(car)||car?.art?.bodyModel?.ref&&car.art.wheelModel?.ref);
const HUBS=['FL','FR','RL','RR'];
const FOREGROUND_SHIFT=.12;
const CHASSIS_PITCH=-.014;
// Front three-quarter view exposes the headlights while retaining the side profile.
const CAMERA_YAW=-Math.PI*.25;
const CAMERA_ELEVATION=.10;

// Read exact pivots from native DCC exports, without importing/animating race
// suspension. Legacy sprite graphics don't enter this preview pipeline.
export function garageModelStance(model,car){
 const binding=normalizeModelBinding(car.art.bodyModel);
 const d=car.dimensions||{};
 const trackFront=Number(d.trackFrontM)||1.56, trackRear=Number(d.trackRearM)||1.57;
 const base=Number(d.wheelbaseM)||2.67;
 const poses=model.joints?.length&&model.joints.every(j=>typeof j.id==='string')?jointMatrices(model):null;
 const all=HUBS.map((id,i)=>{
  const axle=i<2?trackFront:trackRear,side=i%2===0?1:-1;
  const joint=model.joints?.find(j=>j.name?.toUpperCase()===`WHEELMOUNT_${id}`);
  return poses?.has(joint?.id)?new THREE.Vector3().setFromMatrixPosition(poses.get(joint.id)).toArray():joint?.position??[side*axle/2,.337,(i<2?1:-1)*base/2];
 });
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...binding.position),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...binding.rotation)),
  new THREE.Vector3(...binding.scale));
 const hubs=all.map(p=>new THREE.Vector3(...p).applyMatrix4(matrix));
 const hubY=hubs.reduce((a,p)=>a+p.y,0)/HUBS.length;
 const radius=Math.max(.20,Math.min(.57,all.reduce((a,p)=>a+p[1],0)/4*Math.abs(binding.scale[1])));
 const centerZ=hubs.reduce((a,p)=>a+p.z,0)/HUBS.length;
 const pivot=new THREE.Vector3(0,hubY,centerZ);
 return {binding,radius,width:Math.max(.18,Math.min(.28,(Number(d.widthM)||1.83)*.134)),
  pivot,hubY,centerZ,localHubs:hubs,shift:FOREGROUND_SHIFT,pitch:CHASSIS_PITCH,
  hubs:hubs.map((p,i)=>({id:HUBS[i],x:p.x,y:radius,z:p.z-centerZ+FOREGROUND_SHIFT}))};
}

// Selector stills are parked presentations, not physics sessions. Supply the
// same authored hubs to the race-scene builder rather than inventing ground
// contacts at y=0 (which buried half the wheel model).
export function menuModelWheelPoses(model,car,centerHeight=null){
 const stance=garageModelStance(model,car);
 centerHeight ??= stance.radius-stance.hubY;
 return Object.fromEntries(stance.localHubs.map(hub=>{
  const id=(hub.z>=stance.centerZ?'f':'r')+(hub.x<0?'l':'r');
  return [id,{position:{x:hub.x,y:hub.y+centerHeight,z:hub.z},
   orientation:{x:0,y:0,z:0,w:1},spinAngleRad:0}];
 }));
}

const cornerVectors=(box)=>{
 if(box.isEmpty())return [];
 return [box.min.x,box.max.x].flatMap(x=>[box.min.y,box.max.y].flatMap(y=>[box.min.z,box.max.z].map(z=>new THREE.Vector3(x,y,z))));
};
export function garageFramingPoints(group){
 const points=[];
 group.updateWorldMatrix(true,true);
 group.traverseVisible(node=>{
  if(!node.geometry)return;
  if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
  for(const p of cornerVectors(node.geometry.boundingBox))points.push(p.applyMatrix4(node.matrixWorld));
 });
 return points;
}

// Scene-relative angle stays fixed, but perspective distance is fitted every
// time the widget aspect changes. Solve against projected corners at the final
// angle rather than trying to fit the much larger enclosing bounding sphere.
export function configureGarageModelCamera(camera,points,width,height){
 const aspect=Math.max(.05,width/height);
 const box=new THREE.Box3().setFromPoints(points);
 if(box.isEmpty())return;
 const target=box.getCenter(new THREE.Vector3());
 target.z-=FOREGROUND_SHIFT;
 const direction=new THREE.Vector3(Math.sin(CAMERA_YAW)*Math.cos(CAMERA_ELEVATION),Math.sin(CAMERA_ELEVATION),
  Math.cos(CAMERA_YAW)*Math.cos(CAMERA_ELEVATION));
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right);
 const vertical=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 let distance=1.2;
 for(const point of points){
  const p=point.clone().sub(target);
  distance=Math.max(distance,p.dot(direction)+Math.abs(p.dot(right))/(vertical*aspect*.86),
   p.dot(direction)+Math.abs(p.dot(up))/(vertical*.78));
 }
 camera.aspect=aspect;
 camera.position.copy(target).addScaledVector(direction,distance+.06);
 camera.lookAt(target);camera.clearViewOffset();camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const projected=new THREE.Box3().setFromPoints(points.map(p=>p.clone().project(camera)));
 const center=projected.getCenter(new THREE.Vector3());
 // Keep heel shadows and wheels planted at the visual foreground, with a
 // slight rightward presentation nudge instead of changing the authored rig.
 camera.setViewOffset(width,height,(center.x-.035)*width/2,(-center.y-.108)*height/2,width,height);
 camera.updateMatrixWorld();
}

function shadowTexture(){
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const r=Math.hypot(2*x/(n-1)-1,2*y/(n-1)-1),a=1-Math.min(1,r);
  data[(y*n+x)*4+3]=Math.round(240*a*a);
 }
 const map=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
 map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
 return map;
}

export class GarageModelPreview {
 constructor({library=modelAssets}={}){
  this.library=library;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,.03,80);
  this.carRoot=new THREE.Group();this.wheels=new THREE.Group();this.shadow=new THREE.Group();
  this.bodyPivot=new THREE.Group();this.instance=new ModelAssetInstance();this.bodyPivot.add(this.instance.object);
  this.carRoot.add(this.bodyPivot,this.wheels);this.scene.add(this.carRoot,this.shadow);
  ensureModelSceneLighting(this.scene);
 }
 prepare(car){
  const binding=car?.art?.bodyModel;
  const model=this.library.get(binding?.ref);if(!model)return false;
  const wheelBinding=car.art.wheelModel, wheelModel=wheelBinding?.ref?this.library.get(wheelBinding.ref):null;
  if(wheelBinding?.ref&&!wheelModel)return false;
  const key=JSON.stringify([binding,wheelBinding,car.dimensions]);
  if(this.model===model&&this.wheelModel===wheelModel&&this.key===key)return true;
  this.disposePlacements();
  this.model=model;this.wheelModel=wheelModel;this.key=key;const stance=garageModelStance(model,car);
  this.instance.setModel(model,stance.binding,{vehicleVisual:true});
  this.instance.object.position.copy(stance.pivot).negate();
  this.bodyPivot.position.set(0,stance.radius,stance.shift);
  this.bodyPivot.rotation.set(stance.pitch,0,0);
  const map=shadowTexture();this.shadowMap=map;
  const shadowPlane=(x,z,w,length,opacity)=>{
   const mat=new THREE.MeshBasicMaterial({map,transparent:true,opacity,depthWrite:false});
   const p=new THREE.Mesh(new THREE.PlaneGeometry(w,length),mat);
   p.rotation.x=-Math.PI/2;p.position.set(x,.002,z);this.shadow.add(p);
  };
  shadowPlane(0,stance.shift,2.65,5.8,.83);
  for(const hub of stance.hubs){
   let wheel,garageY=hub.y;
   if(wheelModel){
    // Native joint names follow the modeler's convention (not race IDs).
    // Use the measured hub coordinate to determine the real outboard side.
    const placement=placeOutboardWheelFace(modelWheelBindingForAxle(wheelBinding,hub.id),Math.sign(hub.x));
    const instance=new ModelAssetInstance();instance.setModel(wheelModel,placement,{vehicleVisual:true});
    if(placement!==wheelBinding)garageY=hub.y*placement.scale[1]/(wheelBinding.scale?.[1]||1);
    (this.wheelInstances ||= []).push(instance);wheel=instance.object;
   }else wheel=createModelWheel(stance.radius,stance.width);
   syncWrxBrakeHardware(wheel,car,hub.id);
   wheel.name=`garageModelWheel-${hub.id}`;wheel.position.set(hub.x,garageY,hub.z);this.wheels.add(wheel);
   shadowPlane(hub.x,hub.z,stance.width*2.9,stance.radius*2.35,.88);
  }
  this.points=garageFramingPoints(this.carRoot);this.framingSize=null;
  return true;
 }
 draw(ctx,b,car){
  if(typeof document==='undefined'||!this.prepare(car))return false;
  if(!this.renderer){
   this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
   this.renderer.setPixelRatio(1);
  }
  const w=Math.max(1,Math.round(b.w)),h=Math.max(1,Math.round(b.h));
  const size=`${w}:${h}`;
  if(this.framingSize!==size){
   this.renderer.setSize(w,h,false);configureGarageModelCamera(this.camera,this.points,w,h);this.framingSize=size;
  }
  this.instance.setAutomotiveEnvironment('studio',this.renderer);
  for(const instance of this.wheelInstances||[])instance.setAutomotiveEnvironment('studio',this.renderer);
  this.renderer.render(this.scene,this.camera);
  ctx.drawImage(this.renderer.domElement,b.x,b.y,b.w,b.h);
  return true;
 }
 disposePlacements(){
  for(const instance of this.wheelInstances||[])instance.dispose();
  this.wheelInstances=[];
  const materials=new Set();
  for(const group of [this.wheels,this.shadow]){
   group.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});group.clear();
  }
  for(const material of materials)material.dispose();
  this.shadowMap?.dispose();this.shadowMap=null;
 }
 dispose(){
  this.disposePlacements();this.instance.dispose();this.renderer?.dispose();this.renderer=null;this.model=null;this.wheelModel=null;this.key=null;this.framingSize=null;
 }
}
