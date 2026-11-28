import * as T from '../../vendorBridge/three.js';
const mix=(a,b,t)=>a+(b-a)*t, clamp=(x,a=0,b=1)=>Math.min(Math.max(x,a),b);
const pi=Math.PI;
function span(a,b,r,n=8){
 const aa=new T.Vector3(...a),bb=new T.Vector3(...b),dir=bb.clone().sub(aa);
 const m=new T.CylinderGeometry(r,r,dir.length(),n,1);
 return m.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize())).translate(...aa.clone().lerp(bb,.5).toArray());
}
function patch(n,m,fn,omit=null){
 const p=[],uv=[],i=[];
 for(let u=0;u<=n;u++)for(let v=0;v<=m;v++){p.push(...fn(u/n,v/m));uv.push(u/n,v/m);}
 for(let u=0;u<n;u++)for(let v=0;v<m;v++){if(omit?.((u+.5)/n,(v+.5)/m))continue;const a=u*(m+1)+v,b=a+m+1;i.push(a,b,b+1,a,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(i);g.computeVertexNormals();return g;
}
function dome(w,h,l,x,y,z){return new T.SphereGeometry(1,14,8).scale(w,h,l).translate(x,y,z);}
export function buildOpenWheelVintage({g,put,dims,quality,compact}){
 const d=g.dimensions,{L,Lf,Lr,X,B,floor,wheelRadius:R,tireTrack,rearTireTrack}=dims;
 const n=compact?24:quality==='export'?48:36,m=24;
 const width=X*g.body.openWheelShell, height=d.height, short=(Lf-Lr);
 const crownT=clamp(.41+d.cabin*.59,.27,.54);
 const windowHalf=clamp(d.cabinLength*.31,.11,.19);
 const x0=Math.round((crownT-windowHalf)*n)/n,x1=Math.round((crownT+windowHalf)*n)/n;
 const windowWidth=.102;
 const topPts=[[0,.35,.56],[.08,.66,.89],[.20,.86,.98],[.40,1,1],[.56,.99,.93],[.72,.89,.84],[.91,.68,.76],[1,.50,.72]];
 const map=(u,v)=>{
  const j=Math.max(1,topPts.findIndex(p=>p[0]>=u)),[f,w,h]=topPts[j-1],[f2,w2,h2]=topPts[j],t=clamp((u-f)/(f2-f));const a=(v-.5)*2*pi, c=Math.cos(a);
  const z=mix(Lr,Lf,u),lo=floor+.042+(.033*(1-u)**3),hi=height*mix(h,h2,t)-.045;
  const corner=g.body.openWheelNoseBoxiness;
  const q=clamp((u-.72)/.28),cornerEase=q*q*(3-2*q),power=1-corner*cornerEase*.65,sin=Math.sin(a);
  const sx=corner?Math.sign(sin)*Math.abs(sin)**power:sin;
  const sy=corner?Math.sign(c)*Math.abs(c)**power:c;
  let r=width*mix(w,w2,t),x=r*sx*(c<0?.85+.10*c:1),y=mix(lo,hi,(1+sy)*.5);
  // Width independently constrained near carrier suspension and tires. It
  // does not follow or intrude on any rotating wheel/steering matrices.
  const hub=z>0?tireTrack:rearTireTrack; const reserve=hub-d.tireWidth/2-.10;
  x=clamp(x,-reserve,reserve);
  return [x,y,z];
 };
 const cut=(u,v)=>u>x0&&u<x1&&Math.abs(v-.5)<windowWidth;
 const shell=patch(n,m,map,cut);
 shell.userData.constructionRole='vintage open-wheel barrel skin';
 put('hood','paint',shell);
 // Close taper and front radiator plane.
 for(const [u,key,mat] of [[0,'trunk','paint'],[1,'grille','seamDark']]){
  const mid=map(u,.25);mid[0]=0;
  // Use an exact fan center rather than a sub-quantization inner ring.
  // The exporter discards redundant center triangles in every render tier.
  const cover=patch(7,m,(v,a)=>{const p=map(u,u?1-a:a);return p.map((w,k)=>mix(mid[k],w,v));});
  put(key,mat,cover);
 }
 const vi=Math.round((.5-windowWidth)*m)/m,vj=1-vi;
 for(const v of [vi,vj]){
  let old=map(x0,v);
  for(let i=1;i<=8;i++){const p=map(mix(x0,x1,i/8),v);put('roof','trim',span(old,p,.012));old=p;}
 }
 const cutZ=mix(Lr,Lf,crownT), seatFloor=height*.46;
 const fairing=map(Math.max(0,x0-.025),.5);
 put('trunk','paint',dome(width*.25,.067,short*.054,0,fairing[1]-.030,fairing[2]-.028));
 put('floor','underbody',new T.BoxGeometry(width*1.02,.038,short*(x1-x0)*1.02).translate(0,seatFloor,cutZ));
 put('seats','seat',dome(.221,.085,.225,0,seatFloor+.07,cutZ-.07));
 put('seats','seat',dome(.205,.202,.048,0,seatFloor+.185,cutZ-.25));
 const dashZ=mix(Lr,Lf,x1)-.04;
 put('dash','trim',new T.BoxGeometry(width*1.00,.13,.04).translate(0,height*.697,dashZ));
 put('steering','trim',new T.TorusGeometry(.127,.013,8,18).rotateX(.43).translate(0,height*.68,dashZ-.12));
 // Low flat half-width wind deflector, not a passenger windshield.
 const screenY=map(x1,.5)[1]-.009;
 put('glass','glass',patch(8,2,(u,v)=>[(u-.5)*.44,screenY+.106*v*Math.sin(pi*u)**.40,dashZ+.057-.064*v]));
 for(const [z,half] of [[L,tireTrack],[-L,rearTireTrack]])for(const s of [-1,1]){
  const signed=s*(half-(d.tireWidth+(z>0?0:d.rearTireWidthOffset))*.5-.08),y=R+(z>0?0:d.rearWheelRadiusDelta);
  for(const h of [-.055,.049]){
   const a=[s*width*.70,y+h,z-.17],b=[s*width*.75,y+h,z+.19],c=[signed,y+h,z];
   put(z>0?'frontFenders':'rearFenders','chrome',span(a,c,.015));
   put(z>0?'frontFenders':'rearFenders','chrome',span(b,c,.015));
  }
  put(z>0?'frontFenders':'rearFenders','trim',span([signed,y-.06,z],[signed,y+.08,z],.024));
 }
 const nose=Lf+.004,tail=Lr-.006;
 const outline=Array.from({length:19},(_,i)=>map(1,i/18));
 for(let i=1;i<outline.length;i++)put('grille','chrome',span(outline[i-1],outline[i],.009));
 for(let i=-4;i<=4;i++){
  const x=i*width*.098,q=Math.sqrt(1-(x/(width*.52))**2);
  if(!g.body.openWheelNoseBoxiness){
   put('grille','chrome',span([x,height*.49-(height*.24)*q,nose],[x,height*.49+(height*.24)*q,nose],.006));
   continue;
  }
  // Keep bars inside the authored radiator rim instead of extending the
  // oval default's fixed height above the new painted nose silhouette.
  const cuts=outline.slice(1).flatMap((b,j)=>{
   const a=outline[j], den=b[0]-a[0],t=(x-a[0])/den;
   return Math.abs(den)>1e-8&&t>=0&&t<=1?[mix(a[1],b[1],t)]:[];
  });
  if(cuts.length>=2){
   const lo=Math.min(...cuts)+.012,hi=Math.max(...cuts)-.012;
   if(hi>lo)put('grille','chrome',span([x,lo,nose],[x,hi,nose],.006));
  }
 }
 for(const s of [-1,1]){
  for(let v=0;v<7;v++){
   const [x,y,z]=map(.59+.032*v,s>0?.75:.25);
   put('hood','seamDark',span([x+s*.002,y-.044,z],[x+s*.003,y+.044,z-.028],.0075,6));
  }
  const xe=s*width*.84,exY=floor+.20;
  const exhaustSide=g.body.openWheelExhaustSide;
  if(!exhaustSide||exhaustSide===s)
   put('exhaust','chrome',span([xe,exY,.87],[xe,exY,-1.01],.039));
  // Small gameplay lamps, not claimed as original GP fixtures.
  put('headlights','head',dome(.018,.012,.007,s*.102,height*.51,nose+.018));
  put('headlights',s>0?'signalR':'signalL',dome(.014,.010,.007,s*.147,height*.43,nose+.012));
  put('tails','opticRed',dome(.014,.013,.009,s*.072,height*.40,tail-.010));
  put('tails','runningRed',dome(.014,.009,.009,s*.073,height*.36,tail-.011));
  put('tails','opticClear',dome(.010,.009,.007,s*.039,height*.38,tail-.012));
 }
}
export function buildVintageBlower({g,put,dims}){
 const {Lf,B,floor,X}=dims,a=g.body.vintageBlower;
 const face=Lf+.028, coreWidth=X*.49, base=floor+.16, mid=B-.13;
 const edge=(u,v)=>{
  const x=(2*u-1)*coreWidth,y=mix(base,mid+.19,v)-Math.abs(2*u-1)**5*.035*v;
  return [x*(.89+.10*Math.sin(pi*v)),y,face+.016*Math.sin(pi*u)];
 };
 put('grille','trim',patch(16,6,edge));
 for(const u of [0,1]){let start=edge(u,0);for(let i=1;i<=7;i++){const p=edge(u,i/7);put('grille','chrome',span(start,p,.011));start=p;}}
 for(const v of [0,1]){let start=edge(0,v);for(let i=1;i<=8;i++){const p=edge(i/8,v);put('grille','chrome',span(start,p,.011));start=p;}}
 for(let i=1;i<14;i++){
  const u=i/14,p=edge(u,.19),q=edge(u,.92);p[2]+=.002;q[2]+=.002;
  put('grille','barrel',span(p,q,.005,5));
 }
 for(const s of [-1,1]){
  const z1=dims.L+.018,z0=-dims.L+.002;
  const r=(u,v)=>[s*(X*.529+v*.133),floor+.046+.014*Math.sin(pi*u),mix(z0,z1,u)];
  put('rockers','trim',patch(12,3,r));
  put('rockers','chrome',span(r(0,1),r(1,1),.012,8));
 }
 const y=base+.040, z=Lf+.068;
 const lo=[-.205*a,y,z], hi=[.205*a,y,z];
 put('frontBumper','barrel',span(lo,hi,.076*a,12));
 for(const s of [-1,1]){
  const x=s*.20*a;
  put('frontBumper','chrome',span([x,y,z],[s*.233*a,y,z],.077*a,14));
  put('frontBumper','chrome',span([x,y+.024,z],[s*.152*a,y+.12,z-.068],.039*a,12));
 }
 for(let i=-2;i<=2;i++)put('grille','chrome',span([i*.069*a-.008,y,z],[i*.069*a+.008,y,z],.079*a,12));
}
