import {modelAssets} from '../model3d/ModelAssets.js';

export const MENU_MODEL_STILL_ANGLE=135;
export const MENU_MODEL_STILL_SIZE={width:160,height:104};
const MICRO_SCALE=.74,MAX_STILLS=12;
const framesByPreview=new WeakMap();

export function menuModelStillBounds(b){
  const w=b.w*MICRO_SCALE,h=b.h*MICRO_SCALE;
  return {x:b.x+(b.w-w)/2,y:b.y+(b.h-h)/2,w,h};
}

// Only the car selection screen calls this. The reusable race-part renderer is
// shared, but the menu draws a copied still rather than rendering or rotating
// the model each animation tick. Never latch a procedural placeholder body.
export function paintMenuModelStill(ctx,b,car,preview,{library=modelAssets,canvasFactory=()=>globalThis.document?.createElement?.('canvas')}={}){
  const bodyRef=car?.art?.bodyModel?.ref,wheelRef=car?.art?.wheelModel?.ref;
  if(!bodyRef||!preview||!(b.w>0&&b.h>0))return false;
  const body=library.get(bodyRef);
  const wheels=wheelRef?library.get(wheelRef):null;
  if(!body||(wheelRef&&!wheels))return false;
  const setup=JSON.stringify([car.art.bodyModel,car.art.wheelModel]);
  const cache=framesByPreview.get(preview)||new Map();framesByPreview.set(preview,cache);
  let frame=cache.get(car);
  if(!frame||frame.setup!==setup||frame.body!==body||frame.wheels!==wheels){
    const canvas=canvasFactory(),{width,height}=MENU_MODEL_STILL_SIZE;
    if(!canvas)return false;
    canvas.width=width;canvas.height=height;
    const target=canvas.getContext('2d');if(!target)return false;
    let rendered=false;
    try{rendered=preview.draw(target,{x:0,y:0,w:width,h:height},car,(MENU_MODEL_STILL_ANGLE+180)*Math.PI/180,0);}
    catch{/* A supported stock poster can still display on devices without WebGL. */}
    frame={setup,body,wheels,canvas:rendered?canvas:null};
  }
  cache.delete(car);cache.set(car,frame);
  while(cache.size>MAX_STILLS)cache.delete(cache.keys().next().value);
  if(!frame.canvas)return false;
  const {width,height}=frame.canvas,scale=Math.min(b.w/width,b.h/height),w=width*scale,h=height*scale;
  ctx.drawImage(frame.canvas,b.x+(b.w-w)/2,b.y+(b.h-h)/2,w,h);
  return true;
}
