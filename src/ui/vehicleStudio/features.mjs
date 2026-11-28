import {getSideSettings,STYLE_FIELDS,STYLE_KINDS,BODY_FIELDS,SEAM_FIELDS,FASCIA_FIELDS,FASCIA_PROFILES,OPTIC_FIELDS,OPTIC_HOUSINGS,OPTIC_LAYOUTS,COMPONENTS,COMPONENT_FIELDS,GLOBAL,DIMENSIONS,normalizeVehicle,updateDesign,math} from './genome.mjs';
const {clamp,mix}=math;
const options=vals=>Array.isArray(vals)?vals.map(k=>[k,k]):Object.entries(vals);
const choice=(label,vals)=>({label,type:'select',options:options(vals)});
const componentType=k=>choice(COMPONENTS[k].label+' style',COMPONENTS[k].types);
const c=(d,k,p,s)=>({domain:d,key:k,property:p,...s});
const field=(d,k,...names)=>names.map(n=>c(d,k,n,d==='seams'?SEAM_FIELDS[n]:d==='fascia'?FASCIA_FIELDS[n]:d==='optics'?OPTIC_FIELDS[n]:COMPONENT_FIELDS[n]));
const simple=(d,spec,...names)=>names.map(n=>c(d,n,undefined,spec[n]));
const fascia=(end,...names)=>field('fascia',end,...names);
const optic=(end,...names)=>field('optics',end,...names);
const body=(...names)=>simple('body',BODY_FIELDS,...names);
const dims=(...names)=>simple('dimensions',{...GLOBAL,...DIMENSIONS},...names);
const featureEnd=f=>f.end??(['rearBumper','rearFenders','trunk','tails','exhaust','spoiler'].includes(f.component)?'rear':'front');
export function featureControls(genome,feature,level='basic'){
 if(!feature?.type)return [];
 const g=normalizeVehicle(genome),f=feature,end=featureEnd(f),k=f.key??f.id,more=level!=='basic',expert=level==='expert';
 const seam=g.seams[k];
 let entries=[];
 switch(f.type){
 case 'seam':
  if(!seam)break;
  entries=field('seams',k,'gap','flush','radius');
  if(more)entries.push(...field('seams',k,'offset','thickness','depth','flange','seal'),...fascia(end,'wrap','rollover','shoulder',...(k.endsWith('FenderSeam')?['sideRailFairing']:[])));
  if(expert)entries.push(...field('seams',k,'align','tangent','curvature','crease'));
  break;
 case 'lamp':
  entries=[c('optics',end,'housing',choice('Housing shape',OPTIC_HOUSINGS)),...optic(end,'width','height','recess')];
  if(more)entries.push(...optic(end,'position','outboard','inboardReach','corner','angle','sweep','curvature','convexity','protrusion',...(end==='rear'?['tallHousing']:[])),c('optics',end,'layout',choice('Optical layout',OPTIC_LAYOUTS)));
  break;
 case 'roof':
 case 'glass-edge':
  entries=[...dims('crown','cabinWidth'),...body('roofEdge')];
  if(more)entries.push(...field('components','glass','depth','shape'),...field('components','pillars','size','depth','shape'));
  break;
 case 'style-curve':{
  const row=g.construction.features.find(r=>r.id===k);if(!row)break;
  const d=p=>c('styleFeature',k,p,STYLE_FIELDS[p]);
  entries=[c('styleFeature',k,'kind',choice('Styling type',STYLE_KINDS)),d('height'),d('depth'),d('width')];
  if(more)entries.push(...['sharpness','falloff','start','end'].map(d));
  break;
 }
 case 'crease':
  entries=g.body.doorStamp?body('doorStampHeight','doorStamp'):body('creaseHeight','creaseStrength');
  if(more&&g.body.doorStamp)entries.push(...body('doorStampWidth','doorStampFade','doorStampFront','doorStampRear','doorStampSweep'));
  if(more&&!g.body.doorStamp)entries.push(...fascia(end,'crease','shoulder'),...field('components','doors','shape','depth'));
  break;
 case 'arch':
  entries=[...body('archCrown'),...field('components',f.component,'size','depth')];
  if(more)entries.push(...field('components',f.component,'shape'),...dims('diameter','tireWidth'));
  break;
 case 'silhouette':
 case 'opening':
  entries=[c('fascia',end,'profile',choice('Profile shape',FASCIA_PROFILES)),...fascia(end,'sweep','drop')];
  if(more)entries.push(...fascia(end,'taper','roundness','recess','chin','rollover','shoulder'));
  if(f.component==='grille')entries.push(c('components','grille','type',componentType('grille')),...field('components','grille','size','depth'));
  if(f.component==='fogs')entries.push(c('components','fogs','type',componentType('fogs')),...field('components','fogs','size','depth'));
  break;
 default:{
  const name=f.component??f.key,p=g.components[name];if(!p)break;
  if(name==='headlights'||name==='tails')return featureControls(g,{...f,type:'lamp'},level);
  if(name==='roof'||name==='glass')return featureControls(g,{...f,type:'roof'},level);
  if(name==='frontBumper'||name==='rearBumper')return featureControls(g,{...f,type:'silhouette'},level);
  if(name==='frontFenders'||name==='rearFenders')return featureControls(g,{...f,type:'arch'},level);
  entries=[c('components',name,'type',componentType(name)),...field('components',name,'shape','size'),...(more?field('components',name,'depth'):[])];
  if(name==='wheels'||name==='tires')entries.push(...dims('diameter','tireWidth','rimRatio','rearTireWidthOffset','rearRimRatioOffset','rearWheelRadiusDelta'));
  if(name==='handles')entries.push(...body('handleRecess'));
 }
 }
 const opticGroup=end==='front'?'headlights':'taillights';
 if(f.type==='lamp'&&['L','R'].includes(f.side)&&g.construction.symmetry[opticGroup]==='independent')entries=entries.map(x=>
  x.domain==='optics'?{...x,domain:'sideOptic',key:f.side+':'+end}:x);
 return entries.map(x=>{
  const raw=x.domain==='styleFeature'?g.construction.features.find(r=>r.id===x.key)?.[x.property]:
    x.domain==='sideOptic'?getSideSettings(g,opticGroup,f.side,g.optics[end])[x.property]:x.property===undefined?g[x.domain]?.[x.key]:g[x.domain]?.[x.key]?.[x.property];
  if(raw===undefined)return null;
  if(x.domain==='seams'&&['gap','flush','radius','thickness','depth'].includes(x.property)){
   // Bounds/values stay in meters for the API and sliders, UI can display mm.
   return {...x,label:x.label.replace('(mm)','(m)'),displayScale:1000,displayUnit:'mm',value:raw};
  }
  return {...x,value:raw};
 }).filter(Boolean);
}

