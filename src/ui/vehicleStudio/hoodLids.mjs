import * as T from '../../vendorBridge/three.js';
import {fasciaMesh} from './fascia.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ch=.22,profile=[
 [-1+ch,-1],[1-ch,-1],[1,-1+ch],[1,1-ch],[1-ch,1],[-1+ch,1],[-1,1-ch],[-1,-1+ch]
];

// Cut the apertures into the actual hood, then span their visible gap with
// recessed backing. There is no painted line or floating piece to z-fight.
export function emitFlushHoodLids({cover,hoodLength,settings,across,along,compact,put,lampMounts}){
 const surface=(u,v)=>cover(u,v);
 const inset=settings.lampLids==='inset';
 const section=inset?Array.from({length:compact?12:20},(_,i)=>{
  const a=i/(compact?12:20)*Math.PI*2;return [Math.cos(a),Math.sin(a)];
 }):profile;
 const wide=surface(1,.14)[0]-surface(0,.14)[0];
 const yLen=hoodLength;
 const hw=clamp(settings.lidWidth/wide*.5,.031,.128),hv=clamp(settings.lidLength/yLen*.5,.044,.22);
 const center=clamp(settings.lidSpread,.23,.36);
 const v0=clamp(settings.lidSetback/yLen+hv,.045+hv,.92-hv);
 const insetU=clamp(settings.lidGap/wide,.001,.012),insetV=clamp(settings.lidGap/yLen,.001,.020);
 const paired=[-1,1].map(side=>{
  const u=.5+side*center,v=v0;
  const loop=(w,h)=>section.map(([x,y])=>[u+x*w-(inset?side*y*w*.13:0),v+y*h]);
  return {outline:loop(hw,hv),lip:loop(hw-insetU*.52,hv-insetV*.52),
   inner:loop(hw-insetU,hv-insetV),center:[u,v]};
 });
 const hood=fasciaMesh(surface,paired,{rear:true,across,down:along,tolerance:compact?.21:.114});
 if(settings.bonnetStripes){
  const uv=hood.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,1-uv.getY(i),uv.getX(i));
 }
 put('hood',settings.bonnetStripes?'bonnet-stripes':'paint',hood);
 function strip(rings,drop,center=null){
  const steps=section.length;
  const positions=rings.flatMap((r,j)=>r.flatMap(([u,v])=>surface(u,v).map((n,k)=>k===1?n-drop[j]:n)));
  const uv=rings.flat(1).flat(),index=[];
  for(let j=0;j<rings.length-1;j++)for(let k=0;k<steps;k++){
   const a=j*steps+k,b=j*steps+(k+1)%steps;index.push(a,b,b+steps,a,b+steps,a+steps);
  }
  if(center){
   const at=positions.length/3,tail=at-steps,p=surface(...center);
   positions.push(p[0],p[1]-drop.at(-1),p[2]);uv.push(...center);
   for(let k=0;k<steps;k++)index.push(tail+k,tail+(k+1)%steps,at);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();
  return geo;
 }
 for(const lid of paired){
  if(inset){
   if((settings.insetLampMounts||settings.bonnetStripes)&&lampMounts){
    const p=surface(...lid.center);p[1]-=.023;
    lampMounts['HeadlightMount_'+(lid.center[0]>.5?'L':'R')]=p;
   }
   const blend=(k)=>lid.inner.map(p=>p.map((n,j)=>lid.center[j]+(n-lid.center[j])*k));
   const bezel=blend(.89), bowl=blend(.50), core=blend(.27), cover=blend(.68);
   if(settings.classicLampBezel){
    put('headlights','chrome',strip([lid.outline,lid.inner],[0,.004]));
    put('headlights','seamDark',strip([lid.inner,bezel],[.004,.018]));
   }else put('headlights','seamDark',strip([lid.outline,lid.inner,bezel],[0,.008,.026]));
   put('headlights','reflector',strip([bezel,bowl,core],[.026,.030,.035]));
   put('headlights','projector',strip([core,blend(.14)],[.034,.024],lid.center));
   put('headlights','opticCover',strip([lid.inner,cover],[.006,.004],lid.center));
   continue;
  }
  const seam=strip([lid.outline,lid.lip,lid.inner],[0,.006,.001]);
  seam.userData.constructionRole='headlamp covers / recessed shutline';
  put('hood','seamDark',seam);
  const mid=lid.inner.map(p=>p.map((n,j)=>(n+lid.center[j])*.5));
  const insert=strip([lid.inner,mid],[.001,.001],lid.center);
  insert.userData.constructionRole='headlamp covers / painted lid';
  put('hood','paint',insert);
 }
 return hood.userData.trimArea;
}
