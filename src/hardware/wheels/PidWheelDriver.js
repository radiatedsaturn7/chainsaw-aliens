import {parsePidLayout,PID,buildReport,unpackReport,selectorValue,selectedUsage,forceToRaw} from './vendor/PidDescriptor.js';

export const EFFECT_DURATION_MS=120;
const X=0x10030;
const field=(report,key)=>report?.fields[key];
const canSelect=(report,key,value)=>field(report,key)&&selectorValue(field(report,key),value)!==null;

// Deliberately narrower than LibreCorsa: no assumed block 1, unsigned midpoint,
// infinite effect, unknown direction, or full device gain.
export function inspectPidDevice(device) {
 const layout=parsePidLayout(device?.collections||[]);
 const reject=reason=>({forceFeedback:false,reason,layout:null});
 if(!layout)return reject('No standard PID constant-force reports exposed. Input may still work.');
 const l=layout,mag=field(l.constantForce,PID.MAGNITUDE),duration=field(l.setEffect,PID.DURATION);
 if(!mag||mag.min>=0||mag.max<=0)return reject('Unsigned/unipolar force encoding is not supported safely.');
 if(!l.setEffect||!duration||duration.min>0||duration.max<=EFFECT_DURATION_MS||duration.bitSize<8)
  return reject('A finite-duration effect cannot be configured.');
 if(duration.unitExponent!==-3||!['si-linear','si-rotation','english-linear','english-rotation'].includes(duration.unitSystem)||duration.unitFactorTimeExponent!==1
   ||(duration.physicalMaximum!==0&&duration.physicalMaximum!==undefined&&(duration.physicalMinimum!==duration.min||duration.physicalMaximum!==duration.max)))
  return reject('Duration must explicitly use unscaled milliseconds; unknown time units are unsafe.');
 for(const report of Object.values(l))if(report){
  if(report.bitLength>8192||report.bitLength<=0)return reject('Unsupported report size.');
  for(const f of Object.values(report.fields))if(f.bitSize<1||f.bitSize>32||!Number.isFinite(f.max)||f.max<=f.min)
   return reject('Invalid or unsupported report field range.');
 }
 if(!field(l.setEffect,X)||!field(l.setEffect,PID.DIRECTION_ENABLE)||field(l.setEffect,X).min!==0||field(l.setEffect,X).max!==1||field(l.setEffect,PID.DIRECTION_ENABLE).min!==0)return reject('Explicit X-axis force selection is required.');
 if(!canSelect(l.setEffect,PID.EFFECT_TYPE,PID.ET_CONSTANT_FORCE)||!canSelect(l.createNewEffect,PID.EFFECT_TYPE,PID.ET_CONSTANT_FORCE)||!l.blockLoad||!field(l.blockLoad,PID.EFFECT_BLOCK_INDEX)||!canSelect(l.blockLoad,PID.BLOCK_LOAD_STATUS,PID.BLOCK_LOAD_SUCCESS))
  return reject('Confirmed constant-force allocation is required.');
 if(!canSelect(l.effectOperation,PID.EFFECT_OPERATION,PID.OP_EFFECT_START)||!canSelect(l.effectOperation,PID.EFFECT_OPERATION,PID.OP_EFFECT_STOP)||!field(l.effectOperation,PID.LOOP_COUNT))return reject('Start, stop and finite loop count are required.');
 if(!canSelect(l.deviceControl,PID.DEVICE_CONTROL,PID.DC_ENABLE_ACTUATORS)||!canSelect(l.deviceControl,PID.DEVICE_CONTROL,PID.DC_DISABLE_ACTUATORS)||!canSelect(l.deviceControl,PID.DEVICE_CONTROL,PID.DC_STOP_ALL_EFFECTS))return reject('Actuator enable/disable commands are required.');
 if(!l.blockFree)return reject('Effect release report is required.');
 if(!field(l.setEffect,PID.GAIN)||!field(l.deviceGain,PID.DEVICE_GAIN)||field(l.setEffect,PID.GAIN).min!==0||field(l.deviceGain,PID.DEVICE_GAIN).min!==0)return reject('Effect and device gain limits are required.');
 return {forceFeedback:true,reason:'Experimental PID constant force; descriptor accepted, hardware untested.',layout:l};
}

