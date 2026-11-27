import {createGenome as createPanel,normalizeGenome as normalizePanel,buildFender} from '../surfaceStudio/surface.mjs';

export const VERSION=3;
const F=(label,min,max,step)=>({label,min,max,step});
export const GLOBAL={
 wheelbase:F('Wheelbase (m)',2.15,3.35,.005),width:F('Body width (m)',1.52,2.24,.005),height:F('Roof height (m)',1.08,1.91,.005),
 front:F('Front overhang (m)',.68,1.16,.005),rear:F('Rear overhang (m)',.64,1.22,.005),track:F('Track / body width',.73,.89,.005),
 belt:F('Beltline height',.49,.70,.005),box:F('Body boxiness',0,1,.01),stance:F('Ground clearance (m)',.095,.36,.005),
 cabin:F('Cabin position',-.10,.10,.005),cabinLength:F('Cabin length',.39,.62,.005),cabinWidth:F('Cabin width',.60,.90,.005),
 hood:F('Hood length bias',-.13,.13,.005),trunk:F('Trunk length bias',-.13,.13,.005),crown:F('Roof curvature',0,1,.01),
 skirt:F('Body thickness',.65,1.15,.01),frontBox:F('Front boxiness bias',-.5,.5,.01),rearBox:F('Rear boxiness bias',-.5,.5,.01)
};
export const FAMILIES={
 sedan:{label:'Rally sedan · WRX',panel:'wrx',color:'#164bb8',wheel:'#c69a4d',dims:[2.54,1.74,1.44,.91,.965,.8535,.59,.45,.145,-.025,.50,.78,0,0,.5,1,.03,-.05]},
 coupe:{label:'Box-flare street coupe',panel:'e30',color:'#b82c34',wheel:'#bfc9d3',dims:[2.57,1.70,1.365,.72,1.07,.825,.588,.88,.12,-.055,.46,.795,.02,.02,.25,1.04,.09,.02]},
 fastback:{label:'Low wide fastback',panel:'993',color:'#e89325',wheel:'#959ca5',dims:[2.275,1.78,1.24,.82,1.105,.835,.625,.10,.10,.025,.565,.72,-.03,-.08,.88,.94,-.06,.01]}
};
const style=(label,types,shape='roundness')=>({label,types,shape});
export const COMPONENTS={
 hood:style('Hood',['crowned','flat','power bulge'],'crown'), frontFenders:style('Front fenders',['swept','boxed','integrated'],'flare'),
 rearFenders:style('Rear quarters / fenders',['swept','boxed','wide'],'flare'),frontBumper:style('Front bumper',['sport','smooth','rally']),
 rearBumper:style('Rear bumper',['sport','smooth','diffuser']), doors:style('Doors',['four door','two door'],'character line'),
 roof:style('Roof',['crowned','flat','arched'],'curvature'),pillars:style('Pillars',['dark','painted'],'thickness'),
 glass:style('Windshield, rear and side glass',['clear','tinted'],'rake'),rockers:style('Rockers and side skirts',['stock','deep','blade']),
 trunk:style('Trunk / rear deck',['notch','fastback','ducktail'],'crown'),
 headlights:style('Headlights',['swept','rectangular','round']),tails:style('Taillights',['stacked','strip','round']),
 fogs:style('Fog lights',['round','strip','off']),grille:style('Grille',['mesh','bars','closed']),
 scoop:style('Scoop and vents',['scoop','vents','off']),spoiler:style('Spoiler',['wing','lip','off']),
 mirrors:style('Mirrors',['standard','aero']),handles:style('Door handles',['lever','flush']),
 wheels:style('Wheels',['6-spoke','5-spoke','mesh'],'dish'),tires:style('Tires',['road','rally'],'sidewall'),
 exhaust:style('Exhaust',['single','dual','quad']),dash:style('Dashboard',['road','sport']),
 seats:style('Seats',['bucket','touring']),steering:style('Steering wheel',['round','flat-bottom']),
 instruments:style('Instrument cluster',['analog','digital']),console:style('Center console',['manual','automatic'])
};
export const NOSE_PROFILES={square:'Square / classic',round:'Rounded / rally',v:'Pointed V / hypercar'};
export const NOSE_FIELDS={sweep:F('Corner sweep',0,1,.01),rollover:F('Hood-to-bumper roll',0,1,.01),drop:F('Nose drop',0,1,.01)};
const NOSE_DEFAULTS={sedan:{profile:'round',sweep:.55,rollover:.56,drop:.30},coupe:{profile:'square',sweep:.33,rollover:.32,drop:.19},fastback:{profile:'round',sweep:.70,rollover:.65,drop:.51}};
export const FASCIA_PROFILES={...NOSE_PROFILES,aero:'Tapered / aero'};
export const INTAKE_TYPES={single:'Central opening',split:'Split ducts',closed:'Closed skin'};
const unit=label=>F(label,0,1,.01),signed=label=>F(label,-1,1,.01);
export const FASCIA_FIELDS={
 sweep:unit('Corner sweep'),pointedness:unit('Pointedness'),center:unit('Center projection'),roundness:unit('Horizontal roundness'),
 taper:unit('Width taper'),drop:unit('End drop'),verticalRoundness:unit('Vertical roundness'),rake:signed('Fascia rake'),
 rollover:unit('Upper rollover'),lowerRoll:unit('Lower rollover'),wrap:unit('Fender wraparound'),
 shoulder:unit('Shoulder crown'),chin:signed('Chin / diffuser projection'),recess:unit('Center recess'),crease:unit('Character crease'),boxiness:unit('Regional boxiness')
};
export const OPTIC_HOUSINGS={'circle':'Circular',oval:'Oval',rectangle:'Rectangular','round-rect':'Rounded rectangle',
 trapezoid:'Trapezoidal',angular:'Angular',swept:'Swept',wrap:'Wraparound',compound:'Compound'};
