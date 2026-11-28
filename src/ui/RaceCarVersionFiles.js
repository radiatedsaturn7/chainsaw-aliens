import {hasRenderableModelGeometry} from '../model3d/ModelGeometryReady.js';
import {modelAssets} from '../model3d/ModelAssets.js';
import {hydrateProjectFilePayload,loadProjectFile} from './projectFiles.js';
import {CAR_VERSIONS_FILE,activeCarVersionRef,canonicalCarVersionRef,mergeCarVersionDocument,normalizeCarVersions} from '../racing/CarVersions.js';

const registryFrom=payload=>normalizeCarVersions(payload?.data);
let cachedPayload,cachedVersions;
export function getRaceCarVersions(){
 const payload=loadProjectFile('cars',CAR_VERSIONS_FILE);
 if(cachedVersions&&cachedPayload===payload)return cachedVersions;
 cachedPayload=payload;return cachedVersions=registryFrom(payload);
}
export async function hydrateRaceCarVersions(){
 try{
  const payload=await hydrateProjectFilePayload('cars',CAR_VERSIONS_FILE,{hydrateDependencies:false});
  if(!payload)return getRaceCarVersions();
  cachedPayload=payload;return cachedVersions=registryFrom(payload);
 }catch{return getRaceCarVersions();}
}

function modelRefs(variant){
 const art=(variant?.data?.car||variant?.data)?.art;
 const body=art?.bodyModel?.ref;
 const wheel=art?.wheelModel?.ref;
 if(!body||wheel===body)return [];
 if(wheel&&Array.isArray(art.wheelModel.scale)&&art.wheelModel.scale.some(value=>!Number.isFinite(Number(value))||Number(value)<=0))return [];
 return [body,...(wheel?[wheel]:[])];
}

function mergePayload(base,variant){
 const data=mergeCarVersionDocument(base.data,variant.data);
 return data===base.data?base:{...base,data,savedAt:Math.max(Number(base.savedAt)||0,Number(variant.savedAt)||0)};
}

const merges=new WeakMap();
function memoizedMerge(base,variant){
 const previous=merges.get(base);
 if(previous?.variant===variant)return previous.payload;
 const payload=mergePayload(base,variant);
 merges.set(base,{variant,payload});return payload;
}

export function resolveRaceCarVersionFile(ref,{versions=getRaceCarVersions(),allowSyncFetch=true}={}){
 const canonical=canonicalCarVersionRef(versions,ref);
 const base=loadProjectFile('cars',canonical,{allowSyncFetch});
 if(!base?.data)return {ref,payload:canonical!==ref?loadProjectFile('cars',ref,{allowSyncFetch}):base};
 const active=activeCarVersionRef(versions,canonical);
 if(!active||active===canonical)return {ref:canonical,payload:base};
 const variant=loadProjectFile('cars',active,{allowSyncFetch});
 const requirements=modelRefs(variant);
 if(!requirements.length||!requirements.map(ref=>modelAssets.get(ref)).every(hasRenderableModelGeometry))
  return {ref:canonical,payload:base};
 return {ref:canonical,payload:memoizedMerge(base,variant)};
}

export async function hydrateRaceCarVersionFile(ref,{versions=null,originalOnly=false,...options}={}){
 versions ||= await hydrateRaceCarVersions();
 const canonical=canonicalCarVersionRef(versions,ref);
 const base=await hydrateProjectFilePayload('cars',canonical,options);
 if(!base?.data)return {ref,payload:canonical!==ref?await hydrateProjectFilePayload('cars',ref,options):base};
 if(originalOnly)return {ref:canonical,payload:base};
 const active=activeCarVersionRef(versions,canonical);
 if(!active||active===canonical)return {ref:canonical,payload:base};
 try{
  const variant=await hydrateProjectFilePayload('cars',active,options);
  const requirements=modelRefs(variant);
  const models=await Promise.all(requirements.map(ref=>modelAssets.prepare(ref)));
  if(!models.length||!models.every(hasRenderableModelGeometry))return {ref:canonical,payload:base};
  return {ref:canonical,payload:memoizedMerge(base,variant)};
 }catch{return {ref:canonical,payload:base};}
}
