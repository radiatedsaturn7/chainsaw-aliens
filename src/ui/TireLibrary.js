import { RACE_TIRE_COMPOUNDS } from '../racing/raceData.js';
import { createTireDefinition, normalizeTireDefinition, getTireArtRefs, TIRE_PROPERTY_FIELDS } from '../racing/raceTires.js';
import { listProjectFiles, hydrateProjectFilePayload } from './projectFiles.js';

function modal(title) {
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label',title);
  dialog.style.cssText='width:min(640px,94vw);max-height:90dvh;overflow:auto;box-sizing:border-box;background:#19241f;color:#eef4ed;border:1px solid #53605b;border-radius:12px;padding:18px;font:15px system-ui';
  const el=(tag,text='',parent=dialog)=>{const node=document.createElement(tag);node.textContent=text;parent.appendChild(node);return node;};
  el('h2',title);
  const style=el('style');style.textContent='dialog.tire-library label{display:flex;gap:10px;align-items:center;justify-content:space-between;min-height:44px;flex-wrap:wrap}dialog.tire-library input,dialog.tire-library select,dialog.tire-library button{min-height:44px;box-sizing:border-box;max-width:100%;font:inherit;padding:6px}dialog.tire-library button{margin:8px 8px 0 0}';
  dialog.className='tire-library';
  for(const key of ['keydown','keyup'])dialog.addEventListener(key,event=>event.stopPropagation());
  const previous=document.activeElement;
  const close=()=>{dialog.close();dialog.remove();previous?.focus?.();};
  document.body.appendChild(dialog);dialog.showModal();
  return {dialog,el,close};
}
export async function loadSavedTire(name) {
  const payload=await hydrateProjectFilePayload('tires',name);
  if(!payload?.data)throw new Error('Could not load tire');
  const tire=normalizeTireDefinition(payload.data);
  await Promise.all(getTireArtRefs(tire).map(async ref=>{
    const art=await hydrateProjectFilePayload('art',ref);
    if(!art?.data)throw new Error(`Could not load tire artwork: ${ref}`);
  }));
  return tire;
}
export function buildTireLibraryChoices(files = [], currentRef = '') {
  const saved=files.map(file=>({value:`saved:${file.name}`,ref:file.name,label:`${file.name} (saved)`,group:'Saved tires'}));
  const templates=RACE_TIRE_COMPOUNDS.map(tire=>({value:`builtin:${tire.id}`,ref:`builtin:${tire.id}`,label:`${tire.label} (template — no artwork)`,group:'Built-in templates'}));
  const choices=[...saved,...templates];
  return {choices,value:choices.find(choice=>choice.ref===currentRef)?.value || choices[0]?.value || ''};
}
export function openTireLibrary({allowEditor=false,currentRef=''}={}) {
  if(typeof document==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{
    const {dialog,el,close}=modal('Select Tire');let done=false,revision=0,prepared=null;
    const finish=result=>{if(done)return;done=true;revision++;close();resolve(result);};
    const label=el('label','Tire');const select=el('select','',label);
    const model=buildTireLibraryChoices(listProjectFiles('tires'),currentRef);
    let group=null,groupName='';
    for(const choice of model.choices){
      if(groupName!==choice.group){group=el('optgroup','',select);group.label=choice.group;groupName=choice.group;}
      const option=el('option',choice.label,group);option.value=choice.value;
    }
    select.value=model.value;
    const status=el('p');status.setAttribute('role','status');
    const use=el('button','Apply');use.disabled=true;
    const prepare=async()=>{
      const request=++revision,value=select.value;prepared=null;use.disabled=true;
      status.textContent='Loading tire and graphics…';
      try{
        const builtIn=value.startsWith('builtin:');
        const ref=builtIn?value:value.slice(6);
        const tire=builtIn?createTireDefinition(value.slice(8)):await loadSavedTire(ref);
        if(done||request!==revision)return;
        prepared={tire,ref};
        const artwork=getTireArtRefs(tire).length ? 'Saved artwork is ready.' : 'No custom artwork; uses the default tire appearance.';
        status.textContent=`${tire.name} — ${builtIn?'built-in template':'saved tire'}. ${artwork} Press Apply to use this tire.`;
        use.disabled=false;
      }catch(error){if(!done&&request===revision)status.textContent=`Could not load tire: ${error.message}`;}
    };
    select.onchange=()=>{void prepare();};
    use.onclick=()=>{if(prepared&&!use.disabled)finish(prepared);};
    if(allowEditor){const edit=el('button','Open Tire Editor');edit.onclick=()=>finish({edit:true});}
    const cancel=el('button','Cancel');cancel.onclick=()=>finish(null);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
    void prepare();
  });
}
export function openTireProperties(tire, onApply) {
  if(typeof document==='undefined')return;
  const {dialog,el,close}=modal('Tire Properties');const draft=normalizeTireDefinition(tire);
  const label=el('label','Name'),name=el('input','',label);name.value=draft.name;name.maxLength=100;
  el('h3','Surface grip');
  el('p','Higher grip improves acceleration, braking, and cornering on that surface. Values are tire multipliers: 1 is the baseline, 0.5 is half, and 2 is double before other physics effects. Weather changes the ground conditions; there is no separate weather-grip multiplier.');
  const inputs=TIRE_PROPERTY_FIELDS.map((field,index)=>{
    if(field.path==='compound.wetEvacuationFactor'){
      el('h3','Water and wear');
      el('p','Water evacuation and tread depth affect resistance to aquaplaning. Higher wear rate wears tires faster.');
    }
    if(field.path==='size.widthMm'){
      el('h3','Size and pressure');
      el('p','Physical dimensions and default cold pressure applied when selecting this tire on a car. Graphic size and position are adjusted in the Car Editor.');
    }
    const label=el('label',field.label),input=el('input','',label);input.type='number';input.required=true;input.min=field.min;input.max=field.max;input.step=field.step;
    if(field.description){const help=el('p',field.description);help.id=`tire-property-help-${index}`;help.style.cssText='margin:0 0 12px;color:#b8c7be;font-size:13px';input.setAttribute('aria-describedby',help.id);}
    input.value=field.path.split('.').reduce((value,key)=>value[key],draft);return {field,input};
  });
  const apply=el('button','Apply');apply.onclick=()=>{
    for(const {input} of inputs)if(!input.reportValidity())return;
    draft.name=name.value;
    for(const {field,input} of inputs){const keys=field.path.split('.');let target=draft;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=Number(input.value);}
    onApply(normalizeTireDefinition(draft));close();
  };
  const cancel=el('button','Cancel');cancel.onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
}
