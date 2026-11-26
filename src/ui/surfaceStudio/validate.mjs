const xyz=(v,o)=>[v[o],v[o+1],v[o+2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const addScaled=(a,b,t)=>[a[0]+t*b[0],a[1]+t*b[1],a[2]+t*b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const times=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const length=a=>Math.hypot(a[0],a[1],a[2]);
const unit=a=>times(a,1/length(a));
const finite3=a=>a&&a.length>=3&&Number.isFinite(a[0])&&Number.isFinite(a[1])&&Number.isFinite(a[2]);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const degrees=x=>x*180/Math.PI;
const arrayLike=x=>Array.isArray(x)||ArrayBuffer.isView(x)&&typeof x.length==='number';
const summary=(a,maxRecords=12)=>a.length?{count:a.length,examples:a.slice(0,maxRecords)}:null;
const quantile=(a,p)=>{
 if(!a.length)return null;
 a.sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(p*(a.length-1)))];
};
const same=(a,b,eps)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<=eps;
const axisIndices=drop=>[0,1,2].filter(x=>x!==drop);

// Return the positive area shared by two coplanar triangles. Sutherland-
// Hodgman is robust for convex triangles and deliberately does not treat
// a shared physical edge or point contact as an overlapping surface.
function coplanarArea(a,b,n,eps){
 const drop=n.reduce((j,v,i)=>Math.abs(v)>Math.abs(n[j])?i:j,0);
 const [x,y]=axisIndices(drop),to2=p=>[p[x],p[y]];
 const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 let p=a.map(to2);
 const q=b.map(to2);
 const sign=Math.sign(orient(q[0],q[1],q[2]));
 if(!sign)return 0;
 for(let k=0;k<3&&p.length;k++){
  const first=q[k],last=q[(k+1)%3],a=p;p=[];
  const tolerance=eps*Math.hypot(last[0]-first[0],last[1]-first[1]);
  for(let i=0;i<a.length;i++){
   const s=a[i],e=a[(i+1)%a.length];
   const f0=sign*orient(first,last,s),f1=sign*orient(first,last,e);
   const on0=f0>=-tolerance,on1=f1>=-tolerance;
   if(on0)p.push(s);
   if(on0!==on1&&f0!==f1){
    const t=clamp(f0/(f0-f1),0,1);
    p.push([s[0]+t*(e[0]-s[0]),s[1]+t*(e[1]-s[1])]);
   }
  }
 }
 if(p.length<3)return 0;
 const area=Math.abs(p.reduce((sum,v,i)=>{
  const q=p[(i+1)%p.length];return sum+(v[0]-p[0][0])*(q[1]-p[0][1])-(v[1]-p[0][1])*(q[0]-p[0][0]);
 },0))/2;
 return area/Math.max(1e-9,Math.abs(n[drop]));
}

function planeDistances(tri,p,n){
 return tri.map(v=>dot(sub(v,p),n));
}
function planeCut(tri,d,dir,origin,eps){
 const u=[];
 for(let i=0;i<3;i++){
  const k=(i+1)%3;
  if(Math.abs(d[i])<=eps)u.push(dot(sub(tri[i],origin),dir));
  if(d[i]>eps&&d[k]<-eps||d[i]<-eps&&d[k]>eps){
   const t=d[i]/(d[i]-d[k]);
   u.push(dot(sub(addScaled(tri[i],sub(tri[k],tri[i]),t),origin),dir));
  }
 }
 return u.length?[Math.min(...u),Math.max(...u)]:null;
}

function crossing(a,b,eps){
 const da=planeDistances(a.p,b.p[0],b.normal);
 if(da.every(x=>x>eps)||da.every(x=>x<-eps))return null;
 const db=planeDistances(b.p,a.p[0],a.normal);
 if(db.every(x=>x>eps)||db.every(x=>x<-eps))return null;
 const d=cross(a.normal,b.normal),l=length(d);
 if(l<1e-8){
  if(!da.every(x=>Math.abs(x)<=eps)||!db.every(x=>Math.abs(x)<=eps))return null;
  const area=coplanarArea(a.p,b.p,a.normal,eps);
  // Avoid floating point positive "ribbons" along a welded or hem seam.
  const body=Math.min(a.area,b.area),height=Math.sqrt(body);
  return area>Math.max(16*eps*eps,5*eps*height,body*1e-8)?{type:'coplanar-overlap',area}:null;
 }
 const dir=times(d,1/l),origin=a.p[0];
 const u=planeCut(a.p,da,dir,origin,eps),v=planeCut(b.p,db,dir,origin,eps);
 if(!u||!v)return null;
 const lo=Math.max(u[0],v[0]),hi=Math.min(u[1],v[1]),span=hi-lo;
 if(span<=eps*4)return null;
 // Crossing *along* an edge represented by split corner vertices is a
 // boundary join, not a puncture. A genuine T-intersection has only one
 // complete coincident plane edge and is recorded unless the caller marks
 // that exact physical seam explicitly.
 let shared=0;
 for(const pa of a.p)if(b.p.some(pb=>same(pa,pb,eps*3)))shared++;
 if(shared>=2&&(da.filter(x=>Math.abs(x)<=eps*3).length>=2&&db.filter(x=>Math.abs(x)<=eps*3).length>=2))
  return null;
 return {type:'crossing',length:span};
}

function hashIntersections(triangles,eps,opts,scale){
 const out={tested:0,candidates:0,ignoredSharedEdges:0,cells:0,overflowTriangles:0,complete:true,examples:[],count:0};
 if(!opts.checkIntersections||triangles.length<2)return out;
 const e=triangles.filter(q=>opts.intersectionScope!=='skin'||q.skin);
 const edge=e.map(q=>Math.sqrt(q.area));
 const median=quantile(edge,.5)??scale*.1;
 const cell=opts.hashCellSize??Math.max(eps*32,median*2.7,scale/125);
 if(!(cell>0&&Number.isFinite(cell)))throw new RangeError('Intersection hash cell size must be finite and positive');
 const maxCost=opts.maxPairChecks,cap=opts.maxHashCellsPerFace,all=new Map(),overflow=[],ranges=[];
 for(let i=0;i<e.length;i++){
  const tr=e[i],min=tr.lo.map(p=>Math.floor((p-eps)/cell)),max=tr.hi.map(p=>Math.floor((p+eps)/cell));
  const n=(max[0]-min[0]+1)*(max[1]-min[1]+1)*(max[2]-min[2]+1);
  if(n>cap){overflow.push(i);ranges.push(null);continue;}
  ranges.push([min,max]);
  for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
   const k=x+':'+y+':'+z;
   const prev=all.get(k);
   if(prev)prev.push(i);else all.set(k,[i]);
  }
 }
 out.cells=all.size;out.overflowTriangles=overflow.length;
 const stamp=new Int32Array(e.length);
 const record=(i,j)=>{
  if(i>=j||stamp[j]===i+1)return true;
  stamp[j]=i+1;
  if(out.candidates>=maxCost)return false;
  out.candidates++;
  const a=e[i],b=e[j];
  if(a.hi.some((v,k)=>v<b.lo[k]-eps||b.hi[k]<a.lo[k]-eps))return true;
  const rawShared=a.indices.filter(n=>b.indices.includes(n));
  if(!opts.checkIndexedSharedEdges&&rawShared.length>=2){out.ignoredSharedEdges++;return true;}
  if(opts.ignorePair?.(a.face,b.face,{a,b,rawShared})===true)return true;
  out.tested++;
  const hit=crossing(a,b,eps);
  if(!hit)return true;
  out.count++;
  if(out.examples.length<opts.exampleLimit)out.examples.push({triangles:[a.face,b.face],skin:[a.skin,b.skin],...hit});
  return true;
 };
 outer:for(let i=0;i<e.length;i++){
  const range=ranges[i];
  if(!range){
   for(let j=i+1;j<e.length;j++)if(!record(i,j)){out.complete=false;break outer;}
   continue;
  }
  const [min,max]=range;
  for(const j of overflow)if(!record(i,j)){out.complete=false;break outer;}
  for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
   const bucket=all.get(x+':'+y+':'+z)||[];
   for(const j of bucket)if(!record(i,j)){out.complete=false;break outer;}
  }
 }
 out.cellSize=cell;
 return out;
}

