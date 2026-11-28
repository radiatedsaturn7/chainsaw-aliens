import {normalizeModelBinding} from '../model3d/ModelBinding.js';
import {hasRenderableModelGeometry} from '../model3d/ModelGeometryReady.js';
import {validateModelDocument} from '../model3d/ModelDocument.js';
import {CAR_VERSIONS_FILE,canonicalCarVersionRef,normalizeCarVersions,selectCarVersion} from '../racing/CarVersions.js';
import {getRaceCarVersions,hydrateRaceCarVersions} from './RaceCarVersionFiles.js';
import {hydrateProjectFilePayload,listProjectFiles} from './projectFiles.js';
import {isProjectStorageReadOnly,queueServerFileSave} from './serverStorage.js';
import {openEditorForm} from './shared/editorForm.js';

const POSITION_NAMES=[
  'WheelMount_FL','WheelMount_FR','WheelMount_RL','WheelMount_RR',
  'HeadlightMount_L','HeadlightMount_R','TaillightMount_L','TaillightMount_R'
];
const HANDLE_FIELDS=['dimensions','tuning','setup','transmissions','defaultTransmissionType'];
const canonicalJSON=(value)=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)
  ?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);
const modelBinding=car=>car?.art?.bodyModel?.ref?normalizeModelBinding(car.art.bodyModel):null;

function familyOf(registry,name) {
  const canonical=canonicalCarVersionRef(registry,name);
  const record=Object.hasOwn(registry.families,canonical)?registry.families[canonical]:null;
  return {canonical,record,active:record?record.active:canonical};
}

export function carAvailabilityLabel(editor,registry=getRaceCarVersions()) {
  const name=editor.currentCarDocumentName;
  if(!name)return 'Availability (Save First)';
  return 'Availability: '+(familyOf(registry,name).active===name?'Enabled':'Disabled');
}

function authoredCar(payload,name) {
  if(payload?.storageSource==='cache')throw Error(`Save ${name} to project storage before changing availability.`);
  const doc=payload?.data??payload;
  if(doc?.kind!=='race-car'||!doc.car?.id)throw Error(`Saved car not found: ${name}`);
  return doc.car;
}

export function verifyPaired3DCar(original,replacement,inputModel,inputWheelModel) {
  const binding=modelBinding(replacement);
  if(!binding)throw Error('A replacement needs a saved 3D body model.');
  if(!binding.scale.every(value=>value>0))throw Error('Replacement body scale must be positive on all axes.');
  if(!original?.tuning||!replacement?.tuning||HANDLE_FIELDS.some(field=>canonicalJSON(original[field])!==canonicalJSON(replacement[field])))
    throw Error('The paired files must have matching handling, dimensions, tires, and transmission settings.');
  const model=validateModelDocument(structuredClone(inputModel));
  if(!hasRenderableModelGeometry(model))throw Error('The saved 3D body has no non-degenerate geometry.');
  if(replacement.art?.wheelModel?.ref){
    const wheel=normalizeModelBinding(replacement.art.wheelModel);
    if(!wheel.scale.every(value=>value>0))throw Error('Replacement wheel scale must be positive on all axes.');
    if(wheel.ref===binding.ref)throw Error('The 3D wheel must be a separate saved model.');
    if(!inputWheelModel)throw Error('Save the 3D wheel model first: '+wheel.ref);
    const wheelModel=validateModelDocument(structuredClone(inputWheelModel));
    if(!hasRenderableModelGeometry(wheelModel))throw Error('The saved 3D wheel has no non-degenerate geometry.');
  }
  for(const required of POSITION_NAMES){
    if(model.joints.filter(joint=>joint.name===required).length!==1)
      throw Error(`The 3D body needs one exact ${required} socket.`);
  }
  return true;
}

export function planCarAvailability(registry,name,part,desired,peer,validNames) {
  const {canonical,active,record}=familyOf(registry,name);
  if(!['enabled','disabled'].includes(desired))throw Error('Choose Enabled or Disabled.');
  if((desired==='enabled')===(active===name))return null;
  if(desired==='enabled')return {canonical,active:name,alternates:record.alternates,verify:name===canonical?null:name};
  if(!peer||peer===name||!validNames.has(peer))throw Error('Choose another saved car to keep this family playable.');
  if(record){
    if(![canonical,...record.alternates].includes(peer))throw Error('Choose a version already in this car family.');
    return {canonical,active:peer,alternates:record.alternates,verify:peer===canonical?null:peer};
  }
  if(familyOf(registry,peer).record)throw Error('That car is already paired. Open its original to manage the family.');
  // The unlinked 3D file may be disabled as a draft; for an unlinked
  // original, disabling activates the saved 3D replacement instead.
  if(modelBinding(part))return {canonical:peer,active:peer,alternates:[name],verify:name};
  return {canonical:name,active:peer,alternates:[peer],verify:peer};
}

