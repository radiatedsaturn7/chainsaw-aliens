import {sideDuctMask,cowlDuctMask,quarterDuctMask,fenderGillMask} from './sideDuct.mjs';
import {auditVehicleGeometry} from './audit9.mjs';
import {studioMaps,studioTextureBytes} from './detail9.mjs';
import {wheelTireTexture,wheelRotorTexture} from './wheels9.mjs';
import {createModelDocument,validateModelDocument} from '../../model3d/ModelDocument.js';
import {createBuiltInRaceCars} from '../../racing/raceData.js';
import {generateVehicle,disposeDesign} from './geometry.mjs';
const PALETTE={
 'bonnet-stripes':['Twin bonnet stripes','paint'],
 'cowl-duct':['Twin hood cowl ducts','paint'],
 'lower-clad':['Lower side cladding','paint'],
 'side-duct':['Sculpted door-side duct','paint'],
 'fender-duct':['Recessed fender gill skin','paint'],
 'quarter-duct':['Sculpted rear-quarter cooling intake','paint'],
 'fascia-front':['Front fascia insert skin','paint'],'fascia-rear':['Rear fascia insert skin','paint'],
 ductMatte:['Matte intake backing','trim'],
 roofPaint:['Contrast hardtop paint','paint'],paint:['Coachwork paint','paint'],wheel:['Wheel alloy','alloy'],glass:['Cabin glass','glass'],rubber:['Tire rubber','rubber'],whitewall:['Matte white sidewall','rubber'],
 trim:['Exterior trim','trim'],chrome:['Machined steel','machined'],head:['[studio9:head] Front optical lens','optic'],tail:['Rear optical lens','optic'],opticCover:['Clear optical cover','glass'],indicator:['Amber indicator','optic'],seamDark:['Recess and seam backing','trim'],projector:['[studio9:head] Projector glass','optic'],reflector:['Optical reflector','machined'],reflectorFluted:['Fluted optical reflector','machined'],rotor:['Swept brake steel','machined'],barrel:['Wheel barrel','alloy'],caliper:['[studio9:static-caliper] Brake caliper','trim'],underbody:['Coated underbody','trim'],
 heatShield:['Brushed heat shield','machined'],leather:['Seat leather','upholstery'],cloth:['Seat cloth','upholstery'],stitch:['Upholstery stitching','upholstery'],
 guideMilk:['Passive milky light-guide insert','optic'],opticRed:['[studio9:brake] Layered red lens','optic'],opticClear:['[studio9:reverse] Clear optical segment','optic'],opticSilver:['Silver-clear rear reflector','machined'],runningRed:['[studio9:running] Rear light guide','optic'],signalL:['[studio9:signal-left] Left amber signal','optic'],signalR:['[studio9:signal-right] Right amber signal','optic'],
 rearSignalL:['[studio9:signal-left] Red rear turn lens','optic'],rearSignalR:['[studio9:signal-right] Red rear turn lens','optic'],
 interior:['Interior vinyl','trim'],seat:['Seat upholstery','upholstery'],floor:['Floor carpet','upholstery']
};
const solidTexture=(pixel)=>({width:1,height:1,pixels:[pixel]});
// Material boundaries live on the fascia chart, not on an extra carrier
// surface: holes/geometry, normals, seams and collision are unchanged.
function fasciaInsertTexture(g,end){
 const f=g.fascia[end],width=128,height=64,pixels=new Array(width*height);
 const bytes=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const paint=bytes(g.materials.paint),trim=bytes(g.materials.trim),roof=bytes(g.materials.roofPaint);
 const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Model data textures flip on upload, as do the Studio preview's maps.
  const u=(x+.5)/width,v=1-(y+.5)/height,q=Math.abs(2*u-1)/f.insertWidth;
  const corner=Math.min(1,q)**2,top=f.insertTop+f.insertSweep*.34*corner,
   bottom=f.insertBottom-f.insertSweep*.80*corner+(f.insertStep??0)*(1-smooth(.49,.62,q));
  const waist=1-(f.insertWaist??0)*.68*Math.exp(-(((v-.47)/.138)**2));
  const maskQ=waist<1?q/waist:q;
  const upper=f.insertBand?(1-smooth(.975,1.005,maskQ))*smooth(top-.014,top+.014,v)*(1-smooth(bottom-.014,bottom+.014,v)):0;
  const xEdge=Math.abs(2*u-1),amount=f.lowerInsert??0,lowerWidth=.64+.24*amount;
  const lowerTop=.90-.26*amount+.060*(xEdge/lowerWidth)**3;
  const lower=amount>0?(1-smooth(lowerWidth-.025,lowerWidth+.015,xEdge))*smooth(lowerTop-.018,lowerTop+.018,v):0;
  const a=Math.max(upper,lower);
  const t=Math.max(.0001,bottom-top), h=(v-top)/t;
  const span=(f.insertSatinWidth??.37)*(1-.29*smooth(.42,.86,h));
  // A satin insert on the existing surface, separate from the
  // optical lenses / real running-light aperture. Keep its bottom vent dark.
  const satin=(f.insertSatinCenter??0)*upper*(1-smooth(span-.019,span+.019,q))
   *smooth(.065,.15,h)*(1-smooth(.69,.82,h));
  const light=(f.utilityLightInsert??0)*upper*(1-smooth(.92,1,q))*smooth(.10,.14,h)*(1-smooth(.81,.92,h));
  const clad=g.body.lowerCladding>0?Math.min(lower,Math.max(0,lower-upper)):0;
  pixels[y*width+x]='#'+paint.map((p,k)=>Math.round(p+(trim[k]-p)*a+(roof[k]-trim[k])*clad+([116,124,132][k]-trim[k])*satin*(1-light)+(roof[k]-trim[k])*light).toString(16).padStart(2,'0')).join('');
 }
 return {width,height,pixels};
}

