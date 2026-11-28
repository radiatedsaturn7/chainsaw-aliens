import {buildOpenWheelVintage,buildVintageBlower} from './vintage21.mjs';
import {sideDuctMask,cowlDuctMask,quarterDuctMask,fenderGillMask} from './sideDuct.mjs';
import * as T from '../../vendorBridge/three.js';
import {createEndSurface,fasciaMesh} from './fascia.mjs';
import {emitFlushHoodLids,emitIntegratedHoodMarkers} from './hoodLids.mjs';
import {makeOpenings,emitOpenings,exhaustMountOpenings,rearSculptOpening} from './optics.mjs';
import {createMasterSide,buildPanelGap} from './seams.mjs';
import {buildCabin} from './cabin9.mjs';
import {buildStructure} from './structure9.mjs';
import {buildAero} from './aero9.mjs';
import {buildRoofRails,buildUtilitySuspension,buildRearSpare,buildUtilityBumper} from './utility9.mjs';
import {buildWheels,rearWheelDimensions} from './wheels9.mjs';
import {evalFormula,compileFormula} from './formula9.mjs';
import {normalizeVehicle,SEAM_KEYS,getSideSettings,evaluateInteriorPatch,math} from './genome.mjs';
const {mix,clamp,buildFender}=math;
const RAD=Math.PI/180;
const UP_PATCH=(g,k,z,u,z0,z1)=>evaluateInteriorPatch(g.surfaces[k].points,clamp((z-z0)/(z1-z0)),clamp(u));
const bell=(x)=>Math.sin(Math.PI*clamp(x));
const lerp3=(a,b,t)=>a.map((e,i)=>mix(e,b[i],t));
const cloneJSON=x=>structuredClone(x);
const curvePoints=(fn,n=26)=>Array.from({length:n+1},(_,i)=>fn(i/n));
function adaptiveStations(fn,{lod=false,compact=0}={}){
 const out=[0],error=compact?[0,.012,.015,.024][compact]:lod?.0045:.0013;
 function span(a,b,depth){
  const m=(a+b)/2;
  const dist=Math.max(...[0,.35,.59,.82,1].map(v=>{
   const A=fn(a,v),B=fn(b,v),M=fn(m,v);
   return Math.hypot(...M.map((x,k)=>x-(A[k]+B[k])*.5));
  }));
  if(depth<(compact===3?2:3)||(depth<(compact?[0,5,5,4][compact]:lod?6:7)&&dist>error)){span(a,m,depth+1);span(m,b,depth+1);}
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
// Trace the sampled skin, not a second independently tessellated curve.
// Each rail belongs to a panel: never bridge the intentional seam cut.
function archHemRails(rails,min,max){
 const result=[];
 for(const rail of rails){
  const clipped=[];
  for(let i=1;i<rail.length;i++){
   const a=rail[i-1],b=rail[i],lo=Math.max(min,a.z),hi=Math.min(max,b.z);
   if(hi-lo<1e-8)continue;
   const sample=z=>({z,p:lerp3(a.p,b.p,(z-a.z)/(b.z-a.z))});
   if(!clipped.length)clipped.push(sample(lo));
   clipped.push(sample(hi));
  }
  if(clipped.length>1)result.push(clipped);
 }
 return result;
}
function sampleLowerRail(rails,z){
 for(const rail of rails){
  if(z<rail[0].z-1e-9||z>rail.at(-1).z+1e-9)continue;
  const i=rail.findIndex(r=>r.z>=z-1e-9);
  if(i===0)return rail[0].p.slice();
  if(i<0)return rail.at(-1).p.slice();
  const a=rail[i-1],b=rail[i];
  return lerp3(a.p,b.p,clamp((z-a.z)/(b.z-a.z)));
 }
 return null;
}
function readLowerRail(geometry,n,down,zAt){
 const p=geometry.getAttribute('position'),out=[];
 for(let i=0;i<=n;i++){
  const j=i*(down+1)+down;
  out.push({z:zAt(i),p:[p.getX(j),p.getY(j),p.getZ(j)]});
 }
 return out;
}
function box(w,h,l){return new T.BoxGeometry(w,h,l);}
function ellipsoid(w,h,l){return new T.SphereGeometry(1,16,10).scale(w/2,h/2,l/2);}
function geometryBounds(geo){geo.computeBoundingBox();return geo.boundingBox;}
function addModelPart(out,component,material,geo,p=null,rotation=null){
 if(rotation){const [x,y,z]=rotation;geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(x,y,z)));}
 if(p)geo.translate(...p);
 out.push({component,material,geometry:geo});return geo;
}
export const disposeDesign=design=>{for(const p of [...design.parts,...design.wheelParts,...(design.rearWheelParts??[])])p.geometry.dispose();};
export function generateVehicle(input,{quality='preview',compact=0}={}){
 const slim=compact>0,small=(ordinary,...steps)=>slim?steps[compact-1]:ordinary;
 const g=normalizeVehicle(input),d=g.dimensions,c=g.components,G=g.constraints.gap*.5;
 const parts=[],issues=[],warnings=[], joins=[],features=[],seamChecks=[],masters={},lowerPanelRails={},glassSides={};
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
 const rearFit=rearWheelDimensions(d), staggered=d.rearTireWidthOffset!==0||d.rearRimRatioOffset!==0||d.rearWheelRadiusDelta!==0;
 const rearTrack=Math.min(X-rearFit.tireWidth/2-d.archReserve,t+d.rearTrackBias*.5);
 if(t*2<1.2&&!g.body.openWheelShell){issues.push('Track below the runtime suspension envelope.');}

 if(floor>R-.03)warnings.push('Rocker sits above the hub; this is an elevated stance.');
 const hatchUpright=g.construction.cabin.rearHatchUpright;
 const targaBulk=c.roof.type==='targa fabric'?g.construction.cabin.targaRearBulkhead:0;
 const functionalTowers=g.construction.cabin.functionalTailTowers&&g.construction.cabin.wagonTallTail>.18&&hatchUpright>0&&!g.construction.cabin.rearHatchFold&&c.roof.type!=='roadster open';
 const hatchLamps=g.construction.cabin.rearHatchFold&&c.roof.type!=='roadster open'?g.construction.cabin.hatchEdgeLamps:0;
 const seamSpan=(end,overhang)=>Math.min(overhang*.69,g.fascia[end].bumperStation===.43?Math.min(overhang*.49,.43):g.fascia[end].bumperStation);
 const bumperFront=Lf-seamSpan('front',d.front),bumperRear=Lr+seamSpan('rear',d.rear);
 const wide=clamp(d.box),zC=(Lf+Lr)*.5+length*d.cabin;
 let cabinFront=zC+length*(d.cabinLength/2-d.hood),cabinRear=zC-length*(d.cabinLength/2-d.trunk);
 cabinFront=clamp(cabinFront,Lr+.9,Lf-.53);cabinRear=clamp(cabinRear-g.construction.cabin.rearPillarFoot-.22*hatchUpright,Math.max(Lr+(g.construction.cabin.rearPillarFoot?.40:.50)-.22*hatchUpright,hatchUpright?bumperRear+.025:-Infinity),cabinFront-1.52);
 const doorFront=clamp(cabinFront+.12,-.15,L-.26),doorRear=clamp(cabinRear-.17,-L+.23,doorFront-.65);
 const asymDoors=c.doors.type==='three door right';
 const halfDoors=c.doors.type==='four door'&&g.construction.cabin.rearHalfDoors;
 // The game chassis uses signed +X right. On the asymmetric layout only
 // that side receives the second leaf and a station closer to the rear.
 const oneDoor=[doorRear,doorFront],twoDoors=[doorRear,mix(doorRear,doorFront,halfDoors?.287:asymDoors?.385:.47),doorFront];
 const doorSplits=s=>c.doors.type==='four door'||asymDoors&&s>0?twoDoors:oneDoor;
 const layerHandles=(q,skip)=>q.slice(1).map((z,i)=>mix(q[i],z,.26)).slice(skip?1:0);
 const handlesL=layerHandles(doorSplits(-1),halfDoors),handlesR=layerHandles(doorSplits(1),asymDoors||halfDoors);
 const handleStations=s=>s>0?handlesR:handlesL;
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
 const nominalRoofFront=mix(cabinFront,doorRear,.37+.10*c.glass.shape-extension);
 const roofFront=canopy.cargoPanel?clamp(cabinFront-.48,cabinRear+.8,cabinFront-.18):canopy.frontScreenRake?clamp(nominalRoofFront-canopy.frontScreenRake,cabinRear+.48,cabinFront-.14):nominalRoofFront;
 const rearFraction=(g.family==='fastback'?.45:.22+.10*c.glass.shape)-extension;
 const rearDatum=mix(cabinRear,doorFront,rearFraction);
 const roofRear=hatchUpright&&canopy.rearHatchRoofSetback>0?clamp(cabinRear+canopy.rearHatchRoofSetback,cabinRear+.054,roofFront-.34):canopy.rearPillarFoot||canopy.rearRoofShift||hatchUpright||targaBulk?clamp(rearDatum+canopy.rearPillarFoot*(1-rearFraction)-canopy.rearRoofShift-.38*hatchUpright-.24*targaBulk,cabinRear+mix(.18,.078,hatchUpright),roofFront-.34):rearDatum;
 const nose=B-(.14+.10*(1-wide))*c.frontBumper.depth,deck=B-(c.trunk.type==='fastback'?.13:.065)*c.rearBumper.depth;
 const standardY=z=>z>cabinFront?mix(B,nose,((z-cabinFront)/(Lf-cabinFront))**1.4):z<cabinRear?mix(B,deck,((cabinRear-z)/(cabinRear-Lr))**1.38):B;
 const vintage=g.body.vintageFenders,cycles=g.body.cycleGuardPull;
 const baseSkinY=z=>vintage
  ?standardY(z)-vintage*.132*clamp((Math.abs(z)-L*.43)/Math.max(.29,(z>0?Lf:-Lr)-L*.43))**2.3
  :standardY(z);
 const prototypeFenderRise=g.body.prototypeFenderRise;
 const skinY=prototypeFenderRise?z=>{
  // The shared side/top rail crowns over each tire and fades to the
  // unmodified sill between axles, allowing a low canopy and valances.
  const t=clamp(1-Math.abs(Math.abs(z)-L)/.635);
  return baseSkinY(z)+prototypeFenderRise*unitSmooth(t);
 }:baseSkinY;
 const regionalBox=z=>clamp(wide+(z>0?d.frontBox:d.rearBox)*clamp(Math.abs(z)/L));
 function skinX(z){const noseT=clamp((Math.abs(z-(Lf+Lr)*.5)/(.5*length)-.70)/.30);let plain=X*(1-(.058+.13*(1-regionalBox(z)))*noseT**2);
  if(g.body.pickupBedDepth&&g.body.pickupBedStep&&z<cabinRear&&z>bumperRear){
   // Step the cargo-box shell, not the wheel, aft seam, or cab. Fade at
   // seams and preserve the envelope across the rear wheel arch shoulders.
   const step=(lo,hi,v)=>{const t=clamp((v-lo)/Math.max(.001,hi-lo));return t*t*(3-2*t);};
   const edge=step(0,.20,cabinRear-z)*step(0,.19,z-bumperRear);
   const offArch=step(.25,.75,Math.abs(z+L));
   plain-=g.body.pickupBedStep*edge*offArch;
  }
  if(cycles){
   // Draw in the tub at both axle stations. The independent wheel guards
   // remain centered on the same suspension axes and do not alter track.
   const envelope=Math.exp(-((Math.abs(Math.abs(z)-L)/.47)**2));
   plain-=cycles*(.48+.52*envelope);
  }
  if(g.body.vintageBlower){
   // The external wings keep their stock tire-centered charts, but the
   // tapering bonnet/body over the main frame leaves a running-board gap.
   const bonnet=unitSmooth(clamp((z-cabinFront+.15)/Math.max(.28,Lf-cabinFront+.15)));
   plain-=g.body.vintageBlower*(.068+.145*bonnet);
  }
  if(!vintage)return plain;
  const taper=clamp((Math.abs(z)-L*.86)/Math.max(.28,(z>0?Lf:-Lr)-L*.86));
  return plain-vintage*.17*taper**1.55;}
 const lipHeight=(z,side)=>{
  const ax=z>0?L:-L,dist=Math.abs(z-ax),a0=archData(ax,side);
  if(dist>=a0.fore)return floor;
  const s=dist/a0.fore,a=clamp((1-s)/g.body.archFootBlend),curved=R+a0.upper*Math.sqrt(Math.max(0,1-s*s));
  if(ax<0&&g.body.rearWheelSkirt){
   // Lower the exterior opening without altering the original arch radius
   // used by inner liners or suspension; the stamped paint remains one skin.
   const top=Math.max(floor+.025,Math.min(curved,R*.91));
   return mix(floor,mix(curved,top,g.body.rearWheelSkirt),a*a*(3-2*a));
  }
  return mix(floor,curved,a*a*(3-2*a));
 };
 for(const [component,axle] of [['frontFenders',L],['rearFenders',-L]]){
  const {fore,upper}=archData(axle);
  for(const trial of [-.55,-.30,0,.30,.55]){
   const z=axle+fore*trial,needed=R+upper*Math.sqrt(1-trial*trial);
   if(skinY(z)-needed<.025&&!g.body.openWheelShell){issues.push('Beltline intersects the '+(axle>0?'front':'rear')+' wheel opening; raise the beltline or fit smaller tires.');break;}
  }
 }
 const surface=buildFender(g.surfaces.frontFenders,{uSteps:quality==='export'?36:23,vSteps:quality==='export'?20:13,lipSteps:4});
 if(!surface.diagnostics.valid)issues.push(...surface.diagnostics.issues.map(s=>'Front fender: '+s));
 const frontPanelSamples=Array.from({length:21},(_,i)=>Array.from({length:11},(_,j)=>surface.eval(i/20,j/10)));
 const panelSample=(u,v)=>{const a=clamp(u)*20,b=clamp(v)*10,i=Math.min(19,Math.floor(a)),j=Math.min(9,Math.floor(b));return lerp3(lerp3(frontPanelSamples[i][j],frontPanelSamples[i+1][j],a-i),lerp3(frontPanelSamples[i][j+1],frontPanelSamples[i+1][j+1],a-i),b-j);};
 const {doorStamp,doorStampHeight,doorStampSweep,doorStampFade,doorStampWidth,doorStampFront,doorStampRear}=g.body;
 const stampStation=z=>clamp((z-(doorRear-doorStampRear))/(doorFront-doorRear+doorStampFront+doorStampRear));
 const stampLine=z=>doorStampHeight+doorStampSweep*(stampStation(z)-.5);
 const stampFade=z=>unitSmooth(clamp(stampStation(z)/doorStampFade))*unitSmooth(clamp((1-stampStation(z))/doorStampFade));
 // Visual side-sill clearance: the true side and rocker follow the same rail.
 // Fades into both arch feet and never changes the wheel or suspension datum.
 function sillLift(z){
  if(!g.body.sillRelief)return 0;
  const extent=L-radius-.010;
  if(Math.abs(z)>=extent||extent<=.01)return 0;
  const u=(z+extent)/(extent*2),h=unitSmooth(clamp(u/.22))*unitSmooth(clamp((1-u)/.23));
  return g.body.sillRelief*h*(.60+.40*Math.sin(Math.PI*u)**.72);
 }
 function skinPoint(z,v,sgn,comp){
  const side=skinX(z), localBox=regionalBox(z), bottom=Math.min(skinY(z)-.022,lipHeight(z,sgn)+sillLift(z)),archAt=z>0?L:-L,
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
  if(!cycles)x=mix(x,Math.max(x,(archAt<0&&staggered?rearTrack+rearFit.tireWidth/2:t+d.tireWidth/2)+.018*(.6+.4*flareScale)),edgePull);
  let y=mix(skinY(z),bottom,v);
  if(vintage){
   // Separate upright tub from the bolt-on fender envelope. The rounded
   // flare fades into the arch hem rather than stopping at door stations.
   const near=Math.exp(-(((z-archAt)/(g.dimensions.diameter*.76))**2));
   x+=vintage*(.077*near*Math.sin(Math.PI*v)**1.82-.040*(1-near)*Math.sin(Math.PI*v)**1.32);
  }
  if(comp==='frontFenders'){
   const u=clamp((z-doorFront)/(bumperFront-doorFront)),q=panelSample(u,v),edge=lerp3(panelSample(u,0),panelSample(u,1),v);
   if(g.body.fenderGill)x-=g.body.fenderGillDepth*fenderGillMask(g.body,u,v);
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
   const p=(v-stampLine(z))/doorStampWidth;
   x+=doorStamp*stampFade(z)*(Math.exp(-p*p)-.48*Math.exp(-((p+.99)**2)));
  }
  if(comp==='rearFenders'&&g.body.quarterDuct)
   x-=g.body.quarterDuctDepth*quarterDuctMask(g.body,(z-bumperRear)/Math.max(.11,doorRear-bumperRear),v);
  if(comp==='doors'){
   if(g.body.sideDuct)x-=g.body.sideDuctDepth*sideDuctMask(g.body,(z-doorRear)/(doorFront-doorRear),v);
   for(const hz of handleStations(sgn))x-=(.002+.013*g.body.handleRecess)*Math.exp(-((v-.22)**2)/.0034-((z-hz)**2)/.008);
  }
  x+=stamped(z,v,sgn)-sillLift(z)*.68*v**3;
  if(archAt<0&&g.body.rearWheelSkirt){
   const rr=archData(-L,sgn).fore,q=clamp((rr-Math.abs(z+L))/.025);
   // Keep the outer skin clear of the exact rear tire sidewall, including
   // the inside return at the opening's lower perimeter.
   const minX=rearTrack+rearFit.tireWidth*.5+.018;
   x=mix(x,Math.max(x,minX),unitSmooth(q));
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
 const insetLampPod=(z,u)=>{
  if(!hoodDesign.lampPodRise||hoodDesign.lampLids!=='inset')return 0;
  const length=Math.max(.1,bumperFront-cabinFront),t=clamp((z-cabinFront)/length),a=Math.abs(2*u-1);
  const half=clamp(hoodDesign.lidLength/length*.5,.044,.22);
  const lid=1-clamp(hoodDesign.lidSetback/length+half,.045+half,.92-half);
  const along=Math.exp(-(((t-(lid-.18))/.39)**2));
  const across=Math.exp(-(((a-hoodDesign.lidSpread*2)/.23)**2));
  // Raise the shoulder just behind the oval. The bowl, ring and cover all
  // sample this surface, and its lift fades to zero at shared panel rails.
  const fades=unitSmooth(clamp(t/.16))*unitSmooth(clamp((1-t)/.14))*unitSmooth(clamp((1-a)/.14));
  return hoodDesign.lampPodRise*along*across*fades;
 };
 const originalHood=(z,v)=>{const p=top(z,v,mix(hoodC,.019*c.frontBumper.size,clamp((z-(bumperFront-.28))/.28)**2),'hood');
  p[1]+=UP_PATCH(g,'hood',z,v,cabinFront,bumperFront)+hoodShoulder(z,v)+insetLampPod(z,v);return p;};
 const trunkC=(c.trunk.type==='fastback'?.034:c.trunk.type==='ducktail'?.064:.047)*(.68+c.trunk.shape)*c.trunk.depth;
 const originalTrunk=(z,v)=>{const p=top(z,v,mix(trunkC,.019*c.rearBumper.size,clamp((bumperRear+.28-z)/.28)**2),'trunk');
  const rise=canopy.rearDeckButtresses;
  if(rise>0){
   // Shape the existing deck sheet to avoid overlapping panels and retain the side join.
   const t=clamp((z-bumperRear)/Math.max(.10,cabinRear-bumperRear)),x=Math.abs(v*2-1);
   const bell=Math.exp(-(((x-.46)/.21)**2))*(1-unitSmooth(clamp((x-.69)/.31)));
   p[1]+=rise*unitSmooth(clamp(t/.86))*bell;
  }
  if(canopy.raisedEngineLid){
   const t=clamp((z-bumperRear)/Math.max(.10,cabinRear-bumperRear)),u=Math.abs(2*v-1);
   const longitudinal=unitSmooth(clamp((t-.11)/.22))*unitSmooth(clamp((.94-t)/.19));
   const shoulders=unitSmooth(clamp((u-.08)/.19))*unitSmooth(clamp((.83-u)/.24));
   p[1]+=.071*canopy.raisedEngineLid*longitudinal*shoulders;
  }
  p[1]+=UP_PATCH(g,'trunk',z,v,bumperRear,cabinRear);return p;};
 const ends={},fascia={},lampMounts={},exhaustMounts=new Map();
 const runtime=['drive','lod','opponent'].includes(quality),lod=runtime;
 const across=small(quality==='export'?42:quality==='opponent'?18:lod?22:32,16,16,12),down=small(quality==='export'?16:quality==='opponent'?7:lod?9:13,6,6,6),along=small(quality==='export'?17:lod?8:12,5,5,4);
 const hoodPoint=(z,u)=>ends.front.upperPanel(z,u);
 const trunkPoint=(z,u)=>ends.rear.upperPanel(z,u);
 for(const end of ['front','rear']){
  const front=end==='front',sign=front?1:-1,name=front?'frontBumper':'rearBumper',
   fender=front?'frontFenders':'rearFenders',tip=(front?Lf:Lr)-sign*G,upper=g.seams[front?'hoodSeam':'trunkSeam'],
   seam=(front?bumperFront:bumperRear)+upper.offset;
  const surf=createEndSurface({settings:g.fascia[end],end,tip,seam,cabin:front?cabinFront:cabinRear,
   archEnd:L+Math.max(archData(sign*L,-1).fore,archData(sign*L,1).fore),floor,deckAt:front?originalHood:originalTrunk,
   sideAt:(z,v,s)=>skinPoint(z,v,s,name),bumper:c[name],upper,hoodFairing:front?hoodDesign.noseFairing:0,hoodCrown:front?hoodDesign.crossCrown:0});
  ends[end]=surf;
  // Period bolt-on driving lights share the same runtime headlight material.
  // This optional rack never trims the fascia or replaces its original lights.
  const count=front?Math.round(g.fascia.front.rallyAuxiliary):0;
  if(count){
   const radius=Math.min(.087,d.width*.221/count),step=radius*2.27;
   const bar=[0,-Infinity,-Infinity];
   for(let n=0;n<count;n++){
    const x=(n-(count-1)*.5)*step,u=.5+x/d.width;
    const [,y,z]=surf.face(u,.27),p=[x,y+radius*.61,z+.028];
    const seg=small(24,14,12,8),cyl=(top,bottom,depth)=>new T.CylinderGeometry(top,bottom,depth,seg,1,false).rotateX(Math.PI/2);
    bar[1]=Math.max(bar[1],p[1]-radius*.82);
    bar[2]=Math.max(bar[2],z-.025);
    put('fogs','trim',cyl(radius*.95,radius*.68,.096),p);
    put('fogs','chrome',cyl(radius,radius,.014),[x,p[1],p[2]+.047]);
    put('fogs','head',cyl(radius*.80,radius*.77,.010),[x,p[1],p[2]+.056]);
   }
   put('fogs','trim',new T.BoxGeometry(Math.max(step,(count-1)*step+radius*.8),radius*.23,.048),bar);
  }
  const originalOpenings=makeOpenings({end,g,face:surf.face,segments:small(quality==='opponent'?14:lod?18:quality==='export'?32:24,13,12,9)});
  const openings=!front&&(hatchLamps||functionalTowers)?originalOpenings.filter(o=>o.kind!=='lamp'):originalOpenings;
  if(!front){
   const pockets=exhaustMountOpenings(g,surf.face,openings);
   openings.push(...pockets);
   const sculpture=rearSculptOpening(g,openings);
   if(sculpture)openings.push(sculpture);
   else if(g.fascia.rear.rearSculptDepth)warnings.push('Swept rear bridge cannot clear existing fascia openings.');
   if(g.construction.exhaust.some(q=>q.fasciaHeight&&!pockets.some(p=>p.opt.outlet===q.id)))warnings.push('Raised exhaust could not fit the fascia; floor mount retained.');
  }
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
   if(o.kind==='sculpted-trim')for(const key of ['top','bottom'])o.opt[key]=o.opt[key].map(([u,v])=>[toAtlas(u),v]);
   o.center=[toAtlas(cx),cy];if(o.width)o.width*=(1-2*band);
  }
  if(!front)for(const o of openings.filter(o=>o.kind==='exhaust-pocket')){
   const v=o.center[1];
   exhaustMounts.set(o.opt.outlet+':'+o.opt.sign,x=>{
    let a=wrapped?band:0,b=wrapped?1-band:1;
    for(let i=0;i<24;i++){const t=(a+b)*.5;if(chart(t,v)[0]>x)b=t;else a=t;}
    return chart((a+b)*.5,v);
   });
  }
  const shellMaterial=g.fascia[end].insertBand||g.fascia[end].lowerInsert?'fascia-'+end:'paint';
  const pods=front&&g.body.raisedLampPods;
  const suppressHeadlamps=front&&(hoodDesign.lampLids==='inset'||pods);
  const faceOpenings=suppressHeadlamps?openings.filter(o=>o.kind!=='lamp'):openings;
  const shell=put(name,shellMaterial,fasciaMesh(chart,faceOpenings,{rear:!front,across,down,columns,tolerance:small(wrapped?(lod?.097:.067):lod?.155:quality==='export'?.092:.115,.163,.178,.216)}));
  const faceColumns=columns?columns.length-1:across;
  for(const opening of faceOpenings){
   const right=opening.center[0]>.5,p=opening.outline.map(uv=>chart(...uv)),letter=right?'R':'L';
   const id=opening.kind==='lamp'?end+'-lamp-'+letter+(opening.opt.secondaryLamp?'-inner':''):opening.id;
   const xSide=right?1:-1;
   features.push(guideFeature(id,opening.kind==='lamp'?'lamp':'opening',opening.kind==='lamp'?(front?'Headlight outline':'Taillight outline')+' · '+letter:opening.kind==='deck'?'Trunk perimeter':opening.component==='grille'?'Grille perimeter':opening.kind==='fog'?'Fog-light perimeter':'Intake / valance perimeter',opening.component,p,
    {end,side:letter,closed:true,view:end,axis:0,scale:.18*xSide,anchor:p.reduce((a,b)=>xSide*b[0]>xSide*a[0]?b:a)}));
  }
  features.push(guideFeature(end+'-silhouette','silhouette',front?'Nose silhouette':'Tail silhouette',name,curvePoints(u=>surf.face(u,.13)),{end,view:'top',axis:2,scale:sign*.28}));
  const mounted=emitOpenings({end,openings,surface:chart,put,lod,compact,spatialDepth:wrapped,shellMaterial,suppressHeadlamps});
  Object.assign(lampMounts,mounted.mounts);
  if(pods){
   // Period sealed beams on posts use a separate round face chart and the
   // same active optics/material/mount path as an integrated headlight.
   const r=(g.optics.front.physicalDiameter||.14)*.5;
   for(const source of openings.filter(o=>o.kind==='lamp')){
    const s=source.side;
    const x=s*(t-.17*d.width),z=Lf-.13;
    const y=originalHood(z,clamp(x/X*.5+.5))[1]+pods;
    const forward=z+r*.59;
    const podFace=(u,v)=>[x+(u-.5)*r*2.2,y-(v-.5)*r*2.2,forward];
    const o={...source,center:[.5,.5],width:.88,height:.88,
     outline:curvePoints(h=>[.5+.44*Math.cos(h*2*Math.PI),.5+.44*Math.sin(h*2*Math.PI)],small(24,17,15,13)).slice(0,-1),
     opt:{...source.opt,layout:'projector',sideWrap:0,protrusion:.1}};
    const h=pods+.063;
    const post=new T.CylinderGeometry(r*.18,r*.22,h,small(10,7,7,6));
    put('headlights','chrome',post,[x,y-h*.5-.017,z-.022]);
    const cup=new T.SphereGeometry(1,small(18,12,12,10),small(11,7,6,5)).scale(r*1.09,r*1.09,r*.71);
    put('headlights','paint',cup,[x,y,z-.058]);
    Object.assign(lampMounts,emitOpenings({end,openings:[o],surface:podFace,put,lod,compact}).mounts);
   }
  }
  if(front&&g.fascia.front.pairedLampSurround&&g.optics.front.housing==='dual-round'){
   // Derive both chrome bezels from the corresponding actual twin apertures.
   // Proud polished centers with body-level returns; no overlap with either lens.
   for(const side of [-1,1]){
    const eyes=faceOpenings.filter(x=>x.kind==='lamp'&&Math.sign(x.center[0]-.5)===side);
    if(eyes.length!==2)continue;
    const uv=eyes.flatMap(x=>x.outline);
    const bounds=i=>[Math.min(...uv.map(p=>p[i])),Math.max(...uv.map(p=>p[i]))];
    const [l,r]=bounds(0),[h,b]=bounds(1),cx=(l+r)/2,cy=(h+b)/2;
    const rx=Math.min((r-l)*.66,cx-.022,.48-Math.abs(cx-.5));
    const ry=Math.min((b-h)*.76,cy-.045,.59-cy);
    if(rx<.02||ry<.03)continue;
    const ring=patch(small(30,26,24,22),3,(u,v)=>{
     const t=u*Math.PI*2,co=Math.cos(t),si=Math.sin(t),rad=.91+v*.14;
     const a=.74+.09*(side*co);
     const q=chart(cx+rad*rx*Math.sign(co)*Math.abs(co)**a,cy+rad*ry*Math.sign(si)*Math.abs(si)**.72);
     q[2]+=.001+.024*Math.sin(Math.PI*v);
     return q;
    },false);
    ring.userData.constructionRole='paired chrome fascia surround';
    put(name,'chrome',ring);
   }
  }
  const {chromeBumperBand:bandDepth,chromeBandHeight,chromeBandPosition}=g.fascia[end];
  if(bandDepth>0){
   // A formed metal crossbar follows the fascia envelope, including a
   // tighter-radius return at its corners. Its sides vanish into the skin.
   const hw=.474, steps=small(lod?28:40,20,18,14);
   const beam=patch(steps,4,(u,v)=>{
    const inboard=Math.min(1,Math.min(u,1-u)*10);
    const bend=Math.sin(Math.PI*v)**.56;
    const center=chromeBandPosition+.046*(2*u-1)**4;
    const station=center+(v-.5)*chromeBandHeight/Math.max(.40,B-floor);
    const q=chart(.5+(u*2-1)*(wrapped?.426:hw),clamp(station));
    q[2]+=sign*(bandDepth*inboard*(.48+.52*bend)-.003);
    return q;
   },!front);
   beam.userData.constructionRole='formed chrome bumper / separate component';
   put(name,'chrome',beam);
  }
  issues.push(...(mounted.issues??[]));
  fascia[end]={guides:surf.guides,trimArea:shell.userData.trimArea,wrapped,
   samples:[0,.15,.30,.45,.5,.55,.70,.85,1].map(u=>surf.face(u,.13)),
   openings:faceOpenings.map(({id,component,outline})=>({id,component,outline:cloneJSON(outline)}))};
  const lamp=faceOpenings.find(x=>x.kind==='lamp'&&x.center[0]>.5);
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
 if(g.body.upperHoodMarkers>0&&(!g.body.hoodMarkerRecess||hoodDesign.lampLids!=='off'||g.body.cowlDuct)){
  // Trace both bonded upper marker housings on the hood itself. They
  // follow shoulder and nose edits without replacing the lower main beam.
  const length=g.body.upperHoodMarkers, station=hoodEdge-.013;
  for(const side of [-1,1]){
   const skin=(t,v,solid)=>{const z=station-length*t;
    const q=Math.max(0,1-(2*t-1)**2)**.66;
    const center=.855-.042*t+.018*Math.sin(Math.PI*t);
    const w=(.009+.025*q)*(solid?1:.80);
    const u=side>0?center+(2*v-1)*w:1-center-(2*v-1)*w;
    const pt=hoodPoint(z,u);
    return [pt[0],pt[1]+(solid?.0023:.0056),pt[2]];
   };
   put('headlights','seamDark',patch(small(12,8,7,6),3,(t,v)=>skin(t,v,true),side<0));
   put('headlights',side>0?'signalR':'signalL',patch(small(10,7,6,5),2,(t,v)=>skin(.036+.92*t,v,false),side<0));
   put('headlights','opticCover',patch(small(10,7,6,5),2,(t,v)=>{const q=skin(.04+.91*t,v,false);q[1]+=.001;return q;},side<0));
  }
 }

 const coverPoint=(raw,edge,settings,z,u)=>{
  const p=raw(z,u);p[1]-=settings.flush*.5*clamp(1-Math.abs(edge-z)/.07)**3;return p;
 };
 const hoodStart=cabinFront+G,hoodAlong=small(lod?8:14,5,4,4);
 const hoodCover=(z,u)=>coverPoint(hoodPoint,hoodEdge,g.seams.hoodSeam,z,u);
 if(hoodDesign.lampLids!=='off'){
  const bounds=emitFlushHoodLids({cover:(u,v)=>hoodCover(mix(hoodEdge,hoodStart,v),u),hoodLength:hoodEdge-hoodStart,
   settings:hoodDesign,across,along:hoodAlong,compact,put,lampMounts});
  if(Math.abs(bounds.mesh-bounds.expected)>1e-6||bounds.unmatched)issues.push('Overlapping or invalid hood cover cutouts.');
 }else if(g.body.upperHoodMarkers&&g.body.hoodMarkerRecess&&!g.body.cowlDuct){
  const bounds=emitIntegratedHoodMarkers({cover:(u,v)=>hoodCover(mix(hoodEdge,hoodStart,v),u),hoodLength:hoodEdge-hoodStart,
   length:g.body.upperHoodMarkers,depth:g.body.hoodMarkerRecess,across,along:hoodAlong,compact,put,
   material:hoodDesign.bonnetStripes?'bonnet-stripes':hoodDesign.contrastBonnet?'roofPaint':'paint'});
  if(Math.abs(bounds.mesh-bounds.expected)>1e-6||bounds.unmatched)issues.push('Overlapping or invalid hood marker cutouts.');
 }else if(g.body.cowlDuct)sheet('hood','cowl-duct',hoodStart,hoodEdge,(z,u)=>{
  const p=hoodCover(z,u);p[1]-=g.body.cowlDuctDepth*cowlDuctMask(g.body,(z-hoodStart)/(hoodEdge-hoodStart),u);return p;
 },hoodAlong,across);
 else sheet('hood',hoodDesign.bonnetStripes?'bonnet-stripes':hoodDesign.contrastBonnet?'roofPaint':'paint',hoodStart,hoodEdge,hoodCover,hoodAlong,across);
 const trunkCover=(z,u)=>coverPoint(trunkPoint,trunkEdge,g.seams.trunkSeam,z,u);
 const bedEnd=cabinRear-G, pickupDepth=g.body.pickupBedDepth;
 const emitPickupSails=(base,za,zb,tag,material)=>{
  for(const s of [-1,1]){
   const a=.5+s*.365,b=.5+s*.489;
   const fore=bedEnd+.021,aft=mix(za,zb,.18);
   const foot=(z,u)=>{const p=base(clamp(z,trunkEdge,bedEnd),u);p[1]-=.024;return p;};
   const surf=(u,v)=>{
    const z=mix(aft,fore,u),p=foot(z,mix(a,b,v)),rise=g.body.pickupSailRise*u**1.68;
    p[1]+=rise*(.84+.16*Math.sin(Math.PI*v));
    p[2]+=clamp(roofRear-bedEnd-.024,.04,.37)*u**3.8;
    p[0]*=1-.138*u**2;
    return p;
   };
   tag(material,patch(12,6,surf,s<0),'pickup molded sail buttress');
   for(const [v,flip] of [[0,s<0],[1,s>0]])tag(material,patch(12,2,(u,h)=>lerp3(foot(mix(aft,fore,u),mix(a,b,v)),surf(u,v),h),flip),'pickup sail return');
   tag(material,patch(1,6,(h,v)=>lerp3(foot(fore,mix(a,b,v)),surf(1,v),h),s>0),'pickup sail cab-facing backing');
  }
 };
 let pickupWellCeiling=null;
 if(g.body.pickupBedCover&&bedEnd-trunkEdge>.45){
  const za=trunkEdge+.071,zb=bedEnd-.046,span=zb-za,e=.075;
  const tag=(mat,geo,name)=>{geo.userData.section=name;put('trunk',mat,geo);};
  const base=(z,u)=>trunkCover(z,u);
  for(const [a,b] of [[trunkEdge,za],[zb,bedEnd]])tag('paint',patch(2,across,(u,v)=>base(mix(a,b,u),v)),'pickup cover painted end rail');
  for(const [a,b] of [[0,e],[1-e,1]])tag('paint',patch(10,3,(u,v)=>base(mix(za,zb,u),mix(a,b,v))),'pickup cover painted outer rail');
  const sample=(z,u,back=false)=>{const p=base(z,u);p[1]+=back?-.004:.008;return p;};
  // Continuous dark backing closes every panel gap rather than exposing
  // the suspension or leaving a painted faux deck across the textured seam.
  tag('seamDark',patch(6,across,(u,v)=>sample(mix(za-.002,zb+.002,u),mix(e-.002,1-e+.002,v),true)),'pickup cover closed backing');
  for(let k=0;k<3;k++){
   const a=za+k*span/3+.0026,b=za+(k+1)*span/3-.0026;
   tag('trim',patch(5,across,(u,v)=>sample(mix(a,b,u),mix(e,1-e,v))),'pickup cover removable leaf');
  }
  pickupWellCeiling=(z,x)=>z<za||z>zb?Infinity:sample(z,.5,true)[1]-.018;
  if(g.body.pickupSailRise)emitPickupSails(base,za,zb,tag,'trim');
 }else if(pickupDepth>0&&bedEnd-trunkEdge>.45){
  const aft=trunkEdge+.087,fore=bedEnd-.067,l=.073,r=1-l,steps=small(18,10,9,7);
  const rim=(z,u)=>trunkCover(z,u);
  // A single open cargo well replaces the deck. Integral rails meet the
  // unchanged tailgate and cabin seams; the floor retains wheel housings.
  const bedMid=(aft+fore)/2, refY=rim(bedMid,.5)[1],baseY=Math.max(floor+.12,refY-pickupDepth);
  const bottom=(z,u)=>{
   const q=rim(z,u), arch=Math.max(0,1-((z+L)/(R+.075))**2);
   const bulge=unitSmooth(clamp((Math.abs(u-.5)-.235)/.138))*arch;
   return [q[0],baseY+Math.max(0,R*2+.067-baseY)*bulge,q[2]];
  };
  // Stock liner geometry is retained under the bed, and cannot protrude
  // through the painted tub where its suspension vault crosses the deck.
  pickupWellCeiling=(z,x)=>{
   if(z<aft||z>fore)return Infinity;
   let a=l,b=r;
   for(let i=0;i<10;i++){const m=(a+b)*.5;if(rim(z,m)[0]<x)a=m;else b=m;}
   return bottom(z,(a+b)*.5)[1]-.018;
  };
  const mark=(mat,geo)=>{geo.userData.section='pickup-bed';put('trunk',mat,geo);};
  const inside=g.body.pickupCompositeBed?'trim':'paint';
  for(const [z0,z1] of [[trunkEdge,aft],[fore,bedEnd]])for(const [u0,u1,n] of [[0,l,1],[l,r,across],[r,1,1]]){
   mark('paint',patch(1,n,(t,u)=>rim(mix(z0,z1,t),mix(u0,u1,u))));
  }
  for(const [a,b] of [[0,l],[r,1]])mark('paint',patch(steps,1,(t,u)=>rim(mix(aft,fore,t),mix(a,b,u))));
  mark(inside,patch(steps,across,(t,u)=>bottom(mix(aft,fore,t),mix(l,r,u))));
  for(const [u,flip] of [[l,false],[r,true]])mark(inside,patch(steps,1,(t,h)=>{
   const z=mix(aft,fore,t);return lerp3(rim(z,u),bottom(z,u),h);
  },flip));
  for(const [z,flip] of [[aft,true],[fore,false]])mark(inside,patch(across,1,(t,h)=>{
   const u=mix(l,r,t);return lerp3(rim(z,u),bottom(z,u),h);
  },flip));
  if(g.body.pickupSailRise)emitPickupSails(rim,aft,fore,(mat,geo,name)=>{
   geo.userData.section=name;put('trunk',mat,geo);
  },'paint');
 }else sheet('trunk',hoodDesign.deckStripes?'bonnet-stripes':'paint',trunkEdge,bedEnd,trunkCover,small(lod?8:14,5,4,4),across);
 if(canopy.raisedEngineLid&&pickupDepth===0&&bedEnd-trunkEdge>.16){
  const amount=canopy.raisedEngineLid;
  for(const side of [-1,1])for(let i=0;i<4;i++){
   const frac=.32+i*.118;
   const a=mix(.50,.89,amount),z=mix(trunkEdge,bedEnd,frac);
   const row=patch(1,small(9,6,5,4),(t,u)=>{
    const spread=mix(.12,.33,u)*a;
    const p=trunkCover(z+(.003+.011*amount)*t,.50+side*spread);
    p[1]+=.0028;
    return p;
   },side<0);
   row.userData.constructionRole='raised engine-deck louver';
   put('trunk','seamDark',row);
  }
 }
 for(const end of ['front','rear']){
  const front=end==='front',name=front?'hood':'trunk',k=front?'hoodSeam':'trunkSeam';
  const raw=front?hoodPoint:trunkPoint,settings=g.seams[k],sign=front?1:-1;
  const z=front?hoodEdge:trunkEdge;
  const edgeA=u=>coverPoint(raw,z,settings,z,u),edgeB=u=>{
   const p=ends[end].bridge(u,0);p[2]+=sign*settings.gap*.5;p[1]+=settings.flush*.5;return p;
  };
  const seam=buildPanelGap({edgeA,edgeB,settings,stations:across,quality:slim?'compact':'preview'});
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
  const letter=s>0?'R':'L',lowerRails=[],cuts=doorSplits(s);lowerPanelRails[s]=lowerRails;
  const slabs=[
   {key:'rearBumper',start:Lr,end:bumperRear,seamAfter:'rearFenderSeam'},
   {key:'rearFenders',start:bumperRear,end:doorRear,seamAfter:'rearDoorSeam'},
   ...cuts.slice(1).map((z,i)=>({key:'doors',start:cuts[i],end:z,seamAfter:i<cuts.length-2?'centerDoorSeam':'frontDoorSeam'})),
   {key:'frontFenders',start:doorFront,end:bumperFront,seamAfter:'frontFenderSeam'},
   {key:'frontBumper',start:bumperFront,end:Lf}
  ];
  for(const p of slabs)p.sample=(z,v)=>{
   const key=p.key,front=key.startsWith('front');
   if(key.endsWith('Bumper'))return ends[front?'front':'rear'].bumperSide(clamp((z-(front?p.start:p.end))/(front?p.end-p.start:p.start-p.end)),v,s);
   const raw=skinPoint(z,v,s,key);
   return key.endsWith('Fenders')?ends[front?'front':'rear'].quarter(z,v,s,raw):raw;
  };
  const master=createMasterSide({panels:slabs,settings:g.seams,gap:g.constraints.gap,side:s,stations:down,quality:slim?'compact':lod?'lod':quality});masters[s]=master;
  const claddingUV=geo=>{
   const uv=geo.attributes.uv, xyz=geo.attributes.position;
   for(let i=0;i<uv.count;i++)uv.setY(i,clamp((B-xyz.getY(i))/Math.max(.25,B-floor)));
   return geo;
  };
  for(let index=0;index<slabs.length;index++){
   const {key,start:a,end:b}=slabs[index],sampler=(u,v)=>master.panel(index,u,v);
   if(key==='frontBumper'||key==='rearBumper'){
    const front=key==='frontBumper',surf=ends[front?'front':'rear'],col=s<0?0:across,{shell,roll,trail,faceColumns}=surf.geometries;
    const fraction=trail/along;
    const face=patch(trail,down,(u,v)=>sampler(front?u*fraction:1-(1-u)*fraction,v),s<0);
    const side=put(key,g.body.lowerCladding?'lower-clad':'paint',g.body.lowerCladding?claddingUV(face):face);
    lowerRails.push(readLowerRail(side,trail,down,i=>mix(a,b,front?i/along:1-(trail-i)/along)));
    const tipIndex=front?trail:0, at=i=>front?i:trail-i;
    for(let i=0;i<=trail;i++)weldNormals([roll,i*(across+1)+col],[side,at(i)*(down+1)]);
    for(let j=1;j<=down;j++){
     const row=s>0?faceColumns+j:2*faceColumns+2*down-j;
     weldNormals([shell,row],[side,tipIndex*(down+1)+j]);
    }
   }else{
    const gill=key==='frontFenders'&&g.body.fenderGill;
    const baseStations=adaptiveStations(sampler,{lod,compact});
    const stations=gill?[...new Set([...baseStations,.054,.094,.155,.218,.256])].sort((a,b)=>a-b):baseStations;
    const duct=key==='doors'&&g.body.sideDuct,quarter=key==='rearFenders'&&g.body.quarterDuct;
    const doorUvs=[];
    const panel=patch(stations.length-1,down,(u,v)=>{
     const t=stations[Math.round(u*(stations.length-1))];
     if(gill){
      const row=Math.round(v*down),middle=Math.round((.277+g.body.fenderGillRake*(t-.155))*down);
      const center=.277+g.body.fenderGillRake*(t-.155);
      const near=Math.max(.05,Math.min(.85,center));
      const y=row===middle-1?near-.049:row===middle?near:row===middle+1?near+.049:v;
      // Avoid row inversion at distant stations and keep top/lower rails.
      const nearGill=(t>.038&&t<.275&&row>0&&row<down);
      doorUvs.push(t,nearGill?y:v);
      return sampler(t,nearGill?y:v);
     }
     if(!doorStamp||key!=='doors'){if(duct)doorUvs.push((mix(a,b,t)-doorRear)/(doorFront-doorRear),v);return sampler(t,v);}
     const q=stampLine(mix(a,b,t)),base=Math.round(q*down),row=clamp(base,2,down-2);
     const k=Math.round(v*down),wanted=k===row-1?q-.071*(doorStampWidth/.066):k===row?q-.007:k===row+1?q+.053*(doorStampWidth/.066):null;
     const fade=unitSmooth(clamp(t/.10))*unitSmooth(clamp((1-t)/.10));
     // Keep shared seam samples in place. Move only the neighboring rows,
     // enough to capture the crest and the return without extra triangles.
     const j=wanted===null?v:mix(v,clamp(wanted,Math.max(.025,(row-2)/down+.008),Math.min(.975,(row+2)/down-.008)),fade);
     if(duct)doorUvs.push((mix(a,b,t)-doorRear)/(doorFront-doorRear),j);
     return sampler(t,j);
    },s<0);
    lowerRails.push(readLowerRail(panel,stations.length-1,down,i=>mix(a,b,stations[i])));
    if(duct||gill)panel.setAttribute('uv',new T.Float32BufferAttribute(doorUvs,2));
    if(quarter){
     const uv=panel.attributes.uv;
     for(let i=0;i<uv.count;i++){
      const t=stations[Math.round(uv.getX(i)*(stations.length-1))];
      uv.setX(i,(mix(a,b,t)-bumperRear)/Math.max(.11,doorRear-bumperRear));
     }
    }
    const clad=g.body.lowerCladding&&!duct&&!quarter&&!gill;
    put(key,duct?'side-duct':quarter?'quarter-duct':gill?'fender-duct':clad?'lower-clad':'paint',clad?claddingUV(panel):panel);
   }
   if(g.body.sideRubStrip&&['rearFenders','doors','frontFenders'].includes(key)){
    // Use the same authored panel chart as body paint and seams. Roll the
    // plastic surface into the paint at the ends, retaining physical gaps.
    const step=small(12,8,7,6),margin=Math.min(.035,.012/(b-a));
    const band=patch(step,4,(u,v)=>{
     const z=mix(a,b,u),x=mix(margin,1-margin,u);
     // Invert the actual side chart to pin each sample to the skin. A
     // clamped arch/belt intersection follows the local top of the arch
     // instead of floating into it or poking through a door seam.
     const bottom=sampler(x,1)[1],top=sampler(x,0)[1],thickness=.016;
     const gold=g.body.periodGoldSide;
     const section=clamp((z-bumperRear)/(doorFront-bumperRear));
     const extra=gold?(1-section)**.78*.058:0;
     const target=skinY(z)-.101-.25*(g.body.sideRubStripHeight-.39);
     const y=clamp(target,Math.min(top,bottom+.011),top-.017)+(v-.5)*(thickness+extra);
     let lo=0,hi=1;
     for(let i=0;i<14;i++){const t=(lo+hi)*.5;if(sampler(x,t)[1]>y)lo=t;else hi=t;}
     const p=sampler(x,(lo+hi)*.5);
     p[0]+=s*(.002+.006*Math.sin(Math.PI*v))*(.28+.72*Math.sin(Math.PI*u)**.16);
     return p;
    },s<0);
    band.userData.constructionRole='side panel / rolled protective molding';
    put(key,g.body.periodGoldSide?'roofPaint':'trim',band);
   }
   joins.push({a,b,component:key,side:s});
  }
  if(g.body.periodTailFin){
   // Swept stamped steel quarter married to the authored outer deck rail.
   // Closed underside deliberately sits below the deck; there is no slit
   // or detached trim at the root. Shape rises outboard near the rear tip.
   const back=Lr+.045,fwd=Math.min(doorRear-.065,-L+.31);
   if(fwd>back+.11){
    const fin=(u,v)=>{
     const z=mix(back,fwd,u),a=v*Math.PI*2,sc=Math.sin(a);
     const pin=.24+.76*Math.sin(Math.PI*u)**.45;
     const y=g.body.periodTailFin*(1-u)**1.35;
     const p=skinPoint(z,0,s,'rearFenders');
     const bias=-(.064+.023*u);
     return [p[0]+s*(bias+Math.cos(a)*(.018+.028*u)*pin),p[1]-.030+(sc>=0?y*sc:.028*sc),z+Math.max(0,sc)*.067*(1-u)];
    };
    const shell=patch(small(20,14,12,10),8,fin,s>0);
    shell.userData.constructionRole='rear quarter / swept stamped tail fin';
    put('rearFenders','paint',shell);
    for(const [u,flip] of [[0,s>0],[1,s<0]]){
     const p=fin(u,0),q=fin(u,.5),mid=p.map((v,i)=>(v+q[i])/2);
     const pts=[mid,...Array.from({length:8},(_,i)=>fin(u,i/8))],tri=[];
     for(let i=0;i<8;i++){const j=1+(i+1)%8;tri.push(0,flip?j:i+1,flip?i+1:j);}
     const cap=new T.BufferGeometry();
     cap.setAttribute('position',new T.Float32BufferAttribute(pts.flat(),3));
     cap.setIndex(tri);cap.computeVertexNormals();
     put('rearFenders','paint',cap);
    }
   }
  }
  for(const seam of master.seams){
   const k=seam.id,component=k.includes('Fender')?(k==='rearFenderSeam'?'rearFenders':'frontFenders'):'doors';
   for(const p of seam.parts){p.geometry.userData.constructionRole='panel seams / '+p.kind;put(component,p.material,p.geometry);}
   seamChecks.push({id:k+'-'+letter,...seam.metrics});
   const metrics={...seam.metrics,matchedPoints:seam.points.map((_,i)=>seam.edgeB(i/(seam.points.length-1)))};
   features.push(guideFeature(k+'-'+letter,'seam',SEAM_KEYS[k]+' · '+letter,component,seam.points,
    {key:k,side:letter,end:k.startsWith('rear')?'rear':'front',view:'side',axis:2,scale:1,metrics}));
  }
  if(canopy.vanSideTrim){
   const amount=canopy.vanSideTrim;
   const z0=mix(bumperRear,doorRear,.20),z1=doorRear-.025;
   // Exposed sliding track just under the belt at the rear quarter. Sample
   // the formed surface, leaving the genuine door shut line intact.
   put('rearFenders','seamDark',patch(small(8,5,4,4),1,(u,v)=>{
    const p=master.at(mix(z0,z1,u),.132+.017*amount*v);
    p[0]+=s*.004;return p;
   },s<0));
  }
  features.push(guideFeature('door-crease-'+letter,'crease','Door character line · '+letter,'doors',
   curvePoints(u=>{
    const z=mix(doorRear+.12,doorFront-.12,u);
    return master.at(z,doorStamp?stampLine(z):g.body.creaseHeight);
   }),
   {side:letter,view:'side',axis:1,scale:-.56}));
  for(const [comp,axle] of [['rearFenders',-L],['frontFenders',L]]){
   const {fore}=archData(axle,s),r=(.0045+c[comp].shape*.004+g.body.archCrown*.004)*g.body.lipScale;
   for(const rail of archHemRails(lowerRails,axle-fore,axle+fore)){
    const hem=patch(rail.length-1,small(3,2,2,1),(u,v)=>{
     const row=rail[Math.round(u*(rail.length-1))],p=row.p;
     const fade=unitSmooth(clamp((fore-Math.abs(row.z-axle))/.025));
     // The edge rolls toward the open wheel well, then inboard. At the
     // two lower ends use a tiny return rather than zero-area triangles.
     const w=r*mix(.12,1,fade);
     return [p[0]-s*w*(1-Math.cos(v*1.72)),p[1]-w*Math.sin(v*1.72),p[2]];
    },s<0);
    hem.userData.constructionRole='wheel arches / folded hem';
    put(comp,g.body.darkArchLips?'trim':'paint',hem);
   }
   const arc=curvePoints(u=>master.at(axle-archData(axle,s).fore*Math.cos(u*Math.PI),1));
   features.push(guideFeature(comp+'-arch-'+letter,'arch',(axle>0?'Front':'Rear')+' wheel arch · '+letter,comp,arc,{end:axle>0?'front':'rear',side:letter,view:'side',axis:1,scale:.12}));

  }
  const p=getSideSettings(g,'rockers',letter,c.rockers);
  const sillHeight=(p.type==='blade'?.052:p.type==='deep'?.14:.089)*p.size*d.skirt;
  addModelPart(parts,'rockers',g.body.lowerCladding?'roofPaint':p.type==='blade'?'trim':'paint',patch(small(16,9,7,6),small(5,2,2,2),(u,v)=>{
   const z=mix(-L+radius+.011,L-radius-.011,u);
   return [master.at(z,.99)[0]+s*(.008*p.depth+.020*bell(v)*p.shape),floor+sillLift(z)-.019+sillHeight*v,z];
  },s>0));
  const mirror=getSideSettings(g,'mirrors',letter,c.mirrors),sx=X*.87,sy=B+.105*mirror.depth,mz=cabinFront-.19+mirror.bias*.08;
  if(mirror.type==='folded rectangle'){
   const center=[s*(sx+.106),sy+.009,mz],width=.239*mirror.size,height=.125*mirror.depth,depth=.123*mirror.size;
   const exponent=.32+.36*mirror.shape,power=t=>Math.sign(t)*Math.abs(t)**exponent;
   const local=(u,scale,z)=>{const angle=u*2*Math.PI; const x=width*.5*power(Math.cos(angle))*scale;
    return [center[0]+x,center[1]+height*.5*power(Math.sin(angle))*scale-s*x*.105,center[2]+z+s*x*.21];
   };
   const ringPatch=(z0,z1,r0,r1,flip=true)=>patch(small(3,1,1,1),small(lod?24:32,14,12,10),(t,u)=>local(u,mix(r0,r1,unitSmooth(t)),mix(z0,z1,t)),flip);
   put('mirrors',g.construction.cabin.contrastMirrorCaps?'roofPaint':'paint',ringPatch(-depth*.43,-depth*.29,.93,1));
   put('mirrors',g.construction.cabin.contrastMirrorCaps?'roofPaint':'paint',ringPatch(-depth*.29,depth*.16,1,.96));
   put('mirrors',g.construction.cabin.contrastMirrorCaps?'roofPaint':'paint',ringPatch(depth*.16,depth*.48,.96,.51));
   put('mirrors',g.construction.cabin.contrastMirrorCaps?'roofPaint':'paint',ringPatch(depth*.48,depth*.55,.51,.005));
   put('mirrors','trim',ringPatch(-depth*.43,-depth*.449,.93,.84,false));
   put('mirrors','chrome',ringPatch(-depth*.449,-depth*.452,.84,.001,false));
   put('mirrors','trim',box(.165,.044,.074),[s*(sx+.017),sy-.022,mz-.015]);
  }else{
  put('mirrors','trim',box(.19,.032,.055),[s*(sx+.085),sy-.026,mz]);
  put('mirrors',g.construction.cabin.contrastMirrorCaps?'roofPaint':'paint',ellipsoid(.25*mirror.size,.115*mirror.depth,.185*mirror.size*(mirror.type==='aero'?1.42:1)),[s*(sx+.19),sy,mz],[mirror.angle*RAD,s*(mirror.shape-.5)*.52,0]);
  put('mirrors','chrome',ellipsoid(.19*mirror.size,.087,.019),[s*(sx+.20),sy,mz-.081*mirror.size]);
  }
  if(!canopy.noDoorHandles)for(const z of canopy.highRearDoorHandles&&c.doors.type==='four door'?handleStations(s).slice(1):handleStations(s)){
   const hp=c.handles,q=master.at(z,.22);
   if(hp.type==='painted lever'){
    const span=.132*hp.size, height=.025+hp.shape*.014, rise=.009*hp.depth;
    put('handles','seamDark',new T.SphereGeometry(1,small(12,7,6,5),small(6,3,3,3)).scale(.004,height*.64,span*.53),[q[0]-s*.0005,q[1],q[2]]);
    const grip=new T.CapsuleGeometry(height*.25,span-height*.5,small(3,1,1,1),small(9,6,5,4)).rotateX(Math.PI*.5).scale(.69,.95,1);
    put('handles','paint',grip,[q[0]+s*rise,q[1]-.002,q[2]]);
   }else{
   put('handles','seamDark',new T.SphereGeometry(1,small(10,7,5,5),small(5,3,3,2)).scale(.0045,(.032+hp.shape*.025)*hp.size*.5,.080*hp.size),[q[0]-s*.002,q[1],q[2]]);
   put('handles',hp.type==='flush'?'paint':'trim',new T.SphereGeometry(1,small(10,7,5,5),small(5,3,3,2)).scale((.008+.005*hp.depth)*.5,(.018+hp.shape*.014)*hp.size*.5,.063*hp.size),[q[0]+s*.004,q[1]+.001,q[2]]);
   }
  }
 }
 // Shared q(u,v) cabin envelope consumed by all glazing, pillars and roof.
 const coveredTarga=c.roof.type==='targa fabric',roadster=c.roof.type==='roadster open';
 const roofW=Math.min(X*.91,X*d.cabinWidth*c.roof.size*.94),glassBaseW=X*d.cabinWidth*1.12,
  roofC=(.023+.068*d.crown)*(.60+c.roof.shape)*((c.roof.type==='flat'||coveredTarga)?.40:1)*c.roof.depth;
 const baseW=z=>Math.min(skinX(z)-.035,glassBaseW);
 const roofPoint=(z,u)=>{const k=2*u-1,edge=g.body.roofEdge;return [k*roofW*(1-(.067+.12*(canopy.canopyShoulder-.5))*Math.abs(2*(z-roofRear)/Math.max(.15,roofFront-roofRear)-1)**2),d.height+UP_PATCH(g,'roof',z,u,roofRear,roofFront)-roofC*Math.abs(k)**(2.28-.68*edge-.60*(canopy.canopyShoulder-.5))-.014*edge*Math.abs(k)**11-roofC*.45*Math.abs(2*(z-roofRear)/Math.max(.15,roofFront-roofRear)-1)**2,z];};
 const bubbleRoof=canopy.bubbleCanopy;
 function canopyRoof(z,u){
  const p=roofPoint(z,u);
  if(!bubbleRoof)return p;
  const t=clamp((z-roofRear)/Math.max(.15,roofFront-roofRear)),k=Math.abs(2*u-1);
  // Longitudinal bulb: shoulder radius grows near center then shrinks
  // into the rounded windscreen and engine-cover glass.
  const end=Math.abs(2*t-1)**2,corner=k**3.0;
  p[0]*=1-bubbleRoof*(.135*end+.040*corner);
  p[1]-=bubbleRoof*(.083*end+.055*corner+.017*end*corner);
  return p;
 }
 const hatchSplit=.26,hatchFold=canopy.rearHatchFold;
 const glassPoint=(sgn,t,u)=>{const edge=sgn>0?roofFront:roofRear,gate=sgn>0?cabinFront:cabinRear;
  const w=baseW(gate),x=(2*u-1)*w,k=(x/skinX(gate)+1)/2;
  const boot=[x,(sgn>0?hoodPoint:trunkPoint)(gate,k)[1]+.004,gate],header=canopyRoof(edge,u);
  const open=roadster&&sgn>0?canopy.openScreenRatio:0;
  if(open){header[1]=mix(boot[1],header[1],open);header[2]=mix(boot[2],header[2],open*.73);}
  const q=lerp3(boot,header,t);
  const zBow=sgn<0&&hatchUpright?Math.min(.045*c.glass.depth,(edge-gate)*.28):(.045*c.glass.depth+bubbleRoof*.11)*(open?open:1);
  q[2]+=sgn*zBow*bell(t)*bell(u);
  if(sgn<0&&canopy.rearGlassArc){
   const round=bell(t)**1.35;
   q[1]+=canopy.rearGlassArc*round;
   q[2]-=canopy.rearGlassArc*.28*round*(sgn<0&&hatchUpright?1-hatchUpright:1);
  }
  // Keep the original top and bottom joins. Shift the intermediate
  // fold aft to make a tall near-vertical lower pane under the upper pane.
  if(sgn<0&&hatchFold){
   const tent=t<=hatchSplit?t/hatchSplit:(1-t)/(1-hatchSplit);
   const span=edge-gate,grade=span-zBow*Math.PI-.28*canopy.rearGlassArc*1.35*Math.PI;
   const reach=Math.min(span*hatchSplit*.86-.025,(grade-.045)*hatchSplit);
   q[2]-=Math.max(0,reach)*hatchFold*tent;
  }
  return q;};
 if(roadster&&canopy.openRollHoop>.01){
  const z=cabinRear+.125, y=skinY(z)+.016, span=Math.min(.555,skinX(z)*.78),rise=canopy.openRollHoop;
  const tube=new T.CatmullRomCurve3([[-span,y,z],[-span*.93,y+rise*.73,z],[-span*.59,y+rise,z],
   [span*.59,y+rise,z],[span*.93,y+rise*.73,z],[span,y,z]].map(point=>new T.Vector3(...point)));
  put('pillars','trim',new T.TubeGeometry(tube,small(18,10,8,7),.021,6,false));
 }
 if(!roadster&&canopy.roofLipReach>.01){
  // A roof-hinge spoiler not the decklid aerodynamics primitive. Airfoil
  // and faying feet follow the shared roof and hatch charts as rake changes.
  const chord=canopy.roofLipReach,half=canopy.roofLipSpan/2,lift=canopy.roofLipLift;
  const join=u=>canopyRoof(roofRear,mix(.5-half,.5+half,u));
  const skin=(u,v)=>{
   const a=v*Math.PI*2,p=join(u),s=Math.abs(u*2-1);
   return [p[0],p[1]+lift*(.82+.18*s)+.012*Math.sin(a), p[2]-chord*(.45+.5*Math.cos(a))*(1-.17*s*s)];
  };
  put('spoiler','trim',patch(small(11,8,6,5),6,skin,true));
  for(const end of [0,1]){
   put('spoiler','trim',patch(1,6,(u,v)=>lerp3(skin(end,v),skin(end,.5),u),end===0));
   const left=end===0?.045:.835,right=end===0?.165:.955;
   put('spoiler','trim',patch(2,2,(u,v)=>{
    const s=mix(left,right,u), w=mix(.5-half,.5+half,s),a=glassPoint(-1,.94,w),b=skin(s,mix(.40,.79,u));
    return lerp3(a,b,v);
   },end===0));
  }
 }
 const roofStrake=!roadster&&!coveredTarga&&!canopy.roofGlazing&&!canopy.gullwingRoofSeams&&canopy.foldingRoofSeam<=.09&&canopy.utilityCabinSplit<.25&&!canopy.pickupCabFrame&&!canopy.hatchQuarterTaper?canopy.roofStrake:0;
 if(!roadster){
  const roofMode=coveredTarga?0:Math.round(canopy.roofGlazing);
  const roofFinish=coveredTarga?'trim':canopy.hardtopContrast?'roofPaint':'paint';
  if(!roofMode&&!coveredTarga&&canopy.gullwingRoofSeams){
   // Partition closed roof skin on its own chart: left/right door leaves
   // and the retained center spine share the identical crown and rails.
   const width=.0045/Math.max(.55,roofW*2),half=width/2,n=small(17,9,8,7);
   for(const [a,b,seal] of [[0,.38-half,false],[.38-half,.38+half,true],
    [.38+half,.62-half,false],[.62-half,.62+half,true],[.62+half,1,false]]){
    const gran=seal?2:Math.max(3,Math.ceil((b-a)*small(12,9,8,7)));
    const mesh=patch(n,gran,(t,u)=>{
     const p=canopyRoof(mix(roofRear,roofFront,t),mix(a,b,u));
     if(seal)p[1]-=Math.sin(Math.PI*u)*.003;
     return p;
    });
    mesh.userData.constructionRole=seal?'gullwing / recessed roof seal':'gullwing / closed roof section';
    const leaf=canopy.gullwingRoofGlass&&(a===0||b===1);
    put('roof',seal?'seamDark':leaf?'glass':roofFinish,mesh);
   }
  }else if(!roofMode&&!coveredTarga&&canopy.foldingRoofSeam>.09){
   // Closed retractable hardtop with separate skins and a recessed seal.
   // All three strips sample a single roof chart, so perimeter joins stay put.
   const station=clamp(canopy.foldingRoofSeam,.10,.90),span=roofFront-roofRear;
   const half=.0035/span, seam=mix(roofRear,roofFront,station),columns=small(12,9,8,7);
   const n=small(17,9,8,7), before=Math.max(2,Math.round(n*station)),after=Math.max(2,n-before);
   for(const [a,b,rows,seal] of [[roofRear,seam-span*half,before,0],[seam-span*half,seam+span*half,2,1],[seam+span*half,roofFront,after,0]]){
    const m=patch(rows,columns,(t,u)=>{
     const v=canopyRoof(mix(a,b,t),u);
     if(seal)v[1]-=.0028*Math.sin(Math.PI*t)*Math.sin(Math.PI*u)**.5;
     return v;
    });
    m.userData.constructionRole=seal?'closed folding roof / seal':'closed folding roof / painted section';
    put('roof',seal?'seamDark':roofFinish,m);
   }
  }else if(roofStrake>0){
   // A painted roof insert and two flush perimeter strakes, partitioned
   // on the original chart. No rails or overlays above the roof/glass join.
   const rows=small(17,9,8,7),cols=small(12,9,8,7);
   for(const [a,b,m,tag] of [[0,roofStrake,'roofPaint','contrast roof strake'],[roofStrake,1-roofStrake,'paint','roof center skin'],[1-roofStrake,1,'roofPaint','contrast roof strake']]){
    const q=patch(rows,tag==='roof center skin'?cols:1,(t,u)=>canopyRoof(mix(roofRear,roofFront,t),mix(a,b,u)));
    q.userData.constructionRole=tag;
    put('roof',m,q);
   }
  }else if(!roofMode)sheet('roof',roofFinish,roofRear,roofFront,canopyRoof,small(17,9,8,7),small(12,9,8,7));
  else{
   // The glass and weatherstrips partition the same master surface; no
   // duplicate paint underneath panes, including underneath the T-bar.
   const tbar=roofMode===2,metal=roofMode===3, zStops=tbar?[0,.155,.172,.862,.879,1]:[0,.305+.264*canopy.roofPaneShortening,.322+.264*canopy.roofPaneShortening,.826,.843,1];
   const uStops=tbar?[0,.018,.448,.464,.536,.552,.982,1]:[0,.158,.175,.825,.842,1];
   for(let iz=0;iz<zStops.length-1;iz++)for(let iu=0;iu<uStops.length-1;iu++){
    const pane=iz===2&&(tbar?iu===1||iu===5:iu===2);
    const seal=iz>=1&&iz<=3&&(tbar?iu===0||iu===2||iu===4||iu===6||(iz!==2&&(iu===1||iu===5)):iu>=1&&iu<=3);
    const z1=zStops[iz],z2=zStops[iz+1],u1=uStops[iu],u2=uStops[iu+1];
    const n=Math.max(1,Math.round((z2-z1)*small(25,12,11,9))),m=Math.max(1,Math.round((u2-u1)*small(22,13,11,9)));
    const mesh=patch(n,m,(t,u)=>canopyRoof(mix(roofRear,roofFront,mix(z1,z2,t)),mix(u1,u2,u)));
    mesh.userData.constructionRole=pane?(metal?'metal sunroof insert':'roof glazing'):seal?'roof seal':'roof frame';
    put('roof',pane?(metal?roofFinish:'glass'):seal?'seamDark':roofFinish,mesh);
   }
  }

  buildRoofRails({put,roof:roofPoint,front:roofFront,rear:roofRear,amount:canopy.utilityRoofRails,compact});
 }else{
  // Roadster's fixed windscreen header and a restrained tonneau over the
  // folded roof. The rear cowl, open side windows and seats are not deleted.
  put('pillars','trim',patch(2,small(16,8,7,6),(v,u)=>{
   const p=glassPoint(1,.954+.049*v,u);
   return [p[0]*1.011,p[1]+.010,p[2]+.005];
  }));
  const aft=cabinRear-.002,dW=baseW(cabinRear);
  put('roof','trim',patch(small(9,5,4,3),small(16,9,8,7),(t,u)=>{
   const k=2*u-1,z=aft+(.205-.044*Math.abs(k)**2)*t;
   const w=dW*(.95-.08*t),x=k*w;
   return [x,skinY(cabinRear)+.004+.052*bell(t)*Math.max(0,1-Math.abs(k)**5)+.013*t,z];
  }));
 }

 // Partition the glazing chart rather than drawing trim over a full glass
 // plane. Paint, weatherstrip and glass segments are disjoint and share edges.
 const framePickupGlazing=(chart,panes,flip)=>{
  const n=small(10,6,5,4),seal=.010,cuts=[0];
  const emit=(mat,l,r,b,t,nu=n,nv=1)=>{
   if(r-l<1e-6||t-b<1e-6)return;
   const mesh=patch(nu,nv,(u,v)=>chart(mix(l,r,u),mix(b,t,v)),flip);
   mesh.userData.constructionRole='pickup cab frame / '+mat;
   put(mat==='glass'?'glass':'pillars',mat,mesh);
  };
  for(const {l,r,b,t} of panes){
   const prev=cuts.at(-1);
   emit('paint',prev,l,0,1,1);emit('paint',l,r,0,b);emit('paint',l,r,t,1);
   emit('seamDark',l,r,b,b+seal);emit('seamDark',l,r,t-seal,t);
   emit('seamDark',l,l+seal,b+seal,t-seal,1);emit('seamDark',r-seal,r,b+seal,t-seal,1);
   emit('glass',l+seal,r-seal,b+seal,t-seal,n,small(8,5,4,3));cuts.push(r);
  }
  emit('paint',cuts.at(-1),1,0,1,1);
 };
 const pickupFrame=pickupDepth>0?canopy.pickupCabFrame:0;
 for(const s of [-1,1]){
  if(s<0&&roadster){
   // Lower door belt still samples the nominal canopy chart below.
  }else if(s<0&&targaBulk){
   // Use the rear glazing chart as the layup surface for three fixed panes
   // and the surrounding roll-hoop skin. Shared strip edges meet the roof
   // and deck; there is no frame model floating over a full-width pane.
   const bands=[0,.067,.338,.385,.615,.662,.933,1];
   const lo=mix(.035,.19,targaBulk),hi=mix(.965,.833,targaBulk);
   const tall=(x,a,b)=>Math.min(1,Math.abs((2*x-a-b)/(b-a)))**5;
   for(let j=0;j<bands.length-1;j++){
    const a=bands[j],b=bands[j+1],window=j%2===1,n=window?small(9,6,5,4):1;
    const strip=(mat,low,high,m=2)=>put('glass',mat,patch(m,n,(v,u)=>{
     const x=mix(a,b,u),edge=window?.046*targaBulk*tall(x,a,b):.046*targaBulk;
     return glassPoint(-1,mix(low(edge),high(edge),v),x);
    }));
    strip('trim',()=>0,e=>lo+e);
    strip(window?'glass':'trim',e=>lo+e,e=>hi-e,3);
    strip('trim',e=>hi-e,()=>1);
   }
  }else if(s<0&&hatchFold){
   const halfBand=.019+.014*hatchFold;
   const lo=hatchSplit-halfBand,hi=hatchSplit+halfBand,n=small(16,10,9,8);
   const rail=hatchLamps?clamp(.118+.035*g.optics.rear.width,.112,.153):0;
   const emit=(material,tag,a,b,nv)=>{
    const geo=patch(nv,n,(v,u)=>glassPoint(-1,mix(a,b,v),mix(rail,1-rail,u)),true);
    geo.userData.section=tag;put('glass',material,geo);
   };
   emit('glass','lower-hatch-pane',0,lo,small(6,3,2,2));
   emit('seamDark','hatch-glass-divider',lo,hi,2);
   emit('glass','upper-hatch-pane',hi,1,small(10,5,4,3));
   const raised=canopy.hatchBridge;
   if(raised){
    // Bridge the existing hatch hinge line with a closed, thin section.
    // Ruled feet meet the outer hatch rail rather than sinking into glass.
    const x0=.5-canopy.hatchBridgeWidth*.5,x1=1-x0;
    const root=(u)=>glassPoint(-1,hatchSplit,mix(x0,x1,u));
    const section=(u,v)=>{
     const p=root(u), a=2*u-1,edge=Math.abs(a)**9;
     const angle=2*Math.PI*v;
     return [p[0],p[1]+raised*(1-.46*edge)+.014*Math.sin(angle)+.009*Math.cos(angle),p[2]-.054-.049*Math.cos(angle)];
    };
    put('spoiler','trim',patch(small(15,9,8,7),6,section,true));
    for(const side of [0,1]){
     put('spoiler','trim',patch(1,6,(t,v)=>lerp3(section(side,v),section(side,.5),t),side>0));
     const a=side===0?0:.948,b=side===0?.052:1;
     for(const u of [a,b])put('spoiler','trim',patch(2,1,(t,v)=>{
      const q=root(u),p=section(u,mix(.56,.95,v));
      return lerp3([q[0],q[1]-.022,q[2]+mix(.026,-.046,v)],p,t);
     },side>0));
     put('spoiler','trim',patch(3,2,(u,t)=>{
      const x=mix(a,b,u),q=root(x),p=section(x,.80);
      return lerp3([q[0],q[1]-.018,q[2]+.009],p,t);
     },side===0));
    }
   }
   if(hatchLamps)for(const side of [-1,1]){
    const right=side>0,letter=right?'R':'L';
    const opt=getSideSettings(g,'taillights',letter,g.optics.rear);
    const t0=.032+.032*opt.position,tip=.22+.34*hatchLamps*(.78+.22*opt.height),mid=clamp(lo,t0+.035,tip-.055),
     split=clamp(hi+.025,mid+.009,tip-.025);
    const fill=canopy.hatchLampFill;
    const keys=[
     [0,.067,.068],[t0,.067-.045*fill,.068+.034*fill],[mix(t0,mid,.40),.019-.009*fill,rail-.022+.008*fill],[mid,.012,rail-.013],
     [split,.024-.012*fill,rail-.018+.004*fill],[mix(split,tip,.63),.027-.013*fill,.079+.018*fill],[tip,.044,.045],[1,.044,.045]
    ];
    const shape=(i,u,v,inner,offset)=>{
     const A=keys[i],B=keys[i+1],t=mix(A[0],B[0],v);
     const u0=mix(A[1],B[1],v),u1=mix(A[2],B[2],v),q=inner(u,u0,u1);
     const p=glassPoint(-1,t,right?1-q:q);
     // Separate the lens and its gasket along the rear-glass surface;
     // the offset fades to zero at the edge, keeping every joint closed.
     p[2]-=offset*Math.sin(Math.PI*u);return p;
    };
    const zone=(idx,mat,between,depth=0)=>put(mat==='paint'?'trunk':'tails',mat,
     patch(2,3,(v,u)=>shape(idx,u,v,between,depth),right));
    for(let i=0;i<keys.length-1;i++){
     if(i===0||i===keys.length-2){zone(i,'paint',u=>mix(0,rail,u));continue;}
     zone(i,'paint',(u,a)=>mix(0,a,u));
     zone(i,'paint',(u,a,b)=>mix(b,rail,u));
     const margin=.09+.12*opt.corner, left=(a,b)=>mix(a,b,margin),rightEdge=(a,b)=>mix(b,a,margin);
     zone(i,'seamDark',(u,a,b)=>mix(a,left(a,b),u),.001);
     zone(i,'seamDark',(u,a,b)=>mix(rightEdge(a,b),b,u),.001);
     zone(i,i===3?'opticClear':i>=4?'runningRed':'opticRed',(u,a,b)=>mix(left(a,b),rightEdge(a,b),u),.005+.003*opt.convexity);
    }
    const o=keys.slice(1,-1);
    const contour=[...o.map(([t,a])=>glassPoint(-1,t,right?1-a:a)),...o.slice().reverse().map(([t,,b])=>glassPoint(-1,t,right?1-b:b))];
    features.push(guideFeature('rear-lamp-'+letter,'lamp','Hatch-edge taillight · '+letter,'tails',contour,
     {end:'rear',side:letter,closed:true,view:'rear',axis:1,scale:.10}));
    const [t,a,b]=keys[3];
    lampMounts['TaillightMount_'+letter]=glassPoint(-1,t,right?1-(a+b)*.5:(a+b)*.5);
   }
  }else if(s<0&&hatchUpright>0){
   // The rear hatch surround and its central glass share the identical chart.
   // Both panel seams and D-pillar paint stay present around the glass opening.
   const lo=.139*hatchUpright,hi=1-.081*hatchUpright,left=(functionalTowers?.133:.086)*hatchUpright,right=1-left;
   const f=(k,u,v,a,b,n,m)=>put(k==='glass'?'glass':'trunk',k,patch(n,m,(t,w)=>glassPoint(-1,mix(a,b,t),mix(u,v,w)),true));
   const n=small(12,6,5,4),m=small(16,10,9,8);
   for(const [a,b,segments] of [[0,left,1],[left,right,m],[right,1,1]]){
    f('paint',a,b,0,lo,1,segments);f('paint',a,b,hi,1,1,segments);
   }
   if(canopy.wagonTallTail){
    // Partition the actual C/D-pillar skin, not the hatch glass. The
    // backing, red lens and two gasket rails live on the same chart.
    const top=lo+Math.min(hi-lo-.025,canopy.wagonTallTail*(hi-lo));
    const stations=small(12,7,6,5);
    // Carry the tower past the rear glass, across the painted lower hatch
    // stamp. This follows the original trunk sheet with a slight lens rise
    // and stops inside its panel gap, rather than drawing a diagonal box.
    const upperStation=cabinRear-G,lowerStation=trunkEdge+.006;
    if(upperStation-lowerStation>.065)for(const sign of [-1,1]){
     const strip=(u,v)=>{
      const z=mix(lowerStation,upperStation,v);
      const lead=canopy.wagonTailWidth*.029+.014;
      const center=.029+.008*Math.sin(Math.PI*v*.81);
      const a=clamp(center+lead*(u-.5)*(1-.36*v)*(.50+.50*Math.sin(Math.PI*.70*v+.15)));
      const p=trunkPoint(z,sign>0?1-a:a);
      p[1]+=.004+.004*Math.sin(Math.PI*u);p[2]-=.003;
      return p;
     };
     put('tails','runningRed',patch(small(9,5,4,3),2,(v,u)=>strip(u,v),sign<0));
    }
    for(const mirrored of [false,true]){
     const band=(v,u)=>glassPoint(-1,v,mirrored?1-u:u);
     const add=(color,low,high,from,to,res=stations)=>
      put(color==='paint'?'trunk':'tails',color,patch(res,1,(v,u)=>{
       const y=mix(from,to,v),t=clamp((y-lo)/Math.max(.01,top-lo));
       const c=.50-.09*Math.sin(Math.PI*t)+.17*t**4;
       const half=mix(.155,.409,canopy.wagonTailWidth)*(1-(functionalTowers?.29:.46)*t**2);
       const rails=[0,(c-half)*left,(c-half+.060)*left,(c+half-.060)*left,(c+half)*left,left];
       const p=band(y,mix(rails[low],rails[high],u));
       if(color==='runningRed'||color==='opticRed'||functionalTowers&&['opticClear','rearSignalL','rearSignalR','signalL','signalR'].includes(color))p[2]-=(functionalTowers?.008:.004)*Math.sin(Math.PI*u);
       return p;
      },!mirrored));
     for(const [k,mat] of ['paint','seamDark',functionalTowers?null:'runningRed','seamDark','paint'].entries())if(mat)add(mat,k,k+1,lo,top);
     if(functionalTowers){
      // Same physical tower chart as the old decorative trim: working
      // sections share boundary samples, cavity lands and solid body skins.
      const z=t=>mix(lo,top,t),leftHand=mirrored?'R':'L', signal=canopy.towerAmberTurns?(mirrored?'signalR':'signalL'):(mirrored?'rearSignalR':'rearSignalL');
      for(const [mat,a,b,r] of [
       ['runningRed',0,.284,4],['opticClear',.284,.469,2],
       [signal,.469,.68,3],['opticRed',.68,1,5],
      ])add(mat,2,3,z(a),z(b),r);
      const lampMount=band(z(.59),left*.55);
      lampMounts['TaillightMount_'+leftHand]=lampMount;
     }
     f('paint',mirrored?right:0,mirrored?1:left,top,hi,Math.max(1,n-stations),1);
    }
   }else{f('paint',0,left,lo,hi,n,1);f('paint',right,1,lo,hi,n,1);}
   if(canopy.cargoPanel){
    const a=.496,b=.504;
    f('paint',left,a,lo,hi,n,Math.max(3,m>>1));f('seamDark',a,b,lo,hi,n,1);f('paint',b,right,lo,hi,n,Math.max(3,m>>1));
   }else f('glass',left,right,lo,hi,n,m);
  }else if(pickupFrame){
   const edge=s>0?.041+.043*pickupFrame:.063+.087*pickupFrame;
   const b=s>0?.032+.053*pickupFrame:.085+.13*pickupFrame;
   const t=s>0?.966-.054*pickupFrame:.932-.095*pickupFrame;
   framePickupGlazing((u,v)=>glassPoint(s,v,u),[{l:edge,r:1-edge,b,t}],s>0);
  }else put('glass','glass',patch(small(12,6,5,4),small(16,10,9,8),(v,u)=>glassPoint(s,v,u),s<0));
  if(s<0&&!roadster&&canopy.rearDeckVents){
   // Sample the rear canopy rather than fitting a detached box in world
   // coords. Vents follow roof slope, taper and size for every genome.
   const deck=(t,u,lift=0)=>{const p=glassPoint(-1,t,u);p[1]+=lift;return p;};
   if(canopy.rearDeckVents===1){
    const n=small(9,6,5,4);
    // Each stamped dark blade has a lip and a vertical return.  A small
    // gap between blades lets the backing remain visible from oblique views.
    for(let k=0;k<7;k++){
     const from=.079+k*.123, width=.392-.09*(k/6);
     const skin=(v,u,d)=>deck(from+.097*v,.5+(u*2-1)*width,.006+d+.021*(1-v));
     const roll=patch(2,n,(v,u)=>skin(v,u,0),true);
     roll.userData.constructionRole='rear canopy / rolled louver';
     put('trunk','trim',roll);
     put('trunk','seamDark',patch(1,n,(v,u)=>skin(0,1-u,-.024*v),true));
    }
   }else if(canopy.rearDeckVents===2){
    const n=small(10,6,5,4);
    for(const x of [.235,.765]){
     const u0=.32,u1=.86,wide=.107;
     const hoop=(t,a)=>{
      const w=mix(wide*.52,wide,t),rise=mix(.004,.099,t**.64);
      const p=deck(mix(u0,u1,t),x+w*Math.cos(Math.PI*a),.004+rise*Math.sin(Math.PI*a)**.72);
      return p;
     };
     const shell=patch(n,7,(t,v)=>hoop(t,v),true);
     shell.userData.constructionRole='rear canopy / formed ram intake';
     put('trunk','paint',shell);
     const mouth=(a,b)=>{
      const p=hoop(1,a),q=deck(u1,x+wide*Math.cos(Math.PI*a),.005);
      p[1]=mix(q[1],p[1],b);p[2]-=.007;return p;
     };
     put('trunk','seamDark',patch(6,2,(u,v)=>mouth(u,v),true));
    }
   }
  }
  const roofSide=s>0?1:0,letter=s>0?'R':'L', A=canopyRoof(roofFront,roofSide),C=canopyRoof(roofRear,roofSide);
  function side(u,v){
   const f=glassPoint(1,v,roofSide),r=glassPoint(-1,v,roofSide),a=lerp3(f,r,u),
    line=lerp3(A,C,u),actual=canopyRoof(mix(roofFront,roofRear,u),roofSide);
   a[0]+=s*.030*canopy.glassBow*bell(u)*bell(v)*c.glass.depth;
   // Raise the glazing sill progressively without separating the A/D pillars.
   // The painted bridge below uses this same chart, so it stays gap-free.
   a[1]+=canopy.sideGlassRise*bell(u)*unitSmooth(u)*(1-v)**2;
   return a.map((x,i)=>x+(actual[i]-line[i])*v*v);
  }
  glassSides[s]=side;
  const roofRail=curvePoints(u=>side(u,1));
  if(!roadster)features.push(guideFeature('roof-'+letter,'roof','Roof edge · '+letter,'roof',roofRail,{key:'roofSeam',side:letter,view:'side',axis:1,scale:-.08}));
  features.push(guideFeature('glass-base-'+letter,'glass-edge','Lower glazing edge · '+letter,'glass',curvePoints(u=>side(u,.02)),{side:letter,view:'side',axis:1,scale:-.08}));
  const rs=g.seams.roofSeam;
  if(!roadster)put('pillars','seamDark',patch(small(lod?12:22,7,6,5),small(3,1,1,1),(u,v)=>{
   const p=side(u,1-(.016+rs.gap*3)*v);p[0]+=s*(.003+rs.radius);p[1]-=rs.thickness*.7;return p;
  },s<0));
  const taper=canopy.hatchQuarterTaper;
  const split=canopy.utilityCabinSplit;
  if(!roadster&&canopy.insetSideWindow){
   // A three-piece chart: a long lower sliding pane, a bonded rubber
   // guide above it, and the outer fixed glass above the guide.
   const amount=canopy.insetSideWindow,weight=.014+.016*amount;
   const fold=u=>.36+amount*(.31*(1-u)**2+.095*u);
   const slab=(material,a,b,rows)=>{
    const geo=patch(small(22,12,10,9),rows,(u,v)=>side(u,mix(a(u),b(u),v)),s<0);
    geo.userData.section='window-within-window / '+material;
    put(material==='glass'?'glass':'pillars',material,geo);
   };
   slab('glass',()=>0,u=>fold(u)-weight,small(7,4,3,2));
   slab('seamDark',u=>fold(u)-weight,u=>fold(u)+weight,1);
   slab('glass',u=>fold(u)+weight,()=>1,small(7,4,3,2));
  }else if(!roadster&&pickupFrame){
   const lo=.04+.091*pickupFrame,hi=.96-.103*pickupFrame;
   const l=.028+.034*pickupFrame,r=.955-.112*pickupFrame;
   const mid=clamp(split,.43,.67),rail=.025+.023*pickupFrame;
   const panes=split>=.25?[{l,r:mid-rail,b:lo,t:hi},{l:mid+rail,r,b:lo+.012,t:hi}]:
    [{l,r,b:lo,t:hi}];
   framePickupGlazing(side,panes,s<0);
  }else if(!roadster&&split>=.25){
   // Door and cargo glazing are separate parts of the same side chart.
   // A thick painted belt / pillar and small black seals replace the
   // coupe's unbroken DLO; use body or composite rear hardtop color.
   const uMid=clamp(split,.30,.68),rearMat=canopy.hardtopRearSide&&canopy.hardtopContrast?'roofPaint':'paint';
   const zone=(mat,u0,u1,v0,v1,res=1)=>{
    if(u1-u0<=1e-5||v1-v0<=1e-5)return;
    put(mat==='glass'?'glass':'pillars',mat,patch(res,1,(u,v)=>side(mix(u0,u1,u),mix(v0,v1,v)),s<0));
   };
   for(const [a,b,m] of [[0,uMid,'paint'],[uMid,1,rearMat]]){
    if(canopy.cargoPanel&&a>0){
     // The cargo side has a shallow rolled seam rather than passenger glass.
     zone(m,a,b,0,.101,small(12,8,6,5));
     zone('seamDark',a,b,.101,.109,small(12,8,6,5));
     zone(m,a,b,.109,1,small(12,8,6,5));
     continue;
    }
    const l=a+.031,r=b-.053,lo=.105,hi=.862,k=.010,n=small(10,6,5,4);
    zone(m,a,b,0,lo,n);zone(m,a,b,hi,canopy.hardtopContrast?.935:1,n);
    if(canopy.hardtopContrast)zone('roofPaint',a,b,.935,1,n);
    zone(m,a,l,lo,hi);zone(m,r,b,lo,hi);
    zone('seamDark',l,r,lo,lo+k,n);zone('seamDark',l,r,hi-k,hi,n);
    zone('seamDark',l,l+k,lo+k,hi-k);zone('seamDark',r-k,r,lo+k,hi-k);
    zone('glass',l+k,r-k,lo+k,hi-k,n);
   }
  }else if(!roadster&&taper){
   // Split side DLO on the same chart: red C-quarter mass below and aft,
   // following the narrowing rear glass contour. No coplanar overlay.
   const end=t=>1-taper*(.044+.260*Math.abs(t-.52)**1.66);
   const panel=(mat,a,b,m)=>put(mat==='glass'?'glass':'pillars',mat,
    patch(m,small(10,7,6,5),(u,t)=>side(mix(a(t),b(t),u),t),s<0));
   const span=small(22,12,10,9);
   if(canopy.wagonGlassPillar>=.50){
    // Partition the side window on the master glass chart. The trim between
    // the two panes is a real opaque share of the surface, not an overlay.
    const station=canopy.wagonGlassPillar,w=canopy.wagonGlassPillarWidth/2;
    const boundary=(t,sign)=>clamp(station+canopy.wagonGlassPillarLean*(t-.50),.24+w,end(t)-.048-w)+sign*w;
    const stops=Math.max(3,Math.min(span-3,Math.round(span*station)));
    panel('glass',()=>0,t=>boundary(t,-1),stops);
    panel(c.pillars.type==='painted'?'paint':'trim',t=>boundary(t,-1),t=>boundary(t,1),1);
    panel('glass',t=>boundary(t,1),t=>end(t)-.013,span-stops-1);
   }else panel('glass',()=>0,t=>end(t)-.013,span);
   panel('trim',t=>end(t)-.013,end,1);
   panel('paint',end,()=>1,small(6,3,2,2));
  }else if(!roadster)put('glass','glass',patch(small(20,12,10,9),small(9,5,4,3),side,s<0));
  const vanTrim=canopy.vanSideTrim;
  if(vanTrim&&!roadster){
   // Follow the current side glazing surface rather than a flat applique.
   // The DLO's vertical window equipment and track remain separate from the doors.
   put('pillars','chrome',patch(small(8,3,3,3),1,(v,j)=>{
    const t=mix(.045,.941,v),end=.786+.067*t,span=vanTrim*(.067-.024*t);
    const p=side(end-span*(1-j),t);p[0]+=s*.0045;return p;
   },s<0));
  }
  put('doors','paint',patch(small(20,12,10,9),small(4,2,2,1),(u,v)=>{
   const q=side(u,0),outer=skinX(q[2]);
   return [s*mix(Math.abs(q[0]),outer,v),q[1]+(skinY(q[2])-q[1])*v,q[2]];
  },s<0));
  const framed=c.pillars.type==='painted frame';
  const windowPillar=c.doors.type==='four door'?.50:asymDoors&&s>0?.605:.65;
  for(const u of roadster?[0]:split>=.25?[]:taper?(halfDoors?[0]:[0,windowPillar]):halfDoors?[0,1]:[0,windowPillar,1]){
   const outer=u===0||u===1;
   const mat=roofStrake&&outer?'roofPaint':(c.pillars.type==='painted'||framed&&outer)&&!(u===0&&canopy.darkWindscreenFrame)?'paint':'trim',w=(.013+.027*c.pillars.shape)*c.pillars.size+(u===1?canopy.rearPillarWidth:0);
   const pillar=(v,j)=>{
    const q=side(clamp(u+(j-.5)*w*(u===.5?2:3)),v);q[0]+=s*(.007+.011*bell(j))*c.pillars.depth;return q;
   };
   put('pillars',mat,patch(small(lod?7:12,5,4,4),small(3,2,1,1),pillar,framed&&s<0));
   if(framed&&outer)put('pillars','trim',patch(small(lod?7:12,5,4,3),small(2,1,1,1),(v,j)=>{
    const edge=u===0?.78:.22, q=pillar(v,edge+(u===0?1:-1)*j*.18);
    q[0]+=s*.0012;return q;
   },(s<0)!==(u===1)));
  }
  if((asymDoors&&s>0||canopy.highRearDoorHandles&&c.doors.type==='four door')&&!roadster&&!canopy.noDoorHandles){
   // Small upright passenger-rear pull buried in the trailing black
   // glazing trim, not a body-color duplicate on the lower door skin.
   if(canopy.highRearDoorHandles){
    // The short pull is molded into the aft DLO applique. Opaque backing
    // lands against the real chart so the pull cannot float over the glass.
    const garnish=patch(7,3,(v,j)=>{
     const t=mix(.045,.978,v),u=mix(.923-.025*bell(v),1,j);
     const p=side(u,t);p[0]+=s*(.0025+.002*bell(j));return p;
    },s>0);
    put('pillars','trim',garnish);
   }
   const grip=patch(4,2,(v,j)=>{
    const high=canopy.highRearDoorHandles;
    const u=high?mix(.947+.008*v,.975+.006*v,j):mix(.882+.023*v,.953+.011*v,j);
    const p=side(u,mix(high?.43:.16,high?.69:.42,v));
    p[0]+=(high?s:1)*(high?.0045+.004*bell(j)*bell(v):.013+.009*bell(j)*bell(v));return p;
   },canopy.highRearDoorHandles?s>0:true);
   grip.userData.constructionRole=(s>0?'right':'left')+' rear hidden door pull';
   put('handles','trim',grip);
  }
  if(framed&&!roadster&&split<.25)put('pillars',roofStrake?'roofPaint':'paint',patch(small(20,12,10,9),small(3,1,1,1),(u,j)=>{
   const q=side(u,1-j*.046);q[0]+=s*.006;return q;
  },s<0));
  if(split<.25)put('pillars','trim',patch(small(18,10,9,8),small(3,1,1,1),(u,v)=>{const q=side(u,v*.060);q[0]+=s*.010;return q;}));
 }
 // Optical and trim dimensions are tied to fascia, not independent world coordinates.
 const sc=c.scoop;
 if(sc.type!=='off'){
  const z=mix(cabinFront,bumperFront,.49+sc.bias*.14),p=hoodPoint(z,.5),w=hoodDesign.scoopWidth?Math.max(.12,hoodDesign.scoopWidth):.41*sc.size,l=.34*sc.depth,h=hoodDesign.scoopHeight?Math.max(.015,hoodDesign.scoopHeight):.045+.085*sc.shape;
  if(sc.type==='scoop'){
   const lipZ=z+l*.48,ht=h+sc.angle*RAD*l*.24;
   const available=Math.max(0,Math.min(skinX(lipZ),skinX(z-l*.56))-.5*w-.028);
   const shift=Math.max(-available,Math.min(available,hoodDesign.scoopOffset??0));
   function surface(a,b){
    const sz=mix(z-l*.56,lipZ,b),x=shift+w*.5*a*(.87+.13*b);
    const base=hoodPoint(sz,clamp(.5+x/(2*skinX(sz))))[1];
    const cross=Math.max(0,1-Math.abs(a)**(8+12*hoodDesign.scoopCorner))**(.64-.30*hoodDesign.scoopCorner);
    return [x,base+ht*cross*(b*b*(3-2*b))-.001,sz];
   }
   put('scoop','paint',patch(small(lod?8:16,6,5,4),small(8,7,6,5),(b,u)=>surface(2*u-1,b)));
   // A real open sleeve with painted lip, black inside walls and a recessed
   // termination; shadows have physical depth, not a floating black oval.
   if(hoodDesign.scoopWidth||hoodDesign.scoopHeight||hoodDesign.scoopCorner||shift){
    const base=(x,at)=>hoodPoint(at,clamp(.5+x/(2*skinX(at))))[1];
    const ringShape=(a,at,scale,height)=>{
     const x=shift+w*.5*a*scale,arch=Math.max(0,1-Math.abs(a)**(8+12*hoodDesign.scoopCorner))**(.64-.30*hoodDesign.scoopCorner);
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
     put('scoop','paint',patch(small(18,10,8,7),small(2,1,1,1),(u,t)=>lerp3(cut(u*2-1,b,false),cut(u*2-1,b,true),t),b===0));
     put('scoop','seamDark',patch(small(18,10,8,7),small(2,1,1,1),(u,t)=>lerp3(cut(u*2-1,b,true),back(u*2-1,b),t),b===1));
    }
    put('scoop','seamDark',patch(small(18,10,8,7),small(4,2,2,1),(u,t)=>back(u*2-1,t)));
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
 const cabin=buildCabin({g,compact,quality:lod?'lod':quality,put,dims,sample:{
  side:(z,v,s)=>glassSides[s](clamp((cabinFront-z)/(cabinFront-cabinRear)),v),roof:roofPoint,
  frontGlass:(t,u)=>glassPoint(1,t,u),rearGlass:(t,u)=>glassPoint(-1,t,u)
 }});
 const capFrontLiner=roadster||g.body.lowHoodLinerCap;
 const upperSkin=capFrontLiner||pickupWellCeiling?(z,x)=>{
  if(pickupWellCeiling){const y=pickupWellCeiling(z,x);if(Number.isFinite(y))return y;}
  if(!capFrontLiner||z<cabinFront||z>hoodEdge)return Infinity;
  // Invert the actual hood chart's transverse X before evaluating its height.
  let a=0,b=1;
  for(let i=0;i<12;i++){const m=(a+b)*.5;if(hoodPoint(z,m)[0]<x)a=m;else b=m;}
  return hoodPoint(z,(a+b)*.5)[1]-(g.body.lowHoodLinerCap?.025:0);
 }:null;
 const structure=buildStructure({g,compact,quality:lod?'drive':quality,put,dims,sample:{side:bodySide,arch:(z,s)=>sampleLowerRail(lowerPanelRails[s],z)??bodySide(z,1,s),front:ends.front.face,rear:ends.rear.face,upperSkin}});
 issues.push(...(structure.issues??[]));
 buildUtilitySuspension({put,dims,compact,amount:canopy.rallyTubework,tireWidth:d.tireWidth});
 buildUtilityBumper({put,dims,cfg:canopy});
 buildRearSpare({put,dims,compact,cfg:canopy,finish:c.wheels.type==='stamped steel'?'wheel':'trim',tireWidth:d.tireWidth});
 if(cycles)for(const axle of [-L,L])for(const side of [-1,1]){
  // A slim formed mudguard with wrapped outer hems, visibly detached
  // from the midbody. Its radius clears the stock steering/tire envelope.
  const xf=side*(axle>0?t:rearTrack), width=(axle>0?d.tireWidth:rearFit.tireWidth)*1.17;
  const chart=(z,v,rise=.0)=>{
   const stock=g.body.vintageBlower?(axle>0?[-1.49,1.30]:[-1.28,1.41]):[-1.05,1.05];
   const th=mix(stock[0],stock[1],z), edge=(2*v-1), rr=R+.053-.016*Math.abs(edge)**4+rise;
   return [xf+edge*width*.5,R+rr*Math.cos(th),axle+rr*Math.sin(th)];
  };
  const tag=axle>0?'frontFenders':'rearFenders';
  put(tag,'trim',patch(small(18,9,8,7),4,chart,side>0));
  for(const edge of [0,1])put(tag,'seamDark',patch(small(18,9,8,7),1,(u,v)=>chart(u,edge,-.009*v),edge===1));
 }
 const aero=buildAero({g,compact,quality:lod?'lod':quality,put,sample:{trunk:trunkPoint,rear:ends.rear.face,sideExhaust:(sign,z)=>skinPoint(z,.98,sign,z>doorRear?'doors':'rearFenders'),exhaustMount:(id,side)=>exhaustMounts.get(id+':'+side)},dims:{...dims,axleHalf:L},evalFormula});
 for(const f of styleCurves)for(const side of (f.side==='both'?['L','R']:[f.side])){
  const sign=side==='R'?1:-1;
  const points=curvePoints(u=>{const z=mix(Lr,Lf,mix(f.start,f.end,u));return bodySide(z,featureHeight(f,z),sign);});
  features.push(guideFeature('style-'+f.id+'-'+side,'style-curve','Styling curve · '+f.id+' · '+side,'doors',points,{key:f.id,side,view:'side',axis:1,scale:-.50}));
 }
 const wheels=Object.fromEntries([['fl',-1,L],['fr',1,L],['rl',-1,-L],['rr',1,-L]].map(([id,s,z])=>[id,[s*(z>0?t:rearTrack),R+(z<0?d.rearWheelRadiusDelta:0),z]]));
 // Competition splash guards hang behind the physical tire centers.
 // Keep their visual mesh independent of tire clearance and attachment joints.
 if(canopy.rallyMudflaps>.005)for(const [id,[x,y,z]] of Object.entries(wheels)){
  const rear=id[0]==='r', width=(rear?rearFit.tireWidth:d.tireWidth)*1.03;
  const top=Math.max(floor+.073,y-.028), drop=Math.min(canopy.rallyMudflaps,top-.052);
  const flap=new T.BoxGeometry(width,drop,.006);
  const v=flap.attributes.position;
  for(let i=0;i<v.count;i++)if(v.getY(i)<0){v.setX(i,v.getX(i)*.94);v.setZ(i,v.getZ(i)-.019);}
  flap.computeVertexNormals();
  flap.userData.constructionRole='rally mudflap';
  put(rear?'rearFenders':'frontFenders','rubber',flap,[x,top-drop*.5,z-R-.047]);
 }
 if(g.body.openWheelShell){
  for(const part of parts.splice(0))part.geometry.dispose();
  // Open-wheel shells do not emit any donor panel, arch or headlamp part.
  // Runtime wheels and mount metadata remain on their normal code path.
  features.length=0;seamChecks.length=0;joins.length=0;
  buildOpenWheelVintage({g,put,dims,quality,compact});
 }else if(g.body.vintageBlower)buildVintageBlower({g,put,dims});
 const wp=[];buildWheels(g,{quality,compact,emit:(k,m,geo,p,r)=>addModelPart(wp,k,m,geo,p,r)});
 const rearWp=staggered?[]:null;
 if(rearWp)buildWheels(g,{quality,compact,rear:true,emit:(k,m,geo,p,r)=>addModelPart(rearWp,k,m,geo,p,r)});
 const floorContact=Math.min(...Object.values(wheels).map(v=>v[1]-R-(v[2]<0?d.rearWheelRadiusDelta:0)));
 for(const part of [...parts,...wp,...(rearWp??[])]){
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
 for(const p of [...parts,...wp,...(rearWp??[])])p.semantic={id:'part-'+p.component,type:'component',component:p.component};
 return {genome:g,parts,wheelParts:wp,rearWheelParts:rearWp,wheels,lampMounts,fascia,features,cabin,aero,structure:structure.metrics,stations:{cabinFront,cabinRear,roofFront,roofRear,doorFront,doorRear,bumperFront,bumperRear},
  metadata:{lengthM:length,widthM:d.width,heightM:d.height,wheelbaseM:d.wheelbase,trackWidthM:t*2,trackFrontM:t*2,trackRearM:rearTrack*2,wheelRadiusM:R,rideHeightM:floor},
  diagnostics:{issues:[...new Set(issues)],warnings:[...new Set(warnings)],floorContact,joins,seams:checkedSeams,bodyTriangles:triangles(parts),wheelTriangles:triangles(wp),panel:cloneJSON(surface.diagnostics)}};
}
