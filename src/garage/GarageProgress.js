import {normalizeCarCondition} from './GarageRepairs.js';
import {normalizeCarPart,safeGarageKey} from './CarPart.js';

export function normalizeSavedSetups(value){
 return Array.from({length:8},(_,i)=>{
  const slot=Array.isArray(value)?value[i]:null;if(!slot||typeof slot!=='object')return null;
  return {installed:Object.fromEntries(Object.entries(slot.installed||{}).filter(([key,id])=>safeGarageKey(key)&&safeGarageKey(id))),
   tune:Object.fromEntries(Object.entries(slot.tune||{}).filter(([key,v])=>safeGarageKey(key)&&Number.isFinite(v))),
   ...(safeGarageKey(slot.setupId)?{setupId:slot.setupId}:{}),pi:Math.max(0,Math.min(1000,Math.round(Number(slot.pi)||0))),tires:typeof slot.tires==='string'?slot.tires.slice(0,80):'Stock'};
 });
}
export function normalizeGarageProgress(source={}){
 const parts={},cars={};
 for(const [id,item] of Object.entries(source.parts||{}))if(safeGarageKey(id)&&item?.carPart){
  try{parts[id]={...structuredClone(item),carPart:normalizeCarPart(item.carPart)};}catch{/* Invalid obsolete definitions cannot be equipped. */}
 }
 for(const [ref,setup] of Object.entries(source.cars||{}))if(safeGarageKey(ref)){
  cars[ref]={...(Array.isArray(setup.savedSetups)?{savedSetups:normalizeSavedSetups(setup.savedSetups)}:{}),...(safeGarageKey(setup.setupId)?{setupId:setup.setupId}:{}),...(setup.condition?{condition:normalizeCarCondition(setup.condition)}:{}),installed:Object.fromEntries(Object.entries(setup.installed||{}).filter(([slot,id])=>safeGarageKey(slot)&&safeGarageKey(id))),
   tune:Object.fromEntries(Object.entries(setup.tune||{}).filter(([key,value])=>safeGarageKey(key)&&Number.isFinite(value)))};
 }
 return {parts,cars};
}
