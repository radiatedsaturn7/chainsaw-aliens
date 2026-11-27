// Hidden stamped enclosure: tray, tire-clear vaults, sill returns and end pans.
// The visible skin / aperture rails are owned by geometry.mjs, never guessed.
import * as T from '../../vendorBridge/three.js';

const EPS=1e-8, mix=(a,b,t)=>a+(b-a)*t, cap=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=cap(x);return x*x*(3-2*x);};
const xyz=p=>Array.isArray(p)?p:p?.toArray?.()??null;
const exact=(a,b,n)=>Array.from({length:n+1},(_,i)=>mix(a,b,i/n));
const triangleCount=g=>g.index.count/3;
function mesh(rows,out){
 const n=rows[0].length,p=rows.flat(),v=[],uv=[],ix=[];
 for(let i=0;i<rows.length;i++)for(let j=0;j<n;j++){v.push(...rows[i][j]);uv.push(j/(n-1),i/(rows.length-1));}
 const cross=(a,b,c)=>{
  const A=p[a],B=p[b],C=p[c],x=B.map((n,i)=>n-A[i]),y=C.map((n,i)=>n-A[i]);
  return [x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
 };
 let orientation=0;const indices=[];
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<n-1;i++){
  const a=j*n+i,b=a+n;
  for(const t of [[a,b,b+1],[a,b+1,a+1]]){
   const c=cross(...t);if(Math.hypot(...c)<EPS)continue;
   indices.push(t);orientation+=c.reduce((a,x,i)=>a+x*out[i],0);
  }
 }
 for(const t of indices)ix.push(...(orientation>=0?t:[t[0],t[2],t[1]]));
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(v,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(ix);g.computeVertexNormals();g.computeBoundingBox();return g;
}
/** A conservative box-projected tire envelope in chassis coordinates. */
export function structureTireEnvelope(radius,width,yaw=0,travel=.054){
 const lateral=radius*Math.sin(yaw)+(width/2)*Math.cos(yaw);
 const fore=Math.hypot(radius,width/2); // upper bound for any steering angle
 return {lateral,fore,travel};
}
export function buildStructure({g,quality='preview',put,sample,dims}){
 const {X,L,Lf,Lr,floor,B,cabinFront,cabinRear,tireTrack,rearTireTrack=tireTrack,wheelRadius:R,archRadius,frontArchRadius=archRadius,rearArchRadius=archRadius}=dims;
 const W=g.dimensions.tireWidth,issues=[];
 const perf=quality==='drive',high=quality==='export';
 const envelope=(ax)=>structureTireEnvelope(R,W,ax>0?.63:.13,.054);
 const wheelZ=[-L,L],parts=[];
 const add=(name,mat,rows,n)=>{
  const q=mesh(rows,n);if(!q.index.count){q.dispose();return;}
  put(name,mat,q);parts.push(q);
 };
 const edge=(z,s)=>{
  const p=xyz(sample.arch?.(z,s))??xyz(sample.side(z,1,s));
  if(p?.length!==3||p.some(v=>!Number.isFinite(v)))throw Error('Invalid wheel-arch master rail');
  return p;
 };
 const rails=wheelZ.map(ax=>{
  const e=envelope(ax),openingRadius=ax>0?frontArchRadius:rearArchRadius,extent=Math.max(openingRadius+.018,e.fore+.032);
  const track=ax>0?tireTrack:rearTireTrack;
  return {ax,e,extent,track,openingRadius,inside:Math.min(X*.83,track-e.lateral-.024)};
 });
 for(const r of rails)if(r.inside<.11)issues.push('Tire sweep leaves too little room for a closed central tray.');
 const floorAt=(z,x)=>{
  const tunnel=Math.exp(-((Math.abs(x)/.155)**4)), q=.011*Math.cos((z-(Lr+Lf)/2)*3);
  return floor-.023+.031*tunnel+q*(1-tunnel);
 };
 const widthAt=(z,s)=>{
  const outer=Math.abs(edge(z,s)[0]);
  let width=Math.max(.12,outer-.014);
  for(const r of rails){
   const u=1-smooth((Math.abs(z-r.ax)-r.e.fore-.013)/.042);
   width=mix(width,Math.max(.11,r.inside),u);
  }
  return width;
 };
 const inWell=z=>rails.some(r=>Math.abs(z-r.ax)<r.extent+EPS);
 const frontApron=Math.min(...exact(0,1,14).map(u=>sample.front(u,1)[2]))-.024;
 const rearApron=Math.max(...exact(0,1,14).map(u=>sample.rear(u,1)[2]))+.024;
 const trayFront=Math.max(rails[1].ax+rails[1].extent+.004,frontApron);
 const trayRear=Math.min(rails[0].ax-rails[0].extent-.004,rearApron);
 const zz=new Set(exact(trayRear,trayFront,perf?19:high?42:28).filter(z=>!inWell(z)));
 const stations=[];
 for(const r of rails){
  r.zs=exact(r.ax-r.extent,r.ax+r.extent,perf?17:high?36:24)
   .map(z=>Math.min(Lf-.04,Math.max(Lr+.04,z)));
  r.zs=[...new Set(r.zs)];
  r.zs.forEach(z=>zz.add(z));
 }
 for(const z of [cabinRear,cabinFront])if(z>trayRear&&z<trayFront&&!inWell(z))zz.add(z);
 stations.push(...[...zz].sort((a,b)=>a-b));
 const ns=perf?7:high?12:9;
 function tray(z,u){
  const span=u<.5?widthAt(z,-1):widthAt(z,1);
  const x=(2*u-1)*span;return [x,floorAt(z,x),z];
 }
 add('underbody','underbody',stations.map(z=>exact(0,1,ns).map(u=>tray(z,u))),[0,-1,0]);
 // Use literally the same tray stations on both components, so the rocker
 // crown cannot leave a floating cut between its hem and the floor.
 for(const s of [-1,1]){
  const sill=stations.filter(z=>z>=rails[0].zs.at(-1)&&z<=rails[1].zs[0]);
  if(sill.length>1)add('underbody','trim',sill.map(z=>{
   const p=edge(z,s),q=tray(z,s>0?1:0);
   return [p,q];
  }),[0,-1,0]);
 }
 let clearance=Infinity;
 for(const r of rails){
  for(const s of [-1,1]){
   const cname=r.ax>0?'frontFenders':'rearFenders';
   const linerRows=[],innerRows=[];
   for(const z of r.zs){
    const [ox,oy,oz]=edge(z,s),innerX=s*widthAt(z,s);
    const isOpening=Math.abs(z-r.ax)<Math.min(r.openingRadius,r.e.fore);
    const th=cap(1-Math.abs(z-r.ax)/(r.e.fore+.019));
    const targetTop=R+r.e.travel+Math.sqrt(Math.max(0,(r.e.fore+.012)**2-(z-r.ax)**2))+.014;
    // The perforated opening stays visible, but surfaces wrap up and back
    // from that exterior flange so the open bay doesn't reveal another wheel.
    const guard=.032*smooth(th*6), top=Math.max(oy-.002,Math.min(B+.021,targetTop));
    const row=exact(0,1,perf?4:high?7:5).map(u=>{
     const x=mix(ox,innerX,u);
     // Only the source edge (u=0) remains on the hem. Raise inward along most
     // of the vault before flattening into the protected inner wall.
     const y=mix(oy-.002,top,smooth(u*4))+(isOpening?guard*Math.sin(Math.PI*u):0);
     return [x,y,mix(oz,z,smooth(u))];
    });
    const p=row.at(-1),q=[innerX,floorAt(z,innerX),z];
    linerRows.push(row);
    innerRows.push([p,[innerX*.997,mix(p[1],q[1],.45),z],q]);
    if(Math.abs(z-r.ax)<=r.e.fore)clearance=Math.min(clearance,r.track-r.e.lateral-Math.abs(innerX));
   }
   // The canopy ends fade into the low front/rear skirt, and the inner
   // backwall is shared geometrically with the central floor edge.
   add(cname,'trim',linerRows,[0,-1,0]);
   add(cname,'underbody',innerRows,[s,0,0]);
   for(const j of [0,r.zs.length-1]){
    const z=r.zs[j],row=linerRows[j],bx=row.at(-1)[0];
    const edgeRows=[row,row.map(p=>[p[0],mix(floorAt(z,bx),p[1],.42),z]),
     row.map(p=>[p[0],floorAt(z,bx),z])];
    // Both tire ends are behind the wheel's maximal longitudinal reach.
    if(Math.abs(z-r.ax)>r.e.fore+.008)add(cname,'trim',edgeRows,[0,0,j===0?1:-1]);
   }
  }
 }
 // End pan follows the true rolled apron (including spoiler/bumper edits).
 // Vertical black backing is set behind any small authored seam.
 for(const name of ['front','rear']){
  const sign=name==='front'?1:-1,e=xyz(sample[name](.5,1)), z=sign>0?stations.at(-1):stations[0];
  const a=exact(0,1,ns);
  const mouth=a.map(u=>xyz(sample[name](u,1)));
  const top=a.map(u=>xyz(sample[name](u,.955)));
  add(name+'Bumper','underbody',[mouth,
   mouth.map(([x,y,w],i)=>[mix(x,tray(z,a[i])[0],.38),mix(y,tray(z,a[i])[1],.48)-.008,mix(w,z,.48)]),
   a.map(u=>tray(z,u))],[0,-1,0]);
  const tailY=Math.max(floor+.027,Math.min(B-.056,e[1]+.21));
  add(name+'Bumper','underbody',[top.map(([x,y,z])=>[x*.96,y,z-sign*.023]),
   top.map(([x,y,z])=>[x*.90,mix(y,tailY,.52),z-sign*.095]),
   top.map(([x,y,z])=>[x*.86,tailY,z-sign*.155])],[0,0,sign]);
 }
 // Nominal trunk tub aft of the cabin floor: an opaque bottom at chassis
 // level with raised support ribs and an independent rear luggage panel.
 // It stays above the floor shell and between the inboard well walls.
 const bootZ0=Math.max(Lr+.215,Math.min(-L+.23,cabinRear-.27));
 const bootZ1=Math.max(bootZ0+.13,Math.min(cabinRear-.013,-.28));
 const boot=exact(bootZ0,bootZ1,perf?6:high?12:9).map(z=>{
  const wid=.89*Math.max(.13,Math.min(widthAt(z,1),widthAt(z,-1)));
  return exact(-1,1,perf?6:9).map(u=>[u*wid,floor+.046+.047*Math.abs(u)**6,z]);
 });
 add('underbody','floor',boot,[0,1,0]);
 add('underbody','underbody',[boot[0],boot[0].map(([x,y,z])=>[x*.9,y+.108,z-.037])],[0,0,1]);
 if(clearance<.017)issues.push('Central tray clearance below 17 mm in the steering-envelope estimate.');
 const triangles=parts.reduce((m,q)=>m+triangleCount(q),0);
 return {issues,metrics:{triangles,wheelLinerInsetM:clearance,frontTireSweep:rails[1].e,rearTireSweep:rails[0].e}};
}
