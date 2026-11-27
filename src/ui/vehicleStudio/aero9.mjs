import * as T from '../../vendorBridge/three.js';

const rad=Math.PI/180;
const finite=(v,d)=>Number.isFinite(v)?v:d;
const bounded=(v,lo,hi,d)=>Math.max(lo,Math.min(hi,finite(v,d)));
const mix=(a,b,t)=>a+(b-a)*t;
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const mul=(a,t)=>a.map(n=>n*t);
const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a)=>mul(a,1/(Math.hypot(...a)||1));
const wrap=a=>Math.sign(a)*Math.abs(a)**.78;
function loft(rows,invert=false,closed=true){
 const pos=[],uv=[],index=[],n=rows[0].length;
 rows.forEach((row,i)=>row.forEach((p,j)=>{pos.push(...p);uv.push(i/(rows.length-1),j/(closed?n:n-1));}));
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<(closed?n:n-1);j++){
  const a=i*n+j,b=i*n+(j+1)%n,c=a+n,d=b+n;
  if(!invert)index.push(a,b,c,b,d,c);else index.push(a,c,b,b,c,d);
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setIndex(index);geometry.computeVertexNormals();
 return geometry;
}
function ring(center,rx,ry,n,shape='round',U=[1,0,0],V=[0,1,0]){
 return Array.from({length:n},(_,i)=>{
  const a=i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  const form=shape==='rectangle'||shape==='rectangular'||shape==='square'||shape==='box'
   ?v=>Math.sign(v)*Math.abs(v)**.45:shape==='trapezoid'||shape==='trapezoidal'?wrap:v=>v;
  const taper=shape==='trapezoid'||shape==='trapezoidal'?1+.17*s:1;
  return add(add(center,mul(U,rx*form(c)*taper)),mul(V,ry*form(s)));
 });
}
function arc(p0,p1,p2,p3,t){
 const a=1-t;
 return p0.map((x,i)=>a**3*x+3*a*a*t*p1[i]+3*a*t*t*p2[i]+t**3*p3[i]);
}
function boxMesh(x,y,z,p){return new T.BoxGeometry(x,y,z).translate(...p);}

function wingGeometry({cfg,sp,put,sample,dims,evalFormula,quality}){
 if(sp.type==='off'||sp.type==='none')return {elements:0,supports:0};
 const {X,Lr,cabinRear}=dims,lip=sp.type==='lip'||sp.type==='ducktail';
 const w=bounded((.66+.19*sp.size)*X,.24,X*.95,X*.8);
 const depth=bounded(sp.depth,.55,1.8,1),chord=lip?.21*depth:.31*depth;
 const z=mix(Lr,cabinRear,(lip?.14:.29)+bounded(sp.bias,-1,1,0)*.075);
 const h=lip?.042+sp.shape*.043:(.15+sp.shape*.16)*depth+bounded(cfg.elevation,-.10,.12,0);
 const cam=chord*bounded(cfg.camber,0,1,.34)*.21,sweep=.19*bounded(cfg.sweep,-1,1,.08);
 const taper=bounded(cfg.taper,0,.85,.22),angle=bounded(cfg.angle,-24,24,finite(sp.angle,-1.5))*rad;
 const thickness=chord*bounded(cfg.thickness,.035,.245,.10);
 const elements=lip?1:Math.round(bounded(cfg.elements,1,3,1));
 const supports=lip?0:Math.round(bounded(cfg.supports,1,4,2));
 const reach=(x,at)=>sample.trunk(at,bounded((1+x/X)*.5,0,1,.5))[1];
 const base=reach(0,z);
 const section=quality==='lod'?12:20,span=quality==='lod'?10:18;
 const formula=(u,v,x)=>{if(!cfg.formula||typeof evalFormula!=='function')return 0;
  try{return bounded(evalFormula(cfg.formula,{u,v,x,y:base,z,chord,span:w*2}),-.08,.08,0);}catch{return 0;}};
 for(let element=0;element<elements;element++){
  const C=chord*(1-.28*element),rise=element*(thickness+.017),aft=element*.035;
  const rows=Array.from({length:span+1},(_,i)=>{
   const u=i/span,a=2*u-1,x=w*a,ab=Math.abs(a),c=C*(1-taper*ab**1.5),rake=sweep*ab**1.7;
   return Array.from({length:section},(_,j)=>{
    const theta=j/section*Math.PI*2,v=(1-Math.cos(theta))*.5,d=.5-v;
    const yt=thickness*1.48*(.2969*Math.sqrt(v)-.126*v-.3516*v*v+.2843*v**3-.1015*v**4)*5;
    const y=lip
     ?reach(x,z+rake+c*d)+h*(.35+.65*ab**.42)*v+Math.sign(Math.sin(theta))*yt
     :base+h+rise+cam*Math.sin(Math.PI*v)+Math.sign(Math.sin(theta))*yt;
    return [x,y+d*c*Math.sin(angle)+formula(u,v,x),z+rake+c*d*Math.cos(angle)-aft];
   });
  });
  put('spoiler','paint',loft(rows,true));
  for(const r of [rows[0],rows.at(-1)]){
   const C=r.reduce((s,p)=>add(s,mul(p,1/r.length)),[0,0,0]),ends=[];
   for(let i=0;i<r.length;i++)ends.push(...C,...r[i],...r[(i+1)%r.length]);
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ends,3));geo.computeVertexNormals();
   if(r===rows.at(-1)){const arr=geo.getAttribute('position');for(let k=0;k<arr.count;k+=3){const x=arr.getX(k+1),y=arr.getY(k+1),z=arr.getZ(k+1);arr.setXYZ(k+1,arr.getX(k+2),arr.getY(k+2),arr.getZ(k+2));arr.setXYZ(k+2,x,y,z);}geo.computeVertexNormals();}
   put('spoiler','paint',geo);
  }
 }
 for(let i=0;i<supports;i++){
  const a=supports===1?0:(2*i/(supports-1)-1)*bounded(cfg.spacing,.18,.95,.68),x=w*a;
  const Z=z+sweep*Math.abs(a)**1.7,y=reach(x,Z)-.013,top=base+h-.009;
  if(top<=y+.010)continue;
  const rows=Array.from({length:5},(_,j)=>{
   const t=j/4,p=[x+Math.sign(x)*.023*Math.sin(Math.PI*t),mix(y,top,t),Z+.075*(1-t)-.046*t*t];
   return ring(p,mix(.045,.025,t),mix(.098,.058,t),10,'rectangle',[1,0,0],[0,0,-1]);
  });
  put('spoiler','paint',loft(rows));
  if(elements>1){
   const brZ=Z-.039;
   const y2=top+(elements-1)*(thickness+.017)+.016;
   const br=Array.from({length:4},(_,i)=>{const f=i/3;return ring([x,mix(top,y2,f),brZ-(elements-1)*.025*f],.013,.032,8,'rectangle',[1,0,0],[0,0,-1]);});
   put('spoiler','paint',loft(br));
  }
 }
 return {elements,supports};
}

