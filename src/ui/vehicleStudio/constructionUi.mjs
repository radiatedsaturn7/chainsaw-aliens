import {
 BODY_EDITOR_FIELDS,HOOD_CONSTRUCTION_FIELDS,FINISH_FIELDS,WING_FIELDS,WING_MOUNTS,EXHAUST_FIELDS,STYLE_FIELDS,STYLE_KINDS,PAIR_MODES,CABIN_LAYOUTS,DRIVER_SIDES,
 EXHAUST_SHAPES,EXHAUST_FINISHES,OPTIC_HOUSINGS,OPTIC_LAYOUTS,OPTIC_FIELDS,
 getSideSettings,newOutlet,newStyle
} from './genome.mjs';
import {HOOD_LIDS,HOOD_LID_FIELDS} from './genome.mjs';

export const CONSTRUCTION_PANELS={cabin:'Cabin and seating',finish:'Paint finish',hood:'Hood shoulders and scoop',exhaust:'Exhaust outlets',wing:'Wing and supports',styling:'Panel styling curves',pairs:'Paired lamps'};
const node=(tag,props={})=>Object.assign(document.createElement(tag),props);
const choices={L:'Left',R:'Right',both:'Both sides'};
function nextId(rows,prefix){
 let i=1;while(rows.some(r=>r.id===prefix+'-'+i))i++;
 return prefix+'-'+i;
}
function button(parent,id,label,run,dis=false){
 const el=node('button',{id,type:'button',textContent:label,disabled:dis});el.onclick=run;parent.append(el);return el;
}
function field(root,label){
 const row=node('label',{className:'field'});row.append(node('span',{textContent:label}));root.append(row);return row;
}
function select(root,id,label,options,current,onChange){
 const el=node('select',{id});el.setAttribute('aria-label',label);
 for(const [value,name] of Object.entries(options))el.append(new Option(name,value));
 el.value=current;el.onchange=()=>{if(onChange(el.value)===false)el.value=current;};field(root,label).append(el);return el;
}
function toggled(root,id,label,current,onChange){
 const el=node('input',{id,type:'checkbox',checked:current});el.setAttribute('aria-label',label);
 el.onchange=()=>{if(onChange(el.checked)===false)el.checked=!el.checked;};field(root,label).append(el);
}
function numeric(root,id,spec,get,put){
 const {label,min,max,step}=spec,row=field(root,label),wrap=node('div');
 const slider=node('input',{id:'build-range-'+id,type:'range',min,max,step,value:get()});
 const num=node('input',{id:'build-num-'+id,type:'number',min,max,step,value:get(),inputMode:'decimal'});
 slider.setAttribute('aria-label',label+' slider');num.setAttribute('aria-label',label+' value');
 const refresh=()=>{const n=get();slider.value=n;num.value=Number(n.toFixed(6));};
 let moving=false;
 slider.oninput=()=>{
  const changed=put(slider.valueAsNumber,{record:!moving});
  moving ||= changed;refresh();
 };
 slider.onblur=slider.onchange=()=>{moving=false;};
 num.onchange=()=>{if(Number.isFinite(num.valueAsNumber)){const v=step===1&&Number.isInteger(min)&&Number.isInteger(max)?Math.round(num.valueAsNumber):num.valueAsNumber;put(v,{record:true});}refresh();};
 wrap.append(slider,num);row.append(wrap);
}
function formula(root,id,label,get,put,placeholder){
 const r=field(root,label),el=node('input',{id,type:'text',value:get()??'',maxLength:240,spellcheck:false,placeholder});
 el.setAttribute('aria-label',label);
 const commit=()=>{if(put(el.value.trim(),{record:true})===false)el.value=get()??'';};
 el.onchange=commit;el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}};
 r.append(el);
 const hint=node('p',{textContent:'Optional bounded expression. Use +, −, × (*), ÷ (/), sin, cos, abs, min, max or clamp. Blank uses the base profile.'});root.append(hint);
}
function listLabel(rows,label){return Object.fromEntries(rows.map((r,i)=>[r.id,label+' '+(i+1)+(r.shape?' · '+(EXHAUST_SHAPES[r.shape]??r.shape):r.kind?' · '+(STYLE_KINDS[r.kind]??r.kind):'')]));}
export function renderConstruction(root,{state,get,edit,repaint,setLevel,level,setView}){
 const initial=get(),data=initial.construction;
 root.append(node('h2',{className:'studio-head',textContent:'Construction workbench'}));
 root.append(node('p',{className:'studio-intro',textContent:'Build the parts behind the styling. Edits update the live model and remain in the design file.'}));
 if(!data){root.append(node('p',{textContent:'Select a construction-enabled design.'}));return;}
 const choosePanel=v=>{state.panel=v;state.id=null;repaint();};
 select(root,'build-panel','Construction area',CONSTRUCTION_PANELS,state.panel,choosePanel);
 const sectionValue=(k,p)=>get().construction[k][p];
 const sectionSet=(key,prop,v,opts)=>{
  const part=get().construction[key];return edit('construction',key,{...part,[prop]:v},null,opts);
 };
 const sectionNumbers=(key,specs)=>{for(const [p,spec] of Object.entries(specs))numeric(root,p,spec,()=>sectionValue(key,p),(v,o)=>sectionSet(key,p,v,o));};
 const promote=()=>button(root,'build-expert','Expert formulas',()=>setLevel('expert'));
 if(state.panel==='cabin'){
  select(root,'build-cabin-layout','Seating layout',CABIN_LAYOUTS,data.cabin.layout,v=>sectionSet('cabin','layout',v));
  if(data.cabin.layout!=='center-driver')select(root,'build-driver-side','Driver side',DRIVER_SIDES,data.cabin.driverSide,v=>sectionSet('cabin','driverSide',v));
  sectionNumbers('cabin',Object.fromEntries(Object.entries(BODY_EDITOR_FIELDS).filter(([k])=>k!=='rearBenchSeats'||data.cabin.layout==='three-row')));
  root.append(node('p',{textContent:'Seats and interior panels fit the body dimensions. A lightweight cabin is exported for the drive preview.'}));
 }else if(state.panel==='finish'){
  sectionNumbers('finish',FINISH_FIELDS);
  root.append(node('p',{textContent:'Clearcoat roughness controls reflection sharpness in the editor and exported vehicle. Lower values sharpen the reflected environment without turning paint metallic.'}));
 }else if(state.panel==='hood'){
  select(root,'build-hood-intake','Hood intake',{scoop:'Raised scoop',vents:'Vents',off:'Off'},initial.components.scoop.type,v=>edit('components','scoop',v,'type'));
  select(root,'build-hood-lids','Hood headlamp layout',HOOD_LIDS,data.hood.lampLids,v=>{
   const ok=sectionSet('hood','lampLids',v);if(ok!==false)repaint();return ok;
  });
  if(data.hood.lampLids!=='off')sectionNumbers('hood',HOOD_LID_FIELDS);
  sectionNumbers('hood',HOOD_CONSTRUCTION_FIELDS);
  root.append(node('p',{textContent:'Shoulder changes are formed into the hood surface. The scoop width and height can be edited separately; zero preserves the existing Size or Shape behavior.'}));
  button(root,'build-show-hood','Frame elevated front',()=>setView('frontElevated'));
 }else if(state.panel==='wing'){
  select(root,'build-spoiler-style','Spoiler style',{wing:'Airfoil wing','boxed wing':'Boxed wing',lip:'Deck lip',off:'Off'},initial.components.spoiler.type,v=>{
   const ok=edit('components','spoiler',v,'type');if(ok!==false)repaint();return ok;
  });
  const spoiler=initial.components.spoiler.type,boxed=spoiler==='boxed wing',swan=data.wing.supportMount==='top';
  if(spoiler==='wing')select(root,'build-wing-mount','Support mounting',WING_MOUNTS,data.wing.supportMount,v=>{
   const ok=sectionSet('wing','supportMount',v);if(ok!==false)repaint();return ok;
  });
  sectionNumbers('wing',Object.fromEntries(Object.entries(WING_FIELDS).filter(([k])=>boxed?!['elements','spacing','supports'].includes(k):!k.startsWith('boxWall')&&!(spoiler==='wing'&&swan&&k==='elements'))));
  if(spoiler==='wing'&&swan)root.append(node('p',{textContent:'Slim curved supports attach to the top of a single airfoil, leaving its underside clear.'}));
  if(level==='expert')formula(root,'build-wing-formula','Span profile formula',()=>sectionValue('wing','formula'),(v,o)=>sectionSet('wing','formula',v,o),'0.08*sin(pi*u)');
  else promote();
  button(root,'build-show-wing','Frame rear view',()=>setView('rear'));
 }else if(state.panel==='exhaust'||state.panel==='styling'){
  const isPipe=state.panel==='exhaust',key=isPipe?'exhaust':'features';
  const existing=data[key],prefix=isPipe?'outlet':'style',max=isPipe?8:12;
  if(!existing.some(o=>o.id===state.id))state.id=existing[0]?.id??null;
  const getRow=()=>get().construction[key].find(x=>x.id===state.id);
  const setRow=(field,val,opts)=>{
   const rows=get().construction[key];
   return edit('construction',key,rows.map(x=>x.id===state.id?{...x,[field]:val}:x),null,opts);
  };
  const row=getRow(),tools=node('div',{className:'feature-buttons'});root.append(tools);
  if(existing.length)select(root,'build-active-row',isPipe?'Selected outlet group':'Selected styling curve',listLabel(existing,isPipe?'Outlet':'Curve'),state.id,v=>{state.id=v;repaint();});
  button(tools,'build-add',isPipe?'Add outlet group':'Add styling curve',()=>{
   const rows=get().construction[key],id=nextId(rows,prefix),item=isPipe?newOutlet(id):newStyle(id);
   if(edit('construction',key,[...rows,item])){state.id=id;repaint();}
  },existing.length>=max);
  button(tools,'build-remove',isPipe?'Remove group':'Remove curve',()=>{
   if(edit('construction',key,get().construction[key].filter(x=>x.id!==state.id))){state.id=null;repaint();}
  },!row);
  if(!row){
   root.append(node('p',{textContent:isPipe?'No custom groups. The legacy exhaust style still applies. Add a group to build explicitly placed tips.':'Add a curve to stamp or recess a feature directly into the body side.'}));return;
  }
  if(isPipe){
   select(root,'build-exhaust-shape','Tip profile',EXHAUST_SHAPES,row.shape,v=>setRow('shape',v));
   select(root,'build-exhaust-finish','Tip finish',EXHAUST_FINISHES,row.finish,v=>setRow('finish',v));
   toggled(root,'build-exhaust-mirror','Mirror this group across the centerline',row.mirror,v=>setRow('mirror',v));
  }else{
   select(root,'build-style-kind','Curve type',STYLE_KINDS,row.kind,v=>setRow('kind',v));
   select(root,'build-style-side','Apply to',choices,row.side,v=>setRow('side',v));
  }
  for(const [p,spec] of Object.entries(isPipe?EXHAUST_FIELDS:STYLE_FIELDS))numeric(root,p,spec,()=>getRow()[p],(v,o)=>setRow(p,v,o));
  if(!isPipe){
   if(level==='expert')formula(root,'build-style-formula','Curve profile formula',()=>getRow().formula,(v,o)=>setRow('formula',v,o),'0.04*sin(pi*u)');
   else promote();
  }
 }else if(state.panel==='pairs'){
  const end=state.end??'front',k=end==='front'?'headlights':'taillights',mode=data.symmetry[k],side=state.side??'L';
  select(root,'build-lamp-end','Lamp assembly',{front:'Headlights',rear:'Taillights'},end,v=>{state.end=v;repaint();});
  select(root,'build-pair-mode','Pair behavior',PAIR_MODES,mode,v=>{if(sectionSet('symmetry',k,v)){repaint();return true;}return false;});
  if(mode==='independent')select(root,'build-pair-side','Editing side',{L:'Left',R:'Right'},side,v=>{state.side=v;repaint();});
  root.append(node('p',{textContent:mode==='independent'?'Controls apply only to the selected side. Both assemblies remain visible.':mode==='linked'?'Both sides share the same design settings.':'Both sides share settings and mirror their geometry.'}));
  const now=()=>{
   const g=get();return getSideSettings(g,k,side,g.optics[end]);
  };
  const set=(prop,val,opts)=>mode==='independent'
   ?edit('sideOptic',side+':'+end,val,prop,opts)
   :edit('optics',end,val,prop,opts);
  const o=now();
  select(root,'build-lens-housing','Housing shape',OPTIC_HOUSINGS,o.housing,v=>set('housing',v));
  select(root,'build-lens-layout','Optical layout',OPTIC_LAYOUTS,o.layout,v=>set('layout',v));
  const fields={...OPTIC_FIELDS,
   modules:{label:'Custom light modules (0 = layout default)',min:0,max:8,step:1},
   spacing:{label:'Module spacing',min:0,max:1,step:.01}};
  for(const [p,spec] of Object.entries(fields))numeric(root,p,spec,()=>now()[p]??(p==='spacing'?.5:0),(v,o)=>set(p,v,o));
  if(level==='expert')formula(root,'build-lens-formula','Lens outline formula',()=>now().formula,(v,o)=>set('formula',v,o),'0.05*cos(2*theta)');
  else promote();
  button(root,'build-show-lamps','Frame '+end+' view',()=>setView(end));
 }
}
