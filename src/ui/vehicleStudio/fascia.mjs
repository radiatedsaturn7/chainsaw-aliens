import * as T from '../../vendorBridge/three.js';
import {math} from './genome.mjs';
const {clamp,mix}=math;
const smooth=t=>t*t*(3-2*t);
const hump=t=>Math.sin(Math.PI*clamp(t));
const guide=(c,t)=>{
 const a=1-t;
 // Bernstein control displacements, independently editable on each axis.
 return a**3*c[0]+3*a*a*t*c[1]+3*a*t*t*c[2]+t**3*c[3];
};

export function createEndSurface({settings:f,end,tip,seam,archEnd,cabin,floor,deckAt,sideAt,bumper,upper=null,hoodFairing=0}){
 const s=end==='front'?1:-1,along=s*tip,join=s*seam,gate=s*cabin;
 const travel=along-join;
 const maxRetreat=Math.max(.027,along-Math.max(archEnd+.028,join+travel*.28)-.013);
 const isSquare=f.profile==='square',isV=f.profile==='v',aero=f.profile==='aero';
 const sweep=maxRetreat*mix(isSquare?.06:isV?.55:.18,isSquare?.51:1,f.sweep);
 const cornerMix=mix(.70,1,f.wrap);
 const planScale=Math.min(.115,maxRetreat*.38);
 const verticalScale=.085,transverseScale=.095;
 const seedTop=sideAt(tip,0,1)[1];
 const height=Math.max(.17,seedTop-floor);
 // Plan changes begin up on the hood/deck and quarter panels, not at the bumper seam.
 const gateBlend=z=>smooth(clamp((s*z-gate)/Math.max(.15,along-gate)));
 const smoother=t=>(t=clamp(t),t*t*t*(10+t*(-15+t*6)));
 const hoodDrop=end==='front'?Math.min(f.hoodNoseDrop??0,height*.12):0;
 // Shared hood and rollover datum. The center can fall away into the
 // grille while the top of each fender retains its headlamp shoulder.
 const leadingDrop=u=>hoodDrop*(1-(f.hoodNoseShoulder??.72)*smoother((Math.abs(2*u-1)-.32)/.68));
 const shoulder=x=>Math.exp(-((x-.78)**2)/.034);
 function plan(u){
  const a=2*u-1, b=Math.abs(a),x=Math.sin(b*Math.PI*.5);
  const square=(1-Math.sqrt(Math.max(0,1-x*x)))**mix(2.4,5.5,f.boxiness);
  const rounded=1-Math.sqrt(Math.max(0,1-x*x));
  const radius=.15-.12*mix(f.pointedness,isV?.93:.15,.4);
  const point=(Math.hypot(x,radius)-radius)/(Math.hypot(1,radius)-radius);
  const selected=isV?point:isSquare?square:aero?x**1.8:rounded;
  const profile=mix(selected,isV?x**1.45:rounded,f.roundness*(isSquare?.20:isV?.22:.65));
  const shape=mix(profile,point,f.pointedness*(isV?.46:.72));
  const centerBias=(1-f.center)*Math.min(.085,maxRetreat*.49)*(1-x*x);
  const edited=guide(f.curves.plan,b)*planScale;
  const dx=clamp(sweep*shape+centerBias-edited,0,maxRetreat);
  return {a,b,x:Math.sign(a)*mix(b,x,cornerMix),dx};
 }
 function adjustDeck(raw,z,u){
  const {x,b,dx}=plan(u),blend=gateBlend(z);
  const y=.088*f.shoulder*shoulder(Math.abs(x))-.082*f.drop*(1-b*b)
   +.027*(bumper.shape-.5)*hump(b)+guide(f.curves.transverse,(x+1)*.5)*transverseScale*.36;
  const w=1-(.027+.11*f.taper)*blend;
  return [raw[0]*w,raw[1]+blend*y-leadingDrop(u)*smoother((s*z-(join-.54))/.54)*.65,raw[2]-s*blend*dx*.30];
 }
 const stockDeck=(z,u)=>adjustDeck(deckAt(z,u),z,u);
 function upperPanel(z,u){
  const p=stockDeck(z,u);
  if(end!=='front'||hoodFairing<=0||z<=cabin||z>=seam)return p;
  // The stock crown, shoulder and leading-edge drop have independent fades.
  // Fair the middle rails into one log-shaped nose sweep, retaining both
  // existing seam heights and leaving the outer fender rails alone.
  const t=(z-cabin)/(seam-cabin),k=2.0;
  const progress=1-Math.log1p(k*(1-t))/Math.log1p(k);
  const blend=hoodFairing*(1-smoother((Math.abs(2*u-1)-.53)/.47));
  p[1]=mix(p[1],mix(stockDeck(cabin,u)[1],stockDeck(seam,u)[1],progress),blend);
  return p;
 }
 const vOffsetGuide=t=>guide(f.curves.vertical,t)*verticalScale;
 function rawFace(u,v){
  const {x,b,dx}=plan(u),edge=sideAt(tip,v,1),co=1-x*x;
  const sport=bumper.type==='rally'?1:bumper.type==='diffuser'?-.80:bumper.type==='smooth'?-.45:0;
  const rollOff=(.016+.092*f.rollover)*(1-v)**4;
  const lowerOff=(.018+.105*f.lowerRoll)*v**5;
  const chin=(f.chin+.20*sport)*.088*bumper.size*Math.exp(-((v-.77)**2)/.028);
  const centralRecess=f.recess*.095*bumper.depth*co*Math.exp(-((v-.46)**2)/.036);
  const rake=f.rake*.095*v;
  const bow=(.013+.052*f.verticalRoundness)*Math.sin(Math.PI*v);
  const crease=f.crease*.021*(1-.4*f.boxiness)*Math.exp(-((v-.63)**2)/.003);
  const excess=rollOff+lowerOff+rake+centralRecess-bow-chin-crease;
  // Roundoffs fade into the wheel-clearance rail at the outer corners.
  const z=along-dx-clamp(excess*(.12+.88*co),-.027,Math.max(.035,maxRetreat-dx+.056));
  const drop=height*(.06+.47*f.drop);
  const track=1-(.022+.15*f.taper)*(.82+.18*v)-.055*f.lowerRoll*v**3;
  const cross=guide(f.curves.transverse,(x+1)*.5)*transverseScale;
  const form=shoulder(b)*(.013+.085*f.shoulder)+.034*co*(1-f.boxiness);
  const y=edge[1]-drop*(1-v)+(f.upperFasciaLift??0)*(1-v)**1.65*(.63+.37*Math.sin(Math.PI*u))+form*(1-v)**1.8 +vOffsetGuide(v)*(.28+.72*co)*(1-v)*.65+cross*(.76+.24*hump(v))*(1-v);
  const lip=(f.valanceRise??0)*smooth(clamp((v-.67)/.33))*(1-smooth(clamp((Math.abs(x)-(.16+.58*(f.valanceWidth??.5)))/.24)));
  const beltV=(f.bumperBeltHeight??.44)-(f.bumperBeltSweep??0)*Math.abs(x)**1.8;
  const q=(v-beltV)/.050;
  const stamp=(f.bumperBeltRise??0)*(Math.exp(-q*q)-.42*Math.exp(-((q+.91)**2)))*(1-.33*Math.abs(x)**8);
  const tucked=(f.terminalTuck??0)*smooth(clamp((v-.13)/.73))*(.66+.34*co);
  const corner=(f.cornerTuck??0)*Math.abs(x)**1.75*smooth(clamp((v-.16)/.75));
  const sweepAmount=f.upperEndSweep?Math.min(f.upperEndSweep,Math.max(0,z-s*upperPanel(seam,u)[2]-.054)):0;
  const noseRake=sweepAmount*(1-smooth(clamp(v/.67)))*(.83+.17*co);
  const past=z+stamp-tucked-corner-noseRake;
  const knee=(f.bumperMidReach??0)*Math.exp(-(((v-.49)/.175)**2))*(.36+.64*Math.abs(x)**1.8);
  return [x*edge[0]*track*(1+(f.outerFasciaWidth??0))-Math.sign(x)*corner*.72,y+lip-leadingDrop(u)*(1-smoother(v/.33)),s*(past+Math.min(knee,Math.max(0,along-past)))];
 }
 // The rear stamping and bumper are separate surfaces with their own
 // crown. A smooth corridor preserves the existing lamp/quarter shape
 // and side perimeter; the same evaluator drives the backing and trims.
 const active=f.deckSurfaceBlend||f.bumperFaceBlend;
 const lampRoll=end==='rear'?(f.lampShoulderRoll??0):0;
 const topRails=active?[rawFace(.5,.065),rawFace(.5,.485)]:null;
 const lowerRails=active?[rawFace(.5,.49),rawFace(.5,.86)]:null;
 const blendZ=(rails,v,a,b)=>mix(rails[0][2],rails[1][2],clamp((v-a)/(b-a),-.18,1.18));
 function face(u,v){
  const p=rawFace(u,v);
  if((!active&&!lampRoll)||end!=='rear')return p;
  const q=Math.abs(2*u-1);
  const cross=1-smoother((q-.37)/.43);
  const upperBand=smoother(v/.063)*(1-smoother((v-.47)/.102));
  const lowerBand=smoother((v-.475)/.095)*(1-smoother((v-.83)/.143));
  const edge=q*q*.88;
  let z=p[2];
  if(active){
   z=mix(z,blendZ(topRails,v,.065,.485)-s*f.deckSurfaceCrown*edge,cross*upperBand*f.deckSurfaceBlend);
   z=mix(z,blendZ(lowerRails,v,.49,.86)-s*f.bumperFaceCrown*edge,cross*lowerBand*f.bumperFaceBlend);
  }
  // Rolling the corner on the untrimmed skin also moves the aperture,
  // its gasket, inner optics and the quarter-panel terminal rail.
  const lip=smoother((q-.59)/.41)*smoother(v/.16)*(1-smoother((v-.41)/.31))*lampRoll;
  return [p[0]-Math.sign(u-.5)*lip*.48,p[1],z-s*lip];
 }
 function bridge(u,r){
  const start=upperPanel(seam,u),lead=face(u,0);
  const p0=upperPanel(seam-s*.010,u),z=lead[2]-start[2];
  const roll=1.10+.92*f.rollover+(upper?.curvature??0)*.17;
  const t=smooth(r);
  const slope=clamp((start[1]-p0[1])/.010,-.75,.75);
  const pitch=mix(slope*.70,slope*(1.10+.40*f.rollover),((upper?.tangent??.9)*(1-(upper?.crease??0))));
  const target=Math.min(0,(lead[1]-start[1])*1.58);
  // Cubic Hermite y with an entering hood/deck tangent and a vertical tangent at the roll.
  const y=(2*r**3-3*r*r+1)*start[1]+(r**3-2*r*r+r)*pitch*Math.abs(z)
    +(-2*r**3+3*r*r)*lead[1]+(r**3-r*r)*target;
  return [mix(start[0],lead[0],t),y,start[2]+z*(1-(1-r)**roll)];
 }
 function quarter(z,v,sign,raw){
  const u=sign>0?1:0,roof=upperPanel(z,u),b=gateBlend(z),r=smooth(v);
  const upperOld=sideAt(z,0,sign);
  const flank=(f.quarterWaist??0)*b*smooth(clamp((v-.46)/.54));
  const roll=(f.quarterBlend??0)*b*.025*Math.sin(Math.PI*v)**2;
  return [mix(roof[0],raw[0]*(1-(.022+.15*f.taper)*b*.43)-sign*flank,r)+sign*roll,
   raw[1]+(roof[1]-upperOld[1])*(1-r),mix(roof[2],raw[2],smooth(clamp(v/.34)))];
 }
 function bumperSide(t,v,sign){
  const u=sign>0?1:0, edge=face(u,v), up=bridge(u,t);
  const w=mix(smooth(v),v**.74,f.quarterBlend??0);
  if(t>=1)return edge;
  const z=mix(seam,tip,t), seed=quarter(z,v,sign,sideAt(z,v,sign));
  const last=quarter(tip,v,sign,sideAt(tip,v,sign));
  // Retain the trimmed wheel envelope; redirect the lower skin only as it
  // approaches the terminal rail. This avoids closing short front wheel arches.
  const raw=seed.map((x,i)=>x+(edge[i]-last[i])*smooth(t));
  return [mix(up[0],raw[0],w),mix(up[1],raw[1],w),mix(up[2],raw[2],w)];
 }
 const times=[.12,.34,.66,.88];
 const guides={
  plan:{points:times.map(t=>face(.5+t*.5,.11)),axis:2,scale:s*planScale},
  vertical:{points:times.map(t=>face(.50,t)),axis:1,scale:verticalScale*.65},
  transverse:{points:times.map(t=>face(t,.18)),axis:1,scale:transverseScale*.82}
 };
 return {face,bridge,upperPanel,quarter,bumperSide,guides,sweep,maxRetreat};
}

