import {NOSE_PROFILES,NOSE_FIELDS} from './genome.mjs';
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
const work=createDesignSession(), fields=new Map();let tab='vehicle',part='frontFenders',geo=null,regeneration=0,advanced=null,reference=null,refView='side',panelSync=false,viewMode='orbit',noticeTimer=0,hasDraft=false;
const element=(tag,props={})=>Object.assign(document.createElement(tag),props);
const announce=(message,error=false,hold=false)=>{
 clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').dataset.error=String(error);
 if(message&&!hold)noticeTimer=setTimeout(()=>{$('notice').textContent=geo?.diagnostics.issues[0]??'';$('notice').dataset.error=String(Boolean(geo?.diagnostics.issues.length));},3400);
};
let viewport=null;
try{
 viewport=createViewport($('scene'),{onZoom:n=>$('zoom').value=n,onPick:key=>selectComponent(key,true),onFailure:e=>announce(e,true,true)});
}catch(e){announce('WebGL preview unavailable on this device. Export and file controls still work.',true,true);}

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
  if(geo)disposeDesign(geo);geo=design;viewport?.setDesign(geo);
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
 const l=fieldRow(parent,label),x=element('input',{type:'color',value:g.materials[key]});x.setAttribute('aria-label',label);x.onchange=()=>edit('materials',key,x.value);l.append(x);
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
function noseControls(parent,g){
 const p=g.components.frontBumper;
 select(parent,'nose-profile','Nose shape',Object.entries(NOSE_PROFILES),p.profile,v=>edit('components','frontBumper',v,'profile'));
 for(const [k,spec] of Object.entries(NOSE_FIELDS))range(parent,'components','frontBumper',spec,p[k],k);
 parent.append(element('p',{textContent:'Try Top view to see the silhouette. Corner sweep sets how far the sides trail the center. Hood-to-bumper roll softens the leading edge. Nose drop lowers the front profile.'}));
}
function inspector(){
 const root=$('inspector'),g=work.get();root.replaceChildren();fields.clear();
 if(tab==='vehicle'){
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
 part=key;viewport?.select(part);if(fromViewport&&tab!=='surface'&&tab!=='view')setTab('parts');else if(tab==='parts'||(tab==='surface'&&!advanced))inspector();
}
function setTab(k){
 if(k!=='surface'&&advanced)closeAdvanced(false);
 tab=k;
 for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===k));
 inspector();
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
 if(tab==='view')inspector();
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
 if(e.key==='Escape'){if(!$('menu-sheet').hidden)menu(false);else if(advanced)closeAdvanced();else $('back').click();}
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
 save:work.save,load(text){work.load(text);inspector();syncPanel();schedule();return work.get();},
 regenerate,export:opts=>exportVehicle(work.get(),opts),drive:exportForDrive,
 renderView:async({angle='orbit',mode='production',lighting='studio',projection=null}={})=>{
  setView(angle);viewport?.setMode(mode);viewport?.setLighting(lighting);
  if(projection)viewport?.setProjection(projection);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return $('scene').toDataURL('image/png');
 },
 getState:()=>({tab,part,view:viewport?.state(),diagnostics:geo?.diagnostics,metadata:geo?.metadata,advanced:Boolean(advanced)})};
setTab('vehicle');regenerate();document.documentElement.dataset.designerReady='true';
