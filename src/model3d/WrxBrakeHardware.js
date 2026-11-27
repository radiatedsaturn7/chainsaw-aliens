import {isWrxFit10Document} from './WrxBundledModels.js';
import * as THREE from '../vendorBridge/three.js';
import {mergeGeometries} from '../../vendor/three-addons/utils/BufferGeometryUtils.js';

export const usesWrxBrakeHardware=car=>(typeof location==='undefined'||new URLSearchParams(location.search).get('wrxLook')!=='off')&&car?.art?.bodyModel?.ref==='Field-Forgetmenot'
 &&car.art?.wheelModel?.ref==='Field-Forgetmenot-Wheel';

let rotorGrain;
function wrxRotorGrain(){
 if(rotorGrain)return rotorGrain;
 // A stock vented cast-iron disc: muted hat, finely turned rubbing
 // track and a cool unworn edge. High-contrast ring noise aliasing at
 // the original 64px is gone; geometry and draw count stay unchanged.
 const n=128,bytes=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const dx=2*(x+.5)/n-1,dy=2*(y+.5)/n-1,r=Math.hypot(dx,dy);
  const t=Math.atan2(dy,dx);
  const rubbing=Math.max(0,Math.min(1,(r-.44)/.12))*Math.max(0,Math.min(1,(.98-r)/.031));
  const edge=Math.exp(-(((r-.95)/.018)**2));
  const track=3.2*Math.cos(r*169)+1.6*Math.sin(r*91+Math.sin(t*3)*0.4);
  const swirl=Math.sin(x*13.17+y*16.57)*1.3+Math.cos(x*7.61-y*21.84)*.9;
  const steel=107+rubbing*(58+track)+edge*13+swirl;
  const i=(y*n+x)*4;
  bytes[i]=Math.round(steel+edge*5);bytes[i+1]=Math.round(steel+2);bytes[i+2]=Math.round(steel+4-edge*2);bytes[i+3]=255;
 }
 rotorGrain=new THREE.DataTexture(bytes,n,n,THREE.RGBAFormat);
 rotorGrain.colorSpace=THREE.SRGBColorSpace;rotorGrain.magFilter=THREE.LinearFilter;
 rotorGrain.minFilter=THREE.LinearMipmapLinearFilter;rotorGrain.generateMipmaps=true;rotorGrain.needsUpdate=true;
 return rotorGrain;
}

// Compact, separate disc and knuckle-mounted caliper modeled in wheel
// coordinates. It is a visual detail only: never feeds vehicle dynamics.
export function createWrxBrakeHardware(wheelId){
 const group=new THREE.Group();
 group.name='wrxBrakeHardware';
 const front=String(wheelId).toLowerCase().startsWith('f');
 const radius=front?.164:.150;
 const segments=20;
 const disc=(r,width)=>new THREE.CylinderGeometry(r,r,width,segments,1).rotateZ(-Math.PI/2);
 const rim=new THREE.CylinderGeometry(radius-.006,radius-.006,.025,segments,1,true).rotateZ(-Math.PI/2);
 const rotor=disc(radius,.020),hat=disc(radius*.43,.039);
 const rotorParts=mergeGeometries([rotor,rim,hat]);
 rotor.dispose();rim.dispose();hat.dispose();
 const mesh=new THREE.Mesh(rotorParts,new THREE.MeshStandardMaterial({
  color:0xb4bac0,map:wrxRotorGrain(),roughness:.39,metalness:.66
 }));
 mesh.name='wrxVentedBrakeRotor';group.add(mesh);

 // The caliper straddles the rear edge of the rotor. Shape is in flat
 // wheel-local view (Y upward, Z fore/aft), extruded along axle X.
 const shape=new THREE.Shape();
 const points=[[-.80,-.46],[-.91,-.26],[-1.04,-.17],[-1.09,.07],
  [-.98,.39],[-.81,.49],[-.68,.36],[-.71,.18],[-.74,-.06],[-.67,-.28]];
 points.forEach(([z,y],i)=>(i?shape.lineTo(z*radius,y*radius):shape.moveTo(z*radius,y*radius)));
 shape.closePath();
 const width=front?.081:.071;
 const caliper=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,
  bevelThickness:.004,bevelSize:.006,bevelSegments:1,steps:1})
  .rotateY(-Math.PI/2).translate(width/2,0,0);
 // Rotating the shape maps its negative horizontal coordinates to rear -Z.
 const fixed=new THREE.Mesh(caliper,new THREE.MeshStandardMaterial({color:0x946c51,roughness:.55,metalness:.29}));
 fixed.name='wrxFixedBrakeCaliper';group.add(fixed);
 return group;
}

const assemblyByWheel=new WeakMap();
export function syncWrxBrakeHardware(wheel,car,wheelId,spinAngle=0,model=null){
 let hardware=assemblyByWheel.get(wheel);
 if(!usesWrxBrakeHardware(car)||isWrxFit10Document(model,'wheel')){
  if(hardware){
   hardware.removeFromParent();assemblyByWheel.delete(wheel);
   for(const mesh of hardware.children){mesh.geometry.dispose();mesh.material.dispose();}
  }
  return null;
 }
 if(!hardware){hardware=createWrxBrakeHardware(wheelId);assemblyByWheel.set(wheel,hardware);wheel.add(hardware);}
 // The pose follows steering, camber and suspension. Cancel only the
 // tire spin on the caliper. The rotor is concentric and rotates with the tire.
 hardware.getObjectByName('wrxFixedBrakeCaliper').rotation.x=-(Number(spinAngle)||0);
 return hardware;
}
