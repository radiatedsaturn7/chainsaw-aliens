import * as T from '../../vendorBridge/three.js';
import {createEndSurface,fasciaMesh} from './fascia.mjs';
import {makeOpenings,emitOpenings} from './optics.mjs';
import {createMasterSide,buildPanelGap} from './seams.mjs';
import {normalizeVehicle,SEAM_KEYS,evaluateInteriorPatch,math} from './genome.mjs';
const {mix,clamp,buildFender}=math;
const RAD=Math.PI/180;
const UP_PATCH=(g,k,z,u,z0,z1)=>evaluateInteriorPatch(g.surfaces[k].points,clamp((z-z0)/(z1-z0)),clamp(u));
const bell=(x)=>Math.sin(Math.PI*clamp(x));
const lerp3=(a,b,t)=>a.map((e,i)=>mix(e,b[i],t));
const cloneJSON=x=>structuredClone(x);
const curvePoints=(fn,n=26)=>Array.from({length:n+1},(_,i)=>fn(i/n));
function adaptiveStations(fn,{lod=false}={}){
 const out=[0],error=lod?.0045:.0013;
 function span(a,b,depth){
  const m=(a+b)/2;
  const dist=Math.max(...[0,.35,.59,.82,1].map(v=>{
   const A=fn(a,v),B=fn(b,v),M=fn(m,v);
   return Math.hypot(...M.map((x,k)=>x-(A[k]+B[k])*.5));
  }));
  if(depth<3||(depth<(lod?6:7)&&dist>error)){span(a,m,depth+1);span(m,b,depth+1);}
  else out.push(b);
 }
 span(0,1,0);return out;
}
function guideFeature(id,type,label,component,points,props={}){
 const {view='side',axis=1,scale=.12,anchor=points[Math.floor(points.length/2)],...rest}=props;
 return {id,type,label,component,points,handle:{view,axis,anchor,scale},...rest};
}
function patch(n,m,fn,flip=false){
 const pos=[],uv=[],tri=[];
 for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){pos.push(...fn(i/n,j/m));uv.push(i/n,j/m);}
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){
  const a=i*(m+1)+j,b=a+m+1;if(flip)tri.push(a,b+1,b,a,a+1,b+1);else tri.push(a,b,b+1,a,b+1,a+1);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(tri);g.computeVertexNormals();return g;
}
function lathe(profile,segments=40){
 // Profile is [radius, lateral position]. Local X follows the engine axle.
 return new T.LatheGeometry(profile.map(([r,x])=>new T.Vector2(r,-x)),segments).rotateZ(Math.PI/2);
}
function box(w,h,l){return new T.BoxGeometry(w,h,l);}
function ellipsoid(w,h,l){return new T.SphereGeometry(1,16,10).scale(w/2,h/2,l/2);}
function ovalCylinder(w,h,l){
 return new T.CylinderGeometry(1,1,l,24).rotateX(Math.PI/2).scale(w/2,h/2,1);
}
function geometryBounds(geo){geo.computeBoundingBox();return geo.boundingBox;}
function addModelPart(out,component,material,geo,p=null,rotation=null){
 if(rotation){const [x,y,z]=rotation;geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(x,y,z)));}
 if(p)geo.translate(...p);
 out.push({component,material,geometry:geo});return geo;
}
export const disposeDesign=design=>{for(const p of [...design.parts,...design.wheelParts])p.geometry.dispose();};
function tireGeo(r,w,shape,type,depth){
 const camber=mix(.055,.15,shape),c=w/2,t=type==='rally'?.011:.004,i=r*(.73-.06*(depth-1));
 return lathe([[i,-c*.79],[r*.84,-c],[r*(1-camber*.34),-c],[r-t,-c*.83],
 [r,-c*.53],[r,c*.53],[r-t,c*.83],[r*(1-camber*.34),c],[r*.84,c],[i,c*.79],[i,-c*.79]]);
}
function wheelParts(g){
 const {diameter,tireWidth,rimRatio}=g.dimensions,r=diameter/2,w=tireWidth,c=g.components.wheels,t=g.components.tires;
 const out=[],put=(k,m,x,p=null,r=null)=>addModelPart(out,k,m,x,p,r);
 put('tires','rubber',tireGeo(r,w,t.shape,t.type,t.depth));
 const rim=r*rimRatio*c.size,face=w*.47,lip=rim*.057,dish=.018+c.shape*.073;
 put('wheels','wheel',lathe([[rim*.83,-w*.47],[rim*.92,-w*.49],[rim,-w*.45],[rim,face],[rim-lip*.32,face+.006],[rim-lip,face+.005],[rim-lip*1.43,face-.014],[rim-lip*1.4,-w*.41],[rim*.83,-w*.47]]));
 const n=c.type==='6-spoke'?6:c.type==='5-spoke'?5:14;
 const disk=Math.max(.07,rim*.71);put('wheels','chrome',lathe([[0,-.038],[disk,-.038],[disk,.018],[0,.018]],40));
 put('wheels','trim',box(w*.27,disk*.55,disk*.35),[w*.06,disk*.68,disk*.31]);
 put('wheels','wheel',lathe([[0,face-dish-.012],[rim*.28,face-dish-.012],[rim*.27,face-dish+.013],[rim*.20,face-dish+.022],[0,face-dish+.022]],32));
 for(let k=0;k<n;k++){
  const a=k*Math.PI*2/n;
  const spoke=(s,t,inside)=>{const radius=mix(rim*.19,rim*.974,s),width=rim*mix(.095,.038,s)*(n>7?.75:1)*c.depth;
   const x=mix(face-dish,face-.007,s*s)+.006*bell(t)-(inside?.014:0),angle=a+(t-.5)*width/radius;
   return [x,Math.cos(angle)*radius,Math.sin(angle)*radius];};
  put('wheels','wheel',patch(7,4,(s,t)=>spoke(s,t,false)));
  put('wheels','wheel',patch(7,1,(s,t)=>lerp3(spoke(s,0,false),spoke(s,0,true),t)));
  put('wheels','wheel',patch(7,1,(s,t)=>lerp3(spoke(s,1,true),spoke(s,1,false),t)));
 }
 for(let k=0;k<5;k++){const a=k*Math.PI*2/5;put('wheels','chrome',new T.CylinderGeometry(.011,.012,.018,6).rotateZ(-Math.PI/2),
  [face-dish+.014,Math.cos(a)*rim*.15,Math.sin(a)*rim*.15]);}
 return out;
}
export function generateVehicle(input,{quality='preview'}={}){
 const g=normalizeVehicle(input),d=g.dimensions,c=g.components,G=g.constraints.gap*.5;
 const parts=[],issues=[],warnings=[], joins=[],features=[],seamChecks=[];
 const X=d.width/2,R=d.diameter/2,L=d.wheelbase/2,Lf=L+d.front,Lr=-L-d.rear,length=Lf-Lr;
 const floor=d.stance, B=d.height*d.belt,radius=R+g.constraints.archClearance;
 let t=(X*d.track),clearance=X-t-d.tireWidth/2;
 if(clearance<.011){t=X-d.tireWidth/2-.011;warnings.push('Track narrowed to keep tires inside the arch lips.');}
 if(t*2<1.2){issues.push('Track below the runtime suspension envelope.');}
 
 if(floor>R-.03)warnings.push('Rocker sits above the hub; this is an elevated stance.');
 const wide=clamp(d.box),zC=(Lf+Lr)*.5+length*d.cabin;
 let cabinFront=zC+length*(d.cabinLength/2-d.hood),cabinRear=zC-length*(d.cabinLength/2-d.trunk);
 cabinFront=clamp(cabinFront,Lr+.9,Lf-.53);cabinRear=clamp(cabinRear,Lr+.50,cabinFront-1.52);
 const doorFront=clamp(cabinFront+.12,-.15,L-.26),doorRear=clamp(cabinRear-.17,-L+.23,doorFront-.65);
 const bumperFront=Lf-Math.min(d.front*.49,.43),bumperRear=Lr+Math.min(d.rear*.49,.43);
 const doorSplits=c.doors.type==='four door'?[doorRear,mix(doorRear,doorFront,.47),doorFront]:[doorRear,doorFront];
 const handleStations=doorSplits.slice(1).map((z,i)=>mix(doorSplits[i],z,.26));
 const roofFront=mix(cabinFront,doorRear,.37+.10*c.glass.shape),roofRear=mix(cabinRear,doorFront,
  g.family==='fastback'?.45:.22+.10*c.glass.shape);
 const nose=B-(.14+.10*(1-wide))*c.frontBumper.depth,deck=B-(c.trunk.type==='fastback'?.13:.065)*c.rearBumper.depth;
 const skinY=z=>z>cabinFront?mix(B,nose,((z-cabinFront)/(Lf-cabinFront))**1.4):z<cabinRear?mix(B,deck,((cabinRear-z)/(cabinRear-Lr))**1.38):B;
 const regionalBox=z=>clamp(wide+(z>0?d.frontBox:d.rearBox)*clamp(Math.abs(z)/L));
 function skinX(z){const noseT=clamp((Math.abs(z-(Lf+Lr)*.5)/(.5*length)-.70)/.30);return X*(1-(.058+.13*(1-regionalBox(z)))*noseT**2);}
 const lipHeight=z=>{
  const p=z>0?c.frontFenders:c.rearFenders,dist=Math.min(Math.abs(z-L),Math.abs(z+L));
  const r=radius+.025*(p.size-1);if(dist>=r)return floor;
  const s=dist/r,a=clamp((1-s)/.065),curved=R+r*Math.sqrt(Math.max(0,1-s*s));
  return mix(floor,curved,a*a*(3-2*a));
 };
 for(const [component,axle] of [['frontFenders',L],['rearFenders',-L]]){
  const r=radius+.025*(c[component].size-1);
  for(const trial of [-.55,-.30,0,.30,.55]){
   const z=axle+r*trial,needed=R+Math.sqrt(Math.max(0,r*r-(z-axle)**2));
   if(skinY(z)-needed<.025){issues.push('Beltline intersects the '+(axle>0?'front':'rear')+' wheel opening; raise the beltline or fit smaller tires.');break;}
  }
 }
 const surface=buildFender(g.surfaces.frontFenders,{uSteps:quality==='export'?36:23,vSteps:quality==='export'?20:13,lipSteps:4});
 if(!surface.diagnostics.valid)issues.push(...surface.diagnostics.issues.map(s=>'Front fender: '+s));
 const frontPanelSamples=Array.from({length:21},(_,i)=>Array.from({length:11},(_,j)=>surface.eval(i/20,j/10)));
 const panelSample=(u,v)=>{const a=clamp(u)*20,b=clamp(v)*10,i=Math.min(19,Math.floor(a)),j=Math.min(9,Math.floor(b));return lerp3(lerp3(frontPanelSamples[i][j],frontPanelSamples[i+1][j],a-i),lerp3(frontPanelSamples[i][j+1],frontPanelSamples[i+1][j+1],a-i),b-j);};
 function skinPoint(z,v,sgn,comp){
  const side=skinX(z), localBox=regionalBox(z), bottom=Math.min(skinY(z)-.022,lipHeight(z)),archAt=z>0?L:-L,
      flare=clamp(1-Math.abs(z-archAt)/(radius+.25))**1.65;
  const lower=floor-.013;
  const p=c[comp],center=comp==='doors'?-.5:0;
  const shape=comp==='doors'?p.shape*(.46+.54*wide):p.shape;
  const profile=comp==='frontFenders'||comp==='rearFenders'?
   (p.type==='boxed'?.055:p.type==='integrated'||p.type==='wide'?.072:.045)*p.depth*flare*Math.sin(v*Math.PI*.75):0;
  let x=side- .023*v-(.012+.035*(1-localBox))*v**3+profile+(.008+.027*shape)*Math.sin(v*Math.PI*1.5);
  const edgePull=clamp((v-.72)/.28)*clamp((flare-.18)/.65);
  x=mix(x,Math.max(x,t+d.tireWidth/2+.018),edgePull);
  let y=mix(skinY(z),bottom,v);
  if(comp==='frontFenders'){
   const u=clamp((z-doorFront)/(bumperFront-doorFront)),q=panelSample(u,v),edge=lerp3(panelSample(u,0),panelSample(u,1),v);
   const influence=Math.sin(Math.PI*u)*Math.sin(Math.PI*v)**.64;
   x+=(q[0]-edge[0])*influence*p.size;
   const sp=g.surfaces.frontFenders.parameters;
   y+=((q[1]-edge[1])*.30+sp.height*.3+sp.hoodBoundary*.35)*influence;
   z+=(q[2]-edge[2])*.72*influence;
   if(v>.68){
    const t=(v-.68)/.32;
    x+=sp.lipRadius*.7*influence*t;
   }
  }
  const creaseWidth=.028+.06*(1-g.body.creaseStrength);
  const crease=(z>doorRear-.38&&z<doorFront+.42)?Math.min(1,(z-doorRear+.38)/.18,(doorFront+.42-z)/.20):0;
  x+=(.003+.014*g.body.creaseStrength)*crease*Math.exp(-((v-g.body.creaseHeight)**2)/(creaseWidth**2));
  x+=(.004+.018*g.body.archCrown)*flare*Math.sin(Math.PI*v)**2;
  if(comp==='doors'){
   for(const hz of handleStations)x-=(.002+.013*g.body.handleRecess)*Math.exp(-((v-.22)**2)/.0034-((z-hz)**2)/.008);
  }
  if(bottom<=lower+.007)y=Math.max(y,lower+.007);
  return [sgn*x,y,z];
 }
 const put=(k,m,x,p=null,r=null)=>addModelPart(parts,k,m,x,p,r);
 // Roof/door/fender share station curves. Each component evaluates the same
 // seam datum; inset bands produce gaps without independent panel drift.
 function top(z,u,crown,comp){
  const a=2*u-1,w=skinX(z),co=(1-Math.abs(a)**(wide>.65?3.3:2.5));
  return [w*a,skinY(z)+co*crown+(comp==='hood'&&c.hood.type==='power bulge'?Math.exp(-a*a*15)*.038*bell((z-cabinFront)/(Lf-cabinFront)):0),z];
 }
 const sheet=(name,material,z0,z1,fn,n=14,m=10)=>put(name,material,patch(n,m,(u,v)=>fn(mix(z0,z1,u),v)));
 const hoodC=(.027+.059*c.hood.shape)*(c.hood.type==='flat'?.29:c.hood.type==='power bulge'?1.32:1)*c.hood.depth;
 const originalHood=(z,v)=>{const p=top(z,v,mix(hoodC,.019*c.frontBumper.size,clamp((z-(bumperFront-.28))/.28)**2),'hood');
  p[1]+=UP_PATCH(g,'hood',z,v,cabinFront,bumperFront);return p;};
 const trunkC=(c.trunk.type==='fastback'?.034:c.trunk.type==='ducktail'?.064:.047)*(.68+c.trunk.shape)*c.trunk.depth;
 const originalTrunk=(z,v)=>{const p=top(z,v,mix(trunkC,.019*c.rearBumper.size,clamp((bumperRear+.28-z)/.28)**2),'trunk');
  p[1]+=UP_PATCH(g,'trunk',z,v,bumperRear,cabinRear);return p;};
 const ends={},fascia={},lampMounts={};
 const lod=quality==='lod';
 const across=quality==='export'?42:lod?22:32,down=quality==='export'?16:lod?9:13,along=quality==='export'?17:lod?8:12;
 const hoodPoint=(z,u)=>ends.front.upperPanel(z,u);
 const trunkPoint=(z,u)=>ends.rear.upperPanel(z,u);
 for(const end of ['front','rear']){
  const front=end==='front',sign=front?1:-1,name=front?'frontBumper':'rearBumper',
   fender=front?'frontFenders':'rearFenders',tip=(front?Lf:Lr)-sign*G,upper=g.seams[front?'hoodSeam':'trunkSeam'],
   seam=(front?bumperFront:bumperRear)+upper.offset;
  const surf=createEndSurface({settings:g.fascia[end],end,tip,seam,cabin:front?cabinFront:cabinRear,
   archEnd:L+radius+.025*(c[fender].size-1),floor,deckAt:front?originalHood:originalTrunk,
   sideAt:(z,v,s)=>skinPoint(z,v,s,name),bumper:c[name],upper});
  ends[end]=surf;
  const openings=makeOpenings({end,g,segments:lod?18:quality==='export'?32:24});
  const shell=put(name,'paint',fasciaMesh(surf.face,openings,{rear:!front,across,down,tolerance:lod?.155:quality==='export'?.092:.115}));
  for(const opening of openings){
   const right=opening.center[0]>.5,p=opening.outline.map(uv=>surf.face(...uv)),letter=right?'R':'L';
   const id=opening.kind==='lamp'?end+'-lamp-'+letter:opening.id;
   const xSide=right?1:-1;
   features.push(guideFeature(id,opening.kind==='lamp'?'lamp':'opening',opening.kind==='lamp'?(front?'Headlight outline':'Taillight outline')+' · '+letter:opening.component==='grille'?'Grille perimeter':opening.kind==='fog'?'Fog-light perimeter':'Intake / valance perimeter',opening.component,p,
    {end,side:letter,closed:true,view:end,axis:0,scale:.18*xSide,anchor:p.reduce((a,b)=>xSide*b[0]>xSide*a[0]?b:a)}));
  }
  features.push(guideFeature(end+'-silhouette','silhouette',front?'Nose silhouette':'Tail silhouette',name,curvePoints(u=>surf.face(u,.13)),{end,view:'top',axis:2,scale:sign*.28}));
  const mounted=emitOpenings({end,openings,surface:surf.face,put,lod});
  Object.assign(lampMounts,mounted.mounts);
  issues.push(...(mounted.issues??[]));
  fascia[end]={guides:surf.guides,trimArea:shell.userData.trimArea,
   samples:[0,.15,.30,.45,.5,.55,.70,.85,1].map(u=>surf.face(u,.13)),
   openings:openings.map(({id,component,outline})=>({id,component,outline:cloneJSON(outline)}))};
  const lamp=openings.find(x=>x.kind==='lamp'&&x.center[0]>.5);
  if(lamp){const ring=lamp.outline;fascia[end].guides.outline={points:Array.from({length:8},(_,i)=>surf.face(...ring[Math.floor(i*ring.length/8)])),axis:1,scale:.05};}
  if(Math.abs(shell.userData.trimArea.mesh-shell.userData.trimArea.expected)>1e-6||shell.userData.trimArea.unmatched)issues.push('Overlapping or invalid '+end+' cutouts.');
  const roll=put(name,'paint',patch(along,across,(t,u)=>{
   const q=surf.bridge(u,t);
   q[2]+=sign*upper.gap*.5*(1-t)**3;q[1]+=upper.flush*.5*(1-t)**3;return q;
  },!front));
  surf.geometries={shell,roll};
 }
 const hoodEdge=bumperFront+g.seams.hoodSeam.offset-g.seams.hoodSeam.gap*.5,
  trunkEdge=bumperRear+g.seams.trunkSeam.offset+g.seams.trunkSeam.gap*.5;
 const coverPoint=(raw,edge,settings,z,u)=>{
  const p=raw(z,u);p[1]-=settings.flush*.5*clamp(1-Math.abs(edge-z)/.07)**3;return p;
 };
 sheet('hood','paint',cabinFront+G,hoodEdge,(z,u)=>coverPoint(hoodPoint,hoodEdge,g.seams.hoodSeam,z,u),lod?8:14,across);
 sheet('trunk','paint',trunkEdge,cabinRear-G,(z,u)=>coverPoint(trunkPoint,trunkEdge,g.seams.trunkSeam,z,u),lod?8:14,across);
 for(const end of ['front','rear']){
  const front=end==='front',name=front?'hood':'trunk',k=front?'hoodSeam':'trunkSeam';
  const raw=front?hoodPoint:trunkPoint,settings=g.seams[k],sign=front?1:-1;
  const z=front?hoodEdge:trunkEdge;
  const edgeA=u=>coverPoint(raw,z,settings,z,u),edgeB=u=>{
   const p=ends[end].bridge(u,0);p[2]+=sign*settings.gap*.5;p[1]+=settings.flush*.5;return p;
  };
  const seam=buildPanelGap({edgeA,edgeB,settings,stations:across});
  for(const piece of seam.parts)put(name,piece.material,piece.geometry);
  const metrics={...seam.metrics,targetPoints:seam.points.map((_,i)=>edgeB(i/across)),positionMm:Math.abs(settings.flush*1000)};
  features.push(guideFeature(k,'seam',SEAM_KEYS[k],name,seam.points,{key:k,end,view:'top',axis:2,scale:1,metrics}));
  seamChecks.push({id:k,...seam.metrics});
 }
 function weldNormals(...entries){
  const get=(a,i)=>new T.Vector3().fromBufferAttribute(a,i);
  const [g0,i0]=entries[0],p=get(g0.attributes.position,i0);
  const n=new T.Vector3();
  for(const [g,i] of entries){if(p.distanceToSquared(get(g.attributes.position,i))>1e-8)return;n.add(get(g.attributes.normal,i));}
  n.normalize();for(const [g,i] of entries)g.attributes.normal.setXYZ(i,n.x,n.y,n.z);
 }
 for(const end of ['front','rear']){
  const {shell,roll}=ends[end].geometries;
  for(let i=0;i<=across;i++)weldNormals([shell,i],[roll,along*(across+1)+i]);
 }
 // All side panels use the same trimmed wheel envelope; arch edge samples
 // and hem are generated from the same function as the adjacent skin.
 for(const s of [-1,1]){
  const letter=s>0?'R':'L';
  const slabs=[
   {key:'rearBumper',start:Lr,end:bumperRear,seamAfter:'rearFenderSeam'},
   {key:'rearFenders',start:bumperRear,end:doorRear,seamAfter:'rearDoorSeam'},
   ...doorSplits.slice(1).map((z,i)=>({key:'doors',start:doorSplits[i],end:z,seamAfter:i<doorSplits.length-2?'centerDoorSeam':'frontDoorSeam'})),
   {key:'frontFenders',start:doorFront,end:bumperFront,seamAfter:'frontFenderSeam'},
   {key:'frontBumper',start:bumperFront,end:Lf}
  ];
  for(const p of slabs)p.sample=(z,v)=>{
   const key=p.key,front=key.startsWith('front');
   if(key.endsWith('Bumper'))return ends[front?'front':'rear'].bumperSide(clamp((z-(front?p.start:p.end))/(front?p.end-p.start:p.start-p.end)),v,s);
   const raw=skinPoint(z,v,s,key);
   return key.endsWith('Fenders')?ends[front?'front':'rear'].quarter(z,v,s,raw):raw;
  };
  const master=createMasterSide({panels:slabs,settings:g.seams,gap:g.constraints.gap,side:s,stations:down});
  for(let index=0;index<slabs.length;index++){
   const {key,start:a,end:b}=slabs[index],sampler=(u,v)=>master.panel(index,u,v);
   if(key==='frontBumper'||key==='rearBumper'){
    const front=key==='frontBumper',surf=ends[front?'front':'rear'],col=s<0?0:across,{shell,roll}=surf.geometries;
    const side=put(key,'paint',patch(along,down,sampler,s<0));
    const tipIndex=front?along:0, at=i=>front?i:along-i;
    for(let i=0;i<=along;i++)weldNormals([roll,i*(across+1)+col],[side,at(i)*(down+1)]);
    for(let j=1;j<=down;j++){
     const row=s>0?across+j:2*across+2*down-j;
     weldNormals([shell,row],[side,tipIndex*(down+1)+j]);
    }
   }else{
    const stations=adaptiveStations(sampler,{lod});
    put(key,'paint',patch(stations.length-1,down,(u,v)=>sampler(stations[Math.round(u*(stations.length-1))],v),s<0));
   }
   joins.push({a,b,component:key,side:s});
  }
  for(const seam of master.seams){
   const k=seam.id,component=k.includes('Fender')?(k==='rearFenderSeam'?'rearFenders':'frontFenders'):'doors';
   for(const p of seam.parts)put(component,p.material,p.geometry);
   seamChecks.push({id:k+'-'+letter,...seam.metrics});
   const metrics={...seam.metrics,matchedPoints:seam.points.map((_,i)=>seam.edgeB(i/(seam.points.length-1)))};
   features.push(guideFeature(k+'-'+letter,'seam',SEAM_KEYS[k]+' · '+letter,component,seam.points,
    {key:k,side:letter,end:k.startsWith('rear')?'rear':'front',view:'side',axis:2,scale:1,metrics}));
  }
  features.push(guideFeature('door-crease-'+letter,'crease','Door character line · '+letter,'doors',
   curvePoints(u=>master.at(mix(doorRear+.12,doorFront-.12,u),g.body.creaseHeight)),
   {side:letter,view:'side',axis:1,scale:-.56}));
  for(const [comp,axle] of [['rearFenders',-L],['frontFenders',L]]){
   put(comp,'paint',patch(30,4,(u,v)=>{
    const z=axle-(radius+.025*(c[comp].size-1))*Math.cos(u*Math.PI),p=master.at(z,1),r=.0045+c[comp].shape*.004+g.body.archCrown*.004;
    return [p[0]-s*r*(1-Math.cos(v*2.1)),p[1]-r*Math.sin(v*2.1),p[2]];
   }));
   const arc=curvePoints(u=>master.at(axle-(radius+.025*(c[comp].size-1))*Math.cos(u*Math.PI),1));
   features.push(guideFeature(comp+'-arch-'+letter,'arch',(axle>0?'Front':'Rear')+' wheel arch · '+letter,comp,arc,{end:axle>0?'front':'rear',side:letter,view:'side',axis:1,scale:.12}));
   put(comp,'trim',patch(24,2,(u,v)=>{const z=axle-(radius+.025*(c[comp].size-1))*Math.cos(u*Math.PI),edge=master.at(z,1);return [mix(edge[0]-s*.013,s*(t-d.tireWidth*.56),v),edge[1]+v*.028,z];}));
  }
  const p=c.rockers;
  const sillHeight=(p.type==='blade'?.052:p.type==='deep'?.14:.089)*p.size*d.skirt;
  addModelPart(parts,'rockers',p.type==='blade'?'trim':'paint',patch(16,5,(u,v)=>{
   const z=mix(-L+radius+.011,L-radius-.011,u);
   return [master.at(z,.99)[0]+s*(.008*p.depth+.020*bell(v)*p.shape),floor-.019+sillHeight*v,z];
  }));
  const mirror=c.mirrors,sx=X*.87,sy=B+.105*mirror.depth,mz=cabinFront-.19+mirror.bias*.08;
  put('mirrors','trim',box(.19,.032,.055),[s*(sx+.085),sy-.026,mz]);
  put('mirrors','paint',ellipsoid(.25*mirror.size,.115*mirror.depth,.185*mirror.size*(mirror.type==='aero'?1.42:1)),[s*(sx+.19),sy,mz],[mirror.angle*RAD,s*(mirror.shape-.5)*.52,0]);
  put('mirrors','chrome',ellipsoid(.19*mirror.size,.087,.019),[s*(sx+.20),sy,mz-.081*mirror.size]);
  for(const z of handleStations){
   const hp=c.handles,q=master.at(z,.22);
   put('handles','seamDark',ellipsoid(.009,(.032+hp.shape*.025)*hp.size,.160*hp.size),[q[0]-s*.002,q[1],q[2]]);
   put('handles',hp.type==='flush'?'paint':'trim',ellipsoid(.008+.005*hp.depth,(.018+hp.shape*.014)*hp.size,.126*hp.size),[q[0]+s*.004,q[1]+.001,q[2]]);
  }
 }
 // Shared q(u,v) cabin envelope consumed by all glazing, pillars and roof.
 const roofW=Math.min(X*.91,X*d.cabinWidth*c.roof.size*.94),glassBaseW=X*d.cabinWidth*1.12,
  roofC=(.023+.068*d.crown)*(.60+c.roof.shape)*(c.roof.type==='flat'?.40:1)*c.roof.depth;
 const baseW=z=>Math.min(skinX(z)-.035,glassBaseW);
 const roofPoint=(z,u)=>{const k=2*u-1,edge=g.body.roofEdge;return [k*roofW*(1-.067*Math.abs(2*(z-roofRear)/Math.max(.15,roofFront-roofRear)-1)**2),d.height+UP_PATCH(g,'roof',z,u,roofRear,roofFront)-roofC*Math.abs(k)**(2.28-.68*edge)-.014*edge*Math.abs(k)**11-roofC*.45*Math.abs(2*(z-roofRear)/Math.max(.15,roofFront-roofRear)-1)**2,z];};
 const glassPoint=(sgn,t,u)=>{const edge=sgn>0?roofFront:roofRear,gate=sgn>0?cabinFront:cabinRear;
  const w=baseW(gate),x=(2*u-1)*w,k=(x/skinX(gate)+1)/2;
  const q=lerp3([x,(sgn>0?hoodPoint:trunkPoint)(gate,k)[1]+.004,gate],roofPoint(edge,u),t);
  q[2]+=sgn*.045*c.glass.depth*bell(t)*bell(u);return q;};
 sheet('roof','paint',roofRear,roofFront,roofPoint,17,12);
 for(const s of [-1,1]){
  put('glass',c.glass.type==='tinted'?'glass':'glass',patch(12,16,(v,u)=>glassPoint(s,v,u),s<0));
  const roofSide=s>0?1:0,letter=s>0?'R':'L', A=roofPoint(roofFront,roofSide),C=roofPoint(roofRear,roofSide);
  function side(u,v){
   const f=glassPoint(1,v,roofSide),r=glassPoint(-1,v,roofSide),a=lerp3(f,r,u),
    line=lerp3(A,C,u),actual=roofPoint(mix(roofFront,roofRear,u),roofSide);
   a[0]+=s*.015*bell(u)*bell(v)*c.glass.depth;
   return a.map((x,i)=>x+(actual[i]-line[i])*v*v);
  }
  const roofRail=curvePoints(u=>side(u,1));
  features.push(guideFeature('roof-'+letter,'roof','Roof edge · '+letter,'roof',roofRail,{key:'roofSeam',side:letter,view:'side',axis:1,scale:-.08}));
  features.push(guideFeature('glass-base-'+letter,'glass-edge','Lower glazing edge · '+letter,'glass',curvePoints(u=>side(u,.02)),{side:letter,view:'side',axis:1,scale:-.08}));
  const rs=g.seams.roofSeam;
  put('pillars','seamDark',patch(lod?12:22,3,(u,v)=>{
   const p=side(u,1-(.016+rs.gap*3)*v);p[0]+=s*(.003+rs.radius);p[1]-=rs.thickness*.7;return p;
  },s<0));
  put('glass','glass',patch(20,9,side,s<0));
  put('doors','paint',patch(20,4,(u,v)=>{
   const q=side(u,0),outer=skinX(q[2]);
   return [s*mix(Math.abs(q[0]),outer,v),q[1]+(skinY(q[2])-q[1])*v,q[2]];
  },s<0));
  for(const u of [0,c.doors.type==='four door'?.50:.65,1]){
   const mat=c.pillars.type==='painted'?'paint':'trim',w=(.013+.027*c.pillars.shape)*c.pillars.size;
   put('pillars',mat,patch(lod?7:12,3,(v,j)=>{
    const q=side(clamp(u+(j-.5)*w*(u===.5?2:3)),v);q[0]+=s*(.007+.011*bell(j))*c.pillars.depth;return q;
   }));
  }
  put('pillars','trim',patch(18,3,(u,v)=>{const q=side(u,v*.060);q[0]+=s*.010;return q;}));
 }
 // Optical and trim dimensions are tied to fascia, not independent world coordinates.
 const sc=c.scoop;
 if(sc.type!=='off'){
  const z=mix(cabinFront,bumperFront,.49+sc.bias*.14),p=hoodPoint(z,.5),w=.41*sc.size,l=.34*sc.depth,h=.045+.085*sc.shape;
  if(sc.type==='scoop'){
   put('scoop','paint',patch(13,10,(u,v)=>{const a=2*u-1,sz=z+(v-.5)*l;return [w*a*.5,hoodPoint(sz,.5)[1]+(h+sc.angle*RAD*l*.3)*(1-Math.abs(a)**3)*v**1.25,sz];}));
   put('scoop','trim',ellipsoid(w*.91,h*.73,.027),[0,hoodPoint(z+l*.482,.5)[1]+(h+sc.angle*RAD*l*.3)*.38,z+l*.482]);
  }else for(const s of [-1,1])for(let i=0;i<3;i++)put('scoop','trim',ellipsoid(w*.33,.014,.042),[s*w*.26,p[1]-.008,z+l*(i-1)*.3]);
 }
 const sp=c.spoiler;
 if(sp.type!=='off'){
  const z=mix(Lr,cabinRear,.29+sp.bias*.11),base=trunkPoint(z,.5)[1],h=(sp.type==='wing'?.15+sp.shape*.16:.030+sp.shape*.036)*sp.depth,
   w=skinX(z)*1.75*sp.size;
  if(sp.type==='wing')for(const s of [-1,1])put('spoiler','paint',ellipsoid(.068,h*1.22,.22),[s*w*.34,base+h*.47,z],[.13,0,0]);
  put('spoiler','paint',ellipsoid(w,.075*sp.depth,.32*sp.size),[0,base+h,z],[.15+sp.angle*RAD,0,0]);
 }
 const ex=c.exhaust,n=ex.type==='quad'?4:ex.type==='dual'?2:1;
 for(let i=0;i<n;i++){
  const u=n===1?.77:mix(.245,.755,i/(n-1));
  const edge=ends.rear.face(u,1),x=edge[0],y=edge[1]+.022+.034*ex.shape+ex.bias*.025,z=edge[2]+.016;
  const r=.042*ex.size;
  put('exhaust','chrome',new T.LatheGeometry([[r*.75,-.085],[r,-.085],[r,.052],[r*.75,.052],[r*.75,-.085]].map(([a,b])=>new T.Vector2(a,b*ex.depth)),22).rotateX(Math.PI/2),[x,y,z],[ex.angle*RAD,0,0]);
  put('exhaust','trim',ovalCylinder(r*1.43,r*1.43,.014),[x,y,z-.052*ex.depth]);
 }
 // Cabin floor, tail pan and front pan block sight through the wheel wells.
 const cabinY=floor+.22;
 put('seats','floor',box(X*1.48,.052,cabinFront-cabinRear+.08),[0,cabinY-.065,(cabinFront+cabinRear)*.5]);
 const underFront=Lf-ends.front.maxRetreat-.11,underRear=Lr+ends.rear.maxRetreat+.11;
 put('rockers','floor',box(Math.min(2*t-d.tireWidth-.04,X*1.53),.05,underFront-underRear),[0,floor+.025,(underFront+underRear)*.5]);
 for(const end of ['front','rear']){
  const front=end==='front',surf=ends[end];
  put(front?'frontBumper':'rearBumper','floor',patch(7,across,(v,u)=>{
   const p=surf.face(u,1);return [mix(p[0],(2*u-1)*X*.54,v),mix(p[1],floor+.003,v),mix(p[2],front?underFront-.045:underRear+.045,v)];
  },!front));
 }
 const dz=cabinFront-.23,dh=B-.133,dw=X*d.cabinWidth*c.dash.size*1.65;
 put('dash','interior',ellipsoid(dw,.17*c.dash.depth,.32+ .24*c.dash.shape),[0,dh,dz]);
 if(c.dash.type==='sport')put('dash','chrome',box(dw*.91,.022,.025),[0,dh,dz-.2]);
 for(const s of [-1,1]){
  const p=c.seats,x=s*X*.42,z=mix(cabinFront,cabinRear,.56),w=Math.min(X*.55,p.size*.48);
  put('seats','seat',ellipsoid(w,.14*p.depth,.47*p.size),[x,cabinY,z]);
  put('seats','seat',ellipsoid(w,.53*p.size,.19*p.depth),[x,cabinY+.26,z-.21],[.13+p.shape*.14,0,0]);
  if(p.type==='bucket')for(const f of [-1,1])put('seats','interior',ellipsoid(.11,.35,.25),[x+f*w*.41,cabinY+.23+p.shape*.10,z-.14]);
 }
 if(c.doors.type==='four door')put('seats','seat',ellipsoid(X*1.47,.19,.60),[0,cabinY+.06,cabinRear+.36]);
 const sx=-X*.43,sy=dh+.018,sz=dz-.36,st=c.steering,r=.162*st.size;
 const wheelring=new T.TorusGeometry(r,.015*st.depth,8,36);
 if(st.type==='flat-bottom'){const a=wheelring.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,Math.max(-r*(.57+st.shape*.29),a.getY(i)));wheelring.computeVertexNormals();}
 put('steering','rubber',wheelring,[sx,sy,sz],[.29,0,0]);put('steering','trim',box(r*(1.3+.55*st.shape),.040,.035),[sx,sy,sz]);
 const ip=c.instruments;put('instruments','trim',ellipsoid(.29*ip.size,.16*ip.depth,.13),[sx,dh+.08,dz-.13]);
 for(let i=0;i<(ip.type==='digital'?1:2);i++)put('instruments','head',ip.type==='digital'?box(.21*ip.size,.055,.015):ovalCylinder(.074*ip.size,.076,.015),[sx+(ip.type==='digital'?0:(i-.5)*.09),dh+.07,dz-.194-ip.shape*.018]);
 const cp=c.console,cZ=mix(cabinFront,cabinRear,.44);
 put('console','interior',ellipsoid(.26*cp.size,.19*cp.depth,.66),[0,cabinY+.14,cZ]);
 put('console','chrome',box(.043,.12+cp.shape*.05,.050),[0,cabinY+.28,cZ]);
 put('console','trim',ellipsoid(cp.type==='manual'?.075:.10,.055,.068),[0,cabinY+.37,cZ]);
 const wheels=Object.fromEntries([['fl',-1,L],['fr',1,L],['rl',-1,-L],['rr',1,-L]].map(([id,s,z])=>[id,[s*t,R,z]]));
 const wp=wheelParts(g);
 const floorContact=Math.min(...Object.values(wheels).map(v=>v[1]-R));
 for(const part of [...parts,...wp]){
  const {geometry,component}=part,a=geometry.attributes.position;
  for(const v of a.array)if(!Number.isFinite(v)){issues.push('Nonfinite geometry in '+component);break;}
  const normal=geometry.attributes.normal;
  if(!normal||normal.array.some(x=>!Number.isFinite(x)))issues.push('Invalid normals in '+component);
  const b=geometryBounds(geometry);if(b.isEmpty())issues.push('Empty geometry in '+component);
 }
 for(const [a,b] of [[roofRear,roofFront],[doorRear,doorFront],[bumperRear,doorRear],[doorFront,bumperFront]])if(a+.025>=b)issues.push('Shared stations crossed; change the vehicle proportions.');
 const triangles=(p)=>p.reduce((n,{geometry:x})=>n+(x.index?.count??x.attributes.position.count)/3,0);
 const checkedSeams=seamChecks.map(seam=>{
  const flags=[];
  if(seam.gapMinMm<Math.max(.45,seam.gapMm*.60))flags.push('narrow / pinched gap');
  if(seam.gapMaxMm>Math.max(seam.gapMm*1.50,seam.gapMm+2.4))flags.push('gap opens beyond target');
  if(seam.positionMm>1.25)flags.push('panels not flush');
  const key=seam.id.replace(/-[LR]$/,'');
  if((g.seams[key]?.crease??0)<.35&&seam.tangentDeg>5)flags.push('highlight break');
  return {...seam,flags};
 });
 for(const feature of features){const known=checkedSeams.find(s=>s.id===feature.id);if(known&&feature.metrics)feature.metrics.flags=known.flags;}
 for(const p of [...parts,...wp])p.semantic={id:'part-'+p.component,type:'component',component:p.component};
 return {genome:g,parts,wheelParts:wp,wheels,lampMounts,fascia,features,stations:{cabinFront,cabinRear,roofFront,roofRear,doorFront,doorRear,bumperFront,bumperRear},
  metadata:{lengthM:length,widthM:d.width,heightM:d.height,wheelbaseM:d.wheelbase,trackWidthM:t*2,trackFrontM:t*2,trackRearM:t*2,wheelRadiusM:R,rideHeightM:floor},
  diagnostics:{issues:[...new Set(issues)],warnings:[...new Set(warnings)],floorContact,joins,seams:checkedSeams,bodyTriangles:triangles(parts),wheelTriangles:triangles(wp),panel:cloneJSON(surface.diagnostics)}};
}
