import * as T from '../../vendorBridge/three.js';

const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const mix=(a,b,t)=>a+(b-a)*t;
const lathe=(p,n)=>new T.LatheGeometry(p.map(([r,x])=>new T.Vector2(r,-x)),n).rotateZ(Math.PI/2);
const mesh=(p,idx,uv)=>{
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p.flat(),3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv.flat(),2));
 g.setIndex(idx);g.computeVertexNormals();return g;
};
const radial=(g,r)=>{
 const p=g.attributes.position,u=g.attributes.uv,a=2*r;
 for(let i=0;i<p.count;i++)u.setXY(i,
  clamp(.5+p.getY(i)/a),clamp(.5+p.getZ(i)/a));
 return g;
};
const vec=(x,r,a)=>[x,r*Math.cos(a),r*Math.sin(a)];
const tone=(y)=>{const h=Math.round(clamp(y,0,255)).toString(16).padStart(2,'0');return '#'+h+h+h;};

export function wheelTireTexture(type='road',shape=.5,depth=1){
 const width=96,height=56,pixels=[];
 const rally=type==='rally';
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Lathe V is explicitly partitioned into shoulder/sidewall and tread
  // bands below; U is a seamless circumference with repeated fine sipes.
  const u=x/(width-1),v=1-y/(height-1),band=Math.abs(v-.5);
  const noise=(Math.sin(u*TAU*43+v*77)*.5+Math.sin(u*TAU*29-v*91)*.5)*6;
  let sh;
  if(band<.174){
   const k=Math.max(-.98,Math.min(.98,(v-.5)/.170));
   const n=rally?14:20;
   const slope=(rally?1.45:.90)*Math.abs(k)+(rally?.31:.21)*(k<0?-1:1);
   const lug=Math.abs(Math.cos(Math.PI*(n*u+slope)));
   const channel=Math.min(...(rally?[.15,.59,.93]:[.23,.58,.93]).map(b=>Math.abs(Math.abs(k)-b)));
   const groove=lug<(rally?.21:.145)*(1+.28*(depth-1))||channel<(rally?.029:.036);
   const bevel=clamp((lug-.12)*6);
   sh=(groove?108:177+bevel*29)+noise+(rally?8:0);
  }else{
   const rib=Math.pow(Math.max(0,Math.cos((band-.17)*166)),13);
   const bead=Math.exp(-((band-.445)**2)/.0008),shine=Math.exp(-((band-.264)**2)/.003);
   const moldedDot=Math.max(0,Math.sin(u*TAU*31)*Math.cos((band-.31)*210))**7;
   sh=154+shape*17+18*shine+10*rib-26*bead+8*moldedDot+noise;
  }
  pixels.push(tone(sh));
 }
 return {width,height,pixels};
}

export function wheelRotorTexture(){
 const width=64,height=64,pixels=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const a=(x+.5-width/2)/(width/2),b=(y+.5-height/2)/(height/2),r=Math.hypot(a,b);
  const phi=Math.atan2(b,a);
  // Concentric turning marks and a dull unswept outer/inner lip; no
  // painted-in drill holes or overbright chrome highlight.
  const swept=(r>.48&&r<.94);
  const thread=8*Math.sin(r*138)+5*Math.cos(r*207+.35*Math.sin(7*phi));
  const fade=12*Math.cos(3*phi+.82)*Math.sin(8*r)+6*Math.cos(13*phi-4*r);
  pixels.push(tone((swept?206:r>=.94?165:155)+(swept?thread:thread*.27)+fade));
 }
 return {width,height,pixels};
}

const tireBands=[0,.105,.215,.325,.390,.610,.675,.785,.895,1];
function tire(r,c,rim,shape,depth,size,rally,n,compact=0){
 const bulk=r*(rally?.023:.011)*(1+.37*(depth-1));
 const shoulder=clamp(.77+shape*.13+(size-1)*.12,.71,.93);

 // Closed, pinched bead around a real alloy barrel. Width, radius and hub
 // have not moved. No geometry for grooves that only matter at texture scale.
 const p=[
  [rim*.988,-c*.74],[rim+(r-rim)*.35,-c*(.966-.032*shape)],
  [r-(r-rim)*(.15-.06*shape),-c],[r-bulk,-c*shoulder],
  [r,-c*.48],[r,c*.48],[r-bulk,c*shoulder],
  [r-(r-rim)*(.15-.06*shape),c],[rim+(r-rim)*.35,c*(.966-.032*shape)],[rim*.988,c*.74],
  [rim*.988,-c*.74]
 ];
 // Preserve the true outside radius at the crown.
 const rows=compact?[0,1,2,4,5,7,8,9,10]:p.map((_,i)=>i);
 const geom=lathe(rows.map(i=>p[i]),n),uv=geom.attributes.uv;
 for(let k=0;k<uv.count;k++){
  const row=rows[k%rows.length];
  uv.setY(k,tireBands[row]??1);
 }
 return geom;
}

