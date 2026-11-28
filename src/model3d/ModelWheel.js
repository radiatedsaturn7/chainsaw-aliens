import * as THREE from '../vendorBridge/three.js';
import {mergeGeometries} from '../../vendor/three-addons/utils/BufferGeometryUtils.js';

export const isDedicatedModelWheelCar=car=>Boolean(car?.art?.bodyModel?.ref&&car.art.threeModelWheels!==false&&!car.art.wheelModel?.ref);
// Race presentation includes both generated wheels and fully authored sets,
// but not sprite bodies with independently bound wheel models.
export const isNativeModelWheelCar=car=>Boolean(isDedicatedModelWheelCar(car)||car?.art?.bodyModel?.ref&&car.art.wheelModel?.ref);
export const hasAuthoritativeModelWheelPose=pose=>['x','y','z','w'].every(k=>Number.isFinite(pose?.orientation?.[k]));


// Axle is X, local origin is the actual hub; both faces are drawn so a
// mirrored vehicle does not need separate left/right model assets.
export function createModelWheel(radius=.337,width=.245){
 const root=new THREE.Group();root.name='modelWheel';
 const rubber=new THREE.MeshStandardMaterial({color:0x151a20,roughness:.94});
 const brass=new THREE.MeshStandardMaterial({color:0x8b6742,roughness:.49,metalness:.52});
 const rotor=new THREE.MeshStandardMaterial({color:0x39404a,roughness:.65,metalness:.32});
 const cylinder=(rTop,rBottom,length,material,x=0)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,length,20,1),material);
  mesh.rotation.z=Math.PI/2;mesh.position.x=x;root.add(mesh);
 };
 // Rubber sidewalls taper near the shoulders and leave a distinct rim lip.
 cylinder(radius,radius,width*.78,rubber);
 for(const side of [-1,1]){
  cylinder(side<0?radius*.905:radius,side<0?radius:radius*.905,width*.11,rubber,side*width*.445);
  cylinder(radius*.695,radius*.695,width*.038,rotor,side*width*.505);
  const lip=new THREE.Mesh(new THREE.TorusGeometry(radius*.65,radius*.034,6,20),brass);
  lip.rotation.y=Math.PI/2;lip.position.x=side*width*.528;root.add(lip);
  cylinder(radius*.215,radius*.215,width*.072,brass,side*width*.527);
  for(let i=0;i<6;i++){
   const angle=i*Math.PI/3;
   const spoke=new THREE.Mesh(new THREE.BoxGeometry(width*.039,radius*.45,radius*.12),brass);
   spoke.position.set(side*width*.548,Math.cos(angle)*radius*.409,Math.sin(angle)*radius*.409);
   spoke.rotation.x=angle;root.add(spoke);
  }
 }
 // Geometries/materials are owned per wheel so the normal car-scene teardown
 // can dispose them without invalidating another car or the showroom.
 for(const material of [rubber,brass,rotor]){
  const parts=root.children.filter(mesh=>mesh.material===material);
  const shapes=parts.map(mesh=>{mesh.updateMatrix();return mesh.geometry.applyMatrix4(mesh.matrix);});
  const batch=mergeGeometries(shapes);
  for(const mesh of parts){root.remove(mesh);mesh.geometry.dispose();}
  const wheelSkin=new THREE.Mesh(batch,material);
  wheelSkin.castShadow=true;wheelSkin.receiveShadow=true;root.add(wheelSkin);
 }
 return root;
}

export function setModelWheelPose(mesh,position={},rotation={},pose=null){
 const xyz=['x','y','z'];
 const orientation=pose?.orientation;
 mesh.position.set(...xyz.map(key=>Number(position[key]??0)));
 if(xyz.every(key=>Number.isFinite(pose?.position?.[key])))
  mesh.position.set(...xyz.map(key=>pose.position[key]));
 if([...xyz,'w'].every(key=>Number.isFinite(orientation?.[key])))
  mesh.quaternion.set(orientation.x,orientation.y,orientation.z,orientation.w);
 else {
  mesh.rotation.set(Number(rotation.pitch||0),Number(rotation.yaw||0),Number(rotation.roll||0),'YXZ');
  mesh.rotateX(Number(pose?.spinAngleRad||0));
 }
}