const COMMANDS={round:'Round this corner',flatten:'Make this flatter',blend:'Blend into the neighbor',sharp:'Sharpen this crease',
 aggressive:'Make this light more aggressive',gap:'Make the gap smaller',widen:'Widen this fender',box:'Make this less boxy',
 align:'Align the surfaces',tangents:'Match tangents',curvature:'Match curvature',normalize:'Normalize gap and flushness',keep:'Preserve an intentional crease'};
export function featureCommands(f){
 const type=f?.type;if(!type)return [];
 const seq=type==='seam'?['blend','gap','align','tangents','curvature','normalize','keep','round']:
 type==='lamp'||['headlights','tails'].includes(f.component)?['aggressive','round','flatten']:
 ['crease','style-curve'].includes(type)?['sharp','flatten','blend']:type==='arch'||['frontFenders','rearFenders'].includes(f.component)?['widen','round','flatten']:
 ['roof','glass-edge'].includes(type)||['roof','glass'].includes(f.component)?['round','flatten']:
 ['silhouette','opening'].includes(type)||['frontBumper','rearBumper','grille','fogs'].includes(f.component)?['round','flatten','box']:
 type==='component'&&COMPONENTS[f.component]?['round','flatten']:[];
 return seq.map(id=>({id,label:COMMANDS[id]}));
}
export function proposeFeatureEdit(genome,f,command,intensity=.65){
 if(!featureCommands(f).some(x=>x.id===command))throw Error('Operation unavailable for this feature.');
 let g=normalizeVehicle(genome);const changes=[], t=clamp(Number.isFinite(intensity)?intensity:.65);
 const set=(domain,key,property,target,label)=>{
  const current=domain==='styleFeature'?g.construction.features.find(x=>x.id===key)?.[property]:
   domain==='sideOptic'?getSideSettings(g,key.endsWith('front')?'headlights':'taillights',key[0],g.optics[key.slice(2)])[property]:property===undefined?g[domain][key]:g[domain][key][property];
  const val=typeof target==='number'?(t===1?target:mix(current,target,t)):t>0?target:current;
  if(val===current)return;
  g=updateDesign(g,domain,key,val,property);changes.push({domain,key,property,from:current,to:val,label});
 };
 const end=featureEnd(f),seam=f.key??f.id;
 const ss=(k,v)=>set('seams',seam,k,v,SEAM_FIELDS[k].label);
 const ff=(k,v)=>set('fascia',end,k,v,FASCIA_FIELDS[k]?.label??'Fascia shape');
 const group=end==='front'?'headlights':'taillights',independent=f.type==='lamp'&&['L','R'].includes(f.side)&&g.construction.symmetry[group]==='independent';
 const oo=(k,v)=>set(independent?'sideOptic':'optics',independent?f.side+':'+end:end,k,v,OPTIC_FIELDS[k]?.label??'Housing shape');
 const bb=(k,v)=>set('body',k,undefined,v,BODY_FIELDS[k].label);
 const dim=(k,v)=>set('dimensions',k,undefined,v,GLOBAL[k].label);
 if(f.type==='seam'){
  if(['blend','align','normalize'].includes(command)){ss('align',1);ss('flush',0);}
  if(['blend','tangents'].includes(command))ss('tangent',1);
  if(['blend','curvature'].includes(command))ss('curvature',1);
  if(['gap','normalize'].includes(command))ss('gap',command==='gap'?.0025:.004);
  if(command==='round'){ss('radius',.0038);ss('crease',0);}
  if(command==='keep'){ss('crease',.88);ss('align',1);}
 }else if(f.type==='lamp'||['headlights','tails'].includes(f.component)){
  if(command==='aggressive'){oo('housing','angular');oo('sweep',.92);oo('height',.30);oo('recess',.78);}
  if(command==='round'){oo('corner',.90);oo('housing','round-rect');}
  if(command==='flatten'){oo('convexity',.12);oo('protrusion',0);}
 }else if(f.type==='style-curve'){
  if(command==='flatten')set('styleFeature',seam,'depth',.001,'Feature depth');
  else set('styleFeature',seam,'sharpness',command==='sharp'?.96:.14,'Feature sharpness');
 }else if(f.type==='crease'){
  if(g.body.doorStamp){
   bb('doorStamp',command==='sharp'?.026:command==='blend'?.014:.004);
   if(command==='blend')bb('doorStampFade',.30);
  }else bb('creaseStrength',command==='sharp'?.93:command==='blend'?.37:.10);
 }else if(f.type==='arch'||['frontFenders','rearFenders'].includes(f.component)){
  bb('archCrown',command==='flatten'?.17:.90);
  if(command==='widen')set('components',f.component,'depth',1.27,'Fender flare depth');
 }else if(['roof','glass-edge'].includes(f.type)||['roof','glass'].includes(f.component)){
  dim('crown',command==='flatten'?.12:.91);bb('roofEdge',command==='flatten'?.26:.78);
 }else if(f.type==='component'&&COMPONENTS[f.component]&&!['frontBumper','rearBumper','grille','fogs'].includes(f.component)){
  set('components',f.component,'shape',command==='flatten'?.13:.83,COMPONENTS[f.component].shape);
 }else if(command==='round'||command==='box'){
  ff('profile','round');ff('boxiness',.12);ff('roundness',.87);ff('rollover',.77);
 }else {ff('verticalRoundness',.10);ff('shoulder',.15);}
 return {genome:g,changes,summary:COMMANDS[command]+'.'};
}