function ductTexture(g,mask,centerAccent=false){
 const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 const width=128,height=64,pixels=new Array(width*height);
 const bytes=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const paint=bytes(g.materials.paint),trim=bytes(g.materials.trim),accent=centerAccent?bytes(g.materials.roofPaint):paint;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const z=(x+.5)/width,u=1-(y+.5)/height;
  const a=mask(g.body,z,u);
  const widthAt=.355-.10*z, shoulder=Math.abs(u-.50);
  const c=centerAccent?smooth(.040,.054,z)*(1-smooth(.91,.93,z))*(1-smooth(widthAt-.008,widthAt,shoulder)):0;
  pixels[y*width+x]='#'+paint.map((p,k)=>{
   const base=p+(accent[k]-p)*c;
   return Math.round(base+(trim[k]-base)*a).toString(16).padStart(2,'0');
  }).join('');
 }
 return {width,height,pixels};
}

function claddingTexture(g){
 const width=2,height=128,stop=1-g.body.lowerCladding;
 return {width,height,pixels:Array.from({length:width*height},(_,i)=>
  1-(Math.floor(i/width)+.5)/height>stop?g.materials.roofPaint:g.materials.paint)};
}
function stripeTexture(g){
 const width=64,height=128,pixels=[];
 const paint=g.materials.paint,stripe=g.materials.roofPaint;
 const offset=g.construction.hood.stripeOffset;
 for(let i=0;i<height;i++)for(let j=0;j<width;j++){
  const z=(j+.5)/width,x=Math.abs((i+.5)/height-.5);
  const core=.129+.040*z;
  // Same continuous hood UV chart and finish controls; racing color
  // blocks are unbranded and do not allocate any additional geometry.
  const secondary=g.construction.hood.diagonalCoachwork
   ?(i+.5)/height>.20+z*.55
   :offset?z>.009&&z<.992&&Math.abs(Math.abs((i+.5)/height-.5-offset)-.048)<.031
   :z>.042&&z<.984&&Math.abs(x-core)<.029;
  pixels.push(secondary?stripe:paint);
 }
 return {width,height,pixels};
}

