import {normalizeRaceDoodadDocument} from './raceDoodads.js';

export function collectSceneryArtRefs(race, resolve = () => null) {
 const refs=new Set(),definitions=new Map();
 for(const d of race?.sceneryDefinitions||[]){if(d.artRef)refs.add(d.artRef);if(d.ref||d.name)definitions.set(d.ref||d.name,d);}
 for(const p of race?.scenery||[]){
  if(p.artRef)refs.add(p.artRef);
  if(p.previewDoodad?.artRef)refs.add(p.previewDoodad.artRef);
  if(!p.previewDoodad&&p.doodadRef){
   if(!definitions.has(p.doodadRef))definitions.set(p.doodadRef,resolve(p.doodadRef));
   const d=definitions.get(p.doodadRef);if(d?.artRef)refs.add(d.artRef);
  }
 }
 return [...refs];
}

// Transfer a compact definition table with the race. Workers and prepared-only
// playtests cannot rely on the main editor's in-memory project-file cache.
export async function hydrateSceneryDefinitions(race, load) {
 race.sceneryDefinitions ||= [];
 const known=new Set(race.sceneryDefinitions.map(d=>d.ref||d.name));
 const refs=[...new Set((race.scenery||[]).filter(p=>!p.previewDoodad&&p.doodadRef).map(p=>p.doodadRef))].filter(r=>!known.has(r));
 const missing=[];let next=0;
 await Promise.all(Array.from({length:Math.min(4,refs.length)},async()=>{
  while(next<refs.length){const ref=refs[next++];const payload=await load(ref);
   if(!payload){missing.push(ref);continue;}
   const d=normalizeRaceDoodadDocument(payload.data||payload,ref);race.sceneryDefinitions.push({...d,ref});
  }
 }));
 return missing;
}
