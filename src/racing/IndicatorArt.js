import {MECHANICAL_LAMPS,CONTROL_LAMPS} from './MechanicalInstruments.js';
export const INDICATOR_SIGNALS={...MECHANICAL_LAMPS,...CONTROL_LAMPS};
const integer=(v,d,min=0)=>Number.isFinite(Number(v))?Math.max(min,Math.round(Number(v))):d;
export function normalizeIndicatorCrop(value){
 if(!value||typeof value!=='object')return null;
 return {x:integer(value.x,0),y:integer(value.y,0),width:integer(value.width,1,1),height:integer(value.height,1,1)};
}
export function fitIndicatorCrop(value,width,height){
 const c=normalizeIndicatorCrop(value);if(!c||width<1||height<1)return null;
 const x=Math.min(width-1,c.x),y=Math.min(height-1,c.y);
 return {x,y,width:Math.min(width-x,c.width),height:Math.min(height-y,c.height)};
}
export function normalizeIndicators(items){return (Array.isArray(items)?items:[]).filter(v=>v&&typeof v==='object').map((v,i)=>({id:String(v.id||'indicator-'+i),name:String(v.name||'Indicator').slice(0,100),source:Object.hasOwn(INDICATOR_SIGNALS,v.source)?v.source:'enginelight',artRef:String(v.artRef||''),frameIndex:integer(v.frameIndex,0),crop:normalizeIndicatorCrop(v.crop)}));}
export function indicatorGauge(indicator,id){return {id,name:indicator.name,source:indicator.source,format:'icon',artRef:indicator.artRef,frameIndex:indicator.frameIndex,artCrop:indicator.crop,showValue:false,x:.45,y:.8,width:.08,height:.08,min:0,max:2};}