export function materialDoc(g,key,{texture=true}={}){
 const [name,preset]=PALETTE[key];const fascia=key.startsWith('fascia-')?key.slice(7):null;const rimFace=key==='wheel',maps=texture?studioMaps(key==='rubber'?'tire':key.startsWith('signal')?'indicator':(key==='runningRed'||key.startsWith('rearSignal'))?'opticRed':key):{};
 return {id:'studio-mat-'+key,name,color:fascia||key==='lower-clad'||key==='bonnet-stripes'||key.endsWith('-duct')?'#ffffff':key==='guideMilk'?'#e5eaf0':g.materials[key],
  texture:!texture?null:fascia?fasciaInsertTexture(g,fascia):key==='lower-clad'?claddingTexture(g):key==='bonnet-stripes'?stripeTexture(g):key==='quarter-duct'?ductTexture(g,quarterDuctMask):key==='fender-duct'?ductTexture(g,fenderGillMask):key==='side-duct'?ductTexture(g,sideDuctMask):key==='cowl-duct'?ductTexture(g,cowlDuctMask,g.body.cowlDuctAccent>0):key==='glass'?solidTexture(g.components.glass.type==='tinted'?'#ffffff70':'#ffffff48'):key==='opticCover'?solidTexture('#ffffff31'):key==='rubber'?wheelTireTexture(g.components.tires.type,g.components.tires.shape,g.components.tires.depth):key==='rotor'?wheelRotorTexture():null,
  automotive:{preset:key==='rubber'?'rubber':preset,creaseAngle:0, ...maps,...(rimFace?{roughness:.27}:{}),...(key==='whitewall'?{roughness:.94,metalness:0}:{}),...(key==='ductMatte'?{roughness:.97,metalness:0}:{}),...(key==='rotor'?{roughness:1,metalness:1}:{}),...(key==='barrel'?{roughness:1,metalness:1}:{}),...(key==='guideMilk'?{metalness:0,roughness:.32}:{}),...(key==='opticSilver'?{metalness:.86,roughness:.26}:{}),...(preset==='paint'?{paintCalibration:true,
    ...(g.construction.finish.paintRoughness!==.44?{roughness:g.construction.finish.paintRoughness}:{}),
    ...(g.construction.finish.coatRoughness!==.12?{paintClearcoatRoughness:g.construction.finish.coatRoughness}:{})}:{} )}};
}
export const GAMEPLAY_TRIANGLE_BUDGET=15000;
const gameQualities=new Set(['drive','opponent','lod']);
function triangles(geometry,visit){
 const a=geometry.attributes.position,idx=geometry.index;
 const count=idx?.count??a.count,at=i=>[a.getX(i),a.getY(i),a.getZ(i)];let valid=0;
 for(let j=0;j<count;j+=3){
  const k=idx?[idx.getX(j),idx.getX(j+1),idx.getX(j+2)]:[j,j+1,j+2];
  const [p,q,r]=k.map(at),u=p.map((v,i)=>q[i]-v),v=p.map((v,i)=>r[i]-v);
  if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10)continue;
  valid++;if(visit)visit(k);
 }
 return valid;
}
const emitted=parts=>parts.reduce((n,p)=>n+triangles(p.geometry),0);
function gameplayDesign(genome,quality){
 if(!gameQualities.has(quality))return {design:generateVehicle(genome,{quality}),tier:0};
 let last=null;
 // Reduce independently tessellated parts before writing any document. Never
 // drop arbitrary faces: the apertures, seams and all wheel copies survive.
 for(const tier of quality==='drive'?[1,2,3]:[2,3]){
  const design=generateVehicle(genome,{quality,compact:tier});
  const total=emitted(design.parts)+2*(emitted(design.wheelParts)+emitted(design.rearWheelParts??design.wheelParts));
  if(!design.diagnostics.issues.length&&total<=GAMEPLAY_TRIANGLE_BUDGET)return {design,tier};
  last=design.diagnostics.issues.length?design.diagnostics.issues.join(' '):
   'Vehicle requires '+total.toLocaleString('en-US')+' triangles. Gameplay limit is '+GAMEPLAY_TRIANGLE_BUDGET.toLocaleString('en-US')+' including the four wheels.';
  disposeDesign(design);
 }
 throw Error(last??'Unable to fit the gameplay triangle budget.');
}
function encodeModel(design,parts,name,joints={}){
 const model=createModelDocument(name),used=new Set(parts.map(p=>p.material));model.materials=[...used].map(key=>materialDoc(design.genome,key));
 for(const {geometry,material,component} of parts){
  const a=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,ids=[];
  for(let j=0;j<a.count;j++){
   const position=[a.getX(j),a.getY(j),a.getZ(j)];const id='v-'+model.nextId++;
   model.vertices.push({id,position,weights:[]});ids.push(id);
  }
  triangles(geometry,k=>{
   model.faces.push({id:'f-'+model.nextId++,vertices:k.map(i=>ids[i]),
    uv:k.map(i=>uv?[uv.getX(i),uv.getY(i)]:[0,0]),
    cornerNormals:k.map(i=>[n.getX(i),n.getY(i),n.getZ(i)]),material:'studio-mat-'+material,component});
  });
 }
 for(const [name,position] of Object.entries(joints)){
  const rot=name.startsWith('Taillight')?[0,1,0,0]:[0,0,0,1];
  model.joints.push({id:'joint-'+model.nextId++,name,position,rotation:rot,scale:[1,1,1],parent:null});
 }
 return validateModelDocument(model);
}
export function exportVehicle(genome,{id=null,quality='drive'}={}){
 const {design,tier}=gameplayDesign(genome,quality);
 try{
  if(design.diagnostics.issues.length)throw Error(design.diagnostics.issues.join(' '));
  const g=design.genome,d=design.metadata,slug=g.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,49)||'design';
  const ref=id??'studio-'+slug,body=ref+'-body',wheel=ref+'-wheel';
  const mounts={...design.lampMounts,...Object.fromEntries(Object.entries(design.wheels).map(([k,p])=>['WheelMount_'+k.toUpperCase(),p]))};
  const builtIns=createBuiltInRaceCars(),car=structuredClone(builtIns[g.family==='sedan'?0:1]);
  const cg=Math.min(.71,Math.max(.36,d.heightM*.354+(d.rideHeightM-.145)*.45)),fraction=g.family==='sedan'?.59:g.family==='fastback'?.46:.53;
  const cgZ=d.wheelbaseM*(fraction-.5),wheelIn=Math.round(g.dimensions.rimRatio*g.dimensions.diameter/.0254);
  Object.assign(car,{id:ref,name:g.name,description:'Experimental vehicle generated by 3D Car Design Studio.',dimensions:{...d},camera:{trackingMode:'dynamic-fixed'}});
  delete car.__systemPreset;
  const tune={...car.tuning};
  // Physics derives its colliders and suspension from the new dimensions.
  // Never carry geometry-derived collider pieces over from a donor.
  delete tune.physics;
  const suspensionRide=Math.max(.1,Math.min(1,(d.rideHeightM-.075)/.125));
  car.tuning={...tune,...d,cgHeightM:cg,frontWeightDistribution:fraction,
   rideHeightFront:suspensionRide,rideHeightRear:suspensionRide,groundClearanceM:d.rideHeightM,
   physics:{bodyShapePreset:'car',bodyProfile:{preset:'car',overallLengthM:d.lengthM,overallWidthM:d.widthM,overallHeightM:d.heightM,
    groundClearanceM:d.rideHeightM,wheelRadiusM:d.wheelRadiusM,trackWidthM:d.trackWidthM,wheelWellAware:true,
    cgPositionM:{x:0,y:cg,z:0},frontOverhangM:g.dimensions.front,rearOverhangM:g.dimensions.rear,
    frontAxleDistanceFromCgM:d.wheelbaseM*(1-fraction),rearAxleDistanceFromCgM:d.wheelbaseM*fraction,
    lowerBodyHeightM:d.heightM*g.dimensions.belt-d.rideHeightM,
    hood:{heightM:.27,lengthM:d.wheelbaseM/2+g.dimensions.front-design.stations.cabinFront,widthM:d.widthM*.9},
    cabin:{heightM:d.heightM*(1-g.dimensions.belt),lengthM:design.stations.cabinFront-design.stations.cabinRear,
     widthM:d.widthM*g.dimensions.cabinWidth,centerZM:(design.stations.cabinFront+design.stations.cabinRear)*.5-cgZ}}}};
  if(g.dimensions.rearWheelRadiusDelta){
   const f=d.wheelRadiusM,r=f+g.dimensions.rearWheelRadiusDelta;
   car.tuning.wheelRadiusByWheelM={fl:f,fr:f,rl:r,rr:r};
  }
  if(g.family==='sedan'){
   car.tuning.drivetrain='awd';car.tuning.engineDisplacementL=2.5;car.tuning.aspiration='Turbocharged';
   car.tuning.engineCurve={rpmMin:750,rpmMax:7200,torquePoints:[{rpm:750,torqueLbFt:120},{rpm:1800,torqueLbFt:225},{rpm:4000,torqueLbFt:300},{rpm:6000,torqueLbFt:262.6},{rpm:7200,torqueLbFt:180}]};
   car.tuning.gearRatios=[3.636,2.375,1.761,1.346,.971,.756];car.tuning.gearFinalDrive=3.9;
   if(car.transmissions?.manual)Object.assign(car.transmissions.manual,{gearRatios:[...car.tuning.gearRatios],gearFinalDrive:3.9,reverseRatio:3.545});
  }
  car.setup={...car.setup,tireSize:{wheelDiameterIn:wheelIn,widthMm:Math.round(g.dimensions.tireWidth*1000),
   aspectRatio:Math.round((g.dimensions.diameter-wheelIn*.0254)*50/g.dimensions.tireWidth)}};
  car.art={bodyModel:{ref:body,position:[0,-cg,-cgZ],rotation:[0,0,0],scale:[1,1,1]},
   wheelModel:{ref:wheel,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},bodyColor:g.materials.paint,cameraView:'third-person'};
  const carDocument={kind:'race-car',schemaVersion:1,car};
  const models={[body]:encodeModel(design,design.parts,g.name+' body',mounts),[wheel]:encodeModel(design,design.wheelParts,g.name+' wheel')};
  if(design.rearWheelParts)models[wheel].rearAxleModel=encodeModel(design,design.rearWheelParts,g.name+' rear wheel');
  const rearTriangles=models[wheel].rearAxleModel?.faces.length??models[wheel].faces.length;
  const carTriangles=models[body].faces.length+2*(models[wheel].faces.length+rearTriangles);
  if(gameQualities.has(quality)&&carTriangles>GAMEPLAY_TRIANGLE_BUDGET)throw Error('Gameplay mesh exceeded the triangle budget.');
  return {kind:'lotg-studio-export',schemaVersion:1,genome:g,car:carDocument,models,
   attachments:mounts,metrics:{...d,quality,tier,triangleBudget:gameQualities.has(quality)?GAMEPLAY_TRIANGLE_BUDGET:null,carTriangles,bodyTriangles:models[body].faces.length,wheelTriangles:models[wheel].faces.length,
    ...(design.rearWheelParts?{rearWheelTriangles:rearTriangles}:{}),
    textureMemory:studioTextureBytes(Object.values(models).flatMap(m=>m.materials)),geometry:auditVehicleGeometry(design)}};
 }finally{disposeDesign(design);}
}
