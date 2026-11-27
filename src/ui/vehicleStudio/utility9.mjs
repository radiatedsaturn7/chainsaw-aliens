import * as T from '../../vendorBridge/three.js';

const mix=(a,b,t)=>a+(b-a)*t;
const P=([x,y,z])=>new T.Vector3(x,y,z);
const yAxis=new T.Vector3(0,1,0);

function tube(put,component,mat,A,B,r0,r1=r0,n=6){
 const a=P(A),b=P(B),axis=b.clone().sub(a),h=axis.length();
 if(h<1e-4)return;
 const g=new T.CylinderGeometry(r1,r0,h,n,1,false);
 g.applyQuaternion(new T.Quaternion().setFromUnitVectors(yAxis,axis.normalize()));
 g.translate(...a.add(b).multiplyScalar(.5).toArray());
 put(component,mat,g);
}

function spring(put,a,b,radius,coils,turnSegments,wireSides){
 const A=P(a),D=P(b).sub(A),N=D.clone().normalize(),U=new T.Vector3(0,0,1).cross(N).normalize(),V=N.clone().cross(U);
 const p=[],uv=[],tri=[],segments=coils*turnSegments;
 for(let i=0;i<=segments;i++){
  const t=i/segments,phase=2*Math.PI*coils*t;
  const radial=U.clone().multiplyScalar(Math.cos(phase)).addScaledVector(V,Math.sin(phase));
  const center=A.clone().addScaledVector(D,t).addScaledVector(radial,radius);
  for(let j=0;j<wireSides;j++){
   const q=2*Math.PI*j/wireSides,v=center.clone().addScaledVector(radial,.006*Math.cos(q)).addScaledVector(N,.006*Math.sin(q));
   p.push(...v.toArray());uv.push(t,j/wireSides);
  }
 }
 for(let i=0;i<segments;i++)for(let j=0;j<wireSides;j++){
  const a=i*wireSides+j,b=i*wireSides+(j+1)%wireSides,c=a+wireSides,d=b+wireSides;tri.push(a,c,b,b,c,d);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(tri);g.computeVertexNormals();
 put('suspension','caliper',g);
}

export function buildUtilitySuspension({put,dims,compact,amount,tireWidth}){
 if(amount<=0)return;
 const {X,L,floor,tireTrack,rearTireTrack,wheelRadius:r}=dims,n=compact?5:8;
 const y=Math.min(r+.016,floor+.04),dy=.32*amount,inset=Math.max(.015,tireWidth*.5+.024);
 tube(put,'suspension','underbody',[-X*.52,y-.09,L-.17],[X*.52,y-.09,L-.17],.043,.043,n);
 // Drop the live axle's visual housing and shaft below the generic occlusion
 // tray. The tire anchors and physical collider stay in their normal roles.
 const axleY=y-.037*amount;
 tube(put,'suspension','rotor',[-rearTireTrack+inset,axleY,-L],[rearTireTrack-inset,axleY,-L],.039,.039,n);
 tube(put,'suspension','heatShield',[0,axleY-.005,-L-.083],[0,axleY-.006,-L+.092],.082,.074,n);
 tube(put,'suspension','heatShield',[0,axleY-.027,-L+.09],[0,floor-.040*amount,L*.18],.034,.026,n);
 const underplate=(w,len,h,z)=>put('suspension','heatShield',new T.BoxGeometry(X*w,.012,L*len).translate(0,floor-h*amount,L*z));
 underplate(.83,.48,.072,1.16);
 underplate(.61,.39,.067,.675);
 for(const s of [-1,1])tube(put,'suspension','rotor',[s*X*.21,floor-.080*amount,L*.48],[s*X*.29,floor-.082*amount,L*1.25],.011,.011,n);
 for(const s of [-1,1]){
  const front=tireTrack-inset,rear=rearTireTrack-inset,a=[s*front,y-.095,L],b=[s*front,y+.064,L-.038];
  const lowFront=[s*X*.48,y-.099,L+.238],lowRear=[s*X*.47,y-.108,L-.22];
  for(const q of [lowFront,lowRear])tube(put,'suspension','rotor',q,a,.023,.019,n);
  for(const z of [L-.146,L+.143])tube(put,'suspension','barrel',[s*X*.48,y+.083,z],b,.014,.012,n);
  const upper=[s*mix(front,X*.49,amount*.46),y+.028+dy,L-.022];
  const jacket=a.map((v,i)=>mix(v,upper[i],.53));
  tube(put,'suspension','barrel',a,jacket,.028,.033,n);
  tube(put,'suspension','chrome',jacket,upper,.013,.013,n);
  if(compact===0)spring(put,a,upper,.043,5,8,6);
  else tube(put,'suspension','caliper',a,a.map((v,i)=>mix(v,upper[i],.78)),.033,.047,n);
  const aR=[s*rear,y-.04,-L-.064],topR=[s*mix(rear,X*.53,amount*.44),y+.045+dy,-L+.21];
  for(const k of [-1,1])tube(put,'suspension','barrel',[s*X*.36,y+k*.064,-L+.67],[s*rear*.86,axleY+k*.034,-L],.019,.016,n);
  tube(put,'suspension','chrome',aR,topR,.026,.014,n);
  if(compact===0)spring(put,aR,topR,.042,5,8,6);
  else tube(put,'suspension','caliper',aR,aR.map((v,i)=>mix(v,topR[i],.78)),.041,.029,n);
 }
}

export function buildRoofRails({put,roof,front,rear,amount,compact}){
 if(amount<=0)return;
 for(const s of [-1,1]){
  const u=s<0?.095:.905;
  const p=[.16,.23,.78,.84].map(t=>roof(mix(rear,front,t),u));
  const h=.027+.038*amount,n=compact?5:8;
  const rail=p.map((v,i)=>[v[0],v[1]+h*(i===0||i===3?.43:1),v[2]]);
  for(let i=1;i<rail.length;i++)tube(put,'roof','trim',rail[i-1],rail[i],.013,.013,n);
  for(const i of [0,3])tube(put,'roof','trim',p[i],rail[i],.020,.017,n);
 }
}
