import * as T from '../../vendorBridge/three.js';
import {createEndSurface,fasciaMesh} from './fascia.mjs';
import {makeOpenings,emitOpenings} from './optics.mjs';
import {createMasterSide,buildPanelGap} from './seams.mjs';
import {buildCabin} from './cabin9.mjs';
import {buildStructure} from './structure9.mjs';
import {buildAero} from './aero9.mjs';
import {buildWheels} from './wheels9.mjs';
import {evalFormula,compileFormula} from './formula9.mjs';
import {normalizeVehicle,SEAM_KEYS,getSideSettings,evaluateInteriorPatch,math} from './genome.mjs';
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
function box(w,h,l){return new T.BoxGeometry(w,h,l);}
function ellipsoid(w,h,l){return new T.SphereGeometry(1,16,10).scale(w/2,h/2,l/2);}
function geometryBounds(geo){geo.computeBoundingBox();return geo.boundingBox;}
function addModelPart(out,component,material,geo,p=null,rotation=null){
 if(rotation){const [x,y,z]=rotation;geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(x,y,z)));}
 if(p)geo.translate(...p);
 out.push({component,material,geometry:geo});return geo;
}
export const disposeDesign=design=>{for(const p of [...design.parts,...design.wheelParts])p.geometry.dispose();};
export function generateVehicle(input,{quality='preview'}={}){
 const g=normalizeVehicle(input),d=g.dimensions,c=g.components,G=g.constraints.gap*.5;
 const parts=[],issues=[],warnings=[], joins=[],features=[],seamChecks=[],masters={},glassSides={};
 const X=d.width/2,R=d.diameter/2,L=d.wheelbase/2,Lf=L+d.front,Lr=-L-d.rear,length=Lf-Lr;
 const floor=d.stance, B=d.height*d.belt;
 const customArches=['frontArchFore','rearArchFore','frontArchUpper','rearArchUpper'].some(k=>g.body[k]!==.045);
 const archData=(ax,s=null)=>{
  const front=ax>0,k=front?'frontFenders':'rearFenders',root=front?'front':'rear';
  const style=s===null||!customArches?c[k]:getSideSettings(g,'fenders',s>0?'R':'L',c[k]),scale=.025*(style.size-1);
  return {fore:Math.max(R+.014,R+g.body[root+'ArchFore']+scale),upper:Math.max(R+.012,R+g.body[root+'ArchUpper']+scale)};
 };
 const radius=R+Math.max(g.body.frontArchFore,g.body.rearArchFore);
 let t=(X*d.track),clearance=X-t-d.tireWidth/2;
 if(clearance<d.archReserve){t=X-d.tireWidth/2-d.archReserve;warnings.push('Track narrowed to keep tires inside the arch lips.');}
 const rearTrack=Math.min(X-d.tireWidth/2-d.archReserve,t+d.rearTrackBias*.5);
 if(t*2<1.2){issues.push('Track below the runtime suspension envelope.');}
 
 if(floor>R-.03)warnings.push('Rocker sits above the hub; this is an elevated stance.');
 const wide=clamp(d.box),zC=(Lf+Lr)*.5+length*d.cabin;
 let cabinFront=zC+length*(d.cabinLength/2-d.hood),cabinRear=zC-length*(d.cabinLength/2-d.trunk);
 cabinFront=clamp(cabinFront,Lr+.9,Lf-.53);cabinRear=clamp(cabinRear-g.construction.cabin.rearPillarFoot,Lr+(g.construction.cabin.rearPillarFoot?.40:.50),cabinFront-1.52);
 const doorFront=clamp(cabinFront+.12,-.15,L-.26),doorRear=clamp(cabinRear-.17,-L+.23,doorFront-.65);
 const seamSpan=(end,overhang)=>Math.min(overhang*.69,g.fascia[end].bumperStation===.43?Math.min(overhang*.49,.43):g.fascia[end].bumperStation);
 const bumperFront=Lf-seamSpan('front',d.front),bumperRear=Lr+seamSpan('rear',d.rear);
 const doorSplits=c.doors.type==='four door'?[doorRear,mix(doorRear,doorFront,.47),doorFront]:[doorRear,doorFront];
 const handleStations=doorSplits.slice(1).map((z,i)=>mix(doorSplits[i],z,.26));
 const styleCurves=g.construction.features.map(f=>({...f,calculate:compileFormula(f.formula)}));
 function featureHeight(f,z){
  const longitudinal=(z-Lr)/length,q=clamp((longitudinal-f.start)/(f.end-f.start));
  return clamp(f.height+f.calculate({u:q,t:q,x:q,z,side:f.side==='L'?-1:1}),.045,.94);
 }
 const unitSmooth=x=>x*x*(3-2*x);
 function stamped(z,v,sign){
  const t=(z-Lr)/length; let offset=0;
  for(const f of styleCurves){
   if(t<=f.start||t>=f.end||(f.side!=='both'&&f.side!==(sign>0?'R':'L')))continue;
   const a=(t-f.start)/(f.end-f.start),l=unitSmooth(clamp(Math.min(a,1-a)/f.falloff));
   const width=Math.max(.014,f.width/Math.max(.29,B-floor));
   const q=(v-featureHeight(f,z))/width;
   const kernel=Math.exp(-(Math.abs(q)**(1.6+f.sharpness*2.2)));
   const direction=['groove','recess'].includes(f.kind)?-1:1;
   offset+=direction*f.depth*l*kernel*(1-Math.pow(v,12));
  }
  return clamp(offset,-.06,.075);
 }
 const canopy=g.construction.cabin,extension=(canopy.canopyLength-.5)*.15;
 const roofFront=mix(cabinFront,doorRear,.37+.10*c.glass.shape-extension);
 const rearFraction=(g.family==='fastback'?.45:.22+.10*c.glass.shape)-extension;
 const rearDatum=mix(cabinRear,doorFront,rearFraction);
 const roofRear=canopy.rearPillarFoot||canopy.rearRoofShift?clamp(rearDatum+canopy.rearPillarFoot*(1-rearFraction)-canopy.rearRoofShift,cabinRear+.18,roofFront-.34):rearDatum;
 const nose=B-(.14+.10*(1-wide))*c.frontBumper.depth,deck=B-(c.trunk.type==='fastback'?.13:.065)*c.rearBumper.depth;
 const skinY=z=>z>cabinFront?mix(B,nose,((z-cabinFront)/(Lf-cabinFront))**1.4):z<cabinRear?mix(B,deck,((cabinRear-z)/(cabinRear-Lr))**1.38):B;
 const regionalBox=z=>clamp(wide+(z>0?d.frontBox:d.rearBox)*clamp(Math.abs(z)/L));
 function skinX(z){const noseT=clamp((Math.abs(z-(Lf+Lr)*.5)/(.5*length)-.70)/.30);return X*(1-(.058+.13*(1-regionalBox(z)))*noseT**2);}
 const lipHeight=(z,side)=>{
  const ax=z>0?L:-L,dist=Math.abs(z-ax),a0=archData(ax,side);
  if(dist>=a0.fore)return floor;
  const s=dist/a0.fore,a=clamp((1-s)/g.body.archFootBlend),curved=R+a0.upper*Math.sqrt(Math.max(0,1-s*s));
  return mix(floor,curved,a*a*(3-2*a));
 };
 for(const [component,axle] of [['frontFenders',L],['rearFenders',-L]]){
  const {fore,upper}=archData(axle);
  for(const trial of [-.55,-.30,0,.30,.55]){
   const z=axle+fore*trial,needed=R+upper*Math.sqrt(1-trial*trial);
   if(skinY(z)-needed<.025){issues.push('Beltline intersects the '+(axle>0?'front':'rear')+' wheel opening; raise the beltline or fit smaller tires.');break;}
  }
 }
 const surface=buildFender(g.surfaces.frontFenders,{uSteps:quality==='export'?36:23,vSteps:quality==='export'?20:13,lipSteps:4});
 if(!surface.diagnostics.valid)issues.push(...surface.diagnostics.issues.map(s=>'Front fender: '+s));
 const frontPanelSamples=Array.from({length:21},(_,i)=>Array.from({length:11},(_,j)=>surface.eval(i/20,j/10)));
 const panelSample=(u,v)=>{const a=clamp(u)*20,b=clamp(v)*10,i=Math.min(19,Math.floor(a)),j=Math.min(9,Math.floor(b));return lerp3(lerp3(frontPanelSamples[i][j],frontPanelSamples[i+1][j],a-i),lerp3(frontPanelSamples[i][j+1],frontPanelSamples[i+1][j+1],a-i),b-j);};
 const {doorStamp,doorStampHeight,doorStampSweep}=g.body;
 const stampStation=z=>clamp((z-(doorRear-.26))/(doorFront-doorRear+.52));
 const stampLine=z=>doorStampHeight+doorStampSweep*(stampStation(z)-.5);
 const stampFade=z=>unitSmooth(clamp(stampStation(z)/.16))*unitSmooth(clamp((1-stampStation(z))/.16));
 function skinPoint(z,v,sgn,comp){
  const side=skinX(z), localBox=regionalBox(z), bottom=Math.min(skinY(z)-.022,lipHeight(z,sgn)),archAt=z>0?L:-L,
      flare=clamp(1-Math.abs(z-archAt)/(radius+.25))**1.65;
  const lower=floor-.013;
  const source=c[comp], group=comp.endsWith('Fenders')?'fenders':comp==='doors'?'doors':null;
  const p=group?getSideSettings(g,group,sgn>0?'R':'L',source):source;
  const shape=comp==='doors'?p.shape*(.46+.54*wide):p.shape;
  const flareScale=archAt>0?g.body.frontFlareScale:g.body.rearFlareScale;
  const profile=comp==='frontFenders'||comp==='rearFenders'?
   (p.type==='boxed'?.055:p.type==='integrated'||p.type==='wide'?.072:.045)*p.depth*flare*flareScale*Math.sin(v*Math.PI*.75):0;
  let x=side- .023*v-(.012+.035*(1-localBox))*v**3+profile+(.008+.027*shape)*Math.sin(v*Math.PI*1.5);
  const edgePull=clamp((v-.72)/.28)*clamp((flare-.18)/.65);
  x=mix(x,Math.max(x,t+d.tireWidth/2+.018*(.6+.4*flareScale)),edgePull);
  let y=mix(skinY(z),bottom,v);
  if(comp==='frontFenders'){
   const u=clamp((z-doorFront)/(bumperFront-doorFront)),q=panelSample(u,v),edge=lerp3(panelSample(u,0),panelSample(u,1),v);
   const influence=Math.sin(Math.PI*u)*Math.sin(Math.PI*v)**.64;
   x+=(q[0]-edge[0])*influence*p.size;
   const sp=g.surfaces.frontFenders.parameters;
   y+=((q[1]-edge[1])*.30+sp.height*.3+sp.hoodBoundary*.35)*influence;
   z+=(q[2]-edge[2])*.15*influence;
   if(v>.68){
    const t=(v-.68)/.32;
    x+=sp.lipRadius*.7*influence*t*g.body.lipScale;
   }
  }
  const creaseWidth=.028+.06*(1-g.body.creaseStrength);
  const crease=(z>doorRear-.38&&z<doorFront+.42)?Math.min(1,(z-doorRear+.38)/.18,(doorFront+.42-z)/.20):0;
  x+=(.003+.014*g.body.creaseStrength)*crease*Math.exp(-((v-g.body.creaseHeight)**2)/(creaseWidth**2));
  x+=(.004+.018*g.body.archCrown)*flare*flareScale*Math.sin(Math.PI*v)**2;
  if(doorStamp){
   const p=(v-stampLine(z))/.066;
   x+=doorStamp*stampFade(z)*(Math.exp(-p*p)-.48*Math.exp(-((p+.99)**2)));
  }
  if(comp==='doors'){
   for(const hz of handleStations)x-=(.002+.013*g.body.handleRecess)*Math.exp(-((v-.22)**2)/.0034-((z-hz)**2)/.008);
  }
  x+=stamped(z,v,sgn);
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
 const hoodDesign=g.construction.hood;
 const hoodShoulder=(z,v)=>{
  if(!hoodDesign.shoulderRise)return 0;
  const t=clamp((z-cabinFront)/(bumperFront-cabinFront)),a=Math.abs(v*2-1);
  const center=clamp(hoodDesign.shoulderAt-hoodDesign.shoulderSweep*t,.28,.91);
  const q=(a-center)*skinX(z)/hoodDesign.shoulderWidth;
  // Stamped crown above the shoulder, with a return to the shared edge.
  // Fade both ends so the base seam tangents and attachment rail are preserved.
  const edge=unitSmooth(clamp((1-a)/.14));
  const blend=unitSmooth(clamp((t-.015)/.155))*unitSmooth(clamp((.983-t)/.143));
  const crown=(1-Math.tanh(q))*0.5;
  return hoodDesign.shoulderRise*blend*edge*(crown-.22*Math.exp(-((q-.74)**2)));
 };
 const originalHood=(z,v)=>{const p=top(z,v,mix(hoodC,.019*c.frontBumper.size,clamp((z-(bumperFront-.28))/.28)**2),'hood');
  p[1]+=UP_PATCH(g,'hood',z,v,cabinFront,bumperFront)+hoodShoulder(z,v);return p;};
 const trunkC=(c.trunk.type==='fastback'?.034:c.trunk.type==='ducktail'?.064:.047)*(.68+c.trunk.shape)*c.trunk.depth;
 const originalTrunk=(z,v)=>{const p=top(z,v,mix(trunkC,.019*c.rearBumper.size,clamp((bumperRear+.28-z)/.28)**2),'trunk');
  p[1]+=UP_PATCH(g,'trunk',z,v,bumperRear,cabinRear);return p;};
 const ends={},fascia={},lampMounts={};
 const runtime=['drive','lod','opponent'].includes(quality),lod=runtime;
 const across=quality==='export'?42:quality==='opponent'?18:lod?22:32,down=quality==='export'?16:quality==='opponent'?7:lod?9:13,along=quality==='export'?17:lod?8:12;
 const hoodPoint=(z,u)=>ends.front.upperPanel(z,u);
 const trunkPoint=(z,u)=>ends.rear.upperPanel(z,u);
 for(const end of ['front','rear']){
  const front=end==='front',sign=front?1:-1,name=front?'frontBumper':'rearBumper',
   fender=front?'frontFenders':'rearFenders',tip=(front?Lf:Lr)-sign*G,upper=g.seams[front?'hoodSeam':'trunkSeam'],
   seam=(front?bumperFront:bumperRear)+upper.offset;
  const surf=createEndSurface({settings:g.fascia[end],end,tip,seam,cabin:front?cabinFront:cabinRear,
   archEnd:L+Math.max(archData(sign*L,-1).fore,archData(sign*L,1).fore),floor,deckAt:front?originalHood:originalTrunk,
   sideAt:(z,v,s)=>skinPoint(z,v,s,name),bumper:c[name],upper});
  ends[end]=surf;
  const openings=makeOpenings({end,g,segments:quality==='opponent'?14:lod?18:quality==='export'?32:24});
  const wrapped=openings.some(o=>o.kind==='lamp'&&o.opt.sideWrap>.0001);
  const trail=wrapped?Math.ceil(along*.56):along, wingSteps=along-trail;
  const band=.125, t0=trail/along;
  const toAtlas=u=>band+(1-2*band)*u;
  const columns=wrapped?[...Array.from({length:wingSteps},(_,i)=>band*i/wingSteps),
    ...Array.from({length:across+1},(_,i)=>toAtlas(i/across)),
    ...Array.from({length:wingSteps},(_,i)=>1-band+band*(i+1)/wingSteps)]:null;
  const curtain=wrapped?(u,v)=>u<band?surf.bumperSide(mix(t0,1,u/band),v,-1):
   u>1-band?surf.bumperSide(mix(1,t0,(u-(1-band))/band),v,1):surf.face(clamp((u-band)/(1-2*band)),v):surf.face;
  const chart=wrapped?(u,v)=>{
   const base=curtain(u,v),corner=Math.min(Math.abs(u-band),Math.abs(u-(1-band)));
   const w=.022;
   if(corner>=w||v===0||v===1)return base;
   const A=curtain(u-w*.7,v),B=curtain(u+w*.7,v);
   const weight=.65*unitSmooth(1-corner/w)*unitSmooth(clamp(v/.095))*unitSmooth(clamp((1-v)/.125));
   return lerp3(base,lerp3(A,B,.5),weight);
  }:curtain;
  if(wrapped)for(const o of openings){
   const [cx,cy]=o.center,side=cx>.5?1:-1;
   const r=o.kind==='lamp'?o.opt.sideWrap:0;
   const far=Math.max(...o.outline.map(p=>(p[0]-cx)*side));
   const edge=cx+far*side;
   const travel=r*Math.max(0,(side>0?1-.042-toAtlas(edge):toAtlas(edge)-.042));
   o.outline=o.outline.map(([u,v])=>{
    const reach=Math.max(0,(u-cx)*side)/(far||1);
    return [toAtlas(u)+side*travel*reach*reach,v];
   });
   o.center=[toAtlas(cx),cy];if(o.width)o.width*=(1-2*band);
  }
  const shell=put(name,'paint',fasciaMesh(chart,openings,{rear:!front,across,down,columns,tolerance:wrapped?(lod?.097:.067):lod?.155:quality==='export'?.092:.115}));
  const faceColumns=columns?columns.length-1:across;
  for(const opening of openings){
   const right=opening.center[0]>.5,p=opening.outline.map(uv=>chart(...uv)),letter=right?'R':'L';
   const id=opening.kind==='lamp'?end+'-lamp-'+letter:opening.id;
   const xSide=right?1:-1;
   features.push(guideFeature(id,opening.kind==='lamp'?'lamp':'opening',opening.kind==='lamp'?(front?'Headlight outline':'Taillight outline')+' · '+letter:opening.kind==='deck'?'Trunk perimeter':opening.component==='grille'?'Grille perimeter':opening.kind==='fog'?'Fog-light perimeter':'Intake / valance perimeter',opening.component,p,
    {end,side:letter,closed:true,view:end,axis:0,scale:.18*xSide,anchor:p.reduce((a,b)=>xSide*b[0]>xSide*a[0]?b:a)}));
  }
  features.push(guideFeature(end+'-silhouette','silhouette',front?'Nose silhouette':'Tail silhouette',name,curvePoints(u=>surf.face(u,.13)),{end,view:'top',axis:2,scale:sign*.28}));
  const mounted=emitOpenings({end,openings,surface:chart,put,lod,spatialDepth:wrapped});
  Object.assign(lampMounts,mounted.mounts);
  issues.push(...(mounted.issues??[]));
  fascia[end]={guides:surf.guides,trimArea:shell.userData.trimArea,wrapped,
   samples:[0,.15,.30,.45,.5,.55,.70,.85,1].map(u=>surf.face(u,.13)),
   openings:openings.map(({id,component,outline})=>({id,component,outline:cloneJSON(outline)}))};
  const lamp=openings.find(x=>x.kind==='lamp'&&x.center[0]>.5);
  if(lamp){const ring=lamp.outline;fascia[end].guides.outline={points:Array.from({length:8},(_,i)=>chart(...ring[Math.floor(i*ring.length/8)])),axis:1,scale:.05};}
  if(Math.abs(shell.userData.trimArea.mesh-shell.userData.trimArea.expected)>1e-6||shell.userData.trimArea.unmatched)issues.push('Overlapping or invalid '+end+' cutouts.');
  const roll=put(name,'paint',patch(along,across,(t,u)=>{
   const q=surf.bridge(u,t);
   q[2]+=sign*upper.gap*.5*(1-t)**3;q[1]+=upper.flush*.5*(1-t)**3;return q;
  },!front));
  surf.geometries={shell,roll,trail,wingSteps,faceColumns};
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
  for(const piece of seam.parts){piece.geometry.userData.constructionRole='panel seams / '+piece.kind;put(name,piece.material,piece.geometry);}
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
  const {shell,roll,wingSteps}=ends[end].geometries;
  for(let i=0;i<=across;i++)weldNormals([shell,i+wingSteps],[roll,along*(across+1)+i]);
  for(let j=0;j<wingSteps;j++){
   weldNormals([shell,j],[roll,(along-wingSteps+j)*(across+1)]);
   weldNormals([shell,across+2*wingSteps-j],[roll,(along-wingSteps+j)*(across+1)+across]);
  }
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
  const master=createMasterSide({panels:slabs,settings:g.seams,gap:g.constraints.gap,side:s,stations:down,quality:lod?'lod':quality});masters[s]=master;
  for(let index=0;index<slabs.length;index++){
   const {key,start:a,end:b}=slabs[index],sampler=(u,v)=>master.panel(index,u,v);
   if(key==='frontBumper'||key==='rearBumper'){
    const front=key==='frontBumper',surf=ends[front?'front':'rear'],col=s<0?0:across,{shell,roll,trail,faceColumns}=surf.geometries;
    const fraction=trail/along;
    const side=put(key,'paint',patch(trail,down,(u,v)=>sampler(front?u*fraction:1-(1-u)*fraction,v),s<0));
    const tipIndex=front?trail:0, at=i=>front?i:trail-i;
    for(let i=0;i<=trail;i++)weldNormals([roll,i*(across+1)+col],[side,at(i)*(down+1)]);
    for(let j=1;j<=down;j++){
     const row=s>0?faceColumns+j:2*faceColumns+2*down-j;
     weldNormals([shell,row],[side,tipIndex*(down+1)+j]);
    }
   }else{
    const stations=adaptiveStations(sampler,{lod});
    put(key,'paint',patch(stations.length-1,down,(u,v)=>{
     const t=stations[Math.round(u*(stations.length-1))];
     if(!doorStamp||key!=='doors')return sampler(t,v);
     const q=stampLine(mix(a,b,t)),base=Math.round(q*down),row=clamp(base,2,down-2);
     const k=Math.round(v*down),wanted=k===row-1?q-.071:k===row?q-.007:k===row+1?q+.053:null;
     const fade=unitSmooth(clamp(t/.10))*unitSmooth(clamp((1-t)/.10));
     // Keep shared seam samples in place. Move only the neighboring rows,
     // enough to capture the crest and the return without extra triangles.
     const j=wanted===null?v:mix(v,clamp(wanted,Math.max(.025,(row-2)/down+.008),Math.min(.975,(row+2)/down-.008)),fade);
     return sampler(t,j);
    },s<0));
   }
   joins.push({a,b,component:key,side:s});
  }
  for(const seam of master.seams){
   const k=seam.id,component=k.includes('Fender')?(k==='rearFenderSeam'?'rearFenders':'frontFenders'):'doors';
   for(const p of seam.parts){p.geometry.userData.constructionRole='panel seams / '+p.kind;put(component,p.material,p.geometry);}
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
    const z=axle-archData(axle,s).fore*Math.cos(u*Math.PI),p=master.at(z,1),r=(.0045+c[comp].shape*.004+g.body.archCrown*.004)*g.body.lipScale;
    return [p[0]-s*r*(1-Math.cos(v*2.1)),p[1]-r*Math.sin(v*2.1),p[2]];
   }));
   const arc=curvePoints(u=>master.at(axle-archData(axle,s).fore*Math.cos(u*Math.PI),1));
   features.push(guideFeature(comp+'-arch-'+letter,'arch',(axle>0?'Front':'Rear')+' wheel arch · '+letter,comp,arc,{end:axle>0?'front':'rear',side:letter,view:'side',axis:1,scale:.12}));

  }
  const p=getSideSettings(g,'rockers',letter,c.rockers);
  const sillHeight=(p.type==='blade'?.052:p.type==='deep'?.14:.089)*p.size*d.skirt;
  addModelPart(parts,'rockers',p.type==='blade'?'trim':'paint',patch(16,5,(u,v)=>{
   const z=mix(-L+radius+.011,L-radius-.011,u);
   return [master.at(z,.99)[0]+s*(.008*p.depth+.020*bell(v)*p.shape),floor-.019+sillHeight*v,z];
  }));
  const mirror=getSideSettings(g,'mirrors',letter,c.mirrors),sx=X*.87,sy=B+.105*mirror.depth,mz=cabinFront-.19+mirror.bias*.08;
  if(mirror.type==='folded rectangle'){
   const center=[s*(sx+.106),sy+.009,mz],width=.239*mirror.size,height=.125*mirror.depth,depth=.123*mirror.size;
   const exponent=.32+.36*mirror.shape,power=t=>Math.sign(t)*Math.abs(t)**exponent;
   const local=(u,scale,z)=>{const angle=u*2*Math.PI; const x=width*.5*power(Math.cos(angle))*scale;
    return [center[0]+x,center[1]+height*.5*power(Math.sin(angle))*scale-s*x*.105,center[2]+z+s*x*.21];
   };
   const ringPatch=(z0,z1,r0,r1,flip=true)=>patch(3,lod?24:32,(t,u)=>local(u,mix(r0,r1,unitSmooth(t)),mix(z0,z1,t)),flip);
   put('mirrors','paint',ringPatch(-depth*.43,-depth*.29,.93,1));
   put('mirrors','paint',ringPatch(-depth*.29,depth*.16,1,.96));
   put('mirrors','paint',ringPatch(depth*.16,depth*.48,.96,.51));
   put('mirrors','paint',ringPatch(depth*.48,depth*.55,.51,.005));
   put('mirrors','trim',ringPatch(-depth*.43,-depth*.449,.93,.84,false));
   put('mirrors','chrome',ringPatch(-depth*.449,-depth*.452,.84,.001,false));
   put('mirrors','trim',box(.165,.044,.074),[s*(sx+.017),sy-.022,mz-.015]);
  }else{
  put('mirrors','trim',box(.19,.032,.055),[s*(sx+.085),sy-.026,mz]);
  put('mirrors','paint',ellipsoid(.25*mirror.size,.115*mirror.depth,.185*mirror.size*(mirror.type==='aero'?1.42:1)),[s*(sx+.19),sy,mz],[mirror.angle*RAD,s*(mirror.shape-.5)*.52,0]);
  put('mirrors','chrome',ellipsoid(.19*mirror.size,.087,.019),[s*(sx+.20),sy,mz-.081*mirror.size]);
  }
  for(const z of handleStations){
   const hp=c.handles,q=master.at(z,.22);
   if(hp.type==='painted lever'){
    const span=.132*hp.size, height=.025+hp.shape*.014, rise=.009*hp.depth;
    put('handles','seamDark',new T.SphereGeometry(1,12,6).scale(.004,height*.64,span*.53),[q[0]-s*.0005,q[1],q[2]]);
    const grip=new T.CapsuleGeometry(height*.25,span-height*.5,3,9).rotateX(Math.PI*.5).scale(.69,.95,1);
    put('handles','paint',grip,[q[0]+s*rise,q[1]-.002,q[2]]);
   }else{
   put('handles','seamDark',new T.SphereGeometry(1,10,5).scale(.0045,(.032+hp.shape*.025)*hp.size*.5,.080*hp.size),[q[0]-s*.002,q[1],q[2]]);
   put('handles',hp.type==='flush'?'paint':'trim',new T.SphereGeometry(1,10,5).scale((.008+.005*hp.depth)*.5,(.018+hp.shape*.014)*hp.size*.5,.063*hp.size),[q[0]+s*.004,q[1]+.001,q[2]]);
   }
  }
 }
 // Shared q(u,v) cabin envelope consumed by all glazing, pillars and roof.
 const roofW=Math.min(X*.91,X*d.cabinWidth*c.roof.size*.94),glassBaseW=X*d.cabinWidth*1.12,
  roofC=(.023+.068*d.crown)*(.60+c.roof.shape)*(c.roof.type==='flat'?.40:1)*c.roof.depth;
 const baseW=z=>Math.min(skinX(z)-.035,glassBaseW);
 const roofPoint=(z,u)=>{const k=2*u-1,edge=g.body.roofEdge;return [k*roofW*(1-(.067+.12*(canopy.canopyShoulder-.5))*Math.abs(2*(z-roofRear)/Math.max(.15,roofFront-roofRear)-1)**2),d.height+UP_PATCH(g,'roof',z,u,roofRear,roofFront)-roofC*Math.abs(k)**(2.28-.68*edge-.60*(canopy.canopyShoulder-.5))-.014*edge*Math.abs(k)**11-roofC*.45*Math.abs(2*(z-roofRear)/Math.max(.15,roofFront-roofRear)-1)**2,z];};
 const glassPoint=(sgn,t,u)=>{const edge=sgn>0?roofFront:roofRear,gate=sgn>0?cabinFront:cabinRear;
  const w=baseW(gate),x=(2*u-1)*w,k=(x/skinX(gate)+1)/2;
  const q=lerp3([x,(sgn>0?hoodPoint:trunkPoint)(gate,k)[1]+.004,gate],roofPoint(edge,u),t);
  q[2]+=sgn*.045*c.glass.depth*bell(t)*bell(u);
  if(sgn<0&&canopy.rearGlassArc){
   const round=bell(t)**1.35;
   q[1]+=canopy.rearGlassArc*round;
   q[2]-=canopy.rearGlassArc*.28*round;
  }
  return q;};
 sheet('roof','paint',roofRear,roofFront,roofPoint,17,12);
 for(const s of [-1,1]){
  put('glass',c.glass.type==='tinted'?'glass':'glass',patch(12,16,(v,u)=>glassPoint(s,v,u),s<0));
  const roofSide=s>0?1:0,letter=s>0?'R':'L', A=roofPoint(roofFront,roofSide),C=roofPoint(roofRear,roofSide);
  function side(u,v){
   const f=glassPoint(1,v,roofSide),r=glassPoint(-1,v,roofSide),a=lerp3(f,r,u),
    line=lerp3(A,C,u),actual=roofPoint(mix(roofFront,roofRear,u),roofSide);
   a[0]+=s*.030*canopy.glassBow*bell(u)*bell(v)*c.glass.depth;
   return a.map((x,i)=>x+(actual[i]-line[i])*v*v);
  }
  glassSides[s]=side;
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
  const framed=c.pillars.type==='painted frame';
  for(const u of [0,c.doors.type==='four door'?.50:.65,1]){
   const outer=u===0||u===1;
   const mat=c.pillars.type==='painted'||framed&&outer?'paint':'trim',w=(.013+.027*c.pillars.shape)*c.pillars.size+(u===1?canopy.rearPillarWidth:0);
   const pillar=(v,j)=>{
    const q=side(clamp(u+(j-.5)*w*(u===.5?2:3)),v);q[0]+=s*(.007+.011*bell(j))*c.pillars.depth;return q;
   };
   put('pillars',mat,patch(lod?7:12,3,pillar,framed&&s<0));
   if(framed&&outer)put('pillars','trim',patch(lod?7:12,2,(v,j)=>{
    const edge=u===0?.78:.22, q=pillar(v,edge+(u===0?1:-1)*j*.18);
    q[0]+=s*.0012;return q;
   },(s<0)!==(u===1)));
  }
  if(framed)put('pillars','paint',patch(20,3,(u,j)=>{
   const q=side(u,1-j*.046);q[0]+=s*.006;return q;
  },s<0));
  put('pillars','trim',patch(18,3,(u,v)=>{const q=side(u,v*.060);q[0]+=s*.010;return q;}));
 }
 // Optical and trim dimensions are tied to fascia, not independent world coordinates.
 const sc=c.scoop;
 if(sc.type!=='off'){
  const z=mix(cabinFront,bumperFront,.49+sc.bias*.14),p=hoodPoint(z,.5),w=hoodDesign.scoopWidth?Math.max(.12,hoodDesign.scoopWidth):.41*sc.size,l=.34*sc.depth,h=hoodDesign.scoopHeight?Math.max(.015,hoodDesign.scoopHeight):.045+.085*sc.shape;
  if(sc.type==='scoop'){
   const lipZ=z+l*.48,ht=h+sc.angle*RAD*l*.24;
   function surface(a,b){
    const sz=mix(z-l*.56,lipZ,b),x=w*.5*a*(.87+.13*b);
    const base=hoodPoint(sz,clamp(.5+x/(2*skinX(sz))))[1];
    const cross=Math.max(0,1-Math.abs(a)**(8+12*hoodDesign.scoopCorner))**(.64-.30*hoodDesign.scoopCorner);
    return [x,base+ht*cross*(b*b*(3-2*b))-.001,sz];
   }
   put('scoop','paint',patch(lod?8:16,8,(b,u)=>surface(2*u-1,b)));
   // A real open sleeve with painted lip, black inside walls and a recessed
   // termination; shadows have physical depth, not a floating black oval.
   if(hoodDesign.scoopWidth||hoodDesign.scoopHeight||hoodDesign.scoopCorner){
    const base=(x,at)=>hoodPoint(at,clamp(.5+x/(2*skinX(at))))[1];
    const ringShape=(a,at,scale,height)=>{
     const x=w*.5*a*scale,arch=Math.max(0,1-Math.abs(a)**(8+12*hoodDesign.scoopCorner))**(.64-.30*hoodDesign.scoopCorner);
     const bottom=base(x,at)-.001;
     return {x,bottom,top:bottom+height*arch};
    };
    const cut=(a,b,inner)=>{
     const out=ringShape(a,lipZ,1,ht),p=ringShape(a,lipZ+.003,.91,ht-.009);
     const bottom=p.bottom+.004,top=Math.max(bottom+.0008,p.top);
     return inner?[p.x,mix(bottom,top,b),lipZ+.003]:[out.x,mix(out.bottom,out.top,b),lipZ];
    };
    const back=(a,b)=>{
     const at=lipZ-Math.min(l*.43,.17);
     const p=ringShape(a,at,.78,ht*.52);
     return [p.x,mix(p.bottom+.002,Math.max(p.bottom+.0028,p.top),b),at];
    };
    for(const b of [0,1]){
     put('scoop','paint',patch(18,2,(u,t)=>lerp3(cut(u*2-1,b,false),cut(u*2-1,b,true),t),b===0));
     put('scoop','seamDark',patch(18,2,(u,t)=>lerp3(cut(u*2-1,b,true),back(u*2-1,b),t),b===1));
    }
    put('scoop','seamDark',patch(18,4,(u,t)=>back(u*2-1,t)));
   }else{
   const mouth=(a,v,back=0)=>{const p=surface(a,1),q=hoodPoint(lipZ,.5+a*w/(4*skinX(lipZ)));
    return [p[0]*(1-.17*back),mix(q[1]+.006,p[1]-.006,v)-.006*back,lipZ+.002-.105*back];};
   put('scoop','seamDark',patch(12,3,(u,v)=>mouth(2*u-1,v,1)));
   for(const rim of [0,1])put('scoop',rim?'paint':'trim',patch(12,4,(u,v)=>mouth(2*u-1,rim,v)));
   for(const s of [-1,1])put('scoop','seamDark',patch(4,3,(u,v)=>mouth(s*.967,u,v),s<0));
   }
  }else for(const s of [-1,1])for(let i=0;i<3;i++)put('scoop','trim',ellipsoid(w*.33,.014,.042),[s*w*.26,p[1]-.008,z+l*(i-1)*.3]);
 }
 const dims={X,L,Lf,Lr,floor,B,cabinFront,cabinRear,roofFront,roofRear,tireTrack:t,rearTireTrack:rearTrack,wheelRadius:R,archRadius:radius,frontArchRadius:customArches?Math.max(archData(L,1).fore,archData(L,-1).fore):radius,rearArchRadius:customArches?Math.max(archData(-L,1).fore,archData(-L,-1).fore):radius};
 const bodySide=(z,v,s)=>masters[s].at(z,v);
 const cabin=buildCabin({g,quality:lod?'lod':quality,put,dims,sample:{
  side:(z,v,s)=>glassSides[s](clamp((cabinFront-z)/(cabinFront-cabinRear)),v),roof:roofPoint,
  frontGlass:(t,u)=>glassPoint(1,t,u),rearGlass:(t,u)=>glassPoint(-1,t,u)
 }});
 const structure=buildStructure({g,quality:lod?'drive':quality,put,dims,sample:{side:bodySide,arch:(z,s)=>bodySide(z,1,s),front:ends.front.face,rear:ends.rear.face}});
 issues.push(...(structure.issues??[]));
 const aero=buildAero({g,quality:lod?'lod':quality,put,sample:{trunk:trunkPoint,rear:ends.rear.face},dims,evalFormula});
 for(const f of styleCurves)for(const side of (f.side==='both'?['L','R']:[f.side])){
  const sign=side==='R'?1:-1;
  const points=curvePoints(u=>{const z=mix(Lr,Lf,mix(f.start,f.end,u));return bodySide(z,featureHeight(f,z),sign);});
  features.push(guideFeature('style-'+f.id+'-'+side,'style-curve','Styling curve · '+f.id+' · '+side,'doors',points,{key:f.id,side,view:'side',axis:1,scale:-.50}));
 }
 const wheels=Object.fromEntries([['fl',-1,L],['fr',1,L],['rl',-1,-L],['rr',1,-L]].map(([id,s,z])=>[id,[s*(z>0?t:rearTrack),R,z]]));
 const wp=[];buildWheels(g,{quality,emit:(k,m,geo,p,r)=>addModelPart(wp,k,m,geo,p,r)});
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
 return {genome:g,parts,wheelParts:wp,wheels,lampMounts,fascia,features,cabin,aero,structure:structure.metrics,stations:{cabinFront,cabinRear,roofFront,roofRear,doorFront,doorRear,bumperFront,bumperRear},
  metadata:{lengthM:length,widthM:d.width,heightM:d.height,wheelbaseM:d.wheelbase,trackWidthM:t*2,trackFrontM:t*2,trackRearM:rearTrack*2,wheelRadiusM:R,rideHeightM:floor},
  diagnostics:{issues:[...new Set(issues)],warnings:[...new Set(warnings)],floorContact,joins,seams:checkedSeams,bodyTriangles:triangles(parts),wheelTriangles:triangles(wp),panel:cloneJSON(surface.diagnostics)}};
}
