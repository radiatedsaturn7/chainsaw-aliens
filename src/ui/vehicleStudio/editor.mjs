import * as phenotype from './genome.mjs';
import {guideModes,createFasciaOverlay} from './fasciaUi.mjs';
import {featureControls,featureCommands,proposeFeatureEdit,dragFeature} from './features.mjs';
import {createContextualOverlay} from './contextualOverlay.mjs';
import {CONSTRUCTION_PANELS,renderConstruction} from './constructionUi.mjs';
import {FAMILIES,GLOBAL,DIMENSIONS,TOTAL_LENGTH,COMPONENTS,COMPONENT_FIELDS,POSITIONABLE,PATCH_PANELS,PATCH_RANGE,createDesignSession,createVehicle} from './genome.mjs';
import {generateVehicle,disposeDesign} from './geometry.mjs';
import {exportVehicle} from './export.mjs';
import {createViewport} from './viewport.mjs';
import {resolveEditorViewportModeFlags} from '../shared/editorMenuLayout.js';

const $=id=>document.getElementById(id);
const layout=()=>{
 const mode=resolveEditorViewportModeFlags({editorId:'model3d',viewportWidth:innerWidth,viewportHeight:innerHeight,
  isMobile:matchMedia('(pointer:coarse)').matches||innerWidth<691});
 document.documentElement.dataset.layout=mode.mode;
};
window.addEventListener('resize',layout);layout();
const draftKey='lotg.studio.design.draft.v1';
const fasciaState={front:{category:'shape',advanced:false,guide:'transverse',point:0},rear:{category:'shape',advanced:false,guide:'transverse',point:0}};
const endOfTab=()=>Object.hasOwn(fasciaState,tab)?tab:null;
let fasciaOverlay=null,bodyOverlay=null;
const allowedLevels=['basic','advanced','expert'];
let editLevel='basic',featureId='',featureDirect=false,featureGesture=null,wizardPreview=null;
let featureOverlayMode='off';
const construct={panel:'cabin',id:null,end:'front',side:'L'};
const wizard={command:'',intensity:.65};
const featureItems=()=>Array.isArray(geo?.features)?geo.features:[];
const activeFeature=()=>featureItems().find(f=>f.id===featureId)??null;
const isLamp=f=>/lamp|headlight|taillight|optic/i.test([f?.type,f?.component].join(' '));
const work=createDesignSession(), fields=new Map();let tab='vehicle',part='frontFenders',geo=null,regeneration=0,advanced=null,reference=null,refView='side',panelSync=false,viewMode='orbit',noticeTimer=0,hasDraft=false;
const element=(tag,props={})=>Object.assign(document.createElement(tag),props);
const announce=(message,error=false,hold=false)=>{
 clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').dataset.error=String(error);
 if(message&&!hold)noticeTimer=setTimeout(()=>{$('notice').textContent=geo?.diagnostics.issues[0]??'';$('notice').dataset.error=String(Boolean(geo?.diagnostics.issues.length));},3400);
};
let viewport=null;
try{
 viewport=createViewport($('scene'),{onZoom:n=>$('zoom').value=n,onPick:key=>selectComponent(key,true),onFeature:f=>selectContextFeature(f),onFailure:e=>announce(e,true,true),onRender:()=>{fasciaOverlay?.render();bodyOverlay?.render();}});
}catch(e){announce('WebGL preview unavailable on this device. Export and file controls still work.',true,true);}
fasciaOverlay=createFasciaOverlay({svg:$('fascia-overlay'),view:()=>viewport,get:overlayConfig,write:writeGuide,select:selectGuidePoint});
bodyOverlay=createContextualOverlay({root:$('body-guides'),viewport:()=>viewport,get:bodyOverlayConfig,
 begin:f=>{featureGesture={base:work.get(),feature:f,record:true};},
 move:(f,delta)=>moveFeature(f,delta,featureGesture),end:()=>{featureGesture=null;if(tab==='feature')inspector();},
 keyboard:(f,delta)=>{moveFeature(f,delta,null);if(tab==='feature')inspector();}
});