function differential(mesh,eps,opts){
 if(typeof mesh.eval!=='function'||opts.paramSamples<3)return null;
 const n=opts.paramSamples,h=opts.paramStep,positions=[],bad=[],k1=[],k2=[],du=[],dv=[],normalDiff=[],jac=[];
 const at=(s,t)=>{
  let x=mesh.eval(s,t);
  if(!arrayLike(x))x=x?.position??x?.point??x?.p??x;
  if(!arrayLike(x)&&x&&typeof x==='object')x=[x.x,x.y,x.z];
  return x;
 };
 for(let i=1;i<n-1;i++)for(let j=1;j<n-1;j++){
  const s=i/(n-1),t=j/(n-1),a=at(s,t),ls=at(s-h,t),rs=at(s+h,t),lt=at(s,t-h),rt=at(s,t+h);
  if(![a,ls,rs,lt,rt].every(finite3)){bad.push([s,t,'nonfinite']);continue;}
  const Ls=length(sub(a,ls)),Rs=length(sub(rs,a)),Lt=length(sub(a,lt)),Rt=length(sub(rt,a));
  if(Math.min(Ls,Rs,Lt,Rt)<=eps*.25){bad.push([s,t,'singular-tangent']);continue;}
  const vs=sub(rs,ls),vt=sub(rt,lt);
  const turnS=degrees(Math.acos(clamp(dot(unit(sub(a,ls)),unit(sub(rs,a))),-1,1)));
  const turnT=degrees(Math.acos(clamp(dot(unit(sub(a,lt)),unit(sub(rt,a))),-1,1)));
  const area=length(cross(unit(vs),unit(vt)));
  jac.push(area);du.push(turnS);dv.push(turnT);
  if(area<opts.minParamSine)bad.push([s,t,'parallel-tangents',area]);
  const k=(l,o,r)=>{
   const x=sub(r,l),y=[l[0]-2*o[0]+r[0],l[1]-2*o[1]+r[1],l[2]-2*o[2]+r[2]];
   return 4*length(cross(x,y))/length(x)**3;
  };
  k1.push(k(ls,a,rs));k2.push(k(lt,a,rt));positions.push([s,t]);
  // For an evaluable authored normal, inspect exact winding independently.
  const raw=mesh.eval(s,t),supplied=raw?.normal??raw?.n;
  if(finite3(supplied))normalDiff.push(degrees(Math.acos(clamp(dot(unit(supplied),unit(cross(vs,vt))),-1,1))));
 }
 const seamJumps=[],seamAngles=[],seamProblems=[];
 for(const [axis,knots] of [['s',opts.seamKnots.s],['t',opts.seamKnots.t]])for(const value of knots){
  const dh=Math.min(h*.125,value/3,(1-value)/3);
  if(!(dh>1e-8))continue;
  // Extrapolate each one-sided linear jet to the same interior knot.
  // The limit offset rejects a true position step without calling an
  // intentional tangent crease or panel-edge curvature an open gap.
  for(let j=1;j<Math.min(n,13)-1;j++){
   const c=j/(Math.min(n,13)-1),p=a=>axis==='s'?at(a,c):at(c,a);
   const a=p(value-2*dh),b=p(value-dh),c0=p(value+dh),d=p(value+2*dh);
   if(![a,b,c0,d].every(finite3)){seamProblems.push({axis,value,other:c,reason:'nonfinite'});continue;}
   const left=sub(b,a),right=sub(d,c0);
   const jump=length(sub(addScaled(b,left,1),addScaled(c0,right,-1)));
   const angle=length(left)>eps*.25&&length(right)>eps*.25?
    degrees(Math.acos(clamp(dot(unit(left),unit(right)),-1,1))):null;
   seamJumps.push(jump);if(angle!==null)seamAngles.push(angle);
   if(jump>opts.seamToleranceM)seamProblems.push({axis,value,other:c,jumpM:jump,angleDeg:angle});
  }
 }
 const stats=(vs)=>vs.length?{p95:quantile(vs,.95),max:vs.at(-1)}:null;
 return {samples:positions.length,issues:summary(bad,opts.exampleLimit),curvaturePerM:{s:stats(k1),t:stats(k2)},
  angularStepDeg:{s:stats(du),t:stats(dv)},minTangentSine:quantile(jac,0),evalNormalDeviationDeg:stats(normalDiff),
  seamProbe:seamJumps.length||seamProblems.length?{positionGapM:stats(seamJumps),tangentTurnDeg:stats(seamAngles),issues:summary(seamProblems,opts.exampleLimit)}:null};
}

