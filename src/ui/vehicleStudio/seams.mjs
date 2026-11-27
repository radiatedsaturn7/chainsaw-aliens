import * as T from '../../vendorBridge/three.js';

const EPS=1e-9;
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const minus=(a,b)=>a.map((x,i)=>x-b[i]);
const scaled=(a,k)=>a.map(x=>x*k);
const mix=(a,b,t)=>a+(b-a)*t;
const blend=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const unit=(a,fallback=[0,0,1])=>length(a)>EPS?scaled(a,1/length(a)):fallback.slice();
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>(x=clamp(x),x*x*(3-2*x));
const point=(p,where)=>{
 if(!p||p.length!==3||!Array.from(p).every(Number.isFinite))throw new RangeError('Non-finite side panel sample: '+where);
 return Array.from(p);
};
const num=(v,fallback,min,max)=>clamp(typeof v==='number'&&Number.isFinite(v)?v:fallback,min,max);
const strength=(v,fallback)=>v===true?1:v===false?0:num(v,fallback,0,1);
const finite=(v)=>Number.isFinite(v);
const degree=(a,b)=>Math.acos(clamp(dot(unit(a),unit(b)),-1,1))*180/Math.PI;

/** The profile uses physical dimensions (metres); strength controls are 0..1. */
export function normalizeSeamOptions(raw={}, defaultGap=.005){
 raw=raw&&typeof raw==='object'?raw:{};
 return {
  gap:num(raw.gap,num(defaultGap,.005,.001,.025),.001,.025),
  flush:num(raw.flush,0,-.018,.018),
  radius:num(raw.radius,.0016,0,.012),
  thickness:num(raw.thickness,.00135,.0003,.012),
  depth:num(raw.depth,.010,.002,.040),
  flange:strength(raw.flange,.82),
  seal:strength(raw.seal,.72),
  offset:num(raw.offset,0,-.042,.042),
  align:strength(raw.align,1),
  tangent:strength(raw.tangent,.83),
  curvature:strength(raw.curvature,.56),
  crease:strength(raw.crease,.10)
 };
}
const factor=(f)=>f*f*f*(f*(f*6-15)+10);
const oneMinus=(f)=>1-factor(f);
const tangentBasis=u=>u-6*u**3+8*u**4-3*u**5;
const curvatureBasis=u=>.5*u*u*(1-u)**3;
function boundedSampler(p){
 return (z,v)=>point(p.sample(clamp(z,p.start,p.end),clamp(v)),p.key);
}
function jet(p,z,v){
 const h=Math.min(.003,(p.end-p.start)*.15);
 const sample=p.read;
 const a=clamp(z,p.start,p.end);
 const head=sample(a,v);
 const lo=Math.max(p.start,Math.min(a-h,p.end-2*h)), mid=lo+h, hi=mid+h;
 const pa=sample(lo,v),pb=sample(mid,v),pc=sample(hi,v);
 const curvature=scaled(add(minus(pc,scaled(pb,2)),pa),1/(h*h));
 const tangent=add(scaled(minus(pc,pa),1/(2*h)),scaled(curvature,a-mid));
 // Even beyond a moved nominal join, callers never sample an evaluator
 // outside its known station interval. Use a short Taylor continuation.
 const dz=z-a;
 const continuation=dz===0?curvature:curvature.map(x=>clamp(x,-40,40));
 return {p:add(add(head,scaled(tangent,dz)),scaled(continuation,.5*dz*dz)),
  d:add(tangent,scaled(continuation,dz)),k:continuation};
}
function patch(rows){
 const w=rows[0].length, pos=rows.flat(2),indices=[];
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<w-1;j++){
  const a=i*w+j,b=a+w;
  indices.push(a,b,b+1,a,b+1,a+1);
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 const uvs=[];
 for(let i=0;i<rows.length;i++)for(let j=0;j<w;j++)uvs.push(i/(rows.length-1),j/(w-1));
 g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;
}
function seamShell(rows,normalAt){
 // The section turns under the surface as it moves into the gap. Arrange
 // winding once, rather than reversing independent triangles at the curl.
 const row=rows[0],next=rows[1];
 const n=cross(minus(next[0],row[0]),minus(next[1],row[0]));
 return patch(dot(n,normalAt)<0?rows.map(r=>r.slice().reverse()):rows);
}

const tessCount=(quality)=>quality==='export'?32:quality==='lod'?10:22;
const arcSamples=(quality)=>quality==='export'?[Math.PI/7,2*Math.PI/7,Math.PI*.5]
 :quality==='compact'?[]:quality==='lod'?[Math.PI*.5]:[Math.PI*.25,Math.PI*.5];