// Tessellate with exact trim rings. Refinement only splits internal edges;
// mounting walls and adjacent panels keep precisely the same boundary vertices.
export function fasciaMesh(surface,openings,{rear=false,across=34,down=14,tolerance=.103,columns=null}={}){
 const xs=columns??Array.from({length:across+1},(_,i)=>i/across);across=xs.length-1;
 const outline=[];
 for(let i=0;i<=across;i++)outline.push([xs[i],0]);
 for(let i=1;i<=down;i++)outline.push([1,i/down]);
 for(let i=1;i<=across;i++)outline.push([xs[across-i],1]);
 for(let i=1;i<down;i++)outline.push([0,1-i/down]);
 const rings=[outline,...openings.map(x=>x.outline)],points=rings.flat();
 const key=(a,b)=>a<b?a+':'+b:b+':'+a;
 const fixed=new Set(),members=[],ranges=[];
 let n=0;
 for(const ring of rings){
  const group=ranges.length;ranges.push([n,ring.length]);
  for(let i=0;i<ring.length;i++){fixed.add(key(n+i,n+(i+1)%ring.length));members.push(group);}
  n+=ring.length;
 }
 const vectors=ring=>ring.map(([u,v])=>new T.Vector2(u,v));
 const rawFaces=T.ShapeUtils.triangulateShape(vectors(outline),openings.map(x=>vectors(x.outline)));
 // Earcut may elide collinear UV samples while joining holes. Preserve those
 // vertices: collinear in UV is not necessarily collinear on the body.
 function skipped(a,b){
  const group=members[a];
  if(group!==members[b]||fixed.has(key(a,b)))return [];
  const [base,count]=ranges[group],A=points[a],B=points[b],du=B[0]-A[0],dv=B[1]-A[1],len=du*du+dv*dv;
  for(const direction of [1,-1]){
   const walk=[];
   for(let i=a+direction;;i+=direction){
    const j=base+((i-base)%count+count)%count;
    if(j===b)return walk;
    const U=points[j][0]-A[0],V=points[j][1]-A[1],t=(U*du+V*dv)/len;
    if(Math.abs(U*dv-V*du)>1e-11||t<=0||t>=1)break;
    walk.push(j);
   }
  }
  return [];
 }
 const det=(a,b,c)=>(points[b][0]-points[a][0])*(points[c][1]-points[a][1])-(points[b][1]-points[a][1])*(points[c][0]-points[a][0]);
 let faces=rawFaces.filter(([a,b,c])=>Math.abs(det(a,b,c))>1e-12);
 for(let pass=0;pass<3;pass++){
  const uses=new Map(),expanded=[];
  for(const [a,b,c] of faces)for(const k of [key(a,b),key(b,c),key(c,a)])uses.set(k,(uses.get(k)??0)+1);
  for(const tri of faces){
   let split=false;
   for(let k=0;k<3;k++){
    const a=tri[k],b=tri[(k+1)%3],c=tri[(k+2)%3];
    if(uses.get(key(a,b))!==1)continue;
    const extra=skipped(a,b);
    if(!extra.length||extra.includes(c))continue;
    const edge=[a,...extra,b];
    for(let i=1;i<edge.length;i++)expanded.push([edge[i-1],edge[i],c]);
    split=true;break;
   }
   if(!split)expanded.push(tri);
  }
  faces=expanded;
 }
 const push=(o,a,b,c)=>o.push([a,b,c]);
 for(let i=0;i<4;i++){
  const changed=new Map(),out=[];
  function mid(a,b){
   const k=key(a,b),p=points[a],q=points[b];
   if(fixed.has(k)||Math.hypot((p[0]-q[0])*1.35,(p[1]-q[1])*.80)<tolerance)return -1;
   if(!changed.has(k)){changed.set(k,points.length);points.push([(p[0]+q[0])/2,(p[1]+q[1])/2]);}
   return changed.get(k);
  }
  for(const [a,b,c] of faces){
   const m=mid(a,b),n=mid(b,c),k=mid(c,a),mode=(m>=0?1:0)|(n>=0?2:0)|(k>=0?4:0);
   switch(mode){
    case 1:push(out,a,m,c);push(out,m,b,c);break;
    case 2:push(out,a,b,n);push(out,a,n,c);break;
    case 4:push(out,a,b,k);push(out,b,c,k);break;
    case 3:push(out,a,m,c);push(out,m,n,c);push(out,m,b,n);break;
    case 5:push(out,a,m,k);push(out,k,m,c);push(out,m,b,c);break;
    case 6:push(out,a,b,n);push(out,a,n,k);push(out,k,n,c);break;
    case 7:push(out,a,m,k);push(out,m,b,n);push(out,k,n,c);push(out,m,n,k);break;
    default:push(out,a,b,c);
   }
  }
  faces=out;
  if(!changed.size)break;
 }
 const uv=points.flat(),pos=points.flatMap(p=>surface(...p)),norm=[];
 for(const [u,v] of points){
  const dp=(a,b,c,d)=>new T.Vector3(...surface(a,b)).sub(new T.Vector3(...surface(c,d)));
  const du=dp(clamp(u+.0001),v,clamp(u-.0001),v),dv=dp(u,clamp(v+.0001),u,clamp(v-.0001));
  const n=dv.cross(du).normalize().multiplyScalar(rear?-1:1);
  norm.push(n.x,n.y,n.z);
 }
 let meshArea=0;
 const edgeUses=new Map();

 const indices=faces.flatMap(([a,b,c])=>{
  const area=det(a,b,c);meshArea+=Math.abs(area)*.5;
  if(Math.abs(area)<1e-13)return [];
  for(const k of [key(a,b),key(b,c),key(c,a)])edgeUses.set(k,(edgeUses.get(k)??0)+1);
  return (area>0)!==rear?[a,c,b]:[a,b,c];
 });
 const polygonArea=vs=>Math.abs(vs.reduce((sum,p,i)=>{const q=vs[(i+1)%vs.length];return sum+p[0]*q[1]-p[1]*q[0];},0))*.5;
 const holeArea=openings.reduce((sum,x)=>sum+polygonArea(x.outline),0);
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setIndex(indices);
 geo.userData.trimArea={mesh:meshArea,holes:holeArea,expected:1-holeArea,unmatched:[...fixed].filter(k=>edgeUses.get(k)!==1).length};
 return geo;
}
