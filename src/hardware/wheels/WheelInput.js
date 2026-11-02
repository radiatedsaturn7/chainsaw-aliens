import {parseReport,gatherReports,unpackReport} from './vendor/PidDescriptor.js';
export const clamp=(v,lo=-1,hi=1)=>Math.max(lo,Math.min(hi,v));
export const WHEEL_DEFAULTS=Object.freeze({enabled:false,rotation:900,gameRotation:540,deadzone:.01,strength:.5,limit:.2,smoothing:.04,invertForce:false,steer:null,throttle:null,brake:null,clutch:null,buttons:{}});
export function normalizeWheelSettings(value={}) {
 const out={...WHEEL_DEFAULTS,enabled:value.enabled===true,invertForce:value.invertForce===true,buttons:{...value.buttons}};
 for(const [key,lo,hi] of [['rotation',180,1440],['gameRotation',180,1440],['deadzone',0,.2],['strength',0,1],['limit',0,.35],['smoothing',.01,.2]])out[key]=clamp(Number.isFinite(Number(value[key]))?Number(value[key]):WHEEL_DEFAULTS[key],lo,hi);
 for(const key of ['steer','throttle','brake','clutch'])out[key]=value[key]&&typeof value[key].channel==='string'?{...value[key]}:null;
 return out;
}
export function calibratedSteering(raw,binding,settings) {
 if(!Number.isFinite(raw)||![binding?.left,binding?.center,binding?.right].every(Number.isFinite))return null;
 const {left,center,right}=binding;
 if((left-center)*(right-center)>=0||Math.min(Math.abs(left-center),Math.abs(right-center))<.01)return null;
 const direction=Math.sign(right-center),delta=(raw-center)*direction;
 let normalized=delta/(delta<0?Math.abs(left-center):Math.abs(right-center));
 normalized=clamp(normalized);
 const dead=settings.deadzone;
 normalized=Math.abs(normalized)<=dead?0:Math.sign(normalized)*(Math.abs(normalized)-dead)/(1-dead);
 return clamp(normalized*settings.rotation/settings.gameRotation);
}
export function calibratedPedal(raw,binding) {
 if(!Number.isFinite(raw)||!Number.isFinite(binding?.idle)||!Number.isFinite(binding?.full)||Math.abs(binding.full-binding.idle)<.01)return null;
 return clamp((raw-binding.idle)/(binding.full-binding.idle),0,1);
}
export class WheelInput {
 constructor(navigator=globalThis.navigator,now=()=>performance.now()) {this.navigator=navigator;this.now=now;this.hidDevices=new Map();this.previousButtons={};}
 pads(){try{return Array.from(this.navigator?.getGamepads?.()||[]).filter(p=>p?.connected);}catch{return [];}}
 channels() {
  const result=[];
  for(const pad of this.pads()) {
   const prefix=JSON.stringify(['pad',pad.id,pad.index]);
   pad.axes.forEach((value,index)=>result.push({key:`${prefix}/axis/${index}`,label:`${pad.id} · axis ${index}: ${Number(value).toFixed(3)}`,value,padIndex:pad.index}));
   pad.buttons.forEach((button,index)=>result.push({key:`${prefix}/button/${index}`,label:`${pad.id} · button ${index}: ${Number(button.value).toFixed(2)}`,value:button.value,padIndex:pad.index,button:true}));
  }
  for(const [device,entry] of this.hidDevices)for(const c of entry.channels.values())result.push({...c,value:device.opened?c.value:null});
  return result;
 }
 addHid(device) {
  if(this.hidDevices.has(device))return;
  const reports=new Map(),channels=new Map();
  for(const [id,raw] of gatherReports(device.collections||[],'inputReports')) {
   const layout=parseReport(id,raw.items);if(layout.bitLength>8192)continue;
   reports.set(id,layout);
   for(const [usage,f] of Object.entries(layout.fields)){
    const page=Number(usage)>>>16,u=Number(usage)&65535;
    if(f.isAbsolute===false||f.bitSize>32||f.bitSize<1||f.max<=f.min||f.usages)continue;
    if(!((page===1&&u>=0x30&&u<=0x38)||(page===2&&(u===0xc4||u===0xc5||u===0xc8))||page===9))continue;
    const key=JSON.stringify(['hid',device.vendorId,device.productId,device.productName,id,Number(usage)]);
    channels.set(key,{key,label:`${device.productName} · report ${id} usage ${Number(usage).toString(16)}`,value:null,button:page===9,reportId:id,usage:Number(usage),field:f});
   }
  }
  const onReport=event=>{
   const layout=reports.get(event.reportId);if(!layout)return;if(event.data.byteLength<Math.ceil(layout.bitLength/8)){for(const c of channels.values())if(c.reportId===event.reportId)c.value=null;return;}
   const values=unpackReport(layout,new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength));
   for(const c of channels.values())if(c.reportId===event.reportId){const value=values[c.usage];if(!Number.isFinite(value)||value<c.field.min||value>c.field.max){c.value=null;continue;}c.value=c.button?clamp(value,0,1):clamp(2*(value-c.field.min)/(c.field.max-c.field.min)-1);}
  };
  device.addEventListener?.('inputreport',onReport);this.hidDevices.set(device,{channels,onReport});
 }
 removeHid(device){const entry=this.hidDevices.get(device);if(entry)device.removeEventListener?.('inputreport',entry.onReport);this.hidDevices.delete(device);}
 read(settings,{consume=true}={}) {
  if(!settings.enabled)return null;
  const channels=new Map(this.channels().map(c=>[c.key,c])),get=b=>channels.get(b?.channel)?.value;
  const steer=calibratedSteering(get(settings.steer),settings.steer,settings);
  if(steer===null)return null;
  const result={steer,throttle:0,brake:0,clutch:0,pressed:{},held:{}};
  for(const key of ['throttle','brake','clutch'])if(settings[key]){
   const value=calibratedPedal(get(settings[key]),settings[key]);if(value===null)return null;result[key]=value;
  }
  for(const [action,channel] of Object.entries(settings.buttons||{})){
   const held=(channels.get(channel)?.value||0)>.5;result.held[action]=held;result.pressed[action]=held&&!this.previousButtons[action];
  }
  if(consume)this.previousButtons=result.held;return result;
 }
 excludedPadIndices(settings) {
  if(!settings.enabled)return new Set();
  const keys=new Set([settings.steer?.channel,...['throttle','brake','clutch'].map(k=>settings[k]?.channel),...Object.values(settings.buttons||{})]);
  return new Set(this.channels().filter(c=>keys.has(c.key)&&c.padIndex!=null).map(c=>c.padIndex));
 }
}
