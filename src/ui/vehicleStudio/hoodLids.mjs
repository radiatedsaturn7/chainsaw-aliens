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
  const a=i/(compact?12:20)*Math.PI*2,x=Math.cos(a),y=Math.sin(a);
  if(!settings.lidBoxiness)return [x,y];
  const power=1-settings.lidBoxiness*.65;
  return [Math.sign(x)*Math.abs(x)**power,Math.sign(y)*Math.abs(y)**power];
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
   if(settings.activeInsetLamps){
    // Reuse the real projector rim and render only its central element as
    // a headlight channel. Keep the silver holder passive with lights off.
    put('headlights','projector',strip([core,blend(.14)],[.034,.024]));
    put('headlights','head',strip([blend(.14)],[.024],lid.center));
    // The amber element belongs to the outboard sector of the recessed
    // cavity. Fit the small reflector in the same trimmed surface chart.
    const sign=lid.center[0]>.5?1:-1;
    const [u,v]=lid.center;
    const x=u+sign*(hw-insetU)*.55,y=v+(hv-insetV)*.12;
    const indicator=k=>section.map(([a,b])=>[x+k*a*(hw-insetU)*.19,y+k*b*(hv-insetV)*.23]);
    put('headlights',sign>0?'signalR':'signalL',strip([indicator(1),indicator(.75)],[.014,.012],[x,y]));
   }else put('headlights','projector',strip([core,blend(.14)],[.034,.024],lid.center));
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

// Hood-top combination lamp seat. Cut through the hood surface first, then
// use the same parametric contour for the formed pocket, gasket and lens.
export function emitIntegratedHoodMarkers({cover,hoodLength,length,depth,across,along,compact,put,material}){
 const end=clamp(length/hoodLength,.075,.70), start=.029;
 const steps=compact?12:24;
 const paired=[-1,1].map(side=>{
  const center=[.5+side*.405,start+end*.5];
  const outline=Array.from({length:steps},(_,i)=>{
   const a=i/steps*Math.PI*2,t=(1-Math.cos(a))/2;
   const x=.867+.069*t;
   return [.5+side*(x-.5)+(.025+.015*t)*Math.sin(a),start+end*t];
  });
  if(side<0)outline.reverse();
  return {side,center,outline};
 });
 const hood=fasciaMesh(cover,paired,{rear:true,across,down:along,tolerance:compact?.21:.114});
 if(material==='bonnet-stripes'){
  const uv=hood.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,1-uv.getY(i),uv.getX(i));
 }
 put('hood',material,hood);
 for(const {side,center,outline} of paired){
  const mesh=(rings,fill=false,drift=0)=>{
   const pos=[],uv=[],ids=[];
   for(const [scale,lift] of rings)for(const p of outline){
    const u=center[0]+(p[0]-center[0])*scale+side*drift*.09,v=center[1]+(p[1]-center[1])*scale+drift;
    const q=cover(u,v);q[1]+=lift;pos.push(...q);uv.push(u,v);
   }
   for(let j=1;j<rings.length;j++)for(let k=0;k<steps;k++){
    const a=(j-1)*steps+k,b=(j-1)*steps+(k+1)%steps;
    ids.push(a,b,b+steps,a,b+steps,a+steps);
   }
   if(fill){
    const tail=(rings.length-1)*steps,u0=center[0]+side*drift*.09,v0=center[1]+drift, q=cover(u0,v0);q[1]+=rings.at(-1)[1]+.001;
    pos.push(...q);uv.push(u0,v0);
    for(let k=0;k<steps;k++)ids.push(tail+k,tail+(k+1)%steps,tail+steps);
   }
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
   geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ids);geo.computeVertexNormals();return geo;
  };
  put('headlights',material==='roofPaint'?'roofPaint':'paint',mesh([[1,0],[.96,-depth*.21]]));
  put('headlights','seamDark',mesh([[.96,-depth*.21],[.88,-depth*.51],[.83,-depth*.76]]));
  put('headlights','reflector',mesh([[.84,-depth*.76],[.66,-depth*.80]],true));
  put('headlights',side>0?'signalR':'signalL',mesh([[.43,-depth*.65],[.26,-depth*.62]],true,end*.17));
  put('headlights','opticCover',mesh([[.90,-depth*.34],[.80,-depth*.27],[.35,-depth*.22]],true));
 }
 return hood.userData.trimArea;
}
