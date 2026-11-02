import {openEditorForm} from '../../ui/shared/editorForm.js';

export function wheelSettingsFromForm(values,previous) {
 const settings={...previous,buttons:{}};
 for(const key of ['enabled','rotation','gameRotation','deadzone','strength','limit','smoothing','invertForce'])settings[key]=values[key];
 for(const key of ['steer','throttle','brake','clutch'])settings[key]=values[`${key}Channel`]?{
  channel:values[`${key}Channel`],...Object.fromEntries((key==='steer'?['left','center','right']:['idle','full']).map(k=>[k,Number(values[`${key}_${k}`])]))}:null;
 for(const key of ['upshift','downshift','handbrake','camera','pause'])if(values[`button_${key}`])settings.buttons[key]=values[`button_${key}`];
 return settings;
}
export async function openWheelSettings(service) {
 service.pause();
 const settings=service.settings;
 const channels=(value,buttonsOnly=false)=>{
  const list=service.input.channels().filter(c=>!buttonsOnly||c.button).map(c=>({value:c.key,label:c.label}));
  if(value&&!list.some(c=>c.value===value))list.push({value,label:'Saved binding (device disconnected)'});
  return [{value:'',label:'Not assigned'},...list];
 };
 const fields=[
  {type:'preview',label:'Wheel status and live readings',animated:true,render(canvas,values){
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,320,180);ctx.fillStyle='#eef4ed';ctx.font='12px sans-serif';
   const lines=service.diagnostics().split('\n');
   for(const key of ['steer','throttle','brake','clutch']){
    const channel=service.input.channels().find(c=>c.key===values[`${key}Channel`]);
    lines.push(`${key}: ${Number.isFinite(channel?.value)?channel.value.toFixed(3):'not available'}`);
   }
   lines.forEach((line,i)=>ctx.fillText(line,8,16+i*17,304));
  }},
  {type:'button',label:'Connect WebHID feedback device',onClick:()=>service.connect()},
  {type:'button',label:'Add WebHID input device (wheel / pedals)',onClick:()=>service.connectInput()},
  {type:'button',label:'Disconnect feedback device',onClick:()=>service.disconnect()},
  {id:'enabled',type:'checkbox',label:'Use calibrated wheel input',value:settings.enabled},
  {id:'rotation',label:'Rotation configured in wheel driver (degrees)',type:'range',min:180,max:1440,step:10,value:settings.rotation,section:'Steering'},
  {id:'gameRotation',label:'Wheel travel for full in-game steering (degrees)',type:'range',min:180,max:1440,step:10,value:settings.gameRotation,section:'Steering'},
  {id:'deadzone',label:'Center dead zone',type:'range',min:0,max:.2,step:.005,value:settings.deadzone,section:'Steering'},
 ];
 for(const [key,title] of [['steer','Steering'],['throttle','Accelerator'],['brake','Brake'],['clutch','Clutch (optional)']]){
  fields.push({id:`${key}Channel`,label:'Device and axis / button',value:settings[key]?.channel||'',options:v=>channels(v[`${key}Channel`]||settings[key]?.channel),section:title});
  for(const point of key==='steer'?['left','center','right']:['idle','full']){
   fields.push({id:`${key}_${point}`,label:`${point} raw value`,value:settings[key]?.[point]??(point==='left'?-1:point==='right'||point==='full'?1:0),min:-1,max:1,step:'any',section:title});
   fields.push({type:'button',label:`Capture ${point} position`,section:title,onClick:values=>{
    const raw=service.input.channels().find(c=>c.key===values[`${key}Channel`])?.value;
    if(!Number.isFinite(raw))throw Error('Choose a connected axis and move it first');
    return {[`${key}_${point}`]:Number(raw.toFixed(6))};
   }});
  }
 }
 for(const [key,label] of [['upshift','Shift up'],['downshift','Shift down'],['handbrake','Handbrake'],['camera','Change camera'],['pause','Pause / resume']])fields.push({id:`button_${key}`,label,value:settings.buttons[key]||'',options:v=>channels(v[`button_${key}`]||settings.buttons[key],true),section:'Buttons'});
 fields.push(
  {id:'strength',label:'Force-feedback strength',type:'range',min:0,max:1,step:.01,value:settings.strength,section:'Force feedback'},
  {id:'limit',label:'Software torque cap (fraction of full output)',type:'range',min:0,max:.35,step:.01,value:settings.limit,section:'Force feedback'},
  {id:'smoothing',label:'Force smoothing (seconds)',type:'range',min:.01,max:.2,step:.005,value:settings.smoothing,section:'Force feedback'},
  {id:'invertForce',label:'Invert force direction',type:'checkbox',value:settings.invertForce,section:'Force feedback'},
  {type:'button',label:'Save calibration and enable force feedback',section:'Force feedback',onClick:async values=>{await service.configure(wheelSettingsFromForm(values,service.settings));await service.arm();}},
  {type:'button',label:'Disable force feedback now',section:'Force feedback',onClick:()=>service.stop()},
  {type:'button',label:'Use mock feedback backend (no motor output)',section:'Diagnostics',onClick:()=>service.mock()},
  {type:'button',label:'Show full diagnostics',section:'Diagnostics',onClick:()=>openEditorForm('Wheel diagnostics',[{id:'status',type:'textarea',label:'Connection / output',readOnly:true,value:service.diagnostics(),rows:9}])}
 );
 const result=await openEditorForm('Steering wheel and pedals',fields,{description:'Connect and calibrate each device separately. Capture left, center and right; then released (idle) and pressed (full) pedals. Input works without force feedback. Force feedback is experimental and off until explicitly enabled. Start with a low torque limit in your wheel’s own software. Pause stops forces; loss of focus requires enabling feedback again. Applying settings turns feedback off. No hardware has been verified yet.'});
 if(result)await service.configure(wheelSettingsFromForm(result,service.settings));
}