export class PidWheelDriver {
 constructor(device,{timeoutMs=250}={}) {
  this.device=device;this.capabilities=inspectPidDevice(device);this.timeoutMs=timeoutMs;
  this.initialized=false;this.armed=false;this.generation=0;this.busy=null;this.block=null;this.error=null;
 }
 async io(work) {
  let timer;
  try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Wheel HID operation timed out')),this.timeoutMs);})]);}
  finally{clearTimeout(timer);}
 }
 async report(report,values,feature=false) {
  const r=buildReport(report,values);
  return this.io(()=>feature?this.device.sendFeatureReport(r.reportId,r.data):this.device.sendReport(r.reportId,r.data));
 }
 async control(usage) {
  const r=this.capabilities.layout?.deviceControl,f=field(r,PID.DEVICE_CONTROL);
  if(r&&f)await this.report(r,{[PID.DEVICE_CONTROL]:selectorValue(f,usage)});
 }
 async initialize() {
  if(!this.capabilities.forceFeedback)throw Error(this.capabilities.reason);
  if(this.busy||this.stopping)throw Error('Wheel is busy; wait for shutdown to finish.');
  if(this.initialized&&this.armed)return;
  const generation=++this.generation,l=this.capabilities.layout;
  const check=()=>{if(generation!==this.generation)throw Error('Wheel initialization cancelled');};
  this.error=null;
  const task=(async()=>{
   try{
    if(!this.device.opened)await this.io(()=>this.device.open());check();
    await this.control(PID.DC_DISABLE_ACTUATORS);check();
    await this.control(PID.DC_STOP_ALL_EFFECTS);check();
    // Software normalizes/clips to 20% by default. Device gain adds a second
    // hard ceiling of 35% of the strength configured in the wheel's own driver.
    await this.report(l.deviceGain,{[PID.DEVICE_GAIN]:Math.floor(field(l.deviceGain,PID.DEVICE_GAIN).max*.35)});check();
    await this.report(l.createNewEffect,{[PID.EFFECT_TYPE]:selectorValue(field(l.createNewEffect,PID.EFFECT_TYPE),PID.ET_CONSTANT_FORCE)},true);check();
    const view=await this.io(()=>this.device.receiveFeatureReport(l.blockLoad.reportId));check();
    let bytes=new Uint8Array(view.buffer,view.byteOffset,view.byteLength),size=Math.ceil(l.blockLoad.bitLength/8);
    if(bytes.length===size+1&&bytes[0]===l.blockLoad.reportId)bytes=bytes.subarray(1);
    if(bytes.length!==size)throw Error('Invalid PID allocation response size');
    const values=unpackReport(l.blockLoad,bytes),index=values[PID.EFFECT_BLOCK_INDEX];
    if(selectedUsage(field(l.blockLoad,PID.BLOCK_LOAD_STATUS),values[PID.BLOCK_LOAD_STATUS])!==PID.BLOCK_LOAD_SUCCESS||!Number.isInteger(index)||index<=0)throw Error('Wheel did not confirm effect allocation');
    for(const report of [l.setEffect,l.constantForce,l.effectOperation]){
     const f=field(report,PID.EFFECT_BLOCK_INDEX);if(!f||index<f.min||index>f.max)throw Error('Allocated effect index is out of range');
    }
    this.block=index;
    await this.report(l.setEffect,{[PID.EFFECT_BLOCK_INDEX]:index,[PID.EFFECT_TYPE]:selectorValue(field(l.setEffect,PID.EFFECT_TYPE),PID.ET_CONSTANT_FORCE),[PID.DURATION]:EFFECT_DURATION_MS,[PID.GAIN]:field(l.setEffect,PID.GAIN).max,[PID.TRIGGER_BUTTON]:255,[X]:1,[PID.DIRECTION_ENABLE]:0});check();
    await this.report(l.constantForce,{[PID.EFFECT_BLOCK_INDEX]:index,[PID.MAGNITUDE]:0});check();
    await this.control(PID.DC_ENABLE_ACTUATORS);check();
    this.initialized=true;this.armed=true;
   }catch(error){this.error=error.message;this.armed=false;this.initialized=false;await this.emergencyStop();throw error;}
  })();
  this.busy=task;try{await task;}finally{if(this.busy===task)this.busy=null;}
 }
 async emergencyStop() {
  const l=this.capabilities.layout;if(!l||!this.device.opened)return;
  const attempt=async work=>{try{await work();}catch{}};
  if(this.block!=null){
   await attempt(()=>this.report(l.constantForce,{[PID.EFFECT_BLOCK_INDEX]:this.block,[PID.MAGNITUDE]:0}));
   await attempt(()=>this.report(l.effectOperation,{[PID.EFFECT_BLOCK_INDEX]:this.block,[PID.EFFECT_OPERATION]:selectorValue(field(l.effectOperation,PID.EFFECT_OPERATION),PID.OP_EFFECT_STOP),[PID.LOOP_COUNT]:1}));
  }
  await attempt(()=>this.control(PID.DC_DISABLE_ACTUATORS));
 }
 // One operation in flight; callers drop intermediate outputs, never queue them.
 write(torque) {
  if(!this.armed||!this.initialized||this.busy)return Promise.resolve();
  if(!Number.isFinite(torque))return this.stop();
  const generation=this.generation,l=this.capabilities.layout;
  const task=(async()=>{
   try{
    // Public convention: positive turns rim right. PID +X is the source of
    // force, so its magnitude sign is inverted (same convention as LibreCorsa).
    await this.report(l.constantForce,{[PID.EFFECT_BLOCK_INDEX]:this.block,[PID.MAGNITUDE]:forceToRaw(field(l.constantForce,PID.MAGNITUDE),-Math.max(-.35,Math.min(.35,torque)))});
    if(generation!==this.generation||!this.armed)return;
    await this.report(l.effectOperation,{[PID.EFFECT_BLOCK_INDEX]:this.block,[PID.EFFECT_OPERATION]:selectorValue(field(l.effectOperation,PID.EFFECT_OPERATION),PID.OP_EFFECT_START),[PID.LOOP_COUNT]:1});
   }catch(error){this.error=error.message;this.armed=false;this.initialized=false;this.generation++;await this.emergencyStop();}
  })();this.busy=task;
  return task.finally(()=>{if(this.busy===task)this.busy=null;});
 }
 async quiet() {
  const generation=++this.generation,pending=this.busy;
  const task=(async()=>{
   if(pending)await pending.catch(()=>{});
   if(!this.armed||generation!==this.generation)return;
   const l=this.capabilities.layout;
   try{await this.report(l.constantForce,{[PID.EFFECT_BLOCK_INDEX]:this.block,[PID.MAGNITUDE]:0});
    if(generation!==this.generation)return;
    await this.report(l.effectOperation,{[PID.EFFECT_BLOCK_INDEX]:this.block,[PID.EFFECT_OPERATION]:selectorValue(field(l.effectOperation,PID.EFFECT_OPERATION),PID.OP_EFFECT_STOP),[PID.LOOP_COUNT]:1});
   }catch(error){this.error=error.message;this.armed=false;this.initialized=false;}
  })();this.busy=task;
  try{await task;}finally{if(this.busy===task)this.busy=null;}
 }
 async stop() {
  this.armed=false;this.initialized=false;++this.generation;
  if(this.stopping)return this.stopping;
  const pending=this.busy;
  this.stopping=(async()=>{
   if(pending)await pending.catch(()=>{});
   await this.emergencyStop();
   if(this.block!=null&&this.capabilities.layout?.blockFree){try{await this.report(this.capabilities.layout.blockFree,{[PID.EFFECT_BLOCK_INDEX]:this.block});}catch{}}
   this.block=null;
  })().finally(()=>{this.stopping=null;});
  return this.stopping;
 }
 disconnect() {this.armed=false;this.initialized=false;++this.generation;}
 async dispose() {await this.stop();if(this.block!=null&&this.capabilities.layout?.blockFree){try{await this.report(this.capabilities.layout.blockFree,{[PID.EFFECT_BLOCK_INDEX]:this.block});}catch{}}this.block=null;try{await this.io(()=>this.device.close());}catch{}}
}
