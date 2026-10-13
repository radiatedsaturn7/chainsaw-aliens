import * as THREE from '../vendorBridge/three.js';
import {RACE_THREE_ELEVATION_M} from '../racing/simulation/RaceSimulationConfig.js';
import {resolveCarAngleLayers} from '../racing/CarDirectionalArt.js';

const opaqueBoundsCache=new WeakMap();
export function menuCarVisualBounds(group){
  const bounds=new THREE.Box3();
  if(!group)return bounds;
  group.updateWorldMatrix(true,true);
  group.traverseVisible(object=>{
    if(!object.geometry)return;
    if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
    if(object.geometry.boundingBox)bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}
function opaqueBounds(canvas){
  if(opaqueBoundsCache.has(canvas))return opaqueBoundsCache.get(canvas);
  const {width,height}=canvas,data=canvas.getContext('2d').getImageData(0,0,width,height).data;
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const bounds=right<0?{x:0,y:0,w:width,h:height}:{x:left,y:top,w:right-left+1,h:bottom-top+1};
  opaqueBoundsCache.set(canvas,bounds);return bounds;
}

// Translate the complete body/wheel rig together. A race anchor (and transparent
// image padding) is not the visual center of a menu turntable.
export function menuSpriteFraming(bounds,canvas,opaque,scale,offsets,art,mirrored=false){
  let width=Math.min(bounds.w*0.25,bounds.h*0.65),height=width*0.74;
  const bodyW=width*scale.bodyX,bodyH=(art.bodyFitToCar?height:width*canvas.height/canvas.width)*scale.bodyY;
  const angle=Math.max(-45,Math.min(45,Number(art.bodyRotationDeg)||0))*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const visibleW=opaque.w/canvas.width*bodyW,visibleH=opaque.h/canvas.height*bodyH;
  // Leave room for tires outside the shell without stretching an authored view.
  const fit=Math.min(1,bounds.w*0.85/(Math.abs(c)*visibleW+Math.abs(s)*visibleH),bounds.h*0.85/(Math.abs(s)*visibleW+Math.abs(c)*visibleH));
  const dx=-bodyW/2+offsets.bodyX*width*0.16+((mirrored?canvas.width-opaque.x-opaque.w/2:opaque.x+opaque.w/2)/canvas.width)*bodyW;
  const dy=-bodyH*0.58+offsets.bodyY*height*0.22+(opaque.y+opaque.h/2)/canvas.height*bodyH;
  return {centerX:bounds.x+bounds.w/2-(c*dx-s*dy)*fit,anchorY:bounds.y+bounds.h/2-(s*dx+c*dy)*fit,baseWidth:width*fit,baseHeight:height*fit};
}

// Reuse the race vehicle parts so model bindings and procedural cars have the
// same appearance in the selection screen. Sprite cars use their authored views.
export class MenuCarPreview {
  constructor(editor){this.editor=editor;this.holder=null;this.renderer=null;}
  drawSprite(ctx,bounds,car,choice){
    const canvas=this.editor.getRaceArtSpriteCanvas(choice.artRef,{frameIndex:choice.frameIndex||0});
    if(!canvas)return false;
    const resolved=resolveCarAngleLayers(car,choice.viewSlot);
    const framing=menuSpriteFraming(bounds,canvas,opaqueBounds(canvas),this.editor.getCarArtScale(resolved),this.editor.getCarArtOffsets(resolved),resolved.art||{},choice.mirrored);
    return this.editor.drawRaceCarBillboardLayers(ctx,{car,session:null,...framing,artChoice:choice,drawShadowLayer:false});
  }
  draw(ctx,bounds,car,yaw,time){
    if(typeof document==='undefined')return false;
    if(!this.renderer){this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.renderer.setPixelRatio(1);this.holder={scene:new THREE.Scene()};}
    const width=Math.max(1,Math.round(bounds.w)),height=Math.max(1,Math.round(bounds.h));this.renderer.setSize(width,height,false);
    const dimensions=this.editor.getRaceCarDimensions(car),cg=Number(car.tuning?.cgHeightM)||0.56;
    const session={worldX:0,worldZ:0,carYaw:0,bodyY:cg,elapsedMs:time*1000};
    this.editor.addRaceThreeProceduralCar(this.holder,{car,session,x:0,z:0,elevation:cg/RACE_THREE_ELEVATION_M,yaw:0,drawShadow:false,color:car.paint?.body||'#58d6ff'});
    const box=menuCarVisualBounds(this.holder.dynamicCarGroup);
    const center=box.isEmpty()?new THREE.Vector3(0,cg,0):box.getCenter(new THREE.Vector3());
    const radius=box.isEmpty()?Math.hypot(Number(dimensions.lengthM)||4.6,Number(dimensions.widthM)||1.8,1.5)/2:box.getBoundingSphere(new THREE.Sphere()).radius;
    const halfFov=Math.atan(Math.tan(20*Math.PI/180)*Math.min(1,width/height));
    const distance=radius/Math.sin(halfFov)*1.08;
    const camera=new THREE.PerspectiveCamera(40,width/height,0.01,1000);camera.position.set(center.x+Math.sin(yaw)*distance,center.y+distance*0.35,center.z+Math.cos(yaw)*distance);camera.lookAt(center);camera.updateProjectionMatrix();this.renderer.render(this.holder.scene,camera);ctx.drawImage(this.renderer.domElement,bounds.x,bounds.y,bounds.w,bounds.h);return true;
  }
  dispose(){if(this.holder){this.editor.clearRaceThreeDynamicCar(this.holder);for(const material of this.holder.solidMaterialCache?.values()||[])material.dispose();}this.renderer?.dispose();this.holder=null;this.renderer=null;}
}