export function buildAero({g,quality='preview',put,sample,dims,evalFormula}){
 const construction=g.construction??{}, ex=g.components.exhaust;
 const result={wing:wingGeometry({cfg:construction.wing??{},sp:g.components.spoiler,put,sample,dims,evalFormula,quality}),outlets:[]};
 const {X,floor,Lr}=dims,groups=Array.isArray(construction.exhaust)?construction.exhaust:null;
 const n=ex.type==='quad'?4:ex.type==='dual'?2:ex.type==='off'?0:1;
 const inferred=Array.from({length:n},(_,i)=>{
  const u=n===1?.77:mix(.18,.82,i/(n-1)),p=sample.rear(u,1);
  return {id:'legacy-'+i,x:p[0],y:Math.max(.028,p[1]-floor-.014)+ex.bias*.025,diameter:.084*ex.size,pitch:ex.angle,
   count:1,protrusion:.028,curvature:.32,finish:'chrome'};
 });
 const chosen=groups?.length?groups:inferred;
 const rings=quality==='lod'?12:quality==='export'?24:18,pathSteps=quality==='lod'?5:9;
 function atX(x,v){
  let a=0,b=1;
  for(let i=0;i<20;i++){const t=(a+b)*.5;if(sample.rear(t,v)[0]>x)b=t;else a=t;}
  return sample.rear((a+b)*.5,v);
 }
 for(const [groupIndex,q] of chosen.slice(0,12).entries()){
  if(!q||typeof q!=='object')continue;
  const d=bounded(q.diameter,.032,.23,.084),radius=d*.5,num=Math.round(bounded(q.count,1,6,1)),spacing=bounded(q.spacing,d*.85,.28,d*1.23);
  const gx=bounded(q.x,-X,X,.52*X),wall=bounded(q.wall,.0015,radius*.35,.004);
  const finish=q.finish==='black'||q.finish==='dark'||q.finish==='carbon'||q.finish==='matte'?'trim':q.finish==='steel'?'heatShield':'chrome';
  const shape=q.shape==='rect'?'rectangular':q.shape??'round';
  const rx=radius*(shape==='oval'?1.22:1),ry=radius*(shape==='oval'?.76:shape==='rectangle'||shape==='rectangular'||shape==='trapezoid'||shape==='trapezoidal'?.72:1);
  const Y=floor+bounded(q.y,-.045,.36,.020);
  for(const mirror of q.mirror&&Math.abs(gx)>.002?[1,-1]:[1]){
   const outlets=[];
   for(let i=0;i<num;i++){
    const x=bounded(mirror*(gx+(i-(num-1)*.5)*spacing),-X+rx+.012,X-rx-.012,0);
    const edge=atX(x,1), y=Math.max(ry+.018,Y);
    const profile=atX(x,1-bounded((y-edge[1])/.43,0,.8,0)),rear=profile[2];
    const recess=bounded(q.recess,0,.16,0),pro=bounded(q.protrusion,-.025,.19,.028);
    const pitch=bounded(q.pitch,-35,35,0)*rad,yaw=mirror*bounded(q.yaw,-38,38,0)*rad,roll=mirror*bounded(q.roll,-180,180,0)*rad;
    const F=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
    const U0=unit(cross(F,[0,1,0])),V0=unit(cross(U0,F));
    const U=add(mul(U0,Math.cos(roll)),mul(V0,Math.sin(roll))),V=add(mul(V0,Math.cos(roll)),mul(U0,-Math.sin(roll)));
    // The view-facing ring remains in front of the bumper skin unless a caller cuts its opening.
    const C=[x,y,rear-Math.max(.006,pro-recess*.40)],D=a=>add(C,mul(F,a));
    const bevel=bounded(q.bevel,.001,.021,.004);
    const lip=(nc,a,b)=>ring(nc,a,b,rings,shape,U,V);
    put('exhaust',finish,loft([lip(D(-.083),rx*.84,ry*.84),lip(D(-bevel),rx,ry),lip(C,rx-bevel*.45,ry-bevel*.45),lip(D(-bevel*.33),rx-wall,ry-wall)],true));
    const tunnel=Math.max(.067,.085+recess*.65);
    put('exhaust','seamDark',loft([lip(D(-bevel*.33),rx-wall,ry-wall),lip(D(-.044),rx-wall,ry-wall),lip(D(-tunnel),rx*.47,ry*.47),lip(D(-tunnel-.01),.0008,.0008)],true));
    // Rolled annular heat shield closed off by a separate body of pipe, not a black front cap.
    put('exhaust','trim',loft([lip(D(-.016),rx+.005,ry+.005),lip(D(-.026),rx+.018,ry+.015),lip(D(-.065-recess*.28),rx+.021,ry+.018),lip(D(-.103-recess*.44),rx+.009,ry+.008)]));
    outlets.push({x,y,rear,center:C,axis:F,U,V,rx,ry,radius,shape});
   }
   const avg=outlets.reduce((p,q)=>add(p,mul(q.center,1/outlets.length)),[0,0,0]);
   const turn=bounded(q.curvature,-1,1,.38),M=[avg[0]*.92,Math.max(.080,Math.min(avg[1]+.015,floor+.046)),Math.max(avg[2]+.39,Lr+.42)];
   put('exhaust','chrome',loft([ring(add(M,[0,0,-.143]),.043,.035,rings),ring(add(M,[0,0,-.122]),.073+num*.009,.050,rings,'oval'),ring(add(M,[0,0,.114]),.073+num*.009,.050,rings,'oval'),ring(add(M,[0,0,.15]),.046,.035,rings)]));
   put('exhaust','floor',boxMesh(.21+num*.027,.013,.38,add(M,[0,.063,0])));
   for(const p of outlets){
    const P0=add(p.center,mul(p.axis,-.09)),P1=add(P0,mul(p.axis,-.14));
    const P3=add(M,[bounded((p.x-avg[0])*.38,-.060,.060,0),0,-.12]),P2=add(P3,[turn*.11,.085*turn,-.1]);
    const pipe=Array.from({length:pathSteps+1},(_,i)=>{
     const s=i/pathSteps,point=arc(P0,P1,P2,P3,s),N=unit(sub(arc(P0,P1,P2,P3,Math.min(1,s+.001)),arc(P0,P1,P2,P3,Math.max(0,s-.001))));
     const u=unit(cross([0,1,0],N)),v=unit(cross(N,u)),r=bounded(p.radius*.63,.017,.059,.028);
     return ring(point,r,r,quality==='lod'?8:12,'round',u,v);
    });
    put('exhaust','chrome',loft(pipe));
    result.outlets.push({id:q.id??String(groupIndex),mirror:mirror<0,center:p.center,axis:p.axis,rx:p.rx,ry:p.ry,shape:p.shape});
   }
  }
 }
 return result;
}
