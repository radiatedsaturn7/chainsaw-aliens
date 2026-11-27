// Fascia apertures and optical parts share an exact parameter-space rim.
// Surface coordinates: u increases chassis X, v goes from hood to road.
import * as T from '../../vendorBridge/three.js';

const tau=2*Math.PI;
const sat=(x)=>Math.max(0,Math.min(1,x));
const signed=x=>Math.max(-1,Math.min(1,x));
const num=(x,d)=>Number.isFinite(x)?x:d;
const mix=(a,b,t)=>a+(b-a)*t;
const pairs=(n,fn)=>Array.from({length:n},(_,i)=>fn(i/n,i));
const profiles={
 rectangle:[[-1,-1],[1,-1],[1,1],[-1,1]],
 'round-rect':[[-.84,-1],[.84,-1],[1,-.73],[1,.73],[.84,1],[-.84,1],[-1,.73],[-1,-.73]],
 trapezoid:[[-.72,-1],[.72,-1],[1,1],[-1,1]],
 angular:[[-.92,-.63],[-.48,-1],[.7,-1],[1,-.43],[.81,.68],[.38,1],[-.78,.85],[-1,.22]],
 swept:[[-1,-.41],[-.64,-.78],[.84,-1],[1,-.68],[.81,.28],[.49,.98],[-.8,1],[-1,.41]],
 wrap:[[-1,-.31],[-.88,-.72],[.43,-1],[.94,-.88],[1,-.45],[.8,.28],[.41,.84],[-.69,1],[-1,.70]],
 compound:[[-1,-.36],[-.79,-.77],[-.29,-.99],[.24,-.87],[.83,-.98],[1,-.69],[.95,.33],[.72,.89],[.27,.82],[-.36,1],[-.82,.78],[-1,.31]]
};
export const HOUSING_FAMILIES=['round-rect','circle','oval','rectangle','trapezoid','angular','swept','wrap','compound'];
const layouts=new Set(['projector','twin','led','mixed']);
function curvePolygon(points,r){
 const controls=(p,q,t)=>p.map((x,i)=>mix(x,q[i],t));
 const list=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],a=controls(p,points[(i+points.length-1)%points.length],r),b=controls(p,points[(i+1)%points.length],r);
  list.push(...pairs(6,t=>controls(controls(a,p,t),controls(p,b,t),t)),b);
 }
 const sums=[0];for(let i=0;i<list.length;i++){const a=list[i],b=list[(i+1)%list.length];sums.push(sums.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
 return pairs(32,t=>{const target=t*sums.at(-1);let i=0;while(sums[i+1]<target)i++;return controls(list[i],list[(i+1)%list.length],(target-sums[i])/(sums[i+1]-sums[i]||1));});
}
function shape(type,{corner=.5,angle=0,sweep=.5,outline=[]}={}){
 const p=type==='circle'||type==='oval'?pairs(32,t=>[Math.cos(t*tau),Math.sin(t*tau)]):curvePolygon(profiles[type]??profiles['round-rect'],mix(.025,.38,corner));
 const q=p.map(([x,y])=>{
  const a=(Math.atan2(y,x)/tau+1)%1*8,i=Math.floor(a),j=(i+1)%8;
  const t=a-i,scale=1+.13*mix(signed(num(outline[i],0)),signed(num(outline[j],0)),t*t*(3-2*t));
  return [x*scale,y*scale+x*angle*.29+(sweep-.5)*.32*x*x];
 });
 const xMax=Math.max(...q.map(p=>Math.abs(p[0]))),yMax=Math.max(...q.map(p=>Math.abs(p[1])));
 return q.map(([x,y])=>[x/xMax,y/yMax]);
}
const fit=(p,cx,cy,w,h,side=1)=>p.map(([x,y])=>[cx+side*x*w/2,cy+y*h/2]);
function aperture({id,component,housing,cx,cy,width,height,side=1,opt={},kind='lamp',style}){
 const outline=fit(shape(housing,opt),cx,cy,width,height,side);
 return {id,component,outline,kind,opt,center:[cx,cy],width,height,side,style};
}
export function makeOpenings({end,g}){
 const front=end==='front',c=g.components??{},legacy=c[front?'headlights':'tails']??{},raw=g.optics?.[end]??{};
 const housing=HOUSING_FAMILIES.includes(raw.housing)?raw.housing:
  (legacy.type==='round'?'circle':legacy.type==='rectangular'||legacy.type==='strip'?'round-rect':front?'swept':'trapezoid');
 const opt={housing,layout:layouts.has(raw.layout)?raw.layout:(legacy.type==='strip'?'led':front?'twin':'mixed'),
   width:sat(num(raw.width,.5)),height:sat(num(raw.height,.5)),corner:sat(num(raw.corner,.5)),
   angle:signed(num(raw.angle,(legacy.angle||0)/18)),sweep:sat(num(raw.sweep,.5)),
   curvature:sat(num(raw.curvature,.5)),recess:sat(num(raw.recess,.5)),convexity:sat(num(raw.convexity,.5)),
   position:sat(num(raw.position,.5)),protrusion:sat(num(raw.protrusion,0)),outline:Array.isArray(raw.outline)?raw.outline:[]};
 const mode=g.fascia?.[end]?.intakes??'single';
 const out=[];
 // The bands are deliberately disjoint even at all slider extremes:
 // lamp inside <= .366; center grille starts >= .388; lower intakes start >= .31.
 const sideX=front?mix(.189,.231,opt.position):mix(.196,.229,opt.position);
 const h0=mix(.129,front?.290:.248,opt.height);
 const w=housing==='circle'?h0*.46:mix(.132,.296,opt.width);
 const h=housing==='oval'?h0*.85:h0;
 const cy=Math.max(.026+h/2,front?mix(.137,.416,opt.position):mix(.186,.472,opt.position));
 for(const s of [-1,1])out.push(aperture({id:(front?'head':'tail')+(s>0?'-l':'-r'),
  component:front?'headlights':'tails',housing,cx:s>0?1-sideX:sideX,cy,width:w,height:h,side:s,opt}));
 if(front){
  const gr=c.grille??{},fog=c.fogs??{};
  if(gr.type!=='closed')out.push(aperture({id:'upper-grille',component:'grille',housing:'trapezoid',cx:.5,cy:.415,
   width:mix(.145,.223,sat(num(gr.size,1)*.60)),height:mix(.119,.191,sat(num(gr.depth,1)*.65)),
   kind:'duct',style:gr.type==='bars'?'bars':'mesh'}));
  if(fog.type!=='off')for(const s of [-1,1])out.push(aperture({id:'fog'+(s>0?'-l':'-r'),component:'fogs',
   housing:fog.type==='strip'?'round-rect':'oval',cx:.5+s*.277,cy:.765,
   width:mix(.065,.151,sat(num(fog.size,1)*.53)),height:fog.type==='strip'?.070:mix(.107,.174,sat(num(fog.depth,1)*.52)),
   kind:'fog',side:s,opt:{...opt,layout:'projector'}}));
 }
 if(mode!=='closed'){
  const grp=front?'frontBumper':'rearBumper',iMode=mode==='split'?'split':'single';
  const wideDucts=front&&c.fogs?.type==='off';
  const pair=wideDucts?[.285,.715]:[.395,.605];
  for(const k of iMode==='split'?pair:[.5])out.push(aperture({
   id:(front?'lower-':'rear-')+'duct'+(k<.48?'-r':k>.52?'-l':''),component:grp,
   housing:front?'angular':'trapezoid',cx:k,cy:front?.789:.78,width:iMode==='split'?(wideDucts?.24:.17):.365,
   height:front?(wideDucts&&iMode==='split'?.23:.19):.14,kind:'duct',style:g.fascia?.[end]?.ductStyle??'mesh'}));
 }
 return out;
}
function spanAt(outline,y){
 const x=[];for(let k=0;k<outline.length;k++){const a=outline[k],b=outline[(k+1)%outline.length];
  if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))x.push(mix(a[0],b[0],(y-a[1])/(b[1]-a[1])));
 }
 return [Math.min(...x),Math.max(...x)];
}
function contains(poly,x,y){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [a,b]=poly[i],[c,d]=poly[j];
  if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
 }
 return inside;
}
function together(geos){
 if(geos.length<2)return geos[0];
 const A=['position','normal','uv'],data=Object.fromEntries(A.map(k=>[k,[]])),ndx=[];
 let off=0;
 for(const g of geos){
  for(const k of A)data[k].push(...g.attributes[k].array);
  for(const q of g.index.array)ndx.push(q+off);
  off+=g.attributes.position.count;g.dispose();
 }
 const out=new T.BufferGeometry();
 for(const k of A)out.setAttribute(k,new T.Float32BufferAttribute(data[k],k==='uv'?2:3));
 out.setIndex(ndx);return out;
}
function point3(p){return Array.isArray(p)?p:[p.x,p.y,p.z];}
function makeMesh(rows,sign,{disk=null}={}){
 const p=rows.flat();const pos=p.flatMap(v=>v.pos),uv=p.flatMap(v=>v.uv);const fs=[];
 const add=(a,b,c)=>{
  const [A,B,C]=[p[a].pos,p[b].pos,p[c].pos], U=B.map((x,k)=>x-A[k]),V=C.map((x,k)=>x-A[k]);
  const x=U[1]*V[2]-U[2]*V[1], y=U[2]*V[0]-U[0]*V[2],z=U[0]*V[1]-U[1]*V[0];
  if(Math.hypot(x,y,z)<1e-11)return;
  if(z*sign>=0)fs.push(a,b,c);else fs.push(a,c,b);
 };
 const n=rows[0].length;
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){
   const a=j*n+i,b=j*n+(i+1)%n,c=n+a,d=n+b;add(a,b,d);add(a,d,c);
 }
 if(disk){
  const s=p.length,b=p.length-n;p.push(disk);pos.push(...disk.pos);uv.push(...disk.uv);
  for(let i=0;i<n;i++)add(b+i,b+(i+1)%n,s);
 }
 if(!fs.length)return null;
 const geom=new T.BufferGeometry();
 geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geom.setIndex(fs);geom.computeVertexNormals();return geom;
}
export function emitOpenings({end,openings,surface,put}){
 const front=end==='front',sign=front?1:-1,mounts={},issues=[],batches=new Map();
 for(const a of openings){
  const {outline,center:[cx,cy],opt,kind,width:w,height:h,side}=a;
  const pt=(x,y,d)=>{const p=point3(surface(x,y));return {pos:[p[0],p[1],p[2]-sign*d],uv:[x,1-y]};};
  const ring=(k,d,poly=outline,x=cx,y=cy)=>poly.map(([u,v])=>pt(mix(x,u,k),mix(y,v,k),d));
  const putGeo=(m,rows,disk=null)=>{
   const q=makeMesh(rows,sign,{disk});
   if(!q)return;
   if(m==='opticCover')return put(a.component,m,q);
   const key=a.component+' '+m;
   if(!batches.has(key))batches.set(key,{component:a.component,material:m,geos:[]});
   batches.get(key).geos.push(q);
  };
  const mouth=ring(1,0); const lip=ring(.965,.005), seat=ring(.912,.015);
  // Shared rim exactly duplicated at d=0 (no opening exists behind a closed slab).
  putGeo('paint',[mouth,lip]);putGeo('trim',[lip,seat]);
  if(kind==='duct'){
   const d=.047;const back=ring(.79,d);
   putGeo('trim',[seat,ring(.857,.028),back],pt(cx,cy,d-.002));
   const n=a.style==='bars'?4:7, inset=outline.map(([x,y])=>[mix(cx,x,.74),mix(cy,y,.73)]);
   for(let j=0;j<n;j++){
    const y=cy+h*.52*((j+.5)/n-.5),r=h*(a.style==='bars'?.025:.014);
    const [l,rr]=spanAt(inset,y-r*.6),[l2,r2]=spanAt(inset,y+r*.6);
    const lo=Math.max(l,l2),hi=Math.min(rr,r2);
    if(!(hi>lo))continue;
    const bars=[[lo,y-r],[hi,y-r],[hi,y+r],[lo,y+r]];
    putGeo(a.style==='bars'?'chrome':'trim',[bars.map(([x,v])=>pt(x,v,.034)),bars.map(([x,v])=>pt(x,v,.038))],pt((lo+hi)/2,y,.033));
   }
   continue;
  }
  const d=mix(.044,.084,num(opt.recess,.5)), maxProtrusion=num(opt.protrusion,0);
  const bowl=ring(.843,d*.89);
  putGeo('trim',[seat,ring(.873,d*.59),bowl],pt(cx,cy,d));
  // A reflector subassembly never breaches the physical setback or housing.
  const oLayout=kind==='fog'?'projector':opt.layout;
  const ellipse=(x,y,rx,ry,n=18)=>pairs(n,t=>[x+rx*Math.cos(t*tau),y+ry*Math.sin(t*tau)]);
  const allowed=outline.map(([u,v])=>[mix(cx,u,.88),mix(cy,v,.88)]);
  function fitted(x,y,rx,ry,n){
   let p;
   for(let i=0;i<8;i++){
    p=ellipse(x,y,rx,ry,n);
    if(p.every(([u,v])=>contains(allowed,u,v)))break;
    x=mix(cx,x,.84);y=mix(cy,y,.76);rx*=.88;ry*=.88;
   }
   return {x,y,p};
  }
  const proj=(offset,rx,ry,bright=true)=>{
   const {x,y,p}=fitted(cx+side*offset*w,cy+.015*h,w*rx,h*ry,18);
   const rr=(k,depth)=>ring(k,depth,p,x,y);
   putGeo('chrome',[rr(1,d*.65),rr(.82,d*.73),rr(.47,d*.80)],pt(x,y,d*.81));
   putGeo(front?'head':'tail',[rr(.51,bright?d*.60:d*.64),rr(.29,d*.55)],pt(x,y,d*.53));
  };
  if(oLayout==='projector')proj(0,.23,.29);
  if(oLayout==='twin'){proj(-.19,.145,.255);proj(.17,.128,.227,false);}
  if(oLayout==='mixed')proj(-.14,.16,.227);
  if(oLayout==='led'||oLayout==='mixed'){
   for(let i=0;i<5;i++){
    const {x,y,p:poly}=fitted(cx+side*w*(oLayout==='mixed'?(.027+i*.052):(-.254+i*.126)),cy+(oLayout==='mixed'?.02:-.015)*h,w*.037,h*.105,8);
    putGeo(front?'head':'tail',[ring(1,d*.66,poly,x,y),ring(.72,d*.50,poly,x,y)],pt(x,y,d*.48));
   }
  }
  if(kind==='lamp'){
   const {x,y,p}=fitted(cx+side*w*(oLayout==='twin'?.34:.303),cy+h*.223,w*.058,h*.058,10);
   putGeo(front?'indicator':'head',[ring(1,d*.68,p,x,y),ring(.78,d*.54,p,x,y)],pt(x,y,d*.52));
  }
  // Convex lens follows parametric fascia wrap, with independent radial
  // center curvature; default is recessed and never a solid white face.
  const coverOuter=mix(.010,.017,num(opt.curvature,.5))-maxProtrusion*.010;
  const convex=mix(.002,.012,num(opt.convexity,.5));
  const coverCenter=coverOuter-convex;
  putGeo('opticCover',[ring(.925,coverOuter),ring(.68,coverOuter-convex*.53),
   ring(.31,coverOuter-convex*.89)],pt(cx,cy,coverCenter));
  if(kind==='lamp'){
   const x=cx+(oLayout==='twin'?-.19:oLayout==='mixed'?-.14:0)*side*w;
   mounts[(front?'HeadlightMount_':'TaillightMount_')+(side>0?'L':'R')]=pt(x,cy,d*.47).pos;
  }
 }
 for(const {component,material,geos} of batches.values())put(component,material,together(geos));
 return {mounts,issues};
}