function retain(){
 hasDraft=true;
 try{localStorage.setItem(draftKey,work.save());}catch{}
}
function syncHistory(){
 $('undo').disabled=!!wizardPreview||!work.canUndo();$('redo').disabled=!!wizardPreview||!work.canRedo();
 $('menu').disabled=!!wizardPreview;
}
function regenerate(){
 if(regeneration)cancelAnimationFrame(regeneration);regeneration=0;
 const started=performance.now();
 try{
  const design=generateVehicle(wizardPreview&&!wizardPreview.before?wizardPreview.genome:work.get());
  if(geo)disposeDesign(geo);geo=design;viewport?.setDesign(geo);syncFeatureViewport();fasciaOverlay?.render();bodyOverlay?.render();
  const {metadata:m,diagnostics:d}=geo,ms=Math.round(performance.now()-started);
  $('name-tag').textContent=geo.genome.name;
  $('metrics').textContent=[m.lengthM,m.widthM,m.heightM].map(n=>n.toFixed(2)).join(' × ')+' m · '+(d.bodyTriangles+4*d.wheelTriangles).toLocaleString()+' edit tris';
  $('metrics').title='Generated in '+ms+' ms (preview mesh generation and upload scheduling, not GPU frame time).';
  $('drive').disabled=$('export').disabled=Boolean(wizardPreview||d.issues.length);
  if(wizardPreview&&!wizardPreview.before){wizardPreview.valid=!d.issues.length;wizardPreview.reason=d.issues[0];}
  $('wizard-preview-banner').hidden=!wizardPreview;
  if(wizardPreview)$('wizard-preview-banner').textContent=wizardPreview.before?'Wizard · Original design':'Wizard · Candidate, not saved';
  document.documentElement.dataset.valid=String(!d.issues.length);
  if(d.issues.length)announce(d.issues[0],true,true);else if($('notice').dataset.error==='true')announce('');
  if($('setup-status'))$('setup-status').textContent=[...d.issues,...d.warnings].join(' ')||'No blocking geometry issues detected.';
 }catch(e){if(wizardPreview&&!wizardPreview.before){wizardPreview.valid=false;wizardPreview.reason=e.message;}announce(e.message,true,true);$('drive').disabled=$('export').disabled=true;document.documentElement.dataset.valid='false';}
 syncHistory();return geo?.diagnostics;
}
const schedule=()=>{if(!regeneration)regeneration=requestAnimationFrame(regenerate);syncHistory();retain();};
function edit(domain,key,value,property,opts){
 if(wizardPreview){announce('Accept or reject the refinement before making other edits.',true);return false;}
 try{work.edit(domain,key,value,property,opts);schedule();return true;}
 catch(e){announce(e.message,true);return false;}
}
function fieldRow(parent,label){
 const l=element('label',{className:'field'});l.append(element('span',{textContent:label}));parent.append(l);return l;
}
function range(parent,domain,key,spec,value,property=null){
 const scale=Number(spec.displayScale)||1,label=spec.displayUnit?spec.label.replace(/\s*\([^)]*\)$/,'')+' ('+spec.displayUnit+')':spec.label;
 const row=fieldRow(parent,label),wrap=element('div'),id=property??key;
 const range=element('input',{id:'range-'+id,type:'range',min:spec.min,max:spec.max,step:spec.step,value});
 const num=element('input',{id:'num-'+id,type:'number',min:spec.min*scale,max:spec.max*scale,step:spec.step*scale,value:Number((value*scale).toFixed(6)),inputMode:'decimal'});
 range.setAttribute('aria-label',spec.label+' slider');num.setAttribute('aria-label',label+' value');
 let dragging=false;
 function put(v,live){
  if(edit(domain,key,v,property,{record:!live||!dragging})){
   range.value=v;num.value=Number((v*scale).toFixed(6));if(live)dragging=true;
   if(domain==='dimensions'){
    const d=work.get().dimensions;
    if(key==='wheelbase'&&fields.has('length')){
     const f=fields.get('length');
     f.range.min=f.num.min=d.wheelbase+GLOBAL.front.min+GLOBAL.rear.min;
     f.range.max=f.num.max=d.wheelbase+GLOBAL.front.max+GLOBAL.rear.max;
    }
    for(const k of key==='length'?['front','rear']:['length'])if(fields.has(k)){
     const f=fields.get(k),v=k==='length'?d.wheelbase+d.front+d.rear:d[k];f.range.value=v;f.num.value=Number(v.toFixed(4));
    }
   }
  }else {
   const g=work.get(),d=g.dimensions;
   const a=key==='length'?d.wheelbase+d.front+d.rear:property?g[domain][key][property]:g[domain][key];
   range.value=a;num.value=Number((a*scale).toFixed(6));
  }
 }
 range.oninput=()=>put(range.valueAsNumber,true);range.onchange=()=>{dragging=false;};
 range.onblur=()=>{dragging=false;};
 num.onchange=()=>{if(Number.isFinite(num.valueAsNumber))put(num.valueAsNumber/scale,false);};
 wrap.append(range,num);row.append(wrap);fields.set(id,{range,num});
}
function select(parent,id,label,options,value,fn){
 const l=fieldRow(parent,label),s=element('select',{id});s.setAttribute('aria-label',label);
 options.forEach(o=>{const [k,v]=Array.isArray(o)?o:[o,o];s.append(new Option(v,k));});s.value=value;s.onchange=()=>fn(s.value);l.append(s);return s;
}
function color(parent,key,label,g){
 const l=fieldRow(parent,label),x=element('input',{id:'color-'+key,type:'color',value:g.materials[key]});x.setAttribute('aria-label',label);x.onchange=()=>edit('materials',key,x.value);l.append(x);
}
function group(container,label,open){
 const d=element('details',{open});d.append(element('summary',{textContent:label}));container.append(d);return d;
}
const componentControls={
 hood:['shape','depth'],frontFenders:['size','shape','depth'],rearFenders:['size','shape','depth'],frontBumper:['size','shape','depth'],
 rearBumper:['size','shape','depth'],doors:['shape','depth'],roof:['size','shape','depth'],pillars:['size','shape','depth'],glass:['shape','depth'],
 rockers:['size','shape','depth'],trunk:['shape','depth'],headlights:['size','shape','depth'],tails:['size','shape','depth'],
 fogs:['size','shape','depth'],grille:['size','shape','depth'],scoop:['size','shape','depth'],spoiler:['size','shape','depth'],
 mirrors:['size','shape','depth'],handles:['size','shape','depth'],wheels:['size','shape','depth'],tires:['shape','depth'],
 exhaust:['size','shape','depth'],dash:['size','shape','depth'],seats:['size','shape','depth'],steering:['size','shape','depth'],
 instruments:['size','shape','depth'],console:['size','shape','depth']
};
const fallbackProfiles={square:'Square / classic',round:'Rounded',v:'Pointed V'};
const profileOptions=()=>Object.entries(phenotype.FASCIA_PROFILES??phenotype.NOSE_PROFILES??fallbackProfiles);
function noseControls(parent,g){
 const p=g.fascia?.front??g.components.frontBumper,domain=g.fascia?.front?'fascia':'components',end=g.fascia?.front?'front':'frontBumper';
 select(parent,'nose-profile','Nose shape',profileOptions(),p.profile,v=>edit(domain,end,v,'profile'));
 for(const [k,spec] of Object.entries(phenotype.FASCIA_FIELDS??phenotype.NOSE_FIELDS??{})){
  if(['sweep','rollover','drop'].includes(k)&&Number.isFinite(p[k]))range(parent,domain,end,spec,p[k],k);
 }
 const b=element('button',{textContent:'Open front fascia'});b.onclick=()=>setTab('front');parent.append(b);
}
function guideRange(guide){
 const spec=(guide==='outline'?phenotype.OPTIC_OUTLINE_FIELD:phenotype.FASCIA_CURVE_FIELD)??{};
 return {min:spec.min??-1,max:spec.max??1,step:spec.step??.025};
}
function guideValues(g,end,guide){
 return guide==='outline'?g.optics?.[end]?.outline:g.fascia?.[end]?.curves?.[guide];
}
function overlayConfig(){
 const end=endOfTab();if(!end)return null;
 const cfg=fasciaState[end],mode=guideModes[cfg.guide];
 if(!cfg.advanced||viewMode!==mode.view(end))return null;
 const guide=geo?.fascia?.[end]?.guides?.[cfg.guide],values=guideValues(work.get(),end,cfg.guide);
 if(!guide||!Array.isArray(guide.points)||!values)return null;
 return {id:end+':'+cfg.guide,guide,values,range:guideRange(cfg.guide),selected:cfg.point,closed:cfg.guide==='outline'};
}
function syncGuideUI(){
 const end=endOfTab(),note=$('fascia-canvas-note');note.hidden=!end||!fasciaState[end].advanced;
 if(!end||!fasciaState[end].advanced){fasciaOverlay.render();return;}
 const cfg=fasciaState[end],v=guideValues(work.get(),end,cfg.guide)??[];
 const pose=guideModes[cfg.guide],poseView=pose.view(end);
 const visible=Boolean(overlayConfig());
 note.textContent=visible?(cfg.guide==='outline'?'Lens outline · Drag a point':'Control points · Drag a point'):(viewMode===poseView?'Numeric guide editing':'Select '+poseView+' view for the projected controls');
 for(const button of $('inspector').querySelectorAll('[data-guide-point]')){
  button.setAttribute('aria-pressed',String(Number(button.dataset.guidePoint)===cfg.point));
 }
 const num=$('guide-value'),slide=$('guide-range');
 if(num)num.value=v[cfg.point]??0;if(slide)slide.value=v[cfg.point]??0;
 fasciaOverlay.render();
}
function selectGuidePoint(index){
 const end=endOfTab();if(!end)return;
 const cfg=fasciaState[end],n=guideValues(work.get(),end,cfg.guide)?.length??0;
 cfg.point=Math.max(0,Math.min(n-1,Number(index)||0));syncGuideUI();
}
function writeGuide(index,value,{record=true}={}){
 const end=endOfTab();if(!end)return false;
 const cfg=fasciaState[end],g=work.get(),v=guideValues(g,end,cfg.guide);
 if(!v||!Number.isFinite(value)||index<0||index>=v.length)return false;
 const {min,max}=guideRange(cfg.guide);
 const next=Number(Math.min(max,Math.max(min,value)).toFixed(6));
 if(v[index]===next){syncGuideUI();return true;}
 v[index]=next;
 const cls=cfg.guide==='outline'?'optics':'fascia';
 const field=cls==='optics'?'outline':'curves';
 const patch=field==='outline'?v:g.fascia[end].curves;
 const ok=edit(cls,end,patch,field,{record});syncGuideUI();return ok;
}
function frameGuide(end){
 const guide=fasciaState[end].guide,preset=guideModes[guide];setView(preset.view(end));
 const pts=geo?.fascia?.[end]?.guides?.[guide]?.points;
 if(pts?.length){
  const center=[0,1,2].map(axis=>pts.reduce((t,p)=>t+p[axis],0)/pts.length);
  viewport?.focusWorld(center);
 }
 fasciaOverlay.render();
}
function setFasciaGuide(guide){
 const end=endOfTab();if(!end||!Object.hasOwn(guideModes,guide))return;
 const cfg=fasciaState[end];cfg.advanced=true;cfg.guide=guide;cfg.point=0;
 if(guide==='outline'&&editLevel!=='expert')setEditLevel('expert',{render:false});else if(editLevel==='basic')setEditLevel('advanced',{render:false});
 inspector();frameGuide(end);syncGuideUI();
}
function setFasciaAdvanced(on){
 const end=endOfTab();if(!end)return;
 const cfg=fasciaState[end];cfg.advanced=Boolean(on);
 if(cfg.advanced&&editLevel==='basic')setEditLevel('advanced',{render:false});
 inspector();if(cfg.advanced){viewport?.setZoom(2.05);frameGuide(end);}
 else {setView(end);viewport?.setZoom(1.67);}
 syncGuideUI();
}
const fasciaLabel=side=>side==='front'?'Front':'Rear';
function fasciaDemo(key){
 if(!key||typeof phenotype.createFasciaDemo!=='function')return false;
 try{
  work.replace(phenotype.createFasciaDemo(key));retain();regenerate();
  inspector();if(endOfTab()&&fasciaState[endOfTab()].advanced)frameGuide(endOfTab());syncGuideUI();
  announce('Fascia study loaded. Undo restores your previous design.');return true;
 }catch(e){announce(e.message,true);return false;}
}
function categories(parent,items,on,choose,aria){
 const row=element('div',{className:'fascia-tabs'});row.setAttribute('aria-label',aria);
 for(const [key,label] of Object.entries(items)){
  const b=element('button',{textContent:label,type:'button'});b.dataset.category=key;b.setAttribute('aria-pressed',String(key===on));b.onclick=()=>choose(key);row.append(b);
 }
 parent.append(row);return row;
}
function numericGuide(parent,end,g){
 const cfg=fasciaState[end], guide=guideModes[cfg.guide];
 categories(parent,Object.fromEntries(Object.entries(guideModes).map(([k,v])=>[k,v.label])),cfg.guide,setFasciaGuide,'Direct editing guide').classList.add('fascia-guide-tabs');
 parent.append(element('p',{textContent:guide.help+' Or choose a point and use the numeric input.'}));
 const v=guideValues(g,end,cfg.guide)??[];
 const points=element('div',{className:'fascia-points'});points.setAttribute('aria-label','Numeric point selection');
 v.forEach((_,i)=>{
  const b=element('button',{textContent:String(i+1),type:'button'});b.dataset.guidePoint=i;b.setAttribute('aria-label','Select point '+(i+1));b.setAttribute('aria-pressed',String(i===cfg.point));b.onclick=()=>selectGuidePoint(i);points.append(b);
 });
 parent.append(points);
 const row=fieldRow(parent,'Point offset'),wrap=element('div',{className:'fascia-point-range'}),spec=guideRange(cfg.guide);
 const slider=element('input',{id:'guide-range',type:'range',min:spec.min,max:spec.max,step:spec.step,value:v[cfg.point]??0});
 const num=element('input',{id:'guide-value',type:'number',inputMode:'decimal',min:spec.min,max:spec.max,step:spec.step,value:v[cfg.point]??0});
 slider.setAttribute('aria-label','Selected control point slider');num.setAttribute('aria-label','Selected control point value');
 let moving=false;
 slider.oninput=()=>{writeGuide(cfg.point,slider.valueAsNumber,{record:!moving});moving=true;};
 slider.onchange=slider.onblur=()=>{moving=false;};
 num.onchange=()=>{if(Number.isFinite(num.valueAsNumber))writeGuide(cfg.point,num.valueAsNumber);else syncGuideUI();};
 wrap.append(slider,num);row.append(wrap);
 const zero=element('button',{textContent:'Reset selected point',type:'button'});zero.onclick=()=>writeGuide(cfg.point,0);parent.append(zero);
 const fit=element('button',{textContent:'Frame this guide',type:'button'});fit.onclick=()=>frameGuide(end);parent.append(fit);
}
function fasciaInspector(root,g,end){
 const cfg=fasciaState[end],data=g.fascia?.[end],optics=g.optics?.[end];
 if(!data||!optics){root.append(element('p',{textContent:'Fascia components are unavailable for this design.'}));return;}
 const head=element('div',{className:'fascia-head'});const title=element('h2',{textContent:fasciaLabel(end)+' fascia'});
 const b=element('button',{id:'fascia-advanced',type:'button',textContent:cfg.advanced?'Done direct edit':'Edit control points'});
 b.setAttribute('aria-pressed',String(cfg.advanced));b.onclick=()=>setFasciaAdvanced(!cfg.advanced);
 head.append(title,b);root.append(head);
 root.append(element('p',{className:'fascia-desc',textContent:cfg.advanced?'Shape the shared surface directly against the live orthographic model.':'Style and fit the actual panels and optics. The opposite end stays independent.'}));
 if(cfg.advanced){numericGuide(root,end,g);return;}
 categories(root,{shape:'Shape',intakes:end==='front'?'Intakes':'Valance',optics:'Optics'},cfg.category,v=>{cfg.category=v;inspector();},'Fascia categories');
 const choose=(id,label,options,domain,field)=>select(root,id,label,Object.entries(options??{}),domain==='fascia'?data[field]:optics[field],v=>edit(domain,end,v,field));
 const fieldsFor=(domain,selector)=>{
  const source=domain==='fascia'?(phenotype.FASCIA_FIELDS??{}):(phenotype.OPTIC_FIELDS??{}),row=domain==='fascia'?data:optics;
  for(const [key,spec] of Object.entries(source))if(selector(key,spec)&&Number.isFinite(row[key]))range(root,domain,end,spec,row[key],key);
 };
 const isIntake=(k,spec)=>/intake|duct|opening|vent|splitter|chin|valance|diffuser|grille/i.test(k+' '+(spec.group??''));
 const partFields=(parent,key,keys=['shape','depth','size'])=>{
  const c=COMPONENTS[key],p=g.components[key];
  select(parent,'fascia-component-'+key,c.label+' type',c.types,p.type,v=>edit('components',key,v,'type'));
  for(const k of keys)range(parent,'components',key,{...COMPONENT_FIELDS[k],label:c.label+' '+k},p[k],k);
 };

 if(cfg.category==='shape'){
  choose('fascia-profile',end==='front'?'Nose profile':'Tail profile',Object.fromEntries(profileOptions()),'fascia','profile');
  fieldsFor('fascia',(k,s)=>!isIntake(k,s)&&(end==='rear'||!k.startsWith('deck')&&!k.startsWith('bumperFace')&&!k.toLowerCase().includes('plate')&&!k.startsWith('paintedPocket'))&&(end==='front'||k!=='fogCoverHeight'));
  const joining=end==='front'?'hood':'trunk', groupName=end==='front'?'Hood integration':'Trunk integration';
  const panel=group(root,groupName,false);partFields(panel,joining,['shape','depth']);
  const advancedPanel=element('button',{textContent:'Edit '+joining+' surface patch',type:'button'});
  advancedPanel.onclick=()=>{part=joining;setTab('surface');};panel.append(advancedPanel);
 }else if(cfg.category==='intakes'){
  choose('fascia-intakes',end==='front'?'Intake layout':'Valance opening',phenotype.INTAKE_TYPES,'fascia','intakes');
  fieldsFor('fascia',isIntake);
  if(end==='front')choose('fascia-grille-shape','Upper grille outline',phenotype.OPTIC_HOUSINGS,'fascia','grilleShape');
  choose('fascia-intake-shape','Lower intake outline',phenotype.OPTIC_HOUSINGS,'fascia','intakeShape');
  const bumper=group(root,'Bumper styling',false);partFields(bumper,end==='front'?'frontBumper':'rearBumper');
  if(end==='front'){
   partFields(group(root,'Grille',false),'grille',['size','depth']);
   partFields(group(root,'Fog lights',false),'fogs',['size','depth']);
  }else partFields(group(root,'Exhaust',false),'exhaust',['size','depth','shape','bias','angle']);
 }else{
  constructionButton(root,'construction-optics','Paired lamp settings','pairs',end);
  choose('optic-housing','Housing',phenotype.OPTIC_HOUSINGS,'optics','housing');
  choose('optic-layout','Internal lamp layout',phenotype.OPTIC_LAYOUTS,'optics','layout');
  fieldsFor('optics',k=>end==='rear'||!['silverUpper','tallHousing','rearCells'].includes(k));
  const palette=group(root,'Optic materials',true);
  for(const [key,label] of [
   [end==='front'?'head':'tail',end==='front'?'Front lamp element':'Rear lamp element'],
   ['indicator','Turn signals (both ends)'],
   ['opticCover','Lens tint (both ends)'],
   ['trim','Trim and gaskets (global)']
  ])if(g.materials[key])color(palette,key,label,g);
  const outline=element('button',{textContent:'Edit lens outline',type:'button'});outline.onclick=()=>setFasciaGuide('outline');root.append(outline);
 }
 const demoEntries=Object.entries(phenotype.FASCIA_DEMOS??{});
 if(demoEntries.length){
  const d=group(root,'Starting-point studies',false);
  select(d,'fascia-demo','Load a complete study',[['','Choose a study…'],...demoEntries.map(([key,name])=>[key,typeof name==='string'?name:name.label??key])],'',v=>{if(v)fasciaDemo(v);});
 }
}

