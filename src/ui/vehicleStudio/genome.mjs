import {createGenome as createPanel,normalizeGenome as normalizePanel,buildFender} from '../surfaceStudio/surface.mjs';

export const VERSION=1;
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
export const POSITIONABLE=new Set(['headlights','tails','fogs','scoop','spoiler','mirrors','exhaust']);
export const COMPONENT_FIELDS={bias:F('Mount position bias',-1,1,.025),angle:F('Pitch or rake (°)',-12,12,.5),size:F('Size',.72,1.28,.01),shape:F('Shape',0,1,.01),depth:F('Depth',.72,1.28,.01),...NOSE_FIELDS};
const defaults={coupe:{doors:1,headlights:1,trunk:0,roof:1,wheels:2,spoiler:1,grille:1,scoop:2},fastback:{doors:1,headlights:2,tails:1,trunk:1,roof:2,wheels:1,frontBumper:1,scoop:1,spoiler:1}};
const number=(value,spec,key)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<spec.min-1e-9||value>spec.max+1e-9)throw Error('Out of range: '+key);return value;};
export const TOTAL_LENGTH=F('Overall length (m)',3.47,5.73,.005);
export const PATCH_PANELS=['hood','roof','trunk'];
export const PATCH_RANGE=F('Interior patch height (m)',-.045,.045,.001);
export const DIMENSIONS={diameter:F('Tire diameter (m)',.54,.76,.002),tireWidth:F('Tire width (m)',.16,.33,.002),rimRatio:F('Rim / tire diameter',.55,.83,.005),gap:F('Panel gap (m)',.002,.012,.001)};
const MAT={paint:'#164bb8',wheel:'#c69a4d',glass:'#698292',rubber:'#171a20',trim:'#22262b',chrome:'#a3abb5',head:'#d9e7fb',tail:'#b61728',interior:'#292d36',seat:'#363b48',floor:'#303843'};
export function createVehicle(family='sedan'){
 if(!Object.hasOwn(FAMILIES,family))throw Error('Unknown body family');
 const f=FAMILIES[family];
 return {kind:'lotg-vehicle-design',schemaVersion:1,generatorVersion:VERSION,name:f.label,family,
 dimensions:{...Object.fromEntries(Object.keys(GLOBAL).map((k,i)=>[k,f.dims[i]])),diameter:family==='fastback'?.635:.634,tireWidth:family==='fastback'?.235:.225,rimRatio:.681},
 components:Object.fromEntries(Object.entries(COMPONENTS).map(([k,c])=>[k,{type:c.types[defaults[family]?.[k]??0],size:1,shape:.5,depth:1,...(k==='frontBumper'?NOSE_DEFAULTS[family]:{}),...(POSITIONABLE.has(k)?{bias:0,angle:0}:{})}])),
 surfaces:{frontFenders:createPanel(f.panel),...Object.fromEntries(PATCH_PANELS.map(key=>[key,{kind:'bicubic-interior-v1',points:[0,0,0,0]}]))}, constraints:{gap:.005,archClearance:.045,partition:'shared-stations-v1'},
 materials:{...MAT,paint:f.color,wheel:f.wheel}, attachments:{schema:'axles-and-optics-v1'}};
}
export function normalizeVehicle(x){
 if(!x||x.kind!=='lotg-vehicle-design'||x.schemaVersion!==1||x.generatorVersion!==VERSION)throw Error('Unsupported vehicle design version');
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
 else if(domain==='components'&&Object.hasOwn(COMPONENTS,key)&&Object.hasOwn(g.components[key],property))g.components[key][property]=value;
 else if(domain==='surfaces'&&Object.hasOwn(g.surfaces,key))g.surfaces[key]=value;
 else if(domain==='dimensions'&&key==='length'){
  const v=number(value,TOTAL_LENGTH,key),d=g.dimensions,sum=v-d.wheelbase;
  const lo=Math.max(GLOBAL.front.min,sum-GLOBAL.rear.max),hi=Math.min(GLOBAL.front.max,sum-GLOBAL.rear.min);
  if(lo>hi)throw Error('Overall length is outside the available overhangs at this wheelbase.');
  d.front=Math.max(lo,Math.min(hi,sum*d.front/(d.front+d.rear)));d.rear=sum-d.front;
 }
 else if(['dimensions','materials','constraints'].includes(domain)&&Object.hasOwn(g[domain],key))g[domain][key]=value;
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
