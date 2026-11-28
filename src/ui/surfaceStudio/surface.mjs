import datum from './phase5-datum.mjs';
const groups={d:'Panel envelope',s:'Crown and shoulder',a:'Wheel opening and lip',b:'Panel boundaries'};
const field=(label,group,min,max,step,def=0)=>Object.freeze({label,group:groups[group],min,max,step,default:def});
export const PARAMS=Object.freeze({
 length:field('Panel length (m)','d',1.30,1.56,.002,1.422),
 width:field('Panel depth Δ (m)','d',-.032,.032,.001),
 height:field('Panel height Δ (m)','d',-.033,.033,.001),
 longCrown:field('Longitudinal crown Δ (m)','s',-.020,.024,.001),
 latCrown:field('Lateral crown Δ (m)','s',-.018,.026,.001),
 shoulderPos:field('Shoulder height bias','s',-.32,.32,.01),
 shoulderCurvature:field('Shoulder curvature Δ (m)','s',-.017,.024,.001),
 shoulderSharpness:field('Shoulder sharpness','s',-.6,.65,.02),
 frontBoxiness:field('Front boxiness','s',-.6,.85,.02),
 rearBoxiness:field('Rear boxiness','s',-.6,.85,.02),
 archRadius:field('Wheel arch radius (m)','a',.329,.377,.001,.354),
 archPosition:field('Wheel arch travel Δ (m)','a',-.055,.055,.001),
 archEccentricity:field('Arch height / width','a',.90,1.07,.005,.352/.354),
 flareDepth:field('Flare depth Δ (m)','a',-.020,.026,.001),
 flareWidth:field('Flare transition width','a',.90,1.18,.01,1),
 lipRadius:field('Rolled lip radius (m)','a',.0035,.0085,.0005,.0055),
 hoodBoundary:field('Hood seam rise Δ (m)','b',-.014,.017,.001),
 headlightBoundary:field('Headlight cut sweep Δ (m)','b',-.025,.029,.001),
 doorBoundary:field('Door seam rake Δ (m)','b',-.020,.020,.001),
 bumperBoundary:field('Bumper seam height Δ (m)','b',-.033,.033,.001),
 rocker:field('Rocker rise Δ (m)','b',-.020,.026,.001),
 localCurvature:field('Local crease relief Δ (m)','s',-.009,.012,.001)
});
export const PRESETS=Object.freeze({
 wrx:{label:'2004 Subaru WRX STI',short:'WRX STI',topology:'swept-fender',params:{},note:'GD sedan; rounded embossed flare and compact lamp corner.'},
 e30:{label:'BMW E30 M3',short:'E30 M3',topology:'box-flare',params:{length:1.465,width:.014,height:.008,latCrown:-.009,shoulderPos:.18,shoulderCurvature:.010,shoulderSharpness:.38,frontBoxiness:.65,rearBoxiness:.56,archRadius:.339,archPosition:.008,archEccentricity:.94,flareDepth:.016,flareWidth:.93,lipRadius:.0045,hoodBoundary:.009,headlightBoundary:-.022,doorBoundary:-.012,bumperBoundary:-.019,rocker:.004},note:'Standard road M3, no Sport Evo nose; broad planar faces and a raised boxed flare.'},
 '993':{label:'Porsche 993 Carrera',short:'993 Carrera',topology:'integrated-pod',params:{length:1.356,width:-.005,height:-.016,longCrown:.017,latCrown:.015,shoulderPos:-.13,shoulderCurvature:.006,shoulderSharpness:-.35,frontBoxiness:-.49,rearBoxiness:-.30,archRadius:.354,archPosition:-.014,archEccentricity:.995,flareDepth:.009,flareWidth:1.12,lipRadius:.0050,hoodBoundary:-.010,headlightBoundary:.020,doorBoundary:.014,bumperBoundary:.017,rocker:.007},note:'Narrow Carrera 2, RoW profile; low inboard lid beside a swept raised lamp pod.'}
});
const fs=Object.keys(PARAMS), TOPO=['swept-fender','box-flare','integrated-pod'];
const Z=datum.z,V=datum.v,S=Z.map(z=>(z-Z[0])/(Z.at(-1)-Z[0])), C=datum.landmarkSections;
const count=Z.length*V.length, AX=['x','y','z'];
const archetypeAnchor={'swept-fender':{deltaX:0,hubY:.31715},'box-flare':{deltaX:-.067,hubY:.303},'integrated-pod':{deltaX:-.032,hubY:.316}};
const cleanNumber=x=>Object.is(x,-0)?0:x;
const num=(x,k)=>{
 if(typeof x!=='number'||!Number.isFinite(x))throw RangeError(k+' must be a finite number');
 return cleanNumber(x);
};
export function createGenome(id='wrx'){
 if(!Object.hasOwn(PRESETS,id))throw RangeError('Unknown preset '+id);
 const x=PRESETS[id];
 return {schemaVersion:1,preset:id,topology:x.topology,boundaryConstraints:{shutLineM:.0035,hoodApproach:'tangent',bumperApproach:'style-break'},parameters:Object.fromEntries(fs.map(k=>[k,x.params[k]??PARAMS[k].default])),overrides:{}};
}
export function normalizeGenome(input) {
 if(!input||input.schemaVersion!==1||!Object.hasOwn(PRESETS,input.preset)||!TOPO.includes(input.topology))throw RangeError('Unknown genome schema, preset or topology');
 const g=createGenome(input.preset);g.topology=input.topology;
 if(input.boundaryConstraints!=null){
  const b=input.boundaryConstraints;
  if(!b||typeof b!=='object'||Object.keys(b).some(k=>!['shutLineM','hoodApproach','bumperApproach'].includes(k)))throw RangeError('Invalid boundary constraints');
  const gap=num(b.shutLineM??.0035,'shut line');if(gap<.003||gap>.004)throw RangeError('Prototype shut line must be 3–4 mm');
  if((b.hoodApproach??'tangent')!=='tangent'||(b.bumperApproach??'style-break')!=='style-break')throw RangeError('Unsupported boundary relationship');
  g.boundaryConstraints.shutLineM=gap;
 }
 for(const k of Object.keys(input.parameters??{})){
  if(!Object.hasOwn(PARAMS,k))throw RangeError('Unknown parameter '+k);
  const v=num(input.parameters[k],k),p=PARAMS[k];
  if(v<p.min-1e-9||v>p.max+1e-9)throw RangeError(k+' is outside its semantic range');
  g.parameters[k]=v;
 }
 for(const k of Object.keys(input.overrides??{}).sort((a,b)=>+a-+b)){
  const i=+k, o=input.overrides[k];if(!Number.isInteger(i)||i<0||i>=count||String(i)!==k||!o||typeof o!=='object')throw RangeError('Invalid editable point');
  for(const a of Object.keys(o))if(!AX.includes(a))throw RangeError('Invalid point axis');
  for(const a of AX)if(Object.hasOwn(o,a)){
   const value=num(o[a],'control.'+a);if(Math.abs(value)>.014)throw RangeError('Control overrides limited to ±14 mm');
   if(value!==0)(g.overrides[i]??={})[a]=value;
  }
 }
 return g;
}
export function setParameter(g,key,value){
 if(!Object.hasOwn(PARAMS,key))throw RangeError('Unknown parameter '+key);
 return normalizeGenome({...g,parameters:{...g.parameters,[key]:num(value,key)}});
}
export function setControl(g,idx,axis,deltaM){
 if(!Number.isInteger(idx)||idx<0||idx>=count||!AX.includes(axis))throw RangeError('Invalid control');
 return normalizeGenome({...g,overrides:{...g.overrides,[idx]:{...g.overrides?.[idx],[axis]:num(deltaM,axis)}}});
}
export const serializeGenome=g=>JSON.stringify(normalizeGenome(g),null,2)+'\n';
export const loadGenome=str=>{const d=JSON.parse(str);return normalizeGenome(d?.genome??d);};
export const setTopology=(g,topology)=>normalizeGenome({...g,topology});
export const setBoundaryConstraints=(g,boundaryConstraints)=>normalizeGenome({...g,boundaryConstraints:{...g.boundaryConstraints,...boundaryConstraints}});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>(x=clamp(x),x*x*(3-2*x));
const bell=(x,w)=>Math.exp(-((x/w)**2));
const plus=(a,b,c=1)=>[a[0]+c*b[0],a[1]+c*b[1],a[2]+c*b[2]];
const sub=(a,b)=>plus(a,b,-1);const norm=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=a=>{const t=norm(a)||1e-14;return a.map(k=>k/t);};
const p3=(x,y,z)=>[x,y,z];
function slopes(x,y){
 const n=x.length,r=y.map(()=>[0,0,0]), c=new Float64Array(n);
 for(let i=1;i<n-1;i++){
  const a=x[i]-x[i-1],b=x[i+1]-x[i],d=2*(a+b)-a*c[i-1];c[i]=b/d;
  for(let j=0;j<3;j++)r[i][j]=(6*((y[i+1][j]-y[i][j])/b-(y[i][j]-y[i-1][j])/a)-a*r[i-1][j])/d;
 }
 for(let i=n-2;i>0;i--)for(let j=0;j<3;j++)r[i][j]-=c[i]*r[i+1][j];
 return y.map((p,i)=>p.map((a,j)=>i<n-1?
  (y[i+1][j]-a)/(x[i+1]-x[i])-(x[i+1]-x[i])*(2*r[i][j]+r[i+1][j])/6:
  (a-y[i-1][j])/(x[i]-x[i-1])+(x[i]-x[i-1])*(r[i-1][j]+2*r[i][j])/6));
}
function fieldNet(g){
 const p=g.parameters;
 const F=C.map((row,i)=>row.map(([bx,by,bz],j)=>{
  const u=S[i],t=V[j];
  const fwd=smooth((u-.44)/.56), rear=smooth((.58-u)/.58), along=Math.sin(Math.PI*u)**2;
  const active=Math.sin(Math.PI*t),tSh=clamp(.23-.16*p.shoulderPos,.13,.34);
  let x=bx+archetypeAnchor[g.topology].deltaX+(t*.67+active*.56)*p.width;
  let y=by+(p.height+.55*p.longCrown*along+p.hoodBoundary*(.80+.20*along))*(1-t);
  let z=.64+(bz-.64)*(p.length/1.422)+p.doorBoundary*rear**3*t;
  // Rail-level shaping. No transforms or vertex displacement after tessellation.
  const localWidth=.42*p.flareWidth;
  const archCenter=.64+(1.27-.64)*(p.length/1.422)+p.archPosition;
  const nearArch=bell(z-archCenter,localWidth);
  x+=p.latCrown*active*along+p.longCrown*.36*along*active;
  x+=p.shoulderCurvature*bell(t-tSh,.13)*along+p.shoulderSharpness*.015*(bell(t-tSh,.093)-.6*bell(t-tSh,.24))*along;
  x+=p.shoulderPos*.017*(bell(t-tSh,.15)-bell(t-.24,.15))*along;
  x+=p.flareDepth*nearArch*smooth(t/.17)*(1-.72*smooth((t-.55)/.45));
  x+=.21*(p.flareWidth-1)*p.flareDepth*nearArch;
  x+=p.localCurvature*bell(u-.71,.20)*bell(t-.30,.15);
  const box=p.frontBoxiness*fwd+p.rearBoxiness*rear;
  x+=.019*box*(smooth(t/.19)-smooth((t-.59)/.41));
  y+=.007*box*bell(t-.20,.16);
  z-=p.headlightBoundary*(u**4)*bell(t-.25,.20)*smooth(t/.14);
  if(g.topology==='box-flare'){
    const w=bell(u-.48,.37);
    x+=.012*w*(smooth(t/.19)-smooth((t-.50)/.40))-.008*w*bell(t-.065,.09);
    z+=.024*u**5*smooth(t/.21);
  }else if(g.topology==='integrated-pod'){
    // Separate family places a rising lens crown ahead of the axle while
    // dropping the inboard bonnet rail. Same patch compiler and JSON API.
    const pod=bell(u-.79,.30);
    y+=.058*pod*bell(t-.17,.145)-.037*pod*bell(t,.077);
    x-=.072*pod*bell(t,.10);
    x+=.018*pod*bell(t-.22,.20);
    z-=.020*pod*bell(t-.215,.18)*smooth(t/.12);
  }
  const o=g.overrides[i*V.length+j];
  if(o){x+=o.x??0;y+=o.y??0;z+=o.z??0;}
  return p3(x,y,z);
 }));
 const du=V.map((_,j)=>slopes(S,F.map(row=>row[j])));
 const duRows=F.map((_,i)=>du.map(r=>r[i]));
 return {F,du:duRows,dv:F.map(r=>slopes(V,r)),mix:duRows.map(r=>slopes(V,r))};
}
function binary(coords,t){
 let lo=0,hi=coords.length-1;
 while(hi-lo>1){const m=(hi+lo)>>1;if(t>=coords[m])lo=m;else hi=m;}
 return lo;
}
function herm(t){
 const q=t*t,r=q*t;return [2*r-3*q+1,-2*r+3*q,r-2*q+t,r-q];
}
function dh(t){
 const q=t*t;return [6*q-6*t,-6*q+6*t,3*q-4*t+1,3*q-2*t];
}
function compile(g){
 const {F,du,dv,mix:uv}=fieldNet(g);
 function evalSurface(s,t,want=true){
  const i=binary(S,s),j=binary(V,t),su=S[i+1]-S[i],tv=V[j+1]-V[j];
  const u=(s-S[i])/su,v=(t-V[j])/tv,h=herm(u),k=herm(v),dh0=want?dh(u):null,dk0=want?dh(v):null;
  const out=[0,0,0],a=want?[0,0,0]:null,b=want?[0,0,0]:null;
  const add=(vec,c0,c1,c2)=>{for(let l=0;l<3;l++){out[l]+=vec[l]*c0;if(want){a[l]+=vec[l]*c1;b[l]+=vec[l]*c2;}}};
  for(let l=0;l<2;l++)for(let m=0;m<2;m++){
   const A=i+l,B=j+m;
   add(F[A][B],h[l]*k[m],want?dh0[l]*k[m]/su:0,want?h[l]*dk0[m]/tv:0);
   add(du[A][B],h[l+2]*k[m]*su,want?dh0[l+2]*k[m]:0,want?h[l+2]*dk0[m]*su/tv:0);
   add(dv[A][B],h[l]*k[m+2]*tv,want?dh0[l]*k[m+2]*tv/su:0,want?h[l]*dk0[m+2]:0);
   add(uv[A][B],h[l+2]*k[m+2]*su*tv,want?dh0[l+2]*k[m+2]*tv:0,want?h[l+2]*dk0[m+2]*su:0);
  }
  return want?{point:out,ds:a,dt:b,normal:unit(cross(a,b))}:out;
 }
 return {evalSurface,F};
}
function mono(x,x0,x1,y0,s0,y1,s1){
 const z=clamp((x-x0)/(x1-x0)),h=herm(z);return h[0]*y0+h[1]*y1+(x1-x0)*(h[2]*s0+h[3]*s1);
}
function bottomHeight(g,s){
 const p=g.parameters,z=.64+s*p.length,cz=.64+(1.27-.64)*p.length/1.422+p.archPosition,r=p.archRadius,ry=r*p.archEccentricity,dy=archetypeAnchor[g.topology].hubY;
 const d=Math.abs(z-cz),v=.9322*r,tr=(r+.058)*p.flareWidth;
 const left=z<cz;
 const frontFamily=g.topology==='box-flare'?-.030:g.topology==='integrated-pod'?.019:0;
 const sill=.229+p.rocker,front=.370+.65*p.bumperBoundary+frontFamily;
 const y0=left?sill:front;
 // C1 arch-to-shut-line approach: the forward seam blends after the
 // elliptical opening, without pulling the outer fender's curvature.
 const y1=.498+p.bumperBoundary+frontFamily;
 const outer=left?sill:y0+(y1-y0)*smooth((d-tr)/Math.max(.09,.64+p.length-cz-tr));
 if(d<=v)return dy+ry*Math.sqrt(Math.max(0,1-(d/r)**2));
 if(d>=tr)return outer;
 const k=Math.sqrt(1-(v/r)**2),x=dy+ry*k,m=-ry*v/(r*r*k);
 // Limit extreme combinations from turning the return into an undershoot.
 return mono(d,v,tr,x,Math.max(m,-2.6*(x-y0)/(tr-v)),y0,0);
}
export function buildFender(input,{uSteps=43,vSteps=24,lipSteps=5}={}){
 const g=normalizeGenome(input),c=compile(g);
 if(!Number.isInteger(uSteps)||!Number.isInteger(vSteps)||!Number.isInteger(lipSteps)||uSteps<12||vSteps<9||lipSteps<3||uSteps>120||vSteps>90||lipSteps>12)throw RangeError('Tessellation outside limits');
 const issues=new Set(),validated=g.parameters;
 if(validated.archRadius*validated.archEccentricity>.402)issues.add('Arch dimensions exceed prototype envelope');
 if(validated.flareDepth>.020&&validated.flareWidth<.94&&validated.shoulderSharpness>.44)issues.add('Deep flare needs a wider, softer shoulder');
 const limitCache=new Map();
 function trim(s){
  if(limitCache.has(s))return limitCache.get(s);
  const target=bottomHeight(g,s);
  const h=c.evalSurface(s,0,false)[1],b=c.evalSurface(s,1,false)[1];
  if(h-target<.064||target<b-.00001)issues.add('Arch or bumper cut leaves less than 64 mm of skin, or falls below the panel');
  let t=clamp((h-target)/Math.max(1e-8,h-b));
  if(Object.keys(g.overrides).length||g.topology==='integrated-pod'||g.parameters.frontBoxiness||g.parameters.rearBoxiness){
   let lo=0,hi=1;
   for(let k=0;k<16;k++){const m=(lo+hi)*.5;if(c.evalSurface(s,m,false)[1]>target)lo=m;else hi=m;}
   t=(lo+hi)*.5;
  }
  const u=Math.max(.075,clamp(t));limitCache.set(s,u);return u;
 }
 function ev(s,t){s=clamp(s);return c.evalSurface(s,clamp(t)*trim(s),false);}
 const rows=uSteps+1,cols=vSteps+1,us=Array.from({length:rows},(_,i)=>i/(rows-1)),vs=Array.from({length:cols},(_,i)=>i/(cols-1));
 const positions=[],normals=[],indices=[],triSignal={minArea:Infinity,backwards:0},poleMin=[Infinity,Infinity,Infinity],poleMax=[-Infinity,-Infinity,-Infinity];
 let maxKink=0;
 function add(p,n){positions.push(...p);normals.push(...n);for(let i=0;i<3;i++){poleMin[i]=Math.min(poleMin[i],p[i]);poleMax[i]=Math.max(poleMax[i],p[i]);}}
 function tri(a,b,k,skin){
  indices.push(a,b,k);if(!skin)return;
  const A=positions.slice(3*a,3*a+3),B=positions.slice(3*b,3*b+3),C=positions.slice(3*k,3*k+3);
  const n=cross(sub(B,A),sub(C,A)),an=norm(n)*.5;
  triSignal.minArea=Math.min(triSignal.minArea,an);if(an<1e-10)issues.add('Degenerate skin triangles');
  const ref=[0,1,2].map(d=>normals[3*a+d]+normals[3*b+d]+normals[3*k+d]);
  if(dot(n,ref)<-1e-10)triSignal.backwards++;
 }
 for(let i=0;i<rows;i++){
  const s=us[i],limit=trim(s);
  for(let j=0;j<cols;j++){
   const P=c.evalSurface(s,vs[j]*limit);
   if(!P.normal.every(Number.isFinite)||norm(P.normal)<.5)issues.add('Surface derivative singular');
   add(P.point,P.normal);
   if(j)maxKink=Math.max(maxKink,Math.acos(clamp(dot(P.normal,normals.slice(-6,-3)),-1,1)));
  }
 }
 for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){
  const a=i*cols+j,b=a+cols;tri(a,b,b+1,true);tri(a,b+1,a+1,true);
 }
 if(triSignal.backwards)issues.add('Surface folds across its own orientation');
 if(maxKink>1.12)issues.add('High neighboring normal turn in outer skin');
 const skinIndexCount=indices.length;
 // Transport a normal-plane frame along the actual trim. The independent
 // lip is tangent to the edge, then rolls toward the hidden side.
 const hemStart=positions.length/3;
 const radius=g.parameters.lipRadius;
 for(let i=0;i<rows;i++){
  const s=us[i],P=c.evalSurface(s,trim(s)),lo=ev(Math.max(0,s-.00020),1),hi=ev(Math.min(1,s+.00020),1);
  const path=unit(sub(hi,lo)),down=unit(cross(P.normal,path));
  const naturalDir=dot(down,P.dt)>0?down:down.map(x=>-x);
  for(let j=0;j<=lipSteps;j++){
   const a=Math.PI*.82*j/lipSteps;
   // A small taper keeps the open ends from intersecting the neighboring fixtures.
   const r=radius*(.47+.53*smooth(Math.min(s,1-s)/.11));
   const Q=plus(plus(P.point,naturalDir,r*Math.sin(a)),P.normal,-r*(1-Math.cos(a)));
   const N=unit(plus(P.normal.map(x=>x*Math.cos(a)),naturalDir,Math.sin(a)));
   add(Q,N);
  }
 }
 for(let i=0;i<rows-1;i++)for(let j=0;j<lipSteps;j++){
  const ps=lipSteps+1,a=hemStart+i*ps+j,b=a+ps;
  tri(a,b,b+1,false);tri(a,b+1,a+1,false);
 }
 const controls=c.F.flatMap((r,i)=>r.map((position,j)=>({index:i*V.length+j,position, station:i, rail:j})));
 const diagnostics={valid:issues.size===0,issues:[...issues],triangles:indices.length/3,minSkinTriangleAreaM2:triSignal.minArea,skinFoldTriangles:triSignal.backwards,maxSkinNeighborTurnDeg:maxKink*180/Math.PI,bounds:[poleMin,poleMax]};
 return {positions,normals,indices,eval:ev,rows,cols,skinIndexCount,hemStart,rails:{hood:us,bumper:vs},controls,
 controlRows:S.length,controlCols:V.length,network:{gap:g.boundaryConstraints.shutLineM},diagnostics,genome:g,evaluateMaster:(s,t)=>c.evalSurface(clamp(s),clamp(t))};
}
export function exportOBJ(mesh){
 const out=['# Phase 6 isolated fender (+X right, +Y up, +Z front), metres'];
 for(let i=0;i<mesh.positions.length;i+=3)out.push('v '+mesh.positions.slice(i,i+3).map(x=>x.toFixed(8)).join(' '));
 for(let i=0;i<mesh.normals.length;i+=3)out.push('vn '+mesh.normals.slice(i,i+3).map(x=>x.toFixed(8)).join(' '));
 for(let i=0;i<mesh.indices.length;i+=3){
  if(!i)out.push('g Stamped_skin');
  if(i===mesh.skinIndexCount)out.push('g Turned_hem');
  out.push('f '+mesh.indices.slice(i,i+3).map(k=>String(k+1)+'//'+String(k+1)).join(' '));
 }
 return out.join('\n')+'\n';
}
export const REFERENCE_VIEWS=Object.freeze({studio:{eye:[2.43,1.52,2.57],aim:[.748,.608,1.33],fov:36},
 side:{eye:[4.1,.567,1.35],aim:[.75,.567,1.35],ortho:true,height:1.04},
 front:{eye:[.75,.567,4.12],aim:[.75,.567,1.35],ortho:true,height:1.04},
 top:{eye:[.75,3.25,1.345],aim:[.75,.56,1.345],up:[0,0,-1],ortho:true,height:1.22}});
