export const CAR_VERSIONS_FILE='__car_versions__';
const kind='race-car-versions';
const name=value=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=64&&value===value.replace(/\s+/g,' ')
 && !/[\\/:*?"<>|]/.test(value)&&value!==CAR_VERSIONS_FILE?value:null;

export function normalizeCarVersions(data){
 const families=[];
 if(data?.kind===kind&&data.schemaVersion===1&&data.families&&typeof data.families==='object'&&!Array.isArray(data.families)){
  const objects=Object.entries(data.families).filter(([canonical,entry])=>name(canonical)&&entry&&typeof entry==='object');
  const reserved=new Set(objects.map(([canonical])=>canonical));
  const claims=new Map();
  for(const [,entry] of objects)for(const candidate of new Set(Array.isArray(entry.alternates)?entry.alternates:[]))
   if(name(candidate)&&!reserved.has(candidate))claims.set(candidate,(claims.get(candidate)||0)+1);
  for(const [canonical,entry] of objects){
   const alternates=[...new Set(Array.isArray(entry.alternates)?entry.alternates:[])].filter(candidate=>claims.get(candidate)===1);
   const active=entry.active===null?null:alternates.includes(entry.active)?entry.active:canonical;
   families.push([canonical,{active,alternates}]);
  }
 }
 return {kind,schemaVersion:1,families:Object.fromEntries(families)};
}

export function selectCarVersion(data,canonical,active,alternates=[]){
 if(!name(canonical)||active!==null&&!name(active))throw Error('Select valid saved car filenames');
 const normalized=normalizeCarVersions(data);
 if(canonicalCarVersionRef(normalized,canonical)!==canonical)throw Error('An alternate cannot also own a car family');
 const previous=Object.hasOwn(normalized.families,canonical)?normalized.families[canonical]:null;
 const options=[...new Set([...(previous?.alternates||[]),...alternates, ...(active&&active!==canonical?[active]:[])])];
 for(const ref of options)if(!name(ref)||ref!==canonical&&(Object.hasOwn(normalized.families,ref)||canonicalCarVersionRef(normalized,ref)!==ref&&canonicalCarVersionRef(normalized,ref)!==canonical))throw Error('An alternate is already assigned to another car');
 return normalizeCarVersions({...normalized,families:{...normalized.families,[canonical]:{active,alternates:options.filter(ref=>ref!==canonical)}}});
}

export function canonicalCarVersionRef(versions,ref){
 if(typeof ref!=='string'||Object.hasOwn(versions?.families||{},ref))return ref;
 for(const [canonical,entry] of Object.entries(versions?.families||{}))
  if(entry.alternates.includes(ref))return canonical;
 return ref;
}

// Older race documents sometimes persisted the normalized ID without the
// saved-car prefix. Only reinterpret a unique known former alternate, and
// never override an exact project or non-alternate physics ID.
export function legacyAlternateCarRef(versions,id){
 if(typeof id!=='string'||!id)return null;
 const matches=Object.entries(versions?.families||{}).filter(([,entry])=>entry.alternates.some(ref=>
  ref===id||ref.toLowerCase().replace(/\s+/g,'-')===id));
 return matches.length===1?matches[0][0]:null;
}

export function activeCarVersionRef(versions,canonical){
 const families=versions?.families||{};
 return Object.hasOwn(families,canonical)?families[canonical].active:canonical;
}

// Existing direct selections, saves, AI and ownership resolve by original key
// even when a family is disabled. Only new acquisition/picker rows disappear.
export function filterPlayableCarVersions(entries,versions,{includeDisabled=false}={}){
 const names=new Set(entries.map(row=>row.name));
 return entries.filter(({name})=>{
  const canonical=canonicalCarVersionRef(versions,name);
  // Never hide a viable car behind a missing canonical document.
  if(canonical!==name&&names.has(canonical))return false;
  return includeDisabled||activeCarVersionRef(versions,name)!==null;
 });
}

export function mergeCarVersionDocument(base,alternate){
 const current=base?.car||base, replacement=alternate?.car||alternate;
 if(!current?.id||!replacement?.art?.bodyModel?.ref)return base;
 const art={...current.art,bodyModel:replacement.art.bodyModel};
 if(replacement.art.wheelModel?.ref)art.wheelModel=replacement.art.wheelModel;
 if(typeof replacement.art.threeModelWheels==='boolean')art.threeModelWheels=replacement.art.threeModelWheels;
 const car={...current,art};
 if(['dynamic','dynamic-fixed','fixed-rear'].includes(replacement.camera?.trackingMode))
  car.camera={...current.camera,trackingMode:replacement.camera.trackingMode};
 return base.car?{...base,car}:car;
}