function spoke(r,face,dish,i,count,style,depth,low){
 const a=i*TAU/count;
 const lean=(style==='mesh'?(i%2===0?-.097:.097):style==='5-spoke'?-.105:style==='15-spoke'?0:style==='10-spoke'?.009:-.052);
 const P=[],U=[],I=[];
 const section=[[-.52,-.85],[-.52,-.14],[-.30,.53],[.30,.53],[.52,-.14],[.52,-.85]];
 const radii=low?[0,1]:[0,.46,1];
 for(const s of radii){
  const rr=mix(.212,.968,s)*r;
  const fullWidth=(style==='4-spoke'?mix(.213,.151,s):style==='5-spoke'?mix(.159,.111,s):style==='mesh'?mix(.072,.052,s):style==='15-spoke'?mix(.079,.048,s):style==='10-spoke'?mix(.099,.060,s):style==='7-spoke'?mix(.144,.076,s):style==='8-spoke'?mix(.145,.112,s):mix(.122,.070,s))*depth;
  const angle=a+lean*s*s;
  for(const [side,b] of section){
   const x=face-(.005+dish*(1-s)**1.45)+b*r*(.043-.010*s);
   P.push(vec(x,rr,angle+fullWidth*side*r/rr));U.push([s,side+.5]);
  }
 }
 const n=section.length;
 for(let k=0;k+1<radii.length;k++)for(let j=0;j<n;j++){
  const q=k*n+j,k1=k*n+(j+1)%n,h=q+n,h1=k1+n;
  I.push(q,h,h1,q,h1,k1);
 }
 return mesh(P,I,U);
}

function boltSocket(x,r,i){
 const a=TAU*i/5,y=Math.cos(a)*r,z=Math.sin(a)*r,R=r*.19;
 const p=[[x,y,z]],u=[[.5,.5]],tri=[];
 for(let k=0;k<6;k++){
  const b=k*TAU/6;
  p.push([x,y+R*Math.cos(b),z+R*Math.sin(b)]);u.push([.5+.5*Math.cos(b),.5+.5*Math.sin(b)]);
  tri.push(0,k+1,(k+1)%6+1);
 }
 return mesh(p,tri,u);
}

function caliper(rotor,thick,low){
 // Follows a ring sector instead of a rectangular chrome block. The
 // angular shape wraps over the disc edge and is shaped toward the pads.
 const theta=2.09;
 const outer=low?[-.33,.0,.36]:[-.38,-.27,0,.27,.37];
 const p=[],uv=[],tri=[];
 for(const t of outer){
  const end=Math.abs(t)/.38,or=rotor*(1.145-.105*end**2);
  const ir=rotor*(.77+.13*end**2);
  for(const [x,r] of [[-.43,or],[-.37,ir],[.51,ir],[.54,or]]){
   p.push(vec(x*thick,r,theta+t));uv.push([t/.76+.5,r/rotor*.5]);
  }
 }
 const l=outer.length;
 for(let i=0;i<l-1;i++)for(let j=0;j<4;j++){
  const a=i*4+j,b=i*4+(j+1)%4;
  tri.push(a,b,b+4,a,b+4,a+4);
 }
 const last=(l-1)*4;
 tri.push(0,2,1,0,3,2,last,last+1,last+2,last,last+2,last+3);
 const g=mesh(p,tri,uv);g.userData.nonSpinning=true;return g;
}

export const rearWheelDimensions=d=>({tireWidth:clamp(d.tireWidth+(d.rearTireWidthOffset??0),.16,.36),rimRatio:clamp(d.rimRatio+(d.rearRimRatioOffset??0),.55,.86)});

