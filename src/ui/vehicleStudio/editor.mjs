import * as phenotype from './genome.mjs';
import {guideModes,createFasciaOverlay} from './fasciaUi.mjs';
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
let fasciaOverlay=null;
const work=createDesignSession(), fields=new Map();let tab='vehicle',part='frontFenders',geo=null,regeneration=0,advanced=null,reference=null,refView='side',panelSync=false,viewMode='orbit',noticeTimer=0,hasDraft=false;
const element=(tag,props={})=>Object.assign(document.createElement(tag),props);
const announce=(message,error=false,hold=false)=>{
 clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').dataset.error=String(error);
 if(message&&!hold)noticeTimer=setTimeout(()=>{$('notice').textContent=geo?.diagnostics.issues[0]??'';$('notice').dataset.error=String(Boolean(geo?.diagnostics.issues.length));},3400);
};
let viewport=null;
try{
 viewport=createViewport($('scene'),{onZoom:n=>$('zoom').value=n,onPick:key=>selectComponent(key,true),onFailure:e=>announce(e,true,true),onRender:()=>fasciaOverlay?.render()});
}catch(e){announce('WebGL preview unavailable on this device. Export and file controls still work.',true,true);}
fasciaOverlay=createFasciaOverlay({svg:$('fascia-overlay'),view:()=>viewport,get:overlayConfig,write:writeGuide,select:selectGuidePoint});