function gapParts(frames,cfg,half,quality='preview'){
  const parts=[];
  const lipRadius=Math.max(.00010,Math.min(cfg.radius,half*.57));
  const thickness=Math.min(cfg.thickness,.70*cfg.depth);
  const sideFor=flag=>frames.map((S)=>{
   const edge=S[flag===1?'pa':'pb'];
   const gapAxis=unit(minus(S.pb,S.pa),S.across);
   const towards=scaled(gapAxis,flag);
   const inwards=scaled(S.normal,-1);
   const r=Math.min(lipRadius,length(minus(S.pb,S.pa))*.275);
   const q=(a,b)=>add(add(edge,scaled(towards,a)),scaled(inwards,b));
   return [edge,...arcSamples(quality).map(t=>q(r*Math.sin(t),r*(1-Math.cos(t)))),
    q(r,Math.max(r+.00025,thickness+r))];
  });
  const mid=frames[Math.floor(frames.length/2)];
  parts.push({material:'paint',geometry:seamShell(sideFor(1),mid.normal),side:'rear',kind:'lip'},
             {material:'paint',geometry:seamShell(sideFor(-1),mid.normal),side:'front',kind:'lip'});
  { // A solid dark return remains even with the optional folded flange at zero.
   const rows=frames.map(S=>{
    const across=unit(minus(S.pb,S.pa),S.across);
    const inside=scaled(S.normal,-Math.max(cfg.depth,thickness+lipRadius+.0006));
    const margin=cfg.flange>0?cfg.flange*(.003+.004*cfg.flange):.001;
    const A=add(add(S.pa,scaled(across,-margin)),inside),B=add(add(S.pb,scaled(across,margin)),inside);
    return cfg.flange>0&&quality!=='compact'?[add(A,scaled(S.normal,-.0014*cfg.flange)),A,B,add(B,scaled(S.normal,-.0014*cfg.flange))]:[A,B];
   });
   parts.push({material:'seamDark',geometry:seamShell(rows,mid.normal),kind:'backing'});
  }
  if(cfg.seal>0){
   const rows=frames.map(S=>{
    const across=unit(minus(S.pb,S.pa),S.across);
    const span=length(minus(S.pb,S.pa));
    const inset=Math.max(.0035,cfg.depth*(.69+.13*(1-cfg.seal)),lipRadius+thickness+.00025);
    const level=add(S.cp,scaled(S.normal,-inset));
    return (quality==='compact'?[-1,1]:quality==='lod'?[-1,0,1]:[-1,-.65,0,.65,1]).map(x=>add(add(level,scaled(across,x*span*(.33+.21*cfg.seal))),
     scaled(S.normal,cfg.seal*.00085*(1-x*x))));
   });
   parts.push({material:'rubber',geometry:seamShell(rows,mid.normal),kind:'seal'});
  }
  return {parts,lipRadius,thickness};
}

/** Arbitrary nearby trim rails: e.g. hood, roof seal, deck, or door belt. */
export function buildPanelGap({edgeA,edgeB,normalAt,sample,settings={},gap=.005,quality='preview',stations=tessCount(quality)}={}){
 if(typeof sample!=='function'&&(typeof edgeA!=='function'||typeof edgeB!=='function')){
  throw new TypeError('Panel gap requires edgeA and edgeB samplers');
 }
 const tValues=typeof stations==='number'?Array.from({length:Math.round(clamp(stations,2,96))+1},(_,i)=>i/Math.round(clamp(stations,2,96))):Array.from(stations);
 if(tValues.length<2||tValues.length>97||tValues[0]!==0||tValues.at(-1)!==1||
    tValues.some((a,i)=>!Number.isFinite(a)||i>0&&a<=tValues[i-1]))throw new RangeError('Bad panel gap stations');
 const cfg=normalizeSeamOptions(settings,gap);
 const pair=(t)=>{
  const value=typeof sample==='function'?sample(t):null;
  const pa=point(value?.pa??value?.a??edgeA?.(t),'trim A'),
   pb=point(value?.pb??value?.b??edgeB?.(t),'trim B');
  const cp=blend(pa,pb,.5);
  const normal=unit(point(value?.normal??normalAt?.(t)??[0,1,0],'trim normal'),[0,1,0]);
  const across=unit(minus(pb,pa),[0,0,1]);
  return {pa,pb,cp,normal,across};
 };
 const frames=tValues.map(pair);
 const spans=frames.map(S=>length(minus(S.pb,S.pa)));
 if(Math.min(...spans)<.00005)throw new RangeError('Panel gap rails coincide');
 const {parts,lipRadius,thickness}=gapParts(frames,cfg,Math.min(...spans)*.5,quality);
 const metrics={gapMm:cfg.gap*1000,gapMinMm:Math.min(...spans)*1000,gapMaxMm:Math.max(...spans)*1000,
  radiusMm:lipRadius*1000,thicknessMm:thickness*1000,depthMm:cfg.depth*1000};
 return {parts,points:frames.map(S=>S.cp),sample:t=>pair(clamp(t)).cp,metrics};
}

