import * as T from '../../vendorBridge/three.js';

/* Model-space cabin tools. The field geometry is given to put() in the same
   metre coordinates as the outer assembly; no exterior skin is used as floor. */
const pi=Math.PI, tau=pi*2;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const ip=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const f=(x,p)=>Math.sign(x)*Math.abs(x)**p;
const safe=(v,d)=>Number.isFinite(v)?v:d;
const shellProfile=(rows,t)=>{
 const n=rows.length-1, k=Math.max(0,Math.min(n-1,Math.floor(t*n))),r=t*n-k;
 // Smooth curvature between sections without extrapolating past fitted limits.
 return ip(rows[k],rows[k+1],r);
};
function geom(ps,uv,idx){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(ps,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 return g;
}
function patch(n,m,evalPoint,flip=false){
 const p=[],uv=[],faces=[];
 for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){p.push(...evalPoint(i/n,j/m));uv.push(i/n,j/m);}
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){
  const a=i*(m+1)+j, b=a+m+1;
  if(flip)faces.push(a,b+1,b,a,a+1,b+1);else faces.push(a,b,b+1,a,b+1,a+1);
 }
 return geom(p,uv,faces);
}
function closedLoft(rings,segments,point,reverse=false){
 const p=[],uv=[],fs=[];
 for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
  p.push(...point(i/(rings-1),j*tau/segments));uv.push(i/(rings-1),j/segments);
 }
 const tri=(a,b,c)=>{if(reverse)fs.push(a,c,b);else fs.push(a,b,c);};
 for(let i=0;i<rings-1;i++)for(let j=0;j<segments;j++){
  const a=i*segments+j,b=i*segments+(j+1)%segments,c=b+segments,d=a+segments;
  tri(a,b,c);tri(a,c,d);
 }
 for(const [row,last] of [[0,false],[rings-1,true]]){
  const center=[0,0,0];
  for(let j=0;j<segments;j++)for(let k=0;k<3;k++)center[k]+=p[(row*segments+j)*3+k]/segments;
  const o=p.length/3;p.push(...center);uv.push(last?1:0,.5);
  for(let j=0;j<segments;j++){
   const a=row*segments+j,b=row*segments+(j+1)%segments;
   if(last)tri(o,a,b);else tri(o,b,a);
  }
 }
 return geom(p,uv,fs);
}
function box(w,h,d){return new T.BoxGeometry(w,h,d);}
function rod(a,b,r,segments=8){
 const from=new T.Vector3().fromArray(a),to=new T.Vector3().fromArray(b),span=to.clone().sub(from);
 const rot=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),span.clone().normalize());
 const g=new T.CylinderGeometry(r,r,span.length(),segments);
 return g.applyQuaternion(rot).translate(...from.clone().lerp(to,.5).toArray());
}
function sweptTube(points,r,segments=7){
 // Short trim pieces and rolled grips along actual interior sampled curves.
 const p=points.map(v=>new T.Vector3(...v));
 return new T.TubeGeometry(new T.CatmullRomCurve3(p),Math.max(4,p.length*2),r,segments,false);
}

