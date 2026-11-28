import {decodeStudioRosterPair} from './StudioRosterPack.js';
import {studioRoster} from './studio-roster/index.js';
import {validateModelDocument} from './ModelDocument.js';

const parts=new Map(studioRoster.flatMap(entry=>[
 [entry.bodyRef,{entry,key:'body'}],[entry.wheelRef,{entry,key:'wheel'}]
]));
export const STUDIO_ROSTER_CACHE_PAIRS=8;
const validated=new WeakSet();
export const isValidatedStudioPackModel=model=>validated.has(model);
export const studioRosterEntry=ref=>parts.get(ref)?.entry;

const enabled=typeof location==='undefined'||new URLSearchParams(location.search).get('studioRoster')!=='legacy';
export const studioRosterModelUrl=ref=>enabled?parts.get(ref)?.entry.pack??null:null;

export const isStudioRosterWheel=(model,ref)=>{
 const route=parts.get(ref);
 return route?.key==='wheel'&&model?.name===route.entry.label+' · Studio wheel';
};

export function createStudioRosterLoader({fetchPair=readPair}={}){
 const pending=new Map(),ready=new Map();
 return async ref=>{
  const route=parts.get(ref);
  if(!route||!enabled)return null;
  const {entry,key}=route;
  let pair=ready.get(entry.id);
  if(pair){
   ready.delete(entry.id);ready.set(entry.id,pair);
   return pair[key];
  }
  if(!pending.has(entry.id))pending.set(entry.id,Promise.resolve().then(()=>fetchPair(entry.pack)).then(pair=>{
   if(pair?.body?.kind!=='rtg-model'||pair?.wheel?.kind!=='rtg-model'
     ||pair.body.name!==entry.label+' · Studio body'||pair.wheel.name!==entry.label+' · Studio wheel')
    throw Error('Invalid Studio roster pair');
   const documents=[pair.body,pair.wheel,...(pair.wheel.rearAxleModel?[pair.wheel.rearAxleModel]:[])];
   documents.forEach(validateModelDocument);
   documents.forEach(model=>validated.add(model));
   ready.set(entry.id,pair);
   while(ready.size>STUDIO_ROSTER_CACHE_PAIRS)ready.delete(ready.keys().next().value);
   return pair;
  }).catch(()=>null).finally(()=>pending.delete(entry.id)));
  return (await pending.get(entry.id))?.[key]??null;
 };
}

async function readPair(url){
 if(typeof DecompressionStream!=='function')return null;
 const response=await fetch(url,{signal:globalThis.AbortSignal?.timeout?.(12000)});
 if(!response.ok||!response.body)return null;
 return decodeStudioRosterPair(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json());
}

export const loadStudioRosterModel=createStudioRosterLoader();
