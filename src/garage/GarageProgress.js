import {normalizeCarPart,safeGarageKey} from './CarPart.js';

export function normalizeGarageProgress(source={}){
 const parts={},cars={};
 for(const [id,item] of Object.entries(source.parts||{}))if(safeGarageKey(id)&&item?.carPart){
  try{parts[id]={...structuredClone(item),carPart:normalizeCarPart(item.carPart)};}catch{/* Invalid obsolete definitions cannot be equipped. */}
 }
 for(const [ref,setup] of Object.entries(source.cars||{}))if(safeGarageKey(ref)){
  cars[ref]={installed:Object.fromEntries(Object.entries(setup.installed||{}).filter(([slot,id])=>safeGarageKey(slot)&&safeGarageKey(id))),
   tune:Object.fromEntries(Object.entries(setup.tune||{}).filter(([key,value])=>safeGarageKey(key)&&Number.isFinite(value)))};
 }
 return {parts,cars};
}