export const OPTIC_LAYOUTS={projector:'Single projector',twin:'Twin elements',led:'LED signature',mixed:'Projector + LED'};
export const OPTIC_FIELDS={width:unit('Housing width'),height:unit('Housing height'),corner:unit('Corner radius'),angle:signed('Housing angle'),
 sweep:unit('Housing sweep'),curvature:unit('Lens curvature'),recess:unit('Recess depth'),convexity:unit('Lens convexity'),
 position:unit('Vertical position'),protrusion:unit('Lens protrusion')};
export const FASCIA_DEMOS={classic:'Upright classic',rally:'Rounded sport sedan',hyper:'Pointed hypercar',compound:'Compound-curved sports car'};
const enumValue=(v,choices,key)=>{if(typeof v!=='string'||!Object.hasOwn(choices,v))throw Error('Unknown '+key);return v;};
const cleanList=(v,n,key)=>{if(!Array.isArray(v)||v.length!==n)throw Error('Invalid '+key);return v.map(x=>number(x,{min:-1,max:1},key));};
const initial=(fields,defaults)=>Object.fromEntries(Object.keys(fields).map(k=>[k,defaults[k]??.5]));
function baseFascia(family,front,legacy){
 return {profile:front?legacy.profile:family==='coupe'?'square':family==='fastback'?'aero':'round',intakes:front?'single':family==='fastback'?'split':'closed',
  ...initial(FASCIA_FIELDS,front?{...legacy,taper:.26,center:.82,wrap:.68,rake:.10,recess:.08,crease:.16,chin:0,boxiness:family==='coupe'?.78:.34,pointedness:0}:
  {sweep:.46,taper:.37,drop:.20,rollover:.50,lowerRoll:.60,center:.78,wrap:.64,rake:.16,recess:.05,crease:.14,chin:-.12,boxiness:family==='coupe'?.77:.41,pointedness:0}),
  curves:{plan:[0,0,0,0],vertical:[0,0,0,0],transverse:[0,0,0,0]}};
}
function baseOptic(family,front){return {
 housing:front?(family==='coupe'?'round-rect':family==='fastback'?'oval':'swept'):(family==='fastback'?'wrap':'trapezoid'),
 layout:front?'mixed':'led',...initial(OPTIC_FIELDS,{angle:0,width:.58,height:.54,position:.46,recess:.53,protrusion:0}),outline:Array(8).fill(0)
};}
export function createFasciaDemo(key){
 if(!Object.hasOwn(FASCIA_DEMOS,key))throw Error('Unknown fascia demonstration');
 const family=key==='classic'?'coupe':key==='rally'?'sedan':'fastback',g=createVehicle(family);
 g.name=FASCIA_DEMOS[key];
 const {front:f,rear:r}=g.fascia,{front:h,rear:t}=g.optics,d=g.dimensions,c=g.components;
 if(key==='classic'){
  Object.assign(d,{height:1.46,belt:.587,cabinLength:.54,front:.87,box:.95});c.doors.type='four door';
  Object.assign(f,{profile:'square',sweep:.24,drop:.05,boxiness:.96,roundness:.10,rake:-.1,crease:.58,taper:.06,rollover:.17});
  Object.assign(r,{profile:'square',sweep:.22,drop:.09,boxiness:.93,rollover:.24,intakes:'closed'});
  Object.assign(h,{housing:'rectangle',layout:'twin',width:.66,height:.68});Object.assign(t,{housing:'round-rect',layout:'twin',width:.67,height:.45});
  c.grille.type='bars';c.fogs.type='off';g.materials.paint='#a2352c';
 }else if(key==='rally'){
  Object.assign(f,{profile:'round',sweep:.75,drop:.26,shoulder:.47,roundness:.78,rollover:.66,recess:.17});
  Object.assign(r,{profile:'round',sweep:.56,drop:.25,intakes:'closed'});
  Object.assign(h,{housing:'swept',layout:'mixed',width:.73,height:.59});Object.assign(t,{housing:'trapezoid',layout:'twin',width:.66,height:.65});
 }else if(key==='hyper'){
  Object.assign(d,{height:1.14,belt:.69,width:1.99,front:1.09,rear:1.08,cabinWidth:.61,track:.81,cabin:-.03,hood:-.035});c.headlights.type='swept';c.scoop.type='off';c.spoiler.type='wing';c.fogs.type='off';c.rearBumper.type='diffuser';c.exhaust.type='quad';c.glass.type='tinted';
  Object.assign(f,{profile:'v',sweep:.96,center:1,pointedness:.77,drop:.85,taper:.56,rollover:.78,rake:.58,shoulder:.46,intakes:'split',recess:.18});
  Object.assign(r,{profile:'aero',sweep:.7,taper:.69,drop:.36,chin:-.51,lowerRoll:.82,intakes:'split',crease:.69});
  Object.assign(h,{housing:'angular',layout:'led',width:.67,height:.49,sweep:.75,position:.19});Object.assign(t,{housing:'compound',layout:'led',width:.86,height:.30});
  g.materials.paint='#8334a2';g.materials.wheel='#9aa6b3';
 }else{
  Object.assign(d,{width:1.90,front:.98,rear:1.07,cabinWidth:.71,hood:-.02});c.scoop.type='off';c.spoiler.type='lip';c.fogs.type='off';
  Object.assign(f,{profile:'round',sweep:.84,shoulder:.98,drop:.57,wrap:.93,roundness:.80,rollover:.9,lowerRoll:.76,intakes:'split',recess:.23,curves:{plan:[.08,-.21,.07,.14],vertical:[0,.19,.10,0],transverse:[.09,-.18,.55,.38]}});
  Object.assign(r,{profile:'aero',sweep:.85,taper:.85,shoulder:.78,drop:.40,intakes:'single'});
  Object.assign(h,{housing:'wrap',layout:'twin',corner:.74,recess:.81,position:.24,width:.68,height:.69});Object.assign(t,{housing:'wrap',layout:'led',width:.79,height:.41,position:.30});
  g.materials.paint='#16766b';g.materials.wheel='#b5bfc6';
 }
 return normalizeVehicle(g);
}

