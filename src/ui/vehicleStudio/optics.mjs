// Fascia apertures and optical parts share an exact parameter-space rim.
// Surface coordinates: u increases chassis X, v goes from hood to road.
import {getSideSettings} from './genome.mjs';
import {compileFormula} from './formula9.mjs';
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
const layouts=new Set(['projector','twin','led','mixed','factory-split']);
function curvePolygon(points,r,n){
 const controls=(p,q,t)=>p.map((x,i)=>mix(x,q[i],t));
 const list=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],a=controls(p,points[(i+points.length-1)%points.length],r),b=controls(p,points[(i+1)%points.length],r);
  list.push(...pairs(6,t=>controls(controls(a,p,t),controls(p,b,t),t)),b);
 }
 const sums=[0];for(let i=0;i<list.length;i++){const a=list[i],b=list[(i+1)%list.length];sums.push(sums.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
 return pairs(n,t=>{const target=t*sums.at(-1);let i=0;while(sums[i+1]<target)i++;return controls(list[i],list[(i+1)%list.length],(target-sums[i])/(sums[i+1]-sums[i]||1));});
}
function shape(type,{corner=.5,angle=0,sweep=.5,outline=[],segments=32,formula='',formulaSide=1}={}){
 const p=type==='circle'||type==='oval'?pairs(segments,t=>[Math.cos(t*tau),Math.sin(t*tau)]):curvePolygon(profiles[type]??profiles['round-rect'],mix(.025,.38,corner),segments);
 const custom=compileFormula(formula);
 const q=p.map(([x,y])=>{
  const a=(Math.atan2(y,x)/tau+1)%1*8,i=Math.floor(a),j=(i+1)%8;
  const t=a-i,theta=Math.atan2(y,x),u=(theta/tau+1)%1;
  const offset=.12*signed(custom({u,t:u,x,y,v:y,theta,side:formulaSide}));
  const scale=1+.13*mix(signed(num(outline[i],0)),signed(num(outline[j],0)),t*t*(3-2*t))+offset;
  return [x*scale,y*scale+x*angle*.29+(sweep-.5)*.32*x*x];
 });
 const xMax=Math.max(...q.map(p=>Math.abs(p[0]))),yMax=Math.max(...q.map(p=>Math.abs(p[1])));
 return q.map(([x,y])=>[x/xMax,y/yMax]);
}
function aperture({id,component,housing,cx,cy,width,height,side=1,opt={},kind='lamp',style,segments=32}){
 const base=shape(housing,{...opt,segments});
 const outline=base.map(([x,y])=>[cx+side*(x*width/2+(x<0?x*(num(opt.inboardReach,.5)-.5)*.15:0)),cy+y*height/2]);
 return {id,component,outline,kind,opt,center:[cx,cy],width,height,side,style};
}
export function makeOpenings({end,g,segments=32}){
 const front=end==='front',c=g.components??{},legacy=c[front?'headlights':'tails']??{},base=g.optics?.[end]??{},group=front?'headlights':'taillights';
 const fascia=g.fascia?.[end]??{},mode=fascia.intakes??'single',out=[];
 for(const s of [-1,1]){
 const raw=getSideSettings(g,group,s>0?'R':'L',base);
 const housing=HOUSING_FAMILIES.includes(raw.housing)?raw.housing:
  (legacy.type==='round'?'circle':legacy.type==='rectangular'||legacy.type==='strip'?'round-rect':front?'swept':'trapezoid');
 const opt={housing,layout:layouts.has(raw.layout)?raw.layout:(legacy.type==='strip'?'led':front?'twin':'mixed'),
   width:sat(num(raw.width,.5)),height:sat(num(raw.height,.5)),corner:sat(num(raw.corner,.5)),
   angle:signed(num(raw.angle,(legacy.angle||0)/18)),sweep:sat(num(raw.sweep,.5)),
   curvature:sat(num(raw.curvature,.5)),recess:sat(num(raw.recess,.5)),convexity:sat(num(raw.convexity,.5)),
   sideWrap:sat(num(raw.sideWrap,0)),silverUpper:sat(num(raw.silverUpper,0)),rearCells:sat(num(raw.rearCells,0)),roundBowls:sat(num(raw.roundBowls,0)),flutedBowls:sat(num(raw.flutedBowls,0)),position:sat(num(raw.position,.5)),protrusion:sat(num(raw.protrusion,0)),formula:raw.formula??'',modules:Math.max(0,Math.min(8,Math.round(raw.modules??0))),spacing:sat(num(raw.spacing,.5)),inboardReach:sat(num(raw.inboardReach,.5)),formulaSide:g.construction?.symmetry?.[group]==='linked'?s:1,outline:Array.isArray(raw.outline)?raw.outline:[]};

 // The bands are deliberately disjoint even at all slider extremes:
 // lamp inside <= .366; center grille starts >= .388; lower intakes start >= .31.
 const sideBase=front?mix(.189,.231,opt.position):mix(.196,.229,opt.position);
 const sideX=sideBase-(num(raw.outboard,.5)-.5)*.092;
 const h0=mix(.129,front?.347:.295,housing==='circle'?opt.height*.58+opt.width*.42:opt.height);
 const w=Math.min(housing==='circle'?h0*.46:mix(.132,.308,opt.width),2*(sideX-.025));
 const h=(housing==='oval'?h0*.85:h0)*(front?1:1+Math.max(0,Math.min(.42,num(raw.tallHousing,0))));
 const cy=Math.max(.022+h/2,Math.min(front?mix(.127,.408,opt.position):mix(.176,.462,opt.position),1-h*.5-.045));
 out.push(aperture({id:(front?'head':'tail')+(s>0?'-l':'-r'),
  component:front?'headlights':'tails',housing,cx:s>0?1-sideX:sideX,cy,width:w,height:h,side:s,opt,segments}));
 }
 if(front){
  const gr=c.grille??{},fog=c.fogs??{};
  if(gr.type!=='closed')out.push(aperture({id:'upper-grille',component:'grille',housing:fascia.grilleShape??'trapezoid',cx:.5,cy:.415+(num(fascia.grilleHeightPosition,.5)-.5)*.43,
   width:Math.min(mix(.155,.256,sat((num(gr.size,1)-.68)/.60))*(.56+.88*num(fascia.grilleWidth,.5)),2*(.49-Math.max(...out.filter(o=>o.center[0]<.5).flatMap(o=>o.outline.map(p=>p[0])))),2*(Math.min(...out.filter(o=>o.center[0]>.5).flatMap(o=>o.outline.map(p=>p[0])))-.51)),height:mix(.13,.238,sat((num(gr.depth,1)-.68)/.60))*(.58+.84*num(fascia.grilleHeight,.5)),
   kind:'duct',segments,style:gr.type==='bars'?'bars':'mesh'}));
  for(const s of [-1,1]){
   const sideFog=getSideSettings(g,'fogs',s>0?'R':'L',fog);
   if(sideFog.type==='off')continue;
   out.push(aperture({id:'fog'+(s>0?'-l':'-r'),component:'fogs',
   housing:sideFog.type==='strip'||sideFog.type==='blank'?'round-rect':'oval',cx:.5+s*.277,cy:.765,
   width:mix(.065,.151,sat(num(sideFog.size,1)*.53)),height:sideFog.type==='strip'?.070:mix(.107,.174,sat(num(sideFog.depth,1)*.52))*(sideFog.type==='blank'?mix(.60,1.75,num(fascia.fogCoverHeight,.5))/1.175:1),
   kind:sideFog.type==='blank'?'blank':'fog',segments,side:s,opt:{layout:'projector',protrusion:0}}));
  }
 }
 if(!front&&g.construction){
  const height=(.125+(num(fascia.plateHeight,.5)-.5)*.214)*(1+num(fascia.plateOpeningStretch,0));
  const y=Math.max(.18+height/2,Math.min(num(fascia.platePosition,.615),.955-height/2));
  out.push(aperture({id:'rear-plate-recess',component:'rearBumper',housing:'round-rect',cx:.5,cy:y,
   width:mix(.155,.291,num(fascia.plateWidth,.5)),height,kind:'plate',opt:{mount:num(fascia.plateMount,0),painted:num(fascia.paintedPocket,0),corner:num(fascia.plateMount,0)>0?.23:.5},segments}));
 }
 if(!front&&(fascia.deckPanel??0)>0){
  const plate=out.find(o=>o.kind==='plate');
  const hi=Math.min(.483,plate?Math.min(...plate.outline.map(p=>p[1]))-.02:.483);
  const top=.026,bottom=Math.min(hi,mix(.28,.495,num(fascia.deckHeight,.5)));
  const width=mix(.16,.34,num(fascia.deckWidth,.5));
  if(bottom-top>.10){
   const lamps=out.filter(o=>o.kind==='lamp');
   // Clip against the inwardmost part of each lamp over the neighboring
   // station interval, not only at the sample. Joining segments therefore
   // cannot cut through a shallow or steeply sloped light outline.
   const count=24, step=(bottom-top)/count;
   function outer(y){
    const lo=y-step-.001,hi=y+step+.001;
    let reach=width*(1-.18*((y-top)/(bottom-top))**1.33);
    for(const o of lamps){
     for(let k=0;k<o.outline.length;k++){
      const a=o.outline[k],b=o.outline[(k+1)%o.outline.length];
      if(Math.max(a[1],b[1])<lo||Math.min(a[1],b[1])>hi)continue;
      const f=v=>Math.abs(b[1]-a[1])>1e-10?mix(a[0],b[0],sat((v-a[1])/(b[1]-a[1]))):a[0];
      const v=[f(lo),f(hi),...(a[1]>=lo&&a[1]<=hi?[a[0]]:[]),...(b[1]>=lo&&b[1]<=hi?[b[0]]:[])];
      reach=Math.min(reach,...v.map(x=>Math.abs(.5-x)-.012));
     }
    }
    return Math.max(.047,reach);
   }
   // Use straight draft rails across the whole drop. A footprint can
   // never follow the light's scallops and double back through itself.
   const bound=Array.from({length:count+1},(_,i)=>outer(mix(top,bottom,i/count)));
   const drafting=t=>(1-t)**(1+2.2*num(fascia.deckRailCurve,0));
   const lower=Math.min(...bound)*.978;
   const upper=Math.min(width,...bound.slice(0,-1).map((q,i)=>{
    const a=drafting(i/count);return lower+(q-lower)/a;
   }));
   const side=sign=>Array.from({length:count+1},(_,i)=>{
    const t=i/count,y=mix(top,bottom,t);
    const radius=num(fascia.deckLowerRoll,0);
    const tip=t>.76?(t-.76)/.24:0;
    const bevel=(i===0||i===count?.965:1)*(1-.13*radius*tip**2);
    return [.5+sign*mix(lower,upper,drafting(t))*bevel,y];
   });
   out.push({id:'rear-deck-insert',component:'trunk',kind:'deck',outline:[...side(1),...side(-1).reverse()],center:[.5,(top+bottom)/2],opt:{depth:fascia.deckPanel,soft:fascia.deckSurfaceBlend}});
  }
 }
 if(mode!=='closed'){
  const grp=front?'frontBumper':'rearBumper',iMode=mode==='split'?'split':'single';
  const wideDucts=front&&c.fogs?.type==='off';
  const pair=wideDucts?[.285,.715]:[.395,.605];
  for(const k of iMode==='split'?pair:[.5]){
   let cy=(front?.789:.78)+(num(fascia.intakeHeightPosition,.5)-.5)*.29;
   const height=(front?(wideDucts&&iMode==='split'?.23:.19):.14)*(.57+.86*num(fascia.intakeHeight,.5));
   if(!front)cy=Math.max(cy,.685+height*.5);
   cy=Math.min(cy,.975-height*.5);
   let width=(iMode==='split'?(wideDucts?.24:.17):.365)*(.63+.74*num(fascia.intakeWidth,.5));
   if(iMode==='split')width=Math.min(width,pair[1]-pair[0]-.014);
   for(const aperture of out){
    const ys=aperture.outline.map(p=>p[1]);if(Math.max(...ys)+.007<cy-height/2||Math.min(...ys)-.007>cy+height/2)continue;
    const xs=aperture.outline.map(p=>p[0]);
    if(aperture.center[0]<k)width=Math.min(width,2*(k-Math.max(...xs)-.008));
    else if(aperture.center[0]>k)width=Math.min(width,2*(Math.min(...xs)-k-.008));
   }
   if(width<.032)continue;
   out.push(aperture({id:(front?'lower-':'rear-')+'duct'+(k<.48?'-r':k>.52?'-l':''),component:grp,
    housing:fascia.intakeShape??(front?'angular':'trapezoid'),cx:k,cy,width,height,kind:'duct',segments,style:fascia.ductStyle??'mesh'}));
  }
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
  const out=p[a].out??p[b].out??p[c].out;
  if(out?x*out[0]+y*out[1]+z*out[2]>=0:z*sign>=0)fs.push(a,b,c);else fs.push(a,c,b);
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
export function emitOpenings({end,openings,surface,put,lod=false,compact=0,spatialDepth=false}){
 const front=end==='front',sign=front?1:-1,mounts={},issues=[],batches=new Map();
 for(const a of openings){
  const {outline,center:[cx,cy],opt,kind,width:w,height:h,side}=a;
  const pt=(x,y,d)=>{
   const p=point3(surface(x,y)),uv=[x,1-y];
   if(!spatialDepth)return {pos:[p[0],p[1],p[2]-sign*d],uv};
   const a=new T.Vector3(...surface(Math.min(1,x+.0006),y)).sub(new T.Vector3(...surface(Math.max(0,x-.0006),y)));
   const b=new T.Vector3(...surface(x,Math.min(1,y+.0006))).sub(new T.Vector3(...surface(x,Math.max(0,y-.0006))));
   const out=b.cross(a).normalize().multiplyScalar(sign).toArray();
   return {pos:p.map((k,i)=>k-out[i]*d),out,uv};
  };
  const ring=(k,d,poly=outline,x=cx,y=cy)=>poly.map(([u,v])=>pt(mix(x,u,k),mix(y,v,k),d));
  const putGeo=(m,rows,disk=null)=>{
   const q=makeMesh(rows,sign,{disk});
   if(!q)return;
   if(m==='opticCover')return put(a.component,m,q);
   const key=a.component+' '+m;
   if(!batches.has(key))batches.set(key,{component:a.component,material:m,geos:[]});
   batches.get(key).geos.push(q);
  };
  if(kind==='deck'){
   // Closed return under the panel: a physical narrow seam, never a slit through the car.
   const soft=num(opt.soft,0),d=mix(.002,.009,num(opt.depth,0));
   const wall=mix(.997,.993,soft),gap=mix(.980,.986,soft),back=mix(.970,.978,soft),panel=mix(.967,.975,soft);
   putGeo('paint',[ring(1,0),ring(wall,.001)]);
   putGeo('seamDark',[ring(wall,.001),ring(gap,d+.002),ring(back,d+.002)]);
   putGeo('paint',[ring(back,d+.002),ring(panel,d),ring(.72,d),ring(.44,d),ring(.18,d)],pt(cx,cy,d));
   continue;
  }
  const mouth=ring(1,0); const lip=ring(.965,.005), seat=ring(.912,.015);
  // Shared rim exactly duplicated at d=0 (no opening exists behind a closed slab).
  putGeo('paint',[mouth,lip]);putGeo('trim',[lip,seat]);
  if(kind==='blank'){
   putGeo('paint',[seat,ring(.88,.013),ring(.84,.010)],pt(cx,cy,.009));continue;
  }
  if(kind==='plate'){
   const show=num(opt.mount,0);
   if(show>0){
    const D=.022+show*.015,innerW=.34*w,innerH=.365*h;
    const rect=[[cx-innerW,cy-innerH],[cx+innerW,cy-innerH],[cx+innerW,cy+innerH],[cx-innerW,cy+innerH]];
    putGeo('paint',[seat,ring(.87,.014),ring(.82,D)],pt(cx,cy,D+.001));
    if(!opt.painted){
     putGeo('trim',[ring(1,D-.002,rect),ring(.95,D-.007,rect)],pt(cx,cy,D-.007));
     putGeo('floor',[ring(.90,D-.008,rect)],pt(cx,cy,D-.008));
    }
    for(const k of [-1,1]){const x=cx+k*innerW*.74,y=cy-innerH*.73,vs=pairs(8,t=>[x+w*.018*Math.cos(t*tau),y+h*.024*Math.sin(t*tau)]);
     putGeo('chrome',[ring(1,D-.010,vs,x,y)],pt(x,y,D-.011));
    }
    continue;
   }
   putGeo('trim',[seat,ring(.87,.020),ring(.82,.031)],pt(cx,cy,.032));
   putGeo('seamDark',[ring(.78,.024),ring(.75,.022)],pt(cx,cy,.021));continue;
  }
  if(kind==='duct'){
   const d=.047;const back=ring(.79,d);
   putGeo('trim',[seat,ring(.857,.028),back],pt(cx,cy,d-.002));
   const n=compact?(a.style==='bars'?3:4):a.style==='bars'?4:7, inset=outline.map(([x,y])=>[mix(cx,x,.74),mix(cy,y,.73)]);
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
   let x0=cx+side*offset*w,y0=cy+.015*h;
   const round=front?num(opt.roundBowls,0):0,flute=front?num(opt.flutedBowls,0):0;
   if(round){
    const probe=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
    const dx=probe(surface(x0+.002,y0),surface(x0-.002,y0)),dy=probe(surface(x0,y0+.002),surface(x0,y0-.002));
    const auto=Math.max(ry*.75,Math.min(.50,rx*w*dx/(Math.max(1e-7,dy)*h)));
    ry=mix(ry,auto,round);rx*=mix(1,1.08,round);y0+=h*.015*round;
   }
   const {x,y,p}=fitted(x0,y0,w*rx,h*ry,compact?9:lod?12:18);
   const rr=(k,depth)=>ring(k,depth,p,x,y).map((q,i)=>{
    if(!flute)return q;
    const a=2*Math.PI*i/p.length;q.uv=[.5+.49*k*Math.cos(a),.5+.49*k*Math.sin(a)];return q;
   });
   if(flute){
    const fg=flute*.12;
    putGeo('reflectorFluted',[rr(1,d*.42),...(compact?[rr(.76,d*(.54+fg)),rr(.39,d*(.77+fg))]:[rr(.92,d*.43),rr(.79,d*(.54+fg)),rr(.58,d*(.68+fg)),rr(.39,d*(.77+fg))])]);
    putGeo('trim',[rr(.54,d*.65),rr(.47,d*.59),rr(.39,d*.60)]);
    putGeo('projector',[rr(.40,d*.581),rr(.29,d*.535),rr(.13,d*.506)],pt(x,y,d*.502));
   }else{
    putGeo('reflector',[rr(1,d*.65),rr(.82,d*.73),rr(.47,d*.80)],pt(x,y,d*.81));
    putGeo(front?'projector':'opticRed',[rr(.51,bright?d*.60:d*.64),rr(.29,d*.55)],pt(x,y,d*.53));
   }
  };
  if(oLayout==='factory-split'){
   // Inside the sealed housing, divide the lens into two shallow molded
   // sections, independently of its external profile and cavity.
   const clip=(pol,line,keep)=>{
    const out=[];
    for(let i=0;i<pol.length;i++){
     const a=pol[i],b=pol[(i+1)%pol.length],y=line(a),z=line(b),ai=y*keep>=0,bi=z*keep>=0;
     if(ai)out.push(a);
     if(ai!==bi){const t=y/(y-z);out.push(a.map((q,k)=>mix(q,b[k],t)));}
    }
    return out;
   };
   const plate=(poly,m,depth)=>{
    if(poly.length<3)return;
    const x=poly.reduce((p,q)=>p+q[0],0)/poly.length,y=poly.reduce((p,q)=>p+q[1],0)/poly.length;
    putGeo(m,[ring(1,depth+.004,poly,x,y),ring(.94,depth,poly,x,y)],pt(x,y,depth-.002));
   };
   const line=front?([x,y])=>(y-cy)+.20*(x-cx)*side+h*.17:([x,y])=>y-cy+(x-cx)*side*.13+h*(opt.silverUpper>0?-.018:.13);
   const zones=outline.map(([x,y])=>[mix(cx,x,.89),mix(cy,y,.88)]);
   if(front){
    const outer=clip(zones,([x])=>(x-cx)*side+w*.12,1);
    plate(clip(outer,line,-1),side>0?'signalR':'signalL',d*.60);
    if(opt.flutedBowls){proj(-.34,.200,.38);proj(.072,.177,.358,false);}
    else{proj(-.21,.164,.315);proj(.165,.154,.29,false);}
   }else{
    const redZone=clip(zones,q=>line(q)-.0009,1);
    plate(redZone,'opticRed',d*.46);
    plate(clip(zones,q=>line(q)+.0009,-1),opt.silverUpper>0?'opticSilver':'opticClear',d*.46);
    if(opt.silverUpper>0){
     const lens=fitted(cx-side*w*.09,cy-h*.225,w*.060,h*.066,lod?10:14),lr=(k,dep)=>ring(k,dep,lens.p,lens.x,lens.y);
     putGeo('opticClear',[lr(1,d*.414),lr(.77,d*.392)],pt(lens.x,lens.y,d*.389));
    }
    if(opt.rearCells&&redZone.length>2){
     const center=redZone.reduce(([x,y],p)=>[x+p[0]/redZone.length,y+p[1]/redZone.length],[0,0]);
     const rx0=w*.139,ry0=h*.16;
     for(const slot of [-1,1]){
      // Lens ribs stay inside the red chamber even on extreme swept housings.
      // Both optical functions remain behind the common transparent cover.
      let x=center[0]+side*w*slot*.157,y=center[1]+h*.025,rx=rx0,ry=ry0,poly;
      for(let i=0;i<9;i++){
       poly=ellipse(x,y,rx,ry,compact?10:lod?14:22);
       if(poly.every(p=>contains(redZone,p[0],p[1])))break;
       rx*=.86;ry*=.86;x=mix(center[0],x,.91);y=mix(center[1],y,.93);
      }
      if(rx<rx0*.39||!poly.every(p=>contains(redZone,p[0],p[1])))continue;
      const rr=(k,dep)=>ring(k,dep,poly,x,y);
      putGeo('opticRed',[rr(1,d*.413),rr(.79,d*.306),rr(.57,d*.327)]);
      putGeo('runningRed',[rr(.57,d*.327),rr(.44,d*.343)],pt(x,y,d*.378));
     }
    }else{
     const t=fitted(cx+side*w*.12,cy+h*.19,w*.24,h*.106,lod?12:16);
     putGeo('runningRed',[ring(1,d*.40,t.p,t.x,t.y),ring(.87,d*.36,t.p,t.x,t.y)],pt(t.x,t.y,d*.35));
    }
   }
  }
  if(oLayout==='projector')proj(0,.23,.29);
  if(oLayout==='twin'){proj(-.19,.159,front?.289:.255);proj(.17,.135,front?.268:.227,false);}
  if(oLayout==='mixed')proj(-.14,.16,.227);
  if(oLayout==='led'||oLayout==='mixed'||opt.modules>0){
   const count=opt.modules||5,spacing=(.42+.26*(opt.spacing??.5))/Math.max(count-1,1);
   for(let i=0;i<count;i++){
    const along=count===1?0:(i-(count-1)*.5)*spacing;
    const {x,y,p:poly}=fitted(cx+side*w*(oLayout==='mixed'?(.13+along*.48):along),cy+(oLayout==='mixed'?.02:-.015)*h,w*Math.min(.037,.19/count),h*.105,lod?6:8);
    putGeo(front?'head':'opticRed',[ring(1,d*.66,poly,x,y),ring(.72,d*.50,poly,x,y)],pt(x,y,d*.48));
   }
  }
  if(kind==='lamp'&&oLayout!=='factory-split'){
   const {x,y,p}=fitted(cx+side*w*(oLayout==='twin'?.34:.303),cy+h*.223,w*.058,h*.058,10);
   putGeo(front?(side>0?'signalR':'signalL'):'opticClear',[ring(1,d*.68,p,x,y),ring(.78,d*.54,p,x,y)],pt(x,y,d*.52));
   if(!front){
    const m=fitted(cx-side*w*.23,cy-h*.25,w*.086,h*.072,10);
    putGeo(side>0?'signalR':'signalL',[ring(1,d*.60,m.p,m.x,m.y),ring(.74,d*.48,m.p,m.x,m.y)],pt(m.x,m.y,d*.48));
   }
  }
  // Convex lens follows parametric fascia wrap, with independent radial
  // center curvature; default is recessed and never a solid white face.
  if(!front&&oLayout!=='factory-split'){
   const strip=fitted(cx,cy+h*.24,w*.31,h*.072,lod?10:14);
   putGeo('runningRed',[ring(1,d*.37,strip.p,strip.x,strip.y),ring(.87,d*.34,strip.p,strip.x,strip.y)],pt(strip.x,strip.y,d*.34));
  }
  const coverOuter=mix(.010,.017,num(opt.curvature,.5))-maxProtrusion*.010;
  const convex=mix(.002,.012,num(opt.convexity,.5));
  const coverCenter=coverOuter-convex;
  putGeo('opticCover',[ring(.925,coverOuter),...(compact?[ring(.48,coverOuter-convex*.76)]:[ring(.68,coverOuter-convex*.53),ring(.31,coverOuter-convex*.89)])],pt(cx,cy,coverCenter));
  if(kind==='lamp'){
   const x=cx+(oLayout==='twin'||oLayout==='factory-split'&&front?-.19:oLayout==='mixed'?-.14:0)*side*w;
   mounts[(front?'HeadlightMount_':'TaillightMount_')+(side>0?'L':'R')]=pt(x,cy,d*.47).pos;
  }
 }
 for(const {component,material,geos} of batches.values())put(component,material,together(geos));
 return {mounts,issues};
}