export function dragFeature(input,feature,deltaWorld){
 const g=normalizeVehicle(input),h=feature?.handle;
 if(!h||!Number.isFinite(h.scale)||!h.scale)return g;
 const axis=h.axis,delta=Array.isArray(deltaWorld)?(Array.isArray(axis)?axis.reduce((s,v,i)=>s+v*deltaWorld[i],0):deltaWorld[axis]):deltaWorld;
 if(!Number.isFinite(delta))return g;
 const f=feature, k=f.key??f.id,end=featureEnd(f);
 if(f.type==='style-curve'){
  const row=g.construction.features.find(r=>r.id===k);
  return row?updateDesign(g,'styleFeature',k,clamp(row.height+delta/h.scale,STYLE_FIELDS.height.min,STYLE_FIELDS.height.max),'height'):g;
 }
 if(f.type==='lamp'&&['L','R'].includes(f.side)){
  const group=end==='front'?'headlights':'taillights';
  if(g.construction.symmetry[group]==='independent'){
   const prev=getSideSettings(g,group,f.side,g.optics[end]).width;
   return updateDesign(g,'sideOptic',f.side+':'+end,clamp(prev+delta/h.scale),'width');
  }
 }
 const rule=f.type==='seam'?['seams',k,'offset',SEAM_FIELDS.offset]:
 f.type==='lamp'?['optics',end,'width',OPTIC_FIELDS.width]:
 ['roof','glass-edge'].includes(f.type)?['dimensions','crown',undefined,GLOBAL.crown]:
 f.type==='crease'?['body',g.body.doorStamp?'doorStampHeight':'creaseHeight',undefined,g.body.doorStamp?BODY_FIELDS.doorStampHeight:BODY_FIELDS.creaseHeight]:
 f.type==='arch'?['body','archCrown',undefined,BODY_FIELDS.archCrown]:
 ['silhouette','opening'].includes(f.type)?['fascia',end,'sweep',FASCIA_FIELDS.sweep]:null;
 if(!rule)return g;
 const [domain,key,property,spec]=rule, prev=property?g[domain][key][property]:g[domain][key];
 return updateDesign(g,domain,key,clamp(prev+delta/h.scale,spec.min,spec.max),property);
}