export function validateMesh(mesh,options={}){
 const started=performance.now();
 const opts={
  checkIntersections:true,intersectionScope:'all',maxPairChecks:1_000_000,maxHashCellsPerFace:96,exampleLimit:16,
  checkIndexedSharedEdges:false,areaTolerance:null,distanceTolerance:null,minNormalLength:.72,maxNormalLength:1.28,
  orientationFloor:-.05,creaseWarningDeg:34,creaseLimitDeg:65,maxCurvaturePerM:125,minParamSine:1e-3,
  paramSamples:15,paramStep:1e-3,seamKnots:{s:[],t:[]},seamToleranceM:1e-4,requireNormals:true,ignorePair:mesh?.boundary?.ignorePair??null,
  ...options,
 };
 opts.seamKnots={s:[],t:[],...opts.seamKnots};
 if(['s','t'].some(key=>!arrayLike(opts.seamKnots[key])||opts.seamKnots[key].length>1024||
    [...opts.seamKnots[key]].some(x=>!Number.isFinite(x)||x<0||x>1)))
  throw new RangeError('Invalid parameter seam knots');
 if(!['all','skin'].includes(opts.intersectionScope)||!Number.isSafeInteger(opts.maxPairChecks)||opts.maxPairChecks<1||
   !Number.isSafeInteger(opts.paramSamples)||opts.paramSamples>101||opts.paramSamples<0||
   !Number.isFinite(opts.paramStep)||opts.paramStep<=0||opts.paramStep>=.05)
  throw new RangeError('Invalid intersection/parameter validation limits');
 const issues=[],warnings=[];
 const counts={vertices:0,triangles:0,skinTriangles:0,nonFinitePositions:0,nonFiniteNormals:0,invalidNormals:0,
  badIndices:0,degenerateTriangles:0,duplicateTriangles:0,reversedTriangles:0,sharpSkinEdges:0,manifoldSkinEdges:0,
  boundarySkinEdges:0,nonManifoldSkinEdges:0};
 const finish=(rest={})=>({ok:issues.length===0,issues,warnings,counts,timingMs:performance.now()-started,...rest});
 const positions=mesh?.positions,normals=mesh?.normals,indices=mesh?.indices;
 if(!arrayLike(positions)||positions.length%3||!positions.length||!arrayLike(indices)||indices.length%3||!indices.length){
  issues.push({code:'invalid-array-layout'});return finish();
 }
 counts.vertices=positions.length/3;counts.triangles=indices.length/3;
 const k=mesh.skinIndexCount??indices.length;
 if(!Number.isInteger(k)||k%3||k<0||k>indices.length){issues.push({code:'invalid-skin-range',value:k});return finish();}
 counts.skinTriangles=k/3;
 const haveNormals=arrayLike(normals)&&normals.length===positions.length;
 if(!haveNormals&&opts.requireNormals)issues.push({code:'missing-or-cardinality-mismatched-normals'});
 const valid=[],nrm=[],badP=[],badN=[],nonUnit=[];
 const bmin=[Infinity,Infinity,Infinity],bmax=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<counts.vertices;i++){
  const x=xyz(positions,i*3);
  if(finite3(x)){
   for(let j=0;j<3;j++){bmin[j]=Math.min(bmin[j],x[j]);bmax[j]=Math.max(bmax[j],x[j]);}
   valid.push(x);
  }else{badP.push(i);valid.push(null);}
  if(haveNormals){
   const n=xyz(normals,i*3);
   if(!finite3(n)){badN.push(i);nrm.push(null);}
   else{
    const L=length(n);
    if(L<opts.minNormalLength||L>opts.maxNormalLength)nonUnit.push({vertex:i,length:L});
    nrm.push(L>1e-18?times(n,1/L):null);
   }
  }
 }
 if(!valid.some(Boolean)){issues.push({code:'no-finite-position'});return finish();}
 const scale=Math.max(1e-6,length(sub(bmax,bmin)));
 const eps=opts.distanceTolerance??Math.max(1e-9,1e-8*scale),tol=opts.areaTolerance??Math.max(1e-18,eps*eps*.1);
 if(!(eps>0&&Number.isFinite(eps)&&tol>0&&Number.isFinite(tol)))throw new RangeError('Invalid geometric tolerance');
 function add(code,a,c,isIssue=true){
  counts[c]=a.length;
  if(a.length)(isIssue?issues:warnings).push({code,...summary(a,opts.exampleLimit)});
 }
 add('nonfinite-position',badP,'nonFinitePositions');add('nonfinite-normal',badN,'nonFiniteNormals');
 add('implausible-normal-length',nonUnit,'invalidNormals');
 const triangles=[],skinEdges=new Map(),duplicates=new Set();
 const invalid=[],small=[],back=[],duplicate=[];
 for(let o=0;o<indices.length;o+=3){
  const i=o/3,s=o<k,ids=xyz(indices,o);
  if(ids.some(n=>!Number.isInteger(n)||n<0||n>=counts.vertices||!valid[n])){invalid.push(i);continue;}
  const p=ids.map(j=>valid[j]);
  const N=cross(sub(p[1],p[0]),sub(p[2],p[0])),area=length(N)*.5;
  if(!(area>tol)||!Number.isFinite(area)){small.push({face:i,area});continue;}
  const normal=times(N,.5/area);
  const key=ids.slice().sort((a,b)=>a-b).join(':');
  if(duplicates.has(key))duplicate.push(i);duplicates.add(key);
  if(s&&haveNormals&&ids.every(j=>nrm[j])){
   const dots=ids.map(j=>dot(normal,nrm[j]));
   if(dots.reduce((sum,v)=>sum+v,0)/3<opts.orientationFloor)back.push({face:i,dots});
  }
  const tri={face:i,skin:s,p,normal,area,indices:ids,
   lo:[0,1,2].map(axis=>Math.min(p[0][axis],p[1][axis],p[2][axis])),
   hi:[0,1,2].map(axis=>Math.max(p[0][axis],p[1][axis],p[2][axis]))};
  triangles.push(tri);
  if(s){
   for(let a=0;a<3;a++){
    const b=(a+1)%3,[j,m]=[ids[a],ids[b]],code=Math.min(j,m)+':'+Math.max(j,m);
    const rec=skinEdges.get(code);
    const item={tri,forwards:j<m};
    if(rec)rec.push(item);else skinEdges.set(code,[item]);
   }
  }
 }
 add('triangle-index-out-of-bounds-or-invalid',invalid,'badIndices');
 add('degenerate-triangle',small,'degenerateTriangles');add('duplicate-indexed-triangle',duplicate,'duplicateTriangles');
 add('reversed-skin-winding',back,'reversedTriangles');
 const turns=[],sharp=[],excess=[],nonMan=[],flipped=[];
 for(const [edge,faces] of skinEdges){
  if(faces.length===1){counts.boundarySkinEdges++;continue;}
  if(faces.length>2){nonMan.push({edge,faces:faces.map(x=>x.tri.face)});continue;}
  counts.manifoldSkinEdges++;
  const [p,q]=faces;
  if(p.forwards===q.forwards)flipped.push({edge,faces:[p.tri.face,q.tri.face]});
  const a=degrees(Math.acos(clamp(dot(p.tri.normal,q.tri.normal),-1,1)));
  turns.push(a);
  if(a>opts.creaseWarningDeg)sharp.push({edge,degrees:a,faces:[p.tri.face,q.tri.face]});
  if(a>opts.creaseLimitDeg)excess.push({edge,degrees:a,faces:[p.tri.face,q.tri.face]});
 }
 add('skin-edge-is-non-manifold',nonMan,'nonManifoldSkinEdges');
 if(flipped.length)issues.push({code:'adjacent-skin-winding-disagreement',...summary(flipped,opts.exampleLimit)});
 add('sharp-skin-edge',sharp,'sharpSkinEdges',false);
 if(excess.length)issues.push({code:'skin-facet-angle-over-limit',...summary(excess,opts.exampleLimit)});
 const parametric=differential(mesh,eps,opts);
 if(parametric?.issues)issues.push({code:'parametric-nonfinite-or-singular',...parametric.issues});
 if(parametric?.seamProbe?.issues)issues.push({code:'parametric-position-gap-or-nonfinite',...parametric.seamProbe.issues});
 const maxK=Math.max(parametric?.curvaturePerM?.s?.max??0,parametric?.curvaturePerM?.t?.max??0);
 if(maxK>opts.maxCurvaturePerM)issues.push({code:'parametric-curvature-over-limit',value:maxK,limit:opts.maxCurvaturePerM});
 const intersections=hashIntersections(triangles,eps,opts,scale);
 if(!intersections.complete)issues.push({code:'intersection-scan-budget-exhausted',checked:intersections.tested,candidates:intersections.candidates});
 if(intersections.count)issues.push({code:'non-adjacent-triangle-intersection',count:intersections.count,examples:intersections.examples});
 return finish({
  bounds:{min:bmin,max:bmax,diagonal:scale},thresholds:{eps,areaTolerance:tol,creaseLimitDeg:opts.creaseLimitDeg,curvaturePerM:opts.maxCurvaturePerM},
  curvature:{skinEdgeAngleDeg:{p95:quantile(turns,.95),max:turns.at(-1)??null},parametric},intersections,
 });
}