export function buildWheels(g,{quality='preview',compact=0,emit,rear=false}={}){
 const out=[];
 const put=(k,m,x)=>{if(emit)emit(k,m,x);else out.push({component:k,material:m,geometry:x});};
 const {diameter}=g.dimensions;
 const {tireWidth,rimRatio}=rear?rearWheelDimensions(g.dimensions):g.dimensions;
 const r=diameter/2,c=tireWidth/2,w=g.components.wheels,t=g.components.tires;
 const detail=quality==='export'||quality==='preview'||quality==='garage';
 const low=quality==='opponent'||quality==='lod'||compact>0;
 const n=compact?[0,20,20,16][compact]:detail?24:low?16:20,innerN=compact?[0,12,10,9][compact]:detail?20:low?12:16;
 const rim=r*clamp(rimRatio*w.size,.44,.883);
 const face=c*.969,inner=c*.68;
 const lip=rim*(.043+.010*w.shape);
 const autoDish=(.008+w.shape*.037)*clamp(c/.108,.71,1.49);
 const dish=clamp(autoDish,.006,c*.53);
 put('tires','rubber',tire(r,c,rim,t.shape,t.depth,t.size,t.type==='rally',n,compact));
 if(g.dimensions.whitewallWidth>0){
  // Inlaid matte sidewall on the original outboard sidewall chart. Ends
  // remain below the shoulder; wheel radius, tire width and hub stay fixed.
  const outer=r-(r-rim)*(.15-.06*t.shape),inner=rim+(r-rim)*.35;
  const reach=Math.min((outer-inner)*.83,g.dimensions.whitewallWidth);
  const center=mix(inner,outer,.53),at=radius=>[radius,mix(c*(.966-.032*t.shape),c,(radius-inner)/(outer-inner))+.00055];
  put('tires','whitewall',lathe([at(center-reach*.5),at(center+reach*.5)],n));
 }
 // The barrel is hollow and dark: separate alloy face from the cast cavity.
 const tube=[
  [rim*.965,-inner],[rim*.861,-inner],[rim*.874,-inner+.006],
  [rim*.894,face-.020],[rim*.924,face-.011],[rim*.977,face-.015]
 ];
 put('wheels','barrel',lathe(compact?[tube[0],tube[1],tube[3],tube[5]]:tube,n));
 const rimProfile=[
  [rim*.922,face-.014],[rim-lip*1.20,face-.006],[rim-lip*.69,face+.001],
  [rim-lip*.16,face+.001],[rim,face-.005]
 ];
 put('wheels','wheel',lathe(compact?rimProfile.filter((p,i)=>i!==1&&i!==3):rimProfile,n));
 const hub=Math.min(face-dish+r*.017,c-.0048);
 const hubProfile=[
  [rim*.239,hub-.012],[rim*.221,hub-.004],[rim*.202,hub+.002],
  [rim*.188,hub+.004],[0,hub+.004]
 ];
 put('wheels','wheel',lathe(compact?hubProfile.filter((p,i)=>i!==1&&i!==3):hubProfile,innerN));

 if(w.type==='stamped steel'){
  // Pressed wheel centers are shallow metal discs, not cast spokes.
  // Recess the web between the wheel's central cap and turned outer lip.
  const b=face-.013, web=[[rim*.931,b],[rim*.795,b-.020],[rim*.709,b-.027],[rim*.465,b-.027],[rim*.31,b],[rim*.239,b]];
  put('wheels','wheel',lathe(web,n));
  // Small dark stamped vent pockets; they are blind relief, not texture.
  for(let k=0;k<8;k++){
   const a=k*TAU/8,r=rim*.587,rr=rim*.10;
   const recess=new T.CircleGeometry(rr,compact?5:8).rotateY(Math.PI*.5).translate(b-.026,Math.cos(a)*r,Math.sin(a)*r);
   put('wheels','seamDark',recess);
  }
 }else{
 const nSpokes=w.type==='4-spoke'?4:w.type==='6-spoke'?6:w.type==='5-spoke'?5:w.type==='15-spoke'?15:w.type==='10-spoke'?10:w.type==='8-spoke'?8:w.type==='7-spoke'?7:low?8:12;
 for(let k=0;k<nSpokes;k++)put('wheels','wheel',spoke(rim,face,dish,k,nSpokes,w.type,w.depth,low||nSpokes>7&&!detail));
  }
 if(!low)for(let k=0;k<5;k++)put('wheels','trim',boltSocket(hub+.0042,rim*.134,k));
 const disk=Math.max(.053,rim*.743),rotorX=Math.min(-.004,face-dish-.026),panel=.027+clamp(tireWidth-.225,-.045,.07)*.14;
 const rotorProfile=[
  [disk*.433,rotorX-panel*.44],[disk*.970,rotorX-panel*.44],[disk,rotorX-panel*.34],
  [disk,rotorX+panel*.39],[disk*.975,rotorX+panel*.48],[disk*.433,rotorX+panel*.48],
  [disk*.417,rotorX+panel*.28],[0,rotorX+panel*.28]
 ];
 const rotor=lathe(compact?rotorProfile.filter((p,i)=>[1,2,3,6,7].includes(i)):rotorProfile,innerN);
 put('wheels','rotor',radial(rotor,disk));
 const cal=caliper(disk,Math.min(c*1.02,panel*3.12),low);cal.translate(rotorX+.008,0,0);
 put('wheels','caliper',cal);
 return out;
}
