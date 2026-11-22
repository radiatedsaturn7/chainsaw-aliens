import * as THREE from '../vendorBridge/three.js';
import {ModelAssetInstance, modelAssets, normalizeModelBinding} from '../model3d/ModelAssets.js';
import {ensureModelSceneLighting} from '../model3d/ModelRender.js';
import {createModelWheel, isDedicatedModelWheelCar} from '../model3d/ModelWheel.js';

const GARAGE_WIDGETS=new Set(['garage-preview','tuning-car-preview','upgrades-car-preview']);
export const usesGarageModelPreview=(element,car)=>GARAGE_WIDGETS.has(element?.id)&&isDedicatedModelWheelCar(car);
const HUBS=['FL','FR','RL','RR'];
const FOREGROUND_SHIFT=.12;
const CHASSIS_PITCH=-.014;
const CAMERA_YAW=-Math.PI/4;
const CAMERA_ELEVATION=.16;

// Read exact pivots from native DCC exports, without importing/animating race
// suspension. Legacy sprite graphics don't enter this preview pipeline.
export function garageModelStance(model,car){
 const binding=normalizeModelBinding(car.art.bodyModel);
 const d=car.dimensions||{};
 const trackFront=Number(d.trackFrontM)||1.56, trackRear=Number(d.trackRearM)||1.57;
 const base=Number(d.wheelbaseM)||2.67;
 const all=HUBS.map((id,i)=>{
  const axle=i<2?trackFront:trackRear,side=i%2===0?1:-1;
  const joint=model.joints?.find(j=>j.name?.toUpperCase()===`WHEELMOUNT_${id}`);
  return joint?.position??[side*axle/2,.337,(i<2?1:-1)*base/2];
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
  pivot,hubY,centerZ,shift:FOREGROUND_SHIFT,pitch:CHASSIS_PITCH,
  hubs:hubs.map((p,i)=>({id:HUBS[i],x:p.x,y:radius,z:p.z-centerZ+FOREGROUND_SHIFT}))};
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
  const key=JSON.stringify([binding,car.dimensions]);
  if(this.model===model&&this.key===key)return true;
  this.disposePlacements();
  this.model=model;this.key=key;const stance=garageModelStance(model,car);
  this.instance.setModel(model,stance.binding);
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
   const wheel=createModelWheel(stance.radius,stance.width);
   wheel.name=`garageModelWheel-${hub.id}`;wheel.position.set(hub.x,hub.y,hub.z);this.wheels.add(wheel);
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
  this.renderer.render(this.scene,this.camera);
  ctx.drawImage(this.renderer.domElement,b.x,b.y,b.w,b.h);
  return true;
 }
 disposePlacements(){
  const materials=new Set();
  for(const group of [this.wheels,this.shadow]){
   group.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});group.clear();
  }
  for(const material of materials)material.dispose();
  this.shadowMap?.dispose();this.shadowMap=null;
 }
 dispose(){
  this.disposePlacements();this.instance.dispose();this.renderer?.dispose();this.renderer=null;this.model=null;this.key=null;this.framingSize=null;
 }
}