function retain(){
 hasDraft=true;
 try{localStorage.setItem(draftKey,work.save());}catch{}
}
function syncHistory(){
 $('undo').disabled=!work.canUndo();$('redo').disabled=!work.canRedo();
}
function regenerate(){
 if(regeneration)cancelAnimationFrame(regeneration);regeneration=0;
 const started=performance.now();
 try{
  const design=generateVehicle(work.get());
  if(geo)disposeDesign(geo);geo=design;viewport?.setDesign(geo);fasciaOverlay?.render();
  const {metadata:m,diagnostics:d}=geo,ms=Math.round(performance.now()-started);
  $('name-tag').textContent=geo.genome.name;
  $('metrics').textContent=[m.lengthM,m.widthM,m.heightM].map(n=>n.toFixed(2)).join(' × ')+' m · '+(d.bodyTriangles+4*d.wheelTriangles).toLocaleString()+' tris';
  $('metrics').title='Generated in '+ms+' ms (preview mesh generation and upload scheduling, not GPU frame time).';
  $('drive').disabled=$('export').disabled=Boolean(d.issues.length);
  document.documentElement.dataset.valid=String(!d.issues.length);
  if(d.issues.length)announce(d.issues[0],true,true);else if($('notice').dataset.error==='true')announce('');
  if($('setup-status'))$('setup-status').textContent=[...d.issues,...d.warnings].join(' ')||'No blocking geometry issues detected.';
 }catch(e){announce(e.message,true,true);$('drive').disabled=$('export').disabled=true;document.documentElement.dataset.valid='false';}
 syncHistory();return geo?.diagnostics;
}
const schedule=()=>{if(!regeneration)regeneration=requestAnimationFrame(regenerate);syncHistory();retain();};
function edit(domain,key,value,property,opts){
 try{work.edit(domain,key,value,property,opts);schedule();return true;}
 catch(e){announce(e.message,true);return false;}
}
function fieldRow(parent,label){
 const l=element('label',{className:'field'});l.append(element('span',{textContent:label}));parent.append(l);return l;
}
function range(parent,domain,key,spec,value,property=null){
 const row=fieldRow(parent,spec.label),wrap=element('div'),id=property??key;
 const range=element('input',{id:'range-'+id,type:'range',min:spec.min,max:spec.max,step:spec.step,value});
 const num=element('input',{id:'num-'+id,type:'number',min:spec.min,max:spec.max,step:spec.step,value,inputMode:'decimal'});
 range.setAttribute('aria-label',spec.label+' slider');num.setAttribute('aria-label',spec.label+' value');
 let dragging=false;
 function put(v,live){
  if(edit(domain,key,v,property,{record:!live||!dragging})){
   range.value=v;num.value=v;if(live)dragging=true;
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
   range.value=a;num.value=Number(a.toFixed(4));
  }
 }
 range.oninput=()=>put(range.valueAsNumber,true);range.onchange=()=>{dragging=false;};
 range.onblur=()=>{dragging=false;};
 num.onchange=()=>{if(Number.isFinite(num.valueAsNumber))put(num.valueAsNumber,false);};
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
 inspector();frameGuide(end);syncGuideUI();
}
function setFasciaAdvanced(on){
 const end=endOfTab();if(!end)return;
 const cfg=fasciaState[end];cfg.advanced=Boolean(on);
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
  fieldsFor('fascia',(k,s)=>!isIntake(k,s));
  const joining=end==='front'?'hood':'trunk', groupName=end==='front'?'Hood integration':'Trunk integration';
  const panel=group(root,groupName,false);partFields(panel,joining,['shape','depth']);
  const advancedPanel=element('button',{textContent:'Edit '+joining+' surface patch',type:'button'});
  advancedPanel.onclick=()=>{part=joining;setTab('surface');};panel.append(advancedPanel);
 }else if(cfg.category==='intakes'){
  choose('fascia-intakes',end==='front'?'Intake layout':'Valance opening',phenotype.INTAKE_TYPES,'fascia','intakes');
  fieldsFor('fascia',isIntake);
  const bumper=group(root,'Bumper styling',false);partFields(bumper,end==='front'?'frontBumper':'rearBumper');
  if(end==='front'){
   partFields(group(root,'Grille',false),'grille',['size','depth']);
   partFields(group(root,'Fog lights',false),'fogs',['size','depth']);
  }else partFields(group(root,'Exhaust',false),'exhaust',['size','depth','shape','bias','angle']);
 }else{
  choose('optic-housing','Housing',phenotype.OPTIC_HOUSINGS,'optics','housing');
  choose('optic-layout','Internal lamp layout',phenotype.OPTIC_LAYOUTS,'optics','layout');
  fieldsFor('optics',()=>true);
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
function inspector(){
 const root=$('inspector'),g=work.get();root.replaceChildren();fields.clear();
 const end=endOfTab();
 if(end){fasciaInspector(root,g,end);syncGuideUI();}
 else if(tab==='vehicle'){
  select(root,'family','Body family',Object.entries(FAMILIES).map(([k,v])=>[k,v.label]),g.family,v=>{if(edit('family','family',v)){inspector();}});
  const n=element('input',{id:'design-name',type:'text',value:g.name,maxLength:80});n.setAttribute('aria-label','Design name');n.onchange=()=>edit('name','name',n.value);fieldRow(root,'Design name').append(n);
  for(const [label,keys] of Object.entries({'Proportions & stance':['wheelbase','width','height','front','rear','track','stance'],
   'Body profile':['belt','box','frontBox','rearBox','skirt','hood','trunk'],'Cabin':['cabin','cabinLength','cabinWidth','crown']})){
   const details=group(root,label,label==='Proportions & stance');
   if(label==='Proportions & stance'){
    const d=g.dimensions;
    range(details,'dimensions','length',{...TOTAL_LENGTH,min:d.wheelbase+GLOBAL.front.min+GLOBAL.rear.min,max:d.wheelbase+GLOBAL.front.max+GLOBAL.rear.max},Number((d.wheelbase+d.front+d.rear).toFixed(4)));
   }
   for(const key of keys)range(details,'dimensions',key,GLOBAL[key],g.dimensions[key]);
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
  if(part==='frontBumper')noseControls(root,g);
  select(root,'part-type',d.label+' type',d.types,p.type,v=>edit('components',part,v,'type'));
  for(const key of [...componentControls[part],...(POSITIONABLE.has(part)?['bias','angle']:[])])range(root,'components',part,{...COMPONENT_FIELDS[key],label:key==='shape'?d.shape[0].toUpperCase()+d.shape.slice(1):COMPONENT_FIELDS[key].label},p[key],key);
  if(part==='wheels'||part==='tires')for(const k of ['diameter','tireWidth','rimRatio'])range(root,'dimensions',k,DIMENSIONS[k],g.dimensions[k]);
  if(part==='frontFenders'){const b=element('button',{textContent:'Open Surface Studio'});b.onclick=()=>openAdvanced();root.append(b);}
  else if(PATCH_PANELS.includes(part)){const b=element('button',{textContent:'Edit surface patch'});b.onclick=()=>setTab('surface');root.append(b);}
 }else if(tab==='view'){
  const s=viewport?.state()??{};
  select(root,'shading','Diagnostic material',[['production','Production materials'],['clay','Neutral clay'],['glossy','Glossy reflection'],['wire','Wireframe'],['normals','Surface normals'],['zebra','Dense zebra']],s.mode??'production',v=>viewport?.setMode(v));
  select(root,'projection','Camera projection',[['perspective','Perspective'],['ortho','Orthographic']],s.projection??'perspective',v=>viewport?.setProjection(v));
  select(root,'display','Assembly',[['complete','Complete vehicle'],['isolate','Isolate selected part'],['exploded','Exploded']],s.display??'complete',v=>viewport?.setDisplay(v));
  select(root,'lighting','Lighting',[['studio','Automotive studio'],['track-clear','Outdoor daylight']],s.light??'studio',v=>viewport?.setLighting(v));
  const d=group(root,'Reference overlay',true),btn=element('button',{textContent:reference?'Replace image':'Choose local reference image'});d.append(btn);
  btn.onclick=()=>{$('reference-file').click();};
  select(d,'ref-view','Reference angle',['front','rear','side','top'],refView,v=>{refView=v;setView(v);});
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
 if(!Object.hasOwn(COMPONENTS,key))return;
 part=key;const end=endOfTab();
 if(end){if(fromViewport&&!fasciaState[end].advanced){if(['headlights','tails'].includes(part))fasciaState[end].category='optics';else if(part==='fogs'||part==='grille')fasciaState[end].category='intakes';else if(part==='frontBumper'||part==='rearBumper')fasciaState[end].category='shape';inspector();}return;}
 viewport?.select(part);if(fromViewport&&tab!=='surface'&&tab!=='view')setTab('parts');else if(tab==='parts'||(tab==='surface'&&!advanced))inspector();
}
function setTab(k){
 if(k!=='surface'&&advanced)closeAdvanced(false);
 const previous=endOfTab();
 tab=k;
 const end=endOfTab();
 document.body.classList.toggle('fascia-mode',Boolean(end));
 if(end){viewport?.select('');if(fasciaState[end].advanced){viewport?.setZoom(2.05);frameGuide(end);}else{setView(end);viewport?.setZoom(1.67);}}
 else if(previous){viewport?.setZoom(1.18);setView('orbit');}
 for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===k));
 inspector();syncGuideUI();
}
function exportForDrive(){
 const detail={bundle:exportVehicle(work.get(),{id:'studio-session-'+(crypto.randomUUID?.()??Date.now().toString(36)),quality:'preview'}),handled:false,error:null};
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
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===v));showReference();
 if(tab==='view')inspector();syncGuideUI();
}
function showReference(){$('ref-overlay').style.backgroundImage=reference&&refView===viewMode?'url("'+reference+'")':'';}
function clearReference(){if(reference)URL.revokeObjectURL(reference);reference=null;showReference();if(tab==='view')inspector();}
function download(data,name){
 const b=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(b),a=element('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
}
function menu(on){$('menu-sheet').hidden=!on;$('menu').setAttribute('aria-expanded',String(on));}
function perform(fn){try{return fn();}catch(e){announce(e.message,true);return false;}}
function afterUndo(doRedo=false){doRedo?work.redo():work.undo();inspector();syncPanel();schedule();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
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
 const b=exportVehicle(work.get());download(JSON.stringify(b),work.get().name+' game vehicle.json');menu(false);announce('Game vehicle bundle exported.');
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
 if(e.key==='Escape'){if(!$('menu-sheet').hidden)menu(false);else if(advanced)closeAdvanced();else if(endOfTab()&&fasciaState[endOfTab()].advanced)setFasciaAdvanced(false);else $('back').click();}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
  e.preventDefault();afterUndo(e.shiftKey);
 }
});
window.addEventListener('pagehide',()=>{if(geo)disposeDesign(geo);viewport?.dispose();if(reference)URL.revokeObjectURL(reference);},{once:true});
try{const s=localStorage.getItem(draftKey);if(s){work.replace(JSON.parse(s),{record:false});hasDraft=true;}}catch{}
window.vehicleDesigner={
 getGenome:work.get,applyGenome(g,{record=false}={}){work.replace(g,{record});inspector();syncPanel();schedule();},
 restoreDraft(g){if(!hasDraft&&g){work.replace(g,{record:false});inspector();syncPanel();regenerate();}},
 createGenome:createVehicle,edit(...args){const applied=edit(...args);if(applied)inspector();return applied;},setTab,selectComponent,openSurface:openAdvanced,closeSurface:closeAdvanced,setView,
 setMaterialMode:m=>viewport?.setMode(m),setLighting:v=>viewport?.setLighting(v),setDisplay:d=>viewport?.setDisplay(d),
 undo(){afterUndo();return work.get();},redo(){afterUndo(true);return work.get();},
 duplicate(){work.duplicate();inspector();schedule();return work.get();},reset(){work.reset();inspector();syncPanel();schedule();return work.get();},
 setFasciaAdvanced,setFasciaGuide,selectGuidePoint,writeGuide,fasciaDemo,
 save:work.save,load(text){work.load(text);inspector();syncPanel();schedule();return work.get();},
 regenerate,export:opts=>exportVehicle(work.get(),opts),drive:exportForDrive,
 renderView:async({angle='orbit',mode='production',lighting='studio',projection=null}={})=>{
  setView(angle);viewport?.setMode(mode);viewport?.setLighting(lighting);
  if(projection)viewport?.setProjection(projection);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return $('scene').toDataURL('image/png');
 },
 getState:()=>({tab,part,view:viewport?.state(),diagnostics:geo?.diagnostics,metadata:geo?.metadata,advanced:Boolean(advanced),fascia:endOfTab()?{...fasciaState[endOfTab()],end:endOfTab(),overlays:Boolean(overlayConfig())}:null})};
setTab('vehicle');regenerate();document.documentElement.dataset.designerReady='true';
