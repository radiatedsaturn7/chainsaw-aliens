import * as THREE from '../vendorBridge/three.js';
import {automotiveEnvironment} from '../model3d/AutomotiveMaterials.js';
import {skyboxImageGeometry} from './RaceVisualFx.js';
const tau=2*Math.PI, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x);
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const srgb=new Float32Array(Array.from({length:256},(_,i)=>{
 const c=i/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
}));
let last=null;

// The painted horizon is a cylindrical panorama, not a measured HDRI. Use
// its world azimuth, horizon and color; retain analytic high-range light and
// fill in the unseen ground/zenith. Never rotate the probe with the camera.
export function raceAutomotiveSkyUV(phi,v,{anchor,horizon,angularHeight}){
 const yaw=(Math.PI*.5-phi)/tau;
 return [fract(anchor-yaw),clamp(horizon-Math.tan(clamp(v,-1.4,1.4))*angularHeight,0,1)];
}
function authoredSkyMapping(bounds,settings,w,h){
 const b={x:0,w:Math.max(1,bounds.w),h:Math.max(1,bounds.h)};
 const geo=skyboxImageGeometry(b,settings,w/h,{horizon:0,yaw:0});
 return {anchor:(b.w*.5-geo.x)/geo.width,horizon:-geo.y/geo.height,
   angularHeight:b.h/(2*Math.tan(53*Math.PI/360)*geo.height)};
}
export function raceAutomotiveSkyProbe(canvas,settings,bounds,{ground='#5b554d'}={}){
 const gutter=canvas?.skyboxGutter||0,w=(canvas?.width||0)-2*gutter,h=canvas?.height||0;
 if(w<4||h<4||!bounds)return null;
 const mapping=authoredSkyMapping(bounds,settings,w,h);
 const key=[mapping.anchor,mapping.horizon,mapping.angularHeight].map(n=>n.toFixed(4)).join('/')+'/'+ground;
 if(last?.canvas===canvas&&last.key===key)return last.probe;
 let source;
 try{source=canvas.getContext('2d').getImageData(gutter,0,w,h).data;}catch{return null;}
 const analytic=automotiveEnvironment('track-clear-rally').image,aw=analytic.width,ah=analytic.height,max=aw*ah;
 const groundRGB=new THREE.Color(/^#[0-9a-f]{6}$/i.test(ground)?ground:'#5b554d');
 const values=new Float32Array(max*3),data=new Uint16Array(max*4),decode=THREE.DataUtils.fromHalfFloat,encode=THREE.DataUtils.toHalfFloat;
 let target=0,sum=0;
 for(let j=0;j<ah;j++){
  const elevation=((j+.5)/ah-.5)*Math.PI,worldY=Math.sin(elevation),weight=Math.cos(elevation);
  for(let i=0;i<aw;i++){
   const phi=((i+.5)/aw-.5)*tau,p=j*aw+i,[u,v]=raceAutomotiveSkyUV(phi,elevation,mapping);
   const x=Math.min(w-1,Math.floor(u*w)),y=Math.min(h-1,Math.floor(v*h)),k=(y*w+x)*4;
   const rgb=[decode(analytic.data[p*4]),decode(analytic.data[p*4+1]),decode(analytic.data[p*4+2])];
   const above=smooth(-.17,.075,worldY),coverage=source[k+3]/255;
   const authored=[srgb[source[k]],srgb[source[k+1]],srgb[source[k+2]]];
   const groundFallback=[groundRGB.r,groundRGB.g,groundRGB.b];
   for(let c=0;c<3;c++){
    const appearance=(above*coverage*authored[c]+(1-above)*groundFallback[c]*.36);
    values[p*3+c]=rgb[c]*.64+appearance*.36;
   }
   target+=weight*luminance(...rgb);
   sum+=weight*luminance(values[p*3],values[p*3+1],values[p*3+2]);
  }
 }
 if(!(sum>0))return null;
 const ratio=target/sum;
 for(let p=0;p<max;p++){
  for(let c=0;c<3;c++) data[p*4+c]=encode(values[p*3+c]*ratio);
  data[p*4+3]=encode(1);
 }
 const texture=new THREE.DataTexture(data,aw,ah,THREE.RGBAFormat,THREE.HalfFloatType);
 texture.name='automotive authored sky '+(settings.artRef||'panorama');
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=THREE.RepeatWrapping;texture.needsUpdate=true;
 // Only one live art-derived probe is retained. Weather/manual profiles are
 // separate immutable cached sources and need no readback or regeneration.
 if(last)last.probe.texture.dispose();
 const probe={key:'authored-sky:'+key,texture};last={key,canvas,probe};return probe;
}