export function buildCabin({g,quality='preview',compact=0,put,sample,dims}){
 const small=(a,...cuts)=>compact?cuts[compact-1]:a;
 const lod=quality==='lod',high=['export','cockpit'].includes(quality);
 const c=g.components, cfg=g.construction?.cabin??{},roadster=c.roof.type==='roadster open';
 const layout=cfg.layout??(c.doors.type==='four door'?'bench':'front-only');
 const bolster=clamp(safe(cfg.bolster,.55),0,1),lumbar=clamp(safe(cfg.lumbar,.52),0,1),trim=clamp(safe(cfg.trim,.54),0,1);
 const {X,L,cabinFront,cabinRear,roofFront,roofRear}=dims;
 const cabinDepth=cabinFront-cabinRear;
 if(!(cabinDepth>.55&&X>.35))throw RangeError('Cabin section envelope is too small');
 let triangleCount=0;
 const add=(part,material,geo,p=null,r=null)=>{
  triangleCount+=(geo.index?.count??geo.attributes.position.count)/3;
  return put(part,material,geo,p,r);
 };
 const q=(fn,fallback)=>{
  try{const pos=fn();return pos?.length===3&&pos.every(Number.isFinite)?pos:fallback;}catch{return fallback;}
 };
 const sideAt=(z,v,s)=>q(()=>sample.side(clamp(z,cabinRear,cabinFront),v,s),[s*X*.79,dims.B+.35*v,z]);
 const roofAt=(z,u)=>q(()=>sample.roof(clamp(z,roofRear,roofFront),u),[(2*u-1)*X*.72,g.dimensions.height-.03,z]);
 const glassAt=(end,t,u)=>q(()=>sample[end==='front'?'frontGlass':'rearGlass'](t,u),[(2*u-1)*X*.78,mix(dims.B,g.dimensions.height-.03,t),end==='front'?mix(cabinFront,roofFront,t):mix(cabinRear,roofRear,t)]);
 const widthAt=z=>Math.min(Math.abs(sideAt(z,0,1)[0]),Math.abs(sideAt(z,0,-1)[0]))-.044;
 const baseY=z=>mix(sideAt(z,0,1)[1],sideAt(z,0,-1)[1],.5);
 const floorY=clamp(dims.floor+.15,dims.floor+.08,Math.min(dims.B-.15,dims.floor+.21));
 const xBound=z=>Math.max(X*.45,Math.min(widthAt(z),X*.78));
 const rear=cabinRear+.016, front=cabinFront-.026;
 const floorFront=Math.max(rear+.3,front-.085);
 const floorSamples=small(lod?7:high?17:12,4,3,3);
 // Shaped interior floor, floating above the separately owned chassis
 // undertray. The small lobes are floor mats and footwells, not rocker skin.
 const floorPoint=(s,u)=>{
  const z=mix(rear,floorFront,s),a=2*u-1,x=a*xBound(z);
  const toe=clamp((z-(floorFront-.26))/.26,0,1);
  const tunnel=.078*Math.exp(-((x/Math.max(.12,X*.145))**4));
  return [x,floorY+tunnel+.048*Math.abs(a)**8+.075*toe**2,z];
 };
 add('seats','floor',patch(floorSamples,small(8,5,4,4),floorPoint));
 const upperZ=s=>mix(rear+.012,front-.018,s);
 const beltInner=(s,sign)=>{
  const z=upperZ(s),p=sideAt(z,0,sign);
  return [sign*(Math.abs(p[0])-.022),p[1]-.025,z];
 };
 // Both bulkheads use the same lower and upper perimeter as the door skins;
 // this closes the tub rather than just hiding its axle-facing silhouettes.
 for(const end of ['front','rear']){
  const isFront=end==='front',s=isFront?1:0;
  add(isFront?'dash':'seats','interior',patch(small(lod?5:11,3,2,2),small(8,5,4,4),(t,u)=>{
   const a=2*u-1,side=u<.5?-1:1,low=floorPoint(s,u), rail=beltInner(s,side);
   const hi=[Math.abs(a)*rail[0],rail[1]+.013*(1-a*a),rail[2]];
   const p=ip(low,hi,t),camber=.020*(1-a*a)*Math.sin(pi*t);
   p[2]+=(isFront?1:-1)*camber;return p;
  },!isFront));
 }
 const shelfB=rear+Math.min(.24,cabinDepth*.16);
 if(layout!=='three-row')add('seats','floor',patch(small(lod?4:8,2,2,2),small(7,5,4,4),(t,u)=>{
  const z=mix(rear,shelfB,t),a=2*u-1;
  return [a*xBound(z),baseY(z)-.071-.038*t+.016*(1-a*a),z];
 }));

 for(const s of [-1,1]){
  // Exact attached side; its upper edge follows the model's real belt and glass
  // seal. Parametric trim fades into the rounded, enclosed floor corner.
  const inner=(z,t)=>{
   const station=clamp((z-rear)/(floorFront-rear),0,1),a=clamp(t,0,1);
   const p=ip(floorPoint(station,(s+1)/2),beltInner(station,s),a);
   const midside=Math.sin(pi*station);
   p[0]-=s*.029*midside*Math.sin(pi*a)**2;
   return p;
  };
  add('doors','interior',patch(floorSamples,small(lod?4:7,3,2,2),(u,v)=>inner(mix(rear,floorFront,u),v),s<0));
  add('doors','seat',patch(small(lod?6:12,4,3,3),small(3,2,1,1),(u,v)=>{
   const z=mix(rear+.11,front-.17,u),drop=.020*((2*u-1)**4);
   const p=inner(z,mix(.55,.77,v)-drop);p[0]-=s*(.006+.010*Math.sin(pi*u)*Math.sin(pi*v));return p;
  },s<0));
  if(!lod){
   const doorCount=c.doors.type==='four door'||c.doors.type==='three door right'&&s>0?2:1;
   for(let j=0;j<doorCount;j++){
    const z=mix(front-.30,rear+.30,doorCount===1?.42:j);
    const innerPoint=t=>{const p=inner(z,t);p[0]-=s*.020;return p;};
    const p=innerPoint(.68),a=[p[0],p[1]-.029,p[2]-.12],b=[p[0]-s*.008,p[1]+.031,p[2]+.073];
    add('doors','trim',rod(a,b,.018,8));
    const h=innerPoint(.88), a2=[h[0]-s*.007,h[1]+.008,h[2]-.065],b2=[h[0]-s*.001,h[1],h[2]+.020];
    add('doors','chrome',rod(a2,b2,.006+trim*.003,6));
   }
  }
 }
 // Inner roof headliner and windshield/corner returns remain opaque, but the
 // actual glass is still exterior geometry controlled by the sheet shader.
 if(!roadster){
 add('pillars','interior',patch(small(lod?7:13,4,3,3),small(lod?6:11,4,3,3),(u,v)=>{
  const z=mix(roofRear+.008,roofFront-.008,u),p=roofAt(z,v);
  return [p[0]*.984,p[1]-.033-.021*Math.abs(2*v-1)**5,p[2]];
 },true));
 for(const s of [-1,1]){
  // Opaque seal/rolled trim joins the offset liner to its corresponding
  // glass shoulder; main side glazing is unaffected.
  add('pillars','trim',patch(lod?6:12,3,(t,u)=>{
   const z=mix(roofRear+.008,roofFront-.008,t);
   const edge=roofAt(z,(s+1)/2);
   return [edge[0]*(.984+.013*u),edge[1]-(.054-.041*u),z];
  },s<0));
 }
 }
 for(const end of roadster?['front']:['front','rear']){
  const s=end==='front'?1:-1;
  add('pillars','trim',patch(small(3,2,1,1),small(lod?8:14,6,5,4),(v,u)=>{
   const p=glassAt(end,mix(.91,.998,v),u);p[0]*=.987;p[1]-=.017+.025*v;p[2]-=s*.016;return p;
  },s<0));
  for(const sign of [-1,1]){
   const side=sign<0?0:1;
   add('pillars','interior',patch(small(lod?5:10,3,2,2),small(3,1,1,1),(v,u)=>{
    const p=glassAt(end,v,mix(side,.5,u*.060));p[0]-=sign*.012;p[1]-=.008*v;p[2]-=s*(.014+.012*Math.sin(pi*u));return p;
   },sign===s));
  }
 }

 const seats=[],rowMeta=[];
 const central=layout==='center-driver', driverOnly=layout==='driver-only';
 const rowCount=layout==='three-row'?3:layout==='front-only'||central||driverOnly?1:2;
 const limits={
  1:{u:[cfg.cargoPanel?.18:.31],zLength:[.49]},
  2:{u:[.31,.76],zLength:[.49,.43]},
  3:{u:[.31,.56,.84],zLength:[.45,.37,.32]}
 }[rowCount];
 // Row coordinates are indexed from firewall backwards. A third row uses a
 // shorter center section and proportionally scaled modules, not clipping.
 const profileY=(z,x=0)=>{
  const u=clamp((x/Math.max(.25,X*.75)+1)*.5,.02,.98);
  if(z>=roofRear&&z<=roofFront)return Math.min(roofAt(z,u)[1],g.dimensions.height);
  const end=z<roofRear?'rear':'front',dir=end==='rear'?1:-1;
  let lo=0,hi=1;
  for(let i=0;i<12;i++){const t=(lo+hi)*.5;if((glassAt(end,t,u)[2]-z)*dir<0)lo=t;else hi=t;}
  return glassAt(end,(lo+hi)*.5,u)[1];
 };
 function addSeat({x,z,w,l,y,bench=false,positions=2,row=0,jump=false}){
  const rearZ=z-l*.48,foreZ=z+l*.51,stand=.052;
  const hh=clamp((profileY(rearZ-.12,x)-y-.204)/.82,.234,bench?.52:.65);
  const cushionH=(bench?.098:.106)*clamp(c.seats.depth,.80,1.2);
  const tilt=.084+.062*clamp(c.seats.shape,0,1)+(row?.017:0);
  const sec=[[-.5,.78,.24],[-.39,.94,.78],[-.16,1,1],[.09,1,.98],[.30,.99,.83],[.48,.86,.43]];
  add('seats','seat',closedLoft(small(lod?5:high?11:8,3,3,2),small(lod?10:18,8,6,6),(u,a)=>{
   const [zc,width,h]=shellProfile(sec,u), ac=f(Math.cos(a),.65), sn=f(Math.sin(a),.68),ed=Math.abs(ac);
   const rail=Math.max(0,sn)*Math.max(0,(ed-.54)/.46)**1.5*(bench?.008:.017+.017*bolster);
   return [x+ac*w*.5*width,y+cushionH*.30+sn*cushionH*.58*h+rail,z+zc*l];
  }));
  const backs=[
   [0,.93,.24],[.13,.99,.91],[.31,1,1],[.56,.96,.81],[.77,.93,.62],[.90,.78,.55],[1,.44,.32]
  ];
  const periodLow=Boolean(g.construction.cabin.periodLowSeat&&row===0);
  const hBack=hh*(jump?.54:periodLow?.69:.82);
  const up=y+cushionH*.62;
  add('seats','seat',closedLoft(small(lod?6:high?14:10,4,3,3),small(lod?10:18,8,6,6),(u,a)=>{
   const [t,wi,dd]=shellProfile(backs,u), ac=f(Math.cos(a),.62), sn=f(Math.sin(a),.69);
   const wing=bench?.010:.055*bolster;
   const panel=Math.max(0,sn)*(wing*Math.abs(ac)**1.9+.019*lumbar*Math.sin(pi*t)**2);
   return [x+ac*w*.49*wi,up+hBack*t,rearZ+.037-tilt*t+.066*dd*sn+panel];
  },true));
  if(!lod){
   // Raised outer cloth welts run parallel to the real seat, using the same
   // support-section spine and staying a hair outside the upholstery.
   const welts=[-1,1];
   if(bench)welts.push(0);
   for(const s of welts){
    const aw=s*.36;
    const px=[.15,.30,.48,.66,.81].map(t=>{
     const [,wi,dd]=shellProfile(backs,t);
     return [x+w*aw*wi,up+hBack*t,rearZ+.037-tilt*t+dd*.045+.029*bolster*Math.abs(s)+.014*lumbar*Math.sin(pi*t)**2];
    });
    add('seats','interior',sweptTube(px,.0019+.0013*trim,5));
   }
   for(const s of [-1,1]){
    add('seats','trim',box(.024,.038,l*.76),[x+s*w*.26,y-stand,z]);
    add('seats','interior',box(.052,.028,.07),[x+s*w*.26,y-stand-.020,foreZ-.065]);
    add('seats','interior',box(.052,.028,.07),[x+s*w*.26,y-stand-.020,rearZ+.035]);
   }
  }
  const headW=bench?w*(positions===3?.17:.21):w*.51,headL=.079,headH=.10;
  const headrests=periodLow||jump?[]:bench?(positions===3?[-1,0,1]:[-1,1]):[0];
  for(const s of headrests){
   const hx=x+s*w*.28,hy=up+hBack-.009,hz=rearZ+.028-tilt;
   if(!lod)for(const sign of [-1,1])add('seats','chrome',rod([hx+sign*headW*.24,hy-.036,hz],[hx+sign*headW*.24,hy+.065,hz],.005,6));
   add('seats','seat',closedLoft(small(lod?4:7,4,4,3),small(lod?8:12,8,8,6),(u,a)=>{
    const sw=.76+.24*Math.sin(pi*u);return [hx+headW*.5*sw*f(Math.cos(a),.59),hy+.040+headH*u,hz+headL*.5*sw*f(Math.sin(a),.57)];
   },true));
  }
  seats.push({row,center:[x,y,z],width:w,length:l,bench,headrests:headrests.length});
  return {height:up+hBack};
 }
 for(let i=0;i<rowCount;i++){
  const z=mix(front,rear,limits.u[i]), usable=xBound(z), width=usable*2;
  const rowPitch=rowCount===3?cabinDepth*.26:cabinDepth*.39;
  const length=Math.min(limits.zLength[i]*clamp(c.seats.size,.78,1.18),rowPitch*.94);
  const y=floorY+.108+i*.019;
  const middleBench=i===1&&layout==='three-row'&&Boolean(g.construction.cabin.middleBench);
  const isBench=middleBench||i>0&&(layout==='bench'||(layout==='three-row'&&i===2));
  const middleJump=i===1&&layout==='three-row'&&!middleBench&&Boolean(cfg.middleJumpSeat);
  const middlePlaces=cfg.middleBenchSeats??3;
  const ordered=isBench||central?[0]:driverOnly?[cfg.driverSide==='right'?1:-1]:[-1,1];
  const rowStart=seats.length;
  const captainW=Math.min(width*.43,.51*c.seats.size,middleJump?width*.295:Infinity);
  for(const s of ordered){
   const x=s*width*.247;
   addSeat({x,z,w:isBench?width*.93:captainW,l:length,y,bench:isBench,positions:middleBench?middlePlaces:rowCount===3&&i===2?g.construction.cabin.rearBenchSeats:2,row:i});
  }
  if(middleJump)addSeat({x:0,z:z-.018,w:Math.min(width*.194,.284),l:length*.77,y:y-.009,row:i,jump:true});
  rowMeta.push({index:i,z,layout:isBench?'bench':'individual',count:central||driverOnly?1:middleJump?3:middleBench?middlePlaces:isBench?(layout==='three-row'?g.construction.cabin.rearBenchSeats:3):2,parts:seats.length-rowStart});
 }

 const dashZ=front-.118, dw=Math.min(widthAt(dashZ)*1.95,xBound(dashZ)*2*c.dash.size);
 const dashY=Math.min(baseY(dashZ)-.021,glassAt('front',0,.5)[1]-.045);
 const dashD=clamp(c.dash.depth*.29,.23,.38);
 // Sculpt the fascia face, cowl return and lower kick rather than a separate
 // egg. Dashboard supports meet the firewall/wheel column with hidden bolts.
 const dash=(u,v)=>{
  const a=2*u-1, bulge=(1-a*a), z=mix(dashZ-dashD,dashZ+.042,v);
  return [a*dw*.5*(.97+.03*v),dashY+.018*bulge-.072*(1-v)**3-.022*Math.abs(a)**3,z+.044*(1-bulge)*(1-v)];
 };
 add('dash','interior',patch(small(lod?8:18,6,5,4),small(lod?4:9,3,2,2),dash,true));
 add('dash','interior',patch(small(lod?8:18,6,5,4),small(lod?4:8,3,2,2),(u,v)=>{
  const p=dash(u,0), a=2*u-1;
  return [p[0]*(1-.071*v),p[1]-(.115+.033*Math.abs(a))*v,p[2]+.044*v+.015*Math.sin(pi*v)];
 }));
 add('dash','trim',patch(lod?7:15,2,(u,v)=>{
  const p=dash(u,0);p[1]-=.052+.018*v;p[2]-=.002;return p;
 }));
 const driver=seats.find(x=>x.row===0&&x.center[0]*(cfg.driverSide==='right'?-1:1)<0)??seats[0];
 const steeringX=driver.center[0], steeringY=dashY-.052, steeringZ=dashZ-dashD-.123;
 const st=c.steering, sr=.153*clamp(st.size,.82,1.22);
 const steeringAngle=-.32;
 {
  const wheel=new T.TorusGeometry(sr,.013*st.depth,small(lod?5:8,4,4,4),small(lod?22:high?46:36,16,14,12));
  if(st.type==='flat-bottom'){
   const attr=wheel.attributes.position;for(let i=0;i<attr.count;i++)attr.setY(i,Math.max(-sr*(.72+.14*st.shape),attr.getY(i)));wheel.computeVertexNormals();
  }
  add('steering','rubber',wheel,[steeringX,steeringY,steeringZ],[steeringAngle,0,0]);
 }
 const hub=[steeringX,steeringY,steeringZ+.004],origin=[steeringX,steeringY-.060,dashZ-dashD+.104];
 add('steering','interior',rod(hub,origin,.029,lod?6:11));
 const spokes=st.type==='flat-bottom'?[.10,pi-.10,pi*1.5]:[.13,pi-.13,pi*1.5];
 for(const a of spokes)add('steering','trim',rod(
  [steeringX+.034*Math.cos(a),steeringY+.032*Math.sin(a),steeringZ+.006],
  [steeringX+sr*.94*Math.cos(a),steeringY+sr*.94*Math.sin(a)*Math.cos(steeringAngle),steeringZ+sr*.94*Math.sin(a)*Math.sin(steeringAngle)],
  lod?.012:.013,6));
 add('steering','interior',new T.CylinderGeometry(.051,.055,.040,lod?9:16).rotateX(pi/2),hub);
 const instr=c.instruments, ix=steeringX,iy=dashY+.018, iz=dashZ-dashD+.027, iw=.255*c.instruments.size;
 add('instruments','interior',closedLoft(lod?3:6,lod?9:14,(u,a)=>{
  const ev=.8+.20*Math.sin(pi*u);return [ix+iw*.55*ev*f(Math.cos(a),.72),iy+.070*ev*f(Math.sin(a),.70),iz+.115*u];
 }));
 const dials=instr.type==='digital'?[0]:[-.32,.02,.36];
 for(const t of dials){
  const px=ix+t*iw, py=iy+.002,pz=iz-.006;
  if(instr.type==='digital'){
   add('instruments','trim',box(iw*.81,.060,.009),[px,py,pz]);
   if(!lod)for(const s of [-1,0,1])add('instruments','chrome',box(.041,.006,.002),[px+s*.056,py+.007,pz-.006]);
  }else{
   const r=.027+instr.shape*.006;
   add('instruments','trim',new T.CylinderGeometry(r,r,.010,small(lod?10:17,8,7,6)).rotateX(pi/2),[px,py,pz]);
   if(!lod){
    add('instruments','chrome',new T.TorusGeometry(r,.0016,5,18),[px,py,pz-.006]);
    add('instruments','chrome',rod([px,py,pz-.007],[px-r*.36,py+r*.69,pz-.007],.0015,5));
   }
  }
 }
 // Center stack, seams and controls anchor at the local dashboard plane.
 const cp=c.console, centerZ=mix(dashZ-dashD-.2,driver.center[2]-.20,.54);
 const consoleTop=floorY+.135+.10*cp.depth;
 const consoleW=.17+.066*cp.size, tunnelX=central?Math.min(.31,xBound(driver.center[2])*.48):0;
 add('console','interior',closedLoft(lod?5:10,lod?8:13,(u,a)=>{
  const w=.80+.19*Math.sin(pi*u);return [tunnelX+consoleW*.5*w*f(Math.cos(a),.56),consoleTop-.056+.074*w*f(Math.sin(a),.70),mix(centerZ-.36,dashZ-.18,u)];
 }));
 add('console','trim',box(.168*cp.size,.108,.030),[tunnelX,dashY-.100,dashZ-dashD-.013],[-.13,0,0]);
 if(!lod){
  for(let i=0;i<3;i++)add('console','chrome',new T.CylinderGeometry(.014,.015,.007,10).rotateX(pi/2),[tunnelX+(i-1)*.046,dashY-.119,dashZ-dashD-.030]);
  for(const x of [-.27,0,.27]){
   const w=.108*.68+.045*trim;
   add('dash','trim',box(w,.030,.015),[x*dw,dashY-.006,dashZ-dashD-.009]);
   if(high)for(let j=0;j<3;j++)add('dash','interior',box(w*.88,.003,.006),[x*dw,dashY-.014+.007*j,dashZ-dashD-.018]);
  }
  add('console','trim',box(.119,.013,.123),[tunnelX,consoleTop+.026,centerZ+.13]);
 }
 const gear=[tunnelX,consoleTop+.105+cp.shape*.035,centerZ+.115];
 add('console','chrome',rod([tunnelX,consoleTop,centerZ+.14],gear,.012,7));
 add('console','trim',new T.SphereGeometry(cp.type==='manual'?.027:.039,lod?8:13,lod?5:8).scale(1,.85,.88),gear);
 const pedalCenters=[];
 if(!lod){
  const py=floorY+.081, pz=floorFront-.13;
  for(const x of [-.071,.007,.076]){
   add('dash','trim',rod([steeringX+x,py+.079,pz+.023],[steeringX+x,py,pz],.009,6));
   const pedal=[steeringX+x,py-.006,pz-.025];
   pedalCenters.push(pedal);
   add('dash','rubber',box(.044,.026,.057),pedal,[.51,0,0]);
  }
 }
 return {layout,rows:rowMeta,seats,capacity:rowMeta.reduce((s,r)=>s+r.count,0),
  driverEye:[steeringX,Math.min(profileY(driver.center[2],steeringX)-.083,driver.center[1]+.63),driver.center[2]-.044],
  steeringCenter:[steeringX,steeringY,steeringZ],pedalCenters,floorY,triangles:triangleCount,detail:lod?'driving-lod':high?'cockpit':'studio'};
}