function setEditLevel(level,{render=true}={}){
 if(!allowedLevels.includes(level))return false;
 editLevel=level;document.documentElement.dataset.editLevel=level;
 for(const b of $('edit-level').querySelectorAll('[data-level]'))b.setAttribute('aria-pressed',String(b.dataset.level===level));
 if(level==='basic'&&!isLamp(activeFeature()))featureDirect=false;
 const end=endOfTab();
 if(end&&level!=='expert'&&fasciaState[end].guide==='outline'){
  fasciaState[end].guide='transverse';fasciaState[end].point=0;
  if(fasciaState[end].advanced)frameGuide(end);
 }
 if(end&&level==='basic'&&fasciaState[end].advanced){fasciaState[end].advanced=false;setView(end);}
 syncFeatureViewport();bodyOverlay?.render();
 if(render)inspector();return true;
}
function projectFeature(id,index=0){
 const f=featureItems().find(x=>x.id===id),coords=f?.points?.[index],mapped=coords?viewport?.project(coords):null;
 if(!mapped)return null;
 const b=$('scene').getBoundingClientRect();
 return {...mapped,viewportX:mapped.x,viewportY:mapped.y,x:mapped.x+b.left,y:mapped.y+b.top};
}
function syncFeatureViewport(){
 const f=activeFeature(),show=(tab==='feature'||tab==='wizard')&&Boolean(f);
 viewport?.setFeature?.(show?f.id:null);
 viewport?.setFeatureOverlay?.(wizardPreview||featureDirect?'off':show?(featureOverlayMode==='alignment'?'alignment':'all'):featureOverlayMode);
 const note=$('body-guide-note'),cfg=bodyOverlayConfig();
 note.hidden=!cfg;
 if(cfg)note.textContent='Direct edit · '+cfg.feature.label;
}
function bodyOverlayConfig(){
 const f=activeFeature();
 if(!featureDirect||wizardPreview||tab!=='feature'||!f?.handle)return null;
 if(f.handle.view&&viewMode!==f.handle.view)return null;
 return {feature:f};
}
function frameFeature(){
 const f=activeFeature();if(!f)return;
 const mode=f.handle?.view??(f.type==='lamp'?f.end:'side')??'side';
 setView(['front','rear','side','top','orbit'].includes(mode)?mode:'side');
 let center=f.handle?.anchor;
 if(Number.isInteger(center))center=f.points?.[center];
 if(!Array.isArray(center)&&f.points?.length)center=f.points[Math.floor(f.points.length/2)];
 if(center)viewport?.focusWorld(center);
 viewport?.setZoom(1.8);syncFeatureViewport();bodyOverlay?.render();
}
function toggleFeatureDirect(on){
 const f=activeFeature();
 featureDirect=Boolean(on&&f?.handle);
 if(featureDirect&&editLevel==='basic'&&!isLamp(f))setEditLevel('advanced',{render:false});
 if(featureDirect)frameFeature();
 syncFeatureViewport();bodyOverlay?.render();inspector();
}
function selectContextFeature(value){
 if(wizardPreview)return false;
 const id=typeof value==='string'?value:value?.id;
 const f=featureItems().find(f=>f.id===id);
 if(!f)return false;
 if(featureId!==id){
  featureDirect=false;featureId=id;wizard.command='';
 }
 if(tab!=='feature')setTab('feature');
 else {syncFeatureViewport();inspector();bodyOverlay?.render();}
 return true;
}
function moveFeature(feature,delta,gesture){
 if(wizardPreview)return false;
 try{
  const base=gesture?.base??work.get(),state=dragFeature(base,gesture?.feature??feature,delta);
  if(!state)return false;
  const before=JSON.stringify(work.get()),next=state.genome??state;
  if(JSON.stringify(next)===before)return false;
  work.replace(next,{record:gesture?.record??true});
  if(gesture)gesture.record=false;
  schedule();return true;
 }catch(e){announce(e.message,true);return false;}
}
function featureSelect(parent,label='Vehicle feature'){
 const options=featureItems().map(f=>[f.id,f.label+(f.side&&!f.label.endsWith(' · '+f.side)?' · '+f.side:'')]);
 if(!options.length){parent.append(element('p',{textContent:'Generate a complete vehicle to choose editable features.'}));return;}
 if(!activeFeature())featureId=options[0][0];
 return select(parent,'context-feature',label,options,featureId,v=>selectContextFeature(v));
}
function contextualField(root,control){
 const c=control;
 if(c.type==='select'||Array.isArray(c.options)){
  const opts=(c.options??[]).map(o=>Array.isArray(o)?o:[o.id??o.value??o,o.label??o]);
  select(root,'feature-'+(c.property??c.key),c.label,opts,c.value,v=>edit(c.domain,c.key,v,c.property));
 } else if(c.type==='checkbox'||typeof c.value==='boolean'){
  const x=element('input',{type:'checkbox',checked:Boolean(c.value)});x.onchange=()=>edit(c.domain,c.key,x.checked,c.property);
  fieldRow(root,c.label).append(x);
 } else if(Number.isFinite(c.value)&&Number.isFinite(c.min)&&Number.isFinite(c.max)){
  range(root,c.domain,c.key,{...c,step:c.step??.001},c.value,c.property??null);
 }
}
function featureInspector(root,g){
 root.append(element('h2',{className:'studio-head',textContent:'Feature inspector'}));
 root.append(element('p',{className:'studio-intro',textContent:'Tap an outlined feature on the car or pick one below. Controls follow the part you select.'}));
 featureSelect(root);
 const f=activeFeature();if(!f)return;
 const panel=element('div',{className:'feature-layout'});root.append(panel);
 const title=element('h3',{textContent:f.label});title.style.margin='3px 0';panel.append(title);
 const bar=element('div',{className:'feature-buttons'});
 const fs=element('button',{type:'button',id:'feature-frame',textContent:'Frame feature'});fs.onclick=frameFeature;bar.append(fs);
 if(f.handle&&(editLevel!=='basic'||isLamp(f))){
  const d=element('button',{type:'button',id:'feature-direct',textContent:featureDirect?'Stop direct edit':'Direct edit'});
  d.setAttribute('aria-pressed',String(featureDirect));d.onclick=()=>toggleFeatureDirect(!featureDirect);bar.append(d);
 }
 const commands=featureCommands(f)??[];
 if(commands.length){const w=element('button',{type:'button',id:'feature-to-wizard',textContent:'Refine with Wizard'});w.onclick=()=>setTab('wizard');bar.append(w);}
 if(editLevel==='expert'&&isLamp(f)&&(f.end==='front'||f.end==='rear')){
  const outline=element('button',{type:'button',id:'feature-outline',textContent:'Edit lens outline'});
  outline.onclick=()=>{setTab(f.end);setFasciaGuide('outline');};bar.append(outline);
 }
 const construction=f.type==='lamp'?'pairs':f.type==='style'?'styling':constructionFor(f.component);
 if(construction&&editLevel!=='basic')constructionButton(bar,'construction-feature','Construction settings',construction,f.end,f.side);
 panel.append(bar);
 const fields=featureControls(g,f,editLevel)??[];
 for(const c of fields)contextualField(root,c);
 if(!fields.length)root.append(element('p',{textContent:'Try Advanced or Expert for finer controls on this feature.'}));
 if(f.metrics&&editLevel!=='basic'){
  const metrics=group(root,'Feature measurements',false),dl=element('dl',{className:'feature-metrics'});
  for(const [k,v] of Object.entries(f.metrics)){
   if(!['string','number','boolean'].includes(typeof v))continue;
   dl.append(element('dt',{textContent:k.replace(/[A-Z]/g,x=>' '+x.toLowerCase())}),element('dd',{textContent:typeof v==='number'?Number(v.toPrecision(4)):String(v)}));
  }
  metrics.append(dl);
  if(f.metrics.flags?.length)metrics.append(element('p',{textContent:f.metrics.flags.join(' · ')}));
 }
}
function previewFeature(){
 if(wizardPreview)return false;
 const feature=activeFeature();if(!feature)return false;
 try{
  const result=proposeFeatureEdit(work.get(),feature,wizard.command,wizard.intensity);
  if(!result?.genome)throw Error('No alternative design was produced.');
  wizardPreview={...result,before:false,valid:false};
  menu(false);syncHistory();regenerate();inspector();return true;
 }catch(e){wizardPreview=null;announce(e.message,true);return false;}
}
function rejectWizard({render=true,quiet=false}={}){
 if(!wizardPreview)return false;
 wizardPreview=null;$('wizard-preview-banner').hidden=true;
 if(render){regenerate();inspector();}
 if(!quiet)announce('Preview discarded. Your design is unchanged.');
 return true;
}
function acceptWizard(){
 const prev=wizardPreview;
 if(!prev?.valid)return false;
 try{work.replace(prev.genome);wizardPreview=null;retain();regenerate();inspector();
  announce('Refinement applied. Undo restores your previous design.');return true;
 }catch(e){announce(e.message,true);return false;}
}
function wizardInspector(root,g){
 root.append(element('h2',{className:'studio-head',textContent:'Refinement Wizard'}));
 root.append(element('p',{className:'studio-intro',textContent:'Preview a focused geometry refinement. It won’t be saved unless you accept it.'}));
 const f=activeFeature();
 if(wizardPreview){
  const card=element('section',{className:'preview-card'});card.setAttribute('aria-invalid',String(!wizardPreview.valid));
  card.append(element('h3',{textContent:wizardPreview.before?'Original design':'Proposed refinement'}));
  card.append(element('p',{textContent:String(wizardPreview.summary??'Review the proposed changes.')}));
  if(wizardPreview.reason)card.append(element('p',{textContent:wizardPreview.reason,className:'preview-error'}));
  const changes=Array.isArray(wizardPreview.changes)?wizardPreview.changes:[];
  if(changes.length){
   const list=element('ul',{className:'wizard-changes'}),fmt=v=>Array.isArray(v)?v.map(fmt).join(', '):typeof v==='number'?String(Number(v.toFixed(4))):String(v??'—');
   for(const c of changes){
    const label=c.label??c.property??c.key??'Change';
    const conv=v=>typeof v==='number'&&/\(mm\)/i.test(label)?v*1000:v;
    list.append(element('li',{textContent:`${label}: ${fmt(conv(c.from))} → ${fmt(conv(c.to))}`}));
   }
   card.append(list);
  }
  const controls=element('div',{className:'wizard-actions'});
  const compare=element('button',{type:'button',id:'wizard-compare',textContent:wizardPreview.before?'Show proposal':'Compare original'});
  compare.onclick=()=>{wizardPreview.before=!wizardPreview.before;regenerate();inspector();};
  const reject=element('button',{type:'button',id:'wizard-reject',textContent:'Reject'});reject.onclick=()=>rejectWizard();
  const accept=element('button',{type:'button',id:'wizard-accept',textContent:'Accept',className:'accept',disabled:!wizardPreview.valid});
  accept.onclick=acceptWizard;
  controls.append(compare,reject,accept);card.append(controls);root.append(card);return;
 }
 const pick=featureSelect(root,'Feature to refine');if(pick)pick.onchange=()=>{
  if(!featureItems().some(f=>f.id===pick.value))return;
  featureId=pick.value;wizard.command='';syncFeatureViewport();inspector();
 };
 const cmds=featureCommands(activeFeature())??[];
 if(!cmds.length){root.append(element('p',{textContent:'No automatic refinements are available for this feature. Choose another one, or edit it manually.'}));return;}
 if(!cmds.some(x=>x.id===wizard.command))wizard.command=cmds[0].id;
 select(root,'wizard-command','Refinement',cmds.map(c=>[c.id,c.label]),wizard.command,v=>{wizard.command=v;});
 const slider=element('input',{id:'wizard-intensity',type:'range',min:.05,max:1,step:.05,value:wizard.intensity});
 const label=fieldRow(root,'Amount · '+Math.round(wizard.intensity*100)+'%');
 slider.setAttribute('aria-label','Refinement strength');slider.oninput=()=>{wizard.intensity=slider.valueAsNumber;label.firstChild.textContent='Amount · '+Math.round(wizard.intensity*100)+'%';};label.append(slider);
 const b=element('button',{type:'button',id:'wizard-preview',textContent:'Preview refinement'});b.onclick=previewFeature;root.append(b);
}
function constructionFor(key){
 if(['seats','dash','steering','instruments','console','cabin','roof','glass','pillars'].includes(key))return 'cabin';
 if(key==='exhaust'||key==='rearBumper')return 'exhaust';
 if(key==='spoiler')return 'wing';
 if(key==='hood'||key==='scoop')return 'hood';
 if(['headlights','tails'].includes(key))return 'pairs';
 if(['doors','frontFenders','rearFenders','rockers','styling'].includes(key))return 'styling';
 return null;
}
function openConstruction(panel='cabin',end=null,side=null){
 if(!Object.hasOwn(CONSTRUCTION_PANELS,panel))return false;
 construct.panel=panel;construct.id=null;
 if(end==='front'||end==='rear')construct.end=end;
 if(side==='L'||side==='R')construct.side=side;
 if(editLevel==='basic')setEditLevel('advanced',{render:false});
 setTab('construction');
 return true;
}
function constructionButton(parent,id,text,panel,end=null,side=null){
 const b=element('button',{id,type:'button',textContent:text});b.onclick=()=>openConstruction(panel,end,side);parent.append(b);
 return b;
}
function inspector(){
 const root=$('inspector'),g=work.get();root.replaceChildren();fields.clear();
 const end=endOfTab();
 if(tab==='construction'){renderConstruction(root,{state:construct,get:work.get,edit,repaint:inspector,setLevel:setEditLevel,level:editLevel,setView});}
 else if(tab==='feature'){featureInspector(root,g);syncFeatureViewport();bodyOverlay?.render();}
 else if(tab==='wizard'){wizardInspector(root,g);syncFeatureViewport();bodyOverlay?.render();}
 else if(end){fasciaInspector(root,g,end);syncGuideUI();}
 else if(tab==='vehicle'){
  select(root,'family','Body family',Object.entries(FAMILIES).map(([k,v])=>[k,v.label]),g.family,v=>{if(edit('family','family',v)){inspector();}});
  const n=element('input',{id:'design-name',type:'text',value:g.name,maxLength:80});n.setAttribute('aria-label','Design name');n.onchange=()=>edit('name','name',n.value);fieldRow(root,'Design name').append(n);
  constructionButton(root,'construction-tab','Construction workbench','cabin');
  for(const [label,keys] of Object.entries({'Proportions & stance':['wheelbase','width','height','front','rear','track','stance','archReserve','rearTrackBias'],
   'Body profile':['belt','box','frontBox','rearBox','skirt','hood','trunk'],'Cabin':['cabin','cabinLength','cabinWidth','crown']})){
   const details=group(root,label,label==='Proportions & stance');
   if(label==='Proportions & stance'){
    const d=g.dimensions;
    range(details,'dimensions','length',{...TOTAL_LENGTH,min:d.wheelbase+GLOBAL.front.min+GLOBAL.rear.min,max:d.wheelbase+GLOBAL.front.max+GLOBAL.rear.max},Number((d.wheelbase+d.front+d.rear).toFixed(4)));
   }
   for(const key of keys)range(details,'dimensions',key,GLOBAL[key]??DIMENSIONS[key],g.dimensions[key]);
  }
  noseControls(group(root,'Front-end shape',true),g);
  const data=group(root,'Materials',false);color(data,'paint','Body paint',g);color(data,'wheel','Wheel finish',g);
  color(data,'glass','Glass tint',g);color(data,'seat','Seat upholstery',g);
  root.append(element('p',{id:'setup-status',textContent:geo?.diagnostics.warnings.join(' ')||'Shared body stations and suspension mounts update together.'}));
 }else if(tab==='parts'){
  const search=element('input',{id:'find-part',type:'search',placeholder:'Search panels, lights, interior…'});search.setAttribute('aria-label','Search components');fieldRow(root,'Find component').append(search);
  const sel=select(root,'component','Component',Object.entries(COMPONENTS).map(([k,v])=>[k,v.label]),part,v=>selectComponent(v));
  search.oninput=()=>{
   const term=search.value.trim().toLowerCase();for(const o of sel.options)o.hidden=Boolean(term&&!o.textContent.toLowerCase().includes(term));
  };
  search.onkeydown=e=>{if(e.key==='Enter'){const v=Array.from(sel.options).find(o=>!o.hidden);if(v)selectComponent(v.value);}};
  const d=COMPONENTS[part],p=g.components[part];
  const subpanel=constructionFor(part);
  if(subpanel)constructionButton(root,'construction-component','Open '+CONSTRUCTION_PANELS[subpanel],subpanel,part==='tails'?'rear':'front');
  if(part==='frontBumper')noseControls(root,g);
  select(root,'part-type',d.label+' type',d.types,p.type,v=>edit('components',part,v,'type'));
  for(const key of [...componentControls[part],...(POSITIONABLE.has(part)?['bias','angle']:[])])range(root,'components',part,{...COMPONENT_FIELDS[key],label:key==='shape'?d.shape[0].toUpperCase()+d.shape.slice(1):COMPONENT_FIELDS[key].label},p[key],key);
  if(part==='wheels'||part==='tires')for(const k of ['diameter','tireWidth','rimRatio'])range(root,'dimensions',k,DIMENSIONS[k],g.dimensions[k]);
 if(['wheels','tires','frontFenders','rearFenders'].includes(part)){
  const arch=group(root,'Wheel opening fit',true);
  for(const [k,spec] of Object.entries(phenotype.ARCH_FIELDS)){
   if(part==='frontFenders'&&k.startsWith('rear')||part==='rearFenders'&&k.startsWith('front'))continue;
   range(arch,'body',k,spec,g.body[k]);
  }
 }
 if(part==='doors'){
  const stamp=group(root,'Door character line',true);
  for(const k of ['doorStamp','doorStampHeight','doorStampSweep','doorStampWidth','doorStampFade','doorStampFront','doorStampRear'])range(stamp,'body',k,phenotype.BODY_FIELDS[k],g.body[k]);
 }
  if(part==='frontFenders'){const b=element('button',{textContent:'Open Surface Studio'});b.onclick=()=>openAdvanced();root.append(b);}
  else if(PATCH_PANELS.includes(part)){const b=element('button',{textContent:'Edit surface patch'});b.onclick=()=>setTab('surface');root.append(b);}
 }else if(tab==='view'){
  const s=viewport?.state()??{};
  select(root,'shading','Diagnostic material',[['production','Production materials'],['clay','Neutral clay'],['glossy','Glossy reflection'],['wire','Wireframe'],['normals','Surface normals'],['zebra','Dense zebra']],s.mode??'production',v=>viewport?.setMode(v));
  select(root,'review-angle','Review camera',[['orbit','Three-quarter'],['front','Front • straight on'],['frontElevated','Front • slightly above'],['rear','Rear • straight on'],['rearElevated','Rear • slightly above'],['side','Side'],['top','Top']],viewMode,v=>setView(v));
  select(root,'projection','Camera projection',[['perspective','Perspective'],['ortho','Orthographic']],s.projection??'perspective',v=>viewport?.setProjection(v));
  select(root,'display','Assembly',[['complete','Complete vehicle'],['isolate','Isolate selected part'],['exploded','Exploded']],s.display??'complete',v=>viewport?.setDisplay(v));
  select(root,'feature-overlay-mode','Feature overlays',[['off','Off'],['all','All editable features'],['alignment','Panel alignment']],featureOverlayMode,v=>{featureOverlayMode=v;syncFeatureViewport();});
  select(root,'lighting','Lighting',[['studio','Automotive studio'],['studio-strips','Gloss booth'],['track-clear','Outdoor daylight']],s.light??'studio',v=>viewport?.setLighting(v));
  constructionButton(root,'open-paint-finish','Adjust paint finish','finish');
  const d=group(root,'Reference overlay',true),btn=element('button',{textContent:reference?'Replace image':'Choose local reference image'});d.append(btn);
  btn.onclick=()=>{$('reference-file').click();};
  select(d,'ref-view','Reference angle',[['front','Front'],['frontElevated','Front • slightly above'],['rear','Rear'],['rearElevated','Rear • slightly above'],['side','Side'],['top','Top'],['orbit','Three-quarter']],refView,v=>{refView=v;setView(v);});
  const amount=element('input',{type:'range',min:0,max:1,step:.025,value:Number($('ref-overlay').style.opacity||.35)});
  amount.setAttribute('aria-label','Reference image opacity');amount.oninput=()=>{$('ref-overlay').style.opacity=amount.value;};fieldRow(d,'Reference opacity').append(amount);
  let hide=element('button',{textContent:'Remove reference'});hide.onclick=()=>clearReference();d.append(hide);
 }else if(tab==='surface'){
  const panelKeys=['frontFenders',...PATCH_PANELS],active=panelKeys.includes(part)?part:'frontFenders';
  select(root,'surface-panel','Surface panel',panelKeys.map(k=>[k,COMPONENTS[k].label]),active,v=>{selectComponent(v);inspector();});
  if(active==='frontFenders'){
   root.append(element('p',{textContent:'Adjust guide curves, trimming and control points. The complete car updates alongside Surface Studio.'}));
   const b=element('button',{textContent:'Open Surface Studio'});b.onclick=()=>openAdvanced();root.append(b);
  }else{
   root.append(element('p',{textContent:'Four interior Bézier points shape this panel; its shared boundary stays in place.'}));
   const patch=group(root,'Surface control points',true);
   for(const [i,name] of ['Rear left','Rear right','Front left','Front right'].entries()){
    const l=fieldRow(patch,name+' offset (m)'),n=element('input',{type:'number',id:'patch-'+i,min:PATCH_RANGE.min,max:PATCH_RANGE.max,step:PATCH_RANGE.step,value:g.surfaces[active].points[i],inputMode:'decimal'});
    n.setAttribute('aria-label',name+' control point offset');
    n.onchange=()=>{const p=work.get().surfaces[active];p.points[i]=n.valueAsNumber;if(!edit('surfaces',active,p))n.value=g.surfaces[active].points[i];};
    l.append(n);
   }
  }
  range(root,'constraints','gap',DIMENSIONS.gap,g.constraints.gap);
 }
}
function selectComponent(key,fromViewport=false){
 if(wizardPreview)return;
 if(tab==='feature'&&fromViewport){const feature=featureItems().find(f=>f.component===key);if(feature){selectContextFeature(feature);return;}}
 if(!Object.hasOwn(COMPONENTS,key))return;
 part=key;const end=endOfTab();
 if(end){if(fromViewport&&!fasciaState[end].advanced){if(['headlights','tails'].includes(part))fasciaState[end].category='optics';else if(part==='fogs'||part==='grille')fasciaState[end].category='intakes';else if(part==='frontBumper'||part==='rearBumper')fasciaState[end].category='shape';inspector();}return;}
 viewport?.select(part);if(fromViewport&&tab!=='surface'&&tab!=='view')setTab('parts');else if(tab==='parts'||(tab==='surface'&&!advanced))inspector();
}
function setTab(k){
 const hadPreview=!!wizardPreview&&k!=='wizard';if(hadPreview)rejectWizard({render:false,quiet:true});
 if(k!=='surface'&&advanced)closeAdvanced(false);
 const previous=endOfTab();
 tab=k;
 if(k!=='feature')featureDirect=false;
 const end=endOfTab();
 document.body.classList.toggle('fascia-mode',Boolean(end));
 if(end){viewport?.select('');if(fasciaState[end].advanced){viewport?.setZoom(2.05);frameGuide(end);}else{setView(end);viewport?.setZoom(1.67);}}
 else if(previous){viewport?.setZoom(1.18);setView('orbit');}
 for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===k));
 $('feature-tab').setAttribute('aria-pressed',String(tab==='feature'));
 $('wizard-tab').setAttribute('aria-pressed',String(tab==='wizard'));
 if(hadPreview)regenerate();
 inspector();syncGuideUI();syncFeatureViewport();bodyOverlay?.render();
}
function exportForDrive(){
 if(wizardPreview)throw Error('Accept or reject the refinement before driving.');
 const detail={bundle:exportVehicle(work.get(),{id:'studio-session-'+(crypto.randomUUID?.()??Date.now().toString(36)),quality:'drive'}),handled:false,error:null};
 document.dispatchEvent(new CustomEvent('lotg-vehicle-studio-drive',{detail}));
 if(detail.error)throw Error(detail.error);if(!detail.handled)throw Error('Open this editor from the game to test drive.');
 return true;
}
function openAdvanced(){
 if(advanced)return;setTab('surface');
 const frame=$('panel-editor');$('advanced').hidden=false;$('inspector').hidden=true;document.body.classList.add('advanced-mode');
 const handle=()=>{
  const tool=frame.contentWindow?.designer;if(!tool)return;
  panelSync=true;
  const saved=work.get().surfaces.frontFenders;tool.applyGenome(saved,{record:false,fit:true});
  panelSync=false;
  frame.contentDocument.addEventListener('lotg-surface-studio-exit',()=>closeAdvanced());
  frame.contentDocument.addEventListener('lotg-surface-studio-changed',e=>{
   if(panelSync||!e.detail?.valid)return;edit('surfaces','frontFenders',e.detail.genome);
  });
  const back=frame.contentDocument.getElementById('back-to-graphics');
  if(back)back.hidden=true;
  viewport?.select('frontFenders');
 };
 advanced={frame,handle};frame.addEventListener('load',handle);frame.src='../surfaceStudio/index.html';regenerate();
}
function closeAdvanced(show=true){
 if(!advanced)return;const {frame,handle}=advanced;advanced=null;frame.removeEventListener('load',handle);frame.removeAttribute('src');
 $('advanced').hidden=true;$('inspector').hidden=false;document.body.classList.remove('advanced-mode');
 if(show)setTab('surface');
 viewport?.select('');
}
function syncPanel(){
 if(!advanced)return;const tool=advanced.frame.contentWindow?.designer;if(!tool)return;
 panelSync=true;try{tool.applyGenome(work.get().surfaces.frontFenders,{record:false,fit:false});}finally{panelSync=false;}
}
function setView(v){
 viewMode=v;viewport?.setView(v);
 if($('review-angle'))$('review-angle').value=v;
 if($('projection'))$('projection').value=viewport?.state().projection??'perspective';
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===v));showReference();
 if(tab==='view')inspector();syncGuideUI();syncFeatureViewport();bodyOverlay?.render();
}
function showReference(){$('ref-overlay').style.backgroundImage=reference&&refView===viewMode?'url("'+reference+'")':'';}
function clearReference(){if(reference)URL.revokeObjectURL(reference);reference=null;showReference();if(tab==='view')inspector();}
function download(data,name){
 const b=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(b),a=element('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
}
function menu(on){$('menu-sheet').hidden=!on;$('menu').setAttribute('aria-expanded',String(on));}
function perform(fn){try{return fn();}catch(e){announce(e.message,true);return false;}}
function afterUndo(doRedo=false){if(wizardPreview){rejectWizard();return;}doRedo?work.redo():work.undo();inspector();syncPanel();schedule();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>setEditLevel(b.dataset.level));
$('feature-tab').onclick=()=>setTab('feature');$('wizard-tab').onclick=()=>setTab('wizard');
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('advanced-done').onclick=()=>closeAdvanced();
$('zoom').oninput=e=>viewport?.setZoom(Number(e.target.value));
$('menu').onclick=()=>menu($('menu-sheet').hidden);$('menu-close').onclick=()=>menu(false);
$('save').onclick=()=>{download(work.save(),work.get().name+' design.json');menu(false);announce('Design saved.');};
$('load').onclick=()=>$('design-file').click();
$('design-file').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;e.target.value='';
 try{if(f.size>20*1024*1024)throw Error('Choose a design genome or game vehicle export under 20 MB.');
  const loaded=JSON.parse(await f.text());work.replace(loaded?.kind==='lotg-studio-export'?loaded.genome:loaded);inspector();syncPanel();schedule();menu(false);announce('Design loaded.');
 }catch(e){announce(e.message,true);}
};
$('reference-file').onchange=e=>{
 const f=e.target.files[0];if(!f)return;e.target.value='';
 if(f.size>15000000||!/^image\/(png|jpeg|webp)$/.test(f.type)){announce('Choose a PNG, JPG or WebP under 15 MB.',true);return;}
 clearReference();reference=URL.createObjectURL(f);setView(refView);
};
$('duplicate').onclick=()=>{work.duplicate();inspector();schedule();menu(false);announce('Working copy created.');};
$('reset').onclick=()=>{work.reset();inspector();syncPanel();schedule();menu(false);announce('Preset restored. Undo is available.');};
$('export').onclick=()=>perform(()=>{
 if(wizardPreview)throw Error('Accept or reject the refinement before exporting.');
 const b=exportVehicle(work.get(),{quality:'drive'});download(JSON.stringify(b),work.get().name+' game vehicle.json');menu(false);announce('Game vehicle exported: '+b.metrics.carTriangles.toLocaleString()+' / '+b.metrics.triangleBudget.toLocaleString()+' triangles, including four wheels.');
});
$('undo').onclick=()=>afterUndo();$('redo').onclick=()=>afterUndo(true);
$('back').onclick=()=>document.dispatchEvent(new Event('lotg-surface-studio-exit'));
$('drive').onclick=()=>perform(exportForDrive);
const pan=$('pan-pad');let last=null;
pan.onpointerdown=e=>{pan.setPointerCapture(e.pointerId);last=[e.clientX,e.clientY];};
pan.onpointermove=e=>{if(!last)return;const [dx,dy]=[e.clientX-last[0],e.clientY-last[1]];viewport?.nudge(dx*2,dy*2);last=[e.clientX,e.clientY];};
pan.onpointerup=pan.onpointercancel=()=>{last=null;};
pan.onkeydown=e=>{
 const delta={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];
 if(delta){e.preventDefault();viewport?.nudge(...delta);}else if(['Enter',' '].includes(e.key)){e.preventDefault();viewport?.resetPan();}
};
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(wizardPreview)rejectWizard();else if(featureDirect)toggleFeatureDirect(false);else if(!$('menu-sheet').hidden)menu(false);else if(advanced)closeAdvanced();else if(endOfTab()&&fasciaState[endOfTab()].advanced)setFasciaAdvanced(false);else $('back').click();}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
  e.preventDefault();afterUndo(e.shiftKey);
 }
});
function disposePreview(){
 if(geo){disposeDesign(geo);geo=null;}
 if(viewport){viewport.dispose();viewport=null;}
 if(reference){URL.revokeObjectURL(reference);reference=null;}
}
window.addEventListener('pagehide',disposePreview,{once:true});
try{const s=localStorage.getItem(draftKey);if(s){work.replace(JSON.parse(s),{record:false});hasDraft=true;}}catch{}
window.vehicleDesigner={
 disposePreview,getGenome:work.get,applyGenome(g,{record=false}={}){work.replace(g,{record});inspector();syncPanel();schedule();},
 restoreDraft(g){if(!hasDraft&&g){work.replace(g,{record:false});inspector();syncPanel();regenerate();}},
 createGenome:createVehicle,edit(...args){const applied=edit(...args);if(applied)inspector();return applied;},setTab,selectComponent,openSurface:openAdvanced,closeSurface:closeAdvanced,setView,
 setMaterialMode:m=>viewport?.setMode(m),setLighting:v=>viewport?.setLighting(v),setDisplay:d=>viewport?.setDisplay(d),
 undo(){afterUndo();return work.get();},redo(){afterUndo(true);return work.get();},
 duplicate(){work.duplicate();inspector();schedule();return work.get();},reset(){work.reset();inspector();syncPanel();schedule();return work.get();},
 setFasciaAdvanced,setFasciaGuide,selectGuidePoint,writeGuide,fasciaDemo,
 openConstruction,setEditLevel,selectFeature:selectContextFeature,projectFeature,toggleFeatureDirect,previewFeature,acceptWizard,rejectWizard,
 setFeatureOverlay(mode){if(['off','all','alignment'].includes(mode)){featureOverlayMode=mode;syncFeatureViewport();}},
 save:work.save,load(text){work.load(text);inspector();syncPanel();schedule();return work.get();},
 regenerate,export:opts=>{if(wizardPreview)throw Error('Accept or reject the refinement before exporting.');return exportVehicle(work.get(),opts);},drive:exportForDrive,
 renderView:async({angle='orbit',mode='production',lighting='studio',projection=null}={})=>{
  setView(angle);viewport?.setMode(mode);viewport?.setLighting(lighting);
  if(projection)viewport?.setProjection(projection);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return $('scene').toDataURL('image/png');
 },
 getState:()=>({tab,part,cabin:geo?.cabin,constructionPanel:tab==='construction'?construct.panel:null,editLevel,featureOverlayMode,features:featureItems(),featureId,featureDirect,wizardPreview:wizardPreview?{valid:wizardPreview.valid,before:wizardPreview.before,summary:wizardPreview.summary}:null,view:viewport?.state(),diagnostics:geo?.diagnostics,metadata:geo?.metadata,advanced:Boolean(advanced),fascia:endOfTab()?{...fasciaState[endOfTab()],end:endOfTab(),overlays:Boolean(overlayConfig())}:null})};
setEditLevel('basic',{render:false});setTab('vehicle');regenerate();document.documentElement.dataset.designerReady='true';
