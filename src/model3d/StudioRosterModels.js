import {decodeStudioRosterPair} from './StudioRosterPack.js';
import {studioRoster} from './studio-roster/index.js';

const parts=new Map(studioRoster.flatMap(entry=>[
 [entry.bodyRef,{entry,key:'body'}],[entry.wheelRef,{entry,key:'wheel'}]
]));
const pairs=new Map();
const enabled=typeof location==='undefined'||new URLSearchParams(location.search).get('studioRoster')!=='legacy';
export const studioRosterModelUrl=ref=>enabled?parts.get(ref)?.entry.pack??null:null;

export const isStudioRosterWheel=(model,ref)=>{
 const route=parts.get(ref);
 return route?.key==='wheel'&&model?.name===route.entry.label+' · Studio wheel';
};

export function createStudioRosterLoader({fetchPair=readPair}={}){
 const cache=new Map();
 return async ref=>{
  const route=parts.get(ref);
  if(!route||!enabled)return null;
  const {entry,key}=route;
  if(!cache.has(entry.id))cache.set(entry.id,Promise.resolve().then(()=>fetchPair(entry.pack)).then(pair=>{
   if(pair?.body?.kind!=='rtg-model'||pair?.wheel?.kind!=='rtg-model'
     ||pair.body.name!==entry.label+' · Studio body'||pair.wheel.name!==entry.label+' · Studio wheel')
    throw Error('Invalid Studio roster pair');
   return pair;
  }).catch(()=>null));
  return (await cache.get(entry.id))?.[key]??null;
 };
}

async function readPair(url){
 if(typeof DecompressionStream!=='function')return null;
 const response=await fetch(url,{signal:globalThis.AbortSignal?.timeout?.(12000)});
 if(!response.ok||!response.body)return null;
 return decodeStudioRosterPair(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json());
}

export const loadStudioRosterModel=createStudioRosterLoader();