/**
 * Side panels share a longitudinal master. Do not resize or slide the
 * whole face to accommodate trim: all shifts vanish outside bounded joint
 * strips, so arch positions and external bumper/hood rails don't drift.
 *
 * panel(i,t,v): closed normalized mesh domain for panel i, edges beveled later.
 * at(z,v): untrimmed continuous master, gap sampled by interpolating its two lips.
 * seams: master centerline and physical strips, plus comparative fit metrics.
 */
export function createMasterSide({panels,settings={},gap=.005,side=1,quality='preview',stations=tessCount(quality)}={}){
 if(![1,-1].includes(side))throw new RangeError('Side must be +1 or -1');
 if(!Array.isArray(panels)||!panels.length)throw new TypeError('Master side requires panel spans');
 const sections=panels.map((p,i)=>{
  if(!p||!finite(p.start)||!finite(p.end)||p.end-p.start<.035||typeof p.sample!=='function'){
   throw new RangeError('Invalid master side panel #'+i);
  }
  if(i&&Math.abs(p.start-panels[i-1].end)>1e-6)throw new RangeError('Side panel stations must share an ordered rail');
  return {...p,read:boundedSampler(p),prev:null,next:null};
 });
 const definitions=[];
 const topGate=v=>1-(1-clamp(v/.055))**4;
 for(let i=0;i+1<sections.length;i++){
  const left=sections[i],right=sections[i+1],id=left.seamAfter;
  if(typeof id!=='string'||!id)continue; // no implicit paint gap
  const cfg=normalizeSeamOptions(settings?.[id],gap);
  const station=left.end,available=Math.min(left.end-left.start,right.end-right.start);
  const width=Math.min(.115,available*.31),half=Math.min(cfg.gap/2,width*.16);
  const moved=clamp(cfg.offset,-width*.31,width*.31);
  const center=station+moved;
  const ZA=center-half,ZB=center+half;
  const cache=new Map();
  const core=(v)=>{
   const vv=clamp(v);
   const a=jet(left,center,vv),b=jet(right,center,vv);
   return {a,b,center:blend(a.p,b.p,.5)};
  };
  const slice=(vArg)=>{
   const v=clamp(vArg);
   if(cache.has(v))return cache.get(v);
   const F=core(v),h=.00022;
   const prior=core(clamp(v-h)).center,next=core(clamp(v+h)).center;
   const vertical=unit(minus(next,prior),[0,-1,0]);
   const DA=jet(left,ZA,v),DB=jet(right,ZB,v);
   const long=blend(F.a.d,F.b.d,.5);
   const reject=minus(long,scaled(vertical,dot(long,vertical)));
   let across=unit(reject,[0,0,1]);
   if(across[2]<0)across=scaled(across,-1);
   let normal=unit(cross(vertical,across),[side,0,0]);
   if(normal[0]*side<0)normal=scaled(normal,-1);
   // v=0 is shared with hood, deck, and existing closure rails. Only expand
   // inboard normal and shape matching below that exact upper datum.
   const w=topGate(v),align=w*cfg.align;
   const flush=scaled(normal,cfg.flush*.5*w); // positive raises forward panel
   const pa=minus(blend(DA.p,add(F.center,scaled(across,-half)),align),flush);
   const pb=add(blend(DB.p,add(F.center,scaled(across, half)),align),flush);
   const unification=w*cfg.tangent*(1-cfg.crease);
   const curvature=w*cfg.curvature*(1-cfg.crease)**2;
   const commonD=blend(DA.d,DB.d,.5);
   const commonK=blend(DA.k,DB.k,.5);
   const bound=(a,k)=>a.map(x=>clamp(x,-k,k));
   const make=(E,D)=>({
    edge:E,translate:minus(E,D.p),d:scaled(bound(minus(commonD,D.d),.85),unification),
    k:scaled(bound(minus(commonK,D.k),35),curvature),original:D
   });
   const S={pa,pb,cp:blend(pa,pb,.5),across,vertical,normal,A:make(pa,DA),B:make(pb,DB)};
   cache.set(v,S);return S;
  };
  const def={id,cfg,width,station,moved,center,ZA,ZB,slice};
  left.next=def;right.prev=def;definitions.push(def);
 }
 function raw(p,z,v){
  return z>=p.start&&z<=p.end?p.read(z,v):jet(p,z,v).p;
 }
 function corrected(p,z,v){
  let value=raw(p,z,v);
  function apply(seam,edge,dir,tag){
   const u=clamp(Math.abs(z-edge)/seam.width);
   if(u>=1)return;
   const c=seam.slice(v)[tag];
   // Position, entering tangent and curvature cancel at strip endpoint.
   const dc=scaled(c.translate,oneMinus(u));
   const dt=scaled(c.d,dir*seam.width*tangentBasis(u));
   const dd=scaled(c.k,seam.width*seam.width*curvatureBasis(u));
   value=add(value,add(add(dc,dt),dd));
  }
  if(p.prev)apply(p.prev,p.prev.ZB,1,'B');
  if(p.next)apply(p.next,p.next.ZA,-1,'A');
  return value;
 }
 const panel=(index,tArg,vArg)=>{
  const p=sections[index];
  if(!p)throw new RangeError('Invalid side panel index');
  const t=clamp(tArg),v=clamp(vArg),z= mix(p.start,p.end,t);
  let loc=z;
  if(p.prev)loc+=(p.prev.ZB-p.start)*oneMinus(clamp((z-p.start)/p.prev.width));
  if(p.next)loc+=(p.next.ZA-p.end)*oneMinus(clamp((p.end-z)/p.next.width));
  // Avoid endpoint cancellation even when a moved edge uses Taylor bounds.
  if(t===0&&p.prev)loc=p.prev.ZB;
  if(t===1&&p.next)loc=p.next.ZA;
  return corrected(p,loc,v);
 };
 const at=(argZ,argV)=>{
  const z=clamp(argZ,sections[0].start,sections.at(-1).end),v=clamp(argV);
  for(let i=0;i<sections.length;i++){
   const p=sections[i],r=p.next;
   if(!r&&z<=p.end)return corrected(p,z,v);
   if(r&&z<r.ZA)return corrected(p,z,v);
   if(r&&z<=r.ZB){const s=r.slice(v);return blend(s.pa,s.pb,(z-r.ZA)/(r.ZB-r.ZA));}
  }
  return corrected(sections.at(-1),z,v);
 };
 const seams=definitions.map(d=>{
  const n=Math.round(clamp(Number.isFinite(stations)?stations:tessCount(quality),6,96));
  const renderTS=Array.from({length:n+1},(_,i)=>i/n);
  const samples=Array.from({length:65},(_,i)=>i/64),frames=samples.map(d.slice);
  const {cfg}=d,half=(d.ZB-d.ZA)/2;
  const {parts,lipRadius,thickness}=gapParts(renderTS.map(d.slice),cfg,half,quality);
  const checks=frames.map(S=>{
   const diff=minus(S.pb,S.pa);
   const slopeA=add(S.A.original.d,S.A.d),slopeB=add(S.B.original.d,S.B.d);
   const curveA=add(S.A.original.k,S.A.k),curveB=add(S.B.original.k,S.B.k);
   return {gap:length(diff)*1000,position:Math.abs(dot(diff,S.normal))*1000,
    tangent:degree(slopeA,slopeB),curvature:length(minus(curveA,curveB))};
  });
  // Exclude the unmodified shared upper top point from continuity stats;
  // the physical gap itself is measured at every sample.
  const middle=checks.filter((_,i)=>samples[i]>=.045);
  const max=(key,list=middle)=>Math.max(...list.map(x=>x[key]));
  const metrics={positionMm:max('position'),tangentDeg:max('tangent'),
   curvature:max('curvature'),gapMm:cfg.gap*1000,gapMinMm:Math.min(...checks.map(v=>v.gap)),
   gapMaxMm:max('gap',checks),offsetMm:d.moved*1000,
   radiusMm:lipRadius*1000,thicknessMm:thickness*1000,depthMm:cfg.depth*1000,
   upperGapMm:checks[0].gap};
  return {id:d.id,points:frames.map(S=>S.cp),sample:t=>d.slice(t).cp,
   edgeA:t=>d.slice(t).pa,edgeB:t=>d.slice(t).pb,parts,metrics};
 });
 return {panel,at,seams};
}
