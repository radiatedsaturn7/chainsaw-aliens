import * as THREE from '../vendorBridge/three.js';
import {RACE_THREE_ELEVATION_M} from '../racing/simulation/RaceSimulationConfig.js';

// Reuse the race vehicle parts so model bindings and procedural cars have the
// same appearance in the selection screen. Sprite cars use their authored views.
export class MenuCarPreview {
  constructor(editor){this.editor=editor;this.holder=null;this.renderer=null;}
  draw(ctx,bounds,car,yaw,time){
    if(typeof document==='undefined')return false;
    if(!this.renderer){this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.renderer.setPixelRatio(1);this.holder={scene:new THREE.Scene()};}
    const width=Math.max(1,Math.round(bounds.w)),height=Math.max(1,Math.round(bounds.h));this.renderer.setSize(width,height,false);
    const dimensions=this.editor.getRaceCarDimensions(car),cg=Number(car.tuning?.cgHeightM)||0.56;
    const session={worldX:0,worldZ:0,carYaw:0,bodyY:cg,elapsedMs:time*1000};
    this.editor.addRaceThreeProceduralCar(this.holder,{car,session,x:0,z:0,elevation:cg/RACE_THREE_ELEVATION_M,yaw:0,drawShadow:false,color:car.paint?.body||'#58d6ff'});
    const distance=Math.max(Number(dimensions.lengthM)||4.6,Number(dimensions.widthM)||1.8,Number(car.dimensions?.heightM||car.tuning?.heightM)||1.5)*1.6;
    const camera=new THREE.PerspectiveCamera(40,width/height,0.01,1000);camera.position.set(Math.sin(yaw)*distance,distance*0.35,Math.cos(yaw)*distance);camera.lookAt(0,cg,0);camera.updateProjectionMatrix();this.renderer.render(this.holder.scene,camera);ctx.drawImage(this.renderer.domElement,bounds.x,bounds.y,bounds.w,bounds.h);return true;
  }
  dispose(){if(this.holder){this.editor.clearRaceThreeDynamicCar(this.holder);for(const material of this.holder.solidMaterialCache?.values()||[])material.dispose();}this.renderer?.dispose();this.holder=null;this.renderer=null;}
}
