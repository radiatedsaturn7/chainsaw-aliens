import {menuElementPose} from './MenuDocument.js';
import {calculateCarPerformance} from '../racing/CarPerformance.js';

export const menuElementBounds=(element,bounds,pose=element)=>({x:bounds.x+pose.x*bounds.w,y:bounds.y+pose.y*bounds.h,w:element.w*bounds.w,h:element.h*bounds.h});
export const menuElementInteractive=e=>['button','choice','slider','toggle','keybind'].includes(e.type);
export const menuHit=(point,b)=>point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h;
const caption=(text,parameters)=>String(text).replace(/\{\{([\w.-]+)\}\}/g,(_,key)=>String(parameters[key]??''));

export function drawMenuScreen(ctx,bounds,document,screen,parameters,{time=0,resources,focus=null,selected=null,editing=false,videos=null}={}){
  ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();ctx.fillStyle=screen.background;ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
  const background=resources?.art(screen.backgroundArt,Math.floor(time*8));if(background)ctx.drawImage(background,bounds.x,bounds.y,bounds.w,bounds.h);
  if(screen.effect!=='none'){
    ctx.save();ctx.fillStyle=screen.effect==='stars'?'#ffffff':'#91bedb';ctx.strokeStyle='#91bedb';ctx.globalAlpha=0.5;
    for(let i=0;i<65;i++){const x=bounds.x+((i*0.61803398875)%1)*bounds.w,y=bounds.y+((i*0.381966+time*(screen.effect==='rain'?0.5:0.04))%1)*bounds.h;
      if(screen.effect==='rain'){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+12);ctx.stroke()}else ctx.fillRect(x,y,screen.effect==='snow'?3:2,screen.effect==='snow'?3:2);
    }ctx.restore();
  }
  for(const element of screen.elements){
    if(!element.visible)continue;const pose=editing?{x:element.x,y:element.y,opacity:1,scale:1,rotation:0}:menuElementPose(element,time),b=menuElementBounds(element,bounds,pose);
    ctx.save();ctx.translate(b.x+b.w/2,b.y+b.h/2);ctx.rotate(pose.rotation*Math.PI/180);ctx.scale(pose.scale,pose.scale);ctx.translate(-b.x-b.w/2,-b.y-b.h/2);ctx.globalAlpha=pose.opacity;
    ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
    const interactive=menuElementInteractive(element);if(interactive){ctx.fillStyle=element.background;ctx.fillRect(b.x,b.y,b.w,b.h);}
    ctx.fillStyle=element.color;ctx.font=`${Math.max(10,element.fontSize*Math.min(bounds.w/720,bounds.h/900))}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
    let label=caption(element.label,parameters),value=parameters[element.binding];
    if(element.type==='image'){const image=resources?.art(element.artRef,Math.floor(time*8));if(image)ctx.drawImage(image,b.x,b.y,b.w,b.h);else ctx.fillText(element.artRef||'Choose artwork',b.x+b.w/2,b.y+b.h/2,b.w-12);}
    else if(element.type==='video'){const video=videos?.get(element.id);if(video?.readyState>=2)ctx.drawImage(video,b.x,b.y,b.w,b.h);else ctx.fillText(editing?'Video: '+(element.videoUrl||'Choose source'):'Loading video…',b.x+b.w/2,b.y+b.h/2,b.w-12);}
    else if(['car-preview','car-stats','power-curve'].includes(element.type))drawCarComponent(ctx,b,element,resources?.car(value),resources,time);
    else{
      if(element.type==='choice'){const options=element.source?resources?.choices(element.source,document)||[]:element.options;label+=`: ${options.find(o=>JSON.stringify(o.value)===JSON.stringify(value))?.label||'Choose…'}`;}
      if(element.type==='toggle')label+=value?' ✓':' —';
      if(element.type==='keybind')label+=`: ${value||'Set key'}`;
      if(element.type==='slider'){
        const number=Number.isFinite(Number(value))?Number(value):element.min,ratio=Math.max(0,Math.min(1,(number-element.min)/(element.max-element.min||1)));
        ctx.fillStyle='#18242d';ctx.fillRect(b.x+10,b.y+b.h*0.7,b.w-20,5);ctx.fillStyle=element.color;ctx.fillRect(b.x+10,b.y+b.h*0.7,(b.w-20)*ratio,5);
        label+=`: ${Number(number.toFixed(2))}`;ctx.fillText(label,b.x+b.w/2,b.y+b.h*0.35,b.w-16);
      }else ctx.fillText(label,b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-16));
    }
    ctx.restore();
    if(element.id===focus||element.id===selected){ctx.save();ctx.strokeStyle=element.id===selected?'#ffce51':'#ffffff';ctx.lineWidth=3;ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);if(editing){ctx.fillStyle='#ffce51';ctx.fillRect(b.x+b.w-10,b.y+b.h-10,10,10)}ctx.restore();}
  }
  ctx.restore();
}
function drawCarComponent(ctx,b,e,car,resources,time){
  if(!car){ctx.fillText('Choose a car',b.x+b.w/2,b.y+b.h/2,b.w-10);return;}
  const renderer=resources.game.carEditor,tuning=resources.tuning(car);
  if(e.type==='car-preview'){
    ctx.save();const yaw=e.animation==='spin'?time/e.duration*Math.PI*2:Math.PI;
    const choice=renderer.getRaceCarProjectedArtRef(car,0,yaw);
    if(car.art?.bodyModel?.ref||!choice.artRef){resources.carPreview.draw(ctx,b,car,yaw,time);ctx.restore();return;}
    renderer.drawRaceCarBillboardLayers(ctx,{car,session:null,centerX:b.x+b.w/2,anchorY:b.y+b.h*0.58,baseWidth:Math.min(b.w*0.25,b.h*0.65),baseHeight:Math.min(b.w*0.25,b.h*0.65)*0.74,artChoice:choice,drawShadowLayer:false});ctx.restore();return;
  }
  if(e.type==='car-stats'){
    const performance=calculateCarPerformance(car);const lines=[car.name||'Car',`${Math.round(tuning.powerHp||0)} HP · ${Math.round(Number(tuning.torqueLbFt||0)*1.355817948)} Nm`,`${Math.round(tuning.weightKg||0)} kg · ${tuning.drivetrain||car.tuning?.drivetrain||''}`,`Class ${performance.performanceClass||performance.class||''}`];
    lines.forEach((line,i)=>ctx.fillText(line,b.x+b.w/2,b.y+(i+0.5)*b.h/lines.length,b.w-10));return;
  }
  const min=Number(tuning.idleRpm||800),max=Number(tuning.redlineRpm||7000),points=Array.from({length:41},(_,i)=>{const rpm=min+(max-min)*i/40,torque=renderer.getRaceTorqueNmAtRpm(rpm,tuning);return {rpm,torque,hp:torque*rpm/7127}}),peak=Math.max(1,...points.flatMap(p=>[p.torque,p.hp]));
  ctx.font=`${Math.max(10,Math.min(14,b.h/8))}px system-ui`;ctx.fillText('HP (gold) · Torque Nm (blue)',b.x+b.w/2,b.y+12,b.w-12);
  for(const [key,color] of [['hp','#ffd467'],['torque','#72caff']]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>{const x=b.x+10+i/40*(b.w-20),y=b.y+b.h-20-p[key]/peak*(b.h-45);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
  ctx.fillText(`${min} — ${max} RPM`,b.x+b.w/2,b.y+b.h-7,b.w-12);
}