const fresh={hydrateDependencies:false,freshness:'newest'};
async function loadRegistry(hydrate) {
  const payload=await hydrate('cars',CAR_VERSIONS_FILE,fresh);
  const data=payload?.data??payload;
  if(data&&(data.kind!=='race-car-versions'||data.schemaVersion!==1))throw Error('Car availability registry is not a supported document.');
  return normalizeCarVersions(data);
}

export async function openCarAvailability(editor,{
  showForm=openEditorForm,hydrate=hydrateProjectFilePayload,list=listProjectFiles,
  save=queueServerFileSave,readOnly=isProjectStorageReadOnly,refresh=hydrateRaceCarVersions
}={}) {
  if(editor.mode!=='car'||!editor.selectedCar||!editor.currentCarDocumentName)
    throw Error('Save this car before changing its availability.');
  if(editor.carAvailabilityBusy)return false;
  const openedCar=editor.selectedCar,name=editor.currentCarDocumentName;
  const isCurrent=()=>editor.mode==='car'&&editor.currentCarDocumentName===name&&editor.selectedCar===openedCar;
  editor.carAvailabilityBusy=true;
  try{
    const saved=authoredCar(await hydrate('cars',name,fresh),name);
    const registry=await loadRegistry(hydrate);
    const {canonical,active,record}=familyOf(registry,name);
    if(!isCurrent())return false;
    if(readOnly())throw Error('Car availability is read-only. Open the project with writable storage.');
    const validNames=new Set(list('cars',{allowSyncFetch:false}).map(entry=>entry.name));
    const linked=record?[canonical,...record.alternates].filter(ref=>ref!==name&&validNames.has(ref)):null;
    const hints=linked||[...validNames].filter(ref=>ref!==name).sort((a,b)=>a.localeCompare(b));
    const initiallyEnabled=active===name;
    const result=await showForm('Car Availability',[
      {id:'availability',label:'This version',value:initiallyEnabled?'enabled':'disabled',
        options:[{value:'enabled',label:'Enabled'},{value:'disabled',label:'Disabled'}]},
      {id:'peer',label:record?'Version to keep enabled':modelBinding(saved)?'Original saved car':'Saved 3D replacement',
        ...(linked?{options:[{value:'',label:'Choose a version'},...linked.map(value=>({value,label:value}))]}
                   :{type:'text',suggestions:hints}),
        value:linked?.length===1?linked[0]:'',required:false,
        visibleWhen:({availability})=>initiallyEnabled&&availability==='disabled'}
    ],{
      description:`${name} is ${initiallyEnabled?'enabled':'disabled'}. ${record?`Current playable version: ${active||'none'}.\n`:''}One version stays in the game. Disabled versions stay saved and editable under File → Open.`,
      applyLabel:'Save Availability',
      validate:({availability,peer})=>{
        try{planCarAvailability(registry,name,saved,availability,peer?.trim(),validNames);return null;}
        catch(error){return error.message;}
      }
    });
    if(!result||!isCurrent())return false;
    const change=planCarAvailability(registry,name,saved,result.availability,result.peer?.trim(),validNames);
    if(!change)return false;
    const readCar=async ref=>authoredCar(await hydrate('cars',ref,fresh),ref);
    const original=await readCar(change.canonical);
    if(change.verify){
      const replacement=await readCar(change.verify),binding=modelBinding(replacement);
      if(!binding)throw Error('A replacement needs a saved 3D body model.');
      const wheelRef=replacement.art?.wheelModel?.ref;
      const readModel=async(ref,label)=>{
        const payload=await hydrate('models',ref,fresh);
        if(!payload||payload.storageSource==='cache')throw Error(`Save the 3D ${label} model first: ${ref}`);
        return payload.data??payload;
      };
      const [body,wheel]=await Promise.all([readModel(binding.ref,'body'),wheelRef?readModel(wheelRef,'wheel'):null]);
      verifyPaired3DCar(original,replacement,body,wheel);
    }
    const latest=await loadRegistry(hydrate);
    if(canonicalJSON(latest)!==canonicalJSON(registry))throw Error('Car availability changed. Reopen the control to apply your change.');
    if(!isCurrent())return false;
    if(readOnly())throw Error('Car availability was not changed: project storage is read-only.');
    const next=selectCarVersion(latest,change.canonical,change.active,change.alternates);
    // Ordinary car saves optimistically replace the local cache. For a
    // visibility change, only the server-confirmed write should affect runtime.
    const persisted=await save('cars',CAR_VERSIONS_FILE,next,{createVersion:true,timeoutMs:15000});
    if(!persisted?.persisted)throw Error(`Car availability was not saved: ${persisted?.reason||'server did not confirm'}`);
    await refresh().catch(()=>getRaceCarVersions());
    if(isCurrent())editor.status=`${name} ${change.active===name?'enabled':'disabled'} · ${change.active} is playable`;
    return true;
  }finally{
    editor.carAvailabilityBusy=false;
  }
}
