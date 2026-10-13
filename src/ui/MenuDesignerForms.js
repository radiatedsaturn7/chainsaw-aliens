import {openEditorForm,chooseEditorFiles} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
import {listProjectFiles,hydrateProjectFilePayload,saveProjectFileAndConfirm} from './projectFiles.js';
import {widgetLabel,MENU_DATA_SOURCES,propertyPaths} from '../menus/MenuWidgets.js';
import {MENU_SETTINGS} from '../menus/MenuDocument.js';

const text=(id,label,value='',extra={})=>({id,label,value,type:'text',required:false,...extra});
const select=(id,label,value,options)=>({id,label,value,options,required:false});
const parse=value=>{try{return JSON.parse(value)}catch{return value}};
export const parameterNames=editor=>[...new Set([...Object.keys(editor.menu.parameters),...Object.keys(MENU_SETTINGS).map(k=>`settings.${k}`),'carRef','actorRef','item','carAngle','difficulty','raceRef','enabled'])];
const bindingField=(editor,e)=>text('binding','Value parameter',e.binding,{suggestions:parameterNames(editor)});
const fileOptions=folder=>[{value:'',label:'Use selected value parameter'},...listProjectFiles(folder).map(f=>({value:f.name,label:f.name}))];

export async function chooseImage(editor,{background=false}={}){
  const result=await openEditorForm(background?'Screen Background':'Image Source',[select('source','Image source','saved',[{value:'saved',label:'Saved artwork'},{value:'device',label:'Import image from device'},{value:'clear',label:'Remove image'}])]);
  if(!result)return;
  let ref='';
  if(result.source==='saved'){
    const picked=await openProjectBrowser({fixedFolder:'art',initialFolder:'art',mode:'open',title:'Choose Menu Image'});
    if(!picked?.name)return;ref=picked.name;
  }else if(result.source==='device'){
    const [file]=await chooseEditorFiles('image/*');if(!file)return;
    const image=await createImageBitmap(file);
    try{
      if(image.width*image.height>4194304)throw Error('Use an image of at most 4 million pixels');
      const result=await openEditorForm('Save Imported Image',[text('name','Artwork name',file.name.replace(/\.[^.]+$/,''),{required:true})]);if(!result)return;
      if(listProjectFiles('art').some(f=>f.name===result.name))throw Error('That artwork name already exists. Choose a new name to keep both images.');
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const pixels=Array.from({length:canvas.width*canvas.height},(_,i)=>bytes[i*4+3]?'#'+Array.from(bytes.slice(i*4,i*4+4),n=>n.toString(16).padStart(2,'0')).join(''):null);
      await saveProjectFileAndConfirm('art',result.name,{name:result.name,width:canvas.width,height:canvas.height,frames:[{pixels}]});ref=result.name;
    }finally{image.close();}
  }
  editor.change(()=>{if(background)editor.screen.backgroundArt=ref;else editor.element.artRef=ref;});
  editor.status=ref?`Image: ${ref}`:'Image removed';
}
export async function setupWidget(editor){
  const e=editor.element;if(!e)throw Error('Select a widget to configure');
  if(e.type==='image')return chooseImage(editor);
  if(e.type==='button'){
    const result=await openEditorForm('Button',[text('label','Button text',e.label)]);if(!result)return;
    editor.change(()=>{editor.element.label=result.label});return editor.runAction('element-action');
  }
  if(['property-display','asset-preview'].includes(e.type))return setupDataWidget(editor);
  const fields=[text('label','Label',e.label)];
  const description=[];
  if(['choice','slider','toggle','keybind'].includes(e.type)){
    fields.push(bindingField(editor,e));
    description.push('Widgets sharing a value parameter stay linked. Settings parameters affect the running game; custom values are passed to the next race or level.');
  }
  if(e.type==='shape')fields.push(select('shape','Shape',e.shape,['rectangle','ellipse','triangle']),text('fill','Fill color',e.fill),text('stroke','Outline color',e.stroke),{id:'strokeWidth',label:'Outline width (pixels)',value:e.strokeWidth,min:0,max:30});
  if(e.type==='container'){
    description.push('Included widgets move, resize, copy and reorder with this container. New widgets added while it is selected join automatically. Use Layers to select the container behind its children.');
    for(const child of editor.screen.elements.filter(item=>item.id!==e.id&&(item.parentId===e.id||item.parentId===e.parentId)))fields.push(select(`member:${child.id}`,child.label||child.id,child.parentId===e.id?'in':'out',[{value:'out',label:'Outside container'},{value:'in',label:'Inside container'}]));
  }
  if(e.type==='text')description.push('Use {{difficulty}} or another parameter name in the text to display its current value.');
  if(e.type==='choice')fields.push(select('source','Options source',e.source,[{value:'',label:'Custom options'},'cars','actors','doodads','races','levels','movies']),{id:'options',label:'Custom options: label = value, one per line',type:'textarea',required:false,value:e.options.map(o=>`${o.label} = ${JSON.stringify(o.value)}`).join('\n')});
  if(e.type==='slider'){
    fields.push(select('preset','Slider controls','custom',[{value:'custom',label:'Custom parameter / keep current'},...Object.entries(MENU_SETTINGS).map(([key,v])=>({value:`settings.${key}`,label:v.label})),{value:'carAngle',label:'Car viewing angle (degrees)'}]));
    fields.push(...['min','max','step'].map(id=>({id,label:{min:'Minimum',max:'Maximum',step:'Step'}[id],value:e[id]})),{id:'initial',label:'Initial value',value:Number(editor.menu.parameters[e.binding]??MENU_SETTINGS[e.binding.split('.')[1]]?.default??e.min)});
  }
  if(e.type==='toggle')fields.push(select('initial','Initial value',String(Boolean(editor.menu.parameters[e.binding])),['false','true']));
  if(e.type==='keybind'){
    fields.splice(1,1,select('binding','Control',e.binding,['left','right','up','down','jump','attack','interact'].map(k=>({value:`input.${k}`,label:k}))));
  }
  if(['car-preview','car-stats','power-curve'].includes(e.type)){
    fields.push(select('assetRef','Car',e.assetRef,fileOptions('cars')),text('binding','Selected car parameter',e.binding,{suggestions:parameterNames(editor)}));
    description.push('Choose a fixed saved car, or use the same parameter as a car Selection List.');
  }
  if(e.type==='car-preview'){
    fields.push(select('rotationMode','Rotation',e.angleBinding?'parameter':e.animation==='spin'?'auto':'fixed',[{value:'auto',label:'Rotate automatically'},{value:'parameter',label:'Controlled by a slider / parameter'},{value:'fixed',label:'Fixed angle'}]),text('angleBinding','Rotation parameter (degrees)',e.angleBinding||'carAngle',{suggestions:parameterNames(editor)}),{id:'angle',label:'Initial angle (degrees)',value:e.angle},{id:'duration',label:'Seconds per full rotation',value:e.duration,min:0.1,max:600});
    description.push('Sprite cars and their tires turn together in 45° steps. 3D cars rotate smoothly.');
  }
  if(e.type==='video')fields.push(text('videoUrl','Video URL',e.videoUrl),select('loop','Loop',String(e.loop),['true','false']));
  const result=await openEditorForm(`${widgetLabel(e.type)} Properties`,fields,{description:description.join('\n')});if(!result)return;
  editor.change(()=>{
    const {initial,preset,rotationMode,...values}=result;
    for(const key of Object.keys(values).filter(k=>k.startsWith('member:'))){const child=editor.screen.elements.find(item=>item.id===key.slice(7));if(child)child.parentId=values[key]==='in'?e.id:e.parentId;delete values[key];}
    if(values.options!==undefined)values.options=values.options.split('\n').filter(l=>l.trim()).map(l=>{const i=l.indexOf('=');return {label:(i<0?l:l.slice(0,i)).trim(),value:parse((i<0?l:l.slice(i+1)).trim())}});
    if(values.loop!==undefined)values.loop=values.loop==='true';
    if(preset&&preset!=='custom'){
      const setting=MENU_SETTINGS[preset.split('.')[1]];
      Object.assign(values,{binding:preset,min:setting?.min??0,max:setting?.max??360,step:setting?.step??45});
      if(values.label===e.label||!values.label)values.label=setting?.label||'Car viewing angle';
    }
    if(e.type==='slider'&&values.max<=values.min)throw Error('Maximum must be greater than minimum');
    if(rotationMode){values.animation=rotationMode==='auto'?'spin':'none';if(rotationMode!=='parameter')values.angleBinding='';}
    Object.assign(editor.element,values);
    if(e.type==='choice'&&values.binding){const options=values.source?editor.resources.choices(values.source,editor.menu):values.options;if(options.length&&!options.some(o=>JSON.stringify(o.value)===JSON.stringify(editor.menu.parameters[values.binding])))editor.menu.parameters[values.binding]=options[0].value;}
    if(initial!==undefined&&values.binding)editor.menu.parameters[values.binding]=e.type==='toggle'?initial==='true':Math.max(values.min,Math.min(values.max,initial));
    if(rotationMode==='parameter'&&values.angleBinding&&editor.menu.parameters[values.angleBinding]===undefined)editor.menu.parameters[values.angleBinding]=values.angle;
  });
}
export async function setupDataWidget(editor){
  const e=editor.element;
  const result=await openEditorForm(`${widgetLabel(e.type)} Source`,[select('dataSource','Data source',e.dataSource,MENU_DATA_SOURCES),text('binding','Selected object parameter',e.binding,{suggestions:parameterNames(editor)})],{description:'Use the same parameter as a Selection List, or choose a fixed saved object in the next step. For custom items, the parameter holds a JSON object such as {"name":"Sword","damage":12,"artRef":"Sword Art"}.'});if(!result)return;
  const fields=[text('label','Label',e.label)];
  if(result.dataSource!=='parameters')fields.push(select('assetRef','Fixed object',e.assetRef,fileOptions(result.dataSource)));
  const fixed=await openEditorForm('Choose Object',fields);if(!fixed)return;
  const draft={...e,...result,...fixed,assetRef:fixed.assetRef||''};
  const ref=draft.assetRef||editor.menu.parameters[draft.binding];
  if(ref&&draft.dataSource!=='parameters')await hydrateProjectFilePayload(draft.dataSource,ref);
  const data=editor.resources.elementAsset(draft,editor.menu.parameters),paths=propertyPaths(data);
  if(e.type==='property-display'){
    const picked=await openEditorForm('Displayed Property',[text('property','Property path',e.property,{suggestions:paths.map(p=>p.value),required:true}),text('suffix','Suffix / units',e.suffix),{id:'decimals',label:'Decimal places',value:e.decimals,min:0,max:6,step:1}],{description:paths.length?`Available properties: ${paths.slice(0,30).map(p=>p.value).join(', ')}`:'Choose a property such as name, health, tuning.powerHp, or damage. It updates whenever the selected object changes.'});if(!picked)return;Object.assign(draft,picked);
  }else{
    const picked=await openEditorForm('Object Image',[text('property','Artwork reference property (blank = actor idle art)',e.property==='name'?'':e.property,{suggestions:paths.filter(p=>/art|image/i.test(p.value)).map(p=>p.value)}),select('imageFit','Fit image',e.imageFit,['contain','cover','stretch'])]);if(!picked)return;Object.assign(draft,picked);
  }
  editor.change(()=>Object.assign(editor.element,draft));
}