export const SEAM_KEYS={
 rearFenderSeam:'Rear bumper to quarter',rearDoorSeam:'Rear door to quarter',centerDoorSeam:'Door center line',
 frontDoorSeam:'Front door to fender',frontFenderSeam:'Front bumper to fender',hoodSeam:'Hood leading edge',
 trunkSeam:'Trunk trailing edge',roofSeam:'Roof to glass surround'
};
export const SEAM_FIELDS={
 gap:F('Gap width (mm)',.0015,.012,.0005),offset:F('Seam position (m)',-.04,.04,.001),
 flush:F('Panel flushness (mm)',-.006,.006,.00025),radius:F('Edge rollover (mm)',.0005,.005,.0005),
 thickness:F('Panel thickness (mm)',.0008,.004,.0002),depth:F('Recess depth (mm)',.004,.028,.001),
 flange:F('Return flange',0,1,.05),seal:F('Rubber seal',0,1,.05),align:F('Boundary alignment',0,1,.025),
 tangent:F('Match tangents',0,1,.025),curvature:F('Match curvature',0,1,.025),crease:F('Keep an intentional crease',0,1,.025)
};
export const BODY_FIELDS={
 creaseHeight:F('Crease height',.14,.59,.005),creaseStrength:F('Crease definition',0,1,.01),
 archCrown:F('Wheel-arch crown',0,1,.01),roofEdge:F('Roof-edge radius',0,1,.01),
 handleRecess:F('Door-handle recess',0,1,.01)
};
const SEAM_DEFAULT={gap:.0045,offset:0,flush:0,radius:.0016,thickness:.0012,depth:.012,flange:.82,seal:0,align:1,tangent:.92,curvature:.84,crease:0};
const defaultSeams=()=>Object.fromEntries(Object.keys(SEAM_KEYS).map(k=>[k,{...SEAM_DEFAULT,...(k==='roofSeam'?{gap:.0032,seal:.88}:{}),...(k==='hoodSeam'||k==='trunkSeam'?{seal:.55}:{})}]));

export const POSITIONABLE=new Set(['headlights','tails','fogs','scoop','spoiler','mirrors','exhaust']);
export const COMPONENT_FIELDS={bias:F('Mount position bias',-1,1,.025),angle:F('Pitch or rake (°)',-12,12,.5),size:F('Size',.72,1.28,.01),shape:F('Shape',0,1,.01),depth:F('Depth',.72,1.28,.01),...NOSE_FIELDS};
const defaults={coupe:{doors:1,headlights:1,trunk:0,roof:1,wheels:2,spoiler:1,grille:1,scoop:2},fastback:{doors:1,headlights:2,tails:1,trunk:1,roof:2,wheels:1,frontBumper:1,scoop:1,spoiler:1}};
const number=(value,spec,key)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<spec.min-1e-9||value>spec.max+1e-9)throw Error('Out of range: '+key);return value;};
export const TOTAL_LENGTH=F('Overall length (m)',3.47,5.73,.005);
export const PATCH_PANELS=['hood','roof','trunk'];
export const PATCH_RANGE=F('Interior patch height (m)',-.045,.045,.001);
export const DIMENSIONS={diameter:F('Tire diameter (m)',.54,.76,.002),tireWidth:F('Tire width (m)',.16,.33,.002),rimRatio:F('Rim / tire diameter',.55,.83,.005),gap:F('Panel gap (m)',.002,.012,.001)};
const MAT={paint:'#164bb8',wheel:'#c69a4d',glass:'#698292',rubber:'#171a20',trim:'#22262b',chrome:'#a3abb5',head:'#d9e7fb',tail:'#b61728',interior:'#292d36',seat:'#363b48',floor:'#303843',opticCover:'#e0efff',indicator:'#f29b38',seamDark:'#141b23',projector:'#7990a0',reflector:'#a2abb1'};
export function createVehicle(family='sedan'){
 if(!Object.hasOwn(FAMILIES,family))throw Error('Unknown body family');
 const f=FAMILIES[family];
 return {kind:'lotg-vehicle-design',schemaVersion:1,generatorVersion:VERSION,name:f.label,family,
 dimensions:{...Object.fromEntries(Object.keys(GLOBAL).map((k,i)=>[k,f.dims[i]])),diameter:family==='fastback'?.635:.634,tireWidth:family==='fastback'?.235:.225,rimRatio:.681},
 components:Object.fromEntries(Object.entries(COMPONENTS).map(([k,c])=>[k,{type:c.types[defaults[family]?.[k]??0],size:1,shape:.5,depth:1,...(k==='frontBumper'?NOSE_DEFAULTS[family]:{}),...(POSITIONABLE.has(k)?{bias:0,angle:0}:{})}])),
 fascia:Object.fromEntries(['front','rear'].map(end=>[end,baseFascia(family,end==='front',NOSE_DEFAULTS[family])])),
 optics:Object.fromEntries(['front','rear'].map(end=>[end,baseOptic(family,end==='front')])),
 seams:defaultSeams(),body:{creaseHeight:.31,creaseStrength:.40,archCrown:.52,roofEdge:.47,handleRecess:.49},
 surfaces:{frontFenders:createPanel(f.panel),...Object.fromEntries(PATCH_PANELS.map(key=>[key,{kind:'bicubic-interior-v1',points:[0,0,0,0]}]))}, constraints:{gap:.005,archClearance:.045,partition:'shared-stations-v1'},
 materials:{...MAT,paint:f.color,wheel:f.wheel}, attachments:{schema:'axles-and-optics-v1'}};
}
export function normalizeVehicle(x){
 if(!x||x.kind!=='lotg-vehicle-design'||x.schemaVersion!==1||![1,2,VERSION].includes(x.generatorVersion))throw Error('Unsupported vehicle design version');
 const g=createVehicle(x.family);
 g.name=String(x.name??g.name).trim().slice(0,80)||g.name;
 for(const [k,v] of Object.entries(x.dimensions??{})){const f=GLOBAL[k]??DIMENSIONS[k];if(!f||k==='gap')throw Error('Unknown dimension '+k);g.dimensions[k]=number(v,f,k);}
 for(const [k,v] of Object.entries(x.components??{})){
  if(!Object.hasOwn(COMPONENTS,k)||!v||typeof v!=='object')throw Error('Unknown component '+k);
  if(v.type!==undefined){if(!COMPONENTS[k].types.includes(v.type))throw Error('Unknown '+k+' type');g.components[k].type=v.type;}
  if(k==='frontBumper'&&v.profile!==undefined){
   if(!Object.hasOwn(NOSE_PROFILES,v.profile))throw Error('Unknown front nose profile');
   g.components[k].profile=v.profile;
  }
  for(const s of Object.keys(g.components[k]).filter(f=>f!=='type'&&f!=='profile'))if(v[s]!==undefined)g.components[k][s]=number(v[s],COMPONENT_FIELDS[s],k+'.'+s);
 }
 for(const end of ['front','rear']){
  const front=end==='front',b=g.components.frontBumper,f=g.fascia[end],o=g.optics[end],raw=x.fascia?.[end],opt=x.optics?.[end];
  if(!raw&&front){for(const k of ['profile','sweep','rollover','drop'])f[k]=b[k];}
  if(x.generatorVersion===1&&!opt){
   const old=g.components[front?'headlights':'tails'];
   o.housing=({round:'circle',rectangular:'rectangle',strip:'wrap',stacked:'trapezoid',swept:'swept'})[old.type]??o.housing;
   o.width=math.clamp(.5+(old.size-1));o.height=math.clamp(.5+(old.depth-1));o.angle=old.angle/12;
   o.position=math.clamp(.5-old.bias*.2);
  }
  if(raw){
   if(raw.profile!==undefined)f.profile=enumValue(raw.profile,FASCIA_PROFILES,end+' profile');
   if(raw.intakes!==undefined)f.intakes=enumValue(raw.intakes,INTAKE_TYPES,end+' intakes');
   for(const [k,spec] of Object.entries(FASCIA_FIELDS))if(raw[k]!==undefined)f[k]=number(raw[k],spec,end+'.'+k);
   for(const k of ['plan','vertical','transverse'])if(raw.curves?.[k]!==undefined)f.curves[k]=cleanList(raw.curves[k],4,end+'.'+k);
  }
  if(opt){
   if(opt.housing!==undefined)o.housing=enumValue(opt.housing,OPTIC_HOUSINGS,end+' housing');
   if(opt.layout!==undefined)o.layout=enumValue(opt.layout,OPTIC_LAYOUTS,end+' optical layout');
   for(const [k,spec] of Object.entries(OPTIC_FIELDS))if(opt[k]!==undefined)o[k]=number(opt[k],spec,end+'.'+k);
   if(opt.outline!==undefined)o.outline=cleanList(opt.outline,8,end+' housing outline');
  }
  if(front)for(const k of ['profile','sweep','rollover','drop'])b[k]=k==='profile'&&f[k]==='aero'?'round':f[k];
 }
 for(const [k,v] of Object.entries(x.materials??{})){
  if(!Object.hasOwn(MAT,k)||typeof v!=='string'||!/^#[a-f\d]{6}$/i.test(v))throw Error('Invalid material '+k);
  g.materials[k]=v.toLowerCase();
 }
 if(x.surfaces?.frontFenders)g.surfaces.frontFenders=normalizePanel(x.surfaces.frontFenders);
 for(const key of PATCH_PANELS){
  const p=x.surfaces?.[key];if(p===undefined)continue;
  if(p.kind!=='bicubic-interior-v1'||!Array.isArray(p.points)||p.points.length!==4)throw Error('Invalid surface patch '+key);
  g.surfaces[key]={kind:p.kind,points:p.points.map(v=>number(v,PATCH_RANGE,key))};
 }
 if(x.constraints?.gap!==undefined)g.constraints.gap=number(x.constraints.gap,DIMENSIONS.gap,'gap');
 for(const key of Object.keys(SEAM_KEYS)){
  const row=x.seams?.[key];
  if(!row&&x.constraints?.gap!==undefined&&key!=='roofSeam')g.seams[key].gap=g.constraints.gap;
  if(row)for(const [k,spec] of Object.entries(SEAM_FIELDS))if(row[k]!==undefined)g.seams[key][k]=number(row[k],spec,key+'.'+k);
 }
 for(const [k,spec] of Object.entries(BODY_FIELDS))if(x.body?.[k]!==undefined)g.body[k]=number(x.body[k],spec,k);
 return g;
}
export function evaluateInteriorPatch(points,u,v){
 const a=3*u*(1-u)*(1-u),b=3*u*u*(1-u),c=3*v*(1-v)*(1-v),d=3*v*v*(1-v);
 return a*c*points[0]+a*d*points[1]+b*c*points[2]+b*d*points[3];
}
export const serializeVehicle=g=>JSON.stringify(normalizeVehicle(g),null,2)+'\n';
export const loadVehicle=s=>normalizeVehicle(JSON.parse(s));
export function updateDesign(x,domain,key,value,property){
 const g=normalizeVehicle(x);
 if(domain==='family')return createVehicle(value);
 if(domain==='name')g.name=value;
 else if(domain==='components'&&Object.hasOwn(COMPONENTS,key)&&Object.hasOwn(g.components[key],property)){
  g.components[key][property]=value;
  if(key==='frontBumper'&&['profile','sweep','rollover','drop'].includes(property))g.fascia.front[property]=value;
  if(['headlights','tails'].includes(key)){
   const o=g.optics[key==='headlights'?'front':'rear'];
   if(property==='type')o.housing=({round:'circle',rectangular:'rectangle',strip:'wrap',stacked:'trapezoid',swept:'swept'})[value];
   if(property==='size')o.width=math.clamp(.5+(value-1));if(property==='depth')o.height=math.clamp(.5+(value-1));
   if(property==='shape')o.corner=value;if(property==='angle')o.angle=value/12;if(property==='bias')o.position=math.clamp(.5-value*.2);
  }
 }
 else if(['fascia','optics'].includes(domain)&&['front','rear'].includes(key)&&Object.hasOwn(g[domain][key],property)){
  g[domain][key][property]=value;
  if(domain==='fascia'&&key==='front'&&['profile','sweep','rollover','drop'].includes(property))g.components.frontBumper[property]=property==='profile'&&value==='aero'?'round':value;
 }
 else if(domain==='seams'&&Object.hasOwn(SEAM_KEYS,key)&&Object.hasOwn(SEAM_FIELDS,property))g.seams[key][property]=value;
 else if(domain==='body'&&Object.hasOwn(BODY_FIELDS,key))g.body[key]=value;
 else if(domain==='surfaces'&&Object.hasOwn(g.surfaces,key))g.surfaces[key]=value;
 else if(domain==='dimensions'&&key==='length'){
  const v=number(value,TOTAL_LENGTH,key),d=g.dimensions,sum=v-d.wheelbase;
  const lo=Math.max(GLOBAL.front.min,sum-GLOBAL.rear.max),hi=Math.min(GLOBAL.front.max,sum-GLOBAL.rear.min);
  if(lo>hi)throw Error('Overall length is outside the available overhangs at this wheelbase.');
  d.front=Math.max(lo,Math.min(hi,sum*d.front/(d.front+d.rear)));d.rear=sum-d.front;
 }
 else if(['dimensions','materials','constraints'].includes(domain)&&Object.hasOwn(g[domain],key)){
  if(domain==='constraints'&&key==='gap'){
   const old=g.constraints.gap;
   for(const [seam,s] of Object.entries(g.seams))if(seam!=='roofSeam'&&(s.gap===old||s.gap===.0045))s.gap=value;
  }
  g[domain][key]=value;
 }
 else throw Error('Unknown design property');
 return normalizeVehicle(g);
}
export function createDesignSession(initial=createVehicle()){
 let genome=normalizeVehicle(initial),undo=[],redo=[];
 const get=()=>structuredClone(genome);
 return {get,canUndo:()=>undo.length>0,canRedo:()=>redo.length>0,
 replace(next,{record=true}={}){next=normalizeVehicle(next);if(JSON.stringify(next)===JSON.stringify(genome))return get();
  if(record){undo.push(genome);if(undo.length>80)undo.shift();redo=[];}genome=next;return get();},
 edit(domain,key,value,property,opts){return this.replace(updateDesign(genome,domain,key,value,property),opts);},
 undo(){if(undo.length){redo.push(genome);genome=undo.pop();}return get();},redo(){if(redo.length){undo.push(genome);genome=redo.pop();}return get();},
 load(text){return this.replace(loadVehicle(text));},save(){return serializeVehicle(genome);},
 duplicate(){return this.replace({...genome,name:genome.name.slice(0,72)+' Copy'});},reset(){return this.replace(createVehicle(genome.family));}
 };
}
export const math={mix:(a,b,t)=>a+(b-a)*t, clamp:(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),buildFender};
